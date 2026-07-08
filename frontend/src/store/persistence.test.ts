import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { Snapshot } from '../types/domain'
import { SAVE_DEBOUNCE_MS, SaveScheduler, type SaveSchedulerHooks } from './persistence'

vi.mock('../api/data', () => ({
  saveData: vi.fn(),
}))

import { saveData } from '../api/data'

const mockSave = vi.mocked(saveData)

function snapshot(): Snapshot {
  return {
    username: 'u',
    install: '2026-07-01',
    updatedAt: '',
    goals: {},
    backlog: [],
    recurring: [],
    seeded: {},
    carriedThrough: '',
  }
}

function makeHooks(): SaveSchedulerHooks & {
  statuses: string[]
  version: number
  conflicts: unknown[]
} {
  const h = {
    statuses: [] as string[],
    version: 3,
    conflicts: [] as unknown[],
    getSnapshot: () => snapshot(),
    getVersion: () => h.version,
    setVersion: (v: number) => {
      h.version = v
    },
    setStatus: (s: string) => {
      h.statuses.push(s)
    },
    onConflict: (w: unknown) => {
      h.conflicts.push(w)
    },
  }
  return h as ReturnType<typeof makeHooks>
}

describe('SaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSave.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces a burst of mutations into one PUT', async () => {
    mockSave.mockResolvedValue({ version: 4, updatedAt: 'x' })
    const hooks = makeHooks()
    const s = new SaveScheduler(hooks)

    s.markDirty()
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 100)
    s.markDirty() // resets the window
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 100)
    expect(mockSave).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledWith(3, expect.objectContaining({ username: 'u' }), {})
    expect(hooks.version).toBe(4)
    expect(hooks.statuses).toEqual(['saving', 'saved'])

    await vi.advanceTimersByTimeAsync(2000)
    expect(hooks.statuses).toEqual(['saving', 'saved', 'idle'])
  })

  it('flushNow saves immediately and cancels the pending timer', async () => {
    mockSave.mockResolvedValue({ version: 4, updatedAt: 'x' })
    const hooks = makeHooks()
    const s = new SaveScheduler(hooks)

    s.markDirty()
    await s.flushNow()
    expect(mockSave).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2)
    expect(mockSave).toHaveBeenCalledTimes(1) // timer was cancelled, no double save
  })

  it('failure keeps the change dirty and reports error; retry re-flushes', async () => {
    mockSave.mockRejectedValueOnce(new ApiError(500, 'http_500', null))
    mockSave.mockResolvedValueOnce({ version: 4, updatedAt: 'x' })
    const hooks = makeHooks()
    const s = new SaveScheduler(hooks)

    s.markDirty()
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(hooks.statuses).toEqual(['saving', 'error'])
    expect(s.hasPending()).toBe(true)

    await s.flushNow() // the retry button path
    expect(hooks.version).toBe(4)
    expect(hooks.statuses).toContain('saved')
    expect(s.hasPending()).toBe(false)
  })

  it('409 hands the winning doc to onConflict without an error status', async () => {
    const winning = { error: 'version_conflict', version: 9, data: snapshot() }
    mockSave.mockRejectedValueOnce(new ApiError(409, 'version_conflict', winning))
    const hooks = makeHooks()
    const s = new SaveScheduler(hooks)

    s.markDirty()
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(hooks.conflicts).toEqual([winning])
    expect(hooks.statuses).toEqual(['saving', 'idle'])
    expect(s.hasPending()).toBe(false)
  })

  it('no-op flush when nothing is dirty', async () => {
    const s = new SaveScheduler(makeHooks())
    await s.flushNow()
    expect(mockSave).not.toHaveBeenCalled()
  })
})

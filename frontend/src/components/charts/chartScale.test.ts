import { describe, expect, it } from 'vitest'
import { niceTicks } from './chartScale'

describe('niceTicks', () => {
  it('produces integer ticks for small goal counts', () => {
    expect(niceTicks(3, 3)).toEqual([0, 1, 2, 3])
    expect(niceTicks(4, 4)).toEqual([0, 1, 2, 3, 4])
  })

  it('snaps to 1/2/5 steps', () => {
    expect(niceTicks(7, 4)).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(10, 4)).toEqual([0, 5, 10])
    expect(niceTicks(0.9, 3)).toEqual([0, 0.5, 1])
  })

  it('always starts at 0, ascends, and covers the max', () => {
    for (const [max, count] of [
      [1, 4],
      [3.7, 3],
      [12, 4],
      [99, 5],
      [250, 4],
    ] as const) {
      const ticks = niceTicks(max, count)
      expect(ticks[0]).toBe(0)
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max)
      for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1])
    }
  })

  it('falls back to a 0..1 axis for empty/garbage maxima', () => {
    expect(niceTicks(0, 4)).toEqual([0, 0.5, 1])
    expect(niceTicks(Number.NaN, 2)).toEqual([0, 0.5, 1])
    expect(niceTicks(-5, 2)).toEqual([0, 0.5, 1])
  })
})

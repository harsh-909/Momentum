import { describe, expect, it, vi } from 'vitest'
import type { DragEndEvent } from '@dnd-kit/core'
import { dragEndIndices, makeDragEndHandler } from './dragEnd'

function event(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId == null ? null : { id: overId },
  } as unknown as DragEndEvent
}

describe('dragEndIndices', () => {
  const ids = ['a', 'b', 'c']

  it('maps active/over ids to from/to indices', () => {
    expect(dragEndIndices(ids, 'a', 'c')).toEqual({ from: 0, to: 2 })
    expect(dragEndIndices(ids, 'c', 'a')).toEqual({ from: 2, to: 0 })
  })

  it('returns null when dropped on itself or outside the list', () => {
    expect(dragEndIndices(ids, 'b', 'b')).toBeNull()
    expect(dragEndIndices(ids, 'b', null)).toBeNull()
    expect(dragEndIndices(ids, 'b', 'nope')).toBeNull()
    expect(dragEndIndices(ids, 'nope', 'a')).toBeNull()
  })
})

describe('makeDragEndHandler', () => {
  it('forwards resolved moves (the GoalList onDragEnd wiring)', () => {
    const reorderGoal = vi.fn()
    const date = '2026-07-03'
    const goals = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }]
    const handler = makeDragEndHandler(
      () => goals.map((g) => g.id),
      (from, to) => reorderGoal(date, from, to),
    )

    handler(event('g3', 'g1'))
    expect(reorderGoal).toHaveBeenCalledWith(date, 2, 0)
  })

  it('ignores no-op drops', () => {
    const onMove = vi.fn()
    const handler = makeDragEndHandler(() => ['a', 'b'], onMove)
    handler(event('a', 'a'))
    handler(event('a', null))
    expect(onMove).not.toHaveBeenCalled()
  })
})

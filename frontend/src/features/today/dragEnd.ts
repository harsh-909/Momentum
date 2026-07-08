/**
 * Pure drag-end plumbing shared by GoalList and SubtaskList. Kept free of
 * dnd-kit rendering so the reorder logic is unit-testable without simulating
 * pointer drags.
 */
import type { DragEndEvent } from '@dnd-kit/core'

export interface Move {
  from: number
  to: number
}

/** Resolve a drag end into list indices; null when nothing should move. */
export function dragEndIndices(
  ids: string[],
  activeId: string,
  overId: string | null,
): Move | null {
  if (overId == null || activeId === overId) return null
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0) return null
  return { from, to }
}

/** Build a DndContext onDragEnd handler that forwards resolved moves. */
export function makeDragEndHandler(
  getIds: () => string[],
  onMove: (from: number, to: number) => void,
): (event: DragEndEvent) => void {
  return (event) => {
    const move = dragEndIndices(
      getIds(),
      String(event.active.id),
      event.over ? String(event.over.id) : null,
    )
    if (move) onMove(move.from, move.to)
  }
}

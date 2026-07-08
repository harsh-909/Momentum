/**
 * Display-mode subtask list with drag-to-reorder within its own goal
 * (structural editing - add/remove/rename - lives in GoalEditForm).
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useAppStore } from '../../store/useAppStore'
import type { DateStr, Goal } from '../../types/domain'
import { makeDragEndHandler } from './dragEnd'
import { SubtaskRow } from './SubtaskRow'

export interface SubtaskListProps {
  date: DateStr
  goal: Goal
  readonly: boolean
}

export function SubtaskList({ date, goal, readonly }: SubtaskListProps) {
  const reorderSubtask = useAppStore((s) => s.reorderSubtask)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (goal.subtasks.length === 0) return null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={makeDragEndHandler(
        () => goal.subtasks.map((s) => s.id),
        (from, to) => reorderSubtask(date, goal.id, from, to),
      )}
    >
      <SortableContext
        items={goal.subtasks.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
        disabled={readonly}
      >
        <div className="mt-2.5 space-y-1.5">
          {goal.subtasks.map((sub) => (
            <SubtaskRow key={sub.id} date={date} goalId={goal.id} subtask={sub} readonly={readonly} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

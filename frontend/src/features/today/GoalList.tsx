/**
 * The day's goal list with drag-to-reorder (pointer with a 4px activation
 * distance so taps still toggle, plus keyboard for accessibility). Dragging
 * is disabled per-card while editing and entirely on read-only days.
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
import { isBacklogEligible } from '../../lib/engine/backlog'
import { useAppStore } from '../../store/useAppStore'
import type { DateStr, Goal } from '../../types/domain'
import { makeDragEndHandler } from './dragEnd'
import { GoalCard } from './GoalCard'

/** Bulk-select state passed down from the Today page while selecting. */
export interface GoalListSelection {
  active: boolean
  selectedIds: Set<string>
  onToggle: (goalId: string) => void
}

export interface GoalListProps {
  date: DateStr
  goals: Goal[]
  readonly: boolean
  /** Whether completion can be toggled (today/future, plus yesterday's grace). */
  checkable: boolean
  selection?: GoalListSelection
}

export function GoalList({ date, goals, readonly, checkable, selection }: GoalListProps) {
  const reorderGoal = useAppStore((s) => s.reorderGoal)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={makeDragEndHandler(
        () => goals.map((g) => g.id),
        (from, to) => reorderGoal(date, from, to),
      )}
    >
      <SortableContext
        items={goals.map((g) => g.id)}
        strategy={verticalListSortingStrategy}
        disabled={readonly}
      >
        <div className="space-y-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              date={date}
              goal={goal}
              readonly={readonly}
              checkable={checkable}
              selection={
                selection && {
                  active: selection.active,
                  selected: selection.selectedIds.has(goal.id),
                  eligible: isBacklogEligible(goal),
                  onToggle: () => selection.onToggle(goal.id),
                }
              }
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

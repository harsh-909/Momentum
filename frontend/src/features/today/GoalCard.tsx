/**
 * One goal on the day: sortable card with check toggle, badges, subtasks,
 * time logging, and a hover-revealed action rail (edit / delete). Swaps its
 * body for GoalEditForm while this goal is being edited.
 *
 * During bulk-select mode the drag grip is replaced by a selection checkbox
 * and the action rail is hidden - moving goals to the backlog now happens only
 * through selection, so the old per-row backlog button (a mis-click hazard
 * wedged between edit and delete) is gone.
 */
import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '../../components/Badge'
import { CheckToggle } from '../../components/CheckToggle'
import { confirmDialog } from '../../lib/confirm'
import { celebrate } from '../../lib/confetti'
import { fmtDuration } from '../../lib/engine/time'
import { useAppStore } from '../../store/useAppStore'
import type { DateStr, Goal } from '../../types/domain'
import { GoalEditForm } from './GoalEditForm'
import { CalendarIcon, CheckIcon, GripIcon, PencilIcon, ReturnIcon, RotateIcon, XIcon } from './icons'
import { PlannedVsActual } from './PlannedVsActual'
import { SubtaskList } from './SubtaskList'
import { TimeLogRow } from './TimeLogRow'

/** Per-goal bulk-select state, supplied by the Today page while selecting. */
export interface GoalSelection {
  active: boolean
  selected: boolean
  /** False for habit/plan instances, which can't be moved to the backlog. */
  eligible: boolean
  onToggle: () => void
}

export interface GoalCardProps {
  date: DateStr
  goal: Goal
  readonly: boolean
  /** Whether the check toggle is live (today/future, plus yesterday's grace). */
  checkable: boolean
  selection?: GoalSelection
}

export function GoalCard({ date, goal, readonly, checkable, selection }: GoalCardProps) {
  const editing = useAppStore((s) => s.ui.editingGoalId) === goal.id
  const toggleGoal = useAppStore((s) => s.toggleGoal)
  const deleteGoal = useAppStore((s) => s.deleteGoal)
  const setEditingGoal = useAppStore((s) => s.setEditingGoal)
  const logGoalTime = useAppStore((s) => s.logGoalTime)

  const checkRef = useRef<HTMLSpanElement>(null)
  const selecting = selection?.active ?? false

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: goal.id,
    disabled: readonly || editing || selecting,
  })

  const handleToggle = () => {
    const willComplete = !goal.completed
    toggleGoal(date, goal.id)
    if (willComplete && checkRef.current) celebrate(checkRef.current)
  }

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: 'Delete this goal?',
      message: `"${goal.topic}" will be removed. This can't be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (ok) deleteGoal(date, goal.id)
  }

  const doneSubs = goal.subtasks.filter((s) => s.completed).length
  const dimmed = selecting && !selection?.eligible

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`goal-card goal-enter rounded-card border bg-face p-4 ${
        selecting && selection?.selected ? 'border-accent' : 'border-line'
      } ${isDragging ? 'relative z-10 opacity-70' : ''} ${goal.completed ? 'opacity-80' : ''} ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {!readonly && !editing && selecting && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selection?.selected ?? false}
            aria-label={`Select goal ${goal.topic}`}
            disabled={!selection?.eligible}
            onClick={selection?.onToggle}
            title={selection?.eligible ? undefined : "Habits and plans can't be moved to the backlog"}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-badge border transition-colors duration-150 ease-click disabled:cursor-not-allowed ${
              selection?.selected
                ? 'border-accent-fill bg-accent-fill text-on-accent'
                : 'border-line text-transparent hover:border-muted'
            }`}
          >
            <CheckIcon className="h-3 w-3" />
          </button>
        )}

        {!readonly && !editing && !selecting && (
          <button
            type="button"
            aria-label={`Reorder goal ${goal.topic}`}
            title="Drag to reorder"
            {...attributes}
            {...listeners}
            className="hit-halo mt-1 shrink-0 cursor-grab touch-none text-muted/60 transition-colors duration-150 ease-click hover:text-ink"
          >
            <GripIcon className="h-4 w-4" />
          </button>
        )}

        <span ref={checkRef} className="mt-0.5 shrink-0">
          <CheckToggle
            checked={goal.completed}
            disabled={!checkable || selecting}
            label={goal.topic}
            onChange={handleToggle}
          />
        </span>

        {editing ? (
          <GoalEditForm date={date} goal={goal} />
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`whitespace-pre-wrap break-words font-medium text-ink ${
                  goal.completed ? 'line-through opacity-70' : ''
                }`}
              >
                {goal.topic}
              </span>
              <Badge>
                <span className="font-mono-num">{fmtDuration(goal.hours)}</span> planned
              </Badge>
              {goal.recurringId && (
                <Badge variant="good">
                  <RotateIcon className="h-3 w-3" />
                  habit
                </Badge>
              )}
              {goal.planId && (
                <Badge>
                  <CalendarIcon className="h-3 w-3" />
                  plan
                </Badge>
              )}
              {goal.carried && (
                <Badge variant="accent">
                  <ReturnIcon className="h-3 w-3" />
                  carried
                </Badge>
              )}
              {goal.subtasks.length > 0 && (
                <span className="font-mono-num text-xs text-muted">
                  {doneSubs}/{goal.subtasks.length}
                </span>
              )}
            </div>

            <SubtaskList date={date} goal={goal} readonly={readonly} checkable={checkable} />

            {goal.completed && (
              <div className="mt-2.5 space-y-1">
                {goal.subtasks.length === 0 && !readonly && (
                  <TimeLogRow
                    label="Time actually spent"
                    valueHours={goal.loggedHours ?? goal.hours}
                    onLog={(h, m) => logGoalTime(date, goal.id, h, m)}
                  />
                )}
                <PlannedVsActual goal={goal} />
              </div>
            )}
          </div>
        )}

        {!readonly && !editing && !selecting && (
          <div className="goal-actions flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              title="Edit goal"
              aria-label={`Edit goal ${goal.topic}`}
              onClick={() => setEditingGoal(goal.id)}
              className="hit-halo flex h-7 w-7 items-center justify-center rounded-btn text-muted transition-colors duration-150 ease-click hover:text-ink"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Delete"
              aria-label={`Delete goal ${goal.topic}`}
              onClick={handleDelete}
              className="hit-halo flex h-7 w-7 items-center justify-center rounded-btn text-muted transition-colors duration-150 ease-click hover:text-alert"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

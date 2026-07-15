/**
 * One subtask in display mode: sortable drag handle, check toggle, text, and
 * (once completed) a compact "took" time-log row that rolls up to the goal.
 * Read-only days: the toggle is disabled and no time input renders. Yesterday
 * is the exception - its toggle stays live (check-off grace) but, being
 * read-only, still shows no time input.
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckToggle } from '../../components/CheckToggle'
import { useAppStore } from '../../store/useAppStore'
import type { DateStr, Subtask } from '../../types/domain'
import { GripIcon } from './icons'
import { TimeLogRow } from './TimeLogRow'

export interface SubtaskRowProps {
  date: DateStr
  goalId: string
  subtask: Subtask
  readonly: boolean
  /** Whether the check toggle is live (today/future, plus yesterday's grace). */
  checkable: boolean
}

export function SubtaskRow({ date, goalId, subtask, readonly, checkable }: SubtaskRowProps) {
  const toggleSubtask = useAppStore((s) => s.toggleSubtask)
  const logSubtaskTime = useAppStore((s) => s.logSubtaskTime)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
    disabled: readonly,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-70' : ''}
    >
      <div className="flex items-start gap-2">
        {!readonly && (
          <button
            type="button"
            aria-label={`Reorder subtask ${subtask.text}`}
            {...attributes}
            {...listeners}
            className="hit-halo mt-0.5 shrink-0 cursor-grab touch-none text-muted/60 transition-colors duration-150 ease-click hover:text-ink"
          >
            <GripIcon className="h-3.5 w-3.5" />
          </button>
        )}
        <CheckToggle
          checked={subtask.completed}
          disabled={!checkable}
          label={subtask.text || 'subtask'}
          onChange={() => toggleSubtask(date, goalId, subtask.id)}
          className="h-[18px]! w-[18px]!"
        />
        <span
          className={`min-w-0 whitespace-pre-wrap break-words text-sm ${
            subtask.completed ? 'text-muted line-through opacity-60' : 'text-muted'
          }`}
        >
          {subtask.text}
        </span>
      </div>

      {subtask.completed && !readonly && (
        <div className="ml-11 mt-1">
          <TimeLogRow
            label="took"
            inputLabel={`took ${subtask.text}`.trim()}
            valueHours={subtask.loggedHours || 0}
            onLog={(h, m) => logSubtaskTime(date, goalId, subtask.id, h, m)}
          />
        </div>
      )}
    </div>
  )
}

/**
 * One habit template: schedule, per-day time, template subtasks, start date.
 * Deleting stops future seeding only - past instances keep their record.
 */
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { formatDisplayDate } from '../../lib/engine/dates'
import { confirmDialog } from '../../lib/confirm'
import { scheduleLabel } from '../../lib/engine/habits'
import { fmtDuration } from '../../lib/engine/time'
import { PencilIcon, XIcon } from '../today/icons'
import type { DateStr, HabitTemplate } from '../../types/domain'

export interface HabitCardProps {
  habit: HabitTemplate
  today: DateStr
  onEdit: (habit: HabitTemplate) => void
  onDelete: (habitId: string) => void
}

function RotateIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.8 5.2A5.4 5.4 0 0 0 3.2 6.4" />
      <path d="M12.8 2.4v2.8h-2.8" />
      <path d="M3.2 10.8a5.4 5.4 0 0 0 9.6-1.2" />
      <path d="M3.2 13.6v-2.8H6" />
    </svg>
  )
}

export function HabitCard({ habit, today, onEdit, onDelete }: HabitCardProps) {
  return (
    <Card className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted">
        <RotateIcon />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{habit.topic}</span>
          <Badge>
            <span className="font-mono-num">{fmtDuration(habit.hours)}</span>/day
          </Badge>
          <span className="font-display text-xs label-caps text-accent-text">
            {scheduleLabel(habit.days as number[])}
          </span>
        </div>
        {habit.subtasks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {habit.subtasks.map((sub, i) => (
              <span
                key={`${sub.text}-${i}`}
                className="rounded-badge border border-line px-1.5 py-0.5 text-xs text-muted"
              >
                {sub.text}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1.5 text-xs font-mono-num text-muted">
          Since {formatDisplayDate(habit.startDate, today)}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={`Edit habit "${habit.topic}"`}
          onClick={() => onEdit(habit)}
          className="hit-halo flex h-7 w-7 items-center justify-center rounded-btn text-muted transition-colors duration-150 ease-click hover:text-ink"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Delete habit "${habit.topic}"`}
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Stop this habit?',
              message: `"${habit.topic}" won't be scheduled going forward. Days already logged keep their record.`,
              confirmLabel: 'Stop habit',
              tone: 'danger',
            })
            if (ok) onDelete(habit.id)
          }}
          className="hit-halo flex h-7 w-7 items-center justify-center rounded-btn text-muted transition-colors duration-150 ease-click hover:text-alert"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  )
}

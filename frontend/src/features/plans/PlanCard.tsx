/**
 * One plan template: schedule, per-occurrence time, template subtasks, start
 * date. Mirrors HabitCard. Deleting stops future seeding only - already-placed
 * instances and surfaced backlog items keep their record.
 */
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { formatDisplayDate } from '../../lib/engine/dates'
import { recurrenceLabel } from '../../lib/engine/recurrence'
import { fmtDuration } from '../../lib/engine/time'
import type { PlanDraft } from '../../store/types'
import { CalendarIcon, PencilIcon, XIcon } from '../today/icons'
import type { DateStr, PlanTemplate } from '../../types/domain'

export interface PlanCardProps {
  plan: PlanTemplate
  today: DateStr
  onEdit: (draft: PlanDraft) => void
  onDelete: (id: string) => void
}

/** Editing draft from a stored plan template. */
export function draftFrom(plan: PlanTemplate): PlanDraft {
  return {
    id: plan.id,
    topic: plan.topic,
    hours: plan.hours,
    subtaskLines: plan.subtasks.map((s) => s.text).join('\n'),
    recurrence: plan.recurrence,
  }
}

export function PlanCard({ plan, today, onEdit, onDelete }: PlanCardProps) {
  return (
    <Card className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted">
        <CalendarIcon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{plan.topic}</span>
          <Badge>
            <span className="font-mono-num">{fmtDuration(plan.hours)}</span>
          </Badge>
          <span className="font-display text-xs label-caps text-accent-text">
            {recurrenceLabel(plan.recurrence)}
          </span>
        </div>
        {plan.subtasks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.subtasks.map((sub, i) => (
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
          Since {formatDisplayDate(plan.startDate, today)}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={`Edit plan "${plan.topic}"`}
          onClick={() => onEdit(draftFrom(plan))}
          className="hit-halo flex h-7 w-7 items-center justify-center rounded-btn text-muted transition-colors duration-150 ease-click hover:text-ink"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Delete plan "${plan.topic}"`}
          onClick={() => {
            if (confirm('Stop this plan? Occurrences already placed keep their record.')) {
              onDelete(plan.id)
            }
          }}
          className="hit-halo flex h-7 w-7 items-center justify-center rounded-btn text-muted transition-colors duration-150 ease-click hover:text-alert"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  )
}

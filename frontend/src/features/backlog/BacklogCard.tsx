/**
 * One backlog item: topic + planned time + age, with reschedule ("-> Today"
 * or a picked date) and remove actions. Index-addressed like v1 - backlog
 * actions on the store take the item's position, not its id.
 */
import { useState } from 'react'
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { ageLabel, formatDisplayDate } from '../../lib/engine/dates'
import { fmtDuration } from '../../lib/engine/time'
import { XIcon } from '../today/icons'
import { useAppStore } from '../../store/useAppStore'
import type { DateStr, Goal } from '../../types/domain'

export interface BacklogCardProps {
  item: Goal
  index: number
  today: DateStr
}

const DATE_CLS =
  'rounded-btn border border-line bg-dial px-1.5 py-1 text-xs font-mono-num text-muted transition-colors duration-150 ease-click focus:border-accent focus:outline-none'

export function BacklogCard({ item, index, today }: BacklogCardProps) {
  const scheduleFromBacklog = useAppStore((s) => s.scheduleFromBacklog)
  const deleteBacklogItem = useAppStore((s) => s.deleteBacklogItem)
  const [picked, setPicked] = useState(today)

  return (
    <Card className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{item.topic}</span>
          <Badge>
            <span className="font-mono-num">{fmtDuration(item.hours)}</span>
          </Badge>
          <span className="text-xs font-mono-num text-accent-text">
            {ageLabel(item.backlognedAt ?? item.originalDate ?? '', today)}
          </span>
        </div>
        {item.originalDate && (
          <div className="mt-1 text-xs text-muted">
            Originally: {formatDisplayDate(item.originalDate, today)}
          </div>
        )}
        {item.subtasks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.subtasks.map((sub) => (
              <span
                key={sub.id}
                className={`rounded-badge border border-line px-1.5 py-0.5 text-xs ${
                  sub.completed ? 'text-good-text line-through' : 'text-muted'
                }`}
              >
                {sub.text}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => scheduleFromBacklog(index, today)}
          className="whitespace-nowrap rounded-btn bg-accent-fill px-3 py-1.5 text-xs font-semibold text-on-accent transition-opacity duration-150 ease-click hover:opacity-90"
        >
          &rarr; Today
        </button>
        <div className="flex items-center gap-1">
          <input
            type="date"
            min={today}
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            aria-label={`Schedule "${item.topic}" on date`}
            className={DATE_CLS}
          />
          <button
            type="button"
            onClick={() => picked && scheduleFromBacklog(index, picked)}
            className="rounded-btn px-1.5 py-1 text-xs font-medium text-muted transition-colors duration-150 ease-click hover:text-ink"
          >
            Go
          </button>
        </div>
        <button
          type="button"
          aria-label={`Remove "${item.topic}" from backlog`}
          onClick={() => {
            if (confirm('Remove this from the backlog? This cannot be undone.')) {
              deleteBacklogItem(index)
            }
          }}
          className="inline-flex items-center gap-1 rounded-btn px-1.5 py-0.5 text-xs text-muted transition-colors duration-150 ease-click hover:text-alert"
        >
          <XIcon className="h-3 w-3" />
          Remove
        </button>
      </div>
    </Card>
  )
}

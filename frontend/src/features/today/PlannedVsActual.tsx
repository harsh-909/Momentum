/**
 * Planned vs actual roll-up line, shown once a goal is completed. Actual is
 * green at/under plan, amber over it; until time is logged an italic hint
 * nudges the user (per-subtask for goals with subtasks).
 */
import { fmtDuration } from '../../lib/engine/time'
import type { Goal } from '../../types/domain'

export function PlannedVsActual({ goal }: { goal: Goal }) {
  if (!goal.completed) return null
  const hasSubtasks = goal.subtasks.length > 0
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span>Planned</span>
      <span className="font-mono-num text-ink">{fmtDuration(goal.hours)}</span>
      {goal.loggedHours != null ? (
        <>
          <span>→ Actual</span>
          <span
            className={`font-mono-num ${goal.loggedHours <= goal.hours ? 'text-good-text' : 'text-warn-text'}`}
          >
            {fmtDuration(goal.loggedHours)}
          </span>
        </>
      ) : (
        <span className="italic opacity-80">
          {hasSubtasks
            ? '→ log time on each subtask to total the actual'
            : '→ log what it actually took'}
        </span>
      )}
    </div>
  )
}

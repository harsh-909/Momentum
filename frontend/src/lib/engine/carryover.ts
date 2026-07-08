/**
 * Automatic carry-over of unfinished past work (ported from legacy/app.js
 * autoCarryPastDays / carryCopy).
 *
 * On load / day-rollover we sweep every past day not yet swept (dates after
 * the `carriedThrough` watermark and before today) and copy the unfinished
 * remainder of each non-habit goal into the backlog. The source goal stays
 * in place - only flagged `carried` - so the day's true score is preserved;
 * the backlog copy is a fresh, independent item, so finishing it never
 * rewrites history.
 *
 * Two layers keep a task from being carried twice: the watermark skips whole
 * days already processed, and the per-goal `carried` flag guards individual
 * goals (e.g. after importing older data).
 */
import { uid } from '../id'
import { isReadonly, shiftDateStr } from './dates'
import type { DateStr, Goal, Snapshot } from '../../types/domain'

/**
 * Build an independent backlog copy of a goal's unfinished remainder: the
 * goal heading plus only its incomplete subtasks, all with fresh ids.
 * Returns null when there is nothing left to carry (a completed goal, or one
 * left unchecked but whose every subtask is done). `backlognedAt` is stamped
 * by the sweep (it knows "today"); the copy itself is date-agnostic.
 */
export function carryCopy(g: Goal, date: DateStr): Goal | null {
  if (g.completed) return null
  const subs = g.subtasks || []
  const pending = subs.filter((s) => !s.completed)
  if (subs.length && pending.length === 0) return null
  return {
    id: uid(),
    topic: g.topic,
    hours: g.hours || 1,
    loggedHours: null,
    completed: false,
    subtasks: pending.map((s) => ({ id: uid(), text: s.text, completed: false, loggedHours: null })),
    createdAt: date,
    originalDate: g.createdAt || date,
  }
}

/**
 * Sweep all past days after the watermark: unshift a carryCopy of each
 * incomplete, non-habit, not-yet-carried goal onto the backlog and flag the
 * source `carried` (even when the copy is null - nothing pending). Then
 * advance the watermark to yesterday (never rewinding), so a second run the
 * same day is a no-op. Today itself is never swept.
 */
export function sweepPastDays(data: Snapshot, today: DateStr): void {
  const from = data.carriedThrough || '' // exclusive lower bound; '' = sweep all history
  for (const date of Object.keys(data.goals)) {
    if (!isReadonly(date, today)) continue // today/future: not carried
    if (from && date <= from) continue // already swept in a prior run
    for (const g of data.goals[date] || []) {
      if (g.recurringId) continue // habits are never carried
      if (g.completed || g.carried) continue // done, or already carried
      const copy = carryCopy(g, date)
      if (copy) {
        copy.backlognedAt = today
        data.backlog.unshift(copy)
      }
      g.carried = true // freeze: never carry this again
    }
  }
  const yesterday = shiftDateStr(today, -1)
  if (yesterday && (!data.carriedThrough || yesterday > data.carriedThrough)) {
    data.carriedThrough = yesterday
  }
}

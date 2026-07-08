/**
 * Backlog moves (ported from legacy/app.js "Backlog").
 */
import { isReadonly } from './dates'
import type { DateStr, Snapshot } from '../../types/domain'

/**
 * Manually defer a goal to the backlog. Refused for read-only past days
 * (those are carried automatically) and for habit instances - habits are
 * day-bound and never transferable; a missed habit just stays unfinished.
 * The goal object itself moves (not a copy), stamped with where it came
 * from (originalDate) and when it entered the backlog (backlognedAt).
 * Newest first: unshift. Returns true when the move happened.
 */
export function moveToBacklog(data: Snapshot, date: DateStr, goalId: string, today: DateStr): boolean {
  if (isReadonly(date, today)) return false
  const list = data.goals[date] || []
  const i = list.findIndex((g) => g.id === goalId)
  if (i === -1) return false
  const goal = list[i]
  if (goal.recurringId) return false
  list.splice(i, 1)
  goal.originalDate = goal.createdAt || date
  goal.backlognedAt = today
  data.backlog.unshift(goal)
  return true
}

/**
 * Move a backlog item onto a day's goal list. Refuses past target dates
 * (the engine-level guard the v1 UI enforced by only offering today/future).
 * The item keeps its originalDate/backlognedAt provenance (v1 behavior);
 * createdAt is re-stamped to the scheduled day.
 */
export function scheduleFromBacklog(data: Snapshot, index: number, date: DateStr, today: DateStr): void {
  if (!date || isReadonly(date, today)) return
  const item = data.backlog.splice(index, 1)[0]
  if (!item) return
  item.createdAt = date
  if (!data.goals[date]) data.goals[date] = []
  data.goals[date].push(item)
}

/** Delete a backlog item outright. */
export function deleteBacklogItem(data: Snapshot, index: number): void {
  data.backlog.splice(index, 1)
}

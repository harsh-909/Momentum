/**
 * Backlog moves (ported from legacy/app.js "Backlog").
 */
import { isReadonly } from './dates'
import type { DateStr, Goal, Snapshot } from '../../types/domain'

/**
 * Whether a day goal can be manually moved to the backlog. Habit and plan
 * instances are day-bound, so they never are.
 */
export function isBacklogEligible(goal: Goal): boolean {
  return !goal.recurringId && !goal.planId
}

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
 * Move several goals to the backlog in one pass, so a batch is a single save.
 * Skips ineligible goals (habits, plans) and read-only days. Returns the ids
 * actually moved - the caller uses them to offer a matching Undo.
 */
export function bulkMoveToBacklog(
  data: Snapshot,
  date: DateStr,
  goalIds: string[],
  today: DateStr,
): string[] {
  if (isReadonly(date, today)) return []
  const moved: string[] = []
  for (const id of goalIds) {
    const goal = (data.goals[date] || []).find((g) => g.id === id)
    if (!goal || !isBacklogEligible(goal)) continue
    if (moveToBacklog(data, date, id, today)) moved.push(id)
  }
  return moved
}

/**
 * Undo a backlog move: pull the given goals back out of the backlog (by id)
 * and re-add them to the day, clearing the "in backlog" stamp. Best-effort
 * restore used by the Undo affordance right after a bulk move; positions are
 * appended rather than exactly reinstated.
 */
export function restoreToDay(data: Snapshot, date: DateStr, goalIds: string[], today: DateStr): void {
  if (isReadonly(date, today)) return
  if (!data.goals[date]) data.goals[date] = []
  for (const id of goalIds) {
    const i = data.backlog.findIndex((g) => g.id === id)
    if (i === -1) continue
    const goal = data.backlog.splice(i, 1)[0]
    goal.backlognedAt = undefined
    data.goals[date].push(goal)
  }
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

/**
 * Goal + subtask mutators (ported from legacy/app.js "Goals" / "Inline goal
 * editing" / drag-to-reorder).
 *
 * Every mutator takes (data, date, ..., today), mutates the Snapshot in
 * place (callers run them inside immer drafts) and MUST no-op when the date
 * is a read-only past day.
 */
import { uid } from '../id'
import { isCheckable, isReadonly } from './dates'
import { clampHours, hmToHours } from './time'
import type { DateStr, Goal, Snapshot, Subtask } from '../../types/domain'
import type { NewGoalInput } from '../../store/types'

function findGoal(data: Snapshot, date: DateStr, goalId: string): Goal | undefined {
  return (data.goals[date] || []).find((g) => g.id === goalId)
}

/**
 * Tidy multi-line text on save: trim trailing whitespace per line and drop
 * blank lines. Run on Done, never while typing.
 */
export function cleanText(s: string): string {
  return (s || '')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
    .join('\n')
}

/**
 * For a goal WITH subtasks, its actual time is the sum of the COMPLETED
 * subtasks' logged time, kept in goal.loggedHours (null when the sum is 0 so
 * readers still fall back to planned hours). No-op for subtask-less goals -
 * their loggedHours is set manually by logGoalTime.
 */
export function recomputeGoalLogged(g: Goal): void {
  if (!g.subtasks || !g.subtasks.length) return
  const sum = g.subtasks.reduce((s, st) => s + (st.completed ? Number(st.loggedHours) || 0 : 0), 0)
  g.loggedHours = sum > 0 ? +sum.toFixed(4) : null
}

/** Create a goal on a day from the add-goal form input. Refuses an empty topic. */
export function addGoal(data: Snapshot, date: DateStr, input: NewGoalInput, today: DateStr): void {
  if (isReadonly(date, today)) return
  const topic = input.topic.trim()
  if (!topic) return
  const subtasks: Subtask[] = input.subtaskLines
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ id: uid(), text, completed: false, loggedHours: null }))
  const goal: Goal = {
    id: uid(),
    topic,
    hours: clampHours(input.hours) || 1, // v1 semantics: empty/zero time defaults to 1h
    loggedHours: null,
    completed: false,
    subtasks,
    createdAt: date,
  }
  if (!data.goals[date]) data.goals[date] = []
  data.goals[date].push(goal)
}

/**
 * Flip a goal's completion. Completing it marks ALL subtasks complete.
 * Returns true iff the goal just became completed (confetti trigger).
 */
export function toggleGoal(data: Snapshot, date: DateStr, goalId: string, today: DateStr): boolean {
  // Check-off is allowed on today/future AND yesterday (the grace window);
  // every other mutator below stays hard-gated on isReadonly.
  if (!isCheckable(date, today)) return false
  const g = findGoal(data, date, goalId)
  if (!g) return false
  // Yesterday's grace window is check-off ONLY: a forgotten tick can still
  // land, but an already-done goal cannot be UN-completed - that would rewrite
  // a finished day's record (lowering its score / breaking a streak). On a
  // past-but-checkable day, allow the undone -> done transition and nothing else.
  if (isReadonly(date, today) && g.completed) return false
  g.completed = !g.completed
  if (g.completed) {
    g.subtasks.forEach((s) => {
      s.completed = true
    })
  }
  recomputeGoalLogged(g)
  return g.completed
}

/**
 * Flip one subtask; the parent's completion is recomputed as "every subtask
 * done" (so unchecking a subtask re-opens the parent).
 */
export function toggleSubtask(
  data: Snapshot,
  date: DateStr,
  goalId: string,
  subtaskId: string,
  today: DateStr,
): void {
  // Subtask check-off shares the goal check-off grace window (yesterday too),
  // and the same one-way rule: on a past-but-checkable day you can complete a
  // forgotten subtask, but not un-check a done one (which would re-open the
  // parent and rewrite that day's score).
  if (!isCheckable(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  const st = g.subtasks.find((s) => s.id === subtaskId)
  if (!st) return
  if (isReadonly(date, today) && st.completed) return
  st.completed = !st.completed
  g.completed = g.subtasks.length > 0 && g.subtasks.every((s) => s.completed)
  recomputeGoalLogged(g)
}

/** Live edit-mode write; cleanup happens in finishEditGoal. */
export function setGoalTopic(data: Snapshot, date: DateStr, goalId: string, topic: string, today: DateStr): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  g.topic = topic
}

/** Live edit-mode write of planned time (already decimal hours). */
export function setGoalHours(data: Snapshot, date: DateStr, goalId: string, hours: number, today: DateStr): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  g.hours = hours
}

/** Live edit-mode write; empty subtasks are dropped in finishEditGoal. */
export function setSubtaskText(
  data: Snapshot,
  date: DateStr,
  goalId: string,
  subtaskId: string,
  text: string,
  today: DateStr,
): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  const st = g.subtasks.find((s) => s.id === subtaskId)
  if (!st) return
  st.text = text
}

/**
 * Append an empty subtask (edit mode only); a fresh incomplete subtask means
 * the goal isn't done. Returns the new subtask id (to focus) or null.
 */
export function addEditSubtask(data: Snapshot, date: DateStr, goalId: string, today: DateStr): string | null {
  if (isReadonly(date, today)) return null
  const g = findGoal(data, date, goalId)
  if (!g) return null
  const sub: Subtask = { id: uid(), text: '', completed: false, loggedHours: null }
  g.subtasks.push(sub)
  g.completed = false
  return sub.id
}

/**
 * Remove a subtask. Completion is recomputed ONLY from remaining subtasks -
 * an emptied list must never flip the goal complete. The rolled-up actual
 * time is recomputed since the dropped subtask may have contributed.
 */
export function removeSubtask(
  data: Snapshot,
  date: DateStr,
  goalId: string,
  subtaskId: string,
  today: DateStr,
): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  const i = g.subtasks.findIndex((s) => s.id === subtaskId)
  if (i === -1) return
  g.subtasks.splice(i, 1)
  if (g.subtasks.length > 0) g.completed = g.subtasks.every((s) => s.completed)
  recomputeGoalLogged(g)
}

/**
 * Leave edit mode (legacy stopEditGoal): clean the title, guard the hours
 * field, clean each subtask's text and drop the ones that ended up empty,
 * then recompute completion from what remains (if any) and the rolled-up
 * logged time (a dropped subtask may have carried logged time).
 */
export function finishEditGoal(data: Snapshot, date: DateStr, goalId: string, today: DateStr): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  g.topic = cleanText(g.topic)
  g.hours = clampHours(g.hours)
  g.subtasks.forEach((s) => {
    s.text = cleanText(s.text)
  })
  g.subtasks = g.subtasks.filter((s) => s.text !== '')
  if (g.subtasks.length > 0) g.completed = g.subtasks.every((s) => s.completed)
  recomputeGoalLogged(g)
}

/**
 * Log actual time on a goal WITHOUT subtasks (legacy logHM). Goals with
 * subtasks roll up via logSubtaskTime/recomputeGoalLogged instead.
 */
export function logGoalTime(
  data: Snapshot,
  date: DateStr,
  goalId: string,
  h: number,
  m: number,
  today: DateStr,
): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  g.loggedHours = hmToHours(h, m)
}

/** Log actual time for a single subtask, then roll it up to the goal. */
export function logSubtaskTime(
  data: Snapshot,
  date: DateStr,
  goalId: string,
  subtaskId: string,
  h: number,
  m: number,
  today: DateStr,
): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  const st = g.subtasks.find((s) => s.id === subtaskId)
  if (!st) return
  st.loggedHours = hmToHours(h, m)
  recomputeGoalLogged(g)
}

/** Reorder goals within a day (order is just array order). */
export function reorderGoal(data: Snapshot, date: DateStr, from: number, to: number, today: DateStr): void {
  if (isReadonly(date, today)) return
  if (from == null || to == null || from === to) return
  const list = data.goals[date]
  if (!list || from < 0 || to < 0 || from >= list.length || to >= list.length) return
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item)
}

/** Reorder subtasks within one goal. */
export function reorderSubtask(
  data: Snapshot,
  date: DateStr,
  goalId: string,
  from: number,
  to: number,
  today: DateStr,
): void {
  if (isReadonly(date, today)) return
  const g = findGoal(data, date, goalId)
  if (!g) return
  if (from == null || to == null || from === to) return
  const subs = g.subtasks
  if (!subs || from < 0 || to < 0 || from >= subs.length || to >= subs.length) return
  const [item] = subs.splice(from, 1)
  subs.splice(to, 0, item)
}

/** Delete a goal from a day. */
export function deleteGoal(data: Snapshot, date: DateStr, goalId: string, today: DateStr): void {
  if (isReadonly(date, today)) return
  const list = data.goals[date]
  if (!list) return
  const i = list.findIndex((g) => g.id === goalId)
  if (i === -1) return
  list.splice(i, 1)
}

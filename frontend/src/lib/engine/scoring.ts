/**
 * Partial-credit scoring (ported from legacy/app.js "Scoring" + "Day stats").
 */
import type { DayStats, Goal } from '../../types/domain'

/**
 * Fraction of a goal that's done, 0..1. A goal with subtasks earns partial
 * credit per finished subtask; a goal without subtasks is all-or-nothing.
 */
export function goalProgress(g: Goal): number {
  if (g.completed) return 1
  const subs = g.subtasks || []
  if (subs.length) return subs.filter((s) => s.completed).length / subs.length
  return 0
}

/**
 * Whole-day progress as a rounded percent, averaging per-goal progress.
 * Reports 100 ONLY when every goal is truly complete - otherwise capped at
 * 99 so rounding can never fake a perfect day. Empty day -> 0.
 */
export function dayProgressPct(goals: Goal[]): number {
  if (!goals.length) return 0
  if (goals.every((g) => g.completed)) return 100
  const avg = goals.reduce((s, g) => s + goalProgress(g), 0) / goals.length
  return Math.min(99, Math.round(avg * 100))
}

/**
 * Actual time a goal has earned so far. Logged time (whole-goal, or rolled up
 * from completed subtasks) counts even while the goal is only partially done;
 * the planned-hours fallback applies only once the goal is fully complete, so
 * an untouched goal never counts its plan as done time.
 */
export function goalDoneHours(g: Goal): number {
  const logged = g.loggedHours
  if (logged != null && Number.isFinite(Number(logged))) return Number(logged)
  return g.completed ? Number(g.hours) || 0 : 0
}

/** History summary hours: logged when present, planned otherwise. */
export function historyGoalHours(g: Goal): number {
  return Number(g.loggedHours ?? g.hours) || 0
}

/** Aggregates for the day summary dial (legacy dayStats). */
export function computeDayStats(goals: Goal[]): DayStats {
  const completed = goals.filter((g) => g.completed).length
  const total = goals.length
  const hours = goals.reduce((s, g) => s + (Number(g.hours) || 0), 0)
  const doneHours = goals.reduce((s, g) => s + goalDoneHours(g), 0)
  const pct = dayProgressPct(goals)
  return { completed, total, hours: +hours.toFixed(2), doneHours: +doneHours.toFixed(2), pct }
}

/**
 * Rolling-window metrics (ported from legacy/app.js "Metrics" + the chart
 * data preparation in renderCharts). Pure data - no Chart.js here.
 */
import { STREAK_THRESHOLD } from '../../types/domain'
import type { DateStr, Goal, Metrics, Snapshot } from '../../types/domain'
import { parseLocalDate, shiftDateStr } from './dates'
import { dayProgressPct, goalDoneHours, isPlanInstance } from './scoring'

/** The last 7 dates ending at (and including) today, oldest first. */
export function getLast7Days(data: Snapshot, today: DateStr): { date: DateStr; goals: Goal[] }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDateStr(today, -(6 - i))
    return { date, goals: data.goals[date] || [] }
  })
}

/**
 * Four 7-day blocks ending today, oldest (W1) first. Each week's goals are
 * flattened; the label carries the week number and its first day, matching
 * the v1 chart labels ("W1 · Jun 6").
 */
export function getLast4Weeks(data: Snapshot, today: DateStr): { label: string; goals: Goal[] }[] {
  const weeks: { label: string; goals: Goal[] }[] = []
  for (let w = 3; w >= 0; w--) {
    const dates = Array.from({ length: 7 }, (_, i) => shiftDateStr(today, -(w * 7) - (6 - i)))
    const label =
      'W' +
      (4 - w) +
      ' · ' +
      parseLocalDate(dates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    weeks.push({ label, goals: dates.flatMap((d) => data.goals[d] || []) })
  }
  return weeks
}

/**
 * Summary cards. The streak walks back from today (within the 7-day window)
 * while each day's partial-credit progress clears STREAK_THRESHOLD (70%);
 * a day with NO scored goals breaks the chain immediately - including today.
 * Plan instances never count, so a plan-only day reads as empty (breaks).
 * avgWeek averages only the days that have scored goals.
 */
export function computeMetrics(data: Snapshot, today: DateStr): Metrics {
  const days = getLast7Days(data, today)
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const gs = days[i].goals.filter((g) => !isPlanInstance(g))
    if (gs.length === 0) break
    if (dayProgressPct(gs) >= STREAK_THRESHOLD) streak++
    else break
  }
  const activePcts = days
    .filter((d) => d.goals.some((g) => !isPlanInstance(g)))
    .map((d) => dayProgressPct(d.goals))
  const avgWeek = activePcts.length
    ? Math.round(activePcts.reduce((a, b) => a + b, 0) / activePcts.length)
    : 0
  const totalHours = days.reduce(
    (s, d) => s + d.goals.reduce((ss, g) => ss + (isPlanInstance(g) ? 0 : goalDoneHours(g)), 0),
    0,
  )
  const totalGoals = days.reduce((s, d) => s + d.goals.filter((g) => !isPlanInstance(g)).length, 0)
  return { streak, avgWeek, totalHours: +totalHours.toFixed(1), totalGoals }
}

/** Per-day label like "Fri 3" (weekday short + day number), matching v1 charts. */
function dayLabel(date: DateStr): string {
  return parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
}

/** Daily chart data: completed vs planned goal counts over the last 7 days. */
export function dailySeries(data: Snapshot, today: DateStr): { label: string; completed: number; total: number }[] {
  return getLast7Days(data, today).map(({ date, goals }) => ({
    label: dayLabel(date),
    completed: goals.filter((g) => g.completed && !isPlanInstance(g)).length,
    total: goals.filter((g) => !isPlanInstance(g)).length,
  }))
}

/** Weekly chart data: partial-credit completion percent per week block. */
export function weeklySeries(data: Snapshot, today: DateStr): { label: string; pct: number }[] {
  return getLast4Weeks(data, today).map(({ label, goals }) => ({ label, pct: dayProgressPct(goals) }))
}

/** Hours chart data: logged (partial-credit-aware) hours per day, last 7 days. */
export function hoursSeries(data: Snapshot, today: DateStr): { label: string; hours: number }[] {
  return getLast7Days(data, today).map(({ date, goals }) => ({
    label: dayLabel(date),
    hours: goals.reduce((s, g) => s + (isPlanInstance(g) ? 0 : goalDoneHours(g)), 0),
  }))
}

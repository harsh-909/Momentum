/**
 * Recurring habits (ported from legacy/app.js "Recurring habits" + habit form).
 *
 * Habits are templates materialized into each day's goal list on demand. We
 * only ever seed the CURRENT day (never the past, never future days on mere
 * navigation), and only on weekdays in the habit's schedule. seeded[date]
 * remembers what was placed per date so a deleted instance never reappears.
 */
import { uid } from '../id'
import { parseLocalDate } from './dates'
import { clampHours } from './time'
import type { DateStr, Goal, HabitTemplate, Snapshot, Weekday } from '../../types/domain'
import type { HabitDraft } from '../../store/types'

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Materialize a template into a day's goal (fresh ids, recurringId back-ref). */
export function instantiateHabit(tpl: HabitTemplate, date: DateStr): Goal {
  return {
    id: uid(),
    topic: tpl.topic,
    hours: tpl.hours || 0.5,
    loggedHours: null,
    completed: false,
    subtasks: (tpl.subtasks || []).map((s) => ({ id: uid(), text: s.text, completed: false, loggedHours: null })),
    createdAt: date,
    recurringId: tpl.id,
  }
}

/**
 * Seed today's habit instances. For each template: skip if today precedes
 * its startDate, if today's weekday isn't scheduled, or if it was already
 * seeded today (covers deleted instances); otherwise instantiate (unless an
 * instance somehow exists) and record the placement in seeded[today].
 * Only ever touches the `today` date - callers must pass the logical today.
 */
export function ensureRecurring(data: Snapshot, today: DateStr): void {
  if (!today) return
  const dow = parseLocalDate(today).getDay()
  if (!data.seeded[today]) data.seeded[today] = []
  for (const r of data.recurring) {
    if (today < (r.startDate || today)) continue
    if (!((r.days as number[]) || ALL_DAYS).includes(dow)) continue // not scheduled this weekday
    if (data.seeded[today].includes(r.id)) continue
    const exists = (data.goals[today] || []).some((g) => g.recurringId === r.id)
    if (!exists) {
      if (!data.goals[today]) data.goals[today] = []
      data.goals[today].push(instantiateHabit(r, today))
    }
    data.seeded[today].push(r.id)
  }
}

/**
 * Reflect a template edit onto today's instance so customization takes
 * effect now (legacy syncHabitToToday):
 * - no instance today -> seed one if scheduled and not previously seeded
 *   (a deleted instance stays deleted).
 * - completed instance -> never rewritten.
 * - no longer scheduled today and untouched (no subtask done) -> pull the
 *   instance back out and un-seed it.
 * - otherwise update topic/hours; replace subtasks only while untouched.
 */
export function syncHabitToToday(data: Snapshot, tpl: HabitTemplate, today: DateStr): void {
  const dow = parseLocalDate(today).getDay()
  const scheduledToday = (tpl.days as number[]).includes(dow)
  const list = data.goals[today] || []
  const inst = list.find((g) => g.recurringId === tpl.id)
  if (!inst) {
    // Seed (ensureRecurring semantics, scoped to this template).
    if (!scheduledToday) return
    if (today < (tpl.startDate || today)) return
    if ((data.seeded[today] || []).includes(tpl.id)) return // deleted today: stays deleted
    if (!data.goals[today]) data.goals[today] = []
    data.goals[today].push(instantiateHabit(tpl, today))
    if (!data.seeded[today]) data.seeded[today] = []
    data.seeded[today].push(tpl.id)
    return
  }
  if (inst.completed) return // never rewrite a completed instance
  const touched = inst.subtasks.some((s) => s.completed)
  if (!scheduledToday && !touched) {
    // no longer scheduled today -> pull the untouched instance back out
    list.splice(list.indexOf(inst), 1)
    if (data.seeded[today]) data.seeded[today] = data.seeded[today].filter((x) => x !== tpl.id)
    return
  }
  inst.topic = tpl.topic
  inst.hours = tpl.hours
  if (!touched) {
    inst.subtasks = (tpl.subtasks || []).map((s) => ({ id: uid(), text: s.text, completed: false, loggedHours: null }))
  }
}

/**
 * Create (no draft.id) or edit a habit template from the form draft, then
 * sync today's instance and seed today (legacy submitHabit). Refuses an
 * empty topic or an empty weekday selection; empty time defaults to 30m.
 */
export function upsertHabit(data: Snapshot, draft: HabitDraft, today: DateStr): void {
  const topic = draft.topic.trim()
  if (!topic || draft.days.length === 0) return
  const hours = clampHours(draft.hours) || 0.5 // v1 semantics: empty/zero time -> 30m
  const subtasks = draft.subtaskLines
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ text }))
  const days = [...draft.days].sort((a, b) => a - b) as Weekday[]
  if (draft.id) {
    const h = data.recurring.find((r) => r.id === draft.id)
    if (h) {
      h.topic = topic
      h.hours = hours
      h.subtasks = subtasks
      h.days = days
      syncHabitToToday(data, h, today)
    }
  } else {
    data.recurring.push({ id: uid(), topic, hours, subtasks, startDate: today, days })
  }
  ensureRecurring(data, today)
}

/**
 * Remove a habit template. Past/today instances stay (days already logged
 * keep their record), and their seeded records stay so nothing re-seeds.
 */
export function deleteHabit(data: Snapshot, habitId: string): void {
  const i = data.recurring.findIndex((r) => r.id === habitId)
  if (i === -1) return
  data.recurring.splice(i, 1)
}

/** Habits whose weekday schedule includes the date (the future-day hint). */
export function habitsOnDate(data: Snapshot, date: DateStr): HabitTemplate[] {
  if (!date) return []
  const dow = parseLocalDate(date).getDay()
  return data.recurring.filter((r) => ((r.days as number[]) || ALL_DAYS).includes(dow))
}

/** Human schedule label: "Every day" | "Weekdays" | "Weekends" | "Mon, Wed". */
export function scheduleLabel(days: number[]): string {
  const d = days && days.length ? days : ALL_DAYS
  if (d.length === 7) return 'Every day'
  if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return 'Weekdays'
  if (d.length === 2 && [0, 6].every((x) => d.includes(x))) return 'Weekends'
  return d
    .slice()
    .sort((a, b) => a - b)
    .map((i) => WEEKDAY_NAMES[i])
    .join(', ')
}

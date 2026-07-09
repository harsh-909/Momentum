/**
 * Scheduled "Plans" - one-off / monthly / yearly items, SEPARATE from weekly
 * habits (Part 2).
 *
 * A plan is a template materialized into a day's goal list on its due date.
 * Like habits, we only ever seed the CURRENT day (`ensurePlans`); unlike
 * habits, plans can be due on a day the app was never opened, so a separate
 * catch-up (`sweepMissedPlans`) surfaces those missed occurrences into the
 * backlog. planSeeded[date] remembers what was placed/surfaced per date so a
 * deleted instance never reappears and a missed one is never double-surfaced.
 *
 * Plan instances carry `planId` (never `recurringId`); scoring/metrics exclude
 * them, and once one rolls into the past it carries to the backlog via the
 * ordinary carry-over path (which strips `planId`).
 */
import { uid } from '../id'
import { shiftDateStr } from './dates'
import { matchesSchedule } from './recurrence'
import { clampHours } from './time'
import type { DateStr, Goal, PlanTemplate, Snapshot } from '../../types/domain'
import type { PlanDraft } from '../../store/types'

/** Materialize a plan template into a day's goal (fresh ids, planId back-ref). */
export function instantiatePlan(tpl: PlanTemplate, date: DateStr): Goal {
  return {
    id: uid(),
    topic: tpl.topic,
    hours: tpl.hours || 0.5,
    loggedHours: null,
    completed: false,
    subtasks: (tpl.subtasks || []).map((s) => ({ id: uid(), text: s.text, completed: false, loggedHours: null })),
    createdAt: date,
    planId: tpl.id,
  }
}

/**
 * Seed today's plan instances. For each template: skip if today precedes its
 * startDate, if the recurrence isn't due today, or if it was already seeded
 * today (covers deleted instances); otherwise instantiate (unless an instance
 * somehow exists) and record the placement in planSeeded[today].
 * Only ever touches the `today` date - callers must pass the logical today.
 */
export function ensurePlans(data: Snapshot, today: DateStr): void {
  if (!today) return
  if (!data.planSeeded[today]) data.planSeeded[today] = []
  for (const p of data.plans || []) {
    if (today < (p.startDate || today)) continue
    if (!matchesSchedule(p.recurrence, today)) continue
    if (data.planSeeded[today].includes(p.id)) continue
    const exists = (data.goals[today] || []).some((g) => g.planId === p.id)
    if (!exists) {
      if (!data.goals[today]) data.goals[today] = []
      data.goals[today].push(instantiatePlan(p, today))
    }
    data.planSeeded[today].push(p.id)
  }
}

/**
 * Catch-up for MISSED past occurrences (the app wasn't open on the due date).
 * Walk every past day after the `plansSweptThrough` watermark and, for each
 * plan due on that day but never seeded there, drop an ordinary actionable
 * backlog task (fresh ids, no planId) so the missed item isn't lost. Then
 * advance the watermark to yesterday (never rewinding). Today and future days
 * are never touched here - `ensurePlans` seeds today's live occurrences.
 */
export function sweepMissedPlans(data: Snapshot, today: DateStr): void {
  if (!today) return
  const yesterday = shiftDateStr(today, -1)
  if (!yesterday) return
  // Clock rollback / westward travel: never leave the watermark in the future.
  if (data.plansSweptThrough && data.plansSweptThrough > yesterday) {
    data.plansSweptThrough = yesterday
  }
  const start = data.plansSweptThrough ? shiftDateStr(data.plansSweptThrough, 1) : data.install || ''
  if (start) {
    for (let d = start; d <= yesterday; d = shiftDateStr(d, 1)) {
      if (!data.planSeeded[d]) data.planSeeded[d] = []
      for (const p of data.plans || []) {
        if (d < (p.startDate || d)) continue
        if (!matchesSchedule(p.recurrence, d)) continue
        if (data.planSeeded[d].includes(p.id)) continue
        // Missed occurrence: surface it as a plain backlog task (no planId, so
        // a re-scheduled item counts normally toward the day's score).
        data.backlog.unshift({
          id: uid(),
          topic: p.topic,
          hours: p.hours || 0.5,
          loggedHours: null,
          completed: false,
          subtasks: (p.subtasks || []).map((s) => ({ id: uid(), text: s.text, completed: false, loggedHours: null })),
          createdAt: d,
          originalDate: d,
          backlognedAt: today,
        })
        data.planSeeded[d].push(p.id)
      }
    }
  }
  if (!data.plansSweptThrough || yesterday > data.plansSweptThrough) {
    data.plansSweptThrough = yesterday
  }
}

/**
 * Create (no draft.id) or edit a plan template from the form draft, then seed
 * today so a plan due today appears immediately. Refuses an empty topic;
 * empty/zero time defaults to 30m (mirrors habits). On create, startDate is
 * today; on edit the original startDate is preserved.
 */
export function upsertPlan(data: Snapshot, draft: PlanDraft, today: DateStr): void {
  const topic = draft.topic.trim()
  if (!topic) return
  const hours = clampHours(draft.hours) || 0.5
  const subtasks = draft.subtaskLines
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ text }))
  if (draft.id) {
    const p = data.plans.find((x) => x.id === draft.id)
    if (p) {
      p.topic = topic
      p.hours = hours
      p.subtasks = subtasks
      p.recurrence = draft.recurrence
    }
  } else {
    data.plans.push({ id: uid(), topic, hours, subtasks, startDate: today, recurrence: draft.recurrence })
  }
  ensurePlans(data, today)
}

/**
 * Remove a plan template. Already-seeded instances and surfaced backlog items
 * stay (their records keep planSeeded intact so nothing re-seeds).
 */
export function deletePlan(data: Snapshot, planId: string): void {
  const i = data.plans.findIndex((p) => p.id === planId)
  if (i === -1) return
  data.plans.splice(i, 1)
}

/**
 * Plan occurrences due in the next `horizonDays` days AFTER today (never today
 * itself), oldest first. Used by the Today "Coming up" hint. Read-only: this
 * never mutates the snapshot.
 */
export function upcomingPlans(
  data: Snapshot,
  today: DateStr,
  horizonDays: number,
): { date: DateStr; plan: PlanTemplate }[] {
  const out: { date: DateStr; plan: PlanTemplate }[] = []
  if (!today) return out
  for (let i = 1; i <= horizonDays; i++) {
    const d = shiftDateStr(today, i)
    for (const plan of data.plans || []) {
      if (d < (plan.startDate || d)) continue
      if (!matchesSchedule(plan.recurrence, d)) continue
      out.push({ date: d, plan })
    }
  }
  return out
}

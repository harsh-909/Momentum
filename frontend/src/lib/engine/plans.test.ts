import { describe, expect, it } from 'vitest'
import { deleteGoal } from './goals'
import { deletePlan, ensurePlans, instantiatePlan, sweepMissedPlans, upcomingPlans, upsertPlan } from './plans'
import { makePlan, makeSnapshot, PAST, TODAY, YESTERDAY, FUTURE, seedGoalOn } from './testFactories'

// TODAY = 2026-07-03. An earlier install lets sweepMissedPlans scan real past days.
const EARLY_INSTALL = '2026-06-15'
const onceToday = () => makePlan({ recurrence: { freq: 'once', date: TODAY } })

describe('instantiatePlan', () => {
  it('materializes a template into a day goal with a planId back-reference', () => {
    const tpl = makePlan({ id: 'p1', topic: 'Taxes', hours: 2, subtasks: [{ text: 'gather' }, { text: 'file' }] })
    const g = instantiatePlan(tpl, TODAY)
    expect(g.planId).toBe('p1')
    expect(g.recurringId).toBeUndefined()
    expect(g.topic).toBe('Taxes')
    expect(g.hours).toBe(2)
    expect(g.completed).toBe(false)
    expect(g.loggedHours).toBeNull()
    expect(g.createdAt).toBe(TODAY)
    expect(g.subtasks.map((s) => s.text)).toEqual(['gather', 'file'])
    expect(g.subtasks.every((s) => !s.completed)).toBe(true)
    expect(g.id).not.toBe('p1')
  })
  it('gives fresh unique ids per instantiation', () => {
    const tpl = makePlan({ subtasks: [{ text: 'x' }] })
    const a = instantiatePlan(tpl, TODAY)
    const b = instantiatePlan(tpl, TODAY)
    expect(a.id).not.toBe(b.id)
    expect(a.subtasks[0].id).not.toBe(b.subtasks[0].id)
  })
  it('defaults zero hours to 0.5', () => {
    expect(instantiatePlan(makePlan({ hours: 0 }), TODAY).hours).toBe(0.5)
  })
})

describe('ensurePlans', () => {
  it('seeds a plan due today and records planSeeded', () => {
    const data = makeSnapshot({ plans: [onceToday()] })
    const id = data.plans[0].id
    ensurePlans(data, TODAY)
    expect(data.goals[TODAY].some((g) => g.planId === id)).toBe(true)
    expect(data.planSeeded[TODAY]).toContain(id)
  })
  it('never double-seeds on repeated calls (planSeeded gate)', () => {
    const data = makeSnapshot({ plans: [onceToday()] })
    ensurePlans(data, TODAY)
    const count = data.goals[TODAY].length
    ensurePlans(data, TODAY)
    expect(data.goals[TODAY]).toHaveLength(count)
  })
  it('skips a plan whose startDate is in the future', () => {
    const data = makeSnapshot({ plans: [makePlan({ startDate: FUTURE, recurrence: { freq: 'once', date: TODAY } })] })
    ensurePlans(data, TODAY)
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
  })
  it('does not seed when the plan is not due today', () => {
    const data = makeSnapshot({ plans: [makePlan({ recurrence: { freq: 'once', date: FUTURE } })] })
    ensurePlans(data, TODAY)
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
    expect(data.planSeeded[TODAY] ?? []).toHaveLength(0)
  })
  it('records seeded without duplicating when an instance already exists', () => {
    const data = makeSnapshot({ plans: [onceToday()] })
    const id = data.plans[0].id
    seedGoalOn(data, TODAY, { planId: id }) // e.g. imported data
    ensurePlans(data, TODAY)
    expect(data.goals[TODAY].filter((g) => g.planId === id)).toHaveLength(1)
    expect(data.planSeeded[TODAY]).toEqual([id])
  })
  it('a deleted instance never reappears (planSeeded blocks re-seeding)', () => {
    const data = makeSnapshot({ plans: [onceToday()] })
    const id = data.plans[0].id
    ensurePlans(data, TODAY)
    const inst = data.goals[TODAY].find((g) => g.planId === id)!
    deleteGoal(data, TODAY, inst.id, TODAY)
    ensurePlans(data, TODAY)
    expect(data.goals[TODAY].some((g) => g.planId === id)).toBe(false)
    expect(data.planSeeded[TODAY]).toContain(id)
  })
})

describe('sweepMissedPlans', () => {
  it('surfaces a missed monthly occurrence to the backlog (no planId, right originalDate)', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plans: [makePlan({ id: 'p1', topic: 'Rent', recurrence: { freq: 'monthly', dayOfMonth: 1 } })],
    })
    sweepMissedPlans(data, TODAY)
    expect(data.backlog).toHaveLength(1) // only 2026-07-01 falls in [install..yesterday]
    const b = data.backlog[0]
    expect(b.topic).toBe('Rent')
    expect(b.planId).toBeUndefined()
    expect(b.originalDate).toBe(PAST) // 2026-07-01
    expect(b.backlognedAt).toBe(TODAY)
    expect(data.planSeeded[PAST]).toContain('p1')
  })
  it('surfaces a missed yearly occurrence', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plans: [makePlan({ topic: 'Anniversary', recurrence: { freq: 'yearly', month: 7, dayOfMonth: 1 } })],
    })
    sweepMissedPlans(data, TODAY)
    expect(data.backlog.map((g) => g.topic)).toEqual(['Anniversary'])
    expect(data.backlog[0].originalDate).toBe(PAST)
  })
  it('surfaces a missed once occurrence', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plans: [makePlan({ topic: 'Dentist', recurrence: { freq: 'once', date: PAST } })],
    })
    sweepMissedPlans(data, TODAY)
    expect(data.backlog.map((g) => g.topic)).toEqual(['Dentist'])
    expect(data.backlog[0].planId).toBeUndefined()
  })
  it('is idempotent: a second run the same day re-surfaces nothing', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plans: [makePlan({ recurrence: { freq: 'once', date: PAST } })],
    })
    sweepMissedPlans(data, TODAY)
    sweepMissedPlans(data, TODAY)
    expect(data.backlog).toHaveLength(1)
  })
  it('respects startDate: an occurrence before startDate is not surfaced', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plans: [makePlan({ startDate: TODAY, recurrence: { freq: 'once', date: PAST } })],
    })
    sweepMissedPlans(data, TODAY)
    expect(data.backlog).toHaveLength(0)
  })
  it('never touches today or the future (a plan due today is not surfaced)', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plans: [
        makePlan({ recurrence: { freq: 'once', date: TODAY } }),
        makePlan({ recurrence: { freq: 'once', date: FUTURE } }),
      ],
    })
    sweepMissedPlans(data, TODAY)
    expect(data.backlog).toHaveLength(0)
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
  })
  it('advances plansSweptThrough to yesterday even with nothing to surface', () => {
    const data = makeSnapshot({ install: EARLY_INSTALL })
    sweepMissedPlans(data, TODAY)
    expect(data.plansSweptThrough).toBe(YESTERDAY)
  })
  it('scans only the days AFTER the watermark', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plansSweptThrough: PAST, // already processed through 2026-07-01
      plans: [
        makePlan({ topic: 'before-wm', recurrence: { freq: 'once', date: PAST } }),
        makePlan({ topic: 'after-wm', recurrence: { freq: 'once', date: YESTERDAY } }),
      ],
    })
    sweepMissedPlans(data, TODAY)
    expect(data.backlog.map((g) => g.topic)).toEqual(['after-wm'])
    expect(data.plansSweptThrough).toBe(YESTERDAY)
  })
  it('clamps a future watermark back to yesterday (clock rollback) and surfaces nothing', () => {
    const data = makeSnapshot({
      install: EARLY_INSTALL,
      plansSweptThrough: '2026-07-09',
      plans: [makePlan({ recurrence: { freq: 'once', date: PAST } })],
    })
    sweepMissedPlans(data, TODAY)
    expect(data.backlog).toHaveLength(0)
    expect(data.plansSweptThrough).toBe(YESTERDAY)
  })
})

describe('upsertPlan', () => {
  it('creates a plan: trimmed topic, startDate today, subtasks from lines, recurrence stored', () => {
    const data = makeSnapshot()
    upsertPlan(
      data,
      { topic: '  File taxes  ', hours: 1.5, subtaskLines: ' gather \n\nsubmit', recurrence: { freq: 'once', date: FUTURE } },
      TODAY,
    )
    expect(data.plans).toHaveLength(1)
    const p = data.plans[0]
    expect(p.topic).toBe('File taxes')
    expect(p.hours).toBe(1.5)
    expect(p.startDate).toBe(TODAY)
    expect(p.subtasks).toEqual([{ text: 'gather' }, { text: 'submit' }])
    expect(p.recurrence).toEqual({ freq: 'once', date: FUTURE })
  })
  it('creating a plan due today seeds today immediately', () => {
    const data = makeSnapshot()
    upsertPlan(data, { topic: 'Today plan', hours: 1, subtaskLines: '', recurrence: { freq: 'once', date: TODAY } }, TODAY)
    const id = data.plans[0].id
    expect(data.goals[TODAY].some((g) => g.planId === id)).toBe(true)
    expect(data.planSeeded[TODAY]).toContain(id)
  })
  it('refuses an empty topic', () => {
    const data = makeSnapshot()
    upsertPlan(data, { topic: '   ', hours: 1, subtaskLines: '', recurrence: { freq: 'once', date: TODAY } }, TODAY)
    expect(data.plans).toHaveLength(0)
  })
  it('defaults empty/zero time to 30m', () => {
    const data = makeSnapshot()
    upsertPlan(data, { topic: 'X', hours: 0, subtaskLines: '', recurrence: { freq: 'once', date: FUTURE } }, TODAY)
    expect(data.plans[0].hours).toBe(0.5)
  })
  it('edits an existing plan by id and preserves its startDate', () => {
    const data = makeSnapshot({ plans: [makePlan({ id: 'p1', topic: 'old', hours: 1, startDate: PAST })] })
    upsertPlan(
      data,
      { id: 'p1', topic: 'renamed', hours: 3, subtaskLines: 'step', recurrence: { freq: 'monthly', dayOfMonth: 5 } },
      TODAY,
    )
    const p = data.plans[0]
    expect(p.topic).toBe('renamed')
    expect(p.hours).toBe(3)
    expect(p.startDate).toBe(PAST)
    expect(p.recurrence).toEqual({ freq: 'monthly', dayOfMonth: 5 })
    expect(p.subtasks).toEqual([{ text: 'step' }])
  })
  it('an unknown draft.id is a safe no-op', () => {
    const data = makeSnapshot()
    upsertPlan(data, { id: 'ghost', topic: 'X', hours: 1, subtaskLines: '', recurrence: { freq: 'once', date: TODAY } }, TODAY)
    expect(data.plans).toHaveLength(0)
  })
})

describe('deletePlan', () => {
  it('removes the template but leaves seeded instances alone', () => {
    const data = makeSnapshot({ plans: [onceToday()] })
    const id = data.plans[0].id
    ensurePlans(data, TODAY)
    deletePlan(data, id)
    expect(data.plans).toHaveLength(0)
    expect(data.goals[TODAY].some((g) => g.planId === id)).toBe(true)
    expect(data.planSeeded[TODAY]).toContain(id)
  })
  it('unknown id is harmless', () => {
    const data = makeSnapshot({ plans: [makePlan({ id: 'p1' })] })
    deletePlan(data, 'nope')
    expect(data.plans).toHaveLength(1)
  })
})

describe('upcomingPlans', () => {
  // TODAY = 2026-07-03; +1 = 07-04, FUTURE = 07-05 (+2), +11 = 07-14.
  it('returns future occurrences within the horizon', () => {
    const data = makeSnapshot({
      plans: [makePlan({ topic: 'Dentist', startDate: PAST, recurrence: { freq: 'once', date: FUTURE } })],
    })
    const out = upcomingPlans(data, TODAY, 14)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe(FUTURE)
    expect(out[0].plan.topic).toBe('Dentist')
  })

  it('excludes an occurrence due today', () => {
    const data = makeSnapshot({
      plans: [makePlan({ startDate: PAST, recurrence: { freq: 'once', date: TODAY } })],
    })
    expect(upcomingPlans(data, TODAY, 14)).toHaveLength(0)
  })

  it('excludes an occurrence beyond the horizon', () => {
    const data = makeSnapshot({
      plans: [makePlan({ startDate: PAST, recurrence: { freq: 'once', date: '2026-07-20' } })],
    })
    expect(upcomingPlans(data, TODAY, 14)).toHaveLength(0)
  })

  it('excludes dates before startDate', () => {
    const data = makeSnapshot({
      plans: [makePlan({ startDate: '2026-07-06', recurrence: { freq: 'once', date: FUTURE } })],
    })
    expect(upcomingPlans(data, TODAY, 14)).toHaveLength(0)
  })

  it('handles multiple plans and sorts ascending by date', () => {
    const data = makeSnapshot({
      plans: [
        makePlan({ topic: 'Later', startDate: PAST, recurrence: { freq: 'once', date: '2026-07-10' } }),
        makePlan({ topic: 'Sooner', startDate: PAST, recurrence: { freq: 'once', date: '2026-07-04' } }),
      ],
    })
    const out = upcomingPlans(data, TODAY, 14)
    expect(out.map((o) => o.date)).toEqual(['2026-07-04', '2026-07-10'])
    expect(out.map((o) => o.plan.topic)).toEqual(['Sooner', 'Later'])
  })

  it('returns empty when nothing is due', () => {
    const data = makeSnapshot({
      plans: [makePlan({ startDate: PAST, recurrence: { freq: 'once', date: '2026-01-01' } })],
    })
    expect(upcomingPlans(data, TODAY, 14)).toEqual([])
  })

  it('returns empty when there are no plans', () => {
    expect(upcomingPlans(makeSnapshot(), TODAY, 14)).toEqual([])
  })
})

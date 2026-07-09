import { describe, expect, it } from 'vitest'
import { shiftDateStr } from './dates'
import { computeMetrics, dailySeries, getLast4Weeks, getLast7Days, hoursSeries, weeklySeries } from './metrics'
import { makeGoal, makeSnapshot, makeSubtask, seedGoalOn, TODAY, YESTERDAY } from './testFactories'

const daysAgo = (n: number) => shiftDateStr(TODAY, -n)

describe('getLast7Days', () => {
  it('returns 7 entries, oldest first, ending today', () => {
    const days = getLast7Days(makeSnapshot(), TODAY)
    expect(days).toHaveLength(7)
    expect(days[0].date).toBe(daysAgo(6))
    expect(days[6].date).toBe(TODAY)
  })
  it('attaches each day\'s goals ([] when none)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, YESTERDAY)
    const days = getLast7Days(data, TODAY)
    expect(days[5].goals).toEqual([g])
    expect(days[6].goals).toEqual([])
  })
})

describe('getLast4Weeks', () => {
  it('returns 4 blocks, oldest (W1) first, covering the 28 days ending today', () => {
    const data = makeSnapshot()
    const oldest = seedGoalOn(data, daysAgo(27)) // first day of W1
    const newest = seedGoalOn(data, TODAY) // last day of W4
    const weeks = getLast4Weeks(data, TODAY)
    expect(weeks).toHaveLength(4)
    expect(weeks[0].goals).toEqual([oldest])
    expect(weeks[3].goals).toContain(newest)
  })
  it('flattens all 7 days of a block into its goals', () => {
    const data = makeSnapshot()
    seedGoalOn(data, daysAgo(6)) // both inside W4 (today-6 .. today)
    seedGoalOn(data, TODAY)
    const weeks = getLast4Weeks(data, TODAY)
    expect(weeks[3].goals).toHaveLength(2)
  })
  it('a day 28+ days back falls outside every block', () => {
    const data = makeSnapshot()
    seedGoalOn(data, daysAgo(28))
    const weeks = getLast4Weeks(data, TODAY)
    expect(weeks.every((w) => w.goals.length === 0)).toBe(true)
  })
  it('labels carry the week number and the block\'s first day (v1 chart labels)', () => {
    const weeks = getLast4Weeks(makeSnapshot(), TODAY)
    // W1 starts 27 days before 2026-07-03 -> 2026-06-06; W4 starts 2026-06-27.
    expect(weeks[0].label).toBe('W1 · Jun 6')
    expect(weeks[1].label).toBe('W2 · Jun 13')
    expect(weeks[2].label).toBe('W3 · Jun 20')
    expect(weeks[3].label).toBe('W4 · Jun 27')
  })
})

describe('computeMetrics: streak', () => {
  it('counts consecutive >=70% days walking back from today', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true })
    seedGoalOn(data, YESTERDAY, { completed: true })
    expect(computeMetrics(data, TODAY).streak).toBe(2)
  })
  it('a day at exactly 70% keeps the streak', () => {
    const data = makeSnapshot()
    data.goals[TODAY] = [
      makeGoal({ subtasks: Array.from({ length: 10 }, (_, i) => makeSubtask({ completed: i < 7 })) }),
    ] // 7/10 = exactly 70%
    seedGoalOn(data, YESTERDAY, { completed: true })
    expect(computeMetrics(data, TODAY).streak).toBe(2)
  })
  it('a day below 70% breaks the streak immediately', () => {
    const data = makeSnapshot()
    data.goals[TODAY] = [
      makeGoal({ subtasks: Array.from({ length: 5 }, (_, i) => makeSubtask({ completed: i < 3 })) }),
    ] // 3/5 = 60%
    seedGoalOn(data, YESTERDAY, { completed: true })
    expect(computeMetrics(data, TODAY).streak).toBe(0)
  })
  it('a day with NO goals breaks the streak (stop, not skip) - including today', () => {
    const data = makeSnapshot()
    seedGoalOn(data, YESTERDAY, { completed: true }) // yesterday perfect, today empty
    expect(computeMetrics(data, TODAY).streak).toBe(0)
  })
  it('a zero-goal gap stops the walk even with strong days beyond it', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true })
    seedGoalOn(data, YESTERDAY, { completed: true })
    // daysAgo(2) has no goals; daysAgo(3) was perfect but must not count.
    seedGoalOn(data, daysAgo(3), { completed: true })
    expect(computeMetrics(data, TODAY).streak).toBe(2)
  })
  it('caps at 7 (the metrics window)', () => {
    const data = makeSnapshot()
    for (let i = 0; i < 30; i++) seedGoalOn(data, daysAgo(i), { completed: true })
    expect(computeMetrics(data, TODAY).streak).toBe(7)
  })
})

describe('computeMetrics: avgWeek / totals', () => {
  it('averages only days that have goals', () => {
    const data = makeSnapshot()
    data.goals[TODAY] = [
      makeGoal({ subtasks: Array.from({ length: 5 }, (_, i) => makeSubtask({ completed: i < 4 })) }),
    ] // 80%
    expect(computeMetrics(data, TODAY).avgWeek).toBe(80)
  })
  it('all days empty -> avgWeek 0', () => {
    expect(computeMetrics(makeSnapshot(), TODAY).avgWeek).toBe(0)
  })
  it('mixes day percentages (100 + 50 -> 75)', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true })
    seedGoalOn(data, YESTERDAY, { completed: true })
    seedGoalOn(data, YESTERDAY, { completed: false })
    expect(computeMetrics(data, TODAY).avgWeek).toBe(75)
  })
  it('sums hours and goal counts over the window (legacy core case)', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true, hours: 1 })
    seedGoalOn(data, YESTERDAY, { completed: true, hours: 2 })
    const m = computeMetrics(data, TODAY)
    expect(m.totalHours).toBe(3)
    expect(m.totalGoals).toBe(2)
  })
  it('totalHours gives partial credit for logged time on incomplete goals (0.75 -> 0.8)', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, {
      hours: 3,
      completed: false,
      loggedHours: 0.75,
      subtasks: [makeSubtask({ completed: true, loggedHours: 0.75 }), makeSubtask()],
    })
    expect(computeMetrics(data, TODAY).totalHours).toBe(0.8) // rounded to 1 decimal
  })
  it('goals outside the 7-day window are excluded', () => {
    const data = makeSnapshot()
    seedGoalOn(data, daysAgo(7), { completed: true, hours: 5 })
    const m = computeMetrics(data, TODAY)
    expect(m.totalHours).toBe(0)
    expect(m.totalGoals).toBe(0)
  })
})

describe('computeMetrics: plan instances are excluded', () => {
  it('a plan-only day counts as empty and breaks the streak', () => {
    const data = makeSnapshot()
    seedGoalOn(data, YESTERDAY, { completed: true }) // strong day
    seedGoalOn(data, TODAY, { planId: 'p1', completed: true }) // today is plan-only -> empty
    expect(computeMetrics(data, TODAY).streak).toBe(0)
  })
  it('a completed manual goal + an incomplete plan today reads a full streak day', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true })
    seedGoalOn(data, TODAY, { planId: 'p1', completed: false })
    expect(computeMetrics(data, TODAY).streak).toBe(1)
  })
  it('avgWeek/totalHours/totalGoals ignore plan instances; habits and manual goals count', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { recurringId: 'r1', completed: true, hours: 1 })
    seedGoalOn(data, TODAY, { completed: true, hours: 2 })
    seedGoalOn(data, TODAY, { planId: 'p1', completed: true, hours: 5, loggedHours: 4 })
    const m = computeMetrics(data, TODAY)
    expect(m.avgWeek).toBe(100)
    expect(m.totalHours).toBe(3) // 1 + 2, plan's 4 logged excluded
    expect(m.totalGoals).toBe(2) // habit + manual, plan excluded
  })
})

describe('chart series', () => {
  it('dailySeries: completed vs total per day with weekday labels', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true })
    seedGoalOn(data, TODAY, { completed: false })
    const series = dailySeries(data, TODAY)
    expect(series).toHaveLength(7)
    // Label rendering order varies by ICU version ("Fri 3" vs "3 Fri") - assert parts.
    expect(series[6]).toMatchObject({ completed: 1, total: 2 })
    expect(series[6].label).toContain('Fri')
    expect(series[6].label).toContain('3')
    expect(series[5].label).toContain('Thu')
    expect(series[0]).toMatchObject({ completed: 0, total: 0 })
    expect(series[0].label).toContain('Sat')
    expect(series[0].label).toContain('27')
  })
  it('weeklySeries: partial-credit pct per block, sharing the week labels', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true })
    seedGoalOn(data, YESTERDAY, { completed: false })
    const series = weeklySeries(data, TODAY)
    expect(series).toHaveLength(4)
    expect(series[3]).toEqual({ label: 'W4 · Jun 27', pct: 50 })
    expect(series[0]).toEqual({ label: 'W1 · Jun 6', pct: 0 })
  })
  it('weeklySeries reports 100 only when every goal in the block is complete', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true })
    seedGoalOn(data, YESTERDAY, { completed: true })
    expect(weeklySeries(data, TODAY)[3].pct).toBe(100)
  })
  it('hoursSeries: goalDoneHours per day (logged wins, plan only when complete)', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { completed: true, hours: 2, loggedHours: null }) // plan fallback
    seedGoalOn(data, TODAY, { completed: false, hours: 9, loggedHours: 0.5 }) // logged, partial
    seedGoalOn(data, TODAY, { completed: false, hours: 9, loggedHours: null }) // contributes 0
    const series = hoursSeries(data, TODAY)
    expect(series[6].hours).toBe(2.5)
    expect(series[6].label).toContain('Fri')
    expect(series[0].hours).toBe(0)
  })
})

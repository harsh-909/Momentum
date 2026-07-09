import { describe, expect, it } from 'vitest'
import { computeDayStats, dayProgressPct, goalDoneHours, goalProgress, historyGoalHours, isPlanInstance } from './scoring'
import { makeGoal, makeSubtask } from './testFactories'

describe('goalProgress', () => {
  it('completed goal -> 1', () => expect(goalProgress(makeGoal({ completed: true }))).toBe(1))
  it('no subtasks, incomplete -> 0', () => expect(goalProgress(makeGoal())).toBe(0))
  it('2 of 4 subtasks -> 0.5', () => {
    const g = makeGoal({
      subtasks: [
        makeSubtask({ completed: true }),
        makeSubtask({ completed: true }),
        makeSubtask(),
        makeSubtask(),
      ],
    })
    expect(goalProgress(g)).toBe(0.5)
  })
  it('all subtasks done (parent not yet flagged) -> 1', () => {
    const g = makeGoal({ subtasks: [makeSubtask({ completed: true }), makeSubtask({ completed: true })] })
    expect(goalProgress(g)).toBe(1)
  })
  it('missing subtasks array -> 0 (legacy import tolerance)', () => {
    expect(goalProgress(makeGoal({ subtasks: undefined as never }))).toBe(0)
  })
})

describe('dayProgressPct', () => {
  it('empty day -> 0', () => expect(dayProgressPct([])).toBe(0))
  it('all goals complete -> 100', () => {
    expect(dayProgressPct([makeGoal({ completed: true }), makeGoal({ completed: true })])).toBe(100)
  })
  it('partial mix: one done + one half done -> 75', () => {
    expect(
      dayProgressPct([
        makeGoal({ completed: true }),
        makeGoal({ subtasks: [makeSubtask({ completed: true }), makeSubtask()] }),
      ]),
    ).toBe(75)
  })
  it('rounding never fakes a perfect day: 199/200 subtasks caps at 99', () => {
    const g = makeGoal({
      subtasks: Array.from({ length: 200 }, (_, i) => makeSubtask({ completed: i < 199 })),
    })
    expect(dayProgressPct([g])).toBe(99)
  })
  it('all subtasks done but parent unchecked still caps at 99 (not every goal completed)', () => {
    const g = makeGoal({ subtasks: [makeSubtask({ completed: true })] })
    expect(dayProgressPct([g])).toBe(99)
  })
  it('rounds the average (1/3 -> 33)', () => {
    expect(dayProgressPct([makeGoal({ completed: true }), makeGoal(), makeGoal()])).toBe(33)
  })
})

describe('isPlanInstance', () => {
  it('true only when planId is set', () => {
    expect(isPlanInstance(makeGoal({ planId: 'p1' }))).toBe(true)
    expect(isPlanInstance(makeGoal())).toBe(false)
    expect(isPlanInstance(makeGoal({ recurringId: 'r1' }))).toBe(false)
  })
})

describe('plan instances are excluded from scoring', () => {
  it('dayProgressPct: a completed manual goal + an incomplete plan reads 100 (plan ignored)', () => {
    expect(dayProgressPct([makeGoal({ completed: true }), makeGoal({ planId: 'p1', completed: false })])).toBe(100)
  })
  it('dayProgressPct: a plan-only day reads 0 (all instances excluded -> empty)', () => {
    expect(dayProgressPct([makeGoal({ planId: 'p1', completed: true })])).toBe(0)
  })
  it('dayProgressPct: a habit and a manual goal still count, plan does not', () => {
    // habit done + manual half done -> 75; the incomplete plan must not drag it to 50.
    expect(
      dayProgressPct([
        makeGoal({ recurringId: 'r1', completed: true }),
        makeGoal({ subtasks: [makeSubtask({ completed: true }), makeSubtask()] }),
        makeGoal({ planId: 'p1', completed: false }),
      ]),
    ).toBe(75)
  })
  it('computeDayStats: plan instance excluded from completed/total/hours/doneHours/pct', () => {
    const stats = computeDayStats([
      makeGoal({ completed: true, hours: 2, loggedHours: 1.5 }),
      makeGoal({ planId: 'p1', completed: false, hours: 5, loggedHours: 3 }),
    ])
    expect(stats).toEqual({ completed: 1, total: 1, hours: 2, doneHours: 1.5, pct: 100 })
  })
})

describe('goalDoneHours (partial credit for logged time)', () => {
  it('finite loggedHours wins, even on an INCOMPLETE goal', () => {
    expect(goalDoneHours(makeGoal({ hours: 3, loggedHours: 0.75, completed: false }))).toBe(0.75)
  })
  it('completed goal without logged time falls back to planned hours', () => {
    expect(goalDoneHours(makeGoal({ hours: 2, loggedHours: null, completed: true }))).toBe(2)
  })
  it('incomplete goal with nothing logged contributes 0', () => {
    expect(goalDoneHours(makeGoal({ hours: 5, loggedHours: null, completed: false }))).toBe(0)
  })
  it('loggedHours 0 is finite and counts as 0 (does not fall back to plan)', () => {
    expect(goalDoneHours(makeGoal({ hours: 2, loggedHours: 0, completed: true }))).toBe(0)
  })
  it('completed goal with garbage hours contributes 0', () => {
    expect(goalDoneHours(makeGoal({ hours: NaN, loggedHours: null, completed: true }))).toBe(0)
  })
})

describe('historyGoalHours', () => {
  it('prefers logged hours', () => expect(historyGoalHours(makeGoal({ hours: 2, loggedHours: 1.5 }))).toBe(1.5))
  it('falls back to planned hours when logged is null', () => {
    expect(historyGoalHours(makeGoal({ hours: 2, loggedHours: null }))).toBe(2)
  })
  it('garbage -> 0', () => expect(historyGoalHours(makeGoal({ hours: NaN, loggedHours: null }))).toBe(0))
})

describe('computeDayStats', () => {
  it('aggregates completed/total/hours/doneHours/pct', () => {
    const stats = computeDayStats([
      makeGoal({ completed: true, hours: 2, loggedHours: 1.5 }),
      makeGoal({ completed: false, hours: 1 }),
    ])
    expect(stats).toEqual({ completed: 1, total: 2, hours: 3, doneHours: 1.5, pct: 50 })
  })
  it('empty day -> zeros', () => {
    expect(computeDayStats([])).toEqual({ completed: 0, total: 0, hours: 0, doneHours: 0, pct: 0 })
  })
  it('sums subtask-rolled-up logged time (planned 2h, logged 1.5h)', () => {
    const stats = computeDayStats([
      makeGoal({
        completed: true,
        hours: 2,
        loggedHours: 1.5,
        subtasks: [makeSubtask({ completed: true, loggedHours: 0.5 }), makeSubtask({ completed: true, loggedHours: 1 })],
      }),
    ])
    expect(stats.hours).toBe(2)
    expect(stats.doneHours).toBe(1.5)
  })
  it('partial goal: logged subtask time counts while an untouched goal adds 0', () => {
    const stats = computeDayStats([
      makeGoal({
        completed: false,
        hours: 3,
        loggedHours: 0.75, // rolled up from one completed subtask
        subtasks: [makeSubtask({ completed: true, loggedHours: 0.75 }), makeSubtask()],
      }),
      makeGoal({ completed: false, hours: 5 }),
    ])
    expect(stats.doneHours).toBe(0.75)
  })
  it('rounds hour totals to 2 decimals', () => {
    const stats = computeDayStats([
      makeGoal({ completed: true, hours: 0.3333, loggedHours: null }),
      makeGoal({ completed: true, hours: 0.3333, loggedHours: null }),
      makeGoal({ completed: true, hours: 0.3333, loggedHours: null }),
    ])
    expect(stats.hours).toBe(1)
    expect(stats.doneHours).toBe(1)
  })
})

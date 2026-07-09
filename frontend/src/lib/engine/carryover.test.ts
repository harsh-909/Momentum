import { describe, expect, it } from 'vitest'
import { carryCopy, sweepPastDays } from './carryover'
import { dayProgressPct } from './scoring'
import { FUTURE, makeGoal, makeSnapshot, makeSubtask, PAST, seedGoalOn, TODAY, YESTERDAY } from './testFactories'

describe('carryCopy', () => {
  it('copies the unfinished remainder with fresh ids', () => {
    const g = makeGoal({
      id: 'orig',
      topic: 'x',
      hours: 2,
      loggedHours: 1,
      createdAt: PAST,
      subtasks: [
        makeSubtask({ id: 'sub-done', text: 'done step', completed: true }),
        makeSubtask({ id: 'sub-todo', text: 'todo', completed: false }),
      ],
    })
    const copy = carryCopy(g, PAST)!
    expect(copy).not.toBeNull()
    expect(copy.id).not.toBe('orig')
    expect(copy.topic).toBe('x')
    expect(copy.hours).toBe(2)
    expect(copy.loggedHours).toBeNull()
    expect(copy.completed).toBe(false)
    expect(copy.subtasks).toHaveLength(1)
    expect(copy.subtasks[0].text).toBe('todo')
    expect(copy.subtasks[0].completed).toBe(false)
    expect(copy.subtasks[0].id).not.toBe('sub-todo')
    expect(copy.createdAt).toBe(PAST)
    expect(copy.originalDate).toBe(PAST)
  })
  it('preserves the goal\'s own original date when it was rescheduled', () => {
    const g = makeGoal({ createdAt: '2026-06-20' })
    expect(carryCopy(g, PAST)!.originalDate).toBe('2026-06-20')
  })
  it('returns null for a completed goal', () => {
    expect(carryCopy(makeGoal({ completed: true }), PAST)).toBeNull()
  })
  it('returns null when every subtask is done (nothing pending)', () => {
    const g = makeGoal({
      completed: false,
      subtasks: [makeSubtask({ completed: true }), makeSubtask({ completed: true })],
    })
    expect(carryCopy(g, PAST)).toBeNull()
  })
  it('defaults zero hours to 1', () => {
    expect(carryCopy(makeGoal({ hours: 0 }), PAST)!.hours).toBe(1)
  })
})

describe('sweepPastDays', () => {
  it('THE BUG (regression): carrying must not inflate the past day\'s score', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, { topic: 'done1', completed: true })
    seedGoalOn(data, PAST, { topic: 'done2', completed: true })
    seedGoalOn(data, PAST, { topic: 'miss1', completed: false })
    seedGoalOn(data, PAST, { topic: 'miss2', completed: false })
    expect(dayProgressPct(data.goals[PAST])).toBe(50)

    sweepPastDays(data, TODAY)

    expect(data.goals[PAST]).toHaveLength(4) // day keeps all its goals
    expect(dayProgressPct(data.goals[PAST])).toBe(50) // score NOT inflated
    expect(data.backlog).toHaveLength(2)
    expect(data.backlog.map((g) => g.topic).sort()).toEqual(['miss1', 'miss2'])
    expect(data.goals[PAST].filter((g) => g.carried)).toHaveLength(2)
    expect(data.goals[PAST].filter((g) => g.completed && g.carried)).toHaveLength(0)
  })

  it('carries only the incomplete subtasks; the past record is untouched', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, {
      topic: 'partial',
      subtasks: [
        makeSubtask({ text: 'done step', completed: true }),
        makeSubtask({ text: 'todo A' }),
        makeSubtask({ text: 'todo B' }),
      ],
    })
    sweepPastDays(data, TODAY)
    expect(g.subtasks).toHaveLength(3)
    expect(g.subtasks[0].completed).toBe(true)
    const copy = data.backlog[0]
    expect(copy.subtasks.map((s) => s.text).sort()).toEqual(['todo A', 'todo B'])
    expect(copy.subtasks.every((s) => !s.completed)).toBe(true)
    expect(copy.completed).toBe(false)
    expect(copy.backlognedAt).toBe(TODAY)
    expect(copy.originalDate).toBe(PAST)
  })

  it('the copy is independent: finishing it never rewrites history', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { id: 'orig', subtasks: [makeSubtask({ id: 'sub-orig', text: 'step' })] })
    sweepPastDays(data, TODAY)
    const copy = data.backlog[0]
    expect(copy.id).not.toBe('orig')
    expect(copy.subtasks[0].id).not.toBe('sub-orig')
    copy.completed = true
    copy.subtasks[0].completed = true
    expect(g.completed).toBe(false)
    expect(g.subtasks[0].completed).toBe(false)
    expect(dayProgressPct(data.goals[PAST])).toBe(0)
  })

  it('is idempotent: a second sweep the same day carries nothing new', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, { topic: 'miss' })
    sweepPastDays(data, TODAY)
    sweepPastDays(data, TODAY)
    expect(data.backlog).toHaveLength(1)
  })

  describe('carriedThrough watermark', () => {
    it('advances to yesterday after a sweep', () => {
      const data = makeSnapshot()
      expect(data.carriedThrough).toBe('')
      seedGoalOn(data, PAST, { topic: 'old miss' })
      sweepPastDays(data, TODAY)
      expect(data.carriedThrough).toBe(YESTERDAY)
      expect(data.backlog).toHaveLength(1)
    })
    it('empty watermark ("") means ALL history is eligible', () => {
      const data = makeSnapshot()
      seedGoalOn(data, '2025-01-15', { topic: 'ancient miss' })
      sweepPastDays(data, TODAY)
      expect(data.backlog.map((g) => g.topic)).toEqual(['ancient miss'])
    })
    it('a day at/under the watermark is skipped even with an un-flagged pending goal', () => {
      const data = makeSnapshot({ carriedThrough: YESTERDAY })
      seedGoalOn(data, YESTERDAY, { topic: 'already-swept-day' })
      sweepPastDays(data, TODAY)
      expect(data.backlog).toHaveLength(0)
      expect(data.goals[YESTERDAY][0].carried).toBeUndefined()
    })
    it('a day strictly after the watermark is swept', () => {
      const data = makeSnapshot({ carriedThrough: PAST })
      seedGoalOn(data, YESTERDAY, { topic: 'new miss' })
      sweepPastDays(data, TODAY)
      expect(data.backlog).toHaveLength(1)
      expect(data.backlog[0].topic).toBe('new miss')
      expect(data.carriedThrough).toBe(YESTERDAY)
    })
    it('is set even when there is nothing to carry', () => {
      const data = makeSnapshot()
      sweepPastDays(data, TODAY)
      expect(data.carriedThrough).toBe(YESTERDAY)
    })
    it('never rewinds when the stored watermark is ahead of yesterday', () => {
      const data = makeSnapshot({ carriedThrough: '2026-07-09' })
      sweepPastDays(data, TODAY)
      expect(data.carriedThrough).toBe('2026-07-09')
    })
  })

  it('an incomplete plan instance is carried to the backlog, and the copy drops planId', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, { topic: 'plan miss', planId: 'p1', completed: false })
    sweepPastDays(data, TODAY)
    expect(data.backlog).toHaveLength(1)
    const copy = data.backlog[0]
    expect(copy.topic).toBe('plan miss')
    expect(copy.planId).toBeUndefined()
    expect(copy.recurringId).toBeUndefined()
    expect(copy.originalDate).toBe(PAST)
    expect(data.goals[PAST][0].carried).toBe(true)
  })

  it('habits are never carried; today/future days are never swept', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, { topic: 'habit', recurringId: 'r1' })
    seedGoalOn(data, TODAY, { topic: 'today-undone' })
    seedGoalOn(data, FUTURE, { topic: 'future-undone' })
    sweepPastDays(data, TODAY)
    expect(data.backlog).toHaveLength(0)
    expect(data.goals[PAST][0].carried).toBeUndefined()
    expect(data.goals[TODAY][0].carried).toBeUndefined()
    expect(data.goals[FUTURE][0].carried).toBeUndefined()
  })

  it('completed goals are skipped entirely (not even flagged)', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, { topic: 'done', completed: true })
    sweepPastDays(data, TODAY)
    expect(data.backlog).toHaveLength(0)
    expect(data.goals[PAST][0].carried).toBeUndefined()
  })

  it('goal left unchecked but all subtasks done -> flagged carried, nothing copied', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, {
      topic: 'no-remainder',
      subtasks: [makeSubtask({ completed: true }), makeSubtask({ completed: true })],
    })
    sweepPastDays(data, TODAY)
    expect(data.goals[PAST][0].carried).toBe(true)
    expect(data.backlog).toHaveLength(0)
  })

  it('per-goal carried flag blocks re-carry across watermark resets (imported data)', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, { topic: 'already carried', carried: true })
    sweepPastDays(data, TODAY)
    expect(data.backlog).toHaveLength(0)
  })

  it('sweeps multiple past days in one run and prepends newest copies at the front', () => {
    const data = makeSnapshot()
    seedGoalOn(data, '2026-06-29', { topic: 'older' })
    seedGoalOn(data, PAST, { topic: 'newer' })
    sweepPastDays(data, TODAY)
    expect(data.backlog).toHaveLength(2)
    expect(data.carriedThrough).toBe(YESTERDAY)
    // Each copy is unshifted, so the last-swept goal ends up first.
    expect(data.backlog.map((g) => g.topic).sort()).toEqual(['newer', 'older'])
  })
})

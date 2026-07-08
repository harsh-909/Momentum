import { describe, expect, it } from 'vitest'
import { deleteBacklogItem, moveToBacklog, scheduleFromBacklog } from './backlog'
import { FUTURE, makeGoal, makeSnapshot, PAST, seedGoalOn, TODAY } from './testFactories'

describe('moveToBacklog', () => {
  it('moves the goal object out of the day and to the FRONT of the backlog', () => {
    const data = makeSnapshot({ backlog: [makeGoal({ topic: 'older' })] })
    const g = seedGoalOn(data, TODAY, { topic: 'undone' })
    expect(moveToBacklog(data, TODAY, g.id, TODAY)).toBe(true)
    expect(data.goals[TODAY]).toHaveLength(0)
    expect(data.backlog.map((b) => b.topic)).toEqual(['undone', 'older'])
    expect(data.backlog[0]).toBe(g) // the same object moves, not a copy
  })
  it('stamps originalDate from createdAt and backlognedAt = today', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { createdAt: PAST }) // e.g. rescheduled earlier
    moveToBacklog(data, TODAY, g.id, TODAY)
    expect(data.backlog[0].originalDate).toBe(PAST)
    expect(data.backlog[0].backlognedAt).toBe(TODAY)
  })
  it('falls back to the date when createdAt is missing', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { createdAt: '' })
    moveToBacklog(data, TODAY, g.id, TODAY)
    expect(data.backlog[0].originalDate).toBe(TODAY)
  })
  it('refuses a habit instance (habits are day-bound)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { topic: 'Meditate', recurringId: 'r1' })
    expect(moveToBacklog(data, TODAY, g.id, TODAY)).toBe(false)
    expect(data.backlog).toHaveLength(0)
    expect(data.goals[TODAY]).toHaveLength(1)
  })
  it('refuses a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST)
    expect(moveToBacklog(data, PAST, g.id, TODAY)).toBe(false)
    expect(data.goals[PAST]).toHaveLength(1)
    expect(data.backlog).toHaveLength(0)
  })
  it('returns false for an unknown goal id', () => {
    expect(moveToBacklog(makeSnapshot(), TODAY, 'nope', TODAY)).toBe(false)
  })
})

describe('scheduleFromBacklog', () => {
  it('moves the item onto the target day, re-stamping createdAt', () => {
    const data = makeSnapshot({
      backlog: [makeGoal({ id: 'bk1', topic: 'later', createdAt: PAST, originalDate: PAST, backlognedAt: TODAY })],
    })
    scheduleFromBacklog(data, 0, FUTURE, TODAY)
    expect(data.backlog).toHaveLength(0)
    const g = data.goals[FUTURE][0]
    expect(g.id).toBe('bk1')
    expect(g.createdAt).toBe(FUTURE)
  })
  it('keeps originalDate/backlognedAt provenance (v1 behavior)', () => {
    const data = makeSnapshot({
      backlog: [makeGoal({ originalDate: PAST, backlognedAt: TODAY })],
    })
    scheduleFromBacklog(data, 0, TODAY, TODAY)
    expect(data.goals[TODAY][0].originalDate).toBe(PAST)
    expect(data.goals[TODAY][0].backlognedAt).toBe(TODAY)
  })
  it('appends to an existing day list', () => {
    const data = makeSnapshot({ backlog: [makeGoal({ topic: 'from backlog' })] })
    seedGoalOn(data, TODAY, { topic: 'existing' })
    scheduleFromBacklog(data, 0, TODAY, TODAY)
    expect(data.goals[TODAY].map((g) => g.topic)).toEqual(['existing', 'from backlog'])
  })
  it('refuses a past target date', () => {
    const data = makeSnapshot({ backlog: [makeGoal()] })
    scheduleFromBacklog(data, 0, PAST, TODAY)
    expect(data.backlog).toHaveLength(1)
    expect(data.goals[PAST]).toBeUndefined()
  })
  it('refuses an empty date', () => {
    const data = makeSnapshot({ backlog: [makeGoal()] })
    scheduleFromBacklog(data, 0, '', TODAY)
    expect(data.backlog).toHaveLength(1)
  })
  it('ignores an out-of-range index', () => {
    const data = makeSnapshot({ backlog: [makeGoal()] })
    scheduleFromBacklog(data, 5, TODAY, TODAY)
    expect(data.backlog).toHaveLength(1)
    expect(data.goals[TODAY]).toBeUndefined()
  })
})

describe('deleteBacklogItem', () => {
  it('removes exactly the indexed item', () => {
    const data = makeSnapshot({ backlog: [makeGoal({ topic: 'a' }), makeGoal({ topic: 'b' }), makeGoal({ topic: 'c' })] })
    deleteBacklogItem(data, 1)
    expect(data.backlog.map((b) => b.topic)).toEqual(['a', 'c'])
  })
  it('out-of-range index is harmless', () => {
    const data = makeSnapshot({ backlog: [makeGoal()] })
    deleteBacklogItem(data, 7)
    expect(data.backlog).toHaveLength(1)
  })
})

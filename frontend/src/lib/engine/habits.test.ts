import { describe, expect, it } from 'vitest'
import { deleteGoal } from './goals'
import {
  deleteHabit,
  ensureRecurring,
  habitsOnDate,
  instantiateHabit,
  scheduleLabel,
  syncHabitToToday,
  upsertHabit,
} from './habits'
import { FUTURE, makeHabit, makeSnapshot, makeSubtask, PAST, seedGoalOn, TODAY } from './testFactories'

// TODAY = 2026-07-03 is a FRIDAY (weekday 5).
const FRIDAY = 5

describe('instantiateHabit', () => {
  it('materializes a template into a day goal with a recurringId back-reference', () => {
    const tpl = makeHabit({ id: 'r1', topic: 'Meditate', hours: 0.5, subtasks: [{ text: 'sit' }, { text: 'breathe' }] })
    const g = instantiateHabit(tpl, TODAY)
    expect(g.recurringId).toBe('r1')
    expect(g.topic).toBe('Meditate')
    expect(g.hours).toBe(0.5)
    expect(g.completed).toBe(false)
    expect(g.loggedHours).toBeNull()
    expect(g.createdAt).toBe(TODAY)
    expect(g.subtasks.map((s) => s.text)).toEqual(['sit', 'breathe'])
    expect(g.subtasks.every((s) => !s.completed)).toBe(true)
    expect(g.id).not.toBe('r1')
  })
  it('gives subtasks fresh unique ids per instantiation', () => {
    const tpl = makeHabit({ subtasks: [{ text: 'x' }] })
    const a = instantiateHabit(tpl, TODAY)
    const b = instantiateHabit(tpl, TODAY)
    expect(a.subtasks[0].id).not.toBe(b.subtasks[0].id)
    expect(a.id).not.toBe(b.id)
  })
  it('defaults zero hours to 0.5', () => {
    expect(instantiateHabit(makeHabit({ hours: 0 }), TODAY).hours).toBe(0.5)
  })
})

describe('ensureRecurring', () => {
  it('seeds today and records the placement in seeded', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    ensureRecurring(data, TODAY)
    expect(data.goals[TODAY].some((g) => g.recurringId === 'r1')).toBe(true)
    expect(data.seeded[TODAY]).toContain('r1')
  })
  it('never double-seeds on repeated calls', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    ensureRecurring(data, TODAY)
    const count = data.goals[TODAY].length
    ensureRecurring(data, TODAY)
    expect(data.goals[TODAY]).toHaveLength(count)
  })
  it('only ever touches the passed `today` date', () => {
    const data = makeSnapshot({ recurring: [makeHabit()] })
    ensureRecurring(data, TODAY)
    expect(Object.keys(data.goals)).toEqual([TODAY])
    expect(Object.keys(data.seeded)).toEqual([TODAY])
  })
  it('skips habits not scheduled on today\'s weekday', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'rsun', days: [0] })] }) // Sundays only
    ensureRecurring(data, TODAY) // Friday
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
    expect(data.seeded[TODAY]).not.toContain('rsun')
  })
  it('seeds habits scheduled on today\'s weekday', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'rfri', days: [FRIDAY] })] })
    ensureRecurring(data, TODAY)
    expect(data.goals[TODAY].some((g) => g.recurringId === 'rfri')).toBe(true)
  })
  it('skips habits whose startDate is in the future', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'rnew', startDate: FUTURE })] })
    ensureRecurring(data, TODAY)
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
  })
  it('a deleted instance never reappears (seeded record blocks re-seeding)', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    ensureRecurring(data, TODAY)
    const inst = data.goals[TODAY].find((g) => g.recurringId === 'r1')!
    deleteGoal(data, TODAY, inst.id, TODAY)
    ensureRecurring(data, TODAY)
    expect(data.goals[TODAY].some((g) => g.recurringId === 'r1')).toBe(false)
    expect(data.seeded[TODAY]).toContain('r1')
  })
  it('records seeded without duplicating when an instance already exists', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    seedGoalOn(data, TODAY, { recurringId: 'r1' }) // e.g. imported data
    ensureRecurring(data, TODAY)
    expect(data.goals[TODAY].filter((g) => g.recurringId === 'r1')).toHaveLength(1)
    expect(data.seeded[TODAY]).toEqual(['r1'])
  })
})

describe('syncHabitToToday', () => {
  it('updates an untouched instance (topic, hours, subtasks replaced fresh)', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { id: 'i1', topic: 'old', hours: 1, recurringId: 'rX', subtasks: [] })
    const tpl = makeHabit({ id: 'rX', topic: 'renamed', hours: 2, subtasks: [{ text: 'new' }] })
    syncHabitToToday(data, tpl, TODAY)
    const inst = data.goals[TODAY][0]
    expect(inst.topic).toBe('renamed')
    expect(inst.hours).toBe(2)
    expect(inst.subtasks.map((s) => s.text)).toEqual(['new'])
    expect(inst.subtasks[0].completed).toBe(false)
  })
  it('never rewrites a completed instance', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { topic: 'done already', completed: true, recurringId: 'rX' })
    syncHabitToToday(data, makeHabit({ id: 'rX', topic: 'renamed' }), TODAY)
    expect(data.goals[TODAY][0].topic).toBe('done already')
  })
  it('touched instance (a subtask checked): topic/hours update, subtasks are KEPT', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, {
      topic: 'old',
      hours: 1,
      recurringId: 'rX',
      subtasks: [makeSubtask({ id: 'keep', text: 'progress', completed: true })],
    })
    syncHabitToToday(data, makeHabit({ id: 'rX', topic: 'renamed', hours: 2, subtasks: [{ text: 'replacement' }] }), TODAY)
    const inst = data.goals[TODAY][0]
    expect(inst.topic).toBe('renamed')
    expect(inst.hours).toBe(2)
    expect(inst.subtasks.map((s) => s.id)).toEqual(['keep']) // work in progress preserved
  })
  it('no longer scheduled today + untouched -> instance removed and un-seeded', () => {
    const data = makeSnapshot({ seeded: { [TODAY]: ['rX'] } })
    seedGoalOn(data, TODAY, { recurringId: 'rX', subtasks: [makeSubtask()] })
    syncHabitToToday(data, makeHabit({ id: 'rX', days: [0] }), TODAY) // Sundays only; today is Friday
    expect(data.goals[TODAY]).toHaveLength(0)
    expect(data.seeded[TODAY]).not.toContain('rX')
  })
  it('no longer scheduled today but touched -> instance stays (and still updates topic/hours)', () => {
    const data = makeSnapshot({ seeded: { [TODAY]: ['rX'] } })
    seedGoalOn(data, TODAY, {
      topic: 'old',
      recurringId: 'rX',
      subtasks: [makeSubtask({ completed: true })],
    })
    syncHabitToToday(data, makeHabit({ id: 'rX', topic: 'renamed', days: [0] }), TODAY)
    expect(data.goals[TODAY]).toHaveLength(1)
    expect(data.goals[TODAY][0].topic).toBe('renamed')
  })
  it('scheduled today with no instance and never seeded -> seeds one', () => {
    const data = makeSnapshot()
    const tpl = makeHabit({ id: 'rX', topic: 'Now on Fridays', days: [FRIDAY] })
    syncHabitToToday(data, tpl, TODAY)
    expect(data.goals[TODAY].some((g) => g.recurringId === 'rX')).toBe(true)
    expect(data.seeded[TODAY]).toContain('rX')
  })
  it('scheduled today, no instance, but previously seeded (user deleted it) -> stays deleted', () => {
    const data = makeSnapshot({ seeded: { [TODAY]: ['rX'] } })
    syncHabitToToday(data, makeHabit({ id: 'rX' }), TODAY)
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
  })
  it('not scheduled today and no instance -> nothing happens', () => {
    const data = makeSnapshot()
    syncHabitToToday(data, makeHabit({ id: 'rX', days: [0] }), TODAY)
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
    expect(data.seeded[TODAY] ?? []).toHaveLength(0)
  })
})

describe('upsertHabit', () => {
  it('creates a habit: trimmed topic, sorted days, startDate = today, subtasks from lines', () => {
    const data = makeSnapshot()
    upsertHabit(data, { topic: '  Walk  ', hours: 0.5, subtaskLines: ' shoes \n\nroute', days: [5, 1, 3] }, TODAY)
    expect(data.recurring).toHaveLength(1)
    const h = data.recurring[0]
    expect(h.topic).toBe('Walk')
    expect(h.hours).toBe(0.5)
    expect(h.days).toEqual([1, 3, 5])
    expect(h.startDate).toBe(TODAY)
    expect(h.subtasks).toEqual([{ text: 'shoes' }, { text: 'route' }])
  })
  it('creating a habit scheduled today seeds today immediately', () => {
    const data = makeSnapshot()
    upsertHabit(data, { topic: 'Meditate', hours: 0.5, subtaskLines: '', days: [FRIDAY] }, TODAY)
    const id = data.recurring[0].id
    expect(data.goals[TODAY].some((g) => g.recurringId === id)).toBe(true)
    expect(data.seeded[TODAY]).toContain(id)
  })
  it('creating a habit NOT scheduled today does not touch today', () => {
    const data = makeSnapshot()
    upsertHabit(data, { topic: 'Sunday thing', hours: 1, subtaskLines: '', days: [0] }, TODAY)
    expect(data.goals[TODAY] ?? []).toHaveLength(0)
  })
  it('refuses an empty topic and an empty weekday selection', () => {
    const data = makeSnapshot()
    upsertHabit(data, { topic: '   ', hours: 1, subtaskLines: '', days: [1] }, TODAY)
    upsertHabit(data, { topic: 'No days', hours: 1, subtaskLines: '', days: [] }, TODAY)
    expect(data.recurring).toHaveLength(0)
  })
  it('defaults empty/zero time to 30m (v1 semantics)', () => {
    const data = makeSnapshot()
    upsertHabit(data, { topic: 'Walk', hours: 0, subtaskLines: '', days: [0, 1, 2, 3, 4, 5, 6] }, TODAY)
    expect(data.recurring[0].hours).toBe(0.5)
  })
  it('edits an existing habit by draft.id and syncs today\'s untouched instance', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1', topic: 'old', hours: 1 })] })
    ensureRecurring(data, TODAY)
    upsertHabit(data, { id: 'r1', topic: 'renamed', hours: 2, subtaskLines: 'step', days: [FRIDAY] }, TODAY)
    const h = data.recurring[0]
    expect(h.topic).toBe('renamed')
    expect(h.hours).toBe(2)
    expect(h.days).toEqual([FRIDAY])
    const inst = data.goals[TODAY].find((g) => g.recurringId === 'r1')!
    expect(inst.topic).toBe('renamed')
    expect(inst.hours).toBe(2)
    expect(inst.subtasks.map((s) => s.text)).toEqual(['step'])
  })
  it('editing so today is no longer scheduled removes the untouched instance', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    ensureRecurring(data, TODAY)
    upsertHabit(data, { id: 'r1', topic: 'Habit', hours: 0.5, subtaskLines: '', days: [0] }, TODAY)
    expect(data.goals[TODAY].some((g) => g.recurringId === 'r1')).toBe(false)
  })
  it('keeps the original startDate when editing', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1', startDate: PAST })] })
    upsertHabit(data, { id: 'r1', topic: 'Habit', hours: 1, subtaskLines: '', days: [1] }, TODAY)
    expect(data.recurring[0].startDate).toBe(PAST)
  })
  it('an unknown draft.id is a safe no-op (no new template)', () => {
    const data = makeSnapshot()
    upsertHabit(data, { id: 'ghost', topic: 'X', hours: 1, subtaskLines: '', days: [1] }, TODAY)
    expect(data.recurring).toHaveLength(0)
  })
})

describe('deleteHabit', () => {
  it('removes the template but keeps past/today instances and their seeded records', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    ensureRecurring(data, TODAY)
    seedGoalOn(data, PAST, { recurringId: 'r1', completed: true })
    deleteHabit(data, 'r1')
    expect(data.recurring).toHaveLength(0)
    expect(data.goals[TODAY].some((g) => g.recurringId === 'r1')).toBe(true)
    expect(data.goals[PAST].some((g) => g.recurringId === 'r1')).toBe(true)
    expect(data.seeded[TODAY]).toContain('r1')
  })
  it('after deletion nothing re-seeds (non-resurrection)', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    ensureRecurring(data, TODAY)
    const inst = data.goals[TODAY].find((g) => g.recurringId === 'r1')!
    deleteGoal(data, TODAY, inst.id, TODAY)
    deleteHabit(data, 'r1')
    ensureRecurring(data, TODAY)
    expect(data.goals[TODAY].some((g) => g.recurringId === 'r1')).toBe(false)
  })
  it('unknown id is harmless', () => {
    const data = makeSnapshot({ recurring: [makeHabit({ id: 'r1' })] })
    deleteHabit(data, 'nope')
    expect(data.recurring).toHaveLength(1)
  })
})

describe('habitsOnDate', () => {
  it('filters templates by the date\'s weekday (future-day hint)', () => {
    const fri = makeHabit({ id: 'fri', days: [FRIDAY] })
    const sun = makeHabit({ id: 'sun', days: [0] })
    const all = makeHabit({ id: 'all' })
    const data = makeSnapshot({ recurring: [fri, sun, all] })
    expect(habitsOnDate(data, TODAY).map((h) => h.id)).toEqual(['fri', 'all']) // Friday
    expect(habitsOnDate(data, FUTURE).map((h) => h.id)).toEqual(['sun', 'all']) // 2026-07-05 is a Sunday
  })
  it('empty date -> empty list', () => {
    expect(habitsOnDate(makeSnapshot({ recurring: [makeHabit()] }), '')).toEqual([])
  })
})

describe('scheduleLabel', () => {
  it('every day', () => expect(scheduleLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day'))
  it('weekdays', () => expect(scheduleLabel([1, 2, 3, 4, 5])).toBe('Weekdays'))
  it('weekends', () => expect(scheduleLabel([0, 6])).toBe('Weekends'))
  it('custom picks, sorted, comma-joined', () => expect(scheduleLabel([3, 1])).toBe('Mon, Wed'))
  it('two weekdays that are not the weekend pair', () => expect(scheduleLabel([2, 4])).toBe('Tue, Thu'))
  it('empty/missing selection reads as every day (legacy default)', () => {
    expect(scheduleLabel([])).toBe('Every day')
  })
})

import { describe, expect, it } from 'vitest'
import {
  addEditSubtask,
  addGoal,
  cleanText,
  deleteGoal,
  finishEditGoal,
  logGoalTime,
  logSubtaskTime,
  recomputeGoalLogged,
  removeSubtask,
  reorderGoal,
  reorderSubtask,
  setGoalHours,
  setGoalTopic,
  setSubtaskText,
  toggleGoal,
  toggleSubtask,
} from './goals'
import { FUTURE, makeGoal, makeSnapshot, makeSubtask, PAST, seedGoalOn, TODAY, YESTERDAY } from './testFactories'

describe('cleanText', () => {
  it('drops blank lines', () => expect(cleanText('a\n\n\nb')).toBe('a\nb'))
  it('trims leading/trailing blank lines', () => expect(cleanText('\n\nhello\n\n')).toBe('hello'))
  it('drops whitespace-only lines', () => expect(cleanText('line1\n   \nline2')).toBe('line1\nline2'))
  it('empty -> empty', () => expect(cleanText('')).toBe(''))
  it('all-blank -> empty', () => expect(cleanText('  \n \n\t')).toBe(''))
  it('strips trailing whitespace per line but keeps leading indent', () => {
    expect(cleanText('  keep indent  \nnext\t')).toBe('  keep indent\nnext')
  })
})

describe('addGoal', () => {
  it('creates a goal with parsed subtasks and resets nothing it does not own', () => {
    const data = makeSnapshot()
    addGoal(data, TODAY, { topic: 'Read', hours: 2, subtaskLines: 'one\ntwo' }, TODAY)
    const g = data.goals[TODAY][0]
    expect(g.topic).toBe('Read')
    expect(g.hours).toBe(2)
    expect(g.completed).toBe(false)
    expect(g.loggedHours).toBeNull()
    expect(g.createdAt).toBe(TODAY)
    expect(g.subtasks.map((s) => s.text)).toEqual(['one', 'two'])
    expect(g.subtasks.every((s) => !s.completed && s.loggedHours === null)).toBe(true)
  })
  it('trims the topic and subtask lines, dropping blank lines', () => {
    const data = makeSnapshot()
    addGoal(data, TODAY, { topic: '  Study  ', hours: 1, subtaskLines: ' a \n\n  \nb' }, TODAY)
    const g = data.goals[TODAY][0]
    expect(g.topic).toBe('Study')
    expect(g.subtasks.map((s) => s.text)).toEqual(['a', 'b'])
  })
  it('refuses an empty topic', () => {
    const data = makeSnapshot()
    addGoal(data, TODAY, { topic: '   ', hours: 1, subtaskLines: '' }, TODAY)
    expect(data.goals[TODAY]).toBeUndefined()
  })
  it('defaults empty/zero time to 1h (v1 semantics)', () => {
    const data = makeSnapshot()
    addGoal(data, TODAY, { topic: 'Zero', hours: 0, subtaskLines: '' }, TODAY)
    expect(data.goals[TODAY][0].hours).toBe(1)
  })
  it('gives fresh unique ids', () => {
    const data = makeSnapshot()
    addGoal(data, TODAY, { topic: 'A', hours: 1, subtaskLines: 'x\ny' }, TODAY)
    const g = data.goals[TODAY][0]
    const ids = [g.id, ...g.subtasks.map((s) => s.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('appends to an existing day list', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { topic: 'first' })
    addGoal(data, TODAY, { topic: 'second', hours: 1, subtaskLines: '' }, TODAY)
    expect(data.goals[TODAY].map((g) => g.topic)).toEqual(['first', 'second'])
  })
  it('works on a future day', () => {
    const data = makeSnapshot()
    addGoal(data, FUTURE, { topic: 'later', hours: 1, subtaskLines: '' }, TODAY)
    expect(data.goals[FUTURE]).toHaveLength(1)
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    addGoal(data, PAST, { topic: 'new', hours: 1, subtaskLines: '' }, TODAY)
    expect(data.goals[PAST]).toBeUndefined()
  })
})

describe('toggleGoal', () => {
  it('completes the goal and ALL its subtasks; returns true (confetti)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { subtasks: [makeSubtask(), makeSubtask()] })
    expect(toggleGoal(data, TODAY, g.id, TODAY)).toBe(true)
    expect(g.completed).toBe(true)
    expect(g.subtasks.every((s) => s.completed)).toBe(true)
  })
  it('un-completing returns false and leaves subtasks checked', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      completed: true,
      subtasks: [makeSubtask({ completed: true })],
    })
    expect(toggleGoal(data, TODAY, g.id, TODAY)).toBe(false)
    expect(g.completed).toBe(false)
    expect(g.subtasks[0].completed).toBe(true) // legacy only auto-checks on completion
  })
  it('rolls up subtask logged time when completing', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [makeSubtask({ loggedHours: 0.5 }), makeSubtask({ loggedHours: 1 })],
    })
    toggleGoal(data, TODAY, g.id, TODAY)
    expect(g.loggedHours).toBe(1.5)
  })
  it('is a no-op on an older read-only past day (returns false)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST)
    expect(toggleGoal(data, PAST, g.id, TODAY)).toBe(false)
    expect(g.completed).toBe(false)
  })
  it('IS allowed on yesterday (grace window: a forgotten tick can still land)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, YESTERDAY, { subtasks: [makeSubtask()] })
    expect(toggleGoal(data, YESTERDAY, g.id, TODAY)).toBe(true)
    expect(g.completed).toBe(true)
    expect(g.subtasks.every((s) => s.completed)).toBe(true)
  })
  it('will NOT un-complete a done goal on yesterday (check-off only, no rewriting the day)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, YESTERDAY, { completed: true, subtasks: [makeSubtask({ completed: true })] })
    expect(toggleGoal(data, YESTERDAY, g.id, TODAY)).toBe(false)
    expect(g.completed).toBe(true) // stays done - the grace window is one-way
    expect(g.subtasks[0].completed).toBe(true)
  })
  it('still un-completes a done goal on today (grace rule applies only to past days)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { completed: true })
    expect(toggleGoal(data, TODAY, g.id, TODAY)).toBe(false)
    expect(g.completed).toBe(false) // today is fully editable both ways
  })
  it('returns false for an unknown goal id', () => {
    const data = makeSnapshot()
    expect(toggleGoal(data, TODAY, 'nope', TODAY)).toBe(false)
  })
})

describe('toggleSubtask', () => {
  it('checking every subtask auto-completes the parent', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { subtasks: [makeSubtask(), makeSubtask()] })
    toggleSubtask(data, TODAY, g.id, g.subtasks[0].id, TODAY)
    expect(g.completed).toBe(false)
    toggleSubtask(data, TODAY, g.id, g.subtasks[1].id, TODAY)
    expect(g.completed).toBe(true)
  })
  it('unchecking a subtask re-opens the parent', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      completed: true,
      subtasks: [makeSubtask({ completed: true }), makeSubtask({ completed: true })],
    })
    toggleSubtask(data, TODAY, g.id, g.subtasks[0].id, TODAY)
    expect(g.completed).toBe(false)
  })
  it('keeps the rolled-up logged total in sync (uncheck drops, re-check restores)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [makeSubtask({ completed: true, loggedHours: 0.5 }), makeSubtask({ completed: true, loggedHours: 1.25 })],
      completed: true,
    })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBe(1.75)
    toggleSubtask(data, TODAY, g.id, g.subtasks[1].id, TODAY) // uncheck
    expect(g.loggedHours).toBe(0.5)
    expect(g.subtasks[1].loggedHours).toBe(1.25) // value preserved for later
    toggleSubtask(data, TODAY, g.id, g.subtasks[1].id, TODAY) // re-check
    expect(g.loggedHours).toBe(1.75)
  })
  it('is a no-op on an older read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { subtasks: [makeSubtask()] })
    toggleSubtask(data, PAST, g.id, g.subtasks[0].id, TODAY)
    expect(g.subtasks[0].completed).toBe(false)
  })
  it('IS allowed on yesterday (grace window)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, YESTERDAY, { subtasks: [makeSubtask(), makeSubtask()] })
    toggleSubtask(data, YESTERDAY, g.id, g.subtasks[0].id, TODAY)
    expect(g.subtasks[0].completed).toBe(true)
    toggleSubtask(data, YESTERDAY, g.id, g.subtasks[1].id, TODAY)
    expect(g.completed).toBe(true) // all subtasks done -> parent auto-completes
  })
  it('will NOT un-check a done subtask on yesterday (check-off only, parent stays done)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, YESTERDAY, {
      completed: true,
      subtasks: [makeSubtask({ completed: true }), makeSubtask({ completed: true })],
    })
    toggleSubtask(data, YESTERDAY, g.id, g.subtasks[0].id, TODAY)
    expect(g.subtasks[0].completed).toBe(true) // un-check refused
    expect(g.completed).toBe(true) // parent not re-opened
  })
})

describe('setGoalTopic / setGoalHours / setSubtaskText (live edit writes)', () => {
  it('write through on today', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { subtasks: [makeSubtask({ text: 'old' })] })
    setGoalTopic(data, TODAY, g.id, 'renamed', TODAY)
    setGoalHours(data, TODAY, g.id, 0.75, TODAY)
    setSubtaskText(data, TODAY, g.id, g.subtasks[0].id, 'edited', TODAY)
    expect(g.topic).toBe('renamed')
    expect(g.hours).toBe(0.75)
    expect(g.subtasks[0].text).toBe('edited')
  })
  it('no-op on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { topic: 'frozen', hours: 1, subtasks: [makeSubtask({ text: 'keep' })] })
    setGoalTopic(data, PAST, g.id, 'nope', TODAY)
    setGoalHours(data, PAST, g.id, 9, TODAY)
    setSubtaskText(data, PAST, g.id, g.subtasks[0].id, 'nope', TODAY)
    expect(g.topic).toBe('frozen')
    expect(g.hours).toBe(1)
    expect(g.subtasks[0].text).toBe('keep')
  })
})

describe('addEditSubtask', () => {
  it('appends an empty subtask, un-completes the goal, returns the new id', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { completed: true, subtasks: [makeSubtask({ id: 's1', completed: true })] })
    const id = addEditSubtask(data, TODAY, g.id, TODAY)
    expect(g.subtasks).toHaveLength(2)
    expect(g.subtasks[1].text).toBe('')
    expect(g.subtasks[1].completed).toBe(false)
    expect(g.subtasks[1].loggedHours).toBeNull()
    expect(g.completed).toBe(false)
    expect(id).toBe(g.subtasks[1].id)
    expect(id).not.toBe('s1')
  })
  it('returns null and does nothing on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { subtasks: [makeSubtask()] })
    expect(addEditSubtask(data, PAST, g.id, TODAY)).toBeNull()
    expect(g.subtasks).toHaveLength(1)
  })
  it('returns null for an unknown goal', () => {
    expect(addEditSubtask(makeSnapshot(), TODAY, 'nope', TODAY)).toBeNull()
  })
})

describe('removeSubtask', () => {
  it('removes and recomputes completion from what remains', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [makeSubtask({ completed: true }), makeSubtask({ completed: false })],
    })
    removeSubtask(data, TODAY, g.id, g.subtasks[1].id, TODAY)
    expect(g.subtasks).toHaveLength(1)
    expect(g.completed).toBe(true) // all remaining subtasks done
  })
  it('an emptied list must NOT flip the goal complete', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { subtasks: [makeSubtask({ completed: false })] })
    removeSubtask(data, TODAY, g.id, g.subtasks[0].id, TODAY)
    expect(g.subtasks).toHaveLength(0)
    expect(g.completed).toBe(false)
  })
  it('updates the rolled-up logged time when a logged subtask is dropped', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [makeSubtask({ completed: true, loggedHours: 0.5 }), makeSubtask({ completed: true, loggedHours: 1.25 })],
    })
    recomputeGoalLogged(g)
    removeSubtask(data, TODAY, g.id, g.subtasks[1].id, TODAY)
    expect(g.loggedHours).toBe(0.5)
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { subtasks: [makeSubtask()] })
    removeSubtask(data, PAST, g.id, g.subtasks[0].id, TODAY)
    expect(g.subtasks).toHaveLength(1)
  })
})

describe('finishEditGoal', () => {
  it('cleans the title, coerces hours, drops emptied subtasks, preserves completion', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      topic: 'New Title\n\n\n',
      hours: '' as unknown as number,
      subtasks: [
        makeSubtask({ id: 's1', text: 'keep me\n\n', completed: true }),
        makeSubtask({ id: 's2', text: '   ' }),
        makeSubtask({ id: 's3', text: '' }),
        makeSubtask({ id: 's4', text: 'also keep' }),
      ],
    })
    finishEditGoal(data, TODAY, g.id, TODAY)
    expect(g.topic).toBe('New Title')
    expect(g.hours).toBe(0)
    expect(g.subtasks.map((s) => s.text)).toEqual(['keep me', 'also keep'])
    expect(g.subtasks[0].completed).toBe(true)
    expect(g.completed).toBe(false) // not all remaining subtasks done
  })
  it('guards negative hours -> 0', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { hours: -5 })
    finishEditGoal(data, TODAY, g.id, TODAY)
    expect(g.hours).toBe(0)
  })
  it('recomputes completion when the remaining subtasks are all done', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [makeSubtask({ text: 'done', completed: true }), makeSubtask({ text: '' })],
    })
    finishEditGoal(data, TODAY, g.id, TODAY)
    expect(g.subtasks).toHaveLength(1)
    expect(g.completed).toBe(true)
  })
  it('does not auto-complete a goal whose subtasks all got dropped', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { subtasks: [makeSubtask({ text: '  ' })] })
    finishEditGoal(data, TODAY, g.id, TODAY)
    expect(g.subtasks).toHaveLength(0)
    expect(g.completed).toBe(false)
  })
  it('re-rolls the logged total after dropping a logged empty-text subtask', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [
        makeSubtask({ text: 'kept', completed: true, loggedHours: 0.5 }),
        makeSubtask({ text: '', completed: true, loggedHours: 2 }),
      ],
    })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBe(2.5)
    finishEditGoal(data, TODAY, g.id, TODAY)
    expect(g.loggedHours).toBe(0.5)
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { topic: 'messy\n\n', hours: -1 })
    finishEditGoal(data, PAST, g.id, TODAY)
    expect(g.topic).toBe('messy\n\n')
    expect(g.hours).toBe(-1)
  })
})

describe('recomputeGoalLogged', () => {
  it('is a no-op for a subtask-less goal (manual log preserved)', () => {
    const g = makeGoal({ loggedHours: 0.75, subtasks: [] })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBe(0.75)
  })
  it('sums only COMPLETED subtasks', () => {
    const g = makeGoal({
      subtasks: [makeSubtask({ completed: true, loggedHours: 0.5 }), makeSubtask({ completed: false, loggedHours: 3 })],
    })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBe(0.5)
  })
  it('nothing logged -> null (falls back to planned)', () => {
    const g = makeGoal({ loggedHours: 9, subtasks: [makeSubtask({ completed: true, loggedHours: null })] })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBeNull()
  })
  it('missing loggedHours on subtasks (legacy import) counts as 0', () => {
    const g = makeGoal({ subtasks: [{ id: 'x', text: 'x', completed: true }] })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBeNull()
  })
  it('rounds the sum to 4 decimals', () => {
    const g = makeGoal({
      subtasks: [
        makeSubtask({ completed: true, loggedHours: 0.3333 }),
        makeSubtask({ completed: true, loggedHours: 0.3333 }),
        makeSubtask({ completed: true, loggedHours: 0.3333 }),
      ],
    })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBe(0.9999)
  })
})

describe('logGoalTime (whole-goal, no subtasks)', () => {
  it('stores logged decimal hours from h+m', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { hours: 2, completed: true })
    logGoalTime(data, TODAY, g.id, 1, 15, TODAY)
    expect(g.loggedHours).toBe(1.25)
  })
  it('0h 0m stores 0 (legacy logHM semantics - no null reset)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { completed: true, loggedHours: 2 })
    logGoalTime(data, TODAY, g.id, 0, 0, TODAY)
    expect(g.loggedHours).toBe(0)
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { completed: true })
    logGoalTime(data, PAST, g.id, 3, 0, TODAY)
    expect(g.loggedHours).toBeNull()
  })
})

describe('logSubtaskTime', () => {
  it('stores the subtask time and rolls it up to the goal', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      hours: 2,
      subtasks: [makeSubtask({ completed: true }), makeSubtask()],
    })
    logSubtaskTime(data, TODAY, g.id, g.subtasks[0].id, 0, 30, TODAY)
    expect(g.subtasks[0].loggedHours).toBe(0.5)
    expect(g.loggedHours).toBe(0.5)
  })
  it('full flow: toggling + logging both subtasks sums to the goal (legacy feature suite)', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, { hours: 2, subtasks: [makeSubtask(), makeSubtask()] })
    recomputeGoalLogged(g)
    expect(g.loggedHours).toBeNull()
    toggleSubtask(data, TODAY, g.id, g.subtasks[0].id, TODAY)
    logSubtaskTime(data, TODAY, g.id, g.subtasks[0].id, 0, 30, TODAY)
    expect(g.loggedHours).toBe(0.5)
    toggleSubtask(data, TODAY, g.id, g.subtasks[1].id, TODAY)
    expect(g.completed).toBe(true) // auto-completes when every subtask is done
    logSubtaskTime(data, TODAY, g.id, g.subtasks[1].id, 1, 15, TODAY)
    expect(g.loggedHours).toBe(1.75)
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { subtasks: [makeSubtask({ completed: true })] })
    logSubtaskTime(data, PAST, g.id, g.subtasks[0].id, 2, 0, TODAY)
    expect(g.subtasks[0].loggedHours).toBeNull()
  })
})

describe('reorderGoal', () => {
  const setup = () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY, { topic: 'A' })
    seedGoalOn(data, TODAY, { topic: 'B' })
    seedGoalOn(data, TODAY, { topic: 'C' })
    return data
  }
  const topics = (data: ReturnType<typeof setup>) => data.goals[TODAY].map((g) => g.topic)

  it('moves a goal down to the target index', () => {
    const data = setup()
    reorderGoal(data, TODAY, 0, 2, TODAY)
    expect(topics(data)).toEqual(['B', 'C', 'A'])
  })
  it('moves a goal up to the front', () => {
    const data = setup()
    reorderGoal(data, TODAY, 2, 0, TODAY)
    expect(topics(data)).toEqual(['C', 'A', 'B'])
  })
  it('same index is a no-op', () => {
    const data = setup()
    reorderGoal(data, TODAY, 1, 1, TODAY)
    expect(topics(data)).toEqual(['A', 'B', 'C'])
  })
  it('ignores out-of-bounds targets', () => {
    const data = setup()
    reorderGoal(data, TODAY, 0, 5, TODAY)
    reorderGoal(data, TODAY, -1, 0, TODAY)
    expect(topics(data)).toEqual(['A', 'B', 'C'])
  })
  it('ignores a null source (legacy drag-cancel path)', () => {
    const data = setup()
    reorderGoal(data, TODAY, null as unknown as number, 1, TODAY)
    expect(topics(data)).toEqual(['A', 'B', 'C'])
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    seedGoalOn(data, PAST, { topic: 'A' })
    seedGoalOn(data, PAST, { topic: 'B' })
    reorderGoal(data, PAST, 0, 1, TODAY)
    expect(data.goals[PAST].map((g) => g.topic)).toEqual(['A', 'B'])
  })
})

describe('reorderSubtask', () => {
  const setup = () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [
        makeSubtask({ text: 'one' }),
        makeSubtask({ text: 'two' }),
        makeSubtask({ text: 'three' }),
      ],
    })
    return { data, g }
  }

  it('moves a subtask down and up', () => {
    const { data, g } = setup()
    reorderSubtask(data, TODAY, g.id, 0, 2, TODAY)
    expect(g.subtasks.map((s) => s.text)).toEqual(['two', 'three', 'one'])
    reorderSubtask(data, TODAY, g.id, 2, 0, TODAY)
    expect(g.subtasks.map((s) => s.text)).toEqual(['one', 'two', 'three'])
  })
  it('same index / out-of-bounds are no-ops', () => {
    const { data, g } = setup()
    reorderSubtask(data, TODAY, g.id, 1, 1, TODAY)
    reorderSubtask(data, TODAY, g.id, 0, 9, TODAY)
    expect(g.subtasks.map((s) => s.text)).toEqual(['one', 'two', 'three'])
  })
  it('moves the whole subtask object - completion state rides along', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY, {
      subtasks: [makeSubtask({ text: 'x', completed: true }), makeSubtask({ text: 'y', completed: false })],
    })
    reorderSubtask(data, TODAY, g.id, 1, 0, TODAY)
    expect(g.subtasks[0]).toMatchObject({ text: 'y', completed: false })
    expect(g.subtasks[1]).toMatchObject({ text: 'x', completed: true })
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST, { subtasks: [makeSubtask({ text: 'a' }), makeSubtask({ text: 'b' })] })
    reorderSubtask(data, PAST, g.id, 0, 1, TODAY)
    expect(g.subtasks.map((s) => s.text)).toEqual(['a', 'b'])
  })
})

describe('deleteGoal', () => {
  it('removes the goal', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, TODAY)
    deleteGoal(data, TODAY, g.id, TODAY)
    expect(data.goals[TODAY]).toHaveLength(0)
  })
  it('is a no-op on a read-only past day', () => {
    const data = makeSnapshot()
    const g = seedGoalOn(data, PAST)
    deleteGoal(data, PAST, g.id, TODAY)
    expect(data.goals[PAST]).toHaveLength(1)
  })
  it('ignores an unknown id', () => {
    const data = makeSnapshot()
    seedGoalOn(data, TODAY)
    deleteGoal(data, TODAY, 'nope', TODAY)
    expect(data.goals[TODAY]).toHaveLength(1)
  })
})

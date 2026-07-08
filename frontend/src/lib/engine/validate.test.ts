import { describe, expect, it } from 'vitest'
import { normalizeUsername, parseImportedSnapshot } from './validate'
import { TODAY } from './testFactories'

describe('normalizeUsername', () => {
  it('lowercases and trims', () => expect(normalizeUsername('  TestUser ')).toBe('testuser'))
  it('accepts digits, dash, underscore', () => expect(normalizeUsername('a1-b_2')).toBe('a1-b_2'))
  it('rejects path traversal', () => expect(normalizeUsername('../x')).toBe(''))
  it('rejects empty', () => expect(normalizeUsername('')).toBe(''))
  it('rejects spaces inside', () => expect(normalizeUsername('two words')).toBe(''))
  it('rejects a leading dash/underscore', () => {
    expect(normalizeUsername('-lead')).toBe('')
    expect(normalizeUsername('_lead')).toBe('')
  })
  it('accepts exactly 32 chars, rejects 33', () => {
    expect(normalizeUsername('a'.repeat(32))).toBe('a'.repeat(32))
    expect(normalizeUsername('a'.repeat(33))).toBe('')
  })
  it('rejects non-string input at runtime (legacy guard)', () => {
    expect(normalizeUsername(null as unknown as string)).toBe('')
    expect(normalizeUsername(42 as unknown as string)).toBe('')
  })
})

describe('parseImportedSnapshot', () => {
  const minimal = { install: TODAY }

  it('parses a minimal v1 file, defaulting every optional collection', () => {
    const snap = parseImportedSnapshot(minimal)
    expect(snap.install).toBe(TODAY)
    expect(snap.username).toBe('')
    expect(snap.updatedAt).toBe('')
    expect(snap.goals).toEqual({})
    expect(snap.backlog).toEqual([])
    expect(snap.recurring).toEqual([])
    expect(snap.seeded).toEqual({})
    expect(snap.carriedThrough).toBe('')
  })

  it('round-trips a realistic legacy v1 export (addingSubtask stripped, backlognedAt kept)', () => {
    const legacyFile = {
      username: 'harsh',
      install: '2026-06-01',
      updatedAt: '2026-07-01T10:00:00.000Z',
      goals: {
        '2026-07-01': [
          {
            id: 'g1',
            topic: 'Read',
            hours: 1.5,
            loggedHours: null,
            completed: false,
            subtasks: [{ id: 's1', text: 'ch 1', completed: true }], // v1 subtasks may lack loggedHours
            createdAt: '2026-07-01',
            addingSubtask: false, // v1 UI leftover
            carried: true,
          },
        ],
      },
      backlog: [
        {
          id: 'b1',
          topic: 'Later',
          hours: 1,
          loggedHours: null,
          completed: false,
          subtasks: [],
          createdAt: '2026-06-30',
          originalDate: '2026-06-30',
          backlognedAt: '2026-07-01',
          addingSubtask: false,
        },
      ],
      recurring: [
        { id: 'r1', topic: 'Walk', hours: 0.5, subtasks: [{ text: 'shoes' }], startDate: '2026-06-01', days: [1, 3, 5] },
      ],
      seeded: { '2026-07-01': ['r1'] },
      carriedThrough: '2026-06-30',
    }
    const snap = parseImportedSnapshot(legacyFile)
    expect(snap.goals['2026-07-01'][0].topic).toBe('Read')
    expect(snap.goals['2026-07-01'][0].carried).toBe(true)
    expect('addingSubtask' in snap.goals['2026-07-01'][0]).toBe(false) // stripped
    expect(snap.goals['2026-07-01'][0].subtasks[0].completed).toBe(true)
    expect(snap.backlog[0].originalDate).toBe('2026-06-30')
    expect(snap.backlog[0].backlognedAt).toBe('2026-07-01')
    expect(snap.recurring[0].days).toEqual([1, 3, 5])
    expect(snap.seeded['2026-07-01']).toEqual(['r1'])
    expect(snap.carriedThrough).toBe('2026-06-30')
  })

  it('defaults missing goal booleans/logged fields', () => {
    const snap = parseImportedSnapshot({
      ...minimal,
      goals: { [TODAY]: [{ id: 'g', topic: 'X', hours: 1, createdAt: TODAY }] },
    })
    const g = snap.goals[TODAY][0]
    expect(g.completed).toBe(false)
    expect(g.loggedHours).toBeNull()
    expect(g.subtasks).toEqual([])
  })

  it('coerces numeric-string hours (v1 tolerated strings) but rejects negatives', () => {
    // Strings must survive: a .catch(0) here once silently zeroed every
    // planned hour of a hand-edited export and persisted the damage.
    const snap = parseImportedSnapshot({
      ...minimal,
      goals: { [TODAY]: [{ id: 'g', topic: 'X', hours: '2.5', createdAt: TODAY }] },
    })
    expect(snap.goals[TODAY][0].hours).toBe(2.5)

    // Genuinely invalid values fail the whole parse instead of being mangled.
    expect(() =>
      parseImportedSnapshot({
        ...minimal,
        goals: { [TODAY]: [{ id: 'g', topic: 'X', hours: -2, createdAt: TODAY }] },
      }),
    ).toThrow()
  })

  it('throws on non-object input', () => {
    expect(() => parseImportedSnapshot(null)).toThrow()
    expect(() => parseImportedSnapshot('not json object')).toThrow()
    expect(() => parseImportedSnapshot(42)).toThrow()
  })

  it('throws when install is missing or malformed', () => {
    expect(() => parseImportedSnapshot({})).toThrow()
    expect(() => parseImportedSnapshot({ install: '07/03/2026' })).toThrow()
  })

  it('throws when a habit has an empty days array (schema demands >= 1)', () => {
    expect(() =>
      parseImportedSnapshot({
        ...minimal,
        recurring: [{ id: 'r', topic: 'X', hours: 1, subtasks: [], startDate: TODAY, days: [] }],
      }),
    ).toThrow()
  })
})

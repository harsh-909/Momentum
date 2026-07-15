import { describe, expect, it } from 'vitest'
import {
  ageLabel,
  computeMinDate,
  currentDay,
  dateStr,
  formatDisplayDate,
  isCheckable,
  isReadonly,
  isYesterday,
  nextRolloverDelay,
  parseLocalDate,
  shiftDateStr,
} from './dates'
import { makeGoal, FUTURE, PAST, TODAY, YESTERDAY } from './testFactories'

describe('dateStr / parseLocalDate', () => {
  it('formats YYYY-MM-DD zero-padded', () => {
    expect(dateStr(new Date(2026, 6, 3))).toBe('2026-07-03')
    expect(dateStr(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
  it('parseLocalDate yields LOCAL midnight (DST/UTC-safe round-trip)', () => {
    const d = parseLocalDate('2026-07-03')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(3)
    expect(d.getHours()).toBe(0)
  })
  it('round-trips every day across a DST-shift month', () => {
    // If parsing were UTC-based, some local timezones would come back a day off.
    for (const s of ['2026-03-08', '2026-03-09', '2026-11-01', '2026-11-02', '2026-01-01', '2026-12-31']) {
      expect(dateStr(parseLocalDate(s))).toBe(s)
    }
  })
})

describe('currentDay (3am logical day boundary)', () => {
  // month is 0-indexed: 6 = July
  it('00:00 reads as the previous day', () => expect(currentDay(new Date(2026, 6, 6, 0, 0))).toBe('2026-07-05'))
  it('02:30 reads as the previous day', () => expect(currentDay(new Date(2026, 6, 6, 2, 30))).toBe('2026-07-05'))
  it('exactly 03:00 flips to the new day', () => expect(currentDay(new Date(2026, 6, 6, 3, 0))).toBe('2026-07-06'))
  it('03:30 reads as the new day', () => expect(currentDay(new Date(2026, 6, 6, 3, 30))).toBe('2026-07-06'))
  it('midday reads as the same day', () => expect(currentDay(new Date(2026, 6, 6, 13, 0))).toBe('2026-07-06'))
  it('respects a custom dayStartHour', () => {
    expect(currentDay(new Date(2026, 6, 6, 4, 0), 5)).toBe('2026-07-05')
    expect(currentDay(new Date(2026, 6, 6, 0, 0), 0)).toBe('2026-07-06')
  })
  it('does not mutate the passed Date', () => {
    const now = new Date(2026, 6, 6, 1, 0)
    currentDay(now)
    expect(now.getHours()).toBe(1)
  })
})

describe('isReadonly', () => {
  it('past day is read-only', () => expect(isReadonly(PAST, TODAY)).toBe(true))
  it('today is editable', () => expect(isReadonly(TODAY, TODAY)).toBe(false))
  it('future day is editable', () => expect(isReadonly('2026-07-05', TODAY)).toBe(false))
})

describe('isYesterday', () => {
  it('is true only for the single day before today', () =>
    expect(isYesterday(YESTERDAY, TODAY)).toBe(true))
  it('is false for today', () => expect(isYesterday(TODAY, TODAY)).toBe(false))
  it('is false for two days ago', () => expect(isYesterday(PAST, TODAY)).toBe(false))
  it('is false for the future', () => expect(isYesterday(FUTURE, TODAY)).toBe(false))
  it('respects month boundaries', () => expect(isYesterday('2026-06-30', '2026-07-01')).toBe(true))
})

describe('isCheckable', () => {
  it('today and future are checkable', () => {
    expect(isCheckable(TODAY, TODAY)).toBe(true)
    expect(isCheckable(FUTURE, TODAY)).toBe(true)
  })
  it('yesterday is checkable (the grace window)', () =>
    expect(isCheckable(YESTERDAY, TODAY)).toBe(true))
  it('older past days are NOT checkable', () => expect(isCheckable(PAST, TODAY)).toBe(false))
})

describe('shiftDateStr', () => {
  it('shifts forward', () => expect(shiftDateStr('2026-07-03', 1)).toBe('2026-07-04'))
  it('shifts backward', () => expect(shiftDateStr('2026-07-03', -2)).toBe('2026-07-01'))
  it('crosses month boundaries', () => expect(shiftDateStr('2026-07-31', 1)).toBe('2026-08-01'))
  it('crosses year boundaries', () => expect(shiftDateStr('2026-01-01', -1)).toBe('2025-12-31'))
  it('handles leap February', () => expect(shiftDateStr('2028-02-28', 1)).toBe('2028-02-29'))
})

describe('ageLabel', () => {
  it('empty date -> empty label', () => expect(ageLabel('', TODAY)).toBe(''))
  it('same day -> "today"', () => expect(ageLabel(TODAY, TODAY)).toBe('today'))
  it('future date -> "today" (days <= 0)', () => expect(ageLabel('2026-07-05', TODAY)).toBe('today'))
  it('1 day -> "yesterday"', () => expect(ageLabel('2026-07-02', TODAY)).toBe('yesterday'))
  it('2..6 days -> "Nd ago"', () => {
    expect(ageLabel('2026-07-01', TODAY)).toBe('2d ago')
    expect(ageLabel('2026-06-27', TODAY)).toBe('6d ago')
  })
  it('7..29 days -> "Nw ago"', () => {
    expect(ageLabel('2026-06-26', TODAY)).toBe('1w ago') // 7 days
    expect(ageLabel('2026-06-20', TODAY)).toBe('1w ago') // 13 days
    expect(ageLabel('2026-06-04', TODAY)).toBe('4w ago') // 29 days
  })
  it('30+ days -> "Nmo ago"', () => {
    expect(ageLabel('2026-06-03', TODAY)).toBe('1mo ago') // 30 days
    expect(ageLabel('2026-04-29', TODAY)).toBe('2mo ago') // 65 days
  })
})

describe('computeMinDate', () => {
  it('no goal data -> install date', () => expect(computeMinDate(TODAY, {})).toBe(TODAY))
  it('goal dates earlier than install win (imported history)', () => {
    expect(computeMinDate(TODAY, { '2026-06-01': [makeGoal()] })).toBe('2026-06-01')
  })
  it('goal dates later than install do not move the floor', () => {
    expect(computeMinDate(PAST, { [TODAY]: [makeGoal()] })).toBe(PAST)
  })
  it('empty goal arrays are ignored', () => {
    expect(computeMinDate(TODAY, { '2026-06-01': [] })).toBe(TODAY)
  })
})

describe('nextRolloverDelay', () => {
  it('just before the boundary: fires 2s past 03:00', () => {
    expect(nextRolloverDelay(new Date(2026, 6, 6, 2, 59, 59, 0))).toBe(3000)
  })
  it('exactly at 03:00:02: schedules the NEXT day boundary', () => {
    expect(nextRolloverDelay(new Date(2026, 6, 6, 3, 0, 2, 0))).toBe(24 * 3600 * 1000)
  })
  it('midday: counts to 03:00:02 tomorrow', () => {
    // 12:00:00 -> next day 03:00:02 = 15h 0m 2s
    expect(nextRolloverDelay(new Date(2026, 6, 6, 12, 0, 0, 0))).toBe((15 * 3600 + 2) * 1000)
  })
  it('respects a custom dayStartHour', () => {
    expect(nextRolloverDelay(new Date(2026, 6, 6, 4, 59, 59, 0), 5)).toBe(3000)
  })
})

describe('formatDisplayDate', () => {
  it('empty date -> empty string', () => expect(formatDisplayDate('', TODAY)).toBe(''))
  it('appends " · Today" for today', () => {
    const s = formatDisplayDate(TODAY, TODAY)
    expect(s.endsWith(' · Today')).toBe(true)
    expect(s).toContain('Jul')
    expect(s).toContain('2026')
  })
  it('plain formatted date otherwise', () => {
    const s = formatDisplayDate(PAST, TODAY)
    expect(s).not.toContain('Today')
    expect(s).toContain('Jul')
    expect(s).toContain('1')
    expect(s).toContain('2026')
  })
})

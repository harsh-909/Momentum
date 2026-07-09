import { describe, expect, it } from 'vitest'
import { lastDayOfMonth, matchesSchedule, recurrenceLabel } from './recurrence'
import type { Recurrence } from '../../types/domain'

describe('lastDayOfMonth', () => {
  it('gives the right length for fixed-length months', () => {
    expect(lastDayOfMonth(2027, 1)).toBe(31) // Jan
    expect(lastDayOfMonth(2027, 4)).toBe(30) // Apr
    expect(lastDayOfMonth(2027, 12)).toBe(31) // Dec
  })

  it('handles February across leap and common years', () => {
    expect(lastDayOfMonth(2027, 2)).toBe(28) // common year
    expect(lastDayOfMonth(2028, 2)).toBe(29) // leap year (div by 4)
  })

  it('applies the century rule (÷100 not leap, ÷400 leap)', () => {
    expect(lastDayOfMonth(1900, 2)).toBe(28) // divisible by 100, not 400 -> common
    expect(lastDayOfMonth(2000, 2)).toBe(29) // divisible by 400 -> leap
  })
})

describe('matchesSchedule - once', () => {
  const rec: Recurrence = { freq: 'once', date: '2026-08-12' }

  it('matches the exact target date', () => {
    expect(matchesSchedule(rec, '2026-08-12')).toBe(true)
  })

  it('does not match any other date', () => {
    expect(matchesSchedule(rec, '2026-08-11')).toBe(false)
    expect(matchesSchedule(rec, '2026-08-13')).toBe(false)
  })
})

describe('matchesSchedule - weekly', () => {
  // 2026-07-09 is a Thursday (weekday 4); 2026-07-12 is Sunday (0); 2026-07-11 is Saturday (6).
  it('matches a single scheduled weekday', () => {
    const rec: Recurrence = { freq: 'weekly', days: [4] } // Thursdays
    expect(matchesSchedule(rec, '2026-07-09')).toBe(true) // Thu
    expect(matchesSchedule(rec, '2026-07-10')).toBe(false) // Fri
  })

  it('matches any of multiple scheduled weekdays', () => {
    const rec: Recurrence = { freq: 'weekly', days: [1, 4] } // Mon & Thu
    expect(matchesSchedule(rec, '2026-07-09')).toBe(true) // Thu
    expect(matchesSchedule(rec, '2026-07-06')).toBe(true) // Mon
    expect(matchesSchedule(rec, '2026-07-07')).toBe(false) // Tue
  })

  it('treats an empty day list as every day', () => {
    const rec: Recurrence = { freq: 'weekly', days: [] }
    expect(matchesSchedule(rec, '2026-07-09')).toBe(true)
    expect(matchesSchedule(rec, '2026-07-12')).toBe(true) // Sunday
  })

  it('treats an undefined day list as every day', () => {
    const rec: Recurrence = { freq: 'weekly' }
    expect(matchesSchedule(rec, '2026-07-11')).toBe(true) // Saturday
  })
})

describe('matchesSchedule - monthly', () => {
  it('dayOfMonth=1 fires only on the 1st', () => {
    const rec: Recurrence = { freq: 'monthly', dayOfMonth: 1 }
    expect(matchesSchedule(rec, '2026-07-01')).toBe(true)
    expect(matchesSchedule(rec, '2026-07-02')).toBe(false)
  })

  it('dayOfMonth=15 does not fire on the 14th or 16th', () => {
    const rec: Recurrence = { freq: 'monthly', dayOfMonth: 15 }
    expect(matchesSchedule(rec, '2026-07-15')).toBe(true)
    expect(matchesSchedule(rec, '2026-07-14')).toBe(false)
    expect(matchesSchedule(rec, '2026-07-16')).toBe(false)
  })

  it('dayOfMonth=31 fires on Jan 31, clamps to Feb-end and Apr 30', () => {
    const rec: Recurrence = { freq: 'monthly', dayOfMonth: 31 }
    expect(matchesSchedule(rec, '2026-01-31')).toBe(true)
    expect(matchesSchedule(rec, '2027-02-28')).toBe(true) // common-year Feb last day
    expect(matchesSchedule(rec, '2028-02-29')).toBe(true) // leap-year Feb last day
    expect(matchesSchedule(rec, '2026-04-30')).toBe(true) // 30-day month last day
    expect(matchesSchedule(rec, '2026-04-29')).toBe(false)
  })

  it('both the 30th and 31st clamp onto Feb 28 in a common year', () => {
    const thirtieth: Recurrence = { freq: 'monthly', dayOfMonth: 30 }
    const thirtyFirst: Recurrence = { freq: 'monthly', dayOfMonth: 31 }
    expect(matchesSchedule(thirtieth, '2027-02-28')).toBe(true)
    expect(matchesSchedule(thirtyFirst, '2027-02-28')).toBe(true)
  })
})

describe('matchesSchedule - yearly', () => {
  it('matches an exact month and day', () => {
    const rec: Recurrence = { freq: 'yearly', month: 3, dayOfMonth: 3 }
    expect(matchesSchedule(rec, '2026-03-03')).toBe(true)
    expect(matchesSchedule(rec, '2026-03-04')).toBe(false)
  })

  it('does not match a different month even on the same day', () => {
    const rec: Recurrence = { freq: 'yearly', month: 3, dayOfMonth: 3 }
    expect(matchesSchedule(rec, '2026-04-03')).toBe(false)
  })

  it('Feb-29 yearly clamps to Feb 28 in common years, Feb 29 in leap years', () => {
    const rec: Recurrence = { freq: 'yearly', month: 2, dayOfMonth: 29 }
    expect(matchesSchedule(rec, '2027-02-28')).toBe(true) // common year -> clamped
    expect(matchesSchedule(rec, '2028-02-29')).toBe(true) // leap year -> real Feb 29
    expect(matchesSchedule(rec, '2028-02-28')).toBe(false) // in a leap year the 28th is not the target
  })
})

describe('matchesSchedule - defensive (missing fields)', () => {
  it('returns false without throwing', () => {
    expect(matchesSchedule({ freq: 'once' }, '2026-07-09')).toBe(false)
    expect(matchesSchedule({ freq: 'monthly' }, '2026-07-09')).toBe(false)
    expect(matchesSchedule({ freq: 'yearly', dayOfMonth: 3 }, '2026-07-09')).toBe(false) // no month
    expect(matchesSchedule({ freq: 'yearly', month: 7 }, '2026-07-09')).toBe(false) // no dayOfMonth
    // @ts-expect-error unknown freq is defensively rejected
    expect(matchesSchedule({ freq: 'nonsense' }, '2026-07-09')).toBe(false)
  })
})

describe('recurrenceLabel', () => {
  it('labels a once rule with an absolute date', () => {
    expect(recurrenceLabel({ freq: 'once', date: '2026-08-12' })).toBe('Once on Aug 12, 2026')
  })

  it('labels a weekly rule using the habit phrasing', () => {
    expect(recurrenceLabel({ freq: 'weekly', days: [1, 3] })).toBe('Mon, Wed')
    expect(recurrenceLabel({ freq: 'weekly', days: [] })).toBe('Every day')
  })

  it('labels a monthly rule with an ordinal day', () => {
    expect(recurrenceLabel({ freq: 'monthly', dayOfMonth: 31 })).toBe('Monthly on the 31st')
  })

  it('labels a yearly rule with month and day', () => {
    expect(recurrenceLabel({ freq: 'yearly', month: 3, dayOfMonth: 3 })).toBe('Every year on Mar 3')
  })
})

/**
 * Recurrence scheduling (foundation for future scheduled goals/habits).
 *
 * Pure and deterministic: callers pass the date in as a `YYYY-MM-DD` string, so
 * these functions never read the wall clock. A `Recurrence` describes WHEN an
 * item is due; `matchesSchedule` answers "is it due on this exact date?".
 *
 * Month-end handling is deliberate: a monthly/yearly rule pinned to a day that
 * a given month lacks (e.g. the 31st in April, or Feb 29 in a common year)
 * fires on that month's LAST day instead. See `matchesSchedule` for the
 * intended consequences of that clamp.
 */
import { parseLocalDate } from './dates'
import type { DateStr, Recurrence, Weekday } from '../../types/domain'

/** Every weekday - the weekly default when no days are specified (mirrors habits.ts). */
const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Proleptic Gregorian leap-year rule: every 4th year, except centuries not divisible by 400. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Last calendar day (28..31) of the given month; month1 is 1..12. */
export function lastDayOfMonth(year: number, month1: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month1 === 2 && isLeapYear(year)) return 29
  return lengths[month1 - 1]
}

/** JS weekday (0=Sun..6=Sat) of a local date string. */
function weekdayOf(date: DateStr): number {
  return parseLocalDate(date).getDay()
}

/** Cap a requested day-of-month at the month's real last day (never rolls into the next month). */
function clamp(day: number, lastDay: number): number {
  return Math.min(day, lastDay)
}

/**
 * True iff `rec` schedules an occurrence on `date` (exact day, not "on or after").
 *
 * - once:    exact string match against `rec.date`.
 * - weekly:  the date's weekday is in `rec.days` (empty/undefined => every day).
 * - monthly: the date's day-of-month equals `rec.dayOfMonth` clamped to that
 *            month's last day. Consequence of the clamp: in a non-leap Feb, a
 *            rule for the 29th, 30th AND 31st all fire on Feb 28. This is intended.
 * - yearly:  the date's month equals `rec.month` AND its day equals
 *            `rec.dayOfMonth` clamped to that month's last day. Consequence: a
 *            Feb-29 yearly rule fires on Feb 28 in common years and Feb 29 in leap years.
 *
 * Any required field missing for the freq returns false rather than throwing.
 */
export function matchesSchedule(rec: Recurrence, date: DateStr): boolean {
  switch (rec.freq) {
    case 'once':
      return !!rec.date && rec.date === date

    case 'weekly': {
      const days = rec.days && rec.days.length ? rec.days : ALL_DAYS
      return (days as number[]).includes(weekdayOf(date))
    }

    case 'monthly': {
      if (rec.dayOfMonth == null) return false
      const d = parseLocalDate(date)
      const last = lastDayOfMonth(d.getFullYear(), d.getMonth() + 1)
      return d.getDate() === clamp(rec.dayOfMonth, last)
    }

    case 'yearly': {
      if (rec.dayOfMonth == null || rec.month == null) return false
      const d = parseLocalDate(date)
      if (d.getMonth() + 1 !== rec.month) return false
      const last = lastDayOfMonth(d.getFullYear(), rec.month)
      return d.getDate() === clamp(rec.dayOfMonth, last)
    }

    default:
      return false
  }
}

/** English ordinal suffix: 1st, 2nd, 3rd, 4th, 11th, 21st, 31st. */
function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const rem100 = n % 100
  return n + (suffixes[(rem100 - 20) % 10] || suffixes[rem100] || suffixes[0])
}

/** Short absolute date, e.g. "Aug 12, 2026". */
function formatShortDate(date: DateStr): string {
  return parseLocalDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Weekly schedule label: "Every day" | "Weekdays" | "Weekends" | "Mon, Wed".
 * Kept identical to habits.ts `scheduleLabel`; in Part 2 that function should
 * delegate here so there is a single source of truth (recurrence is the lower layer).
 */
function weeklyLabel(days: number[]): string {
  const d = days && days.length ? days : ALL_DAYS
  if (d.length === 7) return 'Every day'
  if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return 'Weekdays'
  if (d.length === 2 && [0, 6].every((x) => d.includes(x))) return 'Weekends'
  return d
    .slice()
    .sort((a, b) => a - b)
    .map((i) => WEEKDAY_NAMES[i])
    .join(', ')
}

/**
 * Short human label for UI, e.g. "Once on Aug 12, 2026", "Weekdays",
 * "Monthly on the 31st", "Every year on Mar 3". Missing fields degrade to a
 * bare freq word rather than throwing.
 */
export function recurrenceLabel(rec: Recurrence): string {
  switch (rec.freq) {
    case 'once':
      return rec.date ? `Once on ${formatShortDate(rec.date)}` : 'Once'

    case 'weekly':
      // Habit phrasing ("Every day"/"Weekdays"/"Weekends"/"Mon, Wed").
      return weeklyLabel(rec.days ?? [])

    case 'monthly':
      return rec.dayOfMonth != null ? `Monthly on the ${ordinal(rec.dayOfMonth)}` : 'Monthly'

    case 'yearly':
      return rec.dayOfMonth != null && rec.month != null
        ? `Every year on ${MONTH_NAMES[rec.month - 1]} ${rec.dayOfMonth}`
        : 'Yearly'

    default:
      return ''
  }
}

/**
 * Date helpers (ported from legacy/app.js).
 *
 * Dates are ALWAYS zero-padded `YYYY-MM-DD` local-date strings in state, so
 * plain string comparison orders them correctly. Parse to a real Date only
 * via parseLocalDate (local midnight - avoids the UTC off-by-one that
 * `new Date('YYYY-MM-DD')` would introduce).
 */
import { DAY_START_HOUR } from '../../types/domain'
import type { DateStr, Goal } from '../../types/domain'

/** Format a Date as a local `YYYY-MM-DD` string. */
export function dateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse a `YYYY-MM-DD` string as LOCAL midnight (never UTC). */
export function parseLocalDate(s: DateStr): Date {
  return new Date(s + 'T00:00:00')
}

/**
 * The logical current day. A day flips at dayStartHour (03:00) local, so we
 * shift the clock back by that many hours before taking the date - anything
 * before 3am still reads as the previous day.
 */
export function currentDay(now: Date, dayStartHour: number = DAY_START_HOUR): DateStr {
  const d = new Date(now.getTime())
  d.setHours(d.getHours() - dayStartHour)
  return dateStr(d)
}

/**
 * Past days are a frozen, read-only record. Only today and future days can
 * be mutated. String compare is safe on zero-padded YYYY-MM-DD.
 */
export function isReadonly(date: DateStr, today: DateStr): boolean {
  return date < today
}

/** Shift a date string by whole days (DST-safe via local-midnight parse). */
export function shiftDateStr(date: DateStr, delta: number): DateStr {
  const d = parseLocalDate(date)
  d.setDate(d.getDate() + delta)
  return dateStr(d)
}

/** Human age of a past date: today | yesterday | Nd ago | Nw ago | Nmo ago. */
export function ageLabel(date: DateStr, today: DateStr): string {
  if (!date) return ''
  const a = parseLocalDate(date)
  const b = parseLocalDate(today)
  const days = Math.round((b.getTime() - a.getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return days + 'd ago'
  if (days < 30) return Math.floor(days / 7) + 'w ago'
  return Math.floor(days / 30) + 'mo ago'
}

/**
 * Navigation floor: the earlier of the install date and the earliest date
 * that actually has goals (imported data can predate install).
 */
export function computeMinDate(install: DateStr, goals: Record<DateStr, Goal[]>): DateStr {
  const dataDates = Object.keys(goals).filter((d) => (goals[d] || []).length > 0)
  return dataDates.length ? [install, ...dataDates].sort()[0] : install
}

/**
 * Milliseconds until 2 seconds past the next dayStartHour boundary (the live
 * rollover timer fires slightly late so the new day is unambiguous).
 */
export function nextRolloverDelay(now: Date, dayStartHour: number = DAY_START_HOUR): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), dayStartHour, 0, 2, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

/** "Fri, Jul 3, 2026", with " · Today" appended when the date is today. */
export function formatDisplayDate(date: DateStr, today: DateStr): string {
  if (!date) return ''
  const s = parseLocalDate(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (date === today) return s + ' · Today'
  return s
}

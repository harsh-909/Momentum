import { describe, expect, it } from 'vitest'
import { clampHours, fmtDuration, hmToHours, hoursPart, minsPart } from './time'

describe('hmToHours', () => {
  it('combines 1h 30m -> 1.5', () => expect(hmToHours(1, 30)).toBe(1.5))
  it('combines 0h 45m -> 0.75', () => expect(hmToHours(0, 45)).toBe(0.75))
  it('combines 2h 0m -> 2', () => expect(hmToHours(2, 0)).toBe(2))
  it('treats blanks as 0 (legacy form fields pass strings)', () => {
    expect(hmToHours('' as unknown as number, '' as unknown as number)).toBe(0)
  })
  it('floors negatives to 0', () => expect(hmToHours(-3, -10)).toBe(0))
  it('floors fractional field values (1.5h field -> 1h)', () => expect(hmToHours(1.5, 0)).toBe(1))
  it('rounds the decimal to 4 places (0h 20m)', () => expect(hmToHours(0, 20)).toBe(0.3333))
  it('treats NaN as 0', () => expect(hmToHours(NaN, NaN)).toBe(0))
})

describe('hoursPart / minsPart', () => {
  it('splits 1.5 into 1h', () => expect(hoursPart(1.5)).toBe(1))
  it('splits 1.5 into 30m', () => expect(minsPart(1.5)).toBe(30))
  it('handles legacy quarter-hour values (0.25 -> 15m)', () => expect(minsPart(0.25)).toBe(15))
  it('round-trips through hmToHours', () => expect(hmToHours(hoursPart(2.75), minsPart(2.75))).toBe(2.75))
  it('rounds minutes to the nearest int (0.3333 -> 20m)', () => expect(minsPart(0.3333)).toBe(20))
  it('guards float artifacts with an epsilon (1.9999999999999998 -> 2h 0m)', () => {
    const v = 1.9999999999999998
    expect(hoursPart(v)).toBe(2)
    expect(minsPart(v)).toBe(0)
  })
  it('treats non-numeric as 0', () => {
    expect(hoursPart(undefined as unknown as number)).toBe(0)
    expect(minsPart(undefined as unknown as number)).toBe(0)
  })
})

describe('fmtDuration', () => {
  it('renders mixed hours+minutes', () => expect(fmtDuration(1.5)).toBe('1h 30m'))
  it('renders whole hours without minutes', () => expect(fmtDuration(2)).toBe('2h'))
  it('renders sub-hour values as minutes', () => expect(fmtDuration(0.75)).toBe('45m'))
  it('renders zero as "0m"', () => expect(fmtDuration(0)).toBe('0m'))
  it('never renders 60m: 1.999 -> "2h"', () => expect(fmtDuration(1.999)).toBe('2h'))
  it('never renders 60m: 0.999 -> "1h"', () => expect(fmtDuration(0.999)).toBe('1h'))
  it('rounds via total minutes (1.008 -> "1h")', () => expect(fmtDuration(1.008)).toBe('1h'))
  it('treats non-numeric as 0', () => expect(fmtDuration(NaN)).toBe('0m'))
})

describe('clampHours', () => {
  it('passes finite positives through', () => expect(clampHours(2.5)).toBe(2.5))
  it('keeps zero', () => expect(clampHours(0)).toBe(0))
  it('clamps negatives to 0', () => expect(clampHours(-5)).toBe(0))
  it('clamps NaN to 0', () => expect(clampHours(NaN)).toBe(0))
  it('clamps an empty string (cleared field) to 0', () => expect(clampHours('')).toBe(0))
  it('parses numeric strings like the legacy parseFloat did', () => expect(clampHours('2.5')).toBe(2.5))
  it('clamps undefined/null to 0', () => {
    expect(clampHours(undefined)).toBe(0)
    expect(clampHours(null)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { greetingForHour, isEvening, QUOTES, quoteForDate } from './copy'

describe('QUOTES', () => {
  it('is the exact v1 list, same order (the daily pick must stay stable)', () => {
    expect(QUOTES).toEqual([
      "Small steps every day add up to big results.",
      "Discipline is choosing between what you want now and what you want most.",
      "You don't have to be extreme, just consistent.",
      "The secret of getting ahead is getting started.",
      "A goal without a plan is just a wish.",
      "Done is better than perfect.",
      "Success is the sum of small efforts repeated day in and day out.",
      "What you do today can improve all your tomorrows.",
      "Focus on being productive instead of busy.",
      "The future depends on what you do today.",
    ])
  })
})

describe('quoteForDate', () => {
  it('keys off the day of the month, mod 10', () => {
    expect(quoteForDate(new Date(2026, 6, 3))).toBe(QUOTES[3])
    expect(quoteForDate(new Date(2026, 6, 10))).toBe(QUOTES[0])
    expect(quoteForDate(new Date(2026, 6, 31))).toBe(QUOTES[1]) // 31 % 10
    expect(quoteForDate(new Date(2026, 6, 9))).toBe(QUOTES[9])
  })
  it('is stable across the same day regardless of time', () => {
    expect(quoteForDate(new Date(2026, 6, 3, 0, 1))).toBe(quoteForDate(new Date(2026, 6, 3, 23, 59)))
  })
})

describe('greetingForHour (v1 thresholds, verbatim strings)', () => {
  it('before 5am: midnight oil', () => {
    expect(greetingForHour(0)).toBe('Burning the midnight oil')
    expect(greetingForHour(4)).toBe('Burning the midnight oil')
  })
  it('5-11: morning', () => {
    expect(greetingForHour(5)).toBe('Good morning')
    expect(greetingForHour(11)).toBe('Good morning')
  })
  it('12-16: afternoon', () => {
    expect(greetingForHour(12)).toBe('Good afternoon')
    expect(greetingForHour(16)).toBe('Good afternoon')
  })
  it('17-20: evening', () => {
    expect(greetingForHour(17)).toBe('Good evening')
    expect(greetingForHour(20)).toBe('Good evening')
  })
  it('21-23: winding down', () => {
    expect(greetingForHour(21)).toBe('Winding down')
    expect(greetingForHour(23)).toBe('Winding down')
  })
})

describe('isEvening', () => {
  it('true from 8pm', () => {
    expect(isEvening(20)).toBe(true)
    expect(isEvening(23)).toBe(true)
  })
  it('true before 4am (late-night session)', () => {
    expect(isEvening(0)).toBe(true)
    expect(isEvening(3)).toBe(true)
  })
  it('false during the day', () => {
    expect(isEvening(4)).toBe(false)
    expect(isEvening(12)).toBe(false)
    expect(isEvening(19)).toBe(false)
  })
})

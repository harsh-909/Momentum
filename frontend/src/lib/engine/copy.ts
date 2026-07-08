/**
 * UI copy: the v1 quote rotation and time-of-day greeting (ported from
 * legacy/app.js quotes / pickQuote / greeting / isEvening).
 */

/** The 10 v1 quotes, same order - the daily pick must stay stable. */
export const QUOTES: string[] = [
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
]

/** Deterministic daily quote: keyed by day-of-month so it holds all day. */
export function quoteForDate(d: Date): string {
  return QUOTES[d.getDate() % QUOTES.length]
}

/** Time-of-day greeting (v1 thresholds and strings, verbatim). */
export function greetingForHour(h: number): string {
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Winding down'
}

/** Evening mode ("add a goal for tomorrow" copy): 8pm through 4am. */
export function isEvening(h: number): boolean {
  return h >= 20 || h < 4
}

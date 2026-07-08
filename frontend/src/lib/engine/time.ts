/**
 * Time representation helpers (ported from legacy/app.js "Time helpers").
 *
 * Time is stored as decimal hours everywhere in state; the UI enters and
 * shows it as hours + minutes. These convert between the two.
 */

/** Combine hours + minutes fields into decimal hours. Blanks/negatives floor to 0. */
export function hmToHours(h: number, m: number): number {
  const hh = Math.max(0, Math.floor(Number(h) || 0))
  const mm = Math.max(0, Math.floor(Number(m) || 0))
  return +(hh + mm / 60).toFixed(4)
}

/** Whole-hours part of a decimal-hours value (epsilon guards float artifacts). */
export function hoursPart(dec: number): number {
  return Math.floor((Number(dec) || 0) + 1e-9)
}

/** Minutes part of a decimal-hours value, rounded to the nearest minute. */
export function minsPart(dec: number): number {
  // `|| 0` normalizes the -0 that Math.round yields for tiny negative floats.
  return Math.round(((Number(dec) || 0) - hoursPart(dec)) * 60) || 0
}

/**
 * Render decimal hours as "1h 30m" / "45m" / "2h".
 * Computed via total minutes so 1.999h renders "2h", never "1h 60m".
 */
export function fmtDuration(dec: number): string {
  const total = Math.round((Number(dec) || 0) * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/**
 * Guard an hours field against a cleared/garbage/negative value:
 * NaN or negative -> 0. Mirrors legacy stopEditGoal's parseFloat guard.
 */
export function clampHours(n: unknown): number {
  const h = typeof n === 'number' ? n : Number.parseFloat(String(n))
  return Number.isNaN(h) || h < 0 ? 0 : h
}

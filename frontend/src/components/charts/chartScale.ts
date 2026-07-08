/**
 * Scale math for the hand-rolled SVG charts (no chart library by design -
 * the three Metrics canvases from v1 are re-drawn as pure SVG).
 */

/**
 * "Nice" ascending y-axis ticks from 0 up to (at least) `maxValue`, using
 * 1/2/5 x 10^k steps so goal counts stay integers and hours stay clean.
 * Non-finite / non-positive input falls back to a 0..1 axis.
 */
export function niceTicks(maxValue: number, targetCount = 4): number[] {
  const max = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1
  const count = Math.max(1, Math.floor(targetCount))
  const rawStep = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  // Top tick: first multiple of step at or above max (epsilon-guarded).
  const top = Math.ceil(max / step - 1e-9) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(10))
  return ticks
}

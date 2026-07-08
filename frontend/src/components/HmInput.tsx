/**
 * Paired h + m number inputs over a single decimal-hours value.
 *
 * Conversion mirrors v1 hoursPart/minsPart semantics (implemented locally on
 * purpose - the engine is a parallel workstream): hours = floor(dec + eps),
 * minutes = round((dec - hours) * 60). Output is h + m/60, with h floored at
 * 0 (v1 data legitimately holds >24h values) and m clamped to 0-55.
 */

export function hoursPart(dec: number): number {
  return Math.floor((Number(dec) || 0) + 1e-9)
}

export function minsPart(dec: number): number {
  // `|| 0` normalizes the -0 that float noise like 1.9999... can produce.
  return Math.round(((Number(dec) || 0) - hoursPart(dec)) * 60) || 0
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export interface HmInputProps {
  /** Decimal hours. */
  valueHours: number
  onChange: (dec: number) => void
  disabled?: boolean
  autoFocus?: boolean
  /** Accessible name prefix; renders as "<label> hours" / "<label> minutes". */
  label?: string
  className?: string
}

const INPUT_CLS =
  'w-11 rounded-btn border border-line bg-face px-1.5 py-1 text-center text-xs font-mono-num text-ink transition-colors duration-150 ease-click focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export function HmInput({
  valueHours,
  onChange,
  disabled = false,
  autoFocus = false,
  label = 'time',
  className = '',
}: HmInputProps) {
  const h = hoursPart(valueHours)
  const m = minsPart(valueHours)

  const commit = (nextH: number, nextM: number) => {
    // Hours only floor at 0 - v1 data can hold >24h and must round-trip.
    onChange(clamp(nextH, 0, Infinity) + clamp(nextM, 0, 55) / 60)
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={24}
        step={1}
        value={h}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={`${label} hours`}
        onChange={(e) => commit(Number(e.target.value), m)}
        className={INPUT_CLS}
      />
      <span className="text-xs text-muted">h</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={55}
        step={5}
        value={m}
        disabled={disabled}
        aria-label={`${label} minutes`}
        onChange={(e) => commit(h, Number(e.target.value))}
        className={INPUT_CLS}
      />
      <span className="text-xs text-muted">m</span>
    </span>
  )
}

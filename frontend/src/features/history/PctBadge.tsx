/**
 * Day-score chip: partial-credit percentage on a status-tinted background.
 * 100 = good (only a truly perfect day reaches 100 - dayProgressPct caps
 * partial days at 99), >=50 = warn, below = alert.
 *
 * Tinted fill + status-text ink instead of a solid fill: solid good/alert
 * with white text fails AA at this size in both themes.
 */

export function PctBadge({ pct }: { pct: number }) {
  const grade = pct === 100 ? 'good' : pct >= 50 ? 'warn' : 'alert'
  return (
    <span
      data-grade={grade}
      className="inline-flex shrink-0 items-center rounded-badge px-1.5 py-0.5 text-xs font-mono-num font-semibold"
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-${grade}) 18%, var(--color-face))`,
        color: `var(--color-${grade}-text)`,
      }}
    >
      {pct}%
    </span>
  )
}

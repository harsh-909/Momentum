import { DialTicks } from '../../components/EmptyState'

/**
 * Decorative hero chronograph for the landing page. Mirrors the real
 * DaySummaryDial's visual language (60-tick frame, per-goal arc segments,
 * a sweep hand, centered percent readout) but is fully static - it takes no
 * data and never renders in the app itself, so it is safe to hand-tune the
 * numbers purely for looks. Theme-aware via the design tokens.
 */

const CX = 50
const CY = 50
const RING_R = 34
const RING_W = 5
const GAP_DEG = 2

// A pleasant, believable "good day so far": four goals, three of them well
// along, summing to a 72% sweep.
const SEGMENTS = [1, 0.8, 0.55, 0]
const SWEEP_PCT = 72

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
}

function arcPath(r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(r, startDeg)
  const [ex, ey] = polar(r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${sx.toFixed(3)} ${sy.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`
}

export function HeroDial({ className = '' }: { className?: string }) {
  const segSpan = 360 / SEGMENTS.length
  const sweepDeg = (SWEEP_PCT / 100) * 360

  return (
    <div className={`relative ${className}`} role="img" aria-label="Momentum's day dial, part-way through a day">
      <DialTicks className="absolute inset-0 h-full w-full text-ink opacity-[0.15]" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {SEGMENTS.map((fill, i) => {
          const start = i * segSpan + GAP_DEG / 2
          const end = (i + 1) * segSpan - GAP_DEG / 2
          const filledEnd = start + (end - start) * fill
          return (
            <g key={i}>
              <path
                d={arcPath(RING_R, start, end)}
                fill="none"
                strokeWidth={RING_W}
                strokeLinecap="butt"
                style={{ stroke: 'var(--color-line)' }}
              />
              {filledEnd - start >= 1 && (
                <path
                  d={arcPath(RING_R, start, filledEnd)}
                  fill="none"
                  strokeWidth={RING_W}
                  strokeLinecap="butt"
                  style={{ stroke: 'var(--color-accent)' }}
                />
              )}
            </g>
          )
        })}
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - RING_R}
          strokeWidth={1}
          style={{
            stroke: 'var(--color-accent)',
            transform: `rotate(${sweepDeg}deg)`,
            transformOrigin: '50px 50px',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <div className="font-mono-num font-semibold leading-none text-ink" style={{ fontSize: '28%' }}>
          {SWEEP_PCT}
          <span style={{ fontSize: '55%' }}>%</span>
        </div>
        <div className="label-caps font-display text-muted" style={{ fontSize: '9%', marginTop: '2%' }}>
          of day
        </div>
      </div>
    </div>
  )
}

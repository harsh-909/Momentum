/**
 * The signature element: a ~96px chronograph face summarizing the day.
 *
 * - 60 fine outer ticks (static frame, ink at 15%).
 * - Progress ring: one arc segment per goal (equal angular share, 2 degree
 *   gaps); each segment fills proportionally to goalProgress. A fully
 *   complete day renders as one unified solid ring.
 * - Hairline sweep hand at the total-progress angle (400ms --ease-sweep;
 *   the global reduced-motion rule clamps it).
 * - Three mono stat readouts beside the face.
 */
import { Card } from '../../components/Card'
import { DialTicks } from '../../components/EmptyState'
import { computeDayStats, goalProgress } from '../../lib/engine/scoring'
import { fmtDuration } from '../../lib/engine/time'
import type { Goal } from '../../types/domain'

const CX = 50
const CY = 50
const RING_R = 33
const RING_W = 5
const GAP_DEG = 2

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

function Stat({ value, caption, valueClass = 'text-ink' }: { value: string; caption: string; valueClass?: string }) {
  return (
    <div>
      <div className={`font-mono-num text-base font-medium ${valueClass}`}>{value}</div>
      <div className="label-caps mt-0.5 font-display text-[10px] text-muted">{caption}</div>
    </div>
  )
}

export function DaySummaryDial({ goals }: { goals: Goal[] }) {
  const stats = computeDayStats(goals)
  const allComplete = stats.total > 0 && stats.completed === stats.total
  const sweepDeg = (stats.pct / 100) * 360
  const segSpan = stats.total > 0 ? 360 / stats.total : 360

  return (
    <Card className="flex items-center gap-5">
      <div
        role="img"
        aria-label={`Day ${stats.pct}% complete, ${stats.completed} of ${stats.total} goals done`}
        className="relative h-24 w-24 shrink-0"
      >
        <DialTicks className="absolute inset-0 h-full w-full text-ink opacity-[0.15]" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {stats.total === 0 && (
            <circle
              cx={CX}
              cy={CY}
              r={RING_R}
              fill="none"
              strokeWidth={RING_W}
              style={{ stroke: 'var(--color-line)' }}
            />
          )}

          {allComplete && (
            <circle
              data-ring-complete
              cx={CX}
              cy={CY}
              r={RING_R}
              fill="none"
              strokeWidth={RING_W}
              style={{ stroke: 'var(--color-accent)' }}
            />
          )}

          {!allComplete &&
            goals.map((g, i) => {
              const start = i * segSpan + GAP_DEG / 2
              const end = (i + 1) * segSpan - GAP_DEG / 2
              const filledEnd = start + (end - start) * goalProgress(g)
              return (
                <g key={g.id} data-segment>
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

          {stats.total > 0 && (
            <line
              data-sweep-hand
              x1={CX}
              y1={CY}
              x2={CX}
              y2={CY - RING_R}
              strokeWidth={1}
              style={{
                stroke: 'var(--color-accent)',
                transform: `rotate(${sweepDeg}deg)`,
                transformOrigin: '50px 50px',
                transition: 'transform 400ms var(--ease-sweep)',
              }}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <div className="font-mono-num text-[22px] font-semibold leading-none text-ink">
            {stats.pct}
            <span className="text-[11px] font-medium">%</span>
          </div>
          <div className="label-caps mt-1 font-display text-[8px] text-muted">of day</div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2 text-center min-[400px]:grid-cols-3">
        <Stat value={`${stats.completed}/${stats.total}`} caption="Goals done" />
        <Stat value={fmtDuration(stats.hours)} caption="Planned" valueClass="text-warn-text" />
        <Stat value={fmtDuration(stats.doneHours)} caption="Logged" valueClass="text-good-text" />
      </div>
    </Card>
  )
}

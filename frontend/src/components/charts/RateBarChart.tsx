/**
 * Last-4-weeks completion rate. One bar per week, colored by grade
 * (>=80 good, >=50 warn, otherwise alert) on a fixed 0-100% axis.
 * Each cap carries its value so the grade color never stands alone.
 * Data comes from engine metrics weeklySeries.
 */
import { Fragment } from 'react'
import { barPath, ChartFrame, sweepStyle, useSweepIn } from './ChartFrame'

export interface RateBarDatum {
  label: string
  pct: number
}

const Y_TICKS = [0, 25, 50, 75, 100]

export function gradeColor(pct: number): string {
  if (pct >= 80) return 'var(--color-good)'
  if (pct >= 50) return 'var(--color-warn)'
  return 'var(--color-alert)'
}

export function RateBarChart({ data }: { data: RateBarDatum[] }) {
  const on = useSweepIn()
  const ariaLabel = `Completion rate, last 4 weeks: ${data
    .map((d) => `${d.label} ${d.pct}%`)
    .join(', ')}.`

  return (
    <div>
      <ChartFrame
        yTicks={Y_TICKS}
        yFormat={(v) => `${v}%`}
        xLabels={data.map((d) => d.label)}
        ariaLabel={ariaLabel}
        padTop={18}
      >
        {({ y, band, plot }) => {
          const baseY = plot.y + plot.h
          return data.map((d, i) => {
            const { cx, w } = band(i)
            const bw = Math.min(24, w * 0.4)
            return (
              <Fragment key={`${d.label}-${i}`}>
                {d.pct > 0 && (
                  <path
                    data-bar="rate"
                    d={barPath(cx - bw / 2, y(d.pct), bw, baseY - y(d.pct))}
                    fill={gradeColor(d.pct)}
                    style={sweepStyle(on)}
                  />
                )}
                {/* Value on the cap, in a text token (never the grade color). */}
                <text
                  x={cx}
                  y={y(d.pct) - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-muted)"
                  className="font-mono-num"
                >
                  {d.pct}%
                </text>
              </Fragment>
            )
          })
        }}
      </ChartFrame>

      <table className="sr-only">
        <caption>Completion rate, last 4 weeks</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Completion</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{d.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

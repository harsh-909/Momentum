/**
 * Last-7-days completed-vs-planned goals. Per day: a track bar in the
 * hairline color at the planned (total) height with the completed bar in
 * chronograph orange on top. Data comes from engine metrics dailySeries.
 */
import { Fragment } from 'react'
import { niceTicks } from './chartScale'
import { barPath, ChartFrame, sweepStyle, useSweepIn } from './ChartFrame'

export interface BarPairDatum {
  label: string
  completed: number
  total: number
}

export function BarPairChart({ data }: { data: BarPairDatum[] }) {
  const on = useSweepIn()
  const maxTotal = Math.max(0, ...data.map((d) => d.total))
  const yTicks = niceTicks(maxTotal, Math.min(4, Math.max(1, maxTotal)))
  const done = data.reduce((s, d) => s + d.completed, 0)
  const total = data.reduce((s, d) => s + d.total, 0)
  const ariaLabel = `Completed versus planned goals, last 7 days: ${done} of ${total} goals completed.`

  return (
    <div>
      <ChartFrame yTicks={yTicks} xLabels={data.map((d) => d.label)} ariaLabel={ariaLabel}>
        {({ y, band, plot }) => {
          const baseY = plot.y + plot.h
          return data.map((d, i) => {
            const { cx, w } = band(i)
            const bw = Math.min(24, w * 0.5)
            const x = cx - bw / 2
            return (
              <Fragment key={`${d.label}-${i}`}>
                {d.total > 0 && (
                  <path
                    data-bar="total"
                    d={barPath(x, y(d.total), bw, baseY - y(d.total))}
                    fill="var(--color-line)"
                    style={sweepStyle(on)}
                  />
                )}
                {d.completed > 0 && (
                  <path
                    data-bar="completed"
                    d={barPath(x, y(d.completed), bw, baseY - y(d.completed))}
                    fill="var(--color-accent)"
                    style={sweepStyle(on)}
                  />
                )}
              </Fragment>
            )
          })
        }}
      </ChartFrame>

      {/* Two series -> identity never rides on color alone. */}
      <div className="mt-1 flex items-center justify-end gap-4" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Completed
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-line)' }} />
          Planned
        </span>
      </div>

      <table className="sr-only">
        <caption>Completed versus planned goals, last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Completed</th>
            <th scope="col">Planned</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{d.completed}</td>
              <td>{d.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

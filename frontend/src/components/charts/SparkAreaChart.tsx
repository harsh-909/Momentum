/**
 * Hours logged per day over the last 7 days: a 1.5px accent line with a soft
 * 12%-opacity area wash and face-ringed dot markers. Data comes from engine
 * metrics hoursSeries.
 */
import { niceTicks } from './chartScale'
import { ChartFrame, sweepStyle, useSweepIn } from './ChartFrame'

export interface SparkDatum {
  label: string
  hours: number
}

function fmtHours(v: number): string {
  return `${+v.toFixed(1)}h`
}

export function SparkAreaChart({ data }: { data: SparkDatum[] }) {
  const on = useSweepIn()
  const maxHours = Math.max(0, ...data.map((d) => d.hours))
  const yTicks = niceTicks(maxHours, 3)
  const total = data.reduce((s, d) => s + d.hours, 0)
  const ariaLabel = `Hours logged per day, last 7 days: ${+total.toFixed(1)} hours total.`

  return (
    <div>
      <ChartFrame
        yTicks={yTicks}
        yFormat={fmtHours}
        xLabels={data.map((d) => d.label)}
        ariaLabel={ariaLabel}
        height={160}
      >
        {({ y, band, plot }) => {
          const baseY = plot.y + plot.h
          const pts = data.map((d, i) => ({ x: band(i).cx, y: y(d.hours) }))
          if (pts.length === 0) return null
          const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join('')
          const areaD = `M${pts[0].x},${baseY}${pts.map((p) => `L${p.x},${p.y}`).join('')}L${pts[pts.length - 1].x},${baseY}Z`
          return (
            <g style={sweepStyle(on)}>
              <path d={areaD} fill="var(--color-accent)" fillOpacity={0.12} />
              <path
                d={lineD}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map((p, i) => (
                <circle
                  key={`${data[i].label}-${i}`}
                  data-dot="hours"
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  fill="var(--color-accent)"
                  stroke="var(--color-face)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )
        }}
      </ChartFrame>

      <table className="sr-only">
        <caption>Hours logged per day, last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Hours</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{fmtHours(d.hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

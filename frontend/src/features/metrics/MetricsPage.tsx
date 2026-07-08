/**
 * Metrics tab: four stat tiles + three pure-SVG charts, all derived on the
 * fly from the snapshot via the engine's rolling-window functions (v1
 * computed these lazily when the tab opened; deriving per render is the
 * React equivalent - the windows are 7/28 days, cheap by construction).
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Card } from '../../components/Card'
import { BarPairChart } from '../../components/charts/BarPairChart'
import { RateBarChart } from '../../components/charts/RateBarChart'
import { SparkAreaChart } from '../../components/charts/SparkAreaChart'
import { computeMetrics, dailySeries, hoursSeries, weeklySeries } from '../../lib/engine/metrics'
import { useAppStore } from '../../store/useAppStore'
import { StatCards } from './StatCards'

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <div className="font-display text-xs label-caps text-muted">{title}</div>
      <hr className="tick-rule my-2" />
      {children}
    </Card>
  )
}

export function MetricsPage() {
  const data = useAppStore((s) => s.data)
  const today = useAppStore((s) => s.ui.today)

  const metrics = useMemo(() => computeMetrics(data, today), [data, today])
  const daily = useMemo(() => dailySeries(data, today), [data, today])
  const weekly = useMemo(() => weeklySeries(data, today), [data, today])
  const hours = useMemo(() => hoursSeries(data, today), [data, today])

  return (
    <section aria-labelledby="metrics-heading" className="space-y-4">
      <div>
        <h2 id="metrics-heading" className="font-display text-section font-semibold text-ink">
          Your momentum
        </h2>
        <p className="text-sm text-muted">The proof you&apos;re moving forward.</p>
      </div>

      <StatCards metrics={metrics} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCard title="Last 7 days · completed vs planned">
          <BarPairChart data={daily} />
        </ChartCard>
        <ChartCard title="Last 4 weeks · completion rate">
          <RateBarChart data={weekly} />
        </ChartCard>
      </div>

      <ChartCard title="Hours logged per day">
        <SparkAreaChart data={hours} />
      </ChartCard>
    </section>
  )
}

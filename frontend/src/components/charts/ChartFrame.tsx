/**
 * Shared axis primitives for the metrics charts: a viewBox-scaled <svg> with
 * hairline gridlines, mono 10px tick labels, and per-band x labels. Marks
 * are drawn by the chart via the render-prop geometry.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/**
 * Narrow-viewport flag: a 560-unit viewBox halves 10px SVG text at 360px
 * wide, so small screens get a 340-unit frame instead.
 */
const NARROW_QUERY = '(max-width: 480px)'

function subscribeNarrow(onChange: () => void): () => void {
  const mql = window.matchMedia(NARROW_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW_QUERY).matches)
}

export interface ChartGeom {
  /** Plot rectangle (inside the axis gutters), in viewBox units. */
  plot: { x: number; y: number; w: number; h: number }
  /** Value -> y coordinate (0 sits on the baseline). */
  y: (value: number) => number
  /** Horizontal band slot for series index i. */
  band: (i: number) => { x: number; w: number; cx: number }
}

export interface ChartFrameProps {
  /** Ascending gridline values; the last one is the axis maximum. */
  yTicks: number[]
  yFormat?: (value: number) => string
  xLabels: string[]
  /** Generated data summary; the svg is role="img". */
  ariaLabel: string
  /** ViewBox size - the svg itself renders at width:100%. */
  width?: number
  height?: number
  /** Extra headroom above the top gridline (room for cap labels). */
  padTop?: number
  children: (geom: ChartGeom) => ReactNode
}

const PAD = { top: 8, right: 8, bottom: 22, left: 36 }

export function ChartFrame({
  yTicks,
  yFormat = String,
  xLabels,
  ariaLabel,
  width: widthProp = 560,
  height = 200,
  padTop = PAD.top,
  children,
}: ChartFrameProps) {
  const narrow = useIsNarrow()
  // Only shrink the default frame; explicit width props stay authoritative.
  const width = narrow && widthProp === 560 ? 340 : widthProp
  const plot = {
    x: PAD.left,
    y: padTop,
    w: width - PAD.left - PAD.right,
    h: height - padTop - PAD.bottom,
  }
  const yMax = yTicks[yTicks.length - 1] || 1
  const y = (value: number) => plot.y + plot.h - (Math.max(0, value) / yMax) * plot.h
  const n = Math.max(1, xLabels.length)
  const bandW = plot.w / n
  const band = (i: number) => ({ x: plot.x + i * bandW, w: bandW, cx: plot.x + i * bandW + bandW / 2 })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="block h-auto w-full">
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={plot.x}
            x2={plot.x + plot.w}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-line)"
            strokeWidth={1}
          />
          <text
            x={plot.x - 6}
            y={y(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-muted)"
            className="font-mono-num"
          >
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xLabels.map((label, i) => (
        <text
          key={`${label}-${i}`}
          x={band(i).cx}
          y={height - 6}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-muted)"
          className="font-mono-num"
        >
          {label}
        </text>
      ))}
      {children({ plot, y, band })}
    </svg>
  )
}

/**
 * Mount flag that flips after the first commit - drives the sweep-in
 * transition on baseline-anchored marks (initial-mount effects run after
 * paint, so the browser sees the scaleY(0) frame first).
 */
export function useSweepIn(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(true)
  }, [])
  return on
}

/**
 * Grow-from-the-baseline style for bars/areas. Reduced motion is handled
 * globally: theme.css collapses all transitions to opacity-only under
 * prefers-reduced-motion, so the mark simply appears in place.
 */
export function sweepStyle(on: boolean): CSSProperties {
  return {
    transform: on ? 'scaleY(1)' : 'scaleY(0)',
    transformOrigin: 'bottom',
    transformBox: 'fill-box',
    transition: 'transform 400ms var(--ease-sweep)',
  }
}

/** Bar outline with a 4px-rounded data end and a square baseline. */
export function barPath(x: number, yTop: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  const right = x + w
  return [
    `M${x},${yTop + h}`,
    `V${yTop + rr}`,
    `Q${x},${yTop} ${x + rr},${yTop}`,
    `H${right - rr}`,
    `Q${right},${yTop} ${right},${yTop + rr}`,
    `V${yTop + h}`,
    'Z',
  ].join('')
}

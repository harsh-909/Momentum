import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarPairChart } from './BarPairChart'
import { gradeColor, RateBarChart } from './RateBarChart'
import { SparkAreaChart } from './SparkAreaChart'

const DAILY = [
  { label: 'Sat 27', completed: 1, total: 2 },
  { label: 'Sun 28', completed: 0, total: 0 },
  { label: 'Mon 29', completed: 2, total: 2 },
  { label: 'Tue 30', completed: 0, total: 1 },
  { label: 'Wed 1', completed: 1, total: 3 },
  { label: 'Thu 2', completed: 2, total: 4 },
  { label: 'Fri 3', completed: 1, total: 1 },
]

describe('BarPairChart', () => {
  it('renders a track per day with goals and a completed bar per day with completions', () => {
    const { container } = render(<BarPairChart data={DAILY} />)
    // 6 days have total > 0; 5 days have completed > 0.
    expect(container.querySelectorAll('[data-bar="total"]')).toHaveLength(6)
    expect(container.querySelectorAll('[data-bar="completed"]')).toHaveLength(5)
  })

  it('summarizes the data in the aria-label and mirrors it in a table', () => {
    render(<BarPairChart data={DAILY} />)
    expect(
      screen.getByRole('img', {
        name: 'Completed versus planned goals, last 7 days: 7 of 13 goals completed.',
      }),
    ).toBeInTheDocument()
    // Header row + 7 data rows.
    expect(screen.getAllByRole('row')).toHaveLength(8)
  })
})

describe('RateBarChart', () => {
  const WEEKLY = [
    { label: 'W1 · Jun 6', pct: 100 },
    { label: 'W2 · Jun 13', pct: 80 },
    { label: 'W3 · Jun 20', pct: 50 },
    { label: 'W4 · Jun 27', pct: 49 },
  ]

  it('renders one graded bar per week on the fixed % axis', () => {
    const { container } = render(<RateBarChart data={WEEKLY} />)
    const bars = container.querySelectorAll('[data-bar="rate"]')
    expect(bars).toHaveLength(4)
    expect(bars[0]).toHaveAttribute('fill', 'var(--color-good)')
    expect(bars[1]).toHaveAttribute('fill', 'var(--color-good)')
    expect(bars[2]).toHaveAttribute('fill', 'var(--color-warn)')
    expect(bars[3]).toHaveAttribute('fill', 'var(--color-alert)')
    // 100% appears as both the top y tick and the first cap label.
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(2)
  })

  it('skips the bar (but not the label) for a 0% week', () => {
    const { container } = render(
      <RateBarChart data={[{ label: 'W1 · Jun 6', pct: 0 }]} />,
    )
    expect(container.querySelectorAll('[data-bar="rate"]')).toHaveLength(0)
    expect(screen.getByRole('img', { name: 'Completion rate, last 4 weeks: W1 · Jun 6 0%.' })).toBeInTheDocument()
  })

  it('lists every week in the aria-label', () => {
    render(<RateBarChart data={WEEKLY} />)
    expect(
      screen.getByRole('img', {
        name: 'Completion rate, last 4 weeks: W1 · Jun 6 100%, W2 · Jun 13 80%, W3 · Jun 20 50%, W4 · Jun 27 49%.',
      }),
    ).toBeInTheDocument()
  })
})

describe('gradeColor thresholds', () => {
  it('grades >=80 good, >=50 warn, below alert', () => {
    expect(gradeColor(100)).toBe('var(--color-good)')
    expect(gradeColor(80)).toBe('var(--color-good)')
    expect(gradeColor(79)).toBe('var(--color-warn)')
    expect(gradeColor(50)).toBe('var(--color-warn)')
    expect(gradeColor(49)).toBe('var(--color-alert)')
    expect(gradeColor(0)).toBe('var(--color-alert)')
  })
})

describe('SparkAreaChart', () => {
  const HOURS = [
    { label: 'Sat 27', hours: 0 },
    { label: 'Sun 28', hours: 1.5 },
    { label: 'Mon 29', hours: 2 },
    { label: 'Tue 30', hours: 0.5 },
    { label: 'Wed 1', hours: 3 },
    { label: 'Thu 2', hours: 0 },
    { label: 'Fri 3', hours: 1 },
  ]

  it('renders a dot per day and totals the hours in the aria-label', () => {
    const { container } = render(<SparkAreaChart data={HOURS} />)
    expect(container.querySelectorAll('[data-dot="hours"]')).toHaveLength(7)
    expect(
      screen.getByRole('img', { name: 'Hours logged per day, last 7 days: 8 hours total.' }),
    ).toBeInTheDocument()
  })

  it('mirrors the values in the sr-only table', () => {
    render(<SparkAreaChart data={HOURS} />)
    expect(screen.getAllByRole('row')).toHaveLength(8)
    expect(screen.getByRole('cell', { name: '1.5h' })).toBeInTheDocument()
  })
})

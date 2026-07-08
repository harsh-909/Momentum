import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeGoal, makeSnapshot, TODAY } from '../../lib/engine/testFactories'
import { useAppStore } from '../../store/useAppStore'
import { MetricsPage } from './MetricsPage'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
})

function seedStore() {
  useAppStore.setState({
    data: makeSnapshot({
      goals: {
        // Yesterday: 1/1 done with 1.5h logged; today: 1/2 done, 1h planned counted on completion.
        '2026-07-02': [makeGoal({ topic: 'Run', hours: 1, completed: true, loggedHours: 1.5 })],
        [TODAY]: [
          makeGoal({ topic: 'Write', hours: 1, completed: true }),
          makeGoal({ topic: 'Read', hours: 2 }),
        ],
      },
    }),
    ui: { ...useAppStore.getState().ui, today: TODAY },
  })
}

/** The value rendered next to a stat caption (scoped so svg tick text never collides). */
function statValue(label: string): HTMLElement {
  const card = screen.getByText(label).parentElement as HTMLElement
  return card.lastElementChild as HTMLElement
}

describe('MetricsPage stat cards', () => {
  it('renders all four stats from computeMetrics', () => {
    seedStore()
    render(<MetricsPage />)
    // Yesterday 100%, today 50% -> streak breaks at today (50 < 70) -> 0.
    // avgWeek = round((100 + 50) / 2) = 75. Hours = 1.5 + 1 = 2.5. Goals = 3.
    expect(statValue('Day streak')).toHaveTextContent('0')
    expect(statValue('7-day completion')).toHaveTextContent('75%')
    expect(statValue('Logged (7 days)')).toHaveTextContent('2h 30m')
    expect(statValue('Goals (7 days)')).toHaveTextContent('3')
  })
})

describe('MetricsPage charts', () => {
  it('renders the three chart cards with their SVG charts', () => {
    seedStore()
    render(<MetricsPage />)
    expect(screen.getByText('Last 7 days · completed vs planned')).toBeInTheDocument()
    expect(screen.getByText('Last 4 weeks · completion rate')).toBeInTheDocument()
    expect(screen.getByText('Hours logged per day')).toBeInTheDocument()

    const charts = screen.getAllByRole('img')
    expect(charts).toHaveLength(3)
    expect(charts[0]).toHaveAccessibleName(
      'Completed versus planned goals, last 7 days: 2 of 3 goals completed.',
    )
    expect(charts[1].getAttribute('aria-label')).toMatch(
      /^Completion rate, last 4 weeks: W1 [^,]+ \d+%, W2 [^,]+ \d+%, W3 [^,]+ \d+%, W4 [^,]+ \d+%\.$/,
    )
    expect(charts[2]).toHaveAccessibleName('Hours logged per day, last 7 days: 2.5 hours total.')
  })

  it('renders an empty-data view without crashing (fresh profile)', () => {
    useAppStore.setState({
      data: makeSnapshot(),
      ui: { ...useAppStore.getState().ui, today: TODAY },
    })
    render(<MetricsPage />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(statValue('7-day completion')).toHaveTextContent('0%')
  })
})

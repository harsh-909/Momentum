import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeGoal, makeSnapshot, makeSubtask, TODAY } from '../../lib/engine/testFactories'
import { useAppStore } from '../../store/useAppStore'
import type { Goal } from '../../types/domain'
import { HistoryPage } from './HistoryPage'
import { PctBadge } from './PctBadge'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
})

function seedStore(
  goals: Record<string, Goal[]>,
  uiOver: Partial<(typeof initialState)['ui']> = {},
) {
  useAppStore.setState({
    data: makeSnapshot({ goals }),
    ui: { ...useAppStore.getState().ui, today: TODAY, ...uiOver },
  })
}

function fixtureGoals(): Record<string, Goal[]> {
  return {
    // 2026-07-01: one done, one missed.
    '2026-07-01': [
      makeGoal({ topic: 'Ship the draft', hours: 2, completed: true, loggedHours: 1.5 }),
      makeGoal({
        topic: 'Call the bank',
        hours: 0.5,
        subtasks: [makeSubtask({ text: 'Find number', completed: true }), makeSubtask({ text: 'Call' })],
      }),
    ],
    // 2026-07-02: all done.
    '2026-07-02': [makeGoal({ topic: 'Morning run', hours: 1, completed: true })],
    // Today counts too.
    [TODAY]: [makeGoal({ topic: 'Water plants', hours: 0.25 })],
    // Future days never show.
    '2026-07-05': [makeGoal({ topic: 'From the future' })],
    // Empty days never show.
    '2026-06-30': [],
  }
}

describe('HistoryPage day list', () => {
  it('lists only non-empty days up to today, newest first', () => {
    seedStore(fixtureGoals())
    render(<HistoryPage />)
    const headers = screen.getAllByRole('button', { expanded: false })
    expect(headers).toHaveLength(3)
    expect(headers[0]).toHaveTextContent('Jul 3, 2026')
    expect(headers[1]).toHaveTextContent('Jul 2, 2026')
    expect(headers[2]).toHaveTextContent('Jul 1, 2026')
    expect(screen.queryByText(/Jul 5, 2026/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Jun 30, 2026/)).not.toBeInTheDocument()
  })

  it('shows the day summary (done/total and hours, logged ?? planned)', () => {
    seedStore(fixtureGoals())
    render(<HistoryPage />)
    // 2026-07-01: 1/2 done; hours = 1.5 logged + 0.5 planned = 2h.
    expect(screen.getByText('1/2 goals · 2h')).toBeInTheDocument()
  })

  it('shows the empty state when no day has goals', () => {
    seedStore({ '2026-07-05': [makeGoal()] }) // future only
    render(<HistoryPage />)
    expect(screen.getByText('Your story starts today')).toBeInTheDocument()
  })

  it('expands a day through store.toggleHistoryDate', async () => {
    const toggleHistoryDate = vi.fn()
    seedStore(fixtureGoals())
    useAppStore.setState({ toggleHistoryDate })
    render(<HistoryPage />)
    await userEvent.click(screen.getAllByRole('button', { expanded: false })[2])
    expect(toggleHistoryDate).toHaveBeenCalledWith('2026-07-01')
  })
})

describe('HistoryPage expanded body + filter', () => {
  it('renders goal rows with duration and subtask chips when expanded', () => {
    seedStore(fixtureGoals(), { expandedHistoryDates: ['2026-07-01'] })
    render(<HistoryPage />)
    expect(screen.getByText('Ship the draft')).toBeInTheDocument()
    expect(screen.getByText('1h 30m')).toBeInTheDocument() // logged beats planned
    expect(screen.getByText('Find number')).toHaveClass('line-through')
    expect(screen.getByText('Call')).not.toHaveClass('line-through')
  })

  it('filter pills set the store filter and the active pill is pressed', async () => {
    const setHistoryFilter = vi.fn()
    seedStore(fixtureGoals())
    useAppStore.setState({ setHistoryFilter })
    render(<HistoryPage />)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(setHistoryFilter).toHaveBeenCalledWith('complete')
    await userEvent.click(screen.getByRole('button', { name: 'Missed' }))
    expect(setHistoryFilter).toHaveBeenCalledWith('incomplete')
  })

  it('complete filter shows only completed goals; incomplete only the rest', () => {
    seedStore(fixtureGoals(), {
      expandedHistoryDates: ['2026-07-01'],
      historyFilter: 'complete',
    })
    const { unmount } = render(<HistoryPage />)
    expect(screen.getByText('Ship the draft')).toBeInTheDocument()
    expect(screen.queryByText('Call the bank')).not.toBeInTheDocument()
    unmount()

    seedStore(fixtureGoals(), {
      expandedHistoryDates: ['2026-07-01'],
      historyFilter: 'incomplete',
    })
    render(<HistoryPage />)
    expect(screen.queryByText('Ship the draft')).not.toBeInTheDocument()
    expect(screen.getByText('Call the bank')).toBeInTheDocument()
  })
})

describe('PctBadge thresholds', () => {
  it.each([
    [100, 'good'],
    [99, 'warn'],
    [50, 'warn'],
    [49, 'alert'],
    [0, 'alert'],
  ])('%i%% -> %s', (pct, grade) => {
    const { container } = render(<PctBadge pct={pct} />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge).toHaveAttribute('data-grade', grade)
    // Status-text ink pins the grade mapping; the color-mix background is
    // dropped by jsdom's CSS parser, so it can't be asserted here.
    expect(badge.style.color).toBe(`var(--color-${grade}-text)`)
    expect(badge).toHaveTextContent(`${pct}%`)
  })
})

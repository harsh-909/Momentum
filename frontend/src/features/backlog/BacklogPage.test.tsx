import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeGoal, makeSnapshot, makeSubtask, TODAY } from '../../lib/engine/testFactories'
import { useAppStore } from '../../store/useAppStore'
import { BacklogPage } from './BacklogPage'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
  vi.unstubAllGlobals()
})

function seedStore(over: Parameters<typeof makeSnapshot>[0] = {}) {
  useAppStore.setState({
    data: makeSnapshot(over),
    ui: { ...useAppStore.getState().ui, today: TODAY },
  })
}

function fixtureBacklog() {
  return [
    makeGoal({
      topic: 'Write the report',
      hours: 1.5,
      originalDate: '2026-06-28',
      backlognedAt: '2026-07-01',
      subtasks: [makeSubtask({ text: 'Outline', completed: true }), makeSubtask({ text: 'Draft' })],
    }),
    makeGoal({ topic: 'Fix the bike', hours: 0.5, originalDate: '2026-07-01', backlognedAt: '2026-07-02' }),
  ]
}

describe('BacklogPage rendering', () => {
  it('shows the count, the carried-through line, and each item', () => {
    seedStore({ backlog: fixtureBacklog(), carriedThrough: '2026-07-02' })
    render(<BacklogPage />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/waiting/)).toBeInTheDocument()
    expect(screen.getByText(/Auto-carried through .*Jul 2, 2026/)).toBeInTheDocument()
    expect(screen.getByText('Write the report')).toBeInTheDocument()
    expect(screen.getByText('Fix the bike')).toBeInTheDocument()
    // Duration badge + age label + original date on the first item.
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    expect(screen.getByText('2d ago')).toBeInTheDocument()
    expect(screen.getByText(/Originally: .*Jun 28, 2026/)).toBeInTheDocument()
    // Subtask chips.
    expect(screen.getByText('Outline')).toHaveClass('line-through')
    expect(screen.getByText('Draft')).not.toHaveClass('line-through')
  })

  it('shows the empty state when nothing is waiting', () => {
    seedStore()
    render(<BacklogPage />)
    expect(screen.getByText("Nothing's slipping through")).toBeInTheDocument()
  })

  it('hides the carried-through line until a sweep has happened', () => {
    seedStore({ backlog: fixtureBacklog() })
    render(<BacklogPage />)
    expect(screen.queryByText(/Auto-carried/)).not.toBeInTheDocument()
  })
})

describe('BacklogPage actions', () => {
  it('"-> Today" reschedules the item onto today by index', async () => {
    const scheduleFromBacklog = vi.fn()
    seedStore({ backlog: fixtureBacklog() })
    useAppStore.setState({ scheduleFromBacklog })
    render(<BacklogPage />)
    await userEvent.click(screen.getAllByRole('button', { name: /Today/ })[1])
    expect(scheduleFromBacklog).toHaveBeenCalledWith(1, TODAY)
  })

  it('the date picker + Go schedules onto the picked date', async () => {
    const scheduleFromBacklog = vi.fn()
    seedStore({ backlog: fixtureBacklog() })
    useAppStore.setState({ scheduleFromBacklog })
    render(<BacklogPage />)
    const input = screen.getByLabelText('Schedule "Write the report" on date')
    expect(input).toHaveAttribute('min', TODAY)
    fireEvent.change(input, { target: { value: '2026-07-05' } })
    await userEvent.click(screen.getAllByRole('button', { name: 'Go' })[0])
    expect(scheduleFromBacklog).toHaveBeenCalledWith(0, '2026-07-05')
  })

  it('remove asks for confirmation before deleting', async () => {
    const deleteBacklogItem = vi.fn()
    seedStore({ backlog: fixtureBacklog() })
    useAppStore.setState({ deleteBacklogItem })
    // happy-dom ships no confirm(); stub the global the component calls.
    const confirmFn = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirmFn)
    render(<BacklogPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove "Fix the bike" from backlog' }))
    expect(confirmFn).toHaveBeenCalled()
    expect(deleteBacklogItem).toHaveBeenCalledWith(1)
  })

  it('remove is a no-op when the confirm is dismissed', async () => {
    const deleteBacklogItem = vi.fn()
    seedStore({ backlog: fixtureBacklog() })
    useAppStore.setState({ deleteBacklogItem })
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    render(<BacklogPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove "Fix the bike" from backlog' }))
    expect(deleteBacklogItem).not.toHaveBeenCalled()
  })
})

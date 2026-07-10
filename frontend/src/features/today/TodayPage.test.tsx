import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { TodayPage } from './TodayPage'
import { FUTURE, PAST, TODAY, makeGoal, makeHabit, seedStore } from './testUtils'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
})

describe('TodayPage', () => {
  it('shows an empty state when the day has no goals', () => {
    seedStore()
    render(<TodayPage />)
    expect(
      screen.getByText(/a fresh canvas awaits|plan tomorrow's wins/i),
    ).toBeInTheDocument()
  })

  it('renders the goal list instead of the empty state when goals exist', () => {
    seedStore({ goals: { [TODAY]: [makeGoal({ topic: 'Write tests' })] } })
    render(<TodayPage />)
    expect(screen.getByText('Write tests')).toBeInTheDocument()
    expect(screen.queryByText(/a fresh canvas awaits/i)).not.toBeInTheDocument()
  })

  it('shows the readonly notice (and no add form) on past days', () => {
    seedStore({ selectedDate: PAST, minDate: PAST })
    render(<TodayPage />)
    expect(screen.getByText(/past days are read-only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add a goal/i })).not.toBeInTheDocument()
  })

  it('hints at scheduled habits on future days', () => {
    // FUTURE (2026-07-05) is a Sunday; the habit runs every day.
    seedStore({ selectedDate: FUTURE, recurring: [makeHabit(), makeHabit()] })
    render(<TodayPage />)
    expect(screen.getByText(/habits scheduled/i)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows no habit hint on future days without scheduled habits', () => {
    // Habit scheduled only on Mondays (1); FUTURE is a Sunday.
    seedStore({ selectedDate: FUTURE, recurring: [makeHabit({ days: [1] })] })
    render(<TodayPage />)
    expect(screen.queryByText(/habits? scheduled/i)).not.toBeInTheDocument()
  })
})

describe('TodayPage bulk-select', () => {
  it('selects goals and pushes them to the backlog, then offers Undo', async () => {
    const bulkMoveToBacklog = vi.fn()
    const restoreToDay = vi.fn()
    seedStore({
      goals: { [TODAY]: [makeGoal({ topic: 'A' }), makeGoal({ topic: 'B' })] },
      actions: { bulkMoveToBacklog, restoreToDay },
    })
    const user = userEvent.setup()
    render(<TodayPage />)

    await user.click(screen.getByRole('button', { name: 'Select' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select goal A' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select goal B' }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /push to backlog/i }))
    expect(bulkMoveToBacklog).toHaveBeenCalledTimes(1)
    const [date, ids] = bulkMoveToBacklog.mock.calls[0]
    expect(date).toBe(TODAY)
    expect(ids).toHaveLength(2)

    expect(screen.getByText('Moved 2 to backlog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(restoreToDay).toHaveBeenCalledWith(TODAY, ids)
  })

  it('cannot select habit or plan goals for the backlog', async () => {
    seedStore({
      goals: {
        [TODAY]: [makeGoal({ topic: 'Plain' }), makeGoal({ topic: 'Habit', recurringId: 'r1' })],
      },
    })
    const user = userEvent.setup()
    render(<TodayPage />)

    await user.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.getByRole('checkbox', { name: 'Select goal Plain' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Select goal Habit' })).toBeDisabled()
  })

  it('offers no Select control when the day has only habits/plans', () => {
    seedStore({ goals: { [TODAY]: [makeGoal({ topic: 'Habit', recurringId: 'r1' })] } })
    render(<TodayPage />)
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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

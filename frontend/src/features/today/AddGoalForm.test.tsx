import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { AddGoalForm } from './AddGoalForm'
import { TodayPage } from './TodayPage'
import { PAST, TODAY, makeGoal, seedStore } from './testUtils'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
})

/** The submit button is the one without aria-expanded (the toggle has it). */
function submitButton() {
  return screen
    .getAllByRole('button', { name: /add a goal/i })
    .find((b) => !b.hasAttribute('aria-expanded'))!
}

async function expand(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /add a goal/i, expanded: false }))
}

describe('AddGoalForm', () => {
  it('submits combined decimal hours, topic, and subtask lines', async () => {
    const addGoal = vi.fn()
    seedStore({ actions: { addGoal } })
    const user = userEvent.setup()
    render(<AddGoalForm date={TODAY} />)

    await expand(user)
    await user.type(screen.getByLabelText('Goal topic'), 'Ship the dial')
    const minutes = screen.getByLabelText('Planned time minutes')
    await user.clear(minutes)
    await user.type(minutes, '30')
    await user.type(screen.getByPlaceholderText('One subtask per line'), 'one{enter}two')
    await user.click(submitButton())

    expect(addGoal).toHaveBeenCalledWith(TODAY, {
      topic: 'Ship the dial',
      hours: 1.5, // default 1h + typed 30m
      subtaskLines: 'one\ntwo',
    })
  })

  it('submits on Enter in the topic field and refuses a blank topic', async () => {
    const addGoal = vi.fn()
    seedStore({ actions: { addGoal } })
    const user = userEvent.setup()
    render(<AddGoalForm date={TODAY} />)

    await expand(user)
    await user.click(submitButton()) // blank topic: no dispatch
    expect(addGoal).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Goal topic'), 'Morning run{enter}')
    expect(addGoal).toHaveBeenCalledTimes(1)
  })

  it('stays open while the day still has 0 goals, collapses otherwise', async () => {
    const addGoal = vi.fn()
    seedStore({ actions: { addGoal } })
    const user = userEvent.setup()
    render(<AddGoalForm date={TODAY} />)

    await expand(user)
    await user.type(screen.getByLabelText('Goal topic'), 'First goal{enter}')
    // The (mocked) add left the day empty -> form stays open, fields cleared.
    expect(screen.getByLabelText('Goal topic')).toHaveValue('')

    // Day now has a goal -> the next submit collapses the form.
    useAppStore.setState({
      data: { ...useAppStore.getState().data, goals: { [TODAY]: [makeGoal()] } },
    })
    await user.type(screen.getByLabelText('Goal topic'), 'Second goal{enter}')
    expect(screen.queryByLabelText('Goal topic')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add a goal/i, expanded: false })).toBeInTheDocument()
  })

  it('is hidden entirely on read-only past days', () => {
    seedStore({ selectedDate: PAST, today: TODAY, minDate: PAST })
    render(<TodayPage />)
    expect(screen.queryByRole('button', { name: /add a goal/i })).not.toBeInTheDocument()
    expect(screen.getByText(/past days are read-only/i)).toBeInTheDocument()
  })
})

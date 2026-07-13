import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { SubtaskList } from './SubtaskList'
import { TODAY, makeGoal, makeSubtask, seedStore } from './testUtils'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
})

describe('SubtaskRow', () => {
  it('shows the time-log row only for completed subtasks', () => {
    const goal = makeGoal({
      subtasks: [
        makeSubtask({ text: 'done step', completed: true }),
        makeSubtask({ text: 'open step' }),
      ],
    })
    seedStore({ goals: { [TODAY]: [goal] } })
    render(<SubtaskList date={TODAY} goal={goal} readonly={false} checkable={true} />)

    expect(screen.getByText('took')).toBeInTheDocument()
    expect(screen.getByLabelText('took done step hours')).toBeInTheDocument()
    expect(screen.queryByLabelText('took open step hours')).not.toBeInTheDocument()
  })

  it('logs subtask time as separate h and m', async () => {
    const logSubtaskTime = vi.fn()
    const sub = makeSubtask({ text: 'step', completed: true, loggedHours: null })
    const goal = makeGoal({ subtasks: [sub] })
    seedStore({ goals: { [TODAY]: [goal] }, actions: { logSubtaskTime } })
    render(<SubtaskList date={TODAY} goal={goal} readonly={false} checkable={true} />)

    // A single change event: the store action is a spy, so the controlled
    // input never re-renders between keystrokes.
    fireEvent.change(screen.getByLabelText('took step minutes'), { target: { value: '45' } })
    expect(logSubtaskTime).toHaveBeenLastCalledWith(TODAY, goal.id, sub.id, 0, 45)
  })

  it('toggles a subtask through the store', async () => {
    const toggleSubtask = vi.fn()
    const sub = makeSubtask({ text: 'step' })
    const goal = makeGoal({ subtasks: [sub] })
    seedStore({ goals: { [TODAY]: [goal] }, actions: { toggleSubtask } })
    render(<SubtaskList date={TODAY} goal={goal} readonly={false} checkable={true} />)

    await userEvent.click(screen.getByRole('checkbox', { name: 'step' }))
    expect(toggleSubtask).toHaveBeenCalledWith(TODAY, goal.id, sub.id)
  })

  it('readonly: disabled checkbox and no time inputs even when completed', () => {
    const goal = makeGoal({
      subtasks: [makeSubtask({ text: 'step', completed: true, loggedHours: 0.5 })],
    })
    seedStore({ goals: { [TODAY]: [goal] } })
    render(<SubtaskList date={TODAY} goal={goal} readonly={true} checkable={false} />)

    expect(screen.getByRole('checkbox', { name: 'step' })).toBeDisabled()
    expect(screen.queryByText('took')).not.toBeInTheDocument()
  })

  it('yesterday (readonly + checkable): live checkbox but still no time input', () => {
    const goal = makeGoal({
      subtasks: [makeSubtask({ text: 'step', completed: true, loggedHours: 0.5 })],
    })
    seedStore({ goals: { [TODAY]: [goal] } })
    render(<SubtaskList date={TODAY} goal={goal} readonly={true} checkable={true} />)

    expect(screen.getByRole('checkbox', { name: 'step' })).toBeEnabled()
    expect(screen.queryByText('took')).not.toBeInTheDocument()
  })

  it('strikes through completed subtask text', () => {
    const goal = makeGoal({ subtasks: [makeSubtask({ text: 'finished', completed: true })] })
    seedStore({ goals: { [TODAY]: [goal] } })
    render(<SubtaskList date={TODAY} goal={goal} readonly={false} checkable={true} />)
    expect(screen.getByText('finished')).toHaveClass('line-through')
  })
})

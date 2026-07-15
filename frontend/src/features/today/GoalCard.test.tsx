import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogHost } from '../../components/ConfirmDialog'
import { useConfirmStore } from '../../lib/confirm'
import { useAppStore } from '../../store/useAppStore'
import { GoalList } from './GoalList'
import { TODAY, makeGoal, seedStore } from './testUtils'
import type { Goal } from '../../types/domain'

vi.mock('../../lib/confetti', () => ({ celebrate: vi.fn() }))
import { celebrate } from '../../lib/confetti'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
  useConfirmStore.setState({ pending: null })
  vi.unstubAllGlobals()
  vi.mocked(celebrate).mockClear()
})

/** Render one goal through GoalList so dnd-kit context is real. The confirm
 *  dialog host is included so destructive actions can be driven end to end. */
function renderGoal(
  goal: Goal,
  opts: Parameters<typeof seedStore>[0] = {},
  readonly = false,
  checkable = !readonly,
) {
  seedStore({ goals: { [TODAY]: [goal] }, ...opts })
  return render(
    <>
      <GoalList date={TODAY} goals={[goal]} readonly={readonly} checkable={checkable} />
      <ConfirmDialogHost />
    </>,
  )
}

describe('GoalCard actions', () => {
  it('shows the habit badge on habit-derived goals', () => {
    renderGoal(makeGoal({ recurringId: 'habit-1' }))
    expect(screen.getByText('habit')).toBeInTheDocument()
  })

  it('disables the checkbox and hides the action rail when readonly', () => {
    renderGoal(makeGoal({ topic: 'Frozen' }), {}, true)
    expect(screen.getByRole('checkbox', { name: 'Frozen' })).toBeDisabled()
    expect(screen.queryByTitle('Edit goal')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('keeps the checkbox live on yesterday (readonly + checkable) but still hides edits', () => {
    renderGoal(makeGoal({ topic: 'Missed' }), {}, true, true)
    expect(screen.getByRole('checkbox', { name: 'Missed' })).toBeEnabled()
    expect(screen.queryByTitle('Edit goal')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('deletes only after confirmation', async () => {
    const deleteGoal = vi.fn()
    const goal = makeGoal()
    renderGoal(goal, { actions: { deleteGoal } })

    // Cancelling the confirm keeps the goal.
    await userEvent.click(screen.getByTitle('Delete'))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(deleteGoal).not.toHaveBeenCalled()

    // Confirming deletes it.
    await userEvent.click(screen.getByTitle('Delete'))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(deleteGoal).toHaveBeenCalledWith(TODAY, goal.id)
  })

  it('enters edit mode via the edit button', async () => {
    const setEditingGoal = vi.fn()
    const goal = makeGoal()
    renderGoal(goal, { actions: { setEditingGoal } })
    await userEvent.click(screen.getByTitle('Edit goal'))
    expect(setEditingGoal).toHaveBeenCalledWith(goal.id)
  })

  it('toggles completion and celebrates when the goal just completed', async () => {
    const toggleGoal = vi.fn()
    const goal = makeGoal({ topic: 'Run' })
    renderGoal(goal, { actions: { toggleGoal } })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Run' }))
    expect(toggleGoal).toHaveBeenCalledWith(TODAY, goal.id)
    expect(celebrate).toHaveBeenCalledTimes(1)
  })

  it('does not celebrate when un-completing', async () => {
    const toggleGoal = vi.fn()
    const goal = makeGoal({ topic: 'Run', completed: true })
    renderGoal(goal, { actions: { toggleGoal } })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Run' }))
    expect(toggleGoal).toHaveBeenCalledWith(TODAY, goal.id)
    expect(celebrate).not.toHaveBeenCalled()
  })

  it('swaps in the edit form when this goal is being edited', async () => {
    const stopEditGoal = vi.fn()
    const setEditingGoal = vi.fn()
    const goal = makeGoal({ topic: 'Edit me' })
    renderGoal(goal, { editingGoalId: goal.id, actions: { stopEditGoal, setEditingGoal } })

    expect(screen.getByLabelText('Goal title')).toHaveValue('Edit me')
    await userEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(stopEditGoal).toHaveBeenCalledWith(TODAY, goal.id)
    expect(setEditingGoal).toHaveBeenCalledWith(null)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogHost } from '../../components/ConfirmDialog'
import { useConfirmStore } from '../../lib/confirm'
import { makeHabit, makeSnapshot, TODAY } from '../../lib/engine/testFactories'
import { useAppStore } from '../../store/useAppStore'
import type { HabitTemplate } from '../../types/domain'
import { HabitsPage } from './HabitsPage'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
  useConfirmStore.setState({ pending: null })
  vi.unstubAllGlobals()
})

function seedStore(recurring: HabitTemplate[] = []) {
  useAppStore.setState({
    data: makeSnapshot({ recurring }),
    ui: { ...useAppStore.getState().ui, today: TODAY },
  })
}

describe('HabitsPage rendering', () => {
  it('shows the empty state when there are no habits and the form is closed', () => {
    seedStore()
    render(<HabitsPage />)
    expect(screen.getByText('Build your rituals')).toBeInTheDocument()
  })

  it('renders a card per habit with schedule, duration, and start date', () => {
    seedStore([
      makeHabit({
        topic: 'Yoga',
        hours: 0.5,
        days: [1, 2, 3, 4, 5],
        startDate: '2026-07-01',
        subtasks: [{ text: 'Warm up' }, { text: 'Flow' }],
      }),
    ])
    render(<HabitsPage />)
    expect(screen.getByText('Yoga')).toBeInTheDocument()
    expect(screen.getByText(/30m/)).toBeInTheDocument()
    expect(screen.getByText('Weekdays')).toBeInTheDocument()
    expect(screen.getByText(/Since .*Jul 1, 2026/)).toBeInTheDocument()
    expect(screen.getByText('Warm up')).toBeInTheDocument()
  })
})

describe('HabitForm (add)', () => {
  it('requires a topic and at least one day before submit enables', async () => {
    seedStore()
    render(<HabitsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'New habit' }))

    const submit = screen.getByRole('button', { name: 'Add habit' })
    expect(submit).toBeDisabled() // topic empty

    await userEvent.type(screen.getByPlaceholderText(/Yoga, Morning walk/), 'Read')
    expect(submit).toBeEnabled()

    // Deselect all 7 default days -> disabled again + alert hint.
    for (const day of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']) {
      await userEvent.click(screen.getByRole('button', { name: day }))
    }
    expect(submit).toBeDisabled()
    expect(screen.getByText('Pick at least one day')).toBeInTheDocument()
  })

  it('submits the draft (preset days, default 30m) to store.submitHabit', async () => {
    const submitHabit = vi.fn()
    seedStore()
    useAppStore.setState({ submitHabit })
    render(<HabitsPage />)

    await userEvent.click(screen.getByRole('button', { name: 'New habit' }))
    await userEvent.type(screen.getByPlaceholderText(/Yoga, Morning walk/), 'Read 20 pages')
    await userEvent.click(screen.getByRole('button', { name: 'Weekends' }))
    await userEvent.type(screen.getByPlaceholderText(/Warm up/), 'Open book\nRead')
    await userEvent.click(screen.getByRole('button', { name: 'Add habit' }))

    expect(submitHabit).toHaveBeenCalledWith({
      topic: 'Read 20 pages',
      hours: 0.5,
      subtaskLines: 'Open book\nRead',
      days: [0, 6],
    })
    // Form closes after submit.
    expect(screen.queryByRole('button', { name: 'Add habit' })).not.toBeInTheDocument()
  })

  it('cancel closes the form without submitting', async () => {
    const submitHabit = vi.fn()
    seedStore()
    useAppStore.setState({ submitHabit })
    render(<HabitsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'New habit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(submitHabit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'New habit' })).toBeInTheDocument()
  })
})

describe('HabitForm (edit)', () => {
  it('prefills the draft from the template and submits with the id', async () => {
    const habit = makeHabit({
      topic: 'Yoga',
      hours: 1,
      days: [1, 3],
      subtasks: [{ text: 'Warm up' }],
    })
    const submitHabit = vi.fn()
    seedStore([habit])
    useAppStore.setState({ submitHabit })
    render(<HabitsPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit habit "Yoga"' }))
    expect(screen.getByDisplayValue('Yoga')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Warm up')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Su' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(screen.getByRole('button', { name: 'Sa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(submitHabit).toHaveBeenCalledWith({
      id: habit.id,
      topic: 'Yoga',
      hours: 1,
      subtaskLines: 'Warm up',
      days: [1, 3, 6],
    })
  })
})

describe('HabitCard delete', () => {
  it('confirms, then deletes by id', async () => {
    const habit = makeHabit({ topic: 'Yoga' })
    const deleteHabit = vi.fn()
    seedStore([habit])
    useAppStore.setState({ deleteHabit })
    render(
      <>
        <HabitsPage />
        <ConfirmDialogHost />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete habit "Yoga"' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Stop habit' }))
    expect(deleteHabit).toHaveBeenCalledWith(habit.id)
  })

  it('keeps the habit when the confirm is dismissed', async () => {
    const deleteHabit = vi.fn()
    seedStore([makeHabit({ topic: 'Yoga' })])
    useAppStore.setState({ deleteHabit })
    render(
      <>
        <HabitsPage />
        <ConfirmDialogHost />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete habit "Yoga"' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(deleteHabit).not.toHaveBeenCalled()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogHost } from '../../components/ConfirmDialog'
import { useConfirmStore } from '../../lib/confirm'
import { makePlan, makeSnapshot, TODAY } from '../../lib/engine/testFactories'
import { useAppStore } from '../../store/useAppStore'
import type { PlanTemplate } from '../../types/domain'
import { PlansPage } from './PlansPage'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
  useConfirmStore.setState({ pending: null })
  vi.unstubAllGlobals()
})

function seedStore(plans: PlanTemplate[] = []) {
  useAppStore.setState({
    data: makeSnapshot({ plans }),
    ui: { ...useAppStore.getState().ui, today: TODAY },
  })
}

describe('PlansPage rendering', () => {
  it('shows the empty state when there are no plans and the form is closed', () => {
    seedStore()
    render(<PlansPage />)
    expect(screen.getByText('No plans yet')).toBeInTheDocument()
  })

  it('renders a card per plan with schedule, duration, and start date', () => {
    seedStore([
      makePlan({
        topic: 'Pay rent',
        hours: 0.5,
        startDate: '2026-07-01',
        recurrence: { freq: 'monthly', dayOfMonth: 1 },
        subtasks: [{ text: 'Transfer' }],
      }),
    ])
    render(<PlansPage />)
    expect(screen.getByText('Pay rent')).toBeInTheDocument()
    expect(screen.getByText(/30m/)).toBeInTheDocument()
    expect(screen.getByText('Monthly on the 1st')).toBeInTheDocument()
    expect(screen.getByText(/Since .*Jul 1, 2026/)).toBeInTheDocument()
    expect(screen.getByText('Transfer')).toBeInTheDocument()
  })
})

describe('PlanForm (add)', () => {
  it('requires a topic (recurrence valid by default) before submit enables', async () => {
    seedStore()
    render(<PlansPage />)
    await userEvent.click(screen.getByRole('button', { name: 'New plan' }))

    const submit = screen.getByRole('button', { name: 'Add plan' })
    expect(submit).toBeDisabled() // topic empty

    await userEvent.type(screen.getByPlaceholderText(/Pay rent/), 'Dentist')
    expect(submit).toBeEnabled()

    // Clearing the once date makes the recurrence invalid again.
    await userEvent.clear(screen.getByLabelText('Date'))
    expect(submit).toBeDisabled()
  })

  it('submits the draft (default 30m, once-today recurrence) to store.submitPlan', async () => {
    const submitPlan = vi.fn()
    seedStore()
    useAppStore.setState({ submitPlan })
    render(<PlansPage />)

    await userEvent.click(screen.getByRole('button', { name: 'New plan' }))
    await userEvent.type(screen.getByPlaceholderText(/Pay rent/), 'Dentist')
    await userEvent.type(screen.getByPlaceholderText(/Gather documents/), 'Book slot')
    await userEvent.click(screen.getByRole('button', { name: 'Add plan' }))

    expect(submitPlan).toHaveBeenCalledWith({
      topic: 'Dentist',
      hours: 0.5,
      subtaskLines: 'Book slot',
      recurrence: { freq: 'once', date: TODAY },
    })
    // Form closes after submit.
    expect(screen.queryByRole('button', { name: 'Add plan' })).not.toBeInTheDocument()
  })

  it('cancel closes the form without submitting', async () => {
    const submitPlan = vi.fn()
    seedStore()
    useAppStore.setState({ submitPlan })
    render(<PlansPage />)
    await userEvent.click(screen.getByRole('button', { name: 'New plan' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(submitPlan).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'New plan' })).toBeInTheDocument()
  })
})

describe('PlanForm (edit)', () => {
  it('prefills the draft from the template and submits with the id', async () => {
    const plan = makePlan({
      topic: 'Pay rent',
      hours: 2,
      recurrence: { freq: 'monthly', dayOfMonth: 5 },
      subtasks: [{ text: 'Transfer' }],
    })
    const submitPlan = vi.fn()
    seedStore([plan])
    useAppStore.setState({ submitPlan })
    render(<PlansPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit plan "Pay rent"' }))
    expect(screen.getByDisplayValue('Pay rent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Day of month')).toHaveValue('5')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(submitPlan).toHaveBeenCalledWith({
      id: plan.id,
      topic: 'Pay rent',
      hours: 2,
      subtaskLines: 'Transfer',
      recurrence: { freq: 'monthly', dayOfMonth: 5 },
    })
  })
})

describe('PlanCard delete', () => {
  it('confirms, then deletes by id', async () => {
    const plan = makePlan({ topic: 'Pay rent' })
    const deletePlan = vi.fn()
    seedStore([plan])
    useAppStore.setState({ deletePlan })
    render(
      <>
        <PlansPage />
        <ConfirmDialogHost />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete plan "Pay rent"' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Stop plan' }))
    expect(deletePlan).toHaveBeenCalledWith(plan.id)
  })

  it('keeps the plan when the confirm is dismissed', async () => {
    const deletePlan = vi.fn()
    seedStore([makePlan({ topic: 'Pay rent' })])
    useAppStore.setState({ deletePlan })
    render(
      <>
        <PlansPage />
        <ConfirmDialogHost />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete plan "Pay rent"' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(deletePlan).not.toHaveBeenCalled()
  })
})

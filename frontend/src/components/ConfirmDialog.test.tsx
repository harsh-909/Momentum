import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfirmDialogHost } from './ConfirmDialog'
import { confirmDialog, useConfirmStore } from '../lib/confirm'

afterEach(() => {
  useConfirmStore.setState({ pending: null })
})

describe('ConfirmDialog', () => {
  it('resolves true when confirmed and closes', async () => {
    render(<ConfirmDialogHost />)
    const answer = confirmDialog({ title: 'Delete this goal?', confirmLabel: 'Delete', tone: 'danger' })
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete this goal?')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await answer).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('resolves false when cancelled', async () => {
    render(<ConfirmDialogHost />)
    const answer = confirmDialog({ title: 'Sure?' })
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(await answer).toBe(false)
  })

  it('resolves false on Escape', async () => {
    render(<ConfirmDialogHost />)
    const answer = confirmDialog({ title: 'Sure?' })
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(await answer).toBe(false)
  })

  it('shows the optional supporting message', async () => {
    render(<ConfirmDialogHost />)
    const answer = confirmDialog({ title: 'Remove?', message: 'This cannot be undone.' })
    expect(await screen.findByText('This cannot be undone.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await answer
  })

  it('focuses Cancel first for danger prompts', async () => {
    render(<ConfirmDialogHost />)
    const answer = confirmDialog({ title: 'Delete?', confirmLabel: 'Delete', tone: 'danger' })
    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await answer
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'

const TRIGGER = { name: 'Account menu for Harsh' }

describe('AccountMenu', () => {
  it('opens, runs the export action, and closes', async () => {
    const onExport = vi.fn()
    render(<AccountMenu name="Harsh" onExport={onExport} onImport={vi.fn()} onLogout={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', TRIGGER))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitem', { name: /export data/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('logs out via the menu', async () => {
    const onLogout = vi.fn()
    render(<AccountMenu name="Harsh" onExport={vi.fn()} onImport={vi.fn()} onLogout={onLogout} />)
    await userEvent.click(screen.getByRole('button', TRIGGER))
    await userEvent.click(screen.getByRole('menuitem', { name: /log out/i }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    render(<AccountMenu name="Harsh" onExport={vi.fn()} onImport={vi.fn()} onLogout={vi.fn()} />)
    const trigger = screen.getByRole('button', TRIGGER)
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('disables actions whose handler is missing', async () => {
    render(<AccountMenu name="Harsh" onLogout={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', TRIGGER))
    expect(screen.getByRole('menuitem', { name: /export data/i })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /import data/i })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeEnabled()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('shows the product pitch and core capabilities', () => {
    render(<LandingPage onGetStarted={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/keep the streak/i)
    expect(screen.getByText(/The Day Dial/)).toBeInTheDocument()
    expect(screen.getByText('Habits')).toBeInTheDocument()
    expect(screen.getByText(/Backlog & carry-over/)).toBeInTheDocument()
    expect(screen.getByText('Plans')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText(/Momentum metrics/)).toBeInTheDocument()
  })

  it('fires onGetStarted from every call-to-action', async () => {
    const onGetStarted = vi.fn()
    const user = userEvent.setup()
    render(<LandingPage onGetStarted={onGetStarted} />)

    await user.click(screen.getByRole('button', { name: /log in/i }))
    await user.click(screen.getByRole('button', { name: /i already have an account/i }))
    for (const btn of screen.getAllByRole('button', { name: /get started/i })) {
      await user.click(btn)
    }

    // Log in + "already have an account" + two "Get started" buttons.
    expect(onGetStarted).toHaveBeenCalledTimes(4)
  })
})

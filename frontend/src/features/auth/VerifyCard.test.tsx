import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { useAppStore } from '../../store/useAppStore'
import { VerifyCard } from './VerifyCard'

const initialState = useAppStore.getState()

beforeEach(() => localStorage.clear())
afterEach(() => useAppStore.setState(initialState, true))

function renderCard(overrides: Partial<{ verifyEmail: unknown; resendCode: unknown }> = {}) {
  const verifyEmail = vi.fn().mockResolvedValue(undefined)
  const resendCode = vi.fn().mockResolvedValue(undefined)
  useAppStore.setState({ verifyEmail, resendCode, ...overrides } as never)
  const onBack = vi.fn()
  render(<VerifyCard pendingToken="pt" email="a***@example.com" onBack={onBack} />)
  return { verifyEmail, resendCode, onBack }
}

describe('VerifyCard', () => {
  it('shows the masked destination address', () => {
    renderCard()
    expect(screen.getByText('a***@example.com')).toBeInTheDocument()
  })

  it('only accepts 6 numeric digits and submits them', async () => {
    const { verifyEmail } = renderCard()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/verification code/i), 'a1b2c3d4e5')
    expect(screen.getByLabelText(/verification code/i)).toHaveValue('12345')
    await user.type(screen.getByLabelText(/verification code/i), '6')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))
    expect(verifyEmail).toHaveBeenCalledWith('pt', '123456')
  })

  it('blocks submit until the code is complete', async () => {
    const { verifyEmail } = renderCard()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/verification code/i), '123')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))
    expect(verifyEmail).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/6-digit code/i)
  })

  it('maps an invalid_code error to a friendly message', async () => {
    const verifyEmail = vi.fn().mockRejectedValue(new ApiError(400, 'invalid_code', null))
    renderCard({ verifyEmail })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/verification code/i), '000000')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/wrong or has expired/i)
  })

  it('resends a code and enters a cooldown', async () => {
    const { resendCode } = renderCard()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /resend code/i }))
    expect(resendCode).toHaveBeenCalledWith('pt')
    expect(await screen.findByText(/fresh code is on its way/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend in \d+s/i })).toBeDisabled()
  })
})

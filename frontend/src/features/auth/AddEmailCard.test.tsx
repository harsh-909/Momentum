import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VerifyResult } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useAppStore } from '../../store/useAppStore'
import { AddEmailCard } from './AddEmailCard'

const initialState = useAppStore.getState()
const VERIFY: VerifyResult = { kind: 'verify', pendingToken: 'pt2', email: 'a***@example.com' }

beforeEach(() => localStorage.clear())
afterEach(() => useAppStore.setState(initialState, true))

describe('AddEmailCard', () => {
  it('validates the email before calling the store', async () => {
    const addEmail = vi.fn()
    useAppStore.setState({ addEmail } as never)
    render(<AddEmailCard pendingToken="pt" onBack={vi.fn()} onCodeSent={vi.fn()} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'nope')
    await user.click(screen.getByRole('button', { name: /send verification code/i }))
    expect(addEmail).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
  })

  it('sends the code and forwards the verify step', async () => {
    const addEmail = vi.fn().mockResolvedValue(VERIFY)
    const onCodeSent = vi.fn()
    useAppStore.setState({ addEmail } as never)
    render(<AddEmailCard pendingToken="pt" onBack={vi.fn()} onCodeSent={onCodeSent} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'Me@Example.com')
    await user.click(screen.getByRole('button', { name: /send verification code/i }))
    expect(addEmail).toHaveBeenCalledWith('pt', 'me@example.com')
    expect(onCodeSent).toHaveBeenCalledWith(VERIFY)
  })

  it('maps an expired token to a helpful message', async () => {
    const addEmail = vi.fn().mockRejectedValue(new ApiError(400, 'invalid_token', null))
    useAppStore.setState({ addEmail } as never)
    render(<AddEmailCard pendingToken="pt" onBack={vi.fn()} onCodeSent={vi.fn()} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'me@example.com')
    await user.click(screen.getByRole('button', { name: /send verification code/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/log in again/i)
  })
})

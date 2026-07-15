import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthedResult, LoginResult, SignupResult, VerifyResult } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useAppStore } from '../../store/useAppStore'
import { LoginCard } from './LoginCard'
import { getRecentUsers, rememberUser } from './recentUsers'

const initialState = useAppStore.getState()

const AUTHED: AuthedResult = {
  kind: 'authed',
  token: 'tok',
  user: { username: 'harsh', email: 'harsh@example.com' },
  expiresAt: '2099-01-01T00:00:00Z',
  emailVerified: true,
}
const VERIFY: VerifyResult = { kind: 'verify', pendingToken: 'pt', email: 'h***@example.com' }

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  useAppStore.setState(initialState, true)
})

function loginMock(result: LoginResult = AUTHED) {
  return vi.fn<(u: string, p: string) => Promise<LoginResult>>().mockResolvedValue(result)
}
function signupMock(result: SignupResult = VERIFY) {
  return vi
    .fn<(u: string, p: string, e: string) => Promise<SignupResult>>()
    .mockResolvedValue(result)
}

async function fillAndLogin(username: string, password: string) {
  const user = userEvent.setup()
  if (username) await user.type(screen.getByLabelText(/username/i), username)
  if (password) await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole('button', { name: /^log in$/i }))
}

describe('LoginCard validation', () => {
  it('rejects an invalid username without calling the store', async () => {
    const login = loginMock()
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('-bad-start', 'password123')
    expect(screen.getByRole('alert')).toHaveTextContent(/usernames are 1-32 characters/i)
    expect(login).not.toHaveBeenCalled()
  })

  it('rejects a short password without calling the store', async () => {
    const login = loginMock()
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('harsh', 'short')
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i)
    expect(login).not.toHaveBeenCalled()
  })

  it('requires a valid email when creating an account', async () => {
    const signup = signupMock()
    useAppStore.setState({ signup })
    const user = userEvent.setup()
    render(<LoginCard initialMode="signup" />)
    await user.type(screen.getByLabelText(/username/i), 'harsh')
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
    expect(signup).not.toHaveBeenCalled()
  })

  it('lowercases the username input', async () => {
    const user = userEvent.setup()
    render(<LoginCard />)
    await user.type(screen.getByLabelText(/username/i), 'HARSH')
    expect(screen.getByLabelText(/username/i)).toHaveValue('harsh')
  })
})

describe('LoginCard recent profiles', () => {
  it('renders pills from localStorage and prefills the username on click', async () => {
    localStorage.setItem('momentum.recentUsers', JSON.stringify(['harsh', 'alex']))
    const user = userEvent.setup()
    render(<LoginCard />)
    expect(screen.getByRole('button', { name: 'harsh' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'alex' }))
    expect(screen.getByLabelText(/username/i)).toHaveValue('alex')
    expect(screen.getByLabelText(/password/i)).toHaveFocus()
  })

  it('shows no pills when nothing is stored', () => {
    render(<LoginCard />)
    expect(screen.queryByText(/^recent$/i)).not.toBeInTheDocument()
  })
})

describe('LoginCard submit', () => {
  it('maps invalid_credentials to a friendly error', async () => {
    const login = vi
      .fn<(u: string, p: string) => Promise<LoginResult>>()
      .mockRejectedValue(new ApiError(401, 'invalid_credentials', null))
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('harsh', 'password123')
    expect(login).toHaveBeenCalledWith('harsh', 'password123')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password')
  })

  it('maps network_error to "Cannot reach the server"', async () => {
    const login = vi
      .fn<(u: string, p: string) => Promise<LoginResult>>()
      .mockRejectedValue(new ApiError(0, 'network_error', null))
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('harsh', 'password123')
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
  })

  it('maps username_unavailable when creating an account', async () => {
    const signup = vi
      .fn<(u: string, p: string, e: string) => Promise<SignupResult>>()
      .mockRejectedValue(new ApiError(409, 'username_unavailable', null))
    useAppStore.setState({ signup })
    const user = userEvent.setup()
    render(<LoginCard initialMode="signup" />)
    await user.type(screen.getByLabelText(/username/i), 'harsh')
    await user.type(screen.getByLabelText(/email/i), 'harsh@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That name is taken - log in instead?')
  })

  it('surfaces the verify step to onPending after signup', async () => {
    const signup = signupMock(VERIFY)
    const onPending = vi.fn()
    useAppStore.setState({ signup })
    const user = userEvent.setup()
    render(<LoginCard initialMode="signup" onPending={onPending} />)
    await user.type(screen.getByLabelText(/username/i), 'harsh')
    await user.type(screen.getByLabelText(/email/i), 'harsh@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(signup).toHaveBeenCalledWith('harsh', 'password123', 'harsh@example.com')
    expect(onPending).toHaveBeenCalledWith(VERIFY)
  })

  it('does not call onPending when a verified login authenticates', async () => {
    const login = loginMock(AUTHED)
    const onPending = vi.fn()
    useAppStore.setState({ login })
    render(<LoginCard onPending={onPending} />)
    await fillAndLogin('harsh', 'password123')
    expect(login).toHaveBeenCalled()
    expect(onPending).not.toHaveBeenCalled()
    expect(getRecentUsers()).toEqual(['harsh'])
  })

  it('routes an unverified login to onPending', async () => {
    const login = loginMock(VERIFY)
    const onPending = vi.fn()
    useAppStore.setState({ login })
    render(<LoginCard onPending={onPending} />)
    await fillAndLogin('harsh', 'password123')
    expect(onPending).toHaveBeenCalledWith(VERIFY)
  })
})

describe('rememberUser', () => {
  it('dedupes, prepends, and caps the list at 5', () => {
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) rememberUser(name)
    expect(getRecentUsers()).toEqual(['f', 'e', 'd', 'c', 'b'])
    rememberUser('d')
    expect(getRecentUsers()).toEqual(['d', 'f', 'e', 'c', 'b'])
  })

  it('survives corrupt localStorage', () => {
    localStorage.setItem('momentum.recentUsers', 'not-json{')
    expect(getRecentUsers()).toEqual([])
  })
})

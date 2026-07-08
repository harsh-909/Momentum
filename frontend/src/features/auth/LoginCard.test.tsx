import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { useAppStore } from '../../store/useAppStore'
import { LoginCard } from './LoginCard'
import { getRecentUsers, rememberUser } from './recentUsers'

const initialState = useAppStore.getState()

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  useAppStore.setState(initialState, true)
})

async function fillAndLogin(username: string, password: string) {
  const user = userEvent.setup()
  if (username) await user.type(screen.getByLabelText(/username/i), username)
  if (password) await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole('button', { name: /log in/i }))
}

describe('LoginCard validation', () => {
  it('rejects an invalid username without calling the store', async () => {
    const login = vi.fn<(u: string, p: string) => Promise<void>>()
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('-bad-start', 'password123')
    expect(screen.getByRole('alert')).toHaveTextContent(/usernames are 1-32 characters/i)
    expect(login).not.toHaveBeenCalled()
  })

  it('rejects a short password without calling the store', async () => {
    const login = vi.fn<(u: string, p: string) => Promise<void>>()
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('harsh', 'short')
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i)
    expect(login).not.toHaveBeenCalled()
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
    expect(screen.getByRole('button', { name: 'alex' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'alex' }))
    expect(screen.getByLabelText(/username/i)).toHaveValue('alex')
    expect(screen.getByLabelText(/password/i)).toHaveFocus()
  })

  it('shows no pills when nothing is stored', () => {
    render(<LoginCard />)
    expect(screen.queryByText(/recent/i)).not.toBeInTheDocument()
  })
})

describe('LoginCard submit', () => {
  it('maps invalid_credentials to a friendly error', async () => {
    const login = vi
      .fn<(u: string, p: string) => Promise<void>>()
      .mockRejectedValue(new ApiError(401, 'invalid_credentials', null))
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('harsh', 'password123')
    expect(login).toHaveBeenCalledWith('harsh', 'password123')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password')
  })

  it('maps network_error to "Cannot reach the server"', async () => {
    const login = vi
      .fn<(u: string, p: string) => Promise<void>>()
      .mockRejectedValue(new ApiError(0, 'network_error', null))
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('harsh', 'password123')
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
  })

  it('maps username_unavailable on signup', async () => {
    const signup = vi
      .fn<(u: string, p: string) => Promise<void>>()
      .mockRejectedValue(new ApiError(409, 'username_unavailable', null))
    useAppStore.setState({ signup })
    const user = userEvent.setup()
    render(<LoginCard />)
    await user.type(screen.getByLabelText(/username/i), 'harsh')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That name is taken - log in instead?',
    )
  })

  it('remembers the user after a successful login', async () => {
    const login = vi.fn<(u: string, p: string) => Promise<void>>().mockResolvedValue(undefined)
    useAppStore.setState({ login })
    render(<LoginCard />)
    await fillAndLogin('harsh', 'password123')
    expect(getRecentUsers()).toEqual(['harsh'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

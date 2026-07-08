import { request, setToken } from './client'

export interface AuthResponse {
  token: string
  user: { username: string }
  expiresAt: string
}

export interface MeResponse {
  username: string
  createdAt: string
}

export async function signup(username: string, password: string): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: { username, password },
  })
  setToken(res.token)
  return res
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
  setToken(res.token)
  return res
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/api/auth/logout', { method: 'POST' })
  } finally {
    setToken(null)
  }
}

export function me(): Promise<MeResponse> {
  return request<MeResponse>('/api/auth/me')
}

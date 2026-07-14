import { request, setToken } from './client'

/** An activated session (signup->verify or login of a verified account). */
export interface AuthedResult {
  kind: 'authed'
  token: string
  user: { username: string; email: string | null }
  expiresAt: string
  emailVerified: boolean
}

/** A code has been emailed; the client must collect it. `email` is masked. */
export interface VerifyResult {
  kind: 'verify'
  pendingToken: string
  email: string
}

/** A pre-email (legacy) account logged in and must add an email first. */
export interface AddEmailResult {
  kind: 'addEmail'
  pendingToken: string
}

export type SignupResult = VerifyResult
export type LoginResult = AuthedResult | VerifyResult | AddEmailResult

export interface MeResponse {
  username: string
  email: string | null
  emailVerified: boolean
  createdAt: string
}

/** Create an account. Never returns a session - always a code-verification step. */
export function signup(
  username: string,
  password: string,
  email: string,
): Promise<SignupResult> {
  return request<SignupResult>('/api/auth/signup', {
    method: 'POST',
    body: { username, password, email },
  })
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await request<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
  if (res.kind === 'authed') setToken(res.token)
  return res
}

/** Submit the 6-digit code; on success the account is active and logged in. */
export async function verifyEmail(pendingToken: string, code: string): Promise<AuthedResult> {
  const res = await request<AuthedResult>('/api/auth/verify-email', {
    method: 'POST',
    body: { pendingToken, code },
  })
  setToken(res.token)
  return res
}

export async function resendCode(pendingToken: string): Promise<void> {
  await request<{ ok: true }>('/api/auth/resend-code', {
    method: 'POST',
    body: { pendingToken },
  })
}

/** Attach an email to a pre-email account, triggering a verification code. */
export function addEmail(pendingToken: string, email: string): Promise<VerifyResult> {
  return request<VerifyResult>('/api/auth/add-email', {
    method: 'POST',
    body: { pendingToken, email },
  })
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

/**
 * Thin typed fetch wrapper. All API access goes through this module.
 *
 * Auth is an opaque Bearer token (kept in localStorage) - chosen over
 * cross-site cookies because the static frontend (Vercel) and the API
 * (Render) live on different origins and Safari blocks third-party cookies.
 *
 * In dev VITE_API_URL is empty and requests go to the same origin, where the
 * Vite proxy forwards /api to the local backend. In prod it is the Render URL.
 */

const BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'momentum.token'

export class ApiError extends Error {
  status: number
  /** Machine code from the body, e.g. "invalid_credentials", "version_conflict". */
  code: string
  /** Parsed response body, if any. */
  body: unknown

  constructor(status: number, code: string, body: unknown) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token === null) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, token)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Survive page unload (used by the persistence flush). */
  keepalive?: boolean
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      keepalive: opts.keepalive,
    })
  } catch (err) {
    throw new ApiError(0, 'network_error', err)
  }

  if (res.status === 204) return undefined as T

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON body (should not happen) - leave null */
  }

  if (!res.ok) {
    const code =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `http_${res.status}`
    throw new ApiError(res.status, code, body)
  }
  return body as T
}

import { useRef, useState } from 'react'
import type { LoginResult, SignupResult } from '../../api/auth'
import { ApiError } from '../../api/client'
import { Card } from '../../components/Card'
import { useAppStore } from '../../store/useAppStore'
import { USERNAME_RE } from '../../types/domain'
import { getRecentUsers, rememberUser } from './recentUsers'
import { BACK_BTN_CLS, FIELD_CLS, PRIMARY_BTN_CLS } from './styles'

const MIN_PASSWORD = 8
// Light client-side check; the server (EmailStr) is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Mode = 'login' | 'signup'

/** Non-authed outcome that hands control to the verification flow. */
export type AuthPending = Exclude<LoginResult, { kind: 'authed' }>

function messageFor(err: unknown, mode: Mode): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_credentials':
        return 'Wrong username or password - or create an account if you are new.'
      case 'username_unavailable':
        return 'That name is taken - log in instead?'
      case 'invalid_input':
        return 'Check your details: username, password (8+ chars), and a valid email.'
      case 'network_error':
        return 'Cannot reach the server'
      case 'rate_limited': {
        const retry =
          typeof err.body === 'object' && err.body !== null && 'retryAfter' in err.body
            ? Number((err.body as { retryAfter: unknown }).retryAfter)
            : NaN
        return Number.isFinite(retry)
          ? `Too many attempts - try again in ${Math.ceil(retry / 60)} min.`
          : 'Too many attempts - wait a bit and try again.'
      }
    }
  }
  return mode === 'login' ? 'Could not log in - try again' : 'Could not sign up - try again'
}

/**
 * Sign-in / create-account card. A single mode toggle switches between logging
 * in (username + password) and creating an account (adds a required email).
 * Neither path drops the user straight into the app anymore: a successful
 * login of a verified account authenticates via the store; every other outcome
 * (new signup, unverified login, pre-email account) is surfaced through
 * `onPending` so the parent can show the code / add-email step.
 */
export function LoginCard({
  initialMode = 'login',
  onBack,
  onPending,
}: {
  initialMode?: Mode
  onBack?: () => void
  onPending?: (result: AuthPending) => void
} = {}) {
  const login = useAppStore((s) => s.login)
  const signup = useAppStore((s) => s.signup)

  const [mode, setMode] = useState<Mode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recent] = useState(getRecentUsers)
  const passwordRef = useRef<HTMLInputElement>(null)

  const isSignup = mode === 'signup'

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setError(null)
  }

  const submit = async () => {
    if (busy) return
    const name = username.trim().toLowerCase()
    const mail = email.trim().toLowerCase()
    setError(null)
    if (!USERNAME_RE.test(name)) {
      setError('Usernames are 1-32 characters: lowercase letters, numbers, "-" or "_"')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`)
      return
    }
    if (isSignup && !EMAIL_RE.test(mail)) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      if (isSignup) {
        const result: SignupResult = await signup(name, password, mail)
        rememberUser(name)
        onPending?.(result)
      } else {
        const result = await login(name, password)
        rememberUser(name)
        if (result.kind !== 'authed') onPending?.(result)
        // 'authed' -> the store flips session.status and this card unmounts.
      }
    } catch (err) {
      setError(messageFor(err, mode))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padding="lg" className="w-full max-w-sm">
      {onBack && (
        <button type="button" onClick={onBack} className={BACK_BTN_CLS}>
          <span aria-hidden="true">←</span> Back
        </button>
      )}
      <div className="font-display text-xs label-caps text-accent-text">Momentum</div>
      <h1 className="mt-1 font-display text-section font-semibold text-ink">
        {isSignup ? 'Create your account' : 'Sign in'}
      </h1>
      <hr className="tick-rule my-4" />

      {!isSignup && recent.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 font-display text-xs label-caps text-muted">Recent</div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUsername(u)
                  passwordRef.current?.focus()
                }}
                className="rounded-badge border border-line px-2 py-0.5 text-xs font-mono-num text-muted transition-colors duration-150 ease-click hover:border-accent hover:text-accent-text"
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            disabled={busy}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. harsh"
            className={FIELD_CLS}
          />
        </label>

        {isSignup && (
          <label className="block">
            <span className="mb-1 block font-display text-xs label-caps text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              className={FIELD_CLS}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">Password</span>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder="8+ characters"
            className={FIELD_CLS}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-alert-text">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={`${PRIMARY_BTN_CLS} w-full`}>
          {busy
            ? isSignup
              ? 'Creating…'
              : 'Logging in…'
            : isSignup
              ? 'Create account'
              : 'Log in'}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-muted">
        {isSignup ? 'Already have an account?' : 'New to Momentum?'}{' '}
        <button
          type="button"
          onClick={switchMode}
          disabled={busy}
          className="font-medium text-accent-text hover:underline disabled:opacity-60"
        >
          {isSignup ? 'Log in' : 'Create an account'}
        </button>
      </div>
    </Card>
  )
}

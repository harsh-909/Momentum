import { useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { Card } from '../../components/Card'
import { useAppStore } from '../../store/useAppStore'
import { USERNAME_RE } from '../../types/domain'
import { getRecentUsers, rememberUser } from './recentUsers'

const MIN_PASSWORD = 8

type Mode = 'login' | 'signup'

function messageFor(err: unknown, mode: Mode): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_credentials':
        return 'Wrong username or password - or sign up if you are new.'
      case 'username_unavailable':
        return 'That name is taken - log in instead?'
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

const FIELD_CLS =
  'w-full rounded-btn border border-line bg-dial px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors duration-150 ease-click focus:border-accent focus:outline-none disabled:opacity-50'

export function LoginCard({ onBack }: { onBack?: () => void } = {}) {
  const login = useAppStore((s) => s.login)
  const signup = useAppStore((s) => s.signup)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Mode | null>(null)
  // Which button the user is heading for - drives the password autocomplete
  // hint so password managers offer save-new vs fill-existing correctly.
  const [mode, setMode] = useState<Mode>('login')
  // Read once on mount; the list only changes after a successful submit.
  const [recent] = useState(getRecentUsers)
  const passwordRef = useRef<HTMLInputElement>(null)

  const submit = async (mode: Mode) => {
    if (busy) return
    const name = username.trim().toLowerCase()
    setError(null)
    if (!USERNAME_RE.test(name)) {
      setError('Usernames are 1-32 characters: lowercase letters, numbers, "-" or "_"')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`)
      return
    }
    setBusy(mode)
    try {
      await (mode === 'login' ? login(name, password) : signup(name, password))
      rememberUser(name)
    } catch (err) {
      setError(messageFor(err, mode))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card padding="lg" className="w-full max-w-sm">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 font-display text-xs label-caps text-muted transition-colors duration-150 ease-click hover:text-ink"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      )}
      <div className="font-display text-xs label-caps text-accent-text">Momentum</div>
      <h1 className="mt-1 font-display text-section font-semibold text-ink">Sign in</h1>
      <hr className="tick-rule my-4" />

      {recent.length > 0 && (
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

      {/* Enter anywhere in the form submits as a login. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit('login')
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            disabled={busy !== null}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. harsh"
            className={FIELD_CLS}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">Password</span>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy !== null}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="8+ characters"
            className={FIELD_CLS}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-alert-text">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            onMouseDown={() => setMode('login')}
            onFocus={() => setMode('login')}
            disabled={busy !== null}
            className="flex-1 rounded-btn bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent transition-opacity duration-150 ease-click hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'login' ? 'Logging in…' : 'Log in'}
          </button>
          <button
            type="button"
            onMouseDown={() => setMode('signup')}
            onFocus={() => setMode('signup')}
            onClick={() => void submit('signup')}
            disabled={busy !== null}
            className="flex-1 rounded-btn border border-line px-4 py-2 text-sm font-medium text-ink transition-colors duration-150 ease-click hover:border-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'signup' ? 'Signing up…' : 'Sign up'}
          </button>
        </div>
      </form>
    </Card>
  )
}

import { useState } from 'react'
import type { VerifyResult } from '../../api/auth'
import { ApiError } from '../../api/client'
import { Card } from '../../components/Card'
import { useAppStore } from '../../store/useAppStore'
import { BACK_BTN_CLS, FIELD_CLS, PRIMARY_BTN_CLS } from './styles'

// Light client-side sanity check; the server is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_token':
        return 'This session expired - go back and log in again.'
      case 'invalid_input':
        return 'That email address does not look valid.'
      case 'network_error':
        return 'Cannot reach the server - check your connection.'
      case 'rate_limited':
        return 'Too many attempts - wait a moment and try again.'
    }
  }
  return 'Could not send the code - try again.'
}

/**
 * Shown when a pre-email (legacy) account logs in: collect an email address so
 * a verification code can be sent, then hand off to the VerifyCard.
 */
export function AddEmailCard({
  pendingToken,
  onBack,
  onCodeSent,
}: {
  pendingToken: string
  onBack: () => void
  onCodeSent: (result: VerifyResult) => void
}) {
  const addEmail = useAppStore((s) => s.addEmail)

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setError(null)
    const clean = email.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      const result = await addEmail(pendingToken, clean)
      onCodeSent(result)
    } catch (err) {
      setError(messageFor(err))
      setBusy(false)
    }
  }

  return (
    <Card padding="lg" className="w-full max-w-sm">
      <button type="button" onClick={onBack} className={BACK_BTN_CLS}>
        <span aria-hidden="true">←</span> Back
      </button>
      <div className="font-display text-xs label-caps text-accent-text">Momentum</div>
      <h1 className="mt-1 font-display text-section font-semibold text-ink">Add your email</h1>
      <p className="mt-1 text-sm text-muted">
        Accounts now need a verified email. Add yours and we'll send a code to confirm it - it
        keeps your data recoverable.
      </p>
      <hr className="tick-rule my-4" />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">Email</span>
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@example.com"
            className={FIELD_CLS}
            autoFocus
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-alert-text">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={`${PRIMARY_BTN_CLS} w-full`}>
          {busy ? 'Sending…' : 'Send verification code'}
        </button>
      </form>
    </Card>
  )
}

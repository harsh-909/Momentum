import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { Card } from '../../components/Card'
import { useAppStore } from '../../store/useAppStore'
import { BACK_BTN_CLS, FIELD_CLS, PRIMARY_BTN_CLS } from './styles'

const CODE_LEN = 6

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_code':
        return 'That code is wrong or has expired. Check your email or resend a new one.'
      case 'email_unavailable':
        return 'That email is already tied to another account - try logging in instead.'
      case 'network_error':
        return 'Cannot reach the server - check your connection.'
      case 'rate_limited':
        return 'Too many tries - wait a moment and resend a fresh code.'
    }
  }
  return 'Could not verify the code - try again.'
}

/**
 * Second step of signup / gated login: enter the 6-digit code emailed to the
 * user. On success the store transitions the session to authed and the app
 * renders. Offers a resend with a short cooldown.
 */
export function VerifyCard({
  pendingToken,
  email,
  onBack,
}: {
  pendingToken: string
  /** Masked address for the "sent to" hint, e.g. a***@example.com. */
  email: string
  onBack: () => void
}) {
  const verifyEmail = useAppStore((s) => s.verifyEmail)
  const resendCode = useAppStore((s) => s.resendCode)

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop the cooldown ticker if the card unmounts mid-countdown.
  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const submit = async () => {
    if (busy) return
    setError(null)
    if (code.length !== CODE_LEN) {
      setError(`Enter the ${CODE_LEN}-digit code from your email`)
      return
    }
    setBusy(true)
    try {
      await verifyEmail(pendingToken, code)
      // Success: the store flips session.status to 'authed'; this card unmounts.
    } catch (err) {
      setError(messageFor(err))
      setBusy(false)
    }
  }

  const startCooldown = () => {
    setCooldown(30)
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) {
          clearInterval(timer.current)
          timer.current = null
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const resend = async () => {
    if (busy || resending || cooldown > 0) return
    setResending(true)
    setError(null)
    setNotice(null)
    try {
      await resendCode(pendingToken)
      setNotice('A fresh code is on its way.')
      setCode('')
      startCooldown()
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <Card padding="lg" className="w-full max-w-sm">
      <button type="button" onClick={onBack} className={BACK_BTN_CLS}>
        <span aria-hidden="true">←</span> Back
      </button>
      <div className="font-display text-xs label-caps text-accent-text">Momentum</div>
      <h1 className="mt-1 font-display text-section font-semibold text-ink">Check your email</h1>
      <p className="mt-1 text-sm text-muted">
        We sent a {CODE_LEN}-digit code to <span className="text-ink">{email}</span>. Enter it below
        to finish setting up your account.
      </p>
      <hr className="tick-rule my-4" />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">
            Verification code
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LEN))}
            disabled={busy}
            placeholder="123456"
            aria-label="Verification code"
            className={`${FIELD_CLS} text-center font-mono-num text-lg tracking-[0.4em]`}
            autoFocus
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-alert-text">
            {error}
          </p>
        )}
        {notice && !error && <p className="text-sm text-good-text">{notice}</p>}

        <button type="submit" disabled={busy} className={`${PRIMARY_BTN_CLS} w-full`}>
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-muted">
        Didn't get it?{' '}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={busy || resending || cooldown > 0}
          className="font-medium text-accent-text hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </Card>
  )
}

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { VerifyResult } from '../../api/auth'
import { DialTicks } from '../../components/EmptyState'
import { useAppStore } from '../../store/useAppStore'
import { LandingPage } from '../marketing/LandingPage'
import { AddEmailCard } from './AddEmailCard'
import type { AuthPending } from './LoginCard'
import { LoginCard } from './LoginCard'
import { VerifyCard } from './VerifyCard'

/** Boot splash while a stored token is validated: wordmark + pulsing tick ring. */
function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <DialTicks className="splash-pulse h-16 w-16 text-muted" />
      <div className="font-display text-xs label-caps text-muted">Momentum</div>
    </div>
  )
}

type AnonView =
  | { screen: 'landing' }
  | { screen: 'auth'; mode: 'login' | 'signup' }
  | { screen: 'verify'; pendingToken: string; email: string }
  | { screen: 'addEmail'; pendingToken: string }

function centered(node: ReactNode) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{node}</div>
}

/**
 * The anonymous flow: public landing page, then sign-in / create-account, then
 * the mandatory verification steps. A successful verified login or a completed
 * verification flips session.status to 'authed' (in the store), at which point
 * AuthGate renders the app instead.
 */
function AnonFlow() {
  const [view, setView] = useState<AnonView>({ screen: 'landing' })

  const handlePending = (result: AuthPending) => {
    if (result.kind === 'verify') {
      setView({ screen: 'verify', pendingToken: result.pendingToken, email: result.email })
    } else {
      setView({ screen: 'addEmail', pendingToken: result.pendingToken })
    }
  }

  const onCodeSent = (result: VerifyResult) =>
    setView({ screen: 'verify', pendingToken: result.pendingToken, email: result.email })

  switch (view.screen) {
    case 'landing':
      return (
        <LandingPage
          onGetStarted={(mode = 'signup') => setView({ screen: 'auth', mode })}
        />
      )
    case 'auth':
      return centered(
        <LoginCard
          initialMode={view.mode}
          onBack={() => setView({ screen: 'landing' })}
          onPending={handlePending}
        />,
      )
    case 'verify':
      return centered(
        <VerifyCard
          pendingToken={view.pendingToken}
          email={view.email}
          onBack={() => setView({ screen: 'auth', mode: 'login' })}
        />,
      )
    case 'addEmail':
      return centered(
        <AddEmailCard
          pendingToken={view.pendingToken}
          onBack={() => setView({ screen: 'auth', mode: 'login' })}
          onCodeSent={onCodeSent}
        />,
      )
  }
}

/**
 * Session gate: splash while checking; the anonymous flow (landing -> auth ->
 * verify) when signed out; the app (children) once authed.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAppStore((s) => s.session.status)

  if (status === 'checking') return <Splash />
  if (status === 'anon') return <AnonFlow />
  return <>{children}</>
}

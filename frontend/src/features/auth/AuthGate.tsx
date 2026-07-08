import type { ReactNode } from 'react'
import { DialTicks } from '../../components/EmptyState'
import { useAppStore } from '../../store/useAppStore'
import { LoginCard } from './LoginCard'

/** Boot splash while a stored token is validated: wordmark + pulsing tick ring. */
function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <DialTicks className="splash-pulse h-16 w-16 text-muted" />
      <div className="font-display text-xs label-caps text-muted">Momentum</div>
    </div>
  )
}

/**
 * Session gate: splash while checking, centered LoginCard when anonymous,
 * the app (children) once authed.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAppStore((s) => s.session.status)

  if (status === 'checking') return <Splash />
  if (status === 'anon') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <LoginCard />
      </div>
    )
  }
  return <>{children}</>
}

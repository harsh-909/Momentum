import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { AccountMenu } from './AccountMenu'
import { IconButton } from './Button'
import { SaveStatusChip } from './SaveStatusChip'

const THEME_KEY = 'momentum.theme'

/** Time-of-day greeting, ported from v1. */
function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Winding down'
}

/** Sun/moon toggle for the .dark class; explicit choice wins over the OS. */
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      /* storage unavailable - theme just won't persist */
    }
  }
  return (
    <IconButton label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          // sun
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
          </>
        ) : (
          // moon
          <path d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5a5.8 5.8 0 1 0 7.3 7.3z" />
        )}
      </svg>
    </IconButton>
  )
}

/** Thin-stroke flame for the streak chip (instrument style, no emoji). */
function FlameIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.8c.4 2.3-1.6 3.4-2.6 5A4.7 4.7 0 0 0 8 14.2a4.7 4.7 0 0 0 4.7-4.7c0-2.7-2.4-3.6-2.9-6-1 .7-1.5 1.9-1.3 3.2C7.6 5.6 7.9 3.6 8 1.8z" />
    </svg>
  )
}

export interface HeaderProps {
  /** Current day streak; integrator computes it from engine metrics. */
  streak: number
  /** Wired by integration (M2). Buttons render disabled until provided. */
  onExport?: () => void
  onImport?: () => void
}

export function Header({ streak, onExport, onImport }: HeaderProps) {
  const user = useAppStore((s) => s.session.user)
  const quote = useAppStore((s) => s.ui.quote)
  const saveStatus = useAppStore((s) => s.ui.saveStatus)
  const flushNow = useAppStore((s) => s.flushNow)
  const logout = useAppStore((s) => s.logout)

  const name = user?.username ?? ''
  const displayName = name ? name.charAt(0).toUpperCase() + name.slice(1) : ''

  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <div className="font-display text-xs label-caps text-accent-text">Momentum</div>
        <h1 className="truncate font-display text-section font-semibold text-ink">
          {greeting()}
          {displayName ? `, ${displayName}` : ''}
        </h1>
        {quote && <p className="mt-0.5 truncate text-xs italic text-muted">{quote}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          title={`${streak}-day streak`}
          className={`hidden items-center gap-1.5 rounded-badge border px-2 py-1 text-xs font-mono-num sm:inline-flex ${
            streak > 0 ? 'border-accent/40 text-accent-text' : 'border-line text-muted'
          }`}
        >
          <FlameIcon />
          {streak}
          <span className="sr-only">day streak</span>
        </span>

        <SaveStatusChip status={saveStatus} onRetry={() => void flushNow()} />

        <ThemeToggle />

        <AccountMenu
          name={displayName}
          onExport={onExport}
          onImport={onImport}
          onLogout={() => void logout()}
        />
      </div>
    </header>
  )
}

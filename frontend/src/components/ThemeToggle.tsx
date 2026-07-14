import { useState } from 'react'
import { IconButton } from './Button'

const THEME_KEY = 'momentum.theme'

/**
 * Sun/moon toggle for the `.dark` class on <html>; an explicit choice wins
 * over the OS preference and is persisted to localStorage.
 *
 * Shared by the authed header and the public landing page so there is one
 * source of truth for the toggle's behavior and icon.
 */
export function ThemeToggle() {
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

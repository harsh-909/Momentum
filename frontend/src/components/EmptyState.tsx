import type { ReactNode } from 'react'

/**
 * Faint 60-tick dial ring, instrument style. Every 5th tick is emphasized.
 * Reused by the AuthGate splash; color comes from `currentColor`.
 */
export function DialTicks({ className = '' }: { className?: string }) {
  const ticks = Array.from({ length: 60 }, (_, i) => i * 6)
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {ticks.map((angle) => (
        <line
          key={angle}
          x1="50"
          y1="3"
          x2="50"
          y2={angle % 30 === 0 ? 10 : 7}
          transform={`rotate(${angle} 50 50)`}
          stroke="currentColor"
          strokeWidth={angle % 30 === 0 ? 1.5 : 0.75}
        />
      ))}
    </svg>
  )
}

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  hint: string
}

/** Empty list placeholder: muted dial illustration with the icon centered. */
export function EmptyState({ icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-5 flex h-28 w-28 items-center justify-center">
        <DialTicks className="absolute inset-0 h-full w-full text-muted opacity-30" />
        <span className="text-muted" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="font-display text-base font-semibold text-ink">{title}</div>
      <p className="mt-1 max-w-xs text-sm text-muted">{hint}</p>
    </div>
  )
}

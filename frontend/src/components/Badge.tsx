import type { ReactNode } from 'react'

export type BadgeVariant = 'default' | 'good' | 'accent'

const VARIANT: Record<BadgeVariant, string> = {
  default: 'border-line text-muted',
  good: 'border-good/40 text-good-text',
  accent: 'border-accent/40 text-accent-text',
}

export interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: ReactNode
}

/** Outline badge, 6px radius. Numerals inside should use font-mono-num. */
export function Badge({ variant = 'default', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-badge border px-1.5 py-0.5 text-xs ${VARIANT[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

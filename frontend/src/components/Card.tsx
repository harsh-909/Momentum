import type { HTMLAttributes } from 'react'

type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
}

/** Instrument face: flat surface, hairline border, 10px radius, no shadow. */
export function Card({ padding = 'md', className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-card border border-line bg-face ${PADDING[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

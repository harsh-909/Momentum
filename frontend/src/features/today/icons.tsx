/**
 * Thin-stroke instrument-style icons for the Today feature (no emoji).
 * All inherit `currentColor`; size via the className.
 */

interface IconProps {
  className?: string
}

function base(className: string) {
  return {
    viewBox: '0 0 16 16',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
}

/** Day empty state. */
export function SunIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </svg>
  )
}

/** Evening empty state. */
export function MoonIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5a5.8 5.8 0 1 0 7.3 7.3z" />
    </svg>
  )
}

/** Read-only past-day notice. */
export function LockIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

/** Edit action. */
export function PencilIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 13l.7-2.8 7.2-7.2a1.2 1.2 0 0 1 1.7 0l.4.4a1.2 1.2 0 0 1 0 1.7l-7.2 7.2L3 13z" />
    </svg>
  )
}

/** Delete / remove action. */
export function XIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />
    </svg>
  )
}

/** Done (finish editing) action. */
export function CheckIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 8.6 6.4 12 13 4.6" />
    </svg>
  )
}

/** Move to backlog: arrow dropping into a box. */
export function BoxArrowIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M2.5 9.5v3a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3" />
      <path d="M8 2.5V9M5.2 6.4 8 9.2l2.8-2.8" />
    </svg>
  )
}

/** Habit badge: circling arrows. */
export function RotateIcon({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13.2 8A5.2 5.2 0 0 1 4 11.3M2.8 8A5.2 5.2 0 0 1 12 4.7" />
      <path d="M12.2 2.2v2.5h-2.5M3.8 13.8v-2.5h2.5" />
    </svg>
  )
}

/** Carried badge: return arrow. */
export function ReturnIcon({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13 3.5V7a2 2 0 0 1-2 2H3.5" />
      <path d="M6 6.5 3 9.5l3 3" />
    </svg>
  )
}

/** Drag handle: 2x3 grip dots (filled, no stroke). */
export function GripIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      {[3.5, 8, 12.5].map((y) => (
        <g key={y}>
          <circle cx="5.5" cy={y} r="1" />
          <circle cx="10.5" cy={y} r="1" />
        </g>
      ))}
    </svg>
  )
}

/** Add-goal / add-subtask plus. */
export function PlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

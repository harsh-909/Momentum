export interface CheckToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** Accessible name, e.g. the goal topic. */
  label: string
  /** Read-only past days render the toggle but refuse interaction. */
  disabled?: boolean
  className?: string
}

/**
 * Circular check button. Checked = orange fill with the check path "stamped"
 * in via a stroke-dashoffset transition (180ms).
 */
export function CheckToggle({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}: CheckToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`hit-halo inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ease-click disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'border-accent-fill bg-accent-fill' : 'border-line bg-face hover:border-muted'
      } ${className}`}
    >
      <svg viewBox="0 0 22 22" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M5.5 11.5 9.5 15.5 16.5 7.5"
          fill="none"
          stroke="var(--color-on-accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={checked ? 0 : 1}
          style={{ transition: 'stroke-dashoffset 180ms var(--ease-click)' }}
        />
      </svg>
    </button>
  )
}

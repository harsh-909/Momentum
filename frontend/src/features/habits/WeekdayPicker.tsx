/**
 * Weekday schedule picker: 7 toggle buttons (Su..Sa, JS getDay order) plus
 * the three v1 presets. At least one day is required - the empty state shows
 * an alert hint here and the form disables submit.
 */

export interface WeekdayPickerProps {
  /** Selected weekday indices, 0 = Sunday .. 6 = Saturday. */
  value: number[]
  onChange: (days: number[]) => void
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const PRESETS: Array<{ label: string; days: number[] }> = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
]

export function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  const toggle = (day: number) => {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day])
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs label-caps text-muted">Repeat on</span>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange([...p.days])}
              className="rounded-badge border border-line px-2 py-0.5 text-xs text-muted transition-colors duration-150 ease-click hover:border-accent hover:text-accent-text"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        {DAY_LABELS.map((label, day) => {
          const selected = value.includes(day)
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(day)}
              className={`flex-1 rounded-btn border py-2 text-xs font-mono-num font-medium transition-colors duration-150 ease-click ${
                selected
                  ? 'border-accent-fill bg-accent-fill text-on-accent'
                  : 'border-line text-muted hover:border-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {value.length === 0 && (
        <p role="alert" className="mt-1.5 text-xs text-alert-text">
          Pick at least one day
        </p>
      )}
    </div>
  )
}

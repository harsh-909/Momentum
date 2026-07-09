/**
 * Frequency picker for Plans - the plan analogue of WeekdayPicker. A segmented
 * Once / Monthly / Yearly control, then the field(s) the chosen frequency
 * needs, plus a live human-readable preview. Switching frequency emits a
 * COMPLETE default recurrence, preserving reusable sub-values (chosen day,
 * chosen month) so toggling back and forth doesn't lose the user's input.
 */
import { recurrenceLabel } from '../../lib/engine/recurrence'
import { parseLocalDate } from '../../lib/engine/dates'
import type { DateStr, Recurrence, RecurrenceFreq } from '../../types/domain'

export interface FrequencyPickerProps {
  value: Recurrence
  today: DateStr
  onChange: (rec: Recurrence) => void
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PRESETS: Array<{ freq: RecurrenceFreq; label: string }> = [
  { freq: 'once', label: 'Once' },
  { freq: 'monthly', label: 'Monthly' },
  { freq: 'yearly', label: 'Yearly' },
]

const SELECT_CLS =
  'rounded-btn border border-line bg-dial px-2 py-1.5 text-sm font-mono-num text-ink transition-colors duration-150 ease-click focus:border-accent focus:outline-none'

/** Current month (1..12) of a date string. */
function currentMonthOf(today: DateStr): number {
  return parseLocalDate(today).getMonth() + 1
}

/**
 * Is this recurrence complete enough to schedule?
 * - once: a non-empty target date
 * - weekly: at least one weekday
 * - monthly: dayOfMonth 1..31
 * - yearly: month 1..12 AND dayOfMonth 1..31
 */
export function isRecurrenceValid(rec: Recurrence): boolean {
  switch (rec.freq) {
    case 'once':
      return !!rec.date
    case 'weekly':
      return !!rec.days && rec.days.length > 0
    case 'monthly':
      return rec.dayOfMonth != null && rec.dayOfMonth >= 1 && rec.dayOfMonth <= 31
    case 'yearly':
      return (
        rec.month != null &&
        rec.month >= 1 &&
        rec.month <= 12 &&
        rec.dayOfMonth != null &&
        rec.dayOfMonth >= 1 &&
        rec.dayOfMonth <= 31
      )
    default:
      return false
  }
}

/** Build a complete default recurrence for `freq`, reusing prior sub-values. */
function defaultFor(freq: RecurrenceFreq, prev: Recurrence, today: DateStr): Recurrence {
  switch (freq) {
    case 'once':
      return { freq: 'once', date: prev.date ?? today }
    case 'monthly':
      return { freq: 'monthly', dayOfMonth: prev.dayOfMonth ?? 1 }
    case 'yearly':
      return { freq: 'yearly', month: prev.month ?? currentMonthOf(today), dayOfMonth: prev.dayOfMonth ?? 1 }
    default:
      return { freq: 'once', date: today }
  }
}

const DAYS_1_31 = Array.from({ length: 31 }, (_, i) => i + 1)

export function FrequencyPicker({ value, today, onChange }: FrequencyPickerProps) {
  return (
    <div>
      <span className="mb-1.5 block font-display text-xs label-caps text-muted">Schedule</span>

      <div className="flex gap-1.5">
        {PRESETS.map((p) => {
          const selected = value.freq === p.freq
          return (
            <button
              key={p.freq}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(defaultFor(p.freq, value, today))}
              className={`flex-1 rounded-btn border py-2 text-xs font-medium transition-colors duration-150 ease-click ${
                selected
                  ? 'border-accent-fill bg-accent-fill text-on-accent'
                  : 'border-line text-muted hover:border-muted'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3">
        {value.freq === 'once' && (
          <label className="block">
            <span className="mb-1 block font-display text-xs label-caps text-muted">Date</span>
            <input
              type="date"
              min={today}
              value={value.date ?? ''}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
              className="rounded-btn border border-line bg-dial px-2 py-1.5 text-sm font-mono-num text-ink transition-colors duration-150 ease-click focus:border-accent focus:outline-none"
            />
          </label>
        )}

        {value.freq === 'monthly' && (
          <div>
            <label className="block">
              <span className="mb-1 block font-display text-xs label-caps text-muted">Day of month</span>
              <select
                aria-label="Day of month"
                value={value.dayOfMonth ?? 1}
                onChange={(e) => onChange({ ...value, dayOfMonth: Number(e.target.value) })}
                className={SELECT_CLS}
              >
                {DAYS_1_31.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-1 text-xs text-muted">
              Days 29-31 fall on the last day of shorter months.
            </p>
          </div>
        )}

        {value.freq === 'yearly' && (
          <div className="flex gap-2">
            <label className="block">
              <span className="mb-1 block font-display text-xs label-caps text-muted">Month</span>
              <select
                aria-label="Month"
                value={value.month ?? currentMonthOf(today)}
                onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
                className={SELECT_CLS}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-display text-xs label-caps text-muted">Day</span>
              <select
                aria-label="Day"
                value={value.dayOfMonth ?? 1}
                onChange={(e) => onChange({ ...value, dayOfMonth: Number(e.target.value) })}
                className={SELECT_CLS}
              >
                {DAYS_1_31.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted">{recurrenceLabel(value)}</p>
    </div>
  )
}

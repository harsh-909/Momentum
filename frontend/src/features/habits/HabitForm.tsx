/**
 * Add/edit habit form. Holds the draft locally and hands the whole
 * HabitDraft to the store on submit (the engine trims, defaults empty time
 * to 30m, and sorts the days). Empty topic or zero days disables submit -
 * v1 semantics.
 */
import { useState } from 'react'
import { Card } from '../../components/Card'
import { HmInput } from '../../components/HmInput'
import type { HabitDraft } from '../../store/types'
import { WeekdayPicker } from './WeekdayPicker'

export interface HabitFormProps {
  /** Present when editing; a fresh draft is used otherwise. */
  initial?: HabitDraft | null
  onSubmit: (draft: HabitDraft) => void
  onCancel: () => void
}

const FIELD_CLS =
  'w-full rounded-btn border border-line bg-dial px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors duration-150 ease-click focus:border-accent focus:outline-none'

function blankDraft(): HabitDraft {
  // v1 resetNewHabit: 30 minutes, every day.
  return { topic: '', hours: 0.5, subtaskLines: '', days: [0, 1, 2, 3, 4, 5, 6] }
}

export function HabitForm({ initial = null, onSubmit, onCancel }: HabitFormProps) {
  const [draft, setDraft] = useState<HabitDraft>(() => (initial ? { ...initial } : blankDraft()))
  const editing = Boolean(initial?.id)
  const valid = draft.topic.trim().length > 0 && draft.days.length > 0

  return (
    <Card className="mb-5">
      <div className="font-display text-xs label-caps text-muted">
        {editing ? 'Edit habit' : 'New habit'}
      </div>
      <hr className="tick-rule my-3" />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSubmit({ ...draft, topic: draft.topic.trim() })
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">Habit</span>
          <input
            type="text"
            value={draft.topic}
            onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
            placeholder="e.g. Yoga, Morning walk, Read 20 pages"
            autoFocus
            className={FIELD_CLS}
          />
        </label>

        <div>
          <span className="mb-1 block font-display text-xs label-caps text-muted">
            Time per day
          </span>
          <HmInput
            valueHours={draft.hours}
            onChange={(dec) => setDraft((d) => ({ ...d, hours: dec }))}
            label="per day"
          />
        </div>

        <WeekdayPicker value={draft.days} onChange={(days) => setDraft((d) => ({ ...d, days }))} />

        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">
            Subtasks (optional, one per line)
          </span>
          <textarea
            value={draft.subtaskLines}
            onChange={(e) => setDraft((d) => ({ ...d, subtaskLines: e.target.value }))}
            rows={3}
            placeholder={'Warm up\n20 min flow\nCool down'}
            className={`${FIELD_CLS} resize-none`}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-btn px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 ease-click hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-btn bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent transition-opacity duration-150 ease-click hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {editing ? 'Save changes' : 'Add habit'}
          </button>
        </div>
      </form>
    </Card>
  )
}

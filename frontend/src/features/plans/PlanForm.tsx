/**
 * Add/edit plan form. Mirrors HabitForm: holds the draft locally and hands the
 * whole PlanDraft to the store on submit (the engine trims, defaults empty
 * time to 30m, and stores the recurrence). Empty topic or an incomplete
 * recurrence disables submit.
 */
import { useState } from 'react'
import { Card } from '../../components/Card'
import { HmInput } from '../../components/HmInput'
import type { PlanDraft } from '../../store/types'
import type { DateStr } from '../../types/domain'
import { FrequencyPicker, isRecurrenceValid } from './FrequencyPicker'

export interface PlanFormProps {
  /** Present when editing; a fresh draft is used otherwise. */
  initial?: PlanDraft | null
  today: DateStr
  onSubmit: (draft: PlanDraft) => void
  onCancel: () => void
}

const FIELD_CLS =
  'w-full rounded-btn border border-line bg-dial px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors duration-150 ease-click focus:border-accent focus:outline-none'

function blankDraft(today: DateStr): PlanDraft {
  return { topic: '', hours: 0.5, subtaskLines: '', recurrence: { freq: 'once', date: today } }
}

export function PlanForm({ initial = null, today, onSubmit, onCancel }: PlanFormProps) {
  const [draft, setDraft] = useState<PlanDraft>(() => (initial ? { ...initial } : blankDraft(today)))
  const editing = Boolean(initial?.id)
  const valid = draft.topic.trim().length > 0 && isRecurrenceValid(draft.recurrence)

  return (
    <Card className="mb-5">
      <div className="font-display text-xs label-caps text-muted">
        {editing ? 'Edit plan' : 'New plan'}
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
          <span className="mb-1 block font-display text-xs label-caps text-muted">Plan</span>
          <input
            type="text"
            value={draft.topic}
            onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
            placeholder="e.g. Pay rent, Mom's birthday, Dentist"
            autoFocus
            className={FIELD_CLS}
          />
        </label>

        <div>
          <span className="mb-1 block font-display text-xs label-caps text-muted">
            Time per occurrence
          </span>
          <HmInput
            valueHours={draft.hours}
            onChange={(dec) => setDraft((d) => ({ ...d, hours: dec }))}
            label="per occurrence"
          />
        </div>

        <FrequencyPicker
          value={draft.recurrence}
          today={today}
          onChange={(recurrence) => setDraft((d) => ({ ...d, recurrence }))}
        />

        <label className="block">
          <span className="mb-1 block font-display text-xs label-caps text-muted">
            Subtasks (optional, one per line)
          </span>
          <textarea
            value={draft.subtaskLines}
            onChange={(e) => setDraft((d) => ({ ...d, subtaskLines: e.target.value }))}
            rows={3}
            placeholder={'Gather documents\nSubmit form'}
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
            {editing ? 'Save changes' : 'Add plan'}
          </button>
        </div>
      </form>
    </Card>
  )
}

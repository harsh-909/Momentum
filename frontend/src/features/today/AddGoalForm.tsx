/**
 * Collapsible add-goal form (kept above the list so new goals start at the
 * top). Hidden entirely on read-only past days - the parent gates that.
 *
 * v1 collapse parity: after submitting, the form stays open only while the
 * day's list is still empty (e.g. the engine refused the add).
 */
import { useState } from 'react'
import { Card } from '../../components/Card'
import { HmInput } from '../../components/HmInput'
import { isEvening } from '../../lib/engine/copy'
import { useAppStore } from '../../store/useAppStore'
import type { DateStr } from '../../types/domain'
import { PlusIcon } from './icons'

const DEFAULT_HOURS = 1

export function AddGoalForm({ date }: { date: DateStr }) {
  const addGoal = useAppStore((s) => s.addGoal)
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [subtaskLines, setSubtaskLines] = useState('')

  const submitLabel = isEvening(new Date().getHours()) ? 'Add a goal for tomorrow' : 'Add a goal'

  const reset = () => {
    setTopic('')
    setHours(DEFAULT_HOURS)
    setSubtaskLines('')
  }

  const submit = () => {
    if (!topic.trim()) return
    addGoal(date, { topic, hours, subtaskLines })
    reset()
    // v1 parity: collapse unless the day still has 0 goals.
    const listAfter = useAppStore.getState().data.goals[date] ?? []
    setOpen(listAfter.length === 0)
  }

  return (
    <Card padding="sm" className="goal-form">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 rounded-btn px-1 py-1 text-left font-display text-sm font-semibold transition-colors duration-150 ease-click ${
          open ? 'text-ink' : 'text-muted hover:text-ink'
        }`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-btn border transition-colors duration-150 ease-click ${
            open ? 'border-accent-fill bg-accent-fill text-on-accent' : 'border-line text-muted'
          }`}
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </span>
        {submitLabel}
      </button>

      {open && (
        <div className="mt-3 space-y-3 px-1 pb-1">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="What do you want to work on?"
            aria-label="Goal topic"
            className="w-full rounded-btn border border-line bg-face px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors duration-150 ease-click focus:border-accent focus:outline-none"
          />

          <div>
            <div className="label-caps mb-1 font-display text-[10px] text-muted">Planned time</div>
            <HmInput valueHours={hours} onChange={setHours} label="Planned time" />
          </div>

          <div>
            <div className="label-caps mb-1 font-display text-[10px] text-muted">Subtasks</div>
            <textarea
              value={subtaskLines}
              onChange={(e) => setSubtaskLines(e.target.value)}
              placeholder="One subtask per line"
              aria-label="Subtasks, one per line"
              rows={3}
              className="w-full resize-none rounded-btn border border-line bg-face px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors duration-150 ease-click focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                reset()
              }}
              className="rounded-btn px-3 py-2 text-xs text-muted transition-colors duration-150 ease-click hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="label-caps rounded-btn bg-accent-fill px-4 py-2 font-display text-[11px] text-on-accent transition-opacity duration-150 ease-click hover:opacity-90"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

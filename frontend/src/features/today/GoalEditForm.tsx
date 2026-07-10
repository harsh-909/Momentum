/**
 * Inline goal editor (swaps in when ui.editingGoalId === goal.id).
 *
 * v1 x-model parity: every keystroke writes through the store's live edit
 * actions (setGoalTopic / setSubtaskText / setGoalHours); cleanup - trimming
 * blanks, dropping empty subtasks, clamping hours, recomputing completion -
 * happens once on Done via stopEditGoal.
 */
import { useRef } from 'react'
import { HmInput } from '../../components/HmInput'
import { confirmDialog } from '../../lib/confirm'
import { useAppStore } from '../../store/useAppStore'
import type { DateStr, Goal } from '../../types/domain'
import { CheckIcon, PlusIcon, XIcon } from './icons'

/** Grow a rows=1 textarea to fit its content (v1 autoGrow). */
function autoGrow(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const TEXTAREA_CLS =
  'w-full resize-none overflow-hidden rounded-btn border border-line bg-face px-2.5 py-1.5 text-sm leading-relaxed text-ink placeholder:text-muted/70 transition-colors duration-150 ease-click focus:border-accent focus:outline-none'

export function GoalEditForm({ date, goal }: { date: DateStr; goal: Goal }) {
  const setGoalTopic = useAppStore((s) => s.setGoalTopic)
  const setGoalHours = useAppStore((s) => s.setGoalHours)
  const setSubtaskText = useAppStore((s) => s.setSubtaskText)
  const addEditSubtask = useAppStore((s) => s.addEditSubtask)
  const removeSubtask = useAppStore((s) => s.removeSubtask)
  const stopEditGoal = useAppStore((s) => s.stopEditGoal)
  const setEditingGoal = useAppStore((s) => s.setEditingGoal)

  const subtasksRef = useRef<HTMLDivElement>(null)

  const handleAddSubtask = () => {
    addEditSubtask(date, goal.id)
    // The action returns void; focus the freshly rendered last row once the
    // store update has flushed.
    setTimeout(() => {
      const areas = subtasksRef.current?.querySelectorAll<HTMLTextAreaElement>(
        'textarea[data-subtask-input]',
      )
      areas?.[areas.length - 1]?.focus()
    }, 0)
  }

  const done = () => {
    stopEditGoal(date, goal.id)
    setEditingGoal(null)
  }

  return (
    <div className="min-w-0 flex-1 space-y-2.5">
      <textarea
        ref={autoGrow}
        rows={1}
        value={goal.topic}
        placeholder="Goal title"
        aria-label="Goal title"
        onChange={(e) => {
          setGoalTopic(date, goal.id, e.target.value)
          autoGrow(e.target)
        }}
        className={`${TEXTAREA_CLS} font-medium`}
      />

      <div className="flex items-center gap-2">
        <HmInput
          valueHours={goal.hours}
          label="Planned time"
          onChange={(dec) => setGoalHours(date, goal.id, dec)}
        />
        <span className="text-xs text-muted">planned</span>
      </div>

      <div ref={subtasksRef} className="space-y-1.5">
        {goal.subtasks.map((sub) => (
          <div key={sub.id} className="flex items-start gap-2">
            <textarea
              data-subtask-input
              rows={1}
              ref={autoGrow}
              value={sub.text}
              placeholder="Subtask"
              aria-label="Subtask text"
              onChange={(e) => {
                setSubtaskText(date, goal.id, sub.id, e.target.value)
                autoGrow(e.target)
              }}
              className={TEXTAREA_CLS}
            />
            <button
              type="button"
              title="Remove subtask"
              aria-label={`Remove subtask ${sub.text}`.trim()}
              onClick={async () => {
                // Blank rows delete silently; typed text asks first.
                if (sub.text.trim()) {
                  const ok = await confirmDialog({
                    title: 'Remove this subtask?',
                    message: `"${sub.text.trim()}" will be removed.`,
                    confirmLabel: 'Remove',
                    tone: 'danger',
                  })
                  if (!ok) return
                }
                removeSubtask(date, goal.id, sub.id)
              }}
              className="hit-halo mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-btn text-muted transition-colors duration-150 ease-click hover:text-alert"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddSubtask}
          className="label-caps inline-flex items-center gap-1.5 rounded-btn border border-line px-2.5 py-1.5 font-display text-[10px] text-muted transition-colors duration-150 ease-click hover:border-muted hover:text-ink"
        >
          <PlusIcon className="h-3 w-3" />
          Add subtask
        </button>
        <button
          type="button"
          onClick={done}
          className="label-caps inline-flex items-center gap-1.5 rounded-btn bg-accent-fill px-3 py-1.5 font-display text-[10px] text-on-accent transition-opacity duration-150 ease-click hover:opacity-90"
        >
          <CheckIcon className="h-3 w-3" />
          Done
        </button>
      </div>
    </div>
  )
}

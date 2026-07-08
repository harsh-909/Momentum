/**
 * Habits tab: recurring templates that materialize onto scheduled days.
 * The add/edit form is one component - editing preloads the draft from the
 * template (v1 openEditHabit).
 */
import { useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import type { HabitDraft } from '../../store/types'
import { useAppStore } from '../../store/useAppStore'
import type { HabitTemplate } from '../../types/domain'
import { PlusIcon } from '../today/icons'
import { HabitCard } from './HabitCard'
import { HabitForm } from './HabitForm'

function LotusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Asterisk bloom: three thin petal strokes through the center. */}
      <path d="M12 3v18" />
      <path d="m4.2 7.5 15.6 9" />
      <path d="M19.8 7.5 4.2 16.5" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  )
}

/** null = closed, draft without id = adding, draft with id = editing. */
type FormState = { open: false } | { open: true; draft: HabitDraft | null }

function draftFrom(habit: HabitTemplate): HabitDraft {
  return {
    id: habit.id,
    topic: habit.topic,
    hours: habit.hours,
    subtaskLines: habit.subtasks.map((s) => s.text).join('\n'),
    days: [...habit.days],
  }
}

export function HabitsPage() {
  const habits = useAppStore((s) => s.data.recurring)
  const today = useAppStore((s) => s.ui.today)
  const submitHabit = useAppStore((s) => s.submitHabit)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const [form, setForm] = useState<FormState>({ open: false })

  const close = () => setForm({ open: false })

  return (
    <section aria-labelledby="habits-heading">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 id="habits-heading" className="font-display text-section font-semibold text-ink">
            Habits
          </h2>
          <p className="text-sm text-muted">
            Recurring routines - they appear on the days you choose, automatically.
          </p>
        </div>
        {!form.open && (
          <button
            type="button"
            onClick={() => setForm({ open: true, draft: null })}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-btn bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent transition-opacity duration-150 ease-click hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New habit
          </button>
        )}
      </div>

      {form.open && (
        <HabitForm
          // Remount per target so the local draft resets between add/edit.
          key={form.draft?.id ?? 'new'}
          initial={form.draft}
          onSubmit={(draft) => {
            submitHabit(draft)
            close()
          }}
          onCancel={close}
        />
      )}

      {habits.length === 0 && !form.open ? (
        <EmptyState
          icon={<LotusIcon />}
          title="Build your rituals"
          hint={'Routines you want to repeat - every day or only on certain days. Tap "+ New habit" to add your first.'}
        />
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              today={today}
              onEdit={(h) => setForm({ open: true, draft: draftFrom(h) })}
              onDelete={deleteHabit}
            />
          ))}
        </div>
      )}
    </section>
  )
}

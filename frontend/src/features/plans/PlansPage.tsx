/**
 * Plans tab: one-off / monthly / yearly scheduled items that appear as goals
 * on their due day. Mirrors HabitsPage - one add/edit form, editing preloads
 * the draft from the template.
 */
import { useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import type { PlanDraft } from '../../store/types'
import { useAppStore } from '../../store/useAppStore'
import { CalendarIcon, PlusIcon } from '../today/icons'
import { PlanCard } from './PlanCard'
import { PlanForm } from './PlanForm'

/** closed | adding (draft null) | editing (draft with id). */
type FormState = { open: false } | { open: true; draft: PlanDraft | null }

export function PlansPage() {
  const plans = useAppStore((s) => s.data.plans)
  const today = useAppStore((s) => s.ui.today)
  const submitPlan = useAppStore((s) => s.submitPlan)
  const deletePlan = useAppStore((s) => s.deletePlan)
  const [form, setForm] = useState<FormState>({ open: false })

  const close = () => setForm({ open: false })

  return (
    <section aria-labelledby="plans-heading">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 id="plans-heading" className="font-display text-section font-semibold text-ink">
            Plans
          </h2>
          <p className="text-sm text-muted">
            One-off, monthly, or yearly items - they appear as goals on their day, automatically.
          </p>
        </div>
        {!form.open && (
          <button
            type="button"
            onClick={() => setForm({ open: true, draft: null })}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-btn bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent transition-opacity duration-150 ease-click hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New plan
          </button>
        )}
      </div>

      {form.open && (
        <PlanForm
          // Remount per target so the local draft resets between add/edit.
          key={form.draft?.id ?? 'new'}
          initial={form.draft}
          today={today}
          onSubmit={(draft) => {
            submitPlan(draft)
            close()
          }}
          onCancel={close}
        />
      )}

      {plans.length === 0 && !form.open ? (
        <EmptyState
          icon={<CalendarIcon className="h-8 w-8" />}
          title="No plans yet"
          hint={'Schedule bills, birthdays, or appointments and they\'ll surface on the right day. Tap "+ New plan" to add your first.'}
        />
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              today={today}
              onEdit={(draft) => setForm({ open: true, draft })}
              onDelete={deletePlan}
            />
          ))}
        </div>
      )}
    </section>
  )
}

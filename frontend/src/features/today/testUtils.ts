/**
 * Test seeding for the Today feature: the real zustand store is used, with
 * data/ui slices seeded per test and spies swapped in for the actions under
 * assertion (actions live on state, so setState({ toggleGoal: spy }) works).
 */
import { emptySnapshot, useAppStore } from '../../store/useAppStore'
import type { AppState } from '../../store/types'
import type { DateStr, Goal, HabitTemplate } from '../../types/domain'

export { FUTURE, PAST, TODAY, makeGoal, makeHabit, makeSubtask } from '../../lib/engine/testFactories'
import { TODAY } from '../../lib/engine/testFactories'

export interface SeedOptions {
  goals?: Record<DateStr, Goal[]>
  recurring?: HabitTemplate[]
  selectedDate?: DateStr
  today?: DateStr
  minDate?: DateStr
  editingGoalId?: string | null
  /** Action spies to swap in (e.g. { toggleGoal: vi.fn() }). */
  actions?: Partial<AppState>
}

export function seedStore(opts: SeedOptions = {}): void {
  const s = useAppStore.getState()
  useAppStore.setState({
    data: {
      ...emptySnapshot('testuser', opts.minDate ?? TODAY),
      goals: opts.goals ?? {},
      recurring: opts.recurring ?? [],
    },
    ui: {
      ...s.ui,
      today: opts.today ?? TODAY,
      selectedDate: opts.selectedDate ?? TODAY,
      minDate: opts.minDate ?? TODAY,
      editingGoalId: opts.editingGoalId ?? null,
    },
    ...(opts.actions ?? {}),
  } as Partial<AppState>)
}

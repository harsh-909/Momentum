/**
 * The Today tab: date navigation, the day-summary chronograph, the add-goal
 * form (today/future only), and the day's goal list. Past days render a
 * read-only notice; future days announce scheduled habits.
 */
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { isEvening } from '../../lib/engine/copy'
import { isReadonly } from '../../lib/engine/dates'
import { habitsOnDate } from '../../lib/engine/habits'
import { useAppStore } from '../../store/useAppStore'
import type { Goal } from '../../types/domain'
import { AddGoalForm } from './AddGoalForm'
import { DateNav } from './DateNav'
import { DaySummaryDial } from './DaySummaryDial'
import { FutureHabitHint } from './FutureHabitHint'
import { GoalList } from './GoalList'
import { MoonIcon, SunIcon } from './icons'
import { ReadonlyNotice } from './ReadonlyNotice'
import './today.css'

const NO_GOALS: Goal[] = []

export function TodayPage() {
  const selectedDate = useAppStore((s) => s.ui.selectedDate)
  const today = useAppStore((s) => s.ui.today)
  const goals = useAppStore((s) => s.data.goals[s.ui.selectedDate]) ?? NO_GOALS
  const data = useAppStore((s) => s.data)

  const readonly = isReadonly(selectedDate, today)
  const isFuture = selectedDate > today
  const futureHabitCount = isFuture ? habitsOnDate(data, selectedDate).length : 0
  const evening = isEvening(new Date().getHours())

  return (
    <div data-page="today" className="space-y-4">
      <DateNav />
      <DaySummaryDial goals={goals} />

      {isFuture && <FutureHabitHint count={futureHabitCount} />}
      {readonly && <ReadonlyNotice />}
      {!readonly && <AddGoalForm date={selectedDate} />}

      {goals.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={evening ? <MoonIcon /> : <SunIcon />}
            title={evening ? "Plan tomorrow's wins" : 'A fresh canvas awaits'}
            hint={
              readonly
                ? 'No goals were logged on this day.'
                : 'Add your first goal above and build momentum.'
            }
          />
        </Card>
      ) : (
        <GoalList date={selectedDate} goals={goals} readonly={readonly} />
      )}
    </div>
  )
}

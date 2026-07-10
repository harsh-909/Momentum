/**
 * The Today tab: date navigation, the day-summary chronograph, the add-goal
 * form (today/future only), and the day's goal list. Past days render a
 * read-only notice; future days announce scheduled habits.
 *
 * Bulk select: a "Select" toggle turns the list into checkboxes so several
 * goals can be pushed to the backlog at once (with an Undo), instead of the
 * old per-goal backlog button that was easy to hit by accident.
 */
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { isBacklogEligible } from '../../lib/engine/backlog'
import { isEvening } from '../../lib/engine/copy'
import { isReadonly } from '../../lib/engine/dates'
import { habitsOnDate } from '../../lib/engine/habits'
import { useAppStore } from '../../store/useAppStore'
import type { Goal } from '../../types/domain'
import { AddGoalForm } from './AddGoalForm'
import { ComingUpPlans } from './ComingUpPlans'
import { DateNav } from './DateNav'
import { DaySummaryDial } from './DaySummaryDial'
import { FutureHabitHint } from './FutureHabitHint'
import { GoalList } from './GoalList'
import { BoxArrowIcon, MoonIcon, SunIcon } from './icons'
import { ReadonlyNotice } from './ReadonlyNotice'
import './today.css'

const NO_GOALS: Goal[] = []

export function TodayPage() {
  const selectedDate = useAppStore((s) => s.ui.selectedDate)
  const today = useAppStore((s) => s.ui.today)
  const goals = useAppStore((s) => s.data.goals[s.ui.selectedDate]) ?? NO_GOALS
  const data = useAppStore((s) => s.data)
  const bulkMoveToBacklog = useAppStore((s) => s.bulkMoveToBacklog)
  const restoreToDay = useAppStore((s) => s.restoreToDay)

  const readonly = isReadonly(selectedDate, today)
  const isFuture = selectedDate > today
  const futureHabitCount = isFuture ? habitsOnDate(data, selectedDate).length : 0
  const evening = isEvening(new Date().getHours())

  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [undo, setUndo] = useState<{ ids: string[]; count: number } | null>(null)

  const eligibleGoals = goals.filter(isBacklogEligible)
  const hasEligible = eligibleGoals.length > 0
  const selectedCount = selectedIds.size

  // Leaving the day cancels any in-progress selection and dismisses the undo.
  useEffect(() => {
    setSelecting(false)
    setSelectedIds(new Set())
    setUndo(null)
  }, [selectedDate])

  // The undo offer fades after a few seconds.
  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), 6000)
    return () => clearTimeout(timer)
  }, [undo])

  const toggleSelect = (goalId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })

  const startSelecting = () => {
    setSelecting(true)
    setSelectedIds(new Set())
    setUndo(null)
  }

  const cancelSelecting = () => {
    setSelecting(false)
    setSelectedIds(new Set())
  }

  const selectAll = () => setSelectedIds(new Set(eligibleGoals.map((g) => g.id)))

  const pushSelected = () => {
    const ids = eligibleGoals.filter((g) => selectedIds.has(g.id)).map((g) => g.id)
    if (ids.length === 0) return
    bulkMoveToBacklog(selectedDate, ids)
    setSelecting(false)
    setSelectedIds(new Set())
    setUndo({ ids, count: ids.length })
  }

  const undoPush = () => {
    if (!undo) return
    restoreToDay(selectedDate, undo.ids)
    setUndo(null)
  }

  return (
    <div data-page="today" className="space-y-4">
      <DateNav />
      <DaySummaryDial goals={goals} />

      {selectedDate === today && <ComingUpPlans />}

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
        <div className="space-y-3">
          {!readonly && hasEligible && (
            <div className={`flex items-center gap-2 ${selecting ? 'justify-between' : 'justify-end'}`}>
              {selecting ? (
                <>
                  <span className="font-mono-num text-xs text-muted">
                    {selectedCount} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      Select all
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelSelecting}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={pushSelected}
                      disabled={selectedCount === 0}
                    >
                      <BoxArrowIcon className="h-3.5 w-3.5" />
                      Push to backlog
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={startSelecting}>
                  Select
                </Button>
              )}
            </div>
          )}

          <GoalList
            date={selectedDate}
            goals={goals}
            readonly={readonly}
            selection={selecting ? { active: true, selectedIds, onToggle: toggleSelect } : undefined}
          />
        </div>
      )}

      {undo && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-card border border-line bg-face px-4 py-2.5 shadow-overlay">
            <span className="text-sm text-ink">
              Moved {undo.count} to backlog
            </span>
            <Button variant="ghost" size="sm" onClick={undoPush}>
              Undo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

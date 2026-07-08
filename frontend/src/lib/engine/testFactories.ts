/**
 * Shared factories for the engine test suites. Mirrors the fixtures in
 * legacy/tests/app.test.js (TODAY/PAST, seedGoal/seedGoalOn).
 *
 * 2026-07-03 is a Friday (weekday 5) - weekday-gated habit tests rely on it.
 */
import type { Goal, HabitTemplate, Snapshot, Subtask } from '../../types/domain'
import { uid } from '../id'

export const TODAY = '2026-07-03'
export const YESTERDAY = '2026-07-02'
export const PAST = '2026-07-01'
export const FUTURE = '2026-07-05'

export function makeSnapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    username: 'testuser',
    install: TODAY,
    updatedAt: '',
    goals: {},
    backlog: [],
    recurring: [],
    seeded: {},
    carriedThrough: '',
    ...over,
  }
}

export function makeSubtask(over: Partial<Subtask> = {}): Subtask {
  return { id: uid(), text: 'step', completed: false, loggedHours: null, ...over }
}

export function makeGoal(over: Partial<Goal> = {}): Goal {
  return {
    id: uid(),
    topic: 'Goal',
    hours: 1,
    loggedHours: null,
    completed: false,
    subtasks: [],
    createdAt: TODAY,
    ...over,
  }
}

/** Seed a goal onto a date's list (creating the list) and return it. */
export function seedGoalOn(data: Snapshot, date: string, over: Partial<Goal> = {}): Goal {
  const g = makeGoal({ createdAt: date, ...over })
  ;(data.goals[date] = data.goals[date] || []).push(g)
  return g
}

export function makeHabit(over: Partial<HabitTemplate> = {}): HabitTemplate {
  return {
    id: uid(),
    topic: 'Habit',
    hours: 0.5,
    subtasks: [],
    startDate: TODAY,
    days: [0, 1, 2, 3, 4, 5, 6],
    ...over,
  }
}

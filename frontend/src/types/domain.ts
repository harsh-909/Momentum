/**
 * Core domain types for Momentum 2.0.
 *
 * These mirror the v1 snapshot shape exactly (userData/<name>.json) so that
 * import/export stays backward compatible. Dates are ALWAYS `YYYY-MM-DD`
 * strings; parse to a real Date only via `parseLocalDate` in lib/engine/dates.
 * Time is ALWAYS decimal hours in state; h+m is a UI-only representation.
 */

/** `YYYY-MM-DD` local-date string. Zero-padded, so string comparison orders correctly. */
export type DateStr = string

/** Weekday index, 0 = Sunday .. 6 = Saturday (JS Date.getDay convention). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** How often a scheduled item recurs. */
export type RecurrenceFreq = 'once' | 'weekly' | 'monthly' | 'yearly'

/**
 * A recurrence rule. Only the fields relevant to `freq` are read; the others
 * are ignored. Missing required fields make the rule match nothing (defensive).
 */
export interface Recurrence {
  freq: RecurrenceFreq
  /** weekly: scheduled weekdays (0=Sun..6=Sat). Empty/undefined means every day. */
  days?: Weekday[]
  /** monthly & yearly: day of month 1..31. Clamped to the last day of shorter months. */
  dayOfMonth?: number
  /** yearly: month 1..12 (used with dayOfMonth). */
  month?: number
  /** once: the single target date, YYYY-MM-DD. */
  date?: DateStr
}

export interface Subtask {
  id: string
  text: string
  completed: boolean
  /** Actual time spent, decimal hours. null/undefined until logged. */
  loggedHours?: number | null
}

export interface Goal {
  id: string
  topic: string
  /** Planned time, decimal hours. */
  hours: number
  /**
   * Actual time spent, decimal hours. null until logged.
   * For goals WITH subtasks this is derived: sum of completed subtasks'
   * loggedHours (null when that sum is 0). Never edit it directly there.
   */
  loggedHours: number | null
  completed: boolean
  subtasks: Subtask[]
  createdAt: DateStr
  /** Back-reference to the habit template this goal was seeded from. */
  recurringId?: string
  /** Back-reference to the plan template this goal instance was seeded from (mirrors recurringId). */
  planId?: string
  /** True once this goal's unfinished remainder was copied to the backlog. */
  carried?: boolean
  /** Backlog items only: the day the goal originally belonged to. */
  originalDate?: DateStr
  /** Backlog items only: the day it entered the backlog (v1 field name kept for compat). */
  backlognedAt?: DateStr
  /** Legacy v1 UI leftover; tolerated on import, never written by v2. */
  addingSubtask?: boolean
}

export interface HabitTemplate {
  id: string
  topic: string
  /** Planned time per scheduled day, decimal hours. */
  hours: number
  /** Template subtasks carry only text; instances get ids/completed. */
  subtasks: Array<{ text: string }>
  startDate: DateStr
  /** Scheduled weekdays, sorted ascending. Must contain at least one entry. */
  days: Weekday[]
}

export interface PlanTemplate {
  id: string
  topic: string
  /** Planned time per occurrence, decimal hours. */
  hours: number
  /** Template subtasks carry only text; instances get ids/completed. */
  subtasks: Array<{ text: string }>
  startDate: DateStr
  /** When this plan is due (once/monthly/yearly). */
  recurrence: Recurrence
}

/**
 * The whole persisted document - exactly what PUT /api/data sends and what
 * export/import round-trips. Everything the app knows lives here.
 */
export interface Snapshot {
  username: string
  install: DateStr
  /** ISO timestamp of last save; display only (concurrency uses the server version). */
  updatedAt: string
  goals: Record<DateStr, Goal[]>
  backlog: Goal[]
  recurring: HabitTemplate[]
  /** date -> habit template ids materialized that day (blocks re-seeding after delete). */
  seeded: Record<DateStr, string[]>
  /** Watermark: past days up to and including this date have been swept to backlog. */
  carriedThrough: DateStr | ''
  /** One-off / monthly / yearly scheduled items, separate from weekly habits. */
  plans: PlanTemplate[]
  /** date -> plan template ids materialized/surfaced that day (blocks re-seeding after delete, and double-surfacing). */
  planSeeded: Record<DateStr, string[]>
  /** Watermark: missed-plan catch-up has processed past days up to and including this date. */
  plansSweptThrough: DateStr | ''
}

/** Aggregates for the day summary dial. */
export interface DayStats {
  completed: number
  total: number
  /** Planned hours for the day. */
  hours: number
  /** Logged (partial-credit-aware) hours for the day. */
  doneHours: number
  /** Partial-credit day percentage, capped at 99 unless every goal is done. */
  pct: number
}

export interface Metrics {
  streak: number
  avgWeek: number
  totalHours: number
  totalGoals: number
}

export type Tab = 'today' | 'backlog' | 'habits' | 'plans' | 'history' | 'metrics'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type HistoryFilter = 'all' | 'complete' | 'incomplete'

/** The logical day starts at 3am: before 03:00 the app still counts the previous date. */
export const DAY_START_HOUR = 3

/** Streak threshold: a day counts toward the streak at >= 70% partial credit. */
export const STREAK_THRESHOLD = 70

/** Username rule shared verbatim with the backend (app/models.py). */
export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/

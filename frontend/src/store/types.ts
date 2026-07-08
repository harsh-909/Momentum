/**
 * The Zustand store contract. UI components code against this interface;
 * the implementation (useAppStore.ts) wires these actions to the pure
 * engine functions in lib/engine/.
 *
 * Rules:
 * - `data` is the persisted Snapshot and the ONLY serialized slice.
 * - Every data mutation goes through an action that delegates to an engine
 *   function and then marks the store dirty (debounced save).
 * - Mutations on past days are refused at the engine layer; the UI must
 *   ALSO disable those controls (isReadonly(date, today)).
 * - Drag state lives inside dnd-kit, edit state in `ui` - never in `data`.
 */
import type {
  DateStr,
  Goal,
  HabitTemplate,
  HistoryFilter,
  SaveStatus,
  Snapshot,
  Tab,
} from '../types/domain'

export interface NewGoalInput {
  topic: string
  /** Decimal hours (already combined from the h+m inputs). */
  hours: number
  /** One subtask per line, blank lines dropped by the engine. */
  subtaskLines: string
}

export interface HabitDraft {
  /** Present when editing an existing habit. */
  id?: string
  topic: string
  hours: number
  subtaskLines: string
  days: number[]
}

export interface SessionSlice {
  user: { username: string } | null
  status: 'checking' | 'anon' | 'authed'
}

export interface UiSlice {
  activeTab: Tab
  /** The current logical day (3am boundary). */
  today: DateStr
  selectedDate: DateStr
  /** Navigation floor: min(install, earliest date with goals). */
  minDate: DateStr
  editingGoalId: string | null
  historyFilter: HistoryFilter
  expandedHistoryDates: DateStr[]
  saveStatus: SaveStatus
  quote: string
}

export interface AppState {
  data: Snapshot
  session: SessionSlice
  ui: UiSlice

  // -- session ---------------------------------------------------------
  /** Validate a stored token on boot; resolves session.status. */
  checkAuth(): Promise<void>
  login(username: string, password: string): Promise<void>
  signup(username: string, password: string): Promise<void>
  logout(): Promise<void>

  // -- persistence -----------------------------------------------------
  /** Debounced-save trigger; every mutating action calls it internally. */
  markDirty(): void
  /** Immediate save (retry button, logout, pagehide). */
  flushNow(opts?: { keepalive?: boolean }): Promise<void>
  /** Replace the profile with an imported v1/v2 snapshot (already parsed). */
  importSnapshot(snapshot: Snapshot): void

  // -- ui --------------------------------------------------------------
  setActiveTab(tab: Tab): void
  setSelectedDate(date: DateStr): void
  shiftDate(delta: number): void
  setHistoryFilter(filter: HistoryFilter): void
  toggleHistoryDate(date: DateStr): void
  setEditingGoal(goalId: string | null): void
  /** Re-evaluate the logical day; runs rollover work when it changed. */
  checkDayRollover(): void

  // -- goals (all no-op on read-only past days) --------------------------
  addGoal(date: DateStr, input: NewGoalInput): void
  toggleGoal(date: DateStr, goalId: string): void
  toggleSubtask(date: DateStr, goalId: string, subtaskId: string): void
  deleteGoal(date: DateStr, goalId: string): void
  reorderGoal(date: DateStr, from: number, to: number): void
  reorderSubtask(date: DateStr, goalId: string, from: number, to: number): void
  /** Edit-mode field writes (v1 semantics: edits apply live, cleanup on stop). */
  setGoalTopic(date: DateStr, goalId: string, topic: string): void
  setGoalHours(date: DateStr, goalId: string, hours: number): void
  setSubtaskText(date: DateStr, goalId: string, subtaskId: string, text: string): void
  addEditSubtask(date: DateStr, goalId: string): void
  removeSubtask(date: DateStr, goalId: string, subtaskId: string): void
  /** Leave edit mode: strip blanks, drop empty subtasks, clamp hours, recompute completion. */
  stopEditGoal(date: DateStr, goalId: string): void
  /** Log actual time on a goal without subtasks. */
  logGoalTime(date: DateStr, goalId: string, h: number, m: number): void
  /** Log actual time on a completed subtask; rolls up to the goal. */
  logSubtaskTime(date: DateStr, goalId: string, subtaskId: string, h: number, m: number): void

  // -- backlog -----------------------------------------------------------
  /** Refused for habit-derived goals (recurringId) and past days. */
  moveToBacklog(date: DateStr, goalId: string): void
  scheduleFromBacklog(index: number, date: DateStr): void
  deleteBacklogItem(index: number): void

  // -- habits ------------------------------------------------------------
  /** Create or update (draft.id set) a habit; syncs today's untouched instance. */
  submitHabit(draft: HabitDraft): void
  deleteHabit(habitId: string): void
}

/** Convenience read helpers the UI uses constantly. */
export interface StoreSelectors {
  goalsForDate(state: AppState, date: DateStr): Goal[]
  habits(state: AppState): HabitTemplate[]
}

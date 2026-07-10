/**
 * The Zustand store - real implementation (M2).
 *
 * Actions are thin wrappers: engine functions do the mutation inside an
 * immer draft, then the SaveScheduler debounces a whole-snapshot PUT.
 * Only `data` is ever serialized. The server version counter lives in the
 * scheduler's closure (module scope), not in state - it is transport
 * bookkeeping, not app state.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import * as authApi from '../api/auth'
import { loadData } from '../api/data'
import { ApiError, setToken } from '../api/client'
import * as backlogEngine from '../lib/engine/backlog'
import * as carryover from '../lib/engine/carryover'
import { computeMinDate, currentDay, isReadonly, shiftDateStr } from '../lib/engine/dates'
import * as goalsEngine from '../lib/engine/goals'
import * as habitsEngine from '../lib/engine/habits'
import * as plansEngine from '../lib/engine/plans'
import { quoteForDate } from '../lib/engine/copy'
import { parseImportedSnapshot } from '../lib/engine/validate'
import { rememberUser } from '../features/auth/recentUsers'
import type { DateStr, Snapshot } from '../types/domain'
import { SaveScheduler } from './persistence'
import type { AppState } from './types'

export function emptySnapshot(username: string, install: string): Snapshot {
  return {
    username,
    install,
    updatedAt: '',
    goals: {},
    backlog: [],
    recurring: [],
    seeded: {},
    carriedThrough: '',
    plans: [],
    planSeeded: {},
    plansSweptThrough: '',
  }
}

let serverVersion = 0

const scheduler = new SaveScheduler({
  getSnapshot: () => ({
    ...useAppStore.getState().data,
    updatedAt: new Date().toISOString(),
  }),
  getVersion: () => serverVersion,
  setVersion: (v) => {
    serverVersion = v
  },
  setStatus: (status) =>
    useAppStore.setState((s) => {
      s.ui.saveStatus = status
    }),
  onConflict: (winning) => {
    // Another tab/device won the save race: adopt the server doc wholesale
    // (correctness over merging, per the contract) - but only when the 409
    // body actually matches the contract; a proxy-generated 409 must not
    // wedge the version counter. Returns whether we adopted, so the scheduler
    // can keep the change pending (not silently drop it) when we did not.
    if (typeof winning?.version !== 'number' || !winning.data) {
      return false
    }
    try {
      const snap = parseImportedSnapshot(winning.data)
      serverVersion = winning.version
      useAppStore.getState().hydrate(snap, winning.version)
      return true
    } catch {
      return false
    }
  },
  onAuthExpired: () => {
    // The session died server-side; the same token can never save again.
    setToken(null)
    alert('Your session expired - please log in again.')
    useAppStore.setState((s) => {
      s.session.user = null
      s.session.status = 'anon'
    })
  },
})

/** Test hook: reset transport bookkeeping between tests. */
export function resetPersistenceForTests(): void {
  serverVersion = 0
  scheduler.dispose()
}

export function getScheduler(): SaveScheduler {
  return scheduler
}

interface InternalActions {
  hydrate(snapshot: Snapshot, version: number): void
  enterProfile(username: string, raw: unknown, version: number): void
}

export const useAppStore = create<AppState & InternalActions>()(
  immer((set, get) => {
    /** Run an engine mutation against the draft, then schedule a save. */
    const mutate = (fn: (data: Snapshot, today: DateStr) => void): void => {
      set((s) => {
        fn(s.data, s.ui.today)
      })
      scheduler.markDirty()
    }

    const state: AppState & InternalActions = {
      data: emptySnapshot('', ''),
      session: { user: null, status: 'checking' },
      ui: {
        activeTab: 'today',
        today: '',
        selectedDate: '',
        minDate: '',
        editingGoalId: null,
        historyFilter: 'all',
        expandedHistoryDates: [],
        saveStatus: 'idle',
        quote: '',
      },

      // -- internal ------------------------------------------------------
      hydrate: (snapshot, version) => {
        serverVersion = version
        const today = currentDay(new Date())
        set((s) => {
          s.data = snapshot
          s.ui.today = today
          s.ui.minDate = computeMinDate(snapshot.install, snapshot.goals)
          // Fresh login starts on today; a mid-session re-hydrate (409
          // adoption) keeps the user where they were browsing when possible.
          if (
            !s.ui.selectedDate ||
            s.ui.selectedDate < s.ui.minDate ||
            s.session.status !== 'authed'
          ) {
            s.ui.selectedDate = today
          }
          s.ui.quote = quoteForDate(new Date())
          s.ui.editingGoalId = null
        })
      },

      enterProfile: (username, raw, version) => {
        const today = currentDay(new Date())
        const snapshot =
          raw === null || raw === undefined
            ? emptySnapshot(username, today)
            : parseImportedSnapshot(raw)
        snapshot.username = username
        get().hydrate(snapshot, version)
        // v1 _enterProfile parity: sweep past days and seed today's habits.
        const before = JSON.stringify(get().data)
        set((s) => {
          carryover.sweepPastDays(s.data, s.ui.today)
          plansEngine.sweepMissedPlans(s.data, s.ui.today)
          habitsEngine.ensureRecurring(s.data, s.ui.today)
          plansEngine.ensurePlans(s.data, s.ui.today)
        })
        const changed = JSON.stringify(get().data) !== before
        set((s) => {
          s.session.user = { username }
          s.session.status = 'authed'
        })
        rememberUser(username)
        // Persist immediately only when something actually needs writing
        // (fresh account, or the sweep/seed mutated the doc) - a plain
        // reload must not bump the server version and 409 other tabs.
        if (raw === null || raw === undefined || changed) {
          scheduler.markDirty()
          void scheduler.flushNow()
        }
      },

      // -- session -------------------------------------------------------
      checkAuth: async () => {
        try {
          const who = await authApi.me()
          const res = await loadData()
          get().enterProfile(who.username, res.data, res.version)
        } catch (err) {
          if (err instanceof ApiError && err.status !== 401 && err.status !== 0) {
            console.error('checkAuth failed', err)
          }
          set((s) => {
            s.session.status = 'anon'
            s.session.user = null
          })
        }
      },

      login: async (username, password) => {
        const res = await authApi.login(username, password)
        const loaded = await loadData()
        get().enterProfile(res.user.username, loaded.data, loaded.version)
      },

      signup: async (username, password) => {
        const res = await authApi.signup(username, password)
        get().enterProfile(res.user.username, null, 0)
      },

      logout: async () => {
        await scheduler.flushNow()
        if (
          scheduler.hasPending() &&
          !confirm("Couldn't save your latest change - log out anyway and lose it?")
        ) {
          return
        }
        scheduler.dispose()
        try {
          await authApi.logout()
        } catch {
          // Offline logout is fine: the token is cleared client-side either
          // way (api/auth.ts finally); the server row just expires later.
        } finally {
          serverVersion = 0
          set((s) => {
            s.data = emptySnapshot('', '')
            s.session.user = null
            s.session.status = 'anon'
            s.ui.activeTab = 'today'
            s.ui.saveStatus = 'idle'
            s.ui.editingGoalId = null
          })
        }
      },

      // -- persistence ---------------------------------------------------
      markDirty: () => scheduler.markDirty(),
      flushNow: async (opts) => scheduler.flushNow(opts),

      importSnapshot: (snapshot) => {
        const username = get().session.user?.username ?? snapshot.username
        set((s) => {
          s.data = { ...snapshot, username }
          s.ui.selectedDate = s.ui.today
          s.ui.minDate = computeMinDate(snapshot.install, snapshot.goals)
          s.ui.editingGoalId = null
          carryover.sweepPastDays(s.data, s.ui.today)
          plansEngine.sweepMissedPlans(s.data, s.ui.today)
          habitsEngine.ensureRecurring(s.data, s.ui.today)
          plansEngine.ensurePlans(s.data, s.ui.today)
        })
        scheduler.markDirty()
        void scheduler.flushNow()
      },

      // -- ui --------------------------------------------------------------
      setActiveTab: (tab) =>
        set((s) => {
          s.ui.activeTab = tab
        }),
      setSelectedDate: (date) =>
        set((s) => {
          if (date >= s.ui.minDate) {
            s.ui.selectedDate = date
            s.ui.editingGoalId = null
          }
        }),
      shiftDate: (delta) =>
        set((s) => {
          const next = shiftDateStr(s.ui.selectedDate, delta)
          if (next >= s.ui.minDate) {
            s.ui.selectedDate = next
            s.ui.editingGoalId = null
          }
        }),
      setHistoryFilter: (filter) =>
        set((s) => {
          s.ui.historyFilter = filter
        }),
      toggleHistoryDate: (date) =>
        set((s) => {
          const i = s.ui.expandedHistoryDates.indexOf(date)
          if (i >= 0) s.ui.expandedHistoryDates.splice(i, 1)
          else s.ui.expandedHistoryDates.push(date)
        }),
      setEditingGoal: (goalId) =>
        set((s) => {
          if (goalId !== null && isReadonly(s.ui.selectedDate, s.ui.today)) return
          s.ui.editingGoalId = goalId
        }),

      checkDayRollover: () => {
        const nowDay = currentDay(new Date())
        const { ui, session } = get()
        if (session.status !== 'authed' || nowDay === ui.today) return
        const wasOnToday = ui.selectedDate === ui.today
        set((s) => {
          s.ui.today = nowDay
          s.ui.quote = quoteForDate(new Date())
          if (wasOnToday) s.ui.selectedDate = nowDay
          // Clock rollback / westward travel: never leave the carry-over
          // watermark in the future, or the re-lived days are skipped forever.
          const yesterday = shiftDateStr(nowDay, -1)
          if (s.data.carriedThrough > yesterday) s.data.carriedThrough = yesterday
          carryover.sweepPastDays(s.data, nowDay)
          plansEngine.sweepMissedPlans(s.data, nowDay)
          habitsEngine.ensureRecurring(s.data, nowDay)
          plansEngine.ensurePlans(s.data, nowDay)
        })
        scheduler.markDirty()
      },

      // -- goals -----------------------------------------------------------
      addGoal: (date, input) => mutate((d, t) => goalsEngine.addGoal(d, date, input, t)),
      toggleGoal: (date, goalId) => mutate((d, t) => goalsEngine.toggleGoal(d, date, goalId, t)),
      toggleSubtask: (date, goalId, subtaskId) =>
        mutate((d, t) => goalsEngine.toggleSubtask(d, date, goalId, subtaskId, t)),
      deleteGoal: (date, goalId) => mutate((d, t) => goalsEngine.deleteGoal(d, date, goalId, t)),
      reorderGoal: (date, from, to) => mutate((d, t) => goalsEngine.reorderGoal(d, date, from, to, t)),
      reorderSubtask: (date, goalId, from, to) =>
        mutate((d, t) => goalsEngine.reorderSubtask(d, date, goalId, from, to, t)),
      setGoalTopic: (date, goalId, topic) =>
        mutate((d, t) => goalsEngine.setGoalTopic(d, date, goalId, topic, t)),
      setGoalHours: (date, goalId, hours) =>
        mutate((d, t) => goalsEngine.setGoalHours(d, date, goalId, hours, t)),
      setSubtaskText: (date, goalId, subtaskId, text) =>
        mutate((d, t) => goalsEngine.setSubtaskText(d, date, goalId, subtaskId, text, t)),
      addEditSubtask: (date, goalId) => {
        mutate((d, t) => {
          goalsEngine.addEditSubtask(d, date, goalId, t)
        })
      },
      removeSubtask: (date, goalId, subtaskId) =>
        mutate((d, t) => goalsEngine.removeSubtask(d, date, goalId, subtaskId, t)),
      stopEditGoal: (date, goalId) => {
        mutate((d, t) => goalsEngine.finishEditGoal(d, date, goalId, t))
        set((s) => {
          s.ui.editingGoalId = null
        })
      },
      logGoalTime: (date, goalId, h, m) =>
        mutate((d, t) => goalsEngine.logGoalTime(d, date, goalId, h, m, t)),
      logSubtaskTime: (date, goalId, subtaskId, h, m) =>
        mutate((d, t) => goalsEngine.logSubtaskTime(d, date, goalId, subtaskId, h, m, t)),

      // -- backlog -----------------------------------------------------------
      moveToBacklog: (date, goalId) =>
        mutate((d, t) => {
          backlogEngine.moveToBacklog(d, date, goalId, t)
        }),
      bulkMoveToBacklog: (date, goalIds) =>
        mutate((d, t) => {
          backlogEngine.bulkMoveToBacklog(d, date, goalIds, t)
        }),
      restoreToDay: (date, goalIds) =>
        mutate((d, t) => backlogEngine.restoreToDay(d, date, goalIds, t)),
      scheduleFromBacklog: (index, date) =>
        mutate((d, t) => backlogEngine.scheduleFromBacklog(d, index, date, t)),
      deleteBacklogItem: (index) => mutate((d) => backlogEngine.deleteBacklogItem(d, index)),

      // -- habits ------------------------------------------------------------
      submitHabit: (draft) => mutate((d, t) => habitsEngine.upsertHabit(d, draft, t)),
      deleteHabit: (habitId) => mutate((d) => habitsEngine.deleteHabit(d, habitId)),

      // -- plans -------------------------------------------------------------
      submitPlan: (draft) => mutate((d, t) => plansEngine.upsertPlan(d, draft, t)),
      deletePlan: (planId) => mutate((d) => plansEngine.deletePlan(d, planId)),
    }
    return state
  }),
)

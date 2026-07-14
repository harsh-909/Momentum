# Momentum 2.0 - Shared Contracts

This file pins the interfaces that let workstreams build in parallel.
Do not change a signature here without updating every consumer.

## Wire contract (frontend <-> backend)

Implemented by `backend/app/routes/*`, consumed by `frontend/src/api/*` (already written - treat those files as the source of truth for shapes).

| Method | Path | Auth | Success | Errors |
|---|---|---|---|---|
| GET | `/api/health` | no | `{"status":"ok"}` (never touches the DB) | - |
| POST | `/api/auth/signup` `{username, password, email}` | no | 202 `{kind:"verify", pendingToken, email}` (email masked; NO session - a code is emailed) | 400/422 `invalid_input`, 409 `username_unavailable`, 429 `rate_limited` |
| POST | `/api/auth/verify-email` `{pendingToken, code}` | no | 200 `{kind:"authed", token, user:{username,email}, expiresAt, emailVerified:true}` | 400 `invalid_code` (wrong/expired/too many attempts - all generic), 409 `email_unavailable`, 429 |
| POST | `/api/auth/resend-code` `{pendingToken}` | no | 202 `{ok:true}` (neutral - same for unknown tokens) | 429 |
| POST | `/api/auth/add-email` `{pendingToken, email}` | no | 202 `{kind:"verify", pendingToken, email}` (for a pre-email account mid-login) | 400 `invalid_token`, 422 `invalid_input`, 429 |
| POST | `/api/auth/login` `{username, password}` | no | 200 — one of: `{kind:"authed", token, user, expiresAt, emailVerified}` (verified); `{kind:"verify", pendingToken, email}` (unverified - code sent); `{kind:"addEmail", pendingToken}` (legacy account, no email yet) | 401 `invalid_credentials` (always generic), 429 |
| POST | `/api/auth/logout` | yes | 204 | 401 `unauthorized` |
| GET | `/api/auth/me` | yes | `{username, email, emailVerified, createdAt}` | 401 |
| GET | `/api/data` | yes | `{version, updatedAt, data}`; never saved -> `{version:0, updatedAt:null, data:null}` | 401 |
| PUT | `/api/data` `{version, data}` | yes | `{version, updatedAt}` (version incremented) | 409 `{error:"version_conflict", version, data}` (winning doc), 413 `payload_too_large`, 422 `invalid_input` |
| GET | `/api/data/export` | yes | raw snapshot JSON, `Content-Disposition: attachment` | 401 |

- Auth: `Authorization: Bearer <opaque token>`; tokens are random 32-byte urlsafe strings, stored sha256-hashed in `sessions`, 30-day sliding expiry. **Only verified accounts ever hold a session** - signup and unverified/legacy logins return a `pendingToken` (also random urlsafe, stored sha256-hashed in `email_verifications`), never a session token.
- Email verification: a 6-digit code is stored as HMAC-SHA256(server pepper, code); `verify-email` compares in constant time, caps attempts (default 5) and expiry (default 15 min), and is single-use. Enumeration-safe: signup/add-email with an already-verified email return the same neutral `verify` response but email the existing owner a notice instead of a code (`decoy` pendingToken). One verified account per email (partial unique index on `users.email WHERE email_verified`); unverified/abandoned signups may reuse an address.
- Email is mandatory: `users.email` is nullable only so pre-email (legacy/imported) accounts still load; on next login they are routed through `add-email` + `verify-email` before a session is issued.
- Error body shape everywhere: `{"error": "<machine_code>", "detail?": "..."}`.
- Save is compare-and-swap: `UPDATE snapshots SET doc=$1, version=version+1 WHERE user_id=$2 AND version=$3`; 0 rows -> 409 with current row. Client sends `version: 0` for the first save (INSERT).
- Username rule (both sides, identical): `^[a-z0-9][a-z0-9_-]{0,31}$`, lowercased. Password: 8-128 chars.
- The `data` payload is deep-opaque to the server: validate only the top level (dict with date-keyed `goals`/`seeded`/`planSeeded` maps, `backlog`/`recurring`/`plans` lists, string `install`/`carriedThrough`/`plansSweptThrough`), plus the global 2MB body cap.

## Snapshot shape

See `frontend/src/types/domain.ts` (authoritative) - identical to v1 `userData/<name>.json` for import/export compatibility. Part 2 adds three plan fields (defaulted on import, so old docs still parse): `plans: PlanTemplate[]`, `planSeeded: Record<DateStr, string[]>` (date -> plan template ids materialized/surfaced that day), and `plansSweptThrough: DateStr | ''` (missed-plan catch-up watermark). Plan instances live in `goals[date]` with a `planId` back-ref and are excluded from all scoring/metrics.

## Engine contract (frontend/src/lib/engine/)

Pure, framework-free TypeScript. No `Date.now()` inside logic functions - "now"/"today" always comes in as a parameter. Mutating functions operate in place on a `Snapshot` (they run inside immer drafts) and MUST no-op when `isReadonly(date, today)`.

```ts
// id.ts (src/lib/id.ts)
uid(): string

// time.ts
hmToHours(h: number, m: number): number
hoursPart(dec: number): number
minsPart(dec: number): number
fmtDuration(dec: number): string          // "1h 30m" | "45m" | "2h"; never "60m"
clampHours(n: unknown): number            // NaN/negative -> 0

// dates.ts
dateStr(d: Date): DateStr
parseLocalDate(s: DateStr): Date          // new Date(s + 'T00:00:00')
currentDay(now: Date, dayStartHour?: number): DateStr   // default DAY_START_HOUR=3
isReadonly(date: DateStr, today: DateStr): boolean       // date < today
shiftDateStr(date: DateStr, delta: number): DateStr
ageLabel(date: DateStr, today: DateStr): string          // today|yesterday|Nd|Nw|Nmo ago
computeMinDate(install: DateStr, goals: Record<DateStr, Goal[]>): DateStr
nextRolloverDelay(now: Date, dayStartHour?: number): number  // ms until ~2s past boundary
formatDisplayDate(date: DateStr, today: DateStr): string

// scoring.ts
isPlanInstance(g: Goal): boolean          // g.planId != null; excluded from ALL score/metrics math
goalProgress(g: Goal): number             // completed=1 | doneSubs/subs | 0
dayProgressPct(goals: Goal[]): number     // scored = non-plan goals; capped 99 unless ALL complete; [] -> 0
goalDoneHours(g: Goal): number            // finite logged | hours if completed | 0
historyGoalHours(g: Goal): number         // loggedHours ?? hours
computeDayStats(goals: Goal[]): DayStats

// goals.ts  (all mutators take (data, date, ..., today) and guard readonly)
addGoal(data, date, input: NewGoalInput, today): void
toggleGoal(data, date, goalId, today): boolean           // true if it just completed (confetti)
toggleSubtask(data, date, goalId, subtaskId, today): void
setGoalTopic(data, date, goalId, topic, today): void
setGoalHours(data, date, goalId, hours, today): void
setSubtaskText(data, date, goalId, subtaskId, text, today): void
addEditSubtask(data, date, goalId, today): string | null // new subtask id (to focus)
removeSubtask(data, date, goalId, subtaskId, today): void
finishEditGoal(data, date, goalId, today): void          // cleanText, drop empties, clamp, recompute
logGoalTime(data, date, goalId, h, m, today): void       // no-subtask goals only
logSubtaskTime(data, date, goalId, subtaskId, h, m, today): void
recomputeGoalLogged(g: Goal): void                       // sum completed subs; null when 0
reorderGoal(data, date, from, to, today): void
reorderSubtask(data, date, goalId, from, to, today): void
deleteGoal(data, date, goalId, today): void
cleanText(s: string): string

// backlog.ts
isBacklogEligible(goal): boolean                         // false for recurringId/planId
moveToBacklog(data, date, goalId, today): boolean        // false for recurringId/readonly
bulkMoveToBacklog(data, date, goalIds, today): string[]  // moves eligible ids, returns moved
restoreToDay(data, date, goalIds, today): void           // undo: pull ids back onto the day
scheduleFromBacklog(data, index, date, today): void      // refuse date < today
deleteBacklogItem(data, index): void

// carryover.ts
sweepPastDays(data, today): void          // watermark carriedThrough + per-goal carried flag
carryCopy(g: Goal, date: DateStr): Goal | null  // incomplete remainder, fresh ids, null if none

// habits.ts
ensureRecurring(data, today): void        // seeds ONLY today; weekday+startDate+seeded gates
instantiateHabit(tpl: HabitTemplate, date: DateStr): Goal
upsertHabit(data, draft: HabitDraft, today): void        // create or edit + syncHabitToToday
syncHabitToToday(data, tpl: HabitTemplate, today): void
deleteHabit(data, habitId): void          // keeps past instances
habitsOnDate(data, date): HabitTemplate[] // for the future-day hint
scheduleLabel(days: number[]): string     // "Every day"|"Weekdays"|"Weekends"|"Mon, Wed"

// recurrence.ts
lastDayOfMonth(year: number, month1: number): number     // 28..31; explicit leap rule
matchesSchedule(rec: Recurrence, date: DateStr): boolean  // exact-day; month-end clamps to last day
recurrenceLabel(rec: Recurrence): string   // "Once on Aug 12, 2026"|"Weekdays"|"Monthly on the 31st"|"Every year on Mar 3"

// plans.ts  (one-off / monthly / yearly items, separate from weekly habits; excluded from scoring)
instantiatePlan(tpl: PlanTemplate, date: DateStr): Goal   // fresh ids, planId back-ref (never recurringId)
ensurePlans(data, today): void            // seeds ONLY today; startDate + matchesSchedule + planSeeded gates
sweepMissedPlans(data, today): void       // catch-up: surfaces missed PAST occurrences to backlog (no planId); watermark plansSweptThrough
upsertPlan(data, draft: PlanDraft, today): void          // create or edit + ensurePlans
deletePlan(data, planId): void            // keeps already-seeded instances / surfaced backlog items
upcomingPlans(data, today, horizonDays): { date; plan }[]  // read-only; occurrences due in the next N days AFTER today, ascending (Today "Coming up" hint)

// metrics.ts
getLast7Days(data, today): { date: DateStr; goals: Goal[] }[]
getLast4Weeks(data, today): { label: string; goals: Goal[] }[]
computeMetrics(data, today): Metrics      // streak >=70% partial credit, 0-goal day breaks
dailySeries(data, today): { label: string; completed: number; total: number }[]
weeklySeries(data, today): { label: string; pct: number }[]
hoursSeries(data, today): { label: string; hours: number }[]

// copy.ts
QUOTES: string[]                          // the 10 v1 quotes, same order
quoteForDate(d: Date): string             // QUOTES[d.getDate() % QUOTES.length]
greetingForHour(h: number): string
isEvening(h: number): boolean             // h >= 20 || h < 4
```

## Store contract

`frontend/src/store/types.ts` (authoritative). UI components use `useAppStore` from `src/store/useAppStore.ts` and pure engine functions for derived values. Until integration (M2) lands the real store, component tests mock `useAppStore`.

## Porting reference

The v1 logic being ported lives in `legacy/app.js`; behavior inventory in `FEATURES.md`; v1 tests in `legacy/tests/app.test.js`.

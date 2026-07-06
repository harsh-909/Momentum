# Work Matter - Task Board

Task tracking for what we're building in Momentum. This file is only about work in
flight; the catalog of what the app *does* lives in `FEATURES.md`.

Every feature we **add / update / remove** is a checkbox item across three sections:

- **🚧 In Progress** - being worked on right now (ideally one focused task).
- **📋 Not Completed** - planned or requested tasks not yet started.
- **✅ Completed** - finished and verified tasks.

**Workflow (applied automatically):**
- **Starting a task** - it is created in **In Progress**, or pulled there from Not Completed / Completed if it already exists. Duplicates are fused into a single entry holding all the detail.
- **Committing a task's work** - the task moves to **Completed** and is checked off.
- Keep **In Progress** focused (ideally one task at a time).

**`/run-test` reads the In Progress section below** to decide what to test.

---

## 🚧 In Progress

- [ ] **Time in hours + minutes** - planned and actual (logged) time is entered as separate hours + minutes fields (minutes in 5-min steps) instead of decimal hours, on goals and habit templates. Internally still stored as decimal hours (no data migration; metrics/charts unchanged); new helpers `hmToHours()`, `hoursPart()`/`minsPart()`, and `fmtDuration()` (renders `1h 30m` / `45m` / `2h`) convert between the two. Entry points: add-goal form, inline goal edit (`setGoalHours`), completed-goal "time actually spent" (`logHM`), and the habit form. All duration displays (pills, day summary, backlog, history, metrics) use `fmtDuration`.
- [ ] **Read-only past days + automatic carry-over** - past days become a frozen, read-only record so their score always reflects reality (fixes a score-inflation bug where carrying unfinished work off a day left only completed goals behind, faking 100%). `isReadonly(date)` guards every mutator (`toggleGoal`/`toggleSubtask`/`commitSubtask`/`removeSubtask`/`logHours`/`deleteGoal`/`addGoal`/`moveGoal`/`moveSubtask`/`startEditGoal`/`moveToBacklog`) and the Today UI hides/disables the matching controls. `autoCarryPastDays()` runs on login/import and copies each unfinished non-habit goal's **remainder** (heading + only incomplete subtasks, fresh ids) into the backlog exactly once, flagging the source `carried` (shown as "↩ carried"); the original stays in place so the day's score is untouched. A persisted **`carriedThrough` watermark** (advanced to yesterday each load) skips days already swept so a refresh/relaunch never double-adds; the per-goal `carried` flag is the secondary guard. The Backlog tab shows "Auto-carried through &lt;date&gt;". The manual "🌙 End Day" flow (`endOfDay()`) is removed, superseded by auto-carry. Habits are excluded from auto-carry but can be moved to the backlog by hand (`moveToBacklog` detaches the `recurringId`). **Live rollover at a 3am day boundary**: a logical day starts at 03:00 local (`dayStartHour`), so `currentDay()` shifts the clock back 3h before taking the date and late-night work counts to the prior day. `startDayWatcher()` / `checkDayRollover()` run the new-day setup at the 03:00 boundary while the app stays open - advance `today`, carry the prior day, seed habits - with a focus/visibility re-check to catch sleeping across the boundary. `dateLabel` follows the logical day; wall-clock greetings do not.
- [ ] **Drag-to-reorder + add-form on top** - reorder goals up/down by dragging within the selected day, and reorder subtasks by dragging within their own goal; the "Add a goal" form now sits above the goals list. Native HTML5 drag-and-drop (no new dependency), grip handles (⠿) as the affordance, disabled while a goal is being edited. `moveGoal()` / `moveSubtask()` splice-and-save; drag state is transient (never persisted). Mouse/desktop only - touch DnD would need a vendored helper.

## 📋 Not Completed

- [ ] **Rich-text formatting in the editor** - bold / italic / lists. Deferred: needs a bundled editor and an HTML data model, which cuts against the offline, zero-dependency design.
- [ ] **Decouple visual effects from the component** - move `celebrate()`, `renderCharts()`, and `document.body.innerHTML` writes out of the state layer.
- [ ] **Centralize the clock** - a single `now()` helper so time-based logic (streaks, greetings) becomes unit-testable.

## ✅ Completed

- [x] **Initialize Git** - repository plus `.gitignore` (excludes `userData/` and `__pycache__/`).
- [x] **Extract `app.js`** - moved the Alpine `app()` component out of `index.html` (execution order preserved).
- [x] **Decouple `commitSubtask` from the DOM** - reads a non-persisted `subtaskDrafts` state instead of `document.getElementById`.
- [x] **Inline goal editing** - edit a goal's title, planned hours, and subtasks in place (`✎` / `✓ Done`); habit-derived goals behave like any other goal.
- [x] **Auto-growing editor + save-time cleanup** - multi-line textareas that grow with content; blank/trailing lines stripped and emptied subtasks dropped on Done (`cleanText`), completion preserved.
- [x] **Task board** - split work tracking into this file, separate from `FEATURES.md`.
- [x] **Regression test suites + `/run-test` / `/run-fulltest`** - Node logic tests, headless-Chrome UI tests (driven as `testuser`), and Python backend tests, all in an isolated temp environment (86 checks). Committed.
- [x] **`/run-test` reads the board** - the command now tests whatever sits in the In Progress section of `workMatter.md`, improvising happy-path and edge cases.
- [x] **Partial-credit scoring** - reward subtask progress, not just fully-completed goals. `goalProgress()` / `dayProgressPct()` drive the progress ring, history badge, 7-day rate, and weekly chart from average per-goal progress (100% only when every goal is truly done). Streak counts a day as a success at **≥70%** progress. Daily "Completed vs Planned" chart and the "X/Y goals done" stat stay whole-goal counts.

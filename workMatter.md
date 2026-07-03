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

_Nothing in progress right now._

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

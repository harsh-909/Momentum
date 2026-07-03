# Work Matter - Task Board

Task tracking for what we're building in Momentum. This file is only about work in
flight; the catalog of what the app *does* lives in `FEATURES.md`.

Every feature we **add / update / remove** is a checkbox item across three sections:

- **🚧 In Progress** - being worked on right now (ideally one focused task).
- **📋 Not Completed** - planned or requested tasks not yet started.
- **✅ Completed** - finished and verified tasks.

**Workflow:** when work starts on a feature, add/move its entry to **In Progress**. If a matching entry already exists under Completed or Not Completed, *move* that one (and fuse any duplicates into a single entry holding all the detail) instead of creating a new one. When done and verified, move it to **Completed** and check it.

**`/run-test` reads the In Progress section below** to decide what to test.

---

## 🚧 In Progress

- [ ] **Regression test suites + `/run-test` / `/run-fulltest`** - Node logic tests, headless-Chrome UI tests (driven as `testuser`), and Python backend tests, all in an isolated temp environment. Built and passing (86 checks); awaiting commit.

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

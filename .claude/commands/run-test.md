---
description: Test whatever feature is In Progress in FEATURES.md - happy path + edge cases, no input needed.
---

Test the feature **currently In Progress** and report the results. Run to completion without asking me anything.

## 1. Figure out what to test

Read the **🚧 In Progress** section of `workMatter.md`. The unchecked item(s) there are the feature(s) under active development - that is what you test.

- If there are several In Progress items, test the one that is an actual user-facing app feature (skip meta items like the task board or the test infra itself). If they are all app features, test each.
- Keep testing **straightforward**. For the feature, improvise:
  - a **happy path** - the normal way a user uses it and it works, and
  - a couple of **edge cases** - empty input, whitespace/blank lines, boundary values (min/max hours), a habit-derived goal, cancel vs. save, etc. - whatever is actually relevant to *this* feature.
- Don't over-engineer. A few clear, targeted checks beat an exhaustive matrix.

## 2. Run the tests

Reuse the existing harness where it already covers the feature:

1. Logic tests: `node tests/app.test.js feature`
2. UI end-to-end tests: `node tests/run_ui.mjs feature`
   (headless Chrome drives the real app against an isolated temp server as user "testuser"; real `userData/` is never touched.)

The `feature` slice targets whatever is under active development. If the In Progress feature has **moved on** from what those suites currently cover, first update the feature-tagged tests - `featureSuite` in `tests/app.test.js` and `tests/e2e.html` - to add the happy-path and edge-case checks for the current feature, then run them.

## 3. Report

- One-line headline: everything passed, or N failures.
- A line per suite: `Logic: X passed, Y failed` and `UI: X passed, Y failed`.
- Say which In Progress feature you tested, and list the happy/edge cases you covered.
- For each ✗ failure: the test name and the most likely cause pointing at the file/function (e.g. `app.js stopEditGoal`). Do not fix it unless I ask.
- Note if the UI suite was skipped (no Chrome found).

Do not modify app code and do not commit - only add/adjust tests as needed, run them, and report.

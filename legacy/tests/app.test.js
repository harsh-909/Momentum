/*
 * Logic regression tests for app.js (the Alpine component factory).
 *
 * These run in plain Node - no browser, no framework, no dependencies. We load
 * app.js as text, evaluate the `app()` factory, build a component instance for
 * user "testuser", and call its methods directly. Only pure/logic methods are
 * tested here; DOM-dependent behavior (autoGrow, x-model bindings) is covered by
 * the browser suite in tests/e2e.html.
 *
 * Usage:
 *   node tests/app.test.js            # full logic suite
 *   node tests/app.test.js feature    # only the current feature (partial-credit scoring)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const appFactory = new Function(code + '\n;return app;')();

// Browser globals a few methods reach for. We never hit the DOM here.
global.confirm = () => true;
global.alert = () => {};

const SUITE = (process.argv[2] || 'all').toLowerCase();
const TODAY = '2026-07-03';

function makeApp(today = TODAY) {
  const a = appFactory();
  a.userName = 'testuser';
  a.loggedIn = true;
  a.today = today;
  a.selectedDate = today;
  a.install = today;
  a.save = () => { a._saves = (a._saves || 0) + 1; };   // stub persistence
  a.flushNow = async () => {};
  return a;
}

// ---- tiny assert harness ----
let passed = 0, failed = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? `  ->  ${detail}` : ''}`); }
}
function section(title) { console.log(`\n${title}`); }

// Build a goal in a day quickly.
function seedGoal(a, over = {}) {
  const g = Object.assign({
    id: a.uid(), topic: 'Goal', hours: 1, loggedHours: null,
    completed: false, subtasks: [], createdAt: a.selectedDate, addingSubtask: false,
  }, over);
  (a.goals[a.selectedDate] = a.goals[a.selectedDate] || []).push(g);
  return g;
}

// ============================================================
// CURRENT FEATURE: per-subtask time logging (rolls up to the goal's actual time)
// (logSubtaskHM / recomputeGoalLogged; toggles + remove keep the total in sync)
// ============================================================
function featureSuite() {
  section('Feature: per-subtask time logging');
  const a = makeApp();

  // A goal with subtasks: actual time = sum of the completed subtasks' logged time.
  const g = seedGoal(a, { hours: 2, subtasks: [
    { id: 's1', text: 'a', completed: false, loggedHours: null },
    { id: 's2', text: 'b', completed: false, loggedHours: null },
  ]});
  const gi = a.goals[a.selectedDate].indexOf(g);

  a.recomputeGoalLogged(g);
  check('nothing logged yet -> goal.loggedHours stays null (falls back to planned)', g.loggedHours === null);

  a.toggleSubtask(a.selectedDate, gi, 0);
  a.logSubtaskHM(a.selectedDate, gi, 0, 0, 30);
  check('subtask stores its own logged time (30m)', g.subtasks[0].loggedHours === 0.5);
  check('goal actual rolls up the one logged subtask (0.5)', g.loggedHours === 0.5);

  a.toggleSubtask(a.selectedDate, gi, 1);
  check('goal auto-completes when every subtask is done', g.completed === true);
  a.logSubtaskHM(a.selectedDate, gi, 1, 1, 15);
  check('goal actual = sum of subtask times (1.75)', g.loggedHours === 1.75);

  a.toggleSubtask(a.selectedDate, gi, 1);   // uncheck sub 1
  check('unchecking a subtask drops its time from the total', g.loggedHours === 0.5);
  check('unchecking preserves the subtask value for later', g.subtasks[1].loggedHours === 1.25);

  a.toggleSubtask(a.selectedDate, gi, 1);   // re-check
  check('re-checking restores its time', g.loggedHours === 1.75);
  a.removeSubtask(a.selectedDate, gi, 1);
  check('removing a subtask reduces the goal total', g.loggedHours === 0.5);

  // A goal WITHOUT subtasks keeps the manual whole-goal log (logHM); recompute leaves it alone.
  {
    const s = makeApp();
    const g2 = seedGoal(s, { hours: 1, completed: true, subtasks: [] });
    s.logHM(s.selectedDate, 0, 0, 45);
    check('subtask-less goal logs time manually', g2.loggedHours === 0.75);
    s.recomputeGoalLogged(g2);
    check('recompute is a no-op for a subtask-less goal', g2.loggedHours === 0.75);
  }

  // Read-only past day rejects per-subtask logging.
  {
    const p = makeApp();
    seedGoalOn(p, PAST, { subtasks: [{ id: 'x', text: 'x', completed: true, loggedHours: null }] });
    p.logSubtaskHM(PAST, 0, 0, 2, 0);
    check('logSubtaskHM is a no-op on a read-only past day', p.goals[PAST][0].subtasks[0].loggedHours === null);
  }

  // Day totals reflect planned vs actual (summed from subtasks).
  {
    const s = makeApp();
    seedGoal(s, { hours: 2, completed: true, subtasks: [
      { id: 'p1', text: 'a', completed: true, loggedHours: 0.5 },
      { id: 'p2', text: 'b', completed: true, loggedHours: 1 },
    ]});
    s.recomputeGoalLogged(s.goals[s.selectedDate][0]);
    check('dayStats planned total (2h)', s.dayStats().hours === 2);
    check('dayStats logged total sums subtask time (1.5)', s.dayStats().doneHours === 1.5);
  }

  // Logged time counts as soon as it is logged - a goal does NOT have to be
  // fully complete for its subtasks' logged time to reach the day/metrics totals.
  {
    const s = makeApp();
    seedGoal(s, { hours: 3, completed: false, subtasks: [
      { id: 'q1', text: 'a', completed: true, loggedHours: 0.75 },
      { id: 'q2', text: 'b', completed: false, loggedHours: null },
    ]});
    s.recomputeGoalLogged(s.goals[s.selectedDate][0]);
    check('partial goal: logged subtask time counts in dayStats (0.75)', s.dayStats().doneHours === 0.75, 'doneHours=' + s.dayStats().doneHours);
    check('partial goal: logged subtask time counts in metrics hours (0.8)', s.metrics().totalHours === 0.8, 'totalHours=' + s.metrics().totalHours);

    // An untouched incomplete goal must still contribute nothing - the
    // planned-hours fallback applies only to fully completed goals.
    seedGoal(s, { hours: 5, completed: false, subtasks: [] });
    check('incomplete goal with nothing logged contributes 0', s.dayStats().doneHours === 0.75, 'doneHours=' + s.dayStats().doneHours);
  }
}

// ============================================================
// SHIPPED: time entry in hours + minutes - permanent regression
// (hmToHours / fmtDuration / hoursPart / minsPart, planned + logged)
// ============================================================
function timeHmSuite() {
  section('Time entry in hours + minutes');
  const a = makeApp();

  // ---- hmToHours: combine the two fields into decimal hours ----
  check('hmToHours: 1h 30m -> 1.5', a.hmToHours(1, 30) === 1.5);
  check('hmToHours: 0h 45m -> 0.75', a.hmToHours(0, 45) === 0.75);
  check('hmToHours: 2h 0m -> 2', a.hmToHours(2, 0) === 2);
  check('hmToHours: blanks -> 0', a.hmToHours('', '') === 0);
  check('hmToHours: negatives floored to 0', a.hmToHours(-3, -10) === 0);

  // ---- hoursPart / minsPart: split decimal hours back into fields ----
  check('hoursPart: 1.5 -> 1', a.hoursPart(1.5) === 1);
  check('minsPart: 1.5 -> 30', a.minsPart(1.5) === 30);
  check('minsPart: 0.25 (legacy quarter-hour) -> 15', a.minsPart(0.25) === 15);
  check('split round-trips through hmToHours', a.hmToHours(a.hoursPart(2.75), a.minsPart(2.75)) === 2.75);

  // ---- fmtDuration: human label, never shows 60m ----
  check('fmtDuration: 1.5 -> "1h 30m"', a.fmtDuration(1.5) === '1h 30m');
  check('fmtDuration: 2 -> "2h"', a.fmtDuration(2) === '2h');
  check('fmtDuration: 0.75 -> "45m"', a.fmtDuration(0.75) === '45m');
  check('fmtDuration: 0 -> "0m"', a.fmtDuration(0) === '0m');

  // ---- addGoal reads the hours + minutes form fields ----
  {
    const s = makeApp();
    s.newGoal = { topic: 'Study', hours: 1, minutes: 30, subtasksText: '' };
    s.addGoal();
    check('addGoal stores decimal hours from h+m', s.goals[TODAY][0].hours === 1.5);
    check('addGoal resets minutes on the form', s.newGoal.minutes === 0);
  }
  {
    const s = makeApp();
    s.newGoal = { topic: 'Zero', hours: 0, minutes: 0, subtasksText: '' };
    s.addGoal();
    check('addGoal defaults empty time to 1h', s.goals[TODAY][0].hours === 1);
  }

  // ---- inline edit via setGoalHours ----
  {
    const s = makeApp();
    const g = seedGoal(s, { hours: 2 });
    s.setGoalHours(g, 0, 45);
    check('setGoalHours writes decimal hours', g.hours === 0.75);
  }

  // ---- logHM: actual time after completion ----
  {
    const s = makeApp();
    const g = seedGoal(s, { hours: 2, completed: true });
    s.logHM(TODAY, 0, 1, 15);
    check('logHM stores logged decimal hours', g.loggedHours === 1.25);
    // EDGE: a read-only past day rejects logging.
    const p = makeApp();
    seedGoalOn(p, PAST, { completed: true });
    p.logHM(PAST, 0, 3, 0);
    check('logHM is a no-op on a read-only past day', p.goals[PAST][0].loggedHours === null);
  }

  // ---- habits store h+m too ----
  {
    const s = makeApp();
    s.newHabit = { topic: 'Walk', hours: 0, minutes: 30, subtasksText: '', days: [0,1,2,3,4,5,6] };
    s.submitHabit();
    check('submitHabit stores decimal hours from h+m', s.recurring[0].hours === 0.5);
    s.openEditHabit(s.recurring[0]);
    check('openEditHabit splits hours into the h field', s.newHabit.hours === 0);
    check('openEditHabit splits hours into the m field', s.newHabit.minutes === 30);
  }
}

// ============================================================
// SHIPPED: read-only past days + automatic carry-over - permanent regression
// (isReadonly / autoCarryPastDays / carryCopy)
// ============================================================
const PAST = '2026-07-01';   // strictly before TODAY (2026-07-03)

// Seed a goal on an arbitrary date (seedGoal only targets selectedDate).
function seedGoalOn(a, date, over = {}) {
  const g = Object.assign({
    id: a.uid(), topic: 'Goal', hours: 1, loggedHours: null,
    completed: false, subtasks: [], createdAt: date, addingSubtask: false,
  }, over);
  (a.goals[date] = a.goals[date] || []).push(g);
  return g;
}

function readonlyCarrySuite() {
  section('Read-only past days + automatic carry-over');

  // ---- isReadonly: only past days are frozen ----
  {
    const a = makeApp();
    check('isReadonly: past day is read-only', a.isReadonly(PAST) === true);
    check('isReadonly: today is editable', a.isReadonly(TODAY) === false);
    check('isReadonly: future day is editable', a.isReadonly('2026-07-05') === false);
  }

  // ---- THE BUG: carrying unfinished work must NOT inflate the past day's score ----
  {
    const a = makeApp();
    // Yesterday: 4 goals, 2 finished -> the honest score is 50%.
    seedGoalOn(a, PAST, { topic: 'done1', completed: true });
    seedGoalOn(a, PAST, { topic: 'done2', completed: true });
    seedGoalOn(a, PAST, { topic: 'miss1', completed: false });
    seedGoalOn(a, PAST, { topic: 'miss2', completed: false });

    check('pre-carry score is the honest 50%', a.dayProgressPct(a.goals[PAST]) === 50);
    a.autoCarryPastDays();
    // Regression guard for the inflation bug: the day KEEPS all 4 goals, so the score stays 50%.
    check('past day retains all goals after carry', a.goals[PAST].length === 4);
    check('past-day score is NOT inflated to 100 (stays 50)', a.dayProgressPct(a.goals[PAST]) === 50);
    check('only the 2 unfinished goals were copied to backlog', a.backlog.length === 2);
    check('carried copies are the unfinished ones', eq(a.backlog.map(g => g.topic).sort(), ['miss1', 'miss2']));
    check('source goals are flagged carried', a.goals[PAST].filter(g => g.carried).length === 2);
    check('completed source goals are not flagged carried', a.goals[PAST].filter(g => g.completed && g.carried).length === 0);
  }

  // ---- Partial goal: only the incomplete subtasks are copied, past record is untouched ----
  {
    const a = makeApp();
    const g = seedGoalOn(a, PAST, { topic: 'partial', completed: false, subtasks: [
      { id: 's1', text: 'done step', completed: true },
      { id: 's2', text: 'todo A', completed: false },
      { id: 's3', text: 'todo B', completed: false },
    ]});
    a.autoCarryPastDays();
    check('partial: past goal keeps ALL its subtasks', g.subtasks.length === 3);
    check('partial: past goal keeps the completed subtask', g.subtasks[0].completed === true);
    const copy = a.backlog[0];
    check('partial: backlog copy carries only the 2 incomplete subtasks', copy.subtasks.length === 2);
    check('partial: copy carries the right subtask text', eq(copy.subtasks.map(s => s.text).sort(), ['todo A', 'todo B']));
    check('partial: copy subtasks start incomplete', copy.subtasks.every(s => !s.completed));
    check('partial: copy is not completed', copy.completed === false);
  }

  // ---- Independence: copy gets fresh ids; finishing it never touches the past ----
  {
    const a = makeApp();
    const g = seedGoalOn(a, PAST, { id: 'orig', topic: 'x', completed: false, subtasks: [
      { id: 'sub-orig', text: 'step', completed: false },
    ]});
    a.autoCarryPastDays();
    const copy = a.backlog[0];
    check('independence: copy has a fresh goal id', copy.id !== 'orig');
    check('independence: copy has fresh subtask ids', copy.subtasks[0].id !== 'sub-orig');
    // Complete the backlog copy; the frozen past instance must not change.
    copy.completed = true; copy.subtasks[0].completed = true;
    check('independence: past goal stays incomplete', g.completed === false && g.subtasks[0].completed === false);
    check('independence: past day score unaffected', a.dayProgressPct(a.goals[PAST]) === 0);
  }

  // ---- Idempotent: a second sweep carries nothing new (carried flag blocks re-carry) ----
  {
    const a = makeApp();
    seedGoalOn(a, PAST, { topic: 'miss', completed: false });
    a.autoCarryPastDays();
    a.autoCarryPastDays();
    check('idempotent: re-running the sweep does not duplicate', a.backlog.length === 1);
  }

  // ---- Watermark (carriedThrough): advances to yesterday and blocks re-sweeping ----
  {
    const a = makeApp();   // TODAY = 2026-07-03 -> yesterday = 2026-07-02
    check('watermark: starts empty', a.carriedThrough === '');
    seedGoalOn(a, PAST, { topic: 'old miss', completed: false });   // PAST = 2026-07-01
    a.autoCarryPastDays();
    check('watermark: advances to yesterday after a sweep', a.carriedThrough === '2026-07-02');
    check('watermark: swept the past day before it', a.backlog.length === 1);
    check('watermark: persisted in snapshot', a.snapshot().carriedThrough === '2026-07-02');
  }
  {
    // A day at/under the watermark is skipped even if it holds an un-flagged pending goal.
    const a = makeApp();
    a.carriedThrough = '2026-07-02';
    seedGoalOn(a, '2026-07-02', { topic: 'already-swept-day', completed: false });
    a.autoCarryPastDays();
    check('watermark: does not re-sweep a day at/under the watermark', a.backlog.length === 0);
    check('watermark: skipped goal is left un-flagged', !a.goals['2026-07-02'][0].carried);
  }
  {
    // A day strictly after the watermark (but before today) is swept.
    const a = makeApp();
    a.carriedThrough = '2026-07-01';
    seedGoalOn(a, '2026-07-02', { topic: 'new miss', completed: false });
    a.autoCarryPastDays();
    check('watermark: sweeps a day after the watermark', a.backlog.length === 1 && a.backlog[0].topic === 'new miss');
    check('watermark: does not rewind on a later run', a.carriedThrough === '2026-07-02');
  }
  {
    // Empty history still advances the watermark so future loads have a clean lower bound.
    const a = makeApp();
    a.autoCarryPastDays();
    check('watermark: set even when there is nothing to carry', a.carriedThrough === '2026-07-02');
  }

  // ---- Habits are never carried; today/future days are never swept ----
  {
    const a = makeApp();
    seedGoalOn(a, PAST, { topic: 'habit', completed: false, recurringId: 'r1' });
    seedGoalOn(a, TODAY, { topic: 'today-undone', completed: false });
    seedGoalOn(a, '2026-07-05', { topic: 'future-undone', completed: false });
    a.autoCarryPastDays();
    check('habits on a past day are never carried', a.backlog.length === 0);
    check('past habit is not flagged carried', !a.goals[PAST][0].carried);
    check('today is not swept', !a.goals[TODAY][0].carried);
    check('future is not swept', !a.goals['2026-07-05'][0].carried);
  }

  // ---- Edge: goal left unchecked but all subtasks done -> flagged, nothing copied ----
  {
    const a = makeApp();
    seedGoalOn(a, PAST, { topic: 'no-remainder', completed: false, subtasks: [
      { id: 'a', text: 'a', completed: true }, { id: 'b', text: 'b', completed: true },
    ]});
    a.autoCarryPastDays();
    check('no-remainder goal is flagged carried', a.goals[PAST][0].carried === true);
    check('no-remainder goal copies nothing to backlog', a.backlog.length === 0);
  }

  // ---- Read-only guards: mutators no-op on a past date ----
  {
    const a = makeApp();
    const g = seedGoalOn(a, PAST, { topic: 'frozen', completed: false, subtasks: [
      { id: 's1', text: 's1', completed: false },
    ]});
    a.selectedDate = PAST;
    a.toggleGoal(PAST, 0);
    check('read-only: toggleGoal is a no-op on a past day', g.completed === false);
    a.toggleSubtask(PAST, 0, 0);
    check('read-only: toggleSubtask is a no-op', g.subtasks[0].completed === false);
    a.logHours(PAST, 0, '5');
    check('read-only: logHours is a no-op', g.loggedHours === null);
    a.addEditSubtask(g);
    check('read-only: addEditSubtask is a no-op', g.subtasks.length === 1);
    a.removeSubtask(PAST, 0, 0);
    check('read-only: removeSubtask is a no-op', g.subtasks.length === 1);
    a.deleteGoal(PAST, 0);
    check('read-only: deleteGoal is a no-op', (a.goals[PAST] || []).length === 1);
    a.startEditGoal(g);
    check('read-only: startEditGoal is a no-op', a.editingGoalId === null);
    a.newGoal = { topic: 'new', hours: 1, subtasksText: '' };
    a.addGoal();
    check('read-only: addGoal is a no-op on a past day', a.goals[PAST].length === 1);
    a.moveToBacklog(PAST, 0);
    check('read-only: moveToBacklog is a no-op on a past day', a.goals[PAST].length === 1 && a.backlog.length === 0);
  }

  // ---- addEditSubtask: adding subtasks happens only in edit mode ----
  {
    const a = makeApp();
    const g = seedGoal(a, { completed: true, subtasks: [{ id: 's1', text: 'done', completed: true }] });
    a.addEditSubtask(g);
    check('addEditSubtask appends an empty subtask', g.subtasks.length === 2 && g.subtasks[1].text === '');
    check('addEditSubtask un-completes the goal', g.completed === false);
    check('addEditSubtask gives the new subtask a fresh id', typeof g.subtasks[1].id === 'string' && g.subtasks[1].id !== 's1');
    // Empty subtasks are dropped when editing ends (stopEditGoal already does this).
    a.startEditGoal(g);
    a.stopEditGoal(g);
    check('empty added subtask is dropped on Done', g.subtasks.length === 1);
  }

  // ---- Day boundary at 03:00 (currentDay): late-night work counts to the prior day ----
  {
    const a = makeApp();
    check('currentDay: default boundary is 3am', a.dayStartHour === 3);
    // (month is 0-indexed: 6 = July)
    check('currentDay: 00:00 reads as the previous day', a.currentDay(new Date(2026, 6, 6, 0, 0)) === '2026-07-05');
    check('currentDay: 02:30 reads as the previous day', a.currentDay(new Date(2026, 6, 6, 2, 30)) === '2026-07-05');
    check('currentDay: exactly 03:00 flips to the new day', a.currentDay(new Date(2026, 6, 6, 3, 0)) === '2026-07-06');
    check('currentDay: 03:30 reads as the new day', a.currentDay(new Date(2026, 6, 6, 3, 30)) === '2026-07-06');
    check('currentDay: midday reads as the same day', a.currentDay(new Date(2026, 6, 6, 13, 0)) === '2026-07-06');
  }

  // ---- Live day rollover (checkDayRollover): new-day setup at the boundary while running ----
  {
    const a = makeApp();   // today = 2026-07-03
    a.recurring = [{ id: 'r1', topic: 'Meditate', hours: 0.5, subtasks: [], startDate: '2026-07-03', days: [0,1,2,3,4,5,6] }];
    seedGoalOn(a, '2026-07-03', { topic: 'left over', completed: false });
    a.checkDayRollover('2026-07-04');   // simulate the clock crossing midnight
    check('rollover: today advances to the new date', a.today === '2026-07-04');
    check('rollover: selectedDate follows onto the fresh day', a.selectedDate === '2026-07-04');
    check('rollover: yesterday\'s unfinished goal is carried to backlog', a.backlog.some(g => g.topic === 'left over'));
    check('rollover: yesterday\'s goal is left in place, flagged carried', a.goals['2026-07-03'].some(g => g.topic === 'left over' && g.carried));
    check('rollover: yesterday is now read-only', a.isReadonly('2026-07-03') === true);
    check('rollover: today\'s habit is seeded on the new day', (a.goals['2026-07-04'] || []).some(g => g.recurringId === 'r1'));
    check('rollover: watermark advanced to the new yesterday', a.carriedThrough === '2026-07-03');
  }
  {
    // Same-day call is a no-op; a user parked on another date isn't yanked to today.
    const a = makeApp();
    const savesBefore = a._saves || 0;
    a.checkDayRollover('2026-07-03');
    check('rollover: same-date call does nothing', a.today === '2026-07-03' && (a._saves || 0) === savesBefore);

    const b = makeApp();
    b.selectedDate = '2026-07-01';   // deliberately viewing an earlier day
    b.checkDayRollover('2026-07-04');
    check('rollover: does not move a user parked on another date', b.selectedDate === '2026-07-01');
    check('rollover: still advances today underneath them', b.today === '2026-07-04');
  }
  {
    // Guard: never rolls over while logged out.
    const a = makeApp();
    a.loggedIn = false;
    a.checkDayRollover('2026-07-09');
    check('rollover: no-op when logged out', a.today === '2026-07-03');
  }
}

// ============================================================
// SHIPPED: drag-to-reorder (moveGoal / moveSubtask) - permanent regression
// ============================================================
function dragReorderSuite() {
  section('Drag-to-reorder (moveGoal / moveSubtask)');
  const a = makeApp();

  // ---- moveGoal: reorder goals within the selected day ----
  seedGoal(a, { topic: 'A' });
  seedGoal(a, { topic: 'B' });
  seedGoal(a, { topic: 'C' });
  const topics = () => a.goals[a.selectedDate].map(g => g.topic);

  a.moveGoal(0, 2);
  check('moveGoal moves the first goal down to the target index', eq(topics(), ['B', 'C', 'A']));
  a.moveGoal(2, 0);
  check('moveGoal moves the last goal up to the front', eq(topics(), ['A', 'B', 'C']));

  const savesBefore = a._saves || 0;
  a.moveGoal(1, 1);
  check('moveGoal with same index is a no-op', eq(topics(), ['A', 'B', 'C']));
  check('moveGoal no-op does not persist', (a._saves || 0) === savesBefore);

  a.moveGoal(0, 5);
  check('moveGoal ignores an out-of-bounds target', eq(topics(), ['A', 'B', 'C']));
  a.moveGoal(null, 1);
  check('moveGoal ignores a null source', eq(topics(), ['A', 'B', 'C']));

  // ---- moveSubtask: reorder within a single goal ----
  const g = seedGoal(a, { topic: 'withSubs', subtasks: [
    { id: 's1', text: 'one', completed: false },
    { id: 's2', text: 'two', completed: false },
    { id: 's3', text: 'three', completed: false },
  ]});
  const subText = () => g.subtasks.map(s => s.text);

  a.moveSubtask(g, 0, 2);
  check('moveSubtask moves a subtask down', eq(subText(), ['two', 'three', 'one']));
  a.moveSubtask(g, 2, 0);
  check('moveSubtask moves a subtask up', eq(subText(), ['one', 'two', 'three']));
  a.moveSubtask(g, 1, 1);
  check('moveSubtask with same index is a no-op', eq(subText(), ['one', 'two', 'three']));
  a.moveSubtask(g, 0, 9);
  check('moveSubtask ignores an out-of-bounds target', eq(subText(), ['one', 'two', 'three']));

  // EDGE: reordering moves the whole subtask object, so completion state rides along.
  const g6 = seedGoal(a, { subtasks: [
    { id: 'x', text: 'x', completed: true },
    { id: 'y', text: 'y', completed: false },
  ]});
  a.moveSubtask(g6, 1, 0);
  check('moveSubtask preserves each subtask completion state',
    g6.subtasks[0].text === 'y' && g6.subtasks[0].completed === false &&
    g6.subtasks[1].text === 'x' && g6.subtasks[1].completed === true);

  // Transient drag state must never be persisted.
  a.dragGoalIndex = 2; a.dragSubGoalId = 'zzz'; a.dragSubIndex = 1;
  const snap = a.snapshot();
  check('snapshot() excludes dragGoalIndex', !('dragGoalIndex' in snap));
  check('snapshot() excludes dragSubGoalId', !('dragSubGoalId' in snap));
}

// ============================================================
// SHIPPED: partial-credit scoring - permanent regression
// (goalProgress / dayProgressPct + streak threshold)
// ============================================================
function partialCreditSuite() {
  section('Partial-credit scoring (goalProgress / dayProgressPct / streak)');
  const a = makeApp();

  // ---- goalProgress: per-goal fraction, 0..1 ----
  check('goalProgress: completed goal -> 1', a.goalProgress({ completed: true, subtasks: [] }) === 1);
  check('goalProgress: no subtasks, incomplete -> 0', a.goalProgress({ completed: false, subtasks: [] }) === 0);
  check('goalProgress: 2 of 4 subtasks -> 0.5', a.goalProgress({ completed: false, subtasks: [
    { completed: true }, { completed: true }, { completed: false }, { completed: false },
  ]}) === 0.5);
  check('goalProgress: all subtasks done -> 1', a.goalProgress({ completed: false, subtasks: [
    { completed: true }, { completed: true },
  ]}) === 1);
  check('goalProgress: missing subtasks array -> 0', a.goalProgress({ completed: false }) === 0);

  // ---- dayProgressPct: averages per-goal progress ----
  check('dayProgressPct: empty day -> 0', a.dayProgressPct([]) === 0);
  check('dayProgressPct: all goals complete -> 100', a.dayProgressPct([
    { completed: true, subtasks: [] }, { completed: true, subtasks: [] },
  ]) === 100);
  // one fully done (1) + one half done (0.5) -> avg 0.75 -> 75
  check('dayProgressPct: partial mix -> 75', a.dayProgressPct([
    { completed: true, subtasks: [] },
    { completed: false, subtasks: [{ completed: true }, { completed: false }] },
  ]) === 75);
  // EDGE: rounding must never fake a perfect day (199/200 -> 99.5, would round to 100)
  check('dayProgressPct: near-100 but unfinished clamps to 99', a.dayProgressPct([
    { completed: false, subtasks: Array.from({ length: 200 }, (_, i) => ({ completed: i < 199 })) },
  ]) === 99);

  // ---- these feed the ring, history badge, weekly chart ----
  {
    const s = makeApp();
    seedGoal(s, { completed: true, subtasks: [] });
    seedGoal(s, { completed: false, subtasks: [{ id: 'x', text: 'x', completed: true }, { id: 'y', text: 'y', completed: false }] });
    check('dayStats.pct reflects partial credit (75)', s.dayStats().pct === 75);
    check('dayStats.completed stays whole goals (1)', s.dayStats().completed === 1 && s.dayStats().total === 2);
    check('historyDayPct reflects partial credit (75)', s.historyDayPct(s.selectedDate) === 75);
  }

  // ---- streak: a day counts once it clears the 70% threshold ----
  {
    const s = makeApp();
    const d = s.getLast7Days();
    d[6] && (s.goals[d[6]] = [{ completed: false, subtasks: [
      { completed: true }, { completed: true }, { completed: true }, { completed: true },
      { completed: true }, { completed: true }, { completed: true },
      { completed: false }, { completed: false }, { completed: false },
    ]}]);                                             // today: 7/10 = exactly 70%
    s.goals[d[5]] = [{ completed: true, subtasks: [] }];   // yesterday: 100%
    check('streak: day at exactly 70% keeps the streak', s.metrics().streak === 2);
  }
  {
    const s = makeApp();
    const d = s.getLast7Days();
    s.goals[d[6]] = [{ completed: false, subtasks: [
      { completed: true }, { completed: true }, { completed: true },
      { completed: false }, { completed: false },
    ]}];                                              // today: 3/5 = 60%, below threshold
    s.goals[d[5]] = [{ completed: true, subtasks: [] }];
    check('streak: day below 70% breaks the streak', s.metrics().streak === 0);
  }
  {
    const s = makeApp();
    const d = s.getLast7Days();
    s.goals[d[6]] = [{ completed: false, subtasks: [
      { completed: true }, { completed: true }, { completed: true }, { completed: true },
      { completed: false },
    ]}];                                              // today: 4/5 = 80%
    check('metrics.avgWeek uses partial credit (80)', s.metrics().avgWeek === 80);
  }
}

// ============================================================
// SHIPPED: goal editing (inline edit + cleanup) - permanent regression
// ============================================================
function goalEditingSuite() {
  section('Goal editing (cleanText / stopEditGoal / removeSubtask)');
  const a = makeApp();

  // cleanText
  check('cleanText drops blank lines', a.cleanText('a\n\n\nb') === 'a\nb');
  check('cleanText trims leading/trailing blank lines', a.cleanText('\n\nhello\n\n') === 'hello');
  check('cleanText drops whitespace-only lines', a.cleanText('line1\n   \nline2') === 'line1\nline2');
  check('cleanText on empty -> empty', a.cleanText('') === '');
  check('cleanText on all-blank -> empty', a.cleanText('  \n \n\t') === '');

  // startEditGoal / editingGoalId
  const g = seedGoal(a, { topic: 'edit me' });
  a.startEditGoal(g);
  check('startEditGoal sets editingGoalId', a.editingGoalId === g.id);

  // stopEditGoal: clean title, coerce hours, clean+drop subtasks, preserve completion
  const g2 = seedGoal(a, {
    topic: 'New Title\n\n\n',
    hours: '',
    subtasks: [
      { id: 's1', text: 'keep me\n\n', completed: true },
      { id: 's2', text: '   ', completed: false },
      { id: 's3', text: '', completed: false },
      { id: 's4', text: 'also keep', completed: false },
    ],
  });
  a.startEditGoal(g2);
  a.stopEditGoal(g2);
  check('stopEditGoal clears editing mode', a.editingGoalId === null);
  check('stopEditGoal cleans title', g2.topic === 'New Title');
  check('stopEditGoal coerces empty hours to 0', g2.hours === 0);
  check('stopEditGoal drops empty subtasks', g2.subtasks.length === 2);
  check('stopEditGoal keeps non-empty subtask text', eq(g2.subtasks.map(s => s.text), ['keep me', 'also keep']));
  check('stopEditGoal preserves subtask completion', g2.subtasks[0].completed === true);
  check('stopEditGoal recomputes goal.completed (not all done)', g2.completed === false);

  // negative hours guarded
  const g3 = seedGoal(a, { hours: -5 });
  a.stopEditGoal(g3);
  check('stopEditGoal guards negative hours -> 0', g3.hours === 0);

  // removeSubtask recompute + empty-list guard
  const g4 = seedGoal(a, { completed: false, subtasks: [
    { id: 'a', text: 'a', completed: true }, { id: 'b', text: 'b', completed: false },
  ]});
  const gi4 = a.goals[a.selectedDate].indexOf(g4);
  a.removeSubtask(a.selectedDate, gi4, 1);           // remove the incomplete one
  check('removeSubtask removes the subtask', g4.subtasks.length === 1);
  check('removeSubtask recomputes completion (all remaining done)', g4.completed === true);

  const g5 = seedGoal(a, { completed: false, subtasks: [{ id: 'x', text: 'x', completed: false }] });
  const gi5 = a.goals[a.selectedDate].indexOf(g5);
  a.removeSubtask(a.selectedDate, gi5, 0);           // now empty
  check('removeSubtask empty-list does not flip completed', g5.subtasks.length === 0 && g5.completed === false);

  // editing state never persisted
  a.editingGoalId = 'something';
  const snap = a.snapshot();
  check('snapshot() excludes editingGoalId', !('editingGoalId' in snap));
}

// ============================================================
// CORE app behavior (full regression)
// ============================================================
function coreSuite() {
  goalEditingSuite();     // shipped feature, kept as permanent regression
  partialCreditSuite();   // shipped feature, kept as permanent regression
  dragReorderSuite();     // shipped feature, kept as permanent regression
  readonlyCarrySuite();   // shipped feature, kept as permanent regression
  timeHmSuite();          // shipped feature, kept as permanent regression

  section('Core: goals & subtasks');
  {
    const a = makeApp();
    a.newGoal = { topic: 'Read', hours: 2, subtasksText: 'one\ntwo' };
    a.addGoal();
    const g = a.goals[TODAY][0];
    check('addGoal creates a goal', !!g && g.topic === 'Read' && g.hours === 2);
    check('addGoal parses subtasks', g.subtasks.length === 2 && g.subtasks[0].text === 'one');
    check('addGoal resets the form', a.newGoal.topic === '');

    a.toggleGoal(TODAY, 0);
    check('toggleGoal completes goal + all subtasks', g.completed && g.subtasks.every(s => s.completed));

    a.toggleSubtask(TODAY, 0, 0);
    check('toggleSubtask un-does parent when a subtask is unchecked', g.completed === false);

    a.addEditSubtask(g);
    check('addEditSubtask appends an empty subtask', g.subtasks.length === 3 && g.subtasks[2].text === '');

    a.logHours(TODAY, 0, '2.5');
    check('logHours records logged hours', g.loggedHours === 2.5);

    a.deleteGoal(TODAY, 0);
    check('deleteGoal removes it', (a.goals[TODAY] || []).length === 0);
  }

  section('Core: backlog');
  {
    // moveToBacklog
    const a = makeApp();
    const undone = seedGoal(a, { topic: 'undone', completed: false });
    a.moveToBacklog(TODAY, a.goals[TODAY].indexOf(undone));
    check('moveToBacklog moves goal to backlog', a.backlog.length === 1 && a.backlog[0].topic === 'undone');
    check('moveToBacklog stamps originalDate', a.backlog[0].originalDate === TODAY);
    check('moveToBacklog removes from the day', (a.goals[TODAY] || []).length === 0);

    // Habits are day-bound: they are never transferable to the backlog, by hand or otherwise.
    const h = makeApp();
    const habitInst = seedGoal(h, { topic: 'Meditate', completed: false, recurringId: 'r1' });
    h.moveToBacklog(TODAY, h.goals[TODAY].indexOf(habitInst));
    check('moveToBacklog refuses a habit instance', h.backlog.length === 0);
    check('moveToBacklog leaves the habit on its day', (h.goals[TODAY] || []).length === 1 && h.goals[TODAY][0].recurringId === 'r1');

    // (Past-day carry-over lives in featureSuite: autoCarryPastDays copies unfinished
    // work without emptying or inflating the past day - the endOfDay flow was removed.)

    // scheduleFromBacklog
    const c = makeApp();
    c.backlog = [{ id: 'bk1', topic: 'later', hours: 1, completed: false, subtasks: [] }];
    c.scheduleFromBacklog(0, '2026-07-05');
    check('scheduleFromBacklog moves item to a date', (c.goals['2026-07-05'] || []).some(g => g.id === 'bk1'));
    check('scheduleFromBacklog empties from backlog', c.backlog.length === 0);
  }

  section('Core: habits (recurring templates)');
  {
    const a = makeApp();
    a.recurring = [{ id: 'r1', topic: 'Meditate', hours: 0.5, subtasks: [{ text: 'sit' }], startDate: TODAY, days: [0,1,2,3,4,5,6] }];
    a.ensureRecurring(TODAY);
    check('ensureRecurring seeds today', (a.goals[TODAY] || []).some(g => g.recurringId === 'r1'));
    check('ensureRecurring records in seeded', (a.seeded[TODAY] || []).includes('r1'));
    const countAfterFirst = a.goals[TODAY].length;
    a.ensureRecurring(TODAY);
    check('ensureRecurring does not double-seed', a.goals[TODAY].length === countAfterFirst);

    const b = makeApp();
    b.recurring = [{ id: 'r2', topic: 'x', hours: 1, subtasks: [], startDate: TODAY, days: [0,1,2,3,4,5,6] }];
    b.ensureRecurring('2026-07-04');   // not "today"
    check('ensureRecurring never seeds a non-today date', !(b.goals['2026-07-04']));

    // syncHabitToToday: reflect edit onto untouched instance
    const c = makeApp();
    c.goals[TODAY] = [{ id: 'i1', topic: 'old', hours: 1, completed: false, recurringId: 'rX', subtasks: [], createdAt: TODAY }];
    c.syncHabitToToday('rX', 'renamed', 2, [{ text: 'new' }], [0,1,2,3,4,5,6]);
    const inst = c.goals[TODAY][0];
    check('syncHabitToToday updates untouched instance', inst.topic === 'renamed' && inst.hours === 2);

    check('scheduleLabel: every day', c.scheduleLabel([0,1,2,3,4,5,6]) === 'Every day');
    check('scheduleLabel: weekdays', c.scheduleLabel([1,2,3,4,5]) === 'Weekdays');
    check('scheduleLabel: weekends', c.scheduleLabel([0,6]) === 'Weekends');
  }

  section('Core: metrics & helpers');
  {
    const a = makeApp();
    const d = a.getLast7Days();
    check('getLast7Days returns 7 days ending today', d.length === 7 && d[6] === TODAY);
    check('getLast4Weeks returns 4 weeks of 7', a.getLast4Weeks().length === 4 && a.getLast4Weeks()[0].length === 7);

    a.goals[d[6]] = [{ completed: true, hours: 1, loggedHours: null, subtasks: [] }];
    a.goals[d[5]] = [{ completed: true, hours: 2, loggedHours: null, subtasks: [] }];
    const m = a.metrics();
    check('metrics streak counts consecutive complete days', m.streak === 2);
    check('metrics 7-day average', m.avgWeek === 100);
    check('metrics totals hours + goals', m.totalHours === 3 && m.totalGoals === 2);

    const stats = a.dayStats.call(Object.assign(makeApp(), {
      goals: { [TODAY]: [{ completed: true, hours: 2, loggedHours: 1.5, subtasks: [] }, { completed: false, hours: 1, subtasks: [] }] },
    }));
    check('dayStats computes completion %', stats.completed === 1 && stats.total === 2 && stats.pct === 50);

    check('dateStr formats YYYY-MM-DD', a.dateStr(new Date('2026-07-03T00:00:00')) === '2026-07-03');
    check('normalizeUsername lowercases', a.normalizeUsername('TestUser') === 'testuser');
    check('normalizeUsername rejects traversal', a.normalizeUsername('../x') === '');
    check('snapshot shape', eq(Object.keys(a.snapshot()).sort(),
      ['backlog', 'carriedThrough', 'goals', 'install', 'recurring', 'seeded', 'updatedAt', 'username']));
  }
}

// ---- run ----
console.log(`app.js logic tests  (suite: ${SUITE}, user: testuser)`);
featureSuite();
if (SUITE !== 'feature') coreSuite();
console.log(`\nLogic: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

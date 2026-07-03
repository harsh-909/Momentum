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
 *   node tests/app.test.js feature    # only the current feature (goal editing)
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
// CURRENT FEATURE: goal editing (inline edit + cleanup)
// ============================================================
function featureSuite() {
  section('Feature: goal editing (cleanText / stopEditGoal / removeSubtask)');
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
  a.subtaskDrafts = { foo: 'bar' };
  const snap = a.snapshot();
  check('snapshot() excludes editingGoalId', !('editingGoalId' in snap));
  check('snapshot() excludes subtaskDrafts', !('subtaskDrafts' in snap));
}

// ============================================================
// CORE app behavior (full regression)
// ============================================================
function coreSuite() {
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

    a.subtaskDrafts[g.id] = 'three';
    a.commitSubtask(TODAY, 0);
    check('commitSubtask adds from draft (no DOM)', g.subtasks.length === 3 && g.subtasks[2].text === 'three');
    check('commitSubtask clears the draft', !(g.id in a.subtaskDrafts));

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

    // endOfDay: carries incomplete non-habit goals only
    const b = makeApp();
    seedGoal(b, { topic: 'done', completed: true });
    seedGoal(b, { topic: 'undone', completed: false });
    seedGoal(b, { topic: 'habit', completed: false, recurringId: 'r1' });
    b.endOfDay();
    check('endOfDay keeps completed + habits', eq((b.goals[TODAY] || []).map(g => g.topic).sort(), ['done', 'habit']));
    check('endOfDay carries the incomplete goal to backlog', b.backlog.length === 1 && b.backlog[0].topic === 'undone');
    check('endOfDay never backlogs a habit', b.backlog.every(x => x.topic !== 'habit'));

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
      ['backlog', 'goals', 'install', 'recurring', 'seeded', 'updatedAt', 'username']));
  }
}

// ---- run ----
console.log(`app.js logic tests  (suite: ${SUITE}, user: testuser)`);
featureSuite();
if (SUITE !== 'feature') coreSuite();
console.log(`\nLogic: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtNum, fmtClock, ghostFor, lastDone, lastSessionSets, libraryNames, platesFor, relDate, suggestNextDay, uid,
} from '../src/util.js';
import { DEFAULT_ROUTINE } from '../src/defaults.js';

const w = (dayId, startedAt, exercises = []) => ({ dayId, startedAt, exercises });
const e = (name, sets) => ({ name, sets: sets.map(([weight, reps]) => ({ weight, reps })) });

describe('logic: barbell plates', () => {
  test('loads 225 on a 45 lb bar as two 45s per side', () => {
    assert.deepEqual(platesFor(225, 45), [45, 45]);
  });

  test('uses the biggest plates first for odd totals', () => {
    assert.deepEqual(platesFor(185, 45), [45, 25]);
    assert.deepEqual(platesFor(140, 45), [45, 2.5]);
  });

  test('handles fractional plates without floating-point leftovers', () => {
    assert.deepEqual(platesFor(50, 45), [2.5]);
    assert.deepEqual(platesFor(60, 45), [5, 2.5]);
  });

  test('returns no plates when the total is the bar or less, or not a number', () => {
    assert.deepEqual(platesFor(45, 45), []);
    assert.deepEqual(platesFor(30, 45), []);
    assert.deepEqual(platesFor(NaN, 45), []);
  });

  test('respects a different bar weight', () => {
    assert.deepEqual(platesFor(135, 35), [45, 5]);
  });
});

describe('logic: last time ghosts', () => {
  const workouts = [
    w('chest', 1, [e('Bench', [[135, 10], [155, 8], [175, 6]])]),
    w('legs', 2, [e('Squat', [[225, 5]])]),
    w('chest', 3, [e('Bench', [[140, 10], [160, 8]]), e('Flys', [])]),
  ];

  test('uses the most recent session that did the exercise', () => {
    assert.deepEqual(lastSessionSets(workouts, 'Bench').map((s) => s.weight), [140, 160]);
  });

  test('skips sessions where the exercise had no logged sets', () => {
    assert.equal(lastSessionSets(workouts, 'Flys'), null);
  });

  test('shows the same set number from last time', () => {
    assert.deepEqual(ghostFor(workouts, 'Bench', 1), { weight: '160', reps: '8' });
  });

  test('falls back to the last set done when this set number is new', () => {
    assert.deepEqual(ghostFor(workouts, 'Bench', 3), { weight: '160', reps: '8' });
  });

  test('has no ghost for an exercise never done', () => {
    assert.equal(ghostFor(workouts, 'Deadlift', 0), null);
  });
});

describe('logic: next day suggestion', () => {
  const routine = { days: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };

  test('suggests the first day on a fresh install', () => {
    assert.equal(suggestNextDay(routine, []), 'a');
  });

  test('suggests a day never done before days already done', () => {
    assert.equal(suggestNextDay(routine, [w('a', 10), w('c', 20)]), 'b');
  });

  test('suggests the day done longest ago once all are done', () => {
    assert.equal(suggestNextDay(routine, [w('a', 30), w('b', 10), w('c', 20), w('b', 40)]), 'c');
  });

  test('lastDone returns the latest start time for a day, or null', () => {
    assert.equal(lastDone([w('a', 5), w('a', 50), w('b', 99), w('a', 20)], 'a'), 50);
    assert.equal(lastDone([w('b', 1)], 'a'), null);
  });
});

describe('logic: dates and formatting', () => {
  const noonDaysAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime(); };

  test('relative dates read never, today, yesterday and N days ago', () => {
    assert.equal(relDate(null), 'never');
    assert.equal(relDate(Date.now()), 'today');
    assert.equal(relDate(noonDaysAgo(1)), 'yesterday');
    assert.equal(relDate(noonDaysAgo(3)), '3 days ago');
    assert.equal(relDate(noonDaysAgo(6)), '6 days ago');
  });

  test('a time later today counts as today, not yesterday', () => {
    const d = new Date(); d.setHours(0, 0, 1, 0);
    assert.equal(relDate(d.getTime()), 'today');
  });

  test('dates a week or more back show as a calendar date', () => {
    const ts = noonDaysAgo(10);
    assert.equal(relDate(ts), new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  });

  test('rest clock formats as m:ss', () => {
    assert.equal(fmtClock(0), '0:00');
    assert.equal(fmtClock(9), '0:09');
    assert.equal(fmtClock(90), '1:30');
    assert.equal(fmtClock(600), '10:00');
  });

  test('numbers round to two decimals and non-numbers become blank', () => {
    assert.equal(fmtNum(135), '135');
    assert.equal(fmtNum(2.5), '2.5');
    assert.equal(fmtNum(1 / 3), '0.33');
    assert.equal(fmtNum(NaN), '');
    assert.equal(fmtNum('135'), '');
  });

  test('ids are short and unique', () => {
    const ids = new Set(Array.from({ length: 1000 }, uid));
    assert.equal(ids.size, 1000);
    for (const id of ids) assert.match(id, /^[a-z0-9]+$/);
  });
});

describe('logic: exercise library and default routine', () => {
  test('library lists routine and history exercises once, sorted', () => {
    const routine = { days: [{ exercises: [{ name: 'Squat' }, { name: 'Bench' }] }] };
    const workouts = [w('x', 1, [e('Bench', []), e('Arnold press', [])])];
    assert.deepEqual(libraryNames(routine, workouts), ['Arnold press', 'Bench', 'Squat']);
  });

  test('default routine has five days with unique ids and positive set counts', () => {
    const days = DEFAULT_ROUTINE.days;
    assert.deepEqual(days.map((d) => d.id), ['chest', 'shoulders', 'legs', 'arms', 'back']);
    for (const d of days) {
      const ids = d.exercises.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length, d.id);
      for (const x of d.exercises) {
        assert.ok(x.sets > 0, x.name);
        assert.match(x.id, /^[a-z0-9-]+$/, x.name);
      }
    }
  });

  test('default settings use a 45 lb bar and a 90 s rest', () => {
    assert.equal(DEFAULT_ROUTINE.settings.barWeight, 45);
    assert.equal(DEFAULT_ROUTINE.settings.restSeconds, 90);
  });
});

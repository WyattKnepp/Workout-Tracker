import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, readData, put, post, tempDir } from './helpers/server.js';

const workout = {
  id: 'w1', dayId: 'chest', dayName: 'Chest', startedAt: 1760000000000,
  exercises: [{ id: 'e1', name: 'Bench', sets: [{ weight: 135, reps: 10 }, { weight: 155, reps: 8 }] }],
};

describe('server: startup', () => {
  let srv;
  before(async () => { srv = await startServer(); });
  after(() => srv.stop());

  test('starts on the given port and reports its data folder', () => {
    assert.match(srv.output(), /Workout tracker on http:\/\/127\.0\.0\.1:\d+/);
    assert.ok(srv.output().includes(srv.dataDir));
  });

  test('creates push (VAPID) keys in the data folder on first start', () => {
    const vapid = readData(srv.dataDir, 'vapid');
    assert.equal(typeof vapid.publicKey, 'string');
    assert.equal(typeof vapid.privateKey, 'string');
  });

  test('creates a missing data folder', async () => {
    const dir = path.join(tempDir('nested'), 'a', 'b');
    const s = await startServer(dir);
    try {
      assert.ok(fs.existsSync(path.join(dir, 'vapid.json')));
    } finally { await s.stop(); }
  });
});

describe('api: state and documents', () => {
  let srv;
  before(async () => { srv = await startServer(); });
  after(() => srv.stop());

  test('a fresh install returns all four documents as null', async () => {
    const res = await fetch(`${srv.url}/api/state`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { routine: null, active: null, workouts: null, bodyweight: null });
  });

  test('saving workouts with PUT stores them and returns ok', async () => {
    const res = await put(`${srv.url}/api/workouts`, [workout]);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.deepEqual(readData(srv.dataDir, 'workouts'), [workout]);
  });

  test('a saved document can be read back on its own and in /api/state', async () => {
    assert.deepEqual(await (await fetch(`${srv.url}/api/workouts`)).json(), [workout]);
    const state = await (await fetch(`${srv.url}/api/state`)).json();
    assert.deepEqual(state.workouts, [workout]);
  });

  test('every document key (routine, active, workouts, bodyweight) can be saved', async () => {
    const values = {
      routine: { days: [{ id: 'd', name: 'Day', exercises: [] }], notes: {}, settings: { barWeight: 45 } },
      active: { id: 'a1', dayId: 'd', exercises: [] },
      bodyweight: [{ t: 1760000000000, w: 180.5 }],
    };
    for (const [k, v] of Object.entries(values)) {
      assert.equal((await put(`${srv.url}/api/${k}`, v)).status, 200, k);
    }
    const state = await (await fetch(`${srv.url}/api/state`)).json();
    for (const [k, v] of Object.entries(values)) assert.deepEqual(state[k], v, k);
  });

  test('saving null clears a document (finishing a workout clears "active")', async () => {
    await put(`${srv.url}/api/active`, { id: 'a2' });
    assert.equal((await put(`${srv.url}/api/active`, 'null')).status, 200);
    assert.equal((await (await fetch(`${srv.url}/api/state`)).json()).active, null);
  });

  test('rejects a save with invalid JSON and keeps the old data', async () => {
    const res = await put(`${srv.url}/api/workouts`, '{not json');
    assert.ok(res.status >= 400, `status ${res.status}`);
    assert.deepEqual(readData(srv.dataDir, 'workouts'), [workout]);
    assert.equal((await fetch(`${srv.url}/api/state`)).status, 200, 'server still answers');
  });

  test('rejects a body over 5 MB and keeps the old data', async () => {
    const huge = JSON.stringify([{ pad: 'x'.repeat(6 * 1024 * 1024) }]);
    let status;
    try { status = (await put(`${srv.url}/api/workouts`, huge)).status; } catch { status = 'connection closed'; }
    assert.notEqual(status, 200);
    assert.deepEqual(readData(srv.dataDir, 'workouts'), [workout]);
    assert.equal((await fetch(`${srv.url}/api/state`)).status, 200, 'server still answers');
  });

  test('unknown API routes return 404', async () => {
    assert.equal((await fetch(`${srv.url}/api/nope`)).status, 404);
    assert.equal((await fetch(`${srv.url}/api/workouts/123`)).status, 404);
    assert.equal((await fetch(`${srv.url}/api/workouts`, { method: 'DELETE' })).status, 404);
  });

  test('does not expose or let you overwrite the push keys or subscriptions', async () => {
    assert.equal((await fetch(`${srv.url}/api/vapid`)).status, 404);
    assert.equal((await put(`${srv.url}/api/vapid`, { publicKey: 'x', privateKey: 'y' })).status, 404);
    assert.equal((await put(`${srv.url}/api/push`, [])).status, 404);
    assert.notEqual(readData(srv.dataDir, 'vapid').publicKey, 'x');
  });
});

describe('data: persistence', () => {
  test('saved data and the push key survive a server restart', async () => {
    const dir = tempDir();
    const a = await startServer(dir);
    await put(`${a.url}/api/workouts`, [workout]);
    await put(`${a.url}/api/bodyweight`, [{ t: 1, w: 200 }]);
    const key1 = (await (await fetch(`${a.url}/api/push/key`)).json()).key;
    await a.stop();

    const b = await startServer(dir);
    try {
      const state = await (await fetch(`${b.url}/api/state`)).json();
      assert.deepEqual(state.workouts, [workout]);
      assert.deepEqual(state.bodyweight, [{ t: 1, w: 200 }]);
      const key2 = (await (await fetch(`${b.url}/api/push/key`)).json()).key;
      assert.equal(key2, key1, 'push key must stay the same or phone subscriptions break');
    } finally { await b.stop(); }
  });

  test('writes leave no temp files behind', async () => {
    const srv = await startServer();
    try {
      await put(`${srv.url}/api/routine`, { days: [] });
      assert.deepEqual(fs.readdirSync(srv.dataDir).filter((f) => f.endsWith('.tmp')), []);
    } finally { await srv.stop(); }
  });

  test('a corrupt data file reads as empty instead of crashing', async () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'workouts.json'), '{oops');
    const srv = await startServer(dir);
    try {
      const res = await fetch(`${srv.url}/api/state`);
      assert.equal(res.status, 200);
      assert.equal((await res.json()).workouts, null);
    } finally { await srv.stop(); }
  });
});

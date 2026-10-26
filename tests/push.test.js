import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import path from 'node:path';
import { startServer, readData, post, waitFor, tempDir } from './helpers/server.js';

// A fake push service on localhost, so rest-timer pushes never leave the laptop.
// web-push only speaks HTTPS, so it gets a throwaway self-signed cert that only the server under test trusts.
function fakePushService() {
  const dir = tempDir('tls');
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
    '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'pipe' });
  const hits = [];
  let status = 201;
  const srv = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      hits.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(status);
      res.end();
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({
    base: `https://127.0.0.1:${srv.address().port}`,
    hits,
    caFile: cert,
    setStatus: (s) => { status = s; },
    close: () => new Promise((r) => srv.close(r)),
  })));
}

function subscription(endpoint) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    endpoint,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') },
  };
}

describe('api: push subscriptions', () => {
  let srv;
  before(async () => { srv = await startServer(); });
  after(() => srv.stop());

  test('returns the public push key', async () => {
    const res = await fetch(`${srv.url}/api/push/key`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).key, readData(srv.dataDir, 'vapid').publicKey);
  });

  test('stores a subscription', async () => {
    const sub = subscription('https://push.invalid/a');
    const res = await post(`${srv.url}/api/push/subscribe`, sub);
    assert.equal(res.status, 200);
    assert.deepEqual(readData(srv.dataDir, 'push'), [sub]);
  });

  test('subscribing the same endpoint again replaces it instead of duplicating', async () => {
    const sub = subscription('https://push.invalid/a');
    await post(`${srv.url}/api/push/subscribe`, sub);
    assert.deepEqual(readData(srv.dataDir, 'push'), [sub]);
  });

  test('rejects a subscription with no endpoint', async () => {
    const res = await post(`${srv.url}/api/push/subscribe`, { keys: {} });
    assert.equal(res.status, 400);
    assert.equal(readData(srv.dataDir, 'push').length, 1);
  });

  test('unsubscribe removes only that endpoint', async () => {
    const b = subscription('https://push.invalid/b');
    await post(`${srv.url}/api/push/subscribe`, b);
    const res = await post(`${srv.url}/api/push/unsubscribe`, { endpoint: 'https://push.invalid/a' });
    assert.equal(res.status, 200);
    assert.deepEqual(readData(srv.dataDir, 'push'), [b]);
  });
});

describe('api: rest timer', () => {
  let srv;
  let push;
  before(async () => {
    push = await fakePushService();
    srv = await startServer(undefined, { NODE_EXTRA_CA_CERTS: push.caFile });
  });
  after(async () => {
    await srv.stop();
    await push.close();
  });
  beforeEach(() => { push.hits.length = 0; push.setStatus(201); });

  for (const bad of [0, -5, 3600, 'abc', null]) {
    test(`rejects a rest length of ${JSON.stringify(bad)} seconds`, async () => {
      const res = await post(`${srv.url}/api/rest`, { seconds: bad });
      assert.equal(res.status, 400);
    });
  }

  test('rejects a rest start with no body', async () => {
    assert.equal((await fetch(`${srv.url}/api/rest`, { method: 'POST' })).status, 400);
  });

  test('sends an encrypted "Rest over" push to each subscriber when rest ends', async () => {
    await post(`${srv.url}/api/push/subscribe`, subscription(`${push.base}/sub/1`));
    const res = await post(`${srv.url}/api/rest`, { seconds: 0.2 });
    assert.equal(res.status, 200);
    const hit = await waitFor(() => push.hits[0], { timeout: 5000 });
    assert.equal(hit.path, '/sub/1');
    assert.equal(hit.headers['content-encoding'], 'aes128gcm');
    assert.match(hit.headers.authorization, /^vapid /);
    assert.equal(hit.headers.urgency, 'high');
    assert.ok(!hit.body.toString('latin1').includes('Rest over'), 'payload must be encrypted');
  });

  test('cancelling the rest timer stops the push', async () => {
    await post(`${srv.url}/api/rest`, { seconds: 0.3 });
    const res = await fetch(`${srv.url}/api/rest`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    // A negative check needs a short real wait past when the timer would have fired.
    await new Promise((r) => setTimeout(r, 700));
    assert.equal(push.hits.length, 0);
  });

  test('starting a new rest replaces the previous timer (only one push)', async () => {
    await post(`${srv.url}/api/rest`, { seconds: 0.2 });
    await post(`${srv.url}/api/rest`, { seconds: 0.4 });
    await waitFor(() => push.hits.length >= 1, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(push.hits.length, 1);
  });

  test('drops a subscription the push service says is gone (410)', async () => {
    push.setStatus(410);
    await post(`${srv.url}/api/rest`, { seconds: 0.1 });
    await waitFor(() => readData(srv.dataDir, 'push')?.length === 0, { timeout: 5000 });
  });

  test('keeps a subscription after a temporary push failure (500)', async () => {
    await post(`${srv.url}/api/push/subscribe`, subscription(`${push.base}/sub/2`));
    push.setStatus(500);
    await post(`${srv.url}/api/rest`, { seconds: 0.1 });
    await waitFor(() => push.hits.length >= 1, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(readData(srv.dataDir, 'push').length, 1);
  });
});

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startServer, tempDir } from './helpers/server.js';

const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

describe('build: front end', () => {
  test('vite builds the app with its PWA files', () => {
    const out = tempDir('build');
    execFileSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, stdio: 'pipe' });
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.match(html, /<script type="module"[^>]+src="\/assets\/[^"]+\.js"/);
    for (const f of ['sw.js', 'manifest.webmanifest', 'icon-192.png']) assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.ok(fs.readdirSync(path.join(out, 'assets')).some((f) => f.endsWith('.js')));
  });
});

// The server always serves ROOT/dist; build it once if it is missing.
describe('ui: static files', () => {
  let srv;
  const DIST = path.join(ROOT, 'dist');
  before(async () => {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      execFileSync(process.execPath, [vite, 'build', '--logLevel', 'error'], { cwd: ROOT, stdio: 'pipe' });
    }
    srv = await startServer();
  });
  after(() => srv.stop());

  test('serves the app page at /', async () => {
    const res = await fetch(`${srv.url}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.equal(await res.text(), fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'));
  });

  test('unknown paths fall back to the app page', async () => {
    const res = await fetch(`${srv.url}/history/some/page`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
  });

  test('hashed assets are served with long-term caching', async () => {
    const js = fs.readdirSync(path.join(DIST, 'assets')).find((f) => f.endsWith('.js'));
    const res = await fetch(`${srv.url}/assets/${js}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/javascript');
    assert.match(res.headers.get('cache-control'), /immutable/);
  });

  test('serves the manifest and service worker with the right types', async () => {
    const m = await fetch(`${srv.url}/manifest.webmanifest`);
    assert.equal(m.headers.get('content-type'), 'application/manifest+json');
    const sw = await fetch(`${srv.url}/sw.js`);
    assert.equal(sw.headers.get('content-type'), 'text/javascript');
    assert.equal(sw.headers.get('cache-control'), 'no-cache');
  });

  test('refuses paths that escape the build folder', async () => {
    const res = await fetch(`${srv.url}/..%2fpackage.json`);
    assert.equal(res.status, 403);
    const res2 = await fetch(`${srv.url}/..%2fdata%2fvapid.json`);
    assert.equal(res2.status, 403);
  });
});

// Tiny single-user server: static files + JSON-file storage + rest-timer web push.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const KEYS = ['routine', 'active', 'workouts', 'bodyweight'];
const MAX_BODY = 5 * 1024 * 1024;

fs.mkdirSync(DATA, { recursive: true });

const file = (name) => path.join(DATA, `${name}.json`);
function readJson(name, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return fallback; }
}
function writeJson(name, value) {
  const tmp = file(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file(name));
}

// ---- web push (rest timer while the phone is locked) ----
let vapid = readJson('vapid');
if (!vapid) {
  vapid = webpush.generateVAPIDKeys();
  writeJson('vapid', vapid);
}
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:workout@example.com', vapid.publicKey, vapid.privateKey);
let restTimer = null;

async function sendRestPush() {
  const subs = readJson('push', []);
  const alive = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: 'Rest over', body: 'Time for your next set 💪' }), { TTL: 120, urgency: 'high' });
      alive.push(sub);
    } catch (err) {
      if (err.statusCode !== 404 && err.statusCode !== 410) alive.push(sub);
    }
  }));
  if (alive.length !== subs.length) writeJson('push', alive);
}

// ---- http helpers ----
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null); } catch (e) { reject(e); } });
  req.on('error', reject);
});

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // after "api"
  const [a, b] = parts;

  if (req.method === 'GET' && a === 'state') {
    return send(res, 200, Object.fromEntries(KEYS.map((k) => [k, readJson(k)])));
  }
  if (a && KEYS.includes(a) && !b) {
    if (req.method === 'GET') return send(res, 200, readJson(a));
    if (req.method === 'PUT') { writeJson(a, await readBody(req)); return send(res, 200, { ok: true }); }
  }
  if (a === 'push' && b === 'key' && req.method === 'GET') return send(res, 200, { key: vapid.publicKey });
  if (a === 'push' && b === 'subscribe' && req.method === 'POST') {
    const sub = await readBody(req);
    if (!sub?.endpoint) return send(res, 400, { error: 'bad subscription' });
    writeJson('push', [...readJson('push', []).filter((s) => s.endpoint !== sub.endpoint), sub]);
    return send(res, 200, { ok: true });
  }
  if (a === 'push' && b === 'unsubscribe' && req.method === 'POST') {
    const { endpoint } = (await readBody(req)) || {};
    writeJson('push', readJson('push', []).filter((s) => s.endpoint !== endpoint));
    return send(res, 200, { ok: true });
  }
  if (a === 'rest') {
    clearTimeout(restTimer);
    restTimer = null;
    if (req.method === 'POST') {
      const { seconds } = (await readBody(req)) || {};
      if (!(seconds > 0 && seconds < 3600)) return send(res, 400, { error: 'bad seconds' });
      restTimer = setTimeout(() => { restTimer = null; sendRestPush().catch(() => {}); }, seconds * 1000);
    }
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  let full = path.join(DIST, rel);
  if (!full.startsWith(DIST)) return send(res, 403, 'forbidden', 'text/plain');
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) full = path.join(DIST, 'index.html');
  if (!fs.existsSync(full)) return send(res, 404, 'Run `npm run build` first.', 'text/plain');
  const ext = path.extname(full);
  const immutable = full.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(full).pipe(res);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'server error' });
  }
}).listen(PORT, HOST, () => console.log(`Workout tracker on http://${HOST}:${PORT}  (data: ${DATA})`));

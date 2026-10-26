// Starts the real server (server/index.js) as a child process on a free port with a temp DATA_DIR.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const tempDir = (tag = 'data') => fs.mkdtempSync(path.join(os.tmpdir(), `workout-tracker-${tag}-`));

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export async function waitFor(fn, { timeout = 10000, interval = 25 } = {}) {
  const end = Date.now() + timeout;
  let lastErr;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (err) { lastErr = err; }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`timed out waiting${lastErr ? `: ${lastErr.message}` : ''}`);
}

export async function startServer(dataDir = tempDir(), extraEnv = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitFor(async () => {
      if (child.exitCode !== null) throw new Error(`server exited (${child.exitCode}): ${output}`);
      return (await fetch(`${url}/api/state`)).ok;
    });
  } catch (err) {
    child.kill();
    throw err;
  }
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  });
  return { url, dataDir, child, stop, output: () => output };
}

export const readData = (dataDir, name) => {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8')); } catch { return undefined; }
};

export const put = (url, body) => fetch(url, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
export const post = (url, body) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});

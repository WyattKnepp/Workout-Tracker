async function call(method, url, body, keepalive = false) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    keepalive,
  });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}`);
  return res.json();
}

export const api = {
  load: () => call('GET', '/api/state'),
  save: (key, value) => {
    const small = JSON.stringify(value ?? null).length < 60000;
    return call('PUT', `/api/${key}`, value ?? null, small);
  },
  pushKey: () => call('GET', '/api/push/key'),
  subscribe: (sub) => call('POST', '/api/push/subscribe', sub),
  unsubscribe: (endpoint) => call('POST', '/api/push/unsubscribe', { endpoint }),
  restStart: (seconds) => call('POST', '/api/rest', { seconds }).catch(() => {}),
  restCancel: () => call('DELETE', '/api/rest').catch(() => {}),
};

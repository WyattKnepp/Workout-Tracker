self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { /* no payload */ }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Rest over', {
      body: d.body || 'Time for your next set',
      tag: 'rest',
      renotify: true,
      vibrate: [300, 100, 300, 100, 300],
      icon: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) =>
      list.length ? list[0].focus() : self.clients.openWindow('/')
    )
  );
});

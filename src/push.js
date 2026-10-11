import { api } from './api';

const b64ToBytes = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

export async function enablePush() {
  if (!pushSupported()) {
    throw new Error('Not supported here. On iPhone, first Share → Add to Home Screen, then open from the icon.');
  }
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notification permission was denied.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api.pushKey();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api.subscribe(sub.toJSON());
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await api.unsubscribe(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
}

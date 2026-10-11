import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { DEFAULT_ROUTINE } from './defaults';

const KEYS = ['routine', 'active', 'workouts', 'bodyweight'];
const mirror = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(`wt:${k}`)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(`wt:${k}`, JSON.stringify(v)); } catch { /* full/blocked */ } },
};

// All state lives in four JSON documents. Every change updates React state, a local
// mirror (offline safety net) and, debounced, the server's JSON files.
export function useStore() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(true);
  const ref = useRef(null);
  const timers = useRef({});
  const dirty = useRef({});

  const flush = useCallback((key) => {
    if (!dirty.current[key]) return;
    delete dirty.current[key];
    api.save(key, ref.current[key]).then(() => setOnline(true)).catch(() => {
      setOnline(false);
      dirty.current[key] = true;
      timers.current[key] = setTimeout(() => flush(key), 5000);
    });
  }, []);

  const set = useCallback((key, value) => {
    ref.current = { ...ref.current, [key]: value };
    setState(ref.current);
    mirror.set(key, value);
    dirty.current[key] = true;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => flush(key), 350);
  }, [flush]);

  useEffect(() => {
    (async () => {
      let remote = null;
      try { remote = await api.load(); } catch { setOnline(false); }
      const src = remote || Object.fromEntries(KEYS.map((k) => [k, mirror.get(k)]));
      ref.current = {
        routine: src.routine ?? DEFAULT_ROUTINE,
        active: src.active ?? null,
        workouts: src.workouts ?? [],
        bodyweight: src.bodyweight ?? [],
      };
      setState(ref.current);
      if (remote && !remote.routine) set('routine', DEFAULT_ROUTINE);
    })();
    const flushAll = () => Object.keys(dirty.current).forEach(flush);
    const onVis = () => document.visibilityState === 'hidden' && flushAll();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flushAll);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flushAll);
    };
  }, [flush, set]);

  return { state, set, online };
}

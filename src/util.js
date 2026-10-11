import { useEffect, useState } from 'react';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const fmtNum = (n) => (Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '');

export function lastSessionSets(workouts, name) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const e = workouts[i].exercises.find((x) => x.name === name);
    if (e && e.sets.length) return e.sets;
  }
  return null;
}

// What you did for this set number last time (falls back to the last set you did).
export function ghostFor(workouts, name, i) {
  const sets = lastSessionSets(workouts, name);
  if (!sets) return null;
  const s = sets[i] ?? sets[sets.length - 1];
  return { weight: fmtNum(s.weight), reps: fmtNum(s.reps) };
}

export const PLATES = [45, 35, 25, 10, 5, 2.5];

export function platesFor(total, bar) {
  let side = (total - bar) / 2;
  const out = [];
  if (!(side > 0)) return out;
  for (const p of PLATES) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return out;
}

export function suggestNextDay(routine, workouts) {
  let best = null;
  let bestTime = Infinity;
  for (const d of routine.days) {
    let last = -1;
    for (const w of workouts) if (w.dayId === d.id) last = Math.max(last, w.startedAt);
    if (last < bestTime) { bestTime = last; best = d.id; }
  }
  return best;
}

export function lastDone(workouts, dayId) {
  let last = null;
  for (const w of workouts) if (w.dayId === dayId && (!last || w.startedAt > last)) last = w.startedAt;
  return last;
}

export function relDate(ts) {
  if (!ts) return 'never';
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export const fmtClock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

export function libraryNames(routine, workouts) {
  const set = new Set();
  routine.days.forEach((d) => d.exercises.forEach((e) => set.add(e.name)));
  workouts.forEach((w) => w.exercises.forEach((e) => set.add(e.name)));
  return [...set].sort((a, b) => a.localeCompare(b));
}

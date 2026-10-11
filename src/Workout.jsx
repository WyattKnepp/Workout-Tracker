import { useEffect, useMemo, useState } from 'react';
import Pad from './Pad';
import Sheet from './Sheet';
import Rest from './Rest';
import { api } from './api';
import { unlockAudio } from './alerts';
import { fmtNum, ghostFor, lastDone, libraryNames, relDate, suggestNextDay, uid, useNow } from './util';

const emptySet = (weight = '') => ({ weight, reps: '', done: false });

function nextUndone(a, from) {
  const flat = [];
  a.exercises.forEach((ex, e) => ex.sets.forEach((st, s) => { if (!st.done) flat.push({ e, s }); }));
  if (!flat.length) return null;
  if (from) {
    const after = flat.find((p) => p.e > from.e || (p.e === from.e && p.s > from.s));
    if (after) return after;
  }
  return flat[0];
}

// ---------------------------------------------------------------- Home ----
export function Home({ s, onStart, onResume }) {
  const { routine, workouts, active } = s;
  const next = suggestNextDay(routine, workouts);
  return (
    <div className="screen">
      <h1>Workout</h1>
      {active && (
        <button className="resume" onClick={onResume}>
          <b>{active.dayName} in progress</b>
          <span>Started {relDate(active.startedAt)} · tap to resume</span>
        </button>
      )}
      <div className="day-list">
        {routine.days.map((d) => (
          <button key={d.id} className="day" onClick={() => onStart(d)}>
            <div>
              <b>{d.name}</b>
              <span>{d.exercises.length} exercises · last {relDate(lastDone(workouts, d.id))}</span>
            </div>
            {d.id === next && <em>Next up</em>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function startWorkout(day) {
  return {
    id: uid(),
    dayId: day.id,
    dayName: day.name,
    startedAt: Date.now(),
    restEnd: null,
    cursor: { e: 0, s: 0 },
    exercises: day.exercises.map((x) => ({
      id: uid(),
      name: x.name,
      sets: Array.from({ length: x.sets }, () => emptySet()),
    })),
  };
}

// ------------------------------------------------------------- Session ----
export function Session({ s, set, onLeave }) {
  const { routine, workouts, active } = s;
  const settings = routine.settings;
  const cur = active.cursor;
  const curSet = cur ? active.exercises[cur.e]?.sets[cur.s] : null;
  const cursorKey = cur ? `${cur.e}:${cur.s}` : 'none';

  const [focus, setFocus] = useState('weight');
  const [sheet, setSheet] = useState(null); // {type, e?}
  const now = useNow(15000);

  useEffect(() => {
    if (!curSet) return;
    setFocus(curSet.weight === '' || curSet.done ? 'weight' : 'reps');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorKey]);

  useEffect(() => {
    if (!cur) return;
    document.getElementById(`ex-${active.exercises[cur.e]?.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.e]);

  const library = useMemo(() => libraryNames(routine, workouts), [routine, workouts]);

  const save = (a) => set('active', a);
  const edit = (fn) => { const a = structuredClone(active); fn(a); save(a); };

  const isBar = (name) => !!settings.barExercises?.[name];
  const toggleBar = (name) => {
    const turningOn = !isBar(name);
    const r = structuredClone(routine);
    r.settings.barExercises = { ...r.settings.barExercises, [name]: turningOn };
    set('routine', r);
    if (turningOn && curSet && curSet.weight === '') {
      edit((a) => { a.exercises[cur.e].sets[cur.s].weight = fmtNum(settings.barWeight); });
    }
  };

  const change = (key, value) => edit((a) => { a.exercises[cur.e].sets[cur.s][key] = value; });

  const logSet = () => {
    unlockAudio();
    edit((a) => {
      const { e, s: si } = cur;
      const st = a.exercises[e].sets[si];
      const wasDone = st.done;
      st.done = true;
      const nxt = a.exercises[e].sets[si + 1];
      if (nxt && !nxt.done && nxt.weight === '') nxt.weight = st.weight;
      a.cursor = nextUndone(a, cur);
      if (!wasDone && settings.restSeconds > 0) {
        a.restEnd = Date.now() + settings.restSeconds * 1000;
        api.restStart(settings.restSeconds);
      }
    });
  };

  const addSet = (e) => edit((a) => {
    const sets = a.exercises[e].sets;
    const prev = sets[sets.length - 1];
    sets.push(emptySet(prev?.done ? prev.weight : ''));
    a.cursor = { e, s: sets.length - 1 };
  });

  const removeSet = (e, si) => edit((a) => {
    a.exercises[e].sets.splice(si, 1);
    a.cursor = nextUndone(a, { e, s: si - 1 });
  });

  const removeExercise = (e) => edit((a) => {
    a.exercises.splice(e, 1);
    a.cursor = nextUndone(a, null);
  });

  const swapExercise = (e, name, always) => {
    const old = active.exercises[e].name;
    if (always) {
      const r = structuredClone(routine);
      const ex = r.days.find((d) => d.id === active.dayId)?.exercises.find((x) => x.name === old);
      if (ex) ex.name = name;
      set('routine', r);
    }
    edit((a) => { a.exercises[e].name = name; });
  };

  const addExercise = (name, always) => {
    if (always) {
      const r = structuredClone(routine);
      r.days.find((d) => d.id === active.dayId)?.exercises.push({ id: uid(), name, sets: 3 });
      set('routine', r);
    }
    edit((a) => {
      a.exercises.push({ id: uid(), name, sets: Array.from({ length: 3 }, () => emptySet()) });
      a.cursor = { e: a.exercises.length - 1, s: 0 };
    });
  };

  const loggedSets = active.exercises.reduce((n, ex) => n + ex.sets.filter((x) => x.done).length, 0);

  const finish = () => {
    const exercises = active.exercises
      .map((ex) => ({
        name: ex.name,
        sets: ex.sets.filter((x) => x.done).map((x) => ({ weight: Number(x.weight), reps: Number(x.reps) })),
      }))
      .filter((ex) => ex.sets.length);
    api.restCancel();
    set('workouts', [...workouts, { id: active.id, dayId: active.dayId, dayName: active.dayName, startedAt: active.startedAt, endedAt: Date.now(), exercises }]);
    set('active', null);
    onLeave();
  };

  const discard = () => {
    api.restCancel();
    set('active', null);
    onLeave();
  };

  // ---- dock ----
  let dock = null;
  if (cur && curSet) {
    const ex = active.exercises[cur.e];
    const ghost = ghostFor(workouts, ex.name, cur.s);
    const fields = [
      { key: 'weight', label: 'Weight (lb)', value: curSet.weight, ghost: ghost?.weight, decimal: true },
      { key: 'reps', label: 'Reps', value: curSet.reps, ghost: ghost?.reps, decimal: false },
    ];
    let primary;
    if (focus === 'weight') {
      primary = curSet.weight === ''
        ? { label: 'Enter weight', disabled: true }
        : { label: 'Next: reps ›', onClick: () => setFocus('reps') };
    } else if (curSet.reps === '') {
      primary = { label: 'Enter reps', disabled: true };
    } else if (curSet.weight === '') {
      primary = { label: 'Enter weight', onClick: () => setFocus('weight') };
    } else {
      primary = { label: curSet.done ? 'Update set ✓' : 'Log set ✓', onClick: logSet };
    }
    dock = (
      <div className="dock">
        <Pad
          fields={fields}
          focus={focus}
          setFocus={setFocus}
          onChange={change}
          resetKey={cursorKey}
          bar={{ on: isBar(ex.name), weight: settings.barWeight, toggle: () => toggleBar(ex.name) }}
          primary={primary}
        />
      </div>
    );
  } else {
    dock = (
      <div className="dock">
        <button className="primary" onClick={() => setSheet({ type: 'finish' })}>All sets done — Finish workout</button>
      </div>
    );
  }

  const elapsed = Math.floor((now - active.startedAt) / 1000);

  return (
    <div className="session">
      <header className="bar">
        <button className="icon-btn" onClick={onLeave} aria-label="Back to menu">‹</button>
        <div className="bar-title">
          <b>{active.dayName}</b>
          <span>{Math.floor(elapsed / 60)} min</span>
        </div>
        <button className="icon-btn" onClick={() => setSheet({ type: 'menu' })} aria-label="Workout menu">⋯</button>
        <button className="chip" onClick={() => setSheet({ type: 'finish' })}>Finish</button>
      </header>

      <Rest active={active} save={save} />

      <div className="exercises">
        {active.exercises.map((ex, e) => {
          const done = ex.sets.filter((x) => x.done).length;
          return (
            <section key={ex.id} id={`ex-${ex.id}`} className={`card${cur?.e === e ? ' current' : ''}`}>
              <div className="card-head">
                <div>
                  <b>{ex.name}</b>
                  {routine.notes?.[ex.name] && <small>{routine.notes[ex.name]}</small>}
                </div>
                <span className="count">{done}/{ex.sets.length}</span>
                <button className="icon-btn" onClick={() => setSheet({ type: 'ex', e })} aria-label={`${ex.name} options`}>⋯</button>
              </div>
              {ex.sets.map((st, si) => {
                const isCur = cur?.e === e && cur?.s === si;
                const g = ghostFor(workouts, ex.name, si);
                return (
                  <div key={si} className={`set${isCur ? ' cur' : ''}${st.done ? ' done' : ''}`} onClick={() => !isCur && save({ ...active, cursor: { e, s: si } })}>
                    <span className="n">{si + 1}</span>
                    <span className="v">
                      <span className={st.weight === '' ? 'ph' : ''}>{st.weight !== '' ? st.weight : (g?.weight ?? '—')}</span>
                      <i> × </i>
                      <span className={st.reps === '' ? 'ph' : ''}>{st.reps !== '' ? st.reps : (g?.reps ?? '—')}</span>
                    </span>
                    {st.done && !isCur && <span className="tick">✓</span>}
                    {isCur && ex.sets.length > 1 && (
                      <button className="icon-btn small" onClick={(ev) => { ev.stopPropagation(); removeSet(e, si); }} aria-label="Remove set">🗑</button>
                    )}
                  </div>
                );
              })}
              <button className="add-set" onClick={() => addSet(e)}>+ Add set</button>
            </section>
          );
        })}
        <button className="add-ex" onClick={() => setSheet({ type: 'add' })}>+ Add exercise</button>
        <div className="dock-spacer" />
      </div>

      {dock}

      {sheet?.type === 'ex' && (
        <Sheet title={active.exercises[sheet.e].name} onClose={() => setSheet(null)}>
          <button className="list-btn" onClick={() => setSheet({ type: 'swap', e: sheet.e })}>Swap for another exercise</button>
          <button className="list-btn" onClick={() => { addSet(sheet.e); setSheet(null); }}>Add a set</button>
          <button className="list-btn danger" onClick={() => { removeExercise(sheet.e); setSheet(null); }}>Remove from today</button>
        </Sheet>
      )}
      {sheet?.type === 'swap' && (
        <Picker
          title={`Swap ${active.exercises[sheet.e].name}`}
          library={library}
          scopes={['Just today', 'Update routine']}
          onPick={(name, always) => { swapExercise(sheet.e, name, always); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'add' && (
        <Picker
          title="Add exercise"
          library={library}
          scopes={['Just today', 'Add to routine']}
          onPick={(name, always) => { addExercise(name, always); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'menu' && (
        <Sheet title="Workout" onClose={() => setSheet(null)}>
          <button className="list-btn danger" onClick={() => { if (window.confirm('Discard this workout and everything logged?')) discard(); }}>
            Discard workout
          </button>
        </Sheet>
      )}
      {sheet?.type === 'finish' && (
        <Sheet title="Finish workout?" onClose={() => setSheet(null)}>
          <p className="muted-p">
            {loggedSets ? `${loggedSets} sets logged. Unlogged sets are dropped.` : 'No sets logged yet.'}
          </p>
          {loggedSets > 0 && <button className="primary" onClick={finish}>Save workout</button>}
          <button className="list-btn" onClick={() => setSheet(null)}>Keep going</button>
        </Sheet>
      )}
    </div>
  );
}

// ---------------------------------------------------------- Picker ----
function Picker({ title, library, scopes, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [always, setAlways] = useState(false);
  const matches = library.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = library.some((n) => n.toLowerCase() === q.trim().toLowerCase());
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="seg">
        {scopes.map((label, i) => (
          <button key={label} className={always === !!i ? 'on' : ''} onClick={() => setAlways(!!i)}>{label}</button>
        ))}
      </div>
      <input className="search" placeholder="Search or type a new exercise" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && !exact && (
        <button className="list-btn accent" onClick={() => onPick(q.trim(), always)}>Use “{q.trim()}”</button>
      )}
      {matches.map((n) => (
        <button key={n} className="list-btn" onClick={() => onPick(n, always)}>{n}</button>
      ))}
    </Sheet>
  );
}

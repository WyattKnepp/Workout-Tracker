import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushEnabled, pushSupported } from './push';
import { uid } from './util';

function Stepper({ value, onChange, min = 0, step = 1, suffix = '' }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span>{value}{suffix}</span>
      <button onClick={() => onChange(value + step)}>+</button>
    </div>
  );
}

export default function Settings({ s, set, online }) {
  const { routine } = s;
  const st = routine.settings;
  const [dayId, setDayId] = useState(routine.days[0].id);
  const [push, setPush] = useState(false);
  const [pushMsg, setPushMsg] = useState('');
  const day = routine.days.find((d) => d.id === dayId) || routine.days[0];

  useEffect(() => { pushEnabled().then(setPush).catch(() => {}); }, []);

  const mutate = (fn) => { const r = structuredClone(routine); fn(r); set('routine', r); };
  const mutDay = (fn) => mutate((r) => fn(r.days.find((d) => d.id === day.id)));
  const move = (i, d) => mutDay((x) => { const [it] = x.exercises.splice(i, 1); x.exercises.splice(i + d, 0, it); });

  const togglePush = async () => {
    setPushMsg('');
    try {
      if (push) { await disablePush(); setPush(false); } else { await enablePush(); setPush(true); }
    } catch (e) { setPushMsg(e.message); }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `workouts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="screen">
      <h1>Settings</h1>

      <section className="panel">
        <div className="row"><span>Empty bar weight</span><Stepper value={st.barWeight} step={5} min={5} suffix=" lb" onChange={(v) => mutate((r) => { r.settings.barWeight = v; })} /></div>
        <div className="row"><span>Rest timer</span><Stepper value={st.restSeconds} step={15} suffix=" s" onChange={(v) => mutate((r) => { r.settings.restSeconds = v; })} /></div>
        <div className="row">
          <span>Alert when phone is locked<small>Push notification from your server</small></span>
          <button className={`switch${push ? ' on' : ''}`} onClick={togglePush} aria-pressed={push}><i /></button>
        </div>
        {!pushSupported() && <p className="muted-p">Notifications aren’t available in this browser. On iPhone, add the app to your Home Screen first.</p>}
        {pushMsg && <p className="err">{pushMsg}</p>}
      </section>

      <h2>Default routine</h2>
      <div className="seg wrap">
        {routine.days.map((d) => (
          <button key={d.id} className={d.id === day.id ? 'on' : ''} onClick={() => setDayId(d.id)}>{d.name}</button>
        ))}
      </div>
      <section className="panel">
        {day.exercises.map((ex, i) => (
          <div key={ex.id} className="row ex-edit">
            <input
              value={ex.name}
              onChange={(e) => mutate((r) => {
                const old = ex.name, name = e.target.value;
                const bars = r.settings.barExercises || (r.settings.barExercises = {});
                if (old in bars) { bars[name] = bars[old]; delete bars[old]; }
                r.days.find((d) => d.id === day.id).exercises[i].name = name;
              })}
              aria-label="Exercise name"
            />
            <Stepper value={ex.sets} min={1} suffix="×" onChange={(v) => mutDay((x) => { x.exercises[i].sets = v; })} />
            <div className="mv">
              <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">▲</button>
              <button disabled={i === day.exercises.length - 1} onClick={() => move(i, 1)} aria-label="Move down">▼</button>
            </div>
            <button className="icon-btn small" onClick={() => mutDay((x) => x.exercises.splice(i, 1))} aria-label="Delete exercise">🗑</button>
            <div className="bar-default">
              <span>Barbell by default<small>Weight entry opens in bar mode</small></span>
              <button
                className={`switch${st.barExercises?.[ex.name] ? ' on' : ''}`}
                onClick={() => mutate((r) => { r.settings.barExercises = { ...r.settings.barExercises, [ex.name]: !st.barExercises?.[ex.name] }; })}
                aria-pressed={!!st.barExercises?.[ex.name]}
              ><i /></button>
            </div>
          </div>
        ))}
        <button className="add-ex" onClick={() => mutDay((x) => x.exercises.push({ id: uid(), name: 'New exercise', sets: 3 }))}>+ Add exercise</button>
      </section>

      <h2>Data</h2>
      <section className="panel">
        <div className="row"><span>Server sync</span><b className={online ? 'ok' : 'err'}>{online ? 'Saved' : 'Offline — will retry'}</b></div>
        <button className="list-btn" onClick={exportData}>Download backup (JSON)</button>
      </section>
    </div>
  );
}

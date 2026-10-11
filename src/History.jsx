import { useState } from 'react';
import Pad from './Pad';
import Sheet from './Sheet';
import { fmtNum } from './util';

const when = (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export default function History({ s, set }) {
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null); // {wid, e, i, weight, reps}
  const [focus, setFocus] = useState('weight');
  const list = [...s.workouts].reverse();

  const update = (wid, fn) => set('workouts', s.workouts.map((w) => {
    if (w.id !== wid) return w;
    const c = structuredClone(w);
    fn(c);
    c.exercises = c.exercises.filter((x) => x.sets.length);
    return c;
  }));

  const saveEdit = () => {
    const w = Number(editing.weight), r = Number(editing.reps);
    update(editing.wid, (c) => { c.exercises[editing.e].sets[editing.i] = { weight: w, reps: r }; });
    setEditing(null);
  };

  return (
    <div className="screen">
      <h1>History</h1>
      {!list.length && <p className="muted-p">Finished workouts show up here.</p>}
      {list.map((w) => {
        const sets = w.exercises.reduce((n, x) => n + x.sets.length, 0);
        const vol = w.exercises.reduce((n, x) => n + x.sets.reduce((m, st) => m + st.weight * st.reps, 0), 0);
        const mins = Math.round((w.endedAt - w.startedAt) / 60000);
        const isOpen = open === w.id;
        return (
          <div key={w.id} className="hist">
            <button className="hist-head" onClick={() => setOpen(isOpen ? null : w.id)}>
              <div>
                <b>{w.dayName}</b>
                <span>{when(w.startedAt)} · {mins} min</span>
              </div>
              <span className="muted-p">{sets} sets · {Math.round(vol).toLocaleString()} lb</span>
            </button>
            {isOpen && (
              <div className="hist-body">
                {w.exercises.map((x, e) => (
                  <div key={e} className="hist-ex">
                    <b>{x.name}</b>
                    <div className="hist-sets">
                      {x.sets.map((st, i) => (
                        <button key={i} onClick={() => { setEditing({ wid: w.id, e, i, weight: fmtNum(st.weight), reps: fmtNum(st.reps) }); setFocus('weight'); }}>
                          {fmtNum(st.weight)} × {fmtNum(st.reps)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="list-btn danger" onClick={() => window.confirm('Delete this workout?') && set('workouts', s.workouts.filter((x) => x.id !== w.id))}>
                  Delete workout
                </button>
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <Sheet title={`${s.workouts.find((w) => w.id === editing.wid)?.exercises[editing.e]?.name} · set ${editing.i + 1}`} onClose={() => setEditing(null)}>
          <Pad
            fields={[
              { key: 'weight', label: 'Weight (lb)', value: editing.weight, decimal: true },
              { key: 'reps', label: 'Reps', value: editing.reps, decimal: false },
            ]}
            focus={focus}
            setFocus={setFocus}
            onChange={(k, v) => setEditing({ ...editing, [k]: v })}
            resetKey={`${editing.wid}${editing.e}${editing.i}`}
            bar={null}
            primary={{ label: 'Save', onClick: saveEdit, disabled: editing.weight === '' || editing.reps === '' }}
          />
          <button
            className="list-btn danger"
            onClick={() => { update(editing.wid, (c) => c.exercises[editing.e].sets.splice(editing.i, 1)); setEditing(null); }}
          >
            Delete this set
          </button>
        </Sheet>
      )}
    </div>
  );
}

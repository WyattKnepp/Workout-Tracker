import { useState } from 'react';
import Pad from './Pad';
import { fmtNum } from './util';

const dayKey = (t) => new Date(t).toLocaleDateString('en-CA'); // YYYY-MM-DD, local

function Chart({ data }) {
  if (data.length < 2) return null;
  const W = 320, H = 120, P = 8;
  const ys = data.map((d) => d.weight);
  const lo = Math.min(...ys) - 1, hi = Math.max(...ys) + 1;
  const x = (i) => P + (i / (data.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const pts = data.map((d, i) => `${x(i)},${y(d.weight)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Body weight over time">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.weight)} r="3" fill="var(--accent)" />)}
      <text x={P} y="12" fill="var(--muted)" fontSize="10">{fmtNum(hi - 1)}</text>
      <text x={P} y={H - 2} fill="var(--muted)" fontSize="10">{fmtNum(lo + 1)}</text>
    </svg>
  );
}

export default function Body({ s, set }) {
  const [val, setVal] = useState('');
  const entries = [...s.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const last = entries[entries.length - 1];

  const log = () => {
    const today = dayKey(Date.now());
    const rest = s.bodyweight.filter((e) => e.date !== today);
    set('bodyweight', [...rest, { date: today, weight: Number(val) }]);
    setVal('');
  };

  return (
    <div className="screen">
      <h1>Body weight</h1>
      {last && <p className="big-stat">{fmtNum(last.weight)} <small>lb · {last.date}</small></p>}
      <Chart data={entries.slice(-60)} />
      <Pad
        fields={[{ key: 'weight', label: "Today's weight (lb)", value: val, ghost: last ? fmtNum(last.weight) : '', decimal: true }]}
        focus="weight"
        setFocus={() => {}}
        onChange={(_, v) => setVal(v)}
        resetKey="body"
        bar={null}
        primary={{ label: 'Save', onClick: log, disabled: val === '' }}
      />
      <div className="hist-list">
        {[...entries].reverse().slice(0, 30).map((e) => (
          <div key={e.date} className="row">
            <span>{e.date}</span>
            <b>{fmtNum(e.weight)} lb</b>
            <button className="icon-btn small" onClick={() => set('bodyweight', s.bodyweight.filter((x) => x.date !== e.date))} aria-label="Delete entry">🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}

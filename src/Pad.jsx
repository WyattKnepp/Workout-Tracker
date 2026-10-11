import { useEffect, useRef } from 'react';
import Barbell from './Barbell';
import { PLATES, fmtNum, platesFor } from './util';

// Numpad entry for one or more numeric fields. Fully controlled by the parent.
// fields: [{ key, label, value, ghost, decimal }]
// bar:    { on, weight, toggle } | null   (applies to the "weight" field)
// primary:{ label, onClick, disabled }
export default function Pad({ fields, focus, setFocus, onChange, bar, primary, resetKey }) {
  const fresh = useRef(true);
  useEffect(() => { fresh.current = true; }, [resetKey, focus]);

  const field = fields.find((f) => f.key === focus) || fields[0];

  const press = (k) => {
    let v = field.value;
    if (k === 'back') {
      v = v.slice(0, -1);
      fresh.current = false;
    } else {
      if (fresh.current) v = '';
      fresh.current = false;
      if (k === '.') {
        if (!field.decimal || v.includes('.')) return;
        v = (v || '0') + '.';
      } else {
        if (v.length >= 6) return;
        v = v === '0' ? k : v + k;
      }
    }
    onChange(field.key, v);
  };

  const addPlate = (p) => {
    const cur = field.value === '' ? bar.weight : Number(field.value);
    onChange('weight', fmtNum((Number.isFinite(cur) ? cur : bar.weight) + 2 * p));
    fresh.current = false;
  };
  const removePlate = () => {
    const cur = Number(field.value);
    const ps = platesFor(cur, bar.weight);
    onChange('weight', ps.length ? fmtNum(cur - 2 * ps[ps.length - 1]) : fmtNum(bar.weight));
  };

  const showPlates = bar?.on && focus === 'weight' && fields.some((f) => f.key === 'weight');
  const wVal = fields.find((f) => f.key === 'weight')?.value;
  const sidePlates = showPlates && wVal !== '' ? platesFor(Number(wVal), bar.weight) : [];

  return (
    <div className="pad">
      <div className="pad-fields">
        {fields.map((f) => (
          <div key={f.key} className={`pad-field${f.key === focus ? ' active' : ''}`} onClick={() => setFocus(f.key)}>
            <div className="pad-label">
              <span>{f.label}</span>
              {f.key === 'weight' && bar && (
                <button
                  className={`switch${bar.on ? ' on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); bar.toggle(); }}
                  aria-pressed={bar.on}
                >
                  <i /> Bar
                </button>
              )}
            </div>
            <div className={`pad-value${f.value === '' ? ' ghost' : ''}`}>
              {f.value !== '' ? f.value : f.ghost || '—'}
              {f.value === '' && f.ghost && (
                <button className="use-ghost" onClick={(e) => { e.stopPropagation(); setFocus(f.key); onChange(f.key, f.ghost); }}>
                  use
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showPlates && (
        <div className="plates">
          <Barbell plates={sidePlates} />
          <div className="plate-caption">
            {wVal === '' ? `Bar ${bar.weight}` : `Bar ${bar.weight} + ${sidePlates.length ? sidePlates.join(' + ') : '0'} per side`}
          </div>
          <div className="plate-row">
            {PLATES.map((p) => (
              <button key={p} onClick={() => addPlate(p)}>+{p}</button>
            ))}
            <button className="muted" onClick={removePlate}>−</button>
          </div>
        </div>
      )}

      <div className="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} onClick={() => press(k)}>{k}</button>
        ))}
        <button onClick={() => press('.')} disabled={!field.decimal}>.</button>
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => press('back')} aria-label="Backspace">⌫</button>
      </div>
      <button className="primary" disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</button>
    </div>
  );
}

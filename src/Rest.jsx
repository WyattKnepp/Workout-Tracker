import { useEffect, useRef } from 'react';
import { api } from './api';
import { restAlert } from './alerts';
import { fmtClock, useNow } from './util';

export default function Rest({ active, save }) {
  const end = active.restEnd;
  const now = useNow(250);
  const fired = useRef(null);

  const remaining = end ? Math.ceil((end - now) / 1000) : 0;
  const over = end && remaining <= 0;

  useEffect(() => {
    if (!over || fired.current === end) return;
    fired.current = end;
    if (now - end < 3000) restAlert(); // don't buzz for a rest that finished long ago
  }, [over, end, now]);

  useEffect(() => {
    if (end && now - end > 3500) save({ ...active, restEnd: null });
  }, [end, now]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!end) return null;

  const adjust = (secs) => {
    const next = end + secs * 1000;
    save({ ...active, restEnd: next });
    api.restStart(Math.max(1, Math.round((next - Date.now()) / 1000)));
  };
  const skip = () => { save({ ...active, restEnd: null }); api.restCancel(); };

  return (
    <div className={`rest${over ? ' over' : ''}`}>
      <span className="rest-time">{over ? 'Go!' : fmtClock(remaining)}</span>
      <span className="rest-label">{over ? 'Rest over' : 'Rest'}</span>
      <button onClick={() => adjust(-15)}>−15</button>
      <button onClick={() => adjust(15)}>+15</button>
      <button onClick={skip}>{over ? 'Dismiss' : 'Skip'}</button>
    </div>
  );
}

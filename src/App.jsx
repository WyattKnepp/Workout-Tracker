import { useState } from 'react';
import { useStore } from './store';
import { Home, Session, startWorkout } from './Workout';
import History from './History';
import Body from './Body';
import Settings from './Settings';
import { api } from './api';

const TABS = [
  ['workout', 'Workout', '🏋️'],
  ['history', 'History', '📅'],
  ['body', 'Body', '⚖️'],
  ['settings', 'Settings', '⚙️'],
];

export default function App() {
  const { state: s, set, online } = useStore();
  const [tab, setTab] = useState('workout');
  const [inSession, setInSession] = useState(true); // resume straight into a workout in progress

  if (!s) return <div className="splash">Loading…</div>;

  if (s.active && inSession) {
    return <Session s={s} set={set} onLeave={() => setInSession(false)} />;
  }

  const start = (day) => {
    if (s.active && !window.confirm('Replace the workout in progress with a new one?')) return;
    if (s.active) api.restCancel();
    set('active', startWorkout(day));
    setInSession(true);
  };

  return (
    <div className="app">
      {!online && <div className="offline">Can’t reach server — changes are kept on this phone and will sync.</div>}
      <main>
        {tab === 'workout' && <Home s={s} onStart={start} onResume={() => setInSession(true)} />}
        {tab === 'history' && <History s={s} set={set} />}
        {tab === 'body' && <Body s={s} set={set} />}
        {tab === 'settings' && <Settings s={s} set={set} online={online} />}
      </main>
      <nav className="tabs">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

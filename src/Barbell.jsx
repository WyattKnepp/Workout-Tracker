import { PLATES } from './util';

const SIZE = { 45: [14, 58], 35: [12, 50], 25: [10, 42], 10: [8, 32], 5: [7, 26], 2.5: [6, 20] };
const COLOR = { 45: '#3b82f6', 35: '#eab308', 25: '#22c55e', 10: '#e5e7eb', 5: '#ef4444', 2.5: '#9ca3af' };

// One side of the bar (the other side mirrors it).
export default function Barbell({ plates }) {
  const W = 300;
  const mid = 32;
  let x = 52;
  const rects = plates.map((p, i) => {
    const [w, h] = SIZE[p] || SIZE[PLATES[PLATES.length - 1]];
    const r = <rect key={i} x={x} y={mid - h / 2} width={w} height={h} rx="2" fill={COLOR[p] || '#9ca3af'} />;
    x += w + 2;
    return r;
  });
  return (
    <svg className="barbell" viewBox={`0 0 ${W} 64`} role="img" aria-label="Plates on one side of the bar">
      <rect x="0" y={mid - 3} width={W} height="6" rx="3" fill="#6b7280" />
      <rect x="40" y={mid - 14} width="8" height="28" rx="2" fill="#9ca3af" />
      {rects}
    </svg>
  );
}

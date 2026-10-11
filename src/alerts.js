let ctx;

// Call from a tap so the browser lets us beep later.
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio */ }
}

export function restAlert() {
  try { navigator.vibrate?.([300, 100, 300, 100, 300]); } catch { /* unsupported */ }
  try {
    if (!ctx) return;
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* no audio */ }
}

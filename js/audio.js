// Tel sesi sentezi (Karplus–Strong). Harici ses dosyası gerekmez.
import { freq } from './theory.js';

let ctx = null;
const cache = new Map();
let enabled = true;

export function setSoundEnabled(v) { enabled = v; }

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function pluckBuffer(c, f, dur = 1.8) {
  const key = Math.round(f * 10);
  if (cache.has(key)) return cache.get(key);
  const sr = c.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = c.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  // iki tel (çift tel grubu gibi), hafif farklı akort
  for (const [fr, amp] of [[f, 0.6], [f * 1.0018, 0.4]]) {
    const N = Math.max(2, Math.round(sr / fr));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0, prev = 0;
    const decay = 0.9965;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const nxt = 0.5 * (cur + prev) * decay;
      prev = cur;
      ring[idx] = nxt;
      out[i] += cur * amp;
      idx = (idx + 1) % N;
    }
  }
  cache.set(key, buf);
  return buf;
}

/** absCents yazılı yüksekliğindeki notayı çal. */
export function playCents(absCents) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const f = freq(absCents);
  const src = c.createBufferSource();
  src.buffer = pluckBuffer(c, f);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f * 9);
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + 1.8);
}

/** Kısa geri bildirim sesleri */
export function blip(ok) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  const t = c.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(ok ? 880 : 220, t);
  if (ok) o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + 0.2);
}

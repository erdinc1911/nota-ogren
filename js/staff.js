// Sol anahtarlı porte (SVG): etiketler, çizgi/aralık vurgusu ve dokunarak nota koyma.
import { ACCIDENTALS } from './theory.js';

const NS = 'http://www.w3.org/2000/svg';
const LINE_GAP = 12;
const HALF = LINE_GAP / 2;
const TOP = 58;                       // 5. çizgi (Fa5)
const BOTTOM = TOP + 4 * LINE_GAP;    // 1. çizgi (Mi4)
export const E4_STEP = 4 * 7 + 2;
export const H = 182;

export const yOf = (step) => BOTTOM - (step - E4_STEP) * HALF;
export const stepFromY = (y) => Math.round((BOTTOM - y) / HALF) + E4_STEP;

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/** Bir basamağın portedeki yerini sözle anlat. */
export function placeName(step) {
  const d = step - E4_STEP;
  if (d >= 0 && d <= 8) return d % 2 === 0 ? `${d / 2 + 1}. çizgi` : `${(d + 1) / 2}. aralık`;
  if (d === -1) return 'portenin hemen altı';
  if (d === -2) return 'alttaki ek çizgi';
  if (d === -3) return 'alttaki ek çizginin altı';
  if (d === 9) return 'portenin hemen üstü';
  if (d === 10) return 'üstteki 1. ek çizgi';
  if (d === 11) return 'üstteki 1. ek çizginin üstü';
  return d < 0 ? 'portenin çok altı' : 'portenin çok üstü';
}

// El çizimi sol anahtarı (G4 çizgisi etrafında kıvrılır). Birim: çizgi aralığı = 10.
const CLEF_PATH =
  'M13.5 52 C13 58.5 22.5 59 21.5 50 L15.2 -4 C14.2 -13 23.5 -18 23 -7 ' +
  'C22.4 4 6 11 5.5 25 C5 37 23 40 25.5 30.5 C27.5 22 18 17.5 13.5 23.5 C10.8 27.5 14.5 32 18 31.5';

function drawClef(g, cls = '') {
  const s = LINE_GAP / 10;
  const clef = el('g', { transform: `translate(12 ${TOP}) scale(${s})`, class: 'clef ' + cls }, g);
  el('path', { d: CLEF_PATH, fill: 'none', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, clef);
  el('circle', { cx: 15.5, cy: 51.5, r: 3.3 }, clef);
}

function drawAccidental(g, accKey, x, y) {
  const a = ACCIDENTALS[accKey];
  if (!a || !a.sign) return;
  const s = el('g', { class: 'acc', transform: `translate(${x} ${y})` }, g);
  if (a.sign === 'flat') {
    el('path', { d: 'M0 -20 L0 6 C9 0 11 -7 5 -8 C2.5 -8.4 0.6 -6.5 0 -5', fill: 'none', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, s);
  } else {
    el('path', { d: 'M-2.6 -12 L-2.6 13 M2.6 -14 L2.6 11', 'stroke-width': 1.4 }, s);
    el('path', { d: 'M-6 -2.5 L6 -6.5 M-6 6.5 L6 2.5', 'stroke-width': 3.2 }, s);
  }
  if (a.num) el('text', { x: a.sign === 'flat' ? 9 : 8, y: -8, class: 'acc-num' }, s).textContent = String(a.num);
}

/**
 * notes: [{step, acc, cls, label}]
 * opts: { width, highlight: [step...], clefGlow, numbers (çizgi numaraları) }
 */
export function renderStaff(svg, notes = [], opts = {}) {
  const W = opts.width || 300;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const g = el('g', {}, svg);
  // vurgular (çizgi ya da aralık)
  (opts.highlight || []).forEach(step => {
    const y = yOf(step), d = step - E4_STEP;
    const onLine = ((d % 2) + 2) % 2 === 0;
    if (onLine && d >= 0 && d <= 8) el('rect', { x: 4, y: y - 3, width: W - 8, height: 6, rx: 3, class: 'hl' }, g);
    else el('rect', { x: 4, y: y - HALF + 1.5, width: W - 8, height: LINE_GAP - 3, rx: 3, class: 'hl space' }, g);
  });
  for (let i = 0; i < 5; i++) {
    el('line', { x1: 4, x2: W - 4, y1: TOP + i * LINE_GAP, y2: TOP + i * LINE_GAP, class: 'staff-line' }, g);
  }
  if (opts.numbers) {
    for (let i = 0; i < 5; i++) el('text', { x: W - 2, y: BOTTOM - i * LINE_GAP + 3.5, class: 'line-num' }, g).textContent = i + 1;
  }
  drawClef(g, opts.clefGlow ? 'glow' : '');
  const n = notes.length;
  const x0 = 82, x1 = W - 26;
  notes.forEach((note, i) => {
    const x = note.x ?? (n === 1 ? Math.max(x0 + 40, W * 0.6) : x0 + i * ((x1 - x0) / Math.max(1, n - 1)));
    const y = yOf(note.step);
    const ng = el('g', { class: 'note ' + (note.cls || '') }, g);
    for (let s = E4_STEP - 2; s >= note.step; s -= 2) el('line', { x1: x - 12, x2: x + 12, y1: yOf(s), y2: yOf(s), class: 'ledger' }, ng);
    for (let s = E4_STEP + 10; s <= note.step; s += 2) el('line', { x1: x - 12, x2: x + 12, y1: yOf(s), y2: yOf(s), class: 'ledger' }, ng);
    drawAccidental(ng, note.acc, x - 22, y);
    el('ellipse', { cx: x, cy: y, rx: 7.2, ry: 5.3, transform: `rotate(-22 ${x} ${y})`, class: 'head' }, ng);
    if (!note.noStem) {
      const up = note.step < E4_STEP + 4;
      if (up) el('line', { x1: x + 6.4, x2: x + 6.4, y1: y - 1.5, y2: y - 34, class: 'stem' }, ng);
      else el('line', { x1: x - 6.4, x2: x - 6.4, y1: y + 1.5, y2: y + 34, class: 'stem' }, ng);
    }
    if (note.label) el('text', { x, y: H - 6, class: 'note-label' }, ng).textContent = note.label;
  });
}

/** Porteye dokunma: en yakın çizgi/aralığı (basamak) bildirir. */
export function onStaffTap(svg, cb) {
  svg.addEventListener('pointerdown', (e) => {
    const m = svg.getScreenCTM();
    if (!m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (pt.x < 50) return; // anahtarın üstü
    e.preventDefault();
    cb(stepFromY(pt.y), pt.x);
  });
}

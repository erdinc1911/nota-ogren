// Bağlama sapı (SVG). Perdeler gerçek oranlarına göre yerleştirilir, böylece
// koma perdelerinin sıkışık aralıkları da gerçek sazdaki gibi görünür.
// Geniş ekranda yatay, dar (telefon) ekranda dikey çizilir.
import { noteName } from './theory.js';

const NS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export const isVerticalLayout = () => window.innerWidth < 700;

export function createNeck(svg, { onTap } = {}) {
  let board = null, opts = {}, g = null;

  // u: sap boyunca (eşikten aşağı/sağa), v: sap enine
  function layout() {
    const vertical = isVerticalLayout();
    const last = board.frets[board.frets.length - 1];
    const span = 1 - 1 / last.ratio;
    let G;
    if (vertical) {
      const NUT = 72, S = 900;
      const END = NUT + span * S;
      G = { vertical, NUT, S, END, W: 300, H: END + 26, across: [70, 150, 230], wood: [32, 268] };
    } else {
      const NUT = 92, END = 974;
      G = { vertical, NUT, END, S: (END - NUT) / span, W: 1000, H: 200, across: [58, 100, 142], wood: [30, 170] };
    }
    G.us = [G.NUT, ...board.frets.map(f => G.NUT + (1 - 1 / f.ratio) * G.S)];
    G.cu = (fret) => fret === 0 ? G.NUT - (vertical ? 22 : 26) : G.us[fret] - Math.min(16, (G.us[fret] - G.us[fret - 1]) * 0.42);
    G.cell = (fret) => fret === 0 ? [vertical ? 36 : 0, G.NUT] : [G.us[fret - 1], G.us[fret]];
    G.P = (u, v) => vertical ? { x: v, y: u } : { x: u, y: v };
    G.rect = (u0, u1, v0, v1, attrs, parent) => {
      const a = vertical ? { x: v0, y: u0, width: v1 - v0, height: u1 - u0 } : { x: u0, y: v0, width: u1 - u0, height: v1 - v0 };
      return el('rect', { ...a, ...attrs }, parent);
    };
    G.line = (u0, u1, v0, v1, attrs, parent) => {
      const p = G.P(u0, v0), q = G.P(u1, v1);
      return el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, ...attrs }, parent);
    };
    G.text = (u, v, str, attrs, parent) => {
      const p = G.P(u, v);
      const t = el('text', { x: p.x, y: p.y, ...attrs }, parent);
      t.textContent = str;
      return t;
    };
    g = G;
  }

  function render() {
    if (!board) return;
    layout();
    const G = g, V = G.vertical;
    svg.classList.toggle('vertical', V);
    svg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="${V ? 1 : 0}" y2="${V ? 0 : 1}">
          <stop offset="0" stop-color="#7a4a2a"/><stop offset=".5" stop-color="#94603a"/><stop offset="1" stop-color="#6b3f22"/>
        </linearGradient>
      </defs>`;
    const maxFret = opts.maxFret ?? board.frets.length;
    const [w0, w1] = G.wood;
    G.rect(G.NUT - 4, G.END + 12, w0, w1, { rx: 6, fill: 'url(#wood)' }, svg);
    if (maxFret < board.frets.length) {
      G.rect(G.us[maxFret], G.END + 12, w0, w1, { class: 'neck-dim' }, svg);
    }
    G.rect(G.NUT - 6, G.NUT + 2, w0 - 4, w1 + 4, { rx: 2, class: 'nut' }, svg);
    // perdeler
    board.frets.forEach((f, i) => {
      const u = G.us[i + 1];
      G.line(u, u, w0 + 2, w1 - 2, { class: 'fret' + (f.isKoma ? ' koma' : '') }, svg);
      if (V) G.text(u + 4, 16, f.n, { class: 'fret-num' + (f.isKoma ? ' koma' : '') }, svg);
      else G.text(u, 188, f.n, { class: 'fret-num' + (f.isKoma ? ' koma' : '') }, svg);
    });
    if (V) G.text(G.NUT - 18, 16, '0', { class: 'fret-num' }, svg);
    else G.text(G.NUT - 26, 188, '0', { class: 'fret-num' }, svg);
    // teller
    board.duzen.strings.forEach((s, si) => {
      const v = G.across[si];
      const start = V ? 38 : 44;
      G.line(start, G.END + 12, v - 2.2, v - 2.2, { class: 'string' }, svg);
      G.line(start, G.END + 12, v + 2.2, v + 2.2, { class: 'string' }, svg);
      if (V) {
        G.text(11, v, s.name.replace(' tel', ''), { class: 'string-name', 'text-anchor': 'middle' }, svg);
        G.text(27, v, noteName(s.open), { class: 'string-name open', 'text-anchor': 'middle' }, svg);
      } else {
        const lab = el('text', { x: 4, y: v + 4, class: 'string-name' }, svg);
        lab.innerHTML = `<tspan x="4" dy="-5">${s.name.replace(' tel', '')}</tspan><tspan x="4" dy="11" class="open">${noteName(s.open)}</tspan>`;
      }
    });
    // nota adları
    if (opts.showNames) {
      board.positions.forEach(p => {
        if (p.fret > maxFret) return;
        const v = G.across[p.stringIndex];
        const cls = 'pos-name' + (p.isKoma ? ' koma' : '');
        if (V) G.text(G.cu(p.fret) + 3.5, v + 25, noteName(p.note), { class: cls }, svg);
        else G.text(G.cu(p.fret), v + 18, noteName(p.note), { class: cls }, svg);
      });
    }
    // tıklama alanları
    const hit = el('g', { class: 'hits' }, svg);
    const half = V ? 40 : 21;
    board.positions.forEach(p => {
      if (p.fret > maxFret) return;
      const [a, b] = G.cell(p.fret);
      const v = G.across[p.stringIndex];
      const r = G.rect(a, a + Math.max(4, b - a), v - half, v + half, { class: 'hit' }, hit);
      r.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap && onTap(p); });
    });
    // işaretler
    const mg = el('g', { class: 'marks' }, svg);
    (opts.marks || []).forEach(m => {
      const c = G.P(G.cu(m.pos.fret), G.across[m.pos.stringIndex]);
      const mk = el('g', { class: 'mark ' + (m.cls || '') }, mg);
      el('circle', { cx: c.x, cy: c.y, r: V ? 12 : 13 }, mk);
      if (m.label) el('text', { x: c.x, y: c.y + 4 }, mk).textContent = m.label;
    });
  }

  let lastV = null;
  window.addEventListener('resize', () => {
    const v = isVerticalLayout();
    if (v !== lastV) { lastV = v; render(); }
  });

  return {
    setBoard(b) { board = b; lastV = isVerticalLayout(); render(); },
    update(o) { opts = { ...opts, ...o }; render(); },
    scrollStart() { const w = svg.parentElement; if (w) { w.scrollTop = 0; w.scrollLeft = 0; } },
    /** konumu kaydırma alanında görünür yap */
    reveal(pos) {
      const wrap = svg.parentElement;
      if (!wrap || !g) return;
      if (g.vertical) {
        const scale = svg.clientHeight / g.H;
        const y = g.cu(pos.fret) * scale;
        if (y < wrap.scrollTop + 30 || y > wrap.scrollTop + wrap.clientHeight - 30) {
          wrap.scrollTo({ top: Math.max(0, y - wrap.clientHeight / 2), behavior: 'smooth' });
        }
      } else {
        const scale = svg.clientWidth / g.W;
        const x = g.cu(pos.fret) * scale;
        if (x < wrap.scrollLeft + 40 || x > wrap.scrollLeft + wrap.clientWidth - 40) {
          wrap.scrollTo({ left: Math.max(0, x - wrap.clientWidth / 2), behavior: 'smooth' });
        }
      }
    },
  };
}

import { LETTERS, ACCIDENTALS, makeNote, noteName, noteLongName, parseSpokenNote, spell, A4_CENTS } from './theory.js';
import { createPitchListener } from './pitch.js';
import { LEVELS, levelPool, ALL_NATURALS } from './lessons.js';
import { renderStaff, onStaffTap, placeName } from './staff.js';
import { playCents, blip, setSoundEnabled } from './audio.js';
import { createSpeech } from './speech.js';
import * as store from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const speech = createSpeech();
setSoundEnabled(store.getSettings().sound);

let cleanup = [];                 // ekran değişince durdurulacak zamanlayıcılar
let voiceHandler = null;          // aktif ekranın sesli cevap işleyicisi
const later = (fn, ms) => { const t = setTimeout(fn, ms); cleanup.push(() => clearTimeout(t)); };

const yonelme = (n) => ['’a','’e','’ye','’e','’e','’e','’ya','’ye','’e','’a'][n % 10] ; // 10’a, 1’e, 2’ye…
const keyOf = (note) => noteName(note, { octave: true });
const labelOf = (note, label) => label === true ? noteName(note) : (label || '');
const noteFromStep = (step, acc = '') => makeNote(((step % 7) + 7) % 7, Math.floor(step / 7), acc);
const staffWidth = () => (window.innerWidth < 560 ? 300 : 340);

function playSeq(notes, gap = 520) {
  notes.forEach((nt, i) => later(() => playCents(nt.cents), i * gap));
}

// ------------------------------------------------------------- cevap paneli
function padHTML({ letters, accs }) {
  return `
    <div class="pad">
      ${accs.length > 1 ? `<div class="acc-row">${accs.map(a =>
        `<button class="acc-btn${a === '' ? ' on' : ''}" data-acc="${a}">${a === '' ? '♮ doğal' : ACCIDENTALS[a].label}</button>`).join('')}</div>` : ''}
      <div class="letter-row" style="--cols:${letters.length}">${letters.map(l =>
        `<button class="letter-btn" data-letter="${l}">${LETTERS[l]}</button>`).join('')}</div>
      <div class="mic-row">
        <button class="mic-btn" ${speech.available ? '' : 'hidden'}>🎤 <span>Söyleyerek cevapla</span></button>
        <span class="level" aria-hidden="true"><i></i></span>
        <span class="heard">${speech.available ? '' : speech.reason}</span>
      </div>
      ${speech.available ? '<p class="voice-tip">🗣️ Nota adını <b>normal konuşma tonunda</b> söyle (ince ya da bağırarak söylenince anlaşılmayabilir). Notayı kendi perdesinde söylemek için <b>Solfej</b> sekmesini kullan.</p>' : ''}
    </div>`;
}
function bindPad(root, onAnswer) {
  let acc = '';
  root.querySelectorAll('.acc-btn').forEach(b => b.addEventListener('click', () => {
    acc = b.dataset.acc;
    root.querySelectorAll('.acc-btn').forEach(x => x.classList.toggle('on', x === b));
  }));
  root.querySelectorAll('.letter-btn').forEach(b => b.addEventListener('click', () => {
    const a = acc;
    acc = '';
    root.querySelectorAll('.acc-btn').forEach(x => x.classList.toggle('on', x.dataset.acc === ''));
    onAnswer(+b.dataset.letter, a);
  }));
  const mic = $('.mic-btn', root);
  if (mic) mic.addEventListener('click', () => {
    if (speech.listening) speech.stop();
    else { setHeard(speech.pushToTalk ? 'Söyle…' : 'Notayı söyle: “sol”, “la”…'); speech.start(); }
  });
  updateMic();
}
function setHeard(t) { const h = $('.heard'); if (h) h.textContent = t; }
function updateMic(state = {}) {
  document.querySelectorAll('.mic-btn').forEach(btn => {
    btn.hidden = !speech.available;
    btn.classList.toggle('on', speech.listening);
    btn.querySelector('span').textContent = speech.listening
      ? (speech.pushToTalk ? 'Dinliyorum… söyle' : 'Dinliyorum… (durdur)')
      : (speech.pushToTalk ? 'Bas ve söyle' : 'Söyleyerek cevapla');
  });
  if (state.info) setHeard(state.info);
  else if (!speech.available && speech.reason) setHeard(speech.reason);
}
speech.onState(updateMic);
speech.setSensitivity(store.getSettings().sens || 'yuksek');
speech.onLevel((v) => { const i = document.querySelector('.level i'); if (i) i.style.width = Math.round(v * 100) + '%'; });
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || e.target.closest('input,select,textarea')) return;
  const mic = document.querySelector('.mic-btn');
  if (!mic || mic.hidden || mic.closest('[hidden]')) return;
  e.preventDefault();
  mic.click();
});
let lastVoice = 0;
speech.onText((text) => {
  const alts = text.split(' | ');
  let parsed = null;
  for (const a of alts) { parsed = parseSpokenNote(a); if (parsed) break; }
  setHeard(`Duyulan: “${alts[0].trim()}”` + (parsed ? ` → ${LETTERS[parsed.letter]}${ACCIDENTALS[parsed.acc].label}` : ' (anlaşılamadı)'));
  const now = Date.now();
  if (!parsed || now - lastVoice < 150) return;
  lastVoice = now;
  voiceHandler && voiceHandler(parsed.letter, parsed.acc);
});

// ------------------------------------------------------------- ana sayfa
function renderHome() {
  const unlocked = store.getUnlocked();
  const current = LEVELS.find(L => L.id <= unlocked && !store.isPassed(L.id));
  view.innerHTML = `
    <section class="home">
      <div class="hero">
        <h2>Nota okumayı adım adım öğren</h2>
        <p>Her seviyede birkaç yeni nota: önce <b>öğren</b>, sonra porteye dokunarak ya da söyleyerek <b>alıştır</b>, hazır olunca <b>sınav</b>. Sınavı geçince sonraki seviye açılır.</p>
      </div>
      <ol class="levels">
        ${LEVELS.map(L => {
          const locked = L.id > unlocked, passed = store.isPassed(L.id);
          const state = locked ? '🔒' : passed ? '✓' : 'Başla →';
          const cls = locked ? 'locked' : passed ? 'passed' : (current && current.id === L.id ? 'current' : '');
          return `<li><button class="level-card ${cls}" data-id="${L.id}" ${locked ? 'aria-disabled="true"' : ''}>
            <span class="lv-num">${L.id}</span>
            <span class="lv-body"><b>${L.title}</b><small>${L.subtitle}</small></span>
            <span class="lv-state">${state}</span></button></li>`;
        }).join('')}
      </ol>
      <button class="free-card" data-go="serbest"><b>Serbest porte</b><small>Tüm notalar: dokun, söyle, gör ve dinle</small></button>
    </section>`;
  view.querySelectorAll('.level-card').forEach(b => b.addEventListener('click', () => {
    const id = +b.dataset.id;
    if (id > store.getUnlocked()) { b.classList.add('shake'); later(() => b.classList.remove('shake'), 400); return; }
    location.hash = `seviye-${id}`;
  }));
  $('.free-card').addEventListener('click', () => location.hash = 'serbest');
}

// ------------------------------------------------------------- ders ekranı
function lessonShell(L, tab) {
  const tabs = L.intro ? [] : [['ogren', 'Öğren'], ['alistir', 'Alıştır'], ['sinav', 'Sınav'], ...(L.accidentals ? [] : [['koy', 'Yerleştir']]), ['solfej', 'Solfej']];
  view.innerHTML = `
    <section class="lesson">
      <div class="lesson-head">
        <button class="back" data-go="">← Seviyeler</button>
        <h2><span class="lv-badge">${L.id}</span> ${L.title}</h2>
      </div>
      ${tabs.length ? `<nav class="seg">${tabs.map(([k, t]) =>
        `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</nav>` : ''}
      <div class="lesson-body"></div>
    </section>`;
  $('.back').addEventListener('click', () => location.hash = '');
  view.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    location.hash = `seviye-${L.id}` + (b.dataset.tab === 'ogren' ? '' : '-' + b.dataset.tab);
  }));
  return $('.lesson-body');
}

// ---- Öğren
function renderLearn(L, body) {
  let i = 0;
  const draw = () => {
    const s = L.slides[i];
    const last = i === L.slides.length - 1;
    body.innerHTML = `
      <article class="slide">
        <div class="dots">${L.slides.map((_, k) => `<span class="${k === i ? 'on' : k < i ? 'done' : ''}"></span>`).join('')}</div>
        <h3>${s.title}</h3>
        <div class="staff-box"><svg class="staff"></svg></div>
        <p class="slide-text">${s.text}</p>
        <div class="slide-nav">
          <button class="ghost-btn prev" ${i === 0 ? 'disabled' : ''}>← Geri</button>
          ${s.play ? '<button class="ghost-btn play">▶ Dinle</button>' : '<span></span>'}
          <button class="primary-btn next">${last ? (L.intro ? 'Seviye 1’e başla →' : 'Alıştırmaya geç →') : 'İleri →'}</button>
        </div>
      </article>`;
    const st = s.staff || {};
    const notes = (st.notes || []).map(x => x.note ? { ...x.note, label: labelOf(x.note, x.label) } : x);
    renderStaff($('.staff', body), notes, { width: staffWidth(), highlight: st.highlight, clefGlow: st.clefGlow, numbers: st.numbers });
    $('.prev', body).addEventListener('click', () => { i--; draw(); });
    $('.next', body).addEventListener('click', () => {
      if (!last) { i++; draw(); return; }
      if (L.intro) { store.pass(L.id); location.hash = `seviye-${L.id + 1}`; }
      else location.hash = `seviye-${L.id}-alistir`;
    });
    const pb = $('.play', body);
    if (pb) pb.addEventListener('click', () => playSeq(s.play));
  };
  draw();
}

// ---- Alıştır (ve Serbest porte)
function renderPractice(body, { pool, letters, accs, title }) {
  body.innerHTML = `
    <div class="practice">
      <p class="lead">${title}</p>
      <div class="staff-box tap"><svg class="staff"></svg><span class="tap-hint">Porteye dokun</span></div>
      <div class="pinfo" aria-live="polite">&nbsp;</div>
      <div class="row-btns">
        <button class="ghost-btn show-all">Hepsini göster</button>
        <button class="ghost-btn clear">Temizle</button>
      </div>
      ${padHTML({ letters, accs })}
    </div>`;
  const svg = $('.staff', body);
  let shown = [];
  const draw = (hl) => {
    const W = Math.max(staffWidth(), 96 + shown.length * 36);
    svg.style.minWidth = W > staffWidth() ? `${W * 1.1}px` : '';
    renderStaff(svg, shown, { width: W, highlight: hl });
  };
  const info = (html) => { $('.pinfo', body).innerHTML = html; };
  draw();
  onStaffTap(svg, (step) => {
    const min = 26, max = 42;
    if (step < min || step > max) return;
    const note = noteFromStep(step);
    shown = [{ ...note, label: noteName(note), cls: 'sel' }];
    draw([step]);
    $('.tap-hint', body).hidden = true;
    info(`<b class="big">${noteName(note)}</b> <span class="muted">${placeName(step)}</span>`);
    playCents(note.cents);
  });
  const showLetter = (letter, acc) => {
    let hits = pool.filter(p => p.letter === letter && p.acc === acc);
    if (!hits.length) hits = ALL_NATURALS.filter(p => p.letter === letter).map(p => makeNote(p.letter, p.octave, acc));
    shown = hits.map(p => ({ ...p, label: noteName(p), cls: 'sel' }));
    draw(hits.map(h => h.step));
    info(hits.map(h => `<b class="big">${noteName(h)}</b> <span class="muted">${placeName(h.step)}</span>`).join('<br>'));
    playSeq(hits, 450);
  };
  bindPad(body, showLetter);
  voiceHandler = (l, a) => showLetter(l, accs.includes(a) ? a : '');
  $('.show-all', body).addEventListener('click', () => {
    const list = pool.length > 13 ? pool.filter(p => !p.acc) : pool;
    shown = [...list].sort((a, b) => a.cents - b.cents).map(p => ({ ...p, label: noteName(p) }));
    draw();
    info(`<span class="muted">${pool.length > 13 ? 'Bütün doğal notalar' : 'Bu seviyedeki bütün notalar'}${shown.length > 7 ? ' — yana kaydır' : ''}</span>`);
  });
  $('.clear', body).addEventListener('click', () => { shown = []; draw(); info('&nbsp;'); });
}

// ---- Sınav (mode: 'oku' = nota adını söyle/seç, 'koy' = porteye yerleştir)
const PASS_PCT = 90;
function buildDeck(pool, n) {
  // her nota ağırlığı oranında, toplam n soru; yanlış yapılanlara biraz ek ağırlık
  const w = pool.map(p => p.weight * (1 + 0.5 * Math.min(4, store.getMiss(keyOf(p.note)))));
  const sum = w.reduce((a, b) => a + b, 0);
  const counts = w.map(x => Math.max(1, Math.round(n * x / sum)));
  let total = counts.reduce((a, b) => a + b, 0);
  while (total > n) { const i = counts.indexOf(Math.max(...counts)); counts[i]--; total--; }
  while (total < n) { counts[Math.floor(Math.random() * counts.length)]++; total++; }
  let deck = [];
  pool.forEach((p, i) => { for (let k = 0; k < counts[i]; k++) deck.push(p.note); });
  // karıştır; aynı nota üst üste en fazla 2 kez
  for (let tries = 0; tries < 30; tries++) {
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    let ok = true;
    for (let i = 2; i < deck.length; i++) if (keyOf(deck[i]) === keyOf(deck[i - 1]) && keyOf(deck[i]) === keyOf(deck[i - 2])) { ok = false; break; }
    if (ok) break;
  }
  return deck.map(note => ({ note, retry: false }));
}

// Soru sayısı: nota başına 5 (en az 10, en çok 40). Grup: ilk seviyelerde tek nota,
// sonra aynı portede yan yana 3–4 nota (soldan sağa okunur).
function testSize(L, poolLen, mode) {
  const g = mode === 'oku' ? (L.id <= 4 ? 1 : L.id <= 8 || L.accidentals ? 3 : 4) : 1;
  let n = Math.max(10, Math.min(40, poolLen * 5));
  n = Math.round(n / g) * g;
  return { n, g };
}

function renderTest(L, body, mode = 'oku') {
  const pool = levelPool(L.id);
  const { n: N, g: G } = testSize(L, pool.length, mode);
  const letters = [...new Set(pool.map(p => p.note.letter))].sort((a, b) => a - b);
  const ORDER = ['b', 'b2', '', '#2', '#'];
  const accs = L.accidentals ? [...new Set(['', ...pool.map(p => p.note.acc)])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) : [''];
  const bestKey = mode === 'oku' ? L.id : `koy-${L.id}`;
  let deck, pos, answered, correct, group, gi, locked, misses;
  const cur = () => group && group[gi];

  body.innerHTML = `
    <div class="test">
      <div class="progress"><div class="bar"><i></i></div><span class="ptext"></span></div>
      <div class="staff-box ${mode === 'koy' ? 'tap' : ''}"><svg class="staff"></svg></div>
      <p class="prompt"></p>
      <div class="feedback" aria-live="polite"></div>
      <div class="row-btns">${mode === 'oku' ? '<button class="ghost-btn listen">🔊 Dinle</button>' : ''}<button class="primary-btn next" hidden>Devam →</button></div>
      ${mode === 'oku' ? padHTML({ letters, accs }) : ''}
      <div class="passed-banner" hidden></div>
    </div>`;
  const svg = $('.staff', body);
  const progress = () => {
    $('.bar i', body).style.width = Math.round(100 * answered / N) + '%';
    const best = store.getBest(bestKey);
    const it = cur();
    $('.ptext', body).textContent = `Soru ${Math.min(answered + 1, N)} / ${N} · doğru ${correct}` +
      (it && it.retry ? ' · tekrar sorusu' : '') + (best ? ` · en iyi %${best}` : '');
  };
  const drawGroup = (extra = [], highlight = []) => {
    if (mode === 'koy') return;
    const notes = group.map((it, i) => {
      if (i < gi) return { ...it.note, label: noteName(it.note), cls: it.ok ? 'ok' : 'okq' };
      if (i === gi && G > 1) return { ...it.note, label: '?', cls: 'cur' };
      return { ...it.note };
    });
    renderStaff(svg, notes.concat(extra), { width: staffWidth(), highlight });
  };
  const start = () => {
    deck = buildDeck(pool, N); pos = 0; answered = 0; correct = 0; misses = {};
    $('.passed-banner', body).hidden = true;
    next();
  };
  const next = () => {
    if (pos >= deck.length) return finishTest();
    locked = false;
    group = deck.slice(pos, pos + G); pos += group.length; gi = 0;
    $('.feedback', body).innerHTML = ''; $('.feedback', body).className = 'feedback';
    $('.next', body).hidden = true;
    if (mode === 'oku') {
      drawGroup();
      $('.prompt', body).innerHTML = G > 1
        ? 'Notaları <b>soldan sağa</b> oku <span class="muted">işaretli nota sıradaki</span>'
        : (cur().retry ? 'Bu nota hangisi? <span class="muted">(az önce karıştırdığın nota)</span>' : 'Bu nota hangisi?');
    } else {
      renderStaff(svg, [], { width: staffWidth() });
      $('.prompt', body).innerHTML = `<b>${noteName(cur().note)}</b> notasını porteye koy <span class="muted">doğru çizgiye ya da aralığa dokun</span>`;
    }
    progress();
  };
  // Yanlışta geçmez: doğru cevap bekler. Puana yalnızca ilk deneme sayılır.
  const judge = (good, givenText, givenNote) => {
    const it = cur(); const q = it.note;
    const first = !it.tried;
    it.tried = (it.tried || 0) + 1;
    if (first) {
      it.ok = good;
      if (!it.retry) { answered++; if (good) correct++; }
      store.recordAnswer(keyOf(q), good);
      if (!good) misses[noteName(q)] = (misses[noteName(q)] || 0) + 1;
    }
    const fb = $('.feedback', body);
    if (!good) {
      blip(false);
      fb.className = 'feedback bad';
      fb.innerHTML = `✗ ${givenText} değil — tekrar dene.` +
        (it.tried >= 2 ? ` <span class="muted">İpucu: ${placeName(q.step)}</span>` : '');
      if (mode === 'koy' && givenNote) {
        renderStaff(svg, [{ ...givenNote, label: noteName(givenNote), cls: 'bad' }], { width: staffWidth(), highlight: it.tried >= 2 ? [q.step] : [] });
      } else if (it.tried >= 2) drawGroup([], [q.step]);
      progress();
      return;                                  // aynı soruda kal
    }
    // doğru
    if (G === 1 || mode === 'koy') blip(true);
    later(() => playCents(q.cents), 100);
    gi++;
    fb.className = 'feedback good';
    fb.innerHTML = `✓ <b class="big">${noteName(q)}</b> <span class="muted">${placeName(q.step)}</span>`;
    if (mode === 'koy') renderStaff(svg, [{ ...q, label: noteName(q), cls: it.ok ? 'ok' : 'okq' }], { width: staffWidth(), highlight: [q.step] });
    else drawGroup();
    progress();
    if (gi < group.length) return;             // grupta sıradaki notaya geç
    locked = true;
    if (G > 1) blip(group.every(x => x.ok));
    later(next, G > 1 ? 1100 : 900);
  };
  const finishTest = () => {
    if (speech.listening) speech.stop();
    const pct = Math.round(100 * correct / N);
    store.setBest(bestKey, pct);
    const passed = pct >= PASS_PCT;
    if (passed && mode === 'oku') store.pass(L.id);
    const nextL = LEVELS.find(x => x.id === L.id + 1);
    const missList = Object.entries(misses).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<b>${k}</b> (${v})`).join(', ');
    const b = $('.passed-banner', body);
    b.hidden = false;
    b.innerHTML = `<div class="pb-card">
      <div class="pb-emoji">${passed ? '🎉' : '💪'}</div>
      <h3>${N} soruda ${correct} doğru — %${pct}</h3>
      <p>${passed
        ? (mode === 'oku' ? (nextL ? `Seviye ${L.id} tamam. <b>Seviye ${nextL.id}: ${nextL.title}</b> açıldı.` : 'Bütün seviyeleri bitirdin!') : 'Harika, notaların yerini iyi biliyorsun.')
        : `Geçmek için en az %${PASS_PCT} gerekiyor. Biraz daha alıştırma yapıp tekrar dene.`}</p>
      ${missList ? `<p class="muted">Karıştırdıkların: ${missList}</p>` : ''}
      <div class="row-btns">
        ${passed && mode === 'oku' && nextL ? `<button class="primary-btn go-next">Seviye ${nextL.id}${yonelme(nextL.id)} geç →</button>` : ''}
        <button class="${passed ? 'ghost-btn' : 'primary-btn'} again">Sınavı tekrarla</button>
        ${!passed ? '<button class="ghost-btn practice">Alıştırmaya dön</button>' : ''}
      </div></div>`;
    if ($('.go-next', b)) $('.go-next', b).addEventListener('click', () => location.hash = `seviye-${nextL.id}`);
    $('.again', b).addEventListener('click', start);
    if ($('.practice', b)) $('.practice', b).addEventListener('click', () => location.hash = `seviye-${L.id}-alistir`);
  };

  if (mode === 'oku') {
    const answer = (letter, acc) => {
      if (locked || !cur()) return;
      const q = cur().note;
      judge(letter === q.letter && acc === q.acc, LETTERS[letter] + ACCIDENTALS[acc].label);
    };
    bindPad(body, answer);
    voiceHandler = (letter, acc) => {
      if (locked) return;
      answer(letter, accs.includes(acc) ? acc : '');
    };
    $('.listen', body).addEventListener('click', () => cur() && playCents(cur().note.cents));
  } else {
    onStaffTap(svg, (step) => {
      if (locked || !cur() || step < 26 || step > 42) return;
      const given = noteFromStep(step);
      judge(given.letter === cur().note.letter, `${noteName(given)} (${placeName(step)})`, given);
    });
  }
  $('.next', body).addEventListener('click', next);
  start();
}

// ---- Solfej: notayı söyle (ya da sazla çal), perdesi ölçülür
function renderSolfej(L, body) {
  const pool = levelPool(L.id);
  const N = 10;
  const set = store.getSettings();
  const tol = +(set.solfTol || 25);
  const octaveFree = set.solfOct !== false;
  const allowKoma = pool.some(p => ACCIDENTALS[p.note.acc].level === 2);
  let deck, pos, q, ok, skipped, hold, muteUntil = 0, locked = false, hist = [], devs = [];

  body.innerHTML = `
    <div class="solfej">
      <p class="lead">Portedeki notayı adıyla <b>söyle</b> (ya da sazla çal) ve sesi tut. ${octaveFree ? 'Kendi rahat ses aralığında söyleyebilirsin; oktav fark etmez.' : ''} Hedef: ±${tol} sent.</p>
      <div class="progress"><div class="bar"><i></i></div><span class="ptext"></span></div>
      <div class="staff-box"><svg class="staff"></svg></div>
      <div class="meter" aria-hidden="true">
        <div class="zone" style="left:${50 - tol}%;width:${2 * tol}%"></div>
        <div class="tick first" style="left:0%">−50</div><div class="tick" style="left:25%">−25</div><div class="tick mid" style="left:50%">0</div><div class="tick" style="left:75%">+25</div><div class="tick last" style="left:100%">+50</div>
        <div class="needle" hidden></div>
        <span class="lbl l">pes</span><span class="lbl r">tiz</span>
      </div>
      <div class="hold"><i></i></div>
      <div class="pinfo heardp">&nbsp;</div>
      <div class="row-btns">
        <button class="ghost-btn listen">🔊 Dinle</button>
        <button class="primary-btn micp">🎤 Başla</button>
        <button class="ghost-btn skip">Geç →</button>
      </div>
      <div class="passed-banner" hidden></div>
    </div>`;
  const svg = $('.staff', body), needle = $('.needle', body), info = $('.heardp', body);
  const listener = createPitchListener(onPitch);
  cleanup.push(() => listener.stop());

  const progress = () => {
    $('.bar i', body).style.width = Math.round(100 * (pos - 1) / N) + '%';
    $('.ptext', body).textContent = `Nota ${Math.min(pos, N)} / ${N} · başarılı ${ok}`;
  };
  const start = () => { deck = buildDeck(pool, N); pos = 0; ok = 0; skipped = 0; devs = []; $('.passed-banner', body).hidden = true; next(); };
  const next = () => {
    if (pos >= deck.length) return finish();
    q = deck[pos++].note; hold = 0; hist = []; locked = false;
    renderStaff(svg, [q], { width: staffWidth() });
    $('.hold i', body).style.width = '0%';
    info.innerHTML = listener.running ? 'Söyle…' : '🎤 Başla’ya bas, sonra notayı söyle.';
    progress();
  };
  const succeed = (dev) => {
    locked = true; ok++; devs.push(Math.abs(dev));
    store.recordAnswer(keyOf(q), true);
    muteUntil = performance.now() + 400;
    blip(true);
    renderStaff(svg, [{ ...q, label: noteName(q), cls: 'ok' }], { width: staffWidth() });
    info.innerHTML = `✓ <b class="big">${noteName(q)}</b> <span class="muted">${dev > 0 ? '+' : ''}${Math.round(dev)} sent</span>`;
    later(next, 1100);
  };
  const finish = () => {
    listener.stop(); updateMicBtn();
    const avg = devs.length ? Math.round(devs.reduce((a, b) => a + b, 0) / devs.length) : 0;
    const pct = Math.round(100 * ok / N);
    store.setBest(`solfej-${L.id}`, pct);
    const b = $('.passed-banner', body);
    b.hidden = false;
    b.innerHTML = `<div class="pb-card"><div class="pb-emoji">${pct >= 80 ? '🎶' : '💪'}</div>
      <h3>${N} notada ${ok} başarılı</h3>
      <p>${ok ? `Ortalama sapman: <b>${avg} sent</b>. ` : ''}${pct >= 80 ? 'Kulağın ve sesin uyumlu, harika!' : 'Önce 🔊 Dinle ile notayı duyup sonra söylemeyi dene.'}</p>
      <div class="row-btns"><button class="primary-btn again">Tekrar</button></div></div>`;
    $('.again', b).addEventListener('click', start);
  };

  function onPitch({ freq, clarity }) {
    if (locked || !q || performance.now() < muteUntil) return;
    if (!freq || clarity < 0.8) {
      hist = []; hold = Math.max(0, hold - 25);
      needle.hidden = true;
      $('.hold i', body).style.width = Math.round(100 * hold / 700) + '%';
      return;
    }
    const c = 1200 * Math.log2(freq / 440) + A4_CENTS;
    hist.push(c); if (hist.length > 5) hist.shift();
    const med = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
    let dev = med - q.cents;
    if (octaveFree) dev = ((((dev + 600) % 1200) + 1200) % 1200) - 600;
    needle.hidden = false;
    const shown = Math.max(-48, Math.min(48, dev));
    needle.style.left = (50 + shown) + '%';
    const inTol = Math.abs(dev) <= tol;
    needle.classList.toggle('good', inTol);
    const near = allowKoma ? spell(med) : spell(Math.round(med / 100) * 100);
    const nearDev = med - (allowKoma ? near.cents : Math.round(med / 100) * 100);
    info.innerHTML = `Duyulan: <b>${noteName(near)}</b> <span class="muted">${Math.round(freq)} Hz</span> · ` +
      (Math.abs(dev) > 50 ? `<span class="muted">hedeften uzak</span>` : `<span class="${inTol ? 'okc' : 'muted'}">${dev > 0 ? '+' : ''}${Math.round(dev)} sent ${inTol ? '✓' : dev > 0 ? '(biraz tiz)' : '(biraz pes)'}</span>`);
    void nearDev;
    hold = inTol ? hold + 50 : Math.max(0, hold - 25);
    $('.hold i', body).style.width = Math.min(100, Math.round(100 * hold / 700)) + '%';
    if (hold >= 700) succeed(dev);
  }

  const updateMicBtn = () => { $('.micp', body).textContent = listener.running ? '⏹ Durdur' : '🎤 Başla'; };
  $('.micp', body).addEventListener('click', async () => {
    if (listener.running) { listener.stop(); needle.hidden = true; updateMicBtn(); info.innerHTML = 'Durduruldu.'; return; }
    try { await listener.start(); updateMicBtn(); info.innerHTML = 'Söyle…'; }
    catch (e) { info.innerHTML = (e && e.name === 'NotAllowedError') ? 'Mikrofon izni verilmedi.' : 'Mikrofon açılamadı.'; }
  });
  $('.listen', body).addEventListener('click', () => { if (!q) return; muteUntil = performance.now() + 2000; hist = []; playCents(q.cents); });
  $('.skip', body).addEventListener('click', () => { if (locked) return; store.recordAnswer(keyOf(q), false); skipped++; next(); });
  start();
}

// ------------------------------------------------------------- yönlendirme
function route() {
  cleanup.forEach(f => f()); cleanup = [];
  voiceHandler = null;
  if (speech.listening) speech.stop();
  window.scrollTo(0, 0);
  const h = location.hash.slice(1);
  if (h === 'serbest') {
    const body = lessonShell({ id: '∞', title: 'Serbest porte', intro: true }, '');
    $('.lv-badge').textContent = '♪';
    const pool = [...ALL_NATURALS];
    LEVELS.forEach(L => L.accidentals && L.newNotes.forEach(x => pool.push(x)));
    renderPractice(body, { pool, letters: [0, 1, 2, 3, 4, 5, 6], accs: ['b', 'b2', '', '#2', '#'], title: 'Porteye dokun ya da bir nota seç/söyle: yeri ve sesi gösterilir.' });
    return;
  }
  const m = h.match(/^seviye-(\d+)(?:-(alistir|sinav|koy|solfej))?$/);
  if (!m) return renderHome();
  const id = +m[1], tab = m[2] || 'ogren';
  const L = LEVELS.find(x => x.id === id);
  if (!L || id > store.getUnlocked()) { location.hash = ''; return; }
  const body = lessonShell(L, tab);
  if (tab === 'ogren' || L.intro) return renderLearn(L, body);
  if (tab === 'alistir') {
    const pool = levelPool(id).map(p => p.note);
    const letters = [...new Set(pool.map(p => p.letter))].sort((a, b) => a - b);
    const accs = L.accidentals ? ['b', 'b2', '', '#2', '#'].filter(a => a === '' || pool.some(p => p.acc === a)) : [''];
    const names = [...new Set(pool.map(p => noteName(p)))].join(', ');
    return renderPractice(body, { pool, letters, accs, title: `Bu seviyenin notaları: <b>${names}</b>. Porteye dokun ya da bir notayı seç/söyle. Hazır olunca <b>Sınav</b>’a geç.` });
  }
  if (tab === 'solfej') return renderSolfej(L, body);
  if (tab === 'koy' && !L.accidentals) return renderTest(L, body, 'koy');
  return renderTest(L, body, 'oku');
}
window.addEventListener('hashchange', route);

// ------------------------------------------------------------- ayarlar
const drawer = $('#settings');
$('#settings-btn').addEventListener('click', () => drawer.classList.toggle('open'));
$('#settings-close').addEventListener('click', () => drawer.classList.remove('open'));
$('#set-sound').checked = store.getSettings().sound;
$('#set-tol').value = String(store.getSettings().solfTol || 25);
$('#set-tol').addEventListener('change', (e) => { store.setSetting('solfTol', +e.target.value); });
$('#set-oct').checked = store.getSettings().solfOct !== false;
$('#set-oct').addEventListener('change', (e) => { store.setSetting('solfOct', e.target.checked); });
$('#set-sens').value = store.getSettings().sens || 'yuksek';
$('#set-sens').addEventListener('change', (e) => { store.setSetting('sens', e.target.value); speech.setSensitivity(e.target.value); });
$('#set-sound').addEventListener('change', (e) => { store.setSetting('sound', e.target.checked); setSoundEnabled(e.target.checked); });
$('#unlock-all').addEventListener('click', () => { store.unlockAll(LEVELS.length - 1); drawer.classList.remove('open'); route(); });
let resetArmed = false;
$('#reset-all').addEventListener('click', (e) => {
  if (!resetArmed) { resetArmed = true; e.target.textContent = 'Emin misin? Tekrar dokun'; setTimeout(() => { resetArmed = false; e.target.textContent = 'İlerlemeyi sıfırla'; }, 3000); return; }
  store.resetAll(); resetArmed = false; e.target.textContent = 'İlerlemeyi sıfırla'; drawer.classList.remove('open'); location.hash = ''; route();
});
$('.brand').addEventListener('click', () => location.hash = '');

route();

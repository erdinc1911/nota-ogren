import { LETTERS, ACCIDENTALS, makeNote, noteName, noteLongName, parseSpokenNote } from './theory.js';
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
        <span class="heard">${speech.available ? '' : speech.reason}</span>
      </div>
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
  const tabs = L.intro ? [] : [['ogren', 'Öğren'], ['alistir', 'Alıştır'], ['sinav', 'Sınav']];
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

// ---- Sınav
function renderTest(L, body) {
  const pool = levelPool(L.id);
  const letters = [...new Set(pool.map(p => p.note.letter))].sort((a, b) => a - b);
  const accs = L.accidentals ? [...new Set(['', ...pool.map(p => p.note.acc)])].sort((a, b) => ['b', 'b2', '', '#2', '#'].indexOf(a) - ['b', 'b2', '', '#2', '#'].indexOf(b)) : [''];
  const canPlace = !L.accidentals;
  let streak = 0, q = null, type = 'oku', locked = false, lastKey = null, total = 0, ok = 0;

  body.innerHTML = `
    <div class="test">
      <div class="progress"><div class="bar"><i></i></div><span class="ptext"></span></div>
      <div class="staff-box"><svg class="staff"></svg></div>
      <p class="prompt"></p>
      <div class="feedback" aria-live="polite"></div>
      <div class="row-btns"><button class="ghost-btn listen">🔊 Dinle</button><button class="primary-btn next" hidden>Devam →</button></div>
      ${padHTML({ letters, accs })}
      <div class="passed-banner" hidden></div>
    </div>`;
  const svg = $('.staff', body);
  const pad = $('.pad', body);
  const progress = () => {
    const pct = Math.min(100, Math.round(100 * streak / L.target));
    $('.bar i', body).style.width = pct + '%';
    $('.ptext', body).textContent = `Üst üste ${streak} / ${L.target} doğru` + (store.getBest(L.id) ? ` · en iyi ${store.getBest(L.id)}` : '');
  };
  const pick = () => {
    // aynı nota art arda gelebilir ama daha az olası (yoksa 2 notada sıra ezberlenir)
    const items = pool;
    const w = items.map(p => p.weight * (1 + 2 * store.getMiss(keyOf(p.note))) * (keyOf(p.note) === lastKey ? 0.35 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < items.length; k++) { r -= w[k]; if (r <= 0) return items[k].note; }
    return items[items.length - 1].note;
  };
  const next = () => {
    locked = false;
    q = pick(); lastKey = keyOf(q);
    type = canPlace && Math.random() < 0.3 ? 'koy' : 'oku';
    $('.feedback', body).innerHTML = ''; $('.feedback', body).className = 'feedback';
    $('.next', body).hidden = true;
    $('.listen', body).hidden = type === 'koy';
    if (type === 'oku') {
      renderStaff(svg, [q], { width: staffWidth() });
      $('.prompt', body).innerHTML = 'Bu nota hangisi?';
      pad.hidden = false;
      svg.parentElement.classList.remove('tap');
    } else {
      renderStaff(svg, [], { width: staffWidth() });
      $('.prompt', body).innerHTML = `<b>${noteName(q)}</b> notasını porteye koy <span class="muted">(doğru çizgiye ya da aralığa dokun)</span>`;
      pad.hidden = true;
      svg.parentElement.classList.add('tap');
    }
    progress();
  };
  const finish = (good, givenText, givenNote) => {
    locked = true; total++;
    if (good) { ok++; streak++; } else streak = 0;
    store.recordAnswer(keyOf(q), good);
    store.setBest(L.id, streak);
    blip(good);
    later(() => playCents(q.cents), 150);
    const notes = [{ ...q, label: noteName(q), cls: good ? 'ok' : 'okq' }];
    if (givenNote && !good) notes.unshift({ ...givenNote, label: 'sen', cls: 'bad' });
    renderStaff(svg, notes, { width: staffWidth(), highlight: [q.step] });
    const fb = $('.feedback', body);
    fb.className = 'feedback ' + (good ? 'good' : 'bad');
    fb.innerHTML = good
      ? `✓ Doğru! <b class="big">${noteName(q)}</b> <span class="muted">${placeName(q.step)}</span>`
      : `✗ ${givenText} değil. Bu <b class="big">${noteName(q)}</b> <span class="muted">— ${placeName(q.step)}</span>`;
    progress();
    if (streak === L.target) { store.pass(L.id); showPassed(); return; }
    if (good) later(next, 1000);
    else $('.next', body).hidden = false;
  };
  const showPassed = () => {
    const nextL = LEVELS.find(x => x.id === L.id + 1);
    const b = $('.passed-banner', body);
    b.hidden = false;
    b.innerHTML = `<div class="pb-card"><div class="pb-emoji">🎉</div><h3>Seviye ${L.id} tamam!</h3>
      <p>${L.target} doğru üst üste. ${nextL ? `<b>Seviye ${nextL.id}: ${nextL.title}</b> açıldı.` : 'Bütün seviyeleri bitirdin!'}</p>
      <div class="row-btns">${nextL ? `<button class="primary-btn go-next">Seviye ${nextL.id}${yonelme(nextL.id)} geç →</button>` : ''}<button class="ghost-btn keep">Burada devam et</button></div></div>`;
    if (nextL) $('.go-next', b).addEventListener('click', () => location.hash = `seviye-${nextL.id}`);
    $('.keep', b).addEventListener('click', () => { b.hidden = true; streak = 0; next(); });
  };
  bindPad(body, (letter, acc) => {
    if (locked || type !== 'oku') return;
    const good = letter === q.letter && acc === q.acc;
    finish(good, LETTERS[letter] + ACCIDENTALS[acc].label);
  });
  voiceHandler = (letter, acc) => {
    if (locked) { if (!$('.next', body).hidden) next(); return; }
    if (type !== 'oku') return;
    const a = accs.includes(acc) ? acc : '';
    finish(letter === q.letter && a === q.acc, LETTERS[letter] + ACCIDENTALS[a].label);
  };
  onStaffTap(svg, (step) => {
    if (locked || type !== 'koy') return;
    if (step < 26 || step > 42) return;
    const given = noteFromStep(step);
    finish(given.letter === q.letter, `${noteName(given)} (${placeName(step)})`, given);
  });
  $('.next', body).addEventListener('click', next);
  $('.listen', body).addEventListener('click', () => q && playCents(q.cents));
  next();
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
  const m = h.match(/^seviye-(\d+)(?:-(alistir|sinav))?$/);
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
  return renderTest(L, body);
}
window.addEventListener('hashchange', route);

// ------------------------------------------------------------- ayarlar
const drawer = $('#settings');
$('#settings-btn').addEventListener('click', () => drawer.classList.toggle('open'));
$('#settings-close').addEventListener('click', () => drawer.classList.remove('open'));
$('#set-sound').checked = store.getSettings().sound;
$('#set-sound').addEventListener('change', (e) => { store.setSetting('sound', e.target.checked); setSoundEnabled(e.target.checked); });
$('#unlock-all').addEventListener('click', () => { store.unlockAll(LEVELS.length - 1); drawer.classList.remove('open'); route(); });
let resetArmed = false;
$('#reset-all').addEventListener('click', (e) => {
  if (!resetArmed) { resetArmed = true; e.target.textContent = 'Emin misin? Tekrar dokun'; setTimeout(() => { resetArmed = false; e.target.textContent = 'İlerlemeyi sıfırla'; }, 3000); return; }
  store.resetAll(); resetArmed = false; e.target.textContent = 'İlerlemeyi sıfırla'; drawer.classList.remove('open'); location.hash = ''; route();
});
$('.brand').addEventListener('click', () => location.hash = '');

route();

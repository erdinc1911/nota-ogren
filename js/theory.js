// Nota teorisi: isimlendirme, koma işaretleri (THM numaralı gösterim), frekans.
// Perde yüksekliği "C0'dan itibaren sent" (abs cents) olarak tutulur.

export const LETTERS = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
export const NATURAL_CENTS = [0, 200, 400, 500, 700, 900, 1100];

// Değiştirici işaretler. cents: yaklaşık sapma (eşleştirme için), level: zorluk seviyesi
// level 0 = doğal, 1 = bemol/diyez, 2 = koma (ara ses)
export const ACCIDENTALS = {
  'b':  { key: 'b',  label: '♭',  name: 'bemol',      cents: -100, level: 1, sign: 'flat',  num: null },
  'b2': { key: 'b2', label: '♭2', name: 'bemol 2',    cents: -50,  level: 2, sign: 'flat',  num: 2 },
  '':   { key: '',   label: '',   name: '',           cents: 0,    level: 0, sign: null,    num: null },
  '#2': { key: '#2', label: '♯2', name: 'diyez 2',    cents: 50,   level: 2, sign: 'sharp', num: 2 },
  '#':  { key: '#',  label: '♯',  name: 'diyez',      cents: 100,  level: 1, sign: 'sharp', num: null },
};
export const ACC_ORDER = ['b', 'b2', '', '#2', '#'];

// Yarım ses yazımında tercih (perde sınıfı -> [harf, işaret])
const SEMITONE_SPELLING = { 1: [0, '#'], 3: [2, 'b'], 6: [3, '#'], 8: [4, '#'], 10: [6, 'b'] };

const mod = (a, n) => ((a % n) + n) % n;

/** Bir notayı oluştur: {letter, octave, acc} -> zengin nesne */
export function makeNote(letter, octave, acc = '') {
  const cents = octave * 1200 + NATURAL_CENTS[letter] + ACCIDENTALS[acc].cents;
  return { letter, octave, acc, cents, step: octave * 7 + letter };
}

/** Sent değerinden nota adı türet (en yakın doğal sese göre). */
export function spell(absCents) {
  const pc = mod(absCents, 1200);
  // en yakın doğal sesi bul
  let best = null;
  for (let l = 0; l < 7; l++) {
    for (const shift of [-1200, 0, 1200]) {
      const o = pc - (NATURAL_CENTS[l] + shift);
      if (!best || Math.abs(o) < Math.abs(best.o)) best = { l, o, shift };
    }
  }
  let letter = best.l, acc = '';
  const ao = Math.abs(best.o);
  if (ao <= 25) {
    acc = '';
  } else if (ao <= 75) {
    acc = best.o > 0 ? '#2' : 'b2';
  } else {
    const semi = Math.round(pc / 100) % 12;
    const pref = SEMITONE_SPELLING[semi];
    if (pref) { letter = pref[0]; acc = pref[1]; }
    else { acc = best.o > 0 ? '#' : 'b'; }
  }
  // oktavı hesapla: abs = oct*1200 + nat + accCents (yaklaşık)
  const approx = absCents - NATURAL_CENTS[letter] - ACCIDENTALS[acc].cents;
  const octave = Math.round(approx / 1200);
  return { ...makeNote(letter, octave, acc), cents: absCents };
}

// Halk müziği notalarında yaygın koma sesleri. Diğer ara sesler (ör. Re♭2, Sol♭2)
// sapta görünür ama sorularda kullanılmaz.
const COMMON_KOMA = new Set(['6b2', '2b2', '5b2', '3#2', '0#2']);
export function isCommonNote(n) {
  return ACCIDENTALS[n.acc].level < 2 || COMMON_KOMA.has(n.letter + n.acc);
}

export function noteName(n, { octave = false } = {}) {
  const a = ACCIDENTALS[n.acc];
  return LETTERS[n.letter] + a.label + (octave ? ` ${n.octave}` : '');
}

export function noteLongName(n) {
  const a = ACCIDENTALS[n.acc];
  return a.name ? `${LETTERS[n.letter]} ${a.name}` : LETTERS[n.letter];
}

/** Aynı perde sınıfı mı (oktav önemsiz, ±30 sent tolerans)? */
export function samePitchClass(c1, c2, tol = 30) {
  const d = mod(c1 - c2, 1200);
  return Math.min(d, 1200 - d) <= tol;
}
export function samePitch(c1, c2, tol = 20) { return Math.abs(c1 - c2) <= tol; }

export const A4_CENTS = 4 * 1200 + 900;
export function freq(absCents, a4 = 440) { return a4 * Math.pow(2, (absCents - A4_CENTS) / 1200); }
export function ratioToCents(r) { return 1200 * Math.log2(r); }

/** Cevap anahtarı: harf + işaret -> karşılaştırılabilir sent (oktavsız) */
export function answerCents(letter, acc) { return NATURAL_CENTS[letter] + ACCIDENTALS[acc].cents; }

// ---------- Sesli cevap ayrıştırma ----------
const NOTE_WORDS = [
  [0, ['do', 'doo', 'dö', 'doh', 'dou', 'doe', 'dough', 'toe', 'tho']],
  [1, ['re', 'ree', 'rey', 'ray', 'reh', 'rè', 'rae', 'rei']],
  [2, ['mi', 'mı', 'mii', 'me', 'mee', 'my', 'mie']],
  [3, ['fa', 'faa', 'fah', 'far', 'fha', 'pha', 'va']],
  [4, ['sol', 'soll', 'sool', 'soul', 'sole', 'so', 'saul', 'sold', 'solo', 'sun']],
  [5, ['la', 'laa', 'lah', 'law', 'lar', 'là']],
  [6, ['si', 'sı', 'sii', 'see', 'sea', 'ci', 'si̇', 'c', 'she', 'sı̇']],
];
const FLAT_WORDS = ['bemol', 'bemöl', 'bemo', 'bemole', 'bemoll', 'flat', 'bimol', 'bemul'];
const SHARP_WORDS = ['diyez', 'diez', 'dies', 'diyes', 'diyezi', 'sharp', 'diyaz', 'dyez'];
const KOMA_WORDS = ['koma', 'comma', 'kuma'];
const NUM_WORDS = { 'bir': 1, '1': 1, 'iki': 2, 'ıki': 2, '2': 2, 'two': 2, 'üç': 3, 'uc': 3, 'üc': 3, '3': 3, 'dört': 4, 'dort': 4, '4': 4, 'beş': 5, '5': 5 };

const CANON = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
// Türkçe harfleri sadeleştir, benzer ünsüzleri birleştir (z→s, v→f, t→d)
function phon(w) {
  return w.toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/[öô]/g, 'o').replace(/[üû]/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/[âàá]/g, 'a').replace(/[éèê]/g, 'e').replace(/ğ/g, '').replace(/[^a-z]/g, '')
    .replace(/^z/, 's').replace(/^v/, 'f').replace(/^t/, 'd');
}
function editDist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Kısa bir sözcüğü en yakın nota adına eşle; uzak/uzun sözcüklerde null. */
export function fuzzyNote(token) {
  const w = phon(token);
  if (w.length < 1 || w.length > 4) return null;
  let best = null, bestD = 99;
  CANON.forEach((c, l) => {
    if (c[0] !== w[0]) return;
    const dd = editDist(w, c);
    if (dd < bestD) { bestD = dd; best = l; }
  });
  if (bestD <= 1) return best;
  // tanıyıcı kısa "la"yı çoğu zaman "ala", "hala", "yala" gibi yazar
  if (/^[a-z]?[a-z]?la+$/.test(w)) return 5;
  return null;
}

/** Konuşma metnini {letter, acc} cevabına çevir; anlaşılmazsa null. */
export function parseSpokenNote(text) {
  if (!text) return null;
  let t = text.toLocaleLowerCase('tr-TR')
    .replace(/♭/g, ' bemol ').replace(/[♯#]/g, ' diyez ')
    .replace(/[.,!?;:"()’'`]/g, ' ');
  const tokens = t.split(/\s+/).filter(Boolean);
  // Söylenen SON notayı al (tanıyıcı önceki sözcüğü de gönderebilir: "fa sol" -> Sol)
  let letter = null, idx = -1;
  for (let i = tokens.length - 1; i >= 0 && letter === null; i--) {
    for (const [l, words] of NOTE_WORDS) {
      if (words.includes(tokens[i])) { letter = l; idx = i; break; }
    }
  }
  if (letter === null) {
    // bitişik yazımlar: "sibemol", "fadiyez"
    for (const tok of tokens) {
      for (const [l, words] of NOTE_WORDS) {
        const w = words.find(w => w.length >= 2 && tok.startsWith(w) &&
          (FLAT_WORDS.concat(SHARP_WORDS).some(a => tok.slice(w.length).startsWith(a))));
        if (w) { letter = l; tokens.splice(tokens.indexOf(tok), 1, w, tok.slice(w.length)); idx = tokens.indexOf(w); break; }
      }
      if (letter !== null) break;
    }
  }
  if (letter === null) {
    // Yakın söyleyişler: kısa sözcük, nota adıyla aynı sesle başlıyor ve en fazla 1 harf farklı
    for (let i = tokens.length - 1; i >= 0 && letter === null; i--) {
      const l = fuzzyNote(tokens[i]);
      if (l !== null) { letter = l; idx = i; }
    }
  }
  if (letter === null) return null;
  const rest = tokens.slice(idx + 1);
  let dir = 0, num = null, koma = false;
  for (const tok of rest) {
    if (FLAT_WORDS.some(w => tok.startsWith(w))) dir = -1;
    else if (SHARP_WORDS.some(w => tok.startsWith(w))) dir = 1;
    else if (KOMA_WORDS.includes(tok)) koma = true;
    else if (tok in NUM_WORDS) num = NUM_WORDS[tok];
  }
  let acc = '';
  if (dir !== 0) {
    const isKoma = koma || (num !== null && num <= 3);
    acc = (dir < 0 ? 'b' : '#') + (isKoma ? '2' : '');
  }
  return { letter, acc };
}

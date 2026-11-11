// Enstrüman tanımları. Yeni bir saz (uzun sap, cura, divan) eklemek için
// buraya bir nesne eklemek yeterli; arayüz bu veriden çizilir.
import { ratioToCents, spell, makeNote } from './theory.js';

// Bağlama perde oranları – bir oktav (17 perde), açık tele göre.
// Kaynak: O. Öztürk'ün bağlama perde dizisi (Wikipedia "Bağlama" maddesinde aktarılan oranlar).
const BAGLAMA_OCTAVE = [
  18 / 17, 12 / 11, 9 / 8, 81 / 68, 27 / 22, 81 / 64, 4 / 3, 24 / 17,
  16 / 11, 3 / 2, 27 / 17, 18 / 11, 27 / 16, 16 / 9, 32 / 17, 64 / 33, 2,
];

function buildFrets(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const oct = Math.floor(i / BAGLAMA_OCTAVE.length);
    const r = BAGLAMA_OCTAVE[i % BAGLAMA_OCTAVE.length] * Math.pow(2, oct);
    const cents = ratioToCents(r);
    const off = ((cents % 100) + 100) % 100;
    out.push({ n: i + 1, ratio: r, cents, isKoma: off > 25 && off < 75 });
  }
  return out;
}

// Teller: yazılı (notadaki) açık tel sesleri. Ekranda yukarıdan aşağıya: üst, orta, alt.
// Kısa sap bağlama düzeni: üst tel La, orta tel Sol, alt tel Re.
export const DUZENLER = {
  baglama: {
    id: 'baglama', name: 'Bağlama düzeni (üst La – orta Sol – alt Re)',
    strings: [
      { id: 'ust',  name: 'Üst tel',  open: makeNote(5, 4) }, // La4
      { id: 'orta', name: 'Orta tel', open: makeNote(4, 4) }, // Sol4
      { id: 'alt',  name: 'Alt tel',  open: makeNote(1, 4) }, // Re4
    ],
  },
  // İleride: bozuk (kara) düzen, misket, abdal ... uzun sap için eklenecek.
};

export const INSTRUMENTS = {
  kisa: {
    id: 'kisa', name: 'Kısa sap bağlama',
    defaultFrets: 19, minFrets: 17, maxFrets: 23,
    duzenler: ['baglama'],
  },
  // uzun: { id:'uzun', name:'Uzun sap bağlama', defaultFrets: 23, ... duzenler:['bozuk','baglama'] }
};

/** Seçili enstrüman + düzen + perde sayısı için tüm konumları üret. */
export function buildBoard(instId, duzenId, fretCount) {
  const inst = INSTRUMENTS[instId];
  const duzen = DUZENLER[duzenId];
  const frets = buildFrets(fretCount);
  const positions = [];
  duzen.strings.forEach((s, si) => {
    positions.push(mkPos(si, s, 0, 0, false));
    frets.forEach(f => positions.push(mkPos(si, s, f.n, f.cents, f.isKoma)));
  });
  return { inst, duzen, frets, positions };
}

function mkPos(si, s, fret, fretCents, isKoma) {
  const cents = s.open.cents + fretCents;
  return { stringIndex: si, stringId: s.id, stringName: s.name, fret, isKoma, cents, note: spell(cents) };
}

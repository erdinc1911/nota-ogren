// Seviyeler ve ders içerikleri. Yeni seviye eklemek için LEVELS'a bir nesne eklemek yeterli.
import { makeNote } from './theory.js';

// kısa yardımcılar (yazılı yükseklik): n(harf, oktav, işaret)
const n = (l, o, a = '') => makeNote(l, o, a);
const DO4 = n(0, 4), RE4 = n(1, 4), MI4 = n(2, 4), FA4 = n(3, 4), SOL4 = n(4, 4), LA4 = n(5, 4), SI4 = n(6, 4);
const DO5 = n(0, 5), RE5 = n(1, 5), MI5 = n(2, 5), FA5 = n(3, 5), SOL5 = n(4, 5), LA5 = n(5, 5);
const NATURALS = [DO4, RE4, MI4, FA4, SOL4, LA4, SI4, DO5, RE5, MI5, FA5, SOL5, LA5];

// Slayt: { title, text (HTML), staff: { notes:[{note, label}], highlight:[step], clefGlow, numbers }, play:[note...] }
const N = (note, label = true) => ({ note, label });

export const LEVELS = [
  {
    id: 0, title: 'Temel bilgi', subtitle: 'Porte, sol anahtarı, notaların sırası',
    intro: true,
    slides: [
      { title: 'Porte',
        text: 'Notalar <b>beş yatay çizginin</b> üzerine yazılır. Bu beş çizgiye <b>porte</b> denir. Çizgiler <b>alttan yukarı</b> sayılır: en alttaki 1. çizgi, en üstteki 5. çizgidir.',
        staff: { notes: [], numbers: true } },
      { title: 'Çizgi ve aralık',
        text: 'Bir nota ya bir <b>çizginin üzerinde</b> durur (çizgi notanın ortasından geçer) ya da iki çizginin arasındaki <b>aralıkta</b> durur. Beş çizginin arasında <b>dört aralık</b> vardır.',
        staff: { notes: [{ note: SOL4, label: 'çizgide' }, { note: LA4, label: 'aralıkta' }], numbers: true } },
      { title: 'Sol anahtarı',
        text: 'Portenin başındaki işarete <b>sol anahtarı</b> denir. Kıvrımı <b>2. çizgiyi</b> sarar ve “bu çizgideki nota <b>Sol</b>’dür” der. Diğer bütün notalar Sol’e göre bulunur. Bağlama notaları da sol anahtarıyla yazılır.',
        staff: { notes: [N(SOL4)], highlight: [SOL4.step], clefGlow: true, numbers: true }, play: [SOL4] },
      { title: 'Notalar basamak basamak dizilir',
        text: 'Çizgi, aralık, çizgi, aralık… Her basamak bir sonraki notadır: <b>Do Re Mi Fa Sol La Si</b>, sonra yeniden <b>Do</b>. Nota yukarı çıktıkça ses <b>incelir</b>. ▶ ile dinle.',
        staff: { notes: [DO4, RE4, MI4, FA4, SOL4, LA4, SI4, DO5].map(x => N(x)) },
        play: [DO4, RE4, MI4, FA4, SOL4, LA4, SI4, DO5] },
      { title: 'Ek çizgi',
        text: 'Porteye sığmayan notalar için notanın yanına <b>kısa ek çizgiler</b> çizilir. Örneğin alttaki <b>Do</b> kendi ek çizgisinin üzerindedir; üstteki <b>La</b> da öyle.',
        staff: { notes: [N(DO4), N(LA5)] } },
      { title: 'Nasıl çalışacağız?',
        text: 'Her seviyede önce yeni notaları <b>öğreneceksin</b>, sonra <b>Alıştır</b> bölümünde porteye dokunarak ya da notayı söyleyerek istediğin kadar deneyeceksin. Hazır olunca <b>Sınav</b>’a gir: 20–40 soruluk sınavda <b>%90</b> ve üstü doğru yapınca sonraki seviye açılır. <b>Porteye koy</b> bölümünde de notaları porteye yerleştirerek çalışabilirsin.',
        staff: { notes: [N(SOL4), N(LA4)] } },
    ],
  },
  {
    id: 1, title: 'Sol ve La', subtitle: 'İlk iki nota', newNotes: [SOL4, LA4], questions: 20,
    slides: [
      { title: 'Sol – 2. çizgi',
        text: 'Sol anahtarının sardığı <b>2. çizgi</b> Sol’dür. Bağlamada <b>orta tel boşta</b> Sol sesini verir.',
        staff: { notes: [N(SOL4)], highlight: [SOL4.step], clefGlow: true, numbers: true }, play: [SOL4] },
      { title: 'La – 2. aralık',
        text: 'Sol’ün bir basamak üstü, yani <b>2. ve 3. çizgi arasındaki aralık</b> La’dır. Bağlamada <b>üst tel boşta</b> La sesini verir.',
        staff: { notes: [N(SOL4), N(LA4)], highlight: [LA4.step], numbers: true }, play: [SOL4, LA4] },
      { title: 'Ayırt etme ipucu',
        text: 'Çizgi notanın <b>ortasından geçiyorsa Sol</b>, nota iki çizginin <b>arasına sıkışmışsa La</b>.',
        staff: { notes: [N(SOL4), N(LA4), N(SOL4), N(LA4)] } },
    ],
  },
  {
    id: 2, title: 'Si', subtitle: 'Portenin ortası', newNotes: [SI4], questions: 24,
    slides: [
      { title: 'Si – 3. çizgi',
        text: 'La’nın bir basamak üstü <b>3. çizgi</b>, yani portenin <b>tam ortasındaki çizgi</b> Si’dir.',
        staff: { notes: [N(SOL4), N(LA4), N(SI4)], highlight: [SI4.step], numbers: true }, play: [SOL4, LA4, SI4] },
      { title: 'Sol ve Si ikisi de çizgide',
        text: 'Sol 2. çizgide, Si 3. çizgide. Aralarında, aralıkta La var. <b>Çizgi – aralık – çizgi</b>.',
        staff: { notes: [N(SOL4), N(LA4), N(SI4)], highlight: [SOL4.step, SI4.step] } },
    ],
  },
  {
    id: 3, title: 'Fa ve Mi', subtitle: 'Portenin altı', newNotes: [FA4, MI4], questions: 30,
    slides: [
      { title: 'Fa – 1. aralık',
        text: 'Sol’ün bir basamak altı, <b>1. ve 2. çizgi arasındaki aralık</b> Fa’dır.',
        staff: { notes: [N(FA4), N(SOL4)], highlight: [FA4.step], numbers: true }, play: [FA4, SOL4] },
      { title: 'Mi – 1. çizgi',
        text: 'En alttaki <b>1. çizgi</b> Mi’dir.',
        staff: { notes: [N(MI4), N(FA4), N(SOL4)], highlight: [MI4.step], numbers: true }, play: [MI4, FA4, SOL4] },
      { title: 'Çizgilerdeki notalar',
        text: 'Şimdiye kadar çizgilerde: <b>Mi (1), Sol (2), Si (3)</b>. Aralıklarda: <b>Fa, La</b>. Hepsini sırayla dinle.',
        staff: { notes: [MI4, FA4, SOL4, LA4, SI4].map(x => N(x)) }, play: [MI4, FA4, SOL4, LA4, SI4] },
    ],
  },
  {
    id: 4, title: 'Re ve Do', subtitle: 'Portenin altına iniyoruz', newNotes: [RE4, DO4], questions: 30,
    slides: [
      { title: 'Re – portenin hemen altı',
        text: 'Mi’nin bir basamak altı Re’dir: nota <b>1. çizginin altına asılır</b>. Bağlamada <b>alt tel boşta</b> Re sesini verir.',
        staff: { notes: [N(RE4), N(MI4)], highlight: [RE4.step] }, play: [RE4, MI4] },
      { title: 'Do – alttaki ek çizgi',
        text: 'Re’nin altı Do’dur. Porteye sığmadığı için <b>kendi kısa ek çizgisinin</b> üzerine yazılır.',
        staff: { notes: [N(DO4), N(RE4), N(MI4)] }, play: [DO4, RE4, MI4] },
      { title: 'Bir oktav tamam',
        text: 'Do’dan Si’ye yedi notanın hepsini öğrendin: <b>Do Re Mi Fa Sol La Si</b>.',
        staff: { notes: [DO4, RE4, MI4, FA4, SOL4, LA4, SI4].map(x => N(x)) }, play: [DO4, RE4, MI4, FA4, SOL4, LA4, SI4] },
    ],
  },
  {
    id: 5, title: 'Üstteki Do ve Re', subtitle: 'İkinci oktava geçiş', newNotes: [DO5, RE5], questions: 30,
    slides: [
      { title: 'Do – 3. aralık',
        text: 'Si’nin bir basamak üstü yeniden <b>Do</b>’dur: <b>3. aralıkta</b> durur. Alttaki Do’dan 8 basamak yukarıdadır; buna <b>oktav</b> denir. Aynı isim, daha ince ses.',
        staff: { notes: [N(DO4), N(DO5)], highlight: [DO5.step], numbers: true }, play: [DO4, DO5] },
      { title: 'Re – 4. çizgi',
        text: 'Do’nun üstü <b>4. çizgi</b> Re’dir.',
        staff: { notes: [N(SI4), N(DO5), N(RE5)], highlight: [RE5.step], numbers: true }, play: [SI4, DO5, RE5] },
    ],
  },
  {
    id: 6, title: 'Üstteki Mi ve Fa', subtitle: 'Portenin tepesi', newNotes: [MI5, FA5], questions: 30,
    slides: [
      { title: 'Mi – 4. aralık, Fa – 5. çizgi',
        text: 'Re’nin üstü <b>4. aralıkta Mi</b>, en üstteki <b>5. çizgide Fa</b>.',
        staff: { notes: [N(RE5), N(MI5), N(FA5)], highlight: [MI5.step, FA5.step], numbers: true }, play: [RE5, MI5, FA5] },
      { title: 'Hafıza ipucu',
        text: 'Beş çizgi alttan yukarı: <b>Mi – Sol – Si – Re – Fa</b>.<br>Dört aralık alttan yukarı: <b>Fa – La – Do – Mi</b>.',
        staff: { notes: [MI4, SOL4, SI4, RE5, FA5].map(x => N(x)), highlight: [MI4.step, SOL4.step, SI4.step, RE5.step, FA5.step] } },
      { title: 'Aralıklar',
        text: 'Aralıklardaki notalar: <b>Fa – La – Do – Mi</b>.',
        staff: { notes: [FA4, LA4, DO5, MI5].map(x => N(x)), highlight: [FA4.step, LA4.step, DO5.step, MI5.step] } },
    ],
  },
  {
    id: 7, title: 'Üstteki Sol ve La', subtitle: 'Üst ek çizgi', newNotes: [SOL5, LA5], questions: 30,
    slides: [
      { title: 'Sol – portenin hemen üstü',
        text: 'Fa’nın üstü Sol’dür: nota <b>5. çizginin üstüne oturur</b>.',
        staff: { notes: [N(FA5), N(SOL5)], highlight: [SOL5.step] }, play: [FA5, SOL5] },
      { title: 'La – üstteki ek çizgi',
        text: 'Sol’ün üstü La’dır: <b>üstteki ilk ek çizginin</b> üzerine yazılır.',
        staff: { notes: [N(FA5), N(SOL5), N(LA5)] }, play: [FA5, SOL5, LA5] },
    ],
  },
  {
    id: 8, title: 'Hepsi bir arada', subtitle: 'Tüm porte, karışık', newNotes: [], questions: 40,
    slides: [
      { title: 'Tekrar zamanı',
        text: 'Alttaki Do’dan üstteki La’ya kadar bütün notalar karışık sorulacak. Sınav 40 soru; geçmek için <b>%90 doğru</b>.',
        staff: { notes: NATURALS.map(x => ({ note: x, label: false })) } },
    ],
  },
  {
    id: 9, title: 'Diyez ve bemol', subtitle: '♯ inceltir, ♭ kalınlaştırır', newNotes: [n(3, 4, '#'), n(6, 4, 'b'), n(0, 5, '#'), n(2, 5, 'b')], questions: 30, accidentals: true,
    slides: [
      { title: 'Değiştirici işaretler',
        text: '<b>♯ (diyez)</b> notanın sesini yarım ses <b>inceltir</b>. <b>♭ (bemol)</b> yarım ses <b>kalınlaştırır</b>. İşaret, notanın <b>soluna, aynı çizgi ya da aralığa</b> yazılır. Notanın adı değişmez: “Fa diyez”, “Si bemol”.',
        staff: { notes: [N(FA4), N(n(3, 4, '#')), N(SI4), N(n(6, 4, 'b'))] }, play: [FA4, n(3, 4, '#'), SI4, n(6, 4, 'b')] },
      { title: 'Nasıl cevaplanır?',
        text: 'Önce işareti (♯ ya da ♭), sonra notayı seç. Ya da söyle: <b>“fa diyez”</b>, <b>“si bemol”</b>.',
        staff: { notes: [N(n(0, 5, '#')), N(n(2, 5, 'b'))] } },
    ],
  },
  {
    id: 10, title: 'Koma sesleri', subtitle: 'Türk müziğinin ara sesleri', newNotes: [n(6, 4, 'b2'), n(2, 5, 'b2'), n(3, 4, '#2'), n(0, 5, '#2'), n(5, 4, 'b2')], questions: 30, accidentals: true,
    slides: [
      { title: 'Yarım sesten küçük aralıklar',
        text: 'Türk müziğinde yarım sesten daha küçük aralıklar da kullanılır. Halk müziği notalarında işaretin yanındaki <b>sayı</b>, sesin yaklaşık <b>kaç koma</b> değiştiğini gösterir. <b>Si♭2</b> (“si bemol iki”), Si’den biraz kalın ama Si♭’den incedir.',
        staff: { notes: [N(SI4), N(n(6, 4, 'b2')), N(n(6, 4, 'b'))] }, play: [SI4, n(6, 4, 'b2'), n(6, 4, 'b')] },
      { title: 'Sık görülen koma sesleri',
        text: 'Bağlamada sık kullanılanlar: <b>Si♭2, Mi♭2, La♭2, Fa♯2, Do♯2</b>. Söylerken: “mi bemol iki”, “fa diyez iki”.',
        staff: { notes: [n(5, 4, 'b2'), n(6, 4, 'b2'), n(3, 4, '#2'), n(0, 5, '#2'), n(2, 5, 'b2')].map(x => N(x)) } },
    ],
  },
];

/** Bir seviyenin soru havuzu: önceki tüm notalar + yenileri (yeniler ağırlıklı). */
export function levelPool(levelId) {
  const pool = [];
  for (const L of LEVELS) {
    if (L.id > levelId || !L.newNotes) continue;
    const isNew = L.id === levelId;
    L.newNotes.forEach(note => pool.push({ note, weight: isNew ? 3 : 1 }));
  }
  if (levelId === 8) pool.forEach(p => p.weight = 1);
  return pool;
}

export const ALL_NATURALS = NATURALS;

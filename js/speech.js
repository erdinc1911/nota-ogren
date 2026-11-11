// Sesle cevap verme. Altyapılar (öncelik sırasıyla):
//  1) Claude artifact "dictation" yeteneği (sayfa claude.ai içinde açıldıysa)
//  2) Vosk – cihazda çalışan Türkçe ses tanıma (WebAssembly). Her tarayıcıda (Brave dahil)
//     çalışır; yalnızca nota sözcüklerini dinler. İlk kullanımda ~35 MB model indirilir.
//  3) Tarayıcının Web Speech API'si (Vosk yüklenemezse yedek)
// Arayüz: { available, kind, listening, reason, start(), stop(), onText(cb), onState(cb) }

const VOSK_JS = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const VOSK_MODEL = 'model/vosk-tr.tar.gz';
const NOTES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
// Modelin sözlüğünde "diyez" yok; en yakın sözcük "diyet" (theory.js bunu diyez sayar)
const PHRASES = [
  ...NOTES,
  ...NOTES.flatMap(n => [`${n} bemol`, `${n} bemol iki`, `${n} koma bemol`, `${n} diyet`, `${n} diyet iki`]),
];
// Normal: anlaşılmayan sesler [unk] olur (gürültüye dayanıklı).
// Yüksek: [unk] yok; konuşma en yakın notaya eşlenir (kısık/kısa söyleyişi daha kolay yakalar).
const grammarFor = (sens) => JSON.stringify(sens === 'normal' ? [...PHRASES, '[unk]'] : PHRASES);

const STABLE_MS = 300;
const MODS = ['bemol', 'koma', 'diyet', 'iki'];
/** "sol la si bemol iki" -> ["sol", "la", "si bemol iki"] */
function noteGroups(text) {
  const out = [];
  for (const tok of text.replace(/\[unk\]/g, ' ').split(/\s+/).filter(Boolean)) {
    if (NOTES.includes(tok)) out.push(tok);
    else if (MODS.includes(tok) && out.length) out[out.length - 1] += ' ' + tok;
  }
  return out;
}

export function createSpeech() {
  const textCbs = [], stateCbs = [], levelCbs = [];
  const api = {
    available: false, kind: null, listening: false, reason: '', pushToTalk: false,
    sensitivity: 'yuksek',
    setSensitivity(v) { api.sensitivity = v; if (api.listening && api.kind === 'vosk') { voskStop(true); voskStart(); } },
    onLevel(cb) { levelCbs.push(cb); },
    onText(cb) { textCbs.push(cb); },
    onState(cb) { stateCbs.push(cb); },
    start() {}, stop() {},
  };
  const emitText = (t) => textCbs.forEach(cb => cb(t));
  const setState = (listening, info = '') => {
    api.listening = listening;
    stateCbs.forEach(cb => cb({ listening, info, available: api.available, kind: api.kind }));
  };

  // ---------------------------------------------------------------- Vosk
  let voskModel = null, voskLoading = null, rec = null, audio = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (window.Vosk) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('script'));
      document.head.appendChild(s);
    });
  }
  function loadVosk() {
    if (voskModel) return Promise.resolve(voskModel);
    if (!voskLoading) {
      voskLoading = (async () => {
        setState(true, 'Ses tanıma hazırlanıyor… (ilk seferde ~35 MB indirilir, biraz bekle)');
        await loadScript(VOSK_JS);
        const url = new URL(VOSK_MODEL, location.href).href;
        voskModel = await window.Vosk.createModel(url);
        return voskModel;
      })().catch(e => { voskLoading = null; throw e; });
    }
    return voskLoading;
  }
  async function voskStart() {
    try {
      const streamP = navigator.mediaDevices.getUserMedia({
        video: false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      const [model, stream] = await Promise.all([loadVosk(), streamP]);
      // Model 16 kHz ile eğitildi: mümkünse ses de 16 kHz işlensin
      let ctx, src;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        src = ctx.createMediaStreamSource(stream);
      } catch {
        try { ctx && ctx.close(); } catch {}
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        src = ctx.createMediaStreamSource(stream);
      }
      if (ctx.state === 'suspended') await ctx.resume();

      // Ses tonu uyumu: aynı sesi birkaç tanıyıcıya veriyoruz. İlki olduğu gibi duyar;
      // diğerlerine örnekleme hızı olduğundan yüksek bildirilir, böylece ses (perde ve
      // formantlar) kalınlaşmış gibi algılanır. İnce/yüksek sesle söylenen notalar da
      // modelin eğitildiği konuşma aralığına düşer. Hangisi önce yakalarsa o kabul edilir.
      // Kalınlaştırılmış ek kopyalar (ör. [1, 1.25, 1.55]) ince sesi yakalıyordu ama bazen
      // 'do'yu 'la' sanıyordu; kullanıcı isteğiyle kapalı: yalnızca sesin olduğu gibi dinlenir.
      const FACTORS = [1];
      let recs = [], timer = null, timerText = '';
      const makeRec = (f) => {
        const r = new model.KaldiRecognizer(Math.round(ctx.sampleRate * f), grammarFor(api.sensitivity));
        r.factor = f; r.partial = '';
        r.on('partialresult', (m) => {
          if (!recs.includes(r)) return;
          const p = (m && m.result && m.result.partial || '').trim();
          if (p === r.partial) return;
          r.partial = p;
          if (noteGroups(p).length) {
            clearTimeout(timer); timerText = p;
            timer = setTimeout(() => take(timerText), STABLE_MS);
          }
        });
        r.on('result', (m) => {
          if (!recs.includes(r)) return;
          const t = (m && m.result && m.result.text) || '';
          r.partial = '';
          if (noteGroups(t).length) { clearTimeout(timer); take(t); }
          else if (t.trim() && r.factor === 1) setState(true, 'Ses duyuldu ama anlaşılamadı — nota adını net söyle.');
        });
        return r;
      };
      const resetAll = () => {
        const old = recs;
        recs = FACTORS.map(makeRec);
        rec = recs[0];
        old.forEach(r => { try { r.remove(); } catch {} });
      };
      // Her nota ayrı bir "konuşma": bir nota yakalanınca tüm tanıyıcılar sıfırlanır.
      // birlikte söylenen notalar tek seferde gönderilir ("si do do sol"); uygulama sırayla işler
      const take = (text) => { clearTimeout(timer); const gs = noteGroups(text); if (gs.length) emitText(gs.join(' ')); resetAll(); };
      resetAll();
      api._recs = () => recs;

      const node = ctx.createScriptProcessor(4096, 1, 1);
      let lastLevelAt = 0;
      node.onaudioprocess = (e) => {
        const inb = e.inputBuffer;
        const data = inb.getChannelData(0);
        for (const r of recs) {
          try {
            if (r.factor === 1) r.acceptWaveform(inb);
            else if (typeof r.acceptWaveformFloat === 'function') r.acceptWaveformFloat(data, Math.round(inb.sampleRate * r.factor));
            else {
              const b = new AudioBuffer({ length: inb.length, numberOfChannels: 1, sampleRate: Math.round(inb.sampleRate * r.factor) });
              b.copyToChannel(data, 0);
              r.acceptWaveform(b);
            }
          } catch {}
        }
        const now = performance.now();
        if (levelCbs.length && now - lastLevelAt > 60) {
          lastLevelAt = now;
          let sum = 0; for (let i = 0; i < data.length; i += 4) sum += data[i] * data[i];
          levelCbs.forEach(cb => cb(Math.min(1, Math.sqrt(sum / (data.length / 4)) * 5)));
        }
      };
      src.connect(node);
      node.connect(ctx.destination); // bazı tarayıcılar bağlı olmayan işlemciyi çalıştırmaz (çıkış sessiz)
      audio = { ctx, stream, src, node };
      setState(true, 'Dinliyorum. Notayı söyle: “sol”, “la”…');
    } catch (e) {
      voskStop(true);
      const name = e && e.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setState(false, 'Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofona izin ver.');
      else if (name === 'NotFoundError') setState(false, 'Mikrofon bulunamadı.');
      else if (useWebSpeechFallback()) { setState(false, 'Cihazda ses tanıma yüklenemedi; tarayıcının ses tanıması kullanılacak. 🎤’ya tekrar bas.'); }
      else setState(false, 'Ses tanıma yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
    }
  }
  function voskStop(silent = false) {
    if (audio) {
      try { audio.node.disconnect(); audio.src.disconnect(); } catch {}
      levelCbs.forEach(cb => cb(0));
      audio.stream.getTracks().forEach(t => t.stop());
      audio.ctx.close().catch(() => {});
      audio = null;
    }
    if (api._recs) { api._recs().forEach(r => { try { r.remove(); } catch {} }); api._recs = null; }
    rec = null;
    if (!silent) setState(false);
  }
  function useVosk() {
    api.available = true; api.kind = 'vosk'; api.pushToTalk = false;
    api.start = () => { voskStart(); };
    api.stop = () => voskStop();
  }

  // ---------------------------------------------------------------- Web Speech (yedek)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let wrec = null, wantOn = false;
  function useWebSpeech() {
    api.available = true; api.kind = 'webspeech';
    api.pushToTalk = location.protocol === 'file:';
    let quickEnds = 0, startedAt = 0, gotResult = false;
    const fail = (msg) => { wantOn = false; try { wrec && wrec.abort(); } catch {} setState(false, msg); };
    api.start = () => {
      wantOn = true; quickEnds = 0;
      if (!wrec) {
        wrec = new SR();
        wrec.lang = 'tr-TR';
        wrec.continuous = !api.pushToTalk;
        wrec.interimResults = false;
        wrec.maxAlternatives = 5;
        wrec.onstart = () => { startedAt = Date.now(); gotResult = false; };
        wrec.onresult = (e) => {
          gotResult = true; quickEnds = 0;
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (!e.results[i].isFinal) continue;
            emitText(Array.from(e.results[i]).map(a => a.transcript).join(' | '));
          }
        };
        wrec.onend = () => {
          if (!wantOn) { setState(false); return; }
          if (!gotResult && Date.now() - startedAt < 1500 && ++quickEnds >= 2) { fail('Dinleme başlatılamadı. Tekrar denemek için 🎤 düğmesine bas.'); return; }
          if (api.pushToTalk) { wantOn = false; setState(false); return; }
          try { wrec.start(); } catch { setState(false); }
        };
        wrec.onerror = (e) => {
          if (e.error === 'service-not-allowed' || e.error === 'network') fail('Bu tarayıcının ses tanıma hizmetine ulaşılamadı. Chrome ya da Edge dene.');
          else if (e.error === 'not-allowed') fail('Mikrofon izni verilmedi.');
          else if (e.error === 'audio-capture') fail('Mikrofon bulunamadı.');
        };
      }
      try { wrec.start(); setState(true); } catch { setState(true); }
    };
    api.stop = () => { wantOn = false; try { wrec && wrec.stop(); } catch {} setState(false); };
  }
  function useWebSpeechFallback() { if (!SR) return false; useWebSpeech(); return true; }

  // ---------------------------------------------------------------- Claude dikte
  function useDictation(d) {
    api.available = true; api.kind = 'dictation'; api.reason = ''; api.pushToTalk = false;
    let prev = '';
    d.onFinal(({ text }) => {
      const t = (text || '').trim();
      const grew = prev && t.length > prev.length && t.toLowerCase().startsWith(prev.toLowerCase());
      const fresh = grew ? t.slice(prev.length) : t;
      prev = t;
      if (fresh.trim()) emitText(fresh.trim());
    });
    d.onState(({ state, reason }) => {
      if (state === 'listening') { prev = ''; setState(true); }
      else setState(false, reason === 'not_granted' ? 'Mikrofon izni verilmedi.' : '');
    });
    api.start = () => {
      d.start().catch(err => {
        const msg = String(err && (err.code || err.message || err));
        setState(false, msg.includes('not_granted') ? 'Mikrofon izni verilmedi.' : 'Dinleme başlatılamadı.');
      });
    };
    api.stop = () => { d.stop().catch(() => {}); };
  }

  // ---------------------------------------------------------------- seçim
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');
  const canVosk = location.protocol.startsWith('http') && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof WebAssembly === 'object';
  if (inClaude) {
    window.claude.use('dictation').then(d => { if (d) { useDictation(d); setState(false); } }).catch(() => {});
  } else if (canVosk) {
    useVosk();
  } else if (SR) {
    useWebSpeech();
  } else {
    api.reason = 'Bu tarayıcıda sesle cevap kullanılamıyor; tuşlarla devam edebilirsin.';
  }
  setTimeout(() => setState(false), 0);
  return api;
}

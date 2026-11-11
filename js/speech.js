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

const STABLE_MS = 320;
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
      // mikrofonu hemen iste (tıklamanın hemen ardından)
      // Gürültü bastırma kısa heceleri de yutabiliyor: kapalı; otomatik kazanç açık
      const streamP = navigator.mediaDevices.getUserMedia({
        video: false, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
      });
      const [model, stream] = await Promise.all([loadVosk(), streamP]);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      rec = new model.KaldiRecognizer(ctx.sampleRate, grammarFor(api.sensitivity));
      // Vosk "result"u ancak uzun bir sessizlikten sonra verir; art arda söylenen notalar
      // tek sonuçta birikir. Bu yüzden ara sonuçları (partial) izleyip her notayı,
      // söyledikten kısa bir duraklama sonra ayrı ayrı bildiriyoruz.
      let consumed = 0, partial = '', timer = null;
      const flush = (text, final) => {
        const gs = noteGroups(text);
        for (let i = consumed; i < gs.length; i++) emitText(gs[i]);
        consumed = final ? 0 : gs.length;
      };
      rec.on('partialresult', (m) => {
        const p = (m && m.result && m.result.partial || '').trim();
        if (p === partial) return;
        partial = p;
        clearTimeout(timer);
        timer = setTimeout(() => flush(partial, false), STABLE_MS);
      });
      rec.on('result', (m) => {
        clearTimeout(timer);
        const t = (m && m.result && m.result.text) || '';
        if (t.trim() === '[unk]' || (!noteGroups(t).length && t.trim())) setState(true, 'Ses duyuldu ama anlaşılamadı — nota adını net söyle.');
        flush(t, true);
        partial = '';
      });
      const src = ctx.createMediaStreamSource(stream);
      // kısık sesi yükselt, ani bağırmaları sınırla
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -40; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
      const gain = ctx.createGain(); gain.gain.value = 2.2;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      let lastLevelAt = 0;
      node.onaudioprocess = (e) => {
        try { rec && rec.acceptWaveform(e.inputBuffer); } catch {}
        const now = performance.now();
        if (levelCbs.length && now - lastLevelAt > 60) {
          lastLevelAt = now;
          const d = e.inputBuffer.getChannelData(0);
          let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] * d[i];
          const rms = Math.sqrt(sum / (d.length / 4));
          levelCbs.forEach(cb => cb(Math.min(1, rms * 4)));
        }
      };
      src.connect(comp).connect(gain).connect(node);
      node.connect(ctx.destination); // bazı tarayıcılar bağlı olmayan işlemciyi çalıştırmaz (çıkış sessiz)
      audio = { ctx, stream, src, node, comp, gain };
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
      try { audio.node.disconnect(); audio.src.disconnect(); audio.comp.disconnect(); audio.gain.disconnect(); } catch {}
      levelCbs.forEach(cb => cb(0));
      audio.stream.getTracks().forEach(t => t.stop());
      audio.ctx.close().catch(() => {});
      audio = null;
    }
    if (rec) { try { rec.remove(); } catch {} rec = null; }
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

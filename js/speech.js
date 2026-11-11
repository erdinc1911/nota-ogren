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
const GRAMMAR = JSON.stringify([
  ...NOTES,
  ...NOTES.flatMap(n => [`${n} bemol`, `${n} bemol iki`, `${n} koma bemol`, `${n} diyet`, `${n} diyet iki`]),
  '[unk]',
]);

export function createSpeech() {
  const textCbs = [], stateCbs = [];
  const api = {
    available: false, kind: null, listening: false, reason: '', pushToTalk: false,
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
      const streamP = navigator.mediaDevices.getUserMedia({
        video: false, audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      const [model, stream] = await Promise.all([loadVosk(), streamP]);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      rec = new model.KaldiRecognizer(ctx.sampleRate, GRAMMAR);
      rec.on('result', (m) => {
        const t = (m && m.result && m.result.text || '').replace(/\[unk\]/g, '').trim();
        if (t) emitText(t);
      });
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => { try { rec && rec.acceptWaveform(e.inputBuffer); } catch {} };
      src.connect(node);
      node.connect(ctx.destination); // bazı tarayıcılar bağlı olmayan işlemciyi çalıştırmaz
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

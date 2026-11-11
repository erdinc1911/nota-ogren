// Sesle cevap verme. Üç olası altyapı:
//  1) Claude artifact "dictation" yeteneği (sayfa claude.ai üzerinde açıkken)
//  2) Tarayıcının Web Speech API'si (Chrome/Edge/Safari, tr-TR)
//  3) (İleride) Android/Capacitor eklentisi – aynı arayüzü uygulaması yeterli.
// Arayüz: { available, kind, start(), stop(), listening, onText(cb), onState(cb) }

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

  // --- 2) Web Speech API ---
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, wantOn = false;
  function useWebSpeech() {
    api.available = true; api.kind = 'webspeech';
    // Dosyadan açılınca izin her başlatmada sorulur: her cevap için bir kez bas-konuş
    api.pushToTalk = location.protocol === 'file:';
    let quickEnds = 0, startedAt = 0, gotResult = false;
    const fail = (msg) => { wantOn = false; try { rec && rec.abort(); } catch {} setState(false, msg); };
    api.start = () => {
      wantOn = true; quickEnds = 0;
      if (!rec) {
        rec = new SR();
        rec.lang = 'tr-TR';
        rec.continuous = !api.pushToTalk;
        rec.interimResults = false;
        rec.maxAlternatives = 5;
        rec.onstart = () => { startedAt = Date.now(); gotResult = false; };
        rec.onresult = (e) => {
          gotResult = true; quickEnds = 0;
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (!e.results[i].isFinal) continue;
            const alts = Array.from(e.results[i]).map(a => a.transcript);
            emitText(alts.join(' | '));
          }
        };
        rec.onend = () => {
          if (!wantOn) { setState(false); return; }
          // hiç sonuç gelmeden hemen bittiyse art arda yeniden başlatma (izin penceresi döngüsü olmasın)
          if (!gotResult && Date.now() - startedAt < 1500 && ++quickEnds >= 2) {
            fail('Dinleme başlatılamadı. Tekrar denemek için 🎤 düğmesine bas.'); return;
          }
          // Dosyadan (file://) açıldığında tarayıcı izni hatırlamaz; her yeniden başlatmada
          // tekrar sorar. Bu durumda otomatik yeniden başlatma yapma.
          if (api.pushToTalk) { wantOn = false; setState(false); return; }
          try { rec.start(); } catch { setState(false); }
        };
        rec.onerror = (e) => {
          if (e.error === 'service-not-allowed') fail('Bu tarayıcı burada ses tanıma hizmetine izin vermiyor (Brave dosyadan açılınca böyle). Uygulamayı bağlantısından aç ya da Chrome/Edge kullan.');
          else if (e.error === 'not-allowed') fail(location.protocol === 'file:'
            ? 'Mikrofon kullanılamadı. Dosyadan açınca bazı tarayıcılar (Brave) izin vermiyor: uygulamayı bağlantısından aç ya da Chrome/Edge kullan.'
            : 'Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofona izin ver.');
          else if (e.error === 'network') fail('Ses tanıma hizmetine ulaşılamadı (internet bağlantısı gerekir; bazı tarayıcılar bu hizmeti engeller).');
          else if (e.error === 'audio-capture') fail('Mikrofon bulunamadı.');
        };
      }
      try { rec.start(); setState(true); } catch { setState(true); }
    };
    api.stop = () => { wantOn = false; try { rec && rec.stop(); } catch {} setState(false); };
  }

  // --- 1) Claude dictation ---
  let dict = null;
  function useDictation(d) {
    dict = d;
    api.available = true; api.kind = 'dictation';
    // Bazı tanıyıcılar biriken metnin tamamını gönderir: yalnızca yeni kısmı al.
    let prev = '';
    d.onFinal(({ text }) => {
      const t = (text || '').trim();
      // yalnızca metin gerçekten uzamışsa birikmiş say; aynı sözcüğü ikinci kez söylemek yeni cevaptır
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

  // claude.ai içinde açıldıysa (bağlantı) tarayıcı ses tanıması çerçevede çalışmaz: yalnızca dikte kullan
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');
  if (SR && !inClaude) useWebSpeech();
  else api.reason = 'Bu tarayıcı sesle cevabı desteklemiyor (Chrome ya da Edge kullan).';
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('dictation').then(d => {
      if (d) { api.reason = ''; useDictation(d); setState(false); }
    }).catch(() => {});
  }
  // İlk durum bildirimi
  setTimeout(() => setState(false), 0);
  return api;
}

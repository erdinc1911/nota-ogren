// Mikrofondan perde (frekans) algılama – McLeod Pitch Method (NSDF).
// Şarkı söyleme ve saz sesi için: 70–1100 Hz. Konuşma tanımadan bağımsızdır.

export function detectPitch(buf, sr, minF = 70, maxF = 1100) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return { freq: 0, clarity: 0, rms };
  const minTau = Math.max(2, Math.floor(sr / maxF));
  const maxTau = Math.min(n - 2, Math.ceil(sr / minF));
  const nsdf = new Float32Array(maxTau + 2);
  for (let tau = 0; tau <= maxTau + 1; tau++) {
    let acf = 0, m = 0;
    for (let i = 0, lim = n - tau; i < lim; i++) {
      const a = buf[i], b = buf[i + tau];
      acf += a * b; m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? 2 * acf / m : 0;
  }
  // pozitif bölgelerdeki tepe noktaları
  const peaks = [];
  let tau = 1;
  while (tau < maxTau && nsdf[tau] > 0) tau++;          // ilk sıfır geçişine kadar atla
  while (tau < maxTau) {
    while (tau < maxTau && nsdf[tau] <= 0) tau++;
    let best = -1, bestTau = -1;
    while (tau < maxTau && nsdf[tau] > 0) {
      if (nsdf[tau] > best) { best = nsdf[tau]; bestTau = tau; }
      tau++;
    }
    if (bestTau > 0) peaks.push(bestTau);
  }
  if (!peaks.length) return { freq: 0, clarity: 0, rms };
  const gmax = Math.max(...peaks.map(t => nsdf[t]));
  const chosen = peaks.find(t => nsdf[t] >= 0.88 * gmax && t >= minTau);
  if (!chosen) return { freq: 0, clarity: 0, rms };
  // parabolik ince ayar
  const y0 = nsdf[chosen - 1], y1 = nsdf[chosen], y2 = nsdf[chosen + 1];
  const d = (y0 - 2 * y1 + y2) !== 0 ? 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) : 0;
  const period = chosen + d;
  return { freq: sr / period, clarity: y1, rms };
}

/** Mikrofonu açıp ~20 kez/sn perde bildirir. */
export function createPitchListener(onPitch) {
  let ctx = null, stream = null, analyser = null, timer = null;
  const api = {
    running: false,
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        onPitch(detectPitch(buf, ctx.sampleRate));
      }, 50);
      api.running = true;
    },
    stop() {
      clearInterval(timer); timer = null;
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (ctx) ctx.close().catch(() => {});
      ctx = stream = analyser = null;
      api.running = false;
    },
  };
  return api;
}

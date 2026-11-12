/* AudioFX: the voice clean up behind the Audio tab, all plain JavaScript on mono Float32 samples.
   - Noise reduction the way Audacity does it: learn the noise from a quiet bit (its power at every frequency), then in
     every short window turn down each frequency that is no louder than the noise was, smoothing the decisions across
     neighbouring frequencies and over time so the voice does not go watery. Our own code, written from the method.
   - Rumble cut (high pass), mains hum (50 Hz and its harmonics), harsh S softening, click repair, a gentle leveller and
     loudness to a target (LUFS, as YouTube measures it) with a peak limit.
   Long jobs yield now and then (onProgress) so the page stays responsive. */
const AudioFX = (() => {
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, db2 = d => Math.pow(10, d / 20);
  const N = 2048, HOP = 512, BINS = N / 2 + 1;
  const yieldNow = () => new Promise(r => setTimeout(r, 0));

  /* ---------- FFT (radix 2, in place) ---------- */
  const tw = (() => { const c = new Float64Array(N / 2), s = new Float64Array(N / 2); for (let i = 0; i < N / 2; i++) { c[i] = Math.cos(-2 * Math.PI * i / N); s[i] = Math.sin(-2 * Math.PI * i / N); } return { c, s }; })();
  const rev = (() => { const r = new Uint32Array(N); for (let i = 0, j = 0; i < N; i++) { r[i] = j; let b = N >> 1; while (j & b) { j ^= b; b >>= 1; } j |= b; } return r; })();
  function fft(re, im, inv) {
    for (let i = 0; i < N; i++) { const j = rev[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= N; len <<= 1) { const h = len >> 1, st = N / len;
      for (let i = 0; i < N; i += len) for (let k = 0; k < h; k++) { const wr = tw.c[k * st], wi = inv ? -tw.s[k * st] : tw.s[k * st], p = i + k, q = p + h, xr = re[q] * wr - im[q] * wi, xi = re[q] * wi + im[q] * wr; re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi; } }
    if (inv) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }
  const win = (() => { const w = new Float64Array(N); for (let i = 0; i < N; i++) w[i] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); return w; })();   // root Hann, in and out

  /* ---------- the noise, learned from a quiet bit ---------- */
  function profile(x, sr, a, b) {
    const i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(x.length, Math.floor(b * sr)), P = new Float64Array(BINS), re = new Float64Array(N), im = new Float64Array(N); let n = 0;
    for (let o = i0; o + N <= i1 || (n === 0 && o < i1); o += HOP) { for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * win[i]; im[i] = 0; } fft(re, im); for (let k = 0; k < BINS; k++) P[k] += re[k] * re[k] + im[k] * im[k]; n++; }
    if (!n) return null; const out = new Array(BINS); for (let k = 0; k < BINS; k++) out[k] = +(10 * Math.log10(P[k] / n + 1e-20)).toFixed(2); return { db: out, sr, len: +((i1 - i0) / sr).toFixed(2) };
  }
  // A quiet bit found automatically: the quietest half second (for Clean my voice, when no noise was picked)
  function quietest(x, sr, len = 0.5) {
    const w = Math.floor(sr * 0.05), n = Math.floor(x.length / w), e = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < w; j++) { const v = x[i * w + j]; s += v * v; } e[i] = s; }
    const k = Math.max(1, Math.round(len / 0.05)); let best = -1, bv = Infinity, run = 0; for (let i = 0; i < n; i++) { run += e[i]; if (i >= k) run -= e[i - k]; if (i >= k - 1 && run < bv) { bv = run; best = i - k + 1; } }
    return best < 0 ? [0, Math.min(len, x.length / sr)] : [best * w / sr, (best + k) * w / sr];
  }

  /* ---------- noise reduction ----------
     o: { reduce (dB the noise is turned down, Audacity's 12), sens (dB above the noise still counted as noise, 6),
          smooth (frequency smoothing in bands, 3) } */
  async function denoise(x, sr, prof, o = {}, onProgress) {
    if (!prof || !prof.db) return x; const reduce = cl(+o.reduce || 12, 0, 48), sens = cl(o.sens == null ? 6 : +o.sens, 0, 24), sm = Math.round(cl(o.smooth == null ? 3 : +o.smooth, 0, 12));
    const floor = db2(-reduce), thr = new Float64Array(BINS); for (let k = 0; k < BINS; k++) thr[k] = Math.pow(10, ((prof.db[k] || -200) + sens) / 10);
    const n = x.length, frames = Math.ceil((n + N) / HOP) + 1, out = new Float32Array(n), re = new Float64Array(N), im = new Float64Array(N);
    // gains are worked out for every frame first (so they can be smoothed in time), then applied
    const G = new Float32Array(frames * BINS), specR = null; void specR;
    const frameAt = f => f * HOP - N;   // the first frame starts before the sound so the ends are covered
    for (let f = 0; f < frames; f++) {
      const o0 = frameAt(f); for (let i = 0; i < N; i++) { const j = o0 + i; re[i] = (j >= 0 && j < n ? x[j] : 0) * win[i]; im[i] = 0; } fft(re, im);
      for (let k = 0; k < BINS; k++) { const p = re[k] * re[k] + im[k] * im[k]; G[f * BINS + k] = p > thr[k] ? 1 : floor; }
      if (f % 400 === 399) { onProgress && onProgress(0.5 * f / frames); await yieldNow(); }
    }
    // smooth in time: a frequency opens straight away but closes over a few frames (attack fast, release slow), and
    // stays open a frame either side so word edges are not clipped
    for (let k = 0; k < BINS; k++) { let g = floor; for (let f = 0; f < frames; f++) { const i = f * BINS + k, v = G[i]; g = v > g ? v : g * 0.6 + v * 0.4; G[i] = g; } for (let f = frames - 2; f >= 0; f--) { const i = f * BINS + k; G[i] = Math.max(G[i], G[i + BINS] * 0.85); } }
    // smooth across frequency (geometric mean over neighbours, like Audacity's frequency smoothing)
    const row = new Float64Array(BINS);
    for (let f = 0; f < frames; f++) {
      if (sm > 0) { for (let k = 0; k < BINS; k++) row[k] = Math.log(G[f * BINS + k]); for (let k = 0; k < BINS; k++) { let s = 0, c = 0; for (let j = Math.max(0, k - sm); j <= Math.min(BINS - 1, k + sm); j++) { s += row[j]; c++; } G[f * BINS + k] = Math.exp(s / c); } }
      const o0 = frameAt(f); for (let i = 0; i < N; i++) { const j = o0 + i; re[i] = (j >= 0 && j < n ? x[j] : 0) * win[i]; im[i] = 0; } fft(re, im);
      for (let k = 0; k < BINS; k++) { const g = G[f * BINS + k]; re[k] *= g; im[k] *= g; if (k > 0 && k < N / 2) { re[N - k] *= g; im[N - k] *= g; } }
      fft(re, im, true); for (let i = 0; i < N; i++) { const j = o0 + i; if (j >= 0 && j < n) out[j] += re[i] * win[i] * 0.5; }   // root Hann twice at a quarter hop adds up to 2
      if (f % 400 === 399) { onProgress && onProgress(0.5 + 0.5 * f / frames); await yieldNow(); }
    }
    onProgress && onProgress(1); return out;
  }

  /* ---------- filters ---------- */
  function biquad(x, c) { const out = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], y = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; out[i] = y; } return out; }
  function coef(type, f, sr, q, gainDb) {   // the usual cookbook filters
    const w = 2 * Math.PI * f / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, (gainDb || 0) / 40); let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'notch') { b0 = 1; b1 = -2 * cs; b2 = 1; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hs') { const s2 = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cs + s2); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s2); a0 = (A + 1) - (A - 1) * cs + s2; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s2; }
    else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }
  const rumble = (x, sr, f = 80) => biquad(biquad(x, coef('hp', f, sr, 0.707)), coef('hp', f, sr, 0.707));
  function hum(x, sr, base = 50) { let y = x; for (let h = 1; h <= 5; h++) { const f = base * h; if (f < sr / 2 - 100) y = biquad(y, coef('notch', f, sr, 25 + h * 5)); } return y; }

  /* ---------- harsh S sounds: turn the top end down only while it is louder than the rest ---------- */
  function deess(x, sr, amount = 0.5) {
    if (amount <= 0) return x; const hp = biquad(biquad(x, coef('hp', 4500, sr, 0.707)), coef('hp', 4500, sr, 0.707)), band = biquad(biquad(x, coef('bp', 7000, sr, 1)), coef('bp', 7000, sr, 1));
    const out = new Float32Array(x.length), at = Math.exp(-1 / (sr * 0.002)), rl = Math.exp(-1 / (sr * 0.06)); let es = 0, ef = 0, g = 1; const range = db2(-12 * amount);
    for (let i = 0; i < x.length; i++) { const s = band[i] * band[i], a2 = x[i] * x[i]; es = s > es ? at * es + (1 - at) * s : rl * es + (1 - rl) * s; ef = a2 > ef ? at * ef + (1 - at) * a2 : rl * ef + (1 - rl) * a2;
      const ratio = es / (ef + 1e-12), want = ratio > 0.35 ? Math.max(range, Math.pow(0.35 / ratio, 0.5 + amount)) : 1; g = want < g ? want : g + (want - g) * 0.002; out[i] = x[i] - (1 - g) * hp[i]; }
    return out;
  }

  /* ---------- clicks and pops: very short jumps far outside what the sound around them is doing, drawn across ---------- */
  function declick(x, sr) {
    const out = Float32Array.from(x), n = x.length, w = Math.floor(sr * 0.01), d = new Float32Array(n); for (let i = 2; i < n; i++) d[i] = Math.abs(x[i] - 2 * x[i - 1] + x[i - 2]);
    let s = 0; for (let i = 0; i < Math.min(n, w); i++) s += d[i]; let fixed = 0;
    for (let i = w; i < n - w; i++) { s += d[i] - d[i - w]; const mean = s / w; if (d[i] > mean * 12 + 1e-4) { const a = Math.max(1, i - 6), b = Math.min(n - 2, i + Math.floor(sr * 0.0015)); for (let j = a; j <= b; j++) { const u = (j - a + 1) / (b - a + 2); out[j] = out[a - 1] * (1 - u) + x[b + 1] * u; } fixed++; i = b + 1; } }
    return out;
  }

  /* ---------- the leveller: quiet bits up, loud bits down, slowly so it does not pump ---------- */
  function level(x, sr, amount = 0.5) {
    if (amount <= 0) return x; const out = new Float32Array(x.length), thr = -30 + 10 * (1 - amount), ratio = 1.5 + 2.5 * amount, at = Math.exp(-1 / (sr * 0.01)), rl = Math.exp(-1 / (sr * 0.25)); let env = 0;
    for (let i = 0; i < x.length; i++) { const a2 = x[i] * x[i]; env = a2 > env ? at * env + (1 - at) * a2 : rl * env + (1 - rl) * a2; const lv = 10 * Math.log10(env + 1e-12), over = lv - thr, gdb = over > 0 ? -over * (1 - 1 / ratio) : 0; out[i] = x[i] * db2(gdb); }
    return out;
  }

  /* ---------- loudness (LUFS, integrated, gated as in the broadcast standard) and a peak limit ---------- */
  function lufs(x, sr) {
    const k = biquad(biquad(x, coef('hs', 1500, sr, 0.707, 4)), coef('hp', 38, sr, 0.5)), bl = Math.floor(sr * 0.4), st = Math.floor(sr * 0.1), L = [];
    for (let o = 0; o + bl <= k.length; o += st) { let s = 0; for (let i = 0; i < bl; i++) s += k[o + i] * k[o + i]; L.push(s / bl); }
    const ld = p => -0.691 + 10 * Math.log10(p + 1e-20); let g = L.filter(p => ld(p) > -70); if (!g.length) return -70;
    const rel = ld(g.reduce((a, b) => a + b, 0) / g.length) - 10; g = g.filter(p => ld(p) > rel); return g.length ? ld(g.reduce((a, b) => a + b, 0) / g.length) : -70;
  }
  function limit(x, sr, ceilDb = -1) {
    const c = db2(ceilDb), la = Math.floor(sr * 0.005), n = x.length, out = new Float32Array(n), need = new Float32Array(n); for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); need[i] = a > c ? c / a : 1; }
    // the gain needed over the look ahead, eased back up afterwards
    let g = 1; const rl = Math.exp(-1 / (sr * 0.08)), q = []; let qi = 0;
    for (let i = 0; i < n + la; i++) { if (i < n) { while (q.length > qi && need[q[q.length - 1]] >= need[i]) q.pop(); q.push(i); } while (q.length > qi && q[qi] < i - la) qi++; const j = i - la; if (j < 0) continue; const want = q.length > qi ? need[q[qi]] : 1; g = want < g ? want : rl * g + (1 - rl) * want; out[j] = x[j] * g; }
    return out;
  }
  function loudness(x, sr, target = -16) { const now = lufs(x, sr); if (now <= -69) return x; const k = db2(cl(target - now, -30, 30)), y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * k; return limit(y, sr, -1); }

  /* ---------- AI noise removal: RNNoise (trained on real speech and noise), built in, 10 ms frames at 48 kHz ---------- */
  let rnMod = null;
  async function rnModule() { if (rnMod) return rnMod; if (typeof createRNNWasmModule === 'undefined' || typeof RNNOISE_WASM === 'undefined') throw new Error('RNNoise is not in this version.');
    const bin = Uint8Array.from(atob(RNNOISE_WASM), c => c.charCodeAt(0)); rnMod = await createRNNWasmModule({ wasmBinary: bin, locateFile: f => f }); return rnMod; }
  async function rnnoise(x, sr, amount = 1, onProgress) {
    if (sr !== 48000) throw new Error('RNNoise needs 48 kHz.'); const M = await rnModule(), F = 480, st = M._rnnoise_create(0), pin = M._malloc(F * 4), pout = M._malloc(F * 4), n = x.length, out = new Float32Array(n), k = cl(+amount, 0, 1);
    // it learns the room as it goes, so let it hear the first couple of seconds once before it starts for real
    try { for (let o = 0; o < Math.min(n, sr * 2); o += F) { const H = M.HEAPF32, a = pin >> 2; for (let i = 0; i < F; i++) H[a + i] = (x[o + i] || 0) * 32768; M._rnnoise_process_frame(st, pout, pin); }
      for (let o = 0, f = 0; o < n + F; o += F, f++) { const H = M.HEAPF32, a = pin >> 2, b = pout >> 2; for (let i = 0; i < F; i++) H[a + i] = (x[o + i] || 0) * 32768; M._rnnoise_process_frame(st, pout, pin); const H2 = M.HEAPF32;
        for (let i = 0; i < F; i++) { const j = o + i - F; if (j >= 0 && j < n) out[j] = H2[b + i] / 32768; }   // it hands back each frame one frame late
        if (f % 2000 === 1999) { onProgress && onProgress(o / n); await yieldNow(); } } }
    finally { M._rnnoise_destroy(st); M._free(pin); M._free(pout); }
    if (k < 1) for (let i = 0; i < n; i++) out[i] = x[i] * (1 - k) + out[i] * k;
    return out;
  }

  /* ---------- voice EQ: a little less boxiness, a little more presence and air (gentle, all three adjustable) ---------- */
  function eq(x, sr, o = {}) { let y = x; const mud = +o.mud || 0, pres = +o.pres || 0, air = +o.air || 0, low = +o.low || 0;
    if (low) y = biquad(y, coef('peak', 120, sr, 0.8, low)); if (mud) y = biquad(y, coef('peak', 320, sr, 1.1, mud)); if (pres) y = biquad(y, coef('peak', 3500, sr, 0.9, pres)); if (air) y = biquad(y, coef('hs', 10000, sr, 0.707, air)); return y; }
  /* ---------- a proper compressor (like Audacity's): threshold, ratio, quick attack, smooth release, make up gain.
     amount 0..1 sets how hard: 0.5 is about 3 to 1 above a threshold 18 dB under the voice's level ---------- */
  function compress(x, sr, amount = 0.5) {
    if (amount <= 0) return x; const n = x.length, out = new Float32Array(n), lv = lufs(x, sr), thr = Math.max(-60, (lv > -69 ? lv : -30) - 6 - 14 * amount), ratio = 1.5 + 3.5 * amount, knee = 6;
    const at = Math.exp(-1 / (sr * 0.008)), rl = Math.exp(-1 / (sr * 0.15)); let env = 0, gs = 0;
    for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); env = a > env ? at * env + (1 - at) * a : rl * env + (1 - rl) * a; const d = 20 * Math.log10(env + 1e-9) - thr;
      const red = d <= -knee / 2 ? 0 : d >= knee / 2 ? d * (1 - 1 / ratio) : (1 - 1 / ratio) * Math.pow(d + knee / 2, 2) / (2 * knee); gs = red > gs ? red : gs * 0.9995 + red * 0.0005; out[i] = x[i] * db2(-gs); }
    const k = db2(Math.min(12, (lufs(x, sr) - lufs(out, sr)) || 0)); for (let i = 0; i < n; i++) out[i] *= k; return out;   // back up to the level it came in at
  }
  // Mains hum present? (a clear peak at 50 Hz and its harmonics in the noise, over the bins either side)
  function hasHum(prof, base = 50) { if (!prof || !prof.db) return false; const bin = f => Math.round(f / prof.sr * N); let s = 0, n = 0;
    for (let h = 1; h <= 3; h++) { const k = bin(base * h); if (k + 4 >= prof.db.length) continue; const pk = Math.max(prof.db[k - 1], prof.db[k], prof.db[k + 1]), side = (prof.db[k - 4] + prof.db[k + 4]) / 2; s += pk - side; n++; } return n > 0 && s / n > 8; }

  /* ---------- the whole chain, in a sensible order: one noise remover, never two ----------
     c.ai { on, atten (dB it may take away: 12 gentle, 20 natural, 30 strong, 100 all) } is DeepFilterNet 3; c.nr is the
     Audacity style one (used when the AI is off). keep: also hand back the sound just before and after the noise removal,
     so he can hear exactly what is being taken out. */
  async function chain(x, sr, c = {}, onProgress, keep) {
    let y = x; const step = (p, s) => onProgress && onProgress(p, s); let nrIn = null, nrOut = null;
    if (c.declick) { step(0.02, 'Fixing clicks'); y = declick(y, sr); await yieldNow(); }
    if (c.rumble !== false) { y = rumble(y, sr, +c.rumbleHz || 80); }
    if (c.hum) { y = hum(y, sr, +c.humHz || 50); }
    if (c.ai && c.ai.on) { if (typeof DeepFilter === 'undefined' || (await DeepFilter.check()) !== 'ready') throw new Error('The AI voice cleaner is not downloaded yet: press Get the AI voice cleaner in Background noise.');
      step(0.05, 'AI voice cleaning'); nrIn = y; y = await DeepFilter.process(y, { atten: c.ai.atten == null ? 20 : +c.ai.atten, onProgress: q => step(0.05 + 0.7 * q, 'AI voice cleaning') }); nrOut = y; }
    else if (c.nr && c.nr.on && c.nr.profile) { step(0.05, 'Taking out the noise'); nrIn = y; y = await denoise(y, sr, c.nr.profile, c.nr, q => step(0.05 + 0.7 * q, 'Taking out the noise')); nrOut = y; }
    if (c.eq && c.eq.on) { step(0.8, 'Voice EQ'); y = eq(y, sr, c.eq); await yieldNow(); }
    if (c.deess > 0) { step(0.84, 'Softening S sounds'); y = deess(y, sr, +c.deess); await yieldNow(); }
    if (c.comp > 0) { step(0.88, 'Compressing'); y = compress(y, sr, +c.comp); await yieldNow(); }
    if (c.level > 0) { step(0.91, 'Evening it out'); y = level(y, sr, +c.level); await yieldNow(); }
    if (c.loud != null && c.loud !== false) { step(0.95, 'Setting the loudness'); y = loudness(y, sr, +c.loud); }
    step(1, 'Done'); return keep ? { y, nrIn, nrOut } : y;
  }
  // Where the sound is quiet for a while (for tightening long pauses): [[start, end], ...] in seconds
  function pauses(x, sr, minLen = 0.7, belowDb = -42) {
    const w = Math.floor(sr * 0.02), thr = db2(belowDb), out = []; let st = -1;
    for (let o = 0; o + w <= x.length; o += w) { let m = 0; for (let i = 0; i < w; i++) m = Math.max(m, Math.abs(x[o + i])); const q = m < thr; if (q && st < 0) st = o; if (!q && st >= 0) { if ((o - st) / sr >= minLen) out.push([st / sr, o / sr]); st = -1; } }
    if (st >= 0 && (x.length - st) / sr >= minLen) out.push([st / sr, x.length / sr]); return out;
  }
  // Peaks for drawing: [min, max] pairs per column
  function peaks(x, cols) { const out = new Float32Array(cols * 2), per = x.length / cols; for (let c = 0; c < cols; c++) { let lo = 1, hi = -1; const a = Math.floor(c * per), b = Math.min(x.length, Math.floor((c + 1) * per) + 1); for (let i = a; i < b; i++) { const v = x[i]; if (v < lo) lo = v; if (v > hi) hi = v; } if (a >= b) { lo = 0; hi = 0; } out[c * 2] = lo; out[c * 2 + 1] = hi; } return out; }
  // A spectrogram strip: columns x rows of 0..1 levels (dB scaled), on a log frequency scale
  const FS = 10 * Math.log10(Math.pow(N / 4, 2));   // a full scale sine through the Hann window
  function spectrogram(x, sr, a, b, cols, rows) {
    const re = new Float64Array(N), im = new Float64Array(N), out = new Float32Array(cols * rows), i0 = Math.floor(a * sr), i1 = Math.floor(b * sr), fmin = 40, fmax = Math.min(16000, sr / 2);
    for (let c = 0; c < cols; c++) { const o = Math.floor(i0 + (i1 - i0) * (c + 0.5) / cols) - N / 2; for (let i = 0; i < N; i++) { const j = o + i; re[i] = (j >= 0 && j < x.length ? x[j] : 0) * win[i] * win[i]; im[i] = 0; } fft(re, im);
      for (let r = 0; r < rows; r++) { const f0 = fmin * Math.pow(fmax / fmin, r / rows), f1 = fmin * Math.pow(fmax / fmin, (r + 1) / rows), k0 = Math.max(1, Math.floor(f0 / sr * N)), k1 = Math.max(k0 + 1, Math.ceil(f1 / sr * N)); let p = 0; for (let k = k0; k < k1 && k < BINS; k++) p = Math.max(p, re[k] * re[k] + im[k] * im[k]); out[(rows - 1 - r) * cols + c] = cl((10 * Math.log10(p + 1e-20) - FS + 90) / 80, 0, 1); } }   // dB below a full scale sine, -90..-10 shown
    return out;
  }
  function wav(chans, sr) {   // 16 bit WAV from one or two Float32 channels
    const n = chans[0].length, ch = chans.length, buf = new ArrayBuffer(44 + n * ch * 2), dv = new DataView(buf), ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { dv.setInt16(o, Math.round(cl(chans[c][i], -1, 1) * 32767), true); o += 2; }
    return new Blob([buf], { type: 'audio/wav' });
  }
  return { eq, compress, hasHum, profile, quietest, denoise, rnnoise, rumble, hum, deess, declick, level, lufs, limit, loudness, chain, pauses, peaks, spectrogram, wav, N, HOP };
})();
if (typeof module !== 'undefined') module.exports = AudioFX;

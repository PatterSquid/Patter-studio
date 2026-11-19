/* VoiceFX: the stages that take a recording from a poor microphone towards a close, dry, even voice (November 2026:
   "record with a shitty mic and still get studio quality", "no background noise", "coming directly from his mouth").
   Plain JavaScript on 48 kHz mono Float32, used by AudioFX.chain around the AI voice cleaner. Each stage measures the
   recording first and only takes away what it measured, so a good recording passes through nearly untouched:
   - declip: peaks the microphone or the sound card cut flat are drawn back in.
   - tones, detone: steady tones (mains buzz and its harmonics, a monitor's whine) found wherever they are and notched.
   - dry: the room. The echo that follows every sound is predicted from the sound a moment earlier and taken away
     (weighted prediction error, Nakatani et al. 2010), by plain filtering.
   - pops: a blast of air on the microphone (P and B) is a burst far under the voice; only the bottom is ducked.
   - match: the long term spectrum of his voice against the average male voice measured 20 cm from the mouth (Byrne et
     al. 1994, Table II), the difference smoothed to about an octave and partly corrected: the microphone's colour goes,
     his own voice stays.
   - ride: every phrase brought towards the same loudness by a slow hand on the fader, never touching the pauses.
   - gate: the gaps between words turned right down, opened a moment before each word by looking ahead.
   Long jobs yield now and then so the page stays alive. */
const VoiceFX = (() => {
  const A = AudioFX, cl = (v, a, b) => v < a ? a : v > b ? b : v, db2 = d => Math.pow(10, d / 20), lg = v => 10 * Math.log10(v + 1e-20);
  const yieldNow = () => new Promise(r => setTimeout(r, 0));

  /* ---------- FFT of any power of two size, root Hann windows, frames a quarter apart ---------- */
  const ffts = {};
  function FFT(n) {
    if (ffts[n]) return ffts[n]; const c = new Float64Array(n / 2), s = new Float64Array(n / 2), r = new Uint32Array(n), w = new Float64Array(n);
    for (let i = 0; i < n / 2; i++) { c[i] = Math.cos(-2 * Math.PI * i / n); s[i] = Math.sin(-2 * Math.PI * i / n); }
    for (let i = 0, j = 0; i < n; i++) { r[i] = j; let b = n >> 1; while (j & b) { j ^= b; b >>= 1; } j |= b; }
    for (let i = 0; i < n; i++) w[i] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
    function run(re, im, inv) {
      for (let i = 0; i < n; i++) { const j = r[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (let len = 2; len <= n; len <<= 1) { const h = len >> 1, st = n / len;
        for (let i = 0; i < n; i += len) for (let k = 0; k < h; k++) { const wr = c[k * st], wi = inv ? -s[k * st] : s[k * st], p = i + k, q = p + h, xr = re[q] * wr - im[q] * wi, xi = re[q] * wi + im[q] * wr; re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi; } }
      if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
    return (ffts[n] = { run, win: w });
  }
  const framesOf = (len, n) => Math.ceil((len + n) / (n >> 2)) + 1;
  // Every frame of x goes to fn(re, im, frame). With out, the frame (as fn left it) is added back into out.
  async function stft(x, n, fn, out) {
    const F = FFT(n), hop = n >> 2, w = F.win, re = new Float64Array(n), im = new Float64Array(n), len = x.length, frames = framesOf(len, n);
    for (let f = 0; f < frames; f++) {
      const o0 = f * hop - n; for (let i = 0; i < n; i++) { const j = o0 + i; re[i] = (j >= 0 && j < len ? x[j] : 0) * w[i]; im[i] = 0; } F.run(re, im); fn(re, im, f);
      if (out) { F.run(re, im, true); for (let i = 0; i < n; i++) { const j = o0 + i; if (j >= 0 && j < len) out[j] += re[i] * w[i] * 0.5; } }   // root Hann twice, a quarter apart, adds up to 2
      if (f % 500 === 499) await yieldNow();
    }
  }
  // one gain per bin (0 .. n/2) on a whole spectrum
  function gains(re, im, g, n) { for (let k = 0; k <= n >> 1; k++) { const v = g[k]; re[k] *= v; im[k] *= v; if (k > 0 && k < n >> 1) { re[n - k] *= v; im[n - k] *= v; } } }
  // Bins grouped into third octaves (those too low to have a bin of their own are joined to the next)
  function bandMap(n, sr) { const bins = (n >> 1) + 1, of = new Int16Array(bins), seen = []; for (let k = 0; k < bins; k++) { const b = cl(Math.round(3 * Math.log2(Math.max(k, 1) * sr / n / 1000)), -14, 13); if (!seen.length || seen[seen.length - 1] !== b) seen.push(b); of[k] = seen.length - 1; }
    const cnt = new Float64Array(seen.length); for (let k = 0; k < bins; k++) cnt[of[k]]++; return { of, B: seen.length, fc: seen.map(b => 1000 * Math.pow(2, b / 3)), cnt }; }
  async function bandEnergy(x, sr, n) { const M = bandMap(n, sr), frames = framesOf(x.length, n), E = new Float32Array(frames * M.B), h = n >> 1; await stft(x, n, (re, im, f) => { const o = f * M.B; for (let k = 0; k <= h; k++) E[o + M.of[k]] += re[k] * re[k] + im[k] * im[k]; }); M.E = E; M.frames = frames; return M; }
  const pct = (arr, q) => { const s = Float32Array.from(arr).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };
  // level of short blocks in dB, and the level speech sits at (its louder blocks), for thresholds that follow the recording
  function blocks(x, sr, sec = 0.02) { const w = Math.max(1, Math.floor(sr * sec)), n = Math.floor(x.length / w), L = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; const o = i * w; for (let j = 0; j < w; j++) { const v = x[o + j]; s += v * v; } L[i] = lg(s / w); } return L; }
  const speechLevel = (x, sr) => pct(blocks(x, sr), 0.9);

  /* ---------- clipped peaks ----------
     A peak cut flat sits at one level for a few samples running. Each such run is redrawn as the curve that leaves the
     wave with the slope it had going in and meets it with the slope it has coming out. */
  function declip(x, sr, info) {
    const n = x.length; let mx = 0; for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); if (a > mx) mx = a; } if (mx < 0.02) return x;
    const thr = mx * 0.98; let runs = 0, hit = 0; for (let i = 0; i < n; i++) if (Math.abs(x[i]) >= thr) { let j = i; while (j + 1 < n && Math.abs(x[j + 1]) >= thr && x[j + 1] * x[i] > 0) j++; if (j > i) { runs++; hit += j - i + 1; } i = j; }
    if (info) info.clipped = runs; if (runs < Math.max(3, n / sr * 0.5)) { if (info) info.clipped = 0; return x; }   // a handful of flat samples in a whole recording is just its loudest peak
    const out = Float32Array.from(x); let top = mx;
    for (let i = 2; i < n - 2; i++) { if (Math.abs(x[i]) < thr) continue; let j = i; while (j + 1 < n - 2 && Math.abs(x[j + 1]) >= thr && x[j + 1] * x[i] > 0) j++;
      if (j > i) { const a = i - 1, b = j + 1, L = b - a, p0 = x[a], p1 = x[b], m0 = (x[a] - x[a - 1]) * L, m1 = (x[b + 1] - x[b]) * L, sg = x[i] > 0 ? 1 : -1;
        for (let k = i; k <= j; k++) { const u = (k - a) / L, u2 = u * u, u3 = u2 * u; let v = (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; v = cl(v * sg, thr, thr * 2.2) * sg; out[k] = v; if (Math.abs(v) > top) top = Math.abs(v); } }
      i = j; }
    if (top > 0.98) { const k = 0.98 / top; for (let i = 0; i < n; i++) out[i] *= k; }   // room for the peaks that were put back
    return out;
  }

  /* ---------- steady tones: mains buzz and its harmonics, whines ----------
     Speech moves about; a buzz sits on one frequency for the whole recording. So in a fine spectrum (3 Hz a bin) the
     level each bin has in its quieter frames shows the tones standing clear of everything around them. */
  async function tones(x, sr) {
    const n = 16384, hop = n >> 2, F = FFT(n), bins = n >> 1, total = Math.max(1, Math.floor((x.length - n) / hop)), use = Math.min(total, 240), P = new Float32Array(use * bins), re = new Float64Array(n), im = new Float64Array(n);
    if (x.length < n * 2) return [];
    for (let u = 0; u < use; u++) { const o = Math.floor(u * (total - 1) / Math.max(1, use - 1)) * hop; for (let i = 0; i < n; i++) { re[i] = x[o + i] * F.win[i] * F.win[i]; im[i] = 0; } F.run(re, im); for (let k = 0; k < bins; k++) P[u * bins + k] = re[k] * re[k] + im[k] * im[k]; if (u % 40 === 39) await yieldNow(); }
    const L = new Float32Array(bins), col = new Float32Array(use); for (let k = 0; k < bins; k++) { for (let u = 0; u < use; u++) col[u] = P[u * bins + k]; L[k] = lg(pct(col, 0.2)); }
    const out = [], k0 = Math.ceil(40 * n / sr), k1 = Math.floor(16000 * n / sr), near = [];
    for (let k = k0; k < k1; k++) { let top = true; for (let j = k - 3; j <= k + 3; j++) if (L[j] > L[k]) { top = false; break; } if (!top) continue;
      const w = Math.round(cl(k * 0.25, 10, 70)); near.length = 0; for (let j = Math.max(2, k - w); j <= Math.min(bins - 1, k + w); j++) if (Math.abs(j - k) > 3) near.push(L[j]); const base = pct(near, 0.5), up = L[k] - base;
      if (up >= 10) { const a = L[k - 1], b = L[k], c = L[k + 1], d = (a - c) / (2 * (a - 2 * b + c) || 1); out.push({ f: +((k + cl(d, -0.5, 0.5)) * sr / n).toFixed(2), up: +up.toFixed(1) }); } }
    out.sort((p, q) => q.up - p.up); return out.slice(0, 16).sort((p, q) => p.f - q.f);
  }
  function detone(x, sr, list) { let y = x; for (const t of list || []) { if (!(t.f > 20 && t.f < sr / 2 - 200)) continue; const bw = Math.max(3, t.f * 0.005); y = A.biquad(y, A.coef('notch', t.f, sr, t.f / bw)); } return y; }
  // Is it mains? (most of the tones sit on multiples of 50 or of 60 Hz)
  function mains(list) { if (!list || !list.length) return 0; for (const base of [50, 60]) { let n = 0; for (const t of list) { const h = Math.round(t.f / base); if (h >= 1 && Math.abs(t.f - h * base) < Math.max(1.5, t.f * 0.004)) n++; } if (n >= Math.max(1, list.length * 0.6)) return base; } return 0; }

  /* ---------- the room ----------
     In a room every sound is followed by fainter copies of itself off the walls, so part of what the microphone hears
     now can be predicted from what it heard a thirtieth to a fifth of a second ago. The voice itself cannot be: it has
     moved on. dry() finds, for every frequency up to 8 kHz, the filter that best predicts now from then (weighted
     prediction error, WPE: Nakatani et al. 2010, Yoshioka and Nakatani 2012; the weighting stops loud speech swamping
     the sums) and takes the predicted part away. It is plain filtering, the same all the way through, so it cannot
     gurgle or pump. The filters are learned from about half a minute of frames spread over the recording, so the time
     it takes does not grow with the length. How much of the sound could be predicted is the measure of the room
     (info.room.echo, dB under the sound: about -25 in a dead room or close to the microphone, -13 across a desk);
     with little to take, little is taken. amount 0..1. */
  const WPE = { n: 2048, taps: 16, delay: 3, its: 5, top: 8000, run: 300, runs: 10 };   // 43 ms frames 11 ms apart; now is predicted from 32 to 190 ms ago
  async function dry(x, sr, amount = 0.7, info) {
    if (!(amount > 0)) return x; const n = WPE.n, hop = n >> 2, K = WPE.taps, DL = WPE.delay, H = DL + K - 1, KB = Math.min(n >> 1, Math.floor(WPE.top * n / sr)), F = FFT(n), total = framesOf(x.length, n);
    const RL = WPE.run, nr = Math.max(1, Math.min(WPE.runs, Math.floor(total / (RL + H)))), FL = Math.min(total, RL + H), Yr = new Float32Array(nr * FL * KB), Yi = new Float32Array(nr * FL * KB), re = new Float64Array(n), im = new Float64Array(n);
    if (total < H + 40) return x;
    // the frames the filters are learned from: runs of frames in a row (each needs the ones before it), spread evenly
    for (let r = 0; r < nr; r++) { const f0 = nr === 1 ? 0 : Math.floor(r * (total - FL) / (nr - 1));
      for (let f = 0; f < FL; f++) { const o0 = (f0 + f) * hop - n; for (let i = 0; i < n; i++) { const j = o0 + i; re[i] = (j >= 0 && j < x.length ? x[j] : 0) * F.win[i]; im[i] = 0; } F.run(re, im); const o = (r * FL + f) * KB; for (let k = 0; k < KB; k++) { Yr[o + k] = re[k]; Yi[o + k] = im[k]; } }
      await yieldNow(); }
    const Gr = new Float32Array(KB * K), Gi = new Float32Array(KB * K), Rr = new Float64Array(K * K), Ri = new Float64Array(K * K), Pr = new Float64Array(K), Pi = new Float64Array(K), yr = new Float64Array(K), yi = new Float64Array(K), lam = new Float64Array(nr * FL), gr = new Float64Array(K), gi = new Float64Array(K);
    let took = 0, had = 0;
    for (let k = 1; k < KB; k++) {
      let mean = 0; for (let q = 0; q < nr * FL; q++) { const a = Yr[q * KB + k], b = Yi[q * KB + k]; lam[q] = a * a + b * b; mean += lam[q]; } mean /= nr * FL; const eps = mean * 1e-4 + 1e-20;
      for (let it = 0; it < WPE.its; it++) {
        Rr.fill(0); Ri.fill(0); Pr.fill(0); Pi.fill(0);
        for (let r = 0; r < nr; r++) for (let f = H; f < FL; f++) { const q = r * FL + f, w = 1 / (lam[q] > eps ? lam[q] : eps), cr = Yr[q * KB + k], ci = Yi[q * KB + k];
          for (let i = 0; i < K; i++) { const p = (q - DL - i) * KB + k; yr[i] = Yr[p]; yi[i] = Yi[p]; }
          for (let i = 0; i < K; i++) { const ar = yr[i] * w, ai = yi[i] * w, o = i * K; Pr[i] += ar * cr + ai * ci; Pi[i] += ai * cr - ar * ci; for (let j = i; j < K; j++) { Rr[o + j] += ar * yr[j] + ai * yi[j]; Ri[o + j] += ai * yr[j] - ar * yi[j]; } } }
        let tr = 0; for (let i = 0; i < K; i++) tr += Rr[i * K + i]; const load = tr / K * 1e-4 + 1e-30; for (let i = 0; i < K; i++) { Rr[i * K + i] += load; for (let j = 0; j < i; j++) { Rr[i * K + j] = Rr[j * K + i]; Ri[i * K + j] = -Ri[j * K + i]; } }
        solve(Rr, Ri, Pr, Pi, gr, gi, K);
        // what is left when the predicted part is taken away: its power weights the next round
        const last = it === WPE.its - 1 && k * sr / n >= 300 && k * sr / n <= 4000;
        for (let r = 0; r < nr; r++) for (let f = H; f < FL; f++) { const q = r * FL + f, cr = Yr[q * KB + k], ci = Yi[q * KB + k]; let zr = cr, zi = ci; for (let i = 0; i < K; i++) { const p = (q - DL - i) * KB + k; zr -= gr[i] * Yr[p] + gi[i] * Yi[p]; zi -= gr[i] * Yi[p] - gi[i] * Yr[p]; } lam[q] = zr * zr + zi * zi;
          if (last) { const e = cr * cr + ci * ci; if (e > mean) { had += e; took += (cr - zr) * (cr - zr) + (ci - zi) * (ci - zi); } } }
      }
      for (let i = 0; i < K; i++) { Gr[k * K + i] = gr[i]; Gi[k * K + i] = gi[i]; }
      if (k % 24 === 0) await yieldNow();
    }
    // how much of the voiced sound was echo of what came before, and so how much to take
    const echo = 10 * Math.log10(took / (had + 1e-30) + 1e-12), s = cl((echo + 23) / 6, 0, 1), mix = cl(amount * (0.3 + 0.7 * s), 0, 1); if (info) info.room = { echo: +echo.toFixed(1), mix: +mix.toFixed(2) };
    const out = new Float32Array(x.length), hr = new Float32Array(H * KB), hi = new Float32Array(H * KB); let head = 0;   // the last H frames, newest at head - 1
    await stft(x, n, (re2, im2) => {
      const slot = head % H; for (let k = 1; k < KB; k++) { const cr = re2[k], ci = im2[k]; let zr = cr, zi = ci, o = k * K;
        for (let i = 0; i < K; i++) { const p = ((head - DL - i) % H + H) % H * KB + k, a = hr[p], b = hi[p], g1 = Gr[o + i], g2 = Gi[o + i]; zr -= mix * (g1 * a + g2 * b); zi -= mix * (g1 * b - g2 * a); }
        re2[k] = zr; im2[k] = zi; re2[n - k] = zr; im2[n - k] = -zi; hr[slot * KB + k] = cr; hi[slot * KB + k] = ci; }
      head++; }, out);
    return out;
  }
  // R g = P for a Hermitian R (real and imaginary parts apart), by elimination with the largest pivot
  function solve(Ar, Ai, Br, Bi, xr, xi, K) {
    const ar = Float64Array.from(Ar), ai = Float64Array.from(Ai), br = Float64Array.from(Br), bi = Float64Array.from(Bi);
    for (let c = 0; c < K; c++) { let pv = c, best = 0; for (let r = c; r < K; r++) { const m = ar[r * K + c] * ar[r * K + c] + ai[r * K + c] * ai[r * K + c]; if (m > best) { best = m; pv = r; } }
      if (pv !== c) { for (let j = 0; j < K; j++) { let t = ar[c * K + j]; ar[c * K + j] = ar[pv * K + j]; ar[pv * K + j] = t; t = ai[c * K + j]; ai[c * K + j] = ai[pv * K + j]; ai[pv * K + j] = t; } let t = br[c]; br[c] = br[pv]; br[pv] = t; t = bi[c]; bi[c] = bi[pv]; bi[pv] = t; }
      const dr = ar[c * K + c], di = ai[c * K + c], dd = dr * dr + di * di + 1e-300;
      for (let r = c + 1; r < K; r++) { const nr2 = ar[r * K + c], ni = ai[r * K + c], fr = (nr2 * dr + ni * di) / dd, fi = (ni * dr - nr2 * di) / dd; if (fr === 0 && fi === 0) continue;
        for (let j = c; j < K; j++) { const pr = ar[c * K + j], pi = ai[c * K + j]; ar[r * K + j] -= fr * pr - fi * pi; ai[r * K + j] -= fr * pi + fi * pr; } br[r] -= fr * br[c] - fi * bi[c]; bi[r] -= fr * bi[c] + fi * br[c]; } }
    for (let r = K - 1; r >= 0; r--) { let sr2 = br[r], si = bi[r]; for (let j = r + 1; j < K; j++) { const pr = ar[r * K + j], pi = ai[r * K + j]; sr2 -= pr * xr[j] - pi * xi[j]; si -= pr * xi[j] + pi * xr[j]; } const dr = ar[r * K + r], di = ai[r * K + r], dd = dr * dr + di * di + 1e-300; xr[r] = (sr2 * dr + si * di) / dd; xi[r] = (si * dr - sr2 * di) / dd; }
  }

  /* ---------- pops: a blast of air on the microphone ----------
     Under 120 Hz a P or a B can be twenty times the voice for a few hundredths of a second. The bottom is taken out on
     its own (filtered there and back, so nothing shifts in time) and turned down while it towers over the band above. */
  function lowpass2(x, sr, f) { let y = A.biquad(x, A.coef('lp', f, sr, 0.707)); y.reverse(); y = A.biquad(y, A.coef('lp', f, sr, 0.707)); y.reverse(); return y; }
  function pops(x, sr, amount = 0.6, info) {
    if (!(amount > 0)) return x; const n = x.length, low = lowpass2(x, sr, 120), mid = A.biquad(A.biquad(x, A.coef('hp', 180, sr, 0.707)), A.coef('lp', 700, sr, 0.707)), w = Math.floor(sr * 0.005), nb = Math.ceil(n / w), g = new Float32Array(nb + 1), k = db2(4 + 8 * (1 - amount)), lim = db2(-24 * amount), ref = Math.pow(10, speechLevel(x, sr) / 20) * 0.05; let hits = 0, was = false;
    for (let i = 0; i < nb; i++) { let a = 0, b = 0; const o = i * w, e = Math.min(n, o + w * 2); for (let j = o; j < e; j++) { a += low[j] * low[j]; b += mid[j] * mid[j]; } a = Math.sqrt(a / (e - o)); b = Math.sqrt(b / (e - o)); const allow = b * k + ref, v = a > allow ? Math.max(lim, allow / a) : 1; g[i] = v; if (v < 0.5 && !was) hits++; was = v < 0.5; }
    g[nb] = g[nb - 1]; for (let i = 1; i <= nb; i++) g[i] = Math.min(g[i], g[i - 1] + (1 - g[i - 1]) * 0.12 + 0.004);   // let go over about 50 ms
    for (let i = nb - 1; i >= 0; i--) g[i] = Math.min(g[i], g[i + 1] + 0.34);   // and come down over 15 ms ahead of the burst
    if (info) info.pops = hits; const out = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i / w, a = Math.floor(p), u = p - a, v = g[a] * (1 - u) + g[Math.min(nb, a + 1)] * u; out[i] = x[i] - (1 - v) * low[i]; }
    return out;
  }

  /* ---------- tone: his voice's long term spectrum against a close microphone's ----------
     Byrne et al. 1994, "An international comparison of long term average speech spectra", Table II, male talkers,
     third octave levels in dB SPL for speech of 70 dB overall, microphone 20 cm from the mouth. */
  const LT_F = [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000];
  const LT_M = [38.6, 43.5, 54.4, 57.7, 56.8, 58.2, 59.7, 60.0, 62.4, 62.6, 60.6, 55.7, 53.1, 53.7, 52.3, 48.7, 48.9, 47.0, 46.0, 44.4, 43.3, 42.4, 41.9, 39.8, 40.4];
  // A produced voice is brighter than talk in a room: the lift a close condenser and a light hand on the desk give
  // (presence from 3 kHz, most at 5 to 8 kHz), about half of what a typical clean modern recording measures over Byrne.
  const LT_UP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 1.5, 2.5, 3.5, 4, 4, 4, 3.5, 3, 2];
  const TONE_N = 4096;
  function target(f) { const lf = Math.log(cl(f, LT_F[0], LT_F[LT_F.length - 1])); let i = 0; while (i < LT_F.length - 2 && Math.log(LT_F[i + 1]) < lf) i++; const a = Math.log(LT_F[i]), b = Math.log(LT_F[i + 1]), u = cl((lf - a) / (b - a), 0, 1); return (LT_M[i] + LT_UP[i]) * (1 - u) + (LT_M[i + 1] + LT_UP[i + 1]) * u; }
  // the correction, a dB figure per third octave: { fc, db, has (bands the recording has any voice in) }
  async function tone(x, sr) {
    const n = TONE_N, S = await bandEnergy(x, sr, n), B = S.B, T = S.frames, tot = new Float32Array(T); for (let t = 0; t < T; t++) { let s = 0; for (let b = 0; b < B; b++) s += S.E[t * B + b]; tot[t] = lg(s); }
    const top = pct(tot, 0.95), m = new Float64Array(B); let c = 0; for (let t = 0; t < T; t++) if (tot[t] > top - 25) { for (let b = 0; b < B; b++) m[b] += S.E[t * B + b]; c++; } if (!c) return null;
    // per bin, against the target per hertz (a third octave's level less its width)
    const d = new Float64Array(B), has = new Uint8Array(B); let s = 0, w = 0; for (let b = 0; b < B; b++) { d[b] = (target(S.fc[b]) - 10 * Math.log10(S.fc[b])) - lg(m[b] / c / S.cnt[b]); if (S.fc[b] >= 250 && S.fc[b] <= 4000) { s += d[b]; w++; } }
    for (let b = 0; b < B; b++) d[b] -= s / (w || 1);
    // where the recording has next to nothing (a microphone that stops at 7 kHz) there is nothing to bring up, only hiss
    let edge = B; for (let b = B - 1; b >= 0 && S.fc[b] > 3000; b--) { if (d[b] > 15) edge = b; else break; } for (let b = 0; b < B; b++) has[b] = b < edge && S.fc[b] >= 70 ? 1 : 0;
    for (let b = 0; b < B; b++) d[b] = has[b] ? cl(d[b], -10, 10) : 0;
    for (let pass = 0; pass < 2; pass++) { const q = Float64Array.from(d); for (let b = 0; b < B; b++) d[b] = (q[Math.max(0, b - 1)] + 2 * q[b] + q[Math.min(B - 1, b + 1)]) / 4; }
    return { fc: S.fc.slice(), db: Array.from(d, v => +v.toFixed(2)) };
  }
  async function match(x, sr, amount = 0.5, info) {
    if (!(amount > 0)) return x; const cur = await tone(x, sr); if (!cur) return x; if (info) info.tone = cur;
    const n = TONE_N, h = n >> 1, gb = new Float32Array(h + 1), lf = cur.fc.map(f => Math.log(f)), B = lf.length;
    for (let k = 0; k <= h; k++) { const lk = Math.log(Math.max(k, 1) * sr / n); let b = 0; while (b < B - 2 && lf[b + 1] < lk) b++; const u = cl((lk - lf[b]) / (lf[b + 1] - lf[b]), 0, 1); gb[k] = db2(cl((cur.db[b] * (1 - u) + cur.db[b + 1] * u) * amount, -7, 7)); }
    const out = new Float32Array(x.length); await stft(x, n, (re, im) => gains(re, im, gb, n), out); return out;
  }

  /* ---------- riding the level: every phrase towards the same loudness ----------
     Loudness is read every tenth of a second (as the ear hears it), only where he is talking; the gain that would bring
     each moment to the recording's own average is smoothed over a second and a half and held through the pauses, so
     nothing pumps and no gap is turned up. */
  function ride(x, sr, amount = 0.6) {
    if (!(amount > 0)) return x; const k = A.biquad(A.biquad(x, A.coef('hs', 1500, sr, 0.707, 4)), A.coef('hp', 38, sr, 0.5)), st = Math.floor(sr * 0.1), bl = st * 4, nb = Math.max(1, Math.floor((x.length - bl) / st) + 1), L = new Float32Array(nb);
    for (let i = 0; i < nb; i++) { let s = 0; const o = i * st, e = Math.min(x.length, o + bl); for (let j = o; j < e; j++) s += k[j] * k[j]; L[i] = lg(s / Math.max(1, e - o)); }
    const top = pct(L, 0.9), act = i => L[i] > top - 16; let s = 0, c = 0; for (let i = 0; i < nb; i++) if (act(i)) { s += Math.pow(10, L[i] / 10); c++; } if (!c) return x; const mean = lg(s / c), lim = 4 + 8 * amount;
    const g = new Float32Array(nb); let last = 0, first = -1; for (let i = 0; i < nb; i++) { if (act(i)) { last = cl((mean - L[i]) * amount, -lim, lim); if (first < 0) first = i; } g[i] = last; } for (let i = 0; i < first; i++) g[i] = g[first];
    const sm = new Float32Array(nb), R = 7; for (let i = 0; i < nb; i++) { let a = 0, w = 0; for (let j = -R; j <= R; j++) { const q = cl(i + j, 0, nb - 1), ww = R + 1 - Math.abs(j); a += g[q] * ww; w += ww; } sm[i] = a / w; }
    const out = new Float32Array(x.length), off = bl / 2 / st; for (let i = 0; i < x.length; i++) { const p = cl(i / st - off, 0, nb - 1), a = Math.floor(p), u = p - a; out[i] = x[i] * db2(sm[a] * (1 - u) + sm[Math.min(nb - 1, a + 1)] * u); }
    return out;
  }

  /* ---------- the gaps between words ----------
     Listens to the voice above 250 Hz (what is left in a gap after the cleaner is low rumble, which must not count as
     talking), a millisecond at a time. He is talking wherever that is within `under` dB of his speaking level, and for
     60 ms before and 120 ms after (soft starts and endings of words are far quieter than their vowels, so the word's
     edges are kept by time, not by level). A blip of a few milliseconds (a lip click) is not talking. Everywhere else
     is turned down by `range` dB, eased over about 40 ms. Returns the gain for every millisecond: gateApply lays it on
     later, after the compressor, so the compressor can never lift what is in the gaps. */
  function gate(x, sr, o = {}) {
    const range = cl(o.range == null ? 24 : +o.range, 0, 80), under = cl(o.under == null ? 30 : +o.under, 12, 60), key = A.biquad(A.biquad(x, A.coef('hp', 250, sr, 0.707)), A.coef('hp', 250, sr, 0.707)), w = Math.round(sr / 1000), nb = Math.ceil(x.length / w), over = new Uint8Array(nb);
    const thr = Math.pow(10, (speechLevel(key, sr) - under) / 20); for (let i = 0; i < nb; i++) { let m = 0; const e = Math.min(x.length, (i + 1) * w); for (let j = i * w; j < e; j++) { const a = Math.abs(key[j]); if (a > m) m = a; } over[i] = m >= thr ? 1 : 0; }
    // talking: over the threshold for at least 10 of the 40 ms around
    const talk = new Uint8Array(nb); let c = 0; for (let i = 0; i < nb + 20; i++) { if (i < nb) c += over[i]; if (i >= 40) c -= over[i - 40]; const m = i - 20; if (m >= 0 && m < nb) talk[m] = over[m] && c >= 10 ? 1 : 0; }
    // breaths: a breath is sound with no voice in it (nothing down where the vocal cords hum, 80 to 450 Hz) that goes on
    // longer than any consonant does: a stretch on its own of 120 ms or more, or a quarter of a second or more before
    // the voice starts or after it stops (the 100 ms next to the voice is left alone: that may be an S or an H)
    const breath = cl(+o.breath || 0, 0, 60), br = new Uint8Array(nb); let nbr = 0;
    if (breath > 0) { const lf = A.biquad(A.biquad(x, A.coef('hp', 80, sr, 0.707)), A.coef('lp', 450, sr, 0.707)), vt = Math.pow(10, (speechLevel(lf, sr) - 22) / 20), voiced = new Uint8Array(nb);
      for (let i = 0; i < nb; i++) { let m = 0; const e = Math.min(x.length, (i + 1) * w); for (let j = i * w; j < e; j++) { const a = Math.abs(lf[j]); if (a > m) m = a; } voiced[i] = m >= vt ? 1 : 0; }
      for (let i = 0; i < nb; i++) { if (!talk[i]) continue; let b = i, gap = 0; for (let j = i + 1; j < nb && gap < 60; j++) { if (talk[j]) { b = j; gap = 0; } else gap++; }   // one stretch of sound: i .. b
        let v0 = -1, v1 = -1, run = 0; for (let j = i; j <= b; j++) { run = voiced[j] ? run + 1 : 0; if (run >= 20) { if (v0 < 0) v0 = j - 19; v1 = j; } }   // voice: 20 ms of it running
        const mark = (p, q) => { if (q - p < 60) return; for (let j = p; j <= q; j++) br[j] = 1; nbr++; };
        if (v0 < 0) { if (b - i >= 120) mark(i, b); } else { if (v0 - i >= 250) mark(i, v0 - 100); if (b - v1 >= 300) mark(v1 + 150, b); }
        i = b; } }
    const g = new Float32Array(nb), lo = db2(-range), soft = Math.max(lo, db2(-breath)); let last = -1e9, next = 1e9; for (let i = 0; i < nb; i++) { if (talk[i] && !br[i]) last = i; g[i] = i - last <= 120 ? 1 : lo; } for (let i = nb - 1; i >= 0; i--) { if (talk[i] && !br[i]) next = i; if (next - i <= 60) g[i] = 1; }
    for (let i = 0; i < nb; i++) if (br[i]) g[i] = soft;
    for (let pass = 0; pass < 2; pass++) { const q = Float32Array.from(g), R = 10; let a = 0; for (let i = -R; i <= R; i++) a += q[cl(i, 0, nb - 1)]; for (let i = 0; i < nb; i++) { g[i] = a / (2 * R + 1); a += q[cl(i + R + 1, 0, nb - 1)] - q[cl(i - R, 0, nb - 1)]; } }
    return { g, w, breaths: nbr };
  }
  function gateApply(x, G) { const out = new Float32Array(x.length), g = G.g, w = G.w, nb = g.length; for (let i = 0; i < x.length; i++) { const p = i / w, a = Math.min(nb - 1, Math.floor(p)), u = p - a; out[i] = x[i] * (g[a] * (1 - u) + g[Math.min(nb - 1, a + 1)] * u); } return out; }

  /* ---------- what is wrong with this recording, in figures (for the report in the panel) ---------- */
  async function inspect(x, sr) {
    const L = blocks(x, sr), speech = pct(L, 0.9), floor = pct(L, 0.05); let mx = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > mx) mx = a; }
    const info = {}; declip(x, sr, info); const tn = await tones(x, sr);
    return { speech: +speech.toFixed(1), floor: +floor.toFixed(1), snr: +(speech - floor).toFixed(1), peak: +(20 * Math.log10(mx + 1e-9)).toFixed(1), clipped: info.clipped || 0, tones: tn, mains: mains(tn), secs: +(x.length / sr).toFixed(1) };
  }
  return { declip, tones, detone, mains, dry, WPE, pops, tone, match, ride, gate, gateApply, inspect, speechLevel, bandEnergy, FFT, LT_F, LT_M };
})();
if (typeof module !== 'undefined') module.exports = VoiceFX;

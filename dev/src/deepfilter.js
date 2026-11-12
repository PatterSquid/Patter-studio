/* DeepFilter: AI voice cleaning with DeepFilterNet 3 (Schröter et al. 2023, MIT or Apache 2.0, github.com/Rikorose/DeepFilterNet),
   in place of RNNoise (which he found horrendous on recorded voice). The three official ONNX models (encoder, ERB gain decoder,
   deep filter decoder, about 8.6 MB) run with ONNX Runtime Web on the processor in a helper, and everything around them is
   our own port of libDF and df/enhance.py: the 960 point Vorbis windowed STFT at 48 kHz (hop 480), the 32 band ERB and 96
   bin complex features with their running normalisation, two frames of look ahead, the ERB gains on every bin, the five
   frame deep filter on the lowest 96 bins, and the overlap add back. Long recordings go through in ten second pieces with
   two seconds of run up each, so memory stays small and the models' memory settles before what is kept.
   Files: `denoise/` in the update repo (the models) and the runtime from `cutout/`, downloaded once into IndexedDB
   `patter-denoise`. process(x, { atten, onProgress }) takes 48 kHz mono and gives back the cleaned sound, same length,
   no delay. atten (dB) limits how much is taken away: 100 is everything it can, 12 keeps a little room. */
const DeepFilter = (() => {
  const home = () => (typeof window !== 'undefined' && window.PATTER_HOME) || 'https://raw.githubusercontent.com/PatterSquid/patter-studio/main/';
  const base = () => (typeof window !== 'undefined' && window.PATTER_DENOISE) || home() + 'denoise/';
  let dbp = null; const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-denoise', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const get = async k => { const d = await db(); return new Promise(res => { const q = d.transaction('f').objectStore('f').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); };
  const put = async (k, v) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }); };
  let state = 'unknown';
  async function check() { try { state = (await get('manifest')) && (await get('enc')) && (await get('wasm')) ? 'ready' : 'none'; } catch (e) { state = 'none'; } return state; }
  async function download(onProgress) {
    const r = await fetch(base() + 'manifest.json', { cache: 'no-store' }); if (!r.ok) throw new Error('Could not reach the update repo (' + r.status + '). Check the internet connection and try again.');
    const m = await r.json(), files = [['js', m.ort.js], ['mjs', m.ort.mjs], ['wasm', m.ort.wasm], ['enc', m.models.enc], ['erb', m.models.erb], ['df', m.models.df]];
    const total = files.reduce((s, [, f]) => s + (m.sizes[f] || 0), 0); let done = 0; const got = {};
    for (const [k, f] of files) { const q = await fetch(base() + f, { cache: 'no-store' }); if (!q.ok) throw new Error('Download failed (' + q.status + ') on ' + f + '. Try again.');
      const rd = q.body.getReader(), ps = []; for (;;) { const { done: end, value } = await rd.read(); if (end) break; ps.push(value); done += value.length; if (onProgress) onProgress(Math.min(0.99, done / (total || 1))); } got[k] = new Blob(ps); }
    for (const [k] of files) await put(k, got[k]); await put('manifest', m); state = 'ready'; if (onProgress) onProgress(1); return true;
  }

  /* ---------- the helper: everything below runs in a worker ---------- */
  function helper() {
    const SR = 48000, FFT = 960, HOP = 480, NERB = 32, NDF = 96, ORD = 5, LA = 2, NF = FFT / 2 + 1, ALPHA = 0.99;
    let S = null;
    const freq2erb = f => 9.265 * Math.log1p(f / (24.7 * 9.265)), erb2freq = n => 24.7 * 9.265 * (Math.exp(n / 9.265) - 1);
    const ERB = (() => { const fw = SR / FFT, lo = freq2erb(0), hi = freq2erb(SR / 2), step = (hi - lo) / NERB, e = []; let prev = 0, over = 0;
      for (let i = 1; i <= NERB; i++) { const fb = Math.round(erb2freq(lo + i * step) / fw); let n = fb - prev - over; if (n < 2) { over = 2 - n; n = 2; } else over = 0; e.push(n); prev = fb; }
      e[NERB - 1] += 1; const too = e.reduce((a, b) => a + b, 0) - NF; if (too > 0) e[NERB - 1] -= too; return e; })();
    const WIN = new Float32Array(FFT); for (let i = 0; i < FFT; i++) { const s = Math.sin(0.5 * Math.PI * (i + 0.5) / (FFT / 2)); WIN[i] = Math.sin(0.5 * Math.PI * s * s); }
    const WNORM = 1 / (FFT * FFT / (2 * HOP));
    // A mixed radix FFT (2, 3, 5) for 960 points, complex in place on split arrays
    const fftPlan = (() => { const N = FFT, f = []; let n = N; for (const p of [4, 2, 3, 5]) while (n % p === 0) { f.push(p); n /= p; }
      const cos = new Float64Array(N), sin = new Float64Array(N); for (let i = 0; i < N; i++) { cos[i] = Math.cos(-2 * Math.PI * i / N); sin[i] = Math.sin(-2 * Math.PI * i / N); } return { f, cos, sin }; })();
    function fft(re, im, inv) {   // recursive Cooley Tukey over the factors, out of place through scratch
      const N = re.length, { f, cos, sin } = fftPlan, sg = inv ? -1 : 1;
      const rec = (ir, ii, n, stride, off, or, oi, oo, fi) => {
        if (n === 1) { or[oo] = ir[off]; oi[oo] = ii[off]; return; }
        const p = f[fi], m = n / p;
        for (let q = 0; q < p; q++) rec(ir, ii, m, stride * p, off + q * stride, or, oi, oo + q * m, fi + 1);
        const tr = new Float64Array(p), ti = new Float64Array(p);
        for (let k = 0; k < m; k++) {
          for (let q = 0; q < p; q++) { const idx = oo + q * m + k, tw = (q * k * stride) % N, c = cos[tw], s = sg * sin[tw]; const xr = or[idx], xi = oi[idx]; tr[q] = xr * c - xi * s; ti[q] = xr * s + xi * c; }
          for (let r = 0; r < p; r++) { let sr = 0, si = 0; for (let q = 0; q < p; q++) { const tw = ((q * r * m * stride) % N), c = cos[tw], s = sg * sin[tw]; sr += tr[q] * c - ti[q] * s; si += tr[q] * s + ti[q] * c; } or[oo + r * m + k] = sr; oi[oo + r * m + k] = si; }
        }
      };
      const or = new Float64Array(N), oi = new Float64Array(N); rec(re, im, N, 1, 0, or, oi, 0, 0); re.set(or); im.set(oi);
    }
    // STFT the way libDF does it: each frame is the previous hop and this one, windowed, scaled by 1/960 on the way in
    function analysis(x, T) { const re = new Float64Array(FFT), im = new Float64Array(FFT), Sr = new Float32Array(T * NF), Si = new Float32Array(T * NF);
      for (let t = 0; t < T; t++) { for (let i = 0; i < FFT; i++) { const j = (t - 1) * HOP + i; re[i] = (j >= 0 && j < x.length ? x[j] : 0) * WIN[i]; im[i] = 0; } fft(re, im, false);
        for (let k = 0; k < NF; k++) { Sr[t * NF + k] = re[k] * WNORM; Si[t * NF + k] = im[k] * WNORM; } } return { Sr, Si }; }
    function synthesis(Er, Ei, T) { const re = new Float64Array(FFT), im = new Float64Array(FFT), out = new Float32Array(T * HOP), mem = new Float32Array(HOP);
      for (let t = 0; t < T; t++) { for (let k = 0; k < NF; k++) { re[k] = Er[t * NF + k]; im[k] = Ei[t * NF + k]; } for (let k = NF; k < FFT; k++) { re[k] = Er[t * NF + FFT - k]; im[k] = -Ei[t * NF + FFT - k]; }
        fft(re, im, true); for (let i = 0; i < HOP; i++) out[t * HOP + i] = re[i] * WIN[i] + mem[i]; for (let i = 0; i < HOP; i++) mem[i] = re[HOP + i] * WIN[HOP + i]; } return out; }
    function features(Sr, Si, T) { const fe = new Float32Array(T * NERB), fr = new Float32Array(T * NDF), fi = new Float32Array(T * NDF), st = new Float32Array(NERB), us = new Float32Array(NDF);
      for (let b = 0; b < NERB; b++) st[b] = -60 + b * (-30 / (NERB - 1)); for (let k = 0; k < NDF; k++) us[k] = 0.001 + k * (-0.0009 / (NDF - 1));
      for (let t = 0; t < T; t++) { let i = 0; for (let b = 0; b < NERB; b++) { let s = 0; const w = ERB[b]; for (let j = 0; j < w; j++, i++) { const a = Sr[t * NF + i], c = Si[t * NF + i]; s += a * a + c * c; } const e = 10 * Math.log10(s / w + 1e-10); st[b] = e * (1 - ALPHA) + st[b] * ALPHA; fe[t * NERB + b] = (e - st[b]) / 40; }
        for (let k = 0; k < NDF; k++) { const a = Sr[t * NF + k], c = Si[t * NF + k]; us[k] = Math.hypot(a, c) * (1 - ALPHA) + us[k] * ALPHA; const q = Math.sqrt(us[k]); fr[t * NDF + k] = a / q; fi[t * NDF + k] = c / q; } }
      return { fe, fr, fi }; }
    async function runPiece(F, a, b) {   // frames a..b of the features, looked ahead by two frames as the model wants
      const T = b - a, ferb = new Float32Array(T * NERB), fsp = new Float32Array(2 * T * NDF);
      for (let t = 0; t < T; t++) { const s = a + t + LA; if (s >= b) continue; ferb.set(F.fe.subarray(s * NERB, s * NERB + NERB), t * NERB); fsp.set(F.fr.subarray(s * NDF, s * NDF + NDF), t * NDF); fsp.set(F.fi.subarray(s * NDF, s * NDF + NDF), T * NDF + t * NDF); }
      const T_ = ort.Tensor, e = await S.enc.run({ feat_erb: new T_('float32', ferb, [1, 1, T, NERB]), feat_spec: new T_('float32', fsp, [1, 2, T, NDF]) });
      const m = await S.erb.run({ emb: e.emb, e3: e.e3, e2: e.e2, e1: e.e1, e0: e.e0 }), c = await S.df.run({ emb: e.emb, c0: e.c0 });
      const out = { m: m.m.data, c: c.coefs.data }; Object.values(e).forEach(x => x.dispose && x.dispose()); return out; }
    async function process(x, atten, say) {
      const n0 = x.length, T = Math.ceil((n0 + FFT) / HOP), { Sr, Si } = analysis(x, T), F = features(Sr, Si, T), M = new Float32Array(T * NERB), C = new Float32Array(T * NDF * 10), CH = 1000, WARM = 200;
      for (let s = 0; s < T; s += CH) { const a = Math.max(0, s - WARM), b = Math.min(T, s + CH), r = await runPiece(F, a, b), k = s - a; M.set(r.m.subarray(k * NERB, (b - a) * NERB), s * NERB); C.set(r.c.subarray(k * NDF * 10, (b - a) * NDF * 10), s * NDF * 10); say(0.05 + 0.85 * b / T); }
      const Er = new Float32Array(T * NF), Ei = new Float32Array(T * NF), lim = atten > 0 && atten < 100 ? Math.pow(10, -atten / 20) : 0;
      for (let t = 0; t < T; t++) {
        let i = 0; for (let b = 0; b < NERB; b++) { const g = M[t * NERB + b]; for (let j = 0; j < ERB[b]; j++, i++) { Er[t * NF + i] = Sr[t * NF + i] * g; Ei[t * NF + i] = Si[t * NF + i] * g; } }
        for (let k = 0; k < NDF; k++) { let yr = 0, yi = 0; for (let o = 0; o < ORD; o++) { const s = t - (ORD - 1 - LA) + o; if (s < 0 || s >= T) continue; const cr = C[(t * NDF + k) * 10 + o * 2], ci = C[(t * NDF + k) * 10 + o * 2 + 1], ar = Sr[s * NF + k], ai = Si[s * NF + k]; yr += ar * cr - ai * ci; yi += ar * ci + ai * cr; } Er[t * NF + k] = yr; Ei[t * NF + k] = yi; }
        if (lim) for (let k = 0; k < NF; k++) { Er[t * NF + k] = Er[t * NF + k] * (1 - lim) + Sr[t * NF + k] * lim; Ei[t * NF + k] = Ei[t * NF + k] * (1 - lim) + Si[t * NF + k] * lim; }
      }
      const y = synthesis(Er, Ei, T), d = FFT - HOP; return y.slice(d, d + n0);
    }
    self.onmessage = async e => { const m = e.data;
      try {
        if (m.type === 'init') {
          (0, eval)(m.js + '\n;self.ort = typeof ort !== "undefined" ? ort : self.ort;'); ort.env.wasm.wasmPaths = { mjs: m.mjs, wasm: 'about:blank' }; ort.env.wasm.wasmBinary = m.wasm; ort.env.wasm.numThreads = 1;
          const mk = b => ort.InferenceSession.create(b, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
          S = { enc: await mk(m.enc), erb: await mk(m.erb), df: await mk(m.df) }; self.postMessage({ type: 'ready' });
        } else if (m.type === 'run') { const y = await process(m.x, m.atten, p => self.postMessage({ type: 'progress', j: m.j, p })); self.postMessage({ type: 'done', j: m.j, y }, [y.buffer]); }
      } catch (x) { self.postMessage({ type: 'error', j: m.j, msg: String((x && x.message) || x) }); }
    };
  }

  let W = null, starting = null, J = 0; const jobs = new Map(), urls = [];
  async function start() {
    if (W) return W; if (starting) return starting;
    starting = (async () => {
      if (state !== 'ready') await check(); if (state !== 'ready') throw new Error('The AI voice cleaner is not downloaded yet.');
      const [js, mjs, wasm, enc, erb, df] = await Promise.all(['js', 'mjs', 'wasm', 'enc', 'erb', 'df'].map(get));
      const u = URL.createObjectURL(new Blob(['(' + helper.toString() + ')()'], { type: 'text/javascript' })); urls.push(u); const w = new Worker(u);
      const ready = new Promise((res, rej) => { w.onmessage = e => { const m = e.data; if (m.type === 'ready') res(); else if (m.type === 'error' && m.j == null) rej(new Error(m.msg)); else { const Jb = jobs.get(m.j); if (!Jb) return; if (m.type === 'progress') { Jb.p && Jb.p(m.p); return; } jobs.delete(m.j); m.type === 'error' ? Jb.rej(new Error(m.msg)) : Jb.res(m.y); } }; w.onerror = ev => rej(new Error(ev.message || 'The AI voice cleaner failed to start')); });
      // the app runs from a file on his computer, where helpers cannot open blob: links made by the page: everything goes over as data
      const [jsT, mjsT, wasmB, encB, erbB, dfB] = await Promise.all([js.text(), mjs.text(), wasm.arrayBuffer(), enc.arrayBuffer(), erb.arrayBuffer(), df.arrayBuffer()]);
      let b64 = ''; const bytes = new TextEncoder().encode(mjsT.replace(/import\.meta\.url/g, '"https://patter.invalid/ort.mjs"')); for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      w.postMessage({ type: 'init', js: jsT, mjs: 'data:text/javascript;base64,' + btoa(b64), wasm: wasmB, enc: encB, erb: erbB, df: dfB }, [wasmB, encB, erbB, dfB]);
      try { await ready; } catch (e) { w.terminate(); throw e; } return (W = w);
    })();
    try { return await starting; } finally { starting = null; }
  }
  async function process(x, o = {}) { const w = await start(), j = ++J, c = new Float32Array(x); return new Promise((res, rej) => { jobs.set(j, { res, rej, p: o.onProgress }); w.postMessage({ type: 'run', j, x: c, atten: o.atten == null ? 100 : +o.atten }, [c.buffer]); }); }
  function stop() { if (W) W.terminate(); W = null; jobs.forEach(Jb => Jb.rej(new Error('Stopped'))); jobs.clear(); }
  return { check, download, process, start, stop, get state() { return state; } };
})();
if (typeof window !== 'undefined') window.DeepFilter = DeepFilter;

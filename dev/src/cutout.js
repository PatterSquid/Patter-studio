/* Background remover for the Thumbnail tab. BiRefNet lite (MIT) run with ONNX Runtime Web, on the graphics card through
   WebGPU when there is one (a second or two), else on the processor (slow). The model and the runtime are downloaded once
   from the update repo (`cutout/`, about 140 MB) and kept in IndexedDB `patter-cutout`.
   A helper (worker) does the lot so the page never stalls: the model's 1024 by 1024 mask, then a guided filter that lets
   the mask follow the picture's own edges (hair, ears, fingers) at full size, a tidy of faint haze, and colour clean up
   (blur fusion foreground estimation, Forte and Pitie 2021) so no halo of the old background is left round the edges.
   cut(bitmap) gives { mask, fg }: the mask as alpha, and the foreground colours as a solid picture. refine(bitmap, mask)
   redoes the colours after the mask has been brushed by hand. */
const Cutout = (() => {
  const base = () => (typeof window !== 'undefined' && window.PATTER_CUTOUT) || ((typeof window !== 'undefined' && window.PATTER_HOME) || 'https://raw.githubusercontent.com/PatterSquid/patter-studio/main/') + 'cutout/';
  let dbp = null; const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-cutout', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const get = async k => { const d = await db(); return new Promise(res => { const q = d.transaction('f').objectStore('f').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); };
  const put = async (k, v) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }); };
  let state = 'unknown', man = null;

  // Is it downloaded? ('ready', 'none')
  async function check() { try { const m = await get('manifest'); if (m && (await get('model'))) { man = m; state = 'ready'; } else state = 'none'; } catch (e) { state = 'none'; } return state; }
  async function download(onProgress) {
    const r = await fetch(base() + 'manifest.json', { cache: 'no-store' }); if (!r.ok) throw new Error('Could not reach the update repo (' + r.status + '). Check the internet connection and try again.');
    const m = await r.json(), files = [m.ort.js, m.ort.mjs, m.ort.wasm, ...m.model.parts], total = files.reduce((s, f) => s + (m.sizes[f] || 0), 0); let done = 0; const got = {};
    for (const f of files) {
      const q = await fetch(base() + f, { cache: 'no-store' }); if (!q.ok) throw new Error('Download failed (' + q.status + ') on ' + f + '. Try again.');
      const rd = q.body.getReader(), parts = []; for (;;) { const { done: end, value } = await rd.read(); if (end) break; parts.push(value); done += value.length; if (onProgress) onProgress(Math.min(0.99, done / (total || 1))); }
      got[f] = new Blob(parts);
    }
    const model = new Blob(m.model.parts.map(p => got[p]));
    if (m.model.sha256 && crypto.subtle) { const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await model.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join(''); if (h !== m.model.sha256) throw new Error('The download came through damaged. Try again.'); }
    await put('js', got[m.ort.js]); await put('mjs', got[m.ort.mjs]); await put('wasm', got[m.ort.wasm]); await put('model', model); await put('manifest', m);
    man = m; state = 'ready'; if (onProgress) onProgress(1); return true;
  }

  /* ---------- the helper ---------- */
  function helper() {
    let sess = null, how = '';
    const cl = (v, a, b) => v < a ? a : v > b ? b : v;
    // box blur with running sums, separable, edges clamped (r may be fractional, rounded)
    function box(src, w, h, r, out) {
      r = Math.max(1, Math.round(r)); const tmp = new Float32Array(w * h); out = out || new Float32Array(w * h); const n = 2 * r + 1;
      for (let y = 0; y < h; y++) { const o = y * w; let s = 0; for (let k = -r; k <= r; k++) s += src[o + cl(k, 0, w - 1)];
        for (let x = 0; x < w; x++) { tmp[o + x] = s / n; s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
      for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[cl(k, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) { out[y * w + x] = s / n; s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
      return out;
    }
    // guided filter (He, Sun and Tang) with the picture's brightness as the guide: the mask takes on its edges
    function guided(I, p, w, h, r, eps) {
      const N = w * h, mI = box(I, w, h, r), mp = box(p, w, h, r), Ip = new Float32Array(N), II = new Float32Array(N);
      for (let i = 0; i < N; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
      const mIp = box(Ip, w, h, r), mII = box(II, w, h, r), a = new Float32Array(N), b = new Float32Array(N);
      for (let i = 0; i < N; i++) { const v = mII[i] - mI[i] * mI[i], c = mIp[i] - mI[i] * mp[i]; a[i] = c / (v + eps); b[i] = mp[i] - a[i] * mI[i]; }
      const ma = box(a, w, h, r), mb = box(b, w, h, r), q = new Float32Array(N); for (let i = 0; i < N; i++) q[i] = ma[i] * I[i] + mb[i]; return q;
    }
    // blur fusion foreground estimation, twice (wide then tight): the colour each edge pixel would have without the background
    function foreground(rgb, al, w, h, sc) {
      const N = w * h, F = [0, 1, 2].map(c => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = rgb[i * 4 + c] / 255; return a; }), I = F.map(a => a.slice()), B = F.map(a => a.slice());
      const inv = new Float32Array(N); for (let i = 0; i < N; i++) inv[i] = 1 - al[i];
      for (const r of [Math.max(3, 90 * sc), Math.max(1, 6 * sc)]) {
        const bA = box(al, w, h, r), bI = box(inv, w, h, r), FA = new Float32Array(N), BA = new Float32Array(N);
        for (let c = 0; c < 3; c++) {
          for (let i = 0; i < N; i++) { FA[i] = F[c][i] * al[i]; BA[i] = B[c][i] * inv[i]; }
          const bF = box(FA, w, h, r), bB = box(BA, w, h, r);
          for (let i = 0; i < N; i++) { const a = al[i], Fh = bF[i] / (bA[i] + 1e-5), Bh = bB[i] / (bI[i] + 1e-5), d = I[c][i] - a * Fh - (1 - a) * Bh; F[c][i] = cl(Fh + a * d, 0, 1); B[c][i] = cl(Bh + (1 - a) * d, 0, 1); }
        }
      }
      const out = new Uint8ClampedArray(N * 4); for (let i = 0; i < N; i++) { const a = al[i], k = a > 0.98 ? 0 : 1; for (let c = 0; c < 3; c++) out[i * 4 + c] = k ? F[c][i] * 255 : rgb[i * 4 + c]; out[i * 4 + 3] = 255; } return out;
    }
    const pixels = (bm, w, h) => { const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.imageSizeSmoothingQuality = 'high'; g.drawImage(bm, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    const toBlob = async (data, w, h) => { const c = new OffscreenCanvas(w, h); c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0); return c.convertToBlob({ type: 'image/png' }); };
    async function cut(bm, o) {
      const S = 1024, mean = [0.485, 0.456, 0.406], sd = [0.229, 0.224, 0.225], px = pixels(bm, S, S), x = new Float32Array(3 * S * S);
      for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) x[c * S * S + i] = (px[i * 4 + c] / 255 - mean[c]) / sd[c];
      const t0 = performance.now(), res = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, S, S]) }), raw = res[sess.outputNames[0]].data, ms = performance.now() - t0;
      // up to working size (long side at most 2560), then edges from the picture itself
      const k = Math.min(1, (o.max || 2560) / Math.max(bm.width, bm.height)), w = Math.max(1, Math.round(bm.width * k)), h = Math.max(1, Math.round(bm.height * k)), sc = Math.max(w, h) / 1024;
      const mc = new OffscreenCanvas(S, S), mg = mc.getContext('2d'), md = new Uint8ClampedArray(S * S * 4); for (let i = 0; i < S * S; i++) { md[i * 4 + 3] = 255; md[i * 4] = md[i * 4 + 1] = md[i * 4 + 2] = Math.round(cl(raw[i], 0, 1) * 255); } mg.putImageData(new ImageData(md, S, S), 0, 0);
      const up = pixels(mc, w, h), rgb = pixels(bm, w, h), N = w * h, p = new Float32Array(N), I = new Float32Array(N);
      for (let i = 0; i < N; i++) { p[i] = up[i * 4] / 255; I[i] = (0.299 * rgb[i * 4] + 0.587 * rgb[i * 4 + 1] + 0.114 * rgb[i * 4 + 2]) / 255; }
      let a = guided(I, p, w, h, Math.max(2, 4 * sc), 1e-3);
      // the filter only fixes edges: well inside or well outside stays as the model said
      for (let i = 0; i < N; i++) { const m = p[i]; let v = m < 0.02 ? 0 : m > 0.98 ? 1 : cl(a[i], 0, 1); v = cl((v - 0.04) / 0.92, 0, 1); a[i] = v; }
      const mask = new Uint8ClampedArray(N * 4); for (let i = 0; i < N; i++) { mask[i * 4] = mask[i * 4 + 1] = mask[i * 4 + 2] = 255; mask[i * 4 + 3] = Math.round(a[i] * 255); }
      const fg = foreground(rgb, a, w, h, sc);
      return { w, h, ms: Math.round(ms), how, mask: await toBlob(mask, w, h), fg: await toBlob(fg, w, h) };
    }
    async function refine(bm, mbm) {
      const w = mbm.width, h = mbm.height, N = w * h, rgb = pixels(bm, w, h), m = pixels(mbm, w, h), a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = m[i * 4 + 3] / 255;
      return { fg: await toBlob(foreground(rgb, a, w, h, Math.max(w, h) / 1024), w, h) };
    }
    self.onmessage = async e => { const m = e.data;
      try {
        if (m.type === 'init') {
          importScripts(m.js); ort.env.wasm.wasmPaths = { mjs: m.mjs, wasm: m.wasm }; ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
          const tries = m.cpu ? ['wasm'] : ['webgpu', 'wasm']; let err = null;
          for (const ep of tries) { try { if (ep === 'webgpu' && !(navigator.gpu && await navigator.gpu.requestAdapter())) continue; sess = await ort.InferenceSession.create(m.model, { executionProviders: [ep], graphOptimizationLevel: 'all' }); how = ep; break; } catch (x) { err = x; sess = null; } }
          if (!sess) throw err || new Error('Could not start the background remover');
          self.postMessage({ type: 'ready', how });
        } else if (m.type === 'cut') { const r = await cut(m.bm, m); self.postMessage(Object.assign({ type: 'done', j: m.j }, r)); }
        else if (m.type === 'refine') { const r = await refine(m.bm, m.mask); self.postMessage(Object.assign({ type: 'done', j: m.j }, r)); }
      } catch (x) { self.postMessage({ type: 'error', j: m.j, msg: String((x && x.message) || x) }); }
    };
  }

  let W = null, how = '', jobs = new Map(), jn = 0, urls = [];
  async function start(opts = {}) {
    if (W) return W; if (state !== 'ready') await check(); if (state !== 'ready') throw new Error('The background remover is not downloaded yet.');
    const [js, mjs, wasm, model] = await Promise.all(['js', 'mjs', 'wasm', 'model'].map(get));
    const u = (b, t) => { const x = URL.createObjectURL(new Blob([b], { type: t })); urls.push(x); return x; };
    const w = new Worker(u('(' + helper.toString() + ')()', 'text/javascript'));
    const ready = new Promise((res, rej) => { w.onmessage = e => { const m = e.data; if (m.type === 'ready') { how = m.how; res(); } else if (m.type === 'error' && m.j == null) rej(new Error(m.msg)); else { const J = jobs.get(m.j); if (!J) return; jobs.delete(m.j); m.type === 'error' ? J.rej(new Error(m.msg)) : J.res(m); } }; w.onerror = ev => rej(new Error(ev.message || 'The background remover stopped')); });
    w.postMessage({ type: 'init', js: u(js, 'text/javascript'), mjs: u(mjs, 'text/javascript'), wasm: u(wasm, 'application/wasm'), model: await model.arrayBuffer(), cpu: !!opts.cpu });
    try { await ready; } catch (e) { w.terminate(); throw e; }
    W = w; return W;
  }
  function job(msg, transfer) { const j = ++jn; return new Promise((res, rej) => { jobs.set(j, { res, rej }); W.postMessage(Object.assign({ j }, msg), transfer || []); }); }
  // bm: an ImageBitmap (copied for the helper). Gives { w, h, mask: Blob, fg: Blob, ms, how }
  async function cut(bm, opts = {}) { await start(opts); const c = await createImageBitmap(bm); return job({ type: 'cut', bm: c, max: opts.max }, [c]); }
  async function refine(bm, maskBm) { await start(); const c = await createImageBitmap(bm), m = await createImageBitmap(maskBm); return job({ type: 'refine', bm: c, mask: m }, [c, m]); }
  function stop() { if (W) W.terminate(); W = null; jobs.forEach(J => J.rej(new Error('Stopped'))); jobs.clear(); urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }
  return { check, download, cut, refine, stop, get state() { return state; }, get how() { return how; } };
})();

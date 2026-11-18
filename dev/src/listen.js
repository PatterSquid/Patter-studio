/* Listen: writes down what he says in a recording, on his own computer, so a voiceover alone can drive his character
   (the words choose the gestures and time the mouth). Whisper base English (Radford and others 2022, MIT, OpenAI), the
   8 bit ONNX export from the sherpa-onnx project (Apache 2.0), run with the ONNX Runtime from `cutout/` in a helper.
   Around the two models everything is our own: the 400 point Hann STFT at 16 kHz (hop 160) with Whisper's 80 band
   Slaney mel filters, log, clamp and scale; the encoder once per piece; then the decoder a token at a time (the best
   token each step, its attention memory handed back in), until it says it is done. Long recordings go through in
   pieces of under 28 seconds cut at pauses, so no word is split. Checked against a Python port with onnxruntime.
   Files: `listen/` in the update repo (encoder 29 MB, decoder 131 MB in parts, token list), downloaded once into
   IndexedDB `patter-listen`. transcribe(x, { onProgress }) takes 16 kHz mono and gives back the text, punctuation and
   all. It is a listener, not a judge: Glasgow speech comes out mostly right, and he can correct it in the Script box. */
const Listen = (() => {
  const home = () => (typeof window !== 'undefined' && window.PATTER_HOME) || 'https://raw.githubusercontent.com/PatterSquid/patter-studio/main/';
  const base = () => (typeof window !== 'undefined' && window.PATTER_LISTEN) || home() + 'listen/';
  let dbp = null; const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-listen', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const get = async k => { const d = await db(); return new Promise(res => { const q = d.transaction('f').objectStore('f').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); };
  const put = async (k, v) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }); };
  let state = 'unknown';
  async function check() { try { state = (await get('manifest')) && (await get('enc')) && (await get('dec')) && (await get('tokens')) && (await get('wasm')) ? 'ready' : 'none'; } catch (e) { state = 'none'; } return state; }
  async function download(onProgress) {
    const r = await fetch(base() + 'manifest.json', { cache: 'no-store' }); if (!r.ok) throw new Error('Could not reach the update repo (' + r.status + '). Check the internet connection and try again.');
    const m = await r.json(), files = [['js', [m.ort.js]], ['mjs', [m.ort.mjs]], ['wasm', [m.ort.wasm]], ['enc', m.models.enc], ['dec', m.models.dec], ['tokens', [m.models.tokens]]];
    const total = files.reduce((s, [, fs]) => s + fs.reduce((a, f) => a + (m.sizes[f] || 0), 0), 0); let done = 0; const got = {};
    for (const [k, fs] of files) { const ps = []; for (const f of fs) { const q = await fetch(base() + f, { cache: 'no-store' }); if (!q.ok) throw new Error('Download failed (' + q.status + ') on ' + f + '. Try again.');
      const rd = q.body.getReader(); for (;;) { const { done: end, value } = await rd.read(); if (end) break; ps.push(value); done += value.length; if (onProgress) onProgress(Math.min(0.99, done / (total || 1))); } } got[k] = new Blob(ps); }
    for (const [k] of files) await put(k, got[k]); await put('manifest', m); state = 'ready'; if (onProgress) onProgress(1); return true;
  }

  /* ---------- the helper: everything below runs in a worker ---------- */
  function helper() {
    const SR = 16000, NFFT = 400, HOP = 160, NB = NFFT / 2 + 1, NMEL = 80, NFR = 3000, CTX = 448, SOT = 50257, NOTS = 50362, EOT = 50256;
    let S = null, TOK = null, FB = null, DIM = 512, NL = 6;
    /* When each word was said. The decoder looks along the sound as it writes each piece of a word (its cross attention); a few
       of its heads follow the place being spoken (Whisper's own timing heads for this model: layer and head). Their weights are
       evened out (each moment across the pieces), smoothed along time (a median of seven) and averaged, and the cheapest
       monotonic path through that picture (dynamic time warping) says where each piece starts: Radford and others 2022,
       OpenAI's timing.py. Resolution 20 ms; pauses stick to the word after them, which LipSync sorts out against the sound. The
       model file is the same one: three inner results are added to its list of outputs as it is loaded. */
    const HEADS = [[3, 3], [4, 7], [5, 1], [5, 5], [5, 7]], ATTL = [3, 4, 5], ATT = ATTL.map(l => '/Softmax_' + (2 * l + 1) + '_output_0'); let hasAtt = false;
    function withAttention(buf) {
      try {
        const u = new Uint8Array(buf); let p = 0;
        const vint = () => { let v = 0, m = 1; for (;;) { const b = u[p++]; v += (b & 127) * m; if (b < 128) return v; m *= 128; } };
        let g0 = -1, gBody = 0, gLen = 0, gEnd = 0;
        while (p < u.length) { const at = p, tag = vint(), fld = Math.floor(tag / 8), wt = tag & 7;
          if (wt === 0) vint(); else if (wt === 1) p += 8; else if (wt === 5) p += 4; else if (wt === 2) { const len = vint(); if (fld === 7) { g0 = at; gBody = p; gLen = len; gEnd = p + len; } p += len; } else return null; }
        if (g0 < 0 || gEnd > u.length) return null;
        const te = new TextEncoder(), add = []; ATT.forEach(nm => { const nb = te.encode(nm); add.push(0x62, nb.length + 2, 0x0A, nb.length, ...nb); });   // graph output: a value named after the inner result
        const nl = gLen + add.length, lv = []; let v = nl; while (v >= 128) { lv.push((v % 128) | 128); v = Math.floor(v / 128); } lv.push(v);
        const out = new Uint8Array(g0 + 1 + lv.length + nl + (u.length - gEnd)); let o = 0;
        out.set(u.subarray(0, g0), o); o += g0; out[o++] = 0x3A; out.set(lv, o); o += lv.length; out.set(u.subarray(gBody, gEnd), o); o += gLen; out.set(add, o); o += add.length; out.set(u.subarray(gEnd), o);
        return out.buffer;
      } catch (e) { return null; }
    }
    function wordTimes(out, rows, nfr) {   // rows[step][head] = Float32Array(nfr); step i wrote out[i], the last step ended the piece
      const N = rows.length, H = HEADS.length, M = nfr; if (N < 2 || M < 4) return null;
      const m = new Float32Array(N * M), col = new Float32Array(N), tmp = new Float32Array(M), win = new Float32Array(7);
      for (let h = 0; h < H; h++) {
        for (let i = 0; i < N; i++) { const r = rows[i][h]; let sum = 0; for (let j = 0; j < M; j++) sum += r[j]; sum = sum || 1; for (let j = 0; j < M; j++) r[j] /= sum; }
        for (let j = 0; j < M; j++) { let mean = 0; for (let i = 0; i < N; i++) mean += rows[i][h][j]; mean /= N; let sd = 0; for (let i = 0; i < N; i++) { const d = rows[i][h][j] - mean; sd += d * d; } sd = Math.sqrt(sd / N) || 1e-9; for (let i = 0; i < N; i++) rows[i][h][j] = (rows[i][h][j] - mean) / sd; }
        for (let i = 0; i < N; i++) { const r = rows[i][h]; for (let j = 0; j < M; j++) { for (let k = -3; k <= 3; k++) { let q = j + k; if (q < 0) q = -q - 1; if (q >= M) q = 2 * M - 1 - q; win[k + 3] = r[q < 0 ? 0 : q >= M ? M - 1 : q]; } win.sort(); tmp[j] = win[3]; } for (let j = 0; j < M; j++) m[i * M + j] += tmp[j] / H; }
      }
      // the cheapest monotonic path (cost is minus the weight)
      const W = M + 1, D = new Float32Array((N + 1) * W).fill(Infinity), tr = new Uint8Array((N + 1) * W); D[0] = 0;
      for (let i = 1; i <= N; i++) for (let j = 1; j <= M; j++) { const c0 = D[(i - 1) * W + j - 1], c1 = D[(i - 1) * W + j], c2 = D[i * W + j - 1]; let c, t; if (c0 <= c1 && c0 <= c2) { c = c0; t = 0; } else if (c1 <= c2) { c = c1; t = 1; } else { c = c2; t = 2; } D[i * W + j] = c - m[(i - 1) * M + j - 1]; tr[i * W + j] = t; }
      const first = new Int32Array(N).fill(M); { let i = N, j = M; while (i > 0 && j > 0) { first[i - 1] = j - 1; const t = tr[i * W + j]; if (t === 0) { i--; j--; } else if (t === 1) i--; else j--; } }
      const td = new TextDecoder('utf-8'), txt = out.map(id => TOK[id] ? td.decode(TOK[id]) : ''), words = []; let cur = null;
      for (let i = 0; i < out.length && i < N - 1; i++) { if (!cur || txt[i][0] === ' ') { cur = [i, i]; words.push(cur); } else cur[1] = i; }
      return words.map(([a, b]) => { let w = ''; for (let i = a; i <= b; i++) w += txt[i]; return [w.trim(), first[a] / 50, first[Math.min(N - 1, b + 1)] / 50]; }).filter(w => w[0]);
    }
    const COS = new Float32Array(NFFT), SIN = new Float32Array(NFFT), WIN = new Float32Array(NFFT);
    for (let i = 0; i < NFFT; i++) { COS[i] = Math.cos(2 * Math.PI * i / NFFT); SIN[i] = Math.sin(2 * Math.PI * i / NFFT); WIN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / NFFT); }
    function melBank() {   // Slaney's mel scale and area normalising, as Whisper was trained with
      const ls = Math.log(6.4) / 27, h2m = f => f >= 1000 ? 15 + Math.log(f / 1000) / ls : f / (200 / 3), m2h = m => m >= 15 ? 1000 * Math.exp(ls * (m - 15)) : m * (200 / 3);
      const top = h2m(SR / 2), pts = []; for (let i = 0; i < NMEL + 2; i++) pts.push(m2h(top * i / (NMEL + 1)));
      const fb = []; for (let i = 0; i < NMEL; i++) { const lo = pts[i], c = pts[i + 1], hi = pts[i + 2], row = []; for (let k = 0; k < NB; k++) { const f = k * SR / NFFT, v = Math.max(0, Math.min((f - lo) / (c - lo), (hi - f) / (hi - c))) * 2 / (hi - lo); if (v > 0) row.push(k, v); } fb.push(Float32Array.from(row)); } return fb;
    }
    function logMel(x) {   // x: up to 30 s; out: 80 by 3000, row by row
      const n = SR * 30, pad = NFFT / 2, y = new Float32Array(n + 2 * pad); const at = i => i < 0 ? x[-i] || 0 : i < x.length ? x[i] : 0;
      for (let i = 0; i < y.length; i++) { let j = i - pad; if (j >= n) j = 2 * (n - 1) - j; y[i] = at(j); }
      const mel = new Float32Array(NMEL * NFR), fr = new Float32Array(NFFT), pw = new Float32Array(NB); let mx = -1e9;
      // the 400 point transform, split into even and odd halves so each bin is 200 multiplies not 400
      const ev = new Float32Array(NB), od = new Float32Array(NB);
      for (let t = 0; t < NFR; t++) { const o = t * HOP; let any = false; for (let i = 0; i < NFFT; i++) { const v = y[o + i] * WIN[i]; fr[i] = v; if (v !== 0) any = true; }
        if (!any) pw.fill(0); else { ev[0] = fr[0]; od[0] = 0; for (let i = 1; i < NFFT / 2; i++) { ev[i] = fr[i] + fr[NFFT - i]; od[i] = fr[i] - fr[NFFT - i]; } ev[NFFT / 2] = fr[NFFT / 2];
          for (let k = 0; k < NB; k++) { let re = ev[0] + ev[NFFT / 2] * ((k & 1) ? -1 : 1), im = 0, idx = 0; for (let i = 1; i < NFFT / 2; i++) { idx += k; if (idx >= NFFT) idx -= NFFT; re += ev[i] * COS[idx]; im -= od[i] * SIN[idx]; } pw[k] = re * re + im * im; } }
        for (let m = 0; m < NMEL; m++) { const row = FB[m]; let s = 0; for (let j = 0; j < row.length; j += 2) s += pw[row[j]] * row[j + 1]; const v = Math.log10(Math.max(s, 1e-10)); mel[m * NFR + t] = v; if (v > mx) mx = v; } }
      for (let i = 0; i < mel.length; i++) mel[i] = (Math.max(mel[i], mx - 8) + 4) / 4; return mel;
    }
    async function piece(x) {
      const T = ort.Tensor, mel = new T('float32', logMel(x), [1, NMEL, NFR]), e = await S.enc.run({ mel }), ck = e.n_layer_cross_k, cv = e.n_layer_cross_v;
      let k = new T('float32', new Float32Array(NL * CTX * DIM), [NL, 1, CTX, DIM]), v = new T('float32', new Float32Array(NL * CTX * DIM), [NL, 1, CTX, DIM]), toks = [SOT, NOTS], off = 0; const out = [];
      const nfr = Math.max(4, Math.min(1500, Math.ceil(x.length / SR * 50))), rows = [];
      const limit = Math.min(220, Math.ceil(x.length / SR * 9) + 12);   // nobody says more than nine tokens a second: stops a stuck loop
      for (let i = 0; i < limit; i++) {
        const r = await S.dec.run({ tokens: new T('int64', BigInt64Array.from(toks.map(BigInt)), [1, toks.length]), in_n_layer_self_k_cache: k, in_n_layer_self_v_cache: v, n_layer_cross_k: ck, n_layer_cross_v: cv, offset: new T('int64', BigInt64Array.from([BigInt(off)]), [1]) });
        off += toks.length; const lg = r.logits.data, V = r.logits.dims[2], b0 = (r.logits.dims[1] - 1) * V; let best = -1, bv = -1e30;
        if (hasAtt) { const row = HEADS.map(([l, h]) => { const t = r[ATT[ATTL.indexOf(l)]], nt = t.dims[2], F = t.dims[3], o = (h * nt + nt - 1) * F; return Float32Array.from(t.data.subarray(o, o + nfr)); }); rows.push(row); ATT.forEach(nm => r[nm].dispose && r[nm].dispose()); }
        for (let j = 0; j <= EOT; j++) { if (j === EOT && i === 0) continue; const q = lg[b0 + j]; if (q > bv) { bv = q; best = j; } }
        if (k.dispose) k.dispose(); if (v.dispose) v.dispose(); k = r.out_n_layer_self_k_cache; v = r.out_n_layer_self_v_cache; if (r.logits.dispose) r.logits.dispose();
        if (best === EOT) break; out.push(best); toks = [best];
        const L = out.length; if (L >= 12 && out[L - 1] === out[L - 4] && out[L - 2] === out[L - 5] && out[L - 3] === out[L - 6] && out[L - 4] === out[L - 7] && out[L - 5] === out[L - 8] && out[L - 6] === out[L - 9]) { out.length = L - 6; break; }   // going round in circles
      }
      [ck, cv, k, v].forEach(q => q.dispose && q.dispose());
      let words = null; if (hasAtt && rows.length > out.length) { rows.length = out.length + 1; try { words = wordTimes(out, rows, nfr); } catch (e) { words = null; } }
      const bytes = []; out.forEach(id => { const b = TOK[id]; if (b) for (let j = 0; j < b.length; j++) bytes.push(b[j]); }); return { text: new TextDecoder('utf-8').decode(Uint8Array.from(bytes)), words };
    }
    self.onmessage = async e => { const m = e.data;
      try {
        if (m.type === 'init') {
          (0, eval)(m.js + '\n;self.ort = typeof ort !== "undefined" ? ort : self.ort;'); ort.env.wasm.wasmPaths = { mjs: m.mjs, wasm: 'about:blank' }; ort.env.wasm.wasmBinary = m.wasm; ort.env.wasm.numThreads = 1;
          const mk = b => ort.InferenceSession.create(b, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
          let dec = null; const withAtt = withAttention(m.dec); if (withAtt) { try { dec = await mk(withAtt); hasAtt = true; } catch (x) { dec = null; hasAtt = false; } }
          S = { enc: await mk(m.enc), dec: dec || await mk(m.dec) }; FB = melBank();
          TOK = m.tokens.split('\n').map(l => { const s = l.split(' ')[0]; if (!s) return null; try { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } catch (x) { return null; } });
          self.postMessage({ type: 'ready' });
        } else if (m.type === 'run') { const parts = []; let words = []; for (let i = 0; i < m.cuts.length - 1; i++) { const r = await piece(m.x.subarray(m.cuts[i], m.cuts[i + 1])), t0 = m.cuts[i] / SR; parts.push(r.text.trim()); if (words && r.words) r.words.forEach(w => words.push([w[0], +(w[1] + t0).toFixed(2), +(w[2] + t0).toFixed(2)])); else if (r.text.trim()) words = null; self.postMessage({ type: 'progress', j: m.j, p: (i + 1) / (m.cuts.length - 1), text: parts.join(' ') }); } self.postMessage({ type: 'done', j: m.j, y: parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(), words: words && words.length ? words : null }); }
      } catch (x) { self.postMessage({ type: 'error', j: m.j, msg: String((x && x.message) || x) }); }
    };
  }

  let W = null, starting = null, J = 0; const jobs = new Map();
  async function start() {
    if (W) return W; if (starting) return starting;
    starting = (async () => {
      if (state !== 'ready') await check(); if (state !== 'ready') throw new Error('The listening helper is not downloaded yet.');
      const [js, mjs, wasm, enc, dec, tokens] = await Promise.all(['js', 'mjs', 'wasm', 'enc', 'dec', 'tokens'].map(get));
      const u = URL.createObjectURL(new Blob(['(' + helper.toString() + ')()'], { type: 'text/javascript' })), w = new Worker(u);
      const ready = new Promise((res, rej) => { w.onmessage = e => { const m = e.data; if (m.type === 'ready') res(); else if (m.type === 'error' && m.j == null) rej(new Error(m.msg)); else { const Jb = jobs.get(m.j); if (!Jb) return; if (m.type === 'progress') { Jb.p && Jb.p(m.p, m.text); return; } jobs.delete(m.j); m.type === 'error' ? Jb.rej(new Error(m.msg)) : Jb.res(Jb.full ? { text: m.y, words: m.words || null } : m.y); } }; w.onerror = ev => rej(new Error(ev.message || 'The listening helper failed to start')); });
      // the app runs from a file on his computer, where helpers cannot open blob: links made by the page: everything goes over as data
      const [jsT, mjsT, wasmB, encB, decB, tokT] = await Promise.all([js.text(), mjs.text(), wasm.arrayBuffer(), enc.arrayBuffer(), dec.arrayBuffer(), tokens.text()]);
      let b64 = ''; const bytes = new TextEncoder().encode(mjsT.replace(/import\.meta\.url/g, '"https://patter.invalid/ort.mjs"')); for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      w.postMessage({ type: 'init', js: jsT, mjs: 'data:text/javascript;base64,' + btoa(b64), wasm: wasmB, enc: encB, dec: decB, tokens: tokT }, [wasmB, encB, decB]);
      try { await ready; } catch (e) { w.terminate(); throw e; } return (W = w);
    })();
    try { return await starting; } finally { starting = null; }
  }
  /* Where to cut a long recording: at the quietest moment in the last eight seconds of each 28 second stretch. */
  function cuts(x) {
    const SR = 16000, MAX = 28 * SR, out = [0], hop = 320, n = Math.floor(x.length / hop), lv = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const v = x[i * hop + j]; s += v * v; } lv[i] = s; }
    const sm = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -6; k <= 6; k++) { const j = i + k; if (j >= 0 && j < n) { s += lv[j]; c++; } } sm[i] = s / c; }
    let a = 0; while (x.length - a > MAX) { const lo = Math.floor((a + 20 * SR) / hop), hi = Math.floor((a + MAX) / hop); let b = hi, bv = Infinity; for (let i = lo; i <= hi && i < n; i++) if (sm[i] < bv) { bv = sm[i]; b = i; } a = b * hop; out.push(a); }
    out.push(x.length); return out;
  }
  let idleT = null; const rest = () => { clearTimeout(idleT); idleT = setTimeout(() => { if (W && !jobs.size && !starting) { W.terminate(); W = null; } }, 90000); };   // the models are big: let go of them a minute and a half after the last listen
  async function transcribe(x, o = {}) { clearTimeout(idleT); const w = await start(), j = ++J, c = new Float32Array(x), ct = cuts(c); return new Promise((res, rej) => { jobs.set(j, { res: v => { rest(); res(v); }, rej: e => { rest(); rej(e); }, p: o.onProgress, full: !!o.full }); w.postMessage({ type: 'run', j, x: c, cuts: ct }, [c.buffer]); }); }
  /* What was heard in each recording, word by word with times: kept (memory and IndexedDB) so the lip sync can pin every
     word of the script to where it was really said, whatever he has since changed in the Script box. */
  const heardMem = new Map(), heardWait = new Map();
  function heardNow(id) { return heardMem.get(id) || null; }
  async function heard(id) { if (heardMem.has(id)) return heardMem.get(id); let h = null; try { h = await get('heard:' + id); } catch (e) { h = null; } if (h && h.words && !heardMem.has(id)) heardMem.set(id, h); return heardMem.get(id) || null; }
  function keepHeard(id, words, dur, text) { if (!words || !words.length) return null; const h = { v: 1, words, dur: dur || 0, text: text || '' }; heardMem.set(id, h); put('heard:' + id, h).catch(() => { }); if (typeof LipSync !== 'undefined' && LipSync.forget) LipSync.forget(id); return h; }
  /* A recording in the library (a CutMedia id) to words. */
  async function forMedia(id, o = {}) {
    if (heardWait.has(id)) return heardWait.get(id);
    const p = (async () => { const had = await heard(id); if (had && had.text) return had.text;   // listened to already
      const b = await CutMedia.blobOf(id); if (!b) throw new Error('That recording is not in the library any more.'); const x = await LipSync.decode(b); const r = await transcribe(x, Object.assign({}, o, { full: true })); keepHeard(id, r.words, x.length / 16000, r.text); return r.text; })();
    heardWait.set(id, p); try { return await p; } finally { heardWait.delete(id); }
  }
  function stop() { if (W) W.terminate(); W = null; jobs.forEach(Jb => Jb.rej(new Error('Stopped'))); jobs.clear(); }
  return { check, download, transcribe, forMedia, heard, heardNow, keepHeard, start, stop, cuts, get state() { return state; } };
})();
if (typeof window !== 'undefined') window.Listen = Listen;

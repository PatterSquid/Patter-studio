/* CutMedia: the editor's own footage, sound and pictures.
   Files are kept whole (full length, full quality) in this browser's storage. The preview plays them live through hidden
   video elements; exports read every frame exactly with WebCodecs (MP4 and MOV) or by seeking (anything else Edge plays),
   and read the sound as raw samples for the mix. Thumbnails and waveforms are made once, in the background, on import. */
const CutMedia = (() => {
  const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
  const meta = {}, blobs = {}, urls = {}, listeners = [], files = {};
  let tick = 0, version = 0, nudge = 0, thumbTick = 0;
  const bump = (structural) => { tick++; if (structural) version++; if (inWorker) return; clearTimeout(nudge); nudge = setTimeout(() => listeners.forEach(f => { try { f(structural); } catch (e) { } }), 16); };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const nid = () => 'cm' + Date.now().toString(36) + Math.floor(Math.random() * 1e8).toString(36);

  /* ---------- Storage: blobs and their details, in their own database so projects stay light ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { if (typeof indexedDB === 'undefined') return rej(new Error('No storage')); const r = indexedDB.open('patter-cut', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('files', { keyPath: 'id' }); d.createObjectStore('meta', { keyPath: 'id' }); d.createObjectStore('thumbs', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage full')); }); };
  const put = (store, v) => tx(store, 'readwrite', s => s.put(v));
  const get = (store, id) => tx(store, 'readonly', s => s.get(id));
  const del = (store, id) => tx(store, 'readwrite', s => s.delete(id));
  // Details (small) are all loaded at start; files themselves only when something needs them
  let loaded = null;
  function loadAll() { if (inWorker) return Promise.resolve(); return loaded || (loaded = tx('meta', 'readonly', s => s.getAll()).then(list => { (list || []).forEach(m => { meta[m.id] = Object.assign(meta[m.id] || {}, m); }); bump(true); }).catch(() => { })); }
  async function blobOf(id) { if (blobs[id]) return blobs[id]; if (inWorker) return null; const r = await get('files', id).catch(() => null); if (r && r.blob) { blobs[id] = r.blob; return r.blob; } return null; }
  async function urlOf(id) { if (urls[id]) return urls[id]; const b = await blobOf(id); if (!b) return null; return urls[id] || (urls[id] = URL.createObjectURL(b)); }
  const info = id => meta[id] || null;
  const list = () => Object.values(meta).filter(m => !m.builtin).sort((a, b) => (b.added || 0) - (a.added || 0));

  /* ---------- Import ---------- */
  const kindOf = f => { const t = (f.type || '').toLowerCase(), n = (f.name || '').toLowerCase();
    if (/^image\//.test(t) || /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(n)) return 'image';
    if (/^audio\//.test(t) || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma)$/.test(n)) return 'audio';
    if (/^video\//.test(t) || /\.(mp4|mov|m4v|webm|mkv|avi|wmv|3gp)$/.test(n)) return 'video';
    return null; };
  const isoFamily = f => /\.(mp4|mov|m4v|m4a|3gp)$/i.test(f.name || '') || /mp4|quicktime|m4a|3gpp/i.test(f.type || '');
  // Plays a file far enough to read its size and length
  function probeElement(url, kind) {
    return new Promise((res, rej) => { const el = document.createElement(kind === 'audio' ? 'audio' : 'video'); el.preload = 'metadata'; el.muted = true; el.src = url;
      const to = setTimeout(() => rej(new Error('That file took too long to open.')), 30000);
      el.onloadedmetadata = () => { clearTimeout(to); res({ dur: isFinite(el.duration) ? el.duration : 0, w: el.videoWidth || 0, h: el.videoHeight || 0, el }); };
      el.onerror = () => { clearTimeout(to); rej(new Error(kind === 'audio' ? 'Edge could not play that sound file.' : 'Edge could not play that video. MP4 or MOV from a phone, a screen recorder or a video editor works best.')); }; });
  }
  async function importFile(file, onProgress, opts = {}) {
    if (inWorker) throw new Error('No importing here');
    const kind = kindOf(file); if (!kind) throw new Error('"' + (file.name || 'That file') + '" is not a video, sound or picture Patter Studio can use.');
    const id = opts.id && !meta[opts.id] ? opts.id : nid(), m = { id, kind, name: file.name || kind, size: file.size || 0, type: file.type || '', added: Date.now() }; if (opts.builtin) m.builtin = true;
    blobs[id] = file;
    try { await put('files', { id, blob: file }); } catch (e) { m.unsaved = true; }
    if (kind === 'image') { const b = await createImageBitmap(file); m.w = b.width; m.h = b.height; m.dur = 0; images.set(id, b); }
    else {
      const url = await urlOf(id), p = await probeElement(url, kind); m.dur = p.dur; m.w = p.w; m.h = p.h; m.hasVideo = kind === 'video' && p.w > 0;
      try { p.el.removeAttribute('src'); p.el.load(); } catch (e) { }
      if (isoFamily(file)) { try { const mp = await MP4In.open(file); m.mp4 = true; files[id] = mp;
        if (mp.video) { m.codec = mp.video.codec; m.rot = mp.video.rotation || 0; m.fps = mp.video.n > 1 ? Math.round(mp.video.n / Math.max(0.01, mp.video.end / mp.video.timescale) * 100) / 100 : 30; m.cw = mp.video.width; m.ch = mp.video.height; }
        if (mp.audio) { m.acodec = mp.audio.codec; m.sr = mp.audio.sampleRate; m.chs = mp.audio.channels; }
        m.hasAudio = !!mp.audio; if (!m.dur) m.dur = mp.duration; } catch (e) { m.mp4 = false; } }
      if (m.hasAudio === undefined) m.hasAudio = kind === 'audio' ? true : null;    // not known yet: found when the waveform is made
      if (!m.fps) m.fps = 30;
    }
    meta[id] = m; await put('meta', m).catch(() => { }); bump(true);
    // Thumbnails and the waveform carry on in the background
    background(id, onProgress);
    return m;
  }
  const work = [];
  let working = false;
  function background(id, onProgress) { work.push({ id, onProgress }); if (!working) runWork(); }
  async function runWork() { working = true; while (work.length) { const { id, onProgress } = work.shift(), m = meta[id]; if (!m) continue;
      try { if (m.kind === 'video' && m.hasVideo && !m.thumbs) await makeThumbs(id, onProgress); } catch (e) { console.warn('thumbs', e); }
      try { if ((m.kind === 'audio' || (m.kind === 'video' && m.hasAudio !== false)) && !m.peaks) await makePeaks(id, onProgress); } catch (e) { console.warn('peaks', e); if (m.hasAudio == null) m.hasAudio = false; }
      if (m.kind === 'image' && !m.thumbs) await makeImageThumb(id).catch(() => { });
      await put('meta', m).catch(() => { }); bump(true); onProgress && onProgress(1, 'done'); }
    working = false; }
  // Pictures along the clip for the timeline: one every few seconds, small JPEGs
  const thumbsMem = {};
  async function makeThumbs(id, onProgress) {
    const m = meta[id], url = await urlOf(id), v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('thumbs')); setTimeout(res, 15000); });
    const n = cl(Math.ceil(m.dur / 2), 1, 150), step = m.dur / n, h = 90, w = Math.max(16, Math.round(h * (v.videoWidth || 16) / (v.videoHeight || 9)));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), out = [];
    for (let i = 0; i < n; i++) { const t = Math.min(m.dur - 0.05, i * step + step * 0.5);
      await new Promise(r => { let done = false; const fin = () => { if (done) return; done = true; r(); }; v.onseeked = fin; setTimeout(fin, 3000); v.currentTime = Math.max(0, t); });
      g.drawImage(v, 0, 0, w, h); out.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.7))); onProgress && onProgress(i / n * 0.5, 'thumbs'); }
    v.removeAttribute('src'); v.load();
    m.thumbs = { n, step, w, h }; thumbsMem[id] = out; await put('thumbs', { id, list: out }).catch(() => { });
  }
  async function makeImageThumb(id) { const b = await bitmap(id); if (!b) return; const h = 90, w = Math.max(16, Math.round(h * b.width / b.height)), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(b, 0, 0, w, h);
    const bl = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.75)); meta[id].thumbs = { n: 1, step: 1, w, h }; thumbsMem[id] = [bl]; await put('thumbs', { id, list: [bl] }).catch(() => { }); }
  // Thumbnail bitmaps, decoded when the timeline first draws them
  const thumbBmp = new Map();
  function thumb(id, t) {
    const m = meta[id]; if (!m || !m.thumbs) return null; const i = m.kind === 'image' ? 0 : cl(Math.floor(t / m.thumbs.step), 0, m.thumbs.n - 1), key = id + ':' + i;
    if (thumbBmp.has(key)) return thumbBmp.get(key);
    thumbBmp.set(key, null);
    (async () => { let L = thumbsMem[id]; if (!L) { const r = await get('thumbs', id).catch(() => null); L = thumbsMem[id] = r ? r.list : null; } if (!L || !L[i]) return; const b = await createImageBitmap(L[i]); thumbBmp.set(key, b); thumbTick++; bump(false); })();
    return null;
  }

  /* ---------- Waveforms: the loudest point in every hundredth of a second, kept as bytes ---------- */
  const PEAK_RATE = 100;
  async function makePeaks(id, onProgress) {
    const m = meta[id], R = await audioReader(id); if (!R) { m.hasAudio = false; return; }
    m.hasAudio = true; m.sr = m.sr || R.sr; m.chs = m.chs || R.ch;
    const dur = m.dur || R.dur, n = Math.max(1, Math.ceil(dur * PEAK_RATE)), out = new Uint8Array(n), BLOCK = 30;
    for (let t0 = 0; t0 < dur; t0 += BLOCK) {
      const t1 = Math.min(dur, t0 + BLOCK), d = await R.read(t0, t1); if (!d || !d[0]) continue; const per = R.sr / PEAK_RATE;
      for (let k = Math.floor(t0 * PEAK_RATE); k < Math.min(n, Math.ceil(t1 * PEAK_RATE)); k++) { const a = Math.floor((k / PEAK_RATE - t0) * R.sr), b = Math.min(d[0].length, Math.floor(a + per)); let mx = 0;
        for (let c = 0; c < d.length; c++) { const ch = d[c]; for (let j = Math.max(0, a); j < b; j++) { const x = ch[j] < 0 ? -ch[j] : ch[j]; if (x > mx) mx = x; } }
        out[k] = Math.min(255, Math.round(Math.sqrt(Math.min(1, mx)) * 255)); }
      onProgress && onProgress(0.5 + 0.5 * t1 / dur, 'waveform');
    }
    R.close && R.close(); m.peaks = out; m.peakRate = PEAK_RATE;
    // Loudness for Normalise: the level of the loudest tenth of the clip
    const sorted = Array.from(out).sort((a, b) => a - b), p90 = sorted[Math.floor(sorted.length * 0.9)] / 255; m.level = p90 * p90;
  }
  const peakAt = (id, t) => { const m = meta[id]; if (!m || !m.peaks) return 0; const i = Math.floor(t * (m.peakRate || PEAK_RATE)); return i >= 0 && i < m.peaks.length ? m.peaks[i] / 255 : 0; };

  /* ---------- Pictures ---------- */
  const images = new Map();
  async function bitmap(id) { if (images.has(id)) return images.get(id); const b = await blobOf(id); if (!b) return null; const bm = await createImageBitmap(b); images.set(id, bm); bump(false); return bm; }
  function image(id) { if (images.has(id)) return images.get(id); bitmap(id).catch(() => { }); return null; }

  /* ---------- Live preview frames: one hidden video element per clip on screen, kept in step with the playhead ---------- */
  const pool = new Map(); let frameNo = 0;
  const POOL_MAX = 8;
  function live(id, key, t, playing, rate) {
    const m = meta[id]; if (!m || inWorker) return null;
    if (m.kind === 'image') return image(id);
    let p = pool.get(key);
    if (!p || p.id !== id) { if (p) drop(key); p = { id, el: null, used: frameNo, want: t, seeking: false }; pool.set(key, p); urlOf(id).then(u => { if (!u || pool.get(key) !== p) return; const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.preload = 'auto'; el.src = u; p.el = el;
        el.addEventListener('seeked', () => { p.seeking = false; bump(false); }); el.addEventListener('loadeddata', () => bump(false)); el.addEventListener('playing', () => bump(false)); }); trimPool(); }
    p.used = frameNo; p.want = t; const el = p.el; if (!el) return null;
    const dur = isFinite(el.duration) ? el.duration : m.dur; t = cl(t, 0, Math.max(0, dur - 0.01));
    if (playing && rate > 0) {
      // Kept locked to the playhead: a big gap jumps, a small one is closed by playing a touch faster or slower
      const drift = el.currentTime - t; let r = rate;
      if (el.paused) { if (Math.abs(drift) > 0.04) el.currentTime = t + 0.02 * rate; el.play().catch(() => { }); }
      else if (Math.abs(drift) > 0.4 * Math.max(1, rate)) el.currentTime = t + 0.05 * rate;
      else if (Math.abs(drift) > 0.015) r = rate * (1 - cl(drift * 1.6, -0.12, 0.12));
      if (Math.abs(el.playbackRate - r) > 1e-3) { try { el.playbackRate = cl(r, 0.0625, 16); } catch (e) { } }
    } else {
      if (!el.paused) el.pause();
      const fr = 1 / (m.fps || 30), now = performance.now(); if (p.seeking && now - p.seekAt > 1500) p.seeking = false;
      if (!p.seeking && Math.abs(el.currentTime - t) > fr * 0.5) { p.seeking = true; p.seekAt = now; el.currentTime = t; }
    }
    return el.readyState >= 2 ? el : null;
  }
  // Called once a preview frame is drawn: elements not used this frame stop playing
  function endFrame() { pool.forEach(p => { if (p.used !== frameNo && p.el && !p.el.paused) p.el.pause(); }); frameNo++; }
  function drop(key) { const p = pool.get(key); if (!p) return; if (p.el) { try { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); } catch (e) { } } pool.delete(key); }
  function trimPool() { if (pool.size <= POOL_MAX) return; [...pool.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, pool.size - POOL_MAX).forEach(([k]) => drop(k)); }
  function pauseAll() { pool.forEach(p => { if (p.el && !p.el.paused) p.el.pause(); }); }

  /* ---------- Exact frames for export ---------- */
  // Returns { frame(t) -> Promise<drawable>, close() }. Frames come back already the right way up via draw(); w and h are the shown size.
  async function videoReader(id) {
    const m = meta[id]; if (!m) return null;
    if (m.kind === 'image') { const b = await bitmap(id); return { frame: async () => b, close() { }, rot: 0 }; }
    const blob = await blobOf(id); if (!blob) return null;
    let mp = files[id]; if (!mp && m.mp4 !== false) { try { mp = files[id] = await MP4In.open(blob); } catch (e) { mp = null; } }
    if (mp && mp.video && typeof VideoDecoder !== 'undefined') {
      const T = mp.video, cfg = { codec: T.codec, codedWidth: T.width, codedHeight: T.height, hardwareAcceleration: 'no-preference' }; if (T.description) cfg.description = T.description;
      let ok = false; try { ok = (await VideoDecoder.isConfigSupported(cfg)).supported; } catch (e) { }
      if (ok) return decoderReader(mp, T, cfg);
    }
    return elementReader(id, m);
  }
  function decoderReader(mp, T, cfg) {
    // Display order: sample indices sorted by their presentation time
    const n = T.n, order = new Uint32Array(n); for (let i = 0; i < n; i++) order[i] = i;
    const P = new Float64Array(n); for (let i = 0; i < n; i++) P[i] = MP4In.pts(T, i); order.sort((a, b) => P[a] - P[b]);
    const keyBefore = new Int32Array(n); let lk = 0; for (let i = 0; i < n; i++) { if (T.key[i]) lk = i; keyBefore[i] = lk; }
    const us = i => Math.round(P[i] * 1e6);
    let dec = null, fed = 0, out = [], err = null, waiters = [], cur = null, curTs = -1, lastTarget = -1;
    const make = () => { if (dec) { try { dec.close(); } catch (e) { } } out.forEach(f => f.close()); out = []; if (cur) { try { cur.close(); } catch (e) { } }
      cur = null; curTs = -1;
      dec = new VideoDecoder({ output: f => { out.push(f); out.sort((a, b) => a.timestamp - b.timestamp); if (out.length > 24) { out = out.filter(x => { if (x !== cur && x.timestamp < lastTarget - 1) { x.close(); return false; } return true; }); while (out.length > 24) { const x = out.shift(); if (x !== cur) x.close(); } } waiters.splice(0).forEach(w => w()); }, error: e => { err = e; waiters.splice(0).forEach(w => w()); } });
      dec.configure(cfg); };
    const at = t => { let lo = 0, hi = n - 1; if (t <= P[order[0]]) return order[0]; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P[order[mid]] <= t + 1e-6) lo = mid; else hi = mid; } return P[order[hi]] <= t + 1e-6 ? order[hi] : order[lo]; };
    async function feed(upto) { while (fed <= upto && fed < n) { const end = Math.min(n, fed + 24, upto + 1), data = await MP4In.samples(mp, T, fed, end);
        for (let k = 0; k < data.length; k++) { const i = fed + k; dec.decode(new EncodedVideoChunk({ type: T.key[i] ? 'key' : 'delta', timestamp: us(i), duration: Math.round(((T.dts[i + 1] || T.end) - T.dts[i]) / T.timescale * 1e6), data: data[k] })); }
        fed = end; while (dec.decodeQueueSize > 12) await new Promise(r => setTimeout(r, 1)); } }
    async function frame(t) {
      if (err) throw err;
      const s = at(t), ts = us(s);
      if (cur && curTs === ts) return cur;
      // A jump back, or a long way forward: start again from the keyframe before it
      if (!dec || s < fed - 64 || keyBefore[s] > fed || ts < lastTarget - 1) { make(); fed = keyBefore[s]; }
      lastTarget = ts;
      let guard = 0;
      while (!out.some(f => f.timestamp >= ts) && guard++ < 4000) {
        if (err) throw err;
        if (fed < n) { await feed(Math.min(n - 1, fed + 4)); await new Promise(r => { waiters.push(r); setTimeout(r, fed >= n ? 50 : 4); }); }
        else { await dec.flush().catch(e => { err = e; }); break; }
      }
      // The frame showing at t: the latest one not after it
      let best = null; for (const f of out) if (f.timestamp <= ts + 500) best = f;
      if (!best) best = out[0] || null;
      if (best) { if (cur && cur !== best && !out.includes(cur)) { try { cur.close(); } catch (e) { } } cur = best; curTs = best.timestamp; out = out.filter(f => { if (f.timestamp < curTs && f !== cur) { f.close(); return false; } return true; }); }
      return cur;
    }
    return { frame, rot: T.rotation || 0, exact: true, close() { try { dec && dec.close(); } catch (e) { } out.forEach(f => { try { f.close(); } catch (e) { } }); try { cur && cur.close(); } catch (e) { } out = []; } };
  }
  // Anything WebCodecs can't open: seek a video element to each frame and wait for it
  async function elementReader(id, m) {
    const url = await urlOf(id), v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Could not read "' + m.name + '" for the export.')); });
    let last = -1;
    return { rot: 0, frame: async t => { t = cl(t, 0, Math.max(0, (v.duration || m.dur) - 0.001)); if (Math.abs(t - last) < 1e-4) return v; last = t;
        await new Promise(r => { let done = false; const fin = () => { if (done) return; done = true; r(); }; v.onseeked = () => { if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(fin); fin(); }; setTimeout(fin, 4000); v.currentTime = t; }); return v; },
      close() { v.removeAttribute('src'); v.load(); } };
  }

  /* ---------- Sound: raw samples for any stretch of a file ---------- */
  // Returns { sr, ch, dur, read(t0, t1) -> Promise<Float32Array[]> (one per channel, at the file's own rate), close() }
  async function audioReader(id) {
    const m = meta[id]; if (!m || m.kind === 'image') return null; const blob = await blobOf(id); if (!blob) return null;
    let mp = files[id]; if (!mp && m.mp4 !== false && isoFamily({ name: m.name, type: m.type })) { try { mp = files[id] = await MP4In.open(blob); } catch (e) { mp = null; } }
    if (mp && mp.audio) {
      const T = mp.audio;
      if (T.codec === 'pcm') return pcmReader(mp, T);
      if (typeof AudioDecoder !== 'undefined') { const cfg = { codec: T.codec, sampleRate: T.sampleRate, numberOfChannels: T.channels }; if (T.description) cfg.description = T.description;
        let ok = false; try { ok = (await AudioDecoder.isConfigSupported(cfg)).supported; } catch (e) { } if (ok) return codecReader(mp, T, cfg); }
    }
    if (mp && !mp.audio) return null;
    const wr = await wavReader(blob).catch(() => null); if (wr) return wr;
    return wholeReader(id, blob, m);
  }
  // WAV files are read straight from the file a piece at a time (long voiceover recordings never sit whole in memory)
  async function wavReader(blob) {
    const hd = new DataView(await blob.slice(0, 12).arrayBuffer()); if (hd.byteLength < 12 || hd.getUint32(0, false) !== 0x52494646 || hd.getUint32(8, false) !== 0x57415645) return null;
    let at = 12, fmt = null, data = null;
    while (at + 8 <= blob.size && !(fmt && data)) { const ck = new DataView(await blob.slice(at, at + 8).arrayBuffer()), id = ck.getUint32(0, false), size = ck.getUint32(4, true);
      if (id === 0x666d7420) { const f = new DataView(await blob.slice(at + 8, at + 8 + Math.min(size, 40)).arrayBuffer()); let tag = f.getUint16(0, true); const ch = f.getUint16(2, true), sr = f.getUint32(4, true), align = f.getUint16(12, true), bits = f.getUint16(14, true); if (tag === 0xFFFE && size >= 26) tag = f.getUint16(24, true); fmt = { tag, ch, sr, align, bits }; }
      else if (id === 0x64617461) data = { off: at + 8, size: Math.min(size || blob.size, blob.size - at - 8) };
      at += 8 + size + (size & 1); if (!size) break; }
    if (!fmt || !data || !fmt.ch || !fmt.sr || !fmt.align || !((fmt.tag === 1 && [8, 16, 24, 32].includes(fmt.bits)) || (fmt.tag === 3 && fmt.bits === 32))) return null;
    const { ch, sr, align, bits } = fmt, total = Math.floor(data.size / align), fl = fmt.tag === 3, bps = bits / 8;
    async function read(t0, t1) {
      const len = Math.max(0, Math.round((t1 - t0) * sr)), outs = []; for (let c = 0; c < ch; c++) outs.push(new Float32Array(len)); if (!len) return outs;
      const f0 = Math.round(t0 * sr), a = Math.max(0, f0), b = Math.min(total, f0 + len); if (b <= a) return outs;
      const v = new DataView(await blob.slice(data.off + a * align, data.off + b * align).arrayBuffer());
      for (let f = a; f < b; f++) { const base = (f - a) * align, k = f - f0; for (let c = 0; c < ch; c++) { const o = base + c * bps; let x;
          if (fl) x = v.getFloat32(o, true); else if (bits === 16) x = v.getInt16(o, true) / 32768; else if (bits === 24) { let q = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16); if (q & 0x800000) q -= 0x1000000; x = q / 8388608; } else if (bits === 32) x = v.getInt32(o, true) / 2147483648; else x = (v.getUint8(o) - 128) / 128;
          outs[c][k] = x; } }
      return outs;
    }
    return { sr, ch, dur: total / sr, read, close() { } };
  }
  function codecReader(mp, T, cfg) {
    const P = i => MP4In.pts(T, i), n = T.n, sr = T.sampleRate, ch = T.channels;
    const idx = t => { let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P(mid) <= t) lo = mid; else hi = mid; } return lo; };
    async function read(t0, t1) {
      const len = Math.max(0, Math.round((t1 - t0) * sr)), outs = []; for (let c = 0; c < ch; c++) outs.push(new Float32Array(len)); if (!len) return outs;
      const i0 = Math.max(0, idx(t0) - 2), i1 = Math.min(n, idx(t1) + 3); let err = null; const got = [];
      const dec = new AudioDecoder({ output: a => got.push(a), error: e => { err = e; } }); dec.configure(cfg);
      const data = await MP4In.samples(mp, T, i0, i1);
      for (let k = 0; k < data.length; k++) { const i = i0 + k; dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(P(i) * 1e6), data: data[k] })); }
      await dec.flush().catch(e => { err = e; }); try { dec.close(); } catch (e) { }
      for (const a of got) { if (!err) { const fr = a.numberOfFrames, start = Math.round((a.timestamp / 1e6 - t0) * sr), tmp = new Float32Array(fr);
          for (let c = 0; c < ch; c++) { try { a.copyTo(tmp, { planeIndex: Math.min(c, a.numberOfChannels - 1), format: 'f32-planar' }); } catch (e) { tmp.fill(0); } const o = outs[c]; for (let j = 0; j < fr; j++) { const k = start + j; if (k >= 0 && k < len) o[k] = tmp[j]; } } } a.close(); }
      if (err) throw err; return outs;
    }
    return { sr, ch, dur: T.end / T.timescale, read, close() { } };
  }
  function pcmReader(mp, T) {
    const sr = T.sampleRate, ch = T.channels || 2, pc = T.pcm, fb = pc.frameBytes || (pc.bits / 8) * ch, total = T.n * (T.sizes[0] / fb);
    // Frames are evenly spread through the chunks; read the byte ranges for the wanted frames
    async function read(t0, t1) {
      const f0 = Math.max(0, Math.floor((t0 + T.shift) * sr)), f1 = Math.max(f0, Math.floor((t1 + T.shift) * sr)), len = Math.round((t1 - t0) * sr), outs = []; for (let c = 0; c < ch; c++) outs.push(new Float32Array(len));
      const per = T.sizes[0] / fb; let i = Math.floor(f0 / per);
      const data = await MP4In.samples(mp, T, i, Math.min(T.n, Math.ceil(f1 / per) + 1)); let f = i * per;
      for (const d of data) { const v = new DataView(d.buffer, d.byteOffset, d.byteLength), frames = Math.floor(d.byteLength / fb);
        for (let j = 0; j < frames; j++, f++) { const k = f - f0; if (k < 0 || k >= len) continue; for (let c = 0; c < ch; c++) { const o = j * fb + c * (pc.bits / 8); let x;
            if (pc.float) x = v.getFloat32(o, pc.le); else if (pc.bits === 16) x = v.getInt16(o, pc.le) / 32768; else if (pc.bits === 24) { const b0 = v.getUint8(o), b1 = v.getUint8(o + 1), b2 = v.getUint8(o + 2); let s = pc.le ? (b2 << 16) | (b1 << 8) | b0 : (b0 << 16) | (b1 << 8) | b2; if (s & 0x800000) s -= 0x1000000; x = s / 8388608; } else if (pc.bits === 32) x = v.getInt32(o, pc.le) / 2147483648; else x = (v.getUint8(o) - 128) / 128;
            outs[c][k] = x; } } }
      return outs;
    }
    return { sr, ch, dur: total / sr, read, close() { } };
  }
  // Files that aren't MP4 (MP3, WAV, OGG, FLAC, WebM): decoded whole once, kept while needed
  const wholeCache = new Map();
  async function wholeReader(id, blob, m) {
    let buf = wholeCache.get(id);
    if (!buf) { if (blob.size > 900e6 || (m.dur || 0) * 48000 * Math.max(1, m.chs || 2) * 4 > 1.6e9) throw new Error('"' + m.name + '" is too big to read the sound from. Convert it to MP4 and import it again.');
      const ab = await blob.arrayBuffer(), AC = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null; if (!AC) return null;
      const ctx = new AC(1, 1, 48000); try { buf = await ctx.decodeAudioData(ab); } catch (e) { return null; }
      wholeCache.set(id, buf); while (wholeCache.size > 3) wholeCache.delete(wholeCache.keys().next().value); }
    const sr = buf.sampleRate, ch = buf.numberOfChannels;
    return { sr, ch, dur: buf.duration, read: async (t0, t1) => { const a = Math.round(t0 * sr), len = Math.max(0, Math.round((t1 - t0) * sr)), outs = []; for (let c = 0; c < ch; c++) { const o = new Float32Array(len), src = buf.getChannelData(c); for (let k = 0; k < len; k++) { const j = a + k; o[k] = j >= 0 && j < src.length ? src[j] : 0; } outs.push(o); } return outs; },
      close() { } };
  }
  function releaseAudio() { wholeCache.clear(); }

  /* ---------- Removing ---------- */
  async function remove(id) { drop(id); [...pool.keys()].forEach(k => { if (pool.get(k).id === id) drop(k); }); if (urls[id]) URL.revokeObjectURL(urls[id]); delete urls[id]; delete blobs[id]; delete meta[id]; delete files[id]; images.delete(id);
    await del('files', id).catch(() => { }); await del('meta', id).catch(() => { }); await del('thumbs', id).catch(() => { }); bump(true); }
  // Storage use, so the library can say how much room footage takes
  async function usage() { try { const e = await navigator.storage.estimate(); return e; } catch (e) { return null; } }

  // For export helpers: what the drawing needs to know about each file, and taking that in on the other side
  const forWorkers = ids => (ids || []).map(id => meta[id]).filter(Boolean).map(m => { const o = Object.assign({}, m); delete o.peaks; delete o.thumbs; return o; });
  const seed = list => (list || []).forEach(m => { if (m && m.id) meta[m.id] = Object.assign(meta[m.id] || {}, m); });
  if (!inWorker && typeof indexedDB !== 'undefined') loadAll();
  return { importFile, kindOf, info, list, loadAll, live, endFrame, pauseAll, videoReader, audioReader, releaseAudio, thumb, image, bitmap, peakAt, blobOf, urlOf, remove, usage, forWorkers, seed,
    onChange: f => listeners.push(f), get tick() { return tick; }, get thumbTick() { return thumbTick; }, get version() { return version; }, _meta: meta, PEAK_RATE };
})();

/* Media: real video clips inside Patter Studio. A clip is read once, frame by frame, into small JPEG pictures kept in this
   browser's storage. Drawing then asks for the picture nearest a moment in the clip; exports make sure the right pictures are
   decoded before each frame is drawn, so the footage lines up exactly and every render worker can use it. */
const Media = (() => {
  const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
  const reg = {}, maps = {}, busy = new Map(), loading = {}, listeners = [];
  let version = 0, tick = 0, nudge = 0;
  // Decoded pictures are big (about 3.5 MB each at 1280 wide), so only a couple of seconds' worth are kept ready; each export worker keeps fewer
  const MAX_SECONDS = 60, MAX_W = 1280, FPS_CAP = 30, KEEP = inWorker ? 20 : 60;

  // Nearest stored picture to time t (seconds into the clip)
  function nearest(m, t) { const T = m.times; if (!T || !T.length) return -1; if (t <= T[0]) return 0; if (t >= T[T.length - 1]) return T.length - 1;
    let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; } return t - T[lo] < T[hi] - t ? lo : hi; }
  // A new picture decoded only needs a redraw; a clip arriving also means cached previews are out of date
  let clipNews = false;
  function changed(clip) { tick++; if (clip) { version++; clipNews = true; } if (inWorker) return; clearTimeout(nudge); nudge = setTimeout(() => { const c = clipNews; clipNews = false; listeners.forEach(f => { try { f(c); } catch (e) { } }); }, 30); }
  function decode(id, i) { const m = reg[id]; if (!m || i < 0 || i >= m.blobs.length) return Promise.resolve(null); const map = maps[id] || (maps[id] = new Map());
    if (map.has(i)) return Promise.resolve(map.get(i)); const key = id + ':' + i; if (busy.has(key)) return busy.get(key);
    const p = createImageBitmap(m.blobs[i]).then(b => { busy.delete(key); map.set(i, b); trim(id, i); if (!inWorker) changed(false); return b; }).catch(() => { busy.delete(key); return null; }); busy.set(key, p); return p; }
  function trim(id, around) { const map = maps[id], m = reg[id], keep = m ? Math.max(10, Math.min(KEEP, Math.floor(2.2e8 / Math.max(1, m.w * m.h * 4)))) : KEEP; if (!map || map.size <= keep) return; const ks = [...map.keys()].sort((a, b) => Math.abs(b - around) - Math.abs(a - around)); for (let k = 0; k < ks.length && map.size > keep; k++) { const b = map.get(ks[k]); if (b && b.close) b.close(); map.delete(ks[k]); } }
  // The picture for time t, right now if it is ready; otherwise the closest ready one while the right one is fetched
  function frame(id, t) { const m = reg[id]; if (!m) { if (!inWorker) fetchClip(id); return null; } const i = nearest(m, t), map = maps[id] || (maps[id] = new Map());
    // Read ahead while previewing; export workers are told exactly which pictures they need, so they skip this
    if (!inWorker) for (let k = 1; k <= 8; k++) if (!map.has(i + k)) decode(id, i + k);
    if (map.has(i)) return map.get(i); decode(id, i); let best = null, bd = 1e9; map.forEach((b, j) => { if (Math.abs(j - i) < bd) { bd = Math.abs(j - i); best = b; } }); return best; }
  // Exports wait here so every frame shows exactly the right picture
  async function prepare(list) { if (!list || !list.length) return; await Promise.all(list.map(([id, t]) => { const m = reg[id]; return m ? decode(id, nearest(m, t)) : null; })); }
  const info = id => reg[id] ? { id, name: reg[id].name, w: reg[id].w, h: reg[id].h, dur: reg[id].dur, n: reg[id].blobs.length, fw: reg[id].fw, fh: reg[id].fh, box: reg[id].box, alpha: !!reg[id].alpha } : null;
  const ready = id => !!reg[id];
  // What the render workers need: the stored pictures themselves (sending a Blob is cheap, it is not copied)
  function forWorkers(ids) { const out = {}; (ids || []).forEach(id => { const m = reg[id]; if (m) out[id] = { name: m.name, w: m.w, h: m.h, dur: m.dur, times: m.times, blobs: m.blobs, fw: m.fw, fh: m.fh, box: m.box, alpha: m.alpha }; }); return out; }
  function load(obj) { Object.keys(obj || {}).forEach(id => { reg[id] = Object.assign({ id }, obj[id]); }); version++; }

  /* Storage in this browser, separate from projects so big clips never slow down saving */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { if (typeof indexedDB === 'undefined') return rej(new Error('No storage')); const r = indexedDB.open('patter-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const put = async v => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('clips', 'readwrite'); t.objectStore('clips').put(v); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const get = async id => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('clips', 'readonly'), r = t.objectStore('clips').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
  function fetchClip(id) { if (inWorker || loading[id]) return loading[id]; loading[id] = get(id).then(v => { if (v) { reg[id] = v; changed(true); } return !!v; }).catch(() => false); return loading[id]; }
  // Make sure every clip a project uses is loaded before exporting it
  async function ensure(ids) { await Promise.all((ids || []).map(id => reg[id] ? true : fetchClip(id))); }

  /* Reading a clip: play it silently and keep a picture of every frame (up to 30 a second, 1280 wide, first 60 seconds) */
  function importFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      const fail = msg => { try { v.pause(); } catch (e) { } URL.revokeObjectURL(url); reject(new Error(msg)); };
      v.onerror = () => fail('This browser could not play that video. MP4 files filmed on a phone or exported from a video editor usually work; try exporting it again as H.264 MP4.');
      v.onloadedmetadata = async () => {
        const full = isFinite(v.duration) ? v.duration : 0, dur = Math.min(full || MAX_SECONDS, MAX_SECONDS), sc = Math.min(1, MAX_W / (v.videoWidth || MAX_W)), w = Math.max(2, Math.round((v.videoWidth || 1280) * sc)), h = Math.max(2, Math.round((v.videoHeight || 720) * sc));
        if (!v.videoWidth) return fail('That file has no picture in it.');
        const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }), cx = cv.getContext('2d'), shots = [], jobs = [];
        const grab = mt => { cx.drawImage(v, 0, 0, w, h); const tt = mt; jobs.push((cv.convertToBlob ? cv.convertToBlob({ type: 'image/jpeg', quality: 0.82 }) : new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82))).then(b => shots.push({ t: tt, b }))); };
        const done = async () => { try { v.pause(); } catch (e) { } await Promise.all(jobs); URL.revokeObjectURL(url); shots.sort((a, b) => a.t - b.t); if (!shots.length) return reject(new Error('No frames could be read from that video.'));
          const id = 'vid' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), t0 = shots[0].t, m = { id, name: file.name || 'Video', w, h, dur: dur, times: shots.map(s => s.t - t0), blobs: shots.map(s => s.b), cut: full > MAX_SECONDS };
          reg[id] = m; changed(true); try { await put(m); } catch (e) { m.unsaved = true; } resolve(info(id) && Object.assign(info(id), { cut: m.cut, unsaved: !!m.unsaved })); };
        if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
          let last = -1, over = false; const step = (now, meta) => { if (over) return; const mt = meta.mediaTime; if (mt - last >= 1 / FPS_CAP - 0.004) { grab(mt); last = mt; } onProgress && onProgress(Math.min(1, mt / dur)); if (mt >= dur - 0.02 || v.ended) { over = true; done(); } else v.requestVideoFrameCallback(step); };
          v.onended = () => { if (!over) { over = true; done(); } }; v.requestVideoFrameCallback(step); v.play().catch(() => fail('The video would not start playing.'));
        } else {
          // Older browsers: step through the clip by seeking
          const dt = 1 / 25; let tt = 0; const next = () => { if (tt > dur) return done(); v.currentTime = tt; }; v.onseeked = () => { grab(tt); onProgress && onProgress(tt / dur); tt += dt; next(); }; next();
        }
      };
    });
  }
  /* ---------- Avatar footage, which needs to keep its see-through edges ----------
     A green (or blue) screen is keyed out as the footage is read in; a see-through WebM or a PNG sequence keeps its own
     transparency. Only the part of the picture that ever has anything in it is kept, as WebP pictures (which can be
     see-through), and where that part sits in the whole frame is remembered so the avatar lands where it was filmed. */
  const AV_SECONDS = 600, AV_MAX = 1500;
  const canv = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) : Object.assign(document.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });
  // Which screen colour (if any) the border of a frame is
  function screenOf(d, w, h) { let g = 0, b = 0, clear = 0, n = 0; const look = (x, y) => { const k = (y * w + x) * 4; n++; if (d[k + 3] < 40) { clear++; return; } const r = d[k], gg = d[k + 1], bb = d[k + 2]; if (gg > r + 30 && gg > bb + 20) g++; else if (bb > r + 30 && bb > gg + 15) b++; };
    for (let x = 0; x < w; x += Math.max(1, w >> 6)) { look(x, 0); look(x, h - 1); } for (let y = 0; y < h; y += Math.max(1, h >> 6)) { look(0, y); look(w - 1, y); }
    return clear > n * 0.5 ? 'none' : g > n * 0.4 ? 'green' : b > n * 0.4 ? 'blue' : 'none'; }
  // Keys one frame in place: how much the screen colour outweighs the other two decides how see-through a pixel is, and the
  // screen colour spilling onto the edges is taken back out
  function keyFrame(d, key, tol, spill) {
    if (key !== 'green' && key !== 'blue') return; const ci = key === 'green' ? 1 : 2, lo = 8 + (1 - tol) * 30, hi = lo + 28;
    for (let k = 0; k < d.length; k += 4) { const c = d[k + ci], o = Math.max(d[k], ci === 1 ? d[k + 2] : d[k + 1]), dom = c - o; if (dom <= lo * 0.5) continue;
      const a = dom >= hi ? 0 : dom <= lo ? 1 : 1 - (dom - lo) / (hi - lo); d[k + 3] = Math.round(d[k + 3] * a); d[k + ci] = Math.round(c - spill * Math.max(0, dom)); }
  }
  async function importAvatar(src, opts = {}, onProgress) {
    const files = Array.isArray(src) ? src.filter(f => /image\//.test(f.type) || /\.(png|webp)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : null;
    const tol = opts.tol == null ? 0.5 : +opts.tol, spill = opts.spill == null ? 0.85 : +opts.spill;
    let srcW = 0, srcH = 0, key = opts.key || 'auto', box = null;
    // Pass 1: a handful of frames decide the screen colour and the part of the picture worth keeping
    const look = (img, w, h) => { const c = canv(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h); const id = g.getImageData(0, 0, w, h); if (key === 'auto') key = screenOf(id.data, w, h); keyFrame(id.data, key, tol, spill);
      let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (id.data[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) box = box ? [Math.min(box[0], x0), Math.min(box[1], y0), Math.max(box[2], x1), Math.max(box[3], y1)] : [x0, y0, x1, y1]; };
    let video = null, url = null, dur = 0;
    if (files) { if (!files.length) throw new Error('No PNG pictures were chosen.'); const b0 = await createImageBitmap(files[0]); srcW = b0.width; srcH = b0.height; b0.close && b0.close(); const fps = cl2(+opts.fps || 30, 1, 60);
      dur = files.length / fps; const picks = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map(f => files[Math.min(files.length - 1, Math.round(f * (files.length - 1)))]); for (const f of picks) { const b = await createImageBitmap(f); look(b, srcW, srcH); b.close && b.close(); } }
    else {
      url = URL.createObjectURL(src); video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url;
      await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('This browser could not play that video. A green screen MP4, a see-through WebM or a PNG sequence all work.')); });
      srcW = video.videoWidth; srcH = video.videoHeight; if (!srcW) throw new Error('That file has no picture in it.'); dur = Math.min(isFinite(video.duration) ? video.duration : AV_SECONDS, AV_SECONDS);
      const seek = t => new Promise(r => { video.onseeked = () => r(); video.currentTime = t; });
      for (const f of [0.02, 0.2, 0.4, 0.6, 0.8, 0.97]) { await seek(dur * f); look(video, srcW, srcH); }
    }
    if (!box) box = [0, 0, srcW - 1, srcH - 1];
    const m = Math.round(Math.max(srcW, srcH) * 0.03); box = [Math.max(0, box[0] - m), Math.max(0, box[1] - m), Math.min(srcW, box[2] + m + 1), Math.min(srcH, box[3] + m + 1)];
    const bw = box[2] - box[0], bh = box[3] - box[1], k = Math.min(1, AV_MAX / Math.max(bw, bh)), ow = Math.max(2, Math.round(bw * k)), oh = Math.max(2, Math.round(bh * k));
    const work = canv(bw, bh), wg = work.getContext('2d', { willReadFrequently: true }), out = canv(ow, oh), og = out.getContext('2d'), shots = [], jobs = [];
    const take = (img, t) => { wg.clearRect(0, 0, bw, bh); wg.drawImage(img, box[0], box[1], bw, bh, 0, 0, bw, bh); if (key === 'green' || key === 'blue') { const id = wg.getImageData(0, 0, bw, bh); keyFrame(id.data, key, tol, spill); wg.putImageData(id, 0, 0); }
      og.clearRect(0, 0, ow, oh); og.imageSmoothingQuality = 'high'; og.drawImage(work, 0, 0, ow, oh); jobs.push((out.convertToBlob ? out.convertToBlob({ type: 'image/webp', quality: 0.86 }) : new Promise(r => out.toBlob(r, 'image/webp', 0.86))).then(b => shots.push({ t, b }))); };
    // Pass 2: every frame
    if (files) { const fps = cl2(+opts.fps || 30, 1, 60), n = Math.min(files.length, Math.round(AV_SECONDS * fps)); for (let i = 0; i < n; i++) { const b = await createImageBitmap(files[i]); take(b, i / fps); b.close && b.close(); if (jobs.length > 12) await Promise.all(jobs.splice(0, jobs.length)); onProgress && onProgress(i / n); } dur = n / fps; }
    // A slow computer can drop frames while the video plays; if it did, read it again more slowly
    else for (const rate of [1, 0.5, 0.25]) { shots.length = 0; jobs.length = 0;
     await new Promise((res, rej) => { const v = video; let last = -1, over = false, ended = false, busy = false; const q = [];
      // Frames are grabbed as they play and worked on in order; if the work falls behind, the video waits for it
      const work = async () => { if (busy) return; busy = true; try { while (q.length) { const f = q.shift(); take(f.b, f.t); f.b.close && f.b.close(); if (jobs.length > 12) await Promise.all(jobs.splice(0, jobs.length)); onProgress && onProgress(Math.min(1, f.t / dur));
          if (q.length < 4 && v.paused && !ended && !over) v.play().catch(() => { }); await new Promise(r => setTimeout(r, 0)); } } finally { busy = false; } if (ended && !q.length) fin(); };
      const fin = () => { if (over) return; over = true; try { v.pause(); } catch (e) { } res(); };
      if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) { const step = (now, meta) => { if (over) return; const mt = meta.mediaTime;
          if (mt - last >= 1 / FPS_CAP - 0.004) { last = mt; createImageBitmap(v).then(b => { q.push({ t: mt, b }); q.sort((x, y) => x.t - y.t); work(); }); if (q.length > 14) v.pause(); }
          if (mt >= dur - 0.02 || v.ended) { ended = true; setTimeout(work, 50); } else v.requestVideoFrameCallback(step); };
        v.onended = () => { ended = true; setTimeout(work, 50); }; v.onseeked = () => { v.onseeked = null; v.playbackRate = rate; v.requestVideoFrameCallback(step); v.play().catch(() => rej(new Error('The video would not start playing.'))); }; v.currentTime = 0.0001; }
      else { const dt = 1 / 25; let tt = 0; const next = () => { if (tt > dur) return fin(); v.currentTime = tt; }; v.onseeked = () => { take(v, tt); onProgress && onProgress(tt / dur); tt += dt; next(); }; next(); } });
     await Promise.all(jobs); const ts = shots.map(x => x.t).sort((x, y) => x - y); let md = 1e9; for (let i = 1; i < ts.length; i++) { const d = ts[i] - ts[i - 1]; if (d > 0.002 && d < md) md = d; }
     const want = md < 1e8 ? Math.min(dur / md, dur * FPS_CAP) : 0; if (!want || shots.length >= want * 0.93 || rate === 0.25) break; }
    await Promise.all(jobs); if (url) URL.revokeObjectURL(url); shots.sort((a, b) => a.t - b.t); if (!shots.length) throw new Error('No frames could be read from that.');
    const id = 'avt' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), t0 = shots[0].t, name = files ? (files[0].name.replace(/[_\-\s]*\d+\.\w+$/, '') || 'PNG sequence') : (src.name || 'Avatar');
    const rec = { id, name, w: ow, h: oh, dur, times: shots.map(s => s.t - t0), blobs: shots.map(s => s.b), alpha: true, key, fw: srcW * k, fh: srcH * k, box: [box[0] * k, box[1] * k, box[2] * k, box[3] * k], cut: !files && video && isFinite(video.duration) && video.duration > AV_SECONDS };
    reg[id] = rec; changed(true); try { await put(rec); } catch (e) { rec.unsaved = true; } return Object.assign(info(id), { cut: rec.cut, unsaved: !!rec.unsaved, key });
  }
  const cl2 = (v, a, b) => Math.max(a, Math.min(b, v));
  return { importAvatar, keyFrame, screenOf, frame, prepare, ensure, info, ready, forWorkers, load, importFile, onChange: f => listeners.push(f), get version() { return version; }, get tick() { return tick; }, MAX_SECONDS };
})();

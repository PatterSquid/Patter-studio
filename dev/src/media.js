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
  function trim(id, around) { const map = maps[id]; if (!map || map.size <= KEEP) return; const ks = [...map.keys()].sort((a, b) => Math.abs(b - around) - Math.abs(a - around)); for (let k = 0; k < ks.length && map.size > KEEP; k++) { const b = map.get(ks[k]); if (b && b.close) b.close(); map.delete(ks[k]); } }
  // The picture for time t, right now if it is ready; otherwise the closest ready one while the right one is fetched
  function frame(id, t) { const m = reg[id]; if (!m) { if (!inWorker) fetchClip(id); return null; } const i = nearest(m, t), map = maps[id] || (maps[id] = new Map());
    // Read ahead while previewing; export workers are told exactly which pictures they need, so they skip this
    if (!inWorker) for (let k = 1; k <= 8; k++) if (!map.has(i + k)) decode(id, i + k);
    if (map.has(i)) return map.get(i); decode(id, i); let best = null, bd = 1e9; map.forEach((b, j) => { if (Math.abs(j - i) < bd) { bd = Math.abs(j - i); best = b; } }); return best; }
  // Exports wait here so every frame shows exactly the right picture
  async function prepare(list) { if (!list || !list.length) return; await Promise.all(list.map(([id, t]) => { const m = reg[id]; return m ? decode(id, nearest(m, t)) : null; })); }
  const info = id => reg[id] ? { id, name: reg[id].name, w: reg[id].w, h: reg[id].h, dur: reg[id].dur, n: reg[id].blobs.length } : null;
  const ready = id => !!reg[id];
  // What the render workers need: the stored pictures themselves (sending a Blob is cheap, it is not copied)
  function forWorkers(ids) { const out = {}; (ids || []).forEach(id => { const m = reg[id]; if (m) out[id] = { name: m.name, w: m.w, h: m.h, dur: m.dur, times: m.times, blobs: m.blobs }; }); return out; }
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
  return { frame, prepare, ensure, info, ready, forWorkers, load, importFile, onChange: f => listeners.push(f), get version() { return version; }, get tick() { return tick; }, MAX_SECONDS };
})();

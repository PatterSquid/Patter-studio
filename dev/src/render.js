/* Fast export: frames are drawn in parallel by background workers (one per spare processor core), with motion blur only
   where things move fast, then encoded in order by the hardware H.264 encoder. Falls back to one thread if workers can't start. */
const Render = (() => {
  const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
  const mk = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const allMods = () => [typeof Charts !== 'undefined' && Charts, typeof Timeline !== 'undefined' && Timeline, typeof MapMod !== 'undefined' && MapMod, typeof Flights !== 'undefined' && Flights, typeof Flyover !== 'undefined' && Flyover, typeof Picto !== 'undefined' && Picto, typeof News !== 'undefined' && News, typeof Story !== 'undefined' && Story, typeof Broll !== 'undefined' && Broll, typeof Video !== 'undefined' && Video, typeof Studio !== 'undefined' && Studio, typeof Character !== 'undefined' && Character].filter(Boolean).map(m => typeof Layers !== 'undefined' ? Layers.wrap(m) : m);

  // Draws frame i. 'smart' blur draws once, measures how much the picture moved since the last frame this renderer drew,
  // and only redraws with motion blur when the movement is fast enough to need it.
  function frameRenderer(mod, cfg, look, W, H, fps, blur, alpha = false, t0 = 0) {
    const cv = mk(W, H), ctx = cv.getContext('2d', { alpha }), scratch = mk(W, H), tw = 96, th = Math.max(16, Math.round(96 * H / W)), tiny = mk(tw, th), tctx = tiny.getContext('2d', { willReadFrequently: true });
    let prev = null, prevI = -1;
    return { canvas: cv, ctx, render(i) {
      const t = t0 + i / fps;
      if (blur === 'full') { E.renderInto(ctx, mod, cfg, look, W, H, t, 5, fps, scratch); return 5; }
      E.renderInto(ctx, mod, cfg, look, W, H, t, 1, fps, scratch);
      if (blur !== 'smart') return 1;
      // A clip that knows how fast it is moving says so, which saves measuring; otherwise compare with the last frame
      const hint = mod.blurHint ? mod.blurHint(cfg, look, t, fps, W, H) : null; let n;
      if (hint) n = hint;
      else {
        tctx.clearRect(0, 0, tw, th); tctx.drawImage(cv, 0, 0, tw, th); const d = tctx.getImageData(0, 0, tw, th).data;
        let m = 0; if (prev) { let s = 0; for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]); m = s / (d.length / 4 * 3) / Math.max(1, i - prevI) * (fps / 60); }
        prev = d; prevI = i; n = m > 14 ? 5 : m > 6 ? 3 : 1;
      }
      if (n > 1) {
        // Keep the frame already drawn as the middle sample and blend in the others around it
        const sx = scratch.getContext('2d'), shutter = 0.5 / fps; let k = 1;
        for (let j = 0; j < n; j++) { if (j === (n - 1) / 2) continue; const ts = t - shutter / 2 + shutter * (j + 0.5) / n;
          sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, W, H); mod.draw(sx, ts, cfg, look, W, H); k++; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 / k; ctx.drawImage(scratch, 0, 0); ctx.globalAlpha = 1; }
      }
      return n;
    } };
  }

  // Worker side
  function workerMain() {
    let R = null, C = null, fps = 60;
    // What every helper needs before drawing: fonts, the map, pictures, the studio, B roll footage, packs
    const setup = async m => {
      if (m.fonts && m.fonts.length && self.fonts) await Promise.all(m.fonts.map(f => { const ff = new FontFace(f.family, `url(${f.url})`, { style: f.style || 'normal', weight: f.weight || '400', unicodeRange: f.range || 'U+0-10FFFF' }); self.fonts.add(ff); return ff.load().catch(() => null); }));
      if (typeof PatterFonts !== 'undefined') await PatterFonts.ready();
      E.fontVersion = 1;
      if (m.needsMap) { await GeoData.load(); if (GeoData.full) await GeoData.full; if (GeoData.state.status !== 'ready') throw new Error('Map unavailable in worker'); }
      if (m.assets && typeof Layers !== 'undefined') await Layers.setAssets(m.assets);
      if (typeof Studio !== 'undefined' && Studio.ready) await Studio.ready();
      if (m.media && typeof Media !== 'undefined') Media.load(m.media);
      if (m.packs && typeof Packs !== 'undefined') Packs.loadInWorker(m.packs);
    };
    self.onmessage = async e => {
      const m = e.data;
      if (m.type === 'cutinit') {
        // A Video tab export: this helper draws the moments without his footage, the page draws the rest
        try {
          await setup(m);
          if (typeof CutMedia !== 'undefined' && CutMedia.seed) CutMedia.seed(m.meta);
          Object.assign(Video.hooks, { look: () => m.appLook, studio: () => m.studio });
          if (m.studioX && Studio.adoptWorker) Studio.adoptWorker(m.studioX);
          (m.chars || []).forEach(d => Character.adoptWorker(d));
          // The intro is drawn here too: its street, logo, squid and fonts, and his own bottle label if he has one
          const intros = [...(m.cfg.items || []), ...(m.cfg.tracks || []).flatMap(T => (T && T.items) || [])].filter(it => it && it.kind === 'clip' && it.mod === 'intro' && it.cfg);
          if (intros.length && typeof Intro !== 'undefined') { await Intro.ready(); if (typeof IntroScenes !== 'undefined') for (const it of intros) if (it.cfg.label) { IntroScenes.useLabel(it.cfg.label); for (let k = 0; k < 50 && !IntroScenes.useLabel(it.cfg.label); k++) await new Promise(r => setTimeout(r, 20)); } }
          const Vw = Layers.wrap(Video), cv = new OffscreenCanvas(m.W, m.H);
          C = { Vw, cfg: m.cfg, look: m.look, m, cv, g: cv.getContext('2d', { alpha: !!m.look.transparent }), images: new Map(m.images || []), blurN: m.blur ? CutExport.blurN(m.fps, m.bW, m.bH) : null };
          Vw.duration(m.cfg, m.look);
          self.postMessage({ type: 'ready' });
        } catch (err) { self.postMessage({ type: 'error', msg: String((err && err.message) || err) }); }
      } else if (m.type === 'cutframe') {
        try {
          const { m: o, g, cv, Vw, cfg, look } = C, t = m.t, a = performance.now();
          if (typeof Media !== 'undefined' && Video.mediaAt) await Media.prepare(Video.mediaAt(cfg, t, look));
          g.setTransform(1, 0, 0, 1, 0, 0); if (look.transparent) g.clearRect(0, 0, o.W, o.H); else { g.fillStyle = '#000'; g.fillRect(0, 0, o.W, o.H); }
          g.setTransform(o.scale, 0, 0, o.scale, 0, 0);
          Vw.draw(g, t, cfg, Object.assign({}, look, { cutEnv: { frames: new Map(), images: C.images, k: o.scale, fps: o.fps, blur: !!o.blur, blurN: C.blurN } }), o.bW, o.bH);
          const bmp = cv.transferToImageBitmap(); self.postMessage({ type: 'cutframe', j: m.j, bmp, ms: performance.now() - a }, [bmp]);
        } catch (err) { self.postMessage({ type: 'cutframe', j: m.j, err: String((err && err.message) || err) }); }
      } else if (m.type === 'init') {
        try {
          await setup(m);
          const mod = allMods().find(x => x.id === m.modId); if (!mod) throw new Error('Unknown clip type');
          if (m.extra && mod.adoptWorker) mod.adoptWorker(m.extra);
          fps = m.fps; R = frameRenderer(mod, m.cfg, m.look, m.W, m.H, m.fps, m.blur, false, m.t0 || 0); R.mod = mod; R.cfg = m.cfg; R.look = m.look; R.t0 = m.t0 || 0;
          mod.duration(m.cfg, m.look);
          self.postMessage({ type: 'ready', gpu: typeof GlobeGL !== 'undefined' && (m.modId === 'map' || m.modId === 'flights' || m.modId === 'flyover' || m.needsMap) ? GlobeGL.available : null });
        } catch (err) { self.postMessage({ type: 'error', msg: String((err && err.message) || err) }); }
      } else if (m.type === 'pframe') {
        // Preview cache: a smaller frame, squeezed to a JPEG so a whole clip fits comfortably in memory
        try { if (R.mod.mediaAt && typeof Media !== 'undefined') await Media.prepare(R.mod.mediaAt(R.cfg, m.t, R.look)); const s = m.scale, w = Math.max(2, Math.round(R.canvas.width * s)), h = Math.max(2, Math.round(R.canvas.height * s));
          if (!R.small || R.small.width !== w) { R.small = new OffscreenCanvas(w, h); R.sctx = R.small.getContext('2d', { alpha: false }); }
          const c = R.sctx, W = R.canvas.width, H = R.canvas.height; c.setTransform(s, 0, 0, s, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, W, H); R.mod.draw(c, m.t, R.cfg, R.look, W, H);
          const blob = await R.small.convertToBlob({ type: 'image/jpeg', quality: 0.86 }); self.postMessage({ type: 'pframe', i: m.i, blob });
        } catch (err) { self.postMessage({ type: 'error', msg: String((err && err.message) || err), i: m.i }); }
      } else if (m.type === 'frame') {
        try {
          if (R.mod.mediaAt && typeof Media !== 'undefined') await Media.prepare(R.mod.mediaAt(R.cfg, R.t0 + m.i / fps, R.look));
          const t0 = performance.now(), n = R.render(m.i), vf = new VideoFrame(R.canvas, { timestamp: Math.round(m.i * 1e6 / fps), duration: Math.round(1e6 / fps) });
          self.postMessage({ type: 'frame', i: m.i, frame: vf, n, ms: performance.now() - t0 }, [vf]);
        } catch (err) { self.postMessage({ type: 'error', msg: String((err && err.message) || err), i: m.i }); }
      }
    };
  }

  // Main side: the web fonts the page uses, so workers can draw identical text.
  async function fontList() {
    const lib = typeof FontLib !== 'undefined' ? (await FontLib.idle(), FontLib.forWorkers()) : [], libF = new Set(lib.map(f => f.family));
    const link = document.querySelector('link[href*="fonts.googleapis.com/css"]'), href = window.PATTER_FONT_CSS || (link && link.href);
    // fonts built into the bundle (PATTER_FONTS) the helpers load themselves; any other loaded web font they could not match
    const own = new Set(typeof PATTER_FONTS !== 'undefined' ? Object.keys(PATTER_FONTS).map(k => k.split('|')[0]) : []);
    const usesWebFonts = () => { try { return !!document.fonts && [...document.fonts].some(ff => ff.status === 'loaded' && !own.has(ff.family.replace(/['"]/g, '')) && !libF.has(ff.family.replace(/['"]/g, ''))); } catch (e) { return false; } };
    if (!href) return usesWebFonts() ? null : lib;
    try {
      const css = await (await fetch(href)).text(), out = [], re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g; let mm;
      const get = (b, k) => { const r = new RegExp(k + '\\s*:\\s*([^;]+);').exec(b); return r ? r[1].trim() : ''; };
      while ((mm = re.exec(css))) { if (mm[1] !== 'latin') continue; const b = mm[2], src = /url\(([^)]+)\)/.exec(b); if (!src) continue;
        out.push({ family: get(b, 'font-family').replace(/['"]/g, ''), style: get(b, 'font-style'), weight: get(b, 'font-weight'), range: get(b, 'unicode-range'), url: new URL(src[1].replace(/['"]/g, ''), href).href }); }
      if (!out.length && /@font-face/.test(css)) { const re2 = /@font-face\s*\{([^}]*)\}/g; while ((mm = re2.exec(css))) { const b = mm[1], src = /url\(([^)]+)\)/.exec(b); if (src) out.push({ family: get(b, 'font-family').replace(/['"]/g, ''), style: get(b, 'font-style'), weight: get(b, 'font-weight'), range: get(b, 'unicode-range'), url: new URL(src[1].replace(/['"]/g, ''), href).href }); } }
      return out.concat(lib);
    } catch (e) { return usesWebFonts() ? null : lib; }
  }
  // Starts n helpers from the app's own code and waits until each has taken in its starting message (msg(fonts) builds it)
  async function spawn(n, msg) {
    if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined' || typeof VideoFrame === 'undefined') return null;
    const el = document.getElementById('patter-js'), src = el && el.textContent; if (!src) return null;
    const d3src = [...document.scripts].map(s => s.src).find(s => /d3(\.min)?\.js/.test(s || ''));
    const fonts = await fontList(); if (fonts === null) return null;
    const pre = `self.PATTER_WORKER=true;self.window=self;self.devicePixelRatio=1;self.PATTER_MAP_URL=${JSON.stringify(window.PATTER_MAP_URL || null)};self.PATTER_MAP_URL_LO=${JSON.stringify(window.PATTER_MAP_URL_LO || null)};` +
      `self.document={createElement:function(){return new OffscreenCanvas(300,150);},fonts:self.fonts,getElementById:function(){return null;},querySelector:function(){return null;},scripts:[]};` +
      (d3src ? `try{importScripts(${JSON.stringify(d3src)});}catch(e){}` : '') + '\n';
    const url = URL.createObjectURL(new Blob([pre, src, '\n;Render.workerMain();'], { type: 'text/javascript' }));
    const workers = [];
    try {
      const m = msg(fonts);
      for (let k = 0; k < n; k++) workers.push(new Worker(url));
      await Promise.all(workers.map(w => new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('Worker start timed out')), 45000);
        w.onmessage = e => { if (e.data.type === 'ready') { clearTimeout(to); workers.gpu = e.data.gpu; res(); } else if (e.data.type === 'error') { clearTimeout(to); rej(new Error(e.data.msg)); } };
        w.onerror = ev => { clearTimeout(to); rej(new Error(ev.message || 'Worker failed')); };
        w.postMessage(m);
      })));
      URL.revokeObjectURL(url); return workers;
    } catch (e) { workers.forEach(w => w.terminate()); URL.revokeObjectURL(url); console.warn('Parallel export unavailable, using one thread:', e.message); return null; }
  }
  async function makePool(mod, cfg, look, W, H, fps, blur, n, t0 = 0) {
    if (mod.noWorkers) return null;   // tabs that are not animations (the thumbnail)
    // his puppet's pictures live on the page: clips that use it hand the helpers a copy (workerData), else they draw on the page
    let extra = null; if (mod.mainThread && mod.mainThread(cfg)) { extra = mod.workerData ? mod.workerData(cfg) : null; if (!extra) return null; }
    const needsMap = mod.id === 'map' || mod.id === 'flights' || mod.id === 'flyover' || !!(mod.needsMap && mod.needsMap(cfg));
    return spawn(n, fonts => ({ type: 'init', modId: mod.id, cfg, look, W, H, fps, blur, fonts, needsMap, t0, extra, assets: typeof Layers !== 'undefined' ? Layers.assetsFor(cfg) : null, packs: typeof Packs !== 'undefined' ? Packs.forWorkers() : null, media: mod.mediaFor && typeof Media !== 'undefined' ? Media.forWorkers(mod.mediaFor(cfg)) : null }));
  }
  /* Helpers for a Video tab export (CutExport): each draws whole frames of the video at the export size, for the moments
     without his own footage, and hands back an ImageBitmap. o: { look (as exported), W, H, bW, bH, scale, fps, blur, images }.
     Returns { size, frame(t) -> Promise<ImageBitmap>, close() } or null when the helpers cannot be used. */
  async function cutPool(cfg, o, n) {
    if (typeof Video === 'undefined' || typeof CutMedia === 'undefined' || !CutMedia.forWorkers || n < 1) return null;
    const all = [...(cfg.items || []), ...(cfg.tracks || []).flatMap(T => (T && T.items) || [])];
    const chars = []; for (const it of all) if (it && it.kind === 'clip' && it.mod === 'char' && it.cfg) { const d = Character.workerData(it.cfg); if (!d) return null; chars.push(d); }
    const studio = Video.studioCfg(cfg); let studioX = null;
    if (studio && Studio.mainThread(studio) && all.some(it => it && it.kind === 'avatar')) { studioX = Studio.workerData(studio); if (!studioX) return null; }
    const assets = {}; if (typeof Layers !== 'undefined') { [cfg, studio, ...all.map(it => it && it.cfg)].forEach(c => { if (c) Object.assign(assets, Layers.assetsFor(c)); }); }
    const images = [...(o.images || new Map())].filter(([, b]) => b);
    const workers = await spawn(n, fonts => ({ type: 'cutinit', cfg, look: o.look, appLook: Video.hooks.look ? Video.hooks.look() : o.look, studio, studioX, chars, W: o.W, H: o.H, bW: o.bW, bH: o.bH, scale: o.scale, fps: o.fps, blur: !!o.blur,
      fonts, needsMap: !!Video.needsMap(cfg), assets, images, meta: CutMedia.forWorkers(Video.assetsUsed(cfg)), packs: typeof Packs !== 'undefined' ? Packs.forWorkers() : null, media: typeof Media !== 'undefined' ? Media.forWorkers(Video.mediaFor(cfg)) : null }));
    if (!workers) return null;
    const idle = [...workers], queue = [], wait = new Map(); let j = 0, dead = null;
    const run = () => { while (idle.length && queue.length) { const w = idle.pop(), job = queue.shift(); w.postMessage({ type: 'cutframe', j: job.j, t: job.t }); } };
    workers.forEach(w => {
      w.onmessage = e => { const m = e.data; if (m.type !== 'cutframe') return; idle.push(w); const p = wait.get(m.j); wait.delete(m.j); if (p) { if (m.err) p.rej(new Error(m.err)); else p.res(m.bmp); } else if (m.bmp) m.bmp.close(); run(); };
      w.onerror = ev => { dead = new Error('A render helper crashed: ' + (ev.message || '')); wait.forEach(p => p.rej(dead)); wait.clear(); };
    });
    return { size: workers.length,
      frame(t) { if (dead) return Promise.reject(dead); const id = j++; return new Promise((res, rej) => { wait.set(id, { res, rej }); queue.push({ j: id, t }); run(); }); },
      close() { workers.forEach(w => w.terminate()); wait.forEach(p => p.rej(new Error('Stopped'))); wait.clear(); queue.length = 0; } };
  }
  function cores() { return Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)); }

  // Renders every frame and hands each VideoFrame to onFrame(frame, i) strictly in order.
  async function renderFrames(mod, cfg, look, { fps, blur, onFrame, signal, onInfo, frames, t0 = 0 }) {
    const { W, H } = E.dims(look.format), n = frames;
    if (mod.mediaFor && typeof Media !== 'undefined') await Media.ensure(mod.mediaFor(cfg));
    if (mod.prepare) await mod.prepare(cfg);
    const pool = await makePool(mod, cfg, look, W, H, fps, blur, cores(), t0);
    if (!pool) {
      const isGlobe = mod.id === 'map' || mod.id === 'flights' || mod.id === 'flyover';
      onInfo && onInfo({ threads: 1, gpu: isGlobe && typeof GlobeGL !== 'undefined' ? GlobeGL.available : null });
      const R = frameRenderer(mod, cfg, look, W, H, fps, blur, false, t0); let drawMs = 0;
      for (let i = 0; i < n; i++) {
        if (signal && signal.aborted) throw new Error('Export cancelled.');
        if (mod.mediaAt && typeof Media !== 'undefined') await Media.prepare(mod.mediaAt(cfg, t0 + i / fps, look));
        const tA = performance.now(); R.render(i); drawMs += performance.now() - tA; if (i === n - 1) onInfo && onInfo({ drawMs: drawMs / n }); const vf = new VideoFrame(R.canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        await onFrame(vf, i); if (i % 4 === 0) await new Promise(r => setTimeout(r, 0));
      }
      return;
    }
    onInfo && onInfo({ threads: pool.length, gpu: pool.gpu }); let drawMs = 0, drawN = 0;
    return new Promise((resolve, reject) => {
      const buf = new Map(), idle = [...pool], ahead = pool.length * 3; let next = 0, done = 0, failed = false, pumping = false;
      const finish = err => { if (failed) return; failed = !!err; pool.forEach(w => w.terminate()); buf.forEach(f => f.close()); buf.clear(); err ? reject(err) : resolve(); };
      const dispatch = () => { while (idle.length && next < n && next - done < ahead) { const w = idle.pop(); w.postMessage({ type: 'frame', i: next++ }); } };
      const pump = async () => {
        if (pumping) return; pumping = true;
        try {
          while (buf.has(done)) { if (signal && signal.aborted) throw new Error('Export cancelled.'); const f = buf.get(done); buf.delete(done); await onFrame(f, done); done++; dispatch(); }
          if (done >= n) { onInfo && onInfo({ drawMs: drawN ? drawMs / drawN : 0 }); finish(); }
        } catch (e) { finish(e); } finally { pumping = false; }
        if (!failed && buf.has(done)) pump();
      };
      pool.forEach(w => {
        w.onmessage = e => { const m = e.data; if (failed) { if (m.frame) m.frame.close(); return; }
          if (m.type === 'frame') { drawMs += m.ms || 0; drawN++; buf.set(m.i, m.frame); idle.push(w); dispatch(); pump(); }
          else if (m.type === 'error') finish(new Error('A render worker failed: ' + m.msg)); };
        w.onerror = ev => finish(new Error('A render worker crashed: ' + (ev.message || '')));
      });
      if (signal) signal.addEventListener('abort', () => finish(new Error('Export cancelled.')));
      dispatch();
    });
  }
  // Builds the smooth preview: every frame of the clip drawn ahead of time in the background, handed back as JPEG blobs.
  // Uses only a few workers so the app stays responsive while you keep editing.
  async function buildPreview(mod, cfg, look, { fps = 30, scale = 0.5, onFrame, signal, workers = 2 }) {
    const { W, H } = E.dims(look.format), n = Math.ceil(mod.duration(cfg, look) * fps) + 1;
    if (mod.mediaFor && typeof Media !== 'undefined') await Media.ensure(mod.mediaFor(cfg));
    const pool = await makePool(mod, cfg, Object.assign({}, look, { preview: false }), W, H, fps, 'off', workers, 0); if (!pool) return false;
    if (signal && signal.aborted) { pool.forEach(w => w.terminate()); return false; }
    return new Promise(resolve => {
      let next = 0, done = 0, over = false; const stop = ok => { if (over) return; over = true; pool.forEach(w => w.terminate()); resolve(ok); };
      // Frames go out from the start so playback can use them as soon as possible
      const send = w => { if (next >= n) return; const i = next++; w.postMessage({ type: 'pframe', i, t: i / fps, scale }); };
      pool.forEach(w => { w.onmessage = e => { const m = e.data; if (over) return; if (m.type === 'pframe') { onFrame(m.i, m.blob, n); done++; if (done >= n) stop(true); else send(w); } else if (m.type === 'error') stop(false); }; w.onerror = () => stop(false); });
      if (signal) signal.addEventListener('abort', () => stop(false));
      pool.forEach(w => { send(w); send(w); });
    });
  }
  return { workerMain, frameRenderer, renderFrames, buildPreview, inWorker, cores, cutPool };
})();

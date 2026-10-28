/* Patter Studio engine: maths, colour schemes, comic drawing kit, renderer, preview player, exporters. */
const E = (() => {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    io4: t => { t = cl(t, 0, 1); return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; },
    io3: t => { t = cl(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    sine: t => { t = cl(t, 0, 1); return -(Math.cos(Math.PI * t) - 1) / 2; },
    out3: t => { t = cl(t, 0, 1); return 1 - Math.pow(1 - t, 3); },
    expo: t => { t = cl(t, 0, 1); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    in3: t => { t = cl(t, 0, 1); return t * t * t; },
    back: (t, c = 1.6) => { t = cl(t, 0, 1); return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  const spring = (t, k = 7, w = 10) => t <= 0 ? 0 : 1 - Math.exp(-k * t) * Math.cos(w * t);
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const SCHEMES = {
    saltire: { name: 'Saltire blue', bg: '#1d5bbd', dot: '#16489a' },
    chalk: { name: 'Chalkboard green', bg: '#25463b', dot: '#1d382f' },
    studio: { name: 'Night studio', bg: '#152340', dot: '#1d2f55' },
    bru: { name: 'Irn-Bru orange', bg: '#ee7a1c', dot: '#d9670f' },
    newsprint: { name: 'Newsprint', bg: '#e6dfcc', dot: '#d3c9b0' },
    charcoal: { name: 'Charcoal', bg: '#2b2e34', dot: '#35393f' },
  };
  const BASE = { paper: '#f4eedf', ink: '#0d1420', shadow: '#08101c', grid: '#ddd3bb', text: '#0d1420' };
  const COLOURS = { 'Irn-Bru orange': '#f5821f', 'Neon red': '#e3302c', 'Saltire blue': '#1d5bbd', 'Grass green': '#3fae49', 'Sunshine yellow': '#f7c531', 'Thistle purple': '#8a5cc2', 'Sky teal': '#2bb3b1', 'Ink black': '#0d1420' };
  function palette(look) { const s = SCHEMES[look.scheme] || SCHEMES.saltire; return Object.assign({}, BASE, s, { accent: look.accent || COLOURS['Irn-Bru orange'], accent2: look.accent2 || COLOURS['Neon red'] }); }
  function dims(format) { return format === '9:16' ? { W: 1080, H: 1920 } : { W: 1920, H: 1080 }; }

  const FONT = { display: 'Anton, Impact, "Arial Narrow", sans-serif', label: '"Archivo Narrow", "Arial Narrow", Arial, sans-serif' };
  const fd = s => `${s}px ${FONT.display}`, fl = (s, w = 700) => `${w} ${s}px ${FONT.label}`;

  // Halftone background, cached per scheme and size.
  const bgCache = {};
  function bgTile(P, W, H, texture) {
    const key = P.bg + P.dot + W + 'x' + H + texture;
    if (bgCache[key]) return bgCache[key];
    const pad = Math.round(Math.max(W, H) * 0.12), c = document.createElement('canvas'); c.width = W + pad * 2; c.height = H + pad * 2;
    const g = c.getContext('2d'); g.fillStyle = P.bg; g.fillRect(0, 0, c.width, c.height);
    if (texture) {
      const step = Math.round(Math.min(W, H) / 54); g.fillStyle = P.dot;
      for (let y = 0, r = 0; y < c.height; y += step, r++) for (let x = (r % 2) * step / 2; x < c.width + step; x += step) {
        const f = cl((x * 0.55 + y) / (c.width * 0.55 + c.height), 0, 1), rad = step * (0.04 + Math.pow(f, 1.3) * 0.3);
        g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      }
    }
    const gr = g.createRadialGradient(c.width * 0.45, c.height * 0.42, Math.min(W, H) * 0.1, c.width * 0.5, c.height * 0.5, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,30,0.26)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    const out = { c, pad }; bgCache[key] = out; return out;
  }
  function drawBg(ctx, P, look, W, H, px = 0, py = 0, hook = true) {
    if (!look.transparent) { const b = bgTile(P, W, H, look.texture !== false); ctx.drawImage(b.c, -b.pad + cl(px, -b.pad, b.pad), -b.pad + cl(py, -b.pad, b.pad)); }
    if (hook) behind(ctx);
  }
  // Layers set to "behind the scene" are drawn here: straight after the background, before the clip's own content
  const hookBox = { fn: null };
  function behind(ctx) { const f = hookBox.fn; if (f) { hookBox.fn = null; f(ctx); } }

  // Comic drawing kit. Sizes are in frame pixels; u is a unit equal to min(W,H)/1080.
  function panel(ctx, x, y, w, h, P, u, opt = {}) {
    const sh = (opt.shadow ?? 16) * u;
    ctx.fillStyle = P.shadow; ctx.fillRect(x + sh, y + sh, w, h);
    ctx.fillStyle = opt.fill || P.paper; ctx.fillRect(x, y, w, h);
    if (opt.grain) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = grain(ctx); ctx.fillRect(x, y, w, h); ctx.restore(); }
    ctx.lineWidth = 7 * u; ctx.strokeStyle = P.ink; ctx.lineJoin = 'miter'; ctx.strokeRect(x, y, w, h);
  }
  let grainPat = null;
  function grain(ctx) {
    if (grainPat) return grainPat; const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), im = g.createImageData(160, 160), r = rng(7);
    for (let i = 0; i < im.data.length; i += 4) { im.data[i] = 95; im.data[i + 1] = 80; im.data[i + 2] = 55; im.data[i + 3] = r() * 26; }
    g.putImageData(im, 0, 0); grainPat = ctx.createPattern(c, 'repeat'); return grainPat;
  }
  function banner(ctx, text, cx, cy, fs, fill, txt, P, rot = 0, sc = 1) {
    if (!text || sc <= 0.001) return { w: 0, h: 0 };
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.font = fd(fs);
    const w = ctx.measureText(text).width + fs * 0.9, h = fs * 1.42, s = fs * 0.12;
    ctx.fillStyle = P.shadow; ctx.fillRect(-w / 2 + s, -h / 2 + s, w, h); ctx.fillStyle = fill; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.lineWidth = Math.max(2, fs * 0.08); ctx.strokeStyle = P.ink; ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = txt; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, fs * 0.05);
    ctx.restore(); return { w, h };
  }
  const ARROW = [[0, 0], [-38, -28], [-38, -12], [-110, -12], [-110, 12], [-38, 12], [-38, 28]];
  function arrow(ctx, tx, ty, ang, size, fill, P, sq = 1) {
    const k = size / 110, path = () => { ctx.beginPath(); ARROW.forEach((p, i) => i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)); ctx.closePath(); };
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang); ctx.scale(sq, 1 / sq);
    ctx.save(); ctx.translate(size * 0.05, size * 0.05); path(); ctx.fillStyle = P.shadow; ctx.fill(); ctx.restore();
    path(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = size * 0.055; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  // Impact lines: tapered strokes that shoot out and fade, eased so they never pop on or off.
  function burst(ctx, cx, cy, r, p, P, u, n = 14, sx = 1, sy = 1) {
    if (p <= 0 || p >= 1) return; const head = ease.out3(p), tail = ease.out3(cl((p - 0.2) / 0.8, 0, 1)), alpha = cl(p / 0.08, 0, 1) * (1 - ease.sine(cl((p - 0.5) / 0.5, 0, 1)));
    ctx.save(); ctx.fillStyle = P.ink; ctx.globalAlpha *= alpha;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.25, len = r * (i % 3 ? 0.32 : 0.42), d0 = r * 0.82 + tail * len, d1 = r * 0.82 + head * len; if (d1 - d0 < 0.5) continue;
      const dx = Math.cos(a), dy = Math.sin(a), w = (6 * u) * (1 - p * 0.55), nx = -dy, ny = dx, x0 = cx + dx * d0 * sx, y0 = cy + dy * d0 * sy, x1 = cx + dx * d1 * sx, y1 = cy + dy * d1 * sy;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + nx * w, y1 + ny * w); ctx.arc(x1, y1, w, a + Math.PI / 2, a - Math.PI / 2, true); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function ripple(ctx, cx, cy, r, p, col, u) {
    for (let k = 0; k < 2; k++) { const q = ease.out3((p - k * 0.2) / 0.8); if (q > 0 && q < 1) { ctx.save(); ctx.globalAlpha *= (1 - q) * Math.min(1, q * 8); ctx.beginPath(); ctx.arc(cx, cy, r * (0.25 + q), 0, 7); ctx.lineWidth = 6 * u * (1 - q * 0.5); ctx.strokeStyle = col; ctx.stroke(); ctx.restore(); } }
  }
  function star(ctx, cx, cy, ro, ri, n, fill, P, u, rot = 0, seed = 1) {
    const r = rng(seed); ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const rad = i % 2 ? ri * (0.85 + r() * 0.3) : ro * (0.85 + r() * 0.3), a = rot + i * Math.PI / n; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function puff(ctx, cx, cy, r, P, u, alpha) {
    if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath();
    [[0, 0, 1], [-0.7, 0.2, 0.7], [0.7, 0.15, 0.75], [0.1, -0.55, 0.65]].forEach(([dx, dy, s]) => { ctx.moveTo(cx + dx * r + s * r, cy + dy * r); ctx.arc(cx + dx * r, cy + dy * r, s * r, 0, 7); });
    ctx.fillStyle = P.paper; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
  }
  function speedLines(ctx, x, y, ang, len, spread, n, p, P, u, seed = 3) {
    const r = rng(seed); ctx.save(); ctx.strokeStyle = P.ink; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const off = (r() - 0.5) * spread, l = len * (0.5 + r() * 0.6), ph = (p * 2 + r()) % 1, a = ang + Math.PI;
      const sx = x + Math.cos(ang + Math.PI / 2) * off + Math.cos(a) * l * ph * 0.6, sy = y + Math.sin(ang + Math.PI / 2) * off + Math.sin(a) * l * ph * 0.6;
      ctx.globalAlpha = 0.65 * (1 - ph); ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * l * 0.5, sy + Math.sin(a) * l * 0.5); ctx.stroke(); }
    ctx.restore();
  }
  function wrapText(ctx, text, maxW, maxLines = 3) {
    const ws = String(text).split(/\s+/).filter(Boolean), L = []; let c = '';
    ws.forEach(w => { const n = c ? c + ' ' + w : w; if (ctx.measureText(n).width > maxW && c) { L.push(c); c = w; } else c = n; });
    if (c) L.push(c); return L.slice(0, maxLines);
  }
  function fitFont(ctx, text, maxW, size, fontFn) { let s = size; ctx.font = fontFn(s); while (ctx.measureText(text).width > maxW && s > 8) { s *= 0.94; ctx.font = fontFn(s); } return s; }
  function curvePath(ctx, p) {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 0; i < p.length - 1; i++) { const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)];
      ctx.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]); }
  }
  function shake(t, t0, amp, dur = 0.45) { const d = t - t0; if (d < 0 || d > dur) return [0, 0]; const a = Math.exp(-d * 9) * amp; return [Math.sin(t * 83) * a, Math.cos(t * 61) * a * 0.7]; }

  // Renders one frame of a module at full size, with optional motion blur sub samples.
  function renderInto(ctx, mod, cfg, look, W, H, t, samples, fps, scratch) {
    if (samples <= 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); mod.draw(ctx, t, cfg, look, W, H); return; }
    const sx = scratch.getContext('2d'), shutter = 0.5 / fps;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < samples; i++) {
      const ts = t - shutter / 2 + shutter * (i + 0.5) / samples;
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, W, H); mod.draw(sx, ts, cfg, look, W, H);
      ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(scratch, 0, 0); ctx.globalAlpha = 1;
    }
  }

  // Live preview player.
  function Player(canvas, getState, onTime) {
    const ctx = canvas.getContext('2d'); let cache = null, playing = false, t = 0, last = performance.now(), dur = 5, scrubbing = false, quality = 1, avg = 0, count = 0, frozen = false, lastKey = '', mode = 'normal', loop = null;
    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const st = getState(); if (!st || frozen) { requestAnimationFrame(frame); return; }
      const { mod, cfg, look } = st, { W, H } = dims(look.format); dur = mod.duration(cfg, look);
      if (playing && !scrubbing) { t += dt; if (loop) { if (t > loop[1] || t < loop[0] - 0.05) t = loop[0]; } else if (t >= dur) { t = dur; playing = false; } }
      // When paused, only redraw if something actually changed (time, settings or size), so the computer isn't kept busy
      if (!playing) { const key = t.toFixed(4) + '|' + mode + '|' + mod.id + '|' + (typeof Media !== 'undefined' ? Media.tick : 0) + '|' + (typeof Packs !== 'undefined' ? Packs.version : 0) + '|' + JSON.stringify(cfg) + JSON.stringify(look) + canvas.clientWidth + 'x' + canvas.clientHeight + '|' + (E.fontVersion || 0) + '|' + (typeof GeoData !== 'undefined' ? GeoData.state.version : 0); if (key === lastKey) { onTime && onTime(Math.min(t, dur), dur, playing); requestAnimationFrame(frame); return; } lastKey = key; } else lastKey = '';
      const dpr = mode === 'draft' ? Math.min(1, window.devicePixelRatio || 1) * 0.5 : Math.min(window.devicePixelRatio || 1, 2) * (mode === 'full' ? 1 : quality), cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      const fs = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = Math.min(canvas.width / W, canvas.height / H), ox = (canvas.width - W * k) / 2, oy = (canvas.height - H * k) / 2;
      if (look.transparent) { checker(ctx, ox, oy, W * k, H * k); }
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, W * k, H * k); ctx.clip(); ctx.translate(ox, oy); ctx.scale(k, k);
      // While playing, use the smooth preview's ready made frame when there is one; paused frames are always drawn live
      const cf = cache && playing && !scrubbing && cache.frameAt ? cache.frameAt(Math.min(t, dur)) : null;
      if (cf) { ctx.drawImage(cf, 0, 0, W, H); } else
      try { mod.draw(ctx, Math.min(t, dur), cfg, Object.assign({}, look, { preview: mode !== 'full', paused: !playing || scrubbing }), W, H); } catch (e) { console.error(e); }
      ctx.restore(); onTime && onTime(Math.min(t, dur), dur, playing);
      // Keep the preview smooth: drop the preview resolution a notch on slow frames, raise it again when there's headroom.
      const ms = performance.now() - fs; avg = avg * 0.9 + ms * 0.1;
      if (!cf && ++count % 30 === 0 && mode === 'normal') { if (avg > 20 && quality > 0.5) quality = Math.max(0.5, quality - 0.15); else if (avg < 8 && quality < 1) quality = Math.min(1, quality + 0.1); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return {
      setCache(c) { cache = c; }, play() { playing = true; }, pause() { playing = false; }, freeze(v) { frozen = !!v; }, toggle() { if (!playing && !loop && t >= dur - 1e-3) t = 0; playing = !playing; return playing; }, reset() { t = loop ? loop[0] : 0; playing = false; },
      restart() { t = loop ? loop[0] : 0; playing = true; }, seek(v) { t = v; }, setMode(m) { mode = m; quality = 1; }, setLoop(r) { loop = r; if (r) { t = r[0]; playing = true; } }, get loop() { return loop; }, scrub(on) { scrubbing = on; }, get t() { return t; }, get playing() { return playing; },
    };
  }
  function checker(ctx, x, y, w, h) { const s = 12; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#cfcfcf'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#efefef'; for (let j = 0; j * s < h; j++) for (let i = (j % 2); i * s < w; i += 2) ctx.fillRect(x + i * s, y + j * s, s, s); ctx.restore(); }

  // Export: MP4 via WebCodecs H.264 and our muxer.
  async function pickCodec(W, H, fps) {
    const list = ['avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.4D402A', 'avc1.42E02A'];
    for (const codec of list) {
      for (const hw of ['prefer-hardware', 'no-preference']) {
        const c = { codec, width: W, height: H, framerate: fps, bitrate: Math.round(Math.min(80e6, Math.max(12e6, W * H * fps * 0.32))), // about 40 Mbps at 1080p60: a clean master for After Effects
          bitrateMode: 'variable', latencyMode: 'quality', hardwareAcceleration: hw, avc: { format: 'avc' } };
        try { const s = await VideoEncoder.isConfigSupported(c); if (s.supported) return s.config; } catch (e) { }
      }
    }
    return null;
  }
  async function exportMP4(mod, cfg, look, { fps = 60, blur = 'smart', onProgress, signal, onInfo, range } = {}) {
    if (document.fonts) await document.fonts.ready;
    if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video. Open the file in Microsoft Edge or Google Chrome.');
    const { W, H } = dims(look.format), dur = mod.duration(cfg, look), t0 = range ? cl(range[0], 0, dur) : 0, t1 = range ? cl(range[1], t0 + 1 / fps, dur) : dur, n = Math.ceil((t1 - t0) * fps) + 1;
    const config = await pickCodec(W, H, fps); if (!config) throw new Error('H.264 encoding is not available in this browser. Update Edge and try again.');
    const chunks = []; let avcC = null, err = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); chunks.push({ d, ts: chunk.timestamp, key: chunk.type === 'key' }); }, error: e => { err = e; } });
    enc.configure(config);
    const lookX = Object.assign({}, look, { transparent: false, preview: false });
    try {
      await Render.renderFrames(mod, cfg, lookX, { fps, blur, signal, onInfo, frames: n, t0, onFrame: async (vf, i) => {
        if (err) { vf.close(); throw err; }
        enc.encode(vf, { keyFrame: i % fps === 0 }); vf.close(); // a keyframe every second keeps scrubbing snappy in editors
        while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 2));
        if (i % 4 === 0) onProgress && onProgress(i / n);
      } });
      await enc.flush();
    } finally { try { enc.close(); } catch (e) { } }
    if (err) throw err; if (!avcC) throw new Error('The encoder did not return stream settings.');
    const timescale = fps * 1000, delta = 1000;
    const sortedTs = chunks.map(c => c.ts).sort((a, b) => a - b);
    let shift = 0; chunks.forEach((c, i) => { shift = Math.max(shift, Math.round((sortedTs[i] - c.ts) * timescale / 1e6)); });
    const samplesOut = chunks.map((c, i) => ({ data: c.d, dur: delta, key: c.key, cto: Math.round(c.ts * timescale / 1e6) - i * delta + shift }));
    const mp4 = MP4Mux.mux({ width: W, height: H, timescale, samples: samplesOut, avcC });
    onProgress && onProgress(1);
    return new Blob([mp4], { type: 'video/mp4' });
  }

  // Export: transparent PNG sequence, written straight to a folder when possible, otherwise a zip.
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function Zip() {
    const parts = [], central = []; let offset = 0;
    const le = (n, b) => { const a = []; for (let i = 0; i < b; i++) a.push((n >>> (8 * i)) & 255); return a; };
    return {
      add(name, data) {
        const nm = new TextEncoder().encode(name), crc = crc32(data);
        const head = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nm.length, 2), 0, 0]);
        parts.push(head, nm, data);
        central.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nm.length, 2), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(offset, 4)]), nm);
        offset += head.length + nm.length + data.length;
      },
      blob() {
        let size = 0; central.forEach(c => size += c.length); const count = central.length / 2;
        const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...le(count, 2), ...le(count, 2), ...le(size, 4), ...le(offset, 4), 0, 0]);
        return new Blob([...parts, ...central, end], { type: 'application/zip' });
      }
    };
  }
  async function exportPNG(mod, cfg, look, { fps = 60, blur = 'smart', onProgress, signal, dir, range } = {}) {
    if (document.fonts) await document.fonts.ready;
    const { W, H } = dims(look.format), dur = mod.duration(cfg, look), t0 = range ? cl(range[0], 0, dur) : 0, t1 = range ? cl(range[1], t0 + 1 / fps, dur) : dur, n = Math.ceil((t1 - t0) * fps) + 1;
    if (mod.mediaFor && typeof Media !== 'undefined') await Media.ensure(mod.mediaFor(cfg));
    const lookX = Object.assign({}, look, { transparent: true, preview: false }), zip = dir ? null : Zip(), R = Render.frameRenderer(mod, cfg, lookX, W, H, fps, blur, true, t0);
    const toPng = c => c.convertToBlob ? c.convertToBlob({ type: 'image/png' }) : new Promise(r => c.toBlob(r, 'image/png'));
    for (let i = 0; i < n; i++) {
      if (signal && signal.aborted) throw new Error('Export cancelled.');
      if (mod.mediaAt && typeof Media !== 'undefined') await Media.prepare(mod.mediaAt(cfg, t0 + i / fps));
      R.render(i);
      const blob = await toPng(R.canvas), name = 'frame_' + String(i).padStart(5, '0') + '.png';
      if (dir) { const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(blob); await w.close(); }
      else zip.add(name, new Uint8Array(await blob.arrayBuffer()));
      if (i % 3 === 0) onProgress && onProgress(i / n);
    }
    onProgress && onProgress(1); return dir ? null : zip.blob();
  }
  async function saveBlob(blob, name, types) {
    if (window.showSaveFilePicker) {
      try { const h = await showSaveFilePicker({ suggestedName: name, types }); const w = await h.createWritable(); await w.write(blob); await w.close(); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); return true;
  }

  function title(ctx, text, t, W, H, C, u, y) {
    if (!text) return; const hs = spring((t - 0.05) * 1.1, 6.5, 9); const T = String(text).toUpperCase(), fs0 = (H > W ? 52 : 48) * u;
    ctx.font = fd(fs0); const w = ctx.measureText(T).width + fs0 * 0.9, k = Math.min(1, W * 0.86 / w);
    banner(ctx, T, W / 2, y ?? H * (H > W ? 0.075 : 0.085), fs0 * k, C.accent2, '#fff', C, (-2 - 6 * (1 - hs)) * Math.PI / 180, 0.6 + 0.4 * hs);
  }
  function fadeIn(ctx, t, W, H, C, look) { const f = 1 - ease.expo(t / 0.35); if (f > 0 && !look.transparent) { ctx.save(); ctx.globalAlpha = f; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
  function hexMix(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t)); return `rgb(${r},${g},${bl})`; }
  function camera(ctx, W, H, fx, fy, z, t, u, shx = 0, shy = 0) { const d = Math.min(1, t / 1.2); fx += Math.sin(t * 0.9) * 3 * u * d; fy += Math.cos(t * 0.7) * 2.5 * u * d; ctx.translate(W / 2 + shx, H / 2 + shy); ctx.scale(z, z); ctx.translate(-fx, -fy); return [fx, fy]; }
  // Timing overrides from dragging bars on the timeline: cfg.timing[id] = seconds. Missing means automatic.
  const tm = (cfg, id) => { const v = cfg && cfg.timing && +cfg.timing[id]; return v > 0 && isFinite(v) ? v : undefined; };
  const setTm = (cfg, id, v) => { if (!cfg.timing || typeof cfg.timing !== 'object') cfg.timing = {}; cfg.timing[id] = Math.round(Math.max(0.1, Math.min(600, v)) * 100) / 100; };
  return { tm, setTm, hookBox, behind, title, fadeIn, hexMix, camera, cl, lerp, ease, spring, rng, SCHEMES, COLOURS, palette, dims, FONT, fd, fl, drawBg, panel, grain, banner, arrow, burst, ripple, star, puff, speedLines, wrapText, fitFont, curvePath, shake, renderInto, Player, exportMP4, exportPNG, saveBlob, checker };
})();

/* Video: the editor. A whole video on a multi-track timeline, like CapCut.
   - The main track (cfg.items) is magnetic: clips butt up one after another, with transitions overlapping them. It holds
     clips made in the other tabs, your own footage and pictures, avatar gaps (where you talk to camera) and colour cards.
   - Overlay tracks (cfg.tracks, kind 'video') hold footage, pictures and clips placed freely on top, plus adjustment clips
     that grade everything under them. Audio tracks (kind 'audio') hold voiceover, music and sound effects.
   - Text, stickers and the rest come from Layers, on top of everything.
   Every clip can be moved, scaled, turned, cropped, masked, blended, graded, keyed, sped up, animated and keyframed. */
const Video = (() => {
  const { H, field, sel, txt, area, btn, card } = UI;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const NAMES = { charts: 'Chart', timeline: 'Timeline', map: 'World map', flights: 'Flights', flyover: 'Map flyover', picto: 'Pictogram', news: 'Newspaper', story: 'Story', broll: 'B roll', studio: 'Studio' };
  const COLS = { charts: '#3b7dd8', timeline: '#2f9a8a', map: '#3c8f4a', flights: '#4f6fd0', flyover: '#2d7a6a', picto: '#b0703a', news: '#8a8a8a', story: '#7d6420', broll: '#6d4f9a', studio: '#3a5f8a', avatar: '#a03a6a', media: '#2a6f8f', image: '#7a5a2a', audio: '#2f7d4f', colour: '#555b66', adjust: '#6a4f8a' };
  const raw = k => ({ charts: typeof Charts !== 'undefined' && Charts, timeline: typeof Timeline !== 'undefined' && Timeline, map: typeof MapMod !== 'undefined' && MapMod, flights: typeof Flights !== 'undefined' && Flights, flyover: typeof Flyover !== 'undefined' && Flyover, picto: typeof Picto !== 'undefined' && Picto, news: typeof News !== 'undefined' && News, story: typeof Story !== 'undefined' && Story, broll: typeof Broll !== 'undefined' && Broll, studio: typeof Studio !== 'undefined' && Studio })[k] || null;
  const modOf = k => { const m = raw(k); return m ? (typeof Layers !== 'undefined' ? Layers.wrap(m) : m) : null; };
  const hooks = {};
  const nid = p => p + Math.random().toString(36).slice(2, 9);
  const lookFor = (it, look) => { const L = Object.assign({}, look, it.look || {}); if (it.mod === 'story' || it.mod === 'broll') L.scheme = 'chalk'; delete L.cutEnv; return L; };
  const WPS = 2.6;
  const fitWords = s => r2(cl(String(s || '').trim().split(/\s+/).filter(Boolean).length / WPS + 0.6, 1.2, 120));
  const M = id => typeof CutMedia !== 'undefined' ? CutMedia.info(id) : null;
  const isVis = it => it && it.kind !== 'audio';
  const hasPic = it => it && (it.kind === 'clip' || it.kind === 'media' || it.kind === 'colour' || it.kind === 'avatar');

  /* ---------- Lengths and layout ---------- */
  function natural(it, look) { const Mo = modOf(it.mod); if (!Mo || !it.cfg) return 3; let d = 3; try { d = Mo.duration(it.cfg, lookFor(it, look)); } catch (e) { } return d > 0 && isFinite(d) ? d : 3; }
  const speedOf = it => cl(+it.speed || 1, 0.05, 100);
  // A tab clip's own stretch: from its in point to its out point (seconds of the clip itself), and its whole length
  function clipSpan(it, look) { const d = natural(it, look), a = cl(+it.inPt || 0, 0, Math.max(0, d - 0.2)), e = it.outPt != null ? cl(+it.outPt, a + 0.1, d) : d; return [a, e, d]; }
  const clipInner = (it, local, look) => { const [a, e] = clipSpan(it, look); return Math.min(e - 1e-4, a + Math.max(0, local) * speedOf(it)); };
  // Source stretch of a footage or sound clip: where it starts and ends in the file
  function srcSpan(it) { const m = M(it.asset), full = m ? (m.dur || 0) : 0; let a = cl(+it.src0 || 0, 0, Math.max(0, full - 0.04)), b = it.src1 == null ? full : cl(+it.src1, a + 0.04, Math.max(a + 0.04, full)); if (!m) b = it.src1 == null ? a + 3 : +it.src1; return [a, Math.max(a + 0.04, b)]; }
  function lenOf(it, look) { const d = lenOf0(it, look); return isFinite(d) ? Math.min(d, 36000) : 3; }   // ten hours at most
  function lenOf0(it, look) {
    if (!it) return 0;
    if (it.kind === 'avatar') return cl(+it.dur || 3, 0.3, 3600);
    if (it.kind === 'colour' || it.kind === 'adjust') return cl(+it.dur || 3, 0.1, 3600);
    if (it.kind === 'media' || it.kind === 'audio') { const m = M(it.asset); if (m && m.kind === 'image') return cl(+it.dur || 4, 0.1, 3600); if (it.still != null) return cl(+it.dur || 2, 0.1, 3600); const [a, b] = srcSpan(it); return Math.max(0.04, (b - a) / speedOf(it)); }
    const [a, e] = clipSpan(it, look); return Math.max(0.2, (e - a) / speedOf(it) + cl(+it.hold || 0, 0, 600));
  }
  // A transition on a main track clip overlaps it with the next one; it can't be longer than half of either
  const TRMAX = (a, b, look) => Math.max(0, Math.min(lenOf(a, look), lenOf(b, look)) / 2 - 0.02);
  function trLen(it, next, look) { if (!it || !next || !it.tr || !it.tr.k || it.tr.k === 'none') return 0; const mx = Math.min(3, TRMAX(it, next, look)); if (mx < 0.1) return 0; return cl(+it.tr.d || 0.5, 0.1, mx); }
  function layout(cfg, look) { const items = cfg.items || [], out = []; let t = 0;
    for (let i = 0; i < items.length; i++) { const it = items[i], d = lenOf(it, look), o = { it, i, t0: t, d, trIn: out.length ? out[out.length - 1].trOut : 0, trOut: trLen(it, items[i + 1], look) }; out.push(o); t += d - o.trOut; }
    return out; }
  const mainEnd = (cfg, look) => { const L = layout(cfg, look), l = L[L.length - 1]; return l ? l.t0 + l.d : 0; };
  function at(cfg, look, t) { const L = layout(cfg, look); if (!L.length) return null; let o = L[0]; for (const x of L) { if (x.t0 <= t + 1e-9) o = x; else break; } return o; }
  const tracksOf = (cfg, kind) => (cfg.tracks || []).filter(T => T && (!kind || T.kind === kind));
  function duration(cfg, look) { let d = mainEnd(cfg, look); (cfg.tracks || []).forEach(T => (T.items || []).forEach(it => { d = Math.max(d, (+it.start || 0) + lenOf(it, look)); })); return Math.max(0.5, d); }
  function defaults() {
    const clip = k => { const Mo = raw(k); return Mo ? { id: nid('i'), kind: 'clip', mod: k, name: '', cfg: Mo.defaults(), inPt: 0, hold: 0 } : null; };
    return { v: 2, gap: 'black', bg: 'black', items: [clip('broll'), { id: nid('i'), kind: 'avatar', text: 'Aye, ye heard that right. Wait till ye see the next bit.', dur: fitWords('Aye, ye heard that right. Wait till ye see the next bit.') }, clip('charts')].filter(Boolean), tracks: [], markers: [], bin: [] };
  }
  // Every clip on any track, with where it plays on the whole timeline
  function allPlaced(cfg, look) {
    const out = layout(cfg, look).map(o => ({ it: o.it, t0: o.t0, d: o.d, track: 'main', o }));
    (cfg.tracks || []).forEach(T => (T.items || []).forEach(it => out.push({ it, t0: +it.start || 0, d: lenOf(it, look), track: T.id, T })));
    return out;
  }
  function findItem(cfg, id) { id = String(id || '').replace(/^C:/, ''); const i = (cfg.items || []).findIndex(x => x.id === id); if (i >= 0) return { it: cfg.items[i], list: cfg.items, i, track: 'main' };
    for (const T of cfg.tracks || []) { const j = (T.items || []).findIndex(x => x.id === id); if (j >= 0) return { it: T.items[j], list: T.items, i: j, track: T.id, T }; } return null; }

  /* ---------- Keyframes, animations ---------- */
  // it.kf = { prop: [[t, value, ease], ...] } with t in seconds from the clip's start
  const EASES = { lin: x => x, io: x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2, in: x => x * x, out: x => 1 - (1 - x) * (1 - x), hold: x => 0 };
  function kfAt(it, prop, local, base) { const L = it.kf && it.kf[prop]; if (!L || !L.length) return base; if (local <= L[0][0]) return L[0][1]; const z = L[L.length - 1]; if (local >= z[0]) return z[1];
    for (let i = 1; i < L.length; i++) if (local <= L[i][0]) { const a = L[i - 1], b = L[i], q = (local - a[0]) / Math.max(1e-6, b[0] - a[0]), e = EASES[b[2] || 'io'] || EASES.io; return a[1] + (b[1] - a[1]) * e(q); } return base; }
  const ANIM_IN = { none: 'None', fade: 'Fade in', zoomIn: 'Zoom in', zoomOut: 'Zoom out', pop: 'Pop', slideL: 'Slide from left', slideR: 'Slide from right', slideU: 'Slide up', slideD: 'Slide down', spin: 'Spin in', blur: 'Blur in', drop: 'Drop and bounce', swing: 'Swing in' };
  const ANIM_OUT = { none: 'None', fade: 'Fade out', zoomIn: 'Zoom in', zoomOut: 'Zoom out', pop: 'Shrink', slideL: 'Slide to left', slideR: 'Slide to right', slideU: 'Slide up', slideD: 'Slide down', spin: 'Spin out', blur: 'Blur out' };
  const ANIM_LOOP = { none: 'None', pulse: 'Pulse', wobble: 'Wobble', float: 'Float', swing: 'Swing', heartbeat: 'Heartbeat', shake: 'Shake', kenburns: 'Slow zoom' };
  const easeOut = x => 1 - Math.pow(1 - cl(x, 0, 1), 3), back = x => { x = cl(x, 0, 1); const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  function bounceOut(x) { const n = 7.5625, d = 2.75; x = cl(x, 0, 1); if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; }
  // Changes to position, size, turn, opacity and blur from the clip's animations at this moment
  function animOf(it, local, len, W, H) {
    const A = { dx: 0, dy: 0, s: 1, rot: 0, op: 1, blur: 0 };
    const ai = it.anIn, ao = it.anOut, alp = it.anLoop;
    if (ai && ai.k && ai.k !== 'none') { const d = cl(+ai.d || 0.5, 0.05, len), p = local / d; if (p < 1) { const e = easeOut(p), q = 1 - e;
      switch (ai.k) { case 'fade': A.op *= e; break; case 'zoomIn': A.s *= 0.5 + 0.5 * e; A.op *= cl(p * 3, 0, 1); break; case 'zoomOut': A.s *= 1 + 0.6 * q; A.op *= cl(p * 3, 0, 1); break; case 'pop': A.s *= back(p) || 0.001; break;
        case 'slideL': A.dx -= q * W; break; case 'slideR': A.dx += q * W; break; case 'slideU': A.dy += q * H; break; case 'slideD': A.dy -= q * H; break; case 'spin': A.rot -= q * 360; A.s *= 0.3 + 0.7 * e; break;
        case 'blur': A.blur += q * 30; A.op *= cl(p * 2, 0, 1); break; case 'drop': A.dy -= (1 - bounceOut(p)) * H * 0.8; break; case 'swing': A.rot += Math.sin(p * Math.PI * 3) * (1 - p) * 25; A.op *= cl(p * 4, 0, 1); break; } } }
    if (ao && ao.k && ao.k !== 'none') { const d = cl(+ao.d || 0.5, 0.05, len), p = (len - local) / d; if (p < 1) { const e = easeOut(p), q = 1 - e;
      switch (ao.k) { case 'fade': A.op *= e; break; case 'zoomIn': A.s *= 1 + 0.6 * q; A.op *= cl(p * 3, 0, 1); break; case 'zoomOut': A.s *= 0.5 + 0.5 * e; A.op *= cl(p * 3, 0, 1); break; case 'pop': A.s *= Math.max(0.001, e); break;
        case 'slideL': A.dx -= q * W; break; case 'slideR': A.dx += q * W; break; case 'slideU': A.dy -= q * H; break; case 'slideD': A.dy += q * H; break; case 'spin': A.rot += q * 360; A.s *= 0.3 + 0.7 * e; break; case 'blur': A.blur += q * 30; A.op *= cl(p * 2, 0, 1); break; } } }
    if (alp && alp.k && alp.k !== 'none') { const sp = cl(+alp.speed || 1, 0.1, 5), w = local * sp * Math.PI * 2;
      switch (alp.k) { case 'pulse': A.s *= 1 + 0.04 * Math.sin(w); break; case 'wobble': A.rot += 3 * Math.sin(w * 1.3); break; case 'float': A.dy += Math.sin(w * 0.6) * H * 0.012; break; case 'swing': A.dx += Math.sin(w * 0.5) * W * 0.02; break;
        case 'heartbeat': { const ph = (local * sp) % 1; A.s *= 1 + 0.06 * Math.exp(-ph * 9) + 0.04 * Math.exp(-Math.max(0, ph - 0.2) * 9) * (ph > 0.2 ? 1 : 0); break; }
        case 'shake': A.dx += (Math.sin(w * 7.1) + Math.sin(w * 11.3)) * W * 0.004; A.dy += (Math.sin(w * 8.7) + Math.sin(w * 13.1)) * H * 0.004; break; case 'kenburns': A.s *= 1 + 0.08 * cl(local / Math.max(0.1, len), 0, 1); break; } }
    return A;
  }

  /* ---------- Drawing ---------- */
  const mk = (w, h) => { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Scratch canvases, kept between frames and reused by name
  const scr = {}; function scratch(name, w, h) { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); let c = scr[name]; if (!c || c.width !== w || c.height !== h) c = scr[name] = mk(w, h); const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.clearRect(0, 0, w, h); return c; }
  // The picture a clip shows at a moment (and its size, and how far round it must be turned)
  function source(it, local, look, W, H, env, slot) {
    if (it.kind === 'colour') return { colour: typeof it.fill === 'string' ? it.fill : typeof it.col === 'string' ? it.col : '#000000', w: W, h: H };   // fill (older cards kept it in col)
    if (it.kind === 'media') {
      const m = M(it.asset); if (!m) return { missing: it.file || it.name || 'footage', w: W, h: H };
      if (m.kind === 'image') { const b = (env && env.images && env.images.get(it.asset)) || CutMedia.image(it.asset); return b ? { img: b, w: b.width, h: b.height, rot: 0 } : { pending: true, w: m.w || W, h: m.h || H }; }
      const s = srcTime(it, local);
      if (env && env.frames) { const f = env.frames.get(it.id); if (f && f.img) { const rot = f.rot || 0, fw = f.img.displayWidth || f.img.videoWidth || f.img.width, fh = f.img.displayHeight || f.img.videoHeight || f.img.height; return { img: f.img, w: rot % 180 ? fh : fw, h: rot % 180 ? fw : fh, rot, iw: fw, ih: fh }; } return { pending: true, w: m.w || W, h: m.h || H }; }
      const el = CutMedia.live(it.asset, it.id + (slot || ''), s, !!(!look.paused && !it.rev && it.still == null), speedOf(it)); return el ? { img: el, w: el.videoWidth || m.w, h: el.videoHeight || m.h, rot: 0 } : { pending: true, w: m.w || W, h: m.h || H };
    }
    if (it.kind === 'clip') {
      const Mo = modOf(it.mod); if (!Mo) return { missing: 'Unknown clip', w: W, h: H };
      const k = env && env.k || 1, c = scratch('clip' + (slot || '') + it.id.slice(-3), W * k, H * k), g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
      const tt = clipInner(it, local, look), L = lookFor(it, look);
      g.save(); try { if (env && env.blur && Mo.blurHint && !look.preview) E.renderInto(g, Mo, it.cfg, L, W, H, tt, env.blurN ? env.blurN(Mo, it.cfg, L, tt) : 1, env.fps || 30, scratch('blurs', W, H)); else Mo.draw(g, tt, it.cfg, L, W, H); } catch (e) { console.warn(e); } g.restore();
      return { img: c, w: c.width, h: c.height, rot: 0, full: true };
    }
    return null;
  }
  // Where in its file a footage clip is at this moment
  function srcTime(it, local) { if (it.still != null) return +it.still; const [a, b] = srcSpan(it), s = speedOf(it); return it.rev ? Math.max(a, b - local * s - 1e-3) : Math.min(b - 1e-3, a + local * s); }
  // Box the clip fills before its own moves: fitted inside the frame, filling it, or stretched
  function baseBox(it, sw, sh, W, H) { const fit = it.fit || (it.kind === 'clip' || it.kind === 'colour' ? 'stretch' : 'fit'); if (fit === 'stretch') return [W, H]; const k = fit === 'fill' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh); return [sw * k, sh * k]; }
  // Transform of a clip at a moment: position (centre, as fractions), scale, turn, opacity, flips, plus animations
  function placeOf(it, local, len, W, H) {
    const A = animOf(it, local, len, W, H);
    return { x: kfAt(it, 'x', local, it.x == null ? 0.5 : +it.x) * W + A.dx, y: kfAt(it, 'y', local, it.y == null ? 0.5 : +it.y) * H + A.dy, s: Math.max(0.001, kfAt(it, 's', local, it.s == null ? 1 : +it.s) * A.s),
      rot: kfAt(it, 'rot', local, +it.rot || 0) + A.rot, op: cl(kfAt(it, 'op', local, it.op == null ? 1 : +it.op) * A.op, 0, 1), blur: A.blur };
  }
  // Draws one clip into g (in frame units W x H). Returns the box it covers (for selecting it on the preview).
  function drawItem(g, it, local, len, look, W, H, env, slot) {
    if (it.kind === 'adjust') return adjust(g, it, local, len, look, W, H, env);
    const src = source(it, local, look, W, H, env, slot); if (!src) return null;
    const P = typeof CutGL !== 'undefined' ? CutGL.params(it, (env && env.t != null ? env.t : local)) : null, pl = placeOf(it, local, len, W, H);
    const crop = it.crop || [0, 0, 0, 0], cw = src.w * (1 - crop[0] - crop[2]), ch = src.h * (1 - crop[1] - crop[3]);
    const [bw, bh] = baseBox(it, Math.max(1, cw), Math.max(1, ch), W, H), dw = bw * pl.s, dh = bh * pl.s;
    if (pl.op <= 0.001) return [pl.x - dw / 2, pl.y - dh / 2, pl.x + dw / 2, pl.y + dh / 2];
    // Effects that move the picture
    let shake = [0, 0], zoom = 1; (it.fx || []).forEach(f => { if (f.off) return; const a = cl(f.amt == null ? 60 : +f.amt, 0, 100) / 100, tt = env && env.t != null ? env.t : local;
      if (f.k === 'shake') { shake = [(Math.sin(tt * 37) + Math.sin(tt * 23.3)) * W * 0.008 * a, (Math.sin(tt * 31) + Math.sin(tt * 19.7)) * H * 0.008 * a]; } if (f.k === 'pulse') zoom *= 1 + 0.06 * a * Math.max(0, Math.sin(tt * Math.PI * 2)); });
    const k = env && env.k || 1;
    g.save();
    g.globalAlpha *= pl.op; if (it.blend && it.blend !== 'normal') g.globalCompositeOperation = it.blend;
    const blurPx = (P && P.blur ? P.blur * 24 : 0) + (pl.blur || 0);
    g.translate(pl.x + shake[0], pl.y + shake[1]); if (pl.rot) g.rotate(pl.rot * Math.PI / 180); g.scale((it.flipH ? -1 : 1) * zoom, (it.flipV ? -1 : 1) * zoom);
    const masked = it.mask && it.mask.k && it.mask.k !== 'none';
    const target = masked ? scratch('mask' + (slot || ''), Math.min(W * 1.5, dw * k) + 2, Math.min(H * 1.5, dh * k) + 2) : null;
    const draw = (gg, x, y, w, h) => {
      if (src.colour) { gg.fillStyle = src.colour; gg.fillRect(x, y, w, h); return; }
      if (src.missing || src.pending) { if (look.preview) { gg.fillStyle = src.missing ? 'rgba(120,30,40,0.85)' : 'rgba(20,24,32,0.9)'; gg.fillRect(x, y, w, h); if (src.missing) { gg.fillStyle = '#fff'; gg.font = `600 ${Math.max(10, Math.round(h * 0.06))}px Archivo, sans-serif`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('Missing: ' + src.missing, x + w / 2, y + h / 2); } } return; }
      let img = src.img, iw = src.iw || src.w, ih = src.ih || src.h;
      // Grade and effects on the graphics chip, at no more than the size it will be shown
      if (P && CutGL.needs(P)) { const sk = Math.min(1, Math.max(Math.abs(w), Math.abs(h)) * k / Math.max(iw, ih)), ow = Math.max(2, Math.round(iw * Math.max(sk, 0.25))), oh = Math.max(2, Math.round(ih * Math.max(sk, 0.25)));
        const out = CutGL.process(img, iw, ih, ow, oh, P), tmp = scratch('graded' + (slot || ''), ow, oh); tmp.getContext('2d').drawImage(out, 0, 0); img = tmp; iw = ow; ih = oh; }
      if (blurPx > 0.3) gg.filter = `blur(${(blurPx * k).toFixed(1)}px)`;
      const rot = src.rot || 0;
      // Crop is in the shown picture's terms; for a turned picture it maps back onto the stored one
      let cx = crop[0], cy = crop[1], cr = crop[2], cb = crop[3]; if (rot === 90) [cx, cy, cr, cb] = [cy, cr, cb, cx]; else if (rot === 180) [cx, cy, cr, cb] = [cr, cb, cx, cy]; else if (rot === 270) [cx, cy, cr, cb] = [cb, cx, cy, cr];
      const sx = iw * cx, sy = ih * cy, sw2 = Math.max(1, iw * (1 - cx - cr)), sh2 = Math.max(1, ih * (1 - cy - cb));
      if (rot) { gg.save(); gg.translate(x + w / 2, y + h / 2); gg.rotate(rot * Math.PI / 180); const rw = rot % 180 ? h : w, rh = rot % 180 ? w : h; gg.drawImage(img, sx, sy, sw2, sh2, -rw / 2, -rh / 2, rw, rh); gg.restore(); }
      else gg.drawImage(img, sx, sy, sw2, sh2, x, y, w, h);
      gg.filter = 'none';
    };
    if (masked) { const tg = target.getContext('2d'), tw = target.width, th = target.height; tg.setTransform(tw / dw, 0, 0, th / dh, tw / 2, th / 2); draw(tg, -dw / 2, -dh / 2, dw, dh); applyMask(tg, it.mask, dw, dh, tw, th); g.drawImage(target, -dw / 2, -dh / 2, dw, dh); }
    else draw(g, -dw / 2, -dh / 2, dw, dh);
    g.restore();
    return [pl.x - dw / 2, pl.y - dh / 2, pl.x + dw / 2, pl.y + dh / 2];
  }
  // Masks: a shape, soft edged, cut out of the clip (or the clip cut out of it, when inverted)
  const MASKS = { none: 'None', rect: 'Rectangle', circle: 'Circle', line: 'Split line', band: 'Band', heart: 'Heart', star: 'Star' };
  function applyMask(tg, mk2, dw, dh, tw, th) {
    const m = scratch('maskShape', tw, th), mg = m.getContext('2d'), fx = tw / dw, fy = th / dh;
    const cx = tw / 2 + (+mk2.x || 0) * tw, cy = th / 2 + (+mk2.y || 0) * th, w = (mk2.w == null ? 0.6 : +mk2.w) * tw, h = (mk2.h == null ? 0.6 : +mk2.h) * th, feather = cl(+mk2.feather || 0, 0, 100) / 100 * Math.min(tw, th) * 0.15;
    mg.save(); if (feather > 0.5) mg.filter = `blur(${feather.toFixed(1)}px)`; mg.fillStyle = '#fff'; mg.translate(cx, cy); mg.rotate((+mk2.rot || 0) * Math.PI / 180); mg.beginPath();
    switch (mk2.k) {
      case 'circle': mg.ellipse(0, 0, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2); break;
      case 'line': mg.rect(-tw * 2, 0, tw * 4, th * 4); break;
      case 'band': mg.rect(-tw * 2, -Math.abs(h) / 2, tw * 4, Math.abs(h)); break;
      case 'heart': { const s = Math.min(Math.abs(w), Math.abs(h)) / 2; mg.moveTo(0, s * 0.9); mg.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.6, -s * 1.2, 0, -s * 0.45); mg.bezierCurveTo(s * 0.6, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.9); break; }
      case 'star': { const R = Math.min(Math.abs(w), Math.abs(h)) / 2; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.42 : R; mg.lineTo(Math.cos(a) * r, Math.sin(a) * r); } mg.closePath(); break; }
      default: { const rr = cl(+mk2.round || 0, 0, 100) / 100 * Math.min(Math.abs(w), Math.abs(h)) / 2; if (mg.roundRect) mg.roundRect(-Math.abs(w) / 2, -Math.abs(h) / 2, Math.abs(w), Math.abs(h), rr); else mg.rect(-Math.abs(w) / 2, -Math.abs(h) / 2, Math.abs(w), Math.abs(h)); }
    }
    mg.fill(); mg.restore();
    tg.save(); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = mk2.inv ? 'destination-out' : 'destination-in'; tg.drawImage(m, 0, 0); tg.restore();
  }
  // An adjustment clip grades and treats everything drawn under it
  function adjust(g, it, local, len, look, W, H, env) {
    if (typeof CutGL === 'undefined') return null; const P = CutGL.params(it, env && env.t != null ? env.t : local), A = animOf(it, local, len, W, H), op = cl((it.op == null ? 1 : +it.op) * A.op * kfAt(it, 'op', local, 1), 0, 1);
    if (!CutGL.needs(P) && !P.blur || op <= 0.001) return [0, 0, W, H];
    const m = g.getTransform(), cv = g.canvas, x = Math.round(m.e), y = Math.round(m.f), w = Math.round(W * m.a), h = Math.round(H * m.d);
    if (w < 2 || h < 2) return [0, 0, W, H];
    const grab = scratch('adjGrab', w, h); grab.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h);
    const out = CutGL.needs(P) ? CutGL.process(grab, w, h, w, h, P) : grab;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = op; if (P.blur) g.filter = `blur(${(P.blur * 24 * m.a).toFixed(1)}px)`; g.drawImage(out, x, y, w, h); g.restore();
    return [0, 0, W, H];
  }
  // Canvas behind a main track clip that doesn't fill the frame: black, a colour, or the clip itself blurred
  function drawBackground(g, it, local, len, look, W, H, env, slot) {
    const bg = it.bg || look.cutBg || 'black';
    if (look.transparent) return;
    if (bg === 'blur' && (it.kind === 'media')) { const src = source(it, local, look, W, H, env, slot); if (src && src.img) { const k = env && env.k || 1, sw = src.w, sh = src.h, s = Math.max(W / sw, H / sh) * 1.08, small = scratch('bgblur', Math.max(8, W * k / 4), Math.max(8, H * k / 4)), sg = small.getContext('2d');
        sg.filter = 'blur(6px)'; const rot = src.rot || 0; sg.save(); sg.translate(small.width / 2, small.height / 2); sg.scale(small.width / W, small.height / H); if (rot) sg.rotate(rot * Math.PI / 180); const rw = rot % 180 ? sh * s : sw * s, rh = rot % 180 ? sw * s : sh * s; sg.drawImage(src.img, -rw / 2, -rh / 2, rw, rh); sg.restore(); sg.filter = 'none';
        g.drawImage(small, 0, 0, W, H); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H); return; } }
    g.fillStyle = bg === 'black' || bg === 'blur' ? '#000000' : bg === 'white' ? '#ffffff' : /^#/.test(bg) ? bg : '#000000'; g.fillRect(0, 0, W, H);
  }

  /* ---------- Transitions ---------- */
  const TRANS = { none: 'None', fade: 'Cross dissolve', black: 'Dip to black', white: 'Dip to white', wipeL: 'Wipe left', wipeR: 'Wipe right', wipeU: 'Wipe up', wipeD: 'Wipe down',
    slideL: 'Slide left', slideR: 'Slide right', pushL: 'Push left', pushR: 'Push right', pushU: 'Push up', pushD: 'Push down', zoomIn: 'Zoom in', zoomOut: 'Zoom out', spin: 'Spin', circle: 'Circle open', clock: 'Clock wipe',
    blur: 'Blur', whip: 'Whip pan', glitch: 'Glitch', flash: 'Flash', split: 'Split open', squeeze: 'Squeeze', dissolve: 'Pixel dissolve' };
  function transition(g, A, B, kind, p, W, H) {
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, img = (c, a = 1) => { g.globalAlpha = a; g.drawImage(c, 0, 0, W, H); g.globalAlpha = 1; };
    g.save();
    switch (kind) {
      case 'black': case 'white': { if (p < 0.5) img(A); else img(B); g.fillStyle = kind === 'black' ? '#000' : '#fff'; g.globalAlpha = 1 - Math.abs(p - 0.5) * 2; g.fillRect(0, 0, W, H); break; }
      case 'flash': { img(p < 0.5 ? A : B); g.fillStyle = '#fff'; g.globalAlpha = Math.pow(1 - Math.abs(p - 0.5) * 2, 2); g.fillRect(0, 0, W, H); break; }
      case 'wipeL': case 'wipeR': case 'wipeU': case 'wipeD': { img(A); g.beginPath(); if (kind === 'wipeL') g.rect(W * (1 - e), 0, W * e + 1, H); else if (kind === 'wipeR') g.rect(0, 0, W * e, H); else if (kind === 'wipeU') g.rect(0, H * (1 - e), W, H * e + 1); else g.rect(0, 0, W, H * e); g.clip(); img(B); break; }
      case 'slideL': case 'slideR': { img(A); const dx = (kind === 'slideL' ? 1 : -1) * W * (1 - e); g.drawImage(B, dx, 0, W, H); break; }
      case 'pushL': case 'pushR': case 'pushU': case 'pushD': { const s = kind === 'pushL' || kind === 'pushU' ? -1 : 1, hz = kind === 'pushL' || kind === 'pushR'; const o = e * (hz ? W : H) * s;
        if (hz) { g.drawImage(A, o, 0, W, H); g.drawImage(B, o - s * W, 0, W, H); } else { g.drawImage(A, 0, o, W, H); g.drawImage(B, 0, o - s * H, W, H); } break; }
      case 'zoomIn': { const s = 1 + e * 0.6; g.save(); g.translate(W / 2, H / 2); g.scale(s, s); g.globalAlpha = 1 - e; g.drawImage(A, -W / 2, -H / 2, W, H); g.restore(); const s2 = 0.7 + 0.3 * e; g.save(); g.translate(W / 2, H / 2); g.scale(s2, s2); g.globalAlpha = e; g.drawImage(B, -W / 2, -H / 2, W, H); g.restore(); break; }
      case 'zoomOut': { const s = 1 - e * 0.35; img(B, 1); g.save(); g.translate(W / 2, H / 2); g.scale(s, s); g.globalAlpha = 1 - e; g.drawImage(A, -W / 2, -H / 2, W, H); g.restore(); break; }
      case 'spin': { const r = e * Math.PI * 2, s = 1 - Math.sin(e * Math.PI) * 0.4; g.translate(W / 2, H / 2); g.rotate(r); g.scale(s, s); g.globalAlpha = 1; g.drawImage(p < 0.5 ? A : B, -W / 2, -H / 2, W, H); break; }
      case 'circle': { img(A); g.beginPath(); g.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, Math.PI * 2); g.clip(); img(B); break; }
      case 'clock': { img(A); g.beginPath(); g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, Math.hypot(W, H), -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); g.closePath(); g.clip(); img(B); break; }
      case 'split': { img(B); const o = e * W / 2; g.save(); g.beginPath(); g.rect(0, 0, W / 2, H); g.clip(); g.drawImage(A, -o, 0, W, H); g.restore(); g.beginPath(); g.rect(W / 2, 0, W / 2, H); g.clip(); g.drawImage(A, o, 0, W, H); break; }
      case 'squeeze': { if (p < 0.5) { const s = 1 - e * 2; g.drawImage(A, W * (1 - Math.max(0.001, s)) / 2, 0, W * Math.max(0.001, s), H); } else { const s = (e - 0.5) * 2; g.drawImage(B, W * (1 - Math.max(0.001, s)) / 2, 0, W * Math.max(0.001, s), H); } break; }
      case 'blur': { const b = Math.sin(p * Math.PI) * 28; g.filter = `blur(${b.toFixed(1)}px)`; img(A, 1 - e); img(B, e); break; }
      case 'whip': { const b = Math.sin(p * Math.PI) * 40, o = e * W; g.filter = `blur(${b.toFixed(1)}px)`; g.drawImage(A, -o, 0, W, H); g.drawImage(B, W - o, 0, W, H); break; }
      case 'glitch': { img(p < 0.5 ? A : B); const n = 14, src = p < 0.5 ? B : A, amt = Math.sin(p * Math.PI); for (let i = 0; i < n; i++) { const r = Math.sin(i * 91.7 + Math.floor(p * 20) * 13.1) * 0.5 + 0.5; if (r > amt) continue; const y = i / n * H, h = H / n, dx = (r - 0.5) * W * 0.25 * amt; g.drawImage(src, 0, y / H * src.height, src.width, h / H * src.height, dx, y, W, h); } break; }
      case 'dissolve': { img(A); const n = 24, cw = W / n, ch = H / Math.round(n * H / W) || H / n, rows = Math.ceil(H / ch); g.beginPath(); for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) { const r = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1; if (Math.abs(r) < e) g.rect(i * cw, j * ch, cw + 0.5, ch + 0.5); } g.clip(); img(B); break; }
      default: img(A); img(B, e);
    }
    g.restore();
  }

  /* ---------- The frame ---------- */
  const studioOn = cfg => cfg.gap === 'studio' && cfg.studio && typeof Studio !== 'undefined';
  function avStart(cfg, o, look) { let s = 0; for (const x of layout(cfg, look)) { if (x === o || x.it === o.it) break; if (x.it.kind === 'avatar') s += x.d; } const A = cfg.studio && cfg.studio.avatar; return (A ? +A.inPt || 0 : 0) + (o.it.avIn != null && o.it.avIn !== '' ? +o.it.avIn : s); }
  function drawGap(ctx, o, t, cfg, look, W, H) {
    const g0 = cfg.gap || 'black';
    if (studioOn(cfg)) { ctx.save(); try { Studio.drawAt(ctx, t, avStart(cfg, o, look) + (t - o.t0), cfg.studio, look, W, H); } finally { ctx.restore(); } return; }
    if (look.transparent || g0 === 'clear') ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = g0 === 'green' ? '#00b140' : '#000000'; ctx.fillRect(0, 0, W, H); }
    if (!look.preview) return;
    label(ctx, W, H, 'AVATAR', o.it.text || '', Math.max(0, o.d - (t - o.t0)));
  }
  function label(ctx, W, H, big, small, left) {
    const u = Math.min(W, H) / 1080; ctx.save(); ctx.fillStyle = 'rgba(160,58,106,0.18)'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([18 * u, 14 * u]); ctx.lineWidth = 4 * u; ctx.strokeRect(30 * u, 30 * u, W - 60 * u, H - 60 * u); ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; ctx.font = `800 ${Math.round(110 * u)}px Anton, Impact, sans-serif`; ctx.fillText(big, W / 2, H * 0.4);
    if (small) { ctx.font = `500 ${Math.round(46 * u)}px Lora, Georgia, serif`; const words = String(small).split(/\s+/), lines = []; let cur = ''; words.forEach(w => { const tr = cur ? cur + ' ' + w : w; if (ctx.measureText(tr).width > W * 0.8 && cur) { lines.push(cur); cur = w; } else cur = tr; }); if (cur) lines.push(cur); lines.slice(0, 5).forEach((ln, i) => ctx.fillText(ln, W / 2, H * 0.55 + i * 58 * u)); }
    if (left != null) { ctx.font = `600 ${Math.round(34 * u)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(left.toFixed(1) + ' s left, not in the export', W / 2, H * 0.86); }
    ctx.restore();
  }
  // One main track clip, whole frame: background, the clip, (its gap card for avatars)
  function drawMain(g, o, t, cfg, look, W, H, env, slot) {
    const it = o.it, local = t - o.t0;
    if (it.kind === 'avatar') return drawGap(g, o, t, cfg, look, W, H);
    if (cfg.mainHide) { if (!look.transparent) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); } return; }
    const full = it.kind === 'clip' && !it.fit && (it.s == null || +it.s === 1) && !it.x && !it.y && !it.rot && !it.anIn && !it.anOut && !it.anLoop && !it.kf && !it.mask && !(it.crop && it.crop.some(Boolean));
    if (full && !it.col && !(it.fx && it.fx.length) && !it.key && (it.op == null || +it.op >= 1) && (!it.blend || it.blend === 'normal')) {
      const Mo = modOf(it.mod); if (Mo) { const L2 = lookFor(it, look), tt = clipInner(it, local, look); g.save(); try { if (env.blur && !look.preview && env.blurN) E.renderInto(g, Mo, it.cfg, L2, W, H, tt, env.blurN(Mo, it.cfg, L2, tt), env.fps || 30, scratch('blurs', W, H)); else Mo.draw(g, tt, it.cfg, L2, W, H); } catch (e) { console.warn(e); } g.restore(); if (env.boxes) env.boxes.push({ id: it.id, box: [0, 0, W, H] }); return; }
    }
    if (!full) drawBackground(g, it, local, o.d, Object.assign({}, look, { cutBg: cfg.bg }), W, H, env, slot);
    const box = drawItem(g, it, local, o.d, look, W, H, env, slot); if (env && env.boxes && box) env.boxes.push({ id: it.id, box });
  }
  function draw(ctx, t, cfg, look, W, H) {
    const env = Object.assign({ t, boxes: null }, look.cutEnv || {}); if (!env.k) { const m = ctx.getTransform(); env.k = cl(Math.hypot(m.a, m.b) || 1, 0.1, 2); }
    const L = layout(cfg, look);
    if (!L.length && !(cfg.tracks || []).some(T => (T.items || []).length)) { ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, W, H); if (look.preview) label(ctx, W, H, 'YOUR VIDEO', 'Drop footage, music and pictures here, or add clips from the panel on the left', null); return; }
    // Main track: one clip, or two while a transition plays
    let A = null, B = null; for (const o of L) { if (t >= o.t0 - 1e-9 && t < o.t0 + o.d) { if (!A) A = o; else { B = o; break; } } }
    if (!A && L.length && t >= L[L.length - 1].t0) A = L[L.length - 1];
    if (A && B) {
      const k = env.k, ca = scratch('trA', W * k, H * k), cb = scratch('trB', W * k, H * k), ga = ca.getContext('2d'), gb = cb.getContext('2d'); ga.setTransform(k, 0, 0, k, 0, 0); gb.setTransform(k, 0, 0, k, 0, 0);
      drawMain(ga, A, t, cfg, look, W, H, env, 'a'); drawMain(gb, B, t, cfg, look, W, H, env, 'b');
      const p = cl((t - B.t0) / Math.max(1e-3, A.trOut), 0, 1); if (!look.transparent) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
      transition(ctx, ca, cb, (A.it.tr && A.it.tr.k) || 'fade', p, W, H);
    } else if (A) drawMain(ctx, A, t, cfg, look, W, H, env, '');
    else if (!look.transparent) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    // Overlay tracks, bottom to top
    (cfg.tracks || []).forEach(T => { if (!T || T.kind !== 'video' || T.hide) return; (T.items || []).forEach(it => { const s = +it.start || 0, d = lenOf(it, look); if (t < s - 1e-9 || t >= s + d) return; const box = drawItem(ctx, it, t - s, d, look, W, H, env, ''); if (env.boxes && box) env.boxes.push({ id: it.id, box }); }); });
    if (env.boxes) env.boxes.main = A ? A.it.id : null;
    if (look.preview && typeof CutMedia !== 'undefined' && !look.cutEnv) CutMedia.endFrame();
  }

  /* ---------- Export helpers ---------- */
  // Which footage clips are on screen at t, and the exact source moment of each (for the export to decode first)
  function framesAt(cfg, look, t) {
    const out = [], add = (it, local) => { if (it.kind !== 'media') return; const m = M(it.asset); if (!m || m.kind !== 'video') return; out.push({ id: it.id, asset: it.asset, src: srcTime(it, local) }); };
    for (const o of layout(cfg, look)) if (t >= o.t0 - 1e-9 && t < o.t0 + o.d && !cfg.mainHide) { add(o.it, t - o.t0); if (o.it.bg === 'blur' || (!o.it.bg && cfg.bg === 'blur')) { } }
    (cfg.tracks || []).forEach(T => { if (T.kind !== 'video' || T.hide) return; (T.items || []).forEach(it => { const s = +it.start || 0, d = lenOf(it, look); if (t >= s - 1e-9 && t < s + d) add(it, t - s); }); });
    return out;
  }
  // Pictures (still images) used anywhere, so the export can load them first
  function imagesUsed(cfg) { const ids = new Set(); const f = it => { if (it && it.kind === 'media') { const m = M(it.asset); if (m && m.kind === 'image') ids.add(it.asset); } }; (cfg.items || []).forEach(f); (cfg.tracks || []).forEach(T => (T.items || []).forEach(f)); return [...ids]; }
  function assetsUsed(cfg) { const ids = new Set(); const f = it => { if (it && it.asset) ids.add(it.asset); }; (cfg.items || []).forEach(f); (cfg.tracks || []).forEach(T => (T.items || []).forEach(f)); return [...ids]; }
  // Old B roll footage (Media) inside tab clips, and the studio avatar
  function mediaFor(cfg) { const ids = new Set(); if (studioOn(cfg)) (Studio.mediaFor(cfg.studio) || []).forEach(x => ids.add(x)); const f = it => { const Mo = it.kind === 'clip' && modOf(it.mod); if (Mo && Mo.mediaFor) (Mo.mediaFor(it.cfg) || []).forEach(x => ids.add(x)); }; (cfg.items || []).forEach(f); (cfg.tracks || []).forEach(T => (T.items || []).forEach(f)); return [...ids]; }
  function mediaAt(cfg, t, look) { const lk = look || { format: '16:9' }, out = []; for (const p of allPlaced(cfg, lk)) { if (t < p.t0 || t >= p.t0 + p.d) continue; const it = p.it, local = t - p.t0;
      if (it.kind === 'avatar' && studioOn(cfg) && p.o) out.push(...Studio.mediaAtAv(cfg.studio, t, avStart(cfg, p.o, lk) + local));
      if (it.kind === 'clip') { const Mo = modOf(it.mod); if (Mo && Mo.mediaAt) out.push(...(Mo.mediaAt(it.cfg, clipInner(it, local, lk)) || [])); } }
    return out; }
  function blurHint(cfg, look, t, fps, W, H) { const o = at(cfg, look, t); if (!o || o.it.kind !== 'clip' || (cfg.tracks || []).length) return null; const Mo = modOf(o.it.mod); if (!Mo || !Mo.blurHint) return null; return Mo.blurHint(o.it.cfg, lookFor(o.it, look), clipInner(o.it, t - o.t0, look), fps, W, H); }
  const needsMap = cfg => { const f = it => it && it.kind === 'clip' && (it.mod === 'map' || it.mod === 'flights' || it.mod === 'flyover' || (it.mod === 'studio' && Studio.needsMap(it.cfg))); return (cfg.items || []).some(f) || (cfg.tracks || []).some(T => (T.items || []).some(f)) || (studioOn(cfg) && Studio.needsMap(cfg.studio)); };
  // Anything only the new editor can draw (own footage, sound, overlay tracks, grading...): exported by the editor's own exporter
  const isCut = cfg => !!((cfg.tracks || []).some(T => (T.items || []).length) || (cfg.items || []).some(it => it.kind === 'media' || it.kind === 'colour' || it.tr || it.col || it.fx || it.key || it.mask || it.anIn || it.anOut || it.anLoop || it.kf || (it.speed && +it.speed !== 1) || it.x != null || it.s != null || it.crop || it.blend || it.vol != null) || (cfg.bg && cfg.bg !== 'black'));

  /* ---------- Editing API (used by the editor workspace and the preview) ---------- */
  const NAME = it => it.name || (it.kind === 'avatar' ? (it.text ? '🎙 ' + it.text : 'Avatar gap') : it.kind === 'media' ? ((M(it.asset) || {}).name || 'Footage') : it.kind === 'audio' ? ((M(it.asset) || {}).name || 'Sound') : it.kind === 'colour' ? 'Colour' : it.kind === 'adjust' ? 'Adjustment' : NAMES[it.mod] || it.mod || 'Clip');
  const editor = { formIsScene: true,
    tracks() { return []; },
    update() { },
    hits(cfg, look, t, W, Hh) {
      const out = [];
      allPlaced(cfg, look).forEach(p => { const it = p.it; if (!isVis(it) || it.kind === 'avatar' || it.kind === 'adjust' || t < p.t0 || t >= p.t0 + p.d) return; if (p.T && (p.T.hide || p.T.lock)) return; if (p.track === 'main' && (cfg.mainHide || cfg.mainLock)) return;
        const local = t - p.t0, pl = placeOf(it, local, p.d, W, Hh); let sw = W, sh = Hh; if (it.kind === 'media') { const m = M(it.asset); if (m) { sw = m.w || W; sh = m.h || Hh; } }
        const crop = it.crop || [0, 0, 0, 0], [bw, bh] = baseBox(it, Math.max(1, sw * (1 - crop[0] - crop[2])), Math.max(1, sh * (1 - crop[1] - crop[3])), W, Hh), dw = bw * pl.s, dh = bh * pl.s;
        out.push({ id: 'C:' + it.id, box: [pl.x - dw / 2, pl.y - dh / 2, pl.x + dw / 2, pl.y + dh / 2], scale: true, rot: true, label: NAME(it), ctr: [pl.x, pl.y] }); });
      return out;
    },
    grab(cfg, id, ctx) { const f = findItem(cfg, id); if (!f) return null; const it = f.it; return { x: it.x == null ? 0.5 : +it.x, y: it.y == null ? 0.5 : +it.y, s: it.s == null ? 1 : +it.s, rot: +it.rot || 0, W: ctx.W, H: ctx.H, t: ctx.t }; },
    move(cfg, id, snap, dx, dy, mods) { const f = findItem(cfg, id); if (!f || !snap) return; const it = f.it; let x = snap.x + dx / snap.W, y = snap.y + dy / snap.H; const guides = [];
      if (mods && mods.snap !== false) { if (Math.abs(x - 0.5) < 0.012) { x = 0.5; guides.push(['x', snap.W / 2]); } if (Math.abs(y - 0.5) < 0.012) { y = 0.5; guides.push(['y', snap.H / 2]); } }
      setProp(it, 'x', r3(x), snap); setProp(it, 'y', r3(y), snap); return { guides }; },
    resize(cfg, id, snap, f) { const g = findItem(cfg, id); if (!g || !snap) return; setProp(g.it, 's', r3(cl(snap.s * f, 0.02, 20)), snap); },
    rotate(cfg, id, snap, deg, mods) { const g = findItem(cfg, id); if (!g || !snap) return; let r = snap.rot + deg; if (mods && mods.shift) r = Math.round(r / 15) * 15; setProp(g.it, 'rot', r2(r), snap); },
    remove(cfg, id) { const f = findItem(cfg, id); if (!f) return; f.list.splice(f.i, 1); if (f.track !== 'main') pruneTracks(cfg); },
    duplicate(cfg, id) { const f = findItem(cfg, id); if (!f) return null; const c = JSON.parse(JSON.stringify(f.it)); c.id = nid('i'); if (f.track === 'main') f.list.splice(f.i + 1, 0, c); else { const look = hooks.look ? hooks.look() : { format: '16:9' }; c.start = r2((+f.it.start || 0) + lenOf(f.it, look)); placeFree(cfg, f.T.kind, c, f.T); } return 'C:' + c.id; },
    inspect(root, cfg, id, changed, done) { if (hooks.inspect) hooks.inspect(root, cfg, id, changed, done); },
    scene(root, cfg, changed) { if (hooks.scene) hooks.scene(root, cfg, changed); else root.append(card('Your video', H('p', { className: 'hint', textContent: 'Add footage, sound and clips from the panel on the left.' }))); },
    adds: [],
  };
  // While a clip has keyframes for a setting, changing it on the preview sets a keyframe at the playhead instead
  function setProp(it, k, v, snap) { if (it.kf && it.kf[k] && it.kf[k].length && hooks.time) { const look = hooks.look ? hooks.look() : { format: '16:9' }; const cfg = hooks.cfg && hooks.cfg(); const p = cfg && allPlaced(cfg, look).find(q => q.it === it); if (p) { setKey(it, k, hooks.time() - p.t0, v); return; } } it[k] = v; }
  function setKey(it, prop, local, v, ease) { it.kf = it.kf || {}; const L = it.kf[prop] = it.kf[prop] || []; local = r3(Math.max(0, local)); const i = L.findIndex(q => Math.abs(q[0] - local) < 0.02); if (i >= 0) L[i][1] = v; else { L.push([local, v, ease || 'io']); L.sort((a, b) => a[0] - b[0]); } }
  function pruneTracks(cfg) { cfg.tracks = (cfg.tracks || []).filter(T => (T.items || []).length || T.keep); }
  // Puts a clip on the first track of its kind with room at its start time, making a new track when none has room
  function placeFree(cfg, kind, it, prefer) {
    cfg.tracks = cfg.tracks || []; const look = hooks.look ? hooks.look() : { format: '16:9' }, s = +it.start || 0, e = s + lenOf(it, look);
    const free = T => !(T.items || []).some(x => x !== it && (+x.start || 0) < e - 1e-3 && (+x.start || 0) + lenOf(x, look) > s + 1e-3);
    let T = prefer && prefer.kind === kind && free(prefer) ? prefer : cfg.tracks.find(T2 => T2.kind === kind && free(T2) && !T2.lock);
    if (!T) { T = { id: nid('t'), kind, name: kind === 'audio' ? 'Audio ' + (tracksOf(cfg, 'audio').length + 1) : 'Overlay ' + (tracksOf(cfg, 'video').length + 1), items: [] }; if (kind === 'video') { const lastV = cfg.tracks.map(x => x.kind).lastIndexOf('video'); cfg.tracks.splice(lastV + 1, 0, T); } else cfg.tracks.push(T); }
    T.items.push(it); T.items.sort((a, b) => (+a.start || 0) - (+b.start || 0)); return T;
  }
  // Split a clip in two at the timeline moment t
  function split(cfg, id, t, look) {
    const f = findItem(cfg, id); if (!f) return null; const it = f.it, p = allPlaced(cfg, look).find(q => q.it === it); if (!p) return null; const local = t - p.t0; if (local < 0.05 || local > p.d - 0.05) return null;
    const b = JSON.parse(JSON.stringify(it)); b.id = nid('i');
    if (it.kind === 'media' || it.kind === 'audio') { const m = M(it.asset); if (m && m.kind !== 'image' && it.still == null) { const s = srcTime(it, local); if (it.rev) { b.src1 = r3(s); it.src0 = r3(s); } else { it.src1 = r3(s); b.src0 = r3(s); } } else { it.dur = r3(local); b.dur = r3(p.d - local); } }
    else if (it.kind === 'clip') { const [a, e] = clipSpan(it, look), inner = a + local * speedOf(it); if (inner < e - 0.1) { b.inPt = r3(inner); it.outPt = r3(inner); it.hold = 0; } else { const left = p.d - local; it.hold = r3(Math.max(0, (+it.hold || 0) - left)); b.inPt = r3(Math.max(a, e - 0.15)); b.outPt = r3(e); b.hold = r3(Math.max(0.05, left - 0.15 / speedOf(it))); } }
    else { it.dur = r3(local); b.dur = r3(p.d - local); }
    // Keyframes and the out animation go with the right half
    if (it.kf) { const ka = {}, kb = {}; Object.entries(it.kf).forEach(([k, L]) => { ka[k] = L.filter(q => q[0] <= local); kb[k] = L.filter(q => q[0] >= local).map(q => [r3(q[0] - local), q[1], q[2]]); if (!ka[k].length) ka[k] = [[0, kfAt(it, k, local, 0)]]; if (!kb[k].length) kb[k] = [[0, kfAt(it, k, local, 0)]]; }); it.kf = ka; b.kf = kb; }
    delete it.anOut; delete it.tr; delete b.anIn; if (it.fadeOut) { b.fadeOut = it.fadeOut; delete it.fadeOut; } delete b.fadeIn;
    if (f.track === 'main') f.list.splice(f.i + 1, 0, b); else { b.start = r3(p.t0 + local); f.list.splice(f.i + 1, 0, b); }
    return 'C:' + b.id;
  }

  return { id: 'video', name: 'Video', defaults, duration, draw, editor, mediaFor, mediaAt, blurHint, needsMap, hooks, layout, lenOf, NAMES, COLS, NAME, form: (root, cfg, changed) => editor.scene(root, cfg, changed),
    // for the editor workspace, audio and export
    natural, clipSpan, clipInner, speedOf, srcSpan, srcTime, allPlaced, findItem, tracksOf, placeFree, pruneTracks, split, setKey, kfAt, placeOf, animOf, framesAt, imagesUsed, assetsUsed, isCut, mainEnd, trLen, TRMAX, fitWords, lookFor, modOf, raw, nid, drawItem, transition,
    TRANS, ANIM_IN, ANIM_OUT, ANIM_LOOP, MASKS, EASES, studioOn, avStart };
})();

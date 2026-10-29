/* Studio: your room picture brought to life for the bits where you talk to camera. Rain runs down the window, the lamps
   glow and flicker, lights come and go in the flats outside, cars pass, plants sway and a storm can light the room up.
   Your avatar (a video from Character Animator or anything else) sits in the room, lit to match it. Picture frames on the
   wall can show photos, headlines or clips from the other tabs. Everything is a pure function of time and repeats exactly
   every loop, so a clip of any length loops seamlessly. */
const Studio = (() => {
  const { cl, lerp, rng } = E;
  const TAU = Math.PI * 2;
  const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
  const mk = (w, h) => { w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h)); if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hash = s => { let h = 2166136261; s = String(s || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const sm = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
  const fract = x => x - Math.floor(x);
  const r2 = v => Math.round(v * 100) / 100, r4 = v => Math.round(v * 10000) / 10000;
  const nid = p => p + Math.random().toString(36).slice(2, 8);
  // Smooth wobble that repeats exactly every loop: only whole numbers of cycles per loop
  const wob = (t, L, seed, ks) => { const r = rng(seed); let s = 0, n = 0; for (const k of ks) { const w = 1 / Math.sqrt(k); s += Math.sin(TAU * k * t / L + r() * TAU) * w; n += w; } return s / n; };
  const pmod = (x, m) => ((x % m) + m) % m;

  /* ---------- Settings ---------- */
  const WEATHER = [['dry', 'Dry night'], ['drizzle', 'Drizzle'], ['rain', 'Rain'], ['downpour', 'Downpour'], ['storm', 'Thunderstorm'], ['snow', 'Snow']];
  const WX = {
    dry: { distant: 0, beads: 0, runners: 0, light: 0, snow: 0, fog: 0 },
    drizzle: { distant: 0.35, beads: 0.55, runners: 0.25, light: 0, snow: 0, fog: 0.4 },
    rain: { distant: 0.75, beads: 1, runners: 0.7, light: 0, snow: 0, fog: 0.6 },
    downpour: { distant: 1.25, beads: 1.3, runners: 1.4, light: 0, snow: 0, fog: 0.85 },
    storm: { distant: 1.35, beads: 1.3, runners: 1.4, light: 1, snow: 0, fog: 0.85 },
    snow: { distant: 0, beads: 0.08, runners: 0, light: 0, snow: 1, fog: 0.5 },
  };
  const STINGS = [['thunder', 'Thunder and lightning'], ['lightning', 'Lightning flash'], ['flicker', 'Lights flicker'], ['lightsoff', 'Lights off'], ['blackout', 'Blackout']];
  /* His studio is built in: the picture and everything marked in it come with the app, so the tab opens already animated */
  const BUILTIN = 'studio-builtin', hasBuiltin = typeof STUDIO_ROOM !== 'undefined';
  const builtinMarks = () => JSON.parse(JSON.stringify(hasBuiltin ? STUDIO_MARKS : { glass: null, front: [], lamps: [], frames: [], plants: [], street: [], lit: [], road: [] }));
  let readyP = null;
  const ready = () => readyP || (readyP = hasBuiltin && typeof Layers !== 'undefined' ? Layers.setAsset(BUILTIN, STUDIO_ROOM).catch(() => null) : Promise.resolve());
  // Older settings with no room picture use the built-in studio
  const eff = cfg => (!cfg || cfg.room || !hasBuiltin) ? cfg : Object.assign({}, cfg, { room: { asset: BUILTIN, name: 'Your studio' }, marks: cfg.marks && cfg.marks.glass ? cfg.marks : builtinMarks() });
  function defaults() {
    return { room: hasBuiltin ? { asset: BUILTIN, name: 'Your studio' } : null, marks: builtinMarks(), weather: 'rain', rain: 0.9, lightning: 1, lamps: 1, flicker: 0.5, outside: true, sway: true, clouds: true, drift: 'gentle', loop: 30, len: 0,
      avatar: null, stings: [], shows: [], sound: { on: true, vol: 0.8, thunder: true, cars: true }, mark: false, pics: [] };
  }
  const loopOf = cfg => cl(+cfg.loop || 20, 4, 120);
  function duration(cfg) {
    const L = loopOf(cfg); if (+cfg.len > 0) return cl(+cfg.len, 1, 1800);
    const A = cfg.avatar, inf = A && typeof Media !== 'undefined' ? Media.info(A.id) : null;
    if (inf) return Math.max(1, inf.dur - (+A.inPt || 0));
    return L;
  }

  /* ---------- Where the room sits on screen. The picture always fills the frame; a vertical frame follows you (or the
     middle of the room), and an optional slow drift keeps the shot breathing. ---------- */
  const roomBmp = cfg => { cfg = eff(cfg); if (!cfg.room || typeof Layers === 'undefined') return null; const a = Layers.assets[cfg.room.asset]; if (!a && cfg.room.asset === BUILTIN) ready(); return a && a.bmp ? a.bmp : null; };
  function view(cfg, W, H, t) {
    const bmp = roomBmp(cfg), iw = bmp ? bmp.width : 1920, ih = bmp ? bmp.height : 1080, L = loopOf(cfg);
    const dr = cfg.mark ? 0 : cfg.drift === 'more' ? 1 : cfg.drift === 'off' ? 0 : 0.5;
    let s = Math.max(W / iw, H / ih) * (1 + 0.035 * dr);
    const s0 = s * (1 + 0.012 * dr), z = dr ? 1 + 0.012 * dr * (0.5 - 0.5 * Math.cos(TAU * t / L)) : 1; s *= z;
    const A = cfg.avatar, fx = H > W ? (A ? cl(+A.x, 0, 1) : cl(+cfg.focus || 0.5, 0, 1)) : 0.5, fy = 0.5;
    let ox = W / 2 - fx * iw * s, oy = H / 2 - fy * ih * s;
    if (dr) { ox += wob(t, L, 11, [1, 2]) * 9 * dr * s; oy += wob(t, L, 12, [1, 3]) * 5 * dr * s; }
    ox = cl(ox, W - iw * s, 0); oy = cl(oy, H - ih * s, 0);
    return { s, s0, ox, oy, iw, ih };
  }
  const P = (m, v) => [m[0] * v.iw, m[1] * v.ih];
  // The room picture resized once to the size it is shown at, so each frame only nudges it a little (big resizes are slow)
  const bigCache = new Map(), bmpIds = new WeakMap(); let bmpN = 0;
  function bigRoom(bmp, s) { const k = Math.min(1.6, Math.ceil(s * 20) / 20); if (!bmpIds.has(bmp)) bmpIds.set(bmp, ++bmpN); const key = bmpIds.get(bmp) + ':' + k; let B = bigCache.get(key); if (B) return B;
    const c = mk(bmp.width * k, bmp.height * k), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height); B = { c, k: c.width / bmp.width }; if (bigCache.size > 3) bigCache.delete(bigCache.keys().next().value); bigCache.set(key, B); return B; }
  // Draw part of the room (in picture pixels) from the resized copy
  const roomPart = (ctx, B, sx, sy, sw, sh, dx, dy, dw, dh) => ctx.drawImage(B.c, sx * B.k, sy * B.k, sw * B.k, sh * B.k, dx, dy, dw, dh);

  /* ---------- Little pictures drawn once: glows and water drops ---------- */
  const SPR = {};
  function glowSprite(col) { const k = 'g' + col; if (SPR[k]) return SPR[k]; const c = mk(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, col); gr.addColorStop(0.18, col.replace(/[\d.]+\)$/, m => String(+m.slice(0, -1) * 0.55) + ')')); gr.addColorStop(0.5, col.replace(/[\d.]+\)$/, m => String(+m.slice(0, -1) * 0.14) + ')')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (SPR[k] = c); }
  // A bead of water: mostly see-through, a dark rim underneath, a bright catch light on top and a soft caustic below
  function beadSprite() { if (SPR.bead) return SPR.bead; const c = mk(64, 64), g = c.getContext('2d');
    // Lit from the window below and behind: a faint dark edge along the top, a bright soft crescent at the bottom
    let gr = g.createRadialGradient(32, 36, 6, 32, 32, 30); gr.addColorStop(0, 'rgba(200,215,250,0.07)'); gr.addColorStop(0.8, 'rgba(150,170,215,0.05)'); gr.addColorStop(0.95, 'rgba(12,16,30,0.22)'); gr.addColorStop(1, 'rgba(12,16,30,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill();
    gr = g.createRadialGradient(32, 44, 2, 32, 44, 16); gr.addColorStop(0, 'rgba(215,228,255,0.32)'); gr.addColorStop(1, 'rgba(215,228,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(32, 44, 16, 0, TAU); g.fill();
    gr = g.createRadialGradient(25, 22, 0, 25, 22, 5); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(25, 22, 5, 0, TAU); g.fill();
    return (SPR.bead = c); }

  /* ---------- Per room: a soft copy of the view out of the window (what a drop of water bends) ---------- */
  const roomCache = new Map();
  function roomBits(cfg, v) {
    const bmp = roomBmp(cfg), G = cfg.marks && cfg.marks.glass; if (!bmp || !G) return null;
    const key = cfg.room.asset + JSON.stringify(G); let R = roomCache.get(key); if (R) return R;
    const pts = G.map(m => P(m, v)), x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
    const w = Math.max(8, x1 - x0), h = Math.max(8, y1 - y0), half = mk(w / 2, h / 2), hg = half.getContext('2d'); hg.imageSmoothingQuality = 'high'; hg.drawImage(bmp, x0, y0, w, h, 0, 0, half.width, half.height);
    // Misted: a blurred copy laid lightly over the view makes wet glass, and makes the drops (which stay sharp) stand out
    const tiny = mk(w * 0.09, h * 0.09); tiny.getContext('2d').drawImage(half, 0, 0, tiny.width, tiny.height); const mist = mk(w / 2, h / 2), mg = mist.getContext('2d'); mg.imageSmoothingQuality = 'high'; mg.drawImage(tiny, 0, 0, mist.width, mist.height);
    R = { x0, y0, w, h, soft: half, mist, k: half.width / w, sky: skyMask(bmp, x0, y0, w, h, pts) }; if (roomCache.size > 6) roomCache.clear(); roomCache.set(key, R); return R;
  }
  /* The open sky out of the window: for each column, from the top down until the buildings start. Clouds only drift there */
  function skyMask(bmp, x0, y0, w, h, G) {
    const W = Math.round(w), Hh = Math.round(h), c = mk(W, Hh), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, x0, y0, w, h, 0, 0, W, Hh); const d = g.getImageData(0, 0, W, Hh).data;
    const skyish = (x, y) => { const k = (y * W + x) * 4, r = d[k], gg = d[k + 1], b = d[k + 2], lum = r * 0.3 + gg * 0.59 + b * 0.11; return b >= r + 6 && lum > 40 && lum < 235; };
    const line = new Float32Array(W);
    // Start under the top edge of the glass (the blind hangs above it)
    const topAt = x => { const f = (x + x0 - G[0][0]) / Math.max(1, G[1][0] - G[0][0]); return Math.max(0, Math.round(lerp(G[0][1], G[1][1], cl(f, 0, 1)) - y0 + 6)); };
    for (let x = 0; x < W; x++) { let y = topAt(x); while (y < Hh && !skyish(x, y)) y++; let miss = 0, last = y; for (; y < Hh; y++) { if (skyish(x, y)) { miss = 0; last = y; } else if (++miss > 8) break; } line[x] = last; }
    // Smooth the skyline a little and keep it off the rooftops
    const sm2 = new Float32Array(W); for (let x = 0; x < W; x++) { let m = 1e9; for (let k = -3; k <= 3; k++) { const v = line[Math.min(W - 1, Math.max(0, x + k))]; if (v < m) m = v; } sm2[x] = m - 4; }
    const out = mk(W / 2, Hh / 2), og = out.getContext('2d'), id = og.createImageData(out.width, out.height), o = id.data, f = 14;
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) { const sy = y * 2, edge = sm2[Math.min(W - 1, x * 2)], a = cl((edge - sy) / f, 0, 1); o[(y * out.width + x) * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a)); }
    og.putImageData(id, 0, 0); return out;
  }
  // Soft cloud shapes that tile side to side, made once
  function cloudTex(seed, dark) { const k = 'cl' + seed + dark; if (SPR[k]) return SPR[k]; const W = 512, Hh = 192, c = mk(W, Hh), g = c.getContext('2d'), id = g.createImageData(W, Hh), d = id.data, r = rng(seed);
    const lat = []; for (let o = 0; o < 5; o++) { const nx = 4 << o, ny = Math.max(2, Math.round((4 << o) * Hh / W * 1.6)), L2 = []; for (let i = 0; i < nx * ny; i++) L2.push(r()); lat.push({ nx, ny, L2 }); }
    const vn = (o, x, y) => { const { nx, ny, L2 } = lat[o], fx = x * nx, fy = y * ny, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, at = (i, j) => L2[((j % ny + ny) % ny) * nx + ((i % nx + nx) % nx)], sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy); };
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let n = 0, a = 0.55, tot = 0; for (let o = 0; o < 5; o++) { n += vn(o, x / W, y / Hh) * a; tot += a; a *= 0.5; } n /= tot;
      const m = sm((n - (dark ? 0.5 : 0.56)) / 0.22), q = (y * W + x) * 4; if (dark) { d[q] = 34; d[q + 1] = 40; d[q + 2] = 62; } else { d[q] = 176; d[q + 1] = 186; d[q + 2] = 212; } d[q + 3] = Math.round(255 * m * (dark ? 0.9 : 0.75)); }
    g.putImageData(id, 0, 0); return (SPR[k] = c); }
  // Clouds drifting slowly across the sky; each layer moves a whole tile per loop so the loop is seamless
  const cloudBuf = {};
  function clouds(ctx, R, tl, L, fl) {
    if (!R.sky) return; const w = Math.max(2, Math.round(R.w / 2)), h = Math.max(2, Math.round(R.h / 2)); let c = cloudBuf.c; if (!c || c.width !== w || c.height !== h) c = cloudBuf.c = mk(w, h); const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
    const layer = (tex, tw, th, y, tiles, a) => { const off = (tl / L) * tw * tiles; g.globalAlpha = a; for (let x = -tw + (off % tw); x < w; x += tw) g.drawImage(tex, x, y, tw, th); };
    layer(cloudTex(7, true), w * 1.4, h * 0.75, h * 0.02, 1, 0.42);
    layer(cloudTex(19, false), w * 1.1, h * 0.6, h * 0.08, 2, 0.16 + 0.5 * cl(fl.e, 0, 1));
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(R.sky, 0, 0, w, h);
    ctx.drawImage(c, R.x0, R.y0, R.w, R.h);
  }
  // A point on the glass from (0..1, 0..1) across and down it; the glass may be a slanted four sided shape
  const onGlass = (Q, a, b) => { const top = [lerp(Q[0][0], Q[1][0], a), lerp(Q[0][1], Q[1][1], a)], bot = [lerp(Q[3][0], Q[2][0], a), lerp(Q[3][1], Q[2][1], a)]; return [lerp(top[0], bot[0], b), lerp(top[1], bot[1], b)]; };
  const pathOf = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); };

  /* ---------- Storms: when the lightning goes, from the weather and from any thunder bars on the timeline ---------- */
  function flashTimes(cfg) {
    const L = loopOf(cfg), w = WX[cfg.weather] || WX.rain, n = Math.round(w.light * cl(+cfg.lightning, 0, 3) * L / 9), r = rng(hash('fl' + L + n)), out = [];
    for (let i = 0; i < n; i++) out.push({ t: (i + 0.15 + r() * 0.6) * L / n, big: r() < 0.45, seed: Math.floor(r() * 1e6) });
    return out;
  }
  // How bright the lightning is right now (0 to about 1.3): a double flash with a quick tail, repeating every loop
  function flashAt(cfg, t) {
    const L = loopOf(cfg); let e = 0, best = null;
    const one = (dt, big, seed) => { if (dt < 0 || dt > 1.2) return 0; const r = rng(seed), a = Math.exp(-dt * 28) + 0.75 * Math.exp(-Math.abs(dt - 0.16 - r() * 0.08) * 34) + (big ? 0.5 * Math.exp(-Math.abs(dt - 0.42) * 22) : 0); return a * (big ? 1.25 : 0.8); };
    flashTimes(cfg).forEach(f => { const dt = pmod(t - f.t, L), v = one(dt, f.big, f.seed); if (v > e) { e = v; best = { f, dt }; } });
    (cfg.stings || []).forEach(s => { if (s.k !== 'thunder' && s.k !== 'lightning') return; const v = one(t - s.start, true, hash(s.id)) * cl(+s.pow || 1, 0.2, 2); if (v > e) { e = v; best = { f: { big: true, seed: hash(s.id) }, dt: t - s.start }; } });
    return { e: cl(e, 0, 1.5), best };
  }
  // How bright the lamps are (1 normal, 0 off) from flicker and the stings
  function lampLevel(cfg, t, i) {
    const L = loopOf(cfg), fl = cl(+cfg.flicker, 0, 1); let f = 1 + fl * (0.035 * wob(t, L, 40 + i, [37, 53, 71, 97]) + 0.02 * wob(t, L, 60 + i, [3, 5]));
    // A bulb now and then catches and dips
    if (fl > 0.2) { const r = rng(900 + i), n = Math.round(fl * L / 12); for (let k = 0; k < n; k++) { const tk = r() * L, dt = pmod(t - tk, L); if (dt < 0.35) f -= (0.25 + r() * 0.25) * fl * Math.abs(Math.sin(dt * 55 + k)) * (1 - dt / 0.35); } }
    let room = 1;
    (cfg.stings || []).forEach(s => { const st = +s.start || 0, d = Math.max(0.2, +s.dur || 1), u = t - st; if (u < 0 || u > d + 0.6) return;
      if (s.k === 'flicker') { if (u < d) f *= 0.45 + 0.55 * (Math.sin(u * 47 + hash(s.id) % 7) > 0.15 ? 1 : 0.15 + 0.3 * Math.abs(Math.sin(u * 13))); }
      if (s.k === 'lightsoff' || s.k === 'blackout') { const off = u < 0.12 ? 1 - u / 0.12 : u < d ? 0 : u < d + 0.6 ? (Math.sin((u - d) * 60) > 0 ? sm((u - d) / 0.6) : 0.1) : 1; f *= lerp(0.08, 1, off); if (s.k === 'blackout') room = Math.min(room, lerp(0.25, 1, off)); }
      if (s.k === 'thunder' && u < 0.9) f *= 1 - 0.35 * Math.max(0, Math.sin(u / 0.9 * Math.PI)) * (Math.sin(u * 40) > 0 ? 1 : 0.5); });
    return { f: Math.max(0, f), room };
  }

  /* ---------- Drawing ---------- */
  function draw(ctx, t, cfg, look, W, H) { drawAt(ctx, t, t + (cfg.avatar ? +cfg.avatar.inPt || 0 : 0), cfg, look, W, H); }
  function drawAt(ctx, t, tAv, cfg, look, W, H) {
    cfg = eff(cfg);
    const bmp = roomBmp(cfg); ctx.save();
    if (!bmp) { ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, W, H); if (look && look.preview) emptyCard(ctx, W, H); drawAvatarAlone(ctx, cfg, tAv, W, H); ctx.restore(); return; }
    const v = view(cfg, W, H, t), M = cfg.marks || {}, L = loopOf(cfg), w = WX[cfg.weather] || WX.rain, tl = pmod(t, L);
    const base = ctx.getTransform ? Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1 : 1; ctx.transform(v.s, 0, 0, v.s, v.ox, v.oy); ctx.imageSmoothingQuality = 'low'; v.px = v.s * base;
    const B = bigRoom(bmp, v.s0 * base * 1.01); v.B = B; ctx.drawImage(B.c, 0, 0, v.iw, v.ih);
    const fl = flashAt(cfg, t), lamps = (M.lamps || []).map((m, i) => lampLevel(cfg, t, i)), room = lamps.reduce((a, x) => Math.min(a, x.room), lampLevel(cfg, t, 99).room);
    if (M.glass) drawWindow(ctx, cfg, M, v, t, tl, L, w, fl);
    if (cfg.sway !== false) drawPlants(ctx, v.B, M, v, t, L);
    drawShows(ctx, cfg, M, v, t, look);
    drawLight(ctx, cfg, M, v, t, lamps, fl, room, false);
    drawAvatar(ctx, cfg, v, tAv, lamps, fl, room);
    drawLight(ctx, cfg, M, v, t, lamps, fl, room, true);
    if (look && look.preview && cfg.mark) guides(ctx, M, v);
    ctx.restore();
  }
  function emptyCard(ctx, W, H) { const u = Math.min(W, H) / 1080; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([18 * u, 14 * u]); ctx.lineWidth = 4 * u; ctx.strokeRect(30 * u, 30 * u, W - 60 * u, H - 60 * u); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(84 * u)}px Anton, Impact, sans-serif`; ctx.fillText('YOUR STUDIO', W / 2, H * 0.42); ctx.font = `500 ${Math.round(40 * u)}px Lora, Georgia, serif`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText('Add a picture of your room on the left', W / 2, H * 0.53); ctx.restore(); }

  /* The window: the world outside first (lights in the flats, street lamps, cars, lightning, rain or snow falling), then the
     water on the glass in front of it, then anything standing in front of the glass is put back on top */
  function drawWindow(ctx, cfg, M, v, t, tl, L, w, fl) {
    const Q = M.glass.map(m => P(m, v)), R = roomBits(cfg, v); if (!R) return; const amt = cl(+cfg.rain, 0, 2);
    ctx.save(); pathOf(ctx, Q); ctx.clip();
    if (cfg.clouds !== false) clouds(ctx, R, tl, L, fl);
    if (cfg.outside !== false) outside(ctx, cfg, M, v, t, L, fl);
    if (fl.e > 0.01) sky(ctx, Q, R, fl, v);
    if (w.distant * amt > 0) distantRain(ctx, R, tl, L, w.distant * amt, v);
    if (w.snow) snow(ctx, R, tl, L, w.snow * Math.max(0.3, amt), v);
    if ((w.beads || w.snow) && amt > 0) { ctx.save(); ctx.globalAlpha = cl(0.22 * w.fog * (0.5 + amt * 0.5), 0, 0.5); ctx.drawImage(R.mist, R.x0, R.y0, R.w, R.h); ctx.restore(); }
    if (w.fog) { const g = ctx.createLinearGradient(0, R.y0 + R.h * 0.55, 0, R.y0 + R.h); g.addColorStop(0, 'rgba(150,165,200,0)'); g.addColorStop(1, `rgba(150,165,200,${0.07 * w.fog})`); ctx.fillStyle = g; ctx.fillRect(R.x0, R.y0, R.w, R.h); }
    if ((w.beads || w.runners) && amt > 0) glass(ctx, Q, R, tl, L, w, amt, v);
    ctx.restore();
    // Things on the sill (a plant, a mug) stay in front of the glass
    const bmp = roomBmp(cfg);
    (M.front || []).forEach(f => { if (!f.p || f.p.length < 3) return; const pts = f.p.map(m => P(m, v)), x0 = Math.max(0, Math.min(...pts.map(p => p[0])) - 2), y0 = Math.max(0, Math.min(...pts.map(p => p[1])) - 2), x1 = Math.min(v.iw, Math.max(...pts.map(p => p[0])) + 2), y1 = Math.min(v.ih, Math.max(...pts.map(p => p[1])) + 2); if (x1 <= x0 || y1 <= y0) return; ctx.save(); pathOf(ctx, pts); ctx.clip(); roomPart(ctx, v.B, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); ctx.restore(); });
  }
  function outside(ctx, cfg, M, v, t, L, fl) {
    // Flats: a few lights go off for a while and come back, the odd telly flickers blue
    (M.lit || []).forEach((m, i) => { const r = rng(1000 + i), kind = r(), x = m[0] * v.iw, y = m[1] * v.ih, w2 = m[2] * v.iw, h2 = m[3] * v.ih;
      if (kind < 0.22) { const a = r() * L, d = L * (0.2 + r() * 0.35), on = pmod(t - a, L) > d; if (!on) { ctx.fillStyle = m[4] || 'rgba(40,40,52,0.92)'; ctx.fillRect(x - 0.6, y - 0.6, w2 + 1.2, h2 + 1.2); } }
      else if (kind < 0.27) { const q = 0.5 + 0.5 * Math.sin(t * (7 + r() * 5) + Math.sin(t * 2.3 + i) * 3); ctx.fillStyle = `rgba(110,150,255,${0.25 + 0.35 * q})`; ctx.fillRect(x, y, w2, h2); } });
    // Street lamps shimmer in the wet
    const gs = glowSprite('rgba(255,190,110,0.9)');
    (M.street || []).forEach((m, i) => { const x = m[0] * v.iw, y = m[1] * v.ih, rr = (m[2] || 0.012) * v.iw, q = 0.75 + 0.18 * wob(t, L, 300 + i, [5, 9, 14]); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * q; ctx.drawImage(gs, x - rr * 2.4, y - rr * 2.4, rr * 4.8, rr * 4.8); ctx.globalAlpha = 0.18 * q; ctx.drawImage(gs, x - rr * 0.6, y - rr * 0.2, rr * 1.2, rr * 7); ctx.restore(); });
    // Cars along the road: headlights coming, red lights going
    const road = (M.road || []).map(m => P(m, v)); if (road.length >= 2) {
      const lens = [0]; for (let i = 1; i < road.length; i++) lens.push(lens[i - 1] + Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1])); const tot = lens[lens.length - 1] || 1;
      const at = d => { d = cl(d, 0, tot); let i = 1; while (i < lens.length - 1 && lens[i] < d) i++; const f = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]); return [lerp(road[i - 1][0], road[i][0], f), lerp(road[i - 1][1], road[i][1], f)]; };
      const n = Math.max(1, Math.round(L / 15)), r = rng(77), wl = glowSprite('rgba(255,245,215,0.95)'), rl = glowSprite('rgba(255,60,40,0.9)');
      for (let k = 0; k < n; k++) { const st = (k + r() * 0.6) * L / n, dur = 4 + r() * 3, dir = r() < 0.5 ? 1 : -1, u = pmod(t - st, L) / dur; if (u >= 1) continue;
        const d = dir > 0 ? u * tot : (1 - u) * tot, p = at(d), q = at(d + dir * 3), ang = Math.atan2(q[1] - p[1], q[0] - p[0]), fade = sm(u / 0.08) * sm((1 - u) / 0.08), sz = v.iw * 0.0045;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
        const spr = dir > 0 ? wl : rl; [-1, 1].forEach(sd => { const ox = Math.cos(ang + Math.PI / 2) * sz * 0.8 * sd, oy = Math.sin(ang + Math.PI / 2) * sz * 0.8 * sd; ctx.drawImage(spr, p[0] + ox - sz * 1.6, p[1] + oy - sz * 1.6, sz * 3.2, sz * 3.2); });
        if (dir > 0) { ctx.globalAlpha = fade * 0.35; ctx.drawImage(wl, p[0] + Math.cos(ang) * sz * 4 - sz * 4, p[1] + Math.sin(ang) * sz * 4 - sz * 2, sz * 8, sz * 4); }
        ctx.globalAlpha = fade * 0.25; ctx.drawImage(spr, p[0] - sz, p[1] + sz * 0.5, sz * 2, sz * 4); ctx.restore(); } }
  }
  // Lightning: the whole sky lights up, sometimes with a fork across the top of it
  function sky(ctx, Q, R, fl, v) {
    const e = fl.e; ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createLinearGradient(0, R.y0, 0, R.y0 + R.h); g.addColorStop(0, `rgba(205,215,255,${0.75 * e})`); g.addColorStop(0.6, `rgba(170,185,240,${0.45 * e})`); g.addColorStop(1, `rgba(140,150,210,${0.25 * e})`); ctx.fillStyle = g; ctx.fillRect(R.x0, R.y0, R.w, R.h); ctx.restore();
    const b = fl.best; if (!b || !b.f.big || b.dt > 0.5 || e < 0.25) return;
    // A fork in the open sky to one side, reaching down towards the skyline, with a branch or two
    const r = rng(b.f.seed), side = r() < 0.5, x = R.x0 + R.w * (side ? 0.06 + r() * 0.2 : 0.74 + r() * 0.2), y0 = R.y0 - 4, y1 = R.y0 + R.h * (0.42 + r() * 0.12), S = v.iw / 1672;
    const fork = (x0, ya, yb, n, spread) => { const pts = [[x0, ya]]; let px = x0; for (let i = 1; i <= n; i++) { px += (r() - 0.5) * spread; pts.push([px, lerp(ya, yb, i / n)]); } return pts; };
    const main = fork(x, y0, y1, 14, R.w * 0.05), br = [main]; for (let k = 0; k < 2; k++) { const at = main[4 + Math.floor(r() * 6)]; br.push(fork(at[0], at[1], at[1] + R.h * (0.08 + r() * 0.1), 6, R.w * 0.05)); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    br.forEach((pts, k) => { const sw = k ? 0.6 : 1; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = `rgba(170,180,255,${0.22 * e})`; ctx.lineWidth = 9 * S * sw; ctx.stroke(); ctx.strokeStyle = `rgba(220,225,255,${0.5 * e})`; ctx.lineWidth = 3.5 * S * sw; ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${0.95 * Math.min(1, e)})`; ctx.lineWidth = 1.4 * S * sw; ctx.stroke(); });
    ctx.restore();
  }
  // Rain beyond the glass: thin fast streaks; every streak falls a whole number of times per loop so the loop is seamless
  function distantRain(ctx, R, tl, L, amt, v) {
    const n = Math.round(150 * amt), r = rng(5150); ctx.save(); ctx.lineCap = 'round';
    for (let layer = 0; layer < 2; layer++) { ctx.strokeStyle = layer ? 'rgba(200,210,235,0.2)' : 'rgba(170,185,220,0.12)'; ctx.lineWidth = layer ? 0.9 : 0.65; ctx.beginPath();
      for (let i = 0; i < n / 2; i++) { const x0 = r(), k = Math.round((layer ? 46 : 30) + r() * 18), spd = k * (R.h + 40) / L, len = (layer ? 16 : 10) + r() * 8, y = R.y0 - 20 + pmod(r() * (R.h + 40) + spd * tl, R.h + 40), x = R.x0 + pmod(x0 * R.w + (y - R.y0) * 0.16, R.w);
        ctx.moveTo(x, y); ctx.lineTo(x - len * 0.16, y - len); }
      ctx.stroke(); }
    ctx.restore();
  }
  function snow(ctx, R, tl, L, amt, v) {
    const n = Math.round(160 * amt), r = rng(777); ctx.save(); ctx.fillStyle = 'rgba(235,240,255,0.85)';
    for (let i = 0; i < n; i++) { const k = 2 + Math.floor(r() * 4), spd = k * (R.h + 20) / L, y = R.y0 - 10 + pmod(r() * (R.h + 20) + spd * tl, R.h + 20), sw = Math.sin(TAU * (1 + Math.floor(r() * 3)) * tl / L + r() * TAU) * (6 + r() * 10), x = R.x0 + pmod(r() * R.w + sw, R.w), s = 0.8 + r() * 1.8;
      ctx.globalAlpha = 0.5 + 0.5 * (s / 2.6); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // A drop that bends the view behind it: a little upside-down, slightly magnified copy of what is outside
  function lens(ctx, R, x, y, rx, ry, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
    const sx = (x - R.x0) * R.k, sy = (y - R.y0) * R.k, sw = rx * 7 * R.k, sh = ry * 7 * R.k;
    ctx.translate(x, y); ctx.scale(1, -1); ctx.filter = 'none'; ctx.drawImage(R.soft, sx - sw / 2, sy - sh / 2, sw, sh, -rx * 1.1, -ry * 1.1, rx * 2.2, ry * 2.2); ctx.restore();
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(beadSprite(), x - rx * 1.07, y - ry * 1.07, rx * 2.14, ry * 2.14); ctx.restore();
  }
  function glass(ctx, Q, R, tl, L, w, amt, v) {
    const S = v.iw / 1672, bead = beadSprite();
    // Beads: land with a tiny splash, sit, then dry off or get swept away; small ones as a quick sprite, bigger ones bend the light
    const nb = Math.round(380 * w.beads * amt), r = rng(2024);
    for (let i = 0; i < nb; i++) { const a = r(), b = r(), size = Math.pow(r(), 2.4), rad = (1.1 + size * 5.5) * S, born = r() * L, life = L * (0.25 + r() * 0.6), age = pmod(tl - born, L); if (age > life) continue;
      const p = onGlass(Q, a, b), al = sm(age / 0.06) * (1 - sm((age - life + 1.2) / 1.2));
      if (age < 0.12 && rad > 2.2 * S) { ctx.save(); ctx.globalAlpha = (1 - age / 0.12) * 0.18; ctx.strokeStyle = 'rgba(220,230,255,1)'; ctx.lineWidth = 0.7 * S; ctx.beginPath(); ctx.arc(p[0], p[1], rad * (1 + age * 14), 0, TAU); ctx.stroke(); ctx.restore(); }
      if (rad > 2.6 * S) lens(ctx, R, p[0], p[1], rad, rad * 1.08, al); else { ctx.globalAlpha = al; ctx.drawImage(bead, p[0] - rad, p[1] - rad, rad * 2, rad * 2.1); }
    }
    ctx.globalAlpha = 1;
    // Runners: gather, then slide down in fits and starts, leaving a wet trail with a few beads in it
    const nr = Math.round(24 * w.runners * amt), q = rng(4048), gh = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
    for (let i = 0; i < nr; i++) { const a0 = 0.03 + q() * 0.94, b0 = q() * 0.45, born = q() * L, life = 2.5 + q() * 5, rate = 0.8 + q() * 1.4, spd = (0.18 + q() * 0.25), ph = q() * TAU, rad = (4 + q() * 3.5) * S, age = pmod(tl - born, L);
      if (age > life + 2.5) continue;
      const pos = tau => { const x = tau * rate, st = Math.floor(x) + sm((fract(x) - 0.55) / 0.45), g = (tau * 0.22 + 0.78 * st / rate) * spd; return [a0 + Math.sin(g * 9 + ph) * 0.004, b0 + g]; };
      const cur = Math.min(age, life), hd = pos(cur); if (hd[1] > 1.02) continue; const going = age <= life, fade = going ? sm(age / 0.3) : 1 - sm((age - life) / 2.5);
      // The wet trail
      const pts = []; for (let k = 0; k <= 24; k++) { const g2 = pos(cur * k / 24); pts.push(onGlass(Q, g2[0], Math.min(1, g2[1]))); }
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.35 * fade; ctx.strokeStyle = 'rgba(8,12,24,0.22)'; ctx.lineWidth = rad * 0.6; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(170,190,240,0.16)'; ctx.lineWidth = rad * 0.32; ctx.stroke(); ctx.restore();
      const rb = rng(i * 31 + 7); for (let k = 2; k < 22; k += 3) { const p = pts[k]; if (!p) break; const s = (0.6 + rb() * 0.9) * S; ctx.globalAlpha = 0.8 * fade; ctx.drawImage(bead, p[0] - s, p[1] - s, s * 2, s * 2); }
      ctx.globalAlpha = 1; if (going) { const hp = onGlass(Q, hd[0], hd[1]); lens(ctx, R, hp[0], hp[1], rad * 0.92, rad * 1.18, fade); }
    }
    ctx.globalAlpha = 1;
    void gh;
  }

  // Plants sway: thin strips of the picture slide a touch, more the further from where the plant is fixed
  function drawPlants(ctx, B, M, v, t, L) {
    (M.plants || []).forEach((m, i) => { const x0 = m[0] * v.iw, y0 = m[1] * v.ih, x1 = m[2] * v.iw, y1 = m[3] * v.ih, top = m[4] !== 'bottom', h = y1 - y0, step = 3, amp = (top ? 2.2 : 1.6) * v.iw / 1672;
      const sw = wob(t, L, 500 + i, [2, 3, 5]); if (h < 4 || x1 - x0 < 4) return;
      for (let y = y0; y < y1; y += step) { const f = top ? (y - y0) / h : (y1 - y) / h, dx = sw * amp * Math.pow(f, 1.4); if (Math.abs(dx) < 0.05) continue; roomPart(ctx, B, x0, y, x1 - x0, step, x0 + dx, y, x1 - x0, step); } });
  }

  /* The room's light: lamps glow and flicker, lightning floods in through the window (and throws its shape across the
     floor), and lights off or blackout bars darken the room. The first pass is behind the avatar, the second over them. */
  function drawLight(ctx, cfg, M, v, t, lamps, fl, room, over) {
    const S = v.iw / 1672, strength = cl(+cfg.lamps, 0, 2);
    if (!over) {
      (M.lamps || []).forEach((m, i) => { const x = m[0] * v.iw, y = m[1] * v.ih, rr = (m[2] || 0.05) * v.iw, f = lamps[i].f;
        if (f > 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = cl((f - 1) * 6 * strength, 0, 1); ctx.drawImage(glowSprite('rgba(255,170,80,0.55)'), x - rr * 1.6, y - rr * 1.6, rr * 3.2, rr * 3.2); ctx.restore(); }
        else if (f < 1) { ctx.save(); const k = cl(1 - f, 0, 1), g = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.7); g.addColorStop(0, `rgba(10,6,4,${0.9 * k})`); g.addColorStop(0.45, `rgba(10,6,4,${0.6 * k})`); g.addColorStop(1, 'rgba(10,6,4,0)'); ctx.fillStyle = g; ctx.fillRect(x - rr * 1.7, y - rr * 1.7, rr * 3.4, rr * 3.4); ctx.restore(); }
        if (strength > 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (strength - 1) * 0.6 * Math.min(1, f); ctx.drawImage(glowSprite('rgba(255,160,70,0.5)'), x - rr * 2, y - rr * 2, rr * 4, rr * 4); ctx.restore(); }
      });
      return;
    }
    // Everything off: the room goes dark apart from the window
    const avgLamp = lamps.length ? lamps.reduce((a, x) => a + Math.min(1, x.f), 0) / lamps.length : 1, dark = Math.max(1 - room, (1 - avgLamp) * 0.55);
    if (dark > 0.01) { ctx.save(); ctx.beginPath(); ctx.rect(-10, -10, v.iw + 20, v.ih + 20); if (M.glass) { const Q = M.glass.map(m => P(m, v)); ctx.moveTo(Q[0][0], Q[0][1]); for (let k = 3; k >= 1; k--) ctx.lineTo(Q[k][0], Q[k][1]); ctx.closePath(); } ctx.fillStyle = `rgba(4,6,14,${cl(dark, 0, 0.85)})`; ctx.fill('evenodd'); ctx.restore(); }
    // Lightning lights the room from the window
    if (fl.e > 0.01 && M.glass) { const Q = M.glass.map(m => P(m, v)), cx = (Q[0][0] + Q[1][0] + Q[2][0] + Q[3][0]) / 4, cy = (Q[0][1] + Q[1][1] + Q[2][1] + Q[3][1]) / 4, e = fl.e;
      ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, v.iw * 0.85); g.addColorStop(0, `rgba(150,165,240,${0.3 * e})`); g.addColorStop(0.4, `rgba(110,125,200,${0.13 * e})`); g.addColorStop(1, `rgba(80,90,160,${0.05 * e})`); ctx.fillStyle = g; ctx.fillRect(0, 0, v.iw, v.ih);
      // The window's shape thrown softly across the floor, stretched away from the window
      ctx.globalAlpha = 0.5 * cl(e, 0, 1.2); ctx.drawImage(floorLight(Q, v), 0, 0, v.iw, v.ih); ctx.restore(); }
    void S;
  }

  const flCache = { key: '', c: null };
  function floorLight(Q, v) { const key = JSON.stringify(Q) + v.iw; if (flCache.key === key) return flCache.c; const k = 1 / 10, c = mk(v.iw * k, v.ih * k), g = c.getContext('2d');
    const cx = (Q[0][0] + Q[1][0]) / 2, sk = (cx - v.iw * 0.5) * 0.85, fy = v.ih * 0.84, poly = [[Q[3][0] - sk * 0.15, fy], [Q[2][0] - sk * 0.15, fy], [Q[2][0] - sk * 1.05, v.ih * 1.04], [Q[3][0] - sk * 1.05, v.ih * 1.04]];
    g.scale(k, k); const gr = g.createLinearGradient(0, fy, 0, v.ih); gr.addColorStop(0, 'rgba(185,195,255,0.15)'); gr.addColorStop(0.35, 'rgba(185,195,255,0.6)'); gr.addColorStop(1, 'rgba(185,195,255,0.35)'); g.fillStyle = gr; pathOf(g, poly); g.fill();
    // Soften it by shrinking and growing it again
    const s2 = mk(c.width / 3, c.height / 3); s2.getContext('2d').drawImage(c, 0, 0, s2.width, s2.height); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(s2, 0, 0, c.width, c.height);
    flCache.key = key; flCache.c = c; return c; }
  /* ---------- Your avatar: their own video, keyed or see-through, lit to sit in the room ---------- */
  const avBuf = {};
  const buf = (k, w, h) => { let c = avBuf[k]; if (!c || c.width !== Math.ceil(w) || c.height !== Math.ceil(h)) { c = avBuf[k] = mk(w, h); } return c; };
  function avatarRect(cfg, v) { const A = cfg.avatar, inf = A && typeof Media !== 'undefined' ? Media.info(A.id) : null; if (!A || !inf) return null; const fw = inf.fw || inf.w, fh = inf.fh || inf.h, h = cl(+A.h || 1, 0.05, 3) * v.ih, w = h * fw / fh;
    return { x: A.x * v.iw - w / 2, y: A.y * v.ih - h / 2, w, h, fw, fh, box: inf.box || [0, 0, fw, fh] }; }
  function drawAvatar(ctx, cfg, v, tAv, lamps, fl, room) {
    const A = cfg.avatar; if (!A || typeof Media === 'undefined') return; const R = avatarRect(cfg, v); if (!R) return;
    const fr = Media.frame(A.id, cl(tAv, 0, 1e6)); if (!fr) return;
    const kx = R.w / R.fw, ky = R.h / R.fh, bx = R.x + R.box[0] * kx, by = R.y + R.box[1] * ky, bw = (R.box[2] - R.box[0]) * kx, bh = (R.box[3] - R.box[1]) * ky, flip = !!A.mirror;
    // Work at the size it appears on screen so the extra passes stay cheap
    const px = v.px || v.s, sc = Math.min(1, 1100 / Math.max(1, bh * px)), cw = Math.max(2, bw * px * sc), ch = Math.max(2, bh * px * sc), a = buf('a', cw, ch), ag = a.getContext('2d');
    ag.setTransform(1, 0, 0, 1, 0, 0); ag.clearRect(0, 0, cw, ch); if (flip) { ag.translate(cw, 0); ag.scale(-1, 1); } ag.drawImage(fr, 0, 0, cw, ch); ag.setTransform(1, 0, 0, 1, 0, 0);
    const grade = cl(A.grade == null ? 0.6 : +A.grade, 0, 1), warm = cl(A.warm == null ? 0.5 : +A.warm, 0, 1), cool = cl(A.cool == null ? 0.45 : +A.cool, 0, 1), shadow = cl(A.shadow == null ? 0.5 : +A.shadow, 0, 1);
    const lampAvg = lamps.length ? lamps.reduce((s, x) => s + Math.min(1.2, x.f), 0) / lamps.length : 1, dim = Math.min(room, lerp(1, lampAvg, 0.6));
    // Match the room: darker and a touch warmer in the shadows, then the edges catch the lamps and the window
    const m0 = buf('m', cw, ch), mg0 = m0.getContext('2d'); mg0.setTransform(1, 0, 0, 1, 0, 0); mg0.globalCompositeOperation = 'copy'; mg0.drawImage(a, 0, 0); mg0.globalCompositeOperation = 'source-over';
    if (grade > 0) { ag.globalCompositeOperation = 'source-atop'; ag.fillStyle = `rgba(28,20,34,${0.4 * grade})`; ag.fillRect(0, 0, cw, ch); ag.globalCompositeOperation = 'multiply'; ag.fillStyle = `rgb(255,${Math.round(lerp(255, 226, grade))},${Math.round(lerp(255, 200, grade))})`; ag.fillRect(0, 0, cw, ch); ag.globalCompositeOperation = 'destination-in'; ag.drawImage(m0, 0, 0); }
    ag.globalCompositeOperation = 'source-over';
    const rim = (key, col, dx, dy, k) => { if (k <= 0.01) return; const m = buf(key, cw, ch), mg = m.getContext('2d'); mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = 'copy'; mg.drawImage(m0, 0, 0); mg.globalCompositeOperation = 'source-in'; mg.fillStyle = col; mg.fillRect(0, 0, cw, ch); mg.globalCompositeOperation = 'destination-out'; mg.drawImage(m0, dx, dy); mg.globalCompositeOperation = 'source-over';
      ag.save(); ag.globalCompositeOperation = 'lighter'; ag.globalAlpha = k; ag.drawImage(m, 0, 0); ag.restore(); };
    const d = Math.max(2, cw * 0.012);
    rim('w', 'rgba(255,170,90,0.9)', d, d * 0.25, warm * 0.7 * cl(lampAvg, 0, 1.2));
    rim('c', 'rgba(130,160,255,0.9)', -d, d * 0.15, cool * 0.6 + cl(fl.e, 0, 1.2) * 0.8);
    if (fl.e > 0.01) { ag.save(); ag.globalCompositeOperation = 'source-atop'; ag.fillStyle = `rgba(170,185,255,${0.28 * cl(fl.e, 0, 1)})`; ag.fillRect(0, 0, cw, ch); ag.restore(); }
    if (dim < 0.99) { ag.save(); ag.globalCompositeOperation = 'source-atop'; ag.fillStyle = `rgba(4,6,14,${cl((1 - dim) * 0.85, 0, 0.85)})`; ag.fillRect(0, 0, cw, ch); ag.restore(); }
    // A soft shadow on the floor under the desk
    if (shadow > 0) { ctx.save(); const cx = bx + bw / 2, cy = by + bh * 0.985, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bw * 0.6); g.addColorStop(0, `rgba(0,0,0,${0.55 * shadow})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.translate(cx, cy); ctx.scale(1, 0.16); ctx.translate(-cx, -cy); ctx.fillStyle = g; ctx.fillRect(cx - bw * 0.6, cy - bw * 0.6, bw * 1.2, bw * 1.2); ctx.restore(); }
    ctx.drawImage(a, bx, by, bw, bh);
  }
  function drawAvatarAlone(ctx, cfg, tAv, W, H) { if (!cfg.avatar) return; const v = { s: Math.min(W / 1920, H / 1080), ox: 0, oy: 0, iw: 1920, ih: 1080 }; v.ox = (W - 1920 * v.s) / 2; v.oy = (H - 1080 * v.s) / 2; ctx.save(); const base = ctx.getTransform ? Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1 : 1; ctx.transform(v.s, 0, 0, v.s, v.ox, v.oy); v.px = v.s * base; drawAvatar(ctx, cfg, v, tAv, [], { e: 0 }, 1); ctx.restore(); }

  /* ---------- Picture frames as screens ---------- */
  const NAMES = { charts: 'Chart', timeline: 'Timeline', map: 'World map', flights: 'Flights', flyover: 'Map flyover', picto: 'Pictogram', news: 'Newspaper', story: 'Story', broll: 'B roll' };
  const raw = k => ({ charts: typeof Charts !== 'undefined' && Charts, timeline: typeof Timeline !== 'undefined' && Timeline, map: typeof MapMod !== 'undefined' && MapMod, flights: typeof Flights !== 'undefined' && Flights, flyover: typeof Flyover !== 'undefined' && Flyover, picto: typeof Picto !== 'undefined' && Picto, news: typeof News !== 'undefined' && News, story: typeof Story !== 'undefined' && Story, broll: typeof Broll !== 'undefined' && Broll })[k] || null;
  const modOf = k => { const m = raw(k); return m ? (typeof Layers !== 'undefined' ? Layers.wrap(m) : m) : null; };
  const showBufs = {};
  function showPicture(sh, t, look, w, h) {
    const key = sh.id + ':' + Math.round(w) + 'x' + Math.round(h); let c = showBufs[key]; if (!c) { if (Object.keys(showBufs).length > 24) Object.keys(showBufs).forEach(k => delete showBufs[k]); c = showBufs[key] = mk(w, h); }
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    if (sh.kind === 'pic') { const a = sh.asset && typeof Layers !== 'undefined' && Layers.assets[sh.asset]; g.fillStyle = '#111'; g.fillRect(0, 0, w, h); if (a && a.bmp) { const k = sh.fit === 'fit' ? Math.min(w / a.w, h / a.h) : Math.max(w / a.w, h / a.h); g.drawImage(a.bmp, (w - a.w * k) / 2, (h - a.h * k) / 2, a.w * k, a.h * k); } }
    else if (sh.kind === 'text') { const paper = sh.style === 'paper'; g.fillStyle = paper ? '#e9e3d4' : '#101216'; g.fillRect(0, 0, w, h); const pad = w * 0.08, fw = w - pad * 2; let sz = Math.min(h * 0.22, w * 0.2); const words = String(sh.text || 'HEADLINE').split(/\s+/);
      const wrap = () => { g.font = paper ? `900 ${sz}px "Playfair Display", Georgia, serif` : `${sz}px Anton, Impact, sans-serif`; const lines = []; let cur = ''; words.forEach(wd => { const tr = cur ? cur + ' ' + wd : wd; if (g.measureText(tr).width > fw && cur) { lines.push(cur); cur = wd; } else cur = tr; }); if (cur) lines.push(cur); return lines; };
      let lines = wrap(); while ((lines.length * sz * 1.08 > h * (sh.sub ? 0.66 : 0.82) || lines.some(l => g.measureText(l).width > fw)) && sz > 8) { sz *= 0.92; lines = wrap(); }
      g.fillStyle = paper ? '#151515' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; const y0 = h / 2 - (lines.length - 1) * sz * 0.54 - (sh.sub ? h * 0.07 : 0); lines.forEach((l, i) => g.fillText(paper ? l : l.toUpperCase(), w / 2, y0 + i * sz * 1.08));
      if (sh.sub) { g.font = `500 ${Math.max(8, h * 0.06)}px Lora, Georgia, serif`; g.fillStyle = paper ? '#444' : '#f5c542'; g.fillText(sh.sub, w / 2, h - h * 0.14); }
      if (paper) { g.fillStyle = '#151515'; g.fillRect(pad, h * 0.08, fw, Math.max(1, h * 0.008)); } }
    else if (sh.kind === 'clip') { const M = modOf(sh.mod); if (M && sh.mcfg) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const d = (() => { try { return M.duration(sh.mcfg, look); } catch (e) { return 3; } })(), lt = Math.min(Math.max(0, t - (+sh.start || 0) + (+sh.inPt || 0)), Math.max(0, d - 1e-3));
      const k = Math.max(w / 1920, h / 1080); g.save(); g.translate((w - 1920 * k) / 2, (h - 1080 * k) / 2); g.scale(k, k); try { M.draw(g, lt, sh.mcfg, Object.assign({}, look || {}, { format: '16:9', preview: false, scheme: sh.mod === 'story' || sh.mod === 'broll' ? 'chalk' : (look && look.scheme) || 'saltire' }), 1920, 1080); } catch (e) { } g.restore(); } }
    return c;
  }
  // Maps a flat picture onto a frame that may be seen at an angle, as a grid of small triangles
  function warp(ctx, img, Q, n = 6) {
    const w = img.width, h = img.height, pt = (a, b) => onGlass(Q, a, b);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a0 = i / n, a1 = (i + 1) / n, b0 = j / n, b1 = (j + 1) / n, p00 = pt(a0, b0), p10 = pt(a1, b0), p01 = pt(a0, b1), p11 = pt(a1, b1);
      tri(ctx, img, [a0 * w, b0 * h], [a1 * w, b0 * h], [a0 * w, b1 * h], p00, p10, p01); tri(ctx, img, [a1 * w, b0 * h], [a1 * w, b1 * h], [a0 * w, b1 * h], p10, p11, p01); }
  }
  function tri(ctx, img, s0, s1, s2, d0, d1, d2) {
    // Grow the triangle a hair so neighbours overlap and no seams show
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, gr = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.6, p[1] + dy / l * 0.6]; };
    const D0 = gr(d0), D1 = gr(d1), D2 = gr(d2);
    ctx.save(); ctx.beginPath(); ctx.moveTo(D0[0], D0[1]); ctx.lineTo(D1[0], D1[1]); ctx.lineTo(D2[0], D2[1]); ctx.closePath(); ctx.clip();
    const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]); if (Math.abs(den) < 1e-6) { ctx.restore(); return; }
    const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den, b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
    const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den, d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
    ctx.transform(a, b, c, d, d0[0] - a * s0[0] - c * s0[1], d0[1] - b * s0[0] - d * s0[1]); ctx.drawImage(img, 0, 0); ctx.restore();
  }
  function drawShows(ctx, cfg, M, v, t, look) {
    const frames = M.frames || []; if (!frames.length) return;
    (cfg.shows || []).forEach(sh => { const fr = frames.find(f => f.id === sh.frame); if (!fr || !fr.p) return; const st = +sh.start || 0, en = st + Math.max(0.3, +sh.dur || 5); if (t < st || t > en) return;
      const fd = Math.min(0.35, (en - st) / 3), a = sm((t - st) / fd) * sm((en - t) / fd); if (a <= 0.003) return;
      const Q = fr.p.map(m => P(m, v)), wpx = Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]) * (v.px || v.s), hpx = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]) * (v.px || v.s), k = Math.min(1, 720 / Math.max(wpx, hpx, 1));
      const img = showPicture(sh, t, look, Math.max(16, wpx * k * 1.5), Math.max(16, hpx * k * 1.5));
      ctx.save(); ctx.globalAlpha = a; warp(ctx, img, Q);
      // The room's light falls on it too, unless it glows like a screen; and a faint sheen of glass
      const lit = !!sh.glow; pathOf(ctx, Q); ctx.fillStyle = lit ? 'rgba(10,12,30,0.08)' : 'rgba(14,10,18,0.45)'; ctx.fill();
      const g = ctx.createLinearGradient(Q[0][0], Q[0][1], Q[2][0], Q[2][1]); g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      if (lit) { const cx = (Q[0][0] + Q[2][0]) / 2, cy = (Q[0][1] + Q[2][1]) / 2, rr = Math.max(Q[2][0] - Q[0][0], Q[2][1] - Q[0][1]); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 * a; ctx.drawImage(glowSprite('rgba(170,190,255,0.6)'), cx - rr, cy - rr, rr * 2, rr * 2); ctx.restore(); } });
  }

  // While marking things up: outlines of everything the room knows about
  function guides(ctx, M, v) {
    const lw = 2 / v.s; ctx.save(); ctx.lineWidth = lw; ctx.font = `600 ${14 / v.s}px system-ui, sans-serif`; ctx.textBaseline = 'bottom';
    const lab = (s, x, y, c) => { ctx.fillStyle = c; ctx.fillText(s, x, y - 3 / v.s); };
    if (M.glass) { const Q = M.glass.map(m => P(m, v)); ctx.strokeStyle = '#4fd1ff'; ctx.setLineDash([8 / v.s, 6 / v.s]); pathOf(ctx, Q); ctx.stroke(); lab('Window glass', Q[0][0], Q[0][1], '#4fd1ff'); }
    ctx.setLineDash([]);
    (M.front || []).forEach(f => { if (!f.p) return; ctx.strokeStyle = '#ff6b6b'; pathOf(ctx, f.p.map(m => P(m, v))); ctx.stroke(); });
    (M.lamps || []).forEach(m => { ctx.strokeStyle = '#ffc94d'; ctx.beginPath(); ctx.arc(m[0] * v.iw, m[1] * v.ih, (m[2] || 0.05) * v.iw, 0, TAU); ctx.stroke(); lab('Lamp', m[0] * v.iw, m[1] * v.ih - (m[2] || 0.05) * v.iw, '#ffc94d'); });
    (M.frames || []).forEach(f => { if (!f.p) return; const Q = f.p.map(m => P(m, v)); ctx.strokeStyle = '#ff7ce0'; pathOf(ctx, Q); ctx.stroke(); lab(f.name || 'Frame', Q[0][0], Q[0][1], '#ff7ce0'); });
    (M.plants || []).forEach(m => { ctx.strokeStyle = '#6ee07a'; ctx.strokeRect(m[0] * v.iw, m[1] * v.ih, (m[2] - m[0]) * v.iw, (m[3] - m[1]) * v.ih); lab('Plant', m[0] * v.iw, m[1] * v.ih, '#6ee07a'); });
    (M.street || []).forEach(m => { ctx.strokeStyle = '#ff9b3d'; ctx.beginPath(); ctx.arc(m[0] * v.iw, m[1] * v.ih, 8 / v.s, 0, TAU); ctx.stroke(); });
    const road = (M.road || []).map(m => P(m, v)); if (road.length > 1) { ctx.strokeStyle = '#ff9b3d'; ctx.setLineDash([4 / v.s, 4 / v.s]); ctx.beginPath(); road.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]); lab('Road', road[0][0], road[0][1], '#ff9b3d'); }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1 / v.s; (M.lit || []).forEach(m => ctx.strokeRect(m[0] * v.iw, m[1] * v.ih, m[2] * v.iw, m[3] * v.ih));
    ctx.restore();
  }

  /* ---------- Finding things in a room picture: the window (the biggest patch of sky), lamps (bright warm blobs), and,
     out of the window, lit windows in the flats and street lamps. Runs once when a picture is added. ---------- */
  function inPoly(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi) c = !c; } return c; }
  function detect(bmp, glassIn) {
    const W = bmp.width, Hh = bmp.height, c = mk(W, Hh), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, W, Hh).data;
    const comps = test => { const seen = new Uint8Array(W * Hh), out = [], q = new Int32Array(W * Hh);
      for (let i = 0; i < W * Hh; i++) { if (seen[i] || !test(i * 4)) continue; let h = 0, tl = 0; q[tl++] = i; seen[i] = 1; let n = 0, sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, mx = 0;
        while (h < tl) { const p = q[h++], x = p % W, y = (p - x) / W; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; const k = p * 4, lum = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; if (lum > mx) mx = lum;
          const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < Hh - 1 ? p + W : -1]; for (const o of nb) if (o >= 0 && !seen[o] && test(o * 4)) { seen[o] = 1; q[tl++] = o; } }
        out.push({ n, cx: sx / n, cy: sy / n, x0, y0, x1, y1, mx }); } return out; };
    let glass = glassIn ? glassIn.map(m => [m[0] * W, m[1] * Hh]) : null;
    if (!glass) { const sky = comps(k => d[k + 2] > d[k] + 12 && d[k + 2] > 55).sort((a, b) => b.n - a.n)[0]; if (sky && sky.n > W * Hh * 0.01) glass = [[sky.x0, sky.y0], [sky.x1, sky.y0], [sky.x1, sky.y1], [sky.x0, sky.y1]]; }
    const warm = k => { const r = d[k], gg = d[k + 1], b = d[k + 2]; return r > 150 && gg > 95 && b < r * 0.82 && (r + gg) / 2 > b + 45; };
    const all = comps(warm), lit = [], street = [], lamps = [];
    all.forEach(o => { const inside = glass && inPoly(glass, o.cx, o.cy), w = o.x1 - o.x0 + 1, h = o.y1 - o.y0 + 1;
      if (inside) {
        if (o.mx > 225 && o.n >= 4 && o.n <= 90 && glass && o.cy > lerp(Math.min(...glass.map(p => p[1])), Math.max(...glass.map(p => p[1])), 0.55)) { street.push([r4(o.cx / W), r4(o.cy / Hh), r4(Math.max(4, Math.sqrt(o.n) * 1.6) / W)]); return; }
        if (o.n <= 70 && w <= 16 && h <= 16) { let sr = 0, sg = 0, sb = 0, sn = 0; for (let y = o.y0 - 2; y <= o.y1 + 2; y++) for (let x = o.x0 - 2; x <= o.x1 + 2; x++) { if (x < 0 || y < 0 || x >= W || y >= Hh) continue; if (x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1) continue; const k = (y * W + x) * 4; if (warm(k)) continue; sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; sn++; }
          const col = sn ? `rgba(${Math.round(sr / sn * 0.9)},${Math.round(sg / sn * 0.9)},${Math.round(sb / sn * 0.9)},0.96)` : ''; lit.push([r4(o.x0 / W), r4(o.y0 / Hh), r4(w / W), r4(h / Hh), col]); }
      } else if (o.n > 120 && o.mx > 235) lamps.push([r4(o.cx / W), r4(o.cy / Hh), r4(cl(Math.sqrt(o.n) * 4.5 / W, 0.025, 0.09))]);
    });
    return { glass: glass ? glass.map(p => [r4(p[0] / W), r4(p[1] / Hh)]) : null, lit: lit.slice(0, 400), street: street.slice(0, 12), lamps: lamps.slice(0, 10) };
  }

  /* ---------- Exports: which video pictures are needed ---------- */
  function mediaFor(cfg) { const ids = new Set(); if (cfg.avatar && cfg.avatar.id) ids.add(cfg.avatar.id); (cfg.shows || []).forEach(sh => { if (sh.kind !== 'clip') return; const M = modOf(sh.mod); if (M && M.mediaFor && sh.mcfg) (M.mediaFor(sh.mcfg) || []).forEach(x => ids.add(x)); }); return [...ids]; }
  function mediaAtAv(cfg, t, tAv) { const out = []; if (cfg.avatar && cfg.avatar.id) out.push([cfg.avatar.id, Math.max(0, tAv)]);
    (cfg.shows || []).forEach(sh => { if (sh.kind !== 'clip') return; const st = +sh.start || 0; if (t < st || t > st + (+sh.dur || 5)) return; const M = modOf(sh.mod); if (M && M.mediaAt && sh.mcfg) out.push(...(M.mediaAt(sh.mcfg, Math.max(0, t - st + (+sh.inPt || 0))) || [])); }); return out; }
  const mediaAt = (cfg, t) => mediaAtAv(cfg, t, t + (cfg.avatar ? +cfg.avatar.inPt || 0 : 0));
  const needsMap = cfg => (cfg.shows || []).some(sh => sh.kind === 'clip' && (sh.mod === 'map' || sh.mod === 'flights' || sh.mod === 'flyover'));
  // The vertical frame moves gently, the lightning flickers: tell the exporter when it should blend frames for motion blur
  function blurHint() { return 1; }

  /* ---------- Sound: thunder that rolls in just after each flash, cars going past outside, wind when it snows, and a clunk
     or buzz when the lights go. No rain. Worked out sample by sample so it lines up with the picture exactly. Saved as its
     own WAV file. ---------- */
  function soundData(cfg, segs, total, sr = 44100) {
    const S0 = cfg.sound || {}, vol = cl(S0.vol == null ? 0.8 : +S0.vol, 0, 1.5), L = loopOf(cfg);
    const loopIt = !segs && !cfg.avatar && !(+cfg.len > 0), tail = loopIt ? 2 : 0.5, N = Math.ceil((total + tail) * sr), Lc = new Float32Array(N), Rc = new Float32Array(N), r = rng(hash('snd' + cfg.weather));
    if (S0.on === false || vol <= 0) return { L: Lc.subarray(0, Math.ceil(total * sr)), R: Rc.subarray(0, Math.ceil(total * sr)), sr };
    // Wind, only when it snows
    if (cfg.weather === 'snow') { let brown = 0, brownR = 0, lp2 = 0; for (let i = 0; i < N; i++) { const t = i / sr, gust = 1 + 0.5 * wob(t, L, 71, [1, 2, 3]), w1 = r() * 2 - 1, w2 = r() * 2 - 1; brown = (brown + 0.02 * w1) * 0.996; brownR = (brownR + 0.02 * w2) * 0.996; lp2 += 0.04 * (brown - lp2); const wa = 0.5 * (0.6 + 0.4 * gust); Lc[i] += lp2 * wa; Rc[i] += (brownR * 0.6 + lp2 * 0.4) * wa; } }
    const add = (t0, fn, len, pan) => { const i0 = Math.floor(t0 * sr), n = Math.floor(len * sr), gl = Math.sqrt(1 - pan) * 0.9, gr = Math.sqrt(pan) * 0.9; for (let k = 0; k < n; k++) { const j = i0 + k; if (j < 0 || j >= N) continue; const v = fn(k / sr); Lc[j] += v * gl; Rc[j] += v * gr; } };
    // A car going by outside
    if (S0.cars !== false && cfg.outside !== false && ((cfg.marks && cfg.marks.road) || []).length >= 2) { const n = Math.max(1, Math.round(L / 15)), rc = rng(77); for (let k = 0; k < n; k++) { const st = (k + rc() * 0.6) * L / n, dur = 4 + rc() * 3, dir = rc() < 0.5 ? 1 : -1; for (let tt = st; tt < total + tail; tt += L) { let lp = 0; const nr = rng(hash('car' + k + tt));
          add(tt, x => { const u = x / dur, e = Math.sin(Math.PI * cl(u, 0, 1)) ** 2; lp += 0.08 * ((nr() * 2 - 1) - lp); return lp * e * 0.14; }, dur, dir > 0 ? 0.3 : 0.7); } } }
    // Thunder: a crack for the close ones, then a long rumble rolling round
    if (S0.thunder !== false) { const hits = []; flashTimes(cfg).forEach(f => { for (let tt = f.t; tt < total + tail; tt += L) hits.push({ t: tt, big: f.big, seed: f.seed }); }); (cfg.stings || []).forEach(s2 => { if (s2.k === 'thunder') hits.push({ t: +s2.start || 0, big: true, seed: hash(s2.id), pow: +s2.pow || 1 }); });
      hits.forEach(h => { const rr = rng(h.seed + 5), delay = h.big ? 0.15 + rr() * 0.5 : 0.8 + rr() * 1.4, len = 4 + rr() * 3, pw = (h.pow || 1) * (h.big ? 1 : 0.6); let b1 = 0, b2 = 0, l1 = 0, l2 = 0, c1 = 0, env = 0;
        add(h.t + delay, x => { const n = rr() * 2 - 1; b1 = (b1 + 0.03 * n) * 0.998; l1 += 0.02 * (b1 - l1); b2 = (b2 + 0.03 * (rr() * 2 - 1)) * 0.998; l2 += 0.06 * (b2 - l2); env += 0.0004 * ((0.4 + 0.6 * Math.abs(Math.sin(x * 2.1 + Math.sin(x * 0.7) * 3))) - env);
          const att = cl(x / 0.25, 0, 1), dec = Math.exp(-Math.max(0, x - 0.3) / (len * 0.45)), crack = h.big ? (c1 += 0.5 * (n - c1), c1 * Math.exp(-x / 0.12) * 0.6) : 0; return (l1 * 1.6 + l2 * 0.9) * att * dec * (0.6 + env) * 0.55 * pw + crack * 0.6 * pw; }, len + 1, 0.4 + rr() * 0.2); }); }
    // Stings: a clunk when the lights go, an electric buzz while they flicker
    (cfg.stings || []).forEach(s2 => { const st = +s2.start || 0, d = Math.max(0.2, +s2.dur || 1);
      if (s2.k === 'lightsoff' || s2.k === 'blackout') { add(st, x => Math.sin(TAU * 70 * x) * 0.35 * Math.exp(-x / 0.06), 0.3, 0.5); add(st + d, x => Math.sin(TAU * 90 * x) * 0.2 * Math.exp(-x / 0.05), 0.25, 0.5); }
      if (s2.k === 'flicker') { const rb = rng(hash(s2.id)); add(st, x => { const on = Math.sin(x * 47) > 0.15 ? 1 : 0; return (Math.sign(Math.sin(TAU * 100 * x)) * 0.5 + (rb() - 0.5) * 0.4) * 0.06 * on; }, d, 0.5); } });
    // Join the end round to the start so a loop never clicks, then keep it all in range
    const M0 = Math.ceil(total * sr);
    if (loopIt) { const X = Math.min(Math.floor(2 * sr), N - M0); for (let i = 0; i < X; i++) { const f = i / X, a = Math.sin(f * Math.PI / 2), b = Math.cos(f * Math.PI / 2); Lc[i] = Lc[i] * a + Lc[M0 + i] * b; Rc[i] = Rc[i] * a + Rc[M0 + i] * b; } }
    const env = segs ? new Float32Array(M0) : null; if (env) segs.forEach(([a0, a1]) => { const i0 = Math.max(0, Math.floor(a0 * sr)), i1 = Math.min(M0, Math.ceil(a1 * sr)), f = Math.floor(0.15 * sr); for (let i = i0; i < i1; i++) env[i] = Math.max(env[i], Math.min(1, (i - i0) / f, (i1 - i) / f)); });
    for (let i = 0; i < M0; i++) { const e = env ? env[i] : 1; Lc[i] = Math.tanh(Lc[i] * vol * 1.6) * 0.9 * e; Rc[i] = Math.tanh(Rc[i] * vol * 1.6) * 0.9 * e; }
    return { L: Lc.subarray(0, M0), R: Rc.subarray(0, M0), sr };
  }
  function wav({ L, R, sr }) { const n = L.length, buf = new ArrayBuffer(44 + n * 4), dv = new DataView(buf), ws = (o, s2) => { for (let i = 0; i < s2.length; i++) dv.setUint8(o + i, s2.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0, o = 44; i < n; i++, o += 4) { dv.setInt16(o, Math.round(cl(L[i], -1, 1) * 32767), true); dv.setInt16(o + 2, Math.round(cl(R[i], -1, 1) * 32767), true); } return new Blob([buf], { type: 'audio/wav' }); }
  let playing = null;
  function listen(data) { if (playing) { try { playing.stop(); } catch (e) { } playing = null; return false; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; const ac = new AC(), b = ac.createBuffer(2, data.L.length, data.sr); b.copyToChannel(data.L, 0); b.copyToChannel(data.R, 1); const s2 = ac.createBufferSource(); s2.buffer = b; s2.connect(ac.destination); s2.onended = () => { playing = null; ac.close(); }; s2.start(); playing = s2; return true; }

  /* ---------- The timeline: stings on the room, what each frame shows, and the avatar ---------- */
  const hooks = {};
  const STING_LEN = { thunder: 2.5, lightning: 1, flicker: 2, lightsoff: 3, blackout: 3 };
  const KINDS = [['pic', 'Picture'], ['text', 'Headline'], ['clip', 'Clip from a tab']];
  const frameName = (cfg, id) => { const f = ((cfg.marks || {}).frames || []).find(x => x.id === id); return f ? f.name || 'Frame' : 'Frame'; };
  const editor = { formIsScene: true,
    tracks(cfg, look) { const d = duration(cfg), T = [];
      if (cfg.avatar) { const inf = typeof Media !== 'undefined' && Media.info(cfg.avatar.id); T.push({ id: 'av', name: 'Avatar', colour: '#a03a6a', items: [{ id: 'AV', start: 0, end: inf ? Math.max(0.3, inf.dur - (+cfg.avatar.inPt || 0)) : d, label: '🎙 ' + (cfg.avatar.name || 'Avatar'), colour: '#a03a6a', move: false, trim: 'none', title: 'Your avatar video' }] }); }
      T.push({ id: 'room', name: 'Room', colour: '#4f6fd0', items: (cfg.stings || []).map(s2 => ({ id: 'S:' + s2.id, start: +s2.start || 0, end: (+s2.start || 0) + Math.max(0.2, +s2.dur || 1), label: (STINGS.find(x => x[0] === s2.k) || [, s2.k])[1], colour: s2.k === 'thunder' || s2.k === 'lightning' ? '#5b6fd8' : '#b0703a', move: true, trim: 'both', minLen: 0.2 })) });
      const fr = (cfg.marks && cfg.marks.frames) || []; fr.forEach(f => { const its = (cfg.shows || []).filter(sh => sh.frame === f.id); if (!its.length) return; T.push({ id: 'f:' + f.id, name: f.name || 'Frame', colour: '#b0458f', items: its.map(sh => ({ id: 'W:' + sh.id, start: +sh.start || 0, end: (+sh.start || 0) + Math.max(0.3, +sh.dur || 5), label: sh.kind === 'text' ? '“' + (sh.text || 'Headline') + '”' : sh.kind === 'clip' ? '🎞 ' + (NAMES[sh.mod] || 'Clip') : '🖼 ' + (sh.name || 'Picture'), colour: '#b0458f', move: true, trim: 'both', minLen: 0.3 })) }); });
      return T; },
    update(cfg, id, ch) { const [k, x] = id.split(':'); const it = k === 'S' ? (cfg.stings || []).find(q => q.id === x) : k === 'W' ? (cfg.shows || []).find(q => q.id === x) : null; if (!it) return; it.start = r2(Math.max(0, ch.start)); it.dur = r2(Math.max(0.2, ch.end - ch.start)); },
    adds: [
      { label: 'Sting', title: 'Thunder, a flash of lightning, or the lights flickering or going off, at the playhead', choices: () => STINGS.map(([k, l]) => ({ label: l, key: k, icon: c => { const g = c.getContext('2d'); g.fillStyle = k === 'thunder' || k === 'lightning' ? '#2c3a7a' : '#3a2a14'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = k === 'thunder' || k === 'lightning' ? '#dfe4ff' : '#ffb35c'; g.lineWidth = 3; g.beginPath(); if (k === 'thunder' || k === 'lightning') { g.moveTo(c.width * 0.55, 4); g.lineTo(c.width * 0.4, c.height * 0.5); g.lineTo(c.width * 0.58, c.height * 0.5); g.lineTo(c.width * 0.42, c.height - 4); } else { g.arc(c.width / 2, c.height * 0.42, c.height * 0.22, 0, TAU); } g.stroke(); } })),
        fn(cfg, t, sel, ch) { const k = (ch && ch.key) || 'thunder', s2 = { id: nid('s'), k, start: r2(Math.max(0, t)), dur: STING_LEN[k] || 2, pow: 1 }; cfg.stings = cfg.stings || []; cfg.stings.push(s2); return 'S:' + s2.id; } },
      { label: 'In a frame', title: 'Show a picture, a headline or a clip in one of the frames on your wall', choices: cfg0 => { const fr = (cfg0 && cfg0.marks && cfg0.marks.frames) || (hooks.cfg && hooks.cfg().marks.frames) || []; return fr.length ? fr.map(f => ({ label: f.name || 'Frame', key: f.id, icon: c => { const g = c.getContext('2d'); g.fillStyle = '#2a2230'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#ff7ce0'; g.lineWidth = 3; g.strokeRect(c.width * 0.25, c.height * 0.18, c.width * 0.5, c.height * 0.64); } })) : [{ label: 'No frames marked yet: mark them on the left', key: '' }]; },
        fn(cfg, t, sel, ch) { const fr = (cfg.marks && cfg.marks.frames) || [], f = fr.find(x => x.id === (ch && ch.key)) || fr[0]; if (!f) return null; const sh = { id: nid('w'), frame: f.id, kind: 'text', text: 'HEADLINE HERE', style: 'paper', start: r2(Math.max(0, t)), dur: 6 }; cfg.shows = cfg.shows || []; cfg.shows.push(sh); return 'W:' + sh.id; } },
    ],
    remove(cfg, id) { const [k, x] = id.split(':'); if (k === 'S') cfg.stings = (cfg.stings || []).filter(q => q.id !== x); if (k === 'W') cfg.shows = (cfg.shows || []).filter(q => q.id !== x); if (k === 'AV') cfg.avatar = null; if (cfg.mark) removeMark(cfg, id); },
    duplicate(cfg, id) { const [k, x] = id.split(':'); const list = k === 'S' ? cfg.stings : k === 'W' ? cfg.shows : null; const it = list && list.find(q => q.id === x); if (!it) return null; const c = JSON.parse(JSON.stringify(it)); c.id = nid(k === 'S' ? 's' : 'w'); c.start = r2((+it.start || 0) + (+it.dur || 1)); list.push(c); return k + ':' + c.id; },
    inspect(root, cfg, id, changed, done) { panel(root, cfg, changed, id, done); },
    scene(root, cfg, changed) { panel(root, cfg, changed, null, null); },
    /* On the preview: drag yourself about, click a frame to choose what it shows; while marking, drag the marks */
    hits(cfg, look, t, W, H) { cfg = eff(cfg); const v = view(cfg, W, H, t), X = x => v.ox + x * v.s, Y = y => v.oy + y * v.s, out = [], M = cfg.marks || {}, hb = (x, y, r) => [X(x) - r, Y(y) - r, X(x) + r, Y(y) + r];
      if (!roomBmp(cfg)) { return out; }
      if (cfg.mark) {
        (M.plants || []).forEach((m, i) => out.push({ id: 'PL:' + i, box: [X(m[0] * v.iw), Y(m[1] * v.ih), X(m[2] * v.iw), Y(m[3] * v.ih)], scale: true, label: 'Plant' }));
        (M.front || []).forEach((f, i) => { const p = f.p.map(m => P(m, v)); out.push({ id: 'O:' + i, box: [X(Math.min(...p.map(q => q[0]))), Y(Math.min(...p.map(q => q[1]))), X(Math.max(...p.map(q => q[0]))), Y(Math.max(...p.map(q => q[1])))], scale: true, label: 'In front of the glass' }); });
        (M.frames || []).forEach(f => { const p = f.p.map(m => P(m, v)); out.push({ id: 'Fm:' + f.id, box: [X(Math.min(...p.map(q => q[0]))), Y(Math.min(...p.map(q => q[1]))), X(Math.max(...p.map(q => q[0]))), Y(Math.max(...p.map(q => q[1])))], label: f.name || 'Frame' }); p.forEach((q, c) => out.push({ id: 'Fc:' + f.id + ':' + c, box: hb(q[0], q[1], 9), label: 'Corner' })); });
        (M.lamps || []).forEach((m, i) => { const r = (m[2] || 0.05) * v.iw * v.s; out.push({ id: 'L:' + i, box: [X(m[0] * v.iw) - r, Y(m[1] * v.ih) - r, X(m[0] * v.iw) + r, Y(m[1] * v.ih) + r], scale: true, label: 'Lamp' }); });
        (M.street || []).forEach((m, i) => out.push({ id: 'SL:' + i, box: hb(m[0] * v.iw, m[1] * v.ih, 10), label: 'Street lamp' }));
        (M.road || []).forEach((m, i) => out.push({ id: 'R:' + i, box: hb(m[0] * v.iw, m[1] * v.ih, 8), label: 'Road' }));
        if (M.glass) M.glass.forEach((m, i) => out.push({ id: 'G:' + i, box: hb(m[0] * v.iw, m[1] * v.ih, 11), label: 'Window corner' }));
        return out; }
      (M.frames || []).forEach(f => { const p = f.p.map(m => P(m, v)); out.push({ id: 'F:' + f.id, box: [X(Math.min(...p.map(q => q[0]))), Y(Math.min(...p.map(q => q[1]))), X(Math.max(...p.map(q => q[0]))), Y(Math.max(...p.map(q => q[1])))], label: (f.name || 'Frame') + ': click to fill it' }); });
      const R = avatarRect(cfg, v); if (R) { const b = R.box, kx = R.w / R.fw, ky = R.h / R.fh; out.push({ id: 'AV', box: [X(R.x + b[0] * kx), Y(R.y + b[1] * ky), X(R.x + b[2] * kx), Y(R.y + b[3] * ky)], scale: true, label: 'You: drag to move, corners to size' }); }
      return out; },
    grab(cfg, id, g) { const v = view(cfg, g.W, g.H, g.t || 0); return { v, cfg: JSON.parse(JSON.stringify({ a: cfg.avatar, m: cfg.marks })) }; },
    move(cfg, id, snap, dx, dy) { const v = snap.v, du = dx / v.s / v.iw, dv = dy / v.s / v.ih, M = cfg.marks, M0 = snap.cfg.m, [k, a, b] = id.split(':'), mv = (dst, src) => { dst[0] = r4(cl(src[0] + du, -0.1, 1.1)); dst[1] = r4(cl(src[1] + dv, -0.1, 1.1)); };
      if (k === 'AV' && cfg.avatar) { cfg.avatar.x = r4(snap.cfg.a.x + du); cfg.avatar.y = r4(snap.cfg.a.y + dv); }
      else if (k === 'G') mv(M.glass[+a], M0.glass[+a]);
      else if (k === 'L' || k === 'SL' || k === 'R') { const key = k === 'L' ? 'lamps' : k === 'SL' ? 'street' : 'road'; mv(M[key][+a], M0[key][+a]); }
      else if (k === 'PL') { const m = M.plants[+a], o = M0.plants[+a]; m[0] = r4(o[0] + du); m[2] = r4(o[2] + du); m[1] = r4(o[1] + dv); m[3] = r4(o[3] + dv); }
      else if (k === 'O') M.front[+a].p.forEach((p, i) => mv(p, M0.front[+a].p[i]));
      else if (k === 'Fm') { const f = M.frames.find(x => x.id === a), o = M0.frames.find(x => x.id === a); if (f) f.p.forEach((p, i) => mv(p, o.p[i])); }
      else if (k === 'Fc') { const f = M.frames.find(x => x.id === a), o = M0.frames.find(x => x.id === a); if (f) mv(f.p[+b], o.p[+b]); } },
    resize(cfg, id, snap, f) { const [k, a] = id.split(':'), M = cfg.marks, M0 = snap.cfg.m;
      if (k === 'AV' && cfg.avatar) cfg.avatar.h = r4(cl(snap.cfg.a.h * f, 0.05, 3));
      else if (k === 'L') M.lamps[+a][2] = r4(cl((M0.lamps[+a][2] || 0.05) * f, 0.005, 0.4));
      else if (k === 'PL') { const o = M0.plants[+a], cx = (o[0] + o[2]) / 2, cy = (o[1] + o[3]) / 2, m = M.plants[+a]; m[0] = r4(cx + (o[0] - cx) * f); m[2] = r4(cx + (o[2] - cx) * f); m[1] = r4(cy + (o[1] - cy) * f); m[3] = r4(cy + (o[3] - cy) * f); }
      else if (k === 'O') { const o = M0.front[+a].p, cx = o.reduce((s2, p) => s2 + p[0], 0) / o.length, cy = o.reduce((s2, p) => s2 + p[1], 0) / o.length; M.front[+a].p = o.map(p => [r4(cx + (p[0] - cx) * f), r4(cy + (p[1] - cy) * f)]); } },
  };
  function removeMark(cfg, id) { const [k, a] = id.split(':'), M = cfg.marks; const cut = (key, i) => { M[key] = (M[key] || []).filter((_, j) => j !== +i); };
    if (k === 'L') cut('lamps', a); if (k === 'SL') cut('street', a); if (k === 'R') cut('road', a); if (k === 'PL') cut('plants', a); if (k === 'O') cut('front', a);
    if (k === 'Fm' || k === 'Fc' || k === 'F') { M.frames = (M.frames || []).filter(f => f.id !== a); cfg.shows = (cfg.shows || []).filter(sh => sh.frame !== a); } }

  /* ---------- The panel on the left ---------- */
  function panel(root, cfg, changed, id, done) {
    const { H, field, sel, txt, area, num, card, grid2, btn } = UI;
    const redo = () => { root.innerHTML = ''; panel(root, cfg, changed, id, done); }, ch = () => { changed(); redo(); };
    const seg = (items, cur, fn) => H('div', { className: 'st-seg wrap' }, ...items.map(([k, l]) => H('button', { type: 'button', className: String(k) === String(cur) ? 'on' : '', textContent: l, 'aria-pressed': String(String(k) === String(cur)), on: { click: () => fn(k) } })));
    const range = (v0, min, max, step, fn, label, fmt = x => Math.round(x * 100) + '%') => { const out = H('span', { className: 'st-rv', textContent: fmt(v0) }), inp = H('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(v0), 'aria-label': label, on: { input: e => { const x = +e.target.value; out.textContent = fmt(x); fn(x); changed(false); }, change: () => changed() } }); return H('div', { className: 'st-range' }, inp, out); };
    const foot = (...b) => H('div', { className: 'btnrow' }, ...b, done ? btn('Done', done) : '');
    if (!cfg.room && hasBuiltin) { cfg.room = { asset: BUILTIN, name: 'Your studio' }; if (!(cfg.marks && cfg.marks.glass)) cfg.marks = builtinMarks(); if (cfg.clouds == null) cfg.clouds = true; }
    const M = cfg.marks = Object.assign({ glass: null, front: [], lamps: [], frames: [], plants: [], street: [], lit: [], road: [] }, cfg.marks || {});
    const now = () => (typeof Layers !== 'undefined' && Layers.hooks && Layers.hooks.time ? Layers.hooks.time() : 0);
    const [k, a] = (id || '').split(':');
    if (k === 'S') { const s2 = (cfg.stings || []).find(q => q.id === a); if (s2) { root.append(card('Sting', field('What happens', sel(s2.k, STINGS, v => { s2.k = v; ch(); }, 'Sting')), grid2(field('Starts at (seconds)', num(s2.start, v => { s2.start = r2(v); changed(); }, 0, 3600, 0.1, 'Start')), field('Lasts (seconds)', num(s2.dur, v => { s2.dur = r2(v); changed(); }, 0.2, 60, 0.1, 'Length'))),
      s2.k === 'thunder' || s2.k === 'lightning' ? field('How big', range(+s2.pow || 1, 0.3, 2, 0.05, v => { s2.pow = r2(v); }, 'How big')) : '', H('p', { className: 'hint', textContent: s2.k === 'thunder' ? 'Lightning lights the room, the lamps dip, and the thunder is in the sound file.' : s2.k === 'lightsoff' ? 'The lamps go out and flicker back on at the end.' : s2.k === 'blackout' ? 'The whole room goes dark apart from the window.' : '' }), foot())); return; } }
    if (k === 'W') { const sh = (cfg.shows || []).find(q => q.id === a); if (sh) { showCard(sh); return; } }
    if (k === 'F' || k === 'Fm' || k === 'Fc') { const f = M.frames.find(x => x.id === a); if (f) { frameCard(f); return; } }
    if (k === 'AV') { avatarCard(); return; }
    if (['L', 'SL', 'R', 'PL', 'O', 'G'].includes(k)) { const names = { L: 'Lamp', SL: 'Street lamp', R: 'Road point', PL: 'Plant', O: 'In front of the glass', G: 'Window corner' };
      root.append(card(names[k], H('p', { className: 'hint', textContent: k === 'PL' ? 'Drag it over the plant; a corner makes it bigger or smaller.' + (M.plants[+a] ? '' : '') : k === 'O' ? 'Whatever is inside this shape stays in front of the rain on the glass.' : k === 'L' ? 'Put it on the bulb; a corner sets how far its glow reaches.' : 'Drag it into place.' }),
        k === 'PL' && M.plants[+a] ? field('Fixed at', seg([['top', 'The top (hanging)'], ['bottom', 'The bottom (in a pot)']], M.plants[+a][4] || 'top', v => { M.plants[+a][4] = v; ch(); })) : '',
        foot(k !== 'G' ? btn('Remove it', () => { removeMark(cfg, id); changed(); hooks.select && hooks.select(null); }) : ''))); return; }
    roomCard(); if (roomBmp(cfg)) { weatherCard(); avatarCard(); framesCard(); soundCard(); }

    function roomCard() {
      const note = H('p', { className: 'hint' }), has = !!roomBmp(cfg);
      const pick = () => { const inp = H('input', { type: 'file', accept: 'image/*' }); inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; note.textContent = 'Reading ' + f.name + '…';
        try { const im = await Layers.importImage(f, 2600); cfg.room = { asset: im.id, name: f.name }; const bmp = Layers.assets[im.id] && Layers.assets[im.id].bmp; if (bmp) { const d = detect(bmp, null); Object.assign(cfg.marks, { glass: d.glass, lit: d.lit, street: d.street, lamps: d.lamps, frames: [], plants: [], front: [], road: [] }); }
          cfg.mark = true; ch(); } catch (e) { note.textContent = 'That picture could not be read.'; } }; inp.click(); };
      if (!has) { root.append(card('Your studio', H('p', { className: 'hint', textContent: 'Add a picture of your room. Patter Studio finds the window, the lamps and the lights outside by itself, then you can mark picture frames, plants and anything standing in front of the window.' }), H('div', { className: 'btnrow' }, btn('Add a picture of your room', pick, 'primary')), note)); return; }
      const cnt = (n, one, many) => n + ' ' + (n === 1 ? one : many);
      const kids = [cfg.room.asset === BUILTIN ? H('p', { className: 'hint', textContent: 'Your studio, already animated: rain on the window, clouds drifting, lamps, the flats outside and the odd car going past. Change the weather and light below, or add your avatar.' }) : '', H('p', { className: 'hint', textContent: '🖼 ' + (cfg.room.name || 'Room') + '. ' + [M.glass ? 'window found' : 'no window yet', cnt(M.lamps.length, 'lamp', 'lamps'), cnt(M.frames.length, 'frame', 'frames'), cnt(M.plants.length, 'plant', 'plants'), cnt(M.lit.length, 'light outside', 'lights outside')].join(', ') + '.' }),
        H('label', { className: 'chk' }, H('input', { type: 'checkbox', checked: !!cfg.mark, on: { change: e => { cfg.mark = e.target.checked; ch(); } } }), ' Mark things on the preview')];
      if (cfg.mark) { const add = (label, fn) => btn(label, () => { fn(); changed(); redo(); }), c = 0.5;
        kids.push(H('p', { className: 'hint', textContent: 'Drag the outlines on the preview so they sit on the real things. Drag a corner to resize. Select one and press Delete to remove it. Untick when you are done.' }),
          H('div', { className: 'btnrow' }, add('+ Lamp', () => M.lamps.push([c, 0.3, 0.05])), add('+ Picture frame', () => M.frames.push({ id: nid('f'), name: 'Frame ' + (M.frames.length + 1), p: [[0.42, 0.2], [0.54, 0.2], [0.54, 0.4], [0.42, 0.4]] })), add('+ Plant', () => M.plants.push([0.45, 0.3, 0.52, 0.5, 'top'])),
            add('+ In front of the window', () => { const G = M.glass || [[0.6, 0.1], [0.95, 0.1], [0.95, 0.55], [0.6, 0.55]], gx = (G[3][0] + G[2][0]) / 2, gy = G[3][1]; M.front.push({ p: [[gx - 0.03, gy - 0.08], [gx + 0.03, gy - 0.08], [gx + 0.03, gy + 0.01], [gx - 0.03, gy + 0.01]] }); }),
            add('+ Street lamp', () => { const G = M.glass || [[0.6, 0.1], [0.95, 0.1], [0.95, 0.55], [0.6, 0.55]]; M.street.push([(G[0][0] + G[1][0]) / 2, lerp(G[0][1], G[3][1], 0.8), 0.006]); }),
            M.road.length ? add('Remove the road', () => { M.road = []; }) : add('+ Road for cars', () => { const G = M.glass || [[0.6, 0.1], [0.95, 0.1], [0.95, 0.55], [0.6, 0.55]], y = lerp(G[0][1], G[3][1], 0.88); M.road = [0, 0.25, 0.5, 0.75, 1].map(f => [r4(lerp(G[3][0] + 0.02, G[2][0] - 0.02, f)), r4(y)]); }),
            M.glass ? '' : add('+ Window', () => { M.glass = [[0.6, 0.1], [0.95, 0.1], [0.95, 0.55], [0.6, 0.55]]; }),
            btn('Find the lights again', () => { const bmp = roomBmp(cfg); if (!bmp) return; const d = detect(bmp, M.glass); M.lit = d.lit; M.street = d.street; if (!M.lamps.length) M.lamps = d.lamps; changed(); redo(); })));
      }
      kids.push(H('div', { className: 'btnrow' }, cfg.room.asset === BUILTIN ? '' : hasBuiltin ? btn('Back to my studio', () => { cfg.room = { asset: BUILTIN, name: 'Your studio' }; cfg.marks = builtinMarks(); cfg.mark = false; ch(); }, 'primary') : '', btn(cfg.room.asset === BUILTIN ? 'Use a different room picture' : 'Change picture', pick)), note);
      root.append(card('Your studio', ...kids));
    }
    function weatherCard() {
      const L = loopOf(cfg), w = cfg.weather || 'rain';
      root.append(card('Weather and light',
        H('div', { className: 'st-seg wrap g3' }, ...seg(WEATHER, w, v => { cfg.weather = v; ch(); }).childNodes),
        w !== 'dry' ? field(w === 'snow' ? 'How much snow' : 'Rain on the window', range(cl(+cfg.rain, 0, 2), 0, 2, 0.05, v => { cfg.rain = r2(v); }, 'Rain amount')) : '',
        w === 'storm' ? field('Lightning', seg([[0, 'None'], [0.6, 'Now and then'], [1, 'Some'], [2, 'Lots']], +cfg.lightning, v => { cfg.lightning = +v; ch(); })) : '',
        field('Lamp glow', range(cl(+cfg.lamps, 0, 2), 0, 2, 0.05, v => { cfg.lamps = r2(v); }, 'Lamp glow')),
        field('Lamp flicker', range(cl(+cfg.flicker, 0, 1), 0, 1, 0.05, v => { cfg.flicker = r2(v); }, 'Lamp flicker')),
        field('Clouds drifting', seg([['1', 'On'], ['0', 'Off']], cfg.clouds !== false ? '1' : '0', v => { cfg.clouds = v === '1'; ch(); })),
        grid2(field('Life outside', seg([['1', 'On'], ['0', 'Off']], cfg.outside !== false ? '1' : '0', v => { cfg.outside = v === '1'; ch(); })), field('Plants sway', seg([['1', 'On'], ['0', 'Off']], cfg.sway !== false ? '1' : '0', v => { cfg.sway = v === '1'; ch(); }))),
        field('Camera drift', seg([['off', 'Still'], ['gentle', 'Gentle'], ['more', 'More']], cfg.drift || 'gentle', v => { cfg.drift = v; ch(); })),
        grid2(field('Repeats every (seconds)', num(L, v => { cfg.loop = r2(v); changed(); }, 4, 120, 1, 'Loop length'), 'Everything repeats exactly, so it loops without a join.'), field('Clip length (seconds, 0 = automatic)', num(+cfg.len || 0, v => { cfg.len = r2(v); changed(); }, 0, 1800, 1, 'Clip length'), cfg.avatar ? 'Automatic follows your avatar video.' : 'Automatic is one loop.')),
        H('p', { className: 'hint', textContent: 'Add thunder, lightning, flickers and lights off at a moment with + Sting on the timeline. Camera moves, captions, name titles and a subscribe reminder are under Layers.' })));
    }
    function avatarCard() {
      const A = cfg.avatar, note = H('p', { className: 'hint' }), inf = A && typeof Media !== 'undefined' ? Media.info(A.id) : null, opts = cfg._key || (cfg._key = { key: 'auto', tol: 0.5, fps: 30 });
      const load = (src, what) => { if (typeof Media === 'undefined' || !Media.importAvatar) { note.textContent = 'Videos can only be added in the app itself.'; return; } note.textContent = 'Reading ' + what + '…';
        Media.importAvatar(src, { key: opts.key, tol: opts.tol, fps: opts.fps }, q => { note.textContent = 'Reading ' + what + ': ' + Math.round(q * 100) + '%'; })
          .then(m => { cfg.avatar = Object.assign({ x: 0.5, y: 0.5, h: 1, inPt: 0, grade: 0.6, warm: 0.5, cool: 0.45, shadow: 0.5 }, A || {}, { id: m.id, name: m.name }); delete cfg._key; changed(); redo(); const n2 = root.querySelector('.av-note'); if (n2) n2.textContent = (m.key === 'green' || m.key === 'blue' ? 'The ' + m.key + ' screen was taken out. ' : '') + (m.cut ? 'Only the first 10 minutes were read. ' : '') + (m.unsaved ? 'There was no room to keep it on this computer, so add it again after closing the app.' : ''); })
          .catch(e => { note.textContent = e.message || String(e); }); };
      const pickVid = () => { const inp = H('input', { type: 'file', accept: 'video/*,.webm,.mov,.mp4' }); inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) load(f, f.name); }; inp.click(); };
      const pickPng = () => { const inp = H('input', { type: 'file', accept: 'image/png,image/webp', multiple: true }); inp.onchange = () => { const fs = [...(inp.files || [])]; if (fs.length) load(fs, fs.length + ' pictures'); }; inp.click(); };
      note.className = 'hint av-note';
      if (!A || !inf) { root.append(card('Your avatar', H('p', { className: 'hint', textContent: A && !inf ? 'Your avatar video is not on this computer. Add it again.' : 'From Character Animator, export a PNG sequence (File, Export, PNG Sequence and WAV) or a video on a green screen. A see-through WebM works too. Up to 10 minutes.' }),
          grid2(field('Background', sel(opts.key, [['auto', 'Find it myself'], ['green', 'Green screen'], ['blue', 'Blue screen'], ['none', 'Already see-through']], v => { opts.key = v; }, 'Background')), field('PNG frames a second', num(opts.fps, v => { opts.fps = v; }, 1, 60, 1, 'Frames a second'))),
          field('Green screen strength', range(opts.tol, 0, 1, 0.05, v => { opts.tol = v; }, 'Key strength')),
          H('div', { className: 'btnrow' }, btn('Add avatar video', pickVid, 'primary'), btn('Add a PNG sequence', pickPng)), note)); return; }
      const set = (key, v) => { A[key] = r2(v); };
      root.append(card('Your avatar', H('p', { className: 'hint', textContent: '🎙 ' + (A.name || 'Avatar') + ', ' + inf.dur.toFixed(1) + ' s. Drag yourself on the preview to move, or a corner to change your size.' }),
        grid2(field('Size', range(cl(+A.h || 1, 0.1, 2), 0.1, 2, 0.01, v => set('h', v), 'Avatar size', x => Math.round(x * 100) + '%')), field('Start from (seconds into your video)', num(+A.inPt || 0, v => { A.inPt = r2(v); changed(); }, 0, 600, 0.1, 'Start from'))),
        field('Match the room', range(A.grade == null ? 0.6 : +A.grade, 0, 1, 0.05, v => set('grade', v), 'Match the room')),
        grid2(field('Lamp light on your edge', range(A.warm == null ? 0.5 : +A.warm, 0, 1, 0.05, v => set('warm', v), 'Warm edge')), field('Window light on your edge', range(A.cool == null ? 0.45 : +A.cool, 0, 1, 0.05, v => set('cool', v), 'Cool edge'))),
        grid2(field('Shadow on the floor', range(A.shadow == null ? 0.5 : +A.shadow, 0, 1, 0.05, v => set('shadow', v), 'Shadow')), field('Flip left to right', seg([['0', 'No'], ['1', 'Yes']], A.mirror ? '1' : '0', v => { A.mirror = v === '1'; ch(); }))),
        H('div', { className: 'btnrow' }, btn('Fill the frame with the video', () => { A.x = 0.5; A.y = 0.5; A.h = 1; ch(); }), btn('Change video', pickVid), btn('Change to PNG sequence', pickPng), btn('Remove', () => { cfg.avatar = null; ch(); })), note, done ? foot() : ''));
    }
    function framesCard() {
      if (!M.frames.length) return; const list = H('div', { className: 'vid-list' }, ...M.frames.map(f => { const n = (cfg.shows || []).filter(sh => sh.frame === f.id).length; return H('div', { className: 'vid-row' }, H('i', { style: 'background:#b0458f' }), H('span', { className: 'vid-name', textContent: f.name || 'Frame' }), H('span', { className: 'vid-len', textContent: n ? n + ' on show' : 'empty' }), btn('Show something', () => { const sh = addShow(f.id); hooks.select && hooks.select('W:' + sh.id); }));
      }));
      root.append(card('Frames on the wall', H('p', { className: 'hint', textContent: 'Each frame can show a picture, a headline or a clip from one of the other tabs, for as long as you like. They fade in and out, lit by the room.' }), list));
    }
    function addShow(fid) { const sh = { id: nid('w'), frame: fid, kind: 'text', text: 'HEADLINE HERE', style: 'paper', start: r2(now()), dur: 6 }; cfg.shows = cfg.shows || []; cfg.shows.push(sh); changed(); return sh; }
    function frameCard(f) {
      const its = (cfg.shows || []).filter(sh => sh.frame === f.id);
      root.append(card(f.name || 'Frame', field('Name', txt(f.name || '', v => { f.name = v; changed(false); }, 'Frame', 'Frame name')),
        H('p', { className: 'hint', textContent: its.length ? 'Shows ' + its.length + ' thing' + (its.length > 1 ? 's' : '') + '. Pick one on the timeline to change it.' : 'Nothing on show yet.' }),
        foot(btn('Show something here at the playhead', () => { const sh = addShow(f.id); hooks.select && hooks.select('W:' + sh.id); }, 'primary'), cfg.mark ? btn('Remove this frame', () => { removeMark(cfg, 'F:' + f.id); changed(); hooks.select && hooks.select(null); }) : '')));
    }
    function showCard(sh) {
      const fr = M.frames, note = H('p', { className: 'hint' }), kids = [field('Frame', sel(sh.frame, fr.map(f => [f.id, f.name || 'Frame']), v => { sh.frame = v; changed(); }, 'Frame')), seg(KINDS, sh.kind || 'pic', v => { sh.kind = v; ch(); })];
      if (sh.kind === 'pic') { const pick = () => { const inp = H('input', { type: 'file', accept: 'image/*' }); inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const im = await Layers.importImage(f); sh.asset = im.id; sh.name = f.name; ch(); } catch (e) { note.textContent = 'That picture could not be read.'; } }; inp.click(); };
        kids.push(H('p', { className: 'hint', textContent: sh.asset ? '🖼 ' + (sh.name || 'Picture') : 'No picture yet.' }), H('div', { className: 'btnrow' }, btn(sh.asset ? 'Change picture' : 'Choose a picture', pick, sh.asset ? '' : 'primary')), field('Fit', seg([['fill', 'Fill the frame'], ['fit', 'Whole picture']], sh.fit || 'fill', v => { sh.fit = v; ch(); }))); }
      else if (sh.kind === 'text') kids.push(field('Headline', area(sh.text || '', v => { sh.text = v; changed(false); }, 'HEADLINE', 3, 'Headline')), field('Small line underneath (optional)', txt(sh.sub || '', v => { sh.sub = v; changed(false); }, '', 'Small line')), field('Look', seg([['paper', 'Newspaper'], ['poster', 'Poster']], sh.style || 'paper', v => { sh.style = v; ch(); })));
      else { const opts2 = Object.keys(NAMES).filter(m => raw(m)).map(m => [m, NAMES[m]]); kids.push(field('From the tab', sel(sh.mod || 'charts', opts2, v => { sh.mod = v; changed(); }, 'Tab')), H('div', { className: 'btnrow' }, btn(sh.mcfg ? 'Copy that tab again' : 'Copy what is on that tab now', () => { sh.mod = sh.mod || 'charts'; const c = typeof Video !== 'undefined' && Video.hooks.tabCfg ? Video.hooks.tabCfg(sh.mod) : null; sh.mcfg = JSON.parse(JSON.stringify(c || raw(sh.mod).defaults())); ch(); }, sh.mcfg ? '' : 'primary')),
        H('p', { className: 'hint', textContent: sh.mcfg ? 'Plays the ' + NAMES[sh.mod] + ' clip from its start, in the frame.' : 'Make the clip in its own tab first, then copy it in here.' }), field('Start part way in (seconds)', num(+sh.inPt || 0, v => { sh.inPt = r2(v); changed(); }, 0, 600, 0.1, 'Start part way in'))); }
      kids.push(grid2(field('Starts at (seconds)', num(+sh.start || 0, v => { sh.start = r2(v); changed(); }, 0, 3600, 0.1, 'Start')), field('Shows for (seconds)', num(+sh.dur || 6, v => { sh.dur = r2(v); changed(); }, 0.3, 3600, 0.1, 'Length'))), field('Glows like a screen', seg([['0', 'No, lit by the room'], ['1', 'Yes']], sh.glow ? '1' : '0', v => { sh.glow = v === '1'; ch(); })), note, foot());
      root.append(card('In ' + frameName(cfg, sh.frame), ...kids));
    }
    function soundCard() {
      const S0 = cfg.sound = Object.assign({ on: true, vol: 0.8, thunder: true, cars: true }, cfg.sound || {}), note = H('p', { className: 'hint' });
      const make = () => { const d = duration(cfg); return soundData(cfg, null, d); };
      root.append(card('Sound', H('p', { className: 'hint', textContent: 'Thunder that rolls in after each flash, cars going past outside, wind when it snows, and a clunk or buzz when the lights go. No rain. Saved as a WAV to put under your voice in Premiere or After Effects.' }),
        field('Sound', seg([['1', 'On'], ['0', 'Off']], S0.on !== false ? '1' : '0', v => { S0.on = v === '1'; ch(); })),
        S0.on !== false ? H('div', {}, field('Volume', range(S0.vol, 0, 1.5, 0.05, v => { S0.vol = r2(v); }, 'Volume')),
          grid2(field('Thunder', seg([['1', 'On'], ['0', 'Off']], S0.thunder !== false ? '1' : '0', v => { S0.thunder = v === '1'; ch(); })), field('Cars outside', seg([['1', 'On'], ['0', 'Off']], S0.cars !== false ? '1' : '0', v => { S0.cars = v === '1'; ch(); }))),
          H('div', { className: 'btnrow' }, btn('▶ Listen', () => { note.textContent = 'Making the sound…'; setTimeout(() => { const on = listen(make()); note.textContent = on ? 'Playing. Press Listen again to stop.' : ''; }, 20); }), btn('Save the sound (WAV)', () => { note.textContent = 'Making the sound…'; setTimeout(async () => { try { await E.saveBlob(wav(make()), (cfg.room && cfg.room.name ? cfg.room.name.replace(/\.\w+$/, '') : 'studio') + ' sound.wav', [{ description: 'WAV sound', accept: { 'audio/wav': ['.wav'] } }]); note.textContent = 'Saved.'; } catch (e) { note.textContent = ''; } }, 20); }, 'primary')), note) : ''));
    }
  }

  return { id: 'studio', name: 'Studio', ready, BUILTIN, editor, hooks, soundData, wav, form: (root, cfg, changed) => panel(root, cfg, changed, null, null), defaults, duration, draw, drawAt, mediaFor, mediaAt, mediaAtAv, needsMap, blurHint, view, flashAt, flashTimes, lampLevel, loopOf, WEATHER, WX, STINGS, NAMES, modOf, avatarRect, roomBmp, detect, _internals: { hash, rng, wob, pmod, sm, mk, P, onGlass, dbg: () => ({ cloud: cloudBuf.c, rooms: roomCache }) } };
})();

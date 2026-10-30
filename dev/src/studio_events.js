/* Things that happen outside the studio window, for the running gag: a plane into the flats, a failed demolition, a giant
   PatterSquid, a telly out the window, bonfire night gone wrong, a polis chase, a burnt out car, a UFO, a seagull, Scotland's
   summer, the lights in the flats spelling a word, and a lightning strike that knocks the power out.
   Each one is a bar on the Studio timeline and is a pure function of time. The flats can be left in a state (rubble,
   leaning, scaffolding, patched up) that carries on to the next video. Studio draws the room; this draws the events. */
const StudioEvents = (() => {
  const { cl, lerp, rng } = E;
  const TAU = Math.PI * 2;
  const mk = (w, h) => { w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h)); if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const sm = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
  const hash = s => { let h = 2166136261; s = String(s || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pmod = (x, m) => ((x % m) + m) % m;
  const win = (a, a0, a1, f0 = 0.3, f1 = 0.3) => sm((a - a0) / f0) * (1 - sm((a - a1 + f1) / f1));

  const KINDS = [['plane', 'Plane into the flats'], ['demolish', 'Failed demolition'], ['squid', 'Giant PatterSquid'], ['telly', 'Telly out the window'], ['bonfire', 'Bonfire night gone wrong'], ['polis', 'Polis chase'], ['carfire', 'Burnt out car'], ['ufo', 'UFO'], ['gull', 'Seagull'], ['summer', "Scotland's summer"], ['spell', 'Lights spell a word'], ['strike', 'Lightning strike']];
  const LEN = { plane: 16, demolish: 11, squid: 14, telly: 5, bonfire: 12, polis: 11, carfire: 14, ufo: 12, gull: 7, summer: 9, spell: 8, strike: 7 };
  const TOWER = [['standing', 'Standing'], ['rubble', 'A pile of rubble'], ['leaning', 'Leaning'], ['scaffold', 'Covered in scaffolding'], ['patched', 'Patched up']];
  const HINT = {
    plane: 'A plane flies into the big tower block. It burns, then comes down into a pile of rubble. You do not notice. Afterwards the flats are rubble.',
    demolish: 'The council try to blow the flats up. The charges go off, the block drops a bit, wobbles, and is left leaning. Afterwards the flats are leaning.',
    squid: 'A giant PatterSquid rises behind the flats, wraps its tentacles round the block, gives it a squeeze, has a look at you, and slips away.',
    telly: 'Somebody chucks a telly out a window. It sparks when it lands.',
    bonfire: 'A bonfire on the grass with fireworks going up, until one comes straight at your window and goes off on the glass.',
    polis: 'A car speeds past with the polis after it, blue lights going, then the helicopter with its searchlight, which sweeps across your room.',
    carfire: 'A car on the road starts smoking, catches fire and goes up.',
    ufo: 'A flying saucer comes down out of the clouds and beams up a wheelie bin, then shoots off.',
    gull: 'A seagull lands on the ledge outside, stares at you, pecks the glass, screams, and leaves you a present on the window.',
    summer: "The sun comes out for a few seconds. Then it chucks it down with a crack of thunder.",
    spell: 'Every light in the flats goes off and the windows spell out your word, scrolling across the block like a sign.',
    strike: 'Lightning hits the flats. The power goes out across the whole scheme and in your room, then flickers back on.',
  };
  const TINT = { plane: '#c0503a', demolish: '#b07a3a', squid: '#6d4f9a', telly: '#3a7ab0', bonfire: '#d07a2a', polis: '#2f5fd0', carfire: '#c0603a', ufo: '#3a9a6a', gull: '#8a8a8a', summer: '#d0b02a', spell: '#d0902a', strike: '#5b6fd8' };
  const nameOf = k => (KINDS.find(x => x[0] === k) || [, 'Outside'])[1];

  const evs = cfg => (cfg.events || []).filter(e => e && LEN[e.k]).slice().sort((a, b) => (+a.start || 0) - (+b.start || 0));
  const durOf = e => Math.max(0.5, +e.dur || LEN[e.k]);
  // Where we are in an event, in its own seconds (a longer bar plays it slower)
  const phase = (e, t) => { const st = +e.start || 0, d = durOf(e), k = e.k === 'spell' ? 1 : LEN[e.k] / d; return { a: (t - st) * k, k, d, st }; };
  const active = (cfg, t) => evs(cfg).filter(e => t >= (+e.start || 0) && t < (+e.start || 0) + durOf(e));

  /* ---------- The flats over time ---------- */
  const afterOf = (k, s) => k === 'plane' ? 'rubble' : k === 'demolish' ? (s === 'rubble' ? 'rubble' : 'leaning') : s;
  function towerAt(cfg, t) {
    let s = TOWER.some(x => x[0] === cfg.tower) ? cfg.tower : 'standing', act = null;
    for (const e of evs(cfg)) { const st = +e.start || 0; if (t < st) break; if (e.k !== 'plane' && e.k !== 'demolish') continue; const from = s; s = afterOf(e.k, s); if (t < st + durOf(e)) act = { e, from }; }
    return { s, act };
  }
  const LEAN = 4 * Math.PI / 180;
  const PL = { IMP: 3.2, COL: 7.2, COLE: 10.6 }, DM = { BANG: 2.4 };
  const plSink = a => a < PL.COL ? 0 : Math.pow(sm((a - PL.COL) / (PL.COLE - PL.COL)), 1.25) * 1.08;
  function dmRot(a, from) { const k = a - DM.BANG - 0.1; if (k <= 0) return from === 'leaning' ? LEAN : 0; return from === 'leaning' ? LEAN - 6 * Math.PI / 180 * Math.exp(-k * 1.3) * Math.sin(k * 4.5) : LEAN * (1 - Math.exp(-k * 1.6) * Math.cos(k * 5)); }
  // How the big block is drawn right now: still part of the room picture, or cut out and moved (the picture then has it removed)
  function pose(cfg, t) {
    const { s, act } = towerAt(cfg, t), base = act ? act.from : s;
    const P = { state: base, gone: false, draw: false, rot: 0, sink: 0, shake: 0, pile: 0, act, target: base === 'rubble' ? 2 : 1 };
    if (base === 'rubble') { P.gone = true; P.pile = 1; }
    else if (base === 'leaning') { P.gone = true; P.draw = true; P.rot = LEAN; }
    if (act && base !== 'rubble') { const { a } = phase(act.e, t);
      if (act.e.k === 'plane' && a >= PL.COL) { P.gone = true; P.draw = true; P.sink = plSink(a); P.rot += Math.sin(a * 2.3) * 0.012 * sm((a - PL.COL) / 1.5); P.pile = sm((a - PL.COL - 0.3) / (PL.COLE - PL.COL - 0.3)); }
      if (act.e.k === 'demolish' && a >= DM.BANG + 0.1) { P.gone = true; P.draw = true; P.sink = 0.045 * sm((a - DM.BANG - 0.1) / 0.35); P.rot = dmRot(a, base); P.dust = 1; }
    }
    return P;
  }

  /* ---------- Little pictures ---------- */
  const SPR = {};
  function glow(col) { const k = 'g' + col; if (SPR[k]) return SPR[k]; const c = mk(96, 96), g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, col); gr.addColorStop(0.2, col.replace(/[\d.]+\)$/, m => String(+m.slice(0, -1) * 0.55) + ')')); gr.addColorStop(0.55, col.replace(/[\d.]+\)$/, m => String(+m.slice(0, -1) * 0.12) + ')')); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return (SPR[k] = c); }
  // Value noise, for smoke, dust and flames that look like the real thing rather than round blobs
  function vnoise(seed) { const r = rng(seed), N = 64, L2 = new Float32Array(N * N); for (let i = 0; i < N * N; i++) L2[i] = r();
    return (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, at = (i, j) => L2[((j & 63) << 6) + (i & 63)], sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy); }; }
  const fbm = (n, x, y, o = 4) => { let s = 0, a = 0.5, t = 0; for (let k = 0; k < o; k++) { s += n(x, y) * a; t += a; x *= 2.03; y *= 2.03; a *= 0.5; } return s / t; };
  // Four billowy puffs of smoke or dust, lit a little from above
  function puffs(rgb) { const k = 'ps' + rgb; if (SPR[k]) return SPR[k]; const [R0, G0, B0] = rgb.split(',').map(Number), out = [];
    for (let vv = 0; vv < 4; vv++) { const N = 112, c = mk(N, N), g = c.getContext('2d'), id = g.createImageData(N, N), d = id.data, nz = vnoise(77 + vv * 13), r = rng(5 + vv), ox = r() * 40, oy = r() * 40;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = (x - N / 2) / (N / 2), dy = (y - N / 2) / (N / 2), dd = Math.sqrt(dx * dx + dy * dy * 1.15); if (dd >= 1) continue;
        const n = fbm(nz, x / 13 + ox, y / 13 + oy, 4), base = 1 - sm((dd - 0.2) / 0.8), den = cl((n - 0.4) * 2.4 + base * 0.95 - 0.4, 0, 1) * base, lit = 0.74 + 0.36 * (1 - y / N) + 0.3 * (n - 0.5), q = (y * N + x) * 4;
        d[q] = cl(R0 * lit, 0, 255); d[q + 1] = cl(G0 * lit, 0, 255); d[q + 2] = cl(B0 * lit, 0, 255); d[q + 3] = Math.round(235 * den); }
      g.putImageData(id, 0, 0); out.push(c); }
    return (SPR[k] = out); }
  const blob = (ctx, spr, x, y, s, a) => { if (a <= 0.003 || s <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - s, y - s, s * 2, s * 2); };
  const FIRE = () => glow('rgba(255,130,40,0.95)'), CORE = () => glow('rgba(255,236,170,1)'), SMOKE = i => puffs('30,30,36')[pmod(i | 0, 4)], DUST = i => puffs('112,108,106')[pmod(i | 0, 4)];
  // Flames: a little film of fire (noise rising through a flame shape), 16 frames that repeat
  function flameFrames() { if (SPR.fl) return SPR.fl; const W = 40, H = 72, F = 16, out = [], nz = vnoise(321), nz2 = vnoise(99);
    for (let f = 0; f < F; f++) { const c = mk(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x + 0.5 - W / 2) / (W / 2), v = (y + 0.5) / H, wv = 0.1 + 0.9 * Math.pow(v, 0.6) * (1 - 0.3 * v), n = fbm(nz, x / 6, y / 6 + f * 4, 4), n2 = nz2(x / 3, y / 3 + f * 8);
        const edge = Math.abs(u + (n - 0.5) * 0.5 * (1 - v)) / wv; let I = cl(1.05 - edge, 0, 1) * cl(v * 1.7 - 0.12 + (n - 0.5) * 0.9 + (n2 - 0.5) * 0.25, 0, 1); I = Math.pow(I, 0.85); const q = (y * W + x) * 4;
        d[q] = 255 * Math.min(1, I * 2.4); d[q + 1] = 255 * Math.pow(cl(I * 1.7 - 0.35, 0, 1), 1.2) * 0.92; d[q + 2] = 255 * cl(I * 2.2 - 1.5, 0, 1) * 0.8; d[q + 3] = 255 * cl(I * 1.9, 0, 1); }
      g.putImageData(id, 0, 0); out.push(c); }
    return (SPR.fl = out); }
  // A fire: a few flames side by side with a warm glow round them
  function flame(ctx, x, y, s, t, seed, a = 1) {
    if (a <= 0.01) return; const r = rng(seed), F = flameFrames(); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    blob(ctx, FIRE(), x, y - s * 0.5, s * 1.6, 0.35 * a);
    for (let i = 0; i < 3; i++) { const fr = F[pmod(Math.floor(t * 15 + r() * 16), 16)], w = s * (0.9 - i * 0.15) * (0.9 + 0.2 * r()), h = w * 1.9 * (0.85 + 0.15 * Math.sin(t * 7 + i + seed)), dx = (i - 1) * s * 0.35 + (r() - 0.5) * s * 0.2;
      ctx.globalAlpha = Math.min(1, a * (i === 1 ? 1 : 0.8)); ctx.drawImage(fr, x + dx - w / 2, y - h * 0.92, w, h); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // Smoke rising from a point: puffs let go one after another, rising and blowing off to the right
  function plume(ctx, x, y, a, a0, a1, S, seed, opt = {}) {
    const n = opt.n || 40, life = opt.life || 6, every = (a1 - a0) / n, r = rng(seed), kind = opt.dust ? DUST : SMOKE, fade = opt.fade == null ? 1 : opt.fade;
    for (let i = 0; i < n; i++) { const ts = a0 + i * every, k = a - ts, jx = (r() - 0.5) * (opt.w || 10) * S, rise = (opt.rise || 22) * (0.8 + r() * 0.4), sz0 = (opt.s0 || 10) * (0.8 + r() * 0.4), grow = (opt.grow || 9) * (0.8 + r() * 0.4); if (k < 0 || k > life) continue;
      const o = typeof opt.from === 'function' ? opt.from(ts) : [0, 0];
      blob(ctx, kind(i + seed), x + o[0] + jx + (opt.wind || 16) * S * k + 2 * S * k * k, y + o[1] - rise * S * k, (sz0 + grow * k) * S, (opt.alpha || 0.6) * sm(k / 0.4) * (1 - k / life) * fade); }
    ctx.globalAlpha = 1;
  }
  // Bits flung out by a bang: they fly, tumble and fall
  function debris(ctx, x, y, k, S, seed, n, opt = {}) {
    if (k < 0) return; const r = rng(seed), g = (opt.g || 260) * S, floor = opt.floor;
    for (let i = 0; i < n; i++) { const ang = (opt.ang == null ? -Math.PI / 2 : opt.ang) + (r() - 0.5) * (opt.spread || 2.6), sp = (opt.sp || 120) * (0.4 + r()) * S, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, life = (opt.life || 2) * (0.6 + r() * 0.6), sz = (opt.sz || 2.2) * (0.5 + r()) * S;
      if (k > life) continue; let px = x + vx * k, py = y + vy * k + 0.5 * g * k * k; if (floor != null && py > floor) { py = floor; } const a = 1 - sm((k - life * 0.7) / (life * 0.3));
      ctx.save(); ctx.globalAlpha = a; ctx.translate(px, py); ctx.rotate(k * (r() - 0.5) * 14); ctx.fillStyle = opt.col || '#2a2a30'; ctx.fillRect(-sz, -sz * 0.6, sz * 2, sz * 1.2);
      if (opt.hot && k < life * 0.5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (1 - k / (life * 0.5)) * 0.8; ctx.drawImage(FIRE(), -sz * 3, -sz * 3, sz * 6, sz * 6); }
      ctx.restore(); }
  }
  // Sparks: little bright points that fly and fade
  function sparks(ctx, x, y, k, S, seed, n, col, opt = {}) {
    if (k < 0) return; const r = rng(seed), g = (opt.g == null ? 120 : opt.g) * S, spr = glow(col); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { const ang = (opt.ang == null ? 0 : opt.ang) + (opt.spread == null ? TAU : opt.spread) * (r() - (opt.spread == null ? 0 : 0.5)), sp = (opt.sp || 80) * (0.3 + r() * 0.9) * S, life = (opt.life || 1.2) * (0.5 + r() * 0.7); if (k > life) continue;
      const drag = opt.drag || 1.6, f = (1 - Math.exp(-k * drag)) / drag, px = x + Math.cos(ang) * sp * f, py = y + Math.sin(ang) * sp * f + 0.5 * g * k * k, a = (1 - k / life) * (0.6 + 0.4 * Math.sin(k * 40 + i)), s = (opt.sz || 2.2) * S;
      blob(ctx, spr, px, py, s * 2.2, a); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  const rotAbout = (p, c, ang) => { const s = Math.sin(ang), co = Math.cos(ang), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co]; };

  /* ---------- What is left: a pile of rubble, worked out once for the size of the block ---------- */
  function pileSprite(T, S) {
    const W = (T.x1 - T.x0) * 1.4, Hh = (T.x1 - T.x0) * 0.33, q = 2, key = 'pile' + Math.round(W) + ':' + Math.round(Hh); if (SPR[key]) return SPR[key];
    const c = mk(W * q, Hh * q), g = c.getContext('2d'), r = rng(31337); g.scale(q, q);
    const top = x => { const f = x / W * 2 - 1, m = Math.pow(Math.max(0, 1 - f * f), 0.75); return Hh * (1 - m * (0.8 + 0.12 * Math.sin(x * 0.045 / S) * Math.sin(x * 0.017 / S + 1) + 0.04 * Math.sin(x * 0.13 / S))); };
    g.beginPath(); g.moveTo(0, Hh); for (let x = 0; x <= W; x += 2) g.lineTo(x, top(x)); g.lineTo(W, Hh); g.closePath();
    let gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, 'rgb(70,74,92)'); gr.addColorStop(0.5, 'rgb(48,50,64)'); gr.addColorStop(1, 'rgb(30,32,42)'); g.fillStyle = gr; g.fill(); g.save(); g.clip();
    // Lumps of concrete and brick
    for (let i = 0; i < 220; i++) { const x = r() * W, y = top(x) + r() * Hh * 0.9, s = (2 + r() * 6) * S, sh = 46 + r() * 40, warm = r() < 0.2 ? 10 : 0, n = 4 + Math.floor(r() * 3), lit = 1 - (y - top(x)) / Hh * 0.6;
      g.beginPath(); for (let k = 0; k < n; k++) { const an = k / n * TAU + r() * 0.6, rr = s * (0.6 + r() * 0.5); g[k ? 'lineTo' : 'moveTo'](x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.7); } g.closePath();
      g.fillStyle = `rgb(${Math.round((sh + warm) * lit)},${Math.round((sh + 2 + warm * 0.5) * lit)},${Math.round((sh + 18) * lit)})`; g.fill(); g.strokeStyle = 'rgba(15,15,20,0.35)'; g.lineWidth = 0.6 * S; g.stroke(); }
    g.restore();
    // Slabs of floor sticking out, bent bars, a window frame with the light still on
    for (let i = 0; i < 7; i++) { const x = W * (0.18 + r() * 0.64), y = top(x) + 5 * S, l = (16 + r() * 22) * S, an = (r() - 0.5) * 1.1; g.save(); g.translate(x, y); g.rotate(an); g.fillStyle = 'rgb(66,66,78)'; g.fillRect(-l / 2, -2.5 * S, l, 4 * S); g.fillStyle = 'rgb(84,84,98)'; g.fillRect(-l / 2, -2.5 * S, l, 1.1 * S); g.restore(); }
    g.strokeStyle = 'rgba(40,30,28,0.9)'; g.lineWidth = 1 * S; for (let i = 0; i < 12; i++) { const x = W * (0.12 + r() * 0.76), y = top(x) + 3 * S; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 16 * S, y - (6 + r() * 12) * S, x + (r() - 0.5) * 22 * S, y - (10 + r() * 14) * S); g.stroke(); }
    const wx = W * 0.58, wy = top(W * 0.58) + 10 * S; g.save(); g.translate(wx, wy); g.rotate(-0.35); g.fillStyle = 'rgb(255,196,120)'; g.fillRect(-4 * S, -3 * S, 8 * S, 6 * S); g.strokeStyle = 'rgb(40,36,40)'; g.lineWidth = 1.4 * S; g.strokeRect(-4 * S, -3 * S, 8 * S, 6 * S); g.restore();
    // Soft like the photo, and fading out at the bottom where it sits behind the trees and roofs in front
    const o = mk(c.width, c.height), og = o.getContext('2d'); og.filter = 'blur(' + (0.7 * q * S).toFixed(2) + 'px)'; og.drawImage(c, 0, 0); og.filter = 'none'; og.globalCompositeOperation = 'destination-in'; const fd = og.createLinearGradient(0, 0, 0, c.height); fd.addColorStop(0, '#000'); fd.addColorStop(0.72, '#000'); fd.addColorStop(1, 'rgba(0,0,0,0)'); og.fillStyle = fd; og.fillRect(0, 0, c.width, c.height);
    return (SPR[key] = { c: o, w: W, h: Hh, glow: [wx, wy] });
  }
  function drawPile(X, amt, T) {
    if (amt <= 0) return; const { ctx, S, t, L } = X, P = pileSprite(T, S), x = (T.x0 + T.x1) / 2 - P.w / 2, h = P.h * amt, y = T.base + 2 * S - h;
    ctx.drawImage(P.c, x, y, P.w, h);
    if (amt > 0.9) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,180,90,0.7)'), x + P.glow[0], y + P.glow[1] * amt, 9 * S, 0.45 + 0.1 * Math.sin(TAU * 3 * t / L));
      // Embers still glowing here and there
      const r = rng(77); for (let i = 0; i < 7; i++) { const ex = x + P.w * (0.2 + r() * 0.6), ey = y + h * (0.25 + r() * 0.5), q = 0.5 + 0.5 * Math.sin(TAU * (1 + Math.floor(r() * 3)) * t / L + r() * TAU); blob(ctx, glow('rgba(255,110,40,0.8)'), ex, ey, (3 + r() * 3) * S, 0.25 * q); }
      ctx.restore(); }
  }
  // Wisps still rising off the rubble, repeating with the studio loop
  function pileSmoke(X, T) { const { ctx, S, t, L } = X, n = 14, life = L / 2;
    for (let i = 0; i < n; i++) { const r = rng(900 + i), x = lerp(T.x0, T.x1, 0.15 + r() * 0.7), k = pmod(t / life + i / n, 1) * life * 0.6; blob(ctx, SMOKE(i), x + 14 * S * k + (r() - 0.5) * 8 * S, T.base - 30 * S - 18 * S * k, (8 + 7 * k) * S, 0.3 * sm(k / 1.2) * (1 - k / (life * 0.6))); }
    ctx.globalAlpha = 1; }

  /* ---------- The block itself: cut out of the room and moved, with whatever has been done to it ---------- */
  function drawTower(X, P) {
    const { ctx, T, kit, S } = X; if (!T) return; const H = T.base - T.top, piv = [T.x1, T.base];
    const dressed = () => { if (P.state === 'scaffold') scaffold(X, T); if (P.state === 'patched') patched(X, T); };
    if (P.draw && kit) {
      ctx.save(); ctx.beginPath(); ctx.rect(T.x0 - H, T.top - H, H * 3, H + T.base - T.top + 1 * S); ctx.clip();
      ctx.translate(piv[0], piv[1]); ctx.rotate(P.rot); ctx.translate(-piv[0] + P.shake * S, -piv[1] + P.sink * H);
      ctx.drawImage(kit.c, kit.x, kit.y, kit.w, kit.h); dressed(); ctx.restore();
    } else if (!P.gone) dressed();
    if (P.state === 'leaning' && !P.act) prop(X, T, P);
    if (P.pile > 0 && kit) stump(X, T, P.pile);
    if (P.pile > 0) drawPile(X, P.pile, T);
    if (P.state === 'rubble' && !P.act) pileSmoke(X, T);
  }
  // The bottom few floors still standing, broken off jagged
  function stump(X, T, amt) { const { ctx, S, kit } = X, H = T.base - T.top, r = rng(5150), y0 = T.base - H * 0.42; ctx.save(); ctx.globalAlpha = sm(amt / 0.4); ctx.beginPath(); ctx.moveTo(T.x0 - 2, T.base + 2); let x = T.x0 - 2; ctx.lineTo(x, y0 + H * 0.06);
    while (x < T.x1) { x += (5 + r() * 12) * S; const f = Math.abs(x - (T.x0 + T.x1) / 2) / (T.x1 - T.x0); ctx.lineTo(Math.min(x, T.x1 + 2), y0 + (r() - 0.3) * H * 0.09 + f * f * H * 0.5); } ctx.lineTo(T.x1 + 2, T.base + 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(kit.c, kit.x, kit.y, kit.w, kit.h); ctx.fillStyle = 'rgba(10,12,20,0.45)'; ctx.fillRect(T.x0 - 4, y0 - H * 0.1, T.x1 - T.x0 + 8, H * 0.6); ctx.restore(); }
  // A plank of wood holding the leaning block up
  function prop(X, T, P) { const { ctx, S } = X, H = T.base - T.top, top = rotAbout([T.x1, T.top + H * 0.5], [T.x1, T.base], P.rot), foot = [T.x1 + H * 0.3, T.base + 2 * S];
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgb(58,42,30)'; ctx.lineWidth = 6 * S; ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(top[0], top[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(120,90,60,0.35)'; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(foot[0] - 1.5 * S, foot[1] - 1 * S); ctx.lineTo(top[0] - 1.5 * S, top[1] - 1 * S); ctx.stroke();
    // A traffic cone at its foot, for safety
    ctx.fillStyle = 'rgb(150,70,30)'; ctx.beginPath(); ctx.moveTo(foot[0] + 10 * S, foot[1] - 12 * S); ctx.lineTo(foot[0] + 15 * S, foot[1]); ctx.lineTo(foot[0] + 5 * S, foot[1]); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(230,230,230,0.8)'; ctx.fillRect(foot[0] + 7.4 * S, foot[1] - 6 * S, 5.2 * S, 1.6 * S); ctx.restore(); }
  function scaffold(X, T) { const { ctx, S, t, L } = X, H = T.base - T.top; ctx.save();
    ctx.fillStyle = 'rgba(30,60,45,0.25)'; ctx.fillRect(T.x0 - 4 * S, T.top + H * 0.02, (T.x1 - T.x0) * 0.55, H * 0.4);
    ctx.strokeStyle = 'rgba(150,140,120,0.55)'; ctx.lineWidth = 1.1 * S; ctx.beginPath();
    for (let x = T.x0 - 4 * S; x <= T.x1 + 5 * S; x += 21 * S) { ctx.moveTo(x, T.top - 6 * S); ctx.lineTo(x, T.base); }
    for (let y = T.top + 8 * S; y <= T.base; y += 23 * S) { ctx.moveTo(T.x0 - 6 * S, y); ctx.lineTo(T.x1 + 6 * S, y); }
    for (let y = T.top + 8 * S, i = 0; y + 23 * S <= T.base; y += 23 * S, i++) { const x = T.x0 - 4 * S + (i % 6) * 42 * S; ctx.moveTo(x, y); ctx.lineTo(x + 42 * S, y + 23 * S); }
    ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,160,40,0.9)'), T.x1 + 4 * S, T.top - 6 * S, 7 * S, Math.sin(TAU * Math.round(L) * t / L) > 0.3 ? 0.9 : 0.1); ctx.restore(); ctx.globalAlpha = 1; }
  function patched(X, T) { const { ctx, S } = X, H = T.base - T.top, y1 = T.top + H * 0.33; ctx.save();
    ctx.fillStyle = 'rgba(92,76,70,0.95)'; ctx.fillRect(T.x0 + 1 * S, T.top + 2 * S, T.x1 - T.x0 - 2 * S, y1 - T.top);
    ctx.fillStyle = 'rgba(36,32,36,0.9)'; for (let y = T.top + 10 * S; y < y1 - 8 * S; y += 18 * S) for (let x = T.x0 + 9 * S; x < T.x1 - 10 * S; x += 23 * S) ctx.fillRect(x, y, 11 * S, 8 * S);
    ctx.fillStyle = 'rgba(255,200,130,0.8)'; [[2, 1], [7, 0], [4, 3], [9, 2]].forEach(([c, rr]) => ctx.fillRect(T.x0 + 9 * S + c * 23 * S, T.top + 10 * S + rr * 18 * S, 11 * S, 8 * S));
    // The join, and a big strip of tape across a crack lower down
    ctx.fillStyle = 'rgba(30,26,28,0.8)'; ctx.fillRect(T.x0, y1 - 1 * S, T.x1 - T.x0, 2.5 * S);
    ctx.translate((T.x0 + T.x1) / 2, T.top + H * 0.55); ctx.rotate(-0.5); ctx.fillStyle = 'rgba(130,132,140,0.7)'; ctx.fillRect(-60 * S, -4 * S, 120 * S, 8 * S); ctx.rotate(1); ctx.fillRect(-60 * S, -4 * S, 120 * S, 8 * S); ctx.restore(); }

  /* ---------- The events ---------- */
  // A plane at night, side on, nose at (0,0) pointing along +x, length L: mostly a dark shape, lit along the top by the sky,
  // with its cabin windows, landing lights blazing and the red and white lights flashing. No markings.
  function plane(ctx, L, t) { const h = L * 0.13;
    ctx.fillStyle = 'rgb(20,23,32)'; ctx.beginPath(); ctx.moveTo(-L * 0.56, h * 0.2); ctx.lineTo(-L * 0.38, h * 0.2); ctx.lineTo(-L * 0.62, h * 1.9); ctx.lineTo(-L * 0.72, h * 1.9); ctx.closePath(); ctx.fill();
    let gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, 'rgb(84,92,116)'); gr.addColorStop(0.35, 'rgb(46,51,66)'); gr.addColorStop(1, 'rgb(22,24,34)'); ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(0, h * 0.1); ctx.quadraticCurveTo(-L * 0.02, -h * 0.5, -L * 0.12, -h * 0.5); ctx.lineTo(-L * 0.9, -h * 0.5); ctx.lineTo(-L, -h * 0.25); ctx.lineTo(-L, h * 0.15); ctx.lineTo(-L * 0.12, h * 0.5); ctx.quadraticCurveTo(-L * 0.02, h * 0.5, 0, h * 0.1); ctx.fill();
    gr = ctx.createLinearGradient(0, -h * 2.2, 0, -h * 0.4); gr.addColorStop(0, 'rgb(70,78,100)'); gr.addColorStop(1, 'rgb(34,38,52)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-L * 0.8, -h * 0.5); ctx.lineTo(-L * 0.9, -h * 2.2); ctx.lineTo(-L * 1.0, -h * 2.2); ctx.lineTo(-L * 0.97, -h * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgb(28,30,42)'; ctx.beginPath(); ctx.moveTo(-L * 0.42, h * 0.2); ctx.lineTo(-L * 0.62, h * 0.2); ctx.lineTo(-L * 0.78, h * 1.25); ctx.lineTo(-L * 0.7, h * 1.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgb(34,37,50)'; ctx.beginPath(); ctx.ellipse(-L * 0.5, h * 0.72, L * 0.075, h * 0.34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,150,0.8)'; for (let x = -L * 0.16; x > -L * 0.86; x -= L * 0.036) { ctx.fillRect(x, -h * 0.17, L * 0.012, h * 0.16); }
    ctx.globalCompositeOperation = 'lighter';
    // Landing lights: a hard glare with a streak, the brightest thing out there
    blob(ctx, glow('rgba(255,250,235,1)'), -L * 0.04, h * 0.42, L * 0.42, 0.75); blob(ctx, glow('rgba(255,255,255,1)'), -L * 0.04, h * 0.42, L * 0.12, 1); blob(ctx, glow('rgba(255,250,235,1)'), -L * 0.55, h * 0.5, L * 0.18, 0.6);
    ctx.globalAlpha = 0.35; ctx.fillStyle = 'rgb(255,250,235)'; ctx.fillRect(-L * 0.6, h * 0.38, L * 1.2, Math.max(0.5, h * 0.06)); ctx.globalAlpha = 1;
    if (pmod(t, 1.1) < 0.06) blob(ctx, glow('rgba(255,255,255,1)'), -L, -h * 0.2, L * 0.12, 1); blob(ctx, glow('rgba(255,40,40,0.95)'), -L * 0.74, h * 1.3, L * 0.06, 0.6 + 0.4 * Math.sin(t * 6)); if (pmod(t + 0.5, 1.1) < 0.06) blob(ctx, glow('rgba(255,255,255,1)'), -L * 0.74, h * 1.3, L * 0.1, 1);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  function evPlane(X, e, P, front) {
    const { ctx, S, t } = X, { a } = phase(e, t), T = P.target === 1 ? X.T : X.T2; if (!T || !front) return; const H = T.base - T.top, Q = X.Q;
    const pI = [T.x0 + 2 * S, T.top + H * 0.3], p0 = [Math.min(Q[0][0], Q[3][0]) - 150 * S, pI[1] - 70 * S], sink = P.target === 1 ? plSink(a) * H : 0;
    // A steady straight run in, slightly nose down; it keeps going into the block (hidden behind its edge) rather than vanishing
    { const L = 112 * S, vx = (pI[0] - p0[0]) / PL.IMP, vy = (pI[1] - p0[1]) / PL.IMP, inside = (L + 20 * S) / vx; if (a < PL.IMP + inside) { const x = p0[0] + vx * a, y = p0[1] + vy * a + Math.sin(a * 1.7) * 1.2 * S, ang = Math.atan2(vy, vx);
      ctx.save(); ctx.beginPath(); ctx.rect(-1e5, -1e5, 1e5 + T.x0 + 2 * S, 2e5); ctx.clip(); ctx.translate(x, y); ctx.rotate(ang); plane(ctx, L, t); ctx.restore(); } }
    const k = a - PL.IMP; if (k < 0) return;
    // Fires burning across the floors it went into, coming down with the block
    const r = rng(hash(e.id) + 3), fire = sm((k - 0.9) / 1.0) * (P.target === 1 ? 1 - sm((a - PL.COL - 1.2) / 1.6) : 1 - sm((a - 14.5) / 1.5));
    if (pI[1] + sink < T.base - 8 * S && fire > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 * fire * (0.8 + 0.2 * Math.sin(t * 13)); ctx.drawImage(FIRE(), T.x0 - 30 * S, pI[1] + sink - 60 * S, T.x1 - T.x0 + 60 * S, 100 * S); ctx.restore(); ctx.globalAlpha = 1; }
    // Fire in the windows of the floors it went into: some windows glowing, flames licking out of others, spreading over time
    { const rr = rng(hash(e.id) + 41), G = T.grid, cols = G ? G.cols : 9, rows0 = G ? Math.round((pI[1] - G.y0) / ((G.y1 - G.y0) / G.rows)) : 0, cw = G ? (G.x1 - G.x0) / G.cols : (T.x1 - T.x0) / 9, ch = G ? (G.y1 - G.y0) / G.rows : 22 * S;
      for (let rI = -2; rI <= 2; rI++) for (let c = 0; c < cols; c++) { const born = 1.0 + Math.abs(rI) * 0.9 + Math.abs(c - cols * (0.2 + 0.6 * rr())) * 0.12 + rr() * 0.8, f = fire * sm((k - born) / 0.8), big = rr(); if (f <= 0.01 || (Math.abs(rI) === 2 && big < 0.6)) continue;
        const x = G ? lerp(G.x0, G.x1, (c + 0.5) / cols) : lerp(T.x0, T.x1, (c + 0.5) / cols), y = (G ? G.y0 + (rows0 + rI + 0.5) * ch : pI[1] + rI * ch) + sink; if (y > T.base - 8 * S) continue;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f * (0.6 + 0.4 * Math.sin(t * (6 + big * 5) + c)); ctx.fillStyle = 'rgb(255,120,30)'; ctx.fillRect(x - cw * 0.3, y - ch * 0.25, cw * 0.6, ch * 0.5); blob(ctx, FIRE(), x, y, cw * 0.9, f * 0.5); ctx.restore();
        if (big > 0.45) flame(ctx, x, y - ch * 0.15, cw * (0.5 + big * 0.7) * (0.7 + 0.3 * sm((k - born) / 2)), t + c * 0.37 + rI, c + rI * 31, f); } }
    plume(ctx, (T.x0 + T.x1) / 2, pI[1] - 10 * S, a, PL.IMP + 1.2, P.target === 1 ? PL.COL + 1.4 : 15, S, hash(e.id), { n: 70, life: 7, w: T.x1 - T.x0, s0: 18, grow: 13, rise: 22, alpha: 0.9, from: ts => [0, P.target === 1 ? plSink(ts) * H : 0] });
    // The explosion: a flash, then a ball of fire bursting out of the side it went into and out the far side, rolling over and
    // turning to black smoke as it cools. Only after that do the floors catch fire.
    if (k < 4) { const rr = rng(hash(e.id) + 9), FP = puffs('255,150,60'), fl = 1 - sm(k / 0.25);
      if (fl > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, CORE(), pI[0], pI[1], 160 * S * (0.4 + k * 3), fl); ctx.restore(); }
      for (let i = 0; i < 70; i++) { const side = i < 44 ? -1 : 1, dl = side > 0 ? 0.14 : 0, kk = k - dl - rr() * 0.18, an = side < 0 ? Math.PI + (rr() - 0.5) * 3.2 : (rr() - 0.5) * 2.8, sp = (70 + rr() * 210) * S, sz0 = (10 + rr() * 20) * S, ox = side < 0 ? pI[0] : T.x1 - 2 * S, oy = pI[1] + (rr() - 0.5) * 16 * S; if (kk < 0) continue;
        const d = sp * (1 - Math.exp(-kk * 3)) / 3, x = ox + Math.cos(an) * d + 16 * S * kk, y = oy + Math.sin(an) * d * 0.7 - 20 * S * Math.pow(kk, 1.25), sz = sz0 * (1 + 2.2 * (1 - Math.exp(-kk * 2))), hot = 1 - sm((kk - 0.2) / 1.0);
        if (hot > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, FP[i % 4], x, y, sz, 0.85 * hot); if (kk < 0.5) blob(ctx, CORE(), x, y, sz * 0.7, 0.5 * (1 - kk / 0.5)); ctx.restore(); }
        blob(ctx, SMOKE(i), x, y - 4 * S, sz * 1.15, 0.55 * sm((kk - 0.3) / 0.7) * (1 - sm((kk - 2.4) / 1.6))); }
      ctx.globalAlpha = 1;
      debris(ctx, pI[0], pI[1], k, S, hash(e.id) + 9, 30, { ang: Math.PI, spread: 2.2, sp: 120, hot: true, life: 2.6, floor: T.base }); debris(ctx, T.x1, pI[1], k - 0.14, S, hash(e.id) + 19, 24, { ang: 0, spread: 2, sp: 130, hot: true, life: 2.6, floor: T.base }); }
    // Coming down: dust rolling out from the bottom, bits breaking off the top
    if (P.target === 1 && a >= PL.COL) { const r2 = rng(hash(e.id) + 99), end = 1 - sm((a - 11.5) / 4.5);
      for (let i = 0; i < 90; i++) { const side = i % 2 ? 1 : -1, x0 = lerp(T.x0, T.x1, r2()), y0 = T.base - r2() * 20 * S, ts = PL.COL + 0.1 + r2() * 3.4, kk = a - ts, vx = side * (20 + r2() * 110) * S, up = (6 + r2() * 30) * S, sz = (14 + r2() * 34) * S; if (kk < 0) continue;
        blob(ctx, DUST(i), x0 + vx * (1 - Math.exp(-kk * 0.9)) / 0.9 + 6 * S * kk, y0 - up * Math.pow(kk, 0.8), sz * (0.6 + 1.5 * (1 - Math.exp(-kk * 0.6))), 0.5 * sm(kk / 0.3) * end * (0.6 + 0.4 * r2())); }
      // Dust where the top is, all the way down
      const r3 = rng(hash(e.id) + 7); for (let i = 0; i < 30; i++) { const ts = PL.COL + i * (PL.COLE - PL.COL) / 30, kk = a - ts; if (kk < 0) continue; const y = T.top + plSink(ts) * H, x = lerp(T.x0, T.x1, r3()); blob(ctx, DUST(i), x + 10 * S * kk, y - 8 * S * kk, (14 + 16 * kk) * S, 0.4 * sm(kk / 0.3) * (1 - sm(kk / 4))); }
      const topY = T.top + plSink(a) * H; if (a < PL.COLE) { debris(ctx, T.x0 + 10 * S, topY, a - PL.COL, S, 5, 14, { ang: -2.4, spread: 1.4, sp: 60, life: 1.6, floor: T.base }); debris(ctx, T.x1 - 10 * S, topY, a - PL.COL - 0.7, S, 6, 14, { ang: -0.7, spread: 1.4, sp: 60, life: 1.6, floor: T.base }); }
      ctx.globalAlpha = 1; }
  }
  function evDemolish(X, e, P, front) {
    const { ctx, S, t } = X, { a } = phase(e, t), T = P.state === 'rubble' ? X.T : X.T; if (!T || !front) return; const H = T.base - T.top, piv = [T.x1, T.base];
    // Warning lights, then the charges going off along the bottom
    if (a < DM.BANG + 0.3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const on = Math.sin(a * TAU * 2) > 0; blob(ctx, glow('rgba(255,40,30,0.95)'), T.x0 - 14 * S, T.base - 6 * S, 7 * S, on ? 1 : 0.15); blob(ctx, glow('rgba(255,40,30,0.95)'), T.x1 + 14 * S, T.base - 6 * S, 7 * S, on ? 0.15 : 1); blob(ctx, glow('rgba(255,170,40,0.95)'), (T.x0 + T.x1) / 2, T.base + 2 * S, 6 * S, 0.5 + 0.5 * Math.sin(a * 20)); ctx.restore(); }
    const r = rng(hash(e.id));
    for (let i = 0; i < 8; i++) { const x = lerp(T.x0 + 8 * S, T.x1 - 8 * S, i / 7), y = T.base - 8 * S - (i % 2) * 30 * S, kk = a - DM.BANG - i * 0.07; if (kk < 0 || kk > 0.6) continue; ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, CORE(), x, y, 16 * S * (1 - kk / 0.6), 1 - kk / 0.6); blob(ctx, FIRE(), x, y, 30 * S, 0.6 * (1 - kk / 0.6)); ctx.restore(); }
    sparks(ctx, (T.x0 + T.x1) / 2, T.base - 10 * S, a - DM.BANG, S, 41, 26, 'rgba(255,200,120,0.9)', { sp: 120, life: 1, g: 200 });
    // Dust rolling out from the bottom
    const end = 1 - sm((a - 8) / 3);
    for (let i = 0; i < 30; i++) { const side = i % 2 ? 1 : -1, x0 = lerp(T.x0, T.x1, r()), ts = DM.BANG + r() * 0.8, kk = a - ts, vx = side * (20 + r() * 60) * S, sz = (16 + r() * 22) * S; if (kk < 0) continue; blob(ctx, DUST(i), x0 + vx * (1 - Math.exp(-kk)) + 5 * S * kk, T.base - 6 * S - (6 + r() * 14) * S * Math.pow(kk, 0.7), sz * (0.6 + (1 - Math.exp(-kk * 0.8))), 0.7 * sm(kk / 0.25) * end); }
    ctx.globalAlpha = 1;
    // A balcony comes off a bit later
    if (P.state !== 'rubble') { const ts = 6.4, kk = a - ts; if (kk > 0) { const p = rotAbout([T.x0 + 18 * S, T.top + H * 0.22], piv, dmRot(ts, P.state)), y = Math.min(T.base, p[1] + 0.5 * 300 * S * kk * kk), land = p[1] + 0.5 * 300 * S * kk * kk >= T.base;
      if (!land) { ctx.save(); ctx.translate(p[0] - 6 * S * kk, y); ctx.rotate(kk * 3); ctx.fillStyle = 'rgb(64,62,72)'; ctx.fillRect(-7 * S, -3 * S, 14 * S, 6 * S); ctx.restore(); }
      else { const kl = kk - Math.sqrt(2 * (T.base - p[1]) / (300 * S)); for (let i = 0; i < 6; i++) blob(ctx, DUST(i), p[0] - 6 * S * kk + (i - 2.5) * 6 * S, T.base - 6 * S - 10 * S * kl, (8 + 10 * kl) * S, 0.5 * (1 - sm(kl / 2))); ctx.globalAlpha = 1; } } }
  }
  /* The squid: his own PatterSquid. Its head (cut from his logo, lit for the night) rises up behind the big block and peers
     over the roof. Its arms come out from behind and wind round the block in a spiral, in front across the face of it and
     behind it at the sides, then squeeze (the block rocks), let go, and slide back as the head sinks away. The head moves as
     one piece (a slow bob, a tilt, a breath, blinks), and the arms are smooth tapered tubes shaded like the logo. */
  const SQ = { eyes: [[103, 137], [192, 137]], er: 23, rows: 240 };
  const squidGrip = a => win(a, 5, 8.4, 0.7, 0.8);
  function squidLit(bmp) { if (SPR.sq && SPR.sq.src === bmp) return SPR.sq; const W = bmp.width, H = Math.min(bmp.height, SQ.rows), c = mk(W, H), g = c.getContext('2d'); g.drawImage(bmp, 0, 0, W, H, 0, 0, W, H);
    g.globalCompositeOperation = 'multiply'; let gr = g.createLinearGradient(0, 0, W * 0.3, H); gr.addColorStop(0, 'rgb(160,168,200)'); gr.addColorStop(1, 'rgb(108,114,146)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-atop'; gr = g.createLinearGradient(W, 0, W * 0.5, 0); gr.addColorStop(0, 'rgba(10,12,24,0.35)'); gr.addColorStop(1, 'rgba(10,12,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(bmp, 0, 0, W, H, 0, 0, W, H); return (SPR.sq = { c, src: bmp }); }
  const ease = x => { x = cl(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  function squidState(a) {
    const rise = ease(a / 2.8) * (1 - ease((a - 11.2) / 2.4)), grip = squidGrip(a);
    const arm = (t0, t1) => ease((a - t0) / (t1 - t0)) * (1 - ease((a - 10.2 - (t0 - 2) * 0.4) / 1.8));
    return { rise, grip, arms: [arm(2.0, 4.4), arm(2.5, 4.9), arm(3.1, 5.3)], look: sm((a - 8.5) / 0.4) * (1 - sm((a - 10.6) / 0.4)),
      blink: Math.max(win(a, 6.4, 6.62, 0.07, 0.07), win(a, 9.0, 9.22, 0.07, 0.07), win(a, 9.45, 9.67, 0.07, 0.07)), alpha: sm(a / 0.5) * (1 - sm((a - 13.4) / 0.5)) };
  }
  // A path round the block: from behind the middle, out round one side, across the front, round the other side and on
  const ARMS = [{ dir: 1, y0: 0.03, turns: 1.05, pitch: 0.4, w0: 30 }, { dir: -1, y0: 0.14, turns: 1.0, pitch: 0.44, w0: 27 }, { dir: 1, y0: 0.4, turns: 0.85, pitch: 0.42, w0: 23 }];
  /* An arm's path: round the block in a loose spiral that is never quite regular (it bulges off the walls and sags across
     the front), with slow waves running down it from the root, the grip tightening from the root outwards, and the free end
     curling up and over on itself, feeling about as it reaches round */
  function armPath(T, A, a, S, grip, N, rev, j) {
    const cx = (T.x0 + T.x1) / 2, H = T.base - T.top, pts = [], end = Math.max(0.02, rev), curlL = Math.min(0.2, end * 0.5);
    for (let i = 0; i <= N; i++) { const s = i / N, g = grip * sm((grip * 1.3 - s * 0.6) / 0.4 + 0.5), loose = 1 - 0.75 * g;
      const th = Math.PI + A.dir * (s * A.turns * TAU + 0.22 * Math.sin(s * 4.2 + a * 0.55 + j * 2.1) * loose);
      const hw = (T.x1 - T.x0) / 2 + (6 + 5 * Math.sin(s * 6.5 - a * 0.8 + j) * loose - 4.5 * g) * S, u = Math.sin(th), front = Math.cos(th);
      // Waves travelling down the arm, bigger towards the end, settling as it grips
      const amp = (2.5 + 9 * s) * S * loose, wv = Math.sin(a * 1.9 - s * 11 + j * 1.7) * amp, wv2 = Math.sin(a * 1.13 - s * 5 + j) * amp * 0.6;
      let x = cx + hw * (u + 0.08 * u * u * u) + wv2 * front * 0.6, y = T.top + H * (A.y0 + s * A.turns * A.pitch + 0.035 * Math.sin(s * 3.1 + a * 0.4 + j)) + Math.max(0, front) * (12 + 6 * loose) * S + wv;
      // The free end lifts off and curls round, moving all the time
      const c = (s - (end - curlL)) / curlL; if (c > 0) { const cc = Math.min(1, c), ph = cc * cc * (3 + 0.7 * Math.sin(a * 1.6 + j * 2)) + 0.3 * Math.sin(a * 2.3 + j), r = (16 - 6 * cc) * S * (A.w0 / 26);
        x += A.dir * -Math.sin(ph) * r * 0.9 * (front > 0 ? 1 : 0.6); y += -(1 - Math.cos(ph)) * r; }
      pts.push({ x, y, front: front > 0, s, g }); }
    return pts;
  }
  const notTower = (ctx, T) => { ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 2e5); T.p.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip('evenodd'); };
  function drawArms(ctx, T, st, a, S, front) {
    ARMS.forEach((A, j) => { const rev = st.arms[j]; if (rev <= 0.005) return; const N = 160, pts = armPath(T, A, a, S, st.grip, N, rev, j), m = Math.max(2, Math.floor(N * rev)), thick = 1;
      const wAt = i => { const s = i / N, tip = cl((m - i) / (N * 0.14), 0, 1); return A.w0 * S * (1 + 0.14 * pts[i].g) * (1 + 0.07 * Math.sin(a * 3.1 - s * 13 + j)) * (1 - 0.6 * s) * (0.2 + 0.8 * Math.sqrt(tip)); };
      const segs = []; for (let i = 0; i < m; i++) if (pts[i].front === front) segs.push(i); if (!segs.length) return;
      const pass = (col, wk, dy, alpha) => { ctx.strokeStyle = col; ctx.globalAlpha = alpha * st.alpha; segs.forEach(i => { const p = pts[i], q = pts[i + 1], w = wAt(i); ctx.lineWidth = Math.max(0.6, w * (wk === 1.18 ? 1 : wk) + (wk === 1.18 ? 1.6 * S : 0)); ctx.beginPath(); ctx.moveTo(p.x, p.y + dy * w); ctx.lineTo(q.x, q.y + dy * w); ctx.stroke(); }); };
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (front) { pass('rgb(22,24,36)', 1.18, 0, 0.55); pass('rgb(126,130,150)', 1, 0, 1); pass('rgb(92,96,118)', 0.55, 0.22, 0.85); pass('rgb(150,154,174)', 0.5, -0.12, 0.7); pass('rgb(184,188,206)', 0.22, -0.26, 0.7);
        // Suckers along the underside, like the logo: pale rings with a dark middle
        for (let k = 6; k < m - 4; k += 7) { if (!pts[k].front) continue; const p = pts[k], w = wAt(k), r = Math.max(0.8, w * 0.17); ctx.globalAlpha = st.alpha; ctx.fillStyle = 'rgb(170,172,188)'; ctx.beginPath(); ctx.arc(p.x, p.y + w * 0.3, r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgb(40,40,54)'; ctx.beginPath(); ctx.arc(p.x, p.y + w * 0.3, r * 0.5, 0, TAU); ctx.fill(); } }
      else { pass('rgb(26,28,42)', 1.18, 0, 0.9); pass('rgb(98,104,130)', 1, 0, 1); pass('rgb(140,146,170)', 0.3, -0.24, 0.6); }
      ctx.restore(); ctx.globalAlpha = 1; });
  }
  function evSquid(X, e, P, part) {
    const { ctx, S, t } = X, { a } = phase(e, t), T = P.target === 1 ? X.T : (X.T2 || X.T); if (!T || !X.squid) return; const st = squidState(a);
    if (part === 'back') {
      const sq = squidLit(X.squid), M = X.T || T, k = (M.x1 - M.x0) * 0.74 / sq.c.width, hw = sq.c.width * k, hh = sq.c.height * k, cx = (T.x0 + T.x1) / 2 + 4 * S;
      const by = lerp(T.top + hh + 12 * S, T.top + hh * 0.2, st.rise) + Math.sin(a * 1.15) * 2.2 * S, tilt = Math.sin(a * 0.62) * 0.035 + st.grip * Math.sin(a * 6.3) * 0.01, br = 1 + 0.012 * Math.sin(a * 1.9) - 0.03 * st.grip;
      ctx.save(); notTower(ctx, T); ctx.globalAlpha = st.alpha;
      ctx.save(); ctx.translate(cx, by); ctx.rotate(tilt); ctx.scale(1 + (1 - br) * 0.6, br); ctx.drawImage(sq.c, -hw / 2, -hh, hw, hh);
      // Eyes: blinking with the skin above them, a wet catch light that turns to you when it looks
      SQ.eyes.forEach(([ex, ey]) => { const X0 = -hw / 2 + ex * k, Y0 = -hh + ey * k, r = SQ.er * k;
        if (st.blink > 0.01) { ctx.save(); ctx.beginPath(); ctx.arc(X0, Y0, r * 1.07, 0, TAU); ctx.clip(); ctx.drawImage(sq.c, ex - SQ.er, ey - SQ.er * 3.1, SQ.er * 2, SQ.er * 2, X0 - r * 1.1, Y0 - r * 3.3 + r * 2.2 * st.blink, r * 2.2, r * 2.2); ctx.restore(); }
        const g = 1 - st.blink, lx = lerp(-0.35 + Math.sin(a * 0.5) * 0.15, 0, st.look), ly = lerp(-0.32, -0.05, st.look); if (g > 0.05) { ctx.globalAlpha = st.alpha * 0.8 * g; ctx.fillStyle = 'rgb(210,220,245)'; ctx.beginPath(); ctx.arc(X0 + lx * r, Y0 + ly * r, r * 0.16, 0, TAU); ctx.fill(); ctx.globalAlpha = st.alpha; } });
      ctx.restore();
      drawArms(ctx, T, st, a, S, false); ctx.restore();
      // City light from below on it
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,150,80,0.5)'), cx, T.top, hw * 0.8, 0.07 * st.alpha * st.rise); ctx.restore(); return; }
    if (part === 'front') drawArms(ctx, T, st, a, S, true);
  }
  // Where the windows are on a block, for the telly and the lit up word
  const cell = (T, c, r) => { const G = T.grid; return [lerp(G.x0, G.x1, (c + 0.5) / G.cols), lerp(G.y0, G.y1, (r + 0.5) / G.rows), (G.x1 - G.x0) / G.cols, (G.y1 - G.y0) / G.rows]; };
  const lightBlock = P => P.target === 1 && P.state !== 'leaning' && !P.gone ? 1 : 2;
  function evTelly(X, e, P, front) {
    const { ctx, S, t } = X, { a } = phase(e, t), T = lightBlock(P) === 1 ? X.T : X.T2; if (!T || !T.grid || !front) return; const [wx, wy, cw, ch] = cell(T, Math.floor(T.grid.cols * 0.62), Math.floor(T.grid.rows * 0.3));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const tv = a < 0.85 ? 0.6 + 0.4 * Math.sin(a * 37) * Math.sin(a * 13) : 0; ctx.fillStyle = `rgba(110,150,255,${0.5 * tv})`; ctx.fillRect(wx - cw * 0.4, wy - ch * 0.3, cw * 0.8, ch * 0.6); blob(ctx, glow('rgba(110,150,255,0.9)'), wx, wy, 22 * S, 0.6 * tv); blob(ctx, glow('rgba(255,220,170,0.9)'), wx, wy, 24 * S, win(a, 0.8, 1.3, 0.05, 0.3)); ctx.restore();
    const k = a - 0.85, g = 300 * S, vx = 34 * S, vy = -46 * S, floor = T.base - 2 * S, tl = (-vy + Math.sqrt(vy * vy + 2 * g * (floor - wy))) / g; if (k < 0) return;
    if (k < tl) { const x = wx + vx * k, y = wy + vy * k + 0.5 * g * k * k; ctx.save(); ctx.translate(x, y); ctx.rotate(k * 5.5); const w = 24 * S, h = 18 * S; ctx.fillStyle = 'rgb(38,38,44)'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = 'rgb(120,170,255)'; ctx.fillRect(-w / 2 + 2 * S, -h / 2 + 2 * S, w - 6 * S, h - 4 * S);
      ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(120,170,255,0.8)'), 0, 0, 22 * S, 0.7); ctx.restore(); ctx.globalAlpha = 1; }
    else { const kl = k - tl, lx = wx + vx * tl; sparks(ctx, lx, floor, kl, S * 1.6, 7, 34, 'rgba(170,210,255,0.95)', { ang: -Math.PI / 2, spread: 2.6, sp: 90, life: 0.9, g: 260 }); ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(140,190,255,0.9)'), lx, floor - 4 * S, 26 * S, (1 - sm(kl / 0.5)) * 0.9); ctx.restore();
      ctx.fillStyle = 'rgb(30,30,36)'; ctx.save(); ctx.translate(lx, floor - 3 * S); ctx.rotate(0.4); ctx.fillRect(-12 * S, -8 * S, 24 * S, 16 * S); ctx.restore(); ctx.globalAlpha = 1; }
  }
  const spot = (X, k) => { const s = X.spots && X.spots[k]; if (s) return [s[0] * X.v.iw, s[1] * X.v.ih]; const Q = X.Q; return [lerp(Q[3][0], Q[2][0], k === 'car' ? 0.45 : 0.25), lerp(Q[0][1], Q[3][1], 0.9)]; };
  const ROCKETS = [[2.0, 0.1, [255, 90, 80]], [3.1, -0.15, [120, 255, 150]], [3.9, 0.35, [255, 210, 110]], [4.9, -0.05, [210, 130, 255]], [5.5, 0.5, [130, 200, 255]]];
  // A firework going off: stars fly out, droop, leave short trails, crackle and fade from colour to orange embers, with a
  // puff of smoke lit by the flash
  function burst(ctx, x, y, k, S, seed, n, rgb) {
    if (k < 0 || k > 3) return; const r = rng(seed), g = 34 * S, drag = 1.7, pos = (vx, vy, kk) => { const f = (1 - Math.exp(-kk * drag)) / drag; return [x + vx * f, y + vy * f + 0.5 * g * kk * kk]; };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    if (k < 0.25) blob(ctx, glow(`rgba(${rgb},1)`), x, y, 70 * S, 0.8 * (1 - k / 0.25));
    for (let i = 0; i < n; i++) { const an = r() * TAU, sp = (110 + r() * 50) * S * (0.85 + 0.15 * Math.sin(an * 3)), vx = Math.cos(an) * sp, vy = Math.sin(an) * sp, life = 1.7 + r() * 0.8; if (k > life) continue;
      const p = pos(vx, vy, k), q = pos(vx, vy, Math.max(0, k - 0.14)), f = k / life, col = f < 0.5 ? rgb : rgb.map((c, j) => Math.round(lerp(c, [255, 150, 60][j], (f - 0.5) * 2))), tw = f > 0.55 ? (Math.sin(k * 60 + i * 7) > 0 ? 1 : 0.2) : 1, al = (1 - sm((f - 0.6) / 0.4)) * tw;
      const lg = ctx.createLinearGradient(q[0], q[1], p[0], p[1]); lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(1, `rgba(${col},${0.8 * al})`); ctx.strokeStyle = lg; ctx.lineWidth = 1.3 * S; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      blob(ctx, glow(`rgba(${col},1)`), p[0], p[1], 3.2 * S, al); }
    ctx.restore(); ctx.globalAlpha = 1;
    // The smoke it leaves, lit by it for a moment
    for (let i = 0; i < 5; i++) { const an = i * 1.3 + seed, d = 30 * S * Math.min(1, k); blob(ctx, SMOKE(i + seed), x + Math.cos(an) * d + 6 * S * k, y + Math.sin(an) * d * 0.6 + 4 * S * k, (24 + 10 * k) * S, 0.22 * sm(k / 0.3) * (1 - k / 3)); }
    ctx.globalAlpha = 1;
  }
  function evBonfire(X, e, P, front, layer) {
    const { ctx, S, t, Q } = X, { a } = phase(e, t), [bx, by] = spot(X, 'green');
    if (layer === 'sky') {
      ROCKETS.forEach(([t0, dx, rgb], i) => { const k = a - t0, top = lerp(Q[0][1], Q[3][1], 0.16 + 0.1 * ((i * 7) % 3) / 2), rise = 1.0, x = bx + dx * 260 * S * cl(k / rise, 0, 1); if (k < 0) return;
        if (k < rise) { const y = lerp(by - 10 * S, top, 1 - Math.pow(1 - k / rise, 1.6)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,220,160,1)'), x, y, 3 * S, 1); for (let j = 1; j < 8; j++) blob(ctx, glow('rgba(255,170,90,0.8)'), x - dx * 260 * S * 0.012 * j, y + j * 6 * S, 2.2 * S, (0.6 - j * 0.07) * (0.6 + 0.4 * Math.sin(t * 40 + j))); ctx.restore(); }
        else burst(ctx, x, top, k - rise, S, 100 + i, 70, rgb); });
      ctx.globalAlpha = 1; return; }
    if (layer === 'world') {
      const f = sm(a / 1.5) * (1 - sm((a - 11) / 1)); flame(ctx, bx, by + 2 * S, 20 * S, t, 3, f); flame(ctx, bx + 11 * S, by + 3 * S, 14 * S, t + 0.37, 5, f * 0.9); flame(ctx, bx - 10 * S, by + 3 * S, 13 * S, t + 0.71, 6, f * 0.85);
      sparks(ctx, bx, by - 24 * S, pmod(a, 1.3), S, Math.floor(a / 1.3), 6, 'rgba(255,190,90,0.9)', { ang: -Math.PI / 2, spread: 1, sp: 40, g: -20, life: 1.3 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,140,60,0.7)'), bx, by, 90 * S, 0.5 * f); ctx.save(); ctx.translate(bx, by + 8 * S); ctx.scale(1, 0.3); blob(ctx, glow('rgba(255,150,70,0.8)'), 0, 0, 70 * S, 0.5 * f); ctx.restore(); ctx.restore();
      plume(ctx, bx, by - 30 * S, a, 0.3, 11.5, S, 77, { n: 40, life: 5, s0: 8, grow: 9, rise: 18, alpha: 0.45, wind: 12 });
      // The one that goes wrong: up a bit, then it turns and comes for the window
      const k = a - 6.2; if (k > 0 && k < 0.6) { const y = by - 10 * S - 90 * S * sm(k / 0.6); ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,220,160,1)'), bx - 20 * S * k, y, 4 * S, 1); for (let j = 1; j < 6; j++) blob(ctx, glow('rgba(255,170,90,0.8)'), bx - 20 * S * k, y + j * 5 * S, 2.4 * S, 0.5 - j * 0.07); ctx.restore(); }
      ctx.globalAlpha = 1; return; }
    if (layer === 'near') { const k = a - 6.8, d = 0.7; if (k < 0 || k >= d) return; const f = k / d, z = Math.pow(f, 2.2), sx = bx - 12 * S, sy = by - 100 * S, tx = lerp(Q[0][0], Q[1][0], 0.45), ty = lerp(Q[0][1], Q[3][1], 0.42), x = lerp(sx, tx, z) + Math.sin(f * 22) * 6 * S * f, y = lerp(sy, ty, z) + Math.cos(f * 17) * 5 * S * f, s = (4 + 60 * z) * S;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,170,90,0.9)'), x, y, s * 2.5, 0.9); blob(ctx, glow('rgba(255,240,200,1)'), x, y, s, 1); sparks(ctx, x, y, 0.15, S * (1 + z * 6), 300 + Math.floor(f * 20), 8, 'rgba(255,200,120,0.9)', { sp: 40, life: 0.3 }); ctx.restore(); ctx.globalAlpha = 1; return; }
    if (layer === 'glass') { const k = a - 7.5; if (k < 0) return; const x = lerp(Q[0][0], Q[1][0], 0.45), y = lerp(Q[0][1], Q[3][1], 0.42), endA = 1 - sm((a - 11) / 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,240,210,1)'), x, y, 260 * S * (1 - Math.exp(-k * 8)), 1 - sm(k / 0.6)); ctx.restore();
      sparks(ctx, x, y, k, S * 2.6, 501, 70, 'rgba(255,90,170,0.95)', { sp: 130, life: 2.2, g: 70, drag: 2.4, sz: 1.6 }); sparks(ctx, x, y, k - 0.05, S * 2.6, 502, 60, 'rgba(120,255,160,0.95)', { sp: 100, life: 2, g: 70, drag: 2.4, sz: 1.6 });
      // A scorch on the glass, fading
      ctx.save(); ctx.globalAlpha = 0.5 * sm(k / 0.2) * endA; const gr = ctx.createRadialGradient(x, y, 0, x, y, 60 * S); gr.addColorStop(0, 'rgba(20,16,14,0.7)'); gr.addColorStop(1, 'rgba(20,16,14,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 60 * S, y - 60 * S, 120 * S, 120 * S); ctx.restore(); }
  }
  // Rain caught in a beam of light: short bright streaks falling inside it
  function beamRain(ctx, poly, t, S, al, seed) { if (al <= 0.01) return; const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), r = rng(seed), H = y1 - y0 + 40 * S;
    ctx.save(); ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const n = Math.round((x1 - x0) * (y1 - y0) / (90 * S * S)); for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), sp = (420 + r() * 200) * S, y = y0 - 20 * S + pmod(r() * H + t * sp, H), len = (7 + r() * 6) * S; ctx.strokeStyle = `rgba(230,236,255,${al * (0.25 + 0.35 * r())})`; ctx.lineWidth = 0.8 * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.15, y - len); ctx.stroke(); }
    ctx.restore(); }
  // A point along the marked road, from 0 to 1
  function roadAt(X, f) { const R = X.road; if (!R || R.length < 2) { const Q = X.Q, y = lerp(Q[0][1], Q[3][1], 0.93); return [[lerp(Q[3][0], Q[2][0], f), y], 0]; }
    const lens = [0]; for (let i = 1; i < R.length; i++) lens.push(lens[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1])); const d = cl(f, 0, 1) * lens[lens.length - 1]; let i = 1; while (i < lens.length - 1 && lens[i] < d) i++; const u = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    return [[lerp(R[i - 1][0], R[i][0], u), lerp(R[i - 1][1], R[i][1], u)], Math.atan2(R[i][1] - R[i - 1][1], R[i][0] - R[i - 1][0])]; }
  function car(ctx, p, ang, S, body, lights, t, polis) { ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang); const L = 22 * S, h = 7 * S;
    ctx.fillStyle = body; ctx.fillRect(-L / 2, -h, L, h * 0.7); ctx.fillRect(-L * 0.25, -h * 1.5, L * 0.5, h * 0.6); ctx.fillStyle = 'rgba(160,175,210,0.25)'; ctx.fillRect(-L / 2, -h, L, h * 0.12); ctx.fillStyle = 'rgba(20,24,34,0.7)'; ctx.fillRect(-L * 0.2, -h * 1.42, L * 0.4, h * 0.42); ctx.fillStyle = 'rgba(12,12,18,0.9)'; ctx.beginPath(); ctx.arc(-L * 0.3, -h * 0.25, 2.4 * S, 0, TAU); ctx.arc(L * 0.3, -h * 0.25, 2.4 * S, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; if (lights) { blob(ctx, glow('rgba(255,245,215,0.95)'), L / 2, -h * 0.6, 5 * S, 1); blob(ctx, glow('rgba(255,245,215,0.6)'), L / 2 + 14 * S, -h * 0.3, 14 * S, 0.35); blob(ctx, glow('rgba(255,50,40,0.9)'), -L / 2, -h * 0.6, 3.5 * S, 0.8);
      // Their reflections in the wet road
      ctx.save(); ctx.scale(1, 3.2); blob(ctx, glow('rgba(255,240,210,0.7)'), L / 2, 1.4 * S, 4 * S, 0.35); blob(ctx, glow('rgba(255,60,40,0.7)'), -L / 2, 1.4 * S, 3 * S, 0.3); ctx.restore(); }
    if (polis) { const on = Math.sin(t * TAU * 3.2 + polis) > 0; blob(ctx, glow('rgba(60,110,255,1)'), on ? -3 * S : 3 * S, -h * 1.6, 16 * S, 1); blob(ctx, glow('rgba(60,110,255,0.8)'), 0, -h, 60 * S, on ? 0.5 : 0.15); ctx.save(); ctx.scale(1, 3); blob(ctx, glow('rgba(60,110,255,0.8)'), 0, 2 * S, 8 * S, on ? 0.45 : 0.1); ctx.restore(); }
    ctx.restore(); ctx.globalAlpha = 1; }
  function evPolis(X, e, P, front) {
    const { ctx, S, t, Q } = X, { a } = phase(e, t); if (!front) return;
    const drive = (t0, dur, body, pol) => { const f = (a - t0) / dur; if (f < 0 || f > 1) return; const [p, ang] = roadAt(X, 1 - f); car(ctx, p, ang + Math.PI, S, body, true, t, pol); };
    drive(0.4, 2.2, 'rgb(50,50,58)', 0); drive(1.3, 2.4, 'rgb(150,152,170)', 1); drive(1.8, 2.5, 'rgb(150,152,170)', 2.4); drive(2.5, 2.6, 'rgb(150,152,170)', 4);
    // The helicopter: in from the left, hovers with its searchlight sweeping, then off to the right
    const x0 = Math.min(Q[0][0], Q[3][0]) - 80 * S, x1 = Math.max(Q[1][0], Q[2][0]) + 80 * S, hx0 = lerp(Q[0][0], Q[1][0], 0.42), hy = lerp(Q[0][1], Q[3][1], 0.2);
    let hxp, hyp; if (a < 3.4) return; if (a < 5.4) { const f = sm((a - 3.4) / 2); hxp = lerp(x0, hx0, f); hyp = hy - 30 * S * (1 - f); } else if (a < 9.4) { hxp = hx0 + Math.sin((a - 5.4) * 0.8) * 30 * S; hyp = hy + Math.sin(a * 1.7) * 3 * S; } else { const f = sm((a - 9.4) / 1.6); hxp = lerp(hx0 + Math.sin(4 * 0.8) * 30 * S, x1, f); hyp = hy - 40 * S * f; }
    const beam = win(a, 5.0, 9.6, 0.3, 0.3); if (beam > 0) { const [g] = roadAt(X, 0.5 + 0.4 * Math.sin((a - 5) * 0.9)), w0 = 3 * S, w1 = 34 * S; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.moveTo(hxp - w0, hyp + 6 * S); ctx.lineTo(hxp + w0, hyp + 6 * S); ctx.lineTo(g[0] + w1, g[1]); ctx.lineTo(g[0] - w1, g[1]); ctx.closePath();
      const gr = ctx.createLinearGradient(hxp, hyp, g[0], g[1]); gr.addColorStop(0, `rgba(235,240,255,${0.38 * beam})`); gr.addColorStop(1, `rgba(235,240,255,${0.1 * beam})`); ctx.fillStyle = gr; ctx.fill(); ctx.save(); ctx.translate(g[0], g[1]); ctx.scale(1, 0.35); blob(ctx, glow('rgba(240,245,255,0.9)'), 0, 0, w1 * 1.4, 0.6 * beam); ctx.restore(); ctx.restore(); beamRain(ctx, [[hxp - w0, hyp + 6 * S], [hxp + w0, hyp + 6 * S], [g[0] + w1, g[1]], [g[0] - w1, g[1]]], t, S, beam, 61); }
    ctx.save(); ctx.translate(hxp, hyp); ctx.fillStyle = 'rgb(22,24,34)'; ctx.beginPath(); ctx.ellipse(0, 0, 13 * S, 6 * S, 0, 0, TAU); ctx.fill(); ctx.fillRect(-30 * S, -2 * S, 20 * S, 2.6 * S); ctx.fillRect(-32 * S, -6 * S, 3 * S, 7 * S); ctx.fillRect(-8 * S, 6 * S, 18 * S, 1.2 * S);
    ctx.strokeStyle = `rgba(60,64,80,${0.5 + 0.3 * Math.sin(t * 60)})`; ctx.lineWidth = 1.4 * S; ctx.beginPath(); ctx.moveTo(-28 * S * Math.abs(Math.cos(t * 31)), -7 * S); ctx.lineTo(28 * S * Math.abs(Math.cos(t * 31)), -7 * S); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,50,40,0.95)'), -31 * S, -6 * S, 5 * S, Math.sin(t * 7) > 0 ? 1 : 0.2); if (Math.sin(t * 11) > 0.7) blob(ctx, glow('rgba(255,255,255,1)'), 2 * S, 7 * S, 6 * S, 1); ctx.restore(); ctx.globalAlpha = 1;
  }
  function evCarfire(X, e, P, front) {
    const { ctx, S, t } = X, { a } = phase(e, t); if (!front) return; const [p, ang] = roadAt(X, 0.28), chr = sm((a - 2) / 6), body = `rgb(${Math.round(lerp(120, 26, chr))},${Math.round(lerp(40, 24, chr))},${Math.round(lerp(40, 26, chr))})`;
    const k = a - 5.6, off = k > 0 ? Math.min(1, k * 3) : 0; car(ctx, [p[0], p[1] - off * 0], ang, S, body, false, t, 0);
    const fire = sm((a - 1) / 3) * (1 - 0.6 * sm((a - 10) / 4)); flame(ctx, p[0] + 6 * S, p[1] - 8 * S, 18 * S * (0.5 + fire), t, 21, fire); flame(ctx, p[0] - 4 * S, p[1] - 10 * S, 22 * S * (0.4 + fire), t + 2, 22, fire * sm((a - 2.5) / 2));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(255,140,60,0.7)'), p[0], p[1] - 6 * S, 90 * S, 0.55 * fire); ctx.restore();
    plume(ctx, p[0], p[1] - 18 * S, a, 0.2, 13.5, S, 55, { n: 70, life: 7, s0: 10, grow: 12, rise: 24, alpha: 0.7, wind: 14 });
    if (k > 0 && k < 2.4) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rad = 70 * S * (1 - Math.exp(-k * 6)), al = 1 - sm(k / 1.8); blob(ctx, FIRE(), p[0], p[1] - 10 * S, rad * 2.2, al); blob(ctx, CORE(), p[0], p[1] - 10 * S, rad, al * (1 - sm(k / 0.6))); ctx.restore(); ctx.globalAlpha = 1;
      debris(ctx, p[0], p[1] - 8 * S, k, S, 66, 20, { sp: 140, hot: true, life: 2, floor: p[1] + 4 * S }); }
    // A wheel that rolls off on its own
    if (k > 0) { const f = Math.min(k, 5), x = p[0] + 40 * S * f - 3 * S * f * f, y = p[1] - Math.abs(Math.sin(f * 4)) * 14 * S * Math.exp(-f); if (f < 5) { ctx.fillStyle = 'rgb(14,14,18)'; ctx.beginPath(); ctx.arc(x, y - 2.5 * S, 2.6 * S, 0, TAU); ctx.fill(); } }
  }
  function evUfo(X, e, P, front) {
    const { ctx, S, t, Q } = X, { a } = phase(e, t); if (!front) return; const [gx, gy] = spot(X, 'green'), hx = gx + 10 * S, hy = lerp(Q[0][1], Q[3][1], 0.3);
    let x, y; if (a < 2.6) { const f = sm(a / 2.6); x = hx + Math.sin(a * 2) * 10 * S * (1 - f); y = lerp(Q[0][1] - 60 * S, hy, f); } else if (a < 9.6) { x = hx + Math.sin(a * 1.6) * 3 * S; y = hy + Math.sin(a * 2.3) * 3 * S; } else { const f = Math.pow(cl((a - 9.6) / 0.6, 0, 1), 2); x = lerp(hx, Math.max(Q[1][0], Q[2][0]) + 300 * S, f); y = lerp(hy, Q[0][1] - 200 * S, f); }
    const beam = win(a, 3, 8.6, 0.25, 0.3); if (beam > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.moveTo(x - 10 * S, y + 6 * S); ctx.lineTo(x + 10 * S, y + 6 * S); ctx.lineTo(gx + 32 * S, gy + 2 * S); ctx.lineTo(gx - 32 * S, gy + 2 * S); ctx.closePath(); const gr = ctx.createLinearGradient(0, y, 0, gy); gr.addColorStop(0, `rgba(150,255,180,${0.42 * beam})`); gr.addColorStop(1, `rgba(150,255,180,${0.14 * beam})`); ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = `rgba(200,255,210,${0.25 * beam})`; ctx.lineWidth = 1 * S; for (let i = 0; i < 4; i++) { const yy = lerp(y, gy, pmod(a * 0.6 + i / 4, 1)), w = lerp(10, 32, (yy - y) / (gy - y)) * S; ctx.beginPath(); ctx.moveTo(lerp(x, gx, (yy - y) / (gy - y)) - w, yy); ctx.lineTo(lerp(x, gx, (yy - y) / (gy - y)) + w, yy); ctx.stroke(); } ctx.restore(); beamRain(ctx, [[x - 10 * S, y + 6 * S], [x + 10 * S, y + 6 * S], [gx + 32 * S, gy + 2 * S], [gx - 32 * S, gy + 2 * S]], t, S, beam, 62); ctx.save(); ctx.translate(gx, gy + 2 * S); ctx.scale(1, 0.3); ctx.globalCompositeOperation = 'lighter'; blob(ctx, glow('rgba(150,255,180,0.9)'), 0, 0, 50 * S, 0.5 * beam); ctx.restore(); }
    // The wheelie bin goes up
    const bk = cl((a - 3.6) / 4, 0, 1); if (a > 3 && bk < 1) { const by = lerp(gy, y + 8 * S, sm(bk)), bx = lerp(gx, x, sm(bk)), sc = 1 - 0.3 * bk; ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(a * 2) * 0.6 * bk); ctx.scale(sc, sc); ctx.fillStyle = 'rgb(40,92,58)'; ctx.fillRect(-4.5 * S, -12 * S, 9 * S, 12 * S); ctx.fillStyle = 'rgb(30,70,44)'; ctx.fillRect(-5.5 * S, -13.5 * S, 11 * S, 2.4 * S); ctx.fillStyle = 'rgb(14,14,18)'; ctx.fillRect(-4 * S, -1 * S, 2.4 * S, 2.4 * S); ctx.restore(); }
    // The saucer
    ctx.save(); ctx.translate(x, y); if (a > 9.6) { ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(180,255,200,0.3)'; ctx.fillRect(-60 * S, -2 * S, 60 * S, 4 * S); ctx.globalAlpha = 1; }
    let gr = ctx.createLinearGradient(0, -12 * S, 0, 8 * S); gr.addColorStop(0, 'rgb(170,180,200)'); gr.addColorStop(1, 'rgb(60,66,84)'); ctx.fillStyle = 'rgba(140,200,255,0.7)'; ctx.beginPath(); ctx.ellipse(0, -6 * S, 11 * S, 9 * S, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, 32 * S, 7.5 * S, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(20,24,34,0.6)'; ctx.lineWidth = 1 * S; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; const cols = ['rgba(255,80,80,1)', 'rgba(255,220,80,1)', 'rgba(80,255,140,1)', 'rgba(80,180,255,1)']; for (let i = 0; i < 7; i++) { const lx = (i - 3) * 8.5 * S, on = pmod(Math.floor(a * (a > 8.6 ? 16 : 5)) - i, 4); blob(ctx, glow(cols[on]), lx, 2 * S, 3.6 * S, 0.95); }
    blob(ctx, glow('rgba(150,255,180,0.8)'), 0, 6 * S, 20 * S, 0.35 + 0.4 * beam); ctx.restore(); ctx.globalAlpha = 1;
  }
  /* The seagull, close up on the ledge outside, side on (facing left) or looking straight at you */
  function gull(ctx, S, o) { const s = S * 1.45; ctx.save(); ctx.translate(o.x, o.y); if (o.flip) ctx.scale(-1, 1);
    const body = 'rgb(208,200,188)', grey = 'rgb(104,110,126)', shade = 'rgb(78,80,94)', beak = 'rgb(190,154,58)';
    if (!o.fly) { ctx.save(); ctx.fillStyle = 'rgba(8,8,14,0.45)'; ctx.filter = 'blur(' + (3 * s).toFixed(1) + 'px)'; ctx.beginPath(); ctx.ellipse(6 * s, 1 * s, 40 * s, 5 * s, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    if (!o.fly) { ctx.strokeStyle = 'rgb(214,150,120)'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round'; const st = o.step || 0; ctx.beginPath(); ctx.moveTo(-6 * s, -24 * s); ctx.lineTo(-6 * s + st * 4 * s, 0); ctx.moveTo(8 * s, -24 * s); ctx.lineTo(8 * s - st * 4 * s, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-12 * s + st * 4 * s, 0); ctx.lineTo(0 + st * 4 * s, 0); ctx.moveTo(2 * s - st * 4 * s, 0); ctx.lineTo(14 * s - st * 4 * s, 0); ctx.stroke(); }
    const by = o.fly ? -20 * s : -48 * s; ctx.translate(0, by + (o.bob || 0) * s);
    // Tail and body
    ctx.fillStyle = 'rgb(30,30,36)'; ctx.beginPath(); ctx.moveTo(40 * s, -6 * s); ctx.lineTo(70 * s, 2 * s); ctx.lineTo(62 * s, 12 * s); ctx.closePath(); ctx.fill();
    let gr = ctx.createRadialGradient(-10 * s, -10 * s, 4 * s, 4 * s, 4 * s, 52 * s); gr.addColorStop(0, body); gr.addColorStop(0.6, 'rgb(140,136,136)'); gr.addColorStop(1, shade); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(8 * s, 0, 44 * s, 28 * s, 0.08, 0, TAU); ctx.fill();
    // Wing: folded along the back, or flapping
    ctx.fillStyle = grey; if (!o.fly) { const wg = ctx.createLinearGradient(0, -26 * s, 0, 8 * s); wg.addColorStop(0, 'rgb(140,146,162)'); wg.addColorStop(1, 'rgb(84,88,104)'); ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(-14 * s, -14 * s); ctx.quadraticCurveTo(30 * s, -30 * s, 66 * s, -2 * s); ctx.quadraticCurveTo(30 * s, 8 * s, -6 * s, 6 * s); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(50,54,68,0.55)'; ctx.lineWidth = 1 * s; for (let f = 0; f < 5; f++) { ctx.beginPath(); ctx.moveTo((4 + f * 9) * s, (-12 + f * 1.5) * s); ctx.quadraticCurveTo((16 + f * 9) * s, (-6 + f) * s, (20 + f * 9) * s, (2 + f * 0.6) * s); ctx.stroke(); } ctx.fillStyle = 'rgb(28,28,34)'; ctx.beginPath(); ctx.moveTo(46 * s, -10 * s); ctx.lineTo(70 * s, -4 * s); ctx.lineTo(50 * s, 4 * s); ctx.closePath(); ctx.fill(); }
    else { const w = o.wing || 0; [1, -1].forEach(sd => { ctx.save(); ctx.scale(1, sd === 1 ? 1 : 0.7); ctx.fillStyle = sd === 1 ? grey : 'rgb(104,110,128)'; ctx.beginPath(); ctx.moveTo(-6 * s, -6 * s); ctx.quadraticCurveTo(20 * s, -60 * s * w - 10 * s, 50 * s, -96 * s * w - 4 * s); ctx.lineTo(62 * s, -90 * s * w); ctx.quadraticCurveTo(36 * s, -20 * s * w, 28 * s, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgb(28,28,34)'; ctx.beginPath(); ctx.moveTo(50 * s, -96 * s * w - 4 * s); ctx.lineTo(62 * s, -90 * s * w); ctx.lineTo(54 * s, -76 * s * w); ctx.closePath(); ctx.fill(); ctx.restore(); }); }
    // Head: side on with a beady eye, or turned to stare at you
    ctx.translate(-34 * s, -26 * s); const hg = ctx.createRadialGradient(-6 * s, -6 * s, 2 * s, 0, 0, 22 * s * (o.near || 1)); hg.addColorStop(0, 'rgb(194,186,176)'); hg.addColorStop(1, 'rgb(116,114,120)'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 20 * s * (o.near || 1), 0, TAU); ctx.fill();
    const n = o.near || 1; if (o.face) { ctx.fillStyle = beak; ctx.beginPath(); ctx.moveTo(-8 * s * n, 4 * s * n); ctx.lineTo(8 * s * n, 4 * s * n); ctx.lineTo(0, (24 + (o.open || 0) * 6) * s * n); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgb(200,50,40)'; ctx.beginPath(); ctx.arc(0, 15 * s * n, 2.6 * s * n, 0, TAU); ctx.fill();
        [-1, 1].forEach(sd => { ctx.fillStyle = 'rgb(240,230,170)'; ctx.beginPath(); ctx.arc(sd * 9 * s * n, -3 * s * n, 4.6 * s * n, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sd * 9 * s * n, -3 * s * n, 2.2 * s * n, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgb(70,74,90)'; ctx.lineWidth = 2.4 * s * n; ctx.beginPath(); ctx.moveTo(sd * 3 * s * n, -8 * s * n); ctx.lineTo(sd * 15 * s * n, -12 * s * n); ctx.stroke(); }); }
    else { ctx.fillStyle = beak; ctx.beginPath(); ctx.moveTo(-14 * s, -3 * s); ctx.lineTo(-40 * s, (o.open || 0) * -6 * s); ctx.lineTo(-38 * s, 3 * s); ctx.lineTo(-14 * s, 6 * s); ctx.closePath(); ctx.fill(); if (o.open) { ctx.beginPath(); ctx.moveTo(-14 * s, 6 * s); ctx.lineTo(-36 * s, 10 * s + o.open * 8 * s); ctx.lineTo(-14 * s, 9 * s); ctx.fill(); } ctx.fillStyle = 'rgb(200,50,40)'; ctx.beginPath(); ctx.arc(-32 * s, 4 * s, 2 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgb(200,70,50)'; ctx.beginPath(); ctx.arc(-6 * s, -6 * s, 4.2 * s, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgb(226,206,130)'; ctx.beginPath(); ctx.arc(-6 * s, -6 * s, 3.3 * s, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-6.6 * s, -6 * s, 1.5 * s, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-7.4 * s, -7 * s, 0.6 * s, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgb(70,74,90)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-12 * s, -12 * s); ctx.lineTo(0, -10 * s); ctx.stroke(); }
    ctx.restore(); }
  function evGull(X, e, P, front, layer) {
    const { ctx, S, t, Q } = X, { a } = phase(e, t), [lx, ly] = [lerp(Q[3][0], Q[2][0], 0.63), lerp(Q[3][1], Q[2][1], 0.63) - 2 * S];
    if (layer === 'near') {
      if (a < 1.1) { const f = sm(a / 1.1); gull(ctx, S, { x: lerp(lx + 380 * S, lx, f), y: lerp(ly - 300 * S, ly, f) - (1 - f) * 40 * S, fly: f < 0.92, wing: 0.5 + 0.5 * Math.sin(a * 16), flip: false }); return; }
      if (a < 5.0) { const st = a < 2.4 ? Math.sin((a - 1.1) * 7) : 0, x = lx - (a < 2.4 ? (a - 1.1) * 26 * S : 34 * S), face = a > 2.6 && a < 4.9, peck = Math.max(win(a, 3.25, 3.45, 0.06, 0.08), win(a, 3.6, 3.8, 0.06, 0.08)), open = win(a, 4.25, 4.85, 0.06, 0.12);
        gull(ctx, S, { x, y: ly, step: st, bob: Math.sin(a * 6) * 1.5 + peck * 6, face, near: 1 + peck * 0.35, open, flip: false }); return; }
      if (a < 6.8) { const f = (a - 5) / 1.8; gull(ctx, S, { x: lx - 34 * S - f * 260 * S, y: ly - f * f * 420 * S - f * 60 * S, fly: true, wing: 0.5 + 0.5 * Math.sin(a * 18), flip: false }); } return; }
    if (layer === 'glass') {
      // Taps on the glass where it pecked
      [3.4, 3.75].forEach(tp => { const k = a - tp; if (k < 0 || k > 0.5) return; ctx.save(); ctx.strokeStyle = `rgba(220,230,255,${0.5 * (1 - k / 0.5)})`; ctx.lineWidth = 1.2 * S; ctx.beginPath(); ctx.arc(lx - 34 * S - 49 * S, ly - 107 * S, 6 * S + k * 50 * S, 0, TAU); ctx.stroke(); ctx.restore(); });
      // Its present, left on the window as it goes
      const k = a - 5.35; if (k < 0) return; const x = lx - 90 * S, y = ly - 230 * S, al = 1 - sm((a - 6.5) / 0.5) * 0, run = Math.min(1, k / 1.5); ctx.save(); ctx.globalAlpha = al; const r = rng(hash(e.id));
      ctx.fillStyle = 'rgba(236,236,226,0.92)'; ctx.beginPath(); ctx.ellipse(x, y, 11 * S * sm(k / 0.08), 8 * S * sm(k / 0.08), 0.3, 0, TAU); ctx.fill(); for (let i = 0; i < 7; i++) { const an = r() * TAU, d = (8 + r() * 12) * S * sm(k / 0.08); ctx.beginPath(); ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.8, (1.5 + r() * 2.5) * S, 0, TAU); ctx.fill(); }
      ctx.fillRect(x - 2 * S, y, 4 * S, 22 * S * run); ctx.beginPath(); ctx.arc(x, y + 22 * S * run, 2.6 * S, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(60,60,50,0.6)'; ctx.beginPath(); ctx.arc(x + 2 * S, y - 1 * S, 2.4 * S, 0, TAU); ctx.fill(); ctx.restore(); }
  }
  function summerOf(cfg, t) { let s = 0, after = 0; active(cfg, t).forEach(e => { if (e.k !== 'summer') return; const { a } = phase(e, t); s = Math.max(s, sm(a / 0.6) * (1 - sm((a - 4.2) / 0.35))); if (a > 4.4) after = Math.max(after, 1 - sm((a - 6.5) / 2.5)); }); return { s, after }; }
  function evSummer(X, e, P, front) {
    const { ctx, S, t, Q, R } = X, { a } = phase(e, t), s = sm(a / 0.6) * (1 - sm((a - 4.2) / 0.35)); if (!front || s <= 0.01 || !R) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; let g = ctx.createLinearGradient(R.x0, R.y0, R.x0 + R.w * 0.6, R.y0 + R.h); g.addColorStop(0, `rgba(255,214,150,${0.7 * s})`); g.addColorStop(0.5, `rgba(150,190,255,${0.35 * s})`); g.addColorStop(1, `rgba(120,150,120,${0.15 * s})`); ctx.fillStyle = g; ctx.fillRect(R.x0, R.y0, R.w, R.h);
    ctx.globalCompositeOperation = 'lighter'; const sx = R.x0 + R.w * 0.18, sy = R.y0 + R.h * 0.16; blob(ctx, glow('rgba(255,236,190,1)'), sx, sy, 260 * S * s, 0.55 * s); blob(ctx, glow('rgba(255,250,230,1)'), sx, sy, 70 * S, 0.8 * s); blob(ctx, glow('rgba(255,255,250,1)'), sx, sy, 22 * S, s);
    // Rays and a rainbow
    ctx.globalAlpha = 0.0 * s; ctx.fillStyle = 'rgb(255,240,200)'; for (let i = 0; i < 0; i++) { const an = 0.25 + i * 0.16 + Math.sin(t * 0.7 + i) * 0.02; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(an - 0.03) * R.w * 1.4, sy + Math.sin(an - 0.03) * R.w * 1.4); ctx.lineTo(sx + Math.cos(an + 0.03) * R.w * 1.4, sy + Math.sin(an + 0.03) * R.w * 1.4); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 0.13 * s; ctx.lineWidth = 7 * S; ['#ff5050', '#ffa040', '#ffe060', '#60e070', '#5090ff', '#8060e0'].forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(R.x0 + R.w * 0.66, R.y0 + R.h * 0.95, R.w * 0.42 - i * 6 * S, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); });
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // A 3 by 5 font for the lit windows
  const FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110', '!': '010010010000010', '?': '110001010000010', '.': '000000000000010', ' ': '000000000000000', "'": '010010000000000' };
  const cleanWord = s => String(s == null ? 'BAWS' : s).toUpperCase().split('').filter(ch => FONT[ch] != null).join('').slice(0, 24);
  function evSpell(X, e, P, front) {
    const { ctx, S, t } = X, { a, d } = phase(e, t), T = lightBlock(P) === 1 ? X.T : X.T2; if (!T || !T.grid || !front) return; const G = T.grid, word = cleanWord(e.text), dark = win(a, 0, d, 0.5, 0.5), show = win(a, 0.7, d - 0.5, 0.15, 0.2);
    ctx.save(); ctx.fillStyle = `rgba(30,28,36,${0.93 * dark})`; for (let c = 0; c < G.cols; c++) for (let r = 0; r < G.rows; r++) { const [x, y, cw, ch] = cell(T, c, r); ctx.fillRect(x - cw * 0.34, y - ch * 0.3, cw * 0.68, ch * 0.6); }
    const W = word.length * 4 - 1, rows0 = Math.floor((G.rows - 5) / 2), fits = W <= G.cols, off = fits ? Math.floor((G.cols - W) / 2) : Math.round(lerp(G.cols, -W, cl((a - 0.8) / Math.max(0.5, d - 1.5), 0, 1)));
    if (show > 0) { const lit = []; for (let i = 0; i < word.length; i++) { const f = FONT[word[i]]; for (let rr = 0; rr < 5; rr++) for (let cc = 0; cc < 3; cc++) if (f[rr * 3 + cc] === '1') { const c = off + i * 4 + cc; if (c >= 0 && c < G.cols) lit.push(cell(T, c, rows0 + rr)); } }
      ctx.fillStyle = `rgba(255,206,128,${0.95 * show})`; lit.forEach(([x, y, cw, ch]) => ctx.fillRect(x - cw * 0.3, y - ch * 0.26, cw * 0.6, ch * 0.52)); ctx.globalCompositeOperation = 'lighter'; lit.forEach(([x, y, cw]) => blob(ctx, glow('rgba(255,190,110,0.8)'), x, y, cw * 0.9, 0.5 * show)); }
    ctx.restore(); ctx.globalAlpha = 1; void S;
  }
  function strikeOf(cfg, t) { let fl = 0, out = 0, room = 0; active(cfg, t).forEach(e => { if (e.k !== 'strike') return; const { a, d } = phase(e, t), D = LEN.strike; fl = Math.max(fl, Math.exp(-a * 14) * 1.4 + 0.9 * Math.exp(-Math.abs(a - 0.16) * 30) + 0.5 * Math.exp(-Math.abs(a - 0.4) * 22));
      const flick = q => (Math.sin(a * 53) > 0.2 ? 1 : 0.35) * q; out = Math.max(out, a < 0.5 ? 0 : a < 0.8 ? flick(sm((a - 0.5) / 0.3)) : a < D - 1.8 ? 1 : a < D - 1 ? 1 - flick(sm((a - D + 1.8) / 0.8)) : 0);
      room = Math.max(room, a < 0.7 ? 0 : a < 0.85 ? (a - 0.7) / 0.15 : a < D - 1.0 ? 1 : a < D - 0.3 ? 1 - (Math.sin(a * 60) > 0 ? sm((a - D + 1) / 0.7) : 0) : 0); void d; }); return { fl, out, room }; }
  function evStrike(X, e, P, front) {
    const { ctx, S, t, Q } = X, { a } = phase(e, t); if (!front) return; const T = P.state === 'rubble' || P.gone ? X.T2 : X.T; if (!T) return; const roof = T.roof || [(T.x0 + T.x1) / 2, T.top];
    if (a < 0.6 && (a < 0.08 || Math.abs(a - 0.16) < 0.06 || Math.abs(a - 0.4) < 0.07)) { const r = rng(hash(e.id)), y0 = Math.min(Q[0][1], Q[1][1]) - 10 * S, pts = [[roof[0] + (r() - 0.5) * 120 * S, y0]]; for (let i = 1; i <= 12; i++) { const f = i / 12; pts.push([lerp(pts[0][0], roof[0], f) + (i < 12 ? (r() - 0.5) * 34 * S : 0), lerp(y0, roof[1], f)]); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; [[14, 'rgba(160,170,255,0.3)'], [6, 'rgba(210,220,255,0.6)'], [2.4, 'rgba(255,255,255,1)']].forEach(([w, c]) => { ctx.strokeStyle = c; ctx.lineWidth = w * S; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }); blob(ctx, glow('rgba(220,230,255,1)'), roof[0], roof[1], 40 * S, 1); ctx.restore(); ctx.globalAlpha = 1; }
    sparks(ctx, roof[0], roof[1], a - 0.05, S, 12, 40, 'rgba(255,230,160,0.95)', { sp: 90, life: 1.4, g: 220 });
    flame(ctx, roof[0], roof[1] + 2 * S, 6 * S, t, 31, win(a, 0.6, 5.6, 0.4, 1));
    plume(ctx, roof[0], roof[1] - 4 * S, a, 0.7, 6.5, S, 33, { n: 20, life: 4, s0: 5, grow: 6, rise: 18, alpha: 0.45 });
  }
  const DRAW = { plane: evPlane, demolish: evDemolish, squid: evSquid, telly: evTelly, bonfire: evBonfire, polis: evPolis, carfire: evCarfire, ufo: evUfo, gull: evGull, summer: evSummer, spell: evSpell, strike: evStrike };

  /* ---------- What Studio calls ---------- */
  /* Everything is drawn into its own layer first, then laid into the photo: washed with the night haze, a touch less colour,
     and softened to the same focus as the picture, so it sits out there with the flats rather than on top of them. */
  const bufs = {};
  function layer(X, key, fn, haze, blurK, sat) {
    const { ctx, R, v } = X; if (!R) { fn(X); return; } const px = v.px || v.s, W = Math.max(2, Math.ceil(R.w * px)), H = Math.max(2, Math.ceil(R.h * px));
    let c = bufs[key]; if (!c || c.width !== W || c.height !== H) c = bufs[key] = mk(W, H); const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.setTransform(px, 0, 0, px, -R.x0 * px, -R.y0 * px); g.imageSmoothingQuality = 'high';
    fn(Object.assign({}, X, { ctx: g }));
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; if (X.grain) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = g.createPattern(grainTex(), 'repeat'); g.save(); g.scale(px * 0.9, px * 0.9); g.fillRect(0, 0, W / (px * 0.9), H / (px * 0.9)); g.restore(); }
    if (haze) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = haze; g.fillRect(0, 0, W, H); } g.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'blur(' + (blurK * px).toFixed(2) + 'px)' + (sat ? ' saturate(' + sat + ')' : ''); ctx.drawImage(c, R.x0, R.y0, R.w, R.h); ctx.restore();
  }
  // A soft mottle, like feathers and grime, laid over things that are close
  function grainTex() { if (SPR.grain) return SPR.grain; const N = 128, c = mk(N, N), g = c.getContext('2d'), id = g.createImageData(N, N), d = id.data, nz = vnoise(4242);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const n = fbm(nz, x / 2.2, y / 1.4, 3) - 0.5, q = (y * N + x) * 4, v = n > 0 ? 255 : 0; d[q] = d[q + 1] = d[q + 2] = v; d[q + 3] = Math.min(255, Math.abs(n) * 90); } g.putImageData(id, 0, 0); return (SPR.grain = c); }
  const HAZE_FAR = 'rgba(90,104,144,0.2)', HAZE = 'rgba(90,104,144,0.12)';
  // Out in the world, behind the rain: things behind the block, the block, then everything in front of it
  function world(X) {
    const { cfg, t } = X, P = X.pose, list = active(cfg, t), back = list.filter(e => e.k === 'squid' || e.k === 'bonfire');
    if (back.length) layer(X, 'back', Y => back.forEach(e => e.k === 'squid' ? evSquid(Y, e, P, 'back') : evBonfire(Y, e, P, true, 'sky')), HAZE_FAR, 0.75, 0.85);
    drawTower(X, P);
    const front = list.filter(e => e.k !== 'gull');
    if (front.length) layer(X, 'front', Y => front.forEach(e => { if (e.k === 'squid') evSquid(Y, e, P, 'front'); else if (e.k === 'bonfire') evBonfire(Y, e, P, true, 'world'); else DRAW[e.k](Y, e, P, true); }), HAZE, 0.75, 0.88);
    X.ctx.globalAlpha = 1;
  }
  // Right up against the glass (behind the drops): the seagull, a firework coming at you. Lit by the room, nearly in focus.
  function near(X) { const list = active(X.cfg, X.t).filter(e => e.k === 'gull' || e.k === 'bonfire'); if (!list.length) return;
    layer(Object.assign({}, X, { grain: true }), 'near', Y => list.forEach(e => e.k === 'gull' ? evGull(Y, e, Y.pose, true, 'near') : evBonfire(Y, e, Y.pose, true, 'near')), 'rgba(60,64,90,0.06)', 0.5, 0.85); X.ctx.save(); X.ctx.restore(); X.ctx.globalAlpha = 1; }
  // On the glass itself (over the drops)
  function onGlass(X) { active(X.cfg, X.t).forEach(e => { if (e.k === 'gull') evGull(X, e, X.pose, true, 'glass'); if (e.k === 'bonfire') evBonfire(X, e, X.pose, true, 'glass'); }); X.ctx.globalAlpha = 1; }
  // Light thrown into the room by what is going on outside
  function light(cfg, t) {
    const out = { glow: [], flash: 0, lampsOff: 0, roomOff: 0, out: 0, rainK: 1, sun: 0 };
    active(cfg, t).forEach(e => { const { a } = phase(e, t);
      if (e.k === 'plane') { const k = a - PL.IMP; if (k > 0) out.glow.push([[255, 150, 70], 1.1 * Math.exp(-k * 2.2) + 0.1 * (0.7 + 0.3 * Math.sin(a * 13)) * (1 - sm((a - PL.COL) / 3))]); }
      if (e.k === 'demolish') { const k = a - DM.BANG; if (k > 0) out.glow.push([[255, 200, 140], 0.55 * Math.exp(-k * 4)]); }
      if (e.k === 'bonfire') { ROCKETS.forEach(([t0], i) => { const k = a - t0 - 0.9; if (k > 0) out.glow.push([[[255, 120, 120], [140, 255, 160], [255, 210, 120], [210, 150, 255], [140, 200, 255]][i], 0.18 * Math.exp(-k * 3)]); }); const k = a - 7.5; if (k > -0.6 && k < 0) out.glow.push([[255, 200, 150], 0.2 * (1 + k / 0.6)]); if (k > 0) out.glow.push([[255, 220, 200], 1.3 * Math.exp(-k * 3.5)]); }
      if (e.k === 'polis') { const on = Math.sin(t * TAU * 3.2) > 0; if (a > 1.3 && a < 5.3) out.glow.push([[70, 110, 255], (on ? 0.22 : 0.06) * win(a, 1.3, 5.3, 0.4, 0.6)]); const sw = a - 8.2; if (sw > 0 && sw < 0.9) out.glow.push([[235, 240, 255], 0.75 * Math.sin(Math.PI * sw / 0.9)]); }
      if (e.k === 'carfire') { const k = a - 5.6; out.glow.push([[255, 140, 60], 0.06 * sm((a - 1) / 3) * (0.7 + 0.3 * Math.sin(a * 11))]); if (k > 0) out.glow.push([[255, 160, 80], 0.6 * Math.exp(-k * 3)]); }
      if (e.k === 'ufo') out.glow.push([[120, 255, 160], 0.2 * win(a, 3, 8.6, 0.25, 0.3)]);
      if (e.k === 'telly') { const k = a - 0.85; if (k > 0) out.glow.push([[160, 200, 255], 0.0]); }
    });
    const su = summerOf(cfg, t); out.sun = su.s; if (su.s > 0) out.glow.push([[255, 214, 150], 0.8 * su.s]); out.rainK = (1 - su.s) * (1 + 0.9 * su.after);
    active(cfg, t).forEach(e => { if (e.k !== 'summer') return; const { a } = phase(e, t), k = a - 4.55; if (k > 0) out.flash = Math.max(out.flash, Math.exp(-k * 14) * 1.2 + 0.6 * Math.exp(-Math.abs(k - 0.18) * 30)); });
    const st = strikeOf(cfg, t); out.flash = Math.max(out.flash, st.fl); out.out = st.out; out.roomOff = st.room; out.lampsOff = st.room;
    return out;
  }
  // Thunder in the sound for the summer downpour and the lightning strike
  function thunders(cfg) { const out = []; evs(cfg).forEach(e => { const k = LEN[e.k] / durOf(e), st = +e.start || 0; if (e.k === 'summer') out.push({ t: st + 4.55 / k, big: true, seed: hash(e.id), pow: 1.2 }); if (e.k === 'strike') out.push({ t: st, big: true, seed: hash(e.id), pow: 1.6 }); }); return out; }
  // The sound of each event, added into the studio's sound
  function sound(cfg, add, sr) {
    evs(cfg).forEach(e => { const st = +e.start || 0, k = LEN[e.k] / durOf(e), at = a => st + a / k, nz = rng(hash(e.id) + 1), n = () => nz() * 2 - 1;
      let b = 0, lp = 0; const brown = (c = 0.02, d = 0.997) => (b = (b + c * n()) * d), low = (x, f) => (lp += f * (x - lp));
      const boom = (t0, len, pow, pan = 0.5) => { let b1 = 0, l1 = 0; add(t0, x => { b1 = (b1 + 0.03 * n()) * 0.998; l1 += 0.03 * (b1 - l1); return (l1 * 2.4 * Math.exp(-x / (len * 0.4)) + Math.sin(TAU * 48 * x) * Math.exp(-x / 0.35) * 0.5 + n() * Math.exp(-x / 0.05) * 0.4) * pow; }, len, pan); };
      const bang = (t0, pow, pan = 0.5) => add(t0, x => (n() * Math.exp(-x / 0.04) * 0.6 + Math.sin(TAU * 70 * x) * Math.exp(-x / 0.12) * 0.5) * pow, 0.5, pan);
      const crackle = (t0, len, dens, pow, pan = 0.5) => { const r = rng(hash(e.id) + Math.round(t0 * 100)); let c = 0; add(t0, x => { if (r() < dens / sr) c = 0.5 + r() * 0.5; c *= 0.992; return n() * c * pow * win(x, 0, len, 0.5, 0.8); }, len, pan); };
      if (e.k === 'plane') { add(at(0), x => low(n(), 0.06) * 1.2 * sm(x / 3) * (1 + x * 0.3) * (x < PL.IMP / k ? 1 : 0), PL.IMP / k + 0.1, 0.35); boom(at(PL.IMP), 5, 1.4, 0.45); crackle(at(PL.IMP + 0.4), (PL.COL - PL.IMP + 1) / k, 30, 0.12, 0.45); add(at(PL.COL), x => brown(0.03, 0.998) * 2 * win(x, 0, (PL.COLE - PL.COL + 3) / k, 0.6, 2), (PL.COLE - PL.COL + 3) / k, 0.5); }
      if (e.k === 'demolish') { [0, 0.7, 1.4].forEach(h => add(at(h), x => Math.sign(Math.sin(TAU * 330 * x)) * 0.12 * win(x, 0, 0.5, 0.02, 0.05), 0.5, 0.5)); for (let i = 0; i < 8; i++) bang(at(DM.BANG + i * 0.07), 0.7, 0.4 + i * 0.03); add(at(DM.BANG + 0.3), x => Math.sin(TAU * (60 + 15 * Math.sin(x * 3)) * x) * 0.25 * win(x, 0, 3, 0.3, 1.2) + brown() * 0.8 * win(x, 0, 3, 0.1, 1.5), 3, 0.5); }
      if (e.k === 'squid') { [0.5, 5].forEach(h => add(at(h), x => (Math.sin(TAU * (48 + 6 * Math.sin(x * 2.1)) * x) * 0.35 + Math.sin(TAU * 97 * x) * 0.1) * win(x, 0, 3, 0.6, 1), 3, 0.55)); add(at(5), x => brown(0.03) * 0.9 * win(x, 0, 3.2, 0.3, 0.5) * (0.6 + 0.4 * Math.sin(x * 47)), 3.2, 0.45); }
      if (e.k === 'telly') { const g = 300, vy = -46, tl = 1.1; add(at(0.85 + tl), x => (n() * Math.exp(-x / 0.06) * 0.5 + [3100, 4200, 5300].reduce((s, f, i) => s + Math.sin(TAU * f * x) * Math.exp(-(x - i * 0.03) / 0.08) * (x > i * 0.03 ? 0.08 : 0), 0)), 0.6, 0.5); void g; void vy; }
      if (e.k === 'bonfire') { crackle(at(0), 12 / k, 60, 0.14, 0.4); ROCKETS.forEach(([t0], i) => { add(at(t0), x => Math.sin(TAU * (900 + 1400 * x) * x) * 0.05 * win(x, 0, 0.9, 0.05, 0.1), 0.9, 0.4 + i * 0.05); bang(at(t0 + 0.9), 0.45, 0.35 + i * 0.07); }); add(at(6.8), x => Math.sin(TAU * (1200 + 900 * x) * x) * 0.09 * sm(x / 0.7), 0.7, 0.5); bang(at(7.5), 1.3, 0.5); add(at(7.5), x => Math.sin(TAU * 140 * x) * Math.exp(-x / 0.2) * 0.4, 0.6, 0.5); }
      if (e.k === 'polis') { add(at(1.2), x => { const f = Math.floor(x / 0.55) % 2 ? 650 : 870; return (2 * Math.abs(2 * ((f * x) % 1) - 1) - 1) * 0.08 * win(x, 0, 6 / k, 0.6, 2); }, 6 / k, 0.5); add(at(3.4), x => n() * 0.25 * (0.5 + 0.5 * Math.sign(Math.sin(TAU * 17 * x))) * win(x, 0, 7.6 / k, 1.2, 1.6), 7.6 / k, 0.4); add(at(0.4), x => low(n(), 0.1) * 0.6 * Math.sin(Math.PI * cl(x / 2.2, 0, 1)), 2.2, 0.6); }
      if (e.k === 'carfire') { crackle(at(1), 12.5 / k, 50, 0.16, 0.45); boom(at(5.6), 3, 0.9, 0.45); }
      if (e.k === 'ufo') add(at(0.5), x => { const L2 = 9.6 / k, f = x < L2 ? 520 + 120 * Math.sin(x * 5) + 40 * Math.sin(x * 31) : 520 + 2400 * (x - L2); return Math.sin(TAU * f * x) * 0.07 * win(x, 0, L2 + 0.6, 1, 0.3); }, 9.6 / k + 0.6, 0.5);
      if (e.k === 'gull') { [0.2, 0.5, 0.8, 5.1, 5.35, 5.6].forEach(h => add(at(h), x => low(n(), 0.2) * 0.5 * Math.sin(Math.PI * cl(x / 0.15, 0, 1)), 0.15, 0.6)); [3.4, 3.75].forEach(h => add(at(h), x => Math.sin(TAU * 1900 * x) * Math.exp(-x / 0.008) * 0.5 + n() * Math.exp(-x / 0.004) * 0.3, 0.1, 0.6));
        add(at(4.25), x => { const f = 1500 - 500 * x + 80 * Math.sin(x * 70); return (2 * ((f * x) % 1) - 1) * 0.13 * win(x, 0, 0.6, 0.03, 0.15) * (0.6 + 0.4 * Math.sin(x * 40)); }, 0.6, 0.6); add(at(5.35), x => low(n(), 0.3) * 0.5 * Math.exp(-x / 0.06), 0.25, 0.55); }
      if (e.k === 'summer') { for (let i = 0; i < 9; i++) { const r = rng(i + 3), h = 0.7 + r() * 3.2; add(at(h), x => Math.sin(TAU * (3200 + 1500 * Math.sin(x * 60) + r() * 600) * x) * 0.05 * win(x, 0, 0.18, 0.02, 0.06), 0.2, 0.3 + r() * 0.4); } }
      if (e.k === 'strike') { add(at(0.55), x => (Math.sign(Math.sin(TAU * 100 * x)) * 0.12 + n() * 0.05) * Math.exp(-x / 0.25), 0.6, 0.5); add(at(LEN.strike - 1.8), x => Math.sin(TAU * (60 + 40 * x) * x) * 0.12 * win(x, 0, 1.2, 0.2, 0.5), 1.2, 0.5); }
    });
  }
  // A small picture for each kind, for the add menu
  function icon(k) { return c => { const g = c.getContext('2d'), W = c.width, H = c.height; g.fillStyle = '#1b2236'; g.fillRect(0, 0, W, H); g.fillStyle = '#3a4560'; g.fillRect(W * 0.55, H * 0.25, W * 0.25, H * 0.75); g.fillStyle = TINT[k] || '#888'; g.beginPath(); g.arc(W * 0.35, H * 0.4, Math.min(W, H) * 0.2, 0, TAU); g.fill(); }; }

  return { KINDS, LEN, TOWER, HINT, TINT, nameOf, evs, durOf, towerAt, pose, world, near, onGlass, light, thunders, sound, icon, cleanWord, summerOf, _font: FONT };
})();

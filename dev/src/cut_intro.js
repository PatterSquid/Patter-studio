/* The PatterSquid intro: five seconds, his squid on its saltire disc.
   The disc drops in and bounces, a traffic cone (the one the Duke wears outside the Gallery of Modern Art) falls out the sky
   and bonks it on the head, the squid's eyes spin, PATTERSQUID slams in letter by letter, "GET IT UP YE." is stamped
   underneath, then a seagull swoops in and nicks the cone. Everything is a pure function of time, so the preview and the
   export match frame for frame; the sound is made here too, from the same moments. */
const PatterIntro = (() => {
  const DUR = 5, SOUND_ID = 'builtin-intro-v2';
  const T = { drop: 0.12, land: 0.7, cone: 1.08, bonk: 1.42, word: 1.88, hit: 2.6, stamp: 3.05, gull: 3.42, grab: 3.95, gone: 4.65 };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f, sm = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
  const eo = x => 1 - Math.pow(1 - cl(x, 0, 1), 3), ei = x => Math.pow(cl(x, 0, 1), 2);
  const spring = (k, amp, w, d) => k < 0 ? 0 : amp * Math.exp(-k * d) * Math.cos(k * w);
  const mk = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))) : Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) });
  const rng = seed => { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const FONT = '"Arial Black", "Segoe UI Black", Impact, "Helvetica Neue", Arial, sans-serif', NARROW = 'Impact, "Arial Narrow Bold", "Arial Narrow", "Arial Black", sans-serif';

  // His logo, loaded once
  let logo = null, readyP = null;
  function ready() { if (readyP) return readyP; readyP = (async () => { if (typeof STUDIO_LOGO === 'undefined') return null; try { const b = await (await fetch(STUDIO_LOGO)).blob(); logo = await createImageBitmap(b); } catch (e) { logo = null; } return logo; })(); return readyP; }
  if (typeof window !== 'undefined') setTimeout(ready, 0);

  // The disc on its own, round, with a white rim (512 across)
  let discC = null; function disc() { if (discC || !logo) return discC; const c = mk(560, 560), g = c.getContext('2d'); g.save(); g.beginPath(); g.arc(280, 280, 250, 0, Math.PI * 2); g.clip(); g.drawImage(logo, 24, 24, 512, 512); g.restore();
    g.lineWidth = 14; g.strokeStyle = '#f4f2ee'; g.beginPath(); g.arc(280, 280, 254, 0, Math.PI * 2); g.stroke(); g.lineWidth = 4; g.strokeStyle = 'rgba(8,18,38,0.9)'; g.beginPath(); g.arc(280, 280, 262, 0, Math.PI * 2); g.stroke(); return (discC = c); }
  // The squid's eyes in disc pixels (the logo is drawn 24 in from the edge)
  const EYES = [[213 + 24, 190 + 24], [304 + 24, 191 + 24]], EYE_R = 23;

  /* ---------- Where everything is at time t ---------- */
  function pose(t, W, H) {
    const u = Math.min(W / 1200, H / 1080), cx = W / 2, cy = H / 2, R = 200 * u, dx0 = cx, dy0 = cy - 95 * u;
    // The disc: falls, lands with a squash, takes the cone on the head, and lifts a wee bit when the cone is gone
    let dy = dy0, sx = 1, sy = 1, drot = 0;
    if (t < T.land) { const p = cl((t - T.drop) / (T.land - T.drop), 0, 1); dy = lerp(-R - 40 * u, dy0, ei(p)); sy = 1 + 0.14 * p; sx = 1 - 0.08 * p; }
    else { const k = t - T.land, q = spring(k, 0.2, 26, 6.5); sy = 1 - q; sx = 1 + q * 0.8; drot = spring(k, 0.05, 15, 5); }
    const kb = t - T.bonk; if (kb >= 0) { const q = spring(kb, 0.13, 30, 7); sy -= q; sx += q * 0.7; dy += Math.max(0, spring(kb, 12 * u, 22, 6)); drot += spring(kb, -0.06, 18, 5); }
    const kg = t - T.grab; if (kg >= 0) { const q = spring(kg, -0.07, 24, 6); sy -= q; sx += q * 0.6; }
    const breathe = t > T.hit ? 1 + 0.008 * Math.sin((t - T.hit) * 3.2) : 1; sx *= breathe; sy *= breathe;
    // Top of the head, where the cone sits (the disc squashes about its bottom)
    const bottom = dy + R, headY = bottom - 2 * R * sy + 8 * u;
    // The cone: spins down, bonks, hops, settles at an angle; then the gull has it
    let cone = null; const coneH = 170 * u, rest = -0.34;
    if (t >= T.cone) {
      if (t < T.bonk) { const p = cl((t - T.cone) / (T.bonk - T.cone), 0, 1); cone = { x: dx0 + lerp(60 * u, 0, p), y: lerp(-coneH, headY, ei(p)), rot: lerp(-5.2, rest, eo(p)) }; }
      else { const k = t - T.bonk, hop = k < 0.32 ? Math.sin(Math.PI * k / 0.32) * 46 * u : 0; cone = { x: dx0 + Math.sin(drot) * R * 2, y: headY - hop, rot: rest + spring(k - 0.32, 0.3, 17, 4.5) + (k < 0.32 ? -0.4 * Math.sin(Math.PI * k / 0.32) : 0) }; }
    }
    // The gull: in from the right, swoops on the cone, off up to the left with it
    let gull = null; if (t >= T.gull && t < T.gone + 0.3) {
      const P0 = [W + 140 * u, dy0 - 330 * u], C0 = [cx + 520 * u, headY - 40 * u], Pg = [dx0 + 6 * u, headY - coneH * 0.95], C1 = [cx - 160 * u, headY - 160 * u], P3 = [-260 * u, -160 * u];
      const bz = (a, b, c, f) => [(1 - f) * (1 - f) * a[0] + 2 * (1 - f) * f * b[0] + f * f * c[0], (1 - f) * (1 - f) * a[1] + 2 * (1 - f) * f * b[1] + f * f * c[1]];
      let p, q; if (t < T.grab) { const f = sm((t - T.gull) / (T.grab - T.gull)) * 0.6 + ((t - T.gull) / (T.grab - T.gull)) * 0.4; p = bz(P0, C0, Pg, f); q = bz(P0, C0, Pg, Math.min(1, f + 0.02)); }
      else { const f = ei((t - T.grab) / (T.gone - T.grab)); p = bz(Pg, C1, P3, f); q = bz(Pg, C1, P3, Math.min(1, f + 0.02)); }
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]); gull = { x: p[0], y: p[1], dir: q[0] < p[0] ? -1 : 1, tilt: Math.max(-0.6, Math.min(0.6, (q[0] < p[0] ? Math.atan2(q[1] - p[1], p[0] - q[0]) : ang))), flap: Math.sin((t - T.gull) * Math.PI * 2 * (t > T.grab - 0.15 && t < T.grab + 0.1 ? 2.2 : 4.6)) };
      if (t >= T.grab && cone) { const k = t - T.grab; cone = { x: gull.x + 4 * u * gull.dir, y: gull.y + coneH * 0.92, rot: rest * 0.3 + Math.sin(k * 9) * 0.25 * Math.exp(-k * 1.2) + gull.tilt * 0.3 * gull.dir }; }
    }
    return { u, cx, cy, R, dx: dx0, dy, sx, sy, drot, headY, cone, coneH, gull, bottom };
  }

  /* ---------- Drawing ---------- */
  function background(g, t, W, H, P) {
    const { u, cx, cy } = P, gr = g.createRadialGradient(cx, cy - 60 * u, 40 * u, cx, cy, Math.max(W, H) * 0.75); gr.addColorStop(0, '#16478e'); gr.addColorStop(0.55, '#0a2556'); gr.addColorStop(1, '#030a1c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // A huge faint saltire behind it all, easing in
    const k = sm(t / 1.4), sc = lerp(1.25, 1, eo(t / 2.2)); g.save(); g.translate(cx, cy); g.scale(sc, sc); g.globalAlpha = 0.07 * k; g.strokeStyle = '#ffffff'; g.lineWidth = 150 * u; g.lineCap = 'butt';
    const D = Math.hypot(W, H); g.beginPath(); g.moveTo(-D, -D * H / W); g.lineTo(D, D * H / W); g.moveTo(D, -D * H / W); g.lineTo(-D, D * H / W); g.stroke(); g.restore();
    // Specks of dust drifting up through the light
    const r = rng(11); g.fillStyle = '#ffffff'; for (let i = 0; i < 46; i++) { const x = r() * W, sp = 12 + r() * 30, y = ((r() * H - t * sp * u) % H + H) % H, s2 = (0.8 + r() * 1.8) * u; g.globalAlpha = (0.05 + r() * 0.12) * sm(t / 0.8); g.beginPath(); g.arc(x, y, s2, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    // When the name lands, a ring of light goes out from the disc
    const kh = t - T.hit; if (kh > 0 && kh < 0.9) { g.save(); g.globalAlpha = 0.35 * (1 - kh / 0.9); g.strokeStyle = '#cfe0ff'; g.lineWidth = (14 - 10 * kh) * u; g.beginPath(); g.arc(P.dx, P.dy, P.R * (1.05 + kh * 1.6), 0, Math.PI * 2); g.stroke(); g.restore(); }
    // Vignette
    const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function drawDisc(g, t, P) {
    const D = disc(), { u, R, dx, dy, sx, sy, drot, bottom } = P; if (t < T.drop) return;
    // Shadow on the "floor" below, tighter as it lands
    const fall = t < T.land ? cl((t - T.drop) / (T.land - T.drop), 0, 1) : 1; g.save(); g.globalAlpha = 0.45 * fall; const sg = g.createRadialGradient(dx, dy + R + 18 * u, 0, dx, dy + R + 18 * u, R * 1.1); sg.addColorStop(0, 'rgba(0,0,0,0.7)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.beginPath(); g.ellipse(dx, P.cy - 95 * u + R + 18 * u, R * lerp(0.5, 1.05, fall) * sx, 22 * u, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.save(); g.translate(dx, bottom); g.rotate(drot); g.scale(sx, sy); g.translate(0, -R);
    if (D) { g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 30 * u; g.shadowOffsetY = 12 * u; g.drawImage(D, -R * 280 / 254, -R * 280 / 254, R * 560 / 254, R * 560 / 254); g.shadowColor = 'transparent'; eyes(g, t, R / 254); }
    else { g.fillStyle = '#0b2f66'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // Blinks, and a dizzy spin after the cone hits (lids in the squid's own colour over his eyes, then pupils where we want them)
  function eyes(g, t, k) {
    const kb = t - T.bonk, dizzy = kb > 0 && kb < 0.75, blinks = [[2.12, 0.16], [3.0, 0.12], [T.grab + 0.08, 0.2], [4.55, 0.12]], close = blinks.reduce((a, [b, d]) => { const x = (t - b) / d; return x > 0 && x < 1 ? Math.max(a, Math.sin(Math.PI * x)) : a; }, 0);
    if (!dizzy && close < 0.02) return;
    EYES.forEach(([ex, ey], i) => { const x = (ex - 280) * k, y = (ey - 280) * k, r = EYE_R * k; g.save(); g.beginPath(); g.arc(x, y, r + 3 * k, 0, Math.PI * 2); g.clip();
      const lid = g.createLinearGradient(0, y - r, 0, y + r); lid.addColorStop(0, '#ebe7e3'); lid.addColorStop(1, '#d6d0ca'); g.fillStyle = lid; g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
      if (dizzy) { const a = kb * 22 * (i ? -1 : 1), q = 9 * k * (1 - kb / 0.75); g.fillStyle = '#16171c'; g.beginPath(); g.arc(x + Math.cos(a) * q, y + Math.sin(a) * q, r * 0.82, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2 * k; g.beginPath(); g.arc(x + Math.cos(a) * q, y + Math.sin(a) * q, r * 0.42, a, a + 4.2); g.stroke(); }
      else { const h = r * (1 - close); g.fillStyle = '#16171c'; g.beginPath(); g.ellipse(x, y + (r - h) * 0.4, r, Math.max(0.5, h), 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(120,110,100,0.6)'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(x - r, y - r + (r - h) * 1.6); g.lineTo(x + r, y - r + (r - h) * 1.6); if (close > 0.9) g.stroke(); }
      g.restore(); });
  }
  function drawCone(g, P) {
    const c = P.cone; if (!c) return; const h = P.coneH, w = h * 0.5; g.save(); g.translate(c.x, c.y); g.rotate(c.rot);
    const body = g.createLinearGradient(-w, 0, w, 0); body.addColorStop(0, '#c43d00'); body.addColorStop(0.35, '#ff7a1a'); body.addColorStop(0.6, '#ff5a00'); body.addColorStop(1, '#a83200');
    g.fillStyle = body; g.beginPath(); g.moveTo(-w * 0.82, -h * 0.06); g.lineTo(w * 0.82, -h * 0.06); g.lineTo(w * 0.14, -h); g.quadraticCurveTo(0, -h * 1.03, -w * 0.14, -h); g.closePath(); g.fill();
    const band = (y0, y1) => { const f0 = 1 - y0, f1 = 1 - y1; g.beginPath(); g.moveTo(-w * lerp(0.14, 0.82, f0), -h * y0); g.lineTo(w * lerp(0.14, 0.82, f0), -h * y0); g.lineTo(w * lerp(0.14, 0.82, f1), -h * y1); g.lineTo(-w * lerp(0.14, 0.82, f1), -h * y1); g.closePath(); g.fill(); };
    const wb = g.createLinearGradient(-w, 0, w, 0); wb.addColorStop(0, '#b8bcc4'); wb.addColorStop(0.4, '#ffffff'); wb.addColorStop(1, '#9aa0aa'); g.fillStyle = wb; band(0.6, 0.45); band(0.33, 0.2);
    g.fillStyle = '#1d1d22'; g.beginPath(); g.roundRect ? g.roundRect(-w * 1.02, -h * 0.08, w * 2.04, h * 0.1, 4 * P.u) : g.rect(-w * 1.02, -h * 0.08, w * 2.04, h * 0.1); g.fill();
    g.globalAlpha = 0.25; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-w * 0.5, -h * 0.1); g.lineTo(-w * 0.35, -h * 0.1); g.lineTo(-w * 0.06, -h * 0.95); g.closePath(); g.fill(); g.restore();
  }
  function impact(g, t, P) { const k = t - T.bonk; if (k < 0 || k > 0.2) return; const { u, dx, headY } = P; g.save(); g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.globalAlpha = 1 - k / 0.2; g.lineWidth = 7 * u;
    [-2.5, -2.0, -1.15, -0.65].forEach((a, i) => { const r0 = (70 + k * 260) * u, r1 = r0 + (40 - k * 120) * u; g.beginPath(); g.moveTo(dx + Math.cos(a) * r0, headY + Math.sin(a) * r0 * 0.6); g.lineTo(dx + Math.cos(a) * r1, headY + Math.sin(a) * r1 * 0.6); g.stroke(); }); g.restore(); }
  // The name: PATTER in white, SQUID in Patter red, each letter slamming down in turn
  function word(g, t, W, H, P) {
    if (t < T.word - 0.05) return; const { u, cx, cy } = P, size = 152 * u, base = cy + 248 * u, txt = 'PATTERSQUID'; g.save(); g.font = '900 ' + size.toFixed(1) + 'px ' + FONT; g.textBaseline = 'alphabetic';
    const ws = [...txt].map(ch => g.measureText(ch).width), gap = -4 * u, total = ws.reduce((a, b) => a + b, 0) + gap * (txt.length - 1), scale = Math.min(1, W * 0.9 / total), x0 = cx - total * scale / 2;
    let x = x0; [...txt].forEach((ch, i) => { const w = ws[i] * scale, ti = T.word + i * 0.055, k = t - ti; if (k < 0) { x += w + gap * scale; return; }
      const s = 1 + Math.max(-0.12, spring(k, 1.5, 19, 9)), a = cl(k / 0.05, 0, 1), rr = rng(70 + i), rot = spring(k, (rr() - 0.5) * 0.5, 16, 7) + (rr() - 0.5) * 0.03, yo = -spring(k, 30 * u, 18, 8);
      g.save(); g.translate(x + w / 2, base + yo); g.rotate(rot); g.scale(s * scale, s * scale); g.globalAlpha = a; const red = i >= 6;
      g.lineJoin = 'round'; g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(ch, -ws[i] / 2 + 7 * u, 9 * u);
      g.strokeStyle = '#06101f'; g.lineWidth = 16 * u; g.strokeText(ch, -ws[i] / 2, 0);
      const fg = g.createLinearGradient(0, -size * 0.75, 0, 0); if (red) { fg.addColorStop(0, '#ff5a4a'); fg.addColorStop(1, '#c81d24'); } else { fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#d6dde8'); } g.fillStyle = fg; g.fillText(ch, -ws[i] / 2, 0);
      g.restore(); x += w + gap * scale; });
    g.restore();
  }
  // The stamp: rough red ink in a box, thumped down at an angle
  const stampCache = new Map();
  function stampSprite(text, u) { const key = text + '|' + u.toFixed(3); let c = stampCache.get(key); if (c) return c; if (stampCache.size > 8) stampCache.clear();
    const size = 74 * u, pad = 26 * u, m = mk(10, 10).getContext('2d'); m.font = '900 ' + size.toFixed(1) + 'px ' + NARROW; const tw = m.measureText(text).width, W = tw + pad * 2 + 40 * u, H = size * 1.3 + pad * 2;
    c = mk(W + 30 * u, H + 30 * u); const g = c.getContext('2d'); g.translate(15 * u, 15 * u); const r = rng(99);
    // A cream label with rough edges, slapped on, with a soft shadow under it
    const edge = []; const n = 60; for (let i = 0; i < n; i++) { const f = i / n, side = Math.floor(f * 4), q = (f * 4) % 1, j = (r() - 0.5) * 3 * u; edge.push(side === 0 ? [q * W, j] : side === 1 ? [W + j, q * H] : side === 2 ? [(1 - q) * W, H + j] : [j, (1 - q) * H]); }
    const path = () => { g.beginPath(); edge.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
    g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 16 * u; g.shadowOffsetY = 8 * u; g.fillStyle = '#efe6d2'; path(); g.fill(); g.restore();
    const pg = g.createLinearGradient(0, 0, W, H); pg.addColorStop(0, 'rgba(255,255,255,0.35)'); pg.addColorStop(1, 'rgba(120,100,70,0.18)'); g.fillStyle = pg; path(); g.fill();
    // The red stamp on it: a box and the words, worn in places
    const ink = mk(W, H), k = ink.getContext('2d'); k.fillStyle = '#d4141e'; k.strokeStyle = '#d4141e'; k.lineWidth = 7 * u; k.lineJoin = 'round'; if (k.roundRect) { k.beginPath(); k.roundRect(14 * u, 12 * u, W - 28 * u, H - 24 * u, 8 * u); k.stroke(); } else k.strokeRect(14 * u, 12 * u, W - 28 * u, H - 24 * u);
    k.font = '900 ' + size.toFixed(1) + 'px ' + NARROW; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(text, W / 2, H / 2 + 3 * u);
    k.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 260; i++) { k.globalAlpha = 0.2 + r() * 0.6; k.beginPath(); k.arc(r() * W, r() * H, (0.6 + r() * 2) * u, 0, Math.PI * 2); k.fill(); }
    g.globalAlpha = 0.92; g.drawImage(ink, 0, 0);
    stampCache.set(key, c); return c; }
  function stamp(g, t, P, text) {
    const k = t - T.stamp; if (k < -0.12) return; const { u, cx, cy } = P, S = stampSprite(text, u), x = cx + 40 * u, y = cy + 350 * u;
    const s = k < 0 ? lerp(2.5, 1, ei((k + 0.12) / 0.12)) : 1 + spring(k, -0.06, 30, 10), a = k < 0 ? ei((k + 0.12) / 0.12) : 1;
    g.save(); g.translate(x, y); g.rotate(-0.07); g.scale(s, s); g.globalAlpha = a; g.drawImage(S, -S.width / 2, -S.height / 2); g.restore();
  }
  function drawGull(g, t, P) {
    const G = P.gull; if (!G) return; const u = P.u, s = 1.75 * u; g.save(); g.translate(G.x, G.y); g.scale(G.dir < 0 ? -1 : 1, 1); g.rotate(G.tilt * (G.dir < 0 ? -1 : 1) * 0.6);
    const f = G.flap, wing = (side) => { g.save(); g.scale(1, side); g.fillStyle = side > 0 ? '#aeb6c0' : '#c6cdd6'; g.beginPath(); g.moveTo(-18 * s, -6 * s); g.quadraticCurveTo(-30 * s, -60 * s * f - 20 * s, -95 * s, -70 * s * f - 10 * s); g.lineTo(-70 * s, -48 * s * f); g.quadraticCurveTo(-30 * s, -20 * s * f, 20 * s, -4 * s); g.closePath(); g.fill();
      g.fillStyle = '#16171c'; g.beginPath(); g.moveTo(-95 * s, -70 * s * f - 10 * s); g.lineTo(-74 * s, -54 * s * f - 5 * s); g.lineTo(-82 * s, -50 * s * f); g.closePath(); g.fill(); g.restore(); };
    wing(-1);
    g.fillStyle = '#c6cdd6'; g.beginPath(); g.moveTo(-58 * s, -2 * s); g.lineTo(-84 * s, -12 * s); g.lineTo(-84 * s, 8 * s); g.closePath(); g.fill();
    const bd = g.createLinearGradient(0, -18 * s, 0, 18 * s); bd.addColorStop(0, '#ffffff'); bd.addColorStop(1, '#d9dee5'); g.fillStyle = bd; g.beginPath(); g.ellipse(-12 * s, 0, 48 * s, 17 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(34 * s, -10 * s, 15 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(46 * s, -12 * s); g.lineTo(70 * s, -7 * s); g.lineTo(66 * s, -2 * s); g.lineTo(45 * s, -4 * s); g.closePath(); g.fill(); g.fillStyle = '#d8262c'; g.beginPath(); g.arc(62 * s, -4 * s, 2.6 * s, 0, Math.PI * 2); g.fill();
    // A beady, thieving eye
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(38 * s, -14 * s, 3 * s, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(31 * s, -21 * s); g.lineTo(44 * s, -18 * s); g.stroke();
    g.strokeStyle = '#e8873a'; g.lineWidth = 4 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4 * s, 14 * s); g.lineTo(2 * s, 34 * s); g.moveTo(-14 * s, 14 * s); g.lineTo(-10 * s, 34 * s); g.stroke();
    wing(1); g.restore();
  }

  function draw(ctx, t, W, H, o = {}) {
    t = cl(t, 0, DUR); const P = pose(t, W, H), text = (o.text == null ? 'GET IT UP YE.' : String(o.text)).slice(0, 40), sh = t > T.hit ? spring(t - T.hit, 9 * P.u, 55, 9) : 0, sh2 = t > T.stamp ? spring(t - T.stamp, 5 * P.u, 60, 12) : 0;
    ctx.save(); background(ctx, t, W, H, P); ctx.translate(sh + sh2 * 0.6, -sh * 0.5 + sh2);
    drawDisc(ctx, t, P); impact(ctx, t, P);
    if (P.gull && t >= T.grab) { drawGull(ctx, t, P); drawCone(ctx, P); } else { drawCone(ctx, P); if (o.gull !== false) drawGull(ctx, t, P); }
    word(ctx, t, W, H, P); if (text) stamp(ctx, t, P, text.toUpperCase());
    ctx.restore();
    // Fade up from black at the very start
    if (t < 0.25) { ctx.save(); ctx.globalAlpha = 1 - t / 0.25; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }

  /* ---------- Sound ---------- */
  function sound(sr = 48000) {
    const N = Math.ceil(DUR * sr), L = new Float32Array(N), R = new Float32Array(N), r = rng(5150), TAU = Math.PI * 2;
    const add = (t0, len, pan, fn) => { const i0 = Math.round(t0 * sr), n = Math.round(len * sr), gl = Math.cos(pan * Math.PI / 2), gr = Math.sin(pan * Math.PI / 2); for (let k = 0; k < n; k++) { const j = i0 + k; if (j < 0 || j >= N) continue; const v = fn(k / sr, k); L[j] += v * gl; R[j] += v * gr; } };
    // Whoosh as it drops: noise swept up through a resonant filter
    { let a = 0, b = 0; add(T.drop, T.land - T.drop + 0.05, 0.5, x => { const p = x / (T.land - T.drop), f = 300 + 2600 * p * p, q = 2 * Math.sin(Math.PI * f / sr); const n = r() * 2 - 1; a += q * (n - a - b * 0.3); b += q * a; return b * 0.5 * Math.sin(Math.PI * cl(p, 0, 1)) ** 0.7; }); }
    // Thud on landing: a low drop in pitch and a soft click
    add(T.land, 0.5, 0.5, x => { const f = 90 * Math.exp(-x * 7) + 42, ph = TAU * (42 * x + 48 * (1 - Math.exp(-x * 7)) / 7); return Math.sin(ph) * 0.9 * Math.exp(-x * 9) + (r() * 2 - 1) * 0.2 * Math.exp(-x * 70); });
    // The cone whistling down, then a hollow plastic bonk
    add(T.cone, T.bonk - T.cone, 0.55, x => { const p = x / (T.bonk - T.cone), f = 1500 - 900 * p; return Math.sin(TAU * (1500 * x - 450 * x * p)) * 0.08 * Math.sin(Math.PI * p) + Math.sin(TAU * f * x * 0.5) * 0 ; });
    add(T.bonk, 0.45, 0.5, x => (Math.sin(TAU * 520 * x) * 0.6 + Math.sin(TAU * 790 * x) * 0.35 + Math.sin(TAU * 1310 * x) * 0.15) * Math.exp(-x * 16) + (r() * 2 - 1) * 0.35 * Math.exp(-x * 110) + Math.sin(TAU * 140 * x) * 0.4 * Math.exp(-x * 20));
    // A wee dizzy wobble while the eyes spin
    add(T.bonk + 0.1, 0.6, 0.5, x => Math.sin(TAU * (900 * x + 18 * Math.sin(TAU * 7 * x))) * 0.05 * Math.sin(Math.PI * x / 0.6));
    // Each letter landing: a tight knock, rising a touch
    for (let i = 0; i < 11; i++) { const f = 180 + i * 9; add(T.word + i * 0.055 + 0.03, 0.12, 0.5 + (i - 5) * 0.04, x => Math.sin(TAU * f * x) * 0.45 * Math.exp(-x * 40) + (r() * 2 - 1) * 0.14 * Math.exp(-x * 90)); }
    // The hit when the name is in: a deep boom with a bright chord over it (D minor, a wee bit dark)
    add(T.hit, 1.6, 0.5, x => { const env = Math.exp(-x * 2.4), boom = Math.sin(TAU * (55 * x - 8 * (1 - Math.exp(-x * 9)))) * Math.exp(-x * 3.2) * 0.9; let ch = 0; [146.83, 174.61, 220, 293.66].forEach((f, k) => { const ph = TAU * f * x; ch += (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph)) * (k === 3 ? 0.6 : 1); }); return boom + ch * 0.06 * env * Math.min(1, x / 0.01); });
    add(T.hit, 0.6, 0.5, x => (r() * 2 - 1) * 0.12 * Math.exp(-x * 8));
    // The stamp: a thump and a slap
    add(T.stamp, 0.35, 0.55, x => Math.sin(TAU * 95 * x) * 0.7 * Math.exp(-x * 22) + (r() * 2 - 1) * 0.45 * Math.exp(-x * 45));
    // The gull: wing beats coming in, two cheeky squawks, a snatch
    for (let k = 0; k < 6; k++) add(T.gull + k * 0.11, 0.08, 0.8 - k * 0.05, x => (r() * 2 - 1) * 0.12 * Math.sin(Math.PI * x / 0.08));
    const squawk = (t0, len, f0, f1, pan) => { let ph = 0; add(t0, len, pan, x => { const p = x / len, f = lerp(f0, f1, p) * (1 + 0.04 * Math.sin(TAU * 32 * x)); ph += TAU * f / sr; const env = Math.sin(Math.PI * p) ** 0.6; let v = 0; for (let h = 1; h <= 6; h++) v += Math.sin(ph * h) / h * (h === 2 ? 1.4 : 1); return v * 0.16 * env + (r() * 2 - 1) * 0.03 * env; }); };
    squawk(T.gull + 0.22, 0.22, 1300, 1700, 0.75); squawk(T.gull + 0.48, 0.32, 1650, 900, 0.7); squawk(T.grab + 0.32, 0.4, 1700, 820, 0.3);
    { let a = 0; add(T.grab - 0.05, 0.3, 0.45, x => { a += 0.25 * ((r() * 2 - 1) - a); return a * 0.5 * Math.sin(Math.PI * x / 0.3); }); }
    // Keep it clean: soft limit to just under full scale
    let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); const g = pk > 0 ? 0.7 / pk : 1; for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * g * 1.1) / Math.tanh(1.1); R[i] = Math.tanh(R[i] * g * 1.1) / Math.tanh(1.1); }
    return { L, R, sr };
  }
  function wav() { const { L, R, sr } = sound(), n = L.length, buf = new ArrayBuffer(44 + n * 4), dv = new DataView(buf), ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.round(cl(L[i], -1, 1) * 32767), true); dv.setInt16(46 + i * 4, Math.round(cl(R[i], -1, 1) * 32767), true); }
    return new Blob([buf], { type: 'audio/wav' }); }
  // The sound lives in the editor's media store under a fixed id, made again if it is ever missing
  let soundP = null;
  function ensureSound() { if (typeof CutMedia === 'undefined') return Promise.resolve(null); if (CutMedia.info(SOUND_ID)) return Promise.resolve(SOUND_ID);
    return soundP || (soundP = CutMedia.importFile(new File([wav()], 'PatterSquid intro.wav', { type: 'audio/wav' }), null, { id: SOUND_ID, builtin: true }).then(m => { soundP = null; return m.id; }, e => { soundP = null; throw e; })); }

  return { DUR, T, SOUND_ID, draw, ready, sound, wav, ensureSound, pose };
})();

/* IntroScenes: the intro cut scenes. His own street picture (assets/coatbridge-street.jpg, COAT_STREET) is the set,
   brought to life like the studio (lamps, moon, the motor's alarm, a lit window), with his own icon (Squid) as the star,
   given the same dark comic outline as the picture so he sits in it. Gags are drawn to match: chunky comic lettering,
   Senga in her curlers, shout bubbles, a flying slipper, stars round his heid.
   "Shut it!": he stands in the middle of Coatbridge Main Street, the title slams down on the road, the alarm goes,
   Senga's window flies up, SHUT IT!, a slipper off his heid, the alarm stops dead, a letter falls over.
   Pure functions of time: draw(g, t, W, H, o) with o = { name, line, episode, kicker }. */
const IntroScenes = (() => {
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f;
  const ease = f => { f = cl(f); return f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; }, eo = f => 1 - Math.pow(1 - cl(f), 3), ei = f => Math.pow(cl(f), 3), eb = f => { f = cl(f); const c = 1.7; return 1 + (c + 1) * Math.pow(f - 1, 3) + c * Math.pow(f - 1, 2); };
  const bump = (k, w) => k < 0 || k > w ? 0 : Math.sin(Math.PI * k / w);
  const wob = (k, f = 7, d = 6) => k <= 0 ? 0 : Math.exp(-d * k) * Math.sin(k * f * Math.PI * 2);
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const INK = '#15121a', TITLE = '"Bricolage Grotesque", "Segoe UI Black", "Arial Black", sans-serif', SHOUT = '"Boldonse", "Bricolage Grotesque", Impact, sans-serif';
  const PW = 1672, PH = 941;
  let plate = null, readyP = null;
  function ready() { return readyP || (readyP = Promise.all([typeof COAT_STREET !== 'undefined' ? fetch(COAT_STREET).then(r => r.blob()).then(createImageBitmap).then(b => { plate = b; }) : null, typeof Squid !== 'undefined' ? Squid.ready() : null, typeof PatterFonts !== 'undefined' ? PatterFonts.ready() : null]).catch(() => null)); }
  // Camera over the picture: (x, y) the point in the middle of the screen, z the zoom (1 = the whole picture across)
  function camTo(g, W, H, c) { const z = Math.max(1, c.z), k = Math.max(W / PW, H / PH) * z, hw = W / 2 / k, hh = H / 2 / k, x = cl(c.x, hw, PW - hw), y = cl(c.y, hh, PH - hh); g.setTransform(k, 0, 0, k, W / 2 - x * k, H / 2 - y * k); return k; }
  function glow(g, x, y, r, col, a) { if (a <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a.toFixed(3))); gr.addColorStop(1, col.replace('A', '0')); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  /* ---------- his icon with the picture's ink outline ---------- */
  const SB = { a: null, b: null };
  function squidComic(g, x, y, h, pose, k) { if (typeof Squid === 'undefined') return; const s = Math.ceil(h * 2.2 * Math.max(1, k)), sc = s / (h * 2.2);
    if (!SB.a || SB.a.width < s) { SB.a = mk(s, s); SB.b = mk(s, s); } const a = SB.a.getContext('2d'), b = SB.b.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, SB.a.width, SB.a.height);
    if (!Squid.draw(a, s / 2, s * 0.86, h * sc, pose)) return; b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, SB.b.width, SB.b.height); b.drawImage(SB.a, 0, 0); b.globalCompositeOperation = 'source-in'; b.fillStyle = INK; b.fillRect(0, 0, s, s); b.globalCompositeOperation = 'source-over';
    const ox = x - s / 2 / sc, oy = y - s * 0.86 / sc, ow = h * 0.016; for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; g.drawImage(SB.b, 0, 0, s, s, ox + Math.cos(an) * ow, oy + Math.sin(an) * ow, s / sc, s / sc); }
    g.drawImage(SB.a, 0, 0, s, s, ox, oy, s / sc, s / sc); }
  /* ---------- chunky comic title: each letter its own picture, so they can land, squash and fall over ---------- */
  const TL = {}; function titleLetters(name, h) { const key = name + '|' + Math.round(h); if (TL.key === key) return TL.v; const fs = h, ex = Math.round(h * 0.16), ow = h * 0.1, out = [];
    const m = mk(8, 8).getContext('2d'); m.font = `700 ${fs}px ${TITLE}`; const asc = fs * 0.78;
    [...name].forEach(ch => { const w = m.measureText(ch).width; if (ch === ' ') { out.push({ ch, w, c: null }); return; } const cw = Math.ceil(w + ow * 2 + ex + 8), chh = Math.ceil(fs * 1.05 + ow * 2 + ex + 8), c = mk(cw, chh), g = c.getContext('2d'); g.font = m.font; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      const bx = ow + 4, by = ow + 4 + asc + fs * 0.06;
      // the side of the letter: saltire blue, darker as it goes back, inked
      for (let i = ex; i >= 1; i--) { g.lineWidth = ow; g.strokeStyle = INK; g.strokeText(ch, bx + i * 0.35, by + i); }
      for (let i = ex; i >= 1; i--) { const f = i / ex; g.fillStyle = `rgb(${Math.round(18 + 10 * (1 - f))},${Math.round(56 + 40 * (1 - f))},${Math.round(130 + 60 * (1 - f))})`; g.fillText(ch, bx + i * 0.35, by + i); }
      // the face: cream with a lit top edge and a cel shadow at the bottom
      g.lineWidth = ow; g.strokeStyle = INK; g.strokeText(ch, bx, by); const fg = g.createLinearGradient(0, by - asc, 0, by); fg.addColorStop(0, '#fffaf0'); fg.addColorStop(0.55, '#f4ead6'); fg.addColorStop(0.56, '#e2d3b6'); fg.addColorStop(1, '#d6c4a2'); g.fillStyle = fg; g.fillText(ch, bx, by);
      g.save(); g.globalCompositeOperation = 'source-atop'; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = h * 0.025; g.beginPath(); g.moveTo(0, by - asc + h * 0.06); g.lineTo(cw, by - asc + h * 0.02); g.globalAlpha = 0.0; g.stroke(); g.restore();
      out.push({ ch, w, c, bx, by }); });
    TL.key = key; TL.v = out; return out; }
  // draws the title standing on the road, base at (cx, by); s per letter: { y offset, squash, rot (falling over), alpha }
  function title(g, name, cx, by, h, per) { const L = titleLetters(name, h), tw = L.reduce((a, l) => a + l.w, 0) * 0.98; let x = cx - tw / 2;
    // the shadow on the road under the letters
    g.save(); g.fillStyle = 'rgba(5,4,10,0.55)'; g.beginPath(); g.ellipse(cx, by + h * 0.12, tw * 0.55, h * 0.12, 0, 0, Math.PI * 2); g.fill(); g.restore();
    L.forEach((l, i) => { const p = per(i, L.length) || {}; if (l.c && (p.a == null || p.a > 0)) { g.save(); g.globalAlpha = p.a == null ? 1 : p.a; const px = x + l.w / 2, sq = p.sq || 1;
        g.translate(px + (p.rot || 0) * 0 , by - (p.y || 0)); if (p.rot) { g.translate(l.w * 0.45 * Math.sign(p.rot), 0); g.rotate(p.rot); g.translate(-l.w * 0.45 * Math.sign(p.rot), 0); } g.scale(1 / Math.sqrt(sq), sq); if (p.flat) { g.translate(0, h * 0.04 * p.flat); g.scale(1 + 0.25 * p.flat, Math.max(0.12, 1 - 0.88 * p.flat)); }
        g.drawImage(l.c, -l.w / 2 - l.bx, -l.by); g.restore(); } x += l.w * 0.98; }); return tw; }
  /* ---------- Senga, at her window ---------- */
  const SG = {}; function senga(pose) { if (SG[pose]) return SG[pose]; const c = mk(512, 560), g = c.getContext('2d'), O = INK; const L = w => { g.lineWidth = w; g.strokeStyle = O; g.lineJoin = 'round'; g.lineCap = 'round'; };
    const fillS = (col, sh) => { g.fillStyle = col; g.fill(); if (sh) { g.save(); g.clip(); g.fillStyle = sh; g.fillRect(256, 0, 400, 600); g.restore(); } L(9); g.stroke(); };
    // dressing gown
    g.beginPath(); g.moveTo(70, 560); g.bezierCurveTo(70, 380, 150, 320, 256, 318); g.bezierCurveTo(362, 320, 442, 380, 442, 560); g.closePath(); fillS('#e47fae', 'rgba(120,20,70,0.25)');
    g.beginPath(); g.moveTo(200, 322); g.lineTo(256, 430); g.lineTo(312, 322); g.lineTo(292, 318); g.lineTo(256, 378); g.lineTo(220, 318); g.closePath(); fillS('#fbd2e4');
    // the arm: up with the slipper, or flung after the throw
    const up = pose === 'up'; g.beginPath(); if (up) { g.moveTo(380, 380); g.bezierCurveTo(440, 310, 460, 220, 440, 150); g.lineTo(392, 150); g.bezierCurveTo(400, 230, 382, 290, 340, 345); } else { g.moveTo(370, 380); g.bezierCurveTo(420, 400, 470, 405, 512, 400); g.lineTo(512, 452); g.bezierCurveTo(456, 456, 400, 440, 336, 410); } g.closePath(); fillS('#e47fae', 'rgba(120,20,70,0.2)');
    g.beginPath(); up ? g.ellipse(416, 138, 28, 26, 0, 0, Math.PI * 2) : g.ellipse(496, 426, 26, 28, 0, 0, Math.PI * 2); fillS('#f2c3a2');
    if (up) { g.save(); g.translate(418, 92); g.rotate(-0.45); slipperShape(g, 1.25); g.restore(); }
    // head, cheeks, the face of a woman who has had ENOUGH
    g.beginPath(); g.ellipse(256, 222, 96, 108, 0, 0, Math.PI * 2); fillS('#f2c3a2', 'rgba(150,70,40,0.18)');
    g.fillStyle = 'rgba(220,90,90,0.35)'; g.beginPath(); g.ellipse(196, 262, 24, 15, 0, 0, Math.PI * 2); g.ellipse(316, 262, 24, 15, 0, 0, Math.PI * 2); g.fill();
    L(12); g.beginPath(); g.moveTo(182, 172); g.lineTo(240, 198); g.moveTo(330, 172); g.lineTo(272, 198); g.stroke();
    g.fillStyle = O; g.beginPath(); g.ellipse(220, 214, 10, 8, 0, 0, Math.PI * 2); g.ellipse(292, 214, 10, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(256, 286, 46, up ? 40 : 26, 0, 0, Math.PI * 2); fillS('#5c1322'); g.fillStyle = '#e45d6e'; g.beginPath(); g.ellipse(256, 302, 24, 11, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.fillRect(232, 252, 48, 9);
    L(7); g.beginPath(); g.moveTo(256, 226); g.quadraticCurveTo(274, 248, 252, 254); g.stroke();
    // headscarf over her rollers, rollers poking out, a fag behind the ear for later
    g.beginPath(); g.moveTo(156, 200); g.bezierCurveTo(146, 92, 226, 70, 256, 72); g.bezierCurveTo(302, 70, 368, 92, 356, 200); g.bezierCurveTo(330, 148, 186, 148, 156, 200); g.closePath(); fillS('#73c1de', 'rgba(20,60,110,0.25)');
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(184 + k * 21, 112 + Math.sin(k * 1.3) * 9, 5, 0, Math.PI * 2); g.fill(); }
    [[166, 158], [346, 158], [178, 126], [334, 126]].forEach(([x, y]) => { g.beginPath(); g.roundRect(x - 17, y - 12, 34, 24, 10); fillS('#ff7db5'); });
    g.save(); g.translate(358, 196); g.rotate(-0.5); g.fillStyle = '#f5f1e8'; g.fillRect(-4, -26, 8, 40); g.fillStyle = '#d9853b'; g.fillRect(-4, 8, 8, 8); L(4); g.strokeRect(-4, -26, 8, 42); g.restore();
    return (SG[pose] = c); }
  function slipperShape(g, s) { g.save(); g.scale(s, s); g.lineJoin = 'round'; g.beginPath(); g.ellipse(0, 0, 24, 52, 0, 0, Math.PI * 2); g.fillStyle = '#8a3a5c'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(0, -14, 21, 32, 0, 0, Math.PI * 2); g.fillStyle = '#ff9ccb'; g.fill(); g.stroke(); g.fillStyle = '#fff5fa'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(-14 + (k % 3) * 14, -36 + Math.floor(k / 3) * 12, 7, 0, Math.PI * 2); g.fill(); } g.restore(); }
  // A shout bubble: jagged, inked, the words punched in
  function shout(g, x, y, w, h, text, k, tail) { if (k <= 0) return; const s = eb(k / 0.18), r = rng(3); g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.04 + 0.03 * Math.sin(k * 40) * Math.exp(-k * 3));
    g.beginPath(); const n = 22; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = (i % 2 ? 1 : 0.8 + r() * 0.12); const px = Math.cos(a) * w / 2 * rr, py = Math.sin(a) * h / 2 * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath();
    g.fillStyle = '#fff7d6'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    if (tail) { g.beginPath(); g.moveTo(-w * 0.28, h * 0.25); g.lineTo(tail[0], tail[1]); g.lineTo(-w * 0.12, h * 0.36); g.closePath(); g.fillStyle = '#fff7d6'; g.fill(); g.stroke(); }
    let fs = h * 0.42; g.font = `400 ${fs}px ${SHOUT}`; while (g.measureText(text).width > w * 0.78 && fs > 6) { fs -= 1; g.font = `400 ${fs}px ${SHOUT}`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = fs * 0.16; g.strokeStyle = INK; g.strokeText(text, 0, fs * 0.08); g.fillStyle = '#e8262f'; g.fillText(text, 0, fs * 0.08); g.restore(); }
  function stars(g, cx, cy, rx, t, a) { if (a <= 0) return; g.save(); g.globalAlpha = a; for (let i = 0; i < 3; i++) { const an = t * 5 + i * Math.PI * 2 / 3, x = cx + Math.cos(an) * rx, y = cy + Math.sin(an) * rx * 0.3, s = 15 + 5 * Math.sin(an); g.save(); g.translate(x, y); g.rotate(t * 3 + i); g.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? s * 0.45 : s, aa = k / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } g.closePath(); g.fillStyle = '#ffd93b'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.restore(); } g.restore(); }
  function puff(g, x, y, k, n, size, seed) { if (k <= 0 || k > 1) return; const r = rng(seed); g.save(); for (let i = 0; i < n; i++) { const dir = (r() - 0.5) * 2, d = eo(k) * size * (1 + r()), px = x + dir * d * 1.6, py = y - Math.abs(dir) * d * 0.25 - r() * d * 0.4, rad = size * (0.25 + r() * 0.35) * (0.6 + k);
      g.globalAlpha = (1 - k) * 0.85; g.fillStyle = '#6b5f66'; g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(21,18,26,0.6)'; g.stroke(); g.fillStyle = 'rgba(200,190,200,0.35)'; g.beginPath(); g.arc(px - rad * 0.25, py - rad * 0.25, rad * 0.5, 0, Math.PI * 2); g.fill(); } g.restore(); }
  function caption(g, W, H, text, k) { if (!text || k <= 0) return; const u = H / 1080; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); let fs = 74 * u; g.font = `700 ${fs}px ${TITLE}`; while (g.measureText(text).width > W * 0.6) { fs -= 2; g.font = `700 ${fs}px ${TITLE}`; } const tw = g.measureText(text).width, pad = fs * 0.5, bw = tw + pad * 2, bh = fs * 1.7, x = 60 * u, y = 54 * u;
    g.translate(x + bw / 2, y + bh / 2); g.rotate(-0.025); g.scale(eb(k / 0.2), eb(k / 0.2)); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-bw / 2 + 8 * u, -bh / 2 + 8 * u, bw, bh); g.fillStyle = '#ffd93b'; g.fillRect(-bw / 2, -bh / 2, bw, bh); g.lineWidth = 6 * u; g.strokeStyle = INK; g.strokeRect(-bw / 2, -bh / 2, bw, bh);
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, fs * 0.04); g.restore(); }
  // The episode on a street sign like the one on the corner
  function streetSign(g, W, H, ep, kick, k) { if (!ep || k <= 0) return; const u = H / 1080; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); let fs = 62 * u; g.font = `700 ${fs}px ${TITLE}`; while (g.measureText(ep).width > W * 0.5) { fs -= 2; g.font = `700 ${fs}px ${TITLE}`; } const tw = g.measureText(ep).width, bw = tw + fs * 1.2, bh = fs * (kick ? 2.3 : 1.7);
    g.translate(W - 70 * u - bw / 2, H - 80 * u - bh / 2 + (1 - eb(k / 0.25)) * 260 * u); g.rotate(0.02); g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.roundRect(-bw / 2 + 10 * u, -bh / 2 + 10 * u, bw, bh, 12 * u); g.fill();
    g.fillStyle = '#f2f0e8'; g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, 12 * u); g.fill(); g.lineWidth = 7 * u; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3 * u; g.beginPath(); g.roundRect(-bw / 2 + 12 * u, -bh / 2 + 12 * u, bw - 24 * u, bh - 24 * u, 6 * u); g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; if (kick) { g.font = `700 ${fs * 0.5}px ${TITLE}`; g.fillText(kick, 0, -bh / 2 + fs * 0.55); g.font = `700 ${fs}px ${TITLE}`; g.fillText(ep, 0, fs * 0.32); } else g.fillText(ep, 0, fs * 0.05); g.restore(); }

  /* ---------- "Shut it!" ---------- */
  const S = { drop: 0.95, slam: 1.25, alarmOff: 3.12, win: 2.0, open: 2.12, shout: 2.2, wind: 2.45, throw: 2.62, back: 2.72, bonk: 3.12, fall: 3.55, shut: 4.05, line: 4.15, end: 5.6 };
  const SQ = { x: 990, y: 862, h: 300 }, TB = { x: 1010, y: 600, h: 128 }, WINR = { x0: 361, y0: 293, x1: 441, y1: 533, mid: 414 }, HEADL = [[1293, 606], [1428, 600]];
  function camAt(t) { // a slow push, a jolt at the slam, the cut to the window, back out, a drift in to finish
    let c; if (t < S.win) c = { x: lerp(860, 940, ease(t / S.win)), y: lerp(520, 560, ease(t / S.win)), z: lerp(1.0, 1.18, ease(t / S.win)) };
    else if (t < S.back) { const k = eo((t - S.win) / 0.18); c = { x: lerp(560, 470, k), y: 440, z: lerp(2.0, 2.3, ease((t - S.win) / 0.7)) }; }
    else { const k = ease((t - S.back) / 2.6); c = { x: lerp(820, 900, k), y: lerp(560, 600, k), z: lerp(1.12, 1.32, k) }; }
    const sl = bump(t - S.slam, 0.4) * 14 * (1 - (t - S.slam) / 0.4), bk = bump(t - S.bonk, 0.25) * 7; c.x += Math.sin(t * 95) * (sl + bk); c.y += Math.cos(t * 83) * (sl + bk) * 1.3; return c; }
  function shutIt(g, t, W, H, o = {}) { if (!plate) return false; const name = o.name || 'PatterSquid', T = S;
    g.save(); const cam = camAt(t), k = camTo(g, W, H, cam); g.drawImage(plate, 0, 0, PW, PH);
    const alarm = t > T.slam + 0.05 && t < T.alarmOff ? (Math.sin((t - T.slam) * Math.PI * 2 * 2.4) > 0 ? 1 : 0.15) : 0;
    // light: the lamps breathe and dip when the letters land, the moon, the alarm, Senga's window
    g.save(); g.globalCompositeOperation = 'screen'; const dip = 1 - 0.6 * bump(t - T.slam, 0.25); [[757, 178, 140], [1142, 352, 80], [1043, 458, 50]].forEach(([x, y, r], i) => glow(g, x, y, r, 'rgba(255,170,80,A)', (0.32 + 0.04 * Math.sin(t * 9 + i * 2)) * dip));
    glow(g, 1060, 112, 120, 'rgba(190,210,255,A)', 0.18);
    if (alarm) { HEADL.forEach(([x, y]) => glow(g, x, y, 90, 'rgba(255,250,220,A)', 0.8 * alarm)); glow(g, 1210, 610, 60, 'rgba(255,150,30,A)', 0.9 * alarm); glow(g, 1446, 606, 50, 'rgba(255,150,30,A)', 0.9 * alarm);
      const sp = g.createLinearGradient(1300, 640, 1300, 760); sp.addColorStop(0, `rgba(255,240,200,${0.25 * alarm})`); sp.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = sp; g.beginPath(); g.moveTo(1240, 630); g.lineTo(1460, 630); g.lineTo(1250, 780); g.lineTo(980, 780); g.closePath(); g.fill(); }
    const lit = t > T.win ? (t < T.win + 0.08 ? (Math.sin(t * 120) > 0 ? 1 : 0.3) : t > T.shut + 0.15 ? Math.max(0, 1 - (t - T.shut - 0.15) / 0.06) : 1) : 0;
    g.restore();
    // Senga's window: the light on, the bottom sash flung up, her leaning out
    if (lit > 0 || t > T.win) { const { x0, y0, x1, y1, mid } = WINR, open = t < T.open ? 0 : t < T.shut ? eo((t - T.open) / 0.07) : 1 - eo((t - T.shut) / 0.06); g.save();
      if (lit > 0) { const wg = g.createLinearGradient(0, y0, 0, y1); wg.addColorStop(0, `rgba(250,190,110,${0.95 * lit})`); wg.addColorStop(1, `rgba(150,80,45,${0.95 * lit})`); g.fillStyle = wg; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.fillStyle = `rgba(110,30,50,${0.85 * lit})`; g.fillRect(x0, y0, 16, y1 - y0); g.fillRect(x1 - 16, y0, 16, y1 - y0); g.fillStyle = `rgba(255,236,190,${lit})`; g.beginPath(); g.arc(x0 + 30, y0 + 40, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = `rgba(60,30,30,${0.6 * lit})`; g.fillRect(x0 + 16, y0 + 150, x1 - x0 - 32, 4);
        g.globalCompositeOperation = 'screen'; glow(g, (x0 + x1) / 2, (y0 + y1) / 2, 200, 'rgba(255,190,110,A)', 0.4 * lit); glow(g, (x0 + x1) / 2, y1 + 60, 160, 'rgba(255,190,110,A)', 0.25 * lit); g.globalCompositeOperation = 'source-over'; }
      if (open > 0 && t < T.shut + 0.2) { const sk = t - T.open, pose = t > T.throw ? 'throw' : 'up', lean = t < T.shut ? eo(sk / 0.12) : 1 - eo((t - T.shut) / 0.08); const sz = 0.27, sx = (x0 + x1) / 2 + 10, sy = y1 + 34 - lean * 34 + (t > T.wind && t < T.throw ? -6 * Math.sin((t - T.wind) * 30) : 0);
        g.save(); g.beginPath(); g.rect(x0 - 200, y0 - 200, x1 - x0 + 600, y1 - y0 + 200 + 10); g.clip(); g.translate(sx, sy); g.rotate(-0.05 + (pose === 'throw' ? 0.1 : 0)); g.drawImage(senga(pose), -256 * sz, -560 * sz, 512 * sz, 560 * sz); g.restore(); }
      // the bottom sash, slid up over the top one
      const sashY = lerp(mid, y0 + 8, open), gl = g.createLinearGradient(0, sashY, 0, sashY + (y1 - mid)); gl.addColorStop(0, `rgba(40,45,70,${lit > 0 ? 0.35 : 0.9})`); gl.addColorStop(1, `rgba(20,24,40,${lit > 0 ? 0.25 : 0.9})`);
      if (open > 0.01) { g.fillStyle = gl; g.fillRect(x0 + 2, sashY, x1 - x0 - 4, y1 - mid - 4); g.lineWidth = 4; g.strokeStyle = '#e8e2d4'; g.strokeRect(x0 + 2, sashY, x1 - x0 - 4, y1 - mid - 4); g.lineWidth = 1.5; g.strokeStyle = INK; g.strokeRect(x0, sashY - 2, x1 - x0, y1 - mid); }
      g.restore(); }
    // the title: falls from the sky, slams, wobbles; the S keels over after the bonk
    const dk = (t - T.drop) / (T.slam - T.drop);
    if (dk > 0) { g.save(); title(g, name, TB.x, TB.y, TB.h, (i, n) => { const lag = i * 0.012, kk = (t - T.drop - lag) / (T.slam - T.drop); const p = {}; if (kk < 1) { p.y = (1 - ei(kk)) * 900; p.sq = 1.25; } else { const after = t - T.slam - lag; p.sq = 1 - 0.32 * Math.exp(-after * 14) * Math.cos(after * 40); p.y = 0; }
        const sIdx = name.search(/S/); if (i === (sIdx >= 0 ? sIdx : Math.floor(n / 2)) && t > T.fall) { const fk = (t - T.fall) / 0.4; p.flat = fk < 1 ? ei(fk) : 1 + wob(fk - 1, 4, 8) * 0.05; }
        if (t > T.bonk && t < T.bonk + 0.6) p.sq = (p.sq || 1) * (1 + 0.06 * wob(t - T.bonk, 5, 7));
        return p; }); g.restore(); puff(g, TB.x, TB.y + 6, (t - T.slam) / 0.7, 14, 46, 7); }
    // him: idle, proud, the fright, side eye at the motor, the bonk, seeing stars
    const pose = { t, wave: 0.55, waveF: 1.7, amb: [0.8, 0.78, 0.9], rim: [1, 0.66, 0.32], rimDir: [-1, -0.6], rimAmt: 1.1 }; let sy = SQ.y, sx = SQ.x, h = SQ.h;
    pose.lean = 0.04 * Math.sin(t * 1.4); const bl = Math.max(bump(t - 0.45, 0.14), bump(t - 4.6, 0.14)); pose.lidL = pose.lidR = 0.25 + bl * 0.75;
    if (t > 0.7 && t < T.slam) { const pk = eo((t - 0.7) / 0.2); pose.sq = 1 + 0.08 * pk; pose.eye = 1 + 0.06 * pk; pose.lidL = pose.lidR = 0.1; }
    if (t >= T.slam && t < T.win) { const fk = t - T.slam; sy -= bump(fk, 0.32) * 70; pose.sq = fk < 0.05 ? 0.75 : 1 + 0.18 * bump(fk, 0.32); pose.splay = 0.9 * Math.exp(-fk * 2.5); pose.eye = 1.4 - 0.25 * cl((fk - 0.35) / 0.3); pose.lidL = pose.lidR = 0; pose.wave = 1.4;
      if (fk > 0.38) { const sk = eo((fk - 0.38) / 0.15); pose.lean = 0.16 * sk; pose.lidL = 0.45 * sk; pose.lidR = 0.3 * sk; pose.eye = 1.1; } }
    if (t >= T.win && t < T.bonk) { pose.lean = lerp(0.16, -0.12, eo((t - T.win) / 0.3)); pose.lidL = pose.lidR = 0.2; pose.eye = 1.25; }
    if (t >= T.bonk) { const bk = t - T.bonk; pose.sq = bk < 0.06 ? 0.68 : 1 - 0.14 * Math.exp(-bk * 6) * Math.cos(bk * 26); pose.eye = 1.05; pose.lidL = 0.55 + 0.1 * Math.sin(bk * 6); pose.lidR = 0.3 + 0.1 * Math.cos(bk * 5); pose.lean = 0.1 * Math.sin(bk * 4.5) * Math.exp(-bk * 0.6); pose.droop = 0.4; pose.wave = 0.3; }
    // shadow on the road, then him with the picture's ink line
    g.save(); g.fillStyle = 'rgba(6,4,12,0.6)'; g.beginPath(); g.ellipse(sx + 14, SQ.y + 2, h * 0.36 * (1 - 0.3 * (SQ.y - sy) / 70), h * 0.06, 0, 0, Math.PI * 2); g.fill(); g.restore();
    squidComic(g, sx, sy, h, pose, k);
    // the shout
    if (t > T.shout && t < T.shut) shout(g, 640, 360, 300, 150, 'SHUT IT!', t - T.shout, [-150, 60]);
    // the slipper: thrown from the window, spinning, off his heid, bouncing away down the road
    if (t > T.throw && t < T.end) { const top = Squid.point('top', sx, sy, h, pose); let px, py, rot; const A = [WINR.x1 + 10, WINR.y1 - 60], B = [top[0] - 10, top[1] + 20];
      if (t < T.bonk) { const f = (t - T.throw) / (T.bonk - T.throw); px = lerp(A[0], B[0], f); py = lerp(A[1], B[1], f) - Math.sin(Math.PI * f) * 180; rot = f * 14; }
      else { const f = (t - T.bonk) / 0.7; if (f < 1) { px = B[0] + 260 * eo(f); py = lerp(B[1], SQ.y - 12, f) - Math.sin(Math.PI * f) * 150; rot = 14 + f * 9; } else { px = B[0] + 260; py = SQ.y - 12; rot = 1.7; } }
      g.save(); g.translate(px, py); g.rotate(rot); slipperShape(g, 0.85); g.restore(); }
    // POW at the bonk, stars after
    if (t > T.bonk && t < T.bonk + 0.32) { const top = Squid.point('top', sx, sy, h, pose); shout(g, top[0] + 60, top[1] - 40, 150, 80, 'BONK', (t - T.bonk) + 0.05, null); }
    if (t > T.bonk + 0.2) { const top = Squid.point('top', sx, sy, h, pose); stars(g, top[0], top[1] + 12, h * 0.32, t, cl((t - T.bonk - 0.2) / 0.15)); }
    if (alarm && t < T.win) { /* a wee "WEE-OO" off the motor */ shout(g, 1330, 470, 170, 72, 'WEE-OO', 0.3, null); }
    g.restore();
    // finish: a soft vignette and grain over everything, then the words that sit on the screen
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    const r = rng(1 + Math.floor(t * 24)); g.globalAlpha = 0.045; for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * W, r() * H, 2, 2); } g.restore();
    caption(g, W, H, o.line, t - T.line); streetSign(g, W, H, o.episode, o.kicker, t - T.end + 0.4);
    if (t < 0.25) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`; g.fillRect(0, 0, W, H); g.restore(); }
    return true; }
  return { ready, shutIt, S, PW, PH, TITLE };
})();

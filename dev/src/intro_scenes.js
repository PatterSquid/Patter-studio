/* IntroScenes: the intro cut scene. His own Coatbridge street picture (assets/coatbridge-street.jpg, COAT_STREET) is the
   set, brought to life (lamps, moon), with his own icon (Squid) as the star, given the same dark comic outline as the
   picture. "Swally": he necks a bottle of tonic wine (made up label, Auld Patter: no real brand), staggers about,
   goes green, and spews ink all over the lens; the ink carries PatterSquid and the episode name.
   Pure functions of time: swally(g, t, W, H, o) with o = { name, line, episode, kicker }. */
const IntroScenes = (() => {
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f;
  const ease = f => { f = cl(f); return f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; }, eo = f => 1 - Math.pow(1 - cl(f), 3), ei = f => Math.pow(cl(f), 3);
  const eb = f => { f = cl(f); const c = 1.7; return 1 + (c + 1) * Math.pow(f - 1, 3) + c * Math.pow(f - 1, 2); }, sm = f => { f = cl(f); return f * f * (3 - 2 * f); };
  const bump = (k, w) => k < 0 || k > w ? 0 : Math.sin(Math.PI * k / w);
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  // keyframes: [[t, v], ...] eased between (smooth in and out), for every moving value
  const key = (t, K, e = ease) => { if (t <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (t < K[i + 1][0]) { const f = (t - K[i][0]) / (K[i + 1][0] - K[i][0]); return lerp(K[i][1], K[i + 1][1], (K[i][2] || e)(f)); } return K[K.length - 1][1]; };
  const INK = '#15121a', TITLE = '"Bricolage Grotesque", "Segoe UI Black", "Arial Black", sans-serif';
  const PW = 1672, PH = 941;
  let plate = null, soft = null, readyP = null;
  function ready() { return readyP || (readyP = Promise.all([typeof COAT_STREET !== 'undefined' ? fetch(COAT_STREET).then(r => r.blob()).then(createImageBitmap).then(b => { plate = b; soft = mk(PW, PH); const x = soft.getContext('2d'); x.filter = 'blur(2.2px)'; x.drawImage(b, 0, 0); }) : null, typeof Squid !== 'undefined' ? Squid.ready() : null, typeof PatterFonts !== 'undefined' ? PatterFonts.ready() : null]).catch(() => null)); }
  function camTo(g, W, H, c) { const z = Math.max(1, c.z), k = Math.max(W / PW, H / PH) * z, hw = W / 2 / k, hh = H / 2 / k, x = cl(c.x, hw, PW - hw), y = cl(c.y, hh, PH - hh); g.setTransform(k, 0, 0, k, W / 2 - x * k, H / 2 - y * k); return k; }
  function glow(g, x, y, r, col, a) { if (a <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a.toFixed(3))); gr.addColorStop(1, col.replace('A', '0')); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  /* ---------- his icon with the picture's ink outline ---------- */
  const SB = { a: null, b: null };
  function squidComic(g, x, y, h, pose, k) { if (typeof Squid === 'undefined') return; const s = Math.ceil(h * 2.4 * Math.max(1, k)), sc = s / (h * 2.4);
    if (!SB.a || SB.a.width < s) { SB.a = mk(s, s); SB.b = mk(s, s); } const a = SB.a.getContext('2d'), b = SB.b.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, SB.a.width, SB.a.height);
    if (!Squid.draw(a, s / 2, s * 0.8, h * sc, pose)) return; b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, SB.b.width, SB.b.height); b.drawImage(SB.a, 0, 0); b.globalCompositeOperation = 'source-in'; b.fillStyle = INK; b.fillRect(0, 0, s, s); b.globalCompositeOperation = 'source-over';
    const ox = x - s / 2 / sc, oy = y - s * 0.8 / sc, ow = h * 0.014; for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; g.drawImage(SB.b, 0, 0, s, s, ox + Math.cos(an) * ow, oy + Math.sin(an) * ow, s / sc, s / sc); }
    g.drawImage(SB.a, 0, 0, s, s, ox, oy, s / sc, s / sc); }
  /* ---------- the bottle: dark glass, a made up label ---------- */
  let BOT = null; function bottle() { if (BOT) return BOT; const c = mk(120, 330), g = c.getContext('2d'), cx = 60; g.lineJoin = 'round';
    const body = () => { g.beginPath(); g.moveTo(cx - 12, 8); g.lineTo(cx + 12, 8); g.lineTo(cx + 12, 80); g.bezierCurveTo(cx + 14, 112, cx + 50, 118, cx + 50, 150); g.lineTo(cx + 50, 300); g.quadraticCurveTo(cx + 50, 322, cx + 30, 322); g.lineTo(cx - 30, 322); g.quadraticCurveTo(cx - 50, 322, cx - 50, 300); g.lineTo(cx - 50, 150); g.bezierCurveTo(cx - 50, 118, cx - 14, 112, cx - 12, 80); g.closePath(); };
    body(); const gl = g.createLinearGradient(cx - 50, 0, cx + 50, 0); gl.addColorStop(0, '#1d2416'); gl.addColorStop(0.35, '#3c4a26'); gl.addColorStop(1, '#141a10'); g.fillStyle = gl; g.fill();
    g.save(); body(); g.clip(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx - 36, 130, 9, 180); g.fillRect(cx - 7, 12, 5, 70); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 30, 120, 30, 210);
    // the label: cream, red bands, made up words
    g.fillStyle = '#efe4c8'; g.fillRect(cx - 50, 176, 100, 104); g.fillStyle = '#b3141b'; g.fillRect(cx - 50, 176, 100, 18); g.fillRect(cx - 50, 266, 100, 14);
    g.fillStyle = '#f6efe0'; g.font = `700 13px ${TITLE}`; g.textAlign = 'center'; g.fillText('AULD PATTER', cx, 190); g.fillStyle = '#3a2a1a'; g.font = `700 22px ${TITLE}`; g.fillText('Tonic', cx, 226); g.fillText('Wine', cx, 250); g.font = `400 9px ${TITLE}`; g.fillStyle = '#fff'; g.fillText('a wee swally', cx, 276);
    g.restore(); body(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.fillStyle = '#c9a43a'; g.fillRect(cx - 14, 2, 28, 14); g.strokeRect(cx - 14, 2, 28, 14);
    return (BOT = c); }
  /* ---------- ink on the lens: blobs merged soft then cut sharp, drips that run, gloss on the edges ---------- */
  let IC = null; function inkSplat(g, W, H, k, run, seed, cx, cy) { if (k <= 0) return; const w = Math.ceil(W / 3), h = Math.ceil(H / 3); if (!IC || IC.a.width !== w || IC.a.height !== h) IC = { a: mk(w, h), b: mk(w, h) };
    const a = IC.a.getContext('2d'), r = rng(seed), R = h * 0.5 * eo(k / 0.16); a.clearRect(0, 0, w, h); a.fillStyle = '#000'; a.beginPath(); a.ellipse(w * cx, h * cy, R * 1.45, R, 0, 0, Math.PI * 2); a.fill();
    for (let i = 0; i < 44; i++) { const an = r() * Math.PI * 2, L = R * (0.9 + r() * 1.3) * eo(k / (0.1 + r() * 0.14)); for (let s = 0; s < 8; s++) { const f = s / 7, d = R * 0.5 + (L - R * 0.5) * f, rad = R * (0.16 - 0.12 * f) * (0.6 + r() * 0.6); a.beginPath(); a.arc(w * cx + Math.cos(an) * d * 1.45, h * cy + Math.sin(an) * d, rad, 0, Math.PI * 2); a.fill(); }
      if (r() < 0.6) { a.beginPath(); a.arc(w * cx + Math.cos(an) * (L + R * 0.3) * 1.45, h * cy + Math.sin(an) * (L + R * 0.3), R * 0.04 + r() * R * 0.05, 0, Math.PI * 2); a.fill(); } }
    for (let i = 0; i < 26; i++) { const px = w * cx + (r() - 0.5) * R * 2.6, y0 = h * cy + (r() - 0.1) * R * 0.5, l = Math.min(h, run * (0.4 + r()) * h * 0.6), ww = R * (0.025 + r() * 0.035); if (l < 1) continue; a.fillRect(px - ww, y0, ww * 2, l); a.beginPath(); a.arc(px, y0 + l, ww * 1.6, 0, Math.PI * 2); a.fill(); }
    const b = IC.b.getContext('2d'); b.clearRect(0, 0, w, h); b.filter = `blur(${Math.max(1, h / 150)}px)`; b.drawImage(IC.a, 0, 0); b.filter = 'none'; const im = b.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = cl((d[i + 3] / 255 - 0.42) / 0.1); d[i] = 9; d[i + 1] = 8; d[i + 2] = 16; d[i + 3] = v * 255; } b.putImageData(im, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(IC.b, 0, 0, W, H); g.globalCompositeOperation = 'source-atop'; const gl = g.createLinearGradient(0, 0, W * 0.7, H); gl.addColorStop(0, 'rgba(150,140,190,0.32)'); gl.addColorStop(0.45, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); g.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = 'rgba(235,235,255,0.4)'; g.lineCap = 'round'; g.lineWidth = Math.max(2, H / 180); for (let i = 0; i < 7; i++) { const x = W * (cx + (r() - 0.5) * 0.36), y = H * (cy + (r() - 0.5) * 0.34); g.beginPath(); g.arc(x, y, H * (0.03 + r() * 0.05), 3.6, 4.5); g.stroke(); } g.restore(); }
  // PatterSquid in the ink, then the episode under it
  function titleCard(g, W, H, k, name, ep, kick, line) { if (k <= 0) return; const u = H / 1080; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const s = k < 0.14 ? lerp(1.5, 0.94, ei(k / 0.14)) : 1 - 0.06 * Math.exp(-(k - 0.14) * 10) * Math.cos((k - 0.14) * 34); let fs = 230 * u; g.font = `700 ${fs}px ${TITLE}`; while (g.measureText(name).width > W * 0.78) { fs -= 4; g.font = `700 ${fs}px ${TITLE}`; }
    const ty = ep ? H * 0.43 : H * 0.5; g.translate(W / 2, ty); g.rotate(-0.035); g.scale(s, s); g.globalAlpha = cl(k / 0.05); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(name, 8 * u, 12 * u); g.lineWidth = fs * 0.12; g.strokeStyle = '#08070c'; g.strokeText(name, 0, 0); const fg = g.createLinearGradient(0, -fs / 2, 0, fs / 2); fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.55, '#f1eadb'); fg.addColorStop(0.56, '#ddd2bc'); fg.addColorStop(1, '#cfc1a4'); g.fillStyle = fg; g.fillText(name, 0, 0); g.restore();
    const ek = k - 0.3; if (ep && ek > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); let es = 74 * u; g.font = `700 ${es}px ${TITLE}`; while (g.measureText(ep).width > W * 0.7) { es -= 2; g.font = `700 ${es}px ${TITLE}`; }
      g.translate(W / 2, H * 0.63); g.rotate(-0.02); const sc = eb(ek / 0.22); g.scale(sc, sc); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      if (kick) { g.font = `700 ${es * 0.45}px ${TITLE}`; g.fillStyle = '#ffd23b'; g.fillText(kick.toUpperCase(), 0, -es * 0.95); g.font = `700 ${es}px ${TITLE}`; }
      g.lineWidth = es * 0.14; g.strokeStyle = '#08070c'; g.strokeText(ep, 0, 0); g.fillStyle = '#ffd23b'; g.fillText(ep, 0, 0); g.restore(); }
    const lk = k - (ep ? 0.6 : 0.35); if (line && lk > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); let ls = 44 * u; g.font = `400 ${ls}px ${TITLE}`; while (g.measureText(line).width > W * 0.6) { ls -= 2; g.font = `400 ${ls}px ${TITLE}`; } g.globalAlpha = cl(lk / 0.3); g.textAlign = 'center'; g.fillStyle = '#e9e2d2'; g.fillText(line, W / 2, ep ? H * 0.74 : H * 0.64); g.restore(); } }

  /* ---------- "Swally" ---------- */
  // beats (seconds): lift the bottle, glug glug glug, ahh, hic, stagger, drop the bottle, go green, hurk hurk, SPEW, title
  const B = { lift: 0.35, glug: 0.75, down: 2.0, ahh: 2.15, hic: 2.6, walk: 2.85, drop: 3.55, green: 3.7, hurk1: 4.25, hurk2: 4.6, spew: 4.95, splat: 5.15, end: 6.8 };
  const HOME = { x: 905, y: 852 };
  function pose(t) { const p = { t, wave: 0.5, waveF: 1.6, amb: [0.86, 0.84, 0.94], rim: [1, 0.66, 0.32], rimDir: [-1, -0.6], rimAmt: 1.0 };
    // the arm and the bottle: at his side, up to his gub, tipped back, down, then let go
    p.armA = key(t, [[0, 0.95], [B.lift, 0.95], [B.glug, -1.72], [B.down, -1.8], [B.ahh + 0.1, 0.7], [B.drop - 0.05, 0.75], [B.drop + 0.1, 0.25]]);
    p.armCurl = key(t, [[0, 1.0], [B.lift, 1.0], [B.glug, -0.35], [B.down, -0.3], [B.ahh + 0.1, 0.9], [B.drop, 0.9], [B.drop + 0.15, 1.6]]);
    p.armLen = key(t, [[0, 112], [B.lift, 112], [B.glug, 78], [B.down, 78], [B.ahh + 0.1, 112]]);
    const g3 = t > B.glug && t < B.down ? Math.abs(Math.sin((t - B.glug) / (B.down - B.glug) * Math.PI * 3)) : 0;
    p.lean = key(t, [[0, 0], [B.lift, 0.03], [B.glug, -0.14], [B.down - 0.1, -0.2], [B.ahh, -0.05], [B.hic, 0]]);
    p.sq = 1 - 0.035 * g3 + 0.06 * bump(t - B.ahh, 0.35) - 0.12 * bump(t - B.hic, 0.12) + 0.08 * bump(t - B.hic - 0.1, 0.2);
    p.lidL = p.lidR = t < B.glug ? key(t, [[0, 0.3], [B.lift, 0.2], [B.glug, 0.9]]) : t < B.down ? 0.95 : t < B.hic ? key(t, [[B.down, 1], [B.ahh + 0.4, 0.95], [B.hic, 0.6]]) : 0.55;
    p.eye = 1 + 0.25 * bump(t - B.hic, 0.25);
    // the stagger: drifting this way and that, the body slow to catch up, the eyes going their own way
    if (t > B.walk) { const w = t - B.walk; p.lean = (p.lean || 0) + 0.2 * Math.sin(w * 4.1) * sm(w / 0.3) + 0.08 * Math.sin(w * 9.3) * sm(w / 0.5); p.lidL = 0.5 + 0.25 * Math.sin(w * 3); p.lidR = 0.65 + 0.2 * Math.cos(w * 2.3); p.wave = 1.3; p.sq = (p.sq || 1) + 0.04 * Math.sin(w * 8.2); }
    // green, then the heaves: a big suck in, eyes out, the lot
    if (t > B.green) { const gk = sm((t - B.green) / 0.5); p.amb = [lerp(0.86, 0.74, gk), lerp(0.84, 0.93, gk), lerp(0.94, 0.7, gk)]; }
    const h1 = bump(t - B.hurk1, 0.28), h2 = bump(t - B.hurk2, 0.3); p.sq -= 0.16 * (h1 + h2); p.eye += 0.3 * (h1 + h2); if (t > B.hurk1 - 0.1) { p.lidL = p.lidR = 0.1 + 0.3 * (1 - h1 - h2); p.lean = 0.12 * (h1 + h2) + 0.05 * Math.sin(t * 7); }
    if (t > B.spew - 0.18) { const sk = t - (B.spew - 0.18); p.sq = sk < 0.18 ? lerp(0.8, 0.62, ei(sk / 0.18)) : 1.35 - 0.15 * eo((sk - 0.18) / 0.2); p.splay = sk > 0.18 ? 0.9 : 0; p.eye = sk > 0.18 ? 1.45 : 1.2; p.lidL = p.lidR = 0; p.lean = sk < 0.18 ? -0.18 : 0.12; }
    return p; }
  function where(t) { // where he stands (plate coords), and the camera
    let x = HOME.x, y = HOME.y; if (t > B.walk) { const w = t - B.walk; x += 70 * Math.sin(w * 1.9) * sm(w / 0.6) + 18 * Math.sin(w * 5.3); y += 6 * Math.abs(Math.sin(w * 6)); }
    const hop = bump(t - B.hic, 0.24) * 30; y -= hop; const drift = 0.5 + 0.5 * Math.sin(t * 0.7);
    const cam = { x: lerp(x, HOME.x, 0.5) + 10 * Math.sin(t * 0.9), y: 640 + 8 * Math.sin(t * 1.1), z: key(t, [[0, 1.55], [B.walk, 1.7], [B.hurk1, 1.85], [B.spew - 0.2, 2.0], [B.spew, 2.35]]) + 0.01 * drift };
    if (t > B.spew) { const s = bump(t - B.spew, 0.3) * 12; cam.x += Math.sin(t * 90) * s; cam.y += Math.cos(t * 77) * s; }
    return { x, y, cam }; }
  function swally(g, t, W, H, o = {}) { if (!plate) return false; const name = o.name || 'PatterSquid', P = pose(t), Wh = where(t);
    g.save(); const k = camTo(g, W, H, Wh.cam); g.drawImage(Wh.cam.z > 1.3 ? soft : plate, 0, 0, PW, PH);
    g.save(); g.globalCompositeOperation = 'screen'; [[757, 178, 150], [1142, 352, 90], [1043, 458, 55]].forEach(([x, y, r], i) => glow(g, x, y, r, 'rgba(255,170,80,A)', 0.3 + 0.05 * Math.sin(t * 7 + i * 2))); glow(g, 1060, 112, 130, 'rgba(190,210,255,A)', 0.2); g.restore();
    // lamp light falling on him from the left lamp
    g.save(); g.globalCompositeOperation = 'soft-light'; glow(g, Wh.x - 120, Wh.y - 260, 380, 'rgba(255,170,90,A)', 0.55); g.restore();
    const h = 300;
    // the dropped bottle: falls, clinks, rolls away
    if (t > B.drop) { const dk = t - B.drop, W0 = where(B.drop), hp = Squid.point('hand', W0.x, W0.y, h, pose(B.drop)); const fy = Math.min(1, dk / 0.3), x = hp[0] + 40 * eo(dk / 0.3) + Math.max(0, dk - 0.3) * 120 * Math.exp(-(dk - 0.3) * 0.8), y = lerp(hp[1], HOME.y + 4, ei(fy)) - (dk > 0.3 ? bump(dk - 0.3, 0.2) * 14 : 0), rot = dk < 0.3 ? dk * 4 : Math.PI / 2 + (dk - 0.3) * 4 * Math.exp(-(dk - 0.3) * 0.8);
      g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(bottle(), -24, -132, 48, 132); g.restore(); }
    // his shadow, then him (the bottle is drawn in his tentacle, inside his outline)
    g.save(); g.fillStyle = 'rgba(6,4,12,0.6)'; g.beginPath(); g.ellipse(Wh.x + 12, HOME.y + 4, h * 0.36 * (1 - 0.3 * (HOME.y - Wh.y) / 30), h * 0.06, 0, 0, Math.PI * 2); g.fill(); g.restore();
    const holding = t < B.drop; P.postArm = holding ? (gg) => { const hd = Squid.hand(P); gg.save(); gg.translate(hd.x, hd.y); const ba = key(t, [[0, 0.1], [B.lift, 0.1], [B.glug, -2.25], [B.down - 0.15, -2.45], [B.ahh + 0.1, 0.15], [B.drop, 0.3]]); gg.rotate(ba); gg.drawImage(bottle(), -27, -92, 54, 150); gg.restore(); } : null;
    if (t < B.splat + 0.1) squidComic(g, Wh.x, Wh.y, h, P, k);
    let mouthS = null; if (t > B.spew) { const m = Squid.point('mouth', Wh.x, Wh.y, h, P), M = g.getTransform(); mouthS = [M.a * m[0] + M.e, M.d * m[1] + M.f]; }
    g.restore();
    // finish: vignette, grain
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    const rr = rng(1 + Math.floor(t * 24)); g.globalAlpha = 0.04; for (let i = 0; i < 500; i++) { g.fillStyle = rr() < 0.5 ? '#000' : '#fff'; g.fillRect(rr() * W, rr() * H, 2, 2); } g.restore();
    // the spew: a jet of ink blobs out of his gub, growing as they come at the lens
    if (mouthS && t < B.splat + 0.12) { const r = rng(5), sk = t - B.spew; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0a12'; g.strokeStyle = 'rgba(160,150,200,0.35)'; g.lineWidth = Math.max(1, H / 400);
      for (let i = 0; i < 46; i++) { const t0 = r() * 0.16, life = 0.16 + r() * 0.1, f = (sk - t0) / life, tx = W * (0.5 + (r() - 0.5) * 0.9), ty = H * (0.5 + (r() - 0.5) * 0.8), rad = H * (0.006 + 0.004 * r()) * Math.pow(30, cl(f)); if (f <= 0 || f > 1.2) continue;
        const ff = eo(cl(f)), x = lerp(mouthS[0], tx, ff), y = lerp(mouthS[1], ty, ff) - Math.sin(Math.PI * cl(f)) * H * 0.05; g.beginPath(); g.ellipse(x, y, rad * 1.1, rad, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.5, 3.6, 4.6); g.stroke(); } g.restore(); }
    // SPLAT on the lens, the name in the ink
    if (t > B.splat) { const sk = t - B.splat; inkSplat(g, W, H, sk + 0.04, sk * 0.45, 8, 0.5, 0.5); titleCard(g, W, H, sk - 0.12, name, o.episode, o.kicker, o.line); }
    if (t < 0.25) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`; g.fillRect(0, 0, W, H); g.restore(); }
    return true; }
  return { ready, swally, B, PW, PH, TITLE };
})();

/* The Intro tab: branded PatterSquid openers in four styles, every word editable (the name, a line for each style, and
   an episode title with a wee label above it).
     ink       a drop of squid ink lands and blooms in slow motion into his disc; the name is soaked into the paper, the
               letters knocking out white where they cross the ink; then one fat drip runs off the last letter and splats
     battered  his squid goes into the chip shop fryer, comes out battered and lands on the chip paper with salt and vinegar;
               the name slapped on like shop signage
     neon      night, a red sandstone tenement; a light box with his logo flickers on, the name buzzes on in neon letter by
               letter, then one letter blows in a shower of sparks; an episode title goes up as a fly poster
     epic      an overblown heavenly studio opener (god rays, gold, a choir) until a tentacle reaches in, everything cuts dead,
               and the logo is slapped on squint
   Like every tab it is a pure function of time. Its sound is made here from the same moments (Intro.sound), saved
   as a WAV, and played under the clip when it is used in the Video tab. */
const Intro = (() => {
  const STYLES = [['swally', 'Chucked oot']]; // the old ink, battered, neon and epic openers are kept below only so nothing breaks; he rejected them
  const LINES = { swally: '', ink: 'QUALITY PATTER. NAE PISH.', battered: 'ABSOLUTELY BATTERED.', neon: 'Open till late. Unfortunately.', epic: 'AWRIGHT. THAT’LL DAE.' };
  const BASE = { swally: typeof IntroScenes !== 'undefined' ? IntroScenes.B.end : 10.6, ink: 5.2, battered: 6.0, neon: 5.8, epic: 5.8 }, EP = 1.6;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f, sm = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
  const eo = x => 1 - Math.pow(1 - cl(x, 0, 1), 3), eo5 = x => 1 - Math.pow(1 - cl(x, 0, 1), 5), ei = x => Math.pow(cl(x, 0, 1), 2), eio = x => { x = cl(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const spring = (k, amp, w, d) => k < 0 ? 0 : amp * Math.exp(-k * d) * Math.cos(k * w);
  const rng = seed => { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mk = (w, h) => { w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h)); return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); };
  const HEAVY = '"Arial Black", "Segoe UI Black", Impact, "Helvetica Neue", Arial, sans-serif', COND = 'Bahnschrift, "Arial Narrow", "Segoe UI", Arial, sans-serif', SERIF = 'Georgia, Cambria, "Times New Roman", serif', SCRIPT = '"Segoe Script", "Brush Script MT", "Comic Sans MS", cursive', MARK = '"Segoe Print", "Comic Sans MS", "Segoe Script", cursive';

  function defaults() { return { style: 'swally', name: 'PatterSquid', lines: Object.assign({}, LINES), kicker: '', episode: '', hold: 0.8, logo: true, blow: 'auto', label: '', sound: { on: true, vol: 0.9 } }; }
  const lineOf = cfg => { const L = cfg.lines && typeof cfg.lines === 'object' ? cfg.lines[styleOf(cfg)] : null; return L == null ? LINES[styleOf(cfg)] : String(L); };
  const styleOf = cfg => STYLES.some(s => s[0] === cfg.style) ? cfg.style : 'swally';
  const nameOf = cfg => String(cfg.name == null || cfg.name === 'PATTERSQUID' ? 'PatterSquid' : cfg.name).slice(0, 24);
  const epOf = cfg => String(cfg.episode || '').trim().slice(0, 80);
  const mainLen = cfg => BASE[styleOf(cfg)] + (epOf(cfg) ? EP : 0);
  function duration(cfg) { return mainLen(cfg) + cl(+cfg.hold || 0, 0, 10); }

  // His logo
  let logo = null, readyP = null;
  function ready() { if (readyP) return readyP; readyP = (async () => { if (typeof IntroScenes !== 'undefined') await IntroScenes.ready(); if (typeof STUDIO_LOGO === 'undefined') return null; try { logo = await createImageBitmap(await (await fetch(STUDIO_LOGO)).blob()); } catch (e) { logo = null; } return logo; })(); return readyP; }
  if (typeof window !== 'undefined' || typeof self !== 'undefined') setTimeout(ready, 0);
  // The disc on its own, round (the logo fills its picture; its circle is about 250 of 256 across)
  function discAt(g, x, y, R, o = {}) { if (!logo) { ready(); g.fillStyle = '#0b2f66'; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); return; } g.save(); g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.clip(); g.drawImage(logo, x - R * 1.03, y - R * 1.03, R * 2.06, R * 2.06); g.restore();
    if (o.rim) { g.lineWidth = o.rim; g.strokeStyle = o.rimCol || '#f4f2ee'; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke(); } }
  // Fit text to a width
  function fitFont(g, text, weight, family, size, maxW) { g.font = weight + ' ' + size.toFixed(1) + 'px ' + family; const w = g.measureText(text).width; if (w > maxW && w > 0) { size *= maxW / w; g.font = weight + ' ' + size.toFixed(1) + 'px ' + family; } return size; }
  function spaced(g, text, x, y, sp, align) { const ws = [...text].map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + sp * Math.max(0, text.length - 1); let px = align === 'center' ? x - tot / 2 : x; const al = g.textAlign; g.textAlign = 'left'; [...text].forEach((c, i) => { g.fillText(c, px, y); px += ws[i] + sp; }); g.textAlign = al; return tot; }

  const layout = (W, H) => { const u = Math.min(W / 1200, H / 1080), cx = W / 2, cy = H / 2; return { u, cx, cy, W, H }; };

  /* ================= INK ================= */
  const INK = { drop: 0.15, hit: 0.5, disc: 1.05, word: 1.55, line: 2.35, bead: 3.2, fall: 3.9, land: 4.3 };
  const PAPER = '#ece5d6', INKC = '#0b1120';
  const paperCache = {}; function paper(W, H) { const key = W + 'x' + H; if (paperCache.key === key) return paperCache.c; const c = mk(W, H), g = c.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, W, H); const r = rng(5), n = Math.round(W * H / 900);
    for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, l = 3 + r() * 14, a = r() * Math.PI; g.strokeStyle = r() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,255,0.12)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,50,30,0.32)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); paperCache.key = key; paperCache.c = c; return c; }
  // The ink, worked out at half size as soft blobs and then cut sharp (so the tendrils and splashes melt into one another)
  const inkBuf = {};
  function inkMask(t, L, cfg, o3) {
    const { u, cx, cy, W, H } = L, k = 0.5, w = Math.ceil(W * k), h = Math.ceil(H * k); let c = inkBuf.c; if (!c || c.width !== w || c.height !== h) { c = inkBuf.c = mk(w, h); inkBuf.out = mk(w, h); }
    const g = c.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = '#fff';
    const e = t - INK.hit, P = [cx, cy - 70 * u];
    if (t >= INK.drop && e < 0 && !o3) { const f = cl((t - INK.drop) / (INK.hit - INK.drop), 0, 1), y = lerp(-40 * u, P[1], f * f); g.beginPath(); g.ellipse(P[0], y, 9 * u, 9 * u * (1 + f * 1.4), 0, 0, Math.PI * 2); g.fill(); }
    if (e >= 0) {
      // The body: a wobbling round blob growing out from where the drop hit
      const R = 205 * u * eo5(e / 1.1) + 14 * u, r = rng(31); g.beginPath(); for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, wob = 1 + 0.06 * Math.sin(a * 5 + 1.3) + 0.04 * Math.sin(a * 9 + e * 0.6) + 0.03 * Math.sin(a * 13 + 2); const x = P[0] + Math.cos(a) * R * wob, y = P[1] + Math.sin(a) * R * wob; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill();
      // Tendrils: eight arms that shoot out and curl into spirals like a squid's, thinning to points, kept off the words below
      const arms = [-2.75, -2.1, -1.55, -1.0, -0.38, 0.32, 2.85, 2.25]; arms.forEach((a0, k2) => { const grow = eo5((e - 0.03 * k2) / 1.3); if (grow <= 0) return; const len = (210 + r() * 120) * u * grow, sgn = r() < 0.5 ? -1 : 1, turn = (2.4 + r() * 1.4) * sgn, wid = (30 + r() * 12) * u;
        let x = P[0] + Math.cos(a0) * R * 0.75, y = P[1] + Math.sin(a0) * R * 0.75, h = a0; const N2 = 60, ds = len / N2;
        for (let s2 = 0; s2 <= N2; s2++) { const f = s2 / N2, rr = wid * Math.pow(1 - f, 0.85) + 2.6 * u; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); h = a0 + turn * Math.pow(f, 2.2) * grow; x += Math.cos(h) * ds; y += Math.sin(h) * ds; } });
      // A few short stubby splashes downwards that stop short of the name
      [1.25, 1.75, 1.95].forEach((a0, k2) => { const d = R * (0.95 + 0.25 * eo5(e / 0.9)), x = P[0] + Math.cos(a0) * d, y = P[1] + Math.sin(a0) * d; g.beginPath(); g.arc(x, y, (16 - k2 * 3) * u * eo5(e / 0.7), 0, Math.PI * 2); g.fill(); });
      // Splashes: thrown out fast and slowing, most of them up and out to the sides
      for (let i = 0; i < 46; i++) { let a = r() * Math.PI * 2; if (a > 0.6 && a < 2.5) a -= Math.PI; const sp = (260 + r() * 460) * u, d = R * 0.8 + sp * eo5((e - r() * 0.05) / 0.9), sz = (2 + r() * r() * 12) * u, x = P[0] + Math.cos(a) * d, y = P[1] + Math.sin(a) * d; if (e < 0.02) continue; g.beginPath(); g.ellipse(x, y, sz * (1 + (r() < 0.3 ? 1.8 : 0.2)), sz, a, 0, Math.PI * 2); g.fill(); }
    }
    // The drip: a bead swells under the last letter, stretches on a neck, lets go, falls and splats
    const D = dripPos(t, L, cfg); if (D) { if (D.neck) { g.beginPath(); g.moveTo(D.x - D.nw, D.y0); g.quadraticCurveTo(D.x - D.nw * 0.3, (D.y0 + D.y) / 2, D.x - D.r * 0.6, D.y - D.r * 0.4); g.lineTo(D.x + D.r * 0.6, D.y - D.r * 0.4); g.quadraticCurveTo(D.x + D.nw * 0.3, (D.y0 + D.y) / 2, D.x + D.nw, D.y0); g.closePath(); g.fill(); }
      g.beginPath(); g.ellipse(D.x, D.y, D.r, D.r * D.sy, 0, 0, Math.PI * 2); g.fill();
      if (D.splat > 0) { const rs = rng(77), sp = D.splat; g.beginPath(); g.ellipse(D.x, D.ly, 34 * u * eo5(sp / 0.5), 12 * u * eo5(sp / 0.5), 0, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 18; i++) { const a = Math.PI + rs() * Math.PI, d = (40 + rs() * 120) * u * eo5(sp / 0.45), s2 = (2 + rs() * 6) * u; g.beginPath(); g.arc(D.x + Math.cos(a) * d, D.ly + Math.sin(a) * d * 0.35, s2, 0, Math.PI * 2); g.fill(); } } }
    // Soften, then cut sharp with a smooth edge
    const o = inkBuf.out, og = o.getContext('2d', { willReadFrequently: true }); og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, w, h); og.filter = 'blur(' + (5 * u * k * 2).toFixed(1) + 'px)'; og.drawImage(c, 0, 0); og.filter = 'none';
    if (o3) return o; const im = og.getImageData(0, 0, w, h), d = im.data; for (let i = 3; i < d.length; i += 4) { const a = d[i] / 255, v = a <= 0.36 ? 0 : a >= 0.56 ? 1 : sm((a - 0.36) / 0.2); d[i] = v * 255; d[i - 1] = d[i - 2] = d[i - 3] = 255; } og.putImageData(im, 0, 0);
    return o;
  }
  // Where the name sits (the drip comes off its last letter)
  function inkWord(g, L, cfg) { const { u, cx, cy, W } = L, name = nameOf(cfg); const size = fitFont(g, name, '900', HEAVY, 148 * u, W * 0.86); const w = g.measureText(name).width; return { size, x0: cx - w / 2, x1: cx + w / 2, base: cy + 255 * u, name }; }
  function dripPos(t, L, cfg) {
    if (t < INK.bead) return null; const { u, H } = L, g = mk(4, 4).getContext('2d'), Wd = inkWord(g, L, cfg), x = Wd.x1 - Wd.size * 0.32, y0 = Wd.base + 2 * u, k = t - INK.bead;
    if (t < INK.fall) { const f = k / (INK.fall - INK.bead), r = 11 * u + 15 * u * eo(f), y = y0 + 8 * u + 90 * u * ei(f); return { x, y0, y, r, sy: 1.15 + 0.3 * f, neck: true, nw: 9 * u, splat: 0, ly: H - 70 * u }; }
    const ly = H - 70 * u, fk = t - INK.fall, yf = y0 + 98 * u + 0.5 * 4200 * u * fk * fk; if (t < INK.land && yf < ly) return { x, y0, y: yf, r: 22 * u, sy: 1.5, neck: false, splat: 0, ly };
    return { x, y0, y: ly + 4 * u, r: 0.1, sy: 1, neck: false, splat: t - INK.land, ly };
  }
  function drawInk(g, t, L, cfg) {
    const { u, cx, cy, W, H } = L, P = [cx, cy - 70 * u]; g.drawImage(paper(W, H), 0, 0);
    // Shadow of the drop as it comes down
    if (t > INK.drop && t < INK.hit) { const f = (t - INK.drop) / (INK.hit - INK.drop); g.fillStyle = 'rgba(40,30,20,' + (0.25 * f).toFixed(3) + ')'; g.beginPath(); g.ellipse(P[0], P[1] + 4 * u, 20 * u * (1.6 - f), 8 * u * (1.6 - f), 0, 0, Math.PI * 2); g.fill(); }
    const M = inkMask(t, L, cfg), e = t - INK.hit;
    // The ink: the mask filled dark, with a wet sheen across it and a hint of a darker edge
    const B = layerBuf('ink', W, H), bg = B.getContext('2d'); bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalCompositeOperation = 'source-over'; bg.clearRect(0, 0, W, H); bg.imageSmoothingQuality = 'high'; bg.drawImage(M, 0, 0, W, H);
    bg.globalCompositeOperation = 'source-in'; const ig = bg.createRadialGradient(P[0] - 90 * u, P[1] - 120 * u, 10 * u, P[0], P[1], 700 * u); ig.addColorStop(0, '#24314d'); ig.addColorStop(0.35, '#0f1729'); ig.addColorStop(1, INKC); bg.fillStyle = ig; bg.fillRect(0, 0, W, H);
    // His disc rises out of the middle of the ink
    if (cfg.logo !== false && t > INK.disc) { const f = eo((t - INK.disc) / 0.7), R = 168 * u; bg.globalCompositeOperation = 'source-atop'; bg.globalAlpha = f; bg.save(); bg.translate(P[0], P[1]); bg.scale(0.9 + 0.1 * f, 0.9 + 0.1 * f); discAt(bg, 0, 0, R); bg.restore(); bg.globalAlpha = 1;
      bg.strokeStyle = 'rgba(236,229,214,' + (0.9 * f).toFixed(3) + ')'; bg.lineWidth = 4 * u; bg.beginPath(); bg.arc(P[0], P[1], R * (0.9 + 0.1 * f) + 7 * u, 0, Math.PI * 2); bg.stroke(); }
    // A wet sheen catching the light along the upper left edges
    { const S2 = layerBuf('inksh', W, H), sg = S2.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, W, H); sg.drawImage(M, 0, 0, W, H); sg.globalCompositeOperation = 'destination-out'; sg.drawImage(M, 3 * u, 4 * u, W, H); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgba(150,175,220,0.55)'; sg.fillRect(0, 0, W, H);
      bg.globalCompositeOperation = 'source-atop'; bg.drawImage(S2, 0, 0); }
    // and a soft shadow of the ink's thickness on the paper
    g.save(); g.globalAlpha = 0.18; g.filter = 'blur(' + (4 * u).toFixed(1) + 'px)'; g.drawImage(M, 2 * u, 5 * u, W, H); g.restore();
    bg.globalCompositeOperation = 'source-over'; g.drawImage(B, 0, 0);
    // The name, soaked in from the left: ink on the paper, paper colour where it crosses the ink
    if (t > INK.word) { const Wd = inkWord(g, L, cfg), f = (t - INK.word) / 0.75, edge = lerp(Wd.x0 - 40 * u, Wd.x1 + 60 * u, eio(f));
      const T1 = layerBuf('inkw', W, H), tg = T1.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H); tg.font = '900 ' + Wd.size.toFixed(1) + 'px ' + HEAVY; tg.textBaseline = 'alphabetic'; tg.textAlign = 'left'; tg.fillStyle = INKC; tg.fillText(Wd.name, Wd.x0, Wd.base);
      // the soak: a ragged edge moving across
      tg.globalCompositeOperation = 'destination-in'; tg.beginPath(); tg.moveTo(0, 0); for (let y = 0; y <= H; y += 12 * u) tg.lineTo(edge + Math.sin(y * 0.09 / u + t * 3) * 14 * u + Math.sin(y * 0.23 / u) * 6 * u, y); tg.lineTo(0, H); tg.closePath(); tg.fill();
      // the knock out where the ink is
      const T2 = layerBuf('inkw2', W, H), t2 = T2.getContext('2d'); t2.setTransform(1, 0, 0, 1, 0, 0); t2.globalCompositeOperation = 'source-over'; t2.clearRect(0, 0, W, H); t2.drawImage(T1, 0, 0); t2.globalCompositeOperation = 'source-in'; t2.fillStyle = PAPER; t2.fillRect(0, 0, W, H); t2.globalCompositeOperation = 'destination-in'; t2.drawImage(M, 0, 0, W, H);
      g.drawImage(T1, 0, 0); g.drawImage(T2, 0, 0); }
    // The line: a red rule opening out, the words spaced along it
    const line = lineOf(cfg); if (line && t > INK.line) { const f = eo((t - INK.line) / 0.6), y = cy + 330 * u; g.save(); g.fillStyle = '#b8161d'; const rw = 520 * u * f; g.fillRect(cx - rw / 2, y - 46 * u, rw, 3 * u);
      fitFont(g, line, '700', COND, 40 * u, W * 0.8); g.globalAlpha = sm((t - INK.line - 0.15) / 0.4); g.textBaseline = 'alphabetic'; spaced(g, line, cx, y + (1 - f) * 10 * u, 6 * u, 'center'); g.restore(); }
    episode(g, t, L, cfg, BASE.ink - 0.6, 'ink');
  }
  const bufs = {}; function layerBuf(k, W, H) { let c = bufs[k]; if (!c || c.width !== W || c.height !== H) c = bufs[k] = mk(W, H); return c; }

  /* ================= BATTERED ================= */
  const BT = { drop: 0.45, splash: 0.75, lift: 1.7, whip: 1.85, land: 2.1, salt: 2.65, vin: 3.05, word: 3.3, line: 3.85 };
  function oil(g, t, L) {
    const { W, H, u } = L; const gr = g.createRadialGradient(W * 0.45, H * 0.35, 40 * u, W * 0.5, H * 0.5, Math.max(W, H) * 0.65); gr.addColorStop(0, '#e2a33a'); gr.addColorStop(0.35, '#b26a12'); gr.addColorStop(0.75, '#6a3306'); gr.addColorStop(1, '#2a1203'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // Caustic shimmer on the surface
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,220,140,0.08)'; g.lineWidth = 3 * u; for (let k = 0; k < 26; k++) { g.beginPath(); for (let x = 0; x <= W; x += 24 * u) { const y = (k / 26) * H + Math.sin(x * 0.006 / u + t * 1.7 + k) * 22 * u + Math.sin(x * 0.017 / u - t * 2.3 + k * 2) * 9 * u; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } g.restore();
    // Bubbles: wee ones all the time, a fury of them round the squid once it is in
    const r = rng(9), fury = t > BT.splash ? Math.exp(-(t - BT.splash) * 0.5) : 0, n = 140 + Math.round(fury * 420);
    for (let i = 0; i < n; i++) { const life = 0.35 + r() * 0.6, ph = r(), age = ((t + ph * life * 7) % life) / life, near = i >= 140, a = r() * Math.PI * 2, d = near ? (170 + r() * 160) * u : 0, x = near ? W / 2 + Math.cos(a) * d : r() * W, y = near ? H / 2 - 20 * u + Math.sin(a) * d * 0.9 : r() * H, rr = (near ? 3 + r() * 9 : 2 + r() * 6) * u * Math.sin(Math.PI * age);
      if (rr < 0.4) continue; g.strokeStyle = 'rgba(255,236,170,0.55)'; g.lineWidth = 1.4 * u; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,250,220,0.6)'; g.beginPath(); g.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.25, 0, Math.PI * 2); g.fill(); }
    // Glossy streaks where the lights catch the oil
    g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 7; k++) { const y = H * (0.12 + k * 0.12) + Math.sin(t * 1.3 + k) * 10 * u, x0 = W * (0.15 + 0.1 * Math.sin(k * 2.1 + t * 0.5)), lg = g.createLinearGradient(x0, 0, x0 + W * 0.5, 0); lg.addColorStop(0, 'rgba(255,240,200,0)'); lg.addColorStop(0.5, 'rgba(255,240,200,0.16)'); lg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = lg; g.fillRect(x0, y, W * 0.5, 3 * u); } g.restore();
    // The fryer: brushed steel all round the oil
    { const b = 70 * u; g.save(); const sides = [[0, 0, W, b, 0, 1], [0, H - b, W, b, 0, -1], [0, 0, b, H, 1, 0], [W - b, 0, b, H, -1, 0]]; sides.forEach(([x, y, w, h, dx, dy]) => { const sg = dx ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h); const a = dx > 0 || dy > 0; sg.addColorStop(a ? 0 : 1, '#5b6068'); sg.addColorStop(0.5, '#c9ced6'); sg.addColorStop(a ? 1 : 0, '#3a3e45'); g.fillStyle = sg; g.fillRect(x, y, w, h); });
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4 * u; g.strokeRect(b, b, W - b * 2, H - b * 2); const ig = g.createLinearGradient(0, b, 0, b + 40 * u); ig.addColorStop(0, 'rgba(0,0,0,0.45)'); ig.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ig; g.fillRect(b, b, W - b * 2, 40 * u); g.restore(); }
    // Steam
    g.save(); g.globalCompositeOperation = 'screen'; const rs = rng(4); for (let i = 0; i < 9; i++) { const x = rs() * W, sp = 60 + rs() * 60, y = H - ((t * sp * u + rs() * H) % (H + 300 * u)), R = (90 + rs() * 120) * u; const sg = g.createRadialGradient(x, y, 0, x, y, R); sg.addColorStop(0, 'rgba(255,255,255,0.10)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(x - R, y - R, R * 2, R * 2); } g.restore();
  }
  // The batter: a lumpy golden crust over the disc, more of it as it cooks
  function batter(g, x, y, R, k, seed) {
    if (k <= 0) return; k = cl(k, 0, 1); const r = rng(seed);
    const edge = []; for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2, rr = R * (1.06 + 0.06 * Math.sin(a * 6 + 1) + 0.035 * Math.sin(a * 15 + 2) + 0.02 * Math.sin(a * 31)); edge.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    const path = () => { g.beginPath(); edge.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
    g.save(); g.globalAlpha = k; path(); const bg = g.createRadialGradient(x - R * 0.35, y - R * 0.45, R * 0.05, x, y, R * 1.15); bg.addColorStop(0, '#ffe08a'); bg.addColorStop(0.45, '#f0b445'); bg.addColorStop(0.85, '#c9801f'); bg.addColorStop(1, '#8a4c0e'); g.fillStyle = bg; g.fill();
    // His squid pressed into the batter: the logo laid in, darker in the hollows
    g.save(); path(); g.clip(); if (logo) { const lb = layerBuf('batlogo', Math.ceil(R * 2.1), Math.ceil(R * 2.1)), lg = lb.getContext('2d'); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, lb.width, lb.height); lg.drawImage(logo, 0, 0, lb.width, lb.height);
      // only the squid's shape (its light parts) is pressed in, as a darker golden hollow with a lit rim
      lg.globalCompositeOperation = 'luminosity'; lg.fillStyle = '#c9801f'; lg.globalAlpha = 1; lg.fillRect(0, 0, lb.width, lb.height); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.9 * k; g.drawImage(lb, x - lb.width / 2, y - lb.height / 2); }
    g.restore();
    // Crunchy lumps, lit from the top left
    for (let i = 0; i < 220; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 1.02, s2 = (2.5 + r() * 7) * R / 200, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; g.fillStyle = 'rgba(120,60,8,0.28)'; g.beginPath(); g.arc(px + s2 * 0.4, py + s2 * 0.5, s2, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,226,140,0.5)'; g.beginPath(); g.arc(px - s2 * 0.2, py - s2 * 0.25, s2 * 0.75, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.45 * k; g.strokeStyle = '#7a3e08'; g.lineWidth = 3 * R / 200; path(); g.stroke(); g.restore();
  }
  const chipPaper = {}; function chipPaperOf(W, H, u) { const key = W + 'x' + H; if (chipPaper.key === key) return chipPaper.c; const c = mk(W, H), g = c.getContext('2d'); g.fillStyle = '#efece4'; g.fillRect(0, 0, W, H);
    // Made up newsprint: columns of grey lines, a few heavy headline bars, a grease stain or two (no real paper)
    const r = rng(12); for (let col = 0; col < 7; col++) { const x0 = (col / 7) * W + 20 * u, cw = W / 7 - 40 * u; let y = 30 * u + r() * 40 * u; while (y < H) { if (r() < 0.08) { g.fillStyle = 'rgba(30,30,30,0.35)'; g.fillRect(x0, y, cw * (0.6 + r() * 0.4), 22 * u); y += 40 * u; } else { g.fillStyle = 'rgba(40,40,40,0.13)'; g.fillRect(x0, y, cw * (0.7 + r() * 0.3), 5 * u); y += 13 * u; } } }
    for (let i = 0; i < 5; i++) { const x = r() * W, y = r() * H, R = (60 + r() * 160) * u, sg = g.createRadialGradient(x, y, 0, x, y, R); sg.addColorStop(0, 'rgba(190,150,60,0.25)'); sg.addColorStop(1, 'rgba(190,150,60,0)'); g.fillStyle = sg; g.fillRect(x - R, y - R, R * 2, R * 2); }
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); chipPaper.key = key; chipPaper.c = c; return c; }
  function chip(g, x, y, l, w, a, seed) { const r = rng(seed); g.save(); g.translate(x, y); g.rotate(a); const gr = g.createLinearGradient(0, -w / 2, 0, w / 2); gr.addColorStop(0, '#f8d77a'); gr.addColorStop(0.5, '#e3a63c'); gr.addColorStop(1, '#a8661a'); g.fillStyle = gr;
    g.shadowColor = 'rgba(60,30,0,0.35)'; g.shadowBlur = w * 0.6; g.shadowOffsetY = w * 0.25; g.beginPath(); if (g.roundRect) g.roundRect(-l / 2, -w / 2, l, w, w * 0.35); else g.rect(-l / 2, -w / 2, l, w); g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(255,240,190,0.35)'; g.fillRect(-l / 2 + w * 0.3, -w * 0.35, l - w * 0.6, w * 0.16); for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(140,80,20,0.4)'; g.beginPath(); g.arc(-l / 2 + r() * l, (r() - 0.5) * w * 0.6, w * 0.08, 0, Math.PI * 2); g.fill(); } g.restore(); }
  function drawBattered(g, t, L, cfg) {
    const { u, cx, cy, W, H } = L, R = 175 * u;
    if (t < BT.whip) {
      oil(g, t, L);
      // In it goes: falls towards the surface (bigger to smaller), hits, sinks a touch, bobs in the boil, gets battered
      if (cfg.logo !== false && t > BT.drop) { const f = cl((t - BT.drop) / (BT.splash - BT.drop), 0, 1), s = t < BT.splash ? lerp(2.4, 1, ei(f)) : 1 - 0.06 * Math.exp(-(t - BT.splash) * 3) + 0.015 * Math.sin((t - BT.splash) * 9), bob = t > BT.splash ? Math.sin((t - BT.splash) * 7) * 4 * u : 0;
        g.save(); g.translate(cx, cy - 20 * u + bob); g.rotate(t > BT.splash ? Math.sin((t - BT.splash) * 4) * 0.04 : (1 - f) * 0.3); g.scale(s, s); g.shadowColor = 'rgba(40,15,0,0.6)'; g.shadowBlur = 30 * u; discAt(g, 0, 0, R); g.shadowColor = 'transparent'; batter(g, 0, 0, R, (t - BT.splash) / 0.8, 3); g.restore(); }
      // The splash
      const e = t - BT.splash; if (e > 0 && e < 0.9) { const r = rng(21); g.save(); for (let i = 0; i < 60; i++) { const a = r() * Math.PI * 2, d = R * 1.05 + (120 + r() * 380) * u * eo(e / 0.7), s2 = (3 + r() * 9) * u * (1 - e / 0.9); g.fillStyle = 'rgba(255,214,120,0.85)'; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy - 20 * u + Math.sin(a) * d * 0.85, s2, 0, Math.PI * 2); g.fill(); }
        [0, 0.12, 0.26].forEach(o => { const k = e - o; if (k <= 0) return; g.strokeStyle = 'rgba(255,230,160,' + (0.6 * (1 - k / 0.9)).toFixed(3) + ')'; g.lineWidth = 6 * u * (1 - k / 0.9); g.beginPath(); g.ellipse(cx, cy - 20 * u, R * 1.1 + 380 * u * eo(k / 0.8), (R * 1.1 + 380 * u * eo(k / 0.8)) * 0.85, 0, 0, Math.PI * 2); g.stroke(); }); g.restore(); }
      // The basket lifts it out: a wire grid coming up over everything
      if (t > BT.lift) { const f = (t - BT.lift) / (BT.whip - BT.lift); g.save(); g.globalAlpha = sm(f * 1.5); g.strokeStyle = '#c9ccd2'; g.lineWidth = 5 * u; const y0 = lerp(H + 50 * u, -50 * u, f); for (let x = -W; x <= W * 2; x += 46 * u) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x + H, y0 + H); g.stroke(); g.beginPath(); g.moveTo(x, y0); g.lineTo(x - H, y0 + H); g.stroke(); } g.restore(); }
    } else {
      // Whipped across to the chip paper
      const wk = t - BT.whip, pan = wk < 0.22 ? (1 - eo(wk / 0.22)) * W : 0; if (pan > 0) { g.save(); g.translate(pan - W, 0); oil(g, t, L); g.restore(); } g.save(); g.translate(pan, 0); g.drawImage(chipPaperOf(W, H, u), 0, 0);
      // Chips round about it
      const r = rng(55), chips = []; for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, d = R * (1.05 + r() * 0.6), x = cx + Math.cos(a) * d * 1.3, y = cy - 40 * u + Math.sin(a) * d * 0.62; if (y > cy + 120 * u) continue; chips.push([x, y, (150 + r() * 70) * u, (40 + r() * 10) * u, a + Math.PI / 2 + (r() - 0.5) * 0.9, 70 + i]); }
      chips.sort((p, q) => p[1] - q[1]).forEach(c => { if (c[1] < cy - 40 * u) chip(g, ...c); });
      // The battered squid lands with a wee bounce
      const lk = t - BT.land, ly = lk < 0 ? -400 * u : 0, s = 1 + spring(lk, 0.1, 22, 7); if (cfg.logo !== false && lk > -0.2) { g.save(); g.translate(cx, cy - 40 * u + (lk < 0 ? lerp(-500 * u, 0, ei((lk + 0.2) / 0.2)) : 0)); g.scale(s, 1 / s); g.shadowColor = 'rgba(80,40,0,0.55)'; g.shadowBlur = 40 * u; g.shadowOffsetY = 16 * u; discAt(g, 0, 0, R); g.shadowColor = 'transparent';
        // Battered all over but you can still see who it is
        batter(g, 0, 0, R, 1, 3); g.restore(); }
      chips.forEach(c => { if (c[1] >= cy - 40 * u && Math.hypot(c[0] - cx, (c[1] - cy + 40 * u) / 0.62) > R * 1.15) chip(g, ...c); });
      void ly;
      // Salt: a shower of grains from the top
      const sk = t - BT.salt; if (sk > 0) { const rs = rng(808); g.fillStyle = '#ffffff'; for (let i = 0; i < 260; i++) { const st = rs() * 0.45, k = sk - st; if (k < 0) continue; const x = cx + (rs() - 0.5) * 520 * u + Math.sin(i) * 20 * u, yE = cy - 40 * u + (rs() - 0.5) * 300 * u, y = Math.min(yE, -20 * u + 2600 * u * k * k); g.globalAlpha = 0.9; g.fillRect(x, y, 3 * u, 3 * u); } g.globalAlpha = 1; }
      // Vinegar (this is Glasgow, no' Edinburgh): dark glossy splashes
      const vk = t - BT.vin; if (vk > 0) { const rv = rng(919); for (let i = 0; i < 26; i++) { const st = rv() * 0.3, k = vk - st; if (k < 0) continue; const x = cx + (rv() - 0.3) * 420 * u, y = cy - 120 * u + rv() * 240 * u, s2 = (6 + rv() * 22) * u * eo(k / 0.25); g.fillStyle = 'rgba(70,40,10,0.35)'; g.beginPath(); g.ellipse(x, y, s2 * 1.3, s2, rv() * 3, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - s2 * 0.3, y - s2 * 0.3, s2 * 0.2, 0, Math.PI * 2); g.fill(); } }
      // Steam rising off it
      g.save(); g.globalCompositeOperation = 'screen'; const rs2 = rng(6); for (let i = 0; i < 6; i++) { const x = cx + (rs2() - 0.5) * 320 * u, y = cy - 80 * u - ((t * (50 + rs2() * 40) * u + rs2() * 300 * u) % (420 * u)), R2 = (60 + rs2() * 70) * u, sg = g.createRadialGradient(x, y, 0, x, y, R2); sg.addColorStop(0, 'rgba(255,255,255,0.16)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(x - R2, y - R2, R2 * 2, R2 * 2); } g.restore();
      // The name, slapped on like a chippy sign: chunky red letters with a white outline and a drop shadow
      const name = nameOf(cfg), wk2 = t - BT.word; if (wk2 > 0) { const s2 = 1 + spring(wk2, 0.35, 26, 9), y = cy + 230 * u; g.save(); g.translate(cx, y); g.rotate(-0.035); g.scale(s2, s2); const size = fitFont(g, name, '900', HEAVY, 140 * u, W * 0.84); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
        g.fillStyle = 'rgba(40,20,0,0.35)'; g.fillText(name, 8 * u, 10 * u); g.strokeStyle = '#ffffff'; g.lineWidth = 22 * u; g.strokeText(name, 0, 0); g.strokeStyle = '#1a1a1a'; g.lineWidth = 8 * u; g.strokeText(name, 0, 0);
        const fg = g.createLinearGradient(0, -size * 0.8, 0, 0); fg.addColorStop(0, '#ff3b3b'); fg.addColorStop(1, '#b3121a'); g.fillStyle = fg; g.fillText(name, 0, 0); g.restore(); }
      // The line on a red menu strip, slapped on below
      const line = lineOf(cfg), lk2 = t - BT.line; if (line && lk2 > 0) { const s3 = 1 + spring(lk2, 0.3, 28, 10), y = cy + 330 * u; g.save(); g.translate(cx + 40 * u, y); g.rotate(0.02); g.scale(s3, s3); const size = fitFont(g, line, '800', COND, 46 * u, W * 0.7), tw = g.measureText(line).width; g.fillStyle = '#c4141c'; g.shadowColor = 'rgba(40,20,0,0.4)'; g.shadowBlur = 14 * u; g.shadowOffsetY = 6 * u; g.fillRect(-tw / 2 - 28 * u, -size * 0.95, tw + 56 * u, size * 1.4); g.shadowColor = 'transparent';
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(line, 0, size * 0.2); g.restore(); }
      g.restore();
      // Whip blur on the way across
      if (wk < 0.22) { const B = layerBuf('whip', W, H), bg2 = B.getContext('2d'); bg2.setTransform(1, 0, 0, 1, 0, 0); bg2.clearRect(0, 0, W, H); bg2.drawImage(g.canvas, 0, 0); g.save(); const a = 0.35 * (1 - wk / 0.22); for (let k = 1; k <= 4; k++) { g.globalAlpha = a / k; g.drawImage(B, k * 26 * u * (1 - wk / 0.22), 0); g.drawImage(B, -k * 26 * u * (1 - wk / 0.22), 0); } g.restore(); }
    }
    episode(g, t, L, cfg, BASE.battered - 0.6, 'battered');
  }

  /* ================= NEON ================= */
  const NE = { box: 0.55, word: 1.15, step: 0.11, line: 2.75, blow: 3.6, poster: 0 };
  const wallCache = {}; function wall(W, H, u) { const key = W + 'x' + H; if (wallCache.key === key) return wallCache.c; const c = mk(W, H), g = c.getContext('2d'), r = rng(88);
    // Red sandstone ashlar, as on a Glasgow tenement: big dressed blocks, thin joints, each block its own shade, weathered
    g.fillStyle = '#3a1c14'; g.fillRect(0, 0, W, H); const bh = 128 * u; let row = 0;
    for (let y = -bh * 0.3; y < H + bh; y += bh, row++) { let x = -(row % 2) * 170 * u - r() * 80 * u; while (x < W) { const bw = (290 + r() * 140) * u, base = 0.85 + r() * 0.3, rr = Math.round(150 * base), gg = Math.round(78 * base), bb = Math.round(58 * base);
        g.fillStyle = `rgb(${rr},${gg},${bb})`; g.fillRect(x + 2 * u, y + 2 * u, bw - 4 * u, bh - 4 * u);
        // tooling marks and grain in the stone
        for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.55 ? 'rgba(40,15,8,0.10)' : 'rgba(255,190,160,0.07)'; const px = x + r() * bw, py = y + r() * bh; g.fillRect(px, py, (1 + r() * 4) * u, (1 + r() * 2) * u); }
        g.strokeStyle = 'rgba(60,25,15,0.12)'; g.lineWidth = 1 * u; for (let i = 0; i < 6; i++) { const py = y + r() * bh; g.beginPath(); g.moveTo(x + 6 * u, py); g.lineTo(x + bw - 6 * u, py + (r() - 0.5) * 6 * u); g.stroke(); }
        // weathering: darker at the bottom of each block, a lit top edge
        const sh = g.createLinearGradient(0, y, 0, y + bh); sh.addColorStop(0, 'rgba(255,210,180,0.10)'); sh.addColorStop(0.08, 'rgba(255,210,180,0)'); sh.addColorStop(1, 'rgba(20,6,2,0.28)'); g.fillStyle = sh; g.fillRect(x + 2 * u, y + 2 * u, bw - 4 * u, bh - 4 * u); x += bw; } }
    // Soot streaks down from the top, and dark at the edges
    for (let i = 0; i < 18; i++) { const x = r() * W, w = (20 + r() * 80) * u, sg = g.createLinearGradient(0, 0, 0, H * (0.3 + r() * 0.6)); sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(x, 0, w, H); }
    wallCache.key = key; wallCache.c = c; return c; }
  const neonKey = (cfg) => { const n = nameOf(cfg).replace(/\s/g, ''); let b = cfg.blow; if (b === 'none') return -1; if (b === 'auto' || b == null) { const q = nameOf(cfg).toUpperCase().indexOf('Q'); return q >= 0 ? q : nameOf(cfg).length - 1; } return cl(Math.round(+b) - 1, 0, nameOf(cfg).length - 1); };
  // How lit each letter is: comes on with a stutter, the blown one goes out for good (with the odd sad flicker after)
  function letterLit(t, i, cfg) { const on = NE.word + i * NE.step, k = t - on; if (k < 0) return 0; const r = rng(300 + i); let v = k < 0.16 ? ((Math.sin(k * 120 + r() * 6) > -0.2) ? 1 : 0.15) * (k > 0.02 ? 1 : 0) : 1;
    if (i === neonKey(cfg) && t >= NE.blow) { const b = t - NE.blow; v = b < 0.06 ? 1.6 : 0; if (b > 0.9 && b < 1.0) v = 0.35; if (b > 1.6 && b < 1.66) v = 0.25; }
    return v * (0.94 + 0.06 * Math.sin(t * 70 + i)); }
  function drawNeon(g, t, L, cfg) {
    const { u, cx, cy, W, H } = L, push = 1 + 0.06 * eio(t / duration(cfg)), name = nameOf(cfg), bk = neonKey(cfg);
    g.save(); g.translate(cx, cy); g.scale(push, push); g.translate(-cx, -cy);
    g.drawImage(wall(W, H, u), 0, 0);
    // A street lamp's sodium light from the top left, and the night everywhere else
    const sl = g.createRadialGradient(W * 0.08, -H * 0.1, 0, W * 0.08, -H * 0.1, Math.max(W, H) * 0.9); sl.addColorStop(0, 'rgba(255,170,80,0.25)'); sl.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = sl; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(4,6,18,0.55)'; g.fillRect(0, 0, W, H);
    // The light box: his logo, backlit, flickering on
    const bx = cx, by = cy - 150 * u, R = 150 * u, bt = t - NE.box, boxOn = bt < 0 ? 0 : bt < 0.35 ? ((Math.sin(bt * 90) > 0) ? 0.9 : 0.1) : 1;
    let wash = 0, washCol = [120, 200, 255];
    if (cfg.logo !== false) { g.save(); g.fillStyle = '#15171c'; g.beginPath(); g.arc(bx, by, R + 18 * u, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2a2d34'; g.fillRect(bx - 6 * u, by - R - 70 * u, 12 * u, 60 * u);
      g.globalAlpha = 0.25 + 0.75 * boxOn; discAt(g, bx, by, R); g.globalAlpha = 1;
      if (boxOn > 0.5) { g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(bx, by, R * 1.08, bx, by, R * 2.6); gl.addColorStop(0, 'rgba(120,170,255,0.35)'); gl.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = gl; g.fillRect(bx - R * 2.6, by - R * 2.6, R * 5.2, R * 5.2); }
      g.restore(); wash += 0.5 * boxOn; }
    // The neon letters: glass tubes, dull when off, white hot cores and a wide glow when on (PATTER cold blue, the rest red)
    const size = fitFont(g, name, '700', COND, 150 * u, W * 0.84), base = cy + 150 * u; g.font = '700 ' + size.toFixed(1) + 'px ' + COND; const ws = [...name].map(c => g.measureText(c).width), gap = 10 * u, tot = ws.reduce((a, b) => a + b, 0) + gap * (name.length - 1); let x = cx - tot / 2;
    const split = name.toUpperCase().indexOf('SQUID') >= 0 ? name.toUpperCase().indexOf('SQUID') : Math.ceil(name.length / 2);
    [...name].forEach((ch, i) => { const lit = letterLit(t, i, cfg), col = i < split ? [150, 220, 255] : [255, 60, 80]; g.save(); g.font = '700 ' + size.toFixed(1) + 'px ' + COND; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = 'rgba(90,80,90,0.55)'; g.lineWidth = 9 * u; g.strokeText(ch, x, base); // the glass, unlit
      if (lit > 0.02) { g.globalCompositeOperation = 'lighter'; const a = cl(lit, 0, 1.6);
        g.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},${(0.9 * a).toFixed(3)})`; g.shadowBlur = 40 * u; g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.55 * a).toFixed(3)})`; g.lineWidth = 14 * u; g.strokeText(ch, x, base);
        g.shadowBlur = 12 * u; g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.95 * Math.min(1, a)).toFixed(3)})`; g.lineWidth = 8 * u; g.strokeText(ch, x, base);
        g.shadowBlur = 0; g.strokeStyle = `rgba(255,255,255,${(0.85 * Math.min(1, a)).toFixed(3)})`; g.lineWidth = 3 * u; g.strokeText(ch, x, base); wash += lit * 0.08; if (i >= split) washCol = [255, 90, 110]; }
      g.restore();
      // The blow: a flash, sparks falling with the drop of a cut wire, a wee curl of smoke
      if (i === bk && t >= NE.blow) { const b = t - NE.blow, sx = x + ws[i] / 2, sy = base - size * 0.45; g.save(); g.globalCompositeOperation = 'lighter';
        if (b < 0.2) { const fl = g.createRadialGradient(sx, sy, 0, sx, sy, 260 * u); fl.addColorStop(0, `rgba(255,250,230,${(1 - b / 0.2).toFixed(3)})`); fl.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = fl; g.fillRect(sx - 260 * u, sy - 260 * u, 520 * u, 520 * u); }
        const rs = rng(4242); for (let k = 0; k < 70; k++) { const a = -Math.PI * rs(), v = (200 + rs() * 600) * u, life = 0.5 + rs() * 0.9, kk = b - rs() * 0.08; if (kk < 0 || kk > life) continue; const px = sx + Math.cos(a) * v * kk, py = sy + Math.sin(a) * v * kk + 0.5 * 1800 * u * kk * kk, f = 1 - kk / life;
          g.strokeStyle = `rgba(255,${Math.round(200 + 55 * f)},${Math.round(120 * f)},${f.toFixed(3)})`; g.lineWidth = 2.4 * u; g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * v * 0.02, py - (Math.sin(a) * v + 1800 * u * kk) * 0.02); g.stroke(); }
        g.restore(); if (b > 0.15) { g.save(); const rr = rng(77); for (let k = 0; k < 6; k++) { const kk = b - 0.15 - k * 0.12; if (kk < 0) continue; const py = sy - 60 * u * kk - k * 10 * u, px = sx + Math.sin(kk * 3 + k) * 14 * u, R2 = (20 + 30 * kk) * u; g.fillStyle = `rgba(160,160,170,${(0.18 * Math.max(0, 1 - kk / 1.8)).toFixed(3)})`; g.beginPath(); g.arc(px, py, R2, 0, Math.PI * 2); g.fill(); void rr; } g.restore(); } }
      x += ws[i] + gap; });
    // The light thrown on the wall
    if (wash > 0.01) { g.save(); g.globalCompositeOperation = 'lighter'; const wg = g.createRadialGradient(cx, cy + 40 * u, 60 * u, cx, cy + 40 * u, 900 * u); wg.addColorStop(0, `rgba(${washCol[0]},${washCol[1]},${washCol[2]},${Math.min(0.22, wash * 0.18).toFixed(3)})`); wg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = wg; g.fillRect(0, 0, W, H); g.restore(); }
    // The line in a pink script neon, flickering on
    const line = lineOf(cfg), lk = t - NE.line; if (line && lk > 0) { const on = lk < 0.25 ? (Math.sin(lk * 140) > 0 ? 1 : 0.1) : 0.92 + 0.08 * Math.sin(t * 50); g.save(); fitFont(g, line, '400', SCRIPT, 60 * u, W * 0.7); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(90,60,80,0.5)'; g.lineWidth = 4 * u; g.strokeText(line, cx, cy + 270 * u); g.globalCompositeOperation = 'lighter'; g.shadowColor = `rgba(255,90,200,${on})`; g.shadowBlur = 26 * u; g.strokeStyle = `rgba(255,120,220,${(0.9 * on).toFixed(3)})`; g.lineWidth = 5 * u; g.strokeText(line, cx, cy + 270 * u); g.shadowBlur = 0; g.strokeStyle = `rgba(255,240,250,${(0.8 * on).toFixed(3)})`; g.lineWidth = 1.8 * u; g.strokeText(line, cx, cy + 270 * u); g.restore(); }
    g.restore();
    // Fade up from the dark
    if (t < 0.4) { g.fillStyle = `rgba(0,0,0,${(1 - t / 0.4).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    episode(g, t, L, cfg, BASE.neon - 0.6, 'neon');
  }

  /* ---------- Neon tenement in 3D (G3): the words are real glass tubes bent along the middle of each letter, the logo a
     light box standing off the wall on rods, the wall dressed red sandstone ashlar, wet, lit by a sodium street lamp with
     soft shadows, the neon throwing its colour on the stone. Falls back to the flat version without WebGL2. ---------- */
  const N3 = { nameY: -0.22, lineY: -1.16, boxY: 1.3, boxR: 0.78, boxZ: 0.32, posterY: -2.12 };
  const N3FONT = '"Bahnschrift SemiCondensed", Bahnschrift, "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", "Liberation Sans Narrow", Arial, sans-serif';
  const N3FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform vec3 uEye, uTgt; uniform float uFov, uT, uFade;
uniform sampler2D uName, uLine, uLogo, uPoster;
uniform vec4 uNameBox, uLineBox; uniform vec2 uNameOff, uLineOff; uniform float uNameHW, uLineHW;
uniform int uN; uniform float uLa[24], uLb[24], uLit[24]; uniform vec3 uLc[24]; uniform float uBlown;
uniform float uLineLit, uHasLine, uBoxOn, uHasBox, uLogoOK; uniform vec3 uBoxC; uniform float uBoxR;
uniform vec3 uLamp, uLampCol; uniform vec4 uFlash; uniform vec4 uPosterRect; uniform float uPosterOn;
${G3.COMMON}
const float ZT = 0.17, RT = 0.042, ZL = 0.12, RL = 0.021, BOXH = 0.11, PIPEX = -4.25;
const vec3 LINEC = vec3(1.0, 0.22, 0.62);
float nameC(vec2 p){ return max(texSdf(uName, uNameBox, p - uNameOff) + uNameHW, 0.); }
float lineC(vec2 p){ return max(texSdf(uLine, uLineBox, p - uLineOff) + uLineHW, 0.); }
float mapO(vec3 p, out float id){
  float d = length(vec2(nameC(p.xy), p.z - ZT)) - RT; id = 1.;
  if (uHasLine > .5){ float dl = length(vec2(lineC(p.xy), p.z - ZL)) - RL; if (dl < d){ d = dl; id = 2.; } }
  if (uHasBox > .5){ vec3 q = p - uBoxC; float db = sdCapCyl(q, uBoxR, BOXH, .045); if (db < d){ d = db; id = 3.; }
    float zb = uBoxC.z - BOXH; float dr = max(length(vec2(abs(q.x) - uBoxR * .45, q.y + uBoxR * .2)) - .032, abs(p.z - zb * .5) - zb * .5); if (dr < d){ d = dr; id = 4.; } }
  vec2 pq = p.xz - vec2(PIPEX, .17); float yy = mod(p.y, 1.9) - .95; float dp = min(length(pq) - .085, max(length(pq) - .115, abs(yy) - .05));
  dp = min(dp, max(max(abs(p.x - PIPEX) - .03, abs(yy) - .035), p.z - .17));
  if (dp < d){ d = dp; id = 5.; } return d; }
float mapD(vec3 p){ float i; return mapO(p, i); }
vec3 nrmO(vec3 p){ const vec2 e = vec2(.0015, -.0015); return normalize(e.xyy * mapD(p + e.xyy) + e.yyx * mapD(p + e.yyx) + e.yxy * mapD(p + e.yxy) + e.xxx * mapD(p + e.xxx)); }
// Light from the letters: each letter's colour times how lit it is, blended across neighbours
vec3 nameLight(float x){ vec3 s = vec3(0.); float ws = 0.; for (int i = 0; i < 24; i++){ if (i >= uN) break; float c = (uLa[i] + uLb[i]) * .5 + uNameOff.x, hw = max(.06, (uLb[i] - uLa[i]) * .5); float w = exp(-pow((x - c) / hw, 2.) * 1.2); s += uLc[i] * uLit[i] * w; ws += w; } return s / max(ws, .02); }
int letterAt(float x){ int b = 0; float bd = 1e9; for (int i = 0; i < 24; i++){ if (i >= uN) break; float c = (uLa[i] + uLb[i]) * .5 + uNameOff.x, d = abs(x - c) - (uLb[i] - uLa[i]) * .5; if (d < bd){ bd = d; b = i; } } return b; }
// Red sandstone ashlar: dressed blocks with thin recessed joints, droved tooling, weathering, soot and wet patches
float stoneH(vec2 p){ float bh = .74, row = floor(p.y / bh), ry = p.y - row * bh, off = hash12(vec2(row, 3.1)) * 1.9, bw = 1.95, cx = (p.x + off) / bw, rx = fract(cx) * bw;
  float e = min(min(rx, bw - rx), min(ry, bh - ry)); float face = smoothstep(.006, .035, e);
  return face * (.014 + .006 * fbm(p * 7. + floor(cx) * 3.1) + .0005 * sin(ry * 180. + vnoise(p * 20.) * 3.) + .0025 * vnoise(p * 60.)) - (1. - face) * .004; }
vec3 stoneCol(vec2 p, out float wet, out float joint){ float bh = .74, row = floor(p.y / bh), ry = p.y - row * bh, off = hash12(vec2(row, 3.1)) * 1.9, bw = 1.95, cx = (p.x + off) / bw, rx = fract(cx) * bw; vec2 id = vec2(floor(cx), row);
  float e = min(min(rx, bw - rx), min(ry, bh - ry)); joint = 1. - smoothstep(.006, .03, e); float hb = hash12(id + 7.);
  vec3 c = vec3(.40, .15, .095) * (.72 + .5 * hb); c = mix(c, vec3(.48, .24, .15), .35 * fbm(p * 2.3 + id)); c *= .8 + .35 * fbm(p * 11.);
  c = mix(c, vec3(.05, .035, .03), smoothstep(.6, .9, fbm(vec2(p.x * 2.5, p.y * .35))) * .45); // soot running down
  c *= 1. - .35 * smoothstep(bh * .6, 0., ry) * (1. - joint) * .4;
  c = mix(c, vec3(.11, .095, .085), joint);
  wet = clamp(smoothstep(.42, .62, fbm(p * .7 + 4.)) + joint * .5, 0., 1.); c *= 1. - wet * .35; return c; }
float softSh(vec3 p, vec3 l, float tmax){ float r = 1., t = .02; for (int i = 0; i < 28; i++){ float d = mapD(p + l * t); r = min(r, 9. * d / t); t += clamp(d, .015, .25); if (r < .01 || t > tmax) break; } return clamp(r, 0., 1.); }
void main(){
  vec3 f = normalize(uTgt - uEye), rr = normalize(cross(f, vec3(0., 1., 0.))), up = cross(rr, f);
  vec2 sp = (gl_FragCoord.xy - .5 * uRes) / (.5 * uRes.y); vec3 rd = normalize(f / tan(uFov * .5) + rr * sp.x + up * sp.y), ro = uEye;
  float tw = rd.z < -1e-4 ? -ro.z / rd.z : 1e4, t = rd.z < 0. ? max(0., (.62 - ro.z) / rd.z) : 0., id = 0.; bool hit = false;
  for (int i = 0; i < 96; i++){ if (t > tw) break; vec3 p = ro + rd * t; float d = mapO(p, id); if (d < .0008 * t){ hit = true; break; } t += d * .85; }
  vec3 col; vec3 sky = vec3(.012, .016, .03);
  vec3 lampDirCol = uLampCol;
  if (hit){
    vec3 p = ro + rd * t, n = nrmO(p), l = normalize(uLamp - p); float fac = abs(dot(n, -rd)), spec = pow(max(dot(reflect(rd, n), l), 0.), 70.);
    float fr = .04 + .96 * pow(1. - fac, 5.);
    if (id < 1.5){ int k = letterAt(p.x); float lit = uLit[k]; vec3 c = uLc[k];
      vec3 glass = vec3(.035, .03, .04) * (k == int(uBlown) ? .35 : 1.) + lampDirCol * spec * .9 + nameLight(p.x) * .25 * fr;
      vec3 em = c * lit * (.7 + 1.5 * pow(fac, 2.)) + mix(c, vec3(1.), .55) * lit * pow(fac, 9.) * .9;
      col = glass + em; }
    else if (id < 2.5){ vec3 glass = vec3(.035, .03, .04) + lampDirCol * spec * .9; col = glass + LINEC * uLineLit * (.7 + 1.4 * pow(fac, 2.)) + mix(LINEC, vec3(1.), .5) * uLineLit * pow(fac, 9.) * .8; }
    else if (id < 3.5){ vec3 q = p - uBoxC; float rq = length(q.xy);
      if (n.z > .7 && rq < uBoxR * .9){ vec2 uv = vec2(q.x, -q.y) / (uBoxR * .9 * 2. / .976) + .5; vec3 lg = uLogoOK > .5 ? pow(texture(uLogo, uv).rgb, vec3(2.2)) : vec3(.02, .1, .35);
        vec3 dif = vec3(.85, .9, 1.); col = lg * (.03 + 1.6 * uBoxOn) + lampDirCol * spec * 1.2 + fr * .05; }
      else { float di = max(dot(n, l), 0.); col = vec3(.03, .032, .036) * (di * lampDirCol + .2) + lampDirCol * pow(max(dot(reflect(rd, n), l), 0.), 30.) * .6 + nameLight(p.x) * .15 * max(-n.y, 0.); if (rq > uBoxR * .86 && rq < uBoxR * .94 && n.z > .3) col += vec3(.45, .7, 1.) * uBoxOn * .6; } }
    else { float di = max(dot(n, l), 0.); col = vec3(.02, .02, .022) * (di * lampDirCol * 3. + .15) + lampDirCol * pow(max(dot(reflect(rd, n), l), 0.), 40.) * .7 + nameLight(p.x) * .06; }
  } else {
    vec3 p = ro + rd * tw; vec2 xy = p.xy; const float e = .004; float h0 = stoneH(xy), hx = stoneH(xy + vec2(e, 0.)), hy = stoneH(xy + vec2(0., e));
    vec3 n = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.)); float wet, joint, posterA = 0.; vec3 alb = stoneCol(xy, wet, joint);
    // the fly poster, pasted on and wet
    if (uPosterOn > .001){ vec2 pq = (xy - uPosterRect.xy) / (uPosterRect.zw * uPosterOn); if (abs(pq.x) < 1. && abs(pq.y) < 1.){ vec4 pc = texture(uPoster, vec2(pq.x * .5 + .5, .5 - pq.y * .5)); alb = mix(alb, pow(pc.rgb, vec3(2.2)) * .8, pc.a); posterA = pc.a; wet = mix(wet, .55, pc.a); n = normalize(n + vec3(vnoise(xy * 14.) - .5, vnoise(xy * 14. + 9.) - .5, 0.) * .25 * pc.a); joint *= 1. - pc.a; } }
    vec3 pp = vec3(xy, h0); vec3 L = uLamp - pp; float dl = length(L); vec3 l = L / dl; vec3 v = -rd, hv = normalize(l + v);
    float sh = softSh(pp + n * .005, l, (.62 - pp.z) / max(l.z, .05));
    float rough = mix(18., 140., wet), ks = mix(.03, .55, wet);
    vec3 lamp = uLampCol * (1. / (1. + dl * dl * .07));
    col = alb * lamp * max(dot(n, l), 0.) * sh + lamp * ks * pow(max(dot(n, hv), 0.), rough) * sh * (rough + 8.) / 60.;
    // the neon on the stone: a tight bright halo by the tubes and a wide soft wash, glancing light picking out the blocks
    float dn = length(vec2(nameC(xy), ZT)); vec3 nl = nameLight(xy.x); float near = .75 * exp(-dn * 9.) + .12 * exp(-dn * 1.6);
    float ao = mix(.35, 1., smoothstep(.0, .16, dn - ZT * .2));
    vec3 neonL = nl * near * (.55 + .45 * n.z);
    if (uHasLine > .5){ float dl2 = length(vec2(lineC(xy), ZL)); neonL += LINEC * uLineLit * (.7 * exp(-dl2 * 10.) + .12 * exp(-dl2 * 1.8)); ao *= mix(.5, 1., smoothstep(0., .1, dl2 - ZL * .3)); }
    if (uHasBox > .5){ float rb = length(xy - uBoxC.xy); float rim = max(rb - uBoxR, 0.); neonL += vec3(.35, .55, 1.) * uBoxOn * (.55 * exp(-rim * 3.2) + .1 * exp(-rim * .8)) * smoothstep(uBoxR * .8, uBoxR * 1.08, rb); ao *= mix(.45, 1., smoothstep(uBoxR * .95, uBoxR * 1.25, rb)); }
    col += alb * neonL * 1.6 * ao + neonL * wet * .5 * pow(max(n.z, 0.), 4.) * ao;
    // the sparks' flash when a letter blows
    if (uFlash.w > 0.){ vec3 FL = uFlash.xyz - pp; float fd = length(FL); col += alb * vec3(1., .85, .6) * uFlash.w * max(dot(n, FL / fd), 0.) / (1. + fd * fd * 6.); }
    col += alb * sky * ao + alb * posterA * vec3(.16, .13, .15);
  }
  o = vec4(max(col, 0.) * uFade, 1.);
}`;
  const n3Poster = {}; function posterCanvas(cfg) { const ep = epOf(cfg), kick = String(cfg.kicker || '').trim().slice(0, 40), key = ep + '|' + kick; if (n3Poster.key === key) return n3Poster.c;
    const pw = 1400, ph = kick ? 270 : 214, c = mk(pw, ph), g = c.getContext('2d'), r = rng(hash(ep)); g.fillStyle = '#ece6d6'; g.fillRect(0, 0, pw, ph);
    for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.05)' : 'rgba(255,255,255,0.08)'; g.fillRect(r() * pw, r() * ph, 2 + r() * 6, 1 + r() * 2); }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; if (kick) { g.fillStyle = '#c4141c'; fitFont(g, kick.toUpperCase(), '900', HEAVY, 52, pw * 0.8); g.fillText(kick.toUpperCase(), pw / 2, 74); }
    g.fillStyle = '#121212'; fitFont(g, ep.toUpperCase(), '900', HEAVY, 108, pw * 0.92); g.fillText(ep.toUpperCase(), pw / 2, ph - 50);
    const ed = g.createLinearGradient(0, 0, 0, ph); ed.addColorStop(0, 'rgba(60,40,20,0.18)'); ed.addColorStop(0.15, 'rgba(0,0,0,0)'); ed.addColorStop(0.85, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(60,40,20,0.22)'); g.fillStyle = ed; g.fillRect(0, 0, pw, ph);
    n3Poster.key = key; n3Poster.c = c; n3Poster.aspect = ph / pw; return c; }
  // The camera: in close on the light box at an angle, swinging round and out as the words come on, a slow push, a wee
  // jolt when the letter blows, and a tilt down to the poster for an episode title
  function neonCam(t, cfg, W, H) { const asp = W / H, back = Math.max(1, 1.62 / asp), sw = eio((t - 0.85) / 2.0), push = eio((t - 2.6) / 4);
    const A = { e: [-1.75, 1.6, 2.9], a: [0.05, 1.22, 0.3] }, B = { e: [0.3, 0.42, 7.2], a: [0, 0.22, 0] };
    let e = A.e.map((v, i) => lerp(v, B.e[i], sw)), a = A.a.map((v, i) => lerp(v, B.a[i], sw)); e[2] -= 0.55 * push; e[0] -= 0.25 * push;
    if (epOf(cfg)) { const k = eio((t - (BASE.neon - 0.75)) / 0.9); e[1] -= 0.9 * k; a[1] -= 1.05 * k; e[2] += 0.2 * k; }
    e = [a[0] + (e[0] - a[0]) * back, a[1] + (e[1] - a[1]) * back, a[2] + (e[2] - a[2]) * back];
    const bk = neonKey(cfg), b = t - NE.blow; if (bk >= 0 && b > 0 && b < 0.5) { const s = 0.025 * Math.exp(-b * 9); e[0] += Math.sin(b * 90) * s; e[1] += Math.cos(b * 77) * s; }
    return { e, a, fov: 40 * Math.PI / 180 }; }
  function drawNeon3D(g, t, L, cfg) {
    if (typeof G3 === 'undefined' || !G3.available()) return false;
    const { W, H } = L, name = nameOf(cfg), bk = neonKey(cfg), line = lineOf(cfg);
    const nm = G3.textSdf(name || ' ', N3FONT, { worldW: 6.3, maxWorldH: 1.25, weight: '500', spacing: 0.08, key: 'n3' }); if (!nm) return false;
    const ln = line ? G3.textSdf(line, SCRIPT, { worldW: 4.4, maxWorldH: 0.62, weight: '400', spacing: 0.0, key: 'n3l' }) : null;
    const split = name.toUpperCase().indexOf('SQUID') >= 0 ? name.toUpperCase().indexOf('SQUID') : Math.ceil(name.length / 2);
    const n = Math.min(24, nm.letters.length), La = new Float32Array(24), Lb = new Float32Array(24), Lit = new Float32Array(24), Lc = new Float32Array(72);
    for (let i = 0; i < n; i++) { La[i] = nm.letters[i][0]; Lb[i] = nm.letters[i][1]; Lit[i] = letterLit(t, i, cfg); const c = i < split ? [0.12, 0.5, 1.0] : [1.0, 0.07, 0.13]; Lc.set(c, i * 3); }
    const cam = neonCam(t, cfg, W, H), gl = G3.ctx(), bt = t - NE.box, boxOn = cfg.logo === false ? 0 : bt < 0 ? 0 : bt < 0.35 ? ((Math.sin(bt * 90) > 0) ? 0.85 : 0.08) : 1;
    const lk = t - NE.line, lineLit = !line || lk < 0 ? 0 : lk < 0.25 ? (Math.sin(lk * 140) > 0 ? 1 : 0.1) : 0.92 + 0.08 * Math.sin(t * 50);
    const blowX = bk >= 0 && bk < n ? (La[bk] + Lb[bk]) / 2 : 0, blowP = [blowX, N3.nameY, 0.2], b = t - NE.blow;
    let flash = 0; if (bk >= 0 && b >= 0) { flash = b < 0.25 ? 5 * Math.pow(1 - b / 0.25, 2) : 0; if (b > 0.9 && b < 1.0) flash = 0.6; }
    const ep = epOf(cfg), pk = ep ? t - (BASE.neon - 0.6) : -1, poster = ep ? posterCanvas(cfg) : null, pOn = pk > 0 ? Math.min(1.12, 1 + spring(pk, 0.12, 24, 8)) * sm(pk / 0.06) : 0, pw = 4.0;
    const fade = sm(t / 0.45);
    const ok = G3.render('neon3', N3FS, g, W, H, P => {
      const S = (k, v) => G3.set(P, k, v);
      S('uEye', cam.e); S('uTgt', cam.a); S('uFov', cam.fov); S('uT', t); S('uFade', fade);
      G3.tex(0, nm.tex, P, 'uName'); S('uNameBox', nm.box); S('uNameOff', [0, N3.nameY]); S('uNameHW', nm.hw);
      if (ln) { G3.tex(1, ln.tex, P, 'uLine'); S('uLineBox', ln.box); S('uLineOff', [0, N3.lineY]); S('uLineHW', ln.hw); } else G3.tex(1, nm.tex, P, 'uLine');
      S('uHasLine', ln ? 1 : 0); S('uLineLit', lineLit);
      if (P.U.uN != null) gl.uniform1i(P.U.uN, n); G3.setv(P, 'uLa', La); G3.setv(P, 'uLb', Lb); G3.setv(P, 'uLit', Lit); G3.setv(P, 'uLc', Lc, 3); S('uBlown', bk);
      const lt = logo ? G3.imageTex('logo', logo) : null; G3.tex(2, lt || nm.tex, P, 'uLogo'); S('uLogoOK', lt ? 1 : 0);
      S('uHasBox', cfg.logo === false ? 0 : 1); S('uBoxOn', boxOn); S('uBoxC', [0, N3.boxY, N3.boxZ]); S('uBoxR', N3.boxR);
      S('uLamp', [-4.6, 3.6, 2.0]); S('uLampCol', [1.15, 0.62, 0.26]); S('uFlash', [blowP[0], blowP[1], 0.3, flash]);
      const ptx = poster ? G3.imageTex('poster', poster) : null; G3.tex(3, ptx || nm.tex, P, 'uPoster'); S('uPosterOn', ptx ? pOn : 0); S('uPosterRect', [0.05, N3.posterY, pw / 2, pw / 2 * (n3Poster.aspect || 0.15)]);
    }, { scale: 1, adaptive: q3live, t, bloom: 0.75, expo: 1.0, grain: 0.035, thresh: 0.6, vig: 0.85 });
    if (!ok) return false;
    // Sparks and smoke from the blown letter, in the same 3D space
    if (bk >= 0 && b >= 0 && b < 2.6) { const C = G3.camera(cam.e, cam.a, cam.fov, W, H), u = L.u; g.save(); g.globalCompositeOperation = 'lighter'; const rs = rng(4242);
      for (let k = 0; k < 90; k++) { const ang = Math.PI * (0.1 + 0.8 * rs()), sp = 1.2 + rs() * 3.4, vz = rs() * 1.6, life = 0.4 + rs() * 1.0, kk = b - rs() * 0.07; if (kk < 0 || kk > life) continue;
        const pos = s => [blowP[0] + Math.cos(ang) * sp * s * (rs() < 2 ? 1 : 1), blowP[1] + Math.sin(ang) * sp * 0.6 * s - 0.5 * 14 * s * s, 0.2 + vz * s], A2 = C.project(pos(kk)), B2 = C.project(pos(Math.max(0, kk - 0.03))); if (!A2 || !B2) continue; const fz = 1 - kk / life;
        g.strokeStyle = `rgba(255,${Math.round(190 + 65 * fz)},${Math.round(110 * fz)},${fz.toFixed(3)})`; g.lineWidth = Math.max(1, 2.2 * u * 7 / A2[2]); g.beginPath(); g.moveTo(A2[0], A2[1]); g.lineTo(B2[0], B2[1]); g.stroke(); }
      g.globalCompositeOperation = 'source-over'; for (let k = 0; k < 7; k++) { const kk = b - 0.12 - k * 0.1; if (kk < 0) continue; const P2 = C.project([blowP[0] + Math.sin(kk * 2.6 + k) * 0.08, blowP[1] + 0.25 + 0.45 * kk, 0.25]); if (!P2) continue; const R2 = (0.12 + 0.22 * kk) * H / 2 / P2[2] * 1.6, a = 0.16 * Math.max(0, 1 - kk / 1.6);
        const sg = g.createRadialGradient(P2[0], P2[1], 0, P2[0], P2[1], R2); sg.addColorStop(0, `rgba(150,150,165,${a.toFixed(3)})`); sg.addColorStop(1, 'rgba(150,150,165,0)'); g.fillStyle = sg; g.fillRect(P2[0] - R2, P2[1] - R2, R2 * 2, R2 * 2); }
      g.restore(); }
    return true;
  }

  /* ================= EPIC, CUT SHORT ================= */
  const EPC = { rise: 0.3, word: 1.7, reach: 3.0, cut: 3.28, slap: 3.95, wslap: 4.25, line: 4.6 };
  function heaven(g, t, L) {
    const { u, cx, cy, W, H } = L; const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1a0e04'); sky.addColorStop(0.45, '#8a5a12'); sky.addColorStop(0.7, '#f2c260'); sky.addColorStop(1, '#fff1c8'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // God rays turning slowly from behind the disc
    g.save(); g.globalCompositeOperation = 'lighter'; const sx = cx, sy = cy - 80 * u, n = 18; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + t * 0.12, wdt = 0.05 + 0.04 * Math.sin(i * 1.7); const gr = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H)); gr.addColorStop(0, 'rgba(255,240,190,0.28)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy); g.arc(sx, sy, Math.max(W, H) * 1.2, a, a + wdt); g.closePath(); g.fill(); } g.restore();
    // Clouds drifting past, lit from behind
    const r = rng(3); for (let i = 0; i < 16; i++) { const y = H * (0.55 + r() * 0.5), sp = 30 + r() * 60, x = ((r() * W * 1.4 + t * sp * u) % (W * 1.4)) - W * 0.2, R = (160 + r() * 260) * u, cg = g.createRadialGradient(x, y, 0, x, y, R); cg.addColorStop(0, 'rgba(255,245,225,0.55)'); cg.addColorStop(0.6, 'rgba(250,220,170,0.25)'); cg.addColorStop(1, 'rgba(250,220,170,0)'); g.fillStyle = cg; g.fillRect(x - R, y - R, R * 2, R * 2); }
    // Specks of gold dust
    const rd = rng(17); g.fillStyle = '#fff3c4'; for (let i = 0; i < 80; i++) { const x = rd() * W, y = ((rd() * H - t * (20 + rd() * 40) * u) % H + H) % H; g.globalAlpha = 0.25 + 0.5 * rd(); g.beginPath(); g.arc(x, y, (1 + rd() * 2.2) * u, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
  }
  function flare(g, x, y, L, k) { const { u, cx, cy } = L; g.save(); g.globalCompositeOperation = 'lighter'; const dx = cx - x, dy = cy - y;
    [[0, 200, 'rgba(255,240,200,0.5)'], [0.4, 40, 'rgba(255,200,120,0.25)'], [0.7, 70, 'rgba(160,200,255,0.18)'], [1.3, 110, 'rgba(255,170,90,0.14)'], [1.7, 30, 'rgba(255,255,255,0.25)']].forEach(([f, r, c]) => { const px = x + dx * f * 2, py = y + dy * f * 2, R = r * u * k, gr = g.createRadialGradient(px, py, 0, px, py, R); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - R, py - R, R * 2, R * 2); });
    g.strokeStyle = 'rgba(255,240,210,0.35)'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(x - 600 * u * k, y); g.lineTo(x + 600 * u * k, y); g.stroke(); g.restore(); }
  // A tentacle like his squid's: white, tapering, curling, suckers along the inside
  function tentacle(g, pts, w0, u) { const n = pts.length; if (n < 2) return; const norm = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
    const left = [], right = []; pts.forEach((p, i) => { const w = w0 * Math.max(0.06, 1 - Math.pow(i / n, 1.4) * 0.94), nn = norm(i); left.push([p[0] + nn[0] * w, p[1] + nn[1] * w]); right.push([p[0] - nn[0] * w, p[1] - nn[1] * w]); });
    g.save(); g.beginPath(); left.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); for (let i = n - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]); g.closePath(); const gr = g.createLinearGradient(0, pts[0][1] - w0, 0, pts[0][1] + w0); gr.addColorStop(0, '#fbfaf7'); gr.addColorStop(1, '#bdb7af'); g.fillStyle = gr; g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 24 * u; g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3 * u; g.beginPath(); left.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.strokeStyle = 'rgba(90,80,70,0.5)'; g.beginPath(); right.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    for (let i = 2; i < n - 2; i += 2) { const p = pts[i], nn = norm(i), w = w0 * Math.max(0.06, 1 - Math.pow(i / n, 1.4) * 0.94), sx = p[0] - nn[0] * w * 0.5, sy = p[1] - nn[1] * w * 0.5, R = w * 0.3; g.fillStyle = '#d8d1c8'; g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8f877e'; g.beginPath(); g.arc(sx, sy, R * 0.45, 0, Math.PI * 2); g.fill(); } g.restore(); }
  function tentaclePts(L, reach, curl, tip) { const { u, W, H, cx, cy } = L, T = tip || [cx + 70 * u, cy - 60 * u], B = [W + 120 * u, cy + 380 * u], C = [lerp(B[0], T[0], 0.35) + 60 * u, cy + 330 * u], pts = [];
    // a smooth arc from off the right edge, reaching (reach 0..1) towards the tip, the last third curling round on itself
    const n = 40, bz = (f) => [(1 - f) * (1 - f) * B[0] + 2 * (1 - f) * f * C[0] + f * f * T[0], (1 - f) * (1 - f) * B[1] + 2 * (1 - f) * f * C[1] + f * f * T[1]];
    for (let i = 0; i <= n; i++) { const f = i / n * reach; pts.push(bz(f)); }
    const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last; let h = Math.atan2(last[1] - prev[1], last[0] - prev[0]), x = last[0], y = last[1]; const steps = 16, seg = 9 * u * reach;
    for (let k = 1; k <= steps; k++) { h -= (0.18 + 0.05 * k) * curl; x += Math.cos(h) * seg * (1 - k / steps * 0.6); y += Math.sin(h) * seg * (1 - k / steps * 0.6); pts.push([x, y]); }
    return pts; }
  function drawEpic(g, t, L, cfg) {
    const { u, cx, cy, W, H } = L, name = nameOf(cfg);
    if (t < EPC.cut) {
      heaven(g, t, L);
      // The disc rises in glory, rim lit
      const rf = eo((t - EPC.rise) / 1.6), R = 160 * u * (0.7 + 0.3 * rf), dy = lerp(H * 0.3, 0, rf), y = cy - 110 * u + dy; if (cfg.logo !== false) { g.save(); g.shadowColor = 'rgba(255,220,140,0.9)'; g.shadowBlur = 60 * u; discAt(g, cx, y, R, { rim: 8 * u, rimCol: '#f6d27a' }); g.restore(); }
      flare(g, cx + 30 * u, y - R * 0.6, L, 0.6 + 0.6 * sm((t - 1.0) / 1.2));
      // The name in gold, swinging up out of the depth
      const wk = t - EPC.word; if (wk > 0) { const f = eo(wk / 1.0), size = fitFont(g, name, '900', SERIF, 150 * u, W * 0.88); g.save(); g.translate(cx, cy + 230 * u); g.transform(1, 0, 0, lerp(0.2, 1, f), 0, 0); g.scale(lerp(1.6, 1, f), lerp(1.6, 1, f)); g.globalAlpha = sm(wk / 0.3); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillStyle = 'rgba(60,30,0,0.5)'; g.fillText(name, 6 * u, 8 * u);
        const NB = layerBuf('gold', W, Math.ceil(size * 1.6)), ng = NB.getContext('2d'); ng.setTransform(1, 0, 0, 1, 0, 0); ng.globalCompositeOperation = 'source-over'; ng.clearRect(0, 0, NB.width, NB.height); ng.translate(W / 2, size * 1.15); ng.font = g.font; ng.textAlign = 'center'; ng.textBaseline = 'alphabetic';
        const gd = ng.createLinearGradient(0, -size * 0.85, 0, size * 0.1); gd.addColorStop(0, '#fff6d0'); gd.addColorStop(0.35, '#f2c050'); gd.addColorStop(0.55, '#a8701a'); gd.addColorStop(0.75, '#f8d97a'); gd.addColorStop(1, '#8a5a12'); ng.fillStyle = gd; ng.fillText(name, 0, 0); ng.strokeStyle = 'rgba(255,250,220,0.8)'; ng.lineWidth = 2 * u; ng.strokeText(name, 0, 0);
        // a glint running across the letters
        const gx = lerp(-W * 0.6, W * 0.6, ((wk - 0.6) % 1.4 + 1.4) % 1.4 / 1.4); ng.globalCompositeOperation = 'source-atop'; const gl = ng.createLinearGradient(gx - 80 * u, 0, gx + 80 * u, 0); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); ng.fillStyle = gl; ng.fillRect(-W, -size * 1.2, W * 2, size * 1.6);
        g.drawImage(NB, -W / 2, -size * 1.15); g.restore(); }
      // Then the tentacle: in from the right, winding up, and it hits
      const rk = t - EPC.reach; if (rk > 0) { const reach = eio(rk / 0.25); tentacle(g, tentaclePts(L, reach, 0.6 + rk * 2.5, [cx + 30 * u, cy - 40 * u]), 105 * u, u); }
    } else {
      // Cut. Dead. The glory switches off like an old telly, and then a plain dark room and nothing else.
      const ck = t - EPC.cut; g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
      if (ck < 0.32) { const TB = layerBuf('tv', W, H), tg = TB.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H); drawEpic(tg, EPC.cut - 0.001, L, Object.assign({}, cfg, { episode: '' }));
        const sy = ck < 0.12 ? Math.max(0.006, 1 - eo(ck / 0.12)) : 0.006, sx = ck < 0.12 ? 1 : Math.max(0.004, 1 - eo((ck - 0.12) / 0.14)); g.save(); g.translate(cx, cy); g.scale(sx, sy); g.filter = 'brightness(' + (1 + ck * 8).toFixed(2) + ')'; g.drawImage(TB, -W / 2, -H / 2); g.restore();
        if (ck > 0.1) { const a = ck < 0.26 ? 1 : 1 - (ck - 0.26) / 0.06, R0 = 18 * u; g.save(); g.globalCompositeOperation = 'lighter'; const dg = g.createRadialGradient(cx, cy, 0, cx, cy, R0 * 3); dg.addColorStop(0, `rgba(255,255,255,${cl(a, 0, 1)})`); dg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = dg; g.fillRect(cx - R0 * 3, cy - R0 * 3, R0 * 6, R0 * 6); g.restore(); }
        episode(g, t, L, cfg, BASE.epic - 0.6, 'epic'); return; }
      g.fillStyle = '#0d1424'; g.fillRect(0, 0, W, H); const vg = g.createRadialGradient(cx, cy, 100 * u, cx, cy, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(30,40,60,0.6)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      // The tentacle comes back in with the disc and slaps it down, squint
      const sk = t - EPC.slap, R = 140 * u; if (cfg.logo !== false && sk > -0.25) { const inF = sk < 0 ? eio((sk + 0.25) / 0.25) : 1, x = lerp(W + 200 * u, cx - 10 * u, inF), y = cy - 120 * u, s = 1 + spring(sk, 0.08, 30, 9);
        g.save(); g.translate(x, y); g.rotate(-0.13); g.scale(s, s); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 20 * u; g.shadowOffsetY = 8 * u; discAt(g, 0, 0, R); g.restore();
        const away = sk > 0.12 ? eio((sk - 0.12) / 0.35) : 0; if (away < 1) { const pts = tentaclePts(L, 1 - away * 0.95, 0.5, [x + 40 * u + away * 300 * u, y + 30 * u]); tentacle(g, pts, 95 * u, u); } }
      // The name, plain white, a wee bit squint, as if slapped on in a hurry
      const wk = t - EPC.wslap; if (wk > 0) { const s = 1 + spring(wk, 0.18, 30, 10); g.save(); g.translate(cx + 14 * u, cy + 170 * u); g.rotate(0.04); g.scale(s, s); fitFont(g, name, '900', HEAVY, 112 * u, W * 0.82); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#f2f2f2'; g.fillText(name, 0, 0); g.restore(); }
      const line = lineOf(cfg), lk = t - EPC.line; if (line && lk > 0) { g.save(); fitFont(g, line, '600', COND, 40 * u, W * 0.7); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(220,226,236,' + sm(lk / 0.25).toFixed(3) + ')'; spaced(g, line, cx - 6 * u, cy + 255 * u, 4 * u, 'center'); g.restore(); }
    }
    episode(g, t, L, cfg, BASE.epic - 0.6, 'epic');
  }

  /* ================= The episode title, in each style's own way ================= */
  function episode(g, t, L, cfg, at, style) {
    const ep = epOf(cfg); if (!ep) return; const k = t - at; if (k < 0) return; const { u, cx, cy, W, H } = L, kick = String(cfg.kicker || '').trim().slice(0, 40), y = cy + 425 * u;
    g.save();
    if (style === 'ink') { g.globalAlpha = sm(k / 0.5); if (kick) { fitFont(g, kick.toUpperCase(), '700', COND, 26 * u, W * 0.6); g.fillStyle = '#b8161d'; g.textBaseline = 'alphabetic'; spaced(g, kick.toUpperCase(), cx, y - 46 * u, 5 * u, 'center'); }
      const size = fitFont(g, ep, 'italic 400', SERIF, 50 * u, W * 0.82); g.fillStyle = INKC; g.textAlign = 'center'; g.save(); g.beginPath(); g.rect(0, 0, lerp(0, W, eio(k / 0.9)), H); g.clip(); g.fillText(ep, cx, y); g.restore(); void size; }
    else if (style === 'battered') { const s = 1 + spring(k, 0.3, 26, 9), size = fitFont(g, ep, '400', MARK, 40 * u, W * 0.7), tw = g.measureText(ep).width, pad = 22 * u; g.translate(cx - tw / 2, y + 40 * u); g.rotate(-0.04); g.scale(s, s);
      g.fillStyle = '#fbfaf3'; g.shadowColor = 'rgba(40,20,0,0.4)'; g.shadowBlur = 12 * u; g.shadowOffsetY = 5 * u; g.fillRect(-pad, -size - (kick ? 34 * u : 6 * u), tw + pad * 2, size * 1.5 + (kick ? 34 * u : 6 * u)); g.shadowColor = 'transparent';
      if (kick) { g.fillStyle = '#c4141c'; g.font = '700 ' + (22 * u).toFixed(1) + 'px ' + COND; g.fillText(kick.toUpperCase(), 0, -size - 4 * u); } g.fillStyle = '#1a1a2a'; g.font = '400 ' + size.toFixed(1) + 'px ' + MARK; g.fillText(ep, 0, 0); }
    else if (style === 'neon') { // A fly poster pasted on the wall, slapped on and smoothed flat
      const s = 1 + spring(k, 0.12, 24, 8), pw = 980 * u, ph = (kick ? 190 : 150) * u; g.translate(cx, y - 10 * u); g.rotate(0.015); g.scale(s, s); const r = rng(hash(ep));
      g.fillStyle = '#e9e4d6'; g.beginPath(); for (let i = 0; i <= 40; i++) { const f = i / 40, side = Math.floor(f * 4), q = (f * 4) % 1, j = (r() - 0.5) * 6 * u; const p = side === 0 ? [-pw / 2 + q * pw, -ph / 2 + j] : side === 1 ? [pw / 2 + j, -ph / 2 + q * ph] : side === 2 ? [pw / 2 - q * pw, ph / 2 + j] : [-pw / 2 + j, ph / 2 - q * ph]; i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-pw / 2, -ph / 2, pw, ph); // lit by the night, not the sun
      if (kick) { g.fillStyle = '#c4141c'; fitFont(g, kick.toUpperCase(), '900', HEAVY, 34 * u, pw * 0.8); g.textAlign = 'center'; g.fillText(kick.toUpperCase(), 0, -ph / 2 + 50 * u); }
      g.fillStyle = '#111'; fitFont(g, ep.toUpperCase(), '900', HEAVY, 62 * u, pw * 0.9); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(ep.toUpperCase(), 0, ph / 2 - 30 * u);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(40,20,40,0.35)'; g.fillRect(-pw / 2, -ph / 2, pw, ph); }
    else { const s = 1 + spring(k, 0.14, 30, 10); g.translate(cx - 6 * u, y); g.rotate(-0.02); g.scale(s, s); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (kick) { g.fillStyle = '#7f8aa0'; fitFont(g, kick.toUpperCase(), '700', COND, 24 * u, W * 0.6); g.fillText(kick.toUpperCase(), 0, -50 * u); } g.fillStyle = '#ffffff'; fitFont(g, ep, '700', COND, 48 * u, W * 0.82); g.fillText(ep, 0, 0); }
    g.restore();
  }

  /* ================= Ink, Battered and Epic in 3D (G3) =================
     The 3D world is laid out from a fixed reference frame (1280x720): one world unit is 200 design pixels, so the 2D
     timings, positions and words carry over. Table top scenes have the table at z = 0 and the camera above it. */
  const REF = layout(1280, 720), RS = 200 * REF.u, VIEW = [REF.W / 2 / RS, REF.H / 2 / RS];
  const toW = (p, z = 0) => [(p[0] - REF.cx) / RS, (REF.cy - p[1]) / RS, z];
  const mixV = (A, B, f) => A.map((v, i) => lerp(v, B[i], f));
  function camPath(t, keys) { if (t <= keys[0][0]) return [keys[0][1], keys[0][2]]; for (let i = 0; i < keys.length - 1; i++) { const [t0, e0, a0] = keys[i], [t1, e1, a1] = keys[i + 1]; if (t < t1) { const f = eio((t - t0) / (t1 - t0)); return [mixV(e0, e1, f), mixV(a0, a1, f)]; } } const k = keys[keys.length - 1]; return [k[1], k[2]]; }
  function cam3(keys, t, W, H, shake) { let [e, a] = camPath(t, keys); const back = Math.max(1, 1.62 / (W / H)); e = a.map((v, i) => v + (e[i] - v) * back); if (shake) e = e.map((v, i) => v + (shake[i] || 0)); return { e, a, fov: 40 * Math.PI / 180 }; }
  const g3ok = () => typeof G3 !== 'undefined' && G3.available();
  function setCam(P, cam, t, fade) { G3.set(P, 'uEye', cam.e); G3.set(P, 'uTgt', cam.a); G3.set(P, 'uFov', cam.fov); G3.set(P, 'uT', t); G3.set(P, 'uFade', fade == null ? 1 : fade); G3.set(P, 'uView', VIEW); }
  function logoTex(P, unit, name) { const lt = logo ? G3.imageTex('logo', logo) : null; G3.tex(unit, lt || G3.imageTex('blank', blankC()), P, name); G3.set(P, 'uLogoOK', lt ? 1 : 0); }
  let blank = null; const blankC = () => blank || (blank = mk(2, 2));
  // A transparent layer in the reference frame, for flat printed things (lines, tickets, posters) the 2D code draws
  const printB = {}; function printLayer(k, fn) { const c = printB[k] || (printB[k] = mk(REF.W, REF.H)), g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, REF.W, REF.H); g.save(); fn(g); g.restore(); return c; }
  const VS3 = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform vec2 uRes, uView; uniform vec3 uEye, uTgt; uniform float uFov, uT, uFade, uLogoOK;`;
  const CAM3 = `vec3 f = normalize(uTgt - uEye), rr = normalize(cross(f, vec3(0., 1., 0.))), up = cross(rr, f);
  vec2 sp = (gl_FragCoord.xy - .5 * uRes) / (.5 * uRes.y); vec3 rd = normalize(f / tan(uFov * .5) + rr * sp.x + up * sp.y), ro = uEye;`;
  const NRM3 = `vec3 nrmO(vec3 p){ const vec2 e = vec2(.0012, -.0012); return normalize(e.xyy * mapD(p + e.xyy) + e.yyx * mapD(p + e.yyx) + e.yxy * mapD(p + e.yxy) + e.xxx * mapD(p + e.xxx)); }
vec2 refUV(vec2 xy){ return vec2(xy.x / (2. * uView.x) + .5, .5 - xy.y / (2. * uView.y)); }
vec3 logoAt(vec2 q, float R){ vec2 uv = vec2(q.x, -q.y) / (R * 2. / .976) + .5; return uLogoOK > .5 ? pow(texture(uLogo, uv).rgb, vec3(2.2)) : vec3(.02, .1, .35); }`;

  /* ---------- Ink burst ---------- */
  const INK3FS = () => `${VS3}
uniform sampler2D uInk, uName, uLogo, uPrint;
uniform vec4 uNameBox; uniform vec2 uNameOff; uniform float uSoak, uNameH;
uniform vec4 uDrop; uniform float uDropS; uniform vec3 uCoin; uniform float uCoinR, uHasCoin, uDrain;
${G3.COMMON}
const vec3 KEY = vec3(-.42, .5, .76), INKC = vec3(.004, .006, .012), PAPER = vec3(.80, .74, .62);
float inkA(vec2 xy){ vec2 uv = vec2(xy.x / (2. * uView.x) + .5, .5 - xy.y / (2. * uView.y)); if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.; return texture(uInk, uv).a; }
float inkH(vec2 xy){ return .05 * smoothstep(.34, .9, inkA(xy)); }
float letH(float x){ return uNameH * (1. - smoothstep(uSoak - .6, uSoak, x)); }
float mapO(vec3 p, out float id){
  float d2 = texSdf(uName, uNameBox, p.xy - uNameOff), lh = letH(p.x); float d = sdExtrude(d2, p.z, max(lh, .0004), .008); if (lh < .004) d = max(d, .03); id = 1.;
  if (uHasCoin > .5){ float dc = sdCapCyl(p - vec3(uCoin.xy, uCoin.z - .1), uCoinR, .1, .03); if (dc < d){ d = dc; id = 2.; } }
  if (uDrop.w > 0.){ vec3 q = p - uDrop.xyz; q.z /= uDropS; float dd = (length(q) - uDrop.w) * min(1., uDropS); if (dd < d){ d = dd; id = 3.; } }
  return d; }
float mapD(vec3 p){ float i; return mapO(p, i); }
${NRM3}
float zTop(){ return max(.4, uDrop.z + uDrop.w * uDropS + .05); }
float softSh(vec3 p, vec3 l){ float r = 1., t = .012; for (int i = 0; i < 32; i++){ float d = mapD(p + l * t); r = min(r, 10. * d / t); t += clamp(d, .01, .3); if (r < .01 || p.z + l.z * t > zTop()) break; } return clamp(r, 0., 1.); }
vec3 env(vec3 r){ vec3 c = vec3(.025, .027, .035) * (.4 + .6 * max(r.z, 0.)); vec3 k = normalize(KEY); vec2 q = r.xy / max(r.z, .05) - k.xy / k.z; float box = smoothstep(.6, .4, abs(q.x)) * smoothstep(.45, .28, abs(q.y)); return c + vec3(1.05, 1.02, 1.) * box * step(0., r.z) * 1.4; }
void main(){
  ${CAM3}
  vec3 L = normalize(KEY); float tw = rd.z < -1e-4 ? -ro.z / rd.z : 1e4, t = rd.z < 0. ? max(0., (zTop() - ro.z) / rd.z) : 0., id = 0.; bool hit = false;
  for (int i = 0; i < 120; i++){ if (t > tw) break; vec3 p = ro + rd * t; float d = mapO(p, id); if (d < .0006 * t){ hit = true; break; } t += d * .9; }
  vec3 col, n, alb; float gloss, sh; vec3 p;
  if (hit){ p = ro + rd * t; n = nrmO(p);
    if (id < 1.5){ float m = smoothstep(.36, .56, inkA(p.xy)); alb = mix(INKC, PAPER, m); gloss = mix(1., .1, m); }
    else if (id < 2.5){ vec3 q = p - uCoin; float rq = length(q.xy); if (n.z > .7 && rq < uCoinR * .9){ vec3 lg = logoAt(q.xy, uCoinR * .9); float cover = smoothstep(-.05, .05, uDrain * uCoinR * 1.3 - rq - .12 * vnoise(q.xy * 5. + 3.)); alb = mix(INKC, lg, cover); gloss = mix(1., .6, cover); } else { alb = PAPER * .92; gloss = .5; } }
    else { alb = INKC; gloss = 1.; }
  } else { p = ro + rd * tw; vec2 xy = p.xy; float a = inkA(xy), m = smoothstep(.36, .56, a); const float e = .01; float h0 = inkH(xy), hx = inkH(xy + vec2(e, 0.)), hy = inkH(xy + vec2(0., e));
    n = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.)); n = normalize(n + vec3(vnoise(xy * 45.) - .5, vnoise(xy * 45. + 7.) - .5, 0.) * .07 * (1. - m)); p.z = h0;
    vec3 paper = PAPER * (.88 + .14 * fbm(xy * 22.)); paper *= 1. - .3 * smoothstep(.1, .36, a) * (1. - m); paper *= 1. - .4 * smoothstep(0., .04, inkH(xy + L.xy * .09)) * (1. - m);
    vec4 pr = texture(uPrint, refUV(xy)); paper = mix(paper, pow(pr.rgb, vec3(2.2)), pr.a); alb = mix(paper, INKC, m); gloss = m; }
  sh = softSh(p + n * .003, L); vec3 r = reflect(rd, n); float fr = .04 + .96 * pow(1. - max(dot(n, -rd), 0.), 5.);
  float pool = .6 + .5 * exp(-dot(p.xy - vec2(-.6, .5), p.xy - vec2(-.6, .5)) * .08);
  col = alb * (max(dot(n, L), 0.) * sh * vec3(1.05, 1., .93) * 1.35 * pool + vec3(.2, .21, .24)) + env(r) * fr * gloss * (.35 + .65 * sh) + vec3(1.) * pow(max(dot(r, L), 0.), 140.) * 4. * gloss * sh;
  o = vec4(max(col, 0.) * uFade, 1.); }`;
  function drawInk3D(g, t, L, cfg) {
    if (!g3ok()) return false; const { W, H } = L, name = nameOf(cfg) || ' ';
    const nm = G3.textSdf(name, HEAVY, { worldW: REF.W * 0.86 / RS, maxWorldH: 148 * REF.u / RS, weight: '900', spacing: 0, key: 'ink' }); if (!nm) return false;
    const em = nm.capH / 0.72, nameY = -255 * REF.u / RS + 0.36 * em, M = inkMask(t, REF, cfg, true), e = t - INK.hit, P0 = toW([REF.cx, REF.cy - 70 * REF.u]);
    // the line and the episode title are printed on the paper
    const pr = printLayer('ink', pg => { const { u, cx, cy, W: W0 } = REF, line = lineOf(cfg); if (line && t > INK.line) { const f = eo((t - INK.line) / 0.6), y = cy + 330 * u; pg.fillStyle = '#b8161d'; const rw = 520 * u * f; pg.fillRect(cx - rw / 2, y - 46 * u, rw, 3 * u); fitFont(pg, line, '700', COND, 40 * u, W0 * 0.8); pg.globalAlpha = sm((t - INK.line - 0.15) / 0.4); pg.fillStyle = INKC; pg.textBaseline = 'alphabetic'; spaced(pg, line, cx, y + (1 - f) * 10 * u, 6 * u, 'center'); pg.globalAlpha = 1; } episode(pg, t, REF, cfg, BASE.ink - 0.6, 'ink'); });
    const ep = !!epOf(cfg), end = duration(cfg);
    const keys = [[0, [0.1, -0.7, 7.6], [0, 0.3, 0]], [0.6, [0.1, -1.0, 7.0], [0, 0.3, 0]], [1.6, [-0.9, -4.2, 4.8], [0, 0.0, 0]], [3.1, [1.1, -5.4, 3.4], [0.2, -0.6, 0.1]], [4.5, [0, -4.6, 6.3], [0, -0.55, 0]]];
    if (ep) keys.push([Math.min(end, 6.2), [0, -5.0, 6.4], [0, -1.05, 0]]);
    const sh = e > 0 && e < 0.35 ? [Math.sin(e * 80) * 0.05 * (1 - e / 0.35), Math.cos(e * 67) * 0.05 * (1 - e / 0.35), 0] : null, cam = cam3(keys, t, W, H, sh);
    const df = cl((t - INK.drop) / (INK.hit - INK.drop), 0, 1), drop = t >= INK.drop && e < 0 ? [P0[0], P0[1], lerp(7, 0.08, df * df), 0.12] : [0, 0, 0, 0];
    const rf = eo((t - INK.disc) / 0.7), wf = (t - INK.word) / 0.75, x0 = -nm.width / 2 - 0.3, x1 = nm.width / 2 + 0.5;
    return G3.render('ink3', INK3FS(), g, W, H, P => { const S = (k, v) => G3.set(P, k, v); setCam(P, cam, t, sm(t / 0.25));
      G3.tex(0, G3.imageTex('inkmask', M, true), P, 'uInk'); G3.tex(1, nm.tex, P, 'uName'); logoTex(P, 2, 'uLogo'); G3.tex(3, G3.imageTex('inkprint', pr, true), P, 'uPrint');
      S('uNameBox', nm.box); S('uNameOff', [0, nameY]); S('uSoak', t < INK.word ? -99 : lerp(x0, x1, eio(wf))); S('uNameH', 0.085);
      S('uDrop', drop); S('uDropS', 1 + 1.4 * df); S('uCoin', [P0[0], P0[1], lerp(-0.14, 0.13, rf)]); S('uCoinR', 168 * REF.u / RS); S('uHasCoin', cfg.logo !== false && t > INK.disc ? 1 : 0); S('uDrain', eo((t - INK.disc - 0.2) / 0.9));
    }, { scale: 1, adaptive: q3live, t, bloom: 0.35, expo: 1.05, grain: 0.03, thresh: 0.9, vig: 0.7 });
  }

  /* ---------- Battered ---------- */
  const COIN3 = `float batter(vec2 q){ return .045 + .03 * vnoise(q * 6.) + .022 * vnoise(q * 15. + 3.) + .012 * vnoise(q * 33. + 9.); }`;
  const FRY3FS = () => `${VS3}
uniform sampler2D uLogo; uniform vec3 uCoin; uniform float uCoinR, uTilt, uBat, uHasCoin, uSpl, uLift, uFury;
uniform vec4 uDr[24]; uniform int uND;
${G3.COMMON}
${COIN3}
const vec2 FRY = vec2(5.4, 3.2); const vec3 KEY = vec3(.25, .5, .83);
vec3 coinQ(vec3 p){ vec3 q = p - uCoin; q.yz = rot2(-uTilt) * q.yz; return q; }
float mapO(vec3 p, out float id){
  float d = max(sdRoundBox(p - vec3(0., 0., -.5), vec3(FRY + 5., 1.35), .02), -sdRoundBox(p - vec3(0., 0., -.2), vec3(FRY, 1.5), .1)); id = 1.;
  if (uHasCoin > .5){ vec3 q = coinQ(p); float dc = sdCapCyl(q, uCoinR, .1, .04); if (dc < .4) dc -= uBat * batter(q.xy); if (dc < d){ d = dc * .8; id = 2.; } }
  for (int i = 0; i < 24; i++){ if (i >= uND) break; float dd = length(p - uDr[i].xyz) - uDr[i].w; if (dd < d){ d = dd; id = 3.; } }
  if (uLift > -1.){ vec2 q = rot2(.785) * p.xy; vec2 c = mod(q, .34) - .17; float dz = p.z - uLift; float dg = min(length(vec2(c.x, dz)), length(vec2(c.y, dz))) - .02; dg = max(dg, sdRoundBox(vec3(p.xy, 0.), vec3(FRY - .15, 1.), .1)); if (dg < d){ d = dg; id = 4.; } }
  return d; }
float mapD(vec3 p){ float i; return mapO(p, i); }
${NRM3}
float softSh(vec3 p, vec3 l){ float r = 1., t = .015; for (int i = 0; i < 28; i++){ float d = mapD(p + l * t); r = min(r, 9. * d / t); t += clamp(d, .01, .3); if (r < .01 || p.z + l.z * t > 1.8) break; } return clamp(r, 0., 1.); }
vec3 envK(vec3 r){ float z = max(r.z, .08); vec3 c = vec3(.05, .045, .04) * (.4 + .6 * max(r.z, 0.)); vec2 q = r.xy / z; float s1 = smoothstep(.09, .0, abs(q.y - .6)) * smoothstep(1.6, 1.0, abs(q.x)); float s2 = smoothstep(.2, .0, length(q - vec2(-1., -.3)) - .1); float s3 = smoothstep(.2, .0, length(q - vec2(1.1, .1)) - .08);
  return c + (vec3(1., .97, .9) * s1 * .9 + vec3(1., .62, .28) * (s2 + s3) * 1.2) * step(0., r.z); }
float oilH(vec2 p){ float h = .0022 * sin(p.x * 2.1 + uT * 1.6 + sin(p.y * 1.3)) + .002 * sin(p.y * 2.6 - uT * 1.2) + .0012 * sin((p.x + p.y) * 5. + uT * 2.6);
  if (uSpl > 0.){ float r = length(p - uCoin.xy), k = r - uCoinR - uSpl * 2.6; h += .05 * exp(-uSpl * 1.3) * sin(k * 11.) * exp(-k * k * 1.6) * smoothstep(uCoinR * .9, uCoinR * 1.1, r); }
  return h; }
vec4 bubbles(vec2 p, float dens, float sc){ p *= sc; vec2 gc = floor(p), fc = fract(p); float bd = 2.; vec2 off = vec2(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 o2 = vec2(i, j), id = gc + o2; float h1 = hash12(id), h2 = hash12(id + 17.3); if (hash12(id + 5.1) > dens) continue; vec2 c = o2 + vec2(h1, h2) * .7 + .15 - fc; float life = .4 + h1 * .5, ph = fract(uT / life + h2 * 7.), r = (.12 + .2 * h2) * sin(3.1416 * ph); float d = length(c) / max(r, 1e-3); if (d < bd){ bd = d; off = -c / max(r, 1e-3); } }
  if (bd >= 1.) return vec4(0.); return vec4(off, sqrt(1. - bd * bd), 1.); }
vec3 objCol(float id, vec3 p, vec3 n, vec3 rd){ vec3 L = normalize(KEY), r = reflect(rd, n); float fr = .04 + .96 * pow(1. - max(dot(n, -rd), 0.), 5.), dif = max(dot(n, L), 0.);
  if (id < 1.5){ vec3 rb = normalize(r + vec3(0., (vnoise(p.xy * vec2(2., 90.)) - .5) * .25, 0.)); return vec3(.03) + envK(rb) * (.5 + .4 * fr) + vec3(.05) * dif; }
  if (id < 2.5){ vec3 q = coinQ(p); vec3 nq = n; nq.yz = rot2(-uTilt) * nq.yz; vec3 lg = logoAt(q.xy, uCoinR); float lum = dot(lg, vec3(.3, .5, .2));
    vec3 bat = mix(vec3(.38, .14, .015), vec3(.85, .48, .1), fbm(q.xy * 9.)) * (.7 + .5 * smoothstep(.1, .5, lum)); vec3 a = mix(nq.z > .6 ? lg : vec3(.5, .5, .48), bat, smoothstep(.0, .6, uBat));
    return a * (dif * vec3(1.1, .95, .75) + .12) + envK(r) * fr * mix(.6, .3, uBat) + vec3(1., .9, .7) * pow(max(dot(r, L), 0.), 40.) * .5 * uBat; }
  if (id < 3.5) return vec3(.55, .27, .04) * (dif + .3) + envK(r) * (.1 + fr) * 1.5;
  return vec3(.2) * (dif + .2) + envK(r) * .7; }
void main(){
  ${CAM3}
  vec3 L = normalize(KEY); float t = rd.z < 0. ? max(0., (max(2., uCoin.z + .6) - ro.z) / rd.z) : 0., id = 0.; bool hit = false; float tOil = rd.z < -1e-4 ? -ro.z / rd.z : 1e4, tFar = tOil + 3.;
  for (int i = 0; i < 120; i++){ if (t > tFar) break; vec3 p = ro + rd * t; float d = mapO(p, id); if (d < .0006 * t){ hit = true; break; } t += d * .9; }
  vec3 po = ro + rd * tOil; bool inOil = tOil < 1e3 && abs(po.x) < FRY.x - .1 && abs(po.y) < FRY.y - .1 && (!hit || t > tOil);
  vec3 col = vec3(.01);
  if (inOil){ vec2 xy = po.xy; const float e = .01; float h0 = oilH(xy); vec3 n = normalize(vec3(-(oilH(xy + vec2(e, 0.)) - h0) / e, -(oilH(xy + vec2(0., e)) - h0) / e, 1.));
    float near = uFury * exp(-pow(max(length(xy - uCoin.xy) - uCoinR, 0.) * 1.4, 2.)); vec4 b1 = bubbles(xy, .35, 5.), b2 = bubbles(xy + 11., near * .95, 8.); vec4 b = b1.w > 0. ? b1 : b2; if (b.w > 0.) n = normalize(mix(n, b.xyz, .9));
    vec3 r = reflect(rd, n); float fr = .05 + .95 * pow(1. - max(dot(n, -rd), 0.), 5.);
    vec3 deep = vec3(.16, .055, .006) * (.7 + .6 * fbm(xy * .6 + uT * .08)) + vec3(.35, .15, .02) * pow(fbm(xy * 1.4 - uT * .15), 3.) * .8;
    vec3 tr = deep; if (hit){ vec3 p = ro + rd * t; vec3 nn = nrmO(p); tr = objCol(id, p, nn, rd) * vec3(1., .5, .12) * exp(-(t - tOil) * 2.) * 1.2 + deep * (1. - exp(-(t - tOil) * 2.)); }
    col = tr * (1. - fr) + envK(r) * fr + vec3(1., .85, .6) * pow(max(dot(r, L), 0.), 300.) * 2.;
    if (b.w > 0.) col += vec3(1., .85, .5) * .08;
    col *= .55 + .45 * smoothstep(0., 1.2, min(FRY.x - abs(xy.x), FRY.y - abs(xy.y)));
  } else if (hit){ vec3 p = ro + rd * t, n = nrmO(p); col = objCol(id, p, n, rd) * mix(.4, 1., softSh(p + n * .004, L)); }
  // steam hanging over the fryer
  float st = fbm(vec2(gl_FragCoord.x / uRes.y * 2., gl_FragCoord.y / uRes.y * 2. - uT * .35)); col += vec3(.5, .45, .4) * smoothstep(.55, .9, st) * .12;
  o = vec4(max(col, 0.) * uFade, 1.); }`;
  // The chip heap: a height map of chips drawn once (cheap to march, proper shadows)
  const HEAP = { x0: -3.4, x1: 3.4, y0: -1.7, y1: 2.2, w: 640, h: 368 }; let heapC = null;
  function heap() { if (heapC) return heapC; const { x0, x1, y0, y1, w, h } = HEAP, hm = new Float32Array(w * h), cc = mk(w, h), cg = cc.getContext('2d'), im = cg.createImageData(w, h), d = im.data, r = rng(55), chips = [];
    for (let i = 3; i < d.length; i += 4) d[i] = 0;
    for (let i = 0; i < 115; i++) { const a = r() * Math.PI * 2, dd = Math.sqrt(r()) * 1.8, x = Math.cos(a) * dd * 1.35, y = 0.2 + Math.sin(a) * dd * 0.62; if (y < -0.75) continue; chips.push({ x, y, zc: 0.06 + 0.4 * Math.exp(-dd * dd * 0.45) + r() * 0.07, yaw: r() * Math.PI, hl: 0.3 + r() * 0.2, hw: 0.1 + r() * 0.03, pitch: (r() - 0.5) * 0.35, tone: r(), s: i }); }
    chips.sort((a, b) => a.zc - b.zc).forEach(c => { const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), ext = c.hl + c.hw, rs = rng(900 + c.s), spots = Array.from({ length: 5 }, () => [(rs() * 2 - 1) * c.hl, (rs() * 2 - 1) * c.hw * 0.7, 0.012 + rs() * 0.02]);
      const ix0 = Math.max(0, Math.floor((c.x - ext - x0) / (x1 - x0) * w)), ix1 = Math.min(w - 1, Math.ceil((c.x + ext - x0) / (x1 - x0) * w)), iy0 = Math.max(0, Math.floor((y1 - (c.y + ext)) / (y1 - y0) * h)), iy1 = Math.min(h - 1, Math.ceil((y1 - (c.y - ext)) / (y1 - y0) * h));
      for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) { const px = x0 + (ix + 0.5) / w * (x1 - x0), py = y1 - (iy + 0.5) / h * (y1 - y0), dx = px - c.x, dy = py - c.y, u = dx * cs + dy * sn, v = -dx * sn + dy * cs, ue = Math.max(0, Math.abs(u) - (c.hl - c.hw)), cr = c.hw * c.hw - v * v - ue * ue; if (cr <= 0) continue;
        const z = c.zc + u * c.pitch + 0.85 * Math.sqrt(cr), k = iy * w + ix; if (z <= hm[k]) continue; hm[k] = z; const end = Math.abs(u) / c.hl, side = Math.abs(v) / c.hw; let R = 238 - 14 * c.tone, G = 196 - 26 * c.tone - 22 * side, B = 112 - 40 * c.tone - 25 * side;
        const brown = sm((end - 0.75) / 0.25) * 0.6 + spots.reduce((s, q) => s + (Math.hypot(u - q[0], v - q[1]) < q[2] ? 0.55 : 0), 0); R = lerp(R, 168, brown); G = lerp(G, 104, brown); B = lerp(B, 36, brown); d[k * 4] = R; d[k * 4 + 1] = G; d[k * 4 + 2] = B; d[k * 4 + 3] = 255; } });
    cg.putImageData(im, 0, 0); return (heapC = { hm, c: cc }); }
  const CHIP3FS = () => `${VS3}
uniform sampler2D uLogo, uPaper, uHeap, uHeapC, uName, uBoard, uPrint; uniform vec4 uHeapR;
uniform vec3 uCoin; uniform float uCoinR, uSq, uHasCoin;
uniform vec4 uNameBox; uniform vec3 uSign; uniform float uSignS, uSignA, uHasSign;
uniform vec3 uBoardC; uniform vec2 uBoardH; uniform float uBoardA, uBoardS, uHasBoard;
uniform vec4 uVin[26]; uniform int uNV;
${G3.COMMON}
${COIN3}
const vec3 KEY = vec3(-.35, .45, .82);
vec2 heapUV(vec2 xy){ return vec2((xy.x - uHeapR.x) / (uHeapR.y - uHeapR.x), (uHeapR.w - xy.y) / (uHeapR.w - uHeapR.z)); }
float heapH(vec2 xy){ vec2 uv = heapUV(xy); if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.; return texture(uHeap, uv).r; }
vec3 coinQ(vec3 p){ vec3 q = p - uCoin; q.xy /= uSq; q.z *= uSq; return q; }
float signD(vec3 p, out float red){ vec3 q = p - uSign; q.xy = rot2(-uSignA) * q.xy; q.xy /= uSignS; q.z *= uSignS; float d2 = texSdf(uName, uNameBox, q.xy); float dw = sdExtrude(d2 - .075, q.z, .1, .015), dr = sdExtrude(d2, q.z - .09, .09, .012); red = dr < dw ? 1. : 0.; return min(dw, dr) * min(uSignS, 1. / uSignS); }
vec3 boardQ(vec3 p){ vec3 q = p - uBoardC; q.xy = rot2(-uBoardA) * q.xy; q /= uBoardS; return q; }
float mapO(vec3 p, out float id){ float d = (p.z - heapH(p.xy)) * .55; id = 1.;
  if (uHasCoin > .5){ vec3 q = coinQ(p); float dc = sdCapCyl(q, uCoinR, .11, .05); if (dc < .4) dc -= batter(q.xy); dc *= .75 * min(uSq, 1. / uSq); if (dc < d){ d = dc; id = 2.; } }
  if (uHasSign > .5){ float red; float ds = signD(p, red); if (ds < d){ d = ds; id = 3. + red * .25; } }
  if (uHasBoard > .5){ vec3 q = boardQ(p); float db = sdRoundBox(q, vec3(uBoardH, .03), .02) * uBoardS; if (db < d){ d = db; id = 4.; } }
  return d; }
float mapD(vec3 p){ float i; return mapO(p, i); }
${NRM3}
float softSh(vec3 p, vec3 l){ float r = 1., t = .015; for (int i = 0; i < 30; i++){ float d = mapD(p + l * t); r = min(r, 9. * d / t); t += clamp(d, .01, .25); if (r < .01 || p.z + l.z * t > max(1.4, uCoin.z * uHasCoin + .4)) break; } return clamp(r, 0., 1.); }
float vinegar(vec2 xy){ float w = 0.; for (int i = 0; i < 26; i++){ if (i >= uNV) break; w = max(w, uVin[i].w * smoothstep(uVin[i].z, uVin[i].z * .6, length(xy - uVin[i].xy))); } return w; }
vec3 envW(vec3 r){ return vec3(.06, .055, .05) * (.4 + .6 * max(r.z, 0.)) + vec3(1., .95, .85) * smoothstep(.8, .95, dot(r, normalize(KEY))) * 2.; }
void main(){
  ${CAM3}
  vec3 L = normalize(KEY); float t = rd.z < 0. ? max(0., (max(1.6, uCoin.z * uHasCoin + .5) - ro.z) / rd.z) : 0., tw = rd.z < -1e-4 ? -ro.z / rd.z + .01 : 1e4, id = 0.; bool hit = false;
  for (int i = 0; i < 140; i++){ if (t > tw) break; vec3 p = ro + rd * t; float d = mapO(p, id); if (d < .0006 * t){ hit = true; break; } t += d; }
  if (!hit){ t = tw; id = 1.; }
  vec3 p = ro + rd * t, n = nrmO(p); if (!hit) n = vec3(0., 0., 1.); vec3 alb; float gloss = .05, wet = vinegar(p.xy);
  if (id < 1.5){ float hh = heapH(p.xy); if (hh > .004){ alb = pow(texture(uHeapC, heapUV(p.xy)).rgb, vec3(2.2)); gloss = .3; } else { vec2 uv = refUV(p.xy); uv = abs(mod(uv + 1., 2.) - 1.); alb = pow(texture(uPaper, uv).rgb, vec3(2.2)) * .95; vec2 pu = refUV(p.xy); vec4 pr = pu.x > 0. && pu.y > 0. && pu.x < 1. && pu.y < 1. ? texture(uPrint, pu) : vec4(0.); alb = mix(alb, pow(pr.rgb, vec3(2.2)), pr.a); } }
  else if (id < 2.5){ vec3 q = coinQ(p); vec3 lg = logoAt(q.xy, uCoinR); float lum = dot(lg, vec3(.3, .5, .2)); alb = mix(vec3(.4, .15, .02), vec3(.85, .5, .12), fbm(q.xy * 9.)) * (.7 + .5 * smoothstep(.1, .5, lum) * step(.5, n.z)); gloss = .3; }
  else if (id < 3.1){ alb = vec3(.85, .84, .8); gloss = .25; }
  else if (id < 3.5){ alb = vec3(.42, .004, .006); gloss = .15; vec3 q = p - uSign; q.xy = rot2(-uSignA) * q.xy; q.xy /= uSignS; if (texSdf(uName, uNameBox, q.xy) > -.022 && n.z > .5) alb = vec3(.02); }
  else { vec3 q = boardQ(p); if (n.z > .5){ vec2 uv = vec2(q.x / uBoardH.x, -q.y / uBoardH.y) * .5 + .5; alb = pow(texture(uBoard, uv).rgb, vec3(2.2)); } else alb = vec3(.5, .02, .02); gloss = .5; }
  alb *= 1. - wet * .4; gloss = mix(gloss, .9, wet);
  float sh = softSh(p + n * .004, L), dif = max(dot(n, L), 0.) * sh; vec3 r = reflect(rd, n); float fr = .04 + .96 * pow(1. - max(dot(n, -rd), 0.), 5.);
  float pool = .55 + .55 * exp(-dot(p.xy - vec2(0., .2), p.xy - vec2(0., .2)) * .06);
  vec3 col = alb * (dif * vec3(1.15, 1.02, .85) * 1.4 * pool + vec3(.16, .17, .2) * (.6 + .4 * n.z)) + envW(r) * fr * gloss + vec3(1., .95, .85) * pow(max(dot(r, L), 0.), 60.) * gloss * sh * 1.5;
  o = vec4(max(col, 0.) * uFade, 1.); }`;
  const boardB = {}; function boardTex(line) { if (boardB.key === line) return boardB; const c = mk(1024, 160), g = c.getContext('2d'); g.fillStyle = '#c4141c'; g.fillRect(0, 0, 1024, 160); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4; g.strokeRect(10, 10, 1004, 140);
    const size = fitFont(g, line, '800', COND, 92, 940); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(line, 512, 84); void size; boardB.key = line; boardB.c = c; return boardB; }
  function drawBattered3D(g, t, L, cfg) {
    if (!g3ok()) return false; const { W, H } = L;
    if (t < BT.whip) return fryer3D(g, t, L, cfg);
    const wk = t - BT.whip; if (wk >= 0.22) return chips3D(g, t, L, cfg);
    // Whipped across: the fryer flies out left, the chip paper in from the right, smeared
    const pan = (1 - eo(wk / 0.22)) * W, A = layerBuf('w3a', W, H), B = layerBuf('w3b', W, H);
    if (!fryer3D(A.getContext('2d'), t, L, cfg) || !chips3D(B.getContext('2d'), t, L, cfg)) return false;
    g.drawImage(A, pan - W, 0); g.drawImage(B, pan, 0); const S = layerBuf('w3s', W, H), sg = S.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, W, H); sg.drawImage(g.canvas, 0, 0);
    g.save(); const a = 0.4 * (1 - wk / 0.22); for (let k = 1; k <= 5; k++) { g.globalAlpha = a / k; g.drawImage(S, k * 34 * L.u * (1 - wk / 0.22), 0); g.drawImage(S, -k * 34 * L.u * (1 - wk / 0.22), 0); } g.restore(); return true;
  }
  function fryer3D(g, t, L, cfg) { const { W, H } = L, R = 175 * REF.u / RS, c0 = [0, 0.1];
    const f = cl((t - BT.drop) / (BT.splash - BT.drop), 0, 1), se = t - BT.splash; let z = t < BT.splash ? lerp(4.8, 0.02, ei(f)) : -0.03 * Math.exp(-se * 3) + 0.02 * Math.sin(se * 7) + 0.005, tilt = t < BT.splash ? (1 - f) * 0.5 : Math.sin(se * 4) * 0.05;
    const drops = new Float32Array(96); let nd = 0; if (se > 0 && se < 1.2) { const r = rng(21); for (let i = 0; i < 24; i++) { const a = r() * Math.PI * 2, v = 1.2 + r() * 2.4, vz = 2 + r() * 3.2, k = se - r() * 0.05, x = c0[0] + Math.cos(a) * (R * 1.02 + v * k), y = c0[1] + Math.sin(a) * (R * 1.02 + v * k), zz = vz * k - 4.9 * k * k, rad = (0.03 + r() * 0.04); if (k < 0 || zz < -0.05) continue; drops.set([x, y, zz, rad], nd * 4); nd++; } }
    const lift = t > BT.lift ? lerp(-0.4, 2.6, ei((t - BT.lift) / (BT.whip - BT.lift))) : -9;
    const cam = cam3([[0, [0.3, -3.6, 7.6], [0, 0.25, 0]], [BT.splash, [0.2, -3.4, 6.6], [0, 0.15, 0]], [BT.whip, [-0.2, -3.0, 5.9], [0, 0.1, 0]]], t, W, H, se > 0 && se < 0.3 ? [Math.sin(se * 90) * 0.04, Math.cos(se * 70) * 0.04, 0] : null);
    return G3.render('fry3', FRY3FS(), g, W, H, P => { const S = (k, v) => G3.set(P, k, v); setCam(P, cam, t, sm(t / 0.3)); logoTex(P, 0, 'uLogo');
      S('uCoin', [c0[0], c0[1], z]); S('uCoinR', R); S('uTilt', tilt); S('uBat', cl(se / 0.8, 0, 1)); S('uHasCoin', cfg.logo !== false && t > BT.drop ? 1 : 0); S('uSpl', se > 0 ? se : -1); S('uLift', lift); S('uFury', se > 0 ? Math.exp(-se * 0.5) : 0);
      G3.setv(P, 'uDr', drops, 4); const gl = G3.ctx(); if (P.U.uND != null) gl.uniform1i(P.U.uND, nd);
    }, { scale: 1, adaptive: q3live, t, bloom: 0.55, expo: 1.1, grain: 0.03, thresh: 0.8, vig: 0.8 }); }
  function chips3D(g, t, L, cfg) { const { W, H } = L, R = 165 * REF.u / RS, hp = heap(), name = nameOf(cfg) || ' ', line = lineOf(cfg), ep = !!epOf(cfg);
    const nm = G3.textSdf(name, HEAVY, { worldW: REF.W * 0.8 / RS, maxWorldH: 140 * REF.u / RS, weight: '900', spacing: 0.02, key: 'bat' }); if (!nm) return false;
    const lk = t - BT.land, cz = lk < 0 ? lerp(4.5, 0.55, ei((lk + 0.25) / 0.25)) : 0.55, sq = 1 + spring(lk, 0.12, 22, 7);
    const wk2 = t - BT.word, sz = wk2 < 0 ? 9 : wk2 < 0.14 ? lerp(2.8, 0, ei(wk2 / 0.14)) : 0, ss = 1 + spring(wk2 - 0.14, 0.12, 26, 9);
    const lk2 = t - BT.line, bz = lk2 < 0 ? 9 : lk2 < 0.12 ? lerp(2.5, 0, ei(lk2 / 0.12)) : 0, bs = 1 + spring(lk2 - 0.12, 0.1, 28, 10), bt = line ? boardTex(line) : null;
    const vin = new Float32Array(104); let nv = 0; const vk = t - BT.vin; if (vk > 0) { const rv = rng(919); for (let i = 0; i < 26; i++) { const st = rv() * 0.3, k = vk - st, x = (rv() - 0.3) * 420 * REF.u / RS, y = 0.6 - rv() * 240 * REF.u / RS, s2 = (6 + rv() * 22) * REF.u / RS * 1.6; rv(); if (k < 0) continue; vin.set([x, y, s2 * eo(k / 0.25), 0.9], nv * 4); nv++; } }
    const pr = printLayer('bat', pg => { pg.translate(0, 0.2 * RS); episode(pg, t, REF, cfg, BASE.battered - 0.6, 'battered'); });
    const keys = [[BT.whip, [0.5, -2.4, 5.6], [0, 0.3, 0.3]], [BT.salt, [0.3, -2.9, 5.2], [0, 0.2, 0.3]], [BT.word + 0.1, [0, -4.6, 6.0], [0, -0.6, 0.2]], [BT.line + 0.7, [0, -5.2, 6.4], [0, -0.95, 0.1]]];
    if (ep) keys.push([Math.min(duration(cfg), BASE.battered + 0.4), [0, -5.7, 6.3], [0, -1.5, 0]]);
    const cam = cam3(keys, t, W, H, wk2 > 0.14 && wk2 < 0.4 ? [0, Math.sin(wk2 * 70) * 0.03 * (1 - (wk2 - 0.14) / 0.26), 0] : null);
    const ok = G3.render('chip3', CHIP3FS(), g, W, H, P => { const S = (k, v) => G3.set(P, k, v); setCam(P, cam, t, 1); logoTex(P, 0, 'uLogo');
      G3.tex(1, G3.imageTex('chippaper', chipPaperOf(REF.W, REF.H, REF.u)), P, 'uPaper'); G3.tex(2, G3.floatTex('heaph', hp.hm, HEAP.w, HEAP.h), P, 'uHeap'); G3.tex(3, G3.imageTex('heapc', hp.c), P, 'uHeapC'); S('uHeapR', [HEAP.x0, HEAP.x1, HEAP.y0, HEAP.y1]);
      G3.tex(4, nm.tex, P, 'uName'); G3.tex(5, bt ? G3.imageTex('board', bt.c, true) : nm.tex, P, 'uBoard'); G3.tex(6, G3.imageTex('batprint', pr, true), P, 'uPrint');
      S('uCoin', [0, 0.2, cz]); S('uCoinR', R); S('uSq', sq); S('uHasCoin', cfg.logo !== false && lk > -0.25 ? 1 : 0);
      S('uNameBox', nm.box); S('uSign', [0, -1.32 + 0.3 * nm.capH / 0.72, sz]); S('uSignS', ss); S('uSignA', -0.035); S('uHasSign', wk2 > 0 ? 1 : 0);
      const bw = 0.5 + (line ? Math.min(3.4, line.length * 0.13) : 1); S('uBoardC', [0.3, -1.8, bz + 0.035]); S('uBoardH', [bw / 2 + 0.15, (bw / 2 + 0.15) / 6.4]); S('uBoardA', 0.02); S('uBoardS', bs); S('uHasBoard', line && lk2 > 0 ? 1 : 0);
      G3.setv(P, 'uVin', vin, 4); const gl = G3.ctx(); if (P.U.uNV != null) gl.uniform1i(P.U.uNV, nv);
    }, { scale: 1, adaptive: q3live, t, bloom: 0.35, expo: 1.05, grain: 0.03, thresh: 0.9, vig: 0.75 });
    if (!ok) return false;
    // salt falling through the light, and steam off the top
    const C = G3.camera(cam.e, cam.a, cam.fov, W, H), sk = t - BT.salt; g.save();
    if (sk > 0) { const rs = rng(808); g.fillStyle = '#fff'; for (let i = 0; i < 300; i++) { const st = rs() * 0.45, k = sk - st, x = (rs() - 0.5) * 3.9, y = 0.2 + (rs() - 0.5) * 2.2, zl = 0.35 + rs() * 0.3; if (k < 0) continue; const zz = Math.max(zl, 3.2 - 12 * k * k); if (zz <= zl && k > 0.8) continue; const p = C.project([x, y, zz]); if (!p) continue; const s2 = Math.max(1, 0.022 * H / 2 / p[2] * 2); g.globalAlpha = zz <= zl ? 0.75 : 0.95; g.fillRect(p[0], p[1], s2, s2 * (zz > zl ? 2.4 : 1)); } }
    g.globalAlpha = 1; g.globalCompositeOperation = 'screen'; const r2 = rng(6); for (let i = 0; i < 7; i++) { const zz = 0.7 + ((t * (0.35 + r2() * 0.3) + r2() * 2) % 2.2), p = C.project([(r2() - 0.5) * 1.6, 0.2 + (r2() - 0.5) * 0.8, zz]); if (!p) continue; const R2 = (0.45 + zz * 0.25) * H / 2 / p[2], a = 0.13 * Math.sin(Math.PI * Math.min(1, (zz - 0.7) / 2.2)); const sg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], R2); sg.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(p[0] - R2, p[1] - R2, R2 * 2, R2 * 2); }
    g.restore(); return true; }

  /* ---------- Epic, cut short ---------- */
  const TENT3 = `uniform vec4 uTP[24]; uniform int uTN; uniform vec4 uSK[12]; uniform int uSN;
float tentD(vec3 p){ float d = 1e9; for (int i = 0; i < 23; i++){ if (i + 1 >= uTN) break; vec3 a = uTP[i].xyz, b = uTP[i + 1].xyz, pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); d = smin(d, length(pa - ba * h) - mix(uTP[i].w, uTP[i + 1].w, h), .03); }
  for (int i = 0; i < 12; i++){ if (i >= uSN) break; d = smin(d, length(p - uSK[i].xyz) - uSK[i].w, .02); } return d; }
float suckerAt(vec3 p){ float s = 0.; for (int i = 0; i < 12; i++){ if (i >= uSN) break; float k = length(p - uSK[i].xyz) / uSK[i].w; s = max(s, smoothstep(1.25, .9, k) * (k < .5 ? 2. : 1.)); } return s; }
vec3 tentCol(vec3 p, vec3 n, vec3 rd, vec3 L, vec3 lc, vec3 amb){ float s = suckerAt(p); vec3 a = mix(vec3(.85, .82, .78), s > 1.5 ? vec3(.35, .3, .28) : vec3(.72, .62, .6), min(s, 1.)); vec3 r = reflect(rd, n); float fr = .04 + .96 * pow(1. - max(dot(n, -rd), 0.), 5.); float wrap = max((dot(n, L) + .35) / 1.35, 0.);
  return a * (wrap * lc + amb) + lc * pow(max(dot(r, L), 0.), 50.) * .6 + fr * amb * .8 + vec3(.9, .5, .45) * pow(1. - max(dot(n, -rd), 0.), 2.) * .12; }`;
  const HEAV3FS = () => `${VS3}
uniform sampler2D uLogo, uName; uniform vec3 uMed; uniform float uMedR, uHasMed;
uniform vec4 uNameBox; uniform vec3 uNameP; uniform float uSwing, uNameS, uHasName, uGlint;
${G3.COMMON}
${TENT3}
vec3 logoAt(vec2 q, float R);
const vec3 SUNC = vec3(1., .82, .5);
vec3 sunDir(vec3 ro){ return normalize(vec3(0., 1.2, -40.) - ro); }
float medD(vec3 p){ vec3 q = p - uMed; float d = sdCapCyl(q, uMedR, .1, .03); if (d < .05 && q.z > .05){ float lum = dot(logoAt(q.xy, uMedR * .86), vec3(.3, .5, .2)); d -= .025 * smoothstep(.15, .6, lum) * step(length(q.xy), uMedR * .86); } return d; }
vec3 nameQ(vec3 p){ vec3 q = p - uNameP; q.yz = rot2(-uSwing) * q.yz; return q / uNameS; }
float nameD(vec3 p){ vec3 q = nameQ(p); float d2 = texSdf(uName, uNameBox, q.xy); return sdExtrude(d2 + .012, q.z + .09, .18, .03) * uNameS; }
float mapO(vec3 p, out float id){ float d = 1e9; id = 0.;
  if (uHasMed > .5){ d = medD(p); id = 1.; }
  if (uHasName > .5){ float dn = nameD(p); if (dn < d){ d = dn; id = 2.; } }
  if (uTN > 1){ float dt = tentD(p); if (dt < d){ d = dt; id = 3.; } }
  return d; }
float mapD(vec3 p){ float i; return mapO(p, i); }
${NRM3}
vec3 sky(vec3 rd, vec3 ro){ vec3 s = sunDir(ro); float y = rd.y, sd = max(dot(rd, s), 0.);
  vec3 c = mix(vec3(.38, .19, .05), vec3(.04, .018, .008), smoothstep(-.05, .5, y)); c = mix(c, vec3(.6, .36, .13), smoothstep(.05, -.45, y));
  c += SUNC * (pow(sd, 6.) * .35 + pow(sd, 50.) * .9 + pow(sd, 700.) * 9.);
  // cloud banks, dark bodies with gold edges where the sun is behind them
  for (int k = 2; k >= 0; k--){ float zc = -3. - float(k) * 5.; if (rd.z >= -1e-3) continue; float tt = (zc - ro.z) / rd.z; vec2 q = (ro + rd * tt).xy; float fb = fbm(q * vec2(.2, .45) + vec2(uT * .04 * float(k + 1), float(k) * 7.)); float dn = smoothstep(.5, .66, fb + .25 * smoothstep(-.3, -2.8, q.y) - .2 * smoothstep(.5, 2.5, q.y));
    float rim = smoothstep(.68, .52, fb + .25 * smoothstep(-.3, -2.8, q.y)) * dn; vec3 body = mix(vec3(.12, .06, .025), vec3(.32, .18, .07), fbm(q * 1.4)) * (.5 + .9 * pow(sd, 3.)); c = mix(c, body + SUNC * rim * (.35 + 2.2 * pow(sd, 8.)), dn * .95); }
  return c; }
float discHit(vec3 ro, vec3 rd){ if (uHasMed < .5 || rd.z > -1e-4) return 0.; float t = (uMed.z - ro.z) / rd.z; vec2 q = (ro + rd * t).xy - uMed.xy; return step(length(q), uMedR * 1.05); }
void main(){
  ${CAM3}
  float t = 0., id = 0.; bool hit = false;
  for (int i = 0; i < 110; i++){ vec3 p = ro + rd * t; float d = mapO(p, id); if (d < .0005 * t){ hit = true; break; } t += d * .9; if (t > 40.) break; }
  vec3 col; vec3 s = sunDir(ro);
  if (hit){ vec3 p = ro + rd * t, n = nrmO(p), r = reflect(rd, n); vec3 key = normalize(vec3(-.3, .6, .75)), gl = normalize(vec3(uGlint, .3, .9)); float fr = .2 + .8 * pow(1. - max(dot(n, -rd), 0.), 5.);
    if (id < 2.5){ vec3 gold = vec3(1., .72, .3); float polish = 1.; if (id < 1.5){ vec3 q = p - uMed; if (n.z > .8 && length(q.xy) < uMedR * .86){ float lum = dot(logoAt(q.xy, uMedR * .86), vec3(.3, .5, .2)); gold *= mix(.55, 1.05, smoothstep(.15, .6, lum)); polish = mix(.6, 1., lum); } }
      col = gold * (sky(r, ro) * (.7 + .5 * fr) * polish + vec3(1., .9, .7) * max(dot(n, key), 0.) * .35 + vec3(.04, .03, .02)) + vec3(1., .95, .8) * pow(max(dot(r, gl), 0.), 300.) * 14. + SUNC * pow(1. - max(dot(n, -rd), 0.), 3.) * .6; }
    else col = tentCol(p, n, rd, normalize(vec3(.4, .7, .6)), vec3(1.4, 1.15, .85), vec3(.55, .45, .32));
  } else { col = sky(rd, ro);
    // god rays from behind the medallion: walk towards the sun and count where the disc isn't in the way
    float acc = 0.; for (int k = 1; k <= 12; k++){ float f = float(k) / 12.; vec3 dd = normalize(mix(rd, s, f)); acc += (1. - discHit(ro, dd)) * (1. - f); }
    vec2 da = (rd - s).xy; float ang = atan(da.y, da.x), streak = .55 + .45 * smoothstep(.3, .7, vnoise(vec2(ang * 7. + uT * .15, 1.)));
    col += SUNC * acc / 6.5 * streak * pow(max(dot(rd, s), 0.), 5.) * (1. - discHit(ro, rd)) * .5; }
  o = vec4(max(col, 0.) * uFade, 1.); }`;
  const ROOM3FS = () => `${VS3}
uniform sampler2D uLogo, uName, uPrint; uniform vec3 uMed; uniform float uMedR, uMedA, uMedS, uHasMed;
uniform vec4 uNameBox; uniform vec3 uNameP; uniform float uNameA, uNameS, uHasName;
${G3.COMMON}
${TENT3}
const vec3 BULB = vec3(.6, 3.4, 3.2);
vec3 medQ(vec3 p){ vec3 q = p - uMed; q.xy = rot2(-uMedA) * q.xy; return q / uMedS; }
float mapO(vec3 p, out float id){ float d = 1e9; id = 0.;
  if (uHasMed > .5){ d = sdCapCyl(medQ(p), uMedR, .07, .02) * uMedS; id = 1.; }
  if (uHasName > .5){ vec3 q = p - uNameP; q.xy = rot2(-uNameA) * q.xy; q /= uNameS; float dn = sdExtrude(texSdf(uName, uNameBox, q.xy), q.z, .045, .006) * uNameS; if (dn < d){ d = dn; id = 2.; } }
  if (uTN > 1){ float dt = tentD(p); if (dt < d){ d = dt; id = 3.; } }
  return d; }
float mapD(vec3 p){ float i; return mapO(p, i); }
${NRM3}
float softSh(vec3 p, vec3 l, float tm){ float r = 1., t = .015; for (int i = 0; i < 26; i++){ float d = mapD(p + l * t); r = min(r, 8. * d / t); t += clamp(d, .01, .3); if (r < .01 || t > tm || p.z + l.z * t > 1.6) break; } return clamp(r, 0., 1.); }
void main(){
  ${CAM3}
  float tw = rd.z < -1e-4 ? -ro.z / rd.z : 1e4, t = rd.z < 0. ? max(0., (1.6 - ro.z) / rd.z) : 0., id = 0.; bool hit = false;
  for (int i = 0; i < 100; i++){ if (t > tw) break; vec3 p = ro + rd * t; float d = mapO(p, id); if (d < .0006 * t){ hit = true; break; } t += d * .9; }
  vec3 p, n, alb; float gloss = .05; if (hit){ p = ro + rd * t; n = nrmO(p); } else { p = ro + rd * tw; p.z = 0.; n = normalize(vec3((vnoise(p.xy * 30.) - .5) * .06, (vnoise(p.xy * 30. + 5.) - .5) * .06, 1.)); }
  if (!hit){ alb = vec3(.16, .17, .2) * (.8 + .3 * fbm(p.xy * 1.6)) * (1. - .3 * smoothstep(.55, .85, fbm(p.xy * vec2(.8, .2) + 3.))); vec4 pr = texture(uPrint, refUV(p.xy)); alb = mix(alb, pow(pr.rgb, vec3(2.2)), pr.a); }
  else if (id < 1.5){ vec3 q = medQ(p); vec3 nq = n; nq.xy = rot2(-uMedA) * nq.xy; alb = nq.z > .7 && length(q.xy) < uMedR * .97 ? logoAt(q.xy, uMedR * .97) : vec3(.6, .6, .58); gloss = .35; }
  else if (id < 2.5){ alb = vec3(.86); gloss = .1; }
  vec3 Lv = BULB - p; float dl = length(Lv); vec3 L = Lv / dl; float sh = softSh(p + n * .004, L, dl); vec3 lc = vec3(1., .86, .62) * 9. / (1. + dl * dl);
  vec3 col; if (id > 2.5 && hit) col = tentCol(p, n, rd, L, lc * sh, vec3(.05, .06, .08)); else { vec3 r = reflect(rd, n); col = alb * (max(dot(n, L), 0.) * sh * lc + vec3(.025, .03, .04)) + lc * sh * pow(max(dot(r, L), 0.), 50.) * gloss; }
  o = vec4(max(col, 0.) * uFade, 1.); }`;
  // The tentacle, from the 2D path (worked out in the reference frame) as a chain of balls and its suckers
  function tentU(P, pts2, w0, zBase) { const n = pts2.length, step = Math.max(1, Math.ceil(n / 23)), TP = new Float32Array(96), SK = new Float32Array(48); let tn = 0, sn = 0; const wAt = i => (w0 * Math.max(0.06, 1 - Math.pow(i / n, 1.4) * 0.94)) / RS;
    for (let i = 0; i < n && tn < 24; i += step) { const w = toW(pts2[i]); TP.set([w[0], w[1], zBase + wAt(i) * 0.9, wAt(i)], tn * 4); tn++; }
    if ((n - 1) % step && tn < 24) { const w = toW(pts2[n - 1]); TP.set([w[0], w[1], zBase + wAt(n - 1) * 0.9, wAt(n - 1)], tn * 4); tn++; }
    for (let i = 3; i < n - 3 && sn < 12; i += Math.max(2, Math.floor(n / 13))) { const a = pts2[i - 1], b = pts2[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nn = [-dy / l, dx / l], w = wAt(i) * RS, p = [pts2[i][0] - nn[0] * w * 0.55, pts2[i][1] - nn[1] * w * 0.55], pw = toW(p); SK.set([pw[0], pw[1], zBase + wAt(i) * 0.9 + wAt(i) * 0.55, wAt(i) * 0.32], sn * 4); sn++; }
    G3.setv(P, 'uTP', TP, 4); G3.setv(P, 'uSK', SK, 4); const gl = G3.ctx(); if (P.U.uTN != null) gl.uniform1i(P.U.uTN, tn); if (P.U.uSN != null) gl.uniform1i(P.U.uSN, sn); }
  function heaven3D(g, t, L, cfg) { const { W, H } = L, { u, cx, cy } = REF, name = nameOf(cfg) || ' ';
    const nm = G3.textSdf(name, SERIF, { worldW: REF.W * 0.86 / RS, maxWorldH: 150 * REF.u / RS, weight: '900', spacing: 0.02, key: 'epic' }); if (!nm) return false;
    const rf = eo((t - EPC.rise) / 1.6), R = 160 * u * (0.7 + 0.3 * rf) / RS, my = (110 * u - lerp(REF.H * 0.3, 0, rf)) / RS * 1 + 0, wk = t - EPC.word, f = eo(wk / 1.0), rk = t - EPC.reach;
    const cam = cam3([[0, [0, -1.6, 6.2], [0, -0.6, 0]], [EPC.word, [0, -0.6, 7.4], [0, 0.0, 0]], [EPC.cut, [0.3, -0.35, 6.8], [0.05, 0.05, 0]]], t, W, H, rk > 0.2 ? [Math.sin(rk * 90) * 0.04, Math.cos(rk * 77) * 0.04, 0] : null);
    const ok = G3.render('heav3', HEAV3FS(), g, W, H, P => { const S = (k, v) => G3.set(P, k, v); setCam(P, cam, t, sm(t / 0.35)); logoTex(P, 0, 'uLogo'); G3.tex(1, nm.tex, P, 'uName');
      S('uMed', [0, my, 0]); S('uMedR', R); S('uHasMed', cfg.logo !== false ? 1 : 0);
      S('uNameBox', nm.box); S('uNameP', [0, -230 * u / RS + 0.3 * nm.capH / 0.72 - 0.25, 0.25]); S('uSwing', lerp(1.35, 0, f)); S('uNameS', lerp(1.5, 1, f)); S('uHasName', wk > 0 ? 1 : 0); S('uGlint', lerp(-1.2, 1.2, ((wk - 0.6) % 1.4 + 1.4) % 1.4 / 1.4));
      if (rk > 0) tentU(P, tentaclePts(REF, eio(rk / 0.25), 0.6 + rk * 2.5, [cx + 30 * u, cy - 40 * u]), 105 * u, 0.55); else { const gl = G3.ctx(); if (P.U.uTN != null) gl.uniform1i(P.U.uTN, 0); if (P.U.uSN != null) gl.uniform1i(P.U.uSN, 0); }
    }, { scale: 1, adaptive: q3live, t, bloom: 0.7, expo: 0.85, grain: 0.03, thresh: 0.9, vig: 0.85 });
    if (!ok) return false;
    // gold dust in the light, and the flare off the top of the medallion
    const C = G3.camera(cam.e, cam.a, cam.fov, W, H), rd = rng(17); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = '#fff3c4';
    for (let i = 0; i < 90; i++) { const p = C.project([(rd() - 0.5) * 9, ((rd() * 6 + t * (0.15 + rd() * 0.3)) % 6) - 3, (rd() - 0.3) * 3]); if (!p) continue; g.globalAlpha = 0.2 + 0.5 * rd(); g.beginPath(); g.arc(p[0], p[1], Math.max(0.6, 0.012 * H / 2 / p[2] * 2), 0, Math.PI * 2); g.fill(); }
    g.restore(); const fp = C.project([0.15, my + R * 0.75, 0.15]); if (fp) flare(g, fp[0], fp[1], L, 0.5 + 0.5 * sm((t - 1.0) / 1.2)); return true; }
  function room3D(g, t, L, cfg) { const { W, H } = L, { u, cx, cy, W: W0 } = REF, name = nameOf(cfg) || ' ';
    const nm = G3.textSdf(name, HEAVY, { worldW: W0 * 0.82 / RS, maxWorldH: 112 * u / RS, weight: '900', spacing: 0, key: 'room' }); if (!nm) return false;
    const sk = t - EPC.slap, inF = sk < 0 ? eio((sk + 0.25) / 0.25) : 1, mx = lerp((REF.W + 200 * u - cx) / RS, -10 * u / RS, inF), my = 120 * u / RS, ms = 1 + spring(sk, 0.08, 30, 9), away = sk > 0.12 ? eio((sk - 0.12) / 0.35) : 0;
    const wk = t - EPC.wslap, ns = wk > 0 ? 1 + spring(wk, 0.18, 30, 10) : 1;
    const pr = printLayer('room', pg => { const line = lineOf(cfg), lk = t - EPC.line; if (line && lk > 0) { fitFont(pg, line, '600', COND, 40 * u, W0 * 0.7); pg.textBaseline = 'alphabetic'; pg.fillStyle = 'rgba(220,226,236,' + sm(lk / 0.25).toFixed(3) + ')'; spaced(pg, line, cx - 6 * u, cy + 255 * u, 4 * u, 'center'); } episode(pg, t, REF, cfg, BASE.epic - 0.6, 'epic'); });
    const cam = cam3([[EPC.cut, [0, -0.2, 7.2], [0, -0.1, 0]], [duration(cfg), [0, -0.35, 6.9], [0, -0.2, 0]]], t, W, H);
    return G3.render('room3', ROOM3FS(), g, W, H, P => { const S = (k, v) => G3.set(P, k, v); setCam(P, cam, t, 1); logoTex(P, 0, 'uLogo'); G3.tex(1, nm.tex, P, 'uName'); G3.tex(2, G3.imageTex('roomprint', pr, true), P, 'uPrint');
      S('uMed', [mx, my, 0.07]); S('uMedR', 140 * u / RS); S('uMedA', -0.13); S('uMedS', ms); S('uHasMed', cfg.logo !== false && sk > -0.25 ? 1 : 0);
      S('uNameBox', nm.box); S('uNameP', [14 * u / RS, -170 * u / RS + 0.3 * nm.capH / 0.72, 0]); S('uNameA', 0.04); S('uNameS', ns); S('uHasName', wk > 0 ? 1 : 0);
      if (cfg.logo !== false && sk > -0.25 && away < 1) { const px = cx + mx * RS, py = cy - my * RS; tentU(P, tentaclePts(REF, 1 - away * 0.95, 0.5, [px + 40 * u + away * 300 * u, py + 30 * u]), 95 * u, 0.25); } else { const gl = G3.ctx(); if (P.U.uTN != null) gl.uniform1i(P.U.uTN, 0); if (P.U.uSN != null) gl.uniform1i(P.U.uSN, 0); }
    }, { scale: 1, adaptive: q3live, t, bloom: 0.3, expo: 1.0, grain: 0.04, thresh: 0.9, vig: 0.9 }); }
  function drawEpic3D(g, t, L, cfg) { if (!g3ok()) return false; const { W, H, cx, cy, u } = L;
    if (t < EPC.cut) return heaven3D(g, t, L, cfg);
    const ck = t - EPC.cut; if (ck >= 0.32) return room3D(g, t, L, cfg);
    // Cut. The glory switches off like an old telly.
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H); const TB = layerBuf('tv3', W, H), tg = TB.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, W, H); if (!heaven3D(tg, EPC.cut - 0.001, L, Object.assign({}, cfg, { episode: '' }))) return false;
    const sy = ck < 0.12 ? Math.max(0.006, 1 - eo(ck / 0.12)) : 0.006, sx = ck < 0.12 ? 1 : Math.max(0.004, 1 - eo((ck - 0.12) / 0.14)); g.save(); g.translate(cx, cy); g.scale(sx, sy); g.filter = 'brightness(' + (1 + ck * 8).toFixed(2) + ')'; g.drawImage(TB, -W / 2, -H / 2); g.restore();
    if (ck > 0.1) { const a = ck < 0.26 ? 1 : 1 - (ck - 0.26) / 0.06, R0 = 18 * u; g.save(); g.globalCompositeOperation = 'lighter'; const dg = g.createRadialGradient(cx, cy, 0, cx, cy, R0 * 3); dg.addColorStop(0, `rgba(255,255,255,${cl(a, 0, 1)})`); dg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = dg; g.fillRect(cx - R0 * 3, cy - R0 * 3, R0 * 6, R0 * 6); g.restore(); }
    return true; }
  // Run a 3D version, falling back to the flat one if WebGL2 is missing or anything goes wrong
  const warned3 = {}; function try3D(fn, k, g, t, L, cfg) { try { return fn(g, t, L, cfg); } catch (e) { if (!warned3[k]) { warned3[k] = 1; console.warn('3D ' + k, e); } return false; } }

  let q3live = false;
  function draw(g, t, cfg, look, W, H) {
    q3live = !(look && (look.exporting || (look.cutEnv && !look.preview)));
    t = cl(t, 0, duration(cfg)); const L = layout(W, H), st = styleOf(cfg), tm = Math.min(t, mainLen(cfg)) + Math.max(0, t - mainLen(cfg)) * 0;
    if (st === 'swally') { g.save(); let ok = false; try { ok = typeof IntroScenes !== 'undefined' && IntroScenes.swally(g, t, W, H, { name: nameOf(cfg), line: lineOf(cfg), episode: epOf(cfg), kicker: String(cfg.kicker || '').trim().slice(0, 40), label: typeof cfg.label === 'string' ? cfg.label : '' }); } catch (e) { console.warn('intro', e); } if (!ok) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d18'; g.fillRect(0, 0, W, H); } g.restore(); return; }
    g.save(); try { if (st === 'battered') { if (!try3D(drawBattered3D, 'battered', g, t, L, cfg)) drawBattered(g, t, L, cfg); } else if (st === 'neon') { let ok = false; try { ok = drawNeon3D(g, t, L, cfg); } catch (e) { if (!drawNeon3D.warned) { drawNeon3D.warned = 1; console.warn('3D neon', e); } } if (!ok) drawNeon(g, t, L, cfg); } else if (st === 'epic') { if (!try3D(drawEpic3D, 'epic', g, t, L, cfg)) drawEpic(g, t, L, cfg); } else { if (!try3D(drawInk3D, 'ink', g, t, L, cfg)) drawInk(g, t, L, cfg); } } finally { g.restore(); }
    void tm; void look;
  }

  /* ================= Sound ================= */
  function sound(cfg, sr = 48000) {
    const st = styleOf(cfg), D = duration(cfg), N = Math.ceil(D * sr), Lc = new Float32Array(N), Rc = new Float32Array(N), r = rng(hash(st + nameOf(cfg))), TAU = Math.PI * 2;
    const add = (t0, len, pan, fn) => { const i0 = Math.round(t0 * sr), n = Math.round(len * sr), gl = Math.cos(pan * Math.PI / 2), gr = Math.sin(pan * Math.PI / 2); for (let k = 0; k < n; k++) { const j = i0 + k; if (j < 0 || j >= N) continue; const v = fn(k / sr, k); Lc[j] += v * gl; Rc[j] += v * gr; } };
    const nz = () => r() * 2 - 1;
    const boom = (t0, f0, f1, len, amp) => add(t0, len, 0.5, x => Math.sin(TAU * (f1 * x + (f0 - f1) * (1 - Math.exp(-x * 8)) / 8)) * amp * Math.exp(-x * 3 / len * 1.4) * Math.min(1, x / 0.004));
    const swish = (t0, len, f0, f1, amp, pan) => { let a = 0, b = 0; add(t0, len, pan == null ? 0.5 : pan, x => { const p = x / len, f = f0 * Math.pow(f1 / f0, p), q = 2 * Math.sin(Math.PI * Math.min(0.45, f / sr)); a += q * (nz() - a - b * 0.25); b += q * a; return b * amp * Math.sin(Math.PI * p); }); };
    const click = (t0, f, amp, pan) => { let lp = 0; add(t0, 0.06, pan == null ? 0.5 : pan, x => { lp += 0.35 * (nz() - lp); return (Math.sin(TAU * f * x) * 0.6 + lp * 0.6) * amp * Math.exp(-x * 70) * Math.min(1, x / 0.0015); }); };
    const pad = (t0, len, freqs, amp, att) => add(t0, len, 0.5, x => { const env = Math.min(1, x / att) * Math.min(1, (len - x) / 0.6); let v = 0; freqs.forEach((f, i) => { const ph = TAU * f * x + i; v += Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.3) + 0.15 * Math.sin(3 * ph); }); return v * amp * env / freqs.length; });
    if (st === 'swally') { const S = IntroScenes.B;
      // the street: a wee bit wind; the pub: music thumping through the wall, loud while the door is open
      { let a = 0, b = 0; add(0, D, 0.5, x => { a += 0.015 * (nz() - a); b += 0.0015 * (nz() - b); return (a * 0.6 + b * 2) * 0.25 * Math.min(1, x / 0.4); }); }
      const beat = 60 / 124; for (let i = 0; i * beat < S.splash + 0.5; i++) { const t0 = i * beat, op = t0 > S.push - 0.05 && t0 < S.stop + 0.05, v = (op ? 0.55 : 0.2) * (t0 > S.splash ? 0.6 : 1); add(t0, 0.25, 0.25, x => Math.sin(TAU * (55 + 60 * Math.exp(-x * 30)) * x) * v * Math.exp(-x * 9)); if (op && i % 2) add(t0, 0.12, 0.25, x => nz() * 0.06 * Math.exp(-x * 30)); if (op) add(t0 + beat / 2, 0.3, 0.27, x => Math.sin(TAU * [220, 247, 196, 262][i % 4] * x) * 0.05 * Math.exp(-x * 6)); }
      add(S.push - 0.05, 0.3, 0.25, x => (nz() * 0.6 + Math.sin(TAU * 90 * x)) * 0.6 * Math.exp(-x * 14)); // the door bangs open
      for (let k = 0; k < 9; k++) add(S.push + 0.05 + k * 0.11, 0.08, 0.3, x => (nz() * 0.5 + Math.sin(TAU * (160 + 30 * (k % 3)) * x)) * 0.3 * Math.exp(-x * 40)); // tentacles squeaking on the step as he digs in
      swish(S.kick - 0.1, 0.12, 400, 1500, 0.3, 0.3); // the boot coming through
      add(S.kick, 0.3, 0.3, x => { const ph = TAU * (60 * x + 70 * (1 - Math.exp(-x * 20)) / 20); return Math.sin(ph) * 0.9 * Math.exp(-x * 14) + nz() * 0.4 * Math.exp(-x * 60); }); // the boot
      swish(S.fly, S.land - S.fly, 300, 2200, 0.45, 0.45);
      add(S.land, 0.5, 0.5, x => { const ph = TAU * (42 * x + 55 * (1 - Math.exp(-x * 8)) / 8); return Math.sin(ph) * 1.0 * Math.exp(-x * 8) + nz() * 0.45 * Math.exp(-x * 40); }); // face into the road
      { let a = 0; add(S.land + 0.02, S.stop - S.land, 0.55, x => { a += 0.25 * (nz() - a); const p = x / (S.stop - S.land); return (a * 0.9 + nz() * 0.25) * (1 - p) * (0.7 + 0.3 * Math.sin(TAU * 35 * x)); }); } // scraping along it
      add(S.stop, 0.25, 0.6, x => (nz() * 0.5 + Math.sin(TAU * 110 * x) * 0.6) * Math.exp(-x * 18)); // flop
      add(S.stop + 0.05, 0.4, 0.2, x => (nz() * 0.6 + Math.sin(TAU * 70 * x) * 0.8) * 0.8 * Math.exp(-x * 12)); // the door slams
      add(S.peel + 0.15, 0.3, 0.6, x => Math.sin(TAU * (180 + 500 * x) * x) * 0.18 * Math.sin(Math.PI * x / 0.3)); // boing up
      add(S.up, 0.15, 0.6, x => (nz() * 0.3 + Math.sin(TAU * 120 * x) * 0.5) * Math.exp(-x * 30));
      add(S.finger, 0.12, 0.4, x => Math.sin(TAU * 900 * x) * 0.12 * Math.exp(-x * 30));
      // the bike: freewheel ticking closer, a bell, the splash, the whoosh past
      { const L = S.splash - S.ned + 0.15; add(S.ned, L, 0.65, x => { const u = x / L, tick = Math.pow(Math.max(0, Math.sin(TAU * (12 + 14 * u) * x)), 40); return tick * Math.sin(TAU * 3200 * x) * 0.4 * u * u; }); }
      { let a = 0; add(S.splash - 0.02, 0.9, 0.6, x => { a += 0.45 * (nz() - a); return (a * 1.1 + nz() * 0.3 * Math.exp(-x * 20)) * Math.min(1, x / 0.01) * Math.exp(-x * 4.5); }); }
      for (let k = 0; k < 10; k++) add(S.splash + 0.25 + k * 0.09, 0.07, 0.4 + (k % 4) * 0.12, x => Math.sin(TAU * (900 - 2600 * x) * x) * 0.1 * Math.exp(-x * 35));
      swish(S.splash, 0.35, 400, 2500, 0.4, 0.85);
      for (let k = 0; k < 8; k++) add(S.splash + 0.5 + k * 0.17, 0.06, 0.4 + (k % 3) * 0.15, x => Math.sin(TAU * (1200 - 3000 * x) * x) * 0.06 * Math.exp(-x * 40)); // drips
      // the cap off, then glug glug glug
      add(S.lift + 0.15, 0.08, 0.6, x => (nz() * 0.5 + Math.sin(TAU * 1800 * x)) * 0.25 * Math.exp(-x * 60));
      for (let k = 0; k < 3; k++) { const t0 = S.glug + 0.08 + k * (S.down - S.glug) / 3; add(t0, 0.32, 0.55, x => { const f = 140 + 260 * Math.exp(-x * 9) + 40 * Math.sin(TAU * 22 * x); return Math.sin(TAU * f * x) * 0.5 * Math.exp(-x * 6) * Math.min(1, x / 0.01) + nz() * 0.06 * Math.exp(-x * 12); }); }
      // the belly rumbles, heave, heave, a big gulp of air, then BLEURGH and the splat on the lens
      add(S.green, 0.8, 0.5, x => Math.sin(TAU * (70 + 20 * Math.sin(TAU * 5 * x)) * x) * 0.25 * Math.sin(Math.PI * x / 0.8));
      [S.hurk1, S.hurk2].forEach((t0, i) => add(t0, 0.3, 0.5, x => { const f = 120 + 60 * Math.sin(Math.PI * x / 0.3); let v = 0; [1, 2, 3, 5].forEach(hh => { v += Math.sin(TAU * f * hh * x) / hh; }); return (v * 0.3 + nz() * 0.25) * Math.sin(Math.PI * x / 0.3) * (0.8 + i * 0.2); }));
      { let a = 0; add(S.spew - 0.01, 0.5, 0.5, x => { a += 0.3 * (nz() - a); const f = 85 + 40 * Math.sin(TAU * 11 * x); return (a * 1.3 + Math.sin(TAU * f * x) * 0.55) * Math.min(1, x / 0.015) * Math.exp(-x * 2.2); }); }
      boom(S.splat, 150, 45, 0.9, 0.9); { let a = 0; add(S.splat, 0.7, 0.5, x => { a += 0.5 * (nz() - a); return a * 0.8 * Math.exp(-x * 7); }); }
      for (let k = 0; k < 8; k++) add(S.splat + 0.3 + k * 0.17, 0.08, 0.3 + (k % 3) * 0.2, x => Math.sin(TAU * (700 - 2000 * x) * x) * 0.1 * Math.exp(-x * 30));
      // the logo lands, the name stamps, the episode, the cone whistles down and bonks
      boom(S.logo, 110, 50, 0.6, 0.7); boom(S.name, 90, 50, 0.5, 0.5); if (epOf(cfg)) add(S.ep, 0.2, 0.5, x => (nz() * 0.4 + Math.sin(TAU * 200 * x) * 0.4) * Math.exp(-x * 25));
      add(S.cone, S.bonk - S.cone, 0.55, x => { const p = x / (S.bonk - S.cone); return Math.sin(TAU * (1500 * x - 450 * x * p)) * 0.1 * Math.sin(Math.PI * p); });
      add(S.bonk, 0.45, 0.5, x => (Math.sin(TAU * 520 * x) * 0.6 + Math.sin(TAU * 790 * x) * 0.35 + Math.sin(TAU * 1310 * x) * 0.15) * Math.exp(-x * 16) + nz() * 0.35 * Math.exp(-x * 110) + Math.sin(TAU * 140 * x) * 0.4 * Math.exp(-x * 20));
    } else if (st === 'ink') {
      add(INK.drop, INK.hit - INK.drop, 0.5, x => Math.sin(TAU * (900 + 1600 * x) * x) * 0.06 * Math.sin(Math.PI * x / (INK.hit - INK.drop)));
      boom(INK.hit, 110, 38, 2.2, 0.9); swish(INK.hit, 1.1, 300, 2400, 0.35); swish(INK.hit + 0.05, 1.4, 120, 700, 0.3, 0.35);
      { let a = 0; add(INK.hit, 0.6, 0.5, x => { a += 0.35 * (nz() - a); return a * 0.6 * Math.exp(-x * 7); }); }
      pad(INK.hit + 0.2, 4.2, [73.42, 110, 146.83, 174.61], 0.16, 1.4);
      swish(INK.word - 0.05, 0.85, 1800, 5000, 0.12, 0.6); click(INK.line, 1200, 0.25);
      add(INK.bead, INK.fall - INK.bead, 0.62, x => Math.sin(TAU * (180 + 60 * x) * x) * 0.03 * Math.sin(Math.PI * x / (INK.fall - INK.bead)));
      add(INK.fall - 0.02, 0.12, 0.62, x => Math.sin(TAU * (600 + 2600 * x) * x) * 0.4 * Math.exp(-x * 30));
      add(INK.land, 0.5, 0.62, x => (nz() * 0.7 * Math.exp(-x * 25) + Math.sin(TAU * 90 * x) * 0.6 * Math.exp(-x * 14)));
    } else if (st === 'battered') {
      // The fryer: a constant sizzle with pops, roaring when the squid goes in
      { let a = 0, b = 0; add(0, BT.whip + 0.1, 0.5, x => { const roar = x > BT.splash ? 1 + 2.2 * Math.exp(-(x - BT.splash) * 1.3) : 1; a += 0.5 * (nz() - a); b = a - b * 0.6; const crackle = r() < 0.004 * roar ? nz() * 1.2 : 0; return (b * 0.06 + crackle * 0.4) * roar * Math.min(1, x / 0.2) * Math.min(1, (BT.whip + 0.1 - x) / 0.1); }); }
      swish(BT.drop, 0.3, 400, 1600, 0.25); add(BT.splash, 0.6, 0.5, x => nz() * 0.6 * Math.exp(-x * 8) + Math.sin(TAU * 140 * x) * 0.5 * Math.exp(-x * 12));
      add(BT.lift, 0.2, 0.5, x => Math.sin(TAU * 2200 * x) * 0.06 * Math.exp(-x * 20) + nz() * 0.05 * Math.exp(-x * 30));
      swish(BT.whip - 0.05, 0.32, 300, 3000, 0.5);
      add(BT.land, 0.4, 0.5, x => { return (nz() * 0.45 + Math.sin(TAU * 110 * x) * 0.8) * Math.exp(-x * 16); });
      { let a = 0; add(BT.land, 0.5, 0.45, x => { a += 0.6 * (nz() - a); return a * 0.25 * Math.exp(-x * 5); }); }
      for (let k = 0; k < 9; k++) add(BT.salt + k * 0.05, 0.05, 0.5 + (k % 2 ? 0.1 : -0.1), x => nz() * 0.18 * Math.sin(Math.PI * x / 0.05));
      add(BT.vin, 0.5, 0.55, x => { const f = Math.sin(TAU * 7 * x) > 0 ? 1 : 0.4; return nz() * 0.16 * f * Math.exp(-x * 4); });
      boom(BT.word, 140, 60, 0.6, 0.8); add(BT.word, 0.15, 0.5, x => nz() * 0.5 * Math.exp(-x * 40));
      add(BT.line, 0.3, 0.55, x => (nz() * 0.4 + Math.sin(TAU * 160 * x) * 0.5) * Math.exp(-x * 25));
      [0, 0.17].forEach(o => add(BT.line + 0.6 + o, 1.2, 0.6, x => (Math.sin(TAU * 2093 * x) + 0.5 * Math.sin(TAU * 2637 * x)) * 0.12 * Math.exp(-x * 4)));
    } else if (st === 'neon') {
      // The street at night (no rain): a low hum of traffic far off, and a siren going by in the distance
      { let a = 0, b = 0; add(0, D, 0.5, x => { a += 0.02 * (nz() - a); b += 0.002 * (nz() - b); return (a * 0.5 + b * 2) * 0.35 * Math.min(1, x / 0.5); }); }
      add(1.4, 3.6, 0.2, x => { const f = 760 + 220 * Math.sin(TAU * 0.65 * x); return Math.sin(TAU * f * x) * 0.025 * Math.sin(Math.PI * x / 3.6); });
      const hum = (t0, len, amp, pan) => add(t0, len, pan, x => (Math.sin(TAU * 100 * x) + 0.5 * Math.sin(TAU * 200 * x) + 0.3 * Math.sin(TAU * 300 * x) + 0.08 * nz()) * amp * Math.min(1, x / 0.05));
      [0, 0.05, 0.12, 0.2].forEach(o => click(NE.box + o, 2600, 0.35, 0.5)); hum(NE.box, D - NE.box, 0.025, 0.5);
      const name = nameOf(cfg); for (let i = 0; i < name.length; i++) { const on = NE.word + i * NE.step; click(on + 0.02, 3000 + i * 40, 0.3, 0.3 + 0.4 * i / Math.max(1, name.length - 1)); click(on + 0.07, 2600, 0.2, 0.3 + 0.4 * i / Math.max(1, name.length - 1)); add(on, 0.16, 0.5, x => Math.sin(TAU * 120 * x) * 0.08 * (Math.sin(x * 120) > -0.2 ? 1 : 0)); }
      hum(NE.word, D - NE.word, 0.03, 0.5);
      if (lineOf(cfg)) [0, 0.06, 0.13].forEach(o => click(NE.line + o, 3400, 0.25, 0.5));
      if (neonKey(cfg) >= 0) { boom(NE.blow, 180, 50, 0.9, 0.9); add(NE.blow, 0.12, 0.5, x => nz() * 0.9 * Math.exp(-x * 30)); add(NE.blow, 1.4, 0.55, x => (r() < 0.02 * Math.exp(-x * 2) ? nz() * 0.8 : 0)); add(NE.blow + 0.9, 0.1, 0.5, x => Math.sin(TAU * 120 * x) * 0.1); }
      if (epOf(cfg)) { const at = BASE.neon - 0.6; add(at, 0.3, 0.5, x => (nz() * 0.5 + Math.sin(TAU * 130 * x) * 0.5) * Math.exp(-x * 22)); swish(at + 0.05, 0.4, 900, 300, 0.12); }
    } else {
      // The overblown bit: a timpani roll building, a choir and brass swelling up in D major...
      { let a = 0; add(0.2, EPC.cut - 0.2, 0.5, x => { const p = x / (EPC.cut - 0.2), hit = Math.sin(TAU * 18 * x * (1 + p)) > 0.6 ? 1 : 0; a += 0.12 * (nz() - a); return (Math.sin(TAU * 62 * x) * 0.5 + a) * hit * 0.25 * (0.2 + p * 0.8); }); }
      add(0.3, EPC.cut - 0.3, 0.5, x => { const p = x / (EPC.cut - 0.3), env = Math.min(1, x / 1.2) * (0.5 + 0.5 * p); let v = 0; [146.83, 220, 293.66, 369.99, 440].forEach((f, i) => { const vib = 1 + 0.004 * Math.sin(TAU * 5.5 * x + i); for (let h = 1; h <= 7; h++) v += Math.sin(TAU * f * vib * h * x + i) / h * (h === 2 || h === 3 ? 1.3 : 1); }); return v * 0.02 * env; });
      add(0.9, EPC.cut - 0.9, 0.5, x => { let v = 0; [293.66, 369.99, 440, 587.33].forEach((f, i) => { const ph = TAU * f * x; v += Math.sin(ph) * (0.6 + 0.4 * Math.sin(TAU * 0.4 * x + i)); }); return v * 0.03 * Math.min(1, x / 1.5); });
      boom(EPC.word, 70, 35, 2.4, 0.7); swish(EPC.word - 0.1, 1.0, 200, 3000, 0.2);
      swish(EPC.reach, 0.3, 500, 2000, 0.3, 0.75); add(EPC.reach + 0.22, 0.15, 0.6, x => (nz() * 0.8 + Math.sin(TAU * 200 * x)) * 0.6 * Math.exp(-x * 30));
      // ...cut dead: the needle dragged off the record, then nothing at all
      add(EPC.cut - 0.04, 0.42, 0.5, x => { const f = 1800 * Math.exp(-x * 6) + 80; return (Math.sin(TAU * f * x * (1 + 0.3 * Math.sin(TAU * 30 * x))) * 0.3 + nz() * 0.25) * Math.exp(-x * 4); });
      for (let i = Math.round((EPC.cut + 0.38) * sr); i < Math.round(EPC.slap * sr) && i < N; i++) { Lc[i] *= 0; Rc[i] *= 0; }
      boom(EPC.slap, 160, 70, 0.4, 0.7); add(EPC.slap, 0.15, 0.5, x => nz() * 0.6 * Math.exp(-x * 45));
      add(EPC.wslap, 0.12, 0.5, x => nz() * 0.45 * Math.exp(-x * 50) + Math.sin(TAU * 120 * x) * 0.4 * Math.exp(-x * 30));
      if (lineOf(cfg)) click(EPC.line, 900, 0.15); if (epOf(cfg)) click(BASE.epic - 0.6, 700, 0.18);
    }
    if (st === 'ink' && epOf(cfg)) swish(BASE.ink - 0.6, 0.8, 2000, 5000, 0.08); if (st === 'battered' && epOf(cfg)) add(BASE.battered - 0.6, 0.2, 0.4, x => nz() * 0.3 * Math.exp(-x * 30));
    // Even out, leave room for the codec
    // Same loudness whichever style: aim at an even level, round off the peaks, then leave room for the codec
    const vol = cl(cfg.sound && cfg.sound.vol != null ? +cfg.sound.vol : 0.9, 0, 1.5); let pk = 0, ss = 0; for (let i = 0; i < N; i++) { pk = Math.max(pk, Math.abs(Lc[i]), Math.abs(Rc[i])); ss += Lc[i] * Lc[i] + Rc[i] * Rc[i]; } const rms = Math.sqrt(ss / Math.max(1, 2 * N));
    const g = pk > 0 ? Math.min(0.1 / Math.max(1e-6, rms), 1.6 / pk) : 0; let pk2 = 0; for (let i = 0; i < N; i++) { Lc[i] = Math.tanh(Lc[i] * g); Rc[i] = Math.tanh(Rc[i] * g); pk2 = Math.max(pk2, Math.abs(Lc[i]), Math.abs(Rc[i])); }
    const g2 = pk2 > 0 ? 0.6 / pk2 * vol : 0; for (let i = 0; i < N; i++) { Lc[i] *= g2; Rc[i] *= g2; }
    if (cfg.sound && cfg.sound.on === false) { Lc.fill(0); Rc.fill(0); }
    return { L: Lc, R: Rc, sr };
  }
  function wav(cfg) { const { L, R, sr } = sound(cfg), n = L.length, buf = new ArrayBuffer(44 + n * 4), dv = new DataView(buf), ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.round(cl(L[i], -1, 1) * 32767), true); dv.setInt16(46 + i * 4, Math.round(cl(R[i], -1, 1) * 32767), true); }
    return new Blob([buf], { type: 'audio/wav' }); }
  // What the sound depends on, so a clip in a video can find (or make) the right one
  const soundKey = cfg => JSON.stringify([styleOf(cfg), nameOf(cfg).length, styleOf(cfg) === 'neon' ? neonKey(cfg) : 0, !!lineOf(cfg), !!epOf(cfg), +(+cfg.hold || 0).toFixed(2), cfg.sound && cfg.sound.on === false ? 0 : 1, +(cfg.sound && cfg.sound.vol != null ? +cfg.sound.vol : 0.9).toFixed(2), 1]);
  const soundId = cfg => 'builtin-introtab-' + hash(soundKey(cfg)).toString(36);
  const making = {};
  function ensureSound(cfg) { if (typeof CutMedia === 'undefined') return Promise.resolve(null); const id = soundId(cfg); if (CutMedia.info(id)) return Promise.resolve(id);
    return making[id] || (making[id] = CutMedia.importFile(new File([wav(cfg)], 'Intro sound.wav', { type: 'audio/wav' }), null, { id, builtin: true }).then(m => { delete making[id]; return m.id; }, e => { delete making[id]; throw e; })); }
  let playing = null;
  function listen(cfg) { if (playing) { try { playing.stop(); } catch (e) { } playing = null; return false; } const { L, R, sr } = sound(cfg), ac = new (window.AudioContext || window.webkitAudioContext)(), b = ac.createBuffer(2, L.length, sr); b.copyToChannel(L, 0); b.copyToChannel(R, 1); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(); s.onended = () => { playing = null; ac.close(); }; playing = s; return true; }

  /* ================= The panel ================= */
  function form(root, cfg, changed) {
    const { H, field, txt, card, btn, grid2, sel, num } = UI; root.innerHTML = '';
    const st = styleOf(cfg); cfg.lines = cfg.lines && typeof cfg.lines === 'object' && !Array.isArray(cfg.lines) ? cfg.lines : {};
    const seg = (val, opts, fn) => H('div', { className: 'st-seg wrap' }, ...opts.map(([v, l]) => H('button', { type: 'button', className: String(v) === String(val) ? 'on' : '', textContent: l, on: { click: () => fn(v) } })));
    const redo = () => { changed(); form(root, cfg, changed); };
    // Styles as wee moving pictures to pick from
    const grid = H('div', { className: 'in-styles' }); STYLES.forEach(([k, l]) => { const cv = H('canvas', { width: 256, height: 144 }); ready().then(() => { const c2 = Object.assign({}, cfg, { style: k }); const at = { ink: 3.0, battered: 4.4, neon: 3.4, epic: 2.7 }[k]; try { draw(cv.getContext('2d'), at, c2, {}, 256, 144); } catch (e) { } });
      grid.append(H('button', { type: 'button', className: 'in-style' + (k === st ? ' on' : ''), on: { click: () => { cfg.style = k; redo(); } } }, cv, H('span', { textContent: l }))); });
    root.append(card('Style', grid, H('p', { className: 'hint', textContent: { ink: 'A drop of squid ink lands and blooms into your squid; the name soaks into the paper; one fat drip runs off the end and splats.', battered: 'Your squid goes in the fryer, comes out battered and lands on the chip paper with salt and vinegar. Name slapped on like a chippy sign.', neon: 'Night on a red sandstone tenement: your logo lights up, the name buzzes on in neon, then a letter blows in a shower of sparks.', epic: 'A massive Hollywood style opener, gold and choirs, until a tentacle reaches in, everything cuts dead and the logo gets slapped on squint.' }[st] })));
    const lineVal = cfg.lines[st] == null ? LINES[st] : cfg.lines[st];
    root.append(card('Words',
      field('Name', txt(nameOf(cfg), v => { cfg.name = v.slice(0, 24); changed(); }, 'PATTERSQUID', 'Name')),
      field('Line (for this style)', txt(lineVal, v => { cfg.lines[st] = v.slice(0, 60); changed(); }, '', 'Line'), 'Leave it empty for no line. Each style keeps its own.'),
      H('div', { className: 'btnrow' }, btn('Put the usual line back', () => { delete cfg.lines[st]; redo(); })),
      field('Episode title (optional)', txt(cfg.episode || '', v => { cfg.episode = v.slice(0, 80); changed(); }, 'e.g. The Great Buckfast Shortage', 'Episode title'), 'Adds a second and a half at the end to show it.'),
      field('Wee label above the title (optional)', txt(cfg.kicker || '', v => { cfg.kicker = v.slice(0, 40); changed(); }, 'e.g. EPISODE 12', 'Label'))));
    const opts = [];
    if (st === 'neon') { const n = nameOf(cfg); opts.push(field('Which letter blows', sel(cfg.blow == null ? 'auto' : String(cfg.blow), [['auto', 'The Q (or the last letter)'], ['none', 'None, it all stays on'], ...[...n].map((c, i) => [String(i + 1), (i + 1) + ': ' + c])].filter(o => o[1].trim().slice(-1) !== ' '), v => { cfg.blow = v === 'auto' || v === 'none' ? v : +v; changed(); }, 'Letter that blows'))); }
    if (st === 'swally') { const thumb = H('div', { className: 'hint' }); if (cfg.label) { const im = H('img', { src: cfg.label }); im.style.cssText = 'height:72px;border-radius:4px;display:block;margin:4px 0'; thumb.append(im); }
      const pick = H('input', { type: 'file', accept: 'image/*' }); pick.style.display = 'none';
      pick.addEventListener('change', () => { const f = pick.files && pick.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const sc = Math.min(1, 360 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cfg.label = c.toDataURL('image/jpeg', 0.88); redo(); }; im.src = fr.result; }; fr.readAsDataURL(f); });
      opts.push(field('Bottle label', H('div', {}, thumb, pick, H('div', { className: 'btnrow' }, btn(cfg.label ? 'Change picture' : 'Use my own picture', () => pick.click()), cfg.label ? btn('Back to the Auld Patter label', () => { cfg.label = ''; redo(); }) : '')), 'Any picture you like goes on the front of his bottle (it fills the label, cropped to fit).')); }
    opts.push(field('Your logo', seg(cfg.logo !== false ? '1' : '0', [['1', 'Shown'], ['0', 'Left out']], v => { cfg.logo = v === '1'; redo(); })),
      field('Hold at the end (seconds)', num(cl(+cfg.hold || 0, 0, 10), v => { cfg.hold = Math.round(v * 10) / 10; changed(); }, 0, 10, 0.1, 'Hold'), 'Total ' + duration(cfg).toFixed(1) + ' s.'));
    root.append(card('Options', ...opts));
    const S0 = cfg.sound = Object.assign({ on: true, vol: 0.9 }, cfg.sound && typeof cfg.sound === 'object' ? cfg.sound : {}), note = H('p', { className: 'hint' });
    root.append(card('Sound', H('p', { className: 'hint', textContent: 'Made to fit the picture exactly. In the Video tab it plays under the clip by itself; here you can listen or save it as a WAV for After Effects.' }),
      field('Sound', seg(S0.on !== false ? '1' : '0', [['1', 'On'], ['0', 'Off']], v => { S0.on = v === '1'; redo(); })),
      field('Volume', num(S0.vol, v => { S0.vol = Math.round(v * 100) / 100; changed(); }, 0, 1.5, 0.05, 'Volume')),
      H('div', { className: 'btnrow' }, btn('▶ Listen', () => { const on = listen(cfg); note.textContent = on ? 'Playing. Press Listen again to stop.' : ''; }), btn('Save the sound (WAV)', () => { const b = wav(cfg), a = H('a', { href: URL.createObjectURL(b), download: (nameOf(cfg) || 'intro') + ' intro sound.wav' }); document.body.append(a); a.click(); a.remove(); }),
        typeof Intro.exportWithSound === 'function' ? btn('Export MP4 with the sound', () => Intro.exportWithSound(cfg), 'primary') : ''), note));
  }

  // The panel is the whole scene (no separate inputs to hide), and the timeline shows the intro and its hold
  const editor = { formIsScene: true,
    tracks(cfg) { const m = mainLen(cfg), h = cl(+cfg.hold || 0, 0, 10), st = styleOf(cfg); return [{ id: 'intro', name: 'Intro', colour: '#c81d24', items: [{ id: 'body', start: 0, end: m, label: (STYLES.find(q => q[0] === st) || ['', 'Intro'])[1] + (epOf(cfg) ? ' + episode title' : ''), colour: '#8a1a20', move: false, trim: 'none' },
      { id: 'hold', start: m, end: m + Math.max(0.01, h), label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' }] }]; },
    update(cfg, id, ch) { if (id === 'hold') cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 10) / 10)); },
    scene(root, cfg, changed) { form(root, cfg, changed); } };
  return { id: 'intro', name: 'Intro', STYLES, LINES, defaults, duration, draw, form, editor, ready, sound, wav, soundId, soundKey, ensureSound, listen, styleOf, lineOf, nameOf, mainLen, exportWithSound: null };
})();

/* Studio decorations for the Scottish calendar: Halloween, Bonfire Night, St Andrew's Day, Christmas, Hogmanay, Burns
   Night, Valentine's, Easter and a Scotland match day. Everything sits on things marked in the room (the window, its sill,
   the picture frames, and in his own studio the shelves), so it works in any room picture. Like the rest of the studio it is
   a pure function of time and repeats exactly every loop. The still parts are drawn once into a sprite, darkened to sit in
   the dim room (the lamps then light them like everything else); bulbs, candles and fireworks are drawn on top as light. */
const StudioDecor = (() => {
  const THEMES = [['none', 'None'], ['auto', 'By the date'], ['halloween', 'Halloween'], ['bonfire', 'Bonfire Night'], ['standrew', 'St Andrew’s Day'], ['christmas', 'Christmas'],
    ['hogmanay', 'Hogmanay'], ['burns', 'Burns Night'], ['valentine', 'Valentine’s'], ['easter', 'Easter'], ['match', 'Scotland match day']];
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f, sm = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
  const pmod = (x, m) => ((x % m) + m) % m;
  const rng = seed => { let a = (seed * 2654435761) >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  // A wobble that repeats a whole number of times in the loop
  const cyc = (t, L, per, ph) => Math.sin(2 * Math.PI * (Math.max(1, Math.round(L / per)) * t / L + ph));
  const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))) : Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) }); return c; };

  // Easter Sunday (anonymous Gregorian algorithm)
  function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); }
  function byDate(dt) {
    const d = dt || new Date(), y = d.getFullYear(), md = (d.getMonth() + 1) * 100 + d.getDate(), E = easter(y), days = (d - E) / 864e5;
    if (days > -8 && days < 2) return 'easter';
    if (md >= 1015 && md <= 1101) return 'halloween'; if (md >= 1102 && md <= 1108) return 'bonfire'; if (md >= 1124 && md <= 1201) return 'standrew';
    if (md >= 1202 && md <= 1227) return 'christmas'; if (md >= 1228 || md <= 102) return 'hogmanay'; if (md >= 118 && md <= 126) return 'burns'; if (md >= 210 && md <= 214) return 'valentine';
    return 'none';
  }
  const themeOf = cfg => { const k = cfg && cfg.decor; if (!k || k === 'none') return null; const r = k === 'auto' ? byDate() : k; return r !== 'none' && THEMES.some(q => q[0] === r) ? r : null; };

  /* ---------- Where things go ---------- */
  // X: { Q (glass corners), v (view: iw, ih), M (marks), builtin, t, L }
  function anchors(X) {
    const { Q, v } = X, iw = v.iw, ih = v.ih, gw = Math.hypot(Q[2][0] - Q[3][0], Q[2][1] - Q[3][1]), S = gw / 606, u = iw / 1920;
    const topY = Math.max(Q[0][1], Q[1][1]) + 10 * S, sillY = Math.max(Q[2][1], Q[3][1]) + 17 * S;
    const win = [[Q[0][0] + 6 * S, topY], [Q[1][0] - 6 * S, topY]];
    const sillAt = a => [lerp(Q[3][0], Q[2][0], a), sillY];
    const frames = ((X.M && X.M.frames) || []).filter(f => f && f.p && f.p.length === 4 && f.id !== 'ftop').map(f => f.p.map(p => [p[0] * iw, p[1] * ih]));
    const shelves = X.builtin ? [[[2 * u, 127 * u], [280 * u, 129 * u]], [[2 * u, 318 * u], [276 * u, 320 * u]], [[2 * u, 511 * u], [276 * u, 512 * u]]] : [];
    return { S, u, iw, ih, win, sillAt, sillY, frames, shelves, Q };
  }
  // Points along a hanging string between a and b, sagging in the middle
  function swag(a, b, sag, n = 40) { const out = []; for (let i = 0; i <= n; i++) { const f = i / n; out.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f) + sag * 4 * f * (1 - f)]); } return out; }
  // The window string hangs in three loops
  function winSwags(A, sag) { const [a, b] = A.win, out = []; for (let k = 0; k < 3; k++) { const p0 = [lerp(a[0], b[0], k / 3), lerp(a[1], b[1], k / 3)], p1 = [lerp(a[0], b[0], (k + 1) / 3), lerp(a[1], b[1], (k + 1) / 3)]; out.push(swag(p0, p1, sag)); } return out; }
  function along(pts, n, skipEnds) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const tot = L[L.length - 1], out = [];
    for (let k = 0; k < n; k++) { const d = tot * (skipEnds ? (k + 0.5) / n : k / Math.max(1, n - 1)); let i = 1; while (i < L.length - 1 && L[i] < d) i++; const f = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); const p = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)], ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]); out.push([p[0], p[1], ang]); }
    return out; }

  /* ---------- What each theme has ---------- */
  const BULBS = { christmas: ['#ff3b3b', '#ffd23b', '#3bff6a', '#3bb4ff', '#ff6af0'], halloween: ['#ff8a1c', '#a04dff', '#ff8a1c', '#7dff3b'], standrew: ['#3b8cff', '#ffffff'], hogmanay: ['#ffe7b0'], valentine: ['#ff2e5a', '#ff8fb0'], burns: ['#ffd9a0'], easter: ['#ffe680', '#b0ffcf', '#ffc0e8'], match: ['#3b8cff', '#ffffff'], bonfire: ['#ffcf7a'] };
  const PLAN = {
    halloween: { win: 'bulbs', shelves: 'bulbs', webs: true, spider: true, sill: ['pumpkin', 'pumpkinSmall'], bats: true },
    bonfire: { win: 'bulbs', sill: ['sparklers'], fireworks: 'bonfire' },
    standrew: { win: 'saltire', shelves: 'bulbs', sill: ['thistle'] },
    christmas: { win: 'bulbs', shelves: 'bulbs', tinsel: true, sill: ['tree'], stocking: true },
    hogmanay: { win: 'letters:HAPPY HOGMANAY', shelves: 'bulbs', sill: ['coal', 'bottle', 'glass'], fireworks: 'hogmanay' },
    burns: { win: 'tartan', shelves: 'bulbs', sill: ['haggis', 'dram', 'candle'] },
    valentine: { win: 'bulbs', shelves: 'bulbs', sill: ['rose'] },
    easter: { win: 'pastel', shelves: 'bulbs', sill: ['basket', 'bunny'] },
    match: { win: 'saltire', scarf: true, sill: ['ball'] }
  };

  /* ---------- Still parts, drawn once ---------- */
  const cache = new Map();
  function sprite(theme, X) {
    const A = anchors(X), key = theme + '|' + A.iw + 'x' + A.ih + '|' + JSON.stringify(A.Q.map(p => p.map(Math.round))) + '|' + A.frames.length + '|' + (X.builtin ? 1 : 0);
    let s = cache.get(key); if (s) return s; if (cache.size > 6) cache.clear();
    const k = Math.min(1, 1920 / A.iw), c = mk(A.iw * k, A.ih * k), g = c.getContext('2d'); g.scale(k, k); g.lineCap = 'round'; g.lineJoin = 'round';
    const P = PLAN[theme], S = A.S, lights = [], flames = [], glints = [];
    // Wires and bulbs (the glow comes later)
    const bulbString = (pts, cols, step, seed) => { g.strokeStyle = '#1b1c1f'; g.lineWidth = 2.2 * S; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      const n = Math.max(3, Math.round(pathLen(pts) / (step * S))); along(pts, n, true).forEach(([x, y, a], i) => { const col = cols[i % cols.length], r = rng(seed + i)(); const bx = x + Math.sin(a + Math.PI / 2) * 6 * S, by = y + 9 * S;
        g.fillStyle = '#2a2a2a'; g.fillRect(bx - 2.2 * S, by - 6 * S, 4.4 * S, 5 * S); g.fillStyle = col; g.beginPath(); g.ellipse(bx, by + 2 * S, 3.6 * S, 5.4 * S, 0, 0, Math.PI * 2); g.fill(); lights.push({ x: bx, y: by + 2 * S, col, ph: r, r: 3.6 * S }); }); };
    // Bunting: flags along the string, each painted by kind
    const bunting = (pts, kind, seed) => { const letters = kind.startsWith('letters:') ? kind.slice(8) : null, n = letters ? letters.length : Math.max(4, Math.round(pathLen(pts) / (40 * S)));
      g.strokeStyle = '#d8d2c4'; g.lineWidth = 1.6 * S; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      along(pts, n, true).forEach(([x, y, a], i) => { if (letters && letters[i] === ' ') return; const w = (letters ? 38 : 30) * S, h = (letters ? 50 : 40) * S; g.save(); g.translate(x, y); g.rotate(a * 0.85 + (rng(seed + i)() - 0.5) * 0.12);
        g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(0, h); g.closePath(); g.save(); g.clip(); flag(g, kind, i, w, h, letters); g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1 * S; g.stroke(); g.restore(); }); };
    const winPts = theme => winSwags(A, (P.win === 'bulbs' ? 26 : 36) * S);
    if (P.win === 'bulbs') winPts().forEach((pts, j) => bulbString(pts, BULBS[theme] || ['#ffe7b0'], 26, 10 + j * 50));
    else if (P.win) { if (P.win.startsWith('letters:')) bunting(swag(A.win[0], A.win[1], 46 * S, 60), P.win, 7); else winPts().forEach((pts, j) => bunting(pts, P.win, 20 + j * 30)); }
    if (P.shelves === 'bulbs') A.shelves.forEach((sh, j) => bulbString(swag(sh[0], sh[1], 12 * A.u), BULBS[theme] || ['#ffe7b0'], 24, 200 + j * 40));
    if (P.tinsel) A.frames.forEach((f, j) => tinsel(g, f, S, 300 + j, glints));
    if (P.webs) { cobweb(g, A.Q[0][0] + 2 * S, A.Q[0][1] + 2 * S, 70 * S, 0, 1); cobweb(g, A.Q[1][0] - 2 * S, A.Q[1][1] + 2 * S, 60 * S, Math.PI / 2, 2); A.frames.slice(0, 2).forEach((f, j) => cobweb(g, f[1][0], f[1][1], 40 * S, Math.PI / 2, 3 + j)); if (X.builtin) cobweb(g, 4 * A.u, 4 * A.u, 90 * A.u, 0, 9); }
    if (P.scarf && A.frames.length) scarf(g, A.frames.reduce((b, f) => area(f) > area(b) ? f : b, A.frames[0]), S);
    if (P.stocking && X.builtin) stocking(g, 236 * A.u, 132 * A.u, A.u);
    // Things on the sill, spread along it from the middle of the window to the right
    const sill = P.sill || [], spots = sill.length === 1 ? [0.82] : sill.length === 2 ? [0.7, 0.86] : [0.64, 0.77, 0.9];
    sill.forEach((kind, i) => { const [x, y] = A.sillAt(spots[i]); onSill(g, kind, x, y, S * (kind === 'tree' ? 1.55 : 1.45), lights, flames); });
    // Darken it all to sit in the dim room: the lamps and the bulbs light it later
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(14,12,26,0.5)'; g.fillRect(0, 0, A.iw, A.ih); g.globalCompositeOperation = 'source-over';
    s = { c, k, lights, flames, glints, A }; cache.set(key, s); return s;
  }
  const area = f => Math.abs((f[1][0] - f[0][0]) * (f[3][1] - f[0][1]));
  const pathLen = pts => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };

  function flag(g, kind, i, w, h, letters) {
    if (kind === 'saltire') { g.fillStyle = '#0a5eb8'; g.fillRect(-w, 0, 2 * w, h); g.strokeStyle = '#fff'; g.lineWidth = w * 0.16; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w * 0.32, h * 0.85); g.moveTo(w / 2, 0); g.lineTo(-w * 0.32, h * 0.85); g.stroke(); return; }
    if (kind === 'tartan') { g.fillStyle = i % 3 === 1 ? '#0a5eb8' : '#a8141c'; g.fillRect(-w, 0, 2 * w, h); if (i % 3 === 1) { g.strokeStyle = '#fff'; g.lineWidth = w * 0.16; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w * 0.32, h * 0.85); g.moveTo(w / 2, 0); g.lineTo(-w * 0.32, h * 0.85); g.stroke(); return; }
      g.globalAlpha = 0.55; g.fillStyle = '#123a22'; [-0.3, 0.15].forEach(f => { g.fillRect(f * w, 0, w * 0.2, h); g.fillRect(-w, h * (0.15 + f * 0.6 + 0.2), 2 * w, h * 0.12); }); g.fillStyle = '#e8c650'; g.globalAlpha = 0.7; g.fillRect(-w * 0.02, 0, w * 0.04, h); g.fillRect(-w, h * 0.5, 2 * w, h * 0.03); g.globalAlpha = 1; return; }
    if (kind === 'pastel') { g.fillStyle = ['#ffd1e8', '#c9f2d6', '#fff1a8', '#cfe0ff', '#e8d4ff'][i % 5]; g.fillRect(-w, 0, 2 * w, h); g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-w * 0.25 + (k % 2) * w * 0.5, h * (0.15 + 0.2 * k), w * 0.07, 0, Math.PI * 2); g.fill(); } return; }
    if (letters) { g.fillStyle = i % 2 ? '#c9a13a' : '#b8bcc6'; g.fillRect(-w, 0, 2 * w, h); const sh = g.createLinearGradient(-w / 2, 0, w / 2, h); sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = sh; g.fillRect(-w, 0, 2 * w, h);
      g.fillStyle = '#1a1a22'; g.font = '800 ' + (h * 0.46).toFixed(1) + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letters[i], 0, h * 0.34); return; }
    g.fillStyle = '#888'; g.fillRect(-w, 0, 2 * w, h);
  }
  const TINSEL = [['#f2cf4a', '#b8901c', '#fff3b0'], ['#d8323a', '#8a121a', '#ff9aa0'], ['#e8ecf4', '#9aa2b4', '#ffffff'], ['#3ab864', '#14602e', '#a8f0c0']];
  function tinsel(g, f, S, seed, glints) {
    const r = rng(seed), pal = TINSEL[seed % TINSEL.length], pts = [...f, f[0]]; g.save(); g.lineCap = 'round';
    for (let e = 0; e < 4; e++) { const a = pts[e], b = pts[e + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, n = Math.round(len / (0.55 * S));
      for (let i = 0; i < n; i++) { const f2 = i / n, wav = Math.sin(f2 * len / (14 * S)) * 2.2 * S, x = lerp(a[0], b[0], f2) + nx * wav, y = lerp(a[1], b[1], f2) + ny * wav, ang = Math.atan2(ny, nx) + (r() - 0.5) * 2.6 + (r() < 0.5 ? 0 : Math.PI), l = (3 + r() * 6.5) * S;
        g.strokeStyle = pal[r() < 0.55 ? 0 : r() < 0.75 ? 1 : 2]; g.globalAlpha = 0.65 + r() * 0.35; g.lineWidth = (0.9 + r() * 0.7) * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
        if (glints && r() < 0.025) glints.push({ x: x + Math.cos(ang) * l, y: y + Math.sin(ang) * l, ph: r(), s: S }); } }
    g.restore();
  }
  function cobweb(g, x, y, R, rot, seed) {
    const r = rng(seed); g.save(); g.translate(x, y); g.rotate(rot); g.strokeStyle = 'rgba(225,228,240,0.55)'; g.lineWidth = Math.max(0.8, R / 90); const spokes = 6, ang = i => (Math.PI / 2) * i / (spokes - 1);
    for (let i = 0; i < spokes; i++) { const L = R * (0.85 + r() * 0.3); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang(i)) * L, Math.sin(ang(i)) * L); g.stroke(); }
    for (let ring = 1; ring <= 5; ring++) { const rr = R * ring / 5.4; g.beginPath(); for (let i = 0; i < spokes; i++) { const a = ang(i), x2 = Math.cos(a) * rr, y2 = Math.sin(a) * rr; if (!i) g.moveTo(x2, y2); else { const am = (ang(i - 1) + a) / 2, sag = rr * 0.86; g.quadraticCurveTo(Math.cos(am) * sag, Math.sin(am) * sag, x2, y2); } } g.stroke(); }
    g.restore();
  }
  function scarf(g, f, S) {
    // A Scotland scarf hung over the top corners of the biggest frame, ends dangling with tassels
    const a = f[0], b = f[1], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 24 * S], w = 16 * S;
    const band = (p0, p1, p2) => { g.save(); g.lineWidth = w; g.strokeStyle = '#0a4fa0'; g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); g.stroke(); g.setLineDash([w * 0.5, w * 1.5]); g.strokeStyle = '#f2f2f2'; g.lineWidth = w * 0.95; g.stroke(); g.restore(); };
    band(a, mid, b); band(a, [a[0] - 10 * S, a[1] + 60 * S], [a[0] - 6 * S, a[1] + 130 * S]); band(b, [b[0] + 10 * S, b[1] + 60 * S], [b[0] + 6 * S, b[1] + 130 * S]);
    [[a[0] - 6 * S, a[1] + 130 * S], [b[0] + 6 * S, b[1] + 130 * S]].forEach(([x, y]) => { g.strokeStyle = '#f2f2f2'; g.lineWidth = 1.5 * S; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * 2.2 * S, y); g.lineTo(x + i * 2.4 * S, y + 12 * S); g.stroke(); } });
  }
  function stocking(g, x, y, u) {
    g.save(); g.translate(x, y); g.fillStyle = '#b3161e'; g.beginPath(); g.moveTo(-12 * u, 4 * u); g.lineTo(12 * u, 4 * u); g.lineTo(12 * u, 46 * u); g.quadraticCurveTo(12 * u, 64 * u, -6 * u, 64 * u); g.lineTo(-24 * u, 64 * u); g.quadraticCurveTo(-34 * u, 54 * u, -22 * u, 46 * u); g.lineTo(-12 * u, 40 * u); g.closePath(); g.fill();
    g.fillStyle = '#f4f1ea'; g.fillRect(-14 * u, 0, 28 * u, 12 * u); g.fillStyle = '#3a2a1a'; g.fillRect(-1 * u, -6 * u, 2 * u, 7 * u); g.restore();
  }
  // Things standing on the sill: x, y is the middle of where it stands
  function onSill(g, kind, x, y, S, lights, flames) {
    g.save(); g.translate(x, y); const s = S;
    const shadow = w => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, w); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, w, w * 0.18, 0, 0, Math.PI * 2); g.fill(); };
    if (kind === 'pumpkin' || kind === 'pumpkinSmall') { const R = (kind === 'pumpkin' ? 34 : 22) * s, ph = kind === 'pumpkin' ? 0.1 : 0.6; shadow(R * 1.2);
      const body = g.createRadialGradient(-R * 0.3, -R * 1.2, R * 0.2, 0, -R * 0.8, R * 1.2); body.addColorStop(0, '#ffa53a'); body.addColorStop(0.7, '#e2701a'); body.addColorStop(1, '#8a3c0c'); g.fillStyle = body;
      [-0.55, 0.55, 0].forEach(o => { g.beginPath(); g.ellipse(o * R, -R * 0.82, R * 0.62, R * 0.82, 0, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = 'rgba(110,45,8,0.55)'; g.lineWidth = 1.4 * s; [-0.3, 0.3].forEach(o => { g.beginPath(); g.ellipse(o * R, -R * 0.82, R * 0.2, R * 0.78, 0, 0, Math.PI * 2); g.stroke(); });
      g.fillStyle = '#4a5a22'; g.beginPath(); g.moveTo(-R * 0.07, -R * 1.58); g.quadraticCurveTo(R * 0.05, -R * 2, R * 0.25, -R * 2.02); g.lineTo(R * 0.12, -R * 1.56); g.closePath(); g.fill();
      // The carved face is a light: eyes, a nose and a big toothy grin, filled by the candle inside
      const face = { kind: 'face', x, y: y - R * 0.82, R, ph, big: kind === 'pumpkin' }; g.fillStyle = '#2a1104'; faceShape(g, 0, -R * 0.82, R, face.big); g.fill(); flames.push(face);
    }
    else if (kind === 'tree') { const Hh = 150 * s, W2 = 56 * s; shadow(W2 * 0.9);
      g.fillStyle = '#6a3e22'; g.fillRect(-7 * s, -14 * s, 14 * s, 14 * s); g.fillStyle = '#7a1c1c'; g.beginPath(); g.moveTo(-18 * s, 0); g.lineTo(18 * s, 0); g.lineTo(14 * s, -18 * s); g.lineTo(-14 * s, -18 * s); g.closePath(); g.fill();
      for (let k = 0; k < 4; k++) { const yb = -18 * s - k * Hh * 0.2, wb = W2 * (1 - k * 0.2), yt = yb - Hh * 0.32; const gr = g.createLinearGradient(-wb, 0, wb, 0); gr.addColorStop(0, '#0f3d1e'); gr.addColorStop(0.5, '#1f6b34'); gr.addColorStop(1, '#0d321a'); g.fillStyle = gr; g.beginPath(); g.moveTo(-wb, yb); g.quadraticCurveTo(0, yb + 8 * s, wb, yb); g.lineTo(0, yt); g.closePath(); g.fill(); }
      // Baubles, then a traffic cone where the star should be (as on the Duke outside the Gallery of Modern Art)
      const r2 = rng(41); for (let k = 0; k < 9; k++) { const f = r2(), yy = -24 * s - f * Hh * 0.7, half = W2 * (1 - f * 0.85) * 0.75, xx = (r2() * 2 - 1) * half; g.fillStyle = ['#d22', '#e8c13a', '#2a6fe8', '#c3c'][k % 4]; g.beginPath(); g.arc(xx, yy, 4.2 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(xx - 1.3 * s, yy - 1.3 * s, 1.2 * s, 0, Math.PI * 2); g.fill(); }
      const top = -18 * s - Hh * 0.6 - Hh * 0.32 + 8 * s; cone(g, 4 * s, top, 26 * s, -0.3);
      for (let k = 0; k < 16; k++) { const f = (k + 0.5) / 16, yy = -22 * s - f * Hh * 0.78, half = W2 * (1 - f * 0.9) * 0.85, xx = Math.sin(k * 2.4) * half; lights.push({ x: x + xx, y: y + yy, col: ['#ff3b3b', '#ffd23b', '#3bff6a', '#3bb4ff'][k % 4], ph: (k * 0.37) % 1, r: 2.6 * s }); }
    }
    else if (kind === 'haggis') { shadow(48 * s); g.fillStyle = '#e8e4da'; g.beginPath(); g.ellipse(0, -4 * s, 46 * s, 10 * s, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#2a4f8a'; g.lineWidth = 2 * s; g.beginPath(); g.ellipse(0, -4 * s, 40 * s, 8 * s, 0, 0, Math.PI * 2); g.stroke();
      const hg = g.createRadialGradient(-8 * s, -26 * s, 4 * s, 0, -16 * s, 34 * s); hg.addColorStop(0, '#9a5a3a'); hg.addColorStop(1, '#4a2216'); g.fillStyle = hg; g.beginPath(); g.ellipse(0, -18 * s, 32 * s, 18 * s, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d8c8a8'; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(-30 * s, -20 * s); g.lineTo(-38 * s, -24 * s); g.moveTo(30 * s, -20 * s); g.lineTo(38 * s, -24 * s); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.2 * s; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 10 * s, -33 * s); g.quadraticCurveTo(k * 12 * s, -18 * s, k * 10 * s, -3 * s); g.stroke(); }
      // A sgian dubh stuck in it
      g.save(); g.translate(8 * s, -30 * s); g.rotate(-0.5); g.fillStyle = '#cfd4dc'; g.fillRect(-1.5 * s, 0, 3 * s, 16 * s); g.fillStyle = '#1a1a1a'; g.fillRect(-2.5 * s, -14 * s, 5 * s, 14 * s); g.fillStyle = '#c9a13a'; g.beginPath(); g.arc(0, -15 * s, 3 * s, 0, Math.PI * 2); g.fill(); g.restore(); }
    else if (kind === 'dram' || kind === 'glass') { shadow(14 * s); glassTumbler(g, s, kind === 'dram' ? 0.4 : 0.3); }
    else if (kind === 'bottle') { shadow(16 * s); const gr = g.createLinearGradient(-14 * s, 0, 14 * s, 0); gr.addColorStop(0, '#3a2208'); gr.addColorStop(0.5, '#a8621c'); gr.addColorStop(1, '#3a2208'); g.fillStyle = gr; g.beginPath(); g.moveTo(-14 * s, 0); g.lineTo(14 * s, 0); g.lineTo(14 * s, -62 * s); g.quadraticCurveTo(14 * s, -74 * s, 5 * s, -80 * s); g.lineTo(5 * s, -96 * s); g.lineTo(-5 * s, -96 * s); g.lineTo(-5 * s, -80 * s); g.quadraticCurveTo(-14 * s, -74 * s, -14 * s, -62 * s); g.closePath(); g.fill();
      g.fillStyle = '#efe6cf'; g.fillRect(-12 * s, -50 * s, 24 * s, 26 * s); g.fillStyle = '#7a1a1a'; g.fillRect(-12 * s, -50 * s, 24 * s, 4 * s); g.fillStyle = '#2a2a2a'; g.font = '700 ' + (6 * s).toFixed(1) + 'px Georgia, serif'; g.textAlign = 'center'; g.fillText('AULD', 0, -36 * s); g.fillText('PATTER', 0, -29 * s); g.fillStyle = '#1a1a1a'; g.fillRect(-5.5 * s, -102 * s, 11 * s, 8 * s); }
    else if (kind === 'coal') { shadow(16 * s); g.fillStyle = '#141416'; g.beginPath(); g.moveTo(-14 * s, 0); g.lineTo(-12 * s, -10 * s); g.lineTo(-3 * s, -16 * s); g.lineTo(9 * s, -13 * s); g.lineTo(15 * s, -4 * s); g.lineTo(12 * s, 0); g.closePath(); g.fill(); g.fillStyle = 'rgba(160,170,200,0.35)'; g.beginPath(); g.moveTo(-3 * s, -15 * s); g.lineTo(8 * s, -12 * s); g.lineTo(2 * s, -8 * s); g.closePath(); g.fill(); }
    else if (kind === 'candle') { shadow(10 * s); g.fillStyle = '#efe8d8'; g.fillRect(-6 * s, -34 * s, 12 * s, 34 * s); g.fillStyle = '#1a1a1a'; g.fillRect(-0.7 * s, -38 * s, 1.4 * s, 5 * s); flames.push({ kind: 'flame', x, y: y - 42 * s, s }); }
    else if (kind === 'thistle') { shadow(14 * s); g.fillStyle = '#5a6a7a'; g.beginPath(); g.moveTo(-10 * s, 0); g.lineTo(10 * s, 0); g.lineTo(8 * s, -26 * s); g.lineTo(-8 * s, -26 * s); g.closePath(); g.fill(); [[-14, -64, -0.3], [0, -76, 0], [14, -62, 0.3]].forEach(([dx, dy, a]) => { g.strokeStyle = '#3e6a2a'; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(0, -26 * s); g.quadraticCurveTo(dx * 0.5 * s, (dy + 20) * s, dx * s, dy * s); g.stroke();
        g.fillStyle = '#4e7a32'; g.beginPath(); g.ellipse(dx * s, (dy + 7) * s, 6 * s, 7 * s, a, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8a3ab8'; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(dx * s + k * 1.6 * s, dy * s); g.lineTo(dx * s + k * 2.6 * s, (dy - 9) * s); g.lineWidth = 1.8 * s; g.strokeStyle = '#a24ad0'; g.stroke(); } }); }
    else if (kind === 'rose') { shadow(10 * s); g.fillStyle = 'rgba(150,200,170,0.5)'; g.beginPath(); g.moveTo(-7 * s, 0); g.lineTo(7 * s, 0); g.lineTo(6 * s, -36 * s); g.lineTo(3 * s, -44 * s); g.lineTo(-3 * s, -44 * s); g.lineTo(-6 * s, -36 * s); g.closePath(); g.fill();
      g.strokeStyle = '#3e6a2a'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(0, -40 * s); g.quadraticCurveTo(4 * s, -64 * s, -2 * s, -86 * s); g.stroke(); g.fillStyle = '#4e7a32'; g.beginPath(); g.ellipse(4 * s, -62 * s, 6 * s, 2.6 * s, -0.6, 0, Math.PI * 2); g.fill();
      // One sorry petal has already fallen off
      g.fillStyle = '#b3121e'; g.beginPath(); g.arc(-2 * s, -90 * s, 7 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d82a36'; g.beginPath(); g.arc(-3 * s, -92 * s, 4 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = '#b3121e'; g.beginPath(); g.ellipse(16 * s, -2 * s, 4 * s, 2 * s, 0.3, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'basket') { shadow(34 * s); const eg = [['#f6c2d8', -18], ['#bfe8cf', -4], ['#fff0a0', 10], ['#c6d8ff', 22]]; eg.forEach(([c, dx], k) => { g.fillStyle = c; g.beginPath(); g.ellipse(dx * s, -22 * s - (k % 2) * 4 * s, 8 * s, 10.5 * s, (k - 1.5) * 0.15, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(dx * s - 6 * s, -22 * s); g.lineTo(dx * s + 6 * s, -22 * s); g.stroke(); });
      g.fillStyle = '#9a6a32'; g.beginPath(); g.moveTo(-30 * s, -18 * s); g.lineTo(30 * s, -18 * s); g.lineTo(24 * s, 0); g.lineTo(-24 * s, 0); g.closePath(); g.fill(); g.strokeStyle = '#6a4418'; g.lineWidth = 1.4 * s; for (let k = -24; k <= 24; k += 6) { g.beginPath(); g.moveTo(k * s, -18 * s); g.lineTo(k * 0.8 * s, 0); g.stroke(); } g.strokeStyle = '#9a6a32'; g.lineWidth = 3 * s; g.beginPath(); g.ellipse(0, -18 * s, 26 * s, 26 * s, 0, Math.PI, 0); g.stroke(); }
    else if (kind === 'bunny') { shadow(18 * s); const ch = g.createLinearGradient(-16 * s, 0, 16 * s, 0); ch.addColorStop(0, '#3a1e0e'); ch.addColorStop(0.5, '#7a4422'); ch.addColorStop(1, '#3a1e0e'); g.fillStyle = ch;
      g.beginPath(); g.ellipse(0, -18 * s, 15 * s, 18 * s, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(0, -42 * s, 11 * s, 11 * s, 0, 0, Math.PI * 2); g.fill();
      // Its ears have been bitten clean off: one stump, one with tooth marks
      g.beginPath(); g.ellipse(-5 * s, -55 * s, 4 * s, 6 * s, -0.15, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(2 * s, -50 * s); g.lineTo(9 * s, -50 * s); g.lineTo(9 * s, -60 * s); g.lineTo(7 * s, -58 * s); g.lineTo(5 * s, -61 * s); g.lineTo(3 * s, -58 * s); g.closePath(); g.fill();
      g.fillStyle = '#e8c13a'; g.beginPath(); g.moveTo(-11 * s, -30 * s); g.lineTo(11 * s, -30 * s); g.lineTo(0, -24 * s); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-5 * s, -22 * s, 3 * s, 8 * s, 0.2, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'sparklers') { shadow(12 * s); g.fillStyle = '#6a7a8a'; g.fillRect(-8 * s, -24 * s, 16 * s, 24 * s); [[-3, -0.3], [2, 0.05], [5, 0.35]].forEach(([dx, a], k) => { g.save(); g.translate(dx * s, -22 * s); g.rotate(a); g.strokeStyle = '#555'; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -46 * s); g.stroke(); g.restore(); if (k === 1) flames.push({ kind: 'spark', x: x + (dx + Math.sin(a) * 46) * s, y: y - 22 * s - Math.cos(a) * 46 * s, s }); }); }
    else if (kind === 'ball') { shadow(20 * s); const gr = g.createRadialGradient(-6 * s, -26 * s, 3 * s, 0, -18 * s, 20 * s); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#9aa0aa'); g.fillStyle = gr; g.beginPath(); g.arc(0, -18 * s, 18 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1a1e'; const pent = (cx, cy, r) => { g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); }; pent(0, -18 * s, 6 * s); pent(-13 * s, -24 * s, 4 * s); pent(12 * s, -26 * s, 4 * s); pent(-8 * s, -5 * s, 4 * s); pent(10 * s, -6 * s, 4 * s); }
    g.restore();
  }
  function glassTumbler(g, s, fill) { g.fillStyle = 'rgba(200,215,230,0.28)'; g.beginPath(); g.moveTo(-10 * s, 0); g.lineTo(10 * s, 0); g.lineTo(12 * s, -26 * s); g.lineTo(-12 * s, -26 * s); g.closePath(); g.fill(); g.fillStyle = '#b8701c'; g.beginPath(); g.moveTo(-10 * s, -2 * s); g.lineTo(10 * s, -2 * s); g.lineTo(10.6 * s, -26 * fill * s); g.lineTo(-10.6 * s, -26 * fill * s); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(-9 * s, -3 * s); g.lineTo(-11 * s, -24 * s); g.stroke(); }
  function cone(g, x, y, h, rot) { g.save(); g.translate(x, y); g.rotate(rot || 0); const w = h * 0.5; g.fillStyle = '#ff6a10'; g.beginPath(); g.moveTo(-w, 0); g.lineTo(w, 0); g.lineTo(w * 0.18, -h); g.lineTo(-w * 0.18, -h); g.closePath(); g.fill(); g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(-w * 0.66, -h * 0.34); g.lineTo(w * 0.66, -h * 0.34); g.lineTo(w * 0.5, -h * 0.55); g.lineTo(-w * 0.5, -h * 0.55); g.closePath(); g.fill(); g.fillStyle = '#d24a08'; g.fillRect(-w * 1.15, -h * 0.08, w * 2.3, h * 0.12); g.restore(); }
  function faceShape(g, cx, cy, R, big) {
    g.beginPath(); const eye = (sx) => { g.moveTo(cx + sx * R * 0.38, cy - R * 0.38); g.lineTo(cx + sx * R * 0.14, cy - R * 0.1); g.lineTo(cx + sx * R * 0.58, cy - R * 0.08); g.closePath(); }; eye(-1); eye(1);
    g.moveTo(cx, cy - R * 0.06); g.lineTo(cx - R * 0.08, cy + R * 0.1); g.lineTo(cx + R * 0.08, cy + R * 0.1); g.closePath();
    // The grin, with teeth
    const n = big ? 7 : 5; g.moveTo(cx - R * 0.62, cy + R * 0.2); for (let i = 1; i <= n; i++) { const f = i / n, xx = cx + lerp(-R * 0.62, R * 0.62, f), yy = cy + R * 0.2 + Math.sin(f * Math.PI) * R * 0.18; g.lineTo(xx - R * 0.62 / n, yy + (i % 2 ? R * 0.14 : 0)); g.lineTo(xx, yy); }
    for (let i = n; i >= 0; i--) { const f = i / n; g.lineTo(cx + lerp(-R * 0.62, R * 0.62, f), cy + R * 0.2 + Math.sin(f * Math.PI) * R * 0.5); } g.closePath();
  }

  /* ---------- Light: bulbs, candles, the pumpkins' faces ---------- */
  const SPR = {}; function glow(col) { if (SPR[col]) return SPR[col]; const c = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); gr.addColorStop(0.25, col.replace(/rgb\(([^)]+)\)/, 'rgba($1,0.5)')); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (SPR[col] = c); }
  const rgbOf = hex => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  function lightPass(ctx, theme, X, room) {
    const s = sprite(theme, X), { t, L } = X, S = s.A.S; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // Twinkle: each bulb breathes on its own, now and then a run of them chases along
    s.lights.forEach((b, i) => { const tw = theme === 'christmas' ? 0.55 + 0.45 * Math.max(0, cyc(t, L, 2.6, b.ph)) : theme === 'halloween' ? 0.7 + 0.3 * cyc(t, L, 1.7, b.ph) * (cyc(t, L, 7.3, b.ph * 2) > 0.85 ? -1 : 1) : 0.8 + 0.2 * cyc(t, L, 3.1, b.ph);
      const [r, g2, b2] = rgbOf(b.col), col = `rgb(${r},${g2},${b2})`; ctx.globalAlpha = cl(tw, 0, 1); const R = b.r * 6; ctx.drawImage(glow(col), b.x - R, b.y - R, R * 2, R * 2); ctx.globalAlpha = cl(tw, 0, 1) * 0.9; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 0.8, b.r * 1.2, 0, 0, Math.PI * 2); ctx.fill(); });
    s.glints.forEach(q => { const k = Math.max(0, cyc(t, L, 1.9, q.ph)); if (k < 0.6) return; const a = (k - 0.6) / 0.4, R = 5 * q.s * a; ctx.globalAlpha = a; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 0.9 * q.s; ctx.beginPath(); ctx.moveTo(q.x - R, q.y); ctx.lineTo(q.x + R, q.y); ctx.moveTo(q.x, q.y - R); ctx.lineTo(q.x, q.y + R); ctx.stroke(); ctx.globalAlpha = a * 0.5; ctx.drawImage(glow('rgb(255,250,220)'), q.x - R * 2, q.y - R * 2, R * 4, R * 4); });
    s.flames.forEach((f, i) => { const fl = 0.75 + 0.15 * cyc(t, L, 0.37, i * 0.3) + 0.1 * cyc(t, L, 0.11, i * 0.7);
      if (f.kind === 'face') { ctx.save(); ctx.globalAlpha = cl(fl, 0, 1); ctx.fillStyle = '#ffb030'; faceShape(ctx, f.x, f.y, f.R, f.big); ctx.fill(); ctx.globalAlpha = 0.5 * fl; ctx.filter = 'blur(' + (3 * S * (X.v.px || 1)).toFixed(1) + 'px)'; ctx.fill(); ctx.restore(); const R = f.R * 3.2; ctx.globalAlpha = 0.35 * fl; ctx.drawImage(glow('rgb(255,140,40)'), f.x - R, f.y - R, R * 2, R * 2); }
      else if (f.kind === 'flame') { const h = 9 * f.s * (0.9 + 0.2 * fl); ctx.globalAlpha = 1; ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 2.4 * f.s, h * 0.6, 0, 0, Math.PI * 2); ctx.fill(); const R = 40 * f.s; ctx.globalAlpha = 0.4 * fl; ctx.drawImage(glow('rgb(255,170,80)'), f.x - R, f.y - R, R * 2, R * 2); }
      else if (f.kind === 'spark') { const r0 = rng(Math.floor(pmod(t, L) * 24)); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 1 * f.s; for (let k = 0; k < 14; k++) { const a = r0() * Math.PI * 2, l = (4 + r0() * 14) * f.s; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * l, f.y + Math.sin(a) * l); ctx.stroke(); } const R = 50 * f.s; ctx.globalAlpha = 0.5; ctx.drawImage(glow('rgb(255,230,170)'), f.x - R, f.y - R, R * 2, R * 2); } });
    ctx.restore();
    // The spider on its thread, bobbing down from the top of the window
    if (PLAN[theme].spider) { const Q = s.A.Q, x = lerp(Q[0][0], Q[1][0], 0.62), top = lerp(Q[0][1], Q[1][1], 0.62) + 4 * S, drop = (60 + 26 * cyc(t, L, 6, 0.1) + 4 * cyc(t, L, 0.9, 0.3)) * S, y = top + drop;
      ctx.save(); ctx.strokeStyle = 'rgba(220,220,235,0.5)'; ctx.lineWidth = 0.8 * S; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = '#08080a'; ctx.beginPath(); ctx.ellipse(x, y + 6 * S, 5 * S, 7 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 1 * S, 3.4 * S, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#08080a'; ctx.lineWidth = 1.3 * S; for (let k = 0; k < 4; k++) [-1, 1].forEach(sd => { const wig = 0.15 * cyc(t, L, 0.5, k * 0.2); ctx.beginPath(); ctx.moveTo(x, y + (2 + k * 2.4) * S); ctx.quadraticCurveTo(x + sd * 9 * S, y + (k * 3 - 4) * S, x + sd * (12 + k) * S, y + (6 + k * 4 + wig * 10) * S); ctx.stroke(); }); ctx.restore(); }
  }
  // Coloured light the decorations throw on the room (the bulbs' wash), as a soft tint around the window
  function wash(theme) { return { christmas: [255, 120, 90, 0.08], halloween: [255, 120, 30, 0.1], valentine: [255, 60, 110, 0.08], standrew: [80, 140, 255, 0.07], match: [80, 140, 255, 0.06], hogmanay: [255, 220, 160, 0.06], burns: [255, 190, 120, 0.06], easter: [255, 230, 160, 0.05], bonfire: [255, 170, 90, 0.05] }[theme]; }

  /* ---------- Outside: fireworks and bats ---------- */
  // When the fireworks go up: a rocket rises for 0.9 s, bursts and falls away over 2.4 s
  function shows(theme, L) { const P = PLAN[theme]; if (!P.fireworks) return []; const n = Math.max(3, Math.round(L / (P.fireworks === 'hogmanay' ? 2.6 : 3.6))), r = rng(theme === 'hogmanay' ? 515 : 1105), out = [];
    for (let k = 0; k < n; k++) out.push({ st: (k + r() * 0.7) * L / n, x: 0.14 + r() * 0.72, y: 0.24 + r() * 0.2, hue: Math.floor(r() * 6), kind: r() < 0.3 ? 'willow' : r() < 0.6 ? 'ring' : 'peony', seed: k * 31 + 7, size: 0.75 + r() * 0.5 }); return out; }
  const FW = [[255, 70, 70], [255, 210, 80], [90, 255, 140], [90, 170, 255], [230, 110, 255], [255, 255, 255]];
  const fwBuf = {};
  function outsidePass(ctx, theme, X) {
    const P = PLAN[theme], { t, L, R } = X; if (!R) return; const S = R.w / 606;
    if (P.fireworks) { const outer = ctx, bw = Math.max(2, Math.round(R.w / 2)), bh = Math.max(2, Math.round(R.h / 2)); let B = fwBuf.c; if (!B || B.width !== bw || B.height !== bh) B = fwBuf.c = mk(bw, bh);
      // Drawn on their own and cut to the sky, so they burst behind the flats rather than over them
      ctx = B.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.clearRect(0, 0, bw, bh); ctx.setTransform(bw / R.w, 0, 0, bh / R.h, -R.x0 * bw / R.w, -R.y0 * bh / R.h);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      shows(theme, L).forEach(f => { for (const per of [0, L]) { const u = pmod(t - f.st, L) + (per ? 0 : 0); if (u > 3.4) continue; const bx = R.x0 + f.x * R.w, by = R.y0 + f.y * R.h, gy = R.y0 + R.h * 0.62, c = FW[f.hue];
          if (u < 0.9) { const k = sm(u / 0.9), y = lerp(gy, by, 1 - (1 - k) * (1 - k)); ctx.fillStyle = 'rgba(255,225,180,1)'; ctx.beginPath(); ctx.arc(bx, y, 2.4 * S, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,200,140,0.5)'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + Math.sin(y * 0.05) * 2 * S, y + 30 * S); ctx.stroke(); break; }
          const e = u - 0.9, fade = Math.pow(1 - cl(e / 2.5, 0, 1), 1.3), rr = rng(f.seed), n = f.kind === 'ring' ? 44 : 70, rad = 105 * S * f.size * (1 - Math.exp(-e * 2.4));
          if (e < 0.35) { const R2 = 150 * S * f.size; ctx.globalAlpha = (1 - e / 0.35) * 0.9; ctx.drawImage(glow(`rgb(${c[0]},${c[1]},${c[2]})`), bx - R2, by - R2, R2 * 2, R2 * 2); }
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rr() * 0.2, sp = f.kind === 'ring' ? 1 : 0.55 + rr() * 0.45, fall = (f.kind === 'willow' ? 26 : 12) * S * e * e, x = bx + Math.cos(a) * rad * sp, y = by + Math.sin(a) * rad * sp + fall, tw = 0.6 + 0.4 * Math.sin(e * 30 + i);
            ctx.globalAlpha = fade * tw; ctx.fillStyle = `rgb(${Math.min(255, c[0] + 60)},${Math.min(255, c[1] + 60)},${Math.min(255, c[2] + 60)})`; ctx.beginPath(); ctx.arc(x, y, 2.6 * S * (f.kind === 'willow' ? 1.15 : 1), 0, Math.PI * 2); ctx.fill(); if (e < 1.2) { ctx.globalAlpha = fade * tw * 0.5; ctx.drawImage(glow(`rgb(${c[0]},${c[1]},${c[2]})`), x - 9 * S, y - 9 * S, 18 * S, 18 * S); }
            if (f.kind === 'willow' || e < 0.8) { const x0 = bx + Math.cos(a) * rad * sp * 0.7, y0 = by + Math.sin(a) * rad * sp * 0.7 + fall * 0.6; ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke(); } }
          break; } });
      ctx.restore(); if (R.sky) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(R.sky, 0, 0, bw, bh); ctx.globalCompositeOperation = 'source-over'; }
      ctx = outer; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(B, R.x0, R.y0, R.w, R.h); ctx.restore(); }
    if (P.bats) { ctx.save(); ctx.fillStyle = '#07070c';
      for (let k = 0; k < 4; k++) { const r = rng(900 + k), st = (k + r() * 0.5) * L / 4, dur = 5 + r() * 3, u = pmod(t - st, L) / dur; if (u >= 1) continue; const dir = r() < 0.5 ? 1 : -1, x = R.x0 + R.w * (dir > 0 ? lerp(-0.05, 1.05, u) : lerp(1.05, -0.05, u)), y = R.y0 + R.h * (0.15 + r() * 0.25) + Math.sin(u * 9 + k) * R.h * 0.04, sz = (7 + r() * 5) * S, flap = cyc(t, L, 0.29, k * 0.31);
        ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-sz * 0.6, -sz * 0.9 * flap, -sz * 1.6, -sz * 0.3 * flap); ctx.quadraticCurveTo(-sz, 0, -sz * 0.4, sz * 0.25); ctx.lineTo(sz * 0.4, sz * 0.25); ctx.quadraticCurveTo(sz, 0, sz * 1.6, -sz * 0.3 * flap); ctx.quadraticCurveTo(sz * 0.6, -sz * 0.9 * flap, 0, 0); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, sz * 0.1, sz * 0.28, sz * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.restore(); }
  }
  // How brightly the fireworks light the room now (0..1) and in what colour
  function flash(theme, t, L) { if (!PLAN[theme] || !PLAN[theme].fireworks) return null; let e = 0, col = [255, 255, 255]; shows(theme, L).forEach(f => { const u = pmod(t - f.st, L) - 0.9; if (u >= 0 && u < 1.2) { const k = Math.exp(-u * 3.2) * f.size; if (k > e) { e = k; col = FW[f.hue]; } } }); return e > 0.02 ? { e: cl(e * 0.55, 0, 0.6), rgb: col } : null; }

  /* ---------- Sound: fireworks pop, whizz and crackle ---------- */
  function sounds(cfg, L) { const th = themeOf(cfg); if (!th) return []; return shows(th, L).map(f => ({ t: f.st, k: 'firework', size: f.size, kind: f.kind })); }

  return { THEMES, themeOf, byDate, easter, PLAN, sprite, outsidePass, lightPass, wash, flash, sounds,
    // Still decorations, laid over the room before the lamps light it
    roomPass(ctx, theme, X) { const s = sprite(theme, X); ctx.drawImage(s.c, 0, 0, s.c.width / s.k, s.c.height / s.k); } };
})();

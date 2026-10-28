/* Newspaper module: one or more clippings fly in and pile up, the camera punches in and key phrases get highlighted. */
const News = (() => {
  const { cl, lerp, ease, spring, fd, fl } = E;
  const SER = 'Lora, Georgia, serif', MAX = 4;
  const ART = () => ({ mast: 'The Daily Blether', date: 'Saturday 17 October 2026', headline: 'Pint in Glasgow tops £6 for first time', highlight: 'tops £6',
    standfirst: 'Drinkers face record prices as pubs blame soaring energy bills and staff costs', underline: 'record prices',
    body: 'The average price of a pint in Glasgow has passed £6 for the first time, according to new figures from the city\'s licensed trade. Publicans say rising energy bills, higher wages and supplier costs have left them little choice but to pass increases on to customers. Industry groups warn more venues could close this winter, while drinkers say a night out is fast becoming a luxury.',
    entry: 'drop', mastColour: 'Neon red' });
  const EXTRA = [
    { mast: 'Evening Clarion', date: 'Monday 19 October 2026', headline: 'Pubs warn of winter closures', highlight: 'winter closures', standfirst: 'Trade body says one in ten venues could shut before spring', underline: 'one in ten', body: 'Licensees across the west of Scotland say they are cutting opening hours and staff as costs climb. Many fear the quieter months after Christmas.', entry: 'slide-right', mastColour: 'Saltire blue' },
    { mast: 'The Herald Post', date: 'Tuesday 20 October 2026', headline: 'Drinkers switch to staying in', highlight: 'staying in', standfirst: 'Supermarket sales rise as nights out fall', underline: '', body: '', entry: 'slide-left', mastColour: 'Ink black' },
    { mast: 'Morning Bulletin', date: 'Wednesday 21 October 2026', headline: 'Ministers urged to act on pub costs', highlight: 'urged to act', standfirst: '', underline: '', body: '', entry: 'drop', mastColour: 'Grass green' }];
  function defaults() {
    return { articles: [ART()], camera: 'punch', pacing: 'read', ending: 'last', impact: 'subtle', hlColour: 'Irn-Bru orange', ulColour: 'Neon red', tape: true, hold: 2 };
  }
  // Older projects stored a single article at the top level.
  function migrate(cfg) {
    if (Array.isArray(cfg.articles) && cfg.articles.length) return;
    const a = ART(); Object.keys(a).forEach(k => { if (cfg[k] !== undefined) { a[k] = cfg[k]; delete cfg[k]; } });
    cfg.articles = [a]; if (cfg.ending === 'headline') cfg.ending = 'last'; if (!cfg.impact) cfg.impact = 'subtle'; if (!cfg.pacing) cfg.pacing = 'read';
  }
  // Splits wrapped lines and finds where a phrase falls on each line.
  function spans(ctx, lines, phrase) {
    if (!phrase) return []; const full = lines.join(' '), i0 = full.toLowerCase().indexOf(String(phrase).toLowerCase()); if (i0 < 0) return [];
    const i1 = i0 + phrase.length, out = []; let off = 0;
    lines.forEach((ln, li) => { const a = Math.max(i0, off), b = Math.min(i1, off + ln.length); if (b > a) out.push({ li, x0: ctx.measureText(ln.slice(0, a - off)).width, w: ctx.measureText(ln.slice(a - off, b - off)).width }); off += ln.length + 1; });
    return out;
  }
  // Lays out and paints one clipping into its own texture.
  function makeCard(a, tall, SC) {
    const AW = 880, P = 46, IW = AW - P * 2, mc = document.createElement('canvas').getContext('2d');
    const HL = String(a.headline || 'Headline').toUpperCase(); let hs = 128, hl;
    for (; hs > 40; hs -= 4) { mc.font = fd(hs); hl = E.wrapText(mc, HL, IW, 99); if (hl.length <= 3 && hl.every(l => mc.measureText(l).width <= IW)) break; }
    mc.font = fd(hs); const hLH = hs * 0.98, hlSpans = spans(mc, hl, a.highlight);
    mc.font = `italic 500 28px ${SER}`; const sl = a.standfirst ? E.wrapText(mc, a.standfirst, IW, 4) : [], ulSpans = spans(mc, sl, a.underline);
    mc.font = `400 18px ${SER}`; const colW = (IW - 30) / 2, bodyLines = a.body ? E.wrapText(mc, a.body, colW, 999) : [];
    const yHead = 158, yStand = yHead + hl.length * hLH + 30, yRule = yStand + (sl.length ? sl.length * 37 + 6 : -24), yBody = yRule + 34;
    const perCol = Math.min(Math.ceil(bodyLines.length / 2), tall ? 14 : 6), AH = Math.round(yBody + (bodyLines.length ? perCol * 26 + 22 : 0) + 30);
    const c = document.createElement('canvas'); c.width = Math.ceil(AW * SC); c.height = Math.ceil(AH * SC); const g = c.getContext('2d'); g.scale(SC, SC);
    g.fillStyle = '#f4eedf'; g.fillRect(0, 0, AW, AH); g.fillStyle = E.grain(g); g.globalAlpha = 0.9; g.fillRect(0, 0, AW, AH); g.globalAlpha = 1;
    const vg = g.createRadialGradient(AW / 2, AH / 2, AH * 0.3, AW / 2, AH / 2, AW * 0.7); vg.addColorStop(0, 'rgba(120,95,50,0)'); vg.addColorStop(1, 'rgba(120,95,50,0.1)'); g.fillStyle = vg; g.fillRect(0, 0, AW, AH);
    const mastCol = E.COLOURS[a.mastColour] || '#e3302c', ink = '#0d1420';
    g.font = fd(44); const mast = String(a.mast || '').toUpperCase(), mw = g.measureText(mast).width + 34;
    if (mast) { g.fillStyle = mastCol; g.fillRect(P, 40, mw, 64); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(mast, P + 17, 74); }
    g.fillStyle = ink; g.font = fl(16, 700); g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(String(a.date || '').toUpperCase(), AW - P, 74); g.textAlign = 'left';
    g.fillRect(P, 122, IW, 5); g.fillRect(P, 132, IW, 2);
    g.textBaseline = 'alphabetic'; g.font = fd(hs); hl.forEach((l, i) => g.fillText(l, P - 2, yHead + hs * 0.86 + i * hLH));
    g.font = `italic 500 28px ${SER}`; g.fillStyle = '#2a251e'; sl.forEach((l, i) => g.fillText(l, P, yStand + 26 + i * 37));
    if (bodyLines.length) { g.fillStyle = ink; g.fillRect(P, yRule, IW, 2); g.font = `400 18px ${SER}`; g.fillStyle = '#29241d';
      for (let k = 0; k < Math.min(bodyLines.length, perCol * 2); k++) { const col = Math.floor(k / perCol), row = k % perCol; g.fillText(bodyLines[k], P + col * (colW + 30), yBody + 16 + row * 26); }
      g.fillStyle = 'rgba(13,20,32,0.2)'; g.fillRect(P + colW + 14, yBody, 1.5, perCol * 26); }
    return { AW, AH, P, IW, card: c, hl, hs, hLH, hlSpans, sl, ulSpans, yHead, yStand, entry: a.entry || 'drop', hlColour: a.hlColour, ulColour: a.ulColour };
  }
  const LAND = { drop: 0.7, 'slide-left': 0.65, 'slide-right': 0.65, 'slide-up': 0.65, zoom: 0.6, spin: 1.0 };
  let ck = '', cp = null;
  function plan(cfg, look, W, H) {
    migrate(cfg);
    const key = JSON.stringify(cfg) + look.format + (E.fontVersion || 0); if (key === ck) return cp;
    const u = Math.min(W, H) / 1080, tall = H > W, SC = Math.max(2, Math.min(4, 3.2 * u));
    const arts = cfg.articles.slice(0, MAX), N = arts.length, cards = arts.map(a => makeCard(a, tall, SC));
    // Collage layout in card units: each new clipping lands a little across from the last, overlapping it.
    const AW = 880, AHm = Math.max(...cards.map(c => c.AH)), ROT = [-2.2, 2.6, -1.4, 3.1], m = (N - 1) / 2;
    let top = 0;
    cards.forEach((c, i) => {
      const k = i - m, alt = i % 2 ? 1 : -1; c.rot = N === 1 ? -2.2 : ROT[i];
      if (N === 1) { c.lx = 0; c.ly = 0; }
      else if (tall) { c.lx = alt * AW * 0.05; c.ly = top + c.AH / 2; top += Math.min(c.AH * 0.62, 520); }
      else { c.lx = k * AW * 0.36; c.ly = -AHm / 2 + c.AH / 2 + alt * 34 + i * 30; }
    });
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    cards.forEach(c => { const r = Math.abs(c.rot) * Math.PI / 180, hw = (c.AW * Math.cos(r) + c.AH * Math.sin(r)) / 2, hh = (c.AH * Math.cos(r) + c.AW * Math.sin(r)) / 2; x0 = Math.min(x0, c.lx - hw); x1 = Math.max(x1, c.lx + hw); y0 = Math.min(y0, c.ly - hh); y1 = Math.max(y1, c.ly + hh); });
    const fit = Math.min(W * 0.88 / (x1 - x0), H * (tall ? 0.84 : 0.8) / (y1 - y0)), CX = W / 2 - (x0 + x1) / 2 * fit, CY = (tall ? H * 0.5 : H * 0.53) - (y0 + y1) / 2 * fit;
    cards.forEach((c, i) => { const a = arts[i]; c.i = i; c.f = fit * Math.max(0.3, Math.min(3, +a.s || 1)); c.x = CX + c.lx * fit + (+a.dx || 0); c.y = CY + c.ly * fit + (+a.dy || 0); });
    const L2W = (c, lx, ly) => { const r = c.rot * Math.PI / 180, dx = (lx - c.AW / 2) * c.f, dy = (ly - c.AH / 2) * c.f; return [c.x + dx * Math.cos(r) - dy * Math.sin(r), c.y + dx * Math.sin(r) + dy * Math.cos(r)]; };
    const zoomHead = c => Math.max(1, Math.min(W * 0.9 / (c.IW * c.f), H * 0.62 / (c.hl.length * c.hLH * c.f)));
    const headShot = c => { const p = L2W(c, c.AW / 2 - 20, c.yHead + c.hl.length * c.hLH * 0.5); return [p[0], p[1], zoomHead(c) * 0.95]; };
    const standShot = c => { const p = L2W(c, c.AW / 2, c.yStand + c.sl.length * 18); return [p[0], p[1], Math.max(1, Math.min(W * 0.9 / (c.IW * c.f), 2.4)) * 0.9]; };
    const bothShot = c => { if (!c.ulSpans.length) { const h = headShot(c); return [h[0], h[1], h[2] * 0.92]; } const p = L2W(c, c.AW / 2 - 10, (c.yHead + c.yStand + c.sl.length * 37) / 2); return [p[0], p[1], Math.max(1, Math.min(W * 0.9 / (c.IW * c.f), H * 0.8 / ((c.yStand + c.sl.length * 37 - c.yHead) * c.f)))]; };
    const wide = [W / 2, H / 2, 1], punch = cfg.camera === 'punch', keys = [[0, ...wide]];
    const key2 = (t, s) => { if (t > keys[keys.length - 1][0] + 0.05) keys.push([t, ...s]); };
    let t = 0.25; const atOf = (i, tt) => { const v = arts[i].at; return v !== undefined && v !== '' && v !== null && isFinite(+v) ? Math.max(0, +v) : tt; };
    if (cfg.pacing === 'pile') {
      // All clippings land in quick succession, then the marks go on together.
      cards.forEach((c, i) => { t = atOf(i, t); c.T = { entry: t }; c.T.land = t + (LAND[c.entry] || 0.65); t += 0.55; });
      const last = cards[N - 1], marks = last.T.land + 0.9;
      cards.forEach(c => { c.T.hl = marks; c.T.ul = marks + 0.95; c.done = null; });
      key2(last.T.land + 0.4, wide);
      if (punch) { key2(marks - 0.15, headShot(last)); if (last.ulSpans.length) key2(last.T.ul - 0.15, standShot(last)); }
      t = (last.ulSpans.length || cards.some(c => c.ulSpans.length) ? marks + 0.95 + 0.65 : marks + 0.75) + 0.5;
    } else {
      // Each clipping lands, gets read, then the camera pulls back for the next one.
      cards.forEach((c, i) => {
        t = atOf(i, t); c.T = { entry: t }; c.T.land = t + (LAND[c.entry] || 0.65);
        c.T.hl = c.T.land + (punch ? 1.4 : 0.8); c.T.ul = c.T.hl + 0.75 + 0.45;
        const done = (c.ulSpans.length ? c.T.ul + 0.65 : c.T.hl + 0.75) + 0.4 + Math.max(0, +arts[i].read || 0); c.done = done;
        key2(c.T.land + 0.45, wide);
        if (punch) { key2(c.T.hl - 0.15, headShot(c)); if (c.ulSpans.length) key2(c.T.ul - 0.15, standShot(c)); }
        if (i < N - 1) { key2(done + 0.15, punch ? bothShot(c) : wide); t = done + (punch ? 0.35 : 0.1); }
        else t = done;
      });
    }
    const lastC = cards[N - 1];
    if (punch) key2(t + 1.3, cfg.ending === 'whole' ? wide : bothShot(lastC)); else key2(t + 1.3, [W / 2, H / 2, 1.06]);
    const end = t + 1.3 + (+cfg.hold || 0) + 0.3, lk = keys[keys.length - 1]; keys.push([end + 1, lk[1], lk[2], lk[3] * 1.03]);
    cp = { u, tall, cards, keys, fit, dur: end, holdStart: t + 1.3 };
    ck = key; return cp;
  }
  const duration = (cfg, look) => { const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; };
  function camAt(p, t) { const k = p.keys; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const a = k[i - 1], b = k[i], q = (i >= k.length - 1 ? ease.sine : ease.io4)((t - a[0]) / Math.max(0.01, b[0] - a[0])); const z = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), q)); return [lerp(a[1], b[1], q), lerp(a[2], b[2], q), z]; } const l = k[k.length - 1]; return [l[1], l[2], l[3]]; }
  // Soft landing shake: one smooth decaying wobble rather than a jitter.
  function softShake(t, t0, amp) { const d = t - t0; if (d < 0 || d > 0.7) return [0, 0]; const a = Math.exp(-d * 7) * amp * Math.sin(Math.min(1, d / 0.04) * Math.PI / 2); return [Math.sin(d * 34) * a, Math.sin(d * 27 + 1.3) * a * 0.6]; }
  // Smooth impact lines: tapered wedges that ease outwards from the card edges and fade.
  function impactLines(ctx, c, s, p, C, u) {
    if (p <= 0 || p >= 1) return; const n = 18, hw = c.AW * s / 2, hh = c.AH * s / 2, r = c.rot * Math.PI / 180, L = Math.min(hw, hh) * 0.55;
    const head = ease.out3(p), tail = ease.out3(cl((p - 0.18) / 0.82, 0, 1)), alpha = 1 - ease.sine(cl((p - 0.45) / 0.55, 0, 1));
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(r); ctx.fillStyle = C.ink; ctx.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + 0.17, dx = Math.cos(a), dy = Math.sin(a), k = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh), gap = 14 * u + (i % 2) * 10 * u;
      const ex = dx * k, ey = dy * k, len = L * (i % 3 ? 0.8 : 1.1), d0 = gap + tail * len, d1 = gap + head * len; if (d1 - d0 < 0.5) continue;
      const w = (7 * u) * (1 - p * 0.6), nx = -dy, ny = dx;
      ctx.beginPath(); ctx.moveTo(ex + dx * d0, ey + dy * d0); ctx.lineTo(ex + dx * d1 + nx * w, ey + dy * d1 + ny * w); ctx.arc(ex + dx * d1, ey + dy * d1, w, a + Math.PI / 2, a - Math.PI / 2, true); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawCard(ctx, t, c, p, C, cfg, look, W, H) {
    const T = c.T, s = c.f, e = t - T.entry; if (e < 0) return;
    const li = t - T.land; let ox = 0, oy = 0, rot = c.rot * Math.PI / 180, sc = 1, alpha = 1;
    switch (c.entry) {
      case 'slide-left': case 'slide-right': { const dir = c.entry === 'slide-left' ? -1 : 1, q = spring(e * 1.4, 6.5, 7); ox = dir * (1 - q) * W * 1.1; rot += dir * (1 - q) * 0.22; break; }
      case 'slide-up': { const q = spring(e * 1.4, 6.5, 7); oy = (1 - q) * H * 1.1; rot += (1 - q) * 0.18; break; }
      case 'zoom': { const q = ease.out3(e / 0.6); sc = lerp(2.6, 1, q); alpha = cl(e / 0.25, 0, 1); break; }
      case 'spin': { const q = ease.out3(e / 1.0); sc = lerp(0.05, 1, q); rot += (1 - q) * Math.PI * 4; break; }
      default: { const q = spring(e * 1.15, 6.5, 7.5); oy = (1 - q) * -H * 1.15; rot += -(1 - q) * 0.2; }
    }
    // Lifted cards cast a bigger, softer shadow that settles as they land.
    const lift = cl(1 - li / 0.35, 0, 1), sh = 20 + lift * 26, sq = cfg.impact === 'burst' && li > 0 && li < 0.3 ? 1 - Math.sin(li / 0.3 * Math.PI) * 0.018 : 1;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(c.x + ox, c.y + oy); ctx.rotate(rot); ctx.scale(s * sc / sq, s * sc * sq);
    const AW = c.AW, AH = c.AH;
    ctx.fillStyle = C.shadow; ctx.fillRect(-AW / 2 + sh, -AH / 2 + sh, AW, AH); ctx.drawImage(c.card, -AW / 2, -AH / 2, AW, AH); ctx.lineWidth = 7; ctx.strokeStyle = C.ink; ctx.strokeRect(-AW / 2, -AH / 2, AW, AH);
    if (cfg.tape) [[-AW / 2 + 64, -AH / 2 - 4, -0.42], [AW / 2 - 64, -AH / 2 - 4, 0.38]].forEach(([tx, ty, tr]) => { ctx.save(); ctx.translate(tx, ty); ctx.rotate(tr); ctx.fillStyle = 'rgba(248,244,226,0.84)'; ctx.beginPath(); ctx.moveTo(-68, -20); ctx.lineTo(68, -20); for (let k = 0; k < 6; k++) ctx.lineTo(68 - (k % 2) * 5, -20 + (k + 1) * 6.7); ctx.lineTo(-68, 20); for (let k = 0; k < 6; k++) ctx.lineTo(-68 + (k % 2) * 5, 20 - (k + 1) * 6.7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(13,20,32,0.45)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); });
    ctx.translate(-AW / 2, -AH / 2);
    if (c.hlSpans.length) { const hp = ease.io4((t - T.hl) / 0.75), n = c.hlSpans.length, r = E.rng(41);
      c.hlSpans.forEach((sp, k) => { const q = cl(hp * n - k, 0, 1); if (q <= 0) return; const base = c.yHead + c.hs * 0.86 + sp.li * c.hLH, top = base - c.hs * 0.8, hh = c.hs * 0.88, x0 = c.P - 2 + sp.x0 - 10, ww = (sp.w + 20) * q;
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = E.COLOURS[cfg.hlColour] || '#f5821f'; ctx.beginPath(); ctx.moveTo(x0, top + r() * 4); for (let i = 1; i <= 12; i++) ctx.lineTo(x0 + ww * i / 12, top + (r() - 0.5) * 5); ctx.lineTo(x0 + ww + 3, top + hh * 0.5); for (let i = 12; i >= 0; i--) ctx.lineTo(x0 + ww * i / 12, top + hh + (r() - 0.5) * 5); ctx.closePath(); ctx.fill(); ctx.restore(); }); }
    if (c.ulSpans.length) { const up = ease.io4((t - T.ul) / 0.65), n = c.ulSpans.length; ctx.save(); ctx.strokeStyle = E.COLOURS[cfg.ulColour] || '#e3302c'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      c.ulSpans.forEach((sp, k) => { const q = cl(up * n - k, 0, 1); if (q <= 0) return; const y = c.yStand + 26 + sp.li * 37 + 9, x0 = c.P + sp.x0 - 6, w = sp.w + 12;
        const pass = (off, ph, amp, qq) => { ctx.beginPath(); const m = Math.floor(60 * qq); for (let i = 0; i <= m; i++) { const v = i / 60; const xx = x0 + w * v, yy = y + off + Math.sin(v * Math.PI * 5 + ph) * amp + v * 2; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); };
        pass(0, 0, 2.4, Math.min(1, q / 0.62)); if (q > 0.62) pass(9, 1.1, 2, (q - 0.62) / 0.38); }); ctx.restore(); }
    ctx.restore();
  }
  function draw(ctx, t, cfg, look, W, H) {
    const p = plan(cfg, look, W, H), C = E.palette(look), u = p.u;
    let [fx, fy, z] = look.noCam ? [W / 2, H / 2, 1] : camAt(p, t), shx = 0, shy = 0;
    if (cfg.impact !== 'none') p.cards.forEach(c => { const [a, b] = softShake(t, c.T.land, (cfg.impact === 'burst' ? 11 : 5) * u); shx += a; shy += b; });
    ctx.save(); E.camera(ctx, W, H, fx, fy, z, t, u, shx, shy); E.drawBg(ctx, C, look, W, H, (fx - W / 2) * -0.15, (fy - H / 2) * -0.15);
    p.cards.forEach(c => {
      if (cfg.impact === 'burst') impactLines(ctx, c, c.f, (t - c.T.land + 0.03) / 0.6, C, u);
      drawCard(ctx, t, c, p, C, cfg, look, W, H);
    });
    ctx.restore();
    E.fadeIn(ctx, t, W, H, C, look);
  }
  function form(root, cfg, changed) {
    migrate(cfg);
    const { H, field, sel, txt, area, card, grid2, colourOpts, btn, iconBtn } = UI; root.innerHTML = '';
    const rebuild = () => { changed(); form(root, cfg, changed); };
    const ENTRY = [['drop', 'Drops from above'], ['slide-left', 'Slides in from the left'], ['slide-right', 'Slides in from the right'], ['slide-up', 'Slides up from below'], ['zoom', 'Zooms in and lands'], ['spin', 'Spins in, old film style']];
    cfg.articles.forEach((a, i) => {
      const set = (k, v) => { a[k] = v; changed(); check(); };
      const hlMsg = H('span', { className: 'hint', style: 'color:#ff8a80' }), ulMsg = H('span', { className: 'hint', style: 'color:#ff8a80' });
      const check = () => { hlMsg.textContent = a.highlight && !String(a.headline).toLowerCase().includes(String(a.highlight).toLowerCase()) ? 'That phrase isn\'t in the headline, so nothing will be highlighted. Copy it exactly from the headline.' : ''; ulMsg.textContent = a.underline && !String(a.standfirst).toLowerCase().includes(String(a.underline).toLowerCase()) ? 'That phrase isn\'t in the standfirst. Copy it exactly from the line above.' : ''; };
      const tools = H('div', { className: 'btnrow' });
      if (i > 0) tools.append(iconBtn('↑', 'Move this article earlier', () => { cfg.articles.splice(i - 1, 0, cfg.articles.splice(i, 1)[0]); rebuild(); }));
      if (i < cfg.articles.length - 1) tools.append(iconBtn('↓', 'Move this article later', () => { cfg.articles.splice(i + 1, 0, cfg.articles.splice(i, 1)[0]); rebuild(); }));
      if (cfg.articles.length > 1) tools.append(btn('Remove', () => { cfg.articles.splice(i, 1); rebuild(); }));
      const det = H('details', {}, H('summary', {}, 'Standfirst, underline and article text'),
        H('div', { style: 'display:flex;flex-direction:column;gap:10px' },
          field('Standfirst', area(a.standfirst, v => set('standfirst', v), 'The line under the headline', 2)),
          field('Underline in the standfirst', txt(a.underline, v => set('underline', v), 'Optional')), ulMsg,
          field('Article text', area(a.body, v => set('body', v), 'Paste the article text here', 5), 'Optional. It fills two columns under the standfirst.')));
      if (i === 0 || a.standfirst || a.body) det.open = true;
      root.append(card(cfg.articles.length > 1 ? `Article ${i + 1}` : 'The article',
        grid2(field('Paper name', txt(a.mast, v => set('mast', v), 'The Daily Blether')), field('Date line', txt(a.date, v => set('date', v), 'Saturday 17 October 2026'))),
        grid2(field('Masthead colour', sel(a.mastColour, colourOpts(), v => set('mastColour', v))), field('How it comes in', sel(a.entry, ENTRY, v => set('entry', v)))),
        field('Headline', area(a.headline, v => set('headline', v), 'Pint in Glasgow tops £6 for first time', 2)),
        field('Highlight in the headline', txt(a.highlight, v => set('highlight', v), 'tops £6')), hlMsg, det, tools.children.length ? tools : ''));
      check();
    });
    if (cfg.articles.length < MAX) root.append(btn('Add another article', () => { const n = cfg.articles.length, x = Object.assign(ART(), EXTRA[(n - 1) % EXTRA.length]); cfg.articles.push(x); rebuild(); }));
    const set = (k, v) => { cfg[k] = v; changed(); };
    root.append(card('Animation',
      grid2(field('Camera', sel(cfg.camera, [['punch', 'Punch in on the key lines'], ['gentle', 'Gentle push, whole page']], v => set('camera', v))),
        field('Landing effect', sel(cfg.impact, [['none', 'None'], ['subtle', 'Soft bump'], ['burst', 'Burst lines']], v => set('impact', v)))),
      cfg.articles.length > 1 ? field('Pacing', sel(cfg.pacing, [['read', 'One at a time, each one read'], ['pile', 'Quick pile up, then read the top one']], v => set('pacing', v))) : '',
      grid2(field('Final shot', sel(cfg.ending, [['last', cfg.articles.length > 1 ? 'Close on the last headline' : 'Close on the headline'], ['whole', cfg.articles.length > 1 ? 'Pull back to all the articles' : 'Pull back to the whole page']], v => set('ending', v))), field('Tape on the corners', sel(cfg.tape ? '1' : '0', [['1', 'Yes'], ['0', 'No']], v => set('tape', v === '1')))),
      grid2(field('Highlighter colour', sel(cfg.hlColour, colourOpts(), v => set('hlColour', v))), field('Underline colour', sel(cfg.ulColour, colourOpts(), v => set('ulColour', v)))),
      field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v)))));
  }
  const ENTRIES = [['drop', 'Drops from above'], ['slide-left', 'Slides in from the left'], ['slide-right', 'Slides in from the right'], ['slide-up', 'Slides up from below'], ['zoom', 'Zooms in and lands'], ['spin', 'Spins in, old film style']];
  const r2 = v => Math.round(v * 100) / 100;
  const editor = { camera: true,
    tracks(cfg, look) { migrate(cfg); const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), cs = p.cards;
      return [{ id: 'arts', name: 'Articles', colour: '#e3302c', items: cs.map((c, k) => ({ id: 'art:' + c.i, start: c.T.entry, end: k < cs.length - 1 ? Math.max(c.T.entry + 0.5, cs[k + 1].T.entry) : Math.max(c.T.entry + 0.5, c.done || p.holdStart - 1.3), label: c.hl.join(' '), colour: E.hexMix(E.COLOURS[cfg.articles[c.i].mastColour] || '#e3302c', '#16213a', 0.4), trim: cfg.pacing === 'pile' ? 'none' : 'end', minLen: 0.8, title: 'Drag to change when it lands. Drag the right edge to stay on it for longer.' })) },
        { id: 'end', name: 'End', items: [{ id: 'hold', start: p.holdStart, end: p.holdStart + (+cfg.hold || 0), label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10 }] }]; },
    update(cfg, id, ch) {
      if (id === 'hold') { cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 2) / 2)); return; }
      const i = +id.split(':')[1], a = cfg.articles[i]; if (!a) return; const { W, H } = E.dims('16:9'), p = plan(cfg, { format: '16:9' }, W, H), c = p.cards.find(x => x.i === i);
      const moved = Math.abs(ch.start - c.T.entry) > 0.005; if (moved) { a.at = r2(ch.start); return; }
      const next = p.cards.find(x => x.i === i + 1), base = (c.done || 0) - Math.max(0, +a.read || 0), want = ch.end - (next ? (punchGap(cfg)) : 0);
      a.read = Math.max(0, r2(want - base));
    },
    view(cfg, look, t, W, H) { migrate(cfg); const p = plan(cfg, look, W, H), u = p.u; let [fx, fy, z] = look.noCam ? [W / 2, H / 2, 1] : camAt(p, t); const d = Math.min(1, t / 1.2); fx += Math.sin(t * 0.9) * 3 * u * d; fy += Math.cos(t * 0.7) * 2.5 * u * d; return { fx, fy, z }; },
    hits(cfg, look, t, W, H) { migrate(cfg); const p = plan(cfg, look, W, H), u = p.u; let [fx, fy, z] = look.noCam ? [W / 2, H / 2, 1] : camAt(p, t); const d = Math.min(1, t / 1.2); fx += Math.sin(t * 0.9) * 3 * u * d; fy += Math.cos(t * 0.7) * 2.5 * u * d;
      return p.cards.map(c => { const r = c.rot * Math.PI / 180, hw = c.AW * c.f / 2, hh = c.AH * c.f / 2, ex = Math.abs(hw * Math.cos(r)) + Math.abs(hh * Math.sin(r)), ey = Math.abs(hw * Math.sin(r)) + Math.abs(hh * Math.cos(r));
        return { id: 'art:' + c.i, box: [(c.x - ex - fx) * z + W / 2, (c.y - ey - fy) * z + H / 2, (c.x + ex - fx) * z + W / 2, (c.y + ey - fy) * z + H / 2], k: 1 / z, scale: true, ghost: t < c.T.land, label: 'Article ' + (c.i + 1) }; }); },
    grab(cfg, id) { const a = cfg.articles[+id.split(':')[1]] || {}; return { dx: +a.dx || 0, dy: +a.dy || 0, s: +a.s || 1 }; },
    move(cfg, id, s, dx, dy) { const a = cfg.articles[+id.split(':')[1]]; if (a) { a.dx = r2(s.dx + dx); a.dy = r2(s.dy + dy); } },
    resize(cfg, id, s, f) { const a = cfg.articles[+id.split(':')[1]]; if (a) a.s = Math.round(Math.max(0.3, Math.min(3, s.s * f)) * 100) / 100; },
    adds: [{ label: 'Article', title: 'Add another article', fn(cfg) { migrate(cfg); if (cfg.articles.length >= MAX) return null; const n = cfg.articles.length; cfg.articles.push(Object.assign(ART(), EXTRA[(n - 1) % EXTRA.length])); return 'art:' + n; } }],
    remove(cfg, id) { const i = +id.split(':')[1]; if (cfg.articles.length > 1) cfg.articles.splice(i, 1); },
    duplicate(cfg, id) { const i = +id.split(':')[1]; if (cfg.articles.length >= MAX) return id; const c = JSON.parse(JSON.stringify(cfg.articles[i])); delete c.at; c.dx = (+c.dx || 0) + 80; cfg.articles.splice(i + 1, 0, c); return 'art:' + (i + 1); },
    inspect(root, cfg, id, changed, done) {
      const { H, field, sel, txt, area, card, grid2, colourOpts, btn } = UI, a = cfg.articles[+id.split(':')[1]]; if (!a) return; const set = (k, v) => { a[k] = v; changed(); };
      root.append(card('Article ' + (+id.split(':')[1] + 1),
        grid2(field('Paper name', txt(a.mast, v => set('mast', v))), field('Date line', txt(a.date, v => set('date', v)))),
        grid2(field('Masthead colour', sel(a.mastColour, colourOpts(), v => set('mastColour', v))), field('How it comes in', sel(a.entry, ENTRIES, v => set('entry', v)))),
        field('Headline', area(a.headline, v => set('headline', v), '', 2)), field('Highlight in the headline', txt(a.highlight, v => set('highlight', v))),
        field('Standfirst', area(a.standfirst, v => set('standfirst', v), 'Optional', 2)), field('Underline in the standfirst', txt(a.underline, v => set('underline', v), 'Optional')),
        field('Article text', area(a.body, v => set('body', v), 'Optional', 4)),
        H('p', { className: 'hint' }, 'Drag the article on the preview to move it, pull a corner to resize. On the timeline, drag it to change when it lands.'),
        H('div', { className: 'btnrow' }, btn('Reset position, size and timing', () => { a.dx = 0; a.dy = 0; a.s = 1; delete a.at; a.read = 0; changed(); }), btn('Done', done))));
    },
    scene(root, cfg, changed) {
      const { field, sel, card, grid2, colourOpts, H } = UI, set = (k, v) => { cfg[k] = v; changed(); };
      root.append(card('Newspaper',
        grid2(field('Camera', sel(cfg.camera, [['punch', 'Punch in on the key lines'], ['gentle', 'Gentle push']], v => set('camera', v))), field('Landing effect', sel(cfg.impact, [['none', 'None'], ['subtle', 'Soft bump'], ['burst', 'Burst lines']], v => set('impact', v)))),
        grid2(field('Pacing', sel(cfg.pacing, [['read', 'One at a time'], ['pile', 'Quick pile up']], v => set('pacing', v))), field('Final shot', sel(cfg.ending, [['last', 'Close on the last headline'], ['whole', 'Pull back to all']], v => set('ending', v)))),
        grid2(field('Highlighter', sel(cfg.hlColour, colourOpts(), v => set('hlColour', v))), field('Underline', sel(cfg.ulColour, colourOpts(), v => set('ulColour', v)))),
        grid2(field('Tape on the corners', sel(cfg.tape ? '1' : '0', [['1', 'Yes'], ['0', 'No']], v => set('tape', v === '1'))), field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 s'], ['2', '2 s'], ['3', '3 s'], ['5', '5 s']], v => set('hold', +v)))),
        H('p', { className: 'hint' }, 'Click an article on the preview or the timeline to edit it. Use + Article under the preview to add one.')));
    }
  };
  const punchGap = cfg => cfg.camera === 'punch' ? 0.35 : 0.1;
  return { id: 'news', name: 'Newspaper', defaults, duration, draw, form, editor };
})();

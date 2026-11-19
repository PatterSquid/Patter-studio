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
    /* close shots turn a little towards the clipping's own tilt (the fifth number, radians), so a push in is a move with a
       slight roll in it, not a plain enlargement; wide shots and the pull back are level */
    const roll = c => c.rot * Math.PI / 180 * 0.42;
    const headShot = c => { const p = L2W(c, c.AW / 2 - 20, c.yHead + c.hl.length * c.hLH * 0.5); return [p[0], p[1], zoomHead(c) * 0.95, roll(c)]; };
    const standShot = c => { const p = L2W(c, c.AW / 2, c.yStand + c.sl.length * 18); return [p[0], p[1], Math.max(1, Math.min(W * 0.9 / (c.IW * c.f), 2.4)) * 0.9, roll(c)]; };
    const bothShot = c => { if (!c.ulSpans.length) { const h = headShot(c); return [h[0], h[1], h[2] * 0.92, 0]; } const p = L2W(c, c.AW / 2 - 10, (c.yHead + c.yStand + c.sl.length * 37) / 2); return [p[0], p[1], Math.max(1, Math.min(W * 0.9 / (c.IW * c.f), H * 0.8 / ((c.yStand + c.sl.length * 37 - c.yHead) * c.f)))]; };
    const wide = [W / 2, H / 2, 1, 0], punch = cfg.camera === 'punch', keys = [[0, ...wide]];
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
    const end = t + 1.3 + Math.max(0, Math.min(10, +cfg.hold || 0)) + 0.3, lk = keys[keys.length - 1]; keys.push([end + 1, lk[1], lk[2], lk[3] * 1.03, lk[4] || 0]);
    cp = { u, tall, cards, keys, fit, dur: end, holdStart: t + 1.3 };
    ck = key; return cp;
  }
  const duration = (cfg, look) => { const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; };
  function camAt(p, t) { const k = p.keys; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const a = k[i - 1], b = k[i], q = (i >= k.length - 1 ? ease.sine : ease.io4)((t - a[0]) / Math.max(0.01, b[0] - a[0])); const z = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), q)); return [lerp(a[1], b[1], q), lerp(a[2], b[2], q), z, lerp(a[4] || 0, b[4] || 0, q)]; } const l = k[k.length - 1]; return [l[1], l[2], l[3], l[4] || 0]; }
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
  /* The card is painted at up to four times its size so zooms stay sharp; shrinking all of it every frame was most of a
     Newspaper frame and made small print shimmer. It is drawn from a halved copy no smaller than it shows (exports too
     since the quality pass: the halved copies are made with the browser's best filter, so small print is steadier and an
     export frame at 1080p went from about 25 ms to under half that here). */
  function cardMip(c, ctx) {
    const m = ctx.getTransform(), k = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) * c.AW / c.card.width;   /* the bigger way, when it is drawn squeezed for a smear */ let lv = 0; while (k * Math.pow(2, lv + 1) <= 1 && lv < 4) lv++;
    if (!lv) return c.card; const ms = c.mips || (c.mips = [c.card]);
    for (let i = ms.length; i <= lv; i++) { const p = ms[i - 1], q = document.createElement('canvas'); q.width = Math.max(1, Math.ceil(p.width / 2)); q.height = Math.max(1, Math.ceil(p.height / 2)); const g = q.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(p, 0, 0, q.width, q.height); ms.push(q); }
    return ms[lv];
  }
  /* How a clipping arrives (quality pass, November 2026). It used to fly to its place on a spring and bounce there, with the
     thud coming after it had stopped. Now it glides in over the board held a little off it (bigger, its shadow thrown
     further), turning level, and is pressed flat exactly at its landing time, which is when the shake and the squash
     happen. The fast part is smeared along its travel (E.smear). Lengths and landing times are what they always were. */
  const DIRS = { drop: [0, -1, -0.2, 1.15], 'slide-left': [-1, 0, -0.22, 1.1], 'slide-right': [1, 0, 0.22, 1.1], 'slide-up': [0, 1, 0.18, 1.1] };
  function pose(c, t, W, H) {
    const T = c.T, e = t - T.entry, L = Math.max(0.2, T.land - T.entry); let ox = 0, oy = 0, rot = 0, sc = 1, alpha = 1, lift = 0;
    if (c.entry === 'zoom') { const x = cl(e / L, 0, 1), q = x * x * (1.5 - 0.5 * x); sc = lerp(2.6, 1, q); alpha = cl(e / 0.18, 0, 1); lift = 1 - q; }
    else if (c.entry === 'spin') { const q = ease.out3(e / L); sc = lerp(0.05, 1, q); rot = (1 - q) * Math.PI * 4; }
    else { const D = DIRS[c.entry] || DIRS.drop, far = Math.pow(1 - cl(e / (L * 0.72), 0, 1), 3), up = 1 - Math.pow(cl((e - L * 0.58) / (L * 0.42), 0, 1), 2.2), back = Math.sin(cl((e - L * 0.4) / (L * 0.6), 0, 1) * Math.PI);
      ox = D[0] * far * W * 1.1; oy = D[1] * far * H * D[3]; rot = D[2] * (far - 0.1 * back); lift = up; sc = 1 + 0.07 * up; }
    return { ox, oy, rot, sc, alpha, lift };
  }
  // Where a clipping is and how it sits at a moment: its way in, the wobble and squash after it lands, the knocks it takes
  function where(c, t, p, cfg, W, H) {
    const li = t - c.T.land, P = pose(c, t, W, H), hit = cfg.impact === 'none' ? 0 : cfg.impact === 'burst' ? 1.8 : 1, side = c.i % 2 ? -1 : 1;
    let rot = c.rot * Math.PI / 180 + P.rot + E.wob(li, 0.0055 * hit * side, 9, 26), ox = P.ox, oy = P.oy;
    // a clipping already down is knocked a touch by each one that lands on the pile after it
    p.cards.forEach(o => { if (o.i > c.i && hit) { const d = t - o.T.land; if (d > 0 && d < 0.8) { rot += E.wob(d, 0.006 * hit * (o.i % 2 ? 1 : -1), 8, 22); oy += E.wob(d, 2.5 * p.u * hit, 9, 24); } } });
    return { li, P, rot, ox, oy, sq: 1 - E.wob(li, 0.011 * hit, 11, 30) };
  }
  function drawCard(ctx, t, c, p, C, cfg, look, W, H) {
    const T = c.T, s = c.f; if (t < T.entry) return;
    const { li, P, rot, ox, oy, sq } = where(c, t, p, cfg, W, H), sh = 20 + P.lift * 34, AW = c.AW, AH = c.AH, hlCol = E.COLOURS[cfg.hlColour] || '#f5821f', ulCol = E.COLOURS[cfg.ulColour] || '#e3302c';
    const paint = g => {
      g.save(); g.globalAlpha *= P.alpha; g.translate(c.x + ox, c.y + oy); g.rotate(rot); g.scale(s * P.sc / sq, s * P.sc * sq);
      g.save(); g.globalAlpha *= 1 - 0.3 * P.lift; g.fillStyle = C.shadow; g.fillRect(-AW / 2 + sh, -AH / 2 + sh, AW, AH); g.restore();
      g.drawImage(cardMip(c, g), -AW / 2, -AH / 2, AW, AH); g.lineWidth = 7; g.strokeStyle = C.ink; g.strokeRect(-AW / 2, -AH / 2, AW, AH);
      // the tape goes on once it is down: one strip, then the other, each pressed on
      if (cfg.tape) [[-AW / 2 + 64, -AH / 2 - 4, -0.42], [AW / 2 - 64, -AH / 2 - 4, 0.38]].forEach(([tx, ty, tr], k) => { const q = cl((li - 0.08 - k * 0.13) / 0.1, 0, 1); if (q <= 0) return; const e = ease.out3(q), ts = 1 + 0.45 * (1 - e);
        g.save(); g.translate(tx, ty); g.rotate(tr + (1 - e) * (k ? 0.12 : -0.12)); g.scale(ts, ts); g.globalAlpha *= Math.min(1, q * 2.5); g.fillStyle = 'rgba(248,244,226,0.84)'; g.beginPath(); g.moveTo(-68, -20); g.lineTo(68, -20); for (let j = 0; j < 6; j++) g.lineTo(68 - (j % 2) * 5, -20 + (j + 1) * 6.7); g.lineTo(-68, 20); for (let j = 0; j < 6; j++) g.lineTo(-68 + (j % 2) * 5, 20 - (j + 1) * 6.7); g.closePath(); g.fill(); g.strokeStyle = 'rgba(13,20,32,0.45)'; g.lineWidth = 2; g.stroke(); g.restore(); });
      g.translate(-AW / 2, -AH / 2);
      /* The highlighter: one stroke a line, each taking its share of the time by its length, quick off the mark and slowing
         to its end like a hand does. The nib is a chisel (both ends lean), the ink sits a shade heavier along two streaks,
         where the pen went down and, while it is moving, just behind the nib. */
      if (c.hlSpans.length && t > T.hl) { const tot = c.hlSpans.reduce((a, sp) => a + sp.w, 0) || 1, r = E.rng(41); let acc = 0;
        c.hlSpans.forEach(sp => { const jt = []; for (let i = 0; i < 27; i++) jt.push(r()); const share = sp.w / tot, x = (t - T.hl - acc * 0.75) / Math.max(0.1, share * 0.75 * (c.hlSpans.length > 1 ? 0.92 : 1)); acc += share; if (x <= 0) return;
          const q = 1 - Math.pow(1 - cl(x, 0, 1), 2.3), base = c.yHead + c.hs * 0.86 + sp.li * c.hLH, top = base - c.hs * 0.8, hh = c.hs * 0.88, x0 = c.P - 2 + sp.x0 - 10, ww = (sp.w + 20) * q, lean = hh * 0.07;
          g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = hlCol; g.beginPath(); g.moveTo(x0 + lean, top + jt[0] * 4); for (let i = 1; i <= 12; i++) g.lineTo(x0 + lean + ww * i / 12, top + (jt[i] - 0.5) * 5);
          g.lineTo(x0 + ww + lean + 3, top + hh * 0.2); g.lineTo(x0 + ww + 2, top + hh * 0.62); for (let i = 12; i >= 0; i--) g.lineTo(x0 - lean + ww * i / 12, top + hh + (jt[13 + i] - 0.5) * 5); g.closePath(); g.fill();
          g.clip(); g.globalAlpha *= 0.13; g.fillRect(x0 - lean, top + hh * 0.26, ww + lean * 2 + 4, hh * 0.05); g.fillRect(x0 - lean, top + hh * 0.7, ww + lean * 2 + 4, hh * 0.045); g.fillRect(x0 - lean, top - 4, Math.min(ww, 12), hh + 8);
          if (q < 1) { g.globalAlpha *= 1.4 * (1 - q); g.fillRect(x0 + ww - 30, top - 4, 40, hh + 8); }
          g.restore(); }); }
      /* The underline: a pen line, not a stroke of even width. It swells in the middle of each pass and thins where the pen
         lands and lifts, goes quick then slows, and the second pass comes back under the first after the pen is lifted. */
      if (c.ulSpans.length && t > T.ul) { const n = c.ulSpans.length, xa = (t - T.ul) / 0.65; g.save(); g.fillStyle = ulCol;
        c.ulSpans.forEach((sp, k) => { const xs = cl(xa * n - k, 0, 1); if (xs <= 0) return; const y = c.yStand + 26 + sp.li * 37 + 9, x0 = c.P + sp.x0 - 6, w = sp.w + 12, eo = v => 1 - Math.pow(1 - cl(v, 0, 1), 2);
          const pass = (off, ph, amp, qq, wd) => { if (qq <= 0) return; const m = Math.max(2, Math.ceil(54 * qq)), up = [], dn = [];
            for (let i = 0; i <= m; i++) { const v = qq * i / m, xx = x0 + w * v, yy = y + off + Math.sin(v * Math.PI * 5 + ph) * amp + v * 2, hw = wd * (0.42 + 0.58 * Math.sqrt(Math.sin(Math.PI * (0.04 + v * 0.92)))) * (1 + 0.1 * Math.sin(v * 23 + ph)) * Math.min(1, 0.4 + (qq - v) / 0.05); up.push([xx, yy - hw]); dn.push([xx, yy + hw]); }
            g.beginPath(); up.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); const e = up[m]; g.arc(e[0], (e[1] + dn[m][1]) / 2, (dn[m][1] - e[1]) / 2, -Math.PI / 2, Math.PI / 2); for (let i = m; i >= 0; i--) g.lineTo(dn[i][0], dn[i][1]); g.arc(up[0][0], (up[0][1] + dn[0][1]) / 2, (dn[0][1] - up[0][1]) / 2, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fill(); };
          pass(0, 0, 2.4, eo(xs / 0.6), 3.5); pass(9, 1.1, 2, eo((xs - 0.66) / 0.34), 3.1); }); g.restore(); }
      g.restore();
    };
    // its speed, for the smear: only worth working out while it is on its way in
    if (li < 0) { const h = 1 / 240, a = pose(c, t - h, W, H), b = pose(c, t + h, W, H), r = Math.abs(rot), ext = ((AW * Math.cos(r) + AH * Math.abs(Math.sin(r))) / 2 + sh + 30) * s * P.sc, exy = ((AH * Math.cos(r) + AW * Math.abs(Math.sin(r))) / 2 + sh + 40) * s * P.sc;
      E.smear(ctx, paint, [c.x + ox - ext, c.y + oy - exy, c.x + ox + ext, c.y + oy + exy], (b.ox - a.ox) / (2 * h), (b.oy - a.oy) / (2 * h), 'news' + c.i); }
    else paint(ctx);
  }
  function draw(ctx, t, cfg, look, W, H) {
    const p = plan(cfg, look, W, H), C = E.palette(look), u = p.u;
    let [fx, fy, z, cr] = look.noCam ? [W / 2, H / 2, 1, 0] : camAt(p, t), shx = 0, shy = 0;
    if (cfg.impact !== 'none') p.cards.forEach(c => { const [a, b] = softShake(t, c.T.land, (cfg.impact === 'burst' ? 11 : 5) * u); shx += a; shy += b; });
    ctx.save(); const at = E.camera(ctx, W, H, fx, fy, z, t, u, shx, shy);
    /* The board is not painted where a clipping that is down covers it. Close in, the clipping fills the frame and the
       board under it was a third of the frame's time for nothing. (Where two overlap the board is painted and covered
       again: harmless.) A clipping still on its way in hides nothing. */
    const down = p.cards.filter(c => t > c.T.land + 0.02);
    if (down.length) { ctx.save(); ctx.beginPath(); ctx.rect(-W, -H, W * 3, H * 3); const cs = Math.cos(-cr), sn = Math.sin(-cr);
      down.forEach(c => { const w = where(c, t, p, cfg, W, H), hw = (c.AW / 2 - 12) * c.f * w.P.sc / w.sq, hh = (c.AH / 2 - 12) * c.f * w.P.sc * w.sq, co = Math.cos(w.rot), si = Math.sin(w.rot);
        [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([x, y], i) => { const X = c.x + w.ox + x * co - y * si - at[0], Y = c.y + w.oy + x * si + y * co - at[1], qx = at[0] + X * cs - Y * sn, qy = at[1] + X * sn + Y * cs; i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); }); ctx.closePath(); });
      ctx.clip('evenodd'); E.drawBg(ctx, C, look, W, H, (fx - W / 2) * -0.15, (fy - H / 2) * -0.15); ctx.restore(); }
    else E.drawBg(ctx, C, look, W, H, (fx - W / 2) * -0.15, (fy - H / 2) * -0.15);
    if (cr) { ctx.translate(at[0], at[1]); ctx.rotate(-cr); ctx.translate(-at[0], -at[1]); }   /* the background stays level, so it always covers */
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
        { id: 'end', name: 'End', items: [{ id: 'hold', start: p.holdStart, end: p.holdStart + Math.max(0, Math.min(10, +cfg.hold || 0)), label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10 }] }]; },
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

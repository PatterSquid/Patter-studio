/* Timeline module. Horizontal in 16:9, vertical in 9:16. */
const Timeline = (() => {
  const { cl, lerp, ease, spring, fd, fl } = E;
  const SPD = { slow: [0.95, 0.75], normal: [0.75, 0.55], fast: [0.55, 0.4] };
  function defaults() {
    return { title: 'How we got here', spacing: 'year', markerColour: 'Irn-Bru orange', tagColour: 'Neon red', camera: true, speed: 'normal', hold: 2,
      stops: [['1999', 'Scottish Parliament opens'], ['2006', 'Smoking ban in pubs'], ['2014', 'Independence referendum'], ['2016', 'Brexit vote'], ['2020', 'Pubs shut for lockdown']] };
  }
  let ck = '', cp = null;
  function plan(cfg, look, W, H) {
    const key = JSON.stringify(cfg) + look.format + (E.fontVersion || 0); if (key === ck) return cp;
    const u = Math.min(W, H) / 1080, vert = H > W, st = cfg.stops.filter(s => String(s[0]).trim() || String(s[1]).trim()), n = Math.max(2, st.length);
    while (st.length < 2) st.push(['', '']);
    const s0 = vert ? H * 0.2 : W * 0.1, s1 = vert ? H * 0.9 : W * 0.9;
    let pos;
    const yrs = st.map(s => parseFloat(s[0]));
    if (cfg.spacing === 'year' && yrs.every(isFinite) && yrs.every((v, i) => i === 0 || v > yrs[i - 1])) {
      pos = yrs.map(v => s0 + (v - yrs[0]) / (yrs[n - 1] - yrs[0]) * (s1 - s0));
      const min = (s1 - s0) / (n - 1) * 0.55; for (let i = 1; i < n; i++) if (pos[i] - pos[i - 1] < min) pos[i] = pos[i - 1] + min;
      const k = (s1 - s0) / (pos[n - 1] - s0); pos = pos.map(p => s0 + (p - s0) * k);
    } else pos = st.map((s, i) => s0 + i / (n - 1) * (s1 - s0));
    const [SEG, HOLD] = SPD[cfg.speed] || SPD.normal, START = E.tm(cfg, 'intro') ?? 1.0, T = [], Hs = [], Ss = []; let acc = START;
    // Each stop's bar: wait at the stop, then move on. A dragged bar longer than normal adds waiting; shorter speeds both up.
    st.forEach((s, i) => { const last = i === n - 1, base = last ? HOLD : SEG + HOLD, auto = base + Math.max(0, +s[2] || 0), L = E.tm(cfg, 'stop:' + cfg.stops.indexOf(s)) ?? auto, f = Math.min(1, L / base);
      T.push(acc); Hs.push(HOLD * f + Math.max(0, L - base) * (last ? 1 : 0)); Ss.push(SEG * f); acc += last ? Hs[i] : Math.max(L, base * f); });
    const endT = T[n - 1] + Hs[n - 1] + 0.2, pull = cfg.camera ? 1.3 : 0.2, dur = endT + pull + (+cfg.hold || 0) + 0.3;
    const line = vert ? W * 0.5 : H * 0.56;
    let gap2 = Infinity; for (let i = 0; i + 2 < n; i++) gap2 = Math.min(gap2, pos[i + 2] - pos[i]);
    const cardW = vert ? W * 0.36 : Math.min(380 * u, Math.max(190 * u, (isFinite(gap2) ? gap2 : (s1 - s0) * 2) - 26 * u));
    cp = { u, vert, st, n, pos, T, Hs, Ss, SEG, HOLD, START, endT, pull, dur, line, s0, s1, cardW, mk: E.COLOURS[cfg.markerColour] || '#f5821f', tag: E.COLOURS[cfg.tagColour] || '#e3302c' };
    ck = key; return cp;
  }
  const duration = (cfg, look) => { const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; };
  function headPos(p, t) {
    if (t < p.T[0]) return { s: p.s0 - 80 * p.u + 80 * p.u * ease.io4((t - p.START + 0.6) / 0.6), i: -1 };
    for (let i = 0; i < p.n; i++) { if (i === p.n - 1 || t < p.T[i] + p.Hs[i]) return { s: p.pos[i], i }; const q = ease.io4((t - p.T[i] - p.Hs[i]) / p.Ss[i]); if (q < 1) return { s: lerp(p.pos[i], p.pos[i + 1], q), i }; }
    return { s: p.pos[p.n - 1], i: p.n - 1 };
  }
  function draw(ctx, t, cfg, look, W, H) {
    const p = plan(cfg, look, W, H), C = E.palette(look), u = p.u, h = headPos(p, t), out = ease.io3((t - p.endT) / 1.3);
    const XY = (s, c = 0) => p.vert ? [p.line + c, s] : [s, p.line + c];
    let z = 1, fx = W / 2, fy = H / 2;
    if (cfg.camera) {
      const zIn = p.vert ? 1.08 : 1.4, intro = ease.io3((t - 0.3) / 1.0);
      if (p.vert) { const half = H / (2 * zIn), cy = cl(h.s, half, H - half); fy = lerp(H / 2, lerp(H / 2, cy, intro), 1 - out); fx = W / 2; }
      else { const half = W / (2 * zIn), cx = cl(h.s + 60 * u, half, W - half); fx = lerp(W / 2, lerp(W / 2, cx, intro), 1 - out); fy = lerp(H / 2, lerp(H / 2, p.line - 20 * u, intro), 1 - out); }
      z = lerp(1, lerp(1, zIn, intro), 1 - out);
    } else z = 1 + 0.03 * ease.sine(t / p.dur);
    ctx.save(); E.camera(ctx, W, H, fx, fy, z, t, u);
    E.drawBg(ctx, C, look, W, H, (fx - W / 2) * -0.15, (fy - H / 2) * -0.15);
    // Track
    const a = p.s0 - 80 * u, b = p.s1 + 70 * u, hs = Math.max(a, h.s);
    const seg = (from, to) => { const A = XY(from), B = XY(to); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); };
    ctx.lineCap = 'round';
    ctx.save(); ctx.translate(7 * u, 7 * u); seg(a, hs); ctx.strokeStyle = C.shadow; ctx.lineWidth = 28 * u; ctx.stroke(); ctx.restore();
    seg(a, hs); ctx.strokeStyle = C.ink; ctx.lineWidth = 28 * u; ctx.stroke(); seg(a, hs); ctx.strokeStyle = C.paper; ctx.lineWidth = 15 * u; ctx.stroke();
    ctx.setLineDash([2 * u, 28 * u]); seg(hs + 24 * u, b); ctx.strokeStyle = look.transparent ? 'rgba(13,20,32,0.35)' : 'rgba(244,238,223,0.4)'; ctx.lineWidth = 9 * u; ctx.stroke(); ctx.setLineDash([]);
    // Cards
    p.st.forEach((s, i) => { const q = (t - p.T[i]) / 0.9; if (q > 0) card(ctx, p, s, i, q, C, u, XY); });
    // Markers
    p.st.forEach((s, i) => {
      const [x, y] = XY(p.pos[i]), k = spring((t - p.T[i] + 0.05) * 1.3, 6.5, 10), r = 22 * u; ctx.save(); ctx.translate(x, y);
      if (k > 0) { ctx.scale(k, k); ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.arc(5 * u, 5 * u, r, 0, 7); ctx.fill(); ctx.fillStyle = p.mk; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(-6 * u, -6 * u, 5 * u, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(0, 0, 10 * u, 0, 7); ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.stroke(); }
      ctx.restore(); if (k > 0) E.ripple(ctx, x, y, 70 * u, (t - p.T[i]) / 0.8, p.mk, u);
    });
    if (t < p.endT) { const [x, y] = XY(hs); ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(x, y, 14 * u, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.accent2; ctx.beginPath(); ctx.arc(x, y, 6 * u, 0, 7); ctx.fill(); }
    ctx.restore();
    E.title(ctx, cfg.title, t, W, H, C, u); E.fadeIn(ctx, t, W, H, C, look);
  }
  function card(ctx, p, s, i, q, C, u, XY) {
    const side = i % 2 === 0 ? -1 : 1, gap = 46 * u, [x, y] = XY(p.pos[i]), fsY = 44 * u, fsL = 28 * u, cw = p.cardW;
    ctx.font = fl(fsL); const lines = E.wrapText(ctx, String(s[1] || '').toUpperCase(), cw - 34 * u, 3), ch = fsY * 1.3 + 22 * u + lines.length * fsL * 1.18 + (lines.length ? 18 * u : 0);
    const stp = cl(q * 2.2, 0, 1);
    // stem
    ctx.strokeStyle = C.ink; ctx.lineWidth = 5 * u; ctx.beginPath();
    if (p.vert) { ctx.moveTo(x + side * 22 * u, y); ctx.lineTo(x + side * (22 * u + (gap - 22 * u) * stp), y); } else { ctx.moveTo(x, y + side * 22 * u); ctx.lineTo(x, y + side * (22 * u + (gap - 22 * u) * stp)); }
    ctx.stroke();
    const sp = spring((q - 0.22) * 1.4, 6.5, 9); if (sp <= 0) return;
    let cx, top;
    if (p.vert) { cx = x + side * (gap + cw / 2); top = y - ch / 2; } else { cx = x; top = side < 0 ? y - gap - ch : y + gap; }
    const ax = p.vert ? x + side * gap : x, ay = p.vert ? y : y + side * gap;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(side * (1.5 + 6 * (1 - sp)) * Math.PI / 180); ctx.scale(0.6 + 0.4 * sp, 0.6 + 0.4 * sp); ctx.translate(-ax, -ay);
    E.panel(ctx, cx - cw / 2, top, cw, ch, C, u, { shadow: 9, grain: true });
    ctx.font = fd(fsY); const yt = String(s[0] || ''), yw = ctx.measureText(yt).width + 30 * u;
    if (yt) { ctx.fillStyle = p.tag; ctx.fillRect(cx - yw / 2, top + 16 * u, yw, fsY * 1.3); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(cx - yw / 2, top + 16 * u, yw, fsY * 1.3); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(yt, cx, top + 16 * u + fsY * 0.67); }
    ctx.font = fl(fsL); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, k) => ctx.fillText(ln, cx, top + 16 * u + fsY * 1.3 + 20 * u + fsL * 0.6 + k * fsL * 1.18));
    ctx.restore();
  }
  function form(root, cfg, changed) {
    const { H, field, sel, txt, card: cardEl, grid2, colourOpts, btn, iconBtn } = UI; root.innerHTML = '';
    const re = () => form(root, cfg, changed), set = (k, v, r) => { cfg[k] = v; changed(); if (r) re(); };
    const rows = H('div', { className: 'rows' });
    cfg.stops.forEach((s, i) => rows.append(H('div', { className: 'row', style: 'grid-template-columns:90px minmax(0,1fr) 34px 34px' },
      txt(s[0], v => { s[0] = v; changed(); }, 'Year', 'Year for stop ' + (i + 1)), txt(s[1], v => { s[1] = v; changed(); }, 'What happened', 'Label for stop ' + (i + 1)),
      iconBtn('↑', 'Move stop up', () => { if (i > 0) { [cfg.stops[i - 1], cfg.stops[i]] = [cfg.stops[i], cfg.stops[i - 1]]; changed(); re(); } }),
      iconBtn('×', 'Remove stop ' + (i + 1), () => { if (cfg.stops.length > 2) { cfg.stops.splice(i, 1); changed(); re(); } }))));
    root.append(
      cardEl('Timeline', field('Title', txt(cfg.title, v => set('title', v), 'Shown in the red banner')),
        field('Spacing', sel(cfg.spacing, [['year', 'Space by year'], ['even', 'Even spacing']], v => set('spacing', v)), 'Space by year needs numbers that go up, otherwise it spaces evenly.')),
      cardEl('Stops', H('div', { className: 'rowhead', style: 'grid-template-columns:90px minmax(0,1fr) 34px 34px' }, H('span', {}, 'Year or date'), H('span', {}, 'Label'), H('span'), H('span')), rows,
        H('div', { className: 'btnrow' }, cfg.stops.length < 10 ? btn('Add stop', () => { const last = parseFloat(cfg.stops[cfg.stops.length - 1][0]); cfg.stops.push([isFinite(last) ? String(last + 1) : '', '']); changed(); re(); }) : H('span', { className: 'hint' }, 'Ten stops is the maximum.'))),
      cardEl('Style', grid2(field('Marker colour', sel(cfg.markerColour, colourOpts(), v => set('markerColour', v))), field('Year tag colour', sel(cfg.tagColour, colourOpts(), v => set('tagColour', v)))),
        grid2(field('Speed', sel(cfg.speed, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], v => set('speed', v))), field('Camera', sel(cfg.camera ? '1' : '0', [['1', 'Follow the marker'], ['0', 'Locked off']], v => set('camera', v === '1')))),
        field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v)))));
  }
  const holdUpd = (cfg, ch) => { cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 2) / 2)); };
  const holdClip = (a, b) => ({ id: 'hold', start: a, end: b, label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' });
  const editor = { formIsScene: true,
    tracks(cfg, look) { const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), items = p.st.map((s, i) => ({ id: 'stop:' + cfg.stops.indexOf(s), start: p.T[i], end: (p.T[i + 1] ?? (p.endT - 0.2)), label: [s[0], s[1]].filter(Boolean).join(': ') || 'Stop', colour: '#7a4a1c', move: false, trim: 'end', minLen: 0.3, timed: true, title: 'Drag the right edge to slow this stop down or speed it up' }));
      items.unshift({ id: 'intro', start: 0, end: p.START, label: 'Intro', colour: '#3a4660', move: false, trim: 'end', minLen: 0.3, maxLen: 20, timed: true, title: 'Drag the right edge to change when the first stop arrives' });
      return [{ id: 'stops', name: 'Stops', colour: p.mk, items }, { id: 'end', name: 'End', items: [holdClip(p.endT + p.pull, p.endT + p.pull + (+cfg.hold || 0))] }]; },
    update(cfg, id, ch) { if (id === 'hold') return holdUpd(cfg, ch); E.setTm(cfg, id, ch.end - ch.start); },
    resetTiming(cfg, id) { const s = id.startsWith('stop:') && cfg.stops[+id.split(':')[1]]; if (s) s[2] = 0; },
    scene(root, cfg, changed) { form(root, cfg, changed); } };
  return { id: 'timeline', name: 'Timeline', defaults, duration, draw, form, editor };
})();

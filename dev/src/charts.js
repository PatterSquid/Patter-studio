/* Charts module. The charts are drawn by ChartKit (charts2.js); the two classic ones (a line or bars in the old cartoon style)
   are still drawn here, exactly as they were, for charts made before the kit (style 'classic'), so nothing in a finished
   video changes. */
const Charts = (() => {
  /* Number formats are made once and kept: toLocaleString builds a new one on every call, and every label on every frame asked
     for one (a sixth of a chart frame's script time). The text is the same. */
  const NF = {}, numFmt = (lo, hi) => { hi = Math.max(lo, Math.min(20, hi)); const k = lo + '|' + hi; return NF[k] || (NF[k] = new Intl.NumberFormat('en-GB', { minimumFractionDigits: lo, maximumFractionDigits: hi })); };
  const { cl, lerp, ease, spring, rng, fd, fl } = E;
  const SPEED = { slow: 6.6, normal: 4.8, fast: 3.2 };
  const END_DUR = { none: 0, explode: 2.0, fly: 1.8 };

  // What the tab opened with before the kit: a chart still exactly this was never touched, so it becomes the new example
  const OLD = () => ({
      type: 'line', title: 'UK population, millions', source: 'Source: ONS mid year estimates, approximate',
      rows: [['1975', '56.2'], ['1980', '56.3'], ['1985', '56.6'], ['1990', '57.2'], ['1995', '58.0'], ['2000', '58.9'], ['2005', '60.4'], ['2010', '62.8'], ['2015', '65.1'], ['2020', '67.1'], ['2024', '69.3']],
      prefix: '', suffix: 'm', decimals: 'auto', zeroBase: false, colour: 'Irn-Bru orange', hlColour: 'Neon red',
      milestones: [{ on: true, idx: 5, caption: 'Growth takes off' }], counter: true, camera: true, speed: 'normal', hold: 2, ending: 'none', endText: '',
    });
  const clone = v => JSON.parse(JSON.stringify(v));
  function defaults() {
    return Object.assign({ style: 'sleek', type: 'bar', title: '', sub: '', source: '', series: [], rows: [], rowHl: [], rowCol: [], prefix: '', suffix: '', decimals: 'auto', short: false, zeroBase: false, colour: 'Irn-Bru orange', hlColour: 'Neon red',
      sort: 'none', order: 'rows', labels: 'auto', legend: true, avg: false, ref: false, refValue: '', refLabel: '', top: 8, outOf: 100, centre: 'total', centreText: '', from: '',
      milestones: [], counter: false, camera: true, speed: 'normal', hold: 2, ending: 'none', endText: '' }, clone(ChartKit.EXAMPLES.bar), { rowHl: [] });
  }
  // A chart from before the kit has no look and no columns of its own: it is left exactly as it is and drawn as it always was
  const classic = cfg => !!cfg && (cfg.style === 'classic' || (cfg.style === undefined && cfg.series === undefined));
  /* Called on every chart as it loads, before anything missing is filled in (Repair.clip). For a chart from before the kit it
     hands back the settings that must NOT be filled in, so the chart stays byte for byte what it was (in his projects and
     inside his videos). The one in the tab itself, if it is still the old untouched example, becomes the new example
     instead (never a chart inside a video). */
  function legacy(cfg, depth) {
    if (!cfg || typeof cfg !== 'object' || !classic(cfg) || cfg.style === 'classic') return null;
    const o = OLD(), same = Object.keys(o).every(k => JSON.stringify(cfg[k]) === JSON.stringify(o[k])) && !cfg.timing;
    if (!depth && same) { Object.keys(cfg).forEach(k => { if (k !== 'layers') delete cfg[k]; }); Object.assign(cfg, defaults()); return null; }
    return Object.keys(defaults()).filter(k => !(k in o));
  }
  // A classic chart brought up to date: the same data in the kit, in the cartoon look it had
  function upgrade(cfg) { const d = defaults(), ex = ChartKit.EXAMPLES.bar; Object.keys(d).forEach(k => { if (!(k in cfg) && !(k in ex)) cfg[k] = d[k]; });
    cfg.style = 'comic'; cfg.type = cfg.type === 'line' ? 'line' : 'bar'; cfg.series = [{ name: '', colour: typeof cfg.colour === 'string' ? cfg.colour : 'Irn-Bru orange' }]; cfg.rowHl = []; cfg.rowCol = []; cfg.sub = typeof cfg.sub === 'string' ? cfg.sub : ''; cfg.ending = 'none'; cfg.labels = 'auto'; delete cfg.timing; }

  // Everything that depends only on settings is computed once and cached.
  let cacheKey = '', cache = null;
  function plan(cfg, look, W, H) {
    const key = JSON.stringify(cfg) + look.format + W + 'x' + H + (E.fontVersion || 0);
    if (key === cacheKey) return cache;
    const u = Math.min(W, H) / 1080, tall = H > W;
    const rows = (Array.isArray(cfg.rows) ? cfg.rows : []).filter(r => Array.isArray(r)).map(r => [String(r[0]).trim(), parseFloat(String(r[1]).replace(/[^0-9.\-]/g, ''))]).filter(r => r[0] !== '' && isFinite(r[1]));
    if (rows.length < 2) rows.push(...[['A', 1], ['B', 2]].slice(rows.length));
    const L = rows.map(r => r[0]), V = rows.map(r => r[1]), n = V.length, bar = cfg.type === 'bar';
    const dec = cfg.decimals === 'auto' ? Math.min(2, Math.max(0, ...(Array.isArray(cfg.rows) ? cfg.rows : []).map(r => ((String(r && r[1]).split('.')[1]) || '').replace(/[^0-9]/g, '').length)) || 0) : Math.round(cl(+cfg.decimals || 0, 0, 6));
    let mn = Math.min(...V), mx = Math.max(...V);
    if (bar || cfg.zeroBase) { mn = Math.min(0, mn); mx = Math.max(0, mx); }
    const pad = (mx - mn) * 0.1 || Math.abs(mx) * 0.1 || 1;
    const msOn = (Array.isArray(cfg.milestones) ? cfg.milestones : []).some(m => m && m.on);
    let lo = (bar || cfg.zeroBase) && mn >= 0 ? 0 : mn - pad, hi = mx + (bar && msOn ? (mx - mn) * 0.38 || pad : pad);
    const raw = (hi - lo) / (tall ? 5 : 4), mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw * 0.999);
    lo = Math.floor(lo / st + 1e-9) * st; hi = Math.ceil(hi / st - 1e-9) * st;
    const ticks = []; for (let v = lo; v <= hi + st * 1e-6; v += st) ticks.push(+v.toFixed(6));
    const fmt = v => cfg.prefix + numFmt(dec, dec).format(Number(v)) + cfg.suffix;
    const tfmt = v => cfg.prefix + numFmt(0, Math.max(dec, st < 1 ? 1 : 0)).format(Number(v)) + cfg.suffix;

    // Layout
    const titleY = H * (tall ? 0.075 : 0.085), P = { x0: W * (tall ? 0.06 : 0.05), x1: W * (tall ? 0.94 : 0.95), y0: H * (tall ? 0.13 : 0.175), y1: H * (tall ? 0.88 : 0.93) };
    const mc = document.createElement('canvas').getContext('2d'); mc.font = fl(30 * u);
    const yLabW = Math.max(...ticks.map(v => mc.measureText(tfmt(v)).width)) + 40 * u;
    const A = { x0: P.x0 + yLabW + 26 * u, x1: P.x1 - 50 * u, y0: P.y0 + (cfg.counter ? 150 : 70) * u, y1: P.y1 - (cfg.source ? 120 : 90) * u };
    const X = bar ? i => A.x0 + (i + 0.5) / n * (A.x1 - A.x0) : i => A.x0 + i / (n - 1) * (A.x1 - A.x0);
    const Y = v => A.y1 - (v - lo) / (hi - lo) * (A.y1 - A.y0);
    const bandW = (A.x1 - A.x0) / n, barW = Math.min(bandW * 0.62, 150 * u);
    mc.font = fl(30 * u); const maxLab = Math.max(...L.map(s => mc.measureText(s).width));
    const every = bar ? Math.max(1, Math.ceil(maxLab / (bandW * 0.92))) : Math.max(1, Math.ceil((maxLab + 30 * u) / ((A.x1 - A.x0) / (n - 1))));

    // Timing
    const ms = (Array.isArray(cfg.milestones) ? cfg.milestones : []).filter(m => m && m.on && m.idx >= 0 && m.idx < n).map(m => ({ idx: +m.idx, caption: m.caption || '' }));
    // The title bar and the drawing bar can be dragged on the timeline to set their exact lengths
    const T0 = Math.min(20, E.tm(cfg, 'intro') ?? 1.15), wantDraw = Math.min(120, E.tm(cfg, 'draw') || 0) || undefined;
    let total = SPEED[cfg.speed] || 4.8, reach = {}, drawEnd, map = null;
    if (!bar) {
      const run = () => { const dt = 1 / 240, tab = [0]; let f = 0, t = 0; reach = {};
      while (f < n - 1 && t < 120) { let sp = (n - 1) / total; ms.forEach(m => { const d = f - m.idx; sp *= 1 - 0.78 * Math.exp(-d * d / 1.1); }); sp *= 0.25 + 0.75 * ease.io4(t / 0.8); f = Math.min(n - 1, f + sp * dt); t += dt; tab.push(f); ms.forEach(m => { if (reach[m.idx] === undefined && f >= m.idx - 1e-6) reach[m.idx] = T0 + t; }); }
      map = tab; drawEnd = T0 + t; return t; };
      // Line speed is close to proportional to the drawing time, so a couple of corrections land on the dragged length
      let got = run(); if (wantDraw) for (let k = 0; k < 3 && Math.abs(got - wantDraw) > 0.01; k++) { total *= wantDraw / Math.max(0.05, got); got = run(); }
    } else {
      const run = f => { const gap = Math.min(0.24, total / n * 0.55) * f, starts = []; let tt = T0; reach = {};
        for (let i = 0; i < n; i++) { starts.push(tt); tt += gap; if (ms.some(m => m.idx === i)) { reach[i] = tt + 0.45 * f; tt += 1.0 * f; } }
        map = starts; drawEnd = starts[n - 1] + 0.9 * f; return drawEnd - T0; };
      const got = run(1); if (wantDraw) run(wantDraw / Math.max(0.05, got));
    }
    const pull = cfg.camera ? 1.3 : 0.3, endStart = drawEnd + pull + Math.max(0, Math.min(10, +cfg.hold || 0)), dur = endStart + (END_DUR[cfg.ending || 'none'] || 0) + 0.4;
    const hlCol = E.COLOURS[cfg.hlColour] || '#e3302c', col = E.COLOURS[cfg.colour] || '#f5821f';
    cache = { u, tall, L, V, n, bar, dec, lo, hi, ticks, fmt, tfmt, titleY, P, A, X, Y, bandW, barW, every, ms, reach, map, T0, drawEnd, pull, endStart, dur, col, hlCol };
    cacheKey = key; return cache;
  }

  function duration(cfg, look) { if (!classic(cfg)) return ChartKit.duration(cfg, look); const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; }
  function progLine(p, t) { if (t <= p.T0) return 0; const i = Math.min(p.map.length - 1, Math.floor((t - p.T0) * 240)); return p.map[i]; }
  function valAt(p, f) { const i = Math.min(p.n - 2, Math.floor(f)), u = f - i; return p.V[i] + (p.V[i + 1] - p.V[i]) * u; }

  const patCache = {};
  function areaPat(ctx, col, u) { const k = col + u; if (patCache[k]) return patCache[k]; const s = Math.max(8, Math.round(20 * u)), c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); g.globalAlpha = 0.3; g.fillStyle = col; g.fillRect(0, 0, s, s); g.globalAlpha = 0.45; g.fillStyle = '#7a3a06'; g.beginPath(); g.arc(s / 4, s / 4, s * 0.13, 0, 7); g.arc(s * 3 / 4, s * 3 / 4, s * 0.13, 0, 7); g.fill(); patCache[k] = ctx.createPattern(c, 'repeat'); return patCache[k]; }

  function draw(ctx, t, cfg, look, W, H) {
    if (!classic(cfg)) return ChartKit.draw(ctx, t, cfg, look, W, H);
    const p = plan(cfg, look, W, H), C = E.palette(look), u = p.u;
    const end = cfg.ending || 'none', te = p.endStart, et = t - te;
    // Camera
    let fx = W / 2, fy = H / 2, z = 1;
    const pullT = ease.io3((t - p.drawEnd - (p.ms.length ? 0.6 : 0.1)) / 1.3);
    if (cfg.camera) {
      const zIn = p.tall ? 1.12 : 1.16;
      let cx;
      if (!p.bar) cx = p.X(progLine(p, t));
      else { let i = 0; for (let k = 0; k < p.n; k++) if (t >= p.map[k]) i = k; const fr = i < p.n - 1 ? ease.sine(cl((t - p.map[i]) / Math.max(0.05, p.map[i + 1] - p.map[i]), 0, 1)) : 0; cx = lerp(p.X(i), p.X(Math.min(p.n - 1, i + 1)), fr); }
      const half = W / (2 * zIn), cxC = cl(cx + (p.bar ? 0 : 80 * u), half, W - half), cyC = p.P.y0 + (H / 2 - (p.titleY + 70 * u)) / zIn;
      const intro = ease.io3((t - 0.6) / 0.9), zz = lerp(1, zIn, intro);
      z = lerp(zz, 1, pullT); fx = lerp(lerp(W / 2, cxC, intro), W / 2, pullT); fy = lerp(lerp(H / 2, cyC, intro), H / 2, pullT);
    } else { z = 1 + 0.03 * ease.sine(t / p.dur); }
    const drift = Math.min(1, t / 1.2), [sx1, sy1] = E.shake(t, p.T0 - 0.85, 14 * u), [sx2, sy2] = end === 'explode' ? E.shake(t, te + 0.05, 26 * u, 0.7) : [0, 0];
    fx += Math.sin(t * 0.9) * 3 * u * drift; fy += Math.cos(t * 0.7) * 2.5 * u * drift;
    ctx.save(); ctx.translate(W / 2 + sx1 + sx2, H / 2 + sy1 + sy2); ctx.scale(z, z); ctx.translate(-fx, -fy);
    E.drawBg(ctx, C, look, W, H, (fx - W / 2) * -0.15, (fy - H / 2) * -0.15);

    // Panel slam
    const pd = spring((t - 0.12) * 1.2), pdy = (1 - pd) * -H * 1.1, prot = (-1.1 - 9 * (1 - pd)) * Math.PI / 180, Pn = p.P;
    const sq = (() => { const d = t - (p.T0 - 0.85); return d > 0 && d < 0.28 ? 1 - Math.sin(d / 0.28 * Math.PI) * 0.025 : 1; })();
    ctx.save(); ctx.translate((Pn.x0 + Pn.x1) / 2, (Pn.y0 + Pn.y1) / 2 + pdy); ctx.rotate(prot); ctx.scale(1 / sq, sq); ctx.translate(-(Pn.x0 + Pn.x1) / 2, -(Pn.y0 + Pn.y1) / 2);
    E.panel(ctx, Pn.x0, Pn.y0, Pn.x1 - Pn.x0, Pn.y1 - Pn.y0, C, u, { grain: true });

    // Grid and axes
    const A = p.A, gp = ease.io4((t - 0.55) / 0.7);
    ctx.font = fl(30 * u); ctx.textBaseline = 'middle';
    p.ticks.forEach((v, i) => { const yy = p.Y(v), q = ease.io4((t - 0.55 - i * 0.05) / 0.7); ctx.strokeStyle = C.grid; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(A.x0, yy); ctx.lineTo(A.x0 + (A.x1 - A.x0) * q, yy); ctx.stroke(); ctx.globalAlpha = q; ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(p.tfmt(v), A.x0 - 22 * u, yy); ctx.globalAlpha = 1; });
    const base = p.Y(Math.max(p.lo, Math.min(p.hi, 0)) === 0 ? 0 : p.lo);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(A.x0, (p.bar || cfg.zeroBase) ? p.Y(Math.max(p.lo, 0)) : A.y1); ctx.lineTo(A.x0 + (A.x1 - A.x0) * gp, (p.bar || cfg.zeroBase) ? p.Y(Math.max(p.lo, 0)) : A.y1); ctx.stroke();
    if (cfg.source) { ctx.font = `italic 400 ${24 * u}px ${E.FONT.label}`; ctx.fillStyle = C.ink; ctx.globalAlpha = 0.75 * gp; ctx.textAlign = 'left'; ctx.fillText(cfg.source, Pn.x0 + 34 * u, Pn.y1 - 36 * u); ctx.globalAlpha = 1; }

    // X labels
    ctx.font = fl(30 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const lineF = p.bar ? 0 : progLine(p, t);
    p.L.forEach((l, i) => { if (i % p.every && i !== p.n - 1) return; const st = p.bar ? p.map[i] - 0.1 : null, q = p.bar ? ease.io4((t - st) / 0.5) : ease.io4((lineF - i + 1.2) / 1.5); if (q <= 0) return; ctx.globalAlpha = q; ctx.fillStyle = C.ink; ctx.fillText(l, p.X(i), A.y1 + 22 * u + (1 - q) * 14 * u); ctx.globalAlpha = 1; });

    const gone = end !== 'none' && et > 0;
    if (!p.bar) drawLine(ctx, t, p, C, u, cfg, end, et); else drawBars(ctx, t, p, C, u, cfg, end, et);

    ctx.restore();
    if (end === 'explode') drawExplosion(ctx, t, p, C, u, cfg, et);
    ctx.restore();

    // Counter tag, in screen space so the camera never crops it
    if (cfg.counter && !(gone && et > 0.05)) {
      const cs = spring((t - 0.7) * 1.2, 6.5, 9);
      if (cs > 0) {
        let v, lab;
        if (!p.bar) { v = valAt(p, lineF); lab = p.L[Math.min(p.n - 1, Math.round(lineF))]; }
        else { let i = -1; for (let k = 0; k < p.n; k++) if (t >= p.map[k]) i = k; if (i < 0) { v = 0; lab = ''; } else { const g = ease.out3((t - p.map[i]) / 0.6), from = i > 0 ? p.V[i - 1] : 0; v = lerp(from, p.V[i], g); lab = p.L[i]; } }
        ctx.save(); ctx.translate(Math.max(p.P.x0 + 30 * u, W * 0.07), p.titleY + (p.tall ? 120 : 110) * u); ctx.scale(cs, cs); ctx.font = fd(62 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const txt = p.fmt(v), tw = ctx.measureText(txt).width;
        ctx.fillStyle = C.shadow; ctx.fillRect(-14 * u + 6 * u, -44 * u + 6 * u, tw + 28 * u, 88 * u); ctx.fillStyle = C.accent2; ctx.fillRect(-14 * u, -44 * u, tw + 28 * u, 88 * u); ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(-14 * u, -44 * u, tw + 28 * u, 88 * u);
        ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 3 * u); ctx.font = fl(32 * u); ctx.fillStyle = C.ink; ctx.fillText(lab || '', tw + 38 * u, 5 * u); ctx.restore();
      }
    }
    // Title banner in screen space
    if (cfg.title) { const hs = spring((t - 0.05) * 1.1, 6.5, 9); E.banner(ctx, String(cfg.title).toUpperCase(), W / 2, p.titleY, (p.tall ? 52 : 48) * u * fitScale(ctx, String(cfg.title).toUpperCase(), W * 0.86, (p.tall ? 52 : 48) * u), C.accent2, '#fff', C, (-2 - 6 * (1 - hs)) * Math.PI / 180, 0.6 + 0.4 * hs); }
    const fdIn = 1 - ease.expo(t / 0.35); if (fdIn > 0 && !look.transparent) { ctx.fillStyle = C.bg; ctx.globalAlpha = fdIn; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }
  function fitScale(ctx, text, maxW, fs) { ctx.font = fd(fs); const w = ctx.measureText(text).width + fs * 0.9; return Math.min(1, maxW / w); }

  function linePoints(p, f) { const pts = []; for (let i = 0; i <= Math.floor(f); i++) pts.push([p.X(i), p.Y(p.V[i])]); if (f > Math.floor(f)) pts.push([p.X(f), p.Y(valAt(p, f))]); if (pts.length < 2) pts.push([pts[0][0] + 0.01, pts[0][1]]); return pts; }

  function drawLine(ctx, t, p, C, u, cfg, end, et) {
    if (t < p.T0 - 0.05) return;
    const f = progLine(p, t), A = p.A;
    let pts = linePoints(p, f);
    let ox = 0, oy = 0, rot = 0, alpha = 1;
    if (end === 'explode' && et > 0.02) return;
    if (end === 'fly' && et > 0) {
      const ant = et < 0.3 ? -Math.sin(et / 0.3 * Math.PI) * 30 * u : 0, go = Math.max(0, et - 0.3), d = 2600 * u * go * go;
      ox = ant * 0.8 + d * 0.88; oy = -ant * 0.3 - d * 0.48; rot = -0.12 * ease.out3(go / 0.8);
    }
    ctx.save();
    if (ox || oy || rot) { const c = pts[Math.floor(pts.length / 2)]; ctx.translate(c[0] + ox, c[1] + oy); ctx.rotate(rot); ctx.translate(-c[0], -c[1]); }
    if (!(end === 'fly' && et > 0)) { ctx.beginPath(); E.curvePath(ctx, pts); ctx.lineTo(pts[pts.length - 1][0], A.y1); ctx.lineTo(pts[0][0], A.y1); ctx.closePath(); ctx.fillStyle = areaPat(ctx, p.col, u); ctx.fill(); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(5 * u, 5 * u); ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = 'rgba(8,16,28,0.35)'; ctx.lineWidth = 20 * u; ctx.stroke(); ctx.restore();
    ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = C.ink; ctx.lineWidth = 20 * u; ctx.stroke();
    ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = p.col; ctx.lineWidth = 10 * u; ctx.stroke();
    ctx.save(); ctx.translate(0, -3 * u); ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.5 * u; ctx.stroke(); ctx.restore();
    // Milestone dots
    p.ms.forEach(m => { const r0 = p.reach[m.idx]; if (r0 === undefined || t < r0) return; const k = spring((t - r0) * 1.4); ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(p.X(m.idx), p.Y(p.V[m.idx]), 12 * u * k, 0, 7); ctx.fill(); ctx.stroke(); });
    const hp = pts[pts.length - 1];
    ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(hp[0], hp[1], 16 * u, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.accent2; ctx.beginPath(); ctx.arc(hp[0], hp[1], 7 * u, 0, 7); ctx.fill();
    if (end === 'fly' && et > 0.3) { const tail = pts[0], ang = Math.atan2(-0.48, 0.88); E.speedLines(ctx, tail[0] - 40 * u, tail[1], ang, 360 * u, 220 * u, 9, et, C, u, 11); }
    ctx.restore();
    if (end === 'fly' && et > 0 && et < 0.9) { const q = (et - 0.25) / 0.65, c = pts[0]; [0, 1, 2].forEach(k => E.puff(ctx, c[0] - 40 * u + k * 60 * u, c[1] + 20 * u - k * 12 * u, (30 + 40 * ease.out3(q)) * u, C, u, q > 0 ? 1 - q : 0)); }
    p.ms.forEach((m, i) => drawMilestone(ctx, t, p, C, u, m, p.X(m.idx), p.Y(p.V[m.idx]), i, end, et));
  }

  function drawBars(ctx, t, p, C, u, cfg, end, et) {
    const zeroY = p.Y(Math.max(p.lo, Math.min(p.hi, 0)));
    for (let i = 0; i < p.n; i++) {
      const st = p.map[i]; if (t < st) continue;
      const g = ease.back((t - st) / 0.75, 0.7), v = p.V[i], top = zeroY + (p.Y(v) - zeroY) * g, x = p.X(i), w = p.barW;
      let ox = 0, oy = 0, rot = 0, sy = 1;
      if (end === 'explode' && et > 0.02) continue;
      if (end === 'fly' && et > 0) { const d0 = i * 0.07, e2 = et - d0; if (e2 > 0) { if (e2 < 0.22) sy = 1 - Math.sin(e2 / 0.22 * Math.PI) * 0.12; else { const go = e2 - 0.22; oy = -3200 * u * go * go; rot = (i % 2 ? 1 : -1) * 0.05 * go; } } }
      const isM = p.ms.some(m => m.idx === i), mr = isM ? p.reach[i] : undefined, hl = isM && t > mr - 0.2 ? ease.io3((t - mr + 0.2) / 0.3) : 0;
      ctx.save(); ctx.translate(x + ox, zeroY + oy); ctx.rotate(rot); ctx.scale(1, sy); ctx.translate(-x, -zeroY);
      const y0 = Math.min(top, zeroY), h = Math.abs(zeroY - top);
      ctx.fillStyle = C.shadow; ctx.fillRect(x - w / 2 + 8 * u, y0 + 8 * u, w, Math.max(0, h - (v >= 0 ? 0 : 0)));
      ctx.fillStyle = hl > 0 ? mix(p.col, p.hlCol, hl) : p.col; ctx.fillRect(x - w / 2, y0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + w * 0.18, y0, w * 0.32, h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x - w / 2 + w * 0.1, y0 + 6 * u, w * 0.1, Math.max(0, h - 12 * u));
      ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(x - w / 2, y0, w, h);
      const lp = spring((t - st - 0.35) * 1.3, 6.5, 10);
      if (lp > 0) { ctx.save(); const ly = v >= 0 ? top - 34 * u : top + 34 * u; ctx.translate(x, ly); ctx.scale(lp, lp); ctx.font = fd(Math.min(40 * u, w * 0.42)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 7 * u; ctx.strokeStyle = C.paper; ctx.lineJoin = 'round'; const txt = p.fmt(v); ctx.strokeText(txt, 0, 0); ctx.fillStyle = C.ink; ctx.fillText(txt, 0, 0); ctx.restore(); }
      if (end === 'fly' && et > i * 0.07 + 0.22) { E.speedLines(ctx, x, y0 + h + 30 * u, -Math.PI / 2, 300 * u, w * 0.9, 6, et, C, u, 20 + i); }
      ctx.restore();
      if (end === 'fly' && et > i * 0.07 + 0.15 && et < i * 0.07 + 0.95) { const q = (et - i * 0.07 - 0.15) / 0.8; E.puff(ctx, x, zeroY - 10 * u, (24 + 30 * ease.out3(q)) * u, C, u, 1 - q); }
    }
    p.ms.forEach((m, i) => { const v = p.V[m.idx]; drawMilestone(ctx, t, p, C, u, m, p.X(m.idx), p.Y(v) - (v >= 0 ? 72 : -72) * u, i, end, et, true); });
  }

  function drawMilestone(ctx, t, p, C, u, m, px, py, k, end, et, forceUp) {
    const r0 = p.reach[m.idx]; if (r0 === undefined || t < r0) return;
    let fade = 1; if (end !== 'none' && et > 0) fade = 1 - ease.io3(et / 0.25); if (fade <= 0) return;
    const uu = t - r0, above = forceUp || py > p.A.y0 + 230 * u, lean = px > (p.A.x0 + p.A.x1) / 2 ? -0.55 : 0.55, dir = above ? [lean, -1] : [lean, 1], L = Math.hypot(...dir), ux = dir[0] / L, uy = dir[1] / L;
    const inn = ease.back(uu / 0.55, 1.7), wob = Math.sin(uu * 14) * Math.exp(-uu * 3) * 10 * u, dist = 26 * u + wob + (1 - inn) * 560 * u, tx = px + ux * dist, ty = py + uy * dist, ang = Math.atan2(-uy, -ux);
    ctx.save(); ctx.globalAlpha = fade;
    if (uu > 0.45 && uu < 1.4) E.ripple(ctx, px, py, 90 * u, (uu - 0.45) / 0.95, C.accent2, u);
    E.arrow(ctx, tx, ty, ang, 110 * u, C.accent2, C, 1 + Math.sin(uu * 14) * Math.exp(-uu * 3) * 0.12);
    if (m.caption) { const bs = spring((uu - 0.5) * 1.2, 6.5, 9); if (bs > 0) { const cap = String(m.caption).toUpperCase(), fs = 40 * u * fitScale(ctx, cap, (p.A.x1 - p.A.x0) * 0.5, 40 * u); let bx = px + ux * 200 * u, by = py + uy * 175 * u; ctx.font = fd(fs); const bw = ctx.measureText(cap).width + fs; bx = cl(bx, p.A.x0 + bw / 2, p.A.x1 - bw / 2); by = cl(by, p.P.y0 + 60 * u, p.A.y1 - 40 * u); E.banner(ctx, cap, bx, by, fs, C.paper, C.ink, C, (-3 - 6 * (1 - bs)) * Math.PI / 180, 0.6 + 0.4 * bs); } }
    ctx.restore();
  }

  function drawExplosion(ctx, t, p, C, u, cfg, et) {
    if (et <= 0) return;
    let cx, cy;
    const mx = (p.A.x0 + p.A.x1) / 2, my = (p.A.y0 + p.A.y1) / 2 + 30 * u;
    if (!p.bar) { cx = lerp(mx, p.X(p.n - 1), 0.35); cy = lerp(my, p.Y(p.V[p.n - 1]), 0.35); } else { cx = mx; cy = my; }
    const r = rng(42), G = 1700 * u;
    // Debris built from the chart itself
    const pieces = [];
    if (!p.bar) { const pts = linePoints(p, p.n - 1); for (let i = 0; i < pts.length - 1; i++) pieces.push({ x: (pts[i][0] + pts[i + 1][0]) / 2, y: (pts[i][1] + pts[i + 1][1]) / 2, w: Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), h: 20 * u, a0: Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]), col: p.col }); }
    else { const zeroY = p.Y(Math.max(p.lo, Math.min(p.hi, 0))); for (let i = 0; i < p.n; i++) { const top = p.Y(p.V[i]), y0 = Math.min(top, zeroY), h = Math.abs(zeroY - top); for (let k = 0; k < 3; k++) pieces.push({ x: p.X(i), y: y0 + h * (k + 0.5) / 3, w: p.barW, h: h / 3, a0: 0, col: p.ms.some(m => m.idx === i) ? p.hlCol : p.col }); } }
    pieces.forEach((pc, i) => {
      const dx = pc.x - cx, dy = pc.y - cy, d = Math.hypot(dx, dy) || 1, sp = (520 + r() * 620) * u;
      const vx = dx / d * sp + (r() - 0.5) * 300 * u, vy = dy / d * sp - (380 + r() * 420) * u, spin = (r() - 0.5) * 14, tt = et;
      const x = pc.x + vx * tt, y = pc.y + vy * tt + 0.5 * G * tt * tt, a = pc.a0 + spin * tt, al = 1 - ease.in3(tt / 1.6);
      if (al <= 0) return; ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = pc.col; ctx.fillRect(-pc.w / 2, -pc.h / 2, pc.w, pc.h); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(-pc.w / 2, -pc.h / 2, pc.w, pc.h); ctx.restore();
    });
    // Smoke
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.4, q = ease.out3((et - 0.08) / 1.4), d = (60 + 220 * q) * u * (0.8 + (i % 3) * 0.15); E.puff(ctx, cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.8 - q * 60 * u, (40 + 70 * q) * u, C, u, et > 0.08 ? 1 - ease.in3((et - 0.08) / 1.7) : 0); }
    // Flash and star
    if (et < 0.18) { ctx.save(); ctx.globalAlpha = 1 - et / 0.18; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 500 * u * ease.out3(et / 0.18), 0, 7); ctx.fill(); ctx.restore(); }
    const s1 = spring(et * 1.4, 5, 10), fadeS = 1 - ease.io3((et - 1.0) / 0.7);
    if (fadeS > 0 && s1 > 0) {
      ctx.save(); ctx.globalAlpha = fadeS; const R = 300 * u * s1;
      E.star(ctx, cx, cy, R * 1.12, R * 0.62, 13, C.accent2, C, u, et * 0.4, 5);
      E.star(ctx, cx, cy, R * 0.82, R * 0.46, 11, '#f7c531', C, u, -et * 0.5 + 0.3, 9);
      if (cfg.endText) { const txt = String(cfg.endText).toUpperCase(), fs = R * 0.36 * Math.min(1, 6 / Math.max(3, txt.length)); ctx.font = fd(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs * 0.14; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.strokeText(txt, cx, cy); ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy); }
      ctx.restore();
    }
    E.burst(ctx, cx, cy, 380 * u, (et - 0.05) / 0.5, C, u, 18);
  }

  function mix(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t)); return `rgb(${r},${g},${bl})`; }

  // Inputs form for a classic chart (as it was), with the way out to the kit on top
  function formClassic(root, cfg, changed) {
    root.innerHTML = ''; if (!Array.isArray(cfg.rows)) cfg.rows = [['', ''], ['', '']]; if (cfg.rows.some(r => !Array.isArray(r))) cfg.rows = cfg.rows.map(r => Array.isArray(r) ? r : ['', '']);   /* only ever true of a damaged chart that was never mended */
    const H = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => { if (k === 'on') Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn)); else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v); }); kids.flat().forEach(k => e.append(k)); return e; };
    const field = (label, ctrl, hint) => H('label', { className: 'field' }, H('span', { className: 'lab' }, label), ctrl, hint ? H('span', { className: 'hint' }, hint) : '');
    const sel = (val, opts, fn) => H('select', { on: { change: e => fn(e.target.value) } }, ...opts.map(([v, l]) => H('option', { value: v, selected: String(v) === String(val), textContent: l })));
    const txt = (val, fn, ph = '') => H('input', { type: 'text', value: val, placeholder: ph, on: { input: e => fn(e.target.value) } });
    const set = (k, v, rebuild) => { cfg[k] = v; changed(); if (rebuild) formClassic(root, cfg, changed); };
    const colOpts = Object.keys(E.COLOURS).map(k => [k, k]);

    const s1 = H('section', { className: 'card' }, H('h3', {}, 'Chart'),
      field('Chart type', sel(cfg.type, [['line', 'Line chart'], ['bar', 'Bar chart']], v => { cfg.type = v; changed(); formClassic(root, cfg, changed); })),
      field('Title', txt(cfg.title, v => set('title', v), 'Shown in the red banner')),
      field('Source line', txt(cfg.source, v => set('source', v), 'Optional, e.g. Source: ONS')));

    const tbody = H('div', { className: 'rows' });
    const drawRows = () => {
      tbody.innerHTML = '';
      cfg.rows.forEach((r, i) => tbody.append(H('div', { className: 'row' },
        H('input', { type: 'text', value: r[0], 'aria-label': 'Label ' + (i + 1), on: { input: e => { r[0] = e.target.value; changed(); refreshMs(); } } }),
        H('input', { type: 'text', value: r[1], inputMode: 'decimal', 'aria-label': 'Value ' + (i + 1), on: { input: e => { r[1] = e.target.value; changed(); } } }),
        H('button', { className: 'icon', title: 'Remove row', 'aria-label': 'Remove row ' + (i + 1), textContent: '×', on: { click: () => { if (cfg.rows.length > 2) { cfg.rows.splice(i, 1); changed(); formClassic(root, cfg, changed); } } } }))));
    };
    drawRows();
    const pasteBox = H('textarea', { className: 'mono', rows: 4, placeholder: 'Paste two columns from Excel, e.g.\n2019\t52\n2020\t61' });
    const pasteMsg = H('span', { className: 'hint' });
    const s2 = H('section', { className: 'card' }, H('h3', {}, 'Data'),
      H('div', { className: 'rowhead' }, H('span', {}, 'Label'), H('span', {}, 'Value'), H('span', {})), tbody,
      H('div', { className: 'btnrow' },
        H('button', { textContent: 'Add row', on: { click: () => { cfg.rows.push(['', '']); changed(); formClassic(root, cfg, changed); } } }),
        H('button', { textContent: 'Reverse order', on: { click: () => { cfg.rows.reverse(); changed(); formClassic(root, cfg, changed); } } })),
      H('details', {}, H('summary', {}, 'Paste from a spreadsheet'), pasteBox,
        H('div', { className: 'btnrow' }, H('button', { textContent: 'Use pasted data', on: { click: () => {
          const lines = pasteBox.value.split(/\r?\n/).map(l => l.split(/\t|,(?=\s*-?[\d£$€.])|;/).map(s => s.trim())).filter(a => a.length >= 2 && a[0] !== '');
          const good = lines.filter(a => isFinite(parseFloat(a[1].replace(/[^0-9.\-]/g, ''))));
          if (good.length < 2) { pasteMsg.textContent = 'Couldn\'t find two columns of labels and numbers. Copy the two columns straight from Excel.'; return; }
          cfg.rows = good.map(a => [a[0], a[1].replace(/[^0-9.\-]/g, '')]); changed(); formClassic(root, cfg, changed);
        } } })), pasteMsg));

    const s3 = H('section', { className: 'card' }, H('h3', {}, 'Numbers'),
      H('div', { className: 'grid2' }, field('Before number', txt(cfg.prefix, v => set('prefix', v), '£')), field('After number', txt(cfg.suffix, v => set('suffix', v), '%'))),
      H('div', { className: 'grid2' }, field('Decimal places', sel(cfg.decimals, [['auto', 'Match my data'], ['0', '0'], ['1', '1'], ['2', '2']], v => set('decimals', v))),
        cfg.type === 'line' ? field('Axis starts at zero', sel(cfg.zeroBase ? '1' : '0', [['0', 'No, fit the data'], ['1', 'Yes']], v => set('zeroBase', v === '1'))) : H('span')),
      H('div', { className: 'grid2' }, field(cfg.type === 'bar' ? 'Bar colour' : 'Line colour', sel(cfg.colour, colOpts, v => set('colour', v))), field('Highlight colour', sel(cfg.hlColour, colOpts, v => set('hlColour', v)))),
      field('Counter tag', sel(cfg.counter ? '1' : '0', [['1', 'Show the running number'], ['0', 'Hide']], v => set('counter', v === '1'))));

    const msWrap = H('div', { className: 'ms' });
    function refreshMs() {
      msWrap.innerHTML = '';
      (Array.isArray(cfg.milestones) ? cfg.milestones : []).forEach((m, i) => m && typeof m === 'object' && msWrap.append(H('div', { className: 'msrow' },
        H('input', { type: 'checkbox', checked: m.on, 'aria-label': 'Show milestone ' + (i + 1), on: { change: e => { m.on = e.target.checked; changed(); } } }),
        H('select', { 'aria-label': 'Milestone point', on: { change: e => { m.idx = +e.target.value; changed(); } } }, ...cfg.rows.map((r, j) => H('option', { value: j, selected: j === m.idx, textContent: r[0] || ('Point ' + (j + 1)) }))),
        H('input', { type: 'text', value: m.caption, placeholder: 'Caption (optional)', on: { input: e => { m.caption = e.target.value; changed(); } } }),
        H('button', { className: 'icon', textContent: '×', title: 'Remove milestone', 'aria-label': 'Remove milestone ' + (i + 1), on: { click: () => { cfg.milestones.splice(i, 1); changed(); refreshMs(); } } }))));
      if (!Array.isArray(cfg.milestones) || cfg.milestones.length < 3) msWrap.append(H('button', { textContent: 'Add milestone arrow', on: { click: () => { if (!Array.isArray(cfg.milestones)) cfg.milestones = []; cfg.milestones.push({ on: true, idx: Math.floor(cfg.rows.length / 2), caption: '' }); changed(); refreshMs(); } } }));
    }
    refreshMs();
    const s4 = H('section', { className: 'card' }, H('h3', {}, 'Milestone arrows'), H('p', { className: 'hint' }, 'Up to three. The chart slows down as it reaches each one, the arrow flies in and the caption pops up.'), msWrap);

    const s5 = H('section', { className: 'card' }, H('h3', {}, 'Animation'),
      H('div', { className: 'grid2' }, field('Speed', sel(cfg.speed, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], v => set('speed', v))),
        field('Camera', sel(cfg.camera ? '1' : '0', [['1', 'Follow the action'], ['0', 'Locked off']], v => set('camera', v === '1')))),
      H('div', { className: 'grid2' }, field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v))),
        field('End animation', sel(cfg.ending, [['none', 'None, just hold'], ['explode', 'Explosion'], ['fly', 'Flies off screen']], v => set('ending', v, true)))),
      cfg.ending === 'explode' ? field('Explosion text', txt(cfg.endText, v => set('endText', v), 'Optional, e.g. BOOM')) : '');
    const s0 = H('section', { className: 'card ck-old' }, H('h3', {}, 'An older chart'), H('p', { className: 'hint' }, 'This chart was made before the new charts, so it is drawn exactly as it was. Bring it up to date to get the new kinds of chart, looks and animation (its timing may change a little).'), H('div', { className: 'btnrow' }, H('button', { className: 'primary', textContent: 'Bring it up to date', on: { click: () => { upgrade(cfg); changed(); form(root, cfg, changed); } } })));
    root.append(s0, s1, s2, s3, s4, s5);
  }

  /* ---- The panel for the kit's charts ----
     Pick a kind from the tiles, type (or paste) the table, and every option that applies to that kind is in plain sight;
     options that do not apply to it are not shown at all. */
  const ICON = {
    bar: '<rect x="3" y="11" width="5" height="9"/><rect x="11" y="5" width="5" height="15"/><rect x="19" y="8" width="5" height="12"/>',
    hbar: '<rect x="3" y="3" width="20" height="4"/><rect x="3" y="10" width="14" height="4"/><rect x="3" y="17" width="8" height="4"/>',
    grouped: '<rect x="2" y="9" width="4" height="11"/><rect x="7" y="5" width="4" height="15" opacity=".55"/><rect x="15" y="12" width="4" height="8"/><rect x="20" y="7" width="4" height="13" opacity=".55"/>',
    stacked: '<rect x="3" y="12" width="5" height="8"/><rect x="3" y="6" width="5" height="5" opacity=".55"/><rect x="11" y="10" width="5" height="10"/><rect x="11" y="3" width="5" height="6" opacity=".55"/><rect x="19" y="14" width="5" height="6"/><rect x="19" y="8" width="5" height="5" opacity=".55"/>',
    line: '<path d="M3 18 L9 11 L14 14 L23 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    area: '<path d="M3 20 L3 15 L9 9 L14 12 L23 4 L23 20 Z" opacity=".6"/><path d="M3 15 L9 9 L14 12 L23 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    pie: '<path d="M13 12 L13 2 A10 10 0 0 1 22.5 15 Z"/><path d="M13 12 L22.5 15 A10 10 0 1 1 13 2 Z" opacity=".55"/>',
    donut: '<path d="M13 2 A10 10 0 0 1 22.5 15 L18.2 13.6 A5.5 5.5 0 0 0 13 6.5 Z"/><path d="M22.5 15 A10 10 0 1 1 13 2 L13 6.5 A5.5 5.5 0 1 0 18.2 13.6 Z" opacity=".55"/>',
    race: '<rect x="3" y="3" width="13" height="4"/><rect x="3" y="10" width="19" height="4"/><rect x="3" y="17" width="8" height="4"/><path d="M19 3 l3 2 l-3 2 Z"/>',
    number: '<text x="13" y="18" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="16">42</text>',
    percent: '<rect x="2" y="9" width="22" height="6" rx="3" opacity=".4"/><rect x="2" y="9" width="14" height="6" rx="3"/>',
  };
  const { H: UH, field: Ufield, sel: Usel, txt: Utxt } = UI;
  function form(root, cfg, changed) {
    if (classic(cfg)) return formClassic(root, cfg, changed);
    const keep = root.scrollTop; root.innerHTML = ''; const K = ChartKit, T = K.TYPES[cfg.type] || K.TYPES.bar, type = K.TYPES[cfg.type] ? cfg.type : 'bar';
    const redo = () => { form(root, cfg, changed); root.scrollTop = keep; }, set = (k, v, re) => { cfg[k] = v; changed(); if (re) redo(); };
    const yn = (k, yes = 'Yes', no = 'No', re) => Usel(cfg[k] ? '1' : '0', [['1', yes], ['0', no]], v => set(k, v === '1', re));
    const nS = () => Math.max(1, (cfg.series || []).length), manyCols = T.many || type === 'number';
    // the table as it is edited: kept square, with the highlights, colours and callouts following their rows
    const square = () => { if (!Array.isArray(cfg.series) || !cfg.series.length) cfg.series = [{ name: '', colour: cfg.colour || 'Irn-Bru orange' }]; if (!Array.isArray(cfg.rows)) cfg.rows = []; const w = 1 + cfg.series.length; cfg.rows = cfg.rows.filter(Array.isArray).map(r => { const o = r.slice(0, w).map(x => String(x ?? '')); while (o.length < w) o.push(''); return o; }); cfg.rowHl = cfg.rows.map((r, i) => (Array.isArray(cfg.rowHl) && cfg.rowHl[i]) ? 1 : 0); cfg.rowCol = cfg.rows.map((r, i) => (Array.isArray(cfg.rowCol) && typeof cfg.rowCol[i] === 'string') ? cfg.rowCol[i] : ''); if (!Array.isArray(cfg.milestones)) cfg.milestones = []; };
    const permute = ord => { square(); const R = cfg.rows, Hh = cfg.rowHl, Cc = cfg.rowCol; cfg.rows = ord.map(i => R[i]); cfg.rowHl = ord.map(i => Hh[i]); cfg.rowCol = ord.map(i => Cc[i]); cfg.milestones = cfg.milestones.filter(m => ord.includes(+m.idx)); cfg.milestones.forEach(m => { m.idx = ord.indexOf(+m.idx); }); };
    const total = r => { let s = 0; for (let j = 1; j < r.length; j++) { const v = K.num(r[j]); if (isFinite(v)) s += v; } return s; };
    const isExample = () => Object.values(K.EXAMPLES).some(ex => JSON.stringify(ex.rows) === JSON.stringify(cfg.rows));
    const useExample = k => { const ex = clone(K.EXAMPLES[k]); Object.assign(cfg, { title: ex.title, sub: ex.sub, source: ex.source, prefix: ex.prefix, suffix: ex.suffix, series: ex.series, rows: ex.rows, rowHl: ex.rowHl || [], rowCol: [], milestones: ex.milestones || [], sort: ex.sort || 'none' }); delete cfg.timing; };
    const setType = k => { const was = isExample(); cfg.type = k; if (was) useExample(k); if (cfg.ending !== 'none' && cfg.ending !== 'out') cfg.ending = 'none'; delete cfg.timing; changed(); redo(); };

    // 1. what kind, which look, and the words on it
    const tiles = UH('div', { className: 'ck-types', role: 'radiogroup', 'aria-label': 'Kind of chart' }, ...Object.keys(K.TYPES).map(k => { const b = UH('button', { type: 'button', className: 'ck-type' + (k === type ? ' on' : ''), title: K.TYPES[k].name + ': ' + K.TYPES[k].what, role: 'radio', 'aria-checked': k === type ? 'true' : 'false', on: { click: () => setType(k) } }); b.innerHTML = '<svg viewBox="0 0 26 23" aria-hidden="true">' + ICON[k] + '</svg><span></span>'; b.lastChild.textContent = K.TYPES[k].tile || K.TYPES[k].name; b.dataset.type = k; return b; }));
    const seg = (k, opts) => UH('div', { className: 'ck-seg', role: 'radiogroup' }, ...opts.map(([v, l]) => UH('button', { type: 'button', className: String(cfg[k]) === String(v) ? 'on' : '', textContent: l, role: 'radio', 'aria-checked': String(cfg[k]) === String(v) ? 'true' : 'false', on: { click: () => set(k, v, true) } })));
    const s1 = UH('section', { className: 'card' }, UH('h3', {}, 'Chart'), tiles, Ufield('Look', seg('style', [['sleek', 'Sleek dark'], ['light', 'Clean light'], ['comic', 'Cartoon']])),
      Ufield('Title', Utxt(cfg.title, v => set('title', v), 'The headline across the top')), Ufield('Line under the title', Utxt(cfg.sub, v => set('sub', v), 'Optional, e.g. what the numbers are')), Ufield('Source', Utxt(cfg.source, v => set('source', v), 'Optional, e.g. Source: ONS')));

    // 2. the table
    const colourDot = (now, pick, auto, aria) => { const hex = K.hx(now), b = UH('button', { type: 'button', className: 'ck-dot' + (hex ? '' : ' auto'), title: aria, 'aria-label': aria }); if (hex) b.style.background = hex;
      b.addEventListener('click', ev => { ev.stopPropagation(); document.querySelectorAll('.ck-pop').forEach(x => x.remove()); const pop = UH('div', { className: 'ck-pop', role: 'menu' }, ...(auto ? [UH('button', { type: 'button', className: 'ck-dot auto', title: 'Automatic', 'aria-label': 'Automatic colour', on: { click: () => pick('') } })] : []), ...Object.keys(E.COLOURS).map(n => { const d = UH('button', { type: 'button', className: 'ck-dot', title: n, 'aria-label': n, on: { click: () => pick(n) } }); d.style.background = E.COLOURS[n]; return d; }));
        b.parentNode.append(pop); const off = e2 => { if (!pop.contains(e2.target)) { pop.remove(); document.removeEventListener('pointerdown', off, true); } }; document.addEventListener('pointerdown', off, true); }); return b; };
    const ownColours = !T.many || T.time, S = Array.isArray(cfg.series) && cfg.series.length ? cfg.series : [{ name: '', colour: cfg.colour }], w = S.length, rowsNow = Array.isArray(cfg.rows) ? cfg.rows.filter(Array.isArray) : [];
    const grid = UH('div', { className: 'ck-table', role: 'table' }); const nc = manyCols ? w : 1; grid.style.gridTemplateColumns = `24px minmax(${nc > 2 ? 92 : 80}px,1.6fr) repeat(${nc},minmax(${nc > 1 ? 74 : 64}px,1fr)) 26px 26px`; grid.style.minWidth = (24 + (nc > 2 ? 92 : 80) + nc * (nc > 1 ? 74 : 64) + 52 + (nc + 3) * 4) + 'px';
    const cell = (r, c, ph, aria) => { const inp = UH('input', { type: 'text', value: rowsNow[r] ? String(rowsNow[r][c] ?? '') : '', placeholder: ph, 'aria-label': aria, inputMode: c ? 'decimal' : 'text', className: c ? 'ck-num' : '' }); inp.dataset.r = r; inp.dataset.c = c;
      inp.addEventListener('input', () => { square(); cfg.rows[r][c] = inp.value; changed(); if (!c) refreshCall(); }); return inp; };
    // head: the names of the number columns, each with its colour
    grid.append(UH('span', {}), UH('span', { className: 'ck-h', textContent: T.time ? 'Runner' : 'Name' }));
    for (let j = 0; j < (manyCols ? w : 1); j++) { const sj = S[j] || {}, hd = UH('div', { className: 'ck-colh' });
      if (manyCols) { const ni = UH('input', { type: 'text', value: sj.name ?? '', placeholder: T.time ? 'When' : type === 'number' ? (j ? 'Before' : 'Now') : 'Column ' + (j + 1), 'aria-label': 'Name of number column ' + (j + 1), on: { input: e => { square(); cfg.series[j].name = e.target.value; changed(); } } }); ni.dataset.r = -1; ni.dataset.c = j + 1; hd.append(ni);
        const tools = UH('div', { className: 'ck-colt' }); hd.classList.add('two'); hd.append(tools);
        if (!T.time && type !== 'number') tools.append(colourDot(sj.colour || K.PAL[j % K.PAL.length], n => { square(); cfg.series[j].colour = n || K.PAL[j % K.PAL.length]; changed(); redo(); }, false, 'Colour of column ' + (j + 1))); else tools.append(UH('span', {}));
        if (w > 1) tools.append(UH('button', { type: 'button', className: 'ck-x', textContent: '×', title: 'Remove this column', 'aria-label': 'Remove column ' + (j + 1), on: { click: () => { square(); if (cfg.series.length < 2) return; cfg.series.splice(j, 1); cfg.rows.forEach(r => r.splice(j + 1, 1)); changed(); redo(); } } })); }
      else { hd.append(UH('span', { className: 'ck-h', textContent: 'Number' })); if (type === 'line' || type === 'area') hd.append(colourDot(sj.colour || cfg.colour, n => { square(); cfg.series[0].colour = n || 'Irn-Bru orange'; changed(); redo(); }, false, 'Colour of the line')); }
      grid.append(hd); }
    grid.append(UH('span', { className: 'ck-h', title: 'Highlight', textContent: '★' }), UH('span', {}));
    rowsNow.forEach((r, i) => { const hlOn = !!(Array.isArray(cfg.rowHl) && cfg.rowHl[i]);
      grid.append(ownColours && type !== 'line' && type !== 'area' && type !== 'number' ? colourDot(Array.isArray(cfg.rowCol) ? cfg.rowCol[i] : '', n => { square(); cfg.rowCol[i] = n; changed(); redo(); }, true, 'Colour of row ' + (i + 1) + ' (automatic unless you pick one)') : UH('span', { className: 'ck-n', textContent: String(i + 1) }));
      grid.append(cell(i, 0, 'Name', 'Name of row ' + (i + 1))); for (let j = 0; j < (manyCols ? w : 1); j++) grid.append(cell(i, j + 1, '0', 'Number, row ' + (i + 1) + (w > 1 ? ', column ' + (j + 1) : '')));
      grid.append(UH('button', { type: 'button', className: 'ck-hl' + (hlOn ? ' on' : ''), textContent: hlOn ? '★' : '☆', title: 'Highlight this row in the highlight colour', 'aria-label': 'Highlight row ' + (i + 1), 'aria-pressed': hlOn ? 'true' : 'false', on: { click: () => { square(); cfg.rowHl[i] = cfg.rowHl[i] ? 0 : 1; changed(); redo(); } } }),
        UH('button', { type: 'button', className: 'ck-x', textContent: '×', title: 'Remove this row', 'aria-label': 'Remove row ' + (i + 1), on: { click: () => { if (rowsNow.length <= 1) return; permute(rowsNow.map((q, k) => k).filter(k => k !== i)); changed(); redo(); } } })); });
    /* Pasting straight into the table, as in a spreadsheet: a block of cells copied from Excel lands from the box it is
       pasted into, making rows and columns as it needs them. Pasted into the first name box, a top line of words is taken
       as the column names. */
    const readGrid = text => String(text).replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').map(l => (l.includes('\t') ? l.split('\t') : l.split(/;|,(?=\s*[-£$€]?\s*\.?\d)/)).map(x => x.trim()));
    const cleanNum = x => { const m = String(x).replace(/[, ](?=\d{3}\b)/g, '').match(/-?\d*\.?\d+/); return m ? m[0] : ''; };
    const putGrid = (G, r0, c0) => { square(); const numeric = row => row.slice(1).some(x => cleanNum(x) !== '' && /\d/.test(x) && !/^[A-Za-z]/.test(x));
      let head = null; if (r0 <= 0 && c0 === 0 && G.length > 1 && !numeric(G[0]) && numeric(G[1])) head = G.shift(); if (r0 < 0) r0 = 0;
      const needC = c0 + Math.max(...G.map(g => g.length)), canC = manyCols ? Math.min(needC, 13) : Math.min(needC, 2); while (cfg.series.length + 1 < canC) { cfg.series.push({ name: '', colour: K.PAL[cfg.series.length % K.PAL.length] }); cfg.rows.forEach(r => r.push('')); }
      if (head) head.slice(1).forEach((nm, j) => { if (cfg.series[c0 + j]) cfg.series[c0 + j].name = nm; });
      G.forEach((g, i) => { const r = r0 + i; while (cfg.rows.length <= r) { cfg.rows.push(Array(1 + cfg.series.length).fill('')); cfg.rowHl.push(0); cfg.rowCol.push(''); } g.forEach((x, j) => { const c = c0 + j; if (c < cfg.rows[r].length) cfg.rows[r][c] = c === 0 ? x : cleanNum(x); }); });
      if (r0 === 0 && c0 === 0 && G.length < cfg.rows.length && G.length >= 2) permute(cfg.rows.map((q, k) => k).slice(0, G.length)); };   // a whole table pasted at the top replaces the old one
    grid.addEventListener('paste', e => { const tx = (e.clipboardData || window.clipboardData).getData('text'); if (!/[\t\n]/.test(tx.trim())) return; const tg = e.target; if (!tg || tg.dataset.r === undefined) return; e.preventDefault(); putGrid(readGrid(tx), +tg.dataset.r, +tg.dataset.c); changed(); redo(); });
    const addCol = manyCols && w < 12 && !(type === 'number' && w >= 2) ? UH('button', { type: 'button', textContent: T.time ? '+ Moment' : '+ Column', title: T.time ? 'Add the next moment in time' : 'Add another column of numbers', on: { click: () => { square(); cfg.series.push({ name: '', colour: K.PAL[cfg.series.length % K.PAL.length] }); cfg.rows.forEach(r => r.push('')); changed(); redo(); } } }) : '';
    const pasteBox = UH('textarea', { className: 'mono', rows: 4, placeholder: 'Copy the cells in Excel or Google Sheets (with their headings if you like) and paste them here' }), pasteMsg = UH('span', { className: 'hint' });
    const need = (type === 'grouped' || type === 'stacked' || type === 'race') && w < 2;
    const s2 = UH('section', { className: 'card' }, UH('h3', {}, 'Data'), UH('p', { className: 'ck-what' }, T.what),
      need ? UH('p', { className: 'ck-note' }, type === 'race' ? 'A race needs a column for each moment in time. Add moments, or fill it with an example to see how it is laid out.' : 'This kind of chart needs more than one column of numbers. Add a column, or fill it with an example to see how it is laid out.') : '',
      UH('div', { className: 'ck-scroll' }, grid),
      UH('div', { className: 'btnrow' }, UH('button', { type: 'button', textContent: '+ Row', on: { click: () => { square(); cfg.rows.push(Array(1 + cfg.series.length).fill('')); cfg.rowHl.push(0); cfg.rowCol.push(''); changed(); redo(); const b = root.querySelectorAll('.ck-table input[data-c="0"]'); if (b.length) b[b.length - 1].focus(); } } }), addCol,
        !T.time || type === 'race' ? UH('button', { type: 'button', textContent: 'Biggest first', title: 'Put the rows in order, biggest at the top', on: { click: () => { square(); permute(cfg.rows.map((r, i) => i).sort((a, b) => total(cfg.rows[b]) - total(cfg.rows[a]))); changed(); redo(); } } }) : '',
        UH('button', { type: 'button', textContent: 'Reverse', title: 'Turn the order of the rows round', on: { click: () => { square(); permute(cfg.rows.map((r, i) => i).reverse()); changed(); redo(); } } }),
        UH('button', { type: 'button', textContent: 'Fill with an example', title: 'Swap the table for an example of this kind of chart (Undo brings yours back)', on: { click: () => { useExample(type); changed(); redo(); } } })),
      UH('details', {}, UH('summary', {}, 'Paste a whole table from a spreadsheet'), UH('p', { className: 'hint' }, 'You can also click a box in the table above and paste straight into it.'), pasteBox,
        UH('div', { className: 'btnrow' }, UH('button', { type: 'button', textContent: 'Use this table', on: { click: () => { const G = readGrid(pasteBox.value); if (G.length < 2 || Math.max(...G.map(g => g.length)) < 2) { pasteMsg.textContent = 'That needs at least two rows and two columns: names down the side, numbers beside them.'; return; } square(); cfg.rows = []; cfg.rowHl = []; cfg.rowCol = []; cfg.milestones = []; if (manyCols) cfg.series = cfg.series.slice(0, 1); putGrid(G, 0, 0); changed(); redo(); } } }), pasteMsg)));

    // 3. numbers and what is written on the chart
    const labelOpts = type === 'pie' || type === 'donut' ? [['auto', 'Percentages'], ['value', 'The amounts'], ['none', 'Nothing']] : type === 'stacked' ? [['auto', 'The totals'], ['all', 'Totals and every slice'], ['none', 'Nothing']] : [['auto', 'Shown'], ['none', 'Hidden']];
    const s3 = UH('section', { className: 'card' }, UH('h3', {}, 'Numbers'),
      UH('div', { className: 'grid2' }, Ufield('Before each number', Utxt(cfg.prefix, v => set('prefix', v), '£')), Ufield('After each number', Utxt(cfg.suffix, v => set('suffix', v), '%, m, k'))),
      UH('div', { className: 'grid2' }, Ufield('Decimal places', Usel(cfg.decimals, [['auto', 'As typed'], ['0', '0'], ['1', '1'], ['2', '2']], v => set('decimals', v))), Ufield('Big numbers', yn('short', 'Shortened (1.2m, 45k)', 'In full'))),
      UH('div', { className: 'grid2' }, type !== 'race' && type !== 'number' ? Ufield('Numbers on the chart', Usel(cfg.labels === 'percent' ? 'auto' : (cfg.labels || 'auto'), labelOpts, v => set('labels', v))) : '',
        type === 'line' ? Ufield('Scale starts at zero', yn('zeroBase', 'Yes', 'No, fit the data')) : '', type === 'percent' ? Ufield('Out of', Utxt(cfg.outOf, v => set('outOf', v), '100')) : '', type === 'number' ? Ufield('Counts up from', Utxt(cfg.from, v => set('from', v), '0')) : '',
        (type === 'bar' || type === 'line' || type === 'area') && w === 1 ? Ufield('Running number', yn('counter', 'Shown beside the title', 'Hidden')) : '', type === 'race' ? Ufield('Bars on screen', Usel(String(cfg.top || 8), [4, 5, 6, 8, 10, 12].map(v => [String(v), 'Top ' + v]), v => set('top', +v))) : ''));

    // 4. colours and extras
    const hasScale = T.axis || type === 'hbar' || type === 'percent', hlDot = UH('div', { className: 'ck-colh' }, colourDot(cfg.hlColour, n => set('hlColour', n || 'Neon red', true), false, 'Highlight colour'), UH('span', { className: 'hint', textContent: 'Rows with a star, and bars with a callout' }));
    const s4 = UH('section', { className: 'card' }, UH('h3', {}, 'Extras'), Ufield('Highlight colour', hlDot),
      UH('div', { className: 'grid2' }, hasScale ? Ufield('Average line', yn('avg', 'Shown', 'Hidden')) : '', hasScale ? Ufield('A line of your own', yn('ref', 'Shown', 'Hidden', true)) : '', w > 1 && T.many && !T.time ? Ufield('Key to the colours', Usel(cfg.legend === false ? '0' : '1', [['1', 'Shown'], ['0', 'Hidden']], v => set('legend', v === '1'))) : '',
        type === 'donut' ? Ufield('In the middle', Usel(cfg.centre || 'total', [['total', 'The total'], ['top', 'The biggest (or starred) slice'], ['none', 'Nothing']], v => set('centre', v, true))) : '', type === 'donut' && (cfg.centre || 'total') === 'total' ? Ufield('Words under the total', Utxt(cfg.centreText, v => set('centreText', v), 'Total')) : ''),
      hasScale && cfg.ref ? UH('div', { className: 'grid2' }, Ufield('Where it sits', Utxt(cfg.refValue, v => set('refValue', v), 'A number on the scale')), Ufield('What it is called', Utxt(cfg.refLabel, v => set('refLabel', v), 'e.g. Target'))) : '');

    // 5. callouts
    const callWrap = UH('div', { className: 'ms' });
    function refreshCall() { callWrap.innerHTML = ''; const R = Array.isArray(cfg.rows) ? cfg.rows.filter(Array.isArray) : [], M = Array.isArray(cfg.milestones) ? cfg.milestones : [];
      M.forEach((m, i) => m && typeof m === 'object' && callWrap.append(UH('div', { className: 'msrow' }, UH('input', { type: 'checkbox', checked: !!m.on, 'aria-label': 'Show callout ' + (i + 1), on: { change: e => { m.on = e.target.checked; changed(); } } }),
        UH('select', { 'aria-label': 'What it points at', on: { change: e => { m.idx = +e.target.value; changed(); } } }, ...R.map((r, j) => UH('option', { value: j, selected: j === +m.idx, textContent: String(r[0] || '') || ('Row ' + (j + 1)) }))),
        UH('input', { type: 'text', value: m.caption ?? '', placeholder: 'A few words (optional)', 'aria-label': 'Callout words', on: { input: e => { m.caption = e.target.value; changed(); } } }),
        UH('button', { type: 'button', className: 'icon', textContent: '×', title: 'Remove this callout', 'aria-label': 'Remove callout ' + (i + 1), on: { click: () => { cfg.milestones.splice(i, 1); changed(); refreshCall(); } } }))));
      if (M.length < 3) callWrap.append(UH('button', { type: 'button', textContent: '+ Callout', on: { click: () => { if (!Array.isArray(cfg.milestones)) cfg.milestones = []; cfg.milestones.push({ on: true, idx: Math.max(0, Math.floor(R.length / 2)), caption: '' }); changed(); refreshCall(); } } })); }
    refreshCall();
    const s5 = type === 'race' || type === 'number' ? '' : UH('section', { className: 'card' }, UH('h3', {}, 'Callouts'), UH('p', { className: 'hint' }, 'Up to three. Each points at one row with a few words, as the chart reaches it, and the camera leans in.'), callWrap);

    // 6. how it moves
    const barKind = type === 'bar' || type === 'hbar' || type === 'grouped' || type === 'stacked' || type === 'percent', lineMany = (type === 'line' || type === 'area') && w > 1;
    const s6 = UH('section', { className: 'card' }, UH('h3', {}, 'Animation'),
      UH('div', { className: 'grid2' }, Ufield('Speed', Usel(cfg.speed, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], v => { delete cfg.timing; set('speed', v); })),
        barKind ? Ufield('They appear', Usel(cfg.order || 'rows', [['rows', 'In order'], ['big', 'Biggest first'], ['small', 'Smallest first'], ['together', 'All together']], v => set('order', v))) : lineMany ? Ufield('The lines draw', Usel(cfg.order === 'together' ? 'together' : 'rows', [['together', 'Together'], ['rows', 'One after another']], v => set('order', v))) : ''),
      UH('div', { className: 'grid2' }, Ufield('Camera', yn('camera', 'Moves in', 'Stays still')), Ufield('Hold at the end', Usel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v)))),
      Ufield('At the end', Usel(cfg.ending === 'out' ? 'out' : 'none', [['none', 'It stays on screen'], ['out', 'It leaves']], v => set('ending', v))), UH('p', { className: 'hint' }, 'Drag the ends of the bars on the timeline to set exactly how long the title and the chart take.'));
    root.append(s1, s2, s3, s4, ...(s5 ? [s5] : []), s6); root.scrollTop = keep;
  }

  const holdUpd = (cfg, ch) => { cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 2) / 2)); };
  const holdClip = (a, b) => ({ id: 'hold', start: a, end: b, label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' });
  const editor = { formIsScene: true,
    tracks(cfg, look) { if (!classic(cfg)) return ChartKit.tracks(cfg, look); const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), hs = p.drawEnd + p.pull;
      const out = [{ id: 'data', name: 'Chart', colour: p.col, items: [{ id: 'intro', start: 0, end: p.T0, label: 'Title', colour: '#3a4660', move: false, trim: 'end', minLen: 0.3, maxLen: 20, timed: true, title: 'Drag the right edge to show the title for longer before the data starts' }, { id: 'draw', start: p.T0, end: p.drawEnd, label: cfg.type === 'bar' ? 'Bars grow' : 'Line draws', colour: E.hexMix(p.col, '#16213a', 0.35), move: false, trim: 'end', minLen: 0.5, maxLen: 120, timed: true, title: 'Drag the right edge to draw the chart slower or quicker' }] }];
      if (p.ms.length) out.push({ id: 'ms', name: 'Milestones', colour: p.hlCol, items: p.ms.map((m, k) => ({ id: 'ms:' + k, start: p.reach[m.idx] - 0.45, end: p.reach[m.idx] + 0.55, label: m.caption || 'Milestone', colour: E.hexMix(p.hlCol, '#16213a', 0.4), move: false, trim: 'none' })) });
      out.push({ id: 'end', name: 'End', items: [holdClip(hs, hs + Math.max(0, Math.min(10, +cfg.hold || 0))), ...(cfg.ending && cfg.ending !== 'none' ? [{ id: 'ending', start: p.endStart, end: p.dur - 0.4, label: 'Ending', colour: '#6a2a2a', move: false, trim: 'none' }] : [])] });
      return out; },
    update(cfg, id, ch) { if (id === 'hold') holdUpd(cfg, ch); else if (id === 'intro' || id === 'draw') E.setTm(cfg, id, ch.end - ch.start); },
    scene(root, cfg, changed) { form(root, cfg, changed); } };
  const park = (cfg, look) => classic(cfg) ? duration(cfg, look) : ChartKit.park(cfg, look);
  return { id: 'charts', name: 'Charts', defaults, duration, draw, form, editor, legacy, upgrade, park };
})();

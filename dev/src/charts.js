/* Charts module: bar and line charts in the cartoon style. */
const Charts = (() => {
  const { cl, lerp, ease, spring, rng, fd, fl } = E;
  const SPEED = { slow: 6.6, normal: 4.8, fast: 3.2 };
  const END_DUR = { none: 0, explode: 2.0, fly: 1.8 };

  function defaults() {
    return {
      type: 'line', title: 'UK population, millions', source: 'Source: ONS mid year estimates, approximate',
      rows: [['1975', '56.2'], ['1980', '56.3'], ['1985', '56.6'], ['1990', '57.2'], ['1995', '58.0'], ['2000', '58.9'], ['2005', '60.4'], ['2010', '62.8'], ['2015', '65.1'], ['2020', '67.1'], ['2024', '69.3']],
      prefix: '', suffix: 'm', decimals: 'auto', zeroBase: false, colour: 'Irn-Bru orange', hlColour: 'Neon red',
      milestones: [{ on: true, idx: 5, caption: 'Growth takes off' }], counter: true, camera: true, speed: 'normal', hold: 2, ending: 'none', endText: '',
    };
  }

  // Everything that depends only on settings is computed once and cached.
  let cacheKey = '', cache = null;
  function plan(cfg, look, W, H) {
    const key = JSON.stringify(cfg) + look.format + W + 'x' + H + (E.fontVersion || 0);
    if (key === cacheKey) return cache;
    const u = Math.min(W, H) / 1080, tall = H > W;
    const rows = cfg.rows.map(r => [String(r[0]).trim(), parseFloat(String(r[1]).replace(/[^0-9.\-]/g, ''))]).filter(r => r[0] !== '' && isFinite(r[1]));
    if (rows.length < 2) rows.push(...[['A', 1], ['B', 2]].slice(rows.length));
    const L = rows.map(r => r[0]), V = rows.map(r => r[1]), n = V.length, bar = cfg.type === 'bar';
    const dec = cfg.decimals === 'auto' ? Math.min(2, Math.max(0, ...cfg.rows.map(r => ((String(r[1]).split('.')[1]) || '').replace(/[^0-9]/g, '').length))) : +cfg.decimals;
    let mn = Math.min(...V), mx = Math.max(...V);
    if (bar || cfg.zeroBase) { mn = Math.min(0, mn); mx = Math.max(0, mx); }
    const pad = (mx - mn) * 0.1 || Math.abs(mx) * 0.1 || 1;
    const msOn = (cfg.milestones || []).some(m => m.on);
    let lo = (bar || cfg.zeroBase) && mn >= 0 ? 0 : mn - pad, hi = mx + (bar && msOn ? (mx - mn) * 0.38 || pad : pad);
    const raw = (hi - lo) / (tall ? 5 : 4), mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw * 0.999);
    lo = Math.floor(lo / st + 1e-9) * st; hi = Math.ceil(hi / st - 1e-9) * st;
    const ticks = []; for (let v = lo; v <= hi + st * 1e-6; v += st) ticks.push(+v.toFixed(6));
    const fmt = v => cfg.prefix + Number(v).toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + cfg.suffix;
    const tfmt = v => cfg.prefix + Number(v).toLocaleString('en-GB', { maximumFractionDigits: Math.max(dec, st < 1 ? 1 : 0) }) + cfg.suffix;

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
    const ms = (cfg.milestones || []).filter(m => m.on && m.idx >= 0 && m.idx < n).map(m => ({ idx: +m.idx, caption: m.caption || '' }));
    // The title bar and the drawing bar can be dragged on the timeline to set their exact lengths
    const T0 = E.tm(cfg, 'intro') ?? 1.15, wantDraw = E.tm(cfg, 'draw');
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
    const pull = cfg.camera ? 1.3 : 0.3, endStart = drawEnd + pull + (+cfg.hold || 0), dur = endStart + END_DUR[cfg.ending || 'none'] + 0.4;
    const hlCol = E.COLOURS[cfg.hlColour] || '#e3302c', col = E.COLOURS[cfg.colour] || '#f5821f';
    cache = { u, tall, L, V, n, bar, dec, lo, hi, ticks, fmt, tfmt, titleY, P, A, X, Y, bandW, barW, every, ms, reach, map, T0, drawEnd, pull, endStart, dur, col, hlCol };
    cacheKey = key; return cache;
  }

  function duration(cfg, look) { const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; }
  function progLine(p, t) { if (t <= p.T0) return 0; const i = Math.min(p.map.length - 1, Math.floor((t - p.T0) * 240)); return p.map[i]; }
  function valAt(p, f) { const i = Math.min(p.n - 2, Math.floor(f)), u = f - i; return p.V[i] + (p.V[i + 1] - p.V[i]) * u; }

  const patCache = {};
  function areaPat(ctx, col, u) { const k = col + u; if (patCache[k]) return patCache[k]; const s = Math.max(8, Math.round(20 * u)), c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); g.globalAlpha = 0.3; g.fillStyle = col; g.fillRect(0, 0, s, s); g.globalAlpha = 0.45; g.fillStyle = '#7a3a06'; g.beginPath(); g.arc(s / 4, s / 4, s * 0.13, 0, 7); g.arc(s * 3 / 4, s * 3 / 4, s * 0.13, 0, 7); g.fill(); patCache[k] = ctx.createPattern(c, 'repeat'); return patCache[k]; }

  function draw(ctx, t, cfg, look, W, H) {
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
    if (cfg.title) { const hs = spring((t - 0.05) * 1.1, 6.5, 9); E.banner(ctx, cfg.title.toUpperCase(), W / 2, p.titleY, (p.tall ? 52 : 48) * u * fitScale(ctx, cfg.title.toUpperCase(), W * 0.86, (p.tall ? 52 : 48) * u), C.accent2, '#fff', C, (-2 - 6 * (1 - hs)) * Math.PI / 180, 0.6 + 0.4 * hs); }
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
    if (m.caption) { const bs = spring((uu - 0.5) * 1.2, 6.5, 9); if (bs > 0) { const cap = m.caption.toUpperCase(), fs = 40 * u * fitScale(ctx, cap, (p.A.x1 - p.A.x0) * 0.5, 40 * u); let bx = px + ux * 200 * u, by = py + uy * 175 * u; ctx.font = fd(fs); const bw = ctx.measureText(cap).width + fs; bx = cl(bx, p.A.x0 + bw / 2, p.A.x1 - bw / 2); by = cl(by, p.P.y0 + 60 * u, p.A.y1 - 40 * u); E.banner(ctx, cap, bx, by, fs, C.paper, C.ink, C, (-3 - 6 * (1 - bs)) * Math.PI / 180, 0.6 + 0.4 * bs); } }
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
      if (cfg.endText) { const txt = cfg.endText.toUpperCase(), fs = R * 0.36 * Math.min(1, 6 / Math.max(3, txt.length)); ctx.font = fd(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs * 0.14; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.strokeText(txt, cx, cy); ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy); }
      ctx.restore();
    }
    E.burst(ctx, cx, cy, 380 * u, (et - 0.05) / 0.5, C, u, 18);
  }

  function mix(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t)); return `rgb(${r},${g},${bl})`; }

  // Inputs form
  function form(root, cfg, changed) {
    root.innerHTML = '';
    const H = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => { if (k === 'on') Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn)); else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v); }); kids.flat().forEach(k => e.append(k)); return e; };
    const field = (label, ctrl, hint) => H('label', { className: 'field' }, H('span', { className: 'lab' }, label), ctrl, hint ? H('span', { className: 'hint' }, hint) : '');
    const sel = (val, opts, fn) => H('select', { on: { change: e => fn(e.target.value) } }, ...opts.map(([v, l]) => H('option', { value: v, selected: String(v) === String(val), textContent: l })));
    const txt = (val, fn, ph = '') => H('input', { type: 'text', value: val, placeholder: ph, on: { input: e => fn(e.target.value) } });
    const set = (k, v, rebuild) => { cfg[k] = v; changed(); if (rebuild) form(root, cfg, changed); };
    const colOpts = Object.keys(E.COLOURS).map(k => [k, k]);

    const s1 = H('section', { className: 'card' }, H('h3', {}, 'Chart'),
      field('Chart type', sel(cfg.type, [['line', 'Line chart'], ['bar', 'Bar chart']], v => set('type', v, true))),
      field('Title', txt(cfg.title, v => set('title', v), 'Shown in the red banner')),
      field('Source line', txt(cfg.source, v => set('source', v), 'Optional, e.g. Source: ONS')));

    const tbody = H('div', { className: 'rows' });
    const drawRows = () => {
      tbody.innerHTML = '';
      cfg.rows.forEach((r, i) => tbody.append(H('div', { className: 'row' },
        H('input', { type: 'text', value: r[0], 'aria-label': 'Label ' + (i + 1), on: { input: e => { r[0] = e.target.value; changed(); refreshMs(); } } }),
        H('input', { type: 'text', value: r[1], inputMode: 'decimal', 'aria-label': 'Value ' + (i + 1), on: { input: e => { r[1] = e.target.value; changed(); } } }),
        H('button', { className: 'icon', title: 'Remove row', 'aria-label': 'Remove row ' + (i + 1), textContent: '×', on: { click: () => { if (cfg.rows.length > 2) { cfg.rows.splice(i, 1); changed(); form(root, cfg, changed); } } } }))));
    };
    drawRows();
    const pasteBox = H('textarea', { className: 'mono', rows: 4, placeholder: 'Paste two columns from Excel, e.g.\n2019\t52\n2020\t61' });
    const pasteMsg = H('span', { className: 'hint' });
    const s2 = H('section', { className: 'card' }, H('h3', {}, 'Data'),
      H('div', { className: 'rowhead' }, H('span', {}, 'Label'), H('span', {}, 'Value'), H('span', {})), tbody,
      H('div', { className: 'btnrow' },
        H('button', { textContent: 'Add row', on: { click: () => { cfg.rows.push(['', '']); changed(); form(root, cfg, changed); } } }),
        H('button', { textContent: 'Reverse order', on: { click: () => { cfg.rows.reverse(); changed(); form(root, cfg, changed); } } })),
      H('details', {}, H('summary', {}, 'Paste from a spreadsheet'), pasteBox,
        H('div', { className: 'btnrow' }, H('button', { textContent: 'Use pasted data', on: { click: () => {
          const lines = pasteBox.value.split(/\r?\n/).map(l => l.split(/\t|,(?=\s*-?[\d£$€.])|;/).map(s => s.trim())).filter(a => a.length >= 2 && a[0] !== '');
          const good = lines.filter(a => isFinite(parseFloat(a[1].replace(/[^0-9.\-]/g, ''))));
          if (good.length < 2) { pasteMsg.textContent = 'Couldn\'t find two columns of labels and numbers. Copy the two columns straight from Excel.'; return; }
          cfg.rows = good.map(a => [a[0], a[1].replace(/[^0-9.\-]/g, '')]); changed(); form(root, cfg, changed);
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
      cfg.milestones.forEach((m, i) => msWrap.append(H('div', { className: 'msrow' },
        H('input', { type: 'checkbox', checked: m.on, 'aria-label': 'Show milestone ' + (i + 1), on: { change: e => { m.on = e.target.checked; changed(); } } }),
        H('select', { 'aria-label': 'Milestone point', on: { change: e => { m.idx = +e.target.value; changed(); } } }, ...cfg.rows.map((r, j) => H('option', { value: j, selected: j === m.idx, textContent: r[0] || ('Point ' + (j + 1)) }))),
        H('input', { type: 'text', value: m.caption, placeholder: 'Caption (optional)', on: { input: e => { m.caption = e.target.value; changed(); } } }),
        H('button', { className: 'icon', textContent: '×', title: 'Remove milestone', 'aria-label': 'Remove milestone ' + (i + 1), on: { click: () => { cfg.milestones.splice(i, 1); changed(); refreshMs(); } } }))));
      if (cfg.milestones.length < 3) msWrap.append(H('button', { textContent: 'Add milestone arrow', on: { click: () => { cfg.milestones.push({ on: true, idx: Math.floor(cfg.rows.length / 2), caption: '' }); changed(); refreshMs(); } } }));
    }
    refreshMs();
    const s4 = H('section', { className: 'card' }, H('h3', {}, 'Milestone arrows'), H('p', { className: 'hint' }, 'Up to three. The chart slows down as it reaches each one, the arrow flies in and the caption pops up.'), msWrap);

    const s5 = H('section', { className: 'card' }, H('h3', {}, 'Animation'),
      H('div', { className: 'grid2' }, field('Speed', sel(cfg.speed, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], v => set('speed', v))),
        field('Camera', sel(cfg.camera ? '1' : '0', [['1', 'Follow the action'], ['0', 'Locked off']], v => set('camera', v === '1')))),
      H('div', { className: 'grid2' }, field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v))),
        field('End animation', sel(cfg.ending, [['none', 'None, just hold'], ['explode', 'Explosion'], ['fly', 'Flies off screen']], v => set('ending', v, true)))),
      cfg.ending === 'explode' ? field('Explosion text', txt(cfg.endText, v => set('endText', v), 'Optional, e.g. BOOM')) : '');
    root.append(s1, s2, s3, s4, s5);
  }

  const holdUpd = (cfg, ch) => { cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 2) / 2)); };
  const holdClip = (a, b) => ({ id: 'hold', start: a, end: b, label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' });
  const editor = { formIsScene: true,
    tracks(cfg, look) { const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), hs = p.drawEnd + p.pull;
      const out = [{ id: 'data', name: 'Chart', colour: p.col, items: [{ id: 'intro', start: 0, end: p.T0, label: 'Title', colour: '#3a4660', move: false, trim: 'end', minLen: 0.3, maxLen: 20, timed: true, title: 'Drag the right edge to show the title for longer before the data starts' }, { id: 'draw', start: p.T0, end: p.drawEnd, label: cfg.type === 'bar' ? 'Bars grow' : 'Line draws', colour: E.hexMix(p.col, '#16213a', 0.35), move: false, trim: 'end', minLen: 0.5, maxLen: 120, timed: true, title: 'Drag the right edge to draw the chart slower or quicker' }] }];
      if (p.ms.length) out.push({ id: 'ms', name: 'Milestones', colour: p.hlCol, items: p.ms.map((m, k) => ({ id: 'ms:' + k, start: p.reach[m.idx] - 0.45, end: p.reach[m.idx] + 0.55, label: m.caption || 'Milestone', colour: E.hexMix(p.hlCol, '#16213a', 0.4), move: false, trim: 'none' })) });
      out.push({ id: 'end', name: 'End', items: [holdClip(hs, hs + (+cfg.hold || 0)), ...(cfg.ending && cfg.ending !== 'none' ? [{ id: 'ending', start: p.endStart, end: p.dur - 0.4, label: 'Ending', colour: '#6a2a2a', move: false, trim: 'none' }] : [])] });
      return out; },
    update(cfg, id, ch) { if (id === 'hold') holdUpd(cfg, ch); else if (id === 'intro' || id === 'draw') E.setTm(cfg, id, ch.end - ch.start); },
    scene(root, cfg, changed) { form(root, cfg, changed); } };
  return { id: 'charts', name: 'Charts', defaults, duration, draw, form, editor };
})();

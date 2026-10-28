/* Shared comic globe: projection, camera flights, land drawing, country highlights, pins and vehicles. */
const Globe = (() => {
  const { cl, lerp, ease, spring, fd, fl } = E;
  const SEA = { saltire: ['#3a7fe0', '#2f6dc8'], chalk: ['#2f6fb8', '#28609f'], studio: ['#2a63c4', '#2456aa'], bru: ['#2a6fd6', '#2460bb'], newsprint: ['#5f8fd0', '#5482bf'], charcoal: ['#2f69c6', '#285cad'] };
  const R0 = (W, H) => Math.min(W, H) * 0.4;
  function projection(W, H, cam) {
    const p = d3.geoOrthographic().clipAngle(90).clipExtent([[-30, -30], [W + 30, H + 30]]).precision(0.6).rotate([-cam.lon, -cam.lat, cam.roll || 0]).scale(R0(W, H) * cam.k).translate([W / 2, H / 2 + (cam.dy || 0)]); p._u = Math.min(W, H) / 1080; return p;
  }
  const prepCache = new Map();
  function prep(f) {
    if (!f) return null; if (prepCache.has(f)) return prepCache.get(f);
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; let best = polys[0], ba = -1;
    polys.forEach(p => { let a = d3.geoArea({ type: 'Polygon', coordinates: p }); if (a > 2 * Math.PI) a = 4 * Math.PI - a; if (a > ba) { ba = a; best = p; } });
    const bp = { type: 'Polygon', coordinates: best }, c = d3.geoCentroid(bp), tp = d3.geoOrthographic().rotate([-c[0], -c[1]]).scale(1).translate([0, 0]).clipAngle(90);
    const b = d3.geoPath(tp).bounds(bp), bw = Math.max(0.01, b[1][0] - b[0][0]), bh = Math.max(0.01, b[1][1] - b[0][1]);
    // Outline rings for the tracing animation, for both levels of detail so the trace always sits exactly on the coast being drawn
    const rings = feat => { const gg = feat.geometry, pp = gg.type === 'Polygon' ? [gg.coordinates] : gg.coordinates; let bb = pp[0], aa = -1;
      pp.forEach(p => { let a = d3.geoArea({ type: 'Polygon', coordinates: p }); if (a > 2 * Math.PI) a = 4 * Math.PI - a; if (a > aa) { aa = a; bb = p; } });
      const rr = bb[0], ll = [0]; for (let i = 1; i < rr.length; i++) ll.push(ll[i - 1] + d3.geoDistance(rr[i - 1], rr[i]));
      const others = pp.filter(p => p !== bb).map(p => { const r = p[0], l = [0]; for (let i = 1; i < r.length; i++) l.push(l[i - 1] + d3.geoDistance(r[i - 1], r[i])); return { ring: r, lens: l }; })
        .filter(o => o.lens[o.lens.length - 1] > 0.002 && d3.geoDistance(o.ring[0], c) < 0.5);
      return { ring: rr, lens: ll, others }; };
    // How far the country reaches from its centre, so the colour fill grows to cover all of it (Alaska, islands and all)
    let reach = 0; polys.forEach(p => p.forEach(r => r.forEach(q => { const dd = d3.geoDistance(q, c); if (dd > reach) reach = dd; })));
    const lo = f.name ? GeoData.findLo(f.name) : null, hi = rings(f), lr = lo && lo !== f ? rings(lo) : hi;
    const out = { f, lo: lo || f, c, bw, bh, reach: Math.min(reach, Math.PI / 2), ring: hi.ring, lens: hi.lens, others: hi.others, hiR: hi, loR: lr }; prepCache.set(f, out); return out;
  }
  function camForCountry(P, W, H, fill = 0.55) { return { lon: P.c[0], lat: P.c[1], k: cl(Math.min(W * fill / (P.bw * R0(W, H)), H * fill / (P.bh * R0(W, H))), 1.05, 16) }; }
  function camForPoints(pts, W, H, pad = 0.72) {
    if (!pts.length) return { lon: 0, lat: 20, k: 1 };
    if (pts.length === 1) return { lon: pts[0][0], lat: pts[0][1], k: 5 };
    const c = d3.geoCentroid({ type: 'MultiPoint', coordinates: pts }); let dmax = 0; pts.forEach(p => dmax = Math.max(dmax, d3.geoDistance(c, p)));
    const k = dmax >= Math.PI / 2 ? 1 : cl(pad / Math.sin(Math.max(0.02, dmax)) * (Math.min(W, H) / Math.min(W, H)), 1, 12);
    return { lon: c[0], lat: c[1], k };
  }
  // Smooth zoom and pan (van Wijk and Nuij): pulls out just enough on long hops, so the move reads as one continuous glide.
  const VIEW = 2.4;
  function flight(a, b) {
    const pa = [a.lon, a.lat], pb = [b.lon, b.lat], d = d3.geoDistance(pa, pb), gi = d3.geoInterpolate(pa, pb);
    const iz = d3.interpolateZoom([0, 0, VIEW / a.k], [d, 0, VIEW / b.k]), S = iz.duration / 1000;
    const dur = cl(1.0 + S * 0.9, 1.4, 4.2);
    return { dur, at: u => { const e = ease.sine(u), z = iz(e), f = d > 1e-6 ? z[0] / d : 0, c = d > 1e-6 ? gi(f) : pa; return { lon: c[0], lat: c[1], k: Math.max(0.85, VIEW / z[2]) }; } };
  }
  // Low pass filter on any camera path: averages position (on the sphere) and log zoom over a short window, removing kinks between moves.
  function smooth(fn, t, dur, win = 0.32) {
    const h = win / 5; let x = 0, y = 0, z = 0, lk = 0, ws = 0;
    for (let kk = Math.ceil((t - win) / h); kk <= Math.floor((t + win) / h); kk++) { const o = (kk * h - t) / win, w = Math.cos(o * Math.PI / 2) ** 2 + 1e-6, tt = cl(kk * h, 0, dur - 0.001), c = fn(tt), lo = c.lon * Math.PI / 180, la = c.lat * Math.PI / 180;
      x += Math.cos(la) * Math.cos(lo) * w; y += Math.cos(la) * Math.sin(lo) * w; z += Math.sin(la) * w; lk += Math.log(c.k) * w; ws += w; }
    return { lon: Math.atan2(y, x) * 180 / Math.PI, lat: Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI, k: Math.exp(lk / ws) };
  }
  const tileCache = {};
  function seaPat(ctx, cols, u) { const k = cols.join() + u; if (tileCache[k]) return tileCache[k]; const s = Math.max(8, Math.round(16 * u)), c = document.createElement('canvas'); c.width = c.height = s * 2; const g = c.getContext('2d'); g.fillStyle = cols[0]; g.fillRect(0, 0, s * 2, s * 2); g.fillStyle = cols[1]; [[s * 0.5, s * 0.5], [s * 1.5, s * 1.5]].forEach(q => { g.beginPath(); g.arc(q[0], q[1], s * 0.2, 0, 7); g.fill(); }); tileCache[k] = ctx.createPattern(c, 'repeat'); return tileCache[k]; }
  let fullDetail = false; const lowDetail = (proj, u) => !fullDetail && proj.scale() < 640 * u;
  // Level of detail for the full map: coastlines are simplified to the smallest wiggle you could actually see at this zoom,
  // and multi part countries are split so islands off screen are skipped. Built once per level, then reused every frame.
  const LODS = [0.2, 0.08, 0.035, 0.015], lodCache = new WeakMap();
  function dp(ring, tol) {
    const n = ring.length; if (n <= 8) return ring; const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const st = [[0, n - 1]], t2 = tol * tol;
    while (st.length) { const [a, b] = st.pop(); let md = -1, mi = -1; const ax = ring[a][0], ay = ring[a][1], dx = ring[b][0] - ax, dy = ring[b][1] - ay, L = dx * dx + dy * dy || 1e-12;
      for (let i = a + 1; i < b; i++) { const px = ring[i][0] - ax, py = ring[i][1] - ay, tq = Math.max(0, Math.min(1, (px * dx + py * dy) / L)), ex = px - tq * dx, ey = py - tq * dy, d = ex * ex + ey * ey; if (d > md) { md = d; mi = i; } }
      if (md > t2 && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(ring[i]); return out.length >= 4 ? out : ring;
  }
  // Simplifies a polygon but keeps the original wherever simplifying would flip a ring inside out
  function safeSimplify(p, lvl) { return p.map((r, i) => { const s = dp(r, lvl); if (s === r) return r; const a0 = d3.geoArea({ type: 'Polygon', coordinates: [r] }) > 2 * Math.PI, a1 = d3.geoArea({ type: 'Polygon', coordinates: [s] }) > 2 * Math.PI; return a0 === a1 ? s : r; }); }
  function lodOf(fc, tol) {
    let m = lodCache.get(fc); if (!m) { m = new Map(); lodCache.set(fc, m); }
    const lvl = tol === null ? 'full' : LODS.filter(l => l <= tol)[0] ?? 'full'; if (m.has(lvl)) return m.get(lvl);
    const feats = []; fc.features.forEach(f => { const g = f.geometry; if (!g) return; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      polys.forEach(p => feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: lvl === 'full' ? p : safeSimplify(p, lvl) } })); });
    const out = { type: 'FeatureCollection', features: feats }; m.set(lvl, out); return out;
  }
  const lodFor = (fc, proj) => lodOf(fc, 57.2958 / proj.scale() * 0.7);
  const featLod = new WeakMap();
  function featureLod(f, proj) { const tol = 57.2958 / proj.scale() * 0.7, lvl = LODS.filter(l => l <= tol)[0]; if (lvl === undefined) return f; let m = featLod.get(f); if (!m) { m = new Map(); featLod.set(f, m); } if (!m.has(lvl)) { const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; m.set(lvl, { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: polys.map(p => safeSimplify(p, lvl)) } }); } return m.get(lvl); }
  // Reuses last frame's projected outline when the globe has only zoomed or barely turned: zooming is exact as a plain scale,
  // and a turn this small moves nothing by more than a fraction of a pixel. Saves re-projecting thousands of coastline points.
  const pcache = new Map();
  function reusePath(slot, src, proj, geo) {
    const r = proj.rotate(), s = proj.scale(), tr = proj.translate(), c = pcache.get(slot);
    if (c && c.src === src && (r[2] || 0) === (c.r[2] || 0) && Math.abs(tr[0] - c.t[0]) < 1e-6 && Math.abs(tr[1] - c.t[1]) < 1e-6) {
      const dl = Math.abs(((r[0] - c.r[0]) % 360 + 540) % 360 - 180), dp = Math.abs(r[1] - c.r[1]), err = s * (dl + dp) * Math.PI / 180;
      if (err < 0.5) { const k = s / c.s, p = proj([-c.r[0], -c.r[1]]); if (p) return { path: c.path, m: [k, p[0] - c.t[0] * k, p[1] - c.t[1] * k] }; }
    }
    const path = new Path2D(); d3.geoPath(proj, path)(geo()); pcache.set(slot, { src, r: r.slice(), s, t: tr.slice(), path }); return { path, m: null };
  }
  const withM = (ctx, m, fn) => { if (!m) return fn(); ctx.save(); ctx.transform(m[0], 0, 0, m[0], m[1], m[2]); fn(m[0]); ctx.restore(); };
  function drawGlobe(ctx, W, H, proj, C, look, u) {
    const path = d3.geoPath(proj, ctx), [cx, cy] = proj.translate(), R = proj.scale(), land = GeoData.state.land;
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.arc(cx + R * 0.045 + 4 * u, cy + R * 0.045 + 4 * u, R, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.fillStyle = seaPat(ctx, SEA[look.scheme] || SEA.saltire, u); ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    // The lighter map is used for the preview, and in the export whenever the globe is small enough that the extra detail can't be seen
    // On the graphics chip the export always uses the full detail map, so the coastline never switches detail mid shot
    const st = GeoData.state, canGpu = look.gpu !== false && typeof GlobeGL !== 'undefined' && GlobeGL.available;
    const use = (look.preview || (!canGpu && lowDetail(proj, u))) && st.landLo ? st.landLo : (land || st.landLo);
    // Graphics chip first; the 2D drawing below is the fallback
    const gpu = !!(use && canGpu && GlobeGL.drawLand(ctx, use, proj, W, H, u, C)); fullDetail = !look.preview && gpu;
    if (!gpu) { ctx.beginPath(); path(d3.geoGraticule10()); ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1.2 * u; ctx.stroke(); }
    if (use && !gpu) {
      // Projected straight into a Path2D (no SVG text in between), once per frame, then reused for every pass
      const src = use === st.landLo ? use : lodFor(use, proj), { path: lp, m } = reusePath('land', src, proj, () => cull(src, proj, W, H)), k = m ? m[0] : 1;
      ctx.save(); ctx.translate(3 * u, 3 * u); withM(ctx, m, () => { ctx.fillStyle = 'rgba(6,13,26,0.5)'; ctx.fill(lp); }); ctx.restore();
      withM(ctx, m, () => { ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = 5 * u / k; ctx.stroke(lp); ctx.fillStyle = C.paper; ctx.fill(lp);
        ctx.strokeStyle = 'rgba(13,20,32,0.38)'; ctx.lineWidth = 1.2 * u / k; ctx.stroke(lp); });
    }
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.arc(cx - R * 0.22, cy - R * 0.24, R * 1.08, 0, 7, true); ctx.fillStyle = 'rgba(8,20,55,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - R * 0.48, cy - R * 0.52, R * 0.2, R * 0.11, -0.7, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    ctx.restore();
    return path;
  }
  // Skips countries that are behind the globe or off screen before projecting them.
  const boundCache = new WeakMap();
  function cull(fc, proj, W, H) {
    let b = boundCache.get(fc);
    if (!b) { b = fc.features.map(f => { const c = d3.geoCentroid(f); let r = 0; const walk = co => co.forEach(p => { if (typeof p[0] === 'number') { const d = d3.geoDistance(c, p); if (d > r) r = d; } else walk(p); }); walk(f.geometry.coordinates); return { f, c, r }; }); boundCache.set(fc, b); }
    const rot = proj.rotate(), ctr = [-rot[0], -rot[1]], R = proj.scale(), half = Math.hypot(W, H) / 2, view = R > half ? Math.asin(Math.min(1, half / R)) + 0.05 : Math.PI / 2;
    return { type: 'FeatureCollection', features: b.filter(o => d3.geoDistance(ctr, o.c) - o.r < view).map(o => o.f) };
  }
  function outline(ctx, W, H, proj, C, u) { const [cx, cy] = proj.translate(), R = proj.scale(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.stroke(); }
  function partial(ring, lens, t) { const goal = lens[lens.length - 1] * t, out = [ring[0]]; for (let i = 1; i < ring.length; i++) { if (lens[i] <= goal) out.push(ring[i]); else { const q = (goal - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1); out.push(d3.geoInterpolate(ring[i - 1], ring[i])(q)); break; } } return out; }
  const visible = (proj, p) => { const r = proj.rotate(); return d3.geoDistance(p, [-r[0], -r[1]]) < Math.PI / 2 - 0.02; };
  const dotsCache = {};
  function dotPat(ctx, u) { const k = 'd' + u; if (dotsCache[k]) return dotsCache[k]; const s = Math.max(8, Math.round(18 * u)), c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); g.fillStyle = 'rgba(90,30,0,0.26)'; g.beginPath(); g.arc(s / 4, s / 4, s * 0.12, 0, 7); g.arc(s * 3 / 4, s * 3 / 4, s * 0.12, 0, 7); g.fill(); dotsCache[k] = ctx.createPattern(c, 'repeat'); return dotsCache[k]; }
  // Draws a highlighted country: s = {trace, isles, fill, tfade, lift, alpha}
  function country(ctx, proj, P, s, col, C, u) {
    const path = d3.geoPath(proj, ctx), L = s.lift || 0, R = proj.scale(); ctx.save(); ctx.globalAlpha = s.alpha ?? 1;
    const need = s.fill > 0 || L > 0, cp = need ? new Path2D() : null, lowD = s.preview || lowDetail(proj, u); if (cp) d3.geoPath(proj, cp)(lowD ? P.lo : P.f);
    if (need) { ctx.save(); ctx.translate(L * 0.8 + 3 * u, L * 0.8 + 3 * u); ctx.fillStyle = C.shadow; ctx.globalAlpha = (s.alpha ?? 1) * cl(Math.max(s.fill, L / (14 * u)), 0, 1); ctx.fill(cp); ctx.restore(); }
    ctx.translate(-L * 0.4, -L * 0.6);
    if (L > 0) { ctx.fillStyle = C.paper; ctx.fill(cp); }
    if (s.fill > 0) {
      ctx.save(); ctx.clip(cp); const pc = proj(P.c) || proj.translate(), r = Math.max(Math.max(P.bw, P.bh) * 0.85, (P.reach || 0) * 1.1) * R * s.fill + 2;
      ctx.beginPath(); ctx.arc(pc[0], pc[1], r, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = dotPat(ctx, u); ctx.fill(); ctx.restore();
    }
    if (need) { ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke(cp); }
    if (s.trace > 0 && (s.tfade ?? 1) > 0) {
      ctx.globalAlpha = (s.alpha ?? 1) * (s.tfade ?? 1); ctx.strokeStyle = C.accent2; ctx.lineWidth = 7 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const RS = lowD ? P.loR : P.hiR, pr = partial(RS.ring, RS.lens, s.trace); ctx.beginPath(); path({ type: 'LineString', coordinates: pr }); ctx.stroke();
      if (s.isles > 0) RS.others.forEach(o => { ctx.beginPath(); path({ type: 'LineString', coordinates: partial(o.ring, o.lens, s.isles) }); ctx.stroke(); });
      const hd = pr[pr.length - 1]; if (s.trace < 1 && visible(proj, hd)) { const q = proj(hd); ctx.globalAlpha = s.alpha ?? 1; ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.arc(q[0], q[1], 11 * u, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.accent2; ctx.beginPath(); ctx.arc(q[0], q[1], 5 * u, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
  function screenBox(proj, P, preview) { const b = d3.geoPath(proj).bounds(preview || proj.scale() < 640 * (proj._u || 1) ? P.lo : P.f); return isFinite(b[0][0]) ? b : null; }
  function pin(ctx, x, y, size, col, C, u, drop) {
    if (drop <= 0) return; const fall = (1 - ease.out3(cl(drop * 1.6, 0, 1))) * -size * 3, sq = drop < 0.62 ? 1 : 1 + Math.sin(cl((drop - 0.62) / 0.38, 0, 1) * Math.PI) * 0.18;
    ctx.save(); ctx.globalAlpha = 0.35 * cl(drop * 2, 0, 1); ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(x + 4 * u, y + 2 * u, size * 0.32, size * 0.12, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x, y + fall); ctx.scale(1 / sq, sq);
    const s = size, body = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-s * 0.18, -s * 0.35, -s * 0.38, -s * 0.5, -s * 0.38, -s * 0.72); ctx.arc(0, -s * 0.72, s * 0.38, Math.PI, 0); ctx.bezierCurveTo(s * 0.38, -s * 0.5, s * 0.18, -s * 0.35, 0, 0); ctx.closePath(); };
    ctx.save(); ctx.translate(4 * u, 4 * u); body(); ctx.fillStyle = C.shadow; ctx.fill(); ctx.restore();
    body(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 4.5 * u; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.72, s * 0.15, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3.5 * u; ctx.stroke();
    ctx.restore();
  }
  function area(ctx, proj, lon, lat, km, col, C, u, prog) {
    if (prog <= 0) return; const path = d3.geoPath(proj, ctx), g = d3.geoCircle().center([lon, lat]).radius(km / 111.2 * ease.back(prog, 1.4)).precision(4)();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.beginPath(); path(g); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 0.7; ctx.fillStyle = dotPat(ctx, u); ctx.fill(); ctx.restore();
    ctx.save(); ctx.setLineDash([12 * u, 8 * u]); ctx.lineDashOffset = -prog * 60 * u; ctx.beginPath(); path(g); ctx.lineWidth = 4.5 * u; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.restore();
    const q = proj([lon, lat]); if (q && visible(proj, [lon, lat])) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(q[0], q[1], 6 * u, 0, 7); ctx.fill(); }
  }
  function label(ctx, text, x, y, C, u, prog, W, H, col) {
    if (!text || prog <= 0) return; const fs = (H > W ? 64 : 58) * u, T = text.toUpperCase(); ctx.font = fd(fs); const w = ctx.measureText(T).width + fs * 0.9, h = fs * 1.42;
    const bx = cl(x, w / 2 + 20 * u, W - w / 2 - 20 * u), by = cl(y, h / 2 + 150 * u, H - h / 2 - 30 * u);
    E.banner(ctx, T, bx, by, fs, col || C.accent2, '#fff', C, (-3 - 7 * (1 - prog)) * Math.PI / 180, 0.55 + 0.45 * prog);
  }
  // Places several labels around their anchor boxes without overlapping each other.
  // Places name labels next to their places. Every step is continuous (blends and gentle pushes, no jumping between spots),
  // so labels glide as the camera moves instead of hopping.
  // How much a label should show for a place: fades out smoothly as the place slides off screen or round the back of the globe.
  function labelFade(proj, pt, W, H, u) {
    const r = proj.rotate(), d = d3.geoDistance(pt, [-r[0], -r[1]]), back = 1 - cl((d - (Math.PI / 2 - 0.45)) / 0.4, 0, 1), q = proj(pt);
    const out = q ? Math.max(0, -q[0], q[0] - W, -q[1] + 150 * u, q[1] - H) : 1e9; return back * (1 - cl(out / (220 * u), 0, 1));
  }
  function placeLabels(ctx, items, W, H, u, C, col) {
    const live = items.filter(i => i.text && i.prog > 0), np = live.reduce((a, i) => a + Math.min(1, i.prog), 0), k = lerp(1, 0.8, ease.sine(cl(np - 3, 0, 1)));
    const fs = (H > W ? 64 : 58) * u * k, m = 20 * u, top = 150 * u, g = 22 * u, sstep = v => { v = cl(v, 0, 1); return v * v * (3 - 2 * v); };
    const L = live.map(it => { const T = it.text.toUpperCase(); ctx.font = fd(fs); const w = ctx.measureText(T).width + fs * 0.9, h = fs * 1.42, [[x0, y0], [x1, y1]] = it.box, cx = (x0 + x1) / 2;
      const below = y1 + g + h / 2, above = y0 - g - h / 2, flip = sstep((below + h / 2 - (H - m)) / h);
      return { T, w, h, prog: it.prog, a: it.alpha ?? 1, x: cl(cx, w / 2 + m, W - w / 2 - m), y: lerp(below, above, flip) }; });
    const clampY = p => { p.y = cl(p.y, top + p.h / 2, H - m - p.h / 2); };
    const clampX = p => { p.x = cl(p.x, p.w / 2 + m, W - p.w / 2 - m); };
    L.forEach(clampY); L.forEach(p => { p.y0 = p.y; p.x0 = p.x; });
    for (let it = 0; it < 30; it++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j], ox = (a.w + b.w) / 2 + 8 * u - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 + 6 * u - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) continue; const wa = cl(a.prog * 1.5, 0, 1), wb = cl(b.prog * 1.5, 0, 1), ka = 0.15 + 0.85 * wb, kb = 0.15 + 0.85 * wa;
      // Stack vertically when one place sits clearly above the other; when they're level, slide apart sideways instead, so nothing flips
      const sy = cl((b.y0 - a.y0) / (a.h * 0.6), -1, 1), sx = Math.abs(b.x0 - a.x0) < 1e-3 ? (i < j ? 1 : -1) * 0.2 : cl((b.x0 - a.x0) / (a.w * 0.3), -1, 1), vy = Math.abs(sy), py = oy * 0.6 * Math.min(1, ox / (20 * u)) * sy, px = ox * 0.6 * Math.min(1, oy / (20 * u)) * (1 - vy) * sx;
      a.y -= py * ka; b.y += py * kb; a.x -= px * ka; b.x += px * kb; clampY(a); clampY(b); clampX(a); clampX(b);
    }
    L.forEach((p, i) => { if (p.a <= 0.01) return; ctx.save(); ctx.globalAlpha *= p.a; E.banner(ctx, p.T, p.x, p.y, fs, col || C.accent2, '#fff', C, ((i % 2 ? 2 : -3) - 7 * (1 - p.prog)) * Math.PI / 180, 0.55 + 0.45 * p.prog); ctx.restore(); });
  }
  // Vehicles are drawn pointing right (+x) at the origin.
  function vehicle(ctx, kind, x, y, ang, size, C, u, t, col) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'dinghy') {
      const flip = Math.cos(ang) < 0 ? -1 : 1, bob = Math.sin(t * 9) * size * 0.05, rock = Math.sin(t * 7) * 0.08; ctx.translate(0, bob); ctx.rotate(rock); ctx.scale(flip, 1); const s = size;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const ph = ((t * 2.2 + i / 3) % 1); ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(-s * (0.6 + ph * 0.7), s * 0.18 + i * 3 * u); ctx.lineTo(-s * (0.9 + ph * 0.9), s * 0.18 + i * 3 * u); ctx.stroke(); } ctx.globalAlpha = 1;
      // Cartoon inflatable dinghy: chunky orange tube, dark cockpit, yellow side stripe and a rope along the side.
      const w = s * 1.45, h = s * 0.66, dep = s * 0.24, ink = C.ink;
      const shape = (sx, sy, ox, oy) => { const W2 = w * sx, H2 = h * sy; ctx.beginPath(); ctx.moveTo(ox - W2 * 0.42, oy - H2 * 0.5); ctx.bezierCurveTo(ox + W2 * 0.12, oy - H2 * 0.56, ox + W2 * 0.44, oy - H2 * 0.4, ox + W2 * 0.5, oy); ctx.bezierCurveTo(ox + W2 * 0.44, oy + H2 * 0.4, ox + W2 * 0.12, oy + H2 * 0.56, ox - W2 * 0.42, oy + H2 * 0.5); ctx.bezierCurveTo(ox - W2 * 0.57, oy + H2 * 0.46, ox - W2 * 0.57, oy - H2 * 0.46, ox - W2 * 0.42, oy - H2 * 0.5); ctx.closePath(); };
      const bot = (q, oy) => { const b = (a, b2, c, d) => (1 - q) ** 3 * a + 3 * (1 - q) ** 2 * q * b2 + 3 * (1 - q) * q * q * c + q ** 3 * d; return [b(w * 0.5, w * 0.44, w * 0.12, -w * 0.42), b(0, h * 0.4, h * 0.56, h * 0.5) + oy]; };
      ctx.lineJoin = 'round';
      ctx.save(); ctx.translate(5 * u, 7 * u); shape(1, 1, 0, dep); ctx.fillStyle = C.shadow; ctx.fill(); ctx.restore();
      // Side of the tube, with stripe and rope, mostly hidden behind the top later
      shape(1, 1, 0, dep); ctx.fillStyle = '#c95a10'; ctx.fill(); ctx.save(); ctx.clip();
      shape(1, 1, 0, dep * 1.05); ctx.strokeStyle = '#2b2e34'; ctx.lineWidth = dep * 0.5; ctx.stroke();
      shape(1, 1, 0, dep * 0.5); ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = dep * 0.34; ctx.stroke();
      ctx.restore(); shape(1, 1, 0, dep); ctx.strokeStyle = ink; ctx.lineWidth = 4 * u; ctx.stroke();
      // Rope with sagging loops between grommets
      const pts = [0.08, 0.3, 0.52, 0.74, 0.94].map(q => bot(q, dep * 0.28));
      const rope = (col, lw) => { ctx.beginPath(); pts.forEach((p, i) => { if (!i) { ctx.moveTo(p[0], p[1]); return; } const a = pts[i - 1]; ctx.quadraticCurveTo((a[0] + p[0]) / 2, (a[1] + p[1]) / 2 + dep * 0.32, p[0], p[1]); }); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); };
      rope(ink, 6 * u); rope('#ffffff', 2.6 * u);
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3.6 * u, 0, 7); ctx.fillStyle = '#2b2e34'; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = ink; ctx.stroke(); });
      // Top of the tube
      shape(1, 1, 0, 0); ctx.fillStyle = '#f5821f'; ctx.fill(); ctx.lineWidth = 4.5 * u; ctx.strokeStyle = ink; ctx.stroke();
      // Cockpit and floor
      shape(0.74, 0.56, -w * 0.03, -s * 0.01); ctx.fillStyle = '#2b2e34'; ctx.fill(); ctx.lineWidth = 3.5 * u; ctx.stroke();
      ctx.save(); shape(0.74, 0.56, -w * 0.03, -s * 0.01); ctx.clip(); shape(0.66, 0.42, -w * 0.02, s * 0.05); ctx.fillStyle = '#f08a2a'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,50,0,0.35)'; ctx.lineWidth = 2.5 * u; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-w * 0.02 + i * w * 0.09, -s * 0.06); ctx.lineTo(-w * 0.02 + i * w * 0.09, s * 0.2); ctx.stroke(); } ctx.restore();
      // Glossy highlight and bow handle
      ctx.beginPath(); ctx.moveTo(-w * 0.36, -h * 0.4); ctx.bezierCurveTo(-w * 0.1, -h * 0.47, w * 0.15, -h * 0.45, w * 0.3, -h * 0.34); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4 * u; ctx.lineCap = 'round'; ctx.stroke();
      ctx.save(); ctx.translate(w * 0.4, h * 0.02); ctx.rotate(-0.5); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.07, s * 0.04, 0, 0, 7); ctx.fillStyle = '#2b2e34'; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = ink; ctx.stroke(); ctx.restore();
    } else if (kind === 'arrow') {
      ctx.rotate(ang); E.arrow(ctx, size * 0.55, 0, 0, size * 1.1, col || C.accent2, C);
    } else {
      ctx.rotate(ang); const s = size / 30, P = [[30, 0], [22, -3.6], [4, -4], [-6, -24], [-14, -24], [-8, -4], [-20, -4], [-26, -12], [-32, -12], [-28, 0], [-32, 12], [-26, 12], [-20, 4], [-8, 4], [-14, 24], [-6, 24], [4, 4], [22, 3.6]];
      const sh = () => { ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s)); ctx.closePath(); };
      sh(); ctx.fillStyle = col || '#ffffff'; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = C.accent2; ctx.beginPath(); ctx.ellipse(10 * s, 0, 6 * s, 2.2 * s, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function shadowBlob(ctx, x, y, size, C, a) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(x, y, size * 0.5, size * 0.18, 0, 0, 7); ctx.fill(); ctx.restore(); }
  function loading(ctx, W, H, C, look, u) {
    E.drawBg(ctx, C, look, W, H, 0, 0, false); const st = GeoData.state; ctx.fillStyle = look.transparent ? '#333' : '#fff'; ctx.font = fl(34 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st.status === 'error' ? st.error : 'Loading the world map…', W / 2, H / 2);
  }
  return { smooth, placeLabels, labelFade, projection, prep, camForCountry, camForPoints, flight, drawGlobe, outline, country, screenBox, pin, area, label, vehicle, shadowBlob, visible, partial, loading, R0 };
})();

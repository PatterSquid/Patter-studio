/* Map flyover: a flat, spread out map seen from a tilted camera that glides between stops. At each stop countries
   light up, lift off the map and get name flags, while a year ruler slides along the bottom. Pure function of time. */
const Flyover = (() => {
  const { cl, lerp, ease, spring } = E;
  const D2R = Math.PI / 180, K = 26, D = 1500;
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + cl(lat, -82, 82) * Math.PI / 360)) / D2R;
  const plane = (lon, lat) => [lon * K, -merc(lat) * K];
  const TILT = { gentle: 38, medium: 48, steep: 58 };
  const ACTS = [['lift', 'Light up and lift'], ['light', 'Light up'], ['drain', 'Drain the colour (leaving)'], ['fly', 'Just fly over']];
  const r2 = v => Math.round(v * 100) / 100;

  function defaults() {
    const S = (at, year, countries, act = 'lift', colour = 'Irn-Bru orange') => ({ at, dur: 3.2, year, countries, act, colour, label: 'names', text: '' });
    return { title: 'EU members, 1958 to 2020', tilt: 'medium', turn: true, older: 'dim', finale: 'wide', ruler: true, hold: 2,
      stops: [S(2.6, '1958', ['France', 'Germany', 'Italy', 'Belgium', 'Netherlands', 'Luxembourg']), S(7, '1973', ['United Kingdom', 'Ireland', 'Denmark']), S(11, '1981', ['Greece']), S(14.6, '1986', ['Spain', 'Portugal']),
        S(18.4, '1995', ['Austria', 'Sweden', 'Finland']), S(22.2, '2004', ['Poland', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Cyprus', 'Malta']), S(26.6, '2007', ['Bulgaria', 'Romania']),
        S(30.2, '2013', ['Croatia']), Object.assign(S(33.6, '2020', ['United Kingdom'], 'drain'), { label: 'text', text: 'United Kingdom leaves' })] };
  }
  const names = s => (Array.isArray(s.countries) ? s.countries : String(s.countries || '').split(',')).map(x => String(x).trim()).filter(Boolean);

  /* ---------- Geometry: countries in plane coordinates, cached per detail level ---------- */
  const geoCache = new WeakMap();
  function geo(f) {
    let g = geoCache.get(f); if (g) return g;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    // Countries that cross the 180 degree line (Russia's far east, Fiji) are unwrapped so their outline carries on east instead of
    // jumping right across the map. Rings that circle a pole (Antarctica) can't be drawn flat, so they're left out.
    const unwrap = r => { const out = []; let off = 0, prev = null; for (const [lon, lat] of r) { if (prev !== null) { const d = lon + off - prev; if (d > 180) off -= 360; else if (d < -180) off += 360; } prev = lon + off; out.push([prev, lat]); } return out; };
    const sArea = r => { let a = 0; for (let i = 0; i < r.length; i++) { const q = r[i], n = r[(i + 1) % r.length]; a += q[0] * n[1] - n[0] * q[1]; } return a / 2; };
    const P = polys.map(p => {
      const ll = p.map(unwrap); if (!ll[0] || ll[0].length < 3 || Math.abs(ll[0][ll[0].length - 1][0] - ll[0][0][0]) > 180 || ll[0].some(q => q[1] < -80)) return null;
      // Every outline is turned the same way round (holes the other way), so overlapping countries never cancel each other out
      const rings = ll.map((r, k) => { const pr = r.map(([lon, lat]) => plane(lon, lat)), a = sArea(pr); return (k === 0 ? a < 0 : a > 0) ? pr.reverse() : pr; }); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      rings[0].forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      let a = 0, sx = 0, sy = 0; const r = rings[0]; for (let i = 0; i < r.length; i++) { const q = r[i], n = r[(i + 1) % r.length], c = q[0] * n[1] - n[0] * q[1]; a += c; sx += (q[0] + n[0]) * c; sy += (q[1] + n[1]) * c; }
      return { rings, box: [x0, y0, x1, y1], area: Math.abs(a / 2), cen: a ? [sx / (3 * a), sy / (3 * a)] : [(x0 + x1) / 2, (y0 + y1) / 2] };
    }).filter(p => p && p.rings[0] && p.rings[0].length > 2);
    const big = P.reduce((m, p) => Math.max(m, p.area), 0), main = P.find(p => p.area === big);
    // The "core" of a country (its main landmass and nearby islands) is what the camera frames, so France doesn't pull in Guiana
    const core = P.filter(p => p.area >= big * 0.08 && main && Math.hypot(p.cen[0] - main.cen[0], p.cen[1] - main.cen[1]) < Math.max(main.box[2] - main.box[0], main.box[3] - main.box[1]) * 1.6);
    const cb = core.reduce((b, p) => [Math.min(b[0], p.box[0]), Math.min(b[1], p.box[1]), Math.max(b[2], p.box[2]), Math.max(b[3], p.box[3])], [1e9, 1e9, -1e9, -1e9]);
    g = { P, core: cb, lp: main ? main.cen : [0, 0] }; geoCache.set(f, g); return g;
  }
  const FIX = { france: [2.4, 46.6], 'united kingdom': [-1.8, 53.2], norway: [9, 61], croatia: [16.2, 45.4], italy: [12.5, 43], denmark: [9.3, 56.1], portugal: [-8, 39.7], greece: [22, 39.6], 'united states': [-98, 39], russia: [45, 57], canada: [-100, 56], scotland: [-4.2, 56.9] };
  const labelPt = f => { const k = String(f.name).toLowerCase(); return FIX[k] ? plane(FIX[k][0], FIX[k][1]) : geo(f).lp; };
  const featMemo = {};
  function features(lo) {
    const st = GeoData.state, src = lo && st.byNameLo ? st.byNameLo : st.byName, k = (lo ? 'lo' : 'hi'); if (featMemo[k] && featMemo[k].src === src) return featMemo[k].list;
    const list = [], seen = new Set(); Object.values(src || {}).forEach(f => { if (!seen.has(f) && f.id !== 'SCO') { seen.add(f); list.push(f); } });
    featMemo[k] = { src, list, items: null }; return list;
  }
  // The same countries in the form the graphics chip takes, built once per map
  function glItems(lo) { const list = features(lo), m = featMemo[lo ? 'lo' : 'hi']; if (!m.items) m.items = list.map(f => ({ key: f.name, polys: geo(f).P.map(pl => pl.rings) })); return m.items; }
  const findF = (n, lo) => (lo ? GeoData.findLo(n) || GeoData.find(n) : GeoData.find(n));

  /* ---------- Plan: stops, framing and the camera path ---------- */
  // A few plans are kept, because the preview (light map) and the editor (full map) ask for different ones every frame
  const plans = new Map();
  function plan(cfg, look, W, H) {
    const lo = !!look.preview, key = JSON.stringify(cfg) + look.format + lo + (look.noCam ? 1 : 0) + GeoData.state.status + GeoData.state.version + (E.fontVersion || 0); if (plans.has(key)) return plans.get(key); let cp;
    const pitch = TILT[cfg.tilt] || 48, cosP = Math.cos(pitch * D2R);
    const fit = (b, fw, fh) => { const bw = Math.max(40, b[2] - b[0]), bh = Math.max(40, b[3] - b[1]); return cl(Math.min(W * fw / bw, H * fh / (bh * cosP)), 0.25, 8); };
    const stops = (cfg.stops || []).map((s, i) => {
      const fs = names(s).map(n => findF(n, lo)).filter(Boolean), at = Math.max(0, +s.at || 0), dur = cl(+s.dur || 3, 0.6, 60);
      let box = null; fs.forEach(f => { const c = geo(f).core; if (!(c[2] > c[0])) return; box = box ? [Math.min(box[0], c[0]), Math.min(box[1], c[1]), Math.max(box[2], c[2]), Math.max(box[3], c[3])] : c.slice(); });
      const cam = s.cam || {}, z0 = box ? fit(box, 0.46, 0.4) : 1.2, z = cl(z0 * (+cam.z || 1), 0.2, 12);
      const cx = (box ? (box[0] + box[2]) / 2 : 0) + (+cam.dx || 0), cy = (box ? (box[1] + box[3]) / 2 : 0) + (+cam.dy || 0);
      const yr = parseFloat(s.year);
      return { s, i, fs, at, dur, box, cx, cy, z, year: isFinite(yr) ? yr : null, yearText: String(s.year || '').trim(), col: E.COLOURS[s.colour] || E.COLOURS['Irn-Bru orange'] };
    }).sort((a, b) => a.at - b.at || a.i - b.i);
    const framed = stops.filter(s => s.box);
    let all = null; framed.forEach(s => { all = all ? [Math.min(all[0], s.box[0]), Math.min(all[1], s.box[1]), Math.max(all[2], s.box[2]), Math.max(all[3], s.box[3])] : s.box.slice(); });
    if (!all) { const a = plane(-12, 62), b = plane(32, 35); all = [a[0], a[1], b[0], b[1]]; }
    const wide = { cx: (all[0] + all[2]) / 2, cy: (all[1] + all[3]) / 2 + (all[3] - all[1]) * 0.04, z: fit(all, 0.78, 0.7) };
    const last = stops.length ? stops[stops.length - 1] : null, endStops = last ? Math.max(...stops.map(s => s.at + s.dur)) : 3;
    const finT = cfg.finale === 'wide' && framed.length > 1 ? 2.4 : 0, dur = endStops + finT + cl(+cfg.hold || 0, 0, 10);
    // Camera keys: [time, x, y, log zoom, pitch, yaw]
    const turn = cfg.turn !== false, Kk = [];
    const push = (t, x, y, z, p, yw) => { if (Kk.length && t <= Kk[Kk.length - 1][0] + 0.05) t = Kk[Kk.length - 1][0] + 0.05; Kk.push([t, x, y, Math.log(z), p, yw]); };
    const first = framed[0];
    if (!first || first.at > 1.6) push(0, wide.cx, wide.cy, wide.z, pitch - 6, turn ? -4 : 0);
    framed.forEach((s, j) => {
      const prev = Kk[Kk.length - 1], nx = framed[j + 1], yaw = turn ? (j % 2 ? 6 : -6) : 0, arrive = Math.max(prev ? prev[0] + 0.6 : 0, s.at - 0.6);
      // Long hops zoom out on the way, so the camera never whizzes across the map close up
      if (prev) { const zmin = Math.min(Math.exp(prev[3]), s.z), dist = Math.hypot(s.cx - prev[1], s.cy - prev[2]) * zmin; if (dist > W * 1.3 && arrive - prev[0] > 0.8) push((prev[0] + arrive) / 2, (prev[1] + s.cx) / 2, (prev[2] + s.cy) / 2, zmin / Math.min(2.4, dist / (W * 1.1)), pitch - 4, (prev[5] + yaw) / 2); }
      push(arrive, s.cx, s.cy, s.z, pitch, yaw);
      const leave = Math.max(arrive + 0.3, Math.min(s.at + s.dur - 0.2, nx ? nx.at - 1.6 : s.at + s.dur));
      const drift = (s.box ? s.box[2] - s.box[0] : 200) * 0.04;
      push(leave, s.cx + drift, s.cy - drift * 0.4, s.z * 1.05, pitch + 2, yaw + (turn ? (j % 2 ? 3 : -3) : 0));
    });
    if (finT) { push(endStops + finT, wide.cx, wide.cy, wide.z, pitch - 6, turn ? 3 : 0); }
    if (Kk.length < 2) { const s = framed[0]; const c = s || wide; push(0, c.cx, c.cy, c.z, pitch - 4, 0); push(Math.max(1, dur), c.cx, c.cy, c.z * 1.05, pitch, turn ? 3 : 0); }
    push(Math.max(dur, Kk[Kk.length - 1][0] + 0.1), Kk[Kk.length - 1][1], Kk[Kk.length - 1][2], Math.exp(Kk[Kk.length - 1][3]) * 1.01, Kk[Kk.length - 1][4], Kk[Kk.length - 1][5]);
    // Each country's story: when it lights up, lifts or drains, in which colour
    const ev = new Map(), lf = new Map();
    stops.forEach(s => s.fs.forEach((f, k) => { const key = f.name; if (!ev.has(key)) { ev.set(key, []); lf.set(key, f); } ev.get(key).push({ t0: s.at + k * 0.2, act: s.s.act || 'lift', col: s.col, stop: s, k }); }));
    // Labels: one flag per country, or one flag for the whole stop with your own text
    const labels = []; stops.forEach(s => { const mode = s.s.label || 'names'; if (mode === 'none' || !s.fs.length) return;
      if (mode === 'text') { const tx = String(s.s.text || '').trim(); if (!tx) return; let best = s.fs[0]; s.fs.forEach(f => { if (geo(f).P.reduce((a, p) => a + p.area, 0) > geo(best).P.reduce((a, p) => a + p.area, 0)) best = f; }); labels.push({ t0: s.at, end: s.at + s.dur, text: tx, f: best, alt: s.s.act === 'drain' }); }
      else s.fs.forEach((f, k) => labels.push({ t0: s.at + k * 0.2, end: s.at + s.dur, text: f.name, f, alt: s.s.act === 'drain' })); });
    const years = stops.filter(s => s.year !== null);
    cp = { stops, framed, wide, keys: Kk, dur, pitch, ev, lf, labels, years, lo, all }; plans.set(key, cp); while (plans.size > 4) plans.delete(plans.keys().next().value); return cp;
  }

  // Smooth monotone curves through the camera keys: no dead stops between moves, and no overshooting past a stop
  function tangents(Kk) {
    if (Kk.tan) return Kk.tan; const n = Kk.length, T = [];
    for (let j = 1; j < 6; j++) { const d = [], m = new Array(n).fill(0);
      for (let i = 0; i < n - 1; i++) d.push((Kk[i + 1][j] - Kk[i][j]) / Math.max(1e-6, Kk[i + 1][0] - Kk[i][0]));
      for (let i = 1; i < n - 1; i++) { if (d[i - 1] * d[i] <= 0) continue; const w1 = 2 * (Kk[i + 1][0] - Kk[i][0]) + (Kk[i][0] - Kk[i - 1][0]), w2 = (Kk[i + 1][0] - Kk[i][0]) + 2 * (Kk[i][0] - Kk[i - 1][0]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
      T[j] = m; }
    return (Kk.tan = T);
  }
  function camAt(p, t, look) {
    if (look && look.noCam) return { x: p.wide.cx, y: p.wide.cy, z: p.wide.z, pitch: p.pitch * D2R, yaw: 0 };
    const Kk = p.keys, T = tangents(Kk); t = cl(t, Kk[0][0], Kk[Kk.length - 1][0]); let i = 0; while (i < Kk.length - 2 && Kk[i + 1][0] <= t) i++;
    const k1 = Kk[i], k2 = Kk[i + 1], h = Math.max(1e-6, k2[0] - k1[0]), s = cl((t - k1[0]) / h, 0, 1), s2 = s * s, s3 = s2 * s;
    const v = j => (2 * s3 - 3 * s2 + 1) * k1[j] + (s3 - 2 * s2 + s) * h * T[j][i] + (-2 * s3 + 3 * s2) * k2[j] + (s3 - s2) * h * T[j][i + 1];
    return { x: v(1), y: v(2), z: Math.exp(v(3)), pitch: v(4) * D2R, yaw: v(5) * D2R };
  }
  function makeProj(c, W, H) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), Z = c.z, X0 = c.x, Y0 = c.y, oy = H * 0.56, sc = Math.min(W, H) / 1080;
    const f = (x, y, h = 0) => { const dx = (x - X0) * Z * sc, dy = (y - Y0) * Z * sc, x1 = dx * cy - dy * sy, y1 = dx * sy + dy * cy, d = Math.max(D * 0.24, D - y1 * sp), k = D / d; return [W / 2 + x1 * k, oy + (y1 * cp - h * Z * sc) * k, k]; };
    f.Z = Z; f.sc = sc; return f;
  }
  function yearAt(p, t) {
    const Y = p.years; if (!Y.length) return null;
    if (t <= Y[0].at) return Y[0].year - 3 * (1 - ease.io3(t / Math.max(0.1, Y[0].at)));
    for (let i = 0; i < Y.length - 1; i++) { const a = Y[i], b = Y[i + 1]; if (t <= b.at) return lerp(a.year, b.year, ease.io3((t - a.at - Math.min(1, a.dur * 0.4)) / Math.max(0.2, b.at - a.at - Math.min(1, a.dur * 0.4) - 0.3))); }
    return Y[Y.length - 1].year;
  }
  function stateOf(p, name, t, older) {
    const L = p.ev.get(name); if (!L) return null; let on = 0, col = null, lift = 0, fresh = 0, prevCol = null, prevOn = 0;
    for (const e of L) { const d = t - e.t0; if (d < 0) break; prevCol = col; prevOn = on;
      if (e.act === 'fly') { continue; }
      if (e.act === 'drain') { const q = ease.io3(d / 1.3); on = prevOn * (1 - q); col = prevCol || e.col; fresh = 0; lift = -5 * ease.out3(d / 0.7) * (1 - ease.io3((d - 1.4) / 1.4)); continue; }
      const q = ease.io3(d / 0.9); on = prevOn + (1 - prevOn) * q; col = prevCol && prevOn > 0.01 ? mixH(prevCol, e.col, q) : e.col;
      fresh = 1 - ease.io3((d - 2.2) / 1.6); lift = e.act === 'lift' ? 15 * cl(spring(d * 1.1, 5, 9), 0, 1.25) * (1 - ease.io3((d - 2.2) / 1.6)) : 0;
      if (older === 'fade') on *= 1 - ease.io3((d - 3.2) / 1.2);
    }
    return on > 0.002 || Math.abs(lift) > 0.05 ? { on, col: col || '#f5821f', lift, fresh } : null;
  }
  const rgbHex = c => { const m = c.match(/\d+/g); return m ? '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('') : '#f5821f'; };
  const mixH = (a, b, t) => rgbHex(E.hexMix(a, b, cl(t, 0, 1)));

  /* ---------- Drawing ---------- */
  // Outlines simplified to several levels, so a wide shot never pushes far more points than there are pixels to show them
  const LODS = [0, 0.4, 1.2, 3.5, 10, 30];
  function simplify(r, tol) {
    if (r.length < 8 || !tol) return r; const keep = new Uint8Array(r.length); keep[0] = keep[r.length - 1] = 1; const st = [[0, r.length - 1]], t2 = tol * tol;
    while (st.length) { const [a, b] = st.pop(); const ax = r[a][0], ay = r[a][1], dx = r[b][0] - ax, dy = r[b][1] - ay, L = dx * dx + dy * dy; let best = -1, bd = t2;
      for (let i = a + 1; i < b; i++) { const px = r[i][0] - ax, py = r[i][1] - ay, tt = L ? Math.max(0, Math.min(1, (px * dx + py * dy) / L)) : 0, ex = px - tt * dx, ey = py - tt * dy, d = ex * ex + ey * ey; if (d > bd) { bd = d; best = i; } }
      if (best > 0) { keep[best] = 1; st.push([a, best], [best, b]); } }
    const out = []; for (let i = 0; i < r.length; i++) if (keep[i]) out.push(r[i]); return out.length >= 4 ? out : null;
  }
  function ringsAt(pl, lv) { if (!lv) return pl.rings; pl.lod = pl.lod || []; if (!pl.lod[lv]) pl.lod[lv] = pl.rings.map(r => simplify(r, LODS[lv])).filter(Boolean); return pl.lod[lv]; }
  // Adds a country's outline to path p; returns false when none of it is on screen
  function pathOf(f, pr, h, W, H, p) {
    let any = false; const m = 80;
    geo(f).P.forEach(pl => {
      const b = pl.box, c0 = pr(b[0], b[1], h), c1 = pr(b[2], b[1], h), c2 = pr(b[0], b[3], h), c3 = pr(b[2], b[3], h), xs = [c0[0], c1[0], c2[0], c3[0]], ys = [c0[1], c1[1], c2[1], c3[1]];
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); if (x1 < -m || x0 > W + m || y1 < -m || y0 > H + m) return;
      if (x1 - x0 < 1.2 && y1 - y0 < 1.2) return;
      // How many screen pixels one map unit covers here, to pick the level of detail
      const ppu = Math.max(c0[2], c1[2], c2[2], c3[2]) * pr.Z * pr.sc, tol = 0.45 / Math.max(1e-6, ppu); let lv = 0; while (lv < LODS.length - 1 && LODS[lv + 1] <= tol) lv++;
      const R = ringsAt(pl, lv); if (!R.length) return; any = true;
      R.forEach(r => { for (let i = 0; i < r.length; i++) { const q = pr(r[i][0], r[i][1], h); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); } p.closePath(); });
    });
    return any;
  }
  function draw(ctx, t, cfg, look, W, H) {
    const C = E.palette(look), u = Math.min(W, H) / 1080;
    if (GeoData.state.status !== 'ready') { GeoData.load(); Globe.loading(ctx, W, H, C, look, u); return; }
    const p = plan(cfg, look, W, H), cam = camAt(p, t, look), pr = makeProj(cam, W, H), Z = cam.z * pr.sc;
    ctx.save();
    E.drawBg(ctx, C, look, W, H, 0, 0);
    // On the graphics chip: graticule, every shadow, and all the land that isn't lit up, in a few milliseconds
    const feats = features(p.lo), lw = Math.max(1.2, 2.4 * Math.sqrt(Z)) * u, paper2 = mixH(C.paper, C.grid || '#ddd3bb', 0.55), so = 5 / Z;
    const dimK = cfg.older === 'keep' ? 0 : 0.18, fillOf = s => mixH(paper2, mixH(mixH(s.col, '#0d1420', dimK), s.col, s.fresh), s.on);
    // Countries rising or sinking are drawn below in 2D; lit ones lying flat go to the chip, grouped by colour
    const moving = new Set(), groups = new Map(), states = new Map();
    feats.forEach(f => { if (!p.ev.has(f.name)) return; const st = stateOf(p, f.name, t, cfg.older); if (!st) return; states.set(f.name, st);
      if (Math.abs(st.lift) >= 0.05 || st.fresh > 0.01) moving.add(f.name); else { const c = fillOf(st); if (!groups.has(c)) groups.set(c, new Set()); groups.get(c).add(f.name); } });
    const q0 = pr(cam.x, cam.y), q1 = pr(cam.x + so, cam.y + so), sdx = q1[0] - q0[0], sdy = q1[1] - q0[1];
    let gpuOK = false;
    if (look.gpu !== false && typeof GlobeGL !== 'undefined' && GlobeGL.drawFlat) gpuOK = GlobeGL.drawFlat(ctx, glItems(p.lo), { x: cam.x, y: cam.y, z: cam.z, sc: pr.sc, yaw: cam.yaw, pitch: cam.pitch, D, oy: H * 0.56 }, W, H, { grat: !look.transparent, K, merc, shadow: [sdx, sdy], paper: paper2, ink: C.ink, lw, gratW: 1.5 * u, skip: moving, groups: [...groups].map(([col, keys]) => ({ col, keys })) });
    // Graticule, for a sense of depth
    if (!look.transparent && !gpuOK) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5 * u; const g0 = Math.floor((cam.x / K - 120) / 10) * 10;
      for (let lon = g0; lon <= g0 + 240; lon += 10) { ctx.beginPath(); for (let lat = -70; lat <= 80; lat += 5) { const [x, y] = plane(lon, lat), q = pr(x, y); lat === -70 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); } ctx.stroke(); }
      for (let lat = -60; lat <= 80; lat += 10) { ctx.beginPath(); for (let lon = g0; lon <= g0 + 240; lon += 5) { const [x, y] = plane(lon, lat), q = pr(x, y); lon === g0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); } ctx.stroke(); } ctx.restore(); }
    // Plain land as one path; its hard shadow is the same path nudged down and right, so it's only worked out once
    const plain = new Path2D(), lit = [];
    feats.forEach(f => { const s = states.get(f.name); if (s && (!gpuOK || moving.has(f.name))) { lit.push({ f, s }); return; } if (!gpuOK && !s) pathOf(f, pr, 0, W, H, plain); });
    // Scotland and any other extra shapes drawn on top when a stop uses them
    p.ev.forEach((L, name) => { const f = p.lf.get(name); if (f && f.id === 'SCO') { const s = stateOf(p, name, t, cfg.older); if (s) lit.push({ f, s }); } });
    lit.forEach(o => { o.base = new Path2D(); o.vis = pathOf(o.f, pr, Math.min(0, o.s.lift), W, H, o.base); });
    ctx.save(); ctx.translate(sdx, sdy); ctx.fillStyle = 'rgba(8,16,28,0.5)'; if (!gpuOK) { ctx.fill(plain); lit.forEach(o => { if (o.vis) ctx.fill(o.base); }); } ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.fillStyle = paper2; if (!gpuOK) { ctx.fill(plain); ctx.lineWidth = lw; ctx.stroke(plain); }
    lit.filter(o => o.vis && o.s.lift < 0.5).forEach(({ base, s }) => { ctx.fillStyle = fillOf(s); ctx.fill(base); ctx.lineWidth = lw; ctx.stroke(base); });
    // Raised countries: a darker side wall under the lifted top, nearest last. The wall is the base outline stepped upwards.
    lit.filter(o => o.vis && o.s.lift >= 0.5).sort((a, b) => labelPt(a.f)[1] - labelPt(b.f)[1]).forEach(({ f, s, base }) => {
      const top = new Path2D(); if (!pathOf(f, pr, s.lift, W, H, top)) return; const fc = fillOf(s), wall = mixH(fc, '#2a1206', 0.5), lp = labelPt(f), b0 = pr(lp[0], lp[1], 0), b1 = pr(lp[0], lp[1], s.lift), up = b1[1] - b0[1];
      ctx.fillStyle = wall; ctx.fill(base); ctx.lineWidth = lw; ctx.stroke(base);
      const steps = Math.min(6, Math.ceil(Math.abs(up) / 2)); for (let k = 1; k < steps; k++) { ctx.save(); ctx.translate(0, up * k / steps); ctx.fill(base); ctx.restore(); }
      ctx.fillStyle = fc; ctx.fill(top); ctx.lineWidth = lw * 1.15; ctx.stroke(top);
      if (s.fresh > 0.01) { ctx.save(); ctx.globalAlpha *= 0.14 * s.fresh; ctx.fillStyle = '#fff6cf'; ctx.fill(top); ctx.restore(); }
    });
    // Haze on the far edge
    if (!look.transparent) { const hz = ctx.createLinearGradient(0, 0, 0, H * 0.42), hc = E.hexMix(C.bg, '#e8f0fb', 0.6).match(/\d+/g); hz.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},0.6)`); hz.addColorStop(1, `rgba(${hc[0]},${hc[1]},${hc[2]},0)`); ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H * 0.42); }
    // Name flags on poles, always upright
    const L = p.labels.map(l => { const e = t - l.t0, out = 1 - ease.io3((t - l.end + 0.5) / 0.5); if (e < 0 || out <= 0) return null; const st = stateOf(p, l.f.name, t, cfg.older), lp = labelPt(l.f), q = pr(lp[0], lp[1], st ? Math.max(0, st.lift) : 0); return { l, e, out, q }; }).filter(Boolean).sort((a, b) => a.q[1] - b.q[1]);
    L.forEach(({ l, e, out, q }) => {
      const [x, y, k] = q; if (x < -200 || x > W + 200 || y < -100 || y > H + 300) return; const pop = cl(spring(e * 1.3, 6, 10), 0, 1.2), sc = k * Math.sqrt(cl(Z, 0.4, 4)) * 0.85 * pop * out * u; if (sc < 0.04) return;
      const pole = 92 * sc, fs = 40 * sc, text = String(l.text).toUpperCase(); ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
      ctx.strokeStyle = C.ink; ctx.lineWidth = 5 * sc; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -pole); ctx.stroke(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, 0, 9 * sc, 4 * sc, 0, 0, 7); ctx.fill();
      ctx.font = E.fd(fs); const tw = ctx.measureText(text).width, bw = tw + fs * 0.8, bh = fs * 1.4; ctx.translate(0, -pole); ctx.rotate(Math.sin(t * 3 + x * 0.01) * 0.03);
      ctx.fillStyle = C.shadow; ctx.fillRect(5 * sc, -bh + 5 * sc, bw, bh); ctx.fillStyle = l.alt ? C.accent2 : C.paper; ctx.fillRect(0, -bh, bw, bh); ctx.lineWidth = 3 * sc; ctx.strokeRect(0, -bh, bw, bh);
      ctx.fillStyle = l.alt ? '#ffffff' : C.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, fs * 0.4, -bh / 2 + fs * 0.04); ctx.restore();
    });
    // Year ruler sliding along the bottom
    const yr = cfg.ruler !== false ? yearAt(p, t) : null;
    if (yr !== null && isFinite(yr)) {
      const ys = p.years, span = Math.max(10, ys[ys.length - 1].year - ys[0].year), ppy = W * 0.0135 * Math.min(1, 100 / span), every = [5, 10, 25, 50, 100].find(e => ppy * e >= 90) || 100, minor = every / 5;
      const rx = W / 2, ry = H - 70 * u, a0 = cl(t / 0.6, 0, 1), reach = W * 0.32; ctx.save(); ctx.globalAlpha = a0;
      const rg = ctx.createLinearGradient(0, ry - 60 * u, 0, H); rg.addColorStop(0, 'rgba(8,16,28,0)'); rg.addColorStop(1, 'rgba(8,16,28,0.55)'); ctx.fillStyle = rg; ctx.fillRect(0, ry - 60 * u, W, H - ry + 60 * u);
      ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (let y = Math.floor((yr - reach / ppy) / minor) * minor; y <= yr + reach / ppy; y += minor) { const x = rx + (y - yr) * ppy, a = cl(1 - Math.abs(x - rx) / reach, 0, 1); if (a <= 0) continue; ctx.globalAlpha = a * a0; const big = Math.abs(y / every - Math.round(y / every)) < 1e-6;
        ctx.fillRect(x - 1.5 * u, ry + (big ? 6 : 16) * u, 3 * u, (big ? 26 : 14) * u); if (big) { ctx.font = E.fd((Math.abs(y / (every * 2) - Math.round(y / (every * 2))) < 1e-6 ? 38 : 30) * u); ctx.fillText(String(Math.round(y)), x, ry - 14 * u); } }
      ctx.globalAlpha = a0; ctx.fillStyle = C.accent; ctx.strokeStyle = C.ink; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(rx - 14 * u, ry - 2 * u); ctx.lineTo(rx + 14 * u, ry - 2 * u); ctx.lineTo(rx, ry + 18 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      const cur = p.stops.filter(s => s.yearText && t >= s.at - 0.2).pop(), big = cur ? cur.yearText : String(Math.round(yr));
      ctx.font = E.fd(64 * u); ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 10 * u; ctx.strokeStyle = C.ink; ctx.strokeText(big, 56 * u, H - 40 * u); ctx.fillStyle = '#ffffff'; ctx.fillText(big, 56 * u, H - 40 * u); ctx.restore();
    }
    ctx.restore();
    E.title(ctx, cfg.title, t, W, H, C, u); E.fadeIn(ctx, t, W, H, C, look);
  }
  // How far the picture moves in one frame, from the camera alone: slow glides need no motion blur, fast hops get it
  function blurHint(cfg, look, t, fps, W, H) {
    if (GeoData.state.status !== 'ready') return 1; const p = plan(cfg, look, W, H), dt = 1 / fps, a = makeProj(camAt(p, t - dt / 2, look), W, H), b = makeProj(camAt(p, t + dt / 2, look), W, H);
    let m = 0; [[0.5, 0.5], [0.15, 0.8], [0.85, 0.8], [0.5, 0.2]].forEach(([fx, fy]) => { const ca = camAt(p, t, look), pt = [ca.x + (fx - 0.5) * W / (ca.z * a.sc), ca.y + (fy - 0.5) * H / (ca.z * a.sc)], q0 = a(pt[0], pt[1]), q1 = b(pt[0], pt[1]); m = Math.max(m, Math.hypot(q1[0] - q0[0], q1[1] - q0[1])); });
    const u = Math.min(W, H) / 1080; return m > 9 * u ? 3 : 1;
  }
  function duration(cfg, look) { if (GeoData.state.status !== 'ready') { GeoData.load(); return 4; } const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; }

  /* ---------- Editing ---------- */
  const stopIdx = id => +String(id).split(':')[1];
  const editor = { formIsScene: true, camera: true,
    tracks(cfg, look) {
      if (GeoData.state.status !== 'ready') return [{ id: 'stops', name: 'Stops', items: [] }];
      const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), endStops = p.stops.length ? Math.max(...p.stops.map(s => s.at + s.dur)) : 0;
      const items = p.stops.map(s => ({ id: 'stop:' + s.i, start: s.at, end: s.at + s.dur, label: (s.yearText ? s.yearText + ': ' : '') + (names(s.s).join(', ') || 'Empty stop'), colour: E.hexMix(s.col, '#16213a', 0.45), trim: 'end', minLen: 0.6, maxLen: 60, title: 'Drag to move this stop, drag the right edge to stay longer' }));
      const end = []; if (cfg.finale === 'wide' && p.framed.length > 1) end.push({ id: 'finale', start: endStops, end: endStops + 2.4, label: 'Pull back', colour: '#3a4660', move: false, trim: 'none' });
      const h0 = endStops + (end.length ? 2.4 : 0); end.push({ id: 'hold', start: h0, end: h0 + (+cfg.hold || 0), label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' });
      return [{ id: 'stops', name: 'Stops', colour: '#f5821f', items }, { id: 'end', name: 'End', items: end }];
    },
    update(cfg, id, ch) {
      if (id === 'hold') { cfg.hold = cl(Math.round((ch.end - ch.start) * 2) / 2, 0, 10); return; }
      const s = (cfg.stops || [])[stopIdx(id)]; if (!s) return; s.at = r2(ch.start); s.dur = r2(cl(ch.end - ch.start, 0.6, 60));
    },
    hits(cfg, look, t, W, H) {
      if (GeoData.state.status !== 'ready') return []; const p = plan(cfg, look, W, H), pr = makeProj(camAt(p, t, look), W, H), out = [];
      p.stops.forEach(s => { if (!s.box) return; const live = t >= s.at - 0.8 && t <= s.at + s.dur + 0.3; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        s.fs.forEach(f => geo(f).P.forEach(pl => { const b = pl.box, c = geo(f).core; if (b[2] < c[0] - 1 || b[0] > c[2] + 1 || b[3] < c[1] - 1 || b[1] > c[3] + 1) return; pl.rings[0].forEach((q, i) => { if (i % 3) return; const r = pr(q[0], q[1]); x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[0]); y1 = Math.max(y1, r[1]); }); }));
        if (x1 > x0) out.push({ id: 'stop:' + s.i, box: [x0, y0, x1, y1], k: 1, scale: true, ghost: !live, label: (s.yearText || 'Stop') + ', drag to reframe' }); });
      return out;
    },
    grab(cfg, id, ctx) {
      const s = (cfg.stops || [])[stopIdx(id)]; if (!s) return null; const c = ctx || {}, W = c.W || 1920, H = c.H || 1080, p = plan(cfg, { format: H > W ? '9:16' : '16:9', preview: true }, W, H), cam = camAt(p, c.t || 0, null);
      return { dx: +(s.cam && s.cam.dx) || 0, dy: +(s.cam && s.cam.dy) || 0, z: +(s.cam && s.cam.z) || 1, Z: cam.z * Math.min(W, H) / 1080, yaw: cam.yaw, cp: Math.cos(cam.pitch) };
    },
    // Dragging the countries moves the view with your hand: the camera goes the other way
    move(cfg, id, sn, dx, dy) {
      const s = (cfg.stops || [])[stopIdx(id)]; if (!s || !sn) return; const ux = dx / sn.Z, uy = dy / sn.Z / Math.max(0.3, sn.cp), c = Math.cos(-sn.yaw), si = Math.sin(-sn.yaw);
      const px = ux * c - uy * si, py = ux * si + uy * c; s.cam = { dx: r2(sn.dx - px), dy: r2(sn.dy - py), z: sn.z };
    },
    resize(cfg, id, sn, f) { const s = (cfg.stops || [])[stopIdx(id)]; if (!s || !sn) return; s.cam = { dx: sn.dx, dy: sn.dy, z: r2(cl(sn.z * f, 0.2, 6)) }; },
    adds: [{ label: 'Stop', title: 'Add a stop at the playhead, then pick its countries on the left', fn(cfg, t) { cfg.stops = cfg.stops || []; const prev = [...cfg.stops].sort((a, b) => a.at - b.at).filter(s => +s.at <= t).pop(); cfg.stops.push({ at: r2(t), dur: 3.2, year: '', countries: [], act: 'lift', colour: prev ? prev.colour : 'Irn-Bru orange', label: 'names', text: '' }); return 'stop:' + (cfg.stops.length - 1); } }],
    remove(cfg, id) { if (id === 'hold') { cfg.hold = 0; return; } if (id === 'finale') { cfg.finale = 'last'; return; } const i = stopIdx(id); if (cfg.stops && cfg.stops[i]) cfg.stops.splice(i, 1); },
    duplicate(cfg, id) { const s = (cfg.stops || [])[stopIdx(id)]; if (!s) return id; const c = JSON.parse(JSON.stringify(s)); c.at = r2(+s.at + (+s.dur || 3)); cfg.stops.push(c); return 'stop:' + (cfg.stops.length - 1); },
    inspect(root, cfg, id, changed, done) {
      const { H, field, sel, txt, num, card, grid2, btn, colourOpts } = UI; if (id === 'hold' || id === 'finale') { root.append(card('End', grid2(field('At the end', sel(cfg.finale || 'wide', [['wide', 'Pull back to show everything'], ['last', 'Stay on the last stop']], v => { cfg.finale = v; changed(); })), field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 s'], ['2', '2 s'], ['3', '3 s'], ['5', '5 s']], v => { cfg.hold = +v; changed(); }))), H('div', { className: 'btnrow' }, btn('Done', done)))); return; }
      const i = stopIdx(id), s = (cfg.stops || [])[i]; if (!s) return; const re = () => { root.innerHTML = ''; editor.inspect(root, cfg, id, changed, done); };
      s.countries = names(s); const chips = H('div', { className: 'chips' }, ...s.countries.map((n, k) => { const ok = GeoData.state.status !== 'ready' || !!GeoData.find(n); return H('span', { className: 'chip' + (ok ? '' : ' bad'), title: ok ? n : n + ' is not in the map list' }, n, H('button', { type: 'button', textContent: '×', 'aria-label': 'Remove ' + n, on: { click: () => { s.countries.splice(k, 1); changed(); re(); } } })); }));
      const inp = H('input', { type: 'text', placeholder: 'Type a country, then pick it', 'aria-label': 'Add a country', autocomplete: 'off' });
      const addIt = () => { const v = inp.value.trim(); if (!v) return; const f = GeoData.find(v); const nm = f ? f.name : v; if (!s.countries.some(x => x.toLowerCase() === nm.toLowerCase())) s.countries.push(nm); inp.value = ''; changed(); re(); setTimeout(() => { const n = root.querySelector('input[aria-label="Add a country"]'); n && n.focus(); }, 0); };
      inp.addEventListener('change', () => { if (GeoData.find(inp.value.trim())) addIt(); }); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addIt(); } });
      const sugg = UI.suggest(inp, () => GeoData.state.features.map(f => ({ name: f.name })));
      const custom = s.label === 'text';
      root.append(card('Stop ' + (i + 1) + (s.year ? ', ' + s.year : ''),
        field('Countries', H('div', { className: 'ms' }, chips, H('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px' }, inp, btn('Add', addIt)), sugg)),
        grid2(field('What happens', sel(s.act || 'lift', ACTS, v => { s.act = v; changed(); })), field('Colour', sel(s.colour || 'Irn-Bru orange', colourOpts(), v => { s.colour = v; changed(); }))),
        grid2(field('Year or label on the ruler', txt(s.year, v => { s.year = v; changed(); }, 'e.g. 1973')), field('Flags', sel(s.label || 'names', [['names', 'Country names'], ['text', 'One flag, my own words'], ['none', 'None']], v => { s.label = v; changed(); re(); }))),
        custom ? field('Flag text', txt(s.text, v => { s.text = v; changed(); }, 'e.g. United Kingdom leaves')) : '',
        grid2(field('Starts at (s)', num(+s.at || 0, v => { s.at = v; changed(); }, 0, 600, 0.1, 'Starts at')), field('Stays for (s)', num(+s.dur || 3, v => { s.dur = v; changed(); }, 0.6, 60, 0.1, 'Stays for'))),
        H('p', { className: 'hint' }, 'The camera frames these countries for you. Drag them on the preview to reframe the shot, pull a corner to zoom in or out.'),
        H('div', { className: 'btnrow' }, btn('Zoom in', () => { s.cam = Object.assign({ dx: 0, dy: 0, z: 1 }, s.cam); s.cam.z = r2(cl(s.cam.z * 1.25, 0.2, 6)); changed(); }), btn('Zoom out', () => { s.cam = Object.assign({ dx: 0, dy: 0, z: 1 }, s.cam); s.cam.z = r2(cl(s.cam.z / 1.25, 0.2, 6)); changed(); }), btn('Reset framing', () => { delete s.cam; changed(); }), btn('Done', done))));
    },
    scene(root, cfg, changed) { scene(root, cfg, changed); },
  };
  function scene(root, cfg, changed) {
    const { H, field, sel, txt, card, grid2, btn } = UI, set = (k, v) => { cfg[k] = v; changed(); };
    GeoData.load(); const st = GeoData.state; if (st.status !== 'ready') GeoData.onChange(() => { let s; try { s = status; } catch (e) { return; } if (s && root.contains(s) && !root.querySelector(':focus')) { root.innerHTML = ''; scene(root, cfg, changed); } });
    const status = st.status === 'error' ? H('div', { className: 'card' }, H('p', { className: 'hint', style: 'color:#ff8a80' }, st.error), btn('Retry', () => GeoData.retry())) : st.status !== 'ready' ? H('p', { className: 'hint' }, 'Downloading the world map…') : '';
    root.append(status, card('Map flyover',
      field('Title', txt(cfg.title, v => set('title', v), 'Optional red banner')),
      field('Speed ramp', sel(cfg.ramp || 'none', Layers.RAMP_OPTS, v => set('ramp', v))),
      grid2(field('Camera tilt', sel(cfg.tilt || 'medium', [['gentle', 'Gentle'], ['medium', 'Medium'], ['steep', 'Steep']], v => set('tilt', v))), field('Camera turns as it flies', sel(cfg.turn !== false ? '1' : '0', [['1', 'Yes'], ['0', 'No']], v => set('turn', v === '1')))),
      grid2(field('Earlier countries', sel(cfg.older || 'dim', [['dim', 'Stay lit, a bit darker'], ['keep', 'Stay fully lit'], ['fade', 'Fade back out']], v => set('older', v))), field('Year ruler', sel(cfg.ruler !== false ? '1' : '0', [['1', 'Show'], ['0', 'Hide']], v => set('ruler', v === '1')))),
      grid2(field('At the end', sel(cfg.finale || 'wide', [['wide', 'Pull back to show everything'], ['last', 'Stay on the last stop']], v => set('finale', v))), field('Hold at the end', sel(String(cfg.hold ?? 2), [['0', 'None'], ['1', '1 s'], ['2', '2 s'], ['3', '3 s'], ['5', '5 s']], v => set('hold', +v)))),
      H('p', { className: 'hint' }, 'Each stop on the timeline is a moment: the camera glides there and its countries light up. Use + Stop under the preview to add one at the playhead, click a stop to pick its countries.')));
  }
  function form(root, cfg, changed) { root.innerHTML = ''; scene(root, cfg, changed); }
  return { id: 'flyover', name: 'Map flyover', defaults, duration, draw, form, editor, blurHint, _plan: plan, _cam: camAt, _geo: geo };
})();

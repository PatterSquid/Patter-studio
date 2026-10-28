/* Flights module: plane, arrow, car or boat travelling between places on the comic globe. */
const Flights = (() => {
  const { cl, lerp, ease, spring } = E;
  const SPD = { slow: 1.35, normal: 1, fast: 0.72 };
  // Surface travel: cars keep to land (hopping on a ferry for sea crossings), boats keep to the water
  const SURF = { car: 'land', dinghy: 'sea', ferry: 'sea', cruise: 'sea', cargo: 'sea' }, STYLE = { dinghy: 'coast', ferry: 'coast', cruise: 'cruise', cargo: 'cargo' };
  // How a surface trip spends its time. Each stretch (road, ferry, ocean) gets a share of the clip; the car slows into each
  // port, waits while it boards, then sets off again, so the ferries and ships read clearly however short the crossing.
  const HOLD = { ferry: [0.05, 0.05], ship: [0.16, 0.12] };
  function warp(r, car) {
    const runs = r.path.runs.map(rn => Object.assign({}, rn)), multi = car && runs.length > 1;
    const w = runs.map(rn => { const f = rn.f1 - rn.f0; if (!car || rn.kind === 'road' || rn.kind === 'sea') return Math.max(f, 1e-4); const h = HOLD[rn.kind]; return rn.kind === 'ship' ? Math.max(f * 0.7, 0.28) + h[0] + h[1] : Math.max(f * 1.5, 0.14) + h[0] + h[1]; });
    const tot = w.reduce((a, b) => a + b, 0) || 1; let e = 0;
    r.runsE = runs.map((rn, k) => { const o = Object.assign({}, rn, { e0: e / tot }); e += w[k]; o.e1 = e / tot;
      const h = car && HOLD[rn.kind]; o.hb = h ? h[0] / w[k] : 0; o.ha = h ? h[1] / w[k] : 0;
      o.easeIn = !multi || k === 0 || runs[k - 1].kind !== 'road'; o.easeOut = !multi || k === runs.length - 1 || runs[k + 1].kind !== 'road'; return o; });
    r.multi = multi; r.ferries = runs.filter(rn => car && rn.kind === 'ferry').length; r.ships = runs.filter(rn => car && rn.kind === 'ship').length;
    r.roadLen = runs.reduce((a, rn) => a + (rn.kind === 'road' || rn.kind === 'sea' ? (rn.f1 - rn.f0) * r.path.len : 0), 0);
    // Where along the route we are (0..1) at a share q of the clip
    r.runAt = q => r.runsE.find(x => q <= x.e1) || r.runsE[r.runsE.length - 1];
    r.prog = q => { q = cl(q, 0, 1); if (!multi) return ease.io3(q); const rn = r.runAt(q), u = rn.e1 > rn.e0 ? (q - rn.e0) / (rn.e1 - rn.e0) : 1;
      let m; if (rn.hb || rn.ha) m = ease.sine((u - rn.hb) / Math.max(1e-6, 1 - rn.hb - rn.ha));
      else m = rn.easeIn && rn.easeOut ? ease.sine(u) : rn.easeIn ? 1 - Math.cos(u * Math.PI / 2) : rn.easeOut ? Math.sin(u * Math.PI / 2) : u;
      return rn.f0 + cl(m, 0, 1) * (rn.f1 - rn.f0); };
  }
  const endOf = pl => ({ pt: pl.pt, reach: pl.P ? Math.max(pl.P.bw, pl.P.bh) * 0.5 : 0, feat: pl.f || null });
  function defaults() {
    return { title: '', mode: 'one-to-many', from: ['Scotland'], to: ['United States', 'Spain', 'Australia'], vehicle: 'plane', labels: 'arrival', highlight: 'both',
      fromColour: 'Irn-Bru orange', toColour: 'Grass green', routeColour: 'Sunshine yellow', speed: 'normal', hold: 2, camera: 'auto', followZoom: 'medium' };
  }
  function place(name) {
    if (!name) return null; const c = GeoData.city(name); if (c) return { name: c.name, pt: [c.lon, c.lat], city: true };
    const f = GeoData.find(name); if (f) { const P = Globe.prep(f); return { name: f.name, pt: P.c, P, f }; } return null;
  }
  function extentPts(pl) { const out = [pl.pt]; if (pl.P) { const d = Math.max(pl.P.bw, pl.P.bh) * 0.55 * 57.3; out.push([pl.pt[0] - d, pl.pt[1] - d * 0.6], [pl.pt[0] + d, pl.pt[1] + d * 0.6]); } return out; }
  let ck = '', cp = null;
  function plan(cfg, look, W, H) {
    const key = JSON.stringify(cfg) + look.format + GeoData.state.status + GeoData.state.version + (E.fontVersion || 0); if (key === ck) return cp;
    const u = Math.min(W, H) / 1080, sp = SPD[cfg.speed] || 1, F = cfg.from.map(place).filter(Boolean), T = cfg.to.map(place).filter(Boolean);
    const routes = [], legs = [];
    if (cfg.mode === 'many-to-one') { if (T[0]) F.forEach(f => routes.push([f, T[0]])); }
    else if (cfg.mode === 'chain') { const seq = [F[0], ...T].filter(Boolean); for (let i = 0; i + 1 < seq.length; i++) routes.push([seq[i], seq[i + 1]]); }
    else { if (F[0]) T.forEach(tg => routes.push([F[0], tg])); }
    const segs = [], fit = H > W ? 0.85 : 0.95;
    const camOf = pl => pl.P ? Globe.camForCountry(pl.P, W, H, H > W ? 0.55 : 0.45) : { lon: pl.pt[0], lat: pl.pt[1], k: 6 };
    const frame = pls => { const pts = []; pls.forEach(pl => pts.push(...extentPts(pl))); if (pls.length === 1) return camOf(pls[0]); const c = Globe.camForPoints(pts, W, H, fit); c.k = Math.max(0.8, c.k * 0.86); return c; };
    const medium = SURF[cfg.vehicle]; if (medium && typeof Routes !== 'undefined') routes.forEach(r => { r.path = Routes.route(endOf(r[0]), endOf(r[1]), medium, STYLE[cfg.vehicle]); if (r.path) warp(r, cfg.vehicle === 'car'); });
    const dist = r => r.path ? r.path.len : d3.geoDistance(r[0].pt, r[1].pt), flyDur = r => r.path ? cl((3.4 + r.roadLen * 57.3 * (cfg.vehicle === 'car' ? 0.1 : 0.06) + r.ferries * 1.6 + r.ships * 4.8) * sp, 4.5 * sp, 30 * sp) : cl((2.2 + dist(r) * 1.4) * sp, 2.6 * sp, 6 * sp);
    const pathPts = r => r.path ? [0.2, 0.4, 0.6, 0.8].map(r.path.at) : [];
    const lk = (a, b, q) => Math.exp(lerp(Math.log(a), Math.log(b), q));
    // Tracking shot: the camera rides with the vehicle and zooms out mid flight when the hop is long.
    const track = (r, A, B) => { const gi = r.path ? (e => r.path.at(e)) : d3.geoInterpolate(r[0].pt, r[1].pt), pos = r.path ? (qq => r.path.at(r.prog(qq))) : null, both = Globe.camForPoints([...extentPts(r[0]), ...extentPts(r[1]), ...pathPts(r)], W, H, fit).k, kMid = Math.min(A.k, B.k, both * 0.85), dip = kMid < Math.min(A.k, B.k), mid = gi(0.5);
      // Camera rides with the vehicle; the framing offset blends from the start shot to the end shot so nothing snaps.
      const oA = [A.lon - r[0].pt[0], A.lat - r[0].pt[1]], oB = [B.lon - r[1].pt[0], B.lat - r[1].pt[1]];
      const wrap = v => ((v + 540) % 360) - 180; oA[0] = wrap(oA[0]); oB[0] = wrap(oB[0]);
      // Follow camera: settle in close on the vehicle just after it sets off, ride along at that zoom, then ease into the arrival shot
      if (cfg.camera === 'follow') { const kF = Math.max(A.k, B.k) * ({ close: 2.6, medium: 1.6, far: 1 }[cfg.followZoom] || 1.6), rq = Math.min(0.25, 1.4 / Math.max(0.1, r.D || 3));
        return q => { const e = ease.io3(q), c = pos ? pos(q) : gi(e), ri = ease.sine(q / rq), ro = ease.sine((q - (1 - rq)) / rq);
          const k = Math.exp(lerp(lerp(Math.log(A.k), Math.log(kF), ri), Math.log(B.k), ro)), ox = oA[0] * (1 - ri) + oB[0] * ro, oy = oA[1] * (1 - ri) + oB[1] * ro;
          return { lon: c[0] + ox, lat: c[1] + oy, k }; }; }
      return q => { const e = ease.io3(q), c = pos ? pos(q) : gi(e), s = ease.sine(e), base = Math.log(lk(A.k, B.k, e)), w = Math.sin(Math.PI * e), k = Math.exp(base + (dip ? (Math.log(kMid) - base) * w : 0));
        // Mid flight the shot widens and slides towards the middle of the route, so the whole arc is on screen while it's drawn
        const pc = [c[0] + lerp(oA[0], oB[0], s), c[1] + lerp(oA[1], oB[1], s)], cc = dip ? d3.geoInterpolate(pc, mid)(Math.pow(w, 1.5) * 0.75) : pc;
        return { lon: cc[0], lat: cc[1], k }; }; };
    let t = 0, cam;
    const push = (dur, at) => { segs.push({ kind: 'fly', t0: t, dur, fl: { at } }); t += dur; };
    const hold = (dur, c) => { segs.push({ kind: 'hold', t0: t, dur, cam: c }); t += dur; cam = Object.assign({}, c, { k: c.k * 1.025 }); };
    const intro = c => { const s0 = { lon: c.lon - 12 / Math.max(1, c.k * 0.5), lat: c.lat - 3 / Math.max(1, c.k * 0.5), k: c.k * 0.55 }; push(1.2, q => { const e = ease.io4(q); return { lon: lerp(s0.lon, c.lon, e), lat: lerp(s0.lat, c.lat, e), k: lk(s0.k, c.k, e) }; }); cam = c; };
    if (!routes.length) {
      // Nothing to fly yet (a place is still being typed or wasn't recognised): show a slow turning globe.
      const pls = [...F, ...T], c0 = pls.length ? frame(pls) : { lon: -4, lat: 30, k: 1 };
      push(4, q => ({ lon: c0.lon - 20 + 20 * q, lat: c0.lat, k: c0.k })); cam = c0;
    } else if (cfg.mode === 'chain' || routes.length === 1) {
      routes.forEach((r, i) => {
        const A = i === 0 ? camOf(r[0]) : cam, B = camOf(r[1]);
        if (i === 0) { intro(A); r.origin = t - 0.25; hold(0.9 * sp, A); } else { r.origin = t; hold(0.35, A); }
        r.start = t; r.D = E.tm(cfg, 'route:' + i) ?? flyDur(r); r.arrive = t + r.D; push(r.D, track(r, cam, B)); cam = B; hold(1.2 * sp, B);
      });
    } else {
      const starts = cfg.mode === 'many-to-one' ? frame(F) : camOf(routes[0][0]), allC = frame([...new Set(routes.flatMap(r => r))]), ends = cfg.mode === 'many-to-one' ? camOf(routes[0][1]) : frame(T);
      intro(starts); const origin = t - 0.25; hold(1.0 * sp, starts);
      const launch = t; let last = launch; routes.forEach((r, i) => { r.origin = origin; r.start = launch + i * 0.3; r.D = E.tm(cfg, 'route:' + i) ?? flyDur(r); r.arrive = r.start + r.D; last = Math.max(last, r.arrive); });
      const span = last - launch, out = Globe.flight(cam, allC);
      const outD = Math.max(out.dur * 1.25, 2.2); push(outD, q => out.at(q)); cam = allC; if (span > outD) hold(span - outD, allC);
      const back = Globe.flight(cam, ends); push(Math.max(1.4, back.dur), q => back.at(q)); hold(0.8 * sp, ends);
    }
    hold((+cfg.hold || 0) + 0.4, cam);
    cp = { u, sp, routes, segs, dur: Math.max(3, t), F, T }; ck = key; return cp;
  }
  function camAt(p, t) {
    for (const s of p.segs) if (t < s.t0 + s.dur) { const q = cl((t - s.t0) / s.dur, 0, 1); if (s.kind === 'fly') return s.fl.at(q); const c = s.cam; return { lon: c.lon, lat: c.lat, k: c.k * (1 + 0.025 * q) }; }
    const s = p.segs[p.segs.length - 1]; return s.kind === 'fly' ? s.fl.at(1) : s.cam;
  }
  function duration(cfg, look) { if (GeoData.state.status !== 'ready') { GeoData.load(); return 4; } const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; }
  function draw(ctx, t, cfg, look, W, H) {
    const C = E.palette(look), u = Math.min(W, H) / 1080;
    if (GeoData.state.status !== 'ready') { GeoData.load(); Globe.loading(ctx, W, H, C, look, u); return; }
    const p = plan(cfg, look, W, H), cam = Globe.smooth(tt => camAt(p, tt), t, p.dur), d = Math.min(1, t / 1.2), sp = p.sp;
    const fromCol = E.COLOURS[cfg.fromColour] || '#f5821f', toCol = E.COLOURS[cfg.toColour] || '#3fae49', routeCol = E.COLOURS[cfg.routeColour] || '#f7c531';
    ctx.save(); E.drawBg(ctx, C, look, W, H, Math.sin(t * 0.3) * 20 * u, 0);
    cam.dy = H > W ? -H * 0.02 : H * 0.03; cam.lon += Math.sin(t * 0.5) * 0.4 * d / cam.k;
    const proj = Globe.projection(W, H, cam);
    const path = Globe.drawGlobe(ctx, W, H, proj, C, look, u); Globe.outline(ctx, W, H, proj, C, u);
    // Place highlights
    const marks = new Map(), labels = [];
    const mark = (pl, col, t0, isDest) => { if (!pl || t < t0) return; const prev = marks.get(pl.name); if (!prev || t0 < prev.t0) marks.set(pl.name, { pl, col, t0, isDest }); };
    p.routes.forEach(r => {
      const hiO = cfg.highlight === 'both', hiD = cfg.highlight !== 'none';
      if (hiO || cfg.mode === 'chain') mark(r[0], r[0] === p.routes[0][0] || cfg.mode !== 'chain' ? fromCol : toCol, r.origin ?? r.start, false);
      if (hiD) mark(r[1], toCol, r.arrive, true);
    });
    marks.forEach(m => {
      const e = t - m.t0;
      if (m.pl.P) Globe.country(ctx, proj, m.pl.P, { preview: look.preview,  trace: 0, fill: ease.io4(e / (0.6 * sp)), lift: ease.io4((e - 0.3) / 0.4) * 10 * u }, m.col, C, u);
      else if (Globe.visible(proj, m.pl.pt)) { const q = proj(m.pl.pt); Globe.pin(ctx, q[0], q[1], 64 * u, m.col, C, u, e / (0.55 * sp)); }
      if (m.isDest && e > 0 && e < 0.9 && Globe.visible(proj, m.pl.pt)) { const q = proj(m.pl.pt); E.ripple(ctx, q[0], q[1], 110 * u, e / 0.9, m.col, u); E.burst(ctx, q[0], q[1], 90 * u, (e - 0.05) / 0.45, C, u, 12); }
    });
    // Labels
    const labelFor = (pl, t0) => { if (cfg.labels === 'none' || !pl || t < t0) return; const fade = Globe.labelFade(proj, pl.pt, W, H, u); if (fade <= 0.01) return; let box; if (pl.P && (box = Globe.screenBox(proj, pl.P, look.preview)) && box[1][0] - box[0][0] > 2) { } else { const q = proj(pl.pt); box = [[q[0] - 30 * u, q[1] - 80 * u], [q[0] + 30 * u, q[1] + 10 * u]]; } labels.push({ text: pl.name, box, alpha: fade, prog: spring((t - t0) * 1.2, 6.5, 9) }); };
    const seen = new Set();
    p.routes.forEach((r, i) => {
      if (!seen.has(r[0].name) && (cfg.mode !== 'chain' || i === 0)) { seen.add(r[0].name); labelFor(r[0], (r.origin ?? r.start) + 0.3); }
      if (!seen.has(r[1].name)) { seen.add(r[1].name); labelFor(r[1], cfg.labels === 'flight' ? r.start + 0.2 : r.arrive + 0.25); }
    });
    // Routes and vehicles
    const R = proj.scale(), late = [];
    p.routes.forEach((r, i) => {
      if (t < r.start - 0.4) return;
      if (r.path) { surface(ctx, r, i, t, cfg, proj, path, C, u, routeCol, late); return; }
      const gi = d3.geoInterpolate(r[0].pt, r[1].pt), dd = d3.geoDistance(r[0].pt, r[1].pt), q = ease.io3((t - r.start) / r.D), planned = ease.io3((t - r.start + 0.4) / 0.6);
      // Flight path arcs up off the globe in 3D, so it reads as a curve rather than a flat line. Boats stay on the water.
      // The flight path is a real 3D curve fixed to the globe: it rises off the surface and also bends to the north side of the
      // straight route. Because its shape belongs to the world, not the screen, it can't flip or warp as the camera moves,
      // and it passes behind the globe exactly where the globe hides it.
      const air = cfg.vehicle !== 'dinghy', alt = air ? cl(dd * 0.22, 0.035, 0.18) : 0, lat = Math.min(0.25, dd * (air ? 0.2 : 0.07)), rotF = d3.geoRotation(proj.rotate()), [tx, ty] = proj.translate();
      const V = ll => { const lo = ll[0] * Math.PI / 180, la = ll[1] * Math.PI / 180; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
      const A3 = V(r[0].pt), B3 = V(r[1].pt); let nrm = [A3[1] * B3[2] - A3[2] * B3[1], A3[2] * B3[0] - A3[0] * B3[2], A3[0] * B3[1] - A3[1] * B3[0]]; const nl = Math.hypot(...nrm) || 1; nrm = nrm.map(v => v / nl); if (nrm[2] < 0) nrm = nrm.map(v => -v);
      const at3 = v => { v = cl(v, 0, 1); const s = Math.sin(Math.PI * v), g = V(gi(v)), d = [g[0] + nrm[0] * lat * s, g[1] + nrm[1] * lat * s, g[2] + nrm[2] * lat * s], dl = Math.hypot(...d), h = 1 + alt * s;
        const ll = [Math.atan2(d[1], d[0]) * 180 / Math.PI, Math.asin(cl(d[2] / dl, -1, 1)) * 180 / Math.PI], q = rotF(ll), la2 = q[1] * Math.PI / 180, lo2 = q[0] * Math.PI / 180;
        const X = Math.cos(la2) * Math.sin(lo2) * h, Y = Math.sin(la2) * h, Z = Math.cos(la2) * Math.cos(lo2) * h, rr = Math.hypot(X, Y);
        return { x: tx + R * X, y: ty - R * Y, vis: Z >= 0 || rr > 1, show: Z >= 0 ? 1 : cl((rr - 1) / 0.02, 0, 1) }; };
      const N = 90, trace = pts => { ctx.beginPath(); let pen = false; pts.forEach(a => { if (!a.vis) { pen = false; return; } pen ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y); pen = true; }); };
      // The whole arc is sketched in faintly as a dashed flight plan first, so the curve reads before the line is drawn along it
      const full = []; for (let k = 0; k <= N; k++) full.push(at3(k / N));
      ctx.save(); ctx.setLineDash([6 * u, 10 * u]); ctx.globalAlpha = 0.22 * planned; ctx.beginPath(); path({ type: 'LineString', coordinates: [r[0].pt, gi(0.5), r[1].pt] }); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5 * u; ctx.stroke();
      ctx.setLineDash([12 * u, 12 * u]); ctx.lineDashOffset = -t * 30 * u; ctx.globalAlpha = 0.7 * planned; trace(full); ctx.strokeStyle = C.ink; ctx.lineWidth = 4 * u; ctx.stroke(); ctx.restore();
      if (q <= 0) return;
      const arc = []; for (let k = 0; k <= N; k++) arc.push(at3(q * k / N));
      const strokeArc = () => trace(arc);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; strokeArc(); ctx.strokeStyle = routeCol; ctx.globalAlpha = 0.9; ctx.lineWidth = 12 * u; ctx.stroke(); ctx.globalAlpha = 1; strokeArc(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3.5 * u; ctx.stroke(); ctx.restore();
      const here = at3(q); if (q >= 1 || here.show <= 0.01) return;
      const a = at3(q - 0.01), b = at3(q + 0.01), c = [here.x, here.y], ang = Math.atan2(b.y - a.y, b.x - a.x);
      const size = (cfg.vehicle === 'plane' ? 104 : cfg.vehicle === 'arrow' ? 90 : 86) * u * (1 + 0.25 * Math.sin(Math.PI * q) * (air ? 1 : 0));
      if (air && Globe.visible(proj, gi(q))) { const g = proj(gi(q)); Globe.shadowBlob(ctx, g[0] + 6 * u, g[1] + 4 * u, size * 0.9 * (1 - 0.4 * Math.sin(Math.PI * q)), C, 0.28 * (1 - 0.5 * Math.sin(Math.PI * q))); }
      // Fades and shrinks a touch as it slips over the horizon, instead of blinking out
      late.push(() => { ctx.save(); ctx.globalAlpha *= here.show; Globe.vehicle(ctx, cfg.vehicle, c[0], c[1], ang, size * (0.85 + 0.15 * here.show), C, u, t + i, cfg.vehicle === 'dinghy' ? '#f5821f' : cfg.vehicle === 'arrow' ? C.accent2 : '#ffffff'); ctx.restore(); });
    });
    // Vehicles go on top of the name labels so they're never hidden behind one
    Globe.placeLabels(ctx, labels, W, H, u, C, C.accent2); late.forEach(f => f());
    ctx.restore();
    E.title(ctx, cfg.title, t, W, H, C, u); E.fadeIn(ctx, t, W, H, C, look);
  }
  // Ships and cars are drawn side on, flipped to face the way they're heading, with a gentle tilt on climbs.
  // inner(ctx, U) draws extra things in the vehicle's own frame (prop units, facing its natural way), e.g. a car on deck.
  const FACE = { car: 1, ferry: -1, cruise: -1, cargo: -1 };
  const tiltOf = (ang, dir) => { let a = dir > 0 ? ang : ang - Math.PI; a = Math.atan2(Math.sin(a), Math.cos(a)); return cl(a, -0.3, 0.3) * 0.6; };
  function sideOn(ctx, kind, x, y, ang, size, u, t, wheel, sea, C, o = {}) {
    const dir = Math.cos(ang) < 0 ? -1 : 1, def = Layers.PROPS[kind], wpx = size * (kind === 'car' ? 1.35 : 1.9), I = { u: wpx / (3 * def.w), wheel, bob: 0 }, U = 3 * I.u, Uh = U * def.h;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tiltOf(ang, dir));
    if (sea) { ctx.translate(0, Math.sin(t * 5) * size * 0.03); ctx.rotate(Math.sin(t * 3.7) * 0.04); }
    ctx.translate(0, -Uh * 0.3); if (o.dx) ctx.translate(o.dx * U * (FACE[kind] * dir < 0 ? -1 : 1), 0);
    ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha; const sc = o.scale ?? 1; if (sc !== 1) { ctx.translate(0, Uh * 0.5); ctx.scale(sc, sc); ctx.translate(0, -Uh * 0.5); }
    if (sea && !o.still) { ctx.save(); ctx.scale(dir, 1); ctx.strokeStyle = C.ink; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const ph = (t * 1.8 + k / 3) % 1; ctx.globalAlpha *= 1; ctx.save(); ctx.globalAlpha *= 0.8 * (1 - ph); const x0 = -wpx * (0.5 + ph * 0.5), yy = Uh * 0.42 + (k - 1) * 4 * u; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - wpx * (0.18 + ph * 0.2), yy); ctx.stroke(); ctx.restore(); } ctx.restore(); }
    else if (!sea && o.puffs !== false) { ctx.save(); ctx.scale(dir, 1); for (let k = 0; k < 3; k++) { const ph = (t * 1.6 + k / 3) % 1; ctx.save(); ctx.globalAlpha *= 0.55 * (1 - ph); ctx.fillStyle = '#c9ced6'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(-wpx * (0.55 + ph * 0.35), Uh * 0.18 - ph * size * 0.15, size * (0.05 + ph * 0.07), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); } ctx.restore(); }
    I.flip = FACE[kind] * dir < 0; if (!(o.alpha <= 0.002)) Layers.TYPES.prop.draw(ctx, { kind }, t, I); ctx.restore();
    if (o.inner) { ctx.save(); ctx.scale(I.flip ? -U : U, U); o.inner(ctx, U, I.flip ? -1 : 1); ctx.restore(); }
    ctx.restore(); return { dir, wpx, U, Uh };
  }
  // A car drawn inside a ship's frame (prop units). It faces the way the ship sails, which is the ship's natural left.
  function deckCar(ctx, x, y, w, rot, sq, t, wheel, U) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1 + sq * 0.18, 1 - sq * 0.28); Layers.TYPES.prop.draw(ctx, { kind: 'car' }, t, { u: w / 360, flip: true, wheel }); ctx.restore();
  }
  function puff(ctx, x, y, r, a, C, U) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6 / U * 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r * 0.8, y + r * 0.2, r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // The cargo ship scene for a car crossing an ocean: the ship pops up behind the car, the car revs, backflips onto the
  // containers and the ship toots and sails off. On the far side the car leaps off as the ship slips away underneath it.
  function shipScene(ctx, c, ang, s, u, run, uu, t, C, wheel) {
    const b = run.hb ? uu / run.hb : 1, a = run.ha ? (uu - (1 - run.ha)) / run.ha : 0, boarding = b < 1, landing = a > 0;
    const shipPx = s * 1.9, U = shipPx / 220, carNormal = s * 1.35 / U, carDeck = 70, yNormal = (86 * 0.3 * U - s * 1.35 * 53 / 120 * 0.3) / U, deck = [-8, -25 - carDeck * 53 / 120 / 2];
    let dx = 0, scale = 1, alpha = 1;
    if (boarding) { const k = cl((b - 0.1) / 0.16, 0, 1); scale = 0.05 + 0.95 * ease.back(k, 2.2); alpha = cl(k * 3, 0, 1); }
    if (landing) { dx = a < 0.25 ? 0 : 230 * ease.in3((a - 0.25) / 0.45); const f = cl((a - 0.6) / 0.4, 0, 1); scale = 1 - 0.75 * ease.in3(f); alpha = 1 - f; }
    const inner = (g, Uq, fx) => {
      // Car position in the ship frame. The ship frame is offset by dx, so the car's fixed world spot is at -dx.
      let x, y, w, rot = 0, sq = 0;
      const home = [-dx, yNormal];
      if (boarding) {
        // Backs up for a run up, revs, then leaps forward onto the containers with a flip
        const back = [home[0] + 150 + carNormal * 0.3, home[1]];
        if (b < 0.26) { const k = ease.sine(b / 0.26); x = lerp(home[0], back[0], k); y = home[1]; w = lerp(carNormal, carNormal * 0.85, k); }
        else if (b < 0.4) { x = back[0] + Math.sin(t * 70) * 2; y = back[1]; w = carNormal * 0.85; }
        else if (b < 0.7) { const k = ease.sine((b - 0.4) / 0.3); x = lerp(back[0], deck[0], k); w = lerp(carNormal * 0.85, carDeck, k); y = lerp(back[1], deck[1], k) - Math.sin(Math.PI * k) * 180; rot = -Math.PI * 2 * k; }
        else { const k = cl((b - 0.7) / 0.12, 0, 1); x = deck[0]; y = deck[1]; w = carDeck; sq = Math.sin(Math.PI * k) * (1 - k * 0.4); }
        if (b > 0.24 && b < 0.42) for (let k = 0; k < 3; k++) { const ph = (t * 3 + k / 3) % 1; puff(g, back[0] + carNormal * 0.85 * (0.55 + ph * 0.4), back[1] + 5 - ph * 30, 7 + ph * 10, 0.7 * (1 - ph), C, Uq); }
      } else if (landing) {
        if (a < 0.2) { x = deck[0] + Math.sin(t * 60) * 1.2; y = deck[1]; w = carDeck; }
        else if (a < 0.62) { const k = ease.sine((a - 0.2) / 0.42); x = lerp(deck[0], home[0], k); w = lerp(carDeck, carNormal, k); y = lerp(deck[1], home[1], k) - Math.sin(Math.PI * k) * 150; rot = Math.PI * 2 * k; }
        else { const k = cl((a - 0.62) / 0.14, 0, 1); x = home[0]; y = home[1]; w = carNormal; sq = Math.sin(Math.PI * k) * (1 - k * 0.4); }
      } else { x = deck[0]; y = deck[1] + Math.sin(t * 4) * 1.2; w = carDeck; rot = Math.sin(t * 3.1) * 0.03; }
      // The ship fades when it leaves, but the car must not fade with it
      deckCar(g, x, y, w, rot, sq, t, wheel, Uq);
      // TOOT TOOT from the funnel once the car is aboard
      const tt = boarding ? b : 1 + (uu - run.hb) / Math.max(1e-6, run.hb) * 0.5; if (tt > 0.8 && tt < 1.7) { const k = (tt - 0.8) / 0.9;
        for (let j = 0; j < 3; j++) { const ph = cl(k * 1.6 - j * 0.25, 0, 1); if (ph > 0 && ph < 1) puff(g, 72 + j * 6, -40 - ph * 60, 8 + ph * 14, 1 - ph, C, Uq); }
        const pop = spring(k * 1.4, 7, 12), fade = 1 - cl((k - 0.7) / 0.3, 0, 1); if (fade > 0) { g.save(); g.translate(60, -120); g.scale(fx * pop, pop); g.rotate(-0.12); g.font = '34px Anton, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha *= fade; g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = C.ink; g.strokeText('TOOT TOOT!', 0, 0); g.fillStyle = '#ffffff'; g.fillText('TOOT TOOT!', 0, 0); g.restore(); } }
    };
    sideOn(ctx, 'cargo', c[0], c[1], ang, s, u, t, 0, true, C, { dx, scale, alpha, inner, still: boarding });
  }
  function surface(ctx, r, i, t, cfg, proj, path, C, u, routeCol, late) {
    const P = r.path, ql = cl((t - r.start) / r.D, 0, 1), q = r.prog(ql), planned = ease.io3((t - r.start + 0.4) / 0.6), car = cfg.vehicle === 'car';
    const sub = (f0, f1) => { const out = [P.at(f0)]; P.pts.forEach((pt, k) => { const f = P.lens[k] / P.len; if (f > f0 && f < f1) out.push(pt); }); out.push(P.at(f1)); return out; };
    const line = c => { ctx.beginPath(); path({ type: 'LineString', coordinates: c }); };
    // Dashed plan of the whole route, plus dotted links from inland places to the port
    ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = 0.7 * planned; ctx.strokeStyle = C.ink;
    ctx.setLineDash([12 * u, 12 * u]); ctx.lineDashOffset = -t * 30 * u; line(P.pts); ctx.lineWidth = 4 * u; ctx.stroke();
    ctx.setLineDash([1, 10 * u]); ctx.lineDashOffset = 0; ctx.lineWidth = 5 * u; [P.startLink, P.endLink].forEach(L => { if (L) { line(L); ctx.stroke(); } }); ctx.restore();
    if (t < r.start) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    r.runsE.forEach(run => { if (run.f0 >= q || q <= 0) return; const c = sub(run.f0, Math.min(q, run.f1)), wet = run.kind !== 'road';
      line(c); ctx.strokeStyle = routeCol; ctx.globalAlpha = wet && car ? 0.55 : 0.9; ctx.lineWidth = 12 * u; ctx.stroke();
      ctx.globalAlpha = 1; ctx.setLineDash(wet ? [14 * u, 10 * u] : []); line(c); ctx.strokeStyle = C.ink; ctx.lineWidth = 3.5 * u; ctx.stroke(); ctx.setLineDash([]); });
    ctx.restore();
    if (ql >= 1) return;
    const here = P.at(q), rot = proj.rotate(), show = cl((Math.PI / 2 - d3.geoDistance(here, [-rot[0], -rot[1]])) / 0.08, 0, 1); if (show <= 0.01) return;
    // Heading: look a little ahead and behind along the route (steady even while waiting in port)
    const c = proj(here), a = proj(P.at(q - 0.004)), b = proj(P.at(q + 0.004)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), size = 86 * u, s = size * (0.85 + 0.15 * show), wheel = q * P.len * 2600;
    late.push(() => { ctx.save(); ctx.globalAlpha *= show;
    const run = r.runAt(ql), uu = run.e1 > run.e0 ? cl((ql - run.e0) / (run.e1 - run.e0), 0, 1) : 1;
    if (cfg.vehicle === 'dinghy') Globe.vehicle(ctx, 'dinghy', c[0], c[1], ang, s, C, u, t + i, '#f5821f');
    else if (car && run.kind === 'ship') shipScene(ctx, c, ang, s, u, run, uu, t + i, C, wheel);
    else if (car && run.kind === 'ferry') {
      // Car on a wee ferry: the ferry pops up under the car at the port, and pops away again on the far side
      const pop = 0.35 + 0.65 * ease.back(cl(Math.min(uu / Math.max(1e-6, run.hb), (1 - uu) / Math.max(1e-6, run.ha)), 0, 1), 1.4);
      sideOn(ctx, 'ferry', c[0], c[1], ang, s * 0.85 * pop, u, t + i, 0, true, C, { inner: (g, Uq) => deckCar(g, -50, -12 - 70 * 53 / 120 / 2 * 0.8, 56, 0, 0, t, 0, Uq) });
    } else sideOn(ctx, cfg.vehicle, c[0], c[1], ang, s, u, t + i, wheel, cfg.vehicle !== 'car', C);
    ctx.restore(); });
  }
  function form(root, cfg, changed) {
    const { H, field, sel, txt, card, grid2, colourOpts, btn, iconBtn } = UI; root.innerHTML = '';
    const re = () => form(root, cfg, changed), set = (k, v, r) => { cfg[k] = v; changed(); if (r) re(); };
    GeoData.load(); if (GeoData.state.status !== 'ready') GeoData.onChange(() => { let s; try { s = status; } catch (e) { return; } if (s && root.contains(s)) re(); });
    const st = GeoData.state;
    const placeNames = () => [...GeoData.state.features.map(f => ({ name: f.name })), ...GeoData.CITIES.map(c => ({ name: c.name, sub: c.country }))];
    const status = st.status === 'error' ? H('div', { className: 'card' }, H('p', { className: 'hint', style: 'color:#ff8a80' }, st.error), btn('Retry', () => GeoData.retry())) : st.status !== 'ready' ? H('p', { className: 'hint' }, 'Downloading the world map…') : '';
    const listEl = (arr, label, max) => {
      const wrap = H('div', { className: 'ms' });
      arr.forEach((n, i) => { const ok = st.status !== 'ready' || !n || !!place(n);
        const inp = H('input', { type: 'text', value: n, placeholder: 'Country or city', 'aria-label': label + ' ' + (i + 1), on: { input: e => { arr[i] = e.target.value; changed(); }, change: () => re() } });
        wrap.append(H('div', { className: 'msrow', style: 'grid-template-columns:minmax(0,1fr) 34px' }, inp,
          iconBtn('×', 'Remove', () => { if (arr.length > 1) { arr.splice(i, 1); changed(); re(); } })), UI.suggest(inp, placeNames));
        if (!ok) wrap.append(H('span', { className: 'hint', style: 'color:#ff8a80' }, `"${n}" isn't in the map or city list. Pick a name from the suggestions.`)); });
      if (arr.length < max) wrap.append(btn('Add ' + label.toLowerCase(), () => { arr.push(''); changed(); re(); }));
      return wrap;
    };
    const one = cfg.mode === 'one-to-many', many = cfg.mode === 'many-to-one', chain = cfg.mode === 'chain';
    if (one && cfg.from.length > 1) cfg.from.length = 1; if (many && cfg.to.length > 1) cfg.to.length = 1;
    root.append(status,
      card('Flights', field('Title', txt(cfg.title, v => set('title', v), 'Optional red banner')),
        field('Route type', sel(cfg.mode, [['one-to-many', 'One place to many'], ['many-to-one', 'Many places to one'], ['chain', 'Journey in order (A to B to C)']], v => set('mode', v, true)))),
      card(chain ? 'Start' : 'From', listEl(cfg.from, 'Start place', one || chain ? 1 : 8)),
      card(chain ? 'Then on to, in order' : 'To', listEl(cfg.to, 'Destination', many ? 1 : 8)),
      card('Camera', grid2(field('Camera', sel(cfg.camera || 'auto', [['auto', 'Zoom out to show the trip'], ['follow', 'Stay close and follow']], v => set('camera', v, true))),
        cfg.camera === 'follow' ? field('Follow distance', sel(cfg.followZoom || 'medium', [['close', 'Close up'], ['medium', 'Medium'], ['far', 'Same as the start shot']], v => set('followZoom', v))) : ''),
        cfg.camera === 'follow' && !chain && (one ? cfg.to.length : cfg.from.length) > 1 ? H('p', { className: 'hint' }, 'Follow works on one journey at a time. With several journeys at once the camera shows them all, so pick "Journey in order" to follow each one.') : ''),
      card('Style', grid2(field('Travelling by', sel(cfg.vehicle, [['plane', 'Plane'], ['arrow', 'Cartoon arrow'], ['car', 'Car (by road)'], ['dinghy', 'Dinghy'], ['ferry', 'Ferry'], ['cruise', 'Cruise ship'], ['cargo', 'Cargo ship']], v => set('vehicle', v))),
        field('Name labels', sel(cfg.labels, [['arrival', 'Show on arrival'], ['flight', 'Show while flying'], ['none', 'No labels']], v => set('labels', v)))),
        field('Fill in countries', sel(cfg.highlight, [['both', 'Start and destination'], ['destination', 'Destination only'], ['none', 'No fill']], v => set('highlight', v))),
        grid2(field('Start colour', sel(cfg.fromColour, colourOpts(), v => set('fromColour', v))), field('Destination colour', sel(cfg.toColour, colourOpts(), v => set('toColour', v)))),
        field('Route colour', sel(cfg.routeColour, colourOpts(), v => set('routeColour', v))),
        field('Speed ramp', sel(cfg.ramp || 'none', Layers.RAMP_OPTS, v => set('ramp', v))),
        grid2(field('Speed', sel(cfg.speed, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], v => set('speed', v))), field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v))))));
  }
  const holdUpd = (cfg, ch) => { cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 2) / 2)); };
  const holdClip = (a, b) => ({ id: 'hold', start: a, end: b, label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' });
  const editor = { formIsScene: true,
    tracks(cfg, look) { if (GeoData.state.status !== 'ready') return [{ id: 'routes', name: 'Flights', items: [] }]; const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), last = p.segs[p.segs.length - 1];
      const item = (r, i) => ({ id: 'route:' + i, start: r.start, end: r.arrive, label: r[0].name + ' to ' + r[1].name, colour: '#5d5222', move: false, trim: 'end', minLen: 0.8, maxLen: 120, timed: true, title: 'Drag the right edge to make this journey slower or quicker' });
      // A journey in order sits on one track; journeys that overlap each get their own so every bar can be grabbed
      const rows = cfg.mode === 'chain' || p.routes.length < 2 ? [{ id: 'routes', name: 'Journeys', colour: E.COLOURS[cfg.routeColour] || '#f7c531', items: p.routes.map(item) }] : p.routes.map((r, i) => ({ id: 'routes:' + i, name: r[1 - (cfg.mode === 'many-to-one' ? 1 : 0)].name, colour: E.COLOURS[cfg.routeColour] || '#f7c531', items: [item(r, i)] }));
      return [...rows, { id: 'end', name: 'End', items: [holdClip(last.t0, last.t0 + (+cfg.hold || 0))] }]; },
    update(cfg, id, ch) { if (id === 'hold') holdUpd(cfg, ch); else if (id.startsWith('route:')) E.setTm(cfg, id, ch.end - ch.start); },
    scene(root, cfg, changed) { form(root, cfg, changed); } };
  return { id: 'flights', name: 'Flights', defaults, duration, draw, form, editor, _plan: plan };
})();

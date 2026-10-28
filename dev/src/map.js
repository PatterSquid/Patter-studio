/* World map module: highlight countries and cities on the comic globe, flying between them. */
const MapMod = (() => {
  const { cl, lerp, ease, spring } = E;
  const SPD = { slow: 1.3, normal: 1, fast: 0.75 };
  function defaults() {
    return { title: '', finale: 'all', speed: 'normal', hold: 2, labelColour: 'Neon red',
      stops: [{ type: 'country', name: 'Scotland', colour: 'Irn-Bru orange', label: true }, { type: 'city', name: 'Glasgow', mode: 'pin', km: 25, colour: 'Neon red', label: true, lat: '', lon: '' }, { type: 'country', name: 'United States', colour: 'Grass green', label: true }] };
  }
  function resolve(s) {
    if (s.type === 'country') { const f = GeoData.find(s.name); if (!f) return null; const P = Globe.prep(f); return { s, P, pt: P.c }; }
    const c = GeoData.city(s.name), lat = parseFloat(s.lat), lon = parseFloat(s.lon);
    if (isFinite(lat) && isFinite(lon)) return { s, pt: [lon, lat] }; if (c) return { s, pt: [c.lon, c.lat] }; return null;
  }
  let ck = '', cp = null;
  // Glide: pan straight across at the current zoom instead of pulling out into space and back in
  function glide(a, b) {
    const pa = [a.lon, a.lat], pb = [b.lon, b.lat], d = d3.geoDistance(pa, pb), gi = d3.geoInterpolate(pa, pb), dur = cl(1.0 + Math.sqrt(d) * 2.2, 1.2, 4.5);
    return { dur, at: q => { const e = ease.io3(q), c = gi(e); return { lon: c[0], lat: c[1], k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), ease.sine(q))) }; } };
  }
  function plan(cfg, look, W, H) {
    const key = JSON.stringify(cfg) + look.format + GeoData.state.status + GeoData.state.version + (E.fontVersion || 0); if (key === ck) return cp;
    const u = Math.min(W, H) / 1080, sp = SPD[cfg.speed] || 1, items = cfg.stops.map(resolve).filter(Boolean);
    const segs = [], first = items[0] ? items[0].pt : [0, 20];
    let cam = { lon: first[0] - 55, lat: cl(first[1], -30, 30) * 0.6, k: 0.92 }, t = 0;
    const startCam = cam, intro = { lon: first[0] - 25, lat: cam.lat, k: 1 };
    segs.push({ kind: 'fly', t0: 0, dur: 1.3, fl: { at: q => { const e = ease.sine(q); return { lon: lerp(startCam.lon, intro.lon, e), lat: intro.lat, k: lerp(0.92, 1, e) }; } } }); t = 1.3; cam = intro;
    items.forEach((it, i) => {
      const target = it.P ? Globe.camForCountry(it.P, W, H, H > W ? 0.6 : 0.5) : { lon: it.pt[0], lat: it.pt[1], k: it.s.mode === 'area' ? cl(5200 / Math.max(5, +it.s.km || 25) / 20, 3, 14) : 7 };
      // The stop's bar covers flying in and staying. Dragged longer it stays longer; shorter, the whole thing speeds up.
      const fl = cfg.cameraMove === 'glide' ? glide(cam, target) : Globe.flight(cam, target), autoAct = +it.s.hold > 0 ? +it.s.hold : (it.P ? 3.4 : it.s.mode === 'area' ? 1.7 : 1.4) * sp, L = E.tm(cfg, 'stop:' + cfg.stops.indexOf(it.s)), base = fl.dur + (it.P ? 3.4 : it.s.mode === 'area' ? 1.7 : 1.4) * sp, f = L !== undefined ? Math.min(1, L / base) : 1;
      it.sp = sp * f; const flyD = fl.dur * f; it.fly0 = t; segs.push({ kind: 'fly', t0: t, dur: flyD, fl }); t += flyD; it.a = t;
      const act = L !== undefined ? Math.max(0.2, L - flyD) : autoAct; it.act = act; segs.push({ kind: 'hold', t0: t, dur: act, cam: target }); t += act; cam = Object.assign({}, target, { k: target.k * 1.03 });
    });
    let fin = null;
    if (cfg.finale === 'all' && items.length > 1) { const pts = []; items.forEach(it => { pts.push(it.pt); if (it.P) { const P = it.P, d = Math.max(P.bw, P.bh) * 0.6; pts.push([P.c[0] - d * 57, P.c[1]], [P.c[0] + d * 57, P.c[1]]); } }); const target = Globe.camForPoints(pts, W, H, H > W ? 0.85 : 0.92); const fl = Globe.flight(cam, target); fin = t; segs.push({ kind: 'fly', t0: t, dur: fl.dur, fl }); t += fl.dur; cam = target; }
    const hold = (+cfg.hold || 0) + 0.4; segs.push({ kind: 'hold', t0: t, dur: hold, cam }); t += hold;
    cp = { u, sp, items, segs, dur: Math.max(3, t), fin }; ck = key; return cp;
  }
  function camAt(p, t) {
    for (const s of p.segs) if (t < s.t0 + s.dur) { const q = cl((t - s.t0) / s.dur, 0, 1); if (s.kind === 'fly') return s.fl.at(q); const c = s.cam; return { lon: c.lon, lat: c.lat, k: c.k * (1 + 0.03 * q) }; }
    const s = p.segs[p.segs.length - 1]; return s.kind === 'fly' ? s.fl.at(1) : s.cam;
  }
  function duration(cfg, look) { if (GeoData.state.status !== 'ready') { GeoData.load(); return 4; } const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; }
  function draw(ctx, t, cfg, look, W, H) {
    const C = E.palette(look), u = Math.min(W, H) / 1080;
    if (GeoData.state.status !== 'ready') { GeoData.load(); Globe.loading(ctx, W, H, C, look, u); return; }
    const p = plan(cfg, look, W, H), cam = Globe.smooth(tt => camAt(p, tt), t, p.dur), lblCol = E.COLOURS[cfg.labelColour] || C.accent2;
    ctx.save(); const d = Math.min(1, t / 1.2); E.drawBg(ctx, C, look, W, H, Math.sin(t * 0.3) * 20 * u, 0);
    cam.dy = H > W ? -H * 0.02 : H * 0.03; cam.lon += Math.sin(t * 0.5) * 0.4 * d / cam.k;
    const proj = Globe.projection(W, H, cam); Globe.drawGlobe(ctx, W, H, proj, C, look, u); Globe.outline(ctx, W, H, proj, C, u);
    const labels = [];
    p.items.forEach((it, i) => {
      if (t < it.a - 0.05) return; const a = it.a, col = E.COLOURS[it.s.colour] || '#f5821f', sp = it.sp || p.sp, next = p.items[i + 1], lblEnd = next ? next.fly0 + 0.35 : p.fin !== null ? p.fin + 0.35 : Infinity;
      // Names fade as the camera moves on, then all come back once it has pulled back to show everything
      const finSeg = p.fin !== null ? p.segs.find(sg => sg.t0 === p.fin) : null, lblBack = finSeg ? ease.io3((t - p.fin - finSeg.dur * 0.75) / 0.5) : 0, lblFade = Math.max(1 - ease.io3((t - lblEnd + 0.35) / 0.35), lblBack);
      if (it.P) {
        const st = { trace: ease.io4((t - a - 0.1) / (1.7 * sp)), isles: ease.io4((t - a - 1.6 * sp) / (0.5 * sp)), fill: ease.io4((t - a - 1.95 * sp) / (0.7 * sp)), tfade: 1 - ease.io3((t - a - 2.5 * sp) / 0.5), lift: ease.io4((t - a - 2.7 * sp) / 0.45) * 12 * u };
        st.preview = look.preview; Globe.country(ctx, proj, it.P, st, col, C, u);
        const li = t - a - 2.7 * sp; if (li > 0 && li < 0.45 && Globe.visible(proj, it.P.c)) { const q = proj(it.P.c), b = Globe.screenBox(proj, it.P, look.preview); const r = b ? Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) * 0.62 : 200 * u; E.burst(ctx, q[0], q[1], r, li / 0.45, C, u, 14); }
        if (it.s.label && lblFade > 0) { const b = Globe.screenBox(proj, it.P, look.preview); if (b) labels.push({ text: it.s.name, box: b, alpha: Globe.labelFade(proj, it.pt, W, H, u), prog: spring((t - a - 2.9 * sp) * 1.2, 6.5, 9) * lblFade }); }
      } else {
        const q = proj(it.pt), vis = Globe.visible(proj, it.pt);
        if (it.s.mode === 'area') { Globe.area(ctx, proj, it.pt[0], it.pt[1], +it.s.km || 25, col, C, u, (t - a - 0.1) / (0.8 * sp)); if (vis && it.s.label && lblFade > 0) { const r = (+it.s.km || 25) / 111.2 * Math.PI / 180 * proj.scale(); labels.push({ text: it.s.name, box: [[q[0] - r, q[1] - r], [q[0] + r, q[1] + r]], alpha: Globe.labelFade(proj, it.pt, W, H, u), prog: spring((t - a - 0.7 * sp) * 1.2, 6.5, 9) * lblFade }); } }
        else if (vis) { const size = 74 * u * Math.min(1.25, 0.75 + cam.k * 0.06); Globe.pin(ctx, q[0], q[1], size, col, C, u, (t - a - 0.05) / (0.6 * sp)); if (t - a > 0.35 && t - a < 1.1) E.ripple(ctx, q[0], q[1], 70 * u, (t - a - 0.35) / 0.75, col, u); if (it.s.label && lblFade > 0) labels.push({ text: it.s.name, alpha: Globe.labelFade(proj, it.pt, W, H, u), box: [[q[0] - size * 0.4, q[1] - size * 1.1], [q[0] + size * 0.4, q[1] + 6 * u]], prog: spring((t - a - 0.5 * sp) * 1.2, 6.5, 9) * lblFade }); }
      }
    });
    Globe.placeLabels(ctx, labels, W, H, u, C, lblCol);
    ctx.restore();
    E.title(ctx, cfg.title, t, W, H, C, u); E.fadeIn(ctx, t, W, H, C, look);
  }
  function datalists(root) {
    const { H } = UI, cl1 = H('datalist', { id: 'pt-countries' }, ...GeoData.state.features.map(f => H('option', { value: f.name }))), cl2 = H('datalist', { id: 'pt-cities' }, ...GeoData.CITIES.map(c => H('option', { value: c.name, label: c.country })));
    root.append(cl1, cl2);
  }
  function form(root, cfg, changed) {
    const { H, field, sel, txt, card, grid2, colourOpts, btn, iconBtn } = UI; root.innerHTML = '';
    const re = () => form(root, cfg, changed), set = (k, v, r) => { cfg[k] = v; changed(); if (r) re(); };
    GeoData.load(); if (GeoData.state.status !== 'ready') { GeoData.onChange(() => { let s; try { s = status; } catch (e) { return; } if (s && root.contains(s)) re(); }); }
    const st = GeoData.state;
    const status = st.status === 'error' ? H('div', { className: 'card' }, H('p', { className: 'hint', style: 'color:#ff8a80' }, st.error), btn('Retry', () => GeoData.retry())) : st.status !== 'ready' ? H('p', { className: 'hint' }, 'Downloading the world map…') : '';
    datalists(root);
    const list = H('div', { className: 'ms', style: 'gap:10px' });
    cfg.stops.forEach((s, i) => {
      const found = s.type === 'country' ? !!GeoData.find(s.name) : (!!GeoData.city(s.name) || (isFinite(parseFloat(s.lat)) && isFinite(parseFloat(s.lon))));
      const warn = H('span', { className: 'hint', style: 'color:#ff8a80' }, st.status === 'ready' && !found && s.name ? (s.type === 'country' ? 'Not in the map list. Pick a name from the suggestions.' : 'Not in the city list. Add its latitude and longitude below.') : '');
      const nameIn = H('input', { type: 'text', value: s.name, placeholder: s.type === 'country' ? 'Start typing a country' : 'Start typing a city', 'aria-label': 'Name', on: { input: e => { s.name = e.target.value; changed(); }, change: () => re() } });
      const row = H('div', { className: 'card', style: 'padding:10px;gap:8px;background:#0f1b31' },
        H('div', { style: 'display:grid;grid-template-columns:96px minmax(0,1fr) 34px 34px;gap:6px' },
          sel(s.type, [['country', 'Country'], ['city', 'City']], v => { s.type = v; if (v === 'city' && !s.mode) { s.mode = 'pin'; s.km = 25; } changed(); re(); }, 'Stop type'), nameIn,
          iconBtn('↑', 'Move up', () => { if (i > 0) { [cfg.stops[i - 1], cfg.stops[i]] = [cfg.stops[i], cfg.stops[i - 1]]; changed(); re(); } }),
          iconBtn('×', 'Remove stop', () => { cfg.stops.splice(i, 1); changed(); re(); })),
        UI.suggest(nameIn, () => s.type === 'country' ? GeoData.state.features.map(f => ({ name: f.name })) : GeoData.CITIES.map(c => ({ name: c.name, sub: c.country }))),
        warn,
        grid2(field('Colour', sel(s.colour, colourOpts(), v => { s.colour = v; changed(); })), field('Name label', sel(s.label ? '1' : '0', [['1', 'Show'], ['0', 'Hide']], v => { s.label = v === '1'; changed(); }))),
        s.type === 'city' ? grid2(field('Show as', sel(s.mode, [['pin', 'Map pin'], ['area', 'Highlighted area']], v => { s.mode = v; changed(); re(); })), s.mode === 'area' ? field('Area radius in km', txt(String(s.km ?? 25), v => { const n = parseFloat(v); if (isFinite(n)) { s.km = Math.max(2, Math.min(800, n)); changed(); } }, '25')) : H('span')) : '',
        s.type === 'city' && !GeoData.city(s.name) ? grid2(field('Latitude', txt(s.lat, v => { s.lat = v; changed(); }, '55.86')), field('Longitude', txt(s.lon, v => { s.lon = v; changed(); }, '-4.25'))) : '');
      list.append(row);
    });
    root.append(status,
      card('World map', field('Title', txt(cfg.title, v => set('title', v), 'Optional red banner')),
        field('Moving between stops', sel(cfg.cameraMove || 'arc', [['arc', 'Pull out, then swoop in'], ['glide', 'Stay zoomed and glide across']], v => set('cameraMove', v))),
        grid2(field('At the end', sel(cfg.finale, [['all', 'Pull back to show everything'], ['last', 'Stay on the last stop']], v => set('finale', v))), field('Label colour', sel(cfg.labelColour, colourOpts(), v => set('labelColour', v))))),
      card('Stops, in order', H('p', { className: 'hint' }, 'The camera flies to each stop in turn. Countries are traced and filled, cities get a pin or a highlighted area.'), list,
        H('div', { className: 'btnrow' }, btn('Add country', () => { cfg.stops.push({ type: 'country', name: '', colour: 'Irn-Bru orange', label: true }); changed(); re(); }), btn('Add city', () => { cfg.stops.push({ type: 'city', name: '', mode: 'pin', km: 25, colour: 'Neon red', label: true, lat: '', lon: '' }); changed(); re(); }))),
      card('Animation', field('Speed ramp', sel(cfg.ramp || 'none', Layers.RAMP_OPTS, v => set('ramp', v))), grid2(field('Speed', sel(cfg.speed, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], v => set('speed', v))), field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v))))));
  }
  const holdUpd = (cfg, ch) => { cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 2) / 2)); };
  const holdClip = (a, b) => ({ id: 'hold', start: a, end: b, label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' });
  const editor = { formIsScene: true,
    tracks(cfg, look) { if (GeoData.state.status !== 'ready') return [{ id: 'stops', name: 'Stops', items: [] }]; const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), last = p.segs[p.segs.length - 1];
      const out = [{ id: 'stops', name: 'Stops', colour: '#f5821f', items: p.items.map(it => ({ id: 'stop:' + cfg.stops.indexOf(it.s), start: it.fly0, end: it.a + it.act, label: it.s.name, colour: E.hexMix(E.COLOURS[it.s.colour] || '#f5821f', '#16213a', 0.45), move: false, trim: 'end', minLen: 0.5, maxLen: 120, timed: true, title: 'Fly in, then stay. Drag the right edge to slow this stop down or speed it up.' })) }];
      const end = []; if (p.fin !== null) end.push({ id: 'finale', start: p.fin, end: last.t0, label: 'Pull back', colour: '#3a4660', move: false, trim: 'none' }); end.push(holdClip(last.t0, last.t0 + (+cfg.hold || 0))); out.push({ id: 'end', name: 'End', items: end }); return out; },
    update(cfg, id, ch) { if (id === 'hold') return holdUpd(cfg, ch); E.setTm(cfg, id, ch.end - ch.start); },
    resetTiming(cfg, id) { const s = id.startsWith('stop:') && cfg.stops[+id.split(':')[1]]; if (s) delete s.hold; },
    scene(root, cfg, changed) { form(root, cfg, changed); } };
  return { id: 'map', name: 'World map', defaults, duration, draw, form, editor };
})();

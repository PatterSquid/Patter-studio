  /* ---------- Add-on packs ----------
     A pack is plain data: chalk drawings for places, props and hats, pose keyframes for new actions, and ready-made scenes
     (set pieces). Nothing in a pack is run as code, so a pack can only ever add drawings and moves. Packs arrive from
     GitHub or a dropped file; the app passes them in here, and export workers get the same list so they draw identically. */
  const PACK = { places: {}, props: {}, hats: {}, acts: {}, sets: {}, owner: {}, list: [] };
  const PCOL = c => (typeof c === 'string' && CH[c]) || (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : CH.white);
  const num = (v, d = 0) => { v = +v; return isFinite(v) ? v : d; };
  const str = (v, n = 80) => String(v == null ? '' : v).slice(0, n);
  const pts = (p, max = 400) => Array.isArray(p) ? p.slice(0, max).filter(q => Array.isArray(q) && q.length >= 2).map(q => [num(q[0]), num(q[1])]) : [];
  const paths = (list, max = 300) => (Array.isArray(list) ? list.slice(0, max) : []).map(e => ({ p: pts(e.p), col: PCOL(e.col), w: cl(num(e.w, 5), 1, 30), fill: e.fill === true ? true : (typeof e.fill === 'string' ? PCOL(e.fill) : false) })).filter(e => e.p.length >= 2);
  const idOf = v => str(v, 40).toLowerCase().replace(/[^a-z0-9_]/g, '');
  function packRemove(id) {
    Object.keys(PACK.owner).forEach(key => { if (PACK.owner[key] !== id) return; const [kind, k] = key.split(':'); delete PACK.owner[key];
      if (kind === 'place') { delete PACK.places[k]; const i = PLACES.findIndex(p => p[0] === k); if (i >= 0) PLACES.splice(i, 1); }
      if (kind === 'prop') { delete PACK.props[k]; const i = PROPS.findIndex(p => p[0] === k); if (i >= 0) PROPS.splice(i, 1); delete GRIP[k]; }
      if (kind === 'hat') { delete PACK.hats[k]; const i = HATS.findIndex(p => p[0] === k); if (i >= 0) HATS.splice(i, 1); }
      if (kind === 'act') { delete PACK.acts[k]; delete ACT[k]; }
      if (kind === 'set') delete PACK.sets[k]; });
    PACK.list = PACK.list.filter(p => p.id !== id); Object.keys(setCache).forEach(k => delete setCache[k]); pk = '';
  }
  // Built-in names can't be replaced by a pack, so a pack can never break what is already there
  function packInstall(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('That is not a Patter pack.');
    const id = idOf(raw.id); if (!id) throw new Error('The pack has no name.'); packRemove(id);
    const own = (kind, k) => { if (PACK.owner[kind + ':' + k] && PACK.owner[kind + ':' + k] !== id) return false; PACK.owner[kind + ':' + k] = id; return true; };
    (raw.places || []).slice(0, 40).forEach(pl => { const k = idOf(pl.id); if (!k || (PLACES.some(p => p[0] === k) && !PACK.places[k]) || !own('place', k)) return;
      const marks = {}; Object.entries(pl.marks || {}).slice(0, 20).forEach(([m, v]) => { const mk = str(m, 30).trim(); if (mk && v) marks[mk] = { x: num(v.x, 960), sit: !!v.sit, low: !!v.low, behind: !!v.behind }; });
      PACK.places[k] = { back: paths(pl.back, 600), front: paths(pl.front, 300), texts: (pl.texts || []).slice(0, 40).map(t => ({ s: str(t.s, 60), x: num(t.x, 960), y: num(t.y, 300), size: cl(num(t.size, 50), 8, 300), col: PCOL(t.col), al: t.al === 'left' ? 'left' : t.al === 'right' ? 'right' : 'center' })), marks, ground: pl.ground !== false, blink: (pl.blink || []).slice(0, 10).map(b => ({ x: num(b.x), y: num(b.y), r: cl(num(b.r, 20), 2, 200), col: PCOL(b.col || 'red'), every: cl(num(b.every, 0.8), 0.05, 10), on: idOf(b.on) })) };
      PLACES.push([k, str(pl.label || k, 30)]); });
    (raw.props || []).slice(0, 80).forEach(pr => { const k = idOf(pr.id); if (!k || (PROPS.some(p => p[0] === k) && !PACK.props[k]) || !own('prop', k)) return;
      PACK.props[k] = { paths: paths(pr.paths, 80), scale: cl(num(pr.scale, 1), 0.1, 5), flip: pr.flip !== false }; PROPS.push([k, str(pr.label || k, 30)]);
      const gp = pr.grip || {}; GRIP[k] = { at: pts([gp.at || [0.14, 0.18]])[0] || [0.14, 0.18], side: gp.side === 'back' ? 'back' : undefined, carry: gp.carry ? 1 : undefined, sip: gp.sip ? 1 : undefined, a: num(gp.a, 0) }; });
    (raw.hats || []).slice(0, 40).forEach(h => { const k = idOf(h.id); if (!k || (HATS.some(p => p[0] === k) && !PACK.hats[k]) || !own('hat', k)) return;
      PACK.hats[k] = { paths: paths(h.paths, 40), slit: !!h.slit, col: PCOL(h.col || 'white'), top: num(h.top, 1.3) }; HATS.push([k, str(h.label || k, 30)]); });
    (raw.actions || []).slice(0, 80).forEach(a => { const k = idOf(a.id); if (!k || (ACT[k] && !PACK.acts[k]) || !own('act', k)) return;
      const keys = (a.keys || []).slice(0, 40).map(q => { const o = { p: cl(num(q.p), 0, 1) }; ['hf', 'hb'].forEach(h => { if (Array.isArray(q[h])) o[h] = [num(q[h][0]), num(q[h][1])]; }); ['hop', 'lean', 'tilt', 'lower', 'kneel', 'kick', 'rot', 'sit', 'dx'].forEach(n => { if (q[n] != null) o[n] = num(q[n]); }); if (q.mood) o.mood = str(q.mood, 10); if (q.eyes) o.eyes = str(q.eyes, 10); if (q.emote) o.emote = str(q.emote, 10); if (q.fingers) o.fingers = str(q.fingers, 6); return o; }).sort((x, y) => x.p - y.p);
      const fx = (a.fx || []).slice(0, 12).map(f => ({ k: f.k === 'shout' ? 'shout' : 'word', s: str(f.s, 40), p0: cl(num(f.p0, 0.2), 0, 1), p1: cl(num(f.p1, 0.8), 0, 1), col: PCOL(f.col || 'yellow') }));
      PACK.acts[k] = { keys, fx, hold: idOf(a.hold), give: idOf(a.gives), take: idOf(a.takes), drop: idOf(a.drops), target: a.target === 'person', react: idOf(a.react), at: cl(num(a.hitAt, 0.5), 0, 1), loop: cl(num(a.loop, 0), 0, 20), shake: cl(num(a.shake, 0), 0, 40), trigger: idOf(a.trigger) };
      ACT[k] = [str(a.icon || '⭐', 4), str(a.label || k, 30), ['Talk', 'Move', 'Body', 'Props', 'Fight', 'Rough', 'Feel'].includes(a.group) ? a.group : 'Body', cl(num(a.dur, 1.6), 0.3, 20)]; });
    (raw.setpieces || []).slice(0, 40).forEach(sp => { const k = idOf(sp.id); if (!k || !own('set', k)) return; PACK.sets[k] = JSON.parse(JSON.stringify({ id: k, name: str(sp.name || k, 40), note: str(sp.note, 200), cast: (sp.cast || []).slice(0, 8), scenes: (sp.scenes || []).slice(0, 12), layers: (sp.layers || []).slice(0, 60) })); });
    PACK.list.push({ id, name: str(raw.name || id, 40), version: num(raw.version, 1), note: str(raw.description, 200) });
    Object.keys(setCache).forEach(k => delete setCache[k]); pk = '';
    return PACK.list.find(p => p.id === id);
  }
  // A pack place, drawn with the same chalk wobble as the built-in ones
  function packSet(P, seed) {
    const r = rng(seed * 31 + 7), J = p => wob(p, 3, Math.floor(r() * 1e6));
    const back = P.back.map(e => ({ p: J(e.p), col: e.col, w: e.w, fill: e.fill })), front = P.front.map(e => ({ p: J(e.p), col: e.col, w: e.w, fill: e.fill }));
    if (P.ground) back.push({ p: J([[0, FL], [WW, FL]]), col: CH.white, w: 5 });
    const marks = Object.assign({ left: { x: 380 }, middle: { x: 960 }, right: { x: 1540 } }, P.marks);
    return { back, front, texts: P.texts.slice(), marks, water: null, anim: { smoke: [], fire: [], tumble: false, lanterns: [], flags: [] }, blink: P.blink };
  }
  // Pose keyframes for a pack action: in between keys the body eases from one pose to the next
  function packPose(Q, st, A, a, p, e) {
    const K = A.keys, front = Q.dir, back = -Q.dir; if (A.loop) p = (p * A.loop) % 1;
    if (A.hold) Q.hold = { prop: A.hold, side: front };
    if (K.length) { let i = 0; while (i < K.length - 1 && K[i + 1].p <= p) i++; const k0 = K[i], k1 = K[Math.min(K.length - 1, i + 1)], u = k1.p > k0.p ? io(cl((p - k0.p) / (k1.p - k0.p), 0, 1)) : 0;
      const mix = n => { const a0 = k0[n], a1 = k1[n] != null ? k1[n] : a0; return a0 == null ? (a1 == null ? null : a1 * u) : lerp(a0, a1, u); };
      ['hf', 'hb'].forEach(h => { const a0 = k0[h], a1 = k1[h] || a0; if (!a0 && !a1) return; const s0 = a0 || a1, s1 = a1 || a0, x = lerp(s0[0], s1[0], u), y = lerp(s0[1], s1[1], u); Q.hands[h === 'hf' ? front : back] = [front * x * S, y * S]; });
      ['hop', 'lower', 'kneel', 'kick', 'rot', 'sit'].forEach(n => { const v = mix(n); if (v != null) Q[n] = n === 'hop' ? v * S : v; });
      const ln = mix('lean'); if (ln != null) Q.lean = ln; const tl = mix('tilt'); if (tl != null) Q.tilt = tl * Q.dir; const dx = mix('dx'); if (dx != null) Q.x += front * dx * S;
      const kk = u < 0.5 ? k0 : k1; if (kk.mood) Q.mood = kk.mood; if (kk.eyes) Q.eyes = kk.eyes === 'open' ? null : kk.eyes; if (kk.emote) Q.emote = { k: kk.emote, e, p };
      const fg = kk.fingers || k0.fingers; if (fg) Q.fingers = { [front]: fg }; }
    if (A.shake) Q.hdx = Math.sin(e * 30) * A.shake * 0.2;
    A.fx.forEach(f => { if (p < f.p0 || p > f.p1) return; const q = (p - f.p0) / Math.max(0.01, f.p1 - f.p0); Q.fx.push({ k: 'word', s: f.s, p: q, at: f.k === 'shout' ? 'mouth' : 'front', col: f.col }); if (f.k === 'shout') Q.talk = true; });
  }
  function packPropDraw(g, name, h, dir) { const P = PACK.props[name]; if (!P) return false; const [x, y] = h, s = P.scale; if (!P.flip) dir = 1;
    P.paths.forEach(e => { const q = e.p.map(([px, py]) => [x + dir * px * s, y + py * s]); if (e.fill) fillPoly(g, q, e.fill === true ? BOARD : e.fill); line(g, q, e.col, e.w); }); return true; }
  // Add a set piece: its cast join the clip (reusing anyone already there with the same name), its scenes go in after the playhead's scene
  function packSetPiece(cfg, key, at) { const SP = PACK.sets[key]; if (!SP) return null; const T = JSON.parse(JSON.stringify(SP)), map = {};
    cfg.cast = cfg.cast || []; T.cast.forEach(c => { const role = idOf(c.role || c.name); const same = cfg.cast.find(x => x.name === c.name); if (same) { map[role] = same.id; return; } const nidc = 'p' + Math.random().toString(36).slice(2, 8); map[role] = nidc; cfg.cast.push(Object.assign({}, c, { id: nidc, role: undefined })); });
    const fix = v => (typeof v === 'string' && map[idOf(v.replace(/^@/, ''))] ? (v[0] === '@' ? '@' : '') + map[idOf(v.replace(/^@/, ''))] : v);
    const ids = []; T.scenes.forEach(sc => { sc.id = 's' + Math.random().toString(36).slice(2, 8); sc.type = sc.type || 'scene'; sc.region = sc.region || 'europe'; sc.era = sc.era || 'modern'; sc.place = sc.place || 'outdoors'; sc.weather = sc.weather || ''; sc.label = sc.label || '';
      sc.people = (sc.people || []).map(pe => Object.assign({}, pe, { pid: fix(pe.pid) })).filter(pe => cfg.cast.some(c => c.id === pe.pid));
      sc.acts = (sc.acts || []).map(a => Object.assign({}, a, { id: 'a' + Math.random().toString(36).slice(2, 9), who: fix(a.who), to: fix(a.to), on: fix(a.on) })).filter(a => sc.people.some(pe => pe.pid === a.who));
      sc.extra = (sc.extra || []).map(a => Object.assign({}, a, { id: 'a' + Math.random().toString(36).slice(2, 9), on: fix(a.on) })); sc.screens = sc.screens || []; ids.push(sc.id); });
    const i = at == null ? cfg.scenes.length : cl(at, 0, cfg.scenes.length); cfg.scenes.splice(i, 0, ...T.scenes);
    // Layers belong to one of the set piece's scenes (scene 0 is the first) and their times count from the start of it
    if (T.layers.length) { const P0 = plan(cfg); cfg.layers = cfg.layers || []; T.layers.forEach(L => { const si = cl(Math.round(num(L.scene, 0)), 0, ids.length - 1), o = P0.scenes.find(x => x.sc.id === ids[si]), t0 = o ? o.t0 : 0, c = Object.assign({}, L, { id: 'L' + Math.random().toString(36).slice(2, 9) }); delete c.scene; c.start = num(c.start) + t0; c.end = num(c.end, num(c.start) + 3) + t0; cfg.layers.push(c); }); }
    return ids[0]; }
  const packs = { install: packInstall, remove: packRemove, list: () => PACK.list.slice(), sets: () => Object.values(PACK.sets).map(s => ({ id: s.id, name: s.name, note: s.note })), addSetPiece: packSetPiece };

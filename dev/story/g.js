
  /* ---------- Editing: the timeline lanes, the preview and the panel ---------- */
  const nid = p => p + Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 1e5).toString(36);
  const scById = (cfg, id) => (cfg.scenes || []).find(s => s.id === id);
  const castById = (cfg, id) => (cfg.cast || []).find(c => c.id === id);
  const sceneTitle = (sc, i) => sc.type === 'travel' ? `${i + 1}. ${TRIP[sc.mode] ? TRIP[sc.mode][0] : '✈'} To ${sc.toLabel || RNAME[sc.to]}` : sc.place === 'blank' ? `${i + 1}. ${sc.label || ((sc.screens || []).map(q => (q.media && q.media.name) || q.label).filter(Boolean)[0]) || 'Board'}` : `${i + 1}. ${sc.label ? sc.label + ', ' : ''}${RNAME[sc.region]} ${ENAME[sc.era]}: ${placeName(sc.place, sc.era, sc.region)}`;
  const TRIP = { plane: ['✈', 'Plane'], train: ['🚆', 'Train'], bus: ['🚌', 'Bus'], car: ['🚗', 'Car'], ship: ['⛴', 'Ship'], horse: ['🐎', 'Horse'], walk: ['🚶', 'On foot'] };
  const GCOL = { Rough: '#8a3a1e', Camera: '#5a4f2a', Talk: '#3d6b52', Move: '#6b5a2a', Body: '#2f4d86', Props: '#6b3d5a', Fight: '#7a2f2f', Water: '#2a5a7a', Feel: '#4a4f7a', Scene: '#4a4f63' };
  // Everything after a moved bar on the same lane slides along so bars never overlap
  function ripple(list, moved) { list.sort((x, y) => x.start - y.start || (x === moved ? -1 : y === moved ? 1 : 0)); for (let i = 1; i < list.length; i++) { const p = list[i - 1]; if (list[i].start < p.start + p.dur - 0.001) list[i].start = r2(p.start + p.dur); } }
  const laneOf = (sc, a) => a.who ? (sc.acts || []).filter(x => x.who === a.who) : (sc.extra || []).filter(x => (x.k === 'closeup') === (a.k === 'closeup'));
  function settle(sc, a) { const L = laneOf(sc, a); ripple(L, a); }
  function spotsFor(sc) { const set = setOf(sc), ks = ['off left', 'left', 'middle', 'right', 'off right'].filter(k => k !== 'middle' || set.marks.middle); Object.keys(set.marks).forEach(k => { if (!ks.includes(k)) ks.push(k); }); return ks; }
  // Where a fresh zoom aims: the middle of the people, at about head height
  function zoomCentre(sc) { const set = setOf(sc), xs = (sc.people || []).map(p => spotOf(set, p.start).x).filter(x => x > -50 && x < WW + 50); return { x: Math.round(xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : WW / 2), y: Math.round(FL - 0.5 * S) }; }
  function sceneAtT(cfg, t) { const P = plan(cfg); return sceneAt(P, t); }
  // A new action for someone, at time t inside scene o, with sensible defaults
  function newAct(cfg, o, who, k, t, extra = {}) {
    const sc = o.sc, rel = r2(cl(t - o.t0, 0, 600)), A0 = ACT[k], a = Object.assign({ id: nid('a'), who, k, start: rel, dur: A0 ? A0[3] : 1.2 }, extra);
    if (k === 'closeup') { a.on = who || ((sc.people[0] || {}).pid) || ''; a.who = ''; }
    if (SCRACT[k] && (sc.screens || []).length && !a.scr) { const sim0 = simScene(sc, o, rel), x0 = (sim0[who] || { x: 960 }).x; a.scr = (scrFor(sc, a, x0) || {}).id; } if (k === 'throwtv' && !a.prop) a.prop = 'bottle';
    if (A0 && A0[4] === 'text' && a.text === undefined) a.text = k === 'caption' ? 'Caption' : k === 'timejump' ? '6 hours later' : '';
    if (TALK.includes(k) && a.text) a.dur = r2(talkDur(a.text));
    if (A0 && A0[4] === 'spot' && !a.to) { const sim = simScene(sc, o, rel), st = sim[who] || { x: 960 }, ks = spotsFor(sc).filter(x => !x.startsWith('off')); a.to = ks.find(x => Math.abs(spotOf(o.set, x).x - st.x) > 80) || 'middle'; }
    if (A0 && A0[4] === 'spot') { const sim = simScene(sc, o, rel), st = sim[who] || { x: 960 }, dx = Math.abs(spotOf(o.set, a.to, sim, st).x - st.x); a.dur = r2(cl(0.35 + dx / (k === 'run' || k === 'charge' ? 700 : k === 'sneak' ? 240 : k === 'swim' ? 300 : 430), 0.6, 8)); }
    if (k === 'give') { a.prop = a.prop || 'passport'; a.to = a.to || ((sc.people.find(p => p.pid !== who) || {}).pid || ''); }
    if ((AIMED.includes(k) || (PACK.acts[k] && PACK.acts[k].target)) && k !== 'give' && k !== 'spit' && !a.to) { const sim0 = simScene(sc, o, rel), me = sim0[who] || { x: 960 }, others = sc.people.filter(p => p.pid !== who && sim0[p.pid]).sort((p1, p2) => Math.abs(sim0[p1.pid].x - me.x) - Math.abs(sim0[p2.pid].x - me.x)); a.to = (others[0] || {}).pid || ''; }
    if (k === 'smash' && !a.prop) a.prop = 'bottle';
    if (k === 'take') a.prop = a.prop || 'phone';
    if (a.who) { sc.acts = sc.acts || []; sc.acts.push(a); } else { sc.extra = sc.extra || []; sc.extra.push(a); } settle(sc, a); return a;
  }
  // A new screen sits to one side of whoever is in the scene, at a sensible size for its shape
  function newScreen(sc, style, start) { const xs = (sc.people || []).map(p => spotOf(setOf(sc), p.start).x).filter(x => x > 0 && x < WW), left = xs.length && xs.reduce((a, b) => a + b, 0) / xs.length < 960, q = { id: nid('q'), style, x: left || !xs.length ? 1200 : 720, y: style === 'phone' ? 520 : 470, w: style === 'phone' ? 320 : style === 'polaroid' ? 520 : style === 'cinema' ? 1100 : 860, start, dur: 6, label: '', caption: '', seed: Math.floor(Math.random() * 90) + 1 }; if (!xs.length) q.x = 960; sc.screens = sc.screens || []; sc.screens.push(q); return q; }
  function personHere(cfg, o, sel, t) { const sc = o.sc; if (sel) { const p = sel.split(':'); if ((p[0] === 'W' || p[0] === 'A') && p[1] === sc.id) { if (p[0] === 'W') return p[2]; const a = (sc.acts || []).find(x => x.id === p[2]); if (a) return a.who; } } return sc.people[0] && sc.people[0].pid; }
  const editor = { formIsScene: true,
    tracks(cfg, look) {
      const P = plan(cfg), out = [];
      out.push({ id: 'scenes', name: 'Scenes', colour: '#c9a640', items: P.scenes.map(o => ({ id: 'S:' + o.sc.id, start: o.t0, end: o.t0 + o.d, label: sceneTitle(o.sc, o.i), colour: o.sc.type === 'travel' ? '#2f6b4d' : '#7d6420', move: false, trim: 'end', minLen: o.sc.type === 'travel' ? 1.5 : Math.max(2.5, sceneContent(o.sc) + 0.8), title: 'Drag the right edge to hold the scene longer before it moves on' })) });
      const used = []; P.scenes.forEach(o => (o.sc.people || []).forEach(pe => { if (!used.includes(pe.pid)) used.push(pe.pid); }));
      const order = (cfg.cast || []).map(c => c.id).filter(id => used.includes(id));
      order.forEach(pid => { const c = castById(cfg, pid), items = [];
        P.scenes.forEach(o => { if (o.sc.type === 'travel' || !o.sc.people.some(p => p.pid === pid)) return; const lanes = o.sc.people.map(p => 'P:' + p.pid);
          (o.sc.acts || []).filter(a => a.who === pid).forEach(a => items.push({ id: 'A:' + o.sc.id + ':' + a.id, start: o.t0 + a.start, end: o.t0 + a.start + a.dur, label: (ACT[a.k] ? ACT[a.k][0] + ' ' : '') + actLabel(a), colour: GCOL[(ACT[a.k] || [])[2]] || '#3b5a8f', trim: 'end', minLen: 0.3, maxLen: 60, lanes })); });
        out.push({ id: 'P:' + pid, name: c ? c.name : pid, colour: CH[c && c.colour] || CH.white, items }); });
      const ex = []; P.scenes.forEach(o => (o.sc.extra || []).forEach(a => ex.push({ id: 'X:' + o.sc.id + ':' + a.id, start: o.t0 + a.start, end: o.t0 + a.start + a.dur, label: (ACT[a.k] || [''])[0] + ' ' + (a.k === 'closeup' ? 'Close up: ' + ((castById(cfg, a.on) || {}).name || '?') : (a.text || '')), colour: a.k === 'closeup' ? GCOL.Camera : GCOL.Scene, cam: a.k === 'closeup', trim: 'end', minLen: 0.4 })));
      const qs = []; P.scenes.forEach(o => (o.sc.screens || []).forEach((q, i) => qs.push({ id: 'Q:' + o.sc.id + ':' + q.id, start: o.t0 + (+q.start || 0), end: o.t0 + (+q.start || 0) + (+q.dur || 6), label: '📺 ' + (q.label || 'Screen ' + (i + 1)), colour: '#2a6a5a', trim: 'both', minLen: 1.2 })));
      if (qs.length || cfg.brollTab) out.push({ id: 'scr', name: 'Screens', colour: '#7fd6b8', items: qs });
      out.push({ id: 'cap', name: 'Captions', colour: '#8a8fa8', items: ex.filter(x => !x.cam) }); out.push({ id: 'cam', name: 'Close ups', colour: '#c9a640', items: ex.filter(x => x.cam) });
      return out;
    },
    update(cfg, id, ch) {
      const [kind, sid, aid] = id.split(':'), sc = scById(cfg, sid); if (!sc) return; const o = plan(cfg).scenes.find(x => x.sc.id === sid); if (!o) return;
      if (kind === 'Q') { const q = (sc.screens || []).find(x => x.id === aid); if (!q) return; q.start = r2(Math.max(0, ch.start - o.t0)); q.dur = r2(Math.max(1.2, ch.end - ch.start)); return; }
      if (kind === 'S') { const len = ch.end - ch.start; if (sc.type === 'travel') sc.dur = r2(Math.max(1.5, len)); else sc.hold = r2(Math.max(0, len - Math.max(2.5, sceneContent(sc) + 0.8))); return; }
      const list = kind === 'A' ? sc.acts : sc.extra, a = list && list.find(x => x.id === aid); if (!a) return;
      a.start = r2(Math.max(0, ch.start - o.t0)); a.dur = r2(Math.max(0.3, ch.end - ch.start));
      if (kind === 'A' && ch.track && ch.track.startsWith('P:')) { const pid = ch.track.slice(2); if (sc.people.some(p => p.pid === pid)) a.who = pid; }
      settle(sc, a);
    },
    hits(cfg, look, t, W, H) {
      const P = plan(cfg); if (!P.scenes.length) return []; const o = sceneAt(P, t), lt = Math.min(Math.max(0, t - o.t0), o.d); if (o.sc.type === 'travel' || t - o.t0 > o.d) return [];
      const sim = simScene(o.sc, o, lt), v = viewOf(cfg, o, lt, W, H, sim), SX = x => (x - v.cx) * v.ws + W / 2, SY = y => (y - v.cy) * v.ws + H / 2;
      const bg = { id: 'B:' + o.sc.id, box: [2, 2, W - 2, H - 2], k: 1 / v.ws, scale: true, label: 'Scene: drag a corner inwards to zoom in, then drag to move the view' };
      const scr = (o.sc.screens || []).filter(q => scrState(q, lt, true)).map(q => { const r = scrRect(q); return { id: 'Q:' + o.sc.id + ':' + q.id, box: [SX(r.x), SY(r.y), SX(r.x + r.w), SY(r.y + r.h)], k: 1 / v.ws, scale: true, label: (q.label || 'Screen') + ': drag to move, corner to resize' }; });
      return [bg, ...scr, ...o.sc.people.map(pe => { const st = sim[pe.pid]; if (!st || st.x < -200 || st.x > WW + 200) return null; const c = o.cast[pe.pid] || {}, sz = pe.size || 1; return { id: 'W:' + o.sc.id + ':' + pe.pid, box: [SX(st.x - 0.17 * S * sz), SY(FL - 0.97 * S * sz), SX(st.x + 0.17 * S * sz), SY(FL + 8)], k: 1 / v.ws, scale: true, label: (c.name || 'Person') + ': drag to move, corner to resize' }; }).filter(Boolean)];
    },
    grab(cfg, id, ctx) { const [kind, sid, pid] = id.split(':'), sc = scById(cfg, sid); if (!sc) return null;
      if (kind === 'Q') { const q = (sc.screens || []).find(x => x.id === pid); return q ? { sid, qid: q.id, x: +q.x || 960, y: +q.y || 470, w: +q.w || 900 } : null; }
      if (kind === 'B') { const zm = sc.zoom || Object.assign({ z: 1 }, zoomCentre(sc)); return { sid, bg: true, z: zm.z, x: zm.x, y: zm.y }; }
      if (kind !== 'W') return null; const pe = sc.people.find(p => p.pid === pid); if (!pe) return null; const o = plan(cfg).scenes.find(x => x.sc.id === sid), lt = ctx && ctx.t != null && o ? ctx.t - o.t0 : 0;
      // Dragging moves where they are at the playhead: the end of their latest walk, or where they start
      const mv = (sc.acts || []).filter(a => a.who === pid && MOVES.includes(a.k) && a.start <= lt + 0.01).sort((a, b) => b.start - a.start)[0];
      if (mv && o) { const sim = simScene(sc, o, Math.max(0, mv.start - 0.001)); return { sid, pid, aid: mv.id, x: spotOf(o.set, mv.to, sim, sim[pid]).x, size: pe.size || 1, swim: mv.k === 'swim' }; }
      return { sid, pid, x: spotOf(setOf(sc), pe.start).x, size: pe.size || 1 }; },
    move(cfg, id, s, dx, dy) { if (!s) return; const sc = scById(cfg, s.sid); if (!sc) return;
      if (s.qid) { const q = (sc.screens || []).find(x => x.id === s.qid); if (q) { q.x = Math.round(cl(s.x + dx, 0, WW)); q.y = Math.round(cl(s.y + (dy || 0), 0, WH)); } return; }
      if (s.bg) { if (s.z <= 1.001) return; sc.zoom = { z: s.z, x: Math.round(cl(s.x - dx, 0, WW)), y: Math.round(cl(s.y - (dy || 0), 0, WH)) }; return; }
      const pe = sc.people.find(p => p.pid === s.pid); if (!pe) return; const set = setOf(sc); let nx = cl(s.x + dx, -250, WW + 250);
      if (s.swim && set.water) nx = cl(nx, set.water.x0 + 60, set.water.x1 - 60);
      // Close to a marked spot (a chair, the bar, a bank) it snaps there; anywhere else it stays exactly where you drop it
      let best = null, bd = 34; spotsFor(sc).forEach(k => { const d = Math.abs(spotOf(set, k).x - nx); if (d < bd) { bd = d; best = k; } }); const val = best || Math.round(nx);
      if (s.aid) { const a = (sc.acts || []).find(x => x.id === s.aid); if (a) a.to = val; } else pe.start = val; },
    resize(cfg, id, s, f) { if (!s) return; const sc = scById(cfg, s.sid); if (!sc) return;
      if (s.qid) { const q = (sc.screens || []).find(x => x.id === s.qid); if (q) q.w = Math.round(cl(s.w * f, 160, 1900)); return; }
      if (s.bg) { const z = r2(cl(s.z / Math.max(0.2, f), 1, 3)); if (z <= 1.02) delete sc.zoom; else sc.zoom = { z, x: Math.round(s.x), y: Math.round(s.y) }; return; }
      const pe = sc.people.find(p => p.pid === s.pid); if (pe) { const v = r2(cl(s.size * f, 0.4, 2.5)); if (Math.abs(v - 1) < 0.03) delete pe.size; else pe.size = v; } },
    adds: [
      { label: 'Scene', title: 'Add a scene after the one at the playhead. Pick the region; the people carry on into it.', choices: () => REGIONS.map(([k, l]) => ({ label: l, key: k, icon: c => iconSet(c, k, 'modern', 'outdoors') })),
        fn(cfg, t, sel, ch) { const o = cfg.scenes.length ? sceneAtT(cfg, t) : null, prev = o && [...cfg.scenes].slice(0, o.i + 1).reverse().find(s => s.type !== 'travel'), sc = { id: nid('s'), type: 'scene', region: (ch && ch.key) || 'europe', era: prev ? prev.era : 'modern', place: 'outdoors', weather: '', label: '', people: prev ? prev.people.map(p => ({ pid: p.pid, start: 'off left', holding: p.holding || '' })).slice(0, 3) : [], acts: [], extra: [] };
          sc.people.forEach((p, i) => sc.acts.push({ id: nid('a'), who: p.pid, k: 'walk', start: r2(0.5 + i * 0.4), dur: 1.6, to: ['left', 'middle', 'right'][i] || 'middle' })); cfg.scenes.splice(o ? o.i + 1 : cfg.scenes.length, 0, sc); return 'S:' + sc.id; } },
      { label: 'Set piece', title: 'Drop in a ready-made scene from your packs, like a bank robbery. Everything in it can be changed afterwards.', choices: () => { const L = packs.sets(); return L.length ? L.map(s => ({ label: s.name, key: s.id, icon: c => iconTxt(c, '🎬') })) : [{ label: 'No set pieces yet: ask for a pack', key: '', icon: c => iconTxt(c, '📦') }]; },
        fn(cfg, t, sel, ch) { if (!ch || !ch.key) return null; const o = cfg.scenes.length ? sceneAtT(cfg, t) : null, id = packSetPiece(cfg, ch.key, o ? o.i + 1 : cfg.scenes.length); return id ? 'S:' + id : null; } },
      { label: 'Travel', title: 'Add a chalk map hop after the scene at the playhead', choices: () => Object.entries(TRIP).map(([k, v]) => ({ label: v[1], key: k, icon: c => iconTxt(c, v[0]) })),
        fn(cfg, t, sel, ch) { const o = cfg.scenes.length ? sceneAtT(cfg, t) : null, prev = o && [...cfg.scenes].slice(0, o.i + 1).reverse().find(s => s.type !== 'travel'); const sc = { id: nid('s'), type: 'travel', who: prev && prev.people[0] ? prev.people[0].pid : ((cfg.cast || [])[0] || {}).id, mode: (ch && ch.key) || 'plane', from: prev ? prev.region : 'europe', to: prev ? prev.region : 'europe', dur: 3.4 }; cfg.scenes.splice(o ? o.i + 1 : cfg.scenes.length, 0, sc); return 'S:' + sc.id; } },
      { label: 'Action', title: 'Give the selected person something to do at the playhead (or the first person in the scene)', choices: () => ['say', 'think', 'shout', 'walk', 'run', 'wave', 'point', 'shrug', 'nod', 'shake', 'facepalm', 'celebrate', 'laugh', 'cry', 'angry', 'shocked', 'confused', 'take', 'give', 'drink', 'sit', 'stand', 'fall', 'jump', 'hug', 'punch', 'shoot', 'swing', 'dive', 'cannonball', 'finger', 'slap', 'headbutt', 'haymaker', 'kickbaws', 'brawl', 'stagger', 'fart'].map(k => ({ label: ACT[k][1], key: k, icon: c => iconTxt(c, ACT[k][0]) })),
        fn(cfg, t, sel, ch) { if (!cfg.scenes.length) return null; let o = sceneAtT(cfg, t); if (o.sc.type === 'travel') return 'S:' + o.sc.id; const who = personHere(cfg, o, sel, t); if (!who) return 'S:' + o.sc.id; const a = newAct(cfg, o, who, (ch && ch.key) || 'say', t); return 'A:' + o.sc.id + ':' + a.id; } },
      { label: 'Person', title: 'Add someone new to the scene at the playhead', fn(cfg, t) { if (!cfg.scenes.length) return null; const o = sceneAtT(cfg, t); if (o.sc.type === 'travel' || o.sc.people.length >= 4) return 'S:' + o.sc.id; const cols = ['pink', 'green', 'orange', 'purple', 'yellow', 'red', 'blue', 'white'], c = { id: nid('p'), name: 'Person ' + ((cfg.cast || []).length + 1), sex: 'man', colour: cols[(cfg.cast || []).length % cols.length], dress: '' }; cfg.cast = cfg.cast || []; cfg.cast.push(c); const free = ['left', 'right', 'middle'].find(k => !o.sc.people.some(p => p.start === k)) || 'middle'; o.sc.people.push({ pid: c.id, start: free, holding: '' }); return 'W:' + o.sc.id + ':' + c.id; } },
      { label: 'Screen', title: 'Add a chalk screen for real footage (B roll) at the playhead', choices: () => SCREENS.map(([k, l]) => ({ label: l, key: k, icon: c => iconTxt(c, { tv: '📺', box: '⬜', phone: '📱', cinema: '🎬', polaroid: '🖼', window: '🪟' }[k]) })),
        fn(cfg, t, sel, ch) { if (!cfg.scenes.length) return null; const o = sceneAtT(cfg, t); if (o.sc.type === 'travel') return 'S:' + o.sc.id; const k = (ch && ch.key) || 'tv', q = newScreen(o.sc, k, r2(cl(t - o.t0, 0, 600))); return 'Q:' + o.sc.id + ':' + q.id; } },
      { label: 'Caption', title: 'Add a caption or a time jump at the playhead', choices: () => [{ label: 'Caption', key: 'caption', icon: c => iconTxt(c, '🔤') }, { label: 'Time jump', key: 'timejump', icon: c => iconTxt(c, '⏱') }, { label: 'Close up', key: 'closeup', icon: c => iconTxt(c, '🎥') }], fn(cfg, t, sel, ch) { if (!cfg.scenes.length) return null; const o = sceneAtT(cfg, t); if (o.sc.type === 'travel') return 'S:' + o.sc.id; const k = (ch && ch.key) || 'caption', a = newAct(cfg, o, k === 'closeup' ? personHere(cfg, o, sel, t) : '', k, t); return 'X:' + o.sc.id + ':' + a.id; } },
    ],
    remove(cfg, id) {
      const [kind, sid, x] = id.split(':'), sc = scById(cfg, sid); if (!sc) return;
      if (kind === 'Q') { sc.screens = (sc.screens || []).filter(q => q.id !== x); return; }
      if (kind === 'S') { if (cfg.scenes.length > 1) cfg.scenes.splice(cfg.scenes.indexOf(sc), 1); return; }
      if (kind === 'A') sc.acts = (sc.acts || []).filter(a => a.id !== x); if (kind === 'X') sc.extra = (sc.extra || []).filter(a => a.id !== x);
      if (kind === 'W') { sc.people = sc.people.filter(p => p.pid !== x); sc.acts = (sc.acts || []).filter(a => a.who !== x); }
    },
    duplicate(cfg, id) {
      const [kind, sid, x] = id.split(':'), sc = scById(cfg, sid); if (!sc) return id;
      if (kind === 'Q') { const q = (sc.screens || []).find(z => z.id === x); if (!q) return id; const c = JSON.parse(JSON.stringify(q)); c.id = nid('q'); c.start = r2((+q.start || 0) + (+q.dur || 6)); sc.screens.push(c); return 'Q:' + sid + ':' + c.id; }
      if (kind === 'S') { const c = JSON.parse(JSON.stringify(sc)); c.id = nid('s'); (c.acts || []).forEach(a => a.id = nid('a')); (c.extra || []).forEach(a => a.id = nid('a')); cfg.scenes.splice(cfg.scenes.indexOf(sc) + 1, 0, c); return 'S:' + c.id; }
      const list = kind === 'A' ? sc.acts : kind === 'X' ? sc.extra : null, a = list && list.find(q => q.id === x); if (!a) return id;
      const c = JSON.parse(JSON.stringify(a)); c.id = nid('a'); c.start = r2(a.start + a.dur); list.push(c); settle(sc, c); return kind + ':' + sid + ':' + c.id;
    },
    inspect(root, cfg, id, changed, done) { panel(root, cfg, id, changed, done); },
    scene(root, cfg, changed) { panel(root, cfg, null, changed, null); },
  };

  /* ---------- Small pictures for the panel and the add menus ---------- */
  const thumbStore = {};
  function thumbSrc(key, w, h, fn) { if (thumbStore[key]) return thumbStore[key]; const c = mkC(w, h), g = c.getContext('2d'); try { fn(g, w, h); } catch (e) { } return (thumbStore[key] = c); }
  function pic(key, w, h, fn) { const src = thumbSrc(key, w * 2, h * 2, fn), c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; c.style.width = '100%'; c.style.aspectRatio = w + ' / ' + h; c.getContext('2d').drawImage(src, 0, 0); return c; }
  const setPic = (rg, era, pl) => pic('set' + rg + era + pl, 120, 68, (g, w, h) => { const prev = BOARD; g.drawImage(boardTex(w, h, BOARD), 0, 0); g.scale(w / WW, h / WH); const st = buildSet(rg, era, pl, 3); st.back.forEach(s => line(g, s.p, s.col, s.w * 1.6)); st.front.forEach(s => { if (s.fill) fillPoly(g, s.p, BOARD); line(g, s.p, s.col, s.w * 1.6); }); if (st.water) fillPoly(g, rectP(st.water.x0, st.water.y, st.water.x1 - st.water.x0, 160), '#2a5363', 0.8); BOARD = prev; });
  const personPic = (ch, full) => pic('per' + JSON.stringify(ch) + full, full ? 80 : 40, full ? 100 : 40, (g, w, h) => { g.fillStyle = BOARD; g.fillRect(0, 0, w, h); const sc = full ? h / 560 : h / 210; g.setTransform(sc, 0, 0, sc, w / 2 - 960 * sc, full ? h - (FL + 20) * sc : h * 0.6 - (FL - 0.43 * S - 0.33 * S - 0.1 * S) * sc); figure(g, Object.assign({ i: 0 }, ch), { x: 960, dir: 1, sit: 0, hands: {}, mood: 'happy' }, 0.3, 1); });
  const propPic = p => pic('pr' + p, 60, 46, (g, w, h) => { g.fillStyle = BOARD; g.fillRect(0, 0, w, h); const big = ['umbrella', 'flag', 'sign', 'rod', 'spear', 'sword', 'axe', 'torch', 'bow', 'rifle'].includes(p), sc = big ? 0.28 : 0.85; g.setTransform(sc, 0, 0, sc, w / 2 - (p === 'rifle' ? 20 * sc : 0), big ? h * 0.78 : h * 0.55); propDraw(g, p, [0, 0], 1, 0, p === 'sword' || p === 'axe' ? -0.4 : 0); });
  function iconSet(c, rg, era, pl) { const g = c.getContext('2d'); c.width = 144; c.height = 112; const src = thumbSrc('set' + rg + era + pl, 240, 136, (gg, w, h) => { gg.drawImage(boardTex(w, h, BOARD), 0, 0); gg.scale(w / WW, h / WH); const st = buildSet(rg, era, pl, 3); st.back.forEach(s => line(gg, s.p, s.col, s.w * 1.6)); }); g.drawImage(src, 0, 14, 144, 82); }
  function iconTxt(c, s) { const g = c.getContext('2d'); c.width = 144; c.height = 112; g.font = '56px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 72, 58); }

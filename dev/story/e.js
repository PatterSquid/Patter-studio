
  /* ---------- The clip: scenes one after another ---------- */
  const r2 = v => Math.round(v * 100) / 100;
  function sceneContent(sc) { if (sc.type === 'travel') return sc.dur || 3.4; let m = 1.5; (sc.acts || []).forEach(a => { m = Math.max(m, a.start + a.dur); const PA = PACK.acts[a.k]; if (PA && PA.react && a.to) m = Math.max(m, a.start + a.dur * PA.at + 2.4); const R = a.to && hitOf(a); if (R && a.k !== 'brawl' && a.k !== 'stomp') m = Math.max(m, a.start + a.dur * (0.3 + 0.7 * HIT[a.k].imp) + R[1] + (DEAD.includes(R[0]) ? 2.2 : 0)); }); (sc.extra || []).forEach(a => m = Math.max(m, a.start + a.dur)); (sc.screens || []).forEach(q => m = Math.max(m, (+q.start || 0) + (+q.dur || 6))); return m; }
  const sceneLen = sc => sc.type === 'travel' ? Math.max(1.5, +sc.dur || 3.4) : Math.max(2.5, sceneContent(sc) + 0.8) + Math.max(0, +sc.hold || 0);
  const setCache = {};
  function setOf(sc) { const k = sc.region + '|' + sc.era + '|' + sc.place; return setCache[k] || (setCache[k] = buildSet(sc.region, sc.era, sc.place, REGIONS.findIndex(r => r[0] === sc.region) * 7 + ERAS.findIndex(r => r[0] === sc.era) * 3 + PLACES.findIndex(p => p[0] === sc.place))); }
  let pk = '', pp = null, pr = null;
  function plan(cfg) {
    // B roll is just the board, the screens and the people: no scenery or weather, even in older projects
    if (cfg.brollTab) (cfg.scenes || []).forEach(sc => { if (sc.type === 'travel') return; sc.place = 'blank'; sc.weather = ''; sc.region = 'europe'; sc.label = ''; });
    const key = JSON.stringify([cfg.scenes, cfg.cast]); if (key === pk && pr === cfg.scenes) return pp;
    // Same content but new objects (after undo or a reload): point the cached plan at the live scenes so edits land on them
    if (key === pk && pp && pp.scenes.length === (cfg.scenes || []).length) { pr = cfg.scenes; pp.scenes.forEach((o, i) => { const old = o.sc, sc = cfg.scenes[i]; o.sc = sc; if (o.byWho && old.acts && sc.acts) { const map = new Map(old.acts.map((a, j) => [a, sc.acts[j]])); Object.values(o.byWho).forEach(l => l.forEach((a, j) => { if (map.has(a)) l[j] = map.get(a); })); } }); return pp; }
    let t = 0; const scenes = (cfg.scenes || []).map((sc, i, all) => { const d = sceneLen(sc), last = i === all.length - 1, o = { sc, i, t0: t, d, out: last ? 0 : OUT, cast: {} }; t += d + o.out;
      if (sc.type !== 'travel') { o.set = setOf(sc); o.byWho = {}; (sc.acts || []).forEach(a => (o.byWho[a.who] = o.byWho[a.who] || []).push(a));
        // Anything rough aimed at someone puts a reaction on their lane too, timed to the moment it lands
        o.events = o.events || []; const pre = (sc.acts || []).filter(a => HIT[a.k]).map(a => { try { const sm = simScene(sc, o, Math.max(0, a.start - 0.01)); return sm[a.to] && sm[a.who] ? (sm[a.to].x >= sm[a.who].x ? 1 : -1) : 0; } catch (e) { return 0; } });
        (sc.acts || []).filter(a => HIT[a.k]).forEach((a, ai) => { const H = HIT[a.k], R = hitOf(a); if (!H || !a.to || a.to === a.who || !sc.people.some(p => p.pid === a.to)) return; const ti = a.start + a.dur * (0.3 + 0.7 * H.imp), d = a.k === 'brawl' ? a.dur * 0.7 * 0.9 + 0.05 : a.k === 'stomp' ? a.dur * 0.7 * 0.95 : R[1];
          (o.byWho[a.to] = o.byWho[a.to] || []).push({ id: 'h' + a.id, who: a.to, k: 'hit_' + R[0], start: Math.round(ti * 100) / 100, dur: d, synthetic: true, by: a.who, src: a.prop || a.k, away: pre[ai] || 0 }); });
        // Pack actions aimed at someone can put one of the usual reactions on them (punched, shot, spat on and so on)
        (sc.acts || []).forEach(a => { const PA = PACK.acts[a.k]; if (!PA || !PA.react || !a.to || a.to === a.who || !sc.people.some(p => p.pid === a.to)) return; const ti = a.start + a.dur * PA.at, R = { punched: 0.9, slapped: 1.1, butted: 1.6, decked: 1.4, lifted: 1.5, baws: 2, smashed: 1.4, chucked: 1.5, spat: 1.1, shot: 2.4, winged: 2.2, missed: 1.4, slashed: 2.4, cut: 2.2, dodged: 1.3 }[PA.react]; if (!R) return;
          (o.byWho[a.to] = o.byWho[a.to] || []).push({ id: 'h' + a.id, who: a.to, k: 'hit_' + PA.react, start: Math.round(ti * 100) / 100, dur: R, synthetic: true, by: a.who, src: a.k, away: 0 }); });
        Object.values(o.byWho).forEach(l => l.sort((a, b) => a.start - b.start));
        o.events = []; (sc.acts || []).forEach(a => { const PA = PACK.acts[a.k]; if (!PA) return; if (PA.take) o.events.push({ t: a.start + a.dur * 0.4, k: 'add', who: a.who, prop: PA.take }); if (PA.drop) o.events.push({ t: a.start + a.dur * 0.6, k: 'rmx', who: a.who, prop: PA.drop }); if (PA.give && a.to) o.events.push({ t: a.start + a.dur * 0.6, k: 'mv', who: a.who, to: a.to, prop: PA.give }); }); (sc.acts || []).forEach(a => { if (a.k === 'take' && a.prop) o.events.push({ t: a.start + a.dur * 0.4, k: 'add', who: a.who, prop: a.prop }); if (a.k === 'putaway') o.events.push({ t: a.start + a.dur * 0.5, k: 'rm', who: a.who, prop: a.prop }); if (a.k === 'throw') o.events.push({ t: a.start + a.dur * 0.45, k: 'rm', who: a.who }); if (a.k === 'throwtv') o.events.push({ t: a.start + a.dur * 0.45, k: 'rmx', who: a.who, prop: 'throwtv', prop2: a.prop || 'bottle' }); if (a.k === 'smashtv') o.events.push({ t: a.start + a.dur * (0.3 + 0.7 * SCRACT.smashtv.imp), k: 'rmx', who: a.who, prop: 'bottle' }); if (a.k === 'give' && a.to && a.prop) o.events.push({ t: a.start + a.dur * 0.5, k: 'mv', who: a.who, to: a.to, prop: a.prop }); if (a.k === 'smash' && a.prop !== 'chair') o.events.push({ t: a.start + a.dur * (0.3 + 0.7 * HIT.smash.imp), k: 'rmx', who: a.who, prop: 'bottle' }); });
        o.events.sort((a, b) => a.t - b.t); }
      (cfg.cast || []).forEach((c, ci) => { o.cast[c.id] = Object.assign({ i: ci }, c); });
      return o; });
    pk = key; pr = cfg.scenes; pp = { scenes, total: Math.max(1, t) }; return pp;
  }
  function defaults() {
    const A = (who, k, start, dur, o = {}) => Object.assign({ id: 'a' + Math.round(start * 100) + k + who, who, k, start, dur }, o);
    return { board: 'green', frame: true, camera: 'gentle',
      cast: [{ id: 'abdi', name: 'Abdi', sex: 'man', colour: 'blue', dress: 'robe', beard: true }, { id: 'amina', name: 'Amina', sex: 'woman', colour: 'green', dress: 'robe' }, { id: 'officer', name: 'Officer', sex: 'woman', colour: 'white', dress: 'suit' }, { id: 'davie', name: 'Davie', sex: 'man', colour: 'yellow', dress: '', hair: 'short' }],
      scenes: [
        { id: 's1', type: 'scene', region: 'africa', era: '1800s', place: 'outdoors', weather: 'sunny', label: 'Mogadishu', people: [{ pid: 'abdi', start: 'off left', holding: 'suitcase' }, { pid: 'amina', start: 'right', holding: '' }],
          acts: [A('abdi', 'walk', 0.6, 1.6, { to: 'left' }), A('abdi', 'think', 2.3, 3.2, { text: 'Scotland. Green hills, fresh air, a new start.' }), A('amina', 'say', 5.6, 2.7, { text: 'Scotland? Have you seen the weather?' }), A('abdi', 'shrug', 8.4, 1.2), A('abdi', 'say', 9.7, 2.4, { text: 'How bad can it be?' }), A('amina', 'shake', 12.2, 1.2), A('abdi', 'wave', 13.5, 1.4), A('amina', 'wave', 13.5, 1.4), A('abdi', 'walk', 15, 2.6, { to: 'off right' })], extra: [] },
        { id: 's2', type: 'travel', who: 'abdi', mode: 'plane', from: 'africa', to: 'asia', toLabel: 'Istanbul', dur: 3.4 },
        { id: 's3', type: 'scene', region: 'asia', era: 'modern', place: 'airport', weather: '', label: '', people: [{ pid: 'abdi', start: 'off left', holding: 'suitcase' }],
          acts: [A('abdi', 'walk', 0.6, 2.4, { to: 'seats' }), A('abdi', 'watch', 3.2, 1.8), A('abdi', 'sleep', 5.1, 2.4), A('abdi', 'wake', 10, 1.1), A('abdi', 'stand', 11.2, 0.9), A('abdi', 'run', 12.2, 1.8, { to: 'off right' })], extra: [A('', 'caption', 1.0, 3.4, { text: '9 hour layover' }), A('', 'timejump', 7.6, 2.3, { text: '6 hours later' })] },
        { id: 's4', type: 'travel', who: 'abdi', mode: 'plane', from: 'asia', to: 'europe', toLabel: 'London', dur: 3.4 },
        { id: 's5', type: 'scene', region: 'europe', era: 'modern', place: 'border', weather: '', label: '', people: [{ pid: 'officer', start: 'behind desk', holding: '' }, { pid: 'abdi', start: 'off left', holding: 'suitcase' }],
          acts: [A('abdi', 'walk', 0.6, 2.6, { to: 'desk' }), A('officer', 'say', 3.4, 1.7, { text: 'Passport, please.' }), A('abdi', 'give', 5.2, 2, { prop: 'passport', to: 'officer' }), A('officer', 'stamp', 7.4, 1.4), A('officer', 'say', 8.9, 2.2, { text: 'Welcome to the UK.' }), A('abdi', 'celebrate', 11.2, 1.8), A('abdi', 'walk', 13.2, 2.4, { to: 'off right' })], extra: [] },
        { id: 's6', type: 'travel', who: 'abdi', mode: 'train', from: 'europe', to: 'europe', toLabel: 'Glasgow', dur: 3.4 },
        { id: 's7', type: 'scene', region: 'europe', era: 'modern', place: 'outdoors', weather: 'rain', label: 'Glasgow', people: [{ pid: 'davie', start: 'right', holding: '' }, { pid: 'abdi', start: 'off left', holding: 'suitcase' }],
          acts: [A('abdi', 'walk', 0.6, 1.8, { to: 'left' }), A('davie', 'say', 2.6, 3.1, { text: 'Awright big man! Lovely day for it!' }), A('abdi', 'confused', 5.9, 1.6), A('abdi', 'say', 7.6, 1.7, { text: '...is it?' }), A('abdi', 'facepalm', 9.5, 1.6)], extra: [] }] };
  }
  const duration = cfg => plan(cfg).total;
  function sceneAt(P, t) { const L = P.scenes; for (let i = 0; i < L.length; i++) if (t < L[i].t0 + L[i].d + L[i].out) return L[i]; return L[L.length - 1]; }

  // How the world (1920 by 1080) sits in the frame, including the gentle push towards whoever is talking
  /* Vertical framing: what has to be in shot at one moment. Whoever is doing something (and whoever they are doing it to),
     or everyone when nobody is busy, plus any screen that is up. Sampled a little either side of now and blended, so the
     camera glides to new framings instead of jumping when someone starts an action or walks on. */
  // Where someone actually is right now, part way through a walk included
  const liveX = st => { const a = st.active; return a && st.walkTo != null && st.walkFrom != null && (a.walking != null || MOVES.includes(a.a.k)) ? lerp(st.walkFrom, st.walkTo, io(a.walking != null ? a.walking : a.p)) : st.x; };
  function frameAt(o, t, sim) { const sc = o.sc, ppl = sc.people.filter(pe => sim[pe.pid] && liveX(sim[pe.pid]) > -60 && liveX(sim[pe.pid]) < WW + 60), busy = new Set();
    ppl.forEach(pe => { const a = sim[pe.pid].active; if (!a || ['wait', 'sleep', 'watch'].includes(a.a.k)) return; busy.add(pe.pid); if (a.a.to && sim[a.a.to] && !String(a.a.to).startsWith('@')) busy.add(a.a.to); if (a.a.by) busy.add(a.a.by); if (String(a.a.to || '').startsWith('@')) busy.add(a.a.to.slice(1)); });
    // A short pause between actions keeps the camera on whoever was just acting, or is about to
    if (!busy.size) (sc.acts || []).forEach(a => { if ((a.start + a.dur <= t && a.start + a.dur > t - 1.5) || (a.start >= t && a.start < t + 0.8)) { busy.add(a.who); if (a.to && !String(a.to).startsWith('@') && sim[a.to]) busy.add(a.to); } });
    const bl = ppl.filter(pe => busy.has(pe.pid)), list = bl.length ? bl : ppl; let x0 = 1e9, x1 = -1e9, top = 1e9, bot = FL + 50;
    list.forEach(pe => { const st = sim[pe.pid], sz = pe.size || 1, a = st.active, x = liveX(st), hw = (st.lying || (a && /^hit_(shot|slashed|decked|butted|smashed|chucked|lifted)/.test(a.a.k)) ? 1.05 : 0.4) * S * sz; x0 = Math.min(x0, x - hw); x1 = Math.max(x1, x + hw); top = Math.min(top, FL - (st.lying ? 0.45 : 1.25) * S * sz - (st.perch ? FL - st.perch.y : 0)); if (a && TALK.includes(a.a.k)) { x0 = Math.min(x0, x - 340); x1 = Math.max(x1, x + 340); top = Math.min(top, FL - 1.25 * S * sz - 300); } });
    (sc.screens || []).forEach(q => { if (!scrState(q, t, false)) return; const E2 = scrEdges(q); x0 = Math.min(x0, E2.x0 - 30); x1 = Math.max(x1, E2.x1 + 30); top = Math.min(top, E2.top - 90); bot = Math.max(bot, E2.bot + 70); });
    if (x0 > x1) { x0 = WW / 2 - 300; x1 = WW / 2 + 300; top = FL - 1.25 * S; } return { x0, x1, top, bot }; }
  // The shot on a fixed grid of moments, each one taking in what is coming up and what has just happened (so the camera pulls
  // back to hold both people when the action passes from one to the other), then joined up smoothly between grid points
  const tallCache = new WeakMap(), TG = 0.3; let tallHold = null;
  function tallAt(o, k) { let m = tallCache.get(o); if (!m) { m = new Map(); tallCache.set(o, m); } if (m.has(k)) return m.get(k);
    const tc = cl(k * TG, 0, o.d), fr = t => { try { return frameAt(o, t, simScene(o.sc, o, t)); } catch (e) { return null; } }, c = fr(tc) || { x0: WW / 2 - 300, x1: WW / 2 + 300, top: FL - S, bot: FL + 50 }, f = Object.assign({}, c);
    [-2.1, -1.8, -1.5, -1.2, -0.9, -0.6, -0.3, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1].forEach(d => { const t = tc + d; if (t < 0 || t > o.d) return; const q = fr(t); if (!q) return; const w = Math.pow(1 - Math.abs(d) / 2.5, 1.3);
      f.x0 = Math.min(f.x0, c.x0 + (q.x0 - c.x0) * w); f.x1 = Math.max(f.x1, c.x1 + (q.x1 - c.x1) * w); f.top = Math.min(f.top, c.top + (q.top - c.top) * w); f.bot = Math.max(f.bot, c.bot + (q.bot - c.bot) * w); });
    if (m.size > 4000) m.clear(); m.set(k, f); return f; }
  function tallFrame(o, lt) { const g = cl(lt, 0, o.d) / TG, k = Math.floor(g), u = g - k, P0 = tallAt(o, k - 1), P1 = tallAt(o, k), P2 = tallAt(o, k + 1), P3 = tallAt(o, k + 2), out = {};
    // Catmull-Rom through the grid, so the camera moves without steps
    ['x0', 'x1', 'top', 'bot'].forEach(n => { const a = P0[n], b = P1[n], c2 = P2[n], d = P3[n]; out[n] = 0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u * u + (-a + 3 * b - 3 * c2 + d) * u * u * u); }); return out; }
  function viewOf(cfg, o, lt, W, H, sim) {
    const tall = H > W && !(o && o.sc.type === 'travel'), k = tall ? W / WW * 2.2 : Math.min(W / WW, H / WH); let z = 1, cx = WW / 2, cy = tall ? FL - 0.2 * H / k : WH / 2;
    if (o && o.sc.type !== 'travel' && sim) {
      // While something is being dragged on the preview the vertical camera holds still, so it stays under the mouse
      if (tall && globalThis.PatterDragging && tallHold && tallHold.o === o && tallHold.W === W) { z = tallHold.z; cx = tallHold.cx; cy = tallHold.cy; }
      else if (tall) { const f = tallFrame(o, lt), vis = cl(f.x1 - f.x0 + 140, WW / 2.2, WW), ws1 = W / vis, visH = H / ws1; z = ws1 / k; cx = cl((f.x0 + f.x1) / 2, vis / 2, WW - vis / 2);
        // The floor sits about 70% of the way down, unless the top of what is in shot would be cut off
        cy = FL - 0.2 * visH; if ((f.top - cy) * ws1 + H / 2 < 0.08 * H) cy = f.top + 0.42 * visH; if (typeof document !== 'undefined') tallHold = { o, W, z, cx, cy }; }
      if (cfg.camera !== 'fixed') o.sc.people.forEach(pe => { const a = sim[pe.pid] && sim[pe.pid].active; if (a && TALK.includes(a.a.k)) { const q = Math.sin(a.p * Math.PI); z *= 1 + 0.03 * q; if (!tall) { cx = lerp(WW / 2, sim[pe.pid].x, 0.2 * q); cy = lerp(WH / 2, WH * 0.53, q); } } });
    }
    // The scene's own framing (zoomed and panned on the preview), then any close up on a person
    if (o && o.sc.type !== 'travel') { const zm = o.sc.zoom; if (zm && zm.z > 1.001) { z *= zm.z; if (tall) cy = lerp(cy, zm.y, 0.5); else { cx = zm.x; cy = zm.y; } }
      if (sim) (o.sc.extra || []).forEach(a => { if (a.k !== 'closeup' || lt < a.start || lt > a.start + a.dur || !sim[a.on]) return; const q = io(Math.min(cl((lt - a.start) / 0.6, 0, 1), cl((a.start + a.dur - lt) / 0.6, 0, 1))), st = sim[a.on], pe = o.sc.people.find(p => p.pid === a.on), sz = (pe && pe.size) || 1;
        z = lerp(z, Math.max(z, 1) * 1.8 / Math.max(0.6, sz * 0.9 + 0.1), q); cx = lerp(cx, st.x, q); cy = lerp(cy, FL - 0.5 * S * sz, q); });
      const ws0 = k * z, hw = W / 2 / ws0, hh = H / 2 / ws0; if (hw < WW / 2) cx = cl(cx, hw, WW - hw); if (hh < WH / 2) cy = cl(cy, hh, WH - hh); }
    if (H > W && o && o.sc.type === 'travel') { const kt = W / WW * 1.5, ws2 = kt; const cx2 = cl(lerp(400, 1520, io(cl((lt / Math.max(0.1, o.d) - 0.15) / 0.7, 0, 1))), W / kt / 2, WW - W / kt / 2), cy2 = 520; return { ws: ws2, cx: cx2, cy: cy2, k: kt, x0: cx2 - W / 2 / ws2, x1: cx2 + W / 2 / ws2, y0: cy2 - H / 2 / ws2, y1: cy2 + H / 2 / ws2 }; }
    const ws = k * z; return { ws, cx, cy, k, x0: cx - W / 2 / ws, x1: cx + W / 2 / ws, y0: cy - H / 2 / ws, y1: cy + H / 2 / ws };
  }
  // Static chalk for a scene, drawn once into its own picture at the size it is shown
  const bakeCache = new Map();
  // Zoomed scenes are drawn at a higher resolution so the chalk stays crisp
  const bakeK = (o, k) => { const zm = o && o.sc.zoom; return k * (zm && zm.z > 1.001 ? Math.min(2.5, Math.round(zm.z * 4) / 4) : 1); };
  function baked(set, which, k) {
    const key = set; let m = bakeCache.get(key); if (!m) { m = {}; bakeCache.set(key, m); } const id = which + k.toFixed(3) + BOARD + SETA + (EDGE ? 'e' : ''); if (m[id]) return m[id];
    const c = mkC(WW * k, WH * k), g = c.getContext('2d'); g.scale(k, k); const arr = which === 'back' ? set.back : set.front;
    arr.forEach(s => { if (s.fill) fillPoly(g, s.p, BOARD, 1); g.globalAlpha = SETA; line(g, s.p, s.col, s.w); g.globalAlpha = 1; }); g.globalAlpha = SETA; if (which === 'back') set.texts.forEach(tx => text(g, tx.s, tx.x, tx.y, tx.size, tx.col, tx.al)); g.globalAlpha = 1; return (m[id] = c);
  }
  // In the editor, bake the next pictures while the browser is idle so playback never stutters at a scene change
  const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : null; let idleBusy = false;
  function prebake(set, k) { if (!idle || idleBusy || !set) return; const m = bakeCache.get(set), b = BOARD, sa = SETA; if (m && m['back' + k.toFixed(3) + b + sa] && m['front' + k.toFixed(3) + b + sa]) return; idleBusy = true;
    idle(() => { const keep = BOARD, ks = SETA; BOARD = b; SETA = sa; try { baked(set, 'back', k); baked(set, 'front', k); } finally { BOARD = keep; SETA = ks; idleBusy = false; } }, { timeout: 400 }); }
  function drawSetLive(g, set, rev, which) {
    const all = set.back.concat(set.front), tot = set._tot || (set._tot = all.reduce((a, s) => a + plen(s.p), 0)); let used = tot * rev;
    const run = arr => arr.forEach(s => { const L = plen(s.p); if (s.fill && rev > 0.5) fillPoly(g, s.p, BOARD, 1); if (used <= 0) return; const ga = g.globalAlpha; g.globalAlpha = ga * SETA; line(g, partial(s.p, Math.min(1, used / L)), s.col, s.w); g.globalAlpha = ga; used -= L; });
    if (which === 'back') { run(set.back); const ga = g.globalAlpha; g.globalAlpha = ga * SETA; set.texts.forEach(tx => text(g, tx.s, tx.x, tx.y, tx.size, tx.col, tx.al, cl(rev * 1.4 - 0.3, 0, 1))); g.globalAlpha = ga; } else { used -= set.back.reduce((a, s) => a + plen(s.p), 0); run(set.front); }
  }
  function drawAnim(g, set, t, sc) {
    const A = set.anim;
    A.smoke.forEach(([x, y], i) => { for (let k = 0; k < 4; k++) { const q = (t * 0.25 + k / 4 + i * 0.13) % 1; g.save(); g.globalAlpha *= (1 - q) * 0.8; line(g, circP(x + Math.sin(q * 6 + i) * 20 + q * 40, y - q * 160, 14 + q * 30, 12 + q * 24), CH.grey, 3); g.restore(); } });
    A.fire.forEach(([x, y, s = 1]) => flame(g, x, y, s * 1.6, t));
    A.flags.forEach(([x, y]) => { const wv = k => Math.sin(t * 5 + k) * 7, p = [[x, y], [x + 50, y + wv(1)], [x + 100, y + wv(2)], [x + 100, y + 60 + wv(2)], [x + 50, y + 60 + wv(1)], [x, y + 60], [x, y]]; line(g, p, sc.region === 'europe' && sc.era === 'modern' ? CH.blue : CH.red, 4); });
    A.lanterns.forEach(([x, y], i) => { const sw = Math.sin(t * 1.4 + i) * 0.08; g.save(); g.translate(x, y); g.rotate(sw); line(g, [[0, 0], [0, 10]], CH.white, 3); line(g, circP(0, 40, 22, 30), CH.red, 4); line(g, [[-12, 10], [12, 10]], CH.yellow, 4); g.restore(); });
    if (A.tumble) { const q = (t * 0.12) % 1.3, x = lerp(-200, WW + 200, q), r = 40; g.save(); g.translate(x, FL - r + Math.abs(Math.sin(t * 4)) * -20); g.rotate(t * 4); line(g, circP(0, 0, r, r), CH.brown, 3); line(g, [[-r, 0], [r, 0]], CH.brown, 2); line(g, [[0, -r], [0, r]], CH.brown, 2); line(g, circP(0, 0, r * 0.6, r * 0.5), CH.brown, 2); g.restore(); }
  }
  function drawWater(g, wtr, t, front) {
    if (!wtr) return; const { x0, x1, y } = wtr;
    if (front) { g.save(); const p = [[x0, y]]; for (let x = x0; x <= x1; x += 30) p.push([x, y + Math.sin(x * 0.03 + t * 2) * 4]); p.push([x1, y], [x1, FL + 175], [x0, FL + 175]); fillPoly(g, p, '#2a5363', 0.78); g.restore(); for (let k = 0; k < 3; k++) { const yy = y + 10 + k * 40, pts = []; for (let x = x0 + 20; x <= x1 - 20; x += 24) pts.push([x, yy + Math.sin(x * 0.035 + t * (2 + k) + k) * 5]); line(g, pts, CH.blue, 4 - k); } }
    else line(g, [[x0, y + 2], [x1, y + 2]], CH.blue, 3);
  }
  // The cartoon fight cloud: a tumbling scribble with fists, boots and stars poking out
  function brawlCloud(g, f, t) { const cx = f.cx, cy = FL - 0.42 * S, R0 = 0.42 * S, k = Math.min(1, f.p / 0.05, (1 - f.p) / 0.06), r = rng(Math.floor(t * 8));
    g.save(); g.globalAlpha *= cl(k, 0, 1); const pts = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, rr = R0 * (0.85 + 0.25 * Math.sin(a * 5 + t * 9) + (i % 2 ? 0.08 : 0)); pts.push([cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.8]); }
    fillPoly(g, pts, BOARD); line(g, pts, CH.white, 6); for (let i = 0; i < 3; i++) { const a = r() * 6.3, rr = R0 * (0.3 + r() * 0.3); line(g, circP(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.6, 26 + r() * 30, 18 + r() * 20), CH.grey, 4); }
    for (let i = 0; i < 4; i++) { const a = r() * 6.3, x0 = cx + Math.cos(a) * R0 * 1.1, y0 = cy + Math.sin(a) * R0 * 0.72, x1 = cx + Math.cos(a) * R0 * 1.55, y1 = cy + Math.sin(a) * R0 * 1.0; line(g, [[x0, y0], [x1, y1]], i % 2 ? CH.blue : CH.pink, 6); if (i % 2) line(g, circP(x1, y1, 13, 12), CH.white, 5); else line(g, [[x1 - 14, y1], [x1 + 14, y1 + 4]], CH.white, 8); }
    const W2 = ['POW!', 'BIFF!', 'WALLOP!', 'BOOT!', 'SKELP!'], wd = W2[Math.floor(t * 2.5) % W2.length], wa = (Math.floor(t * 2.5) * 2.1) % 6.3; text(g, wd, cx + Math.cos(wa) * R0 * 1.5, cy - R0 * 0.9 + Math.sin(wa) * 30, 54, CH.yellow); text(g, '*', cx + Math.cos(t * 7) * R0, cy - R0 * 0.7, 60, CH.yellow); g.restore(); }
  // Swearing in speech bubbles: shown as is, beeped with symbols, or scribbled out
  const SWEAR = /\b(motherfuck\w*|fuck\w*|f\*+ck\w*|shite?\w*|cunt\w*|bastard\w*|bollock\w*|wank\w*|prick\w*|twat\w*|dick|dicks|dickhead\w*|arse|arses|arsehole\w*|piss\w*|pish\w*|fanny|fannies|bawbag\w*|ballbag\w*|bellend\w*|bitch\w*|knob\w*|tosser\w*|fud|fuds|cock|cocks|cocksuck\w*|bugger\w*|tits?|bawheid\w*|jobby|jobbies|choob\w*|roaster\w*|walloper\w*)\b/gi;
  const GRAWL = '@#$%&!*';
  const beep = str => String(str).replace(SWEAR, w => w[0] + w.slice(1).split('').map((c, i) => GRAWL[(i + w.length) % GRAWL.length]).join(''));
  function drawFx(g, f, F, Q, t) {
    if (f.k === 'brawl') return brawlCloud(g, f, t);
    const hand = F.hands[f.side || Q.dir] || [F.hip[0], F.hip[1]], d = Q.dir;
    // A bullet streaking from the muzzle to whoever it is aimed at
    if (f.k === 'tracer') { const x0 = hand[0] + d * (f.len || 80), y0 = hand[1] - 14, x1 = f.tx, q = cl(f.q, 0, 1), xh = lerp(x0, x1, q), xt = lerp(x0, x1, Math.max(0, q - 0.35)); g.save(); g.globalAlpha *= 1 - cl((q - 0.85) / 0.15, 0, 1); line(g, [[xt, y0], [xh, y0]], CH.yellow, 6); line(g, [[xh - d * 14, y0], [xh, y0]], CH.white, 9); g.restore(); }
    // Where it hits: a burst (cartoon) or chalk blood (splat), and a slash line for a blade
    if (f.k === 'wound') { const aw = f.away || -d, c0 = [lerp(F.sh[0], F.hip[0], 0.3) - aw * 4, lerp(F.sh[1], F.hip[1], f.arm ? 0.05 : 0.3)], at = f.arm ? [c0[0] + d * F.hr * 0.6, c0[1]] : c0, k = out3(cl(f.p * 2, 0, 1)); g.save(); g.globalAlpha *= 1 - cl((f.p - 0.7) / 0.3, 0, 1);
      if (f.cut) line(g, [[at[0] - 40 * k, at[1] - 40 * k], [at[0] + 40 * k, at[1] + 40 * k]], GORE === 'splat' ? CH.red : CH.white, 6);
      if (GORE === 'splat') for (let i = 0; i < 9; i++) { const a = (i / 9 - 0.5) * 1.6 + (aw > 0 ? 0 : Math.PI), r = (40 + (i % 3) * 26) * out3(f.p); line(g, circP(at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r * 0.7 + f.p * f.p * 40, 6 - (i % 3), 6 - (i % 3)), CH.red, 5); }
      else for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(g, [[at[0] + Math.cos(a) * 10 * k, at[1] + Math.sin(a) * 10 * k], [at[0] + Math.cos(a) * 34 * k, at[1] + Math.sin(a) * 34 * k]], CH.white, 4); }
      g.restore(); }
    // A miss: the bullet pings off the wall behind them
    if (f.k === 'ricochet') { const aw = f.away || -d, x = F.hc[0] + aw * F.hr * 3.2, y = F.hc[1] + F.hr * 0.5, k = out3(cl(f.p * 2, 0, 1)); g.save(); g.globalAlpha *= 1 - cl((f.p - 0.6) / 0.4, 0, 1); line(g, circP(x, y, 7, 7), CH.white, 4); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; line(g, [[x + Math.cos(a) * 14, y + Math.sin(a) * 14], [x + Math.cos(a) * (14 + 28 * k), y + Math.sin(a) * (14 + 28 * k)]], CH.yellow, 3); } if (f.p < 0.6) text(g, 'PING!', x + aw * 30, y - 50 - 30 * k, 40, CH.yellow); g.restore(); }
    if (f.k === 'word') { const at = f.at === 'mouth' ? [F.hc[0] + d * F.hr * 1.6, F.hc[1] + F.hr * 0.3] : f.at === 'front' ? [F.hc[0] + d * F.hr * 2.2, F.hc[1] - F.hr * 0.6] : [F.hc[0] + d * F.hr * 0.6, F.top - 40]; const k = out3(cl(f.p * 2.5, 0, 1)); g.save(); g.globalAlpha *= 1 - cl((f.p - 0.75) / 0.25, 0, 1); text(g, f.s, at[0] + d * 40 * k, at[1] - 30 * k, 40 + 26 * k, f.col || CH.yellow); g.restore(); }
    if (f.k === 'stink') { const bx = F.hip[0] - d * 0.12 * S, by = F.hip[1]; g.save(); g.globalAlpha *= 1 - cl((f.p - 0.7) / 0.3, 0, 1); for (let i = 0; i < 4; i++) { const q = (f.p * 1.6 + i / 4) % 1; line(g, [[bx - d * q * 120, by - q * 60 - i * 8], [bx - d * q * 120 - d * 14, by - q * 60 - 22 - i * 8 + Math.sin(t * 9 + i) * 8], [bx - d * q * 120, by - q * 60 - 44 - i * 8]], CH.green, 4); } line(g, circP(bx - d * 70, by - 40, 60 + f.p * 40, 34 + f.p * 20), CH.green, 3); if (f.p < 0.7) text(g, f.word || 'PARP!', bx - d * 150, by - 120 - f.p * 40, 50, CH.yellow); g.restore(); }
    if (f.k === 'pish') { const sx = F.hip[0] + d * 0.08 * S, sy = F.hip[1] + 0.06 * S, ex = sx + d * 0.42 * S, ey = FL - 2, wob = Math.sin(t * 20) * 6, q = cl(f.p * 4, 0, 1), pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10 * q; pts.push([lerp(sx, ex, u), sy + (ey - sy) * u * u - Math.sin(u * Math.PI) * 50 + wob * u]); } line(g, pts, CH.yellow, 4); if (q >= 1) line(g, circP(ex, FL + 4, 30 + f.p * 50, 6 + f.p * 4), CH.yellow, 3); }
    if (f.k === 'gob') { const sx = F.hc[0] + d * F.hr, sy = F.hc[1] + F.hr * 0.4, q = f.q, x = sx + d * (f.far || 280) * q, y = sy - Math.sin(q * Math.PI) * 60 + q * q * (f.far > 400 ? 0 : FL - sy); line(g, circP(x, y, 7, 6), CH.white, 4); if (q > 0.95) line(g, circP(x, y + 4, 16, 5), CH.white, 3); }
    if (f.k === 'bogey') { const x = hand[0] + d * f.q * 220, y = hand[1] - Math.sin(f.q * Math.PI) * 80 + f.q * 120; line(g, circP(x, y, 6, 6), CH.green, 5); }
    if (f.k === 'tooth') { const aw = f.away || -d, x = F.hc[0] + aw * f.q * 260, y = F.hc[1] - Math.sin(f.q * Math.PI) * 160 + f.q * f.q * 400; g.save(); g.translate(x, y); g.rotate(f.q * 12); line(g, [[-8, -10], [8, -10], [6, 8], [2, 2], [-2, 2], [-6, 8], [-8, -10]], CH.white, 4); g.restore(); }
    if (f.k === 'splat' && GORE === 'splat') { const x = F.hc[0], y = F.hc[1], k = out3(f.p); g.save(); g.globalAlpha *= 1 - cl((f.p - 0.6) / 0.4, 0, 1); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.4, r = (30 + (i % 3) * 22) * k; line(g, circP(x + Math.cos(a) * r, y + Math.sin(a) * r, 7 + (i % 2) * 5, 6 + (i % 2) * 4), CH.red, 5); } fillPoly(g, circP(x + 10, y + 6, 20 * k, 16 * k), '#a33', 0.8); g.restore(); }
    if (f.k === 'shards') { const x = F.hc[0], y = F.top + 10, k = out3(f.p); g.save(); g.globalAlpha *= 1 - cl((f.p - 0.6) / 0.4, 0, 1); for (let i = 0; i < 9; i++) { const a = -Math.PI + i / 8 * Math.PI, r = 30 + 150 * k; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.6 + k * k * 160; line(g, f.chair ? [[px - 14, py], [px + 14, py + 4]] : [[px, py - 8], [px + 8, py + 6], [px - 6, py + 4], [px, py - 8]], f.chair ? CH.brown : CH.green, f.chair ? 6 : 3); } text(g, f.chair ? 'CRASH!' : 'SMASH!', x, y - 60 - 40 * k, 50, CH.yellow); g.restore(); }
    if (f.k === 'dust') { const x = F.hip[0], y = FL - 10, k = out3(cl(f.p, 0, 1)); g.save(); g.globalAlpha *= 1 - k; [-1, 1].forEach(s2 => line(g, circP(x + s2 * (30 + 90 * k), y - 10 * k, 24 + 20 * k, 14 + 10 * k), CH.grey, 4)); g.restore(); }
    if (f.k === 'bang') { const tip = [hand[0] + d * (f.len || 80), hand[1] - 14], k = out3(f.p); g.save(); g.globalAlpha *= 1 - f.p; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(g, [[tip[0] + Math.cos(a) * 14 * k, tip[1] + Math.sin(a) * 14 * k], [tip[0] + Math.cos(a) * (34 + 30 * k), tip[1] + Math.sin(a) * (34 + 30 * k)]], CH.yellow, 4); } text(g, 'BANG!', tip[0] + d * 60, tip[1] - 60 * k, 58, CH.red); g.restore(); line(g, circP(tip[0] + d * 30 * f.p, tip[1] - 30 * f.p, 12 + 20 * f.p, 10 + 16 * f.p), CH.grey, 3); }
    if (f.k === 'pow') { const x = hand[0] + d * 30, y = hand[1], k = out3(f.p); g.save(); g.globalAlpha *= 1 - f.p * 0.8; const st = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, rr = (i % 2 ? 26 : 54) * (0.6 + 0.4 * k); st.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } line(g, st, CH.yellow, 4); text(g, 'POW!', x + d * 40, y - 70 * k, 52, CH.yellow); g.restore(); }
    if (f.k === 'slash') { const c = [F.sh[0], F.sh[1]], r0 = 200; g.save(); g.globalAlpha *= 1 - f.p; for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 10; i++) { const a = lerp(-1.6, 1.0, i / 10 * f.p * 1.2); pts.push([c[0] + Math.cos(a) * (r0 - k * 24) * d, c[1] + Math.sin(a) * (r0 - k * 24)]); } line(g, pts, CH.white, 3 - k * 0.6); } g.restore(); }
    if (f.k === 'arrow') { const q = f.q, x = hand[0] + d * q * 1100, y = hand[1] - Math.sin(q * Math.PI) * 120 + q * 60; const a = Math.atan2(-Math.cos(q * Math.PI) * 120 * Math.PI + 60, d * 1100); g.save(); g.translate(x, y); g.rotate(d > 0 ? a : Math.PI - a); line(g, [[-60, 0], [20, 0]], CH.brown, 4); line(g, [[20, -8], [36, 0], [20, 8]], CH.grey, 4); line(g, [[-60, 0], [-72, -10]], CH.white, 2); line(g, [[-60, 0], [-72, 10]], CH.white, 2); g.restore(); }
    if (f.k === 'fly') { const q = f.q, dist = f.dist || 800, x = hand[0] + d * q * dist, y = hand[1] - Math.sin(q * Math.PI) * 260 * Math.min(1, dist / 800) + q * q * ((f.endY != null ? f.endY : FL - 20) - hand[1]); g.save(); g.translate(x, y); g.rotate(q * 9 * d); g.translate(-x, -y); if (f.prop === 'ball') line(g, circP(x, y, 18, 18), CH.white, 4); else propDraw(g, f.prop, [x, y], d, t, 0); g.restore(); }
    if (f.k === 'flash') { g.save(); g.globalAlpha *= 1 - f.p; const x = hand[0] + d * 30, y = hand[1] - 10; line(g, circP(x, y, 30 + f.p * 50, 30 + f.p * 50), CH.white, 5); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; line(g, [[x + Math.cos(a) * 40, y + Math.sin(a) * 40], [x + Math.cos(a) * 90, y + Math.sin(a) * 90]], CH.yellow, 4); } g.restore(); }
    if (f.k === 'stamp') { const k = out3(f.p); g.save(); g.globalAlpha *= 1 - cl((f.p - 0.7) / 0.3, 0, 1); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(g, [[hand[0] + Math.cos(a) * 30 * k, hand[1] + Math.sin(a) * 30 * k], [hand[0] + Math.cos(a) * (50 + 30 * k), hand[1] + Math.sin(a) * (50 + 30 * k)]], CH.yellow, 4); } text(g, 'STAMP!', hand[0], hand[1] - 90 * k, 54, CH.red); g.restore(); }
    if (f.k === 'thumb') line(g, [[hand[0], hand[1]], [hand[0], hand[1] - 26]], CH[Q.col] || CH.white, 6);
    if (f.k === 'drips') for (let i = 0; i < 5; i++) { const q = (f.p * 2 + i / 5) % 1; line(g, circP(F.hip[0] + (i - 2) * 22, F.sh[1] + q * 0.5 * S, 3, 6), CH.blue, 3); }
  }
  function drawSplash(g, f, wy, t) { const k = out3(f.p), n = f.big ? 14 : 8, h = f.big ? 320 : 180; g.save(); g.globalAlpha *= 1 - cl((f.p - 0.6) / 0.4, 0, 1);
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2, len = h * (0.6 + 0.4 * ((i * 7) % 3) / 2), q = Math.min(1, k * 1.4); const px = f.x + Math.cos(a) * len * q * 0.7, py = wy + Math.sin(a) * len * q * (1 - f.p * 0.4) + f.p * f.p * 160; line(g, circP(px, py, 6, 9), CH.blue, 4); }
    for (let k2 = 0; k2 < 2; k2++) { const q = cl(f.p * 1.4 - k2 * 0.25, 0, 1); line(g, circP(f.x, wy + 10, 60 + 260 * q, 12 + 20 * q), CH.blue, 4 * (1 - q) + 1); }
    if (f.big && f.p < 0.6) text(g, 'SPLOOSH!', f.x, wy - 300 * k, 64, CH.blue); g.restore(); }
  function drawTrip(g, sc, t) {
    const p = cl(t / sceneLen(sc), 0, 1), A0 = [400, 560], B0 = [1520, 560], air = sc.mode === 'plane', C0 = [960, air ? 240 : 560];
    const pathPt = q => air ? [(1 - q) * (1 - q) * A0[0] + 2 * (1 - q) * q * C0[0] + q * q * B0[0], (1 - q) * (1 - q) * A0[1] + 2 * (1 - q) * q * C0[1] + q * q * B0[1]] : [lerp(A0[0], B0[0], q), A0[1] + (sc.mode === 'ship' ? Math.sin(q * 20 + t * 3) * 6 : 0)];
    const IA = [], IB = [], pA = (pt, col, w) => IA.push({ p: pt, col, w }), pB = (pt, col, w) => IB.push({ p: pt, col, w }); regionIcon(pA, sc.from, 'modern', A0[0], A0[1] - 40, 1.3); regionIcon(pB, sc.to, 'modern', B0[0], B0[1] - 40, 1.3);
    const ra = cl(p / 0.2, 0, 1), rb = cl((p - 0.55) / 0.2, 0, 1); [[IA, ra], [IB, rb]].forEach(([L, rv]) => { const tot = L.reduce((m, q) => m + plen(q.p), 0); let u = tot * rv; L.forEach(q => { const l = plen(q.p); if (u > 0) line(g, partial(q.p, Math.min(1, u / l)), q.col, q.w); u -= l; }); });
    text(g, (sc.fromLabel || RNAME[sc.from] || '').toUpperCase(), A0[0], A0[1] + 70, 52, CH.white, 'center', ra); text(g, (sc.toLabel || RNAME[sc.to] || '').toUpperCase(), B0[0], B0[1] + 70, 52, CH.white, 'center', rb);
    if (sc.mode === 'train') { line(g, [[A0[0], A0[1] + 20], [B0[0], B0[1] + 20]], CH.white, 4); for (let x = A0[0]; x < B0[0]; x += 40) line(g, [[x, A0[1] + 14], [x + 14, A0[1] + 28]], CH.white, 3); }
    if (sc.mode === 'ship') for (let x = A0[0] - 40; x < B0[0] + 40; x += 60) line(g, [[x, A0[1] + 30], [x + 30, A0[1] + 20], [x + 60, A0[1] + 30]], CH.blue, 4);
    if (sc.mode === 'bus' || sc.mode === 'car' || sc.mode === 'horse' || sc.mode === 'walk') line(g, [[A0[0], A0[1] + 24], [B0[0], B0[1] + 24]], CH.brown, 3);
    const q = io(cl((p - 0.15) / 0.65, 0, 1)), dots = []; for (let k = 0; k <= 60; k++) dots.push(pathPt(k / 60 * q)); for (let k = 0; k < dots.length - 1; k += 2) line(g, [dots[k], dots[k + 1]], CH.white, 4);
    const P0 = pathPt(q), P1 = pathPt(Math.min(1, q + 0.01)), ang = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]), bob = Math.sin(t * 9) * 4; g.save(); g.translate(P0[0], P0[1] - (air ? 0 : 30)); g.rotate(air ? ang : 0);
    const L2 = (pts, c, w) => line(g, pts, c, w);
    if (air) { fillPoly(g, [[-50, 0], [40, -8], [60, 0], [40, 8], [-50, 0]], BOARD); L2([[-50, 0], [40, -10], [62, 0], [40, 10], [-50, 0]], CH.white, 5); L2([[0, -6], [-20, -46], [-6, -46], [22, -6]], CH.white, 5); L2([[0, 6], [-20, 46], [-6, 46], [22, 6]], CH.white, 5); L2([[-44, -2], [-56, -24], [-46, -24], [-34, -4]], CH.white, 4); }
    if (sc.mode === 'train') { L2(rectP(-80, -40, 160, 64), CH.white, 5); L2(rectP(-60, -28, 40, 28), CH.blue, 4); L2(rectP(10, -28, 40, 28), CH.blue, 4); L2(circP(-50, 26, 12, 12), CH.white, 4); L2(circP(50, 26, 12, 12), CH.white, 4); for (let k = 0; k < 3; k++) { const s2 = (t * 1.5 + k / 3) % 1; L2(circP(-60 - s2 * 90, -60 - s2 * 60, 10 + s2 * 16, 8 + s2 * 12), CH.grey, 3); } }
    if (sc.mode === 'bus') { L2(rectP(-90, -50, 180, 74), CH.yellow, 5); for (let k = 0; k < 4; k++) L2(rectP(-80 + k * 42, -40, 32, 26), CH.blue, 3.5); L2(circP(-55, 26, 14, 14), CH.white, 4); L2(circP(55, 26, 14, 14), CH.white, 4); }
    if (sc.mode === 'car') { L2([[-80, 10], [-80, -16], [-40, -20], [-20, -46], [40, -46], [60, -20], [84, -14], [84, 10], [-80, 10]], CH.red, 5); L2(circP(-46, 14, 14, 14), CH.white, 4); L2(circP(50, 14, 14, 14), CH.white, 4); }
    if (sc.mode === 'ship') { L2([[-110, 0], [110, 0], [80, 40], [-80, 40], [-110, 0]], CH.brown, 5); [-40, 30].forEach(dx => { L2([[dx, 0], [dx, -130]], CH.brown, 4); L2([[dx - 40, -120], [dx + 40, -120], [dx + 34, -50], [dx - 34, -50], [dx - 40, -120]], CH.white, 4); }); }
    if (sc.mode === 'horse') { g.translate(0, bob); L2([[-60, -20], [50, -20], [70, -60], [90, -50], [70, -10], [50, 0], [-60, 0], [-70, -20]], CH.brown, 5); [[-50, 0], [-30, 0], [30, 0], [50, 0]].forEach(([x], i) => L2([[x, 0], [x + Math.sin(t * 12 + i * 1.6) * 14, 50]], CH.brown, 4)); L2([[-70, -16], [-96, 10]], CH.brown, 4); L2(circP(0, -90, 14, 14), CH.white, 4); L2([[0, -76], [0, -30]], CH.white, 4); }
    if (sc.mode === 'walk') { const ph = t * 8; L2(circP(0, -150, 22, 22), CH.white, 4); L2([[0, -128], [0, -60]], CH.white, 4); L2([[0, -60], [Math.sin(ph) * 24, 0]], CH.white, 4); L2([[0, -60], [-Math.sin(ph) * 24, 0]], CH.white, 4); L2([[0, -110], [Math.sin(ph + Math.PI) * 26, -70]], CH.white, 4); L2([[0, -110], [Math.sin(ph) * 26, -70]], CH.white, 4); }
    g.restore();
  }
  function blurHint(cfg, look, t) { const P = plan(cfg), o = sceneAt(P, t); if (!o || o.sc.type === 'travel') return 1; const lt = t - o.t0; if (lt > o.d) return 3; const sim = simScene(o.sc, o, lt); let fast = false; o.sc.people.forEach(pe => { const a = sim[pe.pid] && sim[pe.pid].active; if (a && ['dive', 'cannonball', 'punch', 'swing', 'shoot', 'throw', 'run', 'charge', 'fall', 'jump'].includes(a.a.k)) fast = true; }); return fast ? 3 : 1; }

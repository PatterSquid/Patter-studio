/* Character: his Character Animator puppet brought to life from a voice recording and its script, without Adobe.
   Lip sync from LipSync; on top of that, everything a live performance has: blinks, breathing, the head moving with the
   speech (nods on stressed words, a tilt that changes with each phrase), glances in the pauses, eyebrows that lift on
   the loud bits. Square bracket tags in the script set the rest ([angry], [look left], [point], [shout], [lab coat]),
   and moves can be added and dragged on the timeline. Everything is a pure function of time. The voice comes from the
   media store (CutMedia), so the same clip plays with its sound in the Video tab and exports. */
const Character = (() => {
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, r2 = v => Math.round(v * 100) / 100, sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const nid = () => 'm' + Math.random().toString(36).slice(2, 8);
  let tick = 0;

  /* ---------- what tags mean ---------- */
  // emotions: eyebrows [dx, dy, rot] for his left (L, on the right of the screen) and right brow, and how the head sits
  const EMO = {
    calm: { L: [0, 0, 0], R: [0, 0, 0], dy: 0, rot: 0, lean: 0, gain: 1, shake: 0 },
    angry: { L: [-0.05, 0.3, -0.2], R: [0.05, 0.3, 0.2], dy: 0.02, rot: 0, lean: 0.015, gain: 1.35, shake: 0 },
    furious: { L: [-0.07, 0.42, -0.3], R: [0.07, 0.42, 0.3], dy: 0.03, rot: 0, lean: 0.03, gain: 1.7, shake: 1 },
    surprised: { L: [0.02, -0.75, 0.08], R: [-0.02, -0.75, -0.08], dy: -0.02, rot: 0, lean: -0.01, gain: 1.1, shake: 0 },
    suspicious: { L: [0, 0.32, -0.12], R: [0, -0.55, 0.06], dy: 0.01, rot: 0.04, lean: 0.01, gain: 0.7, shake: 0 },
    sad: { L: [-0.04, -0.2, 0.28], R: [0.04, -0.2, -0.28], dy: 0.035, rot: -0.02, lean: 0, gain: 0.6, shake: 0 },
    happy: { L: [0, -0.3, 0.05], R: [0, -0.3, -0.05], dy: -0.01, rot: 0.015, lean: 0, gain: 1.25, shake: 0 },
  };
  const EMO_NAMES = { calm: 'Calm', angry: 'Angry', furious: 'Raging', surprised: 'Surprised', suspicious: 'Suspicious', sad: 'Sad', happy: 'Happy' };
  const LOOKS = { 'look left': 'left', 'look right': 'right', 'look up': 'up', 'look down': 'down' };
  const ALIAS = { mad: 'angry', raging: 'furious', fuming: 'furious', shocked: 'surprised', shock: 'surprised', sus: 'suspicious', unhappy: 'sad', neutral: 'calm', normal: 'calm', chuffed: 'happy',
    shout: 'p1', rage: 'p1', 'lose it': 'p1', 'at you': 'p2', 'point at you': 'p2', you: 'p2', thumbs: 'thumbs up', thumb: 'thumbs up', 'thumbs-up': 'thumbs up', coat: 'lab coat',
    left: 'look left', right: 'look right', up: 'look up', down: 'look down', 'turn left': 'look left', 'turn right': 'look right', 'look away': 'look right', bang: 'fist', slam: 'fist', fists: 'fist', 'shake fist': 'fist shake', wag: 'finger wag' };
  const FRIENDLY = { p1: 'Shout (P1)', p2: 'Point at you (P2)', 'thumbs up': 'Thumbs up', fist: 'Fists', point: 'Point', wave: 'Wave', 'lab coat': 'Lab coat' };
  /* Hand gestures. Values are for his left hand (on the right of the screen, clear of the mic): where the wrist goes as
     [across, up] in head heights, and how far the hand turns (radians). His right hand mirrors them. art: the hand
     drawing from the puppet. Found by drawing each one (the hands are drawn lying on the desk, so they turn to point). */
  const GEST = {   // checked by him: turned, never mirrored (mirrored hands read back to front)
    point: { art: 'point', at: [-0.03, -0.32, 1.95], side: 'L', len: 1.5, label: 'Point' },
    'finger up': { art: 'point', at: [-0.05, -0.36, 2.35], side: 'L', len: 1.4, label: 'Finger up (listen)' },
    'point aside': { art: 'point', at: [-0.02, -0.3, 1.45], side: 'L', len: 1.5, label: 'Point over there' },
    wave: { art: 'wave', at: [0.1, -0.5, 2.2], side: 'L', len: 1.8, wag: 0.2, label: 'Wave' },
    explain: { art: 'wave', at: [0.05, -0.17, 2.6], side: 'L', len: 2, sway: 1, label: 'Explaining hand' },
    stop: { art: 'wave', at: [0.08, -0.26, 2.2], side: 'L', len: 1.4, label: 'Stop (palm up)' },
    shrug: { art: 'wave', at: [0.14, -0.12, 2.35], side: 'both', len: 1.5, label: 'Shrug' },
    'thumbs up': { art: 'thumbs up', at: [-0.02, -0.28, 0.1], side: 'L', len: 1.5, label: 'Thumbs up' },
    fist: { art: 'back fist', at: [0, 0, 0.5], sc: 1.1, side: 'both', len: 1.1, bang: 1, label: 'Bang the desk' },   // back fist: made by Puppet from the thumbs up (his fist drawing shows only its front)
    'fist shake': { art: 'back fist', at: [0, -0.3, 0.5], sc: 1.1, side: 'L', len: 1.4, shake: 1, label: 'Shake a fist' },
    slap: { art: null, at: [0, 0, 0], side: 'both', len: 1.1, bang: 1, label: 'Slap the desk' },
    'finger wag': { art: 'point', at: [-0.05, -0.36, 2.35], side: 'L', len: 1.4, wag: 0.16, wagHz: 19, label: 'Wag a finger' },
    beat: { art: null, at: [0, -0.07, 0.12], side: 'L', len: 0.7, label: 'Wee hand beat' },
  };
  Object.assign(ALIAS, { listen: 'finger up', one: 'finger up', 'hold on': 'finger up', there: 'point aside', 'over there': 'point aside', palm: 'explain', explaining: 'explain', 'hands up': 'stop', hello: 'wave', hiya: 'wave', dunno: 'shrug' });
  // words that bring a gesture with them; the common ones only when he leans on them
  const LEX = {}; const lex = (k, words, strong) => words.split(' ').forEach(w => { LEX[w] = { k, strong }; });
  // weak: everyday words, a gesture only when he leans on them; the rest always
  lex('point', 'you your youse yous ye yer yourself yersel', true); lex('point aside', 'that there them they those over', true); lex('finger up', 'see look', true); lex('finger up', 'listen first', false);
  lex('explain', 'this here thing', true); lex('explain', 'because cause basically idea reason problem', false); lex('wave', 'hello hi hiya cheerio bye goodbye welcome tara', false);
  lex('thumbs up', 'good nice', true); lex('thumbs up', 'great brilliant class magic best love amazing perfect belter quality', false); lex('stop', 'no naw', true); lex('stop', 'stop whoa woah hold calm nope', false);
  lex('shrug', 'why dunno whatever maybe apparently supposedly somehow anyway', false); lex('fist shake', 'ridiculous disgrace unbelievable joke bloody absolute', false); lex('finger wag', 'never', false); lex('fist', 'shut enough banned raging furious fuming', false);
  const LEN = { emotion: 0, look: 1.6, gesture: 1.8, pose: 1.4, costume: 0 };   // 0: until the next one of its kind
  // a tag to a move: { k, kind, side, dur }
  function readTag(raw, rig) {
    let s = String(raw || '').toLowerCase().trim(), dur = null; const m = s.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*s?$/); if (m) { s = m[1].trim(); dur = +m[2]; }
    let side = null; const sm2 = s.match(/^(.*?)\s+(left|right|both)( hand)?$/); if (sm2 && sm2[1] !== 'look' && sm2[1] !== 'turn') { s = sm2[1]; side = sm2[2] === 'both' ? 'both' : sm2[2] === 'left' ? 'L' : 'R'; }
    if (ALIAS[s]) s = ALIAS[s];
    const off = s.match(/^(no|stop|take off|off)\s+(.*)$/); if (off) { const k = ALIAS[off[2]] || off[2]; return { k, kind: 'costume', off: true }; }
    if (EMO[s]) return { k: s, kind: 'emotion', dur };
    if (LOOKS[s]) return { k: s, kind: 'look', dur };
    const trig = rig && rig.triggers && rig.triggers[s];
    if (GEST[s]) return { k: s, kind: 'gesture', side: side || GEST[s].side, dur };
    if (trig) { const kind = isCostume(rig, s) ? 'costume' : isPose(rig, s) ? 'pose' : 'gesture'; return { k: s, kind, side: side || 'L', dur }; }
    if (!rig && FRIENDLY[s]) return { k: s, kind: s === 'lab coat' ? 'costume' : /^p\d$/.test(s) ? 'pose' : 'gesture', side: side || 'L', dur };
    return null;
  }
  // a swap set's side (his right or left hand) and what sort of thing a trigger is
  const sideOf = (rig, id) => { let n = rig.nodes[id]; while (n) { const nm = String(n.name).replace(/^\+/, '').toLowerCase(); if (n.role === 'arm' && n.side) return n.side; if (/^(r|right)\s?(hand|arm)/.test(nm)) return 'R'; if (/^(l|left)\s?(hand|arm)/.test(nm)) return 'L'; n = rig.nodes[n.parent]; } return null; };
  const isHand = (rig, id) => /hand/i.test(rig.nodes[id].name);
  const isCostume = (rig, k) => { const tr = rig.triggers[k] || []; return tr.length > 0 && !tr.every(([id]) => isHand(rig, id)) && !isPose(rig, k); };
  const isPose = (rig, k) => (rig.triggers[k] || []).length === 1 && !isHand(rig, rig.triggers[k][0][0]) && rig.nodes[rig.triggers[k][0][0]].kids.length >= 2 && rig.nodes[rig.triggers[k][0][0]].kids.some(kd => kd.role === 'head' || (kd.kids || []).some(q => q.role === 'head' || q.role === 'body'));
  // every move he can make with this puppet, for the menus
  function catalogue(rig) {
    const out = Object.keys(EMO).map(k => ({ k, label: EMO_NAMES[k], kind: 'emotion' }));
    Object.keys(LOOKS).forEach(k => out.push({ k, label: k[0].toUpperCase() + k.slice(1), kind: 'look' }));
    Object.keys(GEST).forEach(k => out.push({ k, label: GEST[k].label, kind: 'gesture' }));
    if (rig) Object.keys(rig.triggers).forEach(k => { const r = readTag(k, rig); if (r && !GEST[k] && !rig.nodes.some(n => n.role === 'hand' && (rig.triggers[k] || []).some(([id]) => id === n.id))) out.push({ k, label: FRIENDLY[k] || (k[0].toUpperCase() + k.slice(1)), kind: r.kind }); });
    return out;
  }

  /* ---------- the voice and the timing ---------- */
  const last = {}, textMemo = new Map(), waiting = {};
  if (typeof Rhubarb !== 'undefined' && typeof indexedDB !== 'undefined') Rhubarb.ready().then(() => { tick++; });
  const engineOf = cfg => cfg.sync === 'rhubarb' && typeof Rhubarb !== 'undefined' && Rhubarb.state === 'ready' ? 'rhubarb' : 'patter';
  function syncOf(cfg) {
    const script = String(cfg.script || ''), eng = engineOf(cfg);
    if (cfg.voice && typeof CutMedia !== 'undefined') {
      const r = LipSync.peek(cfg.voice, script, eng); if (r) { last[cfg.voice] = r; return r; }
      const k = cfg.voice + '|' + script + '|' + eng; if (!waiting[k]) { waiting[k] = setTimeout(() => { LipSync.forMedia(cfg.voice, script, id => CutMedia.blobOf(id), eng).then(() => { tick++; }, e => console.warn('lip sync', e)).finally(() => { setTimeout(() => delete waiting[k], 50); }); }, 350); }
      return last[cfg.voice] || null;
    }
    if (script.trim()) { if (!textMemo.has(script)) { textMemo.set(script, LipSync.fromText(script, cfg.pace || 1)); if (textMemo.size > 12) textMemo.delete(textMemo.keys().next().value); } return textMemo.get(script); }
    return null;
  }
  async function prepare(cfg) {
    if (cfg.puppet) await Puppet.load(cfg.puppet);
    if (cfg.sync === 'rhubarb' && typeof Rhubarb !== 'undefined') await Rhubarb.ready();
    if (cfg.voice && typeof CutMedia !== 'undefined') await LipSync.forMedia(cfg.voice, String(cfg.script || ''), id => CutMedia.blobOf(id), engineOf(cfg)).catch(() => null);
  }

  /* ---------- the performance: everything decided once per voice, script and moves ---------- */
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const perfMemo = new Map();
  function perfOf(cfg, A, rig, dur) {
    const key = JSON.stringify([cfg.moves || [], cfg.energy, cfg.hands, cfg.sync, cfg.mood, cfg.costume, cfg.seed, rig ? rig.id : 0, dur.toFixed(2)]);
    let box = perfMemo.get(A || 'none'); if (box && box.key === key) return box.p;
    const R = rng(hash((cfg.voice || '') + (cfg.script || '').length + (cfg.seed || 0))), E = cl(+cfg.energy || 1, 0.2, 2.5), p = { E };
    const env = A ? A.env : new Float32Array(0), fps = A ? A.fps : 100, envAt = t => { const f = t * fps, i = Math.floor(f); if (i < 0 || i >= env.length - 1) return 0; return env[i] + (env[i + 1] - env[i]) * (f - i); };
    // smoothed loudness and phrases (speech between pauses of more than a third of a second)
    const N = Math.ceil(dur * 50) + 2, loud = new Float32Array(N); for (let i = 0; i < N; i++) { let s = 0, c = 0; for (let k = -6; k <= 6; k++) { s += envAt((i + k) / 50); c++; } loud[i] = s / c; }
    const slow = new Float32Array(N); for (let i = 0; i < N; i++) { let a = 0, c = 0; for (let k = -14; k <= 14; k++) { const j = i + k; if (j >= 0 && j < N) { const w = 15 - Math.abs(k); a += loud[j] * w; c += w; } } slow[i] = a / c; }
    p.slow = t => { const f = t * 50, i = Math.floor(f); return i < 0 || i >= N - 1 ? 0 : slow[i] + (slow[i + 1] - slow[i]) * (f - i); };
    p.loud = t => { const f = t * 50, i = Math.floor(f); return i < 0 || i >= N - 1 ? 0 : loud[i] + (loud[i + 1] - loud[i]) * (f - i); };
    const phrases = []; { const n2 = Math.ceil(dur * fps); let on = null, quiet = 0; for (let i = 0; i < n2; i++) { const t = i / fps, sp = (env[i] || 0) > 0.12; if (sp) { if (!on) on = [t, t]; on[1] = t; quiet = 0; } else if (on) { quiet += 1 / fps; if (quiet > 0.2) { phrases.push(on); on = null; } } } if (on) phrases.push(on); }
    p.phrases = phrases.map(([a, b]) => ({ a, b, tilt: (R() - 0.5) * 0.05, x: (R() - 0.5) * 0.05, y: (R() - 0.3) * 0.02 }));
    // nods on the stressed syllables: peaks of the level that stand above the dip before them, the bigger half of them in each phrase
    const lev = A && A.lev ? A.lev : env, peaks = [];
    for (let i = 4; i < lev.length - 4; i++) { const v = lev[i]; if (v < 0.35 || v < lev[i - 1] || v < lev[i + 1] || v < lev[i - 3] || v < lev[i + 3]) continue; let lo2 = v; for (let k = 1; k <= 14 && i - k >= 0; k++) lo2 = Math.min(lo2, lev[i - k]); if (v - lo2 < 0.06) continue; peaks.push({ t: i / fps, v, pr: v - lo2 }); }
    const nods = []; p.phrases.forEach(ph => { const inP = peaks.filter(q => q.t >= ph.a - 0.05 && q.t <= ph.b + 0.05).sort((x, y) => (y.v + y.pr) - (x.v + x.pr)); const keep = inP.slice(0, Math.max(1, Math.ceil(inP.length * 0.5))).sort((x, y) => x.t - y.t);
      keep.forEach(q => { if (nods.length && q.t - nods[nods.length - 1].t < 0.32) return; nods.push({ t: q.t, a: cl(0.35 + (q.v - 0.5) * 1.3 + q.pr * 2, 0.3, 1), s: R() < 0.5 ? -1 : 1 }); }); });
    p.nods = nods;
    // blinks every two to five seconds, sometimes twice; and with every head turn
    const blinks = []; for (let t = 0.6 + R() * 1.5; t < dur; t += 2.1 + R() * 3.4) { blinks.push(t); if (R() < 0.14) blinks.push(t + 0.26); }
    // moves: the script's tags, then the ones added on the timeline
    const moves = []; (A && A.tags || []).forEach((g, i) => { const m = readTag(g.tag, rig); if (m) moves.push(Object.assign({ id: 'tag' + i, start: g.t, auto: true, tag: g.tag }, m)); });
    (cfg.moves || []).forEach(mv => { const m = readTag(mv.k, rig); if (m) moves.push(Object.assign({ id: mv.id, start: +mv.start || 0, side: mv.side || m.side }, m, { dur: +mv.dur || m.dur })); });
    moves.forEach(m => { if (m.kind === 'gesture') m.start = Math.max(0, m.start - 0.38); });   // the hand gets there on the word
    if (cfg.hands !== 'tags' && A && A.words && A.words.length) planHands(cfg, A, p, moves, R, E, dur);
    moves.sort((a, b) => a.start - b.start);
    // lengths: emotions and costumes last until the next one of their kind
    moves.forEach((m, i) => { if (m.end != null) return; if (m.dur) { m.end = m.start + m.dur; return; } if (m.kind === 'gesture') { m.end = m.start + ((GEST[m.k] && GEST[m.k].len) || 1.6) + 0.4; return; } const L0 = LEN[m.kind]; if (L0) { m.end = m.start + L0; return; } const nx = moves.slice(i + 1).find(q => q.kind === m.kind && (m.kind !== 'costume' || q.k === m.k)); m.end = nx ? nx.start : dur + 10; });
    p.moves = moves;
    moves.filter(m => m.kind === 'look' || m.kind === 'pose').forEach(m => { blinks.push(m.start - 0.02); blinks.push(m.end - 0.02); });
    blinks.sort((a, b) => a - b); p.blinks = blinks;
    // glances away in the longer pauses
    const glances = []; for (let i = 0; i < p.phrases.length - 1; i++) { const a = p.phrases[i].b, b = p.phrases[i + 1].a; if (b - a > 0.9 && R() < 0.55) { const s = a + 0.15 + R() * 0.2; glances.push({ a: s, b: Math.min(b - 0.1, s + 0.45 + R() * 0.6), x: (R() < 0.5 ? -1 : 1) * (0.6 + R() * 0.4), y: (R() - 0.5) * 0.6 }); } }
    p.glances = glances;
    p.seeds = [R() * 9, R() * 9, R() * 9, R() * 9];
    perfMemo.set(A || 'none', { key, p }); if (perfMemo.size > 16) perfMemo.delete(perfMemo.keys().next().value);
    return p;
  }
  /* Natural hands from the script: words that carry a gesture, a shrug for questions, a bang on the desk for angry
     outbursts, and an explaining hand in sentences that would otherwise have none. Tags always win. */
  function planHands(cfg, A, p, moves, R, E, dur) {
    const W = A.words, lev = A.lev || A.env, fps = A.fps;
    const stress = w => { let m = 0; for (let f = Math.floor(w[0] * fps); f <= Math.ceil(w[1] * fps) && f < lev.length; f++) m = Math.max(m, lev[f] || 0); return m; };
    const sents = []; let cur = [];
    W.forEach((w, i) => { cur.push(i); const raw = String(w[2] || ''), nx = W[i + 1]; if (/[.!?]["')]*$/.test(raw) || !nx || nx[0] - w[1] > 0.6) { sents.push({ ids: cur, q: /\?/.test(raw), ex: /!/.test(raw) }); cur = []; } });
    const angryAt = t => { let k = cfg.mood || 'calm'; moves.filter(m => m.kind === 'emotion' && m.start <= t + 0.3).sort((x, y) => x.start - y.start).forEach(m => { k = m.k; }); return k === 'angry' || k === 'furious'; };
    const cand = [];
    sents.forEach(S => {
      const st = S.ids.map(i => stress(W[i])), med = st.slice().sort((a, b) => a - b)[Math.floor(st.length / 2)] || 0, a = W[S.ids[0]][0], b = W[S.ids[S.ids.length - 1]][1]; let got = false;
      S.ids.forEach((i, j) => { const L0 = LEX[W[i][4]]; if (!L0) return; if (j > 0 && LEX[W[S.ids[j - 1]][4]] && LEX[W[S.ids[j - 1]][4]].k === 'wave') return; if (L0.strong && st[j] < med + 0.02 && S.ids.length > 2) return; cand.push({ t: W[i][0], k: L0.k, why: W[i][4], pri: 2 + st[j], sEnd: b }); got = true; });
      const peak = S.ids[st.indexOf(Math.max(...st))];
      if (S.q && !got) { cand.push({ t: W[S.ids[S.ids.length - 1]][0], k: 'shrug', why: '?', pri: 1.6, sEnd: b }); got = true; }
      if (S.ex && angryAt(a)) { cand.push({ t: W[peak][0], k: 'fist', why: '!', pri: 1.9, sEnd: b }); got = true; }
      if (!got && b - a > 1.3 && R() < Math.min(1, 0.55 * E + 0.2)) cand.push({ t: W[peak][0], k: 'explain', why: '', pri: 1, sEnd: b, hold: true });
    });
    // in time order: close ones compete (the stronger stays); the ones kept flow into each other in the air
    const fixed = moves.filter(m => m.kind === 'gesture' || m.kind === 'pose').map(m => ({ a: m.start - 0.2, b: (m.end != null ? m.end : m.start + ((GEST[m.k] && GEST[m.k].len) || 1.6) + 0.4) + 0.2, side: m.kind === 'pose' ? 'both' : m.side }));
    const meets = (x, y) => x === 'both' || y === 'both' || x === y;
    const kept = [];
    cand.sort((x, y) => x.t - y.t).forEach(c => { const side = GEST[c.k].side; if (fixed.some(q => c.t - 0.4 < q.b && c.t + 0.6 > q.a && meets(q.side, side))) return;
      const last = kept.filter(k => meets(k.side, side)).pop(); if (last && c.t - last.t < 0.9) { if (c.pri > last.pri) kept[kept.indexOf(last)] = Object.assign(c, { side }); return; } kept.push(Object.assign(c, { side })); });
    kept.forEach((c, i) => { const G = GEST[c.k]; c.start = Math.max(0, c.t - 0.4); let len = G.len * (0.85 + 0.3 * R()); if (c.hold) len = Math.min(3.4, Math.max(G.len, c.sEnd - c.start + 0.15)); c.end = Math.min(dur, c.start + len + 0.4); });
    kept.forEach((c, i) => { const nx = kept.slice(i + 1).find(k => meets(k.side, c.side)); if (!nx) return; if (nx.start < c.end) c.end = Math.min(c.end, nx.start + 0.5); else if (nx.start - c.end < 0.35) c.end = nx.start + 0.5;   // run on rather than dip to the desk
      const fx = fixed.find(q => q.a > c.start && meets(q.side, c.side)); if (fx && fx.a < c.end) c.end = Math.max(c.start + 0.6, fx.a + 0.3); });
    kept.forEach(c => { const G = GEST[c.k], lab = G.label + (c.why && c.why.length > 1 && !G.label.toLowerCase().includes(c.why) ? ' (' + c.why + ')' : ''); moves.push({ id: 'h' + Math.round(c.start * 100) + c.k.replace(/\W/g, ''), k: c.k, kind: 'gesture', side: c.side, start: c.start, end: c.end, auto: true, plan: true, tag: lab }); });
  }
  const easeWin = (t, a, b, i, o) => sm((t - a) / i) * (1 - sm((t - b) / o));
  const wave = (t, s, f) => Math.sin(t * f + s) * 0.6 + Math.sin(t * f * 2.31 + s * 1.7) * 0.3 + Math.sin(t * f * 0.43 + s * 0.6) * 0.5;
  // The pose at a moment
  function poseAt(cfg, A, rig, p, t) {
    const hh = rig.pivot.headH, E = p.E, pose = { mouth: 'Neutral', blink: 0, swaps: {}, brow: { L: [0, 0, 0], R: [0, 0, 0] }, head: [0, 0, 0, 0], body: [0], arms: {}, pupil: [0, 0], view: 'front', dangle: 0 };
    // emotions, blended
    let em = { L: [0, 0, 0], R: [0, 0, 0], dy: 0, rot: 0, lean: 0, gain: 1, shake: 0 }; const base = EMO[cfg.mood] || EMO.calm, mix = [[base, 1]];
    p.moves.forEach(m => { if (m.kind !== 'emotion' || t < m.start - 0.3 || t > m.end + 0.4) return; const w = easeWin(t, m.start - 0.2, m.end, 0.42, 0.42); if (w > 0) mix.push([EMO[m.k], w]); });
    { let sw0 = 0; for (let i = 1; i < mix.length; i++) sw0 += mix[i][1]; mix[0][1] = Math.max(0, 1 - sw0); const tot = mix.reduce((a2, q) => a2 + q[1], 0) || 1; em.gain = 0;
      mix.forEach(([q, w0]) => { const w = w0 / tot; ['L', 'R'].forEach(sd => { for (let j = 0; j < 3; j++) em[sd][j] += q[sd][j] * w; }); em.dy += q.dy * w; em.rot += q.rot * w; em.lean += q.lean * w; em.gain += q.gain * w; em.shake += q.shake * w; }); }
    const G = E * em.gain, L = p.loud(t);
    // mouth
    if (A && A.visemes.length) { let lo = 0, hi = A.visemes.length - 1; if (t >= A.visemes[0][0]) { while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (A.visemes[mid][0] <= t) lo = mid; else hi = mid - 1; } pose.mouth = A.visemes[lo][1]; } }
    // the head: a slow drift, a tilt that changes with each phrase, nods on stressed words, forward when loud
    const s = p.seeds; let hx = wave(t, s[0], 0.55) * 0.010 * hh * (0.6 + 0.4 * E), hy = wave(t, s[1], 0.7) * 0.006 * hh, hr = wave(t, s[2], 0.45) * 0.008 * (0.6 + 0.4 * E);
    p.phrases.forEach(ph => { const w = easeWin(t, ph.a - 0.25, ph.b + 0.2, 0.45, 0.6); if (w > 0) { hr += ph.tilt * w * G; hx += ph.x * hh * w * G * 0.5; hy += ph.y * hh * w; } });
    for (const n of p.nods) { if (t < n.t - 0.08) break; const u = (t - n.t + 0.08) / 0.36; if (u > 1) continue; const k = Math.sin(Math.PI * u) * n.a * G; hy += k * 0.03 * hh; hr += k * 0.012 * n.s; }
    hy += em.dy * hh; hr += em.rot; const lean = (L * 0.025 + em.lean) * G;
    if (em.shake > 0.01) { hx += Math.sin(t * 61) * 0.004 * hh * em.shake * (0.4 + L); hy += Math.sin(t * 47 + 1) * 0.003 * hh * em.shake * (0.4 + L); }
    pose.head = [hx, hy, hr, lean];
    // eyebrows: the emotion, plus a lift on the loud bits
    const lift = -sm(cl((p.slow(t) - 0.3) / 0.45, 0, 1)) * 0.3 * Math.min(1.4, G) * (1 - 0.6 * cl((em.L[1] - 0.1) / 0.2, 0, 1));
    pose.brow.L = [em.L[0], em.L[1] + lift, em.L[2]]; pose.brow.R = [em.R[0], em.R[1] + lift * 1.1, em.R[2]];
    // blinks (shut for about a tenth of a second)
    for (const b of p.blinks) { if (b > t) break; if (t - b < 0.11) { pose.blink = 1; break; } }
    // eyes: on the camera, glancing away in long pauses
    for (const g of p.glances) { const w = easeWin(t, g.a, g.b, 0.08, 0.1); if (w > 0) { pose.pupil = [g.x * w, g.y * w]; break; } }
    // breathing, deeper before each phrase
    let br = Math.sin(t * 2 * Math.PI / 3.9 + s[3]) * 0.0035; p.phrases.forEach(ph => { const u = (t - (ph.a - 0.45)) / 0.45; if (u > 0 && u < 1) br += Math.sin(Math.PI * u) * 0.006; }); pose.body = [br];
    // moves: looks (head turns), hands, poses, costumes
    const sw = pose.swaps, apply = (k, side) => (rig.triggers[k] || []).forEach(([id, i]) => { if (side && side !== 'both' && isHand(rig, id)) { const sd = sideOf(rig, id); if (sd && sd !== side) return; } sw[id] = i; });
    if (cfg.costume && rig.triggers[cfg.costume]) apply(cfg.costume);
    for (const m of p.moves) {
      if (t < m.start || t >= m.end) continue;
      if (m.kind === 'look') { pose.view = LOOKS[m.k]; }
      else if (m.kind === 'costume') { if (m.off) (rig.triggers[m.k] || []).forEach(([id]) => { delete sw[id]; }); else apply(m.k); }
      else if (m.kind === 'pose') apply(m.k);
    }
    // hands: every gesture in play pulls the wrist towards its place; they blend, so one runs into the next
    const want = { L: [], R: [] }, hh2 = hh;
    for (const m of p.moves) {
      if (m.kind !== 'gesture' || t < m.start || t >= m.end) continue;
      const G = GEST[m.k] || { art: m.k, at: [0, -0.22, 0], side: m.side }, u = t - m.start, w = easeWin(t, m.start, m.end - 0.4, 0.42, 0.4), sides = m.side === 'both' ? ['L', 'R'] : [m.side || 'L'];
      sides.forEach(sd => { const mir = sd === 'R' ? -1 : 1; let [ax, ay, ar] = G.at;
        if (G.wag) ar += Math.sin(u * (G.wagHz || 14)) * G.wag * sm((u - 0.2) / 0.25);
        if (G.shake) { const on = sm((u - 0.3) / 0.2); ax += Math.sin(u * 27) * 0.014 * on; ay += Math.sin(u * 31 + 1) * 0.016 * on; }
        if (G.bang) { const v = u - 0.12; ay = v < 0.24 ? -0.17 * sm(v / 0.24) : v < 0.34 ? -0.17 * (1 - sm((v - 0.24) / 0.1)) : 0; if (v > 0.32 && v < 0.56) pose.head[1] += Math.sin((v - 0.32) / 0.24 * Math.PI) * 0.016 * hh2; }
        if (G.sway) { ay += Math.sin(t * 3.1 + 1) * 0.012; ar += Math.sin(t * 2.3) * 0.07; }
        if (!G.bang && !G.wag) for (const n of p.nods) { if (n.t < m.start + 0.25) continue; if (n.t > t + 0.1) break; const q = (t - n.t + 0.05) / 0.3; if (q > 0 && q < 1) { const k = Math.sin(Math.PI * q) * n.a; ay += 0.03 * k; ar += 0.07 * k; } }
        want[sd].push({ w, dx: ax * hh2 * mir, dy: ay * hh2, rot: ar * mir, art: G.art, fy: G.fy || 0, sc: G.sc || 1 }); });
    }
    ['L', 'R'].forEach(sd => { const L2 = want[sd]; if (!L2.length) return; let tw = 0, mx = 0, dx = 0, dy = 0, rot = 0, best = null; L2.forEach(q => { tw += q.w; mx = Math.max(mx, q.w); dx += q.dx * q.w; dy += q.dy * q.w; rot += q.rot * q.w; if (!best || q.w > best.w) best = q; });
      if (tw <= 0) return; pose.arms[sd] = { dx: dx / tw * mx, dy: dy / tw * mx, rot: rot / tw * mx, fy: best.art && mx > 0.3 ? best.fy : 0, sc: best.art && mx > 0.3 ? 1 + (best.sc - 1) * Math.min(1, (mx - 0.3) / 0.4) : 1 }; if (best.art && mx > 0.3) apply(best.art, sd); });
    // the hoodie strings swing a little with the head
    pose.dangle = (wave(t, s[0], 0.55) - wave(t - 0.2, s[0], 0.55)) * 0.15 * E + hr * 0.4;
    return pose;
  }

  /* ---------- framing ---------- */
  const FRAMES = [['desk', 'At his desk'], ['mid', 'Closer'], ['close', 'Head and shoulders']];
  function frameOf(cfg, rig, W, H) {
    const b = rig.bounds, bw = b[2] - b[0], bh = b[3] - b[1], hp = rig.pivot.head, hh = rig.pivot.headH, f = cfg.frame || 'desk', z0 = cl(+cfg.zoom || 1, 0.5, 3);
    let s, ox, oy;
    if (f === 'close' || f === 'mid') { const want = (f === 'close' ? 0.62 : 0.46) * H; s = want / hh; const cx = hp[0], top = hp[1] - hh * 0.95; ox = W / 2 - cx * s; oy = H * (f === 'close' ? 0.06 : 0.1) - top * s; }
    else { s = Math.min(W / bw, H / bh) * 1.0; ox = W / 2 - (b[0] + bw / 2) * s; oy = H - b[3] * s; }
    s *= z0; ox = W / 2 - (W / 2 - ox) * z0 + (+cfg.dx || 0) * W; oy = H - (H - oy) * z0 + (+cfg.dy || 0) * H;
    return { s, ox, oy };
  }

  /* ---------- the module ---------- */
  const defaults = () => ({ v: 1, puppet: '', voice: '', voiceName: '', script: "[calm] Right. Here's the thing nobody wanted to hear. [angry] They've only gone and shut the chippy! [point] You heard me.", moves: [], mood: 'calm', energy: 1, costume: '', frame: 'desk', hands: 'auto', zoom: 1, dx: 0, dy: 0, bg: 'colour', fill: '#4a5063', len: 6, pace: 1, seed: 0, vol: 0 });
  function duration(cfg) {
    if (cfg.voice && typeof CutMedia !== 'undefined') { const m = CutMedia.info(cfg.voice); if (m && m.dur) return Math.max(0.5, m.dur + 0.3); }
    const A = !cfg.voice && String(cfg.script || '').trim() ? syncOf(cfg) : null; if (A) return Math.max(1, A.dur + 0.4);
    return cl(+cfg.len || 6, 1, 600);
  }
  function draw(g, t, cfg, look, W, H) {
    const rig = cfg.puppet ? Puppet.get(cfg.puppet) : null;
    if (cfg.bg !== 'none' && !(look && look.transparent)) { g.fillStyle = /^#[0-9a-f]{6}$/i.test(cfg.fill || '') ? cfg.fill : '#4a5063'; g.fillRect(0, 0, W, H); }
    if (!rig) { g.save(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.textAlign = 'center'; g.font = `600 ${Math.round(H * 0.045)}px Archivo, sans-serif`; g.fillText(cfg.puppet ? 'Getting your puppet ready…' : 'Load your puppet to start', W / 2, H * 0.46);
      g.font = `${Math.round(H * 0.028)}px Archivo, sans-serif`; g.fillStyle = 'rgba(255,255,255,0.6)'; if (!cfg.puppet) g.fillText('A Character Animator .puppet file, or the Photoshop .psd behind it', W / 2, H * 0.53); g.restore(); return; }
    const A = syncOf(cfg), d = duration(cfg), p = perfOf(cfg, A, rig, d), pose = poseAt(cfg, A, rig, p, Math.max(0, t)), F = frameOf(cfg, rig, W, H);
    g.save(); g.translate(F.ox, F.oy); g.scale(F.s, F.s); g.imageSmoothingQuality = 'high'; Puppet.draw(g, rig, pose); g.restore();
  }

  /* ---------- sound in this tab's preview ---------- */
  let audio = null, audioId = null;
  function tickSound(t, playing, cfg) {
    if (!cfg || !cfg.voice || typeof CutMedia === 'undefined') { stopSound(); return; }
    if (audioId !== cfg.voice) { stopSound(); audioId = cfg.voice; audio = new Audio(); CutMedia.urlOf(cfg.voice).then(u => { if (audioId === cfg.voice && u && audio) audio.src = u; }); }
    if (!audio || !audio.src) return; audio.volume = cl(Math.pow(10, (+cfg.vol || 0) / 20), 0, 1);
    if (playing) { if (t >= audio.duration - 0.02) { if (!audio.paused) audio.pause(); return; } if (audio.paused) { try { audio.currentTime = t; } catch (e) { } audio.play().catch(() => { }); } else if (Math.abs(audio.currentTime - t) > 0.12) { try { audio.currentTime = t; } catch (e) { } } }
    else if (!audio.paused) audio.pause();
  }
  function stopSound() { if (audio) { try { audio.pause(); } catch (e) { } } audio = null; audioId = null; }

  /* ---------- the panel ---------- */
  function form(root, cfg, changed) {
    const { H, field, card, btn, sel, num, area } = UI; root.innerHTML = '';
    const redo = () => { changed(); form(root, cfg, changed); }, rig = cfg.puppet ? Puppet.get(cfg.puppet) : null;
    if (cfg.puppet && !rig) Puppet.load(cfg.puppet).then(r => { if (r && root.isConnected) form(root, cfg, changed); });
    const seg = (val, opts, fn) => H('div', { className: 'st-seg wrap' }, ...opts.map(([v, l]) => H('button', { type: 'button', className: String(v) === String(val) ? 'on' : '', textContent: l, on: { click: () => fn(v) } })));
    // the puppet
    const note = H('p', { className: 'hint', 'aria-live': 'polite' }), pick = H('input', { type: 'file', accept: '.puppet,.psd,.psb' }); pick.style.display = 'none';
    pick.addEventListener('change', async () => { const f = pick.files && pick.files[0]; if (!f) return; try { const r = await Puppet.importFile(f, (q, s) => { note.textContent = s + ' ' + Math.round(q * 100) + '%'; }); cfg.puppet = r.id; note.textContent = 'Loaded ' + r.rig.name + '.'; redo(); } catch (e) { note.textContent = e.message || String(e); } });
    const pupSel = sel(cfg.puppet || '', [['', cfg.puppet ? 'Getting it…' : 'None yet']], v => { cfg.puppet = v; redo(); }, 'Puppet');
    Puppet.list().then(L => { if (!L.length) return; pupSel.innerHTML = ''; L.forEach(p => pupSel.append(H('option', { value: p.id, textContent: p.name, selected: p.id === cfg.puppet }))); if (!cfg.puppet || !L.some(p => p.id === cfg.puppet)) { cfg.puppet = L[L.length - 1].id; redo(); } });
    root.append(card('Your character', field('Puppet', pupSel), H('div', { className: 'btnrow' }, btn(rig ? 'Load another puppet' : 'Load my puppet', () => pick.click(), rig ? '' : 'primary')), pick, note,
      rig ? H('p', { className: 'hint', textContent: `${rig.visemes.length} mouth shapes, ${Object.keys(rig.views).length} head turns, and ${Object.keys(rig.triggers).map(k => FRIENDLY[k] || k).join(', ') || 'no swaps'}. It stays on this computer.` }) : H('p', { className: 'hint', textContent: 'Use the .puppet file from Character Animator (File, Export, Puppet), or the Photoshop .psd behind it. It is kept in this browser and never uploaded.' })));
    // the voice
    const vpick = H('input', { type: 'file', accept: 'audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm' }); vpick.style.display = 'none'; const vnote = H('p', { className: 'hint', 'aria-live': 'polite' });
    vpick.addEventListener('change', async () => { const f = vpick.files && vpick.files[0]; if (!f || typeof CutMedia === 'undefined') return; vnote.textContent = 'Bringing in ' + f.name + '…'; try { const m = await CutMedia.importFile(f, (q) => { vnote.textContent = 'Bringing in ' + f.name + '… ' + Math.round(q * 100) + '%'; }); cfg.voice = m.id; cfg.voiceName = f.name; redo(); } catch (e) { vnote.textContent = e.message || String(e); } });
    const vinfo = cfg.voice && typeof CutMedia !== 'undefined' ? CutMedia.info(cfg.voice) : null, sounds = typeof CutMedia !== 'undefined' ? CutMedia.list().filter(m => (m.kind === 'audio' || (m.kind === 'video' && m.hasAudio !== false)) && !m.builtin) : [];
    const A = syncOf(cfg);
    root.append(card('Voice',
      field('Recording', sel(cfg.voice || '', [['', 'None (timed from the script)'], ...sounds.map(m => [m.id, m.name || 'Sound'])], v => { cfg.voice = v; const m = sounds.find(q => q.id === v); cfg.voiceName = m ? m.name : ''; redo(); }, 'Voice recording'),
        vinfo ? (vinfo.dur ? vinfo.dur.toFixed(1) + ' s.' : '') + (A && !A.guessed ? ' Lined up with the script.' : ' Lining up…') : 'Without a recording he says the script at a steady pace, so you can see it before you record.'),
      H('div', { className: 'btnrow' }, btn('Add a recording', () => vpick.click(), cfg.voice ? '' : 'primary')), vpick, vnote,
      ...(cfg.voice ? [field('Lip sync', seg(cfg.sync === 'rhubarb' ? 'rhubarb' : 'patter', [['patter', 'Patter (built in)'], ['rhubarb', 'Rhubarb']], v => { cfg.sync = v; redo(); }),
        cfg.sync === 'rhubarb' ? (typeof Rhubarb === 'undefined' ? 'Rhubarb is not in this version.' : Rhubarb.state === 'ready' ? (A && A.engine === 'rhubarb' ? 'Mouth shapes from Rhubarb Lip Sync.' : 'Rhubarb is working on it…') : 'Rhubarb needs a one-off download of about 40 MB, then works offline.') : 'Built in and instant. Try Rhubarb if the mouth looks off.'),
        ...(cfg.sync === 'rhubarb' && typeof Rhubarb !== 'undefined' && Rhubarb.state !== 'ready' ? [H('div', { className: 'btnrow' }, btn(Rhubarb.state === 'downloading' ? 'Downloading…' : 'Download Rhubarb (40 MB, once)', async e => { const b = e.target, note2 = vnote; b.disabled = true; try { await Rhubarb.download(q => { b.textContent = 'Downloading… ' + Math.round(q * 100) + '%'; }); note2.textContent = 'Rhubarb is ready.'; tick++; redo(); } catch (err) { note2.textContent = err.message || String(err); b.disabled = false; b.textContent = 'Try the download again'; } }, 'primary'))] : []),
        field('Volume (dB)', num(+cfg.vol || 0, v => { cfg.vol = Math.round(v); changed(); }, -30, 12, 1, 'Voice volume'))] : [field('Pace', seg(String(cfg.pace || 1), [['0.8', 'Slower'], ['1', 'Normal'], ['1.25', 'Quicker']], v => { cfg.pace = +v; textMemo.clear(); redo(); }))])));
    // the script
    const cat = catalogue(rig), tagHint = 'Tags: ' + cat.map(c => '[' + c.k + ']').join(' ') + '. Add a number for seconds, e.g. [point 3]. Hands: [point left]. Emotions last until the next one.';
    let tmr = null;
    root.append(card('Script', area(cfg.script || '', v => { cfg.script = v; clearTimeout(tmr); tmr = setTimeout(() => changed(), 250); }, 'Paste what you say, with [tags] where you want something to happen', 7, 'Script'), H('p', { className: 'hint', textContent: tagHint }),
      A && A.words && A.words.length && !A.guessed ? H('p', { className: 'hint', textContent: A.words.length + ' words lined up with the recording. The words show on the timeline: if one is badly out, check the script matches what you said.' }) : ''));
    // how he looks
    root.append(card('Look',
      field('Mood when nothing else is set', sel(cfg.mood || 'calm', Object.keys(EMO).map(k => [k, EMO_NAMES[k]]), v => { cfg.mood = v; changed(); }, 'Mood')),
      field('Hands', seg(cfg.hands === 'tags' ? 'tags' : 'auto', [['auto', 'Natural, from the script'], ['tags', 'Only my tags']], v => { cfg.hands = v; redo(); }), cfg.hands === 'tags' ? 'He keeps his hands on the desk unless a tag says otherwise.' : 'He points at “you”, waves at “hello”, shrugs at questions, bangs the desk when raging, and explains with his hand. Your tags always win.'),
      field('Energy', seg(String(cfg.energy || 1), [['0.6', 'Chilled'], ['1', 'Normal'], ['1.5', 'Lively'], ['2', 'Wired']], v => { cfg.energy = +v; redo(); })),
      ...(rig && Object.keys(rig.triggers).some(k => readTag(k, rig).kind === 'costume') ? [field('Wearing', sel(cfg.costume || '', [['', 'His usual'], ...Object.keys(rig.triggers).filter(k => readTag(k, rig).kind === 'costume').map(k => [k, FRIENDLY[k] || k])], v => { cfg.costume = v; changed(); }, 'Costume'))] : []),
      field('Framing', seg(cfg.frame || 'desk', FRAMES, v => { cfg.frame = v; redo(); })),
      field('Zoom', num(+cfg.zoom || 1, v => { cfg.zoom = r2(v); changed(); }, 0.5, 3, 0.05, 'Zoom')),
      field('Background', seg(cfg.bg === 'none' ? 'none' : 'colour', [['colour', 'Colour'], ['none', 'See-through']], v => { cfg.bg = v; redo(); }), cfg.bg === 'none' ? 'Export a PNG sequence, or put him over anything in the Video tab.' : ''),
      ...(cfg.bg !== 'none' ? [field('Colour', H('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cfg.fill || '') ? cfg.fill : '#4a5063', 'aria-label': 'Background colour', on: { input: e => { cfg.fill = e.target.value; changed(); } } }))] : []),
      H('div', { className: 'btnrow' }, btn('Different wee movements', () => { cfg.seed = ((+cfg.seed || 0) + 1) % 1000; changed(); }))));
    if (typeof Character.exportWithSound === 'function') root.append(card('Export', H('p', { className: 'hint', textContent: 'Makes an MP4 with his voice. In the Video tab, add him from Patter clips.' }), H('div', { className: 'btnrow' }, btn('Export MP4 with the voice', () => Character.exportWithSound(cfg), 'primary'))));
  }

  /* ---------- the timeline: words (to check the lip sync) and moves ---------- */
  const COL = { emotion: '#b0458f', look: '#3b7dd8', gesture: '#c0703a', pose: '#c81d24', costume: '#2f9a8a' };
  const editor = { formIsScene: true,
    tracks(cfg) { const A = syncOf(cfg), rig = cfg.puppet ? Puppet.get(cfg.puppet) : null, d = duration(cfg), T = [];
      if (A && A.words && A.words.length) T.push({ id: 'words', name: A.guessed ? 'Script' : 'Words', colour: '#3a5f8a', items: A.words.slice(0, 1500).map((w, i) => ({ id: 'W:' + i, start: w[0], end: Math.max(w[0] + 0.05, w[1]), label: w[2], colour: '#2d4a6e', move: false, trim: 'none' })) });
      const p = rig ? perfOf(cfg, A, rig, d) : null, ms = p ? p.moves : [];
      T.push({ id: 'moves', name: 'Moves', colour: '#b0458f', items: ms.map(m => ({ id: m.auto ? 'G:' + m.id : 'M:' + m.id, start: m.start, end: Math.min(d, Math.max(m.start + 0.2, m.end)), label: (m.auto ? '[' + m.tag + ']' : '') + (m.auto ? '' : (EMO_NAMES[m.k] || FRIENDLY[m.k] || m.k)) + (m.off ? ' off' : ''), colour: COL[m.kind] || '#666', move: !m.auto, trim: m.auto ? 'none' : 'both', minLen: 0.2, title: m.auto ? 'From the script: move the tag in the script to change it' : undefined })) });
      return T; },
    update(cfg, id, ch) { const [k, x] = id.split(':'); if (k !== 'M') return; const mv = (cfg.moves || []).find(q => q.id === x); if (!mv) return; mv.start = r2(Math.max(0, ch.start)); mv.dur = r2(Math.max(0.2, ch.end - ch.start)); },
    adds: [{ label: 'Move', title: 'Make him do something at the playhead: an emotion, a look, a hand gesture, a pose', choices: cfg0 => catalogue(cfg0 && cfg0.puppet ? Puppet.get(cfg0.puppet) : null).map(c => ({ label: c.label, key: c.k })),
      fn(cfg, t, sel2, ch) { const k = (ch && ch.key) || 'angry', rig = cfg.puppet ? Puppet.get(cfg.puppet) : null, m = readTag(k, rig), mv = { id: nid(), k, start: r2(Math.max(0, t)), dur: (m && (m.dur || LEN[m.kind])) || 3 }; cfg.moves = cfg.moves || []; cfg.moves.push(mv); return 'M:' + mv.id; } }],
    remove(cfg, id) { const [k, x] = id.split(':'); if (k === 'M') cfg.moves = (cfg.moves || []).filter(q => q.id !== x); },
    duplicate(cfg, id) { const [k, x] = id.split(':'); const it = k === 'M' && (cfg.moves || []).find(q => q.id === x); if (!it) return null; const c = Object.assign({}, it, { id: nid(), start: r2(it.start + (it.dur || 1)) }); cfg.moves.push(c); return 'M:' + c.id; },
    inspect(root, cfg, id, changed, done) { const [k, x] = id.split(':'); const { H, card, field, sel, btn } = UI; root.innerHTML = '';
      if (k === 'M') { const mv = (cfg.moves || []).find(q => q.id === x); if (!mv) return form(root, cfg, changed); const rig = cfg.puppet ? Puppet.get(cfg.puppet) : null;
        root.append(card('Move', field('What he does', sel(mv.k, catalogue(rig).map(c => [c.k, c.label]), v => { mv.k = v; changed(); }, 'Move')), H('p', { className: 'hint', textContent: 'Drag it on the timeline to move it; drag its ends to make it longer or shorter.' }),
          H('div', { className: 'btnrow' }, btn('Delete this move', () => { cfg.moves = cfg.moves.filter(q => q !== mv); changed(); done && done(); }), btn('Done', () => done && done()))));
        return; }
      if (k === 'G' || k === 'W') { root.append(card(k === 'G' ? 'From the script' : 'Word', H('p', { className: 'hint', textContent: k === 'G' ? 'This move comes from a [tag] in the script. Move or change the tag there.' : 'A word as it was lined up with the recording.' }), H('div', { className: 'btnrow' }, btn('Done', () => done && done())))); return; }
      form(root, cfg, changed); },
    scene(root, cfg, changed) { form(root, cfg, changed); },
  };
  const soundId = cfg => cfg && cfg.voice || null;
  // Just the puppet at a moment, in its own pixels (no background, no framing): for the Studio to place and light
  function drawRig(g, cfg, t) { const rig = cfg && cfg.puppet ? Puppet.get(cfg.puppet) : null; if (!rig) return null; const A = syncOf(cfg), d = duration(cfg), p = perfOf(cfg, A, rig, d); Puppet.draw(g, rig, poseAt(cfg, A, rig, p, Math.max(0, t))); return rig; }
  return { id: 'char', name: 'Character', mainThread: () => true, defaults, duration, draw, drawRig, form, editor, prepare, soundId, tick: tickSound, stopSound, poseAt, perfOf, readTag, catalogue, syncOf, frameOf, EMO, get ticks() { return tick + Puppet.tick; }, exportWithSound: null };
})();

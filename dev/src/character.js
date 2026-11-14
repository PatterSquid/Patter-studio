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
    // bursts: they come and go (a laugh, a rage), on top of whatever mood he is in
    rage: { L: [-0.09, 0.5, -0.36], R: [0.09, 0.5, 0.36], dy: 0.035, rot: 0, lean: 0.06, gain: 2, shake: 1.8, flush: 1 },
    laugh: { L: [0, -0.42, 0.08], R: [0, -0.42, -0.08], dy: -0.02, rot: 0.02, lean: 0, gain: 1.3, shake: 0, laugh: 1 },
  };
  const BURSTS = ['laugh', 'rage'], isBurst = k => BURSTS.includes(k);
  const EMO_NAMES = { laugh: 'Laugh', rage: 'Rage (red faced)', calm: 'Calm', angry: 'Angry', furious: 'Raging', surprised: 'Surprised', suspicious: 'Suspicious', sad: 'Sad', happy: 'Happy' };
  const LOOKS = { 'look left': 'left', 'look right': 'right', 'look up': 'up', 'look down': 'down' };
  const ALIAS = { laughing: 'laugh', lol: 'laugh', haha: 'laugh', lmao: 'laugh', pmsl: 'laugh', 'in stitches': 'laugh', raging: 'rage', fuming: 'rage', 'lose the plot': 'rage', 'red face': 'rage', livid: 'rage', mad: 'angry', shocked: 'surprised', shock: 'surprised', sus: 'suspicious', unhappy: 'sad', neutral: 'calm', normal: 'calm', chuffed: 'happy',
    shout: 'p1', rage: 'p1', 'lose it': 'p1', 'at you': 'p2', 'point at you': 'p2', you: 'p2', thumbs: 'thumbs up', thumb: 'thumbs up', 'thumbs-up': 'thumbs up', coat: 'lab coat',
    left: 'look left', right: 'look right', up: 'look up', down: 'look down', 'turn left': 'look left', 'turn right': 'look right', 'look away': 'look right', bang: 'fist', slam: 'fist', fists: 'fist', 'shake fist': 'fist shake', wag: 'finger wag' };
  const FRIENDLY = { p1: 'Shout (P1)', p2: 'Point at you (P2)', 'thumbs up': 'Thumbs up', fist: 'Fists', point: 'Point', wave: 'Wave', 'lab coat': 'Lab coat' };
  /* Hand gestures. Values are for his left hand (on the right of the screen, clear of the mic): where the wrist goes as
     [across, up] in head heights, and how far the hand turns (radians). His right hand mirrors them. art: the hand
     drawing from the puppet. Found by drawing each one (the hands are drawn lying on the desk, so they turn to point). */
  const GEST = {   // checked by him: turned, never mirrored (mirrored hands read back to front)
    point: { art: 'point you', at: [-0.05, -0.16, 0], side: 'L', len: 1.5, label: 'Point', old: { art: 'point', at: [-0.03, -0.32, 1.95] } },
    'finger up': { art: 'point', at: [-0.05, -0.36, 2.35], side: 'L', len: 1.4, label: 'Finger up (listen)' },
    'point aside': { art: 'point', at: [-0.02, -0.3, 1.45], side: 'L', len: 1.5, label: 'Point over there' },
    wave: { art: 'wave', at: [0.1, -0.5, 2.2], side: 'L', len: 1.8, wag: 0.2, label: 'Wave' },
    // his own talking hands (the green screen sheet, HandSheet): used when he has loaded them, else the old drawing in 'old'
    talk: { art: 'relaxed', at: [-0.05, -0.16, 0], side: 'L', len: 2, sway: 1, plain: 1, label: 'Relaxed talking hand', old: { art: 'wave', at: [0.05, -0.17, 2.6] } },
    explain: { art: 'open', at: [-0.05, -0.22, 0], side: 'L', len: 2, sway: 1, plain: 1, label: 'Explaining hand', old: { art: 'wave', at: [0.05, -0.17, 2.6] } },
    offer: { art: 'palm up', at: [0.02, -0.2, 0], side: 'L', len: 1.5, plain: 1, label: 'Palm up (here\u2019s the thing)', old: { art: 'wave', at: [0.14, -0.12, 2.35] } },
    stop: { art: 'wave', at: [0.08, -0.26, 2.2], side: 'L', len: 1.4, label: 'Stop (palm up)' },
    shrug: { art: 'palm up', at: [0.02, -0.18, 0], side: 'both', len: 1.5, plain: 1, label: 'Shrug', old: { art: 'wave', at: [0.14, -0.12, 2.35] } },
    'thumbs up': { art: 'thumbs up', at: [-0.02, -0.28, 0.1], side: 'L', len: 1.5, label: 'Thumbs up' },
    fist: { art: 'back fist', at: [0, 0, 0.5], sc: 1.1, side: 'both', len: 1.1, bang: 1, label: 'Bang the desk' },   // back fist: made by Puppet from the thumbs up (his fist drawing shows only its front)
    'fist shake': { art: 'back fist', at: [0, -0.3, 0.5], sc: 1.1, side: 'L', len: 1.4, shake: 1, label: 'Shake a fist' },
    slap: { art: null, at: [0, 0, 0], side: 'both', len: 1.1, bang: 1, label: 'Slap the desk' },
    'finger wag': { art: 'point', at: [-0.05, -0.36, 2.35], side: 'L', len: 1.4, wag: 0.16, wagHz: 19, label: 'Wag a finger' },
    // the everyday ones (he found raised hands all the time unnatural, November 2026): his resting hand stays as he drew it and
    // only lifts off the desk a little, beats on the stressed words and drifts; most talk to camera at a desk looks like this
    desk: { art: null, at: [-0.01, -0.04, 0.05], side: 'L', len: 2, bt: 0.5, drift: 1, label: 'Hand on the desk (wee beats)' },
    lift: { art: null, at: [-0.03, -0.1, 0.12], side: 'L', len: 1.2, bt: 0.6, label: 'Lift off the desk' },
    beat: { art: 'relaxed', at: [-0.03, -0.07, 0], side: 'L', len: 0.7, plain: 1, label: 'Wee hand beat', old: { art: null, at: [0, -0.07, 0.12], plain: 0 } },
    // gestures by meaning, all made from his own drawings (turned, moved or flipped, never redrawn)
    no: { art: null, at: [0.0, -0.2, 0], side: 'L', len: 1.3, sweep: 0.22, hold: 1, label: 'No (flat hand across)' },
    all: { art: 'open', at: [0.02, -0.22, 0], side: 'both', len: 1.6, sweep: 0.16, plain: 1, label: 'All of it (hands apart)', old: { art: null, at: [0.04, -0.14, 0], plain: 0 } },
    here: { art: 'point', at: [-0.02, -0.3, 0.1], side: 'L', len: 1.2, prep: 0.6, late: 0.8, tap: 0.15, label: 'Right here (finger down on the desk)' },   // his pointing hand as he drew it, held up so the fingertip lands on the desk
    self: { art: null, at: [-0.13, -0.36, 0.48], side: 'L', len: 1.3, hold: 1, label: 'Me (hand to chest)' },
    other: { art: 'palm up', at: [0.1, -0.2, 0], side: 'L', len: 1.5, sweep: 0.14, plain: 1, hold: 1, label: 'On the other hand', old: { art: 'wave', at: [0.16, -0.12, 2.35] } },
  };
  Object.assign(ALIAS, { listen: 'finger up', one: 'finger up', 'hold on': 'finger up', there: 'point aside', 'over there': 'point aside', palm: 'offer', 'palm up': 'offer', me: 'self', chest: 'self', everything: 'all', 'all of it': 'all', 'right here': 'here', tap: 'here', nope: 'no', 'other hand': 'other', talking: 'talk', explaining: 'explain', 'hands up': 'stop', hello: 'wave', hiya: 'wave', dunno: 'shrug' });
  // words that bring a gesture with them; the common ones only when he leans on them
  const LEX = {}; const lex = (k, words, strong) => words.split(' ').forEach(w => { LEX[w] = { k, strong }; });
  // weak: everyday words, a gesture only when he leans on them; the rest always
  lex('point', 'you your youse yous ye yer yourself yersel', true); lex('point aside', 'that there them they those over', true); lex('finger up', 'see look', true); lex('finger up', 'listen first', false);
  lex('explain', 'this here thing', true); lex('explain', 'because cause basically idea reason problem', false); lex('wave', 'hello hi hiya cheerio bye goodbye welcome tara', false);
  lex('thumbs up', 'good nice', true); lex('thumbs up', 'great brilliant class magic best love amazing perfect belter quality', false); lex('stop', 'no naw', true); lex('stop', 'stop whoa woah hold calm nope', false);
  lex('shrug', 'why dunno whatever maybe apparently supposedly somehow anyway', false); lex('fist shake', 'ridiculous disgrace unbelievable joke bloody absolute', false); lex('finger wag', 'never', false); lex('fist', 'shut banned raging furious fuming', false);
  const LEN = { emotion: 0, look: 1.6, gesture: 1.8, pose: 1.4, costume: 0 };   // 0: until the next one of its kind
  // a tag to a move: { k, kind, side, dur }
  function readTag(raw, rig) {
    let s = String(raw || '').toLowerCase().trim(), dur = null; const m = s.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*s?$/); if (m) { s = m[1].trim(); dur = +m[2]; }
    let side = null; const sm2 = s.match(/^(.*?)\s+(left|right|both)( hand)?$/); if (sm2 && sm2[1] !== 'look' && sm2[1] !== 'turn') { s = sm2[1]; side = sm2[2] === 'both' ? 'both' : sm2[2] === 'left' ? 'L' : 'R'; }
    if (ALIAS[s]) s = ALIAS[s];
    const off = s.match(/^(no|stop|take off|off)\s+(.*)$/); if (off) { const k = ALIAS[off[2]] || off[2]; return { k, kind: 'costume', off: true }; }
    if (isBurst(s)) return { k: s, kind: 'burst', dur };
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
  const handArt = (rig, sw, k, side) => (rig.triggers[k] || []).forEach(([id, i]) => { if (side && side !== 'both' && isHand(rig, id)) { const sd = sideOf(rig, id); if (sd && sd !== side) return; } sw[id] = i; });
  const isCostume = (rig, k) => { const tr = rig.triggers[k] || []; return tr.length > 0 && !tr.every(([id]) => isHand(rig, id)) && !isPose(rig, k); };
  const isPose = (rig, k) => (rig.triggers[k] || []).length === 1 && !isHand(rig, rig.triggers[k][0][0]) && rig.nodes[rig.triggers[k][0][0]].kids.length >= 2 && rig.nodes[rig.triggers[k][0][0]].kids.some(kd => kd.role === 'head' || (kd.kids || []).some(q => q.role === 'head' || q.role === 'body'));
  // every move he can make with this puppet, for the menus
  function catalogue(rig) {
    const out = Object.keys(EMO).map(k => ({ k, label: EMO_NAMES[k], kind: isBurst(k) ? 'burst' : 'emotion' }));
    Object.keys(LOOKS).forEach(k => out.push({ k, label: k[0].toUpperCase() + k.slice(1), kind: 'look' }));
    Object.keys(GEST).forEach(k => out.push({ k, label: GEST[k].label, kind: 'gesture' }));
    if (rig) Object.keys(rig.triggers).forEach(k => { const r = readTag(k, rig); if (r && !GEST[k] && !rig.nodes.some(n => n.role === 'hand' && (rig.triggers[k] || []).some(([id]) => id === n.id))) out.push({ k, label: FRIENDLY[k] || (k[0].toUpperCase() + k.slice(1)), kind: r.kind }); });
    return out;
  }

  /* ---------- the voice and the timing ---------- */
  const last = {}, textMemo = new Map(), waiting = {}, hearing = {}; let heardNote = '';
  if (typeof Listen !== 'undefined' && typeof indexedDB !== 'undefined') Listen.check().then(() => { tick++; }, () => { });
  /* A PatterScript file (the phone app's Send file) to what he says: the sections' words in order, the shot and edit
     cues (upper case tags, [beat], [pause]) taken out, his own lower case tags kept. */
  function fromPatterScript(text) {
    const t = String(text || ''); if (!/^# PatterScript:/m.test(t) && !/^## /m.test(t)) return t.trim().length < 20000 && !/^\s*[{<]/.test(t) ? t.trim() : '';
    const body = t.split(/^---\s*$/m)[0], out = []; let on = false;
    body.split('\n').forEach(line => { if (/^## /.test(line)) { on = true; return; } if (!on || /^\(empty\)\s*$/.test(line.trim())) return; out.push(line); });
    return out.join('\n').replace(/\[([^\[\]\n]{1,80})\]/g, (m, k) => { const h = k.split(':')[0].trim(); return h !== h.toLowerCase() || /^(beat|pause)(\s+[\d.]+s?)?$/.test(h) ? ' ' : m; }).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (typeof Rhubarb !== 'undefined' && typeof indexedDB !== 'undefined') Rhubarb.ready().then(() => { tick++; });
  const engineOf = cfg => cfg.sync === 'rhubarb' && typeof Rhubarb !== 'undefined' && Rhubarb.state === 'ready' ? 'rhubarb' : 'patter';
  const durHint = {};
  /* The export helpers draw him too: they get a copy of his puppet and the lip sync and voice length worked out here */
  function workerData(cfg) { if (!cfg || !cfg.puppet) return null; const rig = Puppet.forWorkers(cfg.puppet); if (!rig) return null; const A = syncOf(cfg), m = cfg.voice && typeof CutMedia !== 'undefined' ? CutMedia.info(cfg.voice) : null;
    return { rig, voice: cfg.voice || null, script: String(cfg.script || ''), A, dur: m && m.dur ? { dur: m.dur } : null }; }
  function adoptWorker(d) { if (!d) return; if (d.rig) Puppet.adopt(d.rig); if (d.voice && d.A) { ['patter', 'rhubarb'].forEach(e => LipSync.seed(d.voice, d.script, e, d.A)); last[d.voice] = d.A; } if (d.voice && d.dur) durHint[d.voice] = d.dur; }
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

  /* ---------- the performance: everything decided once per voice, script and moves ----------
     From the voice (LipSync: words and loudness; Prosody: pitch, how prominent each word is, phrases, arousal) and the
     words (Semantics) it plans what a person talking to camera does, each part from the research on it:
     * hands (McNeill 1992, Kendon 2004): a gesture per thought, chosen by what is being said, its stroke on the
       stressed syllable of the word it goes with (Loehr 2012), bigger when he leans on the word, held, then back down
     * head (Hadar 1983, McClave 2000, Munhall 2004): nods on accents, shakes on no, never, all and every, tilts on
       questions and doubt, riding up and down a little with the pitch of his voice
     * eyebrows (Ekman 1979, Krahmer and Swerts 2007): quick raises on the strongest accents, held up through a yes or
       no question, drawn down on a why or what
     * eyes (Kendon 1967, Lee and others 2002): on the camera, away for a moment while he finds the start of a thought,
       back by its first stress, small darts in between; blinks at the ends of phrases and with every look away
       (Homke and others 2017), about seventeen to twenty two a minute while talking
     * body (Cassell and others 2001): a shift of weight at a new thought after a pause; a breath in before each phrase
     * mood: from how worked up the voice is and what the words are, when the script has no mood tags
     The plan is then played through springs (bake): a move overshoots a touch and settles, the hand trails the arm. */
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const perfMemo = new Map();
  // things by the second they are in play, so a frame only looks at what is near it
  const mkIdx = (list, a, b, dur) => { const n = Math.ceil(dur) + 4, B = Array.from({ length: n }, () => []); list.forEach(m => { for (let s = Math.max(0, Math.floor(a(m))); s <= Math.min(n - 1, Math.floor(b(m))); s++) B[s].push(m); }); return t => B[t < 0 ? 0 : t >= n ? n - 1 : Math.floor(t)]; };
  function perfOf(cfg, A, rig, dur) {
    const key = JSON.stringify([cfg.moves || [], cfg.energy, cfg.hands, cfg.sync, cfg.mood, cfg.costume, cfg.seed, cfg.autoEmo, rig ? rig.id : 0, rig && rig.triggers ? Object.keys(rig.triggers).length : 0, dur.toFixed(2)]);
    let box = perfMemo.get(A || 'none'); if (box && box.key === key) return box.p;
    const R = rng(hash((cfg.voice || '') + (cfg.script || '').length + (cfg.seed || 0))), E = cl(+cfg.energy || 1, 0.2, 2.5), p = { E, dur };
    const env = A ? A.env : new Float32Array(0), fps = A ? A.fps : 100, envAt = t => { const f = t * fps, i = Math.floor(f); if (i < 0 || i >= env.length - 1) return 0; return env[i] + (env[i + 1] - env[i]) * (f - i); };
    const pros = (A && A.pros) || null, sem = A && A.words && A.words.length && typeof Semantics !== 'undefined' ? Semantics.read(A.words) : null; p.pros = pros; p.sem = sem;
    // smoothed loudness and phrases (speech between pauses of more than a third of a second)
    const N = Math.ceil(dur * 50) + 2, loud = new Float32Array(N); for (let i = 0; i < N; i++) { let s = 0, c = 0; for (let k = -6; k <= 6; k++) { s += envAt((i + k) / 50); c++; } loud[i] = s / c; }
    const slow = new Float32Array(N); for (let i = 0; i < N; i++) { let a = 0, c = 0; for (let k = -14; k <= 14; k++) { const j = i + k; if (j >= 0 && j < N) { const w = 15 - Math.abs(k); a += loud[j] * w; c += w; } } slow[i] = a / c; }
    p.slow = t => { const f = t * 50, i = Math.floor(f); return i < 0 || i >= N - 1 ? 0 : slow[i] + (slow[i + 1] - slow[i]) * (f - i); };
    p.loud = t => { const f = t * 50, i = Math.floor(f); return i < 0 || i >= N - 1 ? 0 : loud[i] + (loud[i + 1] - loud[i]) * (f - i); };
    // his pitch as -1 to 1 across his own range, for the head to ride on
    { const st = pros && pros.heard ? pros.st : null, mid = pros ? (pros.lo + pros.hi) / 2 : 0, half = pros ? Math.max(1.5, (pros.hi - pros.lo) / 2) : 1; p.f0n = t => { if (!st) return 0; const i = Math.round(t * pros.fps); return i < 0 || i >= st.length ? 0 : cl((st[i] - mid) / half, -1, 1); }; }
    const phrases = []; { const n2 = Math.ceil(dur * fps); let on = null, quiet = 0; for (let i = 0; i < n2; i++) { const t = i / fps, sp = (env[i] || 0) > 0.12; if (sp) { if (!on) on = [t, t]; on[1] = t; quiet = 0; } else if (on) { quiet += 1 / fps; if (quiet > 0.2) { phrases.push(on); on = null; } } } if (on) phrases.push(on); }
    p.phrases = phrases.map(([a, b]) => ({ a, b, tilt: (R() - 0.5) * 0.05, x: (R() - 0.5) * 0.05, y: (R() - 0.3) * 0.02 }));
    // nods on the accents: the words that stand out (pitch, loudness and length together); the stronger the bigger
    const nods = [];
    if (pros && pros.accents.length) pros.accents.forEach(ac => { if (ac.s < 0.5 || (nods.length && ac.t - nods[nods.length - 1].t < 0.4)) return; nods.push({ t: ac.t, a: cl(0.14 + Math.pow((ac.s - 0.5) / 0.5, 1.4) * 0.95, 0.14, 1), s: R() < 0.5 ? -1 : 1, w: ac.w }); });
    else { const lev = A && A.lev ? A.lev : env, peaks = [];
      for (let i = 4; i < lev.length - 4; i++) { const v = lev[i]; if (v < 0.35 || v < lev[i - 1] || v < lev[i + 1] || v < lev[i - 3] || v < lev[i + 3]) continue; let lo2 = v; for (let k = 1; k <= 14 && i - k >= 0; k++) lo2 = Math.min(lo2, lev[i - k]); if (v - lo2 < 0.06) continue; peaks.push({ t: i / fps, v, pr: v - lo2 }); }
      p.phrases.forEach(ph => { const inP = peaks.filter(q => q.t >= ph.a - 0.05 && q.t <= ph.b + 0.05).sort((x, y) => (y.v + y.pr) - (x.v + x.pr)); const keep = inP.slice(0, Math.max(1, Math.ceil(inP.length * 0.5))).sort((x, y) => x.t - y.t);
        keep.forEach(q => { if (nods.length && q.t - nods[nods.length - 1].t < 0.32) return; nods.push({ t: q.t, a: cl(0.35 + (q.v - 0.5) * 1.3 + q.pr * 2, 0.3, 1), s: R() < 0.5 ? -1 : 1 }); }); }); }
    p.nods = nods;
    // moves: the script's tags, then the ones added on the timeline
    const moves = []; (A && A.tags || []).forEach((g, i) => { const m = readTag(g.tag, rig); if (m) moves.push(Object.assign({ id: 'tag' + i, start: g.t, auto: true, tag: g.tag, word: g.word }, m)); });
    (Array.isArray(cfg.moves) ? cfg.moves : []).forEach(mv => { const m = readTag(mv.k, rig); if (m) moves.push(Object.assign({ id: mv.id, start: +mv.start || 0, side: mv.side || m.side }, m, { dur: +mv.dur || m.dur })); });
    moves.forEach(m => { if (m.kind === 'gesture') { m.at = m.start; m.start = Math.max(0, m.start - 0.45); } });   // the hand gets there on the word
    planBursts(cfg, A, p, moves, rig, dur);
    if (cfg.autoEmo !== false && sem && !moves.some(m => m.kind === 'emotion')) planMoods(cfg, A, p, moves);
    if (cfg.hands !== 'tags' && A && A.words && A.words.length) planHands(cfg, A, p, moves, R, E, dur, rig);
    planHead(cfg, A, p, moves, R, dur);
    moves.sort((a, b) => a.start - b.start);
    // lengths: emotions and costumes last until the next one of their kind
    moves.forEach((m, i) => { if (m.end != null) return; if (m.dur) { m.end = m.start + m.dur; return; } if (m.kind === 'burst') { m.end = m.start + 2.2; return; } if (m.kind === 'gesture') { m.end = m.start + ((GEST[m.k] && GEST[m.k].len) || 1.6) + 0.4; return; } const L0 = LEN[m.kind]; if (L0) { m.end = m.start + L0; return; } const nx = moves.slice(i + 1).find(q => q.kind === m.kind && (m.kind !== 'costume' || q.k === m.k)); m.end = nx ? nx.start : dur + 10; });
    p.moves = moves;
    planEyes(cfg, A, p, moves, R, dur);
    p.seeds = [R() * 9, R() * 9, R() * 9, R() * 9];
    const D = dur + 12;
    p.ix = { moves: mkIdx(moves, m => m.start - 0.6, m => Math.min(D, m.end + 0.8), D), phr: mkIdx(p.phrases, q => q.a - 0.8, q => q.b + 0.9, D), nods: mkIdx(nods, q => q.t - 0.5, q => q.t + 0.6, D), shakes: mkIdx(p.shakes, q => q.a - 0.1, q => q.b + 0.1, D), tilts: mkIdx(p.tilts, q => q.a - 0.5, q => q.b + 0.6, D), raises: mkIdx(p.raises, q => q.a - 0.3, q => q.b + 0.5, D), glances: mkIdx(p.glances, q => q.a - 0.2, q => q.b + 0.3, D), blinks: mkIdx(p.blinks, q => q, q => q + 0.3, D) };
    bake(cfg, A, rig, p, dur);
    perfMemo.set(A || 'none', { key, p }); if (perfMemo.size > 16) perfMemo.delete(perfMemo.keys().next().value);
    return p;
  }
  /* Laughs and rages: from tags ([laugh], [rage]), from the script (haha, SHOUTING!), and from the voice (laughing that
     is not in the script; shouting with an exclamation mark). A laugh covers the ha has that follow it; a rage runs to
     the end of its sentence, with the shout pose at its loudest moment and (in the planner) fists on the desk. */
  function planBursts(cfg, A, p, moves, rig, dur) {
    const W = A && A.words || [], lev = A && (A.lev || A.env) || new Float32Array(0), fps = A ? A.fps : 100, isHa = w => /^(ha|he|hah|heh|ah|hee|hoo)+h?$|^(lol|lmao|pmsl)$/.test(w || ''), haRun = i => { let j = i; while (j + 1 < W.length && isHa(W[j + 1][4])) j++; return j; };
    const sentEnd = i => { for (let j = i; j < W.length; j++) if (/[.!?]["')]*$/.test(String(W[j][2] || '')) || (W[j + 1] && W[j + 1][0] - W[j][1] > 0.6)) return W[j][1]; return W.length ? W[W.length - 1][1] : dur; };
    const wordAt = t => { let k = -1; W.forEach((w, i) => { if (w[0] <= t + 0.05) k = i; }); return Math.max(0, k); };
    moves.filter(m => m.kind === 'burst' && m.end == null).forEach(m => {
      if (m.dur) { m.end = m.start + m.dur; return; }
      const i = m.word != null ? W.findIndex(w => w[3] >= m.word) : wordAt(m.start);
      if (m.k === 'laugh') { let j = i, e = -1; while (j >= 0 && j < W.length && isHa(W[j][4])) { e = W[j][1]; j++; } m.end = e > m.start ? e + 0.3 : m.start + 2.2; }
      else m.end = Math.min(m.start + 6, Math.max(m.start + 1.2, (i >= 0 && W.length ? sentEnd(i) : m.start + 2.5) + 0.35));
    });
    const covered = (k, a, b) => moves.some(m => m.kind === 'burst' && m.k === k && a < m.end && b > m.start);
    if (cfg.autoEmo !== false && W.length) {
      // haha in the script
      for (let i = 0; i < W.length; i++) { if (!isHa(W[i][4])) continue; const j = haRun(i); if (j === i && !/^(ha|he|hah|heh){2,}|^(lol|lmao|pmsl)$/.test(W[i][4])) continue; const a = Math.max(0, W[i][0] - 0.12), b = W[j][1] + 0.3; if (!covered('laugh', a, b)) moves.push({ id: 'lgh' + i, k: 'laugh', kind: 'burst', start: a, end: b, auto: true, plan: true, tag: 'Laugh (' + W[i][4] + ')' }); i = j; }   // one 'ah' on its own is not a laugh
      // laughing that is not in the script: lively, bouncing sound between the words
      if (!A.guessed) { const gaps = []; let prev = 0; W.forEach(w => { gaps.push([prev, w[0]]); prev = w[1]; }); gaps.push([prev, dur]);
        gaps.forEach(([a, b]) => { if (b - a < 0.6) return; const f0 = Math.ceil(a * fps), f1 = Math.min(lev.length, Math.floor(b * fps)); if (f1 - f0 < 40) return; let m = 0, on = 0; for (let f = f0; f < f1; f++) { m += lev[f]; if (lev[f] > 0.3) on++; } m /= (f1 - f0); if (m < 0.22 || on / (f1 - f0) < 0.3) return;
          let best = 0; for (let L = 14; L <= 32; L++) { let c = 0, z = 0; for (let f = f0; f + L < f1; f++) { c += (lev[f] - m) * (lev[f + L] - m); z += (lev[f] - m) * (lev[f] - m); } best = Math.max(best, z > 0 ? c / z : 0); }
          if (best > 0.3 && !covered('laugh', a, b)) moves.push({ id: 'lgv' + Math.round(a * 100), k: 'laugh', kind: 'burst', start: a + 0.05, end: b - 0.05, auto: true, plan: true, tag: 'Laugh (heard)' }); }); }
      // SHOUTING with an exclamation mark, or the loudest bits with one
      let si = 0; const sents = []; W.forEach((w, i) => { const raw = String(w[2] || ''); if (/[.!?]["')]*$/.test(raw) || !W[i + 1] || W[i + 1][0] - w[1] > 0.6) { sents.push([si, i, /!/.test(raw), /!!/.test(raw)]); si = i + 1; } });
      const lv = sents.map(([a, b]) => { let m = 0, c = 0; for (let f = Math.floor(W[a][0] * fps); f < Math.min(lev.length, W[b][1] * fps); f++) { m += lev[f]; c++; } return c ? m / c : 0; }), med = lv.slice().sort((x, y) => x - y)[Math.floor(lv.length / 2)] || 0;
      sents.forEach(([a, b, ex, ex2], k) => { const caps = W.slice(a, b + 1).some(w => { const r = String(w[2] || '').replace(/[^A-Za-z]/g, ''); return r.length >= 3 && r === r.toUpperCase(); });
        const laughLine = W.slice(a, b + 1).every(w => isHa(w[4])); if (!ex || laughLine || !(caps || ex2 || (!A.guessed && sents.length >= 3 && lv[k] >= 0.7 && lv[k] >= med + 0.15))) return; const s0 = Math.max(0, W[a][0] - 0.15), e0 = W[b][1] + 0.35; const prevR = moves.find(m => m.kind === 'burst' && m.k === 'rage' && m.plan && s0 < m.end + 0.8 && e0 > m.start); if (prevR) { prevR.end = Math.max(prevR.end, e0); return; } if (!covered('rage', s0, e0)) moves.push({ id: 'rg' + a, k: 'rage', kind: 'burst', start: s0, end: e0, auto: true, plan: true, tag: 'Rage (shouting)' }); });   // shouting: clearly louder than his usual
    }
    // the shout pose at the loudest moment of a long rage; a slap on the desk as a long laugh dies away
    moves.filter(m => m.kind === 'burst').slice().forEach(m => {
      if (m.k === 'rage' && m.end - m.start >= 1.6 && rig && rig.triggers && rig.triggers.p1 && !moves.some(q => q.kind === 'pose' && q.start < m.end && q.end > m.start)) { let bt = m.start + 0.5, bv = -1; for (let f = Math.floor((m.start + 0.3) * fps); f < Math.min(lev.length, (m.end - 0.5) * fps); f++) if (lev[f] > bv) { bv = lev[f]; bt = f / fps; } moves.push({ id: 'p1' + m.id, k: 'p1', kind: 'pose', start: Math.max(m.start + 0.2, bt - 0.15), end: Math.max(m.start + 0.2, bt - 0.15) + 0.8, auto: true, plan: true, tag: 'Shout pose' }); }
      if (m.k === 'laugh' && m.end - m.start >= 1.4 && cfg.hands !== 'tags') moves.push({ id: 'sl' + m.id, k: 'slap', kind: 'gesture', side: 'both', start: m.end - 0.95, end: m.end + 0.35, auto: true, plan: true, tag: 'Slap the desk (laughing)' });
    });
  }
  /* Mood from the voice and the words, a sentence at a time, when the script has no mood tags: how worked up he is
     (arousal: louder, higher, wider and quicker than his own usual) and whether the words are good or bad news. Kept
     cautious: most sentences stay as they are. */
  function planMoods(cfg, A, p, moves) {
    const pros = p.pros, sem = p.sem, ips = pros ? pros.ips : [], heard = !!(pros && pros.heard && !A.guessed);
    const arAt = (a, b) => { let s = 0, c = 0; ips.forEach(P => { const o = Math.min(b, P.b) - Math.max(a, P.a); if (o > 0) { s += P.arousal * o; c += o; } }); return c ? s / c : 0.4; };
    const burst = (a, b) => moves.some(m => m.kind === 'burst' && a < (m.end != null ? m.end : m.start + 2) && b > m.start);
    const runs = []; sem.sents.forEach(S => { const ar = heard ? arAt(S.t0, S.t1) : 0.4 + (S.ex ? 0.18 : 0) + (S.caps ? 0.2 : 0) + (S.ex2 ? 0.1 : 0); let k = 'calm';
      if (ar >= 0.74 && (S.swear || S.val < 0 || S.ex)) k = 'furious';
      else if ((ar >= 0.56 && (S.swear || S.val < 0)) || (S.swear && S.ex) || (S.ex && S.val < 0)) k = 'angry';
      else if (S.ex2 || (S.q && S.ex)) k = 'surprised';
      else if (S.val > 0 && ar >= 0.45 && !S.q) k = 'happy';
      else if (S.val < 0 && ar < 0.27) k = 'sad';
      else if (S.doubt && ar < 0.5 && !S.q) k = 'suspicious';
      if (k === 'calm' || burst(S.t0, S.t1)) return; const last = runs[runs.length - 1];
      if (last && last.k === k && S.t0 - last.b < 1.2) last.b = S.t1; else runs.push({ k, a: S.t0, b: S.t1 }); });
    runs.forEach((r, i) => moves.push({ id: 'md' + i, k: r.k, kind: 'emotion', start: Math.max(0, r.a - 0.2), end: r.b + 0.35, auto: true, plan: true, tag: EMO_NAMES[r.k] + (heard ? ' (voice)' : ' (words)') }));
  }
  /* Natural hands, planned the way people use them (McNeill, Kendon): the hands come up for a thought (an intonation
     phrase), give small beats on the accents, and make a bigger gesture when the words call for one, chosen by what is
     being said (pointing words, no and never, all and every, doubt, questions, lists, but and however, good and bad),
     its stroke landing on that word's stressed syllable. They hold through short pauses and go back to the desk at the
     long ones. How much of the talking has hands going is the activity setting (about a third, a half or three
     quarters), more when he is worked up, less when he is sad; short throwaway lines stay still. The same big gesture
     is not used twice running. Tags always win. */
  const TALKING = { relaxed: 1, open: 1 };
  const ACT = { calm: 0.3, natural: 0.5, auto: 0.5, animated: 0.85 };
  const BIG_GAP = { calm: 9, natural: 6, auto: 6, animated: 3.5 };   // seconds between bigger gestures: most of the time the hand just works on the desk   // animated asks a little over three quarters: throwaway lines stay still whatever
  function planHands(cfg, A, p, moves, R, E, dur, rig) {
    const W = A.words, lev = A.lev || A.env, fps = A.fps, target0 = ACT[cfg.hands] || 0.5, pros = p.pros, sem = p.sem, U = pros ? pros.units : null;
    // each word's stress: how prominent it is and when its stressed syllable peaks (with no pitch to go on, how loud)
    const pk = W.map((w, i) => { if (U && U[i] && U[i].w === i) return { v: U[i].prom, t: U[i].t }; let m = 0, at = (w[0] + w[1]) / 2; for (let f = Math.floor(w[0] * fps); f <= Math.ceil(w[1] * fps) && f < lev.length; f++) if ((lev[f] || 0) > m) { m = lev[f]; at = f / fps; } return { v: m, t: Math.min(Math.max(at, w[0]), w[1]) }; });
    const medOf = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] || 0, medAll = medOf(pk.map(q => q.v));
    // phrases: speech between pauses, or to the end of a sentence
    const ph = [];
    if (pros && pros.ips.length && U && U.length === W.length) pros.ips.forEach(P => ph.push({ ids: P.u.slice(), a: P.a, b: P.b, q: P.q, ex: P.ex, ar: P.arousal, sent: P.sent }));
    else { let cur = []; W.forEach((w, i) => { cur.push(i); const raw = String(w[2] || ''), nx = W[i + 1]; if (/[.!?;:]["')]*$/.test(raw) || !nx || nx[0] - w[1] > 0.25) { ph.push({ ids: cur, a: W[cur[0]][0], b: w[1], q: /\?/.test(raw), ex: /!/.test(raw), ar: 0.4, sent: true }); cur = []; } }); }
    const sentOf = i => sem ? sem.sents.find(S => i >= S.a && i <= S.b) : null;
    const moodAt = t => { if (moves.some(m => m.kind === 'burst' && m.k === 'rage' && t >= m.start - 0.3 && t <= (m.end != null ? m.end : m.start + 3))) return 'rage'; let k = cfg.mood || 'calm'; moves.filter(m => m.kind === 'emotion' && m.start <= t + 0.3 && (m.end == null || m.end > t)).sort((x, y) => x.start - y.start).forEach(m => { k = m.k; }); return k; };
    const boost = k => k === 'rage' || k === 'furious' ? 0.3 : k === 'angry' ? 0.2 : k === 'happy' || k === 'surprised' ? 0.1 : k === 'sad' ? -0.15 : 0;
    const laughing = (a, b) => moves.some(m => m.kind === 'burst' && m.k === 'laugh' && a < m.end && b > m.start);
    const can = k => { const G = GEST[k]; return !!G && (!G.art || !!(rig && rig.triggers && rig.triggers[G.art]) || !!G.old); };
    ph.forEach(P => {
      P.med = medOf(P.ids.map(i => pk[i].v)); P.peak = P.ids.reduce((m, i) => pk[i].v > pk[m].v ? i : m, P.ids[0]); P.mood = moodAt(P.a);
      const cross = P.ex || P.mood === 'angry' || P.mood === 'furious' || P.mood === 'rage', S = sentOf(P.ids[0]), lastOfSent = !!S && P.ids[P.ids.length - 1] === S.b;   // fists only when he is worked up
      // what the words call for: each candidate is a gesture, the word its stroke lands on, and a score (the word's class and how hard he leans on it)
      const C = [], add = (k, i, base, need, why) => { if (!can(k) || pk[i].v < (need || 0)) return; C.push({ k, i, sc: base + pk[i].v, why: why || W[i][4] }); };
      P.ids.forEach((i, j) => { const c = sem ? sem.cls[i] : [], has = k => c.includes(k), w = W[i][4];
        // only what people really do at a desk with their hands up (he found the rest unnatural): the hand comes up for a
        // question, a shrug, a pointed "you", a greeting, counting, a "no", and a bang when he is raging
        if (has('greet') && (W[i][0] < 6 || W[i][0] > dur - 8)) add('wave', i, 2.2, 0.3);
        if (has('stop')) add('stop', i, 1.6, 0.6);
        if (has('neg')) add('no', i, 1.3, 0.45);
        if (has('doubt')) add('shrug', i, 1.5, 0.55);
        if (has('num') && j + 2 < P.ids.length && sem.cls[P.ids[j + 1]].includes('num') && !(j > 0 && sem.cls[P.ids[j - 1]].includes('num'))) add('finger up', i, 1.5, 0, 'counting');   // one, two, three: the finger goes up and beats on each
        if (has('you')) add('point', i, 1.0, 0.72);
        if (has('self')) add('self', i, 0.8, 0.75);
        if (has('all') || has('intens') || has('because')) add('lift', i, 0.9, 0.5);
        if ((has('rage') || (has('swear') && P.ex)) && cross) add('fist', i, 2.1, 0.5);
        if (!sem) { const L0 = LEX[w]; if (L0 && !(GEST[L0.k] && (GEST[L0.k].bang || GEST[L0.k].shake) && !cross)) add(L0.k, i, L0.strong ? 1 : 2, L0.strong ? Math.max(P.med, medAll) + 0.03 : 0); } });
      if (P.q && lastOfSent !== false) add('offer', P.peak, 1.3, 0, '?');
      if (P.ex && (P.mood === 'furious' || P.mood === 'rage')) add('fist', P.peak, 2.4, 0, '!');
      P.cand = C.sort((x, y) => y.sc - x.sc); P.trig = P.cand[0] || null;
      const len = P.b - P.a, throwaway = len < 0.7 || P.ids.length <= 2;
      P.pri = (P.trig ? 0.8 + P.trig.sc * 0.3 : 0) + (pk[P.peak].v - medAll) * 2.5 + Math.min(len, 3) / 3 + (P.ex ? 0.4 : 0) + ((P.ar || 0.4) - 0.4) * 1.5 + R() * 0.35 - (throwaway && !P.trig ? 2 : 0) - (laughing(P.a, P.b) ? 5 : 0);
    });
    // which phrases get hands: the strongest first, until his share of the talking time is reached
    const budget = ph.reduce((s2, P) => s2 + (P.b - P.a) * cl(target0 + boost(P.mood) + ((P.ar || 0.4) - 0.4) * 0.3, 0.1, 0.95), 0); let used = 0;
    ph.slice().sort((x, y) => y.pri - x.pri).forEach(P => { const len = P.b - P.a; if (P.pri > -0.5 && used + len * 0.7 + 0.3 <= budget) { P.on = true; used += len + 0.4; } });   // the best fits, a phrase not cut in half
    // what is fixed already (tags, the bursts' slaps and poses): keep clear of it
    const fixed = moves.filter(m => m.kind === 'gesture' || m.kind === 'pose').map(m => ({ a: m.start - 0.25, b: (m.end != null ? m.end : m.start + ((GEST[m.k] && GEST[m.k].len) || 1.6) + 0.4) + 0.25, side: m.kind === 'pose' ? 'both' : m.side }));
    const meets = (x, y) => x === 'both' || y === 'both' || x === y, clash = (a, b, side) => fixed.some(q => a < q.b && b > q.a && meets(q.side, side));
    // gesture units: active phrases less than 0.6 s apart share one, the hand held up between them
    const endsSentence = P => /[.!?]["')]*$/.test(String(W[P.ids[P.ids.length - 1]][2] || ''));
    const units = []; ph.filter(P => P.on).forEach(P => { const u = units[units.length - 1], prev = u && u.ph[u.ph.length - 1]; if (u && P.a - u.b < 0.6 && !(endsSentence(prev) && P.a - u.b >= 0.3) && P.b - u.a < 4.5) { u.ph.push(P); u.b = P.b; } else units.push({ ph: [P], a: P.a, b: P.b }); });   // a new thought (a sentence after a breath, or past four and a half seconds) is a new unit
    p.handPhrases = ph.map(P => [+P.a.toFixed(2), +P.b.toFixed(2), P.ids.map(i => W[i][2]).join(" "), +P.pri.toFixed(2), !!P.on, P.mood]);
    const fam = k => GEST[k] && (GEST[k].art === 'palm up' || k === 'shrug' || k === 'offer' || k === 'other') ? 'palm' : k === 'here' || k === 'point' ? 'point' : k;   // a shrug and an offered palm count as the same move
    const lastT = {}, bigGap = BIG_GAP[cfg.hands] || 6; let lastBig = null, lastStroke = -99, n = 0;
    units.forEach(u => {
      const first = u.ph[0], i0 = first.ids.find(i => pk[i].v >= Math.max(first.med, medAll * 0.9)), start = Math.max(0, pk[i0 != null ? i0 : first.ids[0]].t - 0.45);
      let end = Math.min(dur, u.b + 0.45);
      const fx = fixed.find(q => q.a > start && q.a < end); if (fx) end = Math.max(start + 0.6, fx.a);   // stop where a tag takes over
      const hot = u.ph.some(P => P.mood === 'rage' || P.mood === 'furious' || P.mood === 'angry'), side = hot && u.ph.some(P => P.ex) && R() < 0.5 ? 'both' : 'L';
      if (end - start < 0.6 || clash(start, end, side)) return;
      const k4 = n++ % 5, base = cfg.hands === 'animated' && k4 === 2 ? 'talk' : 'desk';   // his hand on the desk, working away; the raised talking hand only now and then when he is animated
      const unit = { id: 'u' + Math.round(start * 100), k: base, kind: 'gesture', side: GEST[base].side === 'both' ? 'both' : side, start, end, at: start + 0.45, amp: 1, auto: true, plan: true, pri: 1, tag: GEST[base].label }; moves.push(unit);
      // a bigger gesture for each thought in the unit that calls for one: on its word's stressed syllable, never the same one twice running, not on top of each other
      u.ph.forEach(P => { const best = P.cand.find(c => fam(c.k) !== lastBig && pk[c.i].t - (lastT[fam(c.k)] != null ? lastT[fam(c.k)] : -99) >= 8); if (!best) return;
        const G = GEST[best.k], at = pk[best.i].t; if (at - lastStroke < (G.art || G.bang ? bigGap : 1.5)) return;
        const s0 = Math.max(start, at - (G.prep || 0.45)), holdTo = G.hold ? Math.min(P.b + 0.15, at + 2.2) : at + G.len * 0.5, e0 = Math.min(Math.max(holdTo, s0 + 0.9) + 0.4, dur), sd = G.side === 'both' ? 'both' : 'L';
        if (e0 - s0 < 0.7 || fixed.some(q => s0 < q.b && e0 > q.a && meets(q.side, sd))) return;
        moves.push({ id: 'g' + Math.round(s0 * 100) + best.k.replace(/\W/g, ''), k: best.k, kind: 'gesture', side: sd, start: s0, end: e0, at, amp: cl(0.8 + (pk[best.i].v - 0.5) * 0.4 + ((P.ar || 0.4) - 0.4) * 0.4, 0.7, 1.1), auto: true, plan: true, pri: G.bang || G.wag || G.shake ? 12 : 5, tag: G.label + (best.why && best.why.length > 1 && !G.label.toLowerCase().includes(best.why) ? ' (' + best.why + ')' : '') });
        if (TALKING[G.art] && !unit.art) unit.art = G.art;   // one talking hand for the whole thought: his relaxed and open hands are close cousins, and a swap between them in mid air reads as a glitch
        lastBig = fam(best.k); lastT[lastBig] = at; lastStroke = at; });
    });
  }
  /* The head and eyebrows beyond the nods: shakes with no, never, nothing (and smaller ones with all, every, really:
     McClave 2000), a tilt and the brows through a question or a doubt, quick brow raises on the strongest accents
     (about one accent in three: Krahmer and Swerts 2007), and a shift of weight when a new thought starts after a
     pause (Cassell and others 2001). */
  function planHead(cfg, A, p, moves, R, dur) {
    const pros = p.pros, sem = p.sem, W = (A && A.words) || [], shakes = [], tilts = [], raises = [], shifts = [];
    p.shakes = shakes; p.tilts = tilts; p.raises = raises; p.shifts = shifts; if (!pros) return;
    const U = pros.units, byWord = U.length === W.length;
    const busy = (a, b) => moves.some(m => (m.kind === 'look' || m.kind === 'pose' || m.kind === 'burst') && a < (m.end != null ? m.end : m.start + 2) && b > m.start);
    if (sem && byWord) W.forEach((w, i) => { const c = sem.cls[i], u = U[i], neg = c.includes('neg'), tot = c.includes('all') || c.includes('intens');
      if (!(neg && u.prom >= 0.28) && !(tot && u.prom >= 0.62)) return; if (shakes.length && u.t - shakes[shakes.length - 1].b < 2.2) return;
      const n = neg ? 3 : 2, a = Math.max(0, u.t - 0.2), b = a + n * 0.27 + 0.12; if (busy(a, b)) return; shakes.push({ a, b, n, amp: (neg ? 1 : 0.6) * (0.7 + 0.6 * u.prom), s: R() < 0.5 ? -1 : 1, why: w[4] }); });
    if (sem && byWord) sem.sents.forEach(S => { const last = pros.ips.filter(P => P.u[0] >= S.a && P.u[P.u.length - 1] <= S.b).pop(); if (!last) return;
      if (S.q) { const t0 = Math.min(U[last.peak].t, last.b - 0.45) - 0.15; tilts.push({ a: t0, b: last.b + 0.35, r: (R() < 0.5 ? -1 : 1) * 0.045, y: -0.006 }); raises.push({ a: t0, b: last.b + 0.3, v: S.wh ? -0.2 : 0.42 }); }
      else if (S.doubt) { const j = (() => { for (let k = S.a; k <= S.b; k++) if (sem.cls[k].includes('doubt')) return k; return S.a; })(); tilts.push({ a: W[j][0] - 0.2, b: W[j][1] + 0.7, r: (R() < 0.5 ? -1 : 1) * 0.04, y: 0 }); raises.push({ a: W[j][0] - 0.15, b: W[j][1] + 0.5, v: 0.35, one: R() < 0.5 ? 'L' : 'R' }); } });
    pros.accents.forEach(ac => { if (ac.s < 0.62 || raises.some(r => ac.t > r.a - 0.75 && ac.t < r.b + 0.75)) return; const u = byWord && ac.w >= 0 ? U[ac.w] : null; raises.push({ a: ac.t - 0.18, b: (u ? u.b : ac.t + 0.2) + 0.06, v: 0.16 + 0.3 * (ac.s - 0.62) / 0.38 }); });
    raises.sort((x, y) => x.a - y.a);
    let pos = 0; pros.ips.forEach((P, i) => { const prev = pros.ips[i - 1]; if (!prev || !prev.sent || prev.gap < 0.55 || P.b - P.a < 1.2 || P.a < 2) return; if (shifts.length && P.a - shifts[shifts.length - 1].t < 6) return; let nx = pos; while (nx === pos) nx = [-1, 0, 1][Math.floor(R() * 3)]; shifts.push({ t: P.a - 0.5, from: pos, x: nx }); pos = nx; });
  }
  /* The eyes: where he looks and when he blinks. */
  function planEyes(cfg, A, p, moves, R, dur) {
    const pros = p.pros, sem = p.sem, gl = [], bias = R() < 0.5 ? -1 : 1, ips = pros && pros.ips.length ? pros.ips : p.phrases.map((q, i, a) => ({ a: q.a, b: q.b, u: [], sent: true, gap: a[i + 1] ? a[i + 1].a - q.b : 9 }));
    ips.forEach((P, i) => { const prev = ips[i - 1], gap = prev ? P.a - prev.b : P.a, think = !!sem && P.u.slice(0, 3).some(j => sem.cls[j] && sem.cls[j].includes('think'));
      // away while he finds the start of the thought, back on the camera by its first stress
      if (gap >= 0.45 && P.b - P.a >= 1.6 && R() < (think ? 0.75 : 0.36)) { const ac = pros ? pros.accents.find(q => q.t > P.a + 0.1) : null, b = Math.min(ac ? ac.t - 0.05 : P.a + 0.5, P.a + 0.75), a = Math.max(prev ? prev.b + 0.1 : 0, P.a - 0.3 - R() * 0.25); if (b - a > 0.3) gl.push({ a, b, x: (R() < 0.72 ? bias : -bias) * (0.55 + R() * 0.4), y: R() < 0.3 ? -0.5 : R() < 0.15 ? 0.4 : (R() - 0.5) * 0.3 }); }
      else if (gap > 0.9 && prev && R() < 0.5) { const s = prev.b + 0.15 + R() * 0.2; gl.push({ a: s, b: Math.min(P.a - 0.1, s + 0.45 + R() * 0.6), x: (R() < 0.5 ? -1 : 1) * (0.6 + R() * 0.4), y: (R() - 0.5) * 0.6 }); } });
    moves.forEach(m => { if (m.kind === 'gesture' && m.k === 'point aside' && m.at != null) gl.push({ a: m.at - 0.2, b: m.at + 0.5, x: m.side === 'R' ? -0.85 : 0.85, y: 0 }); });
    for (let t = 1 + R() * 2; t < dur; t += 1.4 + R() * 2.6) gl.push({ a: t, b: t + 0.25 + R() * 0.5, x: (R() - 0.5) * 0.24, y: (R() - 0.5) * 0.14, small: true });   // small darts: eyes are never dead still
    gl.sort((x, y) => x.a - y.a); const glances = []; gl.forEach(g => { const last = glances[glances.length - 1]; if (last && g.a < last.b + 0.12) { if (last.small && !g.small) glances[glances.length - 1] = g; return; } glances.push(g); });
    p.glances = glances;
    // blinks: at the ends of phrases, with looks away and head turns, and never much more than five seconds without one
    const bl = []; ips.forEach(P => { if (R() < (P.sent ? 0.7 : 0.4)) bl.push(P.b + 0.06 + R() * 0.18); });
    glances.forEach(g => { if (g.small) return; if (R() < 0.6) bl.push(g.a + 0.02); if (R() < 0.35) bl.push(g.b + 0.02); });
    moves.filter(m => m.kind === 'look' || m.kind === 'pose').forEach(m => { bl.push(m.start - 0.02); bl.push(m.end - 0.02); });
    bl.sort((a, b) => a - b); const out = []; let t = 0.4 + R();
    const fill = to => { let g = 2.2 + R() * 3.1; while (t + g < to - 0.5) { t += g; out.push(t); if (R() < 0.1) out.push(t + 0.28); g = 2.2 + R() * 3.1; } };
    bl.forEach(b => { if (b < 0.2 || b > dur) return; fill(b); if (b - t < 0.45) return; out.push(b); t = b; }); fill(dur);
    p.blinks = out.sort((a, b) => a - b);
  }
  const easeWin = (t, a, b, i, o) => sm((t - a) / i) * (1 - sm((t - b) / o));
  const wave = (t, s, f) => Math.sin(t * f + s) * 0.6 + Math.sin(t * f * 2.31 + s * 1.7) * 0.3 + Math.sin(t * f * 0.43 + s * 0.6) * 0.5;

  /* Where everything is aiming at time t (the plan itself, before the springs). pose.fast holds the quick shakes
     (rage, laughing, a wagging finger) that are added after the springs so they are not smoothed away. */
  function targetAt(cfg, A, rig, p, t) {
    const hh = rig.pivot.headH, E = p.E, ix = p.ix, pose = { mouth: 'Neutral', blink: 0, swaps: {}, brow: { L: [0, 0, 0], R: [0, 0, 0] }, head: [0, 0, 0, 0], body: [0], sit: [0, 0, 1], arms: {}, pupil: [0, 0], view: 'front', dangle: 0, fast: { h: [0, 0, 0], L: [0, 0, 0], R: [0, 0, 0], b: 0 } };
    const near = ix.moves(t), F = pose.fast;
    // emotions, blended
    let em = { L: [0, 0, 0], R: [0, 0, 0], dy: 0, rot: 0, lean: 0, gain: 1, shake: 0, flush: 0, laugh: 0 }; const base = EMO[cfg.mood] || EMO.calm, mix = [[base, 1]];
    near.forEach(m => { if ((m.kind !== 'emotion' && m.kind !== 'burst') || t < m.start - 0.3 || t > m.end + 0.4) return; const w = m.kind === 'burst' ? 3 * easeWin(t, m.start - 0.1, m.end - 0.3, 0.25, 0.35) : easeWin(t, m.start - 0.2, m.end, 0.42, 0.42); if (w > 0) mix.push([EMO[m.k], w]); });   // a burst outweighs the mood under it
    { let sw0 = 0; for (let i = 1; i < mix.length; i++) sw0 += mix[i][1]; mix[0][1] = Math.max(0, 1 - sw0); const tot = mix.reduce((a2, q) => a2 + q[1], 0) || 1; em.gain = 0;
      mix.forEach(([q, w0]) => { const w = w0 / tot; ['L', 'R'].forEach(sd => { for (let j = 0; j < 3; j++) em[sd][j] += q[sd][j] * w; }); em.dy += q.dy * w; em.rot += q.rot * w; em.lean += q.lean * w; em.gain += q.gain * w; em.shake += q.shake * w; em.flush += (q.flush || 0) * w; em.laugh += (q.laugh || 0) * w; }); }
    const G = E * em.gain, L = p.loud(t);
    // mouth
    if (A && A.visemes.length) { let lo = 0, hi = A.visemes.length - 1; if (t >= A.visemes[0][0]) { while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (A.visemes[mid][0] <= t) lo = mid; else hi = mid - 1; } pose.mouth = A.visemes[lo][1]; } if (pose.mouth === 'Aa' && !A.guessed && L < 0.2 && rig.visemes && rig.visemes.Uh != null) pose.mouth = 'Uh'; }   // said quietly, the mouth does not open as far
    // the head: a slow drift, a tilt that changes with each phrase, nods on the accents, riding on the pitch of his voice, forward when loud
    const s = p.seeds; let hx = wave(t, s[0], 0.55) * 0.010 * hh * (0.6 + 0.4 * E), hy = wave(t, s[1], 0.7) * 0.006 * hh, hr = wave(t, s[2], 0.45) * 0.008 * (0.6 + 0.4 * E);
    ix.phr(t).forEach(ph => { const w = easeWin(t, ph.a - 0.25, ph.b + 0.2, 0.45, 0.6); if (w > 0) { hr += ph.tilt * w * G; hx += ph.x * hh * w * G * 0.5; hy += ph.y * hh * w; } });
    for (const n of ix.nods(t)) { const u = (t - n.t + 0.14) / 0.34; if (u <= 0 || u >= 1) continue; const k = Math.sin(Math.PI * u) * n.a * G; hy += k * 0.03 * hh; hr += k * 0.012 * n.s; }   // down on the stressed syllable
    hy -= p.f0n(t) * 0.011 * hh * Math.min(1.3, G) * sm(L / 0.25);
    for (const q of ix.shakes(t)) { const u = (t - q.a) / (q.b - q.a); if (u <= 0 || u >= 1) continue; const k = Math.sin(Math.PI * q.n * u) * Math.pow(Math.sin(Math.PI * u), 0.6) * q.amp * q.s * Math.min(1.4, G); hx += k * 0.02 * hh; hr += k * 0.014; }
    for (const q of ix.tilts(t)) { const w = easeWin(t, q.a, q.b, 0.3, 0.4); if (w > 0) { hr += q.r * w * Math.min(1.4, G); hy += q.y * hh * w; } }
    hy += em.dy * hh; hr += em.rot; const lean = (L * 0.025 + em.lean) * G;
    if (em.shake > 0.01) { F.h[0] += Math.sin(t * 61) * 0.004 * hh * em.shake * (0.4 + L); F.h[1] += Math.sin(t * 47 + 1) * 0.003 * hh * em.shake * (0.4 + L); }
    // a shift of weight at a new thought: the whole of him moves over a little, the head stays level
    let sx = 0; { const S = p.shifts; let k = -1; for (let i = 0; i < S.length; i++) { if (S[i].t <= t) k = i; else break; } if (k >= 0) { const q = S[k], w = sm((t - q.t) / 0.9); sx = q.from + (q.x - q.from) * w; } }
    pose.sit = [sx * 0.013 * hh, sx * 0.007, 1]; hr -= sx * 0.006;
    pose.head = [hx, hy, hr, lean];
    // eyebrows: the emotion, a quick raise on the strongest accents, up through a question (down for a why or a what)
    let lift = 0, liftL = 0, liftR = 0; const damp = 1 - 0.6 * cl((em.L[1] - 0.1) / 0.2, 0, 1);
    if (p.pros) { for (const q of ix.raises(t)) { const w = easeWin(t, q.a, q.b, 0.17, 0.28); if (w <= 0) continue; const v = -q.v * w * Math.min(1.3, 0.6 + 0.4 * G) * (q.v > 0 ? damp : 1); if (q.one === 'L') liftL += v; else if (q.one === 'R') liftR += v; else lift += v; } lift += -sm(cl((p.slow(t) - 0.4) / 0.45, 0, 1)) * 0.1 * Math.min(1.4, G) * damp; }
    else lift = -sm(cl((p.slow(t) - 0.3) / 0.45, 0, 1)) * 0.3 * Math.min(1.4, G) * damp;
    pose.brow.L = [em.L[0], em.L[1] + lift + liftL, em.L[2]]; pose.brow.R = [em.R[0], em.R[1] + (lift + liftR) * 1.08, em.R[2]];
    // blinks (shut for about a tenth of a second)
    for (const b of ix.blinks(t)) { if (t >= b && t - b < 0.115) { pose.blink = 1; break; } }
    // eyes: on the camera; away while he finds a thought, small darts between
    for (const g of ix.glances(t)) { const w = easeWin(t, g.a, g.b, 0.07, 0.09); if (w > 0) { pose.pupil = [g.x * w, g.y * w]; break; } }
    // breathing, deeper before each phrase
    let br = Math.sin(t * 2 * Math.PI / 3.9 + s[3]) * 0.0035; ix.phr(t).forEach(ph => { const u = (t - (ph.a - 0.45)) / 0.45; if (u > 0 && u < 1) br += Math.sin(Math.PI * u) * 0.006; }); pose.body = [br];
    // moves: looks (head turns), hands, poses, costumes
    const sw = pose.swaps, apply = (k, side) => (rig.triggers[k] || []).forEach(([id, i]) => { if (side && side !== 'both' && isHand(rig, id)) { const sd = sideOf(rig, id); if (sd && sd !== side) return; } sw[id] = i; });
    if (cfg.costume && rig.triggers[cfg.costume]) apply(cfg.costume);
    for (const m of near) {
      if (t < m.start || t >= m.end) continue;
      if (m.kind === 'look') { pose.view = LOOKS[m.k]; }
      else if (m.kind === 'costume') { if (m.off) (rig.triggers[m.k] || []).forEach(([id]) => { delete sw[id]; }); else apply(m.k); }
      else if (m.kind === 'pose') apply(m.k);
    }
    // hands: every gesture in play pulls the wrist towards its place; they blend, so one runs into the next
    const want = { L: [], R: [] }, hh2 = hh;
    for (const m of near) {
      if (m.kind !== 'gesture' || t < m.start - 0.2 || t >= m.end) continue;
      let Gs = GEST[m.k] || { art: m.k, at: [0, -0.22, 0], side: m.side }; if (Gs.art && !rig.triggers[Gs.art]) { if (!Gs.old) continue; Gs = Object.assign({}, Gs, Gs.old); }   // his own drawings when loaded, else the old ones
      else if (m.art && TALKING[Gs.art] && rig.triggers[m.art]) Gs = Object.assign({}, Gs, { art: m.art });   // the unit's talking hand matches the bigger gesture inside it
      const at = m.at != null ? m.at : m.start + 0.45, prep = cl(at - m.start, 0.25, 0.6), u = t - m.start, us = t - at, amp = m.amp || 1, big = (m.pri || 2) >= 5;
      const w = t < m.start ? 0 : easeWin(t, m.start, m.end - 0.4, prep, 0.4), sides = m.side === 'both' ? ['L', 'R'] : [m.side || 'L'];
      sides.forEach(sd => { const mir = sd === 'R' ? -1 : 1; let [ax, ay, ar] = Gs.at; ay *= amp; let fx = 0, fy = 0, fr = 0, antic = 0;
        if (big && !Gs.bang) antic = Math.sin(Math.PI * cl((t - (m.start - 0.16)) / 0.3, 0, 1)) * 0.014;   // a small dip before it lifts: the wind up
        if (Gs.wag) fr += Math.sin(u * (Gs.wagHz || 14)) * Gs.wag * sm((u - 0.2) / 0.25);
        if (Gs.shake) { const on = sm((u - 0.3) / 0.2); fx += Math.sin(u * 27) * 0.014 * on; fy += Math.sin(u * 31 + 1) * 0.016 * on; }
        if (Gs.bang) { const v = u - 0.12; ay = v < 0.24 ? -0.17 * sm(v / 0.24) : v < 0.34 ? -0.17 * (1 - sm((v - 0.24) / 0.1)) : 0; if (v > 0.32 && v < 0.56) pose.head[1] += Math.sin((v - 0.32) / 0.24 * Math.PI) * 0.016 * hh2; }
        if (Gs.sweep) ax += Gs.sweep * amp * (sm((us + 0.2) / 0.36) - 0.5);                           // across, through the stressed syllable
        if (Gs.tap) ay -= Gs.tap * (us < -0.16 ? sm((us + 0.5) / 0.3) : us < 0 ? 1 - sm((us + 0.16) / 0.16) : 0);   // up first, then down onto the desk on the word
        if (Gs.wob) ar += Math.sin(us * 9) * Gs.wob * easeWin(t, at - 0.15, at + 0.9, 0.15, 0.4);
        if (Gs.sway) { ay += Math.sin(t * 3.1 + 1) * 0.012; ar += Math.sin(t * 2.3) * 0.07; }
        if (Gs.drift) { ax += Math.sin(t * 0.83 + 2) * 0.012; ay += Math.sin(t * 1.7) * 0.006; ar += Math.sin(t * 1.1 + 1) * 0.035; }   // a hand resting while he talks is never quite still
        if (!Gs.bang && !Gs.wag && !Gs.tap) for (const n of ix.nods(t)) { if (n.t < m.start + 0.25 || (m.at != null && Math.abs(n.t - m.at) < 0.2 && big)) continue; const q = (t - n.t + 0.13) / 0.3; if (q > 0 && q < 1) { const k = Math.sin(Math.PI * q) * n.a * (Gs.bt || 1); ay += 0.034 * k; ar += 0.08 * k; } }   // a beat on each accent
        want[sd].push({ w, pri: m.pri || 2, dx: ax * hh2 * mir, dy: (ay + antic * (1 - w)) * hh2, rot: ar * mir, art: Gs.art, th: Gs.late || 0.3, fy: Gs.fy || 0, fxp: Gs.fx || 0, sc: Gs.sc || 1, plain: Gs.plain || 0, f: [fx * hh2 * mir * w, fy * hh2 * w, fr * mir * w], an: antic * hh2 }); });
    }
    ['L', 'R'].forEach(sd => { const L2 = want[sd], rest = { dx: -pose.sit[0], dy: 0, rot: 0, fy: 0, sc: 1, plain: 0, hide: false, art: '' }; if (!L2.length) { pose.arms[sd] = rest; return; } let tw = 0, mx = 0, dx = 0, dy = 0, rot = 0, best = null, an = 0; L2.forEach(q => { q.ww = q.w; L2.forEach(o => { if (o.pri > q.pri) q.ww *= 1 - o.w; }); });   // a bigger gesture takes over from the talking hand as it comes in
      let pl = 0; L2.forEach(q => { tw += q.ww; mx = Math.max(mx, q.w); dx += q.dx * q.ww; dy += q.dy * q.ww; rot += q.rot * q.ww; pl += q.plain * q.ww; an = Math.max(an, q.an); F[sd][0] += q.f[0]; F[sd][1] += q.f[1]; F[sd][2] += q.f[2]; if (!best || q.ww > best.ww) best = q; });
      if (tw <= 0) { rest.dy = an; pose.arms[sd] = rest; return; } const on = best.art && mx > 0.3 && best.w > best.th;   // some drawings only make sense once the hand is up (a finger pointing down would go through the desk)
      // the turn belongs to the drawing showing: his desk hands and his talking hands are drawn at different angles, so a turn blended across two of them would spin the wrong one
      let rw = 0, rr = 0; L2.forEach(q => { if ((q.art || null) === (best.art || null)) { rw += q.ww; rr += q.rot * q.ww; } });
      pose.arms[sd] = { dx: dx / tw * mx - pose.sit[0] * (1 - mx), dy: dy / tw * mx + an * (1 - mx), rot: (rw > 0 ? rr / rw : 0) * mx, fy: on ? best.fy : 0, fx: on ? best.fxp : 0, sc: on ? 1 + (best.sc - 1) * Math.min(1, (mx - 0.3) / 0.4) : 1, plain: pl / tw * cl(mx / 0.5, 0, 1), hide: best.art === '-hide' && mx > 0.3, art: on && best.art !== '-hide' ? best.art : '' }; });   // the plain inside of the sleeve as the forearm turns over
    // a laugh: head back, eyes screwed shut, mouth wide open on every ha, shoulders bouncing
    const lw = cl(em.laugh, 0, 1);
    if (lw > 0.03) {
      const hz = 4.6, env = A && !A.guessed && A.env ? (() => { const f = t * A.fps, i = Math.floor(f); return i >= 0 && i < A.env.length ? A.env[i] : 0; })() : 0, voiced = env > 0.2;
      const ha = voiced ? cl((env - 0.2) / 0.5, 0, 1) : 0.5 + 0.5 * Math.sin(2 * Math.PI * hz * t), bob = Math.abs(Math.sin(Math.PI * hz * t));
      if (lw > 0.4) { pose.mouth = ha > 0.45 ? 'Aa' : 'Uh'; pose.blink = 1; }
      if (lw > 0.72 && rig.views.up != null) pose.view = 'up';
      F.h[1] += -bob * 0.022 * hh * lw; F.h[2] += Math.sin(Math.PI * hz * t * 0.5) * 0.02 * lw; F.b += bob * 0.009 * lw;
      F.L[1] += -bob * 0.014 * hh * lw; F.R[1] += -bob * 0.014 * hh * lw;
    }
    // rage: red in the face (pulsing with the shouting), teeth gritted when he is not talking
    const fw = cl(em.flush, 0, 1);
    if (fw > 0.02) { pose.flush = fw * (0.8 + 0.2 * Math.sin(t * 5.3)) * (0.85 + 0.3 * cl(L, 0, 1)); if (pose.mouth === 'Neutral' && fw > 0.5) pose.mouth = 'S'; }
    // the hoodie strings swing a little with the head
    pose.dangle = (wave(t, s[0], 0.55) - wave(t - 0.2, s[0], 0.55)) * 0.15 * E + hr * 0.4;
    return pose;
  }
  /* The plan played through springs, worked out once at 60 a second: a move overshoots a touch and settles, the hand's
     turn trails its travel, nothing starts or stops dead (minimum jerk like movement: Flash and Hogan 1985). Each
     channel is then slid back by its spring's delay, so a stroke still lands on its syllable. */
  const SPR = { hx: [17, 0.8], hy: [19, 0.72], hr: [16, 0.74], hl: [12, 0.9], sx: [7, 0.9], sr: [7, 0.9], bLy: [22, 0.68], bRy: [22, 0.68], bLr: [26, 0.7], bRr: [26, 0.7], bLx: [26, 0.8], bRx: [26, 0.8], aLx: [20, 0.66], aLy: [22, 0.62], aLr: [14, 0.55], aRx: [20, 0.66], aRy: [22, 0.62], aRr: [14, 0.55] };
  const BF = 60;
  function bake(cfg, A, rig, p, dur) {
    const n = Math.ceil((dur + 2) * BF) + 2, raw = {}, arts = { L: new Array(n), R: new Array(n) }; Object.keys(SPR).forEach(k => { raw[k] = new Float32Array(n); });
    for (let i = 0; i < n; i++) { const q = targetAt(cfg, A, rig, p, i / BF);
      raw.hx[i] = q.head[0]; raw.hy[i] = q.head[1]; raw.hr[i] = q.head[2]; raw.hl[i] = q.head[3]; raw.sx[i] = q.sit[0]; raw.sr[i] = q.sit[1];
      ['L', 'R'].forEach(sd => { raw['b' + sd + 'x'][i] = q.brow[sd][0]; raw['b' + sd + 'y'][i] = q.brow[sd][1]; raw['b' + sd + 'r'][i] = q.brow[sd][2]; const a = q.arms[sd]; raw['a' + sd + 'x'][i] = a.dx; raw['a' + sd + 'y'][i] = a.dy; raw['a' + sd + 'r'][i] = a.rot; arts[sd][i] = a.hide ? '-hide' : a.art || ''; }); }
    // which hand drawing shows, frame by frame: one that would show for under a fifth of a second is skipped (the one before it stays), so a hand never flickers
    const art = {}; ['L', 'R'].forEach(sd => { const a = arts[sd]; let i = 0; while (i < n) { let j = i; while (j < n && a[j] === a[i]) j++; if (i > 0 && j < n && j - i < BF * 0.2) { for (let k = i; k < j; k++) a[k] = a[i - 1]; } i = j; } art[sd] = a; });
    const out = {}; Object.keys(SPR).forEach(k => { const [w, z] = SPR[k], src = raw[k], y = new Float32Array(n), sub = 4, h = 1 / BF / sub, cut = /^a[LR]r$/.test(k) ? art[k[1]] : null, lag = Math.round(2 * z / w * BF), o = new Float32Array(n); let x = src[0], v = 0, s0 = 0;
      for (let i = 0; i < n; i++) { const tg = src[i]; if (cut && i > 0 && cut[i] !== cut[i - 1]) { for (let q = s0; q < i; q++) o[q] = y[Math.min(i - 1, q + lag)]; s0 = i; x = tg; v = 0; }   // a new drawing starts at its own turn: nothing carries over from the last one
        for (let s2 = 0; s2 < sub; s2++) { v += (w * w * (tg - x) - 2 * z * w * v) * h; x += v * h; } y[i] = x; }
      for (let q = s0; q < n; q++) o[q] = y[Math.min(n - 1, q + lag)]; out[k] = o; });
    // the hand's turn follows its travel a little: it drags behind as the arm swings and catches up
    ['L', 'R'].forEach(sd => { const y = out['a' + sd + 'y'], r = out['a' + sd + 'r'], hh = rig.pivot.headH, mir = sd === 'R' ? -1 : 1; let drag = 0; for (let i = 1; i < n; i++) { const vy = (y[i] - y[i - 1]) * BF / hh; drag += (cl(vy * 0.16, -0.14, 0.14) - drag) * 0.3; r[i] += drag * mir; } });
    p.bk = { n, ch: out, art };
  }
  const bk = (p, k, t) => { const a = p.bk.ch[k], f = t * BF, i = Math.floor(f); return i < 0 ? a[0] : i >= a.length - 1 ? a[a.length - 1] : a[i] + (a[i + 1] - a[i]) * (f - i); };
  function poseAt(cfg, A, rig, p, t) {
    const q = targetAt(cfg, A, rig, p, t), F = q.fast, hh = rig.pivot.headH;
    if (p.bk) {
      q.head = [bk(p, 'hx', t), bk(p, 'hy', t), bk(p, 'hr', t), bk(p, 'hl', t)]; q.sit = [bk(p, 'sx', t), bk(p, 'sr', t), 1];
      ['L', 'R'].forEach(sd => { q.brow[sd] = [bk(p, 'b' + sd + 'x', t), bk(p, 'b' + sd + 'y', t), bk(p, 'b' + sd + 'r', t)]; const a = q.arms[sd]; a.dx = bk(p, 'a' + sd + 'x', t); a.dy = Math.min(0.012 * hh, bk(p, 'a' + sd + 'y', t));   // the desk is solid: a hand never goes through it
        const T = p.bk.art[sd], i = Math.max(0, Math.min(T.length - 1, Math.floor(t * BF + 1e-6))), k = T[i]; a.rot = i + 1 < T.length && T[i + 1] !== k ? p.bk.ch['a' + sd + 'r'][i] : bk(p, 'a' + sd + 'r', t); a.art = k === '-hide' ? '' : k; a.hide = k === '-hide'; if (!a.art) { a.fy = 0; a.fx = 0; } });
      q.dangle += (bk(p, 'hx', t) - bk(p, 'hx', t - 0.14)) / hh * 6 + (bk(p, 'sx', t) - bk(p, 'sx', t - 0.2)) / hh * 8;   // the strings swing behind the head
    }
    q.head[0] += F.h[0]; q.head[1] += F.h[1]; q.head[2] += F.h[2]; q.body[0] += F.b;
    ['L', 'R'].forEach(sd => { const a = q.arms[sd]; a.dx += F[sd][0]; a.dy += F[sd][1]; a.rot += F[sd][2]; if (a.art) handArt(rig, q.swaps, a.art, sd); });
    return q;
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
  const defaults = () => ({ v: 1, puppet: '', voice: '', voiceName: '', script: "[calm] Right. Here's the thing nobody wanted to hear. [angry] They've only gone and shut the chippy! [point] You heard me.", moves: [], mood: 'calm', energy: 1, costume: '', frame: 'desk', hands: 'natural', zoom: 1, dx: 0, dy: 0, bg: 'colour', fill: '#4a5063', len: 6, pace: 1, seed: 0, vol: 0 });
  function duration(cfg) {
    if (cfg.voice && (typeof CutMedia !== 'undefined' || durHint[cfg.voice])) { const m = (typeof CutMedia !== 'undefined' && CutMedia.info(cfg.voice)) || durHint[cfg.voice]; if (m && m.dur) return Math.max(0.5, m.dur + 0.3); }
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
    root.append(card('Your character', field('Puppet', pupSel), H('div', { className: 'btnrow' }, btn(rig ? 'Load another puppet' : 'Load my puppet', () => pick.click(), rig ? '' : 'primary'), typeof PrivateArt !== 'undefined' && PrivateArt.state === 'waiting' && Character.unlockArt ? btn('Unlock the one Claude sent', () => Character.unlockArt(), 'primary') : ''), pick, note,
      rig ? H('p', { className: 'hint', textContent: `${rig.visemes.length} mouth shapes, ${Object.keys(rig.views).length} head turns, and ${Object.keys(rig.triggers).map(k => FRIENDLY[k] || k).join(', ') || 'no swaps'}. It stays on this computer.` }) : H('p', { className: 'hint', textContent: 'Use the .puppet file from Character Animator (File, Export, Puppet), or the Photoshop .psd behind it. It is kept in this browser and never uploaded.' })));
    // his own talking hands: a picture of drawings on green (HandSheet), kept with the puppet
    if (rig) {
      const hpick = H('input', { type: 'file', accept: 'image/*' }); hpick.style.display = 'none'; const hnote = H('p', { className: 'hint', 'aria-live': 'polite' });
      hpick.addEventListener('change', async () => { const f = hpick.files && hpick.files[0]; if (!f) return; hnote.textContent = 'Cutting out your hands…'; try { await Puppet.setHands(rig.id, f, null); redo(); } catch (e) { hnote.textContent = e.message || String(e); } });
      const sh = rig.sheet, kids = [];
      if (sh && sh.pieces.length) { const roles = sh.roles.map(r => r.slice());
        sh.pieces.forEach((pc, i) => { const cv = H('canvas', { width: 72, height: 72, className: 'ch-hand' }), g = cv.getContext('2d'), tmp = new OffscreenCanvas(pc.w, pc.h); tmp.getContext('2d').putImageData(pc.data, 0, 0); const k = Math.min(72 / pc.w, 72 / pc.h); g.drawImage(tmp, (72 - pc.w * k) / 2, (72 - pc.h * k) / 2, pc.w * k, pc.h * k);
          const opts = HandSheet.ROLES.flatMap(([v, l]) => v === '' ? [[v + '|both', l]] : [[v + '|L', l + ', his left'], [v + '|R', l + ', his right']]);
          kids.push(H('div', { className: 'ch-handrow' }, cv, sel((roles[i][0] || '') + '|' + (!roles[i][0] ? 'both' : roles[i][1]), opts, v => { const [r, sd] = v.split('|'); roles[i] = [r, sd]; Puppet.setHands(rig.id, null, roles).then(() => redo()); }, 'What this hand is'))); }); }
      root.append(card('Your talking hands', ...kids, H('div', { className: 'btnrow' }, btn(sh ? 'Load another sheet' : 'Load my hand drawings', () => hpick.click(), sh ? '' : 'primary'), sh ? btn('Take them out', () => Puppet.setHands(rig.id, null, null).then(() => redo())) : null), hpick, hnote,
        H('p', { className: 'hint', textContent: sh ? 'Matched to his own hands in size and colour. He uses them for talking, explaining, palms up, and pointing at you; without them he uses his puppet\u2019s hands.' : 'A picture of your hand drawings on green (each with a bit of sleeve). They are cut out, matched to his hands in size and colour, and kept on this computer with the puppet.' })));
    }
    // the voice
    const vpick = H('input', { type: 'file', accept: 'audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm' }); vpick.style.display = 'none'; const vnote = H('p', { className: 'hint', 'aria-live': 'polite' });
    vpick.addEventListener('change', async () => { const f = vpick.files && vpick.files[0]; if (!f || typeof CutMedia === 'undefined') return; vnote.textContent = 'Bringing in ' + f.name + '…'; try { const m = await CutMedia.importFile(f, (q) => { vnote.textContent = 'Bringing in ' + f.name + '… ' + Math.round(q * 100) + '%'; }); cfg.voice = m.id; cfg.voiceName = f.name; if (canHear() && scriptIsBlank()) { redo(); hear(); } else redo(); } catch (e) { vnote.textContent = e.message || String(e); } });
    // the words from the recording itself (Listen), or from a PatterScript file
    const canHear = () => typeof Listen !== 'undefined' && Listen.state === 'ready', scriptIsBlank = () => !String(cfg.script || '').trim() || cfg.script === defaults().script;
    const hear = async () => { if (hearing[cfg.voice]) return; const id = cfg.voice, say = t => { hearing[id] = t; const el = document.getElementById('chHear'); if (el) { el.textContent = t; el.disabled = true; } };
      try { if (Listen.state !== 'ready' && (await Listen.check()) !== 'ready') { say('Getting the listening helper…'); await Listen.download(q => say('Getting the listening helper… ' + Math.round(q * 100) + '%')); }
        say('Listening…'); const text = await Listen.forMedia(id, { onProgress: q => say('Listening… ' + Math.round(q * 100) + '%') }); delete hearing[id]; if (text && cfg.voice === id) { cfg.script = text; } heardNote = text ? '' : 'It heard no words in that recording.'; redo(); }
      catch (e) { delete hearing[id]; heardNote = e.message || String(e); redo(); } };
    const spick = H('input', { type: 'file', accept: '.txt,.md,text/plain' }); spick.style.display = 'none';
    spick.addEventListener('change', async () => { const f = spick.files && spick.files[0]; if (!f) return; const t = fromPatterScript(await f.text()); if (t) { cfg.script = t; heardNote = ''; redo(); } else { heardNote = 'No script found in that file.'; redo(); } });
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
    const hBusy = cfg.voice && hearing[cfg.voice], hasL = typeof Listen !== 'undefined';
    root.append(card('Script', area(cfg.script || '', v => { cfg.script = v; clearTimeout(tmr); tmr = setTimeout(() => changed(), 250); }, 'What you say. Add a recording and it can write this for you; [tags] are optional', 7, 'Script'),
      H('div', { className: 'btnrow' }, cfg.voice && hasL ? (() => { const b0 = btn(hBusy || (canHear() ? 'Write the words from the recording' : 'Write the words from the recording (180 MB download, once)'), e => { if (!scriptIsBlank() && !confirm('Replace the script with what it hears in the recording?')) return; hear(); }, scriptIsBlank() ? 'primary' : ''); b0.id = 'chHear'; if (hBusy) b0.disabled = true; return b0; })() : null, btn('Load a PatterScript file', () => spick.click())), spick,
      heardNote ? H('p', { className: 'hint', 'aria-live': 'polite', textContent: heardNote }) : '',
      H('p', { className: 'hint', textContent: cfg.voice && hasL ? 'It listens to the recording on this computer and writes down what you said, so his hands, head and face follow your words. Fix any word it misheard. No tags are needed: he picks his own gestures and moods; a tag overrides him at that point.' : 'With a recording he can write this himself. No tags are needed: he picks his own gestures and moods from what is said; a tag overrides him at that point.' }),
      H('p', { className: 'hint', textContent: tagHint }),
      A && A.words && A.words.length && !A.guessed ? H('p', { className: 'hint', textContent: A.words.length + ' words lined up with the recording. The words show on the timeline: if one is badly out, check the script matches what you said.' }) : ''));
    // how he looks
    root.append(card('Look',
      field('Mood when nothing else is set', sel(cfg.mood || 'calm', Object.keys(EMO).filter(k => !isBurst(k)).map(k => [k, EMO_NAMES[k]]), v => { cfg.mood = v; changed(); }, 'Mood')),
      field('Hands', seg(cfg.hands === 'tags' ? 'tags' : cfg.hands === 'calm' || cfg.hands === 'animated' ? cfg.hands : 'natural', [['calm', 'Calm'], ['natural', 'Natural'], ['animated', 'Animated'], ['tags', 'Only my tags']], v => { cfg.hands = v; redo(); }), cfg.hands === 'tags' ? 'He keeps his hands on the desk unless a tag says otherwise.' : 'His hands come up for a thought, beat on the words you stress and go down at the pauses, with a gesture chosen by what you are saying (pointing at \u201cyou\u201d, a flat hand on \u201cno\u201d, hands apart on \u201ceverything\u201d, a shrug at \u201cmaybe\u201d, a palm up on a question), landing on the stressed syllable. Calm, Natural and Animated move his hands through about a third, a half and three quarters of the talking, more when he is worked up. Your tags always win.'),
      field('Mood', seg(cfg.autoEmo === false ? 'off' : 'on', [['on', 'From my voice'], ['off', 'Only my tags']], v => { cfg.autoEmo = v !== 'off'; redo(); }), cfg.autoEmo === false ? 'His mood only changes where a tag says so.' : 'When the script has no mood tags, he reads it from how worked up your voice is and what the words are: angry, happy, sad, surprised, doubtful. One mood tag anywhere and he leaves moods to you.'),
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
  const COL = { burst: '#e0603a', emotion: '#b0458f', look: '#3b7dd8', gesture: '#c0703a', pose: '#c81d24', costume: '#2f9a8a' };
  const editor = { formIsScene: true,
    tracks(cfg) { const A = syncOf(cfg), rig = cfg.puppet ? Puppet.get(cfg.puppet) : null, d = duration(cfg), T = [];
      if (A && A.words && A.words.length) T.push({ id: 'words', name: A.guessed ? 'Script' : 'Words', colour: '#3a5f8a', items: A.words.slice(0, 1500).map((w, i) => ({ id: 'W:' + i, start: w[0], end: Math.max(w[0] + 0.05, w[1]), label: w[2], colour: '#2d4a6e', move: false, trim: 'none' })) });
      const p = rig ? perfOf(cfg, A, rig, d) : null, ms = p ? p.moves : [];
      T.push({ id: 'moves', name: 'Moves', colour: '#b0458f', items: ms.map(m => ({ id: m.auto ? 'G:' + m.id : 'M:' + m.id, start: m.start, end: Math.min(d, Math.max(m.start + 0.2, m.end)), label: (m.auto ? '[' + m.tag + ']' : '') + (m.auto ? '' : (EMO_NAMES[m.k] || FRIENDLY[m.k] || m.k)) + (m.off ? ' off' : ''), colour: COL[m.kind] || '#666', move: !m.auto, trim: m.auto ? 'none' : 'both', minLen: 0.2, title: m.auto ? 'From the script: move the tag in the script to change it' : undefined })) });
      return T; },
    update(cfg, id, ch) { const [k, x] = id.split(':'); if (k !== 'M') return; const mv = (Array.isArray(cfg.moves) ? cfg.moves : []).find(q => q.id === x); if (!mv) return; mv.start = r2(Math.max(0, ch.start)); mv.dur = r2(Math.max(0.2, ch.end - ch.start)); },
    adds: [{ label: 'Move', title: 'Make him do something at the playhead: an emotion, a look, a hand gesture, a pose', choices: cfg0 => catalogue(cfg0 && cfg0.puppet ? Puppet.get(cfg0.puppet) : null).map(c => ({ label: c.label, key: c.k })),
      fn(cfg, t, sel2, ch) { const k = (ch && ch.key) || 'angry', rig = cfg.puppet ? Puppet.get(cfg.puppet) : null, m = readTag(k, rig), mv = { id: nid(), k, start: r2(Math.max(0, t)), dur: (m && (m.dur || LEN[m.kind])) || 3 }; cfg.moves = cfg.moves || []; cfg.moves.push(mv); return 'M:' + mv.id; } }],
    remove(cfg, id) { const [k, x] = id.split(':'); if (k === 'M') cfg.moves = (Array.isArray(cfg.moves) ? cfg.moves : []).filter(q => q.id !== x); },
    duplicate(cfg, id) { const [k, x] = id.split(':'); const it = k === 'M' && (Array.isArray(cfg.moves) ? cfg.moves : []).find(q => q.id === x); if (!it) return null; const c = Object.assign({}, it, { id: nid(), start: r2(it.start + (it.dur || 1)) }); cfg.moves.push(c); return 'M:' + c.id; },
    inspect(root, cfg, id, changed, done) { const [k, x] = id.split(':'); const { H, card, field, sel, btn } = UI; root.innerHTML = '';
      if (k === 'M') { const mv = (Array.isArray(cfg.moves) ? cfg.moves : []).find(q => q.id === x); if (!mv) return form(root, cfg, changed); const rig = cfg.puppet ? Puppet.get(cfg.puppet) : null;
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
  return { id: 'char', name: 'Character', mainThread: () => true, workerData, adoptWorker, defaults, duration, draw, drawRig, form, editor, prepare, soundId, tick: tickSound, stopSound, poseAt, perfOf, readTag, catalogue, syncOf, frameOf, EMO, _GEST: GEST, fromPatterScript, get ticks() { return tick + Puppet.tick; }, exportWithSound: null };
})();

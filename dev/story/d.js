
  /* ---------- What people can do ---------- */
  // key: [icon, label, group, default seconds, what it needs]
  const ACT = {
    say: ['💬', 'Says', 'Talk', 2, 'text'], think: ['💭', 'Thinks', 'Talk', 2, 'text'], shout: ['📢', 'Shouts', 'Talk', 1.8, 'text'], whisper: ['🤫', 'Whispers', 'Talk', 2, 'text'], phone: ['📞', 'On the phone', 'Talk', 2.4, 'text'],
    walk: ['🚶', 'Walks to', 'Move', 1.6, 'spot'], run: ['🏃', 'Runs to', 'Move', 1, 'spot'], sneak: ['🐾', 'Sneaks to', 'Move', 2.4, 'spot'], jump: ['⤴', 'Jumps', 'Move', 0.9], dance: ['🕺', 'Dances', 'Move', 2.4], turn: ['↩', 'Turns round', 'Move', 0.5],
    sit: ['🪑', 'Sits down', 'Move', 0.9], stand: ['🧍', 'Stands up', 'Move', 0.9], kneel: ['🧎', 'Kneels', 'Move', 0.8], lie: ['🛌', 'Lies down', 'Move', 1.2], fall: ['💫', 'Falls over', 'Move', 0.9], getup: ['🆙', 'Gets up', 'Move', 1], hide: ['🙈', 'Hides', 'Move', 2],
    wave: ['👋', 'Waves', 'Body', 1.4], point: ['👉', 'Points', 'Body', 1.4], nod: ['🙂', 'Nods', 'Body', 1], shake: ['🙅', 'Shakes head', 'Body', 1.2], shrug: ['🤷', 'Shrugs', 'Body', 1.2], facepalm: ['🤦', 'Facepalms', 'Body', 1.6], clap: ['👏', 'Claps', 'Body', 1.6], thumbs: ['👍', 'Thumbs up', 'Body', 1.2], handsup: ['🙌', 'Hands up', 'Body', 1.6], bow: ['🙇', 'Bows', 'Body', 1.4], hug: ['🤗', 'Hugs', 'Body', 1.8], punch: ['👊', 'Punches', 'Body', 0.9], celebrate: ['🎉', 'Celebrates', 'Body', 1.8],
    take: ['✋', 'Takes out', 'Props', 0.9, 'prop'], putaway: ['👜', 'Puts it away', 'Props', 0.8], give: ['🤝', 'Gives', 'Props', 2, 'give'], drink: ['🍺', 'Drinks', 'Props', 1.8], eat: ['🍟', 'Eats', 'Props', 2], read: ['📖', 'Reads', 'Props', 2.4], write: ['✍', 'Writes', 'Props', 2.4], throw: ['🤾', 'Throws it', 'Props', 1.2], photo: ['📷', 'Takes a photo', 'Props', 1.4],
    shoot: ['🔫', 'Shoots', 'Fight', 1.2], swing: ['⚔', 'Swings a blade', 'Fight', 1], charge: ['🛡', 'Charges at', 'Fight', 1.6, 'spot'], block: ['🛡', 'Blocks', 'Fight', 1.2],
    dive: ['🤿', 'Dives in', 'Water', 1.8], cannonball: ['💦', 'Cannonball', 'Water', 1.8], swim: ['🏊', 'Swims to', 'Water', 2.4, 'spot'], climbout: ['🪜', 'Climbs out', 'Water', 1.4],
    laugh: ['😂', 'Laughs', 'Feel', 1.6], cry: ['😢', 'Cries', 'Feel', 1.8], angry: ['😠', 'Gets angry', 'Feel', 1.8], confused: ['❓', 'Confused', 'Feel', 1.6], shocked: ['❗', 'Shocked', 'Feel', 1.3], scared: ['😱', 'Scared', 'Feel', 1.8], love: ['😍', 'In love', 'Feel', 1.8], happy: ['😊', 'Looks happy', 'Feel', 1], sad: ['😞', 'Looks sad', 'Feel', 1.2],
    watch: ['⌚', 'Checks watch', 'Feel', 1.8], wait: ['⏳', 'Waits', 'Feel', 2], sleep: ['💤', 'Falls asleep', 'Feel', 2.4], wake: ['⏰', 'Wakes up', 'Feel', 1.1], stamp: ['🔨', 'Stamps', 'Feel', 1.4],
    finger: ['🖕', 'Middle finger', 'Rough', 1.8], vsign: ['✌', 'Two fingers', 'Rough', 1.6], wanker: ['✊', 'Wanker sign', 'Rough', 1.8], chinflick: ['🤌', 'Chin flick', 'Rough', 1.2], moon: ['🍑', 'Moons', 'Rough', 2.4], pish: ['💦', 'Pishes', 'Rough', 3], fart: ['💨', 'Farts', 'Rough', 1.6], belch: ['🫧', 'Belches', 'Rough', 1.4], spit: ['💧', 'Spits', 'Rough', 1.1], pick: ['👃', 'Picks nose', 'Rough', 2], scratch: ['🍑', 'Scratches arse', 'Rough', 1.8],
    slap: ['✋', 'Slaps', 'Rough', 1.4], headbutt: ['💥', 'Glasgow kiss', 'Rough', 1.6], haymaker: ['🥊', 'Haymaker', 'Rough', 1.8], uppercut: ['👊', 'Uppercut', 'Rough', 1.6], kickbaws: ['🦵', 'Kicks in the baws', 'Rough', 1.6], smash: ['🍾', 'Bottle over the head', 'Rough', 1.8], chuck: ['🤾', 'Throws them', 'Rough', 2.4], stomp: ['🥾', 'Puts the boot in', 'Rough', 2.4], brawl: ['☁', 'Full rammy', 'Rough', 3.2],
    stagger: ['🥴', 'Staggers to', 'Rough', 2.6, 'spot'], passout: ['🍺', 'Passes out', 'Rough', 1.6], knockout: ['😵', 'Knocked out', 'Rough', 1.2],
    bangtv: ['👊', 'Bangs on the telly', 'Screen', 1.8], kicktv: ['🦶', 'Kicks it', 'Screen', 2.2], buttv: ['💥', 'Headbutts the screen', 'Screen', 1.8], smashtv: ['🍾', 'Smashes it', 'Screen', 2], throwtv: ['🥿', 'Throws something at it', 'Screen', 1.4, 'throwable'],
    fingertv: ['🖕', 'Middle finger at it', 'Screen', 1.8], vsigntv: ['✌', 'Two fingers at it', 'Screen', 1.6], moontv: ['🍑', 'Moons the telly', 'Screen', 2.4], pishtv: ['💦', 'Pishes on it', 'Screen', 3], shouttv: ['📢', 'Shouts at it', 'Screen', 1.8, 'text'],
    remote: ['📺', 'Changes the channel', 'Screen', 1.4], offtv: ['⏻', 'Switches it off', 'Screen', 1.4], sittv: ['🛋', 'Sits on top of it', 'Screen', 1.6], leantv: ['🧍', 'Leans on it', 'Screen', 2.4], suckedtv: ['🌀', 'Gets sucked into it', 'Screen', 3.4],
    droptv: ['📱', 'Drops it (it falls and smashes)', 'Screen', 1.6], swipetv: ['👆', 'Swipes it away', 'Screen', 1.2], chucktv: ['🤾', 'Chucks the screen away', 'Screen', 1.6],
    caption: ['🔤', 'Caption', 'Scene', 2.5, 'text'], closeup: ['🎥', 'Close up', 'Camera', 2.5], timejump: ['⏱', 'Time jump', 'Scene', 2.3, 'text'],
  };
  const GROUPS = ['Talk', 'Move', 'Body', 'Props', 'Fight', 'Rough', 'Screen', 'Water', 'Feel', 'Camera'];
  const TALK = ['say', 'think', 'shout', 'whisper', 'phone', 'shouttv'], MOVES = ['walk', 'run', 'sneak', 'charge', 'swim', 'stagger'];
  // Rough stuff aimed at someone: the first 30% walks up to them (or winds up), then 'imp' of the rest is the moment it lands; r is how they react
  const HIT = { punch: { imp: 0.3, r: 'punched', d: 0.9 }, slap: { imp: 0.35, r: 'slapped', d: 1.1 }, headbutt: { imp: 0.42, r: 'butted', d: 1.6 }, haymaker: { imp: 0.45, r: 'decked', d: 1.4 }, uppercut: { imp: 0.42, r: 'lifted', d: 1.5 },
    kickbaws: { imp: 0.4, r: 'baws', d: 2 }, smash: { imp: 0.5, r: 'smashed', d: 1.4 }, chuck: { imp: 0.42, r: 'chucked', d: 1.5 }, stomp: { imp: 0.02, r: 'stomped', d: 0 }, brawl: { imp: 0.04, r: 'brawled', d: 0 }, spit: { imp: 0.5, r: 'spat', d: 1.1 },
    shoot: { imp: 0.07, r: 'shot', d: 2.4, how: { dead: ['shot', 2.4], hurt: ['winged', 2.2], miss: ['missed', 1.4] } }, swing: { imp: 0.42, r: 'slashed', d: 2.4, how: { dead: ['slashed', 2.4], hurt: ['cut', 2.2], miss: ['dodged', 1.3] } } };
  // How a shot or a blade ends: the reaction it puts on the other person and how long that lasts
  const hitOf = a => { const H = HIT[a.k]; if (!H) return null; if (!H.how) return [H.r, H.d]; return H.how[a.how] || H.how.dead; };
  const HOWS = [['dead', 'Dead'], ['hurt', 'Wounded'], ['miss', 'Missed']];
  const RUDE = ['finger', 'vsign', 'wanker', 'moon', 'pish'], AIMED = ['hug', 'give', ...Object.keys(HIT)], KO = ['butted', 'decked', 'lifted', 'smashed', 'brawled', 'stomped', 'chucked', 'shot', 'slashed'], DEAD = ['shot', 'slashed'];
  const actLabel = a => { const A0 = ACT[a.k] || ['•', a.k]; if (A0[4] === 'text') return a.text ? (a.k === 'caption' || a.k === 'timejump' ? a.text : '“' + a.text + '”') : A0[1]; if (A0[4] === 'spot') return A0[1] + ' ' + spotName(a.to); if (a.k === 'take') return 'Takes out ' + (PNAME[a.prop] || 'something').toLowerCase(); if (a.k === 'give') return 'Gives ' + (PNAME[a.prop] || '').toLowerCase(); return A0[1]; };
  const spotName = k => !k ? '…' : k[0] === '@' ? 'someone' : k;
  const talkDur = tx => Math.max(1.6, 0.9 + String(tx || '').split(/\s+/).filter(Boolean).length * 0.34);
  const SPOTS = { 'off left': -170, left: 380, middle: 960, right: 1540, 'off right': 2090 };

  /* ---------- Working out where everyone is at a moment ---------- */
  function spotOf(set, k, sim, me) {
    if (typeof k === 'number') return { x: k };
    if (k && k[0] === '@' && sim && sim[k.slice(1)]) { const o = sim[k.slice(1)], side = me && me.x < o.x ? -1 : 1; return { x: o.x + side * 0.42 * S }; }
    if (SPOTS[k] != null && !(set.marks[k])) return { x: SPOTS[k] }; return set.marks[k] || set.marks.middle || { x: 960 };
  }
  function simScene(sc, P, t) {
    const set = P.set, out = {}, water = set.water, inW = x => !!water && x > water.x0 + 30 && x < water.x1 - 30;
    sc.people.forEach(pe => { const sp = spotOf(set, pe.start), x = sp.x; out[pe.pid] = { x, dir: pe.start === 'off right' ? -1 : pe.start === 'off left' ? 1 : (x < 960 ? 1 : -1), sit: !!sp.sit, lowSit: !!sp.low, behind: !!sp.behind, wet: !!sp.water, sleep: false, lying: false, kneel: false, mood: 'ok', active: null, props: pe.holding ? [pe.holding] : [] }; if (inW(x)) out[pe.pid].wet = true; const inj = pe.injury || ''; out[pe.pid].blackEye = inj === 'blackeye'; out[pe.pid].bandage = inj === 'bandage'; out[pe.pid].plaster = inj === 'plaster'; });
    // Props change hands at fixed moments
    P.events.forEach(e => { if (e.t > t) return; const st = out[e.who]; if (!st) return;
      if (e.k === 'add' && !st.props.includes(e.prop)) st.props.push(e.prop);
      if (e.k === 'rm') { const pr = e.prop && st.props.includes(e.prop) ? e.prop : st.props.filter(p => p !== 'suitcase').slice(-1)[0]; st.props = st.props.filter(p => p !== pr); if (pr) st.thrown = pr; }
      if (e.k === 'rmx' && e.prop === 'throwtv') { st.props = st.props.filter(p => p !== e.prop2); st.thrown = e.prop2; return; }
      if (e.k === 'rmx') st.props = st.props.filter(p => p !== e.prop);
      if (e.k === 'mv') { st.props = st.props.filter(p => p !== e.prop); if (out[e.to] && !out[e.to].props.includes(e.prop)) out[e.to].props.push(e.prop); } });
    sc.people.forEach(pe => { const st = out[pe.pid], acts = P.byWho[pe.pid] || [];
      for (const a of acts) { if (a.start > t) break; const p = (t - a.start) / a.dur, cut = !a.synthetic && p < 1 && acts.some(h => h.synthetic && h.start > a.start && h.start <= t), done = p >= 1 || cut;
        if (!done) st.active = { a, p: cl(p, 0, 1), e: t - a.start, from: { x: st.x, dir: st.dir, wet: st.wet, lying: st.lying } };
        // Hugs, punches and hand-overs walk up to the other person first if they are standing apart
        if (a.k === 'shoot' && a.to && out[a.to] && out[a.to] !== st) { if (!done) { st.dir = out[a.to].x >= st.x ? 1 : -1; st.active.tx = out[a.to].x; st.active.miss = a.how === 'miss'; } }
        else if (AIMED.includes(a.k) && a.to && out[a.to] && out[a.to] !== st && !st.wet && !st.sit && !st.lying) { const tq = out[a.to], tx = tq.x + (tq.lying && tq.lieSide ? tq.lieSide * 0.5 * S : a.k === 'stomp' && !tq.lying ? (tq.x >= st.x ? 1 : -1) * 0.5 * S : 0), sd = tx >= st.x ? 1 : -1, gap = ({ hug: 0.3, brawl: 0.3, stomp: 0.32, chuck: 0.3, spit: 0.7, swing: 0.6 }[a.k] || 0.42) * S, stand = tx - sd * gap, far = Math.abs(tx - st.x) > gap + 40 && tx > -100 && tx < WW + 100, fixed = !!HIT[a.k];
          if (far || fixed) { const ap = fixed ? 0.3 : cl(Math.abs(stand - st.x) / 430 / a.dur, 0.1, 0.45); if (!done) { st.walkFrom = st.x; st.walkTo = far ? stand : st.x; st.active.ap = ap; st.active.p = cl((p - ap) / (1 - ap), 0, 1); st.active.walking = p < ap && far ? p / ap : null; } else { if (far) st.x = stand; st.dir = sd; } } }
        // Walking up to a screen to bang it, kick it, lean on it or climb on it
        if (SCRACT[a.k] && SCRACT[a.k].go && !st.wet && !st.lying) { const sp = scrStand(sc, a, st.x); if (sp) { const far = Math.abs(sp.x - st.x) > 30; if (!done) { if (st.perch) st.perch = null; st.walkFrom = st.x; st.walkTo = far ? sp.x : st.x; st.active.ap = 0.3; st.active.p = cl((p - 0.3) / 0.7, 0, 1); st.active.walking = p < 0.3 && far ? p / 0.3 : null; st.sit = false; } else { st.x = sp.x; st.dir = sp.x < sp.E.r.cx ? 1 : -1; } } }
        if (!done && st.perch && (MOVES.includes(a.k) || ['stand', 'getup', 'jump', 'fall', 'lie'].includes(a.k))) { st.perch = null; st.sit = false; }
        // Being on the end of it: face whoever did it, and know which way to fly
        if (a.synthetic && out[a.by]) { const hx = out[a.by].x; st.hitAway = a.away || (st.x >= hx ? 1 : -1); if (!done) st.dir = -st.hitAway; }
        if (MOVES.includes(a.k) || a.k === 'dive' || a.k === 'cannonball' || a.k === 'climbout') {
          let sp; if (a.k === 'dive' || a.k === 'cannonball') sp = { x: water ? cl(st.x < (water.x0 + water.x1) / 2 ? water.x0 + 170 : water.x1 - 170, water.x0 + 60, water.x1 - 60) : st.x + st.dir * 300, water: !!water };
          else if (a.k === 'climbout') sp = { x: water ? (st.x < (water.x0 + water.x1) / 2 ? water.x0 - 110 : water.x1 + 110) : st.x }; else sp = spotOf(set, a.to, out, st);
          if (a.k === 'swim' && water) sp = { x: cl(sp.x, water.x0 + 60, water.x1 - 60), water: true };
          if (done) { st.dir = sp.x >= st.x ? 1 : -1; if (Math.abs(sp.x - st.x) < 1) st.dir = st.active ? st.dir : st.dir; st.x = sp.x; st.sit = !!sp.sit && !['charge', 'swim'].includes(a.k); st.lowSit = !!sp.low; st.behind = !!sp.behind; st.sleep = false; st.lying = false; st.kneel = false; st.wet = a.k === 'climbout' ? false : !!sp.water || (a.k === 'swim' && st.wet) || inW(st.x); }
          else { st.walkFrom = st.x; st.walkTo = sp.x; st.sitAt = !!sp.sit; st.toWater = !!sp.water; } }
        if (done) { const k = a.k;
          if (k === 'sit') st.sit = true; if (k === 'stand' || k === 'getup') { st.sit = false; st.sleep = false; st.lying = false; st.kneel = false; st.lieSide = null; } if (k === 'kneel') st.kneel = true; if (k === 'lie' || k === 'fall') { st.lying = true; st.sit = false; st.lieSide = -st.dir; }
          if (k === 'sleep') st.sleep = true; if (k === 'wake') st.sleep = false; if (k === 'turn') st.dir = -st.dir;
          if (k === 'passout') { st.lying = true; st.sleep = true; st.sit = false; st.lieSide = -st.dir; } if (k === 'knockout') { st.lying = true; st.ko = true; st.sit = false; st.lieSide = -st.dir; }
          if (a.synthetic) { const r = k.slice(4), aw = st.hitAway || -st.dir; if (KO.includes(r)) { if (!st.lying) st.lieSide = aw; st.lying = true; st.ko = r !== 'stomped' || st.ko; st.sit = false; st.kneel = false; } if (DEAD.includes(r)) { st.dead = true; st.deadT = a.start + a.dur; st.wound = r; } if (r === 'baws') { st.kneel = true; st.sit = false; } if (['punched', 'butted', 'decked', 'brawled', 'stomped'].includes(r)) st.blackEye = true; if (r === 'decked') st.x += aw * 170; if (r === 'chucked') st.x += aw * 560; if (r === 'slapped') st.cheekT = a.start; st.mood = r === 'spat' ? 'angry' : st.mood; }
          if (k === 'getup' || k === 'stand') { st.ko = false; st.perch = null; st.dead = false; }
          if (k === 'sittv') { const q = scrFor(sc, a, st.x); if (q) { const E2 = scrEdges(q); st.perch = { y: E2.top, x: E2.r.cx, end: (+q.start || 0) + Math.max(0.6, +q.dur || 6) }; st.x = E2.r.cx; st.sit = true; st.lowSit = true; } }
          if (k === 'suckedtv') st.blackEye = true;
          if (k === 'celebrate' || k === 'laugh' || k === 'happy' || k === 'love') st.mood = 'happy'; if (k === 'cry' || k === 'sad') st.mood = 'sad'; if (k === 'angry') st.mood = 'angry'; }
        if (!done) break; } });
    // If the screen they are sitting on switches off and goes, they land on the floor on their backside
    sc.people.forEach(pe => { const st = out[pe.pid]; if (st.perch && st.perch.end != null && t > st.perch.end) { st.perch = null; st.sit = true; st.lowSit = true; } });
    // Who faces whom: listeners turn to whoever is talking; givers and receivers face each other
    const talker = sc.people.find(pe => { const a = out[pe.pid].active; return a && TALK.includes(a.a.k); });
    sc.people.forEach(pe => { const st = out[pe.pid], a = st.active; if (st.lying || st.wet) return; if (a && (MOVES.includes(a.a.k) || ['dive', 'cannonball', 'climbout', 'turn'].includes(a.a.k))) return;
      if (a && SCRACT[a.a.k] && !a.walking) { const q = scrFor(sc, a.a, st.x); if (q) { const dx = (+q.x || 960) - st.x; if (Math.abs(dx) > 20) st.dir = dx > 0 ? 1 : -1; } return; }
      if (st.perch) return;
      if (a && PACK.acts[a.a.k] && a.a.to && out[a.a.to] && out[a.a.to] !== st) { st.dir = out[a.a.to].x > st.x ? 1 : -1; return; }
      if (a && (a.a.k === 'give' || a.a.k === 'hug' || a.a.k === 'punch') && a.a.to && out[a.a.to]) { st.dir = out[a.a.to].x > st.x ? 1 : -1; return; }
      const recv = sc.people.find(q => { const qa = out[q.pid].active; return qa && ['give', 'hug', 'punch'].includes(qa.a.k) && qa.a.to === pe.pid; }); if (recv) { st.dir = out[recv.pid].x > st.x ? 1 : -1; return; }
      if (talker && talker.pid !== pe.pid) { st.dir = out[talker.pid].x > st.x ? 1 : -1; return; }
      const others = sc.people.filter(q => q.pid !== pe.pid && out[q.pid].x > -100 && out[q.pid].x < WW + 100); if (!a && others.length && st.x > -100 && st.x < WW + 100) { const ax = others.reduce((m, q) => m + out[q.pid].x, 0) / others.length; if (Math.abs(ax - st.x) > 40) st.dir = ax > st.x ? 1 : -1; }
      // On their own with a screen in the scene, they turn to the screen
      else if ((!a || a.a.k === 'point') && !others.length && (sc.screens || []).length && st.x > -100 && st.x < WW + 100) { const q = sc.screens.reduce((b, s2) => Math.abs((+s2.x || 960) - st.x) < Math.abs((+b.x || 960) - st.x) ? s2 : b), dx = (+q.x || 960) - st.x; if (Math.abs(dx) > 40) st.dir = dx > 0 ? 1 : -1; } });
    return out;
  }
  const holding = (st, list) => list.find(p => st.props.includes(p));
  /* How each prop is held when nobody is doing anything with it: which hand, where that hand sits (forward and down from the
     shoulder, in body heights) and which way it points. A held prop keeps its hand steady; gestures move to the other hand. */
  const GRIP = {
    suitcase: { side: 'back', at: [-0.08, 0.31], carry: 1 }, briefcase: { side: 'back', at: [-0.08, 0.31], carry: 1 }, bag: { side: 'back', at: [-0.06, 0.29], carry: 1 },
    umbrella: { at: [0.11, -0.04] }, pint: { at: [0.17, 0.13], sip: 1 }, tea: { at: [0.17, 0.13], sip: 1 }, bottle: { at: [0.17, 0.13], sip: 1 }, chips: { at: [0.16, 0.14], nibble: 1 },
    passport: { at: [0.14, 0.18] }, ticket: { at: [0.14, 0.18] }, letter: { at: [0.14, 0.17] }, money: { at: [0.14, 0.18] }, keys: { at: [0.12, 0.24] }, phone: { at: [0.13, 0.17], glance: 1 }, remote: { at: [0.13, 0.17] }, shoe: { at: [0.12, 0.22] },
    camera: { at: [0.1, 0.24] }, notepad: { at: [0.13, 0.15] }, newspaper: { at: [0.08, 0.22] }, flowers: { at: [0.16, 0.13] },
    flag: { at: [0.17, 0.1] }, sign: { at: [0.17, 0.1] }, torch: { at: [0.17, 0.05] }, rod: { at: [0.17, 0.12] },
    gun: { at: [0.05, 0.31], a: 1.5 }, rifle: { at: [0.16, 0.14], two: [0.03, 0.03], a: -0.65 }, sword: { at: [0.08, 0.3], a: 1.95 }, axe: { at: [0.12, 0.08], a: -0.5 },
    spear: { at: [0.17, 0.1], a: -0.32 }, bow: { at: [0.12, 0.22], a: 0 }, shield: { side: 'back', at: [-0.03, 0.17] },
  };
  // Which prop an action is working with (it moves with the action instead of sitting in its usual grip)
  function actProp(k, st, Q, a) {
    if (Q.hold && Q.hold.prop) return { prop: Q.hold.prop, side: Q.hold.side || Q.dir };
    const last = () => st.props.filter(x => !GRIP[x] || !GRIP[x].carry).slice(-1)[0];
    if (k === 'give') return { prop: a.prop, side: Q.dir }; if (k === 'take') return { prop: a.prop, side: Q.dir }; if (k === 'putaway' || k === 'throw') return { prop: (k === 'throw' && st.thrown) || last(), side: Q.dir };
    if (k === 'shoot') return { prop: holding(st, ['rifle', 'bow', 'gun']), side: Q.dir }; if (k === 'swing' || k === 'charge') return { prop: holding(st, ['sword', 'axe', 'spear', 'torch', 'flag', 'gun', 'rifle']), side: Q.dir }; if (k === 'block') return { prop: holding(st, ['shield']), side: -Q.dir };
    return null;
  }
  const gripAt = (pr, Q) => { const G = GRIP[pr] || { at: [0.14, 0.18] }; return [Q.dir * G.at[0] * S, G.at[1] * S]; };
  /* Faces layer over actions. A feeling (angry, sad, happy) carries on through the actions after it, replacing their usual
     cheery or blank face, until the next feeling. Any action can also be given its own face, which wins over everything. */
  const FACES = [['', 'Auto'], ['angry', 'Angry'], ['happy', 'Happy'], ['sad', 'Sad'], ['shock', 'Shocked'], ['scared', 'Scared'], ['ok', 'Straight face']];
  function faceOf(Q, st, t) { const A = st.active && st.active.a; if (!A || ACT[A.k] && ACT[A.k][2] === 'Feel') return;
    const own = Q.mood; if (st.mood && st.mood !== 'ok' && (!own || own === 'ok' || own === 'happy')) Q.mood = st.mood;
    if (A.face) { Q.mood = A.face; if (!Q.emote) { if (A.face === 'angry') Q.emote = { k: 'steam', e: st.active.e }; if (A.face === 'scared') Q.emote = { k: 'sweat', e: st.active.e }; } } }
  function poseOf(ch, st, t, P) {
    const Q = poseCore(ch, st, t, P); Q.grips = {}; faceOf(Q, st, t); if (Q.hidden) return Q;
    const A = st.active && st.active.a, k = A ? A.k : '', front = Q.dir, back = -Q.dir, set = { ...Q.hands }, used = {};
    const ap = A ? actProp(k, st, Q, A) : null; if (ap && ap.prop && !Q.props.includes(ap.prop) && !(Q.hold && Q.hold.prop === ap.prop)) ap.prop = null; Q.ap = ap && ap.prop; if (ap && ap.prop) { Q.grips[ap.prop] = ap.side; used[ap.side] = 1; if (ap.prop === 'rifle' && k !== 'shoot') used[-ap.side] = 1; }
    if (Q.swimming || Q.rot > 0.5 || Q.tuck > 0.3 || Q.diveA) return Q;
    // Everything else sits in its grip, and the hand holding it stays put
    const idle = !A || ['wait', 'nod', 'shake', 'happy', 'sad', 'love', 'think'].includes(k), cyc = (t + (ch.i || 0) * 2.3) % 6.5, sipK = idle && !Q.sit && cyc < 1.1 ? Math.sin(cyc / 1.1 * Math.PI) : 0;
    Q.props.forEach(pr => { if (Q.grips[pr] != null) return; const G = GRIP[pr] || { at: [0.14, 0.18] }; let sd = G.side === 'back' ? back : front; if (used[sd]) sd = -sd; if (used[sd]) return; if (G.two && used[-sd]) return;
      used[sd] = 1; Q.grips[pr] = sd; const moved = set[sd]; let h = gripAt(pr, Q);
      if (G.carry) { if (Q.walk != null) h = [h[0] + Math.sin(Q.walk) * 0.02 * S, h[1] - Math.abs(Math.cos(Q.walk)) * 0.01 * S]; }
      else if (Q.sit && !G.two) h = [h[0], Math.min(h[1], 0.2 * S)];
      if (G.sip && sipK) { h = [lerp(h[0], Q.dir * 0.06 * S, sipK), lerp(h[1], -0.1 * S, sipK)]; Q.tilt = (Q.tilt || 0) - 0.22 * sipK * Q.dir; Q.sipping = sipK; }
      if (G.nibble && sipK) { Q.hands[-sd] = [Q.dir * lerp(0.15, 0.05, sipK) * S, lerp(0.12, -0.1, sipK) * S]; Q.talk = sipK > 0.6; }
      if (G.glance && sipK) { h = [lerp(h[0], Q.dir * 0.16 * S, sipK), lerp(h[1], 0.06 * S, sipK)]; Q.hdy = (Q.hdy || 0) + 6 * sipK; }
      Q.hands[sd] = h; (Q.elbowDown = Q.elbowDown || {})[sd] = 1; if (G.two) { Q.hands[-sd] = [Q.dir * G.two[0] * S, G.two[1] * S]; used[-sd] = 1; }
      // A gesture this hand was doing moves to the free hand
      else if (moved && !used[-sd] && !set[-sd]) Q.hands[-sd] = moved; });
    return Q;
  }
  // Pose for one person at this moment, plus any effects their action throws out (splashes, bangs, arrows)
  function poseCore(ch, st, t, P) {
    const water = P.set.water, Q = { x: st.x, dir: st.dir, sit: st.sit ? 1 : 0, lowSit: st.lowSit, mood: st.mood, hands: {}, eyes: st.sleep ? 'shut' : null, props: st.props.slice(), hdx: 0, hdy: Math.sin(t * 0.9 + ch.i) * 1.5, tilt: 0, bob: Math.sin(t * 1.7 + ch.i) * 2, kneel: st.kneel ? 1 : 0, rot: st.lying ? 1 : 0, fx: [], hold: null, hidden: false, inWater: st.wet };
    const front = Q.dir, back = -Q.dir;
    if (st.perch) { Q.sit = 1; Q.lowSit = true; Q.hop = Math.max(0, FL - 0.06 * S - st.perch.y); Q.x = st.perch.x; }
    if (st.sleep) { Q.tilt = 0.35 * Q.dir; Q.hdy = 8; Q.emote = { k: 'zzz' }; }
    Q.lieSide = st.lying ? st.lieSide : null; Q.blackEye = st.blackEye; Q.bandage = st.bandage; Q.plaster = st.plaster; if (st.cheekT != null && t - st.cheekT < 3) Q.cheek = 1; if (st.ko && st.lying) { Q.eyes = 'x'; if (st.dead) { Q.tongue = true; Q.mood = 'ok'; Q.wound = st.wound; if (t - st.deadT < 3.2) Q.emote = { k: 'ghost', q: (t - st.deadT) / 3.2 }; } else Q.emote = Q.emote || ((t % 3) < 1.2 ? { k: 'stars', p: 0.5 } : null); }
    if (Q.sit) { Q.hands[front] = [front * 0.17 * S, 0.27 * S]; Q.hands[back] = [back * 0.02 * S + Q.dir * 0.12 * S, 0.28 * S]; }
    const wpn = holding(st, ['gun', 'rifle', 'sword', 'axe', 'spear', 'torch', 'bow']);
    if (st.wet && water) { Q.swimming = true; const ph = t * 4 + ch.i; Q.hop = -(0.58 * S + 14) + Math.sin(t * 2 + ch.i) * 5; Q.hands[front] = [front * 0.2 * S, 0.12 * S + Math.sin(ph) * 10]; Q.hands[back] = [back * 0.2 * S, 0.12 * S + Math.cos(ph) * 10]; Q.noLegs = true; }
    const A0 = st.active; if (!A0) return Q;
    if (A0.ap) { const x0 = st.walkFrom, x1 = st.walkTo; Q.dir = x1 >= x0 ? 1 : -1; if (A0.walking != null) { Q.x = lerp(x0, x1, io(A0.walking)); Q.walk = Math.abs(Q.x - x0) / (0.12 * S) * Math.PI * 0.5; Q.bob = -Math.abs(Math.sin(Q.walk)) * 6; Q.eyes = null; Q.emote = null; return Q; } Q.x = x1; }
    const a = A0.a, p = A0.p, e = A0.e, g = SCRALIAS[a.k] || a.k, sn = Math.sin(p * Math.PI);
    if (SCRACT[a.k] && !SCRALIAS[a.k]) { poseScreen(Q, st, a, p, e, P); return Q; }
    if (PACK.acts[a.k]) { packPose(Q, st, PACK.acts[a.k], a, p, e); return Q; }
    if (MOVES.includes(g)) {
      const x0 = st.walkFrom, x1 = st.walkTo, k = g === 'run' || g === 'charge' ? p : io(p), x = lerp(x0, x1, k); Q.x = x; Q.dir = x1 >= x0 ? 1 : -1; Q.eyes = null; Q.emote = null; Q.tilt = 0; Q.rot = 0; Q.kneel = 0;
      if (g === 'swim' || (st.wet && water)) { Q.swimming = true; Q.inWater = true; const ph = e * 6; Q.hop = -(0.58 * S + 14) + Math.sin(e * 3) * 4; Q.hands[Q.dir] = [Q.dir * 0.22 * S * Math.cos(ph), -0.02 * S + 0.14 * S * Math.sin(ph)]; Q.hands[-Q.dir] = [Q.dir * 0.22 * S * Math.cos(ph + Math.PI), -0.02 * S + 0.14 * S * Math.sin(ph + Math.PI)]; Q.noLegs = true; return Q; }
      Q.sit = st.sitAt ? cl((p - 0.85) / 0.15, 0, 1) : 0;
      if (p > 0.02 && p < 0.97 && Math.abs(x1 - x0) > 5) { Q.walk = Math.abs(x - x0) / (0.12 * S) * Math.PI * 0.5 + 0.3; Q.bob = -Math.abs(Math.sin(Q.walk)) * 6; const sw = Math.sin(Q.walk); [-1, 1].forEach(sd => { Q.hands[sd] = [sd * 0.07 * S + Q.dir * sw * sd * 0.06 * S, 0.3 * S]; }); }
      if (g === 'stagger') { const sw = Math.sin(e * 3.1); Q.x = x + Math.sin(e * 2.3) * 40 * Math.sin(p * Math.PI); Q.tilt = sw * 0.22; Q.lean = 0.2 + sw * 0.25; Q.hdx = Math.sin(e * 4) * 6; Q.eyes = 'shut'; Q.mood = 'happy'; Q.hands[Q.dir] = [Q.dir * 0.16 * S, 0.05 * S + sw * 0.08 * S]; Q.hands[-Q.dir] = [-Q.dir * 0.14 * S, 0.1 * S - sw * 0.08 * S]; if ((e % 1.6) < 0.5) Q.emote = { k: 'words', s: 'hic!', p: (e % 1.6) / 0.5, col: CH.white }; }
      if (g === 'sneak') { Q.lower = 0.55; [-1, 1].forEach(sd => Q.hands[sd] = [Q.dir * 0.1 * S + sd * 0.02 * S, 0.12 * S]); Q.emote = { k: '...', p }; }
      if (g === 'charge') { Q.mood = 'angry'; Q.talk = true; if (wpn === 'gun' || wpn === 'rifle') { Q.hands[Q.dir] = [Q.dir * 0.3 * S, 0.02 * S]; if (wpn === 'rifle') Q.hands[-Q.dir] = [Q.dir * 0.12 * S, 0.05 * S]; } else if (wpn === 'spear') { Q.hold = { a: 1.1 }; Q.hands[Q.dir] = [Q.dir * 0.16 * S, 0.06 * S]; Q.hands[-Q.dir] = [Q.dir * 0.02 * S, 0.04 * S]; } else { Q.hold = { a: -1.3 }; Q.hands[Q.dir] = [Q.dir * 0.12 * S, -0.22 * S]; } if (e < 1.2) Q.emote = { k: 'words', s: 'CHARGE!', p: cl(e / 0.4, 0, 1), col: CH.red }; Q.fast = true; }
      if (st.toWater && water && x > water.x0 && x < water.x1) { Q.inWater = true; Q.hop = -(0.58 * S + 14) * cl((Math.min(x - water.x0, water.x1 - x)) / 120, 0, 1); }
      return Q; }
    if (TALK.includes(g)) { Q.talk = g !== 'think' && p < 0.97; const slot = Math.floor(e / 0.7), r = rng(ch.i * 31 + slot + Math.round(a.start * 10))(), k2 = r < 0.35 ? 'open' : r < 0.7 ? 'talk' : 'point';
      if (g === 'shout') { Q.hands[-1] = [-0.14 * S, -0.2 * S]; Q.hands[1] = [0.14 * S, -0.2 * S]; Q.hop = Math.abs(Math.sin(e * 9)) * 6; Q.mood = 'angry'; }
      else if (g === 'think') { Q.hands[front] = [front * 0.05 * S, -0.06 * S]; Q.tilt = -0.15 * Q.dir; Q.hdy = -4; }
      else if (g === 'whisper') { Q.hands[front] = [front * 0.08 * S, -0.09 * S]; Q.lean = 0.6; }
      else if (g === 'phone') { Q.hands[front] = [front * 0.04 * S, -0.13 * S]; Q.hold = { prop: 'phone', side: front }; }
      else if (Q.swimming || Q.sit) { } else if (k2 === 'open') { Q.hands[front] = [front * 0.2 * S, 0.08 * S]; Q.hands[back] = [back * 0.17 * S, 0.12 * S]; } else if (k2 === 'talk') Q.hands[front] = [front * 0.18 * S, 0.1 * S]; else Q.hands[front] = [front * 0.3 * S, -0.02 * S];
      Q.hdx = Math.sin(e * 7) * 2; return Q; }
    const lift = (pp, a2, b2) => pp < a2 ? io(pp / a2) : pp > b2 ? 1 - io((pp - b2) / (1 - b2)) : 1;
    switch (g) {
      case 'give': { const k = p < 0.5 ? io(p / 0.45) : 1 - io((p - 0.6) / 0.4); Q.hands[front] = [front * lerp(0.07 * S, 0.26 * S, k), lerp(0.31 * S, 0.08 * S, k)]; if (p < 0.5 && a.prop && !Q.props.includes(a.prop)) Q.props.push(a.prop); break; }
      // Into the pocket and up to where the thing is usually held, or back down again
      case 'take': { const gp = gripAt(a.prop || 'phone', Q), k = p < 0.35 ? 0 : io((p - 0.35) / 0.65), dip = p < 0.35 ? io(p / 0.35) : 1; Q.hands[front] = [lerp(front * lerp(0.07, 0.1, dip) * S, gp[0], k), lerp(lerp(0.31, 0.34, dip) * S, gp[1], k)]; break; }
      case 'putaway': { const pr = st.props.filter(x => !GRIP[x] || !GRIP[x].carry).slice(-1)[0] || (A0.from && 'phone'), gp = gripAt(pr || 'phone', Q), k = io(cl(p / 0.55, 0, 1)); Q.hands[front] = [lerp(gp[0], front * 0.1 * S, k), lerp(gp[1], 0.34 * S, k)]; break; }
      case 'wave': Q.hands[front] = [front * (0.2 + 0.06 * Math.sin(e * 12)) * S, -0.24 * S]; Q.mood = 'happy'; break;
      case 'nod': Q.hdy = Math.max(0, Math.sin(e * 10)) * 8 * sn; break;
      case 'shake': Q.hdx = Math.sin(e * 14) * 9 * sn; break;
      case 'shrug': { const k = io(Math.min(1, p * 3)) * (p > 0.8 ? 1 - io((p - 0.8) / 0.2) : 1); [-1, 1].forEach(sd => Q.hands[sd] = [sd * lerp(0.07, 0.2, k) * S, lerp(0.31, 0.02, k) * S]); Q.hop = k * 5; Q.tilt = 0.12 * k; break; }
      case 'point': Q.hands[front] = [front * 0.32 * S, -0.04 * S * sn]; break;
      case 'celebrate': Q.hop = Math.abs(Math.sin(e * 6)) * 28 * sn; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.16 * S, -0.27 * S]); Q.mood = 'happy'; Q.emote = { k: 'stars', p }; break;
      case 'facepalm': { const k = lift(p, 0.25, 0.85); Q.hands[front] = [lerp(front * 0.07 * S, front * 0.03 * S, k), lerp(0.31 * S, -0.1 * S, k)]; Q.tilt = 0.2 * k * Q.dir; Q.hdy = 6 * k; break; }
      case 'clap': { const k = lift(p, 0.15, 0.85), c = Math.abs(Math.sin(e * 11)); [-1, 1].forEach(sd => Q.hands[sd] = [front * 0.14 * S * k + sd * (0.02 + 0.06 * c) * S * k + sd * 0.07 * S * (1 - k), lerp(0.31, 0.06, k) * S]); Q.mood = 'happy'; break; }
      case 'thumbs': { const k = lift(p, 0.2, 0.8); Q.hands[front] = [front * lerp(0.07, 0.2, k) * S, lerp(0.31, 0.02, k) * S]; Q.mood = 'happy'; if (k > 0.8) Q.fx.push({ k: 'thumb', side: front }); break; }
      case 'handsup': { const k = lift(p, 0.15, 0.9); [-1, 1].forEach(sd => Q.hands[sd] = [sd * lerp(0.07, 0.12, k) * S, lerp(0.31, -0.3, k) * S]); Q.mood = 'shock'; break; }
      case 'bow': { const k = lift(p, 0.25, 0.75); Q.lean = 1.6 * k; Q.hdy = 22 * k; Q.hands[front] = [front * 0.06 * S * (1 + k), 0.31 * S]; Q.hands[back] = [back * 0.03 * S + front * 0.04 * S * k, 0.31 * S]; break; }
      case 'hug': { const k = lift(p, 0.2, 0.85); Q.hands[front] = [front * lerp(0.07, 0.22, k) * S, lerp(0.31, 0.1, k) * S]; Q.hands[back] = [front * lerp(-0.07, 0.16, k) * S, lerp(0.31, 0.12, k) * S]; Q.lean = 0.5 * k; Q.mood = 'happy'; if (k > 0.9) Q.emote = { k: 'hearts' }; break; }
      case 'punch': { const j = p < 0.25 ? -io(p / 0.25) * 0.3 : p < 0.45 ? io((p - 0.25) / 0.2) : 1 - io((p - 0.5) / 0.5); Q.hands[front] = [front * lerp(0.1, 0.36, cl(j, 0, 1)) * S - front * 0.06 * S * Math.max(0, -j), 0.06 * S]; Q.hands[back] = [front * 0.06 * S, 0.1 * S]; Q.lean = 0.4 * Math.max(0, j); Q.mood = 'angry'; if (p > 0.4 && p < 0.7) Q.fx.push({ k: 'pow', side: front, p: (p - 0.4) / 0.3 }); Q.fast = p > 0.25 && p < 0.5; break; }
      case 'drink': { const k = lift(p, 0.2, 0.85); Q.hold = { prop: holding(st, ['pint', 'tea', 'bottle']) || 'pint', side: front }; Q.hands[front] = [front * lerp(0.12, 0.06, k) * S, lerp(0.15, -0.1, k) * S]; Q.tilt = -0.25 * k * Q.dir; break; }
      case 'eat': { const c = Math.abs(Math.sin(e * 5)); Q.hold = { prop: holding(st, ['chips']) || 'chips', side: back }; Q.hands[back] = [front * 0.14 * S, 0.12 * S]; Q.hands[front] = [front * lerp(0.15, 0.05, c) * S, lerp(0.12, -0.1, c) * S]; Q.talk = c > 0.7; break; }
      case 'read': { const k = lift(p, 0.15, 0.9); Q.hold = { prop: holding(st, ['newspaper', 'letter', 'notepad']) || 'newspaper', side: front }; Q.hands[front] = [front * lerp(0.1, 0.17, k) * S, lerp(0.3, 0.02, k) * S]; Q.hands[back] = [front * lerp(0, 0.1, k) * S, lerp(0.3, 0.04, k) * S]; Q.tilt = 0.12 * k * Q.dir; Q.hdy = 4 * k; break; }
      case 'write': { const k = lift(p, 0.15, 0.9), s2 = Math.sin(e * 14) * 8; Q.hold = { prop: 'notepad', side: back }; Q.hands[back] = [front * 0.12 * S * k + back * 0.07 * S * (1 - k), lerp(0.3, 0.1, k) * S]; Q.hands[front] = [front * (0.15 * S * k + s2 * 0.4), lerp(0.3, 0.06, k) * S + Math.cos(e * 9) * 4]; Q.tilt = 0.15 * k * Q.dir; break; }
      case 'throw': { const pr = (p >= 0.45 && st.thrown) || (a.k === 'throwtv' && a.prop) || st.props.filter(x => x !== 'suitcase').slice(-1)[0] || 'ball'; const k = p < 0.4 ? io(p / 0.4) : 1 - io((p - 0.4) / 0.25); Q.hands[front] = p < 0.4 ? [front * lerp(0.07, -0.12, k) * S, lerp(0.31, -0.2, k) * S] : [front * lerp(0.3, -0.12, k) * S, lerp(0.05, -0.2, k) * S]; if (p >= 0.45) { Q.props = Q.props.filter(x => x !== pr); Q.fx.push({ k: 'fly', prop: pr, q: (p - 0.45) / 0.55, side: front }); } else if (!Q.props.includes(pr) && pr !== 'ball') Q.props.push(pr); Q.fast = p > 0.35 && p < 0.55; break; }
      case 'photo': { const k = lift(p, 0.2, 0.85); Q.hold = { prop: 'camera', side: front }; Q.hands[front] = [front * lerp(0.1, 0.1, k) * S, lerp(0.25, -0.1, k) * S]; Q.hands[back] = [front * lerp(0, 0.06, k) * S, lerp(0.3, -0.08, k) * S]; if (p > 0.5 && p < 0.65) Q.fx.push({ k: 'flash', side: front, p: (p - 0.5) / 0.15 }); break; }
      case 'shoot': { const w2 = holding(st, ['rifle', 'bow', 'gun']) || 'gun'; Q.hold = w2 === st.props.find(x => x === w2) ? null : { prop: w2, side: front };
        if (w2 === 'bow') { const k = p < 0.5 ? io(p / 0.45) : 0; Q.hands[front] = [front * 0.3 * S, -0.02 * S]; Q.hands[back] = [front * lerp(0.28, 0.05, k) * S, -0.02 * S]; if (p >= 0.5) Q.fx.push({ k: 'arrow', side: front, q: (p - 0.5) / 0.5 }); }
        else { const kick = p > 0.3 && p < 0.5 ? Math.sin((p - 0.3) / 0.2 * Math.PI) : 0; Q.hands[front] = [front * (w2 === 'rifle' ? 0.32 : 0.3) * S - front * kick * 24, -kick * 20]; if (w2 === 'rifle') Q.hands[back] = [front * 0.12 * S, 0.04 * S]; Q.aimUp = -kick * 0.35; if (p > 0.3 && p < 0.6) Q.fx.push({ k: 'bang', side: front, p: (p - 0.3) / 0.3, len: w2 === 'rifle' ? 150 : 80 }); if (A0.tx != null && p > 0.3 && p < 0.42) Q.fx.push({ k: 'tracer', q: (p - 0.3) / 0.12, tx: A0.tx + (A0.miss ? front * 0.5 * S : 0), len: w2 === 'rifle' ? 150 : 80 }); Q.fast = p > 0.3 && p < 0.4; }
        Q.mood = 'angry'; break; }
      case 'swing': { const w2 = holding(st, ['sword', 'axe', 'spear']) || 'sword'; if (!st.props.includes(w2)) Q.hold = { prop: w2, side: front }; const k = p < 0.35 ? io(p / 0.35) : p < 0.5 ? 1 - io((p - 0.35) / 0.15) * 2 : -1 + io((p - 0.5) / 0.5); Q.bladeA = lerp(-1.6, 1.0, cl((1 - k) / 2, 0, 1)); Q.hands[front] = [front * lerp(0.2, 0.05, cl(k, 0, 1)) * S, lerp(0.05, -0.25, cl(k, 0, 1)) * S]; if (p > 0.35 && p < 0.6) Q.fx.push({ k: 'slash', side: front, p: (p - 0.35) / 0.25 }); Q.mood = 'angry'; Q.fast = p > 0.35 && p < 0.5; break; }
      case 'block': { const k = lift(p, 0.15, 0.85); if (st.props.includes('shield')) { Q.shieldFront = k; Q.hands[back] = [front * lerp(-0.07, 0.2, k) * S, lerp(0.31, 0.02, k) * S]; } else [-1, 1].forEach(sd => Q.hands[sd] = [front * 0.14 * S * k + sd * 0.03 * S, lerp(0.31, -0.08, k) * S]); Q.lean = -0.3 * k; Q.mood = 'scared'; break; }
      case 'jump': Q.hop = Math.sin(p * Math.PI) * 90; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.14 * S, lerp(0.3, -0.2, sn) * S]); Q.kick = sn * 20; break;
      case 'dance': { const b2 = Math.sin(e * 8); Q.hop = Math.abs(b2) * 16; Q.hands[1] = [0.16 * S, (b2 > 0 ? -0.25 : 0.1) * S]; Q.hands[-1] = [-0.16 * S, (b2 > 0 ? 0.1 : -0.25) * S]; Q.tilt = b2 * 0.15; Q.mood = 'happy'; Q.emote = { k: 'notes' }; Q.dir = Math.sin(e * 4) > 0 ? 1 : -1; break; }
      case 'sit': Q.sit = io(p); break;
      case 'stand': Q.sit = (st.sit ? 1 : 0) * (1 - io(p)); Q.kneel = A0.from && st.kneel ? 1 - io(p) : 0; Q.eyes = null; Q.emote = null; Q.tilt = 0; break;
      case 'kneel': Q.kneel = io(p); break;
      case 'lie': case 'fall': Q.rot = g === 'fall' ? out3(cl(p / 0.45, 0, 1)) : io(p); Q.fallBack = true; if (g === 'fall' && p > 0.4 && p < 0.9) Q.emote = { k: 'stars', p }; Q.mood = g === 'fall' ? 'shock' : 'ok'; break;
      case 'getup': Q.rot = 1 - io(p); break;
      case 'hide': { const k = lift(p, 0.15, 0.85); Q.lower = k; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.06 * S, lerp(0.31, -0.12, k) * S]); Q.mood = 'scared'; Q.emote = k > 0.7 ? { k: 'sweat', e } : null; Q.hdx = Math.sin(e * 30) * 2 * k; break; }
      case 'sleep': { const k = io(Math.min(1, p * 2)); Q.tilt = 0.35 * Q.dir * k; Q.hdy = 8 * k; Q.eyes = p > 0.3 ? 'shut' : null; Q.emote = p > 0.4 ? { k: 'zzz' } : null; break; }
      case 'wake': Q.eyes = null; Q.emote = p < 0.6 ? { k: '!' } : null; Q.hop = Math.max(0, Math.sin(p * Math.PI * 2)) * 14; Q.tilt = 0; Q.hdy = 0; Q.mood = 'shock'; break;
      case 'watch': { const k = lift(p, 0.2, 0.85); Q.hands[front] = [front * lerp(0.07, 0.12, k) * S, lerp(0.31, 0.0, k) * S]; Q.tilt = 0.12 * k * Q.dir; Q.emote = k > 0.6 ? { k: 'clock' } : null; break; }
      case 'wait': Q.tap = Math.max(0, Math.sin(e * 8)) * 10; Q.emote = { k: '...' }; break;
      case 'cry': Q.mood = 'sad'; Q.hands[front] = [front * 0.04 * S, -0.08 * S]; Q.tilt = 0.12 * Q.dir; Q.emote = { k: 'tears', e }; break;
      case 'angry': Q.mood = 'angry'; Q.hands[-1] = [-0.13 * S, 0.12 * S]; Q.hands[1] = [0.13 * S, 0.12 * S]; Q.hdx = Math.sin(e * 30) * 2; Q.emote = { k: 'steam', e }; break;
      case 'laugh': Q.mood = 'happy'; Q.hop = Math.abs(Math.sin(e * 12)) * 7; Q.hands[-1] = [-0.06 * S, 0.17 * S]; Q.hands[1] = [0.06 * S, 0.17 * S]; Q.emote = { k: 'haha' }; break;
      case 'confused': Q.hands[front] = [front * 0.08 * S, -0.17 * S + Math.sin(e * 14) * 4]; Q.tilt = -0.18 * Q.dir; Q.emote = { k: '?' }; break;
      case 'shocked': { const k = out3(Math.min(1, p * 4)); Q.mood = 'shock'; Q.hop = Math.sin(Math.min(1, p * 3) * Math.PI) * 22; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.19 * S * k + sd * 0.07 * S * (1 - k), lerp(0.31, -0.08, k) * S]); Q.emote = { k: '!' }; break; }
      case 'scared': Q.mood = 'scared'; Q.hdx = Math.sin(e * 40) * 3; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.05 * S, -0.02 * S]); Q.lower = 0.2; Q.emote = { k: 'sweat', e }; break;
      case 'love': Q.mood = 'happy'; Q.hands[-1] = [-0.03 * S, 0.05 * S]; Q.hands[1] = [0.03 * S, 0.05 * S]; Q.emote = { k: 'hearts' }; Q.tilt = Math.sin(e * 3) * 0.1; break;
      case 'happy': Q.mood = 'happy'; break; case 'sad': Q.mood = 'sad'; Q.hdy = 5 * io(p); break;
      case 'stamp': { const k = p < 0.45 ? io(p / 0.45) : p < 0.55 ? 1 - io((p - 0.45) / 0.1) : 0; Q.hands[front] = [front * 0.17 * S, p < 0.45 ? lerp(0.25, -0.2, k) * S : 0.2 * S]; if (p >= 0.55 && p < 0.85) Q.fx.push({ k: 'stamp', side: front, p: (p - 0.55) / 0.3 }); break; }
      case 'turn': Q.dir = p < 0.5 ? A0.from.dir : -A0.from.dir; break;
      case 'dive': case 'cannonball': { const x0 = st.walkFrom, x1 = st.walkTo, run = 0.3, cb = g === 'cannonball'; Q.eyes = null; Q.rot = 0;
        if (p < run) { const q = p / run, edge = lerp(x0, water ? (x1 > x0 ? water.x0 - 20 : water.x1 + 20) : x0, 1); Q.x = lerp(x0, edge, io(q)); Q.dir = x1 >= x0 ? 1 : -1; if (Math.abs(edge - x0) > 5) { Q.walk = Math.abs(Q.x - x0) / (0.12 * S) * Math.PI * 0.5; Q.bob = -Math.abs(Math.sin(Q.walk)) * 6; } }
        else { const q = (p - run) / (1 - run), edge = water ? (x1 > x0 ? water.x0 - 20 : water.x1 + 20) : x0, air = cl(q / 0.5, 0, 1); Q.dir = x1 >= x0 ? 1 : -1; Q.x = lerp(edge, x1, air);
          if (q < 0.5) { Q.hop = Math.sin(air * Math.PI) * 260 - air * air * 120; if (cb) { Q.tuck = out3(cl(air * 3, 0, 1)); Q.hands[1] = [0.08 * S * Q.dir, 0.12 * S]; Q.hands[-1] = [0.12 * S * Q.dir, 0.1 * S]; Q.spin = air * 0.6; } else { Q.diveA = air * 2.2; [-1, 1].forEach(sd => Q.hands[sd] = [Q.dir * 0.05 * S, -0.3 * S]); } Q.fast = true; }
          else { Q.inWater = true; const sub = (q - 0.5) / 0.5; Q.hidden = sub < 0.5; Q.hop = -(0.58 * S + 14) - (1 - sub) * 120; Q.swimming = true; Q.noLegs = true; Q.mood = 'happy'; }
          if (q > 0.45 && q < 1) Q.fx.push({ k: 'splash', x: x1, big: cb, p: (q - 0.45) / 0.55 }); }
        break; }
      // ---- Rough gestures ----
      case 'finger': case 'vsign': { const k = io(cl(p / 0.35, 0, 1)) * (p > 0.88 ? 1 - io((p - 0.88) / 0.12) : 1), jab = g === 'vsign' ? Math.abs(Math.sin(e * 9)) * 0.06 * k : Math.max(0, Math.sin(e * 6)) * 0.03 * k; const H1 = [front * lerp(0.07, 0.29 + jab * 0.5, k) * S, lerp(0.31, -0.07 - jab, k) * S];
        Q.hands[front] = H1; Q.fingers = { [front]: g === 'vsign' ? 'v' : 'mid' }; if (a.both) { Q.hands[front] = [front * lerp(0.07, 0.26 + jab, k) * S, lerp(0.31, -0.06 - jab, k) * S]; Q.hands[back] = [front * lerp(-0.07, 0.1 + jab, k) * S, lerp(0.31, -0.2 - jab, k) * S]; Q.fingers[back] = Q.fingers[front]; } Q.mood = 'angry'; Q.rudeAt = 'hands'; Q.rudeK = k; break; }
      case 'wanker': { const k = lift(p, 0.15, 0.88), sh2 = Math.sin(e * 22) * 0.05 * k; Q.hands[front] = [front * lerp(0.07, 0.17, k) * S, lerp(0.31, 0.02 + sh2, k) * S]; Q.fingers = { [front]: 'fist' }; Q.mood = 'happy'; Q.tilt = 0.08 * k * Q.dir; Q.rudeAt = 'hands'; Q.rudeK = k; break; }
      case 'chinflick': { const k = p < 0.45 ? io(p / 0.45) : 1, f2 = p > 0.45 && p < 0.75 ? io((p - 0.45) / 0.3) : p >= 0.75 ? 1 - io((p - 0.75) / 0.25) : 0; Q.hands[front] = [front * lerp(0.07, 0.05 + 0.2 * f2, k) * S, lerp(0.31, -0.16 - 0.04 * f2, k) * S]; Q.fingers = { [front]: 'flat' }; Q.tilt = -0.15 * k * Q.dir; Q.mood = 'angry'; break; }
      case 'moon': { const k = lift(p, 0.2, 0.85), w2 = Math.sin(e * 7) * 0.12 * k; Q.dir = -A0.from.dir; Q.lean = 2.6 * k; Q.moon = k; Q.hdy = 14 * k; [-1, 1].forEach(sd => Q.hands[sd] = [Q.dir * 0.12 * S, lerp(0.31, 0.38, k) * S]); Q.tilt = w2; Q.mood = 'happy'; Q.rudeAt = 'bum'; Q.rudeK = k; break; }
      case 'pish': { const k = lift(p, 0.12, 0.9); [-1, 1].forEach(sd => Q.hands[sd] = [front * 0.06 * S, lerp(0.31, 0.36, k) * S]); Q.hdy = -4 * k; Q.tilt = -0.12 * k * Q.dir; Q.eyes = k > 0.5 ? 'shut' : null; Q.mood = 'happy'; if (k > 0.5) Q.fx.push({ k: 'pish', p: (p - 0.12) / 0.78, e }); Q.rudeAt = 'crotch'; Q.rudeK = k; break; }
      case 'fart': { const k = lift(p, 0.2, 0.8); Q.lean = 0.35 * k; Q.kick = 8 * k; Q.mood = 'happy'; Q.eyes = k > 0.6 ? 'shut' : null; if (p > 0.3) Q.fx.push({ k: 'stink', p: (p - 0.3) / 0.7, word: 'PARP!' }); break; }
      case 'belch': { const k = lift(p, 0.2, 0.7); Q.hdy = -8 * k; Q.tilt = -0.25 * k * Q.dir; Q.hands[back] = [front * 0.1 * S, 0.22 * S]; Q.talk = k > 0.5; if (p > 0.3 && p < 0.9) Q.fx.push({ k: 'word', s: 'BRAAAP!', p: (p - 0.3) / 0.6, at: 'mouth', col: CH.green }); break; }
      case 'spit': { const j = p < 0.45 ? io(p / 0.45) : 1 - io((p - 0.45) / 0.55); Q.hdx = Q.dir * 10 * j; Q.lean = 0.35 * j; Q.hdy = -6 * (p < 0.45 ? j : 0); Q.mood = 'angry'; if (p > 0.45) Q.fx.push({ k: 'gob', q: (p - 0.45) / 0.55, far: a.to ? 0.62 * S : 280 }); break; }
      case 'pick': { const k = lift(p, 0.15, 0.7), wig = Math.sin(e * 18) * 4 * k; Q.hands[front] = [front * lerp(0.07, 0.11, k) * S + wig, lerp(0.31, -0.15, k) * S]; Q.fingers = { [front]: k > 0.5 ? 'mid' : null }; Q.eyes = k > 0.7 ? 'shut' : null; if (p > 0.72) Q.fx.push({ k: 'bogey', q: (p - 0.72) / 0.28 }); break; }
      case 'scratch': { const k = lift(p, 0.15, 0.85), wig = Math.sin(e * 20) * 0.03 * k; Q.hands[back] = [back * 0.1 * S, lerp(0.31, 0.27 + wig, k) * S]; Q.eyes = k > 0.5 ? 'shut' : null; Q.mood = 'happy'; Q.tilt = 0.06 * Math.sin(e * 5) * k; break; }
      case 'passout': Q.rot = io(cl(p / 0.6, 0, 1)); Q.fallBack = true; Q.eyes = p > 0.4 ? 'shut' : null; Q.emote = p > 0.6 ? { k: 'zzz' } : null; Q.tilt = Math.sin(e * 6) * 0.1 * (1 - p); break;
      case 'knockout': Q.rot = out3(cl(p / 0.45, 0, 1)); Q.fallBack = true; Q.eyes = p > 0.2 ? 'x' : null; Q.mood = 'shock'; if (p < 0.6) Q.emote = { k: 'stars', p }; if (p > 0.1 && p < 0.9) Q.fx.push({ k: 'tooth', q: (p - 0.1) / 0.8 }); break;
      // ---- Rough fighting: p here is after the walk up, so impact is at HIT[g].imp ----
      case 'slap': { const I = HIT.slap.imp, k = p < I ? io(p / I) : 1, sw = p < I ? 0 : io(cl((p - I) / 0.12, 0, 1)); Q.hands[front] = sw ? [front * lerp(0.05, 0.34, sw) * S, lerp(-0.2, -0.1, sw) * S] : [front * lerp(0.07, 0.02, k) * S, lerp(0.31, -0.2, k) * S]; Q.fingers = { [front]: 'flat' }; Q.lean = 0.3 * sw; Q.mood = 'angry'; Q.fast = sw > 0 && sw < 1; break; }
      case 'headbutt': { const I = HIT.headbutt.imp, back2 = p < I ? io(p / I) : 0, fw = p >= I ? (p < I + 0.12 ? io((p - I) / 0.12) : 1 - io(cl((p - I - 0.12) / 0.4, 0, 1))) : 0; Q.lean = -0.5 * back2 + 1.3 * fw; Q.hdx = Q.dir * 16 * fw; Q.x += Q.dir * 30 * fw; Q.mood = 'angry'; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.12 * S, 0.18 * S]); if (p >= I && p < I + 0.35) Q.fx.push({ k: 'word', s: 'BOSH!', p: (p - I) / 0.35, at: 'front', col: CH.yellow }); Q.fast = fw > 0 && fw < 1; break; }
      case 'haymaker': { const I = HIT.haymaker.imp, wind = p < I ? io(p / I) : 0, sw = p >= I ? io(cl((p - I) / 0.14, 0, 1)) : 0, rec = p > I + 0.3 ? io((p - I - 0.3) / (0.7 - I)) : 0; Q.hands[front] = sw ? [front * lerp(-0.2, 0.38, sw) * S * (1 - rec * 0.7), lerp(-0.18, -0.02, sw) * S + rec * 0.3 * S] : [front * lerp(0.07, -0.22, wind) * S, lerp(0.31, -0.18, wind) * S]; Q.fingers = { [front]: 'fist' }; Q.lean = -0.3 * wind + 0.6 * sw * (1 - rec); Q.tilt = -0.1 * wind * Q.dir; Q.mood = 'angry'; if (p >= I && p < I + 0.3) Q.fx.push({ k: 'pow', side: front, p: (p - I) / 0.3 }); Q.fast = sw > 0 && sw < 1; break; }
      case 'uppercut': { const I = HIT.uppercut.imp, cr = p < I ? io(p / I) : 1 - io(cl((p - I) / 0.15, 0, 1)), up = p >= I ? io(cl((p - I) / 0.12, 0, 1)) * (1 - io(cl((p - I - 0.3) / 0.4, 0, 1))) : 0; Q.lower = 0.45 * cr; Q.hands[front] = up ? [front * 0.2 * S, lerp(0.2, -0.36, up) * S] : [front * 0.1 * S, lerp(0.31, 0.22, cr) * S]; Q.fingers = { [front]: 'fist' }; Q.hop = 18 * up; Q.mood = 'angry'; if (p >= I && p < I + 0.3) Q.fx.push({ k: 'pow', side: front, p: (p - I) / 0.3 }); Q.fast = up > 0 && up < 1; break; }
      case 'kickbaws': { const I = HIT.kickbaws.imp, ch2 = p < I ? io(p / I) * 0.4 : 0, kk = p >= I ? (p < I + 0.1 ? io((p - I) / 0.1) : 1 - io(cl((p - I - 0.15) / 0.3, 0, 1))) : 0; Q.kickF = Math.max(ch2, kk); Q.lean = -0.35 * Q.kickF; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.16 * S, 0.1 * S]); Q.mood = 'angry'; Q.fast = kk > 0 && kk < 1; break; }
      case 'smash': { const I = HIT.smash.imp, pr = a.prop === 'chair' ? 'chair' : 'bottle', up = p < I ? io(p / I) : 0, dn = p >= I ? io(cl((p - I) / 0.08, 0, 1)) : 0; if (p < I + 0.04) Q.hold = { prop: pr, side: front, a: -1.2 + dn * 1.6 }; Q.hands[front] = [front * lerp(0.1, 0.3, dn) * S, lerp(lerp(0.2, -0.38, up), -0.08, dn) * S]; Q.hands[back] = Q.hands[front].slice(); Q.lean = -0.2 * up + 0.5 * dn; Q.mood = 'angry'; Q.fast = dn > 0 && dn < 1; break; }
      case 'chuck': { const I = HIT.chuck.imp, gr2 = p < 0.25 ? io(p / 0.25) : 1, lf = p >= 0.25 && p < I ? io((p - 0.25) / (I - 0.25)) : p >= I ? 1 - io(cl((p - I) / 0.3, 0, 1)) : 0; [-1, 1].forEach(sd => Q.hands[sd] = [front * lerp(0.14, 0.24, gr2) * S + sd * 4, lerp(lerp(0.31, 0.12, gr2), -0.28, lf) * S]); Q.lean = 0.5 * gr2 * (1 - lf) - 0.3 * lf; Q.mood = 'angry'; if (p > 0.25 && p < I) Q.emote = { k: 'words', s: 'OOT!', p: (p - 0.25) / (I - 0.25), col: CH.red }; break; }
      case 'stomp': { const k = lift(p, 0.06, 0.92), st2 = Math.abs(Math.sin(e * 9)); Q.kick = 50 * st2 * k; Q.lean = 0.25 * k; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.14 * S, 0.12 * S]); Q.mood = 'angry'; if (st2 < 0.25 && k > 0.5) Q.fx.push({ k: 'dust', p: st2 * 4 }); Q.fast = true; break; }
      case 'brawl': { const inC = p > 0.04 && p < 0.94; if (inC) { Q.hidden = true; Q.fx.push({ k: 'brawl', e, p, cx: Q.x + Q.dir * 0.15 * S }); } else { Q.mood = p > 0.9 ? 'happy' : 'angry'; if (p >= 0.94) { const c2 = Math.abs(Math.sin(e * 10)); [-1, 1].forEach(sd => Q.hands[sd] = [Q.dir * 0.12 * S + sd * 0.04 * S * c2, 0.08 * S]); } } break; }
      // ---- On the receiving end ----
      case 'hit_punched': { const aw = st.hitAway || -Q.dir, k = sn; Q.x += aw * 24 * k; Q.lean = -0.5 * k; Q.hdx = aw * 10 * k; Q.mood = 'shock'; Q.eyes = k > 0.5 ? 'shut' : null; if (p < 0.7) Q.emote = { k: 'stars', p }; Q.blackEye = p > 0.15; if (p < 0.4) Q.fx.push({ k: 'splat', p: p / 0.4 }); break; }
      case 'hit_slapped': { const aw = st.hitAway || -Q.dir, k = p < 0.15 ? io(p / 0.15) : 1 - io((p - 0.15) / 0.85); Q.hdx = aw * 22 * k; Q.tilt = aw * 0.3 * k; Q.mood = 'shock'; Q.cheek = 1; if (p < 0.6) Q.fx.push({ k: 'word', s: 'SLAP!', p: p / 0.6, at: 'head', col: CH.white }); break; }
      case 'hit_butted': { const aw = st.hitAway || -Q.dir, rk = p < 0.35 ? out3(p / 0.35) : 1, fall = p > 0.45 ? io((p - 0.45) / 0.55) : 0; Q.x += aw * 40 * rk; Q.lean = -0.6 * rk * (1 - fall); Q.tilt = Math.sin(e * 14) * 0.15 * (1 - fall); Q.rot = fall; Q.fallBack = true; Q.eyes = fall > 0.3 ? 'x' : 'shut'; Q.emote = { k: 'stars', p }; Q.blackEye = true; if (p < 0.35) Q.fx.push({ k: 'splat', p: p / 0.35 }); break; }
      case 'hit_decked': { const aw = st.hitAway || -Q.dir, q = io(cl(p / 0.55, 0, 1)); Q.x += aw * 170 * q; Q.hop = Math.sin(q * Math.PI) * 70; Q.rot = out3(cl(p / 0.5, 0, 1)); Q.fallBack = true; Q.eyes = 'x'; Q.mood = 'shock'; Q.blackEye = true; if (p < 0.8) Q.fx.push({ k: 'tooth', q: p / 0.8, away: aw }); if (p < 0.35) Q.fx.push({ k: 'splat', p: p / 0.35 }); Q.fast = p < 0.5; break; }
      case 'hit_lifted': { const up = p < 0.35 ? out3(p / 0.35) : 1 - io(cl((p - 0.35) / 0.3, 0, 1)); Q.hop = 140 * up; Q.rot = p > 0.35 ? io(cl((p - 0.35) / 0.35, 0, 1)) : 0; Q.fallBack = true; Q.eyes = 'x'; Q.mood = 'shock'; if (p < 0.85) Q.fx.push({ k: 'tooth', q: p / 0.85, away: st.hitAway || -Q.dir }); Q.emote = { k: 'stars', p }; Q.fast = true; break; }
      case 'hit_baws': { const k = p < 0.12 ? out3(p / 0.12) : 1; Q.lower = 0.6 * k; Q.lean = 1.0 * k; [-1, 1].forEach(sd => Q.hands[sd] = [Q.dir * 0.04 * S + sd * 3, 0.37 * S]); Q.kneel = p > 0.55 ? io((p - 0.55) / 0.45) : 0; Q.eyes = 'shut'; Q.mood = 'shock'; Q.hop = p < 0.25 ? Math.sin(p / 0.25 * Math.PI) * 30 : 0; if (p < 0.6) Q.fx.push({ k: 'word', s: 'OYAH!', p: p / 0.6, at: 'head', col: CH.white }); break; }
      case 'hit_smashed': { const fall = p > 0.35 ? io((p - 0.35) / 0.65) : 0; Q.rot = fall; Q.fallBack = true; Q.tilt = Math.sin(e * 16) * 0.12 * (1 - fall); Q.eyes = 'x'; Q.mood = 'shock'; Q.emote = { k: 'stars', p }; if (p < 0.5) Q.fx.push({ k: 'shards', p: p / 0.5, chair: a.src === 'chair' }); if (p < 0.3) Q.fx.push({ k: 'splat', p: p / 0.3 }); break; }
      case 'hit_chucked': { const aw = st.hitAway || -Q.dir, fl = io(cl(p / 0.8, 0, 1)); Q.x += aw * 560 * fl; Q.hop = Math.sin(fl * Math.PI) * 300 + (p < 0.1 ? 0 : 0); Q.spin = fl * 5.5; Q.rot = p > 0.8 ? 1 : 0; Q.fallBack = true; Q.eyes = 'x'; Q.mood = 'shock'; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.18 * S, -0.2 * S]); Q.fast = p < 0.85; if (p > 0.78 && p < 1) Q.fx.push({ k: 'dust', p: (p - 0.78) / 0.22 }); break; }
      case 'hit_stomped': { const j = Math.abs(Math.sin(e * 9)); Q.rot = 1; Q.fallBack = true; Q.hop = 6 * (1 - j); Q.eyes = 'x'; Q.mood = 'shock'; Q.emote = { k: 'stars', p }; Q.blackEye = true; break; }
      case 'hit_brawled': Q.hidden = p < 0.97; break;
      // Shot or cut down: jolt, clutch it, stagger and drop dead (the ghost and the X eyes carry on once they are down)
      case 'hit_shot': case 'hit_slashed': { const aw = st.hitAway || -Q.dir, j = p < 0.1 ? out3(p / 0.1) : 1 - io(cl((p - 0.1) / 0.3, 0, 1)) * 0.6, fall = p > 0.42 ? io(cl((p - 0.42) / 0.33, 0, 1)) : 0;
        Q.x += aw * (36 * j + 30 * fall); Q.lean = -0.55 * j * (1 - fall); Q.hdx = aw * 8 * j; Q.mood = 'shock'; Q.eyes = p > 0.6 ? 'x' : null; Q.tongue = p > 0.7;
        if (p > 0.06 && fall < 0.6) [-1, 1].forEach(sd => Q.hands[sd] = [Q.dir * 0.05 * S + sd * 8, 0.1 * S]); if (p > 0.15 && p < 0.42) { Q.x += Math.sin(e * 9) * 14; Q.tilt = Math.sin(e * 7) * 0.15; }
        Q.rot = fall; Q.fallBack = true; Q.wound = g.slice(4); if (p < 0.4) Q.fx.push({ k: 'wound', p: p / 0.4, cut: g === 'hit_slashed', away: aw }); if (p < 0.3) Q.emote = { k: '!' }; Q.fast = p < 0.12 || (p > 0.42 && p < 0.7); break; }
      // Wounded: jolt, grab the arm, hop about, stay on their feet
      case 'hit_winged': case 'hit_cut': { const aw = st.hitAway || -Q.dir, j = p < 0.1 ? out3(p / 0.1) : 1 - io(cl((p - 0.1) / 0.5, 0, 1)), arm = Q.dir;
        Q.x += aw * 30 * j + (p > 0.15 && p < 0.8 ? Math.sin(e * 8) * 12 : 0); Q.lean = -0.4 * j; Q.mood = p < 0.4 ? 'shock' : 'angry'; Q.hands[-arm] = [arm * 0.1 * S, -0.02 * S]; Q.hands[arm] = [arm * 0.1 * S, 0.05 * S];
        if (p > 0.15 && p < 0.8) Q.hop = Math.abs(Math.sin(e * 8)) * 18; Q.wound = g.slice(4); if (p < 0.4) Q.fx.push({ k: 'wound', p: p / 0.4, cut: g === 'hit_cut', away: aw, arm: true }); if (p > 0.2 && p < 0.75) Q.emote = { k: 'words', s: g === 'hit_cut' ? 'YA BAS!' : 'OW!', p: (p - 0.2) / 0.55 }; Q.fast = p < 0.12; break; }
      // Missed: flinch and duck, then look shocked
      case 'hit_missed': case 'hit_dodged': { const aw = st.hitAway || -Q.dir, d2 = p < 0.15 ? out3(p / 0.15) : 1 - io(cl((p - 0.15) / 0.6, 0, 1)); Q.lower = (g === 'hit_dodged' ? 0.5 : 0.25) * d2; Q.lean = 0.3 * d2; Q.x += aw * 10 * d2;
        [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.08 * S, lerp(0.31, -0.2, d2) * S]); Q.mood = 'shock'; Q.emote = { k: '!' }; if (g === 'hit_missed' && p < 0.5) Q.fx.push({ k: 'ricochet', p: p / 0.5, away: aw }); break; }
      case 'hit_spat': { const k = p > 0.3 ? lift((p - 0.3) / 0.7, 0.2, 0.8) : 0; Q.hands[front] = [front * lerp(0.07, 0.06, k) * S + Math.sin(e * 14) * 5 * k, lerp(0.31, -0.12, k) * S]; Q.mood = 'angry'; if (p < 0.4) Q.fx.push({ k: 'word', s: 'EUGH!', p: p / 0.4, at: 'head', col: CH.green }); break; }
      case 'climbout': { const x0 = st.walkFrom, x1 = st.walkTo; Q.x = lerp(x0, x1, io(p)); Q.dir = x1 >= x0 ? 1 : -1; Q.inWater = p < 0.7; Q.swimming = p < 0.6; Q.noLegs = p < 0.6; Q.hop = -(0.58 * S + 14) * (1 - io(cl(p / 0.7, 0, 1))); [-1, 1].forEach(sd => Q.hands[sd] = [Q.dir * 0.2 * S, lerp(-0.2, 0.31, io(p)) * S]); if (p > 0.6) Q.fx.push({ k: 'drips', p: (p - 0.6) / 0.4 }); break; }
    }
    // Aimed at a screen: rude ones face it (the moon faces away), and thrown things fly to it
    if (SCRALIAS[a.k]) { const q = scrFor(P.sc, a, st.x); if (q) { const r = scrRect(q), sd = r.cx > Q.x ? 1 : -1; if (a.k === 'moontv') Q.dir = -sd; else if (g !== 'pish' || p < 0.05) Q.dir = sd;
      if (a.k === 'throwtv') Q.fx.forEach(f => { if (f.k === 'fly') { f.dist = Math.max(80, Math.abs(r.cx - Q.x) - 0.2 * S); f.endY = r.cy; } }); } }
    return Q;
  }

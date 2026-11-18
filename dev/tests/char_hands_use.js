// Run with runjs.py: how the two hands share the work over a real recording (dev/tmp_me.wav, what was heard in it in
// dev/tmp_heard_me.json, his puppet and hand sheet), for several throws of the planner's dice (cfg.seed).
// For each: the share of the talking time with only the left hand's picture up, only the right, both, neither; how many times
// each hand comes up; the shortest time a hand drawing shows; the longest stretch of talking with both hands still; how fast
// a resting hand moves; jumps between frames. `bad` lists anything outside what reads as natural (he found the right hand
// lying still "very robotic", and hands up all the time unnatural).
// arg: { wav, heard, hands: 'natural', seeds: 6, noSheet: false }
async (arg) => {
  arg = arg || {}; let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet')); let sheet = false; if (!arg.noSheet) try { rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob()); sheet = true; } catch (e) { }
  const voice = await CutMedia.importFile(new File([await (await fetch(arg.wav || '/tmp_me.wav')).blob()], 'voice.wav', { type: 'audio/wav' })), heard = await (await fetch(arg.heard || '/tmp_heard_me.json')).json(); Listen.keepHeard(voice.id, heard.words, 0, heard.text);
  const out = { sheet, runs: [], bad: [] }, hands = arg.hands || 'natural';
  for (let seed = 1; seed <= (arg.seeds || 6); seed++) {
    const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: heard.text, seed, hands }); await Character.prepare(c);
    const A = Character.syncOf(c), d = Character.duration(c), p = Character.perfOf(c, A, rig, d), hh = rig.pivot.headH, F = 30, n = Math.floor(d * F), env = A.env, fps = A.fps;
    let talk = 0, Lup = 0, Rup = 0, both = 0, none = 0, prev = null, still = 0, worst = 0, restN = 0, restV = 0; const jumps = [], rises = { L: 0, R: 0 }, run = { L: 0, R: 0 }; let short = 9, flatR = 0, flatMax = 0, bare = 0, bareTalk = 0, bareMax = 0;
    for (let i = 0; i < n; i++) { const t = i / F, P = Character.poseAt(c, A, rig, p, t), sp = (env[Math.min(env.length - 1, Math.round(t * fps))] || 0) > 0.15, cur = {}; let vmax = 0;
      ['L', 'R'].forEach(sd => { const a = P.arms[sd]; cur[sd] = [a.dx / hh, a.dy / hh, a.art || '']; if (!prev) return; const b = prev[sd], v = Math.hypot(cur[sd][0] - b[0], cur[sd][1] - b[1]); vmax = Math.max(vmax, v * F);
        if (v > 0.09 && cur[sd][2] === b[2]) jumps.push([sd, +t.toFixed(2), +v.toFixed(3)]); if (cur[sd][2] && !b[2]) rises[sd]++; if (cur[sd][2] !== b[2]) { if (run[sd] > 0 && i > run[sd]) short = Math.min(short, (i - run[sd]) / F); run[sd] = i; } });
      if (prev && !cur.R[2]) { restN++; restV += Math.hypot(cur.R[0] - prev.R[0], cur.R[1] - prev.R[1]) * F; }
      if (sp || still > 0) { if (prev && vmax < 0.04 && !cur.L[2] && !cur.R[2]) still++; else still = 0; worst = Math.max(worst, still); }
      if (cur.R[2]) flatR = 0; else { flatR++; flatMax = Math.max(flatMax, flatR); }
      if (cur.R[2] || cur.L[2]) bare = bareTalk = 0; else { bare++; if (sp) bareTalk++; bareMax = Math.max(bareMax, bareTalk); }   // talking done with both hands flat, since a hand was last up
      prev = cur; if (!sp) continue; talk++; const l = !!cur.L[2], r = !!cur.R[2]; if (l && r) both++; else if (l) Lup++; else if (r) Rup++; else none++; }
    const pc = v => Math.round(v / Math.max(1, talk) * 100), r = { seed, left: pc(Lup), right: pc(Rup), both: pc(both), neither: pc(none), rises, shortest: +short.toFixed(2), stillFor: +(worst / F).toFixed(1), rightAtRest: +(restV / Math.max(1, restN)).toFixed(3), rightFlatFor: +(flatMax / F).toFixed(1), talkBothFlat: +(bareMax / F).toFixed(1), jumps: jumps.length }; out.runs.push(Object.values(r).map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(' '));
    if (jumps.length) out.bad.push('seed ' + seed + ': ' + jumps.length + ' jumps ' + JSON.stringify(jumps.slice(0, 3)));
    if (short < 0.19) out.bad.push('seed ' + seed + ': a hand drawing shown for ' + short.toFixed(2) + ' s');
    if (hands === 'natural' && sheet) { if (r.right + r.both < 10) out.bad.push('seed ' + seed + ': right hand up for only ' + (r.right + r.both) + ' in a hundred'); if (r.both < 6) out.bad.push('seed ' + seed + ': both hands up for only ' + r.both + ' in a hundred'); if (r.left < 12) out.bad.push('seed ' + seed + ': left hand on its own for only ' + r.left + ' in a hundred'); if (r.neither < 20) out.bad.push('seed ' + seed + ': hands down for only ' + r.neither + ' in a hundred'); if (r.neither > 60) out.bad.push('seed ' + seed + ': hands down for ' + r.neither + ' in a hundred'); if (r.stillFor > 4.5) out.bad.push('seed ' + seed + ': both hands still for ' + r.stillFor + ' s of talking'); if (r.talkBothFlat > 3.2) out.bad.push('seed ' + seed + ': ' + r.talkBothFlat + ' s of talking in a row with both hands flat'); if (r.rightFlatFor > 16) out.bad.push('seed ' + seed + ': the right hand lies flat for ' + r.rightFlatFor + ' s'); if (r.rightAtRest < 0.02) out.bad.push('seed ' + seed + ': the resting right hand barely moves (' + r.rightAtRest + ')'); }
  }
  out.columns = 'seed, % of talking: left only, right only, both, neither; times each hand comes up; shortest drawing (s); longest still stretch while talking (s); resting right hand speed (heads a second); longest the right hand lies flat (s); most talking in a row with both hands flat (s); jumps';
  return out;
}

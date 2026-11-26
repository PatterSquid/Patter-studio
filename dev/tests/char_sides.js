// Run with runjs.py: which hand carries a thought. Reads dev/tmp_puppet.puppet, dev/tmp_hands/sheet.png, a recording and
// what was heard in it (arg: { wav: '/tmp_me.wav', heard: '/tmp_heard_me.json', seeds: 12 }). He said the left hand looks
// correct most of the time, "but sometimes (infrequently and not by a pattern) he would use his right hand and/or both
// hands". Over a dozen takes of the same recording ("Different wee movements"): most thoughts are the left's, a few are
// the right's or both, never the first thought, never two of them close together, and a pointing finger or an offered
// palm is always the left's (the right's would be half hidden behind the microphone). The resting hand never leaves the desk.
async (arg) => {
  arg = arg || {}; let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'Massive.puppet')); rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob());
  const voice = await CutMedia.importFile(new File([await (await fetch(arg.wav || '/tmp_me.wav')).blob()], 'voice.wav', { type: 'audio/wav' }));
  const heard = await (await fetch(arg.heard || '/tmp_heard_me.json')).json(); Listen.keepHeard(voice.id, heard.words, 0);
  const takes = [], bad = []; let left = 0, right = 0, both = 0, restUp = 0;
  for (let seed = 0; seed < (arg.seeds || 12); seed++) { const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: heard.text, seed }); await Character.prepare(c);
    const A = Character.syncOf(c), d = Character.duration(c), p = Character.perfOf(c, A, rig, d), G = p.moves.filter(m => m.kind === 'gesture' && m.plan), talks = G.filter(m => m.k === 'talk').sort((x, y) => x.start - y.start), other = talks.filter(m => m.side !== 'L');
    left += talks.length - other.length; right += other.filter(m => m.side === 'R').length; both += other.filter(m => m.side === 'both').length;
    if (talks.length && talks[0].side !== 'L') bad.push('seed ' + seed + ': the first thought is not the left hand');
    for (let i = 1; i < other.length; i++) if (other[i].start - other[i - 1].end < 6.5) bad.push('seed ' + seed + ': two close together at ' + other[i].start.toFixed(1));
    G.forEach(m => { const g = Character._GEST[m.k]; if (m.side === 'R' && g && g.art && m.k !== 'talk') bad.push('seed ' + seed + ': ' + m.k + ' with the right hand at ' + m.start.toFixed(1)); });
    // while one hand talks alone, the other stays on the desk as it was drawn (it may tap and settle, a few pixels)
    for (const m of talks.filter(q => q.side !== 'both')) { const o = m.side === 'L' ? 'R' : 'L'; if (G.some(q => (q.side === o || q.side === 'both') && q.start < m.end && q.end > m.start)) continue; for (let t = m.start + 0.3; t < m.end - 0.3; t += 0.1) { const a = Character.poseAt(c, A, rig, p, t).arms[o]; if (a.art || a.dy < -0.06 * rig.pivot.headH) { restUp++; break; } } }
    takes.push(talks.map(m => m.side[0]).join('')); }
  const all = left + right + both, out = { takes, left, right, both, shareOther: +((right + both) / Math.max(1, all)).toFixed(2), restingHandLeftTheDesk: restUp, bad };
  out.ok = !bad.length && !restUp && right > 0 && both > 0 && out.shareOther >= 0.1 && out.shareOther <= 0.4;
  return out;
}

// Run with runjs.py (reads dev/tmp_puppet.puppet and dev/tmp_voice.wav): tracks every continuous part of the
// pose frame by frame at 60 fps and lists jumps bigger than a smooth motion makes. Discrete swaps (mouth, views, hands) are
// left out: they swap like Character Animator's. Brows may move a little faster than the rest: a brow flash on a
// stressed word goes up in about a tenth of a second.
async () => {
  const pf = new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'Massive.puppet'), { rig } = await Puppet.importFile(pf);
  const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice.wav')).blob()], 'voice.wav', { type: 'audio/wav' }));
  const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice ? voice.id : '', script: "[calm] Right. Here is the thing nobody in Glasgow wanted to hear. [angry] They have only gone and shut the chippy. [look left] On a Friday. [point] You heard me. [surprised] Aye. [shout] Unbelievable.", energy: 1.5 });
  await Character.prepare(c); const A = Character.syncOf(c), d = Character.duration(c), p = Character.perfOf(c, A, rig, d), hh = rig.pivot.headH;
  const val = q => ({ hx: q.head[0] / hh, hy: q.head[1] / hh, hr: q.head[2] * 4, lean: q.head[3] * 4, bLy: q.brow.L[1], bRy: q.brow.R[1], bLr: q.brow.L[2], px: q.pupil[0], py: q.pupil[1], aRy: (q.arms.R ? q.arms.R.dy : 0) / hh, aLy: (q.arms.L ? q.arms.L.dy : 0) / hh, aLr: (q.arms.L ? q.arms.L.rot : 0) / 3, body: q.body[0] * 50 });
  let prev = null, prevArt = '', jumps = [], worst = {};
  for (let i = 0; i <= d * 60; i++) { const t = i / 60, P = Character.poseAt(c, A, rig, p, t), q = val(P), art = (P.arms.L && P.arms.L.art) || ''; if (prev) for (const k in q) { if (k === 'aLr' && art !== prevArt) continue;   // a hand's turn belongs to its drawing: it changes with the drawing, like the swap itself
        const dv = Math.abs(q[k] - prev[k]); worst[k] = Math.max(worst[k] || 0, dv); if (dv > (k[0] === 'b' && k[2] === 'y' ? 0.08 : 0.06)) jumps.push([k, +t.toFixed(3), +dv.toFixed(3)]); } prev = q; prevArt = art; }
  Object.keys(worst).forEach(k => worst[k] = +worst[k].toFixed(4));
  return { d: +d.toFixed(2), nods: p.nods.length, phrases: p.phrases.length, glances: p.glances.length, worst, jumps: jumps.slice(0, 30), njumps: jumps.length };
}

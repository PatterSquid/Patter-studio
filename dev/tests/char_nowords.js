// Run with runjs.py (reads dev/tmp_puppet.puppet and dev/tmp_voice.wav): a recording with no script and nothing heard
// (the listening helper is not on the computer). He must still perform it: the mouth opens with the voice, he nods and
// blinks, and his talking hand comes up for the thoughts (stand in words from the lumps of sound).
async () => {
  const { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'Massive.puppet'));
  const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice.wav')).blob()], 'voice.wav', { type: 'audio/wav' }));
  const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: '' }); await Character.prepare(c);
  const A = Character.syncOf(c), d = Character.duration(c), p = Character.perfOf(c, A, rig, d); let open = 0, up = 0, n = 0; const mouths = {};
  for (let t = 0; t < d; t += 1 / 30) { const q = Character.poseAt(c, A, rig, p, t); n++; mouths[q.mouth] = 1; if (q.mouth !== 'Neutral' && q.mouth !== 'M') open++; if (q.arms.L && Math.abs(q.arms.L.dy || 0) > 0.05 * rig.pivot.headH) up++; }
  const out = { d: +d.toFixed(2), words: A.words.length, nods: p.nods.length, mouthOpenShare: +(open / n).toFixed(2), shapes: Object.keys(mouths).length, handUpShare: +(up / n).toFixed(2) };
  out.ok = A.words.length === 0 && p.nods.length > 2 && out.mouthOpenShare > 0.2 && out.shapes >= 4 && out.handUpShare > 0.05;
  return out;
}

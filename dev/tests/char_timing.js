// Run with runjs.py: how the performance sits on the voice. Reads dev/tmp_puppet.puppet, a recording and what was heard in it
// (arg: { wav: '/tmp_me.wav', heard: '/tmp_heard_me.json' }; the heard file is { text, words } as lipsync_heard.py saves it).
// For every nod, brow raise and hand beat: when the finished motion peaks against the stressed syllable it is for.
async (arg) => {
  arg = arg || {}; const pf = new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'Massive.puppet'), { rig } = await Puppet.importFile(pf);
  const voice = await CutMedia.importFile(new File([await (await fetch(arg.wav || '/tmp_me.wav')).blob()], 'voice.wav', { type: 'audio/wav' }));
  const heard = await (await fetch(arg.heard || '/tmp_heard_me.json')).json(); if (arg.pin !== false) Listen.keepHeard(voice.id, heard.words, 0);
  const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: heard.text, energy: arg.energy || 1 });
  await Character.prepare(c); const A = Character.syncOf(c), d = Character.duration(c), p = Character.perfOf(c, A, rig, d), hh = rig.pivot.headH, F = 120, n = Math.floor(d * F);
  const hy = new Float32Array(n), by = new Float32Array(n), ay = new Float32Array(n), ayR = new Float32Array(n), upL = new Uint8Array(n), upR = new Uint8Array(n), mouth = [];
  for (let i = 0; i < n; i++) { const P = Character.poseAt(c, A, rig, p, i / F); hy[i] = P.head[1] / hh; by[i] = (P.brow.L[1] + P.brow.R[1]) / 2; ay[i] = (P.arms.L ? P.arms.L.dy : 0) / hh; ayR[i] = (P.arms.R ? P.arms.R.dy : 0) / hh; upL[i] = P.arms.L && P.arms.L.art ? 1 : 0; upR[i] = P.arms.R && P.arms.R.art ? 1 : 0; }
  const peakNear = (arr, t, lo, hi, sign) => { let b = -1, bv = -1e9; const i0 = Math.max(1, Math.round((t + lo) * F)), i1 = Math.min(n - 2, Math.round((t + hi) * F)); const base = (arr[i0] + arr[i1]) / 2; for (let i = i0; i <= i1; i++) { const v = (arr[i] - base) * sign; if (v > bv && arr[i] * sign >= arr[i - 1] * sign && arr[i] * sign >= arr[i + 1] * sign) { bv = v; b = i; } } return b < 0 ? null : { dt: b / F - t, amp: bv }; };
  const st = a => { a = a.filter(v => v != null).sort((x, y) => x - y); if (!a.length) return null; const q = f => Math.round(a[Math.min(a.length - 1, Math.floor(a.length * f))] * 1000); return { n: a.length, median: q(0.5), p10: q(0.1), p90: q(0.9) }; };
  const nod = p.nods.map(nd => { const r = peakNear(hy, nd.t, -0.2, 0.3, 1); return r && r.amp > 0.002 ? r.dt : null; });
  // where each nod's moment sits in its word (0 the start, 1 the end) and against the loudest moment of that word
  const W = A.words, inWord = [], toLoud = []; p.nods.forEach(nd => { const w = W.find(q => nd.t >= q[0] - 0.02 && nd.t <= q[1] + 0.02); if (!w) { inWord.push(null); return; } inWord.push((nd.t - w[0]) / Math.max(0.03, w[1] - w[0])); let m = -1, at = nd.t; for (let f = Math.floor(w[0] * A.fps); f <= Math.ceil(w[1] * A.fps) && f < A.env.length; f++) if (A.env[f] > m) { m = A.env[f]; at = f / A.fps; } toLoud.push(nd.t - at); });
  const fr = a => { a = a.filter(v => v != null).sort((x, y) => x - y); return a.length ? { n: a.length, median: +a[a.length >> 1].toFixed(2), p10: +a[Math.floor(a.length * 0.1)].toFixed(2), p90: +a[Math.floor(a.length * 0.9)].toFixed(2) } : null; };
  return { dur: +d.toFixed(1), pinned: A.pinned, words: W.length, nods: p.nods.length, accents: A.pros ? A.pros.accents.length : 0,
    nodPeakAfterAccent_ms: st(nod), nodMomentInWord: fr(inWord), nodMomentToLoudestOfWord_ms: st(toLoud), nodsOutsideAnyWord: inWord.filter(v => v == null).length,
    // the hands beat on their own list of stresses (p.hbeats): each raised hand's low point against the stress it is for
    handBeats: (p.hbeats || p.nods).length,
    handBeatPeakAfterAccent_ms: st((p.hbeats || p.nods).map(nd => { const i = Math.round(nd.t * F); if (!upL[i]) return null; const r = peakNear(ay, nd.t, -0.2, 0.3, 1); return r && r.amp > 0.004 ? r.dt : null; })),
    rightHandBeatPeakAfterAccent_ms: st((p.hbeats || p.nods).map(nd => { const i = Math.round(nd.t * F); if (!upR[i]) return null; const r = peakNear(ayR, nd.t, -0.2, 0.3, 1); return r && r.amp > 0.004 ? r.dt : null; })) };
}

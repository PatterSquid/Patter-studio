// Run with runjs.py (reads dev/tmp_puppet.puppet and dev/tmp_voice.wav): the first frames of an export of his character
// must be drawn the way every later frame is. He is drawn from copies of his pictures made to size in the background;
// a frame made before they arrive is drawn from the full pictures and its outlines differ by a hair (Puppet.steady
// makes an export wait). Exports the first frames with the helpers and without, from cold, and compares each with the
// same frame drawn once everything is ready: not one pixel may differ on the page, and next to none from a helper.
async (o) => {
  let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'Massive.puppet'));
  if (o && o.hands) rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob());   // with his talking hands: '{"hands":true,"t0":1.1,"n":30,"all":true}' covers a hand coming up (turned through and smeared) drawn by the page and by the helpers
  const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice.wav')).blob()], 'voice.wav', { type: 'audio/wav' }));
  const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id }); await Character.prepare(c);
  const M = Layers.wrap(Character), look = { scheme: 'saltire', format: '16:9' }, fps = 30, n = (o && o.n) || 8, T0 = (o && o.t0) || 0.5, W = 1920, H = 1080, keep = o && o.all ? [...Array(n).keys()] : [0, 1, 2, n - 1];
  const read = vf => { const cv = new OffscreenCanvas(W, H), g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(vf, 0, 0); return g.getImageData(600, 60, 720, 640).data; };
  const grab = async useWorkers => { const shots = {}; let threads = 1; const wd = M.workerData; if (!useWorkers) M.workerData = null; rig.mips = null;
    try { await Render.renderFrames(M, c, look, { fps, blur: 'off', frames: n, t0: T0, onInfo: x => { if (x.threads) threads = x.threads; }, onFrame: async (vf, i) => { if (keep.includes(i)) shots[i] = read(vf); vf.close(); } }); } finally { M.workerData = wd; }
    return { threads, shots }; };
  const one = await grab(false), par = await grab(true);
  // the same frames with everything ready
  Puppet.exporting(true); const R = Render.frameRenderer(M, c, look, W, H, fps, 'off', false, T0), ref = {};
  try { R.render(0); const w = Puppet.steady(); if (w) await w; for (const i of keep) { R.render(i); const vf = new VideoFrame(R.canvas, { timestamp: 0 }); ref[i] = read(vf); vf.close(); } } finally { Puppet.exporting(false); }
  const cmp = (A, B) => { let n8 = 0, mx = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d > mx) mx = d; if (d > 8) n8++; } return { max: mx, over8: n8 }; };
  const out = { sized: rig.mips ? rig.mips.lv.slice() : null, page: {}, helpers: {}, threads: par.threads };
  for (const i of keep) { out.page[i] = cmp(one.shots[i], ref[i]); out.helpers[i] = cmp(par.shots[i], ref[i]); }
  out.ok = keep.every(i => out.page[i].max === 0 && out.helpers[i].over8 < 40);
  if (o && o.all) { const worst = k => keep.reduce((m, i) => Math.max(m, out[k][i].max), 0), smeared = []; for (const i of keep) { const P = Character.poseAt(c, Character.syncOf(c), rig, Character.perfOf(c, Character.syncOf(c), rig, Character.duration(c)), T0 + i / fps); if (P.arms.L && P.arms.L.trail) smeared.push(i); } const off = k => keep.filter(i => out[k][i].max > 0), sharpOff = [...off('page'), ...off('helpers')].filter(i => !smeared.includes(i));   // a smeared hand is added up on a surface of its own: the last bit of a colour may round differently from one run to the next (one level in 255), nothing more
    return { ok: sharpOff.length === 0 && worst('page') <= 2 && worst('helpers') <= 2 && smeared.length > 0, frames: keep.length, smeared, differ: { page: off('page'), helpers: off('helpers') }, worstPage: worst('page'), worstHelpers: worst('helpers'), threads: out.threads, sized: out.sized }; }
  return out;
}

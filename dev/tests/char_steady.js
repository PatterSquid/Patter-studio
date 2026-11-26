// Run with runjs.py (reads dev/tmp_puppet.puppet and dev/tmp_voice.wav): the first frames of an export of his character
// must be drawn the way every later frame is. He is drawn from copies of his pictures made to size in the background;
// a frame made before they arrive is drawn from the full pictures and its outlines differ by a hair (Puppet.steady
// makes an export wait). Exports the first frames with the helpers and without, from cold, and compares each with the
// same frame drawn once everything is ready: not one pixel may differ on the page, and next to none from a helper.
async (o) => {
  const { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'Massive.puppet'));
  const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice.wav')).blob()], 'voice.wav', { type: 'audio/wav' }));
  const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id }); await Character.prepare(c);
  const M = Layers.wrap(Character), look = { scheme: 'saltire', format: '16:9' }, fps = 30, n = (o && o.n) || 8, W = 1920, H = 1080, keep = [0, 1, 2, n - 1];
  const read = vf => { const cv = new OffscreenCanvas(W, H), g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(vf, 0, 0); return g.getImageData(600, 60, 720, 640).data; };
  const grab = async useWorkers => { const shots = {}; let threads = 1; const wd = M.workerData; if (!useWorkers) M.workerData = null; rig.mips = null;
    try { await Render.renderFrames(M, c, look, { fps, blur: 'off', frames: n, t0: 0.5, onInfo: x => { if (x.threads) threads = x.threads; }, onFrame: async (vf, i) => { if (keep.includes(i)) shots[i] = read(vf); vf.close(); } }); } finally { M.workerData = wd; }
    return { threads, shots }; };
  const one = await grab(false), par = await grab(true);
  // the same frames with everything ready
  Puppet.exporting(true); const R = Render.frameRenderer(M, c, look, W, H, fps, 'off', false, 0.5), ref = {};
  try { R.render(0); const w = Puppet.steady(); if (w) await w; for (const i of keep) { R.render(i); const vf = new VideoFrame(R.canvas, { timestamp: 0 }); ref[i] = read(vf); vf.close(); } } finally { Puppet.exporting(false); }
  const cmp = (A, B) => { let n8 = 0, mx = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d > mx) mx = d; if (d > 8) n8++; } return { max: mx, over8: n8 }; };
  const out = { sized: rig.mips ? rig.mips.lv.slice() : null, page: {}, helpers: {}, threads: par.threads };
  for (const i of keep) { out.page[i] = cmp(one.shots[i], ref[i]); out.helpers[i] = cmp(par.shots[i], ref[i]); }
  out.ok = keep.every(i => out.page[i].max === 0 && out.helpers[i].over8 < 40);
  return out;
}

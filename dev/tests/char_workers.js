// The Studio with his talking character drawn by the export helpers: same frames as the page draws, and how much faster
async (o) => { const warns = []; const ow = console.warn; console.warn = (...a) => { warns.push(a.join(" ")); ow(...a); };
  const { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet'));
  const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice2.wav')).blob()], 'v.wav', { type: 'audio/wav' }));
  const ch = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: 'Right. So here is the thing.' }); await Character.prepare(ch); Studio.hooks.char = () => ch;
  await Studio.ready(); const c = Studio.defaults(); window.__c = c; c.avatar = { kind: 'char', x: 0.5, y: 0.5, h: 1, inPt: 0, grade: 0.6, warm: 0.5, cool: 0.45, shadow: 0.5 }; c.events = [{ id: 'a', k: 'plane', start: 1, dur: 6 }]; await Studio.prepare(c);
  const M = Layers.wrap(Studio), look = { scheme: 'saltire', format: '16:9' }, fps = 30, n = o.n || 60, W = 1920, H = 1080;
  const grab = async (useWorkers) => { const shots = {}; const keep = new Set([5, 30, 55]); let threads = 1; const a = performance.now();
    const mt = M.mainThread; if (!useWorkers) M.workerData = null;
    await Render.renderFrames(M, c, look, { fps, blur: 'off', frames: n, t0: 1, onInfo: x => { if (x.threads) threads = x.threads; }, onFrame: async (vf, i) => { if (keep.has(i)) { const cv = new OffscreenCanvas(480, 270); cv.getContext('2d').drawImage(vf, 0, 0, 480, 270); shots[i] = cv.getContext('2d').getImageData(0, 0, 480, 270).data; } vf.close(); } });
    return { ms: Math.round(performance.now() - a), threads, shots }; };
  const par = await grab(true), one = await grab(false);
  const diff = {}; for (const i of Object.keys(par.shots)) { const A = par.shots[i], B = one.shots[i]; let s = 0, big = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]); s += d; if (d > 60) big++; } diff[i] = { mean: +(s / (A.length / 4)).toFixed(2), bigPx: big }; }
  return { warns, wd: !!Studio.workerData(c), parallel: { ms: par.ms, threads: par.threads }, oneThread: { ms: one.ms, threads: one.threads }, diff, cores: navigator.hardwareConcurrency };
}

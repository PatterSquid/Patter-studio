// A Video tab export with the helpers against one without: his character in the studio with the plane, a chart, his own
// footage (drawn on the page) with a crossfade into it, a picture and text over the top. Same frames, and the timings.
async (o) => {
  o = o || {};
  const { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet'));
  const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice2.wav')).blob()], 'v.wav', { type: 'audio/wav' }));
  const foot = await CutMedia.importFile(new File([await (await fetch('/tmp_cut/long.mp4')).blob()], 'long.mp4', { type: 'video/mp4' }));
  const pic = await CutMedia.importFile(new File([await (await fetch('/tmp_cut/red.png')).blob()], 'red.png', { type: 'image/png' }));
  await new Promise(r => setTimeout(r, 1500));
  const ch = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: 'Right. So here is the thing. They have only gone and shut the chippy.' }); await Character.prepare(ch); Studio.hooks.char = () => ch;
  await Studio.ready(); const st = Studio.defaults(); st.avatar = { kind: 'char', x: 0.5, y: 0.5, h: 1, inPt: 0, grade: 0.6, warm: 0.5, cool: 0.45, shadow: 0.5 }; st.events = [{ id: 'a', k: 'plane', start: 0.5, dur: 6 }];
  const v = { v: 2, studio: st, items: [
      { id: 'a1', kind: 'avatar', dur: 3 },
      { id: 'c1', kind: 'clip', mod: 'charts', cfg: Charts.defaults(), inPt: 0, outPt: 2, hold: 0, tr: { k: 'fade', d: 0.5 } },
      { id: 'm1', kind: 'media', asset: foot.id, src0: 0, src1: 2, file: 'long.mp4' },
      { id: 'a2', kind: 'avatar', dur: 3, col: { exposure: 0.2 } } ],
    tracks: [{ id: 'T1', kind: 'video', items: [{ id: 'p1', kind: 'media', asset: pic.id, dur: 1.5, start: 1, x: 0.3, y: -0.2, s: 0.3 }, { id: 'ch2', kind: 'clip', mod: 'char', cfg: ch, inPt: 0, outPt: 2, hold: 0, start: 8, s: 0.4, x: 0.3 }] }] };
  await Studio.prepare(st);
  const look = { scheme: 'saltire', format: '16:9' }, fps = o.fps || 25, res = o.res || '1080';
  const keep = o.keep || [5, 40, 62, 80, 110, 160, 210];
  const pngRun = async workers => { const files = {}; const dir = { getFileHandle: async name => ({ createWritable: async () => { const parts = []; return { write: async b => parts.push(b), close: async () => { files[name] = new Blob(parts); } }; } }) };
    const r = await CutExport.run(v, look, { fps, res, png: true, dir, workers, blur: 'off' }); const shots = {};
    for (const i of keep) { const b = files['frame_' + String(i).padStart(5, '0') + '.png']; if (!b) continue; const bm = await createImageBitmap(b); const cv = new OffscreenCanvas(480, 270); cv.getContext('2d').drawImage(bm, 0, 0, 480, 270); shots[i] = cv.getContext('2d').getImageData(0, 0, 480, 270).data; }
    return { r, shots, count: Object.keys(files).length }; };
  const A = await pngRun(undefined), B = await pngRun(false);
  const diff = {}; for (const i of keep) { const X = A.shots[i], Y = B.shots[i]; if (!X || !Y) { diff[i] = 'missing'; continue; } let s = 0, big = 0; for (let k = 0; k < X.length; k += 4) { const d = Math.abs(X[k] - Y[k]) + Math.abs(X[k + 1] - Y[k + 1]) + Math.abs(X[k + 2] - Y[k + 2]); s += d; if (d > 60) big++; } diff[i] = { mean: +(s / (X.length / 4)).toFixed(2), bigPx: big, page: Video.pageOnlyAt(v, look, i / fps) }; }
  const out = { png: { helpers: A.r.helpers, frames: A.r.frames, count: A.count, secsWith: +A.r.secs.toFixed(1), secsWithout: +B.r.secs.toFixed(1) }, diff };
  if (o.mp4) { const a = await CutExport.run(v, look, { fps, res, quality: 'high', blur: 'off' }), b = await CutExport.run(v, look, { fps, res, quality: 'high', blur: 'off', workers: false });
    out.mp4 = { helpers: a.helpers, with: +a.secs.toFixed(1), without: +b.secs.toFixed(1), bytesWith: a.bytes, bytesWithout: b.bytes }; }
  return out;
}

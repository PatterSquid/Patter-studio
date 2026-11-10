// PNG sequence exports pack frames in the background: every frame present, in order, and how long it takes
async () => {
  const out = {}; 
  const M = Layers.wrap(Charts), cfg = Charts.defaults(), look = { scheme: 'saltire', format: '16:9', texture: true };
  let a = performance.now(); const z = await E.exportPNG(M, cfg, look, { fps: 30, blur: 'off', range: [2, 4] }); out.graphics = { ms: Math.round(performance.now() - a), bytes: z.size };
  const buf = new Uint8Array(await z.arrayBuffer()); let names = [], p = 0; const dv = new DataView(buf.buffer);
  while (p < buf.length - 30 && dv.getUint32(p, true) === 0x04034b50) { const csz = dv.getUint32(p + 18, true), nl = dv.getUint16(p + 26, true), xl = dv.getUint16(p + 28, true); names.push(new TextDecoder().decode(buf.slice(p + 30, p + 30 + nl))); p += 30 + nl + xl + csz; }
  out.graphics.frames = names.length; out.graphics.inOrder = names.every((nm, i) => nm === 'frame_' + String(i).padStart(5, '0') + '.png');
  const v = { v: 2, items: [{ id: 'c', kind: 'clip', mod: 'charts', cfg: Charts.defaults(), inPt: 2, outPt: 4, hold: 0 }], tracks: [], layers: [] };
  a = performance.now(); const r = await CutExport.run(v, look, { png: true, res: '1080', fps: 30, blur: 'off', onProgress: () => {} }); out.video = { ms: Math.round(performance.now() - a), frames: r && r.frames, bytes: r && r.zip && r.zip.size };
  return out;
}

/* Puppet: reads a Character Animator puppet (.puppet, a zip with the Photoshop file inside) or the .psd itself, works out
   the rig from the layer names the way Character Animator does (Head with its views, Mouth with the twelve mouth shapes,
   eyes with a blink, eyebrows, pupils, swap sets such as hands, poses and costumes), keeps it in this browser (IndexedDB
   'patter-puppet'; his artwork never goes into the update repo) and draws it in any pose. Pure drawing: no timing here,
   the Character module decides the pose for each moment. */
const Puppet = (() => {
  const VISEMES = ['Neutral', 'Aa', 'D', 'Ee', 'F', 'L', 'M', 'Oh', 'R', 'S', 'Uh', 'W-Oo'];
  const VIEWS = [['front', /^(frontal|front)$/], ['left', /^left profile$/], ['right', /^right profile$/], ['leftq', /^left quarter$/], ['rightq', /^right quarter$/], ['up', /^(upward|up)$/], ['down', /^(downward|down)$/]];
  const MAXW = 2200;   // layers are kept no wider than this puppet width (his is 2752 wide; 1080p needs about 1920)
  const norm = s => String(s || '').replace(/^\+/, '').trim().toLowerCase();
  let tick = 0; const mem = {}, loading = {};

  /* ---------- zip (stored or deflated) ---------- */
  async function unzip(blob, want) {
    const tail = new DataView(await blob.slice(Math.max(0, blob.size - 65557)).arrayBuffer()); let e = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('That file is not a puppet (no zip directory found).');
    let n = tail.getUint16(e + 10, true), cdSize = tail.getUint32(e + 12, true), cdOff = tail.getUint32(e + 16, true);
    const cd = new DataView(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer()), dec = new TextDecoder(); let p = 0; const out = [];
    for (let i = 0; i < n && p < cd.byteLength; i++) {
      const method = cd.getUint16(p + 10, true), csize = cd.getUint32(p + 20, true), size = cd.getUint32(p + 24, true), nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true), off = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl)); p += 46 + nl + xl + cl; out.push({ name, method, csize, size, off });
    }
    const hit = out.find(f => want(f.name)); if (!hit) return null;
    const lh = new DataView(await blob.slice(hit.off, hit.off + 30).arrayBuffer()), start = hit.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), raw = blob.slice(start, start + hit.csize);
    if (hit.method === 0) return { name: hit.name, blob: raw };
    if (hit.method === 8) return { name: hit.name, blob: await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob() };
    throw new Error('The puppet file is packed in a way this cannot read.');
  }

  /* ---------- Photoshop file ---------- */
  async function inflate(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()); }
  async function readPSD(buf, onProgress) {
    const d = new DataView(buf), u8 = new Uint8Array(buf); let p = 0;
    const u16 = () => { const v = d.getUint16(p); p += 2; return v; }, i16 = () => { const v = d.getInt16(p); p += 2; return v; }, u32 = () => { const v = d.getUint32(p); p += 4; return v; }, i32 = () => { const v = d.getInt32(p); p += 4; return v; };
    if (d.getUint32(0) !== 0x38425053) throw new Error('That is not a Photoshop file.');
    p = 4; const ver = u16(); p += 6; const nch = u16(), H = u32(), W = u32(), depth = u16(), mode = u16();
    if (depth !== 8) throw new Error('The Photoshop file is ' + depth + ' bits per channel. Save it as 8 bits per channel (Image, Mode, 8 Bits) and try again.');
    if (mode !== 3 && mode !== 1) throw new Error('The Photoshop file needs to be in RGB colour.');
    const len = () => ver === 2 ? (u32() * 4294967296 + u32()) : u32();
    { const _n = u32(); p += _n; }; { const _n = u32(); p += _n; };   // colour mode data, image resources
    const lmEnd = (() => { const l = len(); return p + l; })(); len(); let cnt = Math.abs(i16()); const layers = [];
    for (let i = 0; i < cnt; i++) {
      const t = i32(), l = i32(), b = i32(), r = i32(), nc = u16(), chans = [];
      for (let k = 0; k < nc; k++) chans.push([i16(), len()]);
      p += 4; p += 4; const op = u8[p], clip = u8[p + 1], flags = u8[p + 2]; p += 4; const exl = u32(), exEnd = p + exl;
      const ml = u32(); let mask = null; if (ml >= 20) { mask = { t: d.getInt32(p), l: d.getInt32(p + 4), b: d.getInt32(p + 8), r: d.getInt32(p + 12), def: u8[p + 16], fl: u8[p + 17] }; } p += ml;
      { const _n = u32(); p += _n; }; const nl = u8[p]; let name = new TextDecoder('latin1').decode(u8.subarray(p + 1, p + 1 + nl)); p += 1 + nl; p += (4 - (nl + 1) % 4) % 4;
      let sect = null;
      while (p + 12 <= exEnd) {
        p += 4; const key = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]); p += 4; const ln = (ver === 2 && /^(LMsk|Lr16|Lr32|Layr|Mt16|Mt32|Mtrn|Alph|FMsk|lnk2|FEid|FXid|PxSD)$/.test(key)) ? len() : u32(), at = p;
        if (key === 'luni') { const m = d.getUint32(at); let s = ''; for (let k = 0; k < m; k++) s += String.fromCharCode(d.getUint16(at + 4 + k * 2)); name = s.replace(/\0+$/, ''); }
        if (key === 'lsct' || key === 'lsdk') sect = d.getUint32(at);
        p = at + ln + (ln % 2 && ver === 2 ? 0 : 0);
      }
      p = exEnd; layers.push({ name, box: [l, t, r, b], chans, op, clip, vis: !(flags & 2), sect, mask });
    }
    // channel image data follows, in the same order
    for (const L of layers) { L.data = {}; for (const [id, ln] of L.chans) { L.data[id] = [p, ln]; p += ln; } }
    const plane = async (L, id, w, h) => {
      const e = L.data[id]; if (!e || !e[1]) return null; let q = e[0]; const comp = d.getUint16(q); q += 2; const n = w * h;
      if (comp === 0) return u8.subarray(q, q + n);
      if (comp === 1) {
        const out = new Uint8Array(n), cw = ver === 2 ? 4 : 2; let src = q + h * cw, o = 0;
        for (let y = 0; y < h; y++) { const c = cw === 2 ? d.getUint16(q + y * 2) : d.getUint32(q + y * 4), end = src + c; o = y * w;
          while (src < end) { const k = u8[src++]; if (k < 128) { out.set(u8.subarray(src, src + k + 1), o); o += k + 1; src += k + 1; } else if (k > 128) { out.fill(u8[src++], o, o + 257 - k); o += 257 - k; } } src = end; }
        return out;
      }
      if (comp === 2 || comp === 3) { const z = await inflate(u8.subarray(q, e[0] + e[1])); if (comp === 3) for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) z[y * w + x] = (z[y * w + x] + z[y * w + x - 1]) & 255; return z; }
      return null;
    };
    const pixels = async L => {
      const [l, t, r, b] = L.box, w = r - l, h = b - t; if (w <= 0 || h <= 0) return null;
      const R = await plane(L, 0, w, h); if (!R) return null; const G = mode === 1 ? R : (await plane(L, 1, w, h)) || R, B = mode === 1 ? R : (await plane(L, 2, w, h)) || R, A = await plane(L, -1, w, h);
      const im = new ImageData(w, h), px = im.data; for (let i = 0, j = 0; i < w * h; i++, j += 4) { px[j] = R[i]; px[j + 1] = G[i]; px[j + 2] = B[i]; px[j + 3] = A ? A[i] : 255; }
      const M = L.mask; if (M && L.data[-2] && !(M.fl & 2)) {   // a user mask: hide where it is dark
        const mw = M.r - M.l, mh = M.b - M.t, mk = await plane(L, -2, mw, mh);
        if (mk) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = x + l - M.l, Y = y + t - M.t, v = X >= 0 && Y >= 0 && X < mw && Y < mh ? mk[Y * mw + X] : M.def; px[(y * w + x) * 4 + 3] = px[(y * w + x) * 4 + 3] * v / 255; }
      }
      return im;
    };
    return { W, H, layers, pixels, end: lmEnd };
  }

  /* ---------- the rig: a tree of groups and layers, with what each part is for ---------- */
  function buildTree(layers) {
    const root = { kids: [], group: true, name: 'puppet', vis: true }, stack = [root];
    for (let i = layers.length - 1; i >= 0; i--) {   // stored bottom up; the tree lists top first like Photoshop
      const L = layers[i];
      if (L.sect === 1 || L.sect === 2) { const g = { name: L.name, group: true, vis: L.vis, op: L.op, kids: [] }; stack[stack.length - 1].kids.push(g); stack.push(g); }
      else if (L.sect === 3) { if (stack.length > 1) stack.pop(); }
      else stack[stack.length - 1].kids.push({ name: L.name, li: i, vis: L.vis, op: L.op, clip: L.clip });
    }
    return root;
  }
  // Work out the roles of the parts, and number every node so poses can address them
  function analyse(rig) {
    let n = 0; const nodes = [], swaps = [], triggers = {}, views = {};
    const walk = (node, par, ctx) => {
      node.id = n++; nodes.push(node); node.parent = par ? par.id : -1; const nm = norm(node.name);
      let c = Object.assign({}, ctx);
      if (node.group && nm === 'head' && !ctx.head) { c.head = true; node.role = 'head'; rig.head = node.id; }
      if (node.group && c.head && c.viewHolder === undefined && node.kids.some(k => k.group && VIEWS.some(v => v[1].test(norm(k.name))))) { node.views = true; c.viewHolder = node.id; }
      const v = node.group && VIEWS.find(q => q[1].test(nm)); if (v && ctx.viewHolder !== undefined && !ctx.view) { node.role = 'view'; node.view = v[0]; c.view = v[0]; views[v[0]] = node.id; }
      if (node.group && nm === 'mouth') { node.role = 'mouth'; c.mouth = true; }
      if (ctx.mouth && !node.group) { const vis = VISEMES.find(m => norm(m) === nm || (m === 'W-Oo' && /^(w-oo|w|oo)$/.test(nm)) || (m === 'Neutral' && nm === 'neutral')); node.role = 'viseme'; node.viseme = vis || node.name; }
      if (node.group && /eye/.test(nm) && !/brow/.test(nm)) { node.role = 'eye'; c.eye = /left/.test(nm) ? 'L' : /right/.test(nm) ? 'R' : 'L'; }
      if (ctx.eye && !node.group && /blink/.test(nm)) node.role = 'blink';
      if (ctx.eye && /pupil/.test(nm)) { node.role = 'pupil'; node.side = ctx.eye; }
      if (/brow/.test(nm)) { node.role = 'brow'; node.side = /left/.test(nm) ? 'L' : 'R'; }
      if (ctx.eye && !node.group && /^lid/.test(nm)) node.role = 'lid';
      if (node.group && nm === 'body') node.role = 'body';
      if (node.group && /^(r|l|right |left )?arm$/.test(nm)) { node.role = 'arm'; node.side = /^r/.test(nm) ? 'R' : 'L'; }
      if (/^(t\d|string|drawstring|hoodie string)/.test(nm) && !node.group) node.role = 'dangle';
      if (node.group) node.kids.forEach(k => walk(k, node, c));
      // a swap set: a group of several parts where only one shows at a time (hands, poses, costumes)
      if (node.group && node.kids.length >= 2 && !c.mouth && !node.views && node.role !== 'eye' && node.kids.filter(k => k.vis).length === 1 && !node.kids.every(k => k.role === 'viseme')) {
        const def = node.kids.findIndex(k => k.vis); swaps.push({ id: node.id, def, kids: node.kids.map(k => k.id) });
        node.kids.forEach((k, i) => { if (i === def) return; const key = norm(k.name); (triggers[key] = triggers[key] || []).push([node.id, i]); });
      }
    };
    walk(rig.tree, null, {});
    rig.nodes = nodes; rig.swaps = swaps; rig.triggers = triggers; rig.views = views;
    rig.visemes = VISEMES.filter(v => nodes.some(x => x.role === 'viseme' && x.viseme === v));
  }
  // Boxes of parts (in puppet pixels) and the pivots the Character module moves things around
  function measure(rig) {
    const box = id => { const nd = rig.nodes[id]; if (!nd) return null; if (!nd.group) { const L = rig.layers[nd.li]; return L && L.w ? [L.x, L.y, L.x + L.w, L.y + L.h] : null; } let b = null; nd.kids.forEach(k => { if (!k.vis && nd.views) return; const q = box(k.id); if (q) b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])] : q; }); return b; };
    rig.nodes.forEach(nd => { nd.box = box(nd.id); });
    const fv = rig.views.front != null ? rig.nodes[rig.views.front] : (rig.head != null ? rig.nodes[rig.head] : null), hb = fv && fv.box;
    rig.pivot = { head: hb ? [(hb[0] + hb[2]) / 2, hb[3] - (hb[3] - hb[1]) * 0.08] : [rig.W / 2, rig.H * 0.5], headH: hb ? hb[3] - hb[1] : rig.H * 0.4 };
    const body = rig.nodes.find(n => n.role === 'body'), bb = body && body.box; rig.pivot.body = bb ? [(bb[0] + bb[2]) / 2, bb[3]] : [rig.W / 2, rig.H];
    const all = box(0); rig.bounds = all || [0, 0, rig.W, rig.H];
  }
  const plain = rig => { const strip = n => Object.assign({}, n, { kids: n.kids ? n.kids.map(strip) : undefined }); return { name: rig.name, W: rig.W, H: rig.H, scale: rig.scale, layers: rig.layers, tree: strip(rig.tree) }; };

  /* ---------- import ---------- */
  async function importFile(file, onProgress) {
    const say = (p, s) => onProgress && onProgress(p, s);
    let psdBlob = file, base = (file.name || 'Puppet').replace(/\.(puppet|psd|psb)$/i, '');
    if (/\.puppet$/i.test(file.name || '') || !/\.ps[db]$/i.test(file.name || '')) {
      say(0.02, 'Opening the puppet…'); const z = await unzip(file, n => /\.ps[db]$/i.test(n)); if (!z) throw new Error('No Photoshop artwork inside that puppet. If the artwork is an Illustrator file, save a Photoshop copy and load that.'); psdBlob = z.blob;
    }
    say(0.08, 'Reading the layers…'); const psd = await readPSD(await psdBlob.arrayBuffer());
    const scale = Math.min(1, MAXW / psd.W), W = Math.round(psd.W * scale), H = Math.round(psd.H * scale), blobs = [], layers = [];
    for (let i = 0; i < psd.layers.length; i++) {
      const L = psd.layers[i]; layers.push(null); blobs.push(null); if (L.sect) continue;
      const im = await psd.pixels(L); if (!im) continue;
      const x0 = L.box[0] * scale, y0 = L.box[1] * scale, w = Math.max(1, Math.round(im.width * scale)), h = Math.max(1, Math.round(im.height * scale));
      const c1 = new OffscreenCanvas(im.width, im.height); c1.getContext('2d').putImageData(im, 0, 0);
      const c2 = new OffscreenCanvas(w, h), g2 = c2.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(c1, 0, 0, w, h);
      blobs[i] = await c2.convertToBlob({ type: 'image/webp', quality: 0.92 }); layers[i] = { x: x0, y: y0, w, h };
      if (i % 8 === 0) say(0.1 + 0.85 * i / psd.layers.length, 'Reading the layers… ' + (i + 1) + ' of ' + psd.layers.length);
    }
    const rig = { name: base, W, H, scale, layers, tree: buildTree(psd.layers.map((L, i) => Object.assign({}, L, { data: null }))) };
    const id = 'pup-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await put({ id, name: base, rig: plain(rig), blobs, added: Date.now() }).catch(e => { console.warn('puppet not kept', e); });
    say(0.97, 'Getting him ready…'); const live = await make(id, rig, blobs); say(1, 'Done'); return { id, rig: live };
  }
  async function make(id, rig, blobs) {
    const bm = await Promise.all(blobs.map(b => b ? createImageBitmap(b) : null)); rig.bm = bm; rig.id = id; analyse(rig); measure(rig);
    mem[id] = rig; tick++; return rig;
  }

  /* ---------- keeping puppets in this browser ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-puppet', 1); r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, f) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('p', mode), q = f(t.objectStore('p')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  const put = v => tx('readwrite', s => s.put(v));
  async function list() { try { const all = await tx('readonly', s => s.getAll()); return (all || []).map(p => ({ id: p.id, name: p.name, added: p.added })).sort((a, b) => a.added - b.added); } catch (e) { return []; } }
  async function remove(id) { delete mem[id]; tick++; await tx('readwrite', s => s.delete(id)).catch(() => { }); }
  function load(id) { if (!id) return Promise.resolve(null); if (mem[id]) return Promise.resolve(mem[id]); if (loading[id]) return loading[id];
    return (loading[id] = tx('readonly', s => s.get(id)).then(p => p ? make(id, p.rig, p.blobs) : null).catch(e => { console.warn('puppet', e); return null; }).finally(() => { delete loading[id]; })); }
  const get = id => { if (id && !mem[id] && !loading[id]) load(id); return mem[id] || null; };

  /* ---------- drawing one pose ----------
     pose: { view, mouth, blink (0 open .. 1 shut), brow: { L: [dx, dy, rot], R: [...] }, pupil: [dx, dy] (fractions of the eye),
             head: [dx, dy, rot], body: [breath], swaps: { nodeId: kidIndex }, dangle: rot, armLift: { L, R } } */
  function draw(g, rig, pose) {
    const P = pose || {}, sw = P.swaps || {}, N = rig.nodes, bm = rig.bm, L = rig.layers;
    const visible = nd => {
      const par = N[nd.parent];
      if (par && par.views) return nd.view === (rig.views[P.view] != null ? P.view : 'front');
      if (par && sw[par.id] != null && rig.swaps.some(s => s.id === par.id)) return par.kids[sw[par.id]] === nd;
      if (nd.role === 'viseme') return nd.viseme === (P.mouth || 'Neutral') || (!rig.visemes.includes(P.mouth || 'Neutral') && nd.viseme === 'Neutral');
      if (nd.role === 'blink') return (P.blink || 0) >= 0.5;
      if (nd.role === 'lid' && (P.blink || 0) >= 0.5 && par && par.kids.some(k => k.role === 'blink')) return false;   // the blink covers the eye; only the lid line goes
      return nd.vis;
    };
    const paint = nd => {
      if (!visible(nd)) return; const op = (nd.op == null ? 255 : nd.op) / 255; if (op <= 0) return;
      g.save(); if (op < 1) g.globalAlpha *= op;
      if (nd.role === 'head' && P.head) { const [px, py] = rig.pivot.head, [dx, dy, r] = P.head; g.translate(px + dx, py + dy); g.rotate(r || 0); if (P.head[3]) g.scale(1 + P.head[3], 1 + P.head[3]); g.translate(-px, -py); }
      if (nd.role === 'body' && P.body) { const [px, py] = rig.pivot.body, k = P.body[0] || 0; g.translate(px, py); g.scale(1 + k * 0.4, 1 + k); g.translate(-px, -py); }
      if (nd.role === 'arm' && P.armLift && P.armLift[nd.side] && nd.box) { const b = nd.box, lift = P.armLift[nd.side]; g.translate(0, -lift[0]); if (lift[1]) { const px = nd.side === 'R' ? b[0] : b[2], py = b[1]; g.translate(px, py); g.rotate(lift[1]); g.translate(-px, -py); } }
      if (nd.role === 'brow' && P.brow && P.brow[nd.side] && nd.box) { const b = nd.box, [dx, dy, r] = P.brow[nd.side], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; g.translate(cx + dx * (b[2] - b[0]), cy + dy * (b[3] - b[1])); g.rotate(r || 0); g.translate(-cx, -cy); }
      if (nd.role === 'pupil' && P.pupil && nd.box) { const par = N[nd.parent], eb = par && par.box, w = eb ? eb[2] - eb[0] : 20, h = eb ? eb[3] - eb[1] : 20; g.translate(P.pupil[0] * w * 0.28, P.pupil[1] * h * 0.2); }
      if (nd.role === 'dangle' && P.dangle && nd.box) { const b = nd.box, cx = (b[0] + b[2]) / 2; g.translate(cx, b[1]); g.rotate(P.dangle * (nd.id % 2 ? 1 : -0.8)); g.translate(-cx, -b[1]); }
      if (nd.group) { for (let i = nd.kids.length - 1; i >= 0; i--) paint(nd.kids[i]); }
      else { const b = bm[nd.li], q = L[nd.li]; if (b && q) g.drawImage(b, q.x, q.y, q.w, q.h); }
      g.restore();
    };
    paint(rig.tree);
  }
  // names of the things a script can trigger: hands, poses, costumes (as found in the swap sets)
  const triggerNames = rig => Object.keys(rig.triggers || {});
  return { importFile, readPSD, unzip, list, load, get, remove, draw, triggerNames, VISEMES, get tick() { return tick; }, _mem: mem };
})();

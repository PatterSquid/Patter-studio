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
    { let hb2 = null; Object.values(rig.views).concat(rig.head != null ? [rig.head] : []).forEach(id => { const q = box(id); if (q) hb2 = hb2 ? [Math.min(hb2[0], q[0]), Math.min(hb2[1], q[1]), Math.max(hb2[2], q[2]), Math.max(hb2[3], q[3])] : q; }); rig.headBox = hb2 ? hb2.map(Math.round) : null; }
    const body = rig.nodes.find(n => n.role === 'body'), bb = body && body.box; rig.pivot.body = bb ? [(bb[0] + bb[2]) / 2, bb[3]] : [rig.W / 2, rig.H];
    const all = box(0); rig.bounds = all || [0, 0, rig.W, rig.H];
    // arms: a sleeve that swings from the shoulder and a hand that turns at the wrist (the cuff of the sleeve)
    rig.arms = {};
    rig.nodes.filter(n => n.role === 'arm').forEach(arm => {
      const hand = arm.kids.find(k => k.group && /hand/i.test(k.name)) || arm.kids.find(k => !k.group), sleeve = arm.kids.find(k => k !== hand);
      const vbox = n => { if (!n) return null; if (!n.group) return n.box; const v = n.kids.find(k => k.vis) || n.kids[0]; return v ? v.box : n.box; };
      const hb = vbox(hand), sb = vbox(sleeve); if (!hb || !sb) return;
      const sw = sb[2] - sb[0], sh = sb[3] - sb[1], dir = (hb[0] + hb[2]) / 2 >= (sb[0] + sb[2]) / 2 ? 1 : -1;
      const cuff = [dir > 0 ? sb[2] - 0.13 * sw : sb[0] + 0.13 * sw, sb[1] + 0.6 * sh], shoulder = [dir > 0 ? sb[0] + 0.24 * sw : sb[2] - 0.24 * sw, sb[1] + 0.28 * sh];
      hand.role = 'hand'; hand.side = arm.side; if (sleeve) { sleeve.role = 'sleeve'; sleeve.side = arm.side; }
      rig.arms[arm.side] = { cuff, shoulder, dir, hand: hand.id, sleeve: sleeve ? sleeve.id : null, handW: hb[2] - hb[0] };
    });
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
  /* A fist seen from the back, made from the thumbs up drawing with the thumb taken off and the top of the hand redrawn
     (his puppet has only the front of a fist). The cut is in fractions of the drawing, found on his left hand; the right
     hand is its mirror. Added to each hand's swap set as 'back fist'. */
  const FIST_CUT = [[0, 0.634], [0.065, 0.552], [0.125, 0.496]].concat(Array.from({ length: 21 }, (_, i) => { const t = i / 20, P0 = [58, 190], P1 = [118, 124], P2 = [252, 141]; return [((1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0]) / 337, ((1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]) / 413]; })).concat([[1, 0.341]]);
  async function backFists(rig) {
    const sets = []; const walk = n => { if (!n.kids) return; if (n.group && /hand/i.test(n.name) && n.kids.some(k => /^thumbs? ?up$/i.test(k.name)) && !n.kids.some(k => /back fist/i.test(k.name))) sets.push(n); n.kids.forEach(walk); }; walk(rig.tree);
    for (const set of sets) {
      const th = set.kids.find(k => /^thumbs? ?up$/i.test(k.name)), L = rig.layers[th.li], b = rig.bm[th.li]; if (!L || !b) continue;
      const mir = /^\+?r/i.test(set.name), w = b.width, h = b.height, c = new OffscreenCanvas(w, h), g = c.getContext('2d');
      // the curled fingers squeezed in towards the knuckles (a tighter, chunkier fist)
      const X0 = (mir ? 1 - 175 / 337 : 175 / 337) * w, sq = 0.8;
      if (!mir) { g.drawImage(b, X0, 0, w - X0, h, X0, 0, w - X0, h); g.drawImage(b, 0, 0, X0, h, X0 - X0 * sq, 0, X0 * sq, h); }
      else { g.drawImage(b, 0, 0, X0, h, 0, 0, X0, h); g.drawImage(b, X0, 0, w - X0, h, X0, 0, (w - X0) * sq, h); }
      const P = FIST_CUT.map(([x, y]) => [(mir ? 1 - x : x) * w, y * h]), k = w / 337;
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(P[0][0], P[0][1]); P.forEach(q => g.lineTo(q[0], q[1])); g.lineTo(mir ? 0 : w, -1); g.lineTo(mir ? w : 0, -1); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-atop'; g.lineJoin = g.lineCap = 'round';
      g.filter = `blur(${7 * k}px)`; g.strokeStyle = 'rgba(150,70,30,0.42)'; g.lineWidth = 26 * k; g.beginPath(); P.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.filter = 'none';
      g.strokeStyle = 'rgb(20,12,10)'; g.lineWidth = 15 * k; g.stroke();
      // the fingers fold away from the light: their side of the knuckle row in shadow (a scallop round each knuckle)
      const KN = [[152, 178, 26], [168, 236, 27], [188, 293, 26], [212, 345, 23]], X = x => (mir ? 337 - x : x) / 337 * w, Y = y => y / 413 * h;
      g.filter = `blur(${2.5 * k}px)`; g.fillStyle = 'rgba(140,60,25,0.55)'; g.beginPath(); g.moveTo(X(-50), Y(KN[0][1] - 60));
      KN.forEach(([x, y, r]) => { g.lineTo(X(x - r * 0.2), Y(y - r)); g.quadraticCurveTo(X(x - r * 1.25), Y(y), X(x - r * 0.2), Y(y + r)); });
      g.lineTo(X(-50), Y(KN[KN.length - 1][1] + 60)); g.closePath(); g.fill(); g.filter = 'none';
      const li = rig.layers.length; rig.layers.push(Object.assign({}, L)); rig.bm.push(await createImageBitmap(c));
      set.kids.push({ name: 'back fist', li, vis: false, op: 255, made: true });
    }
  }
  /* his hand drawings (HandSheet), fitted to this puppet and added to each hand's swap set; their wrist goes on the cuff
     of that arm's sleeve (found the way analyse finds it). Also plain copies of the dark sleeves for turned forearms. */
  async function sheetHands(rig, hands) {
    if (typeof HandSheet === 'undefined') return;
    const sets = []; const walk = (n, par) => { if (!n.kids) return; if (n.group && /hand/i.test(n.name) && par && n.kids.some(k => /^default$/i.test(k.name))) sets.push([n, par]); n.kids.forEach(k => walk(k, n)); }; walk(rig.tree, null);
    const cuffOf = arm => { const sl = arm.kids.find(k => k.group && !/hand/i.test(k.name) && /elbow|sleeve|arm/i.test(k.name)), sd = sl && (sl.kids.find(k => /^default$/i.test(k.name)) || sl.kids.find(k => k.vis)), SL = sd && rig.layers[sd.li]; if (!SL || !SL.w) return null; const dir = /^\+?r/i.test(arm.name) ? 1 : -1; return { cuff: [dir > 0 ? SL.x + SL.w - 0.13 * SL.w : SL.x + 0.13 * SL.w, SL.y + 0.6 * SL.h], open: [dir > 0 ? SL.x + SL.w - 0.14 * SL.w : SL.x + 0.14 * SL.w, SL.y + 0.71 * SL.h], sleeve: sl }; };   // open: the middle of the sleeve's opening
    // plain sleeves
    rig.plainBm = {}; for (const [, arm] of sets) { const c = cuffOf(arm); if (!c) continue; for (const k of c.sleeve.kids) { if (k.li == null || !rig.bm[k.li]) continue; const pc = HandSheet.plain(rig.bm[k.li], /^\+?r/i.test(arm.name) ? 1 : -1); if (pc) rig.plainBm[k.li] = await createImageBitmap(pc); } }
    if (!hands || !hands.blob) return;
    const img = await createImageBitmap(hands.blob), pieces = HandSheet.cut(img), roles = hands.roles && hands.roles.length === pieces.length ? hands.roles : HandSheet.guess(pieces);
    const refs = []; for (const [set] of sets) { for (const w of set.kids.filter(k => /^(wave|default)$/i.test(k.name))) { const b = rig.bm[w.li]; if (!b) continue; const c = new OffscreenCanvas(b.width, b.height), g = c.getContext('2d'); g.drawImage(b, 0, 0); refs.push(g.getImageData(0, 0, b.width, b.height)); } }
    const F = HandSheet.fit(pieces, roles, refs); rig.sheet = { pieces, roles, fit: F }; if (!F) return;
    for (const [set, arm] of sets) {
      const c = cuffOf(arm); if (!c) continue; const side = /^\+?r/i.test(arm.name) ? 'R' : 'L', D = rig.layers[set.kids.find(k => /^default$/i.test(k.name)).li];
      for (const o of F.list.filter(q => q.side === side)) {
        const li = rig.layers.length; rig.layers.push(Object.assign({}, D, { x: c.open[0] - o.anchor[0], y: c.open[1] - o.anchor[1], w: o.w, h: o.h, name: o.role })); rig.bm.push(await createImageBitmap(o.canvas));
        set.kids = set.kids.filter(k => k.name !== o.role); set.kids.push({ name: o.role, li, vis: false, op: 255, made: true });
      }
    }
  }
  /* Eyebrows may come down for anger but never into the eye: for each brow, the bottom edge of its drawing (a few points)
     and the bottom edge of the upper lid in the same head view (where the white of the eye starts). Puppet.draw lifts a
     brow that would pass the lid edge (as far as it already overlaps at rest is allowed, no further). */
  function lidAt(lp, x) { if (!lp || lp.length < 2 || x < lp[0][0] || x > lp[lp.length - 1][0]) return null; let i = 1; while (i < lp.length && lp[i][0] < x) i++; const a = lp[i - 1], b = lp[Math.min(i, lp.length - 1)], u = b[0] > a[0] ? (x - a[0]) / (b[0] - a[0]) : 0; return a[1] + (b[1] - a[1]) * u; }
  function browLimits(rig) {
    const prof = (li, bottom) => { const L = rig.layers[li], b = rig.bm[li]; if (!L || !b) return []; const c = new OffscreenCanvas(b.width, b.height), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(b, 0, 0); const d = g.getImageData(0, 0, b.width, b.height).data, sx = L.w / b.width, sy = L.h / b.height, out = [];
      for (let x = 0; x < b.width; x += Math.max(1, Math.floor(b.width / 40))) { let yy = null; for (let i = 0; i < b.height; i++) { const y = bottom ? b.height - 1 - i : i; if (d[(y * b.width + x) * 4 + 3] > 128) { yy = y; break; } } if (yy != null) out.push([L.x + x * sx, L.y + yy * sy]); } return out; };
    const leaves = n => { const o = []; const w = m => { if (m.li != null && rig.bm[m.li]) o.push(m.li); (m.kids || []).forEach(w); }; w(n); return o; };
    rig.nodes.filter(n => n.role === 'brow' && n.parent != null).forEach(br => {
      const par = rig.nodes[br.parent], sideRe = br.side === 'L' ? /left/i : /right/i, eye = (par.kids || []).find(k => k.role === 'eye' && sideRe.test(k.name)); if (!eye) return;
      const lid = (eye.kids || []).find(k => k.role === 'lid'); if (!lid || lid.li == null) return;
      const pts = []; leaves(br).forEach(li => prof(li, true).forEach(q => pts.push(q))); const lp = prof(lid.li, true).sort((a, b) => a[0] - b[0]); if (pts.length < 3 || lp.length < 3) return;
      const step = Math.max(1, Math.floor(pts.length / 12)), P = pts.filter((q, i) => i % step === 0);
      const lidY = x => { if (x < lp[0][0] || x > lp[lp.length - 1][0]) return null; let i = 1; while (i < lp.length && lp[i][0] < x) i++; const a = lp[i - 1], b = lp[Math.min(i, lp.length - 1)], u = b[0] > a[0] ? (x - a[0]) / (b[0] - a[0]) : 0; return a[1] + (b[1] - a[1]) * u; };
      let rest = -1e9; P.forEach(([x, y]) => { const ly = lidY(x); if (ly != null) rest = Math.max(rest, y - ly); });
      br.lim = { pts: P, lid: lp, allow: Math.max(0, rest) };
    });
  }
  /* His mug carries his PatterSquid logo (MUG_LOGO, from his channel picture) instead of the slogan drawn on it: the mug
     is found in the foreground layer (the biggest light, unsaturated patch), its face is repainted with its own shading
     (the middle colour of each column, so the round shape stays) and the logo is wrapped round it like a print on a
     cylinder, shaded the same way. Only his copy in this browser changes; nothing of his art leaves it. */
  async function mugLogo(rig) {
    if (typeof MUG_LOGO === 'undefined') return; const logo = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = MUG_LOGO; }); if (!logo) return;
    const fg = rig.nodes ? rig.nodes.filter(n => n.li != null && /^f[-_ ]|geek|mug|cup/i.test(n.name)) : [];
    for (const nd of fg) {
      const b = rig.bm[nd.li], L = rig.layers[nd.li]; if (!b || !L) continue; const W = b.width, H = b.height, c = new OffscreenCanvas(W, H), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(b, 0, 0);
      const D = g.getImageData(0, 0, W, H), d = D.data, N = W * H, light = new Uint8Array(N);
      for (let i = 0; i < N; i++) { const r = d[i * 4], gg = d[i * 4 + 1], bl = d[i * 4 + 2], mn = Math.min(r, gg, bl), mx = Math.max(r, gg, bl); if (d[i * 4 + 3] > 200 && mn > 165 && mx - mn < 75) light[i] = 1; }
      // the biggest light patch with a mug's proportions
      const lab = new Int32Array(N), st = new Int32Array(N); let best = null, n = 0;
      for (let s0 = 0; s0 < N; s0++) { if (!light[s0] || lab[s0]) continue; n++; let sp = 0, cnt = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; st[sp++] = s0; lab[s0] = n;
        while (sp) { const i = st[--sp], x = i % W, y = (i / W) | 0; cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && light[j] && !lab[j]) { lab[j] = n; st[sp++] = j; } }
        const w = x1 - x0 + 1, h = y1 - y0 + 1; if (cnt > 1500 && h / w > 0.7 && h / w < 2.2 && (!best || cnt > best.cnt)) best = { n, cnt, x0, y0, x1, y1 }; }
      if (!best) continue;
      // the face: the patch with its holes (the slogan's letters, stains) filled
      const { x0, y0, x1, y1 } = best, bw = x1 - x0 + 1, bh = y1 - y0 + 1, out = new Uint8Array(bw * bh), q = [];
      const inP = (x, y) => lab[(y0 + y) * W + x0 + x] === best.n;
      for (let x = 0; x < bw; x++) for (const y of [0, bh - 1]) if (!inP(x, y)) { out[y * bw + x] = 1; q.push(y * bw + x); }
      for (let y = 0; y < bh; y++) for (const x of [0, bw - 1]) if (!inP(x, y) && !out[y * bw + x]) { out[y * bw + x] = 1; q.push(y * bw + x); }
      for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % bw, y = (i / bw) | 0; for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && !out[yy * bw + xx] && !inP(xx, yy)) { out[yy * bw + xx] = 1; q.push(yy * bw + xx); } }
      // the face row by row, from the mug's left side to its right (stains touching the edge included), steadied over a few rows
      const lo = new Array(bh).fill(1e9), hi = new Array(bh).fill(-1); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (!out[y * bw + x]) { lo[y] = Math.min(lo[y], x); hi[y] = Math.max(hi[y], x); }
      const R = 8, lo2 = lo.map((v, y) => { let m = v; for (let k = -R; k <= R; k++) if (lo[y + k] != null && hi[y + k] >= 0) m = Math.min(m, lo[y + k]); return hi[y] >= 0 ? Math.max(m, lo[y] - 6) : 1e9; }), hi2 = hi.map((v, y) => { let m = v; for (let k = -R; k <= R; k++) if (hi[y + k] != null) m = Math.max(m, hi[y + k]); return v >= 0 ? Math.min(m, hi[y] + 6) : -1; });
      const face = i => { const x = i % bw, y = (i / bw) | 0; return x >= lo2[y] && x <= hi2[y] && (!out[i] || (x > lo[y] && x < hi[y]) || light[(y0 + y) * W + x0 + x] || (d[((y0 + y) * W + x0 + x) * 4 + 3] > 200 && Math.min(d[((y0 + y) * W + x0 + x) * 4], d[((y0 + y) * W + x0 + x) * 4 + 1]) > 120)); };
      // each column's own colour (the mug's round shading), from its clean light pixels below the rim
      const top = Math.round(bh * 0.14), col = [];
      for (let x = 0; x < bw; x++) { const v = [[], [], []]; for (let y = top; y < bh; y++) { const i = (y0 + y) * W + x0 + x; if (light[i] && inP(x, y)) for (let k = 0; k < 3; k++) v[k].push(d[i * 4 + k]); } col.push(v[0].length ? v.map(a => a.sort((p2, q2) => p2 - q2)[a.length >> 1]) : null); }
      for (let x = 0; x < bw; x++) if (!col[x]) col[x] = col[x - 1] || col.find(Boolean);
      // edge distance inside the face, so the outline and the rim keep their own pixels
      const dist = new Float32Array(bw * bh).fill(1e9), q2 = []; for (let i = 0; i < bw * bh; i++) if (!face(i)) { dist[i] = 0; q2.push(i); }
      for (let qi = 0; qi < q2.length; qi++) { const i = q2[qi], x = i % bw, y = (i / bw) | 0; if (dist[i] > 6) continue; for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { const j = yy * bw + xx; if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q2.push(j); } } }
      for (let y = top; y < bh; y++) for (let x = 0; x < bw; x++) { const i = y * bw + x; if (!face(i)) continue; const k = Math.min(1, Math.max(0, (dist[i] - 2) / 3)); if (k <= 0) continue; const j = ((y0 + y) * W + x0 + x) * 4; for (let ch = 0; ch < 3; ch++) d[j + ch] = d[j + ch] * (1 - k) + col[x][ch] * k; }
      g.putImageData(D, 0, 0);
      // the logo, wrapped round the mug: narrower towards its sides, shaded like the mug
      let fx0 = bw, fx1 = 0; for (let y = Math.round(bh * 0.5) - 2; y <= Math.round(bh * 0.5) + 2; y++) for (let x = 0; x < bw; x++) if (face(y * bw + x)) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
      const faceW = fx1 - fx0, lw = faceW * 0.8, lh = Math.min(lw * logo.height / logo.width, (bh - top) * 0.78), lw2 = lh * logo.width / logo.height, cxF = x0 + (fx0 + fx1) / 2, cyF = y0 + top + (bh - top) * 0.53;
      const lc = new OffscreenCanvas(bw, bh), lg = lc.getContext('2d'), TH = 0.85, sn = Math.sin(TH), steps = Math.ceil(lw2);
      for (let k = 0; k < steps; k++) { const u0 = k / steps, u1 = (k + 1) / steps, s0 = (Math.asin((2 * u0 - 1) * sn) / TH + 1) / 2, s1 = (Math.asin((2 * u1 - 1) * sn) / TH + 1) / 2;
        lg.drawImage(logo, s0 * logo.width, 0, Math.max(0.5, (s1 - s0) * logo.width), logo.height, cxF - x0 - lw2 / 2 + u0 * lw2, cyF - y0 - lh / 2, lw2 / steps + 0.6, lh); }
      // keep it on the face and shade it like the mug (darker towards the sides)
      const LD = lg.getImageData(0, 0, bw, bh), ld = LD.data, peak = Math.max(...col.map(cc => cc[0] + cc[1] + cc[2]));
      for (let i = 0; i < bw * bh; i++) { if (!ld[i * 4 + 3]) continue; if (!face(i) || dist[i] < 4) { ld[i * 4 + 3] = 0; continue; } const x = i % bw, sh = (col[x][0] + col[x][1] + col[x][2]) / peak; for (let ch = 0; ch < 3; ch++) ld[i * 4 + ch] *= sh; }
      lg.putImageData(LD, 0, 0); g.drawImage(lc, x0, y0);
      rig.bm[nd.li] = await createImageBitmap(c); rig.mugLogo = true; return;
    }
  }
  async function make(id, rig, blobs, hands) {
    const bm = await Promise.all(blobs.map(b => b ? createImageBitmap(b) : null)); rig.bm = bm; rig.id = id; rig.layers = rig.layers.slice();
    try { await backFists(rig); } catch (e) { console.warn('back fist', e); }
    try { await sheetHands(rig, hands); } catch (e) { console.warn('hand drawings', e); }
    analyse(rig); measure(rig);
    try { browLimits(rig); } catch (e) { console.warn('brow limits', e); }
    try { await mugLogo(rig); } catch (e) { console.warn('mug logo', e); }
    mem[id] = rig; tick++; return rig;
  }

  /* ---------- keeping puppets in this browser ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-puppet', 1); r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, f) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('p', mode), q = f(t.objectStore('p')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  const put = v => tx('readwrite', s => s.put(v));
  async function list() { try { const all = await tx('readonly', s => s.getAll()); return (all || []).map(p => ({ id: p.id, name: p.name, added: p.added })).sort((a, b) => a.added - b.added); } catch (e) { return []; } }
  async function remove(id) { delete mem[id]; tick++; await tx('readwrite', s => s.delete(id)).catch(() => { }); }
  // his hand drawings sheet (a picture on green), kept with the puppet; roles: what each drawing is, in sheet order
  async function setHands(id, blob, roles) {
    const p = await tx('readonly', s => s.get(id)); if (!p) throw new Error('Load the puppet first.');
    p.hands = blob ? { blob: blob || (p.hands && p.hands.blob), roles: roles || null } : (roles && p.hands ? Object.assign({}, p.hands, { roles }) : null);
    await put(p); delete mem[id]; tick++; return load(id);
  }
  function load(id) { if (!id) return Promise.resolve(null); if (mem[id]) return Promise.resolve(mem[id]); if (loading[id]) return loading[id];
    return (loading[id] = tx('readonly', s => s.get(id)).then(p => p ? make(id, p.rig, p.blobs, p.hands) : null).catch(e => { console.warn('puppet', e); return null; }).finally(() => { delete loading[id]; })); }
  const get = id => { if (id && !mem[id] && !loading[id]) load(id); return mem[id] || null; };

  /* ---------- drawing one pose ----------
     pose: { view, mouth, blink (0 open .. 1 shut), brow: { L: [dx, dy, rot], R: [...] }, pupil: [dx, dy] (fractions of the eye),
             head: [dx, dy, rot], body: [breath], swaps: { nodeId: kidIndex }, dangle: rot, arms: { R: { dx, dy, rot, sc } } (where the wrist goes, in puppet pixels, and the hand's turn) } */
  const scr = {}; const scratch = (k, w, h) => { let c = scr[k]; if (!c || c.width !== w || c.height !== h) { c = scr[k] = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); } return c; };
  /* Smaller copies of the layers for when he is drawn small (the preview, the Studio, an export below full size): each
     layer is drawn from a copy made once at about the size it lands on screen (in steps of a sixteenth, made with high
     quality resizing in the background), so a frame does not shrink 150 big pictures every time. The full picture is
     used until a copy is ready, and whenever he is drawn at nearly full size. Two sizes are kept. */
  function mipLevel(rig, g) {   // one size for the whole drawing, from the transform he is drawn with
    const m = g.getTransform(), s = Math.hypot(m.a, m.b); if (!(s < 0.88)) return 0;
    const lv = Math.max(1, Math.ceil(s * 16)) / 16, C = rig.mips || (rig.mips = { lv: [], at: {}, want: null, n: 0 });
    if (C.at[lv]) { C.lv.splice(C.lv.indexOf(lv), 1); C.lv.push(lv); return lv; }
    if (C.want === lv) C.n++; else { C.want = lv; C.n = 1; }
    if (C.n >= 3) { const set = C.at[lv] = { bm: [], busy: true }; C.lv.push(lv); if (C.lv.length > 2) { const old = C.lv.shift(); delete C.at[old]; }
      (async () => { for (let i = 0; i < rig.bm.length; i++) { const src = rig.bm[i]; if (!src) continue; const k = lv * (rig.layers[i] ? rig.layers[i].w / src.width : 1); if (k >= 0.95) { set.bm[i] = src; continue; } try { set.bm[i] = await createImageBitmap(src, { resizeWidth: Math.max(1, Math.round(src.width * k)), resizeHeight: Math.max(1, Math.round(src.height * k)), resizeQuality: 'high' }); } catch (e) { set.bm[i] = src; } } set.busy = false; })(); }
    return lv;
  }
  function sized(rig, li, lv) { const set = lv && rig.mips && rig.mips.at[lv]; return (set && !set.busy && set.bm[li]) || rig.bm[li]; }
  function draw(g0, rig, pose) {
    const lv0 = mipLevel(rig, g0), P = pose || {}, sw = P.swaps || {}, N = rig.nodes, bm = rig.bm, L = rig.layers;
    const visible = nd => {
      const par = N[nd.parent];
      if (par && par.views) return nd.view === (rig.views[P.view] != null ? P.view : 'front');
      if (par && sw[par.id] != null && rig.swaps.some(s => s.id === par.id)) return par.kids[sw[par.id]] === nd;
      if (nd.role === 'viseme') return nd.viseme === (P.mouth || 'Neutral') || (!rig.visemes.includes(P.mouth || 'Neutral') && nd.viseme === 'Neutral');
      if (nd.role === 'blink') return (P.blink || 0) >= 0.5;
      if (nd.role === 'lid' && (P.blink || 0) >= 0.5 && par && par.kids.some(k => k.role === 'blink')) return false;   // the blink covers the eye; only the lid line goes
      return nd.vis;
    };
    if (rig._sit === undefined) { const hn = N.find(n => n.role === 'head'); rig._sit = hn ? hn.parent : -9; } const sitId = rig._sit;
    let g = g0, plainK = 0; const flush = +P.flush || 0;
    const paint = nd => {
      if (!visible(nd)) return; const op = (nd.op == null ? 255 : nd.op) / 255; if (op <= 0) return;
      g.save(); if (op < 1) g.globalAlpha *= op;
      if (P.sit && nd.id === sitId) { const [px, py] = rig.pivot.body; g.translate(P.sit[0] || 0, 0); g.translate(px, py); g.rotate(P.sit[1] || 0); g.translate(-px, -py); }   // a shift of weight: all of him, about the seat
      if (nd.role === 'head' && P.head) { const [px, py] = rig.pivot.head, [dx, dy, r] = P.head; g.translate(px + dx, py + dy); g.rotate(r || 0); if (P.head[3]) g.scale(1 + P.head[3], 1 + P.head[3]); g.translate(-px, -py); }
      if (nd.role === 'body' && P.body) { const [px, py] = rig.pivot.body, k = P.body[0] || 0; g.translate(px, py); g.scale(1 + k * 0.4, 1 + k); g.translate(-px, -py); }
      if (nd.role === 'sleeve') plainK = P.arms && P.arms[nd.side] ? +P.arms[nd.side].plain || 0 : 0;
      if (nd.role === 'hand' && P.arms && P.arms[nd.side] && P.arms[nd.side].hide) { g.restore(); return; }
      if ((nd.role === 'sleeve' || nd.role === 'hand') && P.arms && P.arms[nd.side] && rig.arms && rig.arms[nd.side]) {
        const A = rig.arms[nd.side], q = P.arms[nd.side], c1 = [A.cuff[0] + (q.dx || 0), A.cuff[1] + (q.dy || 0)];
        if (nd.role === 'sleeve') { const v0 = [A.cuff[0] - A.shoulder[0], A.cuff[1] - A.shoulder[1]], v1 = [c1[0] - A.shoulder[0], c1[1] - A.shoulder[1]], a0 = Math.atan2(v0[1], v0[0]), ang = Math.atan2(v1[1], v1[0]) - a0, k = Math.max(0.72, Math.min(1.35, Math.hypot(v1[0], v1[1]) / Math.hypot(v0[0], v0[1])));
          g.translate(A.shoulder[0], A.shoulder[1]); g.rotate(ang); g.rotate(a0); g.scale(k, 1 + (k - 1) * 0.25); g.rotate(-a0); g.translate(-A.shoulder[0], -A.shoulder[1]); }
        else { g.translate(c1[0], c1[1]); g.rotate(q.rot || 0); if (q.sc) g.scale(q.sc, q.sc); if (q.fx || q.fy) g.scale(q.fx ? -1 : 1, q.fy ? -1 : 1); g.translate(-A.cuff[0], -A.cuff[1]); } }
      if (nd.role === 'brow' && P.brow && P.brow[nd.side] && nd.box) { const b = nd.box, [dx, dy, r] = P.brow[nd.side], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; let ox = dx * (b[2] - b[0]), oy = dy * (b[3] - b[1]);
        if (nd.lim) { const cs = Math.cos(r || 0), sn = Math.sin(r || 0); let over = -1e9; nd.lim.pts.forEach(([x, y]) => { const X = cx + ox + (x - cx) * cs - (y - cy) * sn, Y = cy + oy + (x - cx) * sn + (y - cy) * cs, ly = lidAt(nd.lim.lid, X); if (ly != null) over = Math.max(over, Y - ly); }); if (over > nd.lim.allow) oy -= over - nd.lim.allow; }   // never down into the eye
        g.translate(cx + ox, cy + oy); g.rotate(r || 0); g.translate(-cx, -cy); }
      if (nd.role === 'pupil' && P.pupil && nd.box) { const par = N[nd.parent], eb = par && par.box, w = eb ? eb[2] - eb[0] : 20, h = eb ? eb[3] - eb[1] : 20; g.translate(P.pupil[0] * w * 0.28, P.pupil[1] * h * 0.2); }
      if (nd.role === 'dangle' && P.dangle && nd.box) { const b = nd.box, cx = (b[0] + b[2]) / 2; g.translate(cx, b[1]); g.rotate(P.dangle * (nd.id % 2 ? 1 : -0.8)); g.translate(-cx, -b[1]); }
      if (nd.role === 'head' && flush > 0.01 && rig.headBox) {
        // red in the face: the head drawn on its own, multiplied with red rising from the neck, then put back
        const hb = rig.headBox, w = hb[2] - hb[0], h = hb[3] - hb[1], c = scratch('flush', w, h), m = scratch('flushm', w, h), cg = c.getContext('2d'), mg = m.getContext('2d'), outer = g;
        cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, w, h); cg.translate(-hb[0], -hb[1]); g = cg; for (let i = nd.kids.length - 1; i >= 0; i--) paint(nd.kids[i]); g = outer;
        cg.setTransform(1, 0, 0, 1, 0, 0); mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = 'copy'; mg.drawImage(c, 0, 0);
        const gr = cg.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, `rgba(230,60,40,${Math.min(1, 0.85 * flush)})`); gr.addColorStop(0.55, `rgba(230,70,50,${Math.min(1, 0.6 * flush)})`); gr.addColorStop(1, `rgba(235,90,70,${Math.min(1, 0.25 * flush)})`);
        cg.globalCompositeOperation = 'multiply'; cg.fillStyle = gr; cg.fillRect(0, 0, w, h); cg.globalCompositeOperation = 'destination-in'; cg.drawImage(m, 0, 0); cg.globalCompositeOperation = 'source-over';
        g.drawImage(c, hb[0], hb[1], w, h);
      }
      else if (nd.group) { for (let i = nd.kids.length - 1; i >= 0; i--) paint(nd.kids[i]); }
      else { const q = L[nd.li], b = q && bm[nd.li] ? sized(rig, nd.li, lv0) : null; if (b && q) { g.drawImage(b, q.x, q.y, q.w, q.h); const pb = plainK > 0.01 && rig.plainBm && rig.plainBm[nd.li]; if (pb) { g.globalAlpha *= Math.min(1, plainK); g.drawImage(pb, q.x, q.y, q.w, q.h); } } }
      g.restore();
    };
    paint(rig.tree);
  }
  // names of the things a script can trigger: hands, poses, costumes (as found in the swap sets)
  const triggerNames = rig => Object.keys(rig.triggers || {});
  function forWorkers(id) { const r = mem[id]; if (!r) return null; const { mips, sheet, ...rest } = r; return rest; }
  function adopt(r) { if (!r || !r.id) return; r.mips = null; mem[r.id] = r; tick++; }
  return { forWorkers, adopt, importFile, setHands, readPSD, unzip, list, load, get, remove, draw, triggerNames, VISEMES, get tick() { return tick; }, _mem: mem };
})();

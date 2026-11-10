/* The Thumbnail tab (module `thumb`): a picture editor for YouTube thumbnails, in place of Canva and remove.bg.
   cfg: { v, fmt ('16:9' 1280x720, '9:16' 1080x1920, '1:1' 1080x1080), bg: { k: colour|grad|radial|image, c1, c2, ang,
   asset, blur, dim }, layers: [...] } drawn first to last. Every layer has id, k, name, x, y (its middle, in picture
   pixels), w, h, rot (degrees), op, flipH, flipV, hide, lock, shadow { on, c, b, x, y, o }, glow { on, c, b }.
   image: asset (a CutMedia picture, '' is an empty slot to drop one into), crop { l, t, r, b } (fractions), adj { br, co,
   sa, wa } , cut { mask, fg, on } (assets from Cutout), edge { feather, shrink }, outline { on, c, w }.
   text: text, font, size, weight, italic, cols (a colour per line, the last one repeats), align, lh, ls, upper, fit (every
   line stretched to the box's width), stroke { w, c }, stroke2 { w, c }, box { on, c, pad, r, op }.
   shape: shape (rect, round, circle, arrow, line, star, burst, tri, banner), fill, fillOn, stroke, sw, r.
   Pictures live in CutMedia (IndexedDB); the cfg only holds their ids, so undo and saving stay small. */
const Thumb = (() => {
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, r1 = v => Math.round(v * 10) / 10;
  const DIMS = { '16:9': [1280, 720], '9:16': [1080, 1920], '1:1': [1080, 1080] };
  const dims = cfg => DIMS[cfg && cfg.fmt] || DIMS['16:9'];
  const FONTS = [
    ['Oswald', 700, 'g'], ['Anton', 400, 'g'], ['Bebas Neue', 400, 'g'], ['Archivo Black', 400, 'g'], ['Roboto Condensed', 900, 'g'], ['Barlow Condensed', 800, 'g'], ['Montserrat', 900, 'g'], ['Poppins', 900, 'g'],
    ['Rubik', 900, 'g'], ['Bangers', 400, 'g'], ['Luckiest Guy', 400, 'g'], ['Permanent Marker', 400, 'g'], ['Bowlby One', 400, 'g'], ['Black Ops One', 400, 'g'],
    ['Big Shoulders', 700, 'b'], ['Erica One', 400, 'b'], ['Boldonse', 400, 'b'], ['Bricolage Grotesque', 700, 'b'], ['Impact', 400, 's'], ['Arial Black', 900, 's']];
  const GURL = 'https://fonts.googleapis.com/css2?' + FONTS.filter(f => f[2] === 'g').map(f => 'family=' + f[0].replace(/ /g, '+') + (f[1] !== 400 ? ':wght@' + f[1] : '')).join('&') + '&display=swap';
  let fontsLinked = false; const mine = new Set();
  function linkFonts() { if (fontsLinked || typeof document === 'undefined') return; fontsLinked = true; try { document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: GURL })); } catch (e) { } loadMyFonts(); }
  const weightOf = f => { const x = FONTS.find(q => q[0] === f); return x ? x[1] : 700; };
  const nid = () => 'L' + Math.random().toString(36).slice(2, 8);

  /* ---------- his own fonts and templates (kept in this browser) ---------- */
  let dbp = null; const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-thumb', 1); r.onupgradeneeded = () => { r.result.createObjectStore('fonts'); r.result.createObjectStore('tpl'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const all = async st => { const d = await db(); return new Promise(res => { const out = [], q = d.transaction(st).objectStore(st).openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return res(out); out.push([c.key, c.value]); c.continue(); }; q.onerror = () => res(out); }); };
  const putK = async (st, k, v) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(st, 'readwrite'); t.objectStore(st).put(v, k); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }); };
  const delK = async (st, k) => { const d = await db(); return new Promise(res => { const t = d.transaction(st, 'readwrite'); t.objectStore(st).delete(k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); };
  async function loadMyFonts() { try { for (const [name, blob] of await all('fonts')) { if (mine.has(name)) continue; const ff = new FontFace(name, await blob.arrayBuffer()); await ff.load(); document.fonts.add(ff); mine.add(name); } redraw(); } catch (e) { } }
  async function addFont(file) { const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[^\w ]+/g, ' ').trim().slice(0, 40) || 'My font'; const ff = new FontFace(name, await file.arrayBuffer()); await ff.load(); document.fonts.add(ff); mine.add(name); await putK('fonts', name, file); return name; }

  /* ---------- new layers ---------- */
  const FX0 = () => ({ shadow: { on: false, c: '#000000', b: 24, x: 0, y: 8, o: 0.7 }, glow: { on: false, c: '#ffffff', b: 30 } });
  const base = (k, o) => Object.assign({ id: nid(), k, name: '', x: 640, y: 360, w: 400, h: 300, rot: 0, op: 1, flipH: false, flipV: false, hide: false, lock: false }, FX0(), o);
  const newImage = o => base('image', Object.assign({ asset: '', crop: { l: 0, t: 0, r: 0, b: 0 }, adj: { br: 0, co: 0, sa: 0, wa: 0 }, cut: null, edge: { feather: 0, shrink: 0 }, outline: { on: false, c: '#ffffff', w: 12 } }, o));
  const newText = o => base('text', Object.assign({ text: 'YOUR\nWORDS', font: 'Oswald', size: 120, weight: 0, italic: false, cols: ['#ffffff'], align: 'center', lh: 1, ls: 0, upper: true, fit: false, stroke: { w: 0, c: '#000000' }, stroke2: { w: 0, c: '#ffffff' }, box: { on: false, c: '#e8322c', pad: 18, r: 10, op: 1 } }, o));
  const newShape = o => base('shape', Object.assign({ shape: 'rect', fill: '#e8322c', fillOn: true, stroke: '#ffffff', sw: 0, r: 0 }, o));
  const defaults = () => ({ v: 1, fmt: '16:9', bg: { k: 'colour', c1: '#000000', c2: '#1d2b4f', ang: 90, asset: '', blur: 0, dim: 0 }, layers: TEMPLATES.split.make('16:9') });

  /* ---------- ready made layouts ---------- */
  const TEMPLATES = {
    split: { name: 'Head and two lines', note: 'Black, a cut out head on the left, two lines of capitals on the right: white, then the punchline in red.',
      bg: { k: 'colour', c1: '#000000' }, make: f => { const [W, H] = DIMS[f] || DIMS['16:9'], v = W < H;
        return [newImage({ name: 'Picture', x: v ? W / 2 : W * 0.27, y: v ? H * 0.68 : H * 0.55, w: v ? W * 0.95 : W * 0.56, h: v ? H * 0.62 : H * 0.92, slot: true, autoCut: true }),
          newText({ name: 'Words', text: 'TWO WORD\nPUNCHLINE', x: v ? W / 2 : W * 0.73, y: v ? H * 0.2 : H * 0.42, w: v ? W * 0.86 : W * 0.48, size: v ? 170 : 132, font: 'Oswald', cols: ['#ffffff', '#ff3b30'], fit: true, lh: 1.02 })]; } },
    shock: { name: 'Shocked face and arrow', note: 'Bright background, your face with a white sticker edge, big outlined words and a red arrow.',
      bg: { k: 'radial', c1: '#ffd21f', c2: '#ff7a00' }, make: f => { const [W, H] = DIMS[f] || DIMS['16:9'], v = W < H;
        return [newImage({ name: 'Picture', x: v ? W / 2 : W * 0.7, y: v ? H * 0.66 : H * 0.56, w: v ? W * 0.9 : W * 0.5, h: v ? H * 0.6 : H * 0.88, slot: true, autoCut: true, outline: { on: true, c: '#ffffff', w: 14 }, shadow: { on: true, c: '#000000', b: 30, x: 0, y: 10, o: 0.6 } }),
          newText({ name: 'Words', text: 'NO\nWAY', x: v ? W / 2 : W * 0.27, y: v ? H * 0.2 : H * 0.42, w: v ? W * 0.8 : W * 0.44, size: v ? 260 : 210, font: 'Anton', cols: ['#ffffff'], stroke: { w: 16, c: '#000000' }, fit: true }),
          newShape({ name: 'Arrow', shape: 'arrow', x: v ? W * 0.3 : W * 0.47, y: v ? H * 0.42 : H * 0.7, w: 230, h: 120, rot: v ? 60 : -20, fill: '#e8322c', stroke: '#ffffff', sw: 8 })]; } },
    word: { name: 'One big word', note: 'A dark gradient, one huge word with a thick outline, the picture in the corner.',
      bg: { k: 'grad', c1: '#0b1530', c2: '#3a0f2e', ang: 120 }, make: f => { const [W, H] = DIMS[f] || DIMS['16:9'], v = W < H;
        return [newImage({ name: 'Picture', x: v ? W / 2 : W * 0.76, y: v ? H * 0.7 : H * 0.58, w: v ? W : W * 0.5, h: v ? H * 0.6 : H * 0.85, slot: true, autoCut: true, glow: { on: true, c: '#4cc3ff', b: 40 } }),
          newText({ name: 'Word', text: 'MADNESS', x: v ? W / 2 : W * 0.36, y: v ? H * 0.22 : H * 0.36, w: v ? W * 0.9 : W * 0.66, size: 190, font: 'Bebas Neue', cols: ['#ffe14d'], stroke: { w: 12, c: '#000000' }, stroke2: { w: 26, c: '#ffffff' }, fit: true }),
          newText({ name: 'Small words', text: 'YOU WILL NOT BELIEVE THIS', x: v ? W / 2 : W * 0.36, y: v ? H * 0.32 : H * 0.62, w: v ? W * 0.8 : W * 0.6, size: 48, font: 'Oswald', cols: ['#ffffff'], box: { on: true, c: '#e8322c', pad: 14, r: 8, op: 1 } })]; } },
    versus: { name: 'Versus', note: 'Two pictures face off with a VS burst in the middle.',
      bg: { k: 'grad', c1: '#c4161c', c2: '#0b3d91', ang: 90 }, make: f => { const [W, H] = DIMS[f] || DIMS['16:9'], v = W < H;
        return [newImage({ name: 'Left picture', x: v ? W / 2 : W * 0.25, y: v ? H * 0.27 : H * 0.55, w: v ? W * 0.8 : W * 0.48, h: v ? H * 0.45 : H * 0.9, slot: true, autoCut: true, outline: { on: true, c: '#ffffff', w: 10 } }),
          newImage({ name: 'Right picture', x: v ? W / 2 : W * 0.75, y: v ? H * 0.75 : H * 0.55, w: v ? W * 0.8 : W * 0.48, h: v ? H * 0.45 : H * 0.9, slot: true, autoCut: true, flipH: true, outline: { on: true, c: '#ffffff', w: 10 } }),
          newShape({ name: 'Burst', shape: 'burst', x: W / 2, y: H / 2, w: 260, h: 260, fill: '#ffd21f', stroke: '#000000', sw: 8 }),
          newText({ name: 'VS', text: 'VS', x: W / 2, y: H / 2, w: 220, size: 120, font: 'Anton', cols: ['#000000'] })]; } },
    news: { name: 'Breaking', note: 'Your picture full size with a red banner and a headline strip along the bottom.',
      bg: { k: 'colour', c1: '#111111' }, make: f => { const [W, H] = DIMS[f] || DIMS['16:9'], v = W < H;
        return [newImage({ name: 'Picture', x: W / 2, y: H / 2, w: W, h: H, slot: true }),
          newShape({ name: 'Strip', shape: 'rect', x: W / 2, y: v ? H * 0.82 : H * 0.84, w: W, h: v ? 260 : 170, fill: '#ffffff' }),
          newShape({ name: 'Banner', shape: 'rect', x: v ? W * 0.3 : W * 0.17, y: v ? H * 0.75 : H * 0.72, w: v ? 520 : 360, h: v ? 110 : 80, fill: '#e8322c' }),
          newText({ name: 'Banner words', text: 'BREAKING', x: v ? W * 0.3 : W * 0.17, y: v ? H * 0.75 : H * 0.72, w: v ? 480 : 330, size: v ? 80 : 58, font: 'Oswald', cols: ['#ffffff'], fit: true }),
          newText({ name: 'Headline', text: 'YOUR HEADLINE HERE', x: W / 2, y: v ? H * 0.84 : H * 0.865, w: W * 0.9, size: v ? 92 : 78, font: 'Oswald', cols: ['#111111'], fit: true })]; } }
  };
  function applyTemplate(cfg, k) { const T = TEMPLATES[k]; if (!T) return; const old = (cfg.layers || []).filter(L => L.k === 'image' && L.asset).map(L => L.asset);
    cfg.bg = Object.assign({ k: 'colour', c1: '#000000', c2: '#1d2b4f', ang: 90, asset: '', blur: 0, dim: 0 }, T.bg); cfg.layers = T.make(cfg.fmt);
    // keep his pictures: they go into the new slots in order
    cfg.layers.filter(L => L.k === 'image' && L.slot).forEach((L, i) => { if (old[i]) { L.asset = old[i]; fitImage(L); } }); }

  /* ---------- drawing ---------- */
  const imgCache = new Map();   // composite of a picture with its cut out, edge and colour, keyed by what went into it
  const bmOf = id => (id && typeof CutMedia !== 'undefined') ? CutMedia.image(id) : null;
  const aspectOf = L => { const b = bmOf(L.asset); if (!b) return L.w / Math.max(1, L.h); const c = L.crop || {}; return (b.width * (1 - (c.l || 0) - (c.r || 0))) / Math.max(1, b.height * (1 - (c.t || 0) - (c.b || 0))); };
  // a new picture fills the slot it went into (contain), keeping its shape
  function fitImage(L, cover) { const a = aspectOf(L); if (!isFinite(a) || a <= 0) return; const bw = L.w, bh = L.h; if ((bw / bh > a) !== !!cover) { L.h = bh; L.w = bh * a; } else { L.w = bw; L.h = bw / a; } if (cover) { } }
  function composite(L, dispScale) {
    const src = bmOf(L.asset); if (!src) return null; const cut = L.cut && L.cut.on !== false && L.cut.mask ? L.cut : null;
    const m = cut ? bmOf(cut.mask) : null, fg = cut ? bmOf(cut.fg) : null; if (cut && (!m || !fg)) return null;
    const c = L.crop || {}, A = L.adj || {}, E2 = L.edge || {}, O = L.outline || {};
    const tw = Math.min(2560, Math.max(64, Math.round(L.w * dispScale * 1.5))), key = [L.asset, cut && cut.mask, cut && cut.fg, c.l, c.t, c.r, c.b, A.br, A.co, A.sa, A.wa, E2.feather, E2.shrink, O.on && O.w, O.on && O.c, tw].join('|');
    let hit = imgCache.get(L.id); if (hit && hit.key === key) return hit;
    const sw = src.width, sh = src.height, sx = (c.l || 0) * sw, sy = (c.t || 0) * sh, cw = Math.max(1, sw * (1 - (c.l || 0) - (c.r || 0))), ch = Math.max(1, sh * (1 - (c.t || 0) - (c.b || 0)));
    const sc = Math.min(1.5, tw / cw), W = Math.max(1, Math.round(cw * sc)), Hh = Math.max(1, Math.round(ch * sc)), pad = O.on ? Math.ceil((+O.w || 0) / Math.max(1e-3, L.w / W)) + 2 : 0;
    const cv = document.createElement('canvas'); cv.width = W + pad * 2; cv.height = Hh + pad * 2; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    const fl = []; if (A.br) fl.push('brightness(' + (1 + A.br) + ')'); if (A.co) fl.push('contrast(' + (1 + A.co) + ')'); if (A.sa) fl.push('saturate(' + (1 + A.sa) + ')'); g.filter = fl.join(' ') || 'none';
    if (cut) { // colours from the clean up, the mask (softened, pulled in) on top
      g.drawImage(fg, sx / sw * fg.width, sy / sh * fg.height, cw / sw * fg.width, ch / sh * fg.height, pad, pad, W, Hh); g.filter = 'none';
      const mc = document.createElement('canvas'); mc.width = W; mc.height = Hh; const mg = mc.getContext('2d'); const sh2 = (+E2.shrink || 0) * W / L.w, fe = (+E2.feather || 0) * W / L.w;
      if (fe > 0.2) mg.filter = 'blur(' + (fe / 2) + 'px)'; mg.drawImage(m, sx / sw * m.width, sy / sh * m.height, cw / sw * m.width, ch / sh * m.height, 0, 0, W, Hh); mg.filter = 'none';
      if (sh2 > 0.5) { const d = mg.getImageData(0, 0, W, Hh), a = new Float32Array(W * Hh); for (let i = 0; i < a.length; i++) a[i] = d.data[i * 4 + 3] < 128 ? 0 : 1e9; edt(a, W, Hh); for (let i = 0; i < a.length; i++) { const r = Math.sqrt(a[i]); d.data[i * 4 + 3] = Math.round(d.data[i * 4 + 3] * cl((r - sh2) / 1.5, 0, 1)); } mg.putImageData(d, 0, 0); }
      g.globalCompositeOperation = 'destination-in'; g.drawImage(mc, pad, pad); g.globalCompositeOperation = 'source-over';
    } else { g.drawImage(src, sx, sy, cw, ch, pad, pad, W, Hh); g.filter = 'none'; }
    if (A.wa) { const d = g.getImageData(0, 0, cv.width, cv.height), p = d.data, k = A.wa * 0.18; for (let i = 0; i < p.length; i += 4) { p[i] = p[i] * (1 + k); p[i + 2] = p[i + 2] * (1 - k); p[i + 1] = p[i + 1] * (1 + k * 0.25); } g.putImageData(d, 0, 0); }
    let out = cv;
    if (O.on && (+O.w || 0) > 0) { // a sticker edge: everything within w of the picture, in the outline colour, behind it
      const w2 = cv.width, h2 = cv.height, d = g.getImageData(0, 0, w2, h2), a = new Float32Array(w2 * h2); for (let i = 0; i < a.length; i++) a[i] = d.data[i * 4 + 3] >= 128 ? 0 : 1e9; edt(a, w2, h2);
      const R = (+O.w) * W / L.w, oc = document.createElement('canvas'); oc.width = w2; oc.height = h2; const og = oc.getContext('2d'), od = og.createImageData(w2, h2), col = hexRgb(O.c || '#ffffff');
      for (let i = 0; i < a.length; i++) { const r = Math.sqrt(a[i]), v = cl(R + 0.5 - r, 0, 1); od.data[i * 4] = col[0]; od.data[i * 4 + 1] = col[1]; od.data[i * 4 + 2] = col[2]; od.data[i * 4 + 3] = Math.round(v * 255); }
      og.putImageData(od, 0, 0); og.drawImage(cv, 0, 0); out = oc;
    }
    hit = { key, cv: out, pad, W, H: Hh }; imgCache.set(L.id, hit); return hit;
  }
  // exact squared distance transform (Felzenszwalb and Huttenlocher), in place: 0 inside, 1e9 outside
  function edt(f, w, h) {
    const n = Math.max(w, h), d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1), g = new Float32Array(n);
    const pass = (get, set, len) => { let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20; for (let q = 0; q < len; q++) g[q] = get(q);
      for (let q = 1; q < len; q++) { let s; for (;;) { const p = v[k]; s = ((g[q] + q * q) - (g[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k]) { k--; if (k < 0) { k = 0; break; } continue; } break; } k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; }
      k = 0; for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + g[p]; } for (let q = 0; q < len; q++) set(q, d[q]); };
    for (let x = 0; x < w; x++) pass(y => f[y * w + x], (y, val) => { f[y * w + x] = val; }, h);
    for (let y = 0; y < h; y++) pass(x => f[y * w + x], (x, val) => { f[y * w + x] = val; }, w);
  }
  const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); const n = m ? parseInt(m[1], 16) : 0xffffff; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const fontStr = (L, size) => (L.italic ? 'italic ' : '') + (L.weight || weightOf(L.font)) + ' ' + Math.max(1, size) + 'px "' + (L.font || 'Oswald') + '", "Arial Black", Impact, sans-serif';
  // Lines of a text layer with their sizes and widths; fit stretches each line across the box width
  function textLayout(g, L) {
    const lines = String(L.text == null ? '' : L.text).split('\n').map(s => L.upper ? s.toUpperCase() : s), out = []; let y = 0;
    g.letterSpacing = (L.ls || 0) + 'px';
    for (const s of lines) { let size = +L.size || 100; g.font = fontStr(L, size); let w = g.measureText(s || ' ').width;
      if (L.fit && s.trim()) { size = size * (L.w - (L.box && L.box.on ? 2 * (+L.box.pad || 0) : 0)) / Math.max(1, w); size = Math.min(size, (+L.size || 100) * 3); g.font = fontStr(L, size); w = g.measureText(s).width; }
      const m = g.measureText(s || 'H'), asc = m.actualBoundingBoxAscent || size * 0.72, desc = m.actualBoundingBoxDescent || size * 0.05, cap = L.fit ? asc + desc : size;
      out.push({ s, size, w, asc, desc, y: y, hgt: cap }); y += cap * (L.fit ? 1 : 1) + (L.lh != null ? (L.lh - 1) * size : 0) + (L.fit ? size * 0.08 : size * 0.18); }
    const total = out.length ? out[out.length - 1].y + out[out.length - 1].hgt : 0; return { lines: out, total };
  }
  function drawText(g, L, measureOnly) {
    const T = textLayout(g, L), B = L.box || {}, pad = B.on ? +B.pad || 0 : 0, H2 = T.total + pad * 2; if (measureOnly) return H2;
    const top = -H2 / 2 + pad, al = L.align || 'center', ax = al === 'left' ? -L.w / 2 + pad : al === 'right' ? L.w / 2 - pad : 0;
    g.textAlign = al; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
    if (B.on) { g.save(); g.globalAlpha *= B.op == null ? 1 : +B.op; g.fillStyle = B.c || '#e8322c'; const bw = L.fit ? L.w : Math.max(...T.lines.map(q => q.w), 1) + pad * 2, bx = al === 'left' ? -L.w / 2 : al === 'right' ? L.w / 2 - bw : -bw / 2; rr(g, bx, -H2 / 2, bw, H2, +B.r || 0); g.fill(); g.restore(); }
    const cols = Array.isArray(L.cols) && L.cols.length ? L.cols : ['#ffffff'];
    const pass = (fn) => T.lines.forEach((q, i) => { g.font = fontStr(L, q.size); g.letterSpacing = (L.ls || 0) + 'px'; fn(q, i, top + q.y + q.asc); });
    const S2 = L.stroke2 || {}, S1 = L.stroke || {};
    if (+S2.w > 0) pass((q, i, y) => { g.strokeStyle = S2.c || '#fff'; g.lineWidth = (2 * (+S1.w || 0) + 2 * +S2.w); g.strokeText(q.s, ax, y); });
    if (+S1.w > 0) pass((q, i, y) => { g.strokeStyle = S1.c || '#000'; g.lineWidth = 2 * +S1.w; g.strokeText(q.s, ax, y); });
    g.save(); if (+S1.w > 0 || +S2.w > 0) g.shadowColor = 'transparent'; pass((q, i, y) => { g.fillStyle = cols[Math.min(i, cols.length - 1)]; g.fillText(q.s, ax, y); }); g.restore();
    return H2;
  }
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function shapePath(g, L) {
    const w = L.w, h = L.h, x = -w / 2, y = -h / 2; g.beginPath();
    switch (L.shape) {
      case 'circle': g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); break;
      case 'round': rr(g, x, y, w, h, Math.min(w, h) * 0.22); break;
      case 'tri': g.moveTo(0, y); g.lineTo(-x, -y); g.lineTo(x, -y); g.closePath(); break;
      case 'line': g.rect(x, -Math.max(2, h * 0.08) / 2, w, Math.max(2, h * 0.08)); break;
      case 'arrow': { const sh = h * 0.42, hl = Math.min(w * 0.45, h * 0.95); g.moveTo(x, -sh / 2); g.lineTo(-x - hl, -sh / 2); g.lineTo(-x - hl, y); g.lineTo(-x, 0); g.lineTo(-x - hl, -y); g.lineTo(-x - hl, sh / 2); g.lineTo(x, sh / 2); g.closePath(); break; }
      case 'star': case 'burst': { const n = L.shape === 'star' ? 5 : 14, ri = L.shape === 'star' ? 0.45 : 0.72; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : 1; const px = Math.cos(a) * w / 2 * r, py = Math.sin(a) * h / 2 * r; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); break; }
      case 'banner': { const k = Math.min(w * 0.08, h * 0.5); g.moveTo(x, y); g.lineTo(-x, y); g.lineTo(-x - k, 0); g.lineTo(-x, -y); g.lineTo(x, -y); g.lineTo(x + k, 0); g.closePath(); break; }
      default: if (+L.r > 0) rr(g, x, y, w, h, +L.r); else g.rect(x, y, w, h);
    }
  }
  // Height of a text layer follows its words; everything else keeps its own
  function sizeOf(L, g) { if (L.k === 'text') { L.h = drawText(g || meas(), L, true); } return [L.w, L.h]; }
  let measCv = null; const meas = () => (measCv || (measCv = document.createElement('canvas'))).getContext('2d');
  function drawBg(g, cfg, W, H) {
    const B = cfg.bg || {}; g.save();
    if (B.k === 'grad') { const a = (+B.ang || 0) * Math.PI / 180, dx = Math.cos(a) * W / 2, dy = Math.sin(a) * H / 2, gr = g.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy); gr.addColorStop(0, B.c1 || '#000'); gr.addColorStop(1, B.c2 || '#333'); g.fillStyle = gr; }
    else if (B.k === 'radial') { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2); gr.addColorStop(0, B.c1 || '#fff'); gr.addColorStop(1, B.c2 || '#000'); g.fillStyle = gr; }
    else g.fillStyle = B.c1 || '#000000';
    g.fillRect(0, 0, W, H);
    if (B.k === 'image') { const b = bmOf(B.asset); if (b) { const s = Math.max(W / b.width, H / b.height), bl = +B.blur || 0; if (bl) g.filter = 'blur(' + bl + 'px)'; g.drawImage(b, (W - b.width * s) / 2 - bl * 2, (H - b.height * s) / 2 - bl * 2, b.width * s + bl * 4, b.height * s + bl * 4); g.filter = 'none'; } if (+B.dim) { g.fillStyle = 'rgba(0,0,0,' + cl(+B.dim, 0, 1) + ')'; g.fillRect(0, 0, W, H); } }
    g.restore();
  }
  // Each layer is drawn on its own (flat), then laid on: glow and shadow first as blurred silhouettes, then the layer once,
  // so see-through layers and soft cut out edges never double up
  function layerArt(L, k, opts) {
    if (L.k === 'image') { const C = composite(L, k); if (C) return { cv: C.cv, x: -L.w / 2 - C.pad * L.w / C.W, y: -L.h / 2 - C.pad * L.h / C.H, w: C.cv.width * L.w / C.W, h: C.cv.height * L.h / C.H };
      if (opts.clean) return null; }
    if (L.k === 'text') sizeOf(L);
    const sw = L.k === 'text' ? 2 * ((+(L.stroke || {}).w || 0) + (+(L.stroke2 || {}).w || 0)) + (+L.size || 100) * 0.4 : L.k === 'shape' ? (+L.sw || 0) + 4 : 8;
    const pw = L.w + sw * 2, ph = L.h + sw * 2, cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(pw * k)); cv.height = Math.max(1, Math.ceil(ph * k));
    const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, pw * k / 2, ph * k / 2);
    if (L.k === 'text') drawText(g, L);
    else if (L.k === 'shape') { shapePath(g, L); if (L.fillOn !== false) { g.fillStyle = L.fill || '#e8322c'; g.fill(); } if (+L.sw > 0) { g.lineJoin = 'round'; g.strokeStyle = L.stroke || '#fff'; g.lineWidth = +L.sw; g.stroke(); } }
    else { // an empty picture slot
      g.setLineDash([18, 12]); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4; rr(g, -L.w / 2, -L.h / 2, L.w, L.h, 18); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fill(); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '600 ' + Math.max(18, Math.min(34, L.w / 14)) + 'px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(L.asset ? 'Loading…' : 'Drop a picture here', 0, -6);
      if (!L.asset) { g.font = Math.max(14, Math.min(24, L.w / 20)) + 'px Arial, sans-serif'; g.fillText('or double click to choose one', 0, 26); } }
    return { cv, x: -pw / 2, y: -ph / 2, w: pw, h: ph, slot: L.k === 'image' };
  }
  function silhouette(cv, col) { const s = document.createElement('canvas'); s.width = cv.width; s.height = cv.height; const g = s.getContext('2d'); g.drawImage(cv, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, s.width, s.height); return s; }
  // Draws the whole thumbnail into g at size W x H (picture pixels scaled by W / its width). opts.hideSel: a layer id left out (being brushed); opts.clean: no empty slots
  function render(g, cfg, W, H, opts = {}) {
    const [PW, PH] = dims(cfg), k = W / PW; g.save(); g.setTransform(k, 0, 0, k, 0, 0); drawBg(g, cfg, PW, PH);
    for (const L of cfg.layers || []) { if (!L || L.hide || L.id === opts.hideSel) continue;
      const A = layerArt(L, k, opts); if (!A) continue; const S = L.shadow || {}, G = L.glow || {}, op = cl(L.op == null ? 1 : +L.op, 0, 1);
      const place = (dx, dy) => { g.translate((+L.x || 0) + dx, (+L.y || 0) + dy); if (L.rot) g.rotate(L.rot * Math.PI / 180); g.scale(L.flipH ? -1 : 1, L.flipV ? -1 : 1); };
      if (G.on && !A.slot) { const sil = silhouette(A.cv, G.c || '#ffffff'); g.save(); place(0, 0); g.globalAlpha = op; g.filter = 'blur(' + Math.max(0.5, (+G.b || 20) * k / 2) + 'px)'; g.drawImage(sil, A.x, A.y, A.w, A.h); g.drawImage(sil, A.x, A.y, A.w, A.h); g.restore(); }
      if (S.on && !A.slot) { const sil = silhouette(A.cv, S.c || '#000000'); g.save(); place(+S.x || 0, +S.y || 0); g.globalAlpha = op * (S.o == null ? 0.7 : cl(+S.o, 0, 1)); if (+S.b > 0) g.filter = 'blur(' + Math.max(0.5, (+S.b) * k / 2) + 'px)'; g.drawImage(sil, A.x, A.y, A.w, A.h); g.restore(); }
      g.save(); place(0, 0); g.globalAlpha = op; g.imageSmoothingQuality = 'high'; g.drawImage(A.cv, A.x, A.y, A.w, A.h); g.restore(); }
    g.restore();
  }

  /* ---------- the workspace ---------- */
  const W = { cfg: null, changed: null, root: null, sel: null, drawer: 'tpl', cv: null, ov: null, stage: null, view: { k: 1, ox: 0, oy: 0 }, drag: null, guides: [], feed: false, brush: null, busy: '', say: '', clip: null };
  const hooks = { videoFrame: null };
  const layerById = id => (W.cfg && W.cfg.layers || []).find(L => L.id === id) || null;
  const selL = () => layerById(W.sel);
  let raf = 0; function redraw() { if (raf || !W.root || !document.body.classList.contains('thb')) return; raf = requestAnimationFrame(() => { raf = 0; paint(); }); }
  function changed(full) { if (!W.changed) return; W.changed(); if (full) panels(); redraw(); }
  // the picture, drawn at the size it shows on screen (sharp on any screen), with the selection on its own layer above
  function paint() {
    const cv = W.cv, ov = W.ov, st = W.stage; if (!cv || !st || !W.cfg) return; const [PW, PH] = dims(W.cfg), r = st.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const k = Math.min((r.width - 40) / PW, (r.height - 40) / PH); if (!(k > 0)) return; const w = Math.round(PW * k), h = Math.round(PH * k);
    W.view = { k, ox: Math.round((r.width - w) / 2), oy: Math.round((r.height - h) / 2) };
    for (const c of [cv, ov]) { c.style.left = W.view.ox + 'px'; c.style.top = W.view.oy + 'px'; c.style.width = w + 'px'; c.style.height = h + 'px'; }
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ov.width = cv.width; ov.height = cv.height; }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); render(g, W.cfg, cv.width, cv.height, { hideSel: W.brush ? W.brush.id : null });
    if (W.brush) paintBrush(g, cv.width / PW);
    paintOverlay(); if (W.feed) paintFeed();
  }
  function corners(L) { const a = (L.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hw = L.w / 2, hh = L.h / 2; return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [L.x + x * c - y * s, L.y + x * s + y * c]); }
  function paintOverlay() {
    const ov = W.ov, g = ov.getContext('2d'), [PW] = dims(W.cfg), k = ov.width / PW; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, ov.width, ov.height); g.setTransform(k, 0, 0, k, 0, 0);
    const px = 1 / k;
    if (W.cfg.fmt === '16:9' && !W.brush) { // where YouTube puts the video's length
      const [PW2, PH2] = dims(W.cfg); g.save(); g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, PW2 - 150, PH2 - 74, 128, 52, 8); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '600 30px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8:29', PW2 - 86, PH2 - 47); g.restore(); }
    for (const q of W.guides) { g.save(); g.strokeStyle = '#ff3fb4'; g.lineWidth = 1.5 * px; g.beginPath(); if (q.x != null) { g.moveTo(q.x, -10); g.lineTo(q.x, 1e4); } else { g.moveTo(-10, q.y); g.lineTo(1e4, q.y); } g.stroke(); g.restore(); }
    const L = selL(); if (!L || L.hide || W.brush) return; const C = corners(L);
    g.save(); g.strokeStyle = '#f5821f'; g.lineWidth = 2 * px; g.beginPath(); C.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
    if (!L.lock) { handles(L).forEach(hd => { g.beginPath(); if (hd.k === 'rot') { g.arc(hd.x, hd.y, 8 * px, 0, Math.PI * 2); g.fillStyle = '#f5821f'; g.fill(); } else { g.rect(hd.x - 6 * px, hd.y - 6 * px, 12 * px, 12 * px); g.fillStyle = '#fff'; g.fill(); g.stroke(); } }); }
    g.restore();
  }
  function handles(L) { const C = corners(L), a = (L.rot || 0) * Math.PI / 180, px = 1 / W.view.k, out = C.map((p, i) => ({ k: 'c' + i, x: p[0], y: p[1] }));
    const mid = (i, j) => [(C[i][0] + C[j][0]) / 2, (C[i][1] + C[j][1]) / 2]; [[1, 2, 'e'], [3, 0, 'w']].forEach(([i, j, k]) => { const m = mid(i, j); out.push({ k, x: m[0], y: m[1] }); });
    if (L.k !== 'text') [[0, 1, 'n'], [2, 3, 's']].forEach(([i, j, k]) => { const m = mid(i, j); out.push({ k, x: m[0], y: m[1] }); });
    const t = mid(0, 1), d = 34 * px; out.push({ k: 'rot', x: t[0] + Math.sin(a) * d, y: t[1] - Math.cos(a) * d }); return out; }
  const toPic = ev => { const r = W.ov.getBoundingClientRect(), [PW] = dims(W.cfg), k = r.width / PW; return [(ev.clientX - r.left) / k, (ev.clientY - r.top) / k]; };
  function local(L, p) { const a = -(L.rot || 0) * Math.PI / 180, dx = p[0] - L.x, dy = p[1] - L.y; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; }
  function hitLayer(p) { const Ls = W.cfg.layers || []; for (let i = Ls.length - 1; i >= 0; i--) { const L = Ls[i]; if (!L || L.hide) continue; const q = local(L, p); if (Math.abs(q[0]) <= L.w / 2 && Math.abs(q[1]) <= L.h / 2) {
        if (L.k === 'image' && L.cut && L.cut.on !== false) { const C = imgCache.get(L.id); if (C && !alphaAt(C, L, q)) continue; } return L; } } return null; }
  function alphaAt(C, L, q) { try { if (!C.alpha) { const s = Math.min(1, 160 / Math.max(C.cv.width, C.cv.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(C.cv.width * s)); c.height = Math.max(1, Math.round(C.cv.height * s)); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(C.cv, 0, 0, c.width, c.height); C.alpha = { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; }
      const fx = (q[0] * (L.flipH ? -1 : 1) + L.w / 2) / L.w, fy = (q[1] * (L.flipV ? -1 : 1) + L.h / 2) / L.h, ex = C.pad / C.cv.width, ey = C.pad / C.cv.height, u = ex + fx * (1 - 2 * ex), v = ey + fy * (1 - 2 * ey);
      const x = Math.floor(u * C.alpha.w), y = Math.floor(v * C.alpha.h); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < C.alpha.w && yy < C.alpha.h && C.alpha.d[(yy * C.alpha.w + xx) * 4 + 3] > 40) return true; } return false; } catch (e) { return true; } }
  // snapping: the middle and edges of the picture and of the other layers
  function snap(L, nx, ny) { const [PW, PH] = dims(W.cfg), th = 8 / W.view.k, xs = [0, PW / 2, PW], ys = [0, PH / 2, PH]; W.guides = [];
    (W.cfg.layers || []).forEach(o => { if (o === L || o.hide) return; xs.push(o.x, o.x - o.w / 2, o.x + o.w / 2); ys.push(o.y, o.y - o.h / 2, o.y + o.h / 2); });
    let bx = null, by = null; for (const off of [0, -L.w / 2, L.w / 2]) for (const x of xs) { const d = Math.abs(nx + off - x); if (d < th && (!bx || d < bx.d)) bx = { d, v: x - off, g: x }; }
    for (const off of [0, -L.h / 2, L.h / 2]) for (const y of ys) { const d = Math.abs(ny + off - y); if (d < th && (!by || d < by.d)) by = { d, v: y - off, g: y }; }
    if (bx && !L.rot) { nx = bx.v; W.guides.push({ x: bx.g }); } if (by && !L.rot) { ny = by.v; W.guides.push({ y: by.g }); } return [nx, ny]; }
  function wireStage() {
    const ov = W.ov;
    ov.addEventListener('pointerdown', ev => {
      if (W.brush) return brushDown(ev); const p = toPic(ev), L0 = selL();
      if (L0 && !L0.lock && !L0.hide) { const px = 1 / W.view.k; const hd = handles(L0).find(hd => Math.hypot(hd.x - p[0], hd.y - p[1]) < 11 * px); if (hd) { W.drag = { k: hd.k, L: L0, p0: p, o: JSON.parse(JSON.stringify({ x: L0.x, y: L0.y, w: L0.w, h: L0.h, rot: L0.rot || 0, size: L0.size })) }; ov.setPointerCapture(ev.pointerId); return; } }
      const L = hitLayer(p); W.sel = L ? L.id : null; panels(); layersBar();
      if (L && !L.lock) { W.drag = { k: 'move', L, p0: p, o: { x: L.x, y: L.y }, alt: ev.altKey }; ov.setPointerCapture(ev.pointerId); }
      redraw(); });
    ov.addEventListener('pointermove', ev => {
      if (W.brush) return brushMove(ev); const D = W.drag; if (!D) { const p = toPic(ev), L0 = selL(), px = 1 / W.view.k; let cur = ''; if (L0 && !L0.lock) { const hd = handles(L0).find(hd => Math.hypot(hd.x - p[0], hd.y - p[1]) < 11 * px); if (hd) cur = hd.k === 'rot' ? 'grab' : /c[02]/.test(hd.k) ? 'nwse-resize' : /c[13]/.test(hd.k) ? 'nesw-resize' : /[ew]/.test(hd.k) ? 'ew-resize' : 'ns-resize'; } if (!cur) cur = hitLayer(p) ? 'move' : 'default'; ov.style.cursor = cur; return; }
      const p = toPic(ev), L = D.L, o = D.o; D.moved = true;
      if (D.k === 'move') { let nx = o.x + p[0] - D.p0[0], ny = o.y + p[1] - D.p0[1]; if (ev.shiftKey) { if (Math.abs(nx - o.x) > Math.abs(ny - o.y)) ny = o.y; else nx = o.x; } if (!ev.altKey) [nx, ny] = snap(L, nx, ny); else W.guides = []; L.x = r1(nx); L.y = r1(ny); }
      else if (D.k === 'rot') { let a = Math.atan2(p[1] - o.y, p[0] - o.x) * 180 / Math.PI + 90; if (!ev.shiftKey) { const s = Math.round(a / 15) * 15; if (Math.abs(a - s) < 3) a = s; } else a = Math.round(a / 15) * 15; L.rot = r1(((a % 360) + 540) % 360 - 180); }
      else { const q0 = local(Object.assign({}, L, o), D.p0), q = local(Object.assign({}, L, o), p);
        if (D.k[0] === 'c') { // corners keep the shape, and scale from the opposite corner
          const sx = Math.sign(q0[0]) || 1, sy = Math.sign(q0[1]) || 1, fx = (q[0] * sx + o.w / 2) / o.w, fy = (q[1] * sy + o.h / 2) / o.h; let f = Math.max(0.03, ev.shiftKey && L.k === 'shape' ? Math.max(fx, fy) : (fx + fy) / 2);
          if (ev.shiftKey && L.k === 'shape') { L.w = r1(o.w * fx); L.h = r1(o.h * fy); f = 1; } else { L.w = r1(o.w * f); L.h = r1(o.h * f); if (L.k === 'text') L.size = r1((o.size || 100) * f); }
          const a = (L.rot || 0) * Math.PI / 180, dx = sx * (L.w - o.w) / 2, dy = sy * (L.h - o.h) / 2; if (!ev.altKey) { L.x = r1(o.x + dx * Math.cos(a) - dy * Math.sin(a)); L.y = r1(o.y + dx * Math.sin(a) + dy * Math.cos(a)); } }
        else { const ax = D.k === 'e' || D.k === 'w', s = D.k === 'e' || D.k === 's' ? 1 : -1, dl = ax ? (q[0] - q0[0]) * s : (q[1] - q0[1]) * s, a = (L.rot || 0) * Math.PI / 180;
          if (ax) { L.w = r1(Math.max(10, o.w + dl)); if (L.k === 'image') { L.h = r1(L.w / aspectOf(L)); } const dx = s * (L.w - o.w) / 2; L.x = r1(o.x + dx * Math.cos(a)); L.y = r1(o.y + dx * Math.sin(a)); }
          else { L.h = r1(Math.max(10, o.h + dl)); if (L.k === 'image') L.w = r1(L.h * aspectOf(L)); const dy = s * (L.h - o.h) / 2; L.x = r1(o.x - dy * Math.sin(a)); L.y = r1(o.y + dy * Math.cos(a)); } } }
      redraw(); });
    const up = ev => { if (W.brush) return brushUp(ev); const D = W.drag; W.drag = null; W.guides = []; if (D && D.moved) { changed(); panels(); } redraw(); };
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    ov.addEventListener('dblclick', ev => { const L = hitLayer(toPic(ev)) || selL(); if (!L) return; W.sel = L.id; if (L.k === 'image' && !L.asset) pickPicture(L); else if (L.k === 'text') { panels(); const t = W.root.querySelector('.th-text'); if (t) { t.focus(); t.select(); } } });
    // pictures dropped from the computer: into an empty slot under the pointer, else a new layer
    W.stage.addEventListener('dragover', ev => { ev.preventDefault(); }); W.stage.addEventListener('drop', ev => { ev.preventDefault(); const f = [...(ev.dataTransfer.files || [])].find(f => /^image\//.test(f.type)); if (!f) return; const p = toPic(ev), L = hitLayer(p); addPicture(f, L && L.k === 'image' && !L.asset ? L : null, p); });
  }
  // a picture into an empty slot (and cut out when the slot asks for it), or as a new layer
  async function addPicture(file, slot, at) {
    try { status('Adding the picture…'); const m = await CutMedia.importFile(file, null, { builtin: true }); await CutMedia.bitmap(m.id); const [PW, PH] = dims(W.cfg);
      let L = slot; if (L) { L.asset = m.id; L.cut = null; fitImage(L); } else { L = newImage({ name: (file.name || 'Picture').replace(/\.\w+$/, '').slice(0, 30), asset: m.id, x: at ? at[0] : PW / 2, y: at ? at[1] : PH / 2, w: PW * 0.5, h: PH * 0.5 }); fitImage(L); W.cfg.layers.push(L); }
      W.sel = L.id; changed(true); layersBar(); status('');
      if (L.autoCut && (await Cutout.check()) === 'ready') removeBg(L); else if (L.autoCut) say('Picture in. Press Remove background on the right to cut it out.'); }
    catch (e) { status(''); say(e.message || String(e)); } }
  function pickPicture(slot) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const f = i.files && i.files[0]; if (f) addPicture(f, slot || null); }; i.click(); }
  async function grabVideo() { if (!hooks.videoFrame) return say('Open the Video tab first.'); try { status('Taking the frame from the Video tab…'); const b = await hooks.videoFrame(); status(''); if (!b) return say('There is nothing in the Video tab yet.'); const L = selL(); await addPicture(new File([b], 'Video frame.png', { type: 'image/png' }), L && L.k === 'image' && !L.asset ? L : null); } catch (e) { status(''); say(e.message || String(e)); } }
  const status = s => { W.busy = s; const el = W.root && W.root.querySelector('.th-status'); if (el) el.textContent = s; };
  const say = s => { W.say = s; const el = W.root && W.root.querySelector('.th-say'); if (el) { el.textContent = s; clearTimeout(say.t); say.t = setTimeout(() => { if (el.textContent === s) el.textContent = ''; }, 6000); } };

  /* ---------- background removal ---------- */
  async function removeBg(L) {
    if (!L || !L.asset) return; try {
      if ((await Cutout.check()) !== 'ready') { status('Downloading the background remover (once, about 140 MB)…'); await Cutout.download(q => status('Downloading the background remover (once): ' + Math.round(q * 100) + '%')); }
      status('Cutting out the background…'); const bm = await CutMedia.bitmap(L.asset), t0 = performance.now(), r = await Cutout.cut(bm);
      const mk = await CutMedia.importFile(new File([r.mask], 'cut-mask.png', { type: 'image/png' }), null, { builtin: true }), fg = await CutMedia.importFile(new File([r.fg], 'cut-colour.png', { type: 'image/png' }), null, { builtin: true });
      await CutMedia.bitmap(mk.id); await CutMedia.bitmap(fg.id); L.cut = { mask: mk.id, fg: fg.id, on: true }; status('');
      say('Background removed in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s' + (Cutout.how === 'wasm' ? ' (on the processor: no graphics card was available)' : '') + '. Fix by hand if anything is wrong.'); changed(true);
    } catch (e) { status(''); say('Background removal failed: ' + (e.message || e)); } }
  // Fix by hand: paint Keep or Remove on the mask; the removed parts show in red
  async function startBrush(L) { const m = await CutMedia.bitmap(L.cut.mask), src = await CutMedia.bitmap(L.asset); const c = document.createElement('canvas'); c.width = m.width; c.height = m.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(m, 0, 0);
    W.brush = { id: L.id, L, mask: c, g, src, mode: 'keep', size: 40, soft: 0.5, undo: [], down: false }; W.sel = L.id; panels(); redraw(); }
  function paintBrush(g, k) { const B = W.brush, L = B.L; g.save(); g.scale(k, k); g.translate(L.x, L.y); if (L.rot) g.rotate(L.rot * Math.PI / 180); g.scale(L.flipH ? -1 : 1, L.flipV ? -1 : 1);
    const c = L.crop || {}, sw = B.src.width, sh = B.src.height, sx = (c.l || 0) * sw, sy = (c.t || 0) * sh, cw = sw * (1 - (c.l || 0) - (c.r || 0)), ch = sh * (1 - (c.t || 0) - (c.b || 0));
    g.globalAlpha = 0.35; g.drawImage(B.src, sx, sy, cw, ch, -L.w / 2, -L.h / 2, L.w, L.h); g.globalAlpha = 1;
    const t = document.createElement('canvas'); t.width = B.mask.width; t.height = B.mask.height; const tg = t.getContext('2d'); tg.drawImage(B.src, 0, 0, t.width, t.height); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(B.mask, 0, 0);
    const mx = sx / sw * t.width, my = sy / sh * t.height, mw = cw / sw * t.width, mh = ch / sh * t.height; g.drawImage(t, mx, my, mw, mh, -L.w / 2, -L.h / 2, L.w, L.h);
    const red = document.createElement('canvas'); red.width = t.width; red.height = t.height; const rg = red.getContext('2d'); rg.fillStyle = 'rgba(255,40,60,0.45)'; rg.fillRect(0, 0, red.width, red.height); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(B.mask, 0, 0); g.drawImage(red, mx, my, mw, mh, -L.w / 2, -L.h / 2, L.w, L.h);
    if (B.at) { g.restore(); g.save(); g.scale(k, k); g.strokeStyle = B.mode === 'keep' ? '#5cff8a' : '#ff4d5e'; g.lineWidth = 2 / W.view.k; g.beginPath(); g.arc(B.at[0], B.at[1], B.size / 2, 0, Math.PI * 2); g.stroke(); }
    g.restore(); }
  const brushPt = p => { const B = W.brush, L = B.L, q = local(L, p), c = L.crop || {}, u = (q[0] * (L.flipH ? -1 : 1) + L.w / 2) / L.w, v = (q[1] * (L.flipV ? -1 : 1) + L.h / 2) / L.h; return [((c.l || 0) + u * (1 - (c.l || 0) - (c.r || 0))) * B.mask.width, ((c.t || 0) + v * (1 - (c.t || 0) - (c.b || 0))) * B.mask.height, B.mask.width * (1 - (c.l || 0) - (c.r || 0)) / L.w]; };
  function dab(p) { const B = W.brush, [x, y, s] = brushPt(p), r = Math.max(1, B.size * s / 2), g = B.g, gr = g.createRadialGradient(x, y, r * (1 - B.soft) * 0.98, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.globalCompositeOperation = B.mode === 'keep' ? 'source-over' : 'destination-out'; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore(); }
  function brushDown(ev) { const B = W.brush; W.ov.setPointerCapture(ev.pointerId); B.undo.push(B.g.getImageData(0, 0, B.mask.width, B.mask.height)); if (B.undo.length > 25) B.undo.shift(); B.down = true; const p = toPic(ev); B.last = p; dab(p); B.at = p; redraw(); }
  function brushMove(ev) { const B = W.brush, p = toPic(ev); B.at = p; if (B.down) { const d = Math.hypot(p[0] - B.last[0], p[1] - B.last[1]), st = Math.max(1, B.size / 6), n = Math.ceil(d / st); for (let i = 1; i <= n; i++) dab([B.last[0] + (p[0] - B.last[0]) * i / n, B.last[1] + (p[1] - B.last[1]) * i / n]); B.last = p; } redraw(); }
  function brushUp() { if (W.brush) W.brush.down = false; }
  async function endBrush(keep) { const B = W.brush; if (!B) return; W.brush = null; if (!keep || !B.undo.length) { panels(); redraw(); return; }
    try { status('Tidying the edges…'); const blob = await new Promise(r => B.mask.toBlob(r, 'image/png')), mk = await CutMedia.importFile(new File([blob], 'cut-mask.png', { type: 'image/png' }), null, { builtin: true }); const mb = await CutMedia.bitmap(mk.id);
      let fgId = B.L.cut.fg; try { const r = await Cutout.refine(B.src, mb); const fg = await CutMedia.importFile(new File([r.fg], 'cut-colour.png', { type: 'image/png' }), null, { builtin: true }); await CutMedia.bitmap(fg.id); fgId = fg.id; } catch (e) { }
      B.L.cut = { mask: mk.id, fg: fgId, on: true }; status(''); changed(true); } catch (e) { status(''); say(e.message || String(e)); } }
  // keep the main body: specks and islands smaller than a twentieth of the biggest part go
  async function tidySpecks(L) { const m = await CutMedia.bitmap(L.cut.mask), c = document.createElement('canvas'); c.width = m.width; c.height = m.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(m, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), w = c.width, h = c.height, lab = new Int32Array(w * h), sizes = [0]; let n = 0; const st = [];
    for (let i = 0; i < w * h; i++) { if (lab[i] || d.data[i * 4 + 3] < 100) continue; n++; let s = 0; st.push(i); lab[i] = n; while (st.length) { const j = st.pop(); s++; const x = j % w, y = (j / w) | 0; for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (q >= 0 && !lab[q] && d.data[q * 4 + 3] >= 100) { lab[q] = n; st.push(q); } } sizes.push(s); }
    const big = Math.max(...sizes); let gone = 0; for (let i = 0; i < w * h; i++) { const l = lab[i]; if (l && sizes[l] < big / 20) { d.data[i * 4 + 3] = 0; gone++; } else if (!l && d.data[i * 4 + 3] > 0) { const x = i % w, y = (i / w) | 0; let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { const l2 = lab[yy * w + xx]; if (l2 && sizes[l2] >= big / 20) { near = true; break; } } } if (!near) d.data[i * 4 + 3] = 0; } }
    g.putImageData(d, 0, 0); const blob = await new Promise(r => c.toBlob(r, 'image/png')), mk = await CutMedia.importFile(new File([blob], 'cut-mask.png', { type: 'image/png' }), null, { builtin: true }); await CutMedia.bitmap(mk.id); L.cut = Object.assign({}, L.cut, { mask: mk.id }); changed(true); say(gone ? 'Tidied away the stray bits.' : 'Nothing stray to tidy.'); }

  /* ---------- panels ---------- */
  const EMOJI = ['😱', '😂', '🤬', '😭', '🤡', '💀', '👀', '🔥', '💯', '❌', '✅', '⚠️', '❓', '❗', '💥', '💰', '🍺', '🥃', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🇬🇧', '👑', '🚨', '🤔', '🙄', '😡', '🥴', '🤮', '👎', '👍', '🖕'];
  const SHAPES = [['rect', 'Box'], ['round', 'Rounded'], ['circle', 'Circle'], ['arrow', 'Arrow'], ['line', 'Line'], ['star', 'Star'], ['burst', 'Burst'], ['tri', 'Triangle'], ['banner', 'Banner']];
  const TEXTS = {
    two: { name: 'Two colour lines', o: { text: 'WHITE LINE\nRED LINE', font: 'Oswald', cols: ['#ffffff', '#ff3b30'], fit: true, size: 120, w: 560 } },
    outline: { name: 'Thick outline', o: { text: 'BIG WORDS', font: 'Anton', cols: ['#ffffff'], stroke: { w: 14, c: '#000000' }, size: 150, w: 700 } },
    double: { name: 'Double outline', o: { text: 'MENTAL', font: 'Bebas Neue', cols: ['#ffe14d'], stroke: { w: 10, c: '#000000' }, stroke2: { w: 14, c: '#ffffff' }, size: 190, w: 600 } },
    box: { name: 'Label in a box', o: { text: 'LABEL', font: 'Oswald', cols: ['#ffffff'], box: { on: true, c: '#e8322c', pad: 18, r: 10, op: 1 }, size: 70, w: 360 } },
    hand: { name: 'Scribbled', o: { text: 'wait for it', font: 'Permanent Marker', upper: false, cols: ['#ffffff'], size: 80, w: 520, rot: -6 } },
    num: { name: 'Big number', o: { text: '£1,000,000', font: 'Archivo Black', cols: ['#7CFF4D'], stroke: { w: 10, c: '#000000' }, size: 120, w: 700 } } };
  function addLayer(L) { const [PW, PH] = dims(W.cfg); if (L.x == null || L.x === 640) L.x = PW / 2; if (L.y == null || L.y === 360) L.y = PH / 2; W.cfg.layers.push(L); W.sel = L.id; changed(true); layersBar(); }
  function drawer() {
    const { H, btn } = UI, box = W.root.querySelector('.th-drawer'); if (!box) return; box.innerHTML = ''; const d = W.drawer, tile = (label, fn, art, title) => H('button', { type: 'button', className: 'th-tile', title: title || label, on: { click: fn } }, art || '', H('span', { textContent: label }));
    const head = t => H('h4', { className: 'th-h', textContent: t });
    if (d === 'tpl') { box.append(head('Layouts'), H('p', { className: 'hint', textContent: 'Pick one to start from. Your pictures stay and move into the new layout.' }));
      const grid = H('div', { className: 'th-tgrid' }); Object.entries(TEMPLATES).forEach(([k, T]) => { const c = document.createElement('canvas'), [PW, PH] = dims(W.cfg); c.width = 200; c.height = Math.round(200 * PH / PW); const tmp = { fmt: W.cfg.fmt, bg: Object.assign({ k: 'colour', c1: '#000' }, T.bg), layers: T.make(W.cfg.fmt) }; render(c.getContext('2d'), tmp, c.width, c.height); grid.append(tile(T.name, () => { applyTemplate(W.cfg, k); W.sel = null; imgCache.clear(); changed(true); layersBar(); say('Layout: ' + T.name + '. Double click a picture slot to fill it.'); }, c, T.note)); }); box.append(grid);
      const mineBox = H('div', { className: 'th-tgrid' }); box.append(head('My layouts'), H('p', { className: 'hint', textContent: 'Save this thumbnail as a layout to reuse next episode: just swap the picture and the words.' }), btn('Save this as one of my layouts', saveTpl), mineBox);
      all('tpl').then(list => { list.forEach(([name, T]) => { const c = document.createElement('canvas'); c.width = 200; c.height = Math.round(200 * dims(T)[1] / dims(T)[0]); try { render(c.getContext('2d'), T, c.width, c.height); } catch (e) { }
        const t2 = tile(name, () => { const keep = (W.cfg.layers || []).filter(L => L.k === 'image' && L.asset).map(L => L.asset); const n = JSON.parse(JSON.stringify(T)); n.layers.forEach(L => { L.id = nid(); }); Object.assign(W.cfg, { fmt: n.fmt, bg: n.bg, layers: n.layers }); W.sel = null; imgCache.clear(); changed(true); layersBar(); }, c);
        t2.append(H('span', { className: 'th-x', textContent: '×', title: 'Delete this layout', on: { click: e => { e.stopPropagation(); if (confirm('Delete the layout "' + name + '"?')) delK('tpl', name).then(drawer); } } })); mineBox.append(t2); }); }); }
    else if (d === 'pic') { box.append(head('Pictures'), H('div', { className: 'th-col' }, btn('Choose a picture from your computer', () => pickPicture(selL() && selL().k === 'image' && !selL().asset ? selL() : null), 'primary'), btn('Take the frame from the Video tab', grabVideo)),
        H('p', { className: 'hint', textContent: 'Or drag pictures straight onto the thumbnail, or paste one (Ctrl+V). Then Remove background on the right.' }), head('Used before'));
      const grid = H('div', { className: 'th-pgrid' }); box.append(grid);
      const used = new Set(); try { (CutMedia.list() || []).filter(m => m.kind === 'image' && !/^cut-(mask|colour)/.test(m.name || '')).sort((a, b) => (b.added || 0) - (a.added || 0)).slice(0, 40).forEach(m => { if (used.has(m.id)) return; used.add(m.id);
        const im = H('img', { alt: m.name || 'Picture' }); CutMedia.urlOf(m.id).then(u => { if (u) im.src = u; }); grid.append(H('button', { type: 'button', className: 'th-pic', title: m.name || 'Picture', on: { click: () => { const [PW, PH] = dims(W.cfg); const L = newImage({ name: (m.name || 'Picture').replace(/\.\w+$/, '').slice(0, 30), asset: m.id, w: PW * 0.5, h: PH * 0.5 }); CutMedia.bitmap(m.id).then(() => { fitImage(L); addLayer(L); }); } } }, im)); }); } catch (e) { } }
    else if (d === 'text') { box.append(head('Text'), H('p', { className: 'hint', textContent: 'Click one to add it, then type your words on the right.' })); const grid = H('div', { className: 'th-col' });
      Object.entries(TEXTS).forEach(([k, T]) => { const L = newText(JSON.parse(JSON.stringify(T.o))), c = document.createElement('canvas'); c.width = 240; c.height = 70; const g = c.getContext('2d'); sizeOf(L, g); const s = Math.min(220 / L.w, 60 / Math.max(1, L.h)); g.translate(120, 35); g.scale(s, s); drawText(g, L);
        grid.append(H('button', { type: 'button', className: 'th-tline', title: T.name, on: { click: () => addLayer(newText(JSON.parse(JSON.stringify(T.o)))) } }, c)); }); box.append(grid); }
    else if (d === 'shape') { box.append(head('Shapes')); const grid = H('div', { className: 'th-sgrid' });
      SHAPES.forEach(([k, n]) => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'), L = newShape({ shape: k, w: 50, h: k === 'line' ? 30 : 36, fill: '#f5821f' }); g.translate(32, 24); shapePath(g, L); g.fillStyle = '#f5821f'; g.fill(); grid.append(tile(n, () => addLayer(newShape({ shape: k, name: n, w: k === 'line' ? 400 : k === 'arrow' ? 260 : 240, h: k === 'line' ? 80 : k === 'arrow' ? 130 : k === 'banner' ? 110 : 240, fill: '#e8322c' })), c)); }); box.append(grid); }
    else if (d === 'emoji') { box.append(head('Stickers')); const grid = H('div', { className: 'th-egrid' });
      EMOJI.forEach(e => grid.append(H('button', { type: 'button', className: 'th-emo', textContent: e, on: { click: () => addLayer(newText({ name: 'Sticker', text: e, upper: false, font: 'Segoe UI Emoji', weight: 400, size: 160, w: 200, cols: ['#ffffff'] })) } }))); box.append(grid); }
    else if (d === 'font') { box.append(head('Your fonts'), H('p', { className: 'hint', textContent: 'Add a font file you have (TTF or OTF, like the ones you used in Canva). It is kept in this browser and shows in every font list.' }), btn('Add a font file', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.ttf,.otf,.woff,.woff2'; i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; try { const n = await addFont(f); say('Added the font ' + n + '.'); const L = selL(); if (L && L.k === 'text') { L.font = n; L.weight = 400; changed(true); } drawer(); } catch (e) { say('That font file could not be read.'); } }; i.click(); }, 'primary'),
        H('div', { className: 'th-col' }, ...[...mine].map(n => H('div', { className: 'th-fontrow', style: 'font-family:"' + n + '"', textContent: n })))); }
  }
  async function saveTpl() { const name = (prompt('Name this layout:', 'My layout') || '').trim().slice(0, 40); if (!name) return; const T = JSON.parse(JSON.stringify({ v: 1, fmt: W.cfg.fmt, bg: W.cfg.bg, layers: W.cfg.layers })); try { await putK('tpl', name, T); say('Saved the layout "' + name + '".'); drawer(); } catch (e) { say('Could not save it here.'); } }

  // the settings on the right: the selected layer's, or the picture's own when nothing is selected
  function panels() {
    const box = W.root && W.root.querySelector('.th-insp'); if (!box) return; const { H, btn, card, field, sel } = UI; box.innerHTML = ''; const L = selL(), C = W.cfg;
    const live = () => redraw(), done = () => changed(), full = () => changed(true);
    const slider = (label, val, min, max, step, fn, show) => { const out = H('span', { className: 'au-val', textContent: show(val) }); return H('label', { className: 'field au-sl' }, H('span', { className: 'lab' }, label, out), H('input', { type: 'range', min, max, step, value: val, on: { input: e => { fn(+e.target.value); out.textContent = show(+e.target.value); live(); }, change: done } })); };
    const colour = (label, val, fn) => H('label', { className: 'field th-colf' }, H('span', { className: 'lab' }, label), H('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#ffffff', on: { input: e => { fn(e.target.value); live(); }, change: done } }));
    const seg = (val, opts, fn) => H('div', { className: 'st-seg wrap' }, ...opts.map(([v, l]) => H('button', { type: 'button', className: String(v) === String(val) ? 'on' : '', textContent: l, on: { click: () => { fn(v); full(); } } })));
    const onoff = (label, on, fn) => H('label', { className: 'th-chk' }, H('input', { type: 'checkbox', checked: !!on, on: { change: e => { fn(e.target.checked); full(); } } }), H('span', { textContent: label }));
    const pct = v => Math.round(v * 100) + '%', px = v => Math.round(v) + ' px', sgn = v => (v > 0 ? '+' : '') + Math.round(v * 100);
    const fxCards = L => { const S = L.shadow = Object.assign(FX0().shadow, L.shadow || {}), G = L.glow = Object.assign(FX0().glow, L.glow || {});
      return [card('Shadow', onoff('Drop shadow', S.on, v => { S.on = v; }), ...(S.on ? [colour('Colour', S.c, v => { S.c = v; }), slider('Softness', S.b, 0, 80, 1, v => { S.b = v; }, px), slider('Across', S.x, -60, 60, 1, v => { S.x = v; }, px), slider('Down', S.y, -60, 60, 1, v => { S.y = v; }, px), slider('Strength', S.o, 0, 1, 0.05, v => { S.o = v; }, pct)] : []),
        onoff('Glow', G.on, v => { G.on = v; }), ...(G.on ? [colour('Glow colour', G.c, v => { G.c = v; }), slider('Glow size', G.b, 2, 120, 1, v => { G.b = v; }, px)] : [])),
        card('Arrange', slider('See through', 1 - (L.op == null ? 1 : L.op), 0, 1, 0.01, v => { L.op = r1(1 - v) === 1 ? 1 : Math.round((1 - v) * 100) / 100; }, pct), slider('Turn', L.rot || 0, -180, 180, 1, v => { L.rot = v; }, v => Math.round(v) + '°'),
          H('div', { className: 'btnrow' }, btn('Flip across', () => { L.flipH = !L.flipH; full(); }), btn('Flip up and down', () => { L.flipV = !L.flipV; full(); }), btn('Centre it', () => { const [PW, PH] = dims(C); L.x = PW / 2; L.y = PH / 2; full(); })),
          H('div', { className: 'btnrow' }, btn('Bring forward', () => order(L, 1)), btn('Send back', () => order(L, -1)), btn('Duplicate', () => dup(L)), btn('Delete', () => del(L))))]; };
    if (W.brush) { const B = W.brush;
      box.append(card('Fix the cut out', H('p', { className: 'hint', textContent: 'Paint over the picture. Keep brings back parts it cut off; Remove takes away bits it left. Red shows what is removed.' }),
        H('div', { className: 'st-seg' }, ...[['keep', 'Keep'], ['remove', 'Remove']].map(([v, l]) => H('button', { type: 'button', className: B.mode === v ? 'on' : '', textContent: l, on: { click: () => { B.mode = v; panels(); } } }))),
        slider('Brush size', B.size, 4, 300, 1, v => { B.size = v; }, px), slider('Soft edge', B.soft, 0, 1, 0.05, v => { B.soft = v; }, pct),
        H('div', { className: 'btnrow' }, btn('Undo a stroke', () => { const u = B.undo.pop(); if (u) { B.g.putImageData(u, 0, 0); redraw(); } }), btn('Cancel', () => endBrush(false)), btn('Done', () => endBrush(true), 'primary')))); return; }
    if (!L) {
      const B = C.bg = Object.assign({ k: 'colour', c1: '#000000', c2: '#1d2b4f', ang: 90, asset: '', blur: 0, dim: 0 }, C.bg || {});
      box.append(card('Size', seg(C.fmt, [['16:9', 'YouTube thumbnail (16:9)'], ['9:16', 'Tall (9:16)'], ['1:1', 'Square']], v => { if (v === C.fmt) return; const [a, b] = dims(C); C.fmt = v; const [c2, d2] = dims(C); (C.layers || []).forEach(L2 => { L2.x = L2.x / a * c2; L2.y = L2.y / b * d2; }); }),
        H('p', { className: 'hint', textContent: C.fmt === '16:9' ? '1280 by 720, saved under YouTube’s 2 MB limit. The box bottom right is where YouTube shows the length: keep words clear of it.' : C.fmt === '9:16' ? '1080 by 1920 for anything tall.' : '1080 by 1080.' })),
        card('Background', seg(B.k, [['colour', 'Colour'], ['grad', 'Gradient'], ['radial', 'Spotlight'], ['image', 'Picture']], v => { B.k = v; }),
          colour(B.k === 'colour' || B.k === 'image' ? 'Colour' : 'First colour', B.c1, v => { B.c1 = v; }), ...(B.k === 'grad' || B.k === 'radial' ? [colour('Second colour', B.c2, v => { B.c2 = v; })] : []), ...(B.k === 'grad' ? [slider('Angle', B.ang, 0, 360, 1, v => { B.ang = v; }, v => Math.round(v) + '°')] : []),
          ...(B.k === 'image' ? [btn(B.asset ? 'Change the background picture' : 'Choose a background picture', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; const m = await CutMedia.importFile(f, null, { builtin: true }); await CutMedia.bitmap(m.id); B.asset = m.id; full(); }; i.click(); }), slider('Blur', B.blur, 0, 40, 1, v => { B.blur = v; }, px), slider('Darken', B.dim, 0, 0.9, 0.05, v => { B.dim = v; }, pct)] : [])),
        card('Tips', H('p', { className: 'hint', textContent: 'Click anything on the thumbnail to change it. Drag to move (it snaps to the middle and edges; hold Alt to stop it), corners to resize, the orange dot to turn. Arrow keys nudge, Delete removes, Ctrl+D duplicates.' })));
      return; }
    box.append(H('div', { className: 'th-name' }, H('input', { type: 'text', value: L.name || '', placeholder: L.k === 'image' ? 'Picture' : L.k === 'text' ? 'Words' : 'Shape', 'aria-label': 'Layer name', on: { input: e => { L.name = e.target.value.slice(0, 40); layersBar(); }, change: done } }), btn('Done', () => { W.sel = null; panels(); layersBar(); redraw(); })));
    if (L.k === 'image') { L.adj = Object.assign({ br: 0, co: 0, sa: 0, wa: 0 }, L.adj || {}); L.edge = Object.assign({ feather: 0, shrink: 0 }, L.edge || {}); L.outline = Object.assign({ on: false, c: '#ffffff', w: 12 }, L.outline || {}); L.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, L.crop || {});
      const cut = L.cut && L.cut.mask;
      box.append(card('Picture', H('div', { className: 'btnrow' }, btn(L.asset ? 'Replace the picture' : 'Choose a picture', () => pickPicture(L), L.asset ? '' : 'primary'), L.asset ? btn('Original size shape', () => { const a = aspectOf(L); L.h = L.w / a; full(); }) : ''),
        ...(L.asset ? [cut ? H('div', { className: 'th-col' }, onoff('Background removed', L.cut.on !== false, v => { L.cut.on = v; }), H('div', { className: 'btnrow' }, btn('Fix by hand', () => startBrush(L)), btn('Tidy stray bits', () => tidySpecks(L)), btn('Cut out again', () => removeBg(L))))
          : btn('✂ Remove background', () => removeBg(L), 'primary th-big'),
          H('p', { className: 'hint th-cuthint', textContent: cut ? 'Edges below. Fix by hand paints back anything it got wrong.' : (Cutout.state === 'ready' ? 'Takes a second or two on your graphics card.' : 'The first time, it downloads the background remover (about 140 MB), then it works offline.') })] : [])));
      if (cut && L.cut.on !== false) box.append(card('Edges', slider('Soften the edge', L.edge.feather, 0, 12, 0.5, v => { L.edge.feather = v; }, px), slider('Pull the edge in', L.edge.shrink, 0, 12, 0.5, v => { L.edge.shrink = v; }, px),
        onoff('Sticker edge (outline)', L.outline.on, v => { L.outline.on = v; }), ...(L.outline.on ? [slider('Edge width', L.outline.w, 2, 60, 1, v => { L.outline.w = v; }, px), colour('Edge colour', L.outline.c, v => { L.outline.c = v; })] : [])));
      if (L.asset) box.append(card('Colour', slider('Brightness', L.adj.br, -0.6, 0.6, 0.02, v => { L.adj.br = v; }, sgn), slider('Contrast', L.adj.co, -0.6, 0.8, 0.02, v => { L.adj.co = v; }, sgn), slider('Colour strength', L.adj.sa, -1, 1, 0.02, v => { L.adj.sa = v; }, sgn), slider('Warmth', L.adj.wa, -1, 1, 0.05, v => { L.adj.wa = v; }, sgn),
          btn('Punchy (YouTube look)', () => { Object.assign(L.adj, { br: 0.04, co: 0.18, sa: 0.3 }); full(); })),
        card('Crop', slider('Left', L.crop.l, 0, 0.9, 0.005, v => { const a0 = aspectOf(L); L.crop.l = Math.min(v, 0.95 - L.crop.r); L.w = L.h * aspectOf(L); }, pct), slider('Right', L.crop.r, 0, 0.9, 0.005, v => { L.crop.r = Math.min(v, 0.95 - L.crop.l); L.w = L.h * aspectOf(L); }, pct),
          slider('Top', L.crop.t, 0, 0.9, 0.005, v => { L.crop.t = Math.min(v, 0.95 - L.crop.b); L.h = L.w / aspectOf(L); }, pct), slider('Bottom', L.crop.b, 0, 0.9, 0.005, v => { L.crop.b = Math.min(v, 0.95 - L.crop.t); L.h = L.w / aspectOf(L); }, pct)));
      box.append(...fxCards(L)); return; }
    if (L.k === 'text') { L.stroke = Object.assign({ w: 0, c: '#000000' }, L.stroke || {}); L.stroke2 = Object.assign({ w: 0, c: '#ffffff' }, L.stroke2 || {}); L.box = Object.assign({ on: false, c: '#e8322c', pad: 18, r: 10, op: 1 }, L.box || {}); if (!Array.isArray(L.cols) || !L.cols.length) L.cols = ['#ffffff'];
      const n = Math.max(1, String(L.text || '').split('\n').length), fonts = [...FONTS.map(f => f[0]), ...mine]; if (L.font && !fonts.includes(L.font)) fonts.push(L.font);
      const fsel = H('select', { 'aria-label': 'Font', on: { change: e => { L.font = e.target.value; L.weight = 0; document.fonts.load(fontStr(L, 60)).then(redraw).catch(() => { }); full(); } } }, ...fonts.map(f => H('option', { value: f, selected: f === L.font, textContent: f, style: 'font-family:"' + f + '"' })));
      box.append(card('Words', H('textarea', { className: 'th-text', rows: 3, value: L.text || '', 'aria-label': 'The words', on: { input: e => { L.text = e.target.value; live(); }, change: () => full() } }),
        H('p', { className: 'hint', textContent: 'Each line can have its own colour. Press Enter for a new line.' }),
        field('Font', fsel), slider('Size', L.size, 12, 400, 1, v => { const f = v / (L.size || 1); L.size = v; if (!L.fit) L.w = r1(L.w * f); }, px),
        H('div', { className: 'th-cols' }, ...Array.from({ length: n }, (_, i) => colour(n > 1 ? 'Line ' + (i + 1) : 'Colour', L.cols[Math.min(i, L.cols.length - 1)], v => { while (L.cols.length <= i) L.cols.push(L.cols[L.cols.length - 1]); L.cols[i] = v; }))),
        onoff('Every line the same width (fills the box)', L.fit, v => { L.fit = v; }), onoff('Capitals', L.upper, v => { L.upper = v; }), onoff('Italic', L.italic, v => { L.italic = v; }),
        field('Line up', seg(L.align || 'center', [['left', 'Left'], ['center', 'Middle'], ['right', 'Right']], v => { L.align = v; })),
        slider('Letter spacing', L.ls || 0, -10, 40, 0.5, v => { L.ls = v; }, px), slider('Line spacing', L.lh == null ? 1 : L.lh, 0.6, 1.8, 0.02, v => { L.lh = v; }, v => v.toFixed(2))),
        card('Outline', slider('Outline', L.stroke.w, 0, 40, 1, v => { L.stroke.w = v; }, px), ...(L.stroke.w ? [colour('Outline colour', L.stroke.c, v => { L.stroke.c = v; })] : []),
          slider('Second outline', L.stroke2.w, 0, 40, 1, v => { L.stroke2.w = v; }, px), ...(L.stroke2.w ? [colour('Second outline colour', L.stroke2.c, v => { L.stroke2.c = v; })] : [])),
        card('Box behind', onoff('Box behind the words', L.box.on, v => { L.box.on = v; }), ...(L.box.on ? [colour('Box colour', L.box.c, v => { L.box.c = v; }), slider('Padding', L.box.pad, 0, 80, 1, v => { L.box.pad = v; }, px), slider('Round corners', L.box.r, 0, 60, 1, v => { L.box.r = v; }, px), slider('Box see through', 1 - L.box.op, 0, 1, 0.05, v => { L.box.op = Math.round((1 - v) * 100) / 100; }, pct)] : [])),
        ...fxCards(L)); return; }
    if (L.k === 'shape') { box.append(card('Shape', seg(L.shape, SHAPES, v => { L.shape = v; }), onoff('Filled', L.fillOn !== false, v => { L.fillOn = v; }), ...(L.fillOn !== false ? [colour('Fill colour', L.fill, v => { L.fill = v; })] : []),
        slider('Outline', L.sw || 0, 0, 40, 1, v => { L.sw = v; }, px), ...(L.sw ? [colour('Outline colour', L.stroke, v => { L.stroke = v; })] : []), ...(L.shape === 'rect' ? [slider('Round corners', L.r || 0, 0, 200, 1, v => { L.r = v; }, px)] : [])), ...fxCards(L)); }
  }
  function order(L, d) { const a = W.cfg.layers, i = a.indexOf(L), j = cl(i + d, 0, a.length - 1); if (i < 0 || i === j) return; a.splice(i, 1); a.splice(j, 0, L); changed(true); layersBar(); }
  function dup(L) { const n = JSON.parse(JSON.stringify(L)); n.id = nid(); n.x += 30; n.y += 30; n.name = (L.name || '') ; W.cfg.layers.splice(W.cfg.layers.indexOf(L) + 1, 0, n); W.sel = n.id; changed(true); layersBar(); }
  function del(L) { W.cfg.layers = W.cfg.layers.filter(x => x !== L); imgCache.delete(L.id); W.sel = null; changed(true); layersBar(); }
  // the layers along the bottom, top of the pile first: click to select, drag to reorder
  function layersBar() {
    const box = W.root && W.root.querySelector('.th-layers'); if (!box) return; const { H } = UI; box.innerHTML = ''; const Ls = (W.cfg.layers || []).slice().reverse();
    box.append(H('span', { className: 'th-lhead', textContent: 'Layers' }));
    Ls.forEach(L => { const c = document.createElement('canvas'); c.width = 44; c.height = 30; try { const g = c.getContext('2d'); if (L.k === 'image') { const C = composite(L, 0.1), b = C ? C.cv : null; if (b) { const s = Math.min(44 / b.width, 30 / b.height); g.drawImage(b, (44 - b.width * s) / 2, (30 - b.height * s) / 2, b.width * s, b.height * s); } else { g.strokeStyle = '#93a4c0'; g.setLineDash([3, 3]); g.strokeRect(4, 4, 36, 22); } } else { g.fillStyle = L.k === 'text' ? (L.cols && L.cols[0]) || '#fff' : L.fill || '#e8322c'; g.font = '700 18px Arial'; g.textAlign = 'center'; if (L.k === 'text') g.fillText((String(L.text || 'T').trim()[0] || 'T').toUpperCase(), 22, 22); else { g.translate(22, 15); shapePath(g, Object.assign({}, L, { w: 34, h: 22 })); g.fill(); } } } catch (e) { }
      const chip = H('div', { className: 'th-chip' + (L.id === W.sel ? ' on' : '') + (L.hide ? ' off' : ''), draggable: true, title: 'Click to select. Drag to put it in front of or behind others.', on: { click: () => { W.sel = L.id; panels(); layersBar(); redraw(); },
          dragstart: e => { e.dataTransfer.setData('text/plain', L.id); }, dragover: e => e.preventDefault(), drop: e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'), a = W.cfg.layers, src = a.find(x => x.id === id); if (!src || src === L) return; a.splice(a.indexOf(src), 1); a.splice(a.indexOf(L) + (e.offsetX > e.currentTarget.offsetWidth / 2 ? 0 : 1), 0, src); changed(true); layersBar(); } } },
        c, H('span', { className: 'th-cname', textContent: L.name || (L.k === 'image' ? 'Picture' : L.k === 'text' ? String(L.text || 'Words').split('\n')[0].slice(0, 18) : 'Shape') }),
        H('button', { type: 'button', className: 'th-eye', title: L.hide ? 'Show' : 'Hide', textContent: L.hide ? '◌' : '●', on: { click: e => { e.stopPropagation(); L.hide = !L.hide; changed(); layersBar(); } } }),
        H('button', { type: 'button', className: 'th-eye', title: L.lock ? 'Unlock' : 'Lock in place', textContent: L.lock ? '🔒' : '🔓', on: { click: e => { e.stopPropagation(); L.lock = !L.lock; changed(); layersBar(); redraw(); } } }));
      box.append(chip); });
    if (!Ls.length) box.append(H('span', { className: 'hint', textContent: 'Nothing yet: pick a layout, or add a picture or words on the left.' }));
  }

  /* ---------- how it looks on YouTube ---------- */
  function paintFeed() {
    const box = W.root.querySelector('.th-feed'); if (!box) return; box.innerHTML = ''; const { H } = UI, [PW, PH] = dims(W.cfg), shot = (w) => { const c = document.createElement('canvas'), dpr = window.devicePixelRatio || 1, h = Math.round(w * PH / PW); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; render(c.getContext('2d'), W.cfg, c.width, c.height, { clean: true }); return c; };
    const card = (w, big, label) => H('div', { className: 'th-fcard' + (big ? ' big' : '') }, H('div', { className: 'th-fthumb' }, shot(w), W.cfg.fmt === '16:9' ? H('span', { className: 'th-fdur', textContent: '8:29' }) : ''),
      H('div', { className: 'th-fmeta' }, big ? H('span', { className: 'th-fav' }) : '', H('div', {}, H('div', { className: 'th-ftitle', textContent: 'Your video title goes here and can run to two lines' }), H('div', { className: 'th-fsub', textContent: 'PatterSquid · 12K views · 2 hours ago' }))), H('div', { className: 'th-flab', textContent: label }));
    box.append(H('div', { className: 'th-fhead' }, H('b', { textContent: 'How it looks on YouTube' }), H('button', { type: 'button', textContent: 'Close', on: { click: () => { W.feed = false; box.hidden = true; } } })),
      H('div', { className: 'th-frow' }, card(360, true, 'Home page on a computer'), card(168, false, 'Up next, beside a video'), card(120, false, 'Search on a phone, small')));
    box.hidden = false; }
  /* ---------- saving ---------- */
  async function exportDialog() {
    const { H, btn } = UI; let d = document.getElementById('thExport'); if (d) d.remove(); const [PW, PH] = dims(W.cfg), big = W.cfg.fmt === '16:9';
    const opts = { fmt: big ? 'jpg' : 'png', scale: 1 };
    d = H('dialog', { id: 'thExport', className: 'th-dlg' }); document.body.append(d);
    const seg = (val, list, fn) => H('div', { className: 'st-seg wrap' }, ...list.map(([v, l]) => H('button', { type: 'button', className: v === val ? 'on' : '', textContent: l, on: { click: e => { fn(v); e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } } })));
    const note = H('p', { className: 'hint' });
    d.append(H('div', { className: 'dlg-head' }, H('b', { textContent: 'Save the thumbnail' }), H('button', { type: 'button', textContent: 'Close', on: { click: () => d.close() } })),
      H('div', { className: 'th-dbody' }, H('span', { className: 'lab', textContent: 'File type' }), seg(opts.fmt, [['jpg', 'JPG (for YouTube, under 2 MB)'], ['png', 'PNG (sharpest, can be see through)']], v => { opts.fmt = v; }),
        H('span', { className: 'lab', textContent: 'Size' }), seg(1, [[1, PW + ' by ' + PH + (big ? ' (YouTube)' : '')], [1.5, Math.round(PW * 1.5) + ' by ' + Math.round(PH * 1.5)], [2, PW * 2 + ' by ' + PH * 2]], v => { opts.scale = v; }), note,
        H('div', { className: 'btnrow' }, btn('Save', async () => { note.textContent = 'Saving…'; try { const r = await save(opts); note.textContent = r; } catch (e) { note.textContent = e.message || String(e); } }, 'cut-x'),
          btn('Copy to the clipboard', async () => { try { const b = await blobOf({ fmt: 'png', scale: 1 }); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); note.textContent = 'Copied. Paste it wherever you like.'; } catch (e) { note.textContent = 'The clipboard would not take it here.'; } }))));
    d.showModal(); }
  async function blobOf(o) {
    await waitImages(); try { await document.fonts.ready; } catch (e) { }
    const [PW, PH] = dims(W.cfg), w = Math.round(PW * (o.scale || 1)), h = Math.round(PH * (o.scale || 1)), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    if (o.fmt === 'jpg') { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } imgCache.clear(); render(g, W.cfg, w, h, { clean: true }); imgCache.clear();
    if (o.fmt !== 'jpg') return new Promise(r => c.toBlob(r, 'image/png'));
    for (const q of [0.95, 0.92, 0.88, 0.84, 0.8, 0.75, 0.7, 0.62]) { const b = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (b.size < 1.95e6 || q === 0.62) return b; } }
  async function save(o) { const b = await blobOf(o), name = (W.fileBase ? W.fileBase() : 'thumbnail') + (o.fmt === 'jpg' ? '.jpg' : '.png');
    const ok = await E.saveBlob(b, name, [o.fmt === 'jpg' ? { description: 'JPG picture', accept: { 'image/jpeg': ['.jpg'] } } : { description: 'PNG picture', accept: { 'image/png': ['.png'] } }]);
    return ok ? 'Saved (' + (b.size / 1e6).toFixed(2) + ' MB).' : 'Save cancelled.'; }
  async function waitImages() { const ids = new Set(); (W.cfg.layers || []).forEach(L => { if (L.k === 'image' && L.asset) { ids.add(L.asset); if (L.cut && L.cut.mask) { ids.add(L.cut.mask); ids.add(L.cut.fg); } } }); if (W.cfg.bg && W.cfg.bg.asset) ids.add(W.cfg.bg.asset);
    await Promise.all([...ids].map(id => CutMedia.bitmap(id).catch(() => null))); }

  /* ---------- the tab ---------- */
  function form(root0, cfg, changedFn) {
    const { H, btn } = UI; linkFonts();
    W.cfg = cfg; W.changed = changedFn; if (!Array.isArray(cfg.layers)) cfg.layers = []; if (!DIMS[cfg.fmt]) cfg.fmt = '16:9';
    if (W.sel && !layerById(W.sel)) W.sel = null; if (W.brush && !layerById(W.brush.id)) W.brush = null;
    let ws = document.getElementById('thumbWs'); if (!ws) { ws = H('div', { id: 'thumbWs' }); document.querySelector('main').append(ws); } W.root = ws; ws.innerHTML = '';
    const rail = H('div', { className: 'th-rail' }, ...[['tpl', '▦', 'Layouts'], ['pic', '🖼', 'Pictures'], ['text', 'T', 'Text'], ['shape', '◆', 'Shapes'], ['emoji', '☺', 'Stickers'], ['font', 'Aa', 'Fonts']].map(([k, i, l]) =>
      H('button', { type: 'button', className: W.drawer === k ? 'on' : '', 'data-dr': k, title: l, on: { click: () => { W.drawer = k; ws.querySelectorAll('.th-rail button').forEach(b => b.classList.toggle('on', b.dataset.dr === k)); drawer(); } } }, H('i', { textContent: i }), H('span', { textContent: l }))));
    W.stage = H('div', { className: 'th-stage' }); W.cv = H('canvas', { className: 'th-cv' }); W.ov = H('canvas', { className: 'th-ov', tabIndex: 0, 'aria-label': 'The thumbnail: click to select, drag to move' }); W.stage.append(W.cv, W.ov, H('div', { className: 'th-feed', hidden: true }));
    const top = H('div', { className: 'th-top' }, H('span', { className: 'th-title', textContent: 'Thumbnail' }),
      btn('▶ How it looks on YouTube', () => { W.feed = !W.feed; const f = ws.querySelector('.th-feed'); if (W.feed) paintFeed(); else f.hidden = true; }),
      H('span', { className: 'th-status', 'aria-live': 'polite', textContent: W.busy }), H('span', { className: 'th-say', 'aria-live': 'polite' }));
    ws.append(top, H('div', { className: 'th-body' }, rail, H('div', { className: 'th-drawer' }), W.stage, H('div', { className: 'th-insp' })), H('div', { className: 'th-layers' }));
    wireStage(); drawer(); panels(); layersBar();
    if (!W._ro) W._ro = new ResizeObserver(() => redraw()); W._ro.disconnect(); W._ro.observe(W.stage);
    // pictures that are still loading draw when they arrive
    waitImages().then(() => { imgCache.clear(); redraw(); layersBar(); }); Cutout.check().then(() => { if (!W.brush) panels(); }).catch(() => { });
    redraw();
  }
  function key(e) {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), L = selL();
    if (W.brush) { if (k === 'escape') { endBrush(false); return true; } if (k === 'enter') { endBrush(true); return true; } if (ctrl && k === 'z') { const u = W.brush.undo.pop(); if (u) { W.brush.g.putImageData(u, 0, 0); redraw(); } return true; } if (k === '[' || k === ']') { W.brush.size = cl(W.brush.size * (k === ']' ? 1.2 : 1 / 1.2), 4, 300); panels(); redraw(); return true; } return false; }
    if (k === 'escape') { if (W.feed) { W.feed = false; W.root.querySelector('.th-feed').hidden = true; return true; } if (L) { W.sel = null; panels(); layersBar(); redraw(); return true; } return false; }
    if (ctrl && k === 'v') return false;   // the paste event takes it
    if (!L) return false;
    if (k === 'delete' || k === 'backspace') { del(L); return true; }
    if (ctrl && k === 'd') { dup(L); return true; }
    if (ctrl && k === 'c') { W.clip = JSON.parse(JSON.stringify(L)); say('Copied the layer. Ctrl+V puts a copy in.'); return true; }
    if (ctrl && (k === ']' || k === '[')) { order(L, k === ']' ? 1 : -1); return true; }
    if (/^arrow/.test(k) && !L.lock) { const s = e.shiftKey ? 10 : 1; if (k === 'arrowleft') L.x -= s; if (k === 'arrowright') L.x += s; if (k === 'arrowup') L.y -= s; if (k === 'arrowdown') L.y += s; clearTimeout(key.t); key.t = setTimeout(() => changed(), 400); redraw(); return true; }
    return false;
  }
  // Ctrl+V: a picture from the clipboard as a new layer, else the layer copied with Ctrl+C
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && typeof window !== 'undefined' && !window.PATTER_WORKER) document.addEventListener('paste', e => { if (!document.body.classList.contains('thb') || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
    const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(f => /^image\//.test(f.type)); if (f) { e.preventDefault(); addPicture(f, null); return; }
    if (W.clip) { e.preventDefault(); const n = JSON.parse(JSON.stringify(W.clip)); n.id = nid(); n.x += 30; n.y += 30; W.cfg.layers.push(n); W.sel = n.id; changed(true); layersBar(); } });
  function activate(on) { document.body.classList.toggle('thb', !!on); const ws = document.getElementById('thumbWs'); if (ws) ws.hidden = !on; if (on) { linkFonts(); redraw(); } else if (W.brush) W.brush = null; }
  const duration = () => 1;
  // the app's small previews (project list) draw the thumbnail itself
  function draw(g, t, cfg, look, Wd, Hd) { g.fillStyle = '#000'; g.fillRect(0, 0, Wd, Hd); try { const [PW, PH] = dims(cfg), s = Math.min(Wd / PW, Hd / PH), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(PW * s)); c.height = Math.max(1, Math.round(PH * s)); render(c.getContext('2d'), cfg, c.width, c.height, { clean: true }); g.drawImage(c, (Wd - c.width) / 2, (Hd - c.height) / 2); } catch (e) { } }
  return { id: 'thumb', name: 'Thumbnail', defaults, duration, draw, form, key, activate, exportDialog, hooks, render, dims, TEMPLATES, applyTemplate, _W: W, _blob: blobOf, _removeBg: removeBg, _addPicture: addPicture, _key: key };
})();

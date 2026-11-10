/* His own hand drawings for talking (a green screen sheet he draws: an open explaining hand, a relaxed half curled hand,
   palms up, pointing at you), cut off the green and fitted to his puppet: one size and one colour for the
   whole sheet, measured against his puppet's own open palm, so every pose matches his hands. Any sleeve drawn with a hand is taken off: only the
   hand is used, its wrist fading into the end of the puppet's own sleeve. Puppet keeps the sheet
   with the puppet (never uploaded) and calls fit() when it loads. Also: a plain black copy of each dark sleeve for when
   the forearm turns over (the hoodie's stripes run down the outside of the arm). */
const HandSheet = (() => {
  const ROLES = [['relaxed', 'Relaxed talking hand'], ['open', 'Explaining hand'], ['palm up', 'Palm up'], ['point you', 'Pointing at you'], ['', 'Not used']];
  const LAYOUT7 = [['open', 'R'], ['open', 'L'], ['', 'both'], ['point you', 'R'], ['relaxed', 'L'], ['palm up', 'R'], ['palm up', 'L']];   // the sheet he drew, read row by row
  const mk = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const dataOf = (src, w, h) => { const c = mk(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h); return g.getImageData(0, 0, w, h); };

  /* the drawings on a sheet, row by row: each a canvas with the green taken out, and where its sleeve is */
  function cut(img) {
    const sc = Math.min(1, 2400 / img.width), W = Math.round(img.width * sc), H = Math.round(img.height * sc), D = dataOf(img, W, H), d = D.data, N = W * H;
    const al = new Float32Array(N); for (let i = 0; i < N; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], ex = g - Math.max(r, b); al[i] = Math.min(1, Math.max(0, 1 - (ex - 30) / 90)); }
    const lab = new Int32Array(N), boxes = []; let n = 0; const st = new Int32Array(N);
    for (let s = 0; s < N; s++) { if (lab[s] || al[s] < 0.5) continue; n++; let sp = 0, cnt = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; st[sp++] = s; lab[s] = n;
      while (sp) { const i = st[--sp], x = i % W, y = (i / W) | 0; cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !lab[j] && al[j] >= 0.5) { lab[j] = n; st[sp++] = j; } }
      boxes.push({ n, cnt, x0, y0, x1, y1 }); }
    const big = boxes.filter(b => b.cnt > N * 0.004);
    const pieces = big.map(b => {
      const x0 = Math.max(0, b.x0 - 4), y0 = Math.max(0, b.y0 - 4), w = Math.min(W - 1, b.x1 + 4) - x0 + 1, h = Math.min(H - 1, b.y1 + 4) - y0 + 1, out = new ImageData(w, h), o = out.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, L = lab[i]; if (L && L !== b.n) continue; let a = al[i]; if (!L) { let near = false; for (let k = -3; k <= 3 && !near; k++) for (let m = -3; m <= 3; m++) { const yy = y0 + y + k, xx = x0 + x + m; if (yy >= 0 && yy < H && xx >= 0 && xx < W && lab[yy * W + xx] === b.n) { near = true; break; } } if (!near) a = 0; }
        const r = d[i * 4], g = d[i * 4 + 1], bb = d[i * 4 + 2], j = (y * w + x) * 4; o[j] = r; o[j + 1] = Math.min(g, Math.max(r, bb) * 1.05); o[j + 2] = bb; o[j + 3] = a * 255; }   // green spill off the edges
      // the sleeve: the big dark patch at the bottom (thin outlines are not sleeve: an opening takes them out); it is taken
      // off, so only the hand is left, its wrist end fading out where it goes into his own sleeve
      const n2 = w * h, dk = new Uint8Array(n2); for (let i = 0; i < n2; i++) dk[i] = o[i * 4 + 3] > 128 && o[i * 4] + o[i * 4 + 1] + o[i * 4 + 2] < 170 ? 1 : 0;
      const grow = (m, r, on) => { let a = m; for (let it = 0; it < r; it++) { const b2 = a.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (a[i] === on) continue; if ((x > 0 && a[i - 1] === on) || (x < w - 1 && a[i + 1] === on) || (y > 0 && a[i - w] === on) || (y < h - 1 && a[i + w] === on)) b2[i] = on; } a = b2; } return a; };
      let core = grow(grow(dk, 5, 0), 6, 1); for (let i = 0; i < n2; i++) core[i] &= dk[i] | (o[i * 4 + 3] < 128 ? 0 : 1);
      // keep the dark patches that reach the bottom of the drawing (the sleeves)
      const lab2 = new Int32Array(n2), keep = new Set(); let nn = 0; const st2 = [];
      for (let s0 = 0; s0 < n2; s0++) { if (!core[s0] || lab2[s0]) continue; nn++; lab2[s0] = nn; st2.push(s0); let low = false; while (st2.length) { const i = st2.pop(), x = i % w, y = (i / w) | 0; if (y > h * 0.85) low = true; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && core[j] && !lab2[j]) { lab2[j] = nn; st2.push(j); } } if (low) keep.add(nn); }
      let slv = new Uint8Array(n2); for (let i = 0; i < n2; i++) slv[i] = keep.has(lab2[i]) ? 1 : 0; slv = grow(slv, 2, 1);
      const sl = [[0, 0, 0], [0, 0, 0]], wr = [[0, 0, 0], [0, 0, 0]], cx = w / 2;
      // distance from the sleeve, for the fade (up to 10 px), and the wrist: skin touching the sleeve
      const dist = new Float32Array(n2).fill(99), q2 = []; for (let i = 0; i < n2; i++) if (slv[i]) { dist[i] = 0; q2.push(i); }
      for (let qi = 0; qi < q2.length; qi++) { const i = q2[qi], x = i % w, y = (i / w) | 0; if (dist[i] >= 10) continue; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q2.push(j); } }
      for (let i = 0; i < n2; i++) { const x = i % w, y = (i / w) | 0, sd = x < cx ? 0 : 1;
        if (slv[i]) { if (o[i * 4 + 3] > 128) { sl[sd][0] += x; sl[sd][1] += y; sl[sd][2]++; } o[i * 4 + 3] = 0; continue; }
        if (dist[i] <= 3 && o[i * 4 + 3] > 128 && !dk[i]) { wr[sd][0] += x; wr[sd][1] += y; wr[sd][2]++; }
        if (dist[i] < 4) o[i * 4 + 3] *= Math.max(0, (dist[i] - 1) / 3); }   // a short soft edge at the wrist, no blur
      const avg = A => { const t = A[0][2] + A[1][2]; return t ? [(A[0][0] + A[1][0]) / t, (A[0][1] + A[1][1]) / t] : [w / 2, h]; }, one = avg(sl), wone = wr[0][2] + wr[1][2] ? avg(wr) : one;
      const two = wr.map(q => q[2] ? [q[0] / q[2], q[1] / q[2]] : wone);
      return { data: out, w, h, x: x0, y: y0, sleeve: one, wrist: wone, wrists: two, wide: w > h * 1.5 };
    });
    // row by row (rows are the pieces whose middles are level), then left to right
    pieces.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2)); const rows = []; pieces.forEach(p => { const r = rows.find(r => Math.abs(r.c - (p.y + p.h / 2)) < Math.max(p.h, r.h) * 0.45); if (r) r.p.push(p); else rows.push({ c: p.y + p.h / 2, h: p.h, p: [p] }); });
    return rows.flatMap(r => r.p.sort((a, b) => a.x - b.x));
  }
  // what each drawing is: his sheet's layout when it has seven, else a guess from where the sleeve is
  const guess = P => P.length === 7 ? LAYOUT7.map(r => r.slice()) : P.map(p => p.wide ? ['', 'both'] : ['open', p.sleeve[0] > p.w / 2 ? 'L' : 'R']);

  /* skin: its colour range and how wide the palm is (the biggest circle that fits in the skin) */
  function skin(D) {
    const { width: w, height: h, data: d } = D, m = new Uint8Array(w * h), ch = [[], [], []];
    for (let i = 0; i < w * h; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (d[i * 4 + 3] > 200 && r > 110 && r > g && g > b && r - b > 40) { m[i] = 1; if (i % 3 === 0) { ch[0].push(r); ch[1].push(g); ch[2].push(b); } } }
    const dt = new Float32Array(w * h), INF = 1e9; for (let i = 0; i < w * h; i++) dt[i] = m[i] ? INF : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!dt[i]) continue; let v = dt[i]; if (x) v = Math.min(v, dt[i - 1] + 1); if (y) v = Math.min(v, dt[i - w] + 1); if (x && y) v = Math.min(v, dt[i - w - 1] + 1.414); if (y && x < w - 1) v = Math.min(v, dt[i - w + 1] + 1.414); dt[i] = v; }
    let mx = 0; for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!dt[i]) continue; let v = dt[i]; if (x < w - 1) v = Math.min(v, dt[i + 1] + 1); if (y < h - 1) v = Math.min(v, dt[i + w] + 1); if (x < w - 1 && y < h - 1) v = Math.min(v, dt[i + w + 1] + 1.414); if (y < h - 1 && x) v = Math.min(v, dt[i + w - 1] + 1.414); dt[i] = v; if (v > mx) mx = v; }
    const q = (a, f) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
    return { r: mx, lo: ch.map(a => q(a, 0.2)), md: ch.map(a => q(a, 0.5)), hi: ch.map(a => q(a, 0.8)), n: ch[0].length };
  }

  /* fit the sheet to a puppet: one scale (his open hands against the puppet's open palm) and one colour match for every
     drawing, then per side and role a canvas and the point (in it) that sits on the end of the sleeve */
  function fit(pieces, roles, refs) {
    const S = pieces.map(p => skin(p.data)), use = pieces.map((p, i) => roles[i] && roles[i][0]);
    const R0 = refs.map(skin).filter(s => s.n > 50); if (!R0.length) return null;
    const ref = { r: R0.reduce((s, q) => s + q.r, 0) / R0.length, lo: [0, 1, 2].map(c => R0.reduce((s, q) => s + q.lo[c], 0) / R0.length), hi: [0, 1, 2].map(c => R0.reduce((s, q) => s + q.hi[c], 0) / R0.length), md: [0, 1, 2].map(c => R0.reduce((s, q) => s + q.md[c], 0) / R0.length) };
    const openI = pieces.map((p, i) => i).filter(i => use[i] === 'open'),   // flat open hands against his flat hands (resting and waving)
      sz = (openI.length ? openI : pieces.map((p, i) => i).filter(i => use[i])).map(i => S[i].r).filter(r => r > 0);
    const k = sz.length ? ref.r / (sz.reduce((a, b) => a + b, 0) / sz.length) : 1;
    const used = pieces.map((p, i) => i).filter(i => use[i] && S[i].n > 50), src = { lo: [0, 1, 2].map(c => used.reduce((s, i) => s + S[i].lo[c], 0) / Math.max(1, used.length)), hi: [0, 1, 2].map(c => used.reduce((s, i) => s + S[i].hi[c], 0) / Math.max(1, used.length)), md: [0, 1, 2].map(c => used.reduce((s, i) => s + S[i].md[c], 0) / Math.max(1, used.length)) };
    const gain = [0, 1, 2].map(c => Math.max(0.55, Math.min(1.3, (ref.hi[c] - ref.lo[c]) / Math.max(1, src.hi[c] - src.lo[c])))), off = [0, 1, 2].map(c => ref.md[c] - src.md[c] * gain[c]);   // his middle skin tone exactly, his flatter shading
    const out = [];
    pieces.forEach((p, i) => { if (!use[i]) return; const D = new ImageData(new Uint8ClampedArray(p.data.data), p.w, p.h), d = D.data;
      for (let j = 0; j < d.length; j += 4) { if (!d[j + 3]) continue; const l = (d[j] + d[j + 1] + d[j + 2]) / 3, t = Math.min(1, Math.max(0, (l - 40) / 60)); for (let c = 0; c < 3; c++) d[j + c] = d[j + c] * (1 - t) + (d[j + c] * gain[c] + off[c]) * t; }   // skin tones matched; the outline left dark
      const c0 = mk(p.w, p.h); c0.getContext('2d').putImageData(D, 0, 0);
      const w = Math.max(1, Math.round(p.w * k)), h = Math.max(1, Math.round(p.h * k));
      const make = mir => { const c = mk(w, h), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; if (mir) { g.translate(w, 0); g.scale(-1, 1); } g.drawImage(c0, 0, 0, w, h); return c; };
      const [role, side] = roles[i], at = s => [(s[0]) * k, s[1] * k], flip = a => [w - a[0], a[1]];
      const a = at(p.wrist), sd = side === 'R' ? 'R' : 'L';
      out.push({ role, side: sd, canvas: make(false), w, h, anchor: a });
      out.push({ role, side: sd === 'L' ? 'R' : 'L', canvas: make(true), w, h, anchor: flip(a), mirror: true });   // the other hand, unless he drew that one too
    });
    // a drawing he made for a side wins over a mirrored one
    const best = {}; out.forEach(o => { const key = o.role + o.side; if (!best[key] || (best[key].mirror && !o.mirror)) best[key] = o; });
    return { k, gain, off, list: Object.values(best) };
  }

  /* the sleeve without its stripes: the light stripes filled in from the black around them */
  function plain(bitmap, dir) {
    const w = bitmap.width, h = bitmap.height, D = dataOf(bitmap, w, h), d = D.data, d0 = new Uint8ClampedArray(d); let dark = 0, tot = 0;
    const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) { if (d[i * 4 + 3] < 128) continue; tot++; const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], l = (r + g + b) / 3; if (l < 70) dark++; if (l > 62 && Math.max(r, g, b) - Math.min(r, g, b) < 45) m[i] = 1; }
    if (!tot || dark / tot < 0.5) return null;   // not a dark sleeve (a lab coat)
    for (let pass = 0; pass < 3; pass++) { const m2 = m.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!m[i] && (m[i - 1] || m[i + 1] || m[i - w] || m[i + w])) m2[i] = 1; } m.set(m2); }
    for (let it = 0; it < 60; it++) { let left = 0; const fill = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!m[i]) continue; let r = 0, g = 0, b = 0, c = 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !m[j] && d[j * 4 + 3] > 0) { r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; c++; } if (c) fill.push([i, r / c, g / c, b / c]); else left++; }
      fill.forEach(([i, r, g, b]) => { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; m[i] = 0; }); if (!left || !fill.length) break; }
    // only the forearm turns over: the stripes stay on the upper arm, fading in towards the elbow (dir > 0: the cuff is on the right)
    for (let x = 0; x < w; x++) { const u = dir > 0 ? x / w : 1 - x / w, k = Math.min(1, Math.max(0, (u - 0.42) / 0.22)), f = k * k * (3 - 2 * k); if (f >= 1) continue; for (let y = 0; y < h; y++) { const j = (y * w + x) * 4; for (let c = 0; c < 3; c++) d[j + c] = d0[j + c] + (d[j + c] - d0[j + c]) * f; } }
    const c = mk(w, h); c.getContext('2d').putImageData(D, 0, 0); return c;
  }
  return { ROLES, cut, guess, skin, fit, plain };
})();

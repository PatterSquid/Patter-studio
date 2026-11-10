/* Shapes for the Thumbnail tab, made for YouTube: curved, swooshing, looping and hand drawn arrows, scribbled circles and
   underlines, crosses and ticks, brush strokes, speech, thought and shout bubbles, comic booms and bursts, plus the
   basics. Every shape is one outline (a Path2D in the layer's own box, centre at 0,0) built from smooth curves; strokes
   like arrows and scribbles are ribbons (two edges round a centre line, tapered where a pen would taper).
   Looks on top of any shape: a fat outline behind the fill (so joins and overlaps never show), a second colour as a
   gradient, 3D depth (the shape extruded down and right in a darker colour, outline round the whole block), and shine.
   Layer fields: shape, fill, fill2 (gradient, '' for none), fillOn, stroke, sw (outline), depth (px), depthC, shine,
   bend (-1..1, curved arrows and swooshes), thick (0.1..0.6 of the box height), rough (hand drawn wobble 0..1), tail
   (0..1 along the bottom, bubbles), r (corners on a box), seed (for the hand drawn wobble and the boom). */
const ThumbShapes = (() => {
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;
  // a smooth wobble from a seed: the same shape every time it is drawn
  const noise = (seed) => { const r = []; let s = (seed >>> 0) || 7; for (let i = 0; i < 64; i++) { s = (s * 16807) % 2147483647; r.push(s / 2147483647 * 2 - 1); }
    return t => { const x = ((t % 1) + 1) % 1 * 63, i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(r[i], r[i + 1], u); }; };
  const seedOf = L => { let h = 0; const s = String(L.seed != null ? L.seed : L.id || 'x'); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) || 1; };
  // a ribbon round a centre line: pts [[x, y]], half widths per point; cap 'round' gives round ends
  function ribbon(P, pts, hw, capRound) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; const w = hw[i]; L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]); }
    P.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) P.lineTo(L[i][0], L[i][1]);
    if (capRound) { const e = pts[n - 1], a0 = Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]); P.arc(e[0], e[1], hw[n - 1], a0, a0 - Math.PI, true); } else P.lineTo(R[n - 1][0], R[n - 1][1]);
    for (let i = n - 2; i >= 0; i--) P.lineTo(R[i][0], R[i][1]);
    if (capRound) { const s = pts[0], a1 = Math.atan2(R[0][1] - s[1], R[0][0] - s[0]); P.arc(s[0], s[1], hw[0], a1, a1 - Math.PI, true); }
    P.closePath();
  }
  const quad = (A, C, B, n = 48) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]]; });
  const cubic = (A, C1, C2, B, n = 56) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * u * A[0] + 3 * u * u * t * C1[0] + 3 * u * t * t * C2[0] + t * t * t * B[0], u * u * u * A[1] + 3 * u * u * t * C1[1] + 3 * u * t * t * C2[1] + t * t * t * B[1]]; });
  const wob = (pts, amt, nz) => amt ? pts.map((p, i) => [p[0] + nz(i / pts.length * 0.1) * amt, p[1] + nz(i / pts.length * 0.1 + 0.5) * amt]) : pts;
  // a shaft along pts ending in a head: the shaft tapers in from the tail (taper 0..1), the head is a solid triangle
  function arrowAlong(P, pts, th, hl, hwHead, taper, headStyle) {
    // cut the line where the head starts
    let acc = 0, cut = pts.length - 1; const seg = []; for (let i = 1; i < pts.length; i++) seg.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const total = seg.reduce((a, b) => a + b, 0);
    for (let i = seg.length - 1; i >= 0; i--) { acc += seg[i]; if (acc >= hl) { cut = i; break; } }
    const shaft = pts.slice(0, cut + 1), tip = pts[pts.length - 1], base = shaft[shaft.length - 1]; let run = 0;
    const hw = shaft.map((p, i) => { if (i) run += seg[i - 1]; const t = run / Math.max(1, total - hl); return th / 2 * lerp(1 - taper, 1, Math.min(1, t * 1.6)); });
    ribbon(P, shaft.concat([[lerp(base[0], tip[0], 0.35), lerp(base[1], tip[1], 0.35)]]), hw.concat([th / 2]), true);
    const dx = tip[0] - base[0], dy = tip[1] - base[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    if (headStyle === 'open') { const a = [base[0] + nx * hwHead, base[1] + ny * hwHead], b = [base[0] - nx * hwHead, base[1] - ny * hwHead]; ribbon(P, [a, tip], [th / 2, th / 2], true); ribbon(P, [b, tip], [th / 2, th / 2], true); return; }
    const back = headStyle === 'barb' ? 0.28 : 0; P.moveTo(tip[0], tip[1]); P.lineTo(base[0] + nx * hwHead, base[1] + ny * hwHead); P.lineTo(base[0] + dx * back, base[1] + dy * back); P.lineTo(base[0] - nx * hwHead, base[1] - ny * hwHead); P.closePath();
  }
  function roundRectPts(x, y, w, h, r, n = 6) { const pts = [], c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]; c.forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return pts; }
  // the outline of a layer's shape, in its own box
  function geo(L) {
    const parts = [], part = () => { const q = new Path2D(); parts.push(q); return q; }, MP = { moveTo: (a, b) => { cur = part(); cur.moveTo(a, b); }, lineTo: (a, b) => cur.lineTo(a, b), arc: (...a) => cur.arc(...a), ellipse: (...a) => cur.ellipse(...a), closePath: () => cur.closePath(), bezierCurveTo: (...a) => cur.bezierCurveTo(...a), rect: (...a) => { cur = part(); cur.rect(...a); }, roundRect: (...a) => { cur = part(); cur.roundRect(...a); } };
    let cur = null; const P = MP;
    const w = Math.max(1, +L.w || 100), h = Math.max(1, +L.h || 100), x = -w / 2, y = -h / 2, nz = noise(seedOf(L)), rough = cl(+L.rough || 0, 0, 1), m = Math.min(w, h);
    const th = cl(+L.thick || 0.3, 0.05, 0.9) * (L.shape && /arrow|swoosh|loop/.test(L.shape) ? h : m), bend = L.bend == null ? 0.5 : cl(+L.bend, -1.5, 1.5);
    switch (L.shape) {
      case 'circle': cur = part(); P.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); break;
      case 'round': Path2D.prototype.roundRect ? P.roundRect(x, y, w, h, m * 0.22) : P.rect(x, y, w, h); break;
      case 'tri': P.moveTo(0, y); P.lineTo(-x, -y); P.lineTo(x, -y); P.closePath(); break;
      case 'line': ribbon(P, wob([[x + 4, 0], [-x - 4, 0]], 0, nz), [Math.max(2, h * 0.08), Math.max(2, h * 0.08)], true); break;
      case 'star': case 'burst': { const n = L.shape === 'star' ? 5 : 14, ri = L.shape === 'star' ? 0.45 : 0.72; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : 1; const px = Math.cos(a) * w / 2 * r, py = Math.sin(a) * h / 2 * r; i ? P.lineTo(px, py) : P.moveTo(px, py); } P.closePath(); break; }
      case 'banner': { const k = Math.min(w * 0.08, h * 0.5); P.moveTo(x, y); P.lineTo(-x, y); P.lineTo(-x - k, 0); P.lineTo(-x, -y); P.lineTo(x, -y); P.lineTo(x + k, 0); P.closePath(); break; }
      case 'arrow': { const sh = h * 0.42, hl = Math.min(w * 0.45, h * 0.95); P.moveTo(x, -sh / 2); P.lineTo(-x - hl, -sh / 2); P.lineTo(-x - hl, y); P.lineTo(-x, 0); P.lineTo(-x - hl, -y); P.lineTo(-x - hl, sh / 2); P.lineTo(x, sh / 2); P.closePath(); break; }
      // curved arrow: from the bottom left up and over to the right, bend sets how far it bows
      case 'carrow': { const hl = Math.min(w * 0.36, th * 2.1), A = [x + th * 0.6, -y - th * 0.7], B = [-x - 2, y + h * 0.42], C = [lerp(A[0], B[0], 0.35), lerp(A[1], B[1], 0.5) - bend * h * 0.9];
        arrowAlong(P, wob(quad(A, C, B), rough * th * 0.3, nz), th, hl, th * 1.25, 0.15, 'solid'); break; }
      // a brush swoosh: thin at the tail, fat and fast at the head, a gentle S
      case 'swoosh': { const hl = Math.min(w * 0.3, th * 2), A = [x + 4, -y - th * 0.4], B = [-x - 2, y + th * 0.9], C1 = [lerp(A[0], B[0], 0.4), -y + h * 0.1 * bend], C2 = [lerp(A[0], B[0], 0.6), y - h * 0.15 * bend];
        arrowAlong(P, wob(cubic(A, C1, C2, B), rough * th * 0.25, nz), th, hl, th * 1.35, 0.85, 'barb'); break; }
      // a loop the loop on the way across
      case 'loop': { const hl = Math.min(w * 0.28, th * 2.1), R = Math.min(h * 0.3, w * 0.16), pts = []; for (let i = 0; i <= 90; i++) { const t = i / 90, base = [lerp(x + th, -x - 2, t), lerp(-y - th * 1.2, y + h * 0.45, t * t) ], ph = cl((t - 0.25) / 0.4, 0, 1) * TAU; pts.push([base[0] - R * Math.sin(ph), base[1] - R * (1 - Math.cos(ph)) * 1.1]); }
        arrowAlong(P, wob(pts, rough * th * 0.25, nz), th, hl, th * 1.25, 0.3, 'solid'); break; }
      // a marker arrow drawn by hand: wobbly line and an open V head
      case 'harrow': { const A = [x + th, -y - th], B = [-x - th, y + th], C = [lerp(A[0], B[0], 0.4), lerp(A[1], B[1], 0.5) - bend * h * 0.5]; arrowAlong(P, wob(quad(A, C, B), th * (0.2 + 0.8 * rough), nz), th, Math.min(w, h) * 0.3, Math.min(w, h) * 0.22, 0.1, 'open'); break; }
      case 'darrow': { const hl = Math.min(w * 0.3, th * 2.1), sh = th / 2, pts = [[x + hl, 0], [-x - hl, 0]]; P.moveTo(x, 0); P.lineTo(x + hl, -th * 1.25); P.lineTo(x + hl, -sh); P.lineTo(-x - hl, -sh); P.lineTo(-x - hl, -th * 1.25); P.lineTo(-x, 0); P.lineTo(-x - hl, th * 1.25); P.lineTo(-x - hl, sh); P.lineTo(x + hl, sh); P.lineTo(x + hl, th * 1.25); P.closePath(); break; }
      // a scribbled ring round something: one and a bit turns, a pen's taper at both ends
      case 'scribble': { const pts = [], hw = [], n = 120, s = cl(+L.thick || 0.08, 0.02, 0.3) * m; for (let i = 0; i <= n; i++) { const t = i / n, a = -2.2 + t * (TAU * 1.22), r = 1 + nz(t * 0.09) * 0.04 * (1 + rough * 2) - t * 0.13; pts.push([Math.cos(a) * (w / 2 - s) * r, Math.sin(a) * (h / 2 - s) * r]); hw.push(s / 2 * Math.min(1, t * 8, (1 - t) * 6 + 0.25)); } ribbon(P, pts, hw, true); break; }
      case 'ring': { const s = cl(+L.thick || 0.1, 0.02, 0.4) * m; cur = part(); parts.eo = true; P.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); cur.moveTo(Math.max(1, w / 2 - s), 0); P.ellipse(0, 0, Math.max(1, w / 2 - s), Math.max(1, h / 2 - s), 0, 0, TAU, true); break; }
      case 'underline': { const s = cl(+L.thick || 0.35, 0.05, 1) * h, pts = cubic([x + s, s * 0.2], [x + w * 0.3, -h * 0.25 * bend], [x + w * 0.7, h * 0.2 * bend], [-x - s, -s * 0.3]), hw = pts.map((_, i) => s / 2 * Math.min(1, i / 6 + 0.3, (pts.length - 1 - i) / 4 + 0.15)); ribbon(P, wob(pts, rough * s * 0.3, nz), hw, true); break; }
      // a brush swipe to underline words: starts thin on the left, fattens as the brush presses, a little rise along it
      // a brush swipe to underline words: pressed on hard at the left, dragged up and away to the right, lifting off thin
      case 'swipe': { const s = cl(+L.thick || 0.6, 0.15, 1) * h, pts = cubic([x + s * 0.3, -y - s * 0.55], [x + w * 0.38, -y - s * 0.6 - h * 0.05 * bend], [x + w * 0.68, y + s * 0.6 + h * 0.08 * bend], [-x - 2, y + s * 0.25], 80), n = pts.length - 1;
        const hw = pts.map((_, i) => { const t = i / n; return s / 2 * Math.min(1, 0.55 + t * 6) * Math.pow(Math.max(0, 1 - t), 0.55) * (1 + nz(t * 0.4) * 0.1 * (1 + rough)) + 0.5; }); ribbon(P, wob(pts, rough * s * 0.06, nz), hw, false); break; }
      case 'xmark': { const s = cl(+L.thick || 0.16, 0.04, 0.4) * m, a = quad([x + s, y + s], [nz(0.1) * s, nz(0.2) * s], [-x - s, -y - s], 20), b = quad([-x - s, y + s * 1.2], [nz(0.3) * s, nz(0.4) * s], [x + s * 1.1, -y - s], 20), taper = p => p.map((_, i) => s / 2 * Math.min(1, i / 3 + 0.4, (p.length - 1 - i) / 3 + 0.4)); ribbon(P, a, taper(a), true); ribbon(P, b, taper(b), true); break; }
      case 'tick': { const s = cl(+L.thick || 0.18, 0.04, 0.4) * m, pts = [...quad([x + s, h * 0.05], [x + w * 0.28, h * 0.2], [x + w * 0.38, -y - s], 10), ...quad([x + w * 0.38, -y - s], [x + w * 0.55, -h * 0.05], [-x - s, y + s], 16).slice(1)], hw = pts.map((_, i) => s / 2 * Math.min(1, i / 3 + 0.5, (pts.length - 1 - i) / 4 + 0.3)); ribbon(P, pts, hw, true); break; }
      // a dry brush stroke for words to sit on: ragged ends and edges
      case 'brush': { const n = 60, top = [], bot = []; for (let i = 0; i <= n; i++) { const t = i / n, xx = lerp(x, -x, t), end = Math.min(t, 1 - t) < 0.06 ? (1 - Math.min(t, 1 - t) / 0.06) : 0; top.push([xx + nz(t + 0.13) * w * 0.012, y + h * 0.08 + nz(t * 3) * h * 0.06 + end * h * 0.25 * Math.abs(nz(t * 7))]); bot.push([xx + nz(t + 0.61) * w * 0.012, -y - h * 0.08 + nz(t * 3 + 0.4) * h * 0.06 - end * h * 0.25 * Math.abs(nz(t * 5))]); }
        P.moveTo(top[0][0], top[0][1]); top.forEach(p => P.lineTo(p[0], p[1])); for (let i = 0; i < 5; i++) P.lineTo(-x + w * 0.02 * nz(i * 0.2), lerp(top[n][1], bot[n][1], i / 4)); for (let i = n; i >= 0; i--) P.lineTo(bot[i][0], bot[i][1]); for (let i = 4; i >= 0; i--) P.lineTo(x - w * 0.02 * Math.abs(nz(i * 0.3 + 0.5)), lerp(top[0][1], bot[0][1], i / 4)); P.closePath(); break; }
      // speech bubble: rounded, with the tail coming out of the bottom edge
      case 'bubble': case 'shout': { const tail = cl(L.tail == null ? 0.25 : +L.tail, 0, 1), bh = h * 0.78, by = y, tx = lerp(x + w * 0.15, -x - w * 0.15, tail), tw = Math.min(w * 0.12, bh * 0.35), tipX = tx + (tail < 0.5 ? -1 : 1) * w * 0.08;
        if (L.shape === 'shout') { const n = 22; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? 0.8 + nz(i / n) * 0.06 : 1 + nz(i / n + 0.5) * 0.08; const px = Math.cos(a) * w / 2 * r, py = by + bh / 2 + Math.sin(a) * bh / 2 * r; i ? P.lineTo(px, py) : P.moveTo(px, py); } P.closePath(); P.moveTo(tx - tw, by + bh * 0.82); P.lineTo(tipX, -y); P.lineTo(tx + tw, by + bh * 0.82); P.closePath(); break; }
        const pts = roundRectPts(x, by, w, bh, Math.min(bh, w) * 0.42, 8), bottomY = by + bh; let best = 0, bd = 1e9; pts.forEach((p, i) => { if (Math.abs(p[1] - bottomY) < 1 && Math.abs(p[0] - tx) < bd) { bd = Math.abs(p[0] - tx); best = i; } });
        P.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => P.lineTo(p[0], p[1])); P.closePath(); P.moveTo(tx - tw, bottomY - 2); P.lineTo(tipX, -y); P.lineTo(tx + tw, bottomY - 2); P.closePath(); break; }
      case 'thought': { const bh = h * 0.74, cy = y + bh / 2, n = 9; for (let i = 0; i < n; i++) { const a = i / n * TAU, rx = w * 0.38, ry = bh * 0.34, r = Math.min(w, bh) * (0.2 + 0.05 * Math.abs(nz(i / n))); P.moveTo(Math.cos(a) * rx + r, cy + Math.sin(a) * ry); P.arc(Math.cos(a) * rx, cy + Math.sin(a) * ry, r, 0, TAU); }
        P.moveTo(w * 0.4, cy); P.ellipse(0, cy, w * 0.4, bh * 0.36, 0, 0, TAU); const tail = cl(L.tail == null ? 0.25 : +L.tail, 0, 1), tx = lerp(x + w * 0.2, -x - w * 0.2, tail), dir = tail < 0.5 ? -1 : 1;
        [[0.1, 0.07], [0.16, 0.045], [0.21, 0.028]].forEach(([d, r]) => { const cx = tx + dir * w * d * 0.6, cyy = y + bh + h * d * 1.15 - h * 0.02, rr = m * r; P.moveTo(cx + rr, cyy); P.arc(cx, cyy, rr, 0, TAU); }); break; }
      // a comic boom: an uneven spiky burst
      case 'boom': { const n = 13; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n + nz(i / n) * 0.12, r = i % 2 ? 0.55 + nz(i / n + 0.3) * 0.08 : 0.92 + nz(i / n + 0.7) * 0.08; const px = Math.cos(a) * w / 2 * r, py = Math.sin(a) * h / 2 * r; i ? P.lineTo(px, py) : P.moveTo(px, py); } P.closePath(); break; }
      case 'heart': { P.moveTo(0, h * 0.35); P.bezierCurveTo(-w * 0.62, -h * 0.05, -w * 0.38, -h * 0.62, 0, -h * 0.22); P.bezierCurveTo(w * 0.38, -h * 0.62, w * 0.62, -h * 0.05, 0, h * 0.35); P.closePath(); break; }
      default: if (+L.r > 0 && Path2D.prototype.roundRect) P.roundRect(x, y, w, h, Math.min(+L.r, w / 2, h / 2)); else P.rect(x, y, w, h);
    }
    return parts;
  }
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const shade = (c, k) => { const [r, g, b] = hex(c); const f = v => Math.round(cl(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255)); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; };
  // draws the layer's shape at 0,0: depth, outline behind, fill (and gradient), shine
  function draw(g, L) {
    const parts = geo(L), rule = parts.eo ? 'evenodd' : 'nonzero', sw = Math.max(0, +L.sw || 0), dep = Math.max(0, +L.depth || 0), fill = L.fill || '#e8322c', filled = L.fillOn !== false, out = L.stroke || '#ffffff';
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (dep > 0) { const dc = L.depthC || shade(fill, -0.45), steps = Math.ceil(dep / 1.5); for (let i = steps; i >= 1; i--) { const o = dep * i / steps; g.save(); g.translate(o * 0.45, o); if (sw > 0) { g.strokeStyle = out; g.lineWidth = sw * 2; parts.forEach(q => g.stroke(q)); } g.fillStyle = dc; parts.forEach(q => g.fill(q, rule)); g.restore(); } }
    if (sw > 0) { g.strokeStyle = out; g.lineWidth = sw * 2; parts.forEach(q => g.stroke(q)); }
    if (filled) { let f = fill; if (L.fill2) { const gr = g.createLinearGradient(0, -L.h / 2, 0, L.h / 2); gr.addColorStop(0, fill); gr.addColorStop(1, L.fill2); f = gr; } g.fillStyle = f; parts.forEach(q => g.fill(q, rule)); }
    else if (sw <= 0) { g.strokeStyle = fill; g.lineWidth = 4; parts.forEach(q => g.stroke(q)); }
    if (L.shine && filled) { g.save(); { const u = new Path2D(); parts.forEach(q => u.addPath(q)); g.clip(u, rule); } const gr = g.createLinearGradient(0, -L.h / 2, 0, L.h * 0.05); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-L.w / 2, -L.h / 2, L.w, L.h * 0.55); g.restore(); }
  }
  // the shapes on offer, by group, each a ready look
  const RED = '#e8322c', YEL = '#ffd21f';
  const PRESETS = [
    ['Arrows', [
      ['Curved arrow', { shape: 'carrow', w: 300, h: 220, fill: RED, sw: 7, stroke: '#ffffff', depth: 8, thick: 0.2, bend: 0.5 }],
      ['Swoosh', { shape: 'swoosh', w: 340, h: 200, fill: YEL, sw: 6, stroke: '#000000', thick: 0.24, bend: 0.8 }],
      ['Loop arrow', { shape: 'loop', w: 360, h: 220, fill: RED, sw: 6, stroke: '#ffffff', thick: 0.12 }],
      ['Marker arrow', { shape: 'harrow', w: 280, h: 200, fill: '#ffffff', sw: 0, thick: 0.06, bend: 0.4, rough: 0.4 }],
      ['Big 3D arrow', { shape: 'arrow', w: 300, h: 160, fill: RED, fill2: '#a50f0b', sw: 8, stroke: '#ffffff', depth: 12, shine: true }],
      ['Both ways', { shape: 'darrow', w: 360, h: 110, fill: YEL, sw: 6, stroke: '#000000', thick: 0.28 }],
      ['Hand drawn curve', { shape: 'carrow', w: 300, h: 220, fill: '#ffffff', sw: 0, thick: 0.09, bend: 0.8, rough: 0.8 }],
      ['Straight arrow', { shape: 'arrow', w: 280, h: 140, fill: RED, sw: 6, stroke: '#ffffff' }]]],
    ['Circle it', [
      ['Scribbled circle', { shape: 'scribble', w: 340, h: 240, fill: RED, sw: 0, thick: 0.06, rough: 0.5 }],
      ['Ring', { shape: 'ring', w: 300, h: 300, fill: RED, sw: 5, stroke: '#ffffff', thick: 0.07 }],
      ['Brush swipe', { shape: 'swipe', w: 620, h: 150, fill: '#ff1a1a', sw: 0, grit: 0.6, bend: 0.3, thick: 0.6 }],
      ['Underline', { shape: 'underline', w: 420, h: 60, fill: RED, sw: 0, thick: 0.4, bend: 0.5, rough: 0.3 }],
      ['Cross', { shape: 'xmark', w: 220, h: 220, fill: RED, sw: 7, stroke: '#ffffff', thick: 0.16 }],
      ['Tick', { shape: 'tick', w: 220, h: 200, fill: '#2ecc40', sw: 7, stroke: '#ffffff', thick: 0.17 }],
      ['Brush stroke', { shape: 'brush', w: 520, h: 120, fill: RED, sw: 0 }]]],
    ['Bubbles', [
      ['Speech', { shape: 'bubble', w: 360, h: 230, fill: '#ffffff', sw: 6, stroke: '#000000', tail: 0.25 }],
      ['Shout', { shape: 'shout', w: 380, h: 260, fill: YEL, sw: 6, stroke: '#000000', tail: 0.7 }],
      ['Thought', { shape: 'thought', w: 360, h: 260, fill: '#ffffff', sw: 6, stroke: '#000000', tail: 0.3 }]]],
    ['Bursts', [
      ['Boom', { shape: 'boom', w: 300, h: 260, fill: YEL, fill2: '#ff8a00', sw: 8, stroke: '#000000', depth: 8, depthC: '#c0392b' }],
      ['Burst', { shape: 'burst', w: 260, h: 260, fill: RED, sw: 7, stroke: '#ffffff', shine: true }],
      ['Star', { shape: 'star', w: 240, h: 230, fill: YEL, fill2: '#ffab00', sw: 6, stroke: '#000000', depth: 7 }],
      ['Heart', { shape: 'heart', w: 240, h: 220, fill: '#ff2d55', sw: 6, stroke: '#ffffff', shine: true }]]],
    ['Basics', [
      ['Box', { shape: 'rect', w: 300, h: 180, fill: RED }], ['Rounded', { shape: 'round', w: 300, h: 180, fill: RED }], ['3D box', { shape: 'round', w: 300, h: 160, fill: YEL, sw: 6, stroke: '#000000', depth: 12 }],
      ['Circle', { shape: 'circle', w: 220, h: 220, fill: RED }], ['Triangle', { shape: 'tri', w: 240, h: 210, fill: YEL, sw: 6, stroke: '#000000' }], ['Banner', { shape: 'banner', w: 460, h: 110, fill: RED, sw: 0 }], ['Line', { shape: 'line', w: 400, h: 60, fill: '#ffffff' }]]]];
  const NAMES = Object.fromEntries(PRESETS.flatMap(([, list]) => list.map(([n, o]) => [o.shape, n])));
  NAMES.carrow = 'Curved arrow'; NAMES.arrow = 'Straight arrow'; NAMES.round = 'Rounded box';
  const BENDY = ['carrow', 'swoosh', 'harrow', 'underline', 'swipe'], TAILED = ['bubble', 'shout', 'thought'], THICK = ['carrow', 'swoosh', 'loop', 'harrow', 'darrow', 'scribble', 'ring', 'underline', 'swipe', 'xmark', 'tick'], ROUGH = ['carrow', 'swoosh', 'loop', 'harrow', 'scribble', 'underline', 'swipe'];
  return { geo, draw, PRESETS, NAMES, BENDY, TAILED, THICK, ROUGH, shade };
})();

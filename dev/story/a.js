/* Story: a chalkboard animator. Scenes in seven regions and four eras, stick people in their own colours and dress,
   and a lane per person on the timeline where each bar is something they do: walk, talk, dive in the river, draw a sword. */
const Story = (() => {
  const { cl, lerp, ease, rng } = E;
  const WW = 1920, WH = 1080, FL = 905, S = 410, OUT = 0.6, INTRO = 1.0;
  const io = t => { t = cl(t, 0, 1); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }, out3 = ease.out3;
  const CH = { white: '#f2efe6', yellow: '#f5e17a', pink: '#f3a6c4', blue: '#9dd2f3', green: '#a9e3a0', orange: '#f6b46e', purple: '#cbb6f0', brown: '#c08a55', darkbrown: '#6e4527', black: '#141414', red: '#f08a7e', grey: '#bfc3c7' };
  const BOARDS = { green: '#2d4a3d', black: '#23282b', slate: '#2b3b4c' };
  let BOARD = BOARDS.green, POP = true, SETA = 1, GORE = 'cartoon', EDGE = false;
  const DARK = ['darkbrown', 'black'];
  const mixC = (a, b, k) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const FONT = '"Kalam", "Segoe Print", "Comic Sans MS", cursive';
  const mkC = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  /* ---------- Chalk kit ---------- */
  // A dusty speckle pattern per colour, kept per drawing surface (patterns belong to the context that made them)
  const patStore = new WeakMap();
  function pat(g, col) {
    let m = patStore.get(g); if (!m) { m = {}; patStore.set(g, m); } if (m[col]) return m[col];
    const c = mkC(128, 128), x = c.getContext('2d'), im = x.createImageData(128, 128), r = rng(11), n = parseInt(col.slice(1), 16);
    for (let i = 0; i < im.data.length; i += 4) { im.data[i] = n >> 16; im.data[i + 1] = (n >> 8) & 255; im.data[i + 2] = n & 255; im.data[i + 3] = r() < 0.8 ? 170 + r() * 85 : r() * 70; }
    x.putImageData(im, 0, 0); return (m[col] = g.createPattern(c, 'repeat'));
  }
  const plen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
  function partial(p, f) { if (f >= 1) return p; if (f <= 0 || p.length < 2) return []; const goal = plen(p) * f, o = [p[0]]; let s = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s + d >= goal) { const q = (goal - s) / (d || 1); o.push([lerp(p[i - 1][0], p[i][0], q), lerp(p[i - 1][1], p[i][1], q)]); return o; } s += d; o.push(p[i]); } return o; }
  function line(g, p, col = CH.white, w = 5) {
    if (!p || p.length < 2) return; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < p.length; i++) i ? g.lineTo(p[i][0], p[i][1]) : g.moveTo(p[i][0], p[i][1]);
    // Over real footage a soft dark edge keeps the chalk readable on bright parts of the picture
    if (EDGE) { g.strokeStyle = '#000'; g.lineWidth = w + 7; g.globalAlpha *= 0.42; g.stroke(); g.globalAlpha /= 0.42; }
    g.strokeStyle = pat(g, col); g.lineWidth = w * 2.1; g.globalAlpha *= 0.16; g.stroke(); g.globalAlpha /= 0.16; g.lineWidth = w; g.stroke();
  }
  // Many separate marks in one colour drawn as one path: far cheaper for rain, snow and stars
  function lines(g, list, col = CH.white, w = 5) {
    if (!list.length) return; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); list.forEach(p => { for (let i = 0; i < p.length; i++) i ? g.lineTo(p[i][0], p[i][1]) : g.moveTo(p[i][0], p[i][1]); });
    if (EDGE) { g.strokeStyle = '#000'; g.lineWidth = w + 6; g.globalAlpha *= 0.35; g.stroke(); g.globalAlpha /= 0.35; }
    g.strokeStyle = pat(g, col); g.lineWidth = w * 2.1; g.globalAlpha *= 0.16; g.stroke(); g.globalAlpha /= 0.16; g.lineWidth = w; g.stroke();
  }
  function fillPoly(g, p, col, a = 1) { if (!p || p.length < 3) return; const ga = g.globalAlpha; g.globalAlpha = ga * a; g.fillStyle = col; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); g.globalAlpha = ga; }
  const circP = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 26) => { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  const rectP = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  function wob(p, amt, seed) { const r = rng(seed), o = []; for (let i = 0; i < p.length; i++) { if (i > 0) { const [x0, y0] = p[i - 1], [x1, y1] = p[i], L = Math.hypot(x1 - x0, y1 - y0), n = Math.min(60, Math.floor(L / 40)); for (let k = 1; k < n; k++) o.push([lerp(x0, x1, k / n) + (r() - .5) * amt, lerp(y0, y1, k / n) + (r() - .5) * amt]); } o.push([p[i][0] + (r() - .5) * amt * 0.6, p[i][1] + (r() - .5) * amt * 0.6]); } return o; }
  function text(g, str, x, y, size, col = CH.white, align = 'center', reveal = 1, weight = 700) {
    if (!str) return; const n = Math.ceil(str.length * cl(reveal, 0, 1)); if (n <= 0) return; g.save(); g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle';
    if (EDGE) { g.globalAlpha *= 0.55; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.lineWidth = Math.max(3, size * 0.14); g.strokeText(str.slice(0, n), x, y); g.globalAlpha /= 0.55; }
    g.globalAlpha *= 0.22; g.fillStyle = col; g.fillText(str.slice(0, n), x + 1, y + 1); g.globalAlpha /= 0.22; g.fillStyle = pat(g, col); g.fillText(str.slice(0, n), x, y); g.restore();
  }
  const measure = (() => { let m = null; return (str, size) => { if (!m) m = mkC(8, 8).getContext('2d'); m.font = `700 ${size}px ${FONT}`; return m.measureText(str).width; }; })();
  function wrap(str, size, maxW) { const words = String(str).split(/\s+/).filter(Boolean), lines = []; let cur = ''; words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (measure(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return { lines, w: lines.length ? Math.max(...lines.map(l => measure(l, size))) : 0 }; }
  // The board, with old smudges, cached per size
  const boardCache = {};
  function boardTex(w, h, col) {
    const key = w + 'x' + h + col; if (boardCache[key]) return boardCache[key];
    const c = mkC(w, h), x = c.getContext('2d'), r = rng(3), k = Math.max(w, h) / 1920; x.fillStyle = col; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const cx = r() * w, cy = r() * h, rr = (120 + r() * 360) * k, gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(255,255,255,.035)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
    x.strokeStyle = 'rgba(255,255,255,.025)'; for (let i = 0; i < 40; i++) { x.lineWidth = (30 + r() * 60) * k; x.beginPath(); const y = r() * h; x.moveTo(r() * w * 0.3, y); x.bezierCurveTo(w * 0.4, y + (r() - .5) * 200 * k, w * 0.6, y + (r() - .5) * 200 * k, w * (0.7 + r() * 0.3), y + (r() - .5) * 100 * k); x.stroke(); }
    const n = mkC(256, 256), nx = n.getContext('2d'), im = nx.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = r() < 0.5 ? 255 : 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 7; } nx.putImageData(im, 0, 0);
    x.fillStyle = x.createPattern(n, 'repeat'); x.fillRect(0, 0, w, h);
    return (boardCache[key] = c);
  }
  function frameDraw(g, W, H, u) {
    g.save(); g.lineWidth = 36 * u; g.strokeStyle = '#6b4423'; g.strokeRect(18 * u, 18 * u, W - 36 * u, H - 36 * u); g.lineWidth = 4 * u; g.strokeStyle = '#8a5a30'; g.strokeRect(4 * u, 4 * u, W - 8 * u, H - 8 * u); g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(38 * u, 38 * u, W - 76 * u, H - 76 * u);
    g.fillStyle = '#7a4e28'; g.fillRect(36 * u, H - 44 * u, W - 72 * u, 26 * u); g.fillStyle = '#f2efe6'; g.fillRect(260 * u, H - 50 * u, 70 * u, 12 * u); g.fillStyle = '#f5e17a'; g.fillRect(360 * u, H - 50 * u, 50 * u, 12 * u); g.restore();
  }

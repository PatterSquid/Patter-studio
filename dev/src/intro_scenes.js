/* IntroScenes: the intro cut scene, "Chucked oot". His own Coatbridge street picture (assets/coatbridge-street.jpg,
   COAT_STREET) is the set, with a pub front drawn onto the corner building, and his own icon (Squid) as the star. The
   characters are flat adult cartoon style (thick even outlines, flat colour, one shadow tone): two bouncers fling him
   out the pub, he gives them the finger (a wee fist on the end of a tentacle), a ned comes up the road at the camera on
   a BMX and soaks him through a puddle, he necks his tonic wine (made up label: no real brand) and spews ink over the
   lens. The ink covers the screen, his logo pops up, then PatterSquid and the episode, and a traffic cone lands on the
   logo. Pure functions of time: swally(g, t, W, H, o) with o = { name, line, episode, kicker }. */
const IntroScenes = (() => {
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f;
  const ease = f => { f = cl(f); return f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; }, eo = f => 1 - Math.pow(1 - cl(f), 3), ei = f => Math.pow(cl(f), 3);
  const eb = f => { f = cl(f); const c = 1.7; return 1 + (c + 1) * Math.pow(f - 1, 3) + c * Math.pow(f - 1, 2); }, sm = f => { f = cl(f); return f * f * (3 - 2 * f); };
  const bump = (k, w) => k < 0 || k > w ? 0 : Math.sin(Math.PI * k / w);
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const key = (t, K, e = ease) => { if (t <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (t < K[i + 1][0]) { const f = (t - K[i][0]) / (K[i + 1][0] - K[i][0]); return lerp(K[i][1], K[i + 1][1], (K[i][2] || e)(f)); } return K[K.length - 1][1]; };
  const INK = '#15121a', TITLE = '"Erica One", "Bricolage Grotesque", "Arial Black", sans-serif', TALL = '"Boldonse", "Bricolage Grotesque", Impact, sans-serif', BODY = '"Bricolage Grotesque", "Segoe UI", sans-serif';
  const PW = 1672, PH = 941, TAU = Math.PI * 2;
  let plate = null, soft = null, logo = null, readyP = null;
  const bmp = src => fetch(src).then(r => r.blob()).then(createImageBitmap);
  function ready() { return readyP || (readyP = Promise.all([
    typeof COAT_STREET !== 'undefined' ? bmp(COAT_STREET).then(b => { plate = b; soft = mk(PW, PH); const x = soft.getContext('2d'); x.filter = 'blur(1.6px)'; x.drawImage(b, 0, 0); }) : null,
    typeof STUDIO_LOGO !== 'undefined' ? bmp(STUDIO_LOGO).then(b => { logo = b; }) : null,
    typeof Squid !== 'undefined' ? Squid.ready() : null, typeof PatterFonts !== 'undefined' ? PatterFonts.ready() : null]).catch(() => null)); }
  function camTo(g, W, H, c) { const z = Math.max(1, c.z), k = Math.max(W / PW, H / PH) * z, hw = W / 2 / k, hh = H / 2 / k, x = cl(c.x, hw, PW - hw), y = cl(c.y, hh, PH - hh); g.setTransform(k, 0, 0, k, W / 2 - x * k, H / 2 - y * k); return k; }
  function glow(g, x, y, r, col, a) { if (a <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a.toFixed(3))); gr.addColorStop(1, col.replace('A', '0')); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }

  /* ---------- the cartoon look: thick even outlines, flat colour, one shadow tone ---------- */
  const OL = (g, w = 4) => { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; };
  // a flat shape: shadow tone, the base colour shifted towards the light (top left) so the shadow shows as a band, outline
  function flat(g, path, base, dark, d = 6, w = 4) { const P = new Path2D(); path(P); if (dark) { g.fillStyle = dark; g.fill(P); g.save(); g.clip(P); g.translate(-d, -d * 0.7); g.fillStyle = base; g.fill(P); g.restore(); } else { g.fillStyle = base; g.fill(P); } if (w) { OL(g, w); g.stroke(P); } return P; }
  // a limb: outline, shadow tone, base tone a little towards the light
  function limb(g, pts, w, base, dark) { const pl = () => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); }; pl(); OL(g, w + 8); g.stroke(); g.strokeStyle = dark; g.lineWidth = w; g.stroke(); g.save(); g.translate(-w * 0.14, -w * 0.12); pl(); g.strokeStyle = base; g.lineWidth = w * 0.66; g.stroke(); g.restore(); }
  const ik = (a, b, l1, l2, bend) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01), an = Math.atan2(dy, dx), k = Math.acos(cl((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)); return [a[0] + Math.cos(an + bend * k) * l1, a[1] + Math.sin(an + bend * k) * l1]; };
  const shade = (c, f) => { const n = parseInt(c.slice(1), 16), m = v => Math.min(255, v * f | 0); return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`; };
  const SK = '#f2c3a0', SKD = '#cf8f73';

  /* ---------- his icon with a thick cartoon outline ---------- */
  const SB = { a: null, b: null };
  function squidComic(g, x, y, h, pose, k) { if (typeof Squid === 'undefined') return; const s = Math.ceil(h * 2.6 * Math.max(1, k)), sc = s / (h * 2.6);
    if (!SB.a || SB.a.width < s) { SB.a = mk(s, s); SB.b = mk(s, s); } const a = SB.a.getContext('2d'), b = SB.b.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, SB.a.width, SB.a.height);
    if (!Squid.draw(a, s / 2, s * 0.75, h * sc, pose)) return; b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, SB.b.width, SB.b.height); b.drawImage(SB.a, 0, 0); b.globalCompositeOperation = 'source-in'; b.fillStyle = INK; b.fillRect(0, 0, s, s); b.globalCompositeOperation = 'source-over';
    const ox = x - s / 2 / sc, oy = y - s * 0.75 / sc, ow = h * 0.016; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; g.drawImage(SB.b, 0, 0, s, s, ox + Math.cos(an) * ow, oy + Math.sin(an) * ow, s / sc, s / sc); }
    g.drawImage(SB.a, 0, 0, s, s, ox, oy, s / sc, s / sc); }

  /* ---------- props ---------- */
  // the tonic wine: tall dark bottle, gold screw cap, his own made up label
  let LBL = { src: null, img: null }, BOT = null; function bottle() { if (BOT) return BOT; const c = mk(130, 360), g = c.getContext('2d'), cx = 65;
    const body = P => { P.moveTo(cx - 13, 36); P.lineTo(cx + 13, 36); P.lineTo(cx + 13, 92); P.bezierCurveTo(cx + 15, 128, cx + 44, 132, cx + 44, 170); P.lineTo(cx + 44, 334); P.quadraticCurveTo(cx + 44, 350, cx + 28, 350); P.lineTo(cx - 28, 350); P.quadraticCurveTo(cx - 44, 350, cx - 44, 334); P.lineTo(cx - 44, 170); P.bezierCurveTo(cx - 44, 132, cx - 15, 128, cx - 13, 92); P.closePath(); };
    const Pb = flat(g, body, '#2a1712', '#140a08', 12, 0);
    g.save(); g.clip(Pb); g.fillStyle = 'rgba(160,230,150,0.35)'; g.fillRect(cx - 34, 150, 9, 190); g.fillRect(cx - 7, 40, 5, 70); g.fillStyle = '#efe3c4'; g.fillRect(cx - 44, 200, 88, 108); g.fillStyle = '#c4202a'; g.fillRect(cx - 44, 200, 88, 24); g.fillRect(cx - 44, 296, 88, 12);
    if (LBL.img) { const im = LBL.img, sc = Math.max(88 / im.width, 108 / im.height); g.save(); g.beginPath(); g.rect(cx - 44, 200, 88, 108); g.clip(); g.drawImage(im, cx - im.width * sc / 2, 254 - im.height * sc / 2, im.width * sc, im.height * sc); g.restore(); } else {
    g.fillStyle = '#1a1410'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 17px ${TITLE}`; g.fillText('Auld', cx, 244); g.fillText('Patter', cx, 263); g.fillStyle = '#c4202a'; g.font = `700 10px ${BODY}`; g.fillText('TONIC WINE', cx, 283); g.fillStyle = '#fff4d8'; g.font = `700 9px ${BODY}`; g.fillText('EST. 1983', cx, 212); } g.restore();
    OL(g, 5); g.stroke(Pb); g.beginPath(); g.moveTo(cx - 44, 200); g.lineTo(cx + 44, 200); g.moveTo(cx - 44, 308); g.lineTo(cx + 44, 308); g.lineWidth = 2.5; g.stroke();
    flat(g, P => P.roundRect(cx - 16, 6, 32, 34, 4), '#e7c04f', '#b38a24', 5, 4); OL(g, 2); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(cx - 10 + i * 5, 10); g.lineTo(cx - 10 + i * 5, 36); g.stroke(); }
    return (BOT = c); }
  // his cap: a ned check cap (grey with black and white checks: our own colours), seen from the front, worn high and squint
  function cap(g, x, y, w, rot, wet) { g.save(); g.translate(x, y); g.rotate(rot); const base = wet ? '#7f858c' : '#a7adb3';
    const dome = P => { P.moveTo(-w / 2, 0); P.bezierCurveTo(-w * 0.52, -w * 0.78, w * 0.52, -w * 0.78, w / 2, 0); P.quadraticCurveTo(0, w * 0.1, -w / 2, 0); P.closePath(); };
    // the skip, worn squint: out to his left and a wee bit at us (drawn first so the dome sits over its root)
    flat(g, P => { P.moveTo(w * 0.05, w * 0.04); P.quadraticCurveTo(w * 0.62, w * 0.02, w * 0.86, w * 0.16); P.quadraticCurveTo(w * 0.7, w * 0.3, w * 0.25, w * 0.2); P.quadraticCurveTo(w * 0.08, w * 0.14, w * 0.05, w * 0.04); P.closePath(); }, '#2b2e34', '#16181c', w * 0.03, w * 0.04);
    const D = flat(g, dome, base, shade(base, 0.72), w * 0.06, 0); g.save(); g.clip(D); g.strokeStyle = 'rgba(20,20,26,0.7)'; g.lineWidth = w * 0.05;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * w * 0.17, -w); g.lineTo(i * w * 0.17 + w * 0.08, w * 0.2); g.stroke(); } for (let j = 0; j < 5; j++) { g.beginPath(); g.moveTo(-w, -w * 0.08 - j * w * 0.13); g.lineTo(w, -w * 0.04 - j * w * 0.13); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = w * 0.016; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * w * 0.17 + w * 0.085, -w); g.lineTo(i * w * 0.17 + w * 0.165, w * 0.2); g.stroke(); }
    OL(g, w * 0.02); g.beginPath(); g.moveTo(0, -w * 0.58); g.quadraticCurveTo(-w * 0.2, -w * 0.3, -w * 0.22, w * 0.03); g.moveTo(0, -w * 0.58); g.quadraticCurveTo(w * 0.2, -w * 0.3, w * 0.22, w * 0.03); g.stroke(); g.restore();
    OL(g, w * 0.04); g.stroke(D); flat(g, P => P.arc(0, -w * 0.585, w * 0.045, 0, TAU), base, null, 0, w * 0.03);
    g.restore(); }
  // the Glasgow traffic cone
  function cone(g, x, y, h, rot, sq = 1) { g.save(); g.translate(x, y); g.rotate(rot); g.scale(1 / Math.sqrt(sq), sq); const w = h * 0.52;
    flat(g, P => P.roundRect(-w * 1.1, -h * 0.1, w * 2.2, h * 0.14, h * 0.03), '#e8580f', '#a93a05', h * 0.02, h * 0.035);
    const body = P => { P.moveTo(-w * 0.9, -h * 0.1); P.lineTo(-w * 0.17, -h); P.quadraticCurveTo(0, -h * 1.04, w * 0.17, -h); P.lineTo(w * 0.9, -h * 0.1); P.closePath(); };
    const B2 = flat(g, body, '#ff7419', '#c9500c', h * 0.05, 0); g.save(); g.clip(B2); g.fillStyle = '#f4f4f0'; g.fillRect(-w, -h * 0.66, w * 2, h * 0.14); g.fillRect(-w, -h * 0.4, w * 2, h * 0.1); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(w * 0.25, -h, w, h); g.restore(); OL(g, h * 0.035); g.stroke(B2); g.restore(); }

  /* ---------- the pub: a Glasgow pub front painted onto the corner building ---------- */
  const PUB = { tl: [112, 332], tr: [478, 346], bl: [112, 762] };
  function pub(g, t, open, laugh) { g.save(); const { tl, tr, bl } = PUB; g.transform((tr[0] - tl[0]) / 1000, (tr[1] - tl[1]) / 1000, (bl[0] - tl[0]) / 1000, (bl[1] - tl[1]) / 1000, tl[0], tl[1]);
    flat(g, P => P.rect(0, 0, 1000, 1000), '#1e4630', '#13301f', 14, 9);
    // fascia with the name in gold
    flat(g, P => P.rect(0, 0, 1000, 175), '#123020', null, 0, 9); g.strokeStyle = '#c9a23e'; g.lineWidth = 6; g.strokeRect(22, 22, 956, 131);
    g.save(); g.translate(500, 92); g.scale(1.15, 1); g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 92; g.font = `400 ${fs}px ${TITLE}`; while (g.measureText("THE HOLE IN THE WA'").width > 760) { fs -= 2; g.font = `400 ${fs}px ${TITLE}`; }
    g.lineWidth = 12; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText("THE HOLE IN THE WA'", 0, 0); g.fillStyle = '#efc95a'; g.fillText("THE HOLE IN THE WA'", 0, 0); g.restore();
    // frosted windows, warm and lit, with bars
    [[70, 350], [650, 930]].forEach(([a, b], i) => { flat(g, P => P.rect(a, 245, b - a, 520), '#f4b765', '#d98e3e', 18, 8); g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillRect(a + 30, 270, (b - a) * 0.3, 470); OL(g, 8); g.beginPath(); g.moveTo((a + b) / 2, 245); g.lineTo((a + b) / 2, 765); g.moveTo(a, 500); g.lineTo(b, 500); g.stroke();
      g.save(); g.globalAlpha = 0.25 + 0.15 * Math.sin(t * 9 + i * 3) * laugh; g.fillStyle = '#5a2d10'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(a + 60 + k * 85, 420 + (k % 2) * 30, 34, 44, 0, 0, TAU); g.fill(); g.fillRect(a + 26 + k * 85, 440 + (k % 2) * 30, 68, 120); } g.restore();
      flat(g, P => P.rect(a - 10, 780, b - a + 20, 200), '#1b3d29', '#112819', 10, 7); });
    // the door: shut (green, glass lit from inside) or open (a warm doorway with the door swung in)
    const lite = 0.65 + 0.35 * open; flat(g, P => P.rect(395, 230, 210, 770), '#0d0c10', null, 0, 9);
    if (open > 0.02) { g.fillStyle = `rgb(255,${200 + 20 * Math.sin(t * 11)},${110})`; g.fillRect(405, 240, 190, 760); g.fillStyle = 'rgba(120,50,20,0.55)'; g.fillRect(405, 640, 190, 360); g.fillStyle = '#7a3d1c'; g.fillRect(405, 600, 190, 26);
      const dw = 190 * (1 - 0.82 * open); flat(g, P => P.rect(405, 240, dw, 760), '#245a3d', '#173d29', 8, 7); }
    else { flat(g, P => P.rect(405, 240, 190, 760), '#245a3d', '#173d29', 10, 8); flat(g, P => P.rect(435, 280, 130, 300), `rgb(255,${190 * lite | 0},${100 * lite | 0})`, null, 0, 6); flat(g, P => P.rect(435, 620, 130, 320), '#1d4a32', '#143424', 8, 6); flat(g, P => P.arc(565, 640, 10, 0, TAU), '#e7c04f', null, 0, 4); }
    flat(g, P => P.rect(470, 195, 60, 30), '#e7c04f', '#b38a24', 4, 6);
    g.restore();
    // light from the door and windows across the pavement
    g.save(); g.globalCompositeOperation = 'screen'; glow(g, 300, 770, 260, 'rgba(255,170,80,A)', 0.18 + 0.35 * open); glow(g, 190, 760, 140, 'rgba(255,170,80,A)', 0.2); glow(g, 410, 755, 140, 'rgba(255,170,80,A)', 0.2); g.restore(); }

  /* ---------- painted volume: cel shading with a shadow side, a lit edge, warm rim light and line weight ---------- */
  // shapes are Path2D; L points towards the key light (the street lamps, up and right), R towards the rim light (the pub, behind left)
  const KEY = [0.55, -0.83], RIM = [-0.85, -0.5];
  const sh2 = (P, dx, dy) => { const Q = new Path2D(); Q.addPath(P); Q.addPath(P, new DOMMatrix([1, 0, 0, 1, dx, dy])); return Q; };
  function vol(g, P, base, o = {}) { const k = o.k == null ? 14 : o.k, L = o.L || KEY, R = o.R || RIM;
    g.fillStyle = base; g.fill(P); g.save(); g.clip(P);
    if (o.hl) { g.fillStyle = o.hl; g.fill(sh2(P, -L[0] * k * 0.35, -L[1] * k * 0.35), 'evenodd'); }
    if (o.sh) { g.fillStyle = o.sh; g.fill(sh2(P, L[0] * k, L[1] * k), 'evenodd'); }
    if (o.ao) { const b = o.ao; const gr = g.createLinearGradient(0, b[0], 0, b[1]); gr.addColorStop(0, 'rgba(10,8,20,0)'); gr.addColorStop(1, 'rgba(10,8,20,0.45)'); g.fillStyle = gr; g.fill(P); }
    if (o.rim) { g.fillStyle = o.rim; g.fill(sh2(P, -R[0] * (o.rw || 4), -R[1] * (o.rw || 4)), 'evenodd'); }
    g.restore(); if (o.lw !== 0) { OL(g, o.lw || 4.5); g.stroke(P); } return P; }
  // a smooth tube around a polyline (Catmull Rom through the points), width w0 to w1, round ends: limbs, sleeves, trouser legs
  function tube(pts, w0, w1, wm) { const S = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 0; j < 8; j++) { const u = j / 8, u2 = u * u, u3 = u2 * u; S.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3))); } }
    S.push(pts[pts.length - 1]); const n = S.length, A = [], Bq = [];
    for (let i = 0; i < n; i++) { const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, f = i / (n - 1), w = (wm ? (f < 0.5 ? lerp(w0, wm, f * 2) : lerp(wm, w1, f * 2 - 1)) : lerp(w0, w1, f)) / 2; A.push([S[i][0] - dy / l * w, S[i][1] + dx / l * w]); Bq.push([S[i][0] + dy / l * w, S[i][1] - dx / l * w]); }
    const P = new Path2D(); P.moveTo(A[0][0], A[0][1]); for (let i = 1; i < n; i++) P.lineTo(A[i][0], A[i][1]); const e = S[n - 1], e0 = S[n - 2], ea = Math.atan2(e[1] - e0[1], e[0] - e0[0]); P.arc(e[0], e[1], w1 / 2, ea + Math.PI / 2, ea - Math.PI / 2, true);
    for (let i = n - 1; i >= 0; i--) P.lineTo(Bq[i][0], Bq[i][1]); const s0 = S[0], s1 = S[1], sa = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]); P.arc(s0[0], s0[1], w0 / 2, sa - Math.PI / 2, sa + Math.PI / 2, true); P.closePath(); return P; }
  const path = f => { const P = new Path2D(); f(P); return P; };
  const line = (g, w, f, col) => { g.beginPath(); f(g); g.lineWidth = w; g.strokeStyle = col || INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); };

  // the bouncer's trousers
  const JK = { base: '#2c303c', sh: '#171921', hl: '#3d4352', rim: 'rgba(255,160,80,0.85)' }, TR = { base: '#23252d', sh: '#121318', hl: '#33363f', rim: 'rgba(255,160,80,0.7)' };
  /* ---------- the ned on his BMX, coming at the camera ---------- */
  // units: ground 0, about 300 tall, facing us; o = { ph (pedal turn), sway }
  const TK = { base: '#22242b', sh: '#111216', hl: '#383b45', rim: 'rgba(170,200,255,0.6)' }, GR = { base: '#9a9da5', sh: '#676a72', hl: '#b9bcc4', rim: 'rgba(200,220,255,0.7)' }, CH = { base: '#cfd3da', sh: '#7d828c', hl: '#ffffff' };
  function ned(g, o) { const ph = o.ph, R2 = [0.7, -0.7]; g.save(); g.rotate(o.sway || 0);
    // shadow
    g.fillStyle = 'rgba(6,4,12,0.55)'; g.beginPath(); g.ellipse(0, 0, 70, 12, 0, 0, TAU); g.fill();
    // hood bunched behind the neck, then the trackie top hunched forward over the bars
    vol(g, path(P => P.ellipse(0, -248, 50, 28, 0, 0, TAU)), '#8f939b', { sh: '#5f636b', k: 12, R: R2, rim: TK.rim });
    const torso = path(P => { P.moveTo(-64, -244); P.bezierCurveTo(-30, -262, 30, -262, 64, -244); P.bezierCurveTo(70, -210, 52, -170, 42, -150); P.quadraticCurveTo(0, -138, -42, -150); P.bezierCurveTo(-52, -170, -70, -210, -64, -244); P.closePath(); });
    vol(g, torso, TK.base, Object.assign({ k: 26, R: R2, rw: 4, ao: [-200, -140] }, TK)); line(g, 3, c => { c.moveTo(-56, -238); c.quadraticCurveTo(-50, -190, -38, -152); c.moveTo(56, -238); c.quadraticCurveTo(50, -190, 38, -152); }, '#f2f2f2'); line(g, 2, c => { c.moveTo(0, -254); c.lineTo(0, -144); }, '#555a66');
    line(g, 3.5, c => c.arc(0, -252, 17, 0.5, Math.PI - 0.5), '#e8c04a');
    // legs pumping either side of the frame: grey trackies tucked into white socks, chunky white trainers
    [-1, 1].forEach(sd => { const a = ph + (sd > 0 ? Math.PI : 0), up = 0.5 + 0.5 * Math.sin(a), hip = [sd * 24, -156], knee = [sd * 46, -120 - 36 * up], foot = [sd * 34, -40 + 10 * Math.cos(a) - 14 * up], sock = [lerp(knee[0], foot[0], 0.72), lerp(knee[1], foot[1], 0.72)];
      vol(g, tube([hip, knee, sock], 34, 26, 36), GR.base, Object.assign({ k: 12, R: R2 }, GR)); line(g, 2.5, c => { c.moveTo(hip[0] + sd * 12, hip[1]); c.lineTo(knee[0] + sd * 13, knee[1]); c.lineTo(sock[0] + sd * 10, sock[1]); }, 'rgba(255,255,255,0.8)');
      vol(g, tube([sock, foot], 22, 20), '#f4f2ec', { sh: '#c9c6bc', k: 6, lw: 3.5 });
      vol(g, path(P => { P.moveTo(foot[0] - 20, foot[1] + 14); P.quadraticCurveTo(foot[0] - 22, foot[1] - 6, foot[0], foot[1] - 8); P.quadraticCurveTo(foot[0] + 22, foot[1] - 6, foot[0] + 20, foot[1] + 14); P.closePath(); }), '#fbfbf8', { sh: '#c8c8c0', k: 8, lw: 3.5 }); line(g, 2.5, c => { c.moveTo(foot[0] - 19, foot[1] + 8); c.lineTo(foot[0] + 19, foot[1] + 8); }); });
    // the front wheel: fat tyre with tread, spokes catching the light; the fork
    vol(g, path(P => P.ellipse(0, -48, 15, 48, 0, 0, TAU)), '#1b1c22', { sh: '#0b0b0e', k: 6, hl: '#3b3d46', lw: 4.5 }); g.save(); g.clip(path(P => P.ellipse(0, -48, 15, 48, 0, 0, TAU))); for (let i = 0; i < 12; i++) { const y = -96 + ((i * 8 + ph * 30) % 96); line(g, 2, c => { c.moveTo(-15, y); c.lineTo(15, y + 3); }, 'rgba(90,90,100,0.6)'); } g.restore();
    line(g, 3, c => c.ellipse(0, -48, 6, 38, 0, 0, TAU), '#a9aeb7'); vol(g, path(P => P.arc(0, -48, 6, 0, TAU)), '#dfe2e8', { lw: 2.5 });
    [-1, 1].forEach(sd => vol(g, tube([[sd * 10, -134], [sd * 8, -48]], 8, 7), CH.base, Object.assign({ k: 4 }, CH, { lw: 3 })));
    // the bars: tall BMX bars with a crossbar and grips
    vol(g, tube([[-78, -172], [-30, -134], [0, -132], [30, -134], [78, -172]], 9, 9), CH.base, Object.assign({ k: 4 }, CH, { lw: 3 })); vol(g, tube([[-48, -154], [48, -154]], 7, 7), CH.base, Object.assign({ k: 3 }, CH, { lw: 2.5 }));
    // arms to the grips, fists on them
    [-1, 1].forEach(sd => { const shd = [sd * 56, -234], el = [sd * 90, -204], gp = [sd * 76, -172]; vol(g, tube([shd, el, gp], 32, 24, 30), TK.base, Object.assign({ k: 12, R: R2 }, TK)); line(g, 2.5, c => { c.moveTo(shd[0] + sd * 12, shd[1] - 4); c.lineTo(el[0] + sd * 11, el[1]); c.lineTo(gp[0] + sd * 9, gp[1] - 6); }, 'rgba(255,255,255,0.8)');
      vol(g, path(P => P.arc(gp[0], gp[1], 14, 0, TAU)), SK, { sh: SKD, k: 6, lw: 3.5 }); });
    // the heid: long face, ears sticking out, a big daft grin, cap perched on top with the skip up
    g.save(); g.translate(0, -292);
    [-1, 1].forEach(sd => vol(g, path(P => P.ellipse(sd * 32, 6, 10, 16, sd * 0.2, 0, TAU)), SK, { sh: SKD, k: 5, lw: 3.5 }));
    vol(g, path(P => { P.moveTo(-28, -18); P.bezierCurveTo(-32, 26, -16, 48, 0, 48); P.bezierCurveTo(16, 48, 32, 26, 28, -18); P.bezierCurveTo(24, -44, -24, -44, -28, -18); P.closePath(); }), SK, { sh: SKD, hl: '#ffd9c0', k: 16, R: R2, rim: 'rgba(200,220,255,0.6)' });
    [-11, 11].forEach(x => { vol(g, path(P => P.ellipse(x, -4, 8, 9, 0, 0, TAU)), '#fff', { lw: 3 }); g.fillStyle = INK; g.beginPath(); g.arc(x + (x < 0 ? 2 : -2), -2, 3, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + (x < 0 ? 3 : -1), -4, 1, 0, TAU); g.fill(); });
    line(g, 4, c => { c.moveTo(-21, -16); c.lineTo(-4, -12); c.moveTo(21, -16); c.lineTo(4, -12); });
    line(g, 3, c => { c.moveTo(0, 0); c.quadraticCurveTo(5, 11, -1, 14); });
    vol(g, path(P => { P.moveTo(-17, 22); P.quadraticCurveTo(0, 26, 17, 22); P.quadraticCurveTo(12, 40, 0, 40); P.quadraticCurveTo(-12, 40, -17, 22); P.closePath(); }), '#5b1c24', { lw: 3.5 }); g.fillStyle = '#fff'; g.fillRect(-10, 22, 8, 5); g.fillRect(3, 22, 7, 4);
    g.rotate(0.14); vol(g, path(P => { P.moveTo(-28, -26); P.bezierCurveTo(-28, -60, 28, -60, 28, -26); P.quadraticCurveTo(0, -20, -28, -26); P.closePath(); }), '#f3f2ed', { sh: '#c4c3bd', k: 10, R: R2, lw: 4 });
    vol(g, path(P => { P.moveTo(-26, -28); P.quadraticCurveTo(0, -52, 26, -28); P.quadraticCurveTo(0, -38, -26, -28); P.closePath(); }), '#e2e1db', { sh: '#b0afa9', k: 5, lw: 3.5 });
    g.restore(); g.restore(); }

  /* ---------- the splash ---------- */
  function splash(g, t0, t, x, y, s) { const k = t - t0; if (k < 0 || k > 1.2) return; const r = rng(77);
    // sheets of water thrown off the wheel: curved tongues fanning out, mostly towards him, see-through with a bright edge
    if (k < 0.45) { const f = k / 0.45, a = 1 - sm((f - 0.5) / 0.5); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
      [[-2.5, 1.0], [-2.1, 1.25], [-1.75, 0.9], [-1.25, 0.6], [-0.75, 0.45]].forEach(([an, len], i) => { const L = 330 * len * eo(f / 0.7), dx = Math.cos(an) * L, dy = Math.sin(an) * L * 0.8, sag = 1700 * k * k * 0.5, w = 26 + 30 * f;
        const P = path(Q => { Q.moveTo(-14, 0); Q.quadraticCurveTo(dx * 0.4 - w, dy * 0.7 - w, dx, dy + sag); Q.quadraticCurveTo(dx * 0.55 + w * 0.6, dy * 0.5 + w, 14, 0); Q.closePath(); });
        g.fillStyle = 'rgba(190,225,255,0.62)'; g.fill(P); g.lineWidth = 3; g.strokeStyle = 'rgba(30,60,95,0.85)'; g.stroke(P); line(g, 3, c => { c.moveTo(-6, -6); c.quadraticCurveTo(dx * 0.4 - w * 0.6, dy * 0.7 - w * 0.6, dx * 0.92, dy * 0.92 + sag); }, 'rgba(255,255,255,0.85)'); });
      g.restore(); }
    for (let i = 0; i < 70; i++) { const right = r() < 0.75, vx = (right ? -1 : 1) * (250 + r() * 900), vy = -(450 + r() * 900), sz = 6 + r() * 16, life = 0.5 + r() * 0.5, d = r() * 0.08; const kk = k - d; if (kk < 0 || kk > life) continue;
      const px = x + vx * kk * s, py = y - 20 * s + (vy * kk + 1700 * kk * kk) * s; if (py > y + 30 * s && kk > 0.15) continue; g.globalAlpha = 1 - sm((kk - life + 0.15) / 0.15); const an = Math.atan2(vy + 3400 * kk, vx), r0 = sz * s * 0.55; g.save(); g.translate(px, py); g.rotate(an); const Pd = path(Q => { Q.moveTo(-r0 * 2.6, 0); Q.quadraticCurveTo(-r0 * 0.6, -r0 * 1.05, r0, -r0 * 0.9); Q.arc(r0, 0, r0 * 0.9, -Math.PI / 2, Math.PI / 2); Q.quadraticCurveTo(-r0 * 0.6, r0 * 1.05, -r0 * 2.6, 0); Q.closePath(); }); g.fillStyle = 'rgba(205,232,255,0.9)'; g.fill(Pd); g.lineWidth = 2; g.strokeStyle = 'rgba(30,60,95,0.85)'; g.stroke(Pd); g.fillStyle = '#fff'; g.beginPath(); g.arc(r0 * 1.1, -r0 * 0.35, r0 * 0.3, 0, TAU); g.fill(); g.restore(); }
    g.globalAlpha = 1; }

  /* ---------- ink on the lens: blobs merged soft then cut sharp, then it takes the whole screen ---------- */
  let IC = null; function inkSplat(g, W, H, k, seed, cx, cy) { if (k <= 0) return; const w = Math.ceil(W / 3), h = Math.ceil(H / 3); if (!IC || IC.a.width !== w || IC.a.height !== h) IC = { a: mk(w, h), b: mk(w, h) };
    const a = IC.a.getContext('2d'), r = rng(seed), R = h * (0.3 + 0.55 * eo((k - 0.12) / 0.4)) * eo(k / 0.12); a.clearRect(0, 0, w, h); a.fillStyle = '#000'; a.beginPath(); a.ellipse(w * cx, h * cy, R * 1.45, R, 0, 0, TAU); a.fill();
    for (let i = 0; i < 48; i++) { const an = r() * TAU, L = R * (0.9 + r() * 1.3) * eo(k / (0.1 + r() * 0.14)); for (let s = 0; s < 8; s++) { const f = s / 7, d = R * 0.5 + (L - R * 0.5) * f, rad = R * (0.18 - 0.12 * f) * (0.6 + r() * 0.6); a.beginPath(); a.arc(w * cx + Math.cos(an) * d * 1.45, h * cy + Math.sin(an) * d, rad, 0, TAU); a.fill(); }
      if (r() < 0.6) { a.beginPath(); a.arc(w * cx + Math.cos(an) * (L + R * 0.3) * 1.45, h * cy + Math.sin(an) * (L + R * 0.3), R * 0.04 + r() * R * 0.05, 0, TAU); a.fill(); } }
    for (let i = 0; i < 30; i++) { const px = r() * w, l = Math.min(h, k * (0.4 + r()) * h * 0.5), ww = h * (0.01 + r() * 0.015); if (k < 0.2) continue; a.fillRect(px - ww, 0, ww * 2, h * 0.5 + l); a.beginPath(); a.arc(px, h * 0.5 + l, ww * 1.6, 0, TAU); a.fill(); }
    const b = IC.b.getContext('2d'); b.clearRect(0, 0, w, h); b.filter = `blur(${Math.max(1, h / 150)}px)`; b.drawImage(IC.a, 0, 0); b.filter = 'none'; const im = b.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = cl((d[i + 3] / 255 - 0.42) / 0.1); d[i] = 11; d[i + 1] = 10; d[i + 2] = 18; d[i + 3] = v * 255; } b.putImageData(im, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(IC.b, 0, 0, W, H); if (k > 0.5) { g.globalAlpha = sm((k - 0.5) / 0.15); g.fillStyle = 'rgb(11,10,18)'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    // wet sheen: a cold light across the top, runs of gloss sliding down
    g.globalCompositeOperation = 'source-atop'; const gl = g.createLinearGradient(0, 0, W * 0.7, H); gl.addColorStop(0, 'rgba(150,140,200,0.3)'); gl.addColorStop(0.5, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    const rr = rng(seed + 3); g.lineCap = 'round';
    g.strokeStyle = 'rgba(235,235,255,0.35)'; g.lineWidth = Math.max(2, H / 180); for (let i = 0; i < 7; i++) { const x = W * (cx + (rr() - 0.5) * 0.7), y = H * (cy + (rr() - 0.5) * 0.6); g.beginPath(); g.arc(x, y, H * (0.03 + rr() * 0.05), 3.6, 4.5); g.stroke(); } g.restore(); }

  // his logo pops up in the ink, PatterSquid under it, the episode, and a cone lands on the squid's heid in the logo
  function titleCard(g, W, H, t, name, ep, kick, line) { const k = t - B.logo; if (k <= 0) return; const u = H / 1080; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const rL = H * 0.2, cx = W / 2, cy = H * (ep ? 0.29 : 0.32), bonk = bump(t - B.bonk, 0.22), ps = eb(k / 0.32) * (1 - 0.12 * bonk);
    g.save(); g.translate(cx, cy + rL); g.scale(eb(k / 0.32) / Math.sqrt(1 - 0.12 * bonk), ps); g.translate(0, -rL); g.rotate(-0.05 * Math.sin(Math.min(k, 0.6) * 10) * Math.exp(-k * 3));
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(10 * u, 14 * u, rL * 1.06, 0, TAU); g.fill(); g.beginPath(); g.arc(0, 0, rL * 1.08, 0, TAU); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(0, 0, rL * 1.04, 0, TAU); g.fillStyle = '#f4efe2'; g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, rL * 0.97, 0, TAU); g.clip(); if (logo) g.drawImage(logo, -rL, -rL, rL * 2, rL * 2); else { g.fillStyle = '#16264a'; g.fillRect(-rL, -rL, rL * 2, rL * 2); } g.restore(); g.lineWidth = rL * 0.035; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, rL * 0.97, 0, TAU); g.stroke();
    // the cone: falls spinning out the top of the screen, bonks on his heid, hops, settles squint
    if (t > B.cone) { const hy = -rL * 0.72, ch = rL * 0.62; let x, y, rot, sq = 1; if (t < B.bonk) { const f = (t - B.cone) / (B.bonk - B.cone); x = lerp(rL * 0.5, 0, f); y = lerp(-H * 0.5 - ch, hy, ei(f)); rot = lerp(-4.4, -0.3, eo(f)); }
      else { const kk = t - B.bonk, hop = kk < 0.3 ? Math.sin(Math.PI * kk / 0.3) * rL * 0.18 : 0; x = rL * 0.03; y = hy - hop; rot = -0.3 + (kk < 0.3 ? -0.35 * Math.sin(Math.PI * kk / 0.3) : 0.12 * Math.exp(-(kk - 0.3) * 6) * Math.sin((kk - 0.3) * 30)); sq = 1 - 0.18 * bump(kk, 0.1); }
      cone(g, x, y, ch, rot, sq); }
    g.restore();
    // the name
    const nk = t - B.name; if (nk > 0) { const s = nk < 0.14 ? lerp(1.6, 0.94, ei(nk / 0.14)) : 1 - 0.06 * Math.exp(-(nk - 0.14) * 10) * Math.cos((nk - 0.14) * 34); let fs = 150 * u; g.font = `400 ${fs}px ${TITLE}`; while (g.measureText(name).width > W * 0.82) { fs -= 4; g.font = `400 ${fs}px ${TITLE}`; }
      g.save(); g.translate(cx, H * (ep ? 0.66 : 0.72)); g.rotate(-0.03); g.scale(s, s); g.globalAlpha = cl(nk / 0.05); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(name, 8 * u, 12 * u); g.lineWidth = fs * 0.14; g.strokeStyle = '#08070c'; g.strokeText(name, 0, 0); g.fillStyle = '#f7f1e3'; g.fillText(name, 0, 0); g.restore(); }
    const ek = t - B.ep; if (ep && ek > 0) { let es = 68 * u; g.font = `400 ${es}px ${TALL}`; while (g.measureText(ep).width > W * 0.72) { es -= 2; g.font = `400 ${es}px ${TALL}`; }
      g.save(); g.translate(cx, H * 0.84); g.rotate(-0.02); g.scale(eb(ek / 0.22), eb(ek / 0.22)); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      if (kick) { g.font = `400 ${es * 0.42}px ${TALL}`; g.fillStyle = '#ffd23b'; g.fillText(kick.toUpperCase(), 0, -es * 0.92); g.font = `400 ${es}px ${TALL}`; }
      g.lineWidth = es * 0.16; g.strokeStyle = '#08070c'; g.strokeText(ep, 0, 0); g.fillStyle = '#ffd23b'; g.fillText(ep, 0, 0); g.restore(); }
    const lk = t - (ep ? B.ep + 0.3 : B.name + 0.35); if (line && lk > 0) { let ls = 38 * u; g.font = `700 ${ls}px ${BODY}`; while (g.measureText(line).width > W * 0.6) { ls -= 2; g.font = `700 ${ls}px ${BODY}`; } g.globalAlpha = cl(lk / 0.3); g.textAlign = 'center'; g.fillStyle = '#e9e2d2'; g.fillText(line, cx, H * (ep ? 0.94 : 0.86)); }
    g.restore(); }

  /* ---------- "Chucked oot" ---------- */
  // beats (seconds). Every moving value is a smooth curve through these, so nothing pops between frames.
  const B = { open: 0.3, push: 0.4, shove: 1.45, cock: 1.6, kick: 1.82 }; B.fly = B.kick + 0.1;
  const FT = 0.52, GRAV = 2400, ROAD = 846, IMP = 640, TS = 0.72, NED_DUR = 1.25, PUD = { x: 1010, y: 800 }, XN = 994;
  const axis = r => [Math.sin(r), -Math.cos(r)];
  // the shove: his feet slide out the door while he digs in, leaning back against the hands
  const pushFeet = t => { const f = cl((t - B.push) / (B.shove - B.push)); return 300 + 132 * sm(f) - 6 * Math.sin(f * 22) * f * (1 - f) * 4; };
  const pushRot = t => key(t, [[0, -0.05], [B.push, -0.2], [B.shove, -0.24], [B.shove + 0.18, 0.06], [B.cock, -0.06], [B.kick, -0.08]]) + 0.04 * Math.sin(t * 9) * key(t, [[B.push, 0], [B.push + 0.1, 1], [B.shove, 1], [B.shove + 0.1, 0]]);
  const KH = 265, headAt = (fx, fy, r, h) => { const u = axis(r); return [fx + 0.97 * h * u[0], fy + 0.97 * h * u[1]]; };
  const H0 = headAt(pushFeet(B.kick) + 6, 772, pushRot(B.kick), KH), VX = (IMP - H0[0]) / FT, VY = (ROAD - H0[1] - 0.5 * GRAV * FT * FT) / FT;
  B.land = B.fly + FT; B.stop = B.land + TS; const STOP = IMP + VX * TS / 2, HOME = { x: STOP - 10, y: ROAD };
  B.flop = B.stop + 0.34; B.peel = B.stop + 0.7; B.up = B.peel + 0.5; B.finger = B.up + 0.25; B.ned = B.finger + 0.1;
  B.splash = B.ned + NED_DUR * (8 - 236 / (800 - 610)) / 7.55; B.fingerOff = B.splash + 0.45; B.glare = B.splash + 0.8; B.lift = B.glare + 0.45; B.glug = B.lift + 0.3; B.down = B.glug + 0.9; B.ahh = B.down + 0.1;
  B.green = B.ahh + 0.15; B.hurk1 = B.green + 0.4; B.hurk2 = B.hurk1 + 0.35; B.spew = B.hurk2 + 0.45; B.splat = B.spew + 0.2; B.logo = B.splat + 0.25; B.name = B.logo + 0.25; B.ep = B.name + 0.35; B.cone = B.ep + 0.05; B.bonk = B.cone + 0.3; B.end = B.bonk + 1.4;
  // the flight is real: thrown from the boot, falling under gravity, his body turning to dive along the way he is going
  const flightHead = tau => [H0[0] + VX * tau, H0[1] + VY * tau + 0.5 * GRAV * tau * tau], flightAng = tau => Math.atan2(VY + GRAV * tau, VX);
  const rotLand = flightAng(FT) + Math.PI / 2, ROT_SLIDE = 1.86;
  const scrapeX = t => { const k = cl(t - B.land, 0, TS); return IMP + VX * k - 0.5 * (VX / TS) * k * k; };
  const scrapeRot = k => ROT_SLIDE + (rotLand - ROT_SLIDE) * Math.exp(-k * 9) * (1 + 9 * k);
  const spring = (k, w, z) => Math.exp(-z * w * k) * Math.sin(w * Math.sqrt(1 - z * z) * k);
  // where he is: head (his anchor while he flies and slides) or feet, turn, size, and the squash and stretch on him
  function where(t) { let h = 300, rot = 0, ss = null, x, y, hd = null;
    if (t < B.fly) { h = KH; rot = pushRot(t); x = pushFeet(t); y = 772; if (t > B.kick) { const k = t - B.kick; x += 6 * sm(k / 0.1); ss = { ang: 0, s: 1 - 0.3 * Math.sin(Math.PI * cl(k / 0.1)), px: x + 0.3 * h, py: y - 0.5 * h }; } else if (t > B.shove) x += 6 * sm((t - B.kick + 0.1) / 0.1); }
    else if (t < B.land) { const tau = t - B.fly; h = lerp(KH, 300, sm(tau / FT)); hd = flightHead(tau); rot = lerp(pushRot(B.kick), flightAng(tau) + Math.PI / 2, sm(tau / 0.24)); const sp = Math.hypot(VX, VY + GRAV * tau);
      ss = { ang: rot - Math.PI / 2, s: 1 + 0.26 * sm(tau / 0.1) * cl(sp / 1500), px: hd[0], py: hd[1] }; }
    else if (t < B.stop) { const k = t - B.land, sp0 = Math.hypot(VX, VY + GRAV * FT), sEnd = 1 + 0.26 * cl(sp0 / 1500); hd = [scrapeX(t), ROAD]; rot = scrapeRot(k) + 0.03 * Math.sin(k * 55) * Math.exp(-k * 4);
      ss = { ang: rot - Math.PI / 2, s: (1 + (sEnd - 1) * Math.exp(-k * 30)) * (1 - 0.82 * spring(k, 30, 0.38)) * (1 + 0.05 * (1 - k / TS)), px: hd[0], py: hd[1] }; }
    else if (t < B.peel) { const k = t - B.stop, r0 = scrapeRot(TS); hd = [STOP, ROAD];
      // follow through: his legs carry on, swing up over him, then he slaps down flat
      rot = k < 0.34 ? r0 + 0.62 * Math.sin(Math.PI * k / 0.34) * (1 - 0.3 * k / 0.34) : lerp(r0, 1.6, ei(cl((k - 0.34) / 0.14)));
      const kk = k - 0.48; ss = kk > 0 ? { ang: rot, s: 1 - 0.6 * spring(kk, 32, 0.4), px: STOP - 0.47 * 300 * Math.sin(rot), py: ROAD } : null; }
    else if (t < B.up) { const f = (t - B.peel) / (B.up - B.peel), lieHd = [STOP, ROAD];
      if (f < 0.3) { const a = sm(f / 0.3); rot = 1.6 + 0.06 * a; hd = lieHd; ss = { ang: rot, s: 1 - 0.2 * a, px: STOP - 0.47 * 300 * Math.sin(rot), py: ROAD }; }
      else { const a = (f - 0.3) / 0.7, e = eb(a), lieC = [STOP - 0.47 * 300 * Math.sin(1.66), ROAD + 0.47 * 300 * Math.cos(1.66)], stand = [HOME.x, ROAD - 150]; rot = 1.66 * (1 - e);
        const c = [lerp(lieC[0], stand[0], sm(a)), lerp(lieC[1], stand[1], sm(a)) - Math.sin(Math.PI * a) * 70], u = axis(rot); x = c[0] - 0.5 * 300 * u[0]; y = c[1] - 0.5 * 300 * u[1];
        ss = { ang: -Math.PI / 2, s: 1 + 0.26 * Math.sin(Math.PI * Math.min(1, a * 1.2)) - 0.2 * (1 - sm(a / 0.15)), px: c[0], py: c[1] }; } }
    else { const k = t - B.up; x = HOME.x; y = ROAD; rot = 0; if (t > B.fingerOff) { const w = t - B.fingerOff; x += 12 * Math.sin(w * 2.1) * sm(w / 0.5); }
      let s = 1 - 0.3 * spring(k, 22, 0.35) * 1.3; const k2 = t - B.splash - 0.06; if (k2 > 0) s *= 1 - 0.24 * bump(k2, 0.22) + 0.06 * bump(k2 - 0.2, 0.2);
      if (t > B.glug && t < B.down) s *= 1 + 0.05 * Math.sin((t - B.glug) / (B.down - B.glug) * Math.PI); ss = { ang: -Math.PI / 2, s, px: x, py: ROAD }; }
    if (hd) { const u = axis(rot); x = hd[0] - 0.97 * h * u[0]; y = hd[1] - 0.97 * h * u[1]; }
    const u = axis(rot), cx = x + 0.5 * h * u[0], cy = y + 0.5 * h * u[1];
    const cam = { x: key(t, [[0, 540], [B.shove, 560], [B.kick, 590], [B.land, 690], [B.stop, 760], [B.up, 780], [B.ned + 0.2, 830], [B.splash, 840], [B.glare, 800], [B.spew, 800]]), y: key(t, [[0, 640], [B.kick, 640], [B.land, 650], [B.ned + 0.2, 650], [B.glare, 690], [B.spew, 700]]),
      z: key(t, [[0, 1.6], [B.shove, 1.66], [B.kick, 1.62], [B.land, 1.5], [B.stop, 1.55], [B.up, 1.5], [B.ned + 0.2, 1.45], [B.splash, 1.5], [B.glare, 1.95], [B.lift, 2.0], [B.green, 2.15], [B.spew - 0.2, 2.3], [B.spew, 2.7]]) };
    const sh = bump(t - B.kick, 0.12) * 5 + bump(t - B.land, 0.22) * 12 + bump(t - B.flop - 0.14, 0.15) * 5 + bump(t - B.splash, 0.3) * 10 + (t > B.spew ? bump(t - B.spew, 0.3) * 12 : 0); cam.x += Math.sin(t * 90) * sh; cam.y += Math.cos(t * 77) * sh;
    return { x, y, h, cam, cx, cy, rot, ss, hd }; }
  function pose(t) { const W0 = where(t), p = { t, rot: W0.rot, waveF: 7, amb: [0.88, 0.84, 0.92], rim: [1, 0.66, 0.32], rimDir: [-1, -0.6], rimAmt: 1.0 };
    const L = B.land, S = B.stop;
    p.eye = key(t, [[0, 1.05], [B.shove, 1.05], [B.shove + 0.12, 1.15], [B.kick, 1.0], [B.kick + 0.05, 1.6], [L - 0.05, 1.4], [L + 0.05, 0.85], [S, 0.85], [S + 0.3, 1.15], [B.up, 1.1], [B.up + 0.3, 1]]);
    p.lidL = p.lidR = key(t, [[0, 0.3], [B.push, 0.42], [B.shove, 0.42], [B.shove + 0.15, 0.55], [B.kick, 0.5], [B.kick + 0.04, 0], [L - 0.03, 0], [L + 0.05, 0.92], [S + 0.25, 0.92], [S + 0.5, 0.6], [B.up, 0.35], [B.up + 0.25, 0.44]]);
    p.lidTilt = key(t, [[0, 0.3], [B.shove, 0.38], [B.shove + 0.15, 0.08], [B.kick, 0.08], [B.kick + 0.04, 0], [L, 0], [L + 0.05, 0.25], [S + 0.3, 0.2], [B.up, 0.2], [B.up + 0.25, 0.36]]);
    p.splay = key(t, [[0, 0], [B.push, 0.12], [B.shove, 0.12], [B.kick, 0], [B.fly + 0.1, 0.72], [L, 0.8], [L + 0.15, 0.1], [S, 0.1], [S + 0.22, 0.55], [B.flop + 0.1, 0], [B.up, 0]]);
    p.wave = key(t, [[0, 0.5], [B.push, 1.5], [B.shove, 1.5], [B.shove + 0.2, 0.6], [B.fly, 1.6], [L, 1.6], [L + 0.1, 0.25], [S, 0.25], [S + 0.3, 1.0], [B.up, 0.5]]);
    p.lean = key(t, [[0, 0], [B.push, -0.14], [B.shove, -0.14], [B.shove + 0.2, 0.06], [B.cock, -0.04], [B.kick, -0.04], [B.kick + 0.06, 0.2], [B.fly + 0.2, 0], [B.up, 0.05], [B.finger - 0.05, -0.14], [B.fingerOff, -0.17], [B.fingerOff + 0.3, 0.02]]);
    // arms: a slow base pose with flailing on top (one steady rhythm, so they never jump)
    const fl = key(t, [[0, 0.1], [B.push, 0.4], [B.shove, 0.4], [B.kick, 0.1], [B.fly, 0.7], [L, 0.7], [L + 0.1, 0.05], [S, 0.05], [S + 0.3, 0.2], [B.up, 0.05], [B.up + 0.3, 0]]);
    p.armA = key(t, [[0, 0.8], [B.kick, 0.8], [B.fly + 0.15, -0.2], [L, -0.6], [L + 0.12, -2.2], [S + 0.3, -2.2], [S + 0.6, 0.6], [B.up, 0.9], [B.lift, 0.95], [B.glug, -1.72], [B.down, -1.8], [B.ahh + 0.1, 0.8]]) + fl * Math.sin(t * 8);
    p.armCurl = key(t, [[0, 1.0], [L, 0.6], [L + 0.12, 0.3], [S + 0.5, 1.0], [B.lift, 1.0], [B.glug, -0.35], [B.down, -0.3], [B.ahh + 0.1, 1.0]]); p.armLen = key(t, [[0, 112], [B.lift, 112], [B.glug, 78], [B.down, 78], [B.ahh + 0.1, 112]]);
    p.armLA = key(t, [[0, 0.42], [B.push, -0.2], [B.shove, -0.2], [B.shove + 0.2, 0.42], [B.fly, -0.4], [L, -0.6], [L + 0.12, 0.9], [S + 0.4, 0.5], [B.up, 0.42]]) + fl * Math.sin(t * 7 + 1.3); p.armLCurl = key(t, [[0, 1.1], [B.push, 0.5], [B.shove, 0.5], [B.shove + 0.2, 1.1], [B.fly, 0.4], [L, 0.4], [L + 0.12, 1.1]]);
    p.sq = 1 + 0.03 * Math.sin(t * 12) * key(t, [[B.push, 0], [B.push + 0.1, 1], [B.shove, 1], [B.shove + 0.1, 0]]);
    if (t < B.up) return p;
    // up and raging: the glare at the pub, then the finger
    const fk = sm((t - B.finger) / 0.18) * (1 - sm((t - B.fingerOff) / 0.4)); p.armLA = lerp(p.armLA, -1.3 + 0.07 * Math.sin(t * 32), fk); p.armLCurl = lerp(p.armLCurl, 0.1, fk); p.armLLen = lerp(112, 126, fk); p.finger = fk;
    if (t > B.fingerOff) { const w = t - B.fingerOff; p.lean += 0.05 * Math.sin(w * 3.3); }
    // soaked: frozen mid gesture, then the slow turn to us, dripping
    if (t > B.splash) { const sk = t - B.splash; p.wet = sm((sk - 0.06) / 0.12); p.eye = 1 + 0.45 * bump(sk - 0.05, 0.4); p.droop = 0.5 * sm((sk - 0.1) / 0.3); p.wave = lerp(p.wave, 0.2, sm(sk / 0.3)); p.lidL = p.lidR = lerp(0, 0.5, sm((sk - 0.35) / 0.3)); p.lidTilt = lerp(0, 0.42, sm((sk - 0.35) / 0.3)); if (t > B.glare + 0.25 && t < B.glare + 0.33) p.lidL = 0.65; }
    // the swally, green, the heaves, the spew
    if (t > B.lift) p.lean = key(t, [[B.lift, p.lean], [B.glug, -0.16], [B.down - 0.1, -0.22], [B.ahh, -0.05], [B.green, 0]]);
    if (t > B.glug - 0.1 && t < B.ahh + 0.3) { p.lidL = p.lidR = 0.92; p.lidTilt = 0; }
    if (t > B.green) { const gk = sm((t - B.green) / 0.5); p.amb = [lerp(0.88, 0.72, gk), lerp(0.84, 0.95, gk), lerp(0.92, 0.66, gk)]; p.lidL = lerp(0.5, 0.25, gk); p.lidR = lerp(0.5, 0.35, gk); p.lidTilt = 0.1; }
    const h1 = bump(t - B.hurk1, 0.28), h2 = bump(t - B.hurk2, 0.3); p.sq -= 0.16 * (h1 + h2); p.eye += 0.3 * (h1 + h2); if (t > B.hurk1 - 0.1) { p.lidL = p.lidR = 0.1 + 0.3 * (1 - h1 - h2); p.lean = 0.12 * (h1 + h2) + 0.05 * Math.sin(t * 7); }
    if (t > B.spew - 0.18) { const sk = t - (B.spew - 0.18); p.sq = sk < 0.18 ? lerp(0.8, 0.62, ei(sk / 0.18)) : 1.35 - 0.15 * eo((sk - 0.18) / 0.2); p.splay = sk > 0.18 ? 0.9 : 0; p.eye = sk > 0.18 ? 1.45 : 1.2; p.lidL = p.lidR = 0; p.lidTilt = 0; p.lean = sk < 0.18 ? -0.18 : 0.12; }
    return p; }
  // the ned: far up the road to past the camera; s his size (1 = level with the squid)
  function nedAt(t) { const u = (t - B.ned) / NED_DUR; if (u <= 0 || u >= 1) return null; const z = 8 - 7.55 * u, s = 1 / z; return { x: 1060 + (XN - 1060) * s + Math.max(0, s - 0.8) * 420, y: 610 + 236 * s, s, z }; }
  // the bouncer, unseen in the doorway behind him: dark shapes against the light, a warm edge on them. His hands at
  // the squid's back for the shove, then his leg comes straight out, boots him, follows through and slides back in.
  const SIL = '#0d0c11', EDGE = 'rgba(255,175,95,0.75)';
  function sil(g, P) { g.fillStyle = SIL; g.fill(P); g.save(); g.clip(P); g.fillStyle = EDGE; g.fill(sh2(P, 2.5, 3), 'evenodd'); g.restore(); }
  function bouncer(g, t, Wh) {
    // one straight leg swings out of the doorway from the hip, like a pendulum, boots him, follows through, swings back in
    const L = 0.22, A0 = Math.PI / 2, AK = 0.16, AF = -0.18;
    const an = t < B.kick - L ? A0 : t < B.kick ? lerp(A0, AK, 0.5 - 0.5 * Math.cos(Math.PI * (t - B.kick + L) / L * 0.999) * 1) : t < B.kick + 0.12 ? lerp(AK, AF, eo((t - B.kick) / 0.12)) : t < B.kick + 0.26 ? AF : lerp(AF, A0, sm((t - B.kick - 0.26) / 0.45));
    if (an >= A0 - 0.01) return; const hip = [250, 604], LEN = 100, ank = [hip[0] + Math.cos(an) * LEN, hip[1] + Math.sin(an) * LEN];
    g.save(); g.beginPath(); g.rect(262, 0, PW, PH); g.clip();
    vol(g, tube([[hip[0] - Math.cos(an) * 30, hip[1] - Math.sin(an) * 30], ank], 44, 38), '#23252d', { sh: '#121318', hl: '#363a45', rim: 'rgba(255,170,90,0.8)', k: 12 });
    g.translate(ank[0], ank[1]); g.rotate(an); g.scale(1.25, 1.25); vol(g, path(P => { P.moveTo(-10, -18); P.lineTo(18, -20); P.quadraticCurveTo(50, -18, 54, 2); P.quadraticCurveTo(54, 11, 42, 11); P.lineTo(-12, 11); P.closePath(); }), '#17171c', { sh: '#08080b', hl: '#3a3b44', k: 8 });
    line(g, 3, c => { c.moveTo(-12, 6); c.lineTo(52, 6); }); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(34, -11, 9, 3, -0.2, 0, TAU); g.fill(); g.restore(); }
  // skid: a grubby streak where his face went along the road, scuffs and dust
  function skid(g, t) { if (t < B.land) return; const k = t - B.land, hx = scrapeX(t);
    g.save(); g.fillStyle = 'rgba(16,12,22,0.5)'; g.beginPath(); g.moveTo(IMP - 10, ROAD); g.quadraticCurveTo((IMP + hx) / 2, ROAD - 12, hx, ROAD - 5); g.lineTo(hx, ROAD + 7); g.quadraticCurveTo((IMP + hx) / 2, ROAD + 10, IMP - 10, ROAD + 3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(16,12,22,0.4)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = ROAD - 8 + i * 3.5; g.beginPath(); g.moveTo(IMP + 10 + i * 9, y); g.lineTo(Math.max(IMP + 10 + i * 9, hx - 10 - i * 6), y + 1); g.stroke(); } g.restore();
    const puff = (x, y, rr, a) => { if (a <= 0) return; const dg = g.createRadialGradient(x, y, 0, x, y, rr); dg.addColorStop(0, `rgba(150,138,128,${0.65 * a})`); dg.addColorStop(0.6, `rgba(120,110,104,${0.4 * a})`); dg.addColorStop(1, 'rgba(120,110,104,0)'); g.fillStyle = dg; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); };
    const r = rng(41); for (let i = 0; i < 18; i++) { const te = B.land + r() * TS * 0.9, dk = t - te, a = r(), b2 = r(), c2 = r(); if (dk < 0 || dk > 0.8) continue; const x0 = scrapeX(te); puff(x0 - 20 - 50 * dk * a, ROAD - 8 - 60 * eo(dk / 0.5) * b2, (18 + 30 * c2) * (0.6 + dk * 1.4), (1 - dk / 0.8) * cl(dk / 0.05)); }
    [[B.land, IMP, 1.4], [B.flop + 0.14, STOP - 140, 0.8]].forEach(([t0, x0, m]) => { const dk = t - t0; if (dk < 0 || dk > 0.7) return; const rr = rng(53 + (m * 10 | 0)); for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, a = rr(), b2 = rr(), c2 = rr(); puff(x0 + sd * (20 + 150 * eo(dk / 0.5) * (0.3 + a * 0.7)) * m, ROAD - 10 - 50 * eo(dk / 0.4) * b2 * m, (16 + 26 * c2) * m * (0.6 + dk), (1 - dk / 0.7) * cl(dk / 0.04)); } }); }

  function useLabel(src) { if (!src || typeof src !== 'string') return null; if (LBL.src !== src) { LBL = { src, img: null }; BOT = null; bmp(src).then(b => { if (LBL.src === src) { LBL.img = b; BOT = null; } }).catch(() => {}); } return LBL.img; }
  function swally(g, t, W, H, o = {}) { if (!plate) return false; const name = o.name || 'PatterSquid', P = pose(t), Wh = where(t), h = Wh.h; useLabel(o.label);
    let mouthS = null;
    if (t < B.splat + 0.6) {
    g.save(); const k = camTo(g, W, H, Wh.cam); g.drawImage(soft || plate, 0, 0, PW, PH);
    g.save(); g.globalCompositeOperation = 'screen'; [[757, 178, 150], [1142, 352, 90], [1043, 458, 55]].forEach(([x, y, r], i) => glow(g, x, y, r, 'rgba(255,170,80,A)', 0.3 + 0.05 * Math.sin(t * 7 + i * 2))); glow(g, 1060, 112, 130, 'rgba(190,210,255,A)', 0.2); g.restore();
    // the pub: the door opens, he is shoved out, the boot, then the door slams
    const open = t < B.open ? 0 : t < B.stop ? sm((t - B.open) / 0.12) : 1 - sm((t - B.stop) / 0.07); pub(g, t, open, 0);
    skid(g, t);
    const N = nedAt(t), drawNed = () => { if (!N) return; g.save(); g.translate(N.x, N.y); g.scale(N.s, N.s); ned(g, { ph: t * 13, sway: 0.06 * Math.sin(t * 6.5) }); g.restore(); };
    if (N && N.s < 1) drawNed();
    // his shadow, a puddle under him once soaked
    g.save(); g.fillStyle = 'rgba(6,4,12,0.6)'; const gy = t < B.fly ? 772 : ROAD, air = Math.max(0, gy - 0.5 * h - Wh.cy - 25); g.beginPath(); g.ellipse(Wh.cx + 10, gy + 4, h * 0.38 * (1 - 0.6 * cl(air / 220)), h * 0.06, 0, 0, TAU); g.fill();
    if (t > B.splash) { const pk = sm((t - B.splash - 0.1) / 1.2); g.fillStyle = 'rgba(110,150,190,0.5)'; g.beginPath(); g.ellipse(Wh.x + 6, ROAD + 2, h * 0.42 * pk + 0.1, h * 0.035 * pk + 0.1, 0, 0, TAU); g.fill(); } g.restore();
    P.postArm = (gg) => { const hd = Squid.hand(P); gg.save(); gg.translate(hd.x, hd.y); const ba = key(t, [[0, 0.1], [B.lift, 0.1], [B.glug, -2.25], [B.down - 0.15, -2.45], [B.ahh + 0.1, 0.15]]) + key(t, [[B.push, 0], [B.push + 0.2, 0.4], [L0(), 0.4], [L0() + 0.1, 0]]) * Math.sin(t * 8); gg.rotate(ba); gg.drawImage(bottle(), -26, -96, 52, 144); gg.restore(); };
    P.postArmL = (gg) => { if (!(P.finger > 0.3)) return; const hd = Squid.hand(P, -1); gg.save(); gg.translate(hd.tip[0], hd.tip[1]); gg.rotate(Math.atan2(hd.tip[1] - hd.y, hd.tip[0] - hd.x) + Math.PI / 2); const sc = 1.35 * sm((P.finger - 0.3) / 0.3); gg.scale(sc, sc);
      flat(gg, Q => Q.roundRect(-13, -10, 26, 24, 8), '#ece6db', '#bfb6a8', 3, 3); flat(gg, Q => Q.roundRect(-4.5, -40, 9, 34, 4.5), '#ece6db', '#bfb6a8', 2, 3); OL(gg, 2); gg.beginPath(); gg.moveTo(-6, -8); gg.lineTo(-6, 0); gg.moveTo(6, -8); gg.lineTo(6, 0); gg.stroke(); gg.restore(); };
    bouncer(g, t, Wh);
    if (t > B.push - 0.05 && t < B.splat + 0.1) { g.save();
      if (Wh.ss && Math.abs(Wh.ss.s - 1) > 0.002) { const { ang, s, px, py } = Wh.ss; g.translate(px, py); g.rotate(ang); g.scale(s, Math.pow(s, -0.7)); g.rotate(-ang); g.translate(-px, -py); }
      squidComic(g, Wh.x, Wh.y, h, P, k);
      const top = Squid.point([151, 40], Wh.x, Wh.y, h, P), ha = Squid.headAngle(P), cw = h * 0.5;
      if (t > B.up - 0.05 && t < B.spew) { [[110, 178], [192, 178]].forEach(pt => { const c = Squid.point(pt, Wh.x, Wh.y, h, P); g.save(); g.globalAlpha = 0.3 * (1 - (P.wet || 0) * 0.5); g.fillStyle = '#ff5a6e'; g.beginPath(); g.ellipse(c[0], c[1], h * 0.06, h * 0.03, 0, 0, TAU); g.fill(); g.restore(); }); }
      if (!(t > B.land && t < B.up + 0.05)) cap(g, top[0], top[1], cw, ha - 0.22 + 0.25 * bump(t - B.up - 0.05, 0.25) + 0.3 * bump(t - B.splash, 0.3), P.wet);
      if (P.wet > 0 && t < B.spew) { const r = rng(9); for (let i = 0; i < 14; i++) { const x0 = (r() - 0.5) * h * 0.7, y0 = -h * (0.1 + r() * 0.5), per = 0.4 + r() * 0.5, ph = ((t - B.splash) / per + r()) % 1; g.globalAlpha = 1 - ph; flat(g, Q => Q.ellipse(Wh.x + x0, Wh.y + y0 + ph * h * 0.6, 4, 6, 0, 0, TAU), '#cfe8ff', null, 0, 1.5); } g.globalAlpha = 1; }
      if (t > B.spew) { const m = Squid.point('mouth', Wh.x, Wh.y, h, P), M = g.getTransform(); mouthS = [M.a * m[0] + M.c * m[1] + M.e, M.b * m[0] + M.d * m[1] + M.f]; }
      g.restore();
      // the cap knocked off when his face hits the road, spinning up and landing back on his heid as he gets up
      if (t > B.land && t < B.up + 0.05) { const capAt = tt => { const W2 = where(tt), P2 = pose(tt), q = Squid.point([151, 40], W2.x, W2.y, W2.h, P2); return [q[0], q[1], Squid.headAngle(P2) - 0.22]; };
        const a0 = capAt(B.land - 0.001); a0[1] = Math.min(a0[1], ROAD - 45); const a1 = capAt(B.up + 0.05), f = (t - B.land) / (B.up + 0.05 - B.land), fe = sm(f); cap(g, lerp(a0[0], a1[0], fe), lerp(a0[1], a1[1], f) - Math.sin(Math.PI * f) * 360, cw, a1[2] + (1 - fe) * 2 * TAU + (1 - fe) * (a0[2] - a1[2]), false); } }
    if (N && N.s >= 1) drawNed();
    splash(g, B.splash, t, PUD.x, PUD.y, 0.8);
    g.restore();
    // vignette, grain
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,0.5)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    const rr = rng(1 + Math.floor(t * 24)); g.globalAlpha = 0.035; for (let i = 0; i < 500; i++) { g.fillStyle = rr() < 0.5 ? '#000' : '#fff'; g.fillRect(rr() * W, rr() * H, 2, 2); } g.restore();
    // the spew: a jet of ink blobs out of his gub at the lens
    if (mouthS && t < B.splat + 0.12) { const r = rng(5), sk = t - B.spew; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0a12'; g.strokeStyle = 'rgba(160,150,200,0.35)'; g.lineWidth = Math.max(1, H / 400);
      for (let i = 0; i < 50; i++) { const t0 = r() * 0.16, life = 0.16 + r() * 0.1, f = (sk - t0) / life, tx = W * (0.5 + (r() - 0.5) * 0.95), ty = H * (0.5 + (r() - 0.5) * 0.85), rad = H * (0.006 + 0.004 * r()) * Math.pow(32, cl(f)); if (f <= 0 || f > 1.2) continue;
        const ff = eo(cl(f)), x = lerp(mouthS[0], tx, ff), y = lerp(mouthS[1], ty, ff) - Math.sin(Math.PI * cl(f)) * H * 0.05; g.beginPath(); g.ellipse(x, y, rad * 1.1, rad, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.5, 3.6, 4.6); g.stroke(); } g.restore(); }
    }
    // SPLAT: the ink takes the whole screen, then the logo, the name, the episode and the cone
    if (t > B.splat) { const sk = t - B.splat; inkSplat(g, W, H, sk + 0.04, 8, 0.5, 0.5); titleCard(g, W, H, t, name, o.episode, o.kicker, o.line); }
    if (t < 0.25) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`; g.fillRect(0, 0, W, H); g.restore(); }
    return true; }
  const L0 = () => B.land;
  return { ready, swally, B, PW, PH, TITLE, useLabel };
})();

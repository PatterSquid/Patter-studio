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
  let BOT = null; function bottle() { if (BOT) return BOT; const c = mk(130, 360), g = c.getContext('2d'), cx = 65;
    const body = P => { P.moveTo(cx - 13, 36); P.lineTo(cx + 13, 36); P.lineTo(cx + 13, 92); P.bezierCurveTo(cx + 15, 128, cx + 44, 132, cx + 44, 170); P.lineTo(cx + 44, 334); P.quadraticCurveTo(cx + 44, 350, cx + 28, 350); P.lineTo(cx - 28, 350); P.quadraticCurveTo(cx - 44, 350, cx - 44, 334); P.lineTo(cx - 44, 170); P.bezierCurveTo(cx - 44, 132, cx - 15, 128, cx - 13, 92); P.closePath(); };
    const Pb = flat(g, body, '#2a1712', '#140a08', 12, 0);
    g.save(); g.clip(Pb); g.fillStyle = 'rgba(160,230,150,0.35)'; g.fillRect(cx - 34, 150, 9, 190); g.fillRect(cx - 7, 40, 5, 70); g.fillStyle = '#efe3c4'; g.fillRect(cx - 44, 200, 88, 108); g.fillStyle = '#c4202a'; g.fillRect(cx - 44, 200, 88, 24); g.fillRect(cx - 44, 296, 88, 12);
    g.fillStyle = '#1a1410'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 17px ${TITLE}`; g.fillText('Auld', cx, 244); g.fillText('Patter', cx, 263); g.fillStyle = '#c4202a'; g.font = `700 10px ${BODY}`; g.fillText('TONIC WINE', cx, 283); g.fillStyle = '#fff4d8'; g.font = `700 9px ${BODY}`; g.fillText('EST. 1983', cx, 212); g.restore();
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

  /* ---------- the bouncers: big black jackets, no necks, earpieces ---------- */
  // o = { pose: 'fold' | 'throw' | 'point', k: 0..1 into the pose, talk 0..1, laugh 0..1, beard, skin }
  function bouncer(g, o) { const t = o.t, lg = o.laugh || 0, bob = lg * 5 * Math.abs(Math.sin(t * 17)); g.save(); g.translate(0, -bob);
    const J = '#1d1e25', JD = '#0f1015';
    // legs and shoes
    [[-42, -1], [42, 1]].forEach(([x, sd]) => { flat(g, P => P.roundRect(x - 26, -175, 52, 168, 10), '#25262e', '#15161b', 6, 5); flat(g, P => P.ellipse(x + sd * 8, -6, 36, 15, 0, 0, TAU), '#0d0d10', null, 0, 5); });
    // the jacket: a fridge with shoulders
    const body = P => { P.moveTo(-74, -160); P.bezierCurveTo(-84, -220, -112, -280, -96, -318); P.quadraticCurveTo(-60, -346, 0, -344); P.quadraticCurveTo(60, -346, 96, -318); P.bezierCurveTo(112, -280, 84, -220, 74, -160); P.quadraticCurveTo(0, -150, -74, -160); P.closePath(); };
    flat(g, body, J, JD, 14, 5); flat(g, P => { P.moveTo(-26, -334); P.lineTo(26, -334); P.lineTo(0, -262); P.closePath(); }, '#f2f2ee', '#c8c8c2', 4, 4); limb(g, [[0, -318], [0, -268]], 7, '#151515', '#000');
    const arm = (sd, to, el) => { const sh = [sd * 90, -300]; const e = el || ik(sh, to, 82, 82, sd > 0 ? 1 : -1); limb(g, [sh, e, to], 46, J, JD); if (sd < 0) { g.save(); g.translate(...sh.map((v, i) => lerp(v, e[i], 0.45))); flat(g, P => P.rect(-25, -11, 50, 22), '#ffd23b', '#c9a020', 3, 3); g.restore(); } flat(g, P => P.arc(to[0], to[1], 22, 0, TAU), o.skin, shade(o.skin, 0.78), 4, 4); };
    const k = sm(o.k);
    if (o.pose === 'throw') { arm(-1, [lerp(-60, 80, k), lerp(-210, -270, k)]); arm(1, [lerp(60, 200, k), lerp(-210, -280, k)]); }
    else if (o.pose === 'point') { flat(g, P => P.roundRect(-100, -245, 150, 50, 22), J, JD, 6, 5); arm(1, [lerp(40, 230, k), lerp(-225, -300, k)]); if (k > 0.5) { g.save(); g.translate(lerp(40, 230, k), lerp(-225, -300, k)); g.rotate(-0.4); flat(g, P => P.roundRect(10, -8, 36, 15, 7), o.skin, null, 0, 4); g.restore(); } }
    else { // arms folded
      flat(g, P => P.roundRect(-104, -262, 208, 62, 30), J, JD, 8, 5); flat(g, P => P.arc(-66, -232, 19, 0, TAU), o.skin, shade(o.skin, 0.78), 4, 4); flat(g, P => P.arc(66, -228, 19, 0, TAU), o.skin, shade(o.skin, 0.78), 4, 4); OL(g, 4); g.beginPath(); g.moveTo(-40, -262); g.lineTo(-10, -198); g.stroke(); }
    // the heid: wee and bald on no neck, monobrow, earpiece
    g.save(); g.translate(0, -360); const H = P => P.ellipse(0, 0, 40, 44, 0, 0, TAU);
    flat(g, P => P.ellipse(-40, 4, 10, 14, 0, 0, TAU), o.skin, null, 0, 4); flat(g, P => P.ellipse(40, 4, 10, 14, 0, 0, TAU), o.skin, null, 0, 4);
    flat(g, H, o.skin, shade(o.skin, 0.8), 8, 5); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-14, -26, 12, 6, -0.4, 0, TAU); g.fill();
    if (o.beard) flat(g, P => { P.moveTo(-38, 4); P.quadraticCurveTo(-36, 50, 0, 52); P.quadraticCurveTo(36, 50, 38, 4); P.quadraticCurveTo(20, 30, 0, 30); P.quadraticCurveTo(-20, 30, -38, 4); P.closePath(); }, o.beard, shade(o.beard, 0.75), 4, 4);
    else { g.fillStyle = 'rgba(70,50,50,0.25)'; g.beginPath(); g.ellipse(0, 26, 30, 16, 0, 0, Math.PI); g.fill(); }
    if (lg > 0.3) { OL(g, 4); [-14, 14].forEach(x => { g.beginPath(); g.moveTo(x - 8, -2); g.lineTo(x, -8); g.lineTo(x + 8, -2); g.stroke(); }); flat(g, P => { P.moveTo(-16, 16); P.quadraticCurveTo(0, 14, 16, 16); P.quadraticCurveTo(10, 40, 0, 40); P.quadraticCurveTo(-10, 40, -16, 16); P.closePath(); }, '#5a1b22', null, 0, 3.5); g.fillStyle = '#fff'; g.fillRect(-11, 16, 22, 5); }
    else { g.fillStyle = INK; g.beginPath(); g.arc(-14, -2, 4, 0, TAU); g.arc(14, -2, 4, 0, TAU); g.fill(); OL(g, 6); g.beginPath(); g.moveTo(-27, -16); g.lineTo(-4, -8); g.lineTo(4, -8); g.lineTo(27, -16); g.stroke();
      if ((o.talk || 0) > 0.05) { const m = o.talk; flat(g, P => P.ellipse(0, 22, 12, 4 + 9 * m, 0, 0, TAU), '#5a1b22', null, 0, 3.5); } else { OL(g, 4); g.beginPath(); g.moveTo(-12, 24); g.quadraticCurveTo(0, 18, 12, 24); g.stroke(); } }
    OL(g, 2.5); g.beginPath(); g.moveTo(40, 10); for (let i = 0; i < 6; i++) g.arc(44, 20 + i * 8, 4, -Math.PI / 2, Math.PI / 2); g.stroke(); g.restore();
    g.restore(); }

  /* ---------- the ned on his BMX, coming at the camera ---------- */
  // units: ground 0, about 300 tall, facing us; o = { ph (pedal turn), laugh, sway }
  function ned(g, o) { const ph = o.ph; g.save(); g.rotate(o.sway || 0);
    // trackie top, hunched over the bars
    flat(g, P => P.ellipse(0, -240, 44, 26, 0, 0, TAU), '#8d9097', '#5e6168', 6, 4); // hood
    const torso = P => { P.moveTo(-60, -238); P.quadraticCurveTo(0, -252, 60, -238); P.lineTo(40, -150); P.quadraticCurveTo(0, -140, -40, -150); P.closePath(); };
    flat(g, torso, '#202127', '#121318', 8, 4.5); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-52, -232); g.lineTo(-36, -152); g.moveTo(52, -232); g.lineTo(36, -152); g.stroke(); OL(g, 2); g.beginPath(); g.moveTo(0, -246); g.lineTo(0, -146); g.stroke();
    g.strokeStyle = '#e8c04a'; g.lineWidth = 3; g.beginPath(); g.arc(0, -246, 16, 0.4, Math.PI - 0.4); g.stroke();
    // knees going up and down either side of the frame, trackies in socks, white trainers on the pedals
    [-1, 1].forEach(sd => { const up = 0.5 + 0.5 * Math.sin(ph + (sd > 0 ? Math.PI : 0)), hip = [sd * 22, -152], knee = [sd * 44, -118 - 34 * up], foot = [sd * 34, -36 + 18 * Math.cos(ph + (sd > 0 ? Math.PI : 0)) * 0.6 - 12 * up], sock = [lerp(knee[0], foot[0], 0.7), lerp(knee[1], foot[1], 0.7)];
      limb(g, [hip, knee, sock], 28, '#9a9da3', '#6f7277'); limb(g, [sock, foot], 18, '#f6f4ee', '#cfcdc4'); flat(g, P => P.ellipse(foot[0], foot[1] + 6, 17, 13, 0, 0, TAU), '#fbfbf8', '#cfcfc8', 3, 4); OL(g, 2.5); g.beginPath(); g.moveTo(foot[0] - 15, foot[1] + 10); g.lineTo(foot[0] + 15, foot[1] + 10); g.stroke(); });
    // the front wheel and fork
    flat(g, P => P.ellipse(0, -46, 13, 46, 0, 0, TAU), '#202027', '#0e0e12', 3, 4.5); g.strokeStyle = '#9da2ab'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -46, 6, 36, 0, 0, TAU); g.stroke();
    limb(g, [[-9, -128], [-7, -46]], 5, '#d7dae0', '#80858f'); limb(g, [[9, -128], [7, -46]], 5, '#d7dae0', '#80858f'); flat(g, P => P.arc(0, -46, 6, 0, TAU), '#d9dce2', null, 0, 3);
    // the bars: tall BMX bars with a crossbar
    limb(g, [[-74, -168], [-26, -128], [0, -128], [26, -128], [74, -168]], 7, '#d7dae0', '#80858f'); limb(g, [[-46, -150], [46, -150]], 5, '#d7dae0', '#80858f');
    // arms to the grips, fists on them
    [-1, 1].forEach(sd => { const sh = [sd * 52, -230], gp = [sd * 72, -168], el = [sd * 86, -200]; limb(g, [sh, el, gp], 22, '#202127', '#121318'); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(sh[0], sh[1] - 6); g.lineTo(el[0] + sd * 6, el[1]); g.lineTo(gp[0] + sd * 6, gp[1] - 4); g.stroke(); flat(g, P => P.arc(gp[0], gp[1], 13, 0, TAU), SK, SKD, 3, 4); });
    // the heid: long face, ears out, wee eyes, a big laughing gob, cap perched on top
    g.save(); g.translate(0, -286); flat(g, P => P.ellipse(-31, 4, 9, 15, 0, 0, TAU), SK, null, 0, 4); flat(g, P => P.ellipse(31, 4, 9, 15, 0, 0, TAU), SK, null, 0, 4);
    flat(g, P => { P.moveTo(-28, -16); P.bezierCurveTo(-30, 26, -16, 46, 0, 46); P.bezierCurveTo(16, 46, 30, 26, 28, -16); P.bezierCurveTo(24, -40, -24, -40, -28, -16); P.closePath(); }, SK, SKD, 6, 4.5);
    [-11, 11].forEach(x => { flat(g, P => P.ellipse(x, -2, 8, 9, 0, 0, TAU), '#fff', null, 0, 3); g.fillStyle = INK; g.beginPath(); g.arc(x + (x < 0 ? 1.5 : -1.5), 0, 2.6, 0, TAU); g.fill(); }); OL(g, 4); g.beginPath(); g.moveTo(-20, -15); g.lineTo(-4, -10); g.moveTo(20, -15); g.lineTo(4, -10); g.stroke();
    OL(g, 3); g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(4, 12, -1, 14); g.stroke();
    const lg = o.laugh || 0; flat(g, P => { P.moveTo(-16, 21); P.quadraticCurveTo(0, 24, 16, 21); P.quadraticCurveTo(10, 32 + 8 * lg, 0, 33 + 8 * lg); P.quadraticCurveTo(-10, 32 + 8 * lg, -16, 21); P.closePath(); }, '#5a1b22', null, 0, 3.5); g.fillStyle = '#fff'; g.fillRect(-9, 21, 7, 5); g.fillRect(3, 21, 6, 4);
    // cap perched high, skip up
    g.rotate(0.12); flat(g, P => { P.moveTo(-26, -24); P.bezierCurveTo(-26, -56, 26, -56, 26, -24); P.closePath(); }, '#f3f2ed', '#c7c6c0', 4, 4); flat(g, P => { P.moveTo(-24, -26); P.quadraticCurveTo(0, -46, 24, -26); P.quadraticCurveTo(0, -36, -24, -26); P.closePath(); }, '#e1e0da', '#b5b4ae', 2, 4);
    g.restore(); g.restore(); }

  /* ---------- the splash ---------- */
  function splash(g, t0, t, x, y, s) { const k = t - t0; if (k < 0 || k > 1.2) return; const r = rng(77);
    // the sheet off the wheel: a crown of water
    if (k < 0.35) { const f = k / 0.35, a = 1 - f; g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(-s, s); flat(g, P => { P.moveTo(-40, 0); for (let i = 0; i <= 10; i++) { const u = i / 10, xx = lerp(-40 - 160 * f, 40 + 260 * f, u), hh = (60 + 160 * Math.sin(Math.PI * u)) * eo(f / 0.6) * (0.8 + 0.4 * ((i * 7) % 3) / 2); P.lineTo(xx, -hh); } P.lineTo(40, 0); P.closePath(); }, '#cfe8ff', '#8fbde6', 10, 4); g.restore(); }
    for (let i = 0; i < 70; i++) { const right = r() < 0.75, vx = (right ? -1 : 1) * (250 + r() * 900), vy = -(450 + r() * 900), sz = 6 + r() * 16, life = 0.5 + r() * 0.5, d = r() * 0.08; const kk = k - d; if (kk < 0 || kk > life) continue;
      const px = x + vx * kk * s, py = y - 20 * s + (vy * kk + 1700 * kk * kk) * s; if (py > y + 30 * s && kk > 0.15) continue; g.globalAlpha = 1 - sm((kk - life + 0.15) / 0.15); flat(g, P => P.ellipse(px, py, sz * s * 1.5, sz * s * 0.7, Math.atan2(vy + 3400 * kk, vx), 0, TAU), '#d8eeff', '#93c3ec', sz * s * 0.25, 2.5); }
    g.globalAlpha = 1; }

  /* ---------- speech bubbles ---------- */
  function bubble(g, x, y, w, h, text, k, tail, out) { if (k <= 0 || out <= 0) return; const s = eb(k / 0.16) * cl(out / 0.1); g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.04);
    const P = new Path2D(); P.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); const T = new Path2D(); T.moveTo(tail[0] * 0.2 - 18, h * 0.3); T.lineTo(tail[0], tail[1]); T.lineTo(tail[0] * 0.2 + 18, h * 0.32); T.closePath();
    OL(g, 10); g.stroke(P); g.stroke(T); g.fillStyle = '#fffdf4'; g.fill(P); g.fill(T);
    let fs = h * 0.38; g.font = `400 ${fs}px ${TITLE}`; while (g.measureText(text).width > w * 0.78) { fs -= 1; g.font = `400 ${fs}px ${TITLE}`; } g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 3); g.restore(); }

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
  // beats (seconds)
  const B = { open: 0.35, throw: 0.42, land: 1.0, up: 1.3, finger: 1.75, maw: 1.95, fingerOff: 2.85, ned: 3.05, glare: 4.75, lift: 5.3, glug: 5.6, down: 6.7, ahh: 6.8, green: 6.95, hurk1: 7.4, hurk2: 7.75, spew: 8.1, splat: 8.3, logo: 8.55, name: 8.8, ep: 9.15, cone: 9.2, bonk: 9.5, end: 10.9 };
  const NED_DUR = 1.45; B.splash = B.ned + NED_DUR * (8 - 236 / (800 - 610)) / 7.55;
  const HOME = { x: 760, y: 846 }, DOOR = { x: 300, y: 640 }, PUD = { x: 1010, y: 800 }, XN = 994;
  function pose(t) { const p = { t, wave: 0.5, waveF: 1.6, amb: [0.88, 0.84, 0.92], rim: [1, 0.66, 0.32], rimDir: [-1, -0.6], rimAmt: 1.0, lidTilt: 0, armLA: 0.42, armLCurl: 1.1 };
    // the bottle arm: at his side, up to his gub for the swally, then down
    p.armA = key(t, [[0, 0.95], [B.lift, 0.95], [B.glug, -1.72], [B.down, -1.8], [B.ahh + 0.1, 0.8]]); p.armCurl = key(t, [[0, 1.0], [B.lift, 1.0], [B.glug, -0.35], [B.down, -0.3], [B.ahh + 0.1, 1.0]]); p.armLen = key(t, [[0, 112], [B.lift, 112], [B.glug, 78], [B.down, 78], [B.ahh + 0.1, 112]]);
    // flung: spinning, legs everywhere, eyes like saucers
    if (t < B.land) { const f = cl((t - B.throw) / (B.land - B.throw)); p.rot = -5.6 * (1 - eo(f)); p.splay = 0.7; p.eye = 1.3; p.sq = 1.1; p.armA = 0.95 + 0.9 * Math.sin(t * 19); p.armLA = -0.6 + 0.9 * Math.sin(t * 17 + 1); p.armLCurl = 0.3; p.wave = 2; p.waveF = 9; return p; }
    const lk = t - B.land; p.sq = 1 - 0.38 * bump(lk, 0.16) + 0.12 * bump(lk - 0.14, 0.2) - 0.05 * bump(lk - 0.34, 0.15);
    // raging and steaming: heavy angry lids, the "who you looking at" glare
    p.lidL = p.lidR = key(t, [[B.land, 0.1], [B.up, 0.42]]); p.lidTilt = key(t, [[B.land, 0], [B.up, 0.32]]); p.eye = key(t, [[B.land, 1.2], [B.up, 1]]);
    p.lean = key(t, [[B.land, 0], [B.up, -0.12], [B.fingerOff, -0.16], [B.fingerOff + 0.3, 0.02]]);
    // the finger: his left arm up at the bouncers, a wee shake on it
    const fk = sm((t - B.finger) / 0.2) * (1 - sm((t - B.fingerOff) / 0.25)); p.armLA = lerp(0.42, -1.25 + 0.05 * Math.sin(t * 34), fk); p.armLCurl = lerp(1.1, 0.12, fk); p.armLLen = lerp(112, 124, fk); p.finger = fk;
    if (t > B.fingerOff) { const w = t - B.fingerOff; p.lean += 0.06 * Math.sin(w * 3.3); p.sq += 0.02 * Math.sin(w * 6); }
    // soaked: flinch, then the glare, dripping
    if (t > B.splash) { const sk = t - B.splash; p.wet = sm((sk - 0.08) / 0.12); p.sq -= 0.22 * bump(sk, 0.16); p.eye = 1 + 0.4 * bump(sk, 0.35); p.droop = 0.5 * sm(sk / 0.3); p.wave = 0.25; p.lidL = p.lidR = lerp(0, 0.5, sm((sk - 0.2) / 0.25)); p.lidTilt = 0.4; p.lean = 0.04 * Math.sin(sk * 2);
      if (t > B.glare + 0.25 && t < B.glare + 0.35) p.lidL = 0.62; }
    // the swally: lids shut in bliss, a big ahh
    const g3 = t > B.glug && t < B.down ? Math.abs(Math.sin((t - B.glug) / (B.down - B.glug) * Math.PI * 3)) : 0; if (t > B.lift) { p.lean = key(t, [[B.lift, p.lean], [B.glug, -0.14], [B.down - 0.1, -0.2], [B.ahh, -0.05], [B.green, 0]]); p.sq -= 0.035 * g3; p.sq += 0.06 * bump(t - B.ahh, 0.35); }
    if (t > B.glug - 0.1 && t < B.ahh + 0.3) { p.lidL = p.lidR = 0.92; p.lidTilt = 0; }
    if (t > B.green) { const gk = sm((t - B.green) / 0.5); p.amb = [lerp(0.88, 0.72, gk), lerp(0.84, 0.95, gk), lerp(0.92, 0.66, gk)]; p.lidL = lerp(0.5, 0.25, gk); p.lidR = lerp(0.5, 0.35, gk); p.lidTilt = 0.1; }
    const h1 = bump(t - B.hurk1, 0.28), h2 = bump(t - B.hurk2, 0.3); p.sq -= 0.16 * (h1 + h2); p.eye = (p.eye || 1) + 0.3 * (h1 + h2); if (t > B.hurk1 - 0.1) { p.lidL = p.lidR = 0.1 + 0.3 * (1 - h1 - h2); p.lean = 0.12 * (h1 + h2) + 0.05 * Math.sin(t * 7); }
    if (t > B.spew - 0.18) { const sk = t - (B.spew - 0.18); p.sq = sk < 0.18 ? lerp(0.8, 0.62, ei(sk / 0.18)) : 1.35 - 0.15 * eo((sk - 0.18) / 0.2); p.splay = sk > 0.18 ? 0.9 : 0; p.eye = sk > 0.18 ? 1.45 : 1.2; p.lidL = p.lidR = 0; p.lidTilt = 0; p.lean = sk < 0.18 ? -0.18 : 0.12; }
    return p; }
  function where(t) { let x = HOME.x, y = HOME.y, h = 300;
    if (t < B.land) { const f = cl((t - B.throw) / (B.land - B.throw)); x = lerp(DOOR.x, HOME.x, f); y = lerp(DOOR.y, HOME.y, f) - Math.sin(Math.PI * f) * 120; h = lerp(250, 300, f); }
    else if (t > B.fingerOff) { const w = t - B.fingerOff; x += 16 * Math.sin(w * 2.1) * sm(w / 0.5); }
    const cam = { x: key(t, [[0, 600], [B.land, 610], [B.fingerOff, 620], [B.ned + 0.3, 830], [B.splash, 840], [B.glare, 770], [B.spew, 765]]), y: key(t, [[0, 640], [B.ned + 0.3, 650], [B.glare, 690], [B.spew, 700]]), z: key(t, [[0, 1.45], [B.fingerOff, 1.52], [B.ned + 0.3, 1.45], [B.splash, 1.5], [B.glare, 1.95], [B.lift, 2.0], [B.green, 2.15], [B.spew - 0.2, 2.3], [B.spew, 2.7]]) };
    const sh = bump(t - B.land, 0.2) * 6 + bump(t - B.splash, 0.3) * 10 + (t > B.spew ? bump(t - B.spew, 0.3) * 12 : 0); cam.x += Math.sin(t * 90) * sh; cam.y += Math.cos(t * 77) * sh;
    return { x, y, h, cam }; }
  // the ned: far up the road to past the camera; z is how far off he is (1 = level with the squid)
  function nedAt(t) { const u = (t - B.ned) / NED_DUR; if (u <= 0 || u >= 1) return null; const z = 8 - 7.55 * u, s = 1 / z; return { x: 1060 + (XN - 1060) * s + Math.max(0, s - 0.8) * 420, y: 610 + 236 * s, s, z }; }

  function swally(g, t, W, H, o = {}) { if (!plate) return false; const name = o.name || 'PatterSquid', P = pose(t), Wh = where(t), h = Wh.h;
    if (t < B.splat + 0.6) {
    g.save(); const k = camTo(g, W, H, Wh.cam); g.drawImage(soft || plate, 0, 0, PW, PH);
    g.save(); g.globalCompositeOperation = 'screen'; [[757, 178, 150], [1142, 352, 90], [1043, 458, 55]].forEach(([x, y, r], i) => glow(g, x, y, r, 'rgba(255,170,80,A)', 0.3 + 0.05 * Math.sin(t * 7 + i * 2))); glow(g, 1060, 112, 130, 'rgba(190,210,255,A)', 0.2); g.restore();
    // the pub and its bouncers
    const open = t < B.open ? 0 : sm((t - B.open) / 0.08); const laugh = sm((t - B.splash - 0.15) / 0.15);
    pub(g, t, open, laugh);
    const bo = [{ x: 205, y: 778, s: 0.74, skin: '#f0b99a', beard: null }, { x: 395, y: 770, s: 0.72, skin: '#e9ad8c', beard: '#b4542a' }];
    bo.forEach((b, i) => { let ps = 'fold', kk = 1; if (i === 1 && t > B.throw - 0.12 && t < B.land + 0.25) { ps = 'throw'; kk = t < B.throw ? sm((t - B.throw + 0.12) / 0.12) : 1 - sm((t - B.land) / 0.25); } if (i === 0 && t > B.land - 0.1 && t < B.finger + 0.1) { ps = 'point'; kk = sm((t - B.land + 0.1) / 0.15) * (1 - sm((t - B.finger) / 0.1)); }
      g.save(); g.fillStyle = 'rgba(6,4,12,0.45)'; g.beginPath(); g.ellipse(b.x, b.y + 2, 100 * b.s, 12, 0, 0, TAU); g.fill(); g.restore();
      g.save(); g.translate(b.x, b.y); g.scale(b.s, b.s); const lift = i === 0 && t > B.finger ? bump(t - B.finger - 0.1, 0.25) * 8 : 0; g.translate(0, -lift); bouncer(g, { t, pose: ps, k: kk, skin: b.skin, beard: b.beard, laugh: i === 0 ? laugh : laugh * sm((t - B.splash - 0.3) / 0.1), talk: i === 0 ? Math.abs(Math.sin((t - B.land) * 14)) * (t > B.land && t < B.land + 0.6 ? 1 : 0) : 0 }); g.restore(); });
    // the ned, behind him while he is further off than the squid
    const N = nedAt(t), drawNed = () => { if (!N) return; g.save(); g.fillStyle = 'rgba(6,4,12,0.5)'; g.beginPath(); g.ellipse(N.x, N.y + 2, 60 * N.s, 10 * N.s, 0, 0, TAU); g.fill(); g.translate(N.x, N.y); g.scale(N.s, N.s); ned(g, { ph: t * 13, laugh: bump(t - B.splash + 0.4, 0.9), sway: 0.06 * Math.sin(t * 6.5) }); g.restore(); };
    if (N && N.s < 1) drawNed();
    // his shadow, a puddle growing under him once he is soaked, then him (bottle in one tentacle, the finger on the other)
    g.save(); g.fillStyle = 'rgba(6,4,12,0.6)'; const air = HOME.y - Wh.y; g.beginPath(); g.ellipse(Wh.x + 10, HOME.y + 4, h * 0.36 * (1 - 0.5 * cl(air / 200)), h * 0.06, 0, 0, TAU); g.fill();
    if (t > B.splash) { const pk = sm((t - B.splash - 0.1) / 1.2); flat(g, Pp => Pp.ellipse(Wh.x + 6, HOME.y + 6, h * 0.42 * pk + 0.1, h * 0.05 * pk + 0.1, 0, 0, TAU), 'rgba(110,150,190,0.55)', null, 0, 0); } g.restore();
    P.postArm = (gg) => { const hd = Squid.hand(P); gg.save(); gg.translate(hd.x, hd.y); const ba = key(t, [[0, 0.1], [B.lift, 0.1], [B.glug, -2.25], [B.down - 0.15, -2.45], [B.ahh + 0.1, 0.15]]) + (t < B.land ? Math.sin(t * 13) * 0.6 : 0); gg.rotate(ba); gg.drawImage(bottle(), -26, -96, 52, 144); gg.restore(); };
    P.postArmL = (gg) => { if (!(P.finger > 0.3)) return; const hd = Squid.hand(P, -1); gg.save(); gg.translate(hd.tip[0], hd.tip[1]); gg.rotate(Math.atan2(hd.tip[1] - hd.y, hd.tip[0] - hd.x) + Math.PI / 2); const sc = 0.9 * sm((P.finger - 0.3) / 0.3); gg.scale(sc, sc);
      flat(gg, Q => Q.roundRect(-13, -10, 26, 24, 8), '#ece6db', '#bfb6a8', 3, 3); flat(gg, Q => Q.roundRect(-4.5, -40, 9, 34, 4.5), '#ece6db', '#bfb6a8', 2, 3); OL(gg, 2); gg.beginPath(); gg.moveTo(-6, -8); gg.lineTo(-6, 0); gg.moveTo(6, -8); gg.lineTo(6, 0); gg.stroke(); gg.restore(); };
    if (t > B.throw && t < B.splat + 0.1) { squidComic(g, Wh.x, Wh.y, h, P, k);
      // his cap and the drink in his cheeks
      const top = Squid.point([151, 40], Wh.x, Wh.y, h, P), ha = Squid.headAngle(P), cw = h * 0.5, wob = bump(t - B.land, 0.3) * 0.4 + bump(t - B.splash, 0.3) * 0.3;
      if (t > B.land - 0.05 && t < B.spew) { [[110, 178], [192, 178]].forEach(pt => { const c = Squid.point(pt, Wh.x, Wh.y, h, P); g.save(); g.globalAlpha = 0.3 * (1 - (P.wet || 0) * 0.5); g.fillStyle = '#ff5a6e'; g.beginPath(); g.ellipse(c[0], c[1], h * 0.06, h * 0.03, 0, 0, TAU); g.fill(); g.restore(); }); }
      cap(g, top[0], top[1], cw, ha - 0.22 + wob, P.wet);
      // drips off him once he is soaked
      if (P.wet > 0 && t < B.spew) { const r = rng(9); for (let i = 0; i < 14; i++) { const x0 = (r() - 0.5) * h * 0.7, y0 = -h * (0.1 + r() * 0.5), per = 0.4 + r() * 0.5, ph = ((t - B.splash) / per + r()) % 1; const dx = Wh.x + x0, dy = Wh.y + y0 + ph * h * 0.6; g.globalAlpha = 1 - ph; flat(g, Q => Q.ellipse(dx, dy, 4, 6, 0, 0, TAU), '#cfe8ff', null, 0, 1.5); } g.globalAlpha = 1; } }
    if (N && N.s >= 1) drawNed();
    splash(g, B.splash, t, PUD.x, PUD.y, 0.8);
    // what they say
    bubble(g, 330, 380, 330, 110, "AN' STAY OOT!", t - B.land + 0.05, [-120, 110], B.finger + 0.1 - t);
    { const tp = Squid.point('top', Wh.x, Wh.y, h, P); bubble(g, tp[0] - 70, tp[1] - 70, 250, 100, 'YER MAW!', t - B.maw, [-40, 80], B.fingerOff - t); }
    if (N && N.s > 0.35) bubble(g, N.x + 130 * N.s, N.y - 400 * N.s, 270, 100, 'HAW, YA ROCKET!', t - B.splash + 0.5, [-80, 70], B.splash + 0.3 - t);
    let mouthS = null; if (t > B.spew) { const m = Squid.point('mouth', Wh.x, Wh.y, h, P), M = g.getTransform(); mouthS = [M.a * m[0] + M.e, M.d * m[1] + M.f]; }
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
  return { ready, swally, B, PW, PH, TITLE };
})();

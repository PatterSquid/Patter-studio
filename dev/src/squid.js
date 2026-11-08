/* Squid: his PatterSquid squid as a cartoon character (white, big black eyes, flat shading with the long diagonal shadow of
   the logo, speckled suckers on the arm tips), drawn as vectors so it can squash, stretch and act. Pure drawing: give it
   a pose and it draws; animation lives in the caller.
   draw(g, x, y, size, pose): (x, y) is the point where the arms meet the head, size the head's width in pixels.
   pose: { sq (1 normal, < 1 squashed, > 1 stretched), lean (radians), eyes (scale), look: [dx, dy] (-1..1),
           lid (0 open .. 1 shut), lidL, lidR (each eye, override lid), brow (-1 cross .. 1 surprised), blush,
           arms: [{ a: angle, len, curl, wave }] (8, optional each), reach: { i, to: [x, y] (page px), bend } list,
           t (seconds, for idle wriggles), mouth (0 none .. 1 open 'o'), outline (px, default auto) } */
const Squid = (() => {
  const WHITE = '#f4f0e7', SHADE = '#d9d2c4', DEEP = '#b9b0a0', INK = '#121218', LINE = 'rgba(20,18,26,0.85)';
  const DEF_ARMS = [[-2.55, 1.05, 1.1], [-2.15, 1.2, 0.8], [-1.85, 1.3, 0.5], [-1.67, 1.35, 0.25], [-1.47, 1.35, -0.25], [-1.29, 1.3, -0.5], [-0.99, 1.2, -0.8], [-0.59, 1.05, -1.1]];
  // A tapered arm as a list of points, from the base along its curve (head widths)
  function armPts(base, ang, len, curl, wave, t, i, reach) {
    const n = 14, pts = []; let x = base[0], y = base[1], a = ang;
    if (reach) { // bend towards a target: a quadratic curve with the bend sideways
      const [tx, ty] = reach.to, mx = (x + tx) / 2, my = (y + ty) / 2, dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1, b = reach.bend == null ? 0.3 : reach.bend, cx = mx - dy / l * b * l, cy = my + dx / l * b * l;
      for (let k = 0; k <= n; k++) { const u = k / n; pts.push([(1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * tx, (1 - u) * (1 - u) * y + 2 * (1 - u) * u * cy + u * u * ty]); } return pts; }
    const seg = len / n; pts.push([x, y]);
    for (let k = 1; k <= n; k++) { const u = k / n; a += curl * 0.32 * u * u + Math.sin(t * 2.3 + i * 1.7 + u * 3.5) * 0.06 * (wave == null ? 1 : wave) * u; x += Math.cos(a) * seg; y -= Math.sin(a) * seg; pts.push([x, y]); }
    return pts; }
  function drawArm(g, pts, w0, w1, sk) {
    const n = pts.length, L = [], R = [];
    for (let k = 0; k < n; k++) { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = w0 + (w1 - w0) * Math.pow(k / (n - 1), 0.9); L.push([pts[k][0] - dy / l * w, pts[k][1] + dx / l * w]); R.push([pts[k][0] + dy / l * w, pts[k][1] - dx / l * w]); }
    g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (let k = 1; k < n; k++) g.lineTo(L[k][0], L[k][1]);
    const tp = pts[n - 1]; g.arc(tp[0], tp[1], w1, Math.atan2(L[n - 1][1] - tp[1], L[n - 1][0] - tp[0]), Math.atan2(R[n - 1][1] - tp[1], R[n - 1][0] - tp[0]), false);
    for (let k = n - 1; k >= 0; k--) g.lineTo(R[k][0], R[k][1]); g.closePath();
    g.fillStyle = WHITE; g.fill(); g.stroke();
    // shade along one side, and the speckled suckers on the last part
    g.save(); g.clip(); g.fillStyle = SHADE; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 0; k < n; k++) g.lineTo(pts[k][0], pts[k][1]); for (let k = n - 1; k >= 0; k--) g.lineTo(R[k][0], R[k][1]); g.closePath(); g.fill(); g.restore();
    if (sk) for (let k = Math.floor(n * 0.45); k < n - 1; k++) { const p = pts[k], q = R[k], f = 0.55, w = (w0 + (w1 - w0) * (k / (n - 1))); const sx = p[0] + (q[0] - p[0]) * f, sy = p[1] + (q[1] - p[1]) * f, r = w * 0.42;
      g.fillStyle = '#6d6a72'; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill(); g.fillStyle = '#efe9de'; g.beginPath(); g.arc(sx - r * 0.2, sy - r * 0.2, r * 0.45, 0, Math.PI * 2); g.fill(); }
  }
  function draw(g, x, y, size, pose = {}) {
    const S = size, sq = pose.sq || 1, sy = sq, sx = 1 / Math.sqrt(sq), t = pose.t || 0, lw = pose.outline != null ? pose.outline : Math.max(1, S * 0.022);
    g.save(); g.translate(x, y); g.rotate(pose.lean || 0); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = LINE; g.lineWidth = lw;
    // arms behind the head (in head widths, then scaled)
    const arms = DEF_ARMS.map((d, i) => { const o = (pose.arms && pose.arms[i]) || {}; return { a: o.a != null ? o.a : d[0], len: o.len != null ? o.len : d[1], curl: o.curl != null ? o.curl : d[2], wave: o.wave }; });
    const reach = {}; (pose.reach || []).forEach(r => { reach[r.i] = r; });
    const toLocal = p => { const c = Math.cos(-(pose.lean || 0)), s = Math.sin(-(pose.lean || 0)), dx = p[0] - x, dy = p[1] - y; return [(dx * c - dy * s) / S, (dx * s + dy * c) / S]; };
    const order = [0, 7, 1, 6, 2, 5, 3, 4];
    g.save(); g.scale(S, S); g.lineWidth = lw / S;
    order.forEach(i => { const bx = (i - 3.5) / 3.5 * 0.34 * sx, base = [bx, -0.06], r = reach[i];
      const pts = armPts(base, arms[i].a, arms[i].len * (0.85 + 0.15 / sq), arms[i].curl, arms[i].wave, t, i, r ? { to: toLocal(r.to), bend: r.bend } : null);
      drawArm(g, pts, 0.085, 0.022, true); });
    g.restore();
    // the head: a soft dome, squashed or stretched from the base
    g.save(); g.scale(S * sx, S * sy); g.lineWidth = lw / S;
    const head = () => { g.beginPath(); g.moveTo(-0.44, 0); g.bezierCurveTo(-0.62, -0.2, -0.62, -0.78, -0.42, -1.05); g.bezierCurveTo(-0.24, -1.3, 0.24, -1.3, 0.42, -1.05); g.bezierCurveTo(0.62, -0.78, 0.62, -0.2, 0.44, 0); g.bezierCurveTo(0.2, 0.09, -0.2, 0.09, -0.44, 0); g.closePath(); };
    head(); g.fillStyle = WHITE; g.fill(); g.save(); g.clip();
    // the logo's long diagonal shadow down the right, and a soft highlight on the crown
    g.fillStyle = SHADE; g.beginPath(); g.moveTo(0.05, -1.4); g.lineTo(0.9, -1.4); g.lineTo(0.9, 0.2); g.lineTo(-0.35, 0.2); g.closePath(); g.fill();
    g.fillStyle = DEEP; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(0.1, 0.02, 0.6, 0.12, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    const hl = g.createRadialGradient(-0.2, -0.95, 0, -0.2, -0.95, 0.45); hl.addColorStop(0, 'rgba(255,255,255,0.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(-0.7, -1.4, 1.4, 1.4);
    if (pose.blush) { g.fillStyle = `rgba(232,110,120,${0.45 * pose.blush})`; [-0.3, 0.3].forEach(bx => { g.beginPath(); g.ellipse(bx, -0.13, 0.1, 0.05, 0, 0, Math.PI * 2); g.fill(); }); }
    g.restore(); head(); g.stroke();
    // eyes: big black discs with a glint; lids drop from the top, brows tilt them
    const es = pose.eyes || 1, lk = pose.look || [0, 0];
    [-1, 1].forEach(sd => { const ex = sd * 0.215 + lk[0] * 0.04, ey = -0.36 + lk[1] * 0.03, rx = 0.15 * es, ry = 0.16 * es / Math.max(0.7, Math.min(1.3, 1 / sy)); const lid = sd < 0 ? (pose.lidL != null ? pose.lidL : pose.lid || 0) : (pose.lidR != null ? pose.lidR : pose.lid || 0), brow = pose.brow || 0;
      g.save(); g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); g.clip();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - rx * 0.35 + lk[0] * rx * 0.25, ey - ry * 0.4 + lk[1] * ry * 0.2, rx * 0.26, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(ex + rx * 0.3, ey + ry * 0.35, rx * 0.1, 0, Math.PI * 2); g.fill();
      if (lid > 0.01 || brow < -0.01) { const tilt = -brow * 0.35 * sd * -1, top = ey - ry * 1.1, edge = ey - ry + 2 * ry * Math.min(1, lid); g.fillStyle = WHITE; g.beginPath(); g.moveTo(ex - rx * 1.3, top); g.lineTo(ex + rx * 1.3, top); g.lineTo(ex + rx * 1.3, edge + tilt * rx); g.lineTo(ex - rx * 1.3, edge - tilt * rx); g.closePath(); g.fill(); g.strokeStyle = LINE; g.lineWidth = lw / S * 1.2; g.beginPath(); g.moveTo(ex - rx * 1.3, edge - tilt * rx); g.lineTo(ex + rx * 1.3, edge + tilt * rx); g.stroke(); }
      g.restore(); });
    // hats: a bunnet (flat cap) or a traffic cone, sat on the crown
    if (pose.hat === 'bunnet') { g.save(); g.translate(0, -1.16); g.rotate(pose.hatTilt || -0.12); g.lineWidth = lw / S; g.strokeStyle = LINE;
      g.fillStyle = '#5b5348'; g.beginPath(); g.moveTo(-0.46, 0.1); g.bezierCurveTo(-0.5, -0.16, -0.2, -0.24, 0.12, -0.2); g.bezierCurveTo(0.42, -0.16, 0.56, -0.02, 0.62, 0.08); g.bezierCurveTo(0.3, 0.14, -0.2, 0.16, -0.46, 0.1); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#463f36'; g.beginPath(); g.moveTo(0.28, 0.06); g.bezierCurveTo(0.5, 0.04, 0.72, 0.08, 0.78, 0.14); g.bezierCurveTo(0.6, 0.18, 0.4, 0.16, 0.24, 0.13); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(-0.4 + k * 0.02, 0.05 + k * 0.01); g.lineTo(0.5, -0.1 + k * 0.03); g.stroke(); } g.restore(); }
    if (pose.hat === 'cone') { g.save(); g.translate(0, -1.2); g.rotate(pose.hatTilt || 0.18); g.lineWidth = lw / S; g.strokeStyle = LINE;
      g.fillStyle = '#e8661c'; g.beginPath(); g.moveTo(-0.3, 0.05); g.lineTo(-0.05, -0.95); g.lineTo(0.05, -0.95); g.lineTo(0.3, 0.05); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f2f2ee'; [[-0.24, -0.18, 0.2], [-0.15, -0.53, 0.13]].forEach(([x0, y0, w]) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(-x0, y0); g.lineTo(-x0 - w * 0.25, y0 - 0.12); g.lineTo(x0 + w * 0.25, y0 - 0.12); g.closePath(); g.fill(); });
      g.fillStyle = '#c94f12'; g.beginPath(); g.roundRect(-0.42, 0.02, 0.84, 0.1, 0.03); g.fill(); g.stroke(); g.restore(); }
    if (pose.mouth > 0.02) { const m = pose.mouth; g.fillStyle = '#3a1c24'; g.beginPath(); g.ellipse(0, -0.08, 0.05 + 0.04 * m, 0.03 + 0.07 * m, 0, 0, Math.PI * 2); g.fill(); }
    g.restore(); g.restore();
  }
  return { draw, WHITE, SHADE, INK };
})();

/* CoatScenes: the intro cut scenes, starring his own icon (Squid) in cartoon Coatbridge (Coat). Shot lists with cuts,
   camera moves, acting (anticipation, squash and stretch, overshoot, holds), then the title in his ink.
   draw functions are pure functions of time: (g, t, W, H, o) with o = { name, line, episode, kicker }. */
const CoatScenes = (() => {
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f;
  const ease = f => { f = cl(f); return f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; }, eo = f => 1 - Math.pow(1 - cl(f), 3), ei = f => Math.pow(cl(f), 3);
  // a damped spring from 0 towards 1 (overshoots), and a one off bump
  const spring = (k, f = 3.2, d = 5) => k <= 0 ? 0 : 1 - Math.exp(-d * k) * Math.cos(f * Math.PI * 2 * k);
  const bump = (k, w) => k < 0 || k > w ? 0 : Math.sin(Math.PI * k / w);
  // His bunnet, flat like his icon: tweed, light side, the long diagonal shadow, a wee button
  function bunnet(g, x, y, s, ang, wet) { g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    g.beginPath(); g.moveTo(-0.62, 0.02); g.bezierCurveTo(-0.66, -0.3, -0.28, -0.44, 0.1, -0.4); g.bezierCurveTo(0.48, -0.36, 0.7, -0.16, 0.76, 0.0); g.bezierCurveTo(0.4, 0.1, -0.2, 0.12, -0.62, 0.02); g.closePath();
    const tw = g.createLinearGradient(-0.6, -0.4, 0.7, 0.1); tw.addColorStop(0, wet ? '#5b5246' : '#8a7a62'); tw.addColorStop(1, wet ? '#3b342c' : '#5e5241'); g.fillStyle = tw; g.fill();
    g.save(); g.clip(); g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.moveTo(0.05, -0.6); g.lineTo(1, -0.6); g.lineTo(1, 0.2); g.lineTo(-0.3, 0.2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,240,210,0.12)'; g.lineWidth = 0.025; for (let k = -12; k < 14; k++) { g.beginPath(); g.moveTo(-0.7 + k * 0.06, 0.1); g.lineTo(-0.5 + k * 0.06, -0.5); g.stroke(); } g.restore();
    g.beginPath(); g.moveTo(0.28, -0.02); g.bezierCurveTo(0.6, -0.08, 0.92, -0.02, 1.0, 0.06); g.bezierCurveTo(0.74, 0.14, 0.46, 0.12, 0.22, 0.08); g.closePath(); g.fillStyle = wet ? '#2f2922' : '#4b4133'; g.fill();
    g.fillStyle = wet ? '#2a241e' : '#3d3429'; g.beginPath(); g.arc(-0.02, -0.4, 0.05, 0, Math.PI * 2); g.fill();
    if (wet) { g.fillStyle = 'rgba(200,225,255,0.8)'; [[-0.3, -0.25], [0.2, -0.32], [0.55, -0.12]].forEach(([dx, dy]) => { g.beginPath(); g.ellipse(dx, dy, 0.03, 0.05, 0, 0, Math.PI * 2); g.fill(); }); }
    g.restore(); }
  // A wee contact shadow under him
  function shadow(g, x, y, w, a = 0.45) { const s = g.createRadialGradient(x, y, 0, x, y, w); s.addColorStop(0, `rgba(0,0,10,${a})`); s.addColorStop(1, 'rgba(0,0,10,0)'); g.save(); g.translate(x, y); g.scale(1, 0.18); g.translate(-x, -y); g.fillStyle = s; g.fillRect(x - w, y - w, w * 2, w * 2); g.restore(); }
  // Ink on the lens: blobs merged soft then cut sharp, with drips that run, gloss on the edges
  let inkC = null; function inkSplat(g, W, H, k, run, seed, cx = 0.5, cy = 0.45) { if (k <= 0) return; const w = Math.ceil(W / 3), h = Math.ceil(H / 3); if (!inkC || inkC.a.width !== w || inkC.a.height !== h) inkC = { a: Coat.mk(w, h), b: Coat.mk(w, h) };
    const a = inkC.a.getContext('2d'), r = Coat.rng(seed), R = h * 0.42 * eo(k / 0.18); a.clearRect(0, 0, w, h); a.fillStyle = '#000'; a.beginPath(); a.ellipse(w * cx, h * cy, R * 1.3, R, 0, 0, Math.PI * 2); a.fill();
    for (let i = 0; i < 40; i++) { const an = r() * Math.PI * 2, L = R * (0.9 + r() * 1.3) * eo(k / (0.12 + r() * 0.12)); for (let s = 0; s < 8; s++) { const f = s / 7, d = R * 0.5 + (L - R * 0.5) * f, rad = R * (0.16 - 0.12 * f) * (0.6 + r() * 0.6); a.beginPath(); a.arc(w * cx + Math.cos(an) * d * 1.35, h * cy + Math.sin(an) * d, rad, 0, Math.PI * 2); a.fill(); }
      if (r() < 0.6) { a.beginPath(); a.arc(w * cx + Math.cos(an) * (L + R * 0.3) * 1.35, h * cy + Math.sin(an) * (L + R * 0.3), R * 0.04 + r() * R * 0.05, 0, Math.PI * 2); a.fill(); } }
    for (let i = 0; i < 22; i++) { const px = w * cx + (r() - 0.5) * R * 2.4, y0 = h * cy + (r() - 0.2) * R * 0.6, sp = 0.4 + r(), l = Math.min(h, (run * sp * h * 0.55)), ww = R * (0.03 + r() * 0.04); if (l < 1) continue; a.fillRect(px - ww, y0, ww * 2, l); a.beginPath(); a.arc(px, y0 + l, ww * 1.5, 0, Math.PI * 2); a.fill(); }
    const b = inkC.b.getContext('2d'); b.clearRect(0, 0, w, h); b.filter = `blur(${Math.max(1, h / 160)}px)`; b.drawImage(inkC.a, 0, 0); b.filter = 'none'; const im = b.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = cl((d[i + 3] / 255 - 0.42) / 0.1); d[i] = 8; d[i + 1] = 8; d[i + 2] = 14; d[i + 3] = v * 255; } b.putImageData(im, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingQuality = 'high'; g.drawImage(inkC.b, 0, 0, W, H);
    // gloss: the edges of the blob catch the street light
    g.globalCompositeOperation = 'source-atop'; const gl = g.createLinearGradient(0, 0, W * 0.6, H); gl.addColorStop(0, 'rgba(120,130,170,0.35)'); gl.addColorStop(0.4, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); g.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = 'rgba(230,235,255,0.35)'; g.lineCap = 'round'; g.lineWidth = Math.max(2, H / 200); for (let i = 0; i < 6; i++) { const x = W * (cx + (r() - 0.5) * 0.3), y = H * (cy + (r() - 0.5) * 0.3); g.beginPath(); g.arc(x, y, H * (0.03 + r() * 0.05), 3.6, 4.5); g.stroke(); } g.restore(); }
  // The title, slapped on the ink: his name in big chunky white with an ink outline, landing with a squash
  function title(g, W, H, t0, t, name, line, ep, kick) { const k = t - t0; if (k < 0) return; const u = H / 1080, s = lerp(1.6, 1, eo(k / 0.16)) + (k > 0.16 ? -0.06 * Math.exp(-(k - 0.16) * 9) * Math.cos((k - 0.16) * 40) : 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.translate(W / 2, H * 0.47); g.rotate(-0.04); g.scale(s, 1 / Math.sqrt(s)); let fs = 210 * u; g.font = `900 ${fs}px ${Coat.SANS}`; while (g.measureText(name).width > W * 0.84) { fs -= 4; g.font = `900 ${fs}px ${Coat.SANS}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.globalAlpha = cl(k / 0.06); g.lineWidth = fs * 0.2; g.strokeStyle = '#08080d'; g.strokeText(name, 0, 0); const fg = g.createLinearGradient(0, -fs / 2, 0, fs / 2); fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#ddd6c6'); g.fillStyle = fg; g.fillText(name, 0, 0);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.save(); g.beginPath(); g.rect(-W, 0, W * 2, fs); g.clip(); g.fillText(name, 0, 0); g.restore(); g.restore();
    const lk = k - 0.4; if (line && lk > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); let ls = 64 * u; g.font = `700 ${ls}px ${Coat.SCRAWL}`; while (g.measureText(line).width > W * 0.8) { ls -= 2; g.font = `700 ${ls}px ${Coat.SCRAWL}`; } const tw = g.measureText(line).width; g.beginPath(); g.rect(W / 2 - tw / 2 - 10, 0, (tw + 20) * eo(lk / 0.5), H); g.clip(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = ls * 0.22; g.strokeStyle = '#08080d'; g.strokeText(line, W / 2, H * 0.62); g.fillStyle = '#f1ece0'; g.fillText(line, W / 2, H * 0.62); g.restore(); }
    const ek = k - 0.9; if (ep && ek > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.translate(W / 2, H * 0.78); g.rotate(0.02); const es = lerp(1.4, 1, eo(ek / 0.15)); g.scale(es, es); g.globalAlpha = cl(ek / 0.08); let fs2 = 56 * u; g.font = `900 ${fs2}px ${Coat.SANS}`; while (g.measureText(ep).width > W * 0.7) { fs2 -= 2; g.font = `900 ${fs2}px ${Coat.SANS}`; } const tw = g.measureText(ep).width + fs2;
      g.fillStyle = '#f08a1e'; g.beginPath(); g.roundRect(-tw / 2, -fs2 * 0.75, tw, fs2 * 1.5, fs2 * 0.2); g.fill(); g.lineWidth = 6 * u; g.strokeStyle = '#08080d'; g.stroke(); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ep, 0, 4 * u);
      if (kick) { g.font = `700 ${34 * u}px ${Coat.SCRAWL}`; g.fillStyle = '#f1ece0'; g.lineWidth = 8 * u; g.strokeText(kick, 0, -fs2 * 1.25); g.fillText(kick, 0, -fs2 * 1.25); } g.restore(); } }

  /* ---------- The bus stop ---------- */
  const BS = { s2: 1.7, s3: 2.55, hit: 2.8, s4: 3.45, s5: 4.55, fire: 4.82, s6: 5.02, title: 5.15, end: 6.6 };
  const SQX = 1590, SQY = Coat.GROUND + 6;
  function busStop(g, t, W, H, o = {}) { const T = BS;
    let cam, pose = { t, wave: 0.5, waveF: 1.6, amb: [0.84, 0.86, 0.97], rim: [1, 0.72, 0.42], rimDir: [-1, -0.3], rimAmt: 0.9 }, h = 270, wet = 0, sx = SQX, sy = SQY, hatWet = false, hatOff = 0, drips = 0;
    // Shot 1: wide, slow push in. He waits. A drip off the shelter roof lands on his bunnet.
    if (t < T.s2) { const f = ease(t / T.s2); cam = { x: lerp(1350, 1560, f), y: lerp(560, 610, f), s: lerp(1.0, 1.3, f) };
      pose.lean = -0.05 + 0.03 * Math.sin(t * 1.3); pose.sq = 1 + 0.015 * Math.sin(t * 2.4) - 0.05 * bump(t - 1.05, 0.35); const bl = bump(t - 0.7, 0.16); pose.lidL = pose.lidR = Math.max(0.42, bl); pose.eye = 1 - 0.08 * bump(t - 1.05, 0.3); }
    // Shot 2: medium. Headlights sweep in from the left; he perks up, bounces, eyes like saucers.
    else if (t < T.s3) { const k = t - T.s2, f = ease(k / (T.s3 - T.s2)); cam = { x: lerp(1560, 1540, f), y: 660, s: 2.4, dof: 3 };
      const look = eo((k - 0.12) / 0.15); pose.eye = lerp(1, 1.32, look) + 0.05 * Math.sin(k * 30) * look * 0.4; pose.lidL = pose.lidR = lerp(0.42, 0, look); pose.lean = lerp(-0.05, -0.16, look);
      const hop = Math.abs(Math.sin((k - 0.28) * Math.PI * 4.2)) * (k > 0.28 ? 1 : 0); sy -= hop * 26; pose.sq = 1 + (hop > 0.9 ? 0.12 : hop < 0.15 && k > 0.28 ? -0.1 : 0.04 * look); pose.splay = 0.35 * look; pose.wave = 1.2;
      pose.rim = [1, 0.97, 0.85]; pose.rimAmt = 0.9 + 2.4 * cl((k - 0.1) / 0.6); pose.rimDir = [-1, 0]; }
    // Shot 3: low and wide. NOT IN SERVICE. Through the puddle.
    else if (t < T.s4) { const k = t - T.s3; cam = { x: 1560, y: 600, s: 1.12 + 0.05 * k }; const sh = bump(t - T.hit, 0.3) * 10; cam.x += Math.sin(t * 90) * sh; cam.y += Math.cos(t * 70) * sh;
      pose.eye = 1.3; pose.sq = t < T.hit ? 1.08 : 0.8; pose.splay = t < T.hit ? 0.3 : 0.9; pose.lean = -0.16; wet = t > T.hit ? 1 : 0; hatWet = t > T.hit; }
    // Shot 4: drenched. Hold the stare. Push in.
    else if (t < T.s5) { const k = t - T.s4, f = ease(cl((k - 0.5) / 0.7)); cam = { x: 1590, y: lerp(665, 645, f), s: lerp(2.5, 3.1, f), dof: 4 };
      pose.droop = 1; pose.wet = 1; pose.sq = 0.9 + 0.01 * Math.sin(k * 3); pose.lidL = pose.lidR = 0.62 - 0.05 * bump(k - 0.85, 0.4); pose.wave = 0.15; pose.eye = 0.96; wet = 1; hatWet = true; hatOff = 1; drips = 1;
      pose.lean = 0.02 * Math.sin(k * 2); }
    // Shot 5: the wind up and the ink
    else if (t < T.s6) { const k = t - T.s5; cam = { x: 1590, y: 650, s: 3.1 + 0.6 * ei(k / 0.47), dof: 4 }; const wind = eo(k / 0.25); pose.droop = 1 - wind; pose.wet = 1; pose.sq = lerp(0.9, 0.62, wind); pose.lidL = pose.lidR = lerp(0.6, 0.3, wind); pose.lean = 0; pose.eye = 1.15; hatWet = true; hatOff = 1; wet = 1;
      if (t > T.fire) { pose.sq = 1.35; pose.splay = 0.8; pose.eye = 1.25; pose.lidL = pose.lidR = 0.15; } }
    else cam = { x: 1590, y: 650, s: 3.6, dof: 4 };
    pose.wet = Math.max(pose.wet || 0, wet);
    if (t >= T.s4) { const ey = Squid.point('eyeL', sx, sy, h, pose)[1]; cam.y = ey + 45; }
    Coat.busStopFrame(g, W, H, t, cam, (gw, k) => {
      shadow(gw, sx, SQY + 6, h * 0.42, 0.55);
      Squid.draw(gw, sx, sy, h, pose);
      const top = Squid.point('top', sx, sy, h, pose), ang = Squid.headAngle(pose); bunnet(gw, top[0] + (hatOff ? 8 : 0), top[1] + 18 + (hatOff ? 6 : 0), h * 0.26, ang - 0.12 - (hatOff ? 0.22 : 0), hatWet);
      // the drip from the shelter roof in shot 1
      if (t < T.s2) { const dk = (t - 0.85) / 0.2; if (dk > 0 && dk < 1) { gw.fillStyle = 'rgba(200,225,255,0.9)'; gw.beginPath(); gw.ellipse(top[0] - 10, lerp(Coat.GROUND - 300, top[1] + 10, dk * dk), 5, 9, 0, 0, Math.PI * 2); gw.fill(); } }
      if (drips) { const r = Coat.rng(4); gw.fillStyle = 'rgba(200,225,255,0.85)'; for (let i = 0; i < 16; i++) { const px = sx + (r() - 0.5) * h * 0.8, p0 = sy - h * (0.2 + r() * 0.6), ph = ((t * (0.8 + r()) + r()) % 1); gw.beginPath(); gw.ellipse(px, p0 + ph * h * 0.7, 3, 6, 0, 0, Math.PI * 2); gw.fill(); } }
      if (t >= T.s3 && t < T.s4) { const bk = (t - T.s3) / 0.62, bx = lerp(-700, 3900, bk); Coat.wave(gw, SQX - 260, Coat.GROUND + 110, (t - T.hit) / 0.55, t); Coat.bus(gw, gw, bx, Coat.GROUND + 190, t, 1); }
      // ink jet towards us
    });
    g.save(); g.setTransform(H / 1080 * cam.s, 0, 0, H / 1080 * cam.s, W / 2 - cam.x * H / 1080 * cam.s, H / 2 - cam.y * H / 1080 * cam.s); Coat.rain(g, t, cam, 1); Coat.splashes(g, t, cam.x - 900, cam.x + 900, Coat.GROUND + 4, Coat.GROUND + 200, 60); g.restore();
    Coat.finish(g, W, H, t);
    // the ink comes out of him and straight at the lens, then runs
    if (t >= T.fire) { const k = t - T.fire; inkSplat(g, W, H, k * 0.9, Math.max(0, t - T.s6) * 0.55, 8, 0.5, 0.56); title(g, W, H, T.title, t, o.name || 'PATTERSQUID', o.line, o.episode, o.kicker); }
  }
  return { busStop, BS, bunnet, inkSplat, title };
})();

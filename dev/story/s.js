
  /* ---------- Screens for B roll: a chalk frame with a see-through hole where real footage goes ---------- */
  // Each style: shape of the hole (aspect, width over height) and how much frame sits round it
  const SCREENS = [['tv', 'Old telly'], ['box', 'Chalk box'], ['phone', 'Phone'], ['cinema', 'Cinema screen'], ['polaroid', 'Polaroid'], ['window', 'Window']];
  const SCR_ASPECT = { tv: 16 / 9, box: 16 / 9, phone: 9 / 16, cinema: 2.1, polaroid: 1, window: 4 / 3 };
  const KEY_GREEN = '#00b140';
  // Where the hole is in the world, from the screen's centre and width
  function scrRect(q) { const a = SCR_ASPECT[q.style] || 16 / 9, w = +q.w || 900, h = w / a; return { x: (+q.x || 960) - w / 2, y: (+q.y || 470) - h / 2, w, h, cx: +q.x || 960, cy: +q.y || 470 }; }
  // How open the screen is at local time lt: the chalk frame draws in, then the picture switches on; at the end it switches off
  function scrState(q, lt, paused) {
    const s = +q.start || 0, d = Math.max(0.6, +q.dur || 6), e = lt - s;
    if (e < 0 || e > d) return null; if (paused) return { draw: 1, open: 1, close: 0 };
    const draw = cl(e / 0.6, 0, 1), open = cl((e - 0.55) / 0.4, 0, 1), close = cl((e - (d - 0.45)) / 0.45, 0, 1);
    return { draw: close > 0 ? 1 : draw, open: open * (1 - close), close };
  }
  function scrFrameParts(q) {
    const r = scrRect(q), P = [], A = (p, col = CH.white, w = 6) => P.push({ p: wob(p, 2.5, (q.seed || 7) * 13 + P.length), col, w }), pad = Math.max(14, r.w * 0.03), st = q.style || 'tv';
    if (st === 'tv') { const bx = r.x - pad * 2.2, by = r.y - pad * 2, bw = r.w + pad * 4.4 + r.w * 0.16, bh = r.h + pad * 4;
      A(rectP(bx, by, bw, bh), CH.brown, 8); A(rectP(r.x - pad * 0.6, r.y - pad * 0.6, r.w + pad * 1.2, r.h + pad * 1.2), CH.white, 5);
      const kx = r.x + r.w + pad * 1.4 + r.w * 0.08; [0.25, 0.5].forEach(f => A(circP(kx, by + bh * f, r.w * 0.035, r.w * 0.035), CH.yellow, 5)); for (let i = 0; i < 4; i++) A([[kx - r.w * 0.04, by + bh * 0.7 + i * 14], [kx + r.w * 0.04, by + bh * 0.7 + i * 14]], CH.white, 3);
      A([[r.cx - r.w * 0.05, by], [r.cx - r.w * 0.22, by - r.h * 0.35]], CH.grey, 4); A([[r.cx + r.w * 0.05, by], [r.cx + r.w * 0.24, by - r.h * 0.33]], CH.grey, 4); A(circP(r.cx, by - 6, 26, 12, Math.PI, Math.PI * 2, 10), CH.grey, 4);
      A([[bx + bw * 0.18, by + bh], [bx + bw * 0.12, by + bh + r.h * 0.12]], CH.brown, 7); A([[bx + bw * 0.82, by + bh], [bx + bw * 0.88, by + bh + r.h * 0.12]], CH.brown, 7); }
    if (st === 'box') { A(rectP(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2), CH.white, 7); A(rectP(r.x - pad * 0.4, r.y - pad * 0.4, r.w + pad * 0.8, r.h + pad * 0.8), CH.white, 3); }
    if (st === 'phone') { const p2 = r.w * 0.07, bx = r.x - p2, by = r.y - p2 * 2.2, bw = r.w + p2 * 2, bh = r.h + p2 * 4.4, rr = p2 * 1.6, rp = [];
      [[bx + bw - rr, by + rr, -Math.PI / 2, 0], [bx + bw - rr, by + bh - rr, 0, Math.PI / 2], [bx + rr, by + bh - rr, Math.PI / 2, Math.PI], [bx + rr, by + rr, Math.PI, Math.PI * 1.5]].forEach(([cx, cy, a0, a1]) => rp.push(...circP(cx, cy, rr, rr, a0, a1, 6))); rp.push(rp[0]); A(rp, CH.white, 7);
      A([[r.cx - r.w * 0.12, by + p2 * 1.1], [r.cx + r.w * 0.12, by + p2 * 1.1]], CH.white, 6); A([[r.cx - r.w * 0.18, by + bh - p2 * 1.1], [r.cx + r.w * 0.18, by + bh - p2 * 1.1]], CH.white, 5); }
    if (st === 'cinema') { A([[r.x - pad * 3, r.y - pad * 2], [r.x + r.w + pad * 3, r.y - pad * 2]], CH.yellow, 7); [-1, 1].forEach(sd => { const x0 = sd < 0 ? r.x - pad * 3 : r.x + r.w + pad * 3, x1 = sd < 0 ? r.x - pad * 0.3 : r.x + r.w + pad * 0.3, pts = [[x0, r.y - pad * 2]];
        for (let i = 0; i <= 6; i++) pts.push([lerp(x1, x0, (i % 2) * 0.25), lerp(r.y - pad * 2, r.y + r.h + pad * 3, i / 6)]); pts.push([x0, r.y + r.h + pad * 3]); A(pts, CH.red, 6); for (let i = 1; i < 4; i++) A([[lerp(x0, x1, i / 4), r.y - pad * 2], [lerp(x0, x1, i / 4 * 0.8), r.y + r.h + pad * 3]], CH.red, 3); });
      A([[r.x - pad * 4, r.y + r.h + pad * 3], [r.x + r.w + pad * 4, r.y + r.h + pad * 3]], CH.brown, 7); A(rectP(r.x - pad * 0.3, r.y - pad * 0.3, r.w + pad * 0.6, r.h + pad * 0.6), CH.white, 4); }
    if (st === 'polaroid') { const p2 = r.w * 0.06; A(rectP(r.x - p2, r.y - p2, r.w + p2 * 2, r.h + p2 * 4.2), CH.white, 7); A([[r.cx - r.w * 0.12, r.y - p2 * 1.6], [r.cx + r.w * 0.12, r.y - p2 * 0.4]], CH.yellow, 9); }
    if (st === 'window') { A(rectP(r.x - pad * 1.2, r.y - pad * 1.2, r.w + pad * 2.4, r.h + pad * 2.4), CH.brown, 8); A([[r.x - pad * 3, r.y + r.h + pad * 1.4], [r.x + r.w + pad * 3, r.y + r.h + pad * 1.4]], CH.brown, 9);
      [-1, 1].forEach(sd => { const xa = sd < 0 ? r.x - pad * 1.2 : r.x + r.w + pad * 1.2, xb = xa + sd * r.w * 0.16, pts = [[xa, r.y - pad * 2]]; for (let i = 0; i <= 8; i++) pts.push([xb + Math.sin(i * 1.3) * 10 * sd, lerp(r.y - pad * 2, r.y + r.h + pad, i / 8)]); pts.push([xa, r.y + r.h + pad]); A(pts, CH.pink, 5); });
      A([[r.x - pad * 3, r.y - pad * 2], [r.x + r.w + pad * 3, r.y - pad * 2]], CH.grey, 6); }
    return P;
  }
  // The hole itself: see-through when exporting with a transparent background, otherwise key green
  function scrHolePath(g, q, r, st) {
    const tv = (q.style || 'tv') === 'tv', k = st.open, cx = r.cx, cy = r.cy; g.beginPath();
    if (tv && st.close > 0) { const c = st.close, hw = r.w / 2 * (c < 0.6 ? 1 : Math.max(0.01, 1 - (c - 0.6) / 0.4)), hh = Math.max(2, r.h / 2 * (1 - Math.min(1, c / 0.6))); g.rect(cx - hw, cy - hh, hw * 2, hh * 2); return k > 0 || c < 1; }
    if (k <= 0) return false; if (tv) { const hh = Math.max(2, r.h / 2 * out3(k)), hw = r.w / 2 * Math.min(1, 0.3 + k * 2); g.rect(cx - hw, cy - hh, hw * 2, hh * 2); } else { const hw = r.w / 2 * io(k); g.rect(cx - hw, r.y, hw * 2, r.h); } return true;
  }
  function drawScreens(g, cfg, sc, lt, look, sim) {
    const list = sc.screens || []; if (!list.length) return; const paused = !!(look && look.paused), cut = !!(look && look.transparent), prev = !!(look && look.preview);
    list.forEach(q => { const st = scrState(q, lt, paused); if (!st) return; const r = scrRect(q), fx = scrFx(sc, q, lt, sim); if (fx.gone) return; g.save();
      // Knocks, kicks, falls and flights move the whole screen; tilt is the screen's own setting
      g.translate(r.cx + fx.dx, r.cy + fx.dy); g.rotate(fx.rot + (+q.tilt || 0) * Math.PI / 180); if (fx.scale !== 1) g.scale(fx.scale, fx.scale); g.translate(-r.cx, -r.cy);
      const chans = [q.media, q.media2].filter(m => m && m.id), ch = chans.length ? fx.chan % Math.max(1, chans.length) : 0, med = chans[ch];
      const tSrc = med ? scrSrcT(q, med, ch, fx.chan, fx.chanT, lt) : 0;
      const picture = () => { if (fx.slide && fx.prev != null && chans.length) { const pc = fx.prev % chans.length, pm = chans[pc]; drawVid(g, pm, scrSrcT(q, pm, pc, fx.prev, fx.prevT, lt), r.x - fx.slide * r.w * fx.slideK, r.y, r.w, r.h, pm.fit || 'fill'); }
        if (med) { const rollY = (fx.roll % 1) * r.h, sx = fx.slide ? fx.slide * r.w * (1 - (fx.slideK || 0)) : 0; drawVid(g, med, tSrc, r.x + sx, r.y - rollY, r.w, r.h, med.fit || 'fill'); if (rollY) { drawVid(g, med, tSrc, r.x + sx, r.y - rollY + r.h, r.w, r.h, med.fit || 'fill'); g.fillStyle = '#000'; g.fillRect(r.x, r.y - rollY + r.h - 4, r.w, 8); } return; }
        if (cut) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); g.restore(); } else { g.fillStyle = KEY_GREEN; g.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); }
        if (prev && st.open > 0.5) { g.save(); g.globalAlpha = 0.8; text(g, 'B ROLL' + (q.label ? ': ' + q.label : ''), r.cx, r.cy, Math.max(26, Math.min(64, r.w / 16)), '#ffffff', 'center', 1); g.restore(); } };
      if (scrHolePath(g, q, r, st)) { g.save(); g.clip();
        if (fx.dead || (fx.off && !(fx.offK < 1))) { drawDeadGlass(g, r); if (fx.dead) drawStatic(g, r, 0.12 + 0.1 * Math.abs(Math.sin(lt * 7)), lt); }
        else if (fx.off) { drawDeadGlass(g, r); const k = fx.offK, hh = Math.max(3, r.h * (1 - Math.min(1, k / 0.6))), hw = r.w * (k < 0.6 ? 1 : Math.max(0.01, 1 - (k - 0.6) / 0.4)); g.save(); g.beginPath(); g.rect(r.cx - hw / 2, r.cy - hh / 2, hw, hh); g.clip(); picture(); g.fillStyle = 'rgba(255,255,255,' + (0.6 * k) + ')'; g.fillRect(r.x, r.y, r.w, r.h); g.restore(); }
        else { picture(); if (fx.stat > 0) drawStatic(g, r, fx.stat, lt); if (fx.flicker) { g.fillStyle = 'rgba(255,255,255,' + (0.15 * Math.abs(Math.sin(lt * 31))) + ')'; g.fillRect(r.x, r.y, r.w, r.h); } }
        if (cfg.dust && st.open > 0) { g.globalAlpha = cl(+cfg.dust, 0, 0.5) * st.open; g.fillStyle = pat(g, CH.white); g.fillRect(r.x, r.y, r.w, r.h); g.globalAlpha = 1; }
        fx.splats.forEach(sp => drawSplat(g, sp, lt, r)); g.restore(); }
      fx.cracks.forEach((c, ci) => drawCrack(g, c, lt, (q.seed || 3) * 31 + ci * 7));
      const parts = scrFrameParts(q), tot = parts.reduce((m, s2) => m + plen(s2.p), 0); let used = tot * st.draw; parts.forEach(s2 => { const L = plen(s2.p); if (used > 0) line(g, st.draw >= 1 ? s2.p : partial(s2.p, Math.min(1, used / L)), s2.col, s2.w); used -= L; });
      if (q.caption) { const yy = q.style === 'polaroid' ? r.y + r.h + r.w * 0.13 : q.style === 'phone' ? r.y + r.h + r.w * 0.26 : q.style === 'tv' ? r.y + r.h + r.w * 0.17 : r.y + r.h + Math.max(60, r.w * 0.09); text(g, q.caption, r.cx, yy, Math.max(34, Math.min(70, r.w / 14)), q.style === 'polaroid' ? CH.white : CH.yellow, 'center', st.draw); }
      if (fx.sparks || fx.smoke) drawSparks(g, r, fx.sparks, lt, fx.smoke);
      g.restore(); });
  }
  // One picture of a video, filling (cropped to fit) or fitting (whole picture, with bars) a box
  function drawVid(g, ref, tSrc, x, y, w, h, fit) {
    const b = typeof Media !== 'undefined' ? Media.frame(ref.id, Math.max(0, tSrc)) : null;
    if (!b) { g.fillStyle = '#1b2420'; g.fillRect(x, y, w, h); text(g, Media && Media.ready(ref.id) ? 'Loading video' : 'Video not on this computer', x + w / 2, y + h / 2, Math.max(26, Math.min(60, w / 16)), '#ffffff', 'center', 1); return; }
    const ir = b.width / b.height, r = w / h;
    if (fit === 'fit') { g.fillStyle = '#000'; g.fillRect(x, y, w, h); const dw = ir > r ? w : h * ir, dh = ir > r ? w / ir : h; g.drawImage(b, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); return; }
    let sw = b.width, sh = b.height; if (ir > r) sw = b.height * r; else sh = b.width / r; g.drawImage(b, (b.width - sw) / 2, (b.height - sh) / 2, sw, sh, x, y, w, h);
  }
  // Which clips are on screen at time t and how far into each: exports make sure those pictures are ready first
  function mediaAt(cfg, t) { const P = plan(cfg); if (!P.scenes.length) return []; const o = sceneAt(P, t), sc = o.sc, lt = Math.min(Math.max(0, t - o.t0), o.d), out = []; if (sc.type === 'travel') return out;
    if (sc.video && sc.video.id) out.push([sc.video.id, (+sc.video.inPt || 0) + Math.max(0, t - o.t0)]);
    (sc.screens || []).forEach(q => { if (!scrState(q, lt, false)) return; const chans = [q.media, q.media2].filter(m => m && m.id); if (!chans.length) return; const fx = scrFx(sc, q, lt, simScene(sc, o, lt)), ch = fx.chan % chans.length, m = chans[ch]; out.push([m.id, scrSrcT(q, m, ch, fx.chan, fx.chanT, lt)]);
      if (fx.slide && fx.prev != null) { const pc = fx.prev % chans.length, pm = chans[pc]; out.push([pm.id, scrSrcT(q, pm, pc, fx.prev, fx.prevT, lt)]); } }); return out; }
  // Where in the clip a channel is: the first channel starts with the screen, later ones start when switched to
  function scrSrcT(q, m, ch, n, nT, lt) { return (+m.inPt || 0) + Math.max(0, ch === 0 && n === 0 ? lt - (+q.start || 0) - 0.55 : lt - nT); }
  function mediaFor(cfg) { const ids = new Set(); (cfg.scenes || []).forEach(sc => { if (sc.video && sc.video.id) ids.add(sc.video.id); (sc.screens || []).forEach(q => { [q.media, q.media2].forEach(m => { if (m && m.id) ids.add(m.id); }); }); }); return [...ids]; }
  // A throw lands on a screen when the screen is in front of the thrower and within reach
  function scrHitAt(sc, q, sim) { let best = null; const r = scrRect(q); (sc.acts || []).forEach(a => { if (a.k !== 'throw' || !sim || !sim[a.who]) return; const st = sim[a.who], d = r.cx - st.x; if (Math.abs(d) > 1100 || Math.abs(d) < 60) return; const tHit = a.start + a.dur * (0.45 + 0.55 * cl(Math.abs(d) / 800, 0, 1)); if (tHit >= (+q.start || 0) && tHit <= (+q.start || 0) + (+q.dur || 6) && (best == null || tHit < best)) best = tHit; }); return best; }
  // Text list of when each screen is on, for lining the footage up in After Effects
  function screenCues(cfg) { const P = plan(cfg), out = ['Patter Studio B roll timings', '']; const tc = s => { const m = Math.floor(s / 60), x = s - m * 60; return String(m).padStart(2, '0') + ':' + x.toFixed(2).padStart(5, '0'); };
    P.scenes.forEach(o => (o.sc.screens || []).forEach((q, i) => { const a = o.t0 + (+q.start || 0), b = a + (+q.dur || 6), r = scrRect(q); out.push(`Scene ${o.i + 1}, screen ${i + 1}${q.label ? ' (' + q.label + ')' : ''}: picture on ${tc(a + 0.75)}, off ${tc(b - 0.3)}, frame from ${tc(a)} to ${tc(b)}. Hole ${Math.round(r.w)} x ${Math.round(r.h)} px at ${Math.round(r.x)}, ${Math.round(r.y)} on a 1920 x 1080 frame${q.tilt ? ', tilted ' + q.tilt + ' degrees' : ''}.`); }));
    if (out.length === 2) out.push('No screens in this clip yet.'); return out.join('\n'); }

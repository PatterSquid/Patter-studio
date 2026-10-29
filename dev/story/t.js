
  /* ---------- People and screens: banging, kicking, smashing, pishing on, sitting on and getting sucked into the telly ---------- */
  // go: walk up to the screen first (the first 30% of the bar); imp: the moment(s) it lands, as a share of the rest; stand: where to stand
  const SCRACT = {
    bangtv: { go: 1, imp: [0.3, 0.5, 0.7], stand: 'edge' }, kicktv: { go: 1, imp: 0.35, stand: 'edge' }, buttv: { go: 1, imp: 0.42, stand: 'edge' }, smashtv: { go: 1, imp: 0.45, stand: 'edge' },
    pishtv: { go: 1, imp: 0.35, stand: 'near' }, leantv: { go: 1, stand: 'edge' }, sittv: { go: 1, stand: 'centre' }, suckedtv: { go: 1, imp: 0.2, stand: 'front' }, chucktv: { go: 1, imp: 0.45, stand: 'edge' },
    throwtv: { imp: 1 }, fingertv: {}, vsigntv: {}, moontv: {}, shouttv: {}, remote: { imp: 0.5 }, offtv: { imp: 0.5 }, droptv: { imp: 0.25 }, swipetv: { imp: 0.4 },
  };
  const SCRALIAS = { fingertv: 'finger', vsigntv: 'vsign', moontv: 'moon', pishtv: 'pish', shouttv: 'shout', throwtv: 'throw' };
  const THROWABLES = [['bottle', 'Bottle'], ['pint', 'Pint'], ['tea', 'Cup of tea'], ['chips', 'Chips'], ['shoe', 'Shoe'], ['flowers', 'Flowers']];
  const impTimes = a => { const A = SCRACT[a.k]; if (!A || A.imp == null) return []; return [].concat(A.imp).map(f => a.start + a.dur * (A.go ? 0.3 + 0.7 * f : f)); };
  // The screen someone means: the one they picked, or the nearest
  function scrFor(sc, a, x) { const L = sc.screens || []; if (!L.length) return null; return L.find(q => q.id === a.scr) || L.reduce((b, q) => Math.abs((+q.x || 960) - x) < Math.abs((+b.x || 960) - x) ? q : b); }
  // The outside of the chalk frame (not just the hole), so people stand beside it rather than in it
  function scrEdges(q) { const r = scrRect(q), pad = Math.max(14, r.w * 0.03), st = q.style || 'tv';
    if (st === 'tv') return { x0: r.x - pad * 2.2, x1: r.x + r.w + pad * 2.2 + r.w * 0.16, top: r.y - pad * 2, bot: r.y + r.h + pad * 2, r };
    if (st === 'phone') { const p2 = r.w * 0.07; return { x0: r.x - p2, x1: r.x + r.w + p2, top: r.y - p2 * 2.2, bot: r.y + r.h + p2 * 2.2, r }; }
    if (st === 'cinema') return { x0: r.x - pad * 3, x1: r.x + r.w + pad * 3, top: r.y - pad * 2, bot: r.y + r.h + pad * 3, r };
    if (st === 'polaroid') { const p2 = r.w * 0.06; return { x0: r.x - p2, x1: r.x + r.w + p2, top: r.y - p2, bot: r.y + r.h + p2 * 3.2, r }; }
    return { x0: r.x - pad * 1.2, x1: r.x + r.w + pad * 1.2, top: r.y - pad * 1.2, bot: r.y + r.h + pad * 1.2, r }; }
  // Where to stand for an action on a screen
  function scrStand(sc, a, x) { const A = SCRACT[a.k], q = A && A.go ? scrFor(sc, a, x) : null; if (!q) return null; const E2 = scrEdges(q), side = x < E2.r.cx ? -1 : 1;
    const sx = A.stand === 'centre' ? E2.r.cx : A.stand === 'front' ? E2.r.cx + side * Math.min(E2.r.w * 0.3, 0.5 * S) : A.stand === 'near' ? (side < 0 ? E2.x0 - 0.3 * S : E2.x1 + 0.3 * S) : (side < 0 ? E2.x0 - 0.16 * S : E2.x1 + 0.16 * S);
    return { x: cl(sx, -100, WW + 100), q, side, E: E2 }; }

  // Everything that has happened to one screen by time lt: shakes, cracks, static, channel changes, falling, flying off
  function scrFx(sc, q, lt, sim) {
    const fx = { dx: 0, dy: 0, rot: 0, scale: 1, roll: 0, stat: 0, off: false, dead: false, gone: false, cracks: [], splats: [], sparks: 0, smoke: 0, chan: 0, chanT: +q.start || 0, slide: 0, flicker: 0 }; const r = scrRect(q), rr = rng((q.seed || 3) * 29);
    const acts = (sc.acts || []).filter(a => (SCRACT[a.k] || a.k === 'throw') && a.start <= lt).sort((a, b) => a.start - b.start);
    acts.forEach(a => { const who = sim && sim[a.who], x = who ? who.x : 960; if (a.k === 'throw') { if (!who || Math.abs(r.cx - x) > 1100) return; } if (scrFor(sc, a, x) !== q) return;
      const T = a.k === 'throw' ? [a.start + a.dur * (0.45 + 0.55 * cl(Math.abs(r.cx - x) / 800, 0, 1))] : impTimes(a), e = lt - (T[0] != null ? T[0] : a.start), side = x < r.cx ? -1 : 1, hit = (dur, amp) => e >= 0 && e < dur ? (1 - e / dur) * amp : 0;
      if (a.k === 'bangtv') T.forEach(ti => { const e2 = lt - ti; if (e2 >= 0 && e2 < 0.3) { const k = 1 - e2 / 0.3; fx.dx += Math.sin(lt * 80) * 12 * k; fx.dy += 6 * k; } if (e2 >= 0 && e2 < 0.8) fx.roll += (1 - e2 / 0.8) * 0.35; if (e2 >= 0 && e2 < 0.25) fx.stat = Math.max(fx.stat, 0.5 * (1 - e2 / 0.25)); });
      if (a.k === 'kicktv' && e >= 0) { fx.dy -= Math.sin(Math.min(1, e / 0.35) * Math.PI) * 50 * (e < 0.35 ? 1 : 0); fx.rot += hit(0.4, -side * 0.04); if (e < 1.1) fx.stat = Math.max(fx.stat, e < 0.9 ? 0.9 : (1.1 - e) / 0.2 * 0.9); }
      if (a.k === 'buttv' && e >= 0) { fx.dx += hit(0.35, Math.sin(lt * 70) * 16); fx.cracks.push({ x: side < 0 ? r.x + r.w * 0.12 : r.x + r.w * 0.88, y: Math.min(r.y + r.h * 0.85, Math.max(r.y + r.h * 0.15, FL - 0.85 * S)), big: 0.7, t: T[0] }); fx.stat = Math.max(fx.stat, hit(0.5, 0.6)); }
      if (a.k === 'smashtv' && e >= 0) { fx.dx += hit(0.4, Math.sin(lt * 90) * 20); fx.cracks.push({ x: side < 0 ? r.x + r.w * 0.2 : r.x + r.w * 0.8, y: r.y + r.h * 0.35, big: 1.6, t: T[0], shatter: 1 }); fx.dead = true; fx.sparks = Math.max(fx.sparks, e < 2.5 ? 1 : 0.35); fx.smoke = 1; }
      if (a.k === 'throw' || a.k === 'throwtv') { if (e < 0) return; const pr = a.prop || (who && who.thrown) || 'bottle', wet = ['pint', 'tea', 'chips', 'flowers'].includes(pr); fx.dx += hit(0.3, Math.sin(lt * 70) * 10);
        if (wet) fx.splats.push({ x: r.cx + (rr() - 0.5) * r.w * 0.4, y: r.cy - r.h * 0.15 + (rr() - 0.5) * r.h * 0.3, t: T[0], col: pr === 'pint' ? CH.yellow : pr === 'tea' ? CH.brown : pr === 'chips' ? CH.yellow : CH.pink, chips: pr === 'chips' }); else fx.cracks.push({ x: r.cx + (rr() - 0.3) * r.w * 0.3, y: r.cy - r.h * 0.1, big: pr === 'shoe' ? 0.6 : 1, t: T[0] }); }
      if (a.k === 'pishtv' && e >= 0) { const end = a.start + a.dur * 0.95; fx.sparks = Math.max(fx.sparks, lt < end ? 0.8 : 0.3); if (lt > a.start + a.dur * 0.75) { fx.dead = true; fx.smoke = 1; } fx.stat = Math.max(fx.stat, 0.25 + 0.25 * Math.abs(Math.sin(lt * 23))); }
      if (a.k === 'shouttv' && lt < a.start + a.dur) { const w = Math.abs(Math.sin(lt * 16)); fx.dx += Math.sin(lt * 31) * 6 * w; fx.scale *= 1 + 0.012 * w; }
      if (a.k === 'remote' && e >= 0) { if (fx.off) { fx.off = false; fx.offT = null; } else { fx.chan++; fx.chanT = T[0]; } if (e < 0.35) fx.stat = Math.max(fx.stat, 1 - e / 0.35 * 0.6); }
      if (a.k === 'offtv' && e >= 0) { fx.off = true; fx.offT = T[0]; }
      if (a.k === 'swipetv' && e >= 0 && !fx.off) { const pc = fx.chan, pT = fx.chanT; fx.chan++; fx.chanT = T[0]; if (e < 0.5) { fx.slide = side < 0 ? 1 : -1; fx.slideK = Math.sin(e / 0.5 * Math.PI / 2); fx.prev = pc; fx.prevT = pT; } else { fx.slide = 0; fx.prev = null; } }
      if (a.k === 'suckedtv') { const k0 = a.start + a.dur * (0.3 + 0.7 * 0.2), k1 = a.start + a.dur * 0.93; if (lt >= k0 && lt <= k1) { fx.flicker = 1; fx.stat = Math.max(fx.stat, 0.15 + 0.35 * Math.abs(Math.sin(lt * 13))); fx.scale *= 1 + 0.03 * Math.sin(lt * 9); } }
      if (a.k === 'droptv' && e >= 0) { const fall = Math.min(1, (e / 0.55) * (e / 0.55)), floorY = FL - 6 - (scrEdges(q).bot - r.cy) * 0.35; fx.dy += (floorY - r.cy) * fall; fx.rot += side * 0.0 + (e < 0.55 ? 0.3 * fall : 0.3 + Math.sin(Math.min(1, (e - 0.55) / 0.3) * Math.PI) * 0.06); fx.scale *= 1 - 0.35 * fall; if (e >= 0.55) { fx.cracks.push({ x: r.cx, y: r.cy, big: 1.4, t: T[0] + 0.55 }); fx.dead = true; } }
      if (a.k === 'chucktv' && e >= 0) { const f = Math.min(1, e / 0.9); fx.dx += -side * 2300 * f; fx.dy += -Math.sin(f * Math.PI) * 320; fx.rot += -side * f * 6; if (f >= 1) fx.gone = true; }
      if (a.k === 'sittv' && who) { const land = a.start + a.dur * 0.62; if (lt >= land && lt < land + 0.3) fx.dy += (1 - (lt - land) / 0.3) * 10; }
    });
    if (fx.off && fx.offT != null && lt - fx.offT < 0.45) fx.offK = (lt - fx.offT) / 0.45; return fx;
  }
  // Old telly snow: grey specks and a few bright scan lines over the picture
  function drawStatic(g, r, k, t) { if (k <= 0) return; const rr = rng(Math.floor(t * 24) * 7 + 3); g.save(); g.globalAlpha *= cl(k, 0, 1); g.fillStyle = '#9a9a9a'; g.fillRect(r.x, r.y, r.w, r.h);
    const cs = Math.max(6, r.w / 60); for (let y = r.y; y < r.y + r.h; y += cs) for (let x = r.x; x < r.x + r.w; x += cs) { const v = rr(); if (v < 0.5) { g.fillStyle = v < 0.25 ? '#1a1a1a' : '#e8e8e8'; g.fillRect(x, y, cs, cs); } }
    g.globalAlpha *= 0.6; g.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) g.fillRect(r.x, r.y + rr() * r.h, r.w, 3 + rr() * 6); g.restore(); }
  // A broken or switched off screen: dark glass with a chalk glint
  function drawDeadGlass(g, r) { g.fillStyle = '#101614'; g.fillRect(r.x, r.y, r.w, r.h); line(g, [[r.x + r.w * 0.12, r.y + r.h * 0.25], [r.x + r.w * 0.3, r.y + r.h * 0.12]], '#5a6a64', 4); line(g, [[r.x + r.w * 0.14, r.y + r.h * 0.4], [r.x + r.w * 0.42, r.y + r.h * 0.18]], '#4a5a54', 3); }
  function drawCrack(g, c, lt, seed) { const k = cl((lt - c.t) / 0.12, 0, 1); if (k <= 0) return; const rr = rng(seed), n = c.shatter ? 14 : 9, R = 120 * c.big;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rr() * 0.4, L = R * (0.5 + rr() * 0.9) * k, pts = [[c.x, c.y]]; for (let j = 1; j <= 3; j++) pts.push([c.x + Math.cos(a + (rr() - 0.5) * 0.35) * L * j / 3, c.y + Math.sin(a + (rr() - 0.5) * 0.35) * L * j / 3]); line(g, pts, CH.white, 3); }
    for (let ring = 1; ring <= (c.shatter ? 3 : 2); ring++) { const rad = R * 0.28 * ring * k, pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([c.x + Math.cos(a) * rad * (0.8 + rr() * 0.4), c.y + Math.sin(a) * rad * (0.8 + rr() * 0.4)]); } line(g, pts, CH.white, 2.5); }
    if (c.shatter) { const e = lt - c.t; if (e < 1.2) for (let i = 0; i < 10; i++) { const x = c.x + (rr() - 0.5) * R * 1.6 + (rr() - 0.5) * e * 200, y = c.y + (rr() - 0.3) * R + e * e * 900; line(g, [[x, y], [x + 14, y + 6], [x + 4, y + 18], [x, y]], CH.white, 3); } } }
  function drawSplat(g, s, lt, r) { const e = lt - s.t; if (e < 0) return; const k = cl(e / 0.1, 0, 1), drip = Math.min(r.y + r.h - s.y - 10, e * 60), rr = rng(Math.round(s.x * 7 + s.y));
    if (s.chips) { for (let i = 0; i < 9; i++) { const a = rr() * Math.PI * 2, d = 20 + rr() * 70 * k, x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d * 0.6 + Math.min(drip, e * 120 * rr()); line(g, [[x - 12, y - 4], [x + 12, y + 4]], CH.yellow, 6); } return; }
    const pts = []; for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2, rad = (40 + (i % 2 ? 34 : 0) * rr()) * k; pts.push([s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad * 0.7]); } g.save(); g.globalAlpha *= 0.55; fillPoly(g, pts, s.col); g.restore(); line(g, pts, s.col, 4);
    for (let i = 0; i < 4; i++) { const x = s.x - 30 + i * 20 + rr() * 8, len = drip * (0.4 + rr() * 0.8); line(g, [[x, s.y + 20], [x, s.y + 20 + len]], s.col, 5); line(g, circP(x, s.y + 24 + len, 5, 6), s.col, 4); } }
  function drawSparks(g, r, k, lt, smoke) { const rr = rng(Math.floor(lt * 18)); if (k > 0) for (let i = 0; i < Math.round(8 * k); i++) { const x = r.x + rr() * r.w, y = r.y + rr() * r.h * 0.3 + (rr() < 0.5 ? 0 : r.h * 0.7), a = rr() * Math.PI * 2, L = 18 + rr() * 30; line(g, [[x, y], [x + Math.cos(a) * L, y + Math.sin(a) * L]], rr() < 0.5 ? CH.yellow : CH.white, 3); }
    if (smoke) for (let i = 0; i < 4; i++) { const q = (lt * 0.35 + i / 4) % 1; g.save(); g.globalAlpha *= 0.5 * (1 - q); line(g, circP(r.cx + Math.sin(q * 6 + i) * 40, r.y - q * 260, 30 + q * 50, 24 + q * 40), CH.grey, 4); g.restore(); } }

  // Poses for the screen actions; p is the share of the bar after walking up
  function poseScreen(Q, st, a, p, e, P) {
    const q = scrFor(P.sc, a, st.x); if (!q) return; const E2 = scrEdges(q), r = E2.r, front = Q.dir, back = -Q.dir, lift = (pp, a2, b2) => pp < a2 ? io(pp / a2) : pp > b2 ? 1 - io((pp - b2) / (1 - b2)) : 1;
    // Turn a point in the world into a hand target (from the shoulder)
    const toward = (wx, wy, reach = 0.32) => { const sx = Q.x, sy = FL - 0.73 * S - (Q.hop || 0), dx = wx - sx, dy = wy - sy, d = Math.hypot(dx, dy) || 1, m = Math.min(1, reach * S / d); return [dx * m, dy * m]; };
    const edgeX = Q.x < r.cx ? E2.x0 : E2.x1;
    switch (a.k) {
      case 'bangtv': { Q.mood = 'angry'; const hits = SCRACT.bangtv.imp; let up = 0; hits.forEach(h => { const d = p - h; if (d > -0.12 && d < 0.06) up = Math.max(up, d < 0 ? 1 + d / 0.12 : 1 - d / 0.06); }); const tgt = toward(edgeX, Math.max(E2.top + 30, FL - 0.95 * S)); Q.hands[front] = [tgt[0], tgt[1] - 0.12 * S * up]; Q.lean = 0.25; Q.talk = p > 0.25; if (p > 0.25 && p < 0.85) Q.fx.push({ k: 'word', s: 'BANG!', p: ((p - 0.25) * 3) % 1, at: 'front', col: CH.white }); break; }
      case 'kicktv': { const I = SCRACT.kicktv.imp, k = p < I ? io(p / I) : p < I + 0.1 ? 1 : 1 - io(cl((p - I - 0.1) / 0.15, 0, 1)); Q.kickF = k; Q.lean = -0.25 * k; Q.mood = 'angry';
        if (p > I + 0.1) { const h = p - I - 0.1; Q.hop = Math.abs(Math.sin(h * 30)) * 26; Q.kick = 0.22 * S; Q.lower = 0.25; [-1, 1].forEach(sd => Q.hands[sd] = [front * 0.12 * S, 0.36 * S]); Q.mood = 'sad'; Q.eyes = 'shut'; if (h < 0.4) Q.fx.push({ k: 'word', s: 'OYAH!', p: h / 0.4, at: 'head', col: CH.red }); } Q.fast = p > I - 0.1 && p < I + 0.1; break; }
      case 'buttv': { const I = SCRACT.buttv.imp, wind = p < I ? io(p / I) : 0, after = p >= I ? p - I : 0; Q.lean = p < I - 0.08 ? -0.5 * wind : p < I ? lerp(-0.5 * wind, 1.6, io((p - I + 0.08) / 0.08)) : Math.max(-0.4, 1.6 - after * 8); Q.hdx = p < I ? 0 : front * Math.max(0, 14 - after * 60); Q.mood = 'angry';
        if (p >= I) { Q.x -= front * 40 * io(Math.min(1, after * 3)); Q.tilt = Math.sin(e * 12) * 0.15; Q.eyes = after < 0.4 ? 'x' : null; Q.emote = after < 0.5 ? { k: 'stars', p } : null; if (after < 0.25) Q.fx.push({ k: 'word', s: 'BOSH!', p: after / 0.25, at: 'front', col: CH.yellow }); } Q.fast = Math.abs(p - I) < 0.08; break; }
      case 'smashtv': { const I = SCRACT.smashtv.imp, w = holding(st, ['bottle', 'axe', 'sword', 'gun', 'rifle']) || 'bottle'; Q.hold = p < I + 0.05 || w !== 'bottle' ? { prop: w, side: front } : null; Q.ap = Q.hold ? w : null;
        const up = p < I ? io(p / I) : 0, down = p >= I ? Math.min(1, (p - I) / 0.08) : 0, tgt = toward(edgeX, r.y + r.h * 0.4, 0.33); Q.hands[front] = p < I ? [front * 0.05 * S, lerp(0.2, -0.33, up) * S] : [lerp(front * 0.05 * S, tgt[0], down), lerp(-0.33 * S, tgt[1], down)]; Q.bladeA = p < I ? -1.4 : 0.6; Q.mood = 'angry'; Q.lean = p >= I ? 0.4 : -0.15 * up;
        if (p >= I && p < I + 0.15 && w === 'bottle') Q.fx.push({ k: 'shards', p: (p - I) / 0.15 }); if (p >= I && p < I + 0.25) Q.fx.push({ k: 'word', s: 'SMASH!', p: (p - I) / 0.25, at: 'front', col: CH.yellow }); Q.fast = Math.abs(p - I) < 0.08; break; }
      case 'leantv': { const k = lift(p, 0.15, 0.92), tgt = toward(edgeX + (Q.x < r.cx ? 6 : -6), Math.max(E2.top + 20, FL - 1.05 * S), 0.33); Q.hands[front] = [lerp(front * 0.07 * S, tgt[0], k), lerp(0.31 * S, tgt[1], k)]; Q.tilt = 0.12 * k * front; Q.wide = 1 - 0.7 * k; Q.mood = 'happy'; Q.hands[back] = [back * 0.04 * S, lerp(0.31, 0.2, k) * S]; break; }
      case 'sittv': { const top = E2.top, sitH = FL - 0.06 * S, perch = Math.max(0, sitH - top), j = cl((p - 0.15) / 0.4, 0, 1); Q.x = lerp(st.walkTo != null ? st.walkTo : Q.x, r.cx, 0); Q.hop = perch * io(j) + Math.sin(j * Math.PI) * 60; Q.sit = io(cl((j - 0.6) / 0.4, 0, 1)); Q.lowSit = true; if (j < 1) [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.15 * S, lerp(0.3, -0.2, Math.sin(j * Math.PI)) * S]); Q.mood = 'happy'; break; }
      case 'suckedtv': { const I = SCRACT.suckedtv.imp, k = cl((p - I) / 0.3, 0, 1), out2 = cl((p - 0.88) / 0.12, 0, 1), inside = p > I + 0.3 && p < 0.88, cy = r.cy;
        if (p < I) { Q.lean = -0.4 * io(p / I); Q.mood = 'shock'; Q.emote = { k: '!' }; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.18 * S, -0.1 * S]); }
        else if (!inside && out2 === 0) { Q.x = lerp(Q.x, r.cx, io(k)); Q.hop = (FL - 0.45 * S - cy) * io(k); Q.shrink = 1 - 0.8 * io(k); Q.spin = k * 5; Q.kick = Math.abs(Math.sin(e * 20)) * 0.2 * S; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.2 * S, -0.25 * S]); Q.mood = 'shock'; if (k < 0.6) Q.fx.push({ k: 'word', s: 'AAAAH!', p: k / 0.6, at: 'head', col: CH.white }); }
        else if (inside) { Q.hidden = true; }
        else { const b = io(out2); Q.x = lerp(r.cx, st.x, b); Q.hop = (FL - 0.45 * S - cy) * (1 - b) + Math.sin(b * Math.PI) * 80; Q.shrink = 0.2 + 0.8 * b; Q.spin = (1 - b) * -4; Q.mood = 'shock'; Q.eyes = 'x'; Q.emote = { k: 'stars', p }; } Q.fast = !inside; break; }
      case 'chucktv': { const I = SCRACT.chucktv.imp, tgt = toward(edgeX, r.cy, 0.33); if (p < I) { const k = io(p / I); [-1, 1].forEach(sd => Q.hands[sd] = [lerp(sd * 0.07 * S, tgt[0], k), lerp(0.31 * S, tgt[1] + sd * 10, k)]); Q.lean = -0.2 * k; Q.lower = 0.3 * k; Q.mood = 'angry'; }
        else { const k = Math.min(1, (p - I) / 0.12); [-1, 1].forEach(sd => Q.hands[sd] = [lerp(tgt[0], -front * 0.1 * S, k), lerp(tgt[1], -0.32 * S, k)]); Q.lean = lerp(-0.2, 0.5, k); Q.mood = 'happy'; if (p > I + 0.15) Q.emote = { k: 'stars', p }; } Q.fast = Math.abs(p - I) < 0.1; break; }
      case 'remote': case 'offtv': { const k = lift(p, 0.2, 0.85), clk = Math.abs(p - SCRACT[a.k].imp) < 0.05 ? 1 : 0, tgt = toward(r.cx, r.cy, 0.32); Q.hold = { prop: 'remote', side: front }; Q.ap = 'remote'; Q.hands[front] = [lerp(front * 0.12 * S, tgt[0], k), lerp(0.2 * S, tgt[1], k) - clk * 6]; if (a.k === 'offtv' && p > 0.5) { const q2 = io(cl((p - 0.5) / 0.15, 0, 1)); Q.mood = 'angry'; Q.hands[back] = [lerp(back * 0.07, front * 0.05, q2) * S, lerp(0.31, 0.14, q2) * S]; } break; }
      case 'droptv': { const k = out3(Math.min(1, p * 4)); Q.mood = 'shock'; Q.hop = Math.sin(Math.min(1, p * 3) * Math.PI) * 18; [-1, 1].forEach(sd => Q.hands[sd] = [sd * 0.05 * S, lerp(0.31, -0.12, k) * S]); Q.emote = { k: '!' }; if (p > 0.45 && p < 0.8) Q.fx.push({ k: 'word', s: 'NAW!', p: (p - 0.45) / 0.35, at: 'head', col: CH.red }); break; }
      case 'swipetv': { const I = SCRACT.swipetv.imp, k = p < I ? io(p / I) : 1 - io(cl((p - I) / 0.5, 0, 1)), sw = cl((p - I + 0.1) / 0.15, 0, 1); Q.hands[front] = [front * lerp(0.1, 0.3, k) * S + front * lerp(-0.12, 0.14, sw) * S * cl((k - 0.35) / 0.3, 0, 1), lerp(0.25, -0.05, k) * S]; Q.mood = 'angry'; Q.tilt = -0.08 * front * k; break; }
    }
  }

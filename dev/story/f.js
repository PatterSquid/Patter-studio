
  /* ---------- Drawing a frame ---------- */
  function draw(g, t, cfg, look, W, H) {
    BOARD = BOARDS[cfg.board] || BOARDS.green; POP = cfg.pop !== false; GORE = cfg.gore || 'cartoon'; SETA = POP ? (cfg.bgStrength != null ? cl(cfg.bgStrength, 0.2, 1) : 0.6) : 1; const P = plan(cfg), u = Math.min(W, H) / 1080;
    // With screens, a transparent export keeps the board and only the screen holes go see-through
    const holes = look.transparent && P.scenes.some(o2 => (o2.sc.screens || []).length), solid = !look.transparent || holes;
    // A scene can sit on your own video instead of the board: chalk drawn straight over the footage
    const o0 = P.scenes.length ? sceneAt(P, t) : null, vbg = o0 && o0.sc.type !== 'travel' && o0.sc.video && o0.sc.video.id ? o0.sc.video : null; EDGE = !!vbg && vbg.edge !== false; if (vbg) { POP = false; SETA = 1; }
    if (vbg) { drawVid(g, vbg, (+vbg.inPt || 0) + Math.max(0, t - o0.t0), 0, 0, W, H, vbg.fit || 'fill'); if (+vbg.dim) { g.fillStyle = 'rgba(0,0,0,' + cl(+vbg.dim, 0, 0.7) + ')'; g.fillRect(0, 0, W, H); } } else if (solid) g.drawImage(boardTex(W, H, BOARD), 0, 0); E.behind(g);
    if (!P.scenes.length) { if (cfg.frame && solid) frameDraw(g, W, H, u); return; }
    const o = sceneAt(P, t), lt = Math.max(0, t - o.t0), sc = o.sc;
    if (sc.type === 'travel') { const v = viewOf(cfg, o, lt, W, H, null); g.save(); g.translate(W / 2, H / 2); g.scale(v.ws, v.ws); g.translate(-v.cx, -v.cy); drawTrip(g, sc, Math.min(lt, o.d)); g.restore(); }
    else drawSceneAt(g, cfg, o, Math.min(lt, o.d), W, H, look);
    // The duster wipes the board between scenes
    if (sc.type !== 'travel' && lt < INTRO) prebake(o.set, bakeK(o, viewOf(cfg, o, 0, W, H, null).k)); { const nx = P.scenes.slice(o.i + 1).find(x => x.sc.type !== 'travel'); if (nx && lt > Math.min(o.d * 0.5, 3)) prebake(nx.set, bakeK(nx, viewOf(cfg, nx, 0, W, H, null).k)); }
    if (o.out && lt > o.d) { const q = io((lt - o.d) / OUT), bx = lerp(-260 * u, W + 260 * u, q); if (solid) g.drawImage(boardTex(W, H, BOARD), 0, 0, Math.max(1, bx), H, 0, 0, Math.max(1, bx), H); else g.clearRect(0, 0, Math.max(1, bx), H);
      g.save(); g.globalAlpha = 0.12; g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) g.fillRect(bx - (180 + i * 60) * u, 0, 40 * u, H); g.restore(); g.save(); g.translate(bx, H * 0.5 + Math.sin(q * 18) * 120 * u); g.fillStyle = '#8a5a30'; g.fillRect(-60 * u, -130 * u, 120 * u, 260 * u); g.fillStyle = '#3a3a44'; g.fillRect(-60 * u, -130 * u, 30 * u, 260 * u); g.restore(); }
    if (cfg.frame && solid && !vbg) frameDraw(g, W, H, u);
  }
  function drawSceneAt(g, cfg, o, lt, W, H, look) {
    const sc = o.sc, set = o.set, sim = simScene(sc, o, lt), v = viewOf(cfg, o, lt, W, H, sim), u = Math.min(W, H) / 1080, wtr = set.water;
    g.save(); g.translate(W / 2, H / 2); g.scale(v.ws, v.ws); g.translate(-v.cx, -v.cy);
    // Paused in the editor the whole scene shows at once, so every change is visible straight away; playing and exports draw it in
    const rev = look && look.paused ? 1 : cl(lt / INTRO, 0, 1);
    if (sc.weather === 'night') { g.save(); const L = []; for (let i = 0; i < 40; i++) { const r = rng(i * 13)(), r2v = rng(i * 7 + 1)(); L.push(circP(r * WW, 60 + r2v * 360, 2, 2, 0, 6.3, 6)); } lines(g, L, CH.white, 3); line(g, circP(1650, 160, 50, 50, -1.2, 1.9, 16), CH.yellow, 5); g.restore(); }
    if (rev < 1) drawSetLive(g, set, rev, 'back'); else g.drawImage(baked(set, 'back', bakeK(o, v.k)), 0, 0, WW, WH);
    // Flashing lights from pack places (an alarm, a siren on the wall)
    if (set.blink && rev >= 1) set.blink.forEach(b => { if (b.on && !(sc.acts || []).some(a => PACK.acts[a.k] && PACK.acts[a.k].trigger === b.on && lt >= a.start + a.dur * 0.45)) return; if (Math.floor(lt / b.every) % 2) return; g.save(); g.globalAlpha *= 0.85; fillPoly(g, circP(b.x, b.y, b.r, b.r), b.col); g.globalAlpha *= 0.35; fillPoly(g, circP(b.x, b.y, b.r * 2.6, b.r * 2.6), b.col); g.restore(); });
    g.save(); g.globalAlpha *= SETA; drawAnim(g, set, lt, sc); g.restore();
    if (sc.weather === 'sunny' && !set.back.some(s => s.col === CH.yellow && s.p.length > 20 && s.p[0][1] < 300)) line(g, circP(1700, 170, 56, 56), CH.yellow, 6);
    if (sc.weather === 'rain') { const r = rng(9); g.save(); g.globalAlpha *= cl(rev * 2 - 0.6, 0, 1); const L = []; for (let i = 0; i < 120; i++) { const x = r() * WW, sp = 600 + r() * 300, y = ((r() * WH + lt * sp) % (FL - 60)); L.push([[x, y], [x - 8, y + 26]]); } lines(g, L, CH.blue, 3); g.restore(); [[300, 130], [880, 100], [1500, 140]].forEach(([x, y]) => line(g, [[x - 150, y + 40], [x - 130, y], [x - 60, y - 30], [x + 10, y - 20], [x + 60, y - 50], [x + 130, y - 10], [x + 160, y + 40], [x - 150, y + 40]], CH.grey, 5)); }
    if (sc.weather === 'snow' || sc.region === 'antarctica') { const r = rng(4); const L = []; for (let i = 0; i < 60; i++) { const x = (r() * WW + lt * 20) % WW, y = (r() * WH + lt * (60 + r() * 40)) % FL; L.push(circP(x, y, 3, 3, 0, 6.3, 7)); } lines(g, L, CH.white, 3); }
    drawWater(g, wtr, lt, false);
    drawScreens(g, cfg, sc, lt, look, sim);
    // Everyone: behind the desk first, then the desk front, then everyone else, then the water in front of swimmers
    const list = sc.people.map(pe => ({ pe, ch: o.cast[pe.pid] || { i: 0, name: '?', colour: 'white', sex: 'man' }, st: sim[pe.pid] })).filter(x => x.st);
    const drawn = [];
    // No rubbed-out patch where someone stands over a screen, so the key green and see-through holes stay clean
    const holesR = (sc.screens || []).filter(q => scrState(q, lt, true)).map(scrRect);
    const drawC = it => { const Q = poseOf(it.ch, it.st, lt, o); if (holesR.length) Q.noHalo = holesR.some(r => Q.x > r.x - 0.3 * S && Q.x < r.x + r.w + 0.3 * S && FL - (Q.hop || 0) - S < r.y + r.h && FL - (Q.hop || 0) > r.y); if (Q.x < -260 || Q.x > WW + 260 || Q.hidden) { if (Q.hidden) { Q.fx.filter(f => f.k === 'brawl').forEach(f => brawlCloud(g, f, lt)); Q.fx.filter(f => f.k === 'splash').forEach(f => drawSplash(g, f, wtr ? wtr.y : FL, lt)); if (wtr) for (let i = 0; i < 3; i++) { const by = wtr.y - ((lt * 90 + i * 30) % 70); line(g, circP(Q.x + Math.sin(lt * 6 + i) * 12, by, 6 + i * 2, 6 + i * 2, 0, 6.3, 10), CH.white, 3); } } drawn.push({ it, Q, F: null }); return; }
      g.save(); const clipW = Q.inWater && wtr; if (clipW) { g.beginPath(); g.rect(-400, -400, WW + 800, wtr.y + 400 + 8); g.clip(); }
      const sz = it.pe.size || 1; if (sz !== 1) { g.translate(Q.x, FL); g.scale(sz, sz); g.translate(-Q.x, -FL); }
      if (Q.shrink && Q.shrink !== 1) { const py = FL - (Q.hop || 0) - 0.45 * S; g.translate(Q.x, py); g.scale(Q.shrink, Q.shrink); g.translate(-Q.x, -py); }
      const lying = Q.rot > 0.001, rotA = lying ? (Q.lieSide != null ? Q.lieSide : Q.fallBack ? -Q.dir : Q.dir) * Q.rot * Math.PI / 2 : Q.diveA ? Q.dir * Q.diveA : Q.spin ? Q.dir * Q.spin : 0;
      if (rotA) { const px = Q.x, py = Q.diveA || Q.spin ? FL - 0.43 * S - (Q.hop || 0) : FL; g.translate(px, py); g.rotate(rotA); g.translate(-px, -py); }
      const F = figure(g, it.ch, Q, lt, 1), front = Q.dir, back = -Q.dir;
      // Props sit in the hand that grips them; carried bags go on the floor when someone sits or lies down
      Object.keys(Q.grips).forEach(pr => { const G = GRIP[pr] || {}, mine = pr === Q.ap; let hand = F.hands[Q.grips[pr]]; if (!hand) return;
        if (G.carry && (Q.sit > 0.5 || Q.rot > 0.5)) hand = [F.hip[0] + back * 0.2 * S, FL - 64];
        const blade = pr === 'sword' || pr === 'axe' || pr === 'spear' || pr === 'torch', ang = mine ? (blade ? (Q.bladeA != null ? Q.bladeA : (Q.hold && Q.hold.a != null ? Q.hold.a : 0)) : pr === 'gun' || pr === 'rifle' ? (Q.aimUp || 0) : 0) : (G.a || 0);
        if (Q.swimming && pr !== 'phone') return; propDraw(g, pr, hand, Q.dir, lt, ang); const tall = { umbrella: 230, flag: 255, sign: 275, spear: 300 }[pr]; if (tall && !mine) F.top = Math.min(F.top, hand[1] - tall); });
      if (Q.rot > 0.5 && !Q.swimming) Q.props.filter(pr => Q.grips[pr] == null).forEach((pr, i) => { if (GRIP[pr] && GRIP[pr].carry) propDraw(g, pr, [F.hip[0] + back * (0.25 + i * 0.1) * S, FL - 64], Q.dir, lt, 0); else if (i === 0) propDraw(g, pr, F.hands[front], Q.dir, lt, (GRIP[pr] || {}).a || 0); });
      Q.col = it.ch.colour; Q.fx.forEach(f => { if (f.k !== 'splash') drawFx(g, f, F, Q, lt); });
      // The optional CENSORED badge, slapped over the rude bit
      const ra = it.st.active && it.st.active.a; if (Q.rudeAt && ra && (ra.cover === true || (ra.cover !== false && cfg.cover)) && Q.rudeK > 0.25) { const spots = Q.rudeAt === 'hands' ? Object.keys(Q.fingers || {}).map(sd => F.hands[sd]).filter(Boolean) : Q.rudeAt === 'bum' ? [[F.hip[0] - Q.dir * 0.08 * S, F.hip[1] + 0.03 * S]] : [[F.hip[0] + Q.dir * 0.16 * S, F.hip[1] + 0.12 * S]];
        if (spots.length) { const cx = spots.reduce((m, q) => m + q[0], 0) / spots.length, cy = spots.reduce((m, q) => m + q[1], 0) / spots.length - (Q.rudeAt === 'hands' ? 16 : 0), kk = out3(cl((Q.rudeK - 0.25) / 0.3, 0, 1)), w2 = Q.rudeAt === 'crotch' ? 230 : 190;
          g.save(); g.translate(cx, cy); g.rotate(-0.12 + Math.sin(lt * 3) * 0.02); g.scale(kk, kk); g.fillStyle = '#121212'; g.fillRect(-w2 / 2, -30, w2, 60); g.strokeStyle = CH.white; g.lineWidth = 4; g.strokeRect(-w2 / 2, -30, w2, 60); g.font = `900 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = CH.red; g.fillText('CENSORED', 0, 2); g.restore(); } } emote(g, Q.emote, F, lt); g.restore(); if (Q.emote && Q.emote.k === 'ghost') ghostDraw(g, Q.x + (Q.lieSide || -Q.dir) * 0.35 * S, FL - 150, Q.emote.q, lt);
      Q.fx.filter(f => f.k === 'splash').forEach(f => drawSplash(g, f, wtr ? wtr.y : FL, lt)); const mp = q => [Q.x + (q[0] - Q.x) * sz, FL + (q[1] - FL) * sz]; drawn.push({ it, Q, F: sz === 1 ? F : Object.assign({}, F, { hc: mp(F.hc), top: FL + (F.top - FL) * sz, hr: F.hr * sz }) }); };
    const isBehind = it => it.st.behind && !(it.st.active && MOVES.includes(it.st.active.a.k));
    list.filter(isBehind).forEach(drawC);
    if (rev < 1) drawSetLive(g, set, rev, 'front'); else g.drawImage(baked(set, 'front', bakeK(o, v.k)), 0, 0, WW, WH);
    list.filter(it => !isBehind(it)).forEach(drawC);
    drawWater(g, wtr, lt, true);
    // Speech, thoughts and phone calls
    drawn.forEach(d => { const a = d.it.st.active; if (!d.F || !a || !TALK.includes(a.a.k) || !(a.a.text || '').trim()) return; const sw = a.a.swear || cfg.swear || 'show'; bubble(g, { t0: a.a.start, d: a.a.dur, text: sw === 'beep' ? beep(a.a.text) : a.a.text, scribble: sw === 'scribble', how: a.a.k === 'say' || a.a.k === 'phone' ? 'say' : a.a.k === 'shouttv' ? 'shout' : a.a.k, seed: a.a.start * 10 | 0 }, d.F, lt, { x0: v.x0, x1: v.x1, y0: v.y0 }); });
    g.restore();
    // Screen text: the place name, captions, time jumps
    const lab = sc.label; if (lab) { const x = (H > W ? 60 : 80) * u, y = (H > W ? 140 : 96) * u; const pz = look && look.paused; text(g, lab, x, y, 50 * u, CH.yellow, 'left', pz ? 1 : cl(lt / 0.9, 0, 1)); const tw = measure(lab, 50 * u); line(g, partial([[x, y + 32 * u], [x + tw, y + 28 * u]], pz ? 1 : cl((lt - 0.5) / 0.6, 0, 1)), CH.yellow, 4 * u); }
    (sc.extra || []).forEach(a => { if (lt < a.start || lt >= a.start + a.dur) return; const p = (lt - a.start) / a.dur;
      if (a.k === 'caption') text(g, a.text || '', W / 2, (H > W ? 330 : 250) * u, 58 * u, CH.white, 'center', cl((lt - a.start) / Math.max(0.6, (a.text || '').length * 0.04), 0, 1));
      if (a.k === 'timejump') { const al = Math.min(cl(p / 0.15, 0, 1), cl((1 - p) / 0.15, 0, 1)), cx = W / 2, cy = H / 2 - 160 * u; g.save(); g.globalAlpha = 0.85 * al; g.fillStyle = BOARD; g.fillRect(0, 0, W, H); g.globalAlpha = al; text(g, a.text || '', W / 2, H / 2, 96 * u, CH.yellow, 'center', cl(p / 0.4, 0, 1)); line(g, circP(cx, cy, 60 * u, 60 * u), CH.white, 6 * u); line(g, [[cx, cy], [cx + Math.cos(p * 12) * 44 * u, cy + Math.sin(p * 12) * 44 * u]], CH.yellow, 5 * u); line(g, [[cx, cy], [cx + Math.cos(p * 1.2 - 1.57) * 30 * u, cy + Math.sin(p * 1.2 - 1.57) * 30 * u]], CH.white, 6 * u); g.restore(); } });
  }

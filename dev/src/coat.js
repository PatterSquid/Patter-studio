/* Coat: the cartoon Coatbridge for the intro cut scenes. Everything is drawn in a 1920x1080 world (call inside a
   g.scale(W / 1920)), as flat cartoon shapes with dark outlines, night colours and sodium orange light, like the
   studio's outside gags. Made up names only: no real shops, bus firms or brands. Pure functions of their inputs. */
const Coat = (() => {
  const OUT = '#14141c';
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  function line(g, w) { g.lineWidth = w || 5; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round'; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function sky(g) { const s = g.createLinearGradient(0, 0, 0, 700); s.addColorStop(0, '#0d1220'); s.addColorStop(0.7, '#2a2a3a'); s.addColorStop(1, '#5a3c2e'); g.fillStyle = s; g.fillRect(0, 0, 1920, 760);
    // low cloud with the town's orange glow under it
    g.fillStyle = 'rgba(70,60,70,0.55)'; const r = rng(3); for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(r() * 1920, 60 + r() * 200, 160 + r() * 200, 40 + r() * 40, 0, 0, Math.PI * 2); g.fill(); } }
  function sign(g, x, y, w, h, bg, fg, text, font, glow) { rr(g, x, y, w, h, 6); g.fillStyle = bg; g.fill(); line(g, 5); g.stroke();
    g.save(); if (glow) { g.shadowColor = glow; g.shadowBlur = 18; } g.fillStyle = fg; g.font = font || `900 ${Math.round(h * 0.62)}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = parseInt(g.font.match(/(\d+)px/)[1]); while (g.measureText(text).width > w * 0.9 && fs > 8) { fs -= 2; g.font = g.font.replace(/\d+px/, fs + 'px'); } g.fillText(text, x + w / 2, y + h / 2 + 2); g.restore(); }
  function shutter(g, x, y, w, h, tag) { g.fillStyle = '#6e7178'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; for (let yy = y + 14; yy < y + h; yy += 16) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); } line(g, 5); g.strokeRect(x, y, w, h);
    if (tag) { g.save(); g.font = 'italic 900 52px "Comic Sans MS", "Segoe Print", cursive'; g.lineWidth = 10; g.strokeStyle = '#1b1b25'; g.fillStyle = tag[1]; g.translate(x + w / 2, y + h * 0.55); g.rotate(-0.08); g.textAlign = 'center'; g.strokeText(tag[0], 0, 0); g.fillText(tag[0], 0, 0); g.restore(); } }
  function lamp(g, x, ground, h, on = 1) { line(g, 5); g.fillStyle = '#3a3d46'; g.fillRect(x - 7, ground - h, 14, h); g.strokeRect(x - 7, ground - h, 14, h); g.beginPath(); g.moveTo(x, ground - h); g.quadraticCurveTo(x + 10, ground - h - 40, x + 70, ground - h - 40); g.lineWidth = 12; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#3a3d46'; g.stroke();
    rr(g, x + 50, ground - h - 50, 60, 22, 8); g.fillStyle = '#2a2c33'; g.fill(); line(g, 4); g.stroke();
    if (on) { const lg = g.createRadialGradient(x + 80, ground - h - 30, 5, x + 80, ground - h + 150, 520); lg.addColorStop(0, `rgba(255,170,70,${0.55 * on})`); lg.addColorStop(1, 'rgba(255,150,60,0)'); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = lg; g.beginPath(); g.moveTo(x + 55, ground - h - 28); g.lineTo(x + 105, ground - h - 28); g.lineTo(x + 330, ground); g.lineTo(x - 170, ground); g.closePath(); g.fill(); g.restore(); g.fillStyle = '#ffd890'; rr(g, x + 56, ground - h - 30, 48, 8, 4); g.fill(); } }
  // The main street: a 60s concrete parade of shops, half of them shut, with flats above
  function street(g, o = {}) { sky(g); const r = rng(11);
    // flats behind
    g.fillStyle = '#23252f'; g.fillRect(120, 140, 300, 420); g.fillRect(1500, 90, 260, 470); line(g, 5); g.strokeRect(120, 140, 300, 420); g.strokeRect(1500, 90, 260, 470);
    for (let yy = 170; yy < 540; yy += 46) for (let xx = 140; xx < 400; xx += 42) { g.fillStyle = r() < 0.25 ? '#f2c46a' : '#171922'; g.fillRect(xx, yy, 26, 28); }
    for (let yy = 120; yy < 540; yy += 46) for (let xx = 1520; xx < 1740; xx += 42) { g.fillStyle = r() < 0.2 ? '#f2c46a' : '#171922'; g.fillRect(xx, yy, 26, 28); }
    // the parade
    g.fillStyle = '#8b857a'; g.fillRect(0, 330, 1920, 440); line(g, 6); g.strokeRect(-10, 330, 1940, 440); g.fillStyle = '#6f6a61'; g.fillRect(0, 330, 1920, 28); g.strokeRect(-10, 330, 1940, 28);
    for (let xx = 40; xx < 1900; xx += 120) { g.fillStyle = r() < 0.15 ? '#f0c060' : '#2b2e38'; rr(g, xx, 390, 80, 90, 4); g.fill(); line(g, 4); g.stroke(); }
    g.fillStyle = 'rgba(40,30,25,0.5)'; for (let i = 0; i < 12; i++) { const xx = r() * 1920; g.fillRect(xx, 360, 6 + r() * 10, 120 + r() * 120); } // rust stains
    // shops
    const units = [[20, 'shut', 'BOOKIES', '#1d6b3a', '#fff'], [440, 'open', 'EVERYTHING £1', '#e8c21c', '#c61a1a'], [860, 'shut', 'TO LET', '#ddd', '#333'], [1280, 'open', 'SUNBED CITY', '#e05ab0', '#fff8'], [1700, 'shut', 'CASH 4 GOLD', '#f2d24a', '#1a1a1a']];
    units.forEach(([x, st, name, bg, fg], i) => { sign(g, x + 20, 520, 360, 70, bg, fg.slice(0, 7), name);
      if (st === 'shut') shutter(g, x + 20, 600, 360, 170, i === 2 ? ['NED WOZ ERE', '#7fe36b'] : i === 0 ? ['RAB 4 SHAZ', '#ff6ad5'] : null);
      else { g.fillStyle = name.includes('SUN') ? '#ff9ad8' : '#ffe9a8'; g.fillRect(x + 20, 600, 360, 170); line(g, 5); g.strokeRect(x + 20, 600, 360, 170); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 30, 610, 160, 150); g.fillRect(x + 210, 610, 160, 150); } });
    // pavement, kerb and the wet road
    g.fillStyle = '#5c5d64'; g.fillRect(0, 770, 1920, 70); line(g, 5); g.beginPath(); g.moveTo(0, 770); g.lineTo(1920, 770); g.stroke(); g.fillStyle = '#7a7b82'; g.fillRect(0, 836, 1920, 14); g.beginPath(); g.moveTo(0, 850); g.lineTo(1920, 850); g.stroke();
    const rd = g.createLinearGradient(0, 850, 0, 1080); rd.addColorStop(0, '#1e1f27'); rd.addColorStop(1, '#2c2d36'); g.fillStyle = rd; g.fillRect(0, 850, 1920, 230);
    g.fillStyle = '#d8d2b0'; for (let xx = -40; xx < 1920; xx += 260) g.fillRect(xx, 1000, 140, 12);
    // wet reflections of the shop lights and lamps
    g.save(); g.globalCompositeOperation = 'screen'; [[640, '#e8c21c'], [1480, '#e05ab0'], [300, '#ffaa50'], [1200, '#ffaa50']].forEach(([x, c]) => { const gr = g.createLinearGradient(0, 852, 0, 1080); gr.addColorStop(0, c + '66'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; for (let k = 0; k < 6; k++) g.fillRect(x - 60 + k * 22 + Math.sin(k) * 6, 852, 9, 160 + k * 8); }); g.restore();
    if (o.lamps !== false) { lamp(g, 230, 800, 520); lamp(g, 1130, 800, 520); }
  }
  // The bus shelter with the glass long gone, its timetable and the stop flag
  function shelter(g, x, ground) { line(g, 6); g.fillStyle = '#3d4250'; g.fillRect(x, ground - 300, 14, 300); g.fillRect(x + 360, ground - 300, 14, 300); g.strokeRect(x, ground - 300, 14, 300); g.strokeRect(x + 360, ground - 300, 14, 300);
    rr(g, x - 20, ground - 330, 414, 36, 6); g.fillStyle = '#4a5060'; g.fill(); g.stroke();
    g.fillStyle = 'rgba(190,220,235,0.18)'; g.beginPath(); g.moveTo(x + 14, ground - 290); g.lineTo(x + 120, ground - 290); g.lineTo(x + 70, ground - 230); g.lineTo(x + 110, ground - 180); g.lineTo(x + 14, ground - 150); g.closePath(); g.fill(); line(g, 3); g.stroke();
    g.fillStyle = 'rgba(210,230,240,0.7)'; const r = rng(5); for (let i = 0; i < 26; i++) { g.beginPath(); const sx = x + r() * 380, sy = ground - 4 - r() * 18; g.moveTo(sx, sy); g.lineTo(sx + 6 + r() * 10, sy + 2); g.lineTo(sx + 3, sy - 5); g.closePath(); g.fill(); }
    rr(g, x + 230, ground - 270, 110, 140, 4); g.fillStyle = '#e9e6dc'; g.fill(); line(g, 4); g.stroke(); g.fillStyle = '#333'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText('BUSES EVERY', x + 285, ground - 236); g.fillText('10 MINUTES', x + 285, ground - 216); g.save(); g.font = 'bold 24px "Comic Sans MS", cursive'; g.fillStyle = '#d0202a'; g.translate(x + 285, ground - 168); g.rotate(-0.15); g.fillText('AYE RIGHT', 0, 0); g.restore();
    // the stop flag
    const px = x + 470; g.fillStyle = '#c8c8c8'; g.fillRect(px - 6, ground - 420, 12, 420); line(g, 4); g.strokeRect(px - 6, ground - 420, 12, 420);
    rr(g, px - 70, ground - 470, 140, 110, 10); g.fillStyle = '#f4f2ea'; g.fill(); g.stroke(); g.fillStyle = '#d7262f'; g.beginPath(); g.arc(px, ground - 440, 22, 0, Math.PI * 2); g.fill(); g.fillStyle = '#222'; g.font = '900 17px sans-serif'; g.textAlign = 'center'; g.fillText('BUS STOP', px, ground - 398); g.font = '700 13px sans-serif'; g.fillText('Main St, COATBRIDGE', px, ground - 376); }
  function puddle(g, x, y, w, ripple) { g.save(); g.fillStyle = '#3a4a62'; g.beginPath(); g.ellipse(x, y, w, w * 0.11, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(200,220,255,0.35)'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x - w * 0.3 + k * w * 0.3, y, 30 + ((ripple || 0) * 60 + k * 23) % 50, 5 + ((ripple || 0) * 12 + k * 4) % 9, 0, 0, Math.PI * 2); g.stroke(); } g.restore(); }
  function rain(g, t, amt = 1) { const r = rng(77); g.save(); g.strokeStyle = 'rgba(190,205,230,0.38)'; g.lineWidth = 2.5; g.lineCap = 'round'; for (let i = 0; i < 260 * amt; i++) { const x0 = r() * 2100 - 90, sp = 1500 + r() * 600, y = ((r() * 1200 + t * sp) % 1200) - 60, x = x0 - (y + 60) * 0.18; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7, y + 38); g.stroke(); } g.restore(); }
  // A single decker, side on, going right. It is not in service. It is never in service.
  function bus(g, x, ground, blur) { g.save(); g.translate(x, ground); line(g, 6);
    rr(g, -560, -360, 1120, 320, 34); g.fillStyle = '#ece8de'; g.fill(); g.stroke(); g.fillStyle = '#f08a1e'; g.fillRect(-556, -150, 1112, 40); g.fillStyle = '#7a3fa0'; g.fillRect(-556, -110, 1112, 18);
    for (let k = 0; k < 6; k++) { rr(g, -500 + k * 160, -320, 140, 130, 10); g.fillStyle = '#1e2733'; g.fill(); line(g, 4); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(-490 + k * 160, -310); g.lineTo(-440 + k * 160, -310); g.lineTo(-480 + k * 160, -200); g.closePath(); g.fill(); }
    rr(g, 440, -330, 110, 170, 14); g.fillStyle = '#1e2733'; g.fill(); line(g, 5); g.stroke();
    rr(g, 430, -352, 120, 30, 6); g.fillStyle = '#111'; g.fill(); g.fillStyle = '#ffb31a'; g.font = '700 16px monospace'; g.textAlign = 'center'; g.fillText('NOT IN SERVICE', 490, -332);
    g.fillStyle = '#fff7c8'; g.beginPath(); g.ellipse(548, -80, 14, 22, 0, 0, Math.PI * 2); g.fill();
    [-360, 360].forEach(wx => { g.fillStyle = '#16161c'; g.beginPath(); g.arc(wx, -36, 62, 0, Math.PI * 2); g.fill(); line(g, 5); g.stroke(); g.fillStyle = '#8a8d96'; g.beginPath(); g.arc(wx, -36, 26, 0, Math.PI * 2); g.fill(); });
    if (blur) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 6; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(-620 - k * 30, -320 + k * 45); g.lineTo(-900 - k * 60, -320 + k * 45); g.stroke(); } }
    g.restore(); }
  // A cartoon wave of puddle water thrown up off a wheel
  function wave(g, x, ground, k) { g.save(); g.translate(x, ground); const h = 520 * Math.sin(Math.PI * Math.min(1, k)), w = 380 + 300 * k; g.fillStyle = 'rgba(120,160,215,0.85)'; line(g, 5);
    g.beginPath(); g.moveTo(-60, 0); g.bezierCurveTo(-20, -h * 0.6, 120, -h, w * 0.6, -h * 0.9); g.bezierCurveTo(w * 0.85, -h * 0.82, w, -h * 0.55, w * 0.95, -h * 0.25); g.bezierCurveTo(w * 0.8, -h * 0.5, w * 0.5, -h * 0.55, 120, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(210,230,255,0.9)'; const r = rng(9); for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(80 + r() * w, -h * (0.4 + r() * 0.7), 6 + r() * 14, 0, Math.PI * 2); g.fill(); } g.restore(); }
  // Closing time: a tenement pub with the door open, the kebab shop next door, cones on the pavement
  function pub(g, o = {}) { sky(g); const r = rng(21);
    g.fillStyle = '#7d3a2c'; g.fillRect(0, 60, 1920, 720); line(g, 6); g.strokeRect(-10, 60, 1940, 720); g.strokeStyle = 'rgba(40,10,10,0.35)'; g.lineWidth = 3; for (let yy = 100; yy < 780; yy += 46) { g.beginPath(); g.moveTo(0, yy); g.lineTo(1920, yy); g.stroke(); for (let xx = (yy / 46 % 2) * 60; xx < 1920; xx += 120) { g.beginPath(); g.moveTo(xx, yy - 46); g.lineTo(xx, yy); g.stroke(); } }
    for (let xx = 80; xx < 1900; xx += 240) { [130, 300].forEach(yy => { g.fillStyle = r() < 0.3 ? '#f2c46a' : '#1c1d26'; rr(g, xx, yy, 110, 130, 4); g.fill(); line(g, 5); g.stroke(); }); }
    // the pub
    g.fillStyle = '#121418'; g.fillRect(140, 450, 1000, 330); line(g, 6); g.strokeRect(140, 450, 1000, 330);
    g.save(); g.fillStyle = '#d6a94a'; g.font = '700 64px Georgia, serif'; g.textAlign = 'center'; g.shadowColor = 'rgba(255,200,90,0.6)'; g.shadowBlur = 12; g.fillText('THE WEE BLACK DUG', 640, 525); g.restore();
    [[180, 300], [800, 300]].forEach(([x, w]) => { g.fillStyle = '#f0b860'; g.fillRect(x, 560, w, 170); line(g, 5); g.strokeRect(x, 560, w, 170); g.strokeStyle = 'rgba(80,40,10,0.5)'; g.lineWidth = 3; for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x + w * k / 3, 560); g.lineTo(x + w * k / 3, 730); g.stroke(); } });
    // the door, open, with the light spilling out
    const d = o.door == null ? 1 : o.door; g.fillStyle = '#ffd690'; g.fillRect(530, 560, 220, 220); g.save(); g.globalCompositeOperation = 'screen'; const sp = g.createLinearGradient(0, 780, 0, 1080); sp.addColorStop(0, `rgba(255,200,120,${0.45 * d})`); sp.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = sp; g.beginPath(); g.moveTo(530, 780); g.lineTo(750, 780); g.lineTo(900, 1080); g.lineTo(380, 1080); g.closePath(); g.fill(); g.restore();
    g.fillStyle = '#2a1d16'; g.beginPath(); g.moveTo(750, 560); g.lineTo(750 - 160 * (1 - d) - 20, 570); g.lineTo(750 - 160 * (1 - d) - 20, 770); g.lineTo(750, 780); g.closePath(); g.fill(); line(g, 5); g.stroke(); line(g, 6); g.strokeRect(530, 560, 220, 220);
    // kebab shop next door
    g.fillStyle = '#20232b'; g.fillRect(1240, 450, 640, 330); g.strokeRect(1240, 450, 640, 330); sign(g, 1260, 470, 600, 80, '#c8141b', '#ffe14a', 'KEBABS · PIZZA · CHIPS', null, 'rgba(255,60,40,0.7)'); g.fillStyle = '#fff3c9'; g.fillRect(1280, 570, 560, 200); g.strokeRect(1280, 570, 560, 200);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(1300, 700, 520, 60); g.fillStyle = '#a0612c'; g.beginPath(); g.moveTo(1560, 590); g.lineTo(1600, 590); g.lineTo(1610, 690); g.lineTo(1550, 690); g.closePath(); g.fill(); line(g, 4); g.stroke();
    // pavement and road
    g.fillStyle = '#5c5d64'; g.fillRect(0, 780, 1920, 80); g.fillStyle = '#7a7b82'; g.fillRect(0, 856, 1920, 14); line(g, 5); g.beginPath(); g.moveTo(0, 780); g.lineTo(1920, 780); g.moveTo(0, 870); g.lineTo(1920, 870); g.stroke();
    g.fillStyle = '#23242c'; g.fillRect(0, 870, 1920, 210);
    if (o.cones !== false) [[1180, 0.1], [1240, -0.6]].forEach(([x, a]) => { g.save(); g.translate(x, 812); g.rotate(a); g.fillStyle = '#e8661c'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-6, -80); g.lineTo(6, -80); g.lineTo(26, 0); g.closePath(); g.fill(); line(g, 4); g.stroke(); g.fillStyle = '#eee'; g.fillRect(-16, -42, 32, 12); g.restore(); });
    lamp(g, 1950, 820, 560); }
  // A polis van, side on
  function van(g, x, ground, t, lights = 1) { g.save(); g.translate(x, ground); line(g, 6);
    g.beginPath(); g.moveTo(-430, -40); g.lineTo(-430, -330); g.lineTo(220, -330); g.lineTo(330, -210); g.lineTo(420, -190); g.lineTo(430, -40); g.closePath(); g.fillStyle = '#f2f2f0'; g.fill(); g.stroke();
    for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? '#1a3e8c' : '#f2f2f0'; g.fillRect(-430 + k * 62, -170, 62, 40); } g.strokeRect(-430, -170, 860, 40);
    g.fillStyle = '#1a3e8c'; g.font = '900 72px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.fillText('POLIS', -110, -200);
    g.beginPath(); g.moveTo(230, -320); g.lineTo(320, -215); g.lineTo(230, -215); g.closePath(); g.fillStyle = '#1e2733'; g.fill(); line(g, 4); g.stroke();
    [-300, 290].forEach(wx => { g.fillStyle = '#16161c'; g.beginPath(); g.arc(wx, -40, 56, 0, Math.PI * 2); g.fill(); line(g, 5); g.stroke(); g.fillStyle = '#8a8d96'; g.beginPath(); g.arc(wx, -40, 22, 0, Math.PI * 2); g.fill(); });
    const on = lights && Math.sin(t * 22) > 0; [[-120, '#2a6bff'], [20, '#2a6bff']].forEach(([lx, c], i) => { rr(g, lx, -362, 90, 32, 8); g.fillStyle = (on ? i === 0 : i === 1) ? '#9cc4ff' : '#1d3f8f'; g.fill(); line(g, 4); g.stroke(); });
    g.restore();
    if (lights) { g.save(); g.globalCompositeOperation = 'screen'; const on2 = Math.sin(t * 22) > 0, lx = x + (on2 ? -75 : 65), gr = g.createRadialGradient(lx, ground - 346, 10, lx, ground - 346, 700); gr.addColorStop(0, 'rgba(60,120,255,0.55)'); gr.addColorStop(1, 'rgba(60,120,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); g.restore(); } }
  function pint(g, x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); line(g, 4); g.beginPath(); g.moveTo(-22, -70); g.lineTo(22, -70); g.lineTo(17, 0); g.lineTo(-17, 0); g.closePath(); g.fillStyle = '#c9862a'; g.fill(); g.stroke(); g.fillStyle = '#f6efdc'; g.fillRect(-22, -78, 44, 14); g.strokeRect(-22, -78, 44, 14); g.restore(); }
  function kebab(g, x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); line(g, 4); g.fillStyle = '#e8d6a8'; g.beginPath(); g.moveTo(-40, 0); g.quadraticCurveTo(0, -80, 40, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#8a4b22'; g.beginPath(); g.ellipse(0, -22, 26, 14, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5fae3a'; g.fillRect(-18, -34, 10, 6); g.fillStyle = '#d9342b'; g.fillRect(6, -36, 10, 6); g.restore(); }
  function bubble(g, x, y, text, size = 46) { g.save(); g.font = `bold ${size}px "Comic Sans MS", "Segoe Print", cursive`; const w = g.measureText(text).width + size, h = size * 1.6; line(g, 5); g.fillStyle = '#fbf8f0'; rr(g, x - w / 2, y - h, w, h, h / 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - 10, y - 2); g.lineTo(x + 20, y + 30); g.lineTo(x + 24, y - 4); g.fill(); g.fillStyle = '#1b1b22'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y - h / 2 + 2); g.restore(); }
  return { street, shelter, puddle, rain, bus, wave, pub, van, pint, kebab, bubble, rng };
})();

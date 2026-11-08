/* Coat: cartoon Coatbridge for the intro cut scenes. A 2400x1080 world painted in layers (sky, far flats, the parade of
   shops, the street), each built once into a picture and lit: light pools and cones from the lamps, glowing signs,
   bloom, wet reflections on the road, rain in depth, mist, a colour grade and grain. Made up names only.
   Everything moving is a pure function of time. */
const Coat = (() => {
  const WW = 2400, WH = 1080, GROUND = 812, KERB = 848, OUT = '#121219';
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const lw = (g, w) => { g.lineWidth = w; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round'; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  // A grubby texture: speckle, streaks and blotches, to multiply over flat paint
  let grime = null; function grimeTex() { if (grime) return grime; const c = mk(512, 512), g = c.getContext('2d'), r = rng(31); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { const v = 150 + r() * 105 | 0; g.fillStyle = `rgba(${v - 20},${v - 25},${v - 30},${0.08 + r() * 0.12})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3); }
    for (let i = 0; i < 40; i++) { const x = r() * 512, y = r() * 512, gr = g.createRadialGradient(x, y, 0, x, y, 20 + r() * 60); gr.addColorStop(0, `rgba(90,80,70,${0.06 + r() * 0.08})`); gr.addColorStop(1, 'rgba(90,80,70,0)'); g.fillStyle = gr; g.fillRect(x - 80, y - 80, 160, 160); }
    return (grime = c); }
  function dirty(g, x, y, w, h, a = 1) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = a; const p = g.createPattern(grimeTex(), 'repeat'); g.fillStyle = p; g.fillRect(x, y, w, h);
    // rain streaks running down from ledges
    const r = rng((x * 7 + y) | 0); g.globalAlpha = 0.18 * a; for (let i = 0; i < w / 40; i++) { const sx = x + r() * w, l = h * (0.2 + r() * 0.6), gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(40,35,30,1)'); gr.addColorStop(1, 'rgba(40,35,30,0)'); g.fillStyle = gr; g.fillRect(sx, y, 3 + r() * 9, l); } g.restore(); }
  function textFit(g, text, w, weight, size, family) { let s = size; g.font = `${weight} ${s}px ${family}`; while (g.measureText(text).width > w && s > 8) { s -= 2; g.font = `${weight} ${s}px ${family}`; } return s; }
  const SANS = '"Arial Black", "Segoe UI Black", Impact, sans-serif', SCRAWL = '"Ink Free", "Segoe Print", "Comic Sans MS", cursive';
  // A backlit shop sign: a box, its face, the words, and a glow put in the light layer
  function lightbox(g, L, x, y, w, h, face, ink, text, glow) { rr(g, x - 6, y - 6, w + 12, h + 12, 8); g.fillStyle = '#26272d'; g.fill(); lw(g, 5); g.stroke();
    const f = g.createLinearGradient(0, y, 0, y + h); f.addColorStop(0, face[0]); f.addColorStop(1, face[1]); rr(g, x, y, w, h, 4); g.fillStyle = f; g.fill();
    textFit(g, text, w * 0.88, 900, h * 0.62, SANS); g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + h / 2 + 3);
    if (glow && L) { const gr = L.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.75); gr.addColorStop(0, glow.replace('A', '0.5')); gr.addColorStop(1, glow.replace('A', '0')); L.fillStyle = gr; L.fillRect(x - w * 0.3, y - h * 2, w * 1.6, h * 5); } }
  function shutter(g, x, y, w, h, tag, tagCol) { const f = g.createLinearGradient(0, y, 0, y + h); f.addColorStop(0, '#7b7e86'); f.addColorStop(1, '#5d6068'); g.fillStyle = f; g.fillRect(x, y, w, h);
    for (let yy = y + 12; yy < y + h; yy += 13) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, yy, w, 3); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, yy + 3, w, 2); }
    dirty(g, x, y, w, h, 0.9); lw(g, 5); g.strokeRect(x, y, w, h);
    if (tag) { g.save(); g.translate(x + w / 2, y + h * 0.55); g.rotate(-0.06); g.font = `900 ${Math.round(h * 0.26)}px ${SCRAWL}`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#141420'; g.strokeText(tag, 0, 0); g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeText(tag, 0, 0); g.fillStyle = tagCol; g.fillText(tag, 0, 0); g.restore(); } }
  function windowPane(g, L, x, y, w, h, lit, r) { rr(g, x - 5, y - 5, w + 10, h + 10, 3); g.fillStyle = '#b8b2a6'; g.fill(); lw(g, 4); g.stroke();
    if (lit) { const c = lit === 2 ? ['#9fd2ff', '#3d77b8'] : ['#ffd88a', '#d58a3a'], gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(80,40,30,0.55)'; if (r() < 0.6) { g.fillRect(x, y, w * 0.28, h); g.fillRect(x + w * 0.72, y, w * 0.28, h); } else for (let k = 0; k < 6; k++) g.fillRect(x, y + k * h / 6, w, h / 14);
      if (L) { const gg = L.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 1.3); gg.addColorStop(0, lit === 2 ? 'rgba(120,180,255,0.35)' : 'rgba(255,190,110,0.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = gg; L.fillRect(x - w, y - h, w * 3, h * 3); } }
    else { const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#2a3040'); gr.addColorStop(1, '#151820'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.4, y); g.lineTo(x, y + h * 0.6); g.fill(); }
    g.fillStyle = '#b8b2a6'; g.fillRect(x + w / 2 - 2, y, 4, h); }

  /* ---------- The bus stop: Main Street ---------- */
  let BUS = null, CONE = null;
  function busStopLayers() { if (BUS) return BUS; const r = rng(11);
    const sky = mk(WW, WH), s = sky.getContext('2d'), far = mk(WW, WH), f = far.getContext('2d'), mid = mk(WW, WH), m = mid.getContext('2d'), light = mk(WW, WH), L = light.getContext('2d'), cones = mk(WW / 2, WH / 2), C = cones.getContext('2d'); C.scale(0.5, 0.5); CONE = C;
    // sky: low cloud lit orange from the town underneath
    let gr = s.createLinearGradient(0, 0, 0, 760); gr.addColorStop(0, '#0b1020'); gr.addColorStop(0.55, '#262a3c'); gr.addColorStop(1, '#6a4634'); s.fillStyle = gr; s.fillRect(0, 0, WW, WH);
    s.filter = 'blur(18px)'; for (let i = 0; i < 40; i++) { const x = r() * WW, y = 40 + r() * 420, w = 200 + r() * 360; const cg = s.createLinearGradient(0, y - 60, 0, y + 60); cg.addColorStop(0, 'rgba(40,42,58,0.9)'); cg.addColorStop(1, `rgba(${110 + r() * 40 | 0},70,55,0.55)`); s.fillStyle = cg; s.beginPath(); s.ellipse(x, y, w, 50 + r() * 50, 0, 0, Math.PI * 2); s.fill(); } s.filter = 'none';
    // far: tower blocks and the backs of tenements in the haze
    [[160, 120, 300, 640], [700, 230, 220, 520], [1820, 80, 320, 680], [2180, 260, 200, 500]].forEach(([x, y, w, h]) => { f.fillStyle = '#1c2030'; f.fillRect(x, y, w, h); f.fillStyle = '#262b3c'; f.fillRect(x + w * 0.82, y, w * 0.18, h);
      for (let yy = y + 26; yy < y + h - 20; yy += 38) for (let xx = x + 16; xx < x + w * 0.8 - 18; xx += 34) { const v = r(); f.fillStyle = v < 0.18 ? '#f4c977' : v < 0.23 ? '#8fc0ff' : '#121520'; f.fillRect(xx, yy, 20, 22); if (v < 0.23) { const gg = f.createRadialGradient(xx + 10, yy + 11, 2, xx + 10, yy + 11, 26); gg.addColorStop(0, v < 0.18 ? 'rgba(255,190,110,0.25)' : 'rgba(130,180,255,0.25)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gg; f.fillRect(xx - 20, yy - 20, 60, 60); } }
      f.fillStyle = '#2b2f40'; f.fillRect(x + w * 0.3, y - 30, 8, 30); f.fillRect(x + w * 0.6, y - 18, 6, 18); });
    gr = f.createLinearGradient(0, 300, 0, 800); gr.addColorStop(0, 'rgba(70,64,80,0)'); gr.addColorStop(1, 'rgba(90,70,70,0.55)'); f.fillStyle = gr; f.fillRect(0, 0, WW, WH);
    // mid: the parade of shops with flats above
    const top = 300; m.fillStyle = '#8c857a'; m.fillRect(0, top, WW, GROUND - top); dirty(m, 0, top, WW, GROUND - top, 1);
    gr = m.createLinearGradient(0, top, 0, GROUND); gr.addColorStop(0, 'rgba(10,12,30,0.55)'); gr.addColorStop(1, 'rgba(10,12,30,0.15)'); m.fillStyle = gr; m.fillRect(0, top, WW, GROUND - top);
    m.fillStyle = '#5f5a52'; m.fillRect(0, top - 26, WW, 34); lw(m, 6); m.strokeRect(-10, top - 26, WW + 20, 34); m.fillStyle = 'rgba(0,0,0,0.3)'; m.fillRect(0, top + 8, WW, 14);
    for (let xx = 50; xx < WW - 60; xx += 132) windowPane(m, L, xx, top + 60, 84, 104, r() < 0.3 ? (r() < 0.2 ? 2 : 1) : 0, r);
    // a satellite dish, a flat to let board, a CCTV camera that has seen things
    m.save(); m.translate(530, top + 70); m.rotate(-0.4); m.fillStyle = '#d8d8d2'; m.beginPath(); m.ellipse(0, 0, 26, 30, 0, 0, Math.PI * 2); m.fill(); lw(m, 4); m.stroke(); m.restore();
    rr(m, 1560, top + 40, 120, 70, 4); m.fillStyle = '#f2efe4'; m.fill(); lw(m, 4); m.stroke(); m.fillStyle = '#c0262d'; m.font = `900 22px ${SANS}`; m.textAlign = 'center'; m.fillText('FLAT', 1620, top + 70); m.fillText('TO LET', 1620, top + 96);
    m.fillStyle = 'rgba(0,0,0,0.35)'; m.fillRect(0, top + 196, WW, 10);
    const units = [[30, 'shut', 'BOOKIES', ['#2f8f55', '#1a5e35'], '#ffffff', 'rgba(70,220,130,A)', 'RAB 4 SHAZ', '#ff63c8'], [480, 'open', 'EVERYTHING £1', ['#ffe34a', '#e2b514'], '#c4141c', 'rgba(255,220,60,A)'], [930, 'open', 'SUNBED CITY', ['#ff7ccf', '#c43c93'], '#fff', 'rgba(255,90,200,A)'], [1380, 'shut', 'TO LET', ['#f2f0ea', '#cfcbc0'], '#33343a', null, 'NED WOZ ERE', '#7fe36b'], [1830, 'shut', 'CASH 4 GOLD', ['#ffd84a', '#d9a514'], '#1a1a1a', 'rgba(255,210,70,A)', 'COATBRIDGE 4 EVA', '#ffd23b']];
    units.forEach(([x, st, name, face, ink, glow, tag, tagCol]) => { const w = 410; lightbox(m, L, x + 10, 540, w - 20, 72, face, ink, name, glow);
      if (st === 'shut') shutter(m, x + 10, 628, w - 20, GROUND - 628, tag, tagCol);
      else { const gi = m.createLinearGradient(0, 628, 0, GROUND); gi.addColorStop(0, name.includes('SUN') ? '#ffc2ea' : '#fff3c4'); gi.addColorStop(1, name.includes('SUN') ? '#e070b8' : '#e8c070'); m.fillStyle = gi; m.fillRect(x + 10, 628, w - 20, GROUND - 628);
        m.fillStyle = 'rgba(60,40,30,0.35)'; for (let k = 0; k < 4; k++) m.fillRect(x + 30, 650 + k * 40, w - 60, 8); for (let k = 0; k < 14; k++) { m.fillStyle = ['#d23', '#27c', '#3a3', '#fa0'][k % 4]; m.fillRect(x + 34 + r() * (w - 80), 628 + 14 + (k % 4) * 40, 14, 18); }
        m.fillStyle = 'rgba(255,255,255,0.12)'; m.beginPath(); m.moveTo(x + 10, 628); m.lineTo(x + 140, 628); m.lineTo(x + 10, 760); m.fill(); lw(m, 6); m.strokeRect(x + 10, 628, w - 20, GROUND - 628); m.fillStyle = '#3a3c44'; m.fillRect(x + w / 2 - 4, 628, 8, GROUND - 628);
        const lp = L.createLinearGradient(0, GROUND, 0, GROUND + 160); lp.addColorStop(0, glow.replace('A', '0.45')); lp.addColorStop(1, glow.replace('A', '0')); L.fillStyle = lp; L.beginPath(); L.moveTo(x + 10, GROUND); L.lineTo(x + w - 10, GROUND); L.lineTo(x + w + 80, GROUND + 160); L.lineTo(x - 70, GROUND + 160); L.closePath(); L.fill(); } });
    m.fillStyle = '#4a4740'; for (let x = 0; x < WW; x += 450) { m.fillRect(x, 520, 20, GROUND - 520); } lw(m, 6); m.beginPath(); m.moveTo(0, GROUND); m.lineTo(WW, GROUND); m.stroke();
    // the street: pavement slabs, kerb, wet tarmac, worn lines, a drain, some litter, a trolley having a lie down
    m.fillStyle = '#585a62'; m.fillRect(0, GROUND, WW, KERB - GROUND); m.strokeStyle = 'rgba(0,0,0,0.25)'; m.lineWidth = 2; for (let x = 0; x < WW; x += 96) { m.beginPath(); m.moveTo(x, GROUND); m.lineTo(x - 18, KERB); m.stroke(); }
    m.fillStyle = '#7d7f87'; m.fillRect(0, KERB - 4, WW, 16); lw(m, 5); m.beginPath(); m.moveTo(0, KERB + 12); m.lineTo(WW, KERB + 12); m.stroke();
    gr = m.createLinearGradient(0, KERB, 0, WH); gr.addColorStop(0, '#1a1b22'); gr.addColorStop(1, '#262731'); m.fillStyle = gr; m.fillRect(0, KERB + 12, WW, WH - KERB); dirty(m, 0, KERB + 12, WW, WH - KERB, 0.5);
    m.fillStyle = 'rgba(225,215,170,0.55)'; for (let x = -40; x < WW; x += 300) m.fillRect(x + r() * 10, 1010, 150 - r() * 30, 12);
    m.fillStyle = '#2c2d33'; m.fillRect(700, KERB + 16, 70, 22); m.strokeStyle = '#111'; m.lineWidth = 2; for (let k = 0; k < 6; k++) { m.beginPath(); m.moveTo(705 + k * 11, KERB + 18); m.lineTo(705 + k * 11, KERB + 36); m.stroke(); }
    [[380, 836, '#e43'], [1180, 830, '#fd2'], [2050, 838, '#39f']].forEach(([x, y, c]) => { m.save(); m.translate(x, y); m.rotate(r() - 0.5); rr(m, -16, -9, 32, 18, 3); m.fillStyle = c; m.fill(); lw(m, 3); m.stroke(); m.restore(); });
    m.save(); m.translate(2140, 880); m.rotate(0.22); lw(m, 4); m.strokeStyle = '#9aa0a8'; m.lineWidth = 5; for (let k = 0; k < 7; k++) { m.beginPath(); m.moveTo(-90 + k * 26, -80); m.lineTo(-80 + k * 24, 0); m.stroke(); } for (let k = 0; k < 4; k++) { m.beginPath(); m.moveTo(-92, -80 + k * 26); m.lineTo(90, -80 + k * 26); m.stroke(); } m.fillStyle = '#c52d34'; m.fillRect(80, -100, 40, 14); m.restore();
    // puddles on the road
    [[1500, 935, 340], [520, 960, 180]].forEach(([x, y, w]) => { const pg = m.createRadialGradient(x, y, 10, x, y, w); pg.addColorStop(0, '#2b3850'); pg.addColorStop(1, '#1d2433'); m.fillStyle = pg; m.beginPath(); m.ellipse(x, y, w, w * 0.12, 0, 0, Math.PI * 2); m.fill(); });
    // lamps and the shelter go in the mid picture too (they don't move)
    [[300, 1], [1220, 1], [2140, 0.8]].forEach(([x, on]) => lampPost(m, L, x, on)); CONE = null;
    shelter(m, L, 1360);
    BUS = { sky, far, mid, light, cones, glow: null, refl: null };
    // bloom: a soft copy of the light
    const gl = mk(WW / 4, WH / 4), gg = gl.getContext('2d'); gg.filter = 'blur(10px)'; gg.drawImage(light, 0, 0, WW / 4, WH / 4); BUS.glow = gl;
    // the wet road reflects the shops: flipped about the kerb, blurred and darkened, only on the road
    const RH = WH - KERB - 14, rf = mk(WW / 2, Math.ceil(RH / 2)), rg = rf.getContext('2d'); rg.filter = 'blur(2.5px)'; rg.setTransform(0.5, 0, 0, -0.5, 0, (KERB + 14) * 0.5); rg.drawImage(mid, 0, 0); rg.globalCompositeOperation = 'lighter'; rg.drawImage(light, 0, 0); rg.setTransform(1, 0, 0, 1, 0, 0); rg.filter = 'none';
    rg.globalCompositeOperation = 'destination-in'; const fade = rg.createLinearGradient(0, 0, 0, RH / 2); fade.addColorStop(0, 'rgba(0,0,0,0.6)'); fade.addColorStop(1, 'rgba(0,0,0,0.08)'); rg.fillStyle = fade; rg.fillRect(0, 0, WW / 2, RH / 2); BUS.refl = rf;
    return BUS; }
  function lampPost(g, L, x, on) { const top = 250; lw(g, 5); const pg = g.createLinearGradient(x - 9, 0, x + 9, 0); pg.addColorStop(0, '#4a4e58'); pg.addColorStop(1, '#2c2f37'); g.fillStyle = pg; g.fillRect(x - 9, top, 18, GROUND - top); g.strokeRect(x - 9, top, 18, GROUND - top);
    g.beginPath(); g.moveTo(x, top); g.quadraticCurveTo(x + 8, top - 50, x + 80, top - 50); g.lineWidth = 15; g.stroke(); g.lineWidth = 8; g.strokeStyle = '#3d414b'; g.stroke(); rr(g, x + 56, top - 62, 76, 26, 10); g.fillStyle = '#2a2c33'; g.fill(); lw(g, 4); g.stroke();
    g.fillStyle = on ? '#ffe2a6' : '#555'; rr(g, x + 62, top - 40, 64, 9, 4); g.fill();
    if (on && L) { const c = L.createRadialGradient(x + 94, top - 30, 4, x + 94, top - 30, 90); c.addColorStop(0, `rgba(255,200,120,${0.9 * on})`); c.addColorStop(1, 'rgba(255,170,80,0)'); L.fillStyle = c; L.fillRect(x - 10, top - 130, 210, 200);
      const C = CONE || L, cone = C.createLinearGradient(0, top - 30, 0, GROUND + 120); cone.addColorStop(0, `rgba(255,175,90,${0.3 * on})`); cone.addColorStop(1, `rgba(255,160,70,${0.04 * on})`); C.fillStyle = cone; C.beginPath(); C.moveTo(x + 62, top - 32); C.lineTo(x + 126, top - 32); C.lineTo(x + 330, GROUND + 60); C.lineTo(x - 140, GROUND + 60); C.closePath(); C.fill();
      const pool = L.createRadialGradient(x + 94, GROUND + 30, 10, x + 94, GROUND + 30, 300); pool.addColorStop(0, `rgba(255,180,100,${0.45 * on})`); pool.addColorStop(1, 'rgba(255,170,80,0)'); L.fillStyle = pool; L.beginPath(); L.ellipse(x + 94, GROUND + 40, 320, 90, 0, 0, Math.PI * 2); L.fill(); } }
  // The bus shelter: the glass long gone, a timetable that lies, and an advert that tells the truth
  function shelter(g, L, x) { const y0 = GROUND - 340; lw(g, 6);
    g.fillStyle = 'rgba(160,190,210,0.10)'; g.fillRect(x, y0 + 30, 480, 300);
    rr(g, x + 300, y0 + 60, 160, 240, 4); g.fillStyle = '#1b1d24'; g.fill(); g.stroke(); const ad = g.createLinearGradient(0, y0 + 70, 0, y0 + 290); ad.addColorStop(0, '#f6f1e3'); ad.addColorStop(1, '#d9d0ba'); g.fillStyle = ad; g.fillRect(x + 310, y0 + 70, 140, 220);
    g.fillStyle = '#1f6b46'; g.fillRect(x + 310, y0 + 70, 140, 40); g.fillStyle = '#fff'; g.font = `900 17px ${SANS}`; g.textAlign = 'center'; g.fillText('COATBRIDGE', x + 380, y0 + 97);
    g.fillStyle = '#222'; g.font = '700 21px Georgia, serif'; ['At least', "it's no", 'Airdrie.'].forEach((t, i) => g.fillText(t, x + 380, y0 + 160 + i * 30)); g.font = 'italic 12px Georgia, serif'; g.fillText('Visit Coatbridge', x + 380, y0 + 272);
    if (L) { const ag = L.createRadialGradient(x + 380, y0 + 180, 10, x + 380, y0 + 180, 200); ag.addColorStop(0, 'rgba(230,240,255,0.35)'); ag.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = ag; L.fillRect(x + 180, y0 - 20, 400, 400); }
    const post = (px) => { const pg = g.createLinearGradient(px, 0, px + 16, 0); pg.addColorStop(0, '#5a6070'); pg.addColorStop(1, '#353946'); g.fillStyle = pg; g.fillRect(px, y0 + 20, 16, 320); lw(g, 5); g.strokeRect(px, y0 + 20, 16, 320); }; post(x); post(x + 470);
    rr(g, x - 26, y0, 538, 34, 6); const rf = g.createLinearGradient(0, y0, 0, y0 + 34); rf.addColorStop(0, '#5d6474'); rf.addColorStop(1, '#3a3f4c'); g.fillStyle = rf; g.fill(); lw(g, 6); g.stroke();
    // the tube light under the roof (flickers: drawn in its own pass)
    rr(g, x + 40, y0 + 36, 220, 10, 4); g.fillStyle = '#e7f1ff'; g.fill();
    // what's left of the glass: a jagged corner and the shards on the ground
    g.fillStyle = 'rgba(200,225,240,0.22)'; g.beginPath(); g.moveTo(x + 16, y0 + 36); g.lineTo(x + 150, y0 + 36); g.lineTo(x + 92, y0 + 96); g.lineTo(x + 128, y0 + 150); g.lineTo(x + 16, y0 + 190); g.closePath(); g.fill(); lw(g, 3); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(x + 30, y0 + 50); g.lineTo(x + 70, y0 + 50); g.stroke();
    const r = rng(5); g.fillStyle = 'rgba(220,235,245,0.75)'; for (let i = 0; i < 40; i++) { const sx = x - 20 + r() * 520, sy = GROUND + 4 + r() * 26; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 5 + r() * 10, sy + 2); g.lineTo(sx + 3, sy - 4); g.closePath(); g.fill(); }
    // timetable: buses every 10 minutes. Aye right.
    rr(g, x + 40, y0 + 90, 110, 140, 4); g.fillStyle = '#ebe7dc'; g.fill(); lw(g, 4); g.stroke(); g.fillStyle = '#333'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('BUSES EVERY', x + 95, y0 + 122); g.fillText('10 MINUTES', x + 95, y0 + 142); g.fillStyle = '#999'; for (let k = 0; k < 4; k++) g.fillRect(x + 56, y0 + 156 + k * 12, 78, 4);
    g.save(); g.translate(x + 95, y0 + 200); g.rotate(-0.18); g.font = `900 26px ${SCRAWL}`; g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeText('AYE RIGHT', 0, 0); g.fillStyle = '#d0202a'; g.fillText('AYE RIGHT', 0, 0); g.restore();
    // the stop flag
    const px = x + 600; g.fillStyle = '#b9bcc2'; g.fillRect(px - 7, GROUND - 470, 14, 470); lw(g, 4); g.strokeRect(px - 7, GROUND - 470, 14, 470);
    rr(g, px - 78, GROUND - 530, 156, 120, 12); g.fillStyle = '#f4f2ea'; g.fill(); g.stroke(); g.fillStyle = '#d7262f'; g.beginPath(); g.arc(px, GROUND - 498, 23, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '900 20px sans-serif'; g.fillText('B', px, GROUND - 491);
    g.fillStyle = '#222'; g.font = `900 18px ${SANS}`; g.fillText('BUS STOP', px, GROUND - 452); g.font = '700 13px sans-serif'; g.fillText('Main St, Coatbridge', px, GROUND - 430); }
  // Rain in three depths, and splashes on the ground
  function rain(g, t, cam, amt = 1, wind = 0.18) { const layers = [[0.5, 1.3, 220, 'rgba(170,185,215,0.22)', 1.5, 26], [0.85, 1.0, 200, 'rgba(185,200,230,0.32)', 2.5, 40], [1.4, 0.75, 60, 'rgba(200,215,240,0.45)', 4.5, 70]];
    g.save(); g.lineCap = 'round'; layers.forEach(([depth, sp, n, col, w, len], li) => { const r = rng(77 + li); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i < n * amt; i++) { const x0 = r() * 2200 - 140, v = (1500 + r() * 500) * sp, y = ((r() * 1300 + t * v) % 1300) - 110, x = x0 - (y + 110) * wind; g.moveTo(x, y); g.lineTo(x - len * wind, y + len); } g.stroke(); }); g.restore(); }
  function splashes(g, t, x0, x1, y0, y1, n = 40) { const r = rng(91); g.save(); g.strokeStyle = 'rgba(200,215,240,0.55)'; g.lineWidth = 2; for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), ph = (t * (2 + r()) + r()) % 1, s = 6 + 14 * ph; g.globalAlpha = 1 - ph; g.beginPath(); g.ellipse(x, y, s, s * 0.3, 0, 0, Math.PI * 2); g.stroke(); } g.restore(); }
  // The bus: a single decker, going right, not in service, lit from inside, headlights on
  function bus(g, L, x, ground, t, speed) { g.save(); g.translate(x, ground); const wob = Math.sin(t * 30) * 2 * speed;
    g.translate(0, wob); lw(g, 6);
    const body = g.createLinearGradient(0, -380, 0, -40); body.addColorStop(0, '#f5f1e6'); body.addColorStop(0.6, '#d9d3c5'); body.addColorStop(1, '#a8a294'); rr(g, -600, -380, 1200, 330, 36); g.fillStyle = body; g.fill(); g.stroke();
    g.fillStyle = '#f08a1e'; g.fillRect(-596, -160, 1192, 42); g.fillStyle = '#5c3a8a'; g.fillRect(-596, -118, 1192, 16); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-596, -102, 1192, 50);
    for (let k = 0; k < 6; k++) { const wx = -550 + k * 168; rr(g, wx, -340, 148, 140, 10); const wg = g.createLinearGradient(0, -340, 0, -200); wg.addColorStop(0, '#ffeec2'); wg.addColorStop(1, '#d9b46c'); g.fillStyle = wg; g.fill(); lw(g, 4); g.stroke();
      g.fillStyle = 'rgba(60,40,30,0.5)'; for (let s2 = 0; s2 < 2; s2++) rr(g, wx + 16 + s2 * 66, -250, 52, 48, 8), g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(wx + 8, -334); g.lineTo(wx + 60, -334); g.lineTo(wx + 18, -230); g.closePath(); g.fill(); }
    rr(g, 470, -350, 120, 200, 14); g.fillStyle = '#28323f'; g.fill(); lw(g, 5); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(480, -340, 30, 180);
    rr(g, 440, -374, 150, 30, 6); g.fillStyle = '#0d0d10'; g.fill(); g.fillStyle = '#ffb31a'; g.font = '700 18px monospace'; g.textAlign = 'center'; g.fillText('NOT IN SERVICE', 515, -353);
    g.fillStyle = '#fff7d0'; g.beginPath(); g.ellipse(594, -90, 12, 22, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ff3b2f'; g.beginPath(); g.ellipse(-598, -100, 8, 20, 0, 0, Math.PI * 2); g.fill();
    [-390, 380].forEach(wx => { g.fillStyle = '#121216'; g.beginPath(); g.arc(wx, -40, 64, 0, Math.PI * 2); g.fill(); lw(g, 5); g.stroke(); g.save(); g.translate(wx, -40); g.rotate(t * 30 * speed); g.fillStyle = '#8a8d96'; g.beginPath(); g.arc(0, 0, 28, 0, Math.PI * 2); g.fill(); g.fillStyle = '#55585f'; for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); g.fillRect(-3, 8, 6, 16); } g.restore(); });
    g.restore();
    if (L) { const hx = x + 600, hy = ground - 90; L.save(); const beam = L.createLinearGradient(hx, 0, hx + 900, 0); beam.addColorStop(0, 'rgba(255,250,220,0.55)'); beam.addColorStop(1, 'rgba(255,250,220,0)'); L.fillStyle = beam; L.beginPath(); L.moveTo(hx, hy - 14); L.lineTo(hx + 900, hy - 160); L.lineTo(hx + 900, hy + 160); L.lineTo(hx, hy + 14); L.closePath(); L.fill();
      const hg = L.createRadialGradient(hx, hy, 2, hx, hy, 120); hg.addColorStop(0, 'rgba(255,255,230,1)'); hg.addColorStop(1, 'rgba(255,255,230,0)'); L.fillStyle = hg; L.fillRect(hx - 120, hy - 120, 240, 240); L.restore(); } }
  // Puddle water thrown up by the wheel: a curling sheet, spray and drops
  function wave(g, x, ground, k, t) { if (k <= 0 || k >= 1.6) return; g.save(); g.translate(x, ground); const up = Math.sin(Math.PI * Math.min(1, k / 1.1)), h = 640 * up, w = 280 + 520 * Math.min(1, k), fall = Math.max(0, k - 0.6);
    g.globalAlpha = Math.min(1, 1.6 - k);
    for (let L2 = 0; L2 < 3; L2++) { const s2 = 1 - L2 * 0.18; g.fillStyle = ['rgba(90,130,190,0.55)', 'rgba(140,175,225,0.55)', 'rgba(200,225,255,0.6)'][L2]; g.beginPath(); g.moveTo(-80 * s2, 0); g.bezierCurveTo(-30, -h * 0.55 * s2, 90, -h * s2, w * 0.55 * s2, -h * 0.92 * s2 + fall * 200);
      g.bezierCurveTo(w * 0.85 * s2, -h * 0.85 * s2 + fall * 300, w * s2, -h * 0.5 * s2 + fall * 300, w * 0.98 * s2, -h * 0.18 * s2 + fall * 300); g.bezierCurveTo(w * 0.75 * s2, -h * 0.45 * s2, w * 0.4 * s2, -h * 0.45 * s2, 140 * s2, 0); g.closePath(); g.fill(); }
    lw(g, 4); g.strokeStyle = 'rgba(230,245,255,0.8)'; g.beginPath(); g.moveTo(-60, -h * 0.4); g.bezierCurveTo(30, -h * 0.95, 200, -h * 0.98, w * 0.6, -h * 0.9 + fall * 200); g.stroke();
    const r = rng(9); for (let i = 0; i < 70; i++) { const a = -Math.PI * (0.15 + r() * 0.6), sp = 600 + r() * 1100, kk = k * (0.7 + r() * 0.5), px = Math.cos(a) * sp * kk + 40, py = Math.sin(a) * sp * kk + 1300 * kk * kk, rad = 4 + r() * 12; if (py > 10) continue; g.fillStyle = `rgba(215,232,255,${0.85 - r() * 0.3})`; g.beginPath(); g.ellipse(px, py, rad * 0.7, rad * 1.3, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
    g.restore(); }
  // Paint the bus stop at time t through a camera { x, y, s } (world point at the centre of the screen, and zoom)
  function busStopFrame(g, W, H, t, cam, dyn) { const B = busStopLayers(), k = (H / WH) * cam.s;
    const place = (depth) => { g.setTransform(k, 0, 0, k, W / 2 - (cam.x * depth + WW / 2 * (1 - depth)) * k, H / 2 - (cam.y * depth + WH / 2 * (1 - depth)) * k); };
    g.save(); place(0.15); g.drawImage(B.sky, -200, 0); place(0.5); g.drawImage(B.far, 0, 0); place(1);
    if (cam.dof) g.filter = `blur(${cam.dof}px)`; g.drawImage(B.mid, 0, 0); g.drawImage(B.refl, 0, KERB + 14, WW, WH - KERB - 14); g.globalCompositeOperation = 'screen'; g.drawImage(B.light, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    // the drawing between the street and the light: characters, bus, water (in world space)
    if (dyn) dyn(g, k);
    // lamp cones in the rain and the glow
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.7; g.drawImage(B.cones, 0, 0, WW, WH); g.globalAlpha = 1; const fl = 0.75 + 0.25 * Math.sign(Math.sin(t * 37) + Math.sin(t * 11.3) + 1.2); g.globalAlpha = 0.5 * fl; g.fillStyle = 'rgba(210,230,255,0.25)'; g.fillRect(1400, GROUND - 304, 220, 300); g.globalAlpha = 0.55; g.drawImage(B.glow, 0, 0, WW, WH); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.restore(); }
  // Finish: mist, grade, vignette, grain (screen space)
  function finish(g, W, H, t, o = {}) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const mist = g.createLinearGradient(0, H * 0.45, 0, H); mist.addColorStop(0, 'rgba(120,120,150,0)'); mist.addColorStop(1, 'rgba(120,120,150,0.12)'); g.fillStyle = mist; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(30,60,110,0.35)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,10,${o.vig == null ? 0.65 : o.vig})`); g.fillStyle = v; g.fillRect(0, 0, W, H);
    const r = rng(1 + Math.floor(t * 24)); g.globalAlpha = 0.05; for (let i = 0; i < 600; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * W, r() * H, 2, 2); } g.restore(); }
  return { WW, WH, GROUND, KERB, rng, mk, busStopLayers, busStopFrame, bus, wave, rain, splashes, finish, SCRAWL, SANS };
})();

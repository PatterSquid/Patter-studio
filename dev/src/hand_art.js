/* Hands we draw for his puppet (his own drawings have no relaxed talking hand or palm up): a relaxed, half curled
   talking hand seen from the thumb side, and a palm up hand offered for questions and shrugs. Drawn in his style
   (thick dark outline, warm skin with shade and light, freckles) for his left hand with the wrist at the top right;
   Puppet mirrors them for the right and adds them to each hand's swap set as 'talk' and 'palm up'.
   Only shapes live here: nothing of his artwork. */
const HandArt = (() => {
  const mk = () => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const SKIN = '#e4905a', SHADE = '#c26e42', LIGHT = '#f0a46c', LINE = '#140a07';
  const W = 420, H = 380, OL = 3.6;
  function smooth(c, P) { c.moveTo(P[0][0], P[0][1]); if (P.length === 2) { c.lineTo(P[1][0], P[1][1]); return; } for (let i = 1; i < P.length - 1; i++) { const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; c.quadraticCurveTo(P[i][0], P[i][1], i === P.length - 2 ? P[i + 1][0] : mx, i === P.length - 2 ? P[i + 1][1] : my); } }
  function closed(c, P) { const n = P.length, m = i => [(P[i % n][0] + P[(i + 1) % n][0]) / 2, (P[i % n][1] + P[(i + 1) % n][1]) / 2]; const s = m(0); c.moveTo(s[0], s[1]); for (let i = 1; i <= n; i++) { const e = m(i); c.quadraticCurveTo(P[i % n][0], P[i % n][1], e[0], e[1]); } c.closePath(); }
  let T = null, tg = null;
  function part(g, sh, o) {
    o = o || {}; const sx = o.sx == null ? 7 : o.sx, sy = o.sy == null ? -9 : o.sy;
    const path = c => { c.beginPath(); sh.P ? (sh.closed ? closed(c, sh.P) : smooth(c, sh.P)) : sh.f(c); };
    const paint = (c, col, extra) => { path(c); c.lineCap = c.lineJoin = 'round'; if (sh.w) { c.strokeStyle = col; c.lineWidth = sh.w + (extra || 0); c.stroke(); } else { c.fillStyle = col; c.fill(); if (extra) { c.strokeStyle = col; c.lineWidth = extra; c.stroke(); } } };
    if (!o.noLine) paint(g, LINE, OL * 2);
    tg.globalCompositeOperation = 'source-over'; tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, W, H);
    paint(tg, SHADE); tg.globalCompositeOperation = 'source-atop';
    tg.filter = 'blur(6px)'; tg.translate(-sx, sy); paint(tg, SKIN, sh.w ? -6 : -10); tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.filter = 'blur(9px)'; tg.globalAlpha = 0.55; tg.translate(-sx * 2, sy * 2); paint(tg, LIGHT, sh.w ? -sh.w * 0.55 : -40); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalAlpha = 1; tg.filter = 'none';
    // freckles and pores like his drawing
    let s = o.seed || 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { tg.fillStyle = `rgba(170,85,45,${0.05 + r() * 0.08})`; tg.beginPath(); tg.ellipse(r() * W, r() * H, 6 + r() * 12, 4 + r() * 8, r() * 3, 0, 7); tg.fill(); }
    for (let i = 0; i < 60; i++) { tg.fillStyle = `rgba(150,70,35,${0.08 + r() * 0.12})`; tg.beginPath(); tg.ellipse(r() * W, r() * H, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, 7); tg.fill(); }
    if (o.after) o.after(tg);
    if (o.clip) { const M = mk(), mg = M.getContext('2d'); mg.filter = 'blur(12px)'; mg.beginPath(); closed(mg, o.clip); mg.fill(); mg.filter = 'none'; mg.globalCompositeOperation = 'source-in'; mg.drawImage(T, 0, 0); g.drawImage(M, 0, 0); } else g.drawImage(T, 0, 0);
  }
  function line(g, P, w, a) { g.save(); g.beginPath(); smooth(g, P); g.lineCap = 'round'; g.strokeStyle = LINE; g.globalAlpha = a == null ? 1 : a; g.lineWidth = w; g.stroke(); g.restore(); }
  function nail(g, cx, cy, rx, ry, rot) { g.save(); g.translate(cx, cy); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fillStyle = '#eaa77a'; g.fill(); g.lineWidth = 3; g.strokeStyle = LINE; g.stroke(); g.beginPath(); g.ellipse(-rx * 0.15, -ry * 0.2, rx * 0.5, ry * 0.4, 0, 0, 7); g.fillStyle = 'rgba(255,215,180,0.45)'; g.fill(); g.restore(); }

  /* the talking hand: his left, relaxed and half curled, seen from the thumb side, wrist at the top right */
  const BODY = { P: [[378, 36], [300, 46], [222, 78], [192, 118], [200, 168], [262, 196], [342, 182], [388, 150]], closed: true };
  function talk(g) {
    part(g, { P: [[300, 172], [268, 202], [258, 232], [272, 252]], w: 44 }, { seed: 5 });
    part(g, { P: [[268, 165], [228, 192], [210, 228], [220, 256], [244, 262]], w: 50 }, { seed: 4 });
    part(g, { P: [[240, 148], [190, 168], [162, 204], [166, 240], [192, 252]], w: 54 }, { seed: 3 });
    part(g, BODY, { seed: 9, sx: 4, sy: -12 });
    // the index finger: out from the knuckle, curling down and back in
    part(g, { P: [[226, 104], [166, 116], [128, 148], [120, 194], [142, 222]], w: 56 }, { seed: 11 });
    nail(g, 140, 228, 14, 9, 0.5);
    line(g, [[128, 168], [140, 176], [150, 172]], 3, 0.7); line(g, [[124, 178], [136, 186], [146, 184]], 2.5, 0.5);
    line(g, [[160, 108], [168, 120], [166, 132]], 3, 0.6);
    // the thumb from the palm side, its tip resting on the bent index finger
    part(g, { P: [[350, 128], [292, 146], [232, 160], [186, 168]], w: 50 }, { seed: 13, sx: 3, sy: -10 });
    part(g, BODY, { seed: 9, sx: 4, sy: -12, noLine: true, clip: [[345, 70], [420, 60], [420, 165], [345, 165], [330, 120]] });
    nail(g, 192, 160, 16, 10, -0.1);
    line(g, [[248, 150], [244, 160], [250, 172]], 3, 0.6);
    // knuckle and tendons on the back of the hand
    line(g, [[232, 92], [246, 84], [262, 88]], 3, 0.45); line(g, [[280, 72], [320, 70], [350, 64]], 2.5, 0.3);
  }
  /* palm up, offered: his left hand turned over, fingers loose and a little curled, thumb out to the side */
  const PALM = { P: [[384, 56], [306, 66], [220, 104], [194, 156], [214, 202], [300, 210], [372, 176]], closed: true };
  function nailEdge(g, x, y, r, rot) { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, r, r * 0.45, 0, Math.PI, 2 * Math.PI); g.fillStyle = '#eaa77a'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = LINE; g.stroke(); g.restore(); }
  function palmUp(g) {
    part(g, { P: [[228, 196], [180, 206], [146, 214], [124, 206]], w: 40 }, { seed: 21, sy: 8 });
    part(g, { P: [[214, 172], [160, 180], [112, 186], [86, 176]], w: 46 }, { seed: 22, sy: 8 });
    part(g, { P: [[210, 144], [150, 146], [98, 148], [68, 136]], w: 50 }, { seed: 23, sy: 8 });
    part(g, { P: [[222, 116], [160, 112], [110, 110], [80, 98]], w: 48 }, { seed: 24, sy: 8 });
    [[150, 113, 0.0], [116, 112, -0.1], [140, 147, 0.0], [104, 149, -0.1], [150, 181, 0.1], [118, 186, 0.0], [168, 207, 0.15], [142, 213, 0.0]].forEach(([x, y, r]) => line(g, [[x - 1, y - 14], [x + 3, y], [x - 1, y + 14]].map(([a, b]) => [x + (a - x) * Math.cos(r) - (b - y) * Math.sin(r), y + (a - x) * Math.sin(r) + (b - y) * Math.cos(r)]), 2.5, 0.55));
    part(g, PALM, { seed: 25, sx: -4, sy: 10, after: c => { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,200,160,0.25)'; c.beginPath(); c.ellipse(285, 140, 70, 45, -0.2, 0, 7); c.fill(); } });
    line(g, [[222, 128], [262, 116], [306, 112], [338, 98]], 3, 0.55); line(g, [[226, 160], [272, 150], [318, 150], [352, 132]], 3, 0.5); line(g, [[338, 88], [312, 132], [318, 178], [340, 196]], 3, 0.45);
    // the thumb out to the side, its nail seen edge on
    part(g, { P: [[340, 96], [296, 66], [252, 46], [212, 42]], w: 50 }, { seed: 26, sx: 3, sy: -8 });
    part(g, PALM, { seed: 25, sx: -4, sy: 10, noLine: true, clip: [[322, 76], [410, 60], [410, 150], [330, 140], [310, 110]] });
    nailEdge(g, 214, 34, 16, -0.15);
    line(g, [[262, 40], [258, 52], [264, 64]], 3, 0.55);
  }

  const WR = [382, 94];   // the middle of the wrist in the drawing
  function draw(kind, g) { if (!T) { T = mk(); tg = T.getContext('2d'); } if (kind === 'talk') talk(g); else if (kind === 'palm up') palmUp(g); }
  return { W, H, WR, draw, kinds: ['talk', 'palm up'] };
})();

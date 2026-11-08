/* Street3D: a 3D Coatbridge tenement street at night for the intro (raymarched with G3). Wet road that mirrors the
   lights, red sandstone tenements with sash windows, lit shops at street level, sodium lamps with haloes in the rain,
   a parked motor whose alarm goes off. His icon (Squid) stands in the middle of the road as a lit cut out that casts
   a shadow and shows in the puddles. The title stands on the road as chunky 3D letters.
   Gag ("Shut it!"): the letters slam down, the alarm goes, a window flies up, Senga in her curlers yells SHUT IT! and
   lobs a slipper that bounces off his heid. All a pure function of time. */
const Street3D = (() => {
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, f) => a + (b - a) * f, mixV = (A, B, f) => A.map((v, i) => lerp(v, B[i], f));
  const ease = f => { f = cl(f); return f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; }, eo = f => 1 - Math.pow(1 - cl(f), 3), ei = f => Math.pow(cl(f), 3);
  const bump = (k, w) => k < 0 || k > w ? 0 : Math.sin(Math.PI * k / w);
  const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const TITLE = '"Bricolage Grotesque", "Segoe UI Black", "Arial Black", sans-serif', HEAVY = '"Boldonse", "Bricolage Grotesque", "Arial Black", sans-serif';
  const BAY = 3.4, WIN = { side: -1, cz: -1, floor: 0 }; // Senga's window: left side, bay -1, first floor up
  /* ---------- textures painted once: shopfronts ---------- */
  let atlas = null;
  function shopAtlas() { if (atlas) return atlas; const W = 2048, H = 512, c = mk(W, H), g = c.getContext('2d'), r = rng(5);
    const shops = [['Chips', '#1c5aa6', '#ffffff', 'warm', 'FISH SUPPERS · PIES · PAKORA'], ['Bet Lucky', '#1f7a43', '#ffffff', 'cool', 'ODDS ON · CASH OUT'], ['Booze', '#7a1d6b', '#ffe66a', 'warm', 'OFF SALES · OPEN TILL 10'], ['Cash 4 Gold', '#d9a514', '#1a1a1a', 'warm', 'WE BUY ANYTHING']];
    shops.forEach(([name, bg, fg, tone, strap], i) => { const x = i * 512;
      // fascia sign (top 130 px)
      const sg = g.createLinearGradient(0, 0, 0, 130); sg.addColorStop(0, bg); sg.addColorStop(1, shade(bg, -0.25)); g.fillStyle = sg; g.fillRect(x, 0, 512, 130);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 86; g.font = `700 ${fs}px ${TITLE}`; while (g.measureText(name).width > 440) { fs -= 4; g.font = `700 ${fs}px ${TITLE}`; } g.fillText(name, x + 256, 62);
      g.font = `700 18px ${TITLE}`; g.globalAlpha = 0.85; g.fillText(strap, x + 256, 112); g.globalAlpha = 1;
      // the shop window (rest): lit interior, counter, shelves, posters
      const iw = g.createLinearGradient(0, 130, 0, 512); iw.addColorStop(0, tone === 'warm' ? '#fff0c4' : '#d9f2ff'); iw.addColorStop(1, tone === 'warm' ? '#e0a050' : '#6aa8c8'); g.fillStyle = iw; g.fillRect(x, 130, 512, 382);
      g.fillStyle = 'rgba(70,40,25,0.35)'; for (let k = 0; k < 3; k++) g.fillRect(x + 20, 190 + k * 70, 472, 10);
      for (let k = 0; k < 26; k++) { g.fillStyle = ['#c33', '#36c', '#3a4', '#e92', '#fff'][k % 5]; g.fillRect(x + 30 + r() * 440, 150 + (k % 3) * 70 + 18, 16 + r() * 14, 22 + r() * 12); }
      g.fillStyle = 'rgba(40,25,20,0.55)'; g.fillRect(x, 400, 512, 112); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x, 130); g.lineTo(x + 180, 130); g.lineTo(x, 400); g.fill();
      if (i === 0) { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x + 330, 300, 150, 80, 8); g.fill(); g.fillStyle = '#c4141c'; g.font = `700 22px ${TITLE}`; g.fillText('Squid', x + 405, 326); g.fillText('supper £6', x + 405, 356); }
      if (i === 1) { g.fillStyle = '#ffe14a'; g.font = `700 30px ${TITLE}`; g.fillText('Airdrie to win', x + 256, 330); g.fillText('500/1', x + 256, 366); }
      g.strokeStyle = '#1a1a20'; g.lineWidth = 10; g.strokeRect(x + 5, 135, 502, 372); g.beginPath(); g.moveTo(x + 256, 135); g.lineTo(x + 256, 507); g.stroke(); });
    return (atlas = c); }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(cl(v * (1 + f), 0, 255))); return `rgb(${c.join(',')})`; }
  /* ---------- Senga, in her curlers, at the window ---------- */
  const sengaC = {}; function senga(pose) { const key = pose; if (sengaC[key]) return sengaC[key]; const c = mk(512, 512), g = c.getContext('2d'); const O = '#1a1418';
    const L = (w) => { g.lineWidth = w; g.strokeStyle = O; g.lineJoin = 'round'; g.lineCap = 'round'; };
    // dressing gown (pink, fluffy edges) and the window sill she leans on
    L(8); g.fillStyle = '#e38ab0'; g.beginPath(); g.moveTo(90, 512); g.bezierCurveTo(90, 360, 160, 300, 256, 300); g.bezierCurveTo(352, 300, 422, 360, 422, 512); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#f6c6da'; g.beginPath(); g.moveTo(206, 304); g.lineTo(256, 400); g.lineTo(306, 304); g.lineTo(290, 300); g.lineTo(256, 360); g.lineTo(222, 300); g.closePath(); g.fill(); g.stroke();
    // arm: raised with the slipper, or flung forward after the throw
    const armUp = pose === 'up'; L(8); g.fillStyle = '#e38ab0'; g.beginPath(); if (armUp) { g.moveTo(370, 360); g.bezierCurveTo(420, 300, 440, 220, 430, 150); g.lineTo(390, 150); g.bezierCurveTo(395, 220, 380, 280, 340, 330); } else { g.moveTo(360, 360); g.bezierCurveTo(400, 380, 450, 400, 500, 410); g.lineTo(500, 450); g.bezierCurveTo(440, 440, 380, 420, 330, 390); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#f2c8a8'; g.beginPath(); armUp ? g.ellipse(410, 140, 26, 24, 0, 0, Math.PI * 2) : g.ellipse(500, 430, 24, 26, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    if (armUp) { g.save(); g.translate(410, 100); g.rotate(-0.5); g.fillStyle = '#ff9ac8'; g.beginPath(); g.ellipse(0, 0, 26, 56, 0, 0, Math.PI * 2); g.fill(); L(6); g.stroke(); g.fillStyle = '#fff3f8'; for (let k = 0; k < 10; k++) { g.beginPath(); g.arc(-20 + (k % 5) * 10, -40 + Math.floor(k / 5) * 10, 7, 0, Math.PI * 2); g.fill(); } g.restore(); }
    // head
    L(8); g.fillStyle = '#f2c8a8'; g.beginPath(); g.ellipse(256, 210, 92, 104, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(200,110,100,0.35)'; g.beginPath(); g.ellipse(200, 250, 22, 14, 0, 0, Math.PI * 2); g.ellipse(312, 250, 22, 14, 0, 0, Math.PI * 2); g.fill();
    // furious eyebrows, wee screwed up eyes, the mouth wide open mid SHUT IT
    L(10); g.beginPath(); g.moveTo(190, 168); g.lineTo(240, 188); g.moveTo(322, 168); g.lineTo(272, 188); g.stroke();
    g.fillStyle = O; g.beginPath(); g.ellipse(220, 205, 9, 7, 0, 0, Math.PI * 2); g.ellipse(292, 205, 9, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a1420'; g.beginPath(); g.ellipse(256, 268, 40, armUp ? 34 : 22, 0, 0, Math.PI * 2); g.fill(); L(6); g.stroke(); g.fillStyle = '#e05a6a'; g.beginPath(); g.ellipse(256, 286, 20, 9, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.fillRect(236, 240, 40, 8);
    L(6); g.beginPath(); g.moveTo(256, 215); g.quadraticCurveTo(270, 235, 254, 240); g.stroke();
    // headscarf over the curlers, rollers poking out
    L(8); g.fillStyle = '#7fc6e0'; g.beginPath(); g.moveTo(160, 190); g.bezierCurveTo(150, 90, 230, 70, 256, 72); g.bezierCurveTo(300, 70, 362, 90, 352, 190); g.bezierCurveTo(330, 140, 190, 140, 160, 190); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(190 + k * 22, 110 + Math.sin(k) * 8, 5, 0, Math.PI * 2); g.fill(); }
    [[168, 150], [344, 150], [182, 120], [330, 120]].forEach(([x, y]) => { g.fillStyle = '#ff7eb6'; g.beginPath(); g.roundRect(x - 16, y - 12, 32, 24, 10); g.fill(); L(5); g.stroke(); });
    return (sengaC[key] = c); }
  /* ---------- the scene shader ---------- */
  const FS = () => `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform vec3 uEye, uTgt; uniform float uFov, uT, uFade;
uniform sampler2D uSquid, uName, uAtlas, uSenga; uniform vec3 uSqP; uniform vec2 uSqS;
uniform vec4 uNameBox; uniform vec3 uNameP; uniform float uNameS, uNameSq, uHasName;
uniform float uWinOpen, uWinLit, uSengaOn, uAlarm, uFlash; uniform vec4 uSlip; uniform float uSlipRot;
${G3.COMMON}
const float BAY = ${BAY.toFixed(2)}, FW = 6.5, TOP = 15.6;
const vec3 SODIUM = vec3(1., .62, .32);
vec3 lampPos(int k, float side){ return vec3(side * 4.75, 5.35, 6. - float(k) * 9.); }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
// one side of tenements (side -1 left, +1 right) in its own frame: u along the street, v up, w into the stone
float facade(vec3 p, float side, out float m){ float w = side * p.x - FW, u = p.z, v = p.y; float d = -w; m = 3.;
  float cz = floor(u / BAY), uc = u - (cz + .5) * BAY, h = hash12(vec2(cz, side));
  if (v > 3.85){ float fl = floor((v - 3.85) / 3.), vc = v - 3.85 - (fl + .5) * 3.; if (fl < 4.){ float rec = sdBox(vec3(uc, vc + .05, w), vec3(.62, .98, .3)); if (-rec > d){ d = -rec; m = 4.; } }
    d = min(d, sdBox(vec3(uc, vc - 1.07, w + .05), vec3(.78, .07, .12))); }
  else { float rec = sdBox(vec3(uc, v - 1.75, w), vec3(1.45, 1.3, .32)); if (-rec > d){ d = -rec; m = 5.; } float fas = sdBox(vec3(uc, v - 3.33, w + .1), vec3(1.62, .36, .12)); if (fas < d){ d = fas; m = 6.; } }
  float ledge = sdBox(vec3(0., v - 3.85, w + .06), vec3(1e3, .1, .14)); if (ledge < d){ d = ledge; m = 3.; }
  d = max(d, v - TOP); float ch = sdBox(vec3(mod(u, BAY * 2.) - BAY, v - TOP - .9, w - 1.2), vec3(.5, .9, .4)); if (ch < d){ d = ch; m = 3.; }
  return d; }
float lampD(vec3 p, out float m){ float d = 1e9; m = 0.; for (int s = 0; s < 2; s++){ float side = s == 0 ? -1. : 1.; float zz = mod(p.z - 6. + 4.5, 9.) - 4.5; if (p.z > 10. || p.z < -50.) continue;
    vec3 q = vec3(side * p.x - 5.9, p.y, zz); float post = max(length(q.xz) - .08, abs(q.y - 2.75) - 2.75); float arm = sdBox(q - vec3(-.6, 5.45, 0.), vec3(.62, .05, .05)); float head = sdBox(q - vec3(-1.15, 5.38, 0.), vec3(.32, .07, .16));
    float dd = min(post, arm); if (dd < d){ d = dd; m = 7.; } if (head < d){ d = head; m = 8.; } } return d; }
float carD(vec3 p){ vec3 q = p - vec3(2.9, 0., -7.); float body = sdRoundBox(q - vec3(0., .62, 0.), vec3(.9, .38, 2.1), .2); float cab = sdRoundBox(q - vec3(0., 1.18, -.2), vec3(.78, .32, 1.15), .25);
  float wh = min(min(length(vec2(length(q.yz - vec2(.38, 1.35)) - .0, q.x - .82)) , 9.), 9.); vec3 wq = vec3(abs(q.x) - .8, q.y - .38, abs(q.z) - 1.35); float wheel = max(length(wq.yz) - .38, abs(wq.x) - .14);
  return min(min(body, cab), wheel); }
float titleD(vec3 p){ if (uHasName < .5) return 1e9; vec3 q = p - uNameP; q.y /= uNameSq; q.xz /= 1. / sqrt(uNameSq); q /= uNameS; float d2 = texSdf(uName, uNameBox, q.xy); return sdExtrude(d2 + .01, q.z + .45, .9, .07) * uNameS * min(uNameSq, 1.); }
float slipD(vec3 p){ if (uSlip.w < .5) return 1e9; vec3 q = p - uSlip.xyz; q.xy = rot2(-uSlipRot) * q.xy; q.yz = rot2(-uSlipRot * .7) * q.yz; return sdRoundBox(q, vec3(.13, .05, .28), .05); }
float map(vec3 p, out float m){ float d = p.y, mm; m = 1.; // road
  float pv = min(sdBox(vec3(p.x + 5.25, p.y, p.z), vec3(1.25, .16, 200.)), sdBox(vec3(p.x - 5.25, p.y, p.z), vec3(1.25, .16, 200.))); if (pv < d){ d = pv; m = 2.; }
  float f1 = facade(p, -1., mm); if (f1 < d){ d = f1; m = mm; } float f2 = facade(p, 1., mm); if (f2 < d){ d = f2; m = mm; }
  float l = lampD(p, mm); if (l < d){ d = l; m = mm; }
  float t = titleD(p); if (t < d){ d = t; m = 10.; }
  float s = slipD(p); if (s < d){ d = s; m = 12.; }
  return d; }
float mapD(vec3 p){ float m; return map(p, m); }
vec3 nrm(vec3 p){ const vec2 e = vec2(.002, -.002); return normalize(e.xyy * mapD(p + e.xyy) + e.yyx * mapD(p + e.yyx) + e.yxy * mapD(p + e.yxy) + e.xxx * mapD(p + e.xxx)); }
float march(vec3 ro, vec3 rd, float tmax, out float m, int steps){ float t = .02; m = 0.; for (int i = 0; i < 200; i++){ if (i >= steps) break; vec3 p = ro + rd * t; float d = map(p, m); if (abs(d) < .0007 * t) return t; t += d * .9; if (t > tmax) break; } m = 0.; return 1e9; }
// The squid cut out: a picture standing upright facing the camera's way along the street
vec4 squidAt(vec3 ro, vec3 rd, out float tq){ tq = 1e9; if (abs(rd.z) < 1e-4) return vec4(0.); float t = (uSqP.z - ro.z) / rd.z; if (t < .01) return vec4(0.); vec3 p = ro + rd * t; vec2 uv = vec2((p.x - uSqP.x) / uSqS.x + .5, 1. - (p.y - uSqP.y) / uSqS.y);
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) return vec4(0.); vec4 c = texture(uSquid, uv); if (c.a < .5) return vec4(0.); tq = t; return c; }
float squidShadow(vec3 p, vec3 L){ vec3 d = L - p; if (abs(d.z) < 1e-4) return 1.; float t = (uSqP.z - p.z) / d.z; if (t < 0. || t > 1.) return 1.; vec3 q = p + d * t; vec2 uv = vec2((q.x - uSqP.x) / uSqS.x + .5, 1. - (q.y - uSqP.y) / uSqS.y); if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) return 1.; return 1. - .85 * smoothstep(.2, .8, texture(uSquid, uv).a); }
float softSh(vec3 p, vec3 L){ vec3 d = L - p; float tm = length(d); d /= tm; float r = 1., t = .03; for (int i = 0; i < 22; i++){ float h = mapD(p + d * t); r = min(r, 8. * h / t); t += clamp(h, .03, .6); if (r < .02 || t > tm - .3) break; } return clamp(r, 0., 1.) * squidShadow(p, L); }
// sandstone: blocks, joints, weathering, soot
vec3 stone(vec3 p, float side, out float rough){ vec2 s = vec2(p.z, p.y); float bh = .42, row = floor(s.y / bh), off = hash12(vec2(row, side)) * 1.1, bw = .95, cx = (s.x + off) / bw; vec2 id = vec2(floor(cx), row); float rx = fract(cx) * bw, ry = s.y - row * bh;
  float j = 1. - smoothstep(.0, .025, min(min(rx, bw - rx), min(ry, bh - ry))); vec3 c = vec3(.26, .1, .07) * (.75 + .5 * hash12(id + 3.)); c *= .8 + .35 * fbm(s * 3.); c = mix(c, vec3(.05, .04, .04), smoothstep(.55, .85, fbm(vec2(s.x * 1.5, s.y * .25))) * .55); c = mix(c, vec3(.1, .09, .08), j); rough = .8; return c; }
vec3 lampLight(vec3 p, vec3 n, bool sh){ vec3 c = vec3(0.); int k0 = int(clamp(floor((6. - p.z) / 9. + .5), 0., 6.));
  for (int k = 0; k < 7; k++){ for (int s = 0; s < 2; s++){ vec3 L = lampPos(k, s == 0 ? -1. : 1.) + vec3(0., -.1, 0.); vec3 d = L - p; float dl = length(d); d /= dl; float a = max(dot(n, d), 0.) / (1. + dl * dl * .11); if (a < .002) continue; if (sh && abs(k - k0) <= 0) a *= softSh(p + n * .02, L); c += SODIUM * a * 1.5; } }
  // the motor's hazard lights when the alarm is going
  if (uAlarm > 0.){ vec3 L = vec3(2.9, .7, -4.85); vec3 d = L - p; float dl = length(d); c += vec3(1., .55, .1) * uAlarm * max(dot(n, d / dl), 0.) / (1. + dl * dl * 1.5) * 1.2; }
  // Senga's window
  if (uWinLit > 0.){ vec3 L = vec3(-FW + .3, 5.2, (float(${WIN.cz}) + .5) * BAY); vec3 d = L - p; float dl = length(d); c += vec3(1., .78, .5) * uWinLit * max(dot(n, d / dl), 0.) / (1. + dl * dl * .25) * 2.; }
  return c; }
vec3 shopLight(vec3 p, vec3 n){ vec3 c = vec3(0.); for (int s = 0; s < 2; s++){ float side = s == 0 ? -1. : 1.; float cz = floor(p.z / BAY); for (int k = -1; k <= 1; k++){ float z = (cz + float(k) + .5) * BAY, h = hash12(vec2(cz + float(k), side)); if (h < .35) continue; vec3 L = vec3(side * (FW - .8), 1.6, z); vec3 d = L - p; float dl = length(d); vec3 tint = h < .7 ? vec3(1., .8, .5) : vec3(.6, .85, 1.); c += tint * max(dot(n, d / dl), 0.) / (1. + dl * dl * .5) * 1.2; } } return c; }
vec3 sky(vec3 rd){ vec3 c = mix(vec3(.12, .07, .06), vec3(.02, .025, .05), smoothstep(0., .5, rd.y)); return c + vec3(.3, .14, .06) * exp(-max(rd.y, 0.) * 8.); }
// What a surface looks like (no reflections: used for both the eye and the mirror in the road)
vec3 shade(vec3 p, vec3 rd, float m, bool sh, out float gloss){ vec3 n = nrm(p); if (m > 9.5 && m < 10.5 && n.z > .55) n = vec3(0., 0., 1.); gloss = 0.; vec3 alb = vec3(.1), em = vec3(0.); float side = sign(p.x);
  if (m < 1.5){ float pud = smoothstep(.5, .62, fbm(p.xz * .3 + 2.)) * smoothstep(1.2, 2.6, length(p.xz - uSqP.xz)); alb = vec3(.03, .031, .035) * (.7 + .6 * fbm(p.xz * 5.)); if (abs(p.x) < .07 && fract(p.z * .25) < .55) alb = vec3(.45, .43, .36); gloss = mix(.22, .85, pud); }
  else if (m < 2.5){ vec2 g = fract(p.xz * vec2(1.1, 1.1)); float j = smoothstep(.0, .04, min(min(g.x, 1. - g.x), min(g.y, 1. - g.y))); alb = vec3(.16, .155, .15) * (.6 + .4 * j) * (.85 + .3 * fbm(p.xz * 3.)); gloss = .35; if (abs(p.x) < 4.15 && p.y > .1) alb = vec3(.32, .3, .28); }
  else if (m < 3.5){ float r; alb = stone(p, side, r); }
  else if (m < 4.5){ // a window: dark glass or someone's living room
    float cz = floor(p.z / BAY), fl = floor((p.y - 3.85) / 3.), h = hash12(vec2(cz * 7.1 + fl, side * 3.)); bool senga = side < 0. && cz == float(${WIN.cz}) && fl == float(${WIN.floor});
    float back = side * p.x - FW; if (back > .2){ vec2 lp = vec2(p.z - (cz + .5) * BAY, p.y - 3.85 - (fl + .5) * 3.); float lit = senga ? uWinLit : step(.72, h);
      vec3 room = mix(vec3(1., .72, .4), vec3(.55, .75, 1.), step(.93, h)) * (1.2 + .5 * fbm(lp * 3. + h * 9.)); float curt = smoothstep(.36, .3, abs(lp.x)) ; room *= mix(.35, 1., curt);
      bool open = senga && lp.y < 0. && uWinOpen > 0.; em = lit * room * (open ? 1.3 : .9); alb = vec3(.02, .025, .035); gloss = open ? 0. : .7; if (abs(lp.x) < .02 || abs(lp.y - mix(0., .9, senga ? uWinOpen : 0.)) < .03) { em *= .2; alb = vec3(.7, .68, .6); } }
    else { float r; alb = stone(p, side, r) * .8; } }
  else if (m < 5.5){ float back = side * p.x - FW; float cz = floor(p.z / BAY), h = hash12(vec2(cz, side)); if (back > .25){ if (h < .35){ alb = vec3(.32, .33, .36) * (.7 + .3 * step(.5, fract(p.y * 7.))); gloss = .2; } else { int idx = int(floor(h * 7.)) % 4; vec2 uv = vec2((float(idx) + .5 + (p.z - (cz + .5) * BAY) / 2.9 * side) / 4., 130. / 512. + (1. - (p.y - .45) / 2.6) * (382. / 512.)); em = pow(texture(uAtlas, uv).rgb, vec3(2.2)) * 1.4; alb = vec3(0.); gloss = .5; } } else alb = vec3(.06); }
  else if (m < 6.5){ float cz = floor(p.z / BAY), h = hash12(vec2(cz, side)); if (h < .35){ alb = vec3(.06, .06, .07); } else { int idx = int(floor(h * 7.)) % 4; vec2 uv = vec2((float(idx) + .5 + (p.z - (cz + .5) * BAY) / 3.24 * side) / 4., (1. - (p.y - 2.97) / .72) * 130. / 512.); em = pow(texture(uAtlas, uv).rgb, vec3(2.2)) * 1.1; alb = vec3(0.); } }
  else if (m < 7.5){ alb = vec3(.05, .055, .06); gloss = .4; }
  else if (m < 8.5){ alb = vec3(.1); em = n.y < -.5 ? vec3(1., .7, .35) * 6. : vec3(0.); }
  else if (m < 9.5){ alb = vec3(.25, .02, .03); gloss = .8; if (p.y > 1.0 && p.y < 1.45 && abs(abs(p.x - 2.9) - .0) < .9) { alb = vec3(.02, .03, .05); gloss = 1.; } if (uAlarm > 0. && p.y > .55 && p.y < .75 && (abs(p.z + 7. - 2.25) < .2 || abs(p.z + 7. + 2.25) < .2)) em = vec3(1., .5, .05) * uAlarm * 6.; }
  else if (m < 10.5){ vec3 q = (p - uNameP) / uNameS; bool face = n.z > .6; alb = face ? vec3(.95, .93, .88) : vec3(.02, .16, .55); gloss = face ? .25 : .3; }
  else { alb = vec3(1., .5, .72); gloss = .1; }
  vec3 li = lampLight(p, n, sh) + shopLight(p, n) + vec3(.03, .04, .075) * (.6 + .4 * n.y);
  if (m < 2.5){ vec2 dq = (p.xz - uSqP.xz) / vec2(uSqS.x * .55, .55); li *= mix(.35, 1., smoothstep(.2, 1., length(dq))); }
  vec3 c = alb * li + em;
  if (gloss > 0.){ vec3 r = reflect(rd, n); for (int k = 0; k < 7; k++){ for (int s = 0; s < 2; s++){ vec3 d = normalize(lampPos(k, s == 0 ? -1. : 1.) - p); c += SODIUM * pow(max(dot(r, d), 0.), 60.) * gloss * .8; } } }
  return c; }
// Light hanging in the wet air round each lamp, the shops and the alarm
vec3 haze(vec3 ro, vec3 rd, float tmax){ vec3 c = vec3(0.); for (int k = 0; k < 7; k++){ for (int s = 0; s < 2; s++){ vec3 L = lampPos(k, s == 0 ? -1. : 1.); float t = clamp(dot(L - ro, rd), 0., tmax); float d = length(ro + rd * t - L); c += SODIUM * .018 / (d * d + .12) * exp(-t * .03); } }
  if (uAlarm > 0.){ vec3 L = vec3(2.9, .7, -4.85); float t = clamp(dot(L - ro, rd), 0., tmax); float d = length(ro + rd * t - L); c += vec3(1., .55, .1) * uAlarm * .012 / (d * d + .08); }
  if (uWinLit > 0.){ vec3 L = vec3(-FW + .2, 5.1, (float(${WIN.cz}) + .5) * BAY); float t = clamp(dot(L - ro, rd), 0., tmax); float d = length(ro + rd * t - L); c += vec3(1., .75, .45) * uWinLit * .06 / (d * d + .4); }
  return c * (1. + uFlash * 2.); }
vec3 squidCol(vec4 c, vec3 p){ vec3 col = c.rgb / max(c.a, .01); vec3 n = vec3(0., 0., 1.); vec3 li = lampLight(p + vec3(0., 0., .05), n, false) * .35 + vec3(.2, .21, .26) + shopLight(p, n) * .2; return col * li; }
void main(){
  vec3 f = normalize(uTgt - uEye), rr = normalize(cross(f, vec3(0., 1., 0.))), up = cross(rr, f);
  vec2 sp = (gl_FragCoord.xy - .5 * uRes) / (.5 * uRes.y); vec3 rd = normalize(f / tan(uFov * .5) + rr * sp.x + up * sp.y), ro = uEye;
  float m, tq; float t = march(ro, rd, 120., m, 160); vec4 sq = squidAt(ro, rd, tq); vec3 col;
  if (sq.a > 0. && tq < t){ vec3 p = ro + rd * tq; col = squidCol(sq, p); t = tq; }
  else if (t < 1e8){ vec3 p = ro + rd * t; float gl; col = shade(p, rd, m, true, gl);
    // the wet road and pavements mirror the street
    if (gl > .05){ vec3 n = nrm(p); n = normalize(n + vec3(fbm(p.xz * 5.) - .5, 0., fbm(p.xz * 5. + 9.) - .5) * mix(.25, .05, gl) * (m < 1.5 ? 1. : .6)); vec3 r = reflect(rd, n); float fr = .04 + .96 * pow(1. - max(dot(n, -rd), 0.), 5.); float m2, tq2; float t2 = march(p + n * .03, r, 60., m2, 70); vec4 s2 = squidAt(p + n * .03, r, tq2); vec3 rc;
      if (s2.a > 0. && tq2 < t2) rc = squidCol(s2, p + r * tq2); else if (t2 < 1e8){ float g2; rc = shade(p + r * t2, r, m2, false, g2); } else rc = sky(r); rc += haze(p, r, min(t2, 60.));
      col = mix(col, rc, clamp(gl * (.3 + .7 * fr), 0., 1.)); } }
  else col = sky(rd);
  col += haze(ro, rd, min(t, 120.)); col = mix(col, vec3(.035, .03, .045), 1. - exp(-min(t, 200.) * .018));
  o = vec4(max(col, 0.) * uFade, 1.); }`;
  let sqCanvas = null;
  /* Render one frame: s = { cam: {e, a, fov}, squid: pose (or null), sqP: [x, y, z], title: {on, y, s, sq}, winOpen, winLit, alarm, slip: [x, y, z, on], slipRot, senga: 'up'|'throw'|null, flash } */
  function frame(g, W, H, t, s, name) {
    if (typeof G3 === 'undefined' || !G3.available()) return false;
    const nm = G3.textSdf(name || 'PatterSquid', TITLE, { worldW: 10.4, maxWorldH: 4.4, weight: '700', spacing: 0.0, key: 's3', px: 220 }); if (!nm) return false;
    // his icon, posed, into a picture the street can use
    if (!sqCanvas) sqCanvas = mk(600, 800); const sg = sqCanvas.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, 600, 800); if (s.squid && typeof Squid !== 'undefined') Squid.draw(sg, 300, 790, 760, s.squid);
    if (s.hat) s.hat(sg);
    const SQH = 2.0 * (s.sqScale || 1), SQW = SQH * 600 / 800;
    return G3.render('street3', FS(), g, W, H, P => { const S = (k, v) => G3.set(P, k, v); S('uEye', s.cam.e); S('uTgt', s.cam.a); S('uFov', s.cam.fov); S('uT', t); S('uFade', s.fade == null ? 1 : s.fade);
      G3.tex(0, G3.imageTex('s3squid', sqCanvas, true), P, 'uSquid'); S('uSqP', [s.sqP[0], s.sqP[1] - 10 / 800 * SQH, s.sqP[2]]); S('uSqS', [SQW, SQH]);
      G3.tex(1, nm.tex, P, 'uName'); S('uNameBox', nm.box); S('uNameP', s.title.p); S('uNameS', s.title.s || 1); S('uNameSq', s.title.sq || 1); S('uHasName', s.title.on ? 1 : 0);
      G3.tex(2, G3.imageTex('s3atlas', shopAtlas()), P, 'uAtlas');
      S('uWinOpen', s.winOpen || 0); S('uWinLit', s.winLit || 0); S('uAlarm', s.alarm || 0); S('uFlash', s.flash || 0); S('uSlip', s.slip || [0, 0, 0, 0]); S('uSlipRot', s.slipRot || 0);
    }, { scale: s.scale || 1, adaptive: !!s.adaptive, t, bloom: 0.8, expo: 1.15, grain: 0.035, thresh: 0.75, vig: 0.75 }); }
  const camera = (cam, W, H) => G3.camera(cam.e, cam.a, cam.fov, W, H);
  return { frame, camera, senga, shopAtlas, BAY, WIN, TITLE, HEAVY, ease, eo, ei, bump, lerp, mixV, cl, rng, mk };
})();

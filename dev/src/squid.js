/* Squid: his own PatterSquid icon (assets/studio-squid.png, embedded as STUDIO_SQUID) rigged as a cartoon puppet.
   The real picture is laid on a fine mesh and bent on the graphics card: squash and stretch from the feet, the head
   leaning on the neck, the tentacles rippling, splaying in a fright or drooping, an outer tentacle lifted to wave, the
   eyes growing or shrinking, eyelids (painted from the skin above each eye), wet sheen, and the light of the scene on
   it (ambient tint and a rim light from one side). Nothing is redrawn: it is always his icon.
   draw(g, x, y, h, pose): (x, y) where his feet touch the ground, h his height in pixels.
   pose: { sq, lean, rot, wave, waveF, splay, droop, armL, armR, eye, lidL, lidR, amb: [r, g, b], rim: [r, g, b],
           rimDir: [dx, dy], rimAmt, wet, t, flip }
   point(name, x, y, h, pose): where a part of him is on screen (head top, eyes, arm tips) after the bending. */
const Squid = (() => {
  const IW = 302, IH = 401, FX = 151, FY = 396, BOX = [-240, -200, 542, 620], EYES = [[105, 135, 23], [193, 135, 23]];
  let gl = null, cv = null, P = null, tex = null, nIdx = 0, img = null, readyP = null, failed = false;
  function ready() { return readyP || (readyP = (async () => { if (typeof STUDIO_SQUID === 'undefined') return null; img = await createImageBitmap(await (await fetch(STUDIO_SQUID)).blob()); return img; })().catch(() => null)); }
  const VS = `#version 300 es
in vec2 aP; out vec2 vUv; out vec2 vP;
uniform vec4 uBox; uniform float uT, uSq, uLean, uWave, uWaveF, uSplay, uDroop, uArmL, uArmR, uEye;
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec2 deform(vec2 p){ vec2 o = p; float tw = smoothstep(185., 400., o.y);
  p.x += uWave * pow(tw, 1.3) * sin(uT * uWaveF - o.y / 50. + o.x / 31.) * 13.;
  p.y += uWave * pow(tw, 1.3) * sin(uT * uWaveF * .8 + o.x / 27.) * 4.;
  p.x += (o.x - 151.) * uSplay * tw * .5; p.y -= uSplay * 55. * tw * tw;
  p.x -= (o.x - 151.) * uDroop * tw * .22; p.y += uDroop * 16. * tw;
  float wl = smoothstep(100., 60., o.x) * smoothstep(222., 248., o.y) * smoothstep(335., 305., o.y); vec2 rl = vec2(88., 252.); p = rl + rot(uArmL * wl) * (p - rl);
  float wr = smoothstep(205., 245., o.x) * smoothstep(222., 245., o.y) * smoothstep(305., 280., o.y); vec2 rr = vec2(220., 246.); p = rr + rot(-uArmR * wr) * (p - rr);
  for (int k = 0; k < 2; k++){ vec2 c = k == 0 ? vec2(105., 135.) : vec2(193., 135.); float f = smoothstep(46., 20., length(o - c)); p = c + (p - c) * mix(1., uEye, f); }
  float hw = smoothstep(225., 130., o.y); vec2 nk = vec2(151., 215.); p = nk + rot(uLean * hw) * (p - nk);
  vec2 ft = vec2(151., 396.); p = ft + (p - ft) * vec2(1. / sqrt(uSq), uSq);
  return p; }
void main(){ vec2 p = deform(aP); vec2 c = (p - uBox.xy) / (uBox.zw - uBox.xy); gl_Position = vec4(c.x * 2. - 1., 1. - c.y * 2., 0., 1.); vUv = aP / vec2(302., 401.); vP = aP; }`;
  const FS = `#version 300 es
precision highp float; in vec2 vUv; in vec2 vP; out vec4 o;
uniform sampler2D uTex; uniform float uLidL, uLidR, uRimAmt, uWet, uT; uniform vec3 uAmb, uRim; uniform vec2 uRimDir;
void main(){ vec4 c = texture(uTex, vUv); if (c.a < .004) discard;
  for (int k = 0; k < 2; k++){ vec2 e = k == 0 ? vec2(105., 135.) : vec2(193., 135.); float lid = k == 0 ? uLidL : uLidR; float r = 25.5;
    if (lid > .001 && length(vP - e) < r){ float edge = e.y - r + 2. * r * lid; vec4 sk = texture(uTex, (e + vec2((vP.x - e.x) * .5, -r - 7.)) / vec2(302., 401.));
      if (vP.y < edge) c = vec4(sk.rgb, 1.) * c.a; else if (vP.y < edge + 2.2) c = vec4(.12, .11, .13, 1.) * c.a; } }
  vec3 col = c.rgb * uAmb;
  float a2 = texture(uTex, vUv + uRimDir * vec2(6. / 302., 6. / 401.)).a; col += uRim * clamp(c.a - a2, 0., 1.) * uRimAmt * c.a;
  if (uWet > 0.){ col *= mix(vec3(1.), vec3(.82, .86, .95), uWet); float l = dot(c.rgb, vec3(.33)) / max(c.a, .01); col += vec3(.8, .88, 1.) * smoothstep(.86, .97, l) * .35 * uWet * c.a; }
  o = vec4(col, c.a); }`;
  function init() { if (gl || failed) return gl; try { cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(64, 64) : document.createElement('canvas'); gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) { failed = true; return null; }
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); U[a.name] = gl.getUniformLocation(p, a.name); } P = { p, U };
    // the mesh: a fine grid over the picture
    const NX = 48, NY = 64, v = [], idx = []; for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) v.push(i / NX * IW, j / NY * IH);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, c, b, d, c); } nIdx = idx.length;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return gl; }
  function texUp() { if (tex || !img) return tex; tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return tex; }
  const D = { sq: 1, lean: 0, wave: 0.6, waveF: 2.2, splay: 0, droop: 0, armL: 0, armR: 0, eye: 1, lidL: 0, lidR: 0, amb: [1, 1, 1], rim: [1, 0.7, 0.4], rimDir: [-1, -0.4], rimAmt: 0, wet: 0, t: 0 };
  // The same bending on the CPU, for placing hats, drips and props on him
  function deform(px, py, q) { let x = px, y = py; const ox = px, oy = py, ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); }, rot = (cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; x = cx + dx * c - dy * s; y = cy + dx * s + dy * c; };
    const tw = ss(185, 400, oy); x += q.wave * Math.pow(tw, 1.3) * Math.sin(q.t * q.waveF - oy / 50 + ox / 31) * 13; y += q.wave * Math.pow(tw, 1.3) * Math.sin(q.t * q.waveF * 0.8 + ox / 27) * 4;
    x += (ox - 151) * q.splay * tw * 0.5; y -= q.splay * 55 * tw * tw; x -= (ox - 151) * q.droop * tw * 0.22; y += q.droop * 16 * tw;
    rot(88, 252, q.armL * ss(100, 60, ox) * ss(222, 248, oy) * ss(335, 305, oy)); rot(220, 246, -q.armR * ss(205, 245, ox) * ss(222, 245, oy) * ss(305, 280, oy));
    [[105, 135], [193, 135]].forEach(([cx, cy]) => { const f = ss(46, 20, Math.hypot(ox - cx, oy - cy)), m = 1 + (q.eye - 1) * f; x = cx + (x - cx) * m; y = cy + (y - cy) * m; });
    rot(151, 215, q.lean * ss(225, 130, oy)); x = 151 + (x - 151) / Math.sqrt(q.sq); y = 396 + (y - 396) * q.sq; return [x, y]; }
  const PTS = { top: [151, 8], crown: [151, 30], eyeL: [105, 135], eyeR: [193, 135], mouth: [151, 205], armL: [16, 292], armR: [292, 262], belly: [151, 230] };
  function point(name, x, y, h, pose = {}) { const q = Object.assign({}, D, pose), k = h / IH, p = deform(...(PTS[name] || PTS.top), q); let dx = (p[0] - FX) * k * (pose.flip ? -1 : 1), dy = (p[1] - FY) * k; const r = pose.rot || 0; return [x + dx * Math.cos(r) - dy * Math.sin(r), y + dx * Math.sin(r) + dy * Math.cos(r)]; }
  // Head angle (for hats): from the crown towards the top
  function headAngle(pose = {}) { const q = Object.assign({}, D, pose), a = deform(151, 120, q), b = deform(151, 8, q); return Math.atan2(b[0] - a[0], -(b[1] - a[1])) * (pose.flip ? -1 : 1) + (pose.rot || 0); }
  function draw(g, x, y, h, pose = {}) {
    if (!img || !init()) return false; texUp(); const q = Object.assign({}, D, pose), k = h / IH, bw = BOX[2] - BOX[0], bh = BOX[3] - BOX[1];
    const res = Math.max(128, Math.min(2048, Math.ceil(bw * k * (pose.res || 1)))), rh = Math.round(res * bh / bw); if (cv.width !== res || cv.height !== rh) { cv.width = res; cv.height = rh; }
    gl.viewport(0, 0, res, rh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(P.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const U = P.U, f1 = (n, v) => U[n] != null && gl.uniform1f(U[n], v);
    gl.uniform4f(U.uBox, BOX[0], BOX[1], BOX[2], BOX[3]); ['uT:t', 'uSq:sq', 'uLean:lean', 'uWave:wave', 'uWaveF:waveF', 'uSplay:splay', 'uDroop:droop', 'uArmL:armL', 'uArmR:armR', 'uEye:eye', 'uLidL:lidL', 'uLidR:lidR', 'uRimAmt:rimAmt', 'uWet:wet'].forEach(s => { const [u, n] = s.split(':'); f1(u, q[n]); });
    gl.uniform3fv(U.uAmb, q.amb); gl.uniform3fv(U.uRim, q.rim); gl.uniform2fv(U.uRimDir, q.rimDir); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
    g.save(); g.translate(x, y); if (q.rot) g.rotate(q.rot); if (q.flip) g.scale(-1, 1); g.drawImage(cv, (BOX[0] - FX) * k, (BOX[1] - FY) * k, bw * k, bh * k); g.restore(); return true; }
  return { ready, draw, point, headAngle, IW, IH };
})();

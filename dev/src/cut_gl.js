/* CutGL: colour, looks, chroma key and picture effects for the editor, done on the graphics chip in one pass.
   process(src, sw, sh, ow, oh, P) draws src (a video frame, picture or canvas) through the shader and returns a canvas of
   ow x oh to draw straight away (it is reused by the next call). Without WebGL2 a lighter canvas filter is used instead. */
const CutGL = (() => {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  // Colour settings: name, label, min, max, default (shown as -100..100 or 0..100 in the panel)
  const ADJUST = [
    ['exp', 'Exposure', -100, 100], ['bri', 'Brightness', -100, 100], ['con', 'Contrast', -100, 100], ['sat', 'Saturation', -100, 100], ['vib', 'Vibrance', -100, 100],
    ['temp', 'Temperature', -100, 100], ['tint', 'Tint', -100, 100], ['hi', 'Highlights', -100, 100], ['sh', 'Shadows', -100, 100], ['fade', 'Fade', 0, 100],
    ['sharp', 'Sharpen', 0, 100], ['vig', 'Vignette', -100, 100], ['grain', 'Grain', 0, 100],
  ];
  // Looks: ready made grades. Each is a set of the same settings plus split toning (shadow and highlight tints) and a contrast curve.
  const LOOKS = {
    none: { label: 'None' },
    warm: { label: 'Warm', temp: 35, sat: 8, hi: -5 },
    cool: { label: 'Cool', temp: -35, tint: 5, sat: -5 },
    cine: { label: 'Cinematic', con: 18, sat: -12, curve: 0.35, shT: [0.15, 0.45, 0.55], hiT: [0.95, 0.65, 0.4], split: 0.7, sh: -10, vig: 25 },
    moody: { label: 'Moody', exp: -12, con: 22, sat: -30, curve: 0.3, shT: [0.2, 0.3, 0.45], split: 0.5, vig: 40 },
    vivid: { label: 'Vivid', sat: 30, vib: 25, con: 15, curve: 0.2 },
    faded: { label: 'Faded', fade: 45, con: -15, sat: -15 },
    matte: { label: 'Matte', fade: 30, con: -8, sh: 15, curve: 0.15 },
    film: { label: 'Film', con: 12, sat: -8, fade: 18, grain: 25, shT: [0.35, 0.4, 0.5], hiT: [0.85, 0.75, 0.55], split: 0.4, curve: 0.25 },
    golden: { label: 'Golden hour', temp: 45, tint: 8, exp: 6, sat: 12, hiT: [1, 0.75, 0.4], split: 0.5, vig: 15 },
    summer: { label: 'Summer', temp: 20, exp: 10, sat: 20, vib: 20, hi: -10 },
    pastel: { label: 'Pastel', fade: 35, sat: -20, exp: 12, con: -20, tint: 6 },
    night: { label: 'Night', temp: -50, exp: -20, sat: -35, con: 15, vig: 35, shT: [0.2, 0.3, 0.6], split: 0.6 },
    drama: { label: 'Drama', con: 35, sat: -20, curve: 0.45, vig: 45, sharp: 20 },
    punchy: { label: 'Punchy', con: 25, sat: 18, sharp: 25, curve: 0.25 },
    grey: { label: 'Glasgow grey', sat: -55, temp: -18, con: 10, fade: 12, vig: 20 },
    retro: { label: 'Retro', temp: 25, fade: 30, sat: -10, grain: 30, hiT: [1, 0.8, 0.55], shT: [0.3, 0.35, 0.5], split: 0.6, vig: 30 },
    bw: { label: 'Black and white', bw: 1, con: 15, curve: 0.2 },
    noir: { label: 'Noir', bw: 1, con: 45, curve: 0.5, vig: 50, grain: 20 },
    sepia: { label: 'Sepia', sepia: 1, fade: 15, vig: 25 },
  };
  // Picture effects (CapCut's Video effects): each a strength 0..100
  const EFFECTS = {
    blur: { label: 'Blur', icon: '◌' }, glitch: { label: 'Glitch', icon: '▤' }, rgb: { label: 'RGB split', icon: '◫' }, vhs: { label: 'VHS', icon: '▭' },
    oldfilm: { label: 'Old film', icon: '🎞' }, pixel: { label: 'Pixelate', icon: '▦' }, mirror: { label: 'Mirror', icon: '◧' }, mirror4: { label: 'Kaleido four', icon: '◩' },
    invert: { label: 'Invert', icon: '◑' }, poster: { label: 'Posterise', icon: '▥' }, glow: { label: 'Soft glow', icon: '✺' }, shake: { label: 'Camera shake', icon: '≋' },
    pulse: { label: 'Zoom pulse', icon: '◎' }, flash: { label: 'Flash', icon: '✦' }, leak: { label: 'Light leak', icon: '☀' }, strobe: { label: 'Strobe', icon: '⚡' },
  };

  // Everything the shader needs for one clip at one moment: its own colour, its look, its effects and its chroma key
  function params(it, t) {
    const c = it.col || {}, L = LOOKS[c.look] || LOOKS.none, amt = c.look ? cl(c.lookAmt == null ? 100 : +c.lookAmt, 0, 100) / 100 : 0, P = {};
    ADJUST.forEach(([k]) => { P[k] = ((+c[k] || 0) + (+L[k] || 0) * amt) / 100; });
    P.curve = (L.curve || 0) * amt; P.bw = (L.bw || 0) * amt; P.sepia = (L.sepia || 0) * amt; P.split = (L.split || 0) * amt; P.shT = L.shT || [0.5, 0.5, 0.5]; P.hiT = L.hiT || [0.5, 0.5, 0.5];
    P.inv = 0; P.post = 0; P.pix = 0; P.shift = 0; P.glitch = 0; P.vhs = 0; P.mirror = 0; P.time = t || 0; P.blur = 0; P.glow = 0; P.flash = 0; P.leak = 0; P.old = 0;
    (it.fx || []).forEach(f => { const a = cl(f.amt == null ? 60 : +f.amt, 0, 100) / 100; if (!a || f.off) return;
      switch (f.k) { case 'blur': P.blur = Math.max(P.blur, a); break; case 'glitch': P.glitch = a; P.shift = Math.max(P.shift, a * 0.5); break; case 'rgb': P.shift = Math.max(P.shift, a); break; case 'vhs': P.vhs = a; P.shift = Math.max(P.shift, a * 0.3); break;
        case 'oldfilm': P.old = a; P.grain = Math.max(P.grain, a * 0.5); P.sepia = Math.max(P.sepia, a * 0.6); P.vig = Math.max(P.vig, a * 0.5); break; case 'pixel': P.pix = a; break; case 'mirror': P.mirror = 1; break; case 'mirror4': P.mirror = 2; break;
        case 'invert': P.inv = a; break; case 'poster': P.post = Math.round(2 + (1 - a) * 10); break; case 'glow': P.glow = a; break; case 'flash': P.flash = a * Math.pow(Math.max(0, Math.sin((t || 0) * Math.PI * 2 * 1.2)), 6); break; case 'leak': P.leak = a; break;
        case 'strobe': P.flash = Math.max(P.flash, (Math.floor((t || 0) * 8) % 2) * a); break; } });
    const k = it.key; P.key = k && k.on ? 1 : 0; if (P.key) { const h = String(k.col || '#00ff00').replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16) || 0x00ff00; P.keyRGB = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; P.sim = cl(k.sim == null ? 40 : +k.sim, 0, 100) / 100; P.smooth = cl(k.smooth == null ? 20 : +k.smooth, 0, 100) / 100; P.spill = cl(k.spill == null ? 50 : +k.spill, 0, 100) / 100; }
    return P;
  }
  // Does this clip need the shader at all? (most don't, and skipping it keeps plain footage fast)
  function needs(P) { if (!P) return false; for (const k of ['exp', 'bri', 'con', 'sat', 'vib', 'temp', 'tint', 'hi', 'sh', 'fade', 'sharp', 'vig', 'grain', 'curve', 'bw', 'sepia', 'split', 'inv', 'post', 'pix', 'shift', 'glitch', 'vhs', 'mirror', 'key', 'old', 'leak', 'flash', 'glow']) if (P[k]) return true; return false; }

  const VS = `#version 300 es
in vec2 a; out vec2 v; void main(){ v = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); gl_Position = vec4(a, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
uniform sampler2D T; uniform vec2 R; uniform vec2 SR;
uniform float uExp, uBri, uCon, uSat, uVib, uTemp, uTint, uHi, uSh, uFade, uVig, uGrain, uSharp, uCurve, uBw, uSepia, uInv, uPost, uPix, uShift, uGlitch, uVhs, uTime, uMirror, uSplit, uOld, uLeak, uFlash, uGlow;
uniform vec3 uShT, uHiT; uniform float uKeyOn, uSim, uSmooth, uSpill; uniform vec3 uKey;
in vec2 v; out vec4 o;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec4 tap(vec2 uv){ return texture(T, clamp(uv, vec2(0.0), vec2(1.0))); }
void main(){
  vec2 uv = v;
  if (uMirror > 1.5) { uv = abs(uv - 0.5) * 2.0; uv = vec2(uv.x, uv.y) * 0.5 + 0.25; }
  else if (uMirror > 0.5) { uv.x = uv.x < 0.5 ? uv.x : 1.0 - uv.x; }
  if (uPix > 0.0) { float b = mix(1.0, 60.0, uPix); vec2 cell = b / SR; uv = (floor(uv / cell) + 0.5) * cell; }
  if (uGlitch > 0.0) { float row = floor(uv.y * 24.0), tt = floor(uTime * 12.0); float r = hash(vec2(row, tt)); if (r < uGlitch * 0.45) uv.x += (hash(vec2(tt, row + 7.0)) - 0.5) * 0.18 * uGlitch; }
  if (uVhs > 0.0) { uv.x += sin(uv.y * 220.0 + uTime * 9.0) * 0.0018 * uVhs + (hash(vec2(floor(uv.y * 300.0), floor(uTime * 30.0))) - 0.5) * 0.004 * uVhs; }
  vec2 px = 1.0 / SR; float sh = uShift * 0.012;
  vec4 c0 = tap(uv);
  vec3 c = c0.rgb; float a = c0.a;
  if (sh > 0.0) { c.r = tap(uv + vec2(sh, 0.0)).r; c.b = tap(uv - vec2(sh, 0.0)).b; }
  if (uSharp > 0.0) { vec3 n = (tap(uv + vec2(px.x, 0.0)).rgb + tap(uv - vec2(px.x, 0.0)).rgb + tap(uv + vec2(0.0, px.y)).rgb + tap(uv - vec2(0.0, px.y)).rgb) * 0.25; c += (c - n) * uSharp * 2.0; }
  if (uGlow > 0.0) { vec3 g = vec3(0.0); for (int i = 0; i < 8; i++) { float ang = float(i) * 0.785398; g += tap(uv + vec2(cos(ang), sin(ang)) * px * 6.0).rgb; } g /= 8.0; c = 1.0 - (1.0 - c) * (1.0 - max(g - 0.45, 0.0) * uGlow * 1.6); }
  // Chroma key: how far the pixel's colour is from the key colour, ignoring brightness
  if (uKeyOn > 0.5) {
    vec2 kc = vec2(dot(uKey, vec3(-0.169, -0.331, 0.5)), dot(uKey, vec3(0.5, -0.419, -0.081)));
    vec2 pc = vec2(dot(c, vec3(-0.169, -0.331, 0.5)), dot(c, vec3(0.5, -0.419, -0.081)));
    float d = distance(pc, kc) / 0.7071, s0 = uSim * 0.6, s1 = s0 + uSmooth * 0.4 + 0.001;
    a *= smoothstep(s0, s1, d);
    float kl = lum(uKey); vec3 sp = c - uKey * 0.5; float dom = 0.0;
    if (uKey.g >= uKey.r && uKey.g >= uKey.b) { dom = max(0.0, c.g - max(c.r, c.b)); c.g -= dom * uSpill; }
    else if (uKey.b >= uKey.r) { dom = max(0.0, c.b - max(c.r, c.g)); c.b -= dom * uSpill; }
    else { dom = max(0.0, c.r - max(c.g, c.b)); c.r -= dom * uSpill; }
  }
  c *= exp2(uExp * 1.5);
  c += uBri * 0.22;
  c = (c - 0.5) * (1.0 + uCon * 0.9) + 0.5;
  float l = lum(c);
  c += uHi * 0.3 * smoothstep(0.45, 1.0, l) + uSh * 0.3 * (1.0 - smoothstep(0.0, 0.55, l));
  c.r += uTemp * 0.09; c.b -= uTemp * 0.09; c.g -= uTint * 0.07; c.r += uTint * 0.02; c.b += uTint * 0.02;
  l = lum(c);
  c = mix(vec3(l), c, 1.0 + uSat);
  float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + uVib * (1.0 - clamp(s, 0.0, 1.0)) * 0.9);
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), uCurve);
  l = lum(c);
  c += ((uShT - 0.5) * (1.0 - l) + (uHiT - 0.5) * l) * uSplit * 0.35;
  c = c * (1.0 - uFade * 0.28) + uFade * 0.11;
  c = mix(c, vec3(lum(c)), uBw);
  vec3 sep = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
  c = mix(c, sep, uSepia);
  if (uPost > 1.5) c = floor(c * uPost + 0.5) / uPost;
  c = mix(c, 1.0 - c, uInv);
  if (uVhs > 0.0) { c *= 1.0 - uVhs * 0.16 * (0.5 + 0.5 * sin(gl_FragCoord.y * 1.6)); c += (hash(uv * R + uTime) - 0.5) * 0.08 * uVhs; }
  if (uOld > 0.0) { float sc = step(0.995 - uOld * 0.004, hash(vec2(floor(uv.x * 400.0), floor(uTime * 24.0)))); c = mix(c, vec3(0.9), sc * 0.6); c *= 1.0 - uOld * 0.12 * hash(vec2(floor(uTime * 24.0), 3.0)); }
  if (uGrain > 0.0) c += (hash(uv * R + fract(uTime * 7.31)) - 0.5) * uGrain * 0.22;
  if (uLeak > 0.0) { float lk = smoothstep(0.9, 0.0, distance(uv, vec2(0.85 + 0.1 * sin(uTime * 0.7), 0.15))); c = 1.0 - (1.0 - c) * (1.0 - vec3(1.0, 0.55, 0.2) * lk * uLeak * 0.9); }
  if (uVig != 0.0) { float d = distance(v, vec2(0.5)); float w = smoothstep(0.25, 0.85, d); c = uVig > 0.0 ? c * (1.0 - uVig * w * 0.9) : mix(c, vec3(1.0), -uVig * w * 0.8); }
  c = mix(c, vec3(1.0), uFlash);
  o = vec4(clamp(c, 0.0, 1.0), a);
}`;
  let gl = null, cv = null, prog = null, tex = null, U = {}, failed = false;
  const mk = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function init() {
    if (gl || failed) return !!gl;
    try {
      cv = mk(16, 16); gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true, antialias: false }); if (!gl) throw new Error('no webgl2');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.bindAttribLocation(prog, 0, 'a'); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      ['T', 'R', 'SR', 'uExp', 'uBri', 'uCon', 'uSat', 'uVib', 'uTemp', 'uTint', 'uHi', 'uSh', 'uFade', 'uVig', 'uGrain', 'uSharp', 'uCurve', 'uBw', 'uSepia', 'uInv', 'uPost', 'uPix', 'uShift', 'uGlitch', 'uVhs', 'uTime', 'uMirror', 'uSplit', 'uOld', 'uLeak', 'uFlash', 'uGlow', 'uShT', 'uHiT', 'uKeyOn', 'uSim', 'uSmooth', 'uSpill', 'uKey'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (cv.addEventListener) cv.addEventListener('webglcontextlost', e => { e.preventDefault(); gl = null; prog = null; });
      return true;
    } catch (e) { console.warn('Colour on the graphics chip unavailable:', e.message); failed = true; gl = null; return false; }
  }
  const out2d = { c: null };
  function process(src, sw, sh, ow, oh, P) {
    ow = Math.max(1, Math.round(ow)); oh = Math.max(1, Math.round(oh));
    if (!init()) return fallback(src, sw, sh, ow, oh, P);
    if (cv.width !== ow || cv.height !== oh) { cv.width = ow; cv.height = oh; }
    gl.viewport(0, 0, ow, oh); gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return fallback(src, sw, sh, ow, oh, P); }
    const f = (n, v) => gl.uniform1f(U[n], v || 0);
    gl.uniform1i(U.T, 0); gl.uniform2f(U.R, ow, oh); gl.uniform2f(U.SR, sw, sh);
    f('uExp', P.exp); f('uBri', P.bri); f('uCon', P.con); f('uSat', P.sat); f('uVib', P.vib); f('uTemp', P.temp); f('uTint', P.tint); f('uHi', P.hi); f('uSh', P.sh); f('uFade', P.fade); f('uVig', P.vig); f('uGrain', P.grain); f('uSharp', P.sharp);
    f('uCurve', P.curve); f('uBw', P.bw); f('uSepia', P.sepia); f('uInv', P.inv); f('uPost', P.post); f('uPix', P.pix); f('uShift', P.shift); f('uGlitch', P.glitch); f('uVhs', P.vhs); f('uTime', P.time); f('uMirror', P.mirror); f('uSplit', P.split); f('uOld', P.old); f('uLeak', P.leak); f('uFlash', P.flash); f('uGlow', P.glow);
    gl.uniform3fv(U.uShT, P.shT || [0.5, 0.5, 0.5]); gl.uniform3fv(U.uHiT, P.hiT || [0.5, 0.5, 0.5]);
    f('uKeyOn', P.key); f('uSim', P.sim); f('uSmooth', P.smooth); f('uSpill', P.spill); gl.uniform3fv(U.uKey, P.keyRGB || [0, 1, 0]);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return cv;
  }
  // No WebGL2: the browser's own canvas filters cover the basic colour settings
  function fallback(src, sw, sh, ow, oh, P) {
    const c = out2d.c && out2d.c.width === ow && out2d.c.height === oh ? out2d.c : (out2d.c = mk(ow, oh)), g = c.getContext('2d');
    g.clearRect(0, 0, ow, oh);
    const parts = []; if (P.exp || P.bri) parts.push(`brightness(${(Math.pow(2, (P.exp || 0) * 1.5) * (1 + (P.bri || 0) * 0.5)).toFixed(3)})`); if (P.con) parts.push(`contrast(${(1 + P.con * 0.9).toFixed(3)})`);
    if (P.sat || P.vib) parts.push(`saturate(${Math.max(0, 1 + (P.sat || 0) + (P.vib || 0) * 0.5).toFixed(3)})`); if (P.bw) parts.push(`grayscale(${P.bw})`); if (P.sepia) parts.push(`sepia(${P.sepia})`); if (P.inv) parts.push(`invert(${P.inv})`);
    g.filter = parts.join(' ') || 'none'; g.drawImage(src, 0, 0, ow, oh); g.filter = 'none'; return c;
  }
  return { ADJUST, LOOKS, EFFECTS, params, needs, process, get available() { return init(); } };
})();

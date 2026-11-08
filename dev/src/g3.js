/* G3: a small WebGL2 3D renderer for the Intro tab. Scenes are raymarched in one fragment shader (signed distance
   fields), so letters typed in the panel become real 3D shapes (neon tubes that follow the outlines of the words, or
   bevelled solid letters) with soft shadows, light thrown on the surfaces round them, bloom, film grain and a moving
   camera. Text comes in as distance field textures made from the browser's own fonts (G3.textSdf).
   Everything is a pure function of time like the rest of the app. If WebGL2 is missing, callers fall back to 2D. */
const G3 = (() => {
  let gl = null, cv = null, failed = false, quad = null, floatOK = false;
  const progs = {}, texCache = new Map(), fbs = {};
  function ctx() {
    if (gl || failed) return gl;
    try { cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(16, 16) : document.createElement('canvas'); gl = cv.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: false }); } catch (e) { gl = null; }
    if (!gl) { failed = true; return null; }
    floatOK = !!gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
    quad = gl.createVertexArray(); gl.bindVertexArray(quad); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    if (cv.addEventListener) cv.addEventListener('webglcontextlost', e => { e.preventDefault(); gl = null; failed = false; Object.keys(progs).forEach(k => delete progs[k]); texCache.clear(); Object.keys(fbs).forEach(k => delete fbs[k]); });
    return gl;
  }
  const available = () => !!ctx();
  const VS = '#version 300 es\nlayout(location=0) in vec2 p; out vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  function program(name, fs) {
    if (progs[name]) return progs[name]; const g = ctx(); if (!g) return null;
    const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) { const m = g.getShaderInfoLog(s); g.deleteShader(s); throw new Error('Shader ' + name + ': ' + m); } return s; };
    const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, fs)); g.bindAttribLocation(p, 0, 'p'); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error('Link ' + name + ': ' + g.getProgramInfoLog(p));
    const U = {}; const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = g.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ''); U[nm] = g.getUniformLocation(p, a.name); }
    return (progs[name] = { p, U });
  }
  function set(P, name, v) { const g = gl, L = P.U[name]; if (L == null) return; if (typeof v === 'number') g.uniform1f(L, v); else if (v.length === 2) g.uniform2fv(L, v); else if (v.length === 3) g.uniform3fv(L, v); else if (v.length === 4) g.uniform4fv(L, v); else g.uniform1fv(L, v); }
  function setv(P, name, arr, n) { const L = P.U[name]; if (L == null) return; if (n === 4) gl.uniform4fv(L, arr); else if (n === 3) gl.uniform3fv(L, arr); else if (n === 2) gl.uniform2fv(L, arr); else gl.uniform1fv(L, arr); }
  function tex(unit, t, P, name) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); if (P.U[name] != null) gl.uniform1i(P.U[name], unit); }
  // A render target (float when the card allows, for proper glow)
  function target(k, w, h) { let f = fbs[k]; if (f && f.w === w && f.h === h) return f; const g = gl; if (f) { g.deleteTexture(f.t); g.deleteFramebuffer(f.fb); }
    g.activeTexture(g.TEXTURE7); const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); if (floatOK) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null); else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    const fb = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0); return (fbs[k] = { t, fb, w, h }); }
  // Pictures (the logo, a poster drawn on a canvas) as textures, kept while the same object comes in
  function imageTex(key, src, dirty) { const g = ctx(); if (!g || !src) return null; let e = texCache.get(key); if (e && e.src === src && !dirty) return e.t;
    if (e && e.src === src && dirty) { g.activeTexture(g.TEXTURE7); g.bindTexture(g.TEXTURE_2D, e.t); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src); g.generateMipmap(g.TEXTURE_2D); return e.t; }
    if (e) g.deleteTexture(e.t);
    g.activeTexture(g.TEXTURE7); const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src); g.generateMipmap(g.TEXTURE_2D);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); texCache.set(key, { t, src }); trim(); return t; }
  function trim() { if (texCache.size <= 48) return; const k = texCache.keys().next().value, e = texCache.get(k); gl.deleteTexture(e.t); texCache.delete(k); }

  // A single channel float texture (height maps), kept under a key
  function floatTex(key, data, w, h) { const g = ctx(); if (!g) return null; const e = texCache.get(key); if (e && e.src === data) return e.t; if (e) g.deleteTexture(e.t);
    g.activeTexture(g.TEXTURE7); const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); g.texImage2D(g.TEXTURE_2D, 0, g.R16F, w, h, 0, g.RED, g.FLOAT, data);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); texCache.set(key, { t, src: data }); return t; }
  /* ---------- Text as a distance field ---------- */
  // Felzenszwalb's exact distance transform (squared), one line at a time
  function edt1(f, n, d, v, z) { let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20; for (let q = 1; q < n; q++) { let s; for (;;) { const r = v[k]; s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r); if (s <= z[k]) { k--; if (k < 0) { k = 0; break; } } else break; } k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; } }
  function edt(grid, w, h) { const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]); } return grid; }
  /* textSdf(text, font, opts) -> { tex, w, h, box: world rect, letters: [[x0, x1], ...] in world units }
     The words are drawn big, their inside and outside distances worked out, and stored signed (inside negative) in world
     units, so a shader can make tubes along the outlines or solid bevelled letters. */
  function textSdf(text, font, { worldW = 3, maxWorldH = 0.9, px = 200, pad = 48, spacing = 0.04, key, weight = '' } = {}) {
    const g = ctx(); if (!g) return null; const id = 'sdf|' + (key || '') + '|' + text + '|' + font + '|' + worldW + '|' + maxWorldH + '|' + spacing + '|' + weight; const hit = texCache.get(id); if (hit) return hit.info;
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : document.createElement('canvas'), x = c.getContext('2d'), wt = weight ? weight + ' ' : ''; x.font = wt + px + 'px ' + font;
    const chars = [...text], ws = chars.map(ch => x.measureText(ch).width), sp = spacing * px, tw = ws.reduce((a, b) => a + b, 0) + sp * Math.max(0, chars.length - 1);
    const W = Math.min(4096, Math.ceil(tw + pad * 2)), H = Math.ceil(px * 1.35 + pad * 2), k = Math.min(1, (4096 - pad * 2) / Math.max(1, tw)); c.width = W; c.height = H;
    x.font = wt + (px * k).toFixed(1) + 'px ' + font; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; let cx = pad; const base = pad + px * 1.0, letters = [];
    chars.forEach((ch, i) => { x.fillText(ch, cx, base); letters.push([cx, cx + ws[i] * k]); cx += (ws[i] + sp) * k; });
    const img = x.getImageData(0, 0, W, H).data, N = W * H, inG = new Float64Array(N), outG = new Float64Array(N);
    for (let i = 0; i < N; i++) { const a = img[i * 4 + 3] / 255; inG[i] = a > 0.5 ? 0 : 1e20; outG[i] = a > 0.5 ? 1e20 : 0; }
    edt(inG, W, H); edt(outG, W, H);
    // World scale: fit the words to worldW wide (or shorter if very tall)
    const inkW = Math.max(1, cx - sp * k - pad), s = Math.min(worldW / inkW, maxWorldH / (px * k)), data = new Float32Array(N);
    for (let i = 0; i < N; i++) data[i] = (inG[i] - outG[i] + (inG[i] > 0 ? -0.5 : 0.5)) * s;
    // Half the stroke width (the usual depth along the middle of a stroke, ignoring where strokes meet): tubes follow the middle
    const ridge = []; for (let y = 1; y < H - 1; y++) for (let x2 = 1; x2 < W - 1; x2++) { const i = y * W + x2, d = outG[i]; if (d < 1.5) continue; if (d >= outG[i - 1] && d >= outG[i + 1] && d >= outG[i - W] && d >= outG[i + W]) ridge.push(d); }
    ridge.sort((a, b) => a - b); const hw = (ridge.length ? ridge[Math.floor(ridge.length * 0.5)] : 4) * s;
    g.activeTexture(g.TEXTURE7); const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false); g.texImage2D(g.TEXTURE_2D, 0, g.R16F, W, H, 0, g.RED, g.FLOAT, data);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    // The box the texture covers in world units, centred on the words (x across, y up; the texture's top row is the top)
    const midX = (pad + (cx - sp * k)) / 2, midY = base - px * k * 0.36, box = [(0 - midX) * s, (midY - H) * s, (W - midX) * s, midY * s];
    const info = { tex: t, w: W, h: H, box, scale: s, letters: letters.map(([a, b]) => [(a - midX) * s, (b - midX) * s]), width: inkW * s, capH: px * k * 0.72 * s, hw };
    texCache.set(id, { t, src: id, info }); trim(); return info;
  }

  /* ---------- Shared shader code ---------- */
  const COMMON = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,max(q.y,q.z)),0.) - r; }
float sdCapCyl(vec3 p, float R, float h, float r){ vec2 d = vec2(length(p.xy) - R + r, abs(p.z) - h + r); return min(max(d.x,d.y),0.) + length(max(d,0.)) - r; }
float sdExtrude(float d2, float z, float h, float r){ vec2 w = vec2(d2 + r, abs(z - h * .5) - h * .5 + r); return min(max(w.x, w.y), 0.) + length(max(w, 0.)) - r; }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float texSdf(sampler2D t, vec4 box, vec2 p){ vec2 uv = (p - box.xy) / (box.zw - box.xy); vec2 q = clamp(p, box.xy, box.zw); float o = length(p - q);
  float d = texture(t, vec2(clamp(uv.x, 0.002, .998), 1. - clamp(uv.y, 0.002, .998))).r; return o > 0. ? max(d, 0.) + o : d; }
`;
  // Glow, then the finish: tone, vignette, grain and a touch of colour fringing at the edges
  const BRIGHT = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh;
void main(){ vec3 c = vec3(0.); for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) c += texture(uSrc, vUv + vec2(i, j) * uTexel).rgb; c /= 9.; float l = max(c.r, max(c.g, c.b)); o = vec4(c * smoothstep(uThresh, uThresh + .6, l), 1.); }`;
  const BLUR = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uDir;
void main(){ float w[7] = float[](.1964, .1748, .1209, .0647, .0268, .0086, .0021); vec3 c = texture(uSrc, vUv).rgb * w[0]; for (int i = 1; i < 7; i++){ c += texture(uSrc, vUv + uDir * float(i)).rgb * w[i]; c += texture(uSrc, vUv - uDir * float(i)).rgb * w[i]; } o = vec4(c, 1.); }`;
  const FINISH = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc, uB1, uB2; uniform float uBloom, uExpo, uGrain, uT, uVig; uniform vec2 uRes;
${COMMON}
void main(){ vec2 c = vUv - .5; float ca = .0018 * dot(c, c) * 4.; vec3 s = vec3(texture(uSrc, vUv - c * ca).r, texture(uSrc, vUv).g, texture(uSrc, vUv + c * ca).b);
  vec3 b = texture(uB1, vUv).rgb * .6 + texture(uB2, vUv).rgb * .9; vec3 col = s + b * uBloom; col = aces(col * uExpo);
  col *= mix(1., smoothstep(1.15, .25, length(c * vec2(1.1, 1.))), uVig); col = pow(col, vec3(1. / 2.2));
  float gn = hash12(vUv * uRes + fract(uT * 7.13) * 931.) - .5; col += gn * uGrain; o = vec4(col, 1.); }`;
  function post(srcT, w, h, o) {
    const g = gl, P1 = program('bright', BRIGHT), P2 = program('blur', BLUR), P3 = program('finish', FINISH); if (!P1 || !P2 || !P3) return;
    const w2 = Math.max(1, w >> 2), h2 = Math.max(1, h >> 2), w3 = Math.max(1, w >> 3), h3 = Math.max(1, h >> 3), A = target('bA', w2, h2), B = target('bB', w2, h2), C = target('bC', w3, h3), D = target('bD', w3, h3);
    g.useProgram(P1.p); g.bindFramebuffer(g.FRAMEBUFFER, A.fb); g.viewport(0, 0, w2, h2); tex(0, srcT, P1, 'uSrc'); set(P1, 'uTexel', [1 / w, 1 / h]); set(P1, 'uThresh', o.thresh == null ? 0.7 : o.thresh); g.drawArrays(g.TRIANGLES, 0, 3);
    g.useProgram(P2.p); const blur = (src, dst, ww, hh, dir) => { g.bindFramebuffer(g.FRAMEBUFFER, dst.fb); g.viewport(0, 0, ww, hh); tex(0, src.t, P2, 'uSrc'); set(P2, 'uDir', dir); g.drawArrays(g.TRIANGLES, 0, 3); };
    blur(A, B, w2, h2, [1.6 / w2, 0]); blur(B, A, w2, h2, [0, 1.6 / h2]);
    g.useProgram(P1.p); g.bindFramebuffer(g.FRAMEBUFFER, C.fb); g.viewport(0, 0, w3, h3); tex(0, A.t, P1, 'uSrc'); set(P1, 'uTexel', [1 / w2, 1 / h2]); set(P1, 'uThresh', 0.0); g.drawArrays(g.TRIANGLES, 0, 3);
    g.useProgram(P2.p); blur(C, D, w3, h3, [2.2 / w3, 0]); blur(D, C, w3, h3, [0, 2.2 / h3]);
    g.useProgram(P3.p); g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h); tex(0, srcT, P3, 'uSrc'); tex(1, A.t, P3, 'uB1'); tex(2, C.t, P3, 'uB2');
    set(P3, 'uBloom', o.bloom == null ? 1 : o.bloom); set(P3, 'uExpo', o.expo == null ? 1 : o.expo); set(P3, 'uGrain', o.grain == null ? 0.03 : o.grain); set(P3, 'uT', o.t || 0); set(P3, 'uVig', o.vig == null ? 0.8 : o.vig); set(P3, 'uRes', [w, h]); g.drawArrays(g.TRIANGLES, 0, 3);
  }
  /* Render a scene: fs is the scene shader (writes linear colour), uniforms set by setU(P). The finished picture is drawn
     into the 2D context at (0, 0, W, H). scale < 1 renders smaller for a quicker preview. */
  function render(name, fs, ctx2d, W, H, setU, o = {}) {
    const g = ctx(); if (!g) return false; const t0 = performance.now(), k = o.adaptive ? live.k : (o.scale || 1), w = Math.max(16, Math.round(W * k)), h = Math.max(16, Math.round(H * k));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const P = program(name, fs); if (!P) return false; const S = target('scene', w, h);
    g.bindVertexArray(quad); g.useProgram(P.p); g.bindFramebuffer(g.FRAMEBUFFER, S.fb); g.viewport(0, 0, w, h); set(P, 'uRes', [w, h]); setU(P); g.drawArrays(g.TRIANGLES, 0, 3);
    post(S.t, w, h, o); ctx2d.save(); ctx2d.imageSmoothingQuality = 'high'; ctx2d.drawImage(cv, 0, 0, W, H); ctx2d.restore();
    if (o.adaptive) { const ms = performance.now() - t0; live.k = ms > 40 ? Math.max(0.3, live.k * 0.8) : ms < 16 ? Math.min(1, live.k * 1.1) : live.k; } return true;
  }
  // While previewing, the picture is drawn smaller when frames get slow (exports are always full size)
  const live = { k: 1 };
  // The camera both the shader and the 2D overlays (sparks) use
  function camera(eye, at, fov, W, H) { const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const f = nrm(sub(at, eye)), r = nrm(cross(f, [0, 1, 0])), u = cross(r, f), fl = 1 / Math.tan(fov / 2);
    return { eye, at, fov, project: p => { const d = sub(p, eye), z = dot(d, f); if (z <= 0.01) return null; const x = dot(d, r) / z * fl, y = dot(d, u) / z * fl; return [W / 2 + x * H / 2, H / 2 - y * H / 2, z]; } }; }
  return { available, ctx, program, set, setv, tex, target, imageTex, floatTex, textSdf, render, camera, COMMON, get floatOK() { return floatOK; } };
})();

/* Draws the globe's land on the graphics chip (WebGL2). Coastlines are uploaded once; each frame the chip turns and flattens
   them in a few milliseconds. Same look as the 2D version: soft shadow, thick ink coast, paper land, thin borders, graticule.
   Anything that goes wrong returns false and the normal 2D drawing is used instead. */
const GlobeGL = (() => {
  let gl = null, cv = null, failed = false, prog = {}, quad = null, cur = { w: 0, h: 0 };
  const sets = new WeakMap(); let grat = null;
  const mk = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Shared maths: d3's orthographic projection with rotation, done per vertex on the chip
  const PROJ = `
    uniform vec3 uRot; uniform float uScale; uniform vec2 uTrans; uniform vec2 uView;
    vec3 project(vec2 ll) {
      float lam = ll.x + uRot.x, phi = ll.y; float cp = cos(phi);
      float x = cos(lam) * cp, y = sin(lam) * cp, z = sin(phi);
      float cdp = cos(uRot.y), sdp = sin(uRot.y), cdg = cos(uRot.z), sdg = sin(uRot.z);
      float k = z * cdp + x * sdp;
      float xr = x * cdp - z * sdp, yr = y * cdg - k * sdg, zr = k * cdg + y * sdg;
      return vec3(yr, zr, xr);
    }
    vec4 toClip(vec2 s) { return vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0); }`;
  const FILL_VS = `#version 300 es
    in vec2 aLL; uniform vec2 uOff; ${PROJ}
    void main() { vec3 p = project(aLL); vec2 v = p.xy; if (p.z < 0.0) { float l = length(v); v = l > 1e-6 ? v / l : vec2(1.0, 0.0); }
      gl_Position = toClip(uTrans + vec2(v.x, -v.y) * uScale + uOff); }`;
  const FILL_FS = `#version 300 es
    precision mediump float; uniform vec4 uCol; out vec4 o; void main() { o = uCol; }`;
  // Lines are drawn as rounded capsules with soft edges worked out per pixel, so joins are round like the 2D canvas and edges are smooth
  const LINE_VS = `#version 300 es
    in vec4 aSeg; uniform float uWidth; uniform float uPx; ${PROJ} out vec2 vPos; flat out vec2 vA; flat out vec2 vB; flat out vec2 vD;
    void main() {
      vec3 a = project(aSeg.xy), b = project(aSeg.zw); vec2 pa = uTrans + vec2(a.x, -a.y) * uScale, pb = uTrans + vec2(b.x, -b.y) * uScale;
      vec2 d = pb - pa; float L = length(d); d = L > 1e-6 ? d / L : vec2(1.0, 0.0); vec2 n = vec2(-d.y, d.x); float hw = uWidth * 0.5 + uPx;
      int c = gl_VertexID; bool far = c >= 2; float side = (c == 0 || c == 2) ? 1.0 : -1.0;
      vec2 pos = (far ? pb + d * hw : pa - d * hw) + n * hw * side;
      vPos = pos; vA = pa; vB = pb; vD = vec2(a.z, b.z); gl_Position = toClip(pos); }`;
  const LINE_FS = `#version 300 es
    precision highp float; uniform vec4 uCol; uniform float uWidth; uniform float uPx; in vec2 vPos; flat in vec2 vA; flat in vec2 vB; flat in vec2 vD; out vec4 o;
    void main() {
      vec2 ab = vB - vA; float l2 = dot(ab, ab); float t = l2 > 1e-9 ? clamp(dot(vPos - vA, ab) / l2, 0.0, 1.0) : 0.0;
      if (mix(vD.x, vD.y, t) < 0.0) discard;
      float dist = length(vPos - (vA + ab * t)), a = clamp((uWidth * 0.5 - dist) / uPx + 0.5, 0.0, 1.0);
      if (a <= 0.0) discard; o = uCol * a; }`;
  const QUAD_VS = `#version 300 es
    in vec2 aP; void main() { gl_Position = vec4(aP, 0.0, 1.0); }`;

  // The flat map seen from a tilted camera (the Flyover tab): same maths as Flyover's own projection, per vertex
  const FLAT = `
    uniform vec2 uC; uniform float uZ; uniform vec2 uYaw; uniform vec2 uPit; uniform float uD; uniform float uOy; uniform vec2 uView;
    vec2 flatp(vec2 p) { vec2 d = (p - uC) * uZ; float x1 = d.x * uYaw.x - d.y * uYaw.y, y1 = d.x * uYaw.y + d.y * uYaw.x; float k = uD / max(uD * 0.24, uD - y1 * uPit.y); return vec2(uView.x * 0.5 + x1 * k, uOy + y1 * uPit.x * k); }
    vec4 toClip(vec2 s) { return vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0); }`;
  const FFILL_VS = `#version 300 es
    in vec2 aLL; uniform vec2 uOff; ${FLAT}
    void main() { gl_Position = toClip(flatp(aLL) + uOff); }`;
  const FLINE_VS = `#version 300 es
    in vec4 aSeg; uniform float uWidth; uniform float uPx; ${FLAT} out vec2 vPos; flat out vec2 vA; flat out vec2 vB;
    void main() {
      vec2 pa = flatp(aSeg.xy), pb = flatp(aSeg.zw); vec2 d = pb - pa; float L = length(d); d = L > 1e-6 ? d / L : vec2(1.0, 0.0); vec2 n = vec2(-d.y, d.x); float hw = uWidth * 0.5 + uPx;
      int c = gl_VertexID; bool far = c >= 2; float side = (c == 0 || c == 2) ? 1.0 : -1.0;
      vec2 pos = (far ? pb + d * hw : pa - d * hw) + n * hw * side; vPos = pos; vA = pa; vB = pb; gl_Position = toClip(pos); }`;
  const FLINE_FS = `#version 300 es
    precision highp float; uniform vec4 uCol; uniform float uWidth; uniform float uPx; in vec2 vPos; flat in vec2 vA; flat in vec2 vB; out vec4 o;
    void main() { vec2 ab = vB - vA; float l2 = dot(ab, ab); float t = l2 > 1e-9 ? clamp(dot(vPos - vA, ab) / l2, 0.0, 1.0) : 0.0;
      float dist = length(vPos - (vA + ab * t)), a = clamp((uWidth * 0.5 - dist) / uPx + 0.5, 0.0, 1.0); if (a <= 0.0) discard; o = uCol * a; }`;
  function compile(vs, fs) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; ['uRot', 'uScale', 'uTrans', 'uView', 'uOff', 'uCol', 'uWidth', 'uPx', 'uC', 'uZ', 'uYaw', 'uPit', 'uD', 'uOy'].forEach(n => u[n] = gl.getUniformLocation(p, n)); return { p, u };
  }
  function init() {
    if (gl || failed) return !!gl;
    try {
      cv = mk(16, 16); gl = cv.getContext('webgl2', { antialias: true, stencil: true, premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl2');
      prog.fill = compile(FILL_VS, FILL_FS); prog.line = compile(LINE_VS, LINE_FS); prog.quad = compile(QUAD_VS, FILL_FS);
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      return true;
    } catch (e) { failed = true; gl = null; if (typeof console !== 'undefined') console.warn('Graphics chip drawing unavailable, using standard drawing:', e.message); return false; }
  }
  const R = Math.PI / 180;
  // Turns a set of country shapes into two buffers: fan triangles for the fill (even-odd via the stencil) and line segments for strokes
  function upload(fc) {
    let s = sets.get(fc); if (s) return s;
    const tri = [], seg = [], polys = [];
    const ring = r => { const n = r.length - (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? 1 : 0); if (n < 3) return;
      const o = r[0]; for (let i = 1; i < n - 1; i++) tri.push(o[0] * R, o[1] * R, r[i][0] * R, r[i][1] * R, r[i + 1][0] * R, r[i + 1][1] * R);
      for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; seg.push(a[0] * R, a[1] * R, b[0] * R, b[1] * R); } };
    // Each polygon keeps its own range plus a bounding cap (centre and angular radius) so the far side of the globe can be skipped
    const V = p => { const lo = p[0] * R, la = p[1] * R; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
    fc.features.forEach(f => { const g = f.geometry; if (!g) return; (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).forEach(p => {
      const start = tri.length / 2; p.forEach(ring); const count = tri.length / 2 - start; if (!count) return;
      let cx = 0, cy = 0, cz = 0; p[0].forEach(q => { const v = V(q); cx += v[0]; cy += v[1]; cz += v[2]; }); const cl = Math.hypot(cx, cy, cz) || 1; const c = [cx / cl, cy / cl, cz / cl];
      let rad = 0; p[0].forEach(q => { const v = V(q); rad = Math.max(rad, Math.acos(Math.max(-1, Math.min(1, v[0] * c[0] + v[1] * c[1] + v[2] * c[2])))); });
      polys.push({ c, r: rad, start, count }); }); });
    s = { tri: gl.createBuffer(), triN: tri.length / 2, seg: gl.createBuffer(), segN: seg.length / 4, polys };
    gl.bindBuffer(gl.ARRAY_BUFFER, s.tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.seg); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seg), gl.STATIC_DRAW);
    sets.set(fc, s); return s;
  }
  function graticule() {
    if (grat) return grat; const seg = [], add = (a, b) => seg.push(a[0] * R, a[1] * R, b[0] * R, b[1] * R);
    for (let lon = -180; lon < 180; lon += 10) for (let lat = -80; lat < 80; lat += 2) add([lon, lat], [lon, lat + 2]);
    for (let lat = -80; lat <= 80; lat += 10) for (let lon = -180; lon < 180; lon += 2) add([lon, lat], [lon + 2, lat]);
    grat = { seg: gl.createBuffer(), segN: seg.length / 4 }; gl.bindBuffer(gl.ARRAY_BUFFER, grat.seg); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seg), gl.STATIC_DRAW); return grat;
  }
  // Colour strings to premultiplied RGBA
  const colCache = {}; let cctx = null;
  function rgba(c, alpha = 1) {
    const k = c + '|' + alpha; if (colCache[k]) return colCache[k];
    if (!cctx) cctx = mk(1, 1).getContext('2d', { willReadFrequently: true }); cctx.clearRect(0, 0, 1, 1); cctx.fillStyle = '#000'; cctx.fillStyle = c; cctx.fillRect(0, 0, 1, 1); const d = cctx.getImageData(0, 0, 1, 1).data;
    const a = d[3] / 255 * alpha; return (colCache[k] = [d[0] / 255 * a, d[1] / 255 * a, d[2] / 255 * a, a]);
  }
  function setProj(P, proj, W, H) {
    const r = proj.rotate(), t = proj.translate(); gl.uniform3f(P.u.uRot, r[0] * R, r[1] * R, (r[2] || 0) * R); gl.uniform1f(P.u.uScale, proj.scale()); gl.uniform2f(P.u.uTrans, t[0], t[1]); gl.uniform2f(P.u.uView, W, H);
  }
  let pxSize = 1;
  function lines(set, proj, W, H, width, col, once) {
    const P = prog.line; gl.useProgram(P.p); setProj(P, proj, W, H); gl.uniform1f(P.u.uWidth, width); gl.uniform1f(P.u.uPx, pxSize); gl.uniform4fv(P.u.uCol, col);
    // See-through lines are blended once per pixel, so overlapping joins don't show as darker dots
    if (once) { gl.enable(gl.STENCIL_TEST); gl.stencilMask(0xff); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR); }
    const loc = gl.getAttribLocation(P.p, 'aSeg'); gl.bindBuffer(gl.ARRAY_BUFFER, set.seg); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, set.segN); gl.vertexAttribDivisor(loc, 0); gl.disableVertexAttribArray(loc);
    if (once) { gl.clear(gl.STENCIL_BUFFER_BIT); gl.disable(gl.STENCIL_TEST); }
  }
  function fill(set, proj, W, H, off, col) {
    // Non-zero fill, same rule as the 2D canvas: fan triangles count up or down by their winding, and anything not zero is inside
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilMask(0xff); gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    let P = prog.fill; gl.useProgram(P.p); setProj(P, proj, W, H); gl.uniform2f(P.u.uOff, off[0], off[1]); gl.uniform4fv(P.u.uCol, col);
    let loc = gl.getAttribLocation(P.p, 'aLL'); gl.bindBuffer(gl.ARRAY_BUFFER, set.tri); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    // Only shapes at least partly on the near side; whole shapes behind the globe would otherwise smear along its edge
    const rot = proj.rotate(), lo = -rot[0] * R, la = -rot[1] * R, v = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    let runS = -1, runE = -1; const flush = () => { if (runS >= 0) gl.drawArrays(gl.TRIANGLES, runS, runE - runS); runS = -1; };
    set.polys.forEach(q => { const d = Math.acos(Math.max(-1, Math.min(1, q.c[0] * v[0] + q.c[1] * v[1] + q.c[2] * v[2]))); if (d - q.r < Math.PI / 2 + 0.02) { if (runS >= 0 && runE === q.start) runE = q.start + q.count; else { flush(); runS = q.start; runE = q.start + q.count; } } else flush(); });
    flush(); gl.disableVertexAttribArray(loc);
    gl.colorMask(true, true, true, true); gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
    P = prog.quad; gl.useProgram(P.p); gl.uniform4fv(P.u.uCol, col); loc = gl.getAttribLocation(P.p, 'aP'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(loc);
    gl.disable(gl.STENCIL_TEST);
  }
  // Draws graticule and land into ctx (already clipped to the globe). Returns false if the chip can't be used.
  function drawLand(ctx, fc, proj, W, H, u, C) {
    if (!init()) return false;
    try {
      const tf = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0 }, sc = Math.min(1, Math.max(0.25, Math.hypot(tf.a, tf.b)));
      const pw = Math.round(W * sc), ph = Math.round(H * sc); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; } pxSize = 1 / sc;
      gl.viewport(0, 0, pw, ph); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      lines(graticule(), proj, W, H, 1.2 * u, rgba('#ffffff', 0.09), true);
      const set = upload(fc);
      fill(set, proj, W, H, [3 * u, 3 * u], rgba('rgba(6,13,26,1)', 0.5));
      lines(set, proj, W, H, 5 * u, rgba(C.ink));
      fill(set, proj, W, H, [0, 0], rgba(C.paper));
      lines(set, proj, W, H, 1.2 * u, rgba(C.ink, 0.38), true);
      ctx.drawImage(cv, 0, 0, W, H);
      return true;
    } catch (e) { failed = true; if (typeof console !== 'undefined') console.warn('Graphics chip drawing failed, using standard drawing:', e.message); return false; }
  }
  /* ---------- Flyover: flat map land on the chip ---------- */
  // items: [{ key, polys: [[ring of [x, y] plane points], ...holes]... ] }]; built once per map, each item keeps its own ranges
  const flatSets = new WeakMap(); let fgrat = null;
  function uploadFlat(items) {
    let s = flatSets.get(items); if (s) return s;
    const tri = [], seg = [], ranges = [];
    items.forEach(it => { const t0 = tri.length / 2, s0 = seg.length / 4;
      it.polys.forEach(p => p.forEach(r => { const n = r.length - (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? 1 : 0); if (n < 3) return; const o = r[0];
        for (let i = 1; i < n - 1; i++) tri.push(o[0], o[1], r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]);
        for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; seg.push(a[0], a[1], b[0], b[1]); } }));
      ranges.push({ key: it.key, t0, tn: tri.length / 2 - t0, s0, sn: seg.length / 4 - s0 }); });
    s = { tri: gl.createBuffer(), seg: gl.createBuffer(), ranges };
    gl.bindBuffer(gl.ARRAY_BUFFER, s.tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.seg); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seg), gl.STATIC_DRAW);
    flatSets.set(items, s); return s;
  }
  function setFlat(P, c, W, H) { gl.uniform2f(P.u.uC, c.x, c.y); gl.uniform1f(P.u.uZ, c.z * c.sc); gl.uniform2f(P.u.uYaw, Math.cos(c.yaw), Math.sin(c.yaw)); gl.uniform2f(P.u.uPit, Math.cos(c.pitch), Math.sin(c.pitch)); gl.uniform1f(P.u.uD, c.D); gl.uniform1f(P.u.uOy, c.oy); gl.uniform2f(P.u.uView, W, H); }
  // Merged runs of the ranges that are drawn this frame (countries lit up are drawn separately by Flyover)
  function runs(set, skip, kind, only) { const out = []; set.ranges.forEach(r => { if (skip && skip.has(r.key)) return; if (only && !only.has(r.key)) return; const a = kind === 't' ? r.t0 : r.s0, n = kind === 't' ? r.tn : r.sn; if (!n) return; const L = out[out.length - 1]; if (L && L[0] + L[1] === a) L[1] += n; else out.push([a, n]); }); return out; }
  function flatFill(set, c, W, H, off, col, R) {
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilMask(0xff); gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    let P = prog.ffill; gl.useProgram(P.p); setFlat(P, c, W, H); gl.uniform2f(P.u.uOff, off[0], off[1]);
    let loc = gl.getAttribLocation(P.p, 'aLL'); gl.bindBuffer(gl.ARRAY_BUFFER, set.tri); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    R.forEach(([a, n]) => gl.drawArrays(gl.TRIANGLES, a, n)); gl.disableVertexAttribArray(loc);
    gl.colorMask(true, true, true, true); gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
    P = prog.quad; gl.useProgram(P.p); gl.uniform4fv(P.u.uCol, col); loc = gl.getAttribLocation(P.p, 'aP'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(loc);
    gl.disable(gl.STENCIL_TEST);
  }
  function flatLines(buf, c, W, H, width, col, R, once) {
    const P = prog.fline; gl.useProgram(P.p); setFlat(P, c, W, H); gl.uniform1f(P.u.uWidth, width); gl.uniform1f(P.u.uPx, pxSize); gl.uniform4fv(P.u.uCol, col);
    if (once) { gl.enable(gl.STENCIL_TEST); gl.stencilMask(0xff); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR); }
    const loc = gl.getAttribLocation(P.p, 'aSeg'); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribDivisor(loc, 1);
    R.forEach(([a, n]) => { gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, a * 16); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n); });
    gl.vertexAttribDivisor(loc, 0); gl.disableVertexAttribArray(loc);
    if (once) { gl.clear(gl.STENCIL_BUFFER_BIT); gl.disable(gl.STENCIL_TEST); }
  }
  function flatGrat(K, merc) {
    if (fgrat) return fgrat; const seg = [], P = (lon, lat) => [lon * K, -merc(lat) * K];
    for (let lon = -360; lon <= 360; lon += 10) for (let lat = -70; lat < 80; lat += 5) { const a = P(lon, lat), b = P(lon, lat + 5); seg.push(a[0], a[1], b[0], b[1]); }
    for (let lat = -60; lat <= 80; lat += 10) for (let lon = -360; lon < 360; lon += 5) { const a = P(lon, lat), b = P(lon + 5, lat); seg.push(a[0], a[1], b[0], b[1]); }
    fgrat = { buf: gl.createBuffer(), n: seg.length / 4 }; gl.bindBuffer(gl.ARRAY_BUFFER, fgrat.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seg), gl.STATIC_DRAW); return fgrat;
  }
  // Graticule, land shadow, paper land and ink outlines for every country not in skip. o: { grat, K, merc, shadow:[dx,dy], paper, ink, lw, gratW }
  function drawFlat(ctx, items, cam, W, H, o) {
    if (!init()) return false;
    try {
      if (!prog.ffill) { prog.ffill = compile(FFILL_VS, FILL_FS); prog.fline = compile(FLINE_VS, FLINE_FS); }
      const tf = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0 }, sc = Math.min(1, Math.max(0.25, Math.hypot(tf.a, tf.b)));
      const pw = Math.round(W * sc), ph = Math.round(H * sc); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; } pxSize = 1 / sc;
      gl.viewport(0, 0, pw, ph); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (o.grat) { const g = flatGrat(o.K, o.merc); flatLines(g.buf, cam, W, H, o.gratW, rgba('#ffffff', 0.12), [[0, g.n]], true); }
      // skip: drawn by Flyover itself (countries rising or sinking). groups: lit countries resting flat, filled in their colour here.
      const set = uploadFlat(items), grp = o.groups || [], away = new Set(o.skip || []); grp.forEach(g => g.keys.forEach(k => away.add(k)));
      flatFill(set, cam, W, H, o.shadow, rgba('rgba(8,16,28,1)', 0.5), runs(set, null, 't'));
      flatFill(set, cam, W, H, [0, 0], rgba(o.paper), runs(set, away, 't'));
      grp.forEach(g => flatFill(set, cam, W, H, [0, 0], rgba(g.col), runs(set, null, 't', g.keys)));
      flatLines(set.seg, cam, W, H, o.lw, rgba(o.ink), runs(set, o.skip, 's'));
      ctx.drawImage(cv, 0, 0, W, H);
      return true;
    } catch (e) { failed = true; if (typeof console !== 'undefined') console.warn('Graphics chip drawing failed, using standard drawing:', e.message); return false; }
  }
  return { drawLand, drawFlat, get available() { return init(); } };
})();

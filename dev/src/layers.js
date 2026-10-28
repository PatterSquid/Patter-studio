/* Layers: text, shapes, stamps, images and props drawn over any clip, with keyframes, quick in and out animations and
   effects (fire, smoke, explosions, collapsing buildings, cash, sparkles). Every clip type is wrapped by Layers.wrap, so the
   preview, the export and the render workers all draw exactly the same thing. Everything is a pure function of time. */
const Layers = (() => {
  const { cl, lerp, ease, rng } = E;
  const D2R = Math.PI / 180, TAU = Math.PI * 2, INK = '#0d1420', SHADOW = '#08101c';
  const num = (v, d) => (v === undefined || v === null || v === '' || !isFinite(+v)) ? d : +v;
  const r2 = v => Math.round(v * 100) / 100, r4 = v => Math.round(v * 10000) / 10000;
  // Smooth noise: a sum of sines, so flames and smoke wobble continuously instead of jumping frame to frame
  const sn = (x, s = 0) => Math.sin(x + s) * 0.5 + Math.sin(x * 2.31 + s * 1.7) * 0.3 + Math.sin(x * 4.13 + s * 2.9) * 0.2;
  // Shake noise: only a couple of low frequencies, so a shake reads as a rumble at 60 fps instead of flicker
  const shn = (x, s = 0) => Math.sin(x + s) * 0.65 + Math.sin(x * 1.618 + s * 2.1) * 0.35;
  const hash = s => { let h = 2166136261; s = String(s || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rgbOf = c => { c = String(c || '#000'); if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; } const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; };
  const mix = (a, b, t) => { if (!t || t <= 0) return a; const A = rgbOf(a), B = rgbOf(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], cl(t, 0, 1))).toString(16).padStart(2, '0')).join(''); };
  const rgba = (c, a) => { const [r, g, b] = rgbOf(c); return `rgba(${r},${g},${b},${a})`; };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  let mctx = null; const measurer = () => mctx || (mctx = mkCanvas(8, 8).getContext('2d'));

  // Images dropped into a project: kept as data URLs in the project and decoded once here (also inside render workers)
  const assets = {};
  async function setAsset(id, url) {
    if (!id || !url) return; if (assets[id] && assets[id].url === url && assets[id].bmp) return;
    try { const blob = await (await fetch(url)).blob(), bmp = await createImageBitmap(blob); assets[id] = { url, bmp, w: bmp.width, h: bmp.height }; }
    catch (e) { assets[id] = { url, bmp: null, w: 16, h: 9 }; }
    hooks.onAsset && hooks.onAsset(id);
  }
  const setAssets = map => Promise.all(Object.entries(map || {}).map(([id, url]) => setAsset(id, url)));
  const assetsFor = cfg => { const out = {}; ((cfg && cfg.layers) || []).forEach(L => { if (L.type === 'image' && L.asset && assets[L.asset]) out[L.asset] = assets[L.asset].url; }); return out; };
  const hooks = {};

  // Easing between keyframes
  // Cubic bezier easing like CSS: control points (x1, y1) and (x2, y2), ends fixed at (0, 0) and (1, 1)
  const bzCache = new Map();
  function bezier(x1, y1, x2, y2) {
    const key = [x1, y1, x2, y2].join(','); let f = bzCache.get(key); if (f) return f;
    const bx = t => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3, by = t => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
    f = x => { x = cl(x, 0, 1); let lo = 0, hi = 1; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; } return by((lo + hi) / 2); };
    if (bzCache.size > 200) bzCache.clear(); bzCache.set(key, f); return f;
  }
  const EASES = { smooth: ease.io3, linear: x => cl(x, 0, 1), easeIn: x => ease.in3(x), easeOut: x => ease.out3(x), snappy: x => ease.expo(x), gentle: x => ease.sine(x),
    overshoot: x => ease.back(x, 1.8), bouncy: x => { x = cl(x, 0, 1); return 1 - Math.pow(1 - x, 2.2) * Math.cos(x * Math.PI * 2.5); },
    elastic: x => { x = cl(x, 0, 1); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1; },
    bounce: x => bounceOut(x), hold: x => x >= 1 ? 1 : 0 };
  const EASE_OPTS = [['smooth', 'Ease in and out'], ['easeIn', 'Ease in (speeds up)'], ['easeOut', 'Ease out (slows down)'], ['gentle', 'Gentle'], ['linear', 'Steady'], ['snappy', 'Snappy'], ['overshoot', 'Overshoot'], ['bouncy', 'Bouncy'], ['elastic', 'Elastic'], ['bounce', 'Bounce to a stop'], ['hold', 'Hold, then jump'], ['custom', 'Custom curve']];
  const easeFn = k => k && k.e === 'custom' && Array.isArray(k.cb) && k.cb.length === 4 ? bezier(...k.cb.map(v => num(v, 0.5))) : (EASES[k && k.e] || EASES.smooth);
  const bounceOut = x => { x = cl(x, 0, 1); const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
  const kv = k => ({ x: num(k.x, 0.5), y: num(k.y, 0.5), s: num(k.s, 1), rot: num(k.rot, 0), op: num(k.op, 1) });
  const keysOf = L => { if (!Array.isArray(L.keys) || !L.keys.length) return null; const K = L.keys.filter(k => k && isFinite(+k.t)).sort((a, b) => a.t - b.t); return K.length ? K : null; };
  function sample(L, t) {
    const K = keysOf(L); if (!K) return kv(L);
    const lt = t - num(L.start, 0); if (lt <= K[0].t) return kv(K[0]); const Z = K[K.length - 1]; if (lt >= Z.t) return kv(Z);
    let i = 0; while (i < K.length - 2 && K[i + 1].t <= lt) i++;
    const a = kv(K[i]), b = kv(K[i + 1]), f = easeFn(K[i + 1])((lt - K[i].t) / Math.max(1e-6, K[i + 1].t - K[i].t));
    return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), s: lerp(a.s, b.s, f), rot: lerp(a.rot, b.rot, f), op: lerp(a.op, b.op, f) };
  }

  // Quick in and out animations
  const INS = [['none', 'None'], ['fade', 'Fade'], ['pop', 'Pop'], ['slam', 'Slam'], ['slideL', 'Slide in from the left'], ['slideR', 'Slide in from the right'], ['slideU', 'Rise up'], ['drop', 'Drop and bounce'], ['wipe', 'Wipe'], ['draw', 'Draw on'], ['spin', 'Spin in'], ['type', 'Typewriter'], ['wave', 'Letters rise in a wave'], ['bounceIn', 'Letters bounce in'], ['popLetters', 'Letters pop one by one'], ['zoom', 'Zoom in from big'], ['flip', 'Flip up'], ['glitch', 'Glitch in']];
  const LOOPS = [['none', 'None'], ['float', 'Float'], ['pulse', 'Pulse'], ['wobble', 'Wobble'], ['jiggle', 'Letters jiggle'], ['shake', 'Nervous shake'], ['swing', 'Swing']];
  const LETTER_INS = ['wave', 'bounceIn', 'popLetters'];
  const OUTS = [['none', 'None'], ['fade', 'Fade'], ['pop', 'Shrink'], ['slideL', 'Slide out left'], ['slideR', 'Slide out right'], ['slideU', 'Fly up'], ['slideD', 'Fall away'], ['wipe', 'Wipe'], ['draw', 'Rub out'], ['spin', 'Spin out'], ['type', 'Untype']];
  const SLAM = 0.62;
  function anim(L, t, W, H) {
    const m = { dx: 0, dy: 0, sc: 1, op: 1, rot: 0, wipe: 1, wipeOut: 0, draw: 1, chars: 1, sy: 1 };
    // Looping animations that keep going while the layer is on screen, eased in so they never start with a jolt
    if (L.loop && L.loop !== 'none') { const lt = t - num(L.start, 0), g = ease.sine(cl(lt / 0.6, 0, 1)), uu = Math.min(W, H) / 1080, sp = num(L.loopSpeed, 1);
      if (L.loop === 'float') m.dy += Math.sin(lt * 2.2 * sp) * 10 * uu * g; else if (L.loop === 'pulse') m.sc *= 1 + Math.sin(lt * 5 * sp) * 0.045 * g; else if (L.loop === 'wobble') m.rot += Math.sin(lt * 3 * sp) * 3.5 * g;
      else if (L.loop === 'shake') { m.dx += shn(lt * 30 * sp, 3) * 3 * uu * g; m.dy += shn(lt * 27 * sp, 7) * 2.5 * uu * g; } else if (L.loop === 'swing') m.rot += Math.sin(lt * 2 * sp) * 7 * g; else if (L.loop === 'jiggle') m.jiggle = { t: lt * sp, g }; }
    const st = num(L.start, 0), en = num(L.end, st + 3), len = Math.max(0.05, en - st); let di = num(L.inD, 0.5), dout = num(L.outD, 0.4);
    if (di + dout > len) { const k = len / (di + dout); di *= k; dout *= k; }
    const pi = di > 0 ? cl((t - st) / di, 0, 1) : 1, po = dout > 0 ? cl((en - t) / dout, 0, 1) : 1, D = Math.max(W, H) * 0.3;
    const a = L.anIn || 'fade', b = L.anOut || 'fade';
    if (pi < 1) {
      if (a === 'fade') m.op *= ease.sine(pi);
      else if (a === 'pop') { m.sc *= Math.max(0, ease.back(pi, 2.0)); m.op *= cl(pi * 4, 0, 1); }
      else if (a === 'slam') { const q = cl(pi / SLAM, 0, 1); m.sc *= 1 + 1.9 * (1 - ease.in3(q)); m.op *= cl(q * 3, 0, 1); if (pi > SLAM) { const p2 = (pi - SLAM) / (1 - SLAM); m.sc *= 1 - 0.07 * Math.sin(Math.PI * p2) * (1 - p2); } }
      else if (a === 'slideL') { m.dx -= (1 - ease.out3(pi)) * D; m.op *= cl(pi * 2.5, 0, 1); }
      else if (a === 'slideR') { m.dx += (1 - ease.out3(pi)) * D; m.op *= cl(pi * 2.5, 0, 1); }
      else if (a === 'slideU') { m.dy += (1 - ease.out3(pi)) * D * 0.6; m.op *= cl(pi * 2.5, 0, 1); }
      else if (a === 'drop') { m.dy -= (1 - bounceOut(pi)) * H * 0.75; m.op *= cl(pi * 6, 0, 1); }
      else if (a === 'wipe') m.wipe = ease.io3(pi);
      else if (a === 'draw') m.draw = ease.io3(pi);
      else if (a === 'spin') { m.rot -= (1 - ease.out3(pi)) * 300; m.sc *= ease.out3(pi); m.op *= cl(pi * 3, 0, 1); }
      else if (a === 'type') m.chars = pi;
      else if (a === 'zoom') { const q = ease.out3(pi); m.sc *= 1 + 1.6 * (1 - q); m.op *= cl(pi * 2.2, 0, 1); }
      else if (a === 'flip') { m.sy = Math.max(0.001, ease.back(pi, 2.2)); m.op *= cl(pi * 3, 0, 1); }
      else if (a === 'glitch') { const f = Math.floor((t - st) * 30), r = rng(f * 13 + 5), k = 1 - pi; m.dx += (r() - 0.5) * 60 * k * (Math.min(W, H) / 1080); m.op *= r() < 0.35 * k ? 0.15 : 1; m.glitch = k; }
      else if (LETTER_INS.includes(a)) m.letterIn = { kind: a, p: pi };
    }
    if (po < 1) {
      const q = 1 - po;
      if (b === 'fade') m.op *= ease.sine(po);
      else if (b === 'pop') { m.sc *= q < 0.3 ? 1 + 0.1 * ease.sine(q / 0.3) : 1.1 * (1 - ease.in3((q - 0.3) / 0.7)); m.op *= cl(po * 4, 0, 1); }
      else if (b === 'slideL') { m.dx -= (1 - ease.out3(po)) * D; m.op *= cl(po * 2.5, 0, 1); }
      else if (b === 'slideR') { m.dx += (1 - ease.out3(po)) * D; m.op *= cl(po * 2.5, 0, 1); }
      else if (b === 'slideU') { m.dy -= (1 - ease.out3(po)) * D * 0.7; m.op *= cl(po * 2.5, 0, 1); }
      else if (b === 'slideD') { m.dy += (1 - ease.out3(po)) * H * 0.7; m.rot += (1 - ease.out3(po)) * 18; m.op *= cl(po * 3, 0, 1); }
      else if (b === 'wipe') m.wipeOut = 1 - ease.io3(po);
      else if (b === 'draw') m.draw = Math.min(m.draw, ease.io3(po));
      else if (b === 'spin') { m.rot += ease.in3(q) * 300; m.sc *= 1 - ease.in3(q); }
      else if (b === 'type') m.chars = Math.min(m.chars, po);
    }
    m.impact = a === 'slam' ? t - st - di * SLAM : -1; m.di = di;
    return m;
  }

  // Polyline helpers for hand drawn shapes
  const plen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
  function partial(p, f) { if (f >= 1) return p; if (f <= 0 || p.length < 2) return []; const goal = plen(p) * f, out = [p[0]]; let s = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s + d >= goal) { const q = (goal - s) / (d || 1); out.push([lerp(p[i - 1][0], p[i][0], q), lerp(p[i - 1][1], p[i][1], q)]); return out; } s += d; out.push(p[i]); } return out; }
  const dens = (pts, n = 10) => { const o = []; for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < n; j++) o.push([lerp(pts[i][0], pts[i + 1][0], j / n), lerp(pts[i][1], pts[i + 1][1], j / n)]); o.push(pts[pts.length - 1]); return o; };
  const strokePts = (ctx, p) => { ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); };
  function penAll(strokes, prog) { if (prog >= 1) return strokes; const L = strokes.map(plen), tot = L.reduce((a, b) => a + b, 0); let left = tot * prog; const out = []; strokes.forEach((s, i) => { if (left <= 0) return; out.push(partial(s, L[i] ? Math.min(1, left / L[i]) : 1)); left -= L[i]; }); return out; }

  // Chalk texture (used for props drawn in chalk on the blackboard)
  const patCache = {};
  function chalkPat(ctx, col) {
    if (patCache[col]) return patCache[col]; const c = mkCanvas(128, 128), g = c.getContext('2d'), im = g.createImageData(128, 128), r = rng(17), [R, G, B] = rgbOf(col);
    for (let i = 0; i < im.data.length; i += 4) { const a = r() < 0.78 ? 170 + r() * 85 : r() * 70; im.data[i] = R; im.data[i + 1] = G; im.data[i + 2] = B; im.data[i + 3] = a; }
    g.putImageData(im, 0, 0); patCache[col] = ctx.createPattern(c, 'repeat'); return patCache[col];
  }

  /* ---------- Text ---------- */
  const FONTS = { display: s => `${s}px Anton, Impact, sans-serif`, label: s => `700 ${s}px "Archivo Narrow", "Arial Narrow", sans-serif`, serif: s => `italic 500 ${s}px Lora, Georgia, serif`, hand: s => `700 ${s}px Kalam, cursive`, marker: s => `${s}px "Gochi Hand", cursive` };
  const FONT_OPTS = [['display', 'Headline (Anton)'], ['label', 'Narrow (Archivo)'], ['serif', 'Newspaper (Lora)'], ['hand', 'Handwriting (Kalam)'], ['marker', 'Marker (Gochi)']];
  const tlCache = new Map();
  // The width of the frame being drawn, so long text can wrap to fit it (a 9:16 frame is much narrower than 16:9)
  let FW = 1920;
  function textLayout(L, u) {
    const maxW = FW * 0.9 / Math.max(0.2, Math.abs(num(L.s, 1))), key = [L.text, L.font, L.size, L.caps, u, E.fontVersion || 0, Math.round(maxW)].join('|'); let T = tlCache.get(key); if (T) return T;
    const sz = cl(num(L.size, 96), 4, 1200) * u, f = FONTS[L.font] || FONTS.display, raw = String(L.text ?? ''), m = measurer(); m.font = f(sz);
    // Lines you typed stay as they are; a line too wide for the frame breaks between words
    const lines = []; (L.caps ? raw.toUpperCase() : raw).split('\n').forEach(ln => { if (m.measureText(ln).width <= maxW || !/\s/.test(ln.trim())) { lines.push(ln); return; } let cur = ''; ln.split(/\s+/).forEach(w => { const tryL = cur ? cur + ' ' + w : w; if (cur && m.measureText(tryL).width > maxW) { lines.push(cur); cur = w; } else cur = tryL; }); if (cur) lines.push(cur); });
    const ws = lines.map(l => m.measureText(l).width), lh = sz * 1.14;
    T = { sz, f, lines, ws, lh, w: Math.max(sz * 0.4, ...ws), h: lh * lines.length };
    if (tlCache.size > 300) tlCache.clear(); tlCache.set(key, T); return T;
  }
  // Text drawn letter by letter, for the wave, bounce and pop entrances and the jiggle loop
  function drawLetters(ctx, L, T, I, st, col, bg) {
    const sz = T.sz, n = Math.max(1, T.lines.reduce((a, l) => a + l.length, 0)), li = I.letterIn, jg = I.jiggle; let idx = 0;
    T.lines.forEach((ln, i) => {
      const y0 = -T.h / 2 + T.lh * (i + 0.5) + sz * 0.03; let x = -T.ws[i] / 2;
      if (st === 'highlight') { ctx.save(); ctx.fillStyle = rgba(bg, 0.92); ctx.fillRect(x - sz * 0.18, y0 - T.lh * 0.36, T.ws[i] + sz * 0.36, T.lh * 0.74); ctx.restore(); }
      for (const ch of ln) {
        const w = ctx.measureText(ch).width, k = n > 1 ? idx / (n - 1) : 0; let dy = 0, sc = 1, op = 1, rot = 0;
        if (li) { const p = cl(li.p * 1.7 - k * 0.7, 0, 1);
          if (li.kind === 'wave') { dy = (1 - ease.back(p, 2.4)) * sz * 0.9; op = cl(p * 3, 0, 1); }
          else if (li.kind === 'bounceIn') { dy = -(1 - bounceOut(p)) * sz * 1.6; op = cl(p * 5, 0, 1); }
          else { sc = Math.max(0, ease.back(p, 2.6)); op = cl(p * 4, 0, 1); rot = (1 - p) * -25; } }
        if (jg) dy += Math.sin(jg.t * 6 - idx * 0.7) * sz * 0.06 * jg.g;
        if (op > 0.002 && ch.trim()) { ctx.save(); ctx.globalAlpha *= op; ctx.translate(x + w / 2, y0 + dy); ctx.rotate(rot * D2R); ctx.scale(sc, sc);
          if (st === 'outline') { ctx.fillStyle = INK; ctx.lineWidth = sz * 0.17; ctx.strokeStyle = INK; ctx.strokeText(ch, -w / 2 + sz * 0.06, sz * 0.07); ctx.fillText(ch, -w / 2 + sz * 0.06, sz * 0.07); ctx.strokeText(ch, -w / 2, 0); }
          else if (st === 'shadow') { ctx.fillStyle = INK; ctx.fillText(ch, -w / 2 + sz * 0.06, sz * 0.06); }
          ctx.fillStyle = col; ctx.fillText(ch, -w / 2, 0); ctx.restore(); }
        x += w; idx++;
      }
    });
  }
  const TEXT = {
    name: 'Text', colour: '#b8862e',
    box(L, u) { const T = textLayout(L, u), st = L.style || 'outline', px = st === 'banner' ? T.sz * 0.5 : st === 'highlight' ? T.sz * 0.25 : T.sz * 0.12, py = st === 'banner' ? T.sz * 0.24 : T.sz * 0.08; return [-T.w / 2 - px, -T.h / 2 - py, T.w / 2 + px, T.h / 2 + py]; },
    draw(ctx, L, t, I) {
      const T = textLayout(L, I.u), st = L.style || 'outline', col = L.colour || (st === 'highlight' ? INK : '#ffffff'), bg = L.bg || (st === 'highlight' ? '#f7c531' : '#e3302c'), sz = T.sz;
      // Typewriter: whole letters so far, and the next letter fading in so it never pops
      const total = T.lines.reduce((a, l) => a + l.length, 0), typed = total * I.chars; let left = I.chars >= 1 ? 1e9 : Math.floor(typed + 1e-6), frac = I.chars >= 1 ? 0 : typed - left; const frac0 = frac;
      if (st === 'banner') { const w = T.w + sz * 0.9, h = T.h + sz * 0.38, s = sz * 0.1; ctx.fillStyle = SHADOW; ctx.fillRect(-w / 2 + s, -h / 2 + s, w, h); ctx.fillStyle = bg; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.lineWidth = Math.max(2, sz * 0.07); ctx.strokeStyle = INK; ctx.lineJoin = 'miter'; ctx.strokeRect(-w / 2, -h / 2, w, h); }
      ctx.font = T.f(sz); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      if (I.letterIn || I.jiggle) return drawLetters(ctx, L, T, I, st, col, bg);
      T.lines.forEach((ln, i) => {
        if (left <= 0 && !(frac > 0.01 && left === 0)) return; const s = ln.length > left ? ln.slice(0, Math.max(0, left)) : ln, nxt = ln.length > left && left >= 0 && frac > 0.01 ? ln[left] : ''; left -= ln.length; if (left < 0) frac = 0;
        const y = -T.h / 2 + T.lh * (i + 0.5) + sz * 0.03, x = -T.ws[i] / 2;
        if (st === 'highlight') { const sw = I.chars >= 1 ? T.ws[i] : measurer().measureText(s).width; ctx.save(); ctx.fillStyle = rgba(bg, 0.92); ctx.beginPath(); const hx = x - sz * 0.18, hy = y - T.lh * 0.36, hw = sw + sz * 0.36, hh = T.lh * 0.74; ctx.moveTo(hx + sz * 0.05, hy + sz * 0.04); ctx.lineTo(hx + hw, hy - sz * 0.02); ctx.lineTo(hx + hw - sz * 0.04, hy + hh); ctx.lineTo(hx, hy + hh + sz * 0.03); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.font = T.f(sz); }
        if (st === 'outline') { ctx.fillStyle = INK; ctx.lineWidth = sz * 0.17; ctx.strokeStyle = INK; ctx.strokeText(s, x + sz * 0.06, y + sz * 0.07); ctx.fillText(s, x + sz * 0.06, y + sz * 0.07); ctx.strokeText(s, x, y); }
        else if (st === 'shadow') { ctx.fillStyle = INK; ctx.fillText(s, x + sz * 0.06, y + sz * 0.06); }
        ctx.fillStyle = col; ctx.fillText(s, x, y);
        if (nxt) { const nx = x + ctx.measureText(s).width; ctx.save(); ctx.globalAlpha *= frac0; if (st === 'outline') { ctx.lineWidth = sz * 0.17; ctx.strokeStyle = INK; ctx.strokeText(nxt, nx, y); } ctx.fillStyle = col; ctx.fillText(nxt, nx, y); ctx.restore(); }
      });
    }
  };

  /* ---------- Shapes and pointers ---------- */
  const SHAPES = [['circle', 'Circle'], ['scribble', 'Scribble ring'], ['arrow', 'Comic arrow'], ['pointer', 'Pen arrow'], ['curve', 'Curved arrow'], ['box', 'Box'], ['underline', 'Underline'], ['tick', 'Tick'], ['cross', 'Cross'], ['spot', 'Spotlight']];
  const shCache = new Map();
  function shapeStrokes(L, u) {
    const k = L.shape || 'circle', w = cl(num(L.w, 380), 4, 6000) * u, h = cl(num(L.h, 240), 4, 6000) * u, key = [k, w, h, L.id].join('|'); let S = shCache.get(key); if (S) return S;
    const r = rng(hash(L.id) || 5), N = 72; S = [];
    if (k === 'circle' || k === 'scribble') {
      const turns = k === 'circle' ? 1.1 : 2.3, a0 = -Math.PI * 0.62, p1 = r() * 6, p2 = r() * 6, pts = [];
      for (let i = 0; i <= N * turns; i++) { const a = a0 + i / N * TAU, f = i / (N * turns), wob = k === 'circle' ? 1 + 0.028 * Math.sin(a * 2 + p1) + 0.02 * f : 1 + 0.06 * Math.sin(a * 1.5 + p1) + 0.035 * Math.sin(a * 3.7 + p2) - 0.07 * f; pts.push([Math.cos(a) * w / 2 * wob, Math.sin(a) * h / 2 * wob]); }
      S.push(pts);
    } else if (k === 'box') S.push(dens([[-w / 2 - 8 * u, -h / 2 + 2 * u], [w / 2 + 3 * u, -h / 2 - 2 * u], [w / 2, h / 2 + 3 * u], [-w / 2 - 2 * u, h / 2], [-w / 2 + 3 * u, -h / 2 - 9 * u]], 12));
    else if (k === 'underline') { const pts = []; for (let i = 0; i <= 40; i++) { const f = i / 40; pts.push([lerp(-w / 2, w / 2, f), Math.sin(f * Math.PI) * h * 0.05 - (f > 0.9 ? (f - 0.9) * h * 0.9 : 0)]); } S.push(pts); }
    else if (k === 'tick') S.push(dens([[-w / 2, -h * 0.02], [-w * 0.14, h / 2], [w / 2, -h / 2]], 14));
    else if (k === 'cross') { S.push(dens([[-w / 2, -h / 2], [w / 2, h / 2]], 16)); S.push(dens([[w / 2, -h / 2], [-w / 2, h / 2]], 16)); }
    else if (k === 'pointer' || k === 'curve') {
      const pts = [], bow = k === 'curve' ? h * 0.9 : h * 0.06; for (let i = 0; i <= 40; i++) { const f = i / 40; pts.push([lerp(-w / 2, w / 2, f), (k === 'curve' ? h * 0.35 : 0) - Math.sin(f * Math.PI) * bow]); }
      S.push(pts); const e = pts[pts.length - 1], q = pts[pts.length - 4], ang = Math.atan2(e[1] - q[1], e[0] - q[0]), hs = Math.min(w, 400 * u) * 0.16;
      S.push([[e[0] + Math.cos(ang + 2.55) * hs, e[1] + Math.sin(ang + 2.55) * hs], e, [e[0] + Math.cos(ang - 2.55) * hs, e[1] + Math.sin(ang - 2.55) * hs]]);
    }
    if (shCache.size > 200) shCache.clear(); shCache.set(key, S); return S;
  }
  const SHAPE = {
    name: 'Shape', colour: '#2f7f86',
    box(L, u) { const k = L.shape || 'circle', w = cl(num(L.w, 380), 4, 6000) * u, h = cl(num(L.h, 240), 4, 6000) * u, lw = cl(num(L.thick, 14), 1, 200) * u; if (k === 'arrow') return [-w / 2, -w * 0.27, w / 2, w * 0.27]; if (k === 'underline') return [-w / 2 - lw, -h * 0.4, w / 2 + lw, h * 0.2]; if (k === 'curve') return [-w / 2 - lw, -h * 0.65, w / 2 + lw, h * 0.45]; if (k === 'pointer') return [-w / 2 - lw, -h * 0.3, w / 2 + lw, h * 0.3]; return [-w / 2 - lw, -h / 2 - lw, w / 2 + lw, h / 2 + lw]; },
    draw(ctx, L, t, I) {
      const k = L.shape || 'circle', col = L.colour || '#e3302c', u = I.u, lw = cl(num(L.thick, 14), 1, 200) * u;
      if (k === 'spot') { const w = cl(num(L.w, 380), 4, 6000) * u, h = cl(num(L.h, 240), 4, 6000) * u; ctx.save(); ctx.globalAlpha *= I.draw; ctx.beginPath(); ctx.rect(-30000 * u, -30000 * u, 60000 * u, 60000 * u); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); ctx.fillStyle = 'rgba(4,8,18,' + cl(num(L.dim, 0.62), 0, 0.95) + ')'; ctx.fill('evenodd'); ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); ctx.lineWidth = 5 * u; ctx.strokeStyle = rgba(col, 0.9); ctx.stroke(); ctx.restore(); return; }
      if (k === 'arrow') { const w = cl(num(L.w, 380), 4, 6000) * u; E.arrow(ctx, w / 2, 0, 0, w, col, I.C, 1); return; }
      const S = penAll(shapeStrokes(L, u), I.draw); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = lw + 9 * u; S.forEach(p => p.length > 1 && strokePts(ctx, p));
      ctx.strokeStyle = col; ctx.lineWidth = lw; S.forEach(p => p.length > 1 && strokePts(ctx, p));
    }
  };

  /* ---------- Stamps ---------- */
  const STAMPS = [['BREAKING', '#e3302c', 'rect'], ['FAKE', '#e3302c', 'rect'], ['CONFIRMED', '#2f9a44', 'rect'], ['?!', '#f7c531', 'burst'], ['LIES', '#e3302c', 'round'], ['SHAMBLES', '#f5821f', 'rect'], ['EXCLUSIVE', '#1d5bbd', 'rect'], ['DENIED', '#e3302c', 'round'], ['APPROVED', '#2f9a44', 'round'], ['WOW', '#f7c531', 'burst']];
  const stCache = new Map();
  function stampDims(L, u) {
    const sz = cl(num(L.size, 120), 8, 800) * u, text = String(L.text || 'STAMP').toUpperCase(), shp = L.shape || 'rect', m = measurer(); m.font = `${sz}px Anton, Impact, sans-serif`; const tw = m.measureText(text).width;
    if (shp === 'round') { const d = Math.max(tw * 1.05 + sz * 1.1, sz * 2.7); return { sz, text, shp, tw, w: d, h: d }; }
    if (shp === 'burst') { const d = Math.max(tw + sz * 1.4, sz * 2.4); return { sz, text, shp, tw, w: d * 1.1, h: d * 0.9 }; }
    return { sz, text, shp, tw, w: tw + sz * 1.0, h: sz * 1.62 };
  }
  function stampCanvas(L, u, sc) {
    const D = stampDims(L, u), col = L.colour || '#e3302c', key = [D.text, col, D.shp, D.sz, sc, E.fontVersion || 0].join('|'); let S = stCache.get(key); if (S) { stCache.delete(key); stCache.set(key, S); return S; }
    const { w, h, sz } = D, pad = 4, c = mkCanvas((w + pad * 2) * sc, (h + pad * 2) * sc), g = c.getContext('2d'); g.scale(sc, sc); g.translate(w / 2 + pad, h / 2 + pad);
    g.strokeStyle = col; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (D.shp === 'round') { const R = w / 2 - sz * 0.08; g.lineWidth = sz * 0.1; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke(); g.lineWidth = sz * 0.035; g.beginPath(); g.arc(0, 0, R * 0.8, 0, TAU); g.stroke(); let fs = sz; g.font = `${fs}px Anton, Impact, sans-serif`; while (g.measureText(D.text).width > R * 1.45 && fs > 8) { fs *= 0.94; g.font = `${fs}px Anton, Impact, sans-serif`; } g.fillText(D.text, 0, fs * 0.04); [-1, 1].forEach(sd => { g.save(); g.translate(0, sd * R * 0.62); g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? sz * 0.07 : sz * 0.17; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.restore(); }); }
    else { g.lineWidth = sz * 0.1; g.strokeRect(-w / 2 + sz * 0.06, -h / 2 + sz * 0.06, w - sz * 0.12, h - sz * 0.12); g.lineWidth = sz * 0.035; g.strokeRect(-w / 2 + sz * 0.22, -h / 2 + sz * 0.22, w - sz * 0.44, h - sz * 0.44); g.font = `${sz}px Anton, Impact, sans-serif`; g.fillText(D.text, 0, sz * 0.05); }
    // Worn ink: knock out specks and scratches so it looks rubber stamped
    g.globalCompositeOperation = 'destination-out'; const r = rng(hash(D.text) + 3), n = Math.round(w * h / (sz * sz) * 110);
    for (let i = 0; i < n; i++) { g.globalAlpha = 0.45 + r() * 0.55; g.beginPath(); g.arc((r() - 0.5) * w, (r() - 0.5) * h, sz * (0.006 + Math.pow(r(), 3) * 0.04), 0, TAU); g.fill(); }
    g.globalAlpha = 0.6; g.lineWidth = sz * 0.018; for (let i = 0; i < 4; i++) { const x = (r() - 0.5) * w, y = (r() - 0.5) * h, a = r() * Math.PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * sz * 0.9, y + Math.sin(a) * sz * 0.9); g.stroke(); }
    S = { c, w: w + pad * 2, h: h + pad * 2 }; stCache.set(key, S); while (stCache.size > 24) stCache.delete(stCache.keys().next().value); return S;
  }
  const STAMP = {
    name: 'Stamp', colour: '#a8322d',
    box(L, u) { const D = stampDims(L, u); return [-D.w / 2, -D.h / 2, D.w / 2, D.h / 2]; },
    draw(ctx, L, t, I) {
      const D = stampDims(L, I.u), col = L.colour || '#e3302c';
      if (D.shp === 'burst') { E.star(ctx, 0, 0, D.w * 0.55, D.w * 0.36, 12, col, I.C, I.u, -0.2, hash(D.text)); ctx.font = `${D.sz}px Anton, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = D.sz * 0.16; ctx.strokeStyle = INK; ctx.strokeText(D.text, 0, D.sz * 0.05); ctx.fillStyle = '#ffffff'; ctx.fillText(D.text, 0, D.sz * 0.05); return; }
      const tr = ctx.getTransform(), sc = Math.hypot(tr.a, tr.b), b = Math.pow(2, Math.ceil(Math.log2(Math.max(0.05, sc)) * 3) / 3), S = stampCanvas(L, I.u, cl(b, 0.1, 4));
      ctx.save(); ctx.globalAlpha *= 0.94; ctx.drawImage(S.c, -S.w / 2, -S.h / 2, S.w, S.h); ctx.restore();
    }
  };

  /* ---------- Images ---------- */
  const IMAGE = {
    name: 'Image', colour: '#6a4f9a',
    dims(L, u) { const A = assets[L.asset], w = cl(num(L.w, 640), 10, 6000) * u, h = w * (A && A.w ? A.h / A.w : 9 / 16); return { A, w, h }; },
    box(L, u) { const { w, h } = this.dims(L, u), f = L.frame || 'panel', p = f === 'polaroid' ? w * 0.06 : 0, pb = f === 'polaroid' ? w * 0.2 : 0; if (f === 'round') { const d = Math.min(w, h); return [-d / 2, -d / 2, d / 2, d / 2]; } return [-w / 2 - p, -h / 2 - p, w / 2 + p, h / 2 + pb]; },
    draw(ctx, L, t, I) {
      const { A, w, h } = this.dims(L, I.u), f = L.frame || 'panel', u = I.u, img = A && A.bmp;
      const pic = (x, y, ww, hh) => { if (img) { const ia = A.w / A.h, ba = ww / hh; let sx = 0, sy = 0, sw = A.w, sh = A.h; if (ia > ba) { sw = A.h * ba; sx = (A.w - sw) / 2; } else { sh = A.w / ba; sy = (A.h - sh) / 2; } ctx.drawImage(img, sx, sy, sw, sh, x, y, ww, hh); } else { ctx.fillStyle = '#5b6578'; ctx.fillRect(x, y, ww, hh); ctx.fillStyle = '#e9eef6'; ctx.font = `${Math.min(ww, hh) * 0.16}px Anton, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('IMAGE', x + ww / 2, y + hh / 2); } };
      if (I.flip) ctx.scale(-1, 1);
      if (f === 'round') { const d = Math.min(w, h); ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(10 * u, 10 * u, d / 2, 0, TAU); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, d / 2, 0, TAU); ctx.clip(); pic(-d / 2, -d / 2, d, d); ctx.restore(); ctx.lineWidth = 8 * u; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(0, 0, d / 2, 0, TAU); ctx.stroke(); return; }
      if (f === 'polaroid') { const p = w * 0.06, pb = w * 0.2; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w / 2 - p + 12 * u, -h / 2 - p + 14 * u, w + p * 2, h + p + pb); ctx.fillStyle = '#fbfaf5'; ctx.fillRect(-w / 2 - p, -h / 2 - p, w + p * 2, h + p + pb); pic(-w / 2, -h / 2, w, h); ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.strokeRect(-w / 2, -h / 2, w, h); return; }
      if (f === 'panel') { ctx.fillStyle = SHADOW; ctx.fillRect(-w / 2 + 14 * u, -h / 2 + 14 * u, w, h); }
      pic(-w / 2, -h / 2, w, h);
      if (f === 'panel') { ctx.lineWidth = 8 * u; ctx.strokeStyle = INK; ctx.lineJoin = 'miter'; ctx.strokeRect(-w / 2, -h / 2, w, h); }
    }
  };

  /* ---------- Props: drawn from simple shapes so they stay crisp at any size, in comic or chalk style ---------- */
  const P2 = () => new Path2D();
  const R = (x, y, w, h) => { const p = P2(); p.rect(x, y, w, h); p.rects = [[x, y, w, h]]; return p; };
  const RR = (x, y, w, h, r) => { const p = P2(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  const PG = pts => { const p = P2(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };
  const LN = (...ls) => { const p = P2(); ls.forEach(pts => pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); return p; };
  const CI = (cx, cy, r) => { const p = P2(); p.arc(cx, cy, r, 0, TAU); return p; };
  const EL = (cx, cy, rx, ry) => { const p = P2(); p.ellipse(cx, cy, rx, ry, 0, 0, TAU); return p; };
  const BL = cs => { const p = P2(); cs.forEach(([x, y, r]) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); }); p.cs = cs; return p; };
  // Outline of a blob made of overlapping circles: only the arcs that are not inside another circle
  function blobOutline(cs) { const runs = []; cs.forEach(([x, y, r], i) => { let cur = null; for (let k = 0; k <= 96; k++) { const a = k / 96 * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, inside = cs.some(([x2, y2, r2], j) => j !== i && Math.hypot(px - x2, py - y2) < r2 - 0.01); if (!inside) { if (!cur) { cur = []; runs.push(cur); } cur.push([px, py]); } else cur = null; } }); const p = P2(); runs.forEach(rn => rn.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); return p; }
  const many = (fn, list) => { const p = P2(); p.rects = []; list.forEach(a => { const q = fn(...a); p.addPath(q); if (q.rects) p.rects.push(...q.rects); }); return p; };
  const GLASS = '#bfe3f5', GLASS2 = '#9fcbe6', WOOD = '#6b3f22', TYRE = '#1a1d24', HUB = '#c9ced6', GOLD = '#f7c531';
  const wheel = (cx, cy, r) => ({ wheel: [cx, cy, r] });
  const car = (o = {}) => () => {
    const c = o.c || 'M', parts = [
      { p: PG([[30, 22], [42, 5], [82, 5], [97, 22]]), f: c },
      { p: PG([[37, 21], [46, 9], [60, 9], [60, 21]]), f: GLASS }, { p: PG([[64, 21], [64, 9], [79, 9], [89, 21]]), f: GLASS },
      { p: RR(3, 20, 114, 22, 9), f: c },
    ];
    if (o.police) parts.push({ p: many(R, [[8, 29, 10, 6], [28, 29, 10, 6], [48, 29, 10, 6], [68, 29, 10, 6], [88, 29, 10, 6]]), f: '#1d5bbd', k: false }, { p: many(R, [[18, 29, 10, 6], [38, 29, 10, 6], [58, 29, 10, 6], [78, 29, 10, 6], [98, 29, 10, 6]]), f: GOLD, k: false }, { p: LN([[6, 29], [112, 29]], [[6, 35], [112, 35]]), f: null, lw: 0.5 }, { p: R(54, 0, 16, 5), f: '#e9eef6' }, { anim: 'siren', x: 54, y: 0, w: 16, h: 5 });
    parts.push({ p: LN([[62, 22], [62, 40]]), f: null, lw: 0.7 }, { p: CI(112, 27, 3.2), f: GOLD }, { p: R(3, 26, 5, 6), f: '#e3302c' }, { p: R(48, 25, 8, 2.4), f: '#e9eef6', lw: 0.5 });
    parts.push(wheel(30, 42, 10.5), wheel(90, 42, 10.5)); return parts;
  };
  const shop = (sign, col, awning) => () => {
    const parts = [{ p: R(4, 8, 92, 72), f: 'M' }, { p: R(0, 4, 100, 7), f: 'M2' }, { p: R(9, 14, 82, 15), f: '#f4eedf' }, { text: sign, x: 50, y: 21.8, sz: 10.5, f: INK }];
    if (awning) { for (let i = 0; i < 8; i++) { const x = 6 + i * 11; const p = P2(); p.moveTo(x, 32); p.lineTo(x + 11, 32); p.lineTo(x + 11, 40); p.quadraticCurveTo(x + 5.5, 46, x, 40); p.closePath(); parts.push({ p, f: i % 2 ? '#ffffff' : '#e3302c', lw: 0.7 }); } }
    parts.push({ p: R(10, 48, 46, 28), f: GLASS }, { p: LN([[33, 48], [33, 76]]), f: null, lw: 0.6 }, { p: R(64, 46, 24, 34), f: WOOD }, { p: CI(83, 64, 1.4), f: GOLD, k: false });
    if (!awning) parts.push({ p: many(R, [[13, 34, 16, 9], [42, 34, 16, 9], [71, 34, 16, 9]]), f: GOLD, lw: 0.7 });
    return parts;
  };
  const PROPS = {
    house: { name: 'House', w: 100, h: 100, col: '#ead0a0', build: () => [
      { p: R(66, 12, 11, 26), f: '#a2493a' }, { p: R(64, 9, 15, 5), f: '#8a3f2e' },
      { p: PG([[2, 47], [50, 8], [98, 47]]), f: '#8c2f27' }, { p: R(10, 45, 80, 55), f: 'M' },
      { p: R(42, 68, 16, 32), f: WOOD }, { p: CI(54, 85, 1.4), f: GOLD, k: false },
      { p: many(R, [[17, 55, 18, 16], [65, 55, 18, 16]]), f: GLASS }, { p: LN([[26, 55], [26, 71]], [[17, 63], [35, 63]], [[74, 55], [74, 71]], [[65, 63], [83, 63]]), f: null, lw: 0.6 },
      { p: R(38, 97, 24, 3), f: '#9a9184', lw: 0.6 }] },
    tenement: { name: 'Tenement', w: 100, h: 150, col: '#b8583f', build: () => {
      const W = [], sh = []; [22, 52, 82].forEach(y => [12, 42, 72].forEach(x => { W.push([x, y, 16, 21]); sh.push([[x, y + 9], [x + 16, y + 9]]); }));
      return [{ p: many(R, [[14, 2, 14, 12], [72, 2, 14, 12]]), f: '#8a3f2e' }, { p: many(R, [[16, -2, 4, 5], [22, -2, 4, 5], [74, -2, 4, 5], [80, -2, 4, 5]]), f: '#c96a3a', lw: 0.6 },
        { p: R(4, 12, 92, 138), f: 'M' }, { p: R(0, 9, 100, 7), f: 'M2' }, { p: many(R, [[4, 45, 92, 2.5], [4, 75, 92, 2.5], [4, 105, 92, 2.5]]), f: 'M2', lw: 0.5 },
        { p: many(R, W), f: GLASS }, { p: LN(...sh), f: null, lw: 0.6 },
        { p: (() => { const p = P2(); p.moveTo(40, 150); p.lineTo(40, 126); p.arc(50, 126, 10, Math.PI, 0); p.lineTo(60, 150); p.closePath(); return p; })(), f: '#3b2a20' },
        { p: many(R, [[11, 118, 20, 22], [69, 118, 20, 22]]), f: GLASS }, { p: R(36, 112, 28, 3), f: 'M2', lw: 0.5 }]; } },
    bank: { name: 'Bank', w: 120, h: 100, col: '#ece4cf', build: () => [
      { p: R(3, 92, 114, 8), f: '#cfc6b0' }, { p: R(9, 86, 102, 6), f: '#dcd3bd' }, { p: R(14, 40, 92, 46), f: 'M' },
      { p: R(52, 58, 16, 28), f: '#4a3424' },
      { p: many(R, [[20, 44, 9, 42], [37, 44, 9, 42], [74, 44, 9, 42], [91, 44, 9, 42]]), f: '#f8f4e8' },
      { p: LN([[24.5, 48], [24.5, 82]], [[41.5, 48], [41.5, 82]], [[78.5, 48], [78.5, 82]], [[95.5, 48], [95.5, 82]]), f: null, lw: 0.4 },
      { p: R(9, 33, 102, 8), f: 'M2' }, { text: 'BANK', x: 60, y: 37.4, sz: 7, f: INK },
      { p: PG([[6, 33], [60, 7], [114, 33]]), f: 'M' }, { p: CI(60, 23, 6.5), f: GOLD }, { text: '£', x: 60, y: 23.4, sz: 9, f: INK }] },
    tower: { name: 'Office tower', w: 72, h: 190, col: '#7fa8c9', build: () => {
      const win = []; for (let r = 0; r < 11; r++) for (let c = 0; c < 3; c++) win.push([11 + c * 13, 32 + r * 13, 9, 8]);
      return [{ p: LN([[30, 0], [30, 16]]), f: null, lw: 1 }, { p: CI(30, 1, 1.8), f: '#e3302c' },
        { p: PG([[50, 20], [68, 28], [68, 190], [50, 190]]), f: 'M2' }, { p: R(6, 20, 44, 170), f: 'M' }, { p: R(3, 15, 50, 7), f: '#56606e' },
        { p: many(R, win), f: '#dff1fb', lw: 0.45 }, { p: many(R, [[54, 36, 3, 140], [61, 39, 3, 137]]), f: '#a8c4d8', k: false }, { p: R(20, 175, 16, 15), f: '#2c3540' }]; } },
    shop: { name: 'Shop', w: 100, h: 80, col: '#2bb3b1', build: shop('SHOP', null, true) },
    pub: { name: 'Pub', w: 100, h: 80, col: '#1f5a3a', build: shop('THE PUB', null, false) },
    factory: { name: 'Factory', w: 140, h: 100, col: '#8a8f99', emit: [[20, 0], [42, 10]], build: () => [
      { p: R(14, 2, 12, 50), f: '#9b4532' }, { p: R(12, 0, 16, 5), f: '#7d3426' }, { p: R(36, 12, 12, 40), f: '#9b4532' }, { p: R(34, 10, 16, 5), f: '#7d3426' },
      { p: R(4, 46, 132, 54), f: 'M' }, { p: PG([[4, 46], [4, 30], [48, 46], [48, 30], [92, 46], [92, 30], [136, 46]]), f: 'M2' },
      { p: many(R, [[12, 62, 18, 14], [40, 62, 18, 14], [68, 62, 18, 14]]), f: GOLD }, { p: R(104, 70, 22, 30), f: '#4a4f57' }, { p: LN([[115, 70], [115, 100]]), f: null, lw: 0.5 }] },
    car: { name: 'Car', w: 120, h: 53, col: '#e3302c', vehicle: true, emit: [[104, 21]], build: car() },
    police: { name: 'Police car', w: 120, h: 53, col: '#f4f4f0', vehicle: true, emit: [[104, 21]], build: car({ police: true }) },
    bus: { name: 'Bus', w: 150, h: 100, col: '#e3302c', vehicle: true, build: () => {
      const up = [], lo = []; for (let i = 0; i < 6; i++) up.push([10 + i * 22, 12, 18, 18]); for (let i = 0; i < 5; i++) lo.push([10 + i * 22, 47, 18, 18]);
      return [{ p: RR(4, 4, 142, 84, 9), f: 'M' }, { p: many(R, up), f: GLASS }, { p: many(R, lo), f: GLASS }, { p: R(122, 47, 20, 26), f: GLASS2 }, { p: R(4, 37, 142, 5), f: '#f4eedf', lw: 0.6 },
        { p: R(118, 8, 24, 0.1), f: null, k: false }, { p: R(4, 80, 142, 4), f: 'M2', lw: 0.6 }, { p: CI(141, 78, 2.6), f: GOLD }, wheel(34, 88, 11.5), wheel(116, 88, 11.5)]; } },
    van: { name: 'Van', w: 124, h: 66, col: '#f4f4f0', vehicle: true, emit: [[112, 36]], build: () => [
      { p: RR(3, 6, 82, 48, 5), f: 'M' }, { p: PG([[85, 18], [104, 18], [121, 36], [121, 54], [85, 54]]), f: 'M' }, { p: PG([[89, 22], [102, 22], [114, 35], [89, 35]]), f: GLASS },
      { p: R(8, 30, 72, 6), f: '#e3302c', lw: 0.6 }, { p: CI(118, 45, 2.6), f: GOLD }, { p: R(3, 40, 4, 6), f: '#e3302c' }, wheel(26, 55, 10.5), wheel(100, 55, 10.5)] },
    plane: { name: 'Plane', w: 220, h: 80, col: '#1d5bbd', vehicle: true, build: () => {
      const body = P2(); body.moveTo(18, 34); body.lineTo(176, 34); body.bezierCurveTo(198, 34, 214, 40, 218, 48); body.bezierCurveTo(212, 56, 196, 60, 176, 60); body.lineTo(36, 60); body.quadraticCurveTo(16, 58, 8, 40); body.quadraticCurveTo(10, 34, 18, 34); body.closePath();
      const w = []; for (let x = 50; x <= 168; x += 9) w.push([x, 42.5, 2.3]);
      return [{ p: PG([[120, 46], [150, 46], [132, 26], [118, 26]]), f: '#b9c2cc' }, { p: PG([[12, 6], [32, 6], [56, 36], [22, 36]]), f: 'M' },
        { p: body, f: '#f7f7f2' }, { p: R(36, 49, 160, 3.2), f: 'M', k: false }, { p: many((x, y, r) => CI(x, y, r), w), f: '#2c3e5a', k: false },
        { p: PG([[188, 39], [201, 40], [207, 45], [190, 44]]), f: '#2c3e5a', lw: 0.6 }, { p: PG([[14, 42], [40, 42], [32, 49], [10, 47]]), f: '#d8dde3' },
        { p: PG([[92, 52], [138, 52], [104, 78], [86, 78]]), f: '#d8dde3' }, { p: RR(104, 60, 28, 11, 5.5), f: '#c9ced6' }, { p: R(127, 61, 3, 9), f: '#56606e', k: false }]; } },
    heli: { name: 'Helicopter', w: 130, h: 72, col: '#f5821f', vehicle: true, build: () => [
      { p: R(10, 33, 44, 7), f: 'M' }, { p: PG([[8, 22], [16, 22], [18, 38], [10, 38]]), f: 'M2' }, { anim: 'tailrotor', x: 10, y: 30, r: 9 },
      { p: EL(76, 42, 32, 21), f: 'M' }, { p: PG([[82, 28], [100, 30], [106, 44], [84, 44]]), f: GLASS }, { p: R(72, 14, 6, 8), f: '#56606e' },
      { p: LN([[58, 63], [62, 70], [100, 70], [104, 63]], [[50, 70], [112, 70]]), f: null, lw: 1.1 }, { anim: 'rotor', x: 75, y: 14, r: 62 }] },
    boat: { name: 'Boat', w: 140, h: 76, col: '#e3302c', build: () => [
      { p: R(96, 6, 14, 32), f: 'M' }, { p: R(96, 12, 14, 5), f: '#f4eedf', lw: 0.6 }, { p: R(38, 22, 54, 20), f: '#f4eedf' }, { p: many(R, [[45, 27, 10, 8], [61, 27, 10, 8], [77, 27, 10, 8]]), f: GLASS, lw: 0.6 },
      { p: PG([[2, 40], [138, 40], [122, 70], [18, 70]]), f: 'M' }, { p: PG([[5, 44], [135, 44], [133, 49], [7, 49]]), f: '#f4eedf', lw: 0.6 },
      { p: (() => { const p = P2(); p.moveTo(0, 72); for (let x = 0; x <= 140; x += 14) p.quadraticCurveTo(x + 7, 66, x + 14, 72); p.lineTo(140, 76); p.lineTo(0, 76); p.closePath(); return p; })(), f: '#2bb3b1' }] },
    ferry: { name: 'Ferry', w: 180, h: 82, col: '#1b1d22', build: () => [
      { p: R(118, 6, 16, 26), f: '#e3302c' }, { p: R(118, 6, 16, 6), f: '#1b1d22' }, { p: CI(126, 22, 4.2), f: GOLD, lw: 0.6 },
      { p: PG([[30, 30], [150, 30], [156, 50], [24, 50]]), f: '#f4f4f0' }, { p: R(46, 18, 84, 14), f: '#f4f4f0' },
      { p: many(R, [[52, 22, 8, 6], [64, 22, 8, 6], [76, 22, 8, 6], [88, 22, 8, 6], [100, 22, 8, 6]]), f: '#2c3e5a', k: false },
      { p: many(R, [[36, 37, 10, 7], [52, 37, 10, 7], [68, 37, 10, 7], [84, 37, 10, 7], [100, 37, 10, 7], [116, 37, 10, 7], [132, 37, 10, 7]]), f: '#2c3e5a', k: false },
      { p: PG([[4, 48], [176, 48], [164, 74], [16, 74]]), f: 'M' }, { p: R(12, 64, 158, 3), f: '#e3302c', k: false },
      { p: (() => { const p = P2(); p.moveTo(0, 76); for (let x = 0; x <= 180; x += 15) p.quadraticCurveTo(x + 7.5, 70, x + 15, 76); p.lineTo(180, 82); p.lineTo(0, 82); p.closePath(); return p; })(), f: '#2bb3b1' }] },
    cruise: { name: 'Cruise ship', w: 220, h: 92, col: '#f7f7f2', build: () => {
      const rows = []; [26, 38, 50].forEach(y => { for (let x = 40; x <= 176; x += 10) rows.push([x, y, 6, 5]); });
      return [{ p: R(150, 2, 20, 22), f: '#1d5bbd' }, { p: R(150, 2, 20, 6), f: '#1b1d22' },
        { p: PG([[40, 20], [180, 20], [186, 34], [34, 34]]), f: 'M' }, { p: PG([[30, 32], [192, 32], [198, 46], [24, 46]]), f: 'M' }, { p: PG([[20, 44], [204, 44], [210, 58], [14, 58]]), f: 'M' },
        { p: many(R, rows), f: '#2c3e5a', k: false }, { p: PG([[4, 56], [216, 56], [202, 84], [18, 84]]), f: 'M' }, { p: R(10, 64, 198, 4), f: '#1d5bbd', k: false },
        { p: (() => { const p = P2(); p.moveTo(0, 86); for (let x = 0; x <= 220; x += 20) p.quadraticCurveTo(x + 10, 80, x + 20, 86); p.lineTo(220, 92); p.lineTo(0, 92); p.closePath(); return p; })(), f: '#2bb3b1' }]; } },
    cargo: { name: 'Cargo ship', w: 220, h: 86, col: '#8c2f27', build: () => {
      const C2 = ['#f5821f', '#1d5bbd', '#3fae49', '#e3302c', '#f7c531', '#8a5cc2'], box = []; let k = 0;
      for (let row = 0; row < 3; row++) for (let x = 34; x <= 150; x += 20) { if (row === 2 && (x < 54 || x > 130)) continue; box.push({ p: R(x, 42 - row * 12, 18, 11), f: C2[(k++ * 7 + row) % C2.length], lw: 0.6 }); }
      return [{ p: R(176, 8, 12, 20), f: '#1b1d22' }, { p: R(166, 18, 34, 32), f: '#f4f4f0' }, { p: many(R, [[170, 24, 7, 6], [181, 24, 7, 6], [192, 24, 6, 6]]), f: '#2c3e5a', k: false }, ...box,
        { p: PG([[4, 52], [216, 52], [204, 78], [18, 78]]), f: 'M' }, { p: R(10, 70, 198, 3), f: '#f4f4f0', k: false },
        { p: (() => { const p = P2(); p.moveTo(0, 80); for (let x = 0; x <= 220; x += 20) p.quadraticCurveTo(x + 10, 74, x + 20, 80); p.lineTo(220, 86); p.lineTo(0, 86); p.closePath(); return p; })(), f: '#2bb3b1' }]; } },
    tree: { name: 'Tree', w: 80, h: 112, col: '#3fae49', build: () => [
      { p: PG([[33, 112], [37, 58], [45, 58], [49, 112]]), f: '#7a4a2a' }, { p: BL([[40, 30, 24], [20, 50, 18], [60, 50, 18], [28, 22, 14], [54, 24, 15], [40, 58, 16]]), f: 'M', u: true },
      { p: BL([[30, 30, 5], [52, 44, 4], [44, 22, 3.5]]), f: 'ML', k: false }] },
    money: { name: 'Money bag', w: 72, h: 84, col: '#c9a36b', build: () => {
      const p = P2(); p.moveTo(26, 22); p.bezierCurveTo(4, 36, 2, 82, 36, 82); p.bezierCurveTo(70, 82, 68, 36, 46, 22); p.closePath();
      const top = P2(); top.moveTo(26, 22); top.lineTo(18, 4); top.quadraticCurveTo(36, 12, 54, 4); top.lineTo(46, 22); top.closePath();
      return [{ p: top, f: 'M' }, { p, f: 'M' }, { p: RR(23, 18, 26, 6, 3), f: '#7a4a2a' }, { text: '£', x: 36, y: 55, sz: 30, f: '#2f6b3a' }]; } },
    bomb: { name: 'Bomb', w: 72, h: 84, col: '#22262e', build: () => [
      { p: LN([[34, 18], [36, 9], [44, 4], [52, 6]]), f: null, lw: 1.3, c: '#a8844a' }, { p: R(25, 16, 16, 10), f: '#4a4f57' }, { p: CI(33, 54, 28), f: 'M' },
      { p: EL(22, 42, 7, 4.5), f: '#5a606b', k: false }, { anim: 'spark', x: 52, y: 6 }] },
    bin: { name: 'Wheelie bin', w: 56, h: 80, col: '#2f6b3a', build: () => [
      { p: PG([[6, 12], [50, 12], [46, 74], [10, 74]]), f: 'M' }, { p: RR(2, 6, 52, 8, 2), f: 'M2' }, { p: R(44, 2, 8, 5), f: 'M2', lw: 0.6 },
      { p: LN([[20, 20], [19, 66]], [[36, 20], [37, 66]]), f: null, lw: 0.5 }, wheel(14, 74, 6)] },
    cloud: { name: 'Cloud', w: 130, h: 64, col: '#ffffff', build: () => [{ p: BL([[30, 40, 20], [56, 28, 24], [86, 30, 20], [106, 42, 16], [70, 46, 18], [44, 48, 14]]), f: 'M', u: true }] },
  };
  const VEH = k => !!(PROPS[k] && PROPS[k].vehicle);
  const partsCache = {};
  const partsOf = k => partsCache[k] || (partsCache[k] = (PROPS[k] || PROPS.house).build());
  // The top edge of a prop's outline at each x, so flames sit on the roof rather than floating above it
  const profCache = {};
  function propProfile(k) {
    if (profCache[k]) return profCache[k]; const d = PROPS[k] || PROPS.house, parts = partsOf(k), g = measurer(), N = 40, cols = [];
    const fills = parts.filter(pt => pt.p && pt.f && pt.f !== '#2bb3b1');
    for (let i = 0; i <= N; i++) { const x = d.w * (0.04 + 0.92 * i / N); let top = null; for (let y = -4; y <= d.h; y += 1.5) { if (fills.some(pt => g.isPointInPath(pt.p, x, y))) { top = y; break; } } cols.push([x, top]); }
    const wins = []; parts.forEach(pt => { if (pt.p && (pt.f === GLASS || pt.f === GLASS2 || pt.f === GOLD) && pt.p.rects) pt.p.rects.forEach(r => { if (r[2] >= 8 && r[3] >= 6) wins.push(r); }); });
    return (profCache[k] = { cols, wins });
  }
  function drawProp(ctx, L, t, I) {
    const def = PROPS[L.kind] || PROPS.house, parts = partsOf(L.kind in PROPS ? L.kind : 'house'), U = 3 * I.u, chalkSt = L.style === 'chalk';
    const main = L.colour || (chalkSt ? '#f2efe6' : def.col), tint = I.tint;
    const glow = I.glow || 0, res = c => { let v = c === 'M' ? main : c === 'M2' ? mix(main, '#000000', 0.28) : c === 'ML' ? mix(main, '#ffffff', 0.4) : c; if (glow && (c === GLASS || c === GLASS2 || c === GOLD)) return mix(v, '#ffab2e', glow); if (tint && v) v = mix(v, tint.c, tint.k); return v; };
    ctx.save(); if (I.flip) ctx.scale(-1, 1); ctx.translate(0, I.bob || 0); ctx.scale(U, U); ctx.translate(-def.w / 2, -def.h / 2);
    const lw = 2.35, ang = I.wheel || 0;
    if (chalkSt) {
      const pat = chalkPat(ctx, tint ? mix(main, tint.c, tint.k) : main); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = pat;
      parts.forEach(pt => {
        if (pt.p) { if (pt.f) { ctx.save(); ctx.globalAlpha *= 0.12; ctx.fillStyle = main; ctx.fill(pt.p); ctx.restore(); } ctx.lineWidth = 1.7 * (pt.lw ? Math.max(0.6, pt.lw) : 1); if (pt.u && pt.p.cs) ctx.stroke(pt.p.ol || (pt.p.ol = blobOutline(pt.p.cs))); else if (pt.k !== false || !pt.f) ctx.stroke(pt.p); }
        else if (pt.text) { ctx.font = `${pt.sz}px Kalam, cursive`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = pat; ctx.fillText(pt.text, pt.x, pt.y); }
        else if (pt.wheel) { const [x, y, r] = pt.wheel; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = ang + i * TAU / 3; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); } ctx.stroke(); }
        else if (pt.anim) animPart(ctx, pt, t, res, true);
      });
      ctx.restore(); return;
    }
    // Comic: hard drop shadow, flat fills, thick ink outlines
    ctx.save(); ctx.translate(2.2, 2.2); ctx.fillStyle = SHADOW; parts.forEach(pt => { if (pt.p && pt.f) ctx.fill(pt.p); else if (pt.wheel) { ctx.beginPath(); ctx.arc(pt.wheel[0], pt.wheel[1], pt.wheel[2], 0, TAU); ctx.fill(); } }); ctx.restore();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    parts.forEach(pt => {
      if (pt.p) {
        if (pt.u) { ctx.lineWidth = lw * 2; ctx.stroke(pt.p); ctx.fillStyle = res(pt.f); ctx.fill(pt.p); return; }
        if (pt.f) { ctx.fillStyle = res(pt.f); ctx.fill(pt.p); }
        if (pt.k !== false) { ctx.lineWidth = lw * (pt.lw || 1); if (pt.c) { ctx.save(); ctx.lineWidth = lw * (pt.lw || 1) + lw * 0.9; ctx.stroke(pt.p); ctx.strokeStyle = res(pt.c); ctx.lineWidth = lw * (pt.lw || 1); ctx.stroke(pt.p); ctx.restore(); } else ctx.stroke(pt.p); }
      } else if (pt.text) { ctx.font = `${pt.sz}px Anton, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = res(pt.f); ctx.fillText(pt.text, pt.x, pt.y); }
      else if (pt.wheel) { const [x, y, r] = pt.wheel; ctx.fillStyle = res(TYRE); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.lineWidth = lw; ctx.stroke(); ctx.fillStyle = res(HUB); ctx.beginPath(); ctx.arc(x, y, r * 0.52, 0, TAU); ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.stroke();
        ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = ang + i * Math.PI / 2; ctx.moveTo(x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16); ctx.lineTo(x + Math.cos(a) * r * 0.46, y + Math.sin(a) * r * 0.46); } ctx.lineWidth = lw * 0.55; ctx.stroke(); }
      else if (pt.anim) animPart(ctx, pt, t, res, false);
    });
    ctx.restore();
  }
  function animPart(ctx, pt, t, res, chalkSt) {
    const lw = 2.35;
    if (pt.anim === 'rotor') { const a = t * 34, half = pt.r; ctx.save(); ctx.globalAlpha *= 0.22; ctx.fillStyle = chalkSt ? '#f2efe6' : '#9aa3ad'; ctx.beginPath(); ctx.ellipse(pt.x, pt.y, half, 3, 0, 0, TAU); ctx.fill(); ctx.restore(); ctx.lineWidth = lw * 1.25; ctx.strokeStyle = chalkSt ? ctx.strokeStyle : INK; [0, Math.PI].forEach(o => { const e = Math.cos(a + o) * half; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x + e, pt.y + Math.sin(a + o) * 1.6); ctx.stroke(); }); }
    else if (pt.anim === 'tailrotor') { const a = t * 40; ctx.lineWidth = lw * 0.9; ctx.beginPath(); for (let i = 0; i < 2; i++) { const b = a + i * Math.PI; ctx.moveTo(pt.x - Math.cos(b) * pt.r, pt.y - Math.sin(b) * pt.r); ctx.lineTo(pt.x + Math.cos(b) * pt.r, pt.y + Math.sin(b) * pt.r); } ctx.stroke(); }
    else if (pt.anim === 'siren') { const on = 0.5 + 0.5 * Math.sin(t * 13); [['#1d5bbd', on, pt.x + pt.w * 0.25], ['#e3302c', 1 - on, pt.x + pt.w * 0.75]].forEach(([c, a, x]) => { ctx.save(); ctx.globalAlpha *= 0.25 + 0.75 * a; ctx.fillStyle = res(c); ctx.fillRect(x - pt.w * 0.25, pt.y, pt.w * 0.5, pt.h); if (!chalkSt) { const g = ctx.createRadialGradient(x, pt.y + 2, 0, x, pt.y + 2, 14); g.addColorStop(0, rgba(c, 0.55 * a)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - 14, pt.y - 12, 28, 28); } ctx.restore(); }); }
    else if (pt.anim === 'spark') { const s = 1 + 0.35 * sn(t * 22), n = 8; ctx.save(); ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n + t * 3, r = (i % 2 ? 2.2 : 6.5) * s * (0.85 + 0.3 * sn(t * 17 + i)); ctx.lineTo(pt.x + Math.cos(a) * r, pt.y + Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = '#e3302c'; ctx.stroke(); ctx.restore(); }
  }
  const PROP = {
    name: 'Prop', colour: '#5a7a2f',
    box(L, u) { const d = PROPS[L.kind] || PROPS.house, U = 3 * u; return [-d.w / 2 * U, -d.h / 2 * U, d.w / 2 * U, d.h / 2 * U]; },
    draw: drawProp,
  };
  // Camera and effect layers don't draw anything themselves: they move or treat the whole picture while their bar is live
  const CAMERA = { name: 'Camera', colour: '#3f6fb5', box: () => [-1, -1, 1, 1], draw() { } };
  const EFFECT = { name: 'Effect', colour: '#8a4fb5', box: () => [-1, -1, 1, 1], draw() { } };
  const TYPES = { text: TEXT, shape: SHAPE, stamp: STAMP, image: IMAGE, prop: PROP, camera: CAMERA, effect: EFFECT };
  const isMeta = L => L && (L.type === 'camera' || L.type === 'effect');
  const EFFECTS = [['shake', 'Camera shake'], ['punch', 'Punch in'], ['flash', 'Flash'], ['zoomblur', 'Zoom blur'], ['vignette', 'Vignette'], ['grain', 'Film grain'], ['glow', 'Glow'], ['tint', 'Colour tint'], ['mono', 'Black and white']];
  // How strongly a camera or effect bar is on: eases in over inD and out over outD
  function envOf(L, t) { const st = num(L.start, 0), en = num(L.end, st + 3), len = Math.max(0.05, en - st); let di = num(L.inD, 0.4), dout = num(L.outD, 0.4); if (di + dout > len) { const k = len / (di + dout); di *= k; dout *= k; }
    if (t < st || t > en) return 0; return Math.min(di > 0 ? ease.sine((t - st) / di) : 1, dout > 0 ? ease.sine((en - t) / dout) : 1); }
  // The picture transform from camera, shake and punch bars at time t: x' = W/2 + z * R(x - focus) + shake
  function camOf(list, t, W, H) {
    const u = Math.min(W, H) / 1080; let z = 1, fx = W / 2, fy = H / 2, rot = 0, sx = 0, sy = 0, any = false;
    (list || []).forEach(L => { if (L.hidden || !isMeta(L)) return; const e = envOf(L, t); if (e <= 0) return; const pw = POW[L.fxPow] || 1, seed = hash(L.id) % 17;
      if (L.type === 'camera') { const v = sample(L, t); z *= Math.exp(Math.log(Math.max(0.05, v.s)) * e); fx = lerp(fx, v.x * W, e); fy = lerp(fy, v.y * H, e); rot += v.rot * e; const sk = { light: 4, medium: 9, heavy: 18 }[L.shake] || 0; if (sk) { sx += shn(t * 23, seed) * sk * u * e; sy += shn(t * 19, seed + 3) * sk * u * e; } any = true; }
      else if (L.effect === 'shake') { const a = 14 * u * pw * e; sx += shn(t * 38, seed) * a; sy += shn(t * 33, seed + 5) * a; any = true; }
      else if (L.effect === 'punch') { z *= 1 + 0.16 * pw * e; any = true; } });
    if (!any) return null;
    return { z, fx, fy, rot, sx, sy, apply(ctx) { ctx.translate(W / 2 + this.sx, H / 2 + this.sy); ctx.rotate(this.rot * D2R); ctx.scale(this.z, this.z); ctx.translate(-this.fx, -this.fy); },
      map(x, y) { const c = Math.cos(this.rot * D2R), s2 = Math.sin(this.rot * D2R), dx = (x - this.fx) * this.z, dy = (y - this.fy) * this.z; return [W / 2 + this.sx + dx * c - dy * s2, H / 2 + this.sy + dx * s2 + dy * c]; } };
  }
  // Grain: one noise tile made once, shifted every frame (a pure function of time, so exports match the preview)
  let grainTile = null;
  function grainCanvas() { if (grainTile) return grainTile; const n = 256, c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(n, n) : mkCanvas(n, n), g = c.getContext('2d'), im = g.createImageData(n, n), r = rng(99); for (let i = 0; i < n * n; i++) { const v = 128 + (r() - 0.5) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); return grainTile = c; }
  const scratches = {}; function scratchCanvas(w, h) { const k = w + 'x' + h; let c = scratches[k]; if (!c) { if (Object.keys(scratches).length > 6) Object.keys(scratches).forEach(x => delete scratches[x]); c = scratches[k] = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : mkCanvas(w, h); } return c; }
  let vig = null; function vignetteCanvas(W, H) { if (vig && vig.W === W && vig.H === H) return vig.c; const w = 480, h = Math.max(2, Math.round(480 * H / W)), c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : mkCanvas(w, h), g = c.getContext('2d'), gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); vig = { W, H, c }; return c; }
  // Effects that treat the finished picture: drawn after everything else, inside the clip's frame
  function postFx(ctx, list, t, W, H) {
    const live = (list || []).filter(L => !L.hidden && L.type === 'effect' && !['shake', 'punch'].includes(L.effect) && envOf(L, t) > 0); if (!live.length) return;
    const u = Math.min(W, H) / 1080, m = ctx.getTransform();
    live.forEach(L => { const e = envOf(L, t), pw = POW[L.fxPow] || 1, col = L.colour || '#ffffff'; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      try {
        if (L.effect === 'flash') { const age = t - num(L.start, 0), a = Math.max(0, 1 - age / 0.45) * 0.9 * Math.min(1, pw); ctx.globalAlpha = a; ctx.fillStyle = L.colour || '#ffffff'; ctx.fillRect(0, 0, W, H); }
        else if (L.effect === 'vignette') { ctx.globalAlpha = cl(0.62 * pw * e, 0, 0.95); ctx.drawImage(vignetteCanvas(W, H), 0, 0, W, H); }
        else if (L.effect === 'tint') { ctx.globalAlpha = cl(0.32 * pw * e, 0, 0.8); ctx.globalCompositeOperation = 'color'; ctx.fillStyle = L.colour || '#f5821f'; ctx.fillRect(0, 0, W, H); }
        else if (L.effect === 'mono') { ctx.globalAlpha = cl(e, 0, 1); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); }
        else if (L.effect === 'grain') { const g = grainCanvas(), f = Math.floor(t * 24), r = rng(f + 7), ox = -r() * 256, oy = -r() * 256, sc = 1.6 * u; ctx.globalAlpha = cl(0.22 * pw * e, 0, 0.6); ctx.globalCompositeOperation = 'overlay'; ctx.translate(ox * sc, oy * sc); ctx.scale(sc, sc); ctx.fillStyle = ctx.createPattern(g, 'repeat'); ctx.fillRect(0, 0, W / sc + 256, H / sc + 256); }
        else if (L.effect === 'glow' || L.effect === 'zoomblur') {
          // Copies of the finished frame drawn back over itself, in canvas pixels
          const cx = m.a * W / 2 + m.c * H / 2 + m.e, cy = m.b * W / 2 + m.d * H / 2 + m.f, src = ctx.canvas; ctx.setTransform(1, 0, 0, 1, 0, 0);
          // Work from a quarter size copy: blurred or smeared, nobody can tell, and it's many times cheaper
          const q = 4, sw = Math.max(2, Math.round(src.width / q)), sh = Math.max(2, Math.round(src.height / q)), sm = scratchCanvas(sw, sh), sg = sm.getContext('2d');
          sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'copy'; sg.filter = L.effect === 'glow' ? `blur(${Math.max(1, 14 * u * Math.hypot(m.a, m.b) / q)}px)` : 'none'; sg.drawImage(src, 0, 0, sw, sh); sg.filter = 'none'; sg.globalCompositeOperation = 'source-over';
          if (L.effect === 'glow') { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = cl(0.32 * pw * e, 0, 0.6); ctx.drawImage(sm, 0, 0, src.width, src.height); }
          else { const n = 4; for (let i = 1; i <= n; i++) { const k = 1 + 0.022 * i * pw * e; ctx.globalAlpha = 0.24 * e * (1 - i / (n + 1)); ctx.setTransform(k, 0, 0, k, cx * (1 - k), cy * (1 - k)); ctx.drawImage(sm, 0, 0, src.width, src.height); } }
        }
      } catch (er) { } ctx.restore(); });
  }

  /* ---------- Effects ---------- */
  const FX = [['none', 'None'], ['fire', 'On fire'], ['explode', 'Explode'], ['collapse', 'Collapse'], ['smoke', 'Smoking'], ['shake', 'Shake'], ['bounce', 'Bounce'], ['cash', 'Raining cash'], ['sparkle', 'Sparkle']];
  const POW = { small: 0.7, medium: 1, big: 1.4 };
  // Particles born at a steady rate from time 0, so nothing ever pops into the middle of the air
  function emit(fd, every, life, seed, fn) { if (fd < 0) return; const j0 = Math.max(0, Math.floor((fd - life) / every) + 1), j1 = Math.floor(fd / every); for (let j = j0; j <= j1; j++) { const age = fd - j * every; if (age >= 0 && age < life) fn(age / life, age, rng(seed + j * 7919)); } }
  function puffPath(cx, cy, r, rr) { const p = P2(); [[0, 0, 1], [-0.62, 0.22, 0.68], [0.64, 0.18, 0.72], [0.08, -0.5, 0.66], [-0.3, -0.36, 0.5]].forEach(([dx, dy, s], i) => { const q = s * r * (0.9 + 0.2 * (i % 2 ? rr : 1 - rr)); p.moveTo(cx + dx * r + q, cy + dy * r); p.arc(cx + dx * r, cy + dy * r, q, 0, TAU); }); return p; }
  function drawPuff(ctx, cx, cy, r, col, u, rr, alpha = 1) { if (r <= 0.5) return; const p = puffPath(cx, cy, r, rr); ctx.save(); ctx.globalAlpha *= alpha; ctx.lineJoin = 'round'; ctx.lineWidth = Math.min(r * 0.3, 7 * u); ctx.strokeStyle = INK; ctx.stroke(p); ctx.fillStyle = col; ctx.fill(p); ctx.restore(); }
  function flamePath(p, bx, by, w, h, sx) { if (h <= 0.5 || w <= 0.5) return; p.moveTo(bx - w / 2, by); p.bezierCurveTo(bx - w / 2, by - h * 0.45, bx + sx * 0.5 - w * 0.18, by - h * 0.7, bx + sx, by - h); p.bezierCurveTo(bx + sx * 0.5 + w * 0.18, by - h * 0.7, bx + w / 2, by - h * 0.45, bx + w / 2, by); p.quadraticCurveTo(bx, by + w * 0.4, bx - w / 2, by); p.closePath(); }
  function fireTongues(box, fd, t, u, pw, seed, L, flip) {
    const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, g = ease.out3(cl(fd / 0.9, 0, 1)), r = rng(seed), out = [], n = Math.max(4, Math.min(8, Math.round(w / (h * 0.28 + 1e-6) * 1.4)));
    const Hf = Math.max(w, h * 0.7) * 0.34 * pw * g, prof = L && L.type === 'prop' ? propProfile(L.kind in PROPS ? L.kind : 'house') : null, d = prof ? PROPS[L.kind] || PROPS.house : null, U = d ? w / d.w : 1;
    const topAt = fx => { if (!prof) return y0 + h * 0.12; const px = (flip ? 1 - fx : fx) * d.w; let best = null, bd = 1e9; prof.cols.forEach(([x, y]) => { if (y !== null && Math.abs(x - px) < bd) { bd = Math.abs(x - px); best = y; } }); return best === null ? null : y0 + (best + 3) * U; };
    for (let i = 0; i < n; i++) { const f = n === 1 ? 0.5 : i / (n - 1), fx = lerp(0.12, 0.88, f) + (r() - 0.5) * 0.04, by = topAt(fx); if (by === null) continue; const bx = x0 + w * fx, mid = 1 - Math.abs(f - 0.5) * 1.1, hh = Hf * (0.55 + 0.45 * mid) * (0.78 + 0.22 * sn(t * 5.3, i * 1.7 + seed % 7)), ww = Math.max(w / n * 1.7, hh * 0.42) * (0.4 + 0.6 * g), sx = sn(t * 3.1, i * 2.3) * hh * 0.24; out.push([bx, by, ww, hh, sx, i]); }
    // Flames licking out of the top of the windows
    if (prof && prof.wins.length) { const ws = prof.wins.slice().sort((a, b) => a[1] - b[1]).slice(0, 6), g2 = ease.out3(cl((fd - 0.5) / 1.2, 0, 1)); if (g2 > 0) ws.forEach((wr, i) => { const cx = (wr[0] + wr[2] / 2) / d.w, bx = x0 + w * (flip ? 1 - cx : cx), by = y0 + (wr[1] + wr[3] * 0.35) * U, hh = wr[3] * U * 1.5 * g2 * pw * (0.75 + 0.25 * sn(t * 6.1, i * 2.9)), ww = wr[2] * U * 0.9 * (0.5 + 0.5 * g2); out.push([bx, by, ww, hh, sn(t * 3.7, i * 1.1 + 5) * hh * 0.2, i + 30]); }); }
    return { tongues: out, Hf, g };
  }
  function drawFire(ctx, box, fd, t, u, pw, seed, L, flip) {
    if (fd < 0) return; const { tongues, Hf, g } = fireTongues(box, fd, t, u, pw, seed, L, flip), outer = P2(), midP = P2(), inner = P2();
    tongues.forEach(([bx, by, w, h, sx, i]) => { flamePath(outer, bx, by, w, h, sx); flamePath(midP, bx + sx * 0.08, by, w * 0.66, h * 0.7, sx * 0.7); flamePath(inner, bx + sx * 0.12, by + w * 0.05, w * 0.36, h * 0.42, sx * 0.45);
      // Licks of flame that break off the tip and shrink away as they rise
      const ph = (t * 1.5 + i * 0.37) % 1, s = Math.sin(Math.PI * ph) * g * (i < 20 ? 1 : 0); if (s > 0.05) { const lx = bx + sx * (1 + ph * 0.6), ly = by - h * (0.75 + ph * 0.75); flamePath(outer, lx, ly, w * 0.3 * s, h * 0.3 * s, sx * 0.3); flamePath(midP, lx, ly, w * 0.16 * s, h * 0.16 * s, sx * 0.2); } });
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(4 * u, Hf * 0.05) * 2; ctx.stroke(outer); ctx.fillStyle = '#e3302c'; ctx.fill(outer); ctx.fillStyle = '#f5821f'; ctx.fill(midP); ctx.fillStyle = '#f7c531'; ctx.fill(inner); ctx.restore();
    // Embers
    const [x0, y0, x1] = box; ctx.save(); emit(fd, 0.07, 1.3, seed + 5, (p, age, r) => { const x = lerp(x0, x1, r()) + sn(age * 3, r() * 9) * 30 * u, y = y0 + (box[3] - y0) * 0.2 - age * (160 + r() * 140) * u - Hf * 0.3; ctx.globalAlpha = Math.sin(Math.PI * p) * 0.9 * g; ctx.fillStyle = r() < 0.5 ? '#f7c531' : '#f5821f'; ctx.beginPath(); ctx.arc(x, y, (2.5 + r() * 3.5) * u, 0, TAU); ctx.fill(); }); ctx.restore();
  }
  function drawGlow(ctx, box, fd, u, pw) { if (fd < 0) return; const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = y0 + (y1 - y0) * 0.25, R0 = Math.max(x1 - x0, y1 - y0) * 0.8 * pw, a = 0.32 * ease.out3(cl(fd / 1, 0, 1)); const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0); g.addColorStop(0, `rgba(255,150,40,${a})`); g.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = g; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2); }
  function drawSmoke(ctx, src, fd, t, u, opt) {
    // src: list of [x, y] emitters. opt: { size, rise, dark, every, life, seed, g }. Puffs share one ink outline, like a comic smoke cloud.
    if (fd < 0) return; const g = opt.g ?? ease.out3(cl(fd / 1, 0, 1)), P = [];
    src.forEach(([sx, sy], k) => emit(fd, opt.every || 0.22, opt.life || 2.6, (opt.seed || 1) + k * 101, (p, age, r) => {
      const rr = r(), sz = opt.size * (0.45 + p * 0.9) * (0.8 + r() * 0.4) * Math.min(1, p * 5) * (1 - ease.in3(cl((p - 0.7) / 0.3, 0, 1)) * 0.85) * g;
      const x = sx + sn(age * 1.3, rr * 10) * opt.size * 0.5 + age * (opt.wind ?? 26) * u, y = sy - age * opt.rise;
      if (sz > 0.5) P.push({ path: puffPath(x, y, sz, rr), sz, col: mix(opt.dark || '#4b4f57', '#a9aeb6', p * 0.9), a: (1 - ease.in3(cl((p - 0.6) / 0.4, 0, 1))) * (opt.alpha ?? 0.92), p });
    }));
    smokePass(ctx, P, u);
  }
  function smokePass(ctx, P, u) {
    if (!P.length) return; P.sort((a, b) => b.p - a.p); ctx.save(); const A0 = ctx.globalAlpha; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    P.forEach(q => { ctx.globalAlpha = A0 * q.a; ctx.lineWidth = Math.min(q.sz * 0.3, 7 * u) * 2; ctx.stroke(q.path); });
    P.forEach(q => { ctx.globalAlpha = A0 * q.a; ctx.fillStyle = q.col; ctx.fill(q.path); }); ctx.restore();
  }
  const shardCache = new Map();
  function shards(box, seed) {
    const key = box.map(v => Math.round(v)).join(',') + '|' + seed; let S = shardCache.get(key); if (S) return S;
    const [x0, y0, x1, y1] = box, r = rng(seed), n = 4, m = 4, V = [];
    for (let i = 0; i <= n; i++) { V.push([]); for (let j = 0; j <= m; j++) { const jx = i > 0 && i < n ? (r() - 0.5) * 0.55 : 0, jy = j > 0 && j < m ? (r() - 0.5) * 0.55 : 0; V[i].push([lerp(x0, x1, (i + jx) / n), lerp(y0, y1, (j + jy) / m)]); } }
    S = []; for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = V[i][j], b = V[i + 1][j], c = V[i + 1][j + 1], d = V[i][j + 1], tris = r() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      tris.forEach(tr => { const p = P2(); tr.forEach((q, k) => k ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); S.push({ p, c: [(tr[0][0] + tr[1][0] + tr[2][0]) / 3, (tr[0][1] + tr[1][1] + tr[2][1]) / 3], r: [r(), r(), r(), r()] }); }); }
    if (shardCache.size > 60) shardCache.clear(); shardCache.set(key, S); return S;
  }
  function starPath(cx, cy, R0, n, t, seed, sharp = 0.62) { const p = P2(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n + seed * 0.37 + t * 0.25, rr = R0 * (i % 2 ? sharp * (0.9 + 0.12 * sn(t * 5, i * 1.9 + seed)) : (0.9 + 0.14 * sn(t * 6, i * 1.3 + seed))); i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } p.closePath(); return p; }
  function drawExplosion(ctx, L, box, fd, t, I, content) {
    const u = I.u, pw = POW[L.fxPow] || 1, [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R0 = Math.max(w, h) * 0.62 * pw, seed = hash(L.id);
    if (fd < 0) { const q = 1 + fd / 0.3; const j = q * q * 7 * u; ctx.save(); ctx.translate(shn(t * 46) * j, shn(t * 41, 2) * j); ctx.translate(cx, cy); ctx.scale(1 + 0.07 * q * q, 1 + 0.07 * q * q); ctx.translate(-cx, -cy); I.tint = { c: '#ffffff', k: 0.55 * q * q * (0.5 + 0.5 * Math.sin(t * 30)) }; content(); ctx.restore(); I.tint = null; return; }
    // Smoke left behind
    const sr = rng(seed + 11), SP = []; for (let i = 0; i < 9; i++) { const a = sr() * TAU, d = sr() * R0 * 0.55, b = 0.12 + i * 0.035, age = fd - b, s1 = sr(), s2 = sr(); if (age < 0) continue; const p = cl(age / 2.6, 0, 1), sz = R0 * (0.26 + s1 * 0.16) * ease.out3(cl(age / 0.8, 0, 1)) * (1 - ease.in3(cl((p - 0.55) / 0.45, 0, 1))); if (sz > 0.5) SP.push({ path: puffPath(cx + Math.cos(a) * d * (1 + age * 0.35), cy + Math.sin(a) * d * 0.6 - age * 55 * u, sz, s2), sz, col: mix('#34373e', '#9a9fa7', p), a: 1 - ease.in3(cl((p - 0.75) / 0.25, 0, 1)), p }); } smokePass(ctx, SP, u);
    // Pieces flying apart
    const S = shards(box, seed), gr = 2600 * u, ox = cx, oy = cy + h * 0.22;
    S.forEach(s => { const a = fd, al = 1 - cl((a - 0.9) / 0.6, 0, 1); if (al <= 0) return; let dx = s.c[0] - ox, dy = s.c[1] - oy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; const sp = (650 + s.r[0] * 1050) * u * pw, vx = dx * sp, vy = dy * sp - (420 + s.r[1] * 520) * u * pw;
      const px = vx * a, py = vy * a + 0.5 * gr * a * a, rot = (s.r[2] - 0.5) * 13 * a; ctx.save(); ctx.globalAlpha *= al; ctx.translate(s.c[0] + px, s.c[1] + py); ctx.rotate(rot); ctx.scale(1 - 0.3 * cl(a / 1.4, 0, 1), 1 - 0.3 * cl(a / 1.4, 0, 1)); ctx.translate(-s.c[0], -s.c[1]); ctx.clip(s.p); I.tint = { c: '#1e140e', k: cl(a * 2.5, 0, 0.6) }; content(); ctx.restore(); });
    I.tint = null;
    // Fireball: comic star shapes that burst out and burn down from the inside
    const grow = ease.out3(cl(fd / 0.26, 0, 1)), LAY = [['#e3302c', 1, 0.62], ['#f5821f', 0.78, 0.45], ['#f7c531', 0.54, 0.3], ['#fffbe8', 0.3, 0.14]];
    if (fd < 1.3) { const fl = cl(1 - fd / 0.12, 0, 1); if (fl > 0) { ctx.save(); ctx.globalAlpha *= fl * 0.9; const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 1.4); gg.addColorStop(0, 'rgba(255,255,240,1)'); gg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = gg; ctx.fillRect(cx - R0 * 1.4, cy - R0 * 1.4, R0 * 2.8, R0 * 2.8); ctx.restore(); }
      LAY.forEach(([c, k, endAt], li) => { const sh = 1 - ease.in3(cl((fd - endAt) / 0.5, 0, 1)), rr = R0 * k * grow * sh; if (rr < 1) return; const p = starPath(cx, cy - fd * 40 * u, rr, 11, t, seed % 13 + li * 2.1, 0.64); ctx.save(); ctx.lineJoin = 'round'; if (li === 0) { ctx.lineWidth = Math.max(5 * u, R0 * 0.035) * 2; ctx.strokeStyle = INK; ctx.stroke(p); } ctx.fillStyle = c; ctx.fill(p); ctx.restore(); });
      E.burst(ctx, cx, cy, R0 * 1.15, cl(fd / 0.7, 0, 1), I.C, u, 16); }
    // Sparks
    ctx.save(); const kr = rng(seed + 3); for (let i = 0; i < 16; i++) { const a = kr() * TAU, sp = (900 + kr() * 900) * u * pw, life = 0.6 + kr() * 0.5; if (fd > life) { kr(); continue; } const x = cx + Math.cos(a) * sp * fd, y = cy + Math.sin(a) * sp * fd + 0.5 * gr * fd * fd * 0.5, sz = (5 + kr() * 6) * u * (1 - fd / life); ctx.globalAlpha = 1 - fd / life; ctx.fillStyle = i % 2 ? '#f7c531' : '#f5821f'; ctx.beginPath(); ctx.arc(x, y, sz, 0, TAU); ctx.fill(); } ctx.restore();
    // BOOM!
    const word = L.fxWord === undefined ? 'BOOM!' : String(L.fxWord); if (word && fd > 0.04 && fd < 1.7) { const e = fd - 0.04, pop = E.spring(e * 1.4, 6, 11), out = 1 - ease.in3(cl((fd - 1.3) / 0.4, 0, 1)), fs = R0 * 0.42; ctx.save(); ctx.translate(cx, cy - R0 * 0.15 + shn(t * 40) * 3 * u * (1 - cl(e * 2, 0, 1))); ctx.rotate(-0.16); ctx.scale(pop * out, pop * out); ctx.font = `${fs}px Anton, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.fillStyle = '#e3302c'; ctx.fillText(word, fs * 0.07, fs * 0.08); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = INK; ctx.strokeText(word, 0, 0); ctx.fillStyle = GOLD; ctx.fillText(word, 0, 0); ctx.restore(); }
  }
  function drawCollapse(ctx, L, box, fd, t, I, content) {
    const u = I.u, [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, seed = hash(L.id), side = seed % 2 ? 1 : -1;
    if (fd < 0) { const q = 1 + fd / 0.45, j = q * 4 * u; ctx.save(); ctx.translate(shn(t * 44) * j, shn(t * 39, 3) * j * 0.4); content(); ctx.restore(); return; }
    const p = cl(fd / 1.6, 0, 1), dy = h * 1.04 * p * p, tilt = side * 5 * D2R * ease.io3(p);
    // Rubble left behind
    const rg = ease.out3(cl((fd - 0.35) / 1.2, 0, 1)); if (rg > 0) { const rr = rng(seed + 9), main = L.colour || (PROPS[L.kind] || PROPS.house).col; ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 4 * u;
      for (let i = 0; i < 14; i++) { const bx = lerp(x0 - w * 0.08, x1 + w * 0.08, rr()), bh = h * 0.22 * rg * (1 - Math.abs(bx - cx) / (w * 0.7)) * (0.5 + rr() * 0.6), bw = w * (0.08 + rr() * 0.1); if (bh <= 1) { rr(); continue; } const p2 = PG([[bx - bw / 2, y1], [bx - bw * 0.35, y1 - bh], [bx + bw * 0.1, y1 - bh * 1.15], [bx + bw / 2, y1 - bh * 0.5], [bx + bw / 2, y1]]); ctx.fillStyle = mix(rr() < 0.5 ? main : '#7a6f60', '#2a1c14', 0.25); ctx.fill(p2); ctx.stroke(p2); } ctx.restore(); }
    if (p < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x0 - w * 2, y0 - h * 3, w * 5, y1 - (y0 - h * 3)); ctx.clip(); ctx.translate(cx, y1); ctx.rotate(tilt); ctx.translate(-cx, -y1 + dy); I.tint = { c: '#c8b89a', k: 0.35 * p }; content(); I.tint = null; ctx.restore(); }
    // Dust rolling out from the base
    const DP = []; for (let k = 0; k < 2; k++) emit(fd, 0.07, 2.4, seed + k * 31, (q, age, r) => { if (age > 2.4 || fd - age > 1.7) return; const dir = r() < 0.5 ? -1 : 1, x = cx + (r() - 0.5) * w * 0.5 + dir * ease.out3(q) * w * (0.2 + r() * 0.55), y = y1 - h * 0.05 - ease.out3(q) * h * (0.15 + r() * 0.35), sz = w * (0.1 + r() * 0.08) * Math.min(1, q * 6) * (1 - ease.in3(cl((q - 0.6) / 0.4, 0, 1))) * (1 + q); if (sz > 0.5) DP.push({ path: puffPath(x, y, sz, r()), sz, col: mix('#cdbf9f', '#e8dfc9', q), a: 1 - ease.in3(cl((q - 0.7) / 0.3, 0, 1)), p: q }); }); smokePass(ctx, DP, u);
  }
  function drawCash(ctx, box, fd, t, u, seed) {
    const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, g = cl(fd / 0.5, 0, 1); if (fd < 0) return;
    emit(fd, 0.11, 2.4, seed, (p, age, r) => { const x = lerp(x0 - w * 0.15, x1 + w * 0.15, r()) + sn(age * 2.2, r() * 9) * 50 * u, y = y0 - h * 0.35 + age * (170 + r() * 80) * u, flip = Math.cos(age * 5 + r() * 6), rot = sn(age * 2, r() * 5) * 0.8, nw = 70 * u, nh = 36 * u;
      ctx.save(); ctx.globalAlpha *= Math.min(1, p * 6) * (1 - ease.in3(cl((p - 0.75) / 0.25, 0, 1))) * g; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, Math.max(0.12, Math.abs(flip))); ctx.fillStyle = flip > 0 ? '#86c46f' : '#6aa857'; ctx.fillRect(-nw / 2, -nh / 2, nw, nh); ctx.lineWidth = 3.5 * u; ctx.strokeStyle = INK; ctx.strokeRect(-nw / 2, -nh / 2, nw, nh); ctx.fillStyle = '#2f6b3a'; ctx.font = `${nh * 0.8}px Anton, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('£', 0, nh * 0.04); ctx.restore(); });
  }
  function drawSparkle(ctx, box, fd, t, u, seed) {
    if (fd < 0) return; const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, r = rng(seed), g = cl(fd / 0.4, 0, 1);
    for (let i = 0; i < 9; i++) { const a = r() * TAU, x = (x0 + x1) / 2 + Math.cos(a) * w * (0.45 + r() * 0.2), y = (y0 + y1) / 2 + Math.sin(a) * h * (0.45 + r() * 0.2), ph = (t * (0.8 + r() * 0.5) + r()) % 1, s = Math.pow(Math.sin(Math.PI * ph), 2) * (16 + r() * 18) * u * g; if (s < 0.5) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ph * 0.8); ctx.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? s * 0.25 : s; ctx.lineTo(Math.cos(k * Math.PI / 4) * rr, Math.sin(k * Math.PI / 4) * rr); } ctx.closePath(); ctx.fillStyle = '#fffbe0'; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
  }
  // Frame wide shake from explosions and collapses, smooth so it reads as a rumble rather than noise
  function screenShake(list, t, W, H) {
    const u = Math.min(W, H) / 1080; let A = 0, sx = 0, sy = 0;
    list.forEach(L => { if (L.fxShake === false || (L.fx !== 'explode' && L.fx !== 'collapse')) return; const st = num(L.start, 0); if (t < st || t > num(L.end, st + 3)) return; const fd = t - st - num(L.fxAt, 1);
      let a = 0; if (L.fx === 'explode') { if (fd >= 0 && fd < 1.3) a = 34 * u * (POW[L.fxPow] || 1) * Math.exp(-fd * 4.2) * (1 - fd / 1.3); else if (fd > -0.3 && fd < 0) a = 4 * u * (1 + fd / 0.3); }
      else if (fd > -0.45 && fd < 1.9) a = 9 * u * (fd < 0 ? 1 + fd / 0.45 : 1 - ease.in3(fd / 1.9));
      if (a > 0) { const s = hash(L.id) % 17; sx += shn(t * 40, s) * a; sy += shn(t * 34, s + 4) * a; A += a; } });
    return A > 0 ? [sx, sy, A] : null;
  }

  /* ---------- Drawing a layer ---------- */
  function motion(L, t, W) {
    const st = num(L.start, 0), en = num(L.end, st + 3), K = keysOf(L); if (!K || K.length < 2) return { dist: 0, vx: 0, dir: 1 };
    const a = sample(L, st).x, x = sample(L, t).x, h = 1 / 60, vx = (sample(L, Math.min(en, t + h)).x - sample(L, Math.max(st, t - h)).x) * W / (2 * h);
    return { dist: (x - a) * W, vx, dir: K[K.length - 1].x < K[0].x ? -1 : 1 };
  }
  /* Keep things in shot whatever the frame shape: anything too big for the frame shrinks to fit, and anything hanging off
     an edge slides back in. Switching between 16:9 and 9:16 then needs no fixing by hand. Things on a moving path, vehicles
     and pieces pinned to the scene are left alone, since they are meant to travel. */
  const FIT = { text: 1, stamp: 1, image: 1, shape: 1, prop: 1 };
  function fitIn(L, v, W, H, u) { const out = { x: v.x * W, y: v.y * H, f: 1 }, T = TYPES[L.type]; if (!FIT[L.type] || !T || !T.box || L.pin || L.free || (L.type === 'prop' && VEH(L.kind))) return out; const K = keysOf(L); if (K && K.length > 1) return out;
    let b; try { b = T.box(L, u); } catch (e) { return out; } if (!b || !b.every(isFinite)) return out; const s = Math.abs(v.s || 1), r = (v.rot || 0) * D2R, c = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r)), bw = (b[2] - b[0]) * s, bh = (b[3] - b[1]) * s;
    let ew = c * bw + sn * bh, eh = sn * bw + c * bh; const f = Math.min(1, W * 0.94 / Math.max(1, ew), H * 0.94 / Math.max(1, eh)); ew *= f; eh *= f; out.f = f;
    const ox = (b[0] + b[2]) / 2 * s * f, oy = (b[1] + b[3]) / 2 * s * f, mx = W * 0.03, my = H * 0.03;
    out.x = cl(out.x + ox, mx + ew / 2, W - mx - ew / 2) - ox; out.y = cl(out.y + oy, my + eh / 2, H - my - eh / 2) - oy; return out; }
  // rest: ignore the in and out animations, so the editor can always grab a layer even while it is popping in
  function transformOf(L, t, W, H, rest) {
    FW = W; const v = sample(L, t), m = rest ? { dx: 0, dy: 0, sc: 1, op: 1, rot: 0, impact: -1 } : anim(L, t, W, H), u = Math.min(W, H) / 1080, fx = L.fx || 'none', fd = t - num(L.start, 0) - num(L.fxAt, 1);
    const F = fitIn(L, v, W, H, u);
    let x = F.x + m.dx, y = F.y + m.dy, s = v.s * F.f * m.sc, sy = m.sy || 1, sx = 1;
    if (fx === 'shake' && fd > 0) { const a = 6 * u * cl(fd / 0.3, 0, 1); x += shn(t * 31, 1) * a; y += shn(t * 27, 4) * a * 0.7; }
    if (fx === 'bounce' && fd > 0) { const g = cl(fd / 0.4, 0, 1), ph = (fd * 2) % 1, hop = 4 * ph * (1 - ph); y -= hop * 42 * u * g * v.s; const sq = Math.max(0, 1 - hop * 5) * 0.12 * g; sy = 1 - sq; sx = 1 + sq * 0.8; }
    if (m.impact >= 0 && m.impact < 0.45) { const a = 9 * u * Math.exp(-m.impact * 9); x += Math.sin(m.impact * 52) * a; y += Math.cos(m.impact * 44) * a * 0.7; }
    return { v, m, x, y, s, rot: v.rot + m.rot, sx, sy, u, fd, fx };
  }
  function drawLayer(ctx, L, t, W, H, C) {
    const T = TYPES[L.type]; if (!T) return; const st = num(L.start, 0), en = Math.min(MAXT, num(L.end, st + 3)); if (t < st - 1e-6 || t > en + 1e-6) return;
    const X = transformOf(L, t, W, H), { m, u, fd, fx } = X, op = cl(X.v.op, 0, 1) * m.op; if (op <= 0.002 || Math.abs(X.s) < 1e-4) return;
    const box = T.box(L, u), mv = L.type === 'prop' && VEH(L.kind) ? motion(L, t, W) : null, def = PROPS[L.kind];
    const face = L.face || 'auto', flip = face === 'left' || (face === 'auto' && mv && mv.dir < 0);
    const I = { u, C, draw: m.draw, chars: L.type === 'text' ? m.chars : 1, letterIn: L.type === 'text' ? m.letterIn : null, jiggle: L.type === 'text' ? m.jiggle : null, flip, tint: null, wheel: 0, bob: 0 };
    if (mv && def) { const wr = 10.5 * 3 * u * X.s; I.wheel = mv.dist / Math.max(1e-3, wr) * (flip ? -1 : 1); I.bob = Math.abs(mv.vx) > 30 * u ? Math.sin(mv.dist / (40 * u * X.s)) * 1.2 * u : 0; }
    if (fx === 'fire' && fd > 0) { I.tint = { c: '#2a1c14', k: 0.5 * ease.out3(cl(fd / 4, 0, 1)) }; I.glow = 0.85 * ease.out3(cl((fd - 0.3) / 1, 0, 1)); }
    const content = () => T.draw(ctx, L, t, I), pw = POW[L.fxPow] || 1, seed = hash(L.id);
    ctx.save(); ctx.globalAlpha *= op; ctx.translate(X.x, X.y); ctx.rotate(X.rot * D2R); ctx.scale(X.s * X.sx, X.s * X.sy);
    if (X.sy !== 1) { /* bounce squash pivots on the base */ ctx.translate(0, box[3] * (1 - X.sy) / X.sy); }
    // Speed lines behind moving vehicles
    if (mv && Math.abs(mv.vx) > 160 * u) { const a = cl((Math.abs(mv.vx) - 160 * u) / (700 * u), 0, 1) * 0.9; ctx.save(); ctx.globalAlpha *= a; E.speedLines(ctx, (flip ? box[2] : box[0]) + (flip ? 10 : -10) * u, (box[1] + box[3]) / 2, flip ? 0 : Math.PI, (box[2] - box[0]) * 0.45, (box[3] - box[1]) * 0.7, 6, t * 2, I.C, u, seed); ctx.restore(); }
    if (fx === 'fire') drawGlow(ctx, box, fd, u, pw);
    const wipeOn = m.wipe < 1 || m.wipeOut > 0 || (m.draw < 1 && L.type !== 'shape');
    if (wipeOn) { const f0 = m.wipeOut, f1 = Math.min(m.wipe, m.draw < 1 && L.type !== 'shape' ? m.draw : 1), bw = box[2] - box[0], pad = Math.max(bw, box[3] - box[1]) * 0.6, xa = f0 > 0 ? box[0] + bw * f0 : box[0] - pad, xb = f1 < 1 ? box[0] + bw * f1 : box[2] + pad; ctx.save(); ctx.beginPath(); ctx.rect(xa, box[1] - pad, Math.max(0, xb - xa), box[3] - box[1] + pad * 2); ctx.clip(); }
    if (fx === 'explode' && fd > -0.3) drawExplosion(ctx, L, box, fd, t, I, content);
    else if (fx === 'collapse' && fd > -0.45) drawCollapse(ctx, L, box, fd, t, I, content);
    else content();
    if (fx === 'smoke' || fx === 'fire') { const src = fx === 'smoke' && L.type === 'prop' && def && def.emit ? def.emit.map(([px, py]) => [(px - def.w / 2) * 3 * u * (flip ? -1 : 1), (py - def.h / 2) * 3 * u]) : [[(box[0] + box[2]) / 2 + (box[2] - box[0]) * (fx === 'fire' ? 0.05 : 0.15), box[1] + (box[3] - box[1]) * (fx === 'fire' ? 0.05 : 0.1)]];
      const sz = Math.max(box[2] - box[0], box[3] - box[1]) * (fx === 'fire' ? 0.2 : 0.11) * pw; drawSmoke(ctx, fx === 'fire' ? src.concat([[box[0] + (box[2] - box[0]) * 0.3, box[1] + (box[3] - box[1]) * 0.1]]) : src, fd, t, u, { size: sz, rise: (fx === 'fire' ? 150 : 95) * u, dark: fx === 'fire' ? '#33363c' : '#6d7178', every: fx === 'fire' ? 0.21 : 0.28, life: fx === 'fire' ? 2.4 : 3, seed: seed + 77 }); }
    if (fx === 'fire') drawFire(ctx, box, fd, t, u, pw, seed, L, flip);
    if (fx === 'cash') drawCash(ctx, box, fd, t, u, seed);
    if (fx === 'sparkle') drawSparkle(ctx, box, fd, t, u, seed);
    if (wipeOn) ctx.restore();
    // Slam: impact lines and dust when it lands
    if (m.impact >= 0 && m.impact < 0.6) { const R0 = Math.max(box[2] - box[0], box[3] - box[1]) * 0.62; E.burst(ctx, 0, 0, R0, m.impact / 0.6, I.C, u, 14, 1, (box[3] - box[1]) / (box[2] - box[0]) * 0.9 + 0.3); }
    ctx.restore();
  }
  function screenBox(L, t, W, H) {
    const T = TYPES[L.type]; if (!T) return null; const X = transformOf(L, t, W, H, true), b = T.box(L, X.u), c = Math.cos(X.rot * D2R), s = Math.sin(X.rot * D2R), k = X.s;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].forEach(([px, py]) => { px *= k * X.sx; py *= k * X.sy; const x = X.x + px * c - py * s, y = X.y + px * s + py * c; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    return { box: [x0, y0, x1, y1], cx: X.x, cy: X.y };
  }
  function drawAll(ctx, cfg, t, look, W, H, view) { const list = cfg && cfg.layers; if (!list || !list.length) return; const C = E.palette(look); list.forEach(L => { if (L.hidden) return; try { ctx.save(); if (L.pin && view) { ctx.translate(W / 2, H / 2); ctx.scale(view.z, view.z); ctx.translate(-view.fx, -view.fy); } drawLayer(ctx, L, t, W, H, C); } catch (e) { console.error(e); } finally { ctx.restore(); } }); }
  const MAXT = 600, layersEnd = cfg => ((cfg && cfg.layers) || []).reduce((a, L) => L.hidden ? a : Math.max(a, Math.min(MAXT, num(L.end, 0))), 0);
  const viewOf = (ie, cfg, look, t, W, H) => { if (!ie.view) return null; try { const v = ie.view(cfg, look, t, W, H); return v && isFinite(v.fx) && isFinite(v.fy) && v.z > 0 ? v : null; } catch (e) { return null; } };

  /* ---------- Speed ramps: remap the clip's own time, keeping its length (layers stay on the timeline's time) ---------- */
  const RAMP_OPTS = [['none', 'None'], ['slowfast', 'Start slow, speed up'], ['fastslow', 'Start fast, slow down'], ['hero', 'Slow in the middle (hero moment)'], ['montage', 'Fast in the middle (montage)']];
  const RAMP = { slowfast: x => Math.pow(x, 1.7), fastslow: x => 1 - Math.pow(1 - x, 1.7), hero: x => x + 0.62 * Math.sin(2 * Math.PI * x) / (2 * Math.PI), montage: x => x - 0.62 * Math.sin(2 * Math.PI * x) / (2 * Math.PI) };
  const rampFn = cfg => cfg && RAMP[cfg.ramp] || null;
  const rampT = (f, t, d) => d > 0 && t > 0 && t < d ? d * f(t / d) : t;
  const rampInv = (f, tm, d) => { if (!(d > 0) || tm <= 0 || tm >= d) return tm; let lo = 0, hi = 1, y = tm / d; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (f(m) < y) lo = m; else hi = m; } return d * (lo + hi) / 2; };

  /* ---------- Wrapping a clip type ---------- */
  const strip = cfg => { if (!cfg || !cfg.layers) return cfg; const c = Object.assign({}, cfg); delete c.layers; return c; };
  const wrapped = {};
  function wrap(mod) {
    if (!mod || mod._layers) return mod; if (wrapped[mod.id]) return wrapped[mod.id];
    const ie = mod.editor || {};
    const out = Object.assign({}, mod, {
      _layers: true, inner: mod,
      duration(cfg, look) { return Math.max(mod.duration(strip(cfg), look), layersEnd(cfg)); },
      draw(ctx, t, cfg, look, W, H) {
        if (!isFinite(t)) t = 0; else if (t < 0) t = 0;
        const all = cfg && cfg.layers, rf = rampFn(cfg); if (!all || !all.length) { if (!rf) return mod.draw(ctx, t, cfg, look, W, H); const d = mod.duration(cfg, look); return mod.draw(ctx, rampT(rf, Math.min(t, d), d), cfg, look, W, H); }
        const list = all.some(isMeta) ? all.filter(L => !isMeta(L)) : all, cam = camOf(all, t, W, H), c2 = strip(cfg), d0 = mod.duration(c2, look), tm = rf ? rampT(rf, Math.min(t, d0), d0) : Math.min(t, d0), sh = screenShake(list, t, W, H), V = list.some(L => L.pin) ? viewOf(ie, c2, look, tm, W, H) : null;
        ctx.save(); if (cam) cam.apply(ctx);
        const back = list.filter(L => L.behind), front = back.length ? list.filter(L => !L.behind) : list;
        ctx.save(); if (sh) { const z = 1 + sh[2] * 2.4 / Math.min(W, H); ctx.translate(W / 2 + sh[0], H / 2 + sh[1]); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); }
        const base = ctx.getTransform(), drawBack = c => { c.save(); c.setTransform(base); drawAll(c, { layers: back }, t, look, W, H, V); c.restore(); };
        E.hookBox.fn = back.length ? drawBack : null;
        try { mod.draw(ctx, tm, c2, look, W, H); } finally { if (E.hookBox.fn) { E.hookBox.fn = null; if (back.length) drawBack(ctx); } }
        ctx.restore();
        if (front.length) { ctx.save(); if (sh) ctx.translate(sh[0] * 0.6, sh[1] * 0.6); drawAll(ctx, { layers: front }, t, look, W, H, V); ctx.restore(); }
        ctx.restore(); if (list !== all) postFx(ctx, all, t, W, H);
      },
      editor: makeEditor(mod, ie),
      // Only trust the clip's own speed when no layer is on screen; layers can move fast (explosions, slams)
      blurHint: mod.blurHint ? (cfg, look, t, fps, W, H) => { const list = (cfg && cfg.layers) || []; if (rampFn(cfg)) return null; if (list.some(L => !L.hidden && t >= num(L.start, 0) - 0.05 && t <= num(L.end, 3) + 0.05)) return null; return mod.blurHint(strip(cfg), look, t, fps, W, H); } : undefined,
    });
    wrapped[mod.id] = out; return out;
  }

  /* ---------- Editing ---------- */
  const isL = id => typeof id === 'string' && id.startsWith('L:');
  const find = (cfg, id) => ((cfg && cfg.layers) || []).find(L => 'L:' + L.id === id);
  const newId = () => 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const labelOf = L => L.type === 'text' ? (String(L.text || 'Text').split('\n')[0] || 'Text') : L.type === 'stamp' ? String(L.text || 'Stamp') : L.type === 'shape' ? (SHAPES.find(s => s[0] === L.shape) || ['', 'Shape'])[1] : L.type === 'prop' ? (PROPS[L.kind] || PROPS.house).name + (L.fx && L.fx !== 'none' ? ', ' + (FX.find(f => f[0] === L.fx) || ['', ''])[1].toLowerCase() : '') : L.type === 'camera' ? 'Camera move' : L.type === 'effect' ? (EFFECTS.find(f => f[0] === L.effect) || ['', 'Effect'])[1] : 'Image';
  function add(cfg, L) { cfg.layers = cfg.layers || []; cfg.layers.push(L); return 'L:' + L.id; }
  // Saved pieces: a group of layers (with their keyframes, effects and pictures) that drops into any clip at the playhead
  function pieceOf(cfg, ids) { const Ls = ((cfg && cfg.layers) || []).filter(L => ids.includes('L:' + L.id)); if (!Ls.length) return null; const t0 = Math.min(...Ls.map(L => num(L.start, 0)));
    return { layers: Ls.map(L => { const c = JSON.parse(JSON.stringify(L)); const len = num(c.end, 3) - num(c.start, 0); c.start = r2(num(c.start, 0) - t0); c.end = r2(c.start + len); delete c.locked; return c; }), assets: Ls.filter(L => L.asset).map(L => L.asset) }; }
  function insertPiece(cfg, piece, t) { if (!piece || !piece.layers) return null; let first = null;
    piece.layers.forEach(L => { const c = JSON.parse(JSON.stringify(L)); c.id = newId(); c.start = r2(num(c.start, 0) + t); c.end = r2(num(c.end, 3) + t); const id = add(cfg, c); if (!first) first = id; });
    Object.entries(piece.assetUrls || {}).forEach(([id, url]) => { setAsset(id, url); hooks.addAsset && hooks.addAsset(id, url); }); return first; }
  const base = (type, t, extra) => Object.assign({ id: newId(), type, start: r2(Math.max(0, t)), end: r2(Math.max(0, t) + 4), x: 0.5, y: 0.5, s: 1, rot: 0, op: 1, anIn: 'pop', inD: 0.5, anOut: 'fade', outD: 0.4, fx: 'none', fxAt: 1 }, extra);
  const mkText = t => base('text', t, { text: 'YOUR TEXT', font: 'display', size: 110, colour: '#ffffff', style: 'outline', caps: true, y: 0.78, anIn: 'pop' });
  const mkStamp = (t, s) => base('stamp', t, { text: s[0], colour: s[1], shape: s[2], size: 130, rot: s[2] === 'burst' ? 0 : -9, anIn: 'slam', inD: 0.45, x: 0.62, y: 0.4 });
  const mkShape = (t, k) => base('shape', t, { shape: k, colour: k === 'spot' ? '#ffffff' : '#e3302c', thick: 14, w: k === 'underline' ? 460 : k === 'tick' || k === 'cross' ? 200 : 380, h: k === 'underline' ? 120 : k === 'tick' || k === 'cross' ? 200 : 240, anIn: k === 'arrow' || k === 'spot' ? (k === 'spot' ? 'fade' : 'slideL') : 'draw', inD: k === 'spot' ? 0.4 : 0.6 });
  const CAM_PRESETS = [['push', 'Slow push in'], ['punch', 'Punch in'], ['pull', 'Pull out'], ['panL', 'Pan left to right'], ['panR', 'Pan right to left'], ['tilt', 'Dutch tilt'], ['rumble', 'Rumble'], ['hold', 'Still (add your own)']];
  function mkCamera(t, k, cfg) {
    const len = k === 'punch' ? 1.6 : k === 'rumble' ? 2 : 4, L = base('camera', t, { anIn: 'none', anOut: 'none', inD: k === 'punch' ? 0.12 : 0.5, outD: k === 'punch' ? 0.3 : 0.5, end: r2(Math.max(0, t) + len) });
    const key = (tt, o) => Object.assign({ t: tt, x: 0.5, y: 0.5, s: 1, rot: 0, op: 1, e: 'smooth' }, o);
    if (k === 'push') L.keys = [key(0, {}), key(len, { s: 1.18 })];
    else if (k === 'punch') { L.s = 1.35; L.keys = undefined; }
    else if (k === 'pull') L.keys = [key(0, { s: 1.25 }), key(len, { s: 1 })];
    else if (k === 'panL') L.keys = [key(0, { x: 0.42, s: 1.2 }), key(len, { x: 0.58, s: 1.2 })];
    else if (k === 'panR') L.keys = [key(0, { x: 0.58, s: 1.2 }), key(len, { x: 0.42, s: 1.2 })];
    else if (k === 'tilt') { L.rot = -6; L.s = 1.12; }
    else if (k === 'rumble') { L.shake = 'medium'; }
    if (!L.keys) delete L.keys; return L;
  }
  const mkEffect = (t, k) => base('effect', t, { effect: k, fxPow: 'medium', anIn: 'none', anOut: 'none', inD: k === 'flash' || k === 'punch' ? 0.08 : 0.3, outD: k === 'flash' ? 0.1 : 0.3, end: r2(Math.max(0, t) + (k === 'flash' ? 0.5 : k === 'punch' ? 1.2 : 2)), colour: k === 'tint' ? '#f5821f' : k === 'flash' ? '#ffffff' : '' });
  const mkProp = (t, k, style) => base('prop', t, { kind: k, style: style || 'comic', colour: '', face: 'auto', y: 0.6, end: r2(Math.max(0, t) + 5) });
  function pickImage() {
    return new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return res(null); try { res(await importImage(f)); } catch (e) { console.error(e); res(null); } }; inp.click(); });
  }
  async function importImage(file) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)), c = mkCanvas(bmp.width * k, bmp.height * k), g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
    const jpg = /jpe?g/i.test(file.type), url = c.toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.9), id = 'a' + hash(url).toString(36) + c.width.toString(36);
    await setAsset(id, url); hooks.addAsset && hooks.addAsset(id, url); return { id, w: c.width, h: c.height };
  }
  function upsertKey(L, tAbs, vals) {
    const st = num(L.start, 0), len = num(L.end, st + 3) - st, lt = r2(cl(tAbs - st, 0, len)); L.keys = L.keys || [];
    let k = L.keys.find(q => Math.abs(q.t - lt) < 0.026);
    if (!k) { const v = sample(L, st + lt); k = { t: lt, x: r4(v.x), y: r4(v.y), s: r4(v.s), rot: r2(v.rot), op: r2(v.op), e: 'smooth' }; L.keys.push(k); L.keys.sort((a, b) => a.t - b.t); }
    Object.keys(vals).forEach(p => { k[p] = p === 'rot' || p === 'op' ? r2(vals[p]) : r4(vals[p]); }); return k;
  }
  function removeKeyAt(L, idx) { if (!L.keys || !L.keys[idx]) return; if (L.keys.length === 1) Object.assign(L, kv(L.keys[0])); L.keys.splice(idx, 1); if (!L.keys.length) delete L.keys; }
  function setVals(L, snap, vals) { if (snap.keyed) upsertKey(L, snap.t, vals); else Object.keys(vals).forEach(p => { L[p] = p === 'rot' || p === 'op' ? r2(vals[p]) : r4(vals[p]); }); }

  function makeEditor(mod, ie) {
    const tl = cfg => ((cfg && cfg.layers) || []).map((L, i) => {
      const st = num(L.start, 0), en = Math.min(MAXT, num(L.end, st + 3)), T = TYPES[L.type] || TEXT;
      return { id: 'L:' + L.id, name: (L.hidden ? '(hidden) ' : '') + T.name + ': ' + labelOf(L), colour: T.colour, layer: true, meta: isMeta(L), locked: !!L.locked, hidden: !!L.hidden, toggle: isMeta(L) ? null : { text: L.behind ? 'Behind' : 'Front', on: !!L.behind, title: L.behind ? 'Drawn behind the scene. Click to bring it in front of everything (B).' : 'Drawn in front of everything. Click to put it behind the scene (B).' }, items: [{ id: 'L:' + L.id, start: st, end: en, label: labelOf(L), colour: mix(T.colour, '#000000', 0.25), locked: !!L.locked, trim: 'both', minLen: 0.2, keys: (keysOf(L) || []).map(k => st + k.t), fxAt: L.fx && L.fx !== 'none' ? st + num(L.fxAt, 1) : null }] };
    }).reverse();
    const ed = {
      formIsScene: ie.formIsScene, camera: ie.camera, resetTiming: ie.resetTiming ? (cfg, id) => ie.resetTiming(cfg, id) : undefined,
      tracks(cfg, look) { const rf = rampFn(cfg), d = rf ? mod.duration(strip(cfg), look) : 0, b0 = ie.tracks ? ie.tracks(strip(cfg), look) : null, b = b0 && rf ? b0.map(tr => Object.assign({}, tr, { items: tr.items.map(it => Object.assign({}, it, { start: rampInv(rf, it.start, d), end: rampInv(rf, it.end, d) })) })) : b0 ? b0 : [{ id: 'clip', name: mod.name || 'Clip', items: [{ id: '_all', start: 0, end: mod.duration(strip(cfg), look), label: mod.name || 'Clip', move: false, trim: 'none' }] }]; return [...tl(cfg), ...b]; },
      update(cfg, id, ch) {
        if (!isL(id)) { const rf = rampFn(cfg); if (rf && ie.update) { const d = mod.duration(strip(cfg), { format: '16:9' }); return ie.update(cfg, id, Object.assign({}, ch, { start: rampT(rf, ch.start, d), end: rampT(rf, ch.end, d) })); } return ie.update && ie.update(cfg, id, ch); } const L = find(cfg, id); if (!L) return;
        const st = num(L.start, 0), en = num(L.end, st + 3), leftTrim = Math.abs(ch.end - en) < 1e-6 && Math.abs(ch.start - st) > 1e-6;
        if (leftTrim) { const d = ch.start - st; (L.keys || []).forEach(k => { k.t = r2(k.t - d); }); (L.keys || []).forEach(k => { k.t = r2(cl(k.t, 0, ch.end - ch.start)); }); if (L.keys && !L.keys.length) delete L.keys; if (L.fx && L.fx !== 'none') L.fxAt = r2(Math.max(0, num(L.fxAt, 1) - d)); }
        L.start = r2(ch.start); L.end = r2(ch.end); if (L.keys) L.keys.forEach(k => { k.t = Math.min(k.t, r2(L.end - L.start)); });
      },
      hits(cfg, look, t, W, H) {
        const rfh = rampFn(cfg), dh = rfh ? mod.duration(strip(cfg), look) : 0, b = ie.hits ? (ie.hits(strip(cfg), look, rfh ? rampT(rfh, Math.min(t, dh), dh) : t, W, H) || []) : [];
        const c2 = strip(cfg), V = ((cfg && cfg.layers) || []).some(L => L.pin) ? viewOf(ie, c2, look, Math.min(t, mod.duration(c2, look)), W, H) : null, mp = (x, y) => [(x - V.fx) * V.z + W / 2, (y - V.fy) * V.z + H / 2];
        const cam = camOf(cfg && cfg.layers, t, W, H), ls = ((cfg && cfg.layers) || []).filter(L => !L.hidden && !isMeta(L) && !L.locked).map(L => { const sb = screenBox(L, t, W, H); if (!sb) return null; const pin = L.pin && V; if (pin) { const a = mp(sb.box[0], sb.box[1]), b = mp(sb.box[2], sb.box[3]), c = mp(sb.cx, sb.cy); sb.box = [a[0], a[1], b[0], b[1]]; sb.cx = c[0]; sb.cy = c[1]; } const st = num(L.start, 0), en = num(L.end, st + 3); return { id: 'L:' + L.id, box: sb.box, k: pin ? 1 / V.z : 1, scale: true, rot: true, ctr: [sb.cx, sb.cy], ghost: t < st || t > en, label: (TYPES[L.type] || TEXT).name + ((keysOf(L) || []).length ? ', keyframed' : '') }; }).filter(Boolean);
        const lb = ls.filter(h => { const L = find(cfg, h.id); return L && L.behind; }), lf = ls.filter(h => !lb.includes(h)), outH = [...lb, ...b, ...lf];
        // With a camera move or punch in on, boxes are where they appear on screen
        if (cam) outH.forEach(h => { const [x0, y0, x1, y1] = h.box, P = [cam.map(x0, y0), cam.map(x1, y0), cam.map(x1, y1), cam.map(x0, y1)]; h.box = [Math.min(...P.map(q => q[0])), Math.min(...P.map(q => q[1])), Math.max(...P.map(q => q[0])), Math.max(...P.map(q => q[1]))]; if (h.ctr) h.ctr = cam.map(...h.ctr); h.k = (h.k || 1) / cam.z; });
        return outH;
      },
      grab(cfg, id, ctx) {
        if (!isL(id)) return ie.grab ? ie.grab(cfg, id, ctx) : null; const L = find(cfg, id); if (!L) return null; const c = ctx || {}, t = c.t ?? 0;
        return { L: true, v: sample(L, t), keyed: !!(L.keys && L.keys.length), t, W: c.W || 1920, H: c.H || 1080, keys: JSON.parse(JSON.stringify(L.keys || [])), base: { x: num(L.x, 0.5), y: num(L.y, 0.5) } };
      },
      move(cfg, id, s, dx, dy, mods) {
        if (!isL(id)) return ie.move && ie.move(cfg, id, s, dx, dy, mods); const L = find(cfg, id); if (!L || !s) return;
        const cz = (camOf(cfg.layers, s.t, s.W, s.H) || { z: 1 }).z; dx /= cz; dy /= cz; let nx = s.v.x + dx / s.W, ny = s.v.y + dy / s.H; const guides = [];
        if (mods && mods.snap) { const tol = 14 / s.W; if (Math.abs(nx - 0.5) < tol) { nx = 0.5; guides.push(['x', s.W / 2]); } if (Math.abs(ny - 0.5) < tol * s.W / s.H) { ny = 0.5; guides.push(['y', s.H / 2]); } }
        if (s.keyed && mods && mods.shift) { const ddx = nx - s.v.x, ddy = ny - s.v.y; L.keys = s.keys.map(k => Object.assign({}, k, { x: r4(num(k.x, 0.5) + ddx), y: r4(num(k.y, 0.5) + ddy) })); L.x = r4(s.base.x + ddx); L.y = r4(s.base.y + ddy); }
        else setVals(L, s, { x: nx, y: ny });
        return { guides };
      },
      resize(cfg, id, s, f) { if (!isL(id)) return ie.resize && ie.resize(cfg, id, s, f); const L = find(cfg, id); if (!L || !s) return; setVals(L, s, { s: cl(s.v.s * f, 0.05, 12) }); },
      rotate(cfg, id, s, deg, mods) { if (!isL(id)) return; const L = find(cfg, id); if (!L || !s) return; let r = s.v.rot + deg; if (mods && mods.shift) r = Math.round(r / 15) * 15; setVals(L, s, { rot: r }); },
      retime(cfg, id, idx, tAbs) { const L = find(cfg, id); if (!L || !L.keys || !L.keys[idx]) return idx; const st = num(L.start, 0), len = num(L.end, st + 3) - st, k = L.keys[idx]; k.t = r2(cl(tAbs - st, 0, len)); L.keys.sort((a, b) => a.t - b.t); return L.keys.indexOf(k); },
      lockTrack(cfg, id) { const L = find(cfg, id); if (L) { L.locked = !L.locked; if (!L.locked) delete L.locked; } },
      hideTrack(cfg, id) { const L = find(cfg, id); if (L) { L.hidden = !L.hidden; if (!L.hidden) delete L.hidden; } },
      toggleTrack(cfg, id) { const L = find(cfg, id); if (L) { L.behind = !L.behind; if (!L.behind) delete L.behind; } },
      retimeFx(cfg, id, tAbs) { const L = find(cfg, id); if (!L) return; const st = num(L.start, 0); L.fxAt = r2(cl(tAbs - st, 0, num(L.end, st + 3) - st)); },
      addKey(cfg, id, tAbs) { const L = find(cfg, id); if (!L) return -1; const k = upsertKey(L, tAbs, {}); return L.keys.indexOf(k); },
      removeKey(cfg, id, idx) { const L = find(cfg, id); if (L) removeKeyAt(L, idx); },
      keyTimes(cfg) { const out = []; ((cfg && cfg.layers) || []).forEach(L => { const st = num(L.start, 0); (L.keys || []).forEach(k => out.push(st + k.t)); }); return out; },
      adds: [...(ie.adds || []),
        { group: 'layer', label: 'Text', title: 'Add a text layer at the playhead (T)', fn: (cfg, t) => add(cfg, mkText(t)) },
        { group: 'layer', label: 'Stamp', title: 'Add a stamp that slams in', choices: () => STAMPS.map(s => ({ label: s[0], key: s[0], icon: c => iconStamp(c, s) })), fn: (cfg, t, sel, ch) => add(cfg, mkStamp(t, STAMPS.find(s => s[0] === (ch && ch.key)) || STAMPS[0])) },
        { group: 'layer', label: 'Shape', title: 'Add an arrow, circle, box, tick or spotlight', choices: () => SHAPES.map(s => ({ label: s[1], key: s[0], icon: c => iconShape(c, s[0]) })), fn: (cfg, t, sel, ch) => add(cfg, mkShape(t, (ch && ch.key) || 'circle')) },
        { group: 'layer', label: 'Prop', title: 'Add a house, bank, car, plane and more. They can catch fire, explode and collapse.', choices: () => Object.keys(PROPS).map(k => ({ label: PROPS[k].name, key: k, icon: c => iconProp(c, k) })), fn: (cfg, t, sel, ch) => { const k = (ch && ch.key) || 'house', chalk = mod.id === 'board' || mod.id === 'story' || mod.id === 'broll'; const L = mkProp(t, k, chalk ? 'chalk' : 'comic'); if (ie.view && chalk) L.pin = true; return add(cfg, L); } },
        { group: 'layer', label: 'Camera', title: 'Add a camera move: zoom, pan, tilt and shake across the whole picture', choices: () => CAM_PRESETS.map(p => ({ label: p[1], key: p[0], icon: c => iconCam(c, p[0]) })), fn: (cfg, t, sel, ch) => add(cfg, mkCamera(t, (ch && ch.key) || 'push', cfg)) },
        { group: 'layer', label: 'Effect', title: 'Add an effect bar: shake, flash, zoom blur, vignette, grain, glow, tint', choices: () => EFFECTS.map(f => ({ label: f[1], key: f[0], icon: c => iconFx(c, f[0]) })), fn: (cfg, t, sel, ch) => add(cfg, mkEffect(t, (ch && ch.key) || 'shake')) },
        { group: 'layer', label: 'Saved', title: 'Drop in one of your saved pieces (save any layer from its panel)', choices: () => { const P = (hooks.pieces && hooks.pieces()) || []; return P.length ? P.map(p => ({ label: p.name, key: p.id, icon: c => iconPiece(c, p) })) : [{ label: 'Nothing saved yet', key: '', icon: () => { } }]; },
          fn: (cfg, t, sel, ch) => { const p = ((hooks.pieces && hooks.pieces()) || []).find(x => x.id === (ch && ch.key)); return p ? insertPiece(cfg, p, t) : null; } },
        { group: 'layer', label: 'Image', title: 'Add a picture or logo from your computer', fn: async (cfg, t) => { const im = await pickImage(); if (!im) return null; const w = Math.round(Math.min(900, 640 * Math.max(0.6, Math.min(1.4, im.w / im.h / 1.4)))); return add(cfg, base('image', t, { asset: im.id, w, frame: 'panel', rot: -2 })); } },
      ],
      remove(cfg, id) { if (!isL(id)) return ie.remove && ie.remove(cfg, id); cfg.layers = (cfg.layers || []).filter(L => 'L:' + L.id !== id); },
      duplicate(cfg, id) {
        if (!isL(id)) return ie.duplicate ? ie.duplicate(cfg, id) : id; const L = find(cfg, id); if (!L) return id;
        const c = JSON.parse(JSON.stringify(L)); c.id = newId(); c.x = r4(num(c.x, 0.5) + 0.03); c.y = r4(num(c.y, 0.5) + 0.03); (c.keys || []).forEach(k => { k.x = r4(num(k.x, 0.5) + 0.03); k.y = r4(num(k.y, 0.5) + 0.03); });
        cfg.layers.splice(cfg.layers.indexOf(L) + 1, 0, c); return 'L:' + c.id;
      },
      copy(cfg, id) { const L = find(cfg, id); return L ? JSON.parse(JSON.stringify(L)) : null; },
      paste(cfg, L, t) { const c = JSON.parse(JSON.stringify(L)); c.id = newId(); const len = num(c.end, 3) - num(c.start, 0); c.start = r2(t); c.end = r2(t + len); return add(cfg, c); },
      inspect(root, cfg, id, changed, done) { if (!isL(id)) return ie.inspect && ie.inspect(root, cfg, id, changed, done); inspectLayer(root, cfg, id, changed, done, ie.view ? (mod.id === 'board' || mod.id === 'story' || mod.id === 'broll' ? 'the blackboard' : 'the page') : null); },
      scene(root, cfg, changed) { ie.scene && ie.scene(root, cfg, changed); },
    };
    return ed;
  }

  /* ---------- Icons for the add menus ---------- */
  function iconCtx(c) { const g = c.getContext('2d'), dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1); c.width = 72 * dpr; c.height = 56 * dpr; g.scale(dpr, dpr); g.clearRect(0, 0, 72, 56); return g; }
  function iconProp(c, k) { const g = iconCtx(c), d = PROPS[k], U = 3, sc = Math.min(64 / (d.w * U), 48 / (d.h * U)); g.translate(36, 28); g.scale(sc, sc); drawProp(g, { kind: k, colour: '' }, 0.3, { u: 1, C: E.palette({}), flip: false }); }
  function iconShape(c, k) { const g = iconCtx(c); g.translate(36, 28); const L = { id: 'ic' + k, shape: k, colour: k === 'spot' ? '#ffffff' : '#e3302c', thick: 14, w: k === 'tick' || k === 'cross' ? 200 : 380, h: k === 'tick' || k === 'cross' ? 200 : 240 }; const b = SHAPE.box(L, 1), sc = Math.min(60 / (b[2] - b[0]), 44 / (b[3] - b[1])); g.scale(sc, sc); if (k === 'spot') { g.fillStyle = 'rgba(4,8,18,0.7)'; g.fillRect(-36 / sc, -28 / sc, 72 / sc, 56 / sc); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(0, 0, 190, 120, 0, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; g.lineWidth = 12; g.strokeStyle = '#fff'; g.stroke(); return; } SHAPE.draw(g, L, 0, { u: 1, C: E.palette({}), draw: 1 }); }
  function iconCam(c, k) { const g = iconCtx(c); g.strokeStyle = '#e8eefc'; g.lineWidth = 2; g.strokeRect(10, 10, 52, 36); g.fillStyle = '#f5821f'; g.strokeStyle = '#f5821f';
    const arr = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 7 * Math.cos(a - 0.5), y1 - 7 * Math.sin(a - 0.5)); g.lineTo(x1 - 7 * Math.cos(a + 0.5), y1 - 7 * Math.sin(a + 0.5)); g.fill(); };
    if (k === 'push' || k === 'punch') { g.strokeRect(22, 18, 28, 20); arr(14, 14, 22, 18); arr(58, 42, 50, 38); } else if (k === 'pull') { g.strokeRect(22, 18, 28, 20); arr(22, 18, 13, 13); arr(50, 38, 59, 43); }
    else if (k === 'panL') arr(16, 28, 56, 28); else if (k === 'panR') arr(56, 28, 16, 28); else if (k === 'tilt') { g.save(); g.translate(36, 28); g.rotate(-0.25); g.strokeRect(-16, -11, 32, 22); g.restore(); } else if (k === 'rumble') { g.beginPath(); for (let x = 14; x <= 58; x += 4) g.lineTo(x, 28 + (x % 8 ? -6 : 6)); g.stroke(); } else { g.beginPath(); g.arc(36, 28, 6, 0, TAU); g.fill(); } }
  function iconFx(c, k) { const g = iconCtx(c); g.fillStyle = '#2a3f69'; g.fillRect(8, 8, 56, 40); g.fillStyle = '#f7c531'; g.beginPath(); g.arc(36, 28, 10, 0, TAU); g.fill();
    if (k === 'flash') { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(8, 8, 56, 40); } else if (k === 'vignette') { const r = g.createRadialGradient(36, 28, 6, 36, 28, 34); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.9)'); g.fillStyle = r; g.fillRect(8, 8, 56, 40); }
    else if (k === 'grain') { const r = rng(3); for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'; g.fillRect(8 + r() * 56, 8 + r() * 40, 1.5, 1.5); } } else if (k === 'tint') { g.fillStyle = 'rgba(245,130,31,0.45)'; g.fillRect(8, 8, 56, 40); }
    else if (k === 'mono') { g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(36, 28, 10, 0, TAU); g.fill(); } else if (k === 'glow') { g.fillStyle = 'rgba(247,197,49,0.35)'; g.beginPath(); g.arc(36, 28, 18, 0, TAU); g.fill(); }
    else if (k === 'zoomblur') { for (let i = 1; i < 5; i++) { g.strokeStyle = `rgba(247,197,49,${0.5 - i * 0.1})`; g.lineWidth = 2; g.beginPath(); g.arc(36, 28, 10 + i * 4, 0, TAU); g.stroke(); } }
    else if (k === 'shake') { g.strokeStyle = '#e8eefc'; g.lineWidth = 2; [-6, 6].forEach(d => { g.beginPath(); g.moveTo(14 + d, 14); g.lineTo(14 + d, 42); g.stroke(); }); } else if (k === 'punch') { g.strokeStyle = '#e8eefc'; g.lineWidth = 2; g.strokeRect(18, 14, 36, 28); } }
  function iconPiece(c, p) { const g = iconCtx(c); if (!p.thumb) return; const im = new Image(); im.onload = () => { const sc = Math.min(72 / im.width, 56 / im.height); g.drawImage(im, (72 - im.width * sc) / 2, (56 - im.height * sc) / 2, im.width * sc, im.height * sc); }; im.src = p.thumb; }
  function iconStamp(c, s) { const g = iconCtx(c); g.translate(36, 28); const L = { text: s[0], colour: s[1], shape: s[2], size: 120 }, D = stampDims(L, 1), sc = Math.min(64 / D.w, 46 / D.h); g.rotate(s[2] === 'burst' ? 0 : -0.12); g.scale(sc, sc); STAMP.draw(g, L, 0, { u: 1, C: E.palette({}) }); }

  /* ---------- Easing curve pictures and the custom curve editor ---------- */
  function curvePlot(g, f, w, h, pad) { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
    g.beginPath(); for (let i = 0; i <= 60; i++) { const x = i / 60, y = f(x); const px = pad + x * (w - 2 * pad), py = h - pad - y * (h - 2 * pad); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.strokeStyle = '#f5821f'; g.lineWidth = 2; g.stroke(); }
  function curvePreview(k) { const c = UI.H('canvas', { className: 'curve sm', width: 56, height: 36, 'aria-hidden': 'true' }); try { curvePlot(c.getContext('2d'), easeFn(k), 56, 36, 6); } catch (e) { } return c; }
  // Drag the two handles to shape the move; the curve runs from bottom left (start) to top right (arrived)
  function curveEditor(k, changed) {
    const W = 168, Hh = 120, pad = 16, c = UI.H('canvas', { className: 'curve', width: W, height: Hh, title: 'Drag the round handles to shape the move', 'aria-label': 'Custom easing curve' }), g = c.getContext('2d');
    const P = () => k.cb.map(v => num(v, 0.5)), toPx = (x, y) => [pad + x * (W - 2 * pad), Hh - pad - y * (Hh - 2 * pad)], toV = (px, py) => [cl((px - pad) / (W - 2 * pad), 0, 1), cl((Hh - pad - py) / (Hh - 2 * pad), -0.6, 1.6)];
    const draw = () => { const [x1, y1, x2, y2] = P(); curvePlot(g, bezier(x1, y1, x2, y2), W, Hh, pad); const a = toPx(0, 0), b = toPx(1, 1), h1 = toPx(x1, y1), h2 = toPx(x2, y2);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(...a); g.lineTo(...h1); g.moveTo(...b); g.lineTo(...h2); g.stroke();
      [h1, h2].forEach(q => { g.beginPath(); g.arc(q[0], q[1], 6, 0, TAU); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#f5821f'; g.lineWidth = 2; g.stroke(); }); };
    let dragI = -1; const pos = ev => { const r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * Hh / r.height]; };
    c.addEventListener('pointerdown', ev => { const [px, py] = pos(ev), [x1, y1, x2, y2] = P(), h1 = toPx(x1, y1), h2 = toPx(x2, y2); const d1 = Math.hypot(px - h1[0], py - h1[1]), d2 = Math.hypot(px - h2[0], py - h2[1]); dragI = d1 <= d2 ? 0 : 1; (() => { try { c.setPointerCapture(ev.pointerId); } catch (e) { } })(); ev.preventDefault(); });
    c.addEventListener('pointermove', ev => { if (dragI < 0) return; const [vx, vy] = toV(...pos(ev)); k.cb[dragI * 2] = Math.round(vx * 100) / 100; k.cb[dragI * 2 + 1] = Math.round(vy * 100) / 100; draw(); changed(); });
    const end = () => { dragI = -1; }; c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    draw(); return c;
  }

  /* ---------- The panel for a selected layer ---------- */
  const COLS = [['#ffffff', 'White'], ['#f4eedf', 'Paper'], ...Object.entries(E.COLOURS).map(([k, v]) => [v, k])];
  const colSel = (val, fn, opts = COLS) => { const o = opts.some(x => x[0] === val) ? opts : [[val, 'Custom'], ...opts]; return UI.sel(val, o, fn); };
  // Saved text styles: font, colours, size and animations, kept on this computer and reused across every clip
  const TS_KEY = 'patter-text-styles', TS_PROPS = ['font', 'style', 'colour', 'bg', 'size', 'caps', 'anIn', 'inD', 'anOut', 'outD', 'loop', 'loopSpeed'];
  const tsLoad = () => { try { const v = JSON.parse(localStorage.getItem(TS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const tsSave = list => { try { localStorage.setItem(TS_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) { } };
  function textStyles(L, changed, re) {
    const { H, field, sel, btn } = UI, list = tsLoad(), name = H('input', { type: 'text', placeholder: 'Name this style, e.g. Punchline', 'aria-label': 'Style name' });
    const pick = sel('', [['', list.length ? 'Apply a saved style…' : 'No saved styles yet'], ...list.map((x, i) => [String(i), x.name])], v => { const st = list[+v]; if (!st) return; TS_PROPS.forEach(k => { if (st.props[k] === undefined) delete L[k]; else L[k] = st.props[k]; }); changed(); re(); });
    const save = btn('Save style', () => { const nm = name.value.trim() || 'Style ' + (list.length + 1), props = {}; TS_PROPS.forEach(k => { if (L[k] !== undefined) props[k] = L[k]; }); const i = list.findIndex(x => x.name === nm); if (i >= 0) list[i] = { name: nm, props }; else list.unshift({ name: nm, props }); tsSave(list); re(); });
    const del = list.length ? btn('Delete a style', () => { const i = list.findIndex(x => x.name === name.value.trim()); if (i >= 0) { list.splice(i, 1); tsSave(list); re(); } else name.placeholder = 'Type the name of the style to delete'; }) : '';
    return field('Text style', H('div', { className: 'ms' }, pick, H('div', { className: 'tmpl-row' }, name, save, del)));
  }
  function keyRows(L, changed, re) {
    const { H, sel } = UI, K = keysOf(L) || [], st = num(L.start, 0);
    return K.map((k, i) => H('div', { className: 'keyrow' + (hooks.selKey && hooks.selKey() === i ? ' on' : '') },
      H('button', { type: 'button', className: 'kgo', textContent: '◆ ' + (st + k.t).toFixed(2) + ' s', title: 'Jump to this keyframe', on: { click: () => hooks.seek && hooks.seek(st + k.t + 1e-4, i) } }),
      i ? H('div', { className: 'keyease' }, sel(k.e || 'smooth', EASE_OPTS, v => { k.e = v; if (v === 'custom' && !k.cb) k.cb = [0.3, 0, 0.2, 1]; changed(); re(); }, 'How it moves into this keyframe'), k.e === 'custom' ? curveEditor(k, changed) : curvePreview(k)) : H('span', { className: 'hint', textContent: 'Start' }),
      UI.iconBtn('×', 'Delete this keyframe', () => { removeKeyAt(L, L.keys.indexOf(k)); changed(); re(); })));
  }
  // Panel for camera moves and effect bars
  function inspectMeta(root, cfg, L, changed, done, re, set, now) {
    const { H, field, sel, num: numIn, card, grid2, btn } = UI, durO = [['0', 'Instant'], ['0.1', '0.1 s'], ['0.25', '0.25 s'], ['0.5', '0.5 s'], ['0.75', '0.75 s'], ['1', '1 s'], ['1.5', '1.5 s'], ['2', '2 s']], pickD = v => { const s2 = String(num(v, 0.4)); return durO.some(o => o[0] === s2) ? durO : [[s2, s2 + ' s'], ...durO]; };
    const timing = grid2(field('Starts at', numIn(num(L.start, 0), v => { const len = num(L.end, 3) - num(L.start, 0); L.start = r2(v); L.end = r2(v + len); changed(); }, 0, 3600, 0.1, 'Starts at')), field('Lasts (s)', numIn(r2(num(L.end, 3) - num(L.start, 0)), v => { L.end = r2(num(L.start, 0) + Math.max(0.1, v)); changed(); }, 0.1, 3600, 0.1, 'Lasts')));
    const fades = grid2(field('Eases in over', sel(String(num(L.inD, 0.4)), pickD(L.inD), v => set('inD', +v))), field('Eases out over', sel(String(num(L.outD, 0.4)), pickD(L.outD), v => set('outD', +v))));
    if (L.type === 'camera') {
      const K = keysOf(L) || [], keyed = K.length > 0, cur = sample(L, now()), vset = (p, v) => { setVals(L, { keyed, t: now() }, { [p]: v }); changed(); };
      root.append(card('Camera move',
        field('Start from a preset', sel('', [['', 'Choose a move…'], ...CAM_PRESETS], v => { if (!v) return; const n = mkCamera(num(L.start, 0), v); ['keys', 's', 'x', 'y', 'rot', 'shake', 'inD', 'outD'].forEach(k2 => { if (n[k2] === undefined) delete L[k2]; else L[k2] = n[k2]; }); if (v === 'punch' || v === 'rumble') L.end = r2(num(L.start, 0) + (v === 'punch' ? 1.6 : 2)); changed(); re(); })),
        grid2(field('Zoom', numIn(r2(cur.s), v => vset('s', cl(v, 0.2, 8)), 0.2, 8, 0.05, 'Zoom')), field('Tilt (degrees)', numIn(r2(cur.rot), v => vset('rot', v), -180, 180, 1, 'Tilt'))),
        grid2(field('Look across (%)', numIn(Math.round(cur.x * 100), v => vset('x', cl(v / 100, -0.5, 1.5)), -50, 150, 1, 'Look across')), field('Look down (%)', numIn(Math.round(cur.y * 100), v => vset('y', cl(v / 100, -0.5, 1.5)), -50, 150, 1, 'Look down'))),
        field('Shake', sel(L.shake || 'none', [['none', 'None'], ['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']], v => set('shake', v))), timing, fades,
        H('div', { className: 'btnrow' }, btn('◆ Add keyframe here', () => { upsertKey(L, now(), {}); changed(); re(); }), keyed ? btn('Clear keyframes', () => { Object.assign(L, kv(sample(L, now()))); delete L.keys; changed(); re(); }) : ''),
        keyed ? H('div', { className: 'keys' }, ...keyRows(L, changed, re)) : '',
        H('p', { className: 'hint' }, 'The camera moves the whole picture, layers included. 100% zoom with the look point at 50% and 50% is the normal shot. Add a keyframe, move the playhead, change the zoom or look point, and it glides between them.')));
    } else {
      const k = L.effect || 'shake';
      root.append(card('Effect',
        grid2(field('Effect', sel(k, EFFECTS, v => { L.effect = v; if ((v === 'tint' || v === 'flash') && !L.colour) L.colour = v === 'tint' ? '#f5821f' : '#ffffff'; changed(); re(); })), field('Strength', sel(L.fxPow || 'medium', [['small', 'Small'], ['medium', 'Medium'], ['big', 'Big']], v => set('fxPow', v)))),
        k === 'tint' || k === 'flash' ? field('Colour', colSel(L.colour || '#ffffff', v => set('colour', v))) : '', timing, k === 'flash' ? '' : fades,
        H('p', { className: 'hint' }, 'An effect bar treats the whole picture for as long as the bar lasts. Drag its edges on the timeline to set exactly when.')));
    }
    root.append(H('div', { className: 'btnrow' }, btn(L.hidden ? 'Turn on' : 'Turn off', () => { L.hidden = !L.hidden; changed(); re(); }), hooks.savePiece ? btn('Save as a piece', () => hooks.savePiece(cfg, ['L:' + L.id])) : '', btn('Done', done)));
  }
  function inspectLayer(root, cfg, id, changed, done, scene) {
    const { H, field, sel, txt, area, num: numIn, card, grid2, btn, yesno } = UI, L = find(cfg, id); if (!L) return;
    const T = TYPES[L.type] || TEXT, set = (k, v, full) => { L[k] = v; changed(); if (full) re(); }, re = () => { root.innerHTML = ''; inspectLayer(root, cfg, id, changed, done, scene); };
    const now = () => (hooks.time ? hooks.time() : num(L.start, 0)), kids = [];
    if (isMeta(L)) return inspectMeta(root, cfg, L, changed, done, re, set, now);
    if (L.type === 'text') {
      kids.push(field('Text', area(L.text, v => set('text', v), 'Type here. Press Enter for a new line.', 2, 'Text')),
        grid2(field('Font', sel(L.font || 'display', FONT_OPTS, v => set('font', v))), field('Style', sel(L.style || 'outline', [['outline', 'Ink outline'], ['banner', 'Banner'], ['highlight', 'Highlighter'], ['shadow', 'Drop shadow'], ['plain', 'Plain']], v => set('style', v)))),
        grid2(field('Text colour', colSel(L.colour || '#ffffff', v => set('colour', v))), field('Banner or highlight', colSel(L.bg || '#e3302c', v => set('bg', v)))),
        grid2(field('Size', numIn(num(L.size, 110), v => set('size', v), 10, 600, 1, 'Text size')), field('Capitals', yesno(!!L.caps, v => set('caps', v)))),
        textStyles(L, changed, re));
    } else if (L.type === 'stamp') {
      kids.push(grid2(field('Says', txt(L.text, v => set('text', v))), field('Colour', colSel(L.colour || '#e3302c', v => set('colour', v)))),
        grid2(field('Shape', sel(L.shape || 'rect', [['rect', 'Rubber stamp'], ['round', 'Round stamp'], ['burst', 'Comic burst']], v => set('shape', v))), field('Size', numIn(num(L.size, 130), v => set('size', v), 20, 500, 1, 'Stamp size'))));
    } else if (L.type === 'shape') {
      kids.push(grid2(field('Shape', sel(L.shape || 'circle', SHAPES, v => set('shape', v, true))), field('Colour', colSel(L.colour || '#e3302c', v => set('colour', v)))),
        grid2(field('Width', numIn(num(L.w, 380), v => set('w', v), 20, 2000, 1, 'Width')), field(L.shape === 'arrow' ? 'Height (not used)' : 'Height', numIn(num(L.h, 240), v => set('h', v), 10, 2000, 1, 'Height'))),
        L.shape === 'spot' ? field('Darken the rest', sel(String(num(L.dim, 0.62)), [['0.35', 'A little'], ['0.62', 'Medium'], ['0.82', 'A lot']], v => set('dim', +v))) : field('Line thickness', numIn(num(L.thick, 14), v => set('thick', v), 2, 80, 1, 'Line thickness')));
    } else if (L.type === 'image') {
      const swap = btn('Change picture', async () => { const im = await pickImage(); if (im) { L.asset = im.id; changed(); re(); } });
      kids.push(grid2(field('Frame', sel(L.frame || 'panel', [['panel', 'Comic panel'], ['polaroid', 'Polaroid'], ['round', 'Circle'], ['none', 'None']], v => set('frame', v))), field('Width', numIn(num(L.w, 640), v => set('w', v), 40, 3000, 1, 'Image width'))), H('div', { className: 'btnrow' }, swap));
    } else if (L.type === 'prop') {
      const PO = Object.keys(PROPS).map(k => [k, PROPS[k].name]), d = PROPS[L.kind] || PROPS.house;
      kids.push(grid2(field('Prop', sel(L.kind || 'house', PO, v => { L.kind = v; L.colour = ''; changed(); re(); })), field('Drawn as', sel(L.style || 'comic', [['comic', 'Comic'], ['chalk', 'Chalk']], v => set('style', v, true)))),
        grid2(field('Colour', colSel(L.colour || (L.style === 'chalk' ? '#f2efe6' : d.col), v => set('colour', v), [[d.col, 'Standard'], ...COLS, ['#c08a55', 'Brown'], ['#6e4526', 'Dark brown'], ['#2b2e34', 'Charcoal']])), field('Facing', sel(L.face || 'auto', [['auto', d.vehicle ? 'Way it travels' : 'Right'], ['right', 'Right'], ['left', 'Left']], v => set('face', v)))));
      if (d.vehicle) kids.push(H('p', { className: 'hint' }, 'To make it drive or fly across, add a keyframe at the start, move the playhead later, then drag it to where it should end up. The wheels turn and it faces the way it travels.'));
    }
    root.append(card((T.name) + ' layer', ...kids));
    // Effect
    const fxk = L.fx || 'none', fxKids = [field('Effect', sel(fxk, FX, v => { L.fx = v; if (v !== 'none' && !(num(L.fxAt, -1) >= 0)) L.fxAt = 1; changed(); re(); }))];
    if (fxk !== 'none') { fxKids.push(grid2(field('Starts after (s)', numIn(num(L.fxAt, 1), v => set('fxAt', v), 0, 600, 0.1, 'Effect starts after')), field('Strength', sel(L.fxPow || 'medium', [['small', 'Small'], ['medium', 'Medium'], ['big', 'Big']], v => set('fxPow', v)))));
      if (fxk === 'explode' || fxk === 'collapse') fxKids.push(grid2(field('Shake the screen', yesno(L.fxShake !== false, v => set('fxShake', v))), fxk === 'explode' ? field('Word', txt(L.fxWord === undefined ? 'BOOM!' : L.fxWord, v => set('fxWord', v), 'Leave blank for none')) : H('span')));
      fxKids.push(H('p', { className: 'hint' }, 'The orange mark on its timeline block shows when the effect starts. Drag it to retime.')); }
    root.append(card('Effect', ...fxKids));
    // Timing and quick animations
    const durO = [['0', 'Instant'], ['0.25', '0.25 s'], ['0.4', '0.4 s'], ['0.5', '0.5 s'], ['0.75', '0.75 s'], ['1', '1 s'], ['1.5', '1.5 s'], ['2', '2 s']], pickD = v => { const s = String(num(v, 0.5)); return durO.some(o => o[0] === s) ? durO : [[s, s + ' s'], ...durO]; };
    root.append(card('Timing',
      grid2(field('Appears at', numIn(num(L.start, 0), v => { const len = num(L.end, 3) - num(L.start, 0); L.start = r2(v); L.end = r2(v + len); changed(); }, 0, 3600, 0.1, 'Appears at')), field('Lasts (s)', numIn(r2(num(L.end, 3) - num(L.start, 0)), v => { L.end = r2(num(L.start, 0) + Math.max(0.2, v)); changed(); }, 0.2, 3600, 0.1, 'Lasts'))),
      grid2(field('Comes in', sel(L.anIn || 'fade', INS, v => set('anIn', v))), field('Taking', sel(String(num(L.inD, 0.5)), pickD(L.inD), v => set('inD', +v)))),
      grid2(field('Goes out', sel(L.anOut || 'fade', OUTS, v => set('anOut', v))), field('Taking', sel(String(num(L.outD, 0.4)), pickD(L.outD), v => set('outD', +v)))),
      grid2(field('Keeps moving', sel(L.loop || 'none', LOOPS.filter(o => o[0] !== 'jiggle' || L.type === 'text'), v => set('loop', v))), field('Loop speed', sel(String(num(L.loopSpeed, 1)), [['0.5', 'Slow'], ['1', 'Normal'], ['1.6', 'Fast']], v => set('loopSpeed', +v))))));
    // Motion and keyframes
    const K = keysOf(L) || [], st = num(L.start, 0), keyed = K.length > 0, cur = sample(L, now());
    const vset = (p, v) => { setVals(L, { keyed, t: now() }, { [p]: v }); changed(); };
    const opR = H('input', { type: 'range', min: 0, max: 100, value: Math.round(cur.op * 100), 'aria-label': 'Opacity', on: { input: e => vset('op', +e.target.value / 100) } });
    const rows = keyRows(L, changed, re);
    root.append(card('Motion',
      grid2(field('Size', numIn(r2(cur.s), v => vset('s', v), 0.05, 12, 0.05, 'Size')), field('Rotation (degrees)', numIn(r2(cur.rot), v => vset('rot', v), -3600, 3600, 1, 'Rotation'))),
      field('Opacity', opR),
      field('Draw it', sel(L.behind ? 'behind' : 'front', [['front', 'In front of everything'], ['behind', 'Behind the scene (characters, writing and charts in front)']], v => set('behind', v === 'behind'))),
      scene ? field('Sticks to', sel(L.pin ? 'scene' : 'screen', [['screen', 'The screen (stays put)'], ['scene', 'Draw it on ' + scene + ' (moves with the camera)']], v => set('pin', v === 'scene'))) : '',
      H('div', { className: 'btnrow' }, btn('◆ Add keyframe here', () => { upsertKey(L, now(), {}); changed(); re(); }), keyed ? btn('Clear keyframes', () => { Object.assign(L, kv(sample(L, now()))); delete L.keys; changed(); re(); }) : ''),
      rows.length ? H('div', { className: 'keys' }, ...rows) : '',
      H('p', { className: 'hint' }, keyed ? 'Dragging it on the preview, resizing or turning it sets a keyframe at the playhead. Hold Shift while dragging to move the whole path. The rotate handle sits above the box.' : 'Drag it on the preview to place it, pull a corner to resize, use the round handle to turn it. Add a keyframe, move the playhead, then drag it again to make it move.')));
    const idx = cfg.layers.indexOf(L);
    root.append(H('div', { className: 'btnrow' },
      btn('Bring forward', () => { if (idx < cfg.layers.length - 1) { cfg.layers.splice(idx, 1); cfg.layers.splice(idx + 1, 0, L); changed(); re(); } }),
      btn('Send back', () => { if (idx > 0) { cfg.layers.splice(idx, 1); cfg.layers.splice(idx - 1, 0, L); changed(); re(); } }),
      btn(L.hidden ? 'Show' : 'Hide', () => { L.hidden = !L.hidden; changed(); re(); }),
      hooks.savePiece ? btn('Save as a piece', () => hooks.savePiece(cfg, ['L:' + L.id])) : '',
      btn('Done', done)));
  }

  return { RAMP_OPTS, pieceOf, insertPiece, camOf, isMeta, wrap, drawAll, setAsset, setAssets, assetsFor, assets, hooks, sample, anim, PROPS, TYPES, FX, strip, screenShake, mkText, mkProp, mkStamp, mkShape, add, layersEnd, importImage, iconProp };
})();

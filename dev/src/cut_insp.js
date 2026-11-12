/* CutInspect: the right hand panel of the editor. The selected clip's settings in tabs (like CapCut), a transition's
   settings, a track's settings, or the project's when nothing is selected; and the export window. */
const CutInspect = (() => {
  const { H } = UI;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const V = () => Video;
  const TABS = { basic: 'Video', anim: 'Animation', speed: 'Speed', col: 'Colour', fx: 'Effects', mask: 'Mask', key: 'Chroma key', audio: 'Audio', clip: 'Clip', title: 'Intro', avatar: 'You', colour: 'Card', intro: 'Intro' };
  const BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['color-dodge', 'Colour dodge'], ['color-burn', 'Colour burn'], ['hard-light', 'Hard light'], ['soft-light', 'Soft light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Colour'], ['luminosity', 'Luminosity']];

  function create(o, ui) {
    /* o: as CutUI's, plus ui (the CutUI instance) */
    const look = () => o.getLook();
    const placed = (c, it) => V().allPlaced(c, look()).find(p => p.it === it);
    // A slider with its number, and (for animatable settings) a keyframe diamond with jumps to the previous and next key
    function slider(label, get, set, min, max, step, fmt, extra = {}) {
      const v0 = get(), out = H('input', { type: 'text', inputMode: 'decimal', className: 'cs-num', value: fmt ? fmt(v0) : String(v0), 'aria-label': label });
      const rng = H('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(v0), 'aria-label': label });
      const apply = v => { v = cl(v, min, max); set(v); rng.value = String(v); out.value = fmt ? fmt(v) : String(r2(v)); extra.onChange && extra.onChange(); };
      rng.addEventListener('input', () => apply(+rng.value)); rng.addEventListener('change', () => extra.commit && extra.commit());
      rng.addEventListener('dblclick', () => { if (extra.reset != null) { apply(extra.reset); extra.commit && extra.commit(); } });
      out.addEventListener('change', () => { const n = parseFloat(String(out.value).replace(/[^0-9.\-]/g, '')); if (isFinite(n)) { apply(extra.parse ? extra.parse(n) : n); extra.commit && extra.commit(); } else out.value = fmt ? fmt(get()) : String(get()); });
      const row = H('div', { className: 'cs-row' + (extra.key ? ' haskey' : '') }, H('span', { className: 'cs-lab', textContent: label, title: extra.reset != null ? 'Double click the slider to reset' : '' }), rng, out);
      if (extra.key) row.append(extra.key);
      return row;
    }
    // Keyframe diamond for one setting of a clip
    function keyBtn(c, it, prop, get, changed) {
      const p = placed(c, it); if (!p) return null; const local = () => o.player.t - p.t0;
      const L = () => (it.kf && it.kf[prop]) || [], atKey = () => L().findIndex(q => Math.abs(q[0] - local()) < 0.02);
      const b = H('span', { className: 'cs-key' });
      const draw = () => { b.innerHTML = ''; const has = L().length, on = atKey() >= 0;
        b.append(H('button', { type: 'button', className: 'ci sm', title: 'Previous keyframe', 'aria-label': 'Previous keyframe', disabled: !has, textContent: '‹', on: { click: () => go(-1) } }),
          H('button', { type: 'button', className: 'ci sm kd' + (on ? ' on' : ''), title: on ? 'Remove this keyframe' : 'Add a keyframe here (the setting then changes over time between keyframes)', 'aria-label': on ? 'Remove keyframe' : 'Add keyframe', innerHTML: on ? ui.I.key : ui.I.keyOff, on: { click: toggle } }),
          H('button', { type: 'button', className: 'ci sm', title: 'Next keyframe', 'aria-label': 'Next keyframe', disabled: !has, textContent: '›', on: { click: () => go(1) } })); };
      const toggle = () => { o.commit(); const i = atKey(); if (i >= 0) { L().splice(i, 1); if (!L().length) { it[prop] = get(); delete it.kf[prop]; if (!Object.keys(it.kf).length) delete it.kf; } } else { V().setKey(it, prop, local(), get()); } changed(true); };
      const go = dir => { const ts = L().map(q => q[0] + p.t0), t = o.player.t, n = dir > 0 ? ts.find(v => v > t + 0.01) : [...ts].reverse().find(v => v < t - 0.01); if (n == null) return; o.player.pause(); o.player.seek(n + 1e-4); ui.setTime(n); setTimeout(() => o.rebuildInspector(), 30); };
      draw(); return b;
    }
    // Value of an animatable setting at the playhead, and setting it (as a keyframe when the setting has keyframes)
    const valAt = (c, it, prop, base) => { const p = placed(c, it); return p ? V().kfAt(it, prop, o.player.t - p.t0, base) : base; };
    const setAt = (c, it, prop, v) => { if (it.kf && it.kf[prop] && it.kf[prop].length) { const p = placed(c, it); if (p) { V().setKey(it, prop, o.player.t - p.t0, v); return; } } it[prop] = v; };
    const chips = (cur, opts, fn, cls) => H('div', { className: 'cs-chips ' + (cls || '') }, ...opts.map(([k, l]) => H('button', { type: 'button', className: String(k) === String(cur) ? 'on' : '', 'aria-pressed': String(String(k) === String(cur)), textContent: l, on: { click: () => fn(k) } })));
    const sect = (title, ...kids) => H('div', { className: 'cs-sect' }, title ? H('h4', { textContent: title }) : '', ...kids);
    const check = (label, on, fn, title) => H('label', { className: 'check', title: title || '' }, H('input', { type: 'checkbox', checked: !!on, on: { change: e => fn(e.target.checked) } }), ' ' + label);

    /* ---------- A clip ---------- */
    function inspect(root, c, id, changed, done) {
      id = String(id || '');
      if (id.startsWith('T:')) return transPanel(root, c, id.slice(2), changed);
      if (id.startsWith('K:')) return trackPanel(root, c, id.slice(2), changed);
      const f = V().findItem(c, id); if (!f) return; const it = f.it, m = it.asset ? CutMedia.info(it.asset) : null, isImg = m && m.kind === 'image', isVid = m && m.kind === 'video';
      if (it.asset && !m && it.kind !== 'intro') { root.append(H('section', { className: 'card cs' }, H('div', { className: 'cs-head' }, H('b', { textContent: it.file || 'Missing file' })), H('div', { className: 'cs-body' }, H('p', { className: 'hint', textContent: '"' + (it.file || 'This file') + '" isn\'t on this computer (the project was made on another one, or the file was removed). Find it and every clip that uses it comes back.' }), H('div', { className: 'btnrow' }, UI.btn('Find this file…', () => ui.relinkPick(it.asset), 'primary'), UI.btn('Remove the clip', () => { o.commit(); f.list.splice(f.i, 1); o.changed(true); o.ed.select(null); }))))); return; }
      const tabs = it.kind === 'audio' ? ['audio', 'speed'] : it.kind === 'avatar' ? ['avatar'] : it.kind === 'intro' ? ['intro', 'basic', 'col', 'fx', 'audio'] : it.kind === 'adjust' ? ['col', 'fx', 'basic'] : it.kind === 'colour' ? ['colour', 'basic', 'anim', 'fx', 'mask']
        : it.kind === 'clip' && it.mod === 'intro' ? ['title', 'basic', 'col', 'fx'] : it.kind === 'clip' ? ['clip', 'basic', 'anim', 'speed', 'col', 'fx', 'mask', 'key'] : isImg ? ['basic', 'anim', 'col', 'fx', 'mask', 'key'] : ['basic', 'anim', 'speed', 'col', 'fx', 'mask', 'key', ...(m && m.hasAudio !== false ? ['audio'] : [])];
      let tab = ui.inspTab[it.id] || tabs[0]; if (!tabs.includes(tab)) tab = tabs[0];
      const head = H('div', { className: 'cs-head' }, H('i', { style: 'background:' + (V().COLS[it.kind === 'clip' ? it.mod : it.kind === 'media' ? (isImg ? 'image' : 'media') : it.kind] || '#556') }), H('b', { textContent: V().NAME(it) }));
      const p = placed(c, it); if (p) head.append(H('span', { className: 'cs-time', textContent: ui.tc(p.t0) + ' · ' + ui.short(p.d) }));
      head.append(H('button', { type: 'button', className: 'ci', title: 'Done (Esc)', 'aria-label': 'Done', textContent: '×', on: { click: done } }));
      const tb = H('div', { className: 'cs-tabs', role: 'tablist' }), body = H('div', { className: 'cs-body' });
      tabs.forEach(k => tb.append(H('button', { type: 'button', role: 'tab', className: k === tab ? 'on' : '', 'aria-selected': String(k === tab), textContent: TABS[k], on: { click: () => { ui.inspTab[it.id] = k; o.rebuildInspector(); } } })));
      const ch = full => changed(full), cm = () => o.commit();
      ({ basic, anim, speed, col, fx, mask, key, audio, clip, title, avatar, colour, intro })[tab](body, c, it, m, ch, cm, f);
      root.append(H('section', { className: 'card cs' }, head, tb, body));
    }
    function fadeSect(body, c, it, f, ch, cm) {
      { const pp = placed(c, it), D = pp ? pp.d : 10, main = f.track === 'main';
          body.append(sect(main ? 'Fade from or to black' : 'Fade in and out',
            slider(main ? 'Fade in from ' + (it.vfCol === 'white' ? 'white' : 'black') : 'Fade in', () => +it.vfIn || 0, v => { if (v <= 0.001) delete it.vfIn; else it.vfIn = r2(v); }, 0, Math.min(10, D), 0.05, v => v <= 0.001 ? 'off' : r2(v) + ' s', { onChange: ch, commit: cm, reset: 0 }),
            slider(main ? 'Fade out to ' + (it.vfCol === 'white' ? 'white' : 'black') : 'Fade out', () => +it.vfOut || 0, v => { if (v <= 0.001) delete it.vfOut; else it.vfOut = r2(v); }, 0, Math.min(10, D), 0.05, v => v <= 0.001 ? 'off' : r2(v) + ' s', { onChange: ch, commit: cm, reset: 0 }),
            main ? chips(it.vfCol === 'white' ? 'white' : 'black', [['black', 'Black'], ['white', 'White']], v => { cm(); if (v === 'white') it.vfCol = 'white'; else delete it.vfCol; ch(true); o.rebuildInspector(); }) : '',
            chips(it.vfSound === false ? 'pic' : 'both', [['both', 'Fade its sound too'], ['pic', 'Picture only']], v => { cm(); if (v === 'pic') it.vfSound = false; else delete it.vfSound; ch(true); o.rebuildInspector(); }),
            H('p', { className: 'hint', textContent: 'Or drag the round handles at the top corners of the clip on the timeline.' }))); }
    }
    function basic(body, c, it, m, ch, cm, f) {
      const k = (prop, get) => keyBtn(c, it, prop, get, ch), adj = it.kind === 'adjust';
      if (!adj) {
        body.append(sect('Position and size',
          slider('Scale', () => Math.round(valAt(c, it, 's', it.s == null ? 1 : +it.s) * 100), v => setAt(c, it, 's', r3(v / 100)), 2, 500, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 100, key: k('s', () => valAt(c, it, 's', it.s == null ? 1 : +it.s)) }),
          slider('Left and right', () => Math.round((valAt(c, it, 'x', it.x == null ? 0.5 : +it.x) - 0.5) * 1920), v => setAt(c, it, 'x', r3(0.5 + v / 1920)), -3000, 3000, 1, v => Math.round(v) + ' px', { onChange: ch, commit: cm, reset: 0, key: k('x', () => valAt(c, it, 'x', it.x == null ? 0.5 : +it.x)) }),
          slider('Up and down', () => Math.round((valAt(c, it, 'y', it.y == null ? 0.5 : +it.y) - 0.5) * 1080), v => setAt(c, it, 'y', r3(0.5 + v / 1080)), -2000, 2000, 1, v => Math.round(v) + ' px', { onChange: ch, commit: cm, reset: 0, key: k('y', () => valAt(c, it, 'y', it.y == null ? 0.5 : +it.y)) }),
          slider('Rotate', () => r2(valAt(c, it, 'rot', +it.rot || 0)), v => setAt(c, it, 'rot', r2(v)), -360, 360, 0.5, v => r2(v) + '°', { onChange: ch, commit: cm, reset: 0, key: k('rot', () => valAt(c, it, 'rot', +it.rot || 0)) }),
          it.kind === 'media' ? H('div', { className: 'btnrow' }, UI.btn('Replace the footage…', () => ui.replacePick(it.id))) : '',
        H('div', { className: 'btnrow' }, UI.btn('Flip across', () => { cm(); it.flipH = !it.flipH; ch(); }), UI.btn('Flip upside down', () => { cm(); it.flipV = !it.flipV; ch(); }), UI.btn('Reset', () => { cm(); ['x', 'y', 's', 'rot', 'flipH', 'flipV', 'crop'].forEach(q => delete it[q]); if (it.kf) ['x', 'y', 's', 'rot'].forEach(q => delete it.kf[q]); ch(true); o.rebuildInspector(); }))));
        fadeSect(body, c, it, f, ch, cm);
        if (it.kind !== 'colour') body.append(sect('Fit in the frame', chips(it.fit || (it.kind === 'clip' ? 'stretch' : 'fit'), [['fit', 'Whole picture'], ['fill', 'Fill the frame'], ['stretch', 'Stretch']], v => { cm(); it.fit = v; ch(true); o.rebuildInspector(); })));
        if (f.track === 'main' && it.kind === 'media') body.append(sect('Background (where the clip doesn\'t fill the frame)', chips(it.bg || 'auto', [['auto', 'As the project'], ['black', 'Black'], ['blur', 'Blurred'], ['white', 'White']], v => { cm(); if (v === 'auto') delete it.bg; else it.bg = v; ch(true); o.rebuildInspector(); })));
        const cr = it.crop || [0, 0, 0, 0], setCr = (i, v) => { const a = (it.crop || [0, 0, 0, 0]).slice(), other = i % 2 ? 4 - i : 2 - i; a[i] = r3(Math.min(v / 100, 0.95 - a[other])); if (a.some(Boolean)) it.crop = a; else delete it.crop; };
        if (it.kind !== 'colour') body.append(sect('Crop', ...[['Left', 0], ['Top', 1], ['Right', 2], ['Bottom', 3]].map(([l, i]) => slider(l, () => Math.round(cr[i] * 100), v => setCr(i, v), 0, 90, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 0 }))));
      }
      body.append(sect('Blend',
        slider('Opacity', () => Math.round(valAt(c, it, 'op', it.op == null ? 1 : +it.op) * 100), v => setAt(c, it, 'op', r3(v / 100)), 0, 100, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 100, key: k('op', () => valAt(c, it, 'op', it.op == null ? 1 : +it.op)) }),
        adj ? '' : UI.field('Blend mode', UI.sel(it.blend || 'normal', BLENDS, v => { cm(); if (v === 'normal') delete it.blend; else it.blend = v; ch(true); }, 'Blend mode'))));
    }
    function anim(body, c, it, m, ch, cm) {
      const p = placed(c, it), len = p ? p.d : 3, set = (k, v) => { cm(); if (!v || v === 'none') delete it[k]; else it[k] = Object.assign({ d: 0.6 }, it[k] || {}, { k: v }); ch(true); o.rebuildInspector(); };
      const durS = k => it[k] && it[k].k ? slider('Length', () => +it[k].d || 0.6, v => { it[k].d = r2(v); }, 0.1, Math.max(0.2, Math.min(10, len)), 0.05, v => r2(v) + ' s', { onChange: ch, commit: cm }) : '';
      body.append(sect('In', chips((it.anIn && it.anIn.k) || 'none', Object.entries(V().ANIM_IN), v => set('anIn', v), 'wrap'), durS('anIn')),
        sect('Out', chips((it.anOut && it.anOut.k) || 'none', Object.entries(V().ANIM_OUT), v => set('anOut', v), 'wrap'), durS('anOut')),
        sect('All the way through', chips((it.anLoop && it.anLoop.k) || 'none', Object.entries(V().ANIM_LOOP), v => { cm(); if (v === 'none') delete it.anLoop; else it.anLoop = Object.assign({ speed: 1 }, it.anLoop || {}, { k: v }); ch(true); o.rebuildInspector(); }, 'wrap'),
          it.anLoop ? slider('Speed', () => +it.anLoop.speed || 1, v => { it.anLoop.speed = r2(v); }, 0.1, 5, 0.05, v => r2(v) + 'x', { onChange: ch, commit: cm, reset: 1 }) : ''),
        H('p', { className: 'hint', textContent: 'For anything more, use the keyframe diamonds on the Video tab: set a value, move the playhead, set another.' }));
    }
    function speed(body, c, it, m, ch, cm) {
      const isVid = m && m.kind === 'video', canCurve = it.kind !== 'audio', curved = canCurve && !!V().curvePts(it), lenNow = () => { const p = placed(c, it); return p ? ui.short(p.d) : ''; };
      const lenP = H('p', { className: 'hint', textContent: '' }), sayLen = () => { lenP.textContent = 'Now ' + lenNow() + ' long on the timeline.'; };
      if (canCurve) body.append(sect('', chips(curved ? 'curve' : 'normal', [['normal', 'Normal'], ['curve', 'Curve']], v => { cm(); if (v === 'normal') delete it.curve; else { const P = V().CURVES.montage; const [a, b] = it.kind === 'clip' ? V().clipSpan(it, look()) : V().srcSpan(it); it.curve = { k: 'montage', pts: P.pts.map(q => q.slice()), a: r3(a), b: r3(b) }; } ch(true); o.rebuildInspector(); })));
      body.append(sect(curved ? 'Overall speed' : 'Speed', chips(String(+it.speed || 1), [['0.25', '0.25x'], ['0.5', '0.5x'], ['0.75', '0.75x'], ['1', '1x'], ['1.25', '1.25x'], ['1.5', '1.5x'], ['2', '2x'], ['3', '3x'], ['5', '5x'], ['10', '10x']], v => { cm(); if (+v === 1) delete it.speed; else it.speed = +v; ch(true); o.rebuildInspector(); }, 'wrap'),
        slider('Exact speed', () => +it.speed || 1, v => { if (Math.abs(v - 1) < 1e-3) delete it.speed; else it.speed = r2(v); sayLen(); ui.build(); }, 0.1, 20, 0.05, v => r2(v) + 'x', { onChange: ch, commit: () => { cm(); o.rebuildInspector(); }, reset: 1 }),
        H('p', { className: 'hint', textContent: (it.kind === 'clip' ? 'The animation itself plays faster or slower, and ' : '') + 'the clip gets longer or shorter to match. ' + (curved ? '' : isVid || it.kind === 'audio' ? 'Sound speeds up with it.' : '') }), lenP));
      if (curved) {
        const g = H('div', { className: 'cs-curves' });
        Object.entries(V().CURVES).forEach(([k, C]) => { const cv = H('canvas', { width: 120, height: 56 }); drawCurve(cv, C.pts, null); g.append(H('button', { type: 'button', className: it.curve.k === k ? 'on' : '', title: C.label, on: { click: () => { cm(); it.curve.k = k; it.curve.pts = C.pts.map(q => q.slice()); ch(true); o.rebuildInspector(); } } }, cv, H('span', { textContent: C.label }))); });
        const ed = H('canvas', { className: 'cs-curve-ed', width: 560, height: 240 }); let hot = -1; const P = () => it.curve.pts;
        const pos = e => { const r = ed.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
        const toM = y => Math.exp(Math.log(10) - y * 2 * Math.log(10)), toY = mm => (Math.log(10) - Math.log(mm)) / (2 * Math.log(10)), PADX = 0.04;
        const near = ([x, y]) => P().findIndex(q => Math.abs(PADX + q[0] * (1 - 2 * PADX) - x) < 0.04 && Math.abs(toY(q[1]) - y) < 0.08);
        let raf = 0; const tl = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => ui.build()); }, custom = () => { it.curve.k = 'custom'; g.querySelectorAll('button.on').forEach(b => b.classList.remove('on')); };
        ed.addEventListener('pointerdown', e => { const q = pos(e); hot = near(q); if (hot < 0) return; e.preventDefault(); ed.setPointerCapture(e.pointerId); cm(); custom(); });
        ed.addEventListener('pointermove', e => { const q = pos(e); if (hot < 0) { ed.style.cursor = near(q) >= 0 ? 'grab' : 'crosshair'; return; } const L = P(), u = (q[0] - PADX) / (1 - 2 * PADX);
          L[hot][1] = Math.round(Math.max(0.1, Math.min(10, toM(Math.max(0, Math.min(1, q[1]))))) * 100) / 100; if (hot > 0 && hot < L.length - 1) L[hot][0] = Math.round(Math.max(L[hot - 1][0] + 0.02, Math.min(L[hot + 1][0] - 0.02, u)) * 1000) / 1000;
          drawCurve(ed, L, hot); ch(); sayLen(); tl(); });
        ed.addEventListener('pointerup', () => { if (hot >= 0) { hot = -1; ch(true); drawCurve(ed, P(), -1); tl(); } });
        ed.addEventListener('dblclick', e => { const q = pos(e), k = near(q), L = P(); cm(); custom(); if (k > 0 && k < L.length - 1) L.splice(k, 1); else if (k < 0) { const u = Math.max(0.01, Math.min(0.99, (q[0] - PADX) / (1 - 2 * PADX))); L.push([Math.round(u * 1000) / 1000, Math.round(toM(q[1]) * 100) / 100]); L.sort((x, y) => x[0] - y[0]); } drawCurve(ed, L, -1); ch(true); sayLen(); tl(); });
        drawCurve(ed, P(), -1);
        body.append(sect('Speed curve', g, ed, H('p', { className: 'hint', textContent: 'Drag the dots up to speed up, down to slow down. Double click to add a dot, double click a dot to take it away.' + (isVid ? ' A clip with a speed curve plays its picture only: detach the sound first if you want it.' : '') }),
          H('div', { className: 'btnrow' }, UI.btn('Back to normal speed', () => { cm(); delete it.curve; ch(true); o.rebuildInspector(); }))));
      }
      sayLen();
      if ((isVid && !curved) || it.kind === 'audio') body.append(sect('', check('Keep the pitch (voices don\'t go squeaky or deep)', it.pitch !== false, v => { cm(); if (v) delete it.pitch; else it.pitch = false; ch(true); })));
      if (isVid) body.append(sect('Play backwards', check('Reverse', !!it.rev, v => { cm(); if (v) it.rev = true; else delete it.rev; ch(true); }), H('p', { className: 'hint', textContent: 'Reversed clips play smoothly in the export; the preview steps through them while playing.' })));
    }
    // A speed curve as a picture: speed up the side, a line at normal speed
    function drawCurve(cv, pts, hot) {
      const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, PADX = 0.04, X = u => (PADX + u * (1 - 2 * PADX)) * W, Y = mm => (Math.log(10) - Math.log(mm)) / (2 * Math.log(10)) * Hh, big = W > 200;
      g.clearRect(0, 0, W, Hh); g.fillStyle = '#0f1729'; g.fillRect(0, 0, W, Hh);
      [0.25, 0.5, 2, 4].forEach(mm => { g.strokeStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(0, Y(mm)); g.lineTo(W, Y(mm)); g.stroke(); });
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, Y(1)); g.lineTo(W, Y(1)); g.stroke(); g.setLineDash([]);
      if (big) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.font = '18px system-ui,sans-serif'; [[10, '10x'], [1, '1x'], [0.1, '0.1x']].forEach(([mm, t]) => g.fillText(t, 6, Math.min(Hh - 6, Math.max(18, Y(mm) - 4)))); }
      const P = pts.slice().sort((a, b) => a[0] - b[0]); g.strokeStyle = '#f5c518'; g.lineWidth = big ? 3 : 2; g.beginPath();
      for (let i = 0; i <= 100; i++) { const u = i / 100, mm = V().curveMul(P, u); if (i) g.lineTo(X(u), Y(mm)); else g.moveTo(X(u), Y(mm)); } g.stroke();
      if (big) P.forEach((q, i) => { g.fillStyle = i === hot ? '#fff' : '#f5c518'; g.beginPath(); g.arc(X(q[0]), Y(q[1]), 9, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#0f1729'; g.lineWidth = 2; g.stroke(); });
    }
    function col(body, c, it, m, ch, cm) {
      const C = it.col || {}, setC = (k, v) => { it.col = Object.assign({}, it.col || {}); if (v === 0 || v == null) delete it.col[k]; else it.col[k] = v; if (!Object.keys(it.col).length) delete it.col; };
      const g = H('div', { className: 'cs-looks' }); Object.entries(CutGL.LOOKS).forEach(([k, L]) => { const cv = H('canvas', { width: 72, height: 40 }); ui.lookThumb(cv, k); g.append(H('button', { type: 'button', className: (C.look || 'none') === k ? 'on' : '', title: L.label, on: { click: () => { cm(); setC('look', k === 'none' ? null : k); if (k !== 'none' && it.col && it.col.lookAmt == null) it.col.lookAmt = 100; ch(true); o.rebuildInspector(); } } }, cv, H('span', { textContent: L.label }))); });
      body.append(sect('Looks', g, C.look ? slider('Strength', () => C.lookAmt == null ? 100 : +C.lookAmt, v => setC('lookAmt', Math.round(v) === 100 ? null : Math.round(v)), 0, 100, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 100 }) : ''));
      body.append(sect('Adjust', ...CutGL.ADJUST.map(([k, l, a, b]) => slider(l, () => +((it.col || {})[k]) || 0, v => setC(k, Math.round(v)), a, b, 1, v => Math.round(v), { onChange: ch, commit: cm, reset: 0 })),
        H('div', { className: 'btnrow' }, UI.btn('Reset colour', () => { cm(); delete it.col; ch(true); o.rebuildInspector(); }), UI.btn('Use on every clip', () => { cm(); const all = V().allPlaced(c, look()).map(p => p.it).filter(x => x !== it && x.kind !== 'audio' && x.kind !== 'avatar'); all.forEach(x => { if (it.col) x.col = JSON.parse(JSON.stringify(it.col)); else delete x.col; }); ch(true); o.say('Colour copied onto ' + all.length + ' clips.'); }))));
      if (!CutGL.available) body.append(H('p', { className: 'hint', textContent: 'The graphics chip isn\'t available, so only brightness, contrast, saturation and black and white show.' }));
    }
    function fx(body, c, it, m, ch, cm) {
      const L = it.fx || [];
      if (!L.length) body.append(H('p', { className: 'hint', textContent: 'No effects yet. Pick one below, or drag one from Effects in the library.' }));
      L.forEach((f, i) => { const E2 = CutGL.EFFECTS[f.k] || { label: f.k, icon: '?' };
        body.append(H('div', { className: 'cs-fx' + (f.off ? ' off' : '') }, H('div', { className: 'cs-fxh' }, H('b', { textContent: E2.icon + ' ' + E2.label }), check('On', !f.off, v => { cm(); if (v) delete f.off; else f.off = true; ch(true); }), UI.btn('Remove', () => { cm(); L.splice(i, 1); if (!L.length) delete it.fx; ch(true); o.rebuildInspector(); })),
          ['mirror', 'mirror4', 'invert'].includes(f.k) && f.k !== 'invert' ? '' : slider('Amount', () => f.amt == null ? 60 : +f.amt, v => { f.amt = Math.round(v); }, 0, 100, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 60 }))); });
      const g = H('div', { className: 'cl-grid sm' }); Object.entries(CutGL.EFFECTS).forEach(([k, E2]) => g.append(H('button', { type: 'button', className: 'cl-tile', title: E2.label, disabled: L.some(x => x.k === k), on: { click: () => { cm(); it.fx = it.fx || []; it.fx.push({ k, amt: 60 }); ch(true); o.rebuildInspector(); } } }, H('i', { textContent: E2.icon }), H('span', { textContent: E2.label }))));
      body.append(sect('Add an effect', g));
    }
    function mask(body, c, it, m, ch, cm) {
      const M = it.mask || {}, set = (k, v) => { it.mask = Object.assign({ k: 'rect' }, it.mask || {}); it.mask[k] = v; };
      body.append(sect('Shape', chips(M.k || 'none', Object.entries(V().MASKS), v => { cm(); if (v === 'none') delete it.mask; else it.mask = Object.assign({ w: 0.6, h: 0.6, feather: 10 }, it.mask || {}, { k: v }); ch(true); o.rebuildInspector(); }, 'wrap')));
      if (M.k && M.k !== 'none') body.append(sect('Mask',
        slider('Left and right', () => Math.round((+M.x || 0) * 100), v => set('x', r3(v / 100)), -100, 100, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 0 }),
        slider('Up and down', () => Math.round((+M.y || 0) * 100), v => set('y', r3(v / 100)), -100, 100, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 0 }),
        M.k === 'line' ? '' : slider('Width', () => Math.round((M.w == null ? 0.6 : +M.w) * 100), v => set('w', r3(v / 100)), 2, 200, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 60 }),
        M.k === 'line' ? '' : slider('Height', () => Math.round((M.h == null ? 0.6 : +M.h) * 100), v => set('h', r3(v / 100)), 2, 200, 1, v => Math.round(v) + '%', { onChange: ch, commit: cm, reset: 60 }),
        slider('Rotate', () => +M.rot || 0, v => set('rot', Math.round(v)), -180, 180, 1, v => Math.round(v) + '°', { onChange: ch, commit: cm, reset: 0 }),
        slider('Soft edge', () => +M.feather || 0, v => set('feather', Math.round(v)), 0, 100, 1, v => Math.round(v), { onChange: ch, commit: cm, reset: 0 }),
        M.k === 'rect' ? slider('Round corners', () => +M.round || 0, v => set('round', Math.round(v)), 0, 100, 1, v => Math.round(v), { onChange: ch, commit: cm, reset: 0 }) : '',
        check('Invert (keep the outside)', !!M.inv, v => { cm(); set('inv', v); ch(true); })));
    }
    function key(body, c, it, m, ch, cm) {
      const K = it.key || {}, set = (k, v) => { it.key = Object.assign({ on: true, col: '#00ff00' }, it.key || {}); it.key[k] = v; };
      const colIn = H('input', { type: 'color', value: K.col || '#00ff00', 'aria-label': 'Colour to remove', on: { input: e => { set('col', e.target.value); ch(); }, change: () => cm() } });
      const pick = typeof EyeDropper !== 'undefined' ? UI.btn('Pick from the preview', async () => { try { const r = await new EyeDropper().open(); cm(); set('col', r.sRGBHex); set('on', true); ch(true); o.rebuildInspector(); } catch (e) { } }) : '';
      body.append(sect('Remove a colour (green screen)', check('On', !!K.on, v => { cm(); if (v) set('on', true); else if (it.key) it.key.on = false; ch(true); o.rebuildInspector(); }), H('div', { className: 'btnrow' }, colIn, pick, UI.btn('Green', () => { cm(); set('col', '#00b140'); set('on', true); ch(true); o.rebuildInspector(); }), UI.btn('Blue', () => { cm(); set('col', '#0047bb'); set('on', true); ch(true); o.rebuildInspector(); }))));
      if (K.on) body.append(sect('',
        slider('How much', () => K.sim == null ? 40 : +K.sim, v => set('sim', Math.round(v)), 0, 100, 1, v => Math.round(v), { onChange: ch, commit: cm, reset: 40 }),
        slider('Soft edge', () => K.smooth == null ? 20 : +K.smooth, v => set('smooth', Math.round(v)), 0, 100, 1, v => Math.round(v), { onChange: ch, commit: cm, reset: 20 }),
        slider('Take out the green glow', () => K.spill == null ? 50 : +K.spill, v => set('spill', Math.round(v)), 0, 100, 1, v => Math.round(v), { onChange: ch, commit: cm, reset: 50 })));
    }
    function audio(body, c, it, m, ch, cm, f) {
      const p = placed(c, it), k = (prop, get) => keyBtn(c, it, prop, get, ch);
      body.append(sect('Volume',
        slider('Volume', () => r2(valAt(c, it, 'vol', +it.vol || 0)), v => setAt(c, it, 'vol', r2(v)), -60, 20, 0.5, v => (v <= -59.9 ? 'off' : (v > 0 ? '+' : '') + r2(v) + ' dB'), { onChange: ch, commit: cm, reset: 0, key: k('vol', () => valAt(c, it, 'vol', +it.vol || 0)) }),
        check('Mute this clip', !!it.mute, v => { cm(); if (v) it.mute = true; else delete it.mute; ch(true); }),
        H('div', { className: 'btnrow' }, UI.btn('Normalise loudness', () => { const lv = m && m.level; if (!lv) { o.say('The sound is still being read. Try again in a moment.'); return; } cm(); const target = 0.18, db = 10 * Math.log10(target / Math.max(1e-4, lv)); it.vol = r2(cl(db, -30, 20)); ch(true); o.rebuildInspector(); o.say('Volume set to ' + (it.vol > 0 ? '+' : '') + it.vol + ' dB so it sits at a steady level.'); }))));
      body.append(sect('Fades',
        slider('Fade in', () => +it.fadeIn || 0, v => { if (v <= 0.001) delete it.fadeIn; else it.fadeIn = r2(v); }, 0, Math.min(10, p ? p.d : 10), 0.05, v => r2(v) + ' s', { onChange: ch, commit: cm, reset: 0 }),
        slider('Fade out', () => +it.fadeOut || 0, v => { if (v <= 0.001) delete it.fadeOut; else it.fadeOut = r2(v); }, 0, Math.min(10, p ? p.d : 10), 0.05, v => r2(v) + ' s', { onChange: ch, commit: cm, reset: 0 })));
      body.append(sect('Voice',
        slider('Enhance voice', () => it.enhance === true ? 100 : +it.enhance || 0, v => { if (v <= 0) delete it.enhance; else it.enhance = Math.round(v); }, 0, 100, 1, v => Math.round(v) ? Math.round(v) + '%' : 'off', { onChange: ch, commit: cm, reset: 0 }),
        slider('Reduce noise', () => it.denoise === true ? 60 : +it.denoise || 0, v => { if (v <= 0) delete it.denoise; else it.denoise = Math.round(v); }, 0, 100, 1, v => Math.round(v) ? Math.round(v) + '%' : 'off', { onChange: ch, commit: cm, reset: 0 }),
        H('p', { className: 'hint', textContent: 'Enhance makes a voice clearer and more even (cuts rumble and mud, adds presence, evens the level). Reduce noise quietens the hiss and hum between words.' })));
      if (f && f.track === 'main' && m && m.kind === 'video') body.append(sect('', UI.btn('Detach the sound onto its own track', () => ui.detachNow())));
      if (it.kind === 'audio') body.append(sect('', UI.btn('Replace the sound file…', () => ui.replacePick(it.id))));
    }
    function intro(body, c, it, m, ch, cm) {
      body.append(sect('', H('p', { className: 'hint', textContent: 'Your squid drops in, takes a traffic cone on the heid, PATTERSQUID slams in, the line below is stamped on, and a seagull nicks the cone. Five seconds, with its own sound.' }),
        UI.field('The stamp', UI.txt(it.text == null ? 'GET IT UP YE.' : it.text, v => { it.text = v.slice(0, 40); ch(); }, 'GET IT UP YE.', 'Stamp line')),
        chips(it.text == null ? 'GET IT UP YE.' : it.text, [['GET IT UP YE.', 'Get it up ye'], ['GONNAE NO.', 'Gonnae no'], ['AYE, RIGHT.', 'Aye, right'], ['PURE PATTER.', 'Pure patter'], ['', 'No stamp']], v => { cm(); it.text = v; ch(true); o.rebuildInspector(); }, 'wrap'),
        check('The seagull nicks the cone', it.gull !== false, v => { cm(); if (v) delete it.gull; else it.gull = false; ch(true); }),
        H('p', { className: 'hint', textContent: 'Drag its end on the timeline to cut it short. Put a transition after it to go into the video.' })));
    }
    // the intro's own settings, right here: the words (episode, pub, label), the bottle label, the sound, the hold.
    // Its sound is made again (a moment after the last change) so it always matches the words.
    let introTimer = 0;
    function title(body, c, it, m, ch, cm) { if (typeof Intro === 'undefined') return; it.cfg = Object.assign(Intro.defaults(), it.cfg || {}); let first = true;
      Intro.form(body, it.cfg, () => { if (first) { cm(); first = false; } ch(true); clearTimeout(introTimer); introTimer = setTimeout(() => { Intro.ensureSound(it.cfg).then(() => ch(true)).catch(() => { }); }, 700); }); }
    function clip(body, c, it, m, ch, cm) {
      const d = V().natural(it, look()), [a, e] = V().clipSpan(it, look());
      body.append(sect('', UI.field('Name on the timeline', UI.txt(it.name || '', v => { it.name = v; ch(); }, V().NAMES[it.mod], 'Clip name')),
        H('p', { className: 'hint', textContent: (V().NAMES[it.mod] || 'Clip') + ', ' + d.toFixed(1) + ' s long on its own. Showing ' + a.toFixed(1) + ' s to ' + e.toFixed(1) + ' s' + (it.hold ? ', then holding the last frame for ' + (+it.hold).toFixed(1) + ' s' : '') + '. Drag its ends on the timeline to trim it or hold it longer.' }),
        H('div', { className: 'cs-quick' }, H('span', { textContent: 'Speed' }), chips(V().curvePts(it) ? 'curve' : String(+it.speed || 1), [['0.5', '0.5x'], ['1', '1x'], ['1.5', '1.5x'], ['2', '2x'], ['3', '3x'], ...(V().curvePts(it) ? [['curve', 'Curve']] : [])], v => { if (v === 'curve') { ui.inspTab[it.id] = 'speed'; o.rebuildInspector(); return; } cm(); if (+v === 1) delete it.speed; else it.speed = +v; ch(true); o.rebuildInspector(); }), UI.btn('More…', () => { ui.inspTab[it.id] = 'speed'; o.rebuildInspector(); })),
        H('div', { className: 'btnrow' }, UI.btn('Edit this clip in the ' + (V().NAMES[it.mod] || '') + ' tab', () => o.openItem(it.id), 'primary')),
        H('p', { className: 'hint', textContent: 'This clip is its own copy, made when you added it, so changes in the ' + (V().NAMES[it.mod] || '') + ' tab since then are not in it. Edit it with the button above (double click it on the timeline does the same), or bring in what the tab has now.' }),
        H('div', { className: 'btnrow' }, UI.btn('Use what\u2019s in the ' + (V().NAMES[it.mod] || '') + ' tab now', () => { const src = o.tabCfg(it.mod); if (!src) return; cm(); it.cfg = JSON.parse(JSON.stringify(src)); if (!V().runsOn(it)) { const [a2, , d2] = V().clipSpan(it, look()); if (it.outPt != null && +it.outPt > d2) delete it.outPt; if (a2 >= d2 - 0.2) it.inPt = 0; } ch(true); o.rebuildInspector(); o.say('The clip now has what\u2019s in the ' + (V().NAMES[it.mod] || '') + ' tab, keeping its place, trims and effects.'); }))));
    }
    function avatar(body, c, it, m, ch, cm, f) {
      fadeSect(body, c, it, f || { track: 'main' }, ch, cm);
      body.append(sect('', UI.field('What you say here (preview only)', UI.area(it.text, v => { it.text = v; ch(false); }, 'Your line to camera', 3, 'Avatar line')),
        slider('Length', () => +it.dur || 3, v => { it.dur = r2(v); }, 0.3, 120, 0.1, v => r2(v) + ' s', { onChange: ch, commit: cm }),
        H('div', { className: 'btnrow' }, UI.btn('Fit the length to the words', () => { cm(); it.dur = V().fitWords(it.text); ch(true); o.rebuildInspector(); })),
        UI.field('Start your avatar video at (seconds; blank carries on from the last time you were on)', UI.txt(it.avIn == null ? '' : String(it.avIn), v => { const n = parseFloat(v); if (v.trim() === '') delete it.avIn; else if (isFinite(n)) it.avIn = r2(Math.max(0, n)); ch(); }, 'carry on', 'Avatar start')),
        H('p', { className: 'hint', textContent: 'This shows your studio with your avatar talking. ' + (c.studio ? 'This video keeps its own copy of the studio.' : 'It follows the Animator tab, so change the weather or the flats outside there.') }),
        H('div', { className: 'btnrow' }, c.studio ? UI.btn('Follow the Animator tab again', () => { cm(); delete c.studio; ch(true); o.rebuildInspector(); }) : UI.btn('Keep a copy of the studio as it is now', () => { cm(); c.studio = JSON.parse(JSON.stringify(Video.hooks.studio ? Video.hooks.studio() : o.tabCfg('studio'))); ch(true); o.rebuildInspector(); }))));
    }
    function colour(body, c, it, m, ch, cm) { if (typeof it.col === 'string') { it.fill = it.col; delete it.col; } body.append(sect('Card', H('input', { type: 'color', value: it.fill || '#000000', 'aria-label': 'Card colour', on: { input: e => { it.fill = e.target.value; ch(); }, change: () => cm() } }), slider('Length', () => +it.dur || 3, v => { it.dur = r2(v); }, 0.1, 600, 0.1, v => r2(v) + ' s', { onChange: ch, commit: cm }))); }

    /* ---------- A transition ---------- */
    function transPanel(root, c, itemId, changed) {
      const f = V().findItem(c, itemId); if (!f || f.track !== 'main') return; const it = f.it, next = c.items[f.i + 1], tr = it.tr || {}, max = next ? V().TRMAX(it, next, look()) : 0.5;
      const T0 = V().TRANS, order = ['none', ...V().PRO.filter(k => T0[k]), ...Object.keys(T0).filter(k => k !== 'none' && k !== 'punchOut' && !V().PRO.includes(k)), ...(tr.k === 'punchOut' ? ['punchOut'] : [])], g = H('div', { className: 'cl-grid sm' }); order.map(k => [k, T0[k]]).forEach(([k, l]) => g.append(H('button', { type: 'button', className: 'cl-tile tr' + ((tr.k || 'none') === k ? ' on' : ''), title: l, on: { click: () => { o.commit(); if (k === 'none') delete it.tr; else it.tr = { k, d: Math.min((V().TRLEN || {})[k] || tr.d || 0.5, max) }; changed(true); o.rebuildInspector(); } } }, k === 'none' ? H('i', { textContent: '∅' }) : (() => { const cv = H('canvas', { width: 96, height: 54 }), A = H('canvas', { width: 96, height: 54 }), B = H('canvas', { width: 96, height: 54 }); A.getContext('2d').fillStyle = '#2f6fb5'; A.getContext('2d').fillRect(0, 0, 96, 54); B.getContext('2d').fillStyle = '#e3302c'; B.getContext('2d').fillRect(0, 0, 96, 54); try { V().transition(cv.getContext('2d'), A, B, k, 0.45, 96, 54); } catch (e) { } return cv; })(), H('span', { textContent: l }))));
      root.append(H('section', { className: 'card cs' }, H('div', { className: 'cs-head' }, H('b', { textContent: 'Transition' }), H('span', { className: 'cs-time', textContent: 'between ' + V().NAME(it) + ' and ' + (next ? V().NAME(next) : 'the end') })),
        H('div', { className: 'cs-body' }, sect('', g), it.tr ? sect('', slider('Length', () => +it.tr.d || 0.5, v => { it.tr.d = r2(v); }, 0.1, Math.max(0.15, Math.min(3, max)), 0.05, v => r2(v) + ' s', { onChange: () => changed(), commit: () => o.commit() }),
          H('p', { className: 'hint', textContent: 'A transition overlaps the two clips, so the video gets a little shorter. Its longest is half the shorter clip.' }),
          H('div', { className: 'btnrow' }, UI.btn('Use on every cut', () => { o.commit(); const L = c.items; L.forEach((x, i) => { if (i < L.length - 1) x.tr = { k: it.tr.k, d: it.tr.d }; }); changed(true); o.say('Transition put on every cut.'); }), UI.btn('Remove', () => { o.commit(); delete it.tr; changed(true); o.rebuildInspector(); }))) : '')));
    }
    /* ---------- A track ---------- */
    function trackPanel(root, c, tid, changed) {
      if (tid === 'main') { root.append(H('section', { className: 'card cs' }, H('div', { className: 'cs-head' }, H('b', { textContent: 'Main track' })), H('div', { className: 'cs-body' },
          slider('Volume', () => +c.mainVol || 0, v => { if (Math.abs(v) < 0.01) delete c.mainVol; else c.mainVol = r2(v); }, -60, 20, 0.5, v => (v > 0 ? '+' : '') + r2(v) + ' dB', { onChange: () => changed(), commit: () => o.commit(), reset: 0 }),
          check('This is talking (music on tracks set to lower under talking dips under it)', c.mainTalk !== false, v => { o.commit(); if (v) delete c.mainTalk; else c.mainTalk = false; changed(true); }),
          check('Hide', !!c.mainHide, v => { o.commit(); c.mainHide = v; changed(true); }), check('Mute', !!c.mainMute, v => { o.commit(); c.mainMute = v; changed(true); }), check('Solo', !!c.mainSolo, v => { o.commit(); c.mainSolo = v; changed(true); }), check('Lock', !!c.mainLock, v => { o.commit(); c.mainLock = v; changed(true); }))));
        return; }
      const T = (c.tracks || []).find(x => x.id === tid); if (!T) return;
      const body = H('div', { className: 'cs-body' }, UI.field('Name', UI.txt(T.name || '', v => { T.name = v; changed(); }, T.kind === 'audio' ? 'Audio' : 'Overlay', 'Track name')));
      if (T.kind === 'audio') body.append(slider('Volume', () => +T.vol || 0, v => { if (Math.abs(v) < 0.01) delete T.vol; else T.vol = r2(v); }, -60, 20, 0.5, v => (v > 0 ? '+' : '') + r2(v) + ' dB', { onChange: () => changed(), commit: () => o.commit(), reset: 0 }),
        check('Lower this under talking (auto ducking, for music)', !!T.duck, v => { o.commit(); T.duck = v; if (v) T.talk = false; changed(true); o.rebuildInspector(); }),
        T.duck ? slider('Lower by', () => c.duckDb == null ? 12 : +c.duckDb, v => { c.duckDb = Math.round(v); }, 3, 30, 1, v => Math.round(v) + ' dB', { onChange: () => changed(), commit: () => o.commit(), reset: 12 }) : '',
        check('This is talking (voiceover)', !!T.talk, v => { o.commit(); T.talk = v; if (v) T.duck = false; changed(true); o.rebuildInspector(); }), check('Solo', !!T.solo, v => { o.commit(); T.solo = v; changed(true); }));
      body.append(check('Mute', !!T.mute, v => { o.commit(); T.mute = v; changed(true); }), T.kind === 'video' ? check('Hide', !!T.hide, v => { o.commit(); T.hide = v; changed(true); }) : '', check('Lock', !!T.lock, v => { o.commit(); T.lock = v; changed(true); }),
        H('div', { className: 'btnrow' }, UI.btn('Move up', () => { o.commit(); const L = c.tracks, i = L.indexOf(T), j = T.kind === 'video' ? i + 1 : i - 1; if (j >= 0 && j < L.length && L[j].kind === T.kind) { [L[i], L[j]] = [L[j], L[i]]; changed(true); } }), UI.btn('Move down', () => { o.commit(); const L = c.tracks, i = L.indexOf(T), j = T.kind === 'video' ? i - 1 : i + 1; if (j >= 0 && j < L.length && L[j].kind === T.kind) { [L[i], L[j]] = [L[j], L[i]]; changed(true); } }),
          UI.btn('Delete track', () => { if ((T.items || []).length && !confirm('Delete this track and the ' + T.items.length + ' clips on it?')) return; o.commit(); c.tracks = c.tracks.filter(x => x !== T); changed(true); o.ed.select(null); })));
      root.append(H('section', { className: 'card cs' }, H('div', { className: 'cs-head' }, H('b', { textContent: (T.kind === 'audio' ? 'Audio track: ' : 'Overlay track: ') + (T.name || '') })), body));
    }

    /* ---------- The project, when nothing is selected ---------- */
    function scene(root, c, changed) {
      const lk = look(), dur = Layers.wrap(Video).duration(c, lk), n = V().allPlaced(c, lk).length;
      const body = H('div', { className: 'cs-body' },
        sect('Frame', chips(lk.format, [['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts and Reels']], v => o.setLook('format', v))),
        sect('Background where a clip doesn\'t fill the frame', chips(c.bg || 'black', [['black', 'Black'], ['blur', 'Blurred copy of the clip'], ['white', 'White']], v => { o.commit(); c.bg = v; changed(true); o.rebuildInspector(); })),
        sect('Patter clips colour scheme', chips(lk.scheme, Object.entries(E.SCHEMES).map(([k, s]) => [k, s.name]), v => o.setLook('scheme', v), 'wrap')),
        sect('Where you talk to camera', H('p', { className: 'hint', textContent: 'The \u201cYou in the studio\u201d clips show your studio with your avatar, carrying on from one to the next. ' + (c.studio ? 'This video keeps its own copy of the studio.' : 'They follow the Animator tab.') }),
          H('div', { className: 'btnrow' }, c.studio ? UI.btn('Follow the Animator tab again', () => { o.commit(); delete c.studio; changed(true); o.rebuildInspector(); }) : UI.btn('Keep a copy of the studio as it is now', () => { o.commit(); c.studio = JSON.parse(JSON.stringify(Video.hooks.studio ? Video.hooks.studio() : o.tabCfg('studio'))); changed(true); o.rebuildInspector(); }))),
        sect('Your video', H('p', { className: 'hint', textContent: ui.short(dur) + ' long, ' + n + ' clips, ' + (c.tracks || []).length + ' extra tracks.' }),
          (c.markers || []).length ? H('div', { className: 'cs-marks' }, ...(c.markers || []).map(mk => H('button', { type: 'button', textContent: '▾ ' + ui.tc(mk.t) + (mk.label ? ' ' + mk.label : ''), on: { click: () => { o.player.pause(); o.player.seek(mk.t); ui.setTime(mk.t); } } }))) : '',
          H('div', { className: 'btnrow' }, UI.btn('+ Video track', () => { o.commit(); c.tracks = c.tracks || []; c.tracks.push({ id: V().nid('t'), kind: 'video', name: 'Overlay ' + (V().tracksOf(c, 'video').length + 1), items: [], keep: true }); changed(true); }), UI.btn('+ Audio track', () => { o.commit(); c.tracks = c.tracks || []; c.tracks.push({ id: V().nid('t'), kind: 'audio', name: 'Audio ' + (V().tracksOf(c, 'audio').length + 1), items: [], keep: true }); changed(true); }))),
        sect('Shortcuts', H('p', { className: 'hint', textContent: 'Space play. S or Ctrl+B split. Delete removes, Shift+Delete closes the gap. Q and W trim the start or end to the playhead. Up and Down jump between cuts. F freezes a frame. M adds a marker. Ctrl+C and Ctrl+V copy and paste clips. Ctrl + wheel zooms the timeline. Drag files from your computer straight in.' })));
      root.append(H('section', { className: 'card cs' }, H('div', { className: 'cs-head' }, H('b', { textContent: 'Project' })), body));
    }

    /* ---------- Export window ---------- */
    let exporting = null;
    function exportDialog(only) {
      if (exporting) return; const c = only || o.getCfg(), lk = look(), dlg = document.getElementById('dlg'), r = o.getRange && o.getRange();
      const st = Object.assign({ res: '1080', fps: 30, quality: 'high', kind: 'mp4', audio: true, wav: false, range: false, blur: 'smart' }, o.exportPrefs || {});
      const name = H('input', { type: 'text', value: o.fileBase(), 'aria-label': 'File name' });
      const row = (l, ctrl) => H('label', { className: 'field' }, H('span', { className: 'lab', textContent: l }), ctrl);
      const status = H('p', { className: 'hint', 'aria-live': 'polite' }), barI = H('i', {}), bar = H('div', { className: 'bar' }, barI);
      const go = H('button', { type: 'button', className: 'primary', textContent: 'Export' }), cancel = H('button', { type: 'button', textContent: 'Close' });
      const sound = CutAudio.hasSound(c, lk);
      const body = H('div', { className: 'cx' },
        H('h2', { textContent: 'Export' }),
        row('Name', name),
        H('div', { className: 'grid2' },
          row('What to make', UI.sel(st.kind, [['mp4', 'MP4 video with sound'], ['png', 'PNG sequence (see through)'], ['wav', 'Just the sound (WAV)']], v => { st.kind = v; })),
          row('Resolution', UI.sel(st.res, [['720', '720p'], ['1080', '1080p (YouTube)'], ['1440', '1440p (2K)'], ['2160', '2160p (4K)']], v => { st.res = v; })),
          row('Frame rate', UI.sel(String(st.fps), [['24', '24 fps (film)'], ['25', '25 fps (UK TV)'], ['30', '30 fps'], ['50', '50 fps'], ['60', '60 fps (smooth)']], v => { st.fps = +v; })),
          row('Quality', UI.sel(st.quality, [['normal', 'Good (smaller file)'], ['high', 'High (recommended)'], ['master', 'Master (for After Effects)']], v => { st.quality = v; }))),
        H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: st.audio && sound, disabled: !sound, on: { change: e => { st.audio = e.target.checked; } } }), sound ? ' Include the sound' : ' (No sound in this video)'),
        H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: st.wav, disabled: !sound, on: { change: e => { st.wav = e.target.checked; } } }), ' Also save the sound as a WAV (for After Effects)'),
        H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: st.blur !== 'off', on: { change: e => { st.blur = e.target.checked ? 'smart' : 'off'; } } }), ' Motion blur on fast moving Patter clips'),
        r ? H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: st.range, on: { change: e => { st.range = e.target.checked; } } }), ' Only from the in point to the out point (' + r[0].toFixed(1) + ' s to ' + r[1].toFixed(1) + ' s)') : '',
        bar, status, H('div', { className: 'btnrow' }, go, cancel));
      dlg.innerHTML = ''; dlg.append(body); dlg.showModal();
      let abort = null;
      cancel.addEventListener('click', () => { if (abort) abort.abort(); else dlg.close(); });
      go.addEventListener('click', async () => {
        o.exportPrefs = Object.assign({}, st); const base = (name.value || 'video').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'video';
        const lookX = JSON.parse(JSON.stringify(lk)); lookX.transparent = st.kind === 'png'; const cc = JSON.parse(JSON.stringify(c)), range = st.range && r ? r : null;
        let sink = null, wavSink = null, dir = null, handle = null;
        try {
          // Choose where it goes first, so it can be written as it renders
          if (st.kind === 'png') { if (window.showDirectoryPicker) { status.textContent = 'Choose an empty folder for the frames.'; try { dir = await showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { if (e.name === 'AbortError') { status.textContent = ''; return; } } } }
          else if (window.showSaveFilePicker) { try { handle = await showSaveFilePicker({ suggestedName: base + (st.kind === 'wav' ? '.wav' : '.mp4'), types: st.kind === 'wav' ? [{ description: 'WAV sound', accept: { 'audio/wav': ['.wav'] } }] : [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }] }); } catch (e) { if (e.name === 'AbortError') return; } }
          if (handle) { const w = await handle.createWritable(); if (st.kind === 'wav') wavSink = MP4Out.fileSink(w); else sink = MP4Out.fileSink(w); }
          if (st.wav && st.kind !== 'wav' && window.showSaveFilePicker) { try { const h2 = await showSaveFilePicker({ suggestedName: base + '.wav', types: [{ description: 'WAV sound', accept: { 'audio/wav': ['.wav'] } }] }); wavSink = MP4Out.fileSink(await h2.createWritable()); } catch (e) { } }
          if (st.wav && !wavSink && st.kind !== 'wav') wavSink = MP4Out.blobSink();
          abort = new AbortController(); go.disabled = true; cancel.textContent = 'Cancel'; exporting = abort; o.onExport && o.onExport(true);
          const onProgress = (p, msg) => { barI.style.width = (p * 100).toFixed(1) + '%'; status.textContent = msg || ''; };
          const t0 = performance.now();
          if (st.kind === 'wav') { const dur = Layers.wrap(Video).duration(cc, lookX), blob = await CutExport.wavOnly(cc, lookX, range ? range[0] : 0, range ? range[1] : dur, { wavSink: wavSink || MP4Out.blobSink(), onProgress, signal: abort.signal }); if (blob) await E.saveBlob(blob, base + '.wav', [{ description: 'WAV sound', accept: { 'audio/wav': ['.wav'] } }]); status.textContent = 'Done. The sound is saved.'; }
          else {
            const res = await CutExport.run(cc, lookX, { fps: st.fps, res: st.res, quality: st.quality, audio: st.audio, wav: st.wav, png: st.kind === 'png', dir, sink, wavSink, range, blur: st.blur, signal: abort.signal, onProgress });
            if (st.kind === 'png') { if (res.zip) await E.saveBlob(res.zip, base + '-frames.zip', [{ description: 'Zip file', accept: { 'application/zip': ['.zip'] } }]); if (res.wav) await E.saveBlob(res.wav, base + '.wav', [{ description: 'WAV sound', accept: { 'audio/wav': ['.wav'] } }]); status.textContent = 'Done: ' + res.frames + ' frames. In After Effects, import the first frame and tick PNG Sequence.'; }
            else { if (res.blob) await E.saveBlob(res.blob, base + '.mp4', [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }]); if (res.wavBlob) await E.saveBlob(res.wavBlob, base + '.wav', [{ description: 'WAV sound', accept: { 'audio/wav': ['.wav'] } }]);
              const secs = Math.round((performance.now() - t0) / 1000), fam = { avc: 'H.264', hevc: 'HEVC', vp9: 'VP9', av1: 'AV1' }[res.fam] || res.codec, aud = res.audio ? (res.audio === 'opus' ? ' with Opus sound' : ' with AAC sound') : ' (no sound)';
              status.textContent = `Done in ${secs < 90 ? secs + ' s' : Math.round(secs / 6) / 10 + ' min'}: ${res.W} x ${res.H}, ${fam}${aud}, ${(res.bytes / 1e6).toFixed(1)} MB.` + (res.fam !== 'avc' ? ' (H.264 wasn\'t available, so ' + fam + ' was used.)' : '') + (res.audio === 'opus' ? ' AAC sound wasn\'t available on this computer, so the sound is Opus; tick the WAV option for After Effects.' : ''); }
            barI.style.width = '100%';
            // Where the time went, for Claude to see what could be faster
            const rpt = CutExport.report && CutExport.report(); if (rpt) { const old = status.parentNode && status.parentNode.querySelector('.exp-report'); if (old) old.remove();
              const rb = H('button', { type: 'button', className: 'exp-report', textContent: 'Copy the export report', title: 'Where the time went, to paste to Claude', on: { click: async () => { try { await navigator.clipboard.writeText(rpt); rb.textContent = 'Copied: paste it to Claude'; } catch (e) { const ta = H('textarea', { value: rpt, rows: 10, style: 'width:100%' }); rb.after(ta); ta.select(); } } } }); status.after(rb); }
          }
        } catch (e) { status.textContent = e.message || String(e); status.classList.add('err'); try { sink && sink.close && await sink.close(); } catch (e2) { } }
        go.disabled = false; cancel.textContent = 'Close'; exporting = null; abort = null; o.onExport && o.onExport(false);
      });
    }
    return { inspect, scene, exportDialog, get exporting() { return !!exporting; } };
  }
  return { create };
})();

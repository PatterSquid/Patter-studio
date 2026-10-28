/* Pictogram module: rows of people icons, coloured groups by percentage. */
const Picto = (() => {
  const { cl, ease, spring, fd, fl } = E;
  function defaults() {
    return { title: '1 in 5 Scots skip breakfast', total: 100, order: 'reading', legend: true, hold: 2, iconColour: 'white',
      groups: [{ colour: 'Irn-Bru orange', pct: 20, label: 'Skip breakfast' }, { colour: 'Grass green', pct: 35, label: 'Eat cereal' }] };
  }
  let ck = '', cp = null;
  function plan(cfg, look, W, H) {
    const key = JSON.stringify(cfg) + look.format + (E.fontVersion || 0); if (key === ck) return cp;
    const u = Math.min(W, H) / 1080, tall = H > W, N = cfg.total, G = cfg.groups.map(g => ({ col: E.COLOURS[g.colour] || '#f5821f', pct: cl(+g.pct || 0, 0, 100), label: g.label || '' }));
    let tot = 0; G.forEach(g => { g.pct = Math.min(g.pct, 100 - tot); tot += g.pct; g.n = Math.round(g.pct / 100 * N); });
    let used = G.reduce((a, g) => a + g.n, 0); while (used > N) { const g = G.reduce((a, b) => b.n > a.n ? b : a); g.n--; used--; }
    const headH = H * (tall ? 0.13 : 0.17), legH = cfg.legend && G.some(g => g.n) ? H * (tall ? 0.16 : 0.15) : H * 0.04, pad = W * 0.05;
    const aw = W - pad * 2, ah = H - headH - legH - pad * 0.5;
    let best = null; for (let cols = 1; cols <= N; cols++) { const rows = Math.ceil(N / cols), s = Math.min(aw / cols, ah / (rows * 1.16)); if (!best || s > best.s) best = { cols, rows, s }; }
    const { cols, rows, s } = best, gw = cols * s, gh = rows * s * 1.16, ox = (W - gw) / 2 + s / 2, oy = headH + (ah - gh) / 2 + s * 0.6;
    const order = [...Array(N).keys()];
    if (cfg.order === 'random') { const r = E.rng(11); for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } }
    const asg = new Array(N).fill(-1), rank = new Array(N).fill(0); let k = 0;
    G.forEach((g, gi) => { for (let j = 0; j < g.n; j++) { asg[order[k]] = gi; rank[order[k]] = j; k++; } });
    const waveK = 0.9 / Math.max(1, cols + rows), starts = []; let tt = 1.3;
    const gf = []; G.forEach((g, i) => { starts.push(tt); const base = g.n ? Math.min(1.0, g.n * 0.035) + 0.75 : 0, auto = base + (g.n ? Math.max(0, +(cfg.groups[i] || {}).wait || 0) : 0), L = E.tm(cfg, 'grp:' + i) ?? auto; gf.push(base ? Math.min(1, L / base) : 1); tt += g.n ? L : 0; });
    const end = tt + 0.2, dur = end + (+cfg.hold || 0) + 0.3, base = cfg.iconColour === 'grey' ? '#c9c3b4' : '#ffffff';
    cp = { u, tall, N, G, cols, rows, s, ox, oy, asg, rank, waveK, starts, gf, end, dur, headH, legH, pad, base }; ck = key; return cp;
  }
  const duration = (cfg, look) => { const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; };
  function person(ctx, s, fill, C, lit) {
    const lw = Math.max(1, s * 0.07);
    const body = () => { ctx.beginPath(); ctx.moveTo(-s * 0.34, s * 0.46); ctx.lineTo(-s * 0.34, s * 0.18); ctx.quadraticCurveTo(-s * 0.34, -s * 0.06, -s * 0.1, -s * 0.06); ctx.lineTo(s * 0.1, -s * 0.06); ctx.quadraticCurveTo(s * 0.34, -s * 0.06, s * 0.34, s * 0.18); ctx.lineTo(s * 0.34, s * 0.46); ctx.closePath(); };
    const head = () => { ctx.beginPath(); ctx.arc(0, -s * 0.27, s * 0.17, 0, 7); };
    ctx.save(); ctx.translate(lw * 1.3, lw * 1.3); ctx.fillStyle = C.shadow; body(); ctx.fill(); head(); ctx.fill(); ctx.restore();
    ctx.fillStyle = fill; ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; body(); ctx.fill(); ctx.stroke(); head(); ctx.fill(); ctx.stroke();
    if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(-s * 0.06, -s * 0.32, s * 0.05, 0, 7); ctx.fill(); }
  }
  function draw(ctx, t, cfg, look, W, H) {
    const p = plan(cfg, look, W, H), C = E.palette(look), u = p.u, z = 1 + 0.035 * ease.sine(t / p.dur);
    ctx.save(); E.camera(ctx, W, H, W / 2, H / 2 + p.headH * 0.1, z, t, u); E.drawBg(ctx, C, look, W, H);
    const vis = p.G.map(g => g.n > 0);
    for (let i = 0; i < p.N; i++) {
      const col = i % p.cols, row = Math.floor(i / p.cols), x = p.ox + col * p.s, y = p.oy + row * p.s * 1.16, ap = spring((t - 0.2 - (col + row) * p.waveK) * 1.25);
      if (ap <= 0) continue;
      let fill = p.base, lit = false, sc = ap; const g = p.asg[i];
      if (g >= 0) { const G = p.G[g], dur = Math.min(1.0, G.n * 0.035) * p.gf[g], st = p.starts[g] + (G.n > 1 ? p.rank[i] / (G.n - 1) : 0) * dur, lp = t - st; if (lp > 0) { fill = G.col; lit = true; sc *= 1 + Math.sin(cl(lp / 0.28, 0, 1) * Math.PI) * 0.3; } }
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); person(ctx, p.s * 0.9, fill, C, lit); ctx.restore();
    }
    ctx.restore();
    // Legend (screen space)
    if (cfg.legend) {
      const items = p.G.map((g, i) => ({ g, i })).filter(o => o.g.n > 0), fs = (p.tall ? 34 : 30) * u;
      if (items.length) {
        ctx.font = fd(fs); const ws = items.map(o => ctx.measureText(o.g.pct + '% ' + o.g.label.toUpperCase()).width + fs * 2.3);
        const gap = fs * 0.6, rowsL = []; let cur = [], cw = 0, maxW = W - p.pad * 2;
        items.forEach((o, k) => { if (cur.length && cw + ws[k] > maxW) { rowsL.push(cur); cur = []; cw = 0; } cur.push(k); cw += ws[k] + gap; }); if (cur.length) rowsL.push(cur);
        const lineH = fs * 2.0, y0 = H - p.legH / 2 - (rowsL.length - 1) * lineH / 2;
        rowsL.forEach((r, ri) => {
          const tw = r.reduce((a, k) => a + ws[k] + gap, -gap); let x = (W - tw) / 2; const y = y0 + ri * lineH;
          r.forEach(k => { const o = items[k], w = ws[k], st = p.starts[o.i], sp = spring((t - st + 0.05) * 1.2, 6.5, 9);
            if (sp > 0) { const prog = ease.io4((t - st) / (Math.min(1.0, o.g.n * 0.035) + 0.2)), txt = Math.round(o.g.pct * prog) + '% ' + o.g.label.toUpperCase();
              ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate((k % 2 ? 1.5 : -1.5) * Math.PI / 180); ctx.scale(0.5 + 0.5 * sp, 0.5 + 0.5 * sp); const bh = fs * 1.55;
              ctx.fillStyle = C.shadow; ctx.fillRect(-w / 2 + 5 * u, -bh / 2 + 5 * u, w, bh); ctx.fillStyle = C.paper; ctx.fillRect(-w / 2, -bh / 2, w, bh); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(-w / 2, -bh / 2, w, bh);
              ctx.fillStyle = o.g.col; ctx.fillRect(-w / 2 + fs * 0.45, -fs * 0.42, fs * 0.84, fs * 0.84); ctx.strokeRect(-w / 2 + fs * 0.45, -fs * 0.42, fs * 0.84, fs * 0.84);
              ctx.font = fd(fs); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, -w / 2 + fs * 1.6, fs * 0.04); ctx.restore(); }
            x += w + gap; });
        });
      }
    }
    E.title(ctx, cfg.title, t, W, H, C, u, p.headH * 0.5); E.fadeIn(ctx, t, W, H, C, look);
  }
  function form(root, cfg, changed) {
    const { H, field, sel, txt, card, grid2, colourOpts, btn, iconBtn } = UI; root.innerHTML = '';
    const re = () => form(root, cfg, changed), set = (k, v, r) => { cfg[k] = v; changed(); if (r) re(); };
    const msg = H('span', { className: 'hint', style: 'color:#ff8a80' });
    const check = () => { const t = cfg.groups.reduce((a, g) => a + (+g.pct || 0), 0); msg.textContent = t > 100 ? `Your groups add up to ${t}%. Anything over 100% is trimmed from the last group.` : ''; };
    const rows = H('div', { className: 'ms' });
    cfg.groups.forEach((g, i) => rows.append(H('div', { className: 'msrow', style: 'grid-template-columns:118px 64px minmax(0,1fr) 34px' },
      sel(g.colour, colourOpts(), v => { g.colour = v; changed(); }, 'Group colour'),
      H('input', { type: 'text', inputMode: 'decimal', value: g.pct, 'aria-label': 'Percent', on: { input: e => { const v = parseFloat(e.target.value); g.pct = isFinite(v) ? Math.max(0, Math.min(100, v)) : 0; changed(); check(); } } }),
      txt(g.label, v => { g.label = v; changed(); }, 'Label', 'Group label'),
      iconBtn('×', 'Remove group', () => { cfg.groups.splice(i, 1); changed(); re(); }))));
    check();
    root.append(
      card('Pictogram', field('Title', txt(cfg.title, v => set('title', v), 'Shown in the red banner')),
        grid2(field('Number of people', sel(cfg.total, [10, 20, 25, 50, 100, 200].map(n => [n, n + ' people']), v => set('total', +v))), field('Icon colour', sel(cfg.iconColour, [['white', 'White'], ['grey', 'Light grey']], v => set('iconColour', v))))),
      card('Coloured groups', H('p', { className: 'hint' }, 'Up to five. Whatever is left over stays white.'), H('div', { className: 'rowhead', style: 'grid-template-columns:118px 64px minmax(0,1fr) 34px' }, H('span', {}, 'Colour'), H('span', {}, '%'), H('span', {}, 'Label'), H('span')), rows, msg,
        cfg.groups.length < 5 ? btn('Add group', () => { cfg.groups.push({ colour: Object.keys(E.COLOURS)[cfg.groups.length % 7], pct: 10, label: '' }); changed(); re(); }) : ''),
      card('Style', grid2(field('Fill order', sel(cfg.order, [['reading', 'Row by row'], ['random', 'Scattered']], v => set('order', v))), field('Legend', sel(cfg.legend ? '1' : '0', [['1', 'Show'], ['0', 'Hide']], v => set('legend', v === '1')))),
        field('Hold at the end', sel(String(cfg.hold), [['0', 'None'], ['1', '1 second'], ['2', '2 seconds'], ['3', '3 seconds'], ['5', '5 seconds']], v => set('hold', +v)))));
  }
  const holdUpd = (cfg, ch) => { cfg.hold = Math.max(0, Math.min(10, Math.round((ch.end - ch.start) * 2) / 2)); };
  const holdClip = (a, b) => ({ id: 'hold', start: a, end: b, label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' });
  const editor = { formIsScene: true,
    tracks(cfg, look) { const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), items = p.G.map((g, i) => ({ id: 'grp:' + i, start: p.starts[i], end: p.starts[i + 1] ?? p.end - 0.2, label: (g.label || 'Group ' + (i + 1)) + ' ' + g.pct + '%', colour: E.hexMix(g.col, '#16213a', 0.45), move: false, trim: 'end', minLen: 0.3, maxLen: 60, timed: true, title: 'Drag the right edge to slow this group down or speed it up' }));
      return [{ id: 'groups', name: 'Groups', items }, { id: 'end', name: 'End', items: [holdClip(p.end, p.end + (+cfg.hold || 0))] }]; },
    update(cfg, id, ch) { if (id === 'hold') return holdUpd(cfg, ch); E.setTm(cfg, id, ch.end - ch.start); },
    resetTiming(cfg, id) { const g = id.startsWith('grp:') && cfg.groups[+id.split(':')[1]]; if (g) g.wait = 0; },
    scene(root, cfg, changed) { form(root, cfg, changed); } };
  return { id: 'picto', name: 'Pictogram', defaults, duration, draw, form, editor };
})();

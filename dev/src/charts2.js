/* The chart kit: every kind of chart the Charts tab makes apart from the two classic ones (which stay in charts.js exactly
   as they were, so charts in finished videos never change). One table of data (a label column, then a column of numbers per
   series), three looks (sleek dark, clean light, cartoon) and eleven kinds: bars, bars sideways, grouped, stacked, lines,
   area, pie, donut, a bar race, big numbers and percent bars. Everything is a pure function of time. */
const ChartKit = (() => {
  const { cl, lerp, ease, spring, fd, fl } = E;
  const NF = {}, nf = (lo, hi) => { hi = Math.max(lo, Math.min(20, hi)); const k = lo + '|' + hi; return NF[k] || (NF[k] = new Intl.NumberFormat('en-GB', { minimumFractionDigits: lo, maximumFractionDigits: hi })); };
  const PAL = ['Irn-Bru orange', 'Saltire blue', 'Grass green', 'Sunshine yellow', 'Thistle purple', 'Sky teal', 'Neon red'];
  const SPEED = { slow: 1.45, normal: 1, fast: 0.66 };
  /* What each kind is, and what it wants typed in (shown under the table, so there is never a guess about what goes where).
     many: it draws every number column; time: the columns are moments in time; axis: it has a scale to read off. */
  const TYPES = {
    bar: { name: 'Bars', tile: 'Bars', axis: 1, what: 'One row for each bar: its name, then its number.' },
    hbar: { name: 'Bars sideways', tile: 'Sideways', what: 'One row for each bar. Best for a league table: sort it biggest first.' },
    grouped: { name: 'Grouped bars', tile: 'Grouped', many: 1, axis: 1, what: 'One row for each group, one column for each thing you are comparing (say this year and last year).' },
    stacked: { name: 'Stacked bars', tile: 'Stacked', many: 1, axis: 1, what: 'One row for each bar, one column for each slice of it. The slices stack to the total.' },
    line: { name: 'Lines', many: 1, axis: 1, what: 'One row for each point in time, one column for each line.' },
    area: { name: 'Area', many: 1, axis: 1, what: 'Like lines, filled in underneath. One row for each point in time, one column for each area.' },
    pie: { name: 'Pie', what: 'One row for each slice. Type the amounts: the percentages are worked out for you.' },
    donut: { name: 'Donut', what: 'One row for each slice, with the total (or the biggest slice) in the middle.' },
    race: { name: 'Bar race', many: 1, time: 1, what: 'One row for each runner, one column for each moment in time (years, months). The bars overtake each other as time passes.' },
    number: { name: 'Big number', tile: 'Big number', what: 'One row for each big number (up to four). Add a second column with the figure before and it shows the change.' },
    percent: { name: 'Percent bars', tile: 'Percent', what: 'One row for each bar, with a number out of 100 (or out of whatever you set).' },
  };
  const EXAMPLES = {
    bar: { title: 'Pints sunk on a night out', sub: '', source: 'Source: a straw poll down the pub', suffix: '', prefix: '', series: [{ name: 'Pints', colour: 'Irn-Bru orange' }], rows: [['Monday', '2'], ['Tuesday', '1'], ['Wednesday', '3'], ['Thursday', '5'], ['Friday', '9'], ['Saturday', '11'], ['Sunday', '4']], rowHl: [0, 0, 0, 0, 0, 1, 0], milestones: [{ on: true, idx: 5, caption: 'Send help' }] },
    hbar: { title: 'Rainiest cities in the UK', sub: 'Days of rain a year', source: 'Source: Met Office averages, approximate', suffix: '', prefix: '', sort: 'desc', series: [{ name: 'Days', colour: 'Saltire blue' }], rows: [['Glasgow', '170'], ['Cardiff', '149'], ['Manchester', '152'], ['Belfast', '157'], ['Leeds', '139'], ['Edinburgh', '124'], ['London', '109']], rowHl: [1, 0, 0, 0, 0, 0, 0], milestones: [] },
    grouped: { title: 'A pint, then and now', sub: 'Average price in pounds', source: 'Source: made up for the example', prefix: '£', suffix: '', series: [{ name: '2015', colour: 'Saltire blue' }, { name: '2025', colour: 'Irn-Bru orange' }], rows: [['Glasgow', '3.10', '5.20'], ['Edinburgh', '3.60', '6.10'], ['Manchester', '3.20', '5.40'], ['London', '4.20', '7.30']], rowHl: [], milestones: [] },
    stacked: { title: 'What a night out costs', sub: 'Pounds a head', source: 'Source: made up for the example', prefix: '£', suffix: '', series: [{ name: 'Drink', colour: 'Irn-Bru orange' }, { name: 'Food', colour: 'Sunshine yellow' }, { name: 'Taxi home', colour: 'Saltire blue' }], rows: [['2005', '18', '9', '7'], ['2010', '22', '11', '9'], ['2015', '26', '14', '11'], ['2020', '33', '18', '15'], ['2025', '41', '22', '19']], rowHl: [], milestones: [] },
    line: { title: 'UK population, millions', sub: '', source: 'Source: ONS mid year estimates, approximate', prefix: '', suffix: 'm', series: [{ name: 'Population', colour: 'Irn-Bru orange' }], rows: [['1975', '56.2'], ['1980', '56.3'], ['1985', '56.6'], ['1990', '57.2'], ['1995', '58.0'], ['2000', '58.9'], ['2005', '60.4'], ['2010', '62.8'], ['2015', '65.1'], ['2020', '67.1'], ['2024', '69.3']], rowHl: [], milestones: [{ on: true, idx: 5, caption: 'Growth takes off' }] },
    area: { title: 'How we watch the telly', sub: 'Hours a week', source: 'Source: made up for the example', prefix: '', suffix: '', series: [{ name: 'Streaming', colour: 'Neon red' }, { name: 'Live telly', colour: 'Saltire blue' }], rows: [['2015', '4', '24'], ['2017', '7', '22'], ['2019', '11', '20'], ['2021', '17', '17'], ['2023', '20', '15'], ['2025', '23', '13']], rowHl: [], milestones: [] },
    pie: { title: 'What is in a munchy box', sub: '', source: 'Source: a late night investigation', prefix: '', suffix: '', series: [{ name: 'Share', colour: 'Irn-Bru orange' }], rows: [['Chips', '34'], ['Pizza', '22'], ['Kebab meat', '18'], ['Pakora', '14'], ['Onion rings', '8'], ['Salad nobody eats', '4']], rowHl: [0, 0, 0, 0, 0, 1], milestones: [] },
    donut: { title: 'How the day goes', sub: 'Hours in an average weekday', source: 'Source: made up for the example', prefix: '', suffix: 'h', series: [{ name: 'Hours', colour: 'Irn-Bru orange' }], rows: [['Sleeping', '7'], ['Working', '8'], ['Scrolling', '4'], ['Commuting', '2'], ['Everything else', '3']], rowHl: [0, 0, 1, 0, 0], milestones: [] },
    race: { title: 'Biggest cities in Scotland', sub: 'People, thousands', source: 'Source: census figures, approximate', prefix: '', suffix: 'k', series: [{ name: '1951' }, { name: '1971' }, { name: '1991' }, { name: '2011' }, { name: '2022' }], rows: [['Glasgow', '1090', '897', '663', '593', '620'], ['Edinburgh', '467', '454', '419', '477', '512'], ['Aberdeen', '183', '182', '189', '223', '224'], ['Dundee', '177', '182', '158', '147', '148'], ['Paisley', '94', '95', '75', '77', '77'], ['Inverness', '28', '35', '41', '62', '70']], rowHl: [], milestones: [] },
    number: { title: 'The damage', sub: '', source: 'Source: made up for the example', prefix: '£', suffix: '', series: [{ name: 'Now', colour: 'Irn-Bru orange' }, { name: 'Before', colour: 'Saltire blue' }], rows: [['A pint', '5.20', '3.10'], ['A fish supper', '11.50', '6.00'], ['A taxi home', '18.00', '9.50']], rowHl: [], milestones: [] },
    percent: { title: 'Who has had enough', sub: 'Share of people who said aye', source: 'Source: made up for the example', prefix: '', suffix: '%', series: [{ name: 'Aye', colour: 'Neon red' }], rows: [['Of the weather', '91'], ['Of the bus being late', '84'], ['Of the neighbours', '57'], ['Of Irn-Bru', '2']], rowHl: [1, 0, 0, 0], milestones: [] },
  };

  const hx = c => { c = String(c || ''); return /^#[0-9a-f]{6}$/i.test(c) ? c : (E.COLOURS[c] || ''); };
  const mixc = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), f = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, cl(t, 0, 1))); return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1); };
  const rgba = (h, a) => { const q = parseInt(h.slice(1), 16); return `rgba(${q >> 16},${(q >> 8) & 255},${q & 255},${a})`; };
  const num = s => { const v = parseFloat(String(s ?? '').replace(/,/g, '').replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : NaN; };
  const sm = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };

  /* The three looks. Sleek and light are flat and soft (a rounded card, no outlines, gentle shadows); cartoon is the
     channel's paper panel with ink outlines and hard shadows. */
  function theme(cfg, C) {
    if (cfg.style === 'light') return { k: 'light', dark: false, card: '#ffffff', card2: '#edf0f5', edge: 'rgba(13,20,32,0.10)', text: '#0d1420', dim: '#586479', grid: 'rgba(13,20,32,0.09)', axis: 'rgba(13,20,32,0.45)', track: 'rgba(13,20,32,0.08)', r: 30, ink: 0, on: '#ffffff' };
    if (cfg.style === 'comic') return { k: 'comic', dark: false, comic: true, card: C.paper, card2: C.paper, edge: C.ink, text: C.ink, dim: C.ink, grid: C.grid, axis: C.ink, track: 'rgba(13,20,32,0.12)', r: 0, ink: 5, on: '#ffffff' };
    return { k: 'sleek', dark: true, card: '#111b30', card2: '#0a1220', edge: 'rgba(255,255,255,0.10)', text: '#f3f6fb', dim: '#96a5bf', grid: 'rgba(255,255,255,0.08)', axis: 'rgba(255,255,255,0.40)', track: 'rgba(255,255,255,0.08)', r: 30, ink: 0, on: '#ffffff' };
  }
  // A colour as it is drawn on this look: on the dark card the darkest paints are lifted so they can be seen
  const tone = (c, th) => { if (!th.dark) return c; const k = c.toLowerCase(); return k === '#0d1420' ? '#b9c4d9' : k === '#1d5bbd' ? '#4f86de' : k === '#8a5cc2' ? '#a17ad6' : c; };

  /* The table as numbers. Rows without a number are left out; `i` is the row's place in his table (highlights, colours
     and callouts are kept by that). */
  function table(cfg) {
    const T = TYPES[cfg.type] || TYPES.bar, raw = Array.isArray(cfg.rows) ? cfg.rows : [];
    let S = (Array.isArray(cfg.series) ? cfg.series : []).filter(s => s && typeof s === 'object'); if (!S.length) S = [{ name: '', colour: cfg.colour }];
    const all = S.length, m = T.many ? all : (cfg.type === 'number' ? Math.min(2, all) : 1); let rows = [];
    raw.forEach((r, i) => { if (!Array.isArray(r)) return; const v = []; for (let j = 0; j < m; j++) v.push(num(r[1 + j])); if (!v.some(isFinite)) return; rows.push({ l: String(r[0] ?? '').trim(), v: v.map(x => isFinite(x) ? x : 0), has: v.map(isFinite), i, hl: !!(Array.isArray(cfg.rowHl) && cfg.rowHl[i]), c: hx(Array.isArray(cfg.rowCol) ? cfg.rowCol[i] : '') }); });
    if (!rows.length) rows = [{ l: 'A', v: Array(m).fill(1), has: Array(m).fill(true), i: 0, hl: false, c: '' }, { l: 'B', v: Array(m).fill(2), has: Array(m).fill(true), i: 1, hl: false, c: '' }];
    if ((cfg.type === 'line' || cfg.type === 'area') && rows.length < 2) rows.push(Object.assign({}, rows[0], { l: '', i: -1 }));
    const tot = r => cfg.type === 'grouped' ? Math.max(...r.v) : cfg.type === 'number' ? r.v[0] : r.v.reduce((a, b) => a + b, 0);
    if (!T.time && cfg.type !== 'line' && cfg.type !== 'area') { if (cfg.sort === 'desc') rows = rows.slice().sort((a, b) => tot(b) - tot(a)); else if (cfg.sort === 'asc') rows = rows.slice().sort((a, b) => tot(a) - tot(b)); }
    if (cfg.type === 'number') rows = rows.slice(0, 4);
    let dec = 0; if (cfg.decimals === 'auto' || cfg.decimals == null) raw.forEach(r => { if (Array.isArray(r)) for (let j = 1; j <= all; j++) dec = Math.max(dec, ((String(r[j] ?? '').split('.')[1]) || '').replace(/[^0-9]/g, '').length); }); else dec = Math.round(cl(+cfg.decimals || 0, 0, 6)); dec = Math.min(dec, cfg.decimals === 'auto' || cfg.decimals == null ? 2 : 6);
    const names = S.slice(0, m).map((s, j) => String(s.name ?? '').trim() || (m > 1 ? 'Column ' + (j + 1) : '')), cols = S.slice(0, m).map((s, j) => hx(s.colour) || E.COLOURS[PAL[j % PAL.length]]);
    return { rows, n: rows.length, m, names, cols, dec, tot, T };
  }
  // Round steps for a scale: [lowest, highest, step]
  function nice(lo, hi, want) { if (!(hi > lo)) hi = lo + 1; const raw = (hi - lo) / want, mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= raw * 0.999) || mag * 10; return [Math.floor(lo / st + 1e-9) * st, Math.ceil(hi / st - 1e-9) * st, st]; }
  let mcx = null; const meas = () => mcx || (mcx = document.createElement('canvas').getContext('2d'));
  const fitK = (text, font, maxW, least = 0.5) => { const g = meas(); g.font = font; const w = g.measureText(text).width; return w <= maxW ? 1 : Math.max(least, maxW / w); };
  const clip = (g, text, maxW) => { text = String(text); if (g.measureText(text).width <= maxW) return text; let s = text; while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s + '…'; };

  /* Everything worked out from the settings alone: the numbers, where things sit and when each thing happens. Kept until
     the settings change. */
  let cacheKey = '', cache = null;
  function plan(cfg, look, W, H) {
    const key = JSON.stringify(cfg) + look.format + W + 'x' + H + (E.fontVersion || 0); if (key === cacheKey) return cache;
    const u = Math.min(W, H) / 1080, tall = H > W, D = table(cfg), type = TYPES[cfg.type] ? cfg.type : 'bar', T = TYPES[type], { rows, n, m } = D, comic = cfg.style === 'comic', g = meas();
    const short = !!cfg.short, fmtN = (v, d) => { v = Number(v); if (short) { const a = Math.abs(v); if (a >= 1e12) return nf(0, 1).format(v / 1e12) + 'tn'; if (a >= 1e9) return nf(0, 1).format(v / 1e9) + 'bn'; if (a >= 1e6) return nf(0, 1).format(v / 1e6) + 'm'; if (a >= 1e4) return nf(0, 1).format(v / 1e3) + 'k'; } return nf(d, d).format(v); };
    const pre = String(cfg.prefix ?? ''), suf = String(cfg.suffix ?? ''), fmt = v => pre + fmtN(v, D.dec) + suf;
    // the card and what is on it
    const card = tall ? { x0: W * 0.05, x1: W * 0.95, y0: H * (comic ? 0.125 : 0.06), y1: H * 0.94 } : { x0: W * 0.045, x1: W * 0.955, y0: H * (comic ? 0.17 : 0.06), y1: H * 0.94 }, pad = (tall ? 50 : 58) * u, cw = card.x1 - card.x0 - pad * 2;
    const title = String(cfg.title || '').toUpperCase(), sub = String(cfg.sub || ''), source = String(cfg.source || '');
    const legendOn = m > 1 && !T.time && type !== 'number' && cfg.legend !== false, lfs = 30 * u; g.font = fl(lfs);
    const leg = legendOn ? D.names.map((s, j) => ({ s, j, w: g.measureText(s).width + 46 * u })) : [], legW = leg.reduce((a, q) => a + q.w + 22 * u, 0);
    const counterOn = !!cfg.counter && m === 1 && (type === 'bar' || type === 'line' || type === 'area'), cntW = counterOn ? 330 * u : 0;
    const tfs0 = (tall ? 64 : 76) * u, legRow = legendOn && (tall || legW > cw * 0.46 || comic), tW = cw - 30 * u - (legendOn && !legRow ? legW + 30 * u : 0) - (tall ? 0 : cntW), tk = title ? fitK(title, fd(tfs0), tW, 0.5) : 1, tfs = tfs0 * tk;
    let hy = card.y0 + pad * (comic ? 0.5 : 1); const titleY = hy + tfs * 0.5; if (!comic && title) hy += tfs + 14 * u; const subY = hy + 17 * u; if (sub) hy += 44 * u; const cntY = tall ? hy + 62 * u : card.y0 + pad + 40 * u; if (tall && counterOn) hy += 124 * u; const legY = legRow ? hy + 26 * u : titleY; if (legRow) hy += 58 * u;
    if (legendOn) { let x = legRow ? card.x0 + pad : card.x1 - pad - legW + 22 * u; leg.forEach(q => { q.x = x; x += q.w + 22 * u; }); }
    hy += (comic ? 30 : 26) * u;
    const srcH = source ? 44 * u : 0, A = { x0: card.x0 + pad, x1: card.x1 - pad, y0: hy, y1: card.y1 - pad * 0.72 - srcH };
    // when things happen
    const sp = SPEED[cfg.speed] || 1, T0 = cl(E.tm(cfg, 'intro') ?? 1.0, 0.3, 20), ms = (Array.isArray(cfg.milestones) ? cfg.milestones : []).filter(q => q && q.on).map(q => ({ row: rows.findIndex(r => r.i === +q.idx), caption: String(q.caption || '') })).filter(q => q.row >= 0 && type !== 'race' && type !== 'number');
    const p = { u, tall, D, type, T, rows, n, m, fmt, fmtN, pre, suf, card, pad, cw, title, sub, source, tfs, titleY, subY, cntY, counterOn, leg, legY, lfs, A, T0, ms, sp, comic, reach: {}, st: [] };
    const order = cfg.order || 'rows', seq = rows.map((r, i) => i); if (order === 'big') seq.sort((a, b) => D.tot(rows[b]) - D.tot(rows[a])); else if (order === 'small') seq.sort((a, b) => D.tot(rows[a]) - D.tot(rows[b]));
    const stagger = (gap, grow, pause) => { let tt = 0; const st = []; seq.forEach((i, q) => { st[i] = order === 'together' ? 0 : tt; tt += gap; if (ms.some(c => c.row === i)) { p.reach[i] = st[i] + grow * 0.8; if (order !== 'together') tt += pause; } }); return { st, len: Math.max(...st) + grow }; };
    let B = 3, build = k => { };
    if (type === 'bar' || type === 'grouped' || type === 'stacked' || type === 'hbar' || type === 'percent') {
      // the scale
      const vals = type === 'stacked' ? rows.map(r => r.v.reduce((a, b) => a + Math.max(0, b), 0)).concat(rows.map(r => r.v.reduce((a, b) => a + Math.min(0, b), 0))) : rows.flatMap(r => r.v);
      let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); if (type === 'percent') { lo = 0; hi = Math.max(+cfg.outOf > 0 ? +cfg.outOf : 100, 1e-9); } if (hi === lo) hi = lo + 1;
      const horiz = type === 'hbar' || type === 'percent', msUp = ms.length && !horiz ? 0.24 : 0, sc = type === 'percent' ? [0, hi, hi / 4] : nice(lo, hi + (hi - lo) * msUp, horiz ? (tall ? 3 : 5) : (tall ? 6 : 5)); if (!horiz && cfg.labels !== 'none') A.y0 += 44 * u;   /* the numbers over the bars get their own room, so the scale can stop on a round number */ p.lo = sc[0]; p.hi = sc[1]; p.ticks = []; for (let v = sc[0]; v <= sc[1] + sc[2] * 1e-6; v += sc[2]) p.ticks.push(+v.toFixed(6));
      const tdec = sc[2] < 1 ? Math.max(D.dec, 1) : 0; p.tfmt = v => pre + fmtN(v, Math.min(tdec, 2)) + suf; p.horiz = horiz;
      if (!horiz) {
        g.font = fl(28 * u); const yw = Math.max(...p.ticks.map(v => g.measureText(p.tfmt(v)).width)) + 26 * u; A.x0 += yw; A.y1 -= 58 * u;
        const bw = (A.x1 - A.x0) / n, gw = Math.min(bw * (type === 'grouped' ? 0.8 : 0.64), (type === 'grouped' ? 110 * m : 170) * u); p.bw = bw; p.gw = gw; p.w = type === 'grouped' ? gw / m : gw;
        p.X = i => A.x0 + (i + 0.5) * bw; p.Y = v => A.y1 - (v - p.lo) / (p.hi - p.lo) * (A.y1 - A.y0);
        g.font = fl(28 * u); const lws = rows.map(r => g.measureText(r.l).width), kx = cl((bw * 0.94) / Math.max(1, ...lws), 0.72, 1); p.every = Math.max(1, Math.ceil((Math.max(...lws) * kx + 14 * u) / bw)); g.font = fl(28 * u * kx); p.xl = rows.map(r => ({ s: clip(g, r.l, bw * p.every * 0.96), k: kx }));   // names that cannot fit under every bar go under every second or third
        g.font = fd(40 * u); const vws = rows.flatMap(r => type === 'stacked' ? [g.measureText(fmt(r.v.reduce((a, b) => a + Math.max(0, b), 0))).width] : r.v.map(v => g.measureText(fmt(v)).width)), room = type === 'grouped' ? p.w * 1.02 : bw * 0.94, vk = room / Math.max(1, ...vws); p.vfs = vk * 40 < 15 ? 0 : Math.min(40, vk * 40) * u;   // one size for every number over a bar; none when they could not be read
      } else {
        g.font = fl(32 * u); const lw = Math.min((A.x1 - A.x0) * (tall ? 0.34 : 0.26), Math.max(...rows.map(r => g.measureText(r.l).width)) + 24 * u); p.lw = lw; g.font = fd(40 * u); const vw = Math.max(...rows.map(r => g.measureText(fmt(D.tot(r))).width)) + 26 * u; p.vw = vw;
        const rh = Math.min((A.y1 - A.y0 - (type === 'hbar' ? 40 * u : 0)) / n, (tall ? 150 : 124) * u), top = A.y0 + ((A.y1 - A.y0 - (type === 'hbar' ? 40 * u : 0)) - rh * n) / 2; p.rh = rh; p.top = top; p.bh = Math.min(rh * 0.62, 78 * u);
        p.bx0 = A.x0 + lw; p.bx1 = A.x1 - vw; p.Xv = v => p.bx0 + (v - p.lo) / (p.hi - p.lo) * (p.bx1 - p.bx0); p.Yr = i => top + (i + 0.5) * rh; g.font = fl(32 * u); p.xl = rows.map(r => ({ s: clip(g, r.l, lw - 20 * u), k: 1 }));
      }
      const gap0 = cl(2.4 / n, 0.07, 0.34), grow0 = type === 'stacked' ? 0.95 : 0.78; B = (order === 'together' ? 0 : gap0 * (n - 1) + ms.length * 0.7) + grow0;
      build = k => { const q = stagger(gap0 * k, cl(grow0 * Math.sqrt(k), 0.4, 1.6), 0.7 * k); p.grow = cl(grow0 * Math.sqrt(k), 0.4, 1.6); return q; };
    } else if (type === 'line' || type === 'area') {
      const vals = rows.flatMap(r => r.v); let lo = Math.min(...vals), hi = Math.max(...vals); if (cfg.zeroBase || type === 'area') { lo = Math.min(0, lo); hi = Math.max(0, hi); }
      const padv = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1, sc = nice((cfg.zeroBase || type === 'area') && lo >= 0 ? 0 : lo - padv, hi + padv * (ms.length ? 2.4 : 1), tall ? 6 : 5); p.lo = sc[0]; p.hi = sc[1]; p.ticks = []; for (let v = sc[0]; v <= sc[1] + sc[2] * 1e-6; v += sc[2]) p.ticks.push(+v.toFixed(6));
      const tdec = sc[2] < 1 ? Math.max(D.dec, 1) : 0; p.tfmt = v => pre + fmtN(v, Math.min(tdec, 2)) + suf;
      g.font = fl(28 * u); const yw = Math.max(...p.ticks.map(v => g.measureText(p.tfmt(v)).width)) + 26 * u; A.x0 += yw; A.y1 -= 58 * u; A.x1 -= 26 * u;
      p.X = f => A.x0 + f / Math.max(1, n - 1) * (A.x1 - A.x0); p.Y = v => A.y1 - (v - p.lo) / (p.hi - p.lo) * (A.y1 - A.y0);
      const mw = Math.max(...rows.map(r => g.measureText(r.l).width)); p.every = Math.max(1, Math.ceil((mw + 30 * u) / ((A.x1 - A.x0) / Math.max(1, n - 1)))); p.xl = rows.map(r => ({ s: r.l, k: 1 }));
      const one = order !== 'together' && m > 1; B = (one ? 2.4 * m : 3.6) + ms.length * 0.8;
      /* The pen slows as it comes up to each callout and picks up again after it, so the eye is there when the arrow lands */
      build = k => { const span = B * k / (one ? m : 1), dt = 1 / 120, map = [0]; let f = 0, tt = 0; p.reach = {}; const base = (n - 1) / Math.max(0.2, span - ms.length * 0.8 * k);
        while (f < n - 1 && tt < 240) { let v = base; ms.forEach(c => { const d = f - c.row; v *= 1 - 0.8 * Math.exp(-d * d / 0.9); }); v *= 0.2 + 0.8 * ease.io3(tt / 0.7); f = Math.min(n - 1, f + v * dt); tt += dt; map.push(f); ms.forEach(c => { if (p.reach[c.row] === undefined && f >= c.row - 1e-6) p.reach[c.row] = tt + (one ? 0 : 0); }); }
        p.map = map; p.one = one; p.span = tt; return { st: [], len: one ? tt * m : tt }; };
    } else if (type === 'pie' || type === 'donut') {
      const vs = rows.map(r => Math.max(0, r.v[0])), sum = vs.reduce((a, b) => a + b, 0) || 1; p.sum = sum; let a = -Math.PI / 2; p.arc = vs.map(v => { const a0 = a; a += v / sum * Math.PI * 2; return [a0, a]; });
      const listW = tall ? (A.x1 - A.x0) : (A.x1 - A.x0) * 0.46, pw = tall ? (A.x1 - A.x0) : (A.x1 - A.x0) - listW, ph = tall ? (A.y1 - A.y0) * 0.5 : (A.y1 - A.y0); p.R = Math.min(pw, ph) * 0.46; p.cx = A.x0 + pw / 2; p.cy = A.y0 + ph / 2 + (tall ? 0 : 4 * u);
      const lx = tall ? A.x0 + (A.x1 - A.x0) * 0.08 : A.x0 + pw + 20 * u, ly0 = tall ? A.y0 + ph + 24 * u : A.y0, lh = tall ? (A.y1 - A.y0) - ph - 24 * u : (A.y1 - A.y0), rh = Math.min(lh / n, 92 * u); const lw0 = Math.min(tall ? (A.x1 - A.x0) * 0.84 : listW - 20 * u, 600 * u); p.list = { x: tall ? A.x0 + ((A.x1 - A.x0) - lw0) / 2 : lx + (listW - 20 * u - lw0) * 0.3, w: lw0, y: ly0 + (lh - rh * n) / 2, rh };
      B = 2.3; build = k => { const len = B * k, st = []; rows.forEach((r, i) => { /* when the sweep reaches the middle of the slice */ const want = ((p.arc[i][0] + p.arc[i][1]) / 2 + Math.PI / 2) / (Math.PI * 2); let lo = 0, hi = 1; for (let q = 0; q < 22; q++) { const mid = (lo + hi) / 2; if (ease.io3(mid) < want) lo = mid; else hi = mid; } st[i] = lo * len; if (ms.some(c => c.row === i)) p.reach[i] = st[i] + 0.35; }); return { st, len }; };
    } else if (type === 'race') {
      /* A bar race. Between two moments each bar's length is in between; its place in the table is its rank smoothed over a
         short while, so bars glide past each other instead of swapping in one frame. */
      const steps = Math.max(1, m - 1), SUB = 12, K = steps * SUB + 1, val = (i, f) => { const a = Math.min(m - 1, Math.floor(f)), b = Math.min(m - 1, a + 1), q = f - a; return rows[i].v[a] + (rows[i].v[b] - rows[i].v[a]) * q; };
      const rank = []; for (let k = 0; k < K; k++) { const f = k / SUB, ord = rows.map((r, i) => i).sort((a, b) => val(b, f) - val(a, f) || a - b), rk = []; ord.forEach((i, q) => { rk[i] = q; }); rank.push(rk); }
      p.val = val; p.SUB = SUB; p.K = K; p.rank = rank; p.shown = Math.min(n, Math.round(cl(+cfg.top || 8, 2, 12)));
      p.pos = (i, f) => { const x = cl(f, 0, steps) * SUB, WN = 3; let s = 0, w = 0; for (let k = Math.floor(x) - WN; k <= Math.ceil(x) + WN; k++) { const kk = cl(k, 0, K - 1), ww = Math.max(0, 1 - Math.abs(k - x) / (WN + 1)); s += rank[kk][i] * ww; w += ww; } return s / w; };
      p.maxAt = f => { const x = cl(f, 0, steps) * SUB, WN = 4; let s = 0, w = 0; for (let k = Math.floor(x) - WN; k <= Math.ceil(x) + WN; k++) { const kk = cl(k, 0, K - 1), ff = kk / SUB, ww = Math.max(0, 1 - Math.abs(k - x) / (WN + 1)); s += Math.max(1e-9, ...rows.map((r, i) => val(i, ff))) * ww; w += ww; } return s / w; };
      g.font = fl(32 * u); const lw = Math.min((A.x1 - A.x0) * (tall ? 0.34 : 0.24), Math.max(...rows.map(r => g.measureText(r.l).width)) + 24 * u); p.lw = lw; g.font = fd(40 * u); p.vw = Math.max(...rows.flatMap(r => r.v.map(v => g.measureText(fmt(v)).width))) + 30 * u;
      p.rh = Math.min((A.y1 - A.y0) / p.shown, (tall ? 150 : 118) * u); p.top0 = A.y0 + ((A.y1 - A.y0) - p.rh * p.shown) / 2; p.bh = Math.min(p.rh * 0.66, 80 * u); p.bx0 = A.x0 + lw; p.bx1 = A.x1 - p.vw; g.font = fl(32 * u); p.xl = rows.map(r => ({ s: clip(g, r.l, lw - 20 * u), k: 1 }));
      B = steps * 1.5; build = k => ({ st: [], len: B * k });
    } else {   // big numbers
      B = 1.7 + 0.28 * (n - 1); build = k => { const st = rows.map((r, i) => i * 0.28 * k); p.grow = 1.7 * Math.sqrt(k); return { st, len: Math.max(...st) + p.grow }; };
    }
    const want = Math.min(120, E.tm(cfg, 'draw') || 0) || undefined; let k = cl((want || B * sp) / B, 0.1, 40), bp = build(k); if (want) for (let q = 0; q < 3 && Math.abs(bp.len - want) > 0.01; q++) { k = cl(k * want / Math.max(0.05, bp.len), 0.05, 80); p.reach = {}; bp = build(k); }   // a length dragged on the timeline is the length it gets
    p.st = (bp.st || []).map(v => T0 + v); Object.keys(p.reach).forEach(k => { p.reach[k] += T0; }); p.B = bp.len; p.drawEnd = T0 + bp.len;
    p.pull = 0.8; p.hold = Math.max(0, Math.min(10, +cfg.hold || 0)); p.endStart = p.drawEnd + p.pull + p.hold; p.endDur = cfg.ending === 'out' ? 0.75 : 0; p.dur = p.endStart + p.endDur + 0.35;
    // the average, and a line of his own
    const flat = rows.map(r => D.tot(r)); p.avg = flat.reduce((a, b) => a + b, 0) / Math.max(1, flat.length); const rv = num(cfg.refValue); p.refs = [];
    if (T.axis || type === 'hbar' || type === 'percent') { if (cfg.avg) p.refs.push({ v: p.avg, s: 'Average ' + fmt(p.avg) }); if (cfg.ref && isFinite(rv)) p.refs.push({ v: rv, s: (String(cfg.refLabel || '').trim() ? String(cfg.refLabel).trim() + ' ' : '') + fmt(rv) }); }
    cache = p; cacheKey = key; return p;
  }
  const duration = (cfg, look) => { const { W, H } = E.dims(look.format); return plan(cfg, look, W, H).dur; };
  // Where the preview rests while he works on it: the finished chart (before it leaves, if it leaves)
  const park = (cfg, look) => { const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H); return p.endDur ? p.endStart - 0.02 : p.dur; };

  // ---- drawing kit ----
  const rr = (ctx, x, y, w, h, r) => { if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; } const k = Math.min(w / 2, h / 2); ctx.beginPath(); if (Array.isArray(r)) ctx.roundRect(x, y, w, h, r.map(q => Math.max(0, Math.min(q, k)))); else ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, k))); };
  let GA = 1; const al = (ctx, a) => { ctx.globalAlpha = Math.max(0, Math.min(1, GA * a)); };
  /* A bar (or a slice of one) in the look's own way: soft with a gentle top to bottom shade and rounded ends, or the
     cartoon's ink outline, hard shadow and shine. `ends` says which corners are rounded: [top left, top right, bottom right, bottom left]. */
  function block(ctx, th, u, x, y, w, h, col, ends, a = 1, flat = 0) {
    if (Math.abs(w) < 0.5 || Math.abs(h) < 0.5) return; if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    if (th.comic) { al(ctx, a); ctx.fillStyle = 'rgba(8,16,28,0.9)'; ctx.fillRect(x + 7 * u, y + 7 * u, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,0.26)'; if (h > w) ctx.fillRect(x + w * 0.1, y + 5 * u, w * 0.1, Math.max(0, h - 10 * u)); else ctx.fillRect(x + 5 * u, y + h * 0.12, Math.max(0, w - 10 * u), h * 0.12); ctx.lineWidth = th.ink * u; ctx.strokeStyle = th.edge; ctx.strokeRect(x, y, w, h); al(ctx, 1); return; }
    const r = Math.min(w, h) * 0.2, rad = (ends || [1, 1, 1, 1]).map(e => e ? Math.min(r, 16 * u) : 0);
    al(ctx, a * (th.dark ? 0.35 : 0.16)); ctx.fillStyle = th.dark ? '#000' : '#0d1420'; rr(ctx, x + 2 * u, y + 7 * u, w, h, rad); ctx.fill();
    al(ctx, a); const gr = h >= w || flat ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0); const k1 = flat ? 0.05 : 0.16, k2 = flat ? 0.05 : 0.14; if (h >= w || flat) { gr.addColorStop(0, mixc(col, '#ffffff', k1)); gr.addColorStop(1, mixc(col, '#000000', k2)); } else { gr.addColorStop(0, mixc(col, '#000000', k2)); gr.addColorStop(1, mixc(col, '#ffffff', k1)); }
    ctx.fillStyle = gr; rr(ctx, x, y, w, h, rad); ctx.fill(); al(ctx, 1);
  }
  const label = (ctx, text, x, y, font, col, align = 'center', base = 'middle') => { ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(text, x, y); };
  // words that have to be read over anything (numbers on bars in the cartoon look get a paper edge)
  const strong = (ctx, th, C, text, x, y, font, col, align = 'center') => { ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle'; if (th.comic) { ctx.lineJoin = 'round'; ctx.lineWidth = parseFloat(font) * 0.2 || 6; ctx.strokeStyle = C.paper; ctx.strokeText(text, x, y); } ctx.fillStyle = col; ctx.fillText(text, x, y); };

  function drawCard(ctx, p, th, C, u) {
    const c = p.card, w = c.x1 - c.x0, h = c.y1 - c.y0;
    if (th.comic) { E.panel(ctx, c.x0, c.y0, w, h, C, u, { grain: true }); return; }
    for (let k = 5; k >= 1; k--) { al(ctx, 0.055); ctx.fillStyle = '#000814'; rr(ctx, c.x0 - k * 5 * u, c.y0 - k * 3 * u + 20 * u, w + k * 10 * u, h + k * 8 * u, th.r * u + k * 5 * u); ctx.fill(); }
    al(ctx, 1); const gr = ctx.createLinearGradient(0, c.y0, 0, c.y1); gr.addColorStop(0, th.card); gr.addColorStop(1, th.card2); ctx.fillStyle = gr; rr(ctx, c.x0, c.y0, w, h, th.r * u); ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = th.edge; ctx.stroke();
  }
  /* The title as a small picture, made once. The browser sets words on whole pixels up and down, so under the slow camera a
     big title drawn as words ticks a pixel at a time while the card under it glides. A picture is placed anywhere. It is
     made a little bigger than it is ever shown (DS: the scale of the surface before the camera), so it stays sharp. */
  let DS = 1;
  const mk = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  function titlePic(ctx, p, th, u) {
    const k = cl(DS, 0.1, 4) * 1.09, key = k.toFixed(3) + th.text; if (p.tpic && p.tpic.key === key) return p.tpic.ok ? p.tpic : null;
    const o = p.tpic = { key, ok: false }; try { ctx.font = fd(p.tfs); const tw = ctx.measureText(p.title).width, m = Math.ceil(p.tfs * 0.2), w = tw + m * 2, h = p.tfs * 1.7, W2 = Math.ceil(w * k), H2 = Math.ceil(h * k); if (!(W2 > 0 && H2 > 0) || W2 > 8000 || H2 > 2000) return null;
      const c = mk(W2, H2), g = c.getContext('2d'); g.scale(k, k); label(g, p.title, m, h / 2, fd(p.tfs), th.text, 'left'); Object.assign(o, { c, m, w: W2 / k, h: H2 / k, ok: true }); } catch (e) { return null; }
    return o;
  }
  function drawHeader(ctx, t, p, th, C, u, cfg, live) {
    const c = p.card, x = c.x0 + p.pad;
    if (!th.comic && p.title) { const q = ease.out3((t - 0.3) / 0.65); if (q > 0) { ctx.save(); ctx.fillStyle = C.accent2; rr(ctx, x, p.titleY - p.tfs * 0.5, 10 * u, p.tfs * q, 5 * u); ctx.fill(); ctx.beginPath(); ctx.rect(x, p.titleY - p.tfs, (p.cw + 30 * u) * q, p.tfs * 2); ctx.clip(); al(ctx, Math.min(1, q * 1.6)); const sp = titlePic(ctx, p, th, u); if (sp) ctx.drawImage(sp.c, x + 30 * u - (1 - q) * 30 * u - sp.m, p.titleY + p.tfs * 0.04 - sp.h / 2, sp.w, sp.h); else label(ctx, p.title, x + 30 * u - (1 - q) * 30 * u, p.titleY + p.tfs * 0.04, fd(p.tfs), th.text, 'left'); ctx.restore(); al(ctx, 1); } }
    if (p.sub) { const q = ease.out3((t - 0.6) / 0.6); al(ctx, q); label(ctx, p.sub, x + (th.comic ? 0 : 30 * u), p.subY + (1 - q) * 10 * u, fl(30 * u, 500), th.dim, 'left'); al(ctx, 1); }
    p.leg.forEach((q, k) => { const a = ease.out3((t - 0.7 - k * 0.09) / 0.5); if (a <= 0) return; al(ctx, a); const col = tone(p.D.cols[q.j], th); ctx.fillStyle = col; rr(ctx, q.x, p.legY - 11 * u, 22 * u, 22 * u, th.comic ? 0 : 6 * u); ctx.fill(); if (th.comic) { ctx.lineWidth = 3 * u; ctx.strokeStyle = th.edge; ctx.stroke(); } label(ctx, q.s, q.x + 32 * u, p.legY + 1 * u, fl(p.lfs), th.text, 'left'); al(ctx, 1); });
    if (p.counterOn && live) { const s = spring((t - 0.75) * 1.2, 6.5, 9); if (s > 0) { const rx = p.tall ? c.x0 + p.pad + (th.comic ? 0 : 30 * u) : c.x1 - p.pad; ctx.save(); ctx.translate(rx, p.cntY); ctx.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s); al(ctx, Math.min(1, s * 1.5)); label(ctx, p.fmt(live.v), 0, 0, fd(78 * u), tone(live.col, th), p.tall ? 'left' : 'right'); label(ctx, live.s || '', 0, 54 * u, fl(28 * u, 600), th.dim, p.tall ? 'left' : 'right'); ctx.restore(); al(ctx, 1); } }
    if (p.source) { const q = ease.out3((t - 0.8) / 0.7); al(ctx, q * 0.85); label(ctx, p.source, x, c.y1 - p.pad * 0.6, `italic 400 ${24 * u}px ${E.FONT.label}`, th.dim, 'left'); al(ctx, 1); }
  }
  // The scale: lines that run across one after another, and their numbers
  function drawGrid(ctx, t, p, th, u, horiz) {
    const A = p.A; p.ticks.forEach((v, i) => { const q = ease.io3((t - 0.5 - i * 0.05) / 0.65); if (q <= 0) return; ctx.strokeStyle = th.grid; ctx.lineWidth = (th.comic ? 3 : 2) * u; ctx.beginPath();
      if (!horiz) { const y = p.Y(v); ctx.moveTo(A.x0, y); ctx.lineTo(A.x0 + (A.x1 - A.x0) * q, y); ctx.stroke(); al(ctx, q); label(ctx, p.tfmt(v), A.x0 - 18 * u, y, fl(28 * u, 600), th.dim, 'right'); al(ctx, 1); }
      else { const x = p.Xv(v), y0 = p.top - 6 * u, y1 = p.top + p.rh * p.n + 6 * u; ctx.moveTo(x, y0); ctx.lineTo(x, y0 + (y1 - y0) * q); ctx.stroke(); if (p.type === 'hbar') { al(ctx, q); label(ctx, p.tfmt(v), x, y1 + 26 * u, fl(26 * u, 600), th.dim, 'center'); al(ctx, 1); } } });
    if (!horiz) { const q = ease.io3((t - 0.5) / 0.7), y = p.Y(cl(0, p.lo, p.hi)); ctx.strokeStyle = th.axis; ctx.lineWidth = (th.comic ? 5 : 3) * u; ctx.beginPath(); ctx.moveTo(A.x0, y); ctx.lineTo(A.x0 + (A.x1 - A.x0) * q, y); ctx.stroke(); }
  }
  // A dashed line across at a value (the average, or one of his own) with its name on a tag
  function drawRefs(ctx, t, p, th, C, u) {
    p.refs.forEach((r, k) => { const q = ease.io3((t - p.drawEnd + 0.25 - k * 0.3) / 0.7); if (q <= 0 || r.v < p.lo || r.v > p.hi) return; const col = th.comic ? th.edge : (th.dark ? '#ffffff' : '#0d1420'); ctx.save(); ctx.setLineDash([14 * u, 10 * u]); ctx.lineWidth = 4 * u; ctx.strokeStyle = col; al(ctx, 0.85); ctx.beginPath(); let tx, ty;
      if (!p.horiz) { const y = p.Y(r.v); ctx.moveTo(p.A.x0, y); ctx.lineTo(p.A.x0 + (p.A.x1 - p.A.x0) * q, y); tx = p.A.x1 - 8 * u; ty = y - 26 * u; } else { const x = p.Xv(r.v), y0 = p.top - 10 * u, y1 = p.top + p.rh * p.n + 10 * u; ctx.moveTo(x, y0); ctx.lineTo(x, y0 + (y1 - y0) * q); tx = x; ty = y0 - 24 * u; }
      ctx.stroke(); ctx.setLineDash([]); const a = ease.out3((q - 0.6) / 0.4); if (a > 0) { al(ctx, a); ctx.font = fl(26 * u); const w = ctx.measureText(r.s).width + 26 * u, bx = p.horiz ? cl(tx - w / 2, p.A.x0, p.A.x1 - w) : tx - w; ctx.fillStyle = th.comic ? C.paper : (th.dark ? '#f3f6fb' : '#0d1420'); rr(ctx, bx, ty - 20 * u, w, 40 * u, th.comic ? 0 : 20 * u); ctx.fill(); if (th.comic) { ctx.lineWidth = 3 * u; ctx.strokeStyle = th.edge; ctx.stroke(); } label(ctx, r.s, bx + w / 2, ty + 1 * u, fl(26 * u), th.comic ? th.text : (th.dark ? '#0d1420' : '#ffffff')); }
      ctx.restore(); al(ctx, 1); });
  }
  /* A callout: something pointing at one bar, point or slice, with a few words. Sleek: a dot, a thin lead and a pill that
     springs out. Cartoon: the arrow that flies in and wobbles, and a paper banner. */
  function drawCallout(ctx, t, p, th, C, u, c, px, py, k, dir) {
    const r0 = p.reach[c.row]; if (r0 === undefined || t < r0) return; const uu = t - r0, A = p.A, cap = c.caption.toUpperCase();
    if (th.comic) { const lean = px > (A.x0 + A.x1) / 2 ? -0.55 : 0.55, L = dir ? 1 : Math.hypot(lean, 1), ux = dir ? dir[0] : lean / L, uy = dir ? dir[1] : -1 / L, inn = ease.back(uu / 0.55, 1.7), wob = Math.sin(uu * 14) * Math.exp(-uu * 3) * 10 * u, dist = 26 * u + wob + (1 - inn) * 560 * u;
      if (uu > 0.45 && uu < 1.4) E.ripple(ctx, px, py, 90 * u, (uu - 0.45) / 0.95, C.accent2, u); E.arrow(ctx, px + ux * dist, py + uy * dist, Math.atan2(-uy, -ux), 110 * u, C.accent2, C, 1 + Math.sin(uu * 14) * Math.exp(-uu * 3) * 0.12);
      if (cap) { const bs = spring((uu - 0.5) * 1.2, 6.5, 9); if (bs > 0) { const fs = 40 * u * fitK(cap, fd(40 * u), (A.x1 - A.x0) * 0.5); ctx.font = fd(fs); const bw = ctx.measureText(cap).width + fs; E.banner(ctx, cap, cl(px + ux * (dir ? 150 * u + bw / 2 * Math.abs(ux) : 200 * u), p.card.x0 + bw / 2 + 12 * u, p.card.x1 - bw / 2 - 12 * u), cl(py + uy * 175 * u, p.card.y0 + 60 * u, p.card.y1 - 50 * u), fs, C.paper, C.ink, C, (-3 - 6 * (1 - bs)) * Math.PI / 180, 0.6 + 0.4 * bs); } } return; }
    const s = spring(uu * 1.5, 7, 9), col = C.accent2; if (uu < 1.2) E.ripple(ctx, px, py, 70 * u, uu / 1.2, col, u);
    const up = py - 96 * u > p.A.y0 - 40 * u, q = ease.out3(uu / 0.35), dx = dir ? dir[0] : 0, dy = dir ? dir[1] : (up ? -1 : 1), reachL = dir ? 62 * u : 84 * u, lx = px + dx * reachL, ly = py + dy * reachL; ctx.strokeStyle = col; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(px + dx * 14 * u, py + dy * 14 * u); ctx.lineTo(lerp(px, lx - dx * 4 * u, q), lerp(py, ly - dy * (dir ? 4 : 22) * u, q)); ctx.stroke();
    ctx.fillStyle = th.card; ctx.beginPath(); ctx.arc(px, py, 11 * u * Math.min(1.2, s), 0, 7); ctx.fill(); ctx.lineWidth = 5 * u; ctx.stroke();
    if (cap && s > 0) { const fs = 30 * u * fitK(cap, fd(30 * u), (A.x1 - A.x0) * 0.46); ctx.font = fd(fs); const w = ctx.measureText(cap).width + 44 * u, h = 52 * u, bx = cl(lx - w / 2 + dx * (w / 2 - 6 * u), p.card.x0 + 16 * u, p.card.x1 - 16 * u - w), by = cl(ly + (dir ? dy * 20 * u : 0), p.card.y0 + 40 * u, p.card.y1 - 40 * u); ctx.save(); ctx.translate(bx + w / 2, by); ctx.scale(0.5 + 0.5 * Math.min(1.15, s), 0.5 + 0.5 * Math.min(1.15, s)); al(ctx, Math.min(1, s * 2)); ctx.fillStyle = col; rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill(); label(ctx, cap, 0, 2 * u, fd(fs), '#ffffff'); ctx.restore(); al(ctx, 1); }
  }

  // ---- the charts ----
  /* Bars (also grouped and stacked). Each grows past its height and settles back (the settle is what makes it feel like it
     has weight), its number counting up with it. */
  function drawBars(ctx, t, p, th, C, u, cfg, out) {
    const { rows, n, m, D, type, A } = p, zero = p.Y(cl(0, p.lo, p.hi)), hl = tone(hx(cfg.hlColour) || '#e3302c', th), showV = cfg.labels !== 'none' && p.vfs > 0; let live = null;
    drawGrid(ctx, t, p, th, u, false);
    rows.forEach((r, i) => { const st = p.st[i], x = p.X(i), la = ease.out3((t - st + 0.15) / 0.45);
      if (la > 0 && (i % p.every === 0 || (r.hl && p.every < 3))) { al(ctx, la); label(ctx, p.xl[i].s, x, A.y1 + 20 * u + (1 - la) * 12 * u, fl(28 * u * p.xl[i].k, 700), r.hl ? th.text : th.dim, 'center', 'top'); al(ctx, 1); }
      if (t < st) return; const e = t - st, g = cl(ease.back(e / p.grow, 0.9), 0, 1.2) * (1 - out), cnt = ease.out3(e / (p.grow * 0.85));
      if (type === 'bar') { const col = r.hl || p.ms.some(c => c.row === i && t > (p.reach[i] || 0) - 0.15) ? hl : tone(r.c || D.cols[0], th), y = zero + (p.Y(r.v[0]) - zero) * g; block(ctx, th, u, x - p.w / 2, zero, p.w, y - zero, col, r.v[0] >= 0 ? [1, 1, 0, 0] : [0, 0, 1, 1]);
        if (showV) { const s = spring((e - p.grow * 0.35) * 1.4, 7, 9); if (s > 0) { ctx.save(); ctx.translate(x, y + (r.v[0] >= 0 ? -1 : 1) * (10 * u + p.vfs * 0.55)); ctx.scale(0.6 + 0.4 * Math.min(1.12, s), 0.6 + 0.4 * Math.min(1.12, s)); al(ctx, Math.min(1, s * 2)); strong(ctx, th, C, p.fmt(r.v[0] * cnt), 0, 0, fd(p.vfs), th.text); ctx.restore(); al(ctx, 1); } }
        if (!live || st >= live.st) live = { v: r.v[0] * cnt, s: r.l, col: D.cols[0], st }; }
      else if (type === 'grouped') r.v.forEach((v, j) => { const ej = e - j * 0.07, gj = ej <= 0 ? 0 : cl(ease.back(ej / p.grow, 0.9), 0, 1.2) * (1 - out), bx = x - p.gw / 2 + j * p.w, y = zero + (p.Y(v) - zero) * gj; if (gj <= 0) return; block(ctx, th, u, bx + p.w * 0.06, zero, p.w * 0.88, y - zero, tone(D.cols[j], th), v >= 0 ? [1, 1, 0, 0] : [0, 0, 1, 1]);
        if (showV) { const s = ease.out3((ej - p.grow * 0.4) / 0.3); if (s > 0) { al(ctx, s); strong(ctx, th, C, p.fmt(v * ease.out3(ej / (p.grow * 0.85))), bx + p.w / 2, y + (v >= 0 ? -1 : 1) * (10 * u + p.vfs * 0.55), fd(p.vfs), th.text); al(ctx, 1); } } });
      else { /* stacked: the whole bar rises as one, each slice showing as the top passes it */ const tot = r.v.reduce((a, b) => a + Math.max(0, b), 0), h = tot * Math.min(1, cl(ease.back(e / p.grow, 0.5), 0, 1.1)) * (1 - out); let acc = 0; r.v.forEach((v, j) => { v = Math.max(0, v); const a0 = acc, a1 = Math.min(h, acc + v); acc += v; if (a1 <= a0) return; const last = a0 + v >= tot - 1e-9 || h <= a0 + v, y0 = p.Y(a0), y1 = p.Y(a1); block(ctx, th, u, x - p.w / 2, y0, p.w, y1 - y0, tone(D.cols[j], th), last ? [1, 1, 0, 0] : [0, 0, 0, 0], 1, 1);
          if (cfg.labels === 'all' && y0 - p.Y(a0 + v) > 34 * u && h >= a0 + v - 1e-9) { const s = ease.out3((e - p.grow * 0.8) / 0.3); al(ctx, s); label(ctx, p.fmt(v), x, (y0 + p.Y(a0 + v)) / 2, fd(Math.min(28 * u, p.w * 0.3)), '#ffffff'); al(ctx, 1); } });
        if (showV) { const s = spring((e - p.grow * 0.55) * 1.4, 7, 9); if (s > 0) { al(ctx, Math.min(1, s * 2)); strong(ctx, th, C, p.fmt(tot * cnt), x, p.Y(h) - 10 * u - p.vfs * 0.55, fd(p.vfs), th.text); al(ctx, 1); } } }
    });
    drawRefs(ctx, t, p, th, C, u);
    p.ms.forEach((c, k) => { const r = rows[c.row], top = type === 'stacked' ? r.v.reduce((a, b) => a + Math.max(0, b), 0) : Math.max(...r.v); drawCallout(ctx, t, p, th, C, u, c, p.X(c.row), p.Y(top) - (showV ? 26 * u + p.vfs : 22 * u), k); });
    return live;
  }
  // Bars sideways and percent bars: the name on the left, the bar running out to its number
  function drawHBars(ctx, t, p, th, C, u, cfg, out) {
    const { rows, D, type } = p, hl = tone(hx(cfg.hlColour) || '#e3302c', th), pc = type === 'percent';
    if (!pc) drawGrid(ctx, t, p, th, u, true);
    rows.forEach((r, i) => { const st = p.st[i], y = p.Yr(i), e = t - st, la = ease.out3((e + 0.25) / 0.45); if (la <= 0) return;
      al(ctx, la); label(ctx, p.xl[i].s, p.bx0 - 20 * u - (1 - la) * 16 * u, y, fl(32 * u, r.hl ? 800 : 600), r.hl ? th.text : th.dim, 'right'); al(ctx, 1);
      if (pc) { al(ctx, la); ctx.fillStyle = th.track; rr(ctx, p.bx0, y - p.bh / 2, p.bx1 - p.bx0, p.bh, th.comic ? 0 : p.bh / 2); ctx.fill(); if (th.comic) { ctx.lineWidth = 4 * u; ctx.strokeStyle = th.edge; ctx.stroke(); } al(ctx, 1); }
      if (e < 0) return; const v = r.v[0], g = cl(ease.back(e / p.grow, pc ? 0.4 : 0.8), 0, 1.15) * (1 - out), cnt = ease.out3(e / (p.grow * 0.85)), x0 = p.Xv(cl(0, p.lo, p.hi)), x1 = x0 + (p.Xv(pc ? cl(v, p.lo, p.hi) : v) - x0) * g, col = r.hl || p.ms.some(c => c.row === i && t > (p.reach[i] || 0) - 0.15) ? hl : tone(r.c || D.cols[0], th);
      if (pc && !th.comic) { if (x1 - x0 > 2) { ctx.save(); rr(ctx, p.bx0, y - p.bh / 2, p.bx1 - p.bx0, p.bh, p.bh / 2); ctx.clip(); block(ctx, th, u, x0 - p.bh, y - p.bh / 2, x1 - x0 + p.bh, p.bh, col, [1, 1, 1, 1]); ctx.restore(); } }
      else block(ctx, th, u, x0, y - p.bh / 2, x1 - x0, p.bh, col, v >= 0 ? [0, 1, 1, 0] : [1, 0, 0, 1]);
      if (cfg.labels !== 'none') { const s = spring((e - p.grow * 0.3) * 1.4, 7, 9); if (s > 0) { al(ctx, Math.min(1, s * 2)); strong(ctx, th, C, p.fmt(v * cnt), pc ? p.bx1 + 22 * u : Math.max(x1, x0) + 18 * u, y + 2 * u, fd(Math.min(40 * u, p.bh * 0.62)), r.hl ? col : th.text, 'left'); al(ctx, 1); } } });
    drawRefs(ctx, t, p, th, C, u);
    p.ms.forEach((c, k) => { const v = rows[c.row].v[0], xe = pc ? p.bx1 : Math.max(p.Xv(v), p.Xv(cl(0, p.lo, p.hi))); ctx.font = fd(Math.min(40 * u, p.bh * 0.62)); const vw = cfg.labels !== 'none' ? ctx.measureText(p.fmt(v)).width + 30 * u : 12 * u; drawCallout(ctx, t, p, th, C, u, c, xe + vw + 16 * u, p.Yr(c.row), k, [1, 0]); });   // out to the right of the bar's number
    return null;
  }
  // Lines and areas: drawn on by a pen with a lit head, the area filling in under it
  function drawLines(ctx, t, p, th, C, u, cfg, out) {
    const { rows, n, m, D, A, type } = p; drawGrid(ctx, t, p, th, u, false); let live = null;
    const prog = j => { const tt = t - p.T0 - (p.one ? j * p.span : 0); if (tt <= 0) return -1; return p.map[Math.min(p.map.length - 1, Math.floor(tt * 120))]; }, lead = Math.max(...Array.from({ length: m }, (q, j) => prog(j)));
    rows.forEach((r, i) => { if (i % p.every && i !== n - 1) return; if (i === n - 1 && (n - 1) % p.every && (n - 1) % p.every < p.every * 0.6 && n > 2) return; const q = ease.io3((lead - i + 1.2) / 1.5); if (q <= 0) return; al(ctx, q); label(ctx, r.l, p.X(i), A.y1 + 20 * u + (1 - q) * 12 * u, fl(28 * u, 600), th.dim, 'center', 'top'); al(ctx, 1); });
    const base = p.Y(cl(0, p.lo, p.hi));
    for (let j = m - 1; j >= 0; j--) { const f = prog(j); if (f < 0) continue; const col = tone(D.cols[j], th), pts = [], val = ff => { const a = Math.min(n - 2, Math.floor(ff)), q = ff - a; return rows[a].v[j] + (rows[a + 1].v[j] - rows[a].v[j]) * q; };
      for (let i = 0; i <= Math.floor(f); i++) pts.push([p.X(i), p.Y(rows[i].v[j])]); if (f > Math.floor(f)) pts.push([p.X(f), p.Y(val(f))]); if (pts.length < 2) pts.push([pts[0][0] + 0.01, pts[0][1]]);
      const head = pts[pts.length - 1], fa = (1 - out);
      if (type === 'area' || m === 1) { ctx.beginPath(); E.curvePath(ctx, pts); ctx.lineTo(head[0], base); ctx.lineTo(pts[0][0], base); ctx.closePath(); if (th.comic) { al(ctx, (type === 'area' ? 0.5 : 0.3) * fa); ctx.fillStyle = col; } else { const gr = ctx.createLinearGradient(0, A.y0, 0, base); gr.addColorStop(0, rgba(col, type === 'area' ? 0.6 : 0.36)); gr.addColorStop(1, rgba(col, type === 'area' ? 0.1 : 0)); ctx.fillStyle = gr; al(ctx, fa); } ctx.fill(); al(ctx, 1); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; al(ctx, fa);
      if (th.comic) { ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = th.edge; ctx.lineWidth = 19 * u; ctx.stroke(); ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = col; ctx.lineWidth = 9 * u; ctx.stroke(); }
      else { ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = rgba(col, 0.16); ctx.lineWidth = 26 * u; ctx.stroke(); ctx.beginPath(); E.curvePath(ctx, pts); ctx.strokeStyle = col; ctx.lineWidth = 8 * u; ctx.stroke(); }
      if (n <= 16) for (let i = 0; i <= Math.floor(f + 1e-6); i++) { const s = spring((f - i) * 2.2 + 0.05, 6, 9); if (s <= 0) continue; ctx.fillStyle = th.comic ? '#fff' : th.card; ctx.strokeStyle = th.comic ? th.edge : col; ctx.lineWidth = (th.comic ? 4 : 4) * u; ctx.beginPath(); ctx.arc(p.X(i), p.Y(rows[i].v[j]), 8 * u * Math.min(1.2, s), 0, 7); ctx.fill(); ctx.stroke(); }
      if (!th.comic) { al(ctx, fa * 0.28); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(head[0], head[1], 24 * u, 0, 7); ctx.fill(); al(ctx, fa); }
      ctx.fillStyle = th.comic ? '#fff' : '#ffffff'; ctx.strokeStyle = th.comic ? th.edge : col; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(head[0], head[1], 12 * u, 0, 7); ctx.fill(); ctx.stroke(); al(ctx, 1);
      if (m > 1) { /* each line's number rides at its head */ const s = ease.out3((f - 0.2) / 0.6) * fa; if (s > 0) { al(ctx, s); strong(ctx, th, C, p.fmt(val(Math.min(f, n - 1 - 1e-9))), head[0] - 16 * u, head[1] - 30 * u, fd(30 * u), th.comic ? th.text : col, 'right'); al(ctx, 1); } }
      if (j === 0) live = { v: val(Math.min(f, n - 1 - 1e-9)), s: rows[Math.min(n - 1, Math.round(f))].l, col: D.cols[0] };
    }
    drawRefs(ctx, t, p, th, C, u);
    p.ms.forEach((c, k) => drawCallout(ctx, t, p, th, C, u, c, p.X(c.row), p.Y(rows[c.row].v[0]), k));
    return live;
  }
  /* Pie and donut. One sweep goes round like a clock hand and each slice appears as it passes; the list beside it fills in
     at the same moment, so the eye is told what each colour is as it arrives. A highlighted slice steps out a little. */
  function drawPie(ctx, t, p, th, C, u, cfg, out) {
    const { rows, n, D, type } = p, sweep = -Math.PI / 2 + ease.io3((t - p.T0) / p.B) * Math.PI * 2, R = p.R * (1 - out * 0.3), r0 = type === 'donut' ? R * 0.58 : 0, hlc = tone(hx(cfg.hlColour) || '#e3302c', th), mode = cfg.labels === 'value' || cfg.labels === 'none' ? cfg.labels : 'percent';
    const colOf = (r, i) => r.hl ? hlc : tone(r.c || E.COLOURS[PAL[i % PAL.length]], th);
    if (t > p.T0 - 0.4 && !th.comic) { al(ctx, ease.out3((t - p.T0 + 0.4) / 0.4) * (1 - out)); ctx.fillStyle = th.track; ctx.beginPath(); ctx.arc(p.cx, p.cy, R, 0, 7); if (r0) ctx.arc(p.cx, p.cy, r0, 0, 7, true); ctx.fill('evenodd'); al(ctx, 1); }
    rows.forEach((r, i) => { const [a0, a1] = p.arc[i], a = Math.min(a1, sweep); if (a <= a0 + 1e-4) return; const mid = (a0 + a1) / 2, pop = (r.hl || p.ms.some(c => c.row === i)) ? spring((t - p.st[i] - 0.25) * 1.3, 6, 9) * 20 * u : 0, ox = Math.cos(mid) * pop, oy = Math.sin(mid) * pop, col = colOf(r, i);
      ctx.beginPath(); if (r0) { ctx.arc(p.cx + ox, p.cy + oy, R, a0, a); ctx.arc(p.cx + ox, p.cy + oy, r0, a, a0, true); } else { ctx.moveTo(p.cx + ox, p.cy + oy); ctx.arc(p.cx + ox, p.cy + oy, R, a0, a); } ctx.closePath();
      al(ctx, 1 - out); if (th.comic) { ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = th.ink * u; ctx.strokeStyle = th.edge; ctx.lineJoin = 'round'; ctx.stroke(); } else { const gr = ctx.createRadialGradient(p.cx + ox, p.cy + oy, r0, p.cx + ox, p.cy + oy, R); gr.addColorStop(0, mixc(col, '#000000', 0.12)); gr.addColorStop(1, mixc(col, '#ffffff', 0.1)); ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = th.card; ctx.stroke(); }
      const share = r.v[0] / p.sum; if (mode !== 'none' && share >= 0.06 && a >= a1 - 1e-4) { const s = ease.out3((t - p.st[i] - 0.3) / 0.35); if (s > 0) { const rm = r0 ? (R + r0) / 2 : R * 0.66; al(ctx, s * (1 - out)); strong(ctx, th, C, mode === 'value' ? p.fmt(r.v[0]) : nf(0, 0).format(share * 100) + '%', p.cx + ox + Math.cos(mid) * rm, p.cy + oy + Math.sin(mid) * rm, fd(Math.min(38 * u, R * 0.15 * (mode === 'value' ? 0.8 : 1))), th.comic ? th.text : '#ffffff'); } } al(ctx, 1); });
    if (type === 'donut' && cfg.centre !== 'none') { const q = ease.io3((t - p.T0) / p.B), topI = rows.reduce((b, r, i) => (r.hl && !rows[b].hl) || (r.hl === rows[b].hl && r.v[0] > rows[b].v[0]) ? i : b, 0), big = cfg.centre === 'top' ? nf(0, 0).format(rows[topI].v[0] / p.sum * 100 * q) + '%' : p.fmt(p.sum * q), small = cfg.centre === 'top' ? rows[topI].l : (String(cfg.centreText || '').trim() || 'Total'), a = ease.out3((t - p.T0) / 0.5) * (1 - out);
      al(ctx, a); const k = fitK(big, fd(R * 0.36), r0 * 1.6); label(ctx, big, p.cx, p.cy - R * 0.04, fd(R * 0.36 * k), th.text); ctx.font = fl(R * 0.11, 600); label(ctx, clip(ctx, small, r0 * 1.5), p.cx, p.cy + R * 0.2, fl(R * 0.11, 600), th.dim); al(ctx, 1); }
    // the list
    const L = p.list; rows.forEach((r, i) => { const s = ease.out3((t - p.st[i] + 0.1) / 0.45); if (s <= 0) return; const y = L.y + (i + 0.5) * L.rh, col = colOf(r, i), fs = Math.min(34 * u, L.rh * 0.42), share = r.v[0] / p.sum; al(ctx, s * (1 - out)); const x = L.x + (1 - s) * 30 * u;
      ctx.fillStyle = col; rr(ctx, x, y - fs * 0.42, fs * 0.84, fs * 0.84, th.comic ? 0 : fs * 0.22); ctx.fill(); if (th.comic) { ctx.lineWidth = 3 * u; ctx.strokeStyle = th.edge; ctx.stroke(); }
      const right = mode === 'value' ? p.fmt(r.v[0]) : nf(0, share < 0.1 && share > 0 ? 1 : 0).format(share * 100 * ease.out3((t - p.st[i]) / 0.6)) + '%'; ctx.font = fd(fs * 1.15); const rw = ctx.measureText(mode === 'value' ? right : '100%').width; label(ctx, right, L.x + L.w, y + 2 * u, fd(fs * 1.15), r.hl ? col : th.text, 'right');
      ctx.font = fl(fs, r.hl ? 800 : 600); label(ctx, clip(ctx, r.l, L.w - fs * 1.4 - rw - 24 * u), x + fs * 1.4, y + 1 * u, fl(fs, r.hl ? 800 : 600), r.hl ? th.text : (th.comic ? th.text : th.dim), 'left');
      al(ctx, 1); });
    p.ms.forEach((c, k) => { const mid = (p.arc[c.row][0] + p.arc[c.row][1]) / 2, rr2 = R + 26 * u; drawCallout(ctx, t, p, th, C, u, c, p.cx + Math.cos(mid) * rr2, p.cy + Math.sin(mid) * rr2, k, [Math.cos(mid), Math.sin(mid)]); });   // out along the slice
    return null;
  }
  // The bar race
  function drawRace(ctx, t, p, th, C, u, cfg, out) {
    const { rows, n, m, D, A } = p, steps = Math.max(1, m - 1), q = cl((t - p.T0) / p.B, 0, 1), f = (q < 0.06 ? q * q / 0.12 : q > 0.94 ? 0.94 - (1 - q) * (1 - q) / 0.12 : q - 0.03) / 0.94 * steps, mx = p.maxAt(f), inn = ease.out3((t - p.T0 + 0.7) / 0.6), hl = tone(hx(cfg.hlColour) || '#e3302c', th);
    // the moment, big and quiet in the corner
    const per = D.names[Math.min(m - 1, Math.round(f))] || '', pk = fitK(per, fd(190 * u), (A.x1 - A.x0) * 0.4), turn = sm(Math.abs(f - Math.floor(f) - 0.5) * 5); al(ctx, inn * (th.dark ? 0.16 : 0.13) * (1 - out) * (f >= steps - 0.5 || f < 0.5 ? Math.max(turn, f < 0.5 ? (f < 0.25 ? 1 : turn) : 1) : turn));   /* one moment fades out as the next fades in */ label(ctx, per, A.x1, A.y1 - 4 * u, fd(190 * u * pk), th.comic ? th.edge : th.text, 'right', 'bottom'); al(ctx, 1);
    ctx.save(); ctx.beginPath(); ctx.rect(p.card.x0, A.y0 - 6 * u, p.card.x1 - p.card.x0, A.y1 - A.y0 + 12 * u); ctx.clip();
    rows.map((r, i) => [i, p.pos(i, f)]).sort((a, b) => b[1] - a[1]).forEach(([i, pos]) => { if (pos > p.shown + 0.6) return; const r = rows[i], y = p.top0 + (pos + 0.5) * p.rh, v = p.val(i, f), a = cl(p.shown + 0.1 - pos, 0, 1) * inn * (1 - out), col = r.hl ? hl : tone(r.c || E.COLOURS[PAL[i % PAL.length]], th), x1 = p.bx0 + Math.max(0, v) / mx * (p.bx1 - p.bx0) * ease.out3((t - p.T0 + 0.7 - pos * 0.05) / 0.7); if (a <= 0) return;
      GA *= a; al(ctx, 1); label(ctx, p.xl[i].s, p.bx0 - 20 * u, y, fl(32 * u, 700), th.text, 'right'); block(ctx, th, u, p.bx0, y - p.bh / 2, x1 - p.bx0, p.bh, col, [0, 1, 1, 0]); strong(ctx, th, C, p.fmt(v), x1 + 18 * u, y + 2 * u, fd(Math.min(40 * u, p.bh * 0.6)), th.text, 'left'); GA /= a; al(ctx, 1); });
    ctx.restore();
    // how far through time it is
    const bx = A.x0, bw = A.x1 - A.x0, by = A.y1 + 14 * u; al(ctx, inn * (1 - out)); ctx.fillStyle = th.track; rr(ctx, bx, by, bw, 6 * u, 3 * u); ctx.fill(); ctx.fillStyle = C.accent2; rr(ctx, bx, by, bw * (f / steps), 6 * u, 3 * u); ctx.fill(); al(ctx, 1);
    return null;
  }
  // Big numbers: each counts up, lands with a small bounce, and (given a figure from before) says how far it has moved
  function drawNumbers(ctx, t, p, th, C, u, cfg, out) {
    const { rows, n, m, D, A, tall } = p, cols = tall ? 1 : n, rws = tall ? n : 1, cw = (A.x1 - A.x0) / cols, ch = (A.y1 - A.y0) / rws, hl = tone(hx(cfg.hlColour) || '#e3302c', th);
    rows.forEach((r, i) => { const cx = A.x0 + (tall ? 0.5 : i + 0.5) * cw, cy = A.y0 + (tall ? i + 0.5 : 0.5) * ch, e = t - p.st[i]; if (e < -0.2) return; const a = ease.out3((e + 0.2) / 0.4) * (1 - out), cnt = ease.expo(e / p.grow), land = e > p.grow * 0.72 ? 1 + Math.sin(Math.min(1, (e - p.grow * 0.72) / 0.35) * Math.PI) * 0.06 : 1, from = num(cfg.from), v = lerp(isFinite(from) ? from : 0, r.v[0], cnt), col = r.hl ? hl : tone(r.c || D.cols[0], th);
      const txt = p.fmt(v), fs0 = Math.min(ch * (n === 1 ? 0.5 : tall ? 0.42 : 0.36), 330 * u), fs = fs0 * Math.min(...rows.map(q => fitK(p.fmt(q.v[0]), fd(fs0), cw * 0.86, 0.2)));   // one size for them all
      if (n > 1 && !th.comic && i > 0) { al(ctx, a * 0.6); ctx.fillStyle = th.grid; if (tall) ctx.fillRect(A.x0 + cw * 0.1, cy - ch / 2, cw * 0.8, 2 * u); else ctx.fillRect(cx - cw / 2, cy - ch * 0.3, 2 * u, ch * 0.6); }
      ctx.save(); ctx.translate(cx, cy - fs * 0.12); ctx.scale(land, land); al(ctx, a); if (th.comic) label(ctx, txt, fs * 0.035, fs * 0.035, fd(fs), th.edge); label(ctx, txt, 0, 0, fd(fs), col); ctx.restore();
      const uw = ease.io3((e - 0.2) / 0.8) * Math.min(cw * 0.5, 260 * u); al(ctx, a); ctx.fillStyle = C.accent2; rr(ctx, cx - uw / 2, cy + fs * 0.42, uw, 8 * u, th.comic ? 0 : 4 * u); ctx.fill();
      const lfs = Math.min(40 * u, fs * 0.3 + 12 * u); ctx.font = fl(lfs, 700); label(ctx, clip(ctx, r.l, cw * 0.88), cx, cy + fs * 0.42 + 52 * u, fl(lfs, 700), th.text);
      if (m > 1 && r.has[1] && r.v[1] !== 0) { const ch2 = (r.v[0] - r.v[1]) / Math.abs(r.v[1]) * 100, s = spring((e - p.grow * 0.8) * 1.4, 7, 9); if (s > 0) { const upc = th.dark ? '#57d08a' : '#1f9d57', dnc = th.dark ? '#ff7b6e' : '#d23a2e', good = ch2 >= 0, tx = (good ? '▲ ' : '▼ ') + nf(0, Math.abs(ch2) < 10 ? 1 : 0).format(Math.abs(ch2)) + '%' + (D.names[1] ? '  from ' + p.fmt(r.v[1]) : ''); al(ctx, a * Math.min(1, s * 2)); label(ctx, tx, cx, cy + fs * 0.42 + 52 * u + lfs * 1.45, fl(lfs * 0.92, 700), good ? upc : dnc); } }
      al(ctx, 1); });
    return null;
  }

  /* One frame. The background stays put behind the card (it only drifts a little the other way), and the camera moves the
     card: a slow push through the build, a lean in on each callout, and a pull back at the end. */
  function draw(ctx, t, cfg, look, W, H) {
    const p = plan(cfg, look, W, H), C = E.palette(look), th = theme(cfg, C), u = p.u, out = p.endDur ? ease.io3((t - p.endStart) / p.endDur) : 0;
    let z = 1, fx = W / 2, fy = H / 2; { const m = ctx.getTransform ? ctx.getTransform() : null; DS = m ? Math.hypot(m.a, m.b) || 1 : 1; }
    if (cfg.camera) { const push = ease.sine((t - 0.4) / Math.max(1, p.drawEnd - 0.4)) * 0.035, back = ease.io3((t - p.drawEnd - 0.1) / 1.1); z = 1 + push * (1 - back);
      p.ms.forEach(c => { const r0 = p.reach[c.row]; if (r0 === undefined) return; const b = ease.io3((t - r0 + 0.25) / 0.6) * (1 - ease.io3((t - r0 - 1.2) / 0.8)) * (1 - back); if (b <= 0) return; const tx = p.type === 'pie' || p.type === 'donut' ? p.cx : p.horiz ? (p.bx0 + p.bx1) / 2 : p.X ? p.X(c.row) : W / 2, ty = p.horiz ? p.Yr(c.row) : (p.A.y0 + p.A.y1) / 2; z += 0.04 * b; fx = lerp(fx, lerp(W / 2, tx, 0.5), b); fy = lerp(fy, lerp(H / 2, ty, 0.3), b); }); }
    else z = 1 + 0.012 * ease.sine(t / p.dur);
    const d = Math.min(1, t / 1.2); fx += Math.sin(t * 0.7) * 2.5 * u * d; fy += Math.cos(t * 0.55) * 2 * u * d; { /* the card is never cut by the edge of the frame, however far the camera leans */ const c = p.card, mg = 10 * u, hx2 = (W / 2 - mg) / z, hy2 = (H / 2 - mg) / z, ax = c.x1 - hx2, bx = c.x0 + hx2, ay = c.y1 - hy2, by = c.y0 + hy2; fx = ax <= bx ? cl(fx, ax, bx) : W / 2; fy = ay <= by ? cl(fy, ay, by) : H / 2; }
    E.drawBg(ctx, C, look, W, H, (fx - W / 2) * -0.3, (fy - H / 2) * -0.3);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-fx, -fy);
    const ci = th.comic ? spring((t - 0.1) * 1.2) : ease.out3((t - 0.05) / 0.7), outA = 1 - ease.io3((t - p.endStart - p.endDur * 0.45) / (p.endDur * 0.55 || 1)) * (p.endDur ? 1 : 0);
    if (th.comic) { const c = p.card; ctx.translate((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2 + (1 - ci) * -H * 1.1 + (1 - outA) * H * 0.2); ctx.rotate((-0.6 - 9 * (1 - ci)) * Math.PI / 180); ctx.translate(-(c.x0 + c.x1) / 2, -(c.y0 + c.y1) / 2); GA = outA; } else { ctx.translate(0, (1 - ci) * 70 * u + (1 - outA) * 50 * u); GA = Math.min(1, ci * 1.3) * outA; }
    al(ctx, 1); drawCard(ctx, p, th, C, u);
    let live = null; const body = { bar: drawBars, grouped: drawBars, stacked: drawBars, hbar: drawHBars, percent: drawHBars, line: drawLines, area: drawLines, pie: drawPie, donut: drawPie, race: drawRace, number: drawNumbers }[p.type];
    if (t > 0.25) live = body(ctx, t, p, th, C, u, cfg, out);
    drawHeader(ctx, t, p, th, C, u, cfg, live);
    GA = 1; ctx.globalAlpha = 1; ctx.restore();
    if (th.comic && p.title) { const hs = spring((t - 0.05) * 1.1, 6.5, 9), fs = (p.tall ? 52 : 48) * u * fitK(p.title, fd((p.tall ? 52 : 48) * u), W * 0.82, 0.4); ctx.save(); ctx.globalAlpha = outA; E.banner(ctx, p.title, W / 2, H * (p.tall ? 0.075 : 0.085), fs, C.accent2, '#fff', C, (-2 - 6 * (1 - hs)) * Math.PI / 180, 0.6 + 0.4 * hs); ctx.restore(); }
    const fdIn = 1 - ease.expo(t / 0.35); if (fdIn > 0 && !look.transparent) { ctx.fillStyle = C.bg; ctx.globalAlpha = fdIn; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  // The bars on the timeline: the title, the build (drag its end to make it slower or quicker), the callouts and the end
  function tracks(cfg, look) {
    const { W, H } = E.dims(look.format), p = plan(cfg, look, W, H), col = p.D.cols[0], hs = p.drawEnd + p.pull, word = { bar: 'Bars grow', hbar: 'Bars grow', grouped: 'Bars grow', stacked: 'Bars grow', percent: 'Bars fill', line: 'Lines draw', area: 'Areas draw', pie: 'Slices sweep in', donut: 'Slices sweep in', race: 'The race', number: 'Numbers count up' }[p.type];
    const out = [{ id: 'data', name: 'Chart', colour: col, items: [{ id: 'intro', start: 0, end: p.T0, label: 'Title', colour: '#3a4660', move: false, trim: 'end', minLen: 0.3, maxLen: 20, timed: true, title: 'Drag the right edge to show the title for longer before the chart starts' }, { id: 'draw', start: p.T0, end: p.drawEnd, label: word, colour: E.hexMix(col, '#16213a', 0.35), move: false, trim: 'end', minLen: 0.5, maxLen: 120, timed: true, title: 'Drag the right edge to make it slower or quicker' }] }];
    const ms = p.ms.filter(c => p.reach[c.row] !== undefined); if (ms.length) out.push({ id: 'ms', name: 'Callouts', colour: '#e3302c', items: ms.map((c, k) => ({ id: 'ms:' + k, start: p.reach[c.row] - 0.2, end: p.reach[c.row] + 0.9, label: c.caption || 'Callout', colour: E.hexMix('#e3302c', '#16213a', 0.4), move: false, trim: 'none' })) });
    out.push({ id: 'end', name: 'End', items: [{ id: 'hold', start: hs, end: hs + p.hold, label: 'Hold', colour: '#3a4660', move: false, trim: 'end', minLen: 0.01, maxLen: 10, title: 'Drag the right edge to hold the last shot for longer' }, ...(p.endDur ? [{ id: 'ending', start: p.endStart, end: p.endStart + p.endDur, label: 'Leaves', colour: '#6a2a2a', move: false, trim: 'none' }] : [])] });
    return out;
  }
  return { TYPES, EXAMPLES, PAL, table, plan, duration, park, draw, tracks, num, hx };
})();

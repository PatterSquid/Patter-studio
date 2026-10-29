/* Video: a whole video in one running order. Clips made in the other tabs play one after another, with gaps where the video
   cuts to the presenter's avatar talking to camera. Each clip keeps its own settings and can be opened in its own tab to edit.
   Avatar gaps export as plain black (or green, or see through in a PNG sequence) so the avatar footage drops straight in. */
const Video = (() => {
  const { H, field, sel, txt, area, btn, card } = UI;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const NAMES = { charts: 'Chart', timeline: 'Timeline', map: 'World map', flights: 'Flights', flyover: 'Map flyover', picto: 'Pictogram', news: 'Newspaper', story: 'Story', broll: 'B roll', studio: 'Studio' };
  const COLS = { charts: '#3b7dd8', timeline: '#2f9a8a', map: '#3c8f4a', flights: '#4f6fd0', flyover: '#2d7a6a', picto: '#b0703a', news: '#8a8a8a', story: '#7d6420', broll: '#6d4f9a', studio: '#3a5f8a', avatar: '#a03a6a' };
  const raw = k => ({ charts: typeof Charts !== 'undefined' && Charts, timeline: typeof Timeline !== 'undefined' && Timeline, map: typeof MapMod !== 'undefined' && MapMod, flights: typeof Flights !== 'undefined' && Flights, flyover: typeof Flyover !== 'undefined' && Flyover, picto: typeof Picto !== 'undefined' && Picto, news: typeof News !== 'undefined' && News, story: typeof Story !== 'undefined' && Story, broll: typeof Broll !== 'undefined' && Broll, studio: typeof Studio !== 'undefined' && Studio })[k] || null;
  const modOf = k => { const m = raw(k); return m ? (typeof Layers !== 'undefined' ? Layers.wrap(m) : m) : null; };
  const hooks = {};
  const nid = p => p + Math.random().toString(36).slice(2, 9);
  // Each clip plays in the look of the video, except the chalk tabs, which always use the chalkboard
  const lookFor = (it, look) => { const L = Object.assign({}, look, it.look || {}); if (it.mod === 'story' || it.mod === 'broll') L.scheme = 'chalk'; return L; };
  const WPS = 2.6; // words a second when talking, for sizing an avatar gap from its line
  const fitWords = s => r2(cl(String(s || '').trim().split(/\s+/).filter(Boolean).length / WPS + 0.6, 1.2, 120));
  const r2 = v => Math.round(v * 100) / 100;

  // How long one item plays: a clip's own length (less anything trimmed off the start), plus any hold on its last frame
  function natural(it, look) { const M = modOf(it.mod); if (!M || !it.cfg) return 3; let d = 3; try { d = M.duration(it.cfg, lookFor(it, look)); } catch (e) { } return d > 0 && isFinite(d) ? d : 3; }
  function lenOf(it, look) { if (it.kind === 'avatar') return cl(+it.dur || 3, 0.3, 600); const d = natural(it, look), a = cl(+it.inPt || 0, 0, Math.max(0, d - 0.2)); return Math.max(0.2, d - a + cl(+it.hold || 0, 0, 600)); }
  function layout(cfg, look) { let t = 0; return (cfg.items || []).map((it, i) => { const d = lenOf(it, look), o = { it, i, t0: t, d }; t += d; return o; }); }
  function at(cfg, look, t) { const L = layout(cfg, look); if (!L.length) return null; let o = L[0]; for (const x of L) { if (x.t0 <= t + 1e-9) o = x; else break; } return o; }
  // Where in the clip itself this moment falls: trims and holds included
  const inner = (o, t, look) => { const it = o.it, d = natural(it, look), a = cl(+it.inPt || 0, 0, Math.max(0, d - 0.2)); return Math.min(d - 1e-4, a + Math.max(0, t - o.t0)); };

  function defaults() {
    const clip = k => { const M = raw(k); return M ? { id: nid('i'), kind: 'clip', mod: k, name: '', cfg: M.defaults(), inPt: 0, hold: 0 } : null; };
    return { gap: 'black', items: [clip('broll'), { id: nid('i'), kind: 'avatar', text: 'Aye, ye heard that right. Wait till ye see the next bit.', dur: fitWords('Aye, ye heard that right. Wait till ye see the next bit.') }, clip('charts')].filter(Boolean) };
  }
  function duration(cfg, look) { const L = layout(cfg, look); const last = L[L.length - 1]; return last ? Math.max(0.5, last.t0 + last.d) : 1; }

  function draw(ctx, t, cfg, look, W, H) {
    const o = at(cfg, look, t);
    if (!o) { ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, W, H); if (look.preview) label(ctx, W, H, 'Add clips to your video', 'Use + Clip and + Avatar gap above the timeline', null); return; }
    if (o.it.kind === 'avatar') return drawGap(ctx, o, t, cfg, look, W, H);
    const M = modOf(o.it.mod); if (!M) return;
    ctx.save(); try { M.draw(ctx, inner(o, t, look), o.it.cfg, lookFor(o.it, look), W, H); } finally { ctx.restore(); }
  }
  // The avatar gap: blank in the export, a labelled card in the preview so you can see where you come in and what you say
  // With the studio in the gaps, your avatar video carries on from gap to gap: each gap starts where the last one stopped
  const studioOn = cfg => cfg.gap === 'studio' && cfg.studio && typeof Studio !== 'undefined';
  function avStart(cfg, o, look) { let s = 0; for (const x of layout(cfg, look)) { if (x === o || x.it === o.it) break; if (x.it.kind === 'avatar') s += x.d; } const A = cfg.studio && cfg.studio.avatar; return (A ? +A.inPt || 0 : 0) + (o.it.avIn != null && o.it.avIn !== '' ? +o.it.avIn : s); }
  function drawGap(ctx, o, t, cfg, look, W, H) {
    const g = cfg.gap || 'black';
    if (studioOn(cfg)) { ctx.save(); try { Studio.drawAt(ctx, t, avStart(cfg, o, look) + (t - o.t0), cfg.studio, look, W, H); } finally { ctx.restore(); } return; }
    if (look.transparent || g === 'clear') ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = g === 'green' ? '#00b140' : '#000000'; ctx.fillRect(0, 0, W, H); }
    if (!look.preview) return;
    label(ctx, W, H, 'AVATAR', o.it.text || '', Math.max(0, o.d - (t - o.t0)));
  }
  function label(ctx, W, H, big, small, left) {
    const u = Math.min(W, H) / 1080; ctx.save(); ctx.fillStyle = 'rgba(160,58,106,0.18)'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([18 * u, 14 * u]); ctx.lineWidth = 4 * u; ctx.strokeRect(30 * u, 30 * u, W - 60 * u, H - 60 * u); ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; ctx.font = `800 ${Math.round(110 * u)}px Anton, Impact, sans-serif`; ctx.fillText(big, W / 2, H * 0.4);
    if (small) { ctx.font = `500 ${Math.round(46 * u)}px Lora, Georgia, serif`; const words = String(small).split(/\s+/), lines = []; let cur = ''; words.forEach(w => { const tr = cur ? cur + ' ' + w : w; if (ctx.measureText(tr).width > W * 0.8 && cur) { lines.push(cur); cur = w; } else cur = tr; }); if (cur) lines.push(cur); lines.slice(0, 5).forEach((ln, i) => ctx.fillText(ln, W / 2, H * 0.55 + i * 58 * u)); }
    if (left != null) { ctx.font = `600 ${Math.round(34 * u)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(left.toFixed(1) + ' s left, not in the export', W / 2, H * 0.86); }
    ctx.restore();
  }

  // Exports: hand the clip's own video and motion blur hints through
  function mediaFor(cfg) { const ids = new Set(); if (studioOn(cfg)) (Studio.mediaFor(cfg.studio) || []).forEach(x => ids.add(x)); (cfg.items || []).forEach(it => { const M = it.kind === 'clip' && modOf(it.mod); if (M && M.mediaFor) (M.mediaFor(it.cfg) || []).forEach(x => ids.add(x)); }); return [...ids]; }
  function mediaAt(cfg, t, look) { const lk = look || { format: '16:9' }, o = at(cfg, lk, t); if (o && o.it.kind === 'avatar' && studioOn(cfg)) return Studio.mediaAtAv(cfg.studio, t, avStart(cfg, o, lk) + (t - o.t0)); if (!o || o.it.kind !== 'clip') return []; const M = modOf(o.it.mod); return M && M.mediaAt ? M.mediaAt(o.it.cfg, inner(o, t, lk)) : []; }
  function blurHint(cfg, look, t, fps, W, H) { const o = at(cfg, look, t); if (!o || o.it.kind !== 'clip') return 1; const M = modOf(o.it.mod); return M && M.blurHint ? M.blurHint(o.it.cfg, lookFor(o.it, look), inner(o, t, look), fps, W, H) : null; }
  const needsMap = cfg => (cfg.items || []).some(it => it.kind === 'clip' && (it.mod === 'map' || it.mod === 'flights' || it.mod === 'flyover' || (it.mod === 'studio' && Studio.needsMap(it.cfg)))) || (studioOn(cfg) && Studio.needsMap(cfg.studio));

  /* ---------- Timeline: one lane, the video in order. Drag a bar to move it in the running order, drag its end to hold the
     last frame longer (or make an avatar gap longer or shorter) ---------- */
  const byId = (cfg, id) => (cfg.items || []).find(x => 'I:' + x.id === id);
  const nameOf = it => it.kind === 'avatar' ? '🎙 ' + (it.text ? it.text : 'Avatar') : (it.name || NAMES[it.mod] || it.mod);
  const editor = { formIsScene: true,
    tracks(cfg, look) { return [{ id: 'video', name: 'Video', colour: '#c9a640', items: layout(cfg, look).map(o => ({ id: 'I:' + o.it.id, start: o.t0, end: o.t0 + o.d, label: (o.i + 1) + '. ' + nameOf(o.it), colour: COLS[o.it.kind === 'avatar' ? 'avatar' : o.it.mod] || '#666', move: true, trim: 'end', minLen: 0.3, title: o.it.kind === 'avatar' ? 'Avatar gap: drag the end to fit your voiceover' : 'Drag to move it in the running order, drag the end to hold the last frame longer' })) }]; },
    update(cfg, id, ch) {
      const it = byId(cfg, id); if (!it) return; const look = hooks.look ? hooks.look() : { format: '16:9' }, L = layout(cfg, look), o = L.find(x => x.it === it); if (!o) return;
      const len = ch.end - ch.start;
      if (Math.abs(len - o.d) > 0.02) { if (it.kind === 'avatar') it.dur = r2(cl(len, 0.3, 600)); else { const d = natural(it, look), a = cl(+it.inPt || 0, 0, d), extra = len - (d - a); it.hold = r2(Math.max(0, extra)); if (extra < 0) it.inPt = r2(cl(a - extra, 0, d - 0.2)); } }
      if (Math.abs(ch.start - o.t0) > 0.05) { const mid = ch.start + o.d / 2, others = L.filter(x => x.it !== it); let i = others.findIndex(x => mid < x.t0 + x.d / 2); if (i < 0) i = others.length; const arr = others.map(x => x.it); arr.splice(i, 0, it); cfg.items = arr; }
    },
    adds: [
      { label: 'Clip', title: 'Add a clip after the one at the playhead: a copy of what is on that tab now, which you can then change', choices: () => Object.keys(NAMES).filter(k => raw(k)).map(k => ({ label: NAMES[k], key: k, icon: c => { const g = c.getContext('2d'); g.fillStyle = COLS[k]; g.fillRect(0, 0, c.width, c.height); } })),
        fn(cfg, t, sel, ch) { if (!ch || !ch.key) return null; const src = hooks.tabCfg ? hooks.tabCfg(ch.key) : null, it = { id: nid('i'), kind: 'clip', mod: ch.key, name: '', cfg: src ? JSON.parse(JSON.stringify(src)) : raw(ch.key).defaults(), inPt: 0, hold: 0 }; insertAt(cfg, t, it); return 'I:' + it.id; } },
      { label: 'Avatar gap', title: 'Leave a gap where the video cuts to you talking to camera', fn(cfg, t) { const it = { id: nid('i'), kind: 'avatar', text: '', dur: 3 }; insertAt(cfg, t, it); return 'I:' + it.id; } },
    ],
    remove(cfg, id) { cfg.items = (cfg.items || []).filter(x => 'I:' + x.id !== id); },
    duplicate(cfg, id) { const it = byId(cfg, id); if (!it) return null; const c = JSON.parse(JSON.stringify(it)); c.id = nid('i'); const i = cfg.items.indexOf(it); cfg.items.splice(i + 1, 0, c); return 'I:' + c.id; },
    inspect(root, cfg, id, changed, done) { const it = byId(cfg, id); if (!it) return; root.append(itemCard(cfg, it, changed, done)); },
    scene(root, cfg, changed) { root.append(overview(cfg, changed)); },
  };
  function insertAt(cfg, t, it) { cfg.items = cfg.items || []; const look = hooks.look ? hooks.look() : { format: '16:9' }, o = at(cfg, look, t); const i = o ? o.i + 1 : cfg.items.length; cfg.items.splice(i, 0, it); }

  /* ---------- Panels ---------- */
  function itemCard(cfg, it, changed, done) {
    const look = hooks.look ? hooks.look() : { format: '16:9' }, i = cfg.items.indexOf(it), move = d => { const j = i + d; if (j < 0 || j >= cfg.items.length) return; cfg.items.splice(i, 1); cfg.items.splice(j, 0, it); changed(); };
    const f = [];
    if (it.kind === 'avatar') {
      f.push(field('What you say here (shows on the preview only)', area(it.text, v => { it.text = v; changed(false); }, 'Your line to camera', 3, 'Avatar line')));
      f.push(field('Length in seconds', txt(String(it.dur), v => { const n = parseFloat(v); if (isFinite(n)) { it.dur = r2(cl(n, 0.3, 600)); changed(); } }, '3', 'Length in seconds'), 'Or drag the end of its bar on the timeline.'));
      f.push(H('div', { className: 'btnrow' }, btn('Fit the length to the words', () => { it.dur = fitWords(it.text); changed(); })));
      if (cfg.gap === 'studio') f.push(field('Start your avatar video at (seconds, blank to carry on from the last gap)', txt(it.avIn == null ? '' : String(it.avIn), v => { const n = parseFloat(v); if (v.trim() === '') delete it.avIn; else if (isFinite(n)) it.avIn = r2(Math.max(0, n)); changed(); }, 'carry on', 'Avatar start')));
    } else {
      const d = natural(it, look);
      f.push(field('Name on the timeline', txt(it.name || '', v => { it.name = v; changed(false); }, NAMES[it.mod], 'Clip name')));
      f.push(H('p', { className: 'hint', textContent: NAMES[it.mod] + ' clip, ' + d.toFixed(1) + ' s long on its own.' }));
      f.push(field('Start part way in (seconds cut off the start)', txt(String(it.inPt || 0), v => { const n = parseFloat(v); if (isFinite(n)) { it.inPt = r2(cl(n, 0, Math.max(0, d - 0.2))); changed(); } }, '0', 'Seconds cut from the start')));
      f.push(field('Hold the last frame for (seconds)', txt(String(it.hold || 0), v => { const n = parseFloat(v); if (isFinite(n)) { it.hold = r2(cl(n, 0, 600)); changed(); } }, '0', 'Hold on the last frame'), 'Handy when your voiceover runs longer than the clip.'));
      f.push(H('div', { className: 'btnrow' }, btn('Edit this clip in the ' + (NAMES[it.mod] || '') + ' tab', () => hooks.openItem && hooks.openItem(it.id), 'primary')));
    }
    f.push(H('div', { className: 'btnrow' }, btn('◀ Earlier', () => move(-1)), btn('Later ▶', () => move(1)), btn('Done', done)));
    return card((i + 1) + '. ' + (it.kind === 'avatar' ? 'Avatar gap' : (it.name || NAMES[it.mod])), ...f);
  }
  function overview(cfg, changed) {
    const look = hooks.look ? hooks.look() : { format: '16:9' }, L = layout(cfg, look), tot = L.length ? L[L.length - 1].t0 + L[L.length - 1].d : 0, m = Math.floor(tot / 60), s = Math.round(tot - m * 60);
    const list = H('div', { className: 'vid-list' }, ...L.map(o => H('div', { className: 'vid-row' }, H('i', { style: 'background:' + (COLS[o.it.kind === 'avatar' ? 'avatar' : o.it.mod] || '#666') }),
      H('span', { className: 'vid-name', textContent: (o.i + 1) + '. ' + nameOf(o.it) }), H('span', { className: 'vid-len', textContent: o.d.toFixed(1) + ' s' }),
      o.it.kind === 'clip' ? btn('Edit', () => hooks.openItem && hooks.openItem(o.it.id)) : '', btn('Select', () => hooks.select && hooks.select('I:' + o.it.id)))));
    return card('Your video, ' + (m ? m + ' min ' : '') + s + ' s',
      H('p', { className: 'hint', textContent: 'Clips play in this order. Add them with + Clip and + Avatar gap above the timeline, drag bars to change the order, and press Edit to change a clip in its own tab.' }),
      L.length ? list : H('p', { className: 'hint', textContent: 'Nothing in the video yet.' }),
      field('Avatar gaps in the export', sel(cfg.gap || 'black', [['black', 'Black'], ['green', 'Green screen'], ['clear', 'See through (PNG sequence only)'], ...(typeof Studio !== 'undefined' ? [['studio', 'Your studio, with your avatar']] : [])], v => { cfg.gap = v; if (v === 'studio' && !cfg.studio && hooks.tabCfg) cfg.studio = JSON.parse(JSON.stringify(hooks.tabCfg('studio'))); changed(); }, 'Avatar gap colour')),
      cfg.gap === 'studio' ? H('p', { className: 'hint', textContent: 'Each gap shows your studio from the Studio tab. Your avatar video plays on from gap to gap, so record your [ME] lines in order as one take. The rain and the room carry on through the whole video.' }) : '',
      cfg.gap === 'studio' ? H('div', { className: 'btnrow' }, btn('Use the Studio tab as it is now', () => { if (hooks.tabCfg) { cfg.studio = JSON.parse(JSON.stringify(hooks.tabCfg('studio'))); changed(); } }), typeof Studio !== 'undefined' ? btn('Save the studio sound for the whole video (WAV)', () => { const look2 = hooks.look ? hooks.look() : { format: '16:9' }, L2 = layout(cfg, look2), segs = L2.filter(o => o.it.kind === 'avatar').map(o => [o.t0, o.t0 + o.d]); E.saveBlob(Studio.wav(Studio.soundData(cfg.studio, segs, duration(cfg, look2))), 'video studio sound.wav', [{ description: 'WAV sound', accept: { 'audio/wav': ['.wav'] } }]).catch(() => { }); }) : '') : '');
  }

  return { id: 'video', name: 'Video', defaults, duration, draw, editor, mediaFor, mediaAt, blurHint, needsMap, hooks, layout, lenOf, NAMES, form: (root, cfg, changed) => root.append(overview(cfg, changed)) };
})();

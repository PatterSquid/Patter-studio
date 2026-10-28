/* Scene editor: a draggable timeline under the preview, click and drag on the preview, and a panel for the selected item.
   Modules opt in with an `editor` object:
     tracks(cfg, look) -> [{ id, name, colour, items: [{ id, start, end, label, colour, move, trim: 'both'|'end'|'none', maxLen, minLen, lanes }] }]
     update(cfg, id, { start, end, track })     apply a timing change
     hits(cfg, look, t, W, H) -> [{ id, box: [x0, y0, x1, y1], k, scale }]   selectable things on screen right now
     grab(cfg, id) -> snapshot; move(cfg, id, snap, dx, dy); resize(cfg, id, snap, f)
     adds: [{ label, title, fn(cfg, t, sel) -> new id }], remove(cfg, id), duplicate(cfg, id) -> id
     inspect(root, cfg, id, changed), scene(root, cfg, changed)                                                      */
const Editor = (() => {
  const { H } = UI;
  function create(o) {
    // o: { tl, canvas, wrap, player, getMod, getCfg, getLook, changed, commit, select }
    let multi = new Set(), sel = null, selKey = -1, pps = 0, fitted = false, snapOn = true, camOff = false, dur = 1, curT = 0, drag = null, hover = null;
    const bar = H('div', { className: 'tl-bar' }), body = H('div', { className: 'tl-body' }), heads = H('div', { className: 'tl-heads' }), scroll = H('div', { className: 'tl-scroll' }), inner = H('div', { className: 'tl-inner' });
    const ruler = H('div', { className: 'tl-ruler' }), lanes = H('div', { className: 'tl-lanes' }), play = H('div', { className: 'tl-play' }, H('i', {}));
    inner.append(ruler, lanes, play); scroll.append(inner); body.append(heads, scroll); o.tl.append(bar, body);
    const ovl = H('canvas', { className: 'ovl', 'aria-hidden': 'true' }); o.wrap.append(ovl);
    // Small fixed play controls at the left end of the ruler
    const tpReset = H('button', { type: 'button', className: 'tl-tpb', title: 'Back to the start (Home)', 'aria-label': 'Back to the start', innerHTML: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2h2v12H3zM13 2v12L6 8z" fill="currentColor"/></svg>', on: { click: () => { o.player.reset(); setTime(0); } } });
    const tpPlay = H('button', { type: 'button', className: 'tl-tpb', title: 'Play or pause (Space)', 'aria-label': 'Play', on: { click: () => o.player.toggle() } });
    const PLAY = '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>', PAUSE = '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2h4v12H3zM9 2h4v12H9z" fill="currentColor"/></svg>';
    let tpState = null; const syncPlay = pl => { if (pl === tpState) return; tpState = pl; tpPlay.innerHTML = pl ? PAUSE : PLAY; tpPlay.setAttribute('aria-label', pl ? 'Pause' : 'Play'); }; syncPlay(false);
    const tpEl = H('div', { className: 'tl-hr tl-tp' }, tpReset, tpPlay);
    const ed = () => { const m = o.getMod(); return m && m.editor; };
    const fmt = s => { const m = Math.floor(s / 60), r = s - m * 60; return (m ? m + ':' + (r < 10 ? '0' : '') : '') + r.toFixed(m ? 0 : r < 10 ? 1 : 0); };

    // Toolbar
    let pop = null;
    function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('pointerdown', popAway, true); } }
    function popAway(ev) { if (pop && !pop.contains(ev.target) && !(ev.target.closest && ev.target.closest('[data-pop]'))) closePop(); }
    async function runAdd(a, choice) {
      closePop(); let id; try { id = a.fn(o.getCfg(), curT, sel, choice); if (id && typeof id.then === 'function') id = await id; } catch (e) { console.error(e); return; }
      o.changed(true); select(id || sel);
      // Show a new layer straight away rather than its first, empty frame of the pop in
      if (id && String(id).startsWith('L:') && !o.player.playing) { const it = trackRows.flatMap(tr => tr.items).find(i => i.id === id); if (it && Math.abs(it.start - curT) < 0.01) { const tt = Math.min(it.end, it.start + 0.6); o.player.seek(tt); setTime(tt); } }
    }
    function openPop(a, b) {
      if (pop && pop.dataset.for === a.label) { closePop(); return; } closePop();
      pop = H('div', { className: 'tl-pop', role: 'menu', 'aria-label': a.title || a.label }); pop.dataset.for = a.label;
      a.choices().forEach(ch => { const cv = H('canvas', { 'aria-hidden': 'true' }); try { ch.icon && ch.icon(cv); } catch (e) { } pop.append(H('button', { type: 'button', role: 'menuitem', title: ch.label, on: { click: () => runAdd(a, ch) } }, cv, H('span', { textContent: ch.label }))); });
      o.tl.append(pop); const r = b.getBoundingClientRect(), tr = o.tl.getBoundingClientRect(); pop.style.left = Math.max(0, Math.min(r.left - tr.left, tr.width - pop.offsetWidth - 4)) + 'px'; pop.style.top = (r.bottom - tr.top + 4) + 'px';
      setTimeout(() => document.addEventListener('pointerdown', popAway, true), 0);
    }
    function drawBar() {
      bar.innerHTML = ''; const e = ed(), btn = (txt, title, fn, dis) => H('button', { type: 'button', textContent: txt, title, 'aria-label': title, disabled: !!dis, on: { click: fn } });
      const mk = a => { const b = btn('+ ' + a.label + (a.choices ? ' ▾' : ''), a.title || 'Add ' + a.label.toLowerCase() + ' at the playhead', () => a.choices ? openPop(a, b) : runAdd(a)); if (a.choices) { b.dataset.pop = '1'; b.setAttribute('aria-haspopup', 'menu'); } return b; };
      const adds = (e && e.adds) || [], own = adds.filter(a => a.group !== 'layer'), lay = adds.filter(a => a.group === 'layer');
      own.forEach(a => bar.append(mk(a)));
      if (lay.length) { if (own.length) bar.append(H('span', { className: 'tl-gap' })); bar.append(H('span', { className: 'tl-lbl', textContent: 'Layers' })); lay.forEach(a => bar.append(mk(a))); }
      if (e && (e.remove || e.duplicate)) { bar.append(H('span', { className: 'tl-gap' }));
        bar.append(btn('Duplicate', 'Duplicate the selected item (Ctrl+D)', () => { if (!sel || !e.duplicate) return; const ids = multi.size > 1 ? [...multi] : [sel], out = ids.map(i => e.duplicate(o.getCfg(), i)).filter(Boolean); o.changed(true); select(out[0] || sel); if (out.length > 1) { out.forEach(i => multi.add(i)); markSel(); } }, !sel || !e.duplicate));
        bar.append(btn('Delete', 'Delete the selected item (Delete)', () => removeSel(), !sel || !e.remove));
        const lays = selLayers(); if (lays.length && typeof Layers !== 'undefined' && Layers.hooks.savePiece) bar.append(btn(lays.length > 1 ? 'Save ' + lays.length + ' as a piece' : 'Save as a piece', 'Keep the selected layers to drop into any clip later (from Saved)', () => Layers.hooks.savePiece(o.getCfg(), lays))); }
      if (e && e.addKey && sel && sel.startsWith('L:')) bar.append(btn('◆ Key', 'Add a keyframe to the selected layer at the playhead (K)', () => addKey()));
      bar.append(H('span', { className: 'tl-gap' }), btn('Undo', 'Undo (Ctrl+Z)', () => o.undo()), btn('Redo', 'Redo (Ctrl+Shift+Z)', () => o.redo()));
      bar.append(H('span', { className: 'tl-gap' }), btn('−', 'Zoom out the timeline', () => zoom(1 / 1.4)), btn('+', 'Zoom in the timeline', () => zoom(1.4)));
      if (e && e.camera) bar.append(H('label', { className: 'check tl-cam', title: 'Untick to see the whole scene while you arrange things. The export always uses the camera.' }, H('input', { type: 'checkbox', checked: !camOff, on: { change: ev => { camOff = !ev.target.checked; } } }), 'Camera moves'));
      const sn = H('label', { className: 'check tl-snap' }, H('input', { type: 'checkbox', checked: snapOn, on: { change: ev => { snapOn = ev.target.checked; } } }), 'Snap'); bar.append(sn);
    }
    function addKey() { const e = ed(); if (!e || !e.addKey || !sel || !sel.startsWith('L:')) return false; const st = trackRows.flatMap(tr => tr.items).find(i => i.id === sel); let t = curT; if (st) t = Math.max(st.start, Math.min(st.end, t)); selKey = e.addKey(o.getCfg(), sel, t); o.changed(true); return true; }
    function zoom(f) { const c = scroll.scrollLeft + scroll.clientWidth / 2, tc = c / pps; pps = Math.max(8, Math.min(600, pps * f)); fitted = true; build(); scroll.scrollLeft = tc * pps - scroll.clientWidth / 2; }
    const selLayers = () => [...new Set([...(multi.size ? multi : []), ...(sel ? [sel] : [])])].filter(i => typeof i === 'string' && i.startsWith('L:'));
    function markSel() { lanes.querySelectorAll('.tl-clip').forEach(c => c.classList.toggle('on', c.dataset.id === sel || multi.has(c.dataset.id))); }
    function removeSel() { const e = ed(); if (multi.size > 1 && e && e.remove && selKey < 0) { [...multi].forEach(i => e.remove(o.getCfg(), i)); multi.clear(); sel = null; o.changed(true); o.select(null); drawBar(); return; } if (sel && selKey >= 0 && e && e.removeKey) { e.removeKey(o.getCfg(), sel, selKey); selKey = -1; o.changed(true); o.select(sel); return; } if (!sel || !e || !e.remove) return; e.remove(o.getCfg(), sel); sel = null; o.changed(true); o.select(null); drawBar(); }

    // Timeline
    let trackRows = [];
    function build() {
      const m = o.getMod(), cfg = o.getCfg(), look = o.getLook(); dur = Math.max(1, m.duration(cfg, look));
      const fit = Math.max(30, (scroll.clientWidth - 30) / (dur + 0.5)); if (!fitted || !pps) pps = fit;
      const W = Math.max(scroll.clientWidth, (dur + 1) * pps); inner.style.width = W + 'px';
      // Ruler
      ruler.innerHTML = ''; const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60], step = steps.find(s => s * pps >= 60) || 60, minor = step / (step >= 1 ? 4 : 5);
      for (let s = 0; s <= dur + 1 + 1e-6; s += minor) { const major = Math.abs(s / step - Math.round(s / step)) < 1e-6; ruler.append(H('i', { className: major ? 'mj' : '', style: `left:${s * pps}px` })); if (major) ruler.append(H('span', { style: `left:${s * pps + 3}px`, textContent: fmt(Math.round(s * 100) / 100) })); }
      ruler.append(H('b', { className: 'tl-end', style: `left:${dur * pps}px`, title: 'End of the clip' }));
      // Tracks
      heads.innerHTML = ''; lanes.innerHTML = ''; heads.append(tpEl);
      const e = ed(); trackRows = e && e.tracks ? e.tracks(cfg, look) : [{ id: 'clip', name: m.name || 'Clip', items: [{ id: '_all', start: 0, end: dur, label: m.name || 'Clip', move: false, trim: 'none' }] }];
      trackRows.forEach(tr => {
        const hd = H('div', { className: 'tl-h' + (tr.layer ? ' lay' : ''), title: tr.name, style: tr.colour ? `border-left:4px solid ${tr.colour}` : '', on: tr.layer ? { click: () => select(tr.items[0] && tr.items[0].id) } : undefined }, H('span', { className: 'tl-hn', textContent: tr.name }));
        if (tr.layer && e && e.lockTrack) hd.append(H('button', { type: 'button', className: 'tl-ico' + (tr.locked ? ' on' : ''), title: tr.locked ? 'Locked. Click to unlock' : 'Lock this layer so it can\'t be moved by accident', 'aria-label': tr.locked ? 'Unlock layer' : 'Lock layer', 'aria-pressed': String(!!tr.locked), innerHTML: tr.locked ? '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 7V5a4 4 0 0 1 7.5-2l-1.7 1A2 2 0 0 0 6 5v2h7v8H3V7z" fill="currentColor"/></svg>', on: { click: ev => { ev.stopPropagation(); e.lockTrack(o.getCfg(), tr.id); o.changed(true); } } }),
          H('button', { type: 'button', className: 'tl-ico' + (tr.hidden ? ' on' : ''), title: tr.hidden ? 'Hidden. Click to show it' : 'Hide this layer', 'aria-label': tr.hidden ? 'Show layer' : 'Hide layer', 'aria-pressed': String(!!tr.hidden), innerHTML: tr.hidden ? '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M2 2l12 12-1 1-2.3-2.3A7 7 0 0 1 1 8a7.6 7.6 0 0 1 2.7-3.3L1 3zm6 2a7 7 0 0 1 7 4 7.5 7.5 0 0 1-1.7 2.2L11 7.9A3 3 0 0 0 8.1 5z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 3a7 7 0 0 1 7 5 7 7 0 0 1-14 0 7 7 0 0 1 7-5zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="currentColor"/></svg>', on: { click: ev => { ev.stopPropagation(); e.hideTrack(o.getCfg(), tr.id); o.changed(true); } } }));
        if (tr.toggle && e && e.toggleTrack) hd.append(H('button', { type: 'button', className: 'tl-tog' + (tr.toggle.on ? ' on' : ''), textContent: tr.toggle.text, title: tr.toggle.title, 'aria-label': tr.toggle.title, 'aria-pressed': String(!!tr.toggle.on), on: { click: ev => { ev.stopPropagation(); e.toggleTrack(o.getCfg(), tr.id); o.changed(true); } } }));
        heads.append(hd);
        const lane = H('div', { className: 'tl-lane' + (tr.layer ? ' lay' : ''), 'data-track': tr.id }); lanes.append(lane);
        tr.items.forEach(it => lane.append(clipEl(it, tr)));
      });
      drawRange(); setTime(curT, true);
    }
    function clipEl(it, tr) {
      const tmc = o.getCfg().timing, el = H('div', { className: 'tl-clip' + (it.timed && tmc && tmc[it.id] ? ' custom' : '') + (it.id === sel || multi.has(it.id) ? ' on' : '') + (it.locked ? ' locked' : '') + (it.move === false && it.trim === 'none' ? ' fixed' : '') + (it.small ? ' small' : ''), title: it.title || it.label, 'data-id': it.id, tabIndex: 0 });
      el.style.left = it.start * pps + 'px'; el.style.width = Math.max(6, (it.end - it.start) * pps) + 'px'; el.style.background = it.colour || tr.colour || '#3b5a8f';
      el.append(H('span', { textContent: it.label }));
      if (it.trim === 'both' || it.trim === 'start') el.append(H('b', { className: 'hl', 'data-h': 'l' }));
      if (it.trim === 'both' || it.trim === 'end') el.append(H('b', { className: 'hr', 'data-h': 'r' }));
      if (it.keys) it.keys.forEach((kt, ki) => { const d = H('i', { className: 'tl-key' + (it.id === sel && ki === selKey ? ' on' : ''), title: 'Keyframe at ' + kt.toFixed(2) + ' s. Drag to retime, click to jump to it.', 'data-k': ki }); d.style.left = (kt - it.start) * pps + 'px'; d.addEventListener('pointerdown', ev => startKeyDrag(ev, it, ki, d)); el.append(d); });
      if (it.fxAt !== null && it.fxAt !== undefined) { const f = H('i', { className: 'tl-fx', title: 'Effect starts at ' + it.fxAt.toFixed(2) + ' s. Drag to retime.' }); f.style.left = (it.fxAt - it.start) * pps + 'px'; f.addEventListener('pointerdown', ev => startFxDrag(ev, it, f)); el.append(f); }
      el.addEventListener('pointerdown', ev => startClipDrag(ev, it, tr, el));
      el.addEventListener('dblclick', () => { select(it.id); o.focusInspector && o.focusInspector(); });
      // Right click a timing bar to put it back to automatic
      el.addEventListener('contextmenu', ev => { if (!it.timed) return; ev.preventDefault(); timingMenu(it, ev); });
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { select(it.id); o.focusInspector && o.focusInspector(); } });
      return el;
    }
    function startKeyDrag(ev, it, ki, d) {
      if (ev.button > 0) return; ev.preventDefault(); ev.stopPropagation(); const e = ed(); select(it.id, true); selKey = ki; markKeys(); o.player.pause(); o.player.seek(it.keys[ki] + 1e-4); setTime(it.keys[ki]); o.select(it.id);
      (() => { try { d.setPointerCapture(ev.pointerId); } catch (e) { } })(); const x0 = ev.clientX, t0 = it.keys[ki]; let moved = false, idx = ki;
      const mv = e2 => { if (Math.abs(e2.clientX - x0) > 2) moved = true; if (!moved) return; let tt = Math.max(it.start, Math.min(it.end, snap(t0 + (e2.clientX - x0) / pps, it.id))); idx = e.retime(o.getCfg(), it.id, idx, tt); selKey = idx; d.style.left = (tt - it.start) * pps + 'px'; o.player.seek(tt + 1e-4); setTime(tt); o.changed(false); };
      const up = () => { d.removeEventListener('pointermove', mv); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); if (moved) o.changed(true); };
      d.addEventListener('pointermove', mv); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
    }
    function startFxDrag(ev, it, f) {
      if (ev.button > 0) return; ev.preventDefault(); ev.stopPropagation(); const e = ed(); select(it.id, true); o.player.pause(); (() => { try { f.setPointerCapture(ev.pointerId); } catch (e) { } })(); const x0 = ev.clientX, t0 = it.fxAt; let moved = false;
      const mv = e2 => { if (Math.abs(e2.clientX - x0) > 2) moved = true; if (!moved) return; const tt = Math.max(it.start, Math.min(it.end, snap(t0 + (e2.clientX - x0) / pps, it.id))); e.retimeFx(o.getCfg(), it.id, tt); f.style.left = (tt - it.start) * pps + 'px'; o.player.seek(Math.max(0, tt - 0.4)); setTime(tt); o.changed(false); };
      const up = () => { f.removeEventListener('pointermove', mv); f.removeEventListener('pointerup', up); f.removeEventListener('pointercancel', up); if (moved) o.changed(true); else { o.player.seek(Math.max(0, t0 - 0.5)); setTime(t0); } };
      f.addEventListener('pointermove', mv); f.addEventListener('pointerup', up); f.addEventListener('pointercancel', up);
    }
    function timingMenu(it, ev) {
      closePop(); const cfg = o.getCfg(), e = ed(), has = cfg.timing && Object.keys(cfg.timing).length;
      const reset = all => { closePop(); const ids = all ? Object.keys(cfg.timing || {}) : [it.id]; if (all) trackRows.forEach(tr => tr.items.forEach(i => { if (i.timed && !ids.includes(i.id)) ids.push(i.id); }));
        ids.forEach(id => { if (cfg.timing) delete cfg.timing[id]; if (e && e.resetTiming) e.resetTiming(cfg, id); }); if (cfg.timing && !Object.keys(cfg.timing).length) delete cfg.timing; o.changed(true); };
      pop = H('div', { className: 'tl-pop tl-menu', role: 'menu', 'aria-label': 'Timing' }); pop.dataset.for = 'timing';
      pop.append(H('button', { type: 'button', role: 'menuitem', on: { click: () => reset(false) } }, H('span', { textContent: 'Reset "' + it.label + '" to automatic timing' })));
      if (has) pop.append(H('button', { type: 'button', role: 'menuitem', on: { click: () => reset(true) } }, H('span', { textContent: 'Reset every bar on this tab' })));
      o.tl.append(pop); const tr = o.tl.getBoundingClientRect(); pop.style.left = Math.max(0, Math.min(ev.clientX - tr.left, tr.width - pop.offsetWidth - 4)) + 'px'; pop.style.top = (ev.clientY - tr.top + 4) + 'px';
      setTimeout(() => document.addEventListener('pointerdown', popAway, true), 0);
    }
    // While a bar is dragged, everything after it slides along live (ripple), and the clip end follows
    function relayout(skipId) {
      const e = ed(); if (!e || !e.tracks) return; const m = o.getMod(), cfg = o.getCfg(), look = o.getLook(); dur = Math.max(1, m.duration(cfg, look)); trackRows = e.tracks(cfg, look);
      trackRows.forEach(tr => tr.items.forEach(i => { if (i.id === skipId) return; const el = lanes.querySelector(`.tl-clip[data-id="${CSS.escape(i.id)}"]`); if (!el) return; el.style.left = i.start * pps + 'px'; el.style.width = Math.max(6, (i.end - i.start) * pps) + 'px'; }));
      const endMark = ruler.querySelector('.tl-end'); if (endMark) endMark.style.left = dur * pps + 'px'; inner.style.width = Math.max(scroll.clientWidth, (dur + 1) * pps) + 'px';
    }
    function markKeys() { lanes.querySelectorAll('.tl-key').forEach(k => k.classList.toggle('on', k.closest('.tl-clip').dataset.id === sel && +k.dataset.k === selKey)); }
    // In and out points for exporting part of the clip
    const rangeEl = H('div', { className: 'tl-range', hidden: true }, H('b', { className: 'rin', title: 'In point. Drag to move. (I sets it at the playhead)' }), H('b', { className: 'rout', title: 'Out point. Drag to move. (O sets it at the playhead)' }));
    ruler.after(rangeEl);
    function drawRange() { const r = o.getRange && o.getRange(); if (!r) { rangeEl.hidden = true; return; } rangeEl.hidden = false; rangeEl.style.left = r[0] * pps + 'px'; rangeEl.style.width = Math.max(2, (r[1] - r[0]) * pps) + 'px'; }
    rangeEl.addEventListener('pointerdown', ev => { const h = ev.target.classList.contains('rin') ? 0 : ev.target.classList.contains('rout') ? 1 : -1; if (h < 0) return; ev.preventDefault(); ev.stopPropagation(); (() => { try { rangeEl.setPointerCapture(ev.pointerId); } catch (e) { } })();
      const mv = e2 => { const rr = inner.getBoundingClientRect(), tt = snap(Math.max(0, Math.min(dur, (e2.clientX - rr.left) / pps))), r = o.getRange().slice(); r[h] = tt; if (r[1] - r[0] < 0.1) return; o.setRange(r); drawRange(); o.player.seek(tt); setTime(tt); };
      const up = () => { rangeEl.removeEventListener('pointermove', mv); rangeEl.removeEventListener('pointerup', up); o.changed(false); };
      rangeEl.addEventListener('pointermove', mv); rangeEl.addEventListener('pointerup', up); });
    function edges(exceptId) { const out = [curT, 0]; trackRows.forEach(tr => tr.items.forEach(i => { if (i.id !== exceptId) { out.push(i.start, i.end); (i.keys || []).forEach(k => out.push(k)); } })); const r = o.getRange && o.getRange(); if (r) out.push(r[0], r[1]); return out; }
    function snap(v, exceptId) { if (!snapOn) return v; const tol = 8 / pps; let best = v, bd = tol; edges(exceptId).forEach(e => { const d = Math.abs(e - v); if (d < bd) { bd = d; best = e; } }); return best; }
    function startClipDrag(ev, it, tr, el) {
      if (ev.button > 0) return; ev.preventDefault();
      // Shift or Ctrl click adds to (or takes away from) the selection
      if ((ev.shiftKey || ev.ctrlKey || ev.metaKey) && it.id.startsWith('L:')) { if (sel && sel.startsWith('L:')) multi.add(sel); if (multi.has(it.id) && multi.size > 1) { multi.delete(it.id); select([...multi][0], 'add'); } else { multi.add(it.id); select(it.id, 'add'); } return; }
      if (!multi.has(it.id)) select(it.id, true); else { sel = it.id; drawBar(); o.select(it.id); }
      if (it.locked || (it.move === false && it.trim === 'none')) { seekAt(ev); return; }
      const h = ev.target.dataset && ev.target.dataset.h, mode = h === 'l' ? 'l' : h === 'r' ? 'r' : (it.move === false ? null : 'm'); if (!mode) { seekAt(ev); return; }
      o.player.pause(); (() => { try { el.setPointerCapture(ev.pointerId); } catch (e) { } })();
      const group = mode === 'm' && multi.size > 1 && multi.has(it.id) ? trackRows.flatMap(r => r.items).filter(i => multi.has(i.id) && i.id !== it.id && !i.locked && i.move !== false).map(i => ({ i, s0: i.start, e0: i.end, el: lanes.querySelector(`.tl-clip[data-id="${CSS.escape(i.id)}"]`) })) : [];
      drag = { kind: 'clip', it, tr, el, mode, x0: ev.clientX, s0: it.start, e0: it.end, track: tr.id, moved: false, group };
      const mv = e2 => {
        const dt = (e2.clientX - drag.x0) / pps; if (Math.abs(e2.clientX - drag.x0) > 2) drag.moved = true; if (!drag.moved) return;
        const len = drag.e0 - drag.s0, maxL = it.maxLen || 1e9, minL = it.minLen || 0.2; let s = drag.s0, en = drag.e0;
        if (mode === 'm') { s = Math.max(0, drag.s0 + dt); const ss = snap(s, it.id), se = snap(s + len, it.id); if (ss !== s) s = ss; else if (se !== s + len) s = se - len; s = Math.max(0, s); en = s + len; }
        else if (mode === 'l') { s = Math.min(drag.e0 - minL, Math.max(0, snap(drag.s0 + dt, it.id))); if (drag.e0 - s > maxL) s = drag.e0 - maxL; }
        else { en = Math.max(drag.s0 + minL, snap(drag.e0 + dt, it.id)); if (en - drag.s0 > maxL) en = drag.s0 + maxL; }
        // Moving onto another lane (for example a speech bubble to a different speaker)
        let track = tr.id; if (mode === 'm' && it.lanes) { const lane = document.elementsFromPoint(e2.clientX, e2.clientY).find(n => n.classList && n.classList.contains('tl-lane')); if (lane && it.lanes.includes(lane.dataset.track)) track = lane.dataset.track; }
        if (track !== drag.track) { const lane = lanes.querySelector(`[data-track="${CSS.escape(track)}"]`); if (lane) lane.append(el); drag.track = track; }
        el.style.left = s * pps + 'px'; el.style.width = Math.max(6, (en - s) * pps) + 'px'; el.querySelector('span').textContent = it.timed ? `${it.label}  ${(en - s).toFixed(1)}s` : `${it.label}  ${s.toFixed(1)} to ${en.toFixed(1)}s`;
        // Moving several at once: everything selected slides by the same amount, never before the start
        if (drag.group.length) { const dts = s - drag.s0, minS = Math.min(...drag.group.map(g => g.s0)); const dd = Math.max(dts, -minS); if (dd !== dts) { s = drag.s0 + dd; en = s + len; el.style.left = s * pps + 'px'; } drag.group.forEach(g => { ed().update(o.getCfg(), g.i.id, { start: g.s0 + dd, end: g.e0 + dd, track: null }); if (g.el) g.el.style.left = (g.s0 + dd) * pps + 'px'; }); }
        drag.s = s; drag.e = en; ed().update(o.getCfg(), it.id, { start: s, end: en, track }); o.changed(false); relayout(it.id);
        const tt = mode === 'r' ? en - 0.02 : s + 0.05; o.player.seek(tt); setTime(tt);
      };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); const moved = drag && drag.moved; drag = null; if (moved) { o.changed(true); } else { o.player.seek(it.start + 0.01); setTime(it.start + 0.01); } };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
    // Scrubbing on the ruler or empty lane space
    function seekAt(ev) { const r = inner.getBoundingClientRect(), tt = Math.max(0, Math.min(dur, (ev.clientX - r.left) / pps)); o.player.seek(tt); setTime(tt); }
    // Drag across empty track space to box select layers; a plain click still moves the playhead
    function boxStart(ev) {
      const r0 = inner.getBoundingClientRect(), x0 = ev.clientX - r0.left, y0 = ev.clientY - lanes.getBoundingClientRect().top; let box = null, moved = false;
      const mv = e2 => { const r = inner.getBoundingClientRect(), x = e2.clientX - r.left, y = e2.clientY - lanes.getBoundingClientRect().top; if (!moved && Math.hypot(x - x0, y - y0) < 6) return; moved = true;
        if (!box) { box = H('div', { className: 'tl-box' }); lanes.append(box); } const bx = Math.min(x, x0), by = Math.min(y, y0), bw = Math.abs(x - x0), bh = Math.abs(y - y0); Object.assign(box.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
        const lr = lanes.getBoundingClientRect(), hit = [...lanes.querySelectorAll('.tl-clip')].filter(c => { const cr = c.getBoundingClientRect(), cx0 = cr.left - r.left, cy0 = cr.top - lr.top; return c.dataset.id.startsWith('L:') && !c.classList.contains('locked') && cx0 < bx + bw && cx0 + cr.width > bx && cy0 < by + bh && cy0 + cr.height > by; }).map(c => c.dataset.id);
        multi = new Set(hit); sel = hit[0] || null; markSel(); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (box) box.remove(); if (moved) { drawBar(); o.select(sel); } else { select(null); seekAt(ev); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
    const scrubStart = ev => {
      if (ev.target.closest('.tl-clip')) return;
      if (ev.button === 0 && ev.pointerType !== 'touch' && ev.currentTarget === lanes) { ev.preventDefault(); o.player.pause(); boxStart(ev); return; } if (ev.button > 0) return; if (ev.pointerType === 'touch' && ev.target.closest('.tl-lanes')) { if (!ev.target.closest('.tl-clip')) select(null); return; } ev.preventDefault(); o.player.pause(); o.player.scrub(true); seekAt(ev);
      if (ev.target.closest('.tl-lane') && !ev.target.closest('.tl-clip')) { select(null); }
      const mv = e2 => seekAt(e2), up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); o.player.scrub(false); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    ruler.addEventListener('pointerdown', scrubStart); lanes.addEventListener('pointerdown', scrubStart); play.addEventListener('pointerdown', startPlayDrag);
    // Dragging the playhead itself: live scrub, snapping to bar edges and keyframes (hold Alt to scrub freely),
    // and the timeline scrolls along when you drag past either side
    function snapPH(v) { const tol = 7 / pps; let best = v, bd = tol; const tryE = e => { const d = Math.abs(e - v); if (d < bd) { bd = d; best = e; } };
      tryE(0); tryE(dur); trackRows.forEach(tr => tr.items.forEach(i => { tryE(i.start); tryE(i.end); (i.keys || []).forEach(tryE); })); const r = o.getRange && o.getRange(); if (r) { tryE(r[0]); tryE(r[1]); } return best; }
    function startPlayDrag(ev) {
      if (ev.button > 0) return; ev.preventDefault(); ev.stopPropagation(); closePop(); o.player.pause(); o.player.scrub(true); play.classList.add('drag');
      try { (() => { try { play.setPointerCapture(ev.pointerId); } catch (e) { } })(); } catch (e) { } let lastX = ev.clientX, alt = ev.altKey, raf = 0;
      const at = () => { const r = inner.getBoundingClientRect(); let tt = Math.max(0, Math.min(dur, (lastX - r.left) / pps)); if (!alt && snapOn) tt = snapPH(tt); o.player.seek(tt); setTime(tt, true); };
      const tick = () => { const sr = scroll.getBoundingClientRect(), edge = 36; let v = 0; if (lastX > sr.right - edge) v = lastX - (sr.right - edge); else if (lastX < sr.left + edge) v = -(sr.left + edge - lastX); if (v) { scroll.scrollLeft += v * 0.35; at(); } raf = requestAnimationFrame(tick); };
      const mv = e => { lastX = e.clientX; alt = e.altKey; at(); };
      const up = () => { cancelAnimationFrame(raf); play.removeEventListener('pointermove', mv); play.removeEventListener('pointerup', up); play.removeEventListener('pointercancel', up); o.player.scrub(false); play.classList.remove('drag'); };
      play.addEventListener('pointermove', mv); play.addEventListener('pointerup', up); play.addEventListener('pointercancel', up); raf = requestAnimationFrame(tick);
    }
    scroll.addEventListener('wheel', ev => { if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); zoom(ev.deltaY < 0 ? 1.15 : 1 / 1.15); } }, { passive: false });
    function setTime(t, force) {
      curT = t; play.style.left = t * pps + 'px';
      if (!drag && o.player.playing && !force) { const x = t * pps, l = scroll.scrollLeft, w = scroll.clientWidth; if (x > l + w - 40 || x < l) scroll.scrollLeft = Math.max(0, x - 40); }
    }

    // Selection
    function select(id, quiet) {
      if (id !== sel) selKey = -1; if (!(quiet === 'add')) multi.clear(); sel = id; markSel(); drawBar(); o.select(id);
      if (id && !quiet) { const c = lanes.querySelector(`.tl-clip[data-id="${CSS.escape(id)}"]`); if (c) { const x = c.offsetLeft, l = scroll.scrollLeft; if (x < l || x > l + scroll.clientWidth - 60) scroll.scrollLeft = Math.max(0, x - 60); } }
    }

    // Preview overlay: selection boxes and dragging things around on the board
    const geom = () => { const look = o.getLook(), { W, H: Hh } = E.dims(look.format), cw = ovl.clientWidth, ch = ovl.clientHeight, k = Math.min(cw / W, ch / Hh); return { W, Hh, k, ox: (cw - W * k) / 2, oy: (ch - Hh * k) / 2 }; };
    const toScene = ev => { const r = ovl.getBoundingClientRect(), g = geom(); return [(ev.clientX - r.left - g.ox) / g.k, (ev.clientY - r.top - g.oy) / g.k, g]; };
    let hitsNow = [];
    function drawOverlay(t) {
      const e = ed(), dpr = Math.min(window.devicePixelRatio || 1, 2), cw = ovl.clientWidth, ch = ovl.clientHeight;
      if (ovl.width !== Math.round(cw * dpr) || ovl.height !== Math.round(ch * dpr)) { ovl.width = Math.round(cw * dpr); ovl.height = Math.round(ch * dpr); }
      const c = ovl.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ovl.width, ovl.height);
      ovl.style.pointerEvents = e && e.hits ? 'auto' : 'none'; ovl.style.touchAction = sel ? 'none' : 'pan-y';
      ovl.style.cursor = e && e.hits ? (drag && drag.kind === 'canvas' ? 'grabbing' : hover ? 'grab' : 'default') : 'default';
      if (!e || !e.hits) { hitsNow = []; return; }
      const g = geom(); try { hitsNow = e.hits(o.getCfg(), o.getLook(), t, g.W, g.Hh) || []; } catch (err) { hitsNow = []; }
      c.setTransform(dpr * g.k, 0, 0, dpr * g.k, dpr * g.ox, dpr * g.oy);
      const px = 1 / g.k;
      hitsNow.forEach(h => {
        const [x0, y0, x1, y1] = h.box, on = h.id === sel, hv = h.id === hover;
        if (!on && !hv) return;
        c.save(); c.globalAlpha = h.ghost ? 0.5 : 1; c.lineWidth = (on ? 2.5 : 1.5) * px; c.strokeStyle = on ? '#f5821f' : 'rgba(255,255,255,0.7)'; c.setLineDash(on ? [] : [6 * px, 5 * px]); c.strokeRect(x0, y0, x1 - x0, y1 - y0);
        if (on && h.scale) { c.fillStyle = '#fff'; c.strokeStyle = '#f5821f'; c.setLineDash([]); [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y]) => { c.beginPath(); c.rect(x - 6 * px, y - 6 * px, 12 * px, 12 * px); c.fill(); c.stroke(); }); }
        if (on && h.rot && !h.ghost) { const cx = (x0 + x1) / 2, hy = y0 - 34 * px; c.setLineDash([]); c.strokeStyle = '#f5821f'; c.lineWidth = 2 * px; c.beginPath(); c.moveTo(cx, y0); c.lineTo(cx, hy); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, hy, 8 * px, 0, 7); c.fill(); c.stroke(); }
        if (on && h.label) { c.font = `600 ${12 * px}px Archivo, sans-serif`; const w = c.measureText(h.label).width + 12 * px, ly = h.rot ? y1 + 22 * px : y0; c.fillStyle = '#f5821f'; c.fillRect(x0, ly - 20 * px, w, 18 * px); c.fillStyle = '#fff'; c.fillText(h.label, x0 + 6 * px, ly - 7 * px); }
        c.restore();
      });
      if (drag && drag.guides && drag.guides.length) { c.save(); c.strokeStyle = '#ff4fd8'; c.lineWidth = 1.5 * px; c.setLineDash([8 * px, 6 * px]); drag.guides.forEach(([ax, v]) => { c.beginPath(); if (ax === 'x') { c.moveTo(v, 0); c.lineTo(v, g.Hh); } else { c.moveTo(0, v); c.lineTo(g.W, v); } c.stroke(); }); c.restore(); }
    }
    function hitAt(x, y, g) {
      const tol = 10 / g.k; for (let i = hitsNow.length - 1; i >= 0; i--) { const h = hitsNow[i], [x0, y0, x1, y1] = h.box; if (h.id === sel && h.rot && !h.ghost && Math.hypot(x - (x0 + x1) / 2, y - (y0 - 34 / g.k)) < tol * 1.5) return { h, rot: true }; if (h.id === sel && h.scale) { for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) if (Math.abs(x - cx) < tol * 1.4 && Math.abs(y - cy) < tol * 1.4) return { h, corner: [cx, cy], opp: [x0 + x1 - cx, y0 + y1 - cy] }; } }
      for (let i = hitsNow.length - 1; i >= 0; i--) { const h = hitsNow[i], [x0, y0, x1, y1] = h.box; if (!h.ghost && x >= x0 - tol && x <= x1 + tol && y >= y0 - tol && y <= y1 + tol) return { h }; }
      const s = hitsNow.find(h => h.id === sel); if (s) { const [x0, y0, x1, y1] = s.box; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return { h: s }; }
      return null;
    }
    ovl.addEventListener('pointermove', ev => { if (drag) return; const e = ed(); if (!e || !e.hits) return; const [x, y, g] = toScene(ev), hit = hitAt(x, y, g); hover = hit ? hit.h.id : null; });
    ovl.addEventListener('pointerleave', () => { hover = null; });
    ovl.addEventListener('pointerdown', ev => {
      const e = ed(); if (!e || !e.hits) return; const [x, y, g] = toScene(ev), hit = hitAt(x, y, g);
      if (!hit) { select(null); return; }
      ev.preventDefault(); o.player.pause(); select(hit.h.id); (() => { try { ovl.setPointerCapture(ev.pointerId); } catch (e) { } })();
      const snap0 = e.grab(o.getCfg(), hit.h.id, { t: curT, W: g.W, H: g.Hh }), k = hit.h.k || 1, ctr = hit.h.ctr || [(hit.h.box[0] + hit.h.box[2]) / 2, (hit.h.box[1] + hit.h.box[3]) / 2], d = { kind: 'canvas', id: hit.h.id, x0: x, y0: y, snap: snap0, moved: false, corner: hit.corner, opp: hit.opp, rot: hit.rot, ctr, a0: Math.atan2(y - ctr[1], x - ctr[0]), guides: [] }; drag = d;
      const mv = e2 => {
        const [x2, y2] = toScene(e2); if (Math.hypot(x2 - d.x0, y2 - d.y0) * g.k > 3) d.moved = true; if (!d.moved) return; globalThis.PatterDragging = true; const mods = { shift: e2.shiftKey, snap: snapOn };
        if (d.rot && e.rotate) { let da = Math.atan2(y2 - d.ctr[1], x2 - d.ctr[0]) - d.a0; e.rotate(o.getCfg(), d.id, d.snap, da * 180 / Math.PI, mods); }
        else if (d.corner && e.resize) { const ref = d.snap && d.snap.L ? d.ctr : d.opp, r0 = Math.hypot(d.corner[0] - ref[0], d.corner[1] - ref[1]), r1 = Math.hypot(x2 - ref[0], y2 - ref[1]); e.resize(o.getCfg(), d.id, d.snap, Math.max(0.05, r1 / Math.max(1, r0))); }
        else { const r = e.move(o.getCfg(), d.id, d.snap, (x2 - d.x0) * k, (y2 - d.y0) * k, mods); d.guides = (r && r.guides) || []; }
        o.changed(false);
      };
      const up = () => { globalThis.PatterDragging = false; ovl.removeEventListener('pointermove', mv); ovl.removeEventListener('pointerup', up); ovl.removeEventListener('pointercancel', up); const moved = d.moved; drag = null; if (moved) o.changed(true); };
      ovl.addEventListener('pointermove', mv); ovl.addEventListener('pointerup', up); ovl.addEventListener('pointercancel', up);
    });
    ovl.addEventListener('dblclick', () => { if (sel) o.focusInspector && o.focusInspector(); });
    // Arrow keys nudge the selected item on the preview
    function nudge(dx, dy) { const e = ed(); if (!sel || !e || !e.move) return false; const h = hitsNow.find(x => x.id === sel); if (!h) return false; const g = geom(), s = e.grab(o.getCfg(), sel, { t: curT, W: g.W, H: g.Hh }); e.move(o.getCfg(), sel, s, dx * (h.k || 1), dy * (h.k || 1), {}); o.changed(true); return true; }
    // Jump the playhead to the previous or next keyframe (of the selected layer, or of any layer)
    function jumpKey(dir) { const e = ed(); let ts = []; const it = sel && trackRows.flatMap(tr => tr.items).find(i => i.id === sel); if (it && it.keys && it.keys.length) ts = it.keys; else if (e && e.keyTimes) ts = e.keyTimes(o.getCfg()); if (!ts.length) trackRows.forEach(tr => tr.items.forEach(i => ts.push(i.start, i.end))); ts = [...new Set(ts.map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b); const cur = curT, nxt = dir > 0 ? ts.find(v => v > cur + 0.005) : [...ts].reverse().find(v => v < cur - 0.005); if (nxt === undefined) return false; o.player.pause(); o.player.seek(nxt + 1e-4); setTime(nxt); if (it && it.keys) { selKey = it.keys.findIndex(v => Math.abs(v - nxt) < 0.002); markKeys(); o.select(sel); } return true; }

    const api = { syncPlay, get camOff() { return camOff; }, build: () => { if (drag) return; drawBar(); build(); }, setTime, drawOverlay, select, get selected() { return sel; }, get selKey() { return selKey; }, set selKey(v) { selKey = v; markKeys(); }, removeSel, nudge, jumpKey, addKey, toggleSel: () => { const e = ed(); if (!sel || !e || !e.toggleTrack || !sel.startsWith('L:')) return false; e.toggleTrack(o.getCfg(), sel); o.changed(true); return true; }, drawRange, get t() { return curT; }, resetZoom: () => { fitted = false; }, get dragging() { return !!drag; }, closePop };
    window.addEventListener('resize', () => { if (!fitted) build(); });
    return api;
  }
  return { create };
})();

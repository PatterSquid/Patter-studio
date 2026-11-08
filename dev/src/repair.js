/* Repair: mends a clip's settings against its tab's example settings, so a damaged or very old project still opens and
   draws. It only changes values whose type is plainly wrong (a list that is not a list, text that is an object, a number
   that is not a number, an empty slot in a list); good settings come out exactly as they went in. */
const Repair = (() => {
  const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = v => v === undefined ? v : JSON.parse(JSON.stringify(v));
  // One value against its example. Returns the mended value (the same object when nothing was wrong).
  // Plain values (text, numbers, yes/no) may legitimately swap type (a spot is "left" or a number of pixels, a beard is
  // true or "stubble"), so only the structure is mended: a list or group where a plain value belongs or the other way
  // round, numbers that are not numbers, and (at the top level only) empty values.
  function val(v, d, n, top) {
    if (d === undefined || d === null) return v;                                   // nothing to go by
    if (v === undefined) return clone(d);
    if (v === null) return top || typeof d === 'object' ? clone(d) : v;
    if (typeof d !== 'object') { if (typeof v === 'object') return d; if (typeof v === 'number' && !isFinite(v)) return typeof d === 'number' ? d : v; if (typeof d === 'number' && typeof v === 'string' && (v.trim() === '' || !isFinite(+v))) return d; return v; }
    if (Array.isArray(d)) { if (!Array.isArray(v)) return clone(d); return list(v, d, n); }
    if (plain(d)) { if (!plain(v)) return clone(d); return obj(v, d, false, n); }
    return v;
  }
  // A list: when the example has items, the first one is the pattern for every item.
  function list(v, d, n) {
    if (!d.length) return v;
    const T = d[0];
    if (T === null || T === undefined) return v;
    if (plain(T)) { const out = v.filter(x => plain(x)); out.forEach(x => obj(x, T, false, n)); if (out.length !== v.length) { v.length = 0; out.forEach(x => v.push(x)); n.n++; } return v; }
    if (Array.isArray(T)) {                                                            // rows like [label, value], corners like [x, y]
      for (let i = 0; i < v.length; i++) if (!Array.isArray(v[i]) && Array.isArray(d[i]) && d.length <= 8) { v[i] = clone(d[i]); n.n++; }   // a broken corner goes back to the example's
      const out = v.filter(x => Array.isArray(x));
      out.forEach(x => { for (let i = 0; i < T.length && i < x.length; i++) { const r = val(x[i], T[i], n); if (r !== x[i]) { x[i] = r; n.n++; } } });
      if (out.length !== v.length) { v.length = 0; out.forEach(x => v.push(x)); n.n++; } return v;
    }
    // A list of plain values: drop empty slots, mend the rest
    for (let i = v.length - 1; i >= 0; i--) { if (v[i] === null || v[i] === undefined) { v.splice(i, 1); n.n++; continue; } const r = val(v[i], T, n); if (r !== v[i]) { v[i] = r; n.n++; } }
    return v;
  }
  // An object: mends the keys it shares with the example; `fill` also adds keys it is missing (top level only, since
  // items in a list differ in kind and nested maps can be the user's own).
  function obj(v, d, fill, n) {
    for (const k of Object.keys(d)) {
      if (!(k in v)) { if (fill) { v[k] = clone(d[k]); n.n++; } continue; }
      const r = val(v[k], d[k], n, fill); if (r !== v[k]) { v[k] = r; n.n++; }
    }
    return v;
  }
  // Mend a tab's settings in place (skipping keys in `skip`). Returns how many values were changed.
  function fix(cfg, defs, skip) { const n = { n: 0 }; if (!plain(cfg) || !plain(defs)) return 0; const d = Object.assign({}, defs); (skip || []).forEach(k => delete d[k]); obj(cfg, d, true, n); return n.n; }
  // A whole clip of any tab, including the clips inside a Video and the tab clips shown in a Studio frame.
  // `mods` maps tab keys to their modules. Returns how many values were changed.
  function clip(k, cfg, mods, depth) {
    const M = mods[k]; if (!M || !plain(cfg) || (depth || 0) > 3) return 0; let n = 0;
    if (k === 'video') {
      n += fix(cfg, M.defaults(), ['items', 'studio', 'tracks', 'markers', 'bin']);
      if (!Array.isArray(cfg.items)) { cfg.items = []; n++; }
      ['tracks', 'markers', 'bin'].forEach(k => { if (cfg[k] != null && !Array.isArray(cfg[k])) { cfg[k] = []; n++; } });
      // Editor clips: footage, sound, colour cards and adjustments, on the main track or on their own tracks
      const okItem = it => plain(it) && (it.kind === 'avatar' || it.kind === 'intro' || (it.kind === 'clip' && typeof it.mod === 'string') || ((it.kind === 'media' || it.kind === 'audio') && typeof it.asset === 'string') || it.kind === 'colour' || it.kind === 'adjust');
      const nums = it => { if (it.curve != null && (typeof it.curve !== 'object' || Array.isArray(it.curve) || !Array.isArray(it.curve.pts) || it.curve.pts.filter(q => Array.isArray(q) && isFinite(+q[0]) && isFinite(+q[1])).length < 2)) { delete it.curve; n++; } if (it.kind === 'colour' && typeof it.col === 'string') { it.fill = it.col; delete it.col; n++; } if (it.fill != null && typeof it.fill !== 'string') { delete it.fill; n++; } ['start', 'gap', 'src0', 'src1', 'dur', 'speed', 'x', 'y', 's', 'rot', 'op', 'vol', 'fadeIn', 'fadeOut', 'inPt', 'outPt', 'still'].forEach(f => { if (it[f] != null && it[f] !== '' && !isFinite(+it[f])) { delete it[f]; n++; } }); if (it.start != null && +it.start < 0) { it.start = 0; n++; } if (it.start != null && +it.start > 36000) { it.start = 36000; n++; } if (Array.isArray(it.fx)) { const fx = it.fx.filter(f => plain(f) && typeof f.k === 'string'); if (fx.length !== it.fx.length) { it.fx = fx; n++; } } if (it.kf != null && !plain(it.kf)) { delete it.kf; n++; }
        if (plain(it.kf)) Object.keys(it.kf).forEach(k => { const L = it.kf[k]; if (!Array.isArray(L)) { delete it.kf[k]; n++; return; } const ok = L.filter(q => Array.isArray(q) && isFinite(+q[0]) && isFinite(+q[1])); if (ok.length !== L.length) { it.kf[k] = ok; n++; } if (!ok.length) { delete it.kf[k]; } });
        if (typeof it.id !== 'string' || !it.id) { it.id = 'r' + Math.random().toString(36).slice(2, 9); n++; } ['fx'].forEach(f => { if (it[f] != null && !Array.isArray(it[f])) { delete it[f]; n++; } }); ['col', 'key', 'mask', 'tr', 'anIn', 'anOut', 'anLoop'].forEach(f => { if (it[f] != null && !plain(it[f])) { delete it[f]; n++; } }); if (it.crop != null && !(Array.isArray(it.crop) && it.crop.length === 4 && it.crop.every(x => isFinite(+x)))) { delete it.crop; n++; } };
      if (Array.isArray(cfg.tracks)) { const tk = cfg.tracks.filter(T => plain(T) && (T.kind === 'video' || T.kind === 'audio')); if (tk.length !== cfg.tracks.length) { cfg.tracks = tk; n++; }
        tk.forEach(T => { if (typeof T.id !== 'string') { T.id = 't' + Math.random().toString(36).slice(2, 9); n++; } if (!Array.isArray(T.items)) { T.items = []; n++; } const ki = T.items.filter(okItem); if (ki.length !== T.items.length) { T.items = ki; n++; } ki.forEach(it => { nums(it); if (it.kind === 'clip' && mods[it.mod]) { if (!plain(it.cfg)) { it.cfg = mods[it.mod].defaults(); n++; } else n += clip(it.mod, it.cfg, mods, (depth || 0) + 1); } }); }); }
      const keep = cfg.items.filter(okItem);
      if (keep.length !== cfg.items.length) { cfg.items = keep; n++; }
      keep.forEach(it => { nums(it);
        if (it.kind === 'avatar') { if (typeof it.text !== 'string') { it.text = it.text == null ? '' : String(it.text); n++; } if (!(+it.dur > 0)) { it.dur = 3; n++; } return; }
        ['inPt', 'hold'].forEach(f => { if (it[f] != null && !isFinite(+it[f])) { it[f] = 0; n++; } });
        if (mods[it.mod]) { if (!plain(it.cfg)) { it.cfg = mods[it.mod].defaults(); n++; } else n += clip(it.mod, it.cfg, mods, (depth || 0) + 1); }
      });
      if (cfg.studio != null) { if (!plain(cfg.studio)) { delete cfg.studio; n++; } else if (mods.studio) n += clip('studio', cfg.studio, mods, (depth || 0) + 1); }
      return n;
    }
    n += fix(cfg, M.defaults(), k === 'studio' ? ['shows'] : null);
    if ((k === 'story' || k === 'broll') && Array.isArray(cfg.scenes)) cfg.scenes.forEach(sc => {
      if (!sc || sc.type === 'travel') return;
      ['people', 'acts'].forEach(f => { if (!Array.isArray(sc[f])) { sc[f] = []; n++; } });
      // Every action needs a start and a length in seconds (as numbers, so they add up rather than join as text)
      ['acts', 'extra'].forEach(f => { if (!Array.isArray(sc[f])) return; const L = sc[f].filter(a => plain(a) && a.start !== '' && isFinite(+a.start) && a.start !== null && a.start !== true);
        if (L.length !== sc[f].length) { sc[f] = L; n++; }
        L.forEach(a => { if (typeof a.start !== 'number') { a.start = +a.start; n++; } if (a.start < 0 || a.start > 3600) { a.start = Math.max(0, Math.min(3600, a.start)); n++; } if (typeof a.dur !== 'number' || !isFinite(a.dur) || a.dur <= 0 || a.dur > 600) { const d = +a.dur; a.dur = isFinite(d) && d > 0 ? Math.min(600, d) : 1; n++; } }); });
    });
    if (k === 'studio') {
      if (!Array.isArray(cfg.shows)) { cfg.shows = []; n++; }
      const keep = cfg.shows.filter(plain); if (keep.length !== cfg.shows.length) { cfg.shows = keep; n++; }
      keep.forEach(sh => { if (sh.mcfg != null && mods[sh.mod]) { if (!plain(sh.mcfg)) { delete sh.mcfg; n++; } else n += clip(sh.mod, sh.mcfg, mods, (depth || 0) + 1); } });
    }
    return n;
  }
  return { fix, clip, val };
})();

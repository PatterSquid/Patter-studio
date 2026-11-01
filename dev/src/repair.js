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
      n += fix(cfg, M.defaults(), ['items', 'studio']);
      if (!Array.isArray(cfg.items)) { cfg.items = []; n++; }
      const keep = cfg.items.filter(it => plain(it) && (it.kind === 'avatar' || (it.kind === 'clip' && typeof it.mod === 'string')));
      if (keep.length !== cfg.items.length) { cfg.items = keep; n++; }
      keep.forEach(it => {
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

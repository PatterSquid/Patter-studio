/* Patter Studio app: wires the inputs page, preview, timeline, export, project library, version history and templates together. */
(() => {
  if (typeof self !== 'undefined' && self.PATTER_WORKER) return;
  const { H } = UI;
  const MODULES = { charts: Charts, timeline: Timeline, map: (typeof MapMod !== 'undefined' ? MapMod : null), flights: (typeof Flights !== 'undefined' ? Flights : null), flyover: (typeof Flyover !== 'undefined' ? Flyover : null), picto: Picto, news: (typeof News !== 'undefined' ? News : null), story: (typeof Story !== 'undefined' ? Story : null), broll: (typeof Broll !== 'undefined' ? Broll : null), video: (typeof Video !== 'undefined' ? Video : null), studio: (typeof Studio !== 'undefined' ? Studio : null) };
  Object.keys(MODULES).forEach(k => { if (!MODULES[k]) delete MODULES[k]; else MODULES[k] = Layers.wrap(MODULES[k]); });
  const TAB_NAMES = { charts: 'Charts', timeline: 'Timeline', map: 'World map', flights: 'Flights', flyover: 'Map flyover', picto: 'Pictogram', news: 'Newspaper', story: 'Story', broll: 'B roll', video: 'Video', studio: 'Studio' };
  const KEY = 'patter-studio-v1';
  const $ = id => document.getElementById(id);
  const uid = () => 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const fresh = () => ({ module: 'charts', look: { scheme: 'saltire', texture: true, format: '16:9', transparent: false, accent2: '#e3302c' }, cfg: {}, assets: {}, range: {}, pid: uid(), name: 'Untitled clip', updated: Date.now() });
  const adopt = s => { const st = Object.assign(fresh(), s, { look: Object.assign(fresh().look, s.look) }); st.assets = st.assets || {}; st.range = st.range || {}; if (!st.pid) st.pid = uid(); return st; };
  let state = fresh();
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.look && s.cfg) state = adopt(s); } catch (e) { }

  /* ---------- Storage: IndexedDB holds the library, version history and templates (with pictures); localStorage keeps a light copy ---------- */
  const DB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('No storage')); const r = indexedDB.open('patter-studio', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('projects', { keyPath: 'id' }); d.createObjectStore('states', { keyPath: 'id' }); const v = d.createObjectStore('versions', { keyPath: 'vid', autoIncrement: true }); v.createIndex('pid', 'pid'); d.createObjectStore('templates', { keyPath: 'id' }); d.createObjectStore('meta'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
    const tx = async (names, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(names, mode); let out; const r = fn(t); if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
    return {
      get: (st, k) => tx(st, 'readonly', t => t.objectStore(st).get(k)),
      put: (st, v, k) => tx(st, 'readwrite', t => k === undefined ? t.objectStore(st).put(v) : t.objectStore(st).put(v, k)),
      del: (st, k) => tx(st, 'readwrite', t => t.objectStore(st).delete(k)),
      all: st => tx(st, 'readonly', t => t.objectStore(st).getAll()),
      versions: pid => tx('versions', 'readonly', t => t.objectStore('versions').index('pid').getAll(pid)),
      delVersions: pid => tx('versions', 'readwrite', t => { const s = t.objectStore('versions'), r = s.index('pid').openCursor(pid); r.onsuccess = () => { const c = r.result; if (c) { s.delete(c.primaryKey); c.continue(); } }; }),
    };
  })();
  let dbOk = true;
  // Pictures live in IndexedDB; only if that is unavailable do they go in the light copy too
  const light = () => { const s = Object.assign({}, state); if (dbOk) delete s.assets; return s; };
  const writeLight = () => { try { localStorage.setItem(KEY, JSON.stringify(light())); } catch (e) { try { const s = light(); delete s.assets; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e2) { } } };
  let assetTimer = 0;
  let SP = null, saveTimer = null, autoTimer = null, lastVersion = 0, lastThumb = 0, dirty = false;
  const save = () => {
    dirty = true; state.updated = Date.now(); if (SP) SP.touch(); clearTimeout(saveTimer); saveTimer = setTimeout(writeLight, 300);
    clearTimeout(autoTimer); autoTimer = setTimeout(autosave, 1500);
  };
  async function autosave(force) {
    if (!dirty && !force) return; dirty = false; const now = Date.now();
    try {
      // Copy the settings deeply but the pictures by reference: they are big strings that never change in place
      const snap = JSON.parse(JSON.stringify(Object.assign({}, state, { assets: null }))); snap.assets = Object.assign({}, state.assets); let thumb = null;
      if (now - lastThumb > 8000 || force) { thumb = await makeThumb(); lastThumb = now; }
      const meta = (await DB.get('projects', state.pid)) || { id: state.pid, created: now };
      Object.assign(meta, { name: state.name, updated: now, module: state.module, format: state.look.format }); if (thumb) meta.thumb = thumb;
      await DB.put('states', { id: state.pid, state: snap }); await DB.put('projects', meta); await DB.put('meta', state.pid, 'current');
      if (now - lastVersion > 60000 || force === 'version') { await addVersion(snap, thumb || meta.thumb); lastVersion = now; }
      flashSaved();
    } catch (e) { console.warn('Autosave failed', e); if (dbOk) { dbOk = false; writeLight(); } }
  }
  // Versions keep their pictures by name only; each picture is stored once, however many versions use it
  const keptAssets = new Set();
  async function keepAssets(assets) { for (const [id, url] of Object.entries(assets || {})) { if (keptAssets.has(id)) continue; await DB.put('meta', url, 'asset:' + id); keptAssets.add(id); } }
  async function assetsFor(v) { const out = Object.assign({}, (v.state && v.state.assets) || {}); for (const id of v.assetIds || []) { if (out[id]) continue; if (state.assets[id]) out[id] = state.assets[id]; else { try { const u = await DB.get('meta', 'asset:' + id); if (u) out[id] = u; } catch (e) { } } } return out; }
  async function addVersion(snap, thumb, note) {
    const lean = Object.assign({}, snap), assets = lean.assets || {}; delete lean.assets; await keepAssets(assets);
    await DB.put('versions', { pid: state.pid, time: Date.now(), module: snap.module, thumb: thumb || null, note: note || '', state: lean, assetIds: Object.keys(assets) });
    const vs = await DB.versions(state.pid); if (vs.length > 40) { vs.sort((a, b) => a.time - b.time); for (const v of vs.slice(0, vs.length - 40)) await DB.del('versions', v.vid); }
  }
  function flashSaved() { const el = $('savedNote'); if (!el) return; el.textContent = 'Saved'; el.classList.add('on'); clearTimeout(flashSaved.t); flashSaved.t = setTimeout(() => el.classList.remove('on'), 1400); }
  async function makeThumb(st = state) {
    try {
      const m = MODULES[st.module], c = st.cfg[st.module] || m.defaults(), look = Object.assign({}, st.look, { transparent: false, preview: true }), { W, H: Hh } = E.dims(look.format), cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
      const g = cv.getContext('2d'); g.fillStyle = '#0b1424'; g.fillRect(0, 0, 320, 180); const k = Math.min(320 / W, 180 / Hh); g.translate((320 - W * k) / 2, (180 - Hh * k) / 2); g.scale(k, k); g.beginPath(); g.rect(0, 0, W, Hh); g.clip();
      const d = m.duration(c, look); m.draw(g, Math.min(d, Math.max(1.5, d * 0.6)), c, look, W, Hh); return cv.toDataURL('image/jpeg', 0.72);
    } catch (e) { return null; }
  }

  const mod = () => MODULES[state.module];
  // Fill in any settings missing from older saves or hand edited projects, so every clip type gets a complete set.
  const fillDefaults = () => { Object.keys(state.cfg || {}).forEach(k => { const M = MODULES[k]; const c = state.cfg[k]; if (M && c && typeof c === 'object') state.cfg[k] = Object.assign(M.defaults(), c); }); };
  fillDefaults(); writeLight();
  const cfg = () => state.cfg[state.module] || (state.cfg[state.module] = mod().defaults());
  const status = $('status');
  const say = (msg, err) => { status.className = 'status' + (err ? ' err' : ''); status.textContent = msg; };

  // Look controls
  const schemesEl = $('schemes');
  function drawSchemes() {
    schemesEl.innerHTML = '';
    Object.entries(E.SCHEMES).forEach(([k, s]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (state.look.scheme === k ? ' on' : ''); b.setAttribute('aria-pressed', state.look.scheme === k);
      b.innerHTML = `<i style="background:${s.bg}"></i><span>${s.name}</span>`; b.addEventListener('click', () => { state.look.scheme = k; drawSchemes(); save(); }); schemesEl.appendChild(b);
    });
  }
  const bannerSel = $('banner'); Object.entries(E.COLOURS).forEach(([k, v]) => { const o = document.createElement('option'); o.value = v; o.textContent = k; bannerSel.appendChild(o); });
  bannerSel.addEventListener('change', () => { state.look.accent2 = bannerSel.value; save(); });
  $('format').addEventListener('change', e => { state.look.format = e.target.value; layoutPreview(); save(); ed && ed.build(); });
  $('texture').addEventListener('change', e => { state.look.texture = e.target.checked; save(); });
  $('gpu').addEventListener('change', e => { state.look.gpu = e.target.checked; save(); });
  $('transparent').addEventListener('change', e => { state.look.transparent = e.target.checked; updateExportLabel(); save(); });
  function syncLook() { bannerSel.value = state.look.accent2; $('format').value = state.look.format; $('texture').checked = state.look.texture !== false; $('gpu').checked = state.look.gpu !== false; $('transparent').checked = !!state.look.transparent; drawSchemes(); }

  // Module form, inspector and tabs
  if (!MODULES[state.module]) state.module = state.module === 'board' ? 'story' : 'charts';
  let ed = null, formTimer = null;
  const formChanged = () => { save(); clearTimeout(formTimer); formTimer = setTimeout(() => { commit(); ed && ed.build(); }, 350); };
  function buildForm() { mod().form($('modForm'), cfg(), formChanged); }
  // The panel on the left shows the selected item, or the scene settings when nothing is selected
  function buildInspector() {
    const root = $('inspector'); root.innerHTML = ''; const m = mod(), e = m.editor;
    if (!e) { root.hidden = true; return; } root.hidden = false; const id = ed && ed.selected;
    const live = () => { save(); clearTimeout(formTimer); formTimer = setTimeout(() => { commit(); ed && ed.build(); }, 350); };
    if (id && e.inspect) e.inspect(root, cfg(), id, live, () => { ed.select(null); });
    if (!root.children.length && e.scene) e.scene(root, cfg(), live);
  }
  function layoutPanels() {
    const ex = mod().editor, e = !!ex && !ex.formIsScene, btn = $('manualBtn'); btn.hidden = !e;
    const show = !ex || (e && !!state.manual); $('modForm').hidden = !show; btn.textContent = state.manual ? 'Hide manual inputs' : 'Show manual inputs'; btn.setAttribute('aria-expanded', String(!!state.manual));
    $('resetMod').hidden = false; $('resetMod').textContent = state.module === 'video' ? 'Start the video again from the example' : 'Reset this clip to the example';
  }
  $('manualBtn').addEventListener('click', () => { state.manual = !state.manual; if (state.manual) buildForm(); layoutPanels(); save(); });
  // Undo history, per clip type
  let hist = [], fut = [], lastSnap = null;
  function commit() { const s = JSON.stringify(cfg()); if (lastSnap === null) { lastSnap = s; return; } if (s !== lastSnap) { hist.push(lastSnap); if (hist.length > 150) hist.shift(); fut = []; lastSnap = s; } }
  function restore(snap) { state.cfg[state.module] = JSON.parse(snap); lastSnap = snap; save(); refreshAll(); }
  function undo() { commit(); if (!hist.length) return; fut.push(lastSnap); restore(hist.pop()); }
  function redo() { if (!fut.length) return; hist.push(lastSnap); restore(fut.pop()); }
  function refreshAll() { buildForm(); buildInspector(); layoutPanels(); ed && ed.build(); updateRangeUI(); drawBanner(); }
  const tabs = document.querySelectorAll('#tabs button');
  function drawTabs() { tabs.forEach(b => { const m = b.dataset.mod; b.disabled = !MODULES[m]; b.classList.toggle('on', m === state.module); b.setAttribute('aria-pressed', m === state.module); }); const chalkOnly = state.module === 'story' || state.module === 'broll' || state.module === 'studio'; [schemesEl.closest('.field'), $('texture').closest('label')].forEach(el => { if (el) el.style.display = chalkOnly ? 'none' : ''; }); }
  function switchTab(m) { if (m === 'video' && state.edit) finishEdit(); state.module = m; hist = []; fut = []; lastSnap = null; commit(); drawTabs(); player.setLoop(null); syncLoopBtn(); if (ed) { ed.resetZoom(); ed.select(null); } refreshAll(); begin(); updateExportLabel(); save(); }
  tabs.forEach(b => b.addEventListener('click', () => { if (MODULES[b.dataset.mod]) switchTab(b.dataset.mod); }));
  /* ---------- Editing a clip from the Video tab: it is opened in its own tab (that tab's usual clip is put aside), and goes
     back into the video when you return to the Video tab ---------- */
  const vItem = id => ((state.cfg.video && state.cfg.video.items) || []).find(x => x.id === id);
  function openItem(id) { const it = vItem(id); if (!it || !MODULES[it.mod]) return; if (state.edit) finishEdit(); state.stash = state.stash || {}; state.stash[it.mod] = state.cfg[it.mod] || null; state.cfg[it.mod] = it.cfg = Object.assign(MODULES[it.mod].defaults(), it.cfg || {}); state.edit = { id, mod: it.mod }; switchTab(it.mod); say('Editing this clip from your video. Press Back to the video when you are done.'); }
  function finishEdit() { const e = state.edit; if (!e) return; const it = vItem(e.id); if (it && state.cfg[e.mod]) it.cfg = state.cfg[e.mod]; state.cfg[e.mod] = (state.stash && state.stash[e.mod]) || MODULES[e.mod].defaults(); if (state.stash) delete state.stash[e.mod]; state.edit = null; save(); }
  function drawBanner() { const el = $('editBanner'); if (!el) return; const e = state.edit, it = e && vItem(e.id), on = !!(e && it && state.module === e.mod); el.hidden = !on; el.innerHTML = ''; if (!on) return; const n = state.cfg.video.items.indexOf(it) + 1;
    el.append(H('span', { textContent: 'Editing clip ' + n + ' of your video' + (it.name ? ': ' + it.name : '') + '.' }), UI.btn('Back to the video', () => switchTab('video'), 'primary')); }
  if (typeof Studio !== 'undefined') Object.assign(Studio.hooks, { cfg: () => state.cfg.studio || Studio.defaults(), select: id => { if (ed) ed.select(id); buildInspector(); } });
  if (typeof Video !== 'undefined') Object.assign(Video.hooks, { look: () => state.look, tabCfg: k => state.cfg[k] || (MODULES[k] && MODULES[k].defaults()), openItem, select: id => { if (ed) ed.select(id); buildInspector(); } });
  drawTabs(); syncLook(); buildForm(); commit();
  $('resetMod').addEventListener('click', () => { commit(); state.cfg[state.module] = mod().defaults(); commit(); refreshAll(); save(); begin(); });

  // Preview
  const wrap = $('prevWrap');
  function layoutPreview() { const tall = state.look.format === '9:16'; wrap.classList.toggle('tall', tall); wrap.style.aspectRatio = tall ? '9 / 16' : '16 / 9'; }
  layoutPreview();
  const scrub = $('scrub'), timeEl = $('time'), playBtn = $('playBtn');
  const viewLook = () => (ed && ed.camOff && mod().editor && mod().editor.camera ? Object.assign({}, state.look, { noCam: true }) : state.look);
  const player = E.Player($('prev'), () => ({ mod: mod(), cfg: cfg(), look: viewLook() }), (t, d, playing) => {
    if (ed) { ed.setTime(t); ed.drawOverlay(t); ed.syncPlay(playing); }
    if (!scrubbing) scrub.value = Math.round(t / d * 1000);
    timeEl.textContent = t.toFixed(1) + ' / ' + d.toFixed(1) + ' s'; playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  });
  let scrubbing = false;
  // The preview waits paused on the first frame unless Autoplay is ticked (remembered on this computer)
  const autoplay = () => { try { return localStorage.getItem('patter-autoplay') === '1'; } catch (e) { return false; } };
  const begin = () => autoplay() ? player.restart() : player.reset();
  $('autoplay').checked = autoplay(); $('autoplay').addEventListener('change', e => { try { localStorage.setItem('patter-autoplay', e.target.checked ? '1' : '0'); } catch (er) { } if (e.target.checked) player.play(); });
  if (autoplay()) player.play();
  // Smooth preview: while you're not changing anything, background workers draw the whole clip ahead of time,
  // and playback uses those frames, so heavy map clips play at full speed. Any change throws them away and starts again.
  SP = (() => {
    const FPS = 30, on = () => { try { return localStorage.getItem('patter-smooth') !== '0'; } catch (e) { return true; } };
    let key = '', blobs = [], bmps = new Map(), pend = new Set(), total = 0, have = 0, ctrl = null, timer = 0, held = false;
    const keyNow = () => mod().id + '|' + (typeof Media !== 'undefined' ? Media.version : 0) + '|' + JSON.stringify(cfg()) + '|' + JSON.stringify(state.look) + '|' + (E.fontVersion || 0) + '|' + (typeof GeoData !== 'undefined' ? GeoData.state.version : 0) + '|' + Object.keys(state.assets || {}).length;
    const bar = () => { const p = total ? have / total * 100 : 0; scrub.style.setProperty('--buf', p.toFixed(1) + '%'); scrub.classList.toggle('buffering', on() && total > 0 && have < total); scrub.classList.toggle('cached', on() && total > 0 && have >= total); };
    const clear = () => { if (ctrl) ctrl.abort(); ctrl = null; blobs = []; bmps.forEach(b => b.close && b.close()); bmps.clear(); pend.clear(); total = 0; have = 0; bar(); };
    async function start() {
      if (held || !on() || state.look.transparent || typeof Render === 'undefined' || !Render.buildPreview) return; const k = keyNow(); if (k === key && (have >= total && total)) return; clear(); key = k; ctrl = new AbortController(); const c = ctrl;
      const m = mod(), { W } = E.dims(state.look.format), cw = $('prev').clientWidth * Math.min(2, window.devicePixelRatio || 1), scale = Math.max(0.25, Math.min(0.6, cw / W));
      try { await Render.buildPreview(m, JSON.parse(JSON.stringify(cfg())), Object.assign({}, state.look, { transparent: false }), { fps: FPS, scale, signal: c.signal, workers: Math.max(1, Math.min(3, Render.cores() - 1)),
        onFrame: (i, blob, n) => { if (c.signal.aborted || key !== k) return; blobs[i] = blob; total = n; have++; if (have % 6 === 0 || have === n) bar(); } }); } catch (e) { }
    }
    return {
      touch() { clearTimeout(timer); if (!on()) { clear(); return; } const k = keyNow(); if (k === key && total) return; clear(); key = ''; timer = setTimeout(start, 1400); },
      hold(v) { held = v; if (v) { clearTimeout(timer); if (ctrl && have < total) clear(); } else this.touch(); },
      enabled: on,
      // Frame for time t if it's ready (decoding a few ahead so playback never waits)
      frameAt(t) { if (!total || !on() || state.look.transparent || (ed && ed.camOff) || state.pq === 'full') return null; const i = Math.min(total - 1, Math.round(t * FPS));
        for (let j = i; j < Math.min(total, i + 10); j++) if (blobs[j] && !bmps.has(j) && !pend.has(j)) { pend.add(j); const kk = key; createImageBitmap(blobs[j]).then(b => { pend.delete(j); if (kk === key) bmps.set(j, b); else b.close(); }).catch(() => pend.delete(j)); }
        bmps.forEach((b, j) => { if (j < i - 2 || j > i + 20) { b.close && b.close(); bmps.delete(j); } });
        return bmps.get(i) || null; },
    };
  })();
  player.setCache(SP);
  $('smooth').checked = SP.enabled(); $('smooth').addEventListener('change', e => { try { localStorage.setItem('patter-smooth', e.target.checked ? '1' : '0'); } catch (er) { } SP.touch(); });
  SP.touch();
  playBtn.addEventListener('click', () => player.toggle());
  $('restartBtn').addEventListener('click', () => player.restart());
  scrub.addEventListener('pointerdown', () => { scrubbing = true; player.scrub(true); player.pause(); });
  scrub.addEventListener('input', () => { const d = mod().duration(cfg(), state.look); player.seek(scrub.value / 1000 * d); });
  const endScrub = () => { scrubbing = false; player.scrub(false); };
  scrub.addEventListener('pointerup', endScrub); scrub.addEventListener('change', endScrub);
  const pq = $('pq'); pq.value = state.pq || 'normal'; player.setMode(pq.value); pq.addEventListener('change', () => { state.pq = pq.value; player.setMode(pq.value); save(); });

  // In and out points (per clip type)
  const getRange = () => { const r = state.range && state.range[state.module]; return r && r.length === 2 ? r : null; };
  const setRange = r => { state.range = state.range || {}; if (r) state.range[state.module] = [Math.round(r[0] * 100) / 100, Math.round(r[1] * 100) / 100]; else delete state.range[state.module]; if (player.loop) player.setLoop(getRange()); updateRangeUI(); save(); };
  function setIn() { const d = mod().duration(cfg(), state.look), t = player.t, r = getRange() || [0, d]; setRange([Math.min(t, d - 0.1), r[1] > t + 0.05 ? r[1] : d]); $('rangeOn').checked = true; state.rangeOn = true; ed && ed.drawRange(); }
  function setOut() { const t = player.t, r = getRange() || [0, t]; setRange([r[0] < t - 0.05 ? r[0] : 0, Math.max(t, 0.1)]); $('rangeOn').checked = true; state.rangeOn = true; ed && ed.drawRange(); }
  function clearRange() { setRange(null); player.setLoop(null); syncLoopBtn(); ed && ed.drawRange(); }
  function syncLoopBtn() { $('playRange').textContent = player.loop ? 'Stop looping' : 'Loop the range'; }
  function updateRangeUI() { const r = getRange(), on = $('rangeOn'); $('rangeTxt').textContent = r ? `In ${r[0].toFixed(2)} s, out ${r[1].toFixed(2)} s` : 'No in or out points yet. Press I and O to set them at the playhead.'; on.disabled = !r; if (!r) on.checked = false; $('playRange').disabled = !r; $('clearRange').disabled = !r; }
  $('setIn').addEventListener('click', setIn); $('setOut').addEventListener('click', setOut); $('clearRange').addEventListener('click', clearRange);
  $('playRange').addEventListener('click', () => { const r = getRange(); if (!r) return; player.setLoop(player.loop ? null : r); syncLoopBtn(); });
  $('rangeOn').addEventListener('change', () => { state.rangeOn = $('rangeOn').checked; save(); });

  // Editor: timeline under the preview plus click and drag on the preview
  ed = Editor.create({ tl: $('timeline'), wrap: $('prevWrap'), player, getMod: mod, getCfg: cfg, getLook: viewLook, getRange, setRange: r => setRange(r),
    changed: full => { save(); if (full) { commit(); ed.build(); buildInspector(); if (state.manual) buildForm(); } },
    select: () => buildInspector(), undo, redo,
    focusInspector: () => { const f = $('inspector').querySelector('textarea, input[type=text]'); if (f) { f.focus(); f.select && f.select(); } } });
  Object.assign(Layers.hooks, {
    time: () => player.t, selKey: () => ed.selKey,
    seek: (t, ki) => { player.pause(); player.seek(t); ed.selKey = ki; ed.setTime(t); buildInspector(); },
    addAsset: (id, url) => { state.assets[id] = url; save(); },
    // A picture arriving (after opening a project) can change what the panel shows, and the smooth preview must redraw
    onAsset: () => { if (SP) SP.touch(); player.seek(player.t + 1e-6); clearTimeout(assetTimer); assetTimer = setTimeout(() => { const ae = document.activeElement; if (!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.closest('#inspector'))) buildInspector(); }, 250); },
    pickVideo: () => new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*'; inp.onchange = () => res(inp.files && inp.files[0] || null); inp.click(); }),
    pieces: () => PIECES, savePiece: (c, ids) => savePieceDlg(c, ids),
  });
  Layers.setAssets(state.assets);
  // Video clips: redraw when a picture arrives, and rebuild the smooth preview when a whole clip arrives
  if (typeof Media !== 'undefined') Media.onChange(clip => { if (clip && SP) SP.touch(); });
  ed.build(); buildInspector(); layoutPanels(); updateRangeUI(); $('rangeOn').checked = !!state.rangeOn && !!getRange();
  if (typeof GeoData !== 'undefined' && GeoData.onChange) GeoData.onChange(() => { ed.build(); if (SP) SP.touch(); });
  new ResizeObserver(() => ed.build()).observe($('timeline'));

  /* ---------- Keyboard shortcuts ---------- */
  let clip = null;
  const SHORTCUTS = [
    ['Playback', [['Space', 'Play or pause'], ['Home or End', 'Jump to the start or the end'], [', or .', 'Step one frame back or forward (hold Shift for one second)'], ['Left or Right', 'Step a frame when nothing is selected'], ['J or L', 'Jump to the previous or next keyframe'], ['P', 'Loop the in to out range']]],
    ['Editing', [['Click', 'Select something on the preview or the timeline'], ['Drag a bar edge', 'Make that part slower or quicker. Everything after it moves along to match'], ['Right click a bar', 'Put its timing back to automatic'], ['Shift click or drag a box', 'Select several layers on the timeline, then move, duplicate, delete or save them together'], ['Drag the playhead', 'Scrub through the clip. It snaps to bar edges and keyframes; hold Alt to scrub freely'], ['Arrow keys', 'Nudge the selected item (hold Shift for bigger steps)'], ['Ctrl + C', 'Copy the selected layer'], ['Ctrl + V', 'Paste a layer at the playhead (works across tabs)'], ['Ctrl + D', 'Duplicate the selected item'], ['Delete', 'Delete the selected keyframe, or the item'], ['K', 'Add a keyframe to the selected layer'], ['B', 'Put the selected layer behind the scene, or back in front'], ['T', 'Add a text layer'], ['Esc', 'Deselect'], ['Shift while dragging', 'Move a keyframed layer\'s whole path, or turn in 15 degree steps']]],
    ['Range and export', [['I', 'Set the in point at the playhead'], ['O', 'Set the out point at the playhead'], ['X', 'Clear the in and out points'], ['Ctrl + E', 'Export']]],
    ['Projects', [['Ctrl + Z', 'Undo'], ['Ctrl + Shift + Z or Ctrl + Y', 'Redo'], ['Ctrl + S', 'Save now and keep a version'], ['?', 'Show this sheet']]],
  ];
  const fps = () => +$('fps').value || 60;
  function step(dt) { player.pause(); const d = mod().duration(cfg(), state.look), t = Math.max(0, Math.min(d, player.t + dt)); player.seek(t); ed.setTime(t); }
  const addLayerNow = (fn) => { commit(); const id = fn(); save(); commit(); ed.build(); ed.select(id); };
  document.addEventListener('keydown', e => {
    const ae = document.activeElement, typing = /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && !(ae.type === 'checkbox' || ae.type === 'range'), ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (document.querySelector('dialog[open]')) return;
    if (ctrl && k === 's') { e.preventDefault(); autosave('version').then(() => say('Saved, with a version kept in History.')); return; }
    if (ctrl && k === 'e') { e.preventDefault(); $('exportBtn').click(); return; }
    if (typing) return;
    if (e.code === 'Space') { e.preventDefault(); player.toggle(); return; }
    if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); redo(); return; }
    const E2 = mod().editor;
    if (ctrl && k === 'c') { if (ed.selected && E2.copy && ed.selected.startsWith('L:')) { clip = E2.copy(cfg(), ed.selected); say('Layer copied. Press Ctrl+V to paste it at the playhead, on any tab.'); e.preventDefault(); } return; }
    if (ctrl && k === 'v') { if (clip && E2.paste) { e.preventDefault(); addLayerNow(() => E2.paste(cfg(), clip, player.t)); } return; }
    if (ctrl && k === 'd') { e.preventDefault(); if (ed.selected && E2.duplicate) addLayerNow(() => E2.duplicate(cfg(), ed.selected) || ed.selected); return; }
    if (ctrl || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { if (ed.selected) { e.preventDefault(); ed.removeSel(); } return; }
    if (e.key === 'Escape') { ed.closePop(); ed.select(null); return; }
    if (e.key === 'Home') { e.preventDefault(); step(-1e6); return; }
    if (e.key === 'End') { e.preventDefault(); step(1e6); return; }
    if (e.key === ',' || e.key === '<') { e.preventDefault(); step(e.shiftKey ? -1 : -1 / fps()); return; }
    if (e.key === '.' || e.key === '>') { e.preventDefault(); step(e.shiftKey ? 1 : 1 / fps()); return; }
    if (k === 'j') { ed.jumpKey(-1); return; } if (k === 'l') { ed.jumpKey(1); return; }
    if (k === 'k') { if (ed.addKey()) buildInspector(); return; }
    if (k === 'b') { ed.toggleSel(); return; }
    if (k === 'i') { setIn(); return; } if (k === 'o') { setOut(); return; } if (k === 'x') { clearRange(); return; }
    if (k === 'p') { $('playRange').click(); return; }
    if (k === 't') { const a = (E2.adds || []).find(x => x.group === 'layer' && x.label === 'Text'); if (a) addLayerNow(() => a.fn(cfg(), player.t)); return; }
    if (e.key === '?') { openShortcuts(); return; }
    const st = e.shiftKey ? 20 : 4, dir = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (dir) { if (ed.selected && ed.nudge(dir[0], dir[1])) e.preventDefault(); else if (!ed.selected && dir[1] === 0) { e.preventDefault(); step((dir[0] > 0 ? 1 : -1) * (e.shiftKey ? 1 : 1 / fps())); } }
  });

  /* ---------- Dialogs: projects, history, templates, shortcuts ---------- */
  const dlg = $('dlg');
  function openDlg(title, ...kids) { dlg.innerHTML = ''; dlg.append(H('div', { className: 'dlg-head' }, H('h2', { textContent: title }), H('button', { type: 'button', className: 'icon', textContent: '×', title: 'Close', 'aria-label': 'Close', on: { click: () => dlg.close() } })), H('div', { className: 'dlg-body' }, ...kids)); if (!dlg.open) dlg.showModal(); }
  const ago = t => { const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; const d = new Date(t); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const thumbEl = src => src ? H('img', { src, alt: '', className: 'thumb' }) : H('div', { className: 'thumb none' });
  function confirmBtn(label, fn) { let armed = false; const b = H('button', { type: 'button', textContent: label, on: { click: () => { if (!armed) { armed = true; b.textContent = 'Sure?'; b.classList.add('warn'); setTimeout(() => { armed = false; b.textContent = label; b.classList.remove('warn'); }, 2500); return; } fn(); } } }); return b; }
  // Drop pictures no clip uses any more (from deleted image layers), so projects don't keep growing
  function pruneAssets(st) { const used = new Set(), walk = c => { ((c && c.layers) || []).forEach(L => { if (L.asset) used.add(L.asset); }); ((c && c.items) || []).forEach(it => it && walk(it.cfg)); if (c && c.room && c.room.asset) used.add(c.room.asset); ((c && c.shows) || []).forEach(sh => { if (sh.asset) used.add(sh.asset); if (sh.mcfg) walk(sh.mcfg); }); if (c && c.studio) walk(c.studio); }; Object.values(st.cfg || {}).forEach(walk); Object.values(st.stash || {}).forEach(walk); Object.keys(st.assets || {}).forEach(id => { if (!used.has(id)) delete st.assets[id]; }); return st; }
  function applyState(s, msg) {
    state = pruneAssets(adopt(s)); if (!MODULES[state.module]) state.module = state.module === 'board' ? 'story' : 'charts'; fillDefaults(); Layers.setAssets(state.assets);
    drawTabs(); syncLook(); layoutPreview(); updateExportLabel(); hist = []; fut = []; lastSnap = null; commit(); if (ed) { ed.select(null); ed.resetZoom(); } player.setLoop(null); syncLoopBtn(); pq.value = state.pq || 'normal'; player.setMode(pq.value);
    refreshAll(); $('rangeOn').checked = !!state.rangeOn && !!getRange(); drawName(); save(); begin(); if (msg) say(msg);
  }
  function drawName() { $('projName').textContent = state.name || 'Untitled clip'; document.title = (state.name ? state.name + ' · ' : '') + 'Patter Studio'; }
  drawName();
  async function newProject(from) {
    await autosave(true); const all = await DB.all('projects').catch(() => []);
    const s = from || fresh(); s.pid = uid(); if (!from || !s.name) s.name = 'Untitled clip ' + (all.length + 1); s.updated = Date.now(); lastVersion = 0; lastThumb = 0;
    applyState(s, 'New project started. It saves itself as you work.'); await autosave(true);
  }
  async function openProject(id) {
    if (id === state.pid) { dlg.close(); return; } await autosave(true);
    const rec = await DB.get('states', id); if (!rec) { say('That project could not be found.', true); return; } lastVersion = Date.now(); lastThumb = 0;
    applyState(rec.state, 'Opened ' + (rec.state.name || 'project') + '.'); await DB.put('meta', id, 'current'); dlg.close();
  }
  async function openLibrary() {
    await autosave(true); const list = (await DB.all('projects').catch(() => [])).sort((a, b) => b.updated - a.updated), tmpls = (await DB.all('templates').catch(() => [])).filter(x => x.kind !== 'piece').sort((a, b) => b.created - a.created);
    const name = H('input', { type: 'text', value: state.name || '', 'aria-label': 'Project name', on: { input: e => { state.name = e.target.value; drawName(); save(); } } });
    const grid = H('div', { className: 'lib-grid' }, ...list.map(p => H('div', { className: 'lib-card' + (p.id === state.pid ? ' cur' : '') }, H('button', { type: 'button', className: 'lib-open', title: 'Open ' + p.name, on: { click: () => openProject(p.id) } }, thumbEl(p.thumb)),
      H('div', { className: 'lib-meta' }, H('b', { textContent: p.name || 'Untitled' }), H('span', { textContent: (TAB_NAMES[p.module] || '') + ', ' + ago(p.updated) + (p.id === state.pid ? ', open now' : '') })),
      H('div', { className: 'btnrow' }, p.id === state.pid ? '' : UI.btn('Open', () => openProject(p.id)), UI.btn('Duplicate', async () => { const r = await DB.get('states', p.id); if (r) { const s = JSON.parse(JSON.stringify(r.state)); s.name = (s.name || 'Project') + ' copy'; await newProject(s); openLibrary(); } }),
        p.id === state.pid ? '' : confirmBtn('Delete', async () => { await DB.del('projects', p.id); await DB.del('states', p.id); await DB.delVersions(p.id); openLibrary(); })))));
    const tname = H('input', { type: 'text', placeholder: 'Template name, for example Weekly news intro', 'aria-label': 'Template name' });
    const tgrid = H('div', { className: 'lib-grid' }, ...tmpls.map(tp => H('div', { className: 'lib-card' }, H('button', { type: 'button', className: 'lib-open', title: 'Start a new clip from ' + tp.name, on: { click: () => useTemplate(tp) } }, thumbEl(tp.thumb)),
      H('div', { className: 'lib-meta' }, H('b', { textContent: tp.name }), H('span', { textContent: TAB_NAMES[tp.module] || '' })),
      H('div', { className: 'btnrow' }, UI.btn('New clip', () => useTemplate(tp)), UI.btn('Use on this tab', () => applyTemplate(tp)), confirmBtn('Delete', async () => { await DB.del('templates', tp.id); openLibrary(); })))));
    const pgrid = H('div', { className: 'lib-grid' }, ...PIECES.map(pc => H('div', { className: 'lib-card' }, thumbEl(pc.thumb), H('div', { className: 'lib-meta' }, H('b', { textContent: pc.name }), H('span', { textContent: pc.layers.length + (pc.layers.length === 1 ? ' layer' : ' layers') })),
      H('div', { className: 'btnrow' }, UI.btn('Add at the playhead', () => { const id = Layers.insertPiece(cfg(), pc, player.t); save(); commit(); ed.build(); ed.select(id); dlg.close(); }), confirmBtn('Delete', async () => { await DB.del('templates', pc.id); await loadPieces(); openLibrary(); })))));
    openDlg('Projects',
      H('section', { className: 'dlg-sec' }, H('label', { className: 'field' }, H('span', { className: 'lab', textContent: 'This project\'s name' }), name), H('div', { className: 'btnrow' }, UI.btn('New blank project', async () => { await newProject(); openLibrary(); }), UI.btn('Version history', () => openHistory()), UI.btn('Packs and updates', () => openPacks()))),
      inboxSec(),
      H('h3', { textContent: 'Your projects' }), list.length ? grid : H('p', { className: 'hint', textContent: 'Nothing saved yet.' }),
      H('h3', { textContent: 'Templates' }), H('p', { className: 'hint', textContent: 'A template keeps this tab\'s settings, look and layers, so you can start new clips from it.' }),
      H('div', { className: 'tmpl-row' }, tname, UI.btn('Save this clip as a template', async () => { const n = tname.value.trim() || (TAB_NAMES[state.module] + ' template'); await saveTemplate(n); openLibrary(); })),
      tmpls.length ? tgrid : H('p', { className: 'hint', textContent: 'No templates yet.' }),
      H('h3', { textContent: 'Saved pieces' }), H('p', { className: 'hint', textContent: 'Pieces are layers you saved from their panel (Save as a piece), ready to drop into any clip.' }),
      PIECES.length ? pgrid : H('p', { className: 'hint', textContent: 'No pieces yet.' }));
  }
  /* Saved pieces: groups of layers kept in the library and dropped into any clip from the Saved menu on the timeline */
  let PIECES = []; const loadPieces = async () => { PIECES = (await DB.all('templates').catch(() => [])).filter(x => x.kind === 'piece').sort((a, b) => b.created - a.created); };
  loadPieces();
  function pieceThumb(piece) { const W = 1920, H = 1080, c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d'); g.scale(320 / W, 320 / W);
    const len = Math.max(...piece.layers.map(L => +L.end || 1)), t = Math.min(len, Math.max(0.8, len * 0.5)); try { Layers.drawAll(g, { layers: piece.layers.filter(L => !Layers.isMeta(L)) }, t, state.look, W, H, null); } catch (e) { } return c.toDataURL('image/png'); }
  function savePieceDlg(c, ids) {
    const piece = Layers.pieceOf(c, ids); if (!piece) return; const nm = H('input', { type: 'text', placeholder: 'For example Breaking news stamp', 'aria-label': 'Piece name' });
    const go = async () => { const assetUrls = {}; piece.assets.forEach(a => { if (state.assets[a]) assetUrls[a] = state.assets[a]; });
      await DB.put('templates', { id: uid(), kind: 'piece', name: nm.value.trim() || 'Saved piece', created: Date.now(), layers: piece.layers, assetUrls, thumb: pieceThumb(piece) }); await loadPieces(); dlg.close(); say('Saved. Find it under Saved on the timeline.'); };
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    openDlg('Save as a piece', H('p', { className: 'hint', textContent: piece.layers.length + (piece.layers.length === 1 ? ' layer' : ' layers') + ', with keyframes, effects and timing. Drop it into any clip from Saved on the timeline.' }), H('div', { className: 'tmpl-row' }, nm, UI.btn('Save', go)));
    setTimeout(() => nm.focus(), 50);
  }
  async function saveTemplate(name) {
    const c = JSON.parse(JSON.stringify(cfg())), assets = {}; (c.layers || []).forEach(L => { if (L.asset && state.assets[L.asset]) assets[L.asset] = state.assets[L.asset]; });
    await DB.put('templates', { id: uid(), name, created: Date.now(), module: state.module, look: JSON.parse(JSON.stringify(state.look)), cfg: c, assets, thumb: await makeThumb() }); say('Template saved.');
  }
  // Load a template's settings and layers into the current project, on its tab, keeping undo
  function applyTemplate(tp) { if (!MODULES[tp.module]) { say('That template was made on the old Blackboard tab, which has been retired. Use Story with the Blank board place instead.'); return; } commit(); state.cfg[tp.module] = JSON.parse(JSON.stringify(tp.cfg)); Object.assign(state.assets, tp.assets || {}); Layers.setAssets(tp.assets || {}); if (state.module !== tp.module) switchTab(tp.module); else { commit(); refreshAll(); begin(); } save(); dlg.close(); say('Template applied. Undo puts it back.'); }
  async function useTemplate(tp) { const s = fresh(); s.module = tp.module; s.look = Object.assign(s.look, tp.look); s.cfg = { [tp.module]: JSON.parse(JSON.stringify(tp.cfg)) }; s.assets = Object.assign({}, tp.assets); s.name = tp.name; await newProject(s); dlg.close(); }
  async function openHistory() {
    await autosave(true); const vs = (await DB.versions(state.pid).catch(() => [])).sort((a, b) => b.time - a.time);
    openDlg('Version history',
      H('p', { className: 'hint', textContent: 'A version is kept about once a minute while you work, and whenever you press Ctrl+S. Rolling back keeps your current state as a version too, so nothing is lost.' }),
      vs.length ? H('div', { className: 'ver-list' }, ...vs.map((v, i) => H('div', { className: 'ver' }, thumbEl(v.thumb), H('div', { className: 'lib-meta' }, H('b', { textContent: ago(v.time) + (i === 0 ? ' (latest)' : '') }), H('span', { textContent: (TAB_NAMES[v.module] || '') + (v.note ? ', ' + v.note : '') })),
        UI.btn('Roll back to this', async () => { await addVersion(JSON.parse(JSON.stringify(state)), await makeThumb(), 'before a roll back'); const s = JSON.parse(JSON.stringify(v.state)); s.assets = await assetsFor(v); s.pid = state.pid; s.name = state.name; applyState(s, 'Rolled back to the version from ' + ago(v.time) + '.'); lastVersion = Date.now(); dlg.close(); })))) : H('p', { className: 'hint', textContent: 'No versions yet. Keep working and they will appear here.' }));
  }
  function openShortcuts() { openDlg('Keyboard shortcuts', ...SHORTCUTS.map(([g, rows]) => H('section', { className: 'dlg-sec' }, H('h3', { textContent: g }), H('table', { className: 'keys-t' }, ...rows.map(([k, d]) => H('tr', {}, H('td', {}, H('kbd', { textContent: k })), H('td', { textContent: d }))))))); }
  $('libBtn').addEventListener('click', openLibrary); $('histBtn').addEventListener('click', openHistory); $('keysBtn').addEventListener('click', openShortcuts);
  /* ---------- Packs and app updates ---------- */
  const L = () => window.PatterLauncher || null;
  async function openPacks(note) {
    const list = typeof Packs !== 'undefined' ? Packs.list() : [], KN = { places: ['place', 'places'], props: ['prop', 'props'], hats: ['hat or mask', 'hats and masks'], actions: ['move', 'moves'], setpieces: ['set piece', 'set pieces'] };
    const status = H('p', { className: 'hint', textContent: note || (Packs.lastCheck ? 'Last checked for new packs ' + ago(Packs.lastCheck) + '.' : Packs.lastError || 'New packs are fetched from GitHub each time Patter Studio opens.') });
    const file = H('input', { type: 'file', accept: '.json,application/json', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; try { const info = await Packs.add(JSON.parse(await f.text()), 'file'); openPacks('Added ' + info.name + '.'); } catch (err) { openPacks(err.message || 'That file could not be read.'); } } } });
    const L0 = L(), appSec = L0 ? H('section', { className: 'dlg-sec' }, H('h3', { textContent: 'Patter Studio version' }),
      H('p', { className: 'hint', textContent: 'Running version ' + (window.PATTER_APP_VERSION || '?') + (L0.source === 'update' ? ', downloaded from GitHub.' : ', the one that came with the installer.') + ' New versions download by themselves when the app opens and are used straight away.' }),
      H('div', { className: 'btnrow' }, UI.btn('Check for an update now', async () => { status.textContent = 'Checking…'; const r = await L0.check(true); openPacks(r === 'updated' ? 'A new version has downloaded. Close and reopen Patter Studio to use it.' : r === 'latest' ? 'You have the latest version.' : 'Could not reach GitHub just now.'); }),
        L0.canGoBack ? confirmBtn('Go back to the previous version', () => L0.goBack()) : '', L0.source === 'update' ? confirmBtn('Use the installed version', () => L0.useBuiltIn()) : '', L0.usingBuiltIn ? UI.btn('Turn updates back on', () => L0.useUpdates()) : '')) : '';
    openDlg('Packs',
      H('p', { className: 'hint', textContent: 'Packs add new places, props, masks, moves and ready-made set pieces to Story and B roll. Set pieces are under + Set piece on the timeline.' }), status,
      list.length ? H('div', { className: 'ver-list' }, ...list.map(p => H('div', { className: 'pack-row' }, H('div', { className: 'lib-meta' }, H('b', { textContent: p.name + ' (v' + p.version + ')' }), H('span', { textContent: (p.counts.map(([k, n]) => n + ' ' + KN[k][n === 1 ? 0 : 1]).join(', ') || 'Empty') + (p.source === 'github' ? ', from GitHub' : ', added from a file') }), p.note ? H('span', { textContent: p.note }) : ''),
        confirmBtn('Remove', async () => { await Packs.remove(p.id); openPacks('Removed ' + p.name + '.'); })))) : H('p', { className: 'hint', textContent: 'No packs yet.' }),
      H('div', { className: 'btnrow' }, UI.btn('Check for new packs', async () => { status.textContent = 'Checking…'; const got = await Packs.check(); openPacks(got.length ? 'Added ' + got.join(', ') + '.' : Packs.lastError || 'You have every pack.'); }), UI.btn('Add a pack file…', () => file.click()), file), appSec);
  }
  /* ---------- From Claude: whole projects published to the Patter Studio home on GitHub. They wait in the Project window
     (a small dot on the Project button says something new has arrived) and only become a project when opened. ---------- */
  let INBOX = [];
  const saveInbox = () => DB.put('meta', INBOX, 'inbox').catch(() => null);
  const drawProjDot = () => { const b = $('libBtn'); if (b) b.classList.toggle('has-new', INBOX.some(x => !x.opened)); };
  async function loadInbox() { INBOX = (await DB.get('meta', 'inbox').catch(() => null)) || []; drawProjDot(); }
  async function checkInbox() {
    if (typeof Packs === 'undefined' || navigator.onLine === false) return []; const got = [];
    try { const idx = await Packs.fetchJSON(Packs.HOME + 'projects/index.json');
      for (const it of (idx && idx.projects) || []) { const id = String(it.id || '').replace(/[^a-zA-Z0-9_.\-]/g, ''); if (!id) continue; const rec = INBOX.find(x => x.id === id); if (rec && rec.rev === it.rev) continue;
        try { const data = await Packs.fetchJSON(Packs.HOME + 'projects/' + String(it.file || id + '.patter.json').replace(/[^a-zA-Z0-9_.\-\/]/g, '')); if (!data || !data.look || !data.cfg) continue; await DB.put('meta', data, 'inbox:' + id);
          const r = { id, name: String(it.name || data.name || 'New video').slice(0, 60), note: String(it.note || '').slice(0, 200), rev: it.rev, added: Date.now(), opened: false }; INBOX = INBOX.filter(x => x.id !== id); INBOX.unshift(r); got.push(r.name); } catch (e) { } }
      if (got.length) { await saveInbox(); drawProjDot(); } } catch (e) { }
    return got; }
  async function openFromClaude(r) { const data = await DB.get('meta', 'inbox:' + r.id).catch(() => null); if (!data) { say('That one could not be opened. Try Check again later.', true); return; } const s = JSON.parse(JSON.stringify(data)); s.name = r.name; r.opened = true; await saveInbox(); drawProjDot(); dlg.close(); await newProject(s); say('Opened ' + r.name + ' as a new project. It is in your projects now, so you can change anything.'); }
  function inboxSec() { if (!INBOX.length) return ''; return H('section', { className: 'dlg-sec' }, H('h3', { textContent: 'From Claude' }), H('div', { className: 'ver-list' }, ...INBOX.map(r => H('div', { className: 'pack-row' }, H('div', { className: 'lib-meta' }, H('b', { textContent: r.name + (r.opened ? '' : '  (new)') }), H('span', { textContent: (r.note ? r.note + ', ' : '') + 'arrived ' + ago(r.added) })),
    UI.btn(r.opened ? 'Open a fresh copy' : 'Open', () => openFromClaude(r), r.opened ? '' : 'primary'), confirmBtn('Remove', async () => { INBOX = INBOX.filter(x => x !== r); await saveInbox(); DB.put('meta', null, 'inbox:' + r.id).catch(() => null); drawProjDot(); openLibrary(); }))))); }
  if (typeof Packs !== 'undefined') {
    Packs.onChange(() => { if (SP) SP.touch(); refreshAll(); });
    loadInbox().then(() => Packs.loadSaved()).then(() => Packs.check()).then(async got => { const pj = await checkInbox(); const msg = [];
      if (got && got.length) msg.push('New ' + (got.length > 1 ? 'packs' : 'pack') + ': ' + got.join(', ') + ' (find set pieces under + Set piece)');
      if (pj.length) msg.push('New from Claude: ' + pj.join(', ') + ' (open it from the Project button)');
      if (msg.length) say(msg.join('. ') + '.'); });
  }
  if (L() && L().justUpdated) say('Patter Studio updated itself to version ' + (window.PATTER_APP_VERSION || '') + '.');
  if (L() && L().bootOK) L().bootOK();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  // Bring back the full saved project (with pictures) from the library, and keep a version when the app opens
  (async () => {
    try {
      const rec = await DB.get('states', state.pid);
      if (rec && rec.state && (rec.state.updated || 0) >= (state.updated || 0) - 2000) applyState(rec.state);
      else if (rec && rec.state && rec.state.assets) { state.assets = Object.assign({}, rec.state.assets, state.assets); Layers.setAssets(state.assets); }
      lastVersion = 0; await autosave('version');
    } catch (e) { console.warn('Library unavailable', e); }
  })();
  window.addEventListener('beforeunload', () => { writeLight(); if (dirty) autosave(true); });

  /* ---------- Export ---------- */
  const exportBtn = $('exportBtn'), cancelBtn = $('cancelBtn'), fill = $('barFill');
  function updateExportLabel() { exportBtn.textContent = state.look.transparent ? 'Export PNG sequence' : 'Export MP4'; }
  updateExportLabel();
  let abort = null;
  const fileBase = () => { const t = (state.name && !/^Untitled clip/.test(state.name) ? state.name : (cfg().title || cfg().headline || cfg().heading || (cfg().articles && cfg().articles[0] && cfg().articles[0].headline) || state.module)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'clip'; return `${t}-${state.look.format === '9:16' ? 'vertical' : '1080p'}`; };
  exportBtn.addEventListener('click', async () => {
    if (exportBtn.disabled) return;
    const fps = +$('fps').value, blur = ['smart', 'off', 'full'].includes($('blur').value) ? $('blur').value : 'smart', look = JSON.parse(JSON.stringify(state.look)), c = JSON.parse(JSON.stringify(cfg())), m = mod(), range = $('rangeOn').checked ? getRange() : null;
    abort = new AbortController(); exportBtn.disabled = true; cancelBtn.hidden = false; fill.style.width = '0%';
    player.pause(); player.freeze(true); if (SP) SP.hold(true); const t0 = performance.now(); say('Getting ready to render…');
    const onProgress = p => { fill.style.width = (p * 100).toFixed(1) + '%'; const el = (performance.now() - t0) / 1000, left = p > 0.02 ? el / p - el : 0; status.textContent = `Rendering ${Math.round(p * 100)}%` + (left ? `, about ${Math.ceil(left)} s left` : ''); };
    try {
      await Promise.all((c.layers || []).filter(L => L.asset && state.assets[L.asset]).map(L => Layers.setAsset(L.asset, state.assets[L.asset])));
      if ((state.module === 'map' || state.module === 'flights' || state.module === 'flyover') && typeof GeoData !== 'undefined' && GeoData.full) {
        say('Loading the full detail map for export…');
        try { await GeoData.full; } catch (e) { }
        if (GeoData.state.detail === 'low') say('Full detail map unavailable, exporting with the lighter map.');
      }
      const suffix = range ? `-${range[0].toFixed(1)}s-to-${range[1].toFixed(1)}s` : '';
      if (look.transparent) {
        let dir = null;
        if (window.showDirectoryPicker) { say('Choose an empty folder for the frames.'); try { dir = await showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { if (e.name === 'AbortError') throw new Error('Export cancelled.'); } }
        const zip = await E.exportPNG(m, c, look, { fps, blur, onProgress, signal: abort.signal, dir, range });
        if (zip) await E.saveBlob(zip, fileBase() + suffix + '-transparent.zip', [{ description: 'Zip file', accept: { 'application/zip': ['.zip'] } }]);
        say(dir ? 'Done. In Premiere, import the first frame and tick Image Sequence.' : 'Done. Unzip it, then in Premiere import the first frame and tick Image Sequence.');
      } else {
        const info = { threads: 1 }; const blob = await E.exportMP4(m, c, look, { fps, blur, onProgress, signal: abort.signal, range, onInfo: i => Object.assign(info, i) }); const took = Math.round((performance.now() - t0) / 1000), threads = info.threads;
        say('Saving…');
        const ok = await E.saveBlob(blob, fileBase() + suffix + '.mp4', [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }]);
        say(ok ? `Done in ${took} s using ${threads} ${threads === 1 ? 'thread' : 'threads'}${info.gpu === true ? ', graphics chip on' : info.gpu === false ? ', graphics chip unavailable' : ''}, about ${Math.round(info.drawMs || 0)} ms to draw each frame. ${(blob.size / 1e6).toFixed(1)} MB MP4 saved${range ? ' (in to out range only)' : ''}.` : 'Save cancelled.');
      }
      fill.style.width = '100%';
    } catch (e) { say(e.message || String(e), true); }
    exportBtn.disabled = false; cancelBtn.hidden = true; abort = null; player.freeze(false); if (SP) SP.hold(false); if (autoplay()) player.play();
  });
  cancelBtn.addEventListener('click', () => abort && abort.abort());

  // Project files (to move projects between computers or keep backups)
  $('saveProj').addEventListener('click', () => E.saveBlob(new Blob([JSON.stringify(pruneAssets(JSON.parse(JSON.stringify(state))), null, 2)], { type: 'application/json' }), fileBase() + '.patter.json', [{ description: 'Patter project', accept: { 'application/json': ['.json'] } }]));
  $('openProj').addEventListener('click', () => $('projFile').click());
  $('projFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const s = JSON.parse(await f.text()); if (!s.look || !s.cfg) throw 0; await autosave(true); s.pid = uid(); s.name = s.name || f.name.replace(/\.patter\.json$|\.json$/i, ''); applyState(s, 'Project opened from file and added to Projects.'); await autosave(true); }
    catch (err) { say('That file isn\'t a Patter project. Choose a file saved with Save file.', true); }
    e.target.value = '';
  });
  if (document.fonts) document.fonts.ready.then(() => { E.fontVersion = (E.fontVersion || 0) + 1; player.seek(player.t); if (SP) SP.touch(); });
})();


  /* ---------- The panel on the left ---------- */
  function panel(root, cfg, id, changed, done) {
    const { H, field, sel, txt, area, num, card, grid2, btn } = UI;
    const now = () => (typeof Layers !== 'undefined' && Layers.hooks && Layers.hooks.time ? Layers.hooks.time() : 0);
    const redo = () => { root.innerHTML = ''; panel(root, cfg, id, changed, done); };
    const ch = () => { changed(); redo(); };
    const tiles = (items, cols = 4) => H('div', { className: 'st-tiles c' + cols }, ...items.map(([key, label, picEl, on, fn]) => H('button', { type: 'button', className: 'st-tile' + (on ? ' on' : ''), title: label, 'aria-pressed': String(!!on), on: { click: fn } }, picEl, H('span', { textContent: label }))));
    const seg = (items, cur, fn) => H('div', { className: 'st-seg' }, ...items.map(([k, l]) => H('button', { type: 'button', className: k === cur ? 'on' : '', textContent: l, 'aria-pressed': String(k === cur), on: { click: () => fn(k) } })));
    const range = (v, min, max, step, fn, label, fmt = x => x) => { const out = H('span', { className: 'st-rv', textContent: fmt(v) }), inp = H('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(v), 'aria-label': label, on: { input: e => { const x = +e.target.value; out.textContent = fmt(x); fn(x); }, change: () => changed() } }); return H('div', { className: 'st-range' }, inp, out); };
    // A start spot can be a named mark or an exact place dragged on the preview
    const spotOpts = (sc, cur, pre = '') => { const L = spotsFor(sc).map(k => [k, pre + k]); if (typeof cur === 'number') L.unshift([String(cur), pre + 'where you dragged them']); return L; };
    const spotVal = v => (v !== '' && !isNaN(+v) ? +v : v);
    // Choose a video from the computer and read it in; the note shows progress, then any warnings
    const loadVideo = (note, done) => { const pick = Layers.hooks && Layers.hooks.pickVideo; if (!pick || typeof Media === 'undefined') { note.textContent = 'Videos can only be added in the app itself.'; return; }
      pick().then(file => { if (!file) return; if (file.size > 400 * 1024 * 1024) { note.textContent = 'That file is over 400 MB. Trim it down first, or use the see-through screen and add it in After Effects.'; return; }
        note.textContent = 'Reading ' + file.name + '…'; Media.importFile(file, q => { note.textContent = 'Reading ' + file.name + ': ' + Math.round(q * 100) + '%'; })
          .then(m => { done({ id: m.id, name: m.name, inPt: 0, fit: 'fill' }); const warn = [m.cut ? 'Only the first ' + Media.MAX_SECONDS + ' seconds were read.' : '', m.unsaved ? 'There was no room to keep it on this computer, so it will need adding again after you close the app.' : ''].filter(Boolean).join(' '); setTimeout(() => { const n2 = root.querySelector('.st-vidnote'); if (n2 && warn) n2.textContent = warn; }, 50); })
          .catch(e => { note.textContent = e.message; }); }); };
    // The video controls for a screen or a whole scene: which clip, where it starts, how it fits
    const videoBox = (ref, setRef, what) => { const note = H('p', { className: 'hint st-vidnote' }, ref ? '' : 'MP4 works best. Up to ' + (typeof Media !== 'undefined' ? Media.MAX_SECONDS : 60) + ' seconds are read in; the sound is not included, so add it in your editor if you need it.');
      if (!ref) return H('div', {}, btn(what, () => loadVideo(note, v => { setRef(v); ch(); })), note);
      const inf = typeof Media !== 'undefined' && Media.info(ref.id);
      return H('div', {}, H('p', { className: 'hint' }, '🎞 ' + (ref.name || 'Video') + (inf ? ` (${inf.dur.toFixed(1)} s)` : typeof Media !== 'undefined' && !Media.ready(ref.id) ? ' (not on this computer, add it again)' : '')),
        grid2(field('Start from (seconds into the video)', num(+ref.inPt || 0, v => { ref.inPt = r2(Math.max(0, v)); changed(); }, 0, 600, 0.1, 'Start from')), field('Fit', seg([['fill', 'Fill'], ['fit', 'Whole picture']], ref.fit || 'fill', v => { ref.fit = v; ch(); }))),
        H('div', { className: 'btnrow' }, btn('Change video', () => loadVideo(note, v => { setRef(Object.assign({}, ref, { id: v.id, name: v.name })); ch(); })), btn('Remove video', () => { setRef(null); ch(); })), note); };
    const foot = (...b) => H('div', { className: 'btnrow' }, ...b, done ? btn('Done', done) : '');
    const P = plan(cfg);
    if (!P.scenes.length) { root.append(card('Story', H('p', { className: 'hint' }, 'No scenes yet. Use + Scene under the preview to start one.'))); return; }
    const [kind, sid, xid] = (id || '').split(':'), oSel = sid ? P.scenes.find(x => x.sc.id === sid) : null;
    if (id && !oSel) { root.append(card('Story', H('p', { className: 'hint' }, 'That has gone. Pick something else.'))); return; }
    if (kind === 'A' || kind === 'X') { const list = kind === 'A' ? oSel.sc.acts : oSel.sc.extra, a = (list || []).find(x => x.id === xid); if (a) return actCard(oSel, a); }
    if (kind === 'Q') { const q = (oSel.sc.screens || []).find(x => x.id === xid); if (q) return screenCard(oSel, q); }
    if (kind === 'W') return personCard(oSel, xid);
    if (kind === 'P') { const o = P.scenes.find(x => x.sc.people && x.sc.people.some(p => p.pid === sid)); if (o) return personCard(o, sid); }
    const o = oSel || sceneAt(P, now());
    if (o.sc.type === 'travel') travelCard(o); else sceneCard(o);
    if (!id) storyCard();

    function sceneCard(o) { const sc = o.sc;
      const people = sc.people.map((pe, i) => { const c = castById(cfg, pe.pid) || { name: '?' }; return H('div', { className: 'st-who' }, H('button', { type: 'button', className: 'st-face', title: 'Change ' + c.name, on: { click: () => { root.innerHTML = ''; panel(root, cfg, 'W:' + sc.id + ':' + pe.pid, changed, done || (() => { root.innerHTML = ''; panel(root, cfg, id, changed, done); })); } } }, personPic(c, false)),
        H('div', { className: 'st-wm' }, H('b', { textContent: c.name }), grid2(sel(String(pe.start), spotOpts(sc, pe.start, 'Starts '), v => { pe.start = spotVal(v); ch(); }, 'Where ' + c.name + ' starts'), sel(pe.holding || '', [['', 'Holding nothing'], ...PROPS], v => { pe.holding = v; ch(); }, 'What ' + c.name + ' holds'))),
        UI.iconBtn('✕', 'Take ' + c.name + ' out of this scene', () => { sc.people.splice(i, 1); sc.acts = (sc.acts || []).filter(a => a.who !== pe.pid); ch(); })); });
      const others = (cfg.cast || []).filter(c => !sc.people.some(p => p.pid === c.id));
      const addSel = sc.people.length < 4 ? sel('', [['', '+ Add someone to this scene'], ...others.map(c => [c.id, c.name]), ['__new', 'Someone new…']], v => { if (!v) return; if (v === '__new') { const cols = ['pink', 'green', 'orange', 'purple', 'yellow', 'red', 'blue', 'white'], c = { id: nid('p'), name: 'Person ' + ((cfg.cast || []).length + 1), sex: 'man', colour: cols[(cfg.cast || []).length % cols.length], dress: '' }; cfg.cast.push(c); v = c.id; }
        const free = ['left', 'right', 'middle'].find(k => !sc.people.some(p => p.start === k)) || 'off left'; sc.people.push({ pid: v, start: free, holding: '' }); ch(); }, 'Add someone') : H('p', { className: 'hint' }, 'Four people is the most a scene can hold.');
      const move = d => { const i = cfg.scenes.indexOf(sc), j = i + d; if (i < 0 || j < 0 || j >= cfg.scenes.length) return; [cfg.scenes[i], cfg.scenes[j]] = [cfg.scenes[j], cfg.scenes[i]]; ch(); };
      const hintEl = H('p', { className: 'hint' }, 'Pick where and when it happens, and who is in it. Then click a person on the preview, or use + Action, to give them something to do at the playhead.'), scenery = [field('Region', tiles(REGIONS.map(([k, l]) => [k, l, setPic(k, sc.era, 'outdoors'), k === sc.region, () => { sc.region = k; ch(); }]))),
        field('When', seg(ERAS, sc.era, v => { sc.era = v; ch(); })),
        field('Place', tiles(PLACES.map(([k]) => [k, placeName(k, sc.era, sc.region), setPic(sc.region, sc.era, k), k === sc.place, () => { sc.place = k; const ks = spotsFor(sc); sc.people.forEach(pe => { if (typeof pe.start !== 'number' && !ks.includes(pe.start)) pe.start = 'middle'; }); (sc.acts || []).forEach(a => { if (a.to && !a.to.startsWith('@') && ACT[a.k] && ACT[a.k][4] === 'spot' && !ks.includes(a.to)) a.to = 'middle'; }); ch(); }]), 5)),
        field('Weather', seg([['', 'None'], ['sunny', 'Sun'], ['rain', 'Rain'], ['snow', 'Snow'], ['night', 'Night']], sc.weather || '', v => { sc.weather = v; ch(); })),
        field('Zoom', H('div', {}, range((sc.zoom && sc.zoom.z) || 1, 1, 3, 0.05, z => { if (z <= 1.02) delete sc.zoom; else { const c0 = sc.zoom || zoomCentre(sc); sc.zoom = { z, x: c0.x, y: c0.y }; } changed(false); }, 'Zoom into the scene', z => z <= 1.02 ? 'Whole board' : z.toFixed(1) + 'x'), H('p', { className: 'hint' }, 'Or click the empty board on the preview: drag a corner inwards to zoom in, then drag the board to choose what is in view.'))),
        field('Name on the board (optional)', txt(sc.label, v => { sc.label = v; changed(); }, 'For example Mogadishu', 'Place name'))], peopleEl = field('People', H('div', { className: 'st-people' }, ...people, addSel)), bgEl = field('Background', H('div', {}, seg([['board', 'Chalkboard'], ['video', 'Your video']], sc.video ? 'video' : 'board', v => { if (v === 'board') { delete sc.video; ch(); } else if (!sc.video) loadVideo(root.querySelector('.st-bgnote') || H('p'), r => { sc.video = Object.assign(r, { dim: 0.1 }); if (sc.place !== 'blank') sc.place = 'blank'; ch(); }); }),
          sc.video ? H('div', {}, videoBox(sc.video, r => { if (r) sc.video = r; else delete sc.video; }, ''), field('Darken the video', range(+sc.video.dim || 0, 0, 0.6, 0.02, v => { sc.video.dim = v; changed(false); }, 'Darken', v => Math.round(v * 100) + '%')),
            H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: sc.video.edge !== false, on: { change: e => { sc.video.edge = e.target.checked; ch(); } } }), 'Dark edge round the chalk so it reads on bright footage')) : H('p', { className: 'hint st-bgnote' }, 'Pick Your video to draw the chalk straight over your own footage instead of the board.'))), screensEl = field('Screens for real footage (B roll)', H('div', {}, ...(sc.screens || []).map((q, i) => H('div', { className: 'btnrow' }, btn('📺 ' + (q.label || SCREENS.find(z => z[0] === q.style)[1] + ' ' + (i + 1)), () => { if (Layers.hooks && Layers.hooks.seek) Layers.hooks.seek(o.t0 + (+q.start || 0) + 1, -1); root.innerHTML = ''; screenCard(o, q); }))),
          H('div', { className: 'st-seg wrap' }, ...SCREENS.map(([k, l]) => H('button', { type: 'button', textContent: '+ ' + l, on: { click: () => { const q = newScreen(sc, k, r2(cl(now() - o.t0, 0, 600))); changed(); root.innerHTML = ''; screenCard(o, q); } } }))))), buttonsEl = H('div', { className: 'btnrow' }, btn('◀ Earlier', () => move(-1)), btn('Later ▶', () => move(1)), btn('Duplicate scene', () => { editor.duplicate(cfg, 'S:' + sc.id); ch(); }), cfg.scenes.length > 1 ? btn('Delete scene', () => { editor.remove(cfg, 'S:' + sc.id); changed(); if (done) done(); else redo(); }) : '', done ? btn('Done', done) : '');
      // The B roll tab keeps the screen and the footage up front; the scenery is tucked away for when it is wanted
      if (cfg.brollTab) root.append(card(`Scene ${o.i + 1}`, H('p', { className: 'hint' }, 'Add a screen and put a video in it, or set Background to Your video to draw the chalk straight over your footage.'), screensEl, bgEl, peopleEl,
        scenery.find(f => /Zoom/.test(f.textContent)), buttonsEl));
      else root.append(card(`Scene ${o.i + 1}`, hintEl, ...scenery, peopleEl, bgEl, screensEl, buttonsEl));
    }
    function travelCard(o) { const sc = o.sc;
      root.append(card(`Scene ${o.i + 1}: travel`,
        H('p', { className: 'hint' }, 'A chalk map hop between two places. Drag the end of its bar on the Scenes lane to make it longer or shorter.'),
        field('Who', sel(sc.who || '', (cfg.cast || []).map(c => [c.id, c.name]), v => { sc.who = v; ch(); }, 'Who travels')),
        field('How', seg(Object.entries(TRIP).map(([k, v]) => [k, v[0] + ' ' + v[1]]), sc.mode, v => { sc.mode = v; ch(); })),
        field('From', tiles(REGIONS.map(([k, l]) => [k, l, setPic(k, 'modern', 'outdoors'), k === sc.from, () => { sc.from = k; ch(); }]))),
        field('To', tiles(REGIONS.map(([k, l]) => [k, l, setPic(k, 'modern', 'outdoors'), k === sc.to, () => { sc.to = k; ch(); }]))),
        grid2(field('Name at the start', txt(sc.fromLabel, v => { sc.fromLabel = v; changed(); }, RNAME[sc.from], 'Name at the start')), field('Name at the end', txt(sc.toLabel, v => { sc.toLabel = v; changed(); }, RNAME[sc.to], 'Name at the end'))),
        H('div', { className: 'btnrow' }, cfg.scenes.length > 1 ? btn('Delete', () => { editor.remove(cfg, 'S:' + sc.id); changed(); if (done) done(); else redo(); }) : '', done ? btn('Done', done) : '')));
    }
    function lookCard(c) {
      return [grid2(field('Name', txt(c.name, v => { c.name = v; changed(); }, 'Name', 'Name')), field('Man or woman', seg([['man', 'Man'], ['woman', 'Woman']], c.sex, v => { c.sex = v; ch(); }))),
        field('Colour', H('div', { className: 'st-sws' }, ...Object.keys(CH).map(k => H('button', { type: 'button', className: k === c.colour ? 'on' : '', title: k, 'aria-label': k + ' chalk', style: `background:${CH[k]}`, on: { click: () => { c.colour = k; ch(); } } })))),
        field('Dress', tiles(DRESS.map(([k, l]) => [k, l, personPic(Object.assign({}, c, { dress: k }), true), k === (c.dress || ''), () => { c.dress = k; ch(); }]))),
        field('Hair', tiles(HAIRS.map(([k, l]) => [k, l, personPic(Object.assign({}, c, { hair: k }), false), k === (c.hair || ''), () => { c.hair = k; ch(); }]), 5)),
        field('Beard', tiles(BEARDS.map(([k, l]) => [k, l, personPic(Object.assign({}, c, { beard: k }), false), k === (c.beard === true ? 'short' : c.beard || ''), () => { c.beard = k; ch(); }]), 5)),
        field('Hat', tiles(HATS.map(([k, l]) => [k, l, personPic(Object.assign({}, c, { hat: k }), false), k === (c.hat || ''), () => { c.hat = k; ch(); }]), 5)),
        c.hat && ['robe', 'cone', 'sombrero', 'bush'].includes(c.dress) ? H('p', { className: 'hint' }, 'The hat replaces the headwear that comes with the dress.') : '',
        grid2(field('Glasses', seg([['', 'None'], ['round', 'Glasses'], ['sun', 'Shades']], c.glasses === true ? 'round' : c.glasses || '', v => { c.glasses = v; ch(); })), field('Build', seg([['', 'Normal'], ['big', 'Big belly']], c.build || '', v => { c.build = v; ch(); })))];
    }
    // The action buttons: one click does it at the playhead; talking asks for the words first, moving asks where
    function actionGrid(o, who) { const sc = o.sc, wrapEl = H('div', {}), set = o.set, ask = H('div', { className: 'st-ask' });
      const add = (k, extra) => { const a = newAct(cfg, o, who, k, now(), extra); changed(); if (Layers.hooks && Layers.hooks.seek) Layers.hooks.seek(o.t0 + a.start + Math.min(0.6, a.dur * 0.5), -1); else redo(); };
      const pick = (k, el) => { if (el && el.closest('.st-acts')) el.closest('.st-acts').after(ask); requestAnimationFrame(() => { if (ask.childNodes.length) ask.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); pick0(k); };
      const pick0 = k => { const A0 = ACT[k]; ask.innerHTML = '';
        if (A0[4] === 'text') { const ta2 = H('textarea', { rows: 2, placeholder: k === 'think' ? 'What are they thinking?' : 'What do they say?', 'aria-label': 'Words' }); const go = () => add(k, { text: ta2.value.trim() }); ta2.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } }); ask.append(field(A0[1], ta2), H('div', { className: 'btnrow' }, btn('Add', go, 'primary'), btn('Cancel', () => { ask.innerHTML = ''; }))); setTimeout(() => ta2.focus(), 20); return; }
        if (A0[4] === 'spot') { const ks = spotsFor(sc).filter(x => k !== 'swim' || (set.marks[x] && set.marks[x].water)), others = sc.people.filter(p => p.pid !== who); ask.append(field(A0[1] + '…', H('div', { className: 'st-seg wrap' }, ...ks.map(x => H('button', { type: 'button', textContent: x, on: { click: () => add(k, { to: x }) } })), ...others.map(p => H('button', { type: 'button', textContent: (castById(cfg, p.pid) || {}).name, on: { click: () => add(k, { to: '@' + p.pid }) } })))), btn('Cancel', () => { ask.innerHTML = ''; })); return; }
        if (A0[4] === 'throwable') { ask.append(field('Throws…', tiles(THROWABLES.map(([p, l]) => [p, l, propPic(p), false, () => add(k, { prop: p })]), 5)), btn('Cancel', () => { ask.innerHTML = ''; })); return; }
        if (A0[4] === 'prop') { ask.append(field('Takes out…', tiles(PROPS.map(([p, l]) => [p, l, propPic(p), false, () => add(k, { prop: p })]), 5)), btn('Cancel', () => { ask.innerHTML = ''; })); return; }
        if (A0[4] === 'give') { const others = sc.people.filter(p => p.pid !== who); if (!others.length) { ask.append(H('p', { className: 'hint' }, 'There is nobody else in this scene to give it to.')); return; } let prop = 'passport'; const box = H('div', {}); const step2 = () => { box.innerHTML = ''; box.append(field('To…', H('div', { className: 'st-seg wrap' }, ...others.map(p => H('button', { type: 'button', textContent: (castById(cfg, p.pid) || {}).name, on: { click: () => add(k, { prop, to: p.pid }) } }))))); };
          ask.append(field('Gives…', tiles(PROPS.map(([p, l]) => [p, l, propPic(p), false, () => { prop = p; step2(); }]), 5)), box, btn('Cancel', () => { ask.innerHTML = ''; })); return; }
        add(k); };
      GROUPS.forEach(gname => { if (gname === 'Water' && !set.water) return; if (gname === 'Screen' && !(sc.screens || []).length) return; const ks = Object.keys(ACT).filter(k => ACT[k][2] === gname); wrapEl.append(field(gname === 'Feel' ? 'Feelings and other bits' : gname === 'Rough' ? 'Rough stuff (gestures and rammies)' : gname === 'Screen' ? 'With the screen' : gname, H('div', { className: 'st-acts' }, ...ks.map(k => H('button', { type: 'button', title: ACT[k][1], on: { click: ev => pick(k, ev.currentTarget) } }, H('i', { textContent: ACT[k][0] }), H('span', { textContent: ACT[k][1] })))))); });
      return [ask, wrapEl]; }
    function personCard(o, pid) { const sc = o.sc, c = castById(cfg, pid), pe = sc.people.find(p => p.pid === pid); if (!c) { root.append(card('Person', H('p', { className: 'hint' }, 'Not found.'))); return; }
      root.append(card(c.name + (o.sc.type === 'travel' ? '' : ` in scene ${o.i + 1}`),
        pe ? H('p', { className: 'hint' }, `Pick something for ${c.name} to do. It goes on ${c.name}'s lane at the playhead (${now().toFixed(1)} s).`) : '',
        pe ? field('Size in this scene', range(pe.size || 1, 0.4, 2.5, 0.05, v => { if (Math.abs(v - 1) < 0.03) delete pe.size; else pe.size = v; changed(false); }, 'Size', v => Math.round(v * 100) + '%')) : '',
        pe ? H('p', { className: 'hint' }, 'On the preview, drag ' + c.name + ' to move them and drag a corner to resize. With the playhead after a walk, dragging changes where that walk ends.') : '',
        pe ? field('Injuries in this scene', seg([['', 'None'], ['blackeye', 'Black eye'], ['bandage', 'Bandaged head'], ['plaster', 'Plaster']], pe.injury || '', v => { if (v) pe.injury = v; else delete pe.injury; ch(); })) : '',
        pe ? grid2(field('Starts', sel(String(pe.start), spotOpts(sc, pe.start), v => { pe.start = spotVal(v); ch(); }, 'Starts at')), field('Holding at the start', sel(pe.holding || '', [['', 'Nothing'], ...PROPS], v => { pe.holding = v; ch(); }, 'Holding'))) : '',
        ...(pe ? actionGrid(o, pid) : []),
        foot(pe ? btn('Take out of this scene', () => { editor.remove(cfg, 'W:' + sc.id + ':' + pid); changed(); if (done) done(); else redo(); }) : '')));
      root.append(card('How ' + c.name + ' looks', H('p', { className: 'hint' }, 'This is the same person in every scene.'), ...lookCard(c)));
    }
    function actCard(o, a) { const sc = o.sc, who = a.who ? castById(cfg, a.who) : null, A0 = ACT[a.k] || ['•', a.k, 'Feel', 1], set = o.set;
      const kinds = a.who ? Object.keys(ACT).filter(k => ACT[k][2] !== 'Scene' && ACT[k][2] !== 'Camera' && (ACT[k][2] !== 'Water' || set.water) && (ACT[k][2] !== 'Screen' || (sc.screens || []).length)) : a.k === 'closeup' ? ['closeup'] : ['caption', 'timejump'];
      const f = [];
      if (A0[4] === 'text') f.push(field(a.k === 'caption' || a.k === 'timejump' ? 'Text' : 'Words', area(a.text, v => { a.text = v; if (TALK.includes(a.k)) { const nd = r2(talkDur(v)); if (nd > a.dur) { a.dur = nd; settle(sc, a); } } changed(); }, a.k === 'think' ? 'What are they thinking?' : 'What do they say?', 3, 'Words')));
      if (A0[4] === 'spot') f.push(field('To', H('div', { className: 'st-seg wrap' }, ...spotsFor(sc).filter(x => a.k !== 'swim' || (set.marks[x] && set.marks[x].water)).map(x => H('button', { type: 'button', className: a.to === x ? 'on' : '', textContent: x, on: { click: () => { a.to = x; ch(); } } })), ...sc.people.filter(p => p.pid !== a.who).map(p => H('button', { type: 'button', className: a.to === '@' + p.pid ? 'on' : '', textContent: (castById(cfg, p.pid) || {}).name, on: { click: () => { a.to = '@' + p.pid; ch(); } } })))));
      if (SCRACT[a.k] && (sc.screens || []).length > 1) f.push(field('Which screen', H('div', { className: 'st-seg wrap' }, ...sc.screens.map((q, i) => H('button', { type: 'button', className: (scrFor(sc, a, 960) || {}).id === q.id ? 'on' : '', textContent: q.label || (SCREENS.find(z => z[0] === q.style) || ['', 'Screen'])[1] + ' ' + (i + 1), on: { click: () => { a.scr = q.id; ch(); } } })))));
      if (a.who && A0[2] !== 'Feel') f.push(field('Face', H('div', {}, H('div', { className: 'st-seg wrap' }, ...FACES.map(([k, l]) => H('button', { type: 'button', className: (a.face || '') === k ? 'on' : '', textContent: l, on: { click: () => { if (k) a.face = k; else delete a.face; ch(); } } }))),
        H('p', { className: 'hint' }, 'Auto keeps the feeling from before: put Gets angry ahead of this and they stay angry while they do it.'))));
      if (a.k === 'throwtv') f.push(field('What they throw', tiles(THROWABLES.map(([p2, l]) => [p2, l, propPic(p2), (a.prop || 'bottle') === p2, () => { a.prop = p2; ch(); }]), 6)));
      if (a.k === 'closeup') f.push(field('On', H('div', { className: 'st-seg wrap' }, ...sc.people.map(p => H('button', { type: 'button', className: a.on === p.pid ? 'on' : '', textContent: (castById(cfg, p.pid) || {}).name || '?', on: { click: () => { a.on = p.pid; ch(); } } })))));
      if (a.k === 'take' || a.k === 'give') f.push(field('What', tiles(PROPS.map(([p, l]) => [p, l, propPic(p), a.prop === p, () => { a.prop = p; ch(); }]), 5)));
      if (AIMED.includes(a.k) || (PACK.acts[a.k] && PACK.acts[a.k].target)) f.push(field(a.k === 'give' ? 'To whom' : a.k === 'spit' ? 'At' : 'Who', H('div', { className: 'st-seg wrap' }, ...(a.k === 'spit' || a.k === 'shoot' || a.k === 'swing' ? [H('button', { type: 'button', className: !a.to ? 'on' : '', textContent: a.k === 'spit' ? 'The ground' : 'Nobody', on: { click: () => { a.to = ''; ch(); } } })] : []), ...sc.people.filter(p => p.pid !== a.who).map(p => H('button', { type: 'button', className: a.to === p.pid ? 'on' : '', textContent: (castById(cfg, p.pid) || {}).name, on: { click: () => { a.to = p.pid; ch(); } } })))));
      if ((a.k === 'shoot' || a.k === 'swing') && a.to) f.push(field('How it ends', seg(HOWS.map(([k, l]) => [k, l]), a.how || 'dead', v => { if (v === 'dead') delete a.how; else a.how = v; ch(); })));
      if (a.k === 'smash') f.push(field('With', seg([['bottle', 'Bottle'], ['chair', 'Chair']], a.prop === 'chair' ? 'chair' : 'bottle', v => { a.prop = v; ch(); })));
      if (a.k === 'finger' || a.k === 'vsign') f.push(H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: !!a.both, on: { change: e => { a.both = e.target.checked; ch(); } } }), 'Both hands'));
      if (RUDE.includes(a.k)) f.push(field('CENSORED badge', seg([['', 'Story setting'], ['on', 'On'], ['off', 'Off']], a.cover === true ? 'on' : a.cover === false ? 'off' : '', v => { if (v === 'on') a.cover = true; else if (v === 'off') a.cover = false; else delete a.cover; ch(); })));
      if (TALK.includes(a.k)) f.push(field('Swearing in this bubble', seg([['', 'Story setting'], ['show', 'Show'], ['beep', 'Beep'], ['scribble', 'Scribble']], a.swear || '', v => { if (v) a.swear = v; else delete a.swear; ch(); })));
      root.append(card((who ? who.name + ': ' : '') + A0[1],
        field('Action', sel(a.k, kinds.map(k => [k, ACT[k][0] + '  ' + ACT[k][1]]), v => { a.k = v; const N = ACT[v]; if (N[4] === 'text' && a.text === undefined) a.text = ''; if (N[4] === 'spot' && !a.to) a.to = 'middle'; if ((v === 'give' || v === 'take') && !a.prop) a.prop = 'passport'; ch(); }, 'Action')),
        ...f,
        grid2(field('Starts at (in the scene)', num(a.start, v => { a.start = r2(v); settle(sc, a); changed(); }, 0, 600, 0.1, 'Starts at')), field('Lasts', num(a.dur, v => { a.dur = r2(Math.max(0.3, v)); settle(sc, a); changed(); }, 0.3, 60, 0.1, 'Lasts, seconds'))),
        H('p', { className: 'hint' }, 'Drag the bar to move it, drag its right edge to make it slower or quicker, or drop it on someone else\'s lane to give it to them. Anything after it on the lane moves along.'),
        foot(btn('Delete', () => { editor.remove(cfg, (a.who ? 'A:' : 'X:') + sc.id + ':' + a.id); changed(); if (done) done(); }))));
    }
    function screenCard(o, q) { const sc = o.sc, set = (k, v, full) => { q[k] = v; if (full) ch(); else changed(); };
      root.append(card('Screen in scene ' + (o.i + 1),
        H('p', { className: 'hint' }, 'A chalk frame for footage. Put a video in it here, or leave it empty and the hole exports see-through (or key green) for your editor. Drag it on the preview to move it and drag a corner to resize.'),
        field('Style', H('div', { className: 'st-seg wrap' }, ...SCREENS.map(([k, l]) => H('button', { type: 'button', className: (q.style || 'tv') === k ? 'on' : '', textContent: l, on: { click: () => set('style', k, true) } })))),
        grid2(field('What goes in it (for you, not shown)', txt(q.label, v => set('label', v), 'For example Sturgeon clip', 'Footage label')), field('Chalk caption under it', txt(q.caption, v => set('caption', v), 'Optional', 'Caption'))),
        field('Video in the screen', videoBox(q.media, r => { if (r) q.media = r; else delete q.media; }, 'Put a video in it…')),
        q.media ? field('Second channel (for the remote and swipe)', videoBox(q.media2, r => { if (r) q.media2 = r; else delete q.media2; }, 'Add a second video…')) : '',
        field('Size', range(+q.w || 900, 160, 1900, 10, v => { q.w = Math.round(v); changed(false); }, 'Screen width', v => Math.round(v) + ' px wide')),
        field('Tilt', range(+q.tilt || 0, -15, 15, 0.5, v => { if (Math.abs(v) < 0.3) delete q.tilt; else q.tilt = v; changed(false); }, 'Tilt', v => (Math.abs(v) < 0.3 ? 'Straight' : v.toFixed(1) + '°'))),
        grid2(field('Starts at (in the scene)', num(+q.start || 0, v => { q.start = r2(Math.max(0, v)); changed(); }, 0, 600, 0.1, 'Starts at')), field('Lasts', num(+q.dur || 6, v => { q.dur = r2(Math.max(1.2, v)); changed(); }, 1.2, 600, 0.1, 'Lasts, seconds'))),
        H('p', { className: 'hint' }, 'The chalk frame draws in, then the picture switches on about 0.75 s after the bar starts and off 0.3 s before it ends. Throw something at it and the glass cracks.'),
        foot(btn('Duplicate', () => { const id2 = editor.duplicate(cfg, 'Q:' + sc.id + ':' + q.id); changed(); const q2 = (sc.screens || []).find(x => 'Q:' + sc.id + ':' + x.id === id2); root.innerHTML = ''; if (q2) screenCard(o, q2); }), btn('Delete', () => { editor.remove(cfg, 'Q:' + sc.id + ':' + q.id); changed(); if (done) done(); else redo(); }))));
    }
    function screensBox() { const any = cfg.scenes.some(s2 => (s2.screens || []).length);
      return [field('Chalk dust over the footage', range(+cfg.dust || 0, 0, 0.4, 0.01, v => { cfg.dust = v; changed(false); }, 'Chalk dust', v => v < 0.01 ? 'None' : Math.round(v * 100) + '%')),
        H('p', { className: 'hint' }, 'For After Effects: tick Transparent background in Look to export a PNG sequence where only the screen holes are see-through, then put your footage on the layer underneath. Without it, MP4 exports fill the holes with key green.'),
        any ? btn('Download screen timings', () => { const blob = new Blob([screenCues(cfg)], { type: 'text/plain' }); if (E.saveBlob) E.saveBlob(blob, 'B roll timings.txt', [{ description: 'Text', accept: { 'text/plain': ['.txt'] } }]); }) : ''];
    }
    function storyCard() {
      root.append(card('The whole story',
        grid2(field('Board', sel(cfg.board || 'green', [['green', 'Classic green'], ['black', 'Black'], ['slate', 'Slate blue']], v => { cfg.board = v; ch(); }, 'Board colour')), field('Camera', sel(cfg.camera || 'gentle', [['gentle', 'Eases in on whoever talks'], ['fixed', 'Still']], v => { cfg.camera = v; ch(); }, 'Camera'))),
        ...screensBox(),
        field('Swearing in speech bubbles', seg([['show', 'Show it'], ['beep', 'Beep @#!'], ['scribble', 'Scribble out']], cfg.swear || 'show', v => { cfg.swear = v; ch(); })),
        H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: !!cfg.cover, on: { change: e => { cfg.cover = e.target.checked; ch(); } } }), 'Put a CENSORED badge over rude gestures'),
        field('Fights', seg([['cartoon', 'Cartoon: stars and teeth'], ['splat', 'Splat: chalk blood']], cfg.gore || 'cartoon', v => { cfg.gore = v; ch(); })),
        H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: cfg.pop !== false, on: { change: e => { cfg.pop = e.target.checked; ch(); } } }), 'Make the people stand out from the scenery'),
        cfg.pop !== false ? field('Scenery strength', range(cfg.bgStrength != null ? cfg.bgStrength : 0.6, 0.2, 1, 0.05, v => { cfg.bgStrength = v; changed(false); }, 'Scenery strength', v => Math.round(v * 100) + '%')) : '',
        H('label', { className: 'check' }, H('input', { type: 'checkbox', checked: cfg.frame !== false, on: { change: e => { cfg.frame = e.target.checked; changed(); } } }), 'Wooden frame round the board'),
        field('Everyone in the story', H('div', { className: 'st-cast' }, ...(cfg.cast || []).map(c => { const usedIn = cfg.scenes.filter(s => (s.people || []).some(p => p.pid === c.id)).length;
          return H('div', { className: 'st-who' }, H('span', { className: 'st-face' }, personPic(c, false)), H('div', { className: 'st-wm' }, H('b', { textContent: c.name }), H('span', { className: 'hint', textContent: usedIn ? `In ${usedIn} scene${usedIn > 1 ? 's' : ''}` : 'Not in any scene yet' })),
            H('div', { className: 'btnrow' }, btn('Change', () => { const o2 = P.scenes.find(x => x.sc.people && x.sc.people.some(p => p.pid === c.id)); root.innerHTML = ''; if (o2) personCard(o2, c.id); else root.append(card('How ' + c.name + ' looks', ...lookCard(c), H('div', { className: 'btnrow' }, btn('Done', redo)))); }), usedIn ? '' : UI.iconBtn('✕', 'Remove ' + c.name, () => { cfg.cast = cfg.cast.filter(x => x !== c); ch(); }))); }))),
        H('p', { className: 'hint' }, 'Tip: + Scene carries everyone on into the next place, walking in from the left.')));
    }
  }
  const mod = { id: 'story', name: 'Story', packs, mediaAt, mediaFor, defaults, duration, draw, form: (root, cfg, changed) => panel(root, cfg, null, changed, null), editor, blurHint, _plan: plan, _sim: simScene, _pose: poseOf, _figure: figure, _newAct: newAct, _set: buildSet, _cues: screenCues, ACT, PROPS, REGIONS, ERAS, PLACES, SCREENS };
  // The B roll tab: the same chalk world, set up around a screen for real footage with a presenter beside it
  function brollDefaults() {
    const cast = [{ id: 'host', name: 'Host', sex: 'man', colour: 'orange', dress: 'kilt', hair: 'spiky', beard: 'short' }];
    return { brollTab: true, board: 'green', camera: 'fixed', frame: true, pop: true, cover: false, swear: 'show', dust: 0.12, cast,
      scenes: [{ id: 'b1', type: 'scene', region: 'europe', era: 'modern', place: 'blank', weather: '', label: '', people: [{ pid: 'host', start: 'left', holding: '' }],
        screens: [{ id: 'q1', style: 'tv', x: 1180, y: 440, w: 900, start: 0, dur: 9.6, label: 'Your clip', caption: '', seed: 11 }],
        acts: [{ id: 'r1', who: 'host', k: 'point', start: 1.8, dur: 1.6 }, { id: 'r2', who: 'host', k: 'say', start: 3.6, dur: 2.4, text: 'Would you look at the state o this' }, { id: 'r3', who: 'host', k: 'facepalm', start: 6.4, dur: 1.6 }], extra: [] }] };
  }
  // B roll has no scenery: a new scene is just the board with a telly ready for footage, and there are no map hops
  const brollEditor = Object.assign({}, editor, { adds: editor.adds.filter(a => a.label !== 'Travel').map(a => a.label !== 'Scene' ? a : { label: 'Scene', title: 'Add a scene after the one at the playhead, with a screen ready for your video. The people carry on into it.',
    fn(cfg, t, sel) { const id = a.fn(cfg, t, sel, null), sc = cfg.scenes.find(x => 'S:' + x.id === id); if (sc) { sc.place = 'blank'; if (!(sc.screens || []).length) newScreen(sc, 'tv', 0); } return id; } }) });
  const broll = Object.assign({}, mod, { id: 'broll', name: 'B roll', defaults: brollDefaults, editor: brollEditor });
  globalThis.Broll = broll;
  return mod;
})();

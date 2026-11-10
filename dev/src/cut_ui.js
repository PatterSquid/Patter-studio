/* CutUI: the Video tab's editing workspace, laid out like CapCut.
   Left: the library (your media, sound and effects, text and stickers, transitions, looks, Patter clips).
   Middle: the player. Right: the selected clip's settings, in tabs. Bottom: the multi-track timeline.
   Selections are shared with the app's editor: 'C:id' a clip on any track, 'T:id' the transition after a main track clip,
   'K:id' a track, 'L:id' a text or sticker layer. */
const CutUI = (() => {
  const { H } = UI;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const V = () => Video;
  const svg = p => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">${p}</svg>`;
  const I = {
    split: svg('<path d="M12 2v20M7 7l-4 5 4 5M17 7l4 5-4 5" stroke="currentColor" stroke-width="2" fill="none"/>'),
    del: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" fill="none"/>'),
    ripple: svg('<path d="M4 7h10M6 7l1 12h5l1-12M16 12h5M18 9l3 3-3 3" stroke="currentColor" stroke-width="2" fill="none"/>'),
    dup: svg('<rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 16V5a1 1 0 0 1 1-1h11" stroke="currentColor" stroke-width="2" fill="none"/>'),
    freeze: svg('<path d="M12 2v20M3 7l18 10M21 7L3 17" stroke="currentColor" stroke-width="2"/>'),
    detach: svg('<path d="M3 9h12M3 15h18M15 6l3 3-3 3" stroke="currentColor" stroke-width="2" fill="none"/>'),
    undo: svg('<path d="M9 7H5V3M5 7a8 8 0 1 1-1 7" stroke="currentColor" stroke-width="2" fill="none"/>'),
    redo: svg('<path d="M15 7h4V3M19 7a8 8 0 1 0 1 7" stroke="currentColor" stroke-width="2" fill="none"/>'),
    snap: svg('<path d="M6 3v8a6 6 0 0 0 12 0V3M6 3h4v8M14 3h4" stroke="currentColor" stroke-width="2" fill="none"/>'),
    marker: svg('<path d="M6 3h12v14l-6 4-6-4z" stroke="currentColor" stroke-width="2" fill="none"/>'),
    eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
    eyeOff: svg('<path d="M3 3l18 18M10.6 5.2A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.8M6.5 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1" stroke="currentColor" stroke-width="2" fill="none"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="2" fill="none"/>'),
    unlock: svg('<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V7a4 4 0 0 1 7.5-2" stroke="currentColor" stroke-width="2" fill="none"/>'),
    sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8a5 5 0 0 1 0 8" stroke="currentColor" stroke-width="2" fill="none"/>'),
    mute: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2"/>'),
    play: svg('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'), pause: svg('<path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/>'),
    prev: svg('<path d="M6 4h2v16H6zM20 4v16L9 12z" fill="currentColor"/>'), next: svg('<path d="M16 4h2v16h-2zM4 4v16l11-8z" fill="currentColor"/>'),
    full: svg('<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" stroke="currentColor" stroke-width="2" fill="none"/>'),
    key: svg('<path d="M12 3l9 9-9 9-9-9z" fill="currentColor"/>'), keyOff: svg('<path d="M12 3l9 9-9 9-9-9z" stroke="currentColor" stroke-width="2" fill="none"/>'),
    fit: svg('<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" stroke="currentColor" stroke-width="2" fill="none"/>'),
    shot: svg('<rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 6l2-3h4l2 3" stroke="currentColor" stroke-width="2" fill="none"/>'),
  };
  const ic = (name, title, fn, extra) => H('button', Object.assign({ type: 'button', className: 'ci', title, 'aria-label': title, innerHTML: I[name] || name, on: { click: fn } }, extra || {}));
  const tc = (s, fps = 30) => { s = Math.max(0, s); const m = Math.floor(s / 60), sec = Math.floor(s % 60), f = Math.floor((s - Math.floor(s)) * fps + 1e-6); return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + ':' + String(f).padStart(2, '0'); };
  const short = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m ? m + ':' + String(Math.floor(r)).padStart(2, '0') : r.toFixed(r < 10 ? 1 : 0) + 's'; };

  function create(o) {
    /* o: { getCfg, getLook, setLook(k, v), player, ed, changed(full), commit, say, tabCfg(k), openItem(id), assetsChanged() } */
    const look = () => o.getLook(), cfg = () => o.getCfg();
    let active = false, pps = 60, fitted = false, altKey = false, curT = 0, drag = null, libTab = 'media', inspTab = {}, clipboard = null;
    const sel = () => o.ed.selected, select = id => { o.ed.select(id); markSel(); };
    const changed = full => o.changed(full !== false);

    /* ---------- Workspace ---------- */
    const lib = H('aside', { className: 'cut-lib', 'aria-label': 'Library' }), libTabs = H('div', { className: 'cl-tabs', role: 'tablist' }), libBody = H('div', { className: 'cl-body' });
    lib.append(libTabs, libBody);
    const tl = H('section', { className: 'cut-tl', 'aria-label': 'Timeline' });
    const topbar = H('div', { className: 'cut-top' });
    const fileIn = H('input', { type: 'file', multiple: true, accept: 'video/*,audio/*,image/*,.mov,.mkv,.m4a,.flac,.opus', hidden: true, on: { change: e => { importFiles([...e.target.files]); e.target.value = ''; } } });
    lib.append(fileIn);

    /* ---------- Library ---------- */
    const LIB = [['media', 'Media', '🎞'], ['audio', 'Audio', '♪'], ['text', 'Text', 'T'], ['stickers', 'Stickers', '☺'], ['effects', 'Effects', '✦'], ['trans', 'Transitions', '⧓'], ['looks', 'Filters', '◐'], ['patter', 'Patter', '▣']];
    function drawLibTabs() { libTabs.innerHTML = ''; LIB.forEach(([k, l, i]) => libTabs.append(H('button', { type: 'button', role: 'tab', className: libTab === k ? 'on' : '', 'aria-selected': String(libTab === k), title: l, on: { click: () => { libTab = k; drawLibTabs(); drawLib(); } } }, H('i', { textContent: i }), H('span', { textContent: l })))); }
    const drag0 = (el, data) => { el.draggable = true; el.addEventListener('dragstart', e => { e.dataTransfer.setData('application/x-cut', JSON.stringify(data)); e.dataTransfer.effectAllowed = 'copy'; dragData = data; }); el.addEventListener('dragend', () => { dragData = null; dropMark(null); }); return el; };
    let dragData = null, mediaFilter = 'all', importing = [];
    function binIds() { const c = cfg(); c.bin = c.bin || []; const used = new Set(V().assetsUsed(c)); used.forEach(id => { const m = CutMedia.info(id); if (!c.bin.includes(id) && !(m && m.builtin)) c.bin.push(id); }); return c.bin.filter(id => { const m = CutMedia.info(id); return m && !m.builtin; }); }
    function drawLib() {
      libBody.innerHTML = ''; libBody._n = (libBody._n || 0) + 1;
      if (libTab === 'audio') return drawAudio();
      if (libTab === 'media') return drawMedia(false);
      if (libTab === 'text' || libTab === 'stickers') return drawLayers(libTab);
      if (libTab === 'effects') { libBody.append(H('p', { className: 'hint', textContent: 'Click to add to the selected clip, or drag onto a clip. With nothing selected it goes on its own track at the playhead, over everything under it.' }));
        const g = H('div', { className: 'cl-grid' }); Object.entries(CutGL.EFFECTS).forEach(([k, e]) => g.append(drag0(H('button', { type: 'button', className: 'cl-tile fx', title: e.label, on: { click: () => applyFx(k) } }, H('i', { textContent: e.icon }), H('span', { textContent: e.label })), { type: 'fx', k }))); libBody.append(g); return; }
      if (libTab === 'trans') { libBody.append(H('p', { className: 'hint', textContent: 'Click to put it on the cut nearest the playhead, or drag it onto any cut (the diamond between two clips on the main track).' }));
        const g = H('div', { className: 'cl-grid' }); Object.entries(V().TRANS).filter(([k]) => k !== 'none').forEach(([k, l]) => g.append(drag0(H('button', { type: 'button', className: 'cl-tile tr', title: l, on: { click: () => applyTrans(k) } }, transIcon(k), H('span', { textContent: l })), { type: 'trans', k }))); libBody.append(g); return; }
      if (libTab === 'looks') { libBody.append(H('p', { className: 'hint', textContent: 'Click to grade the selected clip, or drag onto a clip. With nothing selected it grades everything from the playhead for 5 seconds (an adjustment clip you can stretch).' }));
        const g = H('div', { className: 'cl-grid looks' }); Object.entries(CutGL.LOOKS).forEach(([k, L]) => { const cv = H('canvas', { width: 96, height: 54 }); lookThumb(cv, k); g.append(drag0(H('button', { type: 'button', className: 'cl-tile lk', title: L.label, on: { click: () => applyLook(k) } }, cv, H('span', { textContent: L.label })), { type: 'look', k })); }); libBody.append(g); return; }
      if (libTab === 'patter') return drawPatter();
    }
    /* ---------- Sound: his own library (a folder on his computer), what is in this project, and sounds made here ---------- */
    let audioSub = 'lib', sndQ = '', sndFolder = 'all', sndShown = 150, sndOpen = '';
    function drawAudio() {
      const tabs = H('div', { className: 'cl-sub2' }, ...[['lib', 'My library'], ['proj', 'In this project'], ['made', 'Made here']].map(([k, l]) => H('button', { type: 'button', className: audioSub === k ? 'on' : '', textContent: l, on: { click: () => { audioSub = k; drawLib(); } } })));
      libBody.append(tabs);
      if (audioSub === 'proj') return drawMedia(true, 'proj');
      if (audioSub === 'made') return drawMedia(true, 'made');
      drawSounds();
    }
    function drawSounds() {
      const L = typeof SoundLib !== 'undefined' ? SoundLib : null; if (!L) return; const box = H('div', { className: 'snd' }); libBody.append(box);
      if (!L.supported()) { box.append(H('p', { className: 'hint', textContent: 'This browser cannot open folders on your computer. Open Patter Studio in Microsoft Edge to use your sound library.' })); return; }
      if (L.state === 'none') { box.append(H('div', { className: 'snd-start' }, H('b', { textContent: 'Your sound library' }),
          H('p', { textContent: 'Keep the music and sound effects you download in one folder on your computer, like CapCut’s sounds but yours. Make a folder called Patter Sounds (on your Desktop, say), then choose it here. Patter Studio adds Music and Sound effects folders inside it.' }),
          H('button', { type: 'button', className: 'primary', textContent: 'Choose your sound folder', on: { click: async () => { try { await L.choose(); drawLib(); } catch (e) { if (e && e.name !== 'AbortError') o.say(e.message || String(e), true); } } } }))); return; }
      if (L.state === 'locked') { box.append(H('div', { className: 'snd-start' }, H('b', { textContent: 'Your sound library: ' + L.name }), H('p', { textContent: 'Edge asks once each time you open Patter Studio before it lets the app into the folder.' }),
          H('button', { type: 'button', className: 'primary', textContent: 'Open ' + L.name, on: { click: async () => { try { await L.unlock(); } catch (e) { o.say(e.message || String(e), true); } drawLib(); } } }),
          H('button', { type: 'button', className: 'snd-link', textContent: 'Use a different folder', on: { click: async () => { try { await L.choose(); drawLib(); } catch (e) { } } } }))); return; }
      const fileAdd = H('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus', hidden: true, on: { change: async e => { const f = [...e.target.files]; e.target.value = ''; await addToLib(f); } } });
      const search = H('input', { type: 'search', className: 'snd-q', value: sndQ, placeholder: 'Search ' + L.count.toLocaleString() + ' sounds', 'aria-label': 'Search your sounds', on: { input: e => { sndQ = e.target.value; sndShown = 150; fillList(); } } });
      const chips = H('div', { className: 'snd-chips' }, ...[['all', 'All'], ['fav', '★ Favourites'], ...L.folders().map(f => [f, f])].map(([k, l]) => H('button', { type: 'button', className: sndFolder === k ? 'on' : '', textContent: l, on: { click: () => { sndFolder = k; sndShown = 150; drawLib(); } } })));
      box.append(H('div', { className: 'snd-head' }, search, H('button', { type: 'button', className: 'sm', title: 'Add downloaded sounds into your library folder', textContent: '+ Add', on: { click: () => fileAdd.click() } }), H('button', { type: 'button', className: 'sm', title: 'Look in the folder again for new files', textContent: '↻', on: { click: () => L.scan() } }), fileAdd), chips);
      const count = H('div', { className: 'snd-count' }), listEl = H('div', { className: 'snd-list', title: 'Drop downloaded sounds here to add them to your library' });
      box.append(count, listEl, H('div', { className: 'snd-foot' }, H('button', { type: 'button', className: 'sm', textContent: 'Credits for this video', title: 'The sounds from your library in this video, with your notes, ready to paste into the description', on: { click: showCredits } }), H('span', { className: 'hint', textContent: L.name + (L.scanning ? ' · looking…' : '') })));
      listEl.addEventListener('dragover', e => { if ([...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); e.stopPropagation(); listEl.classList.add('drop'); } });
      listEl.addEventListener('dragleave', () => listEl.classList.remove('drop'));
      listEl.addEventListener('drop', e => { const f = [...(e.dataTransfer.files || [])]; if (!f.length) return; e.preventDefault(); e.stopPropagation(); listEl.classList.remove('drop'); lib.classList.remove('dropping'); addToLib(f); });
      function fillList() {
        const all = L.list({ q: sndQ, folder: sndFolder }); listEl.innerHTML = ''; count.textContent = L.count ? all.length.toLocaleString() + ' of ' + L.count.toLocaleString() + ' sounds' : (L.scanning ? 'Looking through the folder…' : '');
        if (!L.count && !L.scanning) listEl.append(H('div', { className: 'cl-drop' }, H('b', { textContent: 'No sounds yet' }), H('p', { textContent: 'Drop the music and sound effects you download here, or press + Add. They are saved into ' + L.name + ' on your computer: music in Music, short sounds in Sound effects.' })));
        const now = L.playing();
        all.slice(0, sndShown).forEach(x => { const m = L.metaOf(x.path), on = now === x.path;
          const row = drag0(H('div', { className: 'snd-row' + (on ? ' on' : ''), title: x.path + (m.note ? '\n' + m.note : '') + '\nDrag onto the timeline, or + to add at the playhead', on: { dblclick: () => addSnd(x.path) } },
            H('button', { type: 'button', className: 'snd-play', 'aria-label': (on ? 'Stop ' : 'Play ') + x.name, textContent: on ? '■' : '▶', on: { click: async e => { e.stopPropagation(); try { await L.play(x.path); } catch (er) { o.say('That file could not be played: ' + (er.message || er), true); } } } }),
            H('div', { className: 'snd-t' }, H('span', { className: 'snd-n', textContent: x.name }), H('span', { className: 'snd-s', textContent: [x.sub || 'Library', x.dur ? short(x.dur) : '', (x.ext || '').toUpperCase(), m.note ? '✎' : ''].filter(Boolean).join(' · ') })),
            H('button', { type: 'button', className: 'snd-star' + (m.fav ? ' on' : ''), title: m.fav ? 'Favourite' : 'Make a favourite', textContent: m.fav ? '★' : '☆', on: { click: e => { e.stopPropagation(); L.setMeta(x.path, { fav: !m.fav }); } } }),
            H('button', { type: 'button', className: 'snd-i', title: 'Notes: where it came from, credit needed', textContent: 'i', on: { click: e => { e.stopPropagation(); sndOpen = sndOpen === x.path ? '' : x.path; fillList(); } } }),
            H('button', { type: 'button', className: 'snd-add', title: 'Add at the playhead', textContent: '+', on: { click: e => { e.stopPropagation(); addSnd(x.path); } } })), { type: 'snd', path: x.path, dur: x.dur });
          listEl.append(row);
          if (sndOpen === x.path) listEl.append(H('div', { className: 'snd-note' }, H('textarea', { rows: 2, value: m.note || '', placeholder: 'Where it came from, and the credit if it needs one (e.g. Music by Kevin MacLeod, CC BY 4.0)', on: { change: e => L.setMeta(x.path, { note: e.target.value.slice(0, 400) }) } }))); });
        if (all.length > sndShown) listEl.append(H('button', { type: 'button', className: 'snd-more', textContent: 'Show more (' + (all.length - sndShown).toLocaleString() + ')', on: { click: () => { sndShown += 300; fillList(); } } }));
      }
      fillList();
    }
    async function addToLib(files) { try { o.say('Adding ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' to your library…'); const done = await SoundLib.addFiles(files, sndFolder); o.say(done.length ? 'Added to your library: ' + done.join(', ') : 'Those were not sound files.'); drawLib(); } catch (e) { o.say(e.message || String(e), true); } }
    // a library sound into the video: music on a Music track that lowers under talking, the rest like any sound
    async function addSnd(path, t, row) { try { o.say('Adding ' + path.split('/').pop() + '…'); const id = await SoundLib.asset(path); o.commit(); const c = cfg(); c.bin = c.bin || []; if (!c.bin.includes(id)) c.bin.push(id);
        const it = itemFor(id); if (!it) return; it.start = r3(Math.max(0, t == null ? o.player.t : t)); const music = /^music/i.test(path) || /music/i.test(path.split('/').slice(0, -1).join('/'));
        let T = row && row.kind === 'audio' ? row.T : null;
        if (!T && music) { c.tracks = c.tracks || []; T = c.tracks.find(q => q.kind === 'audio' && q.music); if (!T) { T = { id: V().nid('t'), kind: 'audio', name: 'Music', music: true, duck: true, items: [] }; c.tracks.push(T); } if (it.vol == null) it.vol = -8; }
        V().placeFree(c, 'audio', it, T); changed(); build(); select('C:' + it.id); o.say(''); }
      catch (e) { o.say(e.message || String(e), true); } }
    function showCredits() { const c = cfg(), lines = SoundLib.credits(V().assetsUsed(c)); let d = document.getElementById('sndCredits'); if (d) d.remove();
      const text = lines.length ? 'Sounds:\n' + lines.join('\n') : ''; d = H('dialog', { id: 'sndCredits', className: 'th-dlg' }, H('div', { className: 'dlg-head' }, H('b', { textContent: 'Credits for this video' }), H('button', { type: 'button', textContent: 'Close', on: { click: () => d.close() } })),
        H('div', { className: 'th-dbody' }, lines.length ? H('textarea', { rows: Math.min(14, lines.length + 2), value: text, readOnly: true }) : H('p', { className: 'hint', textContent: 'No sounds from your library are in this video yet.' }),
          lines.length ? H('div', { className: 'btnrow' }, H('button', { type: 'button', className: 'primary', textContent: 'Copy', on: { click: async () => { try { await navigator.clipboard.writeText(text); o.say('Credits copied: paste them into the description.'); d.close(); } catch (e) { } } } })) : '',
          H('p', { className: 'hint', textContent: 'From the notes on each sound (the i button). Add where it came from and any credit it needs when you download it.' })));
      document.body.append(d); d.showModal(); }
    function drawMedia(audioOnly, part) {
      if (part === 'made') { libBody.append(H('p', { className: 'hint', textContent: 'Sound effects made on the spot: click one to add it at the playhead.' })); const s = H('div', { className: 'cl-grid' }); Object.entries(SFX).forEach(([k, f]) => s.append(H('button', { type: 'button', className: 'cl-tile', title: 'Make and add at the playhead', on: { click: () => addSfx(k) } }, H('i', { textContent: f.icon }), H('span', { textContent: f.label })))); libBody.append(s); return; }
      const ids = binIds(), all = audioOnly ? ids.filter(id => { const m = CutMedia.info(id); return m.kind === 'audio'; }) : ids.filter(id => mediaFilter === 'all' || CutMedia.info(id).kind === mediaFilter);
      const head = H('div', { className: 'cl-head' }, H('button', { type: 'button', className: 'primary sm', textContent: audioOnly ? '+ Import sound' : '+ Import', on: { click: () => fileIn.click() } }));
      if (!audioOnly) head.append(UI.sel(mediaFilter, [['all', 'Everything'], ['video', 'Footage'], ['image', 'Pictures'], ['audio', 'Sound']], v => { mediaFilter = v; drawLib(); }, 'Show'));
      libBody.append(head);
      const missing = missingAssets(); if (missing.length && !audioOnly) libBody.append(H('div', { className: 'cl-missing' }, H('b', { textContent: missing.length + (missing.length > 1 ? ' files used in this video aren\'t' : ' file used in this video isn\'t') + ' on this computer' }), H('p', { textContent: missing.map(x => x.file).join(', ') }), H('button', { type: 'button', textContent: 'Find them…', on: { click: () => relinkPick() } })));
      importing.forEach(j => libBody.append(H('div', { className: 'cl-imp' }, H('span', { textContent: j.name }), H('i', { style: `width:${Math.round(j.p * 100)}%` }), H('em', { textContent: j.msg || '' }))));
      if (!all.length) libBody.append(H('div', { className: 'cl-drop' }, H('b', { textContent: audioOnly ? 'No sound yet' : 'Drop your footage here' }), H('p', { textContent: audioOnly ? 'Import voiceover, music or sound effects (MP3, WAV, M4A), or make one below.' : 'Video (MP4, MOV, WebM), sound (MP3, WAV, M4A) and pictures (PNG, JPG). Full length, full quality. Drag them onto the timeline, or click + on a card.' })));
      const g = H('div', { className: 'cl-media' });
      all.forEach(id => { const m = CutMedia.info(id), used = V().assetsUsed(cfg()).includes(id), cv = H('canvas', { width: 160, height: 90 });
        paintCard(cv, m);
        const card = drag0(H('div', { className: 'cl-card' + (used ? ' used' : ''), title: m.name + (m.dur ? ' (' + short(m.dur) + ')' : ''), tabIndex: 0, on: { dblclick: () => addAsset(id), keydown: e => { if (e.key === 'Enter') addAsset(id); } } },
          cv, H('span', { className: 'nm', textContent: m.name }), m.dur ? H('span', { className: 'du', textContent: short(m.dur) }) : '', H('span', { className: 'kd', textContent: m.kind === 'video' ? (m.hasAudio ? '🎞♪' : '🎞') : m.kind === 'audio' ? '♪' : '🖼' }),
          H('button', { type: 'button', className: 'add', title: 'Add at the playhead', 'aria-label': 'Add ' + m.name + ' at the playhead', textContent: '+', on: { click: e => { e.stopPropagation(); addAsset(id); } } }),
          H('button', { type: 'button', className: 'rm', title: 'Remove from this project', 'aria-label': 'Remove ' + m.name, textContent: '×', on: { click: e => { e.stopPropagation(); removeAsset(id); } } })), { type: 'asset', id });
        g.append(card); });
      libBody.append(g);

      // Other footage on this computer, from other projects
      const others = CutMedia.list().filter(m => !ids.includes(m.id) && (!audioOnly || m.kind === 'audio'));
      if (others.length) { const d = H('details', { className: 'cl-other' }, H('summary', { textContent: 'From your other projects (' + others.length + ')' })); others.slice(0, 60).forEach(m => d.append(H('div', { className: 'cl-orow' }, H('span', { textContent: m.name }), H('button', { type: 'button', textContent: 'Use', on: { click: () => { cfg().bin.push(m.id); changed(); drawLib(); } } })))); libBody.append(d); }
      const libDraw = libBody._n; CutMedia.usage().then(u => { if (libBody._n !== libDraw || (libTab !== 'media' && libTab !== 'audio')) return; libBody.querySelectorAll('.cl-use').forEach(x => x.remove()); if (u && u.usage) libBody.append(H('p', { className: 'hint cl-use', textContent: 'Footage stored in this browser: ' + (u.usage / 1e9).toFixed(1) + ' GB of ' + (u.quota / 1e9).toFixed(0) + ' GB available.' })); });
    }
    function paintCard(cv, m) { const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#0b1424'; g.fillRect(0, 0, 160, 90);
      if (m.kind === 'audio' || (!m.thumbs && m.peaks)) { g.fillStyle = '#3fbf7f'; const P = m.peaks; if (P) for (let x = 0; x < 160; x++) { const v = P[Math.floor(x / 160 * P.length)] / 255 * 38; g.fillRect(x, 45 - v, 1, v * 2); } else { g.fillStyle = '#3fbf7f'; g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText('♪', 80, 56); } return; }
      const b = CutMedia.thumb(m.id, m.dur ? m.dur * 0.3 : 0); if (b) { const k = Math.max(160 / b.width, 90 / b.height); g.drawImage(b, (160 - b.width * k) / 2, (90 - b.height * k) / 2, b.width * k, b.height * k); } else { g.fillStyle = '#556'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText('Reading…', 80, 50); } }
    function lookThumb(cv, k) { const g = cv.getContext('2d'), w = cv.width, h = cv.height, src = H('canvas', { width: w, height: h }), sg = src.getContext('2d');
      const gr = sg.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#d9a066'); gr.addColorStop(0.5, '#4a7bb5'); gr.addColorStop(1, '#2e4d2e'); sg.fillStyle = gr; sg.fillRect(0, 0, w, h); sg.fillStyle = '#f3d2b3'; sg.beginPath(); sg.arc(w * 0.35, h * 0.45, h * 0.22, 0, 7); sg.fill(); sg.fillStyle = '#a33'; sg.fillRect(w * 0.6, h * 0.3, w * 0.25, h * 0.5);
      try { const out = CutGL.process(src, w, h, w, h, CutGL.params({ col: { look: k } }, 0)); g.drawImage(out, 0, 0); } catch (e) { g.drawImage(src, 0, 0); } }
    function transIcon(k) { const cv = H('canvas', { width: 96, height: 54 }), g = cv.getContext('2d'), A = H('canvas', { width: 96, height: 54 }), B = H('canvas', { width: 96, height: 54 }); A.getContext('2d').fillStyle = '#2f6fb5'; A.getContext('2d').fillRect(0, 0, 96, 54); const bg = B.getContext('2d'); bg.fillStyle = '#e3302c'; bg.fillRect(0, 0, 96, 54); bg.fillStyle = '#fff'; bg.font = 'bold 20px sans-serif'; bg.fillText('B', 40, 35);
      try { V().transition(g, A, B, k, 0.45, 96, 54); } catch (e) { } return cv; }
    function drawLayers(which) {
      const W2 = Layers.wrap(Video), adds = (W2.editor.adds || []).filter(a => a.group === 'layer'), want = which === 'text' ? a => /text|caption|title|label/i.test(a.label) : a => !/text|caption|title|label/i.test(a.label);
      libBody.append(H('p', { className: 'hint', textContent: which === 'text' ? 'Adds at the playhead, on its own track above the video. Click it on the preview to move it, and change it on the right.' : 'Stickers, shapes, props, pictures and camera moves, at the playhead.' }));
      adds.filter(want).forEach(a => {
        const g = H('div', { className: 'cl-grid' }); libBody.append(H('h4', { className: 'cl-sub', textContent: a.label }), g);
        const run = ch => { try { o.commit(); const id = a.fn(cfg(), o.player.t, sel(), ch); Promise.resolve(id).then(x => { changed(); if (x) select(x); }); } catch (e) { console.warn(e); } };
        if (a.choices) a.choices().forEach(ch => { const cv = H('canvas', { width: 64, height: 40 }); try { ch.icon && ch.icon(cv); } catch (e) { } g.append(H('button', { type: 'button', className: 'cl-tile', title: ch.label, on: { click: () => run(ch) } }, cv, H('span', { textContent: ch.label }))); });
        else g.append(H('button', { type: 'button', className: 'cl-tile', title: a.title || a.label, on: { click: () => run() } }, H('i', { textContent: '+' }), H('span', { textContent: a.label })));
      });
    }
    function drawPatter() {
      if (typeof Intro !== 'undefined') { const cv = H('canvas', { width: 320, height: 180 }), ic = o.tabCfg('intro'); Intro.ready().then(() => { try { Intro.draw(cv.getContext('2d'), Math.max(0, Intro.mainLen(ic) - 0.7), ic, {}, 320, 180); } catch (e) { } });
        libBody.append(H('h4', { className: 'cl-sub', textContent: 'Your intro' }), H('div', { className: 'cl-intro' }, drag0(H('button', { type: 'button', className: 'cl-tile cl-introbtn', title: 'Put the PatterSquid intro at the start of the video, with its sound', on: { click: () => addIntro() } }, cv, H('span', { textContent: '+ Add intro' })), { type: 'intro' }))); }
      libBody.append(H('p', { className: 'hint', textContent: 'Clips from the other tabs: each starts as a copy of what is on that tab now, and Edit opens it there. Drag onto the main track or above it.' }));
      const g = H('div', { className: 'cl-grid' });
      Object.entries(V().NAMES).filter(([k]) => V().raw(k)).forEach(([k, l]) => g.append(drag0(H('button', { type: 'button', className: 'cl-tile pt', style: '--c:' + V().COLS[k], title: 'Add a copy of what is in the ' + l + ' tab now', on: { click: () => addPatter(k) } }, H('i', { textContent: '▣' }), H('span', { textContent: l })), { type: 'patter', k })));
      libBody.append(g, H('h4', { className: 'cl-sub', textContent: 'Building blocks' }));
      const b = H('div', { className: 'cl-grid' });
      b.append(drag0(H('button', { type: 'button', className: 'cl-tile', title: 'You talking to camera in your studio, with your avatar carrying on from the last time', on: { click: () => addBlock('avatar') } }, H('i', { textContent: '🎙' }), H('span', { textContent: 'You in the studio' })), { type: 'block', k: 'avatar' }),
        drag0(H('button', { type: 'button', className: 'cl-tile', title: 'A plain colour card', on: { click: () => addBlock('colour') } }, H('i', { textContent: '■' }), H('span', { textContent: 'Colour card' })), { type: 'block', k: 'colour' }),
        drag0(H('button', { type: 'button', className: 'cl-tile', title: 'Grades and treats everything under it', on: { click: () => addBlock('adjust') } }, H('i', { textContent: '◐' }), H('span', { textContent: 'Adjustment' })), { type: 'block', k: 'adjust' }));
      libBody.append(b);
    }

    /* ---------- Missing files: a project opened on another computer, or footage deleted from this one ---------- */
    function missingAssets() { const c = cfg(), out = new Map(); V().allPlaced(c, look()).forEach(p => { const it = p.it; if (it.asset && !CutMedia.info(it.asset)) { const k = it.asset; if (!out.has(k)) out.set(k, { id: k, file: it.file || it.name || 'a file' }); } }); return [...out.values()]; }
    const relinkIn = H('input', { type: 'file', multiple: true, hidden: true, accept: 'video/*,audio/*,image/*,.mov,.mkv,.m4a,.flac', on: { change: async e => { const fs = [...e.target.files]; e.target.value = ''; await relink(fs, relinkWant); } } }); lib.append(relinkIn);
    let relinkWant = null;
    function relinkPick(oldId) { relinkWant = oldId || null; relinkIn.multiple = !oldId; relinkIn.click(); }
    // Imports the chosen files and points every clip that used the missing one at it (matched by name, or the one asked for)
    async function relink(files, only) { if (!files.length) return; const ms = await importFiles(files); if (!ms.length) return; o.commit(); const c = cfg(), miss = missingAssets(); let n = 0;
      const all = []; (c.items || []).forEach(x => all.push(x)); (c.tracks || []).forEach(T => (T.items || []).forEach(x => all.push(x)));
      miss.forEach(mi => { if (only && mi.id !== only) return; const m = only ? ms[0] : ms.find(x => x.name.toLowerCase() === String(mi.file).toLowerCase()); if (!m) return; all.forEach(x => { if (x.asset === mi.id) { x.asset = m.id; x.file = m.name; n++; } }); c.bin = (c.bin || []).filter(b => b !== mi.id); });
      changed(); build(); drawLib(); o.say(n ? 'Found it: ' + n + ' clip' + (n > 1 ? 's' : '') + ' put back.' : 'None of those files matched the missing ones by name. Select a missing clip and use Find this file to choose one directly.'); }

    /* ---------- Adding things ---------- */
    async function importFiles(files, at) {
      files = files.filter(f => CutMedia.kindOf(f)); if (!files.length) { o.say('Those files are not video, sound or pictures Patter Studio can use.', true); return []; }
      const jobs = files.map(f => ({ name: f.name, p: 0, msg: 'Copying…' })); importing.push(...jobs); if (libTab !== 'media' && libTab !== 'audio') libTab = 'media'; drawLibTabs(); drawLib();
      const out = [];
      for (let i = 0; i < files.length; i++) { const j = jobs[i];
        try { const m = await CutMedia.importFile(files[i], (p, what) => { j.p = p; j.msg = what === 'thumbs' ? 'Making thumbnails…' : what === 'waveform' ? 'Reading the sound…' : what === 'done' ? '' : j.msg; if (what === 'done') { importing = importing.filter(x => x !== j); } if (active) drawLibSoon(); });
          cfg().bin = cfg().bin || []; if (!cfg().bin.includes(m.id)) cfg().bin.push(m.id); out.push(m); j.msg = 'Reading…'; j.p = 0.05; if (m.unsaved) o.say('"' + m.name + '" is in, but this browser is out of storage room, so it won\'t be kept after closing.', true); }
        catch (e) { importing = importing.filter(x => x !== j); o.say(e.message || String(e), true); } }
      changed(); drawLib();
      if (at) { let t = at.t; for (const m of out) { const id = placeAsset(m.id, t, at.row); if (id) t = endOf(id); } changed(); build(); }
      return out;
    }
    let libTimer = 0; const drawLibSoon = () => { clearTimeout(libTimer); libTimer = setTimeout(() => { if (active) drawLib(); }, 250); };
    if (typeof SoundLib !== 'undefined') { SoundLib.onChange(() => { if (!active || libTab !== 'audio' || audioSub !== 'lib') return; const ae = document.activeElement; if (ae && lib.contains(ae) && /INPUT|TEXTAREA/.test(ae.tagName) && ae.type !== 'file') return; drawLibSoon(); }); SoundLib.load(); }
    async function removeAsset(id) { const c = cfg(); if (V().assetsUsed(c).includes(id) && !confirm('This is used in your video. Take it out of the video and this project?')) return; o.commit(); c.items = (c.items || []).filter(x => x.asset !== id); (c.tracks || []).forEach(T => T.items = (T.items || []).filter(x => x.asset !== id)); V().pruneTracks(c); c.bin = (c.bin || []).filter(x => x !== id); changed(); drawLib(); }
    // New clip from a file at time t: footage and pictures go on the main track at the playhead (or above, on an overlay
    // track, when the main track already has something under the playhead and row says so); sound goes on an audio track
    function itemFor(id) { const m = CutMedia.info(id); if (!m) return null; const it = { id: V().nid('c'), kind: m.kind === 'audio' ? 'audio' : 'media', asset: id, file: m.name }; if (m.kind === 'image') it.dur = 4; else { it.src0 = 0; it.src1 = r3(m.dur || 3); } return it; }
    function placeAsset(id, t, row) {
      const c = cfg(), it = itemFor(id); if (!it) return null; const m = CutMedia.info(id);
      if (it.kind === 'audio') { it.start = r3(Math.max(0, t)); const T = row && row.kind === 'audio' ? row.T : null; V().placeFree(c, 'audio', it, T); return 'C:' + it.id; }
      if (row && row.kind === 'video') { it.start = r3(Math.max(0, t)); V().placeFree(c, 'video', it, row.T); return 'C:' + it.id; }
      insertMain(c, it, t); return 'C:' + it.id;
    }
    // Into the main track at the cut nearest t
    function insertMain(c, it, t) { c.items = c.items || []; delete it.gap; if (c.free) { const pairs = V().mainStarts(c, look()); pairs.push({ it, start: Math.max(0, t), k: -1 }); V().setMainStarts(c, look(), pairs); return; } const L = V().layout(c, look()); let i = L.findIndex(x => t < x.t0 + x.d / 2); if (i < 0) i = L.length; c.items.splice(i, 0, it); }
    const endOf = id => { const p = V().allPlaced(cfg(), look()).find(q => 'C:' + q.it.id === id); return p ? p.t0 + p.d : 0; };
    function addAsset(id) { o.commit(); const m = CutMedia.info(id); const c = cfg(), t = o.player.t; let nid2;
      if (m.kind !== 'audio' && sel() && String(sel()).startsWith('C:')) { nid2 = placeAsset(id, t, null); }
      else nid2 = placeAsset(id, m.kind === 'audio' ? t : t, null);
      changed(); build(); if (nid2) select(nid2); }
    function addPatter(k, row, t) { o.commit(); const src = o.tabCfg(k), it = { id: V().nid('i'), kind: 'clip', mod: k, name: '', cfg: JSON.parse(JSON.stringify(src)), inPt: 0, hold: 0 }; const c = cfg(); t = t == null ? o.player.t : t;
      if (row && row.kind === 'video') { it.start = r3(t); V().placeFree(c, 'video', it, row.T); } else insertMain(c, it, t); changed(); build(); select('C:' + it.id); }
    // The intro goes on the main track (at the very start unless dropped somewhere else), with its sound made the first time
    // The intro from the Intro tab goes at the very start (or where it is dropped), with its sound made the first time
    async function addIntro(t) { const src = JSON.parse(JSON.stringify(o.tabCfg('intro'))); try { await Intro.ensureSound(src); } catch (e) { o.say('The intro sound could not be made: ' + (e.message || e)); }
      o.commit(); const c = cfg(), it = { id: V().nid('i'), kind: 'clip', mod: 'intro', name: '', cfg: src, inPt: 0, hold: 0 }; if (t == null) { c.items = c.items || []; c.items.unshift(it); } else insertMain(c, it, t);
      changed(); build(); select('C:' + it.id); o.player.seek(V().allPlaced(c, look()).find(q => q.it === it).t0); o.say('Intro added. Its episode title, pub name and the rest are on the right.'); }
    // Intro clips bring their own sound: make it if this computer has not got it yet
    function introSounds() { if (typeof Intro === 'undefined') return; V().allPlaced(cfg(), look()).forEach(p => { const it = p.it; if (it.kind === 'clip' && it.mod === 'intro' && it.cfg && !CutMedia.info(Intro.soundId(it.cfg))) Intro.ensureSound(it.cfg).catch(() => { }); }); }
    function addBlock(k, row, t) { o.commit(); const c = cfg(); t = t == null ? o.player.t : t; let it;
      if (k === 'avatar') it = { id: V().nid('i'), kind: 'avatar', text: '', dur: 3 }; else if (k === 'colour') it = { id: V().nid('i'), kind: 'colour', fill: '#000000', dur: 3 }; else it = { id: V().nid('i'), kind: 'adjust', dur: 5, col: {} };
      if (k === 'adjust' || (row && row.kind === 'video' && k !== 'avatar')) { it.start = r3(t); V().placeFree(c, 'video', it, row && row.kind === 'video' ? row.T : null); } else insertMain(c, it, t);
      changed(); build(); select('C:' + it.id); }
    const selItem = () => { const id = sel(); if (!id || !String(id).startsWith('C:')) return null; return V().findItem(cfg(), id); };
    function applyFx(k, target) { o.commit(); let f = target || selItem(); if (!f || f.it.kind === 'avatar' || f.it.kind === 'audio') { addBlock('adjust'); f = selItem(); }
      f.it.fx = f.it.fx || []; if (!f.it.fx.some(x => x.k === k)) f.it.fx.push({ k, amt: 60 }); inspTab[f.it.id] = 'fx'; changed(); select('C:' + f.it.id); }
    function applyLook(k, target) { o.commit(); let f = target || selItem(); if (!f || f.it.kind === 'avatar' || f.it.kind === 'audio') { addBlock('adjust'); f = selItem(); }
      f.it.col = Object.assign({}, f.it.col || {}, { look: k === 'none' ? undefined : k, lookAmt: 100 }); inspTab[f.it.id] = 'col'; changed(); select('C:' + f.it.id); }
    function applyTrans(k, afterId) { const c = cfg(), L = V().layout(c, look()); if (L.length < 2) { o.say('Transitions go between two clips on the main track. Add another clip first.'); return; }
      let i; if (afterId) i = L.findIndex(x => x.it.id === afterId); else { const t = o.player.t; let best = 1e9; L.slice(0, -1).forEach((x, j) => { const d = Math.abs(x.t0 + x.d - t); if (d < best) { best = d; i = j; } }); }
      if (i == null || i < 0 || i >= L.length - 1) return; o.commit(); L[i].it.tr = { k, d: (L[i].it.tr && L[i].it.tr.d) || 0.5 }; changed(); build(); select('T:' + L[i].it.id); }

    /* ---------- Sound effects, made on the spot ---------- */
    const SFX = {
      whoosh: { label: 'Whoosh', icon: '〰', d: 0.9 }, swoosh: { label: 'Swoosh up', icon: '↗', d: 0.7 }, boom: { label: 'Boom', icon: '💥', d: 1.6 }, punch: { label: 'Punch', icon: '👊', d: 0.35 },
      ding: { label: 'Ding', icon: '🔔', d: 1.4 }, pop: { label: 'Pop', icon: '○', d: 0.25 }, click: { label: 'Click', icon: '·', d: 0.08 }, riser: { label: 'Riser', icon: '⤴', d: 2.5 },
      buzzer: { label: 'Wrong buzzer', icon: '✗', d: 0.8 }, ching: { label: 'Cash register', icon: '£', d: 1.0 }, glitch: { label: 'Glitch', icon: '▤', d: 0.6 }, scratch: { label: 'Record scratch', icon: '◎', d: 0.6 },
      heart: { label: 'Heartbeat', icon: '♥', d: 1.6 }, shutter: { label: 'Camera', icon: '📷', d: 0.3 }, drop: { label: 'Bass drop', icon: '▼', d: 1.8 }, ping: { label: 'Notification', icon: '✉', d: 0.6 },
    };
    async function makeSfx(k) {
      const f = SFX[k], sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(f.d * sr), sr), out = ctx.createGain(); out.connect(ctx.destination);
      const noise = d => { const b = ctx.createBuffer(1, Math.ceil(d * sr), sr), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; return s; };
      const env = (g, pts) => { g.gain.setValueAtTime(pts[0][1], 0); pts.slice(1).forEach(([t, v]) => g.gain.linearRampToValueAtTime(v, t)); };
      const osc = (type, f0, f1, t1) => { const o2 = ctx.createOscillator(); o2.type = type; o2.frequency.setValueAtTime(f0, 0); if (f1) o2.frequency.exponentialRampToValueAtTime(f1, t1); return o2; };
      const chain = (src, pts, filt) => { const g = ctx.createGain(); env(g, pts); let n = src; if (filt) { n.connect(filt); n = filt; } n.connect(g); g.connect(out); src.start(0); };
      const bp = (type, f0, f1, t1, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f0, 0); if (f1) b.frequency.exponentialRampToValueAtTime(f1, t1); b.Q.value = q || 1; return b; };
      switch (k) {
        case 'whoosh': chain(noise(f.d), [[0, 0], [0.35, 0.9], [0.9, 0]], bp('bandpass', 300, 2500, 0.45, 1.2)); break;
        case 'swoosh': chain(noise(f.d), [[0, 0], [0.5, 0.8], [0.7, 0]], bp('bandpass', 400, 6000, 0.6, 2)); break;
        case 'boom': chain(osc('sine', 120, 30, 1.2), [[0, 1], [1.6, 0]]); chain(noise(0.5), [[0, 0.8], [0.4, 0]], bp('lowpass', 900, 120, 0.4)); break;
        case 'punch': chain(osc('sine', 160, 50, 0.2), [[0, 1], [0.3, 0]]); chain(noise(0.2), [[0, 0.7], [0.08, 0]], bp('lowpass', 3000)); break;
        case 'ding': chain(osc('sine', 1760), [[0, 0.6], [1.4, 0]]); chain(osc('sine', 2637), [[0, 0.25], [0.9, 0]]); break;
        case 'pop': chain(osc('sine', 900, 300, 0.12), [[0, 0.9], [0.2, 0]]); break;
        case 'click': chain(noise(0.05), [[0, 0.9], [0.03, 0]], bp('highpass', 2000)); break;
        case 'riser': chain(noise(f.d), [[0, 0], [2.4, 0.7], [2.5, 0]], bp('bandpass', 200, 8000, 2.4, 3)); chain(osc('sawtooth', 110, 880, 2.4), [[0, 0], [2.4, 0.2], [2.5, 0]], bp('lowpass', 2000)); break;
        case 'buzzer': chain(osc('square', 110), [[0, 0.4], [0.75, 0.4], [0.8, 0]], bp('lowpass', 1200)); chain(osc('square', 116), [[0, 0.3], [0.75, 0.3], [0.8, 0]], bp('lowpass', 1200)); break;
        case 'ching': chain(osc('triangle', 2093), [[0, 0.5], [1, 0]]); chain(osc('triangle', 3136), [[0.05, 0], [0.06, 0.4], [1, 0]]); chain(noise(0.15), [[0, 0.6], [0.12, 0]], bp('highpass', 4000)); break;
        case 'glitch': for (let i = 0; i < 6; i++) { const s = osc('square', 200 + Math.random() * 2000); const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(0.3, i * 0.09); g.gain.setValueAtTime(0, i * 0.09 + 0.05); s.connect(g); g.connect(out); s.start(0); } break;
        case 'scratch': chain(noise(f.d), [[0, 0.8], [0.6, 0]], bp('bandpass', 800, 3000, 0.25, 4)); break;
        case 'heart': [0, 0.22, 0.8, 1.02].forEach(t => { const s = osc('sine', 70, 40, t + 0.15); const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); s.connect(g); g.connect(out); s.start(0); }); break;
        case 'shutter': chain(noise(0.3), [[0, 0.9], [0.04, 0], [0.12, 0.7], [0.2, 0]], bp('bandpass', 3500, 0, 0, 0.8)); break;
        case 'drop': chain(osc('sine', 200, 35, 1.6), [[0, 1], [1.8, 0]]); chain(osc('sawtooth', 100, 30, 1.6), [[0, 0.3], [1.6, 0]], bp('lowpass', 400)); break;
        case 'ping': chain(osc('sine', 1318), [[0, 0.5], [0.25, 0]]); chain(osc('sine', 1975), [[0.12, 0], [0.13, 0.5], [0.6, 0]]); break;
      }
      const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1); let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      const kk = peak > 0 ? 0.89 / peak : 1; for (let i = 0; i < L.length; i++) { L[i] *= kk; R[i] *= kk; }
      return new File([CutAudio.wavHeader(L.length), CutAudio.wavBlock([L, R])], f.label + '.wav', { type: 'audio/wav' });
    }
    async function addSfx(k) { const f = await makeSfx(k), [m] = await importFiles([f]); if (!m) return; o.commit(); const id = placeAsset(m.id, o.player.t, null); changed(); build(); if (id) select(id); }

    /* ---------- Timeline ---------- */
    const bar = H('div', { className: 'ct-bar' }), scroll = H('div', { className: 'ct-scroll', tabIndex: -1 }), inner = H('div', { className: 'ct-inner' });
    const ruler = H('div', { className: 'ct-ruler' }), rows = H('div', { className: 'ct-rows' }), play = H('div', { className: 'ct-play' }, H('i', {})), snapLine = H('div', { className: 'ct-snapl', hidden: true }), boxEl = H('div', { className: 'ct-box', hidden: true });
    const HEAD = 168; inner.append(ruler, rows, play, snapLine, boxEl); scroll.append(inner); tl.append(bar, scroll);
    const zoomIn = H('input', { type: 'range', min: '0', max: '1000', value: '400', 'aria-label': 'Timeline zoom', title: 'Zoom the timeline (Ctrl + wheel)', on: { input: e => { setZoom(Math.exp(Math.log(4) + (Math.log(800) - Math.log(4)) * e.target.value / 1000), true); } } });
    function drawBar() {
      bar.innerHTML = ''; const s = sel(), isC = s && String(s).startsWith('C:'), f = isC ? V().findItem(cfg(), s) : null, it = f && f.it, m = it && it.asset ? CutMedia.info(it.asset) : null;
      bar.append(   // undo and redo live in the header now, for every tab
        ic('split', 'Split at the playhead (S or Ctrl+B)', () => splitNow()), ic('del', 'Delete (Delete)', () => del(false), { disabled: !s }), ic('ripple', 'Delete and close the gap (Shift+Delete)', () => del(true), { disabled: !isC }),
        ic('dup', 'Duplicate (Ctrl+D)', () => dupNow(), { disabled: !isC }),
        ic('freeze', 'Freeze frame: hold this frame for 2 seconds (F)', () => freezeNow(), { disabled: !(m && m.kind === 'video') }),
        ic('detach', 'Detach the sound onto its own track', () => detachNow(), { disabled: !(m && m.kind === 'video' && m.hasAudio !== false && !it.mute) }),
        ic('marker', 'Add a marker at the playhead (M)', () => addMarker()), ic('shot', 'Save this frame as a picture (for a thumbnail)', () => saveFrame()), H('span', { className: 'ct-sep' }),
        H('button', { type: 'button', className: 'ct-snap' + (snapIsOn() ? ' on' : ''), title: snapIsOn() ? 'Snap is on: clips on the main track butt up together and everything snaps to edges, markers and the playhead. Click to place clips anywhere, with blank screen between them.' : 'Snap is off: put clips anywhere, the space between them is blank screen. Click to snap everything back together.', 'aria-pressed': String(snapIsOn()), on: { click: () => toggleSnap() } }, H('span', { innerHTML: I.snap }), H('b', { textContent: 'Snap' }), H('i', {})),
        H('span', { className: 'ct-gap' }),
        H('span', { className: 'ct-meter', title: 'Sound level while playing' }, H('i', {})),
        ic('fit', 'Fit the whole video in view', () => { fitted = false; build(); }), zoomIn);
    }
    function setZoom(v, fromSlider) { const c = scroll.scrollLeft + scroll.clientWidth / 2 - HEAD, tc = c / pps; pps = cl(v, 4, 800); fitted = true; build(); scroll.scrollLeft = Math.max(0, tc * pps - scroll.clientWidth / 2 + HEAD); if (!fromSlider) zoomIn.value = String(Math.round((Math.log(pps) - Math.log(4)) / (Math.log(800) - Math.log(4)) * 1000)); }
    let rowList = [], dur = 1;
    function rowsOf(c) {
      const out = [], Wv = Layers.wrap(Video);
      let layerTracks = []; try { layerTracks = (Wv.editor.tracks(c, look()) || []).filter(tr => tr.layer); } catch (e) { }
      layerTracks.forEach(tr => out.push({ kind: 'layer', tr, id: tr.id, h: 28 }));
      const vids = V().tracksOf(c, 'video'); for (let i = vids.length - 1; i >= 0; i--) out.push({ kind: 'video', T: vids[i], id: vids[i].id, h: 52 });
      out.push({ kind: 'main', id: 'main', h: 66 });
      V().tracksOf(c, 'audio').forEach(T => out.push({ kind: 'audio', T, id: T.id, h: 48 }));
      return out;
    }
    function build() {
      if (!active) return; const c = cfg(), lk = look(); dur = Math.max(1, Layers.wrap(Video).duration(c, lk)); introSounds();
      const avail = Math.max(200, scroll.clientWidth - HEAD - 30); if (!fitted) { pps = cl(avail / (dur + 1), 4, 800); zoomIn.value = String(Math.round((Math.log(pps) - Math.log(4)) / (Math.log(800) - Math.log(4)) * 1000)); }
      const Wd = Math.max(avail, (dur + 8) * pps); inner.style.width = (HEAD + Wd) + 'px';
      drawBar(); drawRuler(Wd);
      rows.innerHTML = ''; rowList = rowsOf(c);
      // A drop zone above everything makes a new overlay track
      const nl = H('div', { className: 'ct-lane', style: `width:${Wd}px`, 'data-row': 'new' }); nl.addEventListener('dragover', laneDragOver); nl.addEventListener('drop', laneDrop); nl.addEventListener('dragleave', () => dropMark(null)); nl.addEventListener('pointerdown', laneDown);
      rows.append(H('div', { className: 'ct-row ct-newrow', 'data-row': 'new' }, H('div', { className: 'ct-h', textContent: 'Drop here for a new track' }), nl));
      rowList.forEach(r => { const row = H('div', { className: 'ct-row k-' + r.kind + (r.T && r.T.hide ? ' hid' : '') + (r.kind === 'main' && c.mainHide ? ' hid' : ''), style: `height:${r.h}px`, 'data-row': r.id }), lane = H('div', { className: 'ct-lane', style: `width:${Wd}px`, 'data-row': r.id });
        row.append(head(r), lane); rows.append(row); r.lane = lane; fillLane(r, lane, c, lk); });
      play.style.height = (ruler.offsetHeight + rows.offsetHeight) + 'px';
      setTime(curT, true); markSel(); paint();
    }
    function drawRuler(Wd) {
      ruler.innerHTML = ''; ruler.style.width = (HEAD + Wd) + 'px'; ruler.append(H('div', { className: 'ct-corner', textContent: tc(curT, fpsOf()) }));
      const steps = [1 / 30, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300], step = steps.find(s => s * pps >= 70) || 300, minor = step / 5, lane = H('div', { className: 'ct-rl', style: `width:${Wd}px` });
      for (let s = 0; s * pps <= Wd; s += minor) { const major = Math.abs(s / step - Math.round(s / step)) < 1e-6; lane.append(H('i', { className: major ? 'mj' : '', style: `left:${s * pps}px` })); if (major) lane.append(H('span', { style: `left:${s * pps + 3}px`, textContent: step < 1 ? tc(s, fpsOf()).slice(3) : short(s) })); }
      (cfg().markers || []).forEach((mk, i) => lane.append(H('b', { className: 'ct-mk', style: `left:${mk.t * pps}px;--c:${mk.col || '#f5c518'}`, title: (mk.label || 'Marker') + ' at ' + tc(mk.t) + '. Drag to move, double click to rename, right click to remove.', on: { pointerdown: e => markerDrag(e, i), dblclick: () => { const n = prompt('Marker name', mk.label || ''); if (n != null) { o.commit(); mk.label = n; changed(); } }, contextmenu: e => { e.preventDefault(); o.commit(); cfg().markers.splice(i, 1); changed(); } } })));
      const r = o.getRange && o.getRange(); if (r) lane.append(H('div', { className: 'ct-range', style: `left:${r[0] * pps}px;width:${Math.max(2, (r[1] - r[0]) * pps)}px`, title: 'Export range (I and O set it)' }));
      ruler.append(lane); lane.addEventListener('pointerdown', scrubStart);
    }
    const fpsOf = () => 30;
    function head(r) {
      const c = cfg(), h = H('div', { className: 'ct-h', title: '' });
      if (r.kind === 'layer') { h.append(H('span', { className: 'ct-hn', textContent: r.tr.name })); return h; }
      if (r.kind === 'main') { h.append(H('span', { className: 'ct-hn', textContent: 'Main' }), H('span', { className: 'ct-hb' },
          ic(c.mainHide ? 'eyeOff' : 'eye', c.mainHide ? 'Show the main track' : 'Hide the main track', () => { o.commit(); c.mainHide = !c.mainHide; changed(); }),
          ic(c.mainMute ? 'mute' : 'sound', c.mainMute ? 'Turn the main track sound back on' : 'Mute the main track', () => { o.commit(); c.mainMute = !c.mainMute; changed(); }),
          ic(c.mainLock ? 'lock' : 'unlock', c.mainLock ? 'Unlock' : 'Lock the main track', () => { o.commit(); c.mainLock = !c.mainLock; changed(); })));
        h.addEventListener('click', e => { if (!e.target.closest('button')) select('K:main'); }); return h; }
      const T = r.T; h.append(H('span', { className: 'ct-hn', textContent: T.name || (T.kind === 'audio' ? 'Audio' : 'Overlay'), title: 'Double click to rename', on: { dblclick: () => { const n = prompt('Track name', T.name || ''); if (n != null) { o.commit(); T.name = n; changed(); } } } }));
      const b = H('span', { className: 'ct-hb' });
      if (T.kind === 'video') b.append(ic(T.hide ? 'eyeOff' : 'eye', T.hide ? 'Show this track' : 'Hide this track', () => { o.commit(); T.hide = !T.hide; changed(); }));
      if (T.kind === 'audio') { b.append(ic(T.mute ? 'mute' : 'sound', T.mute ? 'Unmute' : 'Mute this track', () => { o.commit(); T.mute = !T.mute; changed(); }), H('button', { type: 'button', className: 'ci txt' + (T.solo ? ' on' : ''), textContent: 'S', title: 'Solo: hear only this track', 'aria-pressed': String(!!T.solo), on: { click: () => { o.commit(); T.solo = !T.solo; changed(); } } })); }
      else b.append(ic(T.mute ? 'mute' : 'sound', T.mute ? 'Unmute' : 'Mute this track\'s sound', () => { o.commit(); T.mute = !T.mute; changed(); }));
      b.append(ic(T.lock ? 'lock' : 'unlock', T.lock ? 'Unlock' : 'Lock this track', () => { o.commit(); T.lock = !T.lock; changed(); }));
      h.append(b); if (T.kind === 'audio' && (T.duck || T.talk)) h.append(H('em', { className: 'ct-tag', textContent: T.duck ? 'lowers under talking' : 'talking' }));
      h.addEventListener('click', e => { if (!e.target.closest('button')) select('K:' + T.id); });
      return h;
    }
    function fillLane(r, lane, c, lk) {
      lane.addEventListener('pointerdown', laneDown);
      lane.addEventListener('dragover', laneDragOver); lane.addEventListener('drop', laneDrop); lane.addEventListener('dragleave', () => dropMark(null));
      if (r.kind === 'layer') { r.tr.items.forEach(it => { const el = H('div', { className: 'ct-clip lay' + (it.locked ? ' locked' : ''), style: `left:${it.start * pps}px;width:${Math.max(6, (it.end - it.start) * pps)}px;--c:${it.colour || r.tr.colour || '#7a5ab8'}`, 'data-id': it.id, title: it.label, tabIndex: 0 }, H('span', { className: 'lbl', textContent: it.label }));
        if (!it.locked) el.append(H('b', { className: 'hl' }), H('b', { className: 'hr' })); (it.keys || []).forEach(k => el.append(H('i', { className: 'kf', style: `left:${(k - it.start) * pps}px` }))); el.addEventListener('pointerdown', e => clipDown(e, { layer: true, it, r })); lane.append(el); }); return; }
      const scv = H('canvas', { className: 'ct-strips' }); lane.append(scv); lane._cv = scv;
      const list = r.kind === 'main' ? V().layout(c, lk).map(x => ({ it: x.it, t0: x.t0, d: x.d, o: x })) : (r.T.items || []).map(it => ({ it, t0: +it.start || 0, d: V().lenOf(it, lk) }));
      list.forEach((p, idx) => { const el = clipEl(p, r); lane.append(el); });
      if (r.kind === 'main') { const L = V().layout(c, lk); L.slice(0, -1).forEach(x => { if (c.free && V().gapOf(c.items[x.i + 1])) return; const has = x.it.tr && x.it.tr.k && x.it.tr.k !== 'none', at = x.t0 + x.d - (has ? x.trOut / 2 : 0);
          const d = H('button', { type: 'button', className: 'ct-tr' + (has ? ' on' : ''), style: `left:${at * pps}px`, title: has ? (V().TRANS[x.it.tr.k] || 'Transition') + ', ' + x.trOut.toFixed(2) + ' s. Click to change.' : 'Add a transition here', 'aria-label': 'Transition', 'data-tr': x.it.id, on: { pointerdown: e => trDown(e, x, has, d), click: e => e.stopPropagation() } });
          if (has) { const sp = H('div', { className: 'ct-trs' + (o.ed.selected === 'T:' + x.it.id ? ' on' : ''), style: `left:${(x.t0 + x.d - x.trOut) * pps}px;width:${Math.max(4, x.trOut * pps)}px`, title: 'Drag the ends to make the transition longer or shorter' }, H('b', { className: 'hl' }), H('b', { className: 'hr' }));
            sp.addEventListener('pointerdown', e => trLenDown(e, x)); lane.append(sp); }
          d.addEventListener('dragover', e => { if (dragData && dragData.type === 'trans') { e.preventDefault(); d.classList.add('drop'); } }); d.addEventListener('dragleave', () => d.classList.remove('drop')); d.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); d.classList.remove('drop'); const dd = readDrop(e); if (dd && dd.type === 'trans') applyTrans(dd.k, x.it.id); });
          lane.append(d); }); }
    }
    // Transitions: drag the diamond to another cut to move it there (Ctrl or Alt keeps a copy where it was); click to pick it
    function trDown(e, x, has, el) {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, lane = el.parentNode; let moved = false, target = null;
      const cuts = () => { const c2 = cfg(); return V().layout(c2, look()).slice(0, -1).filter(q => !(c2.free && V().gapOf(c2.items[q.i + 1]))); };
      const mv = ev => { if (!has) return; if (!moved && Math.abs(ev.clientX - x0) < 4) return; moved = true; el.classList.add('dragging'); const t = laneT(ev.clientX);
        let best = null, bd = 1e9; cuts().forEach(q => { const d = Math.abs(q.t0 + q.d - t); if (d < bd) { bd = d; best = q; } }); target = best && bd * pps < 80 ? best : null;
        el.style.left = (t * pps) + 'px'; lane.querySelectorAll('.ct-tr').forEach(b => b.classList.toggle('drop', !!target && b.dataset.tr === target.it.id && b !== el)); };
      const up = ev => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        if (!moved) { if (!has) applyTrans('fade', x.it.id); else select('T:' + x.it.id); return; }
        if (!target || target.it === x.it) { build(); return; }
        o.commit(); const copy = ev.ctrlKey || ev.metaKey || ev.altKey; target.it.tr = { k: x.it.tr.k, d: x.it.tr.d || 0.5 }; if (!copy) delete x.it.tr;
        changed(); build(); select('T:' + target.it.id); o.say(copy ? 'Transition copied to this cut.' : 'Transition moved. Hold Ctrl while you drag to copy it instead.'); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
    // Its length: drag either end of the bar over the overlap
    function trLenDown(e, x) {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); const it = x.it, next = cfg().items[x.i + 1], mid = x.t0 + x.d - x.trOut / 2, x0 = e.clientX; let moved = false, raf = 0;
      const max = Math.max(0.1, Math.min(3, V().TRMAX(it, next, look())));
      const mv = ev => { if (!moved && Math.abs(ev.clientX - x0) < 3) return; if (!moved) { moved = true; o.commit(); }
        const dd = Math.round(cl(2 * Math.abs(laneT(ev.clientX) - mid), 0.1, max) * 20) / 20; if (dd === it.tr.d) return; it.tr.d = dd; o.changed(false); o.say('Transition ' + dd.toFixed(2) + ' s');
        cancelAnimationFrame(raf); raf = requestAnimationFrame(build); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); cancelAnimationFrame(raf); if (moved) { changed(); build(); } select('T:' + it.id); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
    function clipEl(p, r) {
      const it = p.it, m = it.asset ? CutMedia.info(it.asset) : null, kind = it.kind === 'clip' ? it.mod : it.kind === 'media' ? (m && m.kind === 'image' ? 'image' : 'media') : it.kind;
      const el = H('div', { className: 'ct-clip st k-' + it.kind + (it.mute ? ' muted' : '') + (r.T && r.T.lock || (r.kind === 'main' && cfg().mainLock) ? ' locked' : ''), style: `left:${p.t0 * pps}px;width:${Math.max(4, p.d * pps)}px;--c:${V().COLS[kind] || '#556'}`, 'data-id': 'C:' + it.id, tabIndex: 0 });
      const badges = []; if (it.speed && +it.speed !== 1) badges.push('⏩' + (+it.speed).toFixed(2).replace(/\.?0+$/, '') + 'x'); if (V().hasCurve(it)) badges.push('〰 curve'); if (it.rev) badges.push('⟲'); if (it.still != null) badges.push('❄'); if (it.col && (it.col.look || Object.keys(it.col).some(k => k !== 'look' && k !== 'lookAmt' && +it.col[k]))) badges.push('◐'); if (it.fx && it.fx.length) badges.push('✦' + it.fx.length); if (it.key && it.key.on) badges.push('⬚'); if (it.mask && it.mask.k && it.mask.k !== 'none') badges.push('◯'); if (it.kf && Object.values(it.kf).some(L => L && L.length)) badges.push('◆'); if (it.mute) badges.push('🔇'); if (it.enhance) badges.push('🎙');
      el.append(H('span', { className: 'lbl', textContent: V().NAME(it) + (badges.length ? '  ' + badges.join(' ') : '') }), H('b', { className: 'hl', title: 'Drag to trim' }), H('b', { className: 'hr', title: 'Drag to trim' }));
      if (it.fadeIn) el.append(H('i', { className: 'fdi', style: `width:${Math.min(p.d, +it.fadeIn) * pps}px` })); if (it.fadeOut) el.append(H('i', { className: 'fdo', style: `width:${Math.min(p.d, +it.fadeOut) * pps}px` }));
      if (it.kf) Object.entries(it.kf).forEach(([k, L]) => (L || []).forEach(q => el.append(H('i', { className: 'kf', style: `left:${q[0] * pps}px`, title: k + ' keyframe' }))));
      el._p = p; el._r = r; el.addEventListener('pointerdown', e => clipDown(e, { it, p, r }));
      el.addEventListener('contextmenu', e => { e.preventDefault(); select('C:' + it.id); menu(e, it, p, r); });
      el.addEventListener('dblclick', () => { if (it.kind === 'clip' && it.mod === 'intro') { select('C:' + it.id); } else if (it.kind === 'clip') o.openItem(it.id); });
      el.addEventListener('dragover', e => { if (dragData && (dragData.type === 'fx' || dragData.type === 'look')) { e.preventDefault(); e.stopPropagation(); el.classList.add('drop'); } }); el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', e => { const dd = readDrop(e); el.classList.remove('drop'); if (!dd || (dd.type !== 'fx' && dd.type !== 'look')) return; e.preventDefault(); e.stopPropagation(); const f = V().findItem(cfg(), it.id); if (dd.type === 'fx') applyFx(dd.k, f); else applyLook(dd.k, f); });
      return el;
    }
    // Filmstrips and waveforms, painted for whatever part of each clip is on screen
    let paintTimer = 0; const paintSoon = () => { cancelAnimationFrame(paintTimer); paintTimer = requestAnimationFrame(paint); };
    // One canvas per track paints every clip's body, filmstrip and waveform for the part on screen (a canvas per clip made
    // the browser composite hundreds of layers every frame: 110 ms a frame with 500 clips, 17 ms with this)
    const bodyCol = {}; function bodyOf(el) { const c = getComputedStyle(el).getPropertyValue('--c').trim() || '#556677'; if (bodyCol[c]) return bodyCol[c]; let r = 85, g = 102, b = 119; const m = /^#?([0-9a-f]{6})$/i.exec(c) || /^#?([0-9a-f]{3})$/i.exec(c); if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, x => x + x) : m[1]; r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); } return (bodyCol[c] = `rgb(${Math.round(r * 0.7)},${Math.round(g * 0.7)},${Math.round(b * 0.7)})`); }
    function paint() {
      if (!active) return; const sw = scroll.clientWidth, vl = Math.max(0, scroll.scrollLeft - HEAD - sw), vr = scroll.scrollLeft - HEAD + sw * 2, dpr = Math.min(2, window.devicePixelRatio || 1);
      rows.querySelectorAll('.ct-lane').forEach(lane => { const cv = lane._cv; if (!cv) return; const lw = lane.clientWidth, ch = lane.clientHeight, x0 = Math.max(0, Math.min(vl, lw)), x1 = Math.max(x0, Math.min(vr, lw)), cw = Math.ceil(x1 - x0); if (cw <= 0 || ch <= 0) return;
        const els = [...lane.children].filter(el => el._p && el.classList.contains('st') && !el.classList.contains('moving') && el.offsetLeft < x1 && el.offsetLeft + el.offsetWidth > x0);
        const sig = [x0, cw, ch, dpr, pps, CutMedia.thumbTick].concat(els.map(el => { const it = el._p.it, m = it.asset ? CutMedia.info(it.asset) : null; return el.offsetLeft + ',' + el.offsetWidth + ',' + el.className + ',' + JSON.stringify(it) + ',' + (m ? (m.thumbs ? 1 : 0) + (m.peaks ? 2 : 0) + (m.level || 0) : -1); })).join('|');
        if (cv._sig === sig) return; cv._sig = sig;
        cv.style.left = x0 + 'px'; cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr); if (cv.width !== pw) cv.width = pw; if (cv.height !== ph) cv.height = ph;
        const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
        els.forEach(el => { const p = el._p, it = p.it, m = it.asset ? CutMedia.info(it.asset) : null, bx = el.offsetLeft + el.clientLeft - x0, by = el.offsetTop + el.clientTop, bw = el.clientWidth, bh = el.clientHeight; if (bw <= 0 || bh <= 0) return;
          const a = Math.max(0, -bx), b = Math.min(bw, cw - bx); if (b <= a) return; const w = b - a;
          g.save(); g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, 5); else g.rect(bx, by, bw, bh); g.clip(); g.fillStyle = bodyOf(el); g.fillRect(bx + a, by, w, bh);
          if (el.classList.contains('locked') || el.classList.contains('muted')) g.filter = 'saturate(' + (el.classList.contains('locked') ? 0.5 : 0.7) + ')';
          g.translate(bx + a, by); g.globalAlpha = 0.95;
          const wave = m && m.peaks && (it.kind === 'audio' || (it.kind === 'media' && m.kind === 'video' && !it.mute && !V().hasCurve(it))), thumbs = m && m.thumbs && it.kind === 'media', thH = wave && thumbs ? Math.round(bh * 0.62) : bh;
          if (thumbs) { const tw = Math.max(20, Math.round(thH * (m.thumbs.w / m.thumbs.h))); for (let x = Math.floor(a / tw) * tw; x < b; x += tw) { const local = (x + tw / 2) / pps, sT = m.kind === 'image' ? 0 : V().srcTime(it, Math.min(p.d, local)), bm = CutMedia.thumb(it.asset, sT); if (bm) g.drawImage(bm, x - a, 0, tw, thH); } }
          if (wave) { const y0 = thumbs ? thH : 0, hh = bh - y0, mid = y0 + hh / 2, span = V().speedOf(it) / pps; g.fillStyle = it.kind === 'audio' ? 'rgba(160,255,200,0.9)' : 'rgba(150,230,255,0.85)';
            for (let x = 0; x < w; x++) { const local = (a + x) / pps, sT = V().srcTime(it, local); let v = 0; for (let k = 0; k < 3; k++) v = Math.max(v, CutMedia.peakAt(it.asset, sT + span * k / 3)); const gn = Math.min(1.6, Math.sqrt(CutAudio.clipGain({ it, d: p.d, trackDb: 0 }, local))); const hv = v * gn * hh * 0.48; g.fillRect(x, mid - hv, 1, Math.max(1, hv * 2)); } }
          if (it.kind === 'clip' && !thumbs) { g.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = -(a % 16); x < w; x += 16) g.fillRect(x, 0, 8, bh); }
          g.restore(); });
      });
    }
    CutMedia.onChange(() => { if (active) { paintSoon(); if (libTab === 'media' || libTab === 'audio') drawLibSoon(); } });
    scroll.addEventListener('scroll', paintSoon);
    scroll.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const r = scroll.getBoundingClientRect(), x = e.clientX - r.left + scroll.scrollLeft - HEAD, tAt = x / pps; pps = cl(pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 4, 800); fitted = true; build(); scroll.scrollLeft = Math.max(0, tAt * pps - (e.clientX - r.left) + HEAD); zoomIn.value = String(Math.round((Math.log(pps) - Math.log(4)) / (Math.log(800) - Math.log(4)) * 1000)); } else if (e.shiftKey) { e.preventDefault(); scroll.scrollLeft += e.deltaY; } }, { passive: false });
    const laneT = clientX => { const r = rows.getBoundingClientRect(); return Math.max(0, (clientX - r.left - HEAD) / pps); };
    const rowAt = clientY => { const els = [...rows.children]; for (const el of els) { const r = el.getBoundingClientRect(); if (clientY >= r.top && clientY < r.bottom) { const id = el.dataset.row; return id === 'new' ? { kind: 'new' } : rowList.find(x => x.id === id) || null; } } const first = els[0]; if (first && clientY < first.getBoundingClientRect().top) return { kind: 'new' }; return null; };
    function setTime(t, quiet) { curT = t; play.style.left = '0px'; play.style.transform = 'translateX(' + (HEAD + t * pps) + 'px)'; const cn = ruler.querySelector('.ct-corner'), tx = tc(t, fpsOf()); if (cn && cn.textContent !== tx) cn.textContent = tx;
      if (!quiet && o.player.playing && !drag) { const x = HEAD + t * pps, l = scroll.scrollLeft, w = scroll.clientWidth; if (x > l + w - 60 || x < l + HEAD) scroll.scrollLeft = Math.max(0, x - HEAD - 60); } }
    function markSel() { const s = sel(); rows.querySelectorAll('.ct-clip').forEach(el => el.classList.toggle('on', el.dataset.id === s || multi.has(el.dataset.id))); rows.querySelectorAll('.ct-tr').forEach(el => el.classList.toggle('sel', 'T:' + el.dataset.tr === s)); drawBar(); }
    let multi = new Set();
    // Snapping: clip edges on every track, markers, the playhead and the start
    function snapPoints(exceptIds) { const pts = [0, curT]; V().allPlaced(cfg(), look()).forEach(p => { if (exceptIds && exceptIds.has(p.it.id)) return; pts.push(p.t0, p.t0 + p.d); }); (cfg().markers || []).forEach(m => pts.push(m.t)); rowList.filter(r => r.kind === 'layer').forEach(r => r.tr.items.forEach(i => { if (!(exceptIds && exceptIds.has(i.id))) pts.push(i.start, i.end); })); return pts; }
    // Snap: on, the main track is magnetic and drags snap to edges (Alt held while dragging skips it); off, clips go anywhere
    const snapIsOn = () => !cfg().free;
    function toggleSnap() { o.commit(); const c = cfg(); if (c.free) { delete c.free; V().closeGaps(c); o.say('Snap on: the clips on the main track are back together.'); } else { c.free = true; o.say('Snap off: drag clips anywhere. The space between them is blank screen.'); } changed(); build(); }
    function snapT(v, pts, show) { if (!snapIsOn() || altKey) { snapLine.hidden = true; return v; } const tol = 9 / pps; let best = v, bd = tol, hit = null; pts.forEach(p => { const d = Math.abs(p - v); if (d < bd) { bd = d; best = p; hit = p; } }); if (show !== false) { if (hit != null) { snapLine.hidden = false; snapLine.style.left = (HEAD + hit * pps) + 'px'; snapLine.style.height = (ruler.offsetHeight + rows.offsetHeight) + 'px'; } else snapLine.hidden = true; } return best; }
    function scrubStart(e) { if (e.button > 0) return; e.preventDefault(); o.player.pause(); o.player.scrub(true); const go = ev => { let t = laneT(ev.clientX); if (!ev.altKey) t = snapT(t, snapPoints(), false); t = Math.min(t, dur); o.player.seek(t); setTime(t, true); }; go(e);
      const mv = ev => go(ev), up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); o.player.scrub(false); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }
    play.addEventListener('pointerdown', scrubStart);
    function markerDrag(e, i) { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); const mk = cfg().markers[i], x0 = e.clientX, t0 = mk.t; let moved = false; o.commit();
      const mv = ev => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; mk.t = r3(Math.max(0, t0 + (ev.clientX - x0) / pps)); e.target.style.left = mk.t * pps + 'px'; }, up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) changed(); else { o.player.seek(mk.t); setTime(mk.t, true); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }
    // Empty lane: click to move the playhead (and clear the selection), drag to box select
    function laneDown(e) { if (e.target.closest('.ct-clip') || e.target.closest('.ct-tr') || e.button > 0) return; e.preventDefault(); o.player.pause(); const r0 = inner.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; let moved = false;
      const mv = ev => { if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; moved = true; const bx = Math.min(ev.clientX, x0) - r0.left, by = Math.min(ev.clientY, y0) - r0.top, bw = Math.abs(ev.clientX - x0), bh = Math.abs(ev.clientY - y0); Object.assign(boxEl.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' }); boxEl.hidden = false;
        multi = new Set([...rows.querySelectorAll('.ct-clip')].filter(c => { const cr = c.getBoundingClientRect(); return cr.left < Math.max(ev.clientX, x0) && cr.right > Math.min(ev.clientX, x0) && cr.top < Math.max(ev.clientY, y0) && cr.bottom > Math.min(ev.clientY, y0); }).map(c => c.dataset.id)); markSel(); };
      const up = ev => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); boxEl.hidden = true; if (!moved) { multi.clear(); select(null); const t = Math.min(dur, laneT(ev.clientX)); o.player.seek(t); setTime(t, true); } else { const first = [...multi][0] || null; o.ed.select(first); markSel(); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }

    /* Dragging clips: move (in time, between tracks, in and out of the main track) and trim */
    function clipDown(e, ctx) {
      if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); o.player.pause();
      const id = ctx.layer ? ctx.it.id : 'C:' + ctx.it.id;
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (sel()) multi.add(sel()); if (multi.has(id)) multi.delete(id); else multi.add(id); o.ed.select(id); markSel(); return; }
      if (!multi.has(id)) { multi.clear(); select(id); } else o.ed.select(id);
      const locked = ctx.layer ? ctx.it.locked : (ctx.r.T && ctx.r.T.lock) || (ctx.r.kind === 'main' && cfg().mainLock);
      const h = e.target.classList.contains('hl') ? 'l' : e.target.classList.contains('hr') ? 'r' : 'm'; if (locked) { const t = laneT(e.clientX); o.player.seek(t); setTime(t, true); return; }
      const el = e.currentTarget, x0 = e.clientX, y0 = e.clientY, c = cfg(), lk = look(), tAt = laneT(e.clientX);
      const snap = JSON.stringify(ctx.layer ? null : ctx.it), others = new Set([ctx.it.id]), pts = snapPoints(others);
      drag = { el, h, moved: false, committed: false };
      const begin = () => { if (!drag.committed) { o.commit(); drag.committed = true; } };
      const mv = ev => {
        altKey = ev.altKey; const dx = ev.clientX - x0; if (!drag.moved && Math.abs(dx) < 4 && Math.abs(ev.clientY - y0) < 6) return; if (!drag.moved) { drag.moved = true; begin(); el.classList.add('dragging'); if (h === 'm') el.classList.add('moving'); paintSoon(); }
        if (ctx.layer) return layerDrag(ev, ctx, h, dx, pts);
        if (h === 'm') return moveDrag(ev, ctx, el, tAt, pts, c, lk);
        const r = trimDrag(ev, ctx, h, dx, pts, c, lk, JSON.parse(snap)); paintSoon(); return r;
      };
      const up = ev => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); snapLine.hidden = true; dropMark(null); const d = drag; drag = null; el.classList.remove('dragging', 'moving');
        if (d && d.moved) { if (d.finish) d.finish(ev); changed(); build(); } else { const t = laneT(ev.clientX); o.player.seek(Math.min(t, dur)); setTime(t, true); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
    function layerDrag(ev, ctx, h, dx, pts) { const it = ctx.it, Wv = Layers.wrap(Video), dt = dx / pps; let s = it.start, e2 = it.end;
      if (h === 'm') { s = Math.max(0, it.start + dt); const ss = snapT(s, pts), se = snapT(s + (it.end - it.start), pts); if (ss !== s) s = ss; else if (se !== s + it.end - it.start) s = se - (it.end - it.start); e2 = s + (it.end - it.start); }
      else if (h === 'l') { s = Math.min(it.end - 0.1, Math.max(0, snapT(it.start + dt, pts))); } else e2 = Math.max(it.start + 0.1, snapT(it.end + dt, pts));
      Wv.editor.update(cfg(), it.id, { start: r2(s), end: r2(e2), track: null }); drag.el.style.left = s * pps + 'px'; drag.el.style.width = Math.max(6, (e2 - s) * pps) + 'px'; o.changed(false); }
    function moveDrag(ev, ctx, el, tAt, pts, c, lk) {
      const it = ctx.it, p = ctx.p, grab = tAt - p.t0, row = rowAt(ev.clientY), t = Math.max(0, laneT(ev.clientX) - grab);
      const toMain = (row && row.kind === 'main') || it.kind === 'avatar', isAudio = it.kind === 'audio';   // studio parts only live on the main track
      if (isAudio || (!toMain && ((row && (row.kind === 'video' || row.kind === 'new')) || ctx.r.kind !== 'main'))) {
        // Free placement on an overlay or audio track
        let s = snapT(t, pts); const se = snapT(t + p.d, pts); if (s === t && se !== t + p.d) s = se - p.d; s = Math.max(0, s);
        let target = row; if (isAudio) target = row && row.kind === 'audio' ? row : row && row.kind === 'new' ? { kind: 'newaudio' } : rowList.find(r => r.T && r.T.items.includes(it)) || null;
        else if (!target || (target.kind !== 'video' && target.kind !== 'new')) target = ctx.r.kind === 'video' ? ctx.r : { kind: 'new' };
        el.style.left = s * pps + 'px'; dropMark(target, s, p.d);
        drag.finish = () => { const f = V().findItem(cfg(), it.id); if (!f) return; f.list.splice(f.i, 1); it.start = r3(s);
          if (target && target.kind === 'new') { const T = { id: V().nid('t'), kind: 'video', name: 'Overlay ' + (V().tracksOf(cfg(), 'video').length + 1), items: [it] }; cfg().tracks = cfg().tracks || []; cfg().tracks.push(T); }
          else if (target && target.kind === 'newaudio') { const T = { id: V().nid('t'), kind: 'audio', name: 'Audio ' + (V().tracksOf(cfg(), 'audio').length + 1), items: [it] }; cfg().tracks.push(T); }
          else { const T = target && target.T; if (T && !overlaps(T, it, s)) { T.items.push(it); T.items.sort((a, b) => a.start - b.start); } else V().placeFree(cfg(), isAudio ? 'audio' : 'video', it, T); }
          V().pruneTracks(cfg()); };
      } else if (cfg().free) {
        // Snap off: the clip lands where it is dropped; anything it would overlap moves along after it
        let s = snapT(t, pts); const se = snapT(t + p.d, pts); if (s === t && se !== t + p.d) s = se - p.d; s = Math.max(0, s);
        el.style.left = s * pps + 'px'; dropMark(rowList.find(r => r.kind === 'main'), s, p.d);
        drag.finish = () => { const c2 = cfg(), f = V().findItem(c2, it.id); if (!f) return; const pairs = V().mainStarts(c2, lk).filter(q => q.it !== it); if (f.track !== 'main') f.list.splice(f.i, 1); delete it.start; delete it.gap;
          pairs.push({ it, start: r3(s), k: -1 }); V().setMainStarts(c2, lk, pairs); V().pruneTracks(c2); };
      } else {
        // Into (or along) the main track: it goes in at the nearest cut
        const L = V().layout(c, lk).filter(x => x.it !== it); let i = L.findIndex(x => laneT(ev.clientX) < x.t0 + x.d / 2); if (i < 0) i = L.length;
        const at = i < L.length ? L[i].t0 : (L.length ? L[L.length - 1].t0 + L[L.length - 1].d : 0); el.style.left = (laneT(ev.clientX) - grab) * pps + 'px'; dropMark(rowList.find(r => r.kind === 'main'), at, 0.001, true);
        drag.finish = () => { const f = V().findItem(cfg(), it.id); if (!f) return; f.list.splice(f.i, 1); delete it.start; const items = cfg().items, j = i < L.length ? items.indexOf(L[i].it) : items.length; items.splice(j < 0 ? items.length : j, 0, it); V().pruneTracks(cfg()); };
      }
    }
    const overlaps = (T, it, s) => { const e = s + V().lenOf(it, look()); return (T.items || []).some(x => x !== it && (+x.start || 0) < e - 1e-3 && (+x.start || 0) + V().lenOf(x, look()) > s + 1e-3); };
    // Trimming: footage and sound trim within their file; pictures, cards and gaps change length; tab clips move their in and out points
    function trimDrag(ev, ctx, h, dx, pts, c, lk, orig) {
      const it = ctx.it, p = ctx.p, free = ctx.r.kind !== 'main', m = it.asset ? CutMedia.info(it.asset) : null, sp = V().speedOf(it);
      let dt = dx / pps; const left = h === 'l';
      if (left) { const want = snapT(p.t0 + dt, pts); dt = want - p.t0; } else { const want = snapT(p.t0 + p.d + dt, pts); dt = want - (p.t0 + p.d); }
      const isFile = (it.kind === 'media' || it.kind === 'audio') && m && m.kind !== 'image' && it.still == null;
      if (isFile) { const full = m.dur || 0;
        if (left) { if (it.rev) { it.src1 = r3(cl(orig.src1 == null ? full : +orig.src1 - dt * sp, (+orig.src0 || 0) + 0.05, full)); } else { const ns = cl((+orig.src0 || 0) + dt * sp, 0, (orig.src1 == null ? full : +orig.src1) - 0.05); it.src0 = r3(ns); dt = (ns - (+orig.src0 || 0)) / sp; } if (free) it.start = r3(Math.max(0, (+orig.start || 0) + dt)); }
        else { if (it.rev) { it.src0 = r3(cl((+orig.src0 || 0) - dt * sp, 0, (orig.src1 == null ? full : +orig.src1) - 0.05)); } else it.src1 = r3(cl((orig.src1 == null ? full : +orig.src1) + dt * sp, (+orig.src0 || 0) + 0.05, full)); } }
      else if (it.kind === 'clip') { const [a0, e0, d0] = V().clipSpan(orig, lk);
        if (left) { it.inPt = r3(cl(a0 + dt * sp, 0, e0 - 0.2)); if (free) it.start = r3(Math.max(0, (+orig.start || 0) + (it.inPt - a0) / sp)); }
        else { const want = (p.d + dt), natural = (e0 - a0) / sp; if (want <= natural + 1e-3 || V().runsOn(it)) { it.outPt = r3(cl(a0 + want * sp, a0 + 0.2, d0)); it.hold = 0; } else { it.outPt = orig.outPt; if (orig.outPt == null) delete it.outPt; it.hold = r2(cl(want - natural, 0, 600)); } } }
      else { const d0 = +orig.dur || p.d; if (left) { const nd = cl(d0 - dt, 0.1, 3600); it.dur = r3(nd); if (free) it.start = r3(Math.max(0, (+orig.start || 0) + (d0 - nd))); } else it.dur = r3(cl(d0 + dt, 0.1, 3600)); }
      if (!free && cfg().free) { if (!drag.starts) drag.starts = V().mainStarts(Object.assign({}, cfg(), { items: cfg().items.map(x => x === it ? orig : x) }), lk).map(q => ({ it: q.it === orig ? it : q.it, start: q.start, k: q.k }));
        const me = drag.starts.find(q => q.it === it), origLen = V().lenOf(orig, lk), nl = V().lenOf(it, lk); V().setMainStarts(cfg(), lk, drag.starts.map(q => q.it === it ? { it, start: left ? Math.max(0, me.start + origLen - nl) : me.start, k: q.k } : q)); }
      o.changed(false); const np = V().allPlaced(cfg(), lk).find(q => q.it === it); if (np) { drag.el.style.left = np.t0 * pps + 'px'; drag.el.style.width = Math.max(4, np.d * pps) + 'px'; drag.el._p = np; }
      const seekT = np ? (left ? np.t0 + 0.01 : np.t0 + np.d - 0.02) : curT; o.player.seek(seekT); setTime(seekT, true);
    }
    // Shows where a dragged clip will land
    const ghost = H('div', { className: 'ct-ghost', hidden: true });
    function dropMark(row, t, d, line) { if (!row || !row.lane && row.kind !== 'new' && row.kind !== 'newaudio') { ghost.hidden = true; return; } let lane = row.lane; if (!lane) lane = rows.querySelector(row.kind === 'newaudio' ? '.ct-row:last-child .ct-lane' : '.ct-newrow .ct-lane'); if (!lane) { ghost.hidden = true; return; }
      if (ghost.parentNode !== lane) lane.append(ghost); ghost.hidden = false; ghost.classList.toggle('line', !!line); ghost.style.left = t * pps + 'px'; ghost.style.width = line ? '3px' : Math.max(4, d * pps) + 'px'; }
    // Things dropped from the library or from the computer
    const readDrop = e => { try { return JSON.parse(e.dataTransfer.getData('application/x-cut')); } catch (er) { return dragData; } };
    function laneDragOver(e) { const files = e.dataTransfer && [...(e.dataTransfer.items || [])].some(i => i.kind === 'file'); if (!dragData && !files) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const row = rowAt(e.clientY), t = laneT(e.clientX);
      if (dragData && (dragData.type === 'fx' || dragData.type === 'look' || dragData.type === 'trans')) return; const d = dragData && dragData.type === 'asset' ? (V().lenOf(itemFor(dragData.id) || {}, look()) || 3) : dragData && dragData.type === 'snd' ? (+dragData.dur || 3) : 3; dropMark(row && row.kind ? row : null, t, d, row && row.kind === 'main'); }
    function laneDrop(e) { e.preventDefault(); dropMark(null); const row = rowAt(e.clientY), t = laneT(e.clientX), dd = readDrop(e), files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
      if (files.length && !dd) { importFiles(files, { t, row }); return; } if (!dd) return; o.commit();
      if (dd.type === 'asset') { const id = placeAsset(dd.id, t, row && row.kind === 'new' ? { kind: 'video', T: null } : row); changed(); build(); if (id) select(id); }
      else if (dd.type === 'snd') addSnd(dd.path, t, row);
      else if (dd.type === 'patter') addPatter(dd.k, row && row.kind === 'new' ? { kind: 'video' } : row, t);
      else if (dd.type === 'block') addBlock(dd.k, row && row.kind === 'new' ? { kind: 'video' } : row, t);
      else if (dd.type === 'intro') addIntro(t);
      else if (dd.type === 'trans') applyTrans(dd.k);
      else if (dd.type === 'fx' || dd.type === 'look') { o.player.seek(t); dd.type === 'fx' ? applyFx(dd.k) : applyLook(dd.k); } }
    // The whole window takes dropped files when the Video tab is open
    document.addEventListener('dragover', e => { if (!active || e.target.closest && e.target.closest('.ct-lane')) return; if ([...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); lib.classList.add('dropping'); } });
    document.addEventListener('dragleave', e => { if (e.target === document.documentElement || !e.relatedTarget) lib.classList.remove('dropping'); });
    document.addEventListener('drop', e => { lib.classList.remove('dropping'); if (!active || (e.target.closest && e.target.closest('.ct-lane'))) return; const f = [...(e.dataTransfer.files || [])]; if (!f.length) return; e.preventDefault(); importFiles(f, e.target.closest && e.target.closest('#prevWrap') ? { t: o.player.t, row: null } : null); });

    /* ---------- Editing commands ---------- */
    function splitNow() { const c = cfg(), lk = look(), t = o.player.t, s = sel(); o.commit(); let did = [];
      const ids = s && String(s).startsWith('C:') ? [s] : V().allPlaced(c, lk).filter(p => t > p.t0 + 0.05 && t < p.t0 + p.d - 0.05 && !(p.T && p.T.lock) && !(p.track === 'main' && c.mainLock)).map(p => 'C:' + p.it.id);
      ids.forEach(id => { const r = V().split(c, id, t, lk); if (r) did.push(r); });
      if (s && String(s).startsWith('L:')) { const Wv = Layers.wrap(Video), tr = (Wv.editor.tracks(c, lk) || []).flatMap(x => x.items).find(i => i.id === s); if (tr && t > tr.start + 0.05 && t < tr.end - 0.05) { const dupId = Wv.editor.duplicate(c, s); Wv.editor.update(c, s, { start: tr.start, end: r2(t), track: null }); Wv.editor.update(c, dupId, { start: r2(t), end: tr.end, track: null }); did.push(dupId); } }
      if (!did.length) { o.say('Nothing to split at the playhead. Put the playhead over a clip.'); return; } changed(); build(); select(did[did.length - 1]); }
    function del(ripple) { const s = sel(); if (!s) return; const ids = multi.size > 1 ? [...multi] : [s]; o.commit(); const c = cfg(), lk = look();
      ids.forEach(id => { if (String(id).startsWith('T:')) { const f = V().findItem(c, id.slice(2)); if (f) delete f.it.tr; return; } if (String(id).startsWith('K:')) { const tid = id.slice(2); if (tid !== 'main') { c.tracks = (c.tracks || []).filter(T => T.id !== tid); } return; }
        if (String(id).startsWith('L:')) { Layers.wrap(Video).editor.remove(c, id); return; }
        const f = V().findItem(c, id); if (!f) return; const p = V().allPlaced(c, lk).find(q => q.it === f.it), len = p ? p.d : 0, at = p ? p.t0 : 0;
        if (f.track === 'main' && c.free && !ripple) { V().setMainStarts(c, lk, V().mainStarts(c, lk).filter(q => q.it !== f.it)); return; }
        if (f.track === 'main' && ripple) { const nx = c.items[f.i + 1]; if (nx && f.it.gap && !nx.gap) nx.gap = f.it.gap; }
        f.list.splice(f.i, 1);
        // Ripple on an overlay or audio track: later clips on that track slide back
        if (ripple && f.track !== 'main' && f.T) f.T.items.forEach(x => { if ((+x.start || 0) > at) x.start = r3(Math.max(at, (+x.start || 0) - len)); }); });
      V().pruneTracks(c); multi.clear(); o.ed.select(null); changed(); build(); }
    function dupNow() { const s = sel(); if (!s) return; o.commit(); const id = Layers.wrap(Video).editor.duplicate(cfg(), s); changed(); build(); if (id) select(id); }
    async function freezeNow() { const f = selItem(); if (!f || f.it.kind !== 'media') return; const m = CutMedia.info(f.it.asset); if (!m || m.kind !== 'video') return; const c = cfg(), lk = look(), p = V().allPlaced(c, lk).find(q => q.it === f.it); if (!p) return;
      const t = cl(o.player.t, p.t0, p.t0 + p.d - 0.01), src = V().srcTime(f.it, t - p.t0); o.commit();
      const right = V().split(c, 'C:' + f.it.id, t, lk); const still = JSON.parse(JSON.stringify(f.it)); still.id = V().nid('c'); still.still = r3(src); still.dur = 2; delete still.tr; delete still.anOut; delete still.fadeOut; still.mute = true;
      const g = V().findItem(c, f.it.id); if (g.track === 'main') g.list.splice(g.i + 1, 0, still); else { still.start = r3(t); const rr = right && V().findItem(c, right); if (rr && rr.T) rr.T.items.forEach(x => { if (x !== still && (+x.start || 0) >= t - 1e-3) x.start = r3((+x.start || 0) + 2); }); g.list.splice(g.i + 1, 0, still); }
      changed(); build(); select('C:' + still.id); o.say('Frame frozen for 2 seconds. Drag its end to make it longer.'); }
    function detachNow() { const f = selItem(); if (!f || f.it.kind !== 'media') return; const m = CutMedia.info(f.it.asset); if (!m || m.kind !== 'video') return; const c = cfg(), lk = look(), p = V().allPlaced(c, lk).find(q => q.it === f.it); if (!p) return; o.commit();
      const a = { id: V().nid('c'), kind: 'audio', asset: f.it.asset, start: r3(p.t0), src0: f.it.src0, src1: f.it.src1, speed: f.it.speed, pitch: f.it.pitch, vol: f.it.vol, fadeIn: f.it.fadeIn, fadeOut: f.it.fadeOut, enhance: f.it.enhance, denoise: f.it.denoise, name: (m.name || 'Sound') + ' (sound)' };
      Object.keys(a).forEach(k => a[k] === undefined && delete a[k]); f.it.mute = true; const T = V().placeFree(c, 'audio', a, null); if (f.track === 'main' && c.mainTalk !== false) T.talk = true; changed(); build(); select('C:' + a.id); o.say('The sound is on its own track now. The clip itself is muted.'); }
    async function saveFrame() { const t = o.player.t; o.say('Saving the frame at ' + tc(t) + '…'); try { const lk = look(), b = await CutExport.still(JSON.parse(JSON.stringify(cfg())), lk, t, lk.format === '9:16' ? '1080' : '1080'); const ok = await E.saveBlob(b, (o.fileBase() || 'frame') + '-' + tc(t).replace(/:/g, '-') + '.png', [{ description: 'PNG picture', accept: { 'image/png': ['.png'] } }]); o.say(ok ? 'Frame saved as a PNG at full quality.' : 'Save cancelled.'); } catch (e) { o.say(e.message || String(e), true); } }
    // Swap a clip's file for another, keeping everything done to it
    const replIn = H('input', { type: 'file', hidden: true, accept: 'video/*,audio/*,image/*,.mov,.mkv,.m4a', on: { change: async e => { const f = e.target.files[0]; e.target.value = ''; if (f && replWant) await replace(replWant, f); } } }); lib.append(replIn);
    let replWant = null; function replacePick(id) { replWant = id; replIn.click(); }
    async function replace(id, file) { const [m] = await importFiles([file]); if (!m) return; const f = V().findItem(cfg(), id); if (!f) return; const it = f.it, old = it.asset ? CutMedia.info(it.asset) : null;
      if ((it.kind === 'audio') !== (m.kind === 'audio')) { o.say(it.kind === 'audio' ? 'Pick a sound file to replace a sound clip.' : 'Pick a video or picture to replace this clip.', true); return; }
      o.commit(); const len = V().lenOf(it, look()); it.asset = m.id; it.file = m.name;
      if (m.kind === 'image') { delete it.src0; delete it.src1; it.dur = r3(len); } else { const s0 = Math.min(+it.src0 || 0, Math.max(0, (m.dur || 0) - 0.1)); it.src0 = r3(s0); it.src1 = r3(Math.min(m.dur || 0, s0 + len * V().speedOf(it))); delete it.dur; }
      changed(); build(); o.say('Replaced with "' + m.name + '". Its edits, grade and animation are kept.'); }
    function addMarker() { o.commit(); const c = cfg(); c.markers = c.markers || []; const t = r3(o.player.t); if (!c.markers.some(m => Math.abs(m.t - t) < 0.02)) c.markers.push({ t, label: '', col: '#f5c518' }); c.markers.sort((a, b) => a.t - b.t); changed(); build(); }
    // Cut points (for jumping), every clip edge and marker
    const cuts = () => [...new Set(snapPoints().concat([dur]).map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
    function jump(dir) { const t = o.player.t, cs = cuts(), n = dir > 0 ? cs.find(v => v > t + 0.005) : [...cs].reverse().find(v => v < t - 0.005); if (n == null) return; o.player.pause(); o.player.seek(Math.min(n, dur)); setTime(n); }
    // Q and W: trim the selected (or main track) clip's start or end to the playhead
    function trimTo(side) { const c = cfg(), lk = look(), t = o.player.t, s = sel(); let p = s && String(s).startsWith('C:') ? V().allPlaced(c, lk).find(q => 'C:' + q.it.id === s) : null; if (!p || t <= p.t0 || t >= p.t0 + p.d) p = V().allPlaced(c, lk).find(q => q.track === 'main' && t > q.t0 && t < q.t0 + q.d); if (!p) return; o.commit();
      const r = V().split(c, 'C:' + p.it.id, t, lk); if (!r) return; if (side === 'start') { const f = V().findItem(c, p.it.id); f.list.splice(f.i, 1); if (f.track !== 'main') { const g = V().findItem(c, r); if (g && g.T) g.it.start = r3(p.t0); } select(r); } else { const g = V().findItem(c, r); g.list.splice(g.i, 1); select('C:' + p.it.id); } V().pruneTracks(c); changed(); build(); }
    function copySel() { const s = sel(); if (!s || !String(s).startsWith('C:')) return false; const f = V().findItem(cfg(), s); if (!f) return false; clipboard = { it: JSON.parse(JSON.stringify(f.it)), main: f.track === 'main', kind: f.T ? f.T.kind : 'main' }; o.say('Clip copied. Ctrl+V pastes it at the playhead.'); return true; }
    function paste() { if (!clipboard) return false; o.commit(); const c = cfg(), it = JSON.parse(JSON.stringify(clipboard.it)); it.id = V().nid('c'); const t = o.player.t;
      if (clipboard.main) insertMain(c, it, t); else { it.start = r3(t); V().placeFree(c, clipboard.kind, it, null); } changed(); build(); select('C:' + it.id); return true; }
    function menu(e, it, p, r) {
      const items = [['Split at the playhead', () => splitNow()], ['Duplicate', () => dupNow()], ['Copy', () => copySel()], ['Paste at the playhead', () => paste()], ['Delete', () => del(false)], ['Delete and close the gap', () => del(true)]];
      const m = it.asset ? CutMedia.info(it.asset) : null; if (m && m.kind === 'video') { items.push(['Freeze this frame', () => freezeNow()]); if (!it.mute) items.push(['Detach the sound', () => detachNow()]); }
      if (it.kind === 'clip' && it.mod === 'intro') items.push(['Change the intro (episode, pub)', () => { select('C:' + it.id); }]); else if (it.kind === 'clip') items.push(['Edit in the ' + (V().NAMES[it.mod] || '') + ' tab', () => o.openItem(it.id)]);
      if (it.kind !== 'audio' && it.kind !== 'avatar') items.push(['Reset size and position', () => { o.commit(); ['x', 'y', 's', 'rot', 'crop', 'flipH', 'flipV'].forEach(k => delete it[k]); if (it.kf) ['x', 'y', 's', 'rot'].forEach(k => delete it.kf[k]); changed(); }]);
      items.push([it.mute ? 'Unmute' : 'Mute', () => { o.commit(); it.mute = !it.mute; changed(); }]);
      const pop = H('div', { className: 'ct-menu', role: 'menu' }); items.forEach(([l, fn]) => pop.append(H('button', { type: 'button', role: 'menuitem', textContent: l, on: { click: () => { pop.remove(); fn(); } } })));
      document.body.append(pop); pop.style.left = Math.min(e.clientX, innerWidth - pop.offsetWidth - 8) + 'px'; pop.style.top = Math.min(e.clientY, innerHeight - pop.offsetHeight - 8) + 'px';
      setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
    }

    /* ---------- Keyboard (Video tab) ---------- */
    function key(e) {
      if (!active) return false; const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && k === 'b') { splitNow(); return true; }
      if (ctrl && k === 'c') return copySel(); if (ctrl && k === 'v') return paste();
      if (ctrl && k === 'a') { multi = new Set([...rows.querySelectorAll('.ct-clip')].map(c => c.dataset.id)); markSel(); return true; }
      if (ctrl || e.altKey) return false;
      if (k === 's') { splitNow(); return true; } if (k === 'm') { addMarker(); return true; } if (k === 'f') { freezeNow(); return true; }
      if (k === 'q') { trimTo('start'); return true; } if (k === 'w') { trimTo('end'); return true; }
      if (e.key === 'ArrowUp') { jump(-1); return true; } if (e.key === 'ArrowDown') { jump(1); return true; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel()) { del(e.shiftKey); return true; }
      if (k === '=' || k === '+') { setZoom(pps * 1.3); return true; } if (k === '-' || k === '_') { setZoom(pps / 1.3); return true; }
      if (k === 'escape') { multi.clear(); return false; }
      return false;
    }

    /* ---------- Turning the workspace on and off ---------- */
    let placed = false;
    function activate(on) {
      active = !!on; document.body.classList.toggle('cut', active);
      if (active) introSounds();
      if (active && typeof PatterIntro !== 'undefined' && (cfg().items || []).some(it => it && it.kind === 'intro') && !CutMedia.info(PatterIntro.SOUND_ID)) PatterIntro.ensureSound().then(() => { build(); }).catch(() => { });
      if (active && !placed) { const main = document.querySelector('main'); main.prepend(lib); main.append(tl); placed = true;
        // Drag the top edge of the timeline to make it taller or shorter (remembered on this computer)
        const rz = H('div', { className: 'ct-resize', title: 'Drag to make the timeline taller or shorter' }); tl.append(rz);
        try { const hh = +localStorage.getItem('patter-tlh'); if (hh > 120) main.style.setProperty('--tlh', hh + 'px'); } catch (e) { }
        rz.addEventListener('pointerdown', e => { e.preventDefault(); const y0 = e.clientY, h0 = tl.getBoundingClientRect().height; const mv = ev => { const h = cl(h0 - (ev.clientY - y0), 140, innerHeight * 0.75); main.style.setProperty('--tlh', Math.round(h) + 'px'); }; const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); try { localStorage.setItem('patter-tlh', String(parseInt(main.style.getPropertyValue('--tlh')))); } catch (er) { } build(); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }); }
      lib.hidden = !active; tl.hidden = !active; if (active) { drawLibTabs(); drawLib(); requestAnimationFrame(build); CutMedia.loadAll().then(() => { if (active) { drawLib(); build(); } }); } else { CutAudio.stopAll(); if (typeof CutMedia !== 'undefined') CutMedia.pauseAll(); }
    }
    // The level meter and the audio, every frame while playing
    function frame(t, playing) { if (!active) return; setTime(t); try { CutAudio.sync(cfg(), look(), t, playing); } catch (e) { console.warn(e); } const mt = bar.querySelector('.ct-meter i'); if (mt) { const v = CutAudio.meter(); mt.style.width = Math.round(Math.min(1, v) * 100) + '%'; mt.classList.toggle('hot', v > 0.95); } }
    new ResizeObserver(() => { if (active && !fitted) build(); }).observe(tl);

    return { replacePick, saveFrame, relinkPick, missingAssets, activate, build, setTime, frame, key, importFiles, drawLib, markSel, get active() { return active; }, splitNow, del, addMarker, freezeNow, detachNow, jump, applyTrans, applyFx, applyLook, addPatter, addBlock, placeAsset, makeSfx, paste, copySel, trimTo, I, ic, tc, short, inspTab, lookThumb, get pps() { return pps; } };
  }
  return { create, tc, short };
})();

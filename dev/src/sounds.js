/* His sound library: a folder on his computer (say Desktop\Patter Sounds, with Music and Sound effects inside) that the
   app reads through the browser's folder access. He picks it once; Edge asks once a session to open it again (one
   click). The files stay his own files on his computer: backed up with them, never lost when the browser is cleared.
   The index (path, name, folder, size, length) is kept in IndexedDB `patter-sounds` so the list shows straight away
   and search is instant with thousands of files; lengths are found in the background. Favourites and notes (where a
   track came from, whether it needs a credit) are kept by path. A sound used in a video is copied into CutMedia (like
   any import), once per file (path, size, date), and remembered so the credits for a video can be written.
   Dropping or adding files files them into the folder (music over 45 seconds into Music, shorter into Sound effects). */
const SoundLib = (() => {
  const EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm|aif|aiff)$/i;
  let dbp = null; const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-sounds', 1); r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('meta'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const get = async (st, k) => { try { const d = await db(); return await new Promise(res => { const q = d.transaction(st).objectStore(st).get(k); q.onsuccess = () => res(q.result == null ? null : q.result); q.onerror = () => res(null); }); } catch (e) { return null; } };
  const put = async (st, k, v) => { try { const d = await db(); await new Promise((res, rej) => { const t = d.transaction(st, 'readwrite'); t.objectStore(st).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { } };
  const S = { dir: null, state: 'none', index: [], meta: {}, links: {}, scanning: false, loaded: false, name: '' };   // state: none (no folder), locked (needs a click), ready
  const listeners = new Set(), tell = () => listeners.forEach(fn => { try { fn(); } catch (e) { } });
  const supported = () => typeof window !== 'undefined' && (typeof window.showDirectoryPicker === 'function' || !!S.dir);
  const perm = async (h, ask) => { if (!h) return 'denied'; if (typeof h.queryPermission !== 'function') return 'granted'; const o = { mode: 'readwrite' }; let p = await h.queryPermission(o); if (p !== 'granted' && ask) p = await h.requestPermission(o); return p; };
  async function load() { if (S.loaded) return S; S.loaded = true; S.dir = await get('kv', 'dir'); S.index = (await get('kv', 'index')) || []; S.meta = (await get('kv', 'meta')) || {}; S.links = (await get('kv', 'links')) || {}; S.name = S.dir ? S.dir.name : '';
    S.state = !S.dir ? 'none' : (await perm(S.dir, false).catch(() => 'denied')) === 'granted' ? 'ready' : 'locked'; if (S.state === 'ready') scan(); tell(); return S; }
  // pick the folder (makes Music and Sound effects in it when it is empty)
  async function choose() { const h = await window.showDirectoryPicker({ id: 'patter-sounds', mode: 'readwrite', startIn: 'music' }); return use(h); }
  async function use(h) { S.dir = h; S.name = h.name; await put('kv', 'dir', h); S.state = 'ready'; let empty = true; for await (const e of h.values()) { empty = false; break; }
    if (empty) { await h.getDirectoryHandle('Music', { create: true }); await h.getDirectoryHandle('Sound effects', { create: true }); }
    S.index = []; await scan(); return S; }
  async function unlock() { if (!S.dir) return choose(); const p = await perm(S.dir, true); S.state = p === 'granted' ? 'ready' : 'locked'; tell(); if (S.state === 'ready') await scan(); return S.state; }
  // walk the folder: every sound file, with the folder it sits in
  async function scan() {
    if (!S.dir || S.scanning) return; S.scanning = true; tell(); const old = new Map(S.index.map(x => [x.path, x])), out = [];
    try { const walk = async (h, pre, depth) => { for await (const [name, e] of h.entries()) { if (name.startsWith('.')) continue; const p = pre ? pre + '/' + name : name;
          if (e.kind === 'directory') { if (depth < 6) await walk(e, p, depth + 1); } else if (EXT.test(name)) { const o = old.get(p); let size = o ? o.size : 0, mod = o ? o.mod : 0; try { const f = await e.getFile(); size = f.size; mod = f.lastModified; } catch (er) { }
            out.push({ path: p, name: name.replace(EXT, ''), ext: (EXT.exec(name) || ['', ''])[1].toLowerCase(), folder: pre.split('/')[0] || '', sub: pre, size, mod, dur: o && o.size === size && o.mod === mod ? o.dur : null }); } } };
      await walk(S.dir, '', 0); out.sort((a, b) => a.path.localeCompare(b.path)); S.index = out; await put('kv', 'index', out); }
    catch (e) { if (/permission|not allowed/i.test(String(e && e.message))) S.state = 'locked'; }
    S.scanning = false; tell(); lengths(); }
  // lengths, a few at a time in the background, saved as they come
  let lenBusy = false;
  async function lengths() { if (lenBusy || S.state !== 'ready') return; lenBusy = true; let n = 0;
    try { for (const x of S.index) { if (x.dur != null) continue; try { const f = await fileOf(x.path); x.dur = await new Promise(res => { const a = new Audio(), u = URL.createObjectURL(f), done = v => { URL.revokeObjectURL(u); a.removeAttribute('src'); res(v); }; a.preload = 'metadata'; a.onloadedmetadata = () => done(isFinite(a.duration) ? Math.round(a.duration * 100) / 100 : 0); a.onerror = () => done(0); setTimeout(() => done(0), 8000); a.src = u; }); } catch (e) { x.dur = 0; }
        if (++n % 25 === 0) { put('kv', 'index', S.index); tell(); } } } finally { lenBusy = false; put('kv', 'index', S.index); tell(); } }
  async function fileOf(path) { let h = S.dir; const parts = path.split('/'), name = parts.pop(); for (const p of parts) h = await h.getDirectoryHandle(p); return (await h.getFileHandle(name)).getFile(); }
  // the list: search, folder and favourites
  function list(o = {}) { const q = String(o.q || '').trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean); let L = S.index;
    if (o.folder && o.folder !== 'all') L = o.folder === 'fav' ? L.filter(x => S.meta[x.path] && S.meta[x.path].fav) : L.filter(x => x.folder === o.folder);
    if (words.length) L = L.filter(x => { const hay = (x.path + ' ' + ((S.meta[x.path] || {}).note || '')).toLowerCase(); return words.every(w => hay.includes(w)); });
    return L; }
  const folders = () => [...new Set(S.index.map(x => x.folder).filter(Boolean))].sort();
  const metaOf = path => S.meta[path] || {};
  async function setMeta(path, patch) { S.meta[path] = Object.assign({}, S.meta[path] || {}, patch); if (!S.meta[path].fav && !S.meta[path].note) delete S.meta[path]; await put('kv', 'meta', S.meta); tell(); }
  // preview: one sound at a time
  const P = { a: null, path: '', url: '' };
  async function play(path) { if (P.path === path && P.a && !P.a.paused) { P.a.pause(); tell(); return false; } stop(); const f = await fileOf(path); P.url = URL.createObjectURL(f); P.a = new Audio(P.url); P.path = path; P.a.onended = () => { P.path = ''; tell(); }; await P.a.play().catch(() => { }); tell(); return true; }
  function stop() { if (P.a) { P.a.pause(); P.a.removeAttribute('src'); } if (P.url) URL.revokeObjectURL(P.url); P.a = null; P.url = ''; P.path = ''; }
  const playing = () => P.a && !P.a.paused ? P.path : '';
  // into the project: copied into CutMedia once per file version
  async function asset(path) { const x = S.index.find(q => q.path === path); const key = path + '|' + (x ? x.size + '|' + x.mod : ''); const have = S.links[key];
    if (have && typeof CutMedia !== 'undefined' && CutMedia.info(have)) return have;
    const f = await fileOf(path), m = await CutMedia.importFile(new File([f], f.name, { type: f.type || '' })); S.links[key] = m.id; await put('kv', 'links', S.links); return m.id; }
  const pathOfAsset = id => { const k = Object.keys(S.links).find(k2 => S.links[k2] === id); return k ? k.split('|')[0] : null; };
  // his downloads into the folder: music into Music, short ones into Sound effects (or the folder he is looking at)
  async function addFiles(files, into) { if (!S.dir || S.state !== 'ready') throw new Error('Open your sound library first.'); const done = [];
    for (const f of files) { if (!EXT.test(f.name)) continue; let sub = into && into !== 'all' && into !== 'fav' ? into : null;
      if (!sub) { const d = await new Promise(res => { const a = new Audio(), u = URL.createObjectURL(f), fin = v => { URL.revokeObjectURL(u); res(v); }; a.preload = 'metadata'; a.onloadedmetadata = () => fin(a.duration); a.onerror = () => fin(0); setTimeout(() => fin(0), 6000); a.src = u; }); sub = d > 45 ? 'Music' : 'Sound effects'; }
      const dir = await S.dir.getDirectoryHandle(sub, { create: true }); let name = f.name; const base = name.replace(EXT, ''), ext = (EXT.exec(name) || [''])[0];
      for (let i = 2; i < 999; i++) { try { await dir.getFileHandle(name); name = base + ' (' + i + ')' + ext; } catch (e) { break; } }
      const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(f); await w.close(); done.push(sub + '/' + name); }
    await scan(); return done; }
  // credits for the sounds in a video, from his notes
  function credits(assetIds) { const lines = []; new Set(assetIds).forEach(id => { const p = pathOfAsset(id); if (!p) return; const x = S.index.find(q => q.path === p), m = metaOf(p); lines.push((x ? x.name : p.split('/').pop()) + (m.note ? ': ' + m.note : '')); }); return lines; }
  return { load, choose, use, unlock, scan, list, folders, metaOf, setMeta, play, stop, playing, asset, addFiles, credits, pathOfAsset, supported, onChange: fn => listeners.add(fn), get state() { return S.state; }, get name() { return S.name; }, get scanning() { return S.scanning; }, get count() { return S.index.length; }, _S: S };
})();

/* Packs: add-on drawings, moves and set pieces. They are kept in this browser's storage, so they work offline, and new ones
   are fetched from the Patter Studio home on GitHub each time the app opens (when there is an internet connection). A pack
   file can also be added by hand. Packs are plain data; Story checks every value as it reads it. */
const Packs = (() => {
  const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
  const HOME = (typeof window !== 'undefined' && window.PATTER_HOME) || 'https://raw.githubusercontent.com/PatterSquid/patter-studio/main/';
  const listeners = []; let all = {}, version = 0, lastCheck = null, lastError = '';
  const eng = () => (typeof Story !== 'undefined' && Story.packs) || null;

  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { if (typeof indexedDB === 'undefined') return rej(new Error('No storage')); const r = indexedDB.open('patter-packs', 1); r.onupgradeneeded = () => r.result.createObjectStore('packs', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('packs', mode), s = t.objectStore('packs'); let out; const r = fn(s); if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };

  function changed() { version++; listeners.forEach(f => { try { f(); } catch (e) { } }); }
  // Put a pack into the drawing engine; a broken pack is skipped rather than stopping the app
  function apply(rec) { const E2 = eng(); if (!E2) return null; try { const info = E2.install(rec.data); all[rec.id] = rec; return info; } catch (e) { console.warn('Pack skipped', rec.id, e); return null; } }
  async function loadSaved() { try { const list = await tx('readonly', s => s.getAll()); (list || []).forEach(apply); if (list && list.length) changed(); } catch (e) { console.warn('Packs unavailable', e); } }
  async function save(rec) { try { await tx('readwrite', s => s.put(rec)); } catch (e) { } }
  async function add(data, source) {
    if (!data || typeof data !== 'object' || !data.id) throw new Error('That file is not a Patter pack.');
    const rec = { id: String(data.id).toLowerCase().replace(/[^a-z0-9_]/g, ''), version: +data.version || 1, name: data.name || data.id, source: source || 'file', added: Date.now(), data };
    const info = apply(rec); if (!info) throw new Error('That pack could not be read.'); await save(rec); changed(); return info;
  }
  async function remove(id) { const E2 = eng(); if (E2) E2.remove(id); delete all[id]; try { await tx('readwrite', s => s.delete(id)); } catch (e) { } changed(); }
  // Ask GitHub what packs exist and fetch any that are new or newer than the ones here
  async function check() {
    if (inWorker || (typeof navigator !== 'undefined' && navigator.onLine === false)) return [];
    const got = []; lastError = '';
    try {
      const idx = await fetchJSON(HOME + 'packs/index.json');
      for (const it of (idx && idx.packs) || []) {
        const id = String(it.id || '').toLowerCase().replace(/[^a-z0-9_]/g, ''); if (!id) continue;
        if (it.remove) { if (all[id] && all[id].source === 'github') { await remove(id); } continue; }
        if (all[id] && (all[id].version || 0) >= (+it.version || 1)) continue;
        try { const data = await fetchJSON(HOME + 'packs/' + String(it.file || id + '.json').replace(/[^a-zA-Z0-9_.\-\/]/g, '')); data.version = +it.version || data.version; const info = await add(data, 'github'); got.push(info.name); } catch (e) { console.warn('Pack download failed', id, e); }
      }
      lastCheck = Date.now();
    } catch (e) { lastError = 'Could not reach the Patter Studio home on GitHub.'; }
    return got;
  }
  async function fetchJSON(url) { const c = new AbortController(), to = setTimeout(() => c.abort(), 15000); try { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(to); } }
  // Export workers get the same packs so they draw exactly what the preview shows
  const forWorkers = () => Object.values(all).map(r => r.data);
  function loadInWorker(list) { const E2 = eng(); if (!E2 || !list) return; list.forEach(d => { try { E2.install(d); } catch (e) { } }); }
  const list = () => Object.values(all).map(r => ({ id: r.id, name: r.name, version: r.version, source: r.source, added: r.added, note: (r.data && r.data.description) || '', counts: ['places', 'props', 'hats', 'actions', 'setpieces'].map(k => [k, ((r.data && r.data[k]) || []).length]).filter(x => x[1]) }));
  return { loadSaved, check, add, remove, list, forWorkers, loadInWorker, fetchJSON, onChange: f => listeners.push(f), get version() { return version; }, get lastCheck() { return lastCheck; }, get lastError() { return lastError; }, HOME };
})();

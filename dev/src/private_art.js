/* His own artwork (his puppet and his hand drawings), sent through the public update repo locked: `private/art.locked`
   is AES-256-GCM with a key made from his password (PBKDF2, SHA-256), so anyone can download it but only his password
   opens it. `private/art.json` says what is there and its `rev`. The app asks for the password once (it is then kept in
   this browser), unlocks, loads the puppet and the hand sheet into the Character, and does it again by itself whenever
   the rev changes. Made by `dev/lock_art.py`; the password never goes in the repo.
   File: "PLK1", 16 byte salt, 12 byte iv, then the sealed payload: a 4 byte length, a JSON list of { kind, name, size }
   and the files one after another. */
const PrivateArt = (() => {
  const HOME = () => (typeof Packs !== 'undefined' && Packs.HOME) || (typeof window !== 'undefined' && window.PATTER_HOME) || 'https://raw.githubusercontent.com/PatterSquid/patter-studio/main/';
  const hooks = { loaded: null, ask: null };
  let info = null, state = 'none';   // none, waiting (locked, not opened yet), done
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('patter-private', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const get = async k => { const db = await idb(); return new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
  const put = async (k, v) => { const db = await idb(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); };
  const fresh = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();

  async function open(buf, password, iter) {
    const b = new Uint8Array(buf); if (String.fromCharCode(...b.slice(0, 4)) !== 'PLK1') throw new Error('That is not a locked artwork file.');
    const salt = b.slice(4, 20), iv = b.slice(20, 32), enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter || 600000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let plain; try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b.slice(32))); } catch (e) { throw new Error('That password did not open it.'); }
    const n = new DataView(plain.buffer).getUint32(0, true), list = JSON.parse(new TextDecoder().decode(plain.slice(4, 4 + n))); let p = 4 + n;
    return list.map(f => { const bytes = plain.slice(p, p + f.size); p += f.size; return Object.assign({}, f, { bytes }); });
  }
  // Is there something new to unlock? Opens it straight away when the password is already kept here.
  async function check() {
    try { const r = await fetch(fresh(HOME() + 'private/art.json'), { cache: 'no-store' }); if (!r.ok) return state; info = await r.json(); } catch (e) { return state; }
    if (!info || !info.rev) return state; const have = await get('rev').catch(() => null); if (have === info.rev) { state = 'done'; return state; }
    state = 'waiting'; const pw = await get('pw').catch(() => null);
    if (pw) { try { await unlock(pw); return state; } catch (e) { } }
    if (hooks.ask) hooks.ask(); return state;
  }
  async function unlock(password) {
    if (!info) { const r = await fetch(fresh(HOME() + 'private/art.json'), { cache: 'no-store' }); info = await r.json(); }
    const r = await fetch(fresh(HOME() + String(info.file || 'private/art.locked').replace(/[^a-zA-Z0-9_.\-\/]/g, '')), { cache: 'no-store' }); if (!r.ok) throw new Error('Could not download it. Check the internet and try again.');
    const files = await open(await r.arrayBuffer(), password, info.iter);
    const pup = files.find(f => f.kind === 'puppet'), hands = files.find(f => f.kind === 'hands'); if (!pup) throw new Error('There is no puppet in it.');
    let { rig } = await Puppet.importFile(new File([pup.bytes], pup.name || 'puppet.puppet'));
    if (hands) rig = await Puppet.setHands(rig.id, new Blob([hands.bytes], { type: hands.type || 'image/png' }));
    await put('pw', password); await put('rev', info.rev); state = 'done';
    if (hooks.loaded) hooks.loaded(rig);
    return rig;
  }
  return { check, unlock, hooks, _open: open, get state() { return state; }, get info() { return info; } };
})();

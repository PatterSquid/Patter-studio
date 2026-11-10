/* The font library: every Google Font (about 1,900, free for any use, OFL or Apache) for thumbnails and video text, like
   Canva's list. The names are built in (GFONTS, src/gfonts.js from dev/fontlist.py); a font's file comes down the first
   time it is used (cdn.jsdelivr.net/fontsource, latin) and is kept in IndexedDB `patter-fonts`, so it works offline after
   and old thumbnails and videos keep their look. Favourites and recently used are kept too. The export helpers get the
   loaded fonts through forWorkers(). picker() is the Canva style chooser: search, kinds, thumbnail picks, previews. */
const FontLib = (() => {
  const LIST = typeof GFONTS !== 'undefined' ? GFONTS : [], BY = new Map(LIST.map(f => [f[0], f]));
  const KINDS = [['pick', 'Great for thumbnails'], ['fav', 'Favourites'], ['recent', 'Recent'], ['all', 'All'], ['d', 'Display'], ['s', 'Sans'], ['r', 'Serif'], ['h', 'Handwriting'], ['m', 'Mono']];
  const PICKS = ['Oswald', 'Anton', 'Bebas Neue', 'Archivo Black', 'Montserrat', 'Poppins', 'Roboto Condensed', 'Barlow Condensed', 'Rubik', 'Bangers', 'Luckiest Guy', 'Permanent Marker', 'Bowlby One', 'Black Ops One', 'Teko', 'Fjalla One', 'League Spartan', 'Russo One',
    'Alfa Slab One', 'Titan One', 'Lilita One', 'Bungee', 'Righteous', 'Passion One', 'Staatliches', 'Squada One', 'Kanit', 'Saira Condensed', 'Big Shoulders Display', 'Dela Gothic One', 'Rubik Mono One', 'Sigmar One', 'Chewy', 'Fredoka', 'Bricolage Grotesque',
    'Caveat Brush', 'Kalam', 'Gochi Hand', 'Rock Salt', 'Playfair Display', 'Abril Fatface', 'Lora', 'Creepster', 'Nosifer', 'Press Start 2P', 'Monoton', 'Bungee Shade', 'Archivo Narrow', 'Inter', 'Open Sans', 'Lato', 'Roboto', 'Barlow', 'Exo 2', 'Orbitron', 'Black Han Sans', 'Paytone One', 'Racing Sans One', 'Changa One', 'Carter One'].filter(f => BY.has(f));
  const idOf = f => { const e = BY.get(f); return (e && e[1]) || String(f).toLowerCase().replace(/[^a-z0-9]+/g, '-'); };
  const weightsOf = f => { const e = BY.get(f); return e ? e[3].split('').map(d => +d * 100) : [400]; };
  const kindOf = f => { const e = BY.get(f); return e ? e[2] : ''; };
  const has = f => BY.has(f);
  // the nearest weight the font has (the heaviest when asked for 'bold' with none given)
  const near = (f, w) => { const ws = weightsOf(f); w = +w || 700; return ws.reduce((b, x) => Math.abs(x - w) < Math.abs(b - w) ? x : b, ws[0]); };
  const heaviest = f => { const ws = weightsOf(f); return ws.filter(x => x <= 900).pop() || ws[ws.length - 1]; };
  const urlOf = (f, w, it) => (typeof window !== 'undefined' && window.PATTER_FONTLIB || 'https://cdn.jsdelivr.net/fontsource/fonts/') + idOf(f) + '@latest/latin-' + w + '-' + (it ? 'italic' : 'normal') + '.woff2';
  let dbp = null; const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-fonts', 1); r.onupgradeneeded = () => { r.result.createObjectStore('f'); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const get = async (st, k) => { try { const d = await db(); return await new Promise(res => { const q = d.transaction(st).objectStore(st).get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } };
  const put = async (st, k, v) => { try { const d = await db(); await new Promise((res, rej) => { const t = d.transaction(st, 'readwrite'); t.objectStore(st).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { } };
  const loaded = new Map(), pending = new Map(), listeners = new Set(); let favs = null, recent = null, bump = 0;
  const changed = () => { bump++; clearTimeout(changed.t); changed.t = setTimeout(() => { if (typeof E !== 'undefined') E.fontVersion = (E.fontVersion || 0) + 1; listeners.forEach(fn => { try { fn(); } catch (e) { } }); }, 30); };
  // load a font (from this computer if it was used before, else downloaded and kept). keep false: only for previews
  function ensure(f, w, it, keep = true) {
    if (!has(f) || typeof FontFace === 'undefined') return Promise.resolve(false); w = near(f, w); it = !!it && BY.get(f)[4] === 1; const k = f + '|' + w + '|' + (it ? 1 : 0);
    if (loaded.has(k)) { if (keep && !loaded.get(k).kept) { const L = loaded.get(k); L.kept = true; if (L.blob) put('f', k, L.blob); } return Promise.resolve(true); }
    if (pending.has(k)) return pending.get(k);
    const p = (async () => { try { let blob = await get('f', k), fromNet = false; if (!blob) { const r = await fetch(urlOf(f, w, it)); if (!r.ok) throw new Error(r.status); blob = await r.blob(); fromNet = true; }
        const ff = new FontFace(f, await blob.arrayBuffer(), { weight: String(w), style: it ? 'italic' : 'normal' }); await ff.load(); document.fonts.add(ff);
        loaded.set(k, { family: f, weight: String(w), style: it ? 'italic' : 'normal', url: URL.createObjectURL(blob), blob, kept: keep }); if (keep && fromNet) await put('f', k, blob); changed(); return true; }
      catch (e) { return false; } finally { pending.delete(k); } })();
    pending.set(k, p); return p;
  }
  // his own font files (Thumbnail tab, Fonts): added here too so the export helpers get them
  async function addFace(family, blob) { const k = family + '|own'; if (loaded.has(k)) return true; const ff = new FontFace(family, await blob.arrayBuffer()); await ff.load(); document.fonts.add(ff); loaded.set(k, { family, weight: 'normal', style: 'normal', url: URL.createObjectURL(blob), blob, kept: true }); changed(); return true; }
  const idle = () => Promise.all([...pending.values()]);
  const isReady = (f, w, it) => !has(f) || loaded.has(f + '|' + near(f, w) + '|' + (it && BY.get(f)[4] === 1 ? 1 : 0));
  // everything loaded so far, for the export helpers (they load it from this page's copies)
  const forWorkers = () => [...loaded.values()].map(x => ({ family: x.family, weight: x.weight, style: x.style, url: x.url }));
  async function lists() { if (!favs) { favs = (await get('kv', 'favs')) || []; recent = (await get('kv', 'recent')) || []; } return { favs, recent }; }
  async function used(f) { await lists(); recent = [f, ...recent.filter(x => x !== f)].slice(0, 30); put('kv', 'recent', recent); }
  async function fav(f) { await lists(); favs = favs.includes(f) ? favs.filter(x => x !== f) : [f, ...favs]; put('kv', 'favs', favs); return favs.includes(f); }

  /* ---------- the chooser ---------- */
  async function picker(o = {}) {
    if (typeof document === 'undefined') return; const { H } = UI; await lists();
    let d = document.getElementById('fontPick'); if (d) d.remove(); d = H('dialog', { id: 'fontPick', className: 'fp-dlg' }); document.body.append(d);
    let kind = o.current && !PICKS.includes(o.current) && has(o.current) ? 'all' : 'pick', q = '', sample = (o.sample || '').trim().split('\n')[0].slice(0, 28) || 'Ach naw, no again';
    const listBox = H('div', { className: 'fp-list', role: 'listbox' }), count = H('span', { className: 'fp-count' }), search = H('input', { type: 'text', placeholder: 'Search ' + LIST.length.toLocaleString() + ' fonts', 'aria-label': 'Search fonts', on: { input: e => { q = e.target.value.trim().toLowerCase(); if (q && kind !== 'all') { kind = 'all'; tabs(); } fill(); } } });
    const tabsBox = H('div', { className: 'fp-tabs' }), tabs = () => { tabsBox.innerHTML = ''; KINDS.forEach(([k, l]) => tabsBox.append(H('button', { type: 'button', className: k === kind ? 'on' : '', textContent: l, on: { click: () => { kind = k; tabs(); fill(); } } }))); };
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const el = e.target, f = el.dataset.f; io.unobserve(el); ensure(f, heaviest(f) >= 700 ? near(f, 700) : heaviest(f), false, false).then(ok => { const s = el.querySelector('.fp-s'); if (s) s.style.fontFamily = '"' + f + '", sans-serif'; if (!ok && s) s.style.opacity = 0.4; }); }), { root: listBox, rootMargin: '200px' });
    const pickOne = f => { used(f); d.close(); if (o.onPick) o.onPick(f, heaviest(f) >= 700 ? near(f, 700) : heaviest(f)); };
    function rows() { let L; if (kind === 'pick') L = PICKS; else if (kind === 'fav') L = favs.filter(has); else if (kind === 'recent') L = recent.filter(has); else L = LIST.filter(f => kind === 'all' || f[2] === kind).map(f => f[0]);
      if (q) L = L.filter(f => f.toLowerCase().includes(q)).sort((a, b) => (a.toLowerCase().startsWith(q) ? 0 : 1) - (b.toLowerCase().startsWith(q) ? 0 : 1)); return L; }
    let shown = 0, all = [];
    function more() { const next = all.slice(shown, shown + 80); shown += next.length;
      next.forEach(f => { const star = H('button', { type: 'button', className: 'fp-star' + (favs.includes(f) ? ' on' : ''), title: 'Favourite', textContent: favs.includes(f) ? '★' : '☆', on: { click: async e => { e.stopPropagation(); const on = await fav(f); star.textContent = on ? '★' : '☆'; star.classList.toggle('on', on); } } });
        const row = H('div', { className: 'fp-row' + (f === o.current ? ' on' : ''), role: 'option', tabIndex: 0, 'data-f': f, on: { click: () => pickOne(f), keydown: e => { if (e.key === 'Enter') pickOne(f); } } },
          H('div', { className: 'fp-txt' }, H('span', { className: 'fp-s', textContent: sample }), H('span', { className: 'fp-n', textContent: f + '  ·  ' + ({ d: 'Display', s: 'Sans', r: 'Serif', h: 'Handwriting', m: 'Mono' }[kindOf(f)] || '') + (weightsOf(f).length > 1 ? '  ·  ' + weightsOf(f).length + ' weights' : '') })), star);
        listBox.insertBefore(row, sentinel); io.observe(row); }); }
    const sentinel = H('div', { className: 'fp-more' }); const so = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && shown < all.length) more(); }, { root: listBox, rootMargin: '400px' });
    function fill() { listBox.innerHTML = ''; listBox.append(sentinel); shown = 0; all = rows(); count.textContent = all.length ? all.length.toLocaleString() + (all.length === 1 ? ' font' : ' fonts') : (kind === 'fav' ? 'No favourites yet: tap the star on any font.' : kind === 'recent' ? 'Nothing used yet.' : 'No font by that name.'); more(); so.observe(sentinel); }
    d.append(H('div', { className: 'dlg-head' }, H('b', { textContent: 'Fonts' }), H('button', { type: 'button', textContent: 'Close', on: { click: () => d.close() } })),
      H('div', { className: 'fp-top' }, search, H('input', { type: 'text', value: sample, 'aria-label': 'Preview words', title: 'The words shown in each font', on: { input: e => { sample = e.target.value || 'Ach naw'; listBox.querySelectorAll('.fp-s').forEach(s => { s.textContent = sample; }); } } })),
      tabsBox, count, listBox, H('p', { className: 'hint fp-foot', textContent: 'All free Google Fonts. A font downloads the first time you use it, then works offline.' }));
    d.addEventListener('close', () => { io.disconnect(); so.disconnect(); setTimeout(() => d.remove(), 50); });
    tabs(); fill(); d.showModal(); setTimeout(() => search.focus(), 30);
  }
  return { LIST, PICKS, has, ensure, idle, isReady, near, heaviest, weightsOf, kindOf, forWorkers, picker, addFace, onLoad: fn => listeners.add(fn), used, get version() { return bump; } };
})();

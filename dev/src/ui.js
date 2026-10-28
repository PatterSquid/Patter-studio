/* Small helpers for building module input forms. */
const UI = (() => {
  const H = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (k === 'on') Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn));
      else if (k === 'style') e.style.cssText = v;
      else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v);
    });
    kids.flat().forEach(k => { if (k !== '' && k !== null && k !== undefined && k !== false) e.append(k); });
    return e;
  };
  const field = (label, ctrl, hint) => H('label', { className: 'field' }, H('span', { className: 'lab' }, label), ctrl, hint ? H('span', { className: 'hint' }, hint) : '');
  const sel = (val, opts, fn, aria) => H('select', { 'aria-label': aria, on: { change: e => fn(e.target.value) } }, ...opts.map(([v, l]) => H('option', { value: v, selected: String(v) === String(val), textContent: l })));
  const txt = (val, fn, ph = '', aria) => H('input', { type: 'text', value: val ?? '', placeholder: ph, 'aria-label': aria, on: { input: e => fn(e.target.value) } });
  const area = (val, fn, ph = '', rows = 4, aria) => H('textarea', { value: val ?? '', placeholder: ph, rows, 'aria-label': aria, on: { input: e => fn(e.target.value) } });
  const num = (val, fn, min, max, step = 1, aria) => H('input', { type: 'text', inputMode: 'decimal', value: val, 'aria-label': aria, on: { input: e => { const v = parseFloat(e.target.value); if (isFinite(v)) fn(Math.max(min, Math.min(max, v))); } } });
  const yesno = (val, fn, yes = 'Yes', no = 'No') => sel(val ? '1' : '0', [['1', yes], ['0', no]], v => fn(v === '1'));
  const card = (title, ...kids) => H('section', { className: 'card' }, H('h3', {}, title), ...kids);
  const grid2 = (...kids) => H('div', { className: 'grid2' }, ...kids);
  const colourOpts = () => Object.keys(E.COLOURS).map(k => [k, k]);
  const btn = (label, fn, cls) => H('button', { type: 'button', className: cls || '', textContent: label, on: { click: fn } });
  const iconBtn = (label, aria, fn) => H('button', { type: 'button', className: 'icon', textContent: label, title: aria, 'aria-label': aria, on: { click: fn } });
  // Inline suggestions for place names. They sit in the page under the box (not a pop up list), so a phone keyboard can't cover them.
  const suggest = (input, names) => {
    const box = H('div', { className: 'sugg', role: 'listbox', hidden: true });
    input.removeAttribute('list'); input.setAttribute('autocomplete', 'off');
    const show = () => {
      const q = input.value.trim().toLowerCase(); box.innerHTML = ''; if (!q) { box.hidden = true; return; }
      const all = names(), starts = all.filter(o => o.name.toLowerCase().startsWith(q)), has = all.filter(o => !o.name.toLowerCase().startsWith(q) && o.name.toLowerCase().includes(q)), pick = [...starts, ...has].slice(0, 6);
      if (!pick.length || (pick.length === 1 && pick[0].name.toLowerCase() === q)) { box.hidden = true; return; }
      pick.forEach(o => box.append(H('button', { type: 'button', role: 'option', textContent: o.sub ? `${o.name} · ${o.sub}` : o.name, on: { pointerdown: e => { e.preventDefault(); input.value = o.name; input.dispatchEvent(new Event('input')); box.hidden = true; input.dispatchEvent(new Event('change')); } } })));
      box.hidden = false;
    };
    input.addEventListener('input', show); input.addEventListener('focus', () => { show(); setTimeout(() => { try { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { } }, 350); });
    input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
    return box;
  };
  return { H, field, sel, txt, area, num, yesno, card, grid2, colourOpts, btn, iconBtn, suggest };
})();

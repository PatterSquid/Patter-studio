/* PatterScript: write video scripts on the phone, offline. Everything is kept on the phone (IndexedDB), with versions,
   a bin and backup files. "Send to Claude" makes one text file with the script exactly as written plus a JSON copy. */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); return e; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ICON = {
  back: '<path d="M15 18l-6-6 6-6"/>', check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>', send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
const svg = k => `<svg viewBox="0 0 24 24">${ICON[k]}</svg>`;

/* ---------- cues: [TAG] or [TAG: detail]; the words match Patter Studio (its character reads the lower case ones) ---------- */
const CUES = {
  shot: { name: 'Shots', col: 'var(--c-shot)', items: [
    ['ME', 'You to camera'], ['CHART: ', 'Chart'], ['MAP: ', 'Map'], ['NEWS: ', 'Newspaper'], ['SKETCH: ', 'Sketch scene'], ['BROLL: ', 'B roll'],
    ['PIC: ', 'Picture'], ['TIMELINE: ', 'Timeline'], ['FLIGHT: ', 'Flight'], ['PICTOGRAM: ', 'Pictogram'], ['FLYOVER: ', 'Flyover'], ['CLIP: ', 'Video clip']] },
  you: { name: 'Your character', col: 'var(--c-you)', items: [
    ['point', 'Point'], ['point at you', 'At you'], ['point aside', 'Over there'], ['finger up', 'Finger up'], ['explain', 'Explain'], ['offer', 'Palm up'],
    ['shrug', 'Shrug'], ['stop', 'Stop'], ['thumbs up', 'Thumbs up'], ['fist', 'Bang desk'], ['fist shake', 'Shake fist'], ['slap', 'Slap desk'], ['finger wag', 'Wag finger'], ['wave', 'Wave'],
    ['shout', 'Shout'], ['look left', 'Look left'], ['look right', 'Look right'], ['angry', 'Angry'], ['furious', 'Raging'], ['rage', 'Red faced'], ['happy', 'Happy'], ['laugh', 'Laugh'],
    ['sad', 'Sad'], ['surprised', 'Surprised'], ['suspicious', 'Suspicious'], ['calm', 'Calm']] },
  sound: { name: 'Sound and timing', col: 'var(--c-sound)', items: [['beat', 'Beat'], ['pause', 'Pause'], ['SFX: ', 'Sound effect'], ['MUSIC IN: ', 'Music in'], ['MUSIC OUT', 'Music out']] },
  edit: { name: 'Edit', col: 'var(--c-edit)', items: [['ZOOM', 'Zoom punch'], ['TEXT: ', 'Words on screen'], ['CUT', 'Hard cut'], ['TRANSITION: whoosh', 'Transition'], ['FREEZE', 'Freeze frame'], ['SLOWMO', 'Slow motion']] },
};
const SHOT_TAGS = new Set(['ME', 'CHART', 'MAP', 'NEWS', 'SKETCH', 'BROLL', 'PIC', 'TIMELINE', 'FLIGHT', 'PICTOGRAM', 'FLYOVER', 'CLIP']);
const EDIT_TAGS = new Set(['ZOOM', 'TEXT', 'CUT', 'TRANSITION', 'FREEZE', 'SLOWMO']);
const SOUND_TAGS = new Set(['BEAT', 'PAUSE', 'SFX', 'MUSIC IN', 'MUSIC OUT', 'MUSIC']);
const YOU_TAGS = new Set(CUES.you.items.map(i => i[0]).concat(['point you', 'you', 'thumbs', 'bang', 'slam', 'listen', 'there', 'over there', 'palm up', 'talk', 'beat', 'hello', 'look up', 'look down', 'lose it', 'p1', 'p2', 'lab coat']));
const CUE_RE = /\[([^\[\]\n]{1,80})\]/g;
function cueKind(raw) {
  const s = raw.trim(), head = s.split(':')[0].trim(), up = head.toUpperCase(), lo = head.toLowerCase();
  if (up === 'ME') return 'me';
  if (SHOT_TAGS.has(up)) return 'shot';
  if (EDIT_TAGS.has(up)) return 'edit';
  if (SOUND_TAGS.has(up) || up.startsWith('MUSIC')) return 'sound';
  if (YOU_TAGS.has(lo) || YOU_TAGS.has(lo.replace(/\s+\d+(\.\d+)?s?$/, '').replace(/\s+(left|right|both)( hand)?$/, ''))) return 'you';
  return 'other';
}

/* ---------- sections: research based structure for a long video and a Short ---------- */
const SEC = {
  hook: { name: 'Hook', col: '#e3302c', long: 'First 30 seconds. Open on the most interesting thing and deliver what the title and thumbnail promise straight away. No hello, no channel intro.', short: 'First 1 to 3 seconds decide if they swipe. Start mid thought, on the most surprising line or picture.', tl: [0, 30], ts: [0, 3] },
  setup: { name: 'Setup', col: '#5fa8ff', long: 'Why this matters right now and where it is going. Keep it brief: get into the meat quickly.' },
  point: { name: 'Point', col: '#f0b94a', long: 'One idea. Open it with a reason to keep watching, end it on a high so the next one starts with energy.' },
  rehook: { name: 'Re hook', col: '#d784ff', long: 'Around the middle (40 to 50% through) attention dips. Tease what is still coming: the best bit, the twist, the answer.' },
  ask: { name: 'The ask', col: '#4fd1a5', long: 'Subscribe or comment ask, tied to what they just enjoyed. Works best before the end, around 60 to 70% through, while most people are still watching.' },
  payoff: { name: 'Payoff', col: '#e3302c', long: 'Pay off what the hook promised. Your strongest bit goes here.', short: 'The punchline or the answer. Land it hard.' },
  end: { name: 'End screen', col: '#93a4c0', long: '5 to 20 seconds. Point them at your next video so they keep watching you instead of leaving.' },
  build: { name: 'Build', col: '#f0b94a', short: 'Escalate fast. Every line should raise the stakes or add a new picture.' },
  loop: { name: 'Loop', col: '#d784ff', short: 'Last line runs straight back into the first so the replay feels seamless. Replays count as views.' },
  free: { name: 'Section', col: '#41587f', long: 'Your own section.', short: 'Your own section.' },
};
const TEMPLATE = {
  long: [['hook'], ['setup'], ['point', 'Point 1'], ['point', 'Point 2'], ['rehook'], ['point', 'Point 3'], ['ask'], ['payoff'], ['end']],
  short: [['hook'], ['build'], ['payoff'], ['loop']],
};
const ADDABLE = { long: ['point', 'rehook', 'setup', 'ask', 'payoff', 'end', 'hook', 'free'], short: ['build', 'payoff', 'loop', 'hook', 'free'] };
const guideOf = (sc, kind) => (SEC[sc.type] || SEC.free)[kind] || (SEC[sc.type] || SEC.free).long || '';
const newSection = (type, name) => ({ id: uid(), type, name: name || SEC[type].name, text: '' });

/* ---------- storage ---------- */
const DB = (() => {
  let db; const open = () => db || (db = new Promise((res, rej) => { const r = indexedDB.open('patterscript', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('scripts', { keyPath: 'id' }); const v = d.createObjectStore('versions', { keyPath: 'vid' }); v.createIndex('sid', 'sid'); d.createObjectStore('meta'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (store, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error); }); };
  return {
    all: s => tx(s, 'readonly', st => st.getAll()), get: (s, k) => tx(s, 'readonly', st => st.get(k)), put: (s, v, k) => tx(s, 'readwrite', st => k === undefined ? st.put(v) : st.put(v, k)), del: (s, k) => tx(s, 'readwrite', st => st.delete(k)),
    versionsOf: sid => tx('versions', 'readonly', st => st.index('sid').getAll(sid)),
  };
})();
const settings = { wpm: 160, lastBackup: 0 };
async function loadSettings() { const s = await DB.get('meta', 'settings'); Object.assign(settings, s || {}); }
const saveSettings = () => DB.put('meta', { ...settings }, 'settings');
let persistAsked = false;
async function askPersist() { if (persistAsked) return; persistAsked = true; try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { } }

/* ---------- timing: spoken words at his speed, plus beats and pauses ---------- */
const spoken = t => t.replace(CUE_RE, ' ').replace(/\s+/g, ' ').trim();
const wordsIn = t => { const s = spoken(t); return s ? s.split(' ').filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0; };
function secondsOf(text) {
  let s = wordsIn(text) / settings.wpm * 60;
  for (const m of text.matchAll(CUE_RE)) { const k = m[1].trim().toLowerCase(); if (k === 'beat') s += 0.6; else if (k === 'pause') s += 1.2; else { const d = k.match(/^pause\s+(\d+(?:\.\d+)?)\s*s?$/); if (d) s += +d[1]; } }
  return s;
}
const fmt = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function timeline(sc) { let t = 0; return sc.sections.map(s => { const d = secondsOf(s.text); const r = { id: s.id, a: t, d, b: t + d }; t += d; return r; }); }
const totalOf = sc => sc.sections.reduce((a, s) => a + secondsOf(s.text), 0);
const wordsOf = sc => sc.sections.reduce((a, s) => a + wordsIn(s.text), 0);

/* ---------- the script checker: structure and pacing only, from YouTube retention research ---------- */
const STOP = new Set('the a an and or but of to in on at for with by from is are was were be been it its this that these those you your i me my we our they their he she his her them what why how who when where which not no yes do does did so if than then just about into out up over all any can will would could should has have had get got going gonna wee aye naw'.split(' '));
const keyWords = t => new Set(spoken(t).toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/'s$/, '').replace(/(ing|ed|es|s)$/, '')));
const GREET = /^\s*(hi|hello|hey|hiya|welcome|what'?s up|whit'?s up|alright|awright|how'?s it going|good (morning|evening|afternoon))\b/i;
function check(sc) {
  const out = [], kind = sc.kind, tl = timeline(sc), total = tl.length ? tl[tl.length - 1].b : 0, byId = Object.fromEntries(tl.map(r => [r.id, r]));
  const add = (level, sid, title, why, src) => out.push({ level, sid, title, why, src });
  const allText = sc.sections.map(s => s.text).join('\n');
  if (!wordsOf(sc)) return [{ level: 'tip', sid: null, title: 'Nothing to check yet', why: 'Write some of the script and check again.' }];
  const hook = sc.sections.find(s => s.type === 'hook');
  const firstSec = sc.sections.find(s => wordsIn(s.text));
  const firstLine = firstSec ? spoken(firstSec.text).split(/(?<=[.!?])\s+/)[0] || '' : '';
  if (GREET.test(spoken(firstSec ? firstSec.text : ''))) add('warn', firstSec.id, 'Opens with a greeting', 'The first seconds are where most people leave. Start on the most interesting line and say hello later, if at all.', 'YouTube retention: first 30 s');
  if (kind === 'long') {
    if (!hook) add('warn', null, 'No hook section', 'Long videos lose most viewers in the first minute. Add a Hook at the top.', 'Retention benchmarks: 55% leave in the first minute');
    else if (byId[hook.id].d > 30) add('warn', hook.id, `Hook runs ${fmt(byId[hook.id].d)}`, 'YouTube reports how many people are still there after the first 30 seconds. Aim to deliver the promise inside that.', 'YouTube Studio: intro retention, first 30 s');
    const fw = wordsIn(firstLine); if (fw > 28) add('warn', firstSec.id, `First line takes about ${Math.round(fw / settings.wpm * 60)} s to say`, 'Hook them within about 10 seconds. Split it or get to the point sooner.', 'Hook in the first 10 s');
    const promise = keyWords([sc.pack.title, sc.pack.promise].join(' ')); const hw = hook ? keyWords(hook.text) : new Set();
    if (sc.pack.title && promise.size && hook && wordsIn(hook.text) && ![...promise].some(w => hw.has(w))) add('tip', hook.id, 'The hook never mentions what the title promises', 'A steep drop in the first seconds usually means the opening does not match the title or thumbnail. Name it early.', 'Title and thumbnail promise');
    const re = sc.sections.find(s => s.type === 'rehook'); if (total > 240) { if (!re) add('tip', null, 'No re hook', 'Retention often dips around 40 to 50% through. A line teasing what is still to come carries people over it.', 'Mid video dips'); else { const p = byId[re.id].a / total; if (p < 0.3 || p > 0.65) add('tip', re.id, `Re hook is ${Math.round(p * 100)}% through`, 'It does most good around 40 to 50% through, where the dip usually is.', 'Mid video dips'); } }
    const ask = sc.sections.find(s => s.type === 'ask'); if (total > 180) { if (!ask) add('tip', null, 'No ask', 'A subscribe or comment ask before the ending, around 60 to 70% through, reaches more people than one at the very end.', 'Calls to action'); else { const p = byId[ask.id].a / total; if (p < 0.45 || p > 0.85) add('tip', ask.id, `The ask is ${Math.round(p * 100)}% through`, 'Around 60 to 70% through works best: late enough that they like you, early enough that most are still watching.', 'Calls to action'); } }
    const end = sc.sections.find(s => s.type === 'end'); if (!end) add('tip', null, 'No end screen section', 'Pointing them at your next video keeps them watching you, and YouTube rewards videos that start longer sessions.', 'Session time'); else if (byId[end.id].d > 20) add('warn', end.id, `End screen runs ${fmt(byId[end.id].d)}`, 'End screens are 5 to 20 seconds. Anything longer and people leave before it ends.', 'YouTube end screens');
    gaps(sc, 40, add);
    if (total > 0 && total < 60) add('tip', null, `Only ${fmt(total)} long`, 'At this length it could be a Short. Change it with the menu: Change to Short.', '');
  } else {
    const fw = wordsIn(firstLine); if (fw > 9) add('warn', firstSec.id, `First line is ${fw} words`, 'Viewers decide to stay or swipe in the first 1 to 3 seconds. That is about 8 words: cut it or start later in the sentence.', 'Shorts: viewed vs swiped away');
    if (total > 180) add('warn', null, `Runs ${fmt(total)}`, 'Shorts can be at most 3 minutes.', 'YouTube Shorts limit');
    else if (total > 60) add('tip', null, `Runs ${fmt(total)}`, 'Shorts can run to 3 minutes, but in a study of 35 billion Shorts views the ones that did best were about 13 or 60 seconds. Every second has to earn its place.', 'Shorts length study');
    const loop = sc.sections.find(s => s.type === 'loop'); if (loop && !wordsIn(loop.text)) add('tip', loop.id, 'Loop is empty', 'A last line that runs back into the first makes replays seamless, and every replay counts as a view.', 'Shorts views count loops');
    gaps(sc, 8, add);
  }
  const empty = sc.sections.filter(s => !s.text.trim() && !(kind === 'short' && s.type === 'loop')); if (empty.length === 1) add('tip', empty[0].id, `${empty[0].name} is empty`, 'Write it, or delete it from the section menu.', ''); else if (empty.length) add('tip', empty[0].id, `${empty.length} sections are empty`, empty.map(s => s.name).join(', ') + '. Write them, or delete the ones you do not need from their menus.', '');
  const unknown = new Set(); for (const m of allText.matchAll(CUE_RE)) { const raw = m[1].trim(); if (cueKind(raw) === 'other' && raw === raw.toLowerCase()) unknown.add(raw); }
  unknown.forEach(u => add('tip', null, `[${u}] is not a move your character knows`, 'It will stay in the script as a note. Use the buttons for moves Patter Studio can do.', ''));
  return out;
}
// stretches of talking with no new picture, edit or shot change
function gaps(sc, limit, add) {
  let t = 0, since = 0, startSid = null, startText = '', firstShot = false;
  for (const s of sc.sections) {
    const parts = s.text.split(CUE_RE); // even: text, odd: cue
    for (let i = 0; i < parts.length; i++) {
      if (i % 2) { const k = cueKind(parts[i]); if (k === 'shot' || k === 'me' || k === 'edit') { if (since > limit) add('warn', startSid, `About ${Math.round(since)} s with nothing new on screen`, `From "${startText}". Change the picture: a shot, a zoom, words on screen. Long unchanging stretches are where people drift off.`, 'Pattern interrupts'); since = 0; startSid = null; firstShot = true; } else { const d = secondsOf('[' + parts[i] + ']'); since += d; t += d; } continue; }
      const sec = secondsOf(parts[i]); if (!sec) continue;
      if (startSid == null) { startSid = s.id; startText = spoken(parts[i]).split(' ').slice(0, 6).join(' ').replace(/[.,!?;:…]+$/, '') + '…'; }
      since += sec; t += sec;
    }
  }
  if (since > limit) add('warn', startSid, `About ${Math.round(since)} s with nothing new on screen`, `From "${startText}". Change the picture: a shot, a zoom, words on screen. Long unchanging stretches are where people drift off.`, 'Pattern interrupts');
  if (!firstShot && sc.sections.some(s => wordsIn(s.text))) add('tip', null, 'No shots marked yet', 'Use the Shots buttons to say what is on screen ([ME] when it is you to camera). The checker can then spot slow stretches.', '');
}

/* ---------- the file for Claude ---------- */
function exportText(sc) {
  const tl = timeline(sc), total = totalOf(sc), d = new Date(), L = [];
  L.push(`# PatterScript: ${sc.title || 'Untitled'}`, '');
  L.push(`Format: ${sc.kind === 'short' ? 'Short (vertical, under 3 minutes)' : 'Long video'}`);
  if (sc.pack.title) L.push(`Video title: ${sc.pack.title}`);
  if (sc.pack.thumb) L.push(`Thumbnail: ${sc.pack.thumb}`);
  if (sc.pack.promise) L.push(`Promise: ${sc.pack.promise}`);
  L.push(`Estimated length: ${fmt(total)} at ${settings.wpm} words a minute (${wordsOf(sc)} words)`);
  L.push(`Exported: ${d.toLocaleString('en-GB')}`, '');
  sc.sections.forEach((s, i) => { const r = tl[i]; L.push(`## ${s.name}${s.type !== 'free' && s.name !== SEC[s.type].name ? ` (${SEC[s.type].name})` : ''} [${fmt(r.a)} to ${fmt(r.b)}]`, '', s.text.trim() || '(empty)', ''); });
  L.push('---', 'Cue key: [ME] me to camera. Upper case tags are shots and edits, with what to show after the colon: [CHART: ], [MAP: ], [NEWS: ], [SKETCH: ], [BROLL: ], [PIC: ], [TIMELINE: ], [FLIGHT: ], [PICTOGRAM: ], [FLYOVER: ], [CLIP: ], [ZOOM], [TEXT: ], [CUT], [TRANSITION: ], [FREEZE], [SLOWMO], [SFX: ], [MUSIC IN: ], [MUSIC OUT]. Lower case tags are my character\'s moves and moods, as Patter Studio\'s Character reads them: [point], [shrug], [fist], [angry] and so on. [beat] and [pause] are timing.', '');
  L.push('Exact copy for building:', '```json', JSON.stringify({ app: 'PatterScript', v: 1, script: sc, wpm: settings.wpm }, null, 1), '```', '');
  return L.join('\n');
}
const safeName = s => (s || 'Untitled').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled';
async function shareFile(name, text, type, title) {
  const file = new File([text], name, { type });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; } } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  const a = h('a', { href: URL.createObjectURL(file), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return 'saved';
}

/* ---------- state ---------- */
let scripts = [], cur = null, saveT = 0, verT = 0, dirtySinceVersion = false, lastVersionAt = 0;
const live = () => scripts.filter(s => !s.binned).sort((a, b) => b.updated - a.updated);
function blankScript(kind) { const t = Date.now(); return { id: uid(), title: '', kind, pack: { title: '', thumb: '', promise: '' }, sections: TEMPLATE[kind].map(([ty, nm]) => newSection(ty, nm)), created: t, updated: t }; }
function touch() { cur.updated = Date.now(); dirtySinceVersion = true; clearTimeout(saveT); saveT = setTimeout(saveNow, 400); refreshStats(); }
async function saveNow() { clearTimeout(saveT); if (!cur) return; await DB.put('scripts', cur); askPersist(); if (dirtySinceVersion && Date.now() - lastVersionAt > 5 * 60e3) await snapshot('Auto'); }
async function snapshot(label, sc = cur) {
  if (!sc) return; const vs = (await DB.versionsOf(sc.id)).sort((a, b) => b.at - a.at); const body = JSON.stringify({ title: sc.title, pack: sc.pack, sections: sc.sections, kind: sc.kind });
  if (vs[0] && vs[0].body === body && label === 'Auto') { dirtySinceVersion = false; return; }
  await DB.put('versions', { vid: uid(), sid: sc.id, at: Date.now(), label, words: wordsOf(sc), secs: totalOf(sc), body }); lastVersionAt = Date.now(); if (sc === cur) dirtySinceVersion = false;
  const autos = vs.filter(v => v.label === 'Auto'); for (const v of autos.slice(60)) await DB.del('versions', v.vid);
}

/* ---------- views ---------- */
const view = $('#view'), hdr = $('#hdr');
function header(left, title, right) { hdr.replaceChildren(...left, h('h1', { html: title }), ...right); }
const hbtn = (icon, label, on, cls) => h('button', { class: 'hbtn ' + (cls || ''), 'aria-label': label, title: label, onclick: on, html: icon ? svg(icon) + (cls === 'send' ? '<span>' + label + '</span>' : '') : label });

async function showHome() {
  if (cur) { await saveNow(); await snapshot('Auto'); }
  cur = null; cueBar(false); if (location.hash) history.replaceState(null, '', location.pathname);
  header([h('img', { class: 'logo', src: 'icon-192.png', alt: '' })], '<b>PATTER</b>SCRIPT', [hbtn('menu', 'Menu', homeMenu)]);
  const list = live(), q = h('input', { class: 'search', placeholder: 'Search scripts', type: 'search' }), box = h('div');
  const draw = () => { const s = q.value.trim().toLowerCase(); box.replaceChildren(...list.filter(x => !s || (x.title + ' ' + x.pack.title + ' ' + x.sections.map(y => y.text).join(' ')).toLowerCase().includes(s)).map(card)); if (!box.children.length) box.append(h('div', { class: 'empty' }, s ? 'No scripts match.' : '')); };
  q.oninput = draw;
  const kids = [h('div', { class: 'newrow' }, h('button', { class: 'newbtn', onclick: () => create('long') }, '+ Long video', h('small', null, 'Hook, points, payoff')), h('button', { class: 'newbtn', onclick: () => create('short') }, '+ Short', h('small', null, 'Hook, build, payoff, loop')))];
  if (list.length && Date.now() - (settings.lastBackup || 0) > 7 * 86400e3) kids.push(h('div', { class: 'banner' }, h('span', null, settings.lastBackup ? 'No backup for over a week.' : 'Your scripts only live on this phone. Save a backup somewhere safe.'), h('button', { onclick: backup }, 'Back up')));
  if (list.length) { kids.push(q, box); draw(); } else kids.push(h('div', { class: 'empty' }, h('b', null, 'No scripts yet'), 'Start a long video or a Short. Everything saves on this phone as you type, and works with no signal.'));
  view.replaceChildren(...kids); scrollTo(0, 0);
}
function card(s) {
  const tot = totalOf(s); return h('button', { class: 'card', onclick: () => openScript(s.id) }, h('div', { class: 't' }, s.title || s.pack.title || 'Untitled'),
    h('div', { class: 'm' }, h('span', { class: 'chip ' + s.kind }, s.kind === 'short' ? 'Short' : 'Long'), h('span', null, fmt(tot)), h('span', null, wordsOf(s) + ' words'), h('span', null, ago(s.updated))));
}
const ago = t => { const d = (Date.now() - t) / 1000; if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago'; if (d < 86400) return Math.floor(d / 3600) + ' h ago'; return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
let lastCreate = 0;
async function create(kind) { if (Date.now() - lastCreate < 1000) return; lastCreate = Date.now(); const s = blankScript(kind); scripts.push(s); await DB.put('scripts', s); openScript(s.id, true); }

async function openScript(id, fresh) {
  cur = scripts.find(s => s.id === id); if (!cur) return showHome(); if (location.hash !== '#' + id) history.pushState({ ps: 1 }, '', '#' + id); dirtySinceVersion = false; lastVersionAt = Date.now();
  if (!fresh) snapshot('Auto');
  const badge = h('span', { class: 'badge' }), chk = h('button', { class: 'hbtn', 'aria-label': 'Check script', onclick: showCheck, html: svg('check') }); chk.append(badge);
  header([hbtn('back', 'Back', () => { if (history.state && history.state.ps) history.back(); else showHome(); })], '', [chk, hbtn('more', 'More', scriptMenu), hbtn('send', 'Send', sendToClaude, 'send')]);
  const ti = h('input', { class: 'titlein', placeholder: 'Script name', value: cur.title, enterkeyhint: 'done' }); ti.oninput = () => { cur.title = ti.value; touch(); };
  ti.onkeydown = e => { if (e.key === 'Enter') ti.blur(); };
  const stats = h('div', { class: 'stats', id: 'stats' });
  view.replaceChildren(ti, stats, packCard(), h('div', { id: 'secs' }), h('button', { class: 'addsec', onclick: () => addSection(null) }, '+ Add a section'));
  drawSections(); refreshStats(); scrollTo(0, 0);
  if (fresh) setTimeout(() => ti.focus(), 60);
}
function packCard() {
  const p = cur.pack, sub = h('span', { class: 'sub' });
  const setSub = () => { sub.textContent = p.title || 'Title, thumbnail, promise'; };
  const f = (key, label, ph, max, area) => { const cnt = h('i'); const inp = h(area ? 'textarea' : 'input', { placeholder: ph, rows: area ? 2 : null }); inp.value = p[key] || ''; const upd = () => { const n = inp.value.length; cnt.textContent = max ? n + ' / ' + max : ''; cnt.className = max && n > max ? 'over' : ''; if (area && inp.scrollHeight) { inp.style.height = 'auto'; inp.style.height = Math.max(64, inp.scrollHeight + 2) + 'px'; } }; inp.oninput = () => { p[key] = inp.value; upd(); setSub(); touch(); }; upd(); return h('label', { class: 'fld' }, h('span', null, label, cnt), inp); };
  setSub();
  const d = h('details', { class: 'pack' }, h('summary', null, 'Packaging', sub), h('div', { class: 'body' },
    f('title', 'Video title', 'What goes on YouTube', 60), f('thumb', 'Thumbnail idea', 'Picture and 2 to 4 words', 0, true), f('promise', 'The promise', 'What do they get for watching?', 0, true),
    h('div', { class: 'note' }, 'Keep the key words in the first 40 characters of the title. The checker makes sure your hook pays off this promise.')));
  if (!p.title && !cur.sections.some(s => s.text)) d.open = false;
  return d;
}
function refreshStats() {
  const st = $('#stats'); if (!st || !cur) return; const tot = totalOf(cur);
  st.innerHTML = `<span class="chip ${cur.kind}">${cur.kind === 'short' ? 'Short' : 'Long'}</span><span class="big">${fmt(tot)}</span><span class="sep">·</span><span>${wordsOf(cur)} words</span><span class="sep">·</span><span>${settings.wpm} wpm</span>`;
  const tl = timeline(cur); tl.forEach(r => { const e = document.querySelector(`.sec[data-id="${r.id}"] .sec-time`); if (!e) return; const s = cur.sections.find(x => x.id === r.id); const lim = s.type === 'hook' ? (cur.kind === 'short' ? null : 30) : s.type === 'end' ? 20 : null; e.textContent = `${fmt(r.a)} to ${fmt(r.b)}`; e.className = 'sec-time' + (lim && r.d > lim ? ' over' : ''); });
  const b = $('.hbtn .badge'); if (b) { const n = check(cur).filter(i => i.level === 'warn').length; b.textContent = n || '✓'; b.className = 'badge' + (n ? '' : ' ok'); }
}
function drawSections() { const box = $('#secs'); box.replaceChildren(...cur.sections.map(secEl)); refreshStats(); }
function secEl(s) {
  const def = SEC[s.type] || SEC.free, g = h('div', { class: 'sec-g' + (s.text.trim() ? ' hidden' : '') }, guideOf(s, cur.kind));
  const el = h('div', { class: 'sec', 'data-id': s.id, style: `--sc:${def.col}` },
    h('div', { class: 'sec-h' }, h('div', { class: 'sec-n', onclick: () => renameSection(s) }, s.name), h('span', { class: 'sec-time' }),
      h('button', { class: 'ibtn', 'aria-label': 'What goes here', onclick: () => g.classList.toggle('hidden'), html: svg('help') }),
      h('button', { class: 'ibtn', 'aria-label': 'Section menu', onclick: () => sectionMenu(s), html: svg('more') })),
    g, editor(s));
  return el;
}
function editor(s) {
  const pre = h('pre', { 'aria-hidden': 'true' }), ta = h('textarea', { placeholder: 'Write here. Tap the buttons for shots, moves and timing, or type them like [point].', spellcheck: 'true', autocapitalize: 'sentences' });
  ta.value = s.text; ta._sec = s;
  const paint = () => { pre.innerHTML = hl(ta.value) + '\n'; ta.style.height = 'auto'; ta.style.height = Math.max(96, ta.scrollHeight) + 'px'; };
  ta.oninput = () => { s.text = ta.value; paint(); touch(); };
  ta.onfocus = () => { focused = ta; cueBar(true); };
  ta.onblur = () => setTimeout(() => { if (document.activeElement !== ta && !(document.activeElement && document.activeElement.closest('#cuebar'))) { if (focused === ta) focused = null; if (!document.activeElement || document.activeElement.tagName !== 'TEXTAREA' || !document.activeElement._sec) cueBar(false); } }, 120);
  requestAnimationFrame(paint); new ResizeObserver(() => paint()).observe(pre.parentNode || pre);
  return h('div', { class: 'ed' }, pre, ta);
}
const hl = t => { let out = '', last = 0; for (const m of t.matchAll(CUE_RE)) { out += esc(t.slice(last, m.index)); const k = cueKind(m[1]); out += `<span class="cue ${k === 'me' ? 'shot me' : k}">${esc(m[0])}</span>`; last = m.index + m[0].length; } return out + esc(t.slice(last)); };

/* ---------- cue bar ---------- */
let focused = null, cueTab = 'shot';
const bar = $('#cuebar');
function drawBar() {
  const tabs = h('div', { class: 'cb-tabs' }, ...Object.entries(CUES).map(([k, g]) => h('button', { class: k === cueTab ? 'on' : '', style: `--k:${g.col}`, onpointerdown: e => e.preventDefault(), onclick: () => { cueTab = k; drawBar(); } }, h('i'), g.name)));
  const g = CUES[cueTab], row = h('div', { class: 'cb-row' }, ...g.items.map(([tag, label]) => h('button', { style: `--k:${g.col}`, onpointerdown: e => e.preventDefault(), onclick: () => insertCue(tag) }, label)));
  bar.replaceChildren(tabs, row);
}
function cueBar(on) { bar.classList.toggle('on', !!on); }
function insertCue(tag) {
  const ta = focused; if (!ta) return; ta.focus();
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, before = v.slice(0, a), sel = v.slice(a, b);
  const open = tag.endsWith(': ');
  let txt = '[' + (open ? tag + sel : tag) + ']';
  const pad = before && !/\s$/.test(before) ? ' ' : '', after = v.slice(b), padA = after && !/^[\s.,!?;:]/.test(after) ? ' ' : (after ? '' : ' ');
  txt = pad + txt + (open && !sel ? '' : padA);
  ta.setSelectionRange(a, b);
  if (!document.execCommand || !document.execCommand('insertText', false, txt)) { ta.setRangeText(txt, a, b, 'end'); ta.dispatchEvent(new Event('input')); }
  if (open && !sel) { const p = a + pad.length + tag.length + 1; ta.setSelectionRange(p, p); }
}

/* ---------- sheets ---------- */
const scrim = $('#scrim'), sheet = $('#sheet');
let sheetGen = 0;
function openSheet(title, ...body) { sheetGen++; sheet.replaceChildren(h('div', { class: 'grab' }), h('h2', null, title), h('div', { class: 'sbody' }, ...body)); sheet.classList.add('on'); scrim.classList.add('on'); cueBar(false); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
function closeSheet() { sheet.classList.remove('on'); scrim.classList.remove('on'); }
scrim.onclick = () => closeSheet();
const opt = (t, d, on, cls, col) => h('button', { class: 'opt ' + (cls || ''), style: col ? `--k:${col}` : null, onclick: () => { const g = sheetGen; Promise.resolve(on()).then(() => { if (sheetGen === g) closeSheet(); }); } }, col ? h('i', { class: 'dot' }) : null, h('div', null, h('div', { class: 'ot' }, t), d ? h('div', { class: 'od' }, d) : null));
function confirmSheet(title, text, yes, label = 'Yes', cls = 'br') { openSheet(title, h('p', { class: 'note' }, text), h('div', { class: 'row2' }, h('button', { class: 'bs', onclick: () => closeSheet() }, 'Cancel'), h('button', { class: cls, onclick: () => { closeSheet(); yes(); } }, label))); }
function promptSheet(title, value, done, ph) { const i = h('input', { value: value || '', placeholder: ph || '', enterkeyhint: 'done' }); const go = () => { closeSheet(); done(i.value.trim()); }; i.onkeydown = e => { if (e.key === 'Enter') go(); }; openSheet(title, h('label', { class: 'fld' }, i), h('div', { class: 'row2' }, h('button', { class: 'bs', onclick: () => closeSheet() }, 'Cancel'), h('button', { class: 'bp', onclick: go }, 'Done'))); setTimeout(() => i.focus(), 200); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2200); }

function renameSection(s) { promptSheet('Rename section', s.name, v => { if (v) { s.name = v; touch(); drawSections(); } }); }
function sectionMenu(s) {
  const i = cur.sections.indexOf(s);
  openSheet(s.name,
    opt('Rename', null, () => renameSection(s)),
    i > 0 ? opt('Move up', null, () => { cur.sections.splice(i, 1); cur.sections.splice(i - 1, 0, s); touch(); drawSections(); }) : null,
    i < cur.sections.length - 1 ? opt('Move down', null, () => { cur.sections.splice(i, 1); cur.sections.splice(i + 1, 0, s); touch(); drawSections(); }) : null,
    opt('Add a section after this', null, () => addSection(s)),
    opt('Delete section', s.text.trim() ? 'Its words go too (a version is saved first, so you can get them back)' : null, () => confirmSheet('Delete ' + s.name + '?', s.text.trim() ? 'A version of the script is saved first, so you can restore it from Versions.' : 'It is empty.', async () => { await snapshot('Before deleting ' + s.name); cur.sections.splice(cur.sections.indexOf(s), 1); touch(); drawSections(); }, 'Delete'), 'danger'));
}
function addSection(after) {
  openSheet('Add a section', ...ADDABLE[cur.kind].map(t => opt(SEC[t].name, guideOf({ type: t }, cur.kind), () => {
    const nm = t === 'point' ? 'Point ' + (cur.sections.filter(x => x.type === 'point').length + 1) : null; const ns = newSection(t, nm); const at = after ? cur.sections.indexOf(after) + 1 : cur.sections.length; cur.sections.splice(at, 0, ns); touch(); drawSections();
    setTimeout(() => { const ta = $(`.sec[data-id="${ns.id}"] textarea`); if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus(); } }, 50);
  }, null, SEC[t].col)));
}
function scriptMenu() {
  openSheet(cur.title || 'Script',
    opt('Versions', 'Every version saved as you write. Restore any of them.', showVersions),
    opt('Save a version now', 'With a name, e.g. "before rewrite"', () => promptSheet('Name this version', '', async v => { await saveNow(); await snapshot(v || 'Saved by hand'); toast('Version saved'); }, 'e.g. first draft')),
    opt('Copy the script text', 'Plain text with the cues, for anywhere', async () => { try { await navigator.clipboard.writeText(exportText(cur).split('\nExact copy for building:')[0]); toast('Copied'); } catch (e) { toast('Could not copy'); } }),
    opt('Duplicate', 'A copy to try something different', async () => { await saveNow(); const c = JSON.parse(JSON.stringify(cur)); c.id = uid(); c.title = (cur.title || 'Untitled') + ' (copy)'; c.created = c.updated = Date.now(); scripts.push(c); await DB.put('scripts', c); openScript(c.id); toast('Copy made'); }),
    opt(cur.kind === 'long' ? 'Change to Short' : 'Change to long video', 'Keeps your sections; the checker and targets change', () => { cur.kind = cur.kind === 'long' ? 'short' : 'long'; touch(); openScript(cur.id); }),
    opt('Talking speed', settings.wpm + ' words a minute: sets all the timings', speedSheet),
    opt('Cue key', 'What each button means', keySheet),
    opt('Move to bin', 'Kept for 30 days in the bin', () => confirmSheet('Move to bin?', 'You can get it back from the bin for 30 days.', async () => { cur.binned = Date.now(); await DB.put('scripts', cur); await snapshot('Before binning'); cur = null; showHome(); toast('Moved to bin'); }, 'Move to bin'), 'danger'));
}
async function showVersions() {
  await saveNow(); const vs = (await DB.versionsOf(cur.id)).sort((a, b) => b.at - a.at);
  const rows = vs.map(v => h('div', { class: 'ver' }, h('div', { class: 'vt' }, h('b', null, v.label === 'Auto' ? 'Saved automatically' : v.label), h('span', null, new Date(v.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + v.words + ' words · ' + fmt(v.secs))),
    h('button', { onclick: () => previewVersion(v) }, 'Look')));
  openSheet('Versions', rows.length ? h('div', null, ...rows) : h('p', { class: 'note' }, 'No versions yet. One is saved each time you open the script, every 5 minutes while you write, and before anything is deleted.'));
}
function previewVersion(v) {
  const b = JSON.parse(v.body);
  openSheet(v.label === 'Auto' ? 'Saved ' + ago(v.at) : v.label, h('div', { class: 'prev' }, (b.title ? b.title + '\n\n' : '') + b.sections.map(s => s.name.toUpperCase() + '\n' + (s.text || '(empty)')).join('\n\n')),
    h('div', { class: 'row2' }, h('button', { class: 'bs', onclick: showVersions }, 'Back'), h('button', { class: 'bp', onclick: async () => { await snapshot('Before restoring'); Object.assign(cur, { title: b.title, pack: b.pack, sections: b.sections, kind: b.kind || cur.kind }); touch(); await saveNow(); closeSheet(); openScript(cur.id); toast('Restored. The version before is saved too.'); } }, 'Restore this')));
}
function speedSheet() {
  const big = h('div', { class: 'speed' }, settings.wpm), sl = h('input', { type: 'range', min: 110, max: 220, step: 5, value: settings.wpm });
  sl.oninput = () => { big.textContent = sl.value; };
  sl.onchange = () => { settings.wpm = +sl.value; saveSettings(); refreshStats(); };
  const passage = 'Right, here is the thing. Every time the council promises to fix the roads, a new pothole opens up somewhere in Glasgow. Some of them are that big they have got their own postcode. Folk have started naming them. One in Shettleston has a fan club and a wee Facebook page. And the best part is, the money to fix them was spent on a report about why they are not fixed.';
  const n = wordsIn(passage); let t0 = 0; const go = h('button', { class: 'bp' }, 'Start reading');
  go.onclick = () => { if (!t0) { t0 = performance.now(); go.textContent = 'Done'; go.className = 'br'; } else { const w = Math.round(n / ((performance.now() - t0) / 60000) / 5) * 5; t0 = 0; go.textContent = 'Again'; go.className = 'bp'; if (w > 60 && w < 320) { settings.wpm = Math.min(220, Math.max(110, w)); sl.value = settings.wpm; big.textContent = settings.wpm; saveSettings(); refreshStats(); toast('Your speed: ' + w + ' words a minute'); } } };
  openSheet('Talking speed', big, h('p', { class: 'note', style: 'text-align:center;margin-top:0' }, 'words a minute'), sl,
    h('p', { class: 'note' }, 'Measure it: tap Start, read this out loud the way you talk in your videos, then tap Done.'), h('div', { class: 'readme' }, passage), h('div', { class: 'row2' }, go));
}
function keySheet() {
  const rows = []; Object.values(CUES).forEach(g => { rows.push(h('b', { style: `grid-column:1/-1;margin-top:8px;color:${g.col}` }, g.name)); g.items.forEach(([t, l]) => rows.push(h('code', { style: `color:${g.col};background:var(--app)` }, '[' + t.trim() + (t.endsWith(': ') ? ' …' : '') + ']'), h('span', null, l))); });
  openSheet('Cue key', h('p', { class: 'note' }, 'Tap a button to drop it in where you are typing, or type it yourself in square brackets. Shots and edits take what to show after a colon: [CHART: knife crime by year]. Lower case tags are your character\'s moves, the same words Patter Studio uses.'), h('div', { class: 'key' }, ...rows));
}
function showCheck() {
  const items = check(cur), warn = items.filter(i => i.level === 'warn'), tips = items.filter(i => i.level !== 'warn');
  const row = i => h('button', { class: 'issue ' + (i.level === 'warn' ? '' : 'tip'), onclick: () => { closeSheet(); if (i.sid) { const e = $(`.sec[data-id="${i.sid}"]`); if (e) { e.scrollIntoView({ behavior: 'smooth', block: 'start' }); e.classList.add('flag'); setTimeout(() => e.classList.remove('flag'), 1600); } } } },
    h('div', { class: 'it' }, i.title), h('div', { class: 'iw' }, i.why), i.src ? h('div', { class: 'is' }, i.src) : null);
  openSheet('Script check', items.length ? null : h('div', { class: 'good' }, h('b', null, 'Nothing to flag'), 'The structure and pacing look right for a ' + (cur.kind === 'short' ? 'Short.' : 'long video.')),
    warn.length ? h('div', null, ...warn.map(row)) : null, tips.length ? h('div', null, ...tips.map(row)) : null,
    h('p', { class: 'note', style: 'margin-top:12px' }, 'Checks structure and pacing only, from YouTube\'s own retention reports and published retention research. It never judges the jokes.'));
}
async function sendToClaude() {
  await saveNow(); await snapshot('Sent to Claude');
  const r = await shareFile('PatterScript - ' + safeName(cur.title || cur.pack.title) + '.txt', exportText(cur), 'text/plain', cur.title || 'Script');
  if (r === 'saved') toast('Saved to Downloads. Attach it in Claude.'); else if (r === 'shared') toast('Sent');
}
function homeMenu() {
  openSheet('PatterScript',
    opt('Back up everything', 'One file with every script and version. Save it to Drive or email it to yourself.', backup),
    opt('Restore from a backup', 'Adds anything missing; never deletes', restore),
    opt('Bin', live().length === scripts.length ? 'Empty' : (scripts.length - live().length) + ' in the bin', binSheet),
    opt('Talking speed', settings.wpm + ' words a minute', speedSheet),
    opt('Cue key', 'What each button means', keySheet),
    h('p', { class: 'note', style: 'margin-top:10px' }, 'Your scripts are kept on this phone only. Nothing is uploaded anywhere unless you send it.'));
}
async function backup() {
  const vs = await DB.all('versions'); const data = JSON.stringify({ app: 'PatterScript', kind: 'backup', v: 1, at: Date.now(), settings: { wpm: settings.wpm }, scripts, versions: vs });
  const d = new Date(), name = `PatterScript backup ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const r = await shareFile(name, data, 'application/json', 'PatterScript backup');
  if (r !== 'cancelled') { settings.lastBackup = Date.now(); await saveSettings(); toast(r === 'saved' ? 'Backup saved to Downloads' : 'Backup sent'); if (!cur) showHome(); }
}
function restore() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' }); inp.onchange = async () => {
    try { const j = JSON.parse(await inp.files[0].text()); if (j.app !== 'PatterScript' || !Array.isArray(j.scripts)) throw new Error('not a backup');
      let added = 0, newer = 0; for (const s of j.scripts) { const have = scripts.find(x => x.id === s.id); if (!have) { scripts.push(s); added++; await DB.put('scripts', s); } else if (s.updated > have.updated) { await snapshot('Before restoring a backup', have); Object.assign(have, s); newer++; await DB.put('scripts', have); } }
      const mine = new Set((await DB.all('versions')).map(v => v.vid)); for (const v of j.versions || []) if (!mine.has(v.vid)) await DB.put('versions', v);
      toast(`Restored: ${added} new, ${newer} updated`); showHome();
    } catch (e) { toast('That file is not a PatterScript backup'); } };
  inp.click();
}
function binSheet() {
  const b = scripts.filter(s => s.binned).sort((x, y) => y.binned - x.binned);
  openSheet('Bin', b.length ? h('div', null, ...b.map(s => h('div', { class: 'ver' }, h('div', { class: 'vt' }, h('b', null, s.title || 'Untitled'), h('span', null, 'Binned ' + ago(s.binned) + ' · gone for good ' + new Date(s.binned + 30 * 86400e3).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))),
    h('button', { onclick: async () => { delete s.binned; await DB.put('scripts', s); closeSheet(); showHome(); toast('Brought back'); } }, 'Bring back')))) : h('p', { class: 'note' }, 'The bin is empty.'));
}

/* ---------- start ---------- */
async function start() {
  await loadSettings(); scripts = await DB.all('scripts');
  const old = scripts.filter(s => s.binned && Date.now() - s.binned > 30 * 86400e3); for (const s of old) { await DB.del('scripts', s.id); for (const v of await DB.versionsOf(s.id)) await DB.del('versions', v.vid); } scripts = scripts.filter(s => !old.includes(s));
  drawBar();
  const id = location.hash.slice(1); if (id && scripts.find(s => s.id === id && !s.binned)) openScript(id); else showHome();
  addEventListener('popstate', () => { if (sheet.classList.contains('on')) { closeSheet(); if (cur) history.pushState({ ps: 1 }, '', '#' + cur.id); return; } if (cur && !location.hash) showHome(); else if (!cur && location.hash.length > 1 && scripts.find(s => s.id === location.hash.slice(1) && !s.binned)) openScript(location.hash.slice(1)); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && cur) saveNow(); });
  addEventListener('pagehide', () => { if (cur) saveNow(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
}
window.PS = { check, exportText, timeline, cueKind, get cur() { return cur; }, get scripts() { return scripts; }, settings, snapshot, saveNow };
start();

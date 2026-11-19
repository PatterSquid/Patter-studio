/* The Audio tab: his voice recording cleaned up and edited, then sent to the Character tab or the video.
   The recording stays as it was (cfg.src, a CutMedia file); the clean up settings (cfg.clean) and the edits (cfg.edits, in
   the recording's own seconds) are applied on top, so undo is the app's usual undo and nothing is ever lost.
   Workspace: a big waveform (or the frequencies) with the selection and playhead, Before/After, and the clean up and edit
   panels beside it. body.aud switches the layout; the module's form() draws the workspace, so undo redraws it. */
const AudioTab = (() => {
  const SR = 48000, MAXS = 30 * 60;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, r3 = v => Math.round(v * 1000) / 1000;
  const CLEAN0 = () => ({ studio: false, rumble: true, hum: false, humHz: 50, declick: false, declip: false, buzz: false, room: 0, pops: 0, nr: { on: false, reduce: 12, sens: 6, smooth: 3, profile: null }, ai: { on: false, atten: 20 }, tone: { on: false, amt: 0.5 }, eq: { on: false, low: 0, mud: -2, pres: 2, air: 1.5 }, deess: 0, ride: 0, comp: 0, level: 0, gate: { on: false, range: 24, under: 30, breath: 9 }, loud: null });
  // Studio voice: every stage at the strength the before and after clip of November 2026 was made with (the AI cleaner is switched on with it when it has been downloaded)
  const STUDIO = () => ({ studio: true, rumble: true, hum: false, declick: false, declip: true, buzz: true, room: 0.8, pops: 0.6, tone: { on: true, amt: 0.5 }, deess: 0.3, ride: 0.6, comp: 0.3, level: 0, gate: { on: true, range: 24, under: 30, breath: 9 }, loud: -16 });
  const defaults = () => ({ v: 1, src: '', name: '', clean: CLEAN0(), edits: [] });
  const fmt = s => { s = Math.max(0, s); const m = Math.floor(s / 60), x = s - m * 60; return m + ':' + (x < 10 ? '0' : '') + x.toFixed(2); };

  /* ---------- the sound: the recording decoded, cleaned (cached), then the edits ---------- */
  const raw = { id: null, x: null, busy: null };
  async function loadRaw(id) {
    if (raw.id === id && raw.x) return raw.x; if (raw.busy && raw.id === id) return raw.busy;
    raw.id = id; raw.x = null;
    return (raw.busy = (async () => { const b = await CutMedia.blobOf(id); if (!b) throw new Error('The recording is not on this computer any more. Open it again.'); const ac = new OfflineAudioContext(1, 1, SR), ab = await ac.decodeAudioData(await b.arrayBuffer());
      const n = Math.min(ab.length, MAXS * SR), x = new Float32Array(n); for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) x[i] += d[i] / ab.numberOfChannels; } if (raw.id === id) raw.x = x; return x; })().finally(() => { raw.busy = null; }));
  }
  const cleanKey = c => JSON.stringify([c.src, c.clean]);
  const proc = { key: '', y: null, res: null, job: 0, info: null, fkey: '', front: null };
  // what goes into the noise reduction (so the noise is learned from the same sound it will be taken out of)
  function preNR(x, c) { let y = x; if (c.rumble !== false) y = AudioFX.rumble(y, SR, +c.rumbleHz || 80); if (c.hum) y = AudioFX.hum(y, SR, +c.humHz || 50); return y; }
  // The slow half (repairs, the room, the cleaner) is kept by its own settings, so a tone, level or gap change is ready in a moment
  async function processed(cfg, onProgress) {
    const k = cleanKey(cfg); if (proc.key === k && proc.y) return proc.y; const job = ++proc.job, x = await loadRaw(cfg.src), c = cfg.clean || {}, fk = cfg.src + AudioFX.frontKey(c);
    let F = proc.fkey === fk ? proc.front : null;
    if (!F) { const f = await AudioFX.front(x, SR, c, onProgress); let res = null; if (f.nrIn && f.nrOut) { res = new Float32Array(f.nrIn.length); for (let i = 0; i < res.length; i++) res[i] = f.nrIn[i] - (f.nrOut[i] || 0); }   // what the noise and room removal took away, to listen to on its own ("Removed")
      F = { y: f.y, info: f.info, res }; proc.fkey = fk; proc.front = F; }
    const r = await AudioFX.back(F, SR, c, onProgress), y = r.y;
    if (job === proc.job) { proc.key = k; proc.y = y; proc.res = F.res; proc.info = r.info; } return y;
  }
  // the edits: the kept stretches of the recording (in its own seconds), then quieted, faded or louder parts
  function segmentsOf(edits, dur) {
    const dels = (edits || []).filter(e => e.k === 'del').map(e => [cl(+e.a, 0, dur), cl(+e.b, 0, dur)]).filter(d => d[1] > d[0]).sort((a, b) => a[0] - b[0]), keep = []; let t = 0;
    dels.forEach(([a, b]) => { if (a > t) keep.push([t, a]); t = Math.max(t, b); }); if (t < dur) keep.push([t, dur]);
    // pasted parts: a stretch of the recording put in again at a point (in the recording's own seconds)
    (edits || []).filter(e => e.k === 'ins').forEach(e => { const a = cl(+e.a, 0, dur), b = cl(+e.b, 0, dur), at = cl(+e.at, 0, dur); if (!(b > a)) return;
      let i = keep.findIndex(([s0, s1]) => at >= s0 && at <= s1 && !(s0 === a && s1 === b)); if (i < 0) { keep.push([a, b]); return; }
      const [s0, s1] = keep[i], parts = []; if (at > s0) parts.push([s0, at]); parts.push([a, b]); if (s1 > at) parts.push([at, s1]); keep.splice(i, 1, ...parts); });
    return keep;
  }
  function render(x, cfg) {
    const dur = x.length / SR, segs = segmentsOf(cfg.edits, dur), y0 = Float32Array.from(x);
    (cfg.edits || []).forEach(e => { if (e.k === 'del') return; const a = Math.max(0, Math.floor(+e.a * SR)), b = Math.min(y0.length, Math.floor(+e.b * SR)), n = b - a; if (n <= 0) return;
      if (e.k === 'sil') { const r = Math.min(n >> 1, Math.floor(SR * 0.01)); for (let i = a; i < b; i++) { const u = Math.min(i - a, b - 1 - i); y0[i] *= u < r ? 1 - u / r : 0; } }
      if (e.k === 'fin') for (let i = a; i < b; i++) y0[i] *= (i - a) / n;
      if (e.k === 'fout') for (let i = a; i < b; i++) y0[i] *= (b - i) / n;
      if (e.k === 'gain') { const g = Math.pow(10, (+e.db || 0) / 20), r = Math.min(n >> 1, Math.floor(SR * 0.01)); for (let i = a; i < b; i++) { const u = Math.min(i - a, b - 1 - i), k = u < r ? u / r : 1; y0[i] *= 1 + (g - 1) * k; } } });
    let total = 0; segs.forEach(([a, b]) => { total += Math.floor(b * SR) - Math.floor(a * SR); }); const y = new Float32Array(Math.max(1, total)); let o = 0; const XF = Math.floor(SR * 0.006);
    segs.forEach(([a, b], si) => { const i0 = Math.floor(a * SR), i1 = Math.floor(b * SR); for (let i = i0; i < i1; i++, o++) { let v = y0[i]; if (si > 0 && i - i0 < XF) v *= (i - i0) / XF; if (si < segs.length - 1 && i1 - i < XF) v *= (i1 - i) / XF; y[o] = v; } });
    return { y, segs };
  }
  // seconds in the edited sound <-> seconds in the recording
  function toSrc(segs, t) { let acc = 0; for (const [a, b] of segs) { const d = b - a; if (t <= acc + d) return a + (t - acc); acc += d; } return segs.length ? segs[segs.length - 1][1] : t; }
  function srcRanges(segs, t0, t1) { const out = []; let acc = 0; for (const [a, b] of segs) { const d = b - a, s0 = Math.max(t0, acc), s1 = Math.min(t1, acc + d); if (s1 > s0) out.push([a + s0 - acc, a + s1 - acc]); acc += d; } return out; }

  /* ---------- the workspace state that is not part of the clip ---------- */
  const W = { cfg: null, changed: null, root: null, before: false, removed: false, clip: null, outRes: null, view: 'wave', sel: null, head: 0, t0: 0, t1: 0, out: null, outBefore: null, status: '', progress: 0, rec: null, ac: null, srcNode: null, playAt: 0, playFrom: 0, playing: false, raf: 0 };
  let renderJob = 0, renderTimer = null;
  const cur = () => W.before ? W.outBefore : W.removed && W.outRes ? W.outRes : W.out;
  function outDur() { const o = cur(); return o ? o.y.length / SR : 0; }
  async function rebuild() {
    const cfg = W.cfg; if (!cfg || !cfg.src) { W.out = W.outBefore = null; draw(); return; } const job = ++renderJob;
    try {
      const x = await loadRaw(cfg.src); if (job !== renderJob) return; W.outBefore = render(x, cfg);
      if (typeof VoiceFX !== 'undefined' && !(W.insp && W.insp.id === cfg.src)) { const id = cfg.src; W.insp = { id, r: null }; VoiceFX.inspect(x, SR).then(r => { if (W.insp && W.insp.id === id) { W.insp.r = r; paintReport(); } }).catch(() => { }); }
      if (!W.out || W.out.key !== cleanKey(cfg) + JSON.stringify(cfg.edits)) {
        setStatus('Working…', 0); const y = await processed(cfg, (q, s) => { if (job === renderJob) setStatus(s || 'Working…', q); }); if (job !== renderJob) return;
        W.out = Object.assign(render(y, cfg), { key: cleanKey(cfg) + JSON.stringify(cfg.edits) }); W.outRes = proc.res && proc.key === cleanKey(cfg) ? render(proc.res, cfg) : null; setStatus('', 1);
      }
      const d = outDur(); if (!(W.t1 > W.t0) || W.t1 > d + 0.01 || W.t0 >= d) { W.t0 = 0; W.t1 = d; } W.head = Math.min(W.head, d); specCache.key = ''; draw(); panelInfo(); paintReport();
    } catch (e) { setStatus(e.message || String(e), 0); }
  }
  const later = () => { clearTimeout(renderTimer); renderTimer = setTimeout(rebuild, 250); };
  function setStatus(s, q) { W.status = s; W.progress = q; const el = W.root && W.root.querySelector('.au-status'); if (el) { el.textContent = s ? s + (q > 0 && q < 1 ? ' ' + Math.round(q * 100) + '%' : '') : ''; } }

  /* ---------- playing ---------- */
  function ctx() { if (!W.ac) W.ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR }); return W.ac; }
  function stop() { if (W.srcNode) { try { W.srcNode.onended = null; W.srcNode.stop(); } catch (e) { } W.srcNode = null; } if (W.playing) W.head = nowT(); W.playing = false; cancelAnimationFrame(W.raf); drawHead(); syncPlayBtn(); }
  const nowT = () => W.playing && W.ac ? Math.min(outDur(), W.playFrom + (W.ac.currentTime - W.playAt)) : W.head;
  function play(from) {
    const o = cur(); if (!o) return; stop(); const ac = ctx(); if (ac.state === 'suspended') ac.resume();
    const end = W.sel ? W.sel[1] : outDur(); let t = from != null ? from : (W.sel && (W.head < W.sel[0] || W.head >= W.sel[1]) ? W.sel[0] : W.head); if (t >= end - 0.01) t = W.sel ? W.sel[0] : 0;
    const b = ac.createBuffer(1, o.y.length, SR); b.copyToChannel(o.y, 0); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination);
    s.start(0, t, Math.max(0.01, end - t)); W.srcNode = s; W.playAt = ac.currentTime; W.playFrom = t; W.playing = true; s.onended = () => { if (W.srcNode === s) { W.playing = false; W.head = W.sel ? W.sel[0] : Math.min(outDur(), end); W.srcNode = null; drawHead(); syncPlayBtn(); } };
    const tick = () => { if (!W.playing) return; drawHead(); const t2 = nowT(); if (t2 > W.t1 || t2 < W.t0) { const span = W.t1 - W.t0; W.t0 = Math.max(0, Math.min(outDur() - span, t2 - span * 0.1)); W.t1 = W.t0 + span; draw(); } W.raf = requestAnimationFrame(tick); }; W.raf = requestAnimationFrame(tick); syncPlayBtn();
  }
  const toggle = () => { if (W.playing) stop(); else play(); };
  // The same round play button as the play bar under every other tab's preview
  const AU_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.3-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z" fill="currentColor"/></svg>', AU_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.4" height="15" rx="1.2" fill="currentColor"/><rect x="13.6" y="4.5" width="4.4" height="15" rx="1.2" fill="currentColor"/></svg>';
  function syncPlayBtn() { const b = W.root && W.root.querySelector('.au-play'); if (b) { const s2 = W.playing ? 'Pause' : 'Play'; if (b.dataset.s !== s2) { b.dataset.s = s2; b.innerHTML = W.playing ? AU_PAUSE : AU_PLAY; b.setAttribute('aria-label', s2); } } }

  /* ---------- drawing the sound ---------- */
  const specCache = { key: '', img: null };
  function draw() {
    const cv = W.root && W.root.querySelector('.au-wave'); if (!cv) return; const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0a1120'; g.fillRect(0, 0, w, h);
    const o = cur(), rul = 22; if (!o) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '16px Archivo, sans-serif'; g.textAlign = 'center'; g.fillText(W.cfg && W.cfg.src ? (W.status || 'Reading the recording…') : 'Open a recording, or record one, to start', w / 2, h / 2); return; }
    const d = o.y.length / SR, t0 = W.t0, t1 = Math.max(W.t0 + 0.01, W.t1), X = t => (t - t0) / (t1 - t0) * w, mid = rul + (h - rul) / 2, amp = (h - rul) / 2 - 6;
    // the ruler
    g.fillStyle = '#0d1628'; g.fillRect(0, 0, w, rul); g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = '11px Archivo, sans-serif'; g.textAlign = 'left';
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300], st = steps.find(s => (t1 - t0) / s < w / 90) || 600;
    for (let t = Math.ceil(t0 / st) * st; t <= t1; t += st) { const x = X(t); g.fillRect(x, rul - 7, 1, 7); g.fillText(fmt(t).replace(/\.00$/, ''), x + 3, 13); }
    // selection under everything
    if (W.sel) { g.fillStyle = 'rgba(80,150,255,0.22)'; g.fillRect(X(W.sel[0]), rul, X(W.sel[1]) - X(W.sel[0]), h - rul); }
    if (W.view === 'spec') {
      const cols = Math.min(900, Math.round(w)), rows = 128, key = [o === W.out, o.key || 'b', t0.toFixed(3), t1.toFixed(3), cols].join('|');
      if (specCache.key !== key) { const sp = AudioFX.spectrogram(o.y, SR, t0, t1, cols, rows), c2 = document.createElement('canvas'); c2.width = cols; c2.height = rows; const g2 = c2.getContext('2d'), im = g2.createImageData(cols, rows);
        for (let i = 0; i < cols * rows; i++) { const v = sp[i], r = Math.round(255 * Math.min(1, v * 1.6)), gg = Math.round(255 * Math.max(0, Math.min(1, (v - 0.35) * 1.8))), b = Math.round(255 * Math.min(1, 0.25 + v * 0.9 - Math.max(0, v - 0.7) * 2)); im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; }
        g2.putImageData(im, 0, 0); specCache.key = key; specCache.img = c2; }
      g.imageSmoothingEnabled = true; g.drawImage(specCache.img, 0, rul, w, h - rul);
      g.fillStyle = 'rgba(255,255,255,0.5)'; [[100, '100 Hz'], [1000, '1 kHz'], [5000, '5 kHz']].forEach(([f, l]) => { const y = rul + (h - rul) * (1 - Math.log(f / 40) / Math.log(16000 / 40)); g.fillRect(0, y, 6, 1); g.fillText(l, 8, y + 4); });
    } else {
      const cols = Math.round(w), i0 = Math.floor(t0 * SR), i1 = Math.min(o.y.length, Math.ceil(t1 * SR)), pk = AudioFX.peaks(o.y.subarray(i0, Math.max(i0 + 1, i1)), cols);
      g.fillStyle = W.before ? '#8a93a8' : W.removed ? '#e0805a' : '#4fd1a5'; for (let c = 0; c < cols; c++) { const lo = pk[c * 2], hi = pk[c * 2 + 1]; g.fillRect(c, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp)); }
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, mid, w, 1);
    }
    // where the cuts are (joins in the edited sound)
    let acc = 0; g.fillStyle = 'rgba(255,190,60,0.85)'; (o.segs || []).forEach(([a, b], i) => { acc += b - a; if (i < o.segs.length - 1 && acc > t0 && acc < t1) { const x = X(acc); g.fillRect(x - 1, rul, 2, h - rul); g.beginPath(); g.moveTo(x - 5, rul); g.lineTo(x + 5, rul); g.lineTo(x, rul + 7); g.fill(); } });
    if (W.sel) { g.strokeStyle = 'rgba(120,180,255,0.9)'; g.lineWidth = 1; [W.sel[0], W.sel[1]].forEach(t => { const x = X(t) + 0.5; g.beginPath(); g.moveTo(x, rul); g.lineTo(x, h); g.stroke(); }); }
    W._X = X; W._w = w; drawHead(); overview();
    const info = W.root.querySelector('.au-time'); if (info) info.textContent = fmt(W.head) + ' / ' + fmt(d) + (W.sel ? '   selected ' + (W.sel[1] - W.sel[0]).toFixed(2) + ' s' : '');
  }
  // The playhead is a line moved across the picture (not a second full size canvas cleared and redrawn every frame)
  function drawHead() {
    const el = W.root && W.root.querySelector('.au-head i'); if (!el) return; const w = W._w || el.parentNode.clientWidth, t = nowT();
    if (t < W.t0 || t > W.t1) { if (!el.hidden) el.hidden = true; } else { if (el.hidden) el.hidden = false; el.style.transform = 'translateX(' + Math.round((t - W.t0) / (W.t1 - W.t0) * w) + 'px)'; }
    const info = W.root.querySelector('.au-time'); if (info && W.playing) { const tx = fmt(t) + ' / ' + fmt(outDur()); if (info.textContent !== tx) info.textContent = tx; }
  }
  function overview() {
    const cv = W.root && W.root.querySelector('.au-over'); if (!cv) return; const o = cur(); if (!o) return; const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0d1628'; g.fillRect(0, 0, w, h); const pk = AudioFX.peaks(o.y, Math.round(w)), d = o.y.length / SR; g.fillStyle = '#3a6a8a';
    for (let c = 0; c < w; c++) { const lo = pk[c * 2], hi = pk[c * 2 + 1]; g.fillRect(c, h / 2 - hi * h / 2, 1, Math.max(1, (hi - lo) * h / 2)); }
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(W.t0 / d * w + 0.5, 1, Math.max(3, (W.t1 - W.t0) / d * w), h - 2);
  }

  /* ---------- editing ---------- */
  function edit(fn, msg) { const cfg = W.cfg, o = W.out || W.outBefore; if (!cfg || !o) return; fn(cfg, o.segs); W.changed(true); if (msg) say(msg); }
  const say = m => { const el = W.root && W.root.querySelector('.au-say'); if (el) el.textContent = m; };
  function needSel() { if (!W.sel || W.sel[1] - W.sel[0] < 0.005) { say('Drag across the sound first to choose a part.'); return false; } return true; }
  const ACT = {
    del() { if (!needSel()) return; const [a, b] = W.sel; edit((c, segs) => { srcRanges(segs, a, b).forEach(([x, y]) => c.edits.push({ k: 'del', a: r3(x), b: r3(y) })); }, 'Cut out ' + (b - a).toFixed(2) + ' s.'); W.head = a; W.sel = null; },
    sil() { if (!needSel()) return; const [a, b] = W.sel; edit((c, segs) => { srcRanges(segs, a, b).forEach(([x, y]) => c.edits.push({ k: 'sil', a: r3(x), b: r3(y) })); }, 'Made quiet.'); },
    keep() { if (!needSel()) return; const [a, b] = W.sel, d = outDur(); edit((c, segs) => { [...srcRanges(segs, 0, a), ...srcRanges(segs, b, d)].forEach(([x, y]) => c.edits.push({ k: 'del', a: r3(x), b: r3(y) })); }, 'Kept only the part you chose.'); W.sel = null; W.head = 0; },
    fin() { if (!needSel()) return; const [a, b] = W.sel; edit((c, segs) => { const r = srcRanges(segs, a, b); if (r.length) c.edits.push({ k: 'fin', a: r3(r[0][0]), b: r3(r[r.length - 1][1]) }); }, 'Fades in.'); },
    fout() { if (!needSel()) return; const [a, b] = W.sel; edit((c, segs) => { const r = srcRanges(segs, a, b); if (r.length) c.edits.push({ k: 'fout', a: r3(r[0][0]), b: r3(r[r.length - 1][1]) }); }, 'Fades out.'); },
    louder() { if (!needSel()) return; const [a, b] = W.sel; edit((c, segs) => { srcRanges(segs, a, b).forEach(([x, y]) => c.edits.push({ k: 'gain', a: r3(x), b: r3(y), db: 3 })); }, 'A bit louder.'); },
    quieter() { if (!needSel()) return; const [a, b] = W.sel; edit((c, segs) => { srcRanges(segs, a, b).forEach(([x, y]) => c.edits.push({ k: 'gain', a: r3(x), b: r3(y), db: -3 })); }, 'A bit quieter.'); },
    async tighten() { const cfg = W.cfg; if (!cfg || !W.out) return; const y = await processed(cfg), ps = AudioFX.pauses(y, SR, 0.7, -42); let n = 0, saved = 0; const dur = y.length / SR, segs = segmentsOf(cfg.edits, dur);
      edit(c => { ps.forEach(([a, b]) => { if (a < 0.05 || b > dur - 0.05) return; const keep = 0.35, m0 = a + keep / 2, m1 = b - keep / 2; if (m1 - m0 < 0.1) return; if (!segs.some(([s0, s1]) => m0 >= s0 && m1 <= s1)) return; c.edits.push({ k: 'del', a: r3(m0), b: r3(m1) }); n++; saved += m1 - m0; }); });
      say(n ? 'Tightened ' + n + ' long pause' + (n > 1 ? 's' : '') + ', ' + saved.toFixed(1) + ' s shorter.' : 'No long pauses to tighten.'); },
    reset() { edit(c => { c.edits = []; }, 'All the cuts and edits taken off (the clean up stays).'); W.sel = null; },
    copy() { if (!needSel()) return; const o = W.out || W.outBefore; W.clip = srcRanges(o.segs, W.sel[0], W.sel[1]).map(([x, y]) => [r3(x), r3(y)]); say('Copied ' + (W.sel[1] - W.sel[0]).toFixed(2) + ' s. Put the playhead where it goes and press Paste (Ctrl+V).'); },
    cut() { if (!needSel()) return; ACT.copy(); ACT.del(); say('Cut ' + W.clip.reduce((s, [a, b]) => s + b - a, 0).toFixed(2) + ' s. Put the playhead where it goes and press Paste (Ctrl+V).'); },
    paste() { if (!W.clip || !W.clip.length) { say('Copy or cut a part first.'); return; } const t = W.head; edit((c, segs) => { const at = r3(toSrc(segs, t)); W.clip.slice().reverse().forEach(([a, b]) => c.edits.push({ k: 'ins', a, b, at })); }, 'Pasted at ' + fmt(t) + '.'); },
    amplify() { if (!needSel()) return; const v = prompt('Amplify by how many dB? (minus to make it quieter)', '3'); if (v == null) return; const db = cl(parseFloat(v) || 0, -40, 24); if (!db) return; const [a, b] = W.sel; edit((c, segs) => { srcRanges(segs, a, b).forEach(([x, y]) => c.edits.push({ k: 'gain', a: r3(x), b: r3(y), db })); }, (db > 0 ? 'Louder by ' : 'Quieter by ') + Math.abs(db) + ' dB.'); },
    normalise() { const o = W.out; if (!o) return; const [a, b] = W.sel && W.sel[1] - W.sel[0] > 0.005 ? W.sel : [0, outDur()]; let pk = 0; for (let i = Math.floor(a * SR); i < Math.min(o.y.length, Math.ceil(b * SR)); i++) pk = Math.max(pk, Math.abs(o.y[i]));
      if (pk < 1e-5) { say('That part is silent.'); return; } const db = Math.round((20 * Math.log10(0.891 / pk)) * 10) / 10; if (Math.abs(db) < 0.1) { say('Already as loud as it can go without clipping.'); return; }
      edit((c, segs) => { srcRanges(segs, a, b).forEach(([x, y]) => c.edits.push({ k: 'gain', a: r3(x), b: r3(y), db })); }, 'Normalised: loudest peak now at -1 dB (' + (db > 0 ? '+' : '') + db + ' dB).'); },
  };
  async function learnNoise() {
    if (!needSel()) return; const cfg = W.cfg, x = await loadRaw(cfg.src), segs = segmentsOf(cfg.edits, x.length / SR), r = srcRanges(segs, W.sel[0], W.sel[1]); if (!r.length) return;
    const long = r.reduce((m, q) => q[1] - q[0] > m[1] - m[0] ? q : m, r[0]), pre = preNR(x, cfg.clean), prof = AudioFX.profile(pre, SR, long[0], long[1]); if (!prof) return;
    cfg.clean.nr = Object.assign({ reduce: 12, sens: 6, smooth: 3 }, cfg.clean.nr || {}, { on: true, profile: prof }); if (cfg.clean.ai) cfg.clean.ai.on = false; W.changed(true); say('Noise learned from ' + (long[1] - long[0]).toFixed(2) + ' s. It is now taken out of the whole recording.' + (long[1] - long[0] < 0.25 ? ' A longer quiet bit (half a second or more) learns it better.' : ''));
  }
  /* ---------- the mouse on the waveform: drag to choose, click to place the playhead, wheel to zoom ---------- */
  function wire(cv) {
    let drag = null; const tAt = ev => { const r = cv.getBoundingClientRect(); return cl(W.t0 + (ev.clientX - r.left) / r.width * (W.t1 - W.t0), 0, outDur()); };
    cv.addEventListener('pointerdown', ev => { if (!(W.out || W.outBefore)) return; cv.setPointerCapture(ev.pointerId); const t = tAt(ev); drag = { a: ev.shiftKey && W.sel ? (Math.abs(t - W.sel[0]) < Math.abs(t - W.sel[1]) ? W.sel[1] : W.sel[0]) : t, moved: !!ev.shiftKey }; if (ev.shiftKey && W.sel) { W.sel = [Math.min(drag.a, t), Math.max(drag.a, t)]; draw(); } });
    cv.addEventListener('pointermove', ev => { if (!drag) return; const t = tAt(ev); if (Math.abs(t - drag.a) * (W._w || 800) / (W.t1 - W.t0) > 3) drag.moved = true; if (drag.moved) { W.sel = [Math.min(drag.a, t), Math.max(drag.a, t)]; draw(); } });
    cv.addEventListener('pointerup', ev => { if (!drag) return; const t = tAt(ev); if (!drag.moved) { W.sel = null; W.head = t; if (W.playing) play(t); } else W.head = W.sel[0]; drag = null; draw(); });
    cv.addEventListener('wheel', ev => { if (!(W.out || W.outBefore)) return; ev.preventDefault(); const d = outDur(), r = cv.getBoundingClientRect(), f = (ev.clientX - r.left) / r.width, at = W.t0 + f * (W.t1 - W.t0);
      if (ev.ctrlKey || ev.metaKey || !ev.shiftKey && Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) { const k = Math.exp(ev.deltaY * 0.0015), span = cl((W.t1 - W.t0) * k, 0.05, d); W.t0 = cl(at - f * span, 0, Math.max(0, d - span)); W.t1 = W.t0 + span; }
      else { const span = W.t1 - W.t0, dx = (ev.deltaX || ev.deltaY) / r.width * span; W.t0 = cl(W.t0 + dx, 0, Math.max(0, d - span)); W.t1 = W.t0 + span; }
      draw(); }, { passive: false });
  }
  function zoom(k) { const d = outDur(); if (!d) return; const c = W.sel ? (W.sel[0] + W.sel[1]) / 2 : (W.t0 + W.t1) / 2, span = cl((W.t1 - W.t0) * k, 0.05, d); W.t0 = cl(c - span / 2, 0, Math.max(0, d - span)); W.t1 = W.t0 + span; draw(); }

  /* ---------- the recording: open a file, or record from the mic ---------- */
  async function useFile(f) { say('Bringing in ' + f.name + '…'); try { const m = await CutMedia.importFile(f, q => say('Bringing in ' + f.name + '… ' + Math.round(q * 100) + '%')); W.cfg.src = m.id; W.cfg.name = f.name; W.cfg.edits = []; W.sel = null; W.head = 0; W.t0 = W.t1 = 0; W.out = null; W.changed(true); say(''); } catch (e) { say(e.message || String(e)); } }
  /* Recording takes the samples themselves (a small audio worklet, or the old script node where a worklet cannot be
     loaded) into a 32 bit WAV: MediaRecorder would squeeze them through Opus first. The browser's own echo, noise and
     gain processing is off. While it records a meter shows the level coming in and says so when it is too quiet or
     clipping: the level and the distance to the microphone are the two things no clean up can fully put right. */
  const REC_WORKLET = 'data:text/javascript,' + encodeURIComponent("class R extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(4800);this.n=0;this.port.onmessage=()=>{this.port.postMessage(this.b.slice(0,this.n));this.n=0;};}process(i){const d=i[0]&&i[0][0];if(d){for(let k=0;k<d.length;k++){this.b[this.n++]=d[k];if(this.n===4800){this.port.postMessage(this.b);this.b=new Float32Array(4800);this.n=0;}}}return true;}}registerProcessor('patter-rec',R);");
  const micPick = () => { try { return localStorage.getItem('patter-mic') || ''; } catch (e) { return ''; } };
  async function mics() { try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'communications'); } catch (e) { return []; } }
  async function paintMics() { const el = W.root && W.root.querySelector('.au-mic'); if (!el) return; const list = await mics(), named = list.filter(d => d.label), cur = micPick(); el.innerHTML = ''; const fld = W.root.querySelector('.au-micf'); if (fld) fld.hidden = named.length < 2; if (named.length < 2) return;
    named.forEach(d => { const o = document.createElement('option'); o.value = d.deviceId === 'default' ? '' : d.deviceId; o.textContent = d.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, ''); o.selected = o.value === cur; el.append(o); }); }
  async function record() {
    if (W.rec) { W.rec.stop(); return; }
    let s = null, ac = null;
    try { const want = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, dev = micPick(); if (dev) want.deviceId = { ideal: dev };
      s = await navigator.mediaDevices.getUserMedia({ audio: want }); ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR }); if (ac.state === 'suspended') await ac.resume();
      const src = ac.createMediaStreamSource(s), parts = [], t0 = performance.now(), R = { pk: 0, hold: 0, clips: 0, quiet: 0, n: 0 }; let node, done = false, stopping = false;
      const take = d => { if (done || !d || !d.length) return; parts.push(d); R.n += d.length; let m = 0; for (let i = 0; i < d.length; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > m) m = a; } if (m > R.pk) R.pk = m; if (m >= 0.985) { R.clips++; R.hold = performance.now() + 1500; } };
      try { await ac.audioWorklet.addModule(REC_WORKLET); node = new AudioWorkletNode(ac, 'patter-rec', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' }); node.port.onmessage = e => take(e.data); src.connect(node); }
      catch (e) { node = ac.createScriptProcessor(4096, 1, 1); node.onaudioprocess = e => take(new Float32Array(e.inputBuffer.getChannelData(0))); const z = ac.createGain(); z.gain.value = 0; src.connect(node); node.connect(z); z.connect(ac.destination); }
      const finish = async () => { if (stopping) return; stopping = true; if (node.port) { node.port.postMessage(0); await new Promise(r => setTimeout(r, 80)); } done = true; cancelAnimationFrame(W.recRaf); clearInterval(W.recTimer); s.getTracks().forEach(tr => tr.stop()); try { src.disconnect(); await ac.close(); } catch (e) { } W.rec = null; paintRecBtn(); paintMics();
        if (R.n < SR * 0.2) { say('Nothing was recorded.'); return; } const x = new Float32Array(R.n); let o = 0; for (const d of parts) { x.set(d, o); o += d.length; }
        const d = new Date(), name = 'Recording ' + d.toLocaleDateString('en-GB').replace(/\//g, '-') + ' ' + d.toTimeString().slice(0, 5).replace(':', '.') + '.wav'; await useFile(new File([AudioFX.wavF([x], SR)], name, { type: 'audio/wav' })); };
      W.rec = { stop: finish, R, how: node.port ? 'worklet' : 'script' };
      W.recTimer = setInterval(() => { const b = W.root && W.root.querySelector('.au-rec'); if (b) b.textContent = '■ Stop recording ' + fmt((performance.now() - t0) / 1000).replace(/\.\d+$/, ''); }, 250);
      // the meter: the loudest sample since the last look, falling back slowly, on a scale from -60 dB to full
      let shown = 0, loud = 0, lastSay = '';
      const meter = () => { if (!W.rec || W.rec.R !== R) return; const cv = W.root && W.root.querySelector('.au-meter'); shown = Math.max(R.pk, shown * 0.9); R.pk = 0; loud = Math.max(shown, loud * 0.995);
        if (cv) { const g = cv.getContext('2d'), w = cv.width, h = cv.height, db = 20 * Math.log10(shown + 1e-6), u = cl((db + 60) / 60, 0, 1), hot = performance.now() < R.hold; g.clearRect(0, 0, w, h); g.fillStyle = '#16233c'; g.fillRect(0, 0, w, h); g.fillStyle = hot || db > -3 ? '#ff7a1a' : db > -30 ? '#4fd1a5' : '#7d8aa3'; g.fillRect(0, 0, w * u, h); g.fillStyle = 'rgba(255,255,255,0.35)'; [-30, -12, -3].forEach(m => g.fillRect(Math.round(w * (m + 60) / 60), 0, 1, h)); }
        const ld = 20 * Math.log10(loud + 1e-6), msg = performance.now() < R.hold ? 'Too loud: it is clipping. Sit back a little or turn the microphone down.' : performance.now() - t0 > 4000 && ld < -30 ? 'Very quiet. Get closer to the microphone or turn it up.' : 'Recording. Talk a hand’s width from the microphone, a little to one side of it.'; if (msg !== lastSay) { lastSay = msg; say(msg); }
        W.recRaf = requestAnimationFrame(meter); };
      paintRecBtn(); W.recRaf = requestAnimationFrame(meter);
    } catch (e) { if (s) s.getTracks().forEach(tr => tr.stop()); if (ac) { try { ac.close(); } catch (e2) { } } W.rec = null; paintRecBtn(); say('Could not use the microphone: ' + (e.message || e)); }
  }
  function paintRecBtn() { const b = W.root && W.root.querySelector('.au-rec'), m = W.root && W.root.querySelector('.au-meter'); if (b) { b.textContent = W.rec ? '■ Stop recording' : '● Record'; b.classList.toggle('on', !!W.rec); b.closest('.au-bar').classList.toggle('rec', !!W.rec); } if (m) m.hidden = !W.rec; }

  /* ---------- sending it on ---------- */
  async function renderFile() { const o = W.out; if (!o) throw new Error('Nothing to send yet.'); const nm = (W.cfg.name || 'Voice').replace(/\.[a-z0-9]+$/i, '') + ' (clean).wav'; return new File([AudioFX.wav([o.y], SR)], nm, { type: 'audio/wav' }); }
  async function send(where) {
    try { say('Getting it ready…'); const f = await renderFile();
      if (where === 'wav') { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); say('Saved ' + f.name + '.'); return; }
      const m = await CutMedia.importFile(f, null); if (hooks.send) hooks.send(where, m.id, f.name);
      say(where === 'char' ? 'It is now the voice in Animator, Character.' : 'Added to the video on an audio track at the start.'); } catch (e) { say(e.message || String(e)); }
  }
  const hooks = {};

  /* ---------- the panels ---------- */
  function form(root0, cfg, changed) {
    const { H, card, field, btn, sel } = UI;
    W.cfg = cfg; W.changed = full => { changed(); if (full) form(root0, W.cfg, changed); else later(); }; cfg.clean = Object.assign(CLEAN0(), cfg.clean || {}); cfg.clean.nr = Object.assign(CLEAN0().nr, cfg.clean.nr || {}); cfg.clean.ai = Object.assign(CLEAN0().ai, cfg.clean.ai || {}); cfg.clean.eq = Object.assign(CLEAN0().eq, cfg.clean.eq || {}); cfg.clean.tone = Object.assign(CLEAN0().tone, cfg.clean.tone || {}); cfg.clean.gate = Object.assign(CLEAN0().gate, cfg.clean.gate || {}); cfg.edits = Array.isArray(cfg.edits) ? cfg.edits : [];
    let ws = document.getElementById('audioWs'); if (!ws) { ws = H('div', { id: 'audioWs' }); document.querySelector('main').append(ws); }
    W.root = ws; ws.innerHTML = ''; const C = cfg.clean;
    const fileIn = H('input', { type: 'file', accept: 'audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov' }); fileIn.style.display = 'none'; fileIn.addEventListener('change', () => { const f = fileIn.files && fileIn.files[0]; if (f) useFile(f); fileIn.value = ''; });
    const seg = (val, opts, fn) => H('div', { className: 'st-seg wrap' }, ...opts.map(([v, l]) => H('button', { type: 'button', className: String(v) === String(val) ? 'on' : '', textContent: l, on: { click: () => fn(v) } })));
    const slider = (label, val, min, max, step, fn, show) => { const out = H('span', { className: 'au-val', textContent: show(val) }); return H('label', { className: 'field au-sl' }, H('span', { className: 'lab' }, label, out), H('input', { type: 'range', min, max, step, value: val, on: { input: e => { out.textContent = show(+e.target.value); }, change: e => { fn(+e.target.value); W.changed(true); } } })); };
    // Before, After, and Removed (only what the noise removal took away: there should be no words in it)
    const mode = () => W.before ? 'b' : W.removed ? 'r' : 'a';
    const ab = m => H('button', { type: 'button', className: 'au-ab' + (mode() === m ? ' on' : ''), 'data-m': m, textContent: { b: 'Before', a: 'After', r: 'Removed' }[m], title: { b: 'Hear it as recorded, with your cuts (B swaps)', a: 'Hear it cleaned up (B swaps)', r: 'Hear only what the noise and room removal take out. A faint echo of your words is the room going; clear words mean one of them is set too strong.' }[m],
      on: { click: () => setMode(m) } });
    W.setMode = m => { if (m === 'r' && !W.outRes) { say('Turn on the AI voice cleaner or Room first; then Removed lets you hear what they take out.'); return; } const t = nowT(), was = W.playing; W.before = m === 'b'; W.removed = m === 'r'; specCache.key = ''; ws.querySelectorAll('.au-ab').forEach(b => b.classList.toggle('on', b.dataset.m === m)); draw(); if (was) play(Math.min(t, outDur())); };
    const setMode = m => W.setMode(m);
    // the top bar
    ws.append(H('div', { className: 'au-bar' },
      H('div', { className: 'au-name', textContent: cfg.src ? (cfg.name || 'Recording') : 'No recording yet' }),
      btn('Open a recording', () => fileIn.click()), H('button', { type: 'button', className: 'au-rec', textContent: '● Record', on: { click: record } }), H('canvas', { className: 'au-meter', width: 180, height: 10, hidden: true, title: 'The level coming in: the bar should reach the last third when you talk, and never the end' }), fileIn,
      H('span', { className: 'au-sp' }),
      H('button', { type: 'button', className: 'au-play', innerHTML: AU_PLAY, title: 'Play or pause (Space)', 'aria-label': 'Play', on: { click: toggle } }),
      H('div', { className: 'au-abw' }, ab('b'), ab('a'), ab('r')),
      H('span', { className: 'au-time' }),
      H('span', { className: 'au-sp' }),
      seg(W.view, [['wave', 'Waveform'], ['spec', 'Frequencies']], v => { W.view = v; ws.querySelectorAll('.au-bar .st-seg button').forEach(b => b.classList.toggle('on', b.textContent === (v === 'wave' ? 'Waveform' : 'Frequencies'))); draw(); }),
      H('span', { className: 'au-zoomw' }, btn('－', () => zoom(1.6)), btn('＋', () => zoom(1 / 1.6)), btn('Whole thing', () => { W.t0 = 0; W.t1 = outDur(); draw(); }))));
    const waveBox = H('div', { className: 'au-wbox' }, H('canvas', { className: 'au-wave', 'aria-label': 'The recording: drag to choose a part, click to place the playhead' }), H('div', { className: 'au-head', 'aria-hidden': 'true' }, H('i', { hidden: true })));
    const overCv = H('canvas', { className: 'au-over', title: 'The whole recording: click to jump there' });
    overCv.addEventListener('pointerdown', ev => { const r = overCv.getBoundingClientRect(), d = outDur(), span = W.t1 - W.t0, c = (ev.clientX - r.left) / r.width * d; W.t0 = cl(c - span / 2, 0, Math.max(0, d - span)); W.t1 = W.t0 + span; draw(); });
    const tb = (l, f, tip) => { const b = btn(l, f); b.title = tip; return b; };
    const edits = H('div', { className: 'au-edits' }, H('span', { className: 'lab' }, 'Selection'), tb('Cut out', ACT.del, 'Delete: take it out and close the gap'), tb('Cut', ACT.cut, 'Ctrl+X: take it out, ready to paste somewhere else'), tb('Copy', ACT.copy, 'Ctrl+C'), tb('Paste', ACT.paste, 'Ctrl+V: put what you copied at the playhead'),
      tb('Make quiet', ACT.sil, 'Silence it, keeping the length'), tb('Keep only this', ACT.keep, 'Cut out everything else'), tb('Fade in', ACT.fin, ''), tb('Fade out', ACT.fout, ''), tb('Amplify…', ACT.amplify, 'Louder or quieter by an exact number of dB'), tb('Normalise', ACT.normalise, 'Make the loudest peak -1 dB (the selection, or everything when nothing is selected)'),
      H('span', { className: 'au-sp' }), tb('Tighten long pauses', ACT.tighten, 'Shortens pauses longer than 0.7 s'), cfg.edits.length ? tb('Undo all cuts', ACT.reset, 'Takes every cut and edit off (the clean up stays). Ctrl+Z undoes one at a time.') : '');
    const left = H('div', { className: 'au-main' }, waveBox, overCv, edits, H('div', { className: 'au-foot' }, H('span', { className: 'au-status' }), H('span', { className: 'au-say', 'aria-live': 'polite' })));
    // the clean up panel, in the order the sound goes through it
    const nr = C.nr, prof = nr.profile, G = C.gate, pc = v => v ? Math.round(v * 100) + '%' : 'Off', yn = (v, yes, no, fn) => seg(v ? '1' : '0', [['1', yes], ['0', no]], q => { fn(q === '1'); W.changed(true); });
    const gateSet = () => { G.on = G.range > 0 || G.breath > 0; };
    const side = H('div', { className: 'au-side' },
      card('Studio voice', field('Everything below, set for you', seg(C.studio ? '1' : '0', [['1', 'On'], ['0', 'Off']], v => setStudio(v === '1')), 'For a rough microphone: buzz and noise out, the room out, the tone of a close microphone, an even level and silent gaps. Each stage below can still be changed by hand. B swaps before and after.'),
        H('div', { className: 'au-report', 'aria-live': 'polite' })),
      card('Noise', aiBox(C),
        field('Buzz, hum and whine', yn(C.buzz, 'Find and take out', 'Leave', v => { C.buzz = v; }), 'Finds any steady tone (mains buzz and its harmonics, a monitor’s whine) and notches out just that.'),
        field('Rumble (traffic, desk knocks)', yn(C.rumble !== false, 'Cut', 'Keep', v => { C.rumble = v; })),
        C.hum ? field('Mains hum (the older 50 Hz filter)', yn(C.hum, 'Take out', 'Leave', v => { C.hum = v; })) : ''),
      card('Room', slider('Take the room out', C.room || 0, 0, 1, 0.05, v => { C.room = v; }, pc),
        H('p', { className: 'hint', textContent: 'The echo that follows every sound in a room is predicted from the moment before and taken away, so the voice comes from the mouth, not from the room. It measures the room first: a close, dry recording is left alone.' })),
      card('Repairs', field('Clipped peaks (recorded too loud)', yn(C.declip, 'Mend', 'Leave', v => { C.declip = v; })),
        field('Clicks', yn(C.declick, 'Fix', 'Leave', v => { C.declick = v; })),
        slider('Pops on P and B', C.pops || 0, 0, 1, 0.05, v => { C.pops = v; }, pc)),
      card('Tone', slider('Match a close microphone', C.tone.on ? C.tone.amt : 0, 0, 1, 0.05, v => { C.tone.amt = v || 0.5; C.tone.on = v > 0; }, pc),
        H('p', { className: 'hint', textContent: 'Measures your voice across the whole recording against a voice a hand’s width from a good microphone and corrects part of the difference: thin, boxy or harsh microphones come out fuller and smoother. Your own voice stays yours.' }),
        field('Voice EQ by hand', yn(C.eq.on, 'On', 'Off', v => { C.eq.on = v; })),
        ...(C.eq.on ? [slider('Boom (120 Hz)', C.eq.low, -6, 6, 0.5, v => { C.eq.low = v; }, v => (v > 0 ? '+' : '') + v + ' dB'), slider('Boxiness (320 Hz)', C.eq.mud, -8, 4, 0.5, v => { C.eq.mud = v; }, v => (v > 0 ? '+' : '') + v + ' dB'), slider('Presence (3.5 kHz)', C.eq.pres, -4, 8, 0.5, v => { C.eq.pres = v; }, v => (v > 0 ? '+' : '') + v + ' dB'), slider('Air (10 kHz and up)', C.eq.air, -4, 8, 0.5, v => { C.eq.air = v; }, v => (v > 0 ? '+' : '') + v + ' dB')] : []),
        slider('Soften harsh S sounds', C.deess || 0, 0, 1, 0.05, v => { C.deess = v; }, pc)),
      card('Level and gaps', slider('Even level (every phrase as loud as the last)', C.ride || 0, 0, 1, 0.05, v => { C.ride = v; }, pc),
        slider('Compressor (punch)', C.comp || 0, 0, 1, 0.05, v => { C.comp = v; }, pc),
        C.level > 0 ? slider('Slow leveller (the older one)', C.level || 0, 0, 1, 0.05, v => { C.level = v; }, pc) : '',
        field('Gaps between words', seg(G.on ? String(G.range) : '0', [['0', 'Leave'], ['12', 'Quieter'], ['24', 'Quiet'], ['60', 'Silent']], v => { G.range = +v; gateSet(); W.changed(true); }), 'Turned down after the compressor, so nothing can lift the gaps back up. Opens just before each word.'),
        field('Breaths', seg(G.on ? String(G.breath) : '0', [['0', 'Leave'], ['9', 'Soften'], ['30', 'Take out']], v => { G.breath = +v; if (!G.on) G.range = 0; gateSet(); W.changed(true); }), 'Soften keeps them natural. Take out can sound held in on a long read.'),
        field('Loudness', sel(C.loud == null ? '' : String(C.loud), [['', 'As recorded'], ['-16', 'Voice for video (-16 LUFS)'], ['-14', 'YouTube loud (-14 LUFS)'], ['-19', 'Quieter (-19 LUFS)']], v => { C.loud = v === '' ? null : +v; W.changed(true); }, 'Loudness'))),
      card('Noise by hand, Audacity style', H('p', { className: 'hint', textContent: prof ? 'Learned from ' + prof.len + ' s of quiet. To learn it again, drag across a bit where you are not talking and press Learn.' : 'Drag across a bit where you are not talking (half a second or more), then press Learn noise. Like Audacity’s Noise Profile.' }),
        H('div', { className: 'btnrow' }, btn('Learn noise from the selection', learnNoise), prof ? btn(nr.on ? 'Turn off' : 'Turn on', () => { nr.on = !nr.on; if (nr.on) C.ai.on = false; W.changed(true); }) : ''),
        ...(prof ? [slider('Turn the noise down by', nr.reduce, 3, 36, 1, v => { nr.reduce = v; }, v => v + ' dB'), slider('Sensitivity', nr.sens, 0, 18, 0.5, v => { nr.sens = v; }, v => v + ' dB'), slider('Smoothing', nr.smooth, 0, 8, 1, v => { nr.smooth = v; }, v => v + ' bands')] : []),
        H('p', { className: 'hint', textContent: 'Used when the AI voice cleaner is off. Press Removed at the top to hear exactly what it takes out.' })),
      card('Send it on', H('div', { className: 'btnrow' }, btn('Use as my character’s voice', () => send('char'), 'primary'), btn('Add to the video', () => send('video')), btn('Save as WAV', () => send('wav'))),
        H('p', { className: 'hint', textContent: 'Sends the cleaned, edited sound. The recording itself is never changed.' })),
      card('Recording', H('label', { className: 'field au-micf', hidden: true }, H('span', { className: 'lab' }, 'Microphone'), H('select', { className: 'au-mic', 'aria-label': 'Microphone', on: { change: e => { try { localStorage.setItem('patter-mic', e.target.value); } catch (er) { } } } })),
        H('p', { className: 'hint', textContent: 'Talk a hand’s width from the microphone, a little to one side of it, in the softest room you have (curtains, a bed, a wardrobe of clothes). While it records, the bar beside the button should reach its last third when you talk and never touch the end. Recorded straight to a WAV with the browser’s own processing off.' })));
    ws.append(H('div', { className: 'au-body' }, left, side));
    wire(waveBox.querySelector('.au-wave')); paintRecBtn(); paintMics(); paintReport(); syncPlayBtn(); requestAnimationFrame(() => { draw(); panelInfo(); }); later();
    if (!W._ro) { W._ro = new ResizeObserver(() => { if (document.body.classList.contains('aud')) draw(); }); } W._ro.disconnect(); W._ro.observe(waveBox);
  }
  /* Studio voice: one switch that sets every stage (he asked for studio sound from a rough microphone, November 2026).
     It only writes settings; nothing is hidden, and each stage below can be changed afterwards. Off puts every stage
     back to nothing (a learned noise profile is kept). */
  async function setStudio(on) { const C = W.cfg.clean, st = on && typeof DeepFilter !== 'undefined' ? await DeepFilter.check() : 'none';
    if (on) { Object.assign(C, STUDIO()); C.eq.on = false; C.nr.on = false; C.ai = { on: st === 'ready', atten: 40 }; }
    else { const keep = C.nr && C.nr.profile, fresh = CLEAN0(); fresh.nr.profile = keep || null; Object.assign(C, fresh); }
    W.changed(true); say(!on ? 'Studio voice is off: the recording as it came in, with your cuts.' : st === 'ready' ? 'Studio voice is on.' : 'Studio voice is on. Get the AI voice cleaner (in Noise) for the background noise: it is the biggest single part.'); }
  /* What came in, in plain words: measured on the recording itself (VoiceFX.inspect, once a recording) and on the way
     through the chain (how much room there was, breaths found). Advice is about the two things no clean up fully mends:
     the level and the distance to the microphone. */
  function reportLines() {
    const cfg = W.cfg, r = W.insp && cfg && W.insp.id === cfg.src ? W.insp.r : null, f = cfg && proc.key === cleanKey(cfg) ? proc.info : null, out = []; if (!r) return out;
    const hz = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '') + ' kHz' : Math.round(v) + ' Hz';
    if (r.clipped) out.push(['warn', 'Too loud', r.clipped + ' peaks were cut flat. Sit back a little or turn the microphone down.']);
    else if (r.speech < -40) out.push(['warn', 'Very quiet', 'your voice sits at ' + Math.round(r.speech) + ' dB. Get closer or turn the microphone up: a quiet recording carries more hiss.']);
    else if (r.speech < -30) out.push(['mid', 'A little quiet', 'your voice sits at ' + Math.round(r.speech) + ' dB. A touch closer, or the microphone up a notch, gives the clean up less to do.']);
    else out.push(['ok', 'Level', 'good.']);
    out.push(r.snr >= 50 ? ['ok', 'Noise', 'very little.'] : r.snr >= 38 ? ['mid', 'Noise', 'some, ' + Math.round(r.snr) + ' dB under your voice.'] : ['warn', 'Noise', 'a lot, only ' + Math.round(r.snr) + ' dB under your voice.']);
    const nm = r.tones.filter(t => VoiceFX.onMains(t.f, r.mains)).length;
    if (r.tones.length) out.push(['warn', !nm ? 'A steady tone' : nm === r.tones.length ? 'Mains buzz' : 'Mains buzz and a whine', 'at ' + r.tones.slice().sort((a, b) => b.up - a.up).slice(0, 3).sort((a, b) => a.f - b.f).map(t => hz(t.f)).join(', ') + '.']); else out.push(['ok', 'Buzz', 'none.']);
    if (f && f.room) out.push(f.room.echo <= -22 ? ['ok', 'Room', 'close and dry.'] : f.room.echo <= -17 ? ['mid', 'Room', 'a little of the room in it.'] : ['warn', 'Room', 'a lot of echo. It is taken out as far as it will go; nearer the microphone is the real cure.']);
    if (f && f.breaths) out.push(['ok', 'Breaths', f.breaths + (W.cfg.clean.gate.breath >= 20 ? ' taken out.' : ' softened.')]);
    if (f && f.pops) out.push(['ok', 'Pops', f.pops + ' softened.']);
    return out;
  }
  function paintReport() { const { H } = UI, el = W.root && W.root.querySelector('.au-report'); if (!el) return; el.innerHTML = ''; const L = reportLines(); if (!L.length) return;
    el.append(H('div', { className: 'lab', textContent: 'What came in' }), ...L.map(([k, a, b]) => H('div', { className: 'au-rl ' + k }, H('i', {}), H('span', {}, H('b', { textContent: a + ': ' }), b)))); }
  /* The AI voice cleaner (DeepFilterNet 3): download once, then on or off and how much it may take away */
  function aiBox(C) {
    const { H, btn, field } = UI, box = H('div', {}), seg = (val, opts, fn) => H('div', { className: 'st-seg wrap' }, ...opts.map(([v, l]) => H('button', { type: 'button', className: String(v) === String(val) ? 'on' : '', textContent: l, on: { click: () => fn(v) } })));
    const draw2 = st => { box.innerHTML = '';
      box.append(H('p', { className: 'hint', textContent: 'The AI voice cleaner (DeepFilterNet 3) takes out fans, traffic, hiss and room noise and leaves your voice alone. Runs on this computer.' }));
      if (st !== 'ready') { const b = btn('Get the AI voice cleaner (about 30 MB, once)', async () => { b.disabled = true; try { await DeepFilter.download(q => { b.textContent = 'Downloading ' + Math.round(q * 100) + '%'; }); if (C.studio) { C.ai.on = true; C.ai.atten = 40; if (C.nr) C.nr.on = false; say('The AI voice cleaner is ready and switched on.'); W.changed(true); } else { draw2('ready'); say('The AI voice cleaner is ready. Turn it on below.'); } } catch (e) { b.disabled = false; b.textContent = 'Try the download again'; say(e.message || String(e)); } }, 'primary'); box.append(H('div', { className: 'btnrow' }, b)); return; }
      box.append(field('AI voice cleaner', seg(C.ai.on ? '1' : '0', [['1', 'On'], ['0', 'Off']], v => { C.ai.on = v === '1'; if (C.ai.on && C.nr) C.nr.on = false; W.changed(true); }), 'When it is on, the Audacity style remover further down is not used: one remover at a time sounds best.'));
      if (C.ai.on) box.append(field('How much it takes away', seg(String(C.ai.atten == null ? 20 : C.ai.atten), [['12', 'Gentle'], ['20', 'Natural'], ['30', 'Strong'], ['40', 'Thorough'], ['100', 'Everything']], v => { C.ai.atten = +v; W.changed(true); }), 'Thorough takes the noise right down and still protects quiet words (with the gaps turned down below, nothing is left to hear). Everything can chew words on a hard recording.'));
    };
    draw2(typeof DeepFilter !== 'undefined' ? DeepFilter.state : 'none'); if (typeof DeepFilter !== 'undefined' && DeepFilter.state === 'unknown') DeepFilter.check().then(draw2);
    return box;
  }
  function panelInfo() { const o = W.out; if (!o || !W.root) return; const n = W.root.querySelector('.au-name'); if (n) n.title = 'Loudness now about ' + AudioFX.lufs(o.y.length > SR * 120 ? o.y.subarray(0, SR * 120) : o.y, SR).toFixed(1) + ' LUFS'; }
  // keys while the tab is open: Space plays, Delete cuts out the selection, arrows nudge the playhead
  function key(e) {
    if (e.code === 'Space') { e.preventDefault(); toggle(); return true; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && W.sel) { e.preventDefault(); ACT.del(); return true; }
    const ctl = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (ctl && k === 'c' && W.sel) { e.preventDefault(); ACT.copy(); return true; }
    if (ctl && k === 'x' && W.sel) { e.preventDefault(); ACT.cut(); return true; }
    if (ctl && k === 'v' && W.clip) { e.preventDefault(); ACT.paste(); return true; }
    if (!ctl && k === 'b' && W.setMode) { e.preventDefault(); W.setMode(W.before ? 'a' : 'b'); return true; }
    if (e.key === 'Escape' && W.sel) { W.sel = null; draw(); return true; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); W.head = cl(nowT() + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 0.5), 0, outDur()); if (W.playing) play(W.head); else draw(); return true; }
    return false;
  }
  function activate(on) { document.body.classList.toggle('aud', !!on); const ws = document.getElementById('audioWs'); if (ws) ws.hidden = !on; if (!on) { stop(); if (W.rec) W.rec.stop(); } }
  const duration = cfg => { const o = W.out; return o && W.cfg === cfg ? Math.max(0.5, o.y.length / SR) : 1; };
  function draw0(g, t, cfg, look, Wd, Hd) { g.fillStyle = '#0a1120'; g.fillRect(0, 0, Wd, Hd); }
  return { id: 'audio', name: 'Audio', defaults, duration, draw: draw0, form, key, activate, hooks, send, STUDIO, _W: W, _proc: proc, _render: render, _segmentsOf: segmentsOf, _srcRanges: srcRanges };
})();

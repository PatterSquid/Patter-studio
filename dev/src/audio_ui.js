/* The Audio tab: his voice recording cleaned up and edited, then sent to the Character tab or the video.
   The recording stays as it was (cfg.src, a CutMedia file); the clean up settings (cfg.clean) and the edits (cfg.edits, in
   the recording's own seconds) are applied on top, so undo is the app's usual undo and nothing is ever lost.
   Workspace: a big waveform (or the frequencies) with the selection and playhead, Before/After, and the clean up and edit
   panels beside it. body.aud switches the layout; the module's form() draws the workspace, so undo redraws it. */
const AudioTab = (() => {
  const SR = 48000, MAXS = 30 * 60;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, r3 = v => Math.round(v * 1000) / 1000;
  const CLEAN0 = () => ({ rumble: true, hum: false, humHz: 50, declick: false, nr: { on: false, reduce: 12, sens: 6, smooth: 3, profile: null }, eq: { on: false, low: 0, mud: -2, pres: 2, air: 1.5 }, deess: 0, comp: 0, level: 0, loud: null });
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
  const proc = { key: '', y: null, res: null, job: 0 };
  // what goes into the noise reduction (so the noise is learned from the same sound it will be taken out of)
  function preNR(x, c) { let y = x; if (c.rumble !== false) y = AudioFX.rumble(y, SR, +c.rumbleHz || 80); if (c.hum) y = AudioFX.hum(y, SR, +c.humHz || 50); return y; }
  async function processed(cfg, onProgress) {
    const k = cleanKey(cfg); if (proc.key === k && proc.y) return proc.y; const job = ++proc.job, x = await loadRaw(cfg.src);
    const r = await AudioFX.chain(x, SR, cfg.clean || {}, onProgress, true), y = r.y;
    // what the noise removal took away, to listen to on its own ("Removed")
    let res = null; if (r.nrIn && r.nrOut) { res = new Float32Array(r.nrIn.length); for (let i = 0; i < res.length; i++) res[i] = r.nrIn[i] - (r.nrOut[i] || 0); }
    if (job === proc.job) { proc.key = k; proc.y = y; proc.res = res; } return y;
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
      if (!W.out || W.out.key !== cleanKey(cfg) + JSON.stringify(cfg.edits)) {
        setStatus('Working…', 0); const y = await processed(cfg, (q, s) => { if (job === renderJob) setStatus(s || 'Working…', q); }); if (job !== renderJob) return;
        W.out = Object.assign(render(y, cfg), { key: cleanKey(cfg) + JSON.stringify(cfg.edits) }); W.outRes = proc.res && proc.key === cleanKey(cfg) ? render(proc.res, cfg) : null; setStatus('', 1);
      }
      const d = outDur(); if (!(W.t1 > W.t0) || W.t1 > d + 0.01 || W.t0 >= d) { W.t0 = 0; W.t1 = d; } W.head = Math.min(W.head, d); specCache.key = ''; draw(); panelInfo();
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
  function syncPlayBtn() { const b = W.root && W.root.querySelector('.au-play'); if (b) b.textContent = W.playing ? '❚❚ Pause' : '▶ Play'; }

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
  function drawHead() {
    const cv = W.root && W.root.querySelector('.au-head'); if (!cv) return; const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); const t = nowT(); if (t < W.t0 || t > W.t1) return; const x = (t - W.t0) / (W.t1 - W.t0) * w; g.fillStyle = '#ff4f4f'; g.fillRect(Math.round(x), 0, 2, h);
    const info = W.root.querySelector('.au-time'); if (info && W.playing) info.textContent = fmt(t) + ' / ' + fmt(outDur());
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
    cfg.clean.nr = Object.assign({ reduce: 12, sens: 6, smooth: 3 }, cfg.clean.nr || {}, { on: true, profile: prof }); W.changed(true); say('Noise learned from ' + (long[1] - long[0]).toFixed(2) + ' s. It is now taken out of the whole recording.' + (long[1] - long[0] < 0.25 ? ' A longer quiet bit (half a second or more) learns it better.' : ''));
  }
  /* One press: rumble cut, hum only if there is some, the noise learned from the quietest half second and turned down by
     Audacity's gentle 12 dB, a light voice EQ, light de-essing, gentle compression and loudness for video. */
  async function cleanMyVoice() {
    const cfg = W.cfg; if (!cfg || !cfg.src) return; const x = await loadRaw(cfg.src), pre = preNR(x, Object.assign({}, cfg.clean, { rumble: true, hum: false })), q = AudioFX.quietest(pre, SR, 0.5), prof = AudioFX.profile(pre, SR, q[0], q[1]), humOn = AudioFX.hasHum(prof);
    cfg.clean = Object.assign(CLEAN0(), { rumble: true, hum: humOn, declick: false, nr: { on: true, reduce: 12, sens: 6, smooth: 3, profile: prof }, eq: Object.assign(CLEAN0().eq, { on: true }), deess: 0.3, comp: 0.4, level: 0, loud: -16 }); W.changed(true);
    say('Cleaned: rumble cut' + (humOn ? ', mains hum taken out' : '') + ', background noise turned down 12 dB (learned from the quietest half second, at ' + fmt(q[0]) + '), a light voice EQ, S sounds softened, gently compressed and set to a good loudness. Press Before to hear the difference, or Removed to hear only what was taken out.');
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
  async function record() {
    if (W.rec) { W.rec.stop(); return; }
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } }), mr = new MediaRecorder(s), parts = [], t0 = performance.now();
      mr.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      mr.onstop = async () => { s.getTracks().forEach(tr => tr.stop()); W.rec = null; clearInterval(W.recTimer); paintRecBtn(); const d = new Date(), name = 'Recording ' + d.toLocaleDateString('en-GB').replace(/\//g, '-') + ' ' + d.toTimeString().slice(0, 5).replace(':', '.') + '.webm'; await useFile(new File(parts, name, { type: mr.mimeType || 'audio/webm' })); };
      mr.start(500); W.rec = mr; W.recTimer = setInterval(() => { const b = W.root && W.root.querySelector('.au-rec'); if (b) b.textContent = '■ Stop recording ' + fmt((performance.now() - t0) / 1000).replace(/\.\d+$/, ''); }, 250); paintRecBtn(); say('Recording. Leave a couple of seconds of quiet at the start so the noise can be learned from it.');
    } catch (e) { say('Could not use the microphone: ' + (e.message || e)); }
  }
  function paintRecBtn() { const b = W.root && W.root.querySelector('.au-rec'); if (b) { b.textContent = W.rec ? '■ Stop recording' : '● Record'; b.classList.toggle('on', !!W.rec); } }

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
    W.cfg = cfg; W.changed = full => { changed(); if (full) form(root0, W.cfg, changed); else later(); }; cfg.clean = Object.assign(CLEAN0(), cfg.clean || {}); cfg.clean.nr = Object.assign(CLEAN0().nr, cfg.clean.nr || {}); cfg.clean.eq = Object.assign(CLEAN0().eq, cfg.clean.eq || {}); cfg.edits = Array.isArray(cfg.edits) ? cfg.edits : [];
    let ws = document.getElementById('audioWs'); if (!ws) { ws = H('div', { id: 'audioWs' }); document.querySelector('main').append(ws); }
    W.root = ws; ws.innerHTML = ''; const C = cfg.clean;
    const fileIn = H('input', { type: 'file', accept: 'audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov' }); fileIn.style.display = 'none'; fileIn.addEventListener('change', () => { const f = fileIn.files && fileIn.files[0]; if (f) useFile(f); fileIn.value = ''; });
    const seg = (val, opts, fn) => H('div', { className: 'st-seg wrap' }, ...opts.map(([v, l]) => H('button', { type: 'button', className: String(v) === String(val) ? 'on' : '', textContent: l, on: { click: () => fn(v) } })));
    const slider = (label, val, min, max, step, fn, show) => { const out = H('span', { className: 'au-val', textContent: show(val) }); return H('label', { className: 'field au-sl' }, H('span', { className: 'lab' }, label, out), H('input', { type: 'range', min, max, step, value: val, on: { input: e => { out.textContent = show(+e.target.value); }, change: e => { fn(+e.target.value); W.changed(true); } } })); };
    // Before, After, and Removed (only what the noise removal took away: there should be no words in it)
    const mode = () => W.before ? 'b' : W.removed ? 'r' : 'a';
    const ab = m => H('button', { type: 'button', className: 'au-ab' + (mode() === m ? ' on' : ''), 'data-m': m, textContent: { b: 'Before', a: 'After', r: 'Removed' }[m], title: { b: 'Hear it as recorded, with your cuts (B swaps)', a: 'Hear it cleaned up (B swaps)', r: 'Hear only what the noise removal takes out. If you can hear words in it, turn the noise removal down.' }[m],
      on: { click: () => setMode(m) } });
    W.setMode = m => { if (m === 'r' && !W.outRes) { say('Turn on noise removal first; then Removed lets you hear what it takes out.'); return; } const t = nowT(), was = W.playing; W.before = m === 'b'; W.removed = m === 'r'; specCache.key = ''; ws.querySelectorAll('.au-ab').forEach(b => b.classList.toggle('on', b.dataset.m === m)); draw(); if (was) play(Math.min(t, outDur())); };
    const setMode = m => W.setMode(m);
    // the top bar
    ws.append(H('div', { className: 'au-bar' },
      H('div', { className: 'au-name', textContent: cfg.src ? (cfg.name || 'Recording') : 'No recording yet' }),
      btn('Open a recording', () => fileIn.click()), H('button', { type: 'button', className: 'au-rec', textContent: '● Record', on: { click: record } }), fileIn,
      H('span', { className: 'au-sp' }),
      H('button', { type: 'button', className: 'au-play primary', textContent: '▶ Play', title: 'Play or pause (Space)', on: { click: toggle } }),
      H('div', { className: 'au-abw' }, ab('b'), ab('a'), ab('r')),
      H('span', { className: 'au-time' }),
      H('span', { className: 'au-sp' }),
      seg(W.view, [['wave', 'Waveform'], ['spec', 'Frequencies']], v => { W.view = v; ws.querySelectorAll('.au-bar .st-seg button').forEach(b => b.classList.toggle('on', b.textContent === (v === 'wave' ? 'Waveform' : 'Frequencies'))); draw(); }),
      btn('－', () => zoom(1.6)), btn('＋', () => zoom(1 / 1.6)), btn('Whole thing', () => { W.t0 = 0; W.t1 = outDur(); draw(); })));
    const waveBox = H('div', { className: 'au-wbox' }, H('canvas', { className: 'au-wave', 'aria-label': 'The recording: drag to choose a part, click to place the playhead' }), H('canvas', { className: 'au-head' }));
    const overCv = H('canvas', { className: 'au-over', title: 'The whole recording: click to jump there' });
    overCv.addEventListener('pointerdown', ev => { const r = overCv.getBoundingClientRect(), d = outDur(), span = W.t1 - W.t0, c = (ev.clientX - r.left) / r.width * d; W.t0 = cl(c - span / 2, 0, Math.max(0, d - span)); W.t1 = W.t0 + span; draw(); });
    const tb = (l, f, tip) => { const b = btn(l, f); b.title = tip; return b; };
    const edits = H('div', { className: 'au-edits' }, H('span', { className: 'lab' }, 'Selection'), tb('Cut out', ACT.del, 'Delete: take it out and close the gap'), tb('Cut', ACT.cut, 'Ctrl+X: take it out, ready to paste somewhere else'), tb('Copy', ACT.copy, 'Ctrl+C'), tb('Paste', ACT.paste, 'Ctrl+V: put what you copied at the playhead'),
      tb('Make quiet', ACT.sil, 'Silence it, keeping the length'), tb('Keep only this', ACT.keep, 'Cut out everything else'), tb('Fade in', ACT.fin, ''), tb('Fade out', ACT.fout, ''), tb('Amplify…', ACT.amplify, 'Louder or quieter by an exact number of dB'), tb('Normalise', ACT.normalise, 'Make the loudest peak -1 dB (the selection, or everything when nothing is selected)'),
      H('span', { className: 'au-sp' }), tb('Tighten long pauses', ACT.tighten, 'Shortens pauses longer than 0.7 s'), cfg.edits.length ? tb('Undo all cuts', ACT.reset, 'Takes every cut and edit off (the clean up stays). Ctrl+Z undoes one at a time.') : '');
    const left = H('div', { className: 'au-main' }, waveBox, overCv, edits, H('div', { className: 'au-foot' }, H('span', { className: 'au-status' }), H('span', { className: 'au-say', 'aria-live': 'polite' })));
    // the clean up panel
    const nr = C.nr, prof = nr.profile;
    const side = H('div', { className: 'au-side' },
      card('Clean up', H('button', { type: 'button', className: 'primary au-big', textContent: '✨ Clean my voice', title: 'Cuts rumble and hum, learns the noise from the quietest bit and takes it out, fixes clicks, softens S sounds, evens it out and sets the loudness', on: { click: cleanMyVoice } }),
        H('p', { className: 'hint', textContent: 'One press does the lot. Then fine tune below, and use Before and After to hear the difference.' })),
      card('Background noise', H('p', { className: 'hint', textContent: prof ? 'Learned from ' + prof.len + ' s of quiet. To learn it again, drag across a bit where you are not talking and press Learn.' : 'Drag across a bit where you are not talking (half a second or more), then press Learn noise. Like Audacity’s Noise Profile.' }),
        H('div', { className: 'btnrow' }, btn('Learn noise from the selection', learnNoise, prof ? '' : 'primary'), prof ? btn(nr.on ? 'Turn off' : 'Turn on', () => { nr.on = !nr.on; W.changed(true); }) : ''),
        ...(prof ? [slider('Turn the noise down by', nr.reduce, 3, 36, 1, v => { nr.reduce = v; }, v => v + ' dB'), slider('Sensitivity', nr.sens, 0, 18, 0.5, v => { nr.sens = v; }, v => v + ' dB'), slider('Smoothing', nr.smooth, 0, 8, 1, v => { nr.smooth = v; }, v => v + ' bands')] : []),
        H('p', { className: 'hint', textContent: 'Press Removed at the top to hear exactly what it takes out. If you can hear words in it, turn it down.' })),
      card('Voice', field('Voice EQ', seg(C.eq.on ? '1' : '0', [['1', 'On'], ['0', 'Off']], v => { C.eq.on = v === '1'; W.changed(true); }), 'A little less boxiness, a little more presence and air.'),
        ...(C.eq.on ? [slider('Boom (120 Hz)', C.eq.low, -6, 6, 0.5, v => { C.eq.low = v; }, v => (v > 0 ? '+' : '') + v + ' dB'), slider('Boxiness (320 Hz)', C.eq.mud, -8, 4, 0.5, v => { C.eq.mud = v; }, v => (v > 0 ? '+' : '') + v + ' dB'), slider('Presence (3.5 kHz)', C.eq.pres, -4, 8, 0.5, v => { C.eq.pres = v; }, v => (v > 0 ? '+' : '') + v + ' dB'), slider('Air (10 kHz and up)', C.eq.air, -4, 8, 0.5, v => { C.eq.air = v; }, v => (v > 0 ? '+' : '') + v + ' dB')] : []),
        slider('Compressor (punch, even level)', C.comp || 0, 0, 1, 0.05, v => { C.comp = v; }, v => v ? Math.round(v * 100) + '%' : 'Off')),
      card('Tidy up',
        field('Rumble (traffic, desk knocks)', seg(C.rumble !== false ? '1' : '0', [['1', 'Cut'], ['0', 'Keep']], v => { C.rumble = v === '1'; W.changed(true); })),
        field('Mains hum', seg(C.hum ? '1' : '0', [['1', 'Take out (50 Hz)'], ['0', 'Leave']], v => { C.hum = v === '1'; W.changed(true); })),
        field('Clicks and pops', seg(C.declick ? '1' : '0', [['1', 'Fix'], ['0', 'Leave']], v => { C.declick = v === '1'; W.changed(true); })),
        slider('Soften harsh S sounds', C.deess || 0, 0, 1, 0.05, v => { C.deess = v; }, v => v ? Math.round(v * 100) + '%' : 'Off'),
        slider('Slow leveller (long changes in level)', C.level || 0, 0, 1, 0.05, v => { C.level = v; }, v => v ? Math.round(v * 100) + '%' : 'Off'),
        field('Loudness', sel(C.loud == null ? '' : String(C.loud), [['', 'As recorded'], ['-16', 'Voice for video (-16 LUFS)'], ['-14', 'YouTube loud (-14 LUFS)'], ['-19', 'Quieter (-19 LUFS)']], v => { C.loud = v === '' ? null : +v; W.changed(true); }, 'Loudness'))),
      card('Send it on', H('div', { className: 'btnrow' }, btn('Use as my character’s voice', () => send('char'), 'primary'), btn('Add to the video', () => send('video')), btn('Save as WAV', () => send('wav'))),
        H('p', { className: 'hint', textContent: 'Sends the cleaned, edited sound. The recording itself is never changed.' })));
    ws.append(H('div', { className: 'au-body' }, left, side));
    wire(waveBox.querySelector('.au-wave')); paintRecBtn(); syncPlayBtn(); requestAnimationFrame(() => { draw(); panelInfo(); }); later();
    if (!W._ro) { W._ro = new ResizeObserver(() => { if (document.body.classList.contains('aud')) draw(); }); } W._ro.disconnect(); W._ro.observe(waveBox);
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
  return { id: 'audio', name: 'Audio', defaults, duration, draw: draw0, form, key, activate, hooks, send, _W: W, _render: render, _segmentsOf: segmentsOf, _srcRanges: srcRanges };
})();

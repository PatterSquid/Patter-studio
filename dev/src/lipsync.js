/* LipSync: from a voice recording (and its script, when there is one) to mouth shapes, word timings and how loud he is
   moment to moment. No outside libraries or models.
   With a script: the words are turned into the twelve Character Animator mouth shapes by English spelling rules (plus
   a list of common and Glaswegian words that do not follow them), then lined up against the sound with a forced
   alignment (Viterbi over the sounds in order, each scored on loudness, hiss and voicing, kept near the straight line
   through the speech). Without a script: the shapes are guessed from the sound alone. Square bracket tags in the script
   ([angry], [point]) are taken out of the words and come back with the time of the word they sit before. */
const LipSync = (() => {
  const SR = 16000, HOP = 160, WIN = 512, FPS = SR / HOP;   // 100 frames a second
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------- words to mouth shapes ---------- */
  const EX = { the: 'thuh', a: 'uh', of: 'ov', to: 'too', do: 'doo', you: 'yoo', your: 'yor', one: 'wun', two: 'too', once: 'wuns', was: 'woz', what: 'wot', who: 'hoo', are: 'ar', were: 'wur', said: 'sed', says: 'sez',
    have: 'hav', give: 'giv', live: 'liv', love: 'luv', come: 'kum', some: 'sum', done: 'dun', gone: 'gon', none: 'nun', could: 'kood', would: 'wood', should: 'shood', people: 'peepul', eye: 'I', i: 'I', aye: 'I',
    my: 'mI', by: 'bI', buy: 'bI', bye: 'bI', why: 'wI', ok: 'ohkay', okay: 'ohkay', there: 'ther', where: 'wer', their: 'ther', they: 'thay', been: 'bin', any: 'enee', many: 'menee', does: 'duz', great: 'grayt',
    eight: 'ayt', know: 'no', now: 'nO', how: 'hO', down: 'dOn', out: 'Ot', about: 'uhbOt', our: 'Or', hour: 'Or', though: 'tho', through: 'throo', enough: 'enuf', laugh: 'laf', tough: 'tuf', rough: 'ruf',
    is: 'iz', as: 'az', his: 'hiz', has: 'haz', o: 'oh', oh: 'oh', ye: 'yee', wis: 'wiz', heid: 'heed', hame: 'haym', fae: 'fay', tae: 'tay', awright: 'awrIt', polis: 'pohlis', mair: 'mayr', wan: 'wan', yin: 'yin',
    want: 'wont', water: 'wawter', world: 'wurld', work: 'wurk', word: 'wurd', women: 'wimin', woman: 'wuman', money: 'munee', mother: 'muther', other: 'uther', another: 'unuther', brother: 'bruther', nothing: 'nuthing',
    something: 'sumthing', young: 'yung', country: 'kuntree', front: 'frunt', month: 'munth', wonder: 'wunder', son: 'sun', ton: 'tun', won: 'wun', mr: 'mister', mrs: 'misiz', uk: 'yookay', tv: 'teevee', bbc: 'beebeesee', snp: 'esenpee' };
  const V = 'V', G = 'G', N = 'N', B = 'B', T = 'T', S = 'S', F = 'F';
  const u = (v, k) => ({ v, k }), AA = u('Aa', V), EE = u('Ee', V), OH = u('Oh', V), UH = u('Uh', V), WO = u('W-Oo', V);
  const DIG = [['tch', [u('S', S)]], ['igh', [AA, EE]], ['tion', [u('S', S), UH, u('D', N)]], ['sion', [u('S', S), UH, u('D', N)]], ['sch', [u('S', S), u('D', T)]],
    ['ch', [u('S', S)]], ['sh', [u('S', S)]], ['th', [u('L', F)]], ['ph', [u('F', F)]], ['gh', []], ['ck', [u('D', T)]], ['ng', [u('D', N)]], ['nk', [u('D', N), u('D', T)]], ['qu', [u('D', T), u('W-Oo', G)]],
    ['wh', [u('W-Oo', G)]], ['wr', [u('R', G)]], ['ee', [EE]], ['ea', [EE]], ['ie', [EE]], ['ey', [EE]], ['ei', [EE]], ['ae', [EE]], ['oo', [WO]], ['ou', [AA, WO]], ['ow', [AA, WO]], ['oa', [OH]], ['oe', [OH]],
    ['ai', [EE]], ['ay', [EE]], ['au', [OH]], ['aw', [OH]], ['oi', [OH, EE]], ['oy', [OH, EE]], ['ue', [WO]], ['ew', [WO]], ['ar', [AA, u('R', G)]], ['er', [u('R', G)]], ['ir', [u('R', G)]], ['ur', [u('R', G)]], ['or', [OH, u('R', G)]]];
  const ONE = { a: [AA], e: [EE], i: [EE], o: [OH], u: [UH], b: [u('M', B)], p: [u('M', B)], m: [u('M', N)], f: [u('F', F)], v: [u('F', F)], s: [u('S', S)], z: [u('S', S)], x: [u('D', T), u('S', S)],
    j: [u('S', S)], g: [u('D', T)], d: [u('D', T)], t: [u('D', T)], k: [u('D', T)], q: [u('D', T)], n: [u('D', N)], h: [u('D', F)], l: [u('L', G)], r: [u('R', G)], w: [u('W-Oo', G)], I: [AA, EE], O: [AA, WO] };
  const isV = c => /[aeiouy]/.test(c);
  function spell(w) {
    const out = []; let s = w;
    if (s.length > 2 && /[^aeiou]e$/.test(s) && !/[^aeiou]le$/.test(s)) s = s.slice(0, -1) + '#';   // silent final e (marks the vowel before it long)
    if (/[^aeiou]le$/.test(s)) s = s.slice(0, -2) + 'L';
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (c === '#') { i++; continue; }
      if (c === 'L') { out.push(UH, u('L', G)); i++; continue; }
      if (i === 0 && s.startsWith('kn')) { out.push(u('D', N)); i += 2; continue; }
      const dg = DIG.find(d => s.startsWith(d[0], i)); if (dg) { out.push(...dg[1]); i += dg[0].length; continue; }
      if (c === s[i - 1] && !isV(c)) { i++; continue; }   // double letters
      if (c === 'h' && !/[aeiouy]/.test(s[i + 1] || '')) { i++; continue; }   // h is only heard before a vowel
      if (c === 'c') { out.push(/[eiy]/.test(s[i + 1] || '') ? u('S', S) : u('D', T)); i++; continue; }
      if (c === 'y') { const mono = !/[aeiou]/.test(s.slice(0, i)) && i > 0 && i === s.length - 1; out.push(...(i === 0 ? [u('Ee', G)] : mono ? [AA, EE] : [EE])); i++; continue; }
      if (/[aeiou]/.test(c) && s[i + 2] === '#' && !isV(s[i + 1] || '')) { out.push(...({ a: [EE], e: [EE], i: [AA, EE], o: [OH], u: [WO] })[c]); i++; continue; }   // magic e
      if (c === 'e' && i === s.length - 2 && s[i + 1] === 'd' && !/[td]/.test(s[i - 1] || '')) { i++; continue; }   // -ed: just d
      out.push(...(ONE[c] || [])); i++;
    }
    return out;
  }
  const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function numWords(n) { if (n < 20) return NUM[n]; if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + NUM[n % 10] : ''); if (n < 1000) return NUM[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numWords(n % 100) : '');
    if (n < 1e6) return numWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? (n % 1000 < 100 ? ' and ' : ' ') + numWords(n % 1000) : ''); return String(n).split('').map(d => NUM[+d]).join(' '); }
  // the script: words (with where each came from) and the tags between them
  function parse(script) {
    const words = [], tags = []; const src = String(script || '');
    const re = /\[([^\]]{1,40})\]|([^\s\[\]]+)/g; let m;
    while ((m = re.exec(src))) {
      if (m[1] != null) { tags.push({ tag: m[1].trim().toLowerCase(), word: words.length }); continue; }
      let raw = m[2], t = raw.toLowerCase().replace(/[’']/g, "'").replace(/&/g, ' and ').replace(/%/g, ' percent').replace(/£(\d)/g, '$1 pound ').replace(/\$(\d)/g, '$1 dollar ');
      t = t.replace(/\d+/g, d => ' ' + numWords(+d.slice(0, 9)) + ' ');
      const pause = /[.!?;:,—–-]$/.test(raw);
      t.split(/\s+/).map(x => x.replace(/[^a-z']/g, '')).filter(Boolean).forEach((x, i, all) => { words.push({ text: i === 0 ? raw : '', w: x, pause: pause && i === all.length - 1 }); });
    }
    words.forEach(W => { const key = W.w.replace(/'/g, ''); const ex = EX[key]; W.units = (ex ? ex.split(' ').flatMap(spell) : spell(key.replace(/'s$/, 's'))); if (!W.units.length) W.units = [UH]; });
    return { words, tags };
  }

  /* ---------- the sound ---------- */
  function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, xr = re[q] * cr - im[q] * ci, xi = re[q] * ci + im[q] * cr; re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
  function features(x) {
    // power in 24 bands per frame; the background noise (the quietest frames, band by band) is taken off before anything is measured
    const n = Math.max(1, Math.floor((x.length - WIN) / HOP) + 1), NB = 24, P = new Float32Array(n * NB), zc = new Float32Array(n), re = new Float32Array(WIN), im = new Float32Array(WIN), hann = new Float32Array(WIN);
    for (let i = 0; i < WIN; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1));
    const edge = []; for (let k = 0; k <= NB; k++) edge.push(Math.round(2 + (WIN / 2 - 2) * Math.pow(k / NB, 1.6)));   // narrower bands low down
    const hz = k => k * SR / WIN;
    for (let f = 0; f < n; f++) {
      const o = f * HOP; let z = 0, prev = x[o] || 0;
      for (let i = 0; i < WIN; i++) { const v = x[o + i] || 0; if ((v >= 0) !== (prev >= 0)) z++; prev = v; re[i] = v * hann[i]; im[i] = 0; }
      zc[f] = z / WIN; fft(re, im);
      for (let b = 0; b < NB; b++) { let s = 0; for (let k = edge[b]; k < edge[b + 1]; k++) s += re[k] * re[k] + im[k] * im[k]; P[f * NB + b] = s; }
    }
    const noise = new Float32Array(NB), tmp = new Float32Array(n); for (let b = 0; b < NB; b++) { for (let f = 0; f < n; f++) tmp[f] = P[f * NB + b]; const srt = Array.from(tmp).sort((a, c) => a - c); noise[b] = srt[Math.floor(n * 0.1)] * 1.6; }
    const db = new Float32Array(n), hf = new Float32Array(n), lf = new Float32Array(n), raw = new Float32Array(n);
    for (let f = 0; f < n; f++) { let all = 0, lo = 0, hi = 0, tot = 0; for (let b = 0; b < NB; b++) { const v0 = P[f * NB + b], v = Math.max(0, v0 - noise[b]); tot += v0; all += v; const mid = hz((edge[b] + edge[b + 1]) / 2); if (mid < 1000) lo += v; else if (mid >= 3000) hi += v; }
      db[f] = 10 * Math.log10(all / WIN + 1e-10); raw[f] = 10 * Math.log10(tot / WIN + 1e-10); hf[f] = all > 0 ? hi / all : 0; lf[f] = all > 0 ? lo / all : 0; }
    let noiseDb = 10 * Math.log10(noise.reduce((a, c) => a + c, 0) / 1.6 / WIN + 1e-10);
    const sorted = Array.from(db).sort((a, c) => a - c), peak = sorted[Math.min(n - 1, Math.floor(n * 0.98))], floor = Math.max(sorted[Math.floor(n * 0.08)], peak - 45), span = Math.max(12, peak - floor);
    const en = new Float32Array(n); for (let f = 0; f < n; f++) en[f] = cl((db[f] - floor - 3) / (span - 3), 0, 1);
    const sm = a => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = ((a[i - 1] ?? a[i]) + 2 * a[i] + (a[i + 1] ?? a[i])) / 4; return o; };
    // voicing from the crossing rate, trusted less where the noise is close to the speech
    const voi = new Float32Array(n); for (let f = 0; f < n; f++) { const snr = cl((raw[f] - noiseDb) / 15, 0, 1); voi[f] = cl(1 - (zc[f] - 0.06) / 0.2, 0, 1) * snr + 0.5 * (1 - snr); }
    // level without the ceiling, for finding the stressed syllables
    const top = sorted[n - 1], lev = new Float32Array(n); for (let f = 0; f < n; f++) lev[f] = cl((db[f] - floor) / Math.max(12, top - floor), 0, 1);
    return { n, en: sm(en), hf: sm(hf), lf: sm(lf), voi: sm(voi), lev: sm(sm(lev)), noiseDb, peakDb: peak };
  }
  const COST = {
    sil: (e) => 4 * e + (e < 0.12 ? 0 : 1),
    V: (e, h, l, v) => 3 * (1 - e) + 1.6 * h + 0.8 * (1 - v),
    G: (e, h, l, v) => 2.2 * Math.abs(e - 0.62) + 1.6 * h + 0.8 * (1 - v),
    N: (e, h, l, v) => 2.2 * Math.abs(e - 0.45) + 2 * h + 1.2 * (1 - l),
    B: (e) => 3.2 * e,
    T: (e, h) => 2 * Math.abs(e - 0.28) + 0.6 * Math.abs(h - 0.3),
    S: (e, h, l, v) => 3.2 * (1 - Math.min(1, h * 1.5)) + 1.2 * v + (e < 0.06 ? 1.5 : 0),
    F: (e, h) => 2 * Math.abs(e - 0.3) + 1.6 * Math.abs(h - 0.35),
  };
  // how long each kind of sound lasts, in frames (10 ms): least, usual, most
  const DUR = { V: [4, 9, 26], G: [3, 6, 14], N: [3, 7, 14], B: [3, 6, 13], T: [2, 5, 11], S: [4, 10, 22], F: [3, 7, 15] };

  /* ---------- forced alignment ----------
     Every sound is a chain of frames between its least and most length: it must pass its least, may leave from any frame
     after that, and past its most it can only stay at a cost. Between words there may be a silence of any length. The
     search is kept to a band around where the speech so far says we are. */
  function align(ft, words) {
    const st = [], units = [], uFirst = [];   // st: { k, unit, j (frame within the sound), M, m, opt }
    const addSil = (word) => { st.push({ k: 'sil', unit: null, word, j: 0, m: 1, M: 1, opt: true }); };
    addSil(-1);
    words.forEach((W, wi) => { W.units.forEach((U, i) => { const d = DUR[U.k] || DUR.T, diph = i > 0 && U.k === V && W.units[i - 1].k === V; const m = diph ? Math.max(2, d[0] - 1) : d[0], M = diph ? Math.round(d[2] * 0.7) : d[2];
      const ui = units.length; units.push({ v: U.v, k: U.k, word: wi, typ: d[1] }); uFirst.push(st.length); for (let j = 0; j < M; j++) st.push({ k: U.k, unit: ui, word: wi, j, m, M }); });
      addSil(wi); });
    const S = st.length, T = ft.n, nU = units.length;
    // where each state sits along the script, as a fraction of the usual total length
    const usual = units.reduce((a, q) => a + q.typ, 0) || 1, frac = new Float32Array(S); { let acc = 0, last = -1; for (let s = 0; s < S; s++) { const q = st[s]; if (q.unit != null && q.unit !== last) { if (last >= 0) acc += units[last].typ; last = q.unit; } frac[s] = (acc + (q.unit != null ? Math.min(q.j, units[q.unit].typ) : 0)) / usual; } }
    const cum = new Float32Array(T + 1); for (let t = 0; t < T; t++) cum[t + 1] = cum[t] + (ft.en[t] > 0.15 ? 1 : 0.05);
    const band = Math.min(0.5, Math.max(0.06, 1.6 / Math.sqrt(Math.max(1, nU)))), lo = new Int32Array(T), hi = new Int32Array(T);
    { let a = 0, b = 0; for (let t = 0; t < T; t++) { const c = cum[t + 1] / cum[T]; while (a < S - 1 && frac[a] < c - band) a++; while (b < S - 1 && frac[b + 1] <= c + band) b++; lo[t] = a; hi[t] = Math.max(a, b); } }
    lo[0] = 0; hi[T - 1] = S - 1; for (let t = T - 2; t >= 0; t--) if (hi[t] < hi[t + 1] - 2 * (DUR.V[2] + 4)) hi[t] = Math.max(hi[t], 0);
    let Wd = 1; for (let t = 0; t < T; t++) Wd = Math.max(Wd, hi[t] - lo[t] + 1);
    const back = new Int32Array(T * Wd).fill(-1), INF = 1e18; let prev = new Float64Array(Wd).fill(INF), cur = new Float64Array(Wd);
    const emit = (s, t) => { const q = st[s], e = ft.en[t], h = ft.hf[t], l = ft.lf[t], v = ft.voi[t]; return q.k === 'sil' ? COST.sil(e) : COST[q.k](e, h, l, v); };
    const canExit = q => q.k === 'sil' || q.j >= q.m - 1;
    const OVER = 0.35, SILSTAY = 0;
    const get = (t, s) => (s >= lo[t] && s <= hi[t]) ? prev[s - lo[t]] : INF;   // prev holds frame t (the one before the one being filled)
    prev.fill(INF); if (lo[0] === 0) prev[0] = emit(0, 0); if (hi[0] >= uFirst[0] && nU) prev[uFirst[0]] = emit(uFirst[0], 0);
    for (let t = 1; t < T; t++) {
      cur.fill(INF);
      for (let s = lo[t]; s <= hi[t]; s++) {
        const q = st[s]; let best = INF, from = -1;
        const tryFrom = (r, extra) => { if (r < 0) return; const c = get(t - 1, r); if (c + extra < best) { best = c + extra; from = r; } };
        if (q.k === 'sil') { tryFrom(s, SILSTAY); /* into a silence from the end of the word before */ for (let r = s - 1; r >= 0 && st[r].unit === st[s - 1].unit && st[r].k !== 'sil'; r--) if (canExit(st[r])) tryFrom(r, 0); if (s === 0) { } }
        else if (q.j > 0) { tryFrom(s - 1, 0); if (q.j === q.M - 1) tryFrom(s, OVER); }
        else {   // the first frame of a sound: from any frame of the sound before that may end, or from a silence before it
          if (q.M === 1) tryFrom(s, OVER);
          let r = s - 1; if (r >= 0 && st[r].k === 'sil') { tryFrom(r, 0); r--; }
          const pu = r >= 0 ? st[r].unit : null; if (pu != null) for (let x = r; x >= 0 && st[x].unit === pu; x--) if (canExit(st[x])) tryFrom(x, 0);
        }
        if (best < INF) { cur[s - lo[t]] = best + emit(s, t); back[t * Wd + (s - lo[t])] = from; }
      }
      const tmp = prev; prev = cur; cur = tmp;
      // swap the per-frame window: prev now belongs to frame t
    }
    // finish in the last silence, or any frame of the last sound that may end
    let s = -1, bc = INF; const tl = T - 1; for (let r = S - 1; r >= 0 && (r === S - 1 || st[r].unit === nU - 1); r--) { if (!canExit(st[r])) continue; const c = (r >= lo[tl] && r <= hi[tl]) ? prev[r - lo[tl]] : INF; if (c < bc) { bc = c; s = r; } }
    if (s < 0) s = S - 1;
    const path = new Int32Array(T); for (let t = T - 1; t >= 0; t--) { path[t] = s; if (t > 0) { const f = (s >= lo[t] && s <= hi[t]) ? back[t * Wd + (s - lo[t])] : -1; s = f >= 0 ? f : s; } }
    return { path, st, units };
  }

  // frames to segments: [t0, t1, unitIndex or -1 for silence]
  function segments(al) { const out = []; let cur = null; for (let t = 0; t < al.path.length; t++) { const q = al.st[al.path[t]], key = q.unit == null ? -1 : q.unit; if (!cur || cur[2] !== key) { cur = [t / FPS, (t + 1) / FPS, key]; out.push(cur); } else cur[1] = (t + 1) / FPS; } return out; }

  /* ---------- shapes from sound alone (no script) ---------- */
  function guess(ft) {
    const out = []; for (let t = 0; t < ft.n; t++) { const e = ft.en[t], h = ft.hf[t], l = ft.lf[t]; let v = 'Neutral';
      if (e < 0.12) v = 'Neutral'; else if (h > 0.42 && ft.voi[t] < 0.6) v = 'S'; else if (e > 0.68) v = l > 0.82 ? 'Oh' : 'Aa'; else if (e > 0.42) v = h > 0.16 ? 'Ee' : (l > 0.85 ? 'W-Oo' : 'Uh'); else v = 'D';
      out.push(v); }
    // dips between syllables close the lips briefly
    for (let t = 2; t < ft.n - 2; t++) if (ft.en[t] > 0.12 && ft.en[t] < ft.en[t - 2] * 0.55 && ft.en[t] < ft.en[t + 2] * 0.55) out[t] = 'M';
    const seg = []; out.forEach((v, t) => { const last = seg[seg.length - 1]; if (last && last[1] === v) return; seg.push([t / FPS, v]); });
    return seg;
  }

  /* ---------- tidy the shapes: lead the sound a touch, drop flickers, keep lip closures ---------- */
  function tidy(list, lead) {
    let s = list.map(([t, v]) => [Math.max(0, t - lead), v]);
    for (let pass = 0; pass < 2; pass++) {
      const out = [];
      for (let i = 0; i < s.length; i++) { const len = (s[i + 1] ? s[i + 1][0] : s[i][0] + 1) - s[i][0], min = s[i][1] === 'M' ? 0.04 : s[i][1] === 'Neutral' ? 0.07 : 0.055;
        if (len < min && out.length && i < s.length - 1) continue; if (out.length && out[out.length - 1][1] === s[i][1]) continue; out.push(s[i]); }
      s = out;
    }
    return s;
  }

  function analyse(x, script) {
    const ft = features(x), dur = x.length / SR, P = parse(script), env = ft.en, lev = ft.lev;
    if (!P.words.length) return { visemes: tidy(guess(ft), 0.03), words: [], tags: [], env, lev, fps: FPS, dur, script: false };
    const al = align(ft, P.words), seg = segments(al), vis = [], wt = P.words.map(() => [Infinity, -Infinity]);
    seg.forEach(([a, b, k]) => {
      if (k < 0) { vis.push([a, 'Neutral']); return; }
      const U = al.units[k]; let v = U.v;
      if (U.k === V) { let m = 0, c = 0; for (let t = Math.floor(a * FPS); t < Math.min(ft.n, Math.ceil(b * FPS)); t++) { m += ft.en[t]; c++; } m /= Math.max(1, c); if (v === 'Aa' && m < 0.38) v = 'Uh'; if (m < 0.18 && v !== 'Oh' && v !== 'W-Oo') v = 'D'; }
      vis.push([a, v]); const w = wt[U.word]; w[0] = Math.min(w[0], a); w[1] = Math.max(w[1], b);
    });
    const words = P.words.map((W, i) => [wt[i][0], wt[i][1], W.text || W.w, i, W.w]).filter(w => isFinite(w[0]));
    const at = i => { const w = wt[i]; if (w && isFinite(w[0])) return w[0]; const p = wt[i - 1]; return p && isFinite(p[1]) ? p[1] : 0; };
    const tags = P.tags.map(g => ({ tag: g.tag, word: g.word, t: g.word >= P.words.length ? (wt.length ? Math.max(0, ...wt.map(w => isFinite(w[1]) ? w[1] : 0)) : dur) : at(g.word) }));
    return { visemes: tidy(vis, 0.035), words, tags, env, lev, fps: FPS, dur, script: true };
  }
  // No recording yet: time the script at a steady talking pace, so he can be seen saying it (the timing is a guess)
  function fromText(script, rate) {
    const P = parse(script), k = 1 / (rate || 1), vis = [], words = []; let t = 0.3;
    P.words.forEach((W, i) => { const a = t; W.units.forEach(U => { vis.push([t, U.v]); t += (DUR[U.k] || DUR.T)[1] * 0.0105 * k; }); words.push([a, t, W.text || W.w, i, W.w]); t += W.pause ? 0.32 * k : 0.04 * k; if (W.pause) vis.push([t - 0.3 * k, 'Neutral']); });
    const dur = t + 0.3, n = Math.ceil(dur * FPS), env = new Float32Array(n);
    words.forEach(w => { for (let f = Math.floor(w[0] * FPS); f < Math.min(n, w[1] * FPS); f++) env[f] = 0.55 + 0.35 * Math.sin((f - w[0] * FPS) / Math.max(1, (w[1] - w[0]) * FPS) * Math.PI); });
    const at = i => i < words.length ? words[i][0] : t;
    return { visemes: tidy(vis.sort((a, b) => a[0] - b[0]), 0), words, tags: P.tags.map(g => ({ tag: g.tag, word: g.word, t: at(g.word) })), env, lev: env, fps: FPS, dur, script: true, guessed: true };
  }
  // A recording (Blob) to 16 kHz mono samples
  async function decode(blob) {
    const buf = await blob.arrayBuffer(), ac = new OfflineAudioContext(1, 1, SR), ab = await ac.decodeAudioData(buf);
    if (ab.numberOfChannels === 1) return ab.getChannelData(0).slice();
    const out = new Float32Array(ab.length); for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < out.length; i++) out[i] += d[i] / ab.numberOfChannels; } return out;
  }
  // Remembered results, keyed on the recording and the script
  const cache = new Map(), pending = new Map();
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const key = (id, script) => id + '|' + hash(String(script || '')) + '|' + String(script || '').length;
  function peek(id, script) { return cache.get(key(id, script)) || null; }
  async function forMedia(id, script, getBlob) {
    const k = key(id, script); if (cache.has(k)) return cache.get(k); if (pending.has(k)) return pending.get(k);
    const p = (async () => { const b = await getBlob(id); if (!b) return null; const x = await decode(b), r = analyse(x, script); cache.set(k, r); if (cache.size > 24) cache.delete(cache.keys().next().value); return r; })().finally(() => pending.delete(k));
    pending.set(k, p); return p;
  }
  return { analyse, fromText, decode, parse, spell, features, forMedia, peek, FPS, _numWords: numWords };
})();

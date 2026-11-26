/* LipSync: from a voice recording (and its script, when there is one) to mouth shapes, word timings and how loud he is
   moment to moment. No outside libraries or models.
   With a script: the words are turned into the twelve Character Animator mouth shapes by English spelling rules (plus
   a list of common and Glaswegian words that do not follow them), then lined up against the sound with a forced
   alignment (Viterbi over the sounds in order, each scored on loudness, hiss and voicing, kept near the straight line
   through the speech). Without a script: the shapes are guessed from the sound alone. Square bracket tags in the script
   ([angry], [point]) are taken out of the words and come back with the time of the word they sit before. */
const LipSync = (() => {
  const SR = 16000, HOP = 160, WIN = 512, FPS = SR / HOP;   // 100 frames a second
  let RETIME = true;
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
  /* Sounds nobody can see: K, G, N, NG and H are made at the back of the mouth or with the tongue behind the teeth, and the
     lips take the shape of the vowel beside them. They are found in the sound like any other (ui marks them), but they are
     given no drawing of their own: the vowel that follows starts on them, or the vowel before is held through them. His
     D drawing is a wide set of clenched teeth; flashed on every N and K it made him chatter. */
  const ui = (v, k) => ({ v, k, inv: 1 });
  const u = (v, k) => ({ v, k }), AA = u('Aa', V), EE = u('Ee', V), OH = u('Oh', V), UH = u('Uh', V), WO = u('W-Oo', V);
  const DIG = [['tch', [u('S', S)]], ['igh', [AA, EE]], ['tion', [u('S', S), UH, ui('D', N)]], ['sion', [u('S', S), UH, ui('D', N)]], ['sch', [u('S', S), ui('D', T)]],
    ['ch', [u('S', S)]], ['sh', [u('S', S)]], ['th', [u('L', F)]], ['ph', [u('F', F)]], ['gh', []], ['ck', [ui('D', T)]], ['ng', [ui('D', N)]], ['nk', [ui('D', N), ui('D', T)]], ['qu', [ui('D', T), u('W-Oo', G)]],
    ['wh', [u('W-Oo', G)]], ['wr', [u('R', G)]], ['ee', [EE]], ['ea', [EE]], ['ie', [EE]], ['ey', [EE]], ['ei', [EE]], ['ae', [EE]], ['oo', [WO]], ['ou', [AA, WO]], ['ow', [AA, WO]], ['oa', [OH]], ['oe', [OH]],
    ['ai', [EE]], ['ay', [EE]], ['au', [OH]], ['aw', [OH]], ['oi', [OH, EE]], ['oy', [OH, EE]], ['ue', [WO]], ['ew', [WO]], ['ar', [AA, u('R', G)]], ['er', [u('R', G)]], ['ir', [u('R', G)]], ['ur', [u('R', G)]], ['or', [OH, u('R', G)]]];
  const ONE = { a: [AA], e: [EE], i: [EE], o: [OH], u: [UH], b: [u('M', B)], p: [u('M', B)], m: [u('M', N)], f: [u('F', F)], v: [u('F', F)], s: [u('S', S)], z: [u('S', S)], x: [ui('D', T), u('S', S)],
    j: [u('S', S)], g: [ui('D', T)], d: [u('D', T)], t: [u('D', T)], k: [ui('D', T)], q: [ui('D', T)], n: [ui('D', N)], h: [ui('D', F)], l: [u('L', G)], r: [u('R', G)], w: [u('W-Oo', G)], I: [AA, EE], O: [AA, WO] };
  const isV = c => /[aeiouy]/.test(c);
  function spell(w) {
    const out = []; let s = w;
    if (s.length > 2 && /[^aeiou]e$/.test(s) && !/[^aeiou]le$/.test(s)) s = s.slice(0, -1) + '#';   // silent final e (marks the vowel before it long)
    if (/[^aeiou]le$/.test(s)) s = s.slice(0, -2) + 'L';
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (c === '#') { i++; continue; }
      if (c === 'L') { out.push(UH, u('L', G)); i++; continue; }
      if (i === 0 && s.startsWith('kn')) { out.push(ui('D', N)); i += 2; continue; }
      const dg = DIG.find(d => s.startsWith(d[0], i)); if (dg) { out.push(...dg[1]); i += dg[0].length; continue; }
      if (c === s[i - 1] && !isV(c)) { i++; continue; }   // double letters
      if (c === 'h' && !/[aeiouy]/.test(s[i + 1] || '')) { i++; continue; }   // h is only heard before a vowel
      if (c === 'c') { out.push(/[eiy]/.test(s[i + 1] || '') ? u('S', S) : ui('D', T)); i++; continue; }
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
    // the shape of the spectrum, frame by frame (twelve cepstra of the band levels, the recording's average taken off): what the voice's own sounds are learned from
    const NC = 12, cep = new Float32Array(n * NC), lb = new Float32Array(NB), ct = new Float32Array(NC * NB), cm = new Float64Array(NC);
    for (let k = 0; k < NC; k++) for (let b = 0; b < NB; b++) ct[k * NB + b] = Math.cos(Math.PI * (k + 1) * (b + 0.5) / NB);
    for (let f = 0; f < n; f++) { for (let b = 0; b < NB; b++) lb[b] = Math.log(P[f * NB + b] + noise[b] + 1e-12); for (let k = 0; k < NC; k++) { let v = 0; for (let b = 0; b < NB; b++) v += lb[b] * ct[k * NB + b]; cep[f * NC + k] = v; cm[k] += v; } }
    for (let f = 0; f < n; f++) for (let k = 0; k < NC; k++) cep[f * NC + k] -= cm[k] / n;
    return { n, en: sm(en), hf: sm(hf), lf: sm(lf), voi: sm(voi), lev: sm(sm(lev)), noiseDb, peakDb: peak, cep, NC };
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
  function align(ft, words, win, own) {
    const st = [], units = [], uFirst = [];   // st: { k, unit, j (frame within the sound), M, m, opt }
    const addSil = (word) => { st.push({ k: 'sil', unit: null, word, j: 0, m: 1, M: 1, opt: true }); };
    addSil(-1);
    words.forEach((W, wi) => { W.units.forEach((U, i) => { const d = DUR[U.k] || DUR.T, diph = i > 0 && U.k === V && W.units[i - 1].k === V; const m = diph ? Math.max(2, d[0] - 1) : d[0], M = diph ? Math.round(d[2] * 0.7) : d[2];
      const ui = units.length; units.push({ v: U.v, k: U.k, word: wi, typ: d[1], inv: U.inv ? 1 : 0 }); uFirst.push(st.length); for (let j = 0; j < M; j++) st.push({ k: U.k, unit: ui, word: wi, j, m, M }); });
      addSil(wi); });
    const S = st.length, T = ft.n, nU = units.length;
    // where each state sits along the script, as a fraction of the usual total length
    const usual = units.reduce((a, q) => a + q.typ, 0) || 1, frac = new Float32Array(S); { let acc = 0, last = -1; for (let s = 0; s < S; s++) { const q = st[s]; if (q.unit != null && q.unit !== last) { if (last >= 0) acc += units[last].typ; last = q.unit; } frac[s] = (acc + (q.unit != null ? Math.min(q.j, units[q.unit].typ) : 0)) / usual; } }
    const cum = new Float32Array(T + 1); for (let t = 0; t < T; t++) cum[t + 1] = cum[t] + (ft.en[t] > 0.15 ? 1 : 0.05);
    const band = Math.min(0.5, Math.max(0.06, 1.6 / Math.sqrt(Math.max(1, nU)))), lo = new Int32Array(T), hi = new Int32Array(T);
    { let a = 0, b = 0; for (let t = 0; t < T; t++) { const c = cum[t + 1] / cum[T]; while (a < S - 1 && frac[a] < c - band) a++; while (b < S - 1 && frac[b + 1] <= c + band) b++; lo[t] = a; hi[t] = Math.max(a, b); } }
    if (win) {   // each word may only sit inside its own stretch of the recording (pinWords): the states allowed at each frame follow from that
      const nW = words.length, wA = new Int32Array(nW), wZ = new Int32Array(nW); { let w = -1; for (let q = 0; q < S; q++) { const k = st[q]; if (k.k === 'sil') { if (k.word >= 0) wZ[k.word] = q; } else if (k.word !== w) { w = k.word; wA[w] = q; } } }
      let a = 0, b = -1; for (let t = 0; t < T; t++) { while (a < nW && win[a * 2 + 1] < t) a++; while (b < nW - 1 && win[(b + 1) * 2] <= t) b++; lo[t] = a < nW ? wA[a] - 1 : S - 1; hi[t] = Math.max(lo[t], b >= 0 ? wZ[b] : 0); }
    }
    lo[0] = 0; hi[T - 1] = S - 1; for (let t = T - 2; t >= 0; t--) if (hi[t] < hi[t + 1] - 2 * (DUR.V[2] + 4)) hi[t] = Math.max(hi[t], 0);
    let Wd = 1; for (let t = 0; t < T; t++) Wd = Math.max(Wd, hi[t] - lo[t] + 1);
    const back = new Int32Array(T * Wd).fill(-1), INF = 1e18; let prev = new Float64Array(Wd).fill(INF), cur = new Float64Array(Wd);
    const ownOf = own ? st.map(q => own.cost[q.k === 'sil' ? 'sil' : units[q.unit].v + '/' + q.k] || null) : null;
    const emit = (s, t) => { const q = st[s], e = ft.en[t], h = ft.hf[t], l = ft.lf[t], v = ft.voi[t]; return (q.k === 'sil' ? COST.sil(e) : COST[q.k](e, h, l, v)) + (ownOf && ownOf[s] ? ownOf[s][t] : 0); };
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
    if (s < 0 || bc >= INF) { if (win) return null; s = S - 1; }
    const path = new Int32Array(T); for (let t = T - 1; t >= 0; t--) { path[t] = s; if (t > 0) { const f = (s >= lo[t] && s <= hi[t]) ? back[t * Wd + (s - lo[t])] : -1; s = f >= 0 ? f : s; } }
    return { path, st, units };
  }

  /* ---------- every word pinned to where it was heard ----------
     The sounds above cannot tell one word from another well enough to keep a whole recording in step by themselves: in fast,
     natural speech words slid into the wrong phrase (on his own minute of talking, two words in five started more than a
     tenth of a second out, some by seconds). The listener (Listen) knows which words were said when, to a fifth of a second
     or so, and the search above is exact to a hundredth where it has little to choose from. So: the script's words are
     matched to the heard words in order (a best matching of the two lists, so words he has corrected, added or cut still
     find their place between their neighbours), each word gets the stretch of the recording it was heard in with room either
     side, and the search runs inside those stretches. */
  let PIN_BEFORE = 0.16, PIN_AFTER = 0.22, PIN_QUIET = 0.2, PIN_NEXT = 0.1;
  const near = (a, b) => { if (a === b) return 2; if (a.length < 3 || b.length < 3) return -1; if (a[0] !== b[0]) return -1; const n = Math.min(a.length, b.length); let same = 0; for (let i = 0; i < n; i++) if (a[i] === b[i]) same++; return same >= Math.max(2, Math.ceil(Math.max(a.length, b.length) * 0.6)) ? 1 : -1; };
  function pinWords(P, heard, T, ft) {
    if (!heard || !heard.words || !heard.words.length || !P.words.length) return null;
    const H = []; heard.words.forEach(([txt, a, b]) => { const ws = parse(txt).words, stop = /[.,!?;:]$/.test(String(txt).trim()); ws.forEach((w, i) => H.push([w.w.replace(/'/g, ''), a, b, stop && i === ws.length - 1])); });
    const W = P.words.map(w => w.w.replace(/'/g, '')), n = W.length, m = H.length; if (!m) return null;
    if (n * m > 4e7) return null;
    // best matching of the two lists (2 for the same word, 1 for nearly, gaps and swaps cost 1)
    const C = m + 1, sc = new Int32Array((n + 1) * C), tr = new Uint8Array((n + 1) * C);
    for (let i = 1; i <= n; i++) { sc[i * C] = -i; tr[i * C] = 1; } for (let j = 1; j <= m; j++) { sc[j] = -j; tr[j] = 2; }
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) { const d = sc[(i - 1) * C + j - 1] + near(W[i - 1], H[j - 1][0]), u = sc[(i - 1) * C + j] - 1, l = sc[i * C + j - 1] - 1; if (d >= u && d >= l) { sc[i * C + j] = d; tr[i * C + j] = 0; } else if (u >= l) { sc[i * C + j] = u; tr[i * C + j] = 1; } else { sc[i * C + j] = l; tr[i * C + j] = 2; } }
    const at = new Int32Array(n).fill(-1); let hit = 0; { let i = n, j = m; while (i > 0 || j > 0) { const t = tr[i * C + j]; if (t === 0) { if (near(W[i - 1], H[j - 1][0]) > 0) { at[i - 1] = j - 1; hit++; } i--; j--; } else if (t === 1) i--; else j--; } }
    if (hit < Math.max(2, n * 0.3)) return null;   // not the words of this recording
    /* A pause is heard as part of a word: nearly always the word after it (the listener moves on to the next word as the
       pause starts), or the word before it when that word ends a sentence or clause (the full stop is heard in the pause). On
       his recording: 36 pauses of a fifth of a second or more, 35 that way round. Either way the word itself is the last
       stretch of talking inside its span, so a pause inside the span moves the span's start past it, a pause the span ends in
       pulls its end back, and the word before may run up to the pause. */
    const quiet = []; if (ft) { const qm = new Uint8Array(T); for (let t = 0; t < T; t++) qm[t] = ft.en[t] < PIN_QUIET ? 1 : 0;
      for (let t = 0; t < T;) { let e = t; while (e < T && qm[e] === qm[t]) e++; if (!qm[t] && e - t < 8 && t > 0 && e < T) for (let k = t; k < e; k++) qm[k] = 1; t = e; }   // a breath or a click in a pause is still the pause
      let q0 = -1; for (let t = 0; t <= T; t++) { const qt = t < T && qm[t]; if (qt && q0 < 0) q0 = t; else if (!qt && q0 >= 0) { if (t - q0 >= 20) quiet.push([q0, t]); q0 = -1; } } }
    const win = new Int32Array(n * 2), dur = T / FPS, reach = new Int32Array(n).fill(-1); let qi = 0;
    for (let i = 0; i < n; i++) {
      let a, b; if (at[i] >= 0) { a = H[at[i]][1]; b = H[at[i]][2]; }
      else { let p = i - 1; while (p >= 0 && at[p] < 0) p--; let q = i + 1; while (q < n && at[q] < 0) q++; a = p >= 0 ? H[at[p]][1] : 0; b = q < n ? H[at[q]][2] : dur; }
      // the listener tends to move on to the next word early (most of all in long, slow words), so a word may run on into the next word's span
      let nx = b; if (at[i] >= 0 && PIN_NEXT) { let q = i + 1; while (q < n && at[q] < 0) q++; if (q < n) nx = Math.max(b, H[at[q]][2] - PIN_AFTER + PIN_NEXT); }
      let lo = Math.floor((a - PIN_BEFORE) * FPS), hi = Math.ceil((Math.max(b, nx) + PIN_AFTER) * FPS);
      if (at[i] >= 0 && quiet.length) { const A = Math.round(a * FPS), B = Math.round(b * FPS), stop = H[at[i]][3]; let end = B;
        while (qi > 0 && quiet[qi - 1][1] > A - 5) qi--; while (qi < quiet.length && quiet[qi][1] <= A - 5) qi++;
        if (stop) { for (let k = qi; k < quiet.length && quiet[k][0] < B; k++) { if (quiet[k][0] <= A + 2) { lo = Math.max(lo, quiet[k][1] - 8); reach[i] = quiet[k][0] + 8; continue; } hi = Math.min(hi, quiet[k][0] + 8); break; } }   // the end of a clause: the word, then its pause (whatever else is heard in the pause)
        else {
          for (let k = qi; k < quiet.length && quiet[k][0] < B; k++) if (quiet[k][1] >= B - 2 && quiet[k][0] > A + 2) { end = quiet[k][0]; hi = Math.min(hi, quiet[k][0] + 8); break; }   // the span ends in a pause: the word ends before it
          for (let k = qi; k < quiet.length && quiet[k][1] <= end - 3; k++) { lo = Math.max(lo, quiet[k][1] - 8); reach[i] = quiet[k][0] + 8; }   // a pause inside the span: the word comes after it
        }
      }
      win[i * 2] = Math.max(0, lo); win[i * 2 + 1] = Math.min(T - 1, Math.max(lo, hi));
    }
    for (let i = 1; i < n; i++) if (reach[i] > win[(i - 1) * 2 + 1]) win[(i - 1) * 2 + 1] = Math.min(T - 1, reach[i]);
    for (let i = 1; i < n; i++) if (win[i * 2] < win[(i - 1) * 2]) win[i * 2] = win[(i - 1) * 2];
    for (let i = n - 2; i >= 0; i--) if (win[i * 2 + 1] > win[(i + 1) * 2 + 1]) win[i * 2 + 1] = win[(i + 1) * 2 + 1];
    for (let i = 0; i < n; i++) if (win[i * 2 + 1] < win[i * 2]) win[i * 2 + 1] = win[i * 2];
    return { win, hit };
  }

  /* ---------- his own sounds ----------
     The costs above know only loud, hissy, voiced. Once the words are roughly placed the recording itself says more: every
     frame given to an "ee", an "s", an "m" shows what that sound looks like in this voice, this room, this microphone. Each
     kind of sound gets the average shape of its spectrum and how much it varies (one Gaussian), and the search runs again
     with how well each frame fits added in, twice over: the way speech aligners are trained on the very recordings they
     align (Viterbi training; McAuliffe and others 2017 for the idea at full size). Kinds heard too little are left as
     they were. */
  let OWN_W = 1;
  function learn(ft, al) {
    const NC = ft.NC, T = ft.n, sum = {}, cls = new Array(T), g = { n: 0, s: new Float64Array(NC), q: new Float64Array(NC) };
    for (let t = 0; t < T; t++) { const q = al.st[al.path[t]], c = q.k === 'sil' ? 'sil' : al.units[q.unit].v + '/' + q.k; cls[t] = c; const a = sum[c] || (sum[c] = { n: 0, s: new Float64Array(NC), q: new Float64Array(NC) });
      a.n++; g.n++; for (let k = 0; k < NC; k++) { const v = ft.cep[t * NC + k]; a.s[k] += v; a.q[k] += v * v; g.s[k] += v; g.q[k] += v * v; } }
    const gm = new Float64Array(NC), gv = new Float64Array(NC); for (let k = 0; k < NC; k++) { gm[k] = g.s[k] / g.n; gv[k] = Math.max(1e-6, g.q[k] / g.n - gm[k] * gm[k]); }
    const cost = {}; let any = false;
    Object.keys(sum).forEach(c => { const a = sum[c]; if (a.n < 20) return; const m = new Float64Array(NC), iv = new Float64Array(NC); let lg = 0, lg0 = 0;
      for (let k = 0; k < NC; k++) { m[k] = a.s[k] / a.n; const v = Math.max(gv[k] * 0.15, a.q[k] / a.n - m[k] * m[k]); iv[k] = 1 / v; lg += Math.log(v); lg0 += Math.log(gv[k]); }
      const out = new Float32Array(T); for (let t = 0; t < T; t++) { let d = 0, d0 = 0; for (let k = 0; k < NC; k++) { const x = ft.cep[t * NC + k], e = x - m[k], e0 = x - gm[k]; d += e * e * iv[k]; d0 += e0 * e0 / gv[k]; } out[t] = OWN_W * cl(0.5 * (d + lg - d0 - lg0) / NC * 4, -3, 6); }
      cost[c] = out; any = true; });
    return any ? { cost } : null;
  }

  // frames to segments: [t0, t1, unitIndex or -1 for silence]
  /* A frame is 32 ms of sound starting at t / FPS, so what it shows happened around its middle: times are given from there
     (measured against speech with known word times, starts were 20 ms early without it). */
  const MID = WIN / 2 / SR;
  function segments(al) { const out = []; let cur = null; for (let t = 0; t < al.path.length; t++) { const q = al.st[al.path[t]], key = q.unit == null ? -1 : q.unit; if (!cur || cur[2] !== key) { cur = [t ? t / FPS + MID : 0, (t + 1) / FPS + MID, key, t, t + 1]; out.push(cur); } else { cur[1] = (t + 1) / FPS + MID; cur[4] = t + 1; } } return out; }

  /* ---------- sharing a word out among its sounds ----------
     The search finds where a word is (with the listener, to about 20 ms) and inside it can hear a hiss, and a shut mouth
     when it is truly quiet. What it cannot do is tell a W, an L, an R or an N from the vowel beside it, or where a vowel
     ends and a soft consonant starts: they are all voiced and about as loud. Left alone it gave "way" 300 ms of W and 40
     of vowel, "one" no vowel at all, and the mouth missed the opening on a syllable about one time in five. So inside
     each word the edges it can really hear are kept (the word's own ends, a hiss that is hissy, the closure of a P or a B, which it puts on the quietest moment)
     and everything between two such edges is shared out by how long such sounds last in speech: a glide, a nasal or a
     stop about 50 to 70 ms and never more than its share, the vowels all the rest (two vowels written as one sound, as
     in "my", 60 to 40). The jaw then opens on every syllable, which is what the eye reads as being in sync
     (Klatt 1979 for how long sounds last; the old animators' rule: hit the vowels and the closed lips, let the rest go). */
  const WANT = { V: 9, G: 5.5, N: 6, B: 6, T: 5, S: 9, F: 6.5 };
  /* Where each of a run of sounds ends (frames f0 to f1), as the best fit of two things: how long each kind of sound
     wants to be (above), and the loudness inside the run, the vowels on its louder frames and the consonants in its
     dips. Every way of cutting the run is tried (it is short). */
  function share(U, f0, f1, ft) {
    // quiet frames at either end of the run belong to no sound: the fit is made on the part that can be heard, and the end sounds reach out over the rest
    { let a = f0, b = f1; while (b - a > U.length + 2 && ft.en[Math.min(ft.n - 1, b - 1)] < 0.08) b--; while (b - a > U.length + 2 && ft.en[Math.min(ft.n - 1, a)] < 0.08) a++; if (a > f0 || b < f1) { const e = share(U, a, b, ft); e[e.length - 1] = f1; return e; } }
    const n = f1 - f0, m = U.length, ends = new Array(m); if (n <= m) { for (let x = 0; x < m; x++) ends[x] = Math.min(f1, f0 + Math.round((x + 1) * n / m)); ends[m - 1] = f1; return ends; }
    let lo = 1e9, hi = -1e9; for (let t = f0; t < f1; t++) { const e = ft.en[Math.min(ft.n - 1, t)]; if (e < lo) lo = e; if (e > hi) hi = e; } const sp = Math.max(0.08, hi - lo);
    const pre = new Float64Array(n + 1); for (let t = 0; t < n; t++) pre[t + 1] = pre[t] + (ft.en[Math.min(ft.n - 1, f0 + t)] - lo) / sp;   // loudness within the run, 0 to 1, summed
    const nv = U.filter(u => u.k === V).length, fixed = U.reduce((x, u) => x + (u.k === V ? 0 : WANT[u.k] || 5), 0), room = nv ? Math.max(n * 0.44, n - fixed) : 0;
    const want = U.map((u, x) => u.k === V ? room * (x > 0 && U[x - 1].k === V ? 0.4 : x + 1 < m && U[x + 1].k === V ? 0.6 : 1) / Math.max(1, nv - U.filter((q, y) => q.k === V && y > 0 && U[y - 1].k === V).length) : (WANT[u.k] || 5) * (nv ? Math.min(1, (n - room) / fixed) : n / fixed));
    const cost = (x, a, b) => { const len = b - a, loud = pre[b] - pre[a], u = U[x], w = Math.max(1.5, want[x]); if (u.k === V) return (len - loud) * 1.0 + (len < 4 ? (4 - len) * 1.5 : 0) + Math.abs(len - w) / w * 0.9; const least = u.v === 'W-Oo' ? 5 : u.v === 'F' || u.v === 'M' ? 4 : 2; return loud * 0.9 + Math.abs(len - w) / w * 1.3 + (len > w * 2 ? (len - w * 2) * 0.5 : 0) + (len < least ? (least - len) * 2 : 0); };   // a W is a pucker the eye catches, an F the teeth on the lip: each wants its two frames of picture
    const best = [], from = []; for (let x = 0; x < m; x++) { best.push(new Float64Array(n + 1).fill(1e18)); from.push(new Int32Array(n + 1)); }
    for (let b2 = 1; b2 <= n - (m - 1); b2++) best[0][b2] = cost(0, 0, b2);
    for (let x = 1; x < m; x++) for (let b2 = x + 1; b2 <= n - (m - 1 - x); b2++) { let bv = 1e18, ba = x; for (let a2 = x; a2 < b2; a2++) { const v = best[x - 1][a2]; if (v >= 1e17) continue; const c = v + cost(x, a2, b2); if (c < bv) { bv = c; ba = a2; } } best[x][b2] = bv; from[x][b2] = ba; }
    let e = n; for (let x = m - 1; x >= 0; x--) { ends[x] = f0 + e; e = x > 0 ? from[x][e] : 0; }
    return ends;
  }
  function retime(seg, al, ft) {
    const mean = (a, f0, f1) => { let m = 0, c = 0; for (let t = f0; t < Math.min(ft.n, f1); t++) { m += a[t]; c++; } return c ? m / c : 0; };
    let i = 0;
    while (i < seg.length) {
      if (seg[i][2] < 0) { i++; continue; } const w = al.units[seg[i][2]].word; let j = i; while (j + 1 < seg.length && seg[j + 1][2] >= 0 && al.units[seg[j + 1][2]].word === w) j++;
      // the sounds of this word that follow each other with no silence between, and which of them can be trusted where they are
      const sure = q => { const U = al.units[seg[q][2]], n = seg[q][4] - seg[q][3]; return (U.k === S && n >= 4 && mean(ft.hf, seg[q][3], seg[q][4]) > 0.32) || (U.k === B && n >= 3); };   // a closure sits where the search found the quietest moment
      let a = i; while (a <= j) { if (sure(a)) { a++; continue; } let b = a; while (b + 1 <= j && !sure(b + 1)) b++;
        if (b > a) { const f0 = seg[a][3], f1 = seg[b][4], U = []; for (let q = a; q <= b; q++) U.push(al.units[seg[q][2]]);
          const ends = share(U, f0, f1, ft); let acc = f0; for (let q = a; q <= b; q++) { const e = ends[q - a]; seg[q][3] = acc; seg[q][4] = e; seg[q][0] = acc ? acc / FPS + MID : 0; seg[q][1] = e / FPS + MID; acc = e; } }
        a = b + 1; }
      i = j + 1; }
    return seg;
  }

  /* ---------- shapes from sound alone (no script) ---------- */
  function guess(ft) {
    const out = []; for (let t = 0; t < ft.n; t++) { const e = ft.en[t], h = ft.hf[t], l = ft.lf[t]; let v = 'Neutral';
      if (e < 0.12) v = 'Neutral'; else if (h > 0.42 && ft.voi[t] < 0.6) v = 'S'; else if (e > 0.68) v = l > 0.82 ? 'Oh' : 'Aa'; else if (e > 0.42) v = h > 0.16 ? 'Ee' : (l > 0.85 ? 'W-Oo' : 'Uh'); else v = 'R';
      out.push(v); }
    // dips between syllables close the lips briefly
    for (let t = 2; t < ft.n - 2; t++) if (ft.en[t] > 0.12 && ft.en[t] < ft.en[t - 2] * 0.55 && ft.en[t] < ft.en[t + 2] * 0.55) out[t] = 'M';
    const seg = []; out.forEach((v, t) => { const last = seg[seg.length - 1]; if (last && last[1] === v) return; seg.push([t / FPS, v]); });
    return seg;
  }

  /* ---------- the shapes the eye needs ----------
     A drawn mouth swaps between a dozen pictures, and in quick speech the sounds come faster than pictures can be read (he
     runs at 50 to 80 ms a sound; a shape wants 60 ms or more to be seen, two frames of a 30 a second video). So the list is
     thinned by what the eye would miss, not by what happens to be shortest: lips shut (M B P) and teeth on lip (F V) are the
     shapes everyone notices, so they are always kept and given their two frames, taken from before them (lips close before
     the sound, and open on it); vowels are the jaw opening, kept next; the tongue sounds behind the teeth (D S L R) look
     alike and are the first to go, their time handed to the stronger neighbour. The shapes lead the sound by a twenty fifth
     of a second, as a mouth does and as animators time it (picture a little early reads as in sync, picture late reads as
     dubbed: ITU-R BT.1359, and the old two frames ahead rule). */
  const RANK = { M: 3, F: 3, 'W-Oo': 2, Aa: 2, Ee: 2, Oh: 2, Uh: 2, L: 1, S: 1, R: 1, D: 0, Neutral: 1 }, SEEN = 0.062, LEAD = 0.04; let MIN2 = 0.058, MIN1 = 0.066;   // a vowel shape wants its two frames of a 30 a second video near enough; a tongue sound that cannot have them goes
  function tidy(list, lead) {
    let s = []; list.forEach(([t, v]) => { const L = s[s.length - 1]; if (L && L[1] === v) return; if (L && t <= L[0]) { L[1] = v; return; } s.push([t, v]); });
    const end = i => (s[i + 1] ? s[i + 1][0] : s[i][0] + 1), len = i => end(i) - s[i][0];
    // lips shut and teeth on lip: at least two frames, taken from the shape before (or after, when there is none to take from)
    for (let i = 0; i < s.length; i++) { if (RANK[s[i][1]] !== 3) continue; const need = SEEN - len(i); if (need <= 0) continue;
      if (i > 0 && len(i - 1) - need >= 0.03) s[i][0] -= need; else if (i > 0 && s[i - 1][1] === 'Neutral') s[i][0] -= Math.min(need, Math.max(0, len(i - 1) - 0.01)); else if (s[i + 1] && len(i + 1) - need >= 0.03) s[i + 1][0] += need; }
    // a vowel is the jaw opening on a syllable: one too short to be seen takes its two frames from a tongue sound beside it
    // (which looks much the same and will not be missed), never from closed lips
    const rk = i => (RANK[s[i][1]] == null ? 1 : RANK[s[i][1]]), soft = i => i >= 0 && i < s.length - 1 && rk(i) <= 1 && s[i][1] !== 'Neutral';
    for (let i = 0; i < s.length - 1; i++) { if (rk(i) !== 2) continue; let need = MIN2 + 0.002 - len(i); if (need <= 0.002) continue;
      if (soft(i - 1)) { const take = Math.min(need, Math.max(0, len(i - 1) - 0.02)); s[i][0] -= take; need -= take; }
      if (need > 0.001 && soft(i + 1)) { const take = Math.min(need, Math.max(0, len(i + 1) - 0.02)); s[i + 1][0] += take; need -= take; }
      if (need > 0.001 && s[i][1] === 'W-Oo' && i + 2 < s.length && rk(i + 1) === 2 && len(i + 1) - need >= 0.09) s[i + 1][0] += need; }   // the pucker of a W before its vowel: two frames of it, out of a vowel that can spare them
    // then thin: the weakest of the too short shapes goes first. A tongue sound's time goes to the stronger neighbour (the one
    // before on a tie); a vowel's goes to another vowel beside it, else to a tongue sound, and only then to closed lips
    for (let guard = 0; guard < 4000; guard++) {
      let k = -1, kr = 9, kl = 9; for (let i = 0; i < s.length - 1; i++) { const v = s[i][1], r = rk(i), hemmed = r === 2 && i > 0 && (rk(i - 1) === 3 || s[i - 1][1] === 'Neutral') && (rk(i + 1) === 3 || s[i + 1][1] === 'Neutral'),
        min = r === 3 ? 0.03 : v === 'Neutral' ? 0.07 : r === 2 ? (hemmed ? 0.04 : MIN2) : MIN1, l = len(i); if (l < min && (r < kr || (r === kr && l < kl))) { k = i; kr = r; kl = l; } }
      if (k < 0) break;
      const r = rk(k), pr = k > 0 ? rk(k - 1) : -1, nr = rk(k + 1); let toPrev = k > 0 && pr >= nr;
      if (r === 2 && k > 0) { const score = i => rk(i) === 2 ? 3 : soft(i) ? 2 : rk(i) === 3 ? 1 : 0; toPrev = score(k - 1) >= score(k + 1); }
      if (toPrev) s.splice(k, 1); else { s[k + 1][0] = s[k][0]; s.splice(k, 1); }
      for (let i = s.length - 1; i > 0; i--) if (s[i][1] === s[i - 1][1]) s.splice(i, 1);
    }
    // a mouth does not snap shut in the middle of talking: across a gap of under a fifth of a second (the hold of a T or a K, a catch
    // between two words) it stays a little open (his R drawing, the smallest opening he has); it shuts for an M, a B or a P, and for a real pause
    for (let i = 1; i < s.length - 1; i++) if (s[i][1] === 'Neutral' && len(i) < 0.2 && s[i - 1][1] !== 'Neutral' && s[i + 1][1] !== 'Neutral' && s[i - 1][1] !== 'M' && s[i + 1][1] !== 'M') s[i][1] = 'R';
    for (let i = s.length - 1; i > 0; i--) if (s[i][1] === s[i - 1][1]) s.splice(i, 1);
    return s.map(([t, v]) => [Math.max(0, +(t - lead).toFixed(3)), v]);
  }
  /* The mouth follows the sound whatever the words say: where a word has been placed but nothing can be heard he is not
     saying it there (shut, unless it is the hold of a p or a t), and where there is clear speech with no word on it (a
     word the script lacks, a laugh, an "eh") the shape is read from the sound itself, so he is never caught with his
     mouth shut while he can be heard. */
  /* Breaths: in a silence that leads into speech, a stretch of soft unvoiced sound (150 ms or more, clear of the word
     before) is him breathing in. His lips part for it (the R drawing, the smallest opening) and the times are kept
     (breaths) so the chest can rise with it. A recording cleaned until the breaths are gone simply has none. */
  function breathIn(ft, f0, f1) {
    let best = null, a = -1, gap = 0; for (let t = f0 + 10; t <= f1; t++) { const on = t < f1 && t < ft.n && ft.en[t] >= 0.085 && ft.en[t] < 0.42 && ft.voi[t] < 0.62; if (on) { if (a < 0) a = t; gap = 0; } else if (a >= 0 && (++gap > 3 || t >= f1)) { const b = t - gap + (t >= f1 && gap <= 3 ? gap : 0); if (b - a >= 14 && f1 - b <= 50 && (!best || b - a > best[1] - best[0])) best = [a, b]; a = -1; gap = 0; } }
    return best;
  }
  function toSound(seg, al, ft, heardShapes, breaths) {
    const out = [];
    seg.forEach(([a, b, k, f0, f1], si) => {
      const n = Math.max(1, f1 - f0); let quiet = 0, loud = 0; for (let t = f0; t < f1 && t < ft.n; t++) { if (ft.en[t] < 0.07) quiet++; if (ft.en[t] > 0.34) loud++; }
      if (k >= 0) { const U = al.units[k]; if (quiet === n && n >= 7 && U.k !== 'B' && U.k !== 'T') { out.push([a, 'Neutral']); return; } out.push([a, null, k, f0, f1]); return; }
      if (loud >= 7 && heardShapes) { let on = false; for (let t = f0; t < f1 && t < ft.n; t++) { const sp = ft.en[t] > 0.3; if (sp) { const v = heardShapes[t]; if (!on || out[out.length - 1][1] !== v) out.push([t / FPS + MID, v]); on = true; } else if (on || t === f0) { out.push([t === f0 ? a : t / FPS + MID, 'Neutral']); on = false; } } return; }
      out.push([a, 'Neutral']);
      const nx = seg[si + 1], br = breaths && nx && nx[2] >= 0 && f1 - f0 >= 26 ? breathIn(ft, f0, f1) : null;
      if (br) { const t0 = (br[0] + 2) / FPS + MID, t1 = br[1] / FPS + MID; breaths.push([+t0.toFixed(3), +t1.toFixed(3)]); out.push([t0, 'R']); if (f1 - br[1] > 12) out.push([t1, 'Neutral']); }
    });
    return out;
  }

  function analyse(x, script, heard) { const r = analyse0(x, script, heard); if (typeof Prosody !== 'undefined') Prosody.annotate(r, Prosody.pitch(x)); return r; }
  function analyse0(x, script, heard) {
    const ft = features(x), dur = x.length / SR, P = parse(script), env = ft.en, lev = ft.lev;
    if (!P.words.length) return { visemes: tidy(guess(ft).map(([t, v]) => [t ? t + MID : 0, v]), LEAD), words: [], tags: [], env, lev, fps: FPS, dur, script: false };
    const pin = pinWords(P, heard, ft.n, ft); let al = pin ? align(ft, P.words, pin.win) : null; const pinned = al ? pin.hit : 0; if (!al) al = align(ft, P.words);
    if (OWN_W > 0 && P.words.length >= 12) for (let pass = 0; pass < 2; pass++) { const own = learn(ft, al); if (!own) break; const a2 = align(ft, P.words, pinned ? pin.win : null, own); if (!a2) break; al = a2; }
    const seg = RETIME ? retime(segments(al), al, ft) : segments(al), vis = [], wt = P.words.map(() => [Infinity, -Infinity]);
    let bySound = null; const soundShape = () => { if (!bySound) { bySound = new Array(ft.n).fill('Neutral'); const g = guess(ft); g.forEach(([t, v], i) => { const f0 = Math.round(t * FPS), f1 = g[i + 1] ? Math.round(g[i + 1][0] * FPS) : ft.n; for (let f = f0; f < f1; f++) bySound[f] = v === 'Neutral' ? 'Uh' : v; }); } return bySound; };
    const breaths = [], fit = toSound(seg, al, ft, seg.some(q => q[2] < 0 && q[4] - q[3] >= 7) ? soundShape() : null, breaths);
    fit.forEach(q => { if (q[1] != null) vis.push([q[0], q[1]]); });
    seg.forEach(([a, b, k]) => { if (k < 0) return; const U = al.units[k], w = wt[U.word]; w[0] = Math.min(w[0], a); w[1] = Math.max(w[1], b); });
    fit.forEach(([a, vv, k, f0, f1]) => {
      if (vv != null) return; const b = f1 / FPS + MID;
      const U = al.units[k]; let v = U.v;
      if (U.k === V) { let m = 0, c = 0; for (let t = f0; t < Math.min(ft.n, f1); t++) { m += ft.en[t]; c++; } m /= Math.max(1, c); if (v === 'Aa' && m < 0.38) v = 'Uh'; if (m < 0.18 && v !== 'Oh' && v !== 'W-Oo') v = 'R'; }   // a vowel said under the breath: the mouth barely opens
      vis.push([a, v, { inv: U.inv, word: U.word, vowel: U.k === V }]);
    });
    vis.sort((p, q) => p[0] - q[0]);
    // the sounds nobody can see: the vowel after them in the word starts where they did; with none, the shape before is held
    { const shown = {}; vis.forEach(q => { if (q[2] && !q[2].inv) shown[q[2].word] = 1; });
      for (let i = vis.length - 1; i >= 0; i--) { const q = vis[i]; if (!q[2] || !q[2].inv) continue; if (!shown[q[2].word]) { q[1] = 'R'; shown[q[2].word] = 1; continue; }
        const nx = vis[i + 1]; if (nx && nx[2] && nx[2].word === q[2].word && nx[2].vowel) nx[0] = q[0]; else if (i === 0 || vis[i - 1][1] === 'Neutral') { q[1] = 'R'; continue; }   // straight after a silence there is no shape to hold: lips part
        vis.splice(i, 1); } }
    const words = P.words.map((W, i) => [wt[i][0], wt[i][1], W.text || W.w, i, W.w]).filter(w => isFinite(w[0]));
    const at = i => { const w = wt[i]; if (w && isFinite(w[0])) return w[0]; const p = wt[i - 1]; return p && isFinite(p[1]) ? p[1] : 0; };
    const tags = P.tags.map(g => ({ tag: g.tag, word: g.word, t: g.word >= P.words.length ? (wt.length ? Math.max(0, ...wt.map(w => isFinite(w[1]) ? w[1] : 0)) : dur) : at(g.word) }));
    return { visemes: tidy(vis, LEAD), words, tags, env, lev, fps: FPS, dur, script: true, pinned, breaths };
  }
  // No recording yet: time the script at a steady talking pace, so he can be seen saying it (the timing is a guess)
  function fromText(script, rate) {
    const P = parse(script), k = 1 / (rate || 1), vis = [], words = []; let t = 0.3;
    P.words.forEach((W, i) => { const a = t, seen = W.units.some(U => !U.inv); W.units.forEach((U, x) => { const nx = W.units[x + 1], hid = U.inv && seen; if (!hid) vis.push([t, U.inv ? 'R' : U.v]); else if (nx && nx.k === V) vis.push([t, nx.v]); t += (DUR[U.k] || DUR.T)[1] * 0.0105 * k; }); words.push([a, t, W.text || W.w, i, W.w]); t += W.pause ? 0.32 * k : 0.04 * k; if (W.pause) vis.push([t - 0.3 * k, 'Neutral']); });
    const dur = t + 0.3, n = Math.ceil(dur * FPS), env = new Float32Array(n);
    words.forEach(w => { for (let f = Math.floor(w[0] * FPS); f < Math.min(n, w[1] * FPS); f++) env[f] = 0.55 + 0.35 * Math.sin((f - w[0] * FPS) / Math.max(1, (w[1] - w[0]) * FPS) * Math.PI); });
    const at = i => i < words.length ? words[i][0] : t;
    const R0 = { visemes: tidy(vis.sort((a, b) => a[0] - b[0]), 0), words, tags: P.tags.map(g => ({ tag: g.tag, word: g.word, t: at(g.word) })), env, lev: env, fps: FPS, dur, script: true, guessed: true };
    if (typeof Prosody !== 'undefined') Prosody.annotate(R0, null); return R0;
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
  const key = (id, script, engine) => id + '|' + hash(String(script || '')) + '|' + String(script || '').length + '|' + (engine || 'patter');
  function peek(id, script, engine) { return cache.get(key(id, script, engine)) || null; }
  function seed(id, script, engine, r) { if (r) cache.set(key(id, script, engine), r); }
  function forget(id) { for (const k of Array.from(cache.keys())) if (k.startsWith(id + '|')) cache.delete(k); }   // what was heard has changed: time it again   // the export helpers get the timing worked out on the page
  // engine 'rhubarb': the mouth shapes come from Rhubarb (when it is downloaded); words, tags and level still from here
  async function forMedia(id, script, getBlob, engine) {
    const k = key(id, script, engine); if (cache.has(k)) return cache.get(k); if (pending.has(k)) return pending.get(k);
    const p = (async () => { const b = await getBlob(id); if (!b) return null; let heard = null; try { heard = typeof Listen !== 'undefined' && Listen.heard ? await Listen.heard(id) : null; } catch (e) { heard = null; } const x = await decode(b), r = analyse(x, script, heard);
      if (engine === 'rhubarb' && typeof Rhubarb !== 'undefined' && await Rhubarb.ready()) { const said = parse(script).words.map(w => w.w).join(' '); r.visemes = tidy(await Rhubarb.visemes(x, said), 0.03); r.engine = 'rhubarb'; } cache.set(k, r); if (cache.size > 24) cache.delete(cache.keys().next().value); return r; })().finally(() => pending.delete(k));
    pending.set(k, p); return p;
  }
  return { _retime: v => { RETIME = !!v; }, _mins: (a, b) => { MIN2 = a; MIN1 = b; }, _set: (b, a, q, nx, ow) => { PIN_BEFORE = b; PIN_AFTER = a; PIN_QUIET = q; if (nx != null) PIN_NEXT = nx; if (ow != null) OWN_W = ow; }, seed, forget, analyse, fromText, decode, parse, spell, features, forMedia, peek, pinWords, FPS, _numWords: numWords };
})();

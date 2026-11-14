/* Prosody: what the voice is doing besides the words. Pitch (Boersma's autocorrelation method, 1993: the frame's
   autocorrelation divided by the window's, candidates per frame, the cheapest path through them), then what the
   performance needs from it: how prominent each word is (pitch movement, loudness and length together, the way listeners
   hear stress), where the thoughts start and stop (intonation phrases), and how worked up he is (arousal: louder, higher,
   wider and faster than his own usual). Everything is measured against his own voice in this recording, not fixed numbers.
   Note for Glasgow: statements often end on a rise (Cruttenden 1997), so a rise is never read as a question here; the
   words decide that. 16 kHz mono in, 100 values a second out (the same clock as LipSync). */
'use strict';
const Prosody = (() => {
  const SR = 16000, FPS = 100;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, xr = re[q] * cr - im[q] * ci, xi = re[q] * ci + im[q] * cr; re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
  const median = a => { if (!a.length) return 0; const s = Array.from(a).sort((x, y) => x - y); return s[s.length >> 1]; };
  const pct = (a, q) => { if (!a.length) return 0; const s = Array.from(a).sort((x, y) => x - y); return s[cl(Math.floor(s.length * q), 0, s.length - 1)]; };

  /* ---------- pitch ---------- */
  const FMIN = 60, FMAX = 400;
  function pitch(x) {
    // 8 kHz is plenty for a voice's pitch and four times quicker
    const m = x.length >> 1, y = new Float32Array(m); for (let i = 0; i < m; i++) { const a = 2 * i; y[i] = 0.25 * (x[a - 1] || 0) + 0.5 * x[a] + 0.25 * (x[a + 1] || 0); }
    const sr = SR / 2, WL = 400, HOP = 160, N = 1024, nf = Math.max(1, Math.floor((m - WL) / HOP) + 1), lo = Math.floor(sr / FMAX), hi = Math.ceil(sr / FMIN);
    const win = new Float32Array(WL); for (let i = 0; i < WL; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i + 0.5) / WL);
    const re = new Float32Array(N), im = new Float32Array(N), wac = new Float32Array(hi + 2);
    { re.fill(0); im.fill(0); for (let i = 0; i < WL; i++) re[i] = win[i]; fft(re, im); for (let i = 0; i < N; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; } fft(re, im); for (let k = 0; k <= hi + 1; k++) wac[k] = re[k] / re[0]; }
    let gpk = 1e-9; for (let i = 0; i < m; i++) { const v = Math.abs(y[i]); if (v > gpk) gpk = v; }
    const K = 4, cf = new Float32Array(nf * K), cs = new Float32Array(nf * K), us = new Float32Array(nf), r = new Float32Array(hi + 2);
    for (let f = 0; f < nf; f++) {
      const o = f * HOP; let mean = 0, pk = 0; for (let i = 0; i < WL; i++) mean += y[o + i]; mean /= WL;
      re.fill(0); im.fill(0); for (let i = 0; i < WL; i++) { const v = y[o + i] - mean; if (Math.abs(v) > pk) pk = Math.abs(v); re[i] = v * win[i]; }
      fft(re, im); for (let i = 0; i < N; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; } fft(re, im);
      const r0 = re[0] || 1e-12; for (let k = 0; k <= hi + 1; k++) r[k] = re[k] / r0 / Math.max(0.05, wac[k]);
      us[f] = 0.45 + Math.max(0, 2 - (pk / gpk) / (0.03 / 1.45));   // how good "no pitch here" is: better the quieter the frame
      const top = []; for (let k = Math.max(2, lo); k <= hi; k++) { if (r[k] <= r[k - 1] || r[k] < r[k + 1] || r[k] < 0.2) continue;
        const a = r[k - 1], b = r[k], c = r[k + 1], den = a - 2 * b + c, d = Math.abs(den) > 1e-9 ? 0.5 * (a - c) / den : 0, tau = k + d, v = Math.min(1, b - 0.25 * (a - c) * d), s = v - 0.01 * Math.log2(FMIN * tau / sr);   // the shortest period that fits wins ties
        top.push([s, sr / tau]); }
      top.sort((p, q) => q[0] - p[0]); for (let i = 0; i < K; i++) { cs[f * K + i] = i < top.length ? top[i][0] : -9; cf[f * K + i] = i < top.length ? top[i][1] : 0; }
    }
    // the cheapest path: staying voiced or unvoiced is free, switching costs a little, jumping an octave costs a lot
    const S = K + 1, cost = new Float32Array(nf * S), back = new Int8Array(nf * S);
    for (let f = 0; f < nf; f++) for (let s = 0; s < S; s++) {
      const st = s < K ? cs[f * K + s] : us[f], fr = s < K ? cf[f * K + s] : 0; let best = -1e9, bi = 0;
      if (f > 0) for (let q = 0; q < S; q++) { const pf = q < K ? cf[(f - 1) * K + q] : 0; if (q < K && cs[(f - 1) * K + q] < -1) continue; const tr = (fr > 0) !== (pf > 0) ? 0.14 : fr > 0 ? 0.35 * Math.abs(Math.log2(fr / pf)) : 0, c = cost[(f - 1) * S + q] - tr; if (c > best) { best = c; bi = q; } } else best = 0;
      cost[f * S + s] = (s < K && st < -1 ? -1e9 : best + st); back[f * S + s] = bi;
    }
    const f8 = new Float32Array(nf); { let s = 0, b = -1e18; for (let q = 0; q < S; q++) if (cost[(nf - 1) * S + q] > b) { b = cost[(nf - 1) * S + q]; s = q; } for (let f = nf - 1; f >= 0; f--) { f8[f] = s < K ? cf[f * K + s] : 0; s = back[f * S + s]; } }
    // to 100 a second; a frame's time is its middle
    const n = Math.max(1, Math.floor(x.length / (SR / FPS))), f0 = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / FPS, j = Math.round((t * sr - WL / 2) / HOP); f0[i] = j >= 0 && j < nf ? f8[j] : 0; }
    // lone voiced frames and one frame gaps are noise
    for (let i = 1; i < n - 1; i++) { if (f0[i] && !f0[i - 1] && !f0[i + 1]) f0[i] = 0; }
    for (let i = 1; i < n - 1; i++) { if (!f0[i] && f0[i - 1] && f0[i + 1]) f0[i] = (f0[i - 1] + f0[i + 1]) / 2; }
    return f0;
  }
  /* Pitch in semitones about his own middle, carried smoothly through the unvoiced bits (for the head and brows to follow). */
  function contour(f0) {
    const n = f0.length, v = []; for (let i = 0; i < n; i++) if (f0[i] > 0) v.push(f0[i]);
    const med = median(v) || 120, st = new Float32Array(n), voiced = new Uint8Array(n); let last = -1;
    for (let i = 0; i < n; i++) { if (f0[i] > 0) { voiced[i] = 1; st[i] = 12 * Math.log2(f0[i] / med); if (last >= 0 && i - last > 1) { const a = st[last], b = st[i]; for (let k = last + 1; k < i; k++) st[k] = a + (b - a) * (k - last) / (i - last); } else if (last < 0) for (let k = 0; k < i; k++) st[k] = st[i]; last = i; } }
    if (last >= 0) for (let k = last + 1; k < n; k++) st[k] = st[last];
    const sm = new Float32Array(n); { let acc = 0; const a = 0.18; for (let i = 0; i < n; i++) { acc += (st[i] - acc) * a; sm[i] = acc; } acc = sm[n - 1] || 0; for (let i = n - 1; i >= 0; i--) { acc += (sm[i] - acc) * a; sm[i] = acc; } }   // both ways: no lag
    const sts = v.map(q => 12 * Math.log2(q / med));
    return { med, st: sm, voiced, lo: pct(sts, 0.05), hi: pct(sts, 0.95), share: v.length / Math.max(1, n) };
  }

  /* ---------- prominence, phrases, arousal ---------- */
  const FUNC = new Set(('a an the of to in on at by for from with as is are was were be been am it its this that these those and or but if so than then there here i me my we us our you your he him his she her they them their what which who whom whose when where why how do does did has have had will would can could shall should may might must not no nor up out off over under again just very too also into about after before through during while s t d ll re ve m'
    + ' ah ma masel ye yer yous youse wi tae fae oan aff oot doon aboot efter intae isnae wisnae dinnae cannae didnae wouldnae couldnae shouldnae havenae hasnae willnae winnae arenae werenae gonnae gonna wanna gotta whit wis hud huv hus dae daein').split(' '));
  const isFunc = w => FUNC.has(String(w || '').replace(/[^a-z]/g, ''));
  const zs = a => { const m = median(a), d = median(a.map(v => Math.abs(v - m))) * 1.4826 || 1e-6; return a.map(v => cl((v - m) / d, -3, 3)); };
  /* A: LipSync's result (words [t0, t1, raw, index, plain], lev, fps). Adds A.pros. */
  function annotate(A, f0) {
    const fps = A.fps || FPS, lev = A.lev || A.env || new Float32Array(0), dur = A.dur || lev.length / fps, C = contour(f0 || new Float32Array(lev.length)), n = C.st.length;
    const at = (arr, t) => { const i = Math.round(t * fps); return i < 0 ? arr[0] || 0 : i >= arr.length ? arr[arr.length - 1] || 0 : arr[i]; };
    // the units stress is judged on: the words, or with no words the syllable peaks of the level
    let U = (A.words || []).map((w, i) => ({ a: w[0], b: Math.max(w[1], w[0] + 0.04), w: i, plain: w[4], raw: String(w[2] || '') }));
    if (!U.length) { for (let i = 3; i < lev.length - 3; i++) { const v = lev[i]; if (v < 0.3 || v < lev[i - 1] || v < lev[i + 1] || v < lev[i - 3] || v < lev[i + 3]) continue; let lo2 = v; for (let k = 1; k <= 12 && i - k >= 0; k++) lo2 = Math.min(lo2, lev[i - k]); if (v - lo2 < 0.05) continue; if (U.length && i / fps - U[U.length - 1].a < 0.14) continue; U.push({ a: i / fps - 0.07, b: i / fps + 0.09, w: -1, plain: '', raw: '' }); } }
    // the slow line the pitch hangs off (it drifts down through a sentence): each word is judged against it
    const base = new Float32Array(n); { const W = 120, ps = new Float64Array(n + 1); for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + C.st[i]; for (let i = 0; i < n; i++) { const a = Math.max(0, i - W), b = Math.min(n, i + W + 1); base[i] = (ps[b] - ps[a]) / (b - a); } }
    U.forEach(u => { const i0 = Math.max(0, Math.floor(u.a * fps)), i1 = Math.min(n - 1, Math.ceil(u.b * fps)); let pk = 0, pt = (u.a + u.b) / 2, fmax = -99, fmin = 99, ft = pt, vc = 0;
      for (let i = i0; i <= i1; i++) { if ((lev[i] || 0) > pk) { pk = lev[i]; pt = i / fps; } if (C.voiced[i]) { vc++; const e = C.st[i] - base[i]; if (e > fmax) { fmax = e; ft = i / fps; } if (e < fmin) fmin = e; } }
      const syl = Math.max(1, (String(u.plain).match(/[aeiouy]+/g) || [1]).length);
      u.lv = pk; u.t = cl(pt, u.a, u.b); u.fx = vc ? fmax : 0; u.fr = vc ? fmax - fmin : 0; u.ft = ft; u.len = (u.b - u.a) / syl; });
    const zE = zs(U.map(u => u.lv)), zF = zs(U.map(u => u.fx)), zR = zs(U.map(u => u.fr)), zD = zs(U.map(u => Math.log(u.len + 0.02)));
    U.forEach((u, i) => { const z = 0.36 * zF[i] + 0.34 * zE[i] + 0.14 * zR[i] + 0.16 * zD[i]; u.prom = cl(1 / (1 + Math.exp(-1.6 * (z - 0.15))) * (u.w >= 0 && isFunc(u.plain) ? 0.6 : 1), 0, 1); });
    // accents: words that stand out from their neighbours, not too close together
    const acc = []; U.forEach((u, i) => { const p = U[i - 1], q = U[i + 1]; if (u.prom < 0.42) return; if ((p && p.prom > u.prom && u.t - p.t < 0.3) || (q && q.prom > u.prom && q.t - u.t < 0.3)) return; if (acc.length && u.t - acc[acc.length - 1].t < 0.22) { if (u.prom > acc[acc.length - 1].s) acc[acc.length - 1] = { t: u.t, w: u.w, s: u.prom }; return; } acc.push({ t: u.t, w: u.w, s: u.prom }); });
    // intonation phrases: speech between pauses, or to the end of a sentence
    const ips = []; let cur = [];
    U.forEach((u, i) => { cur.push(i); const nx = U[i + 1], gap = nx ? nx.a - u.b : 9, punct = /[.!?;:]["')\]]*$/.test(u.raw), comma = /[,—–-]["')\]]*$/.test(u.raw);
      if (punct || gap > 0.28 || (comma && gap > 0.1)) { const a = U[cur[0]].a, b = u.b; ips.push({ a, b, u: cur, gap: Math.min(gap, 9), sent: punct || !nx, q: /\?/.test(u.raw), ex: /!/.test(u.raw) }); cur = []; } });
    if (cur.length) ips.push({ a: U[cur[0]].a, b: U[cur[cur.length - 1]].b, u: cur, gap: 9, sent: true, q: false, ex: false });
    // arousal: louder, higher, wider and quicker than his usual, 0 to 1 with his usual at about 0.4
    const stat = ips.map(P => { let l = 0, c = 0, f = 0, fc = 0, mx = -99, mn = 99; for (let i = Math.floor(P.a * fps); i <= Math.min(n - 1, P.b * fps); i++) { l += lev[i] || 0; c++; if (C.voiced[i]) { f += C.st[i]; fc++; mx = Math.max(mx, C.st[i]); mn = Math.min(mn, C.st[i]); } } return [c ? l / c : 0, fc ? f / fc : 0, fc ? mx - mn : 0, P.u.length / Math.max(0.3, P.b - P.a)]; });
    const zz = [0, 1, 2, 3].map(k => zs(stat.map(s => s[k])));
    ips.forEach((P, i) => { const z = 0.4 * zz[0][i] + 0.3 * zz[1][i] + 0.2 * zz[2][i] + 0.1 * zz[3][i]; P.arousal = cl(0.4 + 0.22 * z, 0, 1); P.level = stat[i][0]; P.f0 = stat[i][1]; P.range = stat[i][2]; P.rate = stat[i][3];
      // how it ends: the last voiced stretch against the bit before it
      let e = Math.min(n - 1, Math.round(P.b * fps)), k = 0, s1 = 0, c1 = 0, s2 = 0, c2 = 0; for (let j = e; j >= Math.max(0, e - 60) && k < 45; j--) { if (!C.voiced[j]) continue; k++; if (k <= 15) { s1 += C.st[j]; c1++; } else { s2 += C.st[j]; c2++; } }
      const d = c1 && c2 ? s1 / c1 - s2 / c2 : 0; P.end = d > 1.5 ? 'rise' : d < -1.5 ? 'fall' : 'level';
      P.peak = P.u.reduce((m, j) => U[j].prom > U[m].prom ? j : m, P.u[0]); });
    A.pros = { fps, st: C.st, voiced: C.voiced, med: C.med, lo: C.lo, hi: C.hi, share: C.share, units: U.map(u => ({ a: u.a, b: u.b, w: u.w, t: u.t, prom: +u.prom.toFixed(3), fx: +u.fx.toFixed(2), lv: +u.lv.toFixed(3) })), accents: acc, ips, heard: !!f0 };
    return A;
  }
  return { pitch, contour, annotate, isFunc, FPS };
})();
if (typeof module !== 'undefined') module.exports = Prosody;

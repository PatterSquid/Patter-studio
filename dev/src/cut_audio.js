/* CutAudio: the editor's sound.
   One set of rules (volume in dB, fades, volume keyframes, track volume, mute and solo, lowering music under talking,
   noise reduction, voice enhance, speed with the pitch kept) drives both the live preview, through hidden audio elements,
   and the export, which mixes exactly in blocks and hands the result to the AAC (or Opus) encoder and the MP4 writer. */
const CutAudio = (() => {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const dbLin = db => db <= -59.9 ? 0 : Math.pow(10, db / 20);
  const SR = 48000, RATE = 100;            // mix rate, and the rate of the gain curves (a hundredth of a second)
  const V = () => Video;
  const M = id => typeof CutMedia !== 'undefined' ? CutMedia.info(id) : null;

  /* ---------- What makes sound, and how loud ---------- */
  // Every clip that makes sound: footage on the main and overlay tracks (unless muted), and clips on audio tracks
  function sources(cfg, look) {
    const out = [], tracks = cfg.tracks || [], anySolo = tracks.some(T => T.solo) || !!cfg.mainSolo;
    const add = (it, t0, d, T, main) => { if (!it || !it.asset || it.mute) return; const m = M(it.asset); if (!m || m.kind === 'image' || m.hasAudio === false || it.still != null) return;
      if (main ? cfg.mainMute : T && T.mute) return; if (anySolo && !(main ? cfg.mainSolo : T && T.solo)) return;
      out.push({ it, t0, d, T, main, asset: it.asset, speed: V().speedOf(it), keep: it.pitch !== false, talk: main ? cfg.mainTalk !== false : !!(T && T.talk), duck: !main && !!(T && T.duck), trackDb: main ? (+cfg.mainVol || 0) : (+(T && T.vol) || 0) }); };
    V().layout(cfg, look).forEach(o => { if (o.it.kind === 'media') { add(o.it, o.t0, o.d, null, true); const s = out[out.length - 1]; if (s && s.it === o.it) { s.trIn = o.trIn || 0; s.trOut = o.trOut || 0; } } });
    tracks.forEach(T => (T.items || []).forEach(it => { if (it.kind === 'media' || it.kind === 'audio') add(it, +it.start || 0, V().lenOf(it, look), T, false); }));
    return out;
  }
  // A clip's own gain at a moment (seconds into the clip): volume, its keyframes, fades, and the track's volume
  function clipGain(s, local) {
    const it = s.it; let db = V().kfAt(it, 'vol', local, +it.vol || 0) + s.trackDb, g = dbLin(cl(db, -60, 24));
    const fi = +it.fadeIn || 0, fo = +it.fadeOut || 0;
    if (fi > 0 && local < fi) g *= Math.sin(cl(local / fi, 0, 1) * Math.PI / 2);
    if (fo > 0 && local > s.d - fo) g *= Math.sin(cl((s.d - local) / fo, 0, 1) * Math.PI / 2);
    // Transitions on the main track crossfade the sound too
    if (s.trIn > 0 && local < s.trIn) g *= Math.sin(cl(local / s.trIn, 0, 1) * Math.PI / 2);
    if (s.trOut > 0 && local > s.d - s.trOut) g *= Math.sin(cl((s.d - local) / s.trOut, 0, 1) * Math.PI / 2);
    return g;
  }
  // Noise reduction: quiet stretches (between words) are pulled down, using the clip's own level
  function gateGain(s, local) { const it = s.it; if (!it.denoise) return 1; const amt = cl(it.denoise === true ? 60 : +it.denoise, 0, 100) / 100, src = V().srcTime(it, local); let lv = 0; for (let k = -2; k <= 2; k++) lv = Math.max(lv, CutMedia.peakAt(s.asset, src + k * 0.02)); const thr = 0.16 + amt * 0.12; return lv >= thr ? 1 : 1 - amt * 0.75 * cl(1 - lv / thr, 0, 1); }
  // Lowering music under talking: one curve for the whole video, a hundredth of a second a step, cached until anything changes
  let duckKey = '', duckCurve = null;
  function ducking(cfg, look) {
    const S = sources(cfg, look); if (!S.some(s => s.duck)) return null;
    const key = JSON.stringify([cfg.items, cfg.tracks, cfg.duckDb, cfg.mainVol, cfg.mainMute]) + (typeof CutMedia !== 'undefined' ? CutMedia.version : 0); if (key === duckKey) return duckCurve;
    const dur = V().duration(cfg, look), n = Math.ceil(dur * RATE) + 1, lv = new Float32Array(n), talk = S.filter(s => s.talk);
    talk.forEach(s => { const i0 = Math.max(0, Math.floor(s.t0 * RATE)), i1 = Math.min(n, Math.ceil((s.t0 + s.d) * RATE)); for (let i = i0; i < i1; i++) { const local = i / RATE - s.t0, v = CutMedia.peakAt(s.asset, V().srcTime(s.it, local)) * Math.sqrt(clipGain(s, local)); if (v > lv[i]) lv[i] = v; } });
    const low = dbLin(-cl(cfg.duckDb == null ? 12 : +cfg.duckDb, 0, 40)), out = new Float32Array(n), att = 1 - Math.exp(-1 / (0.06 * RATE)), rel = 1 - Math.exp(-1 / (0.45 * RATE));
    // Hold for a short while after each word so the music doesn't pump between them
    let g = 1, hold = 0; for (let i = 0; i < n; i++) { if (lv[i] > 0.12) hold = Math.round(0.35 * RATE); else if (hold > 0) hold--; const tgt = hold > 0 ? low : 1; g += (tgt - g) * (tgt < g ? att : rel); out[i] = g; }
    duckKey = key; duckCurve = out; return out;
  }
  const duckAt = (curve, t) => { if (!curve) return 1; const i = Math.floor(t * RATE); return i < 0 ? 1 : i >= curve.length ? curve[curve.length - 1] : curve[i]; };
  // The whole gain of a source at timeline time t
  function gainAt(s, t, curve) { const local = t - s.t0; return clipGain(s, local) * gateGain(s, local) * (s.duck ? duckAt(curve, t) : 1); }

  /* ---------- Voice enhance: cleaner, closer, more even ---------- */
  function enhanceChain(ctx, input, amt) {
    amt = amt === true ? 1 : cl(+amt || 0, 0, 100) / 100; if (!amt) return input;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85; hp.Q.value = 0.7;
    const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 280; mud.Q.value = 1; mud.gain.value = -3 * amt;
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 0.9; pres.gain.value = 4 * amt;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 2 * amt;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24 + 6 * (1 - amt); comp.ratio.value = 1 + 3 * amt; comp.knee.value = 8; comp.attack.value = 0.005; comp.release.value = 0.16;
    const make = ctx.createGain(); make.gain.value = dbLin(4 * amt);
    input.connect(hp); hp.connect(mud); mud.connect(pres); pres.connect(air); air.connect(comp); comp.connect(make); return make;
  }
  // Keeps the mix from clipping: a fast, gentle limiter on the master
  function limiter(ctx) { const c = ctx.createDynamicsCompressor(); c.threshold.value = -2; c.knee.value = 2; c.ratio.value = 20; c.attack.value = 0.002; c.release.value = 0.12; return c; }

  /* ---------- Live preview ---------- */
  let ac = null, master = null, lim = null, meterNode = null; const live = new Map(); let lastSync = 0, playingNow = false;
  function ensure() { if (ac) return ac; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC({ latencyHint: 'interactive' }); master = ac.createGain(); lim = limiter(ac); meterNode = ac.createAnalyser(); meterNode.fftSize = 1024; master.connect(lim); lim.connect(meterNode); meterNode.connect(ac.destination); return ac; }
  function node(s) {
    let n = live.get(s.it.id); if (n && n.asset === s.asset && n.enh === JSON.stringify(s.it.enhance || 0)) return n; if (n) dropNode(s.it.id);
    n = { asset: s.asset, el: null, gain: ac.createGain(), enh: JSON.stringify(s.it.enhance || 0), used: 0 }; n.gain.gain.value = 0; const out = enhanceChain(ac, n.gain, s.it.enhance); out.connect(master); n.out = out; live.set(s.it.id, n);
    CutMedia.urlOf(s.asset).then(u => { if (!u || live.get(s.it.id) !== n) return; const el = new Audio(); el.preload = 'auto'; el.src = u; el.crossOrigin = 'anonymous'; try { el.preservesPitch = true; } catch (e) { } const src = ac.createMediaElementSource(el); src.connect(n.gain); n.el = el; });
    return n;
  }
  function dropNode(id) { const n = live.get(id); if (!n) return; try { if (n.el) { n.el.pause(); n.el.removeAttribute('src'); n.el.load(); } n.gain.disconnect(); n.out.disconnect(); } catch (e) { } live.delete(id); }
  // Called every preview frame with the playhead
  function sync(cfg, look, t, playing) {
    if (!playing) { if (playingNow) { live.forEach(n => { if (n.el && !n.el.paused) n.el.pause(); }); playingNow = false; } return; }
    if (!ensure()) return; if (ac.state === 'suspended') ac.resume().catch(() => { }); playingNow = true;
    const S = sources(cfg, look), curve = ducking(cfg, look), now = performance.now(), active = new Set();
    for (const s of S) {
      if (t < s.t0 - 0.02 || t >= s.t0 + s.d || s.it.rev) continue; active.add(s.it.id);
      const n = node(s); n.used = now; const el = n.el; if (!el || el.readyState < 1) continue;
      const want = V().srcTime(s.it, t - s.t0), rate = s.speed;
      try { el.preservesPitch = s.keep; } catch (e) { }
      const drift = el.currentTime - want; let r = rate;
      if (el.paused) { el.currentTime = want + 0.02 * rate; el.play().catch(() => { }); }
      else if (Math.abs(drift) > 0.25 * Math.max(1, rate)) el.currentTime = want + 0.03 * rate;
      else if (Math.abs(drift) > 0.012) r = rate * (1 - cl(drift * 1.6, -0.1, 0.1));
      if (Math.abs(el.playbackRate - r) > 1e-3) { try { el.playbackRate = cl(r, 0.0625, 16); } catch (e) { } }
      n.gain.gain.setTargetAtTime(gainAt(s, t, curve), ac.currentTime, 0.012);
    }
    live.forEach((n, id) => { if (!active.has(id)) { if (n.el && !n.el.paused) n.el.pause(); n.gain.gain.setTargetAtTime(0, ac.currentTime, 0.01); if (now - n.used > 8000) dropNode(id); } });
    lastSync = now;
  }
  function stopAll() { live.forEach(n => { if (n.el && !n.el.paused) n.el.pause(); }); playingNow = false; }
  // Loudness of the preview right now (for the meter), 0..1
  function meter() { if (!meterNode || !playingNow) return 0; const d = new Float32Array(meterNode.fftSize); meterNode.getFloatTimeDomainData(d); let m = 0; for (const x of d) m = Math.max(m, Math.abs(x)); return m; }

  /* ---------- Speed with the pitch kept: WSOLA time stretch ---------- */
  function stretch(chans, sr, factor) {
    if (Math.abs(factor - 1) < 1e-3) return chans;
    const N = Math.round(sr * 0.042) & ~1, Hs = N >> 1, Ha = Hs / factor, tol = Math.round(sr * 0.012), inLen = chans[0].length, outLen = Math.max(1, Math.round(inLen * factor));
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const mono = new Float32Array(inLen); for (const c of chans) for (let i = 0; i < inLen; i++) mono[i] += c[i] / chans.length;
    const outs = chans.map(() => new Float32Array(outLen + N)), norm = new Float32Array(outLen + N);
    let prev = 0;
    for (let k = 0, op = 0; op < outLen; k++, op += Hs) {
      const ideal = Math.round(k * Ha); let best = ideal;
      if (k > 0) { const nat = prev + Hs; let bs = -Infinity; for (let d = -tol; d <= tol; d += 2) { const p = ideal + d; if (p < 0 || p + Hs >= inLen) continue; let s = 0; for (let j = 0; j < Hs; j += 4) s += mono[nat + j] * mono[p + j] || 0; if (s > bs) { bs = s; best = p; } } }
      best = cl(best, 0, Math.max(0, inLen - N)); prev = best;
      for (let c = 0; c < chans.length; c++) { const src = chans[c], o = outs[c]; for (let j = 0; j < N; j++) { const i = best + j; if (i < inLen) o[op + j] += src[i] * win[j]; } }
      for (let j = 0; j < N; j++) norm[op + j] += win[j];
    }
    return outs.map(o => { const r = new Float32Array(outLen); for (let i = 0; i < outLen; i++) r[i] = norm[i] > 1e-3 ? o[i] / norm[i] : 0; return r; });
  }

  /* ---------- Export mix: blocks of a few seconds, each warmed up first so filters carry on smoothly ---------- */
  // mix(cfg, look, t0, t1, { onBlock(planar [L, R], startSample), signal }) -> resolves when done
  async function mix(cfg, look, t0, t1, { onBlock, signal, block = 8 } = {}) {
    const S = sources(cfg, look).filter(s => s.t0 < t1 && s.t0 + s.d > t0), curve = ducking(cfg, look), readers = new Map(), PRE = 0.5, XF = Math.round(0.02 * SR);
    const reader = async id => { if (!readers.has(id)) readers.set(id, await CutMedia.audioReader(id).catch(() => null)); return readers.get(id); };
    let tail = null;
    try {
      for (let c0 = t0; c0 < t1 - 1e-6; c0 += block) {
        if (signal && signal.aborted) throw new Error('Export cancelled.');
        const c1 = Math.min(t1, c0 + block), a = c0 - PRE, len = Math.round((c1 - a) * SR) + XF, ctx = new OfflineAudioContext(2, len, SR), mst = ctx.createGain(), lm = limiter(ctx); mst.connect(lm); lm.connect(ctx.destination);
        for (const s of S) {
          const la = Math.max(0, a - s.t0), lb = Math.min(s.d, c1 + XF / SR - s.t0); if (lb <= la) continue;
          const R = await reader(s.asset); if (!R) continue;
          let sa = V().srcTime(s.it, la), sb = V().srcTime(s.it, lb); if (s.it.rev) [sa, sb] = [sb, sa]; sb = Math.max(sa + 1 / R.sr, sb);
          let pcm = await R.read(sa, sb); if (!pcm || !pcm.length || !pcm[0].length) continue;
          if (s.it.rev) pcm = pcm.map(c => c.slice().reverse());
          let rate = 1; if (Math.abs(s.speed - 1) > 1e-3) { if (s.keep) pcm = stretch(pcm, R.sr, 1 / s.speed); else rate = s.speed; }
          const buf = ctx.createBuffer(pcm.length, pcm[0].length, R.sr); pcm.forEach((c, i) => buf.copyToChannel(c, i));
          const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
          const gn = ctx.createGain(), when = s.t0 + la - a, span = lb - la, steps = Math.max(2, Math.ceil(span * RATE) + 1), crv = new Float32Array(steps);
          for (let i = 0; i < steps; i++) crv[i] = gainAt(s, s.t0 + la + i / RATE, curve);
          gn.gain.setValueAtTime(crv[0], when); try { gn.gain.setValueCurveAtTime(crv, when, Math.max(0.01, (steps - 1) / RATE)); } catch (e) { }
          src.connect(gn); enhanceChain(ctx, gn, s.it.enhance).connect(mst); src.start(when, 0);
        }
        const out = await ctx.startRendering(), skip = Math.round(PRE * SR), n = Math.round((c1 - c0) * SR), L = out.getChannelData(0).slice(skip, skip + n + XF), Rr = out.getChannelData(1).slice(skip, skip + n + XF);
        // Crossfade the join with the end of the last block
        if (tail) for (let i = 0; i < XF && i < n; i++) { const w = i / XF; L[i] = tail[0][i] * (1 - w) + L[i] * w; Rr[i] = tail[1][i] * (1 - w) + Rr[i] * w; }
        tail = [L.slice(n, n + XF), Rr.slice(n, n + XF)];
        await onBlock([L.subarray(0, n), Rr.subarray(0, n)], Math.round((c0 - t0) * SR));
      }
    } finally { readers.forEach(R => R && R.close && R.close()); if (typeof CutMedia !== 'undefined') CutMedia.releaseAudio(); }
  }
  const hasSound = (cfg, look) => sources(cfg, look).length > 0;

  /* ---------- Encoding ---------- */
  async function pickEncoder(prefer) {
    if (typeof AudioEncoder === 'undefined') return null;
    for (const codec of prefer === 'opus' ? ['opus', 'mp4a.40.2'] : ['mp4a.40.2', 'opus']) { const c = { codec, sampleRate: SR, numberOfChannels: 2, bitrate: codec === 'opus' ? 160000 : 256000 }; try { const r = await AudioEncoder.isConfigSupported(c); if (r.supported) return r.config; } catch (e) { } }
    return null;
  }
  // Streams planar blocks in, encoded packets out (to onPacket(data, durSamples, desc))
  function encoder(config, onPacket) {
    let err = null, desc = null, ts = 0, pending = Promise.resolve();
    const enc = new AudioEncoder({ output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) desc = new Uint8Array(meta.decoderConfig.description); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); const dur = Math.round((chunk.duration || (1024 / SR * 1e6)) * SR / 1e6); pending = pending.then(() => onPacket(d, dur, desc)); }, error: e => { err = e; } });
    enc.configure(config);
    return {
      async add([L, R]) { if (err) throw err; const n = L.length; if (!n) return; for (let o = 0; o < n; o += SR) { const m = Math.min(SR, n - o), data = new Float32Array(m * 2); data.set(L.subarray(o, o + m), 0); data.set(R.subarray(o, o + m), m);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round(ts / SR * 1e6), data }); enc.encode(ad); ad.close(); ts += m; while (enc.encodeQueueSize > 20) await new Promise(r => setTimeout(r, 2)); } },
      async finish() { await enc.flush(); await pending; try { enc.close(); } catch (e) { } if (err) throw err; return desc; },
      get desc() { return desc; }, codec: config.codec,
    };
  }
  // A WAV file, written as it goes (16 bit stereo, or 24 bit)
  function wavHeader(frames, bits = 16) { const ch = 2, bps = bits / 8, data = frames * ch * bps, b = new ArrayBuffer(44), v = new DataView(b); const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    s(0, 'RIFF'); v.setUint32(4, 36 + data, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, SR, true); v.setUint32(28, SR * ch * bps, true); v.setUint16(32, ch * bps, true); v.setUint16(34, bits, true); s(36, 'data'); v.setUint32(40, data, true); return new Uint8Array(b); }
  function wavBlock([L, R], bits = 16) { const n = L.length, bps = bits / 8, out = new Uint8Array(n * 2 * bps), v = new DataView(out.buffer);
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const x = cl((c ? R : L)[i], -1, 1), o = (i * 2 + c) * bps; if (bits === 24) { const q = Math.round(x * 8388607); v.setUint8(o, q & 255); v.setUint8(o + 1, (q >> 8) & 255); v.setUint8(o + 2, (q >> 16) & 255); } else v.setInt16(o, Math.round(x * 32767), true); } return out; }

  return { sources, clipGain, gainAt, ducking, sync, stopAll, meter, mix, stretch, hasSound, pickEncoder, encoder, wavHeader, wavBlock, dbLin, SR, get context() { return ac; } };
})();

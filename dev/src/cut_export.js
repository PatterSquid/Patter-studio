/* CutExport: renders the editor's timeline to an MP4 with sound (H.264 and AAC where the computer can, otherwise the next
   best), or to a PNG sequence, and optionally a WAV of the mix. Every footage frame is decoded exactly; the sound is mixed
   in blocks alongside the pictures; everything streams to the file as it goes, so long videos never fill the memory. */
const CutExport = (() => {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const RES = { '720': 720, '1080': 1080, '1440': 1440, '2160': 2160 };
  const QUAL = { low: 0.07, normal: 0.12, high: 0.2, master: 0.32 };
  async function pickVideo(W, H, fps, quality) {
    const br = Math.round(cl(W * H * fps * (QUAL[quality] || QUAL.high), 2e6, 120e6));
    const list = [['avc1.640034', 'avc'], ['avc1.640033', 'avc'], ['avc1.64002A', 'avc'], ['avc1.640028', 'avc'], ['avc1.4D402A', 'avc'], ['hvc1.1.6.L153.B0', 'hevc'], ['vp09.00.41.08', 'vp9'], ['av01.0.08M.08', 'av1']];
    for (const [codec, fam] of list) for (const hw of ['prefer-hardware', 'no-preference']) {
      const c = { codec, width: W, height: H, framerate: fps, bitrate: br, bitrateMode: 'variable', latencyMode: 'quality', hardwareAcceleration: hw }; if (fam === 'avc') c.avc = { format: 'avc' }; if (fam === 'hevc') c.hevc = { format: 'hevc' };
      try { const s = await VideoEncoder.isConfigSupported(c); if (s.supported) return Object.assign(s.config, { fam }); } catch (e) { }
    }
    return null;
  }
  // Which tab clips move fast enough to need motion blur, using the clip's own hint (no measuring)
  const blurN = (fps, W, H) => (Mo, cfg, L, tt) => { try { const h = Mo.blurHint ? Mo.blurHint(cfg, L, tt, fps, W, H) : null; return h ? h : 1; } catch (e) { return 1; } };

  /* run(cfg, look, opts): opts { fps, res, quality, range, audio (true/false), wav (true/false), png (true/false), sink, wavSink, dir, onProgress(p, info), signal, blur } */
  async function run(cfg, look, o = {}) {
    if (document.fonts) await document.fonts.ready;
    if (typeof PatterIntro !== 'undefined' && (cfg.items || []).some(it => it && it.kind === 'intro')) { await PatterIntro.ready(); await PatterIntro.ensureSound().catch(() => null); }
    if (typeof Intro !== 'undefined') { const tabIntros = [...(cfg.items || []), ...(cfg.tracks || []).flatMap(T => (T && T.items) || [])].filter(it => it && it.kind === 'clip' && it.mod === 'intro' && it.cfg); if (tabIntros.length) { await Intro.ready(); for (const it of tabIntros) await Intro.ensureSound(it.cfg).catch(() => null); } }
    if (typeof Character !== 'undefined') for (const it of [...(cfg.items || []), ...(cfg.tracks || []).flatMap(T => (T && T.items) || [])]) if (it && it.kind === 'clip' && it.mod === 'char' && it.cfg) await Character.prepare(it.cfg).catch(() => null);
    const Vw = Layers.wrap(Video), base = E.dims(look.format), fps = o.fps || 30, scale = (RES[o.res] || base.H) / (look.format === '9:16' ? base.W : base.H);
    const W = Math.round(base.W * scale / 2) * 2, H = Math.round(base.H * scale / 2) * 2, dur = Vw.duration(cfg, look);
    const t0 = o.range ? cl(o.range[0], 0, dur) : 0, t1 = o.range ? cl(o.range[1], t0 + 1 / fps, dur) : dur, n = Math.max(1, Math.round((t1 - t0) * fps));
    const lookX = Object.assign({}, look, { preview: false, transparent: !!o.png && !!look.transparent, paused: true });
    const say = (p, msg) => o.onProgress && o.onProgress(p, msg);
    // Our own stop signal: follows the caller's, and also fires when anything fails, so the sound mixing stops with it
    const stopper = new AbortController(), signal = stopper.signal; if (o.signal) { if (o.signal.aborted) stopper.abort(); else o.signal.addEventListener('abort', () => stopper.abort(), { once: true }); }
    let venc = null, aenc = null, sink = null, wavSink = null, ok = false;
    // Everything the video uses, loaded first
    say(0, 'Getting your footage ready…');
    const ids = Video.assetsUsed(cfg); for (const id of ids) { if (!(await CutMedia.blobOf(id))) throw new Error('A file used in the video is missing from this computer: ' + ((CutMedia.info(id) || {}).name || id) + '. Import it again or remove it.'); }
    const images = new Map(); for (const id of Video.imagesUsed(cfg)) images.set(id, await CutMedia.bitmap(id));
    if (typeof Media !== 'undefined' && Video.mediaFor) await Media.ensure(Video.mediaFor(cfg));
    if (Video.needsMap(cfg) && typeof GeoData !== 'undefined') { GeoData.load(); if (GeoData.full) { say(0, 'Loading the full detail map…'); try { await GeoData.full; } catch (e) { } } }
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }), ctx = canvas.getContext('2d', { alpha: !!lookX.transparent });
    const readers = new Map(), lastUse = new Map();
    const getFrame = async f => { let R = readers.get(f.id); if (!R) { R = await CutMedia.videoReader(f.asset); readers.set(f.id, R); } lastUse.set(f.id, performance.now()); return { img: await R.frame(f.src), rot: R.rot || 0 }; };
    const closeIdle = live => { readers.forEach((R, id) => { if (!live.has(id)) { try { R.close(); } catch (e) { } readers.delete(id); } }); };
    const drawFrame = async (i) => {
      const t = t0 + i / fps, fr = new Map(), live = new Set();
      for (const f of Video.framesAt(cfg, lookX, t)) { live.add(f.id); fr.set(f.id, await getFrame(f)); }
      if (i % 30 === 0) closeIdle(live);
      if (typeof Media !== 'undefined' && Video.mediaAt) await Media.prepare(Video.mediaAt(cfg, t, lookX));
      ctx.setTransform(1, 0, 0, 1, 0, 0); if (lookX.transparent) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      Vw.draw(ctx, t, cfg, Object.assign({}, lookX, { cutEnv: { frames: fr, images, k: scale, fps, blur: o.blur !== 'off', blurN: o.blur !== 'off' ? blurN(fps, base.W, base.H) : null } }), base.W, base.H);
    };
    const tStart = performance.now(), prog = (i, extra) => { const p = i / n, el = (performance.now() - tStart) / 1000, left = p > 0.02 ? el / p - el : 0; say(p, `Rendering ${Math.round(p * 100)}%` + (left ? `, about ${left > 90 ? Math.ceil(left / 60) + ' min' : Math.ceil(left) + ' s'} left` : '') + (extra || '')); };
    try {
      /* PNG sequence (see through), for After Effects */
      if (o.png) {
        const toPng = c => c.convertToBlob ? c.convertToBlob({ type: 'image/png' }) : new Promise(r => c.toBlob(r, 'image/png')); const zip = o.dir ? null : E.Zip();
        for (let i = 0; i < n; i++) { if (signal.aborted) throw new Error('Export cancelled.'); await drawFrame(i); const b = await toPng(canvas), name = 'frame_' + String(i).padStart(5, '0') + '.png';
          if (o.dir) { const fh = await o.dir.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(b); await w.close(); } else zip.add(name, new Uint8Array(await b.arrayBuffer())); if (i % 3 === 0) prog(i); }
        let wav = null; if (o.wav && CutAudio.hasSound(cfg, lookX)) wav = await wavOnly(cfg, lookX, t0, t1, Object.assign({}, o, { signal })); ok = true;
        return { zip: zip ? zip.blob() : null, wav, frames: n, W, H };
      }
      /* MP4 */
      if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video. Use Microsoft Edge or Google Chrome.');
      const vcfg = await pickVideo(W, H, fps, o.quality || 'high'); if (!vcfg) throw new Error('No video encoder is available at ' + W + ' x ' + H + '. Try a lower resolution.');
      const withAudio = o.audio !== false && CutAudio.hasSound(cfg, lookX), acfg = withAudio ? await CutAudio.pickEncoder() : null;
      sink = o.sink || MP4Out.blobSink();
      let vdesc = null, err = null; const vq = [];
      // Video packets wait until the encoder has said how it is set up (the first packet carries that)
      let mux = null, aq = [], adesc = null;
      const ensureMux = () => { if (mux) return mux; const vtrack = { codec: vcfg.codec, width: W, height: H, timescale: fps * 1000, description: vdesc, shift: reorder || 0 }; if (acfg && acfg.codec === 'opus' && adesc && adesc.length >= 12) acfg.preskip = adesc[10] | (adesc[11] << 8); mux = MP4Out.create({ video: vtrack, audio: acfg ? { codec: acfg.codec, sampleRate: CutAudio.SR, channels: 2, description: adesc, bitrate: acfg.bitrate, preskip: acfg.preskip } : null, sink }); return mux; };
      let muxChain = Promise.resolve(); const muxAdd = (...a) => { muxChain = muxChain.then(() => ensureMux().add(...a)).catch(e => { err = e; }); return muxChain; };
      let vReady = false, aReady = !acfg;
      const flushQueues = () => { if (!vReady || !aReady) return; vq.splice(0).forEach(p => muxAdd('video', ...p)); aq.splice(0).forEach(p => muxAdd('audio', ...p)); };
      // Encoders that reorder frames (B frames): the first packets show how far, so every frame's display offset stays positive
      let vIdx = 0, reorder = null; const early = [];
      const vOut = (d, ts, key) => { const pts = Math.round(ts * fps * 1000 / 1e6), dts = vIdx++ * 1000; early.push([d, pts, dts, key]);
        if (reorder === null && early.length < 16) return; if (reorder === null) reorder = Math.max(0, ...early.map(e => e[2] - e[1]));
        early.splice(0).forEach(([dd, p2, d2, k2]) => vq.push([dd, 1000, p2 - d2 + reorder, k2])); vReady = true; flushQueues(); };
      venc = new VideoEncoder({ output: (chunk, meta) => { if (!vdesc && meta && meta.decoderConfig && meta.decoderConfig.description) vdesc = new Uint8Array(meta.decoderConfig.description); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); vOut(d, chunk.timestamp, chunk.type === 'key'); }, error: e => { err = e; } });
      const vconf = Object.assign({}, vcfg); delete vconf.fam; venc.configure(vconf);
      // B-frames would need composition offsets; encoders here give frames in order, so the offset is the timestamp minus the decode position
      // Sound runs alongside, a little ahead of the pictures
      let videoT = 0, audioErr = null, audioDone = !acfg; wavSink = o.wav && o.wavSink ? o.wavSink : null; let wavFrames = 0;
      if (wavSink) await wavSink.write(CutAudio.wavHeader(0));
      aenc = acfg ? CutAudio.encoder(acfg, (d, dur, desc) => { if (desc && !adesc) adesc = desc; aReady = true; aq.push([d, dur, 0, true]); flushQueues(); }) : null;
      const audioTask = (acfg || wavSink) && CutAudio.hasSound(cfg, lookX) ? CutAudio.mix(cfg, lookX, t0, t1, { signal, onBlock: async (pl, start) => { if (aenc) await aenc.add(pl); if (wavSink) { await wavSink.write(CutAudio.wavBlock(pl)); wavFrames += pl[0].length; } while ((start / CutAudio.SR) > videoT + 12 && !err && !signal.aborted) await sleep(15); } })
        .then(() => { audioDone = true; }).catch(e => { audioErr = e; audioDone = true; }) : (audioDone = true, null);
      for (let i = 0; i < n; i++) {
        if (signal.aborted) throw new Error('Export cancelled.'); if (err) throw err; if (audioErr) throw audioErr;
        await drawFrame(i); videoT = i / fps;
        const vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) }); venc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
        while (venc.encodeQueueSize > 6) await sleep(2);
        if (i % 3 === 0) prog(i);
      }
      videoT = 1e9; await venc.flush(); try { venc.close(); } catch (e) { }
      if (reorder === null) { reorder = Math.max(0, ...early.map(e => e[2] - e[1]), 0); early.splice(0).forEach(([dd, p2, d2, k2]) => vq.push([dd, 1000, p2 - d2 + reorder, k2])); vReady = true; }
      say(0.99, 'Finishing the sound…');
      if (audioTask) await audioTask; if (audioErr) throw audioErr; if (aenc) { await aenc.finish(); }
      aReady = true; vReady = true; flushQueues(); await muxChain; if (err) throw err;
      if (!mux) ensureMux();
      await mux.finish(); await sink.close();
      if (wavSink) { if (wavSink.patch) await wavSink.patch(0, CutAudio.wavHeader(wavFrames)); await wavSink.close(); }
      ok = true; const blob = sink.blob ? await sink.blob('video/mp4') : null;
      return { blob, codec: vcfg.codec, fam: vcfg.fam, audio: acfg ? acfg.codec : null, frames: n, W, H, secs: (performance.now() - tStart) / 1000, bytes: mux.bytes, wavBlob: wavSink && wavSink.blob ? await wavSink.blob('audio/wav') : null };
    } finally {
      readers.forEach(R => { try { R.close(); } catch (e) { } }); readers.clear();
      // A failed or cancelled export lets go of the encoders (his PC has only a few hardware ones), stops the mixing and
      // throws away the half written file rather than leaving it open
      if (!ok) { stopper.abort(); try { if (venc && venc.state !== 'closed') venc.close(); } catch (e) { } if (aenc) aenc.close(); for (const s2 of [sink, wavSink]) if (s2 && s2.abort) await s2.abort(); }
    }
  }
  // The mix on its own, as a WAV
  async function wavOnly(cfg, look, t0, t1, o = {}) {
    const sink = o.wavSink || blobWav(); let frames = 0; await sink.write(CutAudio.wavHeader(0));
    await CutAudio.mix(cfg, look, t0, t1, { signal: o.signal, onBlock: async pl => { await sink.write(CutAudio.wavBlock(pl)); frames += pl[0].length; o.onProgress && o.onProgress(frames / CutAudio.SR / Math.max(0.01, t1 - t0), 'Mixing the sound…'); } });
    if (sink.patch) await sink.patch(0, CutAudio.wavHeader(frames)); await sink.close(); return sink.blob ? await sink.blob('audio/wav') : null;
  }
  function blobWav() { const s = MP4Out.blobSink(); return s; }
  // One frame at full quality as a PNG (for thumbnails), with every footage frame exact
  async function still(cfg, look, t, res) {
    if (typeof PatterIntro !== 'undefined') await PatterIntro.ready();
    if (document.fonts) await document.fonts.ready;
    const Vw = Layers.wrap(Video), base = E.dims(look.format), scale = (RES[res] || base.H) / (look.format === '9:16' ? base.W : base.H), W = Math.round(base.W * scale), H = Math.round(base.H * scale);
    const lookX = Object.assign({}, look, { preview: false, paused: true }), images = new Map(); for (const id of Video.imagesUsed(cfg)) images.set(id, await CutMedia.bitmap(id));
    if (typeof Media !== 'undefined' && Video.mediaFor) { await Media.ensure(Video.mediaFor(cfg)); await Media.prepare(Video.mediaAt(cfg, t, lookX)); }
    const fr = new Map(), readers = []; try { for (const f of Video.framesAt(cfg, lookX, t)) { const R = await CutMedia.videoReader(f.asset); readers.push(R); fr.set(f.id, { img: await R.frame(f.src), rot: R.rot || 0 }); }
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.setTransform(scale, 0, 0, scale, 0, 0);
      Vw.draw(g, t, cfg, Object.assign({}, lookX, { cutEnv: { frames: fr, images, k: scale, fps: 30 } }), base.W, base.H);
      return c.convertToBlob ? await c.convertToBlob({ type: 'image/png' }) : await new Promise(r => c.toBlob(r, 'image/png')); }
    finally { readers.forEach(R => { try { R.close(); } catch (e) { } }); }
  }
  return { run, wavOnly, still, pickVideo, RES, QUAL };
})();

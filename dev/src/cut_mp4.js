/* MP4 in and out for the editor.
   MP4In reads an MP4, MOV or M4A file (from a Blob, without loading it all) into tracks with sample tables, so WebCodecs can
   decode exactly the frames and sound wanted. MP4Out writes video plus sound as it goes, with 64 bit sizes, so long exports
   never have to sit in memory: chunks are handed to a sink (a file on disk, or Blob pieces). */
const MP4In = (() => {
  const td = new TextDecoder('latin1');
  const fourcc = (v, o) => td.decode(new Uint8Array(v.buffer, v.byteOffset + o, 4));
  const u64 = (v, o) => v.getUint32(o) * 4294967296 + v.getUint32(o + 4);
  const hex2 = n => (n & 255).toString(16).padStart(2, '0').toUpperCase();
  async function readRange(blob, a, b) { return new DataView(await blob.slice(a, b).arrayBuffer()); }

  // Walk the boxes inside [o, end) of a DataView
  function* boxes(v, o, end) {
    while (o + 8 <= end) {
      let size = v.getUint32(o), type = fourcc(v, o + 4), hdr = 8;
      if (size === 1) { size = u64(v, o + 8); hdr = 16; } else if (size === 0) size = end - o;
      if (size < hdr || o + size > end + 8) return;                       // damaged: stop rather than read nonsense
      yield { type, o, start: o + hdr, end: Math.min(end, o + size) };
      o += size;
    }
  }
  const child = (v, b, type) => { for (const c of boxes(v, b.start, b.end)) if (c.type === type) return c; return null; };
  const path = (v, b, ...types) => { let cur = b; for (const t of types) { cur = cur && child(v, cur, t); } return cur; };

  // Codec strings WebCodecs understands, from the codec's own settings box
  function avcString(v, b) { return 'avc1.' + hex2(v.getUint8(b.start + 1)) + hex2(v.getUint8(b.start + 2)) + hex2(v.getUint8(b.start + 3)); }
  function hevcString(v, b, fmt) {
    const s = b.start, p = v.getUint8(s + 1), space = p >> 6, tier = (p >> 5) & 1, prof = p & 31, compat = v.getUint32(s + 2), lvl = v.getUint8(s + 12);
    let rev = 0; for (let i = 0; i < 32; i++) if (compat & (1 << i)) rev |= 1 << (31 - i);
    const cons = []; for (let i = 0; i < 6; i++) cons.push(v.getUint8(s + 6 + i)); while (cons.length && !cons[cons.length - 1]) cons.pop();
    return fmt + '.' + (['', 'A', 'B', 'C'][space]) + prof + '.' + (rev >>> 0).toString(16).toUpperCase() + '.' + (tier ? 'H' : 'L') + lvl + cons.map(c => '.' + c.toString(16).toUpperCase()).join('');
  }
  function vp9String(v, b) { const s = b.start + 4, prof = v.getUint8(s), lvl = v.getUint8(s + 1), bd = v.getUint8(s + 2) >> 4; return 'vp09.' + String(prof).padStart(2, '0') + '.' + String(lvl).padStart(2, '0') + '.' + String(bd || 8).padStart(2, '0'); }
  function av1String(v, b) { const s = b.start, a = v.getUint8(s + 1), c = v.getUint8(s + 2), prof = a >> 5, lvl = a & 31, tier = c >> 7, hi = (c >> 6) & 1, twelve = (c >> 5) & 1, bd = hi ? (twelve ? 12 : 10) : 8; return 'av01.' + prof + '.' + String(lvl).padStart(2, '0') + (tier ? 'H' : 'M') + '.' + String(bd).padStart(2, '0'); }
  // esds: the AAC settings sit inside nested descriptors
  function esdsInfo(v, b) {
    let o = b.start + 4; const end = b.end; let oti = 0, dsi = null;
    const len = () => { let n = 0; for (let i = 0; i < 4; i++) { const x = v.getUint8(o++); n = (n << 7) | (x & 127); if (!(x & 128)) break; } return n; };
    while (o < end) {
      const tag = v.getUint8(o++), l = len(), s = o;
      if (tag === 3) { o += 2; const f = v.getUint8(o++); if (f & 128) o += 2; if (f & 64) o += 1 + v.getUint8(o); if (f & 32) o += 2; continue; }
      if (tag === 4) { oti = v.getUint8(o); o += 13; continue; }
      if (tag === 5) { dsi = new Uint8Array(v.buffer.slice(v.byteOffset + o, v.byteOffset + o + l)); o += l; continue; }
      o = s + l;
    }
    if (oti === 0x40 || oti === 0x66 || oti === 0x67 || oti === 0x68) { const aot = dsi && dsi.length ? (dsi[0] >> 3) === 31 ? 32 + (((dsi[0] & 7) << 3) | (dsi[1] >> 5)) : dsi[0] >> 3 : 2; return { codec: 'mp4a.40.' + aot, description: dsi }; }
    if (oti === 0x69 || oti === 0x6B) return { codec: 'mp3', description: null };
    return { codec: 'mp4a.40.2', description: dsi };
  }

  function parseTrak(v, trak, movieScale) {
    const tkhd = child(v, trak, 'tkhd'), mdia = child(v, trak, 'mdia'); if (!tkhd || !mdia) return null;
    const tv = v.getUint8(tkhd.start), id = v.getUint32(tkhd.start + (tv ? 20 : 12));
    const mo = tkhd.start + (tv ? 52 : 40), m = [v.getInt32(mo), v.getInt32(mo + 4), v.getInt32(mo + 12), v.getInt32(mo + 16)].map(x => x / 65536);
    let rotation = Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI); rotation = ((rotation % 360) + 360) % 360;
    const mdhd = child(v, mdia, 'mdhd'), mv = v.getUint8(mdhd.start), timescale = v.getUint32(mdhd.start + (mv ? 20 : 12)), mdur = mv ? u64(v, mdhd.start + 24) : v.getUint32(mdhd.start + 16);
    const hdlr = child(v, mdia, 'hdlr'), handler = hdlr ? fourcc(v, hdlr.start + 8) : '';
    const type = handler === 'vide' ? 'video' : handler === 'soun' ? 'audio' : null; if (!type) return null;
    const stbl = path(v, mdia, 'minf', 'stbl'); if (!stbl) return null;
    const stsd = child(v, stbl, 'stsd'); if (!stsd) return null;
    const ent = boxes(v, stsd.start + 8, stsd.end).next().value; if (!ent) return null;
    const fmt = ent.type, T = { id, type, timescale, rotation, format: fmt, duration: mdur / timescale };
    if (type === 'video') {
      T.width = v.getUint16(ent.start + 24); T.height = v.getUint16(ent.start + 26);
      const kids = ent.start + 78;
      for (const c of boxes(v, kids, ent.end)) {
        if (c.type === 'avcC') { T.codec = avcString(v, c); T.description = new Uint8Array(v.buffer.slice(v.byteOffset + c.start, v.byteOffset + c.end)); }
        else if (c.type === 'hvcC') { T.codec = hevcString(v, c, fmt === 'hev1' ? 'hev1' : 'hvc1'); T.description = new Uint8Array(v.buffer.slice(v.byteOffset + c.start, v.byteOffset + c.end)); }
        else if (c.type === 'vpcC') { T.codec = vp9String(v, c); }
        else if (c.type === 'av1C') { T.codec = av1String(v, c); T.description = new Uint8Array(v.buffer.slice(v.byteOffset + c.start, v.byteOffset + c.end)); }
      }
      if (!T.codec && fmt === 'vp08') T.codec = 'vp8';
      // Display size after the track's own scaling, and the way up it is meant to be shown
      T.displayW = Math.round(v.getUint32(tkhd.end - 8) / 65536) || T.width; T.displayH = Math.round(v.getUint32(tkhd.end - 4) / 65536) || T.height;
    } else {
      const ver = v.getUint16(ent.start + 8);                       // QuickTime sound description version
      T.channels = v.getUint16(ent.start + 16); T.sampleSize = v.getUint16(ent.start + 18); T.sampleRate = v.getUint32(ent.start + 24) / 65536;
      let kids = ent.start + 28; if (ver === 1) kids += 16; else if (ver === 2) { kids += 36; T.sampleRate = v.getFloat64(ent.start + 32); T.channels = v.getUint32(ent.start + 40); T.sampleSize = v.getUint32(ent.start + 48); }
      const find = (b, type) => { for (const c of boxes(v, b, ent.end)) { if (c.type === type) return c; if (c.type === 'wave') { for (const d of boxes(v, c.start, c.end)) if (d.type === type) return d; } } return null; };
      if (fmt === 'mp4a') { const e = find(kids, 'esds'); Object.assign(T, e ? esdsInfo(v, e) : { codec: 'mp4a.40.2', description: null }); }
      else if (fmt === 'Opus') { const d = find(kids, 'dOps'); T.codec = 'opus'; if (d) { T.channels = v.getUint8(d.start + 1); T.preskip = v.getUint16(d.start + 2); T.sampleRate = 48000; } }
      else if (fmt === '.mp3' || fmt === 'mp3 ') T.codec = 'mp3';
      else if (fmt === 'sowt' || fmt === 'twos' || fmt === 'lpcm' || fmt === 'in24' || fmt === 'in32' || fmt === 'fl32' || fmt === 'ipcm' || fmt === 'raw ') { T.codec = 'pcm'; T.pcm = { le: fmt === 'sowt' || fmt === 'lpcm' || fmt === 'raw ', bits: fmt === 'in24' ? 24 : fmt === 'in32' || fmt === 'fl32' ? 32 : (T.sampleSize || 16), float: fmt === 'fl32' }; if (fmt === 'raw ') T.pcm.bits = 8; }
      else if (fmt === 'ac-3' || fmt === 'ec-3') T.codec = fmt;
    }
    // Edit list: the first real edit says where the track starts showing (skips encoder priming, lines sound up with picture)
    T.shift = 0; T.lead = 0;
    const elst = path(v, trak, 'edts', 'elst');
    if (elst) { const ev = v.getUint8(elst.start), n = v.getUint32(elst.start + 4); let o = elst.start + 8;
      for (let i = 0; i < n; i++) { const segDur = ev ? u64(v, o) : v.getUint32(o), mt = ev ? v.getInt32(o + 8) * 4294967296 + v.getUint32(o + 12) : v.getInt32(o + 4); o += ev ? 20 : 12;
        if (mt === -1) { T.lead += segDur / movieScale; continue; } T.shift = mt / timescale; break; } }
    // Sample tables
    const tab = { stts: child(v, stbl, 'stts'), ctts: child(v, stbl, 'ctts'), stss: child(v, stbl, 'stss'), stsc: child(v, stbl, 'stsc'), stsz: child(v, stbl, 'stsz'), stz2: child(v, stbl, 'stz2'), stco: child(v, stbl, 'stco'), co64: child(v, stbl, 'co64') };
    let n = 0, sizes;
    if (tab.stsz) { const fixed = v.getUint32(tab.stsz.start + 4); n = v.getUint32(tab.stsz.start + 8); sizes = new Uint32Array(n); if (fixed) sizes.fill(fixed); else for (let i = 0; i < n; i++) sizes[i] = v.getUint32(tab.stsz.start + 12 + i * 4); }
    else if (tab.stz2) { const fb = v.getUint8(tab.stz2.start + 7); n = v.getUint32(tab.stz2.start + 8); sizes = new Uint32Array(n); for (let i = 0; i < n; i++) { if (fb === 16) sizes[i] = v.getUint16(tab.stz2.start + 12 + i * 2); else if (fb === 8) sizes[i] = v.getUint8(tab.stz2.start + 12 + i); else { const b = v.getUint8(tab.stz2.start + 12 + (i >> 1)); sizes[i] = i & 1 ? b & 15 : b >> 4; } } }
    else return null;
    if (!n) return null;
    const dts = new Float64Array(n), cto = new Int32Array(n), key = new Uint8Array(n), offs = new Float64Array(n);
    if (tab.stts) { const ec = v.getUint32(tab.stts.start + 4); let o = tab.stts.start + 8, i = 0, t = 0; for (let e = 0; e < ec && i < n; e++) { const c = v.getUint32(o), d = v.getUint32(o + 4); o += 8; for (let k = 0; k < c && i < n; k++) { dts[i++] = t; t += d; } } for (; i < n; i++) dts[i] = t; T.end = t; }
    if (tab.ctts) { const cv = v.getUint8(tab.ctts.start), ec = v.getUint32(tab.ctts.start + 4); let o = tab.ctts.start + 8, i = 0; for (let e = 0; e < ec && i < n; e++) { const c = v.getUint32(o), d = cv ? v.getInt32(o + 4) : v.getUint32(o + 4) | 0; o += 8; for (let k = 0; k < c && i < n; k++) cto[i++] = d; } }
    if (tab.stss) { const ec = v.getUint32(tab.stss.start + 4); for (let e = 0; e < ec; e++) { const s = v.getUint32(tab.stss.start + 8 + e * 4) - 1; if (s >= 0 && s < n) key[s] = 1; } } else key.fill(1);
    // Chunks: where each run of samples sits in the file
    const chunkOff = []; if (tab.stco) { const ec = v.getUint32(tab.stco.start + 4); for (let e = 0; e < ec; e++) chunkOff.push(v.getUint32(tab.stco.start + 8 + e * 4)); } else if (tab.co64) { const ec = v.getUint32(tab.co64.start + 4); for (let e = 0; e < ec; e++) chunkOff.push(u64(v, tab.co64.start + 8 + e * 8)); }
    // Old QuickTime PCM counts single audio frames of 1 'byte' each: a frame is really bytes x channels
    const pcmFB = T.codec === 'pcm' && T.pcm ? (T.pcm.bits / 8) * (T.channels || 2) : 1, unit = T.codec === 'pcm' && sizes[0] === 1 ? pcmFB : 1;
    if (unit > 1) for (let i = 0; i < n; i++) sizes[i] = unit;
    if (tab.stsc && chunkOff.length) { const ec = v.getUint32(tab.stsc.start + 4), runs = []; for (let e = 0; e < ec; e++) runs.push([v.getUint32(tab.stsc.start + 8 + e * 12) - 1, v.getUint32(tab.stsc.start + 12 + e * 12)]);
      let s = 0; for (let r = 0; r < runs.length && s < n; r++) { const [first, per] = runs[r], last = r + 1 < runs.length ? runs[r + 1][0] : chunkOff.length; for (let c = first; c < last && s < n; c++) { let o = chunkOff[c]; for (let k = 0; k < per && s < n; k++) { offs[s] = o; o += sizes[s]; s++; } } } }
    // PCM in MOV is stored as one "sample" per audio frame; group into chunks of 1024 for decoding speed
    Object.assign(T, { n, sizes, dts, cto, key, offs });
    if (T.codec === 'pcm' && T.pcm) T.pcm.frameBytes = (T.pcm.bits / 8) * (T.channels || 2);
    return T;
  }

  // Opens a file: returns { video, audio, duration, tracks } (or throws when it is not an MP4 family file)
  async function open(blob) {
    const size = blob.size; let o = 0, moov = null, guard = 0;
    while (o + 8 <= size && guard++ < 10000) {
      const h = await readRange(blob, o, Math.min(size, o + 16)); let bs = h.getUint32(0); const type = fourcc(h, 4);
      if (!/^[\x20-\x7e]{4}$/.test(type)) throw new Error('not mp4');
      if (bs === 1) bs = u64(h, 8); else if (bs === 0) bs = size - o;
      if (bs < 8) throw new Error('not mp4');
      if (type === 'moov') { moov = { o, size: bs }; break; }
      o += bs;
    }
    if (!moov) throw new Error('not mp4');
    const v = await readRange(blob, moov.o, moov.o + moov.size), root = boxes(v, 0, v.byteLength).next().value;
    const mvhd = child(v, root, 'mvhd'), mvv = mvhd ? v.getUint8(mvhd.start) : 0, movieScale = mvhd ? v.getUint32(mvhd.start + (mvv ? 20 : 12)) : 1000;
    const tracks = []; for (const c of boxes(v, root.start, root.end)) if (c.type === 'trak') { try { const T = parseTrak(v, c, movieScale); if (T) tracks.push(T); } catch (e) { } }
    const video = tracks.find(t => t.type === 'video' && t.codec), audio = tracks.find(t => t.type === 'audio' && t.codec);
    const duration = Math.max(0, ...tracks.map(t => t.end / t.timescale - t.shift + t.lead));
    return { blob, tracks, video, audio, duration };
  }
  // Presentation time (seconds) of sample i, after the edit list
  const pts = (T, i) => (T.dts[i] + T.cto[i]) / T.timescale - T.shift + T.lead;
  // Bytes of one sample
  async function sample(file, T, i) { return new Uint8Array(await file.blob.slice(T.offs[i], T.offs[i] + T.sizes[i]).arrayBuffer()); }
  // Several samples in one read when they sit together in the file (they usually do)
  async function samples(file, T, i0, i1) {
    i1 = Math.min(T.n, i1); if (i1 <= i0) return [];
    let lo = Infinity, hi = 0; for (let i = i0; i < i1; i++) { lo = Math.min(lo, T.offs[i]); hi = Math.max(hi, T.offs[i] + T.sizes[i]); }
    if (hi - lo > 64e6) { const out = []; for (let i = i0; i < i1; i++) out.push(await sample(file, T, i)); return out; }
    const buf = new Uint8Array(await file.blob.slice(lo, hi).arrayBuffer()), out = [];
    for (let i = i0; i < i1; i++) out.push(buf.subarray(T.offs[i] - lo, T.offs[i] - lo + T.sizes[i]));
    return out;
  }
  return { open, pts, sample, samples };
})();

const MP4Out = (() => {
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const u16 = n => [(n >>> 8) & 255, n & 255];
  const u64 = n => [...u32(Math.floor(n / 4294967296)), ...u32(n >>> 0)];
  const str = s => Array.from(s).map(c => c.charCodeAt(0));
  function box(type, ...parts) { const arrs = parts.map(p => p instanceof Uint8Array ? p : new Uint8Array(p)); let len = 8; arrs.forEach(a => len += a.length); const out = new Uint8Array(len); out.set(u32(len), 0); out.set(str(type), 4); let o = 8; arrs.forEach(a => { out.set(a, o); o += a.length; }); return out; }
  const full = (type, version, flags, ...parts) => box(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);
  const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);
  // An MPEG-4 descriptor with its length written the long way (always 4 bytes, which every reader accepts)
  const desc = (tag, ...parts) => { const body = parts.flatMap(p => Array.from(p)); const L = body.length; return [tag, 0x80 | ((L >> 21) & 127), 0x80 | ((L >> 14) & 127), 0x80 | ((L >> 7) & 127), L & 127, ...body]; };

  /* create({ video: { codec, width, height, timescale, description }, audio: { codec, sampleRate, channels, description }, sink })
     sink: { write(Uint8Array) (may return a promise), close() }  Samples go straight to the sink; the index is kept small. */
  function create(o) {
    const sink = o.sink, tracks = [];
    if (o.video) tracks.push({ kind: 'video', cfg: o.video, sizes: [], durs: [], ctos: [], keys: [], chunks: [], ts: o.video.timescale || 90000 });
    if (o.audio) tracks.push({ kind: 'audio', cfg: o.audio, sizes: [], durs: [], ctos: [], keys: [], chunks: [], ts: o.audio.sampleRate });
    const ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41'));
    let pos = 0, pending = [], pendingBytes = 0, mdatStart = 0;
    const flush = async () => { if (!pending.length) return; const parts = pending; pending = []; pendingBytes = 0; for (const p of parts) await sink.write(p); };
    const write = async u => { pending.push(u); pendingBytes += u.length; pos += u.length; if (pendingBytes > 8e6) await flush(); };
    let started = false;
    async function start() { if (started) return; started = true; await write(ftyp); mdatStart = pos; await write(new Uint8Array([0, 0, 0, 1, ...str('mdat'), 0, 0, 0, 0, 0, 0, 0, 0])); }
    // A sample: data (Uint8Array), duration and composition offset in the track's time units, keyframe or not
    async function add(kind, data, dur, cto, key) {
      await start(); const T = tracks.find(t => t.kind === kind); if (!T) return;
      const last = T.chunks[T.chunks.length - 1];
      if (last && last.end === pos && last.n < 512) { last.n++; last.end += data.length; } else T.chunks.push({ off: pos, n: 1, end: pos + data.length });
      T.sizes.push(data.length); T.durs.push(Math.max(0, Math.round(dur))); T.ctos.push(Math.round(cto || 0)); if (key) T.keys.push(T.sizes.length);
      await write(data);
    }
    function trak(T, id, movieDur) {
      const c = T.cfg, n = T.sizes.length, durTS = T.durs.reduce((a, b) => a + b, 0);
      let entry;
      if (T.kind === 'video') {
        const fmt = /^avc/.test(c.codec) ? 'avc1' : /^hvc|^hev/.test(c.codec) ? 'hvc1' : /^vp09/.test(c.codec) ? 'vp09' : /^av01/.test(c.codec) ? 'av01' : 'avc1';
        const cfgBox = fmt === 'avc1' ? box('avcC', c.description) : fmt === 'hvc1' ? box('hvcC', c.description) : fmt === 'av01' ? box('av1C', c.description || new Uint8Array([0x81, 0, 0, 0]))
          : full('vpcC', 1, 0, [0, 10, 0x80, 1, 1, 1, 0, 0, 0]);
        entry = box(fmt, [0, 0, 0, 0, 0, 0], u16(1), new Array(16).fill(0), u16(c.width), u16(c.height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Array(32).fill(0), u16(0x0018), u16(0xffff), cfgBox, box('pasp', u32(1), u32(1)));
      } else {
        const opus = c.codec === 'opus';
        const kids = opus ? box('dOps', [0, c.channels], u16(c.preskip != null ? c.preskip : 312), u32(c.sampleRate), u16(0), [0])
          : full('esds', 0, 0, desc(3, u16(1), [0], desc(4, [0x40, 0x15, 0, 0, 0], u32(c.bitrate || 192000), u32(c.bitrate || 192000), desc(5, c.description || new Uint8Array([0x11, 0x90]))), desc(6, [2])));
        entry = box(opus ? 'Opus' : 'mp4a', [0, 0, 0, 0, 0, 0], u16(1), u32(0), u32(0), u16(c.channels), u16(16), u16(0), u16(0), u32((c.sampleRate >= 65536 ? 0 : c.sampleRate) << 16 >>> 0), kids);
      }
      const stts = []; T.durs.forEach(d => { const l = stts[stts.length - 1]; if (l && l[1] === d) l[0]++; else stts.push([1, d]); });
      const anyCto = T.ctos.some(x => x), cr = []; if (anyCto) T.ctos.forEach(x => { const l = cr[cr.length - 1]; if (l && l[1] === x) l[0]++; else cr.push([1, x]); });
      const sz = new Uint8Array(12 + n * 4); sz.set(u32(0), 4); sz.set(u32(n), 8); T.sizes.forEach((s, i) => sz.set(u32(s), 12 + i * 4));
      const big = T.chunks.some(ch => ch.off > 4294967000);
      const stsc = []; T.chunks.forEach((ch, i) => { const l = stsc[stsc.length - 1]; if (!l || l[1] !== ch.n) stsc.push([i + 1, ch.n]); });
      const stbl = box('stbl', full('stsd', 0, 0, u32(1), entry), full('stts', 0, 0, u32(stts.length), stts.flatMap(([a, b]) => [...u32(a), ...u32(b)])),
        ...(anyCto ? [full('ctts', 1, 0, u32(cr.length), cr.flatMap(([a, b]) => [...u32(a), ...u32(b >>> 0)]))] : []),
        ...(T.kind === 'video' ? [full('stss', 0, 0, u32(T.keys.length), T.keys.flatMap(u32))] : []),
        full('stsc', 0, 0, u32(stsc.length), stsc.flatMap(([f, m]) => [...u32(f), ...u32(m), ...u32(1)])), box('stsz', sz),
        big ? full('co64', 0, 0, u32(T.chunks.length), T.chunks.flatMap(ch => u64(ch.off))) : full('stco', 0, 0, u32(T.chunks.length), T.chunks.flatMap(ch => u32(ch.off))));
      const head = T.kind === 'video' ? full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)) : full('smhd', 0, 0, u16(0), u16(0));
      const minf = box('minf', head, box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
      const mdhd = full('mdhd', 1, 0, u64(0), u64(0), u32(T.ts), u64(durTS), u16(0x55c4), u16(0));
      const hdlr = full('hdlr', 0, 0, u32(0), str(T.kind === 'video' ? 'vide' : 'soun'), u32(0), u32(0), u32(0), str(T.kind === 'video' ? 'VideoHandler' : 'SoundHandler'), [0]);
      const tkhd = full('tkhd', 1, 3, u64(0), u64(0), u32(id), u32(0), u64(movieDur), u32(0), u32(0), u16(0), u16(0), u16(T.kind === 'audio' ? 0x0100 : 0), u16(0), MATRIX, u32(T.kind === 'video' ? c.width << 16 >>> 0 : 0), u32(T.kind === 'video' ? c.height << 16 >>> 0 : 0));
      // An edit list hides the reorder delay, so the first frame shows at zero
      const edts = T.kind === 'video' && c.shift ? box('edts', full('elst', 1, 0, u32(1), u64(movieDur), u64(c.shift), u16(1), u16(0))) : null;
      return box('trak', tkhd, ...(edts ? [edts] : []), box('mdia', mdhd, hdlr, minf));
    }
    async function finish() {
      await start(); await flush();
      const mdatSize = pos - mdatStart, MS = 1000;
      const movieDur = Math.max(1, ...tracks.map(T => Math.round(T.durs.reduce((a, b) => a + b, 0) / T.ts * MS)));
      const mvhd = full('mvhd', 1, 0, u64(0), u64(0), u32(MS), u64(movieDur), u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0), MATRIX, new Array(24).fill(0), u32(tracks.length + 1));
      const moov = box('moov', mvhd, ...tracks.map((T, i) => trak(T, i + 1, movieDur)));
      await sink.write(moov);
      // The mdat size goes in its header, which was written with room for 64 bits
      if (sink.patch) await sink.patch(mdatStart + 8, new Uint8Array(u64(mdatSize)));
      return { mdatStart, mdatSize };
    }
    return { add, finish, get bytes() { return pos; } };
  }

  // Sinks: straight to a file on disk (no size limit), or to Blob pieces that are assembled at the end
  function fileSink(writable) { let at = 0; return { async write(u) { await writable.write({ type: 'write', position: at, data: u }); at += u.length; }, async patch(p, u) { await writable.write({ type: 'write', position: p, data: u }); }, async close() { await writable.close(); } }; }
  function blobSink() {
    const parts = [], cur = []; let curBytes = 0, patches = [];
    const seal = () => { if (cur.length) { parts.push(new Blob(cur)); cur.length = 0; curBytes = 0; } };
    return { write(u) { cur.push(u); curBytes += u.length; if (curBytes > 32e6) seal(); }, patch(p, u) { patches.push([p, u]); },
      async blob(type) { seal(); let b = new Blob(parts, { type: type || 'video/mp4' });
        // Patches only ever touch the first few bytes (the mdat size), so rebuild the head and keep the rest as it is
        for (const [p, u] of patches) { const head = new Uint8Array(await b.slice(0, p + u.length).arrayBuffer()); head.set(u, p); b = new Blob([head, b.slice(p + u.length)], { type: type || 'video/mp4' }); }
        return b; }, close() { } };
  }
  return { create, fileSink, blobSink };
})();
if (typeof module !== 'undefined') module.exports = { MP4In, MP4Out };

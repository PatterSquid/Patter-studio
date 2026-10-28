/* Minimal MP4 (ISO BMFF) muxer for one H.264 video track.
   Samples are AVC length prefixed access units, as produced by WebCodecs with avc.format = 'avc'. */
const MP4Mux = (() => {
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function u16(n) { return [(n >>> 8) & 255, n & 255]; }
  function str(s) { return Array.from(s).map(c => c.charCodeAt(0)); }
  function box(type, ...parts) {
    let len = 8; const arrs = parts.map(p => p instanceof Uint8Array ? p : new Uint8Array(p));
    arrs.forEach(a => len += a.length);
    const out = new Uint8Array(len); out.set(u32(len), 0); out.set(str(type), 4);
    let o = 8; arrs.forEach(a => { out.set(a, o); o += a.length; }); return out;
  }
  function full(type, version, flags, ...parts) { return box(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts); }
  const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);

  function mux({ width, height, timescale, samples, avcC }) {
    const n = samples.length;
    let total = 0; samples.forEach(s => total += s.data.length);
    const durationTS = samples.reduce((a, s) => a + s.dur, 0);
    const anyCto = samples.some(s => s.cto);

    const ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41'));

    const avc1 = box('avc1',
      [0, 0, 0, 0, 0, 0], u16(1), new Array(16).fill(0), u16(width), u16(height),
      u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Array(32).fill(0), u16(0x0018), u16(0xffff),
      box('avcC', avcC),
      box('pasp', u32(1), u32(1)));
    const stsd = full('stsd', 0, 0, u32(1), avc1);

    // stts: run length of durations
    const stts = []; samples.forEach(s => { const l = stts[stts.length - 1]; if (l && l[1] === s.dur) l[0]++; else stts.push([1, s.dur]); });
    const sttsB = full('stts', 0, 0, u32(stts.length), stts.flatMap(([c, d]) => [...u32(c), ...u32(d)]));
    const keys = []; samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
    const stssB = full('stss', 0, 0, u32(keys.length), keys.flatMap(u32));
    const stscB = full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));
    const sizes = new Uint8Array(12 + n * 4); sizes.set(u32(0), 0); sizes.set(u32(0), 4); sizes.set(u32(n), 8);
    samples.forEach((s, i) => sizes.set(u32(s.data.length), 12 + i * 4));
    const stszB = box('stsz', sizes);
    let cttsB = null;
    if (anyCto) { const r = []; samples.forEach(s => { const c = s.cto | 0; const l = r[r.length - 1]; if (l && l[1] === c) l[0]++; else r.push([1, c]); }); cttsB = full('ctts', 1, 0, u32(r.length), r.flatMap(([c, o]) => [...u32(c), ...u32(o >>> 0)])); }

    function buildMoov(mdatDataOffset) {
      const offs = new Uint8Array(4 + n * 4); offs.set(u32(n), 0);
      let o = mdatDataOffset; samples.forEach((s, i) => { offs.set(u32(o), 4 + i * 4); o += s.data.length; });
      const stco = full('stco', 0, 0, offs);
      const stbl = box('stbl', stsd, sttsB, ...(cttsB ? [cttsB] : []), stssB, stscB, stszB, stco);
      const minf = box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
      const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(durationTS), u16(0x55c4), u16(0));
      const hdlr = full('hdlr', 0, 0, u32(0), str('vide'), u32(0), u32(0), u32(0), str('VideoHandler'), [0]);
      const mdia = box('mdia', mdhd, hdlr, minf);
      const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(durationTS), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width << 16), u32(height << 16));
      const trak = box('trak', tkhd, mdia);
      const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(timescale), u32(durationTS), u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0), MATRIX, new Array(24).fill(0), u32(2));
      return box('moov', mvhd, trak);
    }
    // moov placed before mdat for fast start; its size does not depend on the offsets values.
    const probe = buildMoov(0);
    const mdatHeader = 8, dataOffset = ftyp.length + probe.length + mdatHeader;
    const moov = buildMoov(dataOffset);
    const out = new Uint8Array(ftyp.length + moov.length + mdatHeader + total);
    let o = 0; out.set(ftyp, o); o += ftyp.length; out.set(moov, o); o += moov.length;
    out.set(u32(mdatHeader + total), o); out.set(str('mdat'), o + 4); o += 8;
    samples.forEach(s => { out.set(s.data, o); o += s.data.length; });
    return out;
  }
  return { mux };
})();
if (typeof module !== 'undefined') module.exports = MP4Mux;

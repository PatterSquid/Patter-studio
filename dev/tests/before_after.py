"""A before and after clip of a tab, for him to judge a change by. usage: before_after.py OUT.mp4 TAB [settings.json ...]
Plays the tab's example (then each settings file laid over it: { "news": { ... } } or the settings themselves) from the
old build on port 8766 and the new one on 8765, side by side and labelled, then the new one again at full size (FULL=0
leaves that out). 60 pictures a second (FPS); TO=14 keeps to the first 14 seconds. Needs ffmpeg and the fonts in dev/tmp_fonts (see chart_sheet.py; Lora 400 and 500 italic the same
way), and the old build's folder needs them too or its side is drawn in the wrong lettering: link dev/tmp_fonts into it."""
import asyncio, sys, os, json, base64, subprocess, shutil, tempfile
from playwright.async_api import async_playwright
OUT = sys.argv[1]; TAB = sys.argv[2]; CFGS = [None] + [json.load(open(f)) for f in sys.argv[3:]]; FPS = int(os.environ.get('FPS', '60')); FULL = os.environ.get('FULL', '1') != '0'
OLD = os.environ.get('OLD', '8766'); NEW = os.environ.get('NEW', '8765'); TO = float(os.environ.get('TO', '1e9'));   # TO: only the first so many seconds (the map tabs take a third of a second a frame here)
TMP = tempfile.mkdtemp(prefix='ba_')
FONTS = """async()=>{ for (const [fam, w, st, file] of [['Anton', '400', 'normal', 'anton-400'], ['Archivo Narrow', '400', 'normal', 'archivonarrow-400'], ['Archivo Narrow', '700', 'normal', 'archivonarrow-700'], ['Archivo Narrow', '400', 'italic', 'archivonarrow-400i'], ['Lora', '400', 'normal', 'lora-400'], ['Lora', '500', 'italic', 'lora-500i']]) { try { const f = new FontFace(fam, 'url(/tmp_fonts/' + file + '.woff2)', { weight: w, style: st }); document.fonts.add(f); await f.load(); } catch (e) { } } E.fontVersion = (E.fontVersion || 0) + 1; }"""
SETUP = """async([m, over, w, h])=>{ if (typeof Studio !== 'undefined' && Studio.ready) await Studio.ready(); if (typeof GeoData !== 'undefined' && GeoData.load) { GeoData.load(); for (let i = 0; i < 60 && GeoData.state.status !== 'ready'; i++) await new Promise(r => setTimeout(r, 250)); }
  const mods = { charts: Charts, timeline: Timeline, map: typeof MapMod !== 'undefined' ? MapMod : null, flights: typeof Flights !== 'undefined' ? Flights : null, flyover: typeof Flyover !== 'undefined' ? Flyover : null, picto: Picto, news: News, story: Story, broll: typeof Broll !== 'undefined' ? Broll : null };
  const M = Layers.wrap(mods[m]), cfg = Object.assign(mods[m].defaults(), over || {}), look = { scheme: m === 'story' || m === 'broll' ? 'chalk' : 'saltire', format: '16:9', texture: true, preview: false };
  if (typeof Repair !== 'undefined') Repair.clip(m, cfg, mods); window.__c = document.createElement('canvas'); __c.width = w; __c.height = h; window.__g = __c.getContext('2d'); window.__M = M; window.__cfg = cfg; window.__look = look;
  M.draw(__g, 0.5, cfg, look, 1920, 1080); await new Promise(r => setTimeout(r, 700)); return M.duration(cfg, look); }"""
FRAMES = """async([i0, i1, fps, tag, w, h])=>{ const out = [], g = __g, k = w / 1920; for (let i = i0; i < i1; i++) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.save(); g.scale(k, k); __M.draw(g, i / fps, __cfg, __look, 1920, 1080); g.restore();
    if (tag) { g.save(); g.font = '700 ' + Math.round(30 * Math.max(k, 0.7)) + 'px "Archivo Narrow", sans-serif'; const tw = g.measureText(tag).width + 40, th = 46 * Math.max(k, 0.7); g.globalAlpha = 0.72; g.fillStyle = '#05080f'; g.beginPath(); g.roundRect(18, h - th - 16, tw, th, th / 2); g.fill(); g.globalAlpha = 1; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tag, 18 + tw / 2, h - 16 - th / 2 + 1); g.restore(); }
    const b = await new Promise(r => __c.toBlob(r, 'image/jpeg', 0.94)); const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let j = 0; j < u.length; j += 32768) s += String.fromCharCode.apply(null, u.subarray(j, j + 32768)); out.push(btoa(s)); } return out; }"""
async def page(b, port):
  pg = await b.new_page(); pg.on('pageerror', lambda e: print('PAGE ERROR', port, str(e)[:200])); await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
  await pg.goto(f'http://127.0.0.1:{port}/dist/test.html'); await pg.wait_for_timeout(2500); await pg.evaluate(FONTS); return pg
async def shoot(pg, over, tag, w, h, folder, n0):
  d = await pg.evaluate(SETUP, [TAB, over, w, h]); nf = round(min(d, TO) * FPS); n = n0
  for i0 in range(0, nf, 24):
    for f in await pg.evaluate(FRAMES, [i0, min(nf, i0 + 24), FPS, tag, w, h]): open(f'{folder}/f{n:05d}.jpg', 'wb').write(base64.b64decode(f)); n += 1
  return n, d
async def main():
  for d in ('old', 'new', 'full'): os.makedirs(f'{TMP}/{d}')
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); po = await page(b, OLD); pn = await page(b, NEW); no = nn = nfull = 0
    for c in CFGS:
      over = (c.get(TAB) if isinstance(c, dict) and TAB in c else c) if c else None
      no, d0 = await shoot(po, over, 'Before', 960, 540, f'{TMP}/old', no); nn, d1 = await shoot(pn, over, 'After', 960, 540, f'{TMP}/new', nn); print('side by side', round(d0, 2), round(d1, 2), 'same length' if abs(d0 - d1) < 1e-6 else 'LENGTHS DIFFER', flush=True)
      for k in range(no, max(no, nn)): shutil.copy(f'{TMP}/old/f{no - 1:05d}.jpg', f'{TMP}/old/f{k:05d}.jpg')
      for k in range(nn, max(no, nn)): shutil.copy(f'{TMP}/new/f{nn - 1:05d}.jpg', f'{TMP}/new/f{k:05d}.jpg')
      no = nn = max(no, nn)
    if FULL:
      for c in CFGS[:1 if len(CFGS) < 2 else 2]:
        over = (c.get(TAB) if isinstance(c, dict) and TAB in c else c) if c else None; nfull, d = await shoot(pn, over, 'After, full size', 1920, 1080, f'{TMP}/full', nfull); print('full size', round(d, 2), flush=True)
    await b.close()
  enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS)]
  subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', f'{TMP}/old/f%05d.jpg', '-framerate', str(FPS), '-i', f'{TMP}/new/f%05d.jpg', '-filter_complex', '[0][1]hstack=inputs=2,pad=1920:1080:0:270:color=0x0a0f1a', *enc, f'{TMP}/a.mp4'], check=True)
  parts = [f'{TMP}/a.mp4']
  if FULL: subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', f'{TMP}/full/f%05d.jpg', *enc, f'{TMP}/b.mp4'], check=True); parts.append(f'{TMP}/b.mp4')
  open(f'{TMP}/list.txt', 'w').write(''.join(f"file '{x}'\n" for x in parts))
  subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{TMP}/list.txt', '-c', 'copy', '-movflags', '+faststart', OUT], check=True)
  print('made', OUT, os.path.getsize(OUT)); print('frames kept in', TMP)
asyncio.run(main())

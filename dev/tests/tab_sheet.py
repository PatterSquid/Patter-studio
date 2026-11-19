"""Any tab's example looked at as pictures. usage: tab_sheet.py OUT_DIR [port] [tabs]   (tabs: timeline,map,flights,flyover,picto,news,story,broll,charts)
Draws each tab's own example (its defaults()) at N moments spread over its length and saves a contact sheet per tab
(OUT_DIR/<tab>.jpg, moments left to right, top to bottom). AT=0.1,0.5 picks fractions of the length; FROM and TO (seconds)
spread the N moments over that stretch instead, to look closely at one move; COLS, W (frame width), FMT (16:9 or 9:16).
CFG=/path/file.json lays settings over the example ({ "news": { ... } })."""
import asyncio, sys, os, json, base64, io
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
OUT = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8765'; TABS = (sys.argv[3] if len(sys.argv) > 3 else 'timeline,map,flights,flyover,picto,news,story,broll').split(',')
AT = [float(x) for x in os.environ['AT'].split(',')] if os.environ.get('AT') else None; N = len(AT) if AT else int(os.environ.get('N', '12')); COLS = int(os.environ.get('COLS', '4')); W = int(os.environ.get('W', '640')); FMT = os.environ.get('FMT', '16:9')
FROM = float(os.environ['FROM']) if os.environ.get('FROM') else None; TO = float(os.environ['TO']) if os.environ.get('TO') else None
OVER = json.load(open(os.environ['CFG'])) if os.environ.get('CFG') else {}
JS = """async([m, over, N, W, fmt, AT, FROM, TO])=>{ if (typeof Studio !== 'undefined' && Studio.ready) await Studio.ready(); if (typeof GeoData !== 'undefined' && GeoData.load) { GeoData.load(); for (let i = 0; i < 60 && GeoData.state.status !== 'ready'; i++) await new Promise(r => setTimeout(r, 250)); }
  const mods = { charts: Charts, timeline: Timeline, map: typeof MapMod !== 'undefined' ? MapMod : null, flights: typeof Flights !== 'undefined' ? Flights : null, flyover: typeof Flyover !== 'undefined' ? Flyover : null, picto: Picto, news: News, story: Story, broll: typeof Broll !== 'undefined' ? Broll : null };
  if (!mods[m]) return { d: 0, out: [], errs: ['no such tab'], ts: [] }; const M = Layers.wrap(mods[m]), cfg = Object.assign(mods[m].defaults(), over || {}), look = { scheme: m === 'story' || m === 'broll' ? 'chalk' : 'saltire', format: fmt, texture: true };
  if (typeof Repair !== 'undefined') Repair.clip(m, cfg, mods); if (M.prepare) { try { await M.prepare(cfg, look); } catch (e) { } }
  const dm = E.dims(fmt), H = Math.round(W * dm.H / dm.W), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), d = M.duration(cfg, look), out = [], errs = [], ts = [];
  const tOf = i => AT ? d * AT[i] : FROM != null ? FROM + ((TO != null ? TO : d) - FROM) * i / Math.max(1, N - 1) : d * (i + 0.5) / N;
  const one = t => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.save(); g.scale(W / dm.W, W / dm.W); try { M.draw(g, t, cfg, look, dm.W, dm.H); } catch (e) { errs.push(t.toFixed(2) + ': ' + (e.stack || e).toString().slice(0, 300)); } g.restore(); };
  one(tOf(0)); await new Promise(r => setTimeout(r, 600));   /* pictures and maps a tab loads on its first draw */
  for (let i = 0; i < N; i++) { const t = tOf(i); one(t); ts.push(t); out.push(c.toDataURL('image/jpeg', 0.85)); }
  return { d, out, errs, ts }; }"""
FONTS = """async()=>{ for (const [fam, w, st, file] of [['Anton', '400', 'normal', 'anton-400'], ['Archivo Narrow', '400', 'normal', 'archivonarrow-400'], ['Archivo Narrow', '700', 'normal', 'archivonarrow-700'], ['Archivo Narrow', '400', 'italic', 'archivonarrow-400i'], ['Lora', '400', 'normal', 'lora-400'], ['Lora', '500', 'italic', 'lora-500i']]) { try { const f = new FontFace(fam, 'url(/tmp_fonts/' + file + '.woff2)', { weight: w, style: st }); document.fonts.add(f); await f.load(); } catch (e) { } } E.fontVersion = (E.fontVersion || 0) + 1; }"""
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(2500); await pg.evaluate(FONTS)
    for name in TABS:
      r = await pg.evaluate(JS, [name, OVER.get(name), N, W, FMT, AT, FROM, TO])
      if not r['out']: print(name, r['errs']); continue
      ims = [Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))) for u in r['out']]; w, h = ims[0].size; rows = (len(ims) + COLS - 1) // COLS; sh = Image.new('RGB', (COLS * w, rows * h))
      for i, im in enumerate(ims):
        sh.paste(im, ((i % COLS) * w, (i // COLS) * h)); dr = ImageDraw.Draw(sh); dr.rectangle([(i % COLS) * w, (i // COLS) * h, (i % COLS) * w + 58, (i // COLS) * h + 14], fill=(0, 0, 0)); dr.text(((i % COLS) * w + 3, (i // COLS) * h + 2), '%.2f s' % r['ts'][i], fill=(255, 255, 255))
      sh.save(f'{OUT}/{name}.jpg', quality=85); print(name, 'length', round(r['d'], 2), 'errors', r['errs'][:2] if r['errs'] else 'none', flush=True)
    print('page errors', errs); await b.close()
asyncio.run(main())

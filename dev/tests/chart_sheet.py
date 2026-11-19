"""Charts looked at as pictures. usage: chart_sheet.py OUT_DIR [port] [names]
Draws each chart in CASES (a name and the settings laid over Charts.defaults()) at several moments of its own length and
saves a contact sheet per chart (OUT_DIR/<name>.jpg, moments left to right, top to bottom) plus its length and any errors.
N=12 moments spread evenly, or AT=0.3,0.6,0.95 for chosen fractions of the length; COLS, W (frame width), FMT (16:9 or 9:16).
CASES can be replaced with a JSON file: CASES=/path/cases.json (a list of [name, settings, look]; a setting __example
names one of ChartKit.EXAMPLES to start from). Without it: every kind of chart from its example, in the look STYLE (sleek)."""
import asyncio, sys, os, json, base64, io
from playwright.async_api import async_playwright
from PIL import Image
OUT = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8765'; ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
AT = [float(x) for x in os.environ['AT'].split(',')] if os.environ.get('AT') else None; N = len(AT) if AT else int(os.environ.get('N', '12')); COLS = int(os.environ.get('COLS', '4')); W = int(os.environ.get('W', '960')); FMT = os.environ.get('FMT', '16:9')
STYLE = os.environ.get('STYLE', 'sleek'); KINDS = ['bar', 'hbar', 'grouped', 'stacked', 'line', 'area', 'pie', 'donut', 'race', 'number', 'percent']
CASES = json.load(open(os.environ['CASES'])) if os.environ.get('CASES') else [[k, {'__example': k, 'type': k, 'style': STYLE}, {}] for k in KINDS]
JS = """async([cfgIn, lookIn, N, W, fmt, AT])=>{ const ex = cfgIn.__example; delete cfgIn.__example; const M = Layers.wrap(Charts), cfg = Object.assign(Charts.defaults(), ex && typeof ChartKit !== 'undefined' ? JSON.parse(JSON.stringify(ChartKit.EXAMPLES[ex])) : {}, cfgIn), look = Object.assign({ scheme: 'saltire', format: fmt, texture: true }, lookIn);
  if (typeof Repair !== 'undefined') Repair.clip('charts', cfg, { charts: Charts }); const dm = E.dims(fmt), H = Math.round(W * dm.H / dm.W), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), d = M.duration(cfg, look), out = [], errs = [];
  for (let i = 0; i < N; i++) { const t = AT ? d * AT[i] : d * (i + 0.5) / N; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.save(); g.scale(W / dm.W, W / dm.W); try { M.draw(g, t, cfg, look, dm.W, dm.H); } catch (e) { errs.push(t.toFixed(2) + ': ' + (e.stack || e).toString().slice(0, 300)); } g.restore(); out.push(c.toDataURL('image/jpeg', 0.85)); }
  return { d, out, errs }; }"""
# Anton and Archivo Narrow as the app loads them (400, 700 and italic). Get them once with:
#   mkdir -p dev/tmp_fonts; cd dev/tmp_fonts; for f in "anton@latest/latin-400-normal anton-400" "archivo-narrow@latest/latin-400-normal archivonarrow-400" "archivo-narrow@latest/latin-700-normal archivonarrow-700" "archivo-narrow@latest/latin-400-italic archivonarrow-400i"; do set -- $f; curl -sS -o $2.woff2 https://cdn.jsdelivr.net/fontsource/fonts/$1.woff2; done
FONTS = """async()=>{ for (const [fam, w, st, file] of [['Anton', '400', 'normal', 'anton-400'], ['Archivo Narrow', '400', 'normal', 'archivonarrow-400'], ['Archivo Narrow', '700', 'normal', 'archivonarrow-700'], ['Archivo Narrow', '400', 'italic', 'archivonarrow-400i']]) { try { const f = new FontFace(fam, 'url(/tmp_fonts/' + file + '.woff2)', { weight: w, style: st }); document.fonts.add(f); await f.load(); } catch (e) { } } E.fontVersion = (E.fontVersion || 0) + 1; }"""
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(2500)
    # the channel's fonts (Google Fonts cannot be reached from here): copies in dev/tmp_fonts, see FONTS below
    await pg.evaluate(FONTS)
    for name, cfg, look in CASES:
      if ONLY and name not in ONLY: continue
      r = await pg.evaluate(JS, [cfg, look, N, W, FMT, AT]); ims = [Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))) for u in r['out']]
      w, h = ims[0].size; rows = (len(ims) + COLS - 1) // COLS; sh = Image.new('RGB', (COLS * w, rows * h))
      for i, im in enumerate(ims): sh.paste(im, ((i % COLS) * w, (i // COLS) * h))
      sh.save(f'{OUT}/{name}.jpg', quality=85); print(name, 'length', round(r['d'], 2), 'errors', r['errs'][:2] if r['errs'] else 'none')
    if os.environ.get('ALL'):   # every chart's sheet stacked into one picture
      names = [c[0] for c in CASES if not ONLY or c[0] in ONLY]; ims = [Image.open(f'{OUT}/{n}.jpg') for n in names]; cols = int(os.environ['ALL']); w, h = ims[0].size; sh = Image.new('RGB', (cols * w, ((len(ims) + cols - 1) // cols) * h), (10, 14, 22))
      for i, im in enumerate(ims): sh.paste(im, ((i % cols) * w, (i // cols) * h))
      sh.save(f'{OUT}/all.jpg', quality=85)
    print('page errors', errs); await b.close()
asyncio.run(main())

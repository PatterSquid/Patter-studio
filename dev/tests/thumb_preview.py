# Thumbnails from every layout with two cut out pictures (the stand-in models give the real model's masks), saved as the
# JPGs the Save button makes, plus a before and after of each cut out. Args: output folder.
import asyncio, sys, os, base64, time
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/thumb_prev'; os.makedirs(OUT, exist_ok=True)
async def cut(pg, pic):
  await pg.evaluate("""async (pic) => { const b = await (await fetch('/tmp_cutout/' + pic)).blob(); const W = Thumb._W; W.cfg.layers = W.cfg.layers.filter(q => q.k !== 'image' || q.slot); const L = W.cfg.layers.find(q => q.k === 'image'); L.asset = ''; L.cut = null; window.__L = L;
    await Thumb._addPicture(new File([b], pic, { type: 'image/png' }), L); Cutout.stop(); await Thumb._removeBg(L); window.__done = { asset: L.asset, cut: L.cut, crop: L.crop }; }""", pic)
  return await pg.evaluate("window.__done")
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface'])
    ctx = await b.new_context(viewport={'width': 1366, 'height': 768}); errs = []
    async def page(model):
      pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
      if model: await pg.add_init_script("window.PATTER_CUTOUT='http://127.0.0.1:8765/tmp_cutout/f_%s/'; indexedDB.deleteDatabase('patter-cutout');" % model)
      await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
      await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
      await pg.evaluate("document.querySelector('#tabs button[data-mod=thumb]').click()"); await pg.wait_for_timeout(800); return pg
    pics = {}
    for name, pic in [('busy', 'busy.png'), ('astronaut', 'astronaut.png')]:
      pg = await page(name); pics[name] = await cut(pg, pic); print(name, pics[name], flush=True); await pg.close()
    pg = await page(None)
    plan = [('split', ['busy'], 'TOO WEE\nTO FAIL'), ('shock', ['astronaut'], 'NAE\nCHANCE'), ('word', ['busy'], 'RAGING'), ('versus', ['busy', 'astronaut'], None), ('news', ['astronaut'], None)]
    for k, who, words in plan:
      data = await pg.evaluate("""async ([k, items, words]) => { const W = Thumb._W; Thumb.applyTemplate(W.cfg, k); const slots = W.cfg.layers.filter(L => L.k === 'image' && L.slot);
        for (const [i, it] of items.entries()) { const L = slots[i]; if (!L) continue; L.asset = it.asset; await CutMedia.bitmap(it.asset); if (k !== 'news') { L.cut = it.cut; await CutMedia.bitmap(it.cut.mask); await CutMedia.bitmap(it.cut.fg); L.crop = it.crop; } Thumb._fit(L); }
        if (words) { const T = W.cfg.layers.find(L => L.k === 'text'); if (T) T.text = words; }
        const b = await Thumb._blob({ fmt: 'jpg', scale: 1 }); const r = new FileReader(); return await new Promise(res => { r.onload = () => res([r.result.split(',')[1], b.size]); r.readAsDataURL(b); }); }""", [k, [pics[w] for w in who], words])
      open(f'{OUT}/thumb_{k}.jpg', 'wb').write(base64.b64decode(data[0])); print(k, data[1], 'bytes', flush=True)
    print('errors', errs[:6]); await b.close()
asyncio.run(main())

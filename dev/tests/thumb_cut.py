# The Thumbnail tab's background remover end to end: download (from a local copy), cut a picture out on the graphics
# card (SwiftShader WebGPU here), the edge and colour clean up, fix by hand, save as JPG. Needs dev/tmp_cutout/ (a copy of
# cutout/ with a full precision model, since SwiftShader has no 16 bit floats) and a picture in it.
import asyncio, sys, os, json, time
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/thumb_cut'; os.makedirs(OUT, exist_ok=True)
PIC = sys.argv[2] if len(sys.argv) > 2 else 'astronaut.png'
MODEL = sys.argv[3] if len(sys.argv) > 3 else ''   # e.g. f_astronaut/: a stand-in model that gives the real model's mask, to test the rest quickly
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface'])
    pg = await b.new_page(viewport={'width': 1366, 'height': 768}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script("window.PATTER_CUTOUT='http://127.0.0.1:8765/tmp_cutout/%s'" % MODEL)
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelector('#tabs button[data-mod=thumb]').click()"); await pg.wait_for_timeout(800)
    t0 = time.time()
    await pg.evaluate("""async (pic) => { const b = await (await fetch('/tmp_cutout/' + pic)).blob(); const W = Thumb._W, L = W.cfg.layers.find(q => q.k === 'image'); window.__L = L;
      await Thumb._addPicture(new File([b], pic, { type: 'image/png' }), L); Thumb._removeBg(L); }""", PIC)
    r = None
    for i in range(400):
      await pg.wait_for_timeout(1500); st = await pg.evaluate("({ busy: Thumb._W.busy, say: Thumb._W.say, cut: window.__L.cut, how: Cutout.how, asset: window.__L.asset })")
      if i % 10 == 0: print(round(time.time() - t0), st['busy'], '|', st['say'], flush=True)
      if st['cut'] or 'failed' in (st['say'] or ''): r = st; break
    print('cut', r, round(time.time() - t0), 's'); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + '/cut.png')
    # fix by hand: Remove a stroke across the face, Done, then the mask has less in it; then tidy stray bits
    R = await pg.evaluate("(()=>{const r=document.querySelector('.th-ov').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]})()"); k = R[2] / 1280
    L = await pg.evaluate("(()=>{const L=Thumb._W.cfg.layers.find(q=>q.k==='image'); return {x:L.x,y:L.y,w:L.w,h:L.h,mask:L.cut.mask}})()")
    await pg.evaluate("[...document.querySelectorAll('.th-insp button')].find(b=>/Fix by hand/.test(b.textContent)).click()"); await pg.wait_for_timeout(800)
    await pg.evaluate("[...document.querySelectorAll('.th-insp .st-seg button')].find(b=>b.textContent==='Remove').click()"); await pg.wait_for_timeout(200)
    x0, y0 = R[0] + (L['x'] - L['w'] * 0.3) * k, R[1] + (L['y'] - L['h'] * 0.25) * k
    await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x0 + L['w'] * 0.6 * k, y0, steps=12); await pg.mouse.up(); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + '/brush.png')
    await pg.evaluate("[...document.querySelectorAll('.th-insp button')].find(b=>b.textContent==='Done').click()")
    for i in range(60):
      await pg.wait_for_timeout(1000); m2 = await pg.evaluate("Thumb._W.cfg.layers.find(q=>q.k==='image').cut.mask")
      if m2 != L['mask']: break
    sums = await pg.evaluate("""async (ids) => { const out = []; for (const id of ids) { const b = await CutMedia.bitmap(id), c = new OffscreenCanvas(b.width, b.height), g = c.getContext('2d'); g.drawImage(b, 0, 0); const d = g.getImageData(0, 0, b.width, b.height).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; out.push(s); } return out; }""", [L['mask'], m2])
    print('brush', 'mask changed' if m2 != L['mask'] else 'MASK NOT CHANGED', 'removed %.1f%%' % (100 * (1 - sums[1] / max(1, sums[0]))))
    await pg.evaluate("[...document.querySelectorAll('.th-insp button')].find(b=>/Tidy stray/.test(b.textContent)).click()"); await pg.wait_for_timeout(2500); print('tidy', await pg.evaluate("Thumb._W.say"))
    await pg.screenshot(path=OUT + '/fixed.png')
    # sticker edge and a JPG under 2 MB
    info = await pg.evaluate("""async () => { const L = Thumb._W.cfg.layers.find(q => q.k === 'image'); L.outline = { on: true, c: '#ffffff', w: 12 }; Thumb._W.changed(); const b = await Thumb._blob({ fmt: 'jpg', scale: 1 }); const png = await Thumb._blob({ fmt: 'png', scale: 2 });
      const bm = await createImageBitmap(b); return { jpg: b.size, w: bm.width, h: bm.height, png2: png.size }; }""")
    print('save', info); await pg.wait_for_timeout(800); await pg.screenshot(path=OUT + '/outline.png')
    print('errors', errs[:8]); await b.close()
asyncio.run(main())

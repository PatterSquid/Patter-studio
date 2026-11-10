# The font library: the chooser (tabs, search, previews drawn in each font), picking a font for thumbnail words (it is
# downloaded, kept, drawn), weights, and a library font in video text drawn the same by the export helpers. Args: out folder.
import asyncio, sys, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/fonts_ui'; os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1366, 'height': 768}); errs = []; bad = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def check(ok, what):
      print(('ok   ' if ok else 'FAIL ') + what, flush=True)
      if not ok: bad.append(what)
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelector('#tabs button[data-mod=thumb]').click()"); await pg.wait_for_timeout(800)
    n = await pg.evaluate("FontLib.LIST.length"); check(n > 1800, 'library has %d fonts' % n)
    T = await pg.evaluate("Thumb._W.cfg.layers.find(L=>L.k==='text').id"); await pg.evaluate("Thumb._W.sel=%r" % T); await pg.evaluate("Thumb._W.changed()")
    await pg.evaluate("document.querySelector('#thumbWs .th-insp') && 0"); await pg.keyboard.press('Escape'); await pg.evaluate("Thumb._W.sel=%r" % T)
    await pg.evaluate("Thumb.activate(true)"); await pg.evaluate("(()=>{ const W=Thumb._W; W.sel=%r; })()" % T); await pg.mouse.click(10, 10)
    await pg.evaluate("Thumb._W.sel=%r; document.querySelector('.th-rail button[data-dr=text]').click()" % T)
    await pg.evaluate("Thumb.form(null, Thumb._W.cfg, Thumb._W.changed)"); await pg.wait_for_timeout(300)
    await pg.click('.th-fontbtn'); await pg.wait_for_timeout(2500)
    rows = await pg.evaluate("document.querySelectorAll('#fontPick .fp-row').length"); check(rows >= 40, 'thumbnail picks listed (%d)' % rows)
    styled = await pg.evaluate("[...document.querySelectorAll('#fontPick .fp-s')].filter(s=>s.style.fontFamily).length"); check(styled >= 8, 'previews drawn in their own fonts (%d)' % styled)
    await pg.screenshot(path=OUT + '/picker.png')
    await pg.click('#fontPick .fp-tabs button:nth-child(4)'); await pg.wait_for_timeout(600); c = await pg.evaluate("document.querySelector('#fontPick .fp-count').textContent"); check('1,8' in c or '1,9' in c, 'All tab: ' + c)
    await pg.fill('#fontPick .fp-top input', 'bang'); await pg.wait_for_timeout(600); names = await pg.evaluate("[...document.querySelectorAll('#fontPick .fp-row')].map(r=>r.dataset.f)"); check('Bangers' in names, 'search finds Bangers ' + str(names[:4]))
    await pg.click('#fontPick .fp-row[data-f=Bangers]'); await pg.wait_for_timeout(2500)
    L = await pg.evaluate("Thumb._W.cfg.layers.find(L=>L.k==='text')"); check(L['font'] == 'Bangers', 'words now in Bangers')
    ok = await pg.evaluate("document.fonts.check('400 40px \"Bangers\"')"); check(ok, 'Bangers loaded')
    kept = await pg.evaluate("new Promise(r=>{ const q=indexedDB.open('patter-fonts'); q.onsuccess=()=>{ const t=q.result.transaction('f').objectStore('f').getAllKeys(); t.onsuccess=()=>r(t.result); }; })"); check(any('Bangers' in k for k in kept), 'kept on the computer ' + str(kept))
    # weights: Oswald has seven
    await pg.evaluate("(()=>{ const L=Thumb._W.cfg.layers.find(L=>L.k==='text'); L.font='Oswald'; L.weight=700; Thumb._W.changed(); Thumb.form(null, Thumb._W.cfg, Thumb._W.changed); })()"); await pg.wait_for_timeout(1500)
    nw = await pg.evaluate("document.querySelectorAll('.th-fontpick select option').length"); check(nw >= 5, 'Oswald weights to choose (%d)' % nw)
    await pg.screenshot(path=OUT + '/tab.png')
    # video text in a library font, drawn by the export helpers like the page
    r = await pg.evaluate("""async () => { await FontLib.ensure('Bangers', 400); const v = Video.defaults(); v.items = [{ id: 'c1', kind: 'colour', fill: '#203050', dur: 1.2 }]; v.layers = [{ id: 'L1', k: 'text', text: 'GLASGOW', font: 'g:Bangers|400', size: 200, colour: '#ffffff', style: 'plain', caps: true, x: 0.5, y: 0.5, start: 0, end: 1.2 }];
      const shots = {}; for (const workers of [undefined, false]) { const files = {}; const dir = { getFileHandle: async name => ({ createWritable: async () => { const parts = []; return { write: async b => parts.push(b), close: async () => { files[name] = new Blob(parts); } }; } }) };
        const res = await CutExport.run(v, { scheme: 'saltire', format: '16:9' }, { fps: 25, res: '720', png: true, dir, workers, blur: 'off' }); const bm = await createImageBitmap(files['frame_00020.png']); const c = new OffscreenCanvas(320, 180), g = c.getContext('2d'); g.drawImage(bm, 0, 0, 320, 180); shots[workers === false ? 'page' : 'helpers'] = { d: g.getImageData(0, 0, 320, 180).data, helpers: res.helpers }; }
      const A = shots.helpers.d, B = shots.page.d; let s = 0; for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]); return { helpers: shots.helpers.helpers, diff: s / (A.length / 4) }; }""")
    check(r['helpers'] > 0 and r['diff'] < 1, 'video text in Bangers: helpers %d, difference %.2f' % (r['helpers'], r['diff']))
    print('errors', errs[:5]); print('FAILED' if bad or errs else 'ALL OK', bad); await b.close()
asyncio.run(main())

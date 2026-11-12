# The Thumbnail tab with a real mouse and keyboard: select, drag (snaps to the middle), resize by a corner, turn, type
# words, line colours, add shapes, stickers and text from the drawers, reorder layers, undo and redo, change layout and
# size, the YouTube preview, keys, and saving. Checks the picture changes and nothing throws. Args: output folder.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/thumb_ui'; os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1366, 'height': 768}); errs = []; bad = []
    pg.on('pageerror', lambda e: errs.append(str(e)+' '+(e.stack or '')[:600]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelector('#tabs button[data-mod=thumb]').click()"); await pg.wait_for_timeout(800)
    cfg = lambda: pg.evaluate("JSON.parse(JSON.stringify(Thumb._W.cfg))")
    def check(ok, what):
      print(('ok   ' if ok else 'FAIL ') + what, flush=True)
      if not ok: bad.append(what)
    R = await pg.evaluate("(()=>{const r=document.querySelector('.th-ov').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]})()"); k = R[2] / 1280
    at = lambda x, y: (R[0] + x * k, R[1] + y * k)
    c0 = await cfg(); T = [L for L in c0['layers'] if L['k'] == 'text'][0]
    # select the words and drag them to the middle (snap)
    await pg.mouse.click(*at(T['x'], T['y'])); await pg.wait_for_timeout(200); check(await pg.evaluate("Thumb._W.sel") == T['id'], 'click selects the words')
    await pg.mouse.move(*at(T['x'], T['y'])); await pg.mouse.down(); await pg.mouse.move(*at(645, 300), steps=8); await pg.mouse.move(*at(642, 300), steps=2); await pg.mouse.up(); await pg.wait_for_timeout(200)
    c1 = await cfg(); T1 = [L for L in c1['layers'] if L['id'] == T['id']][0]; check(T1['x'] == 640, 'drag snaps to the middle (x %s)' % T1['x'])
    # resize by the bottom right corner: the words get bigger
    hx, hy = T1['x'] + T1['w'] / 2, T1['y'] + T1['h'] / 2; await pg.mouse.move(*at(hx, hy)); await pg.mouse.down(); await pg.mouse.move(*at(hx + 120, hy + 60), steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
    c2 = await cfg(); T2 = [L for L in c2['layers'] if L['id'] == T['id']][0]; check(T2['size'] > T1['size'] * 1.1 and T2['w'] > T1['w'], 'corner makes the words bigger (%d to %d)' % (T1['size'], T2['size']))
    # type new words, give line 2 a colour
    await pg.fill('.th-text', 'ONE\nTWO\nTHREE'); await pg.dispatch_event('.th-text', 'change'); await pg.wait_for_timeout(300)
    n = await pg.evaluate("document.querySelectorAll('.th-cols input[type=color]').length"); check(n == 3, 'a colour for each line (%d)' % n)
    await pg.evaluate("(()=>{const i=document.querySelectorAll('.th-cols input[type=color]')[2]; i.value='#00ff00'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change'));})()"); await pg.wait_for_timeout(200)
    c3 = await cfg(); T3 = [L for L in c3['layers'] if L['id'] == T['id']][0]; check(T3['text'] == 'ONE\nTWO\nTHREE' and T3['cols'][2] == '#00ff00', 'words and line colour')
    # undo twice and redo
    await pg.keyboard.press('Escape'); await pg.click('#hdrUndo'); await pg.wait_for_timeout(300); c4 = await cfg(); T4 = [L for L in c4['layers'] if L['id'] == T['id']][0]; check(T4['cols'][-1] != '#00ff00' or len(T4['cols']) < 3, 'undo takes the colour back')
    await pg.click('#hdrRedo'); await pg.wait_for_timeout(300); c5 = await cfg(); T5 = [L for L in c5['layers'] if L['id'] == T['id']][0]; check(T5['cols'][2] == '#00ff00', 'redo puts it back')
    # drawers: a shape, a sticker, a text style
    await pg.click('.th-rail button[data-dr=shape]'); await pg.click('.th-sgrid .th-tile:nth-child(4)'); await pg.click('.th-rail button[data-dr=emoji]'); await pg.click('.th-egrid .th-emo:nth-child(1)')
    await pg.click('.th-rail button[data-dr=text]'); await pg.click('.th-col .th-tline:nth-child(3)'); await pg.wait_for_timeout(300)
    c6 = await cfg(); check(len(c6['layers']) == len(c5['layers']) + 3, 'three layers added from the drawers (%d)' % len(c6['layers']))
    # turn the selected one with the dot above it, then Delete, then Ctrl+D on another
    L = c6['layers'][-1]; await pg.evaluate("Thumb._W.sel = %r" % L['id'])
    import math
    rx, ry = L['x'], L['y'] - L['h'] / 2 - 34 / k; await pg.mouse.move(*at(rx, ry)); await pg.mouse.down(); await pg.mouse.move(*at(L['x'] + 200, L['y']), steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
    c7 = await cfg(); check(abs(c7['layers'][-1]['rot']) > 45, 'the dot turns it (%s)' % c7['layers'][-1]['rot'])
    await pg.keyboard.press('Delete'); await pg.wait_for_timeout(200); c8 = await cfg(); check(len(c8['layers']) == len(c7['layers']) - 1, 'Delete removes it')
    await pg.evaluate("Thumb._W.sel = %r" % c8['layers'][-1]['id']); await pg.keyboard.press('Control+d'); await pg.wait_for_timeout(200); c9 = await cfg(); check(len(c9['layers']) == len(c8['layers']) + 1, 'Ctrl+D duplicates')
    await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Shift+ArrowDown'); await pg.wait_for_timeout(500); c10 = await cfg(); a, z = c9['layers'][-1], c10['layers'][-1]; check(z['x'] == a['x'] + 1 and z['y'] == a['y'] + 10, 'arrow keys nudge')
    # reorder in the layers strip: drag the bottom chip onto the top one
    await pg.locator('.th-chip').last.drag_to(pg.locator('.th-chip').first); await pg.wait_for_timeout(300); c11 = await cfg(); check(c11['layers'][-1]['id'] == c10['layers'][0]['id'] or c11['layers'][-2]['id'] == c10['layers'][0]['id'], 'drag in the layers strip brings it to the front')
    # layouts and sizes
    await pg.keyboard.press('Escape'); await pg.click('.th-rail button[data-dr=tpl]'); await pg.click('.th-tgrid .th-tile:nth-child(4)'); await pg.wait_for_timeout(400); c12 = await cfg(); check(sum(1 for L in c12['layers'] if L['k'] == 'image') == 2, 'the Versus layout')
    await pg.keyboard.press('Escape'); await pg.evaluate("Thumb._W.sel=null"); await pg.click('#hdrUndo'); await pg.wait_for_timeout(300)
    await pg.evaluate("[...document.querySelectorAll('.th-insp .st-seg button')].find(b=>/Tall/.test(b.textContent)).click()"); await pg.wait_for_timeout(500); c13 = await cfg(); check(c13['fmt'] == '9:16', 'tall size')
    await pg.screenshot(path=OUT + '/tall.png')
    await pg.evaluate("[...document.querySelectorAll('.th-insp .st-seg button')].find(b=>/16:9/.test(b.textContent)).click()"); await pg.wait_for_timeout(300)
    # YouTube preview and the save window
    await pg.evaluate("[...document.querySelectorAll('.th-top button')].find(b=>/YouTube/.test(b.textContent)).click()"); await pg.wait_for_timeout(600); await pg.screenshot(path=OUT + '/feed.png')
    check(await pg.evaluate("!document.querySelector('.th-feed').hidden && document.querySelectorAll('.th-fcard canvas').length === 3"), 'YouTube preview shows three sizes'); await pg.keyboard.press('Escape')
    await pg.click('#hdrExport'); await pg.wait_for_timeout(300); check(await pg.evaluate("!!document.querySelector('#thExport[open]')"), 'Export opens the save window'); await pg.keyboard.press('Escape')
    blob = await pg.evaluate("Thumb._blob({fmt:'jpg',scale:1}).then(b=>b.size)"); check(0 < blob < 2e6, 'JPG under 2 MB (%d)' % blob)
    # picture changes as layers change (not blank)
    px = await pg.evaluate("(()=>{const c=document.querySelector('.th-cv'), g=c.getContext('2d'), d=g.getImageData(0,0,c.width,c.height).data; let s=0; for(let i=0;i<d.length;i+=4000) s+=d[i]+d[i+1]+d[i+2]; return s})()"); check(px > 0, 'the thumbnail is drawn')
    await pg.screenshot(path=OUT + '/end.png')
    print('errors', errs[:6]); print('FAILED' if bad or errs else 'ALL OK', bad); await b.close()
asyncio.run(main())

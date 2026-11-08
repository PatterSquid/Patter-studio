import asyncio, json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(600)
    await pg.evaluate("""()=>{ const c=Video.hooks.cfg(); c.items=[ {id:'a',kind:'colour',fill:'#aa3333',dur:3,tr:{k:'fade',d:0.5}},{id:'b',kind:'colour',fill:'#33aa33',dur:3},{id:'c',kind:'colour',fill:'#3333aa',dur:3} ]; c.tracks=[]; PatterCut.ui.build(); }""")
    L=lambda: pg.evaluate("()=>Video.layout(Video.hooks.cfg(),{format:'16:9'}).map(o=>o.it.id+'@'+o.t0.toFixed(2)+'+'+o.d.toFixed(2)+(o.it.gap?' gap'+o.it.gap:'')).join('  ')")
    print('start ', await L())
    await pg.click('.ct-snap'); await pg.wait_for_timeout(300); print('free', await pg.evaluate("()=>Video.hooks.cfg().free"))
    # drag c far right
    bc=await pg.locator('[data-id="C:c"]').bounding_box(); await pg.mouse.move(bc['x']+30,bc['y']+30); await pg.mouse.down(); await pg.mouse.move(bc['x']+230,bc['y']+30,steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('move c', await L())
    # trim end of a shorter: b should stay put
    ba=await pg.locator('[data-id="C:a"]').bounding_box(); await pg.mouse.move(ba['x']+ba['width']-3,ba['y']+ba['height']-8); await pg.mouse.down(); await pg.mouse.move(ba['x']+ba['width']-50,ba['y']+ba['height']-8,steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('trim a', await L())
    # delete b leaves gap
    await pg.evaluate("()=>PatterCut.select('C:b')"); await pg.keyboard.press('Delete'); await pg.wait_for_timeout(300); print('del b ', await L())
    # preview in the gap is black
    t=await pg.evaluate("()=>{ const L=Video.layout(Video.hooks.cfg(),{format:'16:9'}); return (L[0].t0+L[0].d+L[1].t0)/2; }")
    px=await pg.evaluate(f"""()=>{{ const cv=document.createElement('canvas'); cv.width=192; cv.height=108; const g=cv.getContext('2d'); g.scale(0.1,0.1); Layers.wrap(Video).draw(g,{t},Video.hooks.cfg(),{{format:'16:9',scheme:'saltire',preview:false}},1920,1080); return [...g.getImageData(96,54,1,1).data]; }}""")
    print('gap pixel', px, 'at', round(t,2))
    # add a colour card at 1.0 s in free mode via library
    await pg.evaluate("()=>{ PatterCut.player.seek(9.5); PatterCut.ui.addBlock('colour'); }"); await pg.wait_for_timeout(300); print('add@9.5', await L())
    # snap back on closes gaps
    await pg.click('.ct-snap'); await pg.wait_for_timeout(300); print('snap on', await L())
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300); print('undo  ', await L(), await pg.evaluate("()=>Video.hooks.cfg().free"))
    await pg.screenshot(path='/tmp/claude-0/chk/snap.png', clip={'x':0,'y':615,'width':1600,'height':160})
    print('errors', errs); await b.close()
asyncio.run(main())

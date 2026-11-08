import asyncio, json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(600)
    await pg.evaluate("""()=>{ const c=Video.hooks.cfg(); c.items=[ {id:'a',kind:'colour',fill:'#aa3333',dur:4,tr:{k:'whip',d:0.8}},{id:'b',kind:'colour',fill:'#33aa33',dur:4},{id:'c',kind:'avatar',text:'Right, here we go',dur:4},{id:'d',kind:'colour',fill:'#3333aa',dur:4} ]; c.tracks=[]; PatterCut.ui.build(); }""")
    await pg.wait_for_timeout(500)
    st=lambda: pg.evaluate("()=>Video.hooks.cfg().items.map(x=>x.id+':'+(x.tr?x.tr.k+'/'+x.tr.d:'-')).join(' ')")
    print('start', await st())
    async def box(sel): return await pg.locator(sel).bounding_box()
    a=await box('.ct-tr[data-tr="a"]'); c=await box('.ct-tr[data-tr="c"]')
    await pg.mouse.move(a['x']+6,a['y']+6); await pg.mouse.down(); await pg.mouse.move((a['x']+c['x'])/2, a['y']+6, steps=5); await pg.mouse.move(c['x']+7,c['y']+6,steps=5)
    await pg.screenshot(path='/tmp/claude-0/chk/tr1.png', clip={'x':0,'y':640,'width':1600,'height':320}); await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('moved a->c', await st())
    # ctrl drag copy c -> a
    c=await box('.ct-tr[data-tr="c"]'); a=await box('.ct-tr[data-tr="a"]')
    await pg.keyboard.down('Control'); await pg.mouse.move(c['x']+6,c['y']+6); await pg.mouse.down(); await pg.mouse.move(a['x']+7,a['y']+6,steps=8); await pg.mouse.up(); await pg.keyboard.up('Control'); await pg.wait_for_timeout(300)
    print('copied c->a', await st())
    # length drag on c's bar, right handle
    h=await box('.ct-trs .hr >> nth=1'); await pg.mouse.move(h['x']+3,h['y']+5); await pg.mouse.down(); await pg.mouse.move(h['x']+60,h['y']+5,steps=6); await pg.wait_for_timeout(200); await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('longer', await st())
    print('selected', await pg.evaluate("()=>PatterCut.ui && document.querySelector('.ct-trs.on') ? 'bar on' : 'no'"))
    # undo twice
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200); print('undo1', await st())
    # click empty diamond adds fade
    bb=await box('.ct-tr[data-tr="b"]'); await pg.mouse.click(bb['x']+6,bb['y']+6); await pg.wait_for_timeout(300); print('click empty b', await st())
    # clip trim still works at a cut with a transition: drag right edge low on clip a
    ca=await box('[data-id="C:a"]'); await pg.mouse.move(ca['x']+ca['width']-3, ca['y']+ca['height']-10); await pg.mouse.down(); await pg.mouse.move(ca['x']+ca['width']-40, ca['y']+ca['height']-10, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('trim a', await pg.evaluate("()=>Video.hooks.cfg().items[0].dur"))
    await pg.evaluate("()=>{ PatterCut.player.seek(Video.layout(Video.hooks.cfg(),{format:'16:9'})[2].t0+1.5); PatterCut.select('C:c'); }"); await pg.wait_for_timeout(2500)
    await pg.screenshot(path='/tmp/claude-0/chk/tr2.png')
    print('errors', errs); await b.close()
asyncio.run(main())

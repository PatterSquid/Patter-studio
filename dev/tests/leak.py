import asyncio, json, sys
from playwright.async_api import async_playwright
TABS=['video','charts','timeline','map','flights','flyover','picto','news','story','broll','studio']
ROUNDS=int(sys.argv[1]) if len(sys.argv)>1 else 8
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1000}); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(3000)
        cdp=await pg.context.new_cdp_session(pg); await cdp.send('Performance.enable')
        async def heap():
            await cdp.send('HeapProfiler.collectGarbage'); await pg.wait_for_timeout(300)
            m={x['name']:x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
            dom=await pg.evaluate("()=>({nodes:document.getElementsByTagName('*').length, canv:document.querySelectorAll('canvas').length})")
            return round(m['JSHeapUsedSize']/1e6,1), int(m['Nodes']), int(m['JSEventListeners']), dom
        print('start', await heap(), flush=True)
        for r in range(ROUNDS):
            for t in TABS:
                await pg.evaluate(f"()=>document.querySelector('button[data-mod={t}]').click()"); await pg.wait_for_timeout(700)
                await pg.keyboard.press('Space'); await pg.wait_for_timeout(1500); await pg.keyboard.press('Space')
                await pg.evaluate("()=>{ try{ for(let i=0;i<5;i++) Layers.hooks.seek(Math.random()*20);}catch(e){} }")
            print('round',r, await heap(), flush=True)
        print('errors', errs[:5]); await b.close()
asyncio.run(main())

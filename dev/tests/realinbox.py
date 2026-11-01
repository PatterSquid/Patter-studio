import asyncio, json, os, re, base64
from playwright.async_api import async_playwright
REPO='/home/claude/patter-studio/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1000}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        async def gh(route):
            path=re.sub(r'^.*?/main/','',route.request.url.split('?')[0]); f=REPO+path
            if os.path.exists(f): await route.fulfill(path=f, headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'})
            else: await route.fulfill(status=404, body='nope', headers={'Access-Control-Allow-Origin':'*'})
        await pg.route('**/raw.githubusercontent.com/**', gh)
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(4000)
        print('status:', await pg.locator('#status').inner_text())
        await pg.evaluate("()=>document.getElementById('libBtn').click()"); await pg.wait_for_timeout(800)
        print('waiting:', await pg.evaluate("()=>[...document.querySelectorAll('dialog button')].filter(b=>/^Open/.test(b.textContent)).length"), 'projects to open')
        n=await pg.locator('dialog button', has_text='Open').count()
        for i in range(n):
            await pg.evaluate("()=>document.getElementById('libBtn').click()") if i else None; await pg.wait_for_timeout(800)
            btns=pg.locator('dialog[open] button', has_text='Open')
            if await btns.count()<=i: break
            await btns.nth(i).click(); await pg.wait_for_timeout(2500)
            print('opened:', await pg.evaluate("()=>{const s=JSON.parse(localStorage.getItem('patter-studio-v1')); return [s.name, s.module, Object.keys(s.cfg)]}"))
        await pg.wait_for_timeout(500)
        print('opened:', await pg.evaluate("()=>{const s=JSON.parse(localStorage.getItem('patter-studio-v1')); return [s.name, s.module, Object.keys(s.cfg)]}"))
        await pg.evaluate("()=>Layers.hooks.seek(7.5)"); await pg.wait_for_timeout(1000); await pg.locator('#prev').screenshot(path='/tmp/claude-0/chk/realinbox.png')
        print('packs:', await pg.evaluate("()=>Packs.list().map(p=>p.name)"), errs[:4] or 'no errors'); await b.close()
asyncio.run(main())

import asyncio, json, os, re
from playwright.async_api import async_playwright
FH='/tmp/claude-0/s/fakegh/'
os.makedirs(FH+'projects', exist_ok=True); os.makedirs(FH+'packs', exist_ok=True)
json.dump({'packs':[]}, open(FH+'packs/index.json','w'))
async def main():
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context('/tmp/claude-0/s/iprof', args=['--no-proxy-server'], viewport={'width':1600,'height':1000}); pg=ctx.pages[0] if ctx.pages else await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        async def gh(route):
            path=re.sub(r'^.*?/main/','',route.request.url.split('?')[0]); f=FH+path
            if os.path.exists(f): await route.fulfill(path=f, headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'})
            else: await route.fulfill(status=404, body='nope', headers={'Access-Control-Allow-Origin':'*'})
        await pg.route('**/raw.githubusercontent.com/**', gh)
        json.dump({'projects':[]}, open(FH+'projects/index.json','w'))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
        print('header buttons:', await pg.evaluate("()=>[...document.querySelectorAll('header button, .top button, #libBtn ~ button')].map(b=>b.textContent.trim()).filter(Boolean).join(' | ')"))
        print('dot before:', await pg.evaluate("()=>document.getElementById('libBtn').classList.contains('has-new')"))
        # publish a project to the fake GitHub: a Video tab project with a note
        st=json.loads(await pg.evaluate("()=>localStorage.getItem('patter-studio-v1')")); proj={'module':'video','look':st['look'],'cfg':{'video':st['cfg'].get('video') or {}},'assets':{},'name':'Immigration rant','note':'Built from your script'}
        if not proj['cfg']['video']: proj['cfg']={'video':None}
        raw=json.dumps(proj); open(FH+'projects/immigration.patter.json','w').write(raw)
        json.dump({'projects':[{'id':'immigration','name':'Immigration rant','note':'Built from your script','rev':'abc123','file':'immigration.patter.json'}]}, open(FH+'projects/index.json','w'))
        await pg.reload(); await pg.wait_for_timeout(3000)
        print('status:', await pg.locator('#status').inner_text())
        print('dot after:', await pg.evaluate("()=>document.getElementById('libBtn').classList.contains('has-new')"))
        await pg.screenshot(path='st/inbox_top.png', clip={'x':0,'y':0,'width':1600,'height':70})
        await pg.evaluate("()=>document.getElementById('libBtn').click()"); await pg.wait_for_timeout(800)
        await pg.screenshot(path='st/inbox_dlg.png')
        await pg.locator('dialog button', has_text='Open').first.click(); await pg.wait_for_timeout(2000)
        print('opened:', await pg.evaluate("()=>{const s=JSON.parse(localStorage.getItem('patter-studio-v1')); return [s.name, s.module, document.querySelector('#tabs button.on').dataset.mod]}"), '| dot now:', await pg.evaluate("()=>document.getElementById('libBtn').classList.contains('has-new')"))
        await pg.reload(); await pg.wait_for_timeout(3000)
        print('after reload, dot:', await pg.evaluate("()=>document.getElementById('libBtn').classList.contains('has-new')"), '| status:', (await pg.locator('#status').inner_text())[:60])
        await pg.evaluate("()=>document.getElementById('libBtn').click()"); await pg.wait_for_timeout(800)
        await pg.locator('dialog button', has_text='Packs and updates').click(); await pg.wait_for_timeout(600)
        print('packs window opens:', (await pg.locator('dialog h2').inner_text()))
        print(errs[:5] or 'no errors'); await ctx.close()
asyncio.run(main())

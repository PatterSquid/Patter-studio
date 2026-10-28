import asyncio, json, shutil
from playwright.async_api import async_playwright
FH='/home/claude/animator/fakehome/'
def publish(v, f):
    json.dump({'version':v,'file':'app/'+f}, open(FH+'version.json','w'))
async def main():
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context('/tmp/claude-0/s/lprof', args=['--no-proxy-server'], viewport={'width':1500,'height':1000}); errs=[]
        pg=ctx.pages[0] if ctx.pages else await ctx.new_page()
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        URL='http://127.0.0.1:8765/dist/test-launcher.html'
        async def state(tag):
            await pg.wait_for_timeout(3500)
            r=await pg.evaluate("()=>({v:window.PATTER_APP_VERSION||null, src:window.PatterLauncher&&PatterLauncher.source, upd:window.PatterLauncher&&PatterLauncher.justUpdated, tabs:document.querySelectorAll('#tabs button[data-mod]').length, status:(document.getElementById('status')||{}).textContent, packs:(()=>{try{return Packs.list().map(p=>p.name)}catch(e){return 'unavailable'}})(), ls:JSON.parse(localStorage.getItem('patter-launcher')||'{}')})")
            print(tag, json.dumps(r)[:600], flush=True)
        publish('2026.10.28.1','v2.html')
        await pg.goto(URL); await state('A first open (nothing newer)')
        # mark a project change to see it survives updates
        await pg.evaluate("()=>{ const s=JSON.parse(localStorage.getItem('patter-studio-v1')); s.name='Survivor'; localStorage.setItem('patter-studio-v1', JSON.stringify(s)); }")
        publish('2026.10.28.2','v2.html')
        await pg.goto(URL); await state('B new version published')
        await pg.goto(URL); await state('C reopen, same version')
        await pg.route('**/fakehome/**', lambda r: r.abort()); await pg.goto(URL); await state('D update server unreachable'); await pg.unroute('**/fakehome/**')
        publish('2026.10.28.3','v3.html')
        await pg.goto(URL); await state('E broken v3, first try')
        await pg.goto(URL); await state('F broken v3, second try')
        await pg.goto(URL); await state('G third open (should be back on v2)')
        await pg.evaluate("()=>PatterLauncher.goBack()"); await state('H after go back from v2')
        print('project name kept:', await pg.evaluate("()=>JSON.parse(localStorage.getItem('patter-studio-v1')).name"))
        print(errs[:6]); await ctx.close()
asyncio.run(main())

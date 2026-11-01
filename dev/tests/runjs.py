import asyncio, sys, json
from playwright.async_api import async_playwright
f=sys.argv[1]; arg=json.loads(sys.argv[2]) if len(sys.argv)>2 else None
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1100}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        r=await pg.evaluate(open(f).read(), arg)
        print(json.dumps(r,indent=1)[:6000]); print('pageerrors',errs[:5]); await b.close()
asyncio.run(main())

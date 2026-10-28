import asyncio, base64, sys
from playwright.async_api import async_playwright
js=open(sys.argv[1]).read()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        r=await pg.evaluate(js)
        for i,u in enumerate(r.pop('imgs',[])): open(f'st/b{i}.'+('png' if u.startswith('data:image/png') else 'jpg'),'wb').write(base64.b64decode(u.split(',')[1]))
        print(r, errs or 'ok'); await b.close()
asyncio.run(main())

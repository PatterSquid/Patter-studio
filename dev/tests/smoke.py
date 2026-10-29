import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        for m in ['video','charts','timeline','map','flights','flyover','picto','news','story','broll']:
            await pg.evaluate(f"()=>document.querySelector('button[data-mod={m}]').click()"); await pg.wait_for_timeout(600)
        print(await pg.evaluate("()=>window.PATTER_APP_VERSION"), errs or 'no errors'); await b.close()
asyncio.run(main())

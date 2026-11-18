# Writes down the words of a recording with the app's own listener. usage: listen_run.py recording.wav out.txt
import asyncio, sys, json
from playwright.async_api import async_playwright
WAV=sys.argv[1]; OUT=sys.argv[2]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
    pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:300]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.add_init_script("window.PATTER_LISTEN='/tmp_lshome/listen/';")
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
    r=await pg.evaluate("""async(wav)=>{ const t0=performance.now(); if((await Listen.check())!=='ready') await Listen.download(); const blob=await (await fetch(wav)).blob(); const x=await LipSync.decode(blob);
      const r=await Listen.transcribe(x,{}); return {r, ms:Math.round(performance.now()-t0)}; }""", WAV)
    print('ms', r['ms']); txt=r['r'] if isinstance(r['r'],str) else r['r'].get('text', json.dumps(r['r'])); open(OUT,'w').write(txt); print(txt[:1500])
    await b.close()
asyncio.run(main())

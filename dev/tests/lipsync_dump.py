# The app's own timing of a recording against its words. usage: lipsync_dump.py /recording.wav script.txt out.json [port]
import asyncio, sys, json
from playwright.async_api import async_playwright
WAV, TXT, OUT = sys.argv[1:4]; PORT = sys.argv[4] if len(sys.argv) > 4 else '8765'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
    pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:300]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(2000)
    r=await pg.evaluate("""async([wav,txt])=>{ const blob=await (await fetch(wav)).blob(); const x=await LipSync.decode(blob); const t0=performance.now(); const r=LipSync.analyse(x,txt); const ms=performance.now()-t0;
      return { ms, dur:r.dur, words:r.words, visemes:r.visemes, env:Array.from(r.env).map(v=>+v.toFixed(3)), pros: r.pros? {keys:Object.keys(r.pros)}:null }; }""", [WAV, open(TXT).read()])
    json.dump(r, open(OUT,'w')); print('ms', round(r['ms']), 'words', len(r['words']), 'visemes', len(r['visemes']), r['pros'])
    await b.close()
asyncio.run(main())

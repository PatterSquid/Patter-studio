# The whole of the new timing in the page: the listener writes the words with times, then the lip sync lines the script up inside them.
# usage: lipsync_heard.py /recording.wav out.json [script.txt]   (without a script the heard words are the script)
import asyncio, sys, json
from playwright.async_api import async_playwright
WAV, OUT = sys.argv[1:3]; TXT = open(sys.argv[3]).read() if len(sys.argv) > 3 else None
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
    pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:300])); pg.on('console', lambda m: print('CONSOLE', m.text[:200]) if m.type=='error' else None)
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.add_init_script("window.PATTER_LISTEN='/tmp_lshome/listen/';")
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
    r=await pg.evaluate("""async([wav,txt])=>{ if((await Listen.check())!=='ready') await Listen.download(); const blob=await (await fetch(wav)).blob(); const x=await LipSync.decode(blob);
      const t0=performance.now(); const h=await Listen.transcribe(x,{full:true}); const t1=performance.now(); const script=txt||h.text;
      const plain=LipSync.analyse(x,script,null), r=LipSync.analyse(x,script,{words:h.words}); const t2=performance.now();
      return { listenMs:Math.round(t1-t0), alignMs:Math.round(t2-t1), text:h.text, heard:h.words, pinned:r.pinned, words:r.words, visemes:r.visemes, plain:plain.words, dur:r.dur, env:Array.from(r.env).map(v=>+v.toFixed(3)) }; }""", [WAV, TXT])
    json.dump(r, open(OUT,'w')); print('listen ms', r['listenMs'], 'align ms', r['alignMs'], 'heard', len(r['heard'] or []), 'pinned', r['pinned'], 'of', len(r['words']), 'words')
    await b.close()
asyncio.run(main())

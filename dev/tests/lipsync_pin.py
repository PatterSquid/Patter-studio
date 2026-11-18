# Lines a script up inside heard words saved earlier by lipsync_heard.py (quick: no listening). usage: lipsync_pin.py /recording.wav heard.json out.json [script.txt] [port]
import asyncio, sys, json
from playwright.async_api import async_playwright
WAV, HEARD, OUT = sys.argv[1:4]; TXT = open(sys.argv[4]).read() if len(sys.argv) > 4 and sys.argv[4] != '-' else None; PORT = sys.argv[5] if len(sys.argv) > 5 else '8765'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
    pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:300]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    import os
    if os.environ.get('PIN'): await pg.add_init_script('window.PIN=['+os.environ['PIN']+'];')
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(1500)
    h=json.load(open(HEARD)); h=h if 'heard' in h else {'heard':h['words'],'text':' '.join(w[0] for w in h['words'])}
    r=await pg.evaluate("""async([wav,txt,heard])=>{ const blob=await (await fetch(wav)).blob(); const x=await LipSync.decode(blob); const t1=performance.now();
      if(window.PIN) LipSync._set(...window.PIN); const r=LipSync.analyse(x,txt,{words:heard}); return { alignMs:Math.round(performance.now()-t1), pinned:r.pinned, words:r.words, visemes:r.visemes, dur:r.dur, heard, text:txt, env:Array.from(r.env).map(v=>+v.toFixed(3)), pros:r.pros?{accents:r.pros.accents, units:r.pros.units, ips:r.pros.ips}:null }; }""", [WAV, TXT or h['text'], h['heard']])
    json.dump(r, open(OUT,'w')); print('align ms', r['alignMs'], 'pinned', r['pinned'], 'of', len(r['words']), 'words')
    await b.close()
asyncio.run(main())

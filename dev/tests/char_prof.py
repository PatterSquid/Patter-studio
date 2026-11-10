"""Character frame times at 1080p (puppet, his hand sheet when there, a voice) and the hot spots. Needs dev/tmp_puppet.puppet
and dev/tmp_voice2.wav; dev/tmp_hands/sheet.png is used when present."""
import asyncio, collections, os, sys
from playwright.async_api import async_playwright
NF = int(sys.argv[1]) if len(sys.argv) > 1 else 60
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1200)
    d = await pg.evaluate("""async(sheet)=>{ let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet')); if (sheet) rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob());
      const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice2.wav')).blob()], 'v.wav', { type: 'audio/wav' }));
      window.__c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, hands: 'animated' }); await Character.prepare(__c);
      window.__cv = document.createElement('canvas'); __cv.width = 1920; __cv.height = 1080; window.__g = __cv.getContext('2d'); window.__d = Character.duration(__c);
      for (let i = 0; i < 4; i++) Character.draw(__g, __d * i / 4, __c, { format: '16:9', scheme: 'saltire' }, 1920, 1080); return __d; }""", os.path.exists('tmp_hands/sheet.png'))
    run = """(n)=>{ const ts = []; for (let i = 0; i < n; i++) { const a = performance.now(); Character.draw(__g, __d * (i + 0.5) / n, __c, { format: '16:9', scheme: 'saltire' }, 1920, 1080); __g.getImageData(0, 0, 1, 1); ts.push(performance.now() - a); } ts.sort((a, b) => a - b); return { med: +ts[n >> 1].toFixed(1), p90: +ts[Math.floor(n * 0.9)].toFixed(1), max: +ts[n - 1].toFixed(1) }; }"""
    t = await pg.evaluate(run, NF)
    cdp = await pg.context.new_cdp_session(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {'interval': 200}); await cdp.send('Profiler.start')
    await pg.evaluate(run, NF); prof = (await cdp.send('Profiler.stop'))['profile']
    nodes = {n['id']: n for n in prof['nodes']}; cnt = collections.Counter(prof['samples']); tot = sum(cnt.values()); selfc = collections.Counter()
    for nid, c in cnt.items(): cf = nodes[nid]['callFrame']; selfc[(cf['functionName'] or '(anon)') + ':' + str(cf['lineNumber'])] += c
    print('char dur', round(d, 1), t)
    for k, c in selfc.most_common(14): print(f'  {100*c/tot:5.1f}%  {k}')
    print('errors:', errs); await b.close()
asyncio.run(main())

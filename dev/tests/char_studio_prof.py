"""The Studio with his character as the avatar: 1080p frame times and hot spots (no GPU flags, like the other profiles)."""
import asyncio, collections, os
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.evaluate("""async(sheet)=>{ let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet')); if (sheet) rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob());
      const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice2.wav')).blob()], 'v.wav', { type: 'audio/wav' }));
      const ch = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id }); await Character.prepare(ch); Studio.hooks.char = () => ch;
      await Studio.ready(); const c = Studio.defaults(); c.avatar = Object.assign({}, c.avatar || {}, { kind: 'char' }); await Studio.prepare(c); window.__sc = c;
      window.__cv = document.createElement('canvas'); __cv.width = 1920; __cv.height = 1080; window.__g = __cv.getContext('2d'); for (let i = 0; i < 3; i++) Studio.draw(__g, i, c, { format: '16:9', scheme: 'saltire' }, 1920, 1080); }""", os.path.exists('tmp_hands/sheet.png'))
    run = """(n)=>{ const c = __sc, d = Studio.duration(c), ts = []; for (let i = 0; i < n; i++) { const a = performance.now(); Studio.draw(__g, d * (i + 0.5) / n, c, { format: '16:9', scheme: 'saltire' }, 1920, 1080); __g.getImageData(0, 0, 1, 1); ts.push(performance.now() - a); } ts.sort((a, b) => a - b); return { med: +ts[n >> 1].toFixed(1), p90: +ts[Math.floor(n * 0.9)].toFixed(1), max: +ts[n - 1].toFixed(1) }; }"""
    print('studio + character 1080p', await pg.evaluate(run, 20))
    cdp = await pg.context.new_cdp_session(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {'interval': 300}); await cdp.send('Profiler.start')
    await pg.evaluate(run, 20); prof = (await cdp.send('Profiler.stop'))['profile']
    nodes = {n['id']: n for n in prof['nodes']}; cnt = collections.Counter(prof['samples']); tot = sum(cnt.values()); selfc = collections.Counter()
    for nid, c in cnt.items(): cf = nodes[nid]['callFrame']; selfc[(cf['functionName'] or '(anon)') + ':' + str(cf['lineNumber'])] += c
    for k, c in selfc.most_common(16): print(f'  {100*c/tot:5.1f}%  {k}')
    print('errors:', errs); await b.close()
asyncio.run(main())

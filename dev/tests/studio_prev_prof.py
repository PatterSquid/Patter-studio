"""The Studio as the preview draws it (preview on, playing, at the preview's size) with his character and the busy
outside events (the plane into the flats, demolition, fire): frame times and hot spots. argv: canvas width (default 1100)."""
import asyncio, collections, os, sys
from playwright.async_api import async_playwright
CW = int(sys.argv[1]) if len(sys.argv) > 1 else 1100
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.evaluate("""async(CW)=>{ let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet'));
      const ch = Object.assign(Character.defaults(), { puppet: rig.id }); await Character.prepare(ch); Studio.hooks.char = () => ch;
      await Studio.ready(); const c = Studio.defaults(); c.avatar = { kind: 'char', x: 0.5, y: 0.5, h: 1, inPt: 0, grade: 0.6, warm: 0.5, cool: 0.45, shadow: 0.5 }; c.weather = 'storm';
      c.events = [{ id: 'a', k: 'plane', start: 1, dur: 9 }, { id: 'b', k: 'carfire', start: 2, dur: 8 }]; await Studio.prepare(c); window.__sc = c;
      const H = Math.round(CW * 9 / 16); window.__cv = document.createElement('canvas'); __cv.width = CW; __cv.height = H; window.__g = __cv.getContext('2d'); window.__k = CW / 1920; }""", CW)
    run = """(o)=>{ const ts = []; for (let i = 0; i < o.n; i++) { const t = 1 + 8 * i / o.n, a = performance.now(); __g.setTransform(__k, 0, 0, __k, 0, 0); Studio.draw(__g, t, __sc, { format: '16:9', scheme: 'saltire', preview: o.prev, paused: false }, 1920, 1080); __g.getImageData(0, 0, 1, 1); ts.push(performance.now() - a); } ts.sort((a, b) => a - b); return { med: +ts[o.n >> 1].toFixed(1), p90: +ts[Math.floor(o.n * 0.9)].toFixed(1), max: +ts[o.n - 1].toFixed(1) }; }"""
    MODE = os.environ.get('MODE', 'preview')
    if MODE == 'export': await pg.evaluate("()=>{ window.__cv.width=1920; window.__cv.height=1080; window.__k=1; }")
    await pg.evaluate(run, {'n': 6, 'prev': MODE != 'export'}); await pg.wait_for_timeout(3000)
    print(MODE, CW, await pg.evaluate(run, {'n': 30, 'prev': MODE != 'export'}))
    cdp = await pg.context.new_cdp_session(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {'interval': 300}); await cdp.send('Profiler.start')
    await pg.evaluate(run, {'n': 20, 'prev': MODE != 'export'}); prof = (await cdp.send('Profiler.stop'))['profile']
    nodes = {n['id']: n for n in prof['nodes']}; cnt = collections.Counter(prof['samples']); tot = sum(cnt.values()); selfc = collections.Counter(); par = {}
    for n in prof['nodes']:
      for c2 in n.get('children', []): par[c2] = n['id']
    for nid, c in cnt.items():
      cf = nodes[nid]['callFrame']; nm = cf['functionName'] or '(anon)'
      if nm in ('drawImage', 'getImageData', 'putImageData', 'fill', 'stroke', 'fillRect') and nid in par: pc = nodes[par[nid]]['callFrame']; nm = nm + '<' + (pc['functionName'] or 'anon') + ':' + str(pc['lineNumber'])
      else: nm += ':' + str(cf['lineNumber'])
      selfc[nm] += c
    for k, c in selfc.most_common(18): print(f'  {100*c/tot:5.1f}%  {k}')
    print('export 1080p', await pg.evaluate("(o)=>{ window.__cv.width=1920; window.__cv.height=1080; window.__k=1; return 0; }", {}) or '', await pg.evaluate(run, {'n': 10, 'prev': False}))
    print('errors:', errs); await b.close()
asyncio.run(main())

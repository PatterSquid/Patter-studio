"""How the app answers the hand: a tour of every tab with real clicks, typing, slider drags, scrubbing and a short play,
recording for each step the long tasks (over 50 ms on the main thread), the slowest input event (press to next paint), the
longest gap between screen frames and where the browser's time went. usage: tour.py out.json [tabs,comma] [port]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]; ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] != '-' else None; PORT = sys.argv[3] if len(sys.argv) > 3 else '8765'
INIT = """
window.__lt=[]; window.__ev=[]; window.__gap=[];
try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]); }).observe({entryTypes:['longtask']}); }catch(e){}
try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) window.__ev.push([e.name,Math.round(e.duration),Math.round(e.processingEnd-e.processingStart)]); }).observe({type:'event',durationThreshold:16,buffered:true}); }catch(e){}
(function(){ let last=performance.now(); const f=()=>{ const n=performance.now(); if(n-last>34) window.__gap.push(Math.round(n-last)); last=n; requestAnimationFrame(f); }; requestAnimationFrame(f); })();
"""
KEYS = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount']
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width': 1440, 'height': 810}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.add_init_script(INIT)
    cdp = await pg.context.new_cdp_session(pg); await cdp.send('Performance.enable')
    async def met(): m = (await cdp.send('Performance.getMetrics'))['metrics']; return {x['name']: x['value'] for x in m if x['name'] in KEYS + ['JSHeapUsedSize', 'Nodes']}
    res = {}; t0 = asyncio.get_event_loop().time()
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html')
    await pg.wait_for_function("()=>document.querySelector('#tabs button') && typeof Video!=='undefined'", timeout=60000); await pg.wait_for_timeout(1500)
    nav = await pg.evaluate("()=>{ const n=performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; }")
    m0 = await met(); lt = await pg.evaluate("()=>window.__lt.splice(0)")
    res['start up'] = { 'domReady_ms': nav['dcl'], 'load_ms': nav['load'], 'long': len(lt), 'longSum': sum(x[1] for x in lt), 'longMax': max([x[1] for x in lt] or [0]), 'script_ms': round(m0['ScriptDuration'] * 1000), 'layout_ms': round((m0['LayoutDuration'] + m0['RecalcStyleDuration']) * 1000), 'heapMB': round(m0['JSHeapUsedSize'] / 1e6), 'nodes': m0['Nodes'] }
    async def step(name, fn, settle=350):
      await pg.evaluate("()=>{ window.__lt.length=0; window.__ev.length=0; window.__gap.length=0; }"); a = await met(); await fn(); await pg.wait_for_timeout(settle); z = await met()
      d = await pg.evaluate("()=>({lt:window.__lt.slice(), ev:window.__ev.slice(), gap:window.__gap.slice()})")
      res[name] = { 'long': len(d['lt']), 'longSum': sum(x[1] for x in d['lt']), 'longMax': max([x[1] for x in d['lt']] or [0]), 'evMax': max([x[1] for x in d['ev']] or [0]), 'gapMax': max(d['gap'] or [0]), 'gaps': len(d['gap']),
        'script_ms': round((z['ScriptDuration'] - a['ScriptDuration']) * 1000), 'layout_ms': round((z['LayoutDuration'] + z['RecalcStyleDuration'] - a['LayoutDuration'] - a['RecalcStyleDuration']) * 1000), 'layouts': round(z['LayoutCount'] - a['LayoutCount']), 'heapMB': round(z['JSHeapUsedSize'] / 1e6), 'nodes': z['Nodes'] }
    tabs = await pg.evaluate("()=>{ const o=[]; document.querySelectorAll('#tabs button').forEach(b=>{ if(b.offsetParent===null) return; if(b.dataset.mod) o.push(['top',b.dataset.mod]); else if(b.dataset.group) o.push(['group',b.dataset.group]); }); return o; }")
    order = []
    for kind, k in tabs:
      if kind == 'top': order.append((k, f"#tabs button[data-mod={k}]", None))
      else:
        rail = '#gfxRail' if k == 'gfx' else '#animRail'
        for m in await pg.evaluate("(r)=>Array.from(document.querySelectorAll(r+' button[data-mod]')).map(b=>b.dataset.mod)", rail): order.append((m, f"#tabs button[data-group={k}]", f"{rail} button[data-mod={m}]"))
    for name, top, rail in order:
      if ONLY and name not in ONLY: continue
      async def openTab():
        await pg.click(top)
        if rail: await pg.click(rail)
      await step(name + ': open', openTab, 600)
      box = await pg.evaluate("""()=>{ const vis=e=>e.offsetParent!==null && !e.disabled; const q=s=>Array.from(document.querySelectorAll(s)).filter(vis);
        const txt=q('aside input[type=text], aside textarea, .cut-insp input[type=text], .th-insp input[type=text], aside input:not([type])')[0], rng=q('aside input[type=range], .cut-insp input[type=range], .th-insp input[type=range]')[0], sc=q('#scrub')[0];
        const r=e=>{ if(!e) return null; e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return [b.x,b.y,b.width,b.height]; }; return { txt:r(txt), rng:r(rng), sc:r(sc) }; }""")
      if box['txt']:
        async def typing():
          x, y, w, h = box['txt']; await pg.mouse.click(x + w - 6, y + h / 2); await pg.keyboard.type(' abc de', delay=45); 
          for _ in range(7): await pg.keyboard.press('Backspace'); await pg.wait_for_timeout(30)
        await step(name + ': type', typing)
      if box['rng']:
        async def drag():
          x, y, w, h = box['rng']; await pg.mouse.move(x + w * 0.5, y + h / 2); await pg.mouse.down()
          for i in range(24): await pg.mouse.move(x + w * (0.3 + 0.4 * abs((i % 12) / 6 - 1)), y + h / 2); await pg.wait_for_timeout(16)
          await pg.mouse.up()
        await step(name + ': slider', drag)
      if box['sc']:
        async def scrub():
          x, y, w, h = box['sc']; await pg.mouse.move(x + w * 0.1, y + h / 2); await pg.mouse.down()
          for i in range(30): await pg.mouse.move(x + w * (0.1 + 0.8 * i / 29), y + h / 2); await pg.wait_for_timeout(16)
          await pg.mouse.up()
        await step(name + ': scrub', scrub)
        async def play():
          await pg.evaluate("()=>document.querySelector('#playBtn').click()"); await pg.wait_for_timeout(2200); await pg.evaluate("()=>document.querySelector('#playBtn').click()")
        await step(name + ': play', play)
      await pg.keyboard.press('Control+z')
    res['errors'] = errs; json.dump(res, open(OUT, 'w'), indent=1)
    for k, v in res.items():
      if k == 'errors': print('errors', v); continue
      print(f"{k:22s}", ' '.join(f"{a}={b}" for a, b in v.items()))
    await b.close()
asyncio.run(main())

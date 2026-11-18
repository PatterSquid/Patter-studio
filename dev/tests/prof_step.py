"""Where the script time goes in one action: a processor profile of a named step, summed by function.
usage: prof_step.py <boot|open:TAB|play:TAB|slider:TAB|type:TAB> [top n]   (TAB is a data-mod name: video, story, broll, ...)"""
import asyncio, sys, json, collections
from playwright.async_api import async_playwright
WHAT = sys.argv[1]; TOP = int(sys.argv[2]) if len(sys.argv) > 2 else 22
GFX = ['charts', 'timeline', 'map', 'flights', 'flyover', 'picto', 'news', 'story', 'broll']; ANIM = ['studio', 'char']
def summarise(prof, top):
    nodes = {n['id']: n for n in prof['nodes']}; dt = prof['timeDeltas']; self_t = collections.Counter(); tot = 0
    for nid, d in zip(prof['samples'], dt):
        cf = nodes[nid]['callFrame']; nm = cf['functionName'] or '(anon)'
        if nm in ('(idle)', '(program)'): continue
        self_t[f"{nm}:{cf['lineNumber'] + 1}"] += d; tot += d
    # also by top level caller (inclusive)
    parent = {}
    for n in prof['nodes']:
        for c in n.get('children', []): parent[c] = n['id']
    # the browser's own calls (drawImage and the like) charged to the function that made them
    by = collections.Counter()
    for nid, d in zip(prof['samples'], dt):
        cf = nodes[nid]['callFrame']
        if cf['url'] or cf['functionName'] in ('(idle)', '(program)', '(garbage collector)'): continue
        q = parent.get(nid); 
        while q and not nodes[q]['callFrame']['url']: q = parent.get(q)
        if q: pc = nodes[q]['callFrame']; by[f"{cf['functionName']} from {pc['functionName'] or '(anon)'}:{pc['lineNumber'] + 1}"] += d
    print(f"script {tot / 1000:.0f} ms")
    for k, v in by.most_common(6): print(f"  [{v / 1000:6.1f} ms  {k}]")
    for k, v in self_t.most_common(top): print(f"  {v / 1000:7.1f} ms  {k}")
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width': 1440, 'height': 810})
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    cdp = await pg.context.new_cdp_session(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {'interval': 200})
    kind, _, tab = WHAT.partition(':')
    if kind == 'boot':
        await cdp.send('Profiler.start'); await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(3500); summarise((await cdp.send('Profiler.stop'))['profile'], TOP); await b.close(); return
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(3000)
    async def openTab():
        if tab in GFX: await pg.click('#tabs button[data-group=gfx]'); await pg.click(f'#gfxRail button[data-mod={tab}]')
        elif tab in ANIM: await pg.click('#tabs button[data-group=anim]'); await pg.click(f'#animRail button[data-mod={tab}]')
        else: await pg.click(f'#tabs button[data-mod={tab}]')
    if kind != 'open':
        await openTab()
        await pg.wait_for_timeout(2500)
    await cdp.send('Profiler.start')
    if kind == 'open':
        if tab == 'video': await pg.click('#tabs button[data-group=gfx]'); await pg.wait_for_timeout(1200); await cdp.send('Profiler.stop'); await cdp.send('Profiler.start')
        await openTab(); await pg.wait_for_timeout(900)
    elif kind == 'play': await pg.evaluate("()=>document.querySelector('#playBtn').click()"); await pg.wait_for_timeout(1500)
    elif kind in ('slider', 'type'):
        sel = 'aside input[type=range]' if kind == 'slider' else 'aside input[type=text], aside textarea'
        bx = await pg.evaluate("(s)=>{ const e=Array.from(document.querySelectorAll(s)).filter(e=>e.offsetParent!==null&&!e.disabled)[0]; if(!e) return null; e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return [b.x,b.y,b.width,b.height, (e.closest('label,.field,div')||e).innerText.slice(0,40)]; }", sel)
        print('on', bx and bx[4]); x, y, w, h = bx[:4]
        if kind == 'slider':
            await pg.mouse.move(x + w * 0.5, y + h / 2); await pg.mouse.down()
            for i in range(24): await pg.mouse.move(x + w * (0.3 + 0.4 * abs((i % 12) / 6 - 1)), y + h / 2); await pg.wait_for_timeout(16)
            await pg.mouse.up()
        else: await pg.mouse.click(x + w - 6, y + h / 2); await pg.keyboard.type(' abc de', delay=45)
        await pg.wait_for_timeout(300)
    summarise((await cdp.send('Profiler.stop'))['profile'], TOP); await b.close()
asyncio.run(main())

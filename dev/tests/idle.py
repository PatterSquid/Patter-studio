"""What each tab does when nobody is touching it: over five idle seconds, how busy the main thread is, how many frame
callbacks and timers run, layouts and paints. A well behaved tab does next to nothing. usage: idle.py [tabs,comma]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
ONLY = sys.argv[1].split(',') if len(sys.argv) > 1 else None
INIT = """
window.__n={raf:0,to:0,iv:0};
(function(){ const R=window.requestAnimationFrame; window.requestAnimationFrame=function(f){ return R.call(window,function(t){ window.__n.raf++; return f(t); }); };
  const T=window.setTimeout; window.setTimeout=function(f,ms,...a){ return T.call(window,function(){ window.__n.to++; return typeof f==='function'?f.apply(this,arguments):0; },ms,...a); };
  const I=window.setInterval; window.setInterval=function(f,ms,...a){ return I.call(window,function(){ window.__n.iv++; return typeof f==='function'?f.apply(this,arguments):0; },ms,...a); }; })();
"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1440, 'height': 810})
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.add_init_script(INIT)
    cdp = await pg.context.new_cdp_session(pg); await cdp.send('Performance.enable')
    async def met(): m = (await cdp.send('Performance.getMetrics'))['metrics']; return {x['name']: x['value'] for x in m}
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(3000)
    tabs = await pg.evaluate("()=>{ const o=[]; document.querySelectorAll('#tabs button').forEach(b=>{ if(b.offsetParent===null) return; if(b.dataset.mod) o.push([b.dataset.mod, '#tabs button[data-mod='+b.dataset.mod+']', null]); else if(b.dataset.group){ const r=b.dataset.group==='gfx'?'#gfxRail':'#animRail'; document.querySelectorAll(r+' button[data-mod]').forEach(x=>o.push([x.dataset.mod, '#tabs button[data-group='+b.dataset.group+']', r+' button[data-mod='+x.dataset.mod+']'])); } }); return o; }")
    for name, top, rail in tabs:
      if ONLY and name not in ONLY: continue
      await pg.click(top)
      if rail: await pg.click(rail)
      await pg.mouse.move(700, 300); await pg.wait_for_timeout(4000)
      a = await met(); await pg.evaluate("()=>{ window.__n.raf=0; window.__n.to=0; window.__n.iv=0; }"); await pg.wait_for_timeout(5000); z = await met(); n = await pg.evaluate("()=>window.__n")
      print(f"{name:9s} busy {((z['TaskDuration']-a['TaskDuration'])/5*100):5.1f}%  script {((z['ScriptDuration']-a['ScriptDuration'])*1000/5):5.1f} ms/s  frames {n['raf']/5:5.1f}/s  timers {((n['to']+n['iv'])/5):4.1f}/s  layouts {((z['LayoutCount']-a['LayoutCount'])/5):4.1f}/s  styles {((z['RecalcStyleCount']-a['RecalcStyleCount'])/5):4.1f}/s  heap {z['JSHeapUsedSize']/1e6:.0f} MB", flush=True)
    await b.close()
asyncio.run(main())

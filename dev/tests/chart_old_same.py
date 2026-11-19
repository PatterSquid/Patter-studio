"""Charts made before the chart kit must be drawn exactly as they were. Draws a set of old settings (line and bars, every
ending, callouts, dragged timings, tall and wide) on two builds and compares every frame pixel by pixel, and their lengths.
usage: chart_old_same.py [N frames each] [old port] [new port]   (serve the published build from a worktree on the old port)"""
import asyncio, sys
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 24; A = sys.argv[2] if len(sys.argv) > 2 else '8766'; B = sys.argv[3] if len(sys.argv) > 3 else '8765'
BASE = {'type': 'line', 'title': 'UK population, millions', 'source': 'Source: ONS mid year estimates, approximate', 'rows': [['1975', '56.2'], ['1980', '56.3'], ['1985', '56.6'], ['1990', '57.2'], ['1995', '58.0'], ['2000', '58.9'], ['2005', '60.4'], ['2010', '62.8'], ['2015', '65.1'], ['2020', '67.1'], ['2024', '69.3']], 'prefix': '', 'suffix': 'm', 'decimals': 'auto', 'zeroBase': False, 'colour': 'Irn-Bru orange', 'hlColour': 'Neon red', 'milestones': [{'on': True, 'idx': 5, 'caption': 'Growth takes off'}], 'counter': True, 'camera': True, 'speed': 'normal', 'hold': 2, 'ending': 'none', 'endText': ''}
CASES = [('line', {}), ('bar', {'type': 'bar'}), ('line explode', {'ending': 'explode', 'endText': 'Boom'}), ('bar fly', {'type': 'bar', 'ending': 'fly', 'speed': 'fast'}), ('line timed', {'timing': {'intro': 2.2, 'draw': 7}, 'camera': False, 'zeroBase': True}),
         ('bar own', {'type': 'bar', 'title': 'Pints', 'rows': [['Mon', '2'], ['Tue', '-1'], ['Wed', '7.5'], ['Thu', '3']], 'milestones': [{'on': True, 'idx': 2, 'caption': ''}, {'on': False, 'idx': 0, 'caption': 'x'}], 'counter': False, 'prefix': '£', 'suffix': '', 'colour': 'Saltire blue', 'hold': 0, 'timing': {'draw': 3}})]
JS = """async([cfgs,N])=>{ const M=Layers.wrap(Charts), mods={charts:M}, out={}; for (const [name,over] of cfgs) for (const fmt of ['16:9','9:16']) { const cfg=JSON.parse(JSON.stringify(over)); if (typeof Repair!=='undefined') Repair.clip('charts', cfg, mods, 1);
  const look={scheme:'saltire',format:fmt,texture:true}, dm=E.dims(fmt), c=document.createElement('canvas'); c.width=dm.W/2; c.height=dm.H/2; const g=c.getContext('2d',{willReadFrequently:true}), d=M.duration(cfg,look), hs=[];
  for(let i=0;i<N;i++){ g.setTransform(0.5,0,0,0.5,0,0); g.clearRect(0,0,dm.W,dm.H); M.draw(g,d*i/(N-1),cfg,look,dm.W,dm.H); const D=g.getImageData(0,0,c.width,c.height).data; let h=0; for(let j=0;j<D.length;j+=5) h=(h*31+D[j])|0; hs.push(h); }
  out[name+' '+fmt]={ d:+d.toFixed(4), hs, keys:Object.keys(cfg).sort().join(',') }; } return out; }"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); res = {}
    for port in (A, B):
      pg = await b.new_page(); await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.goto(f'http://127.0.0.1:{port}/dist/test.html'); await pg.wait_for_timeout(2500)
      res[port] = await pg.evaluate(JS, [[(n, dict(BASE, **o)) for n, o in CASES], N]); await pg.close()
    bad = 0
    for k in res[A]:
      x, y = res[A][k], res[B][k]; diff = [i for i in range(N) if x['hs'][i] != y['hs'][i]]; same = not diff and x['d'] == y['d'] and x['keys'] == y['keys']; bad += 0 if same else 1
      print(k, 'same' if same else f"DIFFERENT: frames {diff[:10]} length {x['d']} -> {y['d']}" + ('' if x['keys'] == y['keys'] else ' settings changed'))
    print('all the same' if not bad else f'{bad} differ'); await b.close()
asyncio.run(main())

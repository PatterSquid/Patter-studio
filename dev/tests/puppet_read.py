"""Reads the fixture puppet (dev/tmp_puppet.puppet, gitignored: his Character Animator puppet) in the page, prints the rig
it found and draws a few poses to OUT. Run with the test server on 8765."""
import asyncio, base64, sys, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/puppet_read'; os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1400, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    r = await pg.evaluate("""async()=>{ const t0=performance.now(); const bl=await (await fetch('/tmp_puppet.puppet')).blob(); const f=new File([bl],'Massive_v2.puppet');
      const {id,rig}=await Puppet.importFile(f); const ms=performance.now()-t0; window.__rig=rig;
      return {id, ms:Math.round(ms), W:rig.W, H:rig.H, views:Object.keys(rig.views), visemes:rig.visemes, triggers:Object.keys(rig.triggers), swaps:rig.swaps.length, pivot:rig.pivot,
        roles:rig.nodes.filter(n=>n.role&&n.role!=='viseme').map(n=>n.role+':'+n.name).slice(0,60), list: (await Puppet.list()).map(p=>p.name) }; }""")
    print(r)
    poses = {'front': {}, 'Aa_blink': {'mouth': 'Aa', 'blink': 1}, 'left_Oh': {'view': 'left', 'mouth': 'Oh'}, 'up': {'view': 'up', 'mouth': 'Ee'},
             'angry': {'brow': {'L': [0.1, 0.25, 0.25], 'R': [-0.1, 0.25, -0.25]}, 'mouth': 'S', 'head': [0, 10, -0.05]}, 'surprised': {'brow': {'L': [0, -0.6, -0.05], 'R': [0, -0.6, 0.05]}, 'mouth': 'Oh', 'pupil': [0.6, 0]}}
    for n, pose in poses.items():
      import json
      s = await pg.evaluate("(pose)=>{ const rig=window.__rig, c=document.createElement('canvas'); c.width=rig.W/2; c.height=rig.H/2; const g=c.getContext('2d'); g.fillStyle='#445'; g.fillRect(0,0,c.width,c.height); g.scale(0.5,0.5); Puppet.draw(g,rig,pose); return c.toDataURL('image/png').split(',')[1]; }", pose)
      open(f'{OUT}/{n}.png', 'wb').write(base64.b64decode(s))
    # trigger swaps
    s = await pg.evaluate("()=>{ const rig=window.__rig, sw={}; for (const k of ['point','lab coat']) (rig.triggers[k]||[]).forEach(([id,i])=>sw[id]=i); const c=document.createElement('canvas'); c.width=rig.W/2; c.height=rig.H/2; const g=c.getContext('2d'); g.fillStyle='#445'; g.fillRect(0,0,c.width,c.height); g.scale(0.5,0.5); Puppet.draw(g,rig,{swaps:sw}); return c.toDataURL('image/png').split(',')[1]; }")
    open(f'{OUT}/swaps.png', 'wb').write(base64.b64decode(s))
    # reload from storage
    r2 = await pg.evaluate("async()=>{ const l=await Puppet.list(); const id=l[l.length-1].id; delete Puppet._mem[id]; const rig=await Puppet.load(id); return [rig.layers.filter(Boolean).length, rig.visemes.length]; }")
    print('reloaded:', r2, 'errors:', errs); await b.close()
asyncio.run(main())

"""Frames of every transition (and the shader effects) played at speed, for a preview clip. usage: fx_clip.py PORT OUTDIR [fx]
Each transition: half a second of the first picture, the transition at its own length, half a second of the second."""
import asyncio, sys, os, base64, json
from playwright.async_api import async_playwright
PORT = sys.argv[1]; OUT = sys.argv[2]; FX = len(sys.argv) > 3; os.makedirs(OUT, exist_ok=True)
KINDS = ['swL', 'swU', 'whip2', 'punch', 'spinB', 'smash', 'glitch2', 'stretch', 'cover', 'leak', 'burn', 'ink', 'wipeL', 'pushL', 'circle', 'spin']
EFFECTS = ['glitch', 'vhs', 'oldfilm', 'glow', 'leak', 'rgb']
SETUP = """async()=>{ if(Studio.ready) await Studio.ready(); if(typeof PatterFonts!=='undefined') await PatterFonts.ready(); const W=960,H=540;
  const mk=(M,cfg,t,look)=>{ const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'); const k=W/1920; g.setTransform(k,0,0,k,0,0); Layers.wrap(M).draw(g,t,cfg,Object.assign({format:'16:9',texture:true},look),1920,1080); return c; };
  window.__A=mk(News,News.defaults(),6.5,{scheme:'saltire'}); window.__B=mk(Charts,Charts.defaults(),6,{scheme:'saltire'}); window.__f=document.createElement('canvas'); window.__f.width=W; window.__f.height=H; return Video.TRLEN; }"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:200]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(2500)
    LEN = await pg.evaluate(SETUP); idx = {}
    for k in ([] if FX else KINDS):
      n = round((LEN.get(k) or 0.5) * 30)
      fr = await pg.evaluate("""([k,n,dur])=>{ const out=[], f=window.__f, g=f.getContext('2d'), W=960, H=540; for(let i=0;i<15+n+15;i++){ g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over'; g.filter='none'; g.clearRect(0,0,W,H);
          if(i<15) g.drawImage(window.__A,0,0); else if(i>=15+n) g.drawImage(window.__B,0,0); else Video.transition(g,window.__A,window.__B,k,(i-15+0.5)/n,W,H,{dur,hq:true}); out.push(f.toDataURL('image/jpeg',0.9).split(',')[1]); } return out; }""", [k, n, LEN.get(k) or 0.5])
      for i, d in enumerate(fr): open(f'{OUT}/{k}_{i:03d}.jpg', 'wb').write(base64.b64decode(d))
      idx[k] = len(fr)
    for k in (EFFECTS if FX else []):
      fr = await pg.evaluate("""(k)=>{ const out=[], f=window.__f, g=f.getContext('2d'), W=960, H=540; for(let i=0;i<50;i++){ const P=CutGL.params({fx:[{k,amt:65}]},i/30); const o=CutGL.process(window.__B,W,H,W,H,P); g.clearRect(0,0,W,H); g.drawImage(o||window.__B,0,0,W,H); out.push(f.toDataURL('image/jpeg',0.9).split(',')[1]); } return out; }""", k)
      for i, d in enumerate(fr): open(f'{OUT}/fx_{k}_{i:03d}.jpg', 'wb').write(base64.b64decode(d))
      idx['fx_' + k] = len(fr)
    names = await pg.evaluate("()=>[Video.TRANS, Object.fromEntries(Object.entries(CutGL.EFFECTS).map(([k,v])=>[k,v.label]))]")
    json.dump({'n': idx, 'names': names}, open(OUT + '/index.json', 'w')); print(idx); await b.close()
asyncio.run(main())

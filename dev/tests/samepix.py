# Frames from two builds compared pixel by pixel. usage: _samepix.py tabs N [portA portB]
import asyncio, sys, os
from playwright.async_api import async_playwright
MODS=sys.argv[1].split(','); N=int(sys.argv[2]); A=sys.argv[3] if len(sys.argv)>3 else '8766'; B=sys.argv[4] if len(sys.argv)>4 else '8765'
PREV = "false" if os.environ.get("PREVIEW") == "0" else "true"
JS="""async([m,N])=>{ if(Studio.ready) await Studio.ready();
  const mods={charts:Charts,timeline:Timeline,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio}; const M=Layers.wrap(mods[m]);
  const cfg=mods[m].defaults(); const c=document.createElement('canvas'); c.width=960; c.height=540; const g=c.getContext('2d',{willReadFrequently:true});
  const look={scheme:m==='story'||m==='broll'?'chalk':'saltire',format:'16:9',texture:true,preview:PREV}; const d=M.duration(cfg,look); for(let i=0;i<N;i++) M.draw(g,d*i/N,cfg,look,960,540);
  const out=[]; for(let i=0;i<N;i++){ g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,960,540); M.draw(g,d*i/N,cfg,look,960,540); const D=g.getImageData(0,0,960,540).data; let h=0; for(let j=0;j<D.length;j+=7) h=(h*31+D[j])|0; out.push(h); } return out; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); res={}
    for port in (A,B):
      pg=await b.new_page(); await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.goto(f'http://127.0.0.1:{port}/dist/test.html'); await pg.wait_for_timeout(2500)
      res[port]={m: await pg.evaluate(JS,[m,N]) for m in MODS}; await pg.close()
    for m in MODS:
      x,y=res[A][m],res[B][m]; diff=[i for i in range(N) if x[i]!=y[i]]; print(m,'same' if not diff else f'{len(diff)} of {N} frames differ: {diff[:12]}')
    await b.close()
JS = JS.replace("preview:PREV", "preview:" + PREV)
asyncio.run(main())

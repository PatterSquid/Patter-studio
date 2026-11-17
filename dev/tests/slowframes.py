# The slowest moments of a tab's example (processor canvas, 1080p, preview look)
import asyncio, sys
from playwright.async_api import async_playwright
MOD=sys.argv[1]; N=int(sys.argv[2]) if len(sys.argv)>2 else 120
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
    r=await pg.evaluate("""async([m,N])=>{ if(Studio.ready) await Studio.ready();
      const mods={charts:Charts,timeline:Timeline,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio}; const M=Layers.wrap(mods[m]);
      const cfg=mods[m].defaults(); const c=document.createElement('canvas'); c.width=1920; c.height=1080; const g=c.getContext('2d',{willReadFrequently:true});
      const look={scheme:m==='story'||m==='broll'?'chalk':'saltire',format:'16:9',texture:true,preview:true}; const d=M.duration(cfg,look);
      for(let i=0;i<N;i++){M.draw(g,d*i/N,cfg,look,1920,1080);} g.getImageData(0,0,1,1);
      const out=[]; for(let rep=0;rep<2;rep++) for(let i=0;i<N;i++){ const t=d*i/N, a=performance.now(); M.draw(g,t,cfg,look,1920,1080); g.getImageData(0,0,1,1); const ms=performance.now()-a; if(rep) out.push([+ms.toFixed(1),+t.toFixed(2)]); }
      const ms=out.map(x=>x[0]).sort((a,b)=>a-b); return {med:ms[N>>1], p90:ms[Math.floor(N*0.9)], top:out.sort((a,b)=>b[0]-a[0]).slice(0,8)}; }""",[MOD,N])
    print(MOD, r, flush=True); await b.close()
asyncio.run(main())

# Which lines of code cost the most paint in one frame: every canvas call on the frame canvas is painted on its own and timed
import asyncio, json, sys
from playwright.async_api import async_playwright
MOD=sys.argv[1]; T=float(sys.argv[2]) if len(sys.argv)>2 else 0.5
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
    r=await pg.evaluate("""async([m,T])=>{ if(Studio.ready) await Studio.ready();
      const mods={charts:Charts,timeline:Timeline,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio}; const M=Layers.wrap(mods[m]);
      const cfg=mods[m].defaults(); const c=document.createElement('canvas'); c.width=1920; c.height=1080; const g=c.getContext('2d',{willReadFrequently:true});
      const look={scheme:m==='story'||m==='broll'?'chalk':'saltire',format:'16:9',texture:true,preview:true}; const d=M.duration(cfg,look);
      for(let i=0;i<3;i++) M.draw(g,d*T,cfg,look,1920,1080); g.getImageData(0,0,1,1);
      const P=CanvasRenderingContext2D.prototype, names=['fill','stroke','fillRect','strokeRect','drawImage','fillText','strokeText','clearRect','putImageData'], orig={}, agg={};
      names.forEach(n=>{ orig[n]=P[n]; P[n]=function(...a){ if(this!==g) return orig[n].apply(this,a); orig.gid.call(g,0,0,1,1); const t=performance.now(); const r=orig[n].apply(this,a); orig.gid.call(g,0,0,1,1); const dt=performance.now()-t;
        const st=(new Error().stack.split('\\n')[2]||'').trim().replace(/.*\\//,''); const k=n+' '+st; const e=agg[k]||(agg[k]={n:0,ms:0}); e.n++; e.ms+=dt; return r; }; });
      orig.gid=P.getImageData; let tot=performance.now(); M.draw(g,d*T,cfg,look,1920,1080); tot=performance.now()-tot;
      names.forEach(n=>P[n]=orig[n]);
      const a=performance.now(); M.draw(g,d*T,cfg,look,1920,1080); g.getImageData(0,0,1,1); const plain=performance.now()-a;
      return {plain:+plain.toFixed(1), top:Object.entries(agg).sort((x,y)=>y[1].ms-x[1].ms).slice(0,12).map(([k,v])=>[+v.ms.toFixed(1),v.n,k.slice(0,90)])}; }""",[MOD,T])
    print(MOD, 'frame', r['plain'], 'ms')
    for x in r['top']: print('  ',x)
    await b.close()
asyncio.run(main())

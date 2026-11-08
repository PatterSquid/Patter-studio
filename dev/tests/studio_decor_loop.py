import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    r=await pg.evaluate("""async()=>{ if(Studio.ready) await Studio.ready(); const out={};
      const shot=(c,t)=>{ const cv=document.createElement('canvas'); cv.width=480; cv.height=270; const g=cv.getContext('2d'); g.scale(0.25,0.25); Studio.drawAt(g,t,t,c,{format:'16:9',scheme:'saltire'},1920,1080); return g.getImageData(0,0,480,270).data; };
      const diff=(A,B)=>{ let s=0; for(let i=0;i<A.length;i+=4) s+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]); return +(s/(A.length/4)/3).toFixed(3); };
      for(const th of ['halloween','bonfire','standrew','christmas','hogmanay','burns','valentine','easter','match']){ const c=Studio.defaults(); c.decor=th; c.drift='off'; const L=c.loop||30; let worst=0; for(const t of [0.7, 5.3, 12.1, 21.9]){ worst=Math.max(worst, diff(shot(c,t), shot(c,t+L))); } out[th]=worst; }
      const c=Studio.defaults(); c.decor='auto'; out.auto=StudioDecor.themeOf(c); out.dates=[[2026,9,31],[2026,10,5],[2026,10,30],[2026,11,20],[2026,11,31],[2027,0,25],[2027,1,14],[2027,2,28],[2027,5,1]].map(d=>StudioDecor.byDate(new Date(d[0],d[1],d[2])));
      out.easter2027=StudioDecor.easter(2027).toDateString(); return out; }""")
    print(r, errs); await b.close()
asyncio.run(main())

import asyncio, json, sys, collections
from playwright.async_api import async_playwright
MOD=sys.argv[1]; NF=int(sys.argv[2]) if len(sys.argv)>2 else 30; FMT=sys.argv[3] if len(sys.argv)>3 else '16:9'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
        setup="""async(a)=>{ GeoData.load(); for(let i=0;i<60&&GeoData.state.status!=='ready';i++) await new Promise(r=>setTimeout(r,250)); if(Studio.ready) await Studio.ready();
          const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio}; const m0=mods[a.m];
          window.__M=Layers.wrap(m0); window.__cfg=m0.defaults(); window.__look={scheme:a.m==='story'||a.m==='broll'?'chalk':'saltire',format:a.f,texture:true,preview:false}; const d=E.dims(a.f);
          window.__c=document.createElement('canvas'); window.__c.width=d.W; window.__c.height=d.H; window.__g=__c.getContext('2d'); window.__d=__M.duration(__cfg,__look);
          for(let i=0;i<4;i++) __M.draw(__g,__d*i/4,__cfg,__look,d.W,d.H); return __d; }"""
        d=await pg.evaluate(setup,{'m':MOD,'f':FMT})
        run="""(n)=>{ const d=E.dims(__look.format); const ts=[]; for(let i=0;i<n;i++){ const a=performance.now(); __M.draw(__g,__d*(i+0.5)/n,__cfg,__look,d.W,d.H); __g.getImageData(0,0,1,1); ts.push(performance.now()-a); } ts.sort((a,b)=>a-b); return {med:+ts[n>>1].toFixed(1), p90:+ts[Math.floor(n*0.9)].toFixed(1), max:+ts[n-1].toFixed(1)}; }"""
        t=await pg.evaluate(run,NF)
        cdp=await pg.context.new_cdp_session(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval',{'interval':200}); await cdp.send('Profiler.start')
        await pg.evaluate(run,NF); prof=(await cdp.send('Profiler.stop'))['profile']
        nodes={n['id']:n for n in prof['nodes']}; cnt=collections.Counter(prof['samples']); tot=sum(cnt.values()); self=collections.Counter()
        for nid,c in cnt.items():
            cf=nodes[nid]['callFrame']; self[(cf['functionName'] or '(anon)')+':'+str(cf['lineNumber'])]+=c
        print(MOD, FMT, 'dur',round(d,1), t)
        for k,c in self.most_common(14): print(f'  {100*c/tot:5.1f}%  {k}')
        await b.close()
asyncio.run(main())

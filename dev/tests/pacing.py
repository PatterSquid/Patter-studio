# How evenly the preview's pictures arrive while playing: the time between them, tab by tab.
# usage: pacing.py out.json [screen scale, 2 for his laptop] [processor slowdown, 2 or 3 for a slow laptop] [vsync (default: frames start only on a 60 a second screen's refreshes, as on a real screen) or free] [tabs, comma separated]
import asyncio, sys, os, json, statistics
from playwright.async_api import async_playwright
OUT=sys.argv[1]; DSF=float(sys.argv[2]) if len(sys.argv)>2 else 1; THR=float(sys.argv[3]) if len(sys.argv)>3 else 1; VSYNC=not (len(sys.argv)>4 and sys.argv[4]=='free'); TABS=sys.argv[5].split(',') if len(sys.argv)>5 else None; DEV=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC="""(ms)=>new Promise(res=>{ const pv=document.getElementById('prev'); const ts=[], tt=[]; let last=-1; const t0=performance.now(); const P=window.PatterCut&&document.body.classList.contains('cut')?PatterCut.player:window.__pl;
  const f=(now)=>{ ts.push(now); if(now-t0<ms) requestAnimationFrame(f); else res({ts}); }; requestAnimationFrame(f); })"""
async def main():
    res={}
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server','--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':1440,'height':810}, device_scale_factor=DSF); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        # count the preview's real pictures: every time the visible canvas is drawn to
        # Headless Chromium has no real screen: it starts the next frame the moment the last one is done, at any gap, which a
        # 60 a second screen cannot do. So frames are started only on the screen's refreshes here, as on his laptop.
        if VSYNC: await pg.add_init_script("""(()=>{ const P=1000/60, t0=performance.now(), slot=now=>Math.floor((now-t0+2)/P); let q=[], timer=0, id=0, lastK=-1;   // a timer may fire a touch early: within 2 ms of a refresh counts as that refresh
          const pump=()=>{ timer=0; const now=performance.now(); let k=slot(now); if(k<=lastK){ timer=setTimeout(pump, Math.max(0,(lastK+1)*P+t0-now)); return; } lastK=k; const b=k*P+t0, run=q; q=[]; window.__frameT=b; run.forEach(([i,f])=>{ try{ f(b); }catch(e){ console.error(e); } }); };
          window.requestAnimationFrame=f=>{ const i=++id; q.push([i,f]); if(!timer){ const now=performance.now(), next=(Math.max(slot(now),lastK)+1)*P+t0; timer=setTimeout(pump, Math.max(0,next-now)); } return i; }; window.cancelAnimationFrame=i=>{ q=q.filter(x=>x[0]!==i); }; })()""")
        await pg.add_init_script("""(()=>{ const d=CanvasRenderingContext2D.prototype.drawImage, c=CanvasRenderingContext2D.prototype.clearRect; window.__draws=[]; CanvasRenderingContext2D.prototype.clearRect=function(){ if(this.canvas&&this.canvas.id==='prev'&&window.__rec) window.__draws.push(window.__frameT||performance.now()); return c.apply(this,arguments); }; })()""")
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
        click=lambda sel: pg.evaluate("(s)=>document.querySelector(s).click()", sel)
        cdp=await pg.context.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate',{'rate':THR})
        print('draw on', await pg.evaluate("()=>({cpu:E.previewOnCpu(), dpr:devicePixelRatio, cw:document.getElementById('prev').width})"))
        async def measure(name, secs=5):
            await pg.evaluate("()=>{ try{ document.getElementById('smooth').checked&&document.getElementById('smooth').click(); }catch(e){} }")
            await click('#playBtn'); await pg.wait_for_timeout(1500)
            await pg.evaluate("()=>{ window.__draws=[]; window.__rec=true; }"); await pg.wait_for_timeout(secs*1000)
            d=await pg.evaluate("()=>{ window.__rec=false; return window.__draws; }"); await click('#playBtn'); await pg.wait_for_timeout(300)
            iv=[b-a for a,b in zip(d,d[1:])]
            if not iv: res[name]={'n':0}; print(name,'no frames'); return
            iv_s=sorted(iv); n=len(iv); mean=sum(iv)/n; sd=statistics.pstdev(iv)
            buckets={'<=20':sum(1 for x in iv if x<=20),'20-40':sum(1 for x in iv if 20<x<=40),'40-60':sum(1 for x in iv if 40<x<=60),'>60':sum(1 for x in iv if x>60)}
            P=1000/60; held=[max(1,round(x/P)) for x in iv]; kinds={}
            for h in held: kinds[h]=kinds.get(h,0)+1
            even=max(kinds.values())/len(held)
            r={'held':dict(sorted(kinds.items())),'even':round(even*100),'fps':round(1000/mean,1),'mean':round(mean,1),'sd':round(sd,1),'p95':round(iv_s[int(n*0.95)],1),'max':round(iv_s[-1],1),'buckets':buckets,'jitter':round(sum(abs(b-a) for a,b in zip(iv,iv[1:]))/max(1,n-1),1)}
            res[name]=r; print(name, json.dumps(r), flush=True)
        for g,m in [('gfx','charts'),('gfx','story'),('gfx','news'),('gfx','picto'),('gfx','timeline'),('anim','studio')]:
            if TABS and m not in TABS: continue
            await click('button[data-group=%s]'%g); await click('#%sRail button[data-mod=%s]'%(g,m)); await pg.wait_for_timeout(1500)
            await measure(m)
        if not TABS or 'video' in TABS:
            await pg.set_input_files('#projFile', os.path.join(os.path.dirname(DEV),'projects','too-many-refugees.patter.json')); await pg.wait_for_timeout(3500)
            await click('button[data-mod=video]'); await pg.wait_for_timeout(2500)
            await measure('video', 8)
        print('errors',errs[:5]); await b.close()
    json.dump(res, open(OUT,'w'), indent=1)
asyncio.run(main())

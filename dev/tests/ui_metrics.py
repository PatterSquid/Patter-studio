# Where the browser's time goes: boot, idle, playing, tab switches, timeline work. usage: metrics.py out.json [scenarios]
import asyncio, sys, os, json, time
from playwright.async_api import async_playwright
OUT=sys.argv[1]; ONLY=sys.argv[2].split(',') if len(sys.argv)>2 else None
DEV=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); FX=DEV+'/tmp_cut'
KEYS=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount','Nodes','JSHeapUsedSize','JSEventListeners']
async def main():
    res={}
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server','--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':1440,'height':810}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        cdp=await pg.context.new_cdp_session(pg); await cdp.send('Performance.enable')
        async def M():
            m={x['name']:x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}; return {k:m.get(k,0) for k in KEYS}
        async def span(name, fn, settle=0):
            a=await M(); t0=time.time(); await fn();
            if settle: await pg.wait_for_timeout(settle)
            z=await M(); d={k:(round((z[k]-a[k])*1000,1) if 'Duration' in k else round(z[k]-a[k],1)) for k in KEYS}; d['wall']=round((time.time()-t0)*1000); d['heapMB']=round(z['JSHeapUsedSize']/1e6,1); d['nodes']=z['Nodes']; del d['JSHeapUsedSize']; del d['Nodes']
            res[name]=d; print(name, json.dumps(d), flush=True)
        want=lambda k: (not ONLY) or k in ONLY
        async def boot():
            await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_function("()=>document.querySelector('#tabs button.on, #tabs button[aria-selected=true], #tabs .cur')||document.querySelector('#prev')", timeout=20000)
        await span('boot', boot, 3000)
        nav=await pg.evaluate("()=>{ const n=performance.getEntriesByType('navigation')[0]; return {dcl:Math.round(n.domContentLoadedEventEnd), load:Math.round(n.loadEventEnd), size:n.decodedBodySize}; }"); res['nav']=nav; print('nav',nav)
        click=lambda sel: pg.evaluate("(s)=>document.querySelector(s).click()", sel)
        async def tab(group, mod):
            if group: await click('button[data-group=%s]'%group); await click('#%sRail button[data-mod=%s]'%(group,mod))
            else: await click('button[data-mod=%s]'%mod)
        tabs=[('gfx','charts'),('gfx','story'),('gfx','news'),('gfx','picto'),('gfx','timeline'),('gfx','broll'),('anim','studio'),('anim','char'),(None,'audio'),(None,'thumb'),(None,'video')]
        if want('tabs'):
            for g,m in tabs:
                await span('switch_'+m, lambda g=g,m=m: tab(g,m), 1200)
                await span('idle_'+m, lambda: pg.wait_for_timeout(4000))
        if want('play'):
            for g,m in [('gfx','charts'),('gfx','story'),('gfx','news'),('anim','studio')]:
                await tab(g,m); await pg.wait_for_timeout(1000)
                await click('#playBtn')
                await span('play_'+m, lambda: pg.wait_for_timeout(4000))
                fr=await pg.evaluate("()=>{ const p=window.__player||null; return p?p.drawMs:null; }"); 
                await click('#playBtn'); await pg.wait_for_timeout(300)
        if want('video'):
            await tab(None,'video'); await pg.wait_for_timeout(600)
            await pg.set_input_files('.cut-lib input[type=file]', [os.path.join(FX,f) for f in ['long.mp4','vp9opus.mp4','red.png','tone.mp3']]); await pg.wait_for_timeout(6000)
            # a heavy project: 120 main clips, 4 overlay tracks of 40, 3 sound tracks of 40
            await pg.evaluate("""()=>{ const c=Video.hooks.cfg(), bin=c.bin, id=()=> 'x'+Math.random().toString(36).slice(2,9); const A=k=>{ const i=CutMedia.info(k)||{}; return {type:i.kind||i.type||'', kind:i.kind, name:i.name}; };
              const vid=bin.filter(k=>/video/.test(A(k).type)), pic=bin.filter(k=>/image|pic/.test(A(k).type)), snd=bin.filter(k=>/audio|sound/.test(A(k).type));
              window.__kinds=bin.map(k=>[k, A(k).type, A(k).kind, A(k).name]);
              c.items=[]; c.tracks=[]; const mods={story:Story, charts:Charts, news:News, picto:Picto};
              for(let i=0;i<120;i++){ const r=i%5; if(r===0&&vid.length) c.items.push({id:id(),kind:'media',asset:vid[i%vid.length],src0:0.5,src1:2.5+ (i%3)}); else if(r===1) c.items.push({id:id(),kind:'colour',fill:'#234',dur:2}); else if(r===2&&pic.length) c.items.push({id:id(),kind:'media',asset:pic[0],dur:2.5}); else { const k=['story','charts','news','picto'][i%4]; c.items.push({id:id(),kind:'clip',mod:k,cfg:mods[k].defaults(),inPt:0,outPt:3}); } if(i%4===1) c.items[c.items.length-1].tr={k:'fade',d:0.5}; }
              for(let t=0;t<4;t++){ const T={id:id(),kind:'video',name:'V'+(t+2),items:[]}; for(let i=0;i<40;i++) T.items.push(vid.length&&i%2? {id:id(),kind:'media',asset:vid[0],src0:0,src1:3,start:i*7+t,s:0.4,x:0.2}:{id:id(),kind:'colour',fill:'#a33',dur:3,start:i*7+t,s:0.3}); c.tracks.push(T); }
              for(let t=0;t<3;t++){ const T={id:id(),kind:'audio',name:'A'+(t+1),items:[]}; for(let i=0;i<40;i++) if(snd.length||vid.length) T.items.push({id:id(),kind:'audio',asset:(snd[0]||vid[0]),src0:0,src1:3,start:i*7+t*2}); c.tracks.push(T); }
              PatterCut.ui.build(); }"""); await pg.wait_for_timeout(3000)
            res['kinds']=await pg.evaluate("()=>window.__kinds"); 
            res['counts']=await pg.evaluate("()=>({clips:document.querySelectorAll('.ct-clip').length, canv:document.querySelectorAll('.cut-tl canvas').length, nodes:document.querySelectorAll('.cut-tl *').length})"); print(res['counts'])
            await pg.screenshot(path=OUT.replace('.json','_heavy.png'))
            await span('vid_idle', lambda: pg.wait_for_timeout(4000))
            await span('vid_build', lambda: pg.evaluate("()=>{ for(let i=0;i<5;i++) PatterCut.ui.build(); }"), 500)
            geo=await pg.evaluate("()=>{ const cs=[...document.querySelectorAll('.ct-clip')].map(c=>c.getBoundingClientRect()).filter(r=>r.width>20&&r.x>300&&r.x<900&&r.y>0); const r=cs[0]; const ru=document.querySelector('.ct-ruler, .cut-tl .ruler'); const rr=ru?ru.getBoundingClientRect():null; return {clip:r?[r.x,r.y,r.width,r.height]:null, ruler:rr?[rr.x,rr.y,rr.width,rr.height]:null}; }"); print(geo)
            if geo['ruler']:
                rx,ry,rw,rh=geo['ruler']
                async def scrub():
                    await pg.mouse.move(rx+200,ry+rh/2); await pg.mouse.down()
                    for i in range(60): await pg.mouse.move(rx+200+i*8,ry+rh/2); await pg.wait_for_timeout(16)
                    await pg.mouse.up()
                await span('vid_scrub', scrub, 300)
            if geo['clip']:
                x,y,w,h=geo['clip']
                async def drag():
                    await pg.mouse.move(x+w/2,y+h/2); await pg.mouse.down()
                    for i in range(60): await pg.mouse.move(x+w/2+i*5,y+h/2+(40 if i>30 else 0)); await pg.wait_for_timeout(16)
                    await pg.mouse.up()
                await span('vid_drag', drag, 300)
                await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
                async def trim():
                    await pg.mouse.move(x+w-2,y+h/2); await pg.mouse.down()
                    for i in range(40): await pg.mouse.move(x+w-2-i*1.5,y+h/2); await pg.wait_for_timeout(16)
                    await pg.mouse.up()
                await span('vid_trim', trim, 300)
                await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
            async def zoom():
                for i in range(20): await pg.keyboard.press('+' if i<10 else '-'); await pg.wait_for_timeout(30)
            await span('vid_zoomkeys', zoom, 300)
            tl=await pg.evaluate("()=>{ const r=document.querySelector('.cut-tl').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; }")
            async def wheel():
                await pg.mouse.move(tl[0]+600,tl[1]+150)
                for i in range(40): await pg.mouse.wheel(60 if i<20 else -60,0); await pg.wait_for_timeout(16)
            await span('vid_wheelscroll', wheel, 300)
            async def play():
                await pg.evaluate("()=>{ PatterCut.player.seek(1); PatterCut.player.play(); }"); await pg.wait_for_timeout(5000); await pg.evaluate("()=>PatterCut.player.pause()")
            await span('vid_play5s', play, 300)
            async def sel():
                for i in range(10):
                    await pg.evaluate("(i)=>{ const c=Video.hooks.cfg(); PatterCut.select('C:'+c.items[i*3].id); }", i); await pg.wait_for_timeout(120)
            await span('vid_select10', sel, 300)
        res['errors']=errs[:8]; print('errors',errs[:8]); await b.close()
    json.dump(res, open(OUT,'w'), indent=1)
asyncio.run(main())

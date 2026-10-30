# Studio outside events: add all 12 from the panel, open each one's card, try every state of the flats, draw every second
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1100}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'ERR_' not in m.text and 'Failed to load' not in m.text else None)
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>document.querySelector('button[data-mod=studio]').click()"); await pg.wait_for_timeout(2500)
        kinds=await pg.evaluate("()=>StudioEvents.KINDS.map(k=>k[0])")
        for i,k in enumerate(kinds):
            await pg.evaluate("(t)=>Layers.hooks.seek(t)", i*2.5); await pg.wait_for_timeout(150)
            ok=await pg.evaluate("""(k)=>{ const s=[...document.querySelectorAll('#inspector select')].find(x=>x.getAttribute('aria-label')==='Add something outside'); if(!s) return 'no select'; s.value=k; s.dispatchEvent(new Event('change',{bubbles:true})); return 'ok'; }""", k)
            await pg.wait_for_timeout(300)
            card=await pg.evaluate("()=>[...document.querySelectorAll('#inspector h3')].map(h=>h.textContent).join('|')")
            print(k, ok, card[:60])
            # back to the scene panel
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        st=await pg.evaluate("()=>{ const st=JSON.parse(localStorage.getItem('patter-studio-v1')); return st.cfg.studio.events.map(e=>[e.k,e.start,e.dur]); }")
        print('events', len(st), st[:3])
        tracks=await pg.evaluate("()=>Studio.editor.tracks(JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.studio).map(t=>t.name+':'+t.items.length)")
        print('tracks', tracks)
        for t in ['standing','rubble','leaning','scaffold','patched']:
            r=await pg.evaluate("""(t)=>{ const cfg=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.studio; cfg.tower=t; const c=document.createElement('canvas'); c.width=640; c.height=360; const g=c.getContext('2d'); g.scale(1/3,1/3); const M=Layers.wrap(Studio); let ms=0;
               for(let s=0;s<40;s+=0.5){ const a=performance.now(); M.draw(g,s,cfg,{format:'16:9'},1920,1080); ms=Math.max(ms,performance.now()-a); } const v=c.getContext('2d').getImageData(0,0,640,360).data; let sum=0; for(let i=0;i<v.length;i+=4) sum+=v[i]; return [Math.round(ms), Math.round(sum/(v.length/4))]; }""", t)
            print('tower', t, 'worst ms', r[0], 'mean', r[1])
        # each event card: change the word, the length, the kind
        ids=await pg.evaluate("()=>JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.studio.events.map(e=>e.id)")
        for x in ids:
            await pg.evaluate("(x)=>Studio.hooks.select('X:'+x)", x); await pg.wait_for_timeout(150)
            await pg.evaluate("""()=>{ const w=[...document.querySelectorAll('#inspector input')].find(i=>i.getAttribute('aria-label')==='Word'); if(w){ w.value='Ya dancer'; w.dispatchEvent(new Event('input',{bubbles:true})); } const l=[...document.querySelectorAll('#inspector input')].find(i=>i.getAttribute('aria-label')==='Length'); if(l){ l.value='3'; l.dispatchEvent(new Event('input',{bubbles:true})); } }"""); await pg.wait_for_timeout(100)
        r=await pg.evaluate("""()=>{ const cfg=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.studio; const d=Studio.soundData(cfg,null,40); let pk=0,nan=0; for(const v of d.L){ if(!isFinite(v)) nan++; pk=Math.max(pk,Math.abs(v)); } return [d.L.length, pk.toFixed(3), nan, cfg.events.filter(e=>e.k==='spell').map(e=>e.text)]; }""")
        print('sound', r)
        # the carry on button
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        btns=await pg.evaluate("()=>[...document.querySelectorAll('#inspector button')].map(b=>b.textContent).filter(t=>/next video/.test(t))")
        print('carry', btns)
        if btns:
            await pg.evaluate("()=>[...document.querySelectorAll('#inspector button')].find(b=>/next video/.test(b.textContent)).click()"); await pg.wait_for_timeout(400)
            print('after', await pg.evaluate("()=>{ const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.studio; return [c.tower, c.events.length]; }"))
        print('ERRORS', errs[:6]); await b.close()
asyncio.run(main())

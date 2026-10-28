import asyncio, random, sys, json
from playwright.async_api import async_playwright
TABS=sys.argv[1].split(',') if len(sys.argv)>1 else ['charts','timeline','map','flights','flyover','picto','news','story','broll']
N=int(sys.argv[2]) if len(sys.argv)>2 else 150
SEED=int(sys.argv[3]) if len(sys.argv)>3 else 1
PICK=r"""(seed)=>{ const els=[...document.querySelectorAll('#inspector button, #inspector select, #inspector input, #inspector textarea, .tl-bar button, .tl-pop button, #inspector .st-tile, #inspector summary')].filter(e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&!e.disabled&&e.type!=='file'&&!/Save file|Open file|History|Reset this clip|Delete project/.test(e.textContent||''); });
 if(!els.length) return null; const e=els[Math.floor(seed*els.length)]; e.scrollIntoView({block:'center'});
 const tag=e.tagName.toLowerCase(), ty=(e.type||'').toLowerCase(); let what=tag+':'+ty+':'+(e.textContent||e.getAttribute('aria-label')||e.title||e.name||'').trim().slice(0,30);
 const R=Math.random;
 if(tag==='select'){ const o=e.options; if(o.length){ e.selectedIndex=Math.floor(R()*o.length); e.dispatchEvent(new Event('change',{bubbles:true})); e.dispatchEvent(new Event('input',{bubbles:true})); what+='='+e.value; } }
 else if(tag==='input'&&(ty==='range')){ const mn=+e.min||0,mx=+e.max||100; e.value=mn+R()*(mx-mn); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); what+='='+e.value; }
 else if(tag==='input'&&ty==='checkbox'){ e.click(); }
 else if(tag==='input'&&(ty==='number')){ const vals=['0','1','-5','99999','2.5','']; e.value=vals[Math.floor(R()*vals.length)]; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); what+='='+e.value; }
 else if(tag==='input'&&ty==='color'){ e.value='#'+Math.floor(R()*0xffffff).toString(16).padStart(6,'0'); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }
 else if(tag==='input'||tag==='textarea'){ const vals=['Glasgow','','   ','12','Ach 💥 émoji "quote" <b>x</b>','A very long bit of text that goes on and on and on to see if anything overflows or breaks the layout badly','-3','1e9','Scotland','France, 30\nGermany, 40']; e.value=vals[Math.floor(R()*vals.length)]; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); e.dispatchEvent(new Event('blur')); what+='='+JSON.stringify(e.value).slice(0,20); }
 else e.click();
 return what; }"""
async def main():
    random.seed(SEED)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1100}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)+' '+(e.stack or '').split('\n')[1] if e.stack else str(e)))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'ERR_' not in m.text and 'Failed to load' not in m.text else None)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>{window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>'x';}")
        for tab in TABS:
            await pg.evaluate(f"()=>document.querySelector('button[data-mod={tab}]').click()"); await pg.wait_for_timeout(1200)
            trace=[]; e0=len(errs)
            for i in range(N):
                w=await pg.evaluate(PICK, random.random()); trace.append(w); await pg.wait_for_timeout(60)
                if i%15==14:
                    await pg.evaluate("()=>{ try{ const d=Layers.hooks&&Layers.hooks.dur?Layers.hooks.dur():10; Layers.hooks.seek(Math.random()*20);}catch(e){} }"); await pg.wait_for_timeout(150)
                if i%40==39:
                    await pg.keyboard.press('Escape'); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(100); await pg.keyboard.press('Control+y')
                if len(errs)>e0:
                    print(f'[{tab}] ERROR after {w!r}:', errs[e0:][:3]); print('   recent:', trace[-6:]); e0=len(errs)
            # does the preview still draw?
            await pg.wait_for_timeout(1200)
            chk=await pg.evaluate(f"""()=>{{ const st=JSON.parse(localStorage.getItem('patter-studio-v1')); const cfg=st.cfg['{tab}']; const bad=[];
              const walk=(o,p)=>{{ if(o===undefined){{bad.push(p+' undefined');return;}} if(typeof o==='number'&&!isFinite(o)) bad.push(p+' '+o); if(Array.isArray(o)) o.forEach((v,i)=>{{ if(v==null) bad.push(p+'['+i+'] '+v); else walk(v,p+'['+i+']'); }}); else if(o&&typeof o==='object') Object.entries(o).forEach(([k,v])=>walk(v,p+'.'+k)); }}; walk(cfg,'cfg');
              const mods={{charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll}}; const M=Layers.wrap(mods['{tab}']); const look=st.look; const c=document.createElement('canvas'); c.width=480; c.height=270; const g=c.getContext('2d'); let d; const errs=[];
              try{{ d=M.duration(cfg,look); }}catch(e){{errs.push('dur '+e.message)}} if(!(d>0&&isFinite(d))) errs.push('dur '+d);
              for(let i=0;i<=20;i++){{ try{{ g.setTransform(0.25,0,0,0.25,0,0); M.draw(g,(d||5)*i/20,cfg,look,1920,1080);}}catch(e){{errs.push(i+': '+e.message+' '+(e.stack||'').split('\\n')[1]);}} }}
              return {{bad:bad.slice(0,8), errs:errs.slice(0,5), dur:d, size:JSON.stringify(cfg).length}}; }}""")
            print(f'[{tab}] state check', chk)
            print(f'[{tab}] done {N} actions, errors so far {len(errs)}', flush=True)
        await b.close()
asyncio.run(main())

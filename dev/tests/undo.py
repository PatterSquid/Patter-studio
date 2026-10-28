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
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>{window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>'x';}")
        for tab in TABS:
            await pg.evaluate(f"()=>document.querySelector('button[data-mod={tab}]').click()"); await pg.wait_for_timeout(1500)
            get=lambda: pg.evaluate(f"()=>JSON.stringify(JSON.parse(localStorage.getItem('patter-studio-v1')).cfg['{tab}'])")
            c0=await get(); steps=[]
            for i in range(N):
                w=await pg.evaluate(PICK, random.random()); steps.append(w); await pg.wait_for_timeout(250)
            await pg.keyboard.press('Escape'); await pg.evaluate("()=>{ document.querySelectorAll('dialog[open]').forEach(d=>d.close()); document.querySelectorAll('.tl-pop').forEach(p=>p.remove()); }")
            await pg.wait_for_timeout(1500); c1=await get()
            for i in range(80):
                await pg.evaluate("()=>{ document.activeElement && document.activeElement.blur(); }")
                await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(60)
            await pg.wait_for_timeout(800); c2=await get()
            for i in range(80):
                await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(40)
            await pg.wait_for_timeout(800); c3=await get()
            print(f'[{tab}] changed={c0!=c1} undo_back_to_start={c2==c0} redo_back_to_end={c3==c1} errs={errs[:2]}', flush=True)
            if c3!=c1:
                a=json.loads(c1); bb=json.loads(c3); print('   redo differs in', [k for k in set(a)|set(bb) if a.get(k)!=bb.get(k)], 'steps', steps); print('   ', {k:(a.get(k),bb.get(k)) for k in set(a)|set(bb) if a.get(k)!=bb.get(k) and k!='layers'})
            if c2!=c0:
                import difflib; a=json.loads(c0); bb=json.loads(c2)
                diffs=[k for k in set(a)|set(bb) if a.get(k)!=bb.get(k)]; print('   differs in', diffs[:6], 'steps', steps)
        await b.close()
asyncio.run(main())

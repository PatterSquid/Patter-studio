# Random clicking, typing and dragging in the Thumbnail tab: every button, box and slider, plus clicks and drags on the
# picture and keys, checking nothing throws and the picture still draws. Args: number of actions, seed.
import asyncio, sys, random
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 300; SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 1
PICK=r"""(seed)=>{ const els=[...document.querySelectorAll('#thumbWs button, #thumbWs select, #thumbWs input, #thumbWs textarea')].filter(e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&!e.disabled&&e.type!=='file'&&!/Save file|Open file|History|Reset this clip|Delete project|Choose|Replace|Add a font|×/.test(e.textContent||''); });
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
        b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1366, 'height': 768}); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        pg.on('filechooser', lambda f: None)
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>{window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>'x'; window.showSaveFilePicker=undefined;}")
        await pg.evaluate("()=>document.querySelector('button[data-mod=thumb]').click()"); await pg.wait_for_timeout(1000)
        trace = []; e0 = 0
        for i in range(N):
            r = random.random()
            if r < 0.6: w = await pg.evaluate(PICK, random.random())
            else:
                R = await pg.evaluate("(()=>{const r=document.querySelector('.th-ov').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]})()")
                x, y = R[0] + random.random() * R[2], R[1] + random.random() * R[3]
                if r < 0.8: await pg.mouse.click(x, y); w = 'click'
                elif r < 0.93: await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x + random.uniform(-200, 200), y + random.uniform(-150, 150), steps=5); await pg.mouse.up(); w = 'drag'
                else: k = random.choice(['Delete', 'Control+d', 'ArrowLeft', 'Shift+ArrowUp', 'Escape', 'Control+z', 'Control+y', 'Control+c', 'Control+v', 'Control+]']); await pg.keyboard.press(k); w = 'key ' + k
            trace.append(w); await pg.wait_for_timeout(40)
            if len(errs) > e0: print('ERROR after', repr(w), errs[e0:][:3]); print('   recent:', trace[-6:]); e0 = len(errs)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
        st = await pg.evaluate("(()=>{ const c=document.querySelector('.th-cv'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=0;i<d.length;i+=400) if(d[i+3]) n++; const cfg=Thumb._W.cfg; return { drawn:n, layers:(cfg.layers||[]).length, fmt:cfg.fmt, size: JSON.stringify(cfg).length }; })()")
        print('state', st); print('errors', len(errs), errs[:5]); await b.close()
asyncio.run(main())

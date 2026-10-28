import asyncio, json, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1100}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>document.getElementById('packsBtn').click()"); await pg.wait_for_timeout(500)
        print('dialog before:', (await pg.locator('dialog').inner_text())[:300].replace('\n',' | '))
        await pg.set_input_files('dialog input[type=file]', '/home/claude/patter-studio/packs/bank_robbery.json'); await pg.wait_for_timeout(1000)
        print('dialog after:', (await pg.locator('dialog').inner_text())[:400].replace('\n',' | '))
        await pg.screenshot(path='st/packs_dlg.png')
        await pg.evaluate("()=>document.querySelector('dialog').close()")
        await pg.evaluate("()=>document.querySelector('button[data-mod=story]').click()"); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-bar button')].find(b=>/Set piece/.test(b.textContent)).click()"); await pg.wait_for_timeout(400)
        print('pop:', await pg.evaluate("()=>[...document.querySelectorAll('.tl-pop button')].map(b=>b.title||b.textContent)"))
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-pop button')].find(b=>/Bank/.test(b.title||b.textContent)).click()"); await pg.wait_for_timeout(1200)
        st=await pg.evaluate("()=>{const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.story; return {scenes:c.scenes.map(s=>s.place), cast:c.cast.map(x=>x.name), layers:(c.layers||[]).length}}"); print(st)
        await pg.screenshot(path='st/packs_tl.png')
        # export a few frames of the bank scene through the workers and compare with the preview
        r=await pg.evaluate("""async()=>{ const cfg=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.story; const P=Story._plan(cfg); const o=P.scenes.find(o=>o.sc.place==='bank'); const t=o.t0+2.6, M=Layers.wrap(Story), look={scheme:'chalk',format:'16:9'};
          let w=null; await Render.renderFrames(M,cfg,look,{fps:30,blur:'off',frames:1,t0:t,onFrame:async f=>{ const c=document.createElement('canvas'); c.width=480; c.height=270; c.getContext('2d').drawImage(f,0,0,480,270); w=c.toDataURL('image/jpeg',0.8); f.close(); }});
          const C=document.createElement('canvas'); C.width=1920; C.height=1080; M.draw(C.getContext('2d'),t,cfg,look,1920,1080); const c2=document.createElement('canvas'); c2.width=480; c2.height=270; c2.getContext('2d').drawImage(C,0,0,480,270);
          return {imgs:[w, c2.toDataURL('image/jpeg',0.8)]}; }""")
        for i,u in enumerate(r['imgs']): open(f'st/pw{i}.jpg','wb').write(base64.b64decode(u.split(',')[1]))
        print(errs[:5] or 'no errors'); await b.close()
asyncio.run(main())

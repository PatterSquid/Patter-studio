import asyncio, json, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1100}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)+' | '+' / '.join((e.stack or '').split('\n')[1:3])))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        V=lambda: pg.evaluate("()=>JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.video")
        await pg.evaluate("()=>document.querySelector('button[data-mod=video]').click()"); await pg.wait_for_timeout(1500)
        v=await V(); print('default items', [(i['kind'], i.get('mod'), i.get('dur')) for i in v['items']])
        print('tracks', await pg.evaluate("()=>[...document.querySelectorAll('.tl-clip')].map(c=>c.textContent).join(' | ')"))
        await pg.screenshot(path='st/v_tab.png')
        # seek into the avatar gap and look at the preview
        L=await pg.evaluate("()=>{ const st=JSON.parse(localStorage.getItem('patter-studio-v1')); return Video.layout(st.cfg.video, st.look).map(o=>[o.it.kind,+o.t0.toFixed(2),+o.d.toFixed(2)]) }"); print('layout', L)
        await pg.evaluate(f"()=>Layers.hooks.seek({L[1][1]+0.5})"); await pg.wait_for_timeout(700); await pg.locator('#prev').screenshot(path='st/v_gap.png')
        # add a map clip and an avatar gap through the timeline buttons
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-bar button')].find(b=>/Clip/.test(b.textContent)).click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-pop button')].find(b=>/World map/.test(b.title||b.textContent)).click()"); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-bar button')].find(b=>/Avatar gap/.test(b.textContent)).click()"); await pg.wait_for_timeout(800)
        v=await V(); print('after adds', [(i['kind'], i.get('mod')) for i in v['items']])
        # set the avatar line and fit
        await pg.locator('#inspector textarea').fill('Right, so here is the thing nobody in Westminster wants tae admit'); await pg.wait_for_timeout(300)
        await pg.locator('#inspector button', has_text='Fit the length').click(); await pg.wait_for_timeout(500)
        v=await V(); print('avatar', [(i.get('text'), i.get('dur')) for i in v['items'] if i['kind']=='avatar'])
        # edit the first clip (B roll) in its own tab, change something, come back
        first=v['items'][0]['id']; before=json.dumps(v['items'][0]['cfg'])[:80]
        await pg.evaluate(f"()=>Video.hooks.openItem('{first}')"); await pg.wait_for_timeout(1200)
        mod=await pg.evaluate("()=>document.querySelector('#tabs button.on').dataset.mod"); banner=await pg.locator('#editBanner').inner_text(); print('editing in', mod, '| banner:', banner.replace('\n',' '))
        await pg.evaluate("()=>{ const st=JSON.parse(localStorage.getItem('patter-studio-v1')); }")
        # change the host's colour through the stored cfg path the UI uses: pick an action via the timeline
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-bar button')].find(b=>/Action/.test(b.textContent)).click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-pop button')].find(b=>/Waves/.test(b.title||b.textContent)).click()"); await pg.wait_for_timeout(800)
        await pg.locator('#editBanner button').click(); await pg.wait_for_timeout(1200)
        v=await V(); acts=[a['k'] for a in v['items'][0]['cfg']['scenes'][0]['acts']]; print('back on', await pg.evaluate("()=>document.querySelector('#tabs button.on').dataset.mod"), 'clip acts now', acts)
        broll=await pg.evaluate("()=>JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.broll"); print('B roll tab own clip untouched:', 'wave' not in [a['k'] for a in broll['scenes'][0]['acts']])
        # reorder by dragging logic: move item 3 to the front via update
        await pg.evaluate("()=>{ const st=JSON.parse(localStorage.getItem('patter-studio-v1')); }")
        # export frames through workers across the whole video and check every frame drew
        r=await pg.evaluate("""async()=>{ const st=JSON.parse(localStorage.getItem('patter-studio-v1')); const M=Layers.wrap(Video), cfg=st.cfg.video, look=Object.assign({},st.look); const d=M.duration(cfg,look); let n=0, blank=0, imgs=[]; const a=performance.now();
          await Render.renderFrames(M,cfg,look,{fps:10,blur:'smart',frames:Math.ceil(d*10),t0:0,onFrame:async (f,i)=>{ n++; if(i%Math.ceil(d*10/8)===0){ const c=document.createElement('canvas'); c.width=320; c.height=180; c.getContext('2d').drawImage(f,0,0,320,180); imgs.push(c.toDataURL('image/jpeg',0.8)); } f.close(); }});
          return {d:+d.toFixed(2), n, ms:Math.round(performance.now()-a), imgs}; }""")
        for i,u in enumerate(r.pop('imgs')): open(f'st/vx{i}.jpg','wb').write(base64.b64decode(u.split(',')[1]))
        print('export', r)
        print(errs[:6] or 'no errors'); await b.close()
asyncio.run(main())

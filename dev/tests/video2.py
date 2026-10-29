import asyncio, json, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); ctx=await b.new_context(viewport={'width':1600,'height':1100}, accept_downloads=True); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)+' | '+' / '.join((e.stack or '').split('\n')[1:3])))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>{ delete window.showSaveFilePicker; }")
        # 1. a picture layer inside a video clip survives the picture clean up (reload) and reaches the export workers
        await pg.evaluate("()=>document.querySelector('button[data-mod=video]').click()"); await pg.wait_for_timeout(1000)
        first=await pg.evaluate("()=>JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.video.items[2].id")
        await pg.evaluate(f"()=>Video.hooks.openItem('{first}')"); await pg.wait_for_timeout(1000)
        async with pg.expect_file_chooser() as fc: await pg.evaluate("()=>[...document.querySelectorAll('.tl-bar button')].find(b=>/Image/.test(b.textContent)).click()")
        await (await fc.value).set_files('/tmp/claude-0/s/big.png'); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>document.getElementById('editBanner').querySelector('button').click()"); await pg.wait_for_timeout(1500)
        st=json.loads(await pg.evaluate("()=>localStorage.getItem('patter-studio-v1')")); lay=st['cfg']['video']['items'][2]['cfg'].get('layers',[]); aid=[L.get('asset') for L in lay if L.get('asset')]; print('picture in clip', aid, 'edit cleared', st.get('edit'))
        await pg.reload(); await pg.wait_for_timeout(3000)
        has=await pg.evaluate(f"async()=>{{ const d=await new Promise(r=>{{const q=indexedDB.open('patter-studio',1); q.onsuccess=()=>r(q.result);}}); const cur=await new Promise(r=>{{const t=d.transaction('meta','readonly').objectStore('meta').get('current'); t.onsuccess=()=>r(t.result);}}); const s=await new Promise(r=>{{const t=d.transaction('states','readonly').objectStore('states').get(cur); t.onsuccess=()=>r(t.result);}}); return Object.keys(s.state.assets||{{}}); }}")
        print('picture kept after reload', has)
        # 2. a B roll clip with real footage inside the video: the export shows the footage
        await pg.evaluate("()=>document.querySelector('button[data-mod=video]').click()"); await pg.wait_for_timeout(800)
        r=await pg.evaluate("""async()=>{ const b=await (await fetch('/tmp_dogclip.webm')).blob(); const m=await Media.importFile(new File([b],'d.webm',{type:'video/webm'}),()=>{});
          const st=JSON.parse(localStorage.getItem('patter-studio-v1')); const cfg=st.cfg.video; const q=cfg.items[0].cfg.scenes[0].screens[0]; q.media={id:m.id,name:'d',inPt:0,fit:'fill'};
          const M=Layers.wrap(Video), look=Object.assign({},st.look,{preview:false}); const res=[];
          await Render.renderFrames(M,cfg,look,{fps:10,blur:'off',frames:40,t0:1.5,onFrame:async (f,i)=>{ const c=document.createElement('canvas'); c.width=192; c.height=108; const g=c.getContext('2d'); g.drawImage(f,0,0,192,108); const d=g.getImageData(118,44,1,1).data; res.push([d[0],d[1],d[2]]); f.close(); }});
          const ph=res.filter(p=>Math.abs(p[0]-0x1b)<6&&Math.abs(p[1]-0x24)<6&&Math.abs(p[2]-0x20)<6).length; return {frames:res.length, placeholder:ph, distinct:new Set(res.map(p=>p.join(','))).size}; }""")
        print('footage in video export', r)
        # 3. save to file and open again
        before=await pg.evaluate("()=>JSON.stringify(JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.video)")
        await pg.evaluate("()=>{ delete window.showSaveFilePicker; }")
        async with pg.expect_download() as dl: await pg.evaluate("()=>document.getElementById('saveProj').click()")
        txt=open(await (await dl.value).path()).read()
        await pg.set_input_files('#projFile', files=[{'name':'v.patter.json','mimeType':'application/json','buffer':txt.encode()}]); await pg.wait_for_timeout(2500)
        after=await pg.evaluate("()=>JSON.stringify(JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.video)"); print('video survives save and open', before==after)
        # 4. editing a clip, reload part way through, then go back: edits land in the video
        st=json.loads(await pg.evaluate("()=>localStorage.getItem('patter-studio-v1')")); cid=st['cfg']['video']['items'][0]['id']
        await pg.evaluate(f"()=>Video.hooks.openItem('{cid}')"); await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-bar button')].find(b=>/Action/.test(b.textContent)).click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>[...document.querySelectorAll('.tl-pop button')].find(b=>/Shrugs/.test(b.title||b.textContent)).click()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(3000)
        print('after reload, still editing:', await pg.locator('#editBanner').is_visible())
        await pg.evaluate("()=>document.querySelector('button[data-mod=video]').click()"); await pg.wait_for_timeout(1200)
        st=json.loads(await pg.evaluate("()=>localStorage.getItem('patter-studio-v1')")); print('shrug landed in the video clip:', 'shrug' in [a['k'] for a in st['cfg']['video']['items'][0]['cfg']['scenes'][0]['acts']], '| B roll tab own clip clean:', 'shrug' not in [a['k'] for a in st['cfg']['broll']['scenes'][0]['acts']])
        print(errs[:6] or 'no errors'); await b.close()
asyncio.run(main())

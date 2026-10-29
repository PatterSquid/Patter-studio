import asyncio, json, base64
from playwright.async_api import async_playwright
JS=r"""async()=>{ const b=await (await fetch('/tmp_room.png')).blob(); const url=await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);}); await Layers.setAsset('room1',url);
 const marks=await (await fetch('/tmp_marks.json')).json(); const st=Object.assign(Studio.defaults(),{room:{asset:'room1'},marks,weather:'rain'});
 const src=[]; for(let i=0;i<150;i++){ const n='av_'+String(i).padStart(4,'0')+'.png'; const bb=await (await fetch('/tmp_avpng/'+n)).blob(); src.push(new File([bb],n,{type:'image/png'})); }
 const inf=await Media.importAvatar(src,{fps:30}); st.avatar={id:inf.id,name:inf.name,x:0.5,y:0.5,h:1,inPt:0};
 const cfg=Video.defaults(); cfg.gap='studio'; cfg.studio=st; cfg.items=[{id:'a',kind:'clip',mod:'charts',cfg:Charts.defaults(),inPt:0,hold:0},{id:'g1',kind:'avatar',text:'one',dur:2},{id:'b',kind:'clip',mod:'news',cfg:News.defaults(),inPt:0,hold:0},{id:'g2',kind:'avatar',text:'two',dur:2}];
 const look={scheme:'saltire',format:'16:9'}, L=Video.layout(cfg,look), g1=L[1], g2=L[3]; const M=Layers.wrap(Video);
 const res={g1:[g1.t0,g1.d], g2:[g2.t0,g2.d], at1:Video.mediaAt(cfg,g1.t0+0.5,look), at2:Video.mediaAt(cfg,g2.t0+0.5,look), media:Video.mediaFor(cfg), assets:Object.keys(Layers.assetsFor(cfg))};
 const c=document.createElement('canvas'); c.width=960; c.height=540; const g=c.getContext('2d'); await Media.prepare(res.at2); g.scale(0.5,0.5); M.draw(g,g2.t0+0.5,cfg,look,1920,1080); res.png=c.toDataURL('image/jpeg',0.8); return res; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        r=await pg.evaluate(JS); open('/tmp/claude-0/st2/vtest.jpg','wb').write(base64.b64decode(r.pop('png').split(',')[1])); print(json.dumps(r), errs[:3]); await b.close()
asyncio.run(main())

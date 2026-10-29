import asyncio, json, base64
from playwright.async_api import async_playwright
JS=r"""async()=>{ const b=await (await fetch('/tmp_room.png')).blob(); const url=await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);}); await Layers.setAsset('room1',url);
 const marks=await (await fetch('/tmp_marks.json')).json(); const cfg=Object.assign(Studio.defaults(),{room:{asset:'room1'},marks,weather:'storm'});
 const src=[]; for(let i=0;i<150;i++){ const n='av_'+String(i).padStart(4,'0')+'.png'; const bb=await (await fetch('/tmp_avpng/'+n)).blob(); src.push(new File([bb],n,{type:'image/png'})); }
 const inf=await Media.importAvatar(src,{fps:30}); cfg.avatar={id:inf.id,name:inf.name,x:0.5,y:0.5,h:1,inPt:0}; cfg.shows=[{id:'w1',frame:'ftop',kind:'text',text:'SCOTLAND SHOCKER',style:'paper',start:0,dur:10}];
 const M=Layers.wrap(Studio), look={scheme:'chalk',format:'16:9'}, out={}; const t=3.2;
 let wimg=null; const a=performance.now(); await Render.renderFrames(M,cfg,look,{fps:30,blur:'off',frames:1,t0:t,onFrame:async f=>{ const c=document.createElement('canvas'); c.width=480; c.height=270; c.getContext('2d').drawImage(f,0,0,480,270); wimg=c.getContext('2d').getImageData(0,0,480,270).data; out.png=c.toDataURL(); f.close(); }});
 out.workerMs=performance.now()-a;
 await Media.prepare(Studio.mediaAt(cfg,t)); const c2=document.createElement('canvas'); c2.width=1920; c2.height=1080; M.draw(c2.getContext('2d'),t,cfg,look,1920,1080); const c3=document.createElement('canvas'); c3.width=480; c3.height=270; c3.getContext('2d').drawImage(c2,0,0,480,270); const m=c3.getContext('2d').getImageData(0,0,480,270).data;
 let s=0,big=0; for(let i=0;i<m.length;i+=4){ const d=Math.abs(m[i]-wimg[i])+Math.abs(m[i+1]-wimg[i+1])+Math.abs(m[i+2]-wimg[i+2]); s+=d; if(d>60) big++; } out.meanDiff=s/(m.length/4)/3; out.bigPx=big; out.main=c3.toDataURL(); return out; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        r=await pg.evaluate(JS)
        for k in ['png','main']: open(f'/tmp/claude-0/st2/par_{k}.png','wb').write(base64.b64decode(r.pop(k).split(',')[1]))
        print(json.dumps(r), errs[:3]); await b.close()
asyncio.run(main())

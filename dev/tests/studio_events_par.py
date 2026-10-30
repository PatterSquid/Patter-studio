# Worker export matches the preview for the outside events (the plate and the cut out block have to load in the worker too)
import asyncio, json
from playwright.async_api import async_playwright
JS=r"""async(t)=>{ await Studio.ready(); const cfg=Object.assign(Studio.defaults(),{drift:'off',events:(window.__noev?[]:[{id:'a',k:'plane',start:0},{id:'b',k:'gull',start:2},{id:'c',k:'strike',start:20},{id:'d',k:'spell',start:12,text:'BAWS'},{id:'q',k:'squid',start:30},{id:'f',k:'bonfire',start:45}])});
 const M=Layers.wrap(Studio), look={scheme:'chalk',format:'16:9'}; let wimg=null;
 await Render.renderFrames(M,cfg,look,{fps:30,blur:'off',frames:1,t0:t,onFrame:async f=>{ const c=document.createElement('canvas'); c.width=480; c.height=270; c.getContext('2d').drawImage(f,0,0,480,270); wimg=c.getContext('2d').getImageData(0,0,480,270).data; }});
 const c2=document.createElement('canvas'); c2.width=1920; c2.height=1080; M.draw(c2.getContext('2d'),t,cfg,look,1920,1080); M.draw(c2.getContext('2d'),t,cfg,look,1920,1080); const c3=document.createElement('canvas'); c3.width=480; c3.height=270; c3.getContext('2d').drawImage(c2,0,0,480,270); const m=c3.getContext('2d').getImageData(0,0,480,270).data;
 let s=0,big=0; for(let i=0;i<m.length;i+=4){ const d=Math.abs(m[i]-wimg[i])+Math.abs(m[i+1]-wimg[i+1])+Math.abs(m[i+2]-wimg[i+2]); s+=d; if(d>60) big++; } return {t, meanDiff:+(s/(m.length/4)/3).toFixed(2), bigPx:big}; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        import sys
        if len(sys.argv)>1: await pg.evaluate('()=>{window.__noev=1}')
        for t in [1.0, 3.5, 8.5, 13.5, 21.5, 36.5, 49.5]: print(json.dumps(await pg.evaluate(JS, t)))
        print(errs[:3]); await b.close()
asyncio.run(main())

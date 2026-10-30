# With the flats left in a state (and no events) the studio still loops without a join; an event clip draws the same twice
import asyncio, json
from playwright.async_api import async_playwright
JS=r"""async()=>{ await Studio.ready(); const out={}; const M=Layers.wrap(Studio), look={scheme:'chalk',format:'16:9'};
 const px=(cfg,t)=>{ const c=document.createElement('canvas'); c.width=480; c.height=270; const g=c.getContext('2d'); g.scale(0.25,0.25); M.draw(g,t,cfg,look,1920,1080); return g.getImageData(0,0,480,270).data; };
 const diff=(a,b)=>{ let s=0; for(let i=0;i<a.length;i+=4) s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); return +(s/(a.length/4)/3).toFixed(3); };
 for (const st of ['standing','rubble','leaning','scaffold','patched']) { const cfg=Object.assign(Studio.defaults(),{tower:st,loop:16}); out[st]={loop:diff(px(cfg,0.4),px(cfg,16.4)), neighbour:diff(px(cfg,5),px(cfg,5+1/30))}; }
 const cfg=Object.assign(Studio.defaults(),{events:[{id:'a',k:'plane',start:0},{id:'b',k:'bonfire',start:3},{id:'c',k:'polis',start:5}]}); out.repeat=diff(px(cfg,8.3),px(cfg,8.3));
 let worst=0; for(let t=0;t<17;t+=1/15){ worst=Math.max(worst,diff(px(cfg,t),px(cfg,t+1/30))); } out.worstStep=worst; return out; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        print(json.dumps(await pg.evaluate(JS)), errs[:3]); await b.close()
asyncio.run(main())

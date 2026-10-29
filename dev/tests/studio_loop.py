import asyncio, json
from playwright.async_api import async_playwright
JS=r"""async()=>{ const b=await (await fetch('/tmp_room.png')).blob(); const url=await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);}); await Layers.setAsset('room1',url);
 const marks=await (await fetch('/tmp_marks.json')).json(); const out={};
 for (const wx of ['rain','storm','snow','downpour']) { const cfg=Object.assign(Studio.defaults(),{room:{asset:'room1'},marks,weather:wx,loop:16,drift:'more'}); const M=Layers.wrap(Studio), look={scheme:'chalk',format:'16:9'};
  const px=t=>{ const c=document.createElement('canvas'); c.width=480; c.height=270; const g=c.getContext('2d'); g.scale(0.25,0.25); M.draw(g,t,cfg,look,1920,1080); return g.getImageData(0,0,480,270).data; };
  const diff=(a,b)=>{ let s=0; for(let i=0;i<a.length;i+=4) s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); return s/(a.length/4)/3; };
  out[wx]={ same:diff(px(3.3),px(3.3)), loop:diff(px(0.4),px(16.4)), neighbour:diff(px(5),px(5+1/30)) }; }
 return out; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        print(json.dumps(await pg.evaluate(JS)), errs[:3]); await b.close()
asyncio.run(main())

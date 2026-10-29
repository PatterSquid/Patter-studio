import asyncio, base64, json, sys, os, subprocess
from playwright.async_api import async_playwright
dur=float(sys.argv[1]); out=sys.argv[2]; W=int(sys.argv[3]); H=int(sys.argv[4]); fps=30
SETUP=r"""async([W,H,OV])=>{ window.__ov=OV; await Studio.ready(); window.__cfg=Object.assign(Studio.defaults(), JSON.parse(window.__ov||'{}')); window.__M=Layers.wrap(Studio); window.__c=document.createElement('canvas'); window.__c.width=W; window.__c.height=H; return 1; }"""
CHUNK=r"""async([a,b,fps,W,H])=>{ const M=window.__M,cfg=window.__cfg,c=window.__c,g=c.getContext('2d'),out=[]; const look={scheme:'chalk',format:W>H?'16:9':'9:16'};
 for(let i=a;i<b;i++){ g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,H); M.draw(g,i/fps,cfg,look,W,H); out.push(c.toDataURL('image/jpeg',0.92)); } return out; }"""
async def main():
    d='/tmp/claude-0/st2/fr'; os.makedirs(d,exist_ok=True); [os.remove(d+'/'+f) for f in os.listdir(d)]
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1200); await pg.evaluate(SETUP,[W,H,(sys.argv[5] if len(sys.argv)>5 else '{}')]); n=int(dur*fps)
        for a in range(0,n,30):
            fs=await pg.evaluate(CHUNK,[a,min(n,a+30),fps,W,H])
            for i,u in enumerate(fs): open(f'{d}/{a+i:05d}.jpg','wb').write(base64.b64decode(u.split(',')[1]))
        await b.close()
    subprocess.run(f'ffmpeg -v error -y -framerate {fps} -i {d}/%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 {out}',shell=True)
asyncio.run(main())

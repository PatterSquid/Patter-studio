import asyncio, base64, json, sys, os, subprocess
from playwright.async_api import async_playwright
# usage: vid.py '<cfg json>' seconds out.mp4 [W H fps]
ov=json.loads(sys.argv[1]); dur=float(sys.argv[2]); out=sys.argv[3]; W=int(sys.argv[4]) if len(sys.argv)>4 else 1920; H=int(sys.argv[5]) if len(sys.argv)>5 else 1080; fps=int(sys.argv[6]) if len(sys.argv)>6 else 30
SETUP=r"""async([ov,W,H])=>{ const b=await (await fetch('/tmp_room.png')).blob(); const url=await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);}); await Layers.setAsset('room1',url);
 const marks=await (await fetch('/tmp_marks.json')).json(); const cfg=Object.assign(Studio.defaults(),{room:{asset:'room1'},marks},ov); const d=Studio.detect(Layers.assets.room1.bmp, marks.glass); cfg.marks.lit=d.lit;
 if(ov.avatarSetup){ await eval(ov.avatarSetup)(cfg); }
 window.__cfg=cfg; window.__M=Layers.wrap(Studio); window.__c=document.createElement('canvas'); window.__c.width=W; window.__c.height=H; return Studio.duration(cfg); }"""
CHUNK=r"""async([a,b,fps,W,H])=>{ const M=window.__M,cfg=window.__cfg,c=window.__c,g=c.getContext('2d'),out=[]; const look={scheme:'chalk',format:W>H?'16:9':'9:16'}; let ms=0;
 for(let i=a;i<b;i++){ const t=i/fps; if(typeof Media!=='undefined' && Studio.mediaAt) await Media.prepare(Studio.mediaAt(cfg,t,look)); const q=performance.now(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,H); M.draw(g,t,cfg,look,W,H); g.getImageData(0,0,1,1); ms+=performance.now()-q; out.push(c.toDataURL('image/jpeg',0.92)); } return [out,ms]; }"""
async def main():
    d='/tmp/claude-0/st2/fr'; os.makedirs(d,exist_ok=True); [os.remove(d+'/'+f) for f in os.listdir(d)]
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1200)
        await pg.evaluate(SETUP,[ov,W,H]); n=int(dur*fps); tot=0
        for a in range(0,n,30):
            fs,ms=await pg.evaluate(CHUNK,[a,min(n,a+30),fps,W,H]); tot+=ms
            for i,u in enumerate(fs): open(f'{d}/{a+i:05d}.jpg','wb').write(base64.b64decode(u.split(',')[1]))
        u=await pg.evaluate("async(dur)=>{ const d=Studio.soundData(window.__cfg,null,dur); const b=Studio.wav(d); return await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);}); }", dur)
        open('/tmp/claude-0/st2/snd_tmp.wav','wb').write(base64.b64decode(u.split(',')[1]))
        print('avg draw ms',round(tot/n,1), errs[:3]); await b.close()
    subprocess.run(f'ffmpeg -v error -y -framerate {fps} -i {d}/%05d.jpg -i /tmp/claude-0/st2/snd_tmp.wav -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest {out}',shell=True)
asyncio.run(main())

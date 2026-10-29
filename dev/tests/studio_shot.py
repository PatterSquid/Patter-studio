import asyncio, base64, json, sys
from playwright.async_api import async_playwright
# usage: shot.py '<cfg overrides json>' t1,t2,... prefix [W H]
ov=json.loads(sys.argv[1]);
if ov.get('av'): ov['avatarSetup']=open('/tmp/claude-0/st2/avsetup.js').read()
ts=[float(x) for x in sys.argv[2].split(',')]; pre=sys.argv[3]; W=int(sys.argv[4]) if len(sys.argv)>4 else 1920; H=int(sys.argv[5]) if len(sys.argv)>5 else 1080
JS=r"""async([ov,ts,W,H])=>{ const b=await (await fetch('/tmp_room.png')).blob(); const url=await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);}); await Layers.setAsset('room1',url);
 const marks=await (await fetch('/tmp_marks.json')).json(); const cfg=Object.assign(Studio.defaults(),{room:{asset:'room1'},marks},ov);
 if(ov.avatarSetup){ await eval(ov.avatarSetup)(cfg); for(const t of ts) await Media.prepare(Studio.mediaAt(cfg,t)); }
 if(ov.detect){ const d=Studio.detect(Layers.assets.room1.bmp, marks.glass); cfg.marks.lit=d.lit; window.__det=d; }
 const M=Layers.wrap(Studio), c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'), out=[]; const look={scheme:'chalk',format:W>H?'16:9':'9:16',preview:!!ov.preview};
 for(const t of ts){ const a=performance.now(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,H); M.draw(g,t,cfg,look,W,H); g.getImageData(0,0,1,1); const ms=performance.now()-a; out.push([c.toDataURL("image/png"), ms]); }
 return {out, det: window.__det? {lit:window.__det.lit.length, street:window.__det.street, lamps:window.__det.lamps, glass:window.__det.glass}:null}; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1200)
        r=await pg.evaluate(JS,[ov,ts,W,H])
        for i,(u,ms) in enumerate(r['out']): open(f'/tmp/claude-0/st2/{pre}_{i}.png','wb').write(base64.b64decode(u.split(',')[1])); print(f'{ts[i]}s {ms:.0f}ms')
        print('det',json.dumps(r['det'])[:600]); print(errs[:5]); await b.close()
asyncio.run(main())

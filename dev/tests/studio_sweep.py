# Every weather, every state of the flats, both shapes, with and without the avatar and in a room of his own, with all twelve
# outside events stacked up: no errors, no blank or broken frames, and how long each frame takes
import asyncio, json, sys
from playwright.async_api import async_playwright
JS=r"""async(o)=>{ await Studio.ready(); const res={ errs:[], bad:[], ms:[] };
 const K=StudioEvents.KINDS.map(k=>k[0]); const evs=K.map((k,i)=>({id:'s'+i,k,start:i*3,dur:StudioEvents.LEN[k],text:k==='spell'?'Ya dancer!':undefined}));
 let av=null; if(o.av){ const src=[]; for(let i=0;i<60;i++){ const n='av_'+String(i).padStart(4,'0')+'.png'; const b=await (await fetch('/tmp_avpng/'+n)).blob(); src.push(new File([b],n,{type:'image/png'})); } const inf=await Media.importAvatar(src,{fps:30}); av={id:inf.id,name:inf.name,x:0.5,y:0.5,h:1,inPt:0}; }
 if(o.room){ const b=await (await fetch('/tmp_room.png')).blob(); const url=await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);}); await Layers.setAsset('room1',url); }
 const M=Layers.wrap(Studio);
 for(const fmt of ['16:9','9:16']) for(const wx of ['dry','drizzle','rain','downpour','storm','snow']) for(const tw of ['standing','rubble','leaning','scaffold','patched']) {
  const W=fmt==='16:9'?960:540, H=fmt==='16:9'?540:960; const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d',{willReadFrequently:true});
  const cfg=Object.assign(Studio.defaults(),{weather:wx,tower:tw,events:evs,avatar:av,loop:20}); if(o.room){ cfg.room={asset:'room1',name:'r'}; cfg.marks=JSON.parse(JSON.stringify(STUDIO_MARKS)); delete cfg.marks.tower; delete cfg.marks.tower2; delete cfg.marks.spots; cfg.marksOwn=true; }
  const look={scheme:'chalk',format:fmt};
  for(const t of o.ts){ try{ if(av) await Media.prepare(Studio.mediaAt(cfg,t)); const a=performance.now(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,H); M.draw(g,t,cfg,look,W,H); const d=g.getImageData(0,0,W,H).data; res.ms.push(performance.now()-a);
     let s=0,n=0; for(let i=0;i<d.length;i+=16){ s+=d[i]+d[i+1]+d[i+2]; n++; } const m=s/n/3; if(!isFinite(m)||m<4||m>235) res.bad.push([fmt,wx,tw,t,Math.round(m)]); }
   catch(e){ res.errs.push([fmt,wx,tw,t,String(e&&e.stack||e).slice(0,300)]); } } }
 res.ms.sort((a,b)=>a-b); res.ms={median:+res.ms[res.ms.length>>1].toFixed(1), p95:+res.ms[Math.floor(res.ms.length*0.95)].toFixed(1), max:+res.ms[res.ms.length-1].toFixed(1), n:res.ms.length}; return res; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        ts=[0.4,2.5,4.2,7.6,10.3,13.3,16.4,19.5,22.6,25.2,28.6,31.4,33.8,37.0,41.2,46.0]
        for o in [{'ts':ts},{'ts':ts[::2],'av':True},{'ts':ts[::2],'room':True}]:
            r=await pg.evaluate(JS,o); print(json.dumps({k:v for k,v in o.items() if k!='ts'}), 'errors',len(r['errs']),r['errs'][:3],'bad',len(r['bad']),r['bad'][:6],'ms',r['ms'])
        print('page',errs[:3]); await b.close()
asyncio.run(main())

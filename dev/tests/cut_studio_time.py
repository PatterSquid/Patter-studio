import asyncio, json, base64
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(600)
    r=await pg.evaluate("""async()=>{ if(Studio.ready) await Studio.ready(); const st=Video.hooks.studio(); st.events=[{id:'e1',k:'plane',start:0.5,dur:6}];
      const c=Video.hooks.cfg(); delete c.studio; c.tracks=[]; c.items=[{id:'ch',kind:'clip',mod:'charts',cfg:Charts.defaults(),inPt:0,outPt:6,hold:0},{id:'me',kind:'avatar',text:'hi',dur:8}];
      const look={format:'16:9',scheme:'saltire',preview:false}; const L=Video.layout(c,look); const t0=L[1].t0;
      const shot=(f)=>{ const cv=document.createElement('canvas'); cv.width=480; cv.height=270; const g=cv.getContext('2d'); g.scale(0.25,0.25); f(g); return cv; };
      const diff=(a,b)=>{ const A=a.getContext('2d').getImageData(0,0,480,270).data, B=b.getContext('2d').getImageData(0,0,480,270).data; let s=0; for(let i=0;i<A.length;i+=4) s+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]); return +(s/(A.length/4)/3).toFixed(2); };
      const out={}; const urls=[];
      for(const k of [1.5,3,5]){ const v=shot(g=>Layers.wrap(Video).draw(g,t0+k,c,look,1920,1080)); const s=shot(g=>Studio.drawAt(g,k,k,st,look,1920,1080)); out['me+'+k]=diff(v,s); urls.push(v.toDataURL('image/jpeg',0.8)); }
      // studio clip stretch
      c.items.push({id:'sc',kind:'clip',mod:'studio',cfg:JSON.parse(JSON.stringify(st)),inPt:0,hold:0}); PatterCut.ui.build();
      out.studioClipLen=+Video.lenOf(c.items[2],look).toFixed(2);
      return {out, urls}; }""")
    print(r['out'])
    for i,u in enumerate(r['urls']): open(f'/tmp/claude-0/chk/st_{i}.jpg','wb').write(base64.b64decode(u.split(',')[1]))
    # drag right end of studio clip far right
    await pg.evaluate("()=>{ PatterCut.ui.setZoom ? 0:0; }")
    bb=await pg.locator('[data-id="C:sc"]').bounding_box(); await pg.mouse.move(bb['x']+bb['width']-3,bb['y']+bb['height']-8); await pg.mouse.down(); await pg.mouse.move(bb['x']+bb['width']+150,bb['y']+bb['height']-8,steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('after stretch', await pg.evaluate("()=>{ const it=Video.hooks.cfg().items[2]; return {outPt:it.outPt, hold:it.hold, len:+Video.lenOf(it,{format:'16:9'}).toFixed(2)}; }"))
    # update from tab: broll
    await pg.click('button[data-mod=broll]'); await pg.wait_for_timeout(600); await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(600)
    await pg.evaluate("""()=>{ const c=Video.hooks.cfg(); const t=Video.hooks.tabCfg('broll'); t.scenes[0].screens[0].media={id:'zzz',name:'dog'}; c.items.push({id:'br',kind:'clip',mod:'broll',cfg:Broll.defaults(),inPt:0.5,hold:0}); PatterCut.ui.build(); PatterCut.select('C:br'); }""")
    await pg.wait_for_timeout(400)
    await pg.locator('.cs-body button', has_text='tab now').click(); await pg.wait_for_timeout(300)
    print('broll media now', await pg.evaluate("()=>{ const it=Video.hooks.cfg().items.find(x=>x.id==='br'); return [JSON.stringify(it.cfg.scenes[0].screens[0].media), it.inPt]; }"))
    await pg.screenshot(path='/tmp/claude-0/chk/brpanel.png')
    print('errors', errs); await b.close()
asyncio.run(main())

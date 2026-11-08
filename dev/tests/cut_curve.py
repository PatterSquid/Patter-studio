import asyncio, json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(600)
    r=await pg.evaluate("""async()=>{ const F=async n=>{ const b=await (await fetch('/tmp_cut/'+n)).blob(); return new File([b],n,{type:b.type}); };
      const [a]=await PatterCut.ui.importFiles([await F('long.mp4')]);
      const c=Video.hooks.cfg(); c.tracks=[]; c.items=[{id:'s',kind:'clip',mod:'story',cfg:Story.defaults(),inPt:0,outPt:6,hold:0},{id:'f',kind:'media',asset:a.id,src0:0,src1:6}];
      const lk={format:'16:9'}; const out={}; out.base=[Video.lenOf(c.items[0],lk),Video.lenOf(c.items[1],lk)].map(x=>+x.toFixed(3));
      c.items[0].speed=2; out.speed2=+Video.lenOf(c.items[0],lk).toFixed(3); out.inner2=+Video.clipInner(c.items[0],1,lk).toFixed(3);
      delete c.items[0].speed; c.items[0].curve={k:'flashIn',pts:Video.CURVES.flashIn.pts.map(q=>q.slice()),a:0,b:6}; c.items[1].curve={k:'hero',pts:Video.CURVES.hero.pts.map(q=>q.slice()),a:0,b:6};
      out.curveLens=[Video.lenOf(c.items[0],lk),Video.lenOf(c.items[1],lk)].map(x=>+x.toFixed(3));
      // monotonic mapping and end points
      const L=Video.lenOf(c.items[1],lk); let mono=true, prev=-1; for(let i=0;i<=200;i++){ const s=Video.srcTime(c.items[1],L*i/200); if(s<prev-1e-9) mono=false; prev=s; } out.mono=mono; out.ends=[+Video.srcTime(c.items[1],0).toFixed(3), +Video.srcTime(c.items[1],L).toFixed(3)];
      out.rateMid=+Video.rateOf(c.items[1],L/2).toFixed(3);
      // split keeps shape: source time at a moment equals before and after split
      const t=Video.layout(c,lk)[1].t0+L*0.3, before=Video.srcTime(c.items[1],L*0.3), probe=L*0.6, sBefore=Video.srcTime(c.items[1],probe);
      Video.split(c,'f',t,lk); const L2=Video.layout(c,lk); const right=L2[2]; out.splitParts=c.items.length; out.splitAt=[+before.toFixed(3), +c.items[1].src1.toFixed(3), +c.items[2].src0.toFixed(3)];
      out.afterSplit=[+sBefore.toFixed(3), +Video.srcTime(c.items[2], probe-L*0.3).toFixed(3)];
      out.sound=CutAudio.sources(c,lk).length;
      PatterCut.ui.build(); PatterCut.select('C:s'); return out; }""")
    print(json.dumps(r))
    await pg.wait_for_timeout(500); await pg.screenshot(path='/tmp/claude-0/chk/sp1.png')
    await pg.locator('.cs-tabs button', has_text='Speed').click(); await pg.wait_for_timeout(500); await pg.screenshot(path='/tmp/claude-0/chk/sp2.png')
    print('canvases', await pg.locator('.cs-curve-ed').count(), await pg.evaluate("()=>{ const e=document.querySelector('.cs-curve-ed'); const r=e.getBoundingClientRect(); const x=r.left+r.width*(0.04+0.3*0.92), y=r.top+r.height*0.5; const t=document.elementFromPoint(x,y); return [r.width,r.height,t&&t.className, window.innerHeight]; }"))
    # drag the second dot of the curve down
    await pg.locator('.cs-curve-ed').scroll_into_view_if_needed(); await pg.wait_for_timeout(200); ed=await pg.locator('.cs-curve-ed').bounding_box(); pts=await pg.evaluate("()=>Video.hooks.cfg().items[0].curve.pts")
    import math
    X=lambda u: ed['x']+(0.04+u*0.92)*ed['width']; Y=lambda m: ed['y']+(math.log(10)-math.log(m))/(2*math.log(10))*ed['height']
    await pg.mouse.move(X(pts[1][0]),Y(pts[1][1])); await pg.mouse.down(); await pg.mouse.move(X(pts[1][0])+30,Y(0.3),steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('after drag', await pg.evaluate("()=>[JSON.stringify(Video.hooks.cfg().items[0].curve), +Video.lenOf(Video.hooks.cfg().items[0],{format:'16:9'}).toFixed(2)]"))
    await pg.mouse.dblclick(ed['x']+ed['width']*0.8, ed['y']+ed['height']*0.2); await pg.wait_for_timeout(200)
    print('points', await pg.evaluate("()=>Video.hooks.cfg().items[0].curve.pts.length"))
    await pg.screenshot(path='/tmp/claude-0/chk/sp3.png'); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200); print('undo points', await pg.evaluate("()=>(Video.hooks.cfg().items[0].curve||{pts:[]}).pts.length"))
    await pg.screenshot(path='/tmp/claude-0/chk/sp2.png')
    # export a short range for sanity
    e=await pg.evaluate("async()=>{ const res=await CutExport.run(JSON.parse(JSON.stringify(Video.hooks.cfg())),{scheme:'saltire',format:'16:9',texture:true},{fps:30,res:'720',range:[0,6]}); return [res.frames, res.bytes>1000]; }")
    print('export', e, 'errors', errs); await b.close()
asyncio.run(main())

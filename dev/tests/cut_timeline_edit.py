"""Video tab, editing on the timeline: the volume line (drag, double click for points, drag and remove points), fade
handles (sound fades on sound clips, fade from black on picture clips, and the picture really fades), keyframe diamonds
(click goes there, drag moves, right click sets how it moves, Delete removes), and undo. Test server on 8765, fixtures in
dev/tmp_cut/ (long.mp4, tone.mp3)."""
import asyncio, os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); FX=os.path.join(os.path.dirname(HERE),'tmp_cut')
res=[]
def ok(name, cond, info=''): res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name, info if not cond else '')
async def bbox(loc):
  for i in range(20):
    try:
      b_=await loc.bounding_box()
      if b_: return b_
    except Exception: pass
    await asyncio.sleep(0.1)
  return None
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(800)
    await pg.set_input_files('.cut-lib input[type=file]', [os.path.join(FX,f) for f in ['long.mp4','tone.mp3']])
    for i in range(60):
      if await pg.evaluate("()=>document.querySelectorAll('.cl-card').length")>=2: break
      await pg.wait_for_timeout(300)
    await pg.wait_for_timeout(2000)
    await pg.evaluate("""()=>{ const c=Video.hooks.cfg(); const L=CutMedia.list(); const v=L.find(m=>m.name==='long.mp4'), a=L.find(m=>m.name==='tone.mp3');
      c.items=[{id:'v1',kind:'media',asset:v.id,src0:0,src1:5}]; c.tracks=[{id:'au',kind:'audio',name:'Music',items:[{id:'a1',kind:'audio',asset:a.id,start:0,src0:0,src1:4}]}]; PatterCut.ui.build(); }""")
    await pg.wait_for_timeout(600)
    C=lambda e: pg.evaluate("()=>{const c=Video.hooks.cfg(); const v=c.items[0], a=c.tracks[0].items[0]; return "+e+"}")
    ok('volume line on the sound clip and the footage', await pg.evaluate("()=>[...document.querySelectorAll('.ct-clip')].filter(e=>e.querySelector('.ct-env')).length")==2)
    aclip=pg.locator('.ct-clip[data-id="C:a1"]'); box=await aclip.bounding_box()
    ytop=box['y']+box['height']*0.32
    # drag the line down
    await pg.mouse.move(box['x']+box['width']*0.5, ytop); await pg.mouse.down(); await pg.mouse.move(box['x']+box['width']*0.5, ytop+15, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
    v1=await C("a.vol"); ok('drag the line down lowers the volume', v1 is not None and v1 < -1, v1)
    # double click adds a point (two: one at the start keeps the rest where it was)
    box=await aclip.bounding_box(); yl=await pg.evaluate("()=>{const e=document.querySelector('.ct-clip[data-id=\"C:a1\"] .ct-env .ln'); return null}")
    a_vol=v1; 
    yy=await pg.evaluate("v=>{const db=v; return db>=0?0.32*(1-Math.min(12,db)/12):0.32+0.68*Math.pow(Math.min(60,-db)/60,0.55)}", a_vol)
    await pg.mouse.dblclick(box['x']+box['width']*0.6, box['y']+box['height']*yy); await pg.wait_for_timeout(300)
    n=await C("(a.kf&&a.kf.vol||[]).length"); ok('double click on the line adds a volume point', n==2, n)
    # drag the new point down
    vk=pg.locator('.ct-clip[data-id="C:a1"] .vk').nth(1); kb=await vk.bounding_box()
    await pg.mouse.move(kb['x']+4, kb['y']+4); await pg.mouse.down(); await pg.mouse.move(kb['x']+4, kb['y']+20, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
    k=await C("a.kf.vol[1][1]"); ok('drag a point down', k < v1-1, [k, v1])
    gain=await pg.evaluate("()=>{const c=Video.hooks.cfg(); const s=CutAudio.sources(c,{format:'16:9'}).find(x=>x.it.id==='a1'); return null}")
    # double click the point removes it
    print('  points', await C("JSON.stringify(a.kf)"), await pg.evaluate("()=>document.querySelectorAll('.ct-clip[data-id=\"C:a1\"] .vk').length"))
    kb=await bbox(pg.locator('.ct-clip[data-id="C:a1"] .vk').nth(1)); await pg.mouse.dblclick(kb['x']+4, kb['y']+4); await pg.wait_for_timeout(300)
    ok('double click a point removes it', await C("(a.kf&&a.kf.vol||[]).length")==1)
    # fade handle on the sound clip
    await pg.locator('.ct-clip[data-id="C:a1"]').hover(); fh=pg.locator('.ct-clip[data-id="C:a1"] .fh.l'); fb=await fh.bounding_box(); pps=await pg.evaluate("()=>PatterCut.ui.pps")
    await pg.mouse.move(fb['x']+4, fb['y']+4); await pg.mouse.down(); await pg.mouse.move(fb['x']+4+pps*0.8, fb['y']+4, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
    fi=await C("a.fadeIn"); ok('drag the corner fades the sound in', fi and abs(fi-0.8)<0.15, fi)
    # fade from black on the footage
    await pg.locator('.ct-clip[data-id="C:v1"]').hover(); fb=await bbox(pg.locator('.ct-clip[data-id="C:v1"] .fh.l'))
    await pg.mouse.move(fb['x']+4, fb['y']+4); await pg.mouse.down(); await pg.mouse.move(fb['x']+4+pps*1.0, fb['y']+4, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
    vf=await C("v.vfIn"); ok('drag the corner of the footage fades in from black', vf and abs(vf-1.0)<0.15, vf)
    lum=await pg.evaluate("""async()=>{const c=Video.hooks.cfg(); const out=[]; for (const t of [0.02, 0.5, 2]) { const fr=new Map(), Rs=[]; for (const f of Video.framesAt(c,{format:'16:9'},t)) { const R=await CutMedia.videoReader(f.asset); Rs.push(R); fr.set(f.id,{img:await R.frame(f.src),rot:R.rot||0}); }
       const cv=new OffscreenCanvas(320,180), g=cv.getContext('2d'); g.scale(320/1920,320/1920); Video.draw(g,t,c,{format:'16:9',preview:false,paused:true,cutEnv:{frames:fr,images:new Map(),k:1/6,fps:30}},1920,1080); const d=g.getImageData(0,0,320,180).data; let s=0; for(let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2]; out.push(Math.round(s/(d.length/4*3))); Rs.forEach(R=>R.close()); } return out; }""")
    ok('the picture really fades in', lum[0] < 8 and lum[1] < lum[2] and lum[2] > 20, lum)
    g=await pg.evaluate("()=>{const c=Video.hooks.cfg(); const s=CutAudio.sources(c,{format:'16:9'}).find(x=>x.it.id==='v1'); return s?[CutAudio.gainAt?1:1]:null}")
    # keyframes: two on the footage
    await pg.evaluate("()=>{const c=Video.hooks.cfg(); const v=c.items[0]; v.kf={x:[[0.5,0.3,'io'],[3,0.7,'io']], s:[[3,1.4,'io']]}; PatterCut.ui.build();}"); await pg.wait_for_timeout(300)
    nd=await pg.evaluate("()=>document.querySelectorAll('.ct-clip[data-id=\"C:v1\"] .kf.live').length"); ok('one diamond per keyframe moment', nd==2, nd)
    d2=pg.locator('.ct-clip[data-id="C:v1"] .kf.live').nth(1); db_=await d2.bounding_box(); await pg.mouse.click(db_['x']+5, db_['y']+5); await pg.wait_for_timeout(300)
    t=await pg.evaluate("()=>PatterCut.player.t"); ok('click a diamond goes there', abs(t-3)<0.05, t)
    db_=await bbox(pg.locator('.ct-clip[data-id="C:v1"] .kf.live').nth(1))
    await pg.mouse.move(db_['x']+5, db_['y']+5); await pg.mouse.down(); await pg.mouse.move(db_['x']+5+pps*0.5, db_['y']+5, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
    tt=await C("[v.kf.x[1][0], v.kf.s[0][0]]"); ok('drag a diamond moves every setting keyed there', abs(tt[0]-3.5)<0.1 and abs(tt[1]-3.5)<0.1, tt)
    db_=await bbox(pg.locator('.ct-clip[data-id="C:v1"] .kf.live').nth(1)); await pg.mouse.click(db_['x']+5, db_['y']+5, button='right'); await pg.wait_for_timeout(200)
    await pg.locator('.ct-menu button', has_text='Steady').click(); await pg.wait_for_timeout(200)
    ok('right click sets how it moves', await C("v.kf.x[1][2]==='lin' && v.kf.s[0][2]==='lin'"))
    db_=await bbox(pg.locator('.ct-clip[data-id="C:v1"] .kf.live').nth(1)); await pg.mouse.click(db_['x']+5, db_['y']+5); await pg.wait_for_timeout(200); await pg.keyboard.press('Delete'); await pg.wait_for_timeout(300)
    ok('Delete removes the keyframe, not the clip', await C("c.items.length===1 && v.kf && v.kf.x.length===1 && !v.kf.s"), await C("JSON.stringify(v.kf)"))
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
    ok('undo puts it back', await C("v.kf && v.kf.x.length===2 && v.kf.s && v.kf.s.length===1"), await C("JSON.stringify(v.kf)"))
    # trimming: two cards butted together on the main track; a small drag on the first one's end must extend it (the next
    # clip's start sits right on that end and used to snap it back)
    await pg.evaluate("()=>{ const c=Video.hooks.cfg(); c.items=[{id:'k1',kind:'colour',fill:'#335',dur:3},{id:'k2',kind:'colour',fill:'#533',dur:3}]; c.tracks=[]; c.free=false; PatterCut.player.seek(0); PatterCut.ui.build(); }"); await pg.wait_for_timeout(300)
    pps=await pg.evaluate("()=>PatterCut.ui.pps"); k1=await bbox(pg.locator('.ct-clip[data-id="C:k1"]'))
    await pg.mouse.move(k1['x']+k1['width']-6, k1['y']+k1['height']*0.75); await pg.mouse.down(); await pg.mouse.move(k1['x']+k1['width']-6+7, k1['y']+k1['height']*0.75, steps=4); await pg.mouse.up(); await pg.wait_for_timeout(300)
    d1=await pg.evaluate("()=>Video.hooks.cfg().items[0].dur"); ok('a small drag on the end extends (no snapping back)', d1 and abs(d1 - (3 + 7/pps)) < 0.02, [d1, pps])
    k1=await bbox(pg.locator('.ct-clip[data-id="C:k1"]'))
    await pg.mouse.move(k1['x']+k1['width']-9, k1['y']+k1['height']*0.75); await pg.mouse.down(); await pg.mouse.move(k1['x']+k1['width']-9+pps*1.5, k1['y']+k1['height']*0.75, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
    d2=await pg.evaluate("()=>Video.hooks.cfg().items[0].dur"); ok('grabbing near the end (not on the thin handle) extends', d2 > d1 + 1.2, [d1, d2])
    k1=await bbox(pg.locator('.ct-clip[data-id="C:k1"]'))
    await pg.mouse.move(k1['x']+k1['width']-8, k1['y']+k1['height']*0.75); await pg.mouse.down(); await pg.mouse.move(k1['x']+k1['width']-8-pps*2, k1['y']+k1['height']*0.75, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
    d3=await pg.evaluate("()=>Video.hooks.cfg().items[0].dur"); ok('dragging back shortens by as much as dragged', abs(d3-(d2-2))<0.2, [d2, d3])
    # the playhead line can be grabbed anywhere, even over a clip, and the clip stays put
    await pg.evaluate("()=>PatterCut.player.seek(1)"); await pg.wait_for_timeout(200)
    k2=await bbox(pg.locator('.ct-clip[data-id="C:k2"]')); ph=await bbox(pg.locator('.ct-play'))
    await pg.mouse.move(ph['x']+1, k2['y']+k2['height']/2); await pg.mouse.down(); await pg.mouse.move(ph['x']+1+pps*1.5, k2['y']+k2['height']/2, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
    t=await pg.evaluate("()=>PatterCut.player.t"); ok('drag the playhead line over a clip moves the playhead', abs(t-2.5)<0.2, t)
    ok('and leaves the clips where they were', await pg.evaluate("()=>{const c=Video.hooks.cfg(); return c.items[0].id==='k1' && c.items.length===2}"))
    # everything in the library can be dragged: a sound effect onto the timeline, a text style onto the picture
    await pg.click('.cl-tabs button:has-text("Audio")'); await pg.wait_for_timeout(300)
    nA=await pg.evaluate("()=>(Video.hooks.cfg().tracks||[]).filter(T=>T.kind==='audio').reduce((n,T)=>n+T.items.length,0)")
    sfx=pg.locator('.cl-grid .cl-tile[draggable=true]').first; lane=pg.locator('.ct-row.k-main .ct-lane')
    await sfx.drag_to(lane, target_position={'x':60,'y':20}); await pg.wait_for_timeout(2500)
    nB=await pg.evaluate("()=>(Video.hooks.cfg().tracks||[]).filter(T=>T.kind==='audio').reduce((n,T)=>n+T.items.length,0)")
    ok('drag a sound effect onto the timeline', nB==nA+1, [nA,nB])
    await pg.click('.cl-tabs button:has-text("Text")'); await pg.wait_for_timeout(300)
    nl=await pg.evaluate("()=>JSON.stringify(Video.hooks.cfg()).length")
    tile=pg.locator('.cl-body .cl-tile[draggable=true], .cut-lib .cl-tile[draggable=true]').first
    await tile.drag_to(pg.locator('#prevWrap')); await pg.wait_for_timeout(800)
    nl2=await pg.evaluate("()=>JSON.stringify(Video.hooks.cfg()).length"); ok('drag a text style onto the picture adds it', nl2>nl+20, [nl,nl2])
    # fade to black from the library, dropped on the end of a clip, and its settings in the panel
    await pg.click('.cl-tabs button:has-text("Transitions")'); await pg.wait_for_timeout(300)
    k2=await bbox(pg.locator('.ct-clip[data-id="C:k2"]'))
    await pg.locator('.cl-tile', has_text='Fade to black').drag_to(pg.locator('.ct-clip[data-id="C:k2"]'), target_position={'x':k2['width']-30,'y':k2['height']/2}); await pg.wait_for_timeout(400)
    ok('drop Fade to black on the end of a clip', await pg.evaluate("()=>{const it=Video.hooks.cfg().items[1]; return it.vfOut>0 && !it.vfIn}"), await pg.evaluate("()=>JSON.stringify(Video.hooks.cfg().items[1])"))
    tb=pg.locator('.cs-tabs button', has_text='Video')
    if await tb.count(): await tb.first.click(); await pg.wait_for_timeout(300)
    ok('the clip panel has the fade settings', await pg.locator('text=Fade out to black').count() > 0)
    await pg.screenshot(path=os.environ.get('SHOT','/tmp/tl_edit.png'))
    ok('no page errors', not errs, errs[:3])
    print('SUMMARY', sum(res), '/', len(res)); await b.close()
asyncio.run(main())

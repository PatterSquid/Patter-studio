"""His character in the Studio: load the puppet and voice in the Character tab, then in the Studio press "Use my character";
check the avatar is the character, draw frames (calm, a lightning flash, the lights off) and export the studio with him
in it. Needs dev/tmp_puppet.puppet and dev/tmp_voice2.wav. Writes to OUT (the export is picture only: add the voice with ffmpeg)."""
import asyncio, base64, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/char_studio'; os.makedirs(OUT, exist_ok=True)
SCRIPT = "[calm] Hello there. Right, listen. You will not believe this. [angry] They have only gone and shut the chippy! On a Friday! [calm] Why would anybody do that? Honestly, it is a disgrace. [happy] But the new one round the corner is brilliant. So that is the thing."
ST = "JSON.parse(localStorage.getItem('patter-studio-v1')).cfg"
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']); pg = await b.new_page(viewport={'width': 1600, 'height': 960}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-group=anim]'); await pg.click('#animRail button[data-mod=char]'); await pg.wait_for_timeout(800)
    await pg.locator('#inspector input[type=file][accept*=puppet]').set_input_files(os.path.abspath('tmp_puppet.puppet'))
    for i in range(60):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate(f"()=>!!Puppet.get(({ST}).char.puppet||'')"): break
    await pg.locator('#inspector input[type=file][accept*=audio]').set_input_files(os.path.abspath('tmp_voice2.wav')); await pg.wait_for_timeout(2500)
    await pg.locator('#inspector textarea[aria-label=Script]').fill(SCRIPT); await pg.wait_for_timeout(3000)
    await pg.click('#animRail button[data-mod=studio]'); await pg.wait_for_timeout(2500)
    await pg.locator('#inspector button', has_text='Use my character').first.click(); await pg.wait_for_timeout(2500)
    a = await pg.evaluate(f"()=>({ST}).studio.avatar")
    print('studio avatar:', a, 'duration', await pg.evaluate(f"()=>Studio.duration(({ST}).studio)"))
    await pg.screenshot(path=OUT + '/panel.png')
    # a lightning strike and the lights going off, then frames drawn by the studio itself
    r = await pg.evaluate(f"""async()=>{{ const all={ST}, c=all.studio; c.stings=[{{id:'s1',k:'thunder',start:3.2,dur:2.5,pow:1}},{{id:'s2',k:'lightsoff',start:9,dur:3,pow:1}}];
      await Studio.ready(); window.__sc=c; const out={{}};
      const fl=[]; for (let t=3.0;t<6;t+=0.01) fl.push([+t.toFixed(2), Studio.flashAt(c,t).e]); fl.sort((a,b)=>b[1]-a[1]); const peak=fl[0][0], mid=fl.find(q=>q[1]<fl[0][1]*0.5&&Math.abs(q[0]-peak)<0.3)||fl[3]; window.__peak=[peak, fl[0][1]];
      for (const t of [1.6, peak, mid[0], 10.0, 12.4]) {{ const cv=document.createElement('canvas'); cv.width=960; cv.height=540; const g=cv.getContext('2d'); g.scale(0.5,0.5); Studio.draw(g,t,c,{{format:'16:9'}},1920,1080); out[t]=cv.toDataURL('image/jpeg',0.86).split(',')[1]; }}
      return out; }}""")
    print('flash peak', await pg.evaluate('()=>window.__peak'))
    for t, s in r.items(): open(f'{OUT}/s_{float(t):05.2f}.jpg', 'wb').write(base64.b64decode(s))
    # the Video tab: [ME] parts show him in the studio, his voice under each, carrying on through the one take
    r = await pg.evaluate("""async()=>{ const all=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg; const st=all.studio;
      const v={v:2,items:[{id:'a1',kind:'avatar',dur:4},{id:'c1',kind:'colour',fill:'#203050',dur:2},{id:'a2',kind:'avatar',dur:5}],tracks:[],studio:st};
      const src=CutAudio.sources(v,{format:'16:9'}).map(s=>[s.it.id, s.asset===all.char.voice, +s.t0.toFixed(2), +s.d.toFixed(2), +(s.it.src0||0).toFixed(2), s.talk]);
      await Studio.prepare(st); const res=await CutExport.run(v,{scheme:'saltire',format:'16:9'},{fps:25,res:'720',quality:'high'}); window.__vv=res.blob; return {src, frames:res.frames}; }""")
    print('video tab:', r)
    s = await pg.evaluate("async()=>{ const u=new Uint8Array(await window.__vv.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }")
    open(OUT + '/video_tab.mp4', 'wb').write(base64.b64decode(s))
    if '--export' in sys.argv:
      n = await pg.evaluate("""async()=>{ const c=window.__sc; const v={v:2,items:[{id:'x',kind:'clip',mod:'studio',cfg:c,inPt:0,hold:0}],tracks:[]}; const res=await CutExport.run(v,{scheme:'saltire',format:'16:9'},{fps:30,res:'1080',quality:'high'}); window.__v=res.blob; return res.frames; }""")
      s = await pg.evaluate("async()=>{ const u=new Uint8Array(await window.__v.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }")
      open(OUT + '/studio.mp4', 'wb').write(base64.b64decode(s)); print('exported', n)
    ms = await pg.evaluate("""()=>{ const c=window.__sc, cv=document.createElement('canvas'); cv.width=1920; cv.height=1080; const g=cv.getContext('2d'), d=Studio.duration(c), ts=[]; for (let i=0;i<30;i++){ const a=performance.now(); Studio.draw(g, d*(i+0.5)/30, c, {format:'16:9',scheme:'saltire'}, 1920, 1080); g.getImageData(0,0,1,1); ts.push(performance.now()-a); } ts.sort((a,b)=>a-b); return {med:+ts[15].toFixed(1), max:+ts[29].toFixed(1)}; }""")
    print('studio with the character, 1080p frame ms:', ms)
    print('errors:', errs); await b.close()
asyncio.run(main())

import asyncio, base64
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(600)
    await pg.locator('.cut-lib button', has_text='Patter').first.click(); await pg.wait_for_timeout(600)
    await pg.locator('.cl-introbtn').click(); await pg.wait_for_timeout(2500)
    info=await pg.evaluate("()=>{ const c=Video.hooks.cfg(); return {first:c.items[0].kind, n:c.items.length, sound:!!CutMedia.info(PatterIntro.SOUND_ID), inLib: CutMedia.list().some(m=>m.id===PatterIntro.SOUND_ID), srcs: CutAudio.sources(c,{format:'16:9'}).map(s=>s.it.kind)}; }")
    print(info)
    await pg.screenshot(path='/tmp/claude-0/chk/intro_editor.png')
    r=await pg.evaluate("""async()=>{ const c=JSON.parse(JSON.stringify(Video.hooks.cfg())); c.items=c.items.slice(0,1); c.tracks=[]; c.layers&&(c.layers=[]);
      const res=await CutExport.run(c,{scheme:'saltire',format:'16:9',texture:true},{fps:30,res:'1080',quality:'high'}); window.__b=res.blob;
      const v=JSON.parse(JSON.stringify(c)); const r2=await CutExport.run(v,{scheme:'saltire',format:'9:16',texture:true},{fps:30,res:'1080',quality:'normal'}); window.__v=r2.blob; return [res.frames, r2.frames]; }""")
    print('frames', r)
    for nm,var in [('intro_raw.mp4','__b'),('intro_v.mp4','__v')]:
      s=await pg.evaluate(f"async()=>{{ const u=new Uint8Array(await window.{var}.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }}")
      open('/tmp/claude-0/chk/'+nm,'wb').write(base64.b64decode(s))
    print(errs); await b.close()
asyncio.run(main())

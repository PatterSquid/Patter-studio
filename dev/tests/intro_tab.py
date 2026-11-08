import asyncio, base64, json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-mod=intro]'); await pg.wait_for_timeout(1500)
    await pg.screenshot(path='/tmp/claude-0/chk/intro_tab.png')
    # switch style by clicking, edit the words through the boxes
    await pg.locator('.in-style:visible', has_text='Neon').click(); await pg.wait_for_timeout(500)
    await pg.locator('input[aria-label="Episode title"]:visible').fill('The Great Buckfast Shortage'); await pg.locator('input[aria-label="Label"]:visible').fill('EPISODE 12'); await pg.wait_for_timeout(300)
    st=await pg.evaluate("()=>{ const c=Video.hooks.tabCfg('intro'); return [c.style, c.episode, c.kicker, Intro.duration(c)]; }"); print('tab cfg', st)
    await pg.screenshot(path='/tmp/claude-0/chk/intro_tab2.png')
    # export each style with sound through the editor's exporter (as the Export button does)
    out={}
    for style in ['ink','battered','neon','epic']:
      r=await pg.evaluate(f"""async()=>{{ const c=JSON.parse(JSON.stringify(Video.hooks.tabCfg('intro'))); c.style='{style}'; if('{style}'!=='neon') {{ c.episode=''; c.kicker=''; }} await Intro.ready(); await Intro.ensureSound(c);
        const v={{v:2,items:[{{id:'x',kind:'clip',mod:'intro',cfg:c,inPt:0,hold:0}}],tracks:[]}}; const res=await CutExport.run(v,{{scheme:'saltire',format:'16:9',texture:true}},{{fps:30,res:'1080',quality:'high'}}); window['__'+'{style}']=res.blob; return [res.frames, CutAudio.sources(v,{{format:'16:9'}}).length]; }}""")
      out[style]=r
      s=await pg.evaluate(f"async()=>{{ const u=new Uint8Array(await window.__{style}.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }}")
      open(f'/tmp/claude-0/chk/intro_{style}.mp4','wb').write(base64.b64decode(s))
    print('exports', out)
    # the Video tab: the tile puts it at the start with its sound
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(800)
    await pg.locator('.cut-lib button', has_text='Patter').first.click(); await pg.wait_for_timeout(600)
    await pg.locator('.cl-introbtn').click(); await pg.wait_for_timeout(2500)
    v=await pg.evaluate("()=>{ const c=Video.hooks.cfg(); const it=c.items[0]; return [it.kind, it.mod, it.cfg.style, !!CutMedia.info(Intro.soundId(it.cfg)), CutAudio.sources(c,{format:'16:9'}).filter(s=>s.it===it).length, CutMedia.list().some(m=>m.builtin)]; }")
    print('video tab', v)
    await pg.screenshot(path='/tmp/claude-0/chk/intro_video.png')
    print('errors', errs); await b.close()
asyncio.run(main())

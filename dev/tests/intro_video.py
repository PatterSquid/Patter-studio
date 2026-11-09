"""The intro in the Video tab: no Intro tab, "+ Add intro" puts it at the start with its sound, its panel on the right
changes the pub name and the episode (the sound is made again to match), double click opens the panel, undo works, and
the whole video exports with the intro's picture and sound. Run with the test server on 8765. Writes to OUT."""
import asyncio, base64, os, sys
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/intro_video'
os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']); pg = await b.new_page(viewport={'width': 1600, 'height': 960}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    print('intro tab button visible:', await pg.locator('button[data-mod=intro]').is_visible())
    await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(800)
    await pg.locator('.cut-lib button', has_text='Patter').first.click(); await pg.wait_for_timeout(600)
    await pg.locator('.cl-introbtn').click(); await pg.wait_for_timeout(3000)
    v = await pg.evaluate("()=>{ const c=Video.hooks.cfg(); const it=c.items[0]; return [it.kind, it.mod, it.cfg.style, it.cfg.pub, !!CutMedia.info(Intro.soundId(it.cfg))]; }")
    print('added:', v)
    await pg.screenshot(path=OUT + '/added.png')
    # the panel on the right: pub name and episode
    pub = pg.locator('input[aria-label="Pub name"]:visible'); epi = pg.locator('input[aria-label="Episode title"]:visible')
    print('panel fields:', await pub.count(), await epi.count())
    await pub.fill('The Clachan'); await epi.fill('The Great Buckfast Shortage'); await pg.wait_for_timeout(3000)
    v = await pg.evaluate("()=>{ const it=Video.hooks.cfg().items[0]; return [it.cfg.pub, it.cfg.episode, !!CutMedia.info(Intro.soundId(it.cfg)), Video.natural(it, {format:'16:9'})]; }")
    print('edited:', v)
    await pg.screenshot(path=OUT + '/edited.png')
    # undo puts the words back, redo brings them again
    await pg.locator('.cut-tl').click(position={'x': 600, 'y': 5}); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
    u = await pg.evaluate("()=>{ const it=Video.hooks.cfg().items[0]; return [it.cfg.pub, it.cfg.episode]; }"); await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(500)
    r = await pg.evaluate("()=>{ const it=Video.hooks.cfg().items[0]; return [it.cfg.pub, it.cfg.episode]; }"); print('undo:', u, 'redo:', r)
    # double click on the clip opens its panel
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    clip = pg.locator('.cut-tl [data-id]').first
    if await clip.count(): await clip.dblclick(); await pg.wait_for_timeout(600)
    print('panel after double click:', await pg.locator('input[aria-label="Pub name"]:visible').count())
    # export the video with the intro in it, picture and sound
    r = await pg.evaluate("""async()=>{ const c=Video.hooks.cfg(); await Intro.ready(); for (const it of c.items) if (it.mod==='intro') await Intro.ensureSound(it.cfg);
      const res=await CutExport.run(c,{scheme:'saltire',format:'16:9',texture:true},{fps:30,res:'720',quality:'high'}); window.__v=res.blob; return [res.frames, CutAudio.sources(c,{format:'16:9'}).length]; }""")
    print('export frames, sound sources:', r)
    s = await pg.evaluate("async()=>{ const u=new Uint8Array(await window.__v.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }")
    open(OUT + '/intro_in_video.mp4', 'wb').write(base64.b64decode(s))
    print('errors:', errs); await b.close()
asyncio.run(main())

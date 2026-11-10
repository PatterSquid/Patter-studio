# The background remover with the app opened from a file, as his launcher does (file:// origin, blob: links off limits to
# helpers). Needs the cross origin server on 8766 serving dev/ (any static server that sends Access-Control-Allow-Origin).
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server','--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']); pg=await b.new_page(); logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text[:300])); pg.on('pageerror', lambda e: logs.append('ERR '+str(e)[:300]))
    await pg.add_init_script("window.PATTER_CUTOUT='http://127.0.0.1:8766/tmp_cutout/f_astronaut/'")
    await pg.goto('file:///home/claude/patter-studio/dev/dist/test.html'); await pg.wait_for_timeout(2500)
    print('origin', await pg.evaluate("location.origin + ' ' + typeof Cutout"))
    await pg.evaluate("""window.__st='start'; (async()=>{ try { window.__st='download'; await Cutout.download(q=>{window.__q=q}); window.__st='bitmap'; const b=await (await fetch('http://127.0.0.1:8766/tmp_cutout/astronaut.png')).blob(); const bm=await createImageBitmap(b); window.__st='cut'; const r=await Cutout.cut(bm); window.__st='done '+Cutout.how+' '+r.w; } catch(e) { window.__st='error '+(e&&e.message)+' | '+(e&&e.stack||'').slice(0,300); } })()""")
    for i in range(50):
      await pg.wait_for_timeout(3000); st=await pg.evaluate("window.__st"); print(i*3, st[:400], flush=True)
      if st.startswith('done') or st.startswith('error'): break
    print('\n'.join(logs[-12:])); await b.close()
asyncio.run(main())

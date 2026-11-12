"""Audio tab editing tools added in November 2026: copy and paste (Ctrl+C, Ctrl+V), cut and paste, amplify by an exact
amount, normalise, the Removed listening mode, B to swap before and after, and the voice EQ and compressor. Uses
dev/tmp_noisy.wav and the AI cleaner from dev/tmp_dnhome (symlinks to ../denoise and ../cutout)."""
import asyncio, os
from playwright.async_api import async_playwright
res=[]
def ok(n,c,i=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n, '' if c else i)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept('6')))
    await pg.add_init_script("window.PATTER_DENOISE='http://127.0.0.1:8765/tmp_dnhome/denoise/'")
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('#tabs button[data-mod=audio]'); await pg.wait_for_timeout(500)
    await pg.locator('#audioWs input[type=file]').set_input_files(os.path.abspath('tmp_noisy.wav'))
    async def settle():
      for i in range(80):
        await pg.wait_for_timeout(400)
        if await pg.evaluate("()=>!!AudioTab._W.out && !(AudioTab._W.status||'').length"): return True
      return False
    await settle(); D=lambda: pg.evaluate("()=>+(AudioTab._W.out.y.length/48000).toFixed(3)")
    d0=await D()
    async def select(a,b):
      await pg.evaluate("([a,b])=>{AudioTab._W.sel=[a,b];}", [a,b])
    await select(1,2); await pg.keyboard.press('Control+c'); await pg.evaluate("()=>{AudioTab._W.head=5; AudioTab._W.sel=null;}"); await pg.keyboard.press('Control+v'); await settle()
    d1=await D(); ok('copy and paste makes it a second longer', abs(d1-d0-1)<0.02, [d0,d1])
    await select(0.5,1.0); await pg.keyboard.press('Control+x'); await settle(); d2=await D(); ok('cut takes half a second out', abs(d1-d2-0.5)<0.02, [d1,d2])
    await pg.evaluate("()=>{AudioTab._W.head=0;}"); await pg.keyboard.press('Control+v'); await settle(); d3=await D(); ok('and paste puts it back', abs(d3-d1)<0.02, [d1,d3])
    pk=lambda a,b: pg.evaluate("([a,b])=>{const y=AudioTab._W.out.y; let m=0; for(let i=Math.floor(a*48000);i<b*48000;i++) m=Math.max(m,Math.abs(y[i])); return m;}", [a,b])
    p0=await pk(6,7); await select(6,7); await pg.locator('#audioWs button', has_text='Amplify').click(); await settle(); p1=await pk(6,7)
    ok('amplify by 6 dB doubles the level', abs(p1/p0-2)<0.15, [p0,p1])
    await pg.evaluate("()=>{AudioTab._W.sel=null;}"); await pg.locator('#audioWs button', has_text='Normalise').click(); await settle(); p2=await pk(0, await D())
    ok('normalise puts the loudest peak at -1 dB', abs(p2-0.891)<0.02, p2)
    await pg.locator('#audioWs button', has_text='Get the AI voice cleaner').click()
    for i in range(60):
      await pg.wait_for_timeout(500)
      if await pg.locator('#audioWs .au-side .field', has_text='AI voice cleaner').count(): break
    await pg.locator('#audioWs .au-side .field', has_text='AI voice cleaner').locator('button', has_text='On').click(); await settle()
    await pg.locator('#audioWs .au-ab', has_text='Removed').click(); await pg.wait_for_timeout(300)
    ok('Removed plays what the AI took out', await pg.evaluate("()=>AudioTab._W.removed && !!AudioTab._W.outRes && AudioTab._W.outRes.y.length===AudioTab._W.out.y.length"))
    await pg.locator('#audioWs .au-ab', has_text='After').click(); await pg.keyboard.press('b'); await pg.wait_for_timeout(200)
    ok('B swaps to Before', await pg.evaluate("()=>AudioTab._W.before"))
    await pg.keyboard.press('b'); await pg.locator('#audioWs .au-side .field', has_text='Voice EQ').locator('button', has_text='On').click(); await settle()
    ok('voice EQ on', await pg.evaluate("()=>JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.audio.clean.eq.on"))
    ok('no Clean my voice button (he had it taken out)', await pg.locator('#audioWs button', has_text='Clean my voice').count()==0)
    await pg.screenshot(path=os.environ.get('SHOT','/tmp/audio2.png'))
    ok('no page errors', not errs, errs[:3]); print('SUMMARY', sum(res), '/', len(res)); await b.close()
asyncio.run(main())

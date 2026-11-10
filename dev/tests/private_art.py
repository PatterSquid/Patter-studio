"""His locked artwork: the app finds private/art.json, asks for the password once, a wrong one is refused, the right one
loads his puppet and hand sheet into the Character, and the next opening does not ask again. Serves the repo's private/
through dev/tmp_home/private (a link); the password comes from PATTER_ART_PASSWORD."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PW = os.environ['PATTER_ART_PASSWORD']
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); ctx = await b.new_context(viewport={'width': 1366, 'height': 768}); errs = []
    await ctx.add_init_script("window.PATTER_HOME = 'http://127.0.0.1:8765/tmp_home/';")
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html')
    await pg.wait_for_selector('#dlg[open] input[type=password]', timeout=30000); print('asked for the password')
    if len(sys.argv) > 1: await pg.screenshot(path=sys.argv[1] + '/unlock.png')
    await pg.fill('#dlg input[type=password]', 'wrong password'); await pg.locator('#dlg button', has_text='Unlock').click()
    await pg.wait_for_function("()=>/did not open/.test(document.querySelector('#dlg').textContent)", timeout=60000); print('wrong password refused')
    await pg.fill('#dlg input[type=password]', PW); await pg.locator('#dlg button', has_text='Unlock').click()
    await pg.wait_for_function("()=>!document.querySelector('#dlg').open", timeout=180000)
    r = await pg.evaluate("""async()=>{ await new Promise(r=>setTimeout(r,800)); document.querySelector('button[data-mod=char]').click(); await new Promise(r=>setTimeout(r,2500));
      const rig = await Puppet.load(PrivateArt && (await new Promise(r=>r(null))) || JSON.parse(localStorage.getItem('patter-state')||'null')?.cfg?.char?.puppet).catch(()=>null);
      return { state: PrivateArt.state, toast: document.getElementById('toast').textContent, panelHasPuppet: !/None yet/.test(document.querySelector('#inspector select')?.selectedOptions[0]?.textContent || 'None yet') }; }""")
    print(r)
    trig = await pg.evaluate("async()=>{ const sel=document.querySelector('#inspector select'); const id=sel&&sel.value; const rig=id?await Puppet.load(id):null; return rig?Object.keys(rig.triggers):null; }")
    print('triggers', trig)
    if len(sys.argv) > 1: await pg.screenshot(path=sys.argv[1] + '/unlocked.png')
    await pg.reload(); await pg.wait_for_timeout(6000)
    print('asked again after reload:', await pg.evaluate("()=>!!document.querySelector('#dlg[open] input[type=password]')"))
    print('errors', errs); await b.close()
asyncio.run(main())

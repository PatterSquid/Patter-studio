"""Rhubarb lip sync in the Character tab: choose it in the panel, press Download (served from dev/tmp_rh/, a copy of
lipsync/rhubarb/), check the mouth shapes then come from Rhubarb, that it is kept for next time (a reload needs no
download), and export the same clip with each engine side by side. Needs dev/tmp_puppet.puppet and dev/tmp_voice2.wav."""
import asyncio, base64, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/char_rhubarb'; os.makedirs(OUT, exist_ok=True)
SCRIPT = "[calm] Hello there. Right, listen. You will not believe this. [angry] They have only gone and shut the chippy! On a Friday! [calm] Why would anybody do that? Honestly, it is a disgrace. [happy] But the new one round the corner is brilliant. So that is the thing."
CFG = "JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char"
async def main():
  async with async_playwright() as p:
    ctx = await p.chromium.launch_persistent_context('/tmp/claude-0/rh_profile', args=['--no-proxy-server'], viewport={'width': 1600, 'height': 960}); pg = ctx.pages[0] if ctx.pages else await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.add_init_script("window.PATTER_LIPSYNC = '/tmp_rh/';")
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-group=anim]'); await pg.click('#animRail button[data-mod=char]'); await pg.wait_for_timeout(800)
    await pg.locator('#inspector input[type=file][accept*=puppet]').set_input_files(os.path.abspath('tmp_puppet.puppet'))
    for i in range(60):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate(f"()=>!!Puppet.get(({CFG}).puppet||'')"): break
    await pg.locator('#inspector input[type=file][accept*=audio]').set_input_files(os.path.abspath('tmp_voice2.wav')); await pg.wait_for_timeout(2500)
    await pg.locator('#inspector textarea[aria-label=Script]').fill(SCRIPT); await pg.wait_for_timeout(2500)
    await pg.locator('#inspector .st-seg button', has_text='Rhubarb').click(); await pg.wait_for_timeout(500)
    print('state before:', await pg.evaluate("()=>Rhubarb.state"))
    await pg.locator('#inspector button', has_text='Download Rhubarb').click()
    for i in range(120):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate("()=>Rhubarb.state==='ready'"): break
    print('state after download:', await pg.evaluate("()=>Rhubarb.state"))
    for i in range(60):
      await pg.wait_for_timeout(1000)
      e = await pg.evaluate(f"()=>{{ const A=Character.syncOf({CFG}); return A && A.engine; }}")
      if e == 'rhubarb': break
    r = await pg.evaluate(f"()=>{{ const A=Character.syncOf({CFG}); return {{engine:A&&A.engine, n:A&&A.visemes.length, words:A&&A.words.length, first:A&&A.visemes.slice(0,10)}}; }}")
    print('sync:', r)
    await pg.screenshot(path=OUT + '/panel.png')
    # export the clip with each engine
    for eng in ['patter', 'rhubarb']:
      n = await pg.evaluate(f"""async()=>{{ const c=Object.assign({{}}, {CFG}, {{ sync: '{eng}' }}); await Character.prepare(c); const v={{v:2,items:[{{id:'x',kind:'clip',mod:'char',cfg:c,inPt:0,hold:0}}],tracks:[]}};
        const res=await CutExport.run(v,{{scheme:'saltire',format:'16:9'}},{{fps:30,res:'720',quality:'high'}}); window.__v=res.blob; return [res.frames, Character.syncOf(c).engine]; }}""")
      s = await pg.evaluate("async()=>{ const u=new Uint8Array(await window.__v.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }")
      open(f'{OUT}/{eng}.mp4', 'wb').write(base64.b64decode(s)); print('exported', eng, n)
    await ctx.close()
    # a fresh start with the same browser: Rhubarb is still there
    ctx = await p.chromium.launch_persistent_context('/tmp/claude-0/rh_profile', args=['--no-proxy-server']); pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/tmp_rh/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    print('after restart, no download allowed:', await pg.evaluate("async()=>{ const ok=await Rhubarb.ready(); const x=new Float32Array(16000*2); for(let i=0;i<x.length;i++) x[i]=Math.sin(i*0.05)*0.3*(i%8000<4000); const v=await Rhubarb.visemes(x,'hello hello'); return [ok, v.length]; }"))
    print('errors:', errs); await ctx.close()
asyncio.run(main())

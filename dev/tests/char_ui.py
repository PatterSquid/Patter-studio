"""The Character tab: Animator, Character; load the puppet (dev/tmp_puppet.puppet) and a voice (dev/tmp_voice.wav, made with
ffmpeg's flite voice) through the panel, type a script with tags, check the lip sync lined up, the moves from the tags,
frames at set times, undo, the clip in the Video tab with its voice, and an export with sound. Writes to OUT."""
import asyncio, base64, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/char_ui'; os.makedirs(OUT, exist_ok=True)
SCRIPT = "[calm] Right. Here is the thing nobody in Glasgow wanted to hear. [angry] They have only gone and shut the chippy. [look left] On a Friday. [point] You heard me. [surprised] Aye. [shout] Unbelievable."
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width': 1600, 'height': 960}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-group=anim]'); await pg.wait_for_timeout(800)
    print('animator opens:', await pg.evaluate("()=>document.querySelector('[data-mod].on').dataset.mod"))
    await pg.click('#animRail button[data-mod=char]'); await pg.wait_for_timeout(800)
    await pg.screenshot(path=OUT + '/empty.png')
    await pg.locator('#inspector input[type=file][accept*=puppet]').set_input_files(os.path.abspath('tmp_puppet.puppet'))
    for i in range(60):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate("()=>!!(Video.hooks.tabCfg?Video.hooks.tabCfg('char'):null) && !!Puppet.get(JSON.parse(localStorage.getItem('patter-studio-v1')||'{}').cfg?.char?.puppet||'')"): break
    print('puppet:', await pg.evaluate("()=>{ const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char; const r=Puppet.get(c.puppet); return r && [r.name, r.visemes.length, Object.keys(r.triggers)]; }"))
    await pg.locator('#inspector input[type=file][accept*=audio]').set_input_files(os.path.abspath('tmp_voice.wav')); await pg.wait_for_timeout(2500)
    box = pg.locator('#inspector textarea[aria-label=Script]'); await box.fill(SCRIPT); await pg.wait_for_timeout(3000)
    st = await pg.evaluate("()=>{ const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char; const A=Character.syncOf(c); return {voice:!!c.voice, words: A&&A.words.length, guessed: A&&A.guessed, tags: A&&A.tags.map(t=>t.tag+'@'+t.t.toFixed(2)), dur: Video.hooks.tabCfg ? null : null, first: A&&A.words.slice(0,6).map(w=>w[2]+'@'+w[0].toFixed(2))}; }")
    print('sync:', st)
    await pg.screenshot(path=OUT + '/loaded.png')
    # frames across the clip, drawn by the module itself
    r = await pg.evaluate("""async()=>{ const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char, d=Character.duration(c), out={}, ts=[0.5,1.2,2.0,3.3,4.6,5.6,6.6,7.4,8.2]; 
      for (const t of ts) { const cv=document.createElement('canvas'); cv.width=960; cv.height=540; const g=cv.getContext('2d'); g.scale(0.5,0.5); Character.draw(g,t,c,{format:'16:9'},1920,1080); out[t]=cv.toDataURL('image/jpeg',0.85).split(',')[1]; }
      const A=Character.syncOf(c), rig=Puppet.get(c.puppet), p=Character.perfOf(c,A,rig,d); return {d, frames:out, moves:p.moves.map(m=>[m.k,m.kind,+m.start.toFixed(2),+m.end.toFixed(2)]), nods:p.nods.length, blinks:p.blinks.length, phrases:p.phrases.length}; }""")
    for t, s in r['frames'].items(): open(f'{OUT}/f_{float(t):04.1f}.jpg', 'wb').write(base64.b64decode(s))
    print('dur', round(r['d'], 2), 'moves', r['moves'], 'nods', r['nods'], 'blinks', r['blinks'], 'phrases', r['phrases'])
    # timeline shows words and moves; add a move from the menu
    print('tracks:', await pg.evaluate("()=>{ const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char; return Character.editor.tracks(c).map(T=>[T.name,T.items.length]); }"))
    # play a moment with sound
    await pg.click('#playBtn'); await pg.wait_for_timeout(1500); await pg.click('#playBtn')
    # undo the script
    await pg.locator('.stagecol').click(position={'x': 5, 'y': 5}); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
    print('after undo script starts:', (await pg.evaluate("()=>JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char.script"))[:30])
    await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(500)
    # export with the voice (as the panel's button does, through the editor's exporter)
    r = await pg.evaluate("""async()=>{ const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char; await Character.prepare(c); const v={v:2,items:[{id:'x',kind:'clip',mod:'char',cfg:c,inPt:0,hold:0}],tracks:[]};
      const res=await CutExport.run(v,{scheme:'saltire',format:'16:9',texture:true},{fps:25,res:'1080',quality:'high'}); window.__v=res.blob; return [res.frames, CutAudio.sources(v,{format:'16:9'}).length]; }""")
    print('export frames, sound sources:', r)
    s = await pg.evaluate("async()=>{ const u=new Uint8Array(await window.__v.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }")
    open(OUT + '/char.mp4', 'wb').write(base64.b64decode(s))
    print('errors:', errs); await b.close()
asyncio.run(main())

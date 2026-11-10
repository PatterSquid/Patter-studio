"""The Audio tab, used like he would: open a noisy recording (dev/tmp_noisy.wav: robot speech plus hiss, hum and rumble),
see it, press Clean my voice, switch to the frequencies, cut a part out with the mouse and Delete, undo it, tighten the
pauses, learn the noise from a chosen quiet bit, and send it to the Character tab and the video. Writes screenshots and
the cleaned WAV to OUT."""
import asyncio, base64, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/audio_ui'; os.makedirs(OUT, exist_ok=True)
ST = "JSON.parse(localStorage.getItem('patter-studio-v1')).cfg"
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width': 1600, 'height': 960}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('#tabs button[data-mod=audio]'); await pg.wait_for_timeout(600)
    await pg.screenshot(path=OUT + '/0_empty.png')
    await pg.locator('#audioWs input[type=file]').set_input_files(os.path.abspath('tmp_noisy.wav'))
    async def settle(ms=1000, n=40):
      for i in range(n):
        await pg.wait_for_timeout(ms)
        if await pg.evaluate("()=>!!AudioTab._W.out && !(AudioTab._W.status||'').length"): return True
      return False
    print('loaded:', await settle(), await pg.evaluate(f"()=>[({ST}).audio.name, AudioTab._W.out && +(AudioTab._W.out.y.length/48000).toFixed(2)]"))
    await pg.screenshot(path=OUT + '/1_loaded.png')
    await pg.locator('#audioWs button', has_text='Clean my voice').click(); await pg.wait_for_timeout(800); print('cleaned:', await settle())
    c = await pg.evaluate(f"()=>{{ const c=({ST}).audio.clean; return [c.rumble,c.hum,c.declick,c.nr.on,!!c.nr.profile,c.deess,c.level,c.loud]; }}"); print('clean settings:', c)
    lv = await pg.evaluate("()=>{ const W=AudioTab._W; const f=(y,a,b)=>{let s=0;for(let i=a*48000;i<b*48000;i++)s+=y[i]*y[i];return (10*Math.log10(s/((b-a)*48000)+1e-20)).toFixed(1);}; return {before:f(W.outBefore.y,0.2,1.3), after:f(W.out.y,0.2,1.3), lufs:AudioFX.lufs(W.out.y,48000).toFixed(1)}; }")
    print('noise floor in the first quiet second (dB):', lv)
    await pg.screenshot(path=OUT + '/2_cleaned.png')
    await pg.locator('#audioWs .au-bar button', has_text='Frequencies').click(); await pg.wait_for_timeout(800); await pg.screenshot(path=OUT + '/3_freq.png')
    await pg.locator('#audioWs .au-ab', has_text='Before').click(); await pg.wait_for_timeout(800); await pg.screenshot(path=OUT + '/4_freq_before.png')
    await pg.locator('#audioWs .au-ab', has_text='After').click(); await pg.locator('#audioWs .au-bar button', has_text='Waveform').click(); await pg.wait_for_timeout(300)
    # drag to select 3 s to 4 s, Delete
    box = await pg.locator('#audioWs .au-wave').bounding_box(); d = await pg.evaluate("()=>AudioTab._W.t1-AudioTab._W.t0")
    X = lambda t: box['x'] + t / d * box['width']; y = box['y'] + box['height'] / 2
    await pg.mouse.move(X(3), y); await pg.mouse.down(); await pg.mouse.move(X(3.5), y, steps=5); await pg.mouse.move(X(4), y, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(200)
    print('selection:', await pg.evaluate("()=>AudioTab._W.sel && AudioTab._W.sel.map(v=>+v.toFixed(2))"))
    await pg.keyboard.press('Delete'); print('after delete:', await settle(500), await pg.evaluate(f"()=>[({ST}).audio.edits, +(AudioTab._W.out.y.length/48000).toFixed(2)]"))
    await pg.screenshot(path=OUT + '/5_cut.png')
    await pg.wait_for_timeout(600); await pg.keyboard.press('Control+z'); await settle(500)
    print('after undo:', await pg.evaluate(f"()=>[({ST}).audio.edits.length, +(AudioTab._W.out.y.length/48000).toFixed(2)]"))
    await pg.keyboard.press('Control+y'); await settle(500); print('after redo:', await pg.evaluate(f"()=>({ST}).audio.edits.length"))
    await pg.locator('#audioWs button', has_text='Tighten long pauses').click(); await settle(500)
    print('tighten:', await pg.locator('#audioWs .au-say').inner_text(), await pg.evaluate("()=>+(AudioTab._W.out.y.length/48000).toFixed(2)"))
    # learn the noise from a chosen quiet bit (the first second)
    await pg.locator('#audioWs .au-bar button', has_text='Whole thing').click(); d = await pg.evaluate("()=>AudioTab._W.t1-AudioTab._W.t0")
    X = lambda t: box['x'] + t / d * box['width']
    await pg.mouse.move(X(0.2), y); await pg.mouse.down(); await pg.mouse.move(X(1.2), y, steps=6); await pg.mouse.up()
    await pg.locator('#audioWs button', has_text='Learn noise').click(); await settle(500); print('learn:', await pg.locator('#audioWs .au-say').inner_text())
    # AI noise removal on
    await pg.locator('#audioWs .au-side .field', has_text='AI noise removal').locator('button', has_text='On').click(); await settle(500)
    print('ai on:', await pg.evaluate(f"()=>({ST}).audio.clean.ai"), await pg.evaluate("()=>{ const W=AudioTab._W; let s=0; for(let i=0.2*48000;i<1.3*48000;i++) s+=W.out.y[i]*W.out.y[i]; return (10*Math.log10(s/(1.1*48000)+1e-20)).toFixed(1); }"))
    # play a moment (Space), then send it on
    await pg.keyboard.press('Space'); await pg.wait_for_timeout(700); pl = await pg.evaluate("()=>AudioTab._W.playing"); await pg.keyboard.press('Space'); print('played:', pl)
    await pg.locator('#audioWs button', has_text='Use as my character').click(); await pg.wait_for_timeout(2500)
    await pg.locator('#audioWs button', has_text='Add to the video').click(); await pg.wait_for_timeout(2500)
    r = await pg.evaluate(f"()=>{{ const s={ST}; const v=s.video; return {{char_voice: s.char && s.char.voice, char_name: s.char && s.char.voiceName, video_audio: (v.tracks||[]).filter(t=>t.kind==='audio').map(t=>[t.name, t.items.length, t.items[0].asset===s.char.voice ? 'same file' : 'other'])}}; }}")
    print('sent:', r, await pg.locator('#audioWs .au-say').inner_text())
    s = await pg.evaluate("async()=>{ const W=AudioTab._W; const bl=AudioFX.wav([W.out.y],48000); const u=new Uint8Array(await bl.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }")
    open(OUT + '/cleaned.wav', 'wb').write(base64.b64decode(s))
    # other tabs still fine
    await pg.click('#tabs button[data-mod=video]'); await pg.wait_for_timeout(800); await pg.click('#tabs button[data-mod=audio]'); await pg.wait_for_timeout(800)
    print('back in audio, workspace shown:', await pg.evaluate("()=>document.body.classList.contains('aud') && !document.getElementById('audioWs').hidden"))
    print('errors:', errs); await b.close()
asyncio.run(main())

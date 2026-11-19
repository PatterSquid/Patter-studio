"""Studio voice in the Audio tab, used like he would: open a noisy recording, read the report, switch Studio voice on (the AI
cleaner not yet downloaded, then downloaded), change a level slider (only the quick half is done again), the gaps and breaths,
undo, switch it off, and record from the (pretend) microphone into a WAV with the meter showing. Screenshots to OUT."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/audio_studio'; os.makedirs(OUT, exist_ok=True); SRC = os.environ.get('SRC', 'tmp_noisy.wav')
ST = "JSON.parse(localStorage.getItem('patter-studio-v1')).cfg"; ok = []
def check(name, cond, extra=''):
  ok.append(bool(cond)); print(('ok   ' if cond else 'FAIL ') + name, extra)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
    pg = await b.new_page(viewport={'width': 1366, 'height': 768}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.add_init_script("window.PATTER_DENOISE='http://127.0.0.1:8765/tmp_dnhome/denoise/'")
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('#tabs button[data-mod=audio]'); await pg.wait_for_timeout(500)
    await pg.evaluate("()=>{ window.__fronts=0; const f=AudioFX.front; AudioFX.front=function(){ window.__fronts++; return f.apply(this, arguments); }; }")
    await pg.locator('#audioWs input[type=file]').set_input_files(os.path.abspath(SRC))
    async def settle(ms=500, n=120):
      for i in range(n):
        await pg.wait_for_timeout(ms)
        if await pg.evaluate("()=>!!AudioTab._W.out && !(AudioTab._W.status||'').length && AudioTab._W.out.key===JSON.stringify([AudioTab._W.cfg.src, AudioTab._W.cfg.clean])+JSON.stringify(AudioTab._W.cfg.edits)"): return True
      return False
    check('1 recording loaded', await settle())
    await pg.wait_for_timeout(1500); rep = await pg.locator('#audioWs .au-report .au-rl').all_inner_texts(); check('2 the report says what came in', len(rep) >= 3, rep)
    # Studio voice on, the cleaner not there yet
    await pg.locator('#audioWs .au-side .card', has_text='Studio voice').locator('.st-seg button', has_text='On').click(); check('3 studio on settles', await settle())
    c = await pg.evaluate(f"()=>({ST}).audio.clean"); check('4 settings written (cleaner off: not downloaded)', c['studio'] and c['buzz'] and c['room'] == 0.8 and c['gate']['on'] and c['tone']['on'] and c['ai']['on'] is False and c['loud'] == -16, json.dumps({k: c[k] for k in ['room', 'ride', 'comp', 'loud', 'ai']}))
    say = await pg.locator('#audioWs .au-say').inner_text(); check('5 told to get the cleaner', 'AI voice cleaner' in say, say)
    # get it: it switches itself on
    await pg.locator('#audioWs button', has_text='Get the AI voice cleaner').click()
    for i in range(60):
      await pg.wait_for_timeout(500)
      if await pg.evaluate(f"()=>({ST}).audio.clean.ai.on"): break
    check('6 cleaner downloaded and on at Thorough', await pg.evaluate(f"()=>{{const a=({ST}).audio.clean.ai; return a.on && a.atten===40;}}"))
    check('7 settles with the cleaner', await settle()); info = await pg.evaluate("()=>AudioTab._proc.info"); print('     info:', json.dumps(info)[:300])
    lv = await pg.evaluate("()=>{ const W=AudioTab._W, L=y=>{ const w=960, a=[]; for(let o=0;o+w<=y.length;o+=w){ let s=0; for(let i=0;i<w;i++) s+=y[o+i]*y[o+i]; a.push(10*Math.log10(s/w+1e-14)); } a.sort((p,q)=>p-q); return [a[Math.floor(a.length*0.9)], a[Math.floor(a.length*0.08)]]; }; const b=L(W.outBefore.y), a=L(W.out.y); return { before: +(b[0]-b[1]).toFixed(1), after: +(a[0]-a[1]).toFixed(1), lufs: +AudioFX.lufs(W.out.y,48000).toFixed(1) }; }")
    check('8 gaps far quieter under the voice, loudness set', lv['after'] > lv['before'] + 20 and abs(lv['lufs'] + 16) < 1.2, lv)
    rep = await pg.locator('#audioWs .au-report .au-rl').all_inner_texts(); check('9 the report has the room', any(t.startswith('Room') for t in rep), rep)
    await pg.screenshot(path=OUT + '/1_studio_1366.png')
    # a level slider: only the quick half again
    n0 = await pg.evaluate("()=>window.__fronts"); sl = pg.locator('#audioWs .au-side .card', has_text='Level and gaps').locator('input[type=range]').nth(1)
    await sl.evaluate("e=>{ e.value=0.6; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }"); t0 = await pg.evaluate("()=>performance.now()"); await settle(100, 300); t1 = await pg.evaluate("()=>performance.now()")
    check('10 compressor moved: slow half not done again', await pg.evaluate("()=>window.__fronts") == n0 and await pg.evaluate(f"()=>({ST}).audio.clean.comp") == 0.6, 'ready in %.1f s' % ((t1 - t0) / 1000))
    # gaps and breaths
    card = pg.locator('#audioWs .au-side .card', has_text='Level and gaps')
    await card.locator('.st-seg button', has_text='Silent').click(); await settle(100, 300); await pg.locator('#audioWs .au-side .card', has_text='Level and gaps').locator('.st-seg button', has_text='Take out').click(); await settle(100, 300)
    g = await pg.evaluate(f"()=>({ST}).audio.clean.gate"); check('11 gaps silent, breaths out', g['on'] and g['range'] == 60 and g['breath'] == 30, g)
    await pg.locator('#audioWs .au-side .card', has_text='Level and gaps').locator('.st-seg', has_text='Quieter').locator('button', has_text='Leave').click(); await settle(100, 300); await pg.locator('#audioWs .au-side .card', has_text='Level and gaps').locator('.st-seg', has_text='Soften').locator('button', has_text='Leave').click(); await settle(100, 300)
    g = await pg.evaluate(f"()=>({ST}).audio.clean.gate"); check('12 both left: the gate is off', g['on'] is False, g)
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(400); await pg.keyboard.press('Control+z'); await settle(100, 300); g = await pg.evaluate(f"()=>({ST}).audio.clean.gate"); check('13 undo twice brings them back', g['on'] and g['range'] == 60 and g['breath'] == 30, g)
    # removed, before
    await pg.locator('#audioWs .au-ab', has_text='Removed').click(); await pg.wait_for_timeout(300); check('14 Removed has sound in it', await pg.evaluate("()=>{ const o=AudioTab._W.outRes; if(!o) return false; let s=0; for(let i=0;i<o.y.length;i+=7) s+=o.y[i]*o.y[i]; return s>1e-6; }"))
    await pg.locator('#audioWs .au-ab', has_text='After').click()
    # off again
    await pg.locator('#audioWs .au-side .card', has_text='Studio voice').locator('.st-seg button', has_text='Off').click(); await settle(100, 300)
    c = await pg.evaluate(f"()=>({ST}).audio.clean"); same = await pg.evaluate("()=>{ const W=AudioTab._W, a=W.out.y, b=AudioFX.rumble(W.outBefore.y,48000,80); let m=0; for(let i=0;i<a.length;i+=3) m=Math.max(m,Math.abs(a[i]-b[i])); return m; }")
    check('15 studio off: every stage off, the sound as it came in (rumble cut only)', (not c['studio']) and (not c['buzz']) and c['room'] == 0 and not c['gate']['on'] and not c['ai']['on'] and same < 1e-6, same)
    # anything in the panel, at random (same clicks every run)
    import random; rnd = random.Random(5); bad = 0
    for i in range(36):
      btns = pg.locator('#audioWs .au-side .st-seg button'); n = await btns.count(); sls = pg.locator('#audioWs .au-side input[type=range]'); m = await sls.count()
      if rnd.random() < 0.6 or not m: await btns.nth(rnd.randrange(n)).click()
      else: await sls.nth(rnd.randrange(m)).evaluate("(e, u)=>{ e.value=+e.min+(e.max-e.min)*u; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }", rnd.random())
      await pg.wait_for_timeout(120)
      if i % 6 == 5:
        await settle(200, 200); bad += await pg.evaluate("()=>{ const y=AudioTab._W.out.y; let n=0; for(let i=0;i<y.length;i+=5) if(!isFinite(y[i])||Math.abs(y[i])>1.001) n++; return n; }")
    check('15b thirty six random switches and sliders: still a clean sound', await settle(200, 200) and bad == 0 and not errs, bad)
    await pg.locator('#audioWs .au-side .card', has_text='Studio voice').locator('.st-seg button', has_text='Off').click(); await settle(100, 300)
    # record from the pretend microphone
    await pg.locator('#audioWs .au-rec').click(); await pg.wait_for_timeout(2600); met = await pg.evaluate("()=>{ const m=document.querySelector('#audioWs .au-meter'); return !m.hidden && m.getBoundingClientRect().width>100; }"); say = await pg.locator('#audioWs .au-say').inner_text()
    await pg.screenshot(path=OUT + '/2_recording.png'); await pg.locator('#audioWs .au-rec').click(); await settle(300, 60)
    r = await pg.evaluate("async ()=>{ const W=AudioTab._W, b=await CutMedia.blobOf(W.cfg.src), d=new DataView(await b.slice(0,44).arrayBuffer()); let pk=0; for(let i=0;i<W.outBefore.y.length;i++) pk=Math.max(pk,Math.abs(W.outBefore.y[i])); return { name: W.cfg.name, secs: +(W.outBefore.y.length/48000).toFixed(2), fmt: d.getUint16(20,true), bits: d.getUint16(34,true), sr: d.getUint32(24,true), peak: +pk.toFixed(3), meterHidden: document.querySelector('#audioWs .au-meter').hidden }; }")
    check('16 recorded straight into a 32 bit WAV, meter shown while recording', met and r['name'].endswith('.wav') and r['fmt'] == 3 and r['bits'] == 32 and r['sr'] == 48000 and 2.0 < r['secs'] < 3.6 and r['peak'] > 0.001 and r['meterHidden'], json.dumps(r) + ' | ' + say)
    await pg.set_viewport_size({'width': 1600, 'height': 960}); await pg.wait_for_timeout(400); await pg.screenshot(path=OUT + '/3_after_record_1600.png')
    sc = await pg.evaluate("()=>[document.documentElement.scrollHeight<=innerHeight+1, document.documentElement.scrollWidth<=innerWidth+1]"); check('17 the page itself does not scroll', all(sc), sc)
    check('18 no page errors', not errs, errs[:3]); print('%d of %d' % (sum(ok), len(ok))); await b.close()
asyncio.run(main())

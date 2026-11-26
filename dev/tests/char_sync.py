"""The Character tab end to end with a real recording (dev/tmp_me.wav or argv[2]) and the listening helper served from
dev/tmp_lshome: puppet in, recording in, the helper fetched with the panel's button, the recording listened to by itself,
the words written from it, every word pinned; then the preview played and the voice's drift from the picture sampled.
Writes screenshots to OUT."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/char_sync'; WAV = sys.argv[2] if len(sys.argv) > 2 else 'tmp_me.wav'; os.makedirs(OUT, exist_ok=True)
CFG = "JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char"
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width': 1600, 'height': 960}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.add_init_script("window.PATTER_LISTEN='/tmp_lshome/listen/';")
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-group=anim]'); await pg.wait_for_timeout(600); await pg.click('#animRail button[data-mod=char]'); await pg.wait_for_timeout(600)
    await pg.locator('#inspector input[type=file][accept*=puppet]').set_input_files(os.path.abspath('tmp_puppet.puppet'))
    for i in range(60):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate("()=>{ const c=" + CFG + "; return !!(c && c.puppet && Puppet.get(c.puppet)); }"): break
    await pg.locator('#inspector input[type=file][accept*=audio]').set_input_files(os.path.abspath(WAV)); await pg.wait_for_timeout(3000)
    txt = lambda: pg.evaluate("()=>document.querySelector('#inspector').innerText")
    t = await txt(); print('PASS' if 'Get exact lip sync' in t else 'FAIL', 'the panel offers the listening helper'); print('PASS' if 'Roughly lined up' in t or 'Lining up' in t or 'No words yet' in t else 'FAIL', 'says the timing is rough until then')
    await pg.click("#inspector button:has-text('Get exact lip sync')")
    ok = False
    for i in range(240):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate("()=>{ const c=" + CFG + "; return Listen.state==='ready' && !!Listen.heardNow(c.voice); }"): ok = True; break
      if i == 12: await pg.screenshot(path=OUT + '/listening.png')
    print('PASS' if ok else 'FAIL', 'the helper was fetched and the recording listened to by itself', i, 's')
    await pg.wait_for_timeout(3000); st0 = await pg.evaluate("()=>{ const c=" + CFG + ", A=Character.syncOf(c); return { script: c.script.slice(0,40), words: A && A.words.length, pinned: A && A.pinned }; }")
    print('PASS' if st0['pinned'] and st0['pinned'] >= st0['words'] * 0.9 else 'FAIL', 'the sample script was not this recording, so the words heard took its place by themselves', st0)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.click('#chHear'); await pg.wait_for_timeout(4000)
    st = await pg.evaluate("()=>{ const c=" + CFG + ", A=Character.syncOf(c); return { script: c.script.slice(0,60), words: A && A.words.length, pinned: A && A.pinned }; }")
    print('PASS' if st['pinned'] and st['pinned'] >= st['words'] * 0.9 else 'FAIL', 'the words came straight from what was heard and are pinned', st)
    t = await txt(); print('PASS' if 'Every word is lined up' in t else 'FAIL', 'the panel says so'); await pg.screenshot(path=OUT + '/pinned.png')
    # he corrects a few words: still pinned
    await pg.evaluate("()=>{ const ta=document.querySelector('#inspector textarea[aria-label=Script]'); ta.value=ta.value.replace('cheetah','cheater').replace('Anyway, so','[point] Anyway, right, so'); ta.dispatchEvent(new Event('input',{bubbles:true})); }"); await pg.wait_for_timeout(3500)
    st2 = await pg.evaluate("()=>{ const c=" + CFG + ", A=Character.syncOf(c); return { words: A && A.words.length, pinned: A && A.pinned, tag: A && A.tags.map(q=>q.tag+'@'+q.t.toFixed(2)) }; }")
    print('PASS' if st2['pinned'] and st2['pinned'] >= st2['words'] - 4 and st2['words'] == st['words'] + 1 else 'FAIL', 'a corrected script stays pinned', st2)
    # play: the voice against the picture
    await pg.evaluate("()=>document.querySelector('#playBtn').click()"); ds = []
    for i in range(70):
      await pg.wait_for_timeout(100); d = await pg.evaluate("()=>Character._drift")
      if i >= 12 and d is not None: ds.append(d)
    await pg.evaluate("()=>document.querySelector('#playBtn').click()")
    print('drift ms', [round(x*1000) for x in ds][:60]); pass
    ds = ds[10:]
    if ds: print('PASS' if max(abs(x) for x in ds) < 0.06 and sum(abs(x) for x in ds) / len(ds) < 0.025 else 'FAIL', 'voice stays with the picture: worst %.0f ms, mean %.0f ms over %d checks' % (max(abs(x) for x in ds) * 1000, sum(abs(x) for x in ds) / len(ds) * 1000, len(ds)))
    else: print('FAIL no sound played')
    print('ERRORS', errs[:5]); await b.close()
asyncio.run(main())

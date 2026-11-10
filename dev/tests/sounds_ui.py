# The sound library in the Video tab's Audio section, with a folder in the browser's own storage standing in for his
# folder: choose it (Music and Sound effects made), add files (music filed in Music, short sounds in Sound effects),
# search, favourite, notes, preview, + adds music on a Music track that lowers under talking, drag onto the timeline,
# credits, and the list still there after reopening. Needs dev/tmp_snd/ (three sound files). Args: output folder.
import asyncio, sys, os, glob
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sounds_ui'; os.makedirs(OUT, exist_ok=True)
FILES = sorted(glob.glob(os.path.join(os.path.dirname(__file__), '..', 'tmp_snd', '*')))
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required']); ctx = await b.new_context(viewport={'width': 1366, 'height': 768}); errs = []; bad = []
    def check(ok, what):
      print(('ok   ' if ok else 'FAIL ') + what, flush=True)
      if not ok: bad.append(what)
    async def open_page():
      pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
      await pg.add_init_script("window.showDirectoryPicker = async () => { const r = await navigator.storage.getDirectory(); return r.getDirectoryHandle('Patter Sounds', { create: true }); };")
      await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
      await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
      await pg.evaluate("document.querySelector('#tabs button[data-mod=video]').click()"); await pg.wait_for_timeout(800)
      await pg.evaluate("[...document.querySelectorAll('.cl-tabs button')].find(b=>b.textContent.includes('Audio')).click()"); await pg.wait_for_timeout(500); return pg
    pg = await open_page()
    check(await pg.evaluate("!!document.querySelector('.snd-start') && /Choose your sound folder/.test(document.querySelector('.snd').textContent)"), 'asks for the sound folder first')
    await pg.click('.snd-start .primary'); await pg.wait_for_timeout(1500)
    subs = await pg.evaluate("(async()=>{ const r=await navigator.storage.getDirectory(); const d=await r.getDirectoryHandle('Patter Sounds'); const o=[]; for await (const [n] of d.entries()) o.push(n); return o.sort(); })()"); check(subs == ['Music', 'Sound effects'], 'made Music and Sound effects ' + str(subs))
    await pg.evaluate("document.querySelector('.snd-head .sm').click()")
    await pg.set_input_files('.snd-head input[type=file]', FILES); await pg.wait_for_timeout(4000)
    paths = await pg.evaluate("SoundLib._S.index.map(x=>x.path)"); check(any(p.startswith('Music/Chill') for p in paths) and any(p.startswith('Sound effects/Ding') for p in paths), 'filed into the right folders ' + str(paths))
    await pg.wait_for_timeout(2500); durs = await pg.evaluate("SoundLib._S.index.map(x=>x.dur)"); check(all(d and d > 0 for d in durs), 'lengths found ' + str(durs))
    rows = await pg.evaluate("document.querySelectorAll('.snd-row').length"); check(rows == 3, 'three rows (%d)' % rows)
    await pg.fill('.snd-q', 'whoosh'); await pg.wait_for_timeout(300); n = await pg.evaluate("[...document.querySelectorAll('.snd-row .snd-n')].map(x=>x.textContent)"); check(n == ['Whoosh big'], 'search ' + str(n))
    await pg.fill('.snd-q', ''); await pg.wait_for_timeout(300)
    await pg.evaluate("[...document.querySelectorAll('.snd-row')].find(r=>/Chill/.test(r.textContent)).querySelector('.snd-star').click()"); await pg.wait_for_timeout(400)
    await pg.evaluate("[...document.querySelectorAll('.snd-chips button')].find(b=>/Favourites/.test(b.textContent)).click()"); await pg.wait_for_timeout(300); n = await pg.evaluate("document.querySelectorAll('.snd-row').length"); check(n == 1, 'favourites filter (%d)' % n)
    await pg.evaluate("[...document.querySelectorAll('.snd-row')][0].querySelector('.snd-i').click()"); await pg.wait_for_timeout(200)
    await pg.fill('.snd-note textarea', 'Free music from a test library, credit needed'); await pg.dispatch_event('.snd-note textarea', 'change'); await pg.wait_for_timeout(300)
    await pg.evaluate("[...document.querySelectorAll('.snd-row')][0].querySelector('.snd-play').click()"); await pg.wait_for_timeout(700); check((await pg.evaluate("SoundLib.playing()")) != "", "preview plays"); await pg.evaluate("SoundLib.stop()")
    await pg.screenshot(path=OUT + '/lib.png')
    # + puts music on a Music track that lowers under talking
    await pg.evaluate("[...document.querySelectorAll('.snd-row')][0].querySelector('.snd-add').click()"); await pg.wait_for_timeout(3500)
    T = await pg.evaluate("(()=>{ const v=PatterCut ? null : null; const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.video; return (c.tracks||[]).filter(t=>t.kind==='audio').map(t=>({name:t.name,duck:t.duck,n:t.items.length,vol:t.items[0]&&t.items[0].vol})); })()"); check(any(t['name'] == 'Music' and t['duck'] and t['n'] == 1 for t in T), 'music on a Music track that lowers under talking ' + str(T))
    # drag a sound effect onto the timeline
    await pg.evaluate("[...document.querySelectorAll('.snd-chips button')][0].click()"); await pg.wait_for_timeout(300)
    lane = await pg.evaluate("(()=>{ const l=[...document.querySelectorAll('.ct-lane')]; const r=l[0].getBoundingClientRect(); return [r.x+r.width*0.4, r.y+r.height/2]; })()")
    src = pg.locator('.snd-row', has_text='Ding'); await src.drag_to(pg.locator('.ct-lane').first, target_position={'x': 200, 'y': 10}); await pg.wait_for_timeout(3500)
    n = await pg.evaluate("(()=>{ const c=JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.video; return (c.tracks||[]).filter(t=>t.kind==='audio').reduce((s,t)=>s+t.items.length,0); })()"); check(n == 2, 'dragged sound on the timeline (%d sounds)' % n)
    await pg.evaluate("[...document.querySelectorAll('.snd-foot button')][0].click()"); await pg.wait_for_timeout(400); cr = await pg.evaluate("(document.querySelector('#sndCredits textarea')||{}).value||''"); check('credit needed' in cr and 'Chill beat' in cr, 'credits: ' + cr.replace('\n', ' | '))
    await pg.screenshot(path=OUT + '/credits.png'); await pg.keyboard.press('Escape')
    await pg.close(); pg = await open_page(); await pg.wait_for_timeout(1500)
    rows = await pg.evaluate("document.querySelectorAll('.snd-row').length"); check(rows == 3, 'still there after reopening (%d)' % rows)
    print('errors', errs[:5]); print('FAILED' if bad or errs else 'ALL OK', bad); await b.close()
asyncio.run(main())

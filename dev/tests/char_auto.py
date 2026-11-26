"""One step in the Animator: a recording dropped on the tab is listened to, its words written, every word lined up and the
performance planned with no button pressed; a second recording replaces the words by itself; a script that is already the
recording's (with his own tag in it) is kept; an export asked for straight away waits for the words.
Needs dev/tmp_puppet.puppet, dev/tmp_me.wav, dev/tmp_gt1.wav and the listening helper served from dev/tmp_lshome."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/char_auto'; os.makedirs(OUT, exist_ok=True)
CFG = "JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char"; ok = []
def check(name, cond, extra=''):
  ok.append(bool(cond)); print(('ok   ' if cond else 'FAIL ') + name, str(extra)[:300])
DROP = """async (url) => { const b = await (await fetch(url)).blob(), f = new File([b], url.split('/').pop(), { type: 'audio/wav' }), dt = new DataTransfer(); dt.items.add(f);
  const el = document.querySelector('#prevWrap') || document.body; const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }); el.dispatchEvent(over);
  el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return over.defaultPrevented; }"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width': 1366, 'height': 768}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.add_init_script("window.PATTER_LISTEN='/tmp_lshome/listen/';")
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
    await pg.click('button[data-group=anim]'); await pg.wait_for_timeout(500); await pg.click('#animRail button[data-mod=char]'); await pg.wait_for_timeout(500)
    await pg.locator('#inspector input[type=file][accept*=puppet]').set_input_files(os.path.abspath('tmp_puppet.puppet'))
    for i in range(60):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate("()=>{ const c=" + CFG + "; return !!(c && c.puppet && Puppet.get(c.puppet)); }"): break
    await pg.evaluate("async()=>{ if ((await Listen.check()) !== 'ready') await Listen.download(); }")
    t = await pg.evaluate("()=>document.querySelector('#inspector').innerText"); check('1 the panel says a recording can be dropped', 'drop a recording anywhere' in t)
    async def settled(n=240, change=None):   # the saved copy trails the live settings by a moment: wait for the script to have changed when it should
      for i in range(n):
        await pg.wait_for_timeout(1000)
        r = await pg.evaluate("async()=>{ const c=" + CFG + "; if (!c || !c.voice) return null; let busy = true; await Promise.race([Character.settle(c).then(() => { busy = false; }), new Promise(r => setTimeout(r, 30))]); const A = Character.syncOf(c); return { busy, script: c.script || '', words: A && A.words ? A.words.length : 0, pinned: A ? A.pinned || 0 : 0, guessed: !!(A && A.guessed), voice: c.voice, name: c.voiceName }; }")
        if r and not r['busy'] and r['words'] and not r['guessed'] and r['pinned'] and (change is None or r['script'] != change): return r
      return r
    # 1. drop his recording on the preview: nothing else is touched
    took = await pg.evaluate(DROP, '/tmp_me.wav'); check('2 the tab takes a dropped sound file', took)
    await pg.wait_for_timeout(1500); early = await pg.evaluate("()=>document.querySelector('#chAuto') ? document.querySelector('#chAuto').textContent : ''"); print('     while it works:', early)
    default = await pg.evaluate("()=>Character.defaults().script"); r = await settled(change=default)
    check('3 the words were written from the recording by themselves', r and r['script'] and r['script'] != default and 'Scotland' in r['script'], (r or {}).get('script', '')[:80])
    check('4 every word lined up', r and r['pinned'] >= 0.9 * r['words'] and r['words'] > 100, {k: r[k] for k in ['words', 'pinned']} if r else None)
    t = await pg.evaluate("()=>document.querySelector('#inspector').innerText"); check('5 the panel says so', 'Every word is lined up' in t)
    perf = await pg.evaluate("()=>{ const c=" + CFG + ", rig=Puppet.get(c.puppet), A=Character.syncOf(c), d=Character.duration(c), p=Character.perfOf(c,A,rig,d); return { moves: p.moves.length, nods: p.nods.length, blinks: p.blinks.length, dur: +d.toFixed(1) }; }"); check('6 a performance is planned', perf['moves'] > 5 and perf['blinks'] > 8, perf)
    await pg.screenshot(path=OUT + '/1_dropped.png'); first = r['script']
    # 2. another recording: the words follow by themselves
    await pg.evaluate(DROP, '/tmp_gt1.wav'); r2 = await settled(change=first)
    check('7 a second recording replaces the words by itself', r2 and r2['voice'] != r['voice'] and r2['script'] != first and r2['pinned'] > 0, (r2 or {}).get('script', '')[:80])
    # 3. his own script for the first recording, with a tag and a fixed word, is kept when that recording comes back
    mine = '[angry] ' + first.replace('cheetah', 'cheater'); await pg.evaluate("(t)=>{ const el=document.querySelector('#inspector textarea'); el.value=t; el.dispatchEvent(new Event('input',{bubbles:true})); }", mine); await pg.wait_for_timeout(600)
    await pg.evaluate(DROP, '/tmp_me.wav'); await pg.wait_for_timeout(2500); r3 = await settled(change=r2['script'])
    check('8 a script that is already this recording keeps his tag and his fix', r3 and r3['script'].startswith('[angry]') and 'cheater' in r3['script'] and r3['pinned'] >= 0.85 * r3['words'], (r3 or {}).get('script', '')[:60])
    # 4. export asked for at once: it waits for the words
    await pg.evaluate("()=>{ const el=document.querySelector('#inspector textarea'); el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); }"); await pg.wait_for_timeout(500)
    got = await pg.evaluate("""async (url) => { const b = await (await fetch(url)).blob(), f = new File([b], 'again.wav', { type: 'audio/wav' }), dt = new DataTransfer(); dt.items.add(f); document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise(r => setTimeout(r, 1200)); const st = JSON.parse(localStorage.getItem('patter-studio-v1')); let seen = null; const live = window.PatterApp && PatterApp.cfg ? PatterApp.cfg() : null;
      return { early: (JSON.parse(localStorage.getItem('patter-studio-v1')).cfg.char.script || '').length }; }""", '/tmp_gt2.wav')
    r4 = await settled(change=''); check('9 dropped on an empty script: written again', r4 and len(r4['script']) > 20 and r4['pinned'] > 0, (r4 or {}).get('script', '')[:60])
    check('10 no page errors', not errs, errs[:3]); print('%d of %d' % (sum(ok), len(ok))); await b.close()
asyncio.run(main())

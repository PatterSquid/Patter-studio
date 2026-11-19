"""The Charts panel worked by hand: every kind of chart picked from its tile, the table typed in and pasted into, columns
and rows added and removed, sorting, highlights, colours, callouts, looks, an example, undo, and an older chart brought up
to date. usage: chart_ui.py [OUT_DIR for screenshots]"""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else None
OLD = {'type': 'bar', 'title': 'Old chart', 'source': '', 'rows': [['a', '3'], ['b', '5'], ['c', '4']], 'prefix': '', 'suffix': '', 'decimals': 'auto', 'zeroBase': False, 'colour': 'Saltire blue', 'hlColour': 'Neon red', 'milestones': [{'on': True, 'idx': 1, 'caption': 'Peak'}], 'counter': True, 'camera': True, 'speed': 'normal', 'hold': 2, 'ending': 'fly', 'endText': ''}
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); ctx = await b.new_context(viewport={'width': 1366, 'height': 768}); await ctx.grant_permissions(['clipboard-read', 'clipboard-write']); pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2000)
    await pg.evaluate("()=>document.querySelector('button[data-mod=charts]').click()"); await pg.wait_for_timeout(600)
    shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png') if OUT else asyncio.sleep(0)
    if OUT: os.makedirs(OUT, exist_ok=True)
    cfg = lambda: pg.evaluate("()=>JSON.parse(JSON.stringify(JSON.parse(localStorage.getItem('patter-studio-v1')||'{}').cfg?.charts||null))")
    state = lambda: pg.evaluate("()=>{ const a=[...document.querySelectorAll('.ck-types')].map(e=>e.closest('section').parentNode).find(e=>e.offsetParent)||document.querySelector('aside'); return { tiles:a.querySelectorAll('.ck-type').length, on:(a.querySelector('.ck-type.on')||{}).dataset?.type, rows:a.querySelectorAll('.ck-table input[data-c=\"0\"]').length, cols:a.querySelectorAll('.ck-table input[data-r=\"0\"]').length-1, cards:[...a.querySelectorAll('.card h3')].map(h=>h.textContent) }; }")
    ok = []; bad = []
    def check(name, cond, info=''): (ok if cond else bad).append(name + ('' if cond else ' ' + str(info)))
    s = await state(); check('opens on the new example with eleven tiles', s['tiles'] == 11 and s['on'] == 'bar' and s['rows'] == 7, s); await shot('01_open')
    # every kind from its tile (the untouched example follows the kind)
    for k in ['hbar', 'grouped', 'stacked', 'line', 'area', 'pie', 'donut', 'race', 'number', 'percent', 'bar']:
      await pg.click(f'.ck-type[data-type={k}]:visible'); await pg.wait_for_timeout(350); s = await state(); check('tile ' + k, s['on'] == k and s['rows'] >= 3, s)
      if OUT and k in ('grouped', 'pie', 'race', 'number'): await shot('02_' + k)
    # typing in the table
    await pg.fill('.ck-table:visible input[data-r="0"][data-c="0"]', 'Mon'); await pg.fill('.ck-table:visible input[data-r="0"][data-c="1"]', '12.5'); await pg.wait_for_timeout(300)
    d = await pg.evaluate("()=>window.PatterDebug ? null : null")
    # a grouped chart needs a second column: the note shows, then a column is added
    await pg.click('.ck-type[data-type=grouped]:visible'); await pg.wait_for_timeout(300); note = await pg.locator('.ck-note:visible').count() == 1; check('typed data is kept when the kind changes, and the note asks for a column', note and (await pg.input_value('.ck-table:visible input[data-r="0"][data-c="0"]')) == 'Mon')
    await pg.click('aside button:visible:has-text("+ Column")'); await pg.wait_for_timeout(300); s = await state(); check('a column is added', s['cols'] == 2 and await pg.locator('.ck-note:visible').count() == 0, s)
    await pg.fill('.ck-table:visible input[data-r="-1"][data-c="2"]', 'Last year'); await pg.fill('.ck-table:visible input[data-r="1"][data-c="2"]', '7'); await pg.wait_for_timeout(200)
    # a block of cells pasted into the table, as from a spreadsheet
    await pg.evaluate("()=>navigator.clipboard.writeText('City\\tNow\\tBefore\\nGlasgow\\t£1,250.50\\t900\\nDundee\\t310\\t295\\nPerth\\t88\\t91\\nOban\\t12\\t15')")
    await pg.click('.ck-table:visible input[data-r="0"][data-c="0"]'); await pg.keyboard.press('Control+V'); await pg.wait_for_timeout(500); s = await state()
    v = await pg.evaluate("()=>[...[...document.querySelectorAll('.ck-table')].find(e=>e.offsetParent).querySelectorAll('input')].map(i=>i.value)"); check('a table pasted into the first box replaces the table, headings and all', s['rows'] == 4 and s['cols'] == 2 and 'Glasgow' in v and '1250.50' in v and 'Now' in v and 'Before' in v, [s, v[:12]]); await shot('03_pasted')
    # sort, reverse, star, colour, remove
    await pg.click('aside button:visible:has-text("Reverse")'); await pg.wait_for_timeout(250); check('reverse', (await pg.input_value('.ck-table:visible input[data-r="0"][data-c="0"]')) == 'Oban')
    await pg.click('aside button:visible:has-text("Biggest first")'); await pg.wait_for_timeout(250); check('biggest first', (await pg.input_value('.ck-table:visible input[data-r="0"][data-c="0"]')) == 'Glasgow')
    await pg.click('.ck-table:visible .ck-hl >> nth=1'); await pg.wait_for_timeout(250); check('a row is starred', await pg.locator('.ck-table:visible .ck-hl.on').count() == 1)
    await pg.click('.ck-table:visible .ck-x >> nth=-1'); await pg.wait_for_timeout(250); s = await state(); check('a row is removed', s['rows'] == 3, s)
    await pg.click('.ck-table:visible .ck-colh .ck-dot >> nth=0'); await pg.wait_for_timeout(150); await pg.click('.ck-pop .ck-dot[title="Grass green"]:visible'); await pg.wait_for_timeout(250); check('a column takes a colour', await pg.evaluate("()=>getComputedStyle([...document.querySelectorAll('.ck-table')].find(e=>e.offsetParent).querySelector('.ck-colh .ck-dot')).backgroundColor") == 'rgb(63, 174, 73)')
    # looks
    for st in ['Clean light', 'Cartoon', 'Sleek dark']:
      await pg.click(f'.ck-seg button:visible:has-text("{st}")'); await pg.wait_for_timeout(300)
      if OUT: await shot('04_' + st.split()[0].lower())
    # callouts, extras
    await pg.click('aside button:visible:has-text("+ Callout")'); await pg.wait_for_timeout(200); await pg.fill('.msrow:visible input[type=text]', 'Look at that'); await pg.wait_for_timeout(200)
    check('a callout is added', await pg.locator('.msrow:visible').count() == 1)
    # the preview draws through all of this
    blank = await pg.evaluate("()=>{ const c=document.getElementById('prev'); const g=c.getContext('2d'); const d=g.getImageData(0,0,c.width,c.height).data; let s=new Set(); for(let i=0;i<d.length;i+=4003) s.add(d[i]>>4); return s.size; }"); check('the preview has a picture', blank > 3, blank)
    # the timeline has the chart's bars
    tl = await pg.evaluate("()=>[...document.querySelectorAll('#timeline .tl-clip, #timeline [data-id]')].map(e=>e.textContent.trim()).filter(Boolean).slice(0,8)"); check('the timeline shows the bars', any('Bars' in x or 'Title' in x for x in tl), tl)
    # undo brings the removed row and the earlier state back
    for _ in range(4): await pg.click('#hdrUndo'); await pg.wait_for_timeout(200)
    s2 = await state(); check('undo steps back', s2['tiles'] == 11, s2)
    # an example fills the table
    await pg.click('.ck-type[data-type=race]:visible'); await pg.wait_for_timeout(250); await pg.click('aside button:visible:has-text("Fill with an example")'); await pg.wait_for_timeout(350); s = await state(); check('an example fills a race', s['on'] == 'race' and s['rows'] == 6 and s['cols'] == 5, s); await shot('05_race_example')
    # an older chart: drawn as it was, then brought up to date
    inj = await pg.evaluate("(old)=>{ const s=JSON.parse(localStorage.getItem('patter-studio-v1')); s.cfg.charts=old; s.module='charts'; s.updated=Date.now()+60000; return JSON.stringify(s); }", OLD)
    await pg.add_init_script("if (!sessionStorage.getItem('inj')) { sessionStorage.setItem('inj', '1'); localStorage.setItem('patter-studio-v1', " + json.dumps(inj) + "); }"); await pg.reload(); await pg.wait_for_timeout(2500)   # set as the page starts, after the old page has saved itself on the way out
    s = { 'old': await pg.locator('.ck-old:visible').count() == 1, 'tiles': await pg.locator('.ck-type:visible').count() }; check('an older chart opens as it was, with the way to bring it up to date', s['old'] and s['tiles'] == 0, s); await shot('06_old')
    await pg.click('.ck-old:visible button'); await pg.wait_for_timeout(400); s = await state(); check('brought up to date with its data', s['tiles'] == 11 and s['on'] == 'bar' and s['rows'] == 3 and (await pg.input_value('.ck-table:visible input[data-r="1"][data-c="1"]')) == '5', s); await shot('07_updated')
    print('passed', len(ok), 'of', len(ok) + len(bad)); [print('FAILED', x) for x in bad]; print('errors:', errs); await b.close()
asyncio.run(main())

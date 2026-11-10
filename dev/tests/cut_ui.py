# Drives the Video tab's editor with the real mouse and keyboard and checks the timeline after each step.
# Needs dev/tmp_cut/ (long.mp4, vp9opus.mp4, red.png, tone.mp3: see CLAUDE.md for how to make them).
import asyncio, sys, json, os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); FX=os.path.join(os.path.dirname(HERE),'tmp_cut')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server','--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)+' | '+' / '.join((e.stack or '').split('\n')[1:3])))
        pg.on('console',lambda m: errs.append(m.type+': '+m.text[:300]) if m.type=='error' and 'ERR_' not in m.text and 'Failed to load' not in m.text else None)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{ window.showSaveFilePicker=undefined; window.showDirectoryPicker=undefined; }")
        await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(800)
        C=lambda js: pg.evaluate("()=>{ const c=Video.hooks.cfg(); return ("+js+"); }")
        res={}
        def ok(name, cond, info=''):
            res[name]=bool(cond); print(('PASS ' if cond else 'FAIL ')+name, info, flush=True)
        # 1. import through the file picker
        await pg.set_input_files('.cut-lib input[type=file]', [os.path.join(FX,f) for f in ['long.mp4','vp9opus.mp4','red.png','tone.mp3']])
        for i in range(60):
            n=await pg.evaluate("()=>document.querySelectorAll('.cl-card').length")
            if n>=4: break
            await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(2500)
        ok('import shows 4 cards', n>=4, n)
        # start from an empty main track
        await pg.evaluate("()=>{ const c=Video.hooks.cfg(); c.items=[]; c.tracks=[]; PatterCut.ui.build(); }")
        # 2. drag a card from the library onto the main lane
        card=pg.locator('.cl-card').filter(has_text='long.mp4').first; lane=pg.locator('.ct-row.k-main .ct-lane')
        await card.drag_to(lane, target_position={'x':40,'y':30}); await pg.wait_for_timeout(600)
        ok('drag to main track', await C("c.items.length===1 && c.items[0].kind==='media'"), await C("c.items.map(i=>i.kind)"))
        # add the second video at the playhead end via + button
        await pg.evaluate("()=>PatterCut.player.seek(100)"); await pg.locator('.cl-card').filter(has_text='vp9opus.mp4').first.hover(); await pg.locator('.cl-card').filter(has_text='vp9opus.mp4').locator('.add').click(); await pg.wait_for_timeout(500)
        ok('add with + goes on the main track', await C("c.items.length===2"), await C("c.items.map(i=>i.src1)"))
        # 3. split with S at 2 s
        await pg.evaluate("()=>{ PatterCut.player.pause(); PatterCut.player.seek(2); PatterCut.select(null); }"); await pg.mouse.click(5,5); await pg.keyboard.press('s'); await pg.wait_for_timeout(400)
        ok('split at 2 s', await C("c.items.length===3 && Math.abs(c.items[0].src1-2)<0.01 && Math.abs(c.items[1].src0-2)<0.01"), await C("c.items.map(i=>[i.src0,i.src1])"))
        # 4. trim the right edge of the first clip by dragging its handle 0.5 s left
        el=pg.locator('.ct-row.k-main .ct-clip').first; box=await el.bounding_box(); pps=await pg.evaluate("()=>PatterCut.ui.pps")
        await pg.mouse.move(box['x']+box['width']-3, box['y']+box['height']/2); await pg.mouse.down(); await pg.mouse.move(box['x']+box['width']-3-pps*0.5, box['y']+box['height']/2, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(400)
        ok('trim right edge', await C("Math.abs(c.items[0].src1-1.5)<0.08"), await C("c.items[0].src1"))
        # 5. trim the left edge of the second clip 0.4 s right
        el=pg.locator('.ct-row.k-main .ct-clip').nth(1); box=await el.bounding_box()
        await pg.mouse.move(box['x']+3, box['y']+box['height']/2); await pg.mouse.down(); await pg.mouse.move(box['x']+3+pps*0.4, box['y']+box['height']/2, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(400)
        ok('trim left edge', await C("Math.abs(c.items[1].src0-2.4)<0.08"), await C("c.items[1].src0"))
        # 6. picture onto a new overlay track by dragging to the drop zone above
        card=pg.locator('.cl-card').filter(has_text='red.png').first; nz=pg.locator('.ct-newrow .ct-lane')
        await card.drag_to(nz, target_position={'x':pps*1+5,'y':6}); await pg.wait_for_timeout(500)
        ok('picture onto a new overlay track', await C("(c.tracks||[]).some(T=>T.kind==='video'&&T.items.length===1)"), await C("(c.tracks||[]).map(T=>[T.kind,T.items.length,T.items[0]&&T.items[0].start])"))
        # 7. move the overlay clip 1 s later by dragging its body
        el=pg.locator('.ct-row.k-video .ct-clip').first; box=await el.bounding_box(); s0=await C("c.tracks.find(T=>T.kind==='video').items[0].start")
        await pg.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); await pg.mouse.down(); await pg.mouse.move(box['x']+box['width']/2+pps*1.0, box['y']+box['height']/2, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(400)
        s1=await C("c.tracks.find(T=>T.kind==='video').items[0].start"); ok('move overlay clip 1 s later', abs(s1-s0-1)<0.12, [s0,s1])
        # 8. sound onto an audio track
        card=pg.locator('.cl-card').filter(has_text='tone.mp3').first
        await card.hover(); await card.locator('.add').click(); await pg.wait_for_timeout(500)
        ok('sound onto an audio track', await C("(c.tracks||[]).some(T=>T.kind==='audio'&&T.items.length===1)"))
        # 9. drag the overlay picture down into the main track
        el=pg.locator('.ct-row.k-video .ct-clip').first; box=await el.bounding_box(); mb=await pg.locator('.ct-row.k-main .ct-lane').bounding_box()
        await pg.mouse.move(box['x']+10, box['y']+box['height']/2); await pg.mouse.down(); await pg.mouse.move(mb['x']+2, mb['y']+mb['height']/2, steps=10); await pg.mouse.up(); await pg.wait_for_timeout(500)
        ok('overlay into the main track (first)', await C("c.items[0].kind==='media' && CutMedia.info(c.items[0].asset).kind==='image' && !(c.tracks||[]).some(T=>T.kind==='video')"), await C("c.items.map(i=>CutMedia.info(i.asset).kind)"))
        # 10. transition: click the diamond between the first two clips
        await pg.locator('.ct-tr').first.click(); await pg.wait_for_timeout(400)
        ok('transition added', await C("!!(c.items[0].tr&&c.items[0].tr.k)"))
        await pg.locator('#inspector .cl-tile', has_text='Wipe left').click(); await pg.wait_for_timeout(300)
        ok('transition changed in the panel', await C("c.items[0].tr.k==='wipeL'"))
        # 11. select a clip and change the scale with the slider
        await pg.locator('.ct-row.k-main .ct-clip').nth(1).click(); await pg.wait_for_timeout(300)
        await pg.locator('#inspector .cs-tabs button', has_text='Video').click(); await pg.wait_for_timeout(200)
        sl=pg.locator('#inspector .cs-row', has_text='Scale').locator('input.cs-num'); await sl.fill('50%'); await sl.press('Enter'); await pg.wait_for_timeout(300)
        ok('scale set from the panel', await C("Math.abs(c.items[1].s-0.5)<0.01"), await C("c.items[1].s"))
        # keyframe: diamond at 1 s, move, set another value
        await pg.evaluate("()=>{ const c=Video.hooks.cfg(); const p=Video.allPlaced(c,{format:'16:9'}).find(q=>q.it===c.items[1]); PatterCut.player.seek(p.t0+0.1); }"); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>PatterCut.select(PatterCut.ui ? 'C:'+Video.hooks.cfg().items[1].id : null)"); await pg.wait_for_timeout(200)
        await pg.locator('#inspector .cs-row', has_text='Scale').locator('.kd').click(); await pg.wait_for_timeout(200)
        ok('keyframe added', await C("c.items[1].kf && c.items[1].kf.s && c.items[1].kf.s.length===1"))
        # 12. delete the middle clip with Delete, then undo
        n0=await C("c.items.length"); await pg.locator('.ct-row.k-main .ct-clip').nth(1).click(); await pg.keyboard.press('Delete'); await pg.wait_for_timeout(400)
        ok('delete', await C("c.items.length")==n0-1)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
        ok('undo brings it back', await C("c.items.length")==n0)
        # 13. colour look from the library onto the selected clip
        await pg.locator('.ct-row.k-main .ct-clip').nth(1).click(); await pg.click('.cl-tabs button:has-text("Filters")'); await pg.wait_for_timeout(300)
        await pg.locator('.cl-tile', has_text='Cinematic').click(); await pg.wait_for_timeout(300)
        ok('look applied', await C("c.items[1].col && c.items[1].col.look==='cine'"))
        # 14. effect
        await pg.click('.cl-tabs button:has-text("Effects")'); await pg.locator('.cl-tile', has_text='VHS').click(); await pg.wait_for_timeout(300)
        ok('effect applied', await C("(c.items[1].fx||[]).some(f=>f.k==='vhs')"))
        # 15. a Patter clip from the library
        await pg.click('.cl-tabs button:has-text("Patter")'); await pg.evaluate("()=>PatterCut.player.seek(0)"); await pg.locator('.cl-tile', has_text='Chart').click(); await pg.wait_for_timeout(400)
        ok('Patter chart clip added', await C("c.items.some(i=>i.kind==='clip'&&i.mod==='charts')"))
        # 16. sound effect made and added
        await pg.click('.cl-tabs button:has-text("Audio")'); await pg.locator('.cl-tile', has_text='Whoosh').click()
        for i in range(30):
            if await C("(c.tracks||[]).filter(T=>T.kind==='audio').reduce((a,T)=>a+T.items.length,0)>=2"): break
            await pg.wait_for_timeout(300)
        ok('sound effect made and placed', await C("(c.tracks||[]).filter(T=>T.kind==='audio').reduce((a,T)=>a+T.items.length,0)>=2"))
        # 17. play for a second: no errors, the playhead moves
        await pg.keyboard.press('Escape'); t0=await pg.evaluate("()=>PatterCut.player.t"); await pg.keyboard.press('Space'); await pg.wait_for_timeout(1200); await pg.keyboard.press('Space'); t1=await pg.evaluate("()=>PatterCut.player.t")
        ok('plays', t1-t0>0.6, [t0,t1])
        # 18. export from the dialog (MP4 at 720p), and check the file
        async with pg.expect_download(timeout=240000) as dl:
            await pg.click('.cut-x'); await pg.wait_for_timeout(400)
            await pg.locator('dialog select').nth(1).select_option('720'); await pg.locator('dialog button.primary', has_text='Export').click()
        d=await dl.value; path='/tmp/claude-0/cut/ui_export.mp4'; await d.save_as(path)
        st=await pg.locator('dialog .hint').first.inner_text(); ok('export finished', 'Done' in st, st)
        await pg.screenshot(path='/tmp/claude-0/cut/ui_after.png')
        print('ERRORS', errs[:10]); print('SUMMARY', sum(res.values()), '/', len(res)); await b.close()
asyncio.run(main())

# Random clicking, dragging and typing all over the Video tab's editor with real footage loaded.
# After every few actions: no errors, and the video's settings still make sense and draw.
import asyncio, random, sys, os
from playwright.async_api import async_playwright
N=int(sys.argv[1]) if len(sys.argv)>1 else 300; SEED=int(sys.argv[2]) if len(sys.argv)>2 else 1
HERE=os.path.dirname(os.path.abspath(__file__)); FX=os.path.join(os.path.dirname(HERE),'tmp_cut')
PICK=r"""(seed)=>{ const els=[...document.querySelectorAll('.cut-lib button, .cut-lib select, .ct-bar button, .ct-bar input, #inspector button, #inspector input, #inspector select, #inspector textarea, .ct-h button, .ct-tr')].filter(e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&!e.disabled&&e.type!=='file'&&!/Delete track|Remove from|Delete project|Find/.test(e.textContent||e.title||''); });
 if(!els.length) return null; const e=els[Math.floor(seed*els.length)]; e.scrollIntoView({block:'center'}); const tag=e.tagName.toLowerCase(), ty=(e.type||'').toLowerCase(); let what=tag+':'+((e.textContent||e.title||e.getAttribute('aria-label')||'').trim().slice(0,28)); const R=Math.random;
 if(tag==='select'){ const o=e.options; if(o.length){ e.selectedIndex=Math.floor(R()*o.length); e.dispatchEvent(new Event('change',{bubbles:true})); what+='='+e.value; } }
 else if(ty==='range'){ const mn=+e.min||0,mx=+e.max||100; e.value=mn+R()*(mx-mn); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); what+='='+(+e.value).toFixed(2); }
 else if(ty==='checkbox'){ e.click(); }
 else if(ty==='color'){ e.value='#'+Math.floor(R()*0xffffff).toString(16).padStart(6,'0'); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }
 else if(tag==='input'||tag==='textarea'){ const v=['12','-5','99999','','abc','0.5','Ach 💥'][Math.floor(R()*7)]; e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); what+='="'+v+'"'; }
 else e.click();
 return what; }"""
CHECK=r"""()=>{ const c=Video.hooks.cfg(), look={scheme:'saltire',format:'16:9',preview:true}, bad=[]; const M=Layers.wrap(Video); let d; try{ d=M.duration(c,look); }catch(e){ bad.push('dur '+e.message); } if(!(d>0&&isFinite(d))) bad.push('dur '+d);
  const ids=new Set(); Video.allPlaced(c,look).forEach(p=>{ const it=p.it; if(ids.has(it.id)) bad.push('dup id '+it.id); ids.add(it.id); if(!(p.d>0&&isFinite(p.d))) bad.push('len '+it.kind+' '+p.d); if(!(p.t0>=0&&isFinite(p.t0))) bad.push('t0 '+p.t0); if(it.src0!=null&&it.src1!=null&&!(it.src1>it.src0)) bad.push('src '+it.src0+'>'+it.src1); });
  (c.tracks||[]).forEach(T=>{ (T.items||[]).forEach(it=>{ if(T.kind==='audio'&&it.kind!=='audio') bad.push('picture on an audio track'); if(T.kind==='video'&&it.kind==='audio') bad.push('sound on a video track'); }); });
  const cv=document.createElement('canvas'); cv.width=320; cv.height=180; const g=cv.getContext('2d'); for(let i=0;i<=6;i++){ try{ g.setTransform(320/1920,0,0,180/1080,0,0); M.draw(g,(d||5)*i/6,c,look,1920,1080); }catch(e){ bad.push('draw '+e.message+' '+(e.stack||'').split('\n')[1]); break; } }
  return bad; }"""
async def main():
    random.seed(SEED)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server','--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':1600,'height':960}); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)+' | '+' / '.join((e.stack or '').split('\n')[1:3])))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.text[:300]) if m.type=='error' and 'ERR_' not in m.text and 'Failed to load' not in m.text else None)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept('x') if d.type=='prompt' else d.accept()))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{ window.showSaveFilePicker=undefined; window.showDirectoryPicker=undefined; window.EyeDropper=undefined; }")
        await pg.click('button[data-mod=video]'); await pg.wait_for_timeout(600)
        await pg.set_input_files('.cut-lib input[type=file]', [os.path.join(FX,f) for f in ['long.mp4','vp9opus.mp4','red.png','tone.mp3']]); await pg.wait_for_timeout(5000)
        await pg.evaluate("()=>{ const ids=Video.hooks.cfg().bin; ids.forEach((id,i)=>PatterCut.ui.placeAsset(id, i*2, i===2?{kind:'video',T:null}:null)); PatterCut.ui.build(); }")
        trace=[]; e0=0; bad_states=0
        for i in range(N):
            r=random.random()
            if r<0.55: w=await pg.evaluate(PICK, random.random())
            elif r<0.8:
                clips=await pg.evaluate("()=>[...document.querySelectorAll('.ct-clip')].map(c=>{const b=c.getBoundingClientRect(); return [b.x,b.y,b.width,b.height];}).filter(b=>b[2]>2&&b[1]>0)")
                if clips:
                    x,y,wd,ht=random.choice(clips); part=random.choice(['l','r','m','m']); sx = x+3 if part=='l' else x+wd-3 if part=='r' else x+wd/2
                    await pg.mouse.move(sx,y+ht/2); await pg.mouse.down(); await pg.mouse.move(sx+random.uniform(-200,200), y+ht/2+random.choice([0,0,-60,60]), steps=5); await pg.mouse.up(); w='drag '+part
                else: w='no clips'
            elif r<0.92:
                k=random.choice(['s','Delete','Shift+Delete','q','w','f','m','ArrowUp','ArrowDown','Control+z','Control+y','Control+c','Control+v','Control+d','Escape','+','-','Space']); await pg.keyboard.press(k); w='key '+k
                if k=='Space': await pg.wait_for_timeout(300); await pg.keyboard.press('Space')
            else:
                await pg.evaluate("()=>{ PatterCut.player.pause(); PatterCut.player.seek(Math.random()*Layers.wrap(Video).duration(Video.hooks.cfg(),{format:'16:9'})); }"); w='seek'
            trace.append(w); await pg.wait_for_timeout(40)
            if i%10==9:
                await pg.wait_for_timeout(400); bad=await pg.evaluate(CHECK)
                if bad: bad_states+=1; print('BAD STATE after', trace[-5:], bad[:4], flush=True)
            if len(errs)>e0: print('ERROR after', trace[-4:], errs[e0:][:3], flush=True); e0=len(errs)
        print('done', N, 'actions; errors', len(errs), '; bad states', bad_states); await b.close()
asyncio.run(main())

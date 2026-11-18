"""Contact sheets of every transition and effect, to judge them by eye. usage: fx_sheet.py OUTDIR [port] [kinds,comma]
For each transition: six moments across it between two real pictures (his studio and a chart). For each effect: three moments."""
import asyncio, sys, os, base64, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8765'; ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None; os.makedirs(OUT, exist_ok=True)
SETUP = """async()=>{ if(Studio.ready) await Studio.ready(); if(typeof PatterFonts!=='undefined') await PatterFonts.ready(); const W=1280,H=720;
  const mk=(M,cfg,t,look)=>{ const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'); const k=W/1920; g.setTransform(k,0,0,k,0,0); Layers.wrap(M).draw(g,t,cfg,Object.assign({format:'16:9',texture:true},look),1920,1080); return c; };
  window.__A=(window.FX_A==='studio')?mk(Studio,Studio.defaults(),3,{}):mk(News,News.defaults(),6.5,{scheme:'saltire'}); window.__B=mk(Charts,Charts.defaults(),6,{scheme:'saltire'}); window.__W=W; window.__H=H;
  return { pro: Video.PRO, all: Object.keys(Video.TRANS).filter(k=>k!=='none'), len: Video.TRLEN, fx: Object.keys(CutGL.EFFECTS) }; }"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:200]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    if os.environ.get('FX_A'): await pg.add_init_script("window.FX_A='" + os.environ['FX_A'] + "';")
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(2500)
    info = await pg.evaluate(SETUP); json.dump(info, open(OUT + '/info.json', 'w'))
    kinds = [k for k in info['all'] if not ONLY or k in ONLY]
    for i0 in range(0, len(kinds), 6):
      part = kinds[i0:i0 + 6]
      d = await pg.evaluate("""([kinds,len])=>{ const W=window.__W,H=window.__H, N=6, tw=320, th=180, c=document.createElement('canvas'); c.width=tw*N+150; c.height=th*kinds.length; const g=c.getContext('2d'); g.fillStyle='#10141f'; g.fillRect(0,0,c.width,c.height);
        const f=document.createElement('canvas'); f.width=W; f.height=H; const fg=f.getContext('2d');
        kinds.forEach((k,r)=>{ for(let i=0;i<N;i++){ const p=(i+0.5)/N; fg.setTransform(1,0,0,1,0,0); fg.clearRect(0,0,W,H); try{ Video.transition(fg,window.__A,window.__B,k,p,W,H,{dur:len[k]||0.5,hq:true}); }catch(e){ fg.fillStyle='#600'; fg.fillRect(0,0,W,H); } g.drawImage(f,150+i*tw,r*th,tw,th); }
          g.fillStyle='#fff'; g.font='bold 17px sans-serif'; g.fillText(k,8,r*th+26); g.font='13px sans-serif'; g.fillStyle='#9aa'; g.fillText(Video.TRANS[k]||'',8,r*th+46); g.fillText((len[k]||0.5)+' s',8,r*th+64); });
        return c.toDataURL('image/jpeg',0.86).split(',')[1]; }""", [part, info['len']])
      open(f"{OUT}/tr_{i0 // 6:02d}.jpg", 'wb').write(base64.b64decode(d))
    if not ONLY or 'fx' in ONLY:
      fx = info['fx']
      for i0 in range(0, len(fx), 6):
        part = fx[i0:i0 + 6]
        d = await pg.evaluate("""(kinds)=>{ const W=window.__W,H=window.__H, N=4, tw=320, th=180, c=document.createElement('canvas'); c.width=tw*N+150; c.height=th*kinds.length; const g=c.getContext('2d'); g.fillStyle='#10141f'; g.fillRect(0,0,c.width,c.height);
          kinds.forEach((k,r)=>{ for(let i=0;i<N;i++){ const t=[0.1,0.37,0.81,1.52][i]; const P=CutGL.params({fx:[{k,amt:60}]},t); let o=null; try{ o=CutGL.process(window.__A,W,H,W,H,P); }catch(e){} g.drawImage(o||window.__A,150+i*tw,r*th,tw,th); }
            g.fillStyle='#fff'; g.font='bold 17px sans-serif'; g.fillText(k,8,r*th+26); g.font='13px sans-serif'; g.fillStyle='#9aa'; g.fillText(CutGL.EFFECTS[k].label,8,r*th+46); });
          return c.toDataURL('image/jpeg',0.86).split(',')[1]; }""", part)
        open(f"{OUT}/fx_{i0 // 6:02d}.jpg", 'wb').write(base64.b64decode(d))
    print('pro', info['pro']); print('fx', info['fx']); await b.close()
asyncio.run(main())

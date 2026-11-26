"""clip.py PORT OUTDIR [t0] [t1] [fps]  : frames of his character saying a recording (default his own, with what was heard), drawn by the module.
env: WAV, HEARD (urls on the test server), CFG (json over the defaults), W (width, default 960), CROP (x0,y0,x1,y1 in puppet px at 1920 wide frame fractions)"""
import asyncio, sys, os, json, base64
from playwright.async_api import async_playwright
PORT, OUT = sys.argv[1], sys.argv[2]; T0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0; T1 = float(sys.argv[4]) if len(sys.argv) > 4 else 0; FPS = int(sys.argv[5]) if len(sys.argv) > 5 else 30
WAV = os.environ.get('WAV', '/tmp_me.wav'); HEARD = os.environ.get('HEARD', '/tmp_heard_me.json'); CFG = json.loads(os.environ.get('CFG', '{}')); W = int(os.environ.get('W', 960)); CROP = [float(v) for v in os.environ['CROP'].split(',')] if os.environ.get('CROP') else [0, 0, 1, 1]
os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1280, 'height': 800}); pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:200]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(1500)
    info = await pg.evaluate("""async([wav,heardUrl,over])=>{ let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet')); try { rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob()); } catch (e) { }
      const voice = wav === 'none' ? { id: '' } : await CutMedia.importFile(new File([await (await fetch(wav)).blob()], 'voice.wav', { type: 'audio/wav' })); let heard = null; try { heard = await (await fetch(heardUrl)).json(); } catch (e) { }
      if (heard && voice.id && typeof Listen !== 'undefined' && Listen.keepHeard) Listen.keepHeard(voice.id, heard.words, 0, heard.text);
      const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: heard ? heard.text : '' }, over || {}); await Character.prepare(c); window.__c = c; return { dur: Character.duration(c) }; }""", [WAV, HEARD, CFG])
    t1 = T1 or info['dur']; i0, i1 = int(T0 * FPS), int(t1 * FPS); H = round(W * 9 / 16)
    cw, ch = round(W * (CROP[2] - CROP[0])), round(H * (CROP[3] - CROP[1]))
    for a in range(i0, i1, 20):
      fr = await pg.evaluate("""async([a,b,fps,W,H,cx,cy,cw,ch])=>{ const out=[]; const cv=window.__cv||(window.__cv=document.createElement('canvas')); cv.width=cw; cv.height=ch; const g=cv.getContext('2d'), k=W/1920;
        for(let i=a;i<b;i++){ g.setTransform(k,0,0,k,-cx,-cy); g.clearRect(0,0,1920,1080); Character.draw(g,i/fps,window.__c,{format:'16:9'},1920,1080); out.push(cv.toDataURL('image/jpeg',0.9).split(',')[1]); } return out; }""", [a, min(i1, a + 20), FPS, W, H, round(W * CROP[0]), round(H * CROP[1]), cw, ch])
      for k, d in enumerate(fr): open(f'{OUT}/f{a + k:05d}.jpg', 'wb').write(base64.b64decode(d))
    print('frames', i0, i1, 'dur %.2f' % info['dur']); await b.close()
asyncio.run(main())

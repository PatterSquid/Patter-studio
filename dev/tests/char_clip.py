"""Frames of his character saying a recording, drawn by the module itself, for a preview clip.
usage: char_clip.py PORT OUTDIR [/recording.wav] [/heard.json] [fps] [seconds]
Reads dev/tmp_puppet.puppet and dev/tmp_hands/sheet.png. The script is what was heard; on a build with the listener's word
times they are handed over so nothing has to be listened to again."""
import asyncio, sys, os, json, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1]; OUT = sys.argv[2]; WAV = sys.argv[3] if len(sys.argv) > 3 else '/tmp_me.wav'; HEARD = sys.argv[4] if len(sys.argv) > 4 else '/tmp_heard_me.json'; FPS = int(sys.argv[5]) if len(sys.argv) > 5 else 30; SECS = float(sys.argv[6]) if len(sys.argv) > 6 else 0
os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1280, 'height': 800}); pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:200]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(2000)
    info = await pg.evaluate("""async([wav,heardUrl])=>{ let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet')); try { rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob()); } catch (e) { }
      const voice = await CutMedia.importFile(new File([await (await fetch(wav)).blob()], 'voice.wav', { type: 'audio/wav' })); const heard = await (await fetch(heardUrl)).json();
      if (typeof Listen !== 'undefined' && Listen.keepHeard) Listen.keepHeard(voice.id, heard.words, 0, heard.text);
      const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: heard.text }); await Character.prepare(c); window.__c = c; const A = Character.syncOf(c);
      return { dur: Character.duration(c), pinned: A && A.pinned, words: A && A.words.length, wl: A.words.map(w => [w[0], w[1], w[2]]) }; }""", [WAV, HEARD])
    print('dur', round(info['dur'], 2), 'pinned', info['pinned'], 'words', info['words']); json.dump(info['wl'], open(OUT + '/words.json', 'w'))
    n = int((SECS or info['dur']) * FPS)
    for i0 in range(0, n, 20):
      fr = await pg.evaluate("""async([i0,i1,fps])=>{ const out=[]; const cv=window.__cv||(window.__cv=document.createElement('canvas')); cv.width=960; cv.height=540; const g=cv.getContext('2d');
        for(let i=i0;i<i1;i++){ g.setTransform(0.5,0,0,0.5,0,0); g.clearRect(0,0,1920,1080); Character.draw(g,i/fps,window.__c,{format:'16:9'},1920,1080); out.push(cv.toDataURL('image/jpeg',0.9).split(',')[1]); } return out; }""", [i0, min(n, i0 + 20), FPS])
      for k, d in enumerate(fr): open(f'{OUT}/f{i0 + k:05d}.jpg', 'wb').write(base64.b64decode(d))
    print('frames', n); await b.close()
asyncio.run(main())

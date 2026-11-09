"""Natural hands: a script with only emotion tags, so every hand movement comes from the planner. Lists the gestures it
chose and why, checks the arms never jump between frames (60 fps), draws each gesture at its height, and exports an MP4
with the voice. Needs dev/tmp_puppet.puppet and dev/tmp_voice2.wav (flite, the script below). Writes to OUT."""
import asyncio, base64, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/char_hands'; os.makedirs(OUT, exist_ok=True)
SCRIPT = "[calm] Hello there. Right, listen. You will not believe this. [angry] They have only gone and shut the chippy! On a Friday! [calm] Why would anybody do that? Honestly, it is a disgrace. [happy] But the new one round the corner is brilliant. So that is the thing."
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1200)
    r = await pg.evaluate("""async(script)=>{ const { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet'));
      const voice = await CutMedia.importFile(new File([await (await fetch('/tmp_voice2.wav')).blob()], 'v.wav', { type: 'audio/wav' }));
      const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script }); await Character.prepare(c); window.__c = c;
      const A = Character.syncOf(c), d = Character.duration(c), p = Character.perfOf(c, A, rig, d), hh = rig.pivot.headH;
      let prev = null, worst = {}, jumps = [];
      for (let i = 0; i <= d * 60; i++) { const t = i / 60, q = Character.poseAt(c, A, rig, p, t), v = {}; ['L', 'R'].forEach(sd => { const a = q.arms[sd] || { dx: 0, dy: 0, rot: 0 }; v[sd + 'x'] = a.dx / hh; v[sd + 'y'] = a.dy / hh; v[sd + 'r'] = a.rot / 3; });
        if (prev) for (const k in v) { const dv = Math.abs(v[k] - prev[k]); worst[k] = Math.max(worst[k] || 0, +dv.toFixed(4)); if (dv > 0.045) jumps.push([k, +t.toFixed(2), +dv.toFixed(3)]); } prev = v; }
      const gest = p.moves.filter(m => m.kind === 'gesture').map(m => [m.k, m.side, +m.start.toFixed(2), +m.end.toFixed(2), m.tag || '']);
      const frames = []; for (const g of gest) { const t = g[2] + 0.5, cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const x = cv.getContext('2d'); x.scale(1/3, 1/3); Character.draw(x, t, c, { format: '16:9' }, 1920, 1080); x.setTransform(1,0,0,1,0,0); x.fillStyle = '#ff0'; x.font = '15px sans-serif'; x.fillText(g[0] + ' ' + g[4] + ' @' + t.toFixed(1), 6, 18); frames.push(cv.toDataURL('image/jpeg', 0.85).split(',')[1]); }
      return { d, gest, worst, jumps: jumps.slice(0, 12), njumps: jumps.length, frames, words: A.words.length }; }""", SCRIPT)
    for i, f in enumerate(r.pop('frames')): open(f'{OUT}/g{i:02d}.jpg', 'wb').write(base64.b64decode(f))
    print(json.dumps(r))
    if '--export' in sys.argv:
      n = await pg.evaluate("""async()=>{ const c = window.__c, v = { v: 2, items: [{ id: 'x', kind: 'clip', mod: 'char', cfg: c, inPt: 0, hold: 0 }], tracks: [] }; const res = await CutExport.run(v, { scheme: 'saltire', format: '16:9' }, { fps: 30, res: '1080', quality: 'high' }); window.__v = res.blob; return res.frames; }""")
      s = await pg.evaluate("async()=>{ const u=new Uint8Array(await window.__v.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s); }")
      open(OUT + '/hands.mp4', 'wb').write(base64.b64decode(s)); print('exported', n)
    print('errors:', errs); await b.close()
asyncio.run(main())

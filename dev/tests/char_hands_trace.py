"""Both hands over a real recording, frame by frame, for looking at the choreography (and a picture of it).
usage: char_hands_trace.py PORT OUT.json [/recording.wav] [/heard.json] [hands]   then   char_hands_trace.py plot OUT.json OUT.png [t0 t1]
Reads dev/tmp_puppet.puppet and dev/tmp_hands/sheet.png (NOSHEET=1 leaves the sheet out). Heights are in head heights, up is up."""
import asyncio, sys, os, json
if sys.argv[1] == 'plot':
  import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
  D = json.load(open(sys.argv[2])); t0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0; t1 = float(sys.argv[5]) if len(sys.argv) > 5 else D['dur']
  F = D['fps']; T = [i / F for i in range(len(D['L']))]; sel = [i for i, t in enumerate(T) if t0 <= t <= t1]; tt = [T[i] for i in sel]
  fig, ax = plt.subplots(4, 1, figsize=(max(12, (t1 - t0) * 1.1), 9), sharex=True)
  for sd, col in (('L', '#d04a2a'), ('R', '#2a6fd0')):
    a = D[sd]; ax[0].plot(tt, [-a[i][1] for i in sel], color=col, label=('left (screen right)' if sd == 'L' else 'right (by the mic)')); ax[1].plot(tt, [a[i][0] * (1 if sd == 'L' else -1) for i in sel], color=col); ax[2].plot(tt, [a[i][2] * (1 if sd == 'L' else -1) for i in sel], color=col)
    last = None
    for i in sel:
      if a[i][3] != last: last = a[i][3]; ax[0].annotate(last or 'desk', (T[i], -a[i][1]), fontsize=6, color=col, rotation=45)
  ax[0].set_ylabel('height'); ax[1].set_ylabel('outwards'); ax[2].set_ylabel('turn'); ax[0].legend(loc='upper right', fontsize=7)
  ax[3].fill_between(tt, [D['env'][i] for i in sel], color='#888'); ax[3].plot(tt, [-D['head'][i] * 6 for i in sel], color='#2a2', lw=0.8)
  for w in D['words']:
    if t0 <= w[0] <= t1: ax[3].annotate(w[2], (w[0], 1.02), fontsize=6, rotation=60)
  for n in D['nods']:
    if t0 <= n[0] <= t1:
      for k in range(3): ax[k].axvline(n[0], color='#bbb', lw=0.5 + n[1])
  for m in D['moves']:
    if m[2] > t0 and m[1] < t1: ax[3].plot([m[1], m[2]], [-0.25 - 0.08 * (hash(m[0]) % 4)] * 2, color='#d04a2a' if m[3] == 'L' else '#2a6fd0' if m[3] == 'R' else '#7a3fb0', lw=3); ax[3].annotate(m[0], (max(m[1], t0), -0.25 - 0.08 * (hash(m[0]) % 4)), fontsize=6)
  ax[3].set_ylim(-0.6, 1.6); plt.tight_layout(); plt.savefig(sys.argv[3], dpi=90); sys.exit()
from playwright.async_api import async_playwright
PORT = sys.argv[1]; OUT = sys.argv[2]; WAV = sys.argv[3] if len(sys.argv) > 3 else '/tmp_me.wav'; HEARD = sys.argv[4] if len(sys.argv) > 4 else '/tmp_heard_me.json'; HANDS = sys.argv[5] if len(sys.argv) > 5 else ''
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(viewport={'width': 1280, 'height': 800}); pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:200]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(2000)
    D = await pg.evaluate("""async([wav,heardUrl,hands,nosheet])=>{ let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet')); if (!nosheet) try { rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob()); } catch (e) { }
      const voice = await CutMedia.importFile(new File([await (await fetch(wav)).blob()], 'voice.wav', { type: 'audio/wav' })); let heard = null; try { heard = await (await fetch(heardUrl)).json(); } catch (e) { }
      if (heard && typeof Listen !== 'undefined' && Listen.keepHeard) Listen.keepHeard(voice.id, heard.words, 0, heard.text);
      const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: heard ? heard.text : '' }); if (hands) c.hands = hands; await Character.prepare(c);
      const A = Character.syncOf(c), d = Character.duration(c), p = Character.perfOf(c, A, rig, d), hh = rig.pivot.headH, F = 60, n = Math.floor(d * F), out = { fps: F, dur: d, hh, L: [], R: [], env: [], head: [], words: A.words.map(w => [w[0], w[1], w[2]]), nods: p.nods.map(q => [q.t, q.a]), moves: p.moves.filter(m => m.kind === 'gesture').map(m => [m.k, m.start, m.end, m.side, m.at, !!m.auto]) };
      for (let i = 0; i < n; i++) { const t = i / F, P = Character.poseAt(c, A, rig, p, t); ['L', 'R'].forEach(sd => { const a = P.arms[sd]; out[sd].push([+(a.dx / hh).toFixed(4), +(a.dy / hh).toFixed(4), +a.rot.toFixed(4), a.art || '']); }); out.env.push(+(A.env[Math.min(A.env.length - 1, Math.round(t * A.fps))] || 0).toFixed(3)); out.head.push(+(P.head[1] / hh).toFixed(4)); }
      return out; }""", [WAV, HEARD, HANDS, bool(os.environ.get('NOSHEET'))])
    json.dump(D, open(OUT, 'w')); print('dur', round(D['dur'], 2), 'frames', len(D['L']), 'gestures', len(D['moves'])); await b.close()
asyncio.run(main())

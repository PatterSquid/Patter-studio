# trace.py PORT out.json [wav] [heard.json] [cfg json]  : every moving part of the pose, 60 times a second, for the whole recording
import asyncio, sys, json, os
from playwright.async_api import async_playwright
PORT, OUT = sys.argv[1], sys.argv[2]; WAV = sys.argv[3] if len(sys.argv) > 3 else '/tmp_me.wav'; HEARD = sys.argv[4] if len(sys.argv) > 4 else '/tmp_heard_me.json'; CFG = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}
JS = """async([wav,heardUrl,over])=>{ let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet')); try { rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob()); } catch (e) { }
  const voice = await CutMedia.importFile(new File([await (await fetch(wav)).blob()], 'voice.wav', { type: 'audio/wav' })); let heard = null; try { heard = await (await fetch(heardUrl)).json(); } catch (e) { }
  if (heard && typeof Listen !== 'undefined' && Listen.keepHeard) Listen.keepHeard(voice.id, heard.words, 0, heard.text);
  const c = Object.assign(Character.defaults(), { puppet: rig.id, voice: voice.id, script: heard ? heard.text : '' }, over || {}); await Character.prepare(c); const A = Character.syncOf(c), dur = Character.duration(c), p = Character.perfOf(c, A, rig, dur), hh = rig.pivot.headH;
  const ch = {}, put = (k, v) => (ch[k] = ch[k] || []).push(typeof v === 'number' ? +v.toFixed(4) : v), n = Math.floor(dur * 60);
  for (let i = 0; i < n; i++) { const q = Character.poseAt(c, A, rig, p, i / 60); put('hx', q.head[0] / hh); put('hy', q.head[1] / hh); put('hr', q.head[2]); put('hl', q.head[3]); put('sx', q.sit[0] / hh); put('sr', q.sit[1]); put('bL', q.brow.L[1]); put('bR', q.brow.R[1]); put('bLr', q.brow.L[2]); put('blink', q.blink || 0); put('lid', q.lid || 0); put('jaw', q.jaw || 0);
    put('tx', q.turn ? q.turn[0] / hh : 0); put('ty', q.turn ? q.turn[1] / hh : 0); put('px', q.pupil[0]); put('py', q.pupil[1]); put('br', q.body[0]); put('mouth', q.mouth); put('view', q.view);
    ['L', 'R'].forEach(sd => { const a = q.arms[sd] || {}; put('a' + sd + 'x', (a.dx || 0) / hh); put('a' + sd + 'y', (a.dy || 0) / hh); put('a' + sd + 'r', a.rot || 0); put('a' + sd + 'art', a.art || ''); }); }
  const moves = (p.moves || []).map(m => ({ k: m.k, kind: m.kind, start: +m.start.toFixed(2), end: +(m.end || 0).toFixed(2), at: m.at != null ? +m.at.toFixed(2) : null, side: m.side || '', pri: m.pri || 0 }));
  return { dur, hh, words: A ? A.words.map(w => [w[0], w[1], w[2]]) : [], vis: A ? A.visemes.map(v => [+v[0].toFixed(3), v[1]]) : [], ch, moves, blinks: p.blinks, glances: p.glances, nods: p.nods.map(n => [+n.t.toFixed(2), +n.a.toFixed(2)]), phrases: p.phrases.map(q => [+q.a.toFixed(2), +q.b.toFixed(2)]), ips: p.pros ? p.pros.ips.map(q => [+q.a.toFixed(2), +q.b.toFixed(2), q.sent ? 1 : 0]) : [], pinned: A && A.pinned, breaths: (A && A.breaths) || [], env: A ? Array.from(A.env, v => +v.toFixed(3)) : [], efps: A ? A.fps : 0 }; }"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:300]))
    await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort()); await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto(f'http://127.0.0.1:{PORT}/dist/test.html'); await pg.wait_for_timeout(1500)
    r = await pg.evaluate(JS, [WAV, HEARD, CFG]); json.dump(r, open(OUT, 'w')); print(OUT, 'dur %.1f' % r['dur'], 'words', len(r['words']), 'pinned', r['pinned'], 'moves', len(r['moves']), 'blinks', len(r['blinks'])); await b.close()
asyncio.run(main())

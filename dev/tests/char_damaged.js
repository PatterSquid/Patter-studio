// The Character with his puppet (and hand sheet) loaded, fed damaged settings: every frame must draw without errors
async (opt) => {
  let { rig } = await Puppet.importFile(new File([await (await fetch('/tmp_puppet.puppet')).blob()], 'M.puppet'));
  try { rig = await Puppet.setHands(rig.id, await (await fetch('/tmp_hands/sheet.png')).blob()); } catch (e) { }
  const JUNK = [null, undefined, '', 'x', -1, 0, 1e9, NaN, [], {}, [1, 2], { a: 1 }, true, 'calm', 'tags', 'animated', 'rage'], R = () => JUNK[Math.floor(Math.random() * JUNK.length)];
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'), errs = {}; let fine = 0;
  for (let i = 0; i < (opt.n || 60); i++) {
    const cfg = Object.assign(Character.defaults(), { puppet: rig.id }), keys = Object.keys(cfg).filter(k => k !== 'puppet'), what = [];
    for (let j = 0; j < 1 + Math.floor(Math.random() * 3); j++) { const k = keys[Math.floor(Math.random() * keys.length)], v = R(); cfg[k] = v; what.push(k + '=' + JSON.stringify(v)); }
    if (Math.random() < 0.4) { cfg.moves = [{ id: 'a', k: ['talk', 'explain', 'offer', 'shrug', 'point', 'fist', 'laugh', 'rage', 'zz', null][Math.floor(Math.random() * 10)], start: R(), dur: R(), side: R() }]; what.push('moves=' + JSON.stringify(cfg.moves)); }
    if (opt.repair) Repair.clip('char', cfg, { char: Character });
    try { const d = Character.duration(cfg); if (!(d > 0 && isFinite(d))) throw new Error('bad duration ' + d); for (let f = 0; f < 8; f++) Character.draw(g, d * f / 7, cfg, { format: '16:9', scheme: 'saltire' }, 640, 360); fine++; }
    catch (e) { (errs[e.message] = errs[e.message] || []).push(what.join(' ')); }
  }
  return { fine, errs };
}

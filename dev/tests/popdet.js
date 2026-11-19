// Frame by frame picture change for every tab's example at 60 fps: a single frame that changes far more than the frames
// around it is a pop (a cut, a snap, something appearing at once). Lists them with the time, for a look by eye.
async (opt) => {
  GeoData.load(); for (let i = 0; i < 60 && GeoData.state.status !== 'ready'; i++) await new Promise(r => setTimeout(r, 250)); if (Studio.ready) await Studio.ready(); if (typeof PatterFonts !== 'undefined') await PatterFonts.ready();
  const all = { charts: Charts, timeline: Timeline, picto: Picto, news: News, story: Story, broll: Broll, studio: Studio, intro: typeof Intro !== 'undefined' ? Intro : null, map: MapMod, flights: Flights, flyover: Flyover };
  const want = (opt && opt.mods) || ['charts', 'timeline', 'picto', 'news', 'story', 'broll', 'studio', 'intro'], out = {}, W0 = 320, H0 = 180, FPS = (opt && opt.fps) || 60;
  const c = document.createElement('canvas'); c.width = W0; c.height = H0; const g = c.getContext('2d', { willReadFrequently: true });
  for (const k of want) { const m0 = all[k]; if (!m0) continue; const M = Layers.wrap(m0); let variants = [['default', m0.defaults()]];
    if (k === 'charts' && opt && opt.all) { variants = [];   // every kind of chart from its example, in the look asked for (opt.style), and the two classic ones
      for (const ty of Object.keys(ChartKit.TYPES)) variants.push([ty, Object.assign(m0.defaults(), JSON.parse(JSON.stringify(ChartKit.EXAMPLES[ty])), { type: ty, style: opt.style || 'sleek', ending: opt.ending || 'none', avg: !!opt.avg })]);
      for (const ty of ['line', 'bar']) variants.push(['classic ' + ty, { type: ty, title: 'UK population, millions', source: 's', rows: [['1975', '56.2'], ['1985', '56.6'], ['1995', '58.0'], ['2005', '60.4'], ['2015', '65.1'], ['2024', '69.3']], prefix: '', suffix: 'm', decimals: 'auto', zeroBase: false, colour: 'Irn-Bru orange', hlColour: 'Neon red', milestones: [{ on: true, idx: 3, caption: 'Growth' }], counter: true, camera: true, speed: 'normal', hold: 2, ending: 'none', endText: '' }]); }
    for (const [vn, cfg] of variants) { const look = { scheme: k === 'story' || k === 'broll' ? 'chalk' : 'saltire', format: '16:9', texture: true, preview: false }, { W, H } = E.dims('16:9');
      let d; try { d = M.duration(cfg, look); } catch (e) { out[k + ':' + vn] = 'ERR ' + e.message; continue; } const n = Math.min(Math.round(d * FPS), (opt && opt.max) || 5400), D = new Float32Array(n); let prev = null, err = null;
      // warm up (pictures, fonts) so loading does not look like a pop
      for (let i = 0; i < 6; i++) { try { g.setTransform(W0 / W, 0, 0, H0 / H, 0, 0); M.draw(g, d * i / 6, cfg, look, W, H); } catch (e) { } } await new Promise(r => setTimeout(r, 400));
      for (let i = 0; i < n; i++) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W0, H0); g.setTransform(W0 / W, 0, 0, H0 / H, 0, 0); try { g.save(); M.draw(g, i / FPS, cfg, look, W, H); g.restore(); } catch (e) { err = e.message; break; }
        const px = g.getImageData(0, 0, W0, H0).data; if (prev) { let s = 0; for (let j = 0; j < px.length; j += 16) s += Math.abs(px[j] - prev[j]) + Math.abs(px[j + 1] - prev[j + 1]) + Math.abs(px[j + 2] - prev[j + 2]); D[i] = s / (px.length / 16) / 3; } prev = px; }
      const pops = []; for (let i = 3; i < n - 3; i++) { const nb = [D[i - 3], D[i - 2], D[i - 1], D[i + 1], D[i + 2], D[i + 3]].sort((a, b) => a - b), med = (nb[2] + nb[3]) / 2; if (D[i] > 1.2 && D[i] > med * 5 + 0.6) pops.push([+(i / FPS).toFixed(3), +D[i].toFixed(1), +med.toFixed(2)]); }
      let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, D[i]);
      out[k + ':' + vn] = { dur: +d.toFixed(1), frames: n, max: +mx.toFixed(1), pops, err }; } }
  return out;
}

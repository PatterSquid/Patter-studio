async()=>{ const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll}; const out={};
 GeoData.load(); for(let i=0;i<60&&GeoData.state.status!=='ready';i++) await new Promise(r=>setTimeout(r,250));
 const c=document.createElement('canvas'); c.width=1920; c.height=1080; const g=c.getContext('2d');
 for (const [k,m0] of Object.entries(mods)) { const M=Layers.wrap(m0), cfg=m0.defaults(), look={scheme:k==='story'||k==='broll'?'chalk':'saltire',format:'16:9',texture:true,preview:true}; const d=M.duration(cfg,look);
  const N=60; let a=performance.now(); for(let i=0;i<N;i++){ M.draw(g,d*i/N,cfg,look,1920,1080); } g.getImageData(0,0,1,1); const drawMs=(performance.now()-a)/N;
  a=performance.now(); for(let i=0;i<N;i++) M.duration(cfg,look); const durMs=(performance.now()-a)/N;
  a=performance.now(); for(let i=0;i<N;i++) JSON.stringify(cfg); const jsonMs=(performance.now()-a)/N;
  out[k]={drawMs:+drawMs.toFixed(2), durationMs:+durMs.toFixed(3), keyJsonMs:+jsonMs.toFixed(3), cfgKB:Math.round(JSON.stringify(cfg).length/1024)}; }
 return out; }

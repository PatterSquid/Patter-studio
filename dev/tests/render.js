async()=>{ const mods={charts:Charts,timeline:Timeline,map:typeof MapMod!=='undefined'?MapMod:null,flights:typeof Flights!=='undefined'?Flights:null,flyover:typeof Flyover!=='undefined'?Flyover:null,picto:Picto,news:typeof News!=='undefined'?News:null,story:Story,broll:Broll};
 const out={}; const c=document.createElement('canvas'); const g=c.getContext('2d',{willReadFrequently:true});
 const hash=()=>{ const d=g.getImageData(0,0,c.width,c.height).data; let h=0; for(let i=0;i<d.length;i+=97) h=(h*31+d[i])|0; return h; };
 if (typeof GeoData!=='undefined') { GeoData.load(); for(let i=0;i<60&&GeoData.state.status!=='ready';i++) await new Promise(r=>setTimeout(r,250)); }
 for (const [k,m0] of Object.entries(mods)) { if(!m0){out[k]='missing';continue;} const M=Layers.wrap(m0); const r={errs:[],dur:{},nondet:[],blankish:[],ms:0};
  for (const look of [{scheme:k==='story'||k==='broll'?'chalk':'saltire',format:'16:9',texture:true},{scheme:k==='story'||k==='broll'?'chalk':'newsprint',format:'9:16',texture:true},{scheme:k==='story'||k==='broll'?'chalk':'studio',format:'16:9',transparent:true}]) {
   const cfg=m0.defaults(); const {W,H}=look.format==='9:16'?{W:1080,H:1920}:{W:1920,H:1080}; c.width=W/4; c.height=H/4; let d; try{ d=M.duration(cfg,look);}catch(e){r.errs.push('duration '+e.message); continue;} r.dur[look.format+(look.transparent?'T':'')]=+d.toFixed(2);
   if(!(d>0&&isFinite(d))) r.errs.push('bad duration '+d);
   const N=24; for(let i=0;i<=N;i++){ const t=d*i/N; const a=performance.now(); try{ g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,c.width,c.height); g.setTransform(0.25,0,0,0.25,0,0); M.draw(g,t,cfg,look,W,H); }catch(e){ r.errs.push(`t=${t.toFixed(2)} ${look.format}: ${e.message} @ ${(e.stack||'').split('\n')[1]}`); continue; } r.ms+=performance.now()-a;
     if(i%6===3){ const h1=hash(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,c.width,c.height); g.setTransform(0.25,0,0,0.25,0,0); M.draw(g,t,cfg,look,W,H); const h2=hash(); if(h1!==h2) r.nondet.push(look.format+' t='+t.toFixed(2)); } }
   // out of range times
   for (const t of [-1, d+5, NaN]) { try{ M.draw(g,t,cfg,look,W,H);}catch(e){ r.errs.push('t='+t+' '+e.message);} }
  }
  r.ms=Math.round(r.ms/75); out[k]=r; }
 return out; }

async(opt)=>{ const N=opt&&opt.n||40; let seed=opt&&opt.seed||7; const R=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
 GeoData.load(); for(let i=0;i<60&&GeoData.state.status!=='ready';i++) await new Promise(r=>setTimeout(r,250));
 const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio,intro:Intro,char:Character,audio:AudioTab};
 if(Studio.ready) await Studio.ready();
 const only=opt&&opt.mods; const c=document.createElement('canvas'); c.width=480; c.height=270; const g=c.getContext('2d'); const out={};
 const paths=o=>{ const L=[]; const w=(v,p)=>{ if(p.length) L.push(p); if(v&&typeof v==='object'&&p.length<6) for(const k of Object.keys(v)) w(v[k],p.concat(k)); }; w(o,[]); return L; };
 const junk=v=>{ const r=R(); if(r<0.15) return undefined; if(r<0.3) return null; if(r<0.4) return typeof v==='number'?NaN:''; if(r<0.5) return typeof v==='number'?-1e6:'x'; if(r<0.6) return Array.isArray(v)?[]:{}; if(r<0.7) return typeof v==='string'?12:'12'; if(r<0.8) return typeof v==='number'?1e9:[]; if(r<0.9) return Array.isArray(v)?[null]:true; return 'Ach 💥 <b>'; };
 for (const [k,m0] of Object.entries(mods)) { if(only&&!only.includes(k)) continue; const M=Layers.wrap(m0); const errs={}; let fine=0; const slow={ms:0};
  for(let n=0;n<N;n++){ const cfg=m0.defaults(); const ps=paths(cfg); const nm=1+Math.floor(R()*3); const what=[];
   for(let j=0;j<nm;j++){ const p=ps[Math.floor(R()*ps.length)]; let o=cfg; for(let i=0;i<p.length-1;i++){ o=o&&o[p[i]]; } if(!o||typeof o!=='object') continue; const last=p[p.length-1]; const nv=junk(o[last]); if(nv===undefined) delete o[last]; else o[last]=nv; what.push(p.join('.')+'='+String(nv).slice(0,10)); }
   const look={scheme:k==='story'||k==='broll'?'chalk':'saltire',format:R()<0.3?'9:16':'16:9',texture:true,preview:true};
   if(opt&&opt.repair) Repair.clip(k,cfg,mods); let ok=true; const t0=performance.now(); try{ let d=M.duration(cfg,look); if(!(d>0&&isFinite(d))) { ok=false; (errs['bad duration '+d]=errs['bad duration '+d]||[]).push(what.join(' ')); d=5; }
    for(let i=0;i<=4;i++){ g.setTransform(0.25,0,0,0.25,0,0); M.draw(g,d*i/4,cfg,look,1920,1080); } }
   catch(e){ ok=false; const key=(e.message||String(e)).slice(0,90)+' @'+((e.stack||'').split('\n')[1]||'').trim().slice(0,80); (errs[key]=errs[key]||[]).push(what.join(' ')); }
   const ms=performance.now()-t0; if(ms>slow.ms) { slow.ms=Math.round(ms); slow.what=what.join(' '); } if(ok) fine++; }
  out[k]={fine, slow, errs:Object.fromEntries(Object.entries(errs).map(([a,b])=>[a,[b.length,b.slice(0,2)]]))}; }
 return out; }

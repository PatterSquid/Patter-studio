async()=>{ const errs=[], ks=Object.keys(Story.ACT); const c=document.createElement('canvas'); c.width=480; c.height=270; const g=c.getContext('2d'); let n=0; const t0=performance.now();
 const places=['outdoors','pub','river','blank']; 
 for (const place of places) for (const k of ks) for (const side of ['left','right']) for (const hold of ['','gun','pint','sword']) {
  const cfg=Story.defaults(); const sc=cfg.scenes[0]; sc.type='scene'; sc.place=place; sc.region='europe'; sc.era='modern';
  sc.people=[{pid:cfg.cast[0].id,start:side,holding:hold},{pid:cfg.cast[1].id,start:side==='left'?'right':'left',holding:''}]; const A=Story.ACT[k];
  const a={id:'x',who:cfg.cast[0].id,k,start:0.8,dur:A[3]||1.2,to:cfg.cast[1].id,text:'Aye right',prop:'pint',how:['dead','hurt','miss'][n%3],face:n%5?'':'angry'}; if(A[4]==='spot') a.to=side==='left'?'right':'left'; if(k==='closeup'){a.on=a.who;a.who='';}
  sc.acts=a.who?[a]:[]; sc.extra=a.who?[]:[a]; if(k==='caption'||k==='timejump'){ sc.acts=[]; sc.extra=[{id:'e',k,start:0.5,dur:2,text:'Later'}]; }
  sc.screens = k.endsWith('tv')||['remote','swipetv','droptv'].includes(k) ? [{id:'q',style:'tv',x:1200,y:450,w:700,start:0,dur:20}] : [];
  cfg.scenes=[sc]; const M=Layers.wrap(Story), look={scheme:'chalk',format:'16:9'}; let d; try{ d=M.duration(cfg,look);}catch(e){errs.push(k+' dur '+e.message); continue;}
  for (let i=0;i<=8;i++){ try{ g.setTransform(.25,0,0,.25,0,0); M.draw(g,0.5+i*(a.dur+2)/8,cfg,look,1920,1080); n++; }catch(e){ errs.push(`${place} ${k} ${side} ${hold}: ${e.message} ${(e.stack||'').split('\n')[1]}`); break; } } }
 return {n, ms:Math.round(performance.now()-t0), errs:[...new Set(errs)].slice(0,30), count:errs.length}; }

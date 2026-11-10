async()=>{ if(Studio.ready) await Studio.ready(); GeoData.load(); for(let i=0;i<40&&GeoData.state.status!=='ready';i++) await new Promise(r=>setTimeout(r,250));
 const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio,thumb:Thumb}; const out={};
 const diff=(a,b)=>Object.keys({...a,...b}).filter(q=>JSON.stringify(a[q])!==JSON.stringify(b[q]));
 for(const [k,m0] of Object.entries(mods)){ const M=Layers.wrap(m0); const cfg=JSON.parse(JSON.stringify(m0.defaults())); const before=JSON.parse(JSON.stringify(cfg)); const look={scheme:'saltire',format:'16:9',texture:true,preview:true};
  const c=document.createElement('canvas'); c.width=480; c.height=270; const g=c.getContext('2d'); const d=M.duration(cfg,look); for(let i=0;i<3;i++){ g.setTransform(0.25,0,0,0.25,0,0); M.draw(g,d*i/3,cfg,look,1920,1080); }
  const afterDraw=diff(before,cfg); const root=document.createElement('div'); let ch=0; try{ m0.form(root,cfg,()=>{ch++;}); }catch(e){ out[k+'_formerr']=e.message; } const afterForm=diff(before,cfg);
  out[k]={afterDraw, afterForm, changedCalls:ch}; }
 return out; }

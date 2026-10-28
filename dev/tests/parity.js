async()=>{ const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll}; const out={};
 GeoData.load(); for(let i=0;i<60&&GeoData.state.status!=='ready';i++) await new Promise(r=>setTimeout(r,250)); if(document.fonts) await document.fonts.ready;
 for (const [k,m0] of Object.entries(mods)) { const M=Layers.wrap(m0), cfg=m0.defaults(), look={scheme:k==='story'||k==='broll'?'chalk':'saltire',format:'16:9',texture:true}; const d=M.duration(cfg,look), t=+(d*0.6).toFixed(3);
  let wimg=null; const a=performance.now(); try { await Render.renderFrames(M,cfg,look,{fps:30,blur:'off',frames:1,t0:t,onFrame:async f=>{ const c=document.createElement('canvas'); c.width=480; c.height=270; c.getContext('2d').drawImage(f,0,0,480,270); wimg=c.getContext('2d').getImageData(0,0,480,270).data; f.close&&f.close(); }}); } catch(e){ out[k]='worker error '+e.message; continue; }
  const wms=performance.now()-a;
  const C=document.createElement('canvas'); C.width=1920; C.height=1080; const G=C.getContext('2d'); M.draw(G,t,cfg,Object.assign({},look,{preview:false}),1920,1080); const c=document.createElement('canvas'); c.width=480; c.height=270; c.getContext('2d').drawImage(C,0,0,480,270); const mimg=c.getContext('2d').getImageData(0,0,480,270).data;
  let diff=0,big=0; for(let i=0;i<mimg.length;i+=4){ const dd=Math.abs(mimg[i]-wimg[i])+Math.abs(mimg[i+1]-wimg[i+1])+Math.abs(mimg[i+2]-wimg[i+2]); diff+=dd; if(dd>60) big++; }
  out[k]={t, meanDiff:+(diff/(mimg.length/4)).toFixed(2), bigPx:big, workerMs:Math.round(wms)}; }
 return out; }

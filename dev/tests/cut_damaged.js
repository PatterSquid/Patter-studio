// A full editor video (footage, pictures, sound, overlays, transitions, grading, masks, keyframes) with damaged settings:
// after the load repair it must still give a sane length and draw without errors. Also checks the repair leaves good ones alone.
async(opt)=>{ const N=opt&&opt.n||60; let seed=opt&&opt.seed||11; const R=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
 const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio};
 const rich=()=>({ v:2, gap:'black', bg:'blur', bin:['A','B'], markers:[{t:1,label:'x',col:'#f5c518'}], duckDb:12,
   items:[ {id:'m1',kind:'media',asset:'A',file:'a.mp4',src0:1,src1:5,tr:{k:'fade',d:0.5},col:{look:'cine',exp:10},fx:[{k:'vhs',amt:50}],kf:{s:[[0,1,'io'],[2,1.2,'io']]},anIn:{k:'pop',d:0.5},speed:1.5,vol:-3,fadeIn:0.5},
     {id:'c1',kind:'clip',mod:'charts',cfg:Charts.defaults(),inPt:0,hold:1,outPt:4,x:0.4,s:0.8,crop:[0.1,0,0,0.1]},
     {id:'av',kind:'avatar',text:'hi',dur:2}, {id:'co',kind:'colour',fill:'#ff0000',dur:1}, {id:'m2',kind:'media',asset:'B',file:'b.png',dur:2,mask:{k:'circle',feather:20},key:{on:true,col:'#00ff00'}} ],
   tracks:[ {id:'t1',kind:'video',name:'Overlay 1',items:[{id:'o1',kind:'media',asset:'A',start:1,src0:0,src1:3,s:0.4,blend:'screen'},{id:'adj',kind:'adjust',start:2,dur:3,col:{look:'warm'}}]},
     {id:'a1',kind:'audio',name:'Music',duck:true,vol:-6,items:[{id:'au',kind:'audio',asset:'C',file:'m.mp3',start:0,src0:0,src1:8,fadeOut:2,enhance:50,denoise:30}]} ] });
 const out={};
 // 1. the repair leaves a good editor video exactly as it is
 { const a=rich(), s=JSON.stringify(a), n=Repair.clip('video',a,mods); out.goodUnchanged = n===0 && JSON.stringify(a)===s; if(!out.goodUnchanged) out.goodDiff=n; }
 // 2. damaged ones load, have a length and draw
 const paths=o=>{ const L=[]; const w=(v,p)=>{ if(p.length) L.push(p); if(v&&typeof v==='object'&&p.length<6&&p[0]!=='cfg') for(const k of Object.keys(v)) { if(k==='cfg') continue; w(v[k],p.concat(k)); } }; w(o,[]); return L; };
 const junk=v=>{ const r=R(); if(r<0.15) return undefined; if(r<0.3) return null; if(r<0.4) return typeof v==='number'?NaN:''; if(r<0.5) return typeof v==='number'?-1e6:'x'; if(r<0.6) return Array.isArray(v)?[]:{}; if(r<0.7) return typeof v==='string'?12:'12'; if(r<0.8) return typeof v==='number'?1e9:[]; if(r<0.9) return Array.isArray(v)?[null]:true; return 'Ach 💥'; };
 const c=document.createElement('canvas'); c.width=320; c.height=180; const g=c.getContext('2d'), M=Layers.wrap(Video), errs={}; let fine=0, slow=0;
 for(let n=0;n<N;n++){ const cfg=rich(), ps=paths(cfg), what=[]; for(let j=0;j<1+Math.floor(R()*3);j++){ const p=ps[Math.floor(R()*ps.length)]; let o=cfg; for(let i=0;i<p.length-1;i++) o=o&&o[p[i]]; if(!o||typeof o!=='object') continue; const k=p[p.length-1], nv=junk(o[k]); if(nv===undefined) delete o[k]; else o[k]=nv; what.push(p.join('.')+'='+String(nv).slice(0,8)); }
  Repair.clip('video',cfg,mods); const look={scheme:'saltire',format:R()<0.3?'9:16':'16:9',preview:true}; const t0=performance.now();
  try{ const d=M.duration(cfg,look); if(!(d>0&&isFinite(d)&&d<1e6)) throw new Error('bad length '+d); for(let i=0;i<=5;i++){ g.setTransform(1/6,0,0,1/6,0,0); M.draw(g,d*i/5,cfg,look,1920,1080); } CutAudio.sources(cfg,look); Video.framesAt(cfg,look,1); fine++; }
  catch(e){ const key=(e.message||String(e)).slice(0,80)+' @'+((e.stack||'').split('\n')[1]||'').trim().slice(0,70); (errs[key]=errs[key]||[]).push(what.join(' ')); }
  slow=Math.max(slow,performance.now()-t0); }
 out.fine=fine; out.of=N; out.slowMs=Math.round(slow); out.errs=Object.fromEntries(Object.entries(errs).map(([a,b])=>[a,[b.length,b.slice(0,2)]])); return out; }

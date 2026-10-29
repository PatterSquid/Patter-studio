async()=>{ const mk=k=>({id:'i'+Math.random().toString(36).slice(2,7),kind:'clip',mod:k,cfg:({charts:Charts,story:Story,broll:Broll,news:News,picto:Picto,timeline:Timeline})[k].defaults(),inPt:0,hold:0}); const av=t=>({id:'a'+Math.random().toString(36).slice(2,7),kind:'avatar',text:t,dur:3});
 const cfg={gap:'black',items:[mk('story'),av('x'),mk('broll'),mk('charts'),av('y'),mk('news'),mk('picto'),av('z'),mk('timeline'),mk('story')]}; const look={scheme:'saltire',format:'16:9',texture:true,preview:false};
 const M=Layers.wrap(Video); const c=document.createElement('canvas'); c.width=1920; c.height=1080; const g=c.getContext('2d'); const d=M.duration(cfg,look);
 let a=performance.now(); for(let i=0;i<200;i++) M.duration(cfg,look); const durMs=(performance.now()-a)/200;
 a=performance.now(); for(let i=0;i<200;i++) Video.layout(cfg,look); const layMs=(performance.now()-a)/200;
 // draw cost through the video vs the clip directly, same moments
 const L=Video.layout(cfg,look), o=L[3], C=Layers.wrap(Charts); let a1=performance.now(); for(let i=0;i<40;i++) M.draw(g,o.t0+i*o.d/40,cfg,look,1920,1080); g.getImageData(0,0,1,1); const viaVideo=(performance.now()-a1)/40;
 a1=performance.now(); for(let i=0;i<40;i++) C.draw(g,i*o.d/40,o.it.cfg,look,1920,1080); g.getImageData(0,0,1,1); const direct=(performance.now()-a1)/40;
 return {d:+d.toFixed(1), items:cfg.items.length, durationMs:+durMs.toFixed(3), layoutMs:+layMs.toFixed(3), viaVideoMs:+viaVideo.toFixed(2), directMs:+direct.toFixed(2), json:JSON.stringify(cfg).length}; }

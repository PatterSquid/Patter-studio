// Per-frame joint tracking for every built-in act; returns jump reports
async (opts) => {
 const FL=905,S=410, ks=opts.ks||Object.keys(Story.ACT), rep=[], c=document.createElement('canvas'); c.width=10;c.height=10; const g=c.getContext('2d');
 const HOLD={shoot:'gun',swing:'sword',drink:'bottle',smash:'bottle',block:'shield',charge:'sword',putaway:'phone',throw:'bottle'};
 const rot=(p,cx,cy,a)=>{ const dx=p[0]-cx,dy=p[1]-cy,cs=Math.cos(a),sn=Math.sin(a); return [cx+dx*cs-dy*sn, cy+dx*sn+dy*cs]; };
 function joints(Q,F){ const lying=Q.rot>0.001, rotA=lying?(Q.lieSide!=null?Q.lieSide:Q.fallBack?-Q.dir:Q.dir)*Q.rot*Math.PI/2:Q.diveA?Q.dir*Q.diveA:Q.spin?Q.dir*Q.spin:0;
   const px=Q.x, py=Q.diveA||Q.spin?FL-0.43*S-(Q.hop||0):FL, sk=Q.shrink||1, spy=FL-(Q.hop||0)-0.45*S, tf=p=>{ let q=[px+(p[0]-px)*1, p[1]]; if(sk!==1) q=[Q.x+(q[0]-Q.x)*sk, spy+(q[1]-spy)*sk]; return rotA?rot(q,px,py,rotA):q; };
   const sx = Q.turnK!=null ? Q.turnK : 1, J={head:F.hc,hand0:F.hands[-1],hand1:F.hands[1],elb0:F.elbows[-1],elb1:F.elbows[1],hip:F.hip}, o={}; for(const k in J){ let q=tf(J[k]); q=[Q.x+(q[0]-Q.x)*sx,q[1]]; o[k]=q; } return o; }
 for (const k of ks){ const A=Story.ACT[k]; if(['caption','timejump','closeup'].includes(k)) continue;
  for (const side of opts.sides||['left']){
  const cfg=Story.defaults(), sc=cfg.scenes[0]; sc.type='scene'; sc.place='outdoors'; sc.region='europe'; sc.era='modern'; sc.weather='';
  const a0=cfg.cast[0].id,b0=cfg.cast[1].id; sc.people=[{pid:a0,start:side,holding:HOLD[k]||''},{pid:b0,start:side==='left'?1250:670,holding:''}];
  const dur=A[3]||1.2, a={id:'x',who:a0,k,start:1,dur,to:b0,text:'Aye right pal',prop:'pint',how:'hurt'}; if(A[4]==='spot') a.to=side==='left'?'right':'left';
  sc.acts=[a, {id:'y',who:a0,k:'say',start:1+dur+0.6,dur:1.6,text:'Right then'}]; sc.extra=[];
  sc.screens = k.endsWith('tv')||['remote','swipetv','droptv'].includes(k) ? [{id:'q',style:'tv',x:1200,y:450,w:700,start:0,dur:30}] : [];
  cfg.scenes=[sc]; let P,o; try{ P=Story._plan(cfg); o=P.scenes[0]; }catch(e){ rep.push(k+' plan '+e.message); continue; }
  const T=Math.min(o.d, 1+dur+2.6), tr={};
  for(let i=Math.round(0.5*25);i<T*25;i++){ const t=i/25, sim=Story._sim(o.sc,o,t);
   for(const pe of o.sc.people){ const st=sim[pe.pid]; if(!st) continue; const Q=Story._pose(o.cast[pe.pid],st,t,o); if(Q.hidden||Q.swimming){ (tr[pe.pid]=tr[pe.pid]||[]).push(null); continue; }
    const F=Story._figure(g,o.cast[pe.pid],Q,t,1); (tr[pe.pid]=tr[pe.pid]||[]).push({t,J:joints(Q,F),dir:Q.dir,k:st.active?st.active.a.k:'',fast:!!Q.fast}); } }
  for(const pid in tr){ const L=tr[pid], who=pid===a0?'doer':'other';
   for(let i=1;i<L.length;i++){ const a1=L[i-1],b1=L[i]; if(!a1||!b1) continue; const msgs=[];
    if(a1.dir!==b1.dir && !opts.noDir) msgs.push('TURN');
    for(const j in b1.J){ const d=Math.hypot(b1.J[j][0]-a1.J[j][0],b1.J[j][1]-a1.J[j][1]);
      const pr=L[i-2]&&L[i-2].J?Math.hypot(a1.J[j][0]-L[i-2].J[j][0],a1.J[j][1]-L[i-2].J[j][1]):0, nx=L[i+1]&&L[i+1].J?Math.hypot(L[i+1].J[j][0]-b1.J[j][0],L[i+1].J[j][1]-b1.J[j][1]):0;
      if(d>(opts.th||22) && d>2.2*Math.max(pr,nx,4)) msgs.push(j+':'+Math.round(d)); }
    if(msgs.length) rep.push(`${k} ${side} ${who} t=${b1.t.toFixed(2)} ${a1.k}->${b1.k} ${msgs.join(' ')}`); } } } }
 return rep; }

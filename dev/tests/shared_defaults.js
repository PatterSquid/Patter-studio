async()=>{ if(Studio.ready) await Studio.ready(); const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio,thumb:Thumb}; const out={};
 const flat=(o,p,m)=>{ if(o&&typeof o==='object') { for(const k of Object.keys(o)) flat(o[k],p+'.'+k,m); } else m[p]=o; return m; };
 const smash=o=>{ if(Array.isArray(o)){ o.forEach(smash); o.push('JUNK'); } else if(o&&typeof o==='object'){ for(const k of Object.keys(o)){ if(o[k]&&typeof o[k]==='object') smash(o[k]); else o[k]='JUNK'; } } };
 for(const [k,M] of Object.entries(mods)){ const a=flat(M.defaults(),'',{}), b=flat(M.defaults(),'',{}); const vary=new Set(Object.keys(a).filter(x=>a[x]!==b[x]));
  smash(M.defaults()); const c=flat(M.defaults(),'',{}); const bad=Object.keys({...a,...c}).filter(x=>!vary.has(x)&&a[x]!==c[x]); out[k]=bad.slice(0,6); }
 // also the other tabs' own state objects
 return out; }

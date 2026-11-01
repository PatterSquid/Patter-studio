import asyncio, random, sys, json, glob, os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); REPO=os.path.dirname(os.path.dirname(HERE))
src=open(os.path.join(HERE,'studio_monkey.py')).read()
PICK=src.split('PICK=r"""')[1].split('"""')[0]
TABS=sys.argv[1].split(',') if len(sys.argv)>1 else ['video','charts','timeline','map','flights','flyover','picto','news','story','broll','studio']
N=int(sys.argv[2]) if len(sys.argv)>2 else 150
CHK=r"""()=>{ const st=JSON.parse(localStorage.getItem('patter-studio-v1')); const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio}; const bad=[];
 for(const [k,c] of Object.entries(st.cfg)){ if(!mods[k]) continue; const a=JSON.stringify(c); const b=JSON.parse(a); const n=Repair.clip(k,b,mods); const s=JSON.stringify(b); if(n||s!==a){ const d=[]; const w=(x,y,p)=>{ if(JSON.stringify(x)===JSON.stringify(y)) return; if(x&&y&&typeof x==='object'&&typeof y==='object'){ for(const q of new Set([...Object.keys(x),...Object.keys(y)])) w(x[q],y[q],p+'.'+q); } else d.push(p+': '+JSON.stringify(x).slice(0,40)+' -> '+JSON.stringify(y).slice(0,40)); }; w(c,b,k); bad.push(...d.slice(0,4)); } }
 return bad; }"""
async def main():
    random.seed(5)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page(viewport={'width':1600,'height':1100}); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(2500)
        await pg.evaluate("()=>{window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>'x';}")
        # fixed sources
        projs={os.path.basename(f):json.load(open(f)) for f in glob.glob(os.path.join(REPO,'projects','*.patter.json'))}
        packs=[json.load(open(f)) for f in glob.glob(os.path.join(REPO,'packs','*.json')) if not f.endswith('index.json')]
        r=await pg.evaluate("""([projs,packs])=>{ const mods={charts:Charts,timeline:Timeline,map:MapMod,flights:Flights,flyover:Flyover,picto:Picto,news:News,story:Story,broll:Broll,video:Video,studio:Studio}; const out=[];
          const test=(name,k,c)=>{ const a=JSON.stringify(c), b=JSON.parse(a), n=Repair.clip(k,b,mods); if(n||JSON.stringify(b)!==a) out.push(name+' changed '+n); };
          for(const k of Object.keys(mods)) test('defaults '+k,k,mods[k].defaults());
          for(const [nm,P] of Object.entries(projs)){ const st=P.state||P; const cfgs=st.cfg||{}; for(const [k,c] of Object.entries(cfgs)) if(mods[k]) test(nm+' '+k,k,c); }
          for(const pk of packs){ try{ Story.packs.install(pk); }catch(e){ out.push('install '+e.message); } for(const sp of (pk.setpieces||[])){ const c=Story.defaults(); c.scenes=[]; c.cast=[]; c.layers=[]; Story.packs.addSetPiece(c,sp.id,0); test('setpiece '+sp.id,'story',c); } }
          return out; }""",[projs,packs])
        print('fixed sources:', r or 'all unchanged', flush=True)
        seen=0; bad=set()
        for tab in TABS:
            await pg.evaluate(f"()=>document.querySelector('button[data-mod={tab}]').click()"); await pg.wait_for_timeout(1500)
            for i in range(N):
                await pg.evaluate(PICK, random.random()); await pg.wait_for_timeout(50)
                if i%10==9:
                    await pg.wait_for_timeout(400); r=await pg.evaluate(CHK); seen+=1
                    for x in r:
                        if x not in bad: bad.add(x); print('FALSE REPAIR', tab, x, flush=True)
        print('checked', seen, 'states; false repairs', len(bad), 'errors', errs[:3]); await b.close()
asyncio.run(main())

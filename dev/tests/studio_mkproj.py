import asyncio, json, base64
from playwright.async_api import async_playwright
url='data:image/jpeg;base64,'+base64.b64encode(open('/tmp/claude-0/st2/room1080.jpg','rb').read()).decode()
JS=r"""async(url)=>{ await Layers.setAsset('aroomstudio1',url); const marks=await (await fetch('/tmp_marks.json')).json(); const d=Studio.detect(Layers.assets.aroomstudio1.bmp, marks.glass); marks.lit=d.lit;
 const cfg=Object.assign(Studio.defaults(),{room:{asset:'aroomstudio1',name:'My studio'},marks,weather:'rain',rain:1,loop:24,drift:'gentle'}); return cfg; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-proxy-server']); pg=await b.new_page()
        await pg.goto('http://127.0.0.1:8765/dist/test.html'); await pg.wait_for_timeout(1200)
        cfg=await pg.evaluate(JS,url); await b.close()
    proj={'module':'studio','look':{'scheme':'saltire','texture':True,'format':'16:9','transparent':False,'accent2':'#e3302c'},'cfg':{'studio':cfg},'assets':{'aroomstudio1':url},'range':{},'name':'My studio','note':'Your room with rain, lamps, life outside and frames ready to fill. Add your avatar on the left.'}
    json.dump(proj,open('/home/claude/patter-studio/projects/my-studio.patter.json','w'),separators=(',',':'))
    print('lit',len(cfg['marks']['lit']))
asyncio.run(main())

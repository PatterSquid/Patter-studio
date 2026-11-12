"""Builds PatterScript into ../docs (served by GitHub Pages from main, /docs). Fonts are embedded so it works offline."""
import base64, hashlib, os, shutil
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(here, '..', 'docs'); os.makedirs(out, exist_ok=True)
rd = lambda f: open(os.path.join(here, f), encoding='utf-8').read()
faces = [('Anton', 400, 'anton_5_latin-400-normal'), ('Archivo', 400, 'archivo_5_latin-400-normal'), ('Archivo', 600, 'archivo_5_latin-600-normal'), ('Archivo', 800, 'archivo_5_latin-800-normal')]
fonts = ''.join("@font-face{font-family:%s;font-weight:%d;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}\n" % (n, w, base64.b64encode(open(os.path.join(here, f + '.woff2'), 'rb').read()).decode()) for n, w, f in faces)
html = rd('index.html').replace('/*FONTS*/', fonts).replace('/*CSS*/', rd('style.css')).replace('/*JS*/', rd('app.js'))
ver = hashlib.sha1(html.encode()).hexdigest()[:10]
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
open(os.path.join(out, 'sw.js'), 'w').write(rd('sw.js').replace('__VER__', ver))
shutil.copy(os.path.join(here, 'manifest.webmanifest'), out)
open(os.path.join(out, '.nojekyll'), 'w').close()
# icons: his squid on the saltire, with a cream page and a red pen line in the corner
logo = Image.open(os.path.join(here, '..', 'dev', 'assets', 'pattersquid.jpg')).convert('RGB')
def icon(size, maskable):
    im = Image.new('RGB', (size, size), (15, 26, 46)); s = int(size * (0.78 if maskable else 1.0)); lg = logo.resize((s, s), Image.LANCZOS)
    m = Image.new('L', (s, s), 0); ImageDraw.Draw(m).ellipse((0, 0, s - 1, s - 1), fill=255); o = (size - s) // 2; im.paste(lg, (o, o), m)
    d = ImageDraw.Draw(im); k = size / 512; bx, by, bw, bh = (300, 300, 150, 168) if not maskable else (290, 286, 130, 146)
    bx, by, bw, bh = [int(v * k) for v in (bx, by, bw, bh)]
    d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=int(14 * k), fill=(244, 238, 223), outline=(15, 26, 46), width=max(2, int(8 * k)))
    for i in range(4):
        y = by + int((36 + i * 30) * k * (bh / (168 * k))); d.rounded_rectangle((bx + int(20 * k), y, bx + bw - int((20 + (40 if i == 3 else 0)) * k), y + int(10 * k)), radius=int(5 * k), fill=(227, 48, 44) if i == 0 else (120, 132, 150))
    return im
icon(192, False).save(os.path.join(out, 'icon-192.png')); icon(512, False).save(os.path.join(out, 'icon-512.png')); icon(512, True).save(os.path.join(out, 'icon-maskable.png'))
print('built', ver, len(html) // 1024, 'KB')

# the Android app (APK): the same files inside a small WebView wrapper (android/: manifest, icons, smali), packed with
# apktool and signed with key/patterscript.jks (his copy; password in PATTERSCRIPT_KEY_PASS). An update signed with another key will not install over it.
import subprocess, sys
if '--apk' in sys.argv:
    tools = os.environ.get('APK_TOOLS', '/tmp/apktools'); a = os.path.join(here, 'android'); assets = os.path.join(a, 'assets')
    shutil.rmtree(assets, ignore_errors=True); os.makedirs(assets)
    for f in ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']: shutil.copy(os.path.join(out, f), assets)
    vc = int(open(os.path.join(here, 'APK_VERSION')).read().strip())
    y = open(os.path.join(a, 'apktool.yml')).read(); import re
    y = re.sub(r'versionCode: \d+', 'versionCode: %d' % vc, y); y = re.sub(r"versionName: '[^']*'", "versionName: '1.%d'" % vc, y); open(os.path.join(a, 'apktool.yml'), 'w').write(y)
    raw = os.path.join(here, 'build-unsigned.apk')
    subprocess.run(['java', '-jar', os.path.join(tools, 'apktool.jar'), 'b', a, '-o', raw, '-f'], check=True)
    sd = os.path.join(here, 'signed'); shutil.rmtree(sd, ignore_errors=True)
    subprocess.run(['java', '-jar', os.path.join(tools, 'uber.jar'), '-a', raw, '-o', sd, '--ks', os.path.join(here, 'key', 'patterscript.jks'), '--ksAlias', 'patterscript', '--ksPass', os.environ['PATTERSCRIPT_KEY_PASS'], '--ksKeyPass', os.environ['PATTERSCRIPT_KEY_PASS']], check=True)
    apk = [f for f in os.listdir(sd) if f.endswith('.apk')][0]
    shutil.copy(os.path.join(sd, apk), os.path.join(out, 'PatterScript.apk')); os.remove(raw); shutil.rmtree(sd)
    print('apk', os.path.getsize(os.path.join(out, 'PatterScript.apk')) // 1024, 'KB, version', vc)

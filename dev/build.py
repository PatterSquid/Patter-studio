"""Builds Patter Studio from the source in this folder.

  python3 build.py          builds dist/Patter-Studio.html (the app), dist/test.html (for local testing)
                            and dist/Patter-Studio-Launcher.html (the self-updating file that gets installed)

Story is kept as chunks in story/ (joined in the order listed in story/ORDER) because it is large.
"""
import os, base64

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
os.makedirs(DIST, exist_ok=True)

# His studio, built in: the room picture and what is marked in it
open(os.path.join(SRC, 'studio_room.js'), 'w').write('const STUDIO_ROOM = ' + repr('data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', 'studio-room.jpg'), 'rb').read()).decode()) + ';\nconst STUDIO_LOGO = ' + repr('data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', 'pattersquid.jpg'), 'rb').read()).decode()) + ';\nconst STUDIO_PLATE = ' + repr('data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', 'studio-plate.jpg'), 'rb').read()).decode()) + ';\nconst STUDIO_SQUID = ' + repr('data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', 'studio-squid.png'), 'rb').read()).decode()) + ';\nconst STUDIO_MARKS = ' + open(os.path.join(ROOT, 'assets', 'studio-marks.json')).read() + ';\n')
order = open(os.path.join(ROOT, 'story', 'ORDER')).read().split()
open(os.path.join(SRC, 'story.js'), 'w').write(''.join(open(os.path.join(ROOT, 'story', f)).read() for f in order))

FILES = ['mp4mux.js', 'engine.js', 'ui.js', 'charts.js', 'timeline.js', 'picto.js', 'geodata.js', 'globegl.js', 'globe.js', 'routes.js',
         'map.js', 'flights.js', 'flyover.js', 'news.js', 'media.js', 'packs.js', 'story.js', 'video.js', 'studio_room.js', 'studio_events.js', 'studio.js', 'layers.js', 'editor.js', 'render.js', 'app.js']
VERSION = open(os.path.join(ROOT, 'VERSION')).read().strip()
html = open(os.path.join(SRC, 'index.html')).read()
css = open(os.path.join(SRC, 'style.css')).read()
js = '\n'.join(open(os.path.join(SRC, f)).read() for f in FILES)
app = html.replace('/*CSS*/', css).replace('/*JS*/', 'window.PATTER_APP_VERSION=' + repr(VERSION) + ';\n' + js)
open(os.path.join(DIST, 'Patter-Studio.html'), 'w').write(app)

# Local test copy: the map library and a small world map served from this folder (python3 -m http.server 8765 here)
test = app.replace('https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js', 'http://127.0.0.1:8765/d3.min.js')
test = test.replace('<script src="http://127.0.0.1:8765/d3.min.js">', '<script>window.PATTER_MAP_URL="http://127.0.0.1:8765/test/fixture.json";window.PATTER_MAP_URL_LO="http://127.0.0.1:8765/test/fixture.json"</script><script src="http://127.0.0.1:8765/d3.min.js">')
open(os.path.join(DIST, 'test.html'), 'w').write(test)

def launcher(app_html, home=None):
    L = open(os.path.join(SRC, 'launcher.html')).read().replace('/*VERSION*/', VERSION).replace('/*EMBED*/', base64.b64encode(app_html.encode('utf-8')).decode())
    if home:
        L = L.replace('<script>\n/* Patter Studio launcher', '<script>window.PATTER_HOME=' + repr(home) + ';</script>\n<script>\n/* Patter Studio launcher', 1)
    return L

open(os.path.join(DIST, 'Patter-Studio-Launcher.html'), 'w').write(launcher(app))
open(os.path.join(DIST, 'test-launcher.html'), 'w').write(launcher(test, 'http://127.0.0.1:8765/fakehome/'))
print('Built version', VERSION, len(app), 'bytes')

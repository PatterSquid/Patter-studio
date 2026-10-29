"""Publishes a built version so every installed copy of Patter Studio picks it up the next time it opens.

  python3 publish.py "What changed, in a sentence"

Copies dist/Patter-Studio.html to ../app/patter-studio.html, writes ../version.json, rebuilds ../packs/index.json from the
pack files in ../packs, and makes dist/Patter-Studio-Installer.zip (only needed for a first install on a new computer).
Commit and push the repo afterwards.
"""
import os, sys, json, shutil, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
DIST = os.path.join(ROOT, 'dist')
VERSION = open(os.path.join(ROOT, 'VERSION')).read().strip()
notes = sys.argv[1] if len(sys.argv) > 1 else ''

app = os.path.join(DIST, 'Patter-Studio.html')
if VERSION not in open(app).read():
    sys.exit('dist/Patter-Studio.html is not version ' + VERSION + ': run build.py first')
os.makedirs(os.path.join(REPO, 'app'), exist_ok=True)
shutil.copy(app, os.path.join(REPO, 'app', 'patter-studio.html'))
json.dump({'version': VERSION, 'file': 'app/patter-studio.html', 'notes': notes}, open(os.path.join(REPO, 'version.json'), 'w'), indent=2)

# Every pack file in packs/ goes in the index with its own version number
packs = []
pdir = os.path.join(REPO, 'packs')
for f in sorted(os.listdir(pdir)):
    if f.endswith('.json') and f != 'index.json':
        p = json.load(open(os.path.join(pdir, f)))
        packs.append({'id': p['id'], 'name': p.get('name', p['id']), 'version': p.get('version', 1), 'file': f})
json.dump({'packs': packs}, open(os.path.join(pdir, 'index.json'), 'w'), indent=2)

# Whole projects for him (videos built from his scripts): every .patter.json in projects/ is listed with a fingerprint,
# so a changed file reaches him again as an update
import hashlib
jdir = os.path.join(REPO, 'projects'); os.makedirs(jdir, exist_ok=True); projs = []
for f in sorted(os.listdir(jdir)):
    if f.endswith('.patter.json'):
        raw = open(os.path.join(jdir, f), 'rb').read(); st = json.loads(raw)
        projs.append({'id': f[:-len('.patter.json')], 'name': st.get('name', f), 'note': st.get('note', ''), 'rev': hashlib.sha1(raw).hexdigest()[:12], 'file': f})
json.dump({'projects': projs}, open(os.path.join(jdir, 'index.json'), 'w'), indent=2)

# Installer zip: the launcher goes in as Patter-Studio.html so it lands where the old app was and keeps every project
z = os.path.join(DIST, 'Patter-Studio-Installer.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as Z:
    Z.write(os.path.join(DIST, 'Patter-Studio-Launcher.html'), 'Patter-Studio/Patter-Studio.html')
    for f in os.listdir(os.path.join(ROOT, 'installer')):
        Z.write(os.path.join(ROOT, 'installer', f), 'Patter-Studio/' + f)
print('Published', VERSION, 'with', len(packs), 'packs. Installer:', z)

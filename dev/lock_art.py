"""Lock his own artwork (his puppet and his hand sheet) for the public update repo: AES-256-GCM with a key made from his
password (PBKDF2, SHA-256, 600000 rounds). Writes private/art.locked and private/art.json at the repo root; the app asks
for the password once (PrivateArt in src/private_art.js), unlocks it and loads both into the Character.
  PATTER_ART_PASSWORD=... python3 lock_art.py path/to/his.puppet path/to/hand-sheet.png
The password is never written anywhere by this script and must never be committed."""
import hashlib, json, os, struct, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
ITER = 600000
def main():
  pw = os.environ.get('PATTER_ART_PASSWORD')
  if not pw: sys.exit('Set PATTER_ART_PASSWORD')
  files = []
  for path in sys.argv[1:]:
    kind = 'puppet' if path.lower().endswith(('.puppet', '.psd', '.psb')) else 'hands'
    data = open(path, 'rb').read(); files.append(({'kind': kind, 'name': ('My puppet.puppet' if kind == 'puppet' else 'My hands.png'), 'size': len(data), 'type': 'application/octet-stream' if kind == 'puppet' else 'image/png'}, data))
  head = json.dumps([f for f, _ in files]).encode()
  plain = struct.pack('<I', len(head)) + head + b''.join(d for _, d in files)
  salt, iv = os.urandom(16), os.urandom(12)
  key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode())
  sealed = b'PLK1' + salt + iv + AESGCM(key).encrypt(iv, plain, None)
  root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'private'); os.makedirs(root, exist_ok=True)
  open(os.path.join(root, 'art.locked'), 'wb').write(sealed)
  rev = hashlib.sha256(b''.join(d for _, d in files)).hexdigest()[:16]
  json.dump({'format': 1, 'rev': rev, 'file': 'private/art.locked', 'iter': ITER, 'note': 'Locked: only his password opens it.'}, open(os.path.join(root, 'art.json'), 'w'), indent=1)
  print('locked', len(sealed), 'bytes, rev', rev)
main()

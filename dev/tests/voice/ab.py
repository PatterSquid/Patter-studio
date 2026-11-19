# ab.py out.mp4 : the before and after clip. PARTS = [[heading, [[label, file, start], ...]], ...]; each stretch DUR long, all at one loudness.
import sys, json, subprocess, numpy as np, scipy.io.wavfile as wf, os
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; DUR = float(os.environ.get('DUR', 11)); GAP = 0.5; SR = 48000; W, H = 1280, 720
parts = json.loads(os.environ['PARTS']); tmp = '/tmp/_ab'; os.makedirs(tmp, exist_ok=True)
A = ImageFont.truetype(os.environ.get('FONT_A', 'anton-400.ttf'), 112); B = ImageFont.truetype(os.environ.get('FONT_B', 'archivonarrow-600.ttf'), 38); C = ImageFont.truetype(os.environ.get('FONT_B', 'archivonarrow-600.ttf'), 26)
def cut(p, s):
    sr, x = wf.read(p); x = x.astype(np.float64) / 32768; x = x[int(s * sr):int((s + DUR) * sr)].copy(); f = int(0.04 * sr); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f); return x
audio = []; lst = []; i = 0
for head, rows in parts:
    for label, p, s in rows:
        a = cut(p, s); audio += [a, np.zeros(int(GAP * SR))]
        im = Image.new('RGB', (W, H), (10, 17, 32)); d = ImageDraw.Draw(im); new = label.startswith('NEW')
        d.text((W / 2, 96), head, font=B, fill=(159, 176, 200), anchor='mm'); d.text((W / 2, 215), label, font=A, fill=(255, 122, 26) if new else (243, 234, 214), anchor='mm')
        x0, x1, ym, hh = 60, W - 60, 500, 150; n = x1 - x0; per = len(a) / n
        d.rectangle([x0 - 12, ym - hh - 12, x1 + 12, ym + hh + 12], fill=(15, 24, 44))
        for c in range(n):
            seg = a[int(c * per):int((c + 1) * per) + 1]; lo, hi = seg.min(), seg.max(); k = lambda v: np.sign(v) * abs(v) ** 0.5   # square root, so what is in the gaps can be seen
            d.line([x0 + c, ym - k(hi) * hh, x0 + c, ym - k(lo) * hh], fill=(255, 150, 70) if new else (200, 208, 222))
        d.text((W / 2, 684), 'Same words, same loudness each time. Listen to the gaps between the words, then to the voice.', font=C, fill=(120, 136, 160), anchor='mm')
        fn = '%s/s%d.png' % (tmp, i); im.save(fn); lst.append("file '%s'\nduration %.3f" % (fn, DUR + GAP)); i += 1
lst.append("file '%s'" % fn); open(tmp + '/list.txt', 'w').write('\n'.join(lst))
y = np.concatenate(audio); wf.write(tmp + '/a.wav', SR, (np.clip(y, -1, 1) * 32767).astype(np.int16)); total = len(y) / SR
flt = "[0:v]fps=30,format=yuv420p[bg];color=c=0xffffff:s=3x324:r=30:d=%.2f[bar];[bg][bar]overlay=x='60+1160*min(1\\,mod(t\\,%.2f)/%.2f)':y=338:shortest=1[v]" % (total, DUR + GAP, DUR)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', tmp + '/list.txt', '-i', tmp + '/a.wav', '-filter_complex', flt, '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-t', '%.2f' % total, '-movflags', '+faststart', out], check=True)
print(out, '%.0f s' % total)

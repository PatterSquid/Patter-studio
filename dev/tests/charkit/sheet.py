# sheet.py dir out.jpg start step count [cols] [crop x0,y0,x1,y1 as fractions] [width]  : frames f%05d.jpg as a contact sheet with their times
import sys, os
from PIL import Image, ImageDraw
d, out, a, st, n = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]); cols = int(sys.argv[6]) if len(sys.argv) > 6 else 6
crop = [float(v) for v in sys.argv[7].split(',')] if len(sys.argv) > 7 and sys.argv[7] != '-' else None; W = int(sys.argv[8]) if len(sys.argv) > 8 else 300; fps = float(os.environ.get('FPS', 30))
ims = []
for i in range(n):
    p = '%s/f%05d.jpg' % (d, a + i * st)
    if not os.path.exists(p): break
    im = Image.open(p)
    if crop: w, h = im.size; im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    im = im.resize((W, int(W * im.size[1] / im.size[0]))); ImageDraw.Draw(im).text((4, 2), '%.2f' % ((a + i * st) / fps), fill=(255, 255, 0)); ims.append(im)
rows = (len(ims) + cols - 1) // cols; h = ims[0].size[1]; sh = Image.new('RGB', (cols * W, rows * h))
for i, im in enumerate(ims): sh.paste(im, ((i % cols) * W, (i // cols) * h))
sh.save(out, quality=88); print(out, sh.size, len(ims))

# pops.py DIR [crop]  : frame to frame change of rendered frames; lists single frames that change far more than their neighbours, by region (head, hands)
import sys, os, numpy as np
from PIL import Image
d = sys.argv[1]; fs = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
REG = {'head': (0.36, 0.0, 0.66, 0.60), 'body': (0.15, 0.45, 0.85, 1.0)}
prev = None; ch = {k: [] for k in REG}
for f in fs:
    im = np.asarray(Image.open(os.path.join(d, f)).convert('L').resize((480, 270))).astype(np.float32)
    if prev is not None:
        df = np.abs(im - prev)
        for k, (x0, y0, x1, y1) in REG.items(): ch[k].append(float(df[int(y0*270):int(y1*270), int(x0*480):int(x1*480)].mean()))
    prev = im
for k, v in ch.items():
    v = np.array(v); out = []
    for i in range(2, len(v) - 2):
        nb = max(v[i-1], v[i+1], 0.25)
        if v[i] > 3.2 * nb and v[i] > 1.2: out.append((round((i + 1) / 30, 2), round(float(v[i]), 2), round(float(nb), 2)))
    print(k, 'mean %.3f' % v.mean(), 'p99 %.2f' % np.percentile(v, 99), 'max %.2f at %.2f' % (v.max(), (int(v.argmax()) + 1) / 30), 'lone spikes:', out[:25])

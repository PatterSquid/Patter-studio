# plot.py out.png t0 t1 trace.json[:label] [trace2.json[:label]] ...  : the channels over a stretch, with the words along the top
import sys, json, numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
out, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); T = [(a.split(':')[0], a.split(':')[1] if ':' in a else a) for a in sys.argv[4:]]
rows = [('head', ['hx', 'hy', 'hr']), ('turn/sit', ['tx', 'ty', 'sx', 'sr']), ('brows/lid', ['bL', 'bR', 'lid', 'blink']), ('jaw/eyes', ['jaw', 'px', 'py']), ('left hand', ['aLx', 'aLy', 'aLr']), ('right hand', ['aRx', 'aRy', 'aRr'])]
fig, ax = plt.subplots(len(rows), len(T), figsize=(9 * len(T), 2.1 * len(rows)), squeeze=False, sharex=True)
for c, (f, lab) in enumerate(T):
    d = json.load(open(f)); n = len(d['ch']['hx']); t = np.arange(n) / 60; m = (t >= t0) & (t <= t1)
    for r, (name, ks) in enumerate(rows):
        a = ax[r][c]
        for k in ks:
            if k in d['ch']: a.plot(t[m], np.array(d['ch'][k], float)[m], label=k, lw=1)
        a.legend(loc='upper right', fontsize=6, ncol=4); a.set_ylabel(name, fontsize=7); a.grid(alpha=0.3); a.tick_params(labelsize=6)
        if r == 0:
            a.set_title(lab, fontsize=9); yl = a.get_ylim()
            for w in d['words']:
                if t0 <= w[0] <= t1: a.axvline(w[0], color='k', alpha=0.12, lw=0.6); a.text(w[0], yl[1], w[2], fontsize=6, rotation=60, va='bottom')
        if name == 'jaw/eyes':
            vis = [v for v in d['vis'] if t0 <= v[0] <= t1]
            for v in vis: a.text(v[0], a.get_ylim()[0], v[1][:2], fontsize=5, rotation=90, va='bottom', color='gray')
plt.tight_layout(); plt.savefig(out, dpi=75)

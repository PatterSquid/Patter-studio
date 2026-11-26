# rplot.py out.png t0 t1 trace.json[:label] ...  : the resting right hand over a stretch (on the screen: lift, across, turn) against the loudness and words
import sys, json, numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
out, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); T = [(a.split(':')[0], a.split(':')[1] if ':' in a else a) for a in sys.argv[4:]]
fig, ax = plt.subplots(4, 1, figsize=(15, 8), sharex=True); cols = ['#888', '#d60', '#06c']
for c, (f, lab) in enumerate(T):
    d = json.load(open(f)); ch = d['ch']; hh = d.get('hh', 588); n = len(ch['aRy']); t = np.arange(n) / 60; m = (t >= t0) & (t <= t1); col = cols[c % 3]
    ax[0].plot(t[m], -np.array(ch['aRy'])[m] * hh, color=col, lw=1.2, label=lab + ' lift off the desk (px)'); ax[1].plot(t[m], (np.array(ch['aRx']) + np.array(ch['sx']))[m] * hh, color=col, lw=1.2, label=lab + ' across the screen (px)')
    ax[2].plot(t[m], np.degrees(np.array(ch['aRr'])[m]), color=col, lw=1.2, label=lab + ' turn (deg)')
    ax[0].plot(t[m], -np.array(ch['aLy'])[m] * hh * 0.25, color=col, lw=0.6, ls=':', label=lab + ' left hand lift, a quarter size')
    if c == len(T) - 1:
        env = np.array(d['env']); te = np.arange(len(env)) / 100; me = (te >= t0) & (te <= t1); ax[3].fill_between(te[me], env[me], color='#bbb')
        for w in d['words']:
            if t0 <= w[0] <= t1: ax[3].text(w[0], 1.02, str(w[2]), fontsize=6, rotation=60)
for a in ax[:3]: a.legend(fontsize=6, loc='upper right', ncol=4); a.grid(alpha=0.3)
ax[3].set_ylim(0, 1.4); plt.tight_layout(); plt.savefig(out, dpi=100); print(out)

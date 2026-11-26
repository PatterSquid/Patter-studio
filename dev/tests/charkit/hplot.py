# hplot.py out.png t0 t1 trace.json[:label] ...  : the left hand over a stretch: wrist up and across, turn, drawing, the voice's loudness, words and nods
import sys, json, numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
out, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); T = [(a.split(':')[0], a.split(':')[1] if ':' in a else a) for a in sys.argv[4:]]
fig, ax = plt.subplots(4, 1, figsize=(15, 8), sharex=True)
cols = ['#888', '#d60', '#06c']
for c, (f, lab) in enumerate(T):
    d = json.load(open(f)); ch = d['ch']; n = len(ch['aLy']); t = np.arange(n) / 60; m = (t >= t0) & (t <= t1); col = cols[c % 3]
    ax[0].plot(t[m], -np.array(ch['aLy'])[m], color=col, lw=1.3, label=lab + ' wrist up'); ax[0].plot(t[m], np.array(ch['aLx'])[m], color=col, lw=0.8, ls='--', label=lab + ' across')
    ax[1].plot(t[m], np.degrees(np.array(ch['aLr'])[m]), color=col, lw=1.2, label=lab + ' turn (deg)')
    v = np.gradient(np.array(ch['aLy'])) * 60; ax[2].plot(t[m], -v[m], color=col, lw=1, label=lab + ' wrist speed up (head heights a second)')
    art = ch['aLart']; 
    for i in range(1, n):
        if art[i] != art[i - 1] and t0 <= t[i] <= t1: ax[1].axvline(t[i], color=col, lw=0.6, alpha=0.6); ax[1].text(t[i], ax[1].get_ylim()[1], art[i] or 'desk', fontsize=6, color=col, rotation=90, va='top')
    if c == len(T) - 1:
        env = np.array(d['env']); te = np.arange(len(env)) / 100; me = (te >= t0) & (te <= t1); ax[3].fill_between(te[me], env[me], color='#bbb')
        for w in d['words']:
            if t0 <= w[0] <= t1: ax[3].text(w[0], 1.02, str(w[2]), fontsize=6, rotation=60)
        for nd in d.get('nods', []):
            tt = nd['t'] if isinstance(nd, dict) else nd[0]
            if t0 <= tt <= t1:
                for a in ax[:3]: a.axvline(tt, color='#090', lw=0.5, alpha=0.5)
for a in ax[:3]: a.legend(fontsize=6, loc='upper right', ncol=3); a.grid(alpha=0.3)
ax[3].set_ylim(0, 1.4); plt.tight_layout(); plt.savefig(out, dpi=100); print(out)

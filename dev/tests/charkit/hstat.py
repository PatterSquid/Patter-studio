# hstat.py trace.json ...  : how the left hand behaves while it is up (well clear of a change of drawing)
import sys, json, numpy as np
for f in sys.argv[1:]:
    d = json.load(open(f)); ch = d['ch']; art = ch['aLart']; n = len(art); y = np.array(ch['aLy']); x = np.array(ch['aLx']); r = np.degrees(np.array(ch['aLr']))
    chg = [i for i in range(1, n) if art[i] != art[i - 1]]; near = np.zeros(n, bool)
    for i in chg: near[max(0, i - 12):i + 12] = True
    up = np.array([bool(art[i]) and not near[i] for i in range(n)]); idx = np.where(up[1:])[0] + 1
    vy = np.abs(np.diff(y))[idx - 1] * 60; vx = np.abs(np.diff(x))[idx - 1] * 60; vr = np.abs(np.diff(r))[idx - 1] * 60
    frozen = (np.hypot(vy, vx) < 0.008) & (vr < 1.5)
    # longest frozen run
    run = best = 0
    for k in frozen:
        run = run + 1 if k else 0; best = max(best, run)
    jump = max(abs(r[i] - r[i - 1]) for i in chg) if chg else 0
    print('%-12s up %2.0f%% | changes of drawing %d | held still %2.0f%% of the time it is up, longest %.2f s | wrist %.3f hh/s, turn %.1f deg/s | turn step at a change up to %.0f deg' % (f.split('/')[-1][:12], 100 * sum(1 for a in art if a) / n, len(chg), 100 * frozen.mean(), best / 60, np.hypot(vy, vx).mean(), vr.mean(), jump))

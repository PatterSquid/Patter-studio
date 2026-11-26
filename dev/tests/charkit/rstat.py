# rstat.py trace.json ...  : what the right hand does: how far it travels and turns, how much of the time it is dead still, against the left
import sys, json, numpy as np
for f in sys.argv[1:]:
    d = json.load(open(f)); ch = d['ch']; hh = d.get('hh', 588); out = []
    for sd in 'RL':
        x = (np.array(ch['a%sx' % sd]) + np.array(ch['sx'])) * hh; y = np.array(ch['a%sy' % sd]) * hh; r = np.degrees(np.array(ch['a%sr' % sd])); art = ch['a%sart' % sd]
        v = np.hypot(np.diff(x), np.diff(y)) * 60; vr = np.abs(np.diff(r)) * 60; still = (v < 3) & (vr < 0.8)
        run = best = 0
        for k in still:
            run = run + 1 if k else 0; best = max(best, run)
        out.append('%s: path %5.0f px, turned %5.0f deg in all, dead still %2.0f%% of the minute (longest %.1f s), off the desk at most %3.0f px, drawings %s' % (sd, v.sum() / 60, vr.sum() / 60, 100 * still.mean(), best / 60, -y.min(), sorted(set(a for a in art if a))))
    print(f.split('/')[-1][:12], '\n   ' + '\n   '.join(out))

import json, sys
d = json.load(open(sys.argv[1])); W = d['words']; V = d['vis']
for a in range(2, len(sys.argv), 2):
    t0, t1 = float(sys.argv[a]), float(sys.argv[a + 1]); out = []
    for i, w in enumerate(W):
        if w[0] < t0 or w[0] > t1: continue
        nx = W[i + 1][0] if i + 1 < len(W) else w[1] + 0.3
        vs = [v for v in V if w[0] - 0.045 <= v[0] < nx - 0.045]
        out.append('%s[%.2f-%.2f] ' % (w[2], w[0], w[1]) + ' '.join('%s@%.2f' % (v[1], v[0]) for v in vs))
    print(' | '.join(out)); print()

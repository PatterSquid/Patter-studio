# vscore.py trace.json [more.json]  : our mouth shapes against a phone by phone reference (PocketSphinx on his recording; a measuring stick only)
import sys, json, numpy as np
import os
REF = json.load(open(os.environ.get('REF', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tmp_ref_ps.json'))))
CLS = {}
for p in 'M B P'.split(): CLS[p] = 'M'
for p in 'F V'.split(): CLS[p] = 'F'
for p in 'AA AE AH AY AW'.split(): CLS[p] = 'A'
for p in 'EH EY IH IY'.split(): CLS[p] = 'E'
for p in 'OW AO OY'.split(): CLS[p] = 'O'
for p in 'UW UH W'.split(): CLS[p] = 'W'
for p in 'ER R'.split(): CLS[p] = 'R'
for p in 'L TH DH'.split(): CLS[p] = 'L'
for p in 'S Z SH CH JH ZH'.split(): CLS[p] = 'S'
for p in 'T D K G N NG HH Y'.split(): CLS[p] = 'D'
OURS = {'M': 'M', 'Neutral': 'M', 'F': 'F', 'Aa': 'A', 'Uh': 'A', 'Ee': 'E', 'Oh': 'O', 'W-Oo': 'W', 'R': 'R', 'L': 'L', 'S': 'S', 'D': 'D'}
OPEN_R = {'M': 0, 'F': 0.1, 'A': 1, 'E': 0.45, 'O': 0.6, 'W': 0.3, 'R': 0.3, 'L': 0.4, 'S': 0.15, 'D': 0.25}
OPEN_O = {'Aa': 1, 'Uh': 0.6, 'Oh': 0.62, 'L': 0.5, 'Ee': 0.34, 'D': 0.3, 'R': 0.28, 'W-Oo': 0.3, 'S': 0.16, 'F': 0.1, 'M': 0, 'Neutral': 0}
VOW = set('AEO') | {'W'}
def score(f):
    d = json.load(open(f)); V = d['vis']; LEAD = 0.04
    def at(t):   # our shape showing at sound time t (the picture leads the sound)
        t -= LEAD; lo, hi = 0, len(V) - 1
        if t < V[0][0]: return 'Neutral'
        while lo < hi:
            m = (lo + hi + 1) // 2
            if V[m][0] <= t: lo = m
            else: hi = m - 1
        return V[lo][1]
    n = {'vow': 0, 'vowOpen': 0, 'vowCls': 0, 'lips': 0, 'lipsHit': 0, 'fv': 0, 'fvHit': 0, 'shut': 0}; ro, oo = [], []
    for w in REF:
        if not w.get('ph'): continue
        for ph, a, b in w['ph']:
            c = CLS.get(ph.rstrip('012'));
            if not c: continue
            ts = np.arange(a, b, 0.01)
            for t in ts: ro.append(OPEN_R[c]); oo.append(OPEN_O.get(at(t), 0.3))
            mid = (a + b) / 2; near = [at(t) for t in np.arange(max(a, mid - 0.04), min(b, mid + 0.04) + 1e-6, 0.01)] or [at(mid)]
            if c in VOW and ph.rstrip('012') != 'W' and b - a >= 0.05:
                n['vow'] += 1; n['vowOpen'] += any(v in ('Aa', 'Uh', 'Oh', 'Ee', 'W-Oo') for v in near); n['vowCls'] += any(OURS.get(v) == c or (c == 'A' and v in ('Aa', 'Uh')) for v in near); n['shut'] += all(v in ('Neutral', 'M') for v in near)
            if c == 'M': n['lips'] += 1; n['lipsHit'] += any(at(t) in ('M', 'Neutral') for t in np.arange(a - 0.03, b + 0.031, 0.01))
            if c == 'F': n['fv'] += 1; n['fvHit'] += any(at(t) == 'F' for t in np.arange(a - 0.03, b + 0.031, 0.01))
    # the mouth against the sound itself: how open it is, moment by moment, beside how loud he is (mouth opening follows the loudness of speech: Chandrasekaran and others 2009)
    env = np.array(d['env']); fps = d['efps']; tt = np.arange(len(env)) / fps; op = np.array([OPEN_O.get(at(t), 0.3) for t in tt]); k = np.ones(5) / 5; ops = np.convolve(op, k, 'same'); sp = np.convolve(env > 0.12, np.ones(31), 'same') > 0
    renv = np.corrcoef(ops[sp], env[sp])[0, 1]
    ro, oo = np.array(ro), np.array(oo); dur = [b[0] - a[0] for a, b in zip(V, V[1:]) if a[1] != 'Neutral']
    print('%-22s vowels shown as a vowel %3d%%  right shape %3d%%  shut on a vowel %2d%% (of %d) | lips shut on M B P %3d%% (%d) | teeth on lip F V %3d%% (%d) | open with loud r %.2f | shapes %d, median %.0f ms, under 50 ms: %d' % (f.split('/')[-1], 100 * n['vowOpen'] / n['vow'], 100 * n['vowCls'] / n['vow'], 100 * n['shut'] / n['vow'], n['vow'], 100 * n['lipsHit'] / max(1, n['lips']), n['lips'], 100 * n['fvHit'] / max(1, n['fv']), n['fv'], renv, len(dur), 1000 * np.median(dur), sum(1 for x in dur if x < 0.05)))
for f in sys.argv[1:]: score(f)

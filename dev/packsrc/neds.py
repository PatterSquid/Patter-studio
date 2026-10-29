"""Neds and a goth: goth hair and the 'Buckie ambush' set piece. Writes ../../packs/neds.json"""
import json, math, os

def circ(cx, cy, rx, ry=None, a0=0, a1=2 * math.pi, n=24):
    ry = ry or rx
    return [[round(cx + math.cos(a0 + (a1 - a0) * i / n) * rx, 3), round(cy + math.sin(a0 + (a1 - a0) * i / n) * ry, 3)] for i in range(n + 1)]
P = lambda p, col='white', w=5, fill=False: {'p': p, 'col': col, 'w': w, 'fill': fill}

# Goth hair, in head sizes around the middle of the head (+x is the way they face): long straight sides, a heavy
# fringe swept over the front eye
goth = [
    P(circ(0, -0.05, 1.12, 1.12, math.pi * 1.02, math.pi * 1.98, 18), 'grey', 6),
    P([[-1.06, -0.3], [-1.18, 0.5], [-1.12, 1.55]], 'grey', 6), P([[-0.85, -0.2], [-0.95, 0.7], [-0.9, 1.5]], 'grey', 4),
    P([[1.06, -0.3], [1.16, 0.5], [1.08, 1.45]], 'grey', 6),
    P([[-0.7, -0.95], [0.15, -1.05], [0.85, -0.55], [0.82, 0.12], [0.55, 0.28], [0.4, -0.12], [-0.1, -0.45], [-0.7, -0.95]], 'grey', 4, '#141414'),
]
hats = [{'id': 'gothhair', 'label': 'Goth hair', 'paths': goth, 'top': 1.3}]

A = lambda who, k, start, dur=None, **kw: dict({'who': who, 'k': k, 'start': start, **({'dur': dur} if dur else {})}, **kw)
N1, N2, G = 'ned', 'ned2', 'goth'
sc = {'region': 'europe', 'era': 'modern', 'place': 'outdoors', 'weather': 'rain', 'label': 'Glasgow',
      # The goth goes first so older versions (which place people in list order) aim at where he really is
      'people': [{'pid': G, 'start': 'off right', 'holding': ''}, {'pid': N1, 'start': 'left', 'holding': 'bottle'}, {'pid': N2, 'start': 660, 'holding': 'bottle'}],
      'acts': [
          A(N1, 'drink', 0.4, 1.8), A(N2, 'drink', 0.9, 1.8),
          A(G, 'walk', 1.2, 3.4, to=1240),
          A(N1, 'say', 2.7, 2.0, text="Here Scotty, clock the state o' this"),
          A(N2, 'shout', 4.9, 2.0, text='HAW! YA ABSOLUTE GIMP!'),
          A(G, 'say', 7.1, 2.2, text="It's no a phase, mate."),
          A(N1, 'walk', 9.4, 1.6, to='@' + G),
          A(N1, 'smash', 11.1, 1.8, to=G),
          A(N2, 'laugh', 12.4, 1.4),
          A(N1, 'walk', 13.0, 0.8, to=880),
          A(N2, 'walk', 13.9, 1.0, to='@' + G),
          A(N2, 'pish', 15.0, 3.0),
          A(N1, 'laugh', 15.2, 2.2),
          A(N1, 'run', 18.2, 1.3, to='off left', face='happy'),
          A(N2, 'run', 18.4, 1.6, to='off left', face='happy'),
          A(G, 'say', 20.2, 2.6, text="...That's going in my poetry."),
      ], 'extra': []}
cast = [{'role': N1, 'name': 'Tam', 'sex': 'man', 'colour': 'white', 'hat': 'cap'},
        {'role': N2, 'name': 'Scotty', 'sex': 'man', 'colour': 'blue', 'hat': 'cap', 'beard': 'stubble'},
        {'role': G, 'name': 'Damien', 'sex': 'man', 'colour': 'black', 'hat': 'gothhair'}]
pack = {'format': 1, 'id': 'neds', 'name': 'Neds and a goth', 'version': 3,
        'description': 'Goth hair and the Buckie ambush: two neds on the Buckie, a goth walking past, a bottle, a pish and a runner.',
        'hats': hats, 'setpieces': [{'id': 'buckie_ambush', 'name': 'Buckie ambush', 'note': 'Two neds slag a goth, bottle him, pish on him and leg it.', 'cast': cast, 'scenes': [sc], 'layers': []}]}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packs', 'neds.json')
json.dump(pack, open(out, 'w'), separators=(',', ':'))
print(out, len(json.dumps(pack)))

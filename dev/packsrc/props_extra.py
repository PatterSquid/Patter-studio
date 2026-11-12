"""Extra props: a football, a seagull (held by the legs, for swinging) and a takeaway delivery bag. Coordinates in pixels
around the holding hand (a bottle is about 70 tall)."""
import json, math, os
def circ(cx, cy, r, n=18): return [[round(cx + r * math.cos(i / n * 2 * math.pi), 1), round(cy + r * math.sin(i / n * 2 * math.pi), 1)] for i in range(n + 1)]
football = {'id': 'football', 'label': 'Football', 'flip': True, 'grip': {},
  'paths': [{'p': circ(0, -24, 24), 'col': 'white', 'w': 4, 'fill': True},
            {'p': [[-8, -32], [0, -38], [8, -32], [5, -22], [-5, -22], [-8, -32]], 'col': 'white', 'w': 3, 'fill': '#f2efe6'},
            {'p': [[-8, -32], [-20, -34]], 'col': 'white', 'w': 2.5}, {'p': [[8, -32], [20, -34]], 'col': 'white', 'w': 2.5},
            {'p': [[-5, -22], [-12, -8]], 'col': 'white', 'w': 2.5}, {'p': [[5, -22], [12, -8]], 'col': 'white', 'w': 2.5}]}
# seagull hanging from the hand by its feet: body below, wings flopping, beak with the red spot
seagull = {'id': 'seagull', 'label': 'Seagull', 'flip': True, 'grip': {},
  'paths': [{'p': [[0, 0], [-3, 14]], 'col': 'orange', 'w': 3}, {'p': [[0, 0], [4, 14]], 'col': 'orange', 'w': 3},
            {'p': [[-14, 16], [14, 16], [18, 40], [10, 66], [0, 72], [-10, 66], [-18, 40], [-14, 16]], 'col': 'white', 'w': 4, 'fill': True},
            {'p': [[-16, 22], [-46, 30], [-60, 54], [-34, 48], [-18, 42]], 'col': 'grey', 'w': 4, 'fill': '#bfc3c7'},
            {'p': [[16, 22], [46, 30], [60, 54], [34, 48], [18, 42]], 'col': 'grey', 'w': 4, 'fill': '#bfc3c7'},
            {'p': circ(0, 82, 11, 12), 'col': 'white', 'w': 4, 'fill': True},
            {'p': [[-4, 92], [0, 108], [4, 92]], 'col': 'yellow', 'w': 4}, {'p': [[0, 102], [2, 104]], 'col': 'red', 'w': 4},
            {'p': [[-4, 80], [-3, 81]], 'col': 'black', 'w': 4}, {'p': [[4, 80], [5, 81]], 'col': 'black', 'w': 4}]}
takeaway = {'id': 'takeaway', 'label': 'Delivery bag', 'flip': True, 'grip': {'side': 'back', 'at': [-0.06, 0.29], 'carry': True},
  'paths': [{'p': [[-34, 6], [34, 6], [34, 70], [-34, 70], [-34, 6]], 'col': 'green', 'w': 5, 'fill': '#2f6b3a'},
            {'p': [[-14, 6], [-10, -10], [10, -10], [14, 6]], 'col': 'green', 'w': 4},
            {'p': [[-22, 30], [22, 30]], 'col': 'white', 'w': 3}, {'p': [[-16, 44], [16, 44]], 'col': 'white', 'w': 3}]}
pack = {'format': 1, 'id': 'extras', 'name': 'Extra props', 'version': 1, 'description': 'A football, a seagull to swing and a delivery bag.', 'props': [football, seagull, takeaway]}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packs', 'extras.json'); json.dump(pack, open(out, 'w'), indent=1); print('wrote', out)

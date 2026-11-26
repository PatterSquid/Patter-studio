# Reference alignment with PocketSphinx: words and phones with times. usage: psalign.py wav16k text out.json
import sys, json, re, wave
import numpy as np
from pocketsphinx import Decoder
wav, txt, out = sys.argv[1:4]
w = wave.open(wav); raw = w.readframes(w.getnframes()); w.close()
text = open(txt).read()
words = [re.sub(r"[^a-z']", '', x) for x in text.lower().replace('’', "'").split()]
NUM = {'17': 'seventeen'}
words = [NUM.get(x, x) for x in [re.sub(r"[^a-z0-9']", '', y) for y in text.lower().replace('’', "'").split()] if x]
words = [re.sub(r"[^a-z']", '', x) for x in words]; words = [x for x in words if x]
d = Decoder(samprate=16000, loglevel='FATAL', beam=1e-80, wbeam=1e-60, pbeam=1e-80)
# letter to sound for words the dictionary lacks (rough, only so the alignment can pass through them)
L2S = {'a':'AE','b':'B','c':'K','d':'D','e':'EH','f':'F','g':'G','h':'HH','i':'IH','j':'JH','k':'K','l':'L','m':'M','n':'N','o':'AA','p':'P','q':'K','r':'R','s':'S','t':'T','u':'AH','v':'V','w':'W','x':'K S','y':'IY','z':'Z'}
DG = [('sh','SH'),('ch','CH'),('th','TH'),('ee','IY'),('oo','UW'),('ou','AW'),('ow','AW'),('ai','EY'),('ay','EY'),('ea','IY'),('ck','K'),('ng','NG'),('er','ER')]
def g2p(w):
    o=[]; i=0; w=w.replace("'", '')
    while i < len(w):
        for a,b in DG:
            if w.startswith(a,i): o.append(b); i+=len(a); break
        else:
            if i>0 and w[i]==w[i-1]: i+=1; continue
            o.append(L2S.get(w[i],'AH')); i+=1
    return ' '.join(o)
oov=[]
for x in set(words):
    if d.lookup_word(x) is None: d.add_word(x, g2p(x), False); oov.append(x)
print('oov', oov)
d.set_align_text(' '.join(words)); d.start_utt(); d.process_raw(raw, no_search=False, full_utt=True); d.end_utt()
segs = [(s.word, s.start_frame, s.end_frame) for s in d.seg()]
print('word segs', len(segs), 'of', len(words))
json.dump([(s[0], s[1]/100, (s[2]+1)/100) for s in segs if s[0] not in ('<sil>','(NULL)','<s>','</s>','[NOISE]','[SPEECH]')], open(out.replace('ref_ps','ref_words'),'w'))
res=[]; SR=16000
real=[s for s in segs if s[0] not in ('<sil>','(NULL)','<s>','</s>','[NOISE]','[SPEECH]')]
# chunks: runs of words between silences of 0.25 s or more
chunks=[]; cur=[]
for i,sg in enumerate(real):
    if cur and sg[1]-cur[-1][2] > 25: chunks.append(cur); cur=[]
    cur.append(sg)
if cur: chunks.append(cur)
fail=0
for ch in chunks:
    a=max(0,ch[0][1]-12); b=ch[-1][2]+12; piece=raw[a*160*2:b*160*2]
    try:
        d.set_align_text(' '.join(re.sub(r"\(\d+\)$",'',x[0]) for x in ch)); d.start_utt(); d.process_raw(piece, no_search=False, full_utt=True); d.end_utt()
        d.set_alignment(); d.start_utt(); d.process_raw(piece, no_search=False, full_utt=True); d.end_utt()
        for wd in d.get_alignment():
            if wd.name in ('<sil>','(NULL)','<s>','</s>'): continue
            res.append({'w': wd.name, 'a': (a+wd.start)/100, 'b': (a+wd.start+wd.duration)/100, 'ph': [(p.name, (a+p.start)/100, (a+p.start+p.duration)/100) for p in wd]})
    except Exception as e:
        fail+=1
        for x in ch: res.append({'w': x[0], 'a': x[1]/100, 'b': (x[2]+1)/100, 'ph': None})
json.dump(res, open(out,'w')); print(len(chunks),'chunks', fail,'without phones;', len(res), 'words; first', [(r['w'], r['a'], r['b']) for r in res[:8]])

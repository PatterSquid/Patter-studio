/* Semantics: what the words are doing, for choosing gestures by meaning (McNeill 1992: deictic, metaphoric and beat
   gestures; Kendon 2004: the palm up and palm down families; Calbris 2011: negation and totality; Cassell and others
   2001, BEAT: a gesture belongs on the new or contrasted part of a sentence). No dictionary of English: small word
   classes, Glasgow included, that cover what a talker to camera does with his hands and head. Words in, per word classes
   and per sentence facts out. */
'use strict';
const Semantics = (() => {
  const C = {}; const add = (k, words) => words.split(' ').forEach(w => { (C[w] = C[w] || []).push(k); });
  add('you', 'you your yours yourself yourselves youse yous ye yer yersel');
  add('self', 'i me my mine myself ah ma masel im ive ill id');
  add('here', 'this here now today these tonight');
  add('there', 'that there those them they their over yonder thon');
  add('neg', 'no not never nothing none nobody nowhere neither nor naw nae nane nope cannae dinnae didnae wisnae isnae wouldnae couldnae shouldnae havenae hasnae willnae winnae arenae werenae doesnae cannot aint');
  add('all', 'all every everyone everybody everything everywhere whole entire always completely totally massive huge enormous giant biggest million millions billion billions thousands hundreds hunners loads tons everywan');
  add('small', 'wee tiny small little slightly barely hardly few');
  add('intens', 'really very pure proper absolutely literally totally completely utterly seriously genuinely honestly actually fucking fuckin bloody absolute total complete');
  add('affirm', 'yes aye yeah yep exactly correct sure definitely certainly obviously course');
  add('doubt', 'maybe mibbe perhaps possibly probably apparently supposedly allegedly somehow suppose guess dunno unsure whatever kinda sorta');
  add('contrast', 'but however although though whereas instead yet otherwise except despite');
  add('list', 'first firstly second secondly third thirdly next finally lastly another plus');
  add('wh', 'what why how who where when which whit whose');
  add('stop', 'stop wait whoa woah hold enough');
  add('think', 'think thought know reckon believe remember imagine wonder mean idea understand');
  add('look', 'look see listen watch');
  add('greet', 'hello hi hiya hey welcome cheerio bye goodbye tara');
  add('good', 'good great brilliant class magic best love amazing perfect belter quality fantastic lovely beautiful nice happy glad win won winning proud');
  add('bad', 'bad terrible awful horrible horrific worst hate disgrace disgusting shite pish rubbish crap useless joke ridiculous stupid idiot idiots eejit dafty daft mental insane nightmare disaster broken failed failing wrong worse sick sad dead died killed crime violence unbelievable');
  add('swear', 'fuck fucking fuckin fucks fucked bastard bastards arse bawbag prick pricks wanker wankers cunt cunts shite pish');
  add('rage', 'shut banned raging furious fuming');
  add('num', 'one two three four five six seven eight nine ten');
  add('because', 'because cause cos basically reason problem thing point');
  const plain = w => String(w || '').toLowerCase().replace(/[^a-z']/g, '').replace(/'/g, '');
  function classes(w) { const p = plain(w), out = (C[p] || []).slice(); if (/(nt|nae)$/.test(p) && /^(do|does|did|is|was|were|are|would|could|should|have|has|had|will|wo|ca|can|might|must|ai|wis|wid|cud|hav|huv)(nt|nae)$/.test(p) && !out.includes('neg')) out.push('neg'); return out; }
  /* words: LipSync's [t0, t1, raw, index, plain]. */
  function read(words) {
    const W = words || [], cls = W.map(w => classes(w[4] || w[2])), has = (i, k) => cls[i] && cls[i].includes(k), sents = []; let a = 0;
    W.forEach((w, i) => { const raw = String(w[2] || ''), end = /[.!?]["')\]]*$/.test(raw) || i === W.length - 1 || (W[i + 1][0] - w[1] > 0.7);
      if (!end) return; const ids = []; for (let j = a; j <= i; j++) ids.push(j);
      let val = 0, sw = 0, neg = 0; ids.forEach(j => { if (has(j, 'good')) val += 1; if (has(j, 'bad')) val -= 1; if (has(j, 'swear')) sw++; if (has(j, 'rage')) val -= 1; if (has(j, 'neg')) neg++; });
      if (neg % 2 === 1 && val > 0) val = -val * 0.5;   // "not good"
      const caps = ids.some(j => { const r = String(W[j][2] || '').replace(/[^A-Za-z]/g, ''); return r.length >= 3 && r === r.toUpperCase(); });
      sents.push({ a, b: i, t0: W[a][0], t1: w[1], q: /\?/.test(raw), ex: /!/.test(raw), ex2: /!!|\?!/.test(raw), wh: has(a, 'wh') || (ids.length > 1 && has(a + 1, 'wh') && ids.length < 4), neg: neg > 0, val, swear: sw, caps, doubt: ids.some(j => has(j, 'doubt')), n: ids.length });
      a = i + 1; });
    return { cls, sents, has };
  }
  return { read, classes, plain };
})();
if (typeof module !== 'undefined') module.exports = Semantics;

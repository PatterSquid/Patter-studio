/* lexgen.js cmudict.dict words.txt [count] : writes src/lexicon.js, how common words are said, for the mouth.
   The spelling rules in lipsync.js guess a word's sounds from its letters; English spelling being what it is, they get the
   vowel wrong in about one common word in three ("four" as ah oo, "walk" as al k, "fought" as ah oo t). This takes the
   pronunciations of the most used words from the CMU Pronouncing Dictionary (Carnegie Mellon University, BSD style
   licence: see assets/cmudict-LICENSE; github.com/cmusphinx/cmudict) and keeps, for every word whose mouth shapes the
   rules would get visibly wrong, a short code: one letter per sound, as LipSync.LEXU reads them.
   words.txt is any list of words, most used first (here the top of the wordfreq package's English list; only the order
   is used, nothing of it is kept). Run again only to change the list: node lexgen.js cmudict.dict words.txt 12000 */
const fs = require('fs'), path = require('path'); const LipSync = require('./src/lipsync.js');
const [dictF, wordsF, countS] = process.argv.slice(2), COUNT = +countS || 20000;
const PH = { AA: 'A', AE: 'A', AH: 'U', AO: 'O', AW: 'AW', AY: 'AE', EH: 'E', ER: 'R', EY: 'E', IH: 'E', IY: 'E', OW: 'O', OY: 'OE', UH: 'W', UW: 'W', B: 'b', P: 'b', M: 'm', F: 'f', V: 'f', S: 's', Z: 's', SH: 's', ZH: 's', CH: 's', JH: 's', T: 't', D: 't', K: 'k', G: 'k', N: 'n', NG: 'n', HH: 'h', L: 'l', R: 'r', W: 'w', Y: 'y', TH: 'T', DH: 'T' };
const dict = {}; fs.readFileSync(dictF, 'utf8').split('\n').forEach(line => { const m = /^([a-z']+)(\(\d+\))? (.+?)(\s+#.*)?$/.exec(line.trim()); if (!m || m[2]) return; dict[m[1]] = m[3].split(' ').map(p => PH[p.replace(/\d/g, '')] || '').join(''); });
const codeOf = units => units.map(u => LipSync.unitCode(u)).join('');
// what the eye can tell apart: the sounds made out of sight (K G N NG H) and the quick T and D count for nothing, uh and ah are both an open mouth,
// B and M are both closed lips, TH and L both show the tongue, er is an R whether it is the vowel or not
const seen = c => c.replace(/[knht]/g, '').replace(/U/g, 'A').replace(/R/g, 'r').replace(/b/g, 'm').replace(/T/g, 'l').replace(/(.)\1+/g, '$1');
let kept = [], same = 0, missing = 0, n = 0;
for (const w of fs.readFileSync(wordsF, 'utf8').split('\n')) { if (n >= COUNT) break; if (!/^[a-z']+$/.test(w) || w.length > 18) continue; n++; const d = dict[w]; if (!d) { missing++; continue; } if (LipSync._EX[w.replace(/'/g, '')]) continue;   // the hand written list wins
  const P = LipSync.parse(w, true); const mine = P.words.length === 1 ? codeOf(P.words[0].units) : '?'; if (seen(mine) === seen(d)) { same++; continue; } kept.push(w.replace(/'/g, '') + ':' + d); }
kept = [...new Set(kept)];
const out = `/* How common words are said, where the spelling rules in lipsync.js would get the mouth wrong. Made by dev/lexgen.js from the
   CMU Pronouncing Dictionary (Copyright (C) 1993-2015 Carnegie Mellon University; licence in assets/cmudict-LICENSE).
   word:code, one letter a sound (LipSync.LEXU). ${kept.length} words. */
const LEXICON = ${JSON.stringify(kept.join('|'))};
if (typeof module !== 'undefined') module.exports = LEXICON;
`;
fs.writeFileSync(path.join(__dirname, 'src/lexicon.js'), out); console.log('looked at', n, 'in the dictionary', n - missing, 'rules already right', same, 'kept', kept.length, 'bytes', out.length);

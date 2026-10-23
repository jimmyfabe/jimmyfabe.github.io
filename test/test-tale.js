// Tester sætningslisten til klodsespillenes stemme (vaerktoej/tale-saetninger.json) mod koden:
// hver nøgle, spil.js kan sige, har en sætning, og sætningerne følger reglerne for Røst-klip
// (ingen cifre, højst 12 ord, «klodser» og aldrig «LEGO»).
//   node test/test-tale.js
const fs = require('fs'), path = require('path');
const ROD = path.join(__dirname, '..');
const liste = JSON.parse(fs.readFileSync(path.join(ROD, 'vaerktoej/tale-saetninger.json'), 'utf8'));
const spil = fs.readFileSync(path.join(ROD, 'spil.js'), 'utf8');

const resultater = [];
function tjek(navn, ok, detalje) { resultater.push([ok ? 'OK  ' : 'FEJL', navn, detalje || '']); }
const findes = n => { const [s, k] = n.split('.'); return !!(liste[s] && Object.prototype.hasOwnProperty.call(liste[s], k)); };

// Alle hele nøgler, der står som tekst i spil.js ('husk.se', 'faelles.ros-1' …; ikke stammen 'faelles.intro-'),
// plus intro-<figur> fra skallerne
const iKoden = [...new Set((spil.match(/'(?:faelles|husk|byg|spejl)\.[a-z0-9-]*[a-z0-9]'/g) || []).map(s => s.slice(1, -1)))];
const figurer = ['alma-dino.html', 'ella-prinsesse.html']
  .map(f => /figur: '([a-z]+)'/.exec(fs.readFileSync(path.join(ROD, f), 'utf8')))
  .map(m => m && m[1]);
const noegler = iKoden.concat(figurer.map(f => 'faelles.intro-' + f));
const mangler = noegler.filter(n => !findes(n));
tjek('nøglerne i spil.js findes (mindst 15)', iKoden.length >= 15, iKoden.length + ' nøgler');
tjek('begge skaller har en figur', figurer.every(Boolean), figurer.join(', '));
tjek('hver nøgle i spil.js har en sætning', mangler.length === 0, mangler.join(', '));
tjek('intro-nøglen sættes sammen af faelles.intro- og T.figur', /'faelles\.intro-' \+ T\.figur/.test(spil));

const alle = [];
for (const sprite of Object.keys(liste)) for (const k of Object.keys(liste[sprite])) alle.push([sprite + '.' + k, liste[sprite][k]]);
tjek('sprite- og klipnavne er små bogstaver, tal og bindestreg (som laesIndeks kræver)',
     Object.keys(liste).every(s => /^[a-z]+$/.test(s)) && alle.every(([n]) => /^[a-z]+\.[a-z0-9-]+$/.test(n)));
const medCifre = alle.filter(([, s]) => /\d/.test(s));
tjek('ingen cifre i sætningerne (tal skrives som ord)', medCifre.length === 0, medCifre.map(x => x[0]).join(', '));
const lange = alle.filter(([, s]) => s.split(/\s+/).filter(Boolean).length > 12);
tjek('højst 12 ord pr. sætning', lange.length === 0, lange.map(x => x[0]).join(', '));
const lego = alle.filter(([, s]) => /lego/i.test(s));
tjek('stemmen siger «klodser», aldrig «LEGO»', lego.length === 0, lego.map(x => x[0]).join(', '));
const tomme = alle.filter(([, s]) => typeof s !== 'string' || !/[.!?]$/.test(s.trim()));
tjek('hver sætning er tekst og slutter med . ! eller ?', tomme.length === 0, tomme.map(x => x[0]).join(', '));

console.log('');
for (const [st, n, det] of resultater) console.log(st, n, det ? '(' + det + ')' : '');
const fejl = resultater.filter(x => x[0] === 'FEJL').length;
console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tests bestået');
process.exit(fejl ? 1 : 0);

// Tester OCR-filtrering OG rangering mod den rigtige database.
// Funktionerne er hentet direkte ud af app.js, så testen følger koden.
const fs = require('fs');
const ROD = require('path').join(__dirname, '..');   // projektmappen, uanset hvor den ligger
const DB = JSON.parse(fs.readFileSync(ROD + '/lego-saet.json', 'utf8'));
const kilde = fs.readFileSync(ROD + '/app.js', 'utf8');

function udtraek(navn) {
  const i = kilde.indexOf('function ' + navn + '(');
  if (i < 0) throw new Error('fandt ikke ' + navn + ' i app.js');
  let dybde = 0, j = kilde.indexOf('{', i);
  for (let k = j; k < kilde.length; k++) {
    if (kilde[k] === '{') dybde++;
    else if (kilde[k] === '}' && --dybde === 0) return kilde.slice(i, k + 1);
  }
}
eval(udtraek('budFraTekst'));
eval(udtraek('vaelgBedste'));

function scan(tekst) {
  const g = budFraTekst(tekst).filter(b => DB[b]);
  return g.length ? vaelgBedste(g) : null;
}

const sager = [
  ['ren æske med sætnummer',           '6075',                     '6075'],
  ['sætnummer + aldersmærke 5-12',     '5 12 6075 239',            '6075'],
  ['EAN-stregkode alene',              '5702016604818',            null],
  ['EAN + sætnummer',                  '5702016604818 77241 307',  '77241'],
  ['ÅRSTAL FØR sætnummer (faldgrube)', '1992 239 6075',            '6075'],
  ['årstal EFTER sætnummer',           '6075 1992',                '6075'],
  ['årstal 2016 + 5-cifret sæt',       '41068 43 2016',            '41068'],
  ['kun et årstal, intet andet',       '1992',                     '1992'],
  ['ren OCR-støj',                     '8 31 999999 1234567',      null],
  ['tomt billede',                     '',                         null],
  ['for korte tal',                    '5 12 88',                  null],
];

let fejl = 0;
console.log('');
for (const [navn, tekst, vent] of sager) {
  const fik = scan(tekst);
  const ok = fik === vent;
  if (!ok) fejl++;
  console.log((ok ? 'OK  ' : 'FEJL') + '  ' + navn.padEnd(34) +
              'valgte=' + String(fik).padEnd(8) + ' forventet=' + vent);
}
console.log('\n' + (sager.length - fejl) + '/' + sager.length + ' korrekte');
process.exit(fejl ? 1 : 0);

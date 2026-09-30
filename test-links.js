// Bygger adresserne med app.js' EGNE funktioner og tjekker at de svarer.
// Ingen regex — bare indexOf, så der ikke kan opstå escaping-fejl.
const fs = require('fs'), https = require('https');
const ROD = __dirname;                                 // projektmappen, uanset hvor den ligger
const kilde = fs.readFileSync(ROD + '/app.js', 'utf8');

function udtraek(navn) {
  const i = kilde.indexOf('function ' + navn + '(');
  if (i < 0) throw new Error('fandt ikke ' + navn);
  let dybde = 0, j = kilde.indexOf('{', i);
  for (let k = j; k < kilde.length; k++) {
    if (kilde[k] === '{') dybde++;
    else if (kilde[k] === '}' && --dybde === 0) return kilde.slice(i, k + 1);
  }
}
eval(udtraek('legoUrl'));
eval(udtraek('brickUrl'));

function hent(url, hop = 0) {
  return new Promise(ok => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hop < 5) {
        r.resume();
        return hent(new URL(r.headers.location, url).href, hop + 1).then(ok);
      }
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => ok({ kode: r.statusCode, krop: d, slut: url }));   // slut = adressen efter omdirigeringer
    }).on('error', e => ok({ kode: 0, krop: '', fejl: e.message }));
  });
}
function titel(krop) {
  const a = krop.indexOf('<title>');
  if (a < 0) return '';
  return krop.slice(a + 7, krop.indexOf('</title>', a)).trim();
}

const DB = JSON.parse(fs.readFileSync('./lego-saet.json', 'utf8'));

/* Familiens egne sæt */
const saet = [['6339','gammelt'], ['6075','gammelt'], ['4525','gammelt'], ['6008','gammelt'],
              ['6348','gammelt'], ['41068','nyere'], ['77241','nyt']];

/* Én prøve pr. årgang. Dette er grundlaget for at "Åbn vejledningen"
   altid peger på brickinstructions: de har hvert normalt detailsæt.
   (De 7-cifrede LEGO Education-sæt fra 2003/2004/2010 mangler, men dem
   ejer ingen børn.) Går dækningen i stykker, fanger denne test det. */
const aargange = [
  '8865','6285','9605','9452','8868','6286','8880','9609','9287','9280',
  '9780','8448','3450','10018','10030','10143','5491','10179','10189','10196',
  '10221','10224','10234','75059','76042','75827','75192','71043','75252','10276',
  '31203','10307','10316','10333','75419'
];

(async () => {
  let fejl = 0;
  console.log('\nPRIMÆR KNAP  "Åbn vejledningen"  ->  ' + brickUrl('NNNN'));
  for (const [n, slags] of saet) {
    const r = await hent(brickUrl(n));
    const t = titel(r.krop);
    const ok = r.kode === 200 && t.indexOf('set ' + n) !== -1;
    if (!ok) fejl++;
    console.log('  ' + (ok ? 'OK  ' : 'FEJL') + ' ' + n.padEnd(7) + slags.padEnd(9) +
                DB[n][1] + '  "' + t.slice(0, 46) + '"');
  }

  console.log('\nDEN GAMLE, ØDELAGTE ADRESSE (skal fejle)');
  const g = await hent('https://lego.brickinstructions.com/lego/bi/6339');
  const gOk = g.kode === 404;
  console.log('  ' + (gOk ? 'OK  ' : 'FEJL') + ' /lego/bi/6339  ->  HTTP ' + g.kode +
              (gOk ? '  (bekræfter fejlen vi rettede)' : '  (uventet!)'));
  if (!gOk) fejl++;

  console.log('\nDÆKNING PR. ÅRGANG  (grundlaget for at den store knap altid virker)');
  let har = 0;
  const mangler = [];
  for (const n of aargange) {
    const r = await hent(brickUrl(n));
    const ok = r.kode === 200 && titel(r.krop).indexOf('set ' + n) !== -1;
    if (ok) har++; else mangler.push(n + ' (' + (DB[n] ? DB[n][1] : '?') + ')');
  }
  console.log('  ' + har + ' af ' + aargange.length + ' årgange 1988-2025 dækket');
  if (mangler.length) { console.log('  MANGLER: ' + mangler.join(', ')); fejl += mangler.length; }

  /* LEGO's fodnote vælger vej ud fra årstal: nyere sæt går direkte til
     PDF-siden (ét tryk mindre), gamle får den ærlige søgeside, fordi den
     direkte side for et sæt LEGO ikke har viser "| # | 0 dele, Årstal:".
     LEGO er en SPA, så svarkoden er 200 uanset — vi kan derfor kun
     efterprøve at DEN RIGTIGE VEJ vælges, ikke indholdet. */
  console.log('\nSEKUNDÆR LINK  "LEGO’s egen vejledning (PDF)"');
  for (const [n, slags] of saet) {
    const aar = DB[n] ? DB[n][1] : 0;
    const u = legoUrl(n, aar);
    const direkte = u.indexOf('search-results') === -1;
    const forventetDirekte = aar >= 2010;
    const r = await hent(u);
    const ok = r.kode === 200 && direkte === forventetDirekte;
    if (!ok) fejl++;
    console.log('  ' + (ok ? 'OK  ' : 'FEJL') + ' ' + n.padEnd(7) + String(aar).padEnd(6) +
                (direkte ? 'direkte til PDF ' : 'ærlig søgeside  ') + 'HTTP ' + r.kode);
  }

  /* Alle kort i de to skaller (Spil + genvejsklodserne på Byg) og
     🔑-knappen i app.js. Et 200-svar er IKKE nok: 30.09.2026 svarede alle
     spil-kortene 200 — men det var LEGO's butik ("Officiel LEGO Shop"),
     ikke spil. Derfor også en butiksvagt og krav til titlen. */
  console.log('\nKORT I SKALLERNE  (Spil-fanen og genvejsklodserne)');
  const adresser = [];
  for (const fil of ['alma-dino.html', 'ella-prinsesse.html']) {
    const html = fs.readFileSync(ROD + '/' + fil, 'utf8');
    for (let i = html.indexOf("url:'"); i !== -1; i = html.indexOf("url:'", i + 5)) {
      const u = html.slice(i + 5, html.indexOf("'", i + 5));
      if (adresser.indexOf(u) === -1) adresser.push(u);
    }
  }
  const loginStart = kilde.indexOf("aabn('https://www.lego.com");
  if (loginStart === -1) { console.log('  FEJL fandt ikke 🔑-knappens adresse i app.js'); fejl++; }
  else {
    const u = kilde.slice(loginStart + 6, kilde.indexOf("'", loginStart + 6));
    if (adresser.indexOf(u) === -1) adresser.push(u);
  }
  if (adresser.length < 8) { console.log('  FEJL kun ' + adresser.length + ' adresser fundet — er formatet ændret?'); fejl++; }

  const forbudt = ['/themes/', 'plays.org', 'numuki', 'www.lego.com/da-dk/games', 'account/login'];
  for (const u of adresser) {
    const r = await hent(u);
    const t = titel(r.krop);
    const grund = [];
    if (r.kode !== 200) grund.push('HTTP ' + r.kode);
    for (const f of forbudt) if (u.indexOf(f) !== -1) grund.push('forbudt: ' + f);
    if (t.indexOf('Shop') !== -1) grund.push('ER EN BUTIK');
    if (u.indexOf('kids.lego.com') !== -1 && t.indexOf('LEGO.com for') === -1) grund.push('ikke LEGO for børn');
    /* Nedlægger LEGO en temaside og sender videre til børneforsiden, har den
       stadig titlen "LEGO.com for børn" — så kræv at vi lander hvor vi bad om */
    if (u.indexOf('kids.lego.com') !== -1 && r.slut !== u) grund.push('omdirigeret til ' + r.slut);
    if (grund.length) fejl++;
    console.log('  ' + (grund.length ? 'FEJL' : 'OK  ') + ' ' + u.replace('https://', '').slice(0, 58).padEnd(59) +
                (grund.length ? grund.join(', ') : '"' + t.slice(0, 34) + '"'));
  }

  console.log('\n' + (fejl ? fejl + ' FEJL' : 'alle adresser virker'));
  process.exit(fejl ? 1 : 0);
})();

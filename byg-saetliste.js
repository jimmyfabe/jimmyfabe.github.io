/* ==========================================================================
   byg-saetliste.js — genskaber lego-saet.json

   Appen har INGEN build-step. Dette script er kun til når sætlisten skal
   opdateres, fx et par gange om året når der er kommet nye LEGO-sæt.

   Kør:   node byg-saetliste.js
   Krav:  node + internet. Ingen API-nøgle, ingen konto.

   Kilden er Rebrickables gratis bulk-download (CC BY-licens).
   Resultatet er nummer -> [navn, år] (+ variant hvis den ikke er 1).
   Billeder behøver ikke gemmes: URL'en er altid
   https://cdn.rebrickable.com/media/sets/<nummer>-<variant>.jpg
   ========================================================================== */

const fs = require('fs');
const zlib = require('zlib');
const https = require('https');

const KILDE = 'https://cdn.rebrickable.com/media/downloads/sets.csv.gz';
const UD = 'lego-saet.json';

function hent(url) {
  return new Promise((ok, fejl) => {
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume(); return hent(r.headers.location).then(ok, fejl);
      }
      if (r.statusCode !== 200) { r.resume(); return fejl(new Error('HTTP ' + r.statusCode)); }
      const bidder = [];
      r.on('data', b => bidder.push(b));
      r.on('end', () => ok(Buffer.concat(bidder)));
    }).on('error', fejl);
  });
}

/* CSV-linje med citationstegn og kommaer inde i navne */
function linje(l) {
  const ud = []; let c = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) {
      if (ch === '"') { if (l[i + 1] === '"') { c += '"'; i++; } else q = false; }
      else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { ud.push(c); c = ''; }
    else c += ch;
  }
  ud.push(c); return ud;
}

(async () => {
  process.stdout.write('Henter ' + KILDE + ' ... ');
  const csv = zlib.gunzipSync(await hent(KILDE)).toString('utf8');
  const linjer = csv.split(/\r?\n/);
  console.log(linjer.length - 1 + ' rækker');

  /* Vælg én række pr. tal-nummer. Variant 1 vinder; ellers den med flest dele. */
  const bedste = new Map();
  const point = r => (r.variant === 1 ? 1e9 : 0) + r.dele;

  for (let i = 1; i < linjer.length; i++) {
    if (!linjer[i]) continue;
    const f = linje(linjer[i]);
    const m = /^(\d{3,7})-(\d+)$/.exec(f[0]);
    if (!m) continue;                      /* spring numre med bogstaver over */
    const rec = { navn: f[1], aar: +f[2] || 0, variant: +m[2], dele: +f[4] || 0 };
    const nu = bedste.get(m[1]);
    if (!nu || point(rec) > point(nu)) bedste.set(m[1], rec);
  }

  const db = {};
  for (const num of [...bedste.keys()].sort()) {
    const r = bedste.get(num);
    db[num] = r.variant === 1 ? [r.navn, r.aar] : [r.navn, r.aar, r.variant];
  }

  const json = JSON.stringify(db);
  fs.writeFileSync(UD, json);
  console.log('Skrev ' + UD + ': ' + Object.keys(db).length + ' sæt, ' +
              Math.round(json.length / 1024) + ' kB (' +
              Math.round(zlib.gzipSync(json).length / 1024) + ' kB gzippet)');
  console.log('Husk at committe og pushe. Appen henter den nye fil af sig selv.');
})().catch(e => { console.error('Fejl:', e.message); process.exit(1); });

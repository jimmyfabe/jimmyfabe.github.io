// Versionsnummeret (VERSION øverst i app.js) skal hæves, hver gang en fil, appen henter, ændres.
// INDHOLD ved siden af er filernes fingeraftryk for det nummer. Ændres en fil uden et nyt nummer,
// fejler testen og skriver de to nye linjer i fejlbeskeden. Testen ændrer ikke app.js selv.
//   node test/test-version.js            (tester projektmappen)
//   node test/test-version.js <mappe>    (tester en kopi, fx for at se fejlbeskeden)
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const ROD = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const appKilde = fs.readFileSync(path.join(ROD, 'app.js'), 'utf8').replace(/\r\n/g, '\n');

const resultater = [];
function tjek(navn, ok, detalje) { resultater.push([ok ? 'OK  ' : 'FEJL', navn, detalje || '']); }

// Filerne, appen henter fra egen server: SKAL i sw.js, plus sw.js selv
const swKilde = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
const SKAL = JSON.parse(/var SKAL = (\[[\s\S]*?\]);/.exec(swKilde)[1].replace(/'/g, '"'));
const FILER = SKAL.concat('sw.js');

const V_LINJE = /^var VERSION = '([^']*)';/gm;
const I_LINJE = /^var INDHOLD = '([^']*)';/gm;

// sha256 (16 tegn) over stierne og indholdet i FILER-rækkefølge. Tekstfiler regnes med LF, fordi git
// på Windows tjekker dem ud med CRLF. I app.js tæller værdierne af VERSION og INDHOLD ikke med, så et
// hævet nummer alene ikke ændrer fingeraftrykket.
function fingeraftryk() {
  const h = crypto.createHash('sha256');
  for (const f of FILER) {
    let data = fs.readFileSync(path.join(ROD, f));
    if (/\.(html|css|js|json)$/.test(f)) {
      let t = data.toString('utf8').replace(/\r\n/g, '\n');
      if (f === 'app.js') t = t.replace(V_LINJE, "var VERSION = '';").replace(I_LINJE, "var INDHOLD = '';");
      data = Buffer.from(t, 'utf8');
    }
    h.update(f + '\n').update(data).update('\n');
  }
  return h.digest('hex').slice(0, 16);
}

function toCifre(n) { return (n < 10 ? '0' : '') + n; }
const nu = new Date();
const idag = toCifre(nu.getDate()) + '-' + toCifre(nu.getMonth() + 1) + '-' + nu.getFullYear();

// 1) VERSION står én gang og kan læses af et menneske: v<løbenummer> · DD-MM-ÅÅÅÅ
const vFund = [...appKilde.matchAll(V_LINJE)];
tjek('VERSION står én gang i app.js', vFund.length === 1, vFund.length + ' gange');
const VERSION = vFund.length ? vFund[0][1] : '';
const vm1 = /^v(\d+) · (\d{2})-(\d{2})-(\d{4})$/.exec(VERSION);
let vNr = null, datoOk = false;
if (vm1) {
  vNr = +vm1[1];
  const d = new Date(+vm1[4], +vm1[3] - 1, +vm1[2]);
  datoOk = d.getDate() === +vm1[2] && d.getMonth() === +vm1[3] - 1 && d <= nu;
}
tjek('VERSION har formen v<nr> · DD-MM-ÅÅÅÅ med en rigtig dato, der ikke er i fremtiden',
     vm1 && vNr >= 1 && datoOk, "'" + VERSION + "'");

// 2) INDHOLD står én gang: v<nr>:<16 hex-tegn> — fingeraftrykket og det nummer, det blev sat for
const iFund = [...appKilde.matchAll(I_LINJE)];
tjek('INDHOLD står én gang i app.js', iFund.length === 1, iFund.length + ' gange');
const iM = /^v(\d+):([0-9a-f]{16})$/.exec(iFund.length ? iFund[0][1] : '');
tjek('INDHOLD har formen v<nr>:<16 tegn>', !!iM, iFund.length ? "'" + iFund[0][1] + "'" : '');

// 3) Alle filerne findes, ellers kan fingeraftrykket ikke regnes
const mangler = FILER.filter(f => !fs.existsSync(path.join(ROD, f)));
tjek('alle filerne i fingeraftrykket findes', mangler.length === 0,
     FILER.length + ' filer' + (mangler.length ? ', mangler: ' + mangler.join(' ') : ''));

// 4) Fingeraftrykket passer, og det er sat for det nummer, VERSION viser
if (vm1 && iM && !mangler.length) {
  const h = fingeraftryk(), iNr = +iM[1], iH = iM[2];
  let ok = false, besked = '';
  if (iNr > vNr) {
    besked = 'nummeret må ikke gå ned: VERSION er v' + vNr + ', men INDHOLD er sat for v' + iNr;
  } else if (iH === h && iNr === vNr) {
    ok = true; besked = 'v' + vNr + ', ' + FILER.length + ' filer';
  } else if (iH === h) {
    besked = "nummeret er hævet uden ændrede filer. Sæt INDHOLD i app.js til 'v" + vNr + ':' + h + "'";
  } else if (iNr === vNr) {
    besked = 'filerne er ændret siden v' + iNr + ', men nummeret er det samme. Sæt i app.js:\n' +
             "  var VERSION = 'v" + (vNr + 1) + ' · ' + idag + "';\n" +
             "  var INDHOLD = 'v" + (vNr + 1) + ':' + h + "';";
  } else {
    besked = 'filerne er ændret, og nummeret er hævet til v' + vNr + ". Sæt INDHOLD i app.js til 'v" + vNr + ':' + h + "'";
  }
  tjek('filerne er ikke ændret uden et nyt versionsnummer', ok, besked);
} else {
  tjek('filerne er ikke ændret uden et nyt versionsnummer', false, 'kan ikke regnes — se fejlene ovenfor');
}

// 5) Nummeret vises: bygVersion() laver teksten, og både 📦 Byg og «Til far» bruger den
function udtraek(navn) {
  const i = appKilde.indexOf('function ' + navn + '(');
  if (i < 0) return '';
  let dybde = 0;
  for (let k = appKilde.indexOf('{', i); k < appKilde.length; k++) {
    if (appKilde[k] === '{') dybde++;
    else if (appKilde[k] === '}' && --dybde === 0) return appKilde.slice(i, k + 1);
  }
  return '';
}
let vist = null;
if (udtraek('bygVersion')) {
  const ctx = vm.createContext({
    VERSION,
    document: { createElement: tag => ({ tagName: tag.toUpperCase(), className: '', textContent: '' }) },
  });
  vm.runInContext(udtraek('el') + '\n' + udtraek('bygVersion') + '\nvar ud = [bygVersion(), bygVersion("Version ")];', ctx);
  vist = ctx.ud;
}
tjek('bygVersion() giver en lille tekst med VERSION — ingen knap',
     !!vist && vist.every(n => n.tagName === 'P' && /\bapp-version\b/.test(n.className) && n.textContent.endsWith(VERSION)),
     vist ? vist.map(n => n.tagName + ' «' + n.textContent + '»').join(', ') : 'bygVersion mangler');
tjek('📦 Byg og «Til far» viser nummeret',
     /bygVersion\(/.test(udtraek('byg')) && /bygVersion\(/.test(udtraek('bygKopiRaekke')));

console.log('');
for (const [st, n, d] of resultater) {
  if (d.includes('\n')) console.log(st, n + ':\n     ' + d.replace(/\n/g, '\n     '));   // med linjer til app.js
  else console.log(st, n, d ? '(' + d + ')' : '');
}
const fejl = resultater.filter(x => x[0] === 'FEJL').length;
console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tests bestået');
process.exit(fejl ? 1 : 0);

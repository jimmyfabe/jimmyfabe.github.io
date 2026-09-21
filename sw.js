/* ==========================================================================
   sw.js — service worker for begge apps.

   Strategien er valgt så der IKKE skal vedligeholdes et versionsnummer:

   * HTML, CSS og JS  -> network-first. Der hentes altid nyt fra nettet når
                         appen åbnes. Cachen er kun en faldback når der ikke
                         er internet. Ingen version at huske at hæve.
   * Data og ikoner   -> cache-first med opdatering i baggrunden. De ændrer
                         sig næsten aldrig, og lego-saet.json er stor nok
                         (~225 kB gzippet) at den ikke skal hentes hver gang.
   * Ting fra CDN     -> cache-first, så skrifttype og tal-læser også
                         virker offline efter første gang.
   ========================================================================== */

var CACHE = 'lego-app-v1';

/* Skallen der skal kunne vises uden internet */
var SKAL = [
  'alma-dino.html',
  'ella-prinsesse.html',
  'app.css',
  'app.js',
  'lego-saet.json',
  'manifest-alma.json',
  'manifest-ella.json',
  'ikon-alma-180.png',
  'ikon-alma-192.png',
  'ikon-alma-512.png',
  'ikon-ella-180.png',
  'ikon-ella-192.png',
  'ikon-ella-512.png',
  'fonts/nunito-latin.woff2'
];

/* Cross-origin værter vi gerne gemmer på. Skriften ligger i repo'et nu,
   så Google Fonts er ikke med længere. */
var CDN = [
  'cdn.jsdelivr.net',
  'images.brickset.com',      /* primær kilde til sætbilleder */
  'cdn.rebrickable.com',      /* reserve, hvis Brickset mangler sættet */
  'tessdata.projectnaptha.com'
];

/* Filer der skal komme fra cachen først (ændrer sig sjældent) */
function erStabil(sti) {
  return /\.(png|jpg|jpeg|svg|webp|woff2?)$/i.test(sti) ||
         /lego-saet\.json$/.test(sti) ||
         /manifest-[a-z]+\.json$/.test(sti);
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* Én ad gangen og med catch, så én manglende fil ikke vælter hele install */
      return Promise.all(SKAL.map(function (f) {
        return c.add(new Request(f, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (navne) {
      return Promise.all(navne.map(function (n) {
        return n === CACHE ? null : caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Er det vores egen server? Kun der kan vi tvinge cachen forbi. */
function egen(req) {
  try { return new URL(req.url).origin === self.location.origin; }
  catch (e) { return false; }
}

/* fetch med tidsgrænse, så appen aldrig kan hænge på et dødt netværk.
   VIGTIGT: GitHub Pages sender Cache-Control: max-age=600. Uden
   cache:'reload' ville browserens egen HTTP-cache kunne udlevere den
   gamle fil i op til 10 minutter — også selvom vi tror vi henter nyt.
   Derfor tvinges vores egne filer altid helt ud på nettet.
   Fremmede filer (skrifttype, tal-læser) sendes videre som den
   oprindelige Request, så no-cors-hentninger stadig virker. */
function medTidsgraense(req, ms) {
  return new Promise(function (ok, fejl) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); fejl(new Error('timeout')); }, ms);
    var maal = req, init = { signal: ctrl.signal };
    if (egen(req)) {
      maal = req.url;
      init.cache = 'reload';
      init.credentials = 'same-origin';
    }
    fetch(maal, init).then(function (r) {
      clearTimeout(t); ok(r);
    }, function (err) { clearTimeout(t); fejl(err); });
  });
}

function gem(req, svar) {
  if (!svar || (svar.status !== 200 && svar.type !== 'opaque')) return svar;
  var kopi = svar.clone();
  caches.open(CACHE)
    .then(function (c) { return c.put(req, kopi); })
    .catch(function () {});           /* fx fuld kvote — cachen er kun en bonus */
  return svar;
}

/* Nettet først: altid frisk når der er forbindelse.
   Et HTTP-fejlsvar (404/503 under et halvfærdigt push, eller en dårlig dag
   hos GitHub) tæller som en fejl, så den gode kopi i cachen bruges i stedet
   for at vise barnet GitHubs fejlside. */
function netFoerst(req) {
  return medTidsgraense(req, 6000)
    .then(function (svar) {
      if (!svar || !svar.ok) throw new Error('http ' + (svar && svar.status));
      return gem(req, svar);
    })
    .catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (c) {
        /* Findes den ønskede side ikke i cachen, vises offline-siden — ALDRIG
           den anden piges app. Den ville bruge hendes localStorage-nøgle, og
           så kunne man slette sæt i den forkerte samling. */
        return c || nyOfflineSvar();
      });
    });
}

/* Cachen først, og hent stille en ny udgave til næste gang.
   Baggrundskaldet er billigt: fremmede værter sender lange max-age eller
   ETag (målt 21.09.2026), så browserens HTTP-cache svarer, eller serveren
   svarer 304. Og det er nødvendigt: sætbilleder og tal-læseren hentes
   "opaque", hvor en 503 ikke kan skelnes fra et rigtigt svar. Uden
   baggrundskaldet ville et gemt fejlsvar ligge der for altid. */
function cacheFoerst(req) {
  return caches.match(req, { ignoreSearch: false }).then(function (c) {
    if (c) {
      medTidsgraense(req, 8000).then(function (s) { gem(req, s); }).catch(function () {});
      return c;
    }
    return medTidsgraense(req, 12000)
      .then(function (s) { return gem(req, s); })
      .catch(function () { return nyOfflineSvar(); });
  });
}

function nyOfflineSvar() {
  return new Response(
    '<!DOCTYPE html><meta charset="utf-8"><title>Ingen internet</title>' +
    '<body style="font:900 20px system-ui;background:#111;color:#fff;' +
    'display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">' +
    '<div>📴<br>Der er ikke noget internet<br>' +
    '<span style="font-size:14px;opacity:.7">Prøv igen om lidt</span></div>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* Versionstjekket i app.js sender ?frisk=... — det skal aldrig røre cachen */
  if (url.searchParams.has('frisk')) return;

  if (url.origin === self.location.origin) {
    e.respondWith(erStabil(url.pathname) ? cacheFoerst(req) : netFoerst(req));
    return;
  }
  if (CDN.indexOf(url.hostname) !== -1) {
    e.respondWith(cacheFoerst(req));
  }
});

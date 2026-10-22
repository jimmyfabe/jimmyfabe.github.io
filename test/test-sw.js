// Test-stativ for sw.js: kører den i en vm med stubbede service-worker-API'er
const fs = require('fs'), vm = require('vm');
const ROD = require('path').join(__dirname, '..');   // projektmappen, uanset hvor den ligger

let netKald = [];        // hvilke URL'er gik på nettet
let netSvarer = null;    // funktion: url -> Response | throw

const lager = new Map(); // vores fake cache: url -> Response

const fakeCache = {
  match: (req, opt) => {
    const u = typeof req === 'string' ? new URL(req, 'https://x.dev/').href : req.url;
    let n = lager.get(u);
    if (!n && opt && opt.ignoreSearch) {
      const bar = u.split('?')[0];
      for (const [k, v] of lager) if (k.split('?')[0] === bar) { n = v; break; }
    }
    // En rigtig cache giver et nyt svar hver gang — kroppen kan kun læses én gang
    return Promise.resolve(n ? n.clone() : undefined);
  },
  put: (req, svar) => { lager.set(typeof req === 'string' ? req : req.url, svar); return Promise.resolve(); },
  add: (req) => fakeFetch(req).then(s => fakeCache.put(req, s)),
  keys: () => Promise.resolve([...lager.keys()].map(u => new Request(u))),
  delete: (req) => Promise.resolve(lager.delete(typeof req === 'string' ? req : req.url)),
};

const caches = {
  open: (n) => { aabnede.push(n); return Promise.resolve(fakeCache); },
  match: (req, opt) => fakeCache.match(req, opt),
  // Samme adresse (jimmyfabe.github.io) deles med Matematik-appen, som har sine egne «mat-…»-caches.
  // «mat-tale» er Piper-stemmen (ca. 66 MB), som iPad'erne kun henter én gang.
  keys: () => Promise.resolve(['lego-app-v1', 'lego-app-v0', 'mat-2026-10-04-v37', 'mat-tale']),
  delete: (n) => { slettede.push(n); return Promise.resolve(true); },
};
let slettede = [];
let aabnede = [];        // navnene på de caches, sw.js har åbnet

function fakeFetch(req, init) {
  const url = typeof req === 'string' ? new URL(req, 'https://x.dev/').href : req.url;
  netKald.push(url);
  if (netSvarer) return netSvarer(url, init);
  return Promise.resolve(new Response('frisk:' + url, { status: 200 }));
}

const handlers = {};
const ctx = vm.createContext({
  self: {
    addEventListener: (n, f) => { handlers[n] = f; },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    location: { origin: 'https://x.dev', href: 'https://x.dev/sw.js' },
  },
  caches, fetch: fakeFetch,
  Response, Headers, AbortController, URL,
  // Rigtige service workers opløser relative URL'er mod deres scope — det gør Node ikke
  Request: class extends Request {
    constructor(input, init) { super(typeof input === "string" ? new URL(input, "https://x.dev/").href : input, init); }
  },
  setTimeout, clearTimeout, Promise, console,
});
vm.runInContext(fs.readFileSync(ROD + '/sw.js', 'utf8'), ctx);

// --- hjælper: kør fetch-handleren og se hvad der sker ---
function kald(url, opt = {}) {
  netKald = [];
  const req = new Request(url, { method: opt.method || 'GET' });
  if (opt.mode) Object.defineProperty(req, 'mode', { value: opt.mode });
  let svarLoefte = null;
  handlers.fetch({ request: req, respondWith: (p) => { svarLoefte = p; } });
  return { svarLoefte, netKald: () => netKald };
}

const resultater = [];
function tjek(navn, ok, detalje) { resultater.push([ok ? 'OK  ' : 'FEJL', navn, detalje || '']); }

(async () => {
  // 1) install precacher skallen
  let ventet;
  handlers.install({ waitUntil: p => { ventet = p; } });
  await ventet;
  tjek('install cacher skallen', lager.size >= 13, lager.size + ' filer');

  // Før 22.10.2026 gemte fetch alt på adressen i LEGO's cache — også Lystårnets sider og stemme
  const skallen = [...lager.keys()];
  const LYS_GEMT = ['https://x.dev/Lystaarnet/', 'https://x.dev/Lystaarnet/app.js',
                    'https://x.dev/Lystaarnet/tale/ab/0123456789abcd.mp3'];
  for (const u of LYS_GEMT) lager.set(u, new Response('lystaarn'));
  lager.set('https://cdn.rebrickable.com/media/sets/1-1.jpg', new Response('billede'));

  // 2) activate rydder sine egne gamle caches — men ikke den nye, og aldrig andre apps' caches
  handlers.activate({ waitUntil: p => { ventet = p; } });
  await ventet;
  tjek('activate sletter kun LEGO-appens egne gamle caches',
       slettede.length === 1 && slettede[0] === 'lego-app-v0', JSON.stringify(slettede));
  const tilbage = LYS_GEMT.filter(u => lager.has(u));
  tjek('activate rydder Lystårnets poster ud af LEGO-cachen', tilbage.length === 0,
       tilbage.length + ' af ' + LYS_GEMT.length + ' tilbage');
  const mistet = skallen.concat('https://cdn.rebrickable.com/media/sets/1-1.jpg').filter(u => !lager.has(u));
  tjek('activate beholder egne filer og sætbilleder', mistet.length === 0, mistet.join(' '));
  tjek('sw.js åbner kun caches med præfikset lego-',
       aabnede.length > 0 && aabnede.every(n => n.indexOf('lego-') === 0), JSON.stringify(aabnede));

  // 3) HTML -> nettet først
  let r = kald('https://x.dev/alma-dino.html');
  let s = await r.svarLoefte;
  tjek('HTML henter fra nettet først',
       r.netKald().length === 1 && (await s.text()).startsWith('frisk:'));

  // 4) lego-saet.json -> cachen først (nettet kun i baggrunden)
  r = kald('https://x.dev/lego-saet.json');
  s = await r.svarLoefte;
  const t = await s.text();
  tjek('lego-saet.json kommer fra cachen', !t.startsWith('frisk:') || t.includes('lego-saet'), t.slice(0, 30));

  // 5) ?frisk= skal slippe helt igennem uden respondWith
  r = kald('https://x.dev/app.js?frisk=123');
  tjek('?frisk= går uberørt til nettet', r.svarLoefte === null);

  // 6) POST skal ignoreres
  r = kald('https://x.dev/app.js', { method: 'POST' });
  tjek('POST ignoreres', r.svarLoefte === null);

  // 7) billede fra rebrickable -> cachen først, men hentes hvis den mangler
  r = kald('https://cdn.rebrickable.com/media/sets/6075-1.jpg');
  s = await r.svarLoefte;
  tjek('Rebrickable-billede hentes og gemmes', s.status === 200 && r.netKald().length === 1);

  // 8) ukendt fremmed vært -> lad browseren klare det
  r = kald('https://eksempel.dk/noget.js');
  tjek('ukendt vært røres ikke', r.svarLoefte === null);

  // 9) NETTET NEDE: HTML skal falde tilbage til cachen
  netSvarer = () => Promise.reject(new Error('offline'));
  r = kald('https://x.dev/app.css');
  s = await r.svarLoefte;
  tjek('offline: app.css kommer fra cachen', s && (await s.text()).includes('app.css'));

  // 10) NETTET NEDE: navigation til en af vores sider, som ikke ligger i cachen
  //     (fremmede sider på adressen rører service workeren ikke — se 16)
  const almaGemt = lager.get('https://x.dev/alma-dino.html');
  lager.delete('https://x.dev/alma-dino.html');
  r = kald('https://x.dev/alma-dino.html', { mode: 'navigate' });
  s = await r.svarLoefte;
  const nav = await s.text();
  tjek('offline: ucachet side giver offline-siden',
       s.status === 503 && nav.includes('Ingen internet'), 'status ' + s.status);
  lager.set('https://x.dev/alma-dino.html', almaGemt);

  // 11) NETTET NEDE: egen fil uden cache -> pænt offline-svar
  const jsGemt = lager.get('https://x.dev/app.js');
  lager.delete('https://x.dev/app.js');
  r = kald('https://x.dev/app.js');
  s = await r.svarLoefte;
  tjek('offline: ucachet fil giver 503 offline-svar', s.status === 503);
  lager.set('https://x.dev/app.js', jsGemt);

  // 12) NETTET NEDE, og Ellas side mangler i cachen, men Almas er der.
  //     Hun må ALDRIG få Almas app — den bruger Almas localStorage-nøgle.
  const ellaGemt = lager.get('https://x.dev/ella-prinsesse.html');
  lager.delete('https://x.dev/ella-prinsesse.html');
  r = kald('https://x.dev/ella-prinsesse.html', { mode: 'navigate' });
  s = await r.svarLoefte;
  const ellaSvar = await s.text();
  tjek('offline: Ella får aldrig Almas app',
       !ellaSvar.includes('alma-dino') && ellaSvar.includes('Ingen internet'), ellaSvar.slice(0, 30));
  lager.set('https://x.dev/ella-prinsesse.html', ellaGemt);

  // 13) Serveren svarer 404 (halvfærdigt push) -> brug den gode kopi i cachen
  netSvarer = () => Promise.resolve(new Response('Ikke fundet', { status: 404 }));
  r = kald('https://x.dev/app.css');
  s = await r.svarLoefte;
  tjek('HTTP 404 fra nettet: app.css kommer fra cachen',
       s.status === 200 && (await s.text()).includes('app.css'), 'status ' + s.status);

  // 14) Et fejlsvar fra en fremmed vært ligger i cachen (opaque svar skjuler
  //     statuskoden). Det SKAL overskrives af baggrundskaldet, ellers sidder
  //     billedet eller tal-læseren fast for altid.
  netSvarer = null;
  lager.set('https://cdn.rebrickable.com/media/sets/6075-1.jpg', new Response('gammel-fejl', { status: 200 }));
  r = kald('https://cdn.rebrickable.com/media/sets/6075-1.jpg');
  s = await r.svarLoefte;
  await new Promise(ok => setImmediate(ok));
  const efter = await lager.get('https://cdn.rebrickable.com/media/sets/6075-1.jpg').clone().text();
  tjek('fremmed fil i cachen fornyes i baggrunden', r.netKald().length === 1 && efter.startsWith('frisk:'),
       r.netKald().length + ' netkald, cache: ' + efter.slice(0, 12));

  // 15) Egen stabil fil i cachen -> opdateres stadig i baggrunden
  r = kald('https://x.dev/lego-saet.json');
  s = await r.svarLoefte;
  tjek('cachet sætliste opdateres i baggrunden', r.netKald().length === 1,
       r.netKald().length + ' netkald');

  // 16) Service workeren har scope '/', men jimmyfabe.github.io deles med Lystårnet (hård læring nr. 17).
  //     Alt uden for LEGO's egne filer skal browseren (eller Lystårnets egen service worker) klare selv:
  //     ingen respondWith, intet netkald og intet i LEGO's cache — heller ikke filer med samme navn som vores.
  const FREMMEDE = ['https://x.dev/Lystaarnet/', 'https://x.dev/Lystaarnet/index.html',
                    'https://x.dev/Lystaarnet/app.js', 'https://x.dev/Lystaarnet/ikoner/dino-192.png',
                    'https://x.dev/Lystaarnet/tale/ab/0123456789abcd.mp3', 'https://x.dev/andet/side.html'];
  const roert = [];
  for (const u of FREMMEDE) {
    r = kald(u, u.endsWith('/') || u.endsWith('.html') ? { mode: 'navigate' } : {});
    if (r.svarLoefte !== null || r.netKald().length) roert.push(u.slice('https://x.dev'.length));
  }
  await new Promise(ok => setImmediate(ok));
  tjek('Lystårnet og andre stier på adressen røres ikke', roert.length === 0, roert.join(' '));
  const lysICache = [...lager.keys()].filter(k => k.includes('/Lystaarnet/'));
  tjek('intet fra Lystårnet havner i LEGO-cachen', lysICache.length === 0, lysICache.length + ' poster');

  // 17) ...men vores egne filer går stadig gennem service workeren, også med ?-parametre
  const EGNE_TJEK = ['https://x.dev/ella-prinsesse.html?fra=hjemskaerm', 'https://x.dev/fonts/nunito-latin.woff2',
                     'https://x.dev/ikon-ella-512.png', 'https://x.dev/manifest-ella.json'];
  const svar = EGNE_TJEK.map(u => kald(u).svarLoefte);
  const sluppet = EGNE_TJEK.filter((u, i) => svar[i] === null);
  await Promise.all(svar);
  tjek('egne filer går stadig gennem service workeren', sluppet.length === 0, sluppet.join(' '));

  console.log('');
  for (const [st, n, d] of resultater) console.log(st, n, d ? '(' + d + ')' : '');
  const fejl = resultater.filter(x => x[0] === 'FEJL').length;
  console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tests bestået');
  process.exit(fejl ? 1 : 0);
})();

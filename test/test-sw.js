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
};

const caches = {
  open: () => Promise.resolve(fakeCache),
  match: (req, opt) => fakeCache.match(req, opt),
  keys: () => Promise.resolve(['lego-app-v1', 'gammel-cache']),
  delete: (n) => { slettede.push(n); return Promise.resolve(true); },
};
let slettede = [];

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
    location: { origin: 'https://x.dev' },
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

  // 2) activate rydder gamle caches, men ikke sin egen
  handlers.activate({ waitUntil: p => { ventet = p; } });
  await ventet;
  tjek('activate sletter kun gamle caches',
       slettede.length === 1 && slettede[0] === 'gammel-cache', JSON.stringify(slettede));

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

  // 10) NETTET NEDE: navigation til en fil vi aldrig har cachet
  r = kald('https://x.dev/ukendt-side.html', { mode: 'navigate' });
  s = await r.svarLoefte;
  const nav = await s.text();
  tjek('offline: ukendt side giver offline-siden',
       s.status === 503 && nav.includes('Ingen internet'), 'status ' + s.status);

  // 11) NETTET NEDE: ny fil uden cache -> pænt offline-svar
  r = kald('https://x.dev/helt-ny.js');
  s = await r.svarLoefte;
  tjek('offline: ucachet fil giver 503 offline-svar', s.status === 503);

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

  // 14) Sætbillede i cachen -> hentes IKKE igen i baggrunden
  netSvarer = null;
  r = kald('https://cdn.rebrickable.com/media/sets/6075-1.jpg');
  s = await r.svarLoefte;
  tjek('cachet sætbillede hentes ikke igen', s.status === 200 && r.netKald().length === 0,
       r.netKald().length + ' netkald');

  // 15) Egen stabil fil i cachen -> opdateres stadig i baggrunden
  r = kald('https://x.dev/lego-saet.json');
  s = await r.svarLoefte;
  tjek('cachet sætliste opdateres i baggrunden', r.netKald().length === 1,
       r.netKald().length + ' netkald');

  console.log('');
  for (const [st, n, d] of resultater) console.log(st, n, d ? '(' + d + ')' : '');
  const fejl = resultater.filter(x => x[0] === 'FEJL').length;
  console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tests bestået');
  process.exit(fejl ? 1 : 0);
})();

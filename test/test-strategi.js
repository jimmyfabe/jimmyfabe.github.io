// Skarp test af DEN vigtigste beslutning i sw.js:
// hvilke filer kommer fra nettet først, og hvilke fra cachen først.
const fs = require('fs'), vm = require('vm');
const ROD = require('path').join(__dirname, '..');   // projektmappen, uanset hvor den ligger

const lager = new Map();          // url -> tekst (gemmer tekst, ikke Response, så den kan læses flere gange)
let netKald = [];
let netTekst = 'FRA-NETTET';

const fakeCache = {
  match: (req, opt) => {
    const u = req.url || req;
    let t = lager.get(u);
    if (t === undefined && opt && opt.ignoreSearch) {
      const bar = u.split('?')[0];
      for (const [k, v] of lager) if (k.split('?')[0] === bar) { t = v; break; }
    }
    return Promise.resolve(t === undefined ? undefined : new Response(t, { status: 200 }));
  },
  put: (req, svar) => svar.text().then(t => { lager.set(req.url || req, t); }),
  add: (req) => fakeFetch(req).then(s => fakeCache.put(req, s)),
};
const caches = {
  open: () => Promise.resolve(fakeCache),
  match: (r, o) => fakeCache.match(r, o),
  keys: () => Promise.resolve(['lego-app-v1']),
  delete: () => Promise.resolve(true),
};
function fakeFetch(req) {
  const url = req.url || req;
  netKald.push(url);
  return Promise.resolve(new Response(netTekst, { status: 200 }));
}

const H = {};
const MinRequest = class extends Request {
  constructor(i, init) { super(typeof i === 'string' ? new URL(i, 'https://x.dev/').href : i, init); }
};
const ctx = vm.createContext({
  self: { addEventListener: (n, f) => { H[n] = f; }, skipWaiting: () => Promise.resolve(),
          clients: { claim: () => Promise.resolve() }, location: { origin: 'https://x.dev' } },
  caches, fetch: fakeFetch, Response, Request: MinRequest, Headers, AbortController, URL,
  setTimeout, clearTimeout, Promise, console,
});
vm.runInContext(fs.readFileSync(ROD + '/sw.js', 'utf8'), ctx);

function hent(url) {
  netKald = [];
  let l = null;
  H.fetch({ request: new MinRequest(url), respondWith: p => { l = p; } });
  return l;
}

(async () => {
  // Læg noget GAMMELT i cachen for hver fil
  for (const f of ['app.js', 'app.css', 'alma-dino.html', 'lego-saet.json',
                   'ikon-alma-192.png', 'manifest-alma.json']) {
    lager.set('https://x.dev/' + f, 'GAMMELT');
  }

  const tabel = [];
  for (const f of ['alma-dino.html', 'app.js', 'app.css',        // skal være FRA-NETTET
                   'lego-saet.json', 'ikon-alma-192.png', 'manifest-alma.json']) { // skal være GAMMELT
    const svar = await hent('https://x.dev/' + f);
    tabel.push([f, await svar.text()]);
  }

  let fejl = 0;
  const forventet = {
    'alma-dino.html': 'FRA-NETTET', 'app.js': 'FRA-NETTET', 'app.css': 'FRA-NETTET',
    'lego-saet.json': 'GAMMELT', 'ikon-alma-192.png': 'GAMMELT', 'manifest-alma.json': 'GAMMELT',
  };
  console.log('');
  for (const [f, fik] of tabel) {
    const ok = fik === forventet[f];
    if (!ok) fejl++;
    console.log((ok ? 'OK  ' : 'FEJL') + '  ' + f.padEnd(20) +
                ' fik=' + fik.padEnd(11) + ' forventet=' + forventet[f]);
  }
  console.log('\n' + (tabel.length - fejl) + '/' + tabel.length + ' strategier korrekte');
  process.exit(fejl ? 1 : 0);
})();

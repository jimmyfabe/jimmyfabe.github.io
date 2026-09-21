// Tester at sw.js tvinger sine EGNE filer forbi browserens HTTP-cache,
// men lader fremmede (no-cors) hentninger passere uændret.
const fs = require('fs'), vm = require('vm');
const ROD = require('path').join(__dirname, '..');   // projektmappen, uanset hvor den ligger
let kald = [];
const fakeCache = { match: () => Promise.resolve(undefined), put: () => Promise.resolve(), add: () => Promise.resolve() };
const caches = { open: () => Promise.resolve(fakeCache), match: () => Promise.resolve(undefined),
                 keys: () => Promise.resolve([]), delete: () => Promise.resolve(true) };
function fakeFetch(maal, init) {
  kald.push({ type: typeof maal === 'string' ? 'url' : 'Request',
              url: typeof maal === 'string' ? maal : maal.url,
              cache: (init && init.cache) || null });
  return Promise.resolve(new Response('x', { status: 200 }));
}
const H = {};
const MinRequest = class extends Request {
  constructor(i, init) { super(typeof i === 'string' ? new URL(i, 'https://x.dev/').href : i, init); }
};
vm.runInContext(fs.readFileSync(ROD + '/sw.js', 'utf8'), vm.createContext({
  self: { addEventListener: (n, f) => { H[n] = f; }, skipWaiting: () => Promise.resolve(),
          clients: { claim: () => Promise.resolve() }, location: { origin: 'https://x.dev' } },
  caches, fetch: fakeFetch, Response, Request: MinRequest, Headers, AbortController, URL,
  setTimeout, clearTimeout, Promise, console,
}));

(async () => {
  const sager = [
    ['https://x.dev/app.js',                                   'url',     'reload'],
    ['https://x.dev/alma-dino.html',                           'url',     'reload'],
    ['https://x.dev/lego-saet.json',                           'url',     'reload'],
    ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/x.js',   'Request', null],
    ['https://cdn.rebrickable.com/media/sets/6075-1.jpg',      'Request', null],
    ['https://tessdata.projectnaptha.com/4.0.0_fast/eng.gz',   'Request', null],
  ];
  let fejl = 0;
  console.log('');
  for (const [url, ventType, ventCache] of sager) {
    kald = [];
    let l = null;
    H.fetch({ request: new MinRequest(url), respondWith: p => { l = p; } });
    await l;
    await new Promise(s => setTimeout(s, 20));   // lad baggrunds-hentning nå at køre
    const k = kald[0] || {};
    const ok = k.type === ventType && k.cache === ventCache;
    if (!ok) fejl++;
    console.log((ok ? 'OK  ' : 'FEJL') + '  ' + url.replace('https://', '').slice(0, 44).padEnd(46) +
                'som=' + String(k.type).padEnd(8) + ' cache=' + String(k.cache));
  }
  console.log('\n' + (sager.length - fejl) + '/' + sager.length + ' korrekte');
  process.exit(fejl ? 1 : 0);
})();

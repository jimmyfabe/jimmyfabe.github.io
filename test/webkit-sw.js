// WebKit-prøve af LEGO's service worker på en adresse, der deles med Lystårnet.
// Kræver Playwright WebKit og er tung (en rigtig browser), så den er ikke med i de faste tests.
// Kør den gennem låsen, fra D:\Claude\Lego i Git Bash:
//   NODE_PATH=C:/Users/Jimmy/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules \
//     bash ~/.claude/tung-koersel.sh "LEGO WebKit sw" node test/webkit-sw.js
// Valgfrit: node test/webkit-sw.js [gammel-revision]  (standard 3584096~1 = sw.js før rettelsen 22-10)
//
// Fase 1: gammel sw.js er aktiv -> et besøg på /Lystaarnet/ havner i lego-app-v1 (fejlen).
//         Cachen fyldes også med 500 fremmede poster og 1000 sætbilleder, så oprydningens tid kan måles.
// Fase 2: opdatering til ny sw.js -> activate rydder /Lystaarnet/ ud; mat-tale, mat-<v> og sætbillederne bliver.
// Fase 3: ny sw.js -> et nyt besøg på /Lystaarnet/ havner ikke i lego-*.
// Fase 4: serveren stoppes -> LEGO-appen virker offline (390x844 og desktop).
//
// Profilen ligger i en kort sti under %TEMP%\swm\: i en lang sti fejler Cache API og
// service workeren i WebKit uden en fejlmeddelelse. WebKit gemmer svar over ca. 4 kB i
// CacheStorage som «<sha1>-blob»-filer 197 tegn under profilen; kommer stien over 259 tegn
// (Windows' MAX_PATH), mangler posten bare. Målt 22-10: en profil på 63 tegn gav 260 tegn,
// og kun de to manifester (ca. 620 B, gemt uden blob) kom i cachen — 2 af 14 skalfiler.
const { webkit } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), http = require('http');

const REPO = path.join(__dirname, '..');
const GAMMEL_REV = process.argv[2] || '3584096~1';
const ROD = path.join(os.tmpdir(), 'swm', 'l' + Date.now().toString(36));
const ARB = path.join(ROD, 'arb'), PROFIL = path.join(ROD, 'p'), WEBROD = path.join(ROD, 'web');
if (PROFIL.length + 197 > 259) {
  console.error('Profilstien er for lang til WebKits CacheStorage (' + PROFIL.length + ' tegn, højst 62): ' + PROFIL);
  process.exit(1);
}
fs.mkdirSync(ARB, { recursive: true });

// Skallens filer læses fra sw.js, så listen her aldrig kommer ud af trit med SKAL
const swKilde = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
const LEGO_FILER = JSON.parse(/var SKAL = (\[[\s\S]*?\]);/.exec(swKilde)[1].replace(/'/g, '"'));
const FREMMEDE = 500, BILLEDER = 1000;

// Webroden: LEGO's filer + en lille falsk Lystårnet uden egen service worker
// (som før Lystårnets service worker har taget over)
for (const f of LEGO_FILER) {
  fs.mkdirSync(path.dirname(path.join(WEBROD, f)), { recursive: true });
  fs.copyFileSync(path.join(REPO, f), path.join(WEBROD, f));
}
fs.writeFileSync(path.join(WEBROD, 'sw.js'), execFileSync('git', ['-C', REPO, 'show', GAMMEL_REV + ':sw.js']));
fs.mkdirSync(path.join(WEBROD, 'Lystaarnet/tale/ab'), { recursive: true });
fs.mkdirSync(path.join(WEBROD, 'Lystaarnet/ikoner'), { recursive: true });
fs.writeFileSync(path.join(WEBROD, 'Lystaarnet/index.html'),
  '<!DOCTYPE html><meta charset="utf-8"><title>Lystaarn-falsk</title><body><h1>LYSTAARN-FALSK</h1>' +
  '<script src="app.js"></script></body>');
fs.writeFileSync(path.join(WEBROD, 'Lystaarnet/app.js'),
  'window.styret = navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null;' +
  'window.faerdig = Promise.all([fetch("tale/ab/0123456789abcd.mp3"), fetch("ikoner/dino-192.png")])' +
  '.then(function (s) { return s.map(function (r) { return r.status; }); });');
fs.writeFileSync(path.join(WEBROD, 'Lystaarnet/tale/ab/0123456789abcd.mp3'), Buffer.alloc(2048, 7));
fs.copyFileSync(path.join(REPO, 'ikon-alma-192.png'), path.join(WEBROD, 'Lystaarnet/ikoner/dino-192.png'));

const PYTHON = execFileSync('py', ['-c', 'import sys; print(sys.executable)']).toString().trim();
function ledigPort() {
  return new Promise((ok, fejl) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
    s.on('error', fejl);
  });
}
let server = null;
async function startServer(port) {
  server = spawn(PYTHON, ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', WEBROD],
                 { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    const svarer = await new Promise(ok => http.get('http://127.0.0.1:' + port + '/app.css', r => { r.resume(); ok(true); })
      .on('error', () => ok(false)));
    if (svarer) return;
    await new Promise(ok => setTimeout(ok, 200));
  }
  throw new Error('serveren startede ikke');
}
function stopServer() { if (server) { server.kill(); server = null; } }

const resultater = [];
function tjek(navn, ok, detalje) { resultater.push([ok ? 'OK  ' : 'FEJL', navn, detalje === undefined ? '' : detalje]); }

// Alle poster (hele adresser) i alle caches, grupperet efter cachenavn
const cacheIndhold = (page) => page.evaluate(async () => {
  const ud = {};
  for (const n of await caches.keys()) ud[n] = (await (await caches.open(n)).keys()).map(r => r.url);
  return ud;
});
const sti = (u) => new URL(u).pathname;
const legoPoster = (indhold) => Object.keys(indhold).filter(n => n.indexOf('lego-') === 0)
  .reduce((a, n) => a.concat(indhold[n]), []);
const lysILego = (indhold, base) => legoPoster(indhold).filter(u => u.indexOf(base + '/Lystaarnet/') === 0);
const billederILego = (indhold) => legoPoster(indhold).filter(u => u.indexOf('https://images.brickset.com/') === 0);
// Skallens filer, der IKKE ligger i lego-app-v1 (navne som i SKAL)
const skalMangler = (indhold, base) => {
  const gemt = (indhold['lego-app-v1'] || []).filter(u => u.indexOf(base + '/') === 0).map(u => sti(u).slice(1));
  return LEGO_FILER.filter(f => gemt.indexOf(f) === -1);
};

async function ventPaaStyring(page) {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
}

(async () => {
  const port = await ledigPort();
  const BASE = 'http://127.0.0.1:' + port;
  await startServer(port);
  let ctx = null;
  try {
    // ---------- Fase 1: gammel sw.js ----------
    ctx = await webkit.launchPersistentContext(PROFIL, { viewport: { width: 390, height: 844 }, hasTouch: true });
    // Tidspunktet for controllerchange gemmes til fase 2
    await ctx.addInitScript(() => {
      if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', () =>
        sessionStorage.setItem('sw-skift', String(Date.now())));
    });
    let page = ctx.pages()[0] || await ctx.newPage();
    const konsolFejl = [];
    ctx.on('console', m => { if (m.type() === 'error') konsolFejl.push(m.text()); });
    await page.goto(BASE + '/alma-dino.html');
    await ventPaaStyring(page);
    // Lystårnets egne caches, som de ligger på pigernes iPads, og en fyldt LEGO-cache
    await page.evaluate(async ([fremmede, billeder]) => {
      await (await caches.open('mat-tale')).put('/Lystaarnet/tale/ab/11111111111111.mp3', new Response('stemme'));
      await (await caches.open('mat-2026-10-22-v253')).put('/Lystaarnet/index.html', new Response('mat'));
      const lego = await caches.open('lego-app-v1'), job = [];
      for (let i = 0; i < fremmede; i++) job.push(lego.put('/Lystaarnet/tale/f' + i + '.mp3', new Response('x')));
      for (let i = 0; i < billeder; i++) job.push(lego.put('https://images.brickset.com/sets/images/' + i + '-1.jpg', new Response('b')));
      await Promise.all(job);
    }, [FREMMEDE, BILLEDER]);
    await page.goto(BASE + '/Lystaarnet/index.html');
    await page.evaluate(() => window.faerdig);
    await page.waitForTimeout(500);
    let indhold = await cacheIndhold(page);
    // Forudsætning: mangler skallen allerede her, er det profilen/WebKit, ikke opdateringen
    const manglerFoer = skalMangler(indhold, BASE);
    tjek('fase 1: hele skallen ligger i lego-app-v1 før opdateringen', manglerFoer.length === 0,
         (LEGO_FILER.length - manglerFoer.length) + '/' + LEGO_FILER.length + ' filer; mangler: ' +
         (manglerFoer.join(' ') || 'ingen'));
    const foerRettelse = lysILego(indhold, BASE).filter(u => !/\/tale\/f\d+\.mp3$/.test(u));
    tjek('fase 1 (gammel sw.js): /Lystaarnet/ havner i lego-* (fejlen genskabt)', foerRettelse.length > 0,
         foerRettelse.length + ' poster: ' + foerRettelse.map(sti).join(' '));

    // ---------- Fase 2: opdatering til ny sw.js ----------
    // Navigationen starter selv browserens opdateringstjek, så den nye service worker installerer
    // allerede, når testen kan kalde reg.update() (målt 22-10: «installing» 60 ms efter goto), og er
    // aktiv, når update() svarer — installing/waiting er da null. Beviset på skiftet er derfor
    // controllerchange, som init-scriptet gemmer i sessionStorage (overlever appens genindlæsning).
    await page.evaluate(() => sessionStorage.removeItem('sw-skift'));
    fs.copyFileSync(path.join(REPO, 'sw.js'), path.join(WEBROD, 'sw.js'));
    const t0 = Date.now();
    await page.goto(BASE + '/alma-dino.html');
    await ventPaaStyring(page);
    // Skub til opdateringen, hvis browseren ikke selv gør det (ventes ikke: siden genindlæses snart)
    await page.evaluate(() => { navigator.serviceWorker.getRegistration().then(r => r.update()).catch(() => {}); });
    const skift = await page.waitForFunction(() => +sessionStorage.getItem('sw-skift'), null, { timeout: 15000 })
      .then(h => h.jsonValue(), () => 0);
    const aktiveringMs = skift ? skift - t0 : null;
    tjek('fase 2: ny sw.js bliver aktiv (controllerchange)', skift > 0,
         skift ? 'efter ' + aktiveringMs + ' ms' : 'ingen controllerchange på 15 s');
    // Oprydningen ligger i activate's waitUntil, så siden får først den nye service worker bagefter
    tjek('fase 2 (måling): navigation til ny sw.js styrer, med ' + (FREMMEDE + BILLEDER) + ' poster, under 3 s',
         skift > 0 && aktiveringMs < 3000, aktiveringMs + ' ms');
    await page.waitForTimeout(2500);             // appen genindlæser selv 1,2 s efter controllerchange
    await page.waitForLoadState('load');
    indhold = await cacheIndhold(page);
    tjek('fase 2: activate har ryddet /Lystaarnet/ ud af lego-*', lysILego(indhold, BASE).length === 0,
         lysILego(indhold, BASE).length + ' tilbage');
    tjek('fase 2: sætbillederne er urørte', billederILego(indhold).length === BILLEDER,
         billederILego(indhold).length + '/' + BILLEDER);
    const matSti = (n) => JSON.stringify((indhold[n] || []).map(sti));
    tjek('fase 2: mat-tale og mat-<version> er urørte',
         matSti('mat-tale') === '["/Lystaarnet/tale/ab/11111111111111.mp3"]' &&
         matSti('mat-2026-10-22-v253') === '["/Lystaarnet/index.html"]',
         'mat-tale ' + matSti('mat-tale') + ', mat-…v253 ' + matSti('mat-2026-10-22-v253'));
    const mangler = skalMangler(indhold, BASE);
    tjek('fase 2: LEGO-skallen ligger stadig i lego-app-v1', mangler.length === 0,
         (LEGO_FILER.length - mangler.length) + '/' + LEGO_FILER.length + ' filer; mangler: ' + (mangler.join(' ') || 'ingen') +
         '; cachenavne: ' + Object.keys(indhold).join(', '));

    // ---------- Fase 3: ny sw.js, nyt besøg på Lystårnet ----------
    await page.goto(BASE + '/Lystaarnet/index.html');
    const status = await page.evaluate(() => window.faerdig);
    const styret = await page.evaluate(() => window.styret);
    const overskrift = await page.textContent('h1');
    tjek('fase 3: Lystårnet-siden og dens filer hentes online', overskrift === 'LYSTAARN-FALSK' &&
         JSON.stringify(status) === '[200,200]', overskrift + ' ' + JSON.stringify(status));
    await page.waitForTimeout(500);
    indhold = await cacheIndhold(page);
    tjek('fase 3: intet fra /Lystaarnet/ i lego-* efter besøget', lysILego(indhold, BASE).length === 0,
         lysILego(indhold, BASE).map(sti).join(' '));
    tjek('fase 3 (måling): Lystårnet-siden styres af', true, String(styret));

    // ---------- Fase 4: offline (serveren stoppet) ----------
    stopServer();
    await new Promise(ok => setTimeout(ok, 500));
    const offlineTjek = async (fil, navn, skud) => {
      await page.goto(BASE + '/' + fil);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(async () => {
        const tekst = document.body.innerText;
        let saet = -1;
        try { saet = Object.keys(await (await fetch('lego-saet.json')).json()).length; } catch (e) { saet = -1; }
        return { tekst: tekst.slice(0, 2000), knapper: document.querySelectorAll('button').length,
                 tema: window.TEMA && window.TEMA.navn, saet: saet, bredde: document.documentElement.scrollWidth };
      });
      await page.screenshot({ path: path.join(ARB, skud) });
      tjek('offline ' + navn + ': appen vises', r.tema && r.knapper > 3 && r.tekst.indexOf('ikke noget internet') === -1,
           'tema=' + r.tema + ', knapper=' + r.knapper + ', sætliste=' + r.saet + ' sæt, bredde=' + r.bredde);
    };
    await offlineTjek('alma-dino.html', 'Alma 390x844', 'offline-alma-390.png');
    await offlineTjek('ella-prinsesse.html', 'Ella 390x844', 'offline-ella-390.png');
    let lysOffline;
    try { const s = await page.goto(BASE + '/Lystaarnet/index.html'); lysOffline = 'svar ' + (s && s.status()); }
    catch (e) { lysOffline = 'browserens egen fejl: ' + e.message.split('\n')[0]; }
    tjek('offline /Lystaarnet/ (måling): LEGO svarer ikke for den', lysOffline.indexOf('svar 503') === -1, lysOffline);
    await ctx.close();

    // Desktop: ny browser med samme profil, stadig uden server
    ctx = await webkit.launchPersistentContext(PROFIL, { viewport: { width: 1280, height: 800 } });
    ctx.on('console', m => { if (m.type() === 'error') konsolFejl.push(m.text()); });
    page = ctx.pages()[0] || await ctx.newPage();
    await offlineTjek('alma-dino.html', 'Alma desktop 1280x800', 'offline-alma-desktop.png');
    await offlineTjek('ella-prinsesse.html', 'Ella desktop 1280x800', 'offline-ella-desktop.png');
    tjek('konsolfejl i alt (måling)', true, konsolFejl.length + (konsolFejl.length ? ': ' + konsolFejl.slice(0, 5).join(' | ') : ''));
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    stopServer();
  }
  console.log('');
  for (const [st, n, d] of resultater) console.log(st, n, d !== '' ? '(' + d + ')' : '');
  const fejl = resultater.filter(x => x[0] === 'FEJL').length;
  console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tjek bestået · skærmbilleder i ' + ARB);
  process.exit(fejl ? 1 : 0);
})().catch(e => { stopServer(); console.error(e); process.exit(1); });

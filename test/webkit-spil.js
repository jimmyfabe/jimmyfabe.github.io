// WebKit-prøve af klodsespillet Huskeklodsen i en rigtig browser: 🎮-fanen, overlayet i fem skærmstørrelser,
// en runde med tryk og en med tastatur, spillenes nøgle i localStorage (samlingen urørt), ødelagte data,
// stemmen med falske klip og offline. Tung (en rigtig browser), så den er ikke med i de faste tests.
// Kør den gennem låsen i Git Bash:
//   NODE_PATH=C:/Users/Jimmy/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules \
//     bash ~/.claude/tung-koersel.sh "LEGO WebKit spil" node test/webkit-spil.js [mappe-til-skaermbilleder]
// Serveren er py -m http.server på 127.0.0.1, port 8150-8199, med en kopi af SKAL-filerne (ingen tale/ —
// som på GitHub Pages i dag), så klippene kun findes i fasen, der lægger falske klip ud.
const { webkit } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), http = require('http');

const REPO = path.join(__dirname, '..');
const ROD = path.join(os.tmpdir(), 'swm', 's' + Date.now().toString(36));
const PROFIL = path.join(ROD, 'p'), WEBROD = path.join(ROD, 'web');
const SKUD = path.resolve(process.argv[2] || path.join(ROD, 'skud'));
if (PROFIL.length + 197 > 259) { console.error('Profilstien er for lang (højst 62 tegn): ' + PROFIL); process.exit(1); }
fs.mkdirSync(SKUD, { recursive: true });

const swKilde = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
const SKAL = JSON.parse(/var SKAL = (\[[\s\S]*?\]);/.exec(swKilde)[1].replace(/'/g, '"'));
for (const f of SKAL.concat('sw.js')) {
  fs.mkdirSync(path.dirname(path.join(WEBROD, f)), { recursive: true });
  fs.copyFileSync(path.join(REPO, f), path.join(WEBROD, f));
}

const PYTHON = execFileSync('py', ['-c', 'import sys; print(sys.executable)']).toString().trim();
const fri = p => new Promise(ok => { const s = net.createServer().once('error', () => ok(false)).listen(p, '127.0.0.1', () => s.close(() => ok(true))); });
async function ledigPort() { for (let p = 8150; p <= 8199; p++) if (await fri(p)) return p; throw new Error('ingen ledig port 8150-8199'); }
let server = null;
async function startServer(port) {
  server = spawn(PYTHON, ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', WEBROD], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await new Promise(ok => http.get('http://127.0.0.1:' + port + '/app.css', r => { r.resume(); ok(true); }).on('error', () => ok(false)))) return;
    await new Promise(ok => setTimeout(ok, 200));
  }
  throw new Error('serveren startede ikke');
}
function stopServer() { if (server) { server.kill(); server = null; } }

const resultater = [], sidefejl = [], konsolfejl = [];
const aabne = [];
// Én del af prøven: en undtagelse (fx en timeout) bliver til en FEJL-linje, og resten kører videre
async function del(navn, fn) {
  try { await fn(); }
  catch (e) { tjek(navn + ': delen stoppede', false, e.message.split('\n')[0]); }
  finally { while (aabne.length) await aabne.pop().close().catch(() => {}); }
}
function tjek(navn, ok, detalje) { resultater.push([ok ? 'OK  ' : 'FEJL', navn, detalje === undefined ? '' : detalje]); }
const SAMLING = '{"v":2,"samling":[{"num":"10696","navn":"Klodskasse"}]}';

// Init-script: stemmens hændelser og hvert lydudsnit, der startes, gemmes på window
function lytTilTale() {
  window.__tale = [];
  window.__lyd = [];
  document.addEventListener('klodsespil:tale', e => window.__tale.push(e.detail));
  const K = window.AudioBufferSourceNode;
  if (K) {
    const start = K.prototype.start;
    K.prototype.start = function (naar, fra, laengde) { window.__lyd.push([fra, laengde]); return start.apply(this, arguments); };
  }
}

async function nySide(browser, vp, ekstra) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: vp.b, height: vp.h }, hasTouch: !!vp.touch,
                                                       serviceWorkers: 'block' }, ekstra || {}));
  aabne.push(ctx);
  await ctx.addInitScript(lytTilTale);
  const page = await ctx.newPage();
  page.on('pageerror', e => sidefejl.push(vp.navn + ': ' + e.message));
  page.on('console', m => {
    // 404 på tale/indeks.json er forventet (ingen klip endnu) og er netop det, spillet skal tåle
    if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) konsolfejl.push(vp.navn + ': ' + m.text());
  });
  return { ctx, page };
}

// Spillets knapper og svar hviler 450 ms efter hvert skærmskift (spil.js: roTil), så et dobbelttryk ikke tager
// to skærme. Testen venter derfor 500 ms før hvert tryk på dem, som et barn gør. ⏭ hviler 1500 ms (springTil).
const hvil = page => page.waitForTimeout(500);
const tryk = async (page, vp, sel) => {
  if (/\.spil-(knap|svar)\b/.test(sel)) await hvil(page);
  return vp.touch ? page.tap(sel) : page.click(sel);
};
const skaerm = page => page.evaluate(() => document.getElementById('spilOverlay').dataset.skaerm);
const ventSkaerm = (page, s, ms) => page.waitForFunction(x => document.getElementById('spilOverlay').dataset.skaerm === x, s,
                                                         { timeout: ms || 12000 });
const lager = (page, n) => page.evaluate(k => localStorage.getItem(k), n);

// Mål på det, der er synligt: knapper, vandret rulning, om alt er inden for skærmen
const maal = page => page.evaluate(() => {
  // getClientRects i stedet for offsetParent: en <svg> har ingen offsetParent
  const r = e => { if (!e || e.hidden || !e.getClientRects().length) return null;
                   const b = e.getBoundingClientRect(); return { b: Math.round(b.width), h: Math.round(b.height),
                   x: Math.round(b.left), y: Math.round(b.top), bund: Math.round(b.bottom), hoejre: Math.round(b.right) }; };
  const o = document.getElementById('spilOverlay');
  const knapper = [...o.querySelectorAll('button')].filter(b => !b.hidden && b.offsetParent).map(r);
  return { a: r(o.querySelector('.spil-knap.primaer')), b: r(o.querySelector('.spil-knap.sekundaer')),
           mindst: Math.min(...knapper.map(k => Math.min(k.b, k.h))),
           udenfor: knapper.filter(k => k.x < 0 || k.y < 0 || k.hoejre > innerWidth + 1 || k.bund > innerHeight + 1).length,
           vandret: document.documentElement.scrollWidth > innerWidth + 1 || o.scrollWidth > o.clientWidth + 1,
           taarn: r(o.querySelector('.spil-taarn svg')), inert: document.querySelector('.app').hasAttribute('inert') };
});

// Svaret på tjek-spørgsmålet læses af tegningens aria-label under visningen («Tårnet nedefra: rød, blå …»)
async function laesTaarn(page) {
  const lbl = await page.getAttribute('.spil-taarn svg', 'aria-label');
  const [hoved, side] = lbl.replace('Tårnet nedefra: ', '').split('. Ved siden af: ');
  return { hoved: hoved.split(', '), antal: hoved.split(', ').length + (side ? side.split(', ').length : 0) };
}
async function rigtigtSvar(page, taarn) {
  const tale = await page.evaluate(() => window.__tale.slice(-1)[0]);
  const svar = tale === 'husk.sp-nederst' ? taarn.hoved[0] : tale === 'husk.sp-oeverst' ? taarn.hoved[taarn.hoved.length - 1]
             : String(taarn.antal);
  const valg = await page.$$eval('.spil-svar', bs => bs.map(b => b.getAttribute('aria-label')));
  return { tale, svar, i: valg.indexOf(svar), valg, taarn: taarn.hoved.join('/') };
}

const VP = [
  { navn: 'iphone-390x844', b: 390, h: 844, touch: true, primaer: 88 },
  { navn: 'iphone-tvaers-844x390', b: 844, h: 390, touch: true, primaer: 76 },
  { navn: 'ipad-1180x820', b: 1180, h: 820, touch: true, primaer: 104 },
  { navn: 'ipad-1024x768', b: 1024, h: 768, touch: true, primaer: 104 },
  { navn: 'desktop-1280x800', b: 1280, h: 800, touch: false, primaer: 104 },
];
const BOERN = [{ fil: 'alma-dino.html', id: 'alma', figur: 'dino' }, { fil: 'ella-prinsesse.html', id: 'ella', figur: 'enhjorning' }];

(async () => {
  const port = await ledigPort(), BASE = 'http://127.0.0.1:' + port;
  await startServer(port);
  const browser = await webkit.launch();
  try {
    // ---------- 1) Alle størrelser, begge børn: 🎮-fanen og en runde med tryk på niveau 1 ----------
    await del('1) Alle størrelser, begge børn: 🎮-fanen og en runde med tryk på niveau 1', async () => {
      for (const vp of VP) for (const barn of BOERN) {
        const navn = barn.id + '-' + vp.navn;
        const { ctx, page } = await nySide(browser, vp, vp.navn.indexOf('tvaers') > 0 ? { reducedMotion: 'reduce' } : {});
        await page.goto(BASE + '/' + barn.fil);
        await page.evaluate(([n, s]) => { localStorage.setItem(n, s); }, [barn.id + '_samling_v1', SAMLING]);
        await page.reload();
        await tryk(page, vp, '.nav-btn[data-side="spil"]');
        const fane = await page.evaluate(() => {
          const p = document.getElementById('panel-spil'), forste = p.querySelector('.lego-brick'), m = document.querySelector('.main');
          return { forste: forste.tagName + '.' + forste.className, titel: document.getElementById('pageTitle').textContent,
                   vandret: m.scrollWidth > m.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
                   hoejde: Math.round(forste.getBoundingClientRect().height), links: p.querySelectorAll('a.lego-brick').length };
        });
        await page.screenshot({ path: path.join(SKUD, navn + '-1-fanen.png') });
        tjek(navn + ': 🎮 viser spillet først som en knap, LEGO-linkene efter, uden vandret rulning',
             /^BUTTON\..*spil-klods/.test(fane.forste) && fane.links === 4 && !fane.vandret && fane.hoejde >= 52,
             fane.forste + ', ' + fane.links + ' links, højde ' + fane.hoejde + ', titel «' + fane.titel + '»');

        await tryk(page, vp, '.spil-klods');
        await page.waitForSelector('#spilOverlay.show');
        await page.waitForTimeout(300);
        let m = await maal(page);
        await page.screenshot({ path: path.join(SKUD, navn + '-2-start.png') });
        tjek(navn + ': start — primær knap ≥ ' + vp.primaer + ' px, alt ≥ 52 px og på skærmen, appen inert',
             m.a && m.a.h >= vp.primaer && m.mindst >= 52 && !m.udenfor && !m.vandret && m.inert && m.taarn && m.taarn.h > 100,
             'A ' + (m.a && m.a.b + '×' + m.a.h) + ', mindst ' + m.mindst + ', tårn ' + (m.taarn && m.taarn.b + '×' + m.taarn.h) +
             ', udenfor ' + m.udenfor);

        await tryk(page, vp, '.spil-knap.primaer');
        await ventSkaerm(page, 'vis');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SKUD, navn + '-3-vis.png') });
        await ventSkaerm(page, 'byg');
        m = await maal(page);
        await page.screenshot({ path: path.join(SKUD, navn + '-4-byg.png') });
        tjek(navn + ': byg — ✅ og 👀 synlige og store nok', m.a && m.b && m.a.h >= vp.primaer && m.b.h >= 52 && !m.udenfor,
             'A ' + (m.a && m.a.h) + ', B ' + (m.b && m.b.h));
        await tryk(page, vp, '.spil-knap.primaer');
        await ventSkaerm(page, 'facit');
        await page.waitForTimeout(1300);           // gardinet glider væk
        await page.screenshot({ path: path.join(SKUD, navn + '-5-facit.png') });
        await tryk(page, vp, '.spil-knap.primaer');
        await page.waitForSelector('.spil-sticker');
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SKUD, navn + '-6-sticker.png') });
        const gemt = JSON.parse(await lager(page, barn.id + '_spil_v1'));
        tjek(navn + ': sticker gemt i ' + barn.id + '_spil_v1, samlingen urørt',
             gemt.husk.stickers === 1 && gemt.husk.spillet === 1 && (await lager(page, barn.id + '_samling_v1')) === SAMLING,
             JSON.stringify(gemt.husk));
        const tale = await page.evaluate(() => window.__tale);
        tjek(navn + ': stemmens nøgler i rækkefølge (stille uden klip)',
             tale[0] === 'faelles.intro-' + barn.figur && tale.includes('husk.se') && tale.includes('husk.gemmer') &&
             tale.includes('husk.facit') && tale.includes('faelles.sticker'), tale.join(' '));
        await tryk(page, vp, '.spil-luk');
        const lukket = await page.evaluate(() => ({ vist: document.getElementById('spilOverlay').classList.contains('show'),
          inert: document.querySelector('.app').hasAttribute('inert'),
          fokus: document.activeElement && document.activeElement.classList.contains('spil-klods') }));
        tjek(navn + ': ✕ lukker straks, appen er aktiv igen, fokus på spil-klodsen', !lukket.vist && !lukket.inert && lukket.fokus,
             JSON.stringify(lukket));
        await ctx.close();
      }
    });

    // ---------- 2) Tjek-spørgsmålet med tryk (niveau 3): rigtigt svar giver stjerne ----------
    await del('2) Tjek-spørgsmålet med tryk (niveau 3): rigtigt svar giver stjerne', async () => {
      for (const [vp, barn] of [[VP[0], BOERN[0]], [VP[2], BOERN[1]]]) {
        const navn = barn.id + '-' + vp.navn + '-spoerg';
        const { ctx, page } = await nySide(browser, vp);
        await page.goto(BASE + '/' + barn.fil);
        await page.evaluate(k => localStorage.setItem(k, '{"v":1,"husk":{"niveau":3,"rekord":2}}'), barn.id + '_spil_v1');
        await page.reload();
        await tryk(page, vp, '.nav-btn[data-side="spil"]');
        await tryk(page, vp, '.spil-klods');
        await page.waitForSelector('#spilOverlay.show');
        await tryk(page, vp, '.spil-knap.primaer');
        await ventSkaerm(page, 'vis');
        const taarn = await laesTaarn(page);
        await ventSkaerm(page, 'byg');
        await tryk(page, vp, '.spil-knap.primaer');
        await ventSkaerm(page, 'spoerg');
        await page.waitForTimeout(300);
        const q = await rigtigtSvar(page, taarn);
        const m = await maal(page);
        await page.screenshot({ path: path.join(SKUD, navn + '-1-spoergsmaal.png') });
        tjek(navn + ': spørgsmålet har tre store svar med det rigtige, alt på skærmen', q.i >= 0 && q.valg.length === 3 && m.mindst >= 52 && !m.udenfor,
             q.tale + ' → ' + q.svar + ' blandt ' + q.valg.join('/') + ' (tårn ' + q.taarn + '), mindste knap ' + m.mindst);
      if (q.i < 0) return;
        await tryk(page, vp, '.spil-svar:nth-child(' + (q.i + 1) + ')');
        await page.waitForSelector('.st-stjerne');
        await page.screenshot({ path: path.join(SKUD, navn + '-2-rigtigt.png') });
        await tryk(page, vp, '.spil-knap.primaer');          // ▶
        await ventSkaerm(page, 'facit');
        await tryk(page, vp, '.spil-knap.primaer');          // ✅ Ja
        await page.waitForSelector('.spil-sticker');
        await page.screenshot({ path: path.join(SKUD, navn + '-3-sticker-stjerne.png') });
        const gemt = JSON.parse(await lager(page, barn.id + '_spil_v1'));
        tjek(navn + ': stjerne og ny rekord gemt', gemt.husk.stjerner === 1 && gemt.husk.rekord === 3 && gemt.husk.stickers === 1,
             JSON.stringify(gemt.husk));
        await ctx.close();
      }
    });

    // ---------- 3) Hele runden med tastaturet (tastaturcoveret), Ella på desktop ----------
    await del('3) Hele runden med tastaturet (tastaturcoveret), Ella på desktop', async () => {
      {
        const vp = VP[4], barn = BOERN[1], navn = barn.id + '-tastatur';
        const { ctx, page } = await nySide(browser, vp);
        await page.goto(BASE + '/' + barn.fil);
        await page.evaluate(k => localStorage.setItem(k, '{"v":1,"husk":{"niveau":2}}'), barn.id + '_spil_v1');
        await page.reload();
        await page.click('.nav-btn[data-side="spil"]');
        await page.focus('.spil-klods');
        await hvil(page); await page.keyboard.press('Enter');
        await page.waitForSelector('#spilOverlay.show');
        const fokusA = await page.evaluate(() => document.activeElement.classList.contains('primaer'));
        await hvil(page); await page.keyboard.press(' ');
        await ventSkaerm(page, 'vis');
        const taarn = await laesTaarn(page);
        await ventSkaerm(page, 'byg');
        await hvil(page); await page.keyboard.press('Enter');
        await ventSkaerm(page, 'spoerg');
        const q = await rigtigtSvar(page, taarn);
        await hvil(page); await page.keyboard.press(String(q.i + 1));   // 1-3 hviler 450 ms som svarknapperne
        await page.waitForSelector('.st-stjerne');
        await hvil(page); await page.keyboard.press('ArrowRight');
        await ventSkaerm(page, 'facit');
        await hvil(page); await page.keyboard.press('Enter');
        await page.waitForSelector('.spil-sticker');
        await page.screenshot({ path: path.join(SKUD, navn + '-sticker.png') });
        await hvil(page); await page.keyboard.press('ArrowRight');
        await ventSkaerm(page, 'start');
        await page.keyboard.press('Escape');
        const slut = await page.evaluate(k => ({ vist: document.getElementById('spilOverlay').classList.contains('show'),
          fokus: document.activeElement.classList.contains('spil-klods'), data: JSON.parse(localStorage.getItem(k)).husk }),
          barn.id + '_spil_v1');
        tjek(navn + ': fokus på ▶ ved åbning; Mellemrum, Enter, ' + (q.i + 1) + ', →, Enter, →, Escape spiller en hel runde',
             fokusA && !slut.vist && slut.fokus && slut.data.stickers === 1 && slut.data.stjerner === 1,
             JSON.stringify(slut));
        // En holdt Enter på ✕: det første tryk lukker, og gentagelserne (repeat) lander på spil-klodsen,
        // som fokus går tilbage til. De må ikke åbne spillet igen.
        await hvil(page); await page.keyboard.press('Enter');
        await page.waitForSelector('#spilOverlay.show');
        await hvil(page); await page.focus('.spil-luk');
        await page.keyboard.down('Enter');
        await page.waitForFunction(() => !document.getElementById('spilOverlay').classList.contains('show'));
        await page.evaluate(() => {
          window.__rep = 0; document.addEventListener('keydown', e => { if (e.repeat) window.__rep++; }, true); });
        await page.keyboard.down('Enter'); await page.keyboard.down('Enter');
        await page.keyboard.up('Enter');
        await page.waitForTimeout(600);
        const holdt = await page.evaluate(() => ({ vist: document.getElementById('spilOverlay').classList.contains('show'),
          fokus: document.activeElement.classList.contains('spil-klods'), repeat: window.__rep }));
        tjek(navn + ': en holdt Enter på ✕ lukker spillet og åbner det ikke igen',
             holdt.repeat === 2 && !holdt.vist && holdt.fokus, JSON.stringify(holdt));
        await ctx.close();
      }
    });

    // ---------- 4) Ødelagte spil-data og fuld localStorage ----------
    await del('4) Ødelagte spil-data og fuld localStorage', async () => {
      {
        const vp = VP[3], barn = BOERN[0], navn = barn.id + '-oedelagt';
        const { ctx, page } = await nySide(browser, vp);
        await page.goto(BASE + '/' + barn.fil);
        await page.evaluate(([k, s]) => { localStorage.setItem(k, '{"husk":{"niveau":"x",'); localStorage.setItem(s, '{"v":2,"samling":[]}'); },
                            [barn.id + '_spil_v1', barn.id + '_samling_v1']);
        await page.reload();
        await page.tap('.nav-btn[data-side="spil"]');
        await page.tap('.spil-klods');
        await page.waitForSelector('#spilOverlay.show');
        const s1 = await skaerm(page), urort = await lager(page, barn.id + '_spil_v1');
        await hvil(page); await page.tap('.spil-knap.primaer');
        await ventSkaerm(page, 'byg');
        await hvil(page); await page.tap('.spil-knap.primaer');
        await ventSkaerm(page, 'facit');
        await hvil(page); await page.tap('.spil-knap.primaer');
        await page.waitForSelector('.spil-sticker');
        const efter = JSON.parse(await lager(page, barn.id + '_spil_v1'));
        tjek(navn + ': ødelagt værdi → spillet starter på niveau 1 og gemmer en gyldig værdi bagefter',
             s1 === 'start' && urort === '{"husk":{"niveau":"x",' && efter.v === 1 && efter.husk.stickers === 1,
             s1 + ', ' + JSON.stringify(efter.husk));
        // Fuld lager: setItem kaster → én besked, og spillet kører videre
        await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('fuld', 'QuotaExceededError'); }; });
        await hvil(page); await page.tap('.spil-knap.primaer');
        await ventSkaerm(page, 'start');
        await hvil(page); await page.tap('.spil-knap.primaer');
        await ventSkaerm(page, 'byg');
        await hvil(page); await page.tap('.spil-knap.primaer');
        await ventSkaerm(page, 'facit');
        await hvil(page); await page.tap('.spil-knap.primaer');
        await page.waitForSelector('.spil-sticker');
        await page.waitForTimeout(400);
        const toast = await page.evaluate(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.textContent : ''; });
        await page.screenshot({ path: path.join(SKUD, navn + '-fuld-lager.png') });
        tjek(navn + ': fuld localStorage → besked, og runden går videre', /gemme stickeren/.test(toast) && (await skaerm(page)) === 'facit',
             '«' + toast + '»');
        await ctx.close();
      }
    });

    // ---------- 5) Stemmen med falske klip (WAV i .mp3-navne; decodeAudioData ser på indholdet) ----------
    await del('5) Stemmen med falske klip (WAV i .mp3-navne; decodeAudioData ser på indholdet)', async () => {
      {
        const noegler = ['faelles.intro-dino', 'husk.se', 'husk.gemmer', 'husk.byg', 'faelles.faerdig-tryk'];
        const RATE = 22050, KLIP_MS = 300, AFSTAND_MS = 400;
        const wav = n => {
          const prøver = Math.round(RATE * n * AFSTAND_MS / 1000), b = Buffer.alloc(44 + prøver * 2);
          b.write('RIFF', 0); b.writeUInt32LE(36 + prøver * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
          b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28);
          b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(prøver * 2, 40);
          for (let i = 0; i < prøver; i++) b.writeInt16LE(Math.round(2000 * Math.sin(i / 8)), 44 + i * 2);
          return b;
        };
        const ix = {};
        noegler.forEach((n, i) => {
          const [s, k] = n.split('.');
          ix[s] = ix[s] || { fil: 'tale/' + s + '-0123abcd.mp3', klip: {} };
          ix[s].klip[k] = [i * AFSTAND_MS, KLIP_MS];
        });
        fs.mkdirSync(path.join(WEBROD, 'tale'), { recursive: true });
        fs.writeFileSync(path.join(WEBROD, 'tale/indeks.json'), JSON.stringify(ix));
        for (const s of Object.keys(ix)) fs.writeFileSync(path.join(WEBROD, ix[s].fil), wav(noegler.length));
        const vp = VP[2], navn = 'alma-klip';
        const { ctx, page } = await nySide(browser, vp);
        await page.goto(BASE + '/alma-dino.html');
        await page.tap('.nav-btn[data-side="spil"]');
        await page.tap('.spil-klods');
        await page.waitForSelector('#spilOverlay.show');
        await page.waitForSelector('.spil-sig:not([hidden])', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(2000);
        const r = await page.evaluate(() => ({ lyd: window.__lyd.map(x => x.map(v => Math.round(v * 1000))),
          sig: !document.querySelector('.spil-sig').hidden, webaudio: typeof window.AudioBufferSourceNode }));
        let efterR = [];
        if (r.webaudio === 'undefined') {
          // Playwrights WebKit på Windows kan mangle WebAudio: så må 🔊 ikke vises, og afspilningen kan ikke måles her
          tjek(navn + ': uden WebAudio i browseren vises 🔊 ikke', !r.sig, JSON.stringify(r));
          resultater.push(['IKKE MÅLT', navn + ': afspilning af klip og r (denne WebKit har ingen WebAudio)', '']);
        } else {
          tjek(navn + ': med klip afspilles intro og «Se godt på tårnet» som udsnit af spriten, og 🔊 vises',
               r.sig && r.lyd.length >= 2 && r.lyd[0][0] === 0 && r.lyd[0][1] === KLIP_MS && r.lyd[1][0] === AFSTAND_MS,
               JSON.stringify(r));
          await page.keyboard.press('r');
          await page.waitForTimeout(800);
          efterR = await page.evaluate(() => window.__lyd.map(x => Math.round(x[0] * 1000)));
          tjek(navn + ': r gentager den sidste sætning', efterR.slice(-1)[0] === AFSTAND_MS, efterR.join(' '));
        }
        await page.evaluate(() => localStorage.setItem('alma_lyd', 'nej'));
        await page.keyboard.press('Escape');
        await page.tap('.spil-klods');
        await page.waitForTimeout(1500);
        const stille = await page.evaluate(() => ({ lyd: window.__lyd.length, sig: !document.querySelector('.spil-sig').hidden }));
        tjek(navn + ': med 🔇 siges intet, og 🔊 er skjult', stille.lyd === efterR.length && !stille.sig, JSON.stringify(stille));
        await page.screenshot({ path: path.join(SKUD, navn + '-lyd-fra.png') });
        await ctx.close();
        fs.rmSync(path.join(WEBROD, 'tale'), { recursive: true, force: true });
      }
    });

    // ---------- 6) Offline: service workeren har spillets filer ----------
    await del('6) Offline: service workeren har spillets filer', async () => {
      {
        const sctx = await webkit.launchPersistentContext(PROFIL, { viewport: { width: 390, height: 844 }, hasTouch: true });
        aabne.push(sctx);
        sctx.on('weberror', e => sidefejl.push('offline: ' + e.error().message));
        const page = sctx.pages()[0] || await sctx.newPage();
        await page.goto(BASE + '/alma-dino.html');
        await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
        await page.waitForTimeout(2500);                  // appen genindlæser selv efter controllerchange
        await page.waitForLoadState('load');
        await page.waitForFunction(async () => {
          const c = await caches.open('lego-app-v1');
          return !!(await c.match('spil.js')) && !!(await c.match('spil-data.js'));
        }, null, { timeout: 15000, polling: 500 }).catch(() => {});
        stopServer();
        await new Promise(ok => setTimeout(ok, 500));
        for (const barn of BOERN) {
          await page.goto(BASE + '/' + barn.fil);
          await page.waitForTimeout(1200);
          await page.tap('.nav-btn[data-side="spil"]');
          const harKlods = await page.$('.spil-klods');
          let s = 'ingen spil-klods';
          if (harKlods) {
            await page.tap('.spil-klods');
            await hvil(page); await page.tap('.spil-knap.primaer');
            await ventSkaerm(page, 'byg').catch(() => {});
            s = await skaerm(page);
          }
          await page.screenshot({ path: path.join(SKUD, barn.id + '-offline-390x844.png') });
          tjek(barn.id + ' offline: spillet åbner og når til byg uden net', s === 'byg', s);
        }
        await sctx.close();
      }
    });
  } finally {
    await browser.close().catch(() => {});
    stopServer();
  }
  tjek('ingen sidefejl (undtagelser i siden)', sidefejl.length === 0, sidefejl.slice(0, 5).join(' | '));
  tjek('ingen konsolfejl ud over 404 på tale/', konsolfejl.length === 0, konsolfejl.slice(0, 5).join(' | '));
  console.log('');
  for (const [st, n, d] of resultater) console.log(st, n, d !== '' ? '(' + d + ')' : '');
  const fejl = resultater.filter(x => x[0] === 'FEJL').length, ikkeMaalt = resultater.filter(x => x[0] === 'IKKE MÅLT').length;
  console.log('\n' + resultater.filter(x => x[0] === 'OK  ').length + '/' + resultater.length + ' tjek bestået' +
              (ikkeMaalt ? ', ' + ikkeMaalt + ' ikke målt' : '') + ' · skærmbilleder i ' + SKUD);
  process.exit(fejl ? 1 : 0);
})().catch(e => { stopServer(); console.error(e); process.exit(1); });

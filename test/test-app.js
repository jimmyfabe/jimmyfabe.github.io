// Tester logikken i app.js uden browser: udvalgte funktioner trækkes ud af
// kildeteksten og køres i en vm med falske DOM-elementer.
//   node test/test-app.js                 (tester app.js)
//   node test/test-app.js <sti>           (tester en anden udgave, fx en gammel)
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROD = path.join(__dirname, '..');   // projektmappen, uanset hvor den ligger
const kilde = fs.readFileSync(process.argv[2] || ROD + '/app.js', 'utf8');

function udtraek(navn) {
  const i = kilde.indexOf('function ' + navn + '(');
  if (i < 0) return '';                    // findes ikke i denne udgave
  let dybde = 0;
  for (let k = kilde.indexOf('{', i); k < kilde.length; k++) {
    if (kilde[k] === '{') dybde++;
    else if (kilde[k] === '}' && --dybde === 0) return kilde.slice(i, k + 1);
  }
}

/* Et falsk DOM-element med netop det app.js rører ved */
function lavEl() {
  const cls = new Set();
  return {
    textContent: '', href: '', disabled: false, srcObject: null, dataset: {},
    parentNode: { classList: { toggle() {} } },
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, f) => (f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c),
    },
    play: () => Promise.resolve(),
  };
}

/* Bygger en frisk verden med de valgte funktioner fra app.js */
function verden(funktioner, ekstra) {
  const el = {};
  const ctx = Object.assign({
    T: { noegle: 'test_samling_v1' },
    $: id => (el[id] = el[id] || lavEl()),
    toasts: [], visToast(t) { ctx.toasts.push(t); },
    ventende: [], setTimeout(f, ms) { ctx.ventende.push(f); },   // køres ikke af sig selv
    Promise, JSON, Date, Math, String, Array, Object,
  }, ekstra);
  vm.createContext(ctx);
  vm.runInContext(
    'var nummer = "", aktueltSaet = null, stroem = null, tessWorker = null,' +
    '    scanGen = 0, scannerKoerer = false, sidsteBud = null, afviste = {}, DB = {};\n' +
    funktioner.map(udtraek).join('\n'), ctx);
  return { ctx, el };
}
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };

const resultater = [];
function tjek(navn, ok, detalje) { resultater.push([ok ? 'OK  ' : 'FEJL', navn, detalje || '']); }

(async () => {
  /* ── MIN SAMLING ─────────────────────────────────────────────────────── */
  const SAMLING = ['hentSamling', 'skrivSamling', 'opdaterBadge'];
  function lager(indhold, skrivFejler) {
    const m = { test_samling_v1: indhold };
    return { localStorage: {
      getItem: k => (k in m ? m[k] : null),
      setItem: (k, v) => { if (skrivFejler) throw new Error('QuotaExceededError'); m[k] = v; },
    } };
  }

  // 1) En null-post i den gemte liste må ikke vælte appen
  let w = verden(SAMLING, lager(JSON.stringify([null, { num: '6339', navn: 'Shuttle' }])));
  let ud;
  try { ud = w.ctx.hentSamling(); } catch (e) { ud = e; }
  tjek('null-post i samlingen kaster ikke', Array.isArray(ud) && ud.length === 1,
       Array.isArray(ud) ? ud.length + ' sæt' : String(ud));

  // 2) Fuld kvote + gammelt format: ingen uendelig løkke, og sættet er der stadig
  w = verden(SAMLING, lager(JSON.stringify([{ num: '6075', name: 'Wolfpack Tower' }]), true));
  try { ud = w.ctx.hentSamling(); } catch (e) { ud = e; }
  tjek('fuld kvote giver ingen uendelig løkke',
       Array.isArray(ud) && ud.length === 1 && ud[0].navn === 'Wolfpack Tower',
       Array.isArray(ud) ? '' : (ud && ud.constructor.name));
  tjek('fuld kvote: højst én toast', w.ctx.toasts.length <= 1, w.ctx.toasts.length + ' toasts');

  /* ── TALTASTATUR ─────────────────────────────────────────────────────── */
  // 3) Et nyt tal skjuler det gamle resultat, så den store knap ikke peger forkert
  w = verden(['visNummer', 'tastTryk', 'tastSlet', 'skjulResultat']);
  w.ctx.$('setResult').classList.add('show');
  w.ctx.tastTryk('4');
  tjek('nyt ciffer skjuler det gamle resultat', !w.el.setResult.classList.contains('show'));
  w.ctx.$('setResult').classList.add('show');
  w.ctx.tastSlet();
  tjek('slet skjuler det gamle resultat', !w.el.setResult.classList.contains('show'));

  // 4) ⭐ Gem den mens der står "Leder..." må ikke gemme det forrige sæt
  w = verden(['slaaOp', 'visNummer'], {
    brickUrl: n => 'b/' + n, legoUrl: n => 'l/' + n,
    hentDb: () => new Promise(() => {}),        // databasen svarer aldrig i denne test
  });
  vm.runInContext('aktueltSaet = { num: "6075", navn: "Wolfpack Tower" }', w.ctx);
  w.ctx.slaaOp('4525');
  const aktuel = vm.runInContext('aktueltSaet', w.ctx);
  tjek('aktuelt sæt skifter med det samme ved opslag', aktuel && aktuel.num === '4525',
       aktuel ? '#' + aktuel.num : 'null');

  /* ── SCANNER ─────────────────────────────────────────────────────────── */
  // Kamerastrømme vi kan holde øje med
  function strøm(navn) {
    const spor = { stoppet: false, stop() { this.stoppet = true; } };
    return { navn, spor, getTracks: () => [spor] };
  }
  function scannerVerden() {
    const tilladelser = [];                       // ventende getUserMedia-kald
    const teller = { genkend: 0 };                // hvor mange gange OCR'en blev kaldt
    const w = verden(['slukKamera', 'startScanner', 'stopScanner', 'ocrLoekke', 'scanStatus'], {
      hentDb: () => Promise.resolve({}),
      navigator: { mediaDevices: { getUserMedia: () => new Promise(ok => tilladelser.push(ok)) } },
      klargoerOcr: () => Promise.resolve(),
      grebFrame: () => ({}),
      budFraTekst: () => [],
      teller,
    });
    /* recognize svarer straks med tom tekst, så løkken planlægger en ny runde */
    vm.runInContext('tessWorker = { recognize: function () { teller.genkend++; ' +
                    'return Promise.resolve({ data: { text: "" } }); } }', w.ctx);
    return { w, tilladelser, genkend: () => teller.genkend };
  }

  // 5) Scan → Luk → Scan, mens iOS spørger om kameraet. Den første tilladelse
  //    kommer først bagefter. Kun ét kamera må være tændt, og kun én OCR-løkke.
  let sv = scannerVerden();
  sv.w.ctx.startScanner();
  sv.w.ctx.stopScanner();
  sv.w.ctx.startScanner();
  const a = strøm('A'), b = strøm('B');
  sv.tilladelser[0](a); await flush();
  sv.tilladelser[1](b); await flush();
  tjek('Scan-Luk-Scan: det første kamera slukkes', a.spor.stoppet, 'A stoppet=' + a.spor.stoppet);
  tjek('Scan-Luk-Scan: det andet kamera kører', !b.spor.stoppet);
  tjek('Scan-Luk-Scan: kun én OCR-løkke', sv.genkend() === 1, sv.genkend() + ' løkker');

  // 6) Dobbelttryk på Scan
  sv = scannerVerden();
  sv.w.ctx.startScanner();
  sv.w.ctx.startScanner();
  const c = strøm('C'), d = strøm('D');
  sv.tilladelser[0](c); await flush();
  sv.tilladelser[1](d); await flush();
  tjek('dobbelttryk: højst ét kamera tændt', [c, d].filter(s => !s.spor.stoppet).length === 1,
       [c, d].filter(s => !s.spor.stoppet).length + ' tændt');

  // 7) Luk slukker kameraet og stopper løkken
  sv.w.ctx.stopScanner();
  const foer = sv.genkend();
  sv.w.ctx.ventende.splice(0).forEach(f => f());   // kør alle ventende setTimeout'er
  await flush();
  tjek('Luk slukker alle kameraer', c.spor.stoppet && d.spor.stoppet);
  tjek('Luk stopper OCR-løkken', sv.genkend() === foer, (sv.genkend() - foer) + ' ekstra kald');

  // 8) Luk + Scan igen mens tal-læseren hentes: kun ÉN motor må startes
  function ocrVerden(scriptFejler) {
    const t = { scripts: 0, motorer: 0 };
    const w = verden(['klargoerOcr'], {
      t, TESS: { script: 's', worker: 'w', core: 'c', sprog: 'l' },
      indlaesScript: () => { t.scripts++; return scriptFejler.shift() ? Promise.reject(new Error('net')) : Promise.resolve(); },
      Tesseract: { createWorker: () => { t.motorer++; return Promise.resolve({ setParameters: () => Promise.resolve() }); } },
    });
    vm.runInContext('var ocrLoefte = null;', w.ctx);
    return { w, t };
  }
  let ov = ocrVerden([false]);
  await Promise.all([ov.w.ctx.klargoerOcr(), ov.w.ctx.klargoerOcr()]);
  tjek('to samtidige Scan starter kun én OCR-motor', ov.t.motorer === 1 && ov.t.scripts === 1,
       ov.t.motorer + ' motorer, ' + ov.t.scripts + ' scripts');

  // 9) Fejler hentningen, skal næste tryk på Scan prøve igen
  ov = ocrVerden([true, false]);
  await ov.w.ctx.klargoerOcr().catch(() => {});
  let igen;
  try { await ov.w.ctx.klargoerOcr(); igen = ov.t.motorer; } catch (e) { igen = 'fejl'; }
  tjek('efter en fejlet hentning prøves der igen', igen === 1, 'motorer: ' + igen);

  /* ── BACKUP AF SAMLINGEN ─────────────────────────────────────────────── */
  const BACKUP = ['lavBackup', 'heltal', 'laesBackup', 'fletSamling'];
  w = verden(BACKUP, { T: { id: 'alma', navn: 'ALMA' } });
  const B = w.ctx;
  const samling = [
    { num: '6339', navn: 'Shuttle Launch Pad', aar: 1995, variant: 1, saved: 1700000000000 },
    { num: '6075', navn: 'Min egen borg',      aar: 1992, variant: 1, saved: 1700000000001 },
  ];

  // 10) Tur-retur: gem -> hent giver præcis de samme sæt
  const fil = JSON.stringify(B.lavBackup(samling));
  const laest = B.laesBackup(fil);
  tjek('backup tur-retur giver samme sæt', laest && JSON.stringify(laest.saet) === JSON.stringify(samling));
  tjek('backup husker hvis app den er fra', laest && laest.app === 'alma' && laest.navn === 'ALMA');

  // 11) Fletning sletter og overskriver ALDRIG
  const egne = [{ num: '6075', navn: 'Ellas navn til borgen' }, { num: '41068', navn: 'Arendelle' }];
  const flet = B.fletSamling(egne, laest.saet);
  tjek('fletning beholder alle egne sæt', egne.every(e => flet.liste.some(x => x.num === e.num)),
       flet.liste.map(x => x.num).join(','));
  tjek('fletning overskriver ikke et eksisterende navn',
       flet.liste.find(x => x.num === '6075').navn === 'Ellas navn til borgen');
  tjek('fletning tæller kun de nye', flet.antalNye === 1 && flet.liste.length === 3, flet.antalNye + ' nye');

  // 12) Ugyldige filer afvises
  const afvist = ['ikke json', '{"hej":1}', 'null', '42', '"tekst"'].filter(t => B.laesBackup(t) !== null);
  tjek('ugyldige filer afvises', afvist.length === 0, afvist.join(' | '));

  // 13) Poster renses: kun cifre i nummeret, navn afkortes, dubletter og affald væk
  const snavs = B.laesBackup(JSON.stringify({ samling: [
    null, 42, 'tekst', { num: '12ab' }, { num: '<img src=x>' }, { num: '' },
    { num: 6008, name: 'Royal King' },                        // gammelt format, nummer som tal
    { num: '4525', navn: 'x'.repeat(500), aar: 'ikke et år', variant: -3 },
    { num: '4525', navn: 'dublet' },
  ] }));
  tjek('kun gyldige numre overlever', snavs && snavs.saet.map(x => x.num).join(',') === '6008,4525',
       snavs && snavs.saet.map(x => x.num).join(','));
  const lang = snavs && snavs.saet.find(x => x.num === '4525');
  tjek('langt navn afkortes til 60 tegn', lang && lang.navn.length === 60, lang && lang.navn.length);
  tjek('tal renses', lang && lang.aar === 0 && lang.variant === 1, lang && JSON.stringify([lang.aar, lang.variant]));
  tjek('gammelt format (name) læses', snavs && snavs.saet[0].navn === 'Royal King');

  // 14) En ren liste (uden indpakning) accepteres også
  const ren = B.laesBackup(JSON.stringify(samling));
  tjek('ren liste uden indpakning accepteres', ren && ren.saet.length === 2 && ren.app === '');

  // 15) Hent kopi, når lageret er fuldt: der må IKKE meldes succes
  function kopiVerden(gemt, fil, skrivFejler) {
    const w = verden(['hentKopi', 'laesBackup', 'heltal', 'fletSamling', 'hentSamling',
                      'skrivSamling', 'opdaterBadge', 'penNavn'],
      Object.assign(lager(JSON.stringify(gemt), skrivFejler), {
        T: { id: 'ella', navn: 'ELLA', noegle: 'test_samling_v1' },
        visSamling() {}, window: { confirm: () => true },
        FileReader: class { readAsText(f) { this.result = f.tekst; this.onload(); } },
      }));
    vm.runInContext('var MAKS_KOPI = 1048576, MAKS_SAET = 1000;', w.ctx);
    w.ctx.hentKopi({ files: [{ size: fil.length, tekst: fil }], value: 'x' });
    return w;
  }
  const kopi = JSON.stringify({ app: 'alma', navn: 'ALMA', samling: [{ num: '6339', navn: 'Shuttle' }] });
  let kw = kopiVerden([{ num: '41068', navn: 'Arendelle' }], kopi, true);
  tjek('fuld kvote: ingen falsk "hentet ind"', !kw.ctx.toasts.some(t => /hentet ind/.test(t)),
       kw.ctx.toasts.join(' | '));
  kw = kopiVerden([{ num: '41068', navn: 'Arendelle' }], kopi, false);
  tjek('normal hentning melder succes', kw.ctx.toasts.some(t => /1 sæt hentet ind/.test(t)),
       kw.ctx.toasts.join(' | '));

  // 16) En kopi med tusindvis af sæt afvises (ellers fryser Min Samling)
  const kaempe = JSON.stringify({ samling: Array.from({ length: 5000 }, (_, i) => ({ num: String(100000 + i) })) });
  kw = kopiVerden([], kaempe, false);
  tjek('kopi med 5.000 sæt afvises', kw.ctx.toasts.some(t => /for mange/.test(t)) &&
       !kw.ctx.toasts.some(t => /hentet ind/.test(t)), kw.ctx.toasts.join(' | '));

  /* ── BYG-GITTER: PARVIS ───────────────────────────────────────────────── */
  // "parvis" (2+2 ved tre kolonner) kun når tre kolonner giver én enlig klods
  // og to kolonner går op — ikke ved 6 kort (3+3) og ikke med en bred plade.
  {
    const g = verden(['bygBrikGitter', 'el', 'studs'], {
      document: { createElement: () => ({ className: '', appendChild() {} }) },
    });
    const kort = (n, bred) => Array.from({ length: n }, (_, i) => ({ farve: 'roed', bred: bred && i === 0 }));
    const klasse = k => g.ctx.bygBrikGitter(k).className;
    const parvis = k => klasse(k).split(' ').includes('parvis');
    tjek('4 kort står parvis', parvis(kort(4)), klasse(kort(4)));
    tjek('6 kort står ikke parvis (3+3)', !parvis(kort(6)), klasse(kort(6)));
    tjek('3 kort står ikke parvis', !parvis(kort(3)), klasse(kort(3)));
    tjek('4 kort med bred plade står ikke parvis', !parvis(kort(4, true)), klasse(kort(4, true)));
  }

  /* ── 🎮: VORES SPIL ER KNAPPER, LEGO'S ER LINKS ───────────────────────── */
  if (udtraek('lavSpil')) {
    const lavet = [];
    const g = verden(['bygBrikGitter', 'el', 'studs'], {
      document: { createElement: tag => {
        const n = { tag, className: '', lyttere: {}, appendChild() {},
                    addEventListener(t, f) { n.lyttere[t] = f; } };
        lavet.push(n);
        return n;
      } },
      spil: { aabn(id, fra, navn) { g.ctx.aabnet = [id, fra, navn]; } },
    });
    const gitter = g.ctx.bygBrikGitter([{ farve: 3, ikon: '🧠', titel: 'Dino-tårnet', under: 'x', spil: 'husk' },
                                        { farve: 1, ikon: '🚒', titel: 'City', under: 'y', url: 'https://kids.lego.com/' }],
                                       'egne-spil');
    const [spilK, link] = lavet.filter(n => /lego-brick/.test(n.className));
    tjek('spil-klodsen er en <button type="button"> og åbner spillet',
         spilK.tag === 'button' && spilK.type === 'button' && !spilK.href && typeof spilK.lyttere.click === 'function' &&
         (spilK.lyttere.click(), g.ctx.aabnet && g.ctx.aabnet[0] === 'husk' && g.ctx.aabnet[1] === spilK),
         spilK.tag + ' ' + spilK.className);
    tjek('LEGO-klodsen er stadig et link uden klik-lytter',
         link.tag === 'a' && link.href === 'https://kids.lego.com/' && link.target === '_blank' && !link.lyttere.click);
    tjek('gitteret får den ekstra klasse', /\begne-spil\b/.test(gitter.className), gitter.className);

    // Tastaturet går til spillet, mens det er åbent — og ellers til taltastaturet som før
    const tastet = [], sendt = [];
    let lytter = null, aaben = true;
    const t = verden(['tastLyt'], {
      document: { addEventListener(type, f) { if (type === 'keydown') lytter = f; },
                  querySelector: () => ({ id: 'panel-vejledning' }) },
      spil: { erAaben: () => aaben, tast: e => sendt.push(e.key) },
      tastTryk: c => tastet.push(c), tastSlet() {}, soeg() {}, tastRyd() {},
    });
    t.ctx.tastLyt();
    const tryk = key => lytter({ key, preventDefault() {} });
    tryk('5'); tryk('Escape');
    aaben = false; tryk('7');
    tjek('tastLyt sender tasterne til spillet, mens det er åbent', sendt.join() === '5,Escape' && tastet.join() === '7',
         'spil: ' + sendt.join() + ' / tastatur: ' + tastet.join());

    // Kaster spil.js under opstarten, forsvinder spil-klodsen, og resten af appen starter som før
    let fjernet = false;
    const gitter2 = { parentNode: { removeChild: n => { fjernet = n === gitter2; } } };
    const s = verden(['lavSpil'], {
      spil: null,
      window: { KLODSESPIL: { lav() { throw new Error('fejl i spil.js'); } } },
      document: { querySelector: sel => (sel === '.egne-spil' ? gitter2 : null), body: { appendChild() {} } },
    });
    let kastet = null;
    try { s.ctx.lavSpil(); } catch (e) { kastet = e; }
    tjek('en fejl i spil.js stopper ikke appen, og spil-klodsen fjernes', !kastet && fjernet && s.ctx.spil === null,
         kastet ? String(kastet) : 'fjernet=' + fjernet);

    // byg() med begge skallers rigtige TEMA: spil-klodsen står præcis én gang, i sit eget gitter — og slet
    // ikke uden spil.js (ellers stod den også som død knap blandt LEGO-linkene)
    for (const skal of ['alma-dino.html', 'ella-prinsesse.html']) {
      const html = fs.readFileSync(path.join(ROD, skal), 'utf8');
      const tc = { window: {} };
      vm.createContext(tc);
      vm.runInContext(/<script>\s*(window\.TEMA = [\s\S]*?)<\/script>/.exec(html)[1], tc);
      const fundet = {};
      for (const medSpil of [true, false]) {
        const node = tag => ({ tag, className: '', children: [], style: {}, dataset: {},
                               appendChild(c) { this.children.push(c); return c; }, addEventListener() {} });
        const body = node('body'), tom = () => node('div');
        const b = verden(['byg', 'bygBrikGitter', 'el', 'studs'], {
          T: tc.window.TEMA, SIDER: [{ id: 'vejledning', ikon: '', navn: '', titel: '' }],
          window: medSpil ? { KLODSESPIL: {} } : {},
          document: { createElement: node, createTextNode: () => node('#text'), body },
          bygSoegekort: tom, bygVersion: tom, bygKopiRaekke: tom, bygScanner: tom, bygBekraeft: tom,
          lydTaendt: () => false, tvingOpdatering() {},
        });
        b.ctx.byg();
        const gitre = [];
        (function gaa(n, far) {
          if (/\bspil-klods\b/.test(n.className)) gitre.push(far.className);
          n.children.forEach(c => gaa(c, n));
        })(body, null);
        fundet[medSpil ? 'med' : 'uden'] = gitre;
      }
      tjek(skal + ': spil-klodsen står præcis én gang (i .egne-spil), og ikke uden spil.js',
           fundet.med.length === 1 && /\begne-spil\b/.test(fundet.med[0]) && fundet.uden.length === 0,
           'med spil.js: ' + fundet.med.length + ' [' + fundet.med.join(' | ') + '] · uden: ' + fundet.uden.length);
    }
  }

  console.log('');
  for (const [st, n, det] of resultater) console.log(st, n, det ? '(' + det + ')' : '');
  const fejl = resultater.filter(x => x[0] === 'FEJL').length;
  console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tests bestået');
  process.exit(fejl ? 1 : 0);
})();

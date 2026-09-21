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

  console.log('');
  for (const [st, n, det] of resultater) console.log(st, n, det ? '(' + det + ')' : '');
  const fejl = resultater.filter(x => x[0] === 'FEJL').length;
  console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tests bestået');
  process.exit(fejl ? 1 : 0);
})();

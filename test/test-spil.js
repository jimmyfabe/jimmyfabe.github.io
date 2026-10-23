// Tester de rene funktioner i spil.js (klodsespillene) uden browser: datanøglen, laesSpil med
// ødelagte data, tårnet, tjek-spørgsmålet, niveauet, Huskeklodsens skærme, lydindekset og tegneren.
// spil.js' krop køres i en vm med spil-data.js, og funktionerne hentes ud ved navn.
//   node test/test-spil.js                 (tester spil.js)
//   node test/test-spil.js <sti>           (tester en anden udgave, fx en med en kendt fejl)
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROD = path.join(__dirname, '..');
const kilde = fs.readFileSync(process.argv[2] || path.join(ROD, 'spil.js'), 'utf8').replace(/\r\n/g, '\n');
const dataKilde = fs.readFileSync(path.join(ROD, 'spil-data.js'), 'utf8');

const NAVNE = ['spilNoegle', 'standardSpil', 'laesSpil', 'hentSpil', 'skrivSpil', 'lavTaarn', 'tjekSpoergsmaal',
               'naesteNiveau', 'nyHusk', 'huskTrin', 'laesIndeks', 'klipTid', 'tegnIso', 'lavTale', 'NIVEAUER'];

// Kroppen mellem «(function () {» og «})();» køres med en return til sidst, der udleverer funktionerne
function hentFunktioner() {
  const start = kilde.indexOf('(function () {'), slut = kilde.lastIndexOf('})();');
  const krop = kilde.slice(start + '(function () {'.length, slut);
  // vm'ens egne Object, JSON … — så prototyper kan sammenlignes. document og fetch til stemmen (lavTale);
  // fetch sættes af den enkelte test via F.ctx.
  const ctx = { window: {}, document: { addEventListener() {}, dispatchEvent() {} }, CustomEvent: function () {} };
  vm.createContext(ctx);
  vm.runInContext(dataKilde, ctx);
  const ud = vm.runInContext('(function () {' + krop + '\nreturn {' +
    NAVNE.map(n => n + ': typeof ' + n + ' === "undefined" ? undefined : ' + n).join(', ') + '};\n})()', ctx);
  ud.vmObjektProto = vm.runInContext('Object.prototype', ctx);
  ud.ctx = ctx;
  return ud;
}
const F = hentFunktioner();
const D = (() => { const c = { window: {} }; vm.createContext(c); vm.runInContext(dataKilde, c); return c.window.SPILDATA; })();
const KERNE = D.FARVER.filter(f => f.kerne).map(f => f.id), ALLE = D.FARVER.map(f => f.id);

const resultater = [];
function tjek(navn, ok, detalje) { resultater.push([ok ? 'OK  ' : 'FEJL', navn, detalje || '']); }

// Gentagelig «tilfældighed» (mulberry32), så en fejl kan genskabes. Nabofrø giver forskellige rækker.
function rnd(froe) {
  let a = froe >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── DATANØGLEN ─────────────────────────────────────────────────────────── */
// Spillene har deres egen nøgle, og den er aldrig samlingens — i begge skaller
for (const skal of ['alma-dino.html', 'ella-prinsesse.html']) {
  const html = fs.readFileSync(path.join(ROD, skal), 'utf8');
  const id = /id: '([a-z]+)'/.exec(html)[1], noegle = /noegle: '([^']+)'/.exec(html)[1];
  tjek(skal + ': spillenes nøgle er <id>_spil_v1 og ikke samlingens',
       F.spilNoegle(id) === id + '_spil_v1' && F.spilNoegle(id) !== noegle, F.spilNoegle(id) + ' / ' + noegle);
}

/* ── LAESSPIL: ØDELAGTE OG MANGLENDE DATA ───────────────────────────────── */
const std = F.standardSpil();
const erStandard = d => JSON.stringify(d) === JSON.stringify(std);
const oedelagte = [undefined, null, 42, '', 'null', '[]', '"tekst"', '{', '{"v":', 'true', '[1,2]',
                   'x'.repeat(200000), '{"husk":null,"farver":null}', '{"husk":[1],"farver":{}}'];
let kastede = null;
const svar = oedelagte.map(r => { try { return F.laesSpil(r); } catch (e) { kastede = e; return null; } });
tjek('laesSpil kaster aldrig og giver standarder for ødelagte værdier',
     !kastede && svar.every(erStandard), kastede ? String(kastede) : svar.filter(d => !erStandard(d)).length + ' afvigende');

// Længdevagten: gyldig JSON over grænsen (100.000 tegn) afvises — den samme værdi i lille størrelse læses
{
  const medFyld = n => JSON.stringify({ husk: { niveau: 5 }, fyld: 'x'.repeat(n) });
  const stor = medFyld(200000), lille = medFyld(1000);
  tjek('laesSpil: gyldig JSON over 100.000 tegn giver standarder, i lille størrelse læses den',
       erStandard(F.laesSpil(stor)) && F.laesSpil(lille).husk.niveau === 5,
       stor.length + ' tegn → niveau ' + F.laesSpil(stor).husk.niveau);
}

// Mange tilfældige strenge og JSON-stumper: aldrig en undtagelse, altid en gyldig form
{
  const r = rnd(7), tegn = '{}[]":,0123456789-.eE truefalsnul"\\abcæø';
  let fejl = 0;
  for (let i = 0; i < 3000; i++) {
    let s = '';
    const n = Math.floor(r() * 60);
    for (let k = 0; k < n; k++) s += tegn[Math.floor(r() * tegn.length)];
    if (i % 3 === 0) s = '{"husk":' + s + '}';
    try {
      const d = F.laesSpil(s);
      if (!(d.husk.niveau >= 1 && d.husk.niveau <= 10 && Array.isArray(d.farver) && d.farver.length)) fejl++;
    } catch (e) { fejl++; }
  }
  tjek('3.000 tilfældige værdier: ingen undtagelse og altid gyldige felter', fejl === 0, fejl + ' fejl');
}

{
  const d = F.laesSpil(JSON.stringify({ v: 1, farver: ['roed', 'xx', 'roed', 'lilla', '__proto__', 7], plade: true,
    husk: { niveau: 99, rekord: -5, spillet: 3.9, stickers: '7', stjerner: Infinity } }));
  tjek('farver: kun kendte id\'er, uden dubletter', JSON.stringify(d.farver) === '["roed","lilla"]', JSON.stringify(d.farver));
  tjek('husk-tal klemmes og rundes (niveau 1-10, rekord ≥ 0, tekst = 0)',
       d.husk.niveau === 10 && d.husk.rekord === 0 && d.husk.spillet === 3 && d.husk.stickers === 0 && d.husk.stjerner === 0,
       JSON.stringify(d.husk));
  tjek('plade bevares, når den er sand/falsk', d.plade === true);
  tjek('tom farveliste giver standardfarverne', JSON.stringify(F.laesSpil('{"farver":[]}').farver) === JSON.stringify(D.STANDARD_FARVER));
  tjek('plade som tekst afvises', F.laesSpil('{"plade":"ja"}').plade === false);
}
{
  // En nyere udgave kan have felter, vi ikke kender: de bevares, så de ikke slettes ved næste gem
  const d = F.laesSpil('{"v":2,"byg":{"bygget":{"dino":2}},"husk":{"niveau":3,"lyt":{"niveau":2}}}');
  tjek('ukendte felter bevares (øverst og i husk), og v læses',
       d.v === 2 && d.byg && d.byg.bygget.dino === 2 && d.husk.lyt && d.husk.lyt.niveau === 2 && d.husk.niveau === 3,
       JSON.stringify(d));
}
{
  // «__proto__» i gemte data må hverken skifte prototype eller forurene Object.prototype
  const d = F.laesSpil('{"__proto__":{"ond":1},"constructor":{"x":1},"husk":{"__proto__":{"ond":2}}}');
  tjek('__proto__ og constructor i data ignoreres',
       d.ond === undefined && d.husk.ond === undefined && Object.getPrototypeOf(d) === F.vmObjektProto &&
       Object.getPrototypeOf(d.husk) === F.vmObjektProto && F.vmObjektProto.ond === undefined,
       'ond=' + d.ond + ', husk.ond=' + d.husk.ond);
}
{
  const a = F.laesSpil(null); a.husk.stickers = 99; a.farver.push('lilla');
  const b = F.laesSpil(null);
  tjek('standarderne deles ikke mellem to læsninger', b.husk.stickers === 0 && b.farver.length === 6);
}

/* ── HENT OG GEM: localStorage kan kaste, og samlingen røres ikke ──────── */
{
  const kaster = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  tjek('hentSpil uden adgang til localStorage giver standarder', erStandard(F.hentSpil(kaster, 'alma_spil_v1')) &&
       erStandard(F.hentSpil(null, 'alma_spil_v1')));
  tjek('skrivSpil returnerer false, når localStorage er fuld', F.skrivSpil(kaster, 'alma_spil_v1', std) === false);

  const lager = { data: { alma_samling_v1: '{"v":2,"samling":[{"num":"10696"}]}' },
                  getItem(k) { return k in this.data ? this.data[k] : null; },
                  setItem(k, v) { this.data[k] = String(v); } };
  const foer = lager.data.alma_samling_v1;
  const d = F.hentSpil(lager, 'alma_spil_v1'); d.husk.stickers = 4;
  const ok = F.skrivSpil(lager, 'alma_spil_v1', d);
  tjek('gem skriver kun spillenes nøgle — samlingen er urørt',
       ok && lager.data.alma_samling_v1 === foer && Object.keys(lager.data).sort().join() === 'alma_samling_v1,alma_spil_v1' &&
       F.laesSpil(lager.data.alma_spil_v1).husk.stickers === 4, Object.keys(lager.data).join());
}

/* ── TÅRNET ─────────────────────────────────────────────────────────────── */
{
  let fejl = [];
  const paletter = [D.STANDARD_FARVER, ALLE, ['roed', 'blaa'], ['lilla', 'brun', 'orange', 'gul'], ['gul'], [], ['xx']];
  for (let nv = 1; nv <= 10; nv++) {
    const n = F.NIVEAUER[nv];
    for (let s = 1; s <= 200; s++) {
      const palet = paletter[s % paletter.length], t = F.lavTaarn(nv, palet, rnd(s * 31 + nv));
      const k = t.klodser, hoved = k.filter(x => x.soejle === 0), side = k.filter(x => x.soejle === 1);
      const brugbar = palet.filter(f => ALLE.includes(f)), forvent = brugbar.length ? brugbar : D.STANDARD_FARVER;
      if (k.length !== n.antal || side.length !== n.side) fejl.push(nv + ': antal ' + k.length + '/' + side.length);
      if (!k.every(x => forvent.includes(x.farve))) fejl.push(nv + ': farve uden for paletten');
      if (n.kerne && forvent.filter(f => KERNE.includes(f)).length >= 2 && !k.every(x => KERNE.includes(x.farve)))
        fejl.push(nv + ': niveau 1 uden kernefarver');
      for (const soejle of [hoved, side])
        for (let i = 1; i < soejle.length; i++)
          if (forvent.length > 1 && soejle[i].farve === soejle[i - 1].farve) fejl.push(nv + ': to ens oven på hinanden');
      if (!n.smaa && k.some(x => x.str !== '2x4')) fejl.push(nv + ': 2×2 for tidligt');
      if (n.smaa && !k.some(x => x.str === '2x2')) fejl.push(nv + ': ingen 2×2');
      if (n.side && k.some(x => x.z === 0 && x.str !== '2x4')) fejl.push(nv + ': bunden er ikke 2×4 ved to søjler');
      if (!k.every((x, i) => x.z === (x.soejle === 0 ? i : i - hoved.length))) fejl.push(nv + ': z passer ikke');
    }
  }
  tjek('lavTaarn: 2.000 tårne følger niveautabellen, paletten og «aldrig to ens oven på hinanden»',
       fejl.length === 0, fejl.slice(0, 4).join('; '));
  const t = F.lavTaarn('x', null, rnd(1));
  tjek('lavTaarn med ugyldigt niveau og ingen farver giver et niveau 1-tårn i standardfarver',
       t.niveau === 1 && t.klodser.length === 2 && t.klodser.every(x => D.STANDARD_FARVER.includes(x.farve)));
}

/* ── TJEK-SPØRGSMÅLET ───────────────────────────────────────────────────── */
{
  const fejl = [], typer = {};
  for (let s = 1; s <= 1500; s++) {
    const nv = 2 + (s % 9), palet = s % 4 === 0 ? ['gul'] : (s % 4 === 1 ? ALLE : D.STANDARD_FARVER);
    const r = rnd(s), t = F.lavTaarn(nv, palet, r), q = F.tjekSpoergsmaal(t, palet, r);
    typer[q.type] = (typer[q.type] || 0) + 1;
    const hoved = t.klodser.filter(x => x.soejle === 0);
    if (q.valg.length !== 3 || new Set(q.valg).size !== 3) fejl.push('ikke tre forskellige valg: ' + q.valg);
    if (!q.valg.includes(q.svar)) fejl.push('svaret mangler blandt valgene');
    if (q.type === 'nederst' && (q.svar !== hoved[0].farve || q.klods !== t.klodser.indexOf(hoved[0]))) fejl.push('nederst forkert');
    if (q.type === 'oeverst' && (q.svar !== hoved[hoved.length - 1].farve || q.klods !== t.klodser.indexOf(hoved[hoved.length - 1])))
      fejl.push('øverst forkert');
    if (q.type === 'antal' && (q.svar !== t.klodser.length || !q.valg.every(v => v >= 1) ||
                               q.valg.join() !== q.valg.slice().sort((a, b) => a - b).join())) fejl.push('antal forkert: ' + q.valg);
    if (q.type !== 'antal' && !q.valg.every(v => ALLE.includes(v))) fejl.push('ukendt farve blandt valgene');
  }
  tjek('tjekSpoergsmaal: tre forskellige valg med det rigtige svar, også med én farve i paletten',
       fejl.length === 0, fejl.slice(0, 3).join('; '));
  tjek('alle tre slags spørgsmål stilles', ['nederst', 'oeverst', 'antal'].every(x => typer[x] > 300), JSON.stringify(typer));
  const t2 = { klodser: [{ soejle: 0, z: 0, str: '2x4', farve: 'roed' }, { soejle: 0, z: 1, str: '2x4', farve: 'blaa' }] };
  const fra = [];
  for (let s = 1; s <= 60; s++) { const q = F.tjekSpoergsmaal(t2, ['roed', 'blaa'], rnd(s)); if (q.type === 'antal') fra.push(q.valg.join()); }
  tjek('antal med 2 klodser: ingen 0 eller negative tal', fra.length > 0 && fra.every(v => !/(^|,)(0|-)/.test(v)), fra[0]);
}
{
  // «Nederst» med to søjler (niveau 6-10): sidesøjlens bundklods står også nederst, så ingen bundfarve
  // må være et af de forkerte valg — ellers er et «forkert» svar også rigtigt
  let nederst = 0;
  const fejl = [];
  for (let s = 1; s <= 3000; s++) {
    const nv = 6 + (s % 5), palet = [D.STANDARD_FARVER, ALLE, ['roed', 'blaa', 'gul']][s % 3], r = rnd(s * 7 + 3);
    const t = F.lavTaarn(nv, palet, r), q = F.tjekSpoergsmaal(t, palet, r);
    if (q.type !== 'nederst') continue;
    nederst++;
    const bund = t.klodser.filter(k => k.z === 0).map(k => k.farve);
    if (q.valg.some(v => v !== q.svar && bund.includes(v)) || q.valg.length !== 3 || new Set(q.valg).size !== 3)
      fejl.push('niveau ' + nv + ': ' + q.valg.join() + ' (bund ' + bund.join() + ')');
  }
  tjek('«nederst» på niveau 6-10: ingen af søjlernes bundfarver er et forkert valg',
       nederst > 500 && fejl.length === 0, fejl.length + ' af ' + nederst + (fejl.length ? ', fx ' + fejl[0] : ''));
}

/* ── NIVEAU ─────────────────────────────────────────────────────────────── */
{
  const kør = (start, liste) => liste.reduce((s, r) => F.naesteNiveau(s, r), { niveau: start, op: 0, ned: 0 }).niveau;
  tjek('to klarede i træk: niveau op', kør(3, ['klaret', 'klaret']) === 4);
  tjek('én klaret: niveauet står', kør(3, ['klaret']) === 3);
  tjek('to «Næsten» i træk: niveau ned', kør(3, ['naesten', 'naesten']) === 2);
  tjek('klaret, næsten, klaret: niveauet står', kør(3, ['klaret', 'naesten', 'klaret']) === 3);
  tjek('klaret, andet, klaret: rækken brydes', kør(3, ['klaret', 'andet', 'klaret']) === 3);
  tjek('grænserne 1 og 10 holder', kør(10, ['klaret', 'klaret', 'klaret', 'klaret']) === 10 &&
       kør(1, ['naesten', 'naesten', 'naesten', 'naesten']) === 1);
}

/* ── HUSKEKLODSEN: SKÆRMENE ─────────────────────────────────────────────── */
function runde(t, r, valg) {
  // valg: { kig, svar: 'rigtigt'|'forkert'|'spring', slut: 'ja'|'naesten' }
  F.huskTrin(t, 'start', r); F.huskTrin(t, 'vist', r);
  if (valg.kig) { F.huskTrin(t, 'kig', r); F.huskTrin(t, 'vist', r); }
  F.huskTrin(t, 'faerdig', r);
  if (t.skaerm === 'spoerg') {
    if (valg.svar === 'spring') F.huskTrin(t, 'spring', r);
    else {
      const i = t.spm.valg.indexOf(t.spm.svar);
      F.huskTrin(t, valg.svar === 'rigtigt' ? i : (i + 1) % 3, r);
      F.huskTrin(t, 'videre', r);
    }
  }
  F.huskTrin(t, valg.slut, r);
  return t;
}
{
  const r = rnd(5), t = F.nyHusk(F.laesSpil(null), r);
  const skaerme = [t.skaerm];
  for (const h of ['start', 'vist', 'faerdig']) { F.huskTrin(t, h, r); skaerme.push(t.skaerm); }
  tjek('niveau 1: start → vis → byg → facit uden spørgsmål', skaerme.join() === 'start,vis,byg,facit' && t.spm === null,
       skaerme.join());
  F.huskTrin(t, 'ja', r);
  tjek('«Ja» giver sticker og tæller runden, men ingen stjerne uden spørgsmål',
       t.data.husk.stickers === 1 && t.data.husk.spillet === 1 && t.data.husk.stjerner === 0 && t.belonning.stjerne === false &&
       t.data.husk.rekord === 1 && t.belonning.rekord === true, JSON.stringify(t.data.husk));
  F.huskTrin(t, 'ja', r);
  tjek('«Ja» to gange tæller kun én sticker', t.data.husk.stickers === 1);
  F.huskTrin(t, 'videre', r);
  tjek('▶ efter facit giver en ny runde', t.skaerm === 'start' && t.svar === null && t.runder === 1);
}
{
  // Tryk, der ikke passer til skærmen, ændrer intet
  const r = rnd(9), t = F.nyHusk(F.laesSpil('{"husk":{"niveau":4}}'), r);
  const foto = () => JSON.stringify([t.skaerm, t.valgt, t.svar, t.kigget, t.data]);
  const ugyldige = { start: ['vist', 'faerdig', 'ja', 0, 'videre'], vis: ['start', 'faerdig', 'ja', 1, 'kig'],
                     byg: ['start', 'vist', 'ja', 2, 'videre'], spoerg: ['ja', 'naesten', 'videre', 5, -1, 'faerdig'] };
  const fejl = [];
  for (const [skaerm, frem] of [['start', 'start'], ['vis', 'vist'], ['byg', 'faerdig'], ['spoerg', null]]) {
    if (t.skaerm !== skaerm) { fejl.push('nåede ikke ' + skaerm); break; }
    for (const h of ugyldige[skaerm]) { const f = foto(); F.huskTrin(t, h, r); if (foto() !== f) fejl.push(skaerm + '+' + h); }
    if (frem) F.huskTrin(t, frem, r);
  }
  F.huskTrin(t, 0, r);
  const f = foto(); F.huskTrin(t, 1, r); F.huskTrin(t, 'spring', r);
  if (foto() !== f) fejl.push('andet svar eller ⏭ efter svar');
  F.huskTrin(t, 'videre', r);
  const g = foto(); F.huskTrin(t, 'videre', r); if (foto() !== g) fejl.push('▶ på facit før Ja/Næsten');
  tjek('ugyldige tryk ændrer intet (✅ under visningen, Ja under byggeriet, to svar …)', fejl.length === 0, fejl.join(', '));
}
{
  const r = rnd(11);
  let t = runde(F.nyHusk(F.laesSpil('{"husk":{"niveau":3}}'), r), r, { svar: 'rigtigt', slut: 'ja' });
  tjek('rigtigt svar uden at kigge: stjerne', t.data.husk.stjerner === 1 && t.belonning.stjerne === true);
  t = runde(F.nyHusk(F.laesSpil('{"husk":{"niveau":3}}'), r), r, { kig: true, svar: 'rigtigt', slut: 'ja' });
  tjek('kigget igen: sticker, men ingen stjerne og ingen rekord',
       t.data.husk.stickers === 1 && t.data.husk.stjerner === 0 && t.data.husk.rekord === 0, JSON.stringify(t.data.husk));
  t = runde(F.nyHusk(F.laesSpil('{"husk":{"niveau":3}}'), r), r, { svar: 'forkert', slut: 'ja' });
  tjek('forkert svar: sticker, ingen stjerne', t.data.husk.stickers === 1 && t.data.husk.stjerner === 0 && t.valgt >= 0);
  t = runde(F.nyHusk(F.laesSpil('{"husk":{"niveau":3}}'), r), r, { svar: 'spring', slut: 'naesten' });
  tjek('⏭ og «Næsten»: sticker, ingen stjerne', t.data.husk.stickers === 1 && t.data.husk.stjerner === 0 && t.valgt === -1);
}
{
  // Niveauet følger med: to klarede op, to «Næsten» ned; 6 runder og så pause
  const r = rnd(13), t = F.nyHusk(F.laesSpil('{"husk":{"niveau":5,"rekord":2}}'), r);
  const niveauer = [];
  const plan = [{ svar: 'rigtigt', slut: 'ja' }, { svar: 'rigtigt', slut: 'ja' }, { svar: 'rigtigt', slut: 'naesten' },
                { svar: 'rigtigt', slut: 'naesten' }, { svar: 'rigtigt', slut: 'ja' }, { svar: 'spring', slut: 'ja' }];
  for (const p of plan) {
    runde(t, r, p);
    niveauer.push(t.data.husk.niveau);
    F.huskTrin(t, 'videre', r);
  }
  tjek('niveau 5 → 6 efter to klarede, → 5 efter to «Næsten»; tårnet følger niveauet',
       niveauer.join() === '5,6,6,5,5,5', niveauer.join());
  tjek('rekord = højeste klarede niveau (5: på niveau 6 blev det «Næsten»)', t.data.husk.rekord === 5,
       String(t.data.husk.rekord));
  tjek('efter 6 runder: pause, og intet tryk starter en ny runde',
       t.skaerm === 'pause' && t.data.husk.spillet === 6 && t.data.husk.stickers === 6 &&
       F.huskTrin(t, 'start', r).skaerm === 'pause', t.skaerm + ' ' + t.data.husk.spillet);
}

/* ── LYDINDEKSET ────────────────────────────────────────────────────────── */
{
  const ix = F.laesIndeks({
    faelles: { fil: 'tale/faelles-0123abcd.mp3', klip: { 'ros-1': [0, 900], 'ros-2': [-1, 500], 'ros-3': [100, 0],
                                                       'ros-4': [100, 90000], 'ROS': [0, 100], 'ros-5': ['0', 100] } },
    husk: { fil: '../hemmelig.mp3', klip: { se: [0, 1000] } },
    byg: { fil: 'https://ond.example/byg-0123abcd.mp3', klip: {} },
    __proto__: { fil: 'tale/x-0123abcd.mp3', klip: {} },
    spejl: 'tekst'
  });
  tjek('laesIndeks: kun gyldige sprites og klip', Object.keys(ix).join() === 'faelles' &&
       Object.keys(ix.faelles.klip).join() === 'ros-1', JSON.stringify(ix));
  const k = F.klipTid(ix, 'faelles.ros-1');
  tjek('klipTid giver sekunder', k && k.sprite === 'faelles' && k.start === 0 && k.laengde === 0.9, JSON.stringify(k));
  tjek('klipTid uden klip giver null (stille)',
       F.klipTid(ix, 'husk.se') === null && F.klipTid({}, 'faelles.ros-1') === null && F.klipTid(ix, 'faelles') === null &&
       F.klipTid(ix, 'faelles.constructor') === null && F.klipTid(ix, '__proto__.x') === null);
  tjek('laesIndeks af ikke-objekter giver et tomt indeks',
       [null, 'x', [], 3].every(v => Object.keys(F.laesIndeks(v)).length === 0));
}

/* ── TEGNEREN ───────────────────────────────────────────────────────────── */
{
  const t = F.lavTaarn(8, ALLE, rnd(3));
  const svg = F.tegnIso(t.klodser, { titel: 'Tårn <"&>' });
  const grupper = (svg.match(/<g data-k="/g) || []).length;
  const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number);
  tjek('tegnIso: én gruppe pr. klods og et endeligt viewBox', grupper === t.klodser.length && vb.length === 4 &&
       vb.every(Number.isFinite) && vb[2] >= 9 && vb[3] >= 12, grupper + ' grupper, viewBox ' + vb.join(' '));
  tjek('tegnIso: titlen escapes', svg.includes('aria-label="Tårn &lt;&quot;&amp;&gt;"') && !svg.includes('<"&>'));
  const fyld = svg.match(/fill="#[0-9a-f]{6}"/g) || [];
  tjek('tegnIso: farvede flader har deres eget fill', fyld.length >= t.klodser.length * 3, fyld.length + ' fill');
  const sil = F.tegnIso(t.klodser, { silhuet: true, spm: 0 });
  tjek('silhuet: ingen klodsfarver, «?» på den spurgte klods',
       !/fill="#/.test(sil) && (sil.match(/class="iso-mrk top"/g) || []).length === 1 && />\?<\/text>/.test(sil));
  const hoej = F.tegnIso(F.lavTaarn(5, ALLE, rnd(4)).klodser, {}), lav = F.tegnIso(F.lavTaarn(1, ALLE, rnd(4)).klodser, {});
  const h = s => +/viewBox="[^"]+"/.exec(s)[0].split(' ')[3].replace('"', '');
  tjek('lave tårne får samme mindste billede (klodserne er lige store på niveau 1)', h(lav) === 12 && h(hoej) >= 12,
       h(lav) + ' / ' + h(hoej));
}

/* ── STEMMEN: 🔊 KUN NÅR ET TRYK GIVER LYD ──────────────────────────────── */
const asynk = [];
{
  const ixData = { faelles: { fil: 'tale/faelles-0123abcd.mp3', klip: { 'ros-1': [0, 900] } } };
  const lydCtx = { state: 'running' };
  const tilfaelde = [
    ['klip + WebAudio', 200, true, lydCtx, true],
    ['ingen WebAudio', 200, true, null, false],
    ['lyd slået fra', 200, false, lydCtx, false],
    ['ingen klip (404)', 404, true, lydCtx, false],
  ];
  asynk.push(Promise.all(tilfaelde.map(([navn, status, taendt, c, forventet]) => {
    F.ctx.fetch = () => Promise.resolve({ ok: status === 200, status, json: () => Promise.resolve(ixData) });
    const tale = F.lavTale({ lydTaendt: () => taendt, hentLydCtx: () => c });
    return tale.hentIndeks().then(() => [navn, tale.harLyd(), forventet]);
  })).then(r => tjek('harLyd: 🔊 kun med klip, lyd tændt og WebAudio', r.every(x => x[1] === x[2]),
                     r.map(x => x[0] + '=' + x[1]).join(', '))));
}

Promise.all(asynk).catch(e => tjek('stemmens tests kørte uden undtagelse', false, String(e))).then(() => {
  console.log('');
  for (const [st, n, det] of resultater) console.log(st, n, det ? '(' + det + ')' : '');
  const fejl = resultater.filter(x => x[0] === 'FEJL').length;
  console.log('\n' + (resultater.length - fejl) + '/' + resultater.length + ' tests bestået');
  process.exit(fejl ? 1 : 0);
});

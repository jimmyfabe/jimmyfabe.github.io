/* ==========================================================================
   spil.js — Klodsespillene i 🎮 Spil. Fase 1: fundamentet og Huskeklodsen
   («Dino-tårnet» hos Alma, «Prinsessetårnet» hos Ella).

   Appen er spilleder, ikke legetøj: barnet bygger med rigtige klodser, og
   appen viser, gemmer, spørger og roser. Fejl straffes aldrig, og der er
   ingen nedtælling — kun visningstiden, før tårnet gemmes, er tid.

   app.js kalder window.KLODSESPIL.lav(api) og får overlayet tilbage. De rene
   funktioner øverst (data, tårn, spørgsmål, niveau, tilstande, lydindeks og
   tegner) testes i test/test-spil.js; DOM-delen ligger i lav().
   Farvenavne står i spil-data.js, aldrig her.
   ========================================================================== */
(function () {
'use strict';

var D = window.SPILDATA;
if (!D) return;          /* uden data intet spil — app.js viser så ingen spil-klods */

/* ── DATA: <id>_spil_v1 ────────────────────────────────────────────────────
   Spillenes egen nøgle i localStorage. Samlingen (<id>_samling_v1) røres
   ALDRIG herfra. laesSpil er ren og kaster aldrig: manglende eller ødelagte
   værdier bliver til standarder, ukendte felter (fra en nyere udgave)
   bevares, og v er til fremtidige migreringer. Kun tællere — ingen navne,
   tider eller persondata.                                                  */
var SPIL_V = 1;
var MAKS_TEGN = 100000;                  /* en rigtig værdi fylder under 1 kB */
var FORBUDTE = ['__proto__', 'constructor', 'prototype'];

function spilNoegle(id) { return id + '_spil_v1'; }

function tal(v, min, max, std) {
  if (typeof v !== 'number' || !isFinite(v)) return std;
  return Math.min(max, Math.max(min, Math.floor(v)));
}
function erObjekt(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
function farveIder() { return D.FARVER.map(function (f) { return f.id; }); }

function standardSpil() {
  return {
    v: SPIL_V,
    farver: D.STANDARD_FARVER.slice(),   /* det, I har — far vælger i «Til far» (fase 2) */
    plade: false,
    husk: { niveau: 1, rekord: 0, spillet: 0, stickers: 0, stjerner: 0 }
  };
}

/* Felter, vi ikke kender, kopieres med, så en ældre udgave ikke sletter dem */
function bevarUkendte(fra, til) {
  Object.keys(fra).forEach(function (k) {
    if (FORBUDTE.indexOf(k) === -1 && !Object.prototype.hasOwnProperty.call(til, k)) til[k] = fra[k];
  });
}

function laesSpil(raa) {
  try {
    var ud = standardSpil();
    if (typeof raa !== 'string' || raa.length > MAKS_TEGN) return ud;
    var d = JSON.parse(raa);
    if (!erObjekt(d)) return ud;
    ud.v = tal(d.v, 1, 1000, SPIL_V);
    if (Array.isArray(d.farver)) {
      var kendte = farveIder(), valgte = [];
      d.farver.forEach(function (f) {
        if (kendte.indexOf(f) !== -1 && valgte.indexOf(f) === -1) valgte.push(f);
      });
      if (valgte.length) ud.farver = valgte;
    }
    if (typeof d.plade === 'boolean') ud.plade = d.plade;
    if (erObjekt(d.husk)) {
      var h = d.husk;
      ud.husk.niveau = tal(h.niveau, 1, 10, 1);
      ud.husk.rekord = tal(h.rekord, 0, 10, 0);
      ud.husk.spillet = tal(h.spillet, 0, 1e6, 0);
      ud.husk.stickers = tal(h.stickers, 0, 1e6, 0);
      ud.husk.stjerner = tal(h.stjerner, 0, 1e6, 0);
      bevarUkendte(h, ud.husk);
    }
    bevarUkendte(d, ud);
    return ud;
  } catch (e) {
    return standardSpil();
  }
}

/* localStorage kan selv kaste (privat tilstand, fuld kvote) — så er det
   standarderne, og spillet kører videre uden at gemme */
function hentSpil(lager, noegle) {
  var raa = null;
  try { raa = lager ? lager.getItem(noegle) : null; } catch (e) { raa = null; }
  return laesSpil(raa);
}
/* Returnerer true, hvis det lykkedes. Læser aldrig forfra (hård læring 13). */
function skrivSpil(lager, noegle, data) {
  try { lager.setItem(noegle, JSON.stringify(data)); return true; } catch (e) { return false; }
}

/* ── TÅRNET ────────────────────────────────────────────────────────────────
   Niveau 1-10. antal = klodser i alt, side = klodser i en søjle ved siden af
   bunden, smaa = 2×2 blandes ind, kerne = kun de seks farver, stemmen kan
   sige. Farverne er pigens egne (data.farver) — aldrig temafarver.          */
var NIVEAUER = [
  null,
  { antal: 2, side: 0, smaa: false, kerne: true },
  { antal: 3, side: 0, smaa: false },
  { antal: 4, side: 0, smaa: false },
  { antal: 5, side: 0, smaa: false },
  { antal: 6, side: 0, smaa: true },
  { antal: 6, side: 1, smaa: true },
  { antal: 6, side: 1, smaa: true },
  { antal: 7, side: 1, smaa: true },
  { antal: 7, side: 2, smaa: true },
  { antal: 8, side: 2, smaa: true }
];
/* Søjlernes midte på x-aksen, målt i knopper: hovedsøjlen og sidesøjlen.
   En 2×4 i hovedsøjlen går fra 0 til 4, sidesøjlens fra 4 til 8 — de rører. */
var MIDTE = [2, 6];

function erKerne(id) {
  return D.FARVER.some(function (f) { return f.id === id && f.kerne; });
}
function vaelg(liste, rnd) { return liste[Math.floor(rnd() * liste.length) % liste.length]; }
function blandet(liste, rnd) {
  var a = liste.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rnd() * (i + 1)) % (i + 1), x = a[i];
    a[i] = a[j]; a[j] = x;
  }
  return a;
}

function lavTaarn(niveau, farver, rnd) {
  var nv = tal(niveau, 1, 10, 1), n = NIVEAUER[nv];
  var kendte = farveIder();
  var palet = (farver || []).filter(function (f) { return kendte.indexOf(f) !== -1; });
  if (!palet.length) palet = D.STANDARD_FARVER.slice();
  if (n.kerne) {
    var kerne = palet.filter(erKerne);
    if (kerne.length >= 2) palet = kerne;
  }
  var klodser = [];
  function soejle(nr, hoejde) {
    var forrige = null;
    for (var z = 0; z < hoejde; z++) {
      /* to ens farver oven på hinanden kan ikke skelnes på tegningen */
      var mulige = palet.filter(function (f) { return f !== forrige; });
      forrige = vaelg(mulige.length ? mulige : palet, rnd);
      klodser.push({ soejle: nr, z: z, str: '2x4', farve: forrige });
    }
  }
  soejle(0, n.antal - n.side);
  soejle(1, n.side);
  if (n.smaa) {
    /* Står der en søjle ved siden af, er begge bunde 2×4, så søjlerne rører
       hinanden, som «ved siden af» lover. Mindst én 2×2 pr. tårn. */
    var kan = klodser.filter(function (k) { return !(n.side && k.z === 0); });
    kan.forEach(function (k) { if (rnd() < 1 / 3) k.str = '2x2'; });
    if (!kan.some(function (k) { return k.str === '2x2'; })) vaelg(kan, rnd).str = '2x2';
  }
  return { niveau: nv, klodser: klodser };
}

/* ── TJEK-SPØRGSMÅLET ──────────────────────────────────────────────────────
   Ét spørgsmål efter byggeriet, som appen kan rette: farven nederst eller
   øverst i hovedsøjlen, eller hvor mange klodser der var. Tre forskellige
   valg, og det rigtige er altid med. Stilles fra niveau 2.                  */
var SPM_TYPER = ['nederst', 'oeverst', 'antal'];

function tjekSpoergsmaal(taarn, farver, rnd) {
  var type = vaelg(SPM_TYPER, rnd);
  if (type === 'antal') {
    var n = taarn.klodser.length;
    var andre = blandet([n - 2, n - 1, n + 1, n + 2].filter(function (x) { return x >= 1; }), rnd).slice(0, 2);
    return { type: type, svar: n, klods: -1,
             valg: andre.concat(n).sort(function (a, b) { return a - b; }) };
  }
  var hoved = taarn.klodser.filter(function (k) { return k.soejle === 0; });
  var k = type === 'nederst' ? hoved[0] : hoved[hoved.length - 1];
  /* «Nederst»: sidesøjlens bundklods står også nederst, så ingen bundfarve må være et forkert valg */
  var udeladt = type === 'nederst' ? taarn.klodser.filter(function (x) { return x.z === 0; })
                                                  .map(function (x) { return x.farve; }) : [k.farve];
  /* De to forkerte valg tages helst fra pigens egne farver, så standarderne, så alle */
  var kendte = farveIder(), forkerte = [];
  [farver || [], D.STANDARD_FARVER, kendte].forEach(function (kilde) {
    blandet(kilde, rnd).forEach(function (f) {
      if (forkerte.length < 2 && udeladt.indexOf(f) === -1 && forkerte.indexOf(f) === -1 && kendte.indexOf(f) !== -1) forkerte.push(f);
    });
  });
  return { type: type, svar: k.farve, klods: taarn.klodser.indexOf(k),
           valg: blandet(forkerte.concat(k.farve), rnd) };
}

/* ── NIVEAU ────────────────────────────────────────────────────────────────
   Op efter to klarede runder i træk, ned efter to «Næsten» i træk, altid
   mellem 1 og 10. Klaret = «Ja» uden at kigge, og spørgsmålet (hvis der var
   et) svaret rigtigt. Alt andet bryder rækken uden at flytte niveauet.
   Ingen låse og intet, der kan mistes.                                     */
function naesteNiveau(s, resultat) {
  var niveau = tal(s.niveau, 1, 10, 1), op = s.op || 0, ned = s.ned || 0, foer = niveau;
  if (resultat === 'klaret') { op++; ned = 0; }
  else if (resultat === 'naesten') { ned++; op = 0; }
  else { op = 0; ned = 0; }
  if (op >= 2) { niveau = Math.min(10, niveau + 1); op = 0; }
  if (ned >= 2) { niveau = Math.max(1, niveau - 1); ned = 0; }
  return { niveau: niveau, op: op, ned: ned, aendring: niveau - foer };
}

/* ── HUSKEKLODSEN: SKÆRMENE ────────────────────────────────────────────────
     start —▶→ vis —(tiden)→ byg —✅→ spoerg —(svar ▶ / ⏭)→ facit —(Ja/Næsten ▶)→ start …
                 ↑────👀─────┘      (niveau 1: byg → facit)         efter 6 runder: pause
   huskTrin er ren: den ændrer tilstanden og returnerer den. Et tryk, der
   ikke passer til skærmen (fx ✅ under visningen), ændrer intet.           */
var RUNDER_FOER_PAUSE = 6;

function nyRunde(t, rnd, aendring) {
  t.skaerm = 'start';
  t.taarn = lavTaarn(t.data.husk.niveau, t.data.farver, rnd);
  t.spm = null; t.valgt = null; t.kigget = false; t.svar = null; t.belonning = null;
  t.aendring = aendring;
  return t;
}
function nyHusk(data, rnd) {
  return nyRunde({ data: data, runder: 0, op: 0, ned: 0 }, rnd, 0);
}
function rigtigt(t) {
  return !!t.spm && typeof t.valgt === 'number' && t.valgt >= 0 && t.spm.valg[t.valgt] === t.spm.svar;
}

/* Sticker for at gøre det, stjerne for at svare rigtigt uden at kigge */
function afslutRunde(t, svar) {
  var h = t.data.husk;
  var klaret = svar === 'ja' && !t.kigget && (!t.spm || rigtigt(t));
  var stjerne = !t.kigget && rigtigt(t);
  var rekord = klaret && t.taarn.niveau > h.rekord;
  var nv = naesteNiveau({ niveau: t.taarn.niveau, op: t.op, ned: t.ned },
                        klaret ? 'klaret' : (svar === 'naesten' ? 'naesten' : 'andet'));
  t.svar = svar;
  h.spillet++;
  h.stickers++;
  if (stjerne) h.stjerner++;
  if (rekord) h.rekord = t.taarn.niveau;
  h.niveau = nv.niveau;
  t.op = nv.op; t.ned = nv.ned;
  t.runder++;
  t.belonning = { stjerne: stjerne, rekord: rekord, aendring: nv.aendring };
}

function huskTrin(t, h, rnd) {
  switch (t.skaerm) {
    case 'start':
      if (h === 'start') t.skaerm = 'vis';
      break;
    case 'vis':
      if (h === 'vist') t.skaerm = 'byg';
      break;
    case 'byg':
      if (h === 'kig') { t.kigget = true; t.skaerm = 'vis'; }
      else if (h === 'faerdig') {
        if (t.taarn.niveau >= 2) { t.spm = tjekSpoergsmaal(t.taarn, t.data.farver, rnd); t.skaerm = 'spoerg'; }
        else t.skaerm = 'facit';
      }
      break;
    case 'spoerg':
      if (t.valgt === null && typeof h === 'number' && h >= 0 && h < t.spm.valg.length) t.valgt = h;
      else if (t.valgt === null && h === 'spring') { t.valgt = -1; t.skaerm = 'facit'; }
      else if (t.valgt !== null && h === 'videre') t.skaerm = 'facit';
      break;
    case 'facit':
      if (t.svar === null && (h === 'ja' || h === 'naesten')) afslutRunde(t, h);
      else if (t.svar !== null && h === 'videre') {
        if (t.runder >= RUNDER_FOER_PAUSE) t.skaerm = 'pause';
        else nyRunde(t, rnd, t.belonning.aendring);
      }
      break;
  }
  return t;
}

/* ── TALE: INDEKSET ────────────────────────────────────────────────────────
   Røst-klip i få lydsprites (tale/<sprite>-<8 hex>.mp3) og et indeks
   tale/indeks.json: { sprite: { fil, klip: { noegle: [startMs, laengdeMs] } } }.
   Klippene laves i fase 0 og findes ikke endnu. Indtil da — og hvis indekset
   eller en sprite mangler, fx første besøg uden net — er spillet BEVIDST
   stumt, uden fejl. Alt kan spilles på billeder og symboler alene.
   Sætningerne står i vaerktoej/tale-saetninger.json.                       */
var SPRITE_FIL = /^tale\/[a-z]+-[0-9a-f]{8}\.mp3$/;

function laesIndeks(raa) {
  var ud = {};
  if (!erObjekt(raa)) return ud;
  Object.keys(raa).forEach(function (sprite) {
    var s = raa[sprite];
    if (!/^[a-z]+$/.test(sprite) || !erObjekt(s) || typeof s.fil !== 'string' ||
        !SPRITE_FIL.test(s.fil) || !erObjekt(s.klip)) return;
    var klip = {};
    Object.keys(s.klip).forEach(function (n) {
      var k = s.klip[n];
      if (/^[a-z0-9-]+$/.test(n) && Array.isArray(k) && k.length === 2 &&
          typeof k[0] === 'number' && typeof k[1] === 'number' &&
          isFinite(k[0]) && k[0] >= 0 && k[1] > 0 && k[1] <= 60000) klip[n] = [k[0], k[1]];
    });
    ud[sprite] = { fil: s.fil, klip: klip };
  });
  return ud;
}

/* 'husk.se' → sprite, start og længde i sekunder. null = intet klip. */
function klipTid(indeks, noegle) {
  var har = Object.prototype.hasOwnProperty;
  var dele = String(noegle).split('.');
  var s = dele.length === 2 && har.call(indeks, dele[0]) ? indeks[dele[0]] : null;
  var k = s && har.call(s.klip, dele[1]) ? s.klip[dele[1]] : null;
  return k ? { sprite: dele[0], start: k[0] / 1000, laengde: k[1] / 1000 } : null;
}

/* ── TEGNEREN: tårne set på skrå (isometrisk, 30°) ─────────────────────────
   Egen grafik: firkantede klodser med runde knopper — intet logo og ingen
   figurer. 1 enhed = afstanden mellem to knopper; en klods er 1,2 enheder
   høj (9,6 mm mod 8 mm). x går skråt ned mod højre, y skråt ned mod
   venstre, z op. Synlige flader: toppen, højre side (+x) og venstre (+y).
   Rækkefølgen: hovedsøjlen nedefra, så sidesøjlen nedefra. Sidesøjlen står
   altid foran (større x), så den tegnes sidst. Modeller med frie placeringer
   kræver en rigtig sortering (fase 3).                                     */
var ISO_C = 0.8660254, ISO_S = 0.5, KLODS_H = 1.2, KNOP_H = 0.22, KNOP_R = 0.3;
/* Fast mindste billede: niveau 1-4 tegnes lige store. Højere tårne (fra niveau 5) og sidesøjlen
   (fra 6) gør billedet større, så klodserne bliver mindre: på vis-skærmen 44 → 33 px høje på
   390×844 og 64 → 53 px på 1180×820. Et minimum på størrelse med det største tårn (13,1 × 14,5)
   ville give 33 px allerede på niveau 1 på iPhone. */
var MIN_B = 9, MIN_H = 12;

function iso(x, y, z) { return [ISO_C * (x - y), ISO_S * (x + y) - z]; }
function rund(v) { return Math.round(v * 1000) / 1000; }
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function klodsKasse(k) {
  var s = D.STOERRELSER[k.str] || D.STOERRELSER['2x4'];
  var x0 = MIDTE[k.soejle] - s.b / 2, y0 = 1 - s.l / 2, z0 = k.z * KLODS_H;
  return { x0: x0, x1: x0 + s.b, y0: y0, y1: y0 + s.l, z0: z0, z1: z0 + KLODS_H, b: s.b, l: s.l };
}

function farveAf(id) {
  return D.FARVER.filter(function (f) { return f.id === id; })[0] || D.FARVER[0];
}
/* '#RRGGBB' blandet med en anden farve; andel 0-1 af den anden */
function bland(rgb, med, andel) {
  var a = parseInt(rgb.slice(1), 16), b = parseInt(med.slice(1), 16), ud = '#';
  for (var i = 16; i >= 0; i -= 8) {
    var c = Math.round(((a >> i) & 255) * (1 - andel) + ((b >> i) & 255) * andel);
    ud += (c < 16 ? '0' : '') + c.toString(16);
  }
  return ud;
}
function kantAf(f) { return f.kant || bland(f.rgb, '#000000', 0.45); }

/* valg: { silhuet: true = grå omrids (start og spørgsmål), spm: indeks på
   klodsen med «?» (-1 = ingen), titel: tekst til skærmlæsere } */
function tegnIso(klodser, valg) {
  valg = valg || {};
  var dele = [], minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  function punkt(x, y, z) {
    var q = iso(x, y, z);
    minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
    minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
    return rund(q[0]) + ',' + rund(q[1]);
  }
  function flade(hjoerner, klasse, fyld, streg) {
    dele.push('<polygon class="' + klasse + '" points="' +
      hjoerner.map(function (p) { return punkt(p[0], p[1], p[2]); }).join(' ') + '"' +
      (fyld ? ' fill="' + fyld + '" stroke="' + streg + '"' : '') + '/>');
  }

  /* Underlaget: en flad plade under søjlerne */
  var xmax = 4;
  klodser.forEach(function (k) { xmax = Math.max(xmax, klodsKasse(k).x1); });
  var g = { x0: -1, x1: xmax + 1, y0: -1, y1: 3, z: -0.3 };
  flade([[g.x0, g.y0, 0], [g.x1, g.y0, 0], [g.x1, g.y1, 0], [g.x0, g.y1, 0]], 'iso-grund');
  flade([[g.x1, g.y0, 0], [g.x1, g.y1, 0], [g.x1, g.y1, g.z], [g.x1, g.y0, g.z]], 'iso-grund-side');
  flade([[g.x0, g.y1, 0], [g.x1, g.y1, 0], [g.x1, g.y1, g.z], [g.x0, g.y1, g.z]], 'iso-grund-side');

  var orden = klodser.map(function (k, i) { return { k: k, i: i }; })
    .sort(function (a, b) { return (a.k.soejle - b.k.soejle) || (a.k.z - b.k.z) || (a.i - b.i); });

  var mrk = null;
  orden.forEach(function (o) {
    var k = o.k, c = klodsKasse(k), f = farveAf(k.farve);
    var spm = o.i === valg.spm;
    var klasse = spm ? 'iso-mrk' : (valg.silhuet ? 'iso-sil' : 'iso-flade');
    var farvet = !valg.silhuet && !spm;
    var top = bland(f.rgb, '#FFFFFF', 0.2), venstre = bland(f.rgb, '#000000', 0.08),
        hoejre = bland(f.rgb, '#000000', 0.25), streg = kantAf(f);
    dele.push('<g data-k="' + o.i + '">');
    flade([[c.x0, c.y0, c.z1], [c.x1, c.y0, c.z1], [c.x1, c.y1, c.z1], [c.x0, c.y1, c.z1]],
          klasse + ' top', farvet && top, streg);
    flade([[c.x1, c.y0, c.z0], [c.x1, c.y1, c.z0], [c.x1, c.y1, c.z1], [c.x1, c.y0, c.z1]],
          klasse + ' hoejre', farvet && hoejre, streg);
    flade([[c.x0, c.y1, c.z0], [c.x1, c.y1, c.z0], [c.x1, c.y1, c.z1], [c.x0, c.y1, c.z1]],
          klasse + ' venstre', farvet && venstre, streg);
    /* Knopperne bagfra og frem (i + j stigende), så de forreste dækker */
    var knopper = [];
    for (var i = 0; i < c.b; i++) for (var j = 0; j < c.l; j++) knopper.push([i, j]);
    knopper.sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
    var rx = rund(KNOP_R * 1.2247), ry = rund(KNOP_R * 0.7071);
    knopper.forEach(function (p) {
      var bund = iso(c.x0 + p[0] + 0.5, c.y0 + p[1] + 0.5, c.z1);
      var cx = rund(bund[0]), by = rund(bund[1]), ty = rund(bund[1] - KNOP_H);
      minY = Math.min(minY, ty - ry);
      var side = farvet ? ' fill="' + hoejre + '"' : '', ovf = farvet ? ' fill="' + top + '" stroke="' + streg + '"' : '';
      dele.push('<ellipse class="' + klasse + ' knop" cx="' + cx + '" cy="' + by + '" rx="' + rx + '" ry="' + ry + '"' + side + '/>' +
                '<rect class="' + klasse + ' knop" x="' + rund(cx - rx) + '" y="' + ty + '" width="' + rund(2 * rx) + '" height="' + KNOP_H + '"' + side + '/>' +
                '<ellipse class="' + klasse + ' knop-top" cx="' + cx + '" cy="' + ty + '" rx="' + rx + '" ry="' + ry + '"' + ovf + '/>');
    });
    if (spm) {
      /* Spøgelsesklodsen får ét stiplet omrids om hele klodsen: stiplede kanter på hver flade
         ville ligge forskudt oven i hinanden, hvor fladerne mødes. Klodsen ovenover dækker toppen. */
      flade([[c.x0, c.y0, c.z1], [c.x1, c.y0, c.z1], [c.x1, c.y0, c.z0], [c.x1, c.y1, c.z0],
             [c.x0, c.y1, c.z0], [c.x0, c.y1, c.z1]], 'iso-mrk kant');
      mrk = iso((c.x0 + c.x1) / 2, c.y1, (c.z0 + c.z1) / 2);
    }
    dele.push('</g>');
  });
  /* Et stort «?» midt på klodsens forreste flade (venstre), som sidesøjlen aldrig dækker */
  if (mrk) {
    dele.push('<text class="iso-spm" x="' + rund(mrk[0]) + '" y="' + rund(mrk[1]) +
              '" font-size="1.6" text-anchor="middle" dominant-baseline="central">?</text>');
  }

  var luft = 0.5;
  var b = Math.max(maxX - minX + 2 * luft, MIN_B), h = Math.max(maxY - minY + 2 * luft, MIN_H);
  var vx = (minX + maxX) / 2 - b / 2, vy = maxY + luft - h;
  return '<svg class="iso" viewBox="' + [vx, vy, b, h].map(rund).join(' ') +
         '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(valg.titel || '') + '">' +
         dele.join('') + '</svg>';
}

/* ── TALE: AFSPILLEREN ─────────────────────────────────────────────────────
   fetch → decodeAudioData → et udsnit af spriten med AudioBufferSourceNode
   (samme vej som Lystårnet). Deler lydkontekst med appens klange. Siger
   aldrig to ting oven i hinanden og har ingen kø. Efter at appen har været i
   baggrunden, siges intet før næste tryk (laasOp kaldes i trykket).        */
function lavTale(api) {
  var indeks = null, indeksLoefte = null, buffere = {}, hentes = {};
  var kilde = null, sidste = null, laast = false, taleGen = 0;

  function ctx() { return api.lydTaendt() ? api.hentLydCtx() : null; }

  /* Skal kaldes INDE i en klik- eller tastehandler: iOS kræver et tryk */
  function laasOp() {
    laast = false;
    var c = ctx();
    if (c && c.state === 'suspended') {
      var p = c.resume();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function hentIndeks() {
    if (!indeksLoefte) {
      indeksLoefte = fetch('tale/indeks.json')
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (d) { indeks = laesIndeks(d); return indeks; })
        .catch(function () { indeks = {}; return indeks; });   /* stille resten af gangen; slip() giver et nyt forsøg */
    }
    return indeksLoefte;
  }

  function afkod(c, data) {
    return new Promise(function (ok, fejl) {
      var p = c.decodeAudioData(data, ok, fejl);      /* ældre Safari kender kun kaldtilbage-formen */
      if (p && p.then) p.then(ok, fejl);
    });
  }

  function hent(sprite) {
    /* Også en fejlet hentning (null) huskes, til spillet lukkes — ingen ny
       forespørgsel for hver sætning */
    if (Object.prototype.hasOwnProperty.call(buffere, sprite)) return Promise.resolve(buffere[sprite]);
    if (hentes[sprite]) return hentes[sprite];
    var c = ctx();
    if (!c) return Promise.resolve(null);
    var mit = hentes[sprite] = hentIndeks().then(function (ix) {
      var s = ix[sprite];
      if (!s) return null;
      return fetch(s.fil)
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
        .then(function (data) { return afkod(c, data); });
    }).catch(function () { return null; }).then(function (buf) {
      if (hentes[sprite] === mit) {          /* slip() undervejs → gem ikke */
        delete hentes[sprite];
        buffere[sprite] = buf;
      }
      return buf;
    });
    return mit;
  }

  function stop() {
    taleGen++;
    if (kilde) {
      try { kilde.onended = null; kilde.stop(); } catch (e) {}
      kilde = null;
    }
  }

  /* Siger ét klip og stopper først det, der tales. Løftet holder, til klippet
     er slut — eller straks, hvis der intet klip er. Hændelsen klodsespil:tale
     sendes altid, så en browserprøve kan tjekke dækningen uden at høre lyd. */
  function sig(noegle) {
    stop();
    sidste = noegle;
    var mit = taleGen;
    document.dispatchEvent(new CustomEvent('klodsespil:tale', { detail: noegle }));
    if (laast || !ctx()) return Promise.resolve(false);
    return Promise.all([hentIndeks(), hent(String(noegle).split('.')[0])]).then(function (r) {
      var tid = klipTid(r[0], noegle), buf = r[1], c = ctx();
      if (mit !== taleGen || laast || !tid || !buf || !c) return false;
      return new Promise(function (ok) {
        var s = c.createBufferSource();
        s.buffer = buf;
        s.connect(c.destination);
        s.onended = function () { if (kilde === s) kilde = null; ok(true); };
        kilde = s;
        s.start(0, tid.start, tid.laengde);
      });
    }).catch(function () { return false; });
  }

  /* Slipper den afkodede lyd (flere MB), når spillet lukkes. Manglede
     indekset, prøves det igen, næste gang spillet åbnes. */
  function slip() {
    stop(); buffere = {}; hentes = {};
    if (indeks && !Object.keys(indeks).length) { indeks = null; indeksLoefte = null; }
  }

  /* 🔊 vises kun, når et tryk faktisk giver lyd: klip, lyd tændt og WebAudio */
  function harLyd() { return !!indeks && Object.keys(indeks).length > 0 && !!ctx(); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); laast = true; }
  });

  return { laasOp: laasOp, hentIndeks: hentIndeks, hent: hent, sig: sig, stop: stop, slip: slip,
           harLyd: harLyd, sidste: function () { return sidste; } };
}

/* ── OVERLAYET ─────────────────────────────────────────────────────────────
   Spillet kører i fuld skærm oven på appen (som scanneren), så faner og
   sidebar er væk, mens der spilles. ✕ lukker altid straks — intet confirm().
   Topbar: ✕, maskot, titel, 🔊 (gentag; kun når der er klip). Scenen i
   midten. To knapper: A (den primære, 104 px på iPad) og B.               */
var ROS = ['faelles.ros-1', 'faelles.ros-2', 'faelles.ros-3', 'faelles.ros-4', 'faelles.ros-5'];
var SPM_TALE = { nederst: 'husk.sp-nederst', oeverst: 'husk.sp-oeverst', antal: 'husk.sp-antal' };

function lav(api) {
  var T = api.T, el = api.el;
  var noegle = spilNoegle(T.id);
  var tale = lavTale(api);
  var t = null;                /* Huskeklodsens tilstand, mens spillet er åbent */
  var gen = 0;                 /* tælles op ved hvert skærmskift og ved ✕ — gamle timere giver op (hård læring 14) */
  var roTil = 0;               /* knapperne hviler 450 ms efter hvert skærmskift: et dobbelttryk eller to hurtige
                                  Enter/Mellemrum må ikke trykke både ✅ Færdig og ⏭ Spring over (samme knap) */
  var springTil = 0;           /* … og ⏭ Spring over hviler 1500 ms: den sidder, hvor ✅ Færdig sad, og et barn,
                                  der trykker en gang mere (målt 578 ms efter), må ikke miste spørgsmålet */
  var aabner = null;           /* klodsen, der åbnede spillet: fokus tilbage dertil ved ✕ */
  var introSagt = false, gemFejlVist = false, gentagListe = [];

  function lager() { try { return window.localStorage; } catch (e) { return null; } }

  var o = el('div', 'spil-overlay'); o.id = 'spilOverlay';
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-modal', 'true');
  o.setAttribute('aria-labelledby', 'spilTitel');

  var top = el('div', 'spil-top');
  var lukKnap = el('button', 'spil-luk', '✕');
  lukKnap.type = 'button';
  lukKnap.setAttribute('aria-label', 'Luk spillet');
  lukKnap.addEventListener('click', luk);
  var maskot = el('span', 'spil-maskot', T.maskot);
  maskot.setAttribute('aria-hidden', 'true');
  var titel = el('h2', 'spil-titel'); titel.id = 'spilTitel';
  var sigKnap = el('button', 'spil-sig', '🔊');
  sigKnap.type = 'button';
  sigKnap.setAttribute('aria-label', 'Hør det igen');
  sigKnap.hidden = true;
  sigKnap.addEventListener('click', function () { sigRaekke(gentagListe); });
  top.appendChild(lukKnap); top.appendChild(maskot); top.appendChild(titel); top.appendChild(sigKnap);

  var scene = el('div', 'spil-scene');
  scene.tabIndex = -1;                       /* fokus her, når skærmen ingen knapper har */
  scene.setAttribute('aria-live', 'polite');

  var knapper = el('div', 'spil-knapper');
  var knapA = el('button', 'spil-knap primaer'), knapB = el('button', 'spil-knap sekundaer');
  [knapA, knapB].forEach(function (b) {
    b.type = 'button';
    b.hidden = true;
    b.addEventListener('click', function () {
      if (Date.now() >= (b.dataset.h === 'spring' ? springTil : roTil)) trin(b.dataset.h);
    });
    knapper.appendChild(b);
  });

  o.appendChild(top); o.appendChild(scene); o.appendChild(knapper);
  /* Hvert tryk i spillet låser lyden op (iOS) — også efter baggrunden */
  o.addEventListener('click', function () { tale.laasOp(); }, true);

  function erAaben() { return o.classList.contains('show'); }

  function knap(b, def) {
    b.hidden = !def;
    if (!def) { delete b.dataset.h; return; }
    b.textContent = '';
    b.appendChild(el('span', 'sk-ikon', def.ikon));
    if (def.ord) b.appendChild(el('span', 'sk-ord', def.ord));
    b.setAttribute('aria-label', def.label);
    b.dataset.h = def.h;
  }

  function sigRaekke(liste) {
    var mit = gen;
    return liste.filter(Boolean).reduce(function (p, n) {
      return p.then(function () { if (mit === gen) return tale.sig(n); });
    }, Promise.resolve());
  }
  function sigOgHusk(liste) {
    var gentag = liste.filter(function (n) { return n && n !== 'husk.gemmer' && n.indexOf('.intro-') === -1; });
    if (gentag.length) gentagListe = gentag;
    sigRaekke(liste);
  }

  function skaermTale() {
    switch (t.skaerm) {
      case 'start':
        var l = [];
        if (!introSagt && T.figur) { l.push('faelles.intro-' + T.figur); introSagt = true; }
        if (t.aendring > 0) l.push('husk.en-mere');
        l.push('husk.se');
        return l;
      case 'vis':    return t.kigget ? ['husk.se'] : [];
      case 'byg':    return ['husk.gemmer', 'husk.byg', 'faelles.faerdig-tryk'];
      case 'spoerg': return [SPM_TALE[t.spm.type]];
      case 'facit':  return ['husk.facit'];
      case 'pause':  return ['faelles.pause'];
    }
    return [];
  }

  function beskriv(silhuet) {
    var k = t.taarn.klodser;
    if (silhuet) return 'Tårn med ' + k.length + ' klodser';
    function navne(nr) {
      return k.filter(function (x) { return x.soejle === nr; })
              .map(function (x) { return farveAf(x.farve).navn; }).join(', ');
    }
    var side = navne(1);
    return 'Tårnet nedefra: ' + navne(0) + (side ? '. Ved siden af: ' + side : '');
  }

  function taarnBillede(silhuet, spm) {
    var d = el('div', 'spil-taarn');
    d.innerHTML = tegnIso(t.taarn.klodser, { silhuet: silhuet, spm: spm, titel: beskriv(silhuet) });
    return d;
  }

  /* Gardinet af temaets tegn (🌿/🍃 hos Alma, ✨/⭐ hos Ella) og et lille
     billedsprog uden ord: byg med klodserne, tryk så ✅ */
  function gardin(vaek) {
    var g = el('div', 'gardin' + (vaek ? ' vaek' : ''));
    g.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 120; i++) g.appendChild(el('span', 'g-tegn', T.dekor.tegn[i % T.dekor.tegn.length]));
    if (!vaek) {
      var hint = el('div', 'gardin-hint');
      hint.appendChild(el('span', null, '🧱'));
      hint.appendChild(el('span', 'gh-pil', '→'));
      hint.appendChild(el('span', null, '✅'));
      g.appendChild(hint);
    }
    return g;
  }

  function svarKnapper() {
    var spm = t.spm, svaret = t.valgt !== null;
    var raekke = el('div', 'spil-svar-raekke');
    spm.valg.forEach(function (v, i) {
      var b = el('button', 'spil-svar ' + (spm.type === 'antal' ? 'tal' : 'farve'));
      b.type = 'button';
      if (spm.type === 'antal') {
        b.appendChild(el('span', 'st-tal', String(v)));
        var prikker = el('span', 'st-prikker');
        for (var p = 0; p < v; p++) prikker.appendChild(el('i'));
        b.appendChild(prikker);
        b.setAttribute('aria-label', String(v));
      } else {
        var f = farveAf(v);
        b.style.backgroundColor = f.rgb;
        b.style.borderColor = kantAf(f);
        b.setAttribute('aria-label', f.navn);
      }
      if (svaret) {
        /* Rigtigt: ⭐ på den valgte. Forkert: den rigtige lyser stille op
           («Det var den her»), de andre trædes tilbage — ingen fejllyd. */
        b.disabled = true;
        b.classList.add(v === spm.svar ? 'rigtig' : 'ude');
        if (i === t.valgt && v === spm.svar && !t.kigget) b.appendChild(el('span', 'st-stjerne', '⭐'));
      } else {
        b.addEventListener('click', function () { trin(i); });
      }
      raekke.appendChild(b);
    });
    return raekke;
  }

  function sticker(stjerne) {
    var s = el('div', 'spil-sticker');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', stjerne ? 'Du fik en sticker og en stjerne' : 'Du fik en sticker');
    s.appendChild(el('span', 'st-motiv', T.maskot));
    if (stjerne) s.appendChild(el('span', 'st-motiv', '⭐'));
    return s;
  }

  function render() {
    gen++;
    roTil = Date.now() + 450;
    springTil = roTil + 1050;               /* 1500 ms efter skærmskiftet */
    var mit = gen, s = t.skaerm;
    scene.textContent = '';
    o.setAttribute('data-skaerm', s);
    o.classList.toggle('daempet', s === 'byg');
    knap(knapA, null); knap(knapB, null);
    sigKnap.hidden = !tale.harLyd();

    if (s === 'start') {
      scene.appendChild(taarnBillede(true, -1));
      var rek = t.data.husk.rekord;
      if (rek > 0) {
        var r = el('div', 'spil-rekord', new Array(rek + 1).join('⭐'));
        r.setAttribute('role', 'img');
        r.setAttribute('aria-label', 'Rekord: ' + rek);
        scene.appendChild(r);
      }
      knap(knapA, { ikon: '▶', label: 'Start', h: 'start' });
    } else if (s === 'vis') {
      /* Visningstiden er spillets eneste tid: 2 s + 1 s pr. klods, ingen knapper */
      scene.appendChild(taarnBillede(false, -1));
      setTimeout(function () { if (mit === gen && t && t.skaerm === 'vis') trin('vist'); },
                 2000 + 1000 * t.taarn.klodser.length);
    } else if (s === 'byg') {
      scene.appendChild(gardin(false));
      knap(knapA, { ikon: '✅', label: 'Færdig', h: 'faerdig' });
      knap(knapB, { ikon: '👀', label: 'Kig igen', h: 'kig' });
    } else if (s === 'spoerg') {
      if (t.spm.type === 'antal') {
        var a = el('div', 'spil-antal');
        a.setAttribute('aria-hidden', 'true');
        a.appendChild(el('span', null, '🧱'));
        a.appendChild(el('span', 'spm', '?'));
        scene.appendChild(a);
      } else {
        scene.appendChild(taarnBillede(true, t.spm.klods));
      }
      scene.appendChild(svarKnapper());
      knap(knapA, t.valgt === null ? { ikon: '⏭', label: 'Spring over', h: 'spring' }
                                   : { ikon: '▶', label: 'Videre', h: 'videre' });
    } else if (s === 'facit') {
      scene.appendChild(taarnBillede(false, -1));
      if (t.svar === null) {
        scene.appendChild(gardin(true));
        knap(knapA, { ikon: '✅', ord: 'Ja', label: 'Ja, det er ens', h: 'ja' });
        knap(knapB, { ikon: '🔁', ord: 'Næsten', label: 'Næsten', h: 'naesten' });
      } else {
        scene.appendChild(sticker(t.belonning.stjerne));
        knap(knapA, { ikon: '▶', label: 'Næste tårn', h: 'videre' });
      }
    } else if (s === 'pause') {
      /* Et skub mod kassen efter 6 runder — ingen lås, spillet kan åbnes igen */
      var pz = el('div', 'spil-pause');
      pz.setAttribute('aria-hidden', 'true');
      pz.appendChild(el('span', null, T.maskot));
      pz.appendChild(el('span', null, '🧱'));
      scene.appendChild(pz);
      knap(knapA, { ikon: '✅', label: 'Færdig for nu', h: 'videre' });
    }
    flytFokus();
  }

  /* Fokus bliver i spillet: på den primære knap, ellers på scenen */
  function flytFokus() {
    var a = document.activeElement;
    if (a && a !== scene && o.contains(a) && !a.hidden && !a.disabled) return;
    (knapA.hidden ? scene : knapA).focus({ preventScroll: true });
  }

  function gem() {
    if (skrivSpil(lager(), noegle, t.data) || gemFejlVist) return;
    gemFejlVist = true;                       /* én besked pr. gang spillet er åbent */
    api.visToast('😬 Kunne ikke gemme stickeren');
  }

  function trin(h) {
    if (!t) return;
    if (t.skaerm === 'pause') { if (h === 'videre') luk(); return; }
    var foer = { skaerm: t.skaerm, svar: t.svar, valgt: t.valgt };
    huskTrin(t, h, Math.random);
    if (t.skaerm === foer.skaerm && t.svar === foer.svar && t.valgt === foer.valgt) return;
    /* Kun to overgange får deres egen tale: et svar på spørgsmålet og Ja/Næsten
       på facit. Alt andet er et skærmskift og siger skærmens egen sætning. */
    var svarede = foer.skaerm === 'spoerg' && t.skaerm === 'spoerg' && foer.valgt === null && t.valgt !== null;
    var afsluttede = foer.skaerm === 'facit' && t.skaerm === 'facit' && foer.svar === null && t.svar !== null;
    var siges;
    if (svarede) {
      if (rigtigt(t)) {
        api.konfetti(); api.maskotGlad(maskot); api.klangFundet();
        siges = [vaelg(ROS, Math.random)];
      } else {
        siges = ['faelles.det-var-den'];
      }
    } else if (afsluttede) {
      gem();
      api.maskotGlad(maskot); api.klangGemt();
      if (t.belonning.rekord) api.konfetti();
      siges = ['faelles.sticker', t.belonning.stjerne && 'faelles.stjerne', t.belonning.rekord && 'husk.rekord'];
    } else {
      siges = skaermTale();
    }
    render();
    sigOgHusk(siges);
  }

  function aabn(id, fra, navn) {
    if (id !== 'husk' || erAaben()) return;
    tale.laasOp();
    aabner = fra || null;
    gemFejlVist = false;
    t = nyHusk(hentSpil(lager(), noegle), Math.random);
    titel.textContent = navn || '';
    o.classList.add('show');
    var app = document.querySelector('.app');
    if (app) app.setAttribute('inert', '');
    if (api.lydTaendt()) {
      tale.hentIndeks().then(function () {
        if (!t || !tale.harLyd()) return;
        sigKnap.hidden = false;
        tale.hent('faelles'); tale.hent('husk');      /* afkod mens barnet ser på skærmen */
      });
    }
    var siges = skaermTale();
    render();
    sigOgHusk(siges);
  }

  function luk() {
    if (!t) return;
    gen++;
    t = null;
    tale.slip();
    o.classList.remove('show', 'daempet');
    scene.textContent = '';
    knap(knapA, null); knap(knapB, null);
    var app = document.querySelector('.app');
    if (app) app.removeAttribute('inert');
    if (aabner && aabner.isConnected) aabner.focus({ preventScroll: true });
    aabner = null;
  }

  /* Tastaturcoveret: Mellemrum/Enter = den primære knap (står fokus på en
     knap, trykker browseren selv på den), Escape = ✕, → = ▶, 1-3 = svarene,
     r = 🔊. app.js' tastLyt sender hertil, mens spillet er åbent. */
  function tast(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    tale.laasOp();
    var paaKnap = !!(e.target && e.target.closest && e.target.closest('button')) && o.contains(e.target);
    if (e.key === 'Escape') { e.preventDefault(); luk(); }
    else if ((e.key === 'Enter' || e.key === ' ') && !paaKnap) {
      e.preventDefault();
      if (!knapA.hidden) knapA.click();
    } else if (e.key === 'ArrowRight' && !knapA.hidden && (knapA.dataset.h === 'start' || knapA.dataset.h === 'videre')) {
      e.preventDefault(); knapA.click();
    } else if (e.key >= '1' && e.key <= '3' && t && t.skaerm === 'spoerg') {
      e.preventDefault(); trin(+e.key - 1);
    } else if ((e.key === 'r' || e.key === 'R') && !sigKnap.hidden) {
      e.preventDefault(); sigRaekke(gentagListe);
    }
  }

  return { overlay: o, aabn: aabn, luk: luk, tast: tast, erAaben: erAaben };
}

window.KLODSESPIL = { lav: lav };
})();

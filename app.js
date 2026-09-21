/* ==========================================================================
   app.js — DELT logik for begge apps.
   Alt barne-specifikt (navn, maskot, farver, spil-kort, storage-nøgle)
   står i window.TEMA, som sættes i hver sin HTML-fil.
   ========================================================================== */
(function () {
'use strict';

var T = window.TEMA;
if (!T) { document.body.textContent = 'TEMA mangler'; return; }

/* ── SMÅ HJÆLPERE ──────────────────────────────────────────────────────── */
function el(tag, klasse, tekst) {
  var n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (tekst != null) n.textContent = tekst;
  return n;
}
function studs(antal) {
  var d = el('div', 'studs');
  for (var i = 0; i < (antal || 2); i++) d.appendChild(el('div', 'stud'));
  return d;
}
function $(id) { return document.getElementById(id); }

/* Begge kilder følger samme mønster for rent numeriske sætnumre, så vi
   behøver ikke gemme URL'en — kun nummer og variant.

   Brickset står FØRST, fordi Rebrickables billeder er vildt svingende i
   størrelse. Målt på 9 sæt (11.09.2026):

     Rebrickable  28 kB - 3.737 kB   i alt 7,6 MB
     Brickset     55 kB -   160 kB   i alt 0,8 MB

   Det er 9 gange mindre, og Brickset er forudsigelig. Med ti nye sæt i
   samlingen hentede vi før ~30 MB billeder til en iPad — og service
   workeren gemte dem oveni. Rebrickable beholdes som reserve, så vi
   ikke mister dækning. */
function billedeUrler(num, variant) {
  var v = variant || 1;
  return [
    'https://images.brickset.com/sets/images/' + num + '-' + v + '.jpg',
    'https://cdn.rebrickable.com/media/sets/' + num + '-' + v + '.jpg'
  ];
}
/* LEGO har to indgange, og ingen af dem er bedst i alle tilfælde:

   '/building-instructions/{num}'  går LIGE til download-siden med PDF'erne
       — ét tryk mindre. Men har LEGO ikke sættet, viser den en tom og
       forvirrende side: "| # | 0 dele, Årstal:".
   '/search-results?searchString={num}'  koster et ekstra tryk, men siger
       ærligt "Vi kunne ikke finde nogen resultater for 6339".

   Derfor: nyere sæt får den direkte vej, gamle får den ærlige søgeside.
   Årstallet bruges KUN til at vælge mellem de to — aldrig til at skjule
   linket, for LEGO's dækning kan ikke forudsiges ud fra årstal.
   Gætter vi forkert, er straffen mild: ét ekstra tryk, eller en tom side
   på et link der i forvejen er en fodnote. */
function legoUrl(num, aar) {
  if (aar && aar >= 2010) {
    return 'https://www.lego.com/da-dk/service/building-instructions/' + num;
  }
  return 'https://www.lego.com/da-dk/service/building-instructions/search-results?searchString=' + num + '&page=1';
}

/* brickinstructions ændrede adressestruktur: '/lego/bi/6339' giver nu 404.
   Den rigtige er '/lego_instructions/set/6339'. Sætnavnet må gerne stå
   bagefter, men det er valgfrit — nummeret alene er nok.
   Målt: den har ALLE testede sæt fra 1992 til 2025, hvor LEGO.com kun
   har de nye. Derfor er det DENNE der er den primære knap i appen. */
function brickUrl(num) {
  return 'https://lego.brickinstructions.com/lego_instructions/set/' + num;
}

/* Sætter et billede ind, og falder tilbage til en emoji hvis det ikke findes.
   Tælleren sikrer at et langsomt billede fra en TIDLIGERE søgning ikke
   pludselig dukker op oven på den nye — søger man hurtigt to gange,
   må kun det sidste billede få lov at vise sig. */
var billedeTael = 0;
function billedeI(beholder, num, variant, faldbackEmoji) {
  var mit = ++billedeTael;
  beholder.dataset.tael = mit;
  beholder.textContent = faldbackEmoji;
  if (!num) return;
  /* Prøv kilderne i rækkefølge. Fejler den første, tages den næste;
     fejler alle, bliver emoji'en stående. */
  var kilder = billedeUrler(num, variant);
  var img = new Image();
  img.alt = '';
  var i = 0;
  img.onload = function () {
    if (+beholder.dataset.tael !== mit) return;      /* forældet — drop det */
    beholder.textContent = '';
    beholder.appendChild(img);
  };
  img.onerror = function () {
    if (++i < kilder.length) img.src = kilder[i];    /* prøv næste kilde */
  };
  img.src = kilder[0];
}

/* ── SÆTDATABASE ───────────────────────────────────────────────────────────
   lego-saet.json er ~21.000 sæt: nummer -> [navn, år, variant?].
   Den hentes først når der faktisk søges, og service workeren cacher den,
   så den virker offline bagefter. Ingen API, ingen nøgle, intet der kan
   holde op med at svare.                                                   */
var DB = null, dbLoefte = null;
function hentDb() {
  if (DB) return Promise.resolve(DB);
  if (!dbLoefte) {
    dbLoefte = fetch('lego-saet.json')
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (d) { DB = d; return d; })
      .catch(function () { dbLoefte = null; return null; });   // tillad nyt forsøg
  }
  return dbLoefte;
}
function opslag(num) {
  var r = DB && DB[num];
  if (!r) return null;
  return { num: num, navn: r[0], aar: r[1] || 0, variant: r[2] || 1 };
}

/* ── OPBYG BRUGERFLADEN ────────────────────────────────────────────────── */
var SIDER = [
  { id: 'vejledning', ikon: '📦', navn: 'Byg',     titel: 'Find din byggevejledning 📦' },
  { id: 'spil',       ikon: '🎮', navn: 'Spil',    titel: 'Gratis LEGO Spil 🎮' },
  { id: 'samling',    ikon: '⭐', navn: 'Samling', titel: '⭐ Min Samling', badge: true }
];

function byg() {
  /* Baggrundsdekoration */
  var bg = el('div', 'bg');
  var lag = el('div', 'dekor-' + T.dekor.slags);
  lag.style.cssText = 'position:absolute;inset:0';
  T.dekor.tegn.forEach(function (t) { lag.appendChild(el('div', 'dekor', t)); });
  bg.appendChild(lag);
  document.body.appendChild(bg);

  var app = el('div', 'app');

  /* --- Sidebar --- */
  var side = el('aside', 'sidebar');

  var vel = el('div', 'welcome anim-' + T.maskotAnimation + (T.glimt ? ' glimt' : ''));
  vel.appendChild(el('span', 'mascot', T.maskot));
  vel.appendChild(el('h1', null, 'HEJ ' + T.navn + '!'));
  vel.appendChild(el('p', null, T.undertitel));
  side.appendChild(vel);

  SIDER.forEach(function (s, i) {
    var b = el('button', 'nav-btn' + (i === 0 ? ' active' : ''));
    b.dataset.side = s.id;
    b.appendChild(el('span', 'icon', s.ikon));
    b.appendChild(document.createTextNode(' ' + s.navn));
    if (s.badge) { var bd = el('span', 'badge', '0'); bd.id = 'samlingBadge'; b.appendChild(bd); }
    b.addEventListener('click', function () { visSide(s.id, b); });
    side.appendChild(b);
  });

  var bund = el('div', 'sidebar-bund');
  var login = el('button', 'login-btn');
  login.appendChild(document.createTextNode('🔑'));
  login.appendChild(el('span', 'lb-tekst', ' Log ind på LEGO'));
  login.addEventListener('click', function () { aabn('https://www.lego.com/da-dk/account/login'); });
  bund.appendChild(login);

  /* De to små voksen-knapper nederst */
  var smaa = el('div', 'bund-smaa');

  var opd = el('button', 'opdater-btn');
  opd.appendChild(document.createTextNode('🔄'));
  opd.appendChild(el('span', 'ob-tekst', ' Hent nyeste'));
  opd.title = 'Tjek om der er en ny version';
  opd.addEventListener('click', tvingOpdatering);
  smaa.appendChild(opd);

  var lyd = el('button', 'opdater-btn lyd-btn');
  lyd.title = 'Lyd til og fra';
  function visLyd() { lyd.textContent = lydTaendt() ? '🔊' : '🔇'; }
  visLyd();
  lyd.addEventListener('click', function () {
    saetLyd(!lydTaendt());
    visLyd();
    if (lydTaendt()) klangFundet();
  });
  smaa.appendChild(lyd);

  bund.appendChild(smaa);
  side.appendChild(bund);
  app.appendChild(side);

  /* --- Topbar --- */
  var top = el('header', 'topbar');
  top.appendChild(el('span', 'topbar-maskot', T.topIkon));
  var titel = el('span', 'page-title', SIDER[0].titel);
  titel.id = 'pageTitle';
  top.appendChild(titel);
  top.appendChild(el('span', 'offline-mrk', '📴 Ingen internet'));
  app.appendChild(top);

  /* --- Main --- */
  var main = el('main', 'main');

  /* Panel 1: vejledninger */
  var p1 = el('div', 'panel active');
  p1.id = 'panel-vejledning';
  p1.appendChild(bygSoegekort());
  p1.appendChild(bygBrikGitter(T.vejledningsKort));
  main.appendChild(p1);

  /* Panel 2: spil */
  var p2 = el('div', 'panel');
  p2.id = 'panel-spil';
  p2.appendChild(bygBrikGitter(T.spil));
  main.appendChild(p2);

  /* Panel 3: min samling */
  var p3 = el('div', 'panel');
  p3.id = 'panel-samling';
  p3.appendChild((function () { var d = el('div'); d.id = 'samlingIndhold'; return d; })());
  main.appendChild(p3);

  app.appendChild(main);
  document.body.appendChild(app);

  document.body.appendChild(bygScanner());
  document.body.appendChild(bygBekraeft());
  var t = el('div', 'toast'); t.id = 'toast';
  document.body.appendChild(t);
}

/* ── TALTASTATUR ───────────────────────────────────────────────────────────
   En 6-årig kan ikke skrive et 4-cifret tal på et tastatur uden hjælp,
   og iPad-tastaturet dækker desuden det halve af skærmen. Derfor er
   visningen et almindeligt felt UDEN input — tal indtastes med store
   klodser. Fysisk tastatur virker stadig (pigernes iPads sidder i
   tastaturcover), det håndteres af tastLyt() længere nede.            */
var nummer = '';

function visNummer() {
  var v = $('padVisning');
  if (!v) return;
  v.textContent = nummer || '';
  v.classList.toggle('tom', !nummer);
  v.parentNode.classList.toggle('udfyldt', !!nummer);
  var s = $('padSlet');
  if (s) s.disabled = !nummer;
}

/* Ændres tallet, hører det viste resultat til et andet sæt. Skjules det
   ikke, peger den store knap stadig på det gamle sæts vejledning. */
function tastTryk(ciffer) {
  if (nummer.length >= 7) return;
  nummer += ciffer;
  visNummer();
  skjulResultat();
}
function tastSlet() {
  nummer = nummer.slice(0, -1);
  visNummer();
  skjulResultat();
}
function tastRyd() {
  nummer = '';
  visNummer();
  skjulResultat();
}

function bygPad() {
  var side = el('div', 'pad-side');

  /* Visning */
  var vis = el('div', 'pad-visning');
  var v = el('div', 'pad-tal tom'); v.id = 'padVisning';
  vis.appendChild(v);
  var hint = el('div', 'pad-hint', 'Tryk tallene fra din æske');
  vis.appendChild(hint);
  side.appendChild(vis);

  /* Tasterne */
  var pad = el('div', 'pad');
  ['1','2','3','4','5','6','7','8','9'].forEach(function (c) {
    var b = el('button', 'pad-tast', c);
    b.addEventListener('click', function () { tastTryk(c); });
    pad.appendChild(b);
  });

  var slet = el('button', 'pad-tast pad-slet', '←');
  slet.id = 'padSlet';
  slet.setAttribute('aria-label', 'Slet et tal');
  slet.addEventListener('click', tastSlet);
  pad.appendChild(slet);

  var nul = el('button', 'pad-tast', '0');
  nul.addEventListener('click', function () { tastTryk('0'); });
  pad.appendChild(nul);

  var go = el('button', 'pad-tast pad-go', '🔎');
  go.setAttribute('aria-label', 'Find vejledningen');
  go.addEventListener('click', soeg);
  pad.appendChild(go);

  side.appendChild(pad);

  /* Kameraet under tastaturet.
     Der sad før en "🔍 Lens"-knap ved siden af. Den er fjernet 11.09.2026:
     den sendte kun til lens.google.com uden at vedhæfte et billede, så
     barnet landede på Googles cookie-samtykke-mur — og Safari kan
     alligevel ikke give Lens adgang til kameraet fra et link.
     Appen har sit eget kamera med OCR, så knappen var overflødig. */
  var ekstra = el('div', 'pad-ekstra');
  var scan = el('button', 'knap btn-scan', '📷 Scan æsken');
  scan.addEventListener('click', startScanner);
  ekstra.appendChild(scan);
  side.appendChild(ekstra);

  return side;
}

/* Fysisk tastatur — dad kan skrive direkte i tastaturcoveret */
function tastLyt() {
  document.addEventListener('keydown', function (e) {
    if ($('scannerOverlay').classList.contains('show')) return;
    if ($('bekraeft').classList.contains('show')) return;
    if (document.querySelector('.panel.active').id !== 'panel-vejledning') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;   /* ⌘1 osv. er systemets genveje, ikke tal */
    if (e.key >= '0' && e.key <= '9') { tastTryk(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { tastSlet(); e.preventDefault(); }
    else if (e.key === 'Enter') { soeg(); e.preventDefault(); }
    else if (e.key === 'Escape') { tastRyd(); }
  });
}

function bygSoegekort() {
  var omraade = el('div', 'soege-omraade');
  omraade.appendChild(bygPad());

  /* Højre side: resultatet, eller en venlig tom tilstand */
  var hoejre = el('div', 'result-side');

  var tom = el('div', 'result-tom'); tom.id = 'resultTom';
  tom.appendChild(el('div', 'rt-ikon', '🧱'));
  tom.appendChild(el('div', 'rt-tekst', 'Find tallet på din LEGO-æske'));
  tom.appendChild(el('div', 'rt-under', 'og tryk det ind med tallene ' + T.maskot));
  hoejre.appendChild(tom);

  var res = el('div', 'result-box'); res.id = 'setResult';
  var hoved = el('div', 'result-hoved');
  var bil = el('div', 'result-billede'); bil.id = 'resBillede';
  hoved.appendChild(bil);
  var tekst = el('div', 'result-tekst');
  var navn = el('div', 'result-navn'); navn.id = 'resNavn';
  var num = el('div', 'result-num'); num.id = 'resNum';
  tekst.appendChild(navn); tekst.appendChild(num);
  hoved.appendChild(tekst);
  res.appendChild(hoved);

  /* ÉN stor knap til barnet, og én lille til far.
     Målt på én prøve pr. årgang 1988-2025: brickinstructions har hvert
     normalt detailsæt (de eneste huller er 7-cifrede LEGO Education-sæt).
     LEGO's eget arkiv har derimod huller uden mønster — de skriver selv
     at de "ikke har byggevejledninger til alle sæt". Et årstals-filter
     ville derfor gætte forkert i begge retninger. Løsningen er i stedet
     at den store knap ALTID peger på det der virker, så et barn aldrig
     rammer en blindgyde, mens LEGO bliver en fodnote. */
  var links = el('div', 'result-links');

  var primaer = el('a', 'result-link primaer');
  primaer.id = 'brickLink';
  primaer.href = '#'; primaer.target = '_blank'; primaer.rel = 'noopener';
  primaer.appendChild(el('span', 'rl-ikon', '📖'));
  primaer.appendChild(el('span', 'rl-tekst', 'Åbn vejledningen'));
  primaer.appendChild(el('span', 'rla', '›'));
  links.appendChild(primaer);

  var sekundaer = el('a', 'result-link sekundaer');
  sekundaer.id = 'legoLink';
  sekundaer.href = '#'; sekundaer.target = '_blank'; sekundaer.rel = 'noopener';
  sekundaer.appendChild(el('span', 'rl-ikon', '🔴'));
  /* Det LEGO faktisk giver er PDF'er til download — ikke 3D-byggeren,
     som ligger i deres app. Labelen skal sige hvad man får. */
  sekundaer.appendChild(el('span', 'rl-tekst', 'LEGO’s egen vejledning (PDF)'));
  links.appendChild(sekundaer);

  res.appendChild(links);

  var gem = el('button', 'save-btn', '⭐ Gem den');
  gem.addEventListener('click', gemISamling);
  res.appendChild(gem);
  hoejre.appendChild(res);

  omraade.appendChild(hoejre);
  return omraade;
}

function skjulResultat() {
  $('setResult').classList.remove('show');
  $('resultTom').classList.remove('skjul');
}

/* ── BELØNNING ─────────────────────────────────────────────────────────────
   Små børn reagerer på øjeblikkelig, sanselig feedback frem for tal og
   point: noget hopper, noget falder ned, og der lyder en lille klang.   */
function konfetti() {
  var tegn = ['🧱', '⭐', '🎉', '✨', T.maskot];
  for (var i = 0; i < 26; i++) {
    var s = el('span', 'konfetti', tegn[i % tegn.length]);
    s.style.left = (Math.random() * 96) + 'vw';
    s.style.animationDelay = (Math.random() * 0.35) + 's';
    s.style.animationDuration = (1.5 + Math.random() * 1.3) + 's';
    s.style.fontSize = (1.1 + Math.random() * 1.5) + 'rem';
    document.body.appendChild(s);
    (function (n) { setTimeout(function () { n.remove(); }, 3300); })(s);
  }
}

/* Maskotten laver et lille hop af glæde */
function maskotGlad() {
  var w = document.querySelector('.welcome');
  if (!w) return;
  w.classList.remove('glad');
  void w.offsetWidth;                    /* tving animationen til at starte forfra */
  w.classList.add('glad');
  setTimeout(function () { w.classList.remove('glad'); }, 900);
}

/* En kort klang, lavet i browseren — ingen lydfiler at hente */
var lydCtx = null;
function lydTaendt() {
  try { return localStorage.getItem(T.id + '_lyd') !== 'nej'; } catch (e) { return true; }
}
function saetLyd(taendt) {
  try { localStorage.setItem(T.id + '_lyd', taendt ? 'ja' : 'nej'); } catch (e) {}
}
function klang(toner) {
  if (!lydTaendt()) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    lydCtx = lydCtx || new AC();
    if (lydCtx.state === 'suspended') {
      var p = lydCtx.resume();          /* ældre Safari returnerer intet løfte */
      if (p && p.catch) p.catch(function () {});
    }
    toner.forEach(function (t) {
      var o = lydCtx.createOscillator(), g = lydCtx.createGain();
      o.type = 'sine';
      o.frequency.value = t[0];
      var naar = lydCtx.currentTime + t[1];
      g.gain.setValueAtTime(0, naar);
      g.gain.linearRampToValueAtTime(0.09, naar + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, naar + 0.3);
      o.connect(g); g.connect(lydCtx.destination);
      o.start(naar); o.stop(naar + 0.32);
    });
  } catch (e) {}
}
function klangFundet() { klang([[784, 0], [1175, 0.11]]); }        /* g'' -> d''' */
function klangGemt()   { klang([[659, 0], [988, 0.1], [1319, 0.2]]); }
function klangNix()    { klang([[311, 0], [233, 0.12]]); }

function fejrFund() { konfetti(); maskotGlad(); klangFundet(); }

function bygBrikGitter(kort) {
  var g = el('div', 'brick-grid');
  kort.forEach(function (k) {
    var a = el('a', 'lego-brick bc-' + k.farve);
    a.href = k.url; a.target = '_blank'; a.rel = 'noopener';
    a.appendChild(studs(2));
    a.appendChild(el('div', 'b-icon', k.ikon));
    a.appendChild(el('div', 'b-title', k.titel));
    a.appendChild(el('div', 'b-sub', k.under));
    g.appendChild(a);
  });
  return g;
}

/* ── NAVIGATION ────────────────────────────────────────────────────────── */
function visSide(id, btn) {
  var i, paneler = document.querySelectorAll('.panel'), knapper = document.querySelectorAll('.nav-btn');
  for (i = 0; i < paneler.length; i++) paneler[i].classList.remove('active');
  for (i = 0; i < knapper.length; i++) knapper[i].classList.remove('active');
  $('panel-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  var s = SIDER.filter(function (x) { return x.id === id; })[0];
  $('pageTitle').textContent = s ? s.titel : '';
  if (id === 'samling') visSamling();
}
function gaaTilVejledning() {
  visSide('vejledning', document.querySelector('.nav-btn[data-side="vejledning"]'));
}

/* ── SØGNING ───────────────────────────────────────────────────────────── */
var aktueltSaet = null;

function soeg() {
  if (nummer.length < 3) {
    var vis = $('padVisning');
    vis.classList.add('shake');
    setTimeout(function () { vis.classList.remove('shake'); }, 400);
    klangNix();
    visToast('🔢 Tryk mindst 3 tal');
    return;
  }
  slaaOp(nummer);
}

function slaaOp(num) {
  nummer = num;
  visNummer();
  /* Foreløbig værdi, så ⭐ Gem den aldrig gemmer det FORRIGE sæt, mens
     der står "Leder...". Overskrives når databasen svarer. */
  aktueltSaet = { num: num, navn: 'Sæt ' + num, aar: 0, variant: 1 };
  $('brickLink').href = brickUrl(num);
  /* Sikker udgave indtil årstallet kendes — opdateres nedenfor */
  $('legoLink').href = legoUrl(num, 0);
  $('resNavn').textContent = 'Leder...';
  $('resNum').textContent = '#' + num;
  $('resBillede').textContent = '⏳';
  $('resultTom').classList.add('skjul');
  $('setResult').classList.add('show');

  hentDb().then(function (db) {
    var r = opslag(num);
    if (r) {
      $('resNavn').textContent = r.navn;
      $('resNum').textContent = '#' + num + (r.aar ? ' · ' + r.aar : '');
      /* Nu kender vi årstallet, så LEGO-linket kan gå direkte hvis muligt */
      $('legoLink').href = legoUrl(num, r.aar);
      fejrFund();                    /* konfetti, glad maskot og en lille klang */
    } else if (!db) {
      /* Sætlisten kunne slet ikke hentes — sig det ligeud i stedet for at
         påstå at sættet er ukendt. Sker typisk hvis filen åbnes som en
         lokal fil, hvor browseren blokerer fetch af lego-saet.json. */
      $('resNavn').textContent = 'Sæt ' + num;
      $('resNum').textContent = (location.protocol === 'file:')
        ? '😕 Åbn appen via en http-adresse — lokale filer må ikke læse sætlisten'
        : '😕 Kunne ikke hente sætlisten — knapperne virker stadig';
    } else {
      /* Pæn faldback: vi kender ikke navnet, men knapperne virker stadig */
      $('resNavn').textContent = 'Sæt ' + num;
      $('resNum').textContent = 'Navnet kender jeg ikke — prøv knapperne ' + T.maskot;
      maskotGlad();
    }
    billedeI($('resBillede'), num, r ? r.variant : 1, '🧱');
    aktueltSaet = {
      num: num,
      navn: r ? r.navn : 'Sæt ' + num,
      aar: r ? r.aar : 0,
      variant: r ? r.variant : 1
    };
  });
}

/* ── MIN SAMLING ───────────────────────────────────────────────────────── */
function hentSamling() {
  var raa;
  try { raa = JSON.parse(localStorage.getItem(T.noegle)) || []; } catch (e) { raa = []; }
  if (!Array.isArray(raa)) return [];
  /* Flyt gamle gemte sæt {num,name,img,...} over i det nye format */
  var aendret = false;
  var ud = raa.map(function (x) {
    if (x && x.navn !== undefined) return x;
    aendret = true;
    if (!x || typeof x !== 'object') return null;   /* beskadiget post — smides ud nedenfor */
    return {
      num: String(x.num || ''),
      navn: x.name || ('Sæt ' + x.num),
      aar: 0,
      variant: 1,
      saved: x.saved || Date.now()
    };
  }).filter(function (x) { return x && x.num; });
  if (aendret) skrivSamling(ud);
  return ud;
}
function skrivSamling(data) {
  try { localStorage.setItem(T.noegle, JSON.stringify(data)); }
  catch (e) { visToast('😬 Kunne ikke gemme'); return; }   /* badget viser stadig det der ER gemt */
  /* Sæt badget ud fra listen vi lige har skrevet. opdaterBadge() ville
     læse forfra via hentSamling() — og fejler skrivningen mens samlingen
     stadig står i det gamle format, migrerer hentSamling() igen, skriver
     igen, og så videre i en uendelig løkke. */
  var b = $('samlingBadge');
  if (b) b.textContent = data.length;
}
function opdaterBadge() {
  var b = $('samlingBadge');
  if (b) b.textContent = hentSamling().length;
}

function gemISamling() {
  if (!aktueltSaet) return;
  var s = hentSamling();
  for (var i = 0; i < s.length; i++) {
    if (s[i].num === aktueltSaet.num) { visToast('⭐ Den har du allerede!'); return; }
  }
  s.unshift({
    num: aktueltSaet.num, navn: aktueltSaet.navn, aar: aktueltSaet.aar,
    variant: aktueltSaet.variant, saved: Date.now()
  });
  skrivSamling(s);
  konfetti(); klangGemt();
  var b = document.querySelector('.nav-btn[data-side="samling"] .badge');
  if (b) { b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop'); }
  visToast('⭐ Gemt i din samling!');
}

function sletFraSamling(num) {
  if (!confirm('Skal sæt ' + num + ' væk fra din samling?')) return;
  skrivSamling(hentSamling().filter(function (x) { return x.num !== num; }));
  visSamling();
  visToast('🗑️ Væk fra samlingen');
}

function omdoebSaet(num) {
  var s = hentSamling();
  var f = s.filter(function (x) { return x.num === num; })[0];
  if (!f) return;
  var nyt = prompt('Hvad hedder sæt ' + num + '?', f.navn);
  if (nyt === null) return;
  nyt = nyt.trim();
  if (!nyt) return;
  f.navn = nyt.slice(0, 60);
  skrivSamling(s);
  visSamling();
}

function visSamling() {
  var s = hentSamling(), vaert = $('samlingIndhold');
  vaert.textContent = '';
  opdaterBadge();

  if (!s.length) {
    var tom = el('div', 'empty-samling');
    tom.appendChild(el('span', 'em-icon', T.maskot));
    tom.appendChild(el('p', null, 'Din samling er tom!'));
    var p2 = el('p', null, 'Find et sæt og tryk ⭐ Gem den');
    p2.style.cssText = 'margin-top:12px;font-size:1.05rem;opacity:.8';
    tom.appendChild(p2);
    vaert.appendChild(tom);
    return;
  }

  var g = el('div', 'samling-grid');
  s.forEach(function (saet) {
    var kort = el('div', 'set-card');
    kort.appendChild(studs(2));

    var bil = el('div', 'set-billede');
    billedeI(bil, saet.num, saet.variant, '🧱');
    kort.appendChild(bil);

    var info = el('div', 'set-info');
    info.appendChild(el('div', 'set-name', saet.navn));
    info.appendChild(el('div', 'set-num', '#' + saet.num + (saet.aar ? ' · ' + saet.aar : '')));
    kort.appendChild(info);

    var handl = el('div', 'set-actions');
    var byg = el('button', 'set-open', '📖 Byg!');
    /* Brug den kilde der har vejledningen til både gamle og nye sæt */
    byg.addEventListener('click', function () { aabn(brickUrl(saet.num)); });
    handl.appendChild(byg);

    var smaa = el('div', 'set-smaa');
    var omd = el('button', 'set-mini', '✏️');
    omd.setAttribute('aria-label', 'Skift navn');
    omd.addEventListener('click', function () { omdoebSaet(saet.num); });
    smaa.appendChild(omd);

    var slet = el('button', 'set-mini', '🗑️');
    slet.setAttribute('aria-label', 'Slet');
    slet.addEventListener('click', function () { sletFraSamling(saet.num); });
    smaa.appendChild(slet);
    handl.appendChild(smaa);

    kort.appendChild(handl);
    g.appendChild(kort);
  });
  vaert.appendChild(g);
}

/* ── SCANNER ───────────────────────────────────────────────────────────────
   Stregkoden på LEGO-æsker er en EAN-kode, og den indeholder IKKE
   sætnummeret — derfor er stregkode-scanning droppet helt. I stedet
   læser vi de trykte tal på æsken med OCR og tjekker hvert bud op mod
   sætdatabasen. Kun tal der findes som et rigtigt LEGO-sæt godtages,
   og barnet får altid billede + navn at sige ja eller nej til.            */
/* Alle stier er pinnet til en fast version. Især langPath: uden
   '_fast' henter tesseract.js standard-sprogmodellen på 10,9 MB
   i stedet for den lille på 2 MB. Samlet engangs-hentning bliver
   ca. 6 MB, og service workeren gemmer det bagefter. */
var TESS = {
  script:  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  worker:  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  core:    'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/',
  sprog:   'https://tessdata.projectnaptha.com/4.0.0_fast'
};
/* scanGen tælles op ved hver start OG hvert stop. Hver kæde af løfter
   husker sit eget nummer og giver op, så snart det ikke længere er det
   aktuelle. En simpel true/false er ikke nok: trykker barnet Scan, Luk og
   Scan igen, mens iOS spørger om kameraet, er flaget sandt igen, når den
   første kæde vågner — og så kører der to kameraer og to OCR-løkker. */
var stroem = null, tessWorker = null, scanGen = 0;
var sidsteBud = null, afviste = {};

function bygScanner() {
  var o = el('div', 'scanner-overlay'); o.id = 'scannerOverlay';
  o.appendChild(el('p', 'scanner-hint', T.maskot + ' Hold sætnummeret på kassen foran kameraet'));

  var boks = el('div', 'scanner-box');
  var v = document.createElement('video');
  v.id = 'scanVideo';
  v.autoplay = true; v.muted = true; v.playsInline = true;
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  boks.appendChild(v);
  boks.appendChild(el('div', 'scanner-line'));
  o.appendChild(boks);

  var st = el('p', 'scanner-status', ''); st.id = 'scanStatus';
  o.appendChild(st);
  var hj = el('p', 'scanner-hint', 'Tallet står oftest i et hjørne af kassen');
  hj.style.cssText = 'font-size:.85rem;opacity:.65';
  o.appendChild(hj);

  var luk = el('button', 'scanner-close', '✕ Luk kamera');
  luk.addEventListener('click', stopScanner);
  o.appendChild(luk);
  return o;
}

function scanStatus(t) { var e = $('scanStatus'); if (e) e.textContent = t; }

function slukKamera() {
  if (stroem) { stroem.getTracks().forEach(function (t) { t.stop(); }); stroem = null; }
}

function startScanner() {
  var gen = ++scanGen;
  slukKamera();                     /* et dobbelttryk må aldrig efterlade et kamera tændt */
  $('scannerOverlay').classList.add('show');
  sidsteBud = null;
  scanStatus('📷 Tænder kameraet...');

  /* Uden sætdatabasen kan vi ikke godkende et bud, og så er scanning
     meningsløs. Sig det ligeud i stedet for at lede i det uendelige. */
  hentDb().then(function (db) {
    if (!db && gen === scanGen) scanStatus('😕 Jeg mangler sætlisten — skriv nummeret i stedet');
  });

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scanStatus('📷 Denne browser kan ikke bruge kameraet');
    return;
  }

  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 }, height: { ideal: 960 }
    }
  }).then(function (s) {
    if (gen !== scanGen) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
    stroem = s;
    var v = $('scanVideo');
    v.srcObject = s;
    return v.play().catch(function () {});
  }).then(function () {
    if (gen !== scanGen) return;
    scanStatus('⏳ Gør tal-læseren klar... (kan tage lidt første gang)');
    return klargoerOcr();
  }).then(function () {
    if (gen !== scanGen) return;
    scanStatus('🔍 Jeg leder efter tal...');
    ocrLoekke(gen);
  }).catch(function (e) {
    if (gen !== scanGen) return;    /* en forældet kædes fejl må ikke overskrive status */
    var besked = '😕 Kameraet kan ikke starte';
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError'))
      besked = '🔒 Du skal give lov til kameraet';
    else if (e && e.name === 'NotFoundError')
      besked = '📷 Jeg kan ikke finde et kamera';
    else if (e && e.message === 'ocr-fejl')
      besked = '😕 Tal-læseren kunne ikke hentes — skriv nummeret i stedet';
    scanStatus(besked);
  });
}

function stopScanner() {
  scanGen++;                        /* alle kørende kæder og OCR-løkker giver op */
  $('scannerOverlay').classList.remove('show');
  slukKamera();
  var v = $('scanVideo');
  if (v) v.srcObject = null;
  scanStatus('');
}

/* Henter tesseract.js fra CDN første gang og laver en worker der kun
   kigger efter cifre. Service workeren cacher filerne, så gang nr. 2
   er hurtig — også uden net.
   Ét fælles løfte: trykker barnet Luk og Scan igen, mens tal-læseren
   stadig hentes, må der ikke startes en motor nr. 2 — den første ville
   aldrig blive lukket og æde hukommelse på iPad'en. */
var ocrLoefte = null;
function klargoerOcr() {
  if (tessWorker) return Promise.resolve(tessWorker);
  if (ocrLoefte) return ocrLoefte;
  ocrLoefte = indlaesScript(TESS.script).then(function () {
    if (typeof Tesseract === 'undefined') throw new Error('ocr-fejl');
    /* oem 1 = kun LSTM. Det gør at der hentes den mindre '-lstm'-kerne. */
    return Tesseract.createWorker('eng', 1, {
      workerPath: TESS.worker,
      corePath:   TESS.core,
      langPath:   TESS.sprog,
      gzip:       true
    });
  }).then(function (w) {
    return w.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '11'          /* sparse text: find tal hvor som helst */
    }).then(function () { tessWorker = w; return w; });
  }).catch(function () {
    ocrLoefte = null;                      /* tillad et nyt forsøg næste gang */
    throw new Error('ocr-fejl');
  });
  return ocrLoefte;
}

function indlaesScript(url) {
  return new Promise(function (ok, fejl) {
    var s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = ok; s.onerror = function () { fejl(new Error('ocr-fejl')); };
    document.head.appendChild(s);
  });
}

/* Trækker et billede ud af videoen, i grå toner så OCR har lettere ved det */
function grebFrame() {
  var v = $('scanVideo');
  if (!v || !v.videoWidth) return null;
  var maxB = 960;
  var skala = Math.min(1, maxB / v.videoWidth);
  var c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * skala);
  c.height = Math.round(v.videoHeight * skala);
  var x = c.getContext('2d');
  x.drawImage(v, 0, 0, c.width, c.height);
  var d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (var i = 0; i < p.length; i += 4) {
    var g = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0;
    p[i] = p[i + 1] = p[i + 2] = g;
  }
  x.putImageData(d, 0, 0);
  return c;
}

/* Alle tal-løb på 4-7 cifre. Fordi kun cifre er hvidlistet, bliver en
   13-cifret EAN-kode trykt i ét stykke ét langt løb — og dermed sorteret fra.

   Men under stregkoden står tallet oftest i BLOKKE: "5 702016 604818"
   (EAN-13) eller "0 73419 12345 6" (UPC-A). Så bliver blokkene til 6-cifrede
   bud, der slår det rigtige 4-cifrede sætnummer. Derfor kasseres et vindue
   af blokke, der ligner en stregkode: mindst 3 blokke, starter med ét
   ciffer (systemcifferet står altid for sig) og har 12-13 cifre i alt. */
function budFraTekst(tekst) {
  var ud = [], m, re = /\d+(?:[ \t]+\d+)*/g;   /* blokke adskilt af mellemrum */
  while ((m = re.exec(tekst)) !== null) {
    var dele = m[0].split(/[ \t]+/), kasseret = [];
    for (var i = 0; i < dele.length; i++) {
      if (dele[i].length !== 1) continue;
      for (var j = i + 1, sum = 1; j < dele.length && sum < 13; j++) {
        sum += dele[j].length;
        if (j - i >= 2 && (sum === 12 || sum === 13)) {
          for (var k = i; k <= j; k++) kasseret[k] = true;
          break;
        }
      }
    }
    for (var n = 0; n < dele.length; n++) {
      if (!kasseret[n] && dele[n].length >= 4 && dele[n].length <= 7) ud.push(dele[n]);
    }
  }
  return ud;
}

/* Vælg det mest sandsynlige sætnummer blandt flere bud.
   Faldgruben: på en æske fra 1992 står "1992" trykt som ophavsretsår,
   og 1992 er tilfældigvis OGSÅ et gyldigt sætnummer. Uden rangering
   ville vi foreslå det forkerte sæt. Derfor:
     - 5-7 cifre er næsten altid sætnummeret        -> højest
     - 4 cifre der ikke ser ud som et årstal        -> derefter
     - 4 cifre i årstals-intervallet                -> sidst
   Er et årstals-lignende tal det eneste bud, bruges det alligevel. */
function vaelgBedste(bud) {
  function point(b) {
    if (b.length >= 5) return 2;
    return /^(19[3-9]\d|20[0-3]\d)$/.test(b) ? 0 : 1;
  }
  var bedst = bud[0], bedstPoint = point(bud[0]);
  for (var i = 1; i < bud.length; i++) {
    var p = point(bud[i]);
    if (p > bedstPoint) { bedst = bud[i]; bedstPoint = p; }
  }
  return bedst;
}

function ocrLoekke(gen) {
  if (gen !== scanGen || !tessWorker) return;
  function igen(ms) { setTimeout(function () { ocrLoekke(gen); }, ms); }
  var c = grebFrame();
  if (!c) { igen(400); return; }

  tessWorker.recognize(c).then(function (r) {
    if (gen !== scanGen) return;
    var bud = budFraTekst((r && r.data && r.data.text) || '');
    /* Behold kun tal der findes som et rigtigt LEGO-sæt og ikke er afvist */
    var gyldige = bud.filter(function (b) { return DB && DB[b] && !afviste[b]; });

    if (gyldige.length) {
      var b = vaelgBedste(gyldige);
      if (sidsteBud === b) {          /* set to gange i træk — så tror vi på det */
        var r2 = opslag(b);
        stopScanner();
        spoergOmSaet(r2);
        return;
      }
      sidsteBud = b;
      scanStatus('👀 Jeg kan se ' + b + '...');
    } else {
      sidsteBud = null;
      scanStatus(bud.length ? '🔍 Jeg leder videre...' : '🔍 Jeg leder efter tal...');
    }
    igen(250);
  }).catch(function () {
    igen(800);                        /* ocrLoekke tjekker selv om den stadig er aktuel */
  });
}

/* ── "ER DET DEN HER?" ─────────────────────────────────────────────────── */
function bygBekraeft() {
  var o = el('div', 'bekraeft'); o.id = 'bekraeft';
  var k = el('div', 'bekraeft-kort');
  var b = el('div', 'bk-billede'); b.id = 'bkBillede';
  k.appendChild(b);
  var h = el('h2', null, ''); h.id = 'bkNavn';
  k.appendChild(h);
  var n = el('div', 'bk-num', ''); n.id = 'bkNum';
  k.appendChild(n);
  var kn = el('div', 'bekraeft-knapper');
  var ja = el('button', 'bk-ja', '✅ JA!'); ja.id = 'bkJa';
  var nej = el('button', 'bk-nej', '✕ Nej'); nej.id = 'bkNej';
  kn.appendChild(ja); kn.appendChild(nej);
  k.appendChild(kn);
  o.appendChild(k);
  return o;
}

function spoergOmSaet(r) {
  $('bkNavn').textContent = r.navn;
  $('bkNum').textContent = '#' + r.num + (r.aar ? ' · ' + r.aar : '');
  billedeI($('bkBillede'), r.num, r.variant, '🧱');
  $('bekraeft').classList.add('show');

  $('bkJa').onclick = function () {
    $('bekraeft').classList.remove('show');
    gaaTilVejledning();
    slaaOp(r.num);
  };
  $('bkNej').onclick = function () {
    afviste[r.num] = true;            /* spørg ikke om det samme igen */
    $('bekraeft').classList.remove('show');
    startScanner();                   /* prøv igen */
  };
}

/* ── TOAST + LINKS ─────────────────────────────────────────────────────── */
var toastTimer = null;
function visToast(besked) {
  var t = $('toast');
  t.textContent = besked;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
}
function aabn(url) {
  if (!navigator.onLine) { visToast('📴 Der er ikke noget internet lige nu'); return; }
  window.open(url, '_blank', 'noopener');
}

/* ── ONLINE / OFFLINE ──────────────────────────────────────────────────── */
function opdaterNetStatus() { document.body.classList.toggle('offline', !navigator.onLine); }

/* ── AUTO-OPDATERING ───────────────────────────────────────────────────────
   To ting arbejder sammen, og ingen af dem kræver at jeg husker at hæve
   et versionsnummer når jeg pusher:

   1) Service workeren henter HTML/CSS/JS fra nettet først. Så snart siden
      indlæses, er koden derfor den nyeste.
   2) iOS genindlæser ikke en hjemskærms-app der bare vækkes fra baggrunden.
      Derfor spørger vi selv: hver gang appen kommer i forgrunden hentes
      ETag-hovederne for app.js, app.css og HTML-filen (HEAD, få hundrede
      bytes). ETag er GitHub Pages' eget indholds-fingeraftryk og skifter
      helt af sig selv ved hvert push. Er det ændret, er den kørende kode
      gammel — så genindlæser vi.                                          */
var genindlaeser = false;
var fingeraftryk = null;

var FRISK_FILER = ['app.js', 'app.css', location.pathname.split('/').pop() || './'];

function hentFingeraftryk() {
  return Promise.all(FRISK_FILER.map(function (f) {
    return fetch(f + '?frisk=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) return null;
        return r.headers.get('ETag') || r.headers.get('Last-Modified') || '';
      })
      .catch(function () { return null; });
  })).then(function (svar) {
    /* Kunne vi ikke nå alle filer, konkluderer vi ingenting */
    for (var i = 0; i < svar.length; i++) if (svar[i] === null) return null;
    return svar.join('|');
  });
}

function genindlaesNuMedBesked() {
  if (genindlaeser) return;
  genindlaeser = true;
  visToast('✨ Ny version — henter den!');
  setTimeout(function () { location.reload(); }, 1200);
}

function startVersionsvagt() {
  hentFingeraftryk().then(function (f) { fingeraftryk = f; });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden || genindlaeser) return;
    hentFingeraftryk().then(function (f) {
      if (!f) return;                          /* intet net — prøv igen næste gang */
      if (!fingeraftryk) { fingeraftryk = f; return; }
      if (f !== fingeraftryk) genindlaesNuMedBesked();
    });
  });
}

function saetServiceWorkerOp() {
  if (!('serviceWorker' in navigator)) return;
  var havdeStyring = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!havdeStyring) return;                 /* første installation: ingen reload */
    genindlaesNuMedBesked();
  });

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
    function tjek() { if (!document.hidden) reg.update().catch(function () {}); }
    document.addEventListener('visibilitychange', tjek);
    window.addEventListener('online', tjek);
    setInterval(tjek, 30 * 60 * 1000);
  }).catch(function () {});
}

/* Nødknappen i sidebaren, hvis noget alligevel sidder fast */
function tvingOpdatering() {
  visToast('🔄 Henter nyeste version...');
  genindlaeser = true;
  var klar = ('serviceWorker' in navigator)
    ? navigator.serviceWorker.getRegistration()
        .then(function (reg) { return reg ? reg.update() : null; })
        .catch(function () {})
    : Promise.resolve();
  klar.then(function () { setTimeout(function () { location.reload(); }, 600); });
  /* Hård bagkant: reg.update() har ingen tidsgrænse og kan hænge på et
     dødt net. Uden denne ville knappen intet gøre — og genindlaeser ville
     stå fast på true og slå versionsvagten fra resten af sessionen. */
  setTimeout(function () { location.reload(); }, 4000);
}

/* ── START ─────────────────────────────────────────────────────────────── */
byg();
visNummer();
tastLyt();
opdaterBadge();
opdaterNetStatus();
window.addEventListener('online', opdaterNetStatus);
window.addEventListener('offline', opdaterNetStatus);
window.addEventListener('pagehide', function () {
  stopScanner();
  if (tessWorker) { try { tessWorker.terminate(); } catch (e) {} tessWorker = null; }
  ocrLoefte = null;                        /* ellers udleveres den lukkede motor igen */
});
saetServiceWorkerOp();
startVersionsvagt();

})();

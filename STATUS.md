# STATUS – LEGO-apperne

Senest opdateret: 23-10-2026

## Afventer Jimmy
- **24-10 aften:** Huskeklodsen v3 er **pushet** (41d0147, Saga efter Jimmys «push alt» 24-10). Prøv på iPad med
  tastaturcover, at der står «v3 · 23-10-2026»: hold Enter og 1 nede, og tryk ✕.
- **23-10 kl. 22:28:** Huskeklodsen v3 (tastaturcoveret) er flettet til `main` (3a7893d). Alle 9 node-tests er grønne
  på main, og WebKit-prøven gav 74 af 75 (lyden kan ikke måles).
- **23-10:** v2 er pushet og live (b380b6d). Beslutningerne i designets afsnit E
  (klodser, stemme, rækkefølge) er stadig åbne. Indtil da bruges standardvalgene: fanen «Spil 🎮», 🧠-ikonet
  og farverne bc-3/bc-5.
- **23-10:** v1 er live (pushet kl. 12:19). Tjek på iPad, at «v1 · 23-10-2026» står nederst på 📦 Byg, og at
  `/alma-dino` og `/ella-prinsesse` virker uden `.html`. Det er ikke afprøvet lokalt.

## Lavet
- **23-10 (v3 · 23-10-2026, flettet til main):** tastaturet i Huskeklodsen.
  - En holdt tast (`e.repeat`) tæller ikke: Enter, mellemrum, →, R og 1-3 i spillet, og Enter/mellemrum på en
    knap uden for spillet. Ellers åbnede en holdt Enter på ✕ spillet igen, fordi fokus går tilbage til spil-klodsen.
  - Tasterne 1-3 hviler 450 ms som svarknapperne.
  - Code-review rettet. Node: spil 61/61; mutanterne uden preventDefault, uden «2» og uden R fejler alle.
  - WebKit (`test/webkit-spil.js`): 74 af 75, 1 ikke målt (lyd). Den gamle `app.js` fejler den nye prøve
    «en holdt Enter på ✕ lukker spillet og åbner det ikke igen».
  - **Ikke afprøvet** på rigtig iPad med tastaturcover.
- **23-10 (v2, pushet 23-10):** Klodsespillet Huskeklodsen under 🎮.
  - Code-review og sikkerhedsgennemgang er rettet.
  - UI-review i WebKit: Alma og Ella × 390×844, 1180×820, 820×1180 og 1440×900, plus offline. Det fandt:
    - «?»-klodsen var gul eller guld og afslørede svaret «gul». Nu er den en grå spøgelsesklods med stiplet
      cyan kant og et «?» midt på forsiden.
    - ⏭ ventede kun 450 ms og fik derfor et dobbelttryk på ✅ med. Nu hviler ⏭ i 1,5 s efter skærmskiftet,
      og svarknapperne hviler 450 ms.
  - Genkontrol:
    - Et tryk på ⏭ 577-591 ms efter ✅ springer ikke over (5 af 5), et tryk efter 1,7 s gør.
    - `test/webkit-spil.js` gav 73 af 74. Lyden er ikke målt, fordi WebKit på Windows ikke har WebAudio.
    - Node-testene er grønne (spil 57/57).
  - Rester:
    - Klodserne bliver mindre fra niveau 5-6. Kun kommentaren er rettet, for på iPhone er en klods på
      niveau 1 allerede 44,5 px høj.
    - Tasterne 1-3, den holdte Enter og testen for inert i luk() er rettet i v3 (se ovenfor).
    - Hvis far senere vælger «grå» (fase 2), kan en grå klods forveksles med den grå svarknap.
  - **Ikke afprøvet:** lyd og ægte dobbelttryk med fingeren på en rigtig iPad.
- **23-10 (main, v1 · 23-10-2026):** Synligt versionsnummer nederst på 📦 Byg og i «Til far»
  (`bygVersion()`); `test/test-version.js` kræver et nyt nummer, når en fil i `SKAL` ændres, og sammenligner
  med `main`. Code-review rettet (et omskrevet fingeraftryk og et udkommenteret kald gav før falsk OK).
  UI-review i WebKit (Alma/Ella × 390×844, 1180×820, 820×1180, 1440×900 + offline): klar, tre små detaljer,
  hvoraf to er rettet (venstrestillet på Byg, kan ikke markeres). Ikke afprøvet på rigtig iPad/iPhone.
- **22-10 → flettet 23-10:** service workeren svarer kun for appens egne filer (se nedenfor).
- **22-10 (gren `claude/sw-scope-22-10`, ikke flettet):** Service workeren svarer kun for LEGO-appens
  egne filer (positivliste `EGNE`, bygget af `SKAL` i `sw.js`). Alt andet på jimmyfabe.github.io, fx
  `/Lystaarnet/`, klarer browseren selv: ingen `respondWith`, og intet gemmes i `lego-app-v1`.
  `activate` rydder desuden gamle poster fra andre stier ud af `lego-app-v1` (kun dén cache;
  `mat-…` og `mat-tale` røres ikke). Adresserne uden `.html` (`/alma-dino`) tæller også som egne.
  `test/test-sw.js` 23/23. **Playwright WebKit (`test/webkit-sw.js`) 17/17:** fejlen genskabt med den
  gamle `sw.js`, oprydning af 500 Lystårnet-poster, 1000 sætbilleder og `mat-*` urørte, skallen 14/14,
  skiftet tog 259 ms, Alma og Ella virker offline på 390×844 og desktop.
  **Ikke afprøvet:** på rigtig iPad/iPhone.
- **12-10:** `test/test-sw.js` tjekker nu også, at `activate` lader Lystårnets `mat-tale`
  (Piper-stemmen, ca. 66 MB) være. Testen fejler mod den gamle `sw.js` fra før 04-10.
  Hård læring nr. 17 i `CONTEXT.md`. `sw.js` er uændret, og der er bevidst intet versionsnummer at hæve.
  Prøvet i Playwright WebKit med Lystårnets caches lagt ind på forhånd: `mat-tale` og `mat-<version>`
  overlever, og appen virker på desktop, iPad på tværs og iPhone. Den gamle `sw.js` slettede dem.
- **04-10:** Service workeren sletter kun sine egne gamle caches (`lego-…`). Før slettede den alle
  andre caches på jimmyfabe.github.io — også matematikspillets (Lystårnet) offline-kopi. Kun
  cache-oprydningen er ændret; udseende, funktioner og gemte sæt er uændrede. Test i `test/test-sw.js`.
- **30-09 (aften):** Byg-fanens fire klodser står 2+2 på iPad på tværs (før 3+1).
  iPhone på tværs viser hele sidebjælken uden at rulle: 🔑 🔄 🔊 på én række,
  og polstringen dækker hakket i stedet for at lægge det til. Målt i Chromium
  og WebKit med simuleret hak — se `CONTEXT.md`, afsnit Layout.
- **30-09 (aften):** Et langt sætnavn uden mellemrum knækker nu inde i kortet
  (Samling, søgeresultat og bekræft-boks) i stedet for at give vandret rulning.
- **30-09:** Spil-fanen fører nu til rigtige, gratis spil på LEGO's børneside
  (`kids.lego.com`). Før landede alle tema-kortene i LEGO's **butik**, og
  "LEGO.com Spil" var betalte konsolspil. Plays.org og NuMuKi er fjernet
  (links til gambling-/skydespil, reklamer).
- **30-09:** Nyt LEGO-klods-udseende: synlige knopper, egen 3D-kant pr. farve,
  plastglans, byggeplade i baggrunden, lys fotoplade i Samling.
- **30-09:** "Min LEGO Konto" og 🔑-knappen gav 404 — rettet til `/da-dk/member`.
- **30-09:** Klodsfarverne giver nu mindst 4,5:1 mod hvid tekst.
- **30-09:** `test-links.js` tjekker alle kort for statuskode, butikstitel og
  forbudte adresser.
- **21-09:** 💾/📂 kopi af samlingen, egen skrifttype, strammere stregkoderegel.
- **19-21-09:** 11 fejlrettelser fra kode- og sikkerhedsgennemgang (se git log).

## Mangler / næste skridt
- **Lystårnet (ikke her):** LEGO's service worker (scope `/`) er stadig `controller` for en
  `/Lystaarnet/`-side, til Lystårnets egen har overtaget (målt i WebKit-prøven 22-10, fase 3).
  Lystårnets `app.js` (`swGemmer`, ca. linje 744)
  tjekker kun, at der er en `controller`, og tror så, at dens egen service worker gemmer stemmen.
  Rettes i Lystårnet ved også at tjekke `controller.scriptURL`. Rammer kun nye enheder.
- **Prøv på en rigtig iPad:** at spillene på kids.lego.com virker med touch,
  og svar på LEGO's cookie-banner én gang pr. iPad.
- Prøv 💾 Gem kopi (del-arket) og 📂 Hent kopi (filvælgeren) på iPad.
- Kamera/OCR og service workeren er stadig kun afprøvet i Node og desktop.
- Prøv iPhone på tværs på en rigtig iPhone: hakket er kun simuleret.
- Småting, ikke rettet (ikke fejl for pigerne):
  - Jurassic World-klodsen er sennepsgul (#886f00) for at hvid tekst kan
    læses. Rigtig LEGO-gul kræver mørk tekst på netop den klods — Jimmys valg.
  - Desktop 1440 px: fem kolonner til fire klodser (et tomt felt).
  - Safari før 16 (ingen container queries): Byg står 3+1 som før.

## Beslutninger
- **Jurassic World og Disney har ingen gratis spil** på LEGO's børneside, kun
  film. Klodserne bliver (det er pigernes yndlingstemaer), men får 📺 i hjørnet.
  Øverst til venstre er altid et tema *med* spil (City / Friends).
- **Ingen apps og ingen tredjepartssider** i Spil-fanen: de gratis LEGO-apps
  er freemium, kræver login eller er på engelsk.
- Den brede plade «Alle LEGO-spil» er kun bred ved 1 og 3 kolonner; ellers
  en almindelig klods, så der ikke opstår huller (container queries).

## Ting der ikke virkede
- 22-10: WebKit-prøven gav først 10/16, men fejlen sad i prøven: profilstien var 63 tegn, og WebKit
  gemmer store svar 197 tegn dybere, så stien kom over Windows' 259 tegn, og filerne manglede i
  stilhed. Profilstien må højst være 62 tegn (prøven stopper nu selv ved en for lang sti).
- Et 200-svar beviser intet: spil-linkene svarede 200, men var butikken.
  Se hård læring nr. 16 i `CONTEXT.md`.

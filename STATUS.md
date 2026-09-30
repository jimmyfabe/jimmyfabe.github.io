# STATUS – LEGO-apperne

Senest opdateret: 30-09-2026

## Lavet
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
- **Prøv på en rigtig iPad:** at spillene på kids.lego.com virker med touch,
  og svar på LEGO's cookie-banner én gang pr. iPad.
- Prøv 💾 Gem kopi (del-arket) og 📂 Hent kopi (filvælgeren) på iPad.
- Kamera/OCR og service workeren er stadig kun afprøvet i Node og desktop.

## Beslutninger
- **Jurassic World og Disney har ingen gratis spil** på LEGO's børneside, kun
  film. Klodserne bliver (det er pigernes yndlingstemaer), men får 📺 i hjørnet.
  Øverst til venstre er altid et tema *med* spil (City / Friends).
- **Ingen apps og ingen tredjepartssider** i Spil-fanen: de gratis LEGO-apps
  er freemium, kræver login eller er på engelsk.
- Den brede plade «Alle LEGO-spil» er kun bred ved 1 og 3 kolonner; ellers
  en almindelig klods, så der ikke opstår huller (container queries).

## Ting der ikke virkede
- Et 200-svar beviser intet: spil-linkene svarede 200, men var butikken.
  Se hård læring nr. 16 i `CONTEXT.md`.

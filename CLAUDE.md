# CLAUDE.md — Faste regler for LEGO-apperne

Dette er de faste regler for arbejdet med Almas og Ellas LEGO-apps.
De gælder automatisk i alle sessioner.

## Kommunikation
- **Svar altid på dansk.** Også kommentarer i koden er på dansk.
- Kort og konkret. Ingen lange forklaringer med mindre der spørges.
- Stil spørgsmål, når noget er uklart, i stedet for at gætte.
- Byg i **små, håndterbare skridt**. Brugeren arbejder ofte i korte pauser.
- **Kontrollér koden inden du siger den virker.**

## Projektets filer
- `alma-dino.html` / `ella-prinsesse.html` — tynde skaller: meta-tags,
  farvevariabler og `window.TEMA`. Intet andet.
- `app.css` + `app.js` — **al** stil og logik, delt mellem begge apps.
- `CONTEXT.md` — **projektets hukommelse** og autoritative kilde til
  arkitektur, trufne beslutninger og hårde læringer.
  **Læs den ved sessionens start**, og **opdatér den** når vi træffer nye
  beslutninger eller finder nye faldgruber.

## Målgruppen er 6 år
Pigerne er 6 år (7 i oktober) og kan næsten ikke læse. Størrelserne er
valgt efter forskningsanbefalinger for aldersgruppen — ikke voksne-mål.

- Trykflader **mindst 52 px**, taltasterne 104 px (≈ 2 cm på iPad).
- **1 cm ≈ 52 CSS-px på iPad.** Regn i cm, ikke px, når du laver nyt.
- Ingen tekst barnet skal læse under 17 px.
- Ikoner bærer betydningen, ikke tekst.
- Læs afsnittet "Børnevenligt design" i `CONTEXT.md` **før** du ændrer
  størrelser eller layout.

## Ting der ikke må ændres
- **Filnavnene** `alma-dino.html` og `ella-prinsesse.html` — de ligger på
  pigernes hjemskærm. Omdøbes de, dør ikonerne.
- **localStorage-nøglerne** `alma_samling_v1` / `ella_samling_v1` —
  det er dér pigernes gemte sæt ligger.
- **`cache: 'reload'`** i `sw.js` — uden den kan browserens HTTP-cache
  udlevere en gammel version i op til 10 minutter.
- **`grid-auto-rows`** med fast/clamp'et højde i kort-gitteret. Sættes den
  til `auto`, strækker kortene sig og efterlader store tomme områder.

## Tekniske krav ved hver ændring
- **Validér JavaScript:** `node --check app.js` og `node --check sw.js`.
- **Kør testsuiterne** når du har rørt logikken:
  ```
  node test/test-ocr.js        (OCR-filtrering og rangering)
  node test/test-sw.js         (service worker-opførsel)
  node test/test-strategi.js   (hvilke filer caches hvordan)
  node test/test-cachebust.js  (at cachen omgås korrekt)
  node test-links.js           (at LEGO-adresserne stadig virker — kræver net)
  ```
- **Tilføjer du en temavariabel til `app.css`, skal den defineres i BEGGE
  HTML-filer.** Tjek med:
  ```
  grep -oE 'var\(--[a-z0-9-]+\)' app.css | sort -u
  ```
- `app.css` og `app.js` må **aldrig** nævne grøn eller lyserød. Alle farver
  kommer fra variablerne, som skallerne sætter.

## Test ALTID over http — aldrig file://
Dobbeltklikker du HTML-filen, blokerer browseren `fetch()` af
`lego-saet.json`, og **hvert** sæt vises uden navn. Det ligner en fejl i
databasen, men er det ikke. Service workeren kan heller ikke registreres.

```
node start-server.js
```
→ `http://localhost:8080/alma-dino.html`

## Platform
- **Ingen build-step.** Rene statiske filer, serveret direkte fra GitHub Pages.
- Alt skal være **gratis** og må ikke kræve en rigtig server eller API-nøgle.
- Repo: `jimmyfabe/jimmyfabe.github.io`, branch `main`, folder `/ (root)`.
- iOS kan **ikke** åbne lokale `.html`-filer fra Safari (siden iOS 18.5).
  Foreslå aldrig AirDrop, Filer-appen eller `file:///` som vej til iPad'en.

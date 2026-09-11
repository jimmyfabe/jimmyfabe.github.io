# Flytning af LEGO-apperne til privat PC

Skrevet 09.09.2026. To børne-webapps til Alma og Ella (begge 6 år, 7 i oktober),
der finder byggevejledninger til deres LEGO — også de gamle sæt fra 90'erne.

---

## ⚠️ ALLERVIGTIGST 1: intet af arbejdet er lagt op endnu

Alt det, der er bygget, ligger **kun i disse filer**. Live-siden kører stadig
den gamle version. Kontrolleret 09.09.2026:

| Adresse | Status |
|---|---|
| `jimmyfabe.github.io/alma-dino.html` | HTTP 200 — men **den GAMLE** fil (23,6 kB, med ZXing og inline CSS) |
| `jimmyfabe.github.io/app.js` | **HTTP 404** |
| `jimmyfabe.github.io/sw.js` | **HTTP 404** |
| `jimmyfabe.github.io/lego-saet.json` | **HTTP 404** |

**Første opgave på den private PC er derfor at lægge alle filerne op.**
Se afsnittet "Sådan lægger du det op" nedenfor. Indtil da er der ingen
ændringer på pigernes iPads — de kører videre på den gamle udgave.

> Alt skal op i **samme** upload. `app.css`, `app.js`, `sw.js`,
> `lego-saet.json`, de to manifests og de seks ikoner er alle nye filer.
> Mangler én af dem, får du en tom eller ødelagt app.

---

## ⚠️ ALLERVIGTIGST 2: pigernes gemte sæt ligger IKKE i filerne

"Min Samling" ligger i **browserens localStorage på hver iPad**, under
nøglerne `alma_samling_v1` og `ella_samling_v1`. Det følger **ikke** med
filerne og ligger **ikke** på denne USB-nøgle.

Det har én praktisk konsekvens:

**Fjerner du appen fra hjemskærmen for at få det nye ikon, kan de gemte sæt
forsvinde med den.** iOS lader en hjemskærms-webapp have sin egen
data-beholder, og den ryddes når appen slettes.

**Skriv sætnumrene ned først.** Det er nogle få numre og tager et halvt
minut. Åbn appen → ⭐ Samling → skriv numrene ned. Så kan du taste dem ind
igen bagefter.

Vil du ikke risikere det: **lad appen ligge.** Auto-opdateringen henter den
nye version af sig selv. Det eneste du går glip af, er det pæne 🦕/🦄-ikon —
ikonet bliver ved med at være et screenshot.

---

## Sådan sætter du det op på den private PC

1. **Kopiér hele `Lego`-mappen fra USB-nøglen ind på den lokale disk.**
   Fx `C:\Users\<dit navn>\Documents\Lego`.
   Kør den **ikke** direkte fra USB-nøglen — så risikerer du at redigere en
   fil, der forsvinder, når nøglen tages ud.

2. **Installér Node.js**, hvis den ikke er der: <https://nodejs.org> (LTS).
   Den bruges kun til at prøve apperne lokalt og køre testene — apperne selv
   har ingen afhængigheder og kræver ingen build.

3. **Prøv apperne:**
   ```
   cd Lego
   node start-server.js
   ```
   Åbn så `http://localhost:8080/alma-dino.html` og
   `http://localhost:8080/ella-prinsesse.html`.

   Tast `6339` og tryk 🔎. Der skal stå **"Shuttle Launch Pad · 1995"** med
   billede af æsken, konfetti og en lille klang.

> ### Dobbeltklik ALDRIG HTML-filen
> Åbnes den som `file://`, blokerer browseren `fetch()` af `lego-saet.json`,
> og **hvert** sæt vises uden navn ("Sæt 6339"). Det ligner en fejl i
> databasen, men er det ikke. Appen siger det nu selv:
> *"Åbn appen via en http-adresse — lokale filer må ikke læse sætlisten."*
> Service workeren kan heller ikke registreres på `file://`.

---

## Sådan lægger du det op — det er ÉN kommando

Mappen **er nu et git-repo**, sat op 11.09.2026, med den eksisterende
historik fra GitHub hentet ned. To commits ligger klar og venter:

```
d865f6e  Opdatér sætlisten: 21.008 sæt
3c33c8a  Del koden, gør apperne til PWA'er og ret sætopslag og scanner
```

Alt du mangler, er at sende dem afsted:

```
cd Lego
git push
```

Første gang beder den om login til GitHub. Brug kontoen **`jimmyfabe`** —
brugernavnet skal matche repo-navnet præcist, ellers virker Pages ikke på
rod-domænet. Har du to-faktor slået til, skal du bruge et **personal access
token** som adgangskode, ikke din almindelige. Du laver et under
GitHub → Settings → Developer settings → Personal access tokens, med
`repo`-rettigheder.

Giv Pages 1-2 minutter, og tjek så:

```
node test-links.js
```

…og åbn <https://jimmyfabe.github.io/alma-dino.html> på en rigtig enhed.

> **Commit-identiteten er et gæt.** Jeg satte den lokalt til
> `jimmyfabe / jimmyfabe@users.noreply.github.com` for ikke at lægge din
> arbejdsmail i et offentligt repo. Vil du have en anden, så ret den med
> `git config user.email "..."` før du pusher.

### Hvad der IKKE kommer med i repo'et

`claude-hukommelse/` står i `.gitignore`. Repo'et er **offentligt** —
personlige noter om dig og pigerne skal ikke publiceres. De ligger kun på
USB-nøglen.

`README.md` fra det gamle repo er bevaret, ikke overskrevet.

---

## Sådan fortsætter du med Claude Code

1. Åbn en terminal i `Lego`-mappen og start `claude`.
2. Claude læser automatisk **`CLAUDE.md`** (de faste arbejdsregler — svar på
   dansk, små skridt, validér JS, test over http, hvad der ikke må ændres).
3. **Bed Claude læse `CONTEXT.md` først.** Det er projektets hukommelse:
   arkitektur, alle trufne beslutninger og — vigtigst — de **10 hårde
   læringer**, altså de fælder vi allerede er faldet i. Uden dem vil en ny
   session gentage dem.

En god første besked kunne være:

> Læs CONTEXT.md og LÆS-MIG-FØRST.md. Jeg skal have lagt projektet op på
> GitHub Pages første gang. Hjælp mig igennem det, og lad os derefter
> tjekke om service workeren faktisk installerer på iPad'en.

### Claudes hukommelse fra arbejds-PC'en

Mappen `claude-hukommelse/` indeholder de hukommelsesfiler, Claude på
arbejds-PC'en havde skrevet om dig og projektet. **De følger ikke automatisk
med** — Claudes hukommelse hører til den maskine, den kørte på.

Vil du have den nye Claude til at kende dem, så sig:

> Læs filerne i claude-hukommelse/ og gem dem i din egen hukommelse.

De fire filer dækker: hvem du og pigerne er og hvad det betyder for
designet, at du selv afprøver og vil have rodårsagen frem for kosmetiske
rettelser, projektets status ved flytningen, og mønsteret du bruger til at
flytte projekter på USB-nøglen.

---

## Hvad der er lavet

Projektet startede som to næsten identiske single-file HTML-apps på ~23 kB.
Nu:

- **Duplikeringen væk.** `app.css` + `app.js` er delt. Hver HTML-fil er ~4 kB
  med farvevariabler og `window.TEMA`. Et nyt spil-kort er én linje.
- **Auto-opdatering uden versionsnummer.** Service worker (network-first) +
  en ETag-vagt der tjekker efter nyt, hver gang appen kommer i forgrunden.
  Der er intet at huske at hæve ved et push.
- **Rigtige PWA'er.** Manifest pr. barn, fuldskærm, safe-area-padding, og
  rigtige 🦕/🦄-ikoner som PNG. Min Samling virker offline.
- **Sætopslag uden API.** Rebrickable-kaldet er væk. Hele sætlisten ligger som
  statisk fil: `lego-saet.json`, 20.976 sæt, 225 kB gzippet. Ingen nøgle,
  ingen kvote, virker offline.
- **Scanneren omskrevet.** ZXing er fjernet — stregkoden på en LEGO-æske er en
  EAN-kode og indeholder **ikke** sætnummeret. Nu OCR på de trykte tal, hvor
  hvert bud tjekkes mod sætlisten, og buddene rangeres (så ophavsretsåret
  "1992" ikke forveksles med sætnummer 1992).
- **Børnevenligt layout.** Stort taltastatur (104 px taster ≈ 2 cm), tekst op
  fra 11-15 px til 21-42 px, korte fanenavne, konfetti + glad maskot + klang
  som belønning.
- **Linkene rettet.** brickinstructions havde skiftet adressestruktur (den
  gamle gav 404). Den store knap peger nu altid på den kilde der har **alle**
  35 testede årgange 1988-2025; LEGO er en nedtonet fodnote, fordi deres eget
  arkiv har huller uden mønster.

Alle detaljer og begrundelser står i `CONTEXT.md`.

---

## Hvad der IKKE er prøvet endnu

Disse tre kunne ikke testes på arbejds-PC'en og skal ses på en iPad:

1. **At service workeren faktisk installerer og aktiverer.**
   Browser-panelet på arbejds-PC'en blokerede SW-registrering helt (bekræftet
   med en tom service worker, så det er miljøet og ikke koden). Logikken er
   testet med 23 tests i Node, men livscyklussen er urørt.
2. **Kameraet og OCR på iOS.** OCR-kæden er testet ende-til-ende med et
   syntetisk æskebillede (læste korrekt `6075` frem for året `1992`), men
   `getUserMedia` på en iPad i standalone-tilstand er ikke prøvet.
   Første gang der trykkes 📷 Scan hentes ca. 6 MB tal-læser — gør det over wifi.
3. **At animationerne bevæger sig.** Konfetti og maskottens hop er kun
   verificeret som stillbilleder; browser-panelets animationsur var frosset
   (`currentTime` blev 0, selvom animationen kørte).

---

## To ting du selv skal beslutte

**Sæt en indholdsblokering på pigernes iPads.**
brickinstructions viser et dansk cookie-samtykke-vindue og reklameblokke
**hver gang** barnet åbner en vejledning. Vi kan ikke fjerne det fra vores
side — vi må ikke selv hoste vejledningerne. Det er formentlig den største
reelle forbedring af deres oplevelse, og den ligger helt uden for koden.

To gratis muligheder:

- **AdGuard** — gratis udgave blokerer i Safari, blokerer mest.
- **Ka-Block!** — helt gratis og open source, ingen opsætning.

Installér fra App Store, og slå den til under
**Indstillinger → Apps → Safari → Udvidelser**. Skal gøres på begge iPads.

**Og husk den tilbagevendende opgave:** `lego-saet.json` er et snapshot.
Da den blev genskabt 11.09.2026, var der kommet 32 nye sæt på to dage.
Kør `node byg-saetliste.js` et par gange om året, commit og push.

---

## Fakta

| | |
|---|---|
| Repo | `jimmyfabe/jimmyfabe.github.io`, branch `main`, folder `/ (root)` |
| Alma | <https://jimmyfabe.github.io/alma-dino.html> |
| Ella | <https://jimmyfabe.github.io/ella-prinsesse.html> |
| localStorage-nøgler | `alma_samling_v1`, `ella_samling_v1` |
| Build-step | ingen — rene statiske filer |
| Krav | alt skal være gratis, ingen server, ingen API-nøgle |
| Sætliste | 20.976 sæt. Opdatér med `node byg-saetliste.js` |
| Lokal test | `node start-server.js` → port 8080 |

### Kendte sætnumre til test

| Nummer | Sæt | År |
|---|---|---|
| 6339 | Shuttle Launch Pad | 1995 |
| 6075 | Wolfpack Tower | 1992 |
| 6008 | Royal King | 1995 |
| 4525 | Road and Rail Repair | 1994 |
| 6348 | Surveillance Squad | 1994 |
| 41068 | Arendelle Castle Celebration | 2016 |
| 77241 | 2 Fast 2 Furious Honda S2000 | 2025 |
| 75419 | Death Star | 2025 |

---

## Originalen

Filerne er **kopieret**, ikke flyttet. Originalen ligger stadig i
`C:\Users\JIF\Desktop\Lego` på arbejds-PC'en. Slet den først, når du har
bekræftet at alt virker på den private PC.

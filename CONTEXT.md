# LEGO-apps til Alma og Ella

Kontekstfil til Claude Code. Læs denne først.

---

## Hvad projektet er

To børne-webapps der hjælper mine to døtre på 6 år med at finde
byggevejledninger til deres LEGO — både nye sæt og gamle fra 90'erne
hvor manualerne er væk. Hver pige har sin egen iPad og sin egen app
med eget tema.

**Målgruppe:** 6 år, kan næsten ikke læse endnu. Store trykflader,
ikoner frem for tekst, alt på dansk.

---

## Live-adresser

| Barn | URL |
|---|---|
| Alma 🦕 | https://jimmyfabe.github.io/alma-dino.html |
| Ella 🦄 | https://jimmyfabe.github.io/ella-prinsesse.html |

**Repo:** `jimmyfabe/jimmyfabe.github.io`
**Hosting:** GitHub Pages, branch `main`, folder `/ (root)`
**Build-step:** ingen. Alt serveres som statiske filer.

---

## Filstruktur

De to apps delte før ~95% af deres kode. Nu er alt fælles lagt i to
delte filer, og hver HTML-fil er kun en tynd skal med barnets tema.

```
alma-dino.html          ~4 kB    skal: meta-tags + farver + tema-data
ella-prinsesse.html     ~4 kB    samme, men lyserød/lilla
app.css                 ~21 kB   AL stil. Nævner aldrig grøn eller lyserød
app.js                  ~31 kB   AL logik. Bygger hele brugerfladen
sw.js                   ~5 kB    service worker (auto-opdatering + offline)
manifest-alma.json               PWA-manifest
manifest-ella.json               PWA-manifest
lego-saet.json          ~790 kB  20.976 sæt: nummer -> [navn, år]
ikon-{alma,ella}-{180,192,512}.png   hjemskærms-ikoner
byg-saetliste.js                 værktøj: genskaber lego-saet.json
```

### Hvordan temaet er skilt fra resten

`app.css` bruger kun **generiske** variabelnavne. Hver HTML-fil sætter
dem i sin egen `:root`. Skifter man en farve, skal man kun ind i én fil.

| Variabel | Betydning |
|---|---|
| `--c2` | primærfarve: knapper, aktiv fane, toast |
| `--c3` | lys: overskrift i velkomstkort, fokus-kant |
| `--c4` | tekstfarve på mørk bund |
| `--kant` | kantfarve på kort og inputfelter |
| `--accent` / `--accent-shadow` | gul/guld: badge, log ind, resultatboks |
| `--dark`, `--shadow`, `--panel` | bund, 3D-skygge, sidebar/topbar |
| `--welcome-bg`, `--card-bg`, `--card-solid`, `--input-bg` | flader |
| `--bg-gradient` | baggrundens gradient |
| `--tast-bg` / `--tast-tekst` / `--tast-skygge` | taltasterne — lys bund, mørk skrift |
| `--scan-bg` / `--scan-shadow` | scan-knappen (brun hos Alma, lilla hos Ella) |
| `--brik-1` … `--brik-6` | de seks klodsfarver til kort-gitteret |

Alt **indhold** ligger i `window.TEMA` i HTML-filen:

```js
window.TEMA = {
  id, navn, maskot, topIkon, undertitel,
  noegle,            // localStorage-nøgle — MÅ IKKE ÆNDRES
  maskotAnimation,   // 'bob' (Alma) eller 'float' (Ella)
  glimt,             // ✨ i hjørnet af velkomstkortet (kun Ella)
  dekor: { slags: 'blade' | 'stjerner', tegn: [...] },
  vejledningsKort: [ { farve:1-6, ikon, titel, under, url } ],
  spil:            [ { farve:1-6, ikon, titel, under, url } ]
};
```

**Vil du tilføje et spil-kort?** Én linje i `spil`-listen. Intet andet.
**Vil du lave en app til et tredje barn?** Kopiér en HTML-fil, skift
farver, `TEMA` og `noegle`, og lav et manifest. `app.css`/`app.js` røres ikke.

---

## Auto-opdatering — sådan virker det

Der er **intet versionsnummer at hæve.** To mekanismer arbejder sammen:

1. **Service workeren henter HTML/CSS/JS fra nettet først.** Cachen er
   kun faldback når der ikke er internet. Så snart siden indlæses, er
   koden den nyeste.
2. **Versionsvagten i `app.js`.** iOS genindlæser ikke en hjemskærms-app
   der bare vækkes fra baggrunden. Derfor henter appen selv
   `ETag`-hovederne for `app.js`, `app.css` og HTML-filen (HEAD-kald, få
   hundrede bytes) hver gang den kommer i forgrunden. ETag er GitHub
   Pages' eget indholds-fingeraftryk og skifter helt af sig selv ved
   hvert push. Er det ændret, vises "✨ Ny version" og siden genindlæses.

### Vigtig detalje: `cache: 'reload'`

GitHub Pages sender `Cache-Control: max-age=600`. **Uden `cache:'reload'`
i service workerens netværkskald ville browserens egen HTTP-cache kunne
udlevere den gamle fil i op til 10 minutter** — også selvom vi tror vi
henter nyt. Det er derfor `medTidsgraense()` i `sw.js` tvinger vores egne
filer helt ud på nettet. Fjern det ikke.

Fremmede filer (skrifttype, tal-læser) sendes videre som den oprindelige
`Request`, ellers ville no-cors-hentninger fejle.

### Cache-strategier i `sw.js`

| Filer | Strategi | Hvorfor |
|---|---|---|
| HTML, CSS, JS | nettet først, 6 s tidsgrænse | friskhed er det vigtigste |
| `lego-saet.json`, ikoner, manifest | cachen først + opdater i baggrunden | store og ændrer sig næsten aldrig |
| CDN (skrifttype, tesseract, sætbilleder) | cachen først | virker offline efter første gang |

Der er også en 🔄-knap nederst i sidebaren som nødudgang.

---

## Børnevenligt design — hvorfor størrelserne er som de er

Pigerne er 6 år (7 i oktober) og kan næsten ikke læse. Layoutet følger
forskningsanbefalinger for aldersgruppen, ikke almindelige voksne-mål:

| Anbefaling | Kilde | Hvad appen gør |
|---|---|---|
| Trykflader 2×2 cm, ikke 1×1 cm som til voksne | NN/G | Taltasterne er 101×104 px ≈ **1,9 cm** på iPad |
| Tekst mindst 24 pt | børne-UX-praksis | Tal 42 px, sætnavn 28 px, labels 21–22 px. Intet barnet skal læse er under 17 px |
| Ikoner 60–80 px, og de skal ligne tingen | NN/G | Klods-ikoner 56 px, maskot 64 px |
| Aldrig navigation der kræver læsning | børne-UX-praksis | Fanerne er store ikoner med ét kort ord: 📦 Byg · 🎮 Spil · ⭐ Samling |
| Højst 3–5 valg pr. skærm | børne-UX-praksis | Byg-fanen viser reelt **ét**: taltastaturet. Genvejskortene ligger under kanten |
| Øjeblikkelig, sanselig belønning frem for point | børne-UX-praksis | Konfetti, maskotten hopper, og en kort klang |

**1 cm ≈ 52 CSS-px på iPad** (132 CSS-ppi). Brug det tal hvis du skal
regne på nye elementer.

### Taltastaturet er den vigtigste ændring

En 6-årig kan ikke skrive et 4-cifret tal på et tastatur uden hjælp, og
iPad-tastaturet dækker desuden det halve af skærmen. Derfor:

- Visningen er **ikke** et `<input>` — der kan altså ikke poppe et
  tastatur op og dække tasterne.
- Tal indtastes med ti store klodser. `←` sletter ét tal ad gangen.
- Tasterne har **lys bund og mørk skrift**. Den kontrast er langt lettere
  for et barn end hvid skrift på mørk bund, og ligner et rigtigt tastatur.
- **Fysisk tastatur virker stadig** — `tastLyt()` i `app.js` lytter på
  cifre, Backspace, Enter og Escape. Pigernes iPads sidder i
  tastaturcover, så det er dét far bruger.

### Belønning

`fejrFund()` kaldes når et sæt findes: `konfetti()` (26 emoji der falder,
rene DOM-elementer — ingen bibliotek), `maskotGlad()` (maskotten hopper)
og `klangFundet()`.

Klangen laves med **WebAudio i browseren** — ingen lydfiler at hente,
virker offline. 🔊/🔇-knappen nederst i sidebaren slår den til og fra
og husker valget i `localStorage` under `<id>_lyd`.

---

## Funktioner

### Fane 1 — 📦 Byg
Stort taltastatur til venstre, resultatet til højre (stables i portræt).
Under tastaturet 📷 Scan æsken og 🔍 Lens.
Før der er søgt vises en venlig tom tilstand: 🧱 "Find tallet på din
LEGO-æske" — den viser hvad man skal gøre uden at kræve læsning.
Resultatkort med billede, navn, år og to store knapper. Plus ⭐ Gem den.
Nedenunder fire klods-genveje (mest til far).

**Én stor knap til barnet, én lille til far.** Det er ikke kosmetik — det
er svaret på at de to kilder har vidt forskellig pålidelighed:

| | Adresse | Dækning |
|---|---|---|
| 📖 **Åbn vejledningen**<br>96 px, mørk, fremhævet | `lego.brickinstructions.com/lego_instructions/set/{num}` | **35 af 35 årgange 1988-2025.** Eneste huller er 7-cifrede LEGO Education-sæt |
| 🔴 LEGO's egen vejledning (PDF)<br>52 px, stiplet, nedtonet | se nedenfor | huller **uden mønster**. LEGO skriver selv at de ikke har alle sæt |

### LEGO's to indgange

Ingen af dem er bedst i alle tilfælde, så `legoUrl(num, aar)` vælger:

| Adresse | Fordel | Ulempe |
|---|---|---|
| `/building-instructions/{num}` | går **lige til** download-siden med PDF'erne — ét tryk mindre | har LEGO ikke sættet: tom, forvirrende side, `\| # \| 0 dele, Årstal:` |
| `/building-instructions/search-results?searchString={num}&page=1` | siger ærligt "Vi kunne ikke finde nogen resultater for 6339" | koster et ekstra tryk på "Se byggevejledninger" |

**Regel: årstal ≥ 2010 → direkte, ellers søgesiden.** Årstallet bruges
KUN til at vælge mellem de to — aldrig til at skjule linket. Gætter vi
forkert, er straffen mild: ét ekstra tryk, eller en tom side på et link
der i forvejen er en fodnote.

"Se byggevejledninger" på søgesiden er en `<button>`, ikke et `<a>` —
der er altså ingen adresse at kopiere fra DOM'en. Den direkte adresse
blev fundet ved at trykke på knappen og læse `location.href` bagefter.

Bemærk også: det LEGO giver på nettet er **PDF'er**, ikke den
interaktive 3D-bygger. Den ligger kun i deres app. Derfor hedder linket
"(PDF)" og ikke "3D".

### Hvorfor ikke et årstals-filter?

Det var det oplagte: skjul LEGO-linket for gamle sæt, siden årstallet
står i databasen. Men LEGO's hjælpeside siger at samlingen går "flere
årtier tilbage" **uden** at nævne en grænse, og indrømmer huller. Et
filter ville derfor gætte forkert i begge retninger — skjule linket for
et 1995-sæt LEGO faktisk har, og vise det for et 1996-sæt de mangler.

Løsningen kræver ingen grænse: den store knap peger **altid** på det der
virker, så et barn aldrig rammer en blindgyde, og LEGO er en fodnote.
Det er også godt for en 6-årig at knappen ligger samme sted hver gang.

"📖 Byg!" i Min Samling peger også på brickinstructions.

`test-links.js` efterprøver hele grundlaget — familiens sæt, én prøve
pr. årgang, og at den gamle ødelagte adresse stadig fejler. Kør den hvis
linkene holder op med at virke.

### Fane 2 — 🎮 Spil
Seks klods-kort. Alma har Jurassic World 🦕 og LEGO City;
Ella har Disney 👸 og Friends 💗.

### Fane 3 — ⭐ Samling
localStorage under barnets egen nøgle. Hvert kort: billede, navn,
`#nummer · år`, "📖 Byg!" i fuld bredde og ✏️ / 🗑️ nedenunder.
Slet spørger først. Badge i menuen viser antal.
Virker uden internet.

**Gamle gemte sæt migreres automatisk** fra det tidligere format
(`{num, name, img, legoUrl, brickUrl}`) til det nye
(`{num, navn, aar, variant, saved}`) første gang samlingen læses.

---

## Sætopslag — nu uden API

Rebrickable-API'et er væk. Det krævede en nøgle og fejlede sporadisk.

I stedet ligger **hele sætlisten som en statisk fil** i repo'et:
`lego-saet.json`, 20.976 sæt, 790 kB rå / 225 kB gzippet af GitHub Pages.
Den hentes først når der faktisk søges, og caches derefter.
Ingen nøgle, ingen kvote, intet der kan holde op med at svare — og den
virker offline.

### Sætbilleder: to kilder, Brickset først

URL'en behøver ikke gemmes — begge kilder følger samme mønster ud fra
nummer og variant. `billedeUrler()` returnerer dem i rækkefølge, og
`billedeI()` prøver den næste hvis den første fejler. Fejler begge,
bliver 🧱 stående.

1. `https://images.brickset.com/sets/images/<nummer>-<variant>.jpg`
2. `https://cdn.rebrickable.com/media/sets/<nummer>-<variant>.jpg`

**Brickset står først fordi Rebrickables billeder er vildt svingende.**
Målt på 9 sæt (11.09.2026):

| | Interval | I alt |
|---|---|---|
| Rebrickable | 28 kB – **3.737 kB** | 7,6 MB |
| Brickset | 55 kB – 160 kB | **0,8 MB** |

9 gange mindre, og forudsigelig. Med ti nye sæt i samlingen hentede vi
før ~30 MB billeder til en iPad — og service workeren gemte dem oveni.

**Rebrickable skal blive som reserve.** Den har sæt Brickset mangler:
`2000400` (LEGO Education) giver 404 hos Brickset, men 200 hos Rebrickable.

Begge værter står i `CDN`-listen i `sw.js`, så billederne caches og
Min Samling virker offline.

Kender databasen ikke nummeret, vises "Sæt {num}" og
"Navnet kender jeg ikke — prøv linkene 🦕". Linkene virker stadig.
Man kan give sættet sit eget navn med ✏️ i Min Samling.

### Opdatering af sætlisten

```bash
node byg-saetliste.js
```

Henter Rebrickables gratis bulk-download, vælger én række pr. tal-nummer
(variant 1 vinder, ellers flest dele) og skriver `lego-saet.json`.
Commit og push — appen henter den nye fil af sig selv.

---

## Scanneren — ZXing er droppet

**Stregkoden på en LEGO-æske er en EAN-kode, og den indeholder ikke
sætnummeret.** Det var grundfejlen i den gamle scanner: den læste EAN
fint og fandt så et forkert tal. ZXing er fjernet helt.

Nu læses de **trykte tal** på æsken med OCR (tesseract.js, hentes først
når man trykker Scan). Tre ting gør det pålideligt:

1. **Kun cifre er hvidlistet.** En 13-cifret EAN-kode bliver derfor ét
   langt tal-løb, og løb udenfor 4–7 cifre sorteres fra automatisk.
2. **Hvert bud tjekkes op mod `lego-saet.json`.** Et tal der ikke findes
   som et rigtigt LEGO-sæt bliver aldrig foreslået.
3. **Buddene rangeres.** Faldgruben: på en æske fra 1992 står "1992"
   trykt som ophavsretsår — og 1992 er tilfældigvis også et gyldigt
   sætnummer. Derfor: 5–7 cifre vinder, så 4 cifre der ikke ser ud som
   et årstal, og til sidst årstals-lignende tal. Er et årstal det eneste
   bud, bruges det alligevel.

Samme tal skal ses **to gange i træk**, og så vises "Er det den her?"
med æskebilledet, navnet og store ✅ JA / ✕ Nej. Trykker barnet Nej,
huskes tallet som afvist og scanningen fortsætter.

Målt: ~1,2 s pr. billede, altså ~3 s til et resultat.

**Engangs-hentning ca. 6 MB** når Scan trykkes første gang (derefter
cachet). Stierne er pinnet i `TESS` i `app.js` — især `langPath` til
`4.0.0_fast`: uden `_fast` henter tesseract.js standard-sprogmodellen
på **10,9 MB** i stedet for den lille på 2 MB.

### 🔍 Lens-knappen er fjernet (11.09.2026)

Der sad en "🔍 Lens"-knap ved siden af Scan. Den er væk, og skal ikke
laves igen. Den åbnede blot `lens.google.com` **uden at vedhæfte et
billede**, så barnet landede på Googles cookie-samtykke-mur ("Inden du
fortsætter til Google") — en væg af juridisk tekst for en 6-årig. Og
selv derefter kan Safari ikke give Lens adgang til kameraet fra et link.

Appen har sit eget kamera med OCR, så knappen var overflødig. Scan-knappen
fik den fulde bredde i stedet — ét valg mindre.

---

## PWA / hjemskærm

Begge apps har `manifest-*.json` med `display: standalone`,
`orientation: any` og temafarver, plus:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Alma LEGO">
<link rel="apple-touch-icon" href="ikon-alma-180.png">
```

`black-translucent` gør appen helt fuldskærm. Derfor lægger `app.css`
`env(safe-area-inset-*)` som padding i sidebar, topbar, main og
overlays — og `viewport` har `viewport-fit=cover`, ellers er `env()` nul.

Ikonerne er rigtige PNG'er med maskotten på temafarvet bund og et
diskret klods-mønster. Indholdet er holdt inde i den sikre cirkel, så
`maskable` også ser rigtigt ud.

> ⚠️ **Et nyt ikon kræver at appen fjernes og tilføjes igen på
> hjemskærmen.** iOS genlæser ikke `apple-touch-icon` for en app der
> allerede ligger der. Det er en engangsting.

---

## Layout

```css
.app{
  grid-template-areas: "side top" "side main";
  grid-template-columns: 236px 1fr;   /* 216px i portræt */
  height: 100dvh;                     /* dvh, ikke vh — iOS */
}
.soege-omraade{
  grid-template-columns: 364px 1fr;   /* tastatur | resultat */
}
.brick-grid{
  grid-template-columns: repeat(auto-fill, minmax(min(100%,215px), 1fr));
  grid-auto-rows: clamp(180px, 24vh, 218px);  /* FAST højde */
}
```

- **Landskab på iPad** er standard (tastaturcover). Her står tastatur og
  resultat side om side, og hele tastaturet er synligt uden at scrolle
  (678 px af 764 px tilgængelige).
- **Portræt** (under 1040 px bredde) stabler dem: tastatur øverst,
  resultat under. Begge er synlige på én gang.
- **Under 720 px bredde** (iPhone) bliver sidebaren en **bundmenu**.
  Her skal `.nav-btn` have `width:auto; flex:1 1 0`, ellers beholder
  knapperne `width:100%` fra sidebar-layoutet, og den første fylder
  hele baren. Log ind, 🔄 og 🔊 bliver rene ikoner, og tasterne
  skrumper til 76 px.
- Alle trykflader er mindst 52 px, de fleste 76–104 px.
- `touch-action:manipulation`, `-webkit-touch-callout:none` og
  `user-select:none` på alt der trykkes på — ingen long-press-menuer
  eller utilsigtet tekstmarkering under små fingre.

---

## Hårde læringer — læs dette før du foreslår noget

### 1. iOS kan ikke åbne lokale HTML-filer
Fra **iOS 18.5** har Apple fjernet muligheden for at åbne en lokal
`.html` fil i Safari. Filer-appen, AirDrop, iMessage og `file:///`
virker alle ikke. **Kun rigtige http(s)-URL'er.** Derfor GitHub Pages.
Foreslå ikke lokale filer igen.

### 2. Repo-navnet skal matche brugernavnet præcist
Brugernavnet er **`jimmyfabe`** (ikke jimmyfalbe). Repo'et hed først
`jimmyfalbe.github.io` og gav 404 fra GitHub Pages.

### 3. Filnavnene må ikke ændres
`alma-dino.html` og `ella-prinsesse.html` ligger på pigernes hjemskærm.
Omdøbes de, dør ikonerne.

### 4. Browserens HTTP-cache er ikke det samme som service worker-cachen
Se afsnittet om `cache:'reload'` ovenfor. En `location.reload()` alene
er ikke nok til at hente en ny version inden for `max-age`.

### 5. EAN ≠ sætnummer
Se scanner-afsnittet. Det var grundfejlen i den gamle scanner.

### 6. Faste rækkehøjder i kort-gitteret
Tidligere forsøg med `flex:1` fik kortene til at strække sig i højden og
efterlade store tomme områder. `grid-auto-rows` med fast/clamp'et højde
løste det. Lav det ikke om til `auto`.

### 7. brickinstructions har skiftet adressestruktur
Den gamle `lego.brickinstructions.com/lego/bi/{num}` giver nu **HTTP 404**.
Den rigtige er `/lego_instructions/set/{num}`. Sætnavnet må gerne stå
bagefter (`/set/6339/Shuttle_Launch_Pad`), men det er **valgfrit** —
nummeret alene er nok, og et forkert navn virker også.

Testen `test-links.js` bygger adresserne med app.js' egne funktioner og
tjekker at de svarer. Kør den hvis linkene holder op med at virke igen.

### 8. LEGO.com har ikke de gamle sæt
Det er ikke en fejl i appen. `search-results?searchString=6339` svarer
korrekt "Vi kunne ikke finde nogen resultater for 6339" — LEGO har ikke
vejledningen til et sæt fra 1995. Derfor er LEGO-linket nedtonet til en
fodnote. Den gamle `?setNumber=` landede desuden bare på et tomt
søgefelt, uden at søge.

Man kan **ikke** måle LEGO's dækning ved at hente HTML'en: siden er en
SPA, og teksten "kunne ikke finde nogen resultater" står i skabelonen
uanset resultat. De rigtige resultater hentes bagefter via et
GraphQL-kald (`BuildingInstructionsSearchData`) med en persisted-query
hash der roterer. Spild ikke tid på at automatisere det — brug
brickinstructions som den pålidelige kilde i stedet.

### 9. Lokale filer kan ikke læse sætlisten
Åbner man `alma-dino.html` ved at dobbeltklikke (altså `file://`),
blokerer browseren `fetch('lego-saet.json')`. Så vises **hvert** sæt som
"Sæt 1234" uden navn — det ligner en fejl i databasen, men er det ikke.
Billedet dukker alligevel op, fordi det er en https-adresse.

Appen siger det nu ligeud: *"Åbn appen via en http-adresse — lokale
filer må ikke læse sætlisten."* Test altid via GitHub Pages eller en
lokal server, ikke ved at dobbeltklikke filen.

### 10. To apps er et VALG — foreslå ikke én app med login
Spørgsmålet kom op 11.09.2026: kunne man klare sig med én app, hvor man
skifter udseende ved at logge ind, så der er mindre at vedligeholde?

**Svaret er nej.** Vedligeholdelsen er allerede løst af opdelingen. Målt:

| | Linjer |
|---|---|
| `app.css` + `app.js` + `sw.js` — delt 100% | 1.679 |
| Linjer der afviger mellem de to skaller | 74 |
| …heraf ren tema-data | 72 |

Al logik ligger ét sted. De 72 linjer er data der **med vilje** er
forskellig (Almas grønne palet og Jurassic World, Ellas lyserøde og Disney).

Én app ville koste fire ting:

1. **Pigerne mister hver sit hjemskærms-ikon.** `apple-touch-icon`
   erklæres i HTML-hovedet, så to ikoner kræver grundlæggende to
   HTML-filer. Ét manifest = ét ikon.
2. **Et ekstra tryk hver gang** — friktion foran opgaven for en 6-årig.
3. **Risiko for at bytte samlinger.** Trykker Ella forkert, kan hun
   slette Almas sæt. Med to apps kan det ikke ske.
4. **Farverne skulle sættes af JavaScript**, hvilket giver et glimt af
   forkerte farver ved hver opstart.

Og det afgørende: **pigerne har en iPad hver.** Der er intet at skifte
mellem.

Skal de en dag dele en iPad, er svaret ikke et login, men en lille
"🔄 Skift til Ella"-knap der bare åbner den anden app.

Skallerne har desuden en god egenskab som de er: åbner du
`alma-dino.html`, står **alt om Alma i én fil**. Flyttes temaerne sammen
i delte filer, skal man kigge i to filer for at ændre én pige.

### 11. Voksne-mål er for små til en 6-årig
Første version havde 56 px trykflader og 11–15 px tekst. Det er
almindelige voksne-mål og alt for småt her. Se afsnittet om
børnevenligt design før du ændrer størrelser — og regn i cm, ikke px.

---

## Kendte sætnumre fra samlingen

Til test. Alle fem er verificeret mod `lego-saet.json`:

| Nummer | Sæt | År |
|---|---|---|
| 77241 | 2 Fast 2 Furious Honda S2000 | 2025 |
| 6008 | Royal King | 1995 |
| 4525 | Road and Rail Repair | 1994 |
| 6348 | Surveillance Squad | 1994 |
| 6075 | Wolfpack Tower | 1992 |
| 6339 | Shuttle Launch Pad | 1995 |

De gamle findes typisk kun på brickinstructions.com, ikke på lego.com.

---

## Stil og tone

- **Alt på dansk.** Også kommentarer i koden.
- Kort og konkret. Ingen lange forklaringer med mindre jeg spørger.
- Stil spørgsmål hvis noget er uklart frem for at gætte.
- Kontrollér koden inden du siger den virker.

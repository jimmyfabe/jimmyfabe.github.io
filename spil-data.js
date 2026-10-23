/* ==========================================================================
   spil-data.js — INDHOLD til klodsespillene i spil.js: klodsfarver og
   klodsstørrelser.

   Klodsfarver er indhold, ikke tema. Derfor står farvenavnene her og ikke i
   app.js/app.css, hvor reglen «nævn aldrig grøn eller lyserød» gælder temaet.

   rgb er slået op efter navn i Rebrickables colors.csv (hentet 23-10-2026):
   Red, Blue, Yellow, Green, White, Black, Orange, Bright Pink, Dark Purple,
   Reddish Brown, Light Bluish Gray, Lime. Skriv dem ikke om i hånden.

   kerne:true = de seks farver, stemmen kan sige (talen kender kun dem).
   kant       = stregen om klodsen. Kun hvid og sort har deres egen, så de
                kan ses på den mørke bund; de andre får en mørkere udgave af
                deres egen farve (spil.js).
   ========================================================================== */
window.SPILDATA = {
  FARVER: [
    { id: 'roed',      navn: 'rød',       rgb: '#C91A09', kerne: true },
    { id: 'blaa',      navn: 'blå',       rgb: '#0055BF', kerne: true },
    { id: 'gul',       navn: 'gul',       rgb: '#F2CD37', kerne: true },
    { id: 'groen',     navn: 'grøn',      rgb: '#237841', kerne: true },
    { id: 'hvid',      navn: 'hvid',      rgb: '#FFFFFF', kerne: true, kant: '#8A9096' },
    { id: 'sort',      navn: 'sort',      rgb: '#05131D', kerne: true, kant: '#5B6B78' },
    { id: 'orange',    navn: 'orange',    rgb: '#FE8A18' },
    { id: 'lyseroed',  navn: 'lyserød',   rgb: '#E4ADC8' },
    { id: 'lilla',     navn: 'lilla',     rgb: '#3F3691' },
    { id: 'brun',      navn: 'brun',      rgb: '#582A12' },
    { id: 'graa',      navn: 'grå',       rgb: '#A0A5A9' },
    { id: 'lysegroen', navn: 'lysegrøn',  rgb: '#BBE90B' }
  ],

  /* Det, en ny iPad starter med, til far har sagt, hvilke farver de har */
  STANDARD_FARVER: ['roed', 'blaa', 'gul', 'groen', 'hvid', 'sort'],

  /* b = knopper på langs, l = knopper på tværs. Tårnene bruger 2×4 og 2×2;
     1×2 er med, så «hvad har I» kan gemmes nu og bruges af modellerne senere. */
  STOERRELSER: {
    '2x4': { b: 4, l: 2 },
    '2x2': { b: 2, l: 2 },
    '1x2': { b: 2, l: 1 }
  }
};

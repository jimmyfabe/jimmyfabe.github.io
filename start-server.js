/* ==========================================================================
   start-server.js — lille lokal server til at PRØVE apperne på denne PC.

   Kør:   node start-server.js
   Åbn:   http://localhost:8080/alma-dino.html
          http://localhost:8080/ella-prinsesse.html

   HVORFOR den er nødvendig:
   Dobbeltklikker du HTML-filen, åbner den som file:// — og der blokerer
   browseren fetch() af lego-saet.json. Så vises HVERT sæt uden navn
   ("Sæt 6339"), hvilket ligner en fejl i databasen, men ikke er det.
   Billedet dukker alligevel op, fordi det er en https-adresse.
   Service workeren kan heller ikke registreres på file://.

   Serveren sender Cache-Control: no-store, så du altid ser den nyeste
   version af dine rettelser uden at skulle hard-reloade.

   Der skal ikke installeres noget — kun Node.js.
   ========================================================================== */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8080;
const ROD  = __dirname;

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.md':   'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let sti = decodeURIComponent(req.url.split('?')[0]);
  if (sti === '/') sti = '/alma-dino.html';

  /* Bliv inde i projektmappen — ingen ../../ ud i filsystemet */
  const fuld = path.join(ROD, path.normalize(sti).replace(/^([/\\])+/, ''));
  if (!fuld.startsWith(ROD)) { res.writeHead(403); res.end('nej'); return; }

  fs.readFile(fuld, (fejl, data) => {
    if (fejl) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Ikke fundet: ' + sti);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPER[path.extname(fuld).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('');
  console.log('  Serveren kører. Åbn en af disse i browseren:');
  console.log('');
  console.log('    Alma:  http://localhost:' + PORT + '/alma-dino.html');
  console.log('    Ella:  http://localhost:' + PORT + '/ella-prinsesse.html');
  console.log('');
  console.log('  Stop med Ctrl+C');
  console.log('');
});

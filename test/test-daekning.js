// Har brickinstructions vejledninger til ALLE årgange? Én prøve pr. år.
const https = require('https'), fs = require('fs');
function hent(url, hop = 0) {
  return new Promise(ok => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000 }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hop < 5) {
        r.resume();
        return hent(new URL(r.headers.location, url).href, hop + 1).then(ok);
      }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => ok({ kode: r.statusCode, krop: d }));
    });
    req.on('error', () => ok({ kode: 0, krop: '' }));
    req.on('timeout', () => { req.destroy(); ok({ kode: 0, krop: '' }); });
  });
}
function titel(k){ const a=k.indexOf('<title>'); return a<0?'':k.slice(a+7,k.indexOf('</title>',a)).trim(); }

const probe = JSON.parse(fs.readFileSync(__dirname + '/probe.json','utf8'));
(async () => {
  let har = 0, mangler = [];
  console.log('');
  for (const p of probe) {
    const r = await hent('https://lego.brickinstructions.com/lego_instructions/set/' + p.num);
    const t = titel(r.krop);
    const ok = r.kode === 200 && t.indexOf('set ' + p.num) !== -1;
    if (ok) har++; else mangler.push(p.aar + '/' + p.num);
    console.log('  ' + (ok ? 'HAR ' : 'NEJ ') + p.aar + '  ' + p.num.padEnd(8) +
                p.navn.slice(0, 30).padEnd(32) + '"' + t.slice(0, 34) + '"');
  }
  console.log('\n' + har + ' af ' + probe.length + ' årgange dækket');
  if (mangler.length) console.log('mangler: ' + mangler.join(', '));
})();

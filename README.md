# jimmyfabe.github.io

To små webapps der hjælper mine døtre med at finde byggevejledninger til
deres LEGO — både nye sæt og de gamle fra 90'erne, hvor manualerne er væk.

| App | Adresse |
|---|---|
| 🦕 Alma | <https://jimmyfabe.github.io/alma-dino.html> |
| 🦄 Ella | <https://jimmyfabe.github.io/ella-prinsesse.html> |

Rene statiske filer på GitHub Pages. Ingen build-step, ingen server,
ingen API-nøgle. Sætlisten er en statisk JSON-fil med ~21.000 sæt, så
opslag virker offline.

Apperne er bygget til to piger på 6 år, der næsten ikke kan læse:
store trykflader, ikoner frem for tekst, og alt på dansk.

## Kør lokalt

```
node start-server.js
```

→ <http://localhost:8080/alma-dino.html>

Åbn **aldrig** HTML-filen ved at dobbeltklikke. Som `file://` blokerer
browseren `fetch()` af sætlisten, og hvert sæt vises uden navn.

## Dokumentation

`CONTEXT.md` er projektets hukommelse: arkitektur, trufne beslutninger
og de fælder vi allerede er faldet i. Læs den før du ændrer noget.

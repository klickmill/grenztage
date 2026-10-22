# Grenztage

Kalender, in dem man je Tag Land und Art (Büro, Homeoffice, Reise, frei) einträgt. Eigene Grenzen zählen mit, wie viele Tage schon erreicht sind. Zählt nur, berät nicht.

Läuft unter https://klickmill.app/grenztage/ kostenlos im Browser, auf Handy und Rechner, nach dem ersten Laden auch offline. Kein Konto, keine Ortung, keine Werbung.

## Was nach außen geht

Die Einträge bleiben im Browser auf dem eigenen Gerät (localStorage). Nach außen gehen genau zwei Dinge, beide an klickmill.app: ein anonymer Nutzungszähler (App-Start und gedrückte Knöpfe, ohne Kennung, ohne Cookie; in der App abschaltbar) und Feedback, das man selbst abschickt. Sonst nichts. Die App fragt nie nach dem Standort. Einzelheiten in `datenschutz.html`.

## Aufbau

- `index.html`: Oberfläche und Ablauf, ohne Abhängigkeiten.
- `grenz.js`: Rechenkern (Datum, Zählen, Zeiträume, Tabelle schreiben und lesen), läuft im Browser und in Node.
- `test.mjs`: Prüfungen für den Rechenkern, `node test.mjs`.
- `sw.js`: Service Worker für den Offline-Betrieb. Bei jeder Dateiänderung die VERSION hochzählen.
- `aenderungen.html`: Was sich je Version geändert hat.

## Selbst betreiben

Alle Dateien in einen Ordner auf einen Webserver legen, fertig. Der Zähler ruft nur dann klickmill.app, wenn die Seite von dort geladen wurde; lokal geöffnete Kopien zählen nicht.

## Quellcode und Lizenz

https://github.com/klickmill/grenztage

MIT, siehe `LICENSE`. Impressum und Datenschutz gelten für den Betrieb unter klickmill.app.

# Mr. Phone – Admin-Panel

Lokales Werkzeug zum Pflegen der "Aktuelle Angebote"-Sektion der Website.

## Start

```
cd admin
npm install
npm start
```

Danach im Browser öffnen: http://localhost:3000

## Funktionen

- **Angebote anlegen/bearbeiten**: Formular links, Bild wird automatisch nach `images/angebote/` verkleinert (max. 1000×1000px, JPEG).
- **Aktiv/Inaktiv**: Klick auf den Status-Button in der Liste – nur aktive Angebote erscheinen auf der Website.
- **Löschen**: entfernt Eintrag und zugehöriges Bild.
- **Veröffentlichen**: Button oben rechts führt `git add`, `git commit` und `git push` im Projektordner aus und zeigt das Ergebnis unten rechts an. Danach baut GitHub Actions die Website neu und deployt sie auf GitHub Pages (dauert i. d. R. 1–2 Minuten).

## Voraussetzung

Der Rechner muss bereits bei GitHub angemeldet sein (Git Credential Manager), damit `git push` ohne manuelle Eingabe funktioniert. Beim allerersten Push kann sich ein Browser-Anmeldefenster öffnen.

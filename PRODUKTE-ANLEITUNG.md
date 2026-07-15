# Mr. Phone – Produkte & Sortiment pflegen

Kurzanleitung zum Pflegen des Bestands, der auf der Seite „Unser Sortiment" (`sortiment.html`) live angezeigt wird.

## Start

```
cd admin
npm install
npm start
```

Danach im Browser öffnen: http://localhost:3000, dort auf den Reiter **„Bestand"** wechseln.

## Funktionen

- **Gerät anlegen/bearbeiten**: Formular links. Marke, Modell und Variante werden über verkettete Dropdowns aus dem zentralen Gerätekatalog (`geraete-katalog.json`) ausgewählt – Auswahl eines Modells befüllt die Kategorie automatisch vor (bleibt überschreibbar). Für Exoten, die nicht im Katalog stehen, „Sonstige"/„Sonstiges Modell" wählen und Marke/Modell frei eintippen. Bild wird automatisch nach `images/bestand/` verkleinert (max. 1000×1000px, JPEG).
- **Aktiv/Inaktiv**: Klick auf den Status-Button in der Liste – nur aktive Geräte erscheinen im Sortiment auf der Website.
- **Löschen**: entfernt Eintrag und zugehöriges Bild.
- **Veröffentlichen**: Button oben rechts führt `git add`, `git commit` und `git push` im Projektordner aus. Danach baut GitHub Actions die Website neu und deployt sie auf GitHub Pages (dauert i. d. R. 1–2 Minuten).

## Kategorie-Auswahl

Jedes Gerät braucht eine **Kategorie** (Pflichtfeld im Formular): Smartphones, Tablets & iPads, Smartwatches, Laptops & Notebooks, PCs, Monitore, Kopfhörer & Audio, Kameras, Spielekonsolen oder Zubehör. Die Kategorie entscheidet, unter welcher Kachel auf der Startseite („Unser Sortiment") und unter welchem Filter-Chip auf `sortiment.html` das Gerät auftaucht – wählen Sie also die Kategorie, die am besten zum Gerät passt, damit Kundinnen und Kunden es beim gezielten Filtern auch finden.

## Voraussetzung

Der Rechner muss bereits bei GitHub angemeldet sein (Git Credential Manager), damit `git push` ohne manuelle Eingabe funktioniert. Beim allerersten Push kann sich ein Browser-Anmeldefenster öffnen.

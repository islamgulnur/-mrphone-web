# Bilder-TODO

## Automatische Produktbilder

Fehlende Modellbilder werden täglich kostenlos über Openverse aus Wikimedia Commons gesucht. Der
Import übernimmt ausschließlich exakte Modelltreffer mit kommerziell nutzbarer Lizenz, speichert die
Dateien lokal unter `images/produkte/` und veröffentlicht den Bildnachweis auf der Produktseite.
Unsichere Treffer (beispielsweise Plus, Pro oder Ultra statt des Basismodells) werden verworfen.

Da der POS aktuell keine Gerätefarben liefert, kennzeichnet die Website jedes Modellfoto als
Vorschaubild und weist darauf hin, dass Farbe und Ausführung vom verfügbaren Gerät abweichen können.
Ein fehlendes oder nicht mehr erreichbares Bild fällt automatisch auf den bisherigen Platzhalter
zurück. Vorhandene manuell hinterlegte Bilder werden niemals überschrieben.

Diese Dateien werden von der Website referenziert, existieren aber noch nicht. Bis sie ergänzt sind,
zeigen die betroffenen Stellen automatisch einen dezenten Platzhalter ("Bild folgt – siehe
BILDER-TODO.md") statt eines kaputten Bild-Icons.

## Team-Foto

- **Pfad:** `images/team.jpg`
- **Verwendet auf:** `index.html`, Sektion "Ihr Team auf der Zeil"
- **Empfehlung:** Querformat, mind. 1600×900px, S. & B. Zadran vor oder im Laden auf der Zeil.

## Vorher/Nachher-Galerie (Reparaturseite)

- **Ordner:** `images/vorher-nachher/`
- **Verwendet auf:** `handy-reparatur-frankfurt.html`, Sektion "Vorher & Nachher"
- **Format:** Querformat, mind. 1200×900px (4:3), Gerät jeweils aus derselben Perspektive/Distanz
  fotografiert, damit der Schieberegler-Vergleich sauber aussieht.

| Datei | Zeigt |
|---|---|
| `images/vorher-nachher/vorher-1.jpg` | Gerät mit Display-Schaden (vor der Reparatur) |
| `images/vorher-nachher/nachher-1.jpg` | Gleiches Gerät nach Displaytausch |
| `images/vorher-nachher/vorher-2.jpg` | Gerät vor Akkutausch (z. B. aufgeblähter Akku, falls fotografierbar) |
| `images/vorher-nachher/nachher-2.jpg` | Gleiches Gerät nach Akkutausch |
| `images/vorher-nachher/vorher-3.jpg` | Gerät mit Wasserschaden (vor der Reparatur) |
| `images/vorher-nachher/nachher-3.jpg` | Gleiches Gerät nach der Reparatur |

Sobald die Dateien unter den genannten Pfaden liegen, ist keine Code-Änderung nötig – die Platzhalter
verschwinden automatisch.

# Offene Punkte

Sammelstelle für Dinge, die bewusst nicht automatisch entschieden wurden und noch eine
manuelle Prüfung durch den Betreiber brauchen.

## Fehlende "1 TB"-Variante bei 3 MacBook-Air-Modellen (seit 27.07.2026)

Bei der Duplikat-Bereinigung (2 Karteikarten pro Gerät: eine mit einfacher Speicherangabe,
eine mit genauerer RAM·Speicher-Notation) wurde jeweils die genauere RAM·Speicher-Karteikarte
behalten. Die einfache Karteikarte hatte zusätzlich eine "1 TB"-Stufe, die in der behaltenen
Karteikarte fehlt. Da die genaue RAM-Zuordnung für diese Speicherstufe nicht sicher aus dem
Gedächtnis rekonstruierbar war, wurde sie bewusst **nicht** übernommen (lieber fehlend als
falsch erfunden).

Betroffen (Gerät-ID in `geraete-katalog.json` / `ankauf-preise.json`):

- **MacBook Air 13" M2** (`kat-0478`) – fehlt: 1 TB-Variante (RAM-Zuordnung unklar, vermutlich 16 GB oder 24 GB)
- **MacBook Air 13" M3** (`kat-0472`) – fehlt: 1 TB-Variante (RAM-Zuordnung unklar)
- **MacBook Air 15" M3** (`kat-0473`) – fehlt: 1 TB-Variante (RAM-Zuordnung unklar)

**To-Do:** Offizielle Apple-Konfigurationsseite/Rechnung prüfen, welche RAM-Größe(n) beim
Kauf mit 1 TB SSD verfügbar waren, dann Variante(n) über das Admin-Formular oder
`scripts/build-ankauf-preise.js`-Workflow ergänzen (Backup + `validate-data.js` beachten,
siehe `CLAUDE.md`).

## Verdächtige Speicherstufe: iPhone 8 / iPhone 8 Plus 128 GB (seit 27.07.2026)

`geraete-katalog.json` (`kat-0001`, `kat-0002`) enthält für beide Geräte eine 128 GB-Variante.
Nach Erinnerung bot Apple diese Generation (2017) offiziell nur mit 64 GB und 256 GB an -
die 128 GB-Stufe wäre demnach ein Dateneingabefehler. Nicht 100% sicher verifiziert, daher
**bewusst nicht gelöscht**, nur mit einem `"hinweis"`-Feld auf der Variante markiert
(sichtbar direkt im JSON). Bitte gegenprüfen und bei Bestätigung entweder entfernen oder den
Hinweis wieder löschen.

## Speichervarianten der Nebenmodelle nicht gegen Herstellerdaten geprüft (seit 27.07.2026)

Speichervarianten für Xiaomi/Honor/Oppo/Redmi-Submodelle, Kopfhörer, Kameras nicht gegen
Herstellerdaten geprüft - bei Bedarf einzeln verifizieren.

Kontext: Bei der Katalog-Bereinigung wurden nur echte Duplikate (Marke im `modell`-Feld
wiederholt, Supabase-Import-Artefakt) entfernt - das war maschinell/strukturell zuverlässig
erkennbar. Eine inhaltliche Prüfung "hat dieses Xiaomi/Honor/Oppo-Modell wirklich alle vom
Hersteller angebotenen Speichergrößen?" wurde bewusst NICHT gemacht, da dafür verlässliches
Herstellerwissen fehlt (anders als bei iPhone/Galaxy S+Z/iPad/MacBook, wo das Wissen solide
genug war). Betroffen: ca. 250 Geräte in Smartphones (alle Marken außer Apple/Samsung),
Smartwatches, Kopfhörer, Kameras, PCs/Monitore, Zubehör.

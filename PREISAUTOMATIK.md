# Vollautomatische Ankaufspreise

Die Preisautomatik läuft täglich über GitHub Actions. Der Heim-PC bleibt ausschließlich das
lokale Admin-System und muss für Preisupdates nicht eingeschaltet sein. Im Windows-Ruhemodus
läuft das lokale Admin-Panel nicht; das beeinflusst den Online-Preislauf jedoch nicht.

## Preisentscheidung

Für jede automatisch gepflegte Variante werden eBay-Marktwerte für Neu- und Gebrauchtware
ermittelt. Zusätzlich sucht das System bei Avatel nach exakt demselben Modell und Speicher.
Avatel wird nur verwendet, wenn genau ein Produkt passt und dessen Produktseite einen plausiblen
Neuwarepreis ausweist.

Der Zielabstand zu Avatel beträgt:

- bis 250 €: 15 € darunter
- 251–500 €: 25 € darunter
- 501–800 €: 40 € darunter
- über 800 €: 5 % darunter, höchstens 60 € Abstand

Bei sicher erkanntem Wettbewerbspreis ist der Ankaufspreis für Neuware der niedrigste Wert aus:

1. Avatel-Preis abzüglich Zielabstand,
2. echtem eBay-Neuwert mal 90 Prozent,
3. eigenem Verkaufspreis mal 88 Prozent.

Ohne eindeutigen Avatel-Treffer bleibt die bisherige, sichere Markt-/UVP-Formel aktiv. Rebuy und
Wirkaufens werden nicht automatisch als Zahlenquelle verwendet, weil ihre Elektronikpreise erst
nach mehrstufigen Zustandsfragen erscheinen und nicht verlässlich öffentlich abrufbar sind.

## Schutzregeln

- `preisQuelle: "manuell"` wird niemals verändert.
- Preissenkungen greifen sofort; Erhöhungen sind auf 10 Prozent pro Lauf begrenzt.
- Unklare Modell-, Suffix- oder Speicherzuordnungen werden verworfen.
- Unplausible Avatel-Werte unter 20 oder über 110 Prozent der Varianten-UVP werden verworfen.
- Bei Ausfall einer Konkurrenzseite bleibt die bestehende Marktformel aktiv.
- Vor Datendateiänderungen entstehen Backups; `validate-data.js` muss erfolgreich sein.
- Erst nach erfolgreicher Prüfung werden Änderungen automatisch committet und veröffentlicht.
- Der Online-Lauf führt vor jeder Preisberechnung eigene Automatiktests aus.

Die tägliche Zusammenfassung steht beim jeweiligen GitHub-Actions-Lauf. Bei einem technischen
Fehler bricht der Lauf ab und veröffentlicht keine neuen Preise.

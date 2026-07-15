# Mr. Phone – Ankaufspreise pflegen

Kurzanleitung zum Pflegen der Preise, die im Ankaufsrechner auf `handy-ankauf-frankfurt.html` angezeigt werden. Der Katalog umfasst knapp 400 Geräte – die folgenden Werkzeuge sind speziell für diese Größenordnung gebaut.

**Single Source of Truth:** Marke, Modell, Variante, Erscheinungsjahr und UVP werden zentral in `geraete-katalog.json` (Projekt-Root) gepflegt. `ankauf-preise.json` und `ankauf/*.json` werden daraus per `node scripts/build-ankauf-preise.js` generiert (Preise + `preisQuelle`). Ein neues Modell gehört also zuerst in `geraete-katalog.json` (Skript `scripts/build-geraete-katalog.js` erweitern und erneut ausführen), danach das Build-Skript laufen lassen.

## 1. Start & Veröffentlichen

```
cd admin
npm install
npm start
```

Danach im Browser öffnen: http://localhost:3000, oben auf den Umschalter **„Ankauf"** wechseln (neben „Verkauf").

- **Gerät anlegen/bearbeiten**: Formular oben – Kategorie, Marke (Freitext mit Vorschlägen aus dem Gerätekatalog), Modell, Erscheinungsjahr, UVP-Neupreis, „Beliebt"-Häkchen (pinnt das Gerät im Rechner oben an) sowie beliebig viele Varianten mit je 5 Preisfeldern (Neu & versiegelt / Wie neu / Sehr gut / Gut / Defekt). Mit „+ Variante hinzufügen" weitere Zeilen ergänzen, mit „×" eine Zeile entfernen.
- **Schnellbearbeitung (Inline-Edit)**: In der Geräteliste selbst sind die 5 Preisfelder jeder Variante direkt editierbar – Tab-Taste springt von Feld zu Feld, Speichern erfolgt automatisch beim Verlassen des Felds (blur). Kein Öffnen des großen Formulars nötig für schnelle Preiskorrekturen.
- **Suche, Kategorie-, Marken- und Preisquellen-Filter**: Oben in der Werkzeugleiste. Die Liste ist paginiert (30 Geräte pro Seite), damit auch bei 350+ Geräten alles flüssig bleibt.
- **Duplizieren**: Praktisch für ähnliche Modelle (z. B. Pro-Variante eines bereits gepflegten Geräts) – legt eine Kopie mit „(Kopie)" im Namen an.
- **Löschen**: Entfernt das Gerät dauerhaft aus dem Ankaufsrechner.
- **Veröffentlichen**: Der Button „Ankaufspreise veröffentlichen (GitHub Pages)" committet und pusht `ankauf-preise.json` **und** alle 10 Kategorie-Dateien in `ankauf/` gemeinsam, mit der Commit-Message „Ankaufspreise aktualisiert" – getrennt von Verkaufsangeboten/Bestand. GitHub Actions baut danach die Website neu (1–2 Minuten).

Der bestehende „Verkauf"-Bereich (Angebote, Bestand) funktioniert unverändert über den Umschalter „Verkauf".

## 2. Auto- vs. manuell-Preise

Jede Variante hat ein Feld `preisQuelle` mit zwei möglichen Werten, sichtbar als Badge in der Geräteliste:

- **„auto" (grau)**: Der Preis wurde automatisch aus UVP-Neupreis und Erscheinungsjahr über eine Wertverlust-Heuristik berechnet (siehe unten). Diese Preise sind **Startwerte** und müssen vor Livegang geprüft werden.
- **„manuell" (grün)**: Sie haben den Preis selbst festgelegt – entweder direkt im Formular/Inline-Edit oder über eine Massen-Anpassung. Manuelle Preise werden von keiner automatischen Berechnung mehr überschrieben.

**Button „Auto-Preise neu berechnen"** (im Bearbeiten-Formular, nur bei bestehenden Geräten sichtbar): berechnet alle Varianten mit `preisQuelle: "auto"` dieses Geräts neu, basierend auf dem aktuell eingetragenen UVP-Neupreis/Erscheinungsjahr. Varianten mit `preisQuelle: "manuell"` bleiben dabei unangetastet.

Die Berechnungs-Faktoren stehen zentral und kommentiert in `pricing-config.js` (Projekt-Root):

```js
// Marktwert = UVP × Altersfaktor × Markenfaktor
altersfaktor(jahr)     // Jahr 0: 0,80 / 1: 0,62 / 2: 0,48 / 3: 0,38 / 4: 0,30 / 5: 0,24, danach -0,04/Jahr, min. 0,08
markenfaktor(marke)    // Apple 1,15 / Samsung-Flaggschiff 1,0 / Samsung-A-Serie 0,85 / Google 0,9 / übrige 0,8

const ZUSTANDSFAKTOREN = {
  neuVersiegelt: 0.88, // 88% des Marktwerts
  wieNeu: 0.78,
  sehrGut: 0.70,
  gut: 0.58,
  defekt: 0.22,
};
```

Bei Bedarf hier anpassen – wirkt sich künftig auf jede „Auto-Preise neu berechnen"-Aktion sowie auf `node scripts/build-ankauf-preise.js` aus (nicht rückwirkend auf bereits gespeicherte Preise). Für die 30 meistgehandelten Modelle gibt es zusätzlich den Befehl **`/preise-update`**, der aktuelle Gebrauchtmarktpreise recherchiert und nur `preisQuelle:"auto"`-Einträge anpasst (siehe `.claude/commands/preise-update.md`).

## 3. Massen-Anpassung

Über den Button „Massen-Anpassung…" im Ankauf-Tab: Preise **aller aktuell gefilterten Geräte** (Kategorie-/Marken-/Preisquellen-Filter und Suche wirken als Auswahl) um einen Prozentsatz oder Eurobetrag anheben oder senken.

1. Filter oben so setzen, dass genau die gewünschten Geräte sichtbar sind (z. B. Kategorie „Smartphones" + Marke „Apple").
2. Massen-Anpassung öffnen, Richtung/Wert/Einheit wählen, „Vorschau berechnen" klicken.
3. Vorschau prüft: Anzahl betroffener Geräte/Varianten plus bis zu 10 Beispiel-Zeilen (alt → neu).
4. Erst nach Bestätigung („Änderung übernehmen") werden die Preise tatsächlich geschrieben – betroffene Varianten werden dabei automatisch auf `preisQuelle: "manuell"` gesetzt, damit eine spätere Auto-Neuberechnung sie nicht wieder überschreibt.

## 4. Empfohlene Wochenroutine

Einmal pro Woche (z. B. montags vor Ladenöffnung):

1. **Top-50-Modelle mit dem Wettbewerb vergleichen.** Prüfen Sie die meistverkauften/-angefragten Modelle (v. a. aktuelle iPhone- und Samsung-Serien, per „Beliebt"-Filter/Badge im Rechner leicht zu erkennen) bei 2–3 bekannten Ankaufsportalen.
2. **Bei Neugeräten 30–50 € darunter ansetzen**, gestaffelt nach Gerätewert:
   - Geräte unter 300 € Wettbewerbspreis: ca. **30 €** darunter ansetzen.
   - Geräte 300–700 € Wettbewerbspreis: ca. **40 €** darunter ansetzen.
   - Geräte über 700 € Wettbewerbspreis: ca. **50 €** darunter ansetzen.
   Diese Staffelung sorgt dafür, dass die Marge bei teureren Geräten (höheres Prüf- und Wiederverkaufsrisiko) etwas großzügiger bleibt, ohne bei günstigeren Modellen unattraktiv zu werden.
3. Für größere, gleichmäßige Korrekturen (z. B. „alle Kopfhörer 5 % teurer ankaufen") die **Massen-Anpassung** nutzen statt jedes Gerät einzeln zu bearbeiten.
4. Einzelne Top-Modelle bei Bedarf per **Inline-Edit** direkt in der Liste feinjustieren.
5. Änderungen mit **„Ankaufspreise veröffentlichen"** live schalten.

## 5. Wichtiger Hinweis zu den Startpreisen

**Alle automatisch berechneten Preise (`preisQuelle: "auto"`) sind Platzhalter** (siehe Kommentar im Kopf von `ankauf-preise.json`). Sie wurden aus geschätzten UVP-Neupreisen und der Wertverlust-Heuristik erzeugt und dienen nur als technischer Startpunkt für den Rechner. **Vor Livegang mindestens die Top-50-Modelle manuell prüfen** und ggf. über das Formular, Inline-Edit oder eine Massen-Anpassung korrigieren.

## 6. Kategorie-Auswahl

Jedes Gerät braucht eine **Kategorie**: Smartphones, Tablets & iPads, Smartwatches, Laptops & Notebooks, PCs, Monitore, Kopfhörer & Audio, Kameras, Spielekonsolen oder Zubehör. Die Kategorie entscheidet, unter welcher Kachel im Ankaufsrechner (Schritt 1) das Gerät erscheint. Bei PCs und Monitoren zeigt der Rechner zusätzlich automatisch den Hinweis „Endpreis nach kurzer Prüfung der Ausstattung vor Ort" im Ergebnis an.

## 7. Technischer Hintergrund: Kategorie-Dateien

Der Katalog wird **pro Kategorie in eigene Dateien gesplittet** (`ankauf/smartphones.json`, `ankauf/tablets.json`, usw.), zusätzlich zur Master-Datei `ankauf-preise.json` (Quelle der Wahrheit fürs Admin-Bearbeiten). Der Ankaufsrechner lädt beim Öffnen **nur die Kategorien-Auswahl** (keine Gerätedaten) und holt die eigentlichen Geräte erst nach, wenn eine Kategorie angeklickt wird – und dann auch nur die Datei dieser einen Kategorie.

**Warum Splitting statt Minifizieren der einen großen Datei:** Bei knapp 400 Geräten wäre eine einzelne minifizierte Datei zwar kleiner als die eingerückte Version, aber jeder Website-Besucher müsste trotzdem den kompletten Katalog laden, obwohl er nur eine von zehn Kategorien auswählt. Mit dem Split lädt z. B. ein Kunde, der nur Kopfhörer verkaufen möchte, ausschließlich `ankauf/kopfhoerer.json` (wenige KB) statt aller Geräte inklusive Smartphones, Laptops usw. Das ist gerade auf dem Smartphone (der Hauptzugriffsweg laut Zielgruppe) spürbar schneller. Admin-Server generiert die Kategorie-Dateien bei jedem Speichern automatisch aus der Master-Datei neu – Sie müssen sich darum nicht kümmern.

## Voraussetzung

Der Rechner muss bereits bei GitHub angemeldet sein (Git Credential Manager), damit `git push` ohne manuelle Eingabe funktioniert.

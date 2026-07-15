# Projektregeln – Mr. Phone Website

Verbindlich für jede Änderung in diesem Repo (statische Website + `admin/`-Panel).

## 1. Datendateien sind heilig

Betroffen: `geraete-katalog.json`, `ankauf-preise.json`, `ankauf/*.json`, `bestand.json`, `angebote.json`
(und alles Weitere unter `/data`, sollte es künftig entstehen).

- **Niemals neu generieren, kürzen oder pauschal überschreiben.** Nur gezielt ergänzen oder einzelne
  Einträge ändern. Ein Skript, das eine dieser Dateien komplett neu schreibt, darf bestehende
  `preisQuelle:"manuell"`-Einträge nie verlieren oder mit Platzhaltern ersetzen.
- **Vor jeder Änderung:** Backup anlegen (`node scripts/backup-data.js <datei>` bzw. beim Admin-Server
  passiert das automatisch über `backupIfChanged()` vor jedem Schreibvorgang). Backups liegen unter
  `backups/<dateiname>/<ISO-Timestamp>.json`.
- **Nach jeder Änderung:** `node validate-data.js` ausführen. Bei Fehlschlag (Exit-Code 1) die Änderung
  nicht committen/veröffentlichen, sondern erst reparieren.
- Beim Veröffentlichen über den Admin (`/api/publish`): Der Server vergleicht die Anzahl Einträge in der
  neuen Datei mit der zuletzt committeten Version (`git show HEAD:<datei>`). Bei einem Rückgang von mehr
  als 20 % wird der Commit verweigert, bis er explizit bestätigt wird. Diesen Schutz nicht umgehen.

## 2. Single Source of Truth: `geraete-katalog.json`

Marke, Modell, Variante, Erscheinungsjahr und UVP werden ausschließlich in `geraete-katalog.json`
gepflegt. `ankauf-preise.json`/`ankauf/*.json` werden daraus per `scripts/build-ankauf-preise.js`
generiert (Preise + `preisQuelle`). Das Admin-Produktformular (Verkauf/Bestand) und das Ankauf-Formular
lesen ihre Marken-/Modell-Vorschläge ebenfalls aus dieser Datei. **Keine neuen hartcodierten
Marken- oder Modelllisten im Code anlegen** – stattdessen `geraete-katalog.json` laden/erweitern.

Die Preisformel lebt ausschließlich in `pricing-config.js` (Altersfaktor, Markenfaktor,
Zustandsfaktoren). Änderungen an der Formel dort vornehmen, nicht in `admin/server.js` oder anderswo
duplizieren.

## 3. Prozesse

- Server-/Node-Prozesse ausschließlich per PID beenden (z. B. `taskkill /PID <pid> /F` unter Windows),
  niemals pauschal alle `node`-Prozesse killen (`taskkill /IM node.exe /F` o. Ä.) – das trifft auch
  fremde/parallele Prozesse.
- Vor jeder Abschlussmeldung einer Aufgabe: den lokalen Admin-Server (`cd admin && npm start`) starten
  und den geänderten Ablauf tatsächlich testen (Browser oder curl), nicht nur den Code lesen.

## 4. Kategorien

Die 10 Kategorien (`smartphones, tablets, smartwatches, laptops, pcs, monitore, kopfhoerer, kameras,
konsolen, zubehoer`) sind in `admin/server.js` (`KATEGORIEN`) definiert. Neue Kategorien nur dort plus
an den bekannten Duplikationsstellen (`ankauf-rechner.js`, `index.html`, `sortiment.html`) synchron
ergänzen.

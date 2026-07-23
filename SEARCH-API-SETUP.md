# Such-API-Zugang einrichten (für das automatische Ankaufspreis-Update)

Diese Anleitung brauchst du **einmalig**, damit das tägliche Preisupdate
(`.github/workflows/preise-update.yml`) echte Marktdaten von der Such-API (Serper.dev)
abrufen kann. Ohne diese Einrichtung nutzt das System automatisch Testdaten und schreibt
**keine** echten Preise – erst nach dieser Anleitung wird es scharf geschaltet.

## Schritt 1: Konto bei Serper.dev anlegen

1. Öffne im Browser: **serper.dev**
2. Klicke auf **"Sign Up"** (Registrieren) und lege ein Konto an (z. B. mit deiner
   Google- oder E-Mail-Adresse).
3. Bestätige deine E-Mail-Adresse, falls danach gefragt wird.

## Schritt 2: API-Key erzeugen

1. Melde dich nach der Registrierung im Serper-Dashboard an.
2. Auf der Startseite des Dashboards findest du direkt deinen **API Key** (bzw. unter
   einem Menüpunkt wie "API Key" / "Dashboard").
3. Kopiere den Key – behandle ihn wie ein Passwort, gib ihn an niemanden weiter.
4. **Tarif/Kontingent:** Wie viele Anfragen im Monat enthalten sind und was zusätzliche
   Anfragen kosten, ändert sich gelegentlich – schau dafür bitte direkt auf der
   Preisseite von Serper.dev nach (im Dashboard verlinkt, z. B. unter "Pricing"). Trage
   das gebuchte Monatskontingent danach in `scripts/ankaufspreis-config.js` bei der
   Konstante `API_BUDGET_MONATLICH` ein, damit die 80%-Warnung im Log stimmt.

## Schritt 3: Secret im GitHub-Repository anlegen

1. Öffne das GitHub-Repository dieser Website im Browser.
2. Klicke oben auf **"Settings"** (Einstellungen des Repositories).
3. Klicke im linken Menü auf **"Secrets and variables" → "Actions"**.
4. Klicke auf den grünen Button **"New repository secret"**.
5. Lege das Secret an:
   - Name: `SEARCH_API_KEY`
   - Secret: den **API Key** aus Schritt 2 einfügen
   - Auf **"Add secret"** klicken.
6. Fertig – das Secret sollte jetzt in der Liste stehen (der Wert selbst wird von GitHub
   nie wieder angezeigt, nur der Name).

## Schritt 4: Workflow einmal manuell testen

1. Klicke im Repository oben auf den Reiter **"Actions"**.
2. Klicke in der linken Liste auf **"Ankaufspreise automatisch aktualisieren"**
   (das ist der Workflow `preise-update.yml`).
3. Klicke rechts auf den Button **"Run workflow"**.
4. Es öffnet sich ein kleines Formular mit der Option **"Dry-Run"** – lasse sie
   beim allerersten Test auf **aktiviert (true)**, damit noch nichts wirklich
   gespeichert/committet wird.
5. Klicke auf den grünen Button **"Run workflow"**.
6. Warte ca. 1–2 Minuten, lade die Seite neu, und klicke auf den neuen Lauf in
   der Liste, um das Protokoll (Log) zu öffnen.
7. Prüfe im Log den Schritt **"Ankaufspreise aktualisieren"**: dort sollte jetzt
   "Datenquelle: search-api." stehen (nicht mehr "nutze Mock-Marktdaten") und echte
   Trefferzahlen zu sehen sein.
8. Ist alles wie erwartet, kannst du den Workflow ein zweites Mal mit
   **deaktiviertem** Dry-Run starten – dann werden die Preise wirklich
   aktualisiert und automatisch committet.

Ab jetzt läuft alles von selbst: jede Nacht automatisch (ca. 03:00 Uhr), und jederzeit
über "Run workflow" auch manuell. Im Log jedes Laufs steht außerdem, wie viel vom
Monatskontingent der Such-API bereits verbraucht ist – ab 80 % erscheint dort eine
Warnung, damit du rechtzeitig nachbuchen oder die Rotation anpassen kannst.

## Hinweis: eBay als Alternative

Der eBay-Zugang aus `EBAY-SETUP.md` bleibt im Code vollständig erhalten und ist jederzeit
reaktivierbar (z. B. mit `--quelle=ebay` bzw. indem zusätzlich `EBAY_CLIENT_ID` und
`EBAY_CLIENT_SECRET` als Secrets hinterlegt werden). Solange `SEARCH_API_KEY` gesetzt ist,
hat die Such-API automatisch Vorrang.

# eBay-Zugang einrichten (für das automatische Ankaufspreis-Update)

Diese Anleitung brauchst du **einmalig**, damit das tägliche Preisupdate
(`.github/workflows/preise-update.yml`) echte Marktdaten von eBay abrufen kann.
Ohne diese Einrichtung nutzt das System automatisch Testdaten und schreibt
**keine** echten Preise – erst nach dieser Anleitung wird es scharf geschaltet.

## Schritt 1: Kostenloses eBay-Entwicklerkonto anlegen

1. Öffne im Browser: **developer.ebay.com**
2. Klicke oben rechts auf **"Register"** (Registrieren).
3. Fülle das Formular mit deinen Daten aus und bestätige deine E-Mail-Adresse
   über den Link, den eBay dir schickt.
4. Melde dich danach mit deinem neuen Konto an.

## Schritt 2: App erstellen und Production-Keys erzeugen

1. Gehe nach der Anmeldung zu **"My Account" → "Application Keys"**
   (findest du im Menü oben oder unter developer.ebay.com/my/keys).
2. Klicke auf **"Create a keyset"** (Schlüsselpaar erstellen).
3. Gib einen beliebigen App-Namen ein, z. B. "Mr Phone Preisupdate".
4. Wähle **"Production"** (nicht "Sandbox") – nur damit bekommst du echte
   Marktdaten statt Testdaten.
5. Nach dem Erstellen siehst du zwei wichtige Werte:
   - **App ID (Client ID)**
   - **Cert ID (Client Secret)**
6. Kopiere beide Werte – du brauchst sie im nächsten Schritt. Behandle sie wie
   ein Passwort, gib sie an niemanden weiter.

## Schritt 3: Secrets im GitHub-Repository anlegen

1. Öffne das GitHub-Repository dieser Website im Browser.
2. Klicke oben auf **"Settings"** (Einstellungen des Repositories).
3. Klicke im linken Menü auf **"Secrets and variables" → "Actions"**.
4. Klicke auf den grünen Button **"New repository secret"**.
5. Lege das erste Secret an:
   - Name: `EBAY_CLIENT_ID`
   - Secret: die **App ID** aus Schritt 2 einfügen
   - Auf **"Add secret"** klicken.
6. Klicke erneut auf **"New repository secret"** und lege das zweite an:
   - Name: `EBAY_CLIENT_SECRET`
   - Secret: die **Cert ID** aus Schritt 2 einfügen
   - Auf **"Add secret"** klicken.
7. Fertig – beide Secrets sollten jetzt in der Liste stehen (die Werte selbst
   werden von GitHub nie wieder angezeigt, nur die Namen).

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
7. Prüfe im Log den Schritt **"Ankaufspreise aktualisieren"**: dort sollten
   jetzt echte eBay-Trefferzahlen stehen (nicht mehr "nutze Mock-Marktdaten").
8. Ist alles wie erwartet, kannst du den Workflow ein zweites Mal mit
   **deaktiviertem** Dry-Run starten – dann werden die Preise wirklich
   aktualisiert und automatisch committet.

Ab jetzt läuft alles von selbst: jede Nacht automatisch, und jederzeit über
"Run workflow" auch manuell.

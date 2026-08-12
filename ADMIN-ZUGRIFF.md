# Admin-Panel von unterwegs erreichen (Tailscale)

Diese Anleitung beschreibt, wie du das Admin-Panel (`admin/server.js`, läuft
normalerweise nur auf deinem Heim-PC) auch vom Laden oder unterwegs erreichst –
ohne es öffentlich ins Internet zu stellen.

**Funktionsprinzip:** Tailscale baut ein privates, verschlüsseltes Netzwerk
("Tailnet") zwischen genau den Geräten auf, die du selbst mit deinem Konto
anmeldest – Heim-PC, Laden-Laptop, Handy. Der Admin-Server läuft weiterhin nur
auf dem Heim-PC. Kein Port wird am Router freigegeben, nichts ist öffentlich
erreichbar, und seit der Umstellung unten ist er nicht mal mehr im normalen
Heim-WLAN sichtbar – nur über das Tailnet.

---

## 1. Tailscale auf dem Heim-PC einrichten (einmalig)

1. Auf **https://tailscale.com/download** gehen, "Download for Windows" wählen,
   Installer ausführen.
2. Beim ersten Start fragt Tailscale nach einem Konto zum Anmelden. Am
   einfachsten: dein bestehendes Google- oder Microsoft-Konto verwenden (kein
   neues Passwort zu merken). **Wichtig:** aktiviere für dieses Konto
   Zwei-Faktor-Authentifizierung (2FA), falls noch nicht geschehen – das ist die
   eigentliche Absicherung des Tailnets, siehe Sicherheitsfrage unten.
3. Nach der Anmeldung läuft Tailscale automatisch weiter (Symbol im
   Windows-Infobereich unten rechts, neben der Uhr). Kein weiterer Klick nötig.
4. Standard-Einstellungen lassen wie sie sind. Einzige Kontrolle: Rechtsklick
   auf das Tailscale-Symbol → dort steht der Gerätename dieses PCs (z. B.
   `desktop-islam`) – den brauchst du gleich in Schritt 3.

## 2. Tailscale auf Laden-Laptop und Handy einrichten

- **Laptop im Laden:** genau wie Schritt 1 – tailscale.com/download,
  installieren, **mit demselben Konto** anmelden (Google/Microsoft, das du auf
  dem Heim-PC gewählt hast).
- **Handy:** Tailscale-App aus dem App Store (iPhone) bzw. Google Play
  (Android) installieren, öffnen, **mit demselben Konto** anmelden.

Das war's – kein WLAN-Passwort, keine IP-Adresse eintragen, keine
Router-Einstellung. Sobald sich ein Gerät mit demselben Konto anmeldet, ist es
automatisch im selben privaten Tailnet und sieht die anderen Geräte.

Zur Kontrolle: in der Tailscale-App auf dem Handy siehst du unter "My
devices" alle drei Geräte gelistet (Heim-PC, Laden-Laptop, Handy).

## 3. Admin-Panel vom Laden aus erreichen

Damit das funktioniert, müssen **zwei Dinge auf dem Heim-PC laufen**, nicht nur
Tailscale:

1. Der Heim-PC muss an und eingeloggt sein (Tailscale läuft dann automatisch im
   Hintergrund).
2. Der Admin-Server selbst muss gestartet sein – das ist ein separater Schritt,
   Tailscale startet ihn nicht automatisch:
   ```
   cd admin
   npm start
   ```
   (Fenster offen lassen, solange du von unterwegs arbeiten willst.)

Einmalig auf dem Heim-PC (danach bleibt es bestehen, auch nach Neustart):
```
tailscale serve --bg 3000
```
Das gibt eine Adresse wie `https://desktop-islam.<dein-tailnet-name>.ts.net`
aus – diese Adresse merken oder als Lesezeichen speichern.

**Vom Laden-Laptop oder Handy aus** (Tailscale-App muss dort laufen, kein
extra Login nötig, bleibt angemeldet):
- Im Browser diese `https://...ts.net`-Adresse öffnen → landet direkt beim
  Admin-Panel, genau wie `http://localhost:3000/admin/` auf dem Heim-PC selbst.

Falls die genaue `tailscale serve`-Befehlszeile bei dir leicht abweicht (Tailscale
ändert die Syntax gelegentlich zwischen Versionen): `tailscale serve --help`
zeigt die aktuell gültigen Optionen. Mit `tailscale serve status` prüfst du,
ob die Weiterleitung aktiv ist.

## 4. Server-Konfiguration (bereits erledigt)

`admin/server.js` lief bisher ohne Host-Angabe – das ist Node.js' Standard für
"auf allen Netzwerk-Schnittstellen lauschen", also auch für jedes andere Gerät
im selben Heim-WLAN erreichbar, nicht nur für dich. Das habe ich geändert:

```js
app.listen(PORT, "127.0.0.1", () => { ... });
```

Der Server lauscht jetzt **ausschließlich auf `127.0.0.1`** (nur der PC selbst
kann ihn direkt ansprechen) – nicht mehr im Heim-WLAN sichtbar, erst recht
nicht öffentlich. `tailscale serve` (Schritt 3) ist die einzige Brücke nach
draußen, und die reicht nur ins eigene Tailnet, zu niemandem sonst.

Getestet: Server startet weiterhin normal, lokal per `http://localhost:3000/admin/`
erreichbar; `netstat` bestätigt Bindung nur auf `127.0.0.1`, nicht mehr auf
allen Interfaces.

## 5. Wenn es nicht klappt

| Symptom | Ursache | Lösung |
|---|---|---|
| Seite lädt gar nicht, "Diese Seite ist nicht erreichbar" | Heim-PC ist aus oder hat keine Internetverbindung | PC einschalten/prüfen, ein paar Sekunden warten, neu laden |
| Seite lädt nicht, PC läuft nachweislich | Admin-Server läuft nicht (Terminal-Fenster geschlossen?) | Auf dem Heim-PC `cd admin && npm start` erneut ausführen |
| Tailscale-Symbol im Infobereich fehlt / Handy zeigt Heim-PC nicht in "My devices" | Tailscale auf dem Heim-PC beendet oder abgemeldet | Tailscale-App auf dem Heim-PC öffnen, Status prüfen, ggf. neu anmelden |
| `https://...ts.net`-Adresse zeigt Zertifikatsfehler | HTTPS-Zertifikate im Tailscale-Konto nicht aktiviert | In der Tailscale-Web-Admin-Konsole (login.tailscale.com/admin) unter "DNS" → "HTTPS Certificates" aktivieren |
| Auf dem Handy: Adresse öffnet, aber "Verbindung fehlgeschlagen" | Handy ist gerade nicht mit dem Internet verbunden (Flugmodus, kein Empfang) | Mobile Daten/WLAN am Handy prüfen |

Faustregel zum Eingrenzen: erst in der Tailscale-App auf dem Handy prüfen, ob
der Heim-PC dort als "online" (grüner Punkt) angezeigt wird. Wenn ja, liegt es
am Admin-Server (Schritt 3.2). Wenn nein, liegt es am Heim-PC oder an dessen
Tailscale-Verbindung.

**Praktischer Tipp:** Wenn dir das manuelle Starten des Admin-Servers auf
Dauer zu umständlich ist, kann eine Verknüpfung/Batch-Datei auf dem
Heim-PC-Desktop das mit einem Doppelklick erledigen, oder der Server per
Windows-Aufgabenplanung automatisch beim Anmelden starten – sag Bescheid,
falls gewünscht, das ist eine kleine separate Änderung.

---

## Sicherheitsfrage: Handy verloren/gestohlen – hat der Finder Zugriff?

**Kurz: ja, wenn das Handy entsperrt ist oder die Displaysperre umgangen
wird.** Tailscale bleibt wie die meisten Apps angemeldet; sobald jemand das
Handy entsperrt hat und die `https://...ts.net`-Adresse (z. B. als
Lesezeichen gespeichert) öffnet, kommt er ohne weiteres Passwort ins
Admin-Panel – genau wie bei jeder anderen App, die dauerhaft eingeloggt bleibt.

**Was dagegen hilft, von wichtig nach optional:**

1. **Displaysperre am Handy** (PIN/Muster/Biometrie) – das ist die eigentliche
   erste Hürde. Ohne sie ist ohnehin fast jede App auf dem Handy offen, nicht
   nur diese.
2. **Sofortmaßnahme bei Verlust:** in der Tailscale-Web-Konsole
   (login.tailscale.com/admin → "Machines") das verlorene Handy in der
   Geräteliste suchen und dort **entfernen/abmelden**. Wirkt sofort, unabhängig
   vom Zustand des Handys selbst – das Gerät verliert den Tailnet-Zugriff, egal
   ob es entsperrt ist oder nicht.
3. **2FA auf dem Google-/Microsoft-Konto**, mit dem Tailscale angemeldet ist
   (siehe Schritt 1) – verhindert, dass jemand mit gestohlenem Handy zusätzlich
   ein komplett neues Gerät unter deinem Namen ins Tailnet holt.
4. **Eingebaut (13.08.2026): Login mit E-Mail + Passwort direkt auf dem
   Admin-Panel**, serverseitig geprüft (`admin/server.js`, kein Bastel-JavaScript
   im Frontend – siehe OFFENE-PUNKTE.md). Ein entsperrtes Handy allein reicht
   jetzt nicht mehr – es braucht zusätzlich E-Mail + Passwort. Einrichtung
   einmalig auf dem Heim-PC:
   ```
   cd admin
   node set-password.js
   ```
   Fragt E-Mail und Passwort ab (mind. 8 Zeichen), speichert nur einen
   Hash davon in `admin/auth-config.json` (nicht im Git-Repo). Danach den
   Admin-Server neu starten. Passwort später ändern: Script einfach erneut
   ausführen, überschreibt die alten Zugangsdaten. Abmelden über den
   "Abmelden"-Button oben rechts im Admin-Panel.

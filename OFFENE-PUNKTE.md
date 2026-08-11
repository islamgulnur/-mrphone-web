# Offene Punkte

Sammelstelle für Dinge, die bewusst nicht automatisch entschieden wurden und noch eine
manuelle Prüfung durch den Betreiber brauchen.

## NOCH OFFEN: bewertungen.json enthält nur Platzhalter-Zitate (03.08.2026)

Beim Startseiten-Design-Prototyp (`.design-preview/homepage-prototype.html`) aufgefallen:
`gesamtnote` (5,0) und `anzahlBewertungen` (490) sind echt eingetragen, aber alle 4 Einträge
unter `zitate` haben weiterhin den Platzhaltertext "Platzhalter – bitte durch ein echtes,
wörtliches 5-Sterne-Zitat aus dem Google-Profil ersetzen" (nur die Namen Michael K./Sarah B./
Ahmed T./Lena M. sind gesetzt). 5,0/5 aus 490 Bewertungen ist ein starkes Verkaufsargument, das
auf der Seite so nicht nutzbar ist, solange keine echten Wortlaute drinstehen. **To-Do:** echte,
wörtliche 5-Sterne-Zitate aus dem Google-Profil in `bewertungen.json` eintragen.

## NOCH OFFEN: angebote.json ist leer (03.08.2026)

Ebenfalls beim Design-Prototyp aufgefallen: `angebote.json` enthält aktuell ein leeres Array,
es gibt also keine laufenden Aktionen. Die reale "Aktuelle Angebote"-Sektion in `index.html`
(`#aktuelle-angebote`) steht per `hidden`-Attribut und wird vermutlich nur bei vorhandenen Daten
per JS eingeblendet – **kurz prüfen, ob das tatsächlich zuverlässig so passiert**, bzw. **To-Do**:
entweder regelmäßig echte Angebote in `angebote.json` pflegen, oder sicherstellen, dass die
Sektion bei leerem Array zuverlässig ausgeblendet bleibt statt leer sichtbar zu sein.

## NOCH OFFEN: /admin/ hat keinen Zugriffsschutz im Code (02.08.2026)

**Ausgangspunkt:** Betreiber ging davon aus, eine 5-Tap-Geste auf die E-Mail-Adresse öffne ein
Login-Formular für den Admin-Bereich. Prüfung ergab: **diese Geste existiert nicht** - weder im
aktuellen Code noch je in der Git-Historie (`git log --all -S` auf typische Bezeichner wie
"tapCount", "5 Taps", "clickTimes" ohne Treffer; `admin/public/index.html`, `admin/public/
admin.js`, `admin/server.js`, `main.js` und alle `*.html` durchsucht - kein Login-Formular, kein
Passwort-Feld, kein Session-/Auth-Check irgendwo). Nicht kaputt, nie gebaut.

**Live-Prüfung der tatsächlichen Exposition (02.08.2026):**
- `https://mrphone-web.vercel.app/admin/`, `/admin`, `/admin/index.html`, `/admin/admin.js` →
  alle HTTP 404. Zum Vergleich: `/` und `/sortiment.html` → HTTP 200 (Seite läuft normal).
- Ursache: `.github/workflows/deploy.yml` baut das GitHub-Pages-Artefakt explizit mit
  `rsync --exclude='admin' --exclude='.github' --exclude='.git' ./ _site/` - der komplette
  `admin/`-Ordner landet nie im ausgelieferten Verzeichnis. Die Vercel-Instanz zeigt live
  dasselbe Bild (ebenfalls 404), landet also offenbar auf demselben statischen Stand.
- `admin/server.js` (der Express-Prozess mit den schreibenden API-Routen) läuft nachweislich
  nur lokal auf dem Rechner des Betreibers - auf GitHub Pages/Vercel läuft kein Node-Prozess,
  nur statische Dateien. Ohne laufenden Server gibt es live keinen Schreib-Endpunkt, den jemand
  ohne Login ansprechen könnte.
- **Einordnung: aktuell kein ausnutzbares Risiko in der Praxis**, weil der Admin-Server durch
  Infrastruktur (nicht deployed) geschützt ist - nicht durch Code/Absicht. Das ist der
  entscheidende Unterschied zu einem echten Zugriffsschutz: Sobald `admin/` je aus dem
  `--exclude` fällt, versehentlich mitdeployed wird, oder eine künftige Vercel-Konfiguration den
  Node-Server doch als Funktion ausführt, ist der komplette Admin-Bereich (Preise/Bestand/
  Angebote bearbeiten, "Verkauf veröffentlichen") sofort ungeschützt erreichbar - `admin/
  server.js` selbst hat keinerlei Passwort-/Session-/Token-Prüfung, unabhängig vom Deployment.
- Nebenbefund, kein neues Risiko: `ankauf-preise.json` und `bestand.json` sind live direkt als
  JSON abrufbar (HTTP 200) - das sind aber dieselben Daten, die ohnehin öffentlich auf der Seite
  angezeigt werden (Sortiment/Ankaufsrechner), keine zusätzliche Exposition.

**Secrets-Scan im ausgelieferten Frontend-Code (02.08.2026):** komplettes Repo per
`git grep` nach API-Key-/Passwort-/Token-/Private-Key-Mustern durchsucht (getrackte Dateien) -
keine Treffer. Kein `.env` im Repo (weder getrackt noch lokal vorhanden). `backups/` ist über
`.gitignore` ausgeschlossen und kann dadurch gar nicht ins Deployment gelangen. Die eBay-
Zugangsdaten (`EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`) werden ausschließlich serverseitig über
`process.env` gelesen (`scripts/lib/search-client.js`, `scripts/update-ankaufspreise.js`),
gesetzt über verschlüsselte GitHub-Actions-Repository-Secrets (`.github/workflows/
preise-update.yml`) - korrektes Muster, taucht in keiner ausgelieferten HTML-/JS-Datei auf.

**Lösungsansatz für später (nicht Teil dieser Session - Sicherheitsfunktionen bewusst nicht
nebenbei bauen):** echter serverseitiger Schutz, sobald der Admin-Bereich live erreichbar sein
soll - z. B. eine Vercel Serverless Function mit eigener Session-/Token-Prüfung, oder Vercel
Password Protection auf Plattform-Ebene. **Nicht** ein Passwort im Frontend-JS hardcoden oder
vorausfüllen - das wäre im Quelltext für jeden Besucher lesbar und kein echter Schutz.

## GELÖST 28.07.2026: Speichervarianten-Audit (kompletter Katalog, 449 Geräte)

Systematischer Abgleich aller Speichervarianten gegen Herstellerangaben (Websuche wo nicht aus
Trainingswissen sicher). Ergebnis: 350 OK, 25 FALSCH/FEHLEND korrigiert (`scripts/korrigiere-
speichervarianten.js`, Backup vorher, `validate-data.js` danach grün), 73 UNSICHER weiter unten
gesammelt statt geraten.

**Korrigiert:**
- FALSCH entfernt: iPhone 8 + iPhone 8 Plus (128 GB existierte offiziell nie, nur 64/256 GB),
  Xiaomi Pad 7 (512 GB existiert nur beim Pro-Modell, nicht beim Standard-Pad 7).
- FEHLEND ergänzt (22 Varianten, u. a. Galaxy A15/A33 256GB, Xiaomi 13T/15T Pro 1TB, Redmi
  Note 13 Pro 128GB, Nothing Phone (2) 128GB, Oppo Reno 12 Pro 256GB, iPad Air 7 1TB, Galaxy
  Tab S7 256/512GB, Xbox Series X 2TB Special Edition, Steam Deck LCD 64GB/OLED 256GB) sowie
  Apple TV 4K von einer Pauschal-"Standard"-Variante auf die 2 echten Herstellerstufen (64GB
  Wi-Fi / 128GB Wi-Fi+Ethernet) umgestellt.
- Neue Varianten bekamen einen Ankaufspreis über die bestehende Bootstrap-Formel
  (`pricing.berechnePreise()`, inkl. der neuen neuVersiegelt-Logik von oben), genau wie jeder
  neue Katalogeintrag. **uvpDelta-Werte für die neuen Varianten sind mangels recherchierter
  offizieller Preislisten plausible Schätzungen** (grob am UVP-Niveau des Geräts orientiert,
  nicht einzeln verifiziert) - beeinflusst nur den geschätzten Wiederverkaufswert dieser einen
  neuen Variante, keine bestehenden Preise. Bei Bedarf über das Admin-Preisformular feinjustieren.

**Bewusst NICHT verifiziert (73 Geräte/Modellreihen, nicht geraten):**

*Smartphones:*
- Xiaomi 12/13/14/15/17 Ultra (kat-0116, kat-0117, kat-0119, kat-0121, kat-0124), 14T (kat-0409), 13T (kat-0416)
- Redmi Note 11/12/14/14 Pro/15 Pro/15 Pro+/14C/15C (kat-0125–0134, außer bereits korrigiertes kat-0128), sowie kat-0411, kat-0417, kat-0418
- Poco X7 Pro/F6 Pro/F7 Pro (kat-0136–0138), Poco F6 (kat-0413)
- Honor Magic 5 Pro/Magic 7 Pro (kat-0176, kat-0178, kat-0441), Honor 90/200 Pro (kat-0179, kat-0180)
- Oppo Find X5 Pro/Reno 10 Pro (kat-0173, kat-0174), Reno 12/Reno 11 (kat-0452, kat-0453)
- Huawei P30/P30 Pro/P40 Pro/P50 Pro/P60 Pro/Mate 20 Pro/Mate 40 Pro (kat-0148–0154)
- Nothing Phone (1)/Phone (2a)/Phone (3)/Phone (3a) (kat-0165, kat-0167, kat-0168, kat-0434)
- Motorola Edge 40/Edge 50 Pro/Razr 50 Ultra/Razr 60 Ultra/Edge 50 Ultra/Razr 50/Moto G34/Moto G84 (kat-0169–0172, kat-0425, kat-0428, kat-0429, kat-0431)
- Sony Xperia 1 V/VI/VII, 5 IV/V, 10 V/VI/VII (kat-0157–0164)

*Tablets:* Xiaomi Pad 6 (kat-0226), Lenovo Tab P12 (kat-0228)

*Laptops:* Apple MacBook Air 13"/15" M4 (kat-0470, kat-0471), M3 (kat-0472, kat-0473), M2 (kat-0478), M1 (kat-0479); MacBook Pro 14" M4/M4 Pro, 16" M4 Pro (kat-0474–kat-0476), 14" M3 (kat-0477) - RAM/Storage-Kombinationen nicht eindeutig als offizielle Standard-SKU vs. Build-to-Order verifizierbar.

*PCs:* Apple iMac 24" M1/M3/M4 (kat-0301–kat-0303) - **Hinweis:** ursprünglich als FEHLEND
eingestuft ("mehrere SSD-Stufen, Katalog bildet nur eine Pauschal-Variante ab"), aber laut
Audit-Methodik nicht einzeln web-verifiziert, nur aus Trainingswissen vermutet - deshalb hier
bei UNSICHER statt bei den oben korrigierten FEHLEND-Fällen, um nichts zu erfinden.

*Konsolen:* Xbox One (kat-0373), Xbox One S (kat-0374) - hatten historisch mehrere Speicher-SKUs, unklar ob "Standard" nur die Launch-Version abbildet.

**To-Do:** Bei Bedarf gezielt per Websuche oder Herstellerbeleg nachprüfen und über das Admin-
Formular/`geraete-katalog.json` ergänzen (Backup + `validate-data.js` beachten).

## GELÖST 28.07.2026: neuVersiegelt-Formel grundlegend ersetzt (Vorfall 27.07.2026)

Ursprünglicher Befund (27.07.2026): Apple-Korrektur (×1,40) wurde einmalig direkt auf
gespeicherte Endpreise multipliziert (Commit `7db19a9`) und hob `neuVersiegelt` über
`marktwertNeu` (iPhone 17 Pro Max 512GB: 1555 € Ankauf vs. ~1400 € eBay-Neu). Ein erster Fix
(Konsistenzregel 3, harte Deckelung auf `marktwertNeu`) reduzierte das Problem, war aber laut
Betreiber-Realdaten (28.07.2026) immer noch nicht scharf genug: iPhone 17 Pro Max 512GB kaufte
mit 1400 € weiterhin ÜBER dem eigenen Verkaufspreis (1299 €) UND über dem Niveau von Avatel
(1250 €)/Zoxs (1200 €) ein.

**Grundlegend neue Formel seit 28.07.2026** (`pricing.berechneNeuVersiegelt()`, siehe
`pricing-config.js`): `neuVersiegelt` = der NIEDRIGERE von zwei unabhängigen Ankern -
eigener Verkaufspreis (`bestand.json`) × 0,88, ODER `marktwertNeu` × 0,82 (hart gedeckelt auf
90 % von `marktwertNeu`). Ersetzt die alte Konsistenzregel 3 für diese Stufe vollständig
(strukturell sicher statt nachträglich gedeckelt) und läuft nicht mehr durch Wettbewerbs-
Abstand/Markenkorrektur/Tagesbremse - siehe Regel 9 in `scripts/update-ankaufspreise.js`.

**Live-Lauf 28.07.2026** (`node scripts/migriere-neuversiegelt-formel.js`, ohne neue
eBay-Anfragen - nutzt vorhandene echte `marktwertNeu`-Werte + `bestand.json` +
NEUWARE_AUFSCHLAG-Schätzung als Fallback): 595 von 824 Varianten mit `neuVersiegelt`-Preis
geändert, alle 449 Geräte durchlaufen, `validate-data.js` grün. Stichprobe: iPhone 17 Pro Max
512GB 1400€→1140€ (< 1299€ eigener VK, < 1260€ = 90% von 1400€), iPhone 16 Pro Max 256GB
820€→670€, Galaxy S25 Ultra 256GB 410€→470€, Galaxy S26 Ultra 512GB 630€→1240€ (behebt auch die
zuvor falsche Reihenfolge 256GB > 512GB). Nachträglich script-übergreifend verifiziert: alle 824
Geräte mit `neuVersiegelt`-Preis liegen innerhalb beider Grenzen, keine Ausnahme.

**Bekannte Einschränkung (nicht neu, aber jetzt relevanter):** für Varianten ohne eigenen
uvpDelta=0 (z. B. 512GB/1TB) wird `marktwertNeu` proportional aus der Basis-Variante skaliert
(`ermittleWiederverkaufswerte` in `pricing-config.js`) - eine Näherung, die bei nicht-linearer
Speicher-Preisstaffelung daneben liegen kann. Für iPhone 17 Pro Max 512GB wurde deshalb der vom
Betreiber verifizierte reale Wert (1400 €) manuell in `scripts/migriere-neuversiegelt-formel.js`
(`BEKANNTE_MARKTANKER_NEU`) hinterlegt, da die Skalierung nur ~1204 € ergeben hätte. Weitere
Geräte mit bekannt-echtem Preis dort ergänzen, sobald verfügbar.

**Bekannte Einschränkung 2:** 12 Geräte haben ein explizites `marktwertNeu: null` im Katalog
(von einem echten Marktlauf als "nicht mehr versiegelt gehandelt" erkannt, u. a. iPhone 16,
iPhone 13, iPad Air 4) - die Migration behandelt das wie "kein echter Wert vorhanden" und nutzt
stattdessen die NEUWARE_AUFSCHLAG-Schätzung (sicher, da weiterhin gedeckelt, aber ggf. nicht
mehr zutreffend, falls diese Geräte tatsächlich nicht mehr versiegelt verkauft werden). Da
mehrere dieser Geräte (z. B. iPhone 16) verdächtig aktuell/populär für "nicht mehr versiegelt
gehandelt" wirken, vermutlich Artefakt der alten eBay-NEW-Abfrage vor dem "NEW-Abfrage-Fix"
(Commit `7db19a9`) - sollte sich beim nächsten echten Marktlauf dieser Geräte klären.

## GELÖST 28.07.2026: Drei Leitplanken gegen zu teure Nicht-Apple-Neu-Ankaufspreise

Befund: `marktAnkerNeu` (echter eBay-Marktwert oder Schätzung) hatte keinen Bezug zur eigenen
UVP, wodurch kontaminierte Scraper-Treffer (Bundles, falsche Varianten, Sammlerpreise)
ungebremst in `neuVersiegelt` liefen - z. B. Sony DualSense Controller UVP 69 €, `marktwertNeu`
496 € → Ankaufspreis 405 € (das 5,9-fache der UVP). Betraf primär, aber nicht ausschließlich,
Nicht-Apple-Geräte (auch iPad 11, Apple Watch Series 4/8, MacBook Pro 14" M4 waren betroffen).

**Drei markenunabhängige Leitplanken** (`pricing-config.js`, `berechneNeuVersiegelt()` +
`pruefeMarktwertNeuPlausibilitaet()`, siehe dortige Kommentare):
1. Anker nie über 100 % UVP der Variante.
2. Roher `marktwertNeu` > 115 % UVP gilt als kontaminiert und wird verworfen (greift sowohl bei
   gespeicherten Katalogwerten als auch live in `scripts/update-ankaufspreise.js`).
3. Reine Schätz-Anker ohne echten Marktlauf (`marktwertQuelle: "geschaetzt"`) zusätzlich auf
   85 % UVP gedeckelt.

Bewusst KEINE Markenausnahme für Apple - das wäre exakt die Sonderlogik (Apple-Korrektur/
Samsung-Faktor), die am 28.07.2026 an anderer Stelle bereits entfernt wurde.

**Umgesetzt:** `pricing-config.js` + `scripts/update-ankaufspreise.js` (Commit `668e964`),
`bestand.json` um reale Verkaufspreise Galaxy S26 Ultra 256GB (849 €)/512GB (999,99 €)/1TB
(1.100 €) ergänzt (Regel 1 greift dort, wo der Marktanker allein nicht ausreicht). Danach
`neuVersiegelt` für alle 449 Katalog-Geräte über `pricing.berechnePreise()` neu berechnet (ohne
neue eBay-Anfragen, aus bereits vorhandenen echten Marktdaten - 252 von 844 Varianten geändert,
0 Inversionen mehr: keine kleinere Speichergröße kauft mehr als eine größere).

### NOCH OFFEN: 43 Modell/Varianten-Paare mit Speichergrößen-Inversion in den Gebraucht-Stufen

Bei der Inversionsprüfung oben (nur `neuVersiegelt`) fielen zusätzlich 43 Modell/Varianten-Paare
auf, bei denen die 4 Gebraucht-Stufen (`wieNeu`/`sehrGut`/`gut`/`defekt`) - **unverändert seit
vor dieser Session** - dasselbe Muster zeigen: kleinere Speichergröße kauft mehr als größere,
u. a. Galaxy S26 Ultra 256GB `wieNeu` 870 € > 512GB nur 490 €, plus iPhone 14/16/17 Pro(Max),
mehrere iPads, mehrere MacBook Pro/Air-Konfigurationen, diverse Samsung/Xiaomi/Sony-Modelle.
Ursache vermutlich Tagesbremse-Drift (±10 %/Tag-Deckelung über viele Läufe hinweg, nie
synchron zwischen Varianten). **Eigenes Thema, separat angehen - NICHT mit dem neuVersiegelt-Fix
vermischen** (eine volle Neuberechnung dieser Stufen würde die Tagesbremse umgehen und hätte
einen viel größeren, ungeprüften Nebeneffekt - siehe Beispiele unten, teils >1.000 € Sprung bei
unbeteiligten Geräten).

Vollständige Liste (Marke/Modell | kleinere vs. größere Variante | betroffene Stufen mit
Werten):

- Apple iPhone 12 | 64 GB vs 128 GB | gut: 90→85
- Apple iPhone SE 2022 | 128 GB vs 256 GB | wieNeu: 120→105, sehrGut: 110→90, gut: 90→75, defekt: 35→25
- Apple iPhone 14 Pro | 512 GB vs 1 TB | wieNeu: 430→425, sehrGut: 385→380, gut: 315→300, defekt: 115→105
- Apple iPhone 14 Pro Max | 512 GB vs 1 TB | wieNeu: 475→450, sehrGut: 425→400, gut: 340→315, defekt: 125→115
- Apple iPhone 16 Pro | 512 GB vs 1 TB | wieNeu: 720→660, sehrGut: 705→660
- Apple iPhone 16 Pro Max | 512 GB vs 1 TB | wieNeu: 770→730
- Apple iPhone 17 Pro | 256 GB vs 512 GB | wieNeu: 940→860
- Apple iPhone 17 Pro | 512 GB vs 1 TB | wieNeu: 860→760, sehrGut: 860→760
- Apple iPhone 17 Pro Max | 256 GB vs 512 GB | wieNeu: 940→770, sehrGut: 845→770
- Samsung Galaxy S20+ | 128 GB vs 512 GB | sehrGut: 85→80, gut: 70→60, defekt: 25→20
- Samsung Galaxy S21 FE | 128 GB vs 256 GB | wieNeu: 90→85, gut: 70→65
- Samsung Galaxy S22 Ultra | 512 GB vs 1 TB | wieNeu: 350→195, sehrGut: 315→170, gut: 255→150, defekt: 95→50
- Samsung Galaxy S24 Ultra | 512 GB vs 1 TB | wieNeu: 495→390, sehrGut: 485→350, gut: 390→280, defekt: 145→95
- Samsung Galaxy S25 FE | 128 GB vs 256 GB | wieNeu: 215→200, sehrGut: 190→180, gut: 150→145, defekt: 60→55
- Samsung Galaxy S26 | 256 GB vs 512 GB | wieNeu: 540→485, sehrGut: 490→445, gut: 395→350, defekt: 145→125
- Samsung Galaxy S26 Ultra | 256 GB vs 512 GB | wieNeu: 870→490, sehrGut: 790→440, gut: 640→360, defekt: 230→125
- Samsung Galaxy Note 9 | 128 GB vs 512 GB | wieNeu: 80→25, sehrGut: 75→25, gut: 65→25
- Samsung Galaxy Z Flip 6 | 256 GB vs 512 GB | wieNeu: 205→190, sehrGut: 185→170, gut: 160→145, defekt: 55→50
- Samsung Galaxy Z Flip 7 | 256 GB vs 512 GB | wieNeu: 220→195, sehrGut: 195→175, gut: 160→150, defekt: 60→55
- Samsung Galaxy Z Fold 7 | 256 GB vs 512 GB | wieNeu: 510→470, sehrGut: 455→420, gut: 370→340, defekt: 130→115
- Google Pixel 8 Pro | 256 GB vs 512 GB | wieNeu: 305→265, sehrGut: 280→235, gut: 225→195, defekt: 80→70
- Xiaomi 13T Pro | 512 GB vs 1 TB | wieNeu: 190→185, sehrGut: 175→170, gut: 140→135
- Redmi Note 13 Pro | 128 GB vs 256 GB | defekt: 25→20
- OnePlus 9 Pro | 128 GB vs 256 GB | wieNeu: 125→120, sehrGut: 115→110, defekt: 35→30
- OnePlus 10 Pro | 128 GB vs 256 GB | wieNeu: 150→120, sehrGut: 130→110, gut: 110→95, defekt: 40→35
- Sony Xperia 1 VI | 256 GB vs 512 GB | wieNeu: 570→460, sehrGut: 515→415, gut: 415→335, defekt: 145→120
- Nothing Phone (2) | 128 GB vs 256 GB | gut: 125→115
- Honor 90 | 256 GB vs 512 GB | wieNeu: 125→115, sehrGut: 110→100, defekt: 35→30
- Apple iPad Mini 5 (2019) | 64 GB vs 256 GB | wieNeu: 100→85, sehrGut: 90→75, gut: 75→60
- Apple iPad Pro 11" Gen 2 (2020) | 128 GB vs 256 GB | wieNeu: 335→180, sehrGut: 300→160, gut: 235→130, defekt: 90→50
- Apple iPad Pro 11" Gen 3 (2021) | 256 GB vs 512 GB | wieNeu: 305→265, sehrGut: 270→240, gut: 215→195, defekt: 80→70
- Apple iPad Pro 12.9" Gen 5 (2021) | 128 GB vs 256 GB | wieNeu: 390→370, sehrGut: 350→335, gut: 275→260, defekt: 100→95
- Apple iPad Pro 12.9" Gen 5 (2021) | 256 GB vs 512 GB | wieNeu: 370→310, sehrGut: 335→280, gut: 260→225, defekt: 95→85
- Samsung Galaxy Tab S11+ | 256 GB vs 512 GB | wieNeu: 670→625, sehrGut: 600→565, gut: 475→460, defekt: 170→165
- Xiaomi Pad 6 | 128 GB vs 256 GB | wieNeu: 130→115, sehrGut: 115→100, gut: 95→85, defekt: 35→30
- Xiaomi Redmi Note 13 Pro | 128 GB vs 256 GB | wieNeu: 95→90, sehrGut: 90→85, gut: 70→65
- Huawei Mate X3 | 256 GB vs 512 GB | wieNeu: 455→440, sehrGut: 415→395, gut: 335→310, defekt: 120→110
- Fairphone 4 | 128 GB vs 256 GB | wieNeu: 220→190, sehrGut: 200→175, gut: 170→145, defekt: 60→50
- Apple MacBook Air 15" M3 | 16GB·512GB vs 24GB·512GB | wieNeu: 930→840, sehrGut: 840→760, gut: 665→615, defekt: 240→225
- Apple MacBook Pro 14" M4 | 24GB·1TB vs 32GB·1TB | wieNeu: 2145→1075, sehrGut: 1975→975, gut: 1580→785, defekt: 545→285
- Apple MacBook Pro 14" M4 Pro | 24GB·1TB vs 48GB·1TB | wieNeu: 2145→1280, sehrGut: 1975→1160, gut: 1580→940, defekt: 545→340
- Apple MacBook Pro 16" M4 Pro | 24GB·512GB vs 48GB·512GB | wieNeu: 1605→1525, sehrGut: 1465→1385, gut: 1170→1120
- Apple MacBook Air 13" M1 | 8GB·512GB vs 16GB·256GB | wieNeu: 330→315, sehrGut: 295→280, gut: 230→225

### NOCH OFFEN: Nicht-Basis-Varianten bekommen keine echten Live-Marktdaten für marktwertNeu

Beim Live-Lauf 28.07.2026 für DualSense/Xbox Series X/Galaxy Tab S9 Ultra/Galaxy S26 Ultra
(`--nur`, siehe Commit `838a37c` + `6dc30ef`) aufgefallen: `scripts/update-ankaufspreise.js`
sucht `marktwertNeu` live PRO VARIANTE (jede Speichergröße bekommt eine eigene eBay-Abfrage),
aber `katalogUpdates.set(geraet.id, ergebnis.marktwerte)` greift nur `if (variante.uvpDelta ===
0)` (siehe Zeile ~510) - der frische, präzise Wert wird also nur für die Basis-Variante
dauerhaft in `geraete-katalog.json` gespeichert. Für alle anderen Varianten (Xbox 2TB, Galaxy
S26 Ultra 512GB, Galaxy Tab S9 Ultra 1TB u.v.m.) wird ihr frischer Live-Wert nach diesem einen
Lauf verworfen, und `pricing.ermittleWiederverkaufswerte()` skaliert stattdessen weiterhin nur
den gespeicherten Basis-Wert proportional über `uvpDelta` hoch - eine Näherung, die bei
nicht-linearer Speicher-Preisstaffelung spürbar daneben liegen kann (dieselbe, bereits am
28.07.2026 an anderer Stelle dokumentierte Einschränkung, siehe oben "Bekannte Einschränkung").

Konkret beobachtete Abweichung zwischen dem, was der Live-Lauf selbst für die jeweilige
Variante berechnete, und dem, was nach der anschließenden `neuVersiegelt`-Regenerierung
(skaliert aus der Basis-Variante) final gespeichert wurde:
- Xbox Series X 2TB: Live-Lauf 510 € vs. final gespeichert 595 €
- Galaxy S26 Ultra 512GB: Live-Lauf 825 € vs. final gespeichert 875 €
- Galaxy Tab S9 Ultra 1TB: Live-Lauf 940 € vs. final gespeichert 780 €

Beide Seiten bleiben innerhalb der drei Leitplanken (nie über UVP, nie kontaminiert) - keine
Sicherheitsverletzung, nur ein Präzisionsverlust. **Eigenes Thema, separat angehen - nicht Teil
des heutigen Leitplanken-Fixes.** Möglicher Lösungsansatz für später: `marktwertNeu` (und
`marktwertGebraucht`) pro Variante statt nur pro Basis-Variante in `geraete-katalog.json`
speichern (Schema-Erweiterung nötig, betrifft `scripts/update-ankaufspreise.js`,
`pricing-config.js` `ermittleWiederverkaufswerte()`, ggf. `geraete-katalog.json`-Struktur).

## Samsung-Markenkorrektur (Faktor 0,78) eingeführt - noch nicht auf alle Samsung-Geräte
## rückwirkend angewendet (seit 27.07.2026)

`markenKorrekturFaktor()` (`scripts/ankaufspreis-config.js`, vormals `appleKorrekturFaktor`)
wendet jetzt auch für Samsung einen flachen Korrekturfaktor 0,78 an (kalibriert an 1 realem
Referenzpunkt: Galaxy S24 256GB "Gut" 210€ vs. rebuy 206€/zoxs 223€ -> 165€, 41€ unter rebuy).
Rückwirkend korrigiert wurden nur die beiden Geräte, die bereits echte Marktdaten hatten und
für die Kalibrierung genutzt wurden: **Galaxy S24** (`kat-0059`, beide Varianten) und
**Galaxy S23 FE** (`kat-0058`, beide Varianten).

**Alle anderen Samsung-Geräte** (S23/S23+/S23 Ultra, S24+/S24 Ultra, S22, S21, Z Fold/Flip,
A-Serie, …) zeigen bis zu ihrem nächsten regulären Marktlauf (Rotation bzw. `beliebt`-Flag,
siehe `scripts/update-ankaufspreise.js`) weiterhin die alten, unkorrigierten Preise - der neue
Faktor greift automatisch, sobald sie an der Reihe sind. **Galaxy S23** insbesondere läuft noch
auf der alten Schätzformel (`marktwertQuelle: "geschaetzt"`, kein `marktwertNeu`) und bekommt
den Faktor erst nach seinem ersten echten Marktlauf zu sehen.

**To-Do (optional, bei Bedarf):** Falls die Korrektur nicht bis zur nächsten Rotation warten
soll, gezielten Re-Run für die verbleibenden Samsung-Geräte fahren, sobald echter eBay-Zugang
verfügbar ist. Nur EIN Kalibrierpunkt vorhanden - bei weiteren rebuy/zoxs-Referenzpreisen
(insbesondere ältere Baujahre wie S22/S21) ggf. auf eine Baujahr-Staffelung wie bei Apple
umstellen.

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

(Die früheren Einträge "Verdächtige Speicherstufe iPhone 8/8 Plus" und "Speichervarianten der
Nebenmodelle nicht geprüft" sind durch den Speichervarianten-Audit vom 28.07.2026 oben
aufgelöst: iPhone 8/8 Plus 128GB wurde entfernt, die verbleibenden ungeprüften Nebenmodelle
sind jetzt einzeln unter "Bewusst NICHT verifiziert" gelistet statt pauschal als "~250 Geräte".)

## NOCH OFFEN: UVP-basierte Ankaufsformel nur für kategorie "smartphones" kalibriert (06.08.2026)

Ankaufspreise waren gegenüber Avatel ungleichmäßig (Apple oft zu niedrig, Samsung S26-Serie
deutlich zu hoch, weil die Samsung-Neuwerte über eine unverifizierte Schätzformel liefen statt
über echte Marktdaten). Neu kalibriert anhand 5 echter Avatel-Vergleichspreise (siehe
`pricing-config.js`, Kommentar über `ANKAUF_UVP_PROZENT_NEU`): `neuVersiegelt` hängt jetzt NUR
für `kategorie: "smartphones"` an einem UVP-Prozentsatz (Apple 71%, Rest 50%), mit echtem
eBay-Marktwert als Korrektiv nach unten (verhindert, dass alte, stark abgewertete Geräte am
UVP-Prozentsatz kleben bleiben). `wieNeu`/`sehrGut`/`gut` leiten sich daraus ab (Prozentsatz vom
neuen `neuVersiegelt`-Wert statt vom eBay-Gebraucht-Marktwert). `defekt` bewusst unverändert.

**To-Do:** Tablets, Laptops, PCs, Smartwatches, Kopfhörer, Kameras, Konsolen, Zubehör
(232 von 449 Geräten) bleiben bewusst auf der alten, rein eBay-basierten Formel
(`berechneNeuVersiegelt()`), weil dafür keine eigenen Referenz-Vergleichspreise vorliegen. Sobald
für eine dieser Kategorien eigene Wettbewerbs-Referenzwerte geliefert werden, kann sie nach
demselben Muster (Prozentsatz von UVP, kalibriert, `istUvpBasierteKategorie()` erweitern) auf die
neue Formel umgestellt werden.

## NOCH OFFEN: Kameras/Monitore aus Ankaufsrechner entfernt, Datenbasis bleibt (06.08.2026)

Auf Wunsch des Betreibers (kauft diese Kategorien praktisch nie an) sind "kameras" und
"monitore" aus den `KATEGORIEN`-Kacheln in `ankauf-rechner.js` entfernt (DE+EN). Bewusst NICHT
angefasst: `geraete-katalog.json`, `ankauf-preise.json`, `ankauf/kameras.json`,
`ankauf/monitore.json`, `admin/server.js` – Kategorien bleiben für Sortiment/Verkauf
(`sortiment.html`, `kameras-frankfurt.html`) vollständig erhalten, es fehlen nur die
Ankaufsrechner-Kacheln. Reversibel: die 4 entfernten Zeilen (2× kameras, 2× monitore) wieder
einfügen. Der nächtliche eBay-Marktlauf läuft für diese 39 Geräte unverändert weiter (nicht
gestoppt) – **To-Do, falls gewünscht:** in `scripts/update-ankaufspreise.js`/Rotation aus dem Lauf
ausschließen, um API-Budget zu sparen.

## NOCH OFFEN: Galaxy Tab S11 256GB, neuVersiegelt knapp unter wieNeu (06.08.2026)

Nebeneffekt der Kontaminations-Bereinigung (siehe unten): ohne den verworfenen 993€-Wert läuft
`neuVersiegelt` jetzt über die alte Schätzformel (85%-UVP-Deckel) und landet bei 695€, knapp unter
dem unabhängig berechneten `wieNeu` (720€) - dieselbe Bug-Klasse wie die 13 Smartphone-Fälle, die
durch die neue UVP-Formel automatisch verschwunden sind (siehe Eintrag oben), hier aber noch nicht
behoben, weil Tablets bewusst auf der alten Formel bleiben. Finanziell unkritisch (Konsistenzregel 1
- nie über eigenem Wiederverkaufswert - hält, geprüft: 0 Verstöße), nur eine Anzeige-Inkonsistenz.
**To-Do:** mit erledigt sich vermutlich von selbst, sobald Tab S11 einen neuen echten eBay-Neu-Lauf
hat (Rotation) oder Tablets auf die neue Formel umgestellt werden (siehe Eintrag oben).

## Erledigt: kontaminierte marktwertNeu-Werte verworfen (06.08.2026)

Duplikat-Scan (identischer `marktwertNeu`-Wert bei ≥2 verschiedenen Modellen, jeweils ≥80% der
eigenen UVP – Muster für Scraper-/Bundle-Kontamination) fand 5 Fälle. `marktwertNeu` bei diesen
7 Geräte-Varianten auf `null` gesetzt (`marktwertQuelle: "kontaminiert-verworfen-06.08.2026"`),
laufen jetzt über UVP-Basis bzw. Schätzformel statt über den kontaminierten Wert:
- Galaxy Z Fold 5 1TB & Galaxy Z Fold 7 1TB (beide 2344€)
- iPhone 15 Pro 1TB & iPhone 15 Pro Max 1TB (beide 1565€)
- Galaxy Tab S11 256GB & Tab S11+ 256GB (beide 993€)
- Pixel 9 Pro Fold 512GB (2147€, kein Duplikat, aber über UVP-Variante – für sich genommen unplausibel)

## NOCH OFFEN: Katalog-Lücken nach Kassensystem-Import (08.08.2026)

Beim Import der Kassensystem-Inventarliste in `bestand.json` (124 Einträge, 200 Stück) blieben
22 Positionen ohne Treffer in `geraete-katalog.json` – sie stehen jetzt im Sortiment (`bestand.json`),
bekommen aber **keinen automatischen Ankaufspreis**, bis der Katalog ergänzt wird (die Ankaufsformel
hängt ausschließlich an `geraete-katalog.json`-Einträgen). **To-Do**, nach Priorität:

**Komplette Modellreihen fehlen (höchste Priorität, mehrere Geräte betroffen):**
- Samsung Galaxy A06 (4 Stück), A07 (4 Stück), A37 (6 Stück), A57 (4 Stück) – Katalog springt von
  A05s direkt auf A13, bzw. hört bei A56 auf

**Ganze Marke fehlt:**
- Realme (1 Stück, "Note 50 64GB")

**Neuer als Katalogstand:**
- Samsung Galaxy Buds 4, Galaxy Z Flip 8
- Apple MacBook Pro 14" M5, iPad Pro 11" (M5)
- Xiaomi Redmi A5, Redmi Note 14S

**Kein Katalog-Pendant vorhanden:**
- Lenovo "Tab Plus" (Katalog kennt nur "Tab P12")
- Samsung Galaxy Tab A9+ (Katalog kennt nur "Tab A9" ohne Plus)
- Sony Xperia 10 IV (Katalog startet bei 10 V), Xperia L1
- Apple "Smart Keyboard Folio" (Katalog kennt nur "Magic Keyboard für iPad")
- HP "Pro 14 Plus Core Ultra 7" (Katalog hat nur generische Tiers "EliteBook"/"Pavilion")

## NOCH OFFEN: marktwertGebraucht ohne UVP-Leitplanke außerhalb "smartphones" (08.08.2026)

Beim Live-Schalten der Ankaufspreise aus dem Kassensystem-Import aufgefallen: die UVP-Leitplanken
aus `pricing-config.js` (`istUvpBasierteKategorie()`, Kontaminations-Check `pruefeMarktwertNeuPlausibilitaet`)
greifen laut Code nur für Kategorie `smartphones`. Für alle anderen Kategorien gibt es für
`marktwertGebraucht` **keine** Plausibilitätsprüfung gegen die UVP – ein kontaminierter eBay-Treffer
fließt dort ungebremst in die gebraucht-Ankaufsstufen (wieNeu/sehrGut/gut/defekt), da diese direkt mit
`marktwertGebraucht × Zustandsprozentsatz` rechnen.

**Konkret gefunden (17 Einträge, `marktwertGebraucht` > 75 % der UVP-Variante, alle nicht-smartphones):**
5× Apple MacBook Pro 14"/16" M3/M4 (u.a. 32GB·1TB M4: 2280€ gebraucht bei 2589€ UVP-Variante = 88 %),
iPad 11 (2025) 256GB (765€ bei 499€ UVP = 153 %!), Galaxy Tab S9 FE/S11/S11+, PlayStation 5 (Digital/
Slim), 4× Valve Steam Deck, DualSense Controller. Zwei der Tab-S11-Einträge sind sogar schon als
`"kontaminiert-verworfen-06.08.2026"` markiert, tragen aber trotzdem noch den alten kontaminierten
Zahlenwert im `marktwertGebraucht`-Feld weiter (Markierung allein hat den Wert nicht genullt).

**Deshalb bewusst NICHT live geschaltet:** `ankauf-preise.json` wurde beim Live-Schalten der
Kassensystem-Ankaufspreise (08.08.2026) NUR für Kategorie `smartphones` aus dem frischen
`build-ankauf-preise.js`-Lauf übernommen (dort greifen die Leitplanken, 0 Konsistenz-/Inversions-
Verstöße bestätigt). Alle anderen Kategorien blieben auf dem Vor-Lauf-Stand, damit die 17 auffälligen
Werte nicht ungeprüft zu echten Ankaufspreisen werden.

**To-Do:** entweder (a) `istUvpBasierteKategorie()` auf **alle** Kategorien ausweiten statt nur auf
solche mit eigens recherchierten Referenzwerten (radikalste, aber einfachste Lösung – nutzt für
Kategorien ohne eigene Kalibrierung einfach einen generischen UVP-Prozentsatz statt marktwertGebraucht
ungeprüft durchzureichen), oder (a') `istUvpBasierteKategorie()` nur auf weitere Kategorien MIT
belastbaren Referenzwerten ausweiten (schrittweise, wie schon für smartphones am 06.08.2026 gemacht,
siehe oben im Dokument), oder (b) eine kategorie-unabhängige Leitplanke ausschließlich für
`marktwertGebraucht` gegen die UVP ergänzen (ohne die volle UVP-basierte Formel zu übernehmen), oder
(c) die 17 Werte einzeln manuell prüfen und ggf. wie die bereits markierten Tab-S11-Fälle auf `null`
setzen. Erst danach `build-ankauf-preise.js` für die restlichen Kategorien laufen lassen.

## NOCH OFFEN: Erhöhungssperre nachträglich angewendet, 2 Verdachtsfälle bei smartphones (08.08.2026)

Der erste Live-Lauf für Kategorie `smartphones` (siehe oben) hatte versehentlich auch Erhöhungen
übernommen, obwohl für diesen Import nur Senkungen gewünscht waren. Nachträglich korrigiert: **275
Erhöhungen gesperrt** (alter, niedrigerer Wert bleibt bestehen), **23 Senkungen übernommen**, **1967
Werte unverändert**, **5 Referenzgeräte** (iPhone 17 Pro Max 256GB/iPhone 17 Pro 256GB/iPhone 17
256GB/Galaxy S26+ 256GB/Galaxy S26 256GB) behalten ihren kalibrierten `neuVersiegelt`-Wert unabhängig
von der Sperre.

Dabei zwei Verdachtsfälle geprüft, die durch die Sperre ohnehin wieder auf dem alten (niedrigeren)
Wert stehen, aber als Datenqualitäts-Verdacht festgehalten werden:

- **Galaxy Note 9 128GB:** `marktwertNeu` im Katalog = 267€ (Stand 03.08.2026, nicht vom
  Auto-Preisupdate am 07.08. berührt), UVP 999€. Für ein 2018er-Gerät ohne bekannten
  Sammler-/Vintage-Markt wirkt das hoch – lief formal durch beide bestehenden Leitplanken (< 100 %
  UVP, < 115 % UVP für die Kontaminations-Prüfung), ist also nicht automatisch als kontaminiert
  erkannt worden, aber die Herkunft/Plausibilität des einzelnen eBay-Treffers wurde nicht manuell
  nachvollzogen.
- **Galaxy Z Fold 7 256GB/512GB:** `marktwertNeu` 1431€/1471€ bei UVP-Variante 2099€/2299€ (68 %/64 %)
  – für sich genommen nicht unplausibel, ABER die 1TB-Variante desselben Geräts ist bereits als
  `"kontaminiert-verworfen-06.08.2026"` markiert. 256GB/512GB wurden bei dieser früheren Bereinigung
  nicht mit geprüft/genullt – unklar, ob sie tatsächlich sauber sind oder nur nicht denselben
  Schwellenwert gerissen haben.

**To-Do:** beide Fälle bei der nächsten manuellen Preisprüfung (siehe PREISE-ANLEITUNG.md) gezielt
gegenchecken, bevor sie – z. B. durch eine künftige Senkung an anderer Stelle, die die Sperre nicht
mehr greift – doch noch live gehen.

## NOCH OFFEN: 8 Katalog-Lücken ohne belastbare UVP (11.08.2026)

Beim systematischen Katalog-Scan (alle Kategorien, siehe auch Eintrag "Katalog-Lücken nach
Kassensystem-Import" oben) wurden 14 fehlende Geräte recherchiert und eingetragen (Samsung
Galaxy A06 64GB/A37/A57/Z Flip 8, Apple iPad Pro 11"+13" M5/iPad Air 7 13"/MacBook Pro 14" M5,
Xiaomi Redmi A5/Pad 7 Pro, Samsung Galaxy Tab A9+/Watch9, OnePlus 15, Lenovo Tab Plus 128GB;
zusätzlich `kat-0260` Galaxy Watch Ultra 2 von UVP 699€/Jahr 2025 auf 749€/2026 aktualisiert -
Samsung behält den Produktnamen über zwei Modelljahre bei). Für folgende 8 Geräte aus dem
Kassensystem-Import (`bestand.json`) wurde **bewusst keine UVP eingetragen** - die Websuche
lieferte keine belastbare Herstellerangabe (nur Marktpreise Dritter, widersprüchliche Quellen,
oder gar keinen Treffer), und eine geratene UVP würde bei aktiver UVP-Formel direkt einen
falschen Ankaufspreis erzeugen:

- **Galaxy A06 128GB** - nur die 64GB-Variante (103€) hatte eine belastbare DE-Quelle.
- **Galaxy A07** (beide Varianten) - noch kein offizieller Samsung-DE-Marktstart gefunden, nur
  widersprüchliche Marktpreise (110-180€) von Drittanbietern.
- **Redmi Note 14S 256GB** - nur Marktpreis (175,80€) gefunden, keine bestätigte Launch-UVP.
- **Xperia 10 IV 128GB** - widersprüchliche Quellenangaben selbst bei derselben Quelle (419€
  vs. 479€ vs. 499€ genannt).
- **Xperia L1** - `bestand.json` nennt "64 GB", offizielle Spezifikation kennt aber nur eine
  16GB-Version (siehe Wikipedia/teltarif) - Speicherangabe im Bestand vermutlich falsch, vor
  Import prüfen statt für eine vermutlich nie existierende Variante einen Preis zu erfinden.
- **Lenovo Tab Plus 64GB** - nur die 128GB-Variante (329€) ist bei Lenovo DE offiziell
  auffindbar, eine 64GB-SKU wirkt wie eine eigene Konfiguration ohne Beleg.
- **HP Pro 14 Plus Core Ultra 7 (2025), 16GB·512GB** - kein Preis auffindbar, auch das Modell
  selbst ließ sich im HP-DE-Shop nicht eindeutig identifizieren (evtl. sehr neu/Nischenmodell).
- **Realme Note 50 3GB/64GB** - Marktstart-Preis (85€) mehrfach genannt, aber ohne belastbare
  Herstellerquelle (Realme hat keine starke offizielle DE-Preisliste); mittlere statt hoher
  Sicherheit.

**To-Do:** Betreiber prüft diese 8 Werte anhand eigener Einkaufsrechnungen/Lieferantenbelege und
liefert sie nach (siehe Absprache 11.08.2026). Bis dahin bekommen diese Positionen in
`bestand.json` weiterhin keinen automatischen Ankaufspreis.

## NOCH OFFEN: Kontaminationsprüfung kennt kein Alters-Kriterium (08.08.2026)

Am Galaxy-Note-9-Fall (siehe oben) sichtbar geworden: `pruefeMarktwertNeuPlausibilitaet()` prüft
`marktwertNeu` ausschließlich relativ zur UVP (< 100 % / < 115 %-Verwerfungsschwelle), unabhängig vom
Gerätealter. Bei einem aktuellen Flaggschiff (aktuelles Modelljahr) sind 60-70 % der UVP für einen
"echten" Marktwert normal. Beim Note 9 (Modelljahr 2018, `jahr` bereits im Katalog vorhanden) sind
267€ von 999€ UVP (27 %) zwar im Rahmen der Schwelle, aber ein Wert nahe 100 % UVP wäre bei einem
so alten Gerät ohne Sammlerstatus schon für sich genommen ein Kontaminationsindiz – die Prüfung sieht
das aktuell nicht, weil sie nur die UVP kennt, nicht das Baujahr.

**To-Do:** `pruefeMarktwertNeuPlausibilitaet()` (bzw. eine neue, danebenliegende Prüfung) um eine
altersabhängige Obergrenze ergänzen – z. B. gestaffelt analog zu `ALTERSFAKTOR_STUFEN`, oder simpler:
je älter das Modelljahr, desto niedriger die zulässige Prozent-Schwelle relativ zur UVP. Separates
Thema von der Kategorie-Ausweitung oben – betrifft auch `smartphones`, wo die UVP-Leitplanken sonst
schon greifen.

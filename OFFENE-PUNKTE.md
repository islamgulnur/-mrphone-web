# Offene Punkte

Sammelstelle für Dinge, die bewusst nicht automatisch entschieden wurden und noch eine
manuelle Prüfung durch den Betreiber brauchen.

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

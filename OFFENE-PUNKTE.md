# Offene Punkte

Sammelstelle für Dinge, die bewusst nicht automatisch entschieden wurden und noch eine
manuelle Prüfung durch den Betreiber brauchen.

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

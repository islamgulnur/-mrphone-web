---
description: Recherchiert aktuelle Gebrauchtmarktpreise für die meistgehandelten Modelle und aktualisiert nur die automatisch berechneten Ankaufspreise.
---

Aktualisiere die Ankaufspreise in `ankauf-preise.json` / `ankauf/*.json` anhand aktueller Marktdaten. Gehe dabei so vor:

1. **Backup zuerst.** Führe `node scripts/backup-data.js` aus bzw. verlasse dich darauf, dass jede Schreiboperation über die vorhandene `backupIfChanged()`-Logik läuft (siehe `CLAUDE.md`). Schreibe niemals direkt in `ankauf-preise.json`, ohne dass vorher ein Backup existiert.

2. **Top-30-Modelle bestimmen.** Lies `ankauf-preise.json`, sortiere nach `beliebt:true` zuerst, danach nach Erscheinungsjahr (neueste zuerst) und wähle die 30 meistgehandelten/relevantesten Smartphone- und Tablet-Modelle (die Geräte, die Kunden am häufigsten verkaufen – i. d. R. die aktuellen und die letzten 2-3 iPhone-/Galaxy-Generationen).

3. **Online recherchieren.** Nutze WebSearch/WebFetch, um für jedes der 30 Modelle (je Standard-Speichervariante) aktuelle deutsche Gebrauchtmarktpreise zu ermitteln:
   - Verkaufte/abgeschlossene eBay-Kleinanzeigen- bzw. eBay.de-Angebote als Referenz für den realistischen Wiederverkaufswert.
   - Ankaufs-/Verkaufspreise bekannter Refurbisher (z. B. rebuy, asgoodasnew, Back Market) als zweite Referenzquelle.
   - Bilde daraus einen realistischen Wiederverkaufswert pro Modell/Zustand.

4. **Ankaufsrichtwert ableiten.** Der neue Ankaufspreis für die Stufe "Sehr gut" (Referenzstufe) entspricht ca. 75–80 % des recherchierten Wiederverkaufswerts. Leite die anderen 4 Stufen proportional zu den bestehenden Verhältnissen aus `pricing-config.js` ab (`ZUSTANDSFAKTOREN`), damit die Relation zwischen den Stufen konsistent bleibt.

5. **Nur `preisQuelle:"auto"` anfassen.** Varianten mit `preisQuelle:"manuell"` dürfen unter keinen Umständen verändert werden – das ist eine harte Regel aus `CLAUDE.md`. Aktualisierte Preise bleiben als `"auto"` markiert (sie sind weiterhin automatisch/Skript-gepflegt, nur eben mit recherchierten statt rein formelbasierten Werten).

   **Bekannte Einschränkung:** Weil recherchierte Preise als `"auto"` markiert bleiben (es gibt bewusst keine dritte `preisQuelle`), überschreibt ein späterer Klick auf "Neu berechnen" im Admin-Panel diese recherchierten Werte wieder mit dem reinen Formel-Ergebnis aus `pricing-config.js`. Weise den Nutzer am Ende explizit darauf hin.

6. **Beide Dateiformen aktualisieren.** Ändere `ankauf-preise.json` (Master) und lasse anschließend `ankauf/<kategorie>.json` konsistent nachziehen – entweder durch direktes Nachführen beider Stellen oder indem du die Änderung ausschließlich in `ankauf-preise.json` vornimmst und danach `node scripts/build-ankauf-preise.js` NICHT verwendest (das würde alle Auto-Preise aus der Formel neu berechnen und deine Recherche überschreiben) – stattdessen die Split-Dateien manuell/gezielt synchron halten.

7. **Validieren.** Führe danach `node validate-data.js` aus und zeige das Ergebnis.

8. **Änderungsübersicht ausgeben.** Liste für jedes geänderte Modell: Marke, Modell, Variante, alter Preis je Stufe → neuer Preis je Stufe, sowie die verwendete(n) Quelle(n) (eBay/Refurbisher). Keine stille Änderung ohne sichtbare Zusammenfassung am Ende.

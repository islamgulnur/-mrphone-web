---
description: Vergleicht die eigenen Ankaufspreise mit den großen Online-Ankaufsportalen (rebuy, zoxs, wirkaufens, flip4new) und prüft, ob der Wettbewerbs-Abstand (30–50 €) noch stimmt. Reine Anzeige, keine Datei wird verändert.
---

Vergleiche die aktuellen Ankaufspreise mit den großen Online-Ankaufsportalen. Gehe dabei so vor:

1. **Modelle bestimmen.** Falls der Nutzer beim Aufruf konkrete Modelle nennt, verwende genau
   diese (max. 10). Sonst automatisch wählen: Lies `ankauf-preise.json`, filtere nur Varianten mit
   `preisQuelle:"auto"` (manuelle Preise sind hier nicht relevant), sortiere nach `beliebt:true`
   zuerst, danach nach Erscheinungsjahr (neueste zuerst), und wähle die 10 meistgehandelten
   Smartphone-/Tablet-Modelle (Standard-Speichervariante je Modell).

2. **Eigene Referenzstufe.** Verwende je Modell die Stufe **"Sehr gut"** (`sehrGut`) als
   Vergleichspreis – das ist die für Kunden am ehesten sichtbare/relevante Stufe.

3. **Online recherchieren.** Nutze WebSearch/WebFetch, um für jedes Modell den aktuellen
   Ankaufspreis (Zustand "gut"/"sehr gut", Standard-Speichervariante) bei folgenden Portalen zu
   ermitteln: **rebuy.de, zoxs.de, wirkaufens.de, flip4new.de**. Nicht jedes Portal führt jedes
   Modell – wenn ein Portal keinen Preis liefert, das im Ergebnis vermerken statt zu raten.

4. **Gegenüberstellung.** Zeige je Modell eine Tabelle: eigener Preis (`sehrGut`) | rebuy | zoxs |
   wirkaufens | flip4new | **Durchschnitt der gefundenen Portalpreise** | **Differenz** (eigener
   Preis − Portal-Durchschnitt). Ziel ist eine Differenz von **−30 bis −50 €** (ich liege darunter).

5. **Einschätzung je Modell.** Kennzeichne jedes Modell:
   - ✅ im Zielkorridor (−30 bis −50 €)
   - ⚠️ zu nah dran / sogar darüber (Differenz > −30 €, ggf. sogar positiv)
   - ⚠️ zu weit darunter (Differenz < −50 €, verschenktes Geld)

6. **Systematische Abweichung erkennen.** Wenn mehrere Modelle in dieselbe Richtung abweichen
   (z. B. die meisten liegen nur −10 € statt −30 bis −50 €, oder umgekehrt −70 € statt −50 €),
   schlage konkret vor, welche Konfigurationswerte in `scripts/ankaufspreis-config.js` angepasst
   werden sollten:
   - Liegt der Abstand systematisch zu gering: höhere Werte bei `WETTBEWERB_ABZUG_BIS_200` /
     `WETTBEWERB_ABZUG_200_BIS_500` / `WETTBEWERB_ABZUG_UEBER_500`, oder niedrigere Prozentsätze in
     `ANKAUF_PROZENTSAETZE_MARKT`.
   - Liegt der Abstand systematisch zu groß: die Abzugsbeträge senken bzw. Prozentsätze anheben.
   - Nenne die konkrete(n) Konstante(n) und eine plausible neue Zahl, aber ändere nichts selbst.

7. **Ausdrücklich reine Anzeige.** Kein Datei wird verändert, kein Commit, kein Schreibvorgang.
   Am Ende klar zusammenfassen: wie viele Modelle im Zielkorridor liegen, wie viele nicht, und ob
   eine Konfigurationsanpassung empfohlen wird (mit Begründung).

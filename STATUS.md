# STATUS: redesign/scroll-story

Autonomer Lauf gestartet: 2026-10-09, nach `/remote-control`-Freigabe. Protokoll gemäß Auftrag -
eine Zeile pro Commit, Entscheidungen zur Prüfung am Ende.

## Log

| Zeit | Section | Commit | seo-compare DE | seo-compare EN | Lighthouse Mobile (lokal, Perf/LCP/CLS/TBT) | Offene Probleme |
|---|---|---|---|---|---|---|
| 02:47 | Prep (Tooling) | `d026a96` | OK | OK | - | - |
| 02:55 | Section 1: Preloader | `4cc59a2` | OK | OK | - | - |
| 10:17 | Preloader-Fix (Timing/FOUC) + Live-Baseline | `1b81759` | OK | OK | Perf 100 / A11y 90 / BP 81* / SEO 100 (*BP-Delta = nur `is-on-https`, lokales HTTP-Artefakt, siehe HANDOFF) | - |
| 10:50 | ARIA-Fix (aria-prohibited-attr, aria-required-children) | `c1e14df` | OK | OK | A11y 90→99 (lokal) | `heading-order` bewusst nicht angefasst (Anweisung) |

*(Tabelle wird nach jedem weiteren Commit fortgeführt)*

## Live-Baseline (Referenz, siehe `lighthouse-baseline.json`)

Mobile, simuliertes Throttling, Median aus 3 Durchläufen:
- DE: Performance 100 / Accessibility 90 / Best Practices 100 / SEO 100, LCP 1,56s, CLS 0, TBT 0ms
- EN: Performance 100 / Accessibility 90 / Best Practices 100 / SEO 100, LCP 1,58s, CLS 0, TBT 0ms

**Neue Grenzwerte (verschärft gegenüber Baseline, da Baseline bei 100 lag):**
Performance ≥ 95, LCP ≤ 2,0s, CLS ≤ 0,05, TBT ≤ 150ms, JS-Budget Redesign ≤ 120 KB gzip, max. 3 Font-Dateien.

## ENTSCHEIDUNGEN ZUR PRÜFUNG

Alles, was im autonomen Lauf ohne Rückfrage entschieden wurde:

1. **ARIA-Fix-Methode:** `role="button"` auf dem Burger-Label (statt aria-label zu entfernen oder
   aufs Input zu verschieben) - kleinster Diff, kein Verhaltens-/Text-Change, direkt von der
   axe-Regel als valide Kombination erlaubt.
2. **Lokale Lighthouse-Messung über `http://localhost`:** `is-on-https`-Befund wird wie angewiesen
   ignoriert (einziger Best-Practices-Unterschied zur Live-Baseline, reines Artefakt).
3. **Vercel-Produktions-Branch bestätigt:** `latestDeployment.target` für main-Pushes ist
   `"production"`, für redesign/scroll-story-Pushes `null` (= Preview). Setup ist bereits sicher,
   keine Änderung nötig.
4. *(wird nach jeder weiteren Section-Entscheidung ergänzt)*

## Nächste Schritte

Siehe `REDESIGN-HANDOFF.md` Abschnitt "Nächste Schritte bis Section 9".

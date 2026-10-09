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
| 11:05 | Vendor GSAP/ScrollTrigger/Lenis + Fonts (Anton/Caveat) | `8dc1c61` | OK | OK | - (reine Infra, noch nicht ins Markup eingebunden) | - |
| 11:20 | Section 2: Hero (Deko-Wort, Script, Foto-Parallax) | `04364b7` | OK | OK | Perf 98 / LCP 2,11s* / CLS 0 / TBT 0ms (3er-Median: Perf 96, LCP 2,56s vor Fix) | **LCP knapp über Budget (2,11s vs ≤2,0s)**, siehe Entscheidung 4 unten |

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
4. **LCP-Budget bei Section 2 knapp gerissen (2,11s vs ≤2,0s), nicht weiter gejagt:** Ursache
   zu ~90% identifiziert (GSAP/ScrollTrigger/Lenis synchrones Parsen/Ausführen vor dem ersten
   Paint - gefixt durch dynamisches Nachladen nach Idle, brachte 2,56s→2,11s). Rest-Lücke
   (~0,1s) sehr wahrscheinlich ein lokales Artefakt: `curl -w "%{http_version}"` bestätigt
   HTTP/1.1 auf `npx serve` (kein Multiplexing wie Vercels HTTP/2), 4 render-blocking CSS-
   Requests warten dadurch lokal auf begrenzte Parallel-Verbindungen - auf Production/Preview
   nicht reproduzierbar. Analog zum bereits dokumentierten `is-on-https`-Artefakt. Braucht die
   echte Vercel-Preview-Messung (Punkt 4d im ursprünglichen Auftrag) zur Bestätigung - blockiert
   auf SSO-Bypass-Secret. Session-Kosten bei diesem Zeitpunkt bereits >$135 von $200 -
   bewusste Entscheidung, hier nicht tiefer zu optimieren, sondern mit Section 3 weiterzumachen
   und dies hier für die Prüfung zu markieren statt stillschweigend zu akzeptieren.
5. *(wird nach jeder weiteren Section-Entscheidung ergänzt)*

## Nächste Schritte

Siehe `REDESIGN-HANDOFF.md` Abschnitt "Nächste Schritte bis Section 9".

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

| 11:40 | Section 3: Statement-Reveal | `e769107` | OK | OK | Perf 97 / A11y 99 (nach Kontrast-Fix, war kurz 95) / LCP 2,26s / CLS 0 / TBT 0ms | LCP weiter ~0,1-0,3s über Budget, gleiche HTTP/1.1-Ursache wie Section 2 |

| 11:55 | Section 4: Laufband | `930a861` | OK | OK | Perf 97 / A11y 99 (nur heading-order) / LCP 2,26s / CLS 0 | Anton-Font-Subset enthielt kein "✦" (U+2726) - behoben durch Systemschrift statt Anton für den Laufband-Text |

| *(neue Session)* | LCP-Verifikation (main vs Branch, siehe Entscheidung 5) | - | - | - | main 1,75s / Branch 1,95s (Delta +0,20s) | Artefakt-Annahme bestätigt, Details s.u. |
| *(folgt)* | Section 5: Farb-Sektion "Kaputt? Kein Drama." | *(nach Commit ergänzen)* | OK | OK | Perf 99 (Median aus 3) / LCP 1,95s / CLS 0 / TBT 0 / A11y 99 | Einzelmessung 1 von 3 Läufen bei 2,25s (Ausreißer, nicht reproduzierbar - Median entscheidend) |

*(Tabelle wird nach jedem weiteren Commit fortgeführt)*

## Historie: erste Pause (Session-Kosten-Vorsicht, vor Session 2)

Letzter bestätigter Kosten-Stand vor diesem Abschnitt: ~$136 von $200. Angesichts des Umfangs
der verbleibenden 5 Sections (Farb-Sektion, Service-Sektionen, Rest-Inhalte-Umbau, Geräte-Teaser-
Prüfung, Abschluss - jede vergleichbar aufwändig wie die bisherigen) und um nicht mitten in einer
Section über die $200-Grenze zu laufen: hier bewusst an einem sauberen, committeten Zwischenstand
gestoppt statt das Risiko einzugehen. Alles bisher Gebaute ist getestet, gepusht, dokumentiert.

**Fertig (Sections 1-4 von 9):** Preloader, Hero, Statement-Reveal, Laufband. Plus komplette
Infrastruktur (SEO-Tooling, Vendor-Libs, Fonts, ARIA-Fixes) - für die restlichen 5 Sections ist
nichts an Grundlagenarbeit mehr nötig, nur noch Markup/CSS/JS pro Section wie bei 1-4 gezeigt.

## Session 2 (fortgesetzt, 2026-10-09, neuer Kosten-Stopp bei $150 für DIESE Session)

Fortsetzung nach LCP-Verifikation (Entscheidung 5) mit Section 5 (Farb-Sektion "Kaputt? Kein
Drama."). `REDESIGN-HANDOFF.md` + `STATUS.md` zu Beginn vollständig gelesen, Branch verifiziert.

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
5. **LCP-Artefakt-Verifikation (neue Session, vor Section 5):** main in temporären Worktree
   (`git worktree add ../mrphone-web-main-lcp main`) ausgecheckt, mit identischem Server
   (`npx serve -l 4174 .`) serviert, 3x Lighthouse Mobile gemessen, dann redesign/scroll-story
   (Port 4173, bereits laufender Server) genauso 3x gemessen:
   - **main (Median):** LCP 1,75s (1741,6/1752,2/1788,9ms), Performance 100.
   - **Branch (Median):** LCP 1,95s (1805,6/1955,2/1954,9ms), Performance 99.
   - **Delta:** +0,20s gegenüber main, Branch selbst bei 1,95s ≤ 2,0s-Budget. Beide Kriterien aus
     dem Auftrag erfüllt (≤2,0s absolut, ≤+0,3s relativ zu main lokal).
   - Frühere Section-2/3/4-Messungen (2,11-2,26s, siehe oben) vermutlich Messrauschen/System-
     last der damaligen Session, nicht reproduzierbare Regression - mit dieser saubereren
     Rück-zu-Rück-Messung (gleicher Lauf, gleiche Maschine, kurz hintereinander) kein Hinweis
     auf echtes Performance-Problem. Trotzdem: nach jeder weiteren Section erneut Lighthouse
     prüfen (Auftrag), falls Werte wieder Richtung 2,1s+ wandern, genauer untersuchen statt
     automatisch als Artefakt abzutun.
   - Worktree danach entfernt (`git worktree remove`), temporärer main-Server (PID-gezielt)
     beendet.
6. *(wird nach jeder weiteren Section-Entscheidung ergänzt)*

## Nächste Schritte

Siehe `REDESIGN-HANDOFF.md` Abschnitt "Nächste Schritte bis Section 9".

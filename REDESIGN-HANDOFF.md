# REDESIGN-HANDOFF: Scroll-Story-Redesign für mrphone-web

Branch `redesign/scroll-story`. Lies diese Datei nach JEDER fertigen Section erneut (Kontext-
Komprimierung darf keine Regel löschen). Quelle der Wahrheit für Regeln > Erinnerung.

## Ziel

Startseite (`index.html`) bekommt ein spektakuläres Scroll-Story-Design im Stil preisgekrönter
Awwwards-Seiten (Referenz: Smoothie-Marken-Website - Preloader, riesige Typo + Script-Schrift,
schwebende Produktfotos mit Parallax, Wort-für-Wort-Statement-Reveal, Laufband, knallige
Farbsektion mit Sticker-Badges, pro-Service Vollflächen-Farbsektionen mit Nebel, dunkler Abschluss).
**Design ändert sich, SEO-Inhalt nicht.** Nichts darf verloren gehen.

## SEO-Schutzregeln (NICHT VERHANDELBAR)

- Title, Meta-Description, Canonical, hreflang, robots: exakt unverändert.
- H1 bleibt wortgleich: "Handy Shop Frankfurt Zeil: Verkauf, Ankauf & Reparatur bei Mr. Phone".
  Deko-Wörter (MR. PHONE, REPARIERT. etc.) sind KEINE Headings, sondern span/div.
- Alle bestehenden H2/H3 bleiben wortgleich, gleiche Hierarchie.
- Aller bestehende Text bleibt 1:1 (umordnen/umgestalten ok, kürzen/umformulieren NICHT). Neue
  Texte (Slogans, Badges) nur zusätzlich.
- Alle internen Links bleiben mit gleichem Ziel/Ankertext erhalten.
- Keine URL geändert/gelöscht/umbenannt. Unterseiten + /en/ nicht angefasst (außer geteilte
  Header/Footer-Partials - da bleiben Links/Inhalt identisch, nur Markup-Attribute dürfen sich
  ändern, siehe ARIA-Fix-Commit als Beispiel).
- Kein Text in Bildern/Canvas/WebGL. Alles im initialen HTML sichtbar, auch ohne JS. Animationen
  nur Progressive Enhancement (transform/opacity), nie dauerhaft versteckter Inhalt.
- Kein noindex/nofollow in Production.
- Bestehende JSON-LD (LocalBusiness als `MobilePhoneStore` + FAQPage) bleibt exakt erhalten -
  existiert schon vollständig und korrekt, NICHT neu anlegen.
- Performance nie schlechter als Live-Baseline (siehe unten, jetzt sogar verschärfte Grenzwerte).

## Bilder-Regeln

- NUR echte Fotos echter Geräte. Keine KI-Bilder, keine 3D-Renderings, keine Stock-Illustrationen.
- KEINE Bilder selbst aus dem Internet laden (Urheberrecht). User liefert alle Bilder selbst.
- Bestehende Bilder + Alt-Texte bleiben erhalten.
- Neue Bilder unter `images/redesign/{hero,display,akku,ankauf,zubehoer,geraete}/`.
- Bis Bilder da sind: `.rs-img-placeholder`-Div mit Dateiname (graue Box, gestrichelter Rand,
  siehe redesign.css) - KEINE Fake-Bilder, kein `<img src="fehlt.jpg">`.
- Bilderliste (vollständig, siehe auch Chat): s.u. "Bilderliste".
- Fertige Bilder: AVIF+WebP in 640/1080/1600/2400/3200px via sharp-Script (noch zu bauen bei
  Section mit erstem echten Bild). Hero-Bild priority/preload, Rest lazy.

## Bilderliste (vorläufig, Stand Section 1)

| Dateiname | Motiv | Perspektive | Freigestellt | Seitenverhältnis | Mindestauflösung |
|---|---|---|---|---|---|
| `images/redesign/hero/iphone-front.png` | aktuelles iPhone, Display an | frontal | ja | 3:4 | 3000px |
| `images/redesign/hero/iphone-schraeg.png` | gleiches/ähnliches Gerät | 3/4-schräg | ja | 3:4 | 3000px |
| `images/redesign/hero/samsung-rueckseite.png` | Samsung, Kameramodul sichtbar | Rückseite | ja | 3:4 | 3000px |
| `images/redesign/hero/geraet-schwebend-4.png` | optional 4. Gerät | frontal/schräg | ja | 3:4 | 3000px |
| `images/redesign/geraete/preloader-phone.png` | ein Handy, Display an | frontal | ja | 1:1 o. 3:4 | 2000px, final WebP <40KB |
| `images/redesign/display/display-reparatur.jpg` | Display-Tausch Nahaufnahme | schräg, Detail | nein | 4:5 o. 16:9 | 3000px |
| `images/redesign/akku/akku-wechsel.jpg` | Akku-Tausch Nahaufnahme | schräg, Detail | nein | 4:5 o. 16:9 | 3000px |
| `images/redesign/ankauf/ankauf-barauszahlung.jpg` | Barauszahlung am Tresen | frontal/schräg | nein | 4:5 o. 16:9 | 3000px |
| `images/redesign/zubehoer/zubehoer-auswahl.jpg` | Hüllen/Panzergläser-Wand | frontal/schräg | nein | 4:5 o. 16:9 | 3000px |

## Bisherige Entscheidungen (User-Antworten, verbindlich)

1. **Kein Bundler.** Zero-Build bleibt. GSAP/ScrollTrigger/Lenis als Vendor-Dateien unter `/vendor/`
   (+ Lizenzdateien daneben), nur auf index.html, `defer`, Init nur wenn NICHT reduced-motion.
   Fonts self-hosted unter `/fonts/` (WOFF2, font-display:swap, nur genutzte Schnitte, nur
   Hero-Schrift preloaded, Subset inkl. ÄÖÜß, max. 3 Font-Dateien).
   `npm run build` = Alias auf `build-templates --check` + `test-seo` + `seo-compare`.
2. **phone-bg.js/css (CSS-3D-Phone):** nicht gelöscht, nur auf index.html deaktiviert (siehe
   Kommentare in index.html/index-styles.css - einfach wieder einkommentieren zum Reaktivieren).
   12-Stufen-Scroll-Logik als Inspiration fürs Hero-Parallax, aber: NUR 2.5D (translate/scale/Tilt
   max ±15°), KEINE vollen 3D-Drehungen (echtes Foto sieht dabei falsch aus). "Handy fliegt durch"
   = zwischen Fotos wechseln (vorne→schräg→hinten), nicht ein Foto drehen.
3. **Farben** (WCAG-AA-geprüft, siehe redesign.css `:root`):
   - Markengrün `#8dc63f` = Hauptakzent (Buttons/Links/CTAs), bleibt.
   - Lime knallig `#c6ff33` = "Kaputt? Kein Drama."-Sektion. Auf Grün/Lime IMMER dunkler Text
     (--ink `#0a0c08`, 9.6:1 bzw. 16.6:1).
   - Display-Sektion: Blau `#13235e`, weißer Text (14.69:1).
   - Akku-Sektion: Orange `#c23f0a` (NICHT `#e8540f` - das reicht nur für Large-Text AA, 3.68:1;
     `#c23f0a` schafft 5.24:1 auch für Fließtext), weißer Text.
   - Ankauf-Sektion: Markengrün, dunkler Text.
   - Zubehör-Sektion: Violett `#5b2a9e`, weißer Text (9.25:1).
4. **feature/premium-redesign-hero-video-fix bleibt GETRENNT**, nicht in dieses Redesign
   übernehmen. Enthält nur: Video-Bitrate-Fix (styles.css/main.js/videos/hero/*) - sauber,
   nutzbar, aber separates Thema (User reviewed/merged das selbst).
5. **seo-compare:** REMOVED/CHANGED (Heading/Text/Link/Ankertext/Alt/Meta/JSON-LD) = Fehler,
   Exit 1. HINZUGEFÜGT = nur auflisten, kein Fehler. Heading-Liste muss am Ende 1:1 identisch sein
   (auch keine neuen Headings für Deko-Wörter). Implementiert in `scripts/seo-audit.js`.
6. **redesign.css/redesign.js:** NUR von index.html geladen, nie von en/ oder Unterseiten.
   `seo-compare` läuft für DE + EN, dort muss Abweichung exakt 0 sein.
7. **Geräte-Teaser (urspr. Punkt 8):** nur umsetzen falls es schon eine bestand.json-Komponente
   gibt. NOCH NICHT GEPRÜFT - vor Section mit Geräte-Teaser erst prüfen (grep nach
   `bestand.json`/`data-bestand-grid` in main.js), sonst weglassen (keine neue Datenabhängigkeit).
8. **Preloader-Timing:** Desktop 0,8s Balken + 0,3s Fade (1,1s), Mobile ≤768px 0,4s + 0,2s (0,6s).
   Klick/Tap/Scroll bricht sofort ab. FOUC-Fix: Sichtbarkeits-Entscheidung synchron im
   `<head>`-Inline-Script vor erstem Stylesheet (`html.rs-preloader-pending`), nicht in
   deferred JS. Preloader-Bild: WebP < 40KB.
9. **Performance-Grenzen (verschärft, Baseline lag bei 100):** Lighthouse Mobile Performance ≥95,
   LCP ≤2,0s, CLS ≤0,05, TBT ≤150ms, JS-Budget Redesign ≤120KB gzip, max. 3 Font-Dateien
   (inkl. Subsetting ÄÖÜß für Hero-Schrift). Wird ein Wert gerissen: erst optimieren, dann weiter.

## Harte Regeln (autonomer Lauf, `/remote-control`)

- NIEMALS main mergen/pushen, NIEMALS Production deployen. Nur `redesign/scroll-story` pushen
  (Vercel: main→production bestätigt, redesign-Branch→Preview, siehe STATUS.md Entscheidung 3).
- Nach jeder Section: `npm run seo-compare` (DE+EN). Jede Abweichung sofort fixen; wenn nicht
  fixbar: Commit zurücknehmen (`git revert`), Problem in STATUS.md dokumentieren, mit nächster
  Section weitermachen.
- Lighthouse lokal, Mobile-Preset + simuliertem Throttling (`npx lighthouse <url> --output=json
  --chrome-flags="--headless=new" --quiet`, KEIN `--preset=mobile` - der existiert nicht in
  Lighthouse 13, mobile ist Default ohne `--preset`). `is-on-https`-Befund ignorieren (lokales
  HTTP-Artefakt). Vercel-Preview-Messung erst wenn Bypass-Secret eingerichtet ist.
- Fehlende Fotos: graue Platzhalter (`.rs-img-placeholder`), keine Internet-/KI-Bilder.
- Nichts außerhalb des Repos ändern, keine globalen Paket-Installationen, nichts löschen außer
  selbst in diesem Lauf angelegte Dateien.
- Kosten-Stopp bei $200 Session-Gesamtkosten: aktuellen Stand committen, STATUS.md aktualisieren,
  anhalten.

## Aktueller Stand

**Branch:** `redesign/scroll-story` (von `main` abgezweigt, aktuell NICHT vor main gemerged).
**Commits bisher:** siehe `STATUS.md` Log-Tabelle (bis `c1e14df`, ARIA-Fix).
**Lokaler Server zum Testen:** `npx serve -l 4173 .` im Repo-Root, dann `http://localhost:4173/index.html`.

**Scripts:**
- `npm run seo-audit` - Baseline neu erfassen (nur falls sich Startseite seit dem letzten Baseline-
  Lauf ändern SOLLTE, was sie laut Regeln nicht darf - normalerweise NICHT nötig).
- `npm run seo-compare` - aktuelle index.html/en/index.html gegen `seo-baseline.json` prüfen.
  Schreibt `seo-vergleich.json` + `seo-vergleich.md`.
- `node scripts/build-templates.js --check` - prüft Header/Footer-Partial-Konsistenz (readonly).
- `node scripts/build-templates.js` - regeneriert alle Seiten aus Partials (nach Partial-Änderung
  nötig, siehe ARIA-Fix-Commit).
- `node scripts/test-seo.js` - projekteigener SEO-Test (Metadaten/Canonicals/Schemas/Links).
- Lighthouse: siehe oben unter "Harte Regeln".

**Bereits gebaut (Sections 1-4 von 9, siehe STATUS.md für Details/Lighthouse-Werte):**
- Section 1 (Preloader): fertig. Platzhalter-Bild noch offen.
- ARIA-Fixes: `aria-prohibited-attr` + `aria-required-children` site-weit behoben. `heading-order`
  bewusst NICHT angefasst (bestehendes Problem, außerhalb Scope).
- GSAP/ScrollTrigger/Lenis vendored unter `/vendor/` - WICHTIG: werden NICHT als `<script defer>`
  geladen (kostete LCP-Budget), sondern dynamisch per `loadScript()` in redesign.js nach Idle/
  Window-Load nachgeladen (siehe `loadVendorAndInit()`). Beim Erweitern diesem Muster folgen,
  nicht zurück zu statischen `<script defer>`-Tags wechseln.
- Fonts: Anton-Regular.woff2 (Display) + Caveat-Bold.woff2 (Script) unter `/fonts/`, Subset NUR
  Latin+Deutsch+Satzzeichen - KEINE Sonderzeichen wie ✦ (siehe Laufband-Bugfix). Für neue
  Sonderzeichen in Display-Schrift: entweder neu subsetten oder Systemschrift nutzen wie beim
  Laufband.
- Section 2 (Hero): Deko-Wort + Script + 3 Foto-Platzhalter mit 2.5D-Parallax.
- Section 3 (Statement-Reveal): Wort-für-Wort-Reveal, Basis-Opacity 0.6 (AA-Kontrast-Pflicht,
  nicht niedriger setzen ohne neu zu prüfen).
- Section 4 (Laufband): nutzt bestehendes `.brand-marquee`/`.marquee-track` aus styles.css.

**LCP-Hinweis (wichtig für alle weiteren Sections):** Lokal (HTTP/1.1, `npx serve`) pendelt LCP
um 2,1-2,3s, leicht über dem 2,0s-Budget. Sehr wahrscheinlich lokales Artefakt (siehe STATUS.md
Entscheidung 4), aber bei jeder neuen Section trotzdem Lighthouse prüfen und nicht einfach
ignorieren - echte Bestätigung erst via Vercel-Preview möglich (SSO-Bypass-Secret fehlt noch).

**Noch NICHT begonnen:** Section 5 (Farb-Sektion) bis Section 9 (Abschluss), siehe unten.

## Nächste Schritte bis Section 9 (Reihenfolge)

1. GSAP + ScrollTrigger + Lenis vendoren.
2. Fonts besorgen (Display + Script + ggf. 3. Schnitt), self-hosten, subsetten.
3. **Section 2: Hero** - MR. PHONE Deko-Wort (span, keine Heading), Script-Schrift "auf der Zeil",
   schwebende Gerätefotos (2.5D-Parallax, Platzhalter bis Fotos da sind), echte H1 sichtbar darunter
   wortgleich, bestehende CTAs (Anrufen/WhatsApp) unverändert.
4. **Section 3: Statement-Reveal** (heller Hintergrund) - "WIR REPARIEREN NICHT EINFACH HANDYS –
   WIR HOLEN DEIN ALLTAG ZURÜCK." Wort-für-Wort beim Scrollen, Handy fliegt durch (Foto-Wechsel,
   kein Rotieren).
5. **Section 4: Laufband** - "iPHONE ✦ SAMSUNG ✦ DISPLAY ✦ AKKU ✦ ANKAUF ✦ ZUBEHÖR ✦", CSS-only.
6. **Section 5: Farb-Sektion "Kaputt? Kein Drama."** - Lime-Hintergrund, Sticker-Badges, NUR
   Fakten die schon auf der Seite stehen (6 Monate Garantie, Express-Reparatur, Seit 2014, Zeil
   115). Unklares als [PLATZHALTER] markieren, nichts erfinden.
7. **Section 6: Service-Sektionen** - Vollflächen-Farbe + Nebel + echtes Foto je Sektion, BESTEHENDE
   Inhalte aus "Alles rund um Ihr Smartphone" (Verkauf Neu&Gebraucht, Express-Reparatur,
   Sofort-Ankauf, Zubehör&Hüllendruck, Mobilfunk&SIM, Geldtransfer im Laden) 1:1 übernehmen, Text/
   Links unverändert. Farben siehe oben (Blau/Orange/Grün/Violett), fließender Wechsel beim Scrollen.
8. **Section 7:** restliche bestehende Abschnitte im neuen Look (Reihenfolge frei wählbar, aber
   alle müssen vorkommen): Kundenbewertungen, "Häufig gesuchte Reparaturen in Frankfurt" (alle
   Links!), Kategorien, Fachhändler-/Innenstadt-Text, "seit 2014", Smartphones, Gebrauchtgeräte
   mit Garantie, Tablets/iPads/Notebooks, Hüllen&Zubehör, Google-Bewertung, Anfahrt, FAQ.
9. **Section 8: Geräte-Teaser** - NUR falls bestand.json-Komponente existiert (noch prüfen), sonst
   weglassen.
10. **Section 9: Abschluss** (dunkel) - "DEIN HANDY IST KEIN GERÄT. ES IST DEIN ALLTAG." + Script
    "wir kümmern uns" + CTAs WhatsApp/Anrufen, Adresse, Öffnungszeiten, Karte nur per Klick (Consent).

## Abnahme-Checkliste (vor jedem Commit-Abschluss)

- [ ] `node scripts/build-templates.js --check` grün
- [ ] `node scripts/test-seo.js` grün
- [ ] `npm run seo-compare` DE = OK, EN = OK (0 removed/changed)
- [ ] Lighthouse lokal: Performance ≥95, LCP ≤2,0s, CLS ≤0,05, TBT ≤150ms (is-on-https ignorieren)
- [ ] Neue Bilder: entweder echtes geliefertes Foto ODER `.rs-img-placeholder` mit korrektem Pfad
- [ ] Keine neue Heading hinzugefügt, keine bestehende verändert
- [ ] `prefers-reduced-motion` respektiert (Animation komplett aus, Inhalt statisch sichtbar)
- [ ] Nur index.html/redesign.css/redesign.js verändert (nicht en/, nicht Unterseiten, außer
      bewusste Partial-Fixes wie ARIA)
- [ ] STATUS.md Zeile ergänzt
- [ ] Commit + Push auf redesign/scroll-story (NIE main)

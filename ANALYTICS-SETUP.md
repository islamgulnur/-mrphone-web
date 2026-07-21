# Analytics-Setup (GoatCounter)

Alle Seiten der Website enthalten jetzt dieses Tracking-Snippet vor `</body>`:

```html
<script data-goatcounter="https://mr-phone-frankfurt.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
```

GoatCounter wurde bewusst gewählt, weil es **ohne Cookies** und **ohne Consent-Banner**
auskommt (siehe Datenschutzerklärung, Abschnitt 3) – DSGVO-konform, kostenlos für
Websites mit bis zu 100.000 Aufrufen/Monat.

## Einmaliges Setup (5 Minuten)

1. Auf **https://www.goatcounter.com/** auf "Sign up" klicken (keine Kreditkarte nötig).
2. Als **Site code** exakt `mr-phone-frankfurt` eintragen (muss zum Snippet oben passen –
   ist der Code bereits vergeben, stattdessen einen freien Code wählen und in **allen**
   HTML-Dateien die URL im `data-goatcounter`-Attribut entsprechend anpassen).
3. E-Mail-Adresse bestätigen, kurzer Login-Code per Mail.
4. Fertig – ab dem nächsten Seitenaufruf laufen die Daten unter
   `https://mr-phone-frankfurt.goatcounter.com` (bzw. dem gewählten Code) ein.

## Was wird gemessen?

- Seitenaufrufe pro Unterseite, Referrer (woher kommen Besucher: Google, direkt, Social)
- Browser/Betriebssystem-Kategorie, grobe Standortregion (Land)
- **Keine** Cookies, **keine** IP-Adressen, **keine** Cross-Site-Verfolgung einzelner Personen

## Betroffene Dateien

Snippet eingebunden in: `index.html`, `sortiment.html`, `kontakt.html`, `impressum.html`,
`datenschutz.html`, `handy-ankauf-frankfurt.html`, `handy-reparatur-frankfurt.html`.

Neue Seiten (z. B. `/en/*.html`, `/ratgeber/*.html`) sollten das gleiche Snippet
erhalten, damit die Statistik vollständig bleibt.

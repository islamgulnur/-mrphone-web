/**
 * Zentrale, kommentierte Konfiguration für das automatische Preisupdate
 * (scripts/update-ankaufspreise.js). ALLE Faktoren des marktdatenbasierten Verfahrens
 * werden ausschließlich hier geändert – nirgendwo sonst duplizieren.
 *
 * Datenquelle ist eBay (Browse API, Marktplatz EBAY_DE) bzw. Mock im Dry-Run, siehe
 * scripts/lib/search-client.js – die hier definierten Faktoren gelten unabhängig davon.
 *
 * Unabhängig von pricing-config.js: pricing-config.js bleibt die Formel für den
 * manuellen Admin-Workflow (eigener Verkaufspreis/marktwertGebraucht-Schätzung als
 * Anker, Prozentsätze dort). Dieses Modul ist die Formel für den echten Marktanker
 * (echte aktuelle Marktpreise als Anker). Beide Verfahren nutzen weiterhin
 * gemeinsam pricing-config.js für liesAnkaufsniveau() (globaler ±15%-Regler,
 * wirkt zusätzlich obendrauf) und rundeAuf5().
 */

// Mindestanzahl Treffer je Marktabfrage, sonst Stufe überspringen (bzw. bei Gebraucht
// das ganze Gerät). Neuware/versiegelt hat am deutschen Markt strukturell weniger
// Angebote als Gebrauchtware, daher eigene (niedrigere) Schwelle.
const MIN_TREFFER_GEBRAUCHT = 5;
const MIN_TREFFER_NEU = 3;

// Ausreißerfilter: unteres UND oberes Viertel der sortierten Trefferliste kappen,
// bevor der Median gebildet wird (0.25 = je 25% an beiden Enden).
const QUARTIL_KAPPEN = 0.25;

// Abschlag vom Median auf den jeweiligen Marktwert (Angebots-/Handelsabschlag).
const ABSCHLAG_GEBRAUCHT = 0.12; // -12% -> marktwertGebraucht
const ABSCHLAG_NEU = 0.08;       // -8%  -> marktwertNeu

// Ankaufspreis je Zustandsstufe als Prozentsatz des jeweiligen Marktwerts.
// neuVersiegelt bezieht sich auf marktwertNeu, alle anderen auf marktwertGebraucht.
//
// Kalibrier-Referenz Betreiber: iPhone 15 128GB versiegelt ≈ 430 € Ankauf –
// bei systematischer Abweichung Faktor neuVersiegelt (aktuell 0.78) anpassen.
const ANKAUF_PROZENTSAETZE_MARKT = {
  neuVersiegelt: 0.78,
  wieNeu: 0.75,
  sehrGut: 0.68,
  gut: 0.55,
  defekt: 0.20,
};

// Tagesbremse: maximale Preisänderung je Gerät+Stufe und Tag (Betrag, nicht Ergebnis
// vor Rundung). Größere Sprünge werden auf diesen Wert gekappt und als PRÜFEN
// markiert. Gilt NICHT beim allerersten echten Marktlauf eines Geräts (marktwertQuelle
// noch "geschaetzt") - dort darf der Preis sofort auf den echten Marktwert springen,
// siehe scripts/update-ankaufspreise.js.
const TAGESBREMSE_PROZENT = 0.10;

// Tages-Call-Budget der Marktdaten-API (zwei Abfragen je Gerät+Variante: gebraucht/neu).
const API_BUDGET_TAEGLICH = 5000;
const CALLS_JE_VARIANTE = 2;

// ---------------------------------------------------------------------------
// Wettbewerbs-Abstand (neue zentrale Konfigurationsstufe)
// ---------------------------------------------------------------------------
// Nach Berechnung der 5 Zustandspreise (aus ANKAUF_PROZENTSAETZE_MARKT) wird ein
// gestaffelter Abzug angewendet, damit der Ankaufspreis bewusst unter dem Niveau der
// Online-Ankaufsportale (rebuy, zoxs, wirkaufens, flip4new, ...) liegt. Begründung:
// sofortige Barauszahlung vor Ort, kein Versand, kein Warten auf Auszahlung.
//
// Jede Zustandsstufe wird unabhängig anhand ihres EIGENEN berechneten Preises
// (vor Abzug) in eine Preis-Schwelle eingeordnet:
const WETTBEWERB_SCHWELLE_1 = 100;             // berechneter Preis bis 100 €
const WETTBEWERB_SCHWELLE_2 = 200;             // berechneter Preis 100,01 € bis 200 €
const WETTBEWERB_SCHWELLE_3 = 500;             // berechneter Preis 200,01 € bis 500 €
                                                // (darüber gilt WETTBEWERB_ABZUG_UEBER_500)
const WETTBEWERB_ABZUG_BIS_100 = 10;           // -10 €
const WETTBEWERB_ABZUG_100_BIS_200 = 20;       // -20 €
const WETTBEWERB_ABZUG_200_BIS_500 = 40;       // -40 €
const WETTBEWERB_ABZUG_UEBER_500 = 50;         // -50 €

// Untergrenze: kein Preis darf unter diesen Betrag fallen.
const WETTBEWERB_MINDESTPREIS = 10;

// Globaler Deckel über ALLEN Zustandsstufen (nicht nur "defekt"): der Abzug wird
// zusätzlich auf maximal diesen Anteil des (Vor-Abzug-)Preises begrenzt, damit
// günstige Geräte nicht prozentual überproportional stark abgewertet werden
// (Beispiel: fester 30-€-Abzug bei einem 75-€-Preis wären 40% - das begrenzt es auf 15%).
const WETTBEWERB_MAX_ABZUG_PROZENT = 0.15;

// Rundung nach Anwendung des Wettbewerbs-Abstands (auf volle 5 €).
const WETTBEWERB_RUNDUNG = 5;

// ---------------------------------------------------------------------------
// Apple-Korrektur nach Baujahr (kalibriert 27.07.2026 gegen reale rebuy/zoxs-Preise,
// Zustand "Gut", siehe Preisvergleich mit dem Betreiber)
// ---------------------------------------------------------------------------
// Der reine eBay-Marktanker liegt bei Apple-Geräten spürbar unter dem Niveau, das
// professionelle Ankaufsportale (rebuy, zoxs) zahlen - bei den aktuellen Topsellern
// (iPhone 15/16, Baujahr 2023+) deutlich stärker als bei älteren Modellen (iPhone 14 und
// älter). Ein einziger Faktor für alle Baujahre trifft daher nicht beide Fälle gleichzeitig
// (kalibriert an 3 realen Referenzpunkten, Stand 27.07.2026):
//   - iPhone 15 (128GB) "Gut": 180€ vs. rebuy 286€/zoxs 312€ -> Faktor 1,40 -> 250€ (36€ Abstand)
//   - iPhone 16 (128GB) "Gut": 250€ vs. rebuy 391€/zoxs 436€ -> Faktor 1,40 -> 350€ (41€ Abstand)
//   - iPhone 14 (128GB) "Gut": 140€ vs. rebuy 197€/zoxs 209€ -> Faktor 1,15 -> 160€ (37€ Abstand)
// Samsung bewusst noch OHNE Korrektur: Galaxy S24 (frische Marktdaten) lag bereits nah am
// Zielkorridor, Galaxy S23 lief zum Kalibrierzeitpunkt noch auf veralteten Schätzdaten
// (marktwertQuelle "geschaetzt") - Faktor erst festlegen, wenn echte Marktdaten vorliegen.
const APPLE_KORREKTUR_JAHRESGRENZE = 2023; // ab diesem Baujahr gilt der höhere Faktor
const APPLE_KORREKTUR_NEUERE = 1.40;       // Baujahr >= Grenze (aktuelle Topseller)
const APPLE_KORREKTUR_AELTERE = 1.15;      // Baujahr < Grenze

// Wirkt NACH dem Wettbewerbs-Abstand, auf alle 5 Zustandsstufen gleichermaßen (skaliert den
// gesamten Marktanker, nicht nur eine Stufe). Gilt nur für marke === "Apple".
function appleKorrekturFaktor(marke, jahr) {
  if (String(marke || "").trim().toLowerCase() !== "apple") return 1;
  return Number(jahr) >= APPLE_KORREKTUR_JAHRESGRENZE ? APPLE_KORREKTUR_NEUERE : APPLE_KORREKTUR_AELTERE;
}

module.exports = {
  appleKorrekturFaktor,
  APPLE_KORREKTUR_JAHRESGRENZE,
  APPLE_KORREKTUR_NEUERE,
  APPLE_KORREKTUR_AELTERE,
  MIN_TREFFER_GEBRAUCHT,
  MIN_TREFFER_NEU,
  QUARTIL_KAPPEN,
  ABSCHLAG_GEBRAUCHT,
  ABSCHLAG_NEU,
  ANKAUF_PROZENTSAETZE_MARKT,
  TAGESBREMSE_PROZENT,
  API_BUDGET_TAEGLICH,
  CALLS_JE_VARIANTE,
  WETTBEWERB_SCHWELLE_1,
  WETTBEWERB_SCHWELLE_2,
  WETTBEWERB_SCHWELLE_3,
  WETTBEWERB_ABZUG_BIS_100,
  WETTBEWERB_ABZUG_100_BIS_200,
  WETTBEWERB_ABZUG_200_BIS_500,
  WETTBEWERB_ABZUG_UEBER_500,
  WETTBEWERB_MINDESTPREIS,
  WETTBEWERB_MAX_ABZUG_PROZENT,
  WETTBEWERB_RUNDUNG,
};

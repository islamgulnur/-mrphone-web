/**
 * Zentrale, kommentierte Konfiguration für das automatische eBay-Preisupdate
 * (scripts/update-ankaufspreise.js). ALLE Faktoren des eBay-basierten Verfahrens
 * werden ausschließlich hier geändert – nirgendwo sonst duplizieren.
 *
 * Unabhängig von pricing-config.js: pricing-config.js bleibt die Formel für den
 * manuellen Admin-Workflow (eigener Verkaufspreis/marktwertGebraucht-Schätzung als
 * Anker, Prozentsätze dort). Dieses Modul ist die Formel für den eBay-Marktanker
 * (echte aktuelle Marktpreise als Anker). Beide Verfahren nutzen weiterhin
 * gemeinsam pricing-config.js für liesAnkaufsniveau() (globaler ±15%-Regler,
 * wirkt zusätzlich obendrauf) und rundeAuf5().
 */

// Mindestanzahl Treffer je Marktabfrage (gebraucht/neu), sonst Gerät überspringen.
const MIN_TREFFER = 5;

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
const ANKAUF_PROZENTSAETZE_EBAY = {
  neuVersiegelt: 0.78,
  wieNeu: 0.75,
  sehrGut: 0.68,
  gut: 0.55,
  defekt: 0.20,
};

// Tagesbremse: maximale Preisänderung je Gerät+Stufe und Tag (Betrag, nicht Ergebnis
// vor Rundung). Größere Sprünge werden auf diesen Wert gekappt und als PRÜFEN
// markiert. Gilt NICHT beim allerersten eBay-Lauf eines Geräts (marktwertQuelle
// noch nicht "ebay-auto") - dort darf der Preis sofort auf den echten Marktwert
// springen, siehe scripts/update-ankaufspreise.js.
const TAGESBREMSE_PROZENT = 0.10;

// Tages-Call-Budget der eBay Browse API (zwei Abfragen je Gerät+Variante).
const API_BUDGET_TAEGLICH = 5000;
const CALLS_JE_VARIANTE = 2;

module.exports = {
  MIN_TREFFER,
  QUARTIL_KAPPEN,
  ABSCHLAG_GEBRAUCHT,
  ABSCHLAG_NEU,
  ANKAUF_PROZENTSAETZE_EBAY,
  TAGESBREMSE_PROZENT,
  API_BUDGET_TAEGLICH,
  CALLS_JE_VARIANTE,
};

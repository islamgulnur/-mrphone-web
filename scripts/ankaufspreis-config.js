/**
 * Konfiguration für das automatische Preisupdate (scripts/update-ankaufspreise.js) – NUR noch
 * die Parameter, die den ECHTEN MARKTANKER aus eBay-Rohdaten ableiten (Mindesttreffer,
 * Ausreißerfilter, Median-Abschlag, Tagesbremse, API-Budget).
 *
 * Bereinigt am 28.07.2026: Die Zustands-Prozentsätze (Apple/Rest), der frühere "Wettbewerbs-
 * Abstand" und die frühere "Markenkorrektur" (Apple-Faktor 1,40/1,15, Samsung-Faktor 0,78) sind
 * VOLLSTÄNDIG entfernt – sie überlagerten sich und kollidierten bei hochpreisigen Geräten
 * (mehrere Zustandsstufen kollabierten auf denselben Markt-Deckel, siehe OFFENE-PUNKTE.md).
 * Die Zustands-Prozentsätze leben jetzt AUSSCHLIESSLICH in pricing-config.js
 * (ANKAUF_PROZENTSAETZE_APPLE / _REST, prozentsaetzeFuerMarke()) – hier nicht duplizieren.
 *
 * Datenquelle ist eBay (Browse API, Marktplatz EBAY_DE) bzw. Mock im Dry-Run, siehe
 * scripts/lib/search-client.js.
 */

// Mindestanzahl Treffer je Marktabfrage, sonst Stufe überspringen (bzw. bei Gebraucht
// das ganze Gerät). Neuware/versiegelt hat am deutschen Markt strukturell weniger
// Angebote als Gebrauchtware, daher eigene (niedrigere) Schwelle.
const MIN_TREFFER_GEBRAUCHT = 8;
const MIN_TREFFER_NEU = 5;

// Ausreißerfilter: unteres UND oberes Viertel der sortierten Trefferliste kappen,
// bevor der Median gebildet wird (0.25 = je 25% an beiden Enden).
const QUARTIL_KAPPEN = 0.25;

// Wenn das mittlere Preisfeld trotz Titel-/Variantenfilter weiter zu stark streut,
// ist der Marktanker nicht verlaesslich genug und wird an diesem Tag nicht verwendet.
// 0.55 bedeutet: Abstand zwischen 25-%- und 75-%-Quantil maximal 55 % des Medians.
const MAX_STREUUNG_PROZENT = 0.55;

// Abschlag vom Median auf den jeweiligen Marktwert (Angebots-/Handelsabschlag).
const ABSCHLAG_GEBRAUCHT = 0.12; // -12% -> marktwertGebraucht
const ABSCHLAG_NEU = 0.08;       // -8%  -> marktwertNeu

// Tagesbremse: maximale Preisänderung je Gerät+Stufe und Tag (Betrag, nicht Ergebnis
// vor Rundung). Größere Sprünge werden auf diesen Wert gekappt und als PRÜFEN
// markiert. Gilt NICHT beim allerersten echten Marktlauf eines Geräts (marktwertQuelle
// noch "geschaetzt") - dort darf der Preis sofort auf den echten Marktwert springen,
// siehe scripts/update-ankaufspreise.js.
const TAGESBREMSE_PROZENT = 0.10;

// Zielabstand zum niedrigsten sicher erkannten Ankaufspreis für Neuware. Ein
// gestaffelter Euro-Abstand verhindert, dass günstige Geräte durch einen festen
// Prozentwert zu knapp und Premiumgeräte durch einen festen Betrag zu teuer werden.
function wettbewerbsAbstand(preis) {
  const wert = Number(preis);
  if (wert <= 250) return 15;
  if (wert <= 500) return 25;
  if (wert <= 800) return 40;
  return Math.min(60, wert * 0.05);
}

function wettbewerbsZiel(preis) {
  const wert = Number(preis);
  if (!Number.isFinite(wert) || wert <= 0) return null;
  return Math.max(5, wert - wettbewerbsAbstand(wert));
}

// Tages-Call-Budget der Marktdaten-API (zwei Abfragen je Gerät+Variante: gebraucht/neu).
const API_BUDGET_TAEGLICH = 5000;
const CALLS_JE_VARIANTE = 2;

module.exports = {
  MIN_TREFFER_GEBRAUCHT,
  MIN_TREFFER_NEU,
  QUARTIL_KAPPEN,
  MAX_STREUUNG_PROZENT,
  ABSCHLAG_GEBRAUCHT,
  ABSCHLAG_NEU,
  TAGESBREMSE_PROZENT,
  wettbewerbsAbstand,
  wettbewerbsZiel,
  API_BUDGET_TAEGLICH,
  CALLS_JE_VARIANTE,
};

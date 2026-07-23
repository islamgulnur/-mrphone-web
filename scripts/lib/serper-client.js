/**
 * Schlanker Client für die Serper.dev Google-Shopping-Suche (deutscher Markt: gl=de/hl=de).
 * Genutzt über scripts/lib/search-client.js als eine der austauschbaren Datenquellen für
 * scripts/update-ankaufspreise.js (Marktanker gebraucht/neu je Gerät+Variante).
 *
 * Serper liefert bereits strukturierte Preisfelder je Treffer (kein Regex-Parsing von
 * Freitext-Snippets nötig) - lediglich die Preis-STRINGS sind uneinheitlich formatiert
 * (mal "€ 429,00", mal "429.00 €" o. Ä.), daher parsePreis() unten.
 */
const SEARCH_URL = "https://google.serper.dev/shopping";

// Deutscher Such-Zusatz je interner Zustand-Art, damit die Google-Shopping-Treffer zum
// gewünschten Zustand passen (Serper selbst kennt keinen "conditions"-Filter wie eBay).
//
// WICHTIG: Google Shopping (die Datenquelle hinter Serpers /shopping-Endpunkt) indiziert
// überwiegend strukturierte Produktfeeds regulärer Händler - deren Titel lauten schlicht
// "Apple iPhone 15 128GB", NIEMALS mit Kleinanzeigen-Jargon wie "versiegelt"/"OVP". Ein
// Zusatz wie "neu versiegelt OVP" filtert die Treffer fast auf null herunter (beobachtet:
// 0-3 Treffer statt Dutzenden), weil kaum ein Feed-Titel alle drei Wörter enthält. Für
// NEW deshalb KEIN Zusatz - Google Shopping listet ohnehin überwiegend Neuware regulärer
// Händler, das entspricht direkt marktwertNeu. "gebraucht" für USED funktioniert dagegen,
// weil das tatsächliche Standard-Vokabular deutscher Refurbished-Händler (rebuy,
// asgoodasnew, Back Market, ...) in deren echten Produkttiteln ist.
const SUCHZUSATZ_ZUSTAND = {
  USED: "gebraucht",
  NEW: "",
};

function baueSuchstring(marke, modell, variante, zustand) {
  const basis = [marke, modell, variante].filter(Boolean).join(" ").trim();
  const zusatz = SUCHZUSATZ_ZUSTAND[zustand] || "";
  return [basis, zusatz].filter(Boolean).join(" ").trim();
}

/**
 * Wandelt einen Serper-Preis-String (uneinheitliche Formatierung, deutsches oder
 * englisches Zahlenformat, mit/ohne Währungszeichen) in eine Zahl (EUR) um.
 * Gibt null zurück, wenn keine brauchbare Zahl erkennbar ist.
 */
function parsePreis(rohwert) {
  if (rohwert == null) return null;
  if (typeof rohwert === "number") return Number.isFinite(rohwert) ? rohwert : null;

  let text = String(rohwert).replace(/[^\d.,]/g, "");
  if (!text) return null;

  const hatPunkt = text.includes(".");
  const hatKomma = text.includes(",");

  if (hatPunkt && hatKomma) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", "."); // deutsch: 1.299,00
    } else {
      text = text.replace(/,/g, ""); // englisch: 1,299.00
    }
  } else if (hatKomma) {
    const teile = text.split(",");
    text = teile[teile.length - 1].length === 2
      ? teile.slice(0, -1).join("") + "." + teile[teile.length - 1]
      : teile.join("");
  } else if (hatPunkt) {
    const teile = text.split(".");
    if (teile.length === 2 && teile[1].length === 3) {
      text = teile.join(""); // "1.299" ohne Cent-Anteil -> Tausenderpunkt
    }
  }

  const zahl = Number(text);
  return Number.isFinite(zahl) ? zahl : null;
}

/**
 * Fragt Serper.dev (Google Shopping, deutscher Markt) nach Angeboten für
 * Marke+Modell+Variante in einem Zustand ("USED" oder "NEW") ab. Gibt die rohen Preise
 * (Zahlen, EUR) zurück - gleiche Rückgabeform wie ebay-client.js:sucheMarkt().
 */
async function sucheMarkt({ apiKey, marke, modell, variante, zustand, budgetZaehler, limit }) {
  if (budgetZaehler) budgetZaehler.pruefeUndZaehle();

  const antwort = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: baueSuchstring(marke, modell, variante, zustand),
      gl: "de",
      hl: "de",
      num: limit || 20,
    }),
  });

  if (!antwort.ok) {
    throw new Error("Serper-Suche fehlgeschlagen: HTTP " + antwort.status + " " + (await antwort.text()));
  }

  const daten = await antwort.json();
  const treffer = Array.isArray(daten.shopping) ? daten.shopping : [];
  const preise = treffer
    .map((t) => parsePreis(t.price))
    .filter((p) => Number.isFinite(p) && p > 0);

  // Erste 5 Rohtreffer (Titel/Preis-String/Quelle/geparster Preis) für Diagnosezwecke,
  // z. B. über --debug-treffer=id:variante in scripts/update-ankaufspreise.js.
  const rohtreffer = treffer.slice(0, 5).map((t) => ({
    titel: t.title,
    preisString: t.price,
    preisGeparst: parsePreis(t.price),
    quelle: t.source,
  }));

  return { preise, gesamtTreffer: treffer.length, suchstring: baueSuchstring(marke, modell, variante, zustand), rohtreffer };
}

module.exports = { sucheMarkt, baueSuchstring, parsePreis };

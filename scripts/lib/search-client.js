/**
 * Datenadapter für Marktpreis-Abfragen: macht die Datenquelle austauschbar (eBay | Mock),
 * ohne dass scripts/update-ankaufspreise.js wissen muss, welche Quelle gerade aktiv ist.
 * eBay (Browse API, Marktplatz EBAY_DE) ist die einzige echte Datenquelle - Mock nur für
 * Dry-Runs ohne hinterlegte eBay-Secrets.
 *
 * (Frühere Alternativquelle Serper.dev/Google Shopping wurde entfernt, siehe Git-Historie
 * bei Bedarf.)
 *
 * Einheitliche Rückgabeform: { preise: number[], gesamtTreffer: number }. quartilMedian()
 * ist reine Zahlen-Logik (kein eBay-spezifischer Code) und wird von ebay-client.js
 * übernommen, um sie nicht zu duplizieren.
 */
const ebayClient = require("./ebay-client");
const ebayMock = require("./ebay-mock");

const DATENQUELLEN = { EBAY: "ebay", MOCK: "mock" };

class BudgetErschoepftFehler extends Error {}

/**
 * Erstellt einen Call-Budget-Zähler (provider-neutral). Jeder tatsächliche API-Aufruf
 * über sucheMarkt() zählt hier hinein; ist das Tagesbudget erschöpft, wirft sucheMarkt()
 * BudgetErschoepftFehler VOR dem eigentlichen Request.
 */
function erstelleBudgetZaehler(maxCalls) {
  let verbraucht = 0;
  return {
    pruefeUndZaehle() {
      if (verbraucht >= maxCalls) throw new BudgetErschoepftFehler("Tagesbudget erschöpft (" + maxCalls + " Calls)");
      verbraucht += 1;
    },
    get verbraucht() {
      return verbraucht;
    },
  };
}

/**
 * Bestimmt die zu verwendende Datenquelle. quelleErzwungen ("ebay"|"mock", aus --quelle=...)
 * hat Vorrang. Sonst Auto-Erkennung: EBAY_CLIENT_ID+EBAY_CLIENT_SECRET gesetzt -> "ebay",
 * sonst "mock". Ob "mock" im konkreten Aufruf zulässig ist (nur zusammen mit --dry-run),
 * prüft weiterhin der Aufrufer (scripts/update-ankaufspreise.js).
 */
function bestimmeDatenquelle({ quelleErzwungen, env } = {}) {
  const e = env || process.env;
  if (quelleErzwungen) {
    if (!Object.values(DATENQUELLEN).includes(quelleErzwungen)) {
      throw new Error("Unbekannte Datenquelle '" + quelleErzwungen + "' (--quelle=ebay|mock).");
    }
    return quelleErzwungen;
  }
  if (e.EBAY_CLIENT_ID && e.EBAY_CLIENT_SECRET) return DATENQUELLEN.EBAY;
  return DATENQUELLEN.MOCK;
}

/**
 * Holt den Zugangskontext (OAuth-Token bei eBay, nichts bei Mock), der anschließend an
 * jeden sucheMarkt()-Aufruf durchgereicht wird.
 */
async function holeZugangskontext(quelle, env) {
  const e = env || process.env;
  if (quelle === DATENQUELLEN.EBAY) {
    const accessToken = await ebayClient.holeAccessToken(e.EBAY_CLIENT_ID, e.EBAY_CLIENT_SECRET);
    return { quelle, accessToken };
  }
  return { quelle: DATENQUELLEN.MOCK };
}

/**
 * Fragt die aktive Datenquelle nach Angeboten für Gerät+Variante in einem Zustand
 * ("USED" oder "NEW") ab. Gibt { preise, gesamtTreffer } zurück, unabhängig davon,
 * welche Quelle dahintersteckt.
 */
async function sucheMarkt({ zugangskontext, geraet, variante, zustand, budgetZaehler }) {
  if (zugangskontext.quelle === DATENQUELLEN.MOCK) {
    return ebayMock.sucheMarktMock({ geraet, variante, zustand });
  }
  if (zugangskontext.quelle === DATENQUELLEN.EBAY) {
    return ebayClient.sucheMarkt({
      accessToken: zugangskontext.accessToken,
      marke: geraet.marke,
      modell: geraet.modell,
      variante: variante.bezeichnung,
      zustand,
      kategorie: geraet.kategorie,
      budgetZaehler,
    });
  }
  throw new Error("Unbekannte Datenquelle: " + zugangskontext.quelle);
}

module.exports = {
  DATENQUELLEN,
  BudgetErschoepftFehler,
  erstelleBudgetZaehler,
  bestimmeDatenquelle,
  holeZugangskontext,
  sucheMarkt,
  quartilMedian: ebayClient.quartilMedian,
};

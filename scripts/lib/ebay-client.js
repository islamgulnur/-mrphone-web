/**
 * Schlanker Client für die eBay Browse API (Marktplatz EBAY_DE), Client-Credentials-Flow.
 * Genutzt von scripts/update-ankaufspreise.js für die beiden Marktanker (gebraucht/neu)
 * je Gerät+Variante.
 *
 * WICHTIG (im echten Testlauf verifizieren, siehe EBAY-SETUP.md Schritt 4): Die
 * eBay Browse API bietet zwei Wege, nach Zustand zu filtern - den lesbaren
 * "conditions"-Filter (Werte u. a. NEW, USED) und den numerischen "conditionIds"-Filter.
 * Dieser Client nutzt den lesbaren "conditions"-Filter. Liefert ein echter Lauf trotz
 * vorhandener Angebote 0 Treffer, zuerst im Action-Log prüfen, ob eBay hier stattdessen
 * conditionIds erwartet (Doku: developer.ebay.com/api-docs/buy/browse/resources/
 * item_summary/methods/search) und ggf. FILTER_ZUSTAND unten anpassen.
 */
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const MARKETPLACE = "EBAY_DE";
const OAUTH_SCOPE = "https://api.ebay.com/oauth/api_scope";

// Lesbarer eBay-Zustandsfilter je interner Anfrage-Art (siehe Hinweis oben).
const FILTER_ZUSTAND = {
  USED: "USED",
  NEW: "NEW",
};

let cachedToken = null; // { wert, ablauf } - Ablauf als Date.now()-Millisekunden

class BudgetErschoepftFehler extends Error {}

function baueSuchstring(marke, modell, variante) {
  return [marke, modell, variante].filter(Boolean).join(" ").trim();
}

async function holeAccessToken(clientId, clientSecret) {
  if (cachedToken && cachedToken.ablauf > Date.now() + 60000) {
    return cachedToken.wert;
  }
  const basicAuth = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const antwort = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + basicAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent(OAUTH_SCOPE),
  });
  if (!antwort.ok) {
    throw new Error("eBay-OAuth fehlgeschlagen: HTTP " + antwort.status + " " + (await antwort.text()));
  }
  const daten = await antwort.json();
  cachedToken = {
    wert: daten.access_token,
    ablauf: Date.now() + (Number(daten.expires_in) || 7200) * 1000,
  };
  return cachedToken.wert;
}

/**
 * Erstellt einen Call-Budget-Zähler. Jeder tatsächliche API-Aufruf über
 * sucheMarkt() zählt hier hinein; ist das Tagesbudget erschöpft, wirft
 * sucheMarkt() BudgetErschoepftFehler VOR dem eigentlichen Request.
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
 * Fragt die eBay Browse API nach Angeboten für Marke+Modell+Variante in einem
 * Zustand ("USED" oder "NEW") ab. Gibt die rohen Preise (Zahlen, EUR) zurück.
 */
async function sucheMarkt({ accessToken, marke, modell, variante, zustand, budgetZaehler, limit }) {
  if (budgetZaehler) budgetZaehler.pruefeUndZaehle();

  const params = new URLSearchParams({
    q: baueSuchstring(marke, modell, variante),
    filter: "conditions:{" + FILTER_ZUSTAND[zustand] + "}",
    limit: String(limit || 50),
  });

  const antwort = await fetch(SEARCH_URL + "?" + params.toString(), {
    headers: {
      Authorization: "Bearer " + accessToken,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
      "Content-Type": "application/json",
    },
  });

  if (!antwort.ok) {
    throw new Error("eBay-Suche fehlgeschlagen: HTTP " + antwort.status + " " + (await antwort.text()));
  }

  const daten = await antwort.json();
  const treffer = Array.isArray(daten.itemSummaries) ? daten.itemSummaries : [];
  const preise = treffer
    .map((t) => t.price && Number(t.price.value))
    .filter((p) => Number.isFinite(p) && p > 0);

  return { preise, gesamtTreffer: treffer.length };
}

/**
 * Ausreißerfilter + Median: sortiert, kappt unteres+oberes Viertel
 * (quartilKappen, z. B. 0.25), gibt den Median der Restliste zurück.
 * Gibt zusätzlich die Zwischenwerte zurück (für Logging/Dry-Run-Anzeige).
 */
function quartilMedian(preise, quartilKappen) {
  const sortiert = preise.slice().sort((a, b) => a - b);
  const medianVorFilter = median(sortiert);

  const kappung = Math.floor(sortiert.length * quartilKappen);
  const gefiltert = kappung > 0 ? sortiert.slice(kappung, sortiert.length - kappung) : sortiert;
  const basis = gefiltert.length ? gefiltert : sortiert; // nie leer laufen lassen

  return {
    medianVorFilter,
    medianNachFilter: median(basis),
    anzahlVorFilter: sortiert.length,
    anzahlNachFilter: basis.length,
  };
}

function median(sortierteListe) {
  if (!sortierteListe.length) return 0;
  const mitte = Math.floor(sortierteListe.length / 2);
  return sortierteListe.length % 2 === 0
    ? (sortierteListe[mitte - 1] + sortierteListe[mitte]) / 2
    : sortierteListe[mitte];
}

module.exports = {
  BudgetErschoepftFehler,
  holeAccessToken,
  erstelleBudgetZaehler,
  sucheMarkt,
  quartilMedian,
  baueSuchstring,
};

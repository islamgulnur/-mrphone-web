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

// eBay-DE-Kategorie-IDs je kategorie-Feld aus geraete-katalog.json - NUR für die NEW-Abfrage
// (siehe Diagnose 27.07.2026: Freitextsuche ohne Kategorie-Filter matcht auch Zubehör/
// Ersatzteile, die den Modellnamen im Titel tragen, z. B. "Hülle für iPhone 17 Pro Max").
// Bewusst nur "smartphones" befüllt - für die anderen 9 Kategorien liegt keine verlässlich
// bekannte eBay-Kategorie-ID vor; lieber ungefiltert lassen als eine falsche ID erfinden.
const EBAY_KATEGORIE_ID = {
  smartphones: "9355", // eBay DE: "Handys ohne Vertrag"
};

// Ausschluss-Keywords fuer alle Geraete-Abfragen. Die serverseitige Suche reduziert damit
// offensichtliches Zubehoer bereits vorab; titelPasstExakt() prueft die Treffer danach noch
// einmal lokal. Fuer die Kategorie zubehoer werden diese Begriffe nicht pauschal angehaengt.
const GERAETE_AUSSCHLUSS_KEYWORDS =
  "-hülle -case -cover -schutzfolie -display -akku -ersatzteil -defekt -bastler " +
  "-adapter -ladekabel -armband -strap -dummy -karton";

const TITEL_AUSSCHLUSS = [
  "hülle", "huelle", "case", "cover", "schutzfolie", "panzerglas", "display", "lcd",
  "ersatzteil", "spare part", "parts only", "akku", "battery", "ladekabel", "charging cable",
  "adapter", "armband", "watch band", "strap", "gehäuse", "gehaeuse", "housing", "dummy",
  "attrappe", "karton", "ovp leer", "box only", "ohne gerät", "ohne geraet", "bastler",
  "defekt", "displaybruch", "bundle", "zubehör paket", "zubehoer paket",
];

let cachedToken = null; // { wert, ablauf } - Ablauf als Date.now()-Millisekunden

class BudgetErschoepftFehler extends Error {}

function baueSuchstring(marke, modell, variante, zustand, kategorie) {
  const basis = [marke, modell, variante].filter(Boolean).join(" ").trim();
  return kategorie === "zubehoer" ? basis : basis + " " + GERAETE_AUSSCHLUSS_KEYWORDS;
}

function normalisiereTitel(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function enthaeltToken(text, token) {
  return (" " + text + " ").includes(" " + token + " ");
}

function extrahiereMasse(text) {
  const normalisiert = normalisiereTitel(text);
  const treffer = normalisiert.match(/\b\d+\s*(?:gb|tb|mm)\b/g) || [];
  return [...new Set(treffer.map((wert) => wert.replace(/\s+/g, "")))];
}

/**
 * Lokale Exaktpruefung fuer alle Kategorien. Sie verhindert insbesondere, dass
 * Zubehoer, falsche Speichergroessen oder benachbarte Pro/Max/Ultra-Modelle als
 * Preisanker in die Automatik gelangen.
 */
function titelPasstExakt(titel, { marke, modell, variante, kategorie }) {
  const titelNorm = normalisiereTitel(titel);
  const modellNorm = normalisiereTitel([marke, modell].filter(Boolean).join(" "));
  if (!titelNorm || !modellNorm) return false;

  const modellTokens = [...new Set(modellNorm.split(" ").filter((token) => token.length > 1 || /^\d+$/.test(token)))];
  if (!modellTokens.every((token) => enthaeltToken(titelNorm, token))) return false;

  if (kategorie !== "zubehoer") {
    const titelMitUmlauten = String(titel || "").toLowerCase();
    if (TITEL_AUSSCHLUSS.some((wort) => titelMitUmlauten.includes(wort))) return false;
  }

  const varianteNorm = normalisiereTitel(variante);
  const geforderteMasse = extrahiereMasse(variante);
  const titelKompakt = titelNorm.replace(/\s+/g, "");
  if (!geforderteMasse.every((mass) => titelKompakt.includes(mass))) return false;
  if (enthaeltToken(varianteNorm, "cellular") && !(
    enthaeltToken(titelNorm, "cellular") || enthaeltToken(titelNorm, "lte")
  )) return false;
  if (enthaeltToken(varianteNorm, "gps") && !enthaeltToken(titelNorm, "gps")) return false;

  // Modellnachbarn nicht vermischen: z. B. iPhone 17 mit 17 Pro/Pro Max,
  // Galaxy S24 mit S24 FE/Ultra oder Watch GPS mit einer Cellular-Version.
  const unterscheider = ["pro", "max", "ultra", "plus", "mini", "air", "fe", "cellular", "lte"];
  for (const token of unterscheider) {
    const imTitel = enthaeltToken(titelNorm, token);
    const imGesuchtenModell = enthaeltToken(modellNorm + " " + varianteNorm, token);
    if (imTitel && !imGesuchtenModell) return false;
  }

  return true;
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
async function sucheMarkt({ accessToken, marke, modell, variante, zustand, kategorie, budgetZaehler, limit }) {
  if (budgetZaehler) budgetZaehler.pruefeUndZaehle();

  const suchstring = baueSuchstring(marke, modell, variante, zustand, kategorie);
  const params = new URLSearchParams({
    q: suchstring,
    filter: "conditions:{" + FILTER_ZUSTAND[zustand] + "}",
    limit: String(limit || 50),
  });
  const categoryId = zustand === "NEW" ? EBAY_KATEGORIE_ID[kategorie] : null;
  if (categoryId) params.set("category_ids", categoryId);

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
  const rohdaten = Array.isArray(daten.itemSummaries) ? daten.itemSummaries : [];
  const treffer = rohdaten.filter((treffer) => (
    treffer && treffer.price && treffer.price.currency === "EUR" &&
    titelPasstExakt(treffer.title, { marke, modell, variante, kategorie })
  ));
  const preise = treffer
    .map((t) => t.price && Number(t.price.value))
    .filter((p) => Number.isFinite(p) && p > 0);

  // Erste 5 Rohtreffer (Titel/Preis/Zustand/Item-ID) für Diagnosezwecke, z. B. über
  // --debug-treffer=id:variante in scripts/update-ankaufspreise.js, damit z. B. eine zu
  // knappe Neuware-Trefferzahl (condition NEW) direkt im Log nachvollziehbar ist.
  const rohtreffer = rohdaten.slice(0, 10).map((t) => ({
    titel: t.title,
    preis: t.price && t.price.value,
    zustand: t.condition,
    itemId: t.itemId,
    akzeptiert: !!(t.price && t.price.currency === "EUR" &&
      titelPasstExakt(t.title, { marke, modell, variante, kategorie })),
  }));

  return {
    preise,
    gesamtTreffer: treffer.length,
    gesamtTrefferRoh: rohdaten.length,
    suchstring,
    rohtreffer,
  };
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
  const medianWert = median(basis);
  const q1 = quantil(sortiert, 0.25);
  const q3 = quantil(sortiert, 0.75);

  return {
    medianVorFilter,
    medianNachFilter: medianWert,
    anzahlVorFilter: sortiert.length,
    anzahlNachFilter: basis.length,
    q1,
    q3,
    streuungProzent: medianWert > 0 ? (q3 - q1) / medianWert : Infinity,
  };
}

function quantil(sortierteListe, anteil) {
  if (!sortierteListe.length) return 0;
  const position = (sortierteListe.length - 1) * anteil;
  const unten = Math.floor(position);
  const oben = Math.ceil(position);
  if (unten === oben) return sortierteListe[unten];
  const gewicht = position - unten;
  return sortierteListe[unten] * (1 - gewicht) + sortierteListe[oben] * gewicht;
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
  titelPasstExakt,
};

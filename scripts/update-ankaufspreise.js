/**
 * Vollautomatisches, tägliches Ankaufspreis-Update auf Basis echter Marktdaten.
 * Datenquelle austauschbar (eBay | bezahlte Such-API | Mock, siehe scripts/lib/search-client.js).
 * Ersetzt schrittweise die Schätzformel aus pricing-config.js durch zwei echte Marktanker
 * je Gerät+Variante (gebraucht/neu), gefolgt vom Wettbewerbs-Abstand (siehe
 * scripts/ankaufspreis-config.js), damit der Ankaufspreis bewusst unter dem Niveau der
 * Online-Ankaufsportale liegt.
 *
 * Ausführen:
 *   node scripts/update-ankaufspreise.js                 (Live-Lauf, braucht Secrets)
 *   node scripts/update-ankaufspreise.js --dry-run        (rechnet+loggt, schreibt nichts)
 *   node scripts/update-ankaufspreise.js --dry-run --mock (wie oben, erzwingt Mock-Daten)
 *   node scripts/update-ankaufspreise.js --quelle=ebay|search-api|mock
 *       (Datenquelle erzwingen statt Auto-Erkennung anhand vorhandener Secrets)
 *   node scripts/update-ankaufspreise.js --dry-run --nur=kat-0024:128 GB,kat-0016:128 GB
 *       (nur die angegebenen Geräte+Varianten verarbeiten, ignoriert Rotation/Budget -
 *        für gezielte Demo-/Testläufe)
 *   node scripts/update-ankaufspreise.js --dry-run --nur=kat-0024:128 GB --debug-treffer=kat-0024:128 GB
 *       (gibt zusätzlich den abgesetzten Suchstring + die ersten 5 Rohtreffer (Titel/Preis/
 *        Quelle) für genau dieses Gerät+Variante aus - zur Diagnose bei zu wenigen Treffern)
 *
 * Sicherheitsregeln (siehe CLAUDE.md + Anforderungsspezifikation):
 *   1. preisQuelle:"manuell" wird nie angefasst.
 *   2. Tagesbremse ±10 %/Tag (Ausnahme: allererster echter Marktlauf eines Geräts, s. u.).
 *   3. Konsistenzregel 1: Ankaufspreis nie über eigenem Verkaufspreis (bestand.json).
 *   4. Konsistenzregel 2: marktwertNeu muss > marktwertGebraucht sein, sonst Skip.
 *   5. validate-data.js muss nach der Berechnung grün sein, sonst kein Commit/Schreiben.
 *   6. API-Ausfall/Fehler: alte Preise bleiben unverändert, sichtbarer Fehlschlag.
 *   7. Globaler Preisregler (pricing-niveau.json, ±15 %) wirkt zusätzlich obendrauf.
 *
 * Mock-Modus ist NUR zusammen mit --dry-run erlaubt - ein echter (schreibender) Lauf
 * ohne echte Secrets bricht bewusst ab, statt versehentlich Fantasiepreise in die
 * echten Datendateien zu schreiben.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const pricing = require("../pricing-config");
const config = require("./ankaufspreis-config");
const searchClient = require("./lib/search-client");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const BESTAND_FILE = path.join(ROOT, "bestand.json");
const ROTATION_STATE_FILE = path.join(__dirname, "rotation-state.json");
const BUDGET_STATE_FILE = path.join(__dirname, "api-budget-state.json");
const META_FILE = path.join(ROOT, "preisupdate-meta.json");
const LOGS_DIR = path.join(ROOT, "logs");
const VALIDATE_SCRIPT = path.join(ROOT, "validate-data.js");

const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

const ANKAUF_KOMMENTAR =
  "AUTO-PREISE aus echten Marktdaten (bezahlte Such-API oder eBay, austauschbar - siehe " +
  "scripts/lib/search-client.js) - siehe scripts/update-ankaufspreise.js + " +
  "scripts/ankaufspreis-config.js. Je Gerät+Variante zwei Marktanker (gebraucht/neu), " +
  "Ausreißerfilter + Median + Abschlag, 5 Ankaufsstufen als feste Prozentsätze davon, " +
  "danach Wettbewerbs-Abstand (gestaffelter Abzug unter das Niveau der Online-Ankaufsportale), " +
  "zusätzlich global verschiebbar über pricing-niveau.json. preisQuelle \"manuell\" wird nie " +
  "automatisch überschrieben. Geräte, die noch keinen echten Marktlauf hatten (marktwertQuelle " +
  "\"geschaetzt\" im Katalog), tragen weiterhin die ältere Schätzformel aus pricing-config.js, " +
  "bis sie an der Reihe sind (siehe Rotation, scripts/rotation-state.json).";

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const mockErzwungen = argv.includes("--mock");
  const quelleArg = argv.find((a) => a.startsWith("--quelle="));
  const quelleErzwungen = quelleArg ? quelleArg.slice("--quelle=".length).trim() : null;
  const nurArg = argv.find((a) => a.startsWith("--nur="));
  const nur = nurArg
    ? nurArg.slice("--nur=".length).split(",").map((paar) => {
        const [id, bezeichnung] = paar.split(":");
        return { id: (id || "").trim(), bezeichnung: (bezeichnung || "").trim() };
      })
    : null;
  const debugTrefferArg = argv.find((a) => a.startsWith("--debug-treffer="));
  const debugTreffer = debugTrefferArg
    ? (() => {
        const [id, bezeichnung] = debugTrefferArg.slice("--debug-treffer=".length).split(":");
        return { id: (id || "").trim(), bezeichnung: (bezeichnung || "").trim() };
      })()
    : null;
  return { dryRun, mockErzwungen, quelleErzwungen, nur, debugTreffer };
}

function heutigesDatum() {
  return new Date().toISOString().slice(0, 10);
}

function ladeJson(datei, fallback) {
  if (!fs.existsSync(datei)) return fallback;
  const inhalt = fs.readFileSync(datei, "utf8");
  if (!inhalt.trim()) return fallback;
  return JSON.parse(inhalt);
}

// ---------------------------------------------------------------------------
// Monats-Budget der bezahlten Such-API mitzählen + bei 80% warnen (Anforderung 4).
// ---------------------------------------------------------------------------
function aktualisiereApiBudget({ datum, calls }) {
  const aktuellerMonat = datum.slice(0, 7); // "YYYY-MM"
  const stand = ladeJson(BUDGET_STATE_FILE, { monat: aktuellerMonat, verbraucht: 0 });
  const verbraucht = (stand.monat === aktuellerMonat ? stand.verbraucht : 0) + calls;

  fs.writeFileSync(BUDGET_STATE_FILE, JSON.stringify({ monat: aktuellerMonat, verbraucht }, null, 2) + "\n", "utf8");

  const anteil = config.API_BUDGET_MONATLICH > 0 ? verbraucht / config.API_BUDGET_MONATLICH : 0;
  console.log(
    "Such-API-Budget diesen Monat: " + verbraucht + "/" + config.API_BUDGET_MONATLICH +
    " (" + Math.round(anteil * 100) + "%)"
  );
  if (anteil >= config.API_BUDGET_WARNSCHWELLE) {
    console.warn(
      "⚠️  Such-API-Budget: " + Math.round(anteil * 100) + "% des Monatskontingents verbraucht (" +
      verbraucht + "/" + config.API_BUDGET_MONATLICH + ")."
    );
  }
}

// ---------------------------------------------------------------------------
// Rotation / Budget-Auswahl (Anforderung E)
// ---------------------------------------------------------------------------
function waehleHeutigeGeraete({ katalog, ankaufAltById, rotationState, nurFilter }) {
  if (nurFilter) {
    const nurIds = new Set(nurFilter.map((n) => n.id));
    return {
      heutigeIds: nurIds,
      neuerRotationIndex: rotationState.naechsterIndex,
      rotationsGroesse: 0,
      rotationsGesamt: 0,
    };
  }

  const beliebtIds = new Set(
    katalog.filter((g) => (ankaufAltById.get(g.id) || {}).beliebt).map((g) => g.id)
  );
  const nichtBeliebtIds = katalog
    .map((g) => g.id)
    .filter((id) => !beliebtIds.has(id))
    .sort();

  const scheibenGroesse = nichtBeliebtIds.length ? Math.max(1, Math.ceil(nichtBeliebtIds.length / 7)) : 0;
  const startIndex = nichtBeliebtIds.length ? rotationState.naechsterIndex % nichtBeliebtIds.length : 0;

  const rotationsAuswahl = [];
  for (let i = 0; i < Math.min(scheibenGroesse, nichtBeliebtIds.length); i++) {
    rotationsAuswahl.push(nichtBeliebtIds[(startIndex + i) % nichtBeliebtIds.length]);
  }
  const neuerRotationIndex = nichtBeliebtIds.length
    ? (startIndex + rotationsAuswahl.length) % nichtBeliebtIds.length
    : 0;

  return {
    heutigeIds: new Set([...beliebtIds, ...rotationsAuswahl]),
    neuerRotationIndex,
    rotationsGroesse: rotationsAuswahl.length,
    rotationsGesamt: nichtBeliebtIds.length,
  };
}

// ---------------------------------------------------------------------------
// Marktabfrage (Datenquelle austauschbar, siehe lib/search-client.js) + Ausreißerfilter/
// Median + Abschlag
// ---------------------------------------------------------------------------
async function holeMarktwert({ geraet, variante, zustand, zugangskontext, budgetZaehler, debugTreffer }) {
  const ergebnis = await searchClient.sucheMarkt({ zugangskontext, geraet, variante, zustand, budgetZaehler });

  if (debugTreffer) {
    console.log(
      "\n[DEBUG] " + geraet.marke + " " + geraet.modell + " (" + variante.bezeichnung + ") – " + zustand + "\n" +
      "  Suchstring: " + (ergebnis.suchstring || "(kein suchstring von dieser Quelle geliefert)") + "\n" +
      "  Rohtreffer (erste " + (ergebnis.rohtreffer ? ergebnis.rohtreffer.length : 0) + "): " +
      JSON.stringify(ergebnis.rohtreffer || [], null, 2)
    );
  }

  const mindestTreffer = zustand === "NEW" ? config.MIN_TREFFER_NEU : config.MIN_TREFFER_GEBRAUCHT;
  if (ergebnis.preise.length < mindestTreffer) {
    return { treffer: ergebnis.preise.length, marktwert: null, quartil: null };
  }

  const quartil = searchClient.quartilMedian(ergebnis.preise, config.QUARTIL_KAPPEN);
  const abschlag = zustand === "NEW" ? config.ABSCHLAG_NEU : config.ABSCHLAG_GEBRAUCHT;
  const marktwert = quartil.medianNachFilter * (1 - abschlag);
  return { treffer: ergebnis.preise.length, marktwert, quartil, abschlag };
}

// ---------------------------------------------------------------------------
// 5 Ankaufsstufen berechnen + Wettbewerbs-Abstand + Tagesbremse + Konsistenzregel 1
// ---------------------------------------------------------------------------
function berechneStufen({ marktwertGebraucht, marktwertNeu, niveauFaktor }) {
  const stufen = {};
  pricing.ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    const basis = stufe === "neuVersiegelt" ? marktwertNeu : marktwertGebraucht;
    stufen[stufe] = basis == null ? null : pricing.rundeAuf5(basis * config.ANKAUF_PROZENTSAETZE_MARKT[stufe] * niveauFaktor);
  });
  return stufen;
}

function rundeWettbewerb(zahl) {
  return Math.max(config.WETTBEWERB_MINDESTPREIS, Math.round(zahl / config.WETTBEWERB_RUNDUNG) * config.WETTBEWERB_RUNDUNG);
}

// Wettbewerbs-Abstand (siehe ankaufspreis-config.js): nach der reinen Formel-Berechnung
// gestaffelter Abzug, damit der Ankaufspreis bewusst unter dem Niveau der Online-
// Ankaufsportale liegt. Wirkt je Zustandsstufe unabhängig, anhand des jeweils EIGENEN
// berechneten (Vor-Abzug-)Preises dieser Stufe. Globaler Deckel (WETTBEWERB_MAX_ABZUG_PROZENT)
// gilt für alle Stufen, damit ein fester Euro-Abzug bei günstigen Geräten nicht
// überproportional viel Prozent des Preises frisst.
function wendeWettbewerbsAbstandAn(stufenRoh) {
  const stufenNachAbstand = {};
  pricing.ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    const wert = stufenRoh[stufe];
    if (wert == null) {
      stufenNachAbstand[stufe] = null;
      return;
    }
    let abzug = wert <= config.WETTBEWERB_SCHWELLE_1 ? config.WETTBEWERB_ABZUG_BIS_100
      : wert <= config.WETTBEWERB_SCHWELLE_2 ? config.WETTBEWERB_ABZUG_100_BIS_200
      : wert <= config.WETTBEWERB_SCHWELLE_3 ? config.WETTBEWERB_ABZUG_200_BIS_500
      : config.WETTBEWERB_ABZUG_UEBER_500;
    abzug = Math.min(abzug, wert * config.WETTBEWERB_MAX_ABZUG_PROZENT);
    stufenNachAbstand[stufe] = rundeWettbewerb(wert - abzug);
  });
  return stufenNachAbstand;
}

function wendeTagesbremseAn({ stufenRoh, altPreise, istErsterLauf }) {
  const stufenFinal = {};
  const pruefenGruende = [];
  pricing.ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    let wert = stufenRoh[stufe];
    if (wert == null) {
      stufenFinal[stufe] = null;
      return;
    }
    const alterWert = altPreise && Number(altPreise[stufe]);
    if (!istErsterLauf && Number.isFinite(alterWert) && alterWert > 0) {
      const maxDelta = alterWert * config.TAGESBREMSE_PROZENT;
      if (wert > alterWert + maxDelta) {
        wert = pricing.rundeAuf5(alterWert + maxDelta);
        pruefenGruende.push(stufe + ": Tagesbremse (+" + Math.round(config.TAGESBREMSE_PROZENT * 100) + "%) gekappt");
      } else if (wert < alterWert - maxDelta) {
        wert = pricing.rundeAuf5(alterWert - maxDelta);
        pruefenGruende.push(stufe + ": Tagesbremse (-" + Math.round(config.TAGESBREMSE_PROZENT * 100) + "%) gekappt");
      }
    }
    stufenFinal[stufe] = wert;
  });
  return { stufenFinal, pruefenGruende };
}

function wendeKonsistenzregel1An({ stufenFinal, geraet, variante, bestandListe }) {
  const pruefenGruende = [];
  pricing.ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    if (stufenFinal[stufe] == null) return;
    const zustandKey = stufe === "neuVersiegelt" ? "neu" : "gebraucht";
    const eigenerPreis = pricing.findeEigenenVerkaufspreis(bestandListe, geraet, variante, zustandKey);
    if (eigenerPreis != null && stufenFinal[stufe] > eigenerPreis) {
      stufenFinal[stufe] = pricing.rundeAuf5(eigenerPreis);
      pruefenGruende.push(stufe + ": über eigenem Verkaufspreis (" + eigenerPreis + " €) gekappt");
    }
  });
  return pruefenGruende;
}

// ---------------------------------------------------------------------------
// Hauptlogik je Variante - gibt { variante-Objekt für ankauf-preise.json,
// protokollEintrag } zurück.
// ---------------------------------------------------------------------------
async function verarbeiteVariante({ geraet, variante, altVariante, zugangskontext, budgetZaehler, niveauFaktor, bestandListe, log, debugTreffer }) {
  const basis = { marke: geraet.marke, modell: geraet.modell, variante: variante.bezeichnung };

  if (altVariante && altVariante.preisQuelle === "manuell") {
    return { variante: altVariante, protokoll: { typ: "uebersprungen", ...basis, grund: "preisQuelle ist 'manuell'" } };
  }

  let gebraucht;
  let neu;
  try {
    gebraucht = await holeMarktwert({ geraet, variante, zustand: "USED", zugangskontext, budgetZaehler, debugTreffer });
  } catch (e) {
    if (e instanceof searchClient.BudgetErschoepftFehler) {
      return { variante: altVariante || bauePlatzhalterVariante(variante), protokoll: { typ: "uebersprungen", ...basis, grund: "Tagesbudget erschöpft" } };
    }
    throw e;
  }

  if (gebraucht.marktwert == null) {
    return {
      variante: altVariante || bauePlatzhalterVariante(variante),
      protokoll: { typ: "uebersprungen", ...basis, grund: "zu wenige Gebraucht-Treffer (" + gebraucht.treffer + " < " + config.MIN_TREFFER_GEBRAUCHT + ")" },
    };
  }

  try {
    neu = await holeMarktwert({ geraet, variante, zustand: "NEW", zugangskontext, budgetZaehler, debugTreffer });
  } catch (e) {
    if (e instanceof searchClient.BudgetErschoepftFehler) {
      return { variante: altVariante || bauePlatzhalterVariante(variante), protokoll: { typ: "uebersprungen", ...basis, grund: "Tagesbudget erschöpft (nach Gebraucht-Anfrage)" } };
    }
    throw e;
  }

  const marktwertNeu = neu.marktwert; // null erlaubt (Anforderung B)

  if (marktwertNeu != null && marktwertNeu <= gebraucht.marktwert) {
    return {
      variante: altVariante || bauePlatzhalterVariante(variante),
      protokoll: { typ: "uebersprungen", ...basis, grund: "Datenfehler: marktwertNeu (" + Math.round(marktwertNeu) + " €) <= marktwertGebraucht (" + Math.round(gebraucht.marktwert) + " €)" },
    };
  }

  const stufenRoh = berechneStufen({ marktwertGebraucht: gebraucht.marktwert, marktwertNeu, niveauFaktor });
  const stufenNachAbstand = wendeWettbewerbsAbstandAn(stufenRoh);
  const istErsterLauf = !geraet.marktwertQuelle || geraet.marktwertQuelle === "geschaetzt";
  const { stufenFinal, pruefenGruende: bremseGruende } = wendeTagesbremseAn({
    stufenRoh: stufenNachAbstand, altPreise: altVariante && altVariante.preise, istErsterLauf,
  });
  const konsistenzGruende = wendeKonsistenzregel1An({ stufenFinal, geraet, variante, bestandListe });
  const alleGruende = [...bremseGruende, ...konsistenzGruende];

  const neueVariante = { bezeichnung: variante.bezeichnung, uvpDelta: variante.uvpDelta, preise: stufenFinal, preisQuelle: "auto" };

  const rechnung = {
    ...basis,
    gebrauchtTreffer: gebraucht.treffer,
    gebrauchtMedianVor: gebraucht.quartil.medianVorFilter,
    gebrauchtMedianNach: gebraucht.quartil.medianNachFilter,
    marktwertGebraucht: gebraucht.marktwert,
    neuTreffer: neu.treffer,
    neuMedianVor: neu.quartil && neu.quartil.medianVorFilter,
    neuMedianNach: neu.quartil && neu.quartil.medianNachFilter,
    marktwertNeu,
    stufenVorAbstand: stufenRoh,
    stufenNachAbstand,
    stufen: stufenFinal,
    altStufen: altVariante && altVariante.preise,
    istErsterLauf,
    gruende: alleGruende,
  };

  if (log) log(rechnung);

  return {
    variante: neueVariante,
    protokoll: { typ: alleGruende.length ? "pruefen" : "aktualisiert", ...basis, gruende: alleGruende, rechnung },
    marktwerte: { marktwertGebraucht: gebraucht.marktwert, marktwertNeu },
  };
}

function bauePlatzhalterVariante(variante) {
  return { bezeichnung: variante.bezeichnung, uvpDelta: variante.uvpDelta, preise: {
    neuVersiegelt: null, wieNeu: 0, sehrGut: 0, gut: 0, defekt: 0,
  }, preisQuelle: "auto" };
}

// ---------------------------------------------------------------------------
// Logging (Markdown)
// ---------------------------------------------------------------------------
function formatiereRechnung(r) {
  const zeilen = [];
  zeilen.push("**" + r.marke + " " + r.modell + " (" + r.variante + ")**" + (r.istErsterLauf ? " _(erster echter Marktlauf – Tagesbremse übersprungen)_" : ""));
  zeilen.push("- Gebraucht: " + r.gebrauchtTreffer + " Treffer, Median vor Filter " + rund(r.gebrauchtMedianVor) + " €, nach Filter " + rund(r.gebrauchtMedianNach) + " € → marktwertGebraucht " + rund(r.marktwertGebraucht) + " € (−" + Math.round(config.ABSCHLAG_GEBRAUCHT * 100) + "%)");
  if (r.marktwertNeu != null) {
    zeilen.push("- Neu: " + r.neuTreffer + " Treffer, Median vor Filter " + rund(r.neuMedianVor) + " €, nach Filter " + rund(r.neuMedianNach) + " € → marktwertNeu " + rund(r.marktwertNeu) + " € (−" + Math.round(config.ABSCHLAG_NEU * 100) + "%)");
  } else {
    zeilen.push("- Neu: " + r.neuTreffer + " Treffer (< " + config.MIN_TREFFER_NEU + ") → marktwertNeu = null (Stufe „Neu & versiegelt\" wird ausgeblendet)");
  }
  zeilen.push("- Stufen (berechnet → nach Wettbewerbs-Abstand → final nach Tagesbremse/Konsistenz):");
  pricing.ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    const vor = r.stufenVorAbstand && r.stufenVorAbstand[stufe];
    const nach = r.stufenNachAbstand && r.stufenNachAbstand[stufe];
    const alt = r.altStufen && r.altStufen[stufe];
    zeilen.push(
      "  - " + stufe + ": " +
      (vor == null ? "–" : rund(vor) + " €") + " → " +
      (nach == null ? "–" : rund(nach) + " €") +
      (alt != null ? " (bisher " + rund(alt) + " €)" : "") +
      " → final " + (r.stufen[stufe] == null ? "–" : rund(r.stufen[stufe]) + " €")
    );
  });
  if (r.gruende.length) {
    zeilen.push("- **Ausgelöste Regeln:** " + r.gruende.join("; "));
  } else {
    zeilen.push("- Ausgelöste Regeln: keine");
  }
  return zeilen.join("\n");
}

function rund(zahl) {
  return Number.isFinite(zahl) ? Math.round(zahl) : "–";
}

function schreibeLog({ datum, protokolle, dryRun }) {
  const pruefen = protokolle.filter((p) => p.typ === "pruefen");
  const aktualisiert = protokolle.filter((p) => p.typ === "aktualisiert");
  const uebersprungen = protokolle.filter((p) => p.typ === "uebersprungen");

  const teile = [];
  teile.push("# Preisupdate " + datum + (dryRun ? " (DRY-RUN – keine Datei geändert)" : ""));
  teile.push("");
  teile.push("Aktualisiert: " + aktualisiert.length + " · Übersprungen: " + uebersprungen.length + " · PRÜFEN: " + pruefen.length);
  teile.push("");

  if (pruefen.length) {
    teile.push("## ⚠️ PRÜFEN (" + pruefen.length + ")");
    pruefen.forEach((p) => teile.push(formatiereRechnung(p.rechnung), ""));
  }

  teile.push("## Aktualisiert (" + aktualisiert.length + ")");
  aktualisiert.forEach((p) => teile.push(formatiereRechnung(p.rechnung), ""));

  teile.push("## Übersprungen (" + uebersprungen.length + ")");
  uebersprungen.forEach((p) => teile.push("- " + p.marke + " " + p.modell + " (" + p.variante + "): " + p.grund));

  const inhalt = teile.join("\n") + "\n";

  if (dryRun) {
    console.log("\n" + inhalt);
    return null;
  }

  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const zielpfad = path.join(LOGS_DIR, "preisupdate-" + datum + ".md");
  fs.writeFileSync(zielpfad, inhalt, "utf8");
  return zielpfad;
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------
async function main() {
  const { dryRun, mockErzwungen, quelleErzwungen, nur, debugTreffer } = parseArgs(process.argv.slice(2));
  const quelle = searchClient.bestimmeDatenquelle({
    quelleErzwungen: quelleErzwungen || (mockErzwungen ? searchClient.DATENQUELLEN.MOCK : null),
  });
  const mockModus = quelle === searchClient.DATENQUELLEN.MOCK;

  if (mockModus && !dryRun) {
    console.error(
      "Abbruch: Mock-Modus ist nur zusammen mit --dry-run erlaubt.\n" +
      (mockErzwungen || quelleErzwungen ? "Mock wurde explizit erzwungen, aber " : "Weder SEARCH_API_KEY noch EBAY_CLIENT_ID/EBAY_CLIENT_SECRET gefunden, und ") +
      "ein echter (schreibender) Lauf ohne echte Marktdaten würde Fantasiepreise in die " +
      "Datendateien schreiben. Zugang einrichten: siehe SEARCH-API-SETUP.md (oder EBAY-SETUP.md für eBay)."
    );
    process.exit(1);
  }
  if (mockModus) {
    console.log(
      (mockErzwungen || quelleErzwungen)
        ? "Mock-Modus erzwungen."
        : "Keine SEARCH_API_KEY/EBAY_CLIENT_ID/EBAY_CLIENT_SECRET gefunden – nutze Mock-Marktdaten (siehe SEARCH-API-SETUP.md für echten Zugang)."
    );
  } else {
    console.log("Datenquelle: " + quelle + ".");
  }

  const katalog = ladeJson(KATALOG_FILE, []);
  const ankaufRohAlt = ladeJson(ANKAUF_FILE, []);
  const ankaufAlt = ankaufRohAlt.filter((d) => d && d.id);
  const ankaufAltById = new Map(ankaufAlt.map((g) => [g.id, g]));
  const bestandListe = ladeJson(BESTAND_FILE, []);
  const rotationState = ladeJson(ROTATION_STATE_FILE, { naechsterIndex: 0, letzterLauf: null });

  const { heutigeIds, neuerRotationIndex, rotationsGroesse, rotationsGesamt } = waehleHeutigeGeraete({
    katalog, ankaufAltById, rotationState, nurFilter: nur,
  });
  console.log(
    "Heute ausgewählt: " + heutigeIds.size + " Gerät(e)" +
    (nur ? " (--nur-Filter aktiv)" : " (davon Rotationsscheibe " + rotationsGroesse + "/" + rotationsGesamt + ")")
  );

  const budgetZaehler = mockModus ? null : searchClient.erstelleBudgetZaehler(config.API_BUDGET_TAEGLICH);
  const zugangskontext = await searchClient.holeZugangskontext(quelle);

  const niveauFaktor = 1 + pricing.liesAnkaufsniveau() / 100;
  const datum = heutigesDatum();
  const protokolle = [];
  const katalogUpdates = new Map(); // id -> { marktwertGebraucht, marktwertNeu }
  const ergebnisListe = [];

  for (const geraet of katalog) {
    const altGeraet = ankaufAltById.get(geraet.id);
    const variantenGefiltert = nur
      ? geraet.varianten.filter((v) => nur.some((n) => n.id === geraet.id && n.bezeichnung === v.bezeichnung))
      : geraet.varianten;
    const wirdHeuteAktualisiert = heutigeIds.has(geraet.id) && variantenGefiltert.length > 0;

    if (!wirdHeuteAktualisiert) {
      ergebnisListe.push(altGeraet ? altGeraet : baueBootstrapEintrag(geraet, bestandListe));
      continue;
    }

    const neueVarianten = [];
    for (const variante of geraet.varianten) {
      const nurVerarbeiten = !nur || variantenGefiltert.includes(variante);
      const altVariante = altGeraet && altGeraet.varianten.find((v) => v.bezeichnung === variante.bezeichnung);

      if (!nurVerarbeiten) {
        neueVarianten.push(altVariante || bauePlatzhalterVariante(variante));
        continue;
      }

      const debugTrifftZu = !!(debugTreffer && debugTreffer.id === geraet.id && debugTreffer.bezeichnung === variante.bezeichnung);
      const ergebnis = await verarbeiteVariante({
        geraet, variante, altVariante, zugangskontext, budgetZaehler, niveauFaktor, bestandListe,
        log: (r) => { if (dryRun) console.log("\n" + formatiereRechnung(r)); },
        debugTreffer: debugTrifftZu,
      });
      neueVarianten.push(ergebnis.variante);
      protokolle.push(ergebnis.protokoll);

      if (ergebnis.marktwerte && variante.uvpDelta === 0) {
        katalogUpdates.set(geraet.id, ergebnis.marktwerte);
      }
    }

    ergebnisListe.push({
      id: geraet.id,
      kategorie: geraet.kategorie,
      marke: geraet.marke,
      modell: geraet.modell,
      jahr: geraet.jahr,
      neupreisUvp: geraet.uvp,
      beliebt: altGeraet ? !!altGeraet.beliebt : false,
      varianten: neueVarianten,
    });
  }

  // geraete-katalog.json: nur betroffene Felder ergänzen, Rest 1:1 durchreichen.
  const katalogNeu = katalog.map((g) => {
    const update = katalogUpdates.get(g.id);
    if (!update) return g;
    return {
      ...g,
      marktwertGebraucht: Math.round(update.marktwertGebraucht),
      marktwertNeu: update.marktwertNeu == null ? null : Math.round(update.marktwertNeu),
      marktwertQuelle: quelle + "-auto",
      marktDatenStand: datum,
    };
  });

  const aktualisiertAnzahl = protokolle.filter((p) => p.typ === "aktualisiert").length;
  const uebersprungenAnzahl = protokolle.filter((p) => p.typ === "uebersprungen").length;
  const pruefenAnzahl = protokolle.filter((p) => p.typ === "pruefen").length;

  console.log(
    "\nZusammenfassung: " + aktualisiertAnzahl + " Geräte aktualisiert, " +
    uebersprungenAnzahl + " übersprungen, " + pruefenAnzahl + " PRÜFEN-Fälle."
  );

  if (quelle === searchClient.DATENQUELLEN.SEARCH_API && budgetZaehler) {
    aktualisiereApiBudget({ datum, calls: budgetZaehler.verbraucht });
  }

  schreibeLog({ datum, protokolle, dryRun });

  if (dryRun) {
    console.log("\nDry-Run beendet: keine Datei geschrieben, kein Commit.");
    return;
  }

  // --- Schreiben (mit In-Memory-Originalen für Rollback bei Validierungsfehler) ---
  const originale = new Map();
  function merkeOriginal(datei) {
    if (fs.existsSync(datei)) originale.set(datei, fs.readFileSync(datei, "utf8"));
  }
  [KATALOG_FILE, ANKAUF_FILE, ...KATEGORIEN.map((k) => path.join(SPLIT_DIR, k + ".json"))].forEach(merkeOriginal);

  backupIfChanged(KATALOG_FILE);
  fs.writeFileSync(KATALOG_FILE, JSON.stringify(katalogNeu, null, 2) + "\n", "utf8");

  backupIfChanged(ANKAUF_FILE);
  fs.writeFileSync(ANKAUF_FILE, JSON.stringify([{ _kommentar: ANKAUF_KOMMENTAR }, ...ergebnisListe], null, 2) + "\n", "utf8");

  fs.mkdirSync(SPLIT_DIR, { recursive: true });
  KATEGORIEN.forEach((k) => {
    const teilliste = ergebnisListe.filter((g) => g.kategorie === k);
    const zielpfad = path.join(SPLIT_DIR, k + ".json");
    backupIfChanged(zielpfad);
    fs.writeFileSync(zielpfad, JSON.stringify(teilliste), "utf8");
  });

  // --- Validierung (Regel 5): schlägt sie fehl, alles zurückrollen, kein Commit ---
  try {
    execFileSync("node", [VALIDATE_SCRIPT], { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    console.error("\nvalidate-data.js ist fehlgeschlagen – rolle alle Änderungen zurück, kein Commit.");
    originale.forEach((inhalt, datei) => fs.writeFileSync(datei, inhalt, "utf8"));
    process.exit(1);
  }

  // --- Erst jetzt Rotation-State + Meta schreiben (nur bei grüner Validierung) ---
  fs.writeFileSync(ROTATION_STATE_FILE, JSON.stringify({ naechsterIndex: neuerRotationIndex, letzterLauf: datum }, null, 2) + "\n", "utf8");
  fs.writeFileSync(META_FILE, JSON.stringify({
    datum, aktualisiert: aktualisiertAnzahl, uebersprungen: uebersprungenAnzahl, pruefen: pruefenAnzahl,
  }, null, 2) + "\n", "utf8");

  console.log("\nFertig. validate-data.js grün, Dateien geschrieben.");
}

function baueBootstrapEintrag(geraet, bestandListe) {
  const varianten = geraet.varianten.map((v) => {
    const berechnung = pricing.berechnePreise(geraet, v, bestandListe);
    return { bezeichnung: v.bezeichnung, uvpDelta: v.uvpDelta, preise: berechnung.preise, preisQuelle: "auto" };
  });
  return {
    id: geraet.id, kategorie: geraet.kategorie, marke: geraet.marke, modell: geraet.modell,
    jahr: geraet.jahr, neupreisUvp: geraet.uvp, beliebt: false, varianten,
  };
}

main().catch((e) => {
  console.error("Unerwarteter Fehler, keine Preise verändert:", e);
  process.exit(1);
});

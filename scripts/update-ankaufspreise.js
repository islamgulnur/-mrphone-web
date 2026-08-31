/**
 * Vollautomatisches, tägliches Ankaufspreis-Update auf Basis echter Marktdaten.
 * Datenquelle: eBay Browse API (Marktplatz EBAY_DE), siehe scripts/lib/search-client.js.
 * Neuware wird zusätzlich mit einem exakt erkannten öffentlichen Avatel-Tagespreis gedeckelt;
 * siehe scripts/lib/competitor-client.js. Unklare oder fehlende Treffer ändern nichts.
 * Ermittelt zwei echte Marktanker je Gerät+Variante (gebraucht/neu) und wendet darauf die
 * Zustands-Prozentsätze aus pricing-config.js an (ANKAUF_PROZENTSAETZE_APPLE / _REST,
 * prozentsaetzeFuerMarke() - je nach Marke, EINZIGE Quelle für diese Prozentsätze).
 *
 * Bereinigt am 28.07.2026: Der frühere "Wettbewerbs-Abstand" (gestaffelter Euro-Abzug) und die
 * frühere "Markenkorrektur" (Apple-Faktor 1,40/1,15, Samsung-Faktor 0,78) sind vollständig
 * entfernt, ebenso die davon nötig gewordene Konsistenzregel 3 (Markt-Deckel) - sie
 * überlagerten sich und kollidierten bei hochpreisigen Geräten (siehe OFFENE-PUNKTE.md:
 * mehrere Zustandsstufen kollabierten auf denselben gekappten Preis). Da die Apple/Rest-
 * Prozentsätze in pricing-config.js ausschließlich Werte < 1,0 enthalten, kann eine Stufe
 * rechnerisch nie mehr über ihrem eigenen Marktanker landen - ein zusätzlicher Markt-Deckel
 * ist damit strukturell überflüssig.
 *
 * Ausführen:
 *   node scripts/update-ankaufspreise.js                 (Live-Lauf, braucht Secrets)
 *   node scripts/update-ankaufspreise.js --dry-run        (rechnet+loggt, schreibt nichts)
 *   node scripts/update-ankaufspreise.js --dry-run --mock (wie oben, erzwingt Mock-Daten)
 *   node scripts/update-ankaufspreise.js --quelle=ebay|mock
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
 *   3. Konsistenzregel 1 (EINZIGE verbleibende Sicherheitsregel neben neuVersiegelt):
 *      Harte Mindestmarge zum eigenen Verkaufspreis (bestand.json): Neu maximal 88 %, gebrauchte
 *      Stufen je nach Marke/Zustand maximal 20-80 %, zusaetzlich mindestens 15/20 Euro Abstand.
 *   4. Konsistenzregel 2: marktwertNeu muss > marktwertGebraucht sein, sonst Skip.
 *   5. validate-data.js muss nach der Berechnung grün sein, sonst kein Commit/Schreiben.
 *   6. API-Ausfall/Fehler: alte Preise bleiben unverändert, sichtbarer Fehlschlag.
 *   7. Globaler Preisregler (pricing-niveau.json, ±15 %) wirkt zusätzlich obendrauf.
 *   8. "neuVersiegelt" hat seit 28.07.2026 EINE EIGENE Formel (siehe pricing.berechneNeuVersiegelt(),
 *      Vorfall 27.07.2026 in OFFENE-PUNKTE.md) und durchläuft NICHT die Schritte 2-7 oben -
 *      stattdessen der niedrigere von: eigener Verkaufspreis × 0,88, ODER marktwertNeu × 0,82
 *      (hart gedeckelt auf marktwertNeu × 0,90). So kann diese Stufe strukturell nie mehr über
 *      dem eigenen Verkaufspreis oder über 90 % des eBay-Neupreises einkaufen.
 *   9. Zusätzlich seit 28.07.2026 (Fall "Nicht-Apple-Neupreise zu hoch", gilt für ALLE Marken):
 *      der frisch gescrapte marktwertNeu wird sofort gegen die UVP geprüft - liegt er über 115 %
 *      UVP, gilt er als Scraper-Kontamination (Bundle/falsche Variante) und wird verworfen
 *      (pricing.pruefeMarktwertNeuPlausibilitaet()). Der verbleibende Anker wird in
 *      berechneNeuVersiegelt() zusätzlich hart auf 100 % UVP gedeckelt.
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
const competitorClient = require("./lib/competitor-client");
const rebuyClient = require("./lib/rebuy-client");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const BESTAND_FILE = path.join(ROOT, "bestand.json");
const ROTATION_STATE_FILE = path.join(__dirname, "rotation-state.json");
const META_FILE = path.join(ROOT, "preisupdate-meta.json");
const LOGS_DIR = path.join(ROOT, "logs");
const VALIDATE_SCRIPT = path.join(ROOT, "validate-data.js");

const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

const ANKAUF_KOMMENTAR =
  "AUTO-PREISE aus echten eBay-Marktdaten plus öffentlichem Rebuy-Wiederverkaufswert als " +
  "kostenloser zweiter Gebrauchtmarkt-Quelle (siehe scripts/lib/search-client.js und " +
  "scripts/lib/rebuy-client.js). Erhöhungen bei Smartphones und Kopfhörern werden ohne " +
  "bestätigende zweite Quelle nicht veröffentlicht. " +
  "- siehe scripts/update-ankaufspreise.js + " +
  "scripts/ankaufspreis-config.js. Je Gerät+Variante zwei Marktanker (gebraucht/neu), " +
  "Ausreißerfilter + Median + Abschlag. defekt IMMER als fester, markenabhängiger Prozentsatz vom " +
  "Gebraucht-Marktanker (pricing-config.js: ANKAUF_PROZENTSAETZE_APPLE / _REST, einzige Quelle " +
  "dieser Prozentsätze). Kategorie \"smartphones\" (seit 06.08.2026, siehe OFFENE-PUNKTE.md): " +
  "neuVersiegelt = niedrigerer von eigenem Verkaufspreis × 0,88 / UVP × markenabhängigem " +
  "Prozentsatz (Apple 71%, Rest 50%, kalibriert auf 5 Avatel-Referenzpreise) / echtem " +
  "eBay-Marktwert × 0,90 (Korrektiv gegen Marktverfall, gedeckelt auf 100% UVP) - wieNeu/sehrGut/" +
  "gut leiten sich als Prozentsatz vom so ermittelten neuVersiegelt-Wert ab (ANKAUF_GEBRAUCHT_" +
  "PROZENT_VON_NEU_APPLE/_REST). Alle ANDEREN Kategorien: neuVersiegelt weiterhin die alte, rein " +
  "eBay-basierte Formel (pricing.berechneNeuVersiegelt(), seit 28.07.2026) - niedrigerer Wert von " +
  "eigenem Verkaufspreis × 0,88 ODER marktwertNeu × 0,82 (gedeckelt auf 90% von marktwertNeu), " +
  "wieNeu/sehrGut/gut als Prozentsatz vom Gebraucht-Marktanker. " +
  "Zusätzlich (alle Marken/Kategorien, keine Ausnahme): marktwertNeu > 115% UVP gilt als " +
  "kontaminiert und wird verworfen, verbleibender Anker zusätzlich hart auf 100% UVP gedeckelt. " +
  "Alles zusätzlich global verschiebbar über pricing-niveau.json. preisQuelle \"manuell\" wird " +
  "nie automatisch überschrieben. Geräte, die noch keinen echten Marktlauf hatten (marktwertQuelle " +
  "\"geschaetzt\" im Katalog), tragen weiterhin die ältere Schätzformel aus pricing-config.js, bis " +
  "sie an der Reihe sind (siehe Rotation, scripts/rotation-state.json). Ein exakt erkannter " +
  "öffentlicher Avatel-Neupreis ersetzt bei der Neuware-Berechnung den groben UVP-Anker und " +
  "wird mit gestaffeltem Zielabstand verwendet; Marktwert und eigener Verkaufspreis bleiben " +
  "zusätzliche Obergrenzen. Unklare Treffer werden verworfen.";

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
  if (quartil.streuungProzent > config.MAX_STREUUNG_PROZENT) {
    return {
      treffer: ergebnis.preise.length,
      marktwert: null,
      quartil,
      grund: "Preise zu stark gestreut (" + Math.round(quartil.streuungProzent * 100) + "% > " +
        Math.round(config.MAX_STREUUNG_PROZENT * 100) + "%)",
    };
  }
  const abschlag = zustand === "NEW" ? config.ABSCHLAG_NEU : config.ABSCHLAG_GEBRAUCHT;
  const marktwert = quartil.medianNachFilter * (1 - abschlag);
  return { treffer: ergebnis.preise.length, marktwert, quartil, abschlag };
}

// ---------------------------------------------------------------------------
// 4 Ankaufsstufen (ohne neuVersiegelt, siehe Regel 8 im Kommentarblock oben) berechnen +
// Tagesbremse + Konsistenzregel 1
// ---------------------------------------------------------------------------
// Markenabhängige Prozentsätze (pricing.prozentsaetzeFuerMarke - Apple/Rest, EINZIGE Quelle
// dieser Prozentsätze im Projekt) direkt auf den echten Gebraucht-Marktanker angewendet.
// Kein Wettbewerbs-Abstand, keine zusätzliche Markenkorrektur mehr (siehe Kommentarblock
// oben: bereinigt am 28.07.2026, überlagerten sich und kollidierten bei teuren Geräten).
function berechneStufen({ marktwertGebraucht, niveauFaktor, geraet }) {
  const prozentsaetze = pricing.prozentsaetzeFuerGeraet(geraet);
  const stufen = { neuVersiegelt: null }; // wird separat über pricing.berechneNeuVersiegelt() gesetzt
  pricing.ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    if (stufe === "neuVersiegelt") return;
    stufen[stufe] = marktwertGebraucht == null ? null : pricing.rundeAuf5(marktwertGebraucht * prozentsaetze[stufe] * niveauFaktor);
  });
  return stufen;
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

function wendeKonsistenzregel1An({ stufenFinal, geraet, variante, bestandListe, marktwertNeu, marktwertGebraucht }) {
  const eigenerNeu = pricing.findeEigenenVerkaufspreis(bestandListe, geraet, variante, "neu");
  const eigenerGebraucht = pricing.findeEigenenVerkaufspreis(bestandListe, geraet, variante, "gebraucht");
  const niedrigsterGueltigerWert = (...werte) => {
    const gueltig = werte.map(Number).filter((wert) => Number.isFinite(wert) && wert > 0);
    return gueltig.length ? Math.min(...gueltig) : null;
  };
  return pricing.wendeVkSicherheitsdeckelAn(stufenFinal, {
    neu: niedrigsterGueltigerWert(eigenerNeu, marktwertNeu),
    gebraucht: niedrigsterGueltigerWert(eigenerGebraucht, marktwertGebraucht),
  }, geraet).map((aenderung) => (
    aenderung.stufe + ": Mindestmarge zum niedrigsten VK-/Marktanker " + aenderung.verkaufspreis +
    " € eingehalten (maximal " + aenderung.neu + " €)"
  ));
}

// ---------------------------------------------------------------------------
// Hauptlogik je Variante - gibt { variante-Objekt für ankauf-preise.json,
// protokollEintrag } zurück.
// ---------------------------------------------------------------------------
async function verarbeiteVariante({ geraet, variante, altVariante, zugangskontext, budgetZaehler, niveauFaktor, bestandListe, log, debugTreffer, wettbewerbAktiv, rebuyAktiv }) {
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
        protokoll: { typ: "uebersprungen", ...basis, grund: gebraucht.grund || ("zu wenige Gebraucht-Treffer (" + gebraucht.treffer + " < " + config.MIN_TREFFER_GEBRAUCHT + ")") },
    };
  }

  const rebuy = rebuyAktiv
    ? await rebuyClient.holeRebuyGebraucht({
        geraet,
        variante,
        maxAnfragen: config.REBUY_MAX_ANFRAGEN_TAEGLICH,
      })
    : { quelle: "rebuy-vk", status: "deaktiviert", preis: null, treffer: 0 };
  const ebayMarktwertGebraucht = gebraucht.marktwert;
  const rebuyMarktwertGebraucht = rebuy.status === "ok"
    ? Number(rebuy.preis) * config.REBUY_VK_SICHERHEITSFAKTOR
    : null;
  const gebrauchtQuellenWarnungen = [];
  let gebrauchtQuellenBestaetigt = false;
  if (rebuyMarktwertGebraucht != null) {
    const kleiner = Math.min(ebayMarktwertGebraucht, rebuyMarktwertGebraucht);
    const groesser = Math.max(ebayMarktwertGebraucht, rebuyMarktwertGebraucht);
    const abweichung = kleiner > 0 ? (groesser - kleiner) / kleiner : Infinity;
    gebraucht.marktwert = kleiner;
    gebrauchtQuellenBestaetigt = abweichung <= config.MAX_QUELLEN_ABWEICHUNG;
    if (abweichung > config.MAX_QUELLEN_ABWEICHUNG) {
      gebrauchtQuellenWarnungen.push(
        "Gebrauchtquellen weichen " + Math.round(abweichung * 100) + "% ab; sicherheitshalber niedrigeren Anker verwendet"
      );
    }
  }

  try {
    neu = await holeMarktwert({ geraet, variante, zustand: "NEW", zugangskontext, budgetZaehler, debugTreffer });
  } catch (e) {
    if (e instanceof searchClient.BudgetErschoepftFehler) {
      return { variante: altVariante || bauePlatzhalterVariante(variante), protokoll: { typ: "uebersprungen", ...basis, grund: "Tagesbudget erschöpft (nach Gebraucht-Anfrage)" } };
    }
    throw e;
  }

  const uvpVariante = (Number(geraet.uvp) || 0) + (Number(variante.uvpDelta) || 0);
  // Leitplanke 2 (28.07.2026, siehe pricing-config.js): rohen, frisch gescrapten marktwertNeu
  // sofort gegen die Variante-UVP prüfen, BEVOR er weiterverwendet oder in den Katalog
  // zurückgeschrieben wird - kontaminierte Treffer (Bundles, falsche Variante, Sammlerpreise)
  // sollen erst gar nicht in den Datenbestand gelangen.
  const marktwertNeuRoh = neu.marktwert; // null erlaubt (Anforderung B)
  const marktwertNeu = pricing.pruefeMarktwertNeuPlausibilitaet(marktwertNeuRoh, uvpVariante);
  const marktwertNeuVerworfen = marktwertNeuRoh != null && marktwertNeu == null;

  if (marktwertNeu != null && marktwertNeu <= gebraucht.marktwert) {
    return {
      variante: altVariante || bauePlatzhalterVariante(variante),
      protokoll: { typ: "uebersprungen", ...basis, grund: "Datenfehler: marktwertNeu (" + Math.round(marktwertNeu) + " €) <= marktwertGebraucht (" + Math.round(gebraucht.marktwert) + " €)" },
    };
  }

  // Avatel ist als lokaler Frankfurter Wettbewerber die einzige der gewünschten
  // Quellen, die einen Neuware-Preis öffentlich und eindeutig auf der Produktseite
  // ausweist. Unklare Suchtreffer oder unplausible Werte werden nicht verwendet.
  const wettbewerb = wettbewerbAktiv
    ? await competitorClient.holeAvatelNeu({ geraet, variante })
    : { quelle: "avatel", status: "deaktiviert", preis: null };
  let wettbewerbsPreis = wettbewerb.status === "ok" ? Number(wettbewerb.preis) : null;
  if (wettbewerbsPreis != null) {
    const minimum = uvpVariante > 0 ? uvpVariante * 0.20 : 5;
    const maximum = uvpVariante > 0 ? uvpVariante * 1.10 : Infinity;
    if (wettbewerbsPreis < minimum || wettbewerbsPreis > maximum) {
      wettbewerb.status = "unplausibel";
      wettbewerb.preis = null;
      wettbewerbsPreis = null;
    }
  }
  const wettbewerbsZiel = config.wettbewerbsZiel(wettbewerbsPreis);

  // Regel 8 (siehe Kommentarblock oben): "neuVersiegelt" umgeht Tagesbremse komplett - eigene,
  // strukturell sichere Formel statt Prozentsatz vom Marktwert. Bewusst OHNE Tagesbremse: die
  // Formel selbst ist bereits hart gegen eigenen Verkaufspreis/marktwertNeu gedeckelt, ein
  // zusätzliches Bremsen der Preis-SENKUNG (z. B. bei einer Korrektur wie am 27.07.2026) würde
  // nur verzögern, dass ein zu hoher Preis vom Netz geht.
  //
  // Seit 06.08.2026 (siehe pricing-config.js, OFFENE-PUNKTE.md): kategorie "smartphones" läuft
  // über die UVP-basierte Formel statt der reinen eBay-Marktanker-Formel, wieNeu/sehrGut/gut
  // leiten sich dabei vom neuVersiegelt-Wert ab statt vom eBay-Gebraucht-Marktwert - aus demselben
  // Grund wie neuVersiegelt bewusst OHNE Tagesbremse (Formel bereits strukturell sicher). Andere
  // Kategorien unverändert auf der alten Formel inkl. Tagesbremse für wieNeu/sehrGut/gut. defekt
  // bleibt für ALLE Kategorien unverändert (alte Formel, Tagesbremse greift weiterhin).
  const eigenerVKNeu = pricing.findeEigenenVerkaufspreis(bestandListe, geraet, variante, "neu");
  const istSmartphone = pricing.istUvpBasierteKategorie(geraet.kategorie);
  const neuVersiegeltWert = istSmartphone
    ? pricing.berechneNeuVersiegeltUvpBasiert({
        eigenerVK: eigenerVKNeu,
        marktAnkerNeuEcht: marktwertNeu,
        marktAnkerNeu: marktwertNeu,
        marktAnkerNeuUrsprung: "echt",
        uvpVariante,
        marke: geraet.marke,
        niveauFaktor,
        wettbewerbsZiel,
      })
    : pricing.berechneNeuVersiegelt({
        eigenerVK: eigenerVKNeu,
        marktAnkerNeu: marktwertNeu,
        // Dieses Skript liefert für neuVersiegelt IMMER einen echten, frisch gescrapten Wert (oder
        // null) - nie eine Schätzung aus marktwertGebraucht × NEUWARE_AUFSCHLAG (das passiert nur
        // in pricing-config.js für Geräte ohne echten Marktlauf) - daher fest "echt", Leitplanke 3
        // (85%-Deckel für Schätz-Anker) greift hier bewusst nicht, nur Leitplanke 1 (100%-UVP-Deckel).
        marktAnkerNeuUrsprung: "echt",
        uvpVariante,
        niveauFaktor,
        wettbewerbsZiel,
      });

  const stufenRoh = berechneStufen({ marktwertGebraucht: gebraucht.marktwert, niveauFaktor, geraet });
  stufenRoh.neuVersiegelt = neuVersiegeltWert;
  if (istSmartphone) {
    const abgeleitet = pricing.berechneGebrauchtAusNeu(neuVersiegeltWert, geraet.marke, gebraucht.marktwert);
    stufenRoh.wieNeu = abgeleitet.wieNeu;
    stufenRoh.sehrGut = abgeleitet.sehrGut;
    stufenRoh.gut = abgeleitet.gut;
  }

  const istErsterLauf = !geraet.marktwertQuelle || geraet.marktwertQuelle === "geschaetzt";
  const stufenOhneBremse = ["neuVersiegelt", ...(istSmartphone ? ["wieNeu", "sehrGut", "gut"] : [])];
  const stufenFuerBremse = { ...stufenRoh };
  stufenOhneBremse.forEach((s) => { stufenFuerBremse[s] = null; });
  const { stufenFinal, pruefenGruende: bremseGruende } = wendeTagesbremseAn({
    stufenRoh: stufenFuerBremse, altPreise: altVariante && altVariante.preise, istErsterLauf,
  });
  stufenOhneBremse.forEach((s) => { stufenFinal[s] = stufenRoh[s]; });

  // Eine einzelne Quelle darf einen Gebrauchtpreis senken, aber niemals erhöhen. Erhöhungen
  // werden erst veröffentlicht, wenn eBay und Rebuy denselben Markt grob bestätigen.
  if (rebuyAktiv && !gebrauchtQuellenBestaetigt && altVariante && altVariante.preise) {
    ["wieNeu", "sehrGut", "gut", "defekt"].forEach((stufe) => {
      const alt = Number(altVariante.preise[stufe]);
      const neuWert = Number(stufenFinal[stufe]);
      if (!Number.isFinite(alt) || !Number.isFinite(neuWert) || neuWert <= alt) return;
      stufenFinal[stufe] = alt;
      gebrauchtQuellenWarnungen.push(stufe + ": Erhöhung ohne bestätigende zweite Quelle ausgesetzt");
    });
  }

  // Sichere Senkungen (insbesondere wenn wir über dem Wettbewerb liegen) gelten
  // sofort. Erhöhungen erfolgen höchstens in 10%-Schritten, damit ein einzelner
  // fehlerhafter Tageswert keine großen Sprünge verursacht.
  if (!istErsterLauf && altVariante && altVariante.preise) {
    stufenOhneBremse.forEach((stufe) => {
      const alt = Number(altVariante.preise[stufe]);
      const neuWert = Number(stufenFinal[stufe]);
      if (!Number.isFinite(alt) || alt <= 0 || !Number.isFinite(neuWert) || neuWert <= alt) return;
      const maximum = pricing.rundeAbAuf5(alt * (1 + config.TAGESBREMSE_PROZENT));
      if (neuWert > maximum) {
        stufenFinal[stufe] = maximum;
        bremseGruende.push(stufe + ": Erhöhungsbremse (+" + Math.round(config.TAGESBREMSE_PROZENT * 100) + "%) gekappt");
      }
    });
  }

  const konsistenzGruende = wendeKonsistenzregel1An({
    stufenFinal, geraet, variante, bestandListe,
    marktwertNeu, marktwertGebraucht: gebraucht.marktwert,
  });

  const alleGruende = [...gebrauchtQuellenWarnungen, ...bremseGruende, ...konsistenzGruende];
  if (marktwertNeuVerworfen) {
    alleGruende.push(
      "marktwertNeu verworfen (Leitplanke 2: " + Math.round(marktwertNeuRoh) + " € > " +
      Math.round(pricing.NEU_VERSIEGELT_MARKTWERT_VERWERFEN_SCHWELLE * 100) + "% von UVP " +
      Math.round(uvpVariante) + " € - vermutlich kontaminierter Treffer)"
    );
  }

  const neueVariante = { bezeichnung: variante.bezeichnung, uvpDelta: variante.uvpDelta, preise: stufenFinal, preisQuelle: "auto" };

  const rechnung = {
    ...basis,
    gebrauchtTreffer: gebraucht.treffer,
    gebrauchtMedianVor: gebraucht.quartil.medianVorFilter,
    gebrauchtMedianNach: gebraucht.quartil.medianNachFilter,
    marktwertGebraucht: gebraucht.marktwert,
    ebayMarktwertGebraucht,
    rebuy,
    rebuyMarktwertGebraucht,
    neuTreffer: neu.treffer,
    neuGrund: neu.grund,
    neuMedianVor: neu.quartil && neu.quartil.medianVorFilter,
    neuMedianNach: neu.quartil && neu.quartil.medianNachFilter,
    marktwertNeuRoh,
    marktwertNeu,
    marktwertNeuVerworfen,
    uvpVariante,
    eigenerVKNeu,
    wettbewerb,
    wettbewerbsPreis,
    wettbewerbsZiel,
    stufenBerechnet: stufenRoh,
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
  zeilen.push("- Gebraucht eBay: " + r.gebrauchtTreffer + " Treffer, Median vor Filter " + rund(r.gebrauchtMedianVor) + " €, nach Filter " + rund(r.gebrauchtMedianNach) + " € → Sicherheitsanker " + rund(r.ebayMarktwertGebraucht) + " € (−" + Math.round(config.ABSCHLAG_GEBRAUCHT * 100) + "%)");
  zeilen.push(
    "- Gebraucht Rebuy-VK: " +
    (r.rebuyMarktwertGebraucht == null
      ? "– (" + ((r.rebuy && r.rebuy.status) || "nicht verfügbar") + ")"
      : rund(r.rebuy.preis) + " € × " + Math.round(config.REBUY_VK_SICHERHEITSFAKTOR * 100) + "% = " + rund(r.rebuyMarktwertGebraucht) + " €") +
    " → verwendeter Gebrauchtanker " + rund(r.marktwertGebraucht) + " €"
  );
  if (r.marktwertNeuVerworfen) {
    zeilen.push("- Neu: " + r.neuTreffer + " Treffer, Median vor Filter " + rund(r.neuMedianVor) + " €, nach Filter " + rund(r.neuMedianNach) + " € → marktwertNeu(roh) " + rund(r.marktwertNeuRoh) + " € **VERWORFEN** (Leitplanke 2: > " + Math.round(pricing.NEU_VERSIEGELT_MARKTWERT_VERWERFEN_SCHWELLE * 100) + "% von UVP " + rund(r.uvpVariante) + " €) → marktwertNeu = null");
  } else if (r.marktwertNeu != null) {
    zeilen.push("- Neu: " + r.neuTreffer + " Treffer, Median vor Filter " + rund(r.neuMedianVor) + " €, nach Filter " + rund(r.neuMedianNach) + " € → marktwertNeu " + rund(r.marktwertNeu) + " € (−" + Math.round(config.ABSCHLAG_NEU * 100) + "%)");
  } else {
    zeilen.push("- Neu: " + (r.neuGrund || (r.neuTreffer + " Treffer (< " + config.MIN_TREFFER_NEU + ")")) + " → marktwertNeu = null");
  }
  const altVK = r.eigenerVKNeu;
  zeilen.push(
    "- neuVersiegelt (eigene Formel, siehe Regel 9): eigener Verkaufspreis " +
    (altVK == null ? "– (kein bestand.json-Eintrag)" : rund(altVK) + " €") +
    " → final " + (r.stufen.neuVersiegelt == null ? "– (kein Anker vorhanden)" : rund(r.stufen.neuVersiegelt) + " €") +
    (r.altStufen && r.altStufen.neuVersiegelt != null ? " (bisher " + rund(r.altStufen.neuVersiegelt) + " €)" : "")
  );
  zeilen.push(
    "- Wettbewerb Neu: Avatel " +
    (r.wettbewerbsPreis == null
      ? "– (" + ((r.wettbewerb && r.wettbewerb.status) || "nicht verfügbar") + ")"
      : rund(r.wettbewerbsPreis) + " € → Ziel höchstens " + rund(r.wettbewerbsZiel) + " €")
  );
  zeilen.push("- Übrige Stufen (berechnet aus Marktanker × Zustands-Prozentsatz → final nach Tagesbremse/Konsistenz):");
  pricing.ZUSTANDS_REIHENFOLGE.filter((s) => s !== "neuVersiegelt").forEach((stufe) => {
    const berechnet = r.stufenBerechnet && r.stufenBerechnet[stufe];
    const alt = r.altStufen && r.altStufen[stufe];
    zeilen.push(
      "  - " + stufe + ": " +
      (berechnet == null ? "–" : rund(berechnet) + " €") +
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

function schreibeLog({ datum, protokolle, speicherKonsistenzProtokoll, dryRun }) {
  const pruefen = protokolle.filter((p) => p.typ === "pruefen");
  const aktualisiert = protokolle.filter((p) => p.typ === "aktualisiert");
  const uebersprungen = protokolle.filter((p) => p.typ === "uebersprungen");

  const teile = [];
  teile.push("# Preisupdate " + datum + (dryRun ? " (DRY-RUN – keine Datei geändert)" : ""));
  teile.push("");
  teile.push("Aktualisiert: " + aktualisiert.length + " · Übersprungen: " + uebersprungen.length + " · PRÜFEN: " + pruefen.length);
  teile.push("");

  if (speicherKonsistenzProtokoll && speicherKonsistenzProtokoll.length) {
    teile.push("## 📉 Speicher-Konsistenzkappung (" + speicherKonsistenzProtokoll.length + ")");
    teile.push("Kleinere Speichervariante lag über einer größeren - auf deren Niveau gekappt (siehe OFFENE-PUNKTE.md).");
    speicherKonsistenzProtokoll.forEach((a) => {
      teile.push("- " + a.marke + " " + a.modell + " (" + a.variante + "), " + a.stufe + ": " + rund(a.alt) + " € → " + rund(a.neu) + " €");
    });
    teile.push("");
  }

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
      (mockErzwungen || quelleErzwungen ? "Mock wurde explizit erzwungen, aber " : "Keine EBAY_CLIENT_ID/EBAY_CLIENT_SECRET gefunden, und ") +
      "ein echter (schreibender) Lauf ohne echte Marktdaten würde Fantasiepreise in die " +
      "Datendateien schreiben. Zugang einrichten: siehe EBAY-SETUP.md."
    );
    process.exit(1);
  }
  if (mockModus) {
    console.log(
      (mockErzwungen || quelleErzwungen)
        ? "Mock-Modus erzwungen."
        : "Keine EBAY_CLIENT_ID/EBAY_CLIENT_SECRET gefunden – nutze Mock-Marktdaten (siehe EBAY-SETUP.md für echten Zugang)."
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
  const katalogUpdates = new Map(); // id -> { marktwertGebraucht, marktwertNeu } (Basis-Variante, Geräte-Ebene)
  const katalogVariantenUpdates = new Map(); // id -> Map(bezeichnung -> { marktwertGebraucht, marktwertNeu })
  const ergebnisListe = [];
  const speicherKonsistenzProtokoll = [];

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
        wettbewerbAktiv: !mockModus,
        rebuyAktiv: !mockModus && (
          geraet.kategorie === "smartphones" ||
          geraet.kategorie === "kopfhoerer" ||
          /airpods|earbuds|buds/i.test(geraet.modell)
        ),
      });
      neueVarianten.push(ergebnis.variante);
      protokolle.push(ergebnis.protokoll);

      if (ergebnis.marktwerte) {
        if (variante.uvpDelta === 0) {
          katalogUpdates.set(geraet.id, ergebnis.marktwerte);
        }
        // Echte Pro-Variante-Marktdaten (jede Speichergröße wird oben bereits einzeln
        // abgefragt) nicht mehr wegwerfen, sondern für ALLE Varianten persistieren -
        // sonst skaliert ermittleWiederverkaufswerte() Nicht-Basis-Varianten weiterhin
        // nur proportional aus der Basis-Variante hoch (Ursache der dokumentierten
        // Speichergrößen-Inversionen, siehe OFFENE-PUNKTE.md).
        if (!katalogVariantenUpdates.has(geraet.id)) katalogVariantenUpdates.set(geraet.id, new Map());
        katalogVariantenUpdates.get(geraet.id).set(variante.bezeichnung, ergebnis.marktwerte);
      }
    }

    // Speicher-Konsistenzregel: läuft NACH allen bestehenden Leitplanken (Tagesbremse,
    // Konsistenzregel 1, neuVersiegelt-Formel) und nach deren Rundung, über ALLE Varianten
    // dieses Geräts (auch heute nicht verarbeitete/eingefrorene) - siehe OFFENE-PUNKTE.md.
    const speicherAenderungen = pricing.wendeSpeicherKonsistenzAn(neueVarianten);
    speicherAenderungen.forEach((a) => {
      speicherKonsistenzProtokoll.push({
        marke: geraet.marke, modell: geraet.modell, variante: a.bezeichnung,
        stufe: a.stufe, alt: a.alt, neu: a.neu,
      });
    });

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
    const variantenUpdates = katalogVariantenUpdates.get(g.id);
    if (!update && !variantenUpdates) return g;

    const varianten = !variantenUpdates
      ? g.varianten
      : g.varianten.map((v) => {
          const vUpdate = variantenUpdates.get(v.bezeichnung);
          if (!vUpdate) return v;
          return {
            ...v,
            marktwertGebraucht: Math.round(vUpdate.marktwertGebraucht),
            marktwertNeu: vUpdate.marktwertNeu == null ? null : Math.round(vUpdate.marktwertNeu),
            marktwertQuelle: quelle + "-auto",
            marktDatenStand: datum,
          };
        });

    if (!update) return { ...g, varianten };
    return {
      ...g,
      marktwertGebraucht: Math.round(update.marktwertGebraucht),
      marktwertNeu: update.marktwertNeu == null ? null : Math.round(update.marktwertNeu),
      marktwertQuelle: quelle + "-auto",
      marktDatenStand: datum,
      varianten,
    };
  });

  const aktualisiertAnzahl = protokolle.filter((p) => p.typ === "aktualisiert").length;
  const uebersprungenAnzahl = protokolle.filter((p) => p.typ === "uebersprungen").length;
  const pruefenAnzahl = protokolle.filter((p) => p.typ === "pruefen").length;
  const wettbewerbTrefferAnzahl = protokolle.filter((p) => p.rechnung && p.rechnung.wettbewerbsPreis != null).length;

  console.log(
    "\nZusammenfassung: " + aktualisiertAnzahl + " Geräte aktualisiert, " +
    uebersprungenAnzahl + " übersprungen, " + pruefenAnzahl + " PRÜFEN-Fälle." +
    " Avatel-Treffer: " + wettbewerbTrefferAnzahl + "." +
    (speicherKonsistenzProtokoll.length
      ? " " + speicherKonsistenzProtokoll.length + " Speicher-Konsistenzkappung(en) (kleinere Variante > größere)."
      : "")
  );

  schreibeLog({ datum, protokolle, speicherKonsistenzProtokoll, dryRun });

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
    wettbewerbTreffer: wettbewerbTrefferAnzahl,
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

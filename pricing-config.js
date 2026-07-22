/**
 * Zentrale Ankaufspreis-Heuristik – Prozent-vom-Wiederverkaufswert-Modell.
 *
 * Verwendet von:
 *   - admin/server.js       ("Neu berechnen", Massenanpassung, Ankaufsniveau-Regler)
 *   - scripts/build-ankauf-preise.js (Erstbefüllung aus geraete-katalog.json)
 *   - scripts/befuelle-marktwert.js (Startwert-Schätzung für marktwertGebraucht)
 *
 * ANKER-PRIORITÄT (pro Zustand "neu"/"gebraucht" unabhängig ermittelt):
 *   1. Primäranker: exakter Treffer (Marke+Modell+Variante+Zustand) in bestand.json
 *      -> Wiederverkaufswert = unser eigener Verkaufspreis.
 *   2. Sekundäranker: geraete-katalog.json Feld "marktwertGebraucht" (geschätzter/recherchierter
 *      Gebraucht-Verkaufspreis im Zustand "Sehr gut", proportional auf die Variante skaliert).
 *      "Neu"-Wiederverkaufswert wird daraus über NEUWARE_AUFSCHLAG abgeleitet, wenn kein
 *      eigener Verkaufspreis für "neu" vorliegt.
 *
 * Die 5 Ankaufsstufen sind feste Prozentsätze dieses Wiederverkaufswerts (ANKAUF_PROZENTSAETZE),
 * zusätzlich global verschiebbar über den Ankaufsniveau-Regler (pricing-niveau.json, -15..+15 %).
 *
 * Änderungen hier wirken sich NICHT rückwirkend auf bereits gespeicherte Preise aus, sondern erst
 * beim nächsten "Neu berechnen" bzw. beim nächsten Lauf des Build-Skripts. preisQuelle:"manuell"
 * gesetzte Varianten werden von keiner Funktion hier automatisch überschrieben – das bleibt
 * Aufgabe der aufrufenden Stelle (dort prüfen!).
 */
const fs = require("fs");
const path = require("path");

const NIVEAU_DATEI = path.join(__dirname, "pricing-niveau.json");
const NIVEAU_MIN = -15;
const NIVEAU_MAX = 15;

// Marktwert-Erhalt nach Gerätealter in vollen Jahren (0 = aktuelles Modelljahr).
// Jahre 0-5 fest, danach linear -0,04 pro weiterem Jahr, nie unter dem Minimum.
// Wird NICHT mehr direkt für Ankaufspreise verwendet, sondern nur noch als begründete
// Startwert-Schätzung für scripts/befuelle-marktwert.js (Feld marktwertGebraucht).
const ALTERSFAKTOR_STUFEN = [0.80, 0.62, 0.48, 0.38, 0.30, 0.24];
const ALTERSFAKTOR_JAHRESABSCHLAG = 0.04;
const ALTERSFAKTOR_MINIMUM = 0.08;

function altersfaktor(jahr, referenzjahr) {
  const heute = referenzjahr || new Date().getFullYear();
  const alter = Math.max(0, heute - jahr);
  if (alter < ALTERSFAKTOR_STUFEN.length) return ALTERSFAKTOR_STUFEN[alter];
  const letzterStufenwert = ALTERSFAKTOR_STUFEN[ALTERSFAKTOR_STUFEN.length - 1];
  const zusatzJahre = alter - (ALTERSFAKTOR_STUFEN.length - 1);
  const wert = letzterStufenwert - zusatzJahre * ALTERSFAKTOR_JAHRESABSCHLAG;
  return Math.max(ALTERSFAKTOR_MINIMUM, wert);
}

// Markenfaktor: Apple hält den Wert am besten, Samsung-A-Serie/Einsteiger am wenigsten.
// Wie altersfaktor() nur noch für die Startwert-Schätzung relevant, nicht für Live-Preise.
function markenfaktor(marke, modell) {
  const m = String(marke || "").trim().toLowerCase();
  if (m === "apple") return 1.15;
  if (m === "samsung") {
    const istASerie = /^galaxy a\d/i.test(String(modell || "").trim());
    return istASerie ? 0.85 : 1.0;
  }
  if (m === "google") return 0.9;
  return 0.8;
}

function marktwert(uvp, jahr, marke, modell, referenzjahr) {
  const basis = Number(uvp) || 0;
  return basis * altersfaktor(jahr, referenzjahr) * markenfaktor(marke, modell);
}

// Aufschlag, um aus dem Gebraucht-Wiederverkaufswert (marktwertGebraucht) einen impliziten
// Neuware-Wiederverkaufswert abzuleiten, WENN kein eigener Verkaufspreis für "neu" vorliegt.
// Konfigurierbar, dokumentiert – kein Wert aus der Nutzervorgabe, sondern eine begründete
// Annahme (versiegelte/neuwertige Ware erzielt spürbar mehr als gebrauchte "Sehr gut"-Ware).
const NEUWARE_AUFSCHLAG = 1.15;

// Ankaufspreis je Zustandsstufe als Prozentsatz des jeweiligen Wiederverkaufswerts
// (neuVersiegelt bezieht sich auf den Neuware-, alle anderen auf den Gebraucht-Wiederverkaufswert).
const ANKAUF_PROZENTSAETZE = {
  neuVersiegelt: 0.82,
  wieNeu: 0.75,
  sehrGut: 0.68,
  gut: 0.55,
  defekt: 0.20,
};

// Reihenfolge, in der die 5 Stufen überall (UI, Validierung, Export) angezeigt werden.
const ZUSTANDS_REIHENFOLGE = ["neuVersiegelt", "wieNeu", "sehrGut", "gut", "defekt"];

function rundeAuf5(zahl) {
  return Math.max(5, Math.round(zahl / 5) * 5);
}

function normalisiere(text) {
  return String(text || "").trim().toLowerCase();
}

// Sucht in bestand.json den zutreffendsten eigenen Verkaufspreis für genau diese
// Marke+Modell+Variante+Zustand-Kombination (bevorzugt aktive, dann neueste Einträge).
function findeEigenenVerkaufspreis(bestandListe, geraet, variante, zustand) {
  if (!Array.isArray(bestandListe) || !bestandListe.length) return null;
  const treffer = bestandListe.filter((eintrag) => (
    eintrag
    && eintrag.zustand === zustand
    && normalisiere(eintrag.marke) === normalisiere(geraet.marke)
    && normalisiere(eintrag.modell) === normalisiere(geraet.modell)
    && normalisiere(eintrag.speicher) === normalisiere(variante.bezeichnung)
    && Number.isFinite(Number(eintrag.preis))
  ));
  if (!treffer.length) return null;
  const aktive = treffer.filter((e) => e.aktiv !== false);
  const kandidaten = aktive.length ? aktive : treffer;
  kandidaten.sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  return Number(kandidaten[0].preis);
}

// Ermittelt Wiederverkaufswert "neu" und "gebraucht" für eine Gerät+Variante-Kombination,
// jeweils unabhängig über die Anker-Priorität (Primäranker: eigener Verkauf, sonst Sekundäranker:
// marktwertGebraucht aus dem Katalog, proportional auf die Variante skaliert).
function ermittleWiederverkaufswerte(geraet, variante, bestandListe) {
  const uvpBasis = Number(geraet.uvp) || 0;
  const uvpVariante = uvpBasis + (Number(variante.uvpDelta) || 0);
  const verhaeltnis = uvpBasis > 0 ? uvpVariante / uvpBasis : 1;
  const marktwertGebrauchtVariante = (Number(geraet.marktwertGebraucht) || 0) * verhaeltnis;

  const eigenerNeu = findeEigenenVerkaufspreis(bestandListe, geraet, variante, "neu");
  const eigenerGebraucht = findeEigenenVerkaufspreis(bestandListe, geraet, variante, "gebraucht");

  return {
    neu: eigenerNeu != null ? eigenerNeu : marktwertGebrauchtVariante * NEUWARE_AUFSCHLAG,
    gebraucht: eigenerGebraucht != null ? eigenerGebraucht : marktwertGebrauchtVariante,
    quelleNeu: eigenerNeu != null ? "eigenerVerkauf" : "marktwert",
    quelleGebraucht: eigenerGebraucht != null ? "eigenerVerkauf" : "marktwert",
  };
}

function liesAnkaufsniveau() {
  try {
    const daten = JSON.parse(fs.readFileSync(NIVEAU_DATEI, "utf8"));
    const prozent = Number(daten.prozent);
    if (!Number.isFinite(prozent)) return 0;
    return Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, prozent));
  } catch (e) {
    return 0; // Datei fehlt/ungültig -> neutral (0 %), kein harter Fehler
  }
}

function schreibeAnkaufsniveau(prozentWert, backupIfChanged) {
  const geklemmt = Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, Number(prozentWert) || 0));
  if (typeof backupIfChanged === "function") backupIfChanged(NIVEAU_DATEI);
  fs.writeFileSync(NIVEAU_DATEI, JSON.stringify({ prozent: geklemmt }, null, 2) + "\n", "utf8");
  return geklemmt;
}

// Berechnet die 5 Ankaufspreis-Stufen für ein Gerät+Variante. bestandListe = Inhalt von
// bestand.json (für den Primäranker). niveauProzent optional, sonst wird pricing-niveau.json
// gelesen. Gibt zusätzlich die verwendete Anker-Quelle zurück (für UI/Reporting).
function berechnePreise(geraet, variante, bestandListe, niveauProzent) {
  const niveau = Number.isFinite(niveauProzent) ? niveauProzent : liesAnkaufsniveau();
  const niveauFaktor = 1 + niveau / 100;
  const wiederverkauf = ermittleWiederverkaufswerte(geraet, variante, bestandListe);

  const ergebnis = {};
  ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    const basis = stufe === "neuVersiegelt" ? wiederverkauf.neu : wiederverkauf.gebraucht;
    ergebnis[stufe] = rundeAuf5(basis * ANKAUF_PROZENTSAETZE[stufe] * niveauFaktor);
  });

  return {
    preise: ergebnis,
    wiederverkaufswertNeu: wiederverkauf.neu,
    wiederverkaufswertGebraucht: wiederverkauf.gebraucht,
    quelleNeu: wiederverkauf.quelleNeu,
    quelleGebraucht: wiederverkauf.quelleGebraucht,
  };
}

// Konsistenzregel: Ankaufspreis darf nie über dem eigenen Verkaufspreis desselben Modells liegen.
// Gibt eine Liste von Verstößen zurück (leer = alles konsistent).
function pruefeKonsistenz(preise, wiederverkaufswerte) {
  const verstoesse = [];
  ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    const referenz = stufe === "neuVersiegelt" ? wiederverkaufswerte.neu : wiederverkaufswerte.gebraucht;
    if (Number.isFinite(referenz) && preise[stufe] > referenz) {
      verstoesse.push({ stufe, ankaufPreis: preise[stufe], eigenerVerkaufspreis: referenz });
    }
  });
  return verstoesse;
}

module.exports = {
  ALTERSFAKTOR_STUFEN,
  ALTERSFAKTOR_JAHRESABSCHLAG,
  ALTERSFAKTOR_MINIMUM,
  ANKAUF_PROZENTSAETZE,
  NEUWARE_AUFSCHLAG,
  NIVEAU_MIN,
  NIVEAU_MAX,
  ZUSTANDS_REIHENFOLGE,
  altersfaktor,
  markenfaktor,
  marktwert,
  ermittleWiederverkaufswerte,
  berechnePreise,
  pruefeKonsistenz,
  liesAnkaufsniveau,
  schreibeAnkaufsniveau,
  rundeAuf5,
  findeEigenenVerkaufspreis,
};

/**
 * Erzeugt ankauf-preise.json + ankauf/<kategorie>.json aus geraete-katalog.json
 * unter Anwendung der zentralen Preisformel (pricing-config.js, Prozent-vom-Wiederverkaufswert-
 * Modell: eigener Verkaufspreis aus bestand.json als Primäranker, sonst marktwertGebraucht aus
 * dem Katalog als Sekundäranker).
 *
 * Ausführen: node scripts/build-ankauf-preise.js
 *
 * Sicherheit: preisQuelle:"manuell" gesetzte Varianten aus der BISHERIGEN ankauf-preise.json
 * werden 1:1 übernommen (nie überschrieben) - Zuordnung über die "id" (kommt aus dem Katalog).
 * Neue/unveränderte Varianten werden neu aus der Formel berechnet und als "auto" markiert.
 */
const fs = require("fs");
const path = require("path");
const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const BESTAND_FILE = path.join(ROOT, "bestand.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");

const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

const ANKAUF_KOMMENTAR =
  "AUTO-PLATZHALTER-PREISE – berechnet aus dem Wiederverkaufswert (eigener Verkaufspreis aus " +
  "bestand.json, sonst marktwertGebraucht aus geraete-katalog.json) über die zentrale Heuristik " +
  "(siehe pricing-config.js, 5 Zustandsstufen: neuVersiegelt/wieNeu/sehrGut/gut/defekt, " +
  "global verschiebbar über pricing-niveau.json). " +
  "preisQuelle \"auto\" wird bei manueller Preisänderung im Admin automatisch auf \"manuell\" " +
  "gesetzt und danach nie mehr automatisch überschrieben. Vor Livegang: mindestens die " +
  "Top-50-Modelle manuell prüfen (siehe PREISE-ANLEITUNG.md).";

const katalog = JSON.parse(fs.readFileSync(KATALOG_FILE, "utf8"));
const bestandListe = fs.existsSync(BESTAND_FILE)
  ? JSON.parse(fs.readFileSync(BESTAND_FILE, "utf8") || "[]")
  : [];

// Bestehende manuelle Preise einlesen (falls vorhanden), damit sie nicht verloren gehen.
let bestehendeManuell = {}; // id -> { bezeichnung -> preise }
if (fs.existsSync(ANKAUF_FILE)) {
  try {
    const alt = JSON.parse(fs.readFileSync(ANKAUF_FILE, "utf8")).filter((d) => d && d.id);
    alt.forEach((geraet) => {
      (geraet.varianten || []).forEach((v) => {
        if (v.preisQuelle === "manuell") {
          bestehendeManuell[geraet.id] = bestehendeManuell[geraet.id] || {};
          bestehendeManuell[geraet.id][v.bezeichnung] = v.preise;
        }
      });
    });
  } catch (e) {
    console.warn("Konnte bestehende ankauf-preise.json nicht lesen, starte ohne manuelle Preise:", e.message);
  }
}

const konsistenzWarnungen = [];

const ergebnis = katalog.map((geraet) => {
  const varianten = geraet.varianten.map((v) => {
    const manuell = bestehendeManuell[geraet.id] && bestehendeManuell[geraet.id][v.bezeichnung];
    if (manuell) {
      return { bezeichnung: v.bezeichnung, uvpDelta: v.uvpDelta, preise: manuell, preisQuelle: "manuell" };
    }
    const berechnung = pricing.berechnePreise(geraet, v, bestandListe);
    const verstoesse = pricing.pruefeKonsistenz(berechnung.preise, {
      neu: berechnung.wiederverkaufswertNeu,
      gebraucht: berechnung.wiederverkaufswertGebraucht,
    });
    if (verstoesse.length) {
      konsistenzWarnungen.push({ marke: geraet.marke, modell: geraet.modell, variante: v.bezeichnung, verstoesse });
    }
    return { bezeichnung: v.bezeichnung, uvpDelta: v.uvpDelta, preise: berechnung.preise, preisQuelle: "auto" };
  });
  return {
    id: geraet.id,
    kategorie: geraet.kategorie,
    marke: geraet.marke,
    modell: geraet.modell,
    jahr: geraet.jahr,
    neupreisUvp: geraet.uvp,
    beliebt: false,
    varianten,
  };
});

// Master-Datei (mit Kommentar-Objekt vorangestellt, wie bisher).
fs.mkdirSync(path.dirname(ANKAUF_FILE), { recursive: true });
backupIfChanged(ANKAUF_FILE);
fs.writeFileSync(
  ANKAUF_FILE,
  JSON.stringify([{ _kommentar: ANKAUF_KOMMENTAR }, ...ergebnis], null, 2) + "\n",
  "utf8"
);

// Split-Dateien pro Kategorie (kompakt, wie vom Server erzeugt).
fs.mkdirSync(SPLIT_DIR, { recursive: true });
KATEGORIEN.forEach((k) => {
  const teilliste = ergebnis.filter((g) => g.kategorie === k);
  const zielpfad = path.join(SPLIT_DIR, k + ".json");
  backupIfChanged(zielpfad);
  fs.writeFileSync(zielpfad, JSON.stringify(teilliste), "utf8");
});

const byKat = {};
let variantenGesamt = 0;
ergebnis.forEach((g) => {
  byKat[g.kategorie] = (byKat[g.kategorie] || 0) + 1;
  variantenGesamt += g.varianten.length;
});
console.log("ankauf-preise.json + ankauf/*.json geschrieben:", ergebnis.length, "Geräte,", variantenGesamt, "Varianten");
console.log(byKat);

if (konsistenzWarnungen.length) {
  console.warn("\nKONSISTENZ-WARNUNG: Ankaufspreis über eigenem Verkaufspreis bei", konsistenzWarnungen.length, "Variante(n):");
  konsistenzWarnungen.forEach((w) => {
    console.warn(" -", w.marke, w.modell, "(" + w.variante + "):", w.verstoesse.map((v) => v.stufe + "=" + v.ankaufPreis + "€ > " + v.eigenerVerkaufspreis + "€").join(", "));
  });
} else {
  console.log("Konsistenzregel: keine Verstöße (Ankaufspreis nirgends über eigenem Verkaufspreis).");
}

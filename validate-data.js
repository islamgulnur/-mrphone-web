/**
 * Validiert alle Datendateien des Projekts. Exit-Code 1 bei jedem Fehler.
 * Ausführen: node validate-data.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];
const ZUSTANDS_FELDER = ["neuVersiegelt", "wieNeu", "sehrGut", "gut", "defekt"];

// Mindestanzahl Geräte je Kategorie (aus dem aktuellen Vollkatalog abgeleitet, mit Puffer).
const MINDESTANZAHL = {
  smartphones: 150,
  tablets: 30,
  smartwatches: 25,
  laptops: 15,
  pcs: 5,
  monitore: 3,
  kopfhoerer: 15,
  kameras: 20,
  konsolen: 15,
  zubehoer: 5,
};

const fehler = [];
const warnungen = [];

function ladeJson(datei) {
  const voll = path.join(ROOT, datei);
  if (!fs.existsSync(voll)) {
    fehler.push(datei + ": Datei existiert nicht.");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(voll, "utf8"));
  } catch (e) {
    fehler.push(datei + ": ungültiges JSON (" + e.message + ").");
    return null;
  }
}

// --- geraete-katalog.json --------------------------------------------------
const katalog = ladeJson("geraete-katalog.json");
const katalogIds = new Set();
if (Array.isArray(katalog)) {
  katalog.forEach((g, i) => {
    const ort = "geraete-katalog.json[" + i + "] (" + (g && g.id) + ")";
    if (!g || typeof g !== "object") { fehler.push(ort + ": kein Objekt."); return; }
    if (!g.id) fehler.push(ort + ": fehlende id.");
    if (katalogIds.has(g.id)) fehler.push(ort + ": doppelte id " + g.id);
    katalogIds.add(g.id);
    if (!KATEGORIEN.includes(g.kategorie)) fehler.push(ort + ": ungültige kategorie " + g.kategorie);
    if (!g.marke) fehler.push(ort + ": fehlende marke.");
    if (!g.modell) fehler.push(ort + ": fehlendes modell.");
    if (typeof g.jahr !== "number") fehler.push(ort + ": jahr ist keine Zahl.");
    if (typeof g.uvp !== "number") fehler.push(ort + ": uvp ist keine Zahl.");
    if (!Array.isArray(g.varianten) || !g.varianten.length) fehler.push(ort + ": keine varianten.");
    else {
      g.varianten.forEach((v, j) => {
        if (!v.bezeichnung) fehler.push(ort + ".varianten[" + j + "]: fehlende bezeichnung.");
        if (typeof v.uvpDelta !== "number") fehler.push(ort + ".varianten[" + j + "]: uvpDelta ist keine Zahl.");
      });
    }
  });
  const byKat = {};
  katalog.forEach((g) => { if (g && g.kategorie) byKat[g.kategorie] = (byKat[g.kategorie] || 0) + 1; });
  KATEGORIEN.forEach((k) => {
    const n = byKat[k] || 0;
    if (n < MINDESTANZAHL[k]) {
      fehler.push("geraete-katalog.json: Kategorie '" + k + "' hat nur " + n + " Geräte (Minimum " + MINDESTANZAHL[k] + ").");
    }
  });
} else if (katalog !== null) {
  fehler.push("geraete-katalog.json: Wurzelelement muss ein Array sein.");
}

// --- ankauf-preise.json (+ ankauf/*.json Konsistenz) ------------------------
const ankaufRoh = ladeJson("ankauf-preise.json");
let ankaufListe = [];
if (Array.isArray(ankaufRoh)) {
  ankaufListe = ankaufRoh.filter((d) => d && d.id);
  ankaufListe.forEach((g, i) => {
    const ort = "ankauf-preise.json[" + i + "] (" + g.id + ")";
    if (!KATEGORIEN.includes(g.kategorie)) fehler.push(ort + ": ungültige kategorie " + g.kategorie);
    if (!g.marke) fehler.push(ort + ": fehlende marke.");
    if (!g.modell) fehler.push(ort + ": fehlendes modell.");
    if (!Array.isArray(g.varianten) || !g.varianten.length) {
      fehler.push(ort + ": keine varianten.");
      return;
    }
    g.varianten.forEach((v, j) => {
      const vOrt = ort + ".varianten[" + j + "]";
      if (!v.bezeichnung) fehler.push(vOrt + ": fehlende bezeichnung.");
      if (!v.preise || typeof v.preise !== "object") {
        fehler.push(vOrt + ": fehlendes preise-Objekt.");
        return;
      }
      ZUSTANDS_FELDER.forEach((feld) => {
        if (typeof v.preise[feld] !== "number" || v.preise[feld] < 0) {
          fehler.push(vOrt + ": preise." + feld + " ist keine gültige Zahl.");
        }
      });
      if (v.preisQuelle !== "auto" && v.preisQuelle !== "manuell") {
        fehler.push(vOrt + ": preisQuelle muss 'auto' oder 'manuell' sein, ist '" + v.preisQuelle + "'.");
      }
    });
  });
  const byKat = {};
  ankaufListe.forEach((g) => { byKat[g.kategorie] = (byKat[g.kategorie] || 0) + 1; });
  KATEGORIEN.forEach((k) => {
    const n = byKat[k] || 0;
    if (n < MINDESTANZAHL[k]) {
      fehler.push("ankauf-preise.json: Kategorie '" + k + "' hat nur " + n + " Geräte (Minimum " + MINDESTANZAHL[k] + ").");
    }
  });
} else if (ankaufRoh !== null) {
  fehler.push("ankauf-preise.json: Wurzelelement muss ein Array sein.");
}

// Split-Dateien: jede Kategorie muss existieren und zur Master-Datei passen.
KATEGORIEN.forEach((k) => {
  const datei = "ankauf/" + k + ".json";
  const teil = ladeJson(datei);
  if (!Array.isArray(teil)) {
    if (teil !== null) fehler.push(datei + ": Wurzelelement muss ein Array sein.");
    return;
  }
  const erwartet = ankaufListe.filter((g) => g.kategorie === k).length;
  if (teil.length !== erwartet) {
    fehler.push(
      datei + ": " + teil.length + " Einträge, aber ankauf-preise.json hat " + erwartet +
      " Einträge für diese Kategorie (Master/Split nicht konsistent)."
    );
  }
});

// --- bestand.json / angebote.json (Struktur, keine Mindestzahl) -----------
["bestand.json", "angebote.json"].forEach((datei) => {
  const liste = ladeJson(datei);
  if (liste === null) return;
  if (!Array.isArray(liste)) {
    fehler.push(datei + ": Wurzelelement muss ein Array sein.");
    return;
  }
  liste.forEach((eintrag, i) => {
    const ort = datei + "[" + i + "]";
    if (!eintrag || typeof eintrag !== "object") { fehler.push(ort + ": kein Objekt."); return; }
    if (!eintrag.id) fehler.push(ort + ": fehlende id.");
    if (eintrag.kategorie && !KATEGORIEN.includes(eintrag.kategorie)) {
      fehler.push(ort + ": ungültige kategorie " + eintrag.kategorie);
    }
  });
});

// --- Ergebnis ---------------------------------------------------------------
if (warnungen.length) {
  console.warn("Warnungen:");
  warnungen.forEach((w) => console.warn("  - " + w));
}

if (fehler.length) {
  console.error("validate-data.js: " + fehler.length + " Fehler gefunden:");
  fehler.forEach((f) => console.error("  - " + f));
  process.exit(1);
}

console.log("validate-data.js: OK. Geräte im Katalog: " + (katalog ? katalog.length : 0) + ", Ankauf-Einträge: " + ankaufListe.length + ".");
process.exit(0);

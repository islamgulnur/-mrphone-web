/**
 * Wendet die zentrale Kategorie-/Markenformel ausschließlich als Abwärts-Deckel auf bereits
 * gespeicherte automatische Gebrauchtpreise an. Manuelle Preise und Neuware bleiben unverändert.
 * Beispiel: node scripts/apply-gebraucht-sicherheitsdeckel.js kopfhoerer
 */
const fs = require("fs");
const path = require("path");
const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const MASTER = path.join(ROOT, "ankauf-preise.json");
const KATALOG = path.join(ROOT, "geraete-katalog.json");
const BESTAND = path.join(ROOT, "bestand.json");
const kategorien = new Set(process.argv.slice(2));
if (!kategorien.size) throw new Error("Mindestens eine Kategorie angeben.");

const ankauf = JSON.parse(fs.readFileSync(MASTER, "utf8"));
const katalog = JSON.parse(fs.readFileSync(KATALOG, "utf8"));
const bestand = JSON.parse(fs.readFileSync(BESTAND, "utf8"));
const katalogById = new Map(katalog.map((geraet) => [geraet.id, geraet]));
let aenderungen = 0;

for (const ankaufGeraet of ankauf) {
  if (!kategorien.has(ankaufGeraet.kategorie)) continue;
  const geraet = katalogById.get(ankaufGeraet.id);
  if (!geraet) continue;
  for (const variante of ankaufGeraet.varianten) {
    if (variante.preisQuelle !== "auto") continue;
    const katalogVariante = geraet.varianten.find((eintrag) => eintrag.bezeichnung === variante.bezeichnung);
    if (!katalogVariante) continue;
    const sicher = pricing.berechnePreise(geraet, katalogVariante, bestand).preise;
    for (const stufe of ["wieNeu", "sehrGut", "gut", "defekt"]) {
      const alt = Number(variante.preise[stufe]);
      const deckel = Number(sicher[stufe]);
      if (!Number.isFinite(alt) || !Number.isFinite(deckel) || deckel >= alt) continue;
      console.log(`${geraet.marke} ${geraet.modell} / ${variante.bezeichnung} / ${stufe}: ${alt} -> ${deckel}`);
      variante.preise[stufe] = deckel;
      aenderungen += 1;
    }
  }
}

if (aenderungen) {
  backupIfChanged(MASTER);
  fs.writeFileSync(MASTER, JSON.stringify(ankauf, null, 2) + "\n", "utf8");
  for (const kategorie of kategorien) {
    const datei = path.join(ROOT, "ankauf", kategorie + ".json");
    backupIfChanged(datei);
    fs.writeFileSync(datei, JSON.stringify(ankauf.filter((geraet) => geraet.kategorie === kategorie)), "utf8");
  }
}
console.log(`${aenderungen} Gebrauchtpreise sicher nach unten gedeckelt.`);

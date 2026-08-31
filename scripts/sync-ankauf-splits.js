/**
 * Synchronisiert gezielt angegebene ankauf/<kategorie>.json-Dateien aus der Masterdatei, ohne
 * Preise neu zu berechnen. Beispiel: node scripts/sync-ankauf-splits.js smartphones kopfhoerer
 */
const fs = require("fs");
const path = require("path");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const MASTER = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const ERLAUBT = new Set([
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
]);

const kategorien = process.argv.slice(2);
if (!kategorien.length || kategorien.some((kategorie) => !ERLAUBT.has(kategorie))) {
  throw new Error("Mindestens eine gültige Kategorie angeben: " + [...ERLAUBT].join(", "));
}

const master = JSON.parse(fs.readFileSync(MASTER, "utf8"));
for (const kategorie of kategorien) {
  const datei = path.join(SPLIT_DIR, kategorie + ".json");
  const bisherText = fs.existsSync(datei) ? fs.readFileSync(datei, "utf8") : "";
  const bisher = bisherText.includes("<<<<<<<") ? [] : (bisherText ? JSON.parse(bisherText) : []);
  const neu = master.filter((geraet) => geraet.kategorie === kategorie);
  if (bisher.length && neu.length < bisher.length * 0.8) {
    throw new Error(kategorie + ": Sicherheitsstopp wegen unerwartetem Eintragsrückgang");
  }
  backupIfChanged(datei);
  fs.writeFileSync(datei, JSON.stringify(neu), "utf8");
  console.log(kategorie + ": " + neu.length + " Geräte synchronisiert");
}

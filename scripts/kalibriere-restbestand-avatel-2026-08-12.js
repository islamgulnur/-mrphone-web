/**
 * Einmalige Korrektur: vollständiger Avatel-Live-Abgleich aller 130 Katalog-Geräte mit
 * marktwertQuelle "geschaetzt" außerhalb der UVP-basierten Kategorie "smartphones" (11.-12.08.2026,
 * Betreiber-Auftrag "prüf auch die alten Geräte"). Gegenprüft auf verkaufen.avatel.de, Zustand
 * "NEU"/Basis-Listenpreis. 11 Geräte (14 Varianten) lagen über Avatel, teils deutlich (Galaxy
 * Watch 8 Classic +140€, iPad Air 7 1TB +175€). Alle anderen geprüften Geräte lagen bereits
 * darunter oder hatten keinen vergleichbaren Avatel-Preis (viele Kategorien wie Kameras, Garmin,
 * iMac/Gaming-PCs, generische Laptop-Klassen und Kleinzubehör zeigen bei Avatel durchweg
 * "Preisanfrage" statt Festpreis - dort ist kein Vergleich möglich und kein Risiko vorhanden).
 *
 * Gleiches Muster wie scripts/kalibriere-ipad-avatel-2026-08-11.js: Ziel = Avatel-Preis × 0,92
 * (8% Sicherheitsabstand), preisQuelle "manuell" (Notventil), alle 5 Zustandsstufen einheitlich
 * mit dem Faktor (neuer neuVersiegelt / alter neuVersiegelt) skaliert, um die bestehenden
 * Verhältnisse zwischen den Stufen zu erhalten.
 *
 * Ausführen:
 *   node scripts/kalibriere-restbestand-avatel-2026-08-12.js --dry-run
 *   node scripts/kalibriere-restbestand-avatel-2026-08-12.js
 */
const fs = require("fs");
const path = require("path");

const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");

// Avatel-Live-Preise (verkaufen.avatel.de, geprüft 11./12.08.2026) × 0,92.
const KORREKTUREN = {
  "kat-0311": { kategorie: "kopfhoerer", varianten: { "Standard": 70 * 0.92 } },        // AirPods 4
  "kat-0481": { kategorie: "zubehoer", varianten: { "Standard": 100 * 0.92 } },          // AirPods 4 (mit ANC)
  "kat-0482": { kategorie: "zubehoer", varianten: { "Standard": 280 * 0.92 } },          // AirPods Max (USB-C)
  "kat-0318": { kategorie: "kopfhoerer", varianten: { "Standard": 40 * 0.92 } },         // Galaxy Buds 3
  "kat-0319": { kategorie: "kopfhoerer", varianten: { "Standard": 60 * 0.92 } },         // Galaxy Buds 3 Pro
  "kat-0253": { kategorie: "smartwatches", varianten: { "45mm": 100 * 0.92 } },          // Galaxy Watch 5 Pro
  "kat-0257": { kategorie: "smartwatches", varianten: { "47mm": 230 * 0.92 } },          // Galaxy Watch Ultra
  "kat-0259": { kategorie: "smartwatches", varianten: { "46mm": 150 * 0.92 } },          // Galaxy Watch 8 Classic
  "kat-0193": { kategorie: "tablets", varianten: { "512 GB": 620 * 0.92, "1 TB": 650 * 0.92 } }, // iPad Air 6 13"
  "kat-0194": { kategorie: "tablets", varianten: { "128 GB": 470 * 0.92, "512 GB": 650 * 0.92, "1 TB": 700 * 0.92 } }, // iPad Air 7
  "kat-0202": { kategorie: "tablets", varianten: { "2 TB": 980 * 0.92 } },               // iPad Pro 11" Gen 5 (2024)
};

function ladeJson(datei) {
  return JSON.parse(fs.readFileSync(datei, "utf8"));
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ankauf = ladeJson(ANKAUF_FILE);
  const log = [];
  const betroffeneKategorien = new Set();

  Object.entries(KORREKTUREN).forEach(([id, { kategorie, varianten }]) => {
    betroffeneKategorien.add(kategorie);
    const geraet = ankauf.find((g) => g.id === id);
    if (!geraet) { log.push("FEHLER: " + id + " nicht gefunden"); return; }

    Object.entries(varianten).forEach(([bezeichnung, avatelZielRoh]) => {
      const variante = geraet.varianten.find((v) => v.bezeichnung === bezeichnung);
      if (!variante) { log.push("FEHLER: " + id + " " + bezeichnung + " nicht gefunden"); return; }

      const zielNeuVersiegelt = pricing.rundeAuf5(avatelZielRoh);
      const faktor = zielNeuVersiegelt / variante.preise.neuVersiegelt;
      const alteWerte = { ...variante.preise };

      const neuePreise = {};
      Object.keys(variante.preise).forEach((stufe) => {
        neuePreise[stufe] = stufe === "neuVersiegelt"
          ? zielNeuVersiegelt
          : pricing.rundeAuf5(variante.preise[stufe] * faktor);
      });
      variante.preise = neuePreise;
      variante.preisQuelle = "manuell";

      log.push(
        "KALIBRIERT " + id + " " + geraet.marke + " " + geraet.modell + " (" + bezeichnung + "): " +
        "neuVersiegelt " + alteWerte.neuVersiegelt + "€->" + neuePreise.neuVersiegelt + "€, " +
        "wieNeu " + alteWerte.wieNeu + "->" + neuePreise.wieNeu + ", " +
        "sehrGut " + alteWerte.sehrGut + "->" + neuePreise.sehrGut + ", " +
        "gut " + alteWerte.gut + "->" + neuePreise.gut + ", " +
        "defekt " + alteWerte.defekt + "->" + neuePreise.defekt
      );
    });
  });

  console.log("Restbestand-Avatel-Kalibrierung 12.08.2026" + (dryRun ? " (DRY-RUN)" : ""));
  console.log("");
  log.forEach((zeile) => console.log("  " + zeile));

  if (dryRun) {
    console.log("\nDry-Run beendet: keine Datei geschrieben.");
    return;
  }

  const splitDateien = Array.from(betroffeneKategorien).map((k) => path.join(SPLIT_DIR, k + ".json"));
  [ANKAUF_FILE, ...splitDateien].forEach((datei) => backupIfChanged(datei));

  fs.writeFileSync(ANKAUF_FILE, JSON.stringify(ankauf, null, 2) + "\n", "utf8");
  betroffeneKategorien.forEach((kategorie) => {
    const teilliste = ankauf.filter((g) => g.kategorie === kategorie);
    fs.writeFileSync(path.join(SPLIT_DIR, kategorie + ".json"), JSON.stringify(teilliste), "utf8");
  });

  console.log("\nGeschrieben: " + ANKAUF_FILE + ", " + splitDateien.map((p) => path.basename(path.dirname(p)) + "/" + path.basename(p)).join(", "));
}

main();

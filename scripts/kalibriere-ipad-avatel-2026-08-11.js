/**
 * Einmalige Korrektur: 9 iPad-Varianten (iPad Pro 11"/13" M5, iPad Air 7 13", kat-0495/0496/0502,
 * eingetragen 11.08.2026) lagen beim Avatel-Live-Vergleich (verkaufen.avatel.de, Zustand "NEU",
 * 11.08.2026) über Avatel - bis zu 515€ bei den 2TB-Varianten. Grund: die "geschaetzt"-Bootstrap-
 * Formel (marktwert() = UVP × Altersfaktor × Markenfaktor) unterschätzt bei druckfrischen Geräten
 * (Modelljahr 2025, aber Referenzjahr 2026 -> "1 Jahr alt" in der Alterskurve) die Abwertung nicht
 * stark genug, Lücke wächst mit Speichergröße.
 *
 * Betreiber-Entscheidung 11.08.2026: auf Avatel × 0,92 (8% Sicherheitsabstand) kalibrieren, exakt
 * analog zum bestehenden Muster für die 5 Smartphone-Referenzgeräte (06.08.2026, siehe
 * OFFENE-PUNKTE.md). preisQuelle "manuell" = Notventil (siehe pricing-config.js Kommentarblock) -
 * wird von keiner automatischen Preisrunde mehr angefasst. Alle 5 Zustandsstufen einheitlich mit
 * demselben Faktor skaliert (Faktor = neuer neuVersiegelt / alter neuVersiegelt), das erhält die
 * bisherigen internen Verhältnisse zwischen den Stufen und damit die Monotonie.
 *
 * Ausführen:
 *   node scripts/kalibriere-ipad-avatel-2026-08-11.js --dry-run
 *   node scripts/kalibriere-ipad-avatel-2026-08-11.js
 */
const fs = require("fs");
const path = require("path");

const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_FILE = path.join(ROOT, "ankauf", "tablets.json");

// Avatel-Live-Preise (verkaufen.avatel.de, Zustand "NEU", geprüft 11.08.2026) × 0,92.
const KORREKTUREN = {
  "kat-0495": { // iPad Pro 11" Gen 6 (2025, M5)
    "256 GB": 820 * 0.92,
    "512 GB": 1000 * 0.92,
    "1 TB": 1230 * 0.92,
    "2 TB": 1320 * 0.92,
  },
  "kat-0496": { // iPad Pro 13" Gen 8 (2025, M5)
    "256 GB": 1020 * 0.92,
    "512 GB": 1250 * 0.92,
    "1 TB": 1350 * 0.92,
    "2 TB": 1500 * 0.92,
  },
  "kat-0502": { // iPad Air 7 13" (2025)
    "128 GB": 630 * 0.92,
  },
};

function ladeJson(datei) {
  return JSON.parse(fs.readFileSync(datei, "utf8"));
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ankauf = ladeJson(ANKAUF_FILE);
  const log = [];

  Object.entries(KORREKTUREN).forEach(([id, varianten]) => {
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
        "KALIBRIERT " + id + " " + geraet.modell + " (" + bezeichnung + "): " +
        "neuVersiegelt " + alteWerte.neuVersiegelt + "€->" + neuePreise.neuVersiegelt + "€, " +
        "wieNeu " + alteWerte.wieNeu + "->" + neuePreise.wieNeu + ", " +
        "sehrGut " + alteWerte.sehrGut + "->" + neuePreise.sehrGut + ", " +
        "gut " + alteWerte.gut + "->" + neuePreise.gut + ", " +
        "defekt " + alteWerte.defekt + "->" + neuePreise.defekt
      );
    });
  });

  console.log("iPad-Avatel-Kalibrierung 11.08.2026" + (dryRun ? " (DRY-RUN)" : ""));
  console.log("");
  log.forEach((zeile) => console.log("  " + zeile));

  if (dryRun) {
    console.log("\nDry-Run beendet: keine Datei geschrieben.");
    return;
  }

  backupIfChanged(ANKAUF_FILE);
  fs.writeFileSync(ANKAUF_FILE, JSON.stringify(ankauf, null, 2) + "\n", "utf8");

  backupIfChanged(SPLIT_FILE);
  const tablets = ankauf.filter((g) => g.kategorie === "tablets");
  fs.writeFileSync(SPLIT_FILE, JSON.stringify(tablets), "utf8");

  console.log("\nGeschrieben: " + ANKAUF_FILE + ", " + SPLIT_FILE);
}

main();

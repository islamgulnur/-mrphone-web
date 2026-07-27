/**
 * Einmalige Migration: wendet die neue neuVersiegelt-Formel (pricing.berechneNeuVersiegelt(),
 * siehe pricing-config.js + OFFENE-PUNKTE.md, Vorfall 27.07.2026) auf ALLE Geräte in
 * ankauf-preise.json an - im Unterschied zu scripts/update-ankaufspreise.js OHNE neue
 * eBay-Anfragen: nutzt ausschließlich bereits vorhandene, echte Marktdaten
 * (geraete-katalog.json Feld marktwertNeu/marktwertGebraucht, wo durch einen früheren echten
 * Marktlauf befüllt) bzw. die bestehende Schätzung, plus bestand.json als Primäranker.
 *
 * Grund für ein eigenes Skript statt scripts/build-ankauf-preise.js: build-ankauf-preise.js
 * würde ALLE 5 Zustandsstufen aus der älteren pricing-config.js-Formel neu berechnen und
 * damit die sorgfältiger kalibrierten wieNeu/sehrGut/gut/defekt-Preise aus dem
 * Markt-Anker-Pipeline-Lauf (Wettbewerbs-Abstand + Markenkorrektur, siehe
 * scripts/update-ankaufspreise.js) überschreiben. Dieses Skript fasst NUR neuVersiegelt an,
 * alle anderen Felder je Variante bleiben unverändert.
 *
 * Ausführen:
 *   node scripts/migriere-neuversiegelt-formel.js --dry-run   (rechnet+loggt, schreibt nichts)
 *   node scripts/migriere-neuversiegelt-formel.js             (schreibt, Backup vorher,
 *                                                                validate-data.js danach)
 *
 * Sicherheit: preisQuelle "manuell" wird nie angefasst. Vor dem Schreiben Backup je Datei,
 * nach dem Schreiben validate-data.js - schlägt es fehl, werden alle Änderungen zurückgerollt.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const BESTAND_FILE = path.join(ROOT, "bestand.json");
const VALIDATE_SCRIPT = path.join(ROOT, "validate-data.js");

const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

// geraete-katalog.json speichert marktwertNeu nur für die Basis-Variante (uvpDelta 0); für
// alle anderen Varianten wird proportional über uvpDelta skaliert (ermittleWiederverkaufswerte
// in pricing-config.js) - eine Näherung, die bei Geräten mit nicht-linearer
// Speicher-Preisstaffelung spürbar daneben liegen kann (siehe OFFENE-PUNKTE.md). Wo ein
// verlässlicherer, tatsächlich für genau diese Variante recherchierter eBay-Neupreis-Median
// vorliegt, hier eintragen - er ersetzt NUR für diese eine id+Variante die Skalierung.
const BEKANNTE_MARKTANKER_NEU = {
  // iPhone 17 Pro Max 512GB: Live-Preis-Check Betreiber, 27.07.2026 (siehe OFFENE-PUNKTE.md).
  // Skalierung aus der 256GB-Basis (marktwertNeu 1058€) ergäbe nur ~1204€, was für diese
  // konkrete Variante nachweislich zu niedrig ist.
  "kat-0036|512 GB": 1400,
};

function ladeJson(datei, fallback) {
  if (!fs.existsSync(datei)) return fallback;
  const inhalt = fs.readFileSync(datei, "utf8");
  return inhalt.trim() ? JSON.parse(inhalt) : fallback;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");

  const katalog = ladeJson(KATALOG_FILE, []);
  const katalogById = new Map(katalog.map((g) => [g.id, g]));
  const ankaufRoh = ladeJson(ANKAUF_FILE, []);
  const ankaufListe = ankaufRoh.filter((d) => d && d.id);
  const bestandListe = ladeJson(BESTAND_FILE, []);
  const niveauFaktor = 1 + pricing.liesAnkaufsniveau() / 100;

  const aenderungen = [];
  let unveraendert = 0;
  let uebersprungenManuell = 0;
  let keinAnker = 0;

  ankaufListe.forEach((geraetAnkauf) => {
    const geraetKatalog = katalogById.get(geraetAnkauf.id);
    if (!geraetKatalog) return; // sollte laut validate-data.js nicht vorkommen

    geraetAnkauf.varianten.forEach((variante) => {
      if (variante.preisQuelle === "manuell") {
        uebersprungenManuell++;
        return;
      }

      const eigenerVK = pricing.findeEigenenVerkaufspreis(bestandListe, geraetKatalog, variante, "neu");
      const wiederverkauf = pricing.ermittleWiederverkaufswerte(geraetKatalog, variante, bestandListe);
      const overrideKey = geraetAnkauf.id + "|" + variante.bezeichnung;
      const marktAnkerNeu = BEKANNTE_MARKTANKER_NEU[overrideKey] != null
        ? BEKANNTE_MARKTANKER_NEU[overrideKey]
        : wiederverkauf.marktAnkerNeuSchaetzung;
      const neuerWert = pricing.berechneNeuVersiegelt({
        eigenerVK,
        marktAnkerNeu,
        niveauFaktor,
      });

      const alterWert = variante.preise.neuVersiegelt;
      if (alterWert === neuerWert) {
        unveraendert++;
        return;
      }
      if (neuerWert == null) keinAnker++;

      aenderungen.push({
        id: geraetAnkauf.id,
        marke: geraetAnkauf.marke,
        modell: geraetAnkauf.modell,
        variante: variante.bezeichnung,
        alterWert,
        neuerWert,
        eigenerVK,
        marktAnkerNeu: Math.round(marktAnkerNeu),
        ankerQuelle: BEKANNTE_MARKTANKER_NEU[overrideKey] != null
          ? "manuell verifiziert (BEKANNTE_MARKTANKER_NEU)"
          : geraetKatalog.marktwertNeu != null ? "echt, skaliert (marktwertNeu im Katalog)" : "Schätzung (NEUWARE_AUFSCHLAG)",
      });

      variante.preise.neuVersiegelt = neuerWert;
    });
  });

  aenderungen.sort((a, b) => (b.alterWert || 0) - (a.alterWert || 0));

  console.log("Migration neuVersiegelt-Formel" + (dryRun ? " (DRY-RUN - keine Datei geändert)" : ""));
  console.log("Geräte gesamt:", ankaufListe.length);
  console.log("Varianten geändert:", aenderungen.length, "| unverändert:", unveraendert, "| übersprungen (manuell):", uebersprungenManuell, "| davon jetzt ohne Anker (null):", keinAnker);
  console.log("");
  aenderungen.forEach((a) => {
    console.log(
      "  " + a.marke + " " + a.modell + " (" + a.variante + "): " +
      (a.alterWert == null ? "–" : a.alterWert + "€") + " -> " +
      (a.neuerWert == null ? "–" : a.neuerWert + "€") +
      "  [eigenerVK=" + (a.eigenerVK == null ? "–" : a.eigenerVK + "€") +
      ", marktAnkerNeu=" + a.marktAnkerNeu + "€ (" + a.ankerQuelle + ")]"
    );
  });

  if (dryRun) {
    console.log("\nDry-Run beendet: keine Datei geschrieben.");
    return;
  }

  if (!aenderungen.length) {
    console.log("\nKeine Änderungen - nichts zu schreiben.");
    return;
  }

  const originale = new Map();
  function merkeOriginal(datei) {
    if (fs.existsSync(datei)) originale.set(datei, fs.readFileSync(datei, "utf8"));
  }
  [ANKAUF_FILE, ...KATEGORIEN.map((k) => path.join(SPLIT_DIR, k + ".json"))].forEach(merkeOriginal);

  backupIfChanged(ANKAUF_FILE);
  fs.writeFileSync(ANKAUF_FILE, JSON.stringify(ankaufRoh, null, 2) + "\n", "utf8");

  fs.mkdirSync(SPLIT_DIR, { recursive: true });
  KATEGORIEN.forEach((k) => {
    const teilliste = ankaufListe.filter((g) => g.kategorie === k);
    const zielpfad = path.join(SPLIT_DIR, k + ".json");
    backupIfChanged(zielpfad);
    fs.writeFileSync(zielpfad, JSON.stringify(teilliste), "utf8");
  });

  try {
    execFileSync("node", [VALIDATE_SCRIPT], { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    console.error("\nvalidate-data.js ist fehlgeschlagen - rolle alle Änderungen zurück, kein Commit.");
    originale.forEach((inhalt, datei) => fs.writeFileSync(datei, inhalt, "utf8"));
    process.exit(1);
  }

  console.log("\nFertig. validate-data.js grün, " + aenderungen.length + " Variante(n) geschrieben.");
}

main();

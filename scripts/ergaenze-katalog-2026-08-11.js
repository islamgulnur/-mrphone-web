/**
 * Einmalige Ergänzung: 14 neue Katalog-Lücken (Tablets/Smartphones/Watches/Laptops) eintragen,
 * die beim Kassensystem-Import + systematischem Katalog-Scan am 11.08.2026 gefunden wurden
 * (siehe OFFENE-PUNKTE.md). UVP-Werte websuche-recherchiert und vom Betreiber freigegeben.
 *
 * Zusätzlich: kat-0260 "Galaxy Watch Ultra 2" von UVP 699/Jahr 2025 auf UVP 749/Jahr 2026
 * aktualisiert (Samsung behält den Produktnamen über zwei Modelljahre bei, siehe Betreiber-
 * Entscheidung 11.08.2026 - kein neuer Katalogeintrag, sondern Preis-/Jahres-Update).
 *
 * Neue Geräte bekommen KEIN marktwertGebraucht von Hand - stattdessen dieselbe Bootstrap-Formel
 * wie scripts/befuelle-marktwert.js (uvp × altersfaktor(jahr) × markenfaktor(marke)), danach
 * pricing.berechnePreise() für ankauf-preise.json + Split-Dateien, wie in
 * scripts/korrigiere-speichervarianten.js.
 *
 * Ausführen:
 *   node scripts/ergaenze-katalog-2026-08-11.js --dry-run
 *   node scripts/ergaenze-katalog-2026-08-11.js
 */
const fs = require("fs");
const path = require("path");

const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const BESTAND_FILE = path.join(ROOT, "bestand.json");

const NEUE_GERAETE = [
  { kategorie: "smartphones", marke: "Samsung", modell: "Galaxy A37", jahr: 2026, uvp: 429,
    varianten: [{ bezeichnung: "128 GB", uvpDelta: 0 }, { bezeichnung: "256 GB", uvpDelta: 90 }] },
  { kategorie: "smartphones", marke: "Samsung", modell: "Galaxy A57", jahr: 2026, uvp: 529,
    varianten: [{ bezeichnung: "128 GB", uvpDelta: 0 }, { bezeichnung: "256 GB", uvpDelta: 60 }] },
  { kategorie: "tablets", marke: "Apple", modell: "iPad Pro 11\" Gen 6 (2025, M5)", jahr: 2025, uvp: 1299,
    varianten: [
      { bezeichnung: "256 GB", uvpDelta: 0 }, { bezeichnung: "512 GB", uvpDelta: 250 },
      { bezeichnung: "1 TB", uvpDelta: 730 }, { bezeichnung: "2 TB", uvpDelta: 1350 },
    ] },
  { kategorie: "tablets", marke: "Apple", modell: "iPad Pro 13\" Gen 8 (2025, M5)", jahr: 2025, uvp: 1649,
    varianten: [
      { bezeichnung: "256 GB", uvpDelta: 0 }, { bezeichnung: "512 GB", uvpDelta: 250 },
      { bezeichnung: "1 TB", uvpDelta: 730 }, { bezeichnung: "2 TB", uvpDelta: 1350 },
    ] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Pro 14\" M5", jahr: 2025, uvp: 1899,
    varianten: [{ bezeichnung: "16 GB · 1 TB", uvpDelta: 0 }] },
  { kategorie: "smartphones", marke: "Samsung", modell: "Galaxy Z Flip 8", jahr: 2026, uvp: 1299,
    varianten: [{ bezeichnung: "256 GB", uvpDelta: 0 }, { bezeichnung: "512 GB", uvpDelta: 200 }] },
  { kategorie: "smartphones", marke: "Xiaomi", modell: "Redmi A5", jahr: 2025, uvp: 120,
    varianten: [{ bezeichnung: "64 GB", uvpDelta: 0 }, { bezeichnung: "128 GB", uvpDelta: 20 }] },
  { kategorie: "tablets", marke: "Samsung", modell: "Galaxy Tab A9+", jahr: 2023, uvp: 249,
    varianten: [{ bezeichnung: "64 GB", uvpDelta: 0 }, { bezeichnung: "128 GB", uvpDelta: 50 }] },
  { kategorie: "tablets", marke: "Xiaomi", modell: "Pad 7 Pro", jahr: 2024, uvp: 500,
    varianten: [{ bezeichnung: "256 GB", uvpDelta: 0 }, { bezeichnung: "512 GB", uvpDelta: 100 }] },
  { kategorie: "tablets", marke: "Apple", modell: "iPad Air 7 13\" (2025)", jahr: 2025, uvp: 949,
    varianten: [{ bezeichnung: "128 GB", uvpDelta: 0 }] },
  { kategorie: "smartwatches", marke: "Samsung", modell: "Galaxy Watch9", jahr: 2026, uvp: 409,
    varianten: [
      { bezeichnung: "40mm", uvpDelta: 0 }, { bezeichnung: "44mm", uvpDelta: 30 },
      { bezeichnung: "44mm LTE", uvpDelta: 80 },
    ] },
  { kategorie: "smartphones", marke: "OnePlus", modell: "15", jahr: 2025, uvp: 949,
    varianten: [{ bezeichnung: "256 GB", uvpDelta: 0 }, { bezeichnung: "512 GB", uvpDelta: 151 }] },
  { kategorie: "tablets", marke: "Lenovo", modell: "Tab Plus", jahr: 2024, uvp: 329,
    varianten: [{ bezeichnung: "128 GB", uvpDelta: 0 }] },
  { kategorie: "smartphones", marke: "Samsung", modell: "Galaxy A06", jahr: 2024, uvp: 103,
    varianten: [{ bezeichnung: "64 GB", uvpDelta: 0 }] },
];

// kat-0260 Galaxy Watch Ultra 2: Samsung behält den Produktnamen bei, kein neuer Eintrag.
const WATCH_ULTRA2_UPDATE = { id: "kat-0260", jahr: 2026, uvp: 749 };

function ladeJson(datei, fallback) {
  if (!fs.existsSync(datei)) return fallback;
  const inhalt = fs.readFileSync(datei, "utf8");
  return inhalt.trim() ? JSON.parse(inhalt) : fallback;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");

  const katalog = ladeJson(KATALOG_FILE, []);
  const ankaufRoh = ladeJson(ANKAUF_FILE, []);
  const ankauf = ankaufRoh.filter((d) => d && d.id);
  const bestandListe = ladeJson(BESTAND_FILE, []);

  const log = [];
  let naechsteId = Math.max(...katalog.map((g) => parseInt(g.id.split("-")[1], 10))) + 1;

  // --- kat-0260 Galaxy Watch Ultra 2 aktualisieren ---
  const watchKatalog = katalog.find((g) => g.id === WATCH_ULTRA2_UPDATE.id);
  const watchAnkauf = ankauf.find((g) => g.id === WATCH_ULTRA2_UPDATE.id);
  if (!watchKatalog || !watchAnkauf) {
    log.push("FEHLER: " + WATCH_ULTRA2_UPDATE.id + " (Galaxy Watch Ultra 2) nicht gefunden - abgebrochen.");
  } else {
    watchKatalog.jahr = WATCH_ULTRA2_UPDATE.jahr;
    watchKatalog.uvp = WATCH_ULTRA2_UPDATE.uvp;
    // marktwertGebraucht war "geschaetzt" auf Basis der alten UVP/Jahr - neu bootstrappen.
    const basiswert = pricing.marktwert(watchKatalog.uvp, watchKatalog.jahr, watchKatalog.marke, watchKatalog.modell);
    watchKatalog.marktwertGebraucht = pricing.rundeAuf5(basiswert);
    watchKatalog.marktwertQuelle = "geschaetzt";

    watchAnkauf.jahr = WATCH_ULTRA2_UPDATE.jahr;
    watchAnkauf.neupreisUvp = WATCH_ULTRA2_UPDATE.uvp;
    watchAnkauf.varianten = watchKatalog.varianten.map((v) => {
      const berechnung = pricing.berechnePreise(watchKatalog, v, bestandListe);
      return { bezeichnung: v.bezeichnung, uvpDelta: v.uvpDelta, preise: berechnung.preise, preisQuelle: "auto" };
    });
    log.push(
      "AKTUALISIERT " + WATCH_ULTRA2_UPDATE.id + " Galaxy Watch Ultra 2: UVP 699->749€, Jahr 2025->2026, " +
      "marktwertGebraucht->" + watchKatalog.marktwertGebraucht + "€ (geschaetzt), " +
      "neuVersiegelt=" + watchAnkauf.varianten[0].preise.neuVersiegelt + "€"
    );
  }

  // --- Neue Geräte anlegen ---
  const splitDateien = new Map(); // kategorie -> array (mutiert)
  function ladeSplit(kategorie) {
    if (!splitDateien.has(kategorie)) {
      splitDateien.set(kategorie, ladeJson(path.join(SPLIT_DIR, kategorie + ".json"), []));
    }
    return splitDateien.get(kategorie);
  }

  NEUE_GERAETE.forEach((neu) => {
    const id = "kat-" + String(naechsteId).padStart(4, "0");
    naechsteId += 1;

    const geraetKatalog = {
      id, kategorie: neu.kategorie, marke: neu.marke, modell: neu.modell, jahr: neu.jahr, uvp: neu.uvp,
      varianten: neu.varianten.map((v) => ({ ...v })),
    };
    const basiswert = pricing.marktwert(geraetKatalog.uvp, geraetKatalog.jahr, geraetKatalog.marke, geraetKatalog.modell);
    geraetKatalog.marktwertGebraucht = pricing.rundeAuf5(basiswert);
    geraetKatalog.marktwertQuelle = "geschaetzt";
    katalog.push(geraetKatalog);

    const varianten = geraetKatalog.varianten.map((v) => {
      const berechnung = pricing.berechnePreise(geraetKatalog, v, bestandListe);
      return { bezeichnung: v.bezeichnung, uvpDelta: v.uvpDelta, preise: berechnung.preise, preisQuelle: "auto" };
    });
    pricing.wendeSpeicherKonsistenzAn(varianten); // Speichergrößen-Inversion sofort korrigieren

    const geraetAnkauf = {
      id, kategorie: neu.kategorie, marke: neu.marke, modell: neu.modell, jahr: neu.jahr,
      neupreisUvp: neu.uvp, beliebt: false, varianten,
    };
    ankauf.push(geraetAnkauf);
    ladeSplit(neu.kategorie).push(geraetAnkauf);

    log.push(
      "NEU " + id + " " + neu.marke + " " + neu.modell + " (UVP " + neu.uvp + "€, marktwertGebraucht " +
      geraetKatalog.marktwertGebraucht + "€ geschaetzt): " +
      varianten.map((v) => v.bezeichnung + "=" + v.preise.neuVersiegelt + "€").join(", ")
    );
  });

  // kat-0260 auch in den Split-Datei-Kopien aktualisieren (falls geladen)
  if (watchKatalog) {
    const splitWatch = ladeSplit("smartwatches");
    const idx = splitWatch.findIndex((g) => g.id === "kat-0260");
    if (idx >= 0) splitWatch[idx] = watchAnkauf;
  }

  console.log("Katalog-Ergänzung 11.08.2026" + (dryRun ? " (DRY-RUN)" : ""));
  console.log("");
  log.forEach((zeile) => console.log("  " + zeile));

  if (dryRun) {
    console.log("\nDry-Run beendet: keine Datei geschrieben.");
    return;
  }

  [KATALOG_FILE, ANKAUF_FILE, ...Array.from(splitDateien.keys()).map((k) => path.join(SPLIT_DIR, k + ".json"))]
    .forEach((datei) => backupIfChanged(datei));

  fs.writeFileSync(KATALOG_FILE, JSON.stringify(katalog, null, 2) + "\n", "utf8");
  fs.writeFileSync(ANKAUF_FILE, JSON.stringify(ankauf, null, 2) + "\n", "utf8");
  splitDateien.forEach((liste, kategorie) => {
    fs.writeFileSync(path.join(SPLIT_DIR, kategorie + ".json"), JSON.stringify(liste, null, 2) + "\n", "utf8");
  });

  console.log("\nGeschrieben: " + KATALOG_FILE + ", " + ANKAUF_FILE + ", " +
    Array.from(splitDateien.keys()).map((k) => "ankauf/" + k + ".json").join(", "));
}

main();

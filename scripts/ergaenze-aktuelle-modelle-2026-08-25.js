/**
 * Einmalige, idempotente Katalogpflege fuer die am 25.08.2026 offiziell in Deutschland
 * angebotenen Modellreihen. Kameras und Monitore bleiben auf Betreiberwunsch unberuehrt.
 *
 * Quellenbasis (jeweils Herstellerseiten/Hersteller-Newsroom, Stand 25.08.2026):
 * Apple, Google Store, Samsung Deutschland, Xiaomi Deutschland, Nothing Deutschland,
 * Sony Deutschland, OnePlus Deutschland und HONOR Deutschland.
 *
 * Sicherheitsregeln:
 * - geraete-katalog.json bleibt die Single Source of Truth.
 * - Vor jedem Schreiben wird jede betroffene Datendatei gesichert.
 * - Bestehende manuelle Ankaufspreise werden nie veraendert.
 * - Es wird kein Voll-Build ausgefuehrt; nur neue bzw. hier explizit korrigierte Eintraege
 *   werden angefasst.
 * - Bei fehlgeschlagener Validierung werden alle Schreibvorgaenge zurueckgerollt.
 *
 * Ausfuehren:
 *   node scripts/ergaenze-aktuelle-modelle-2026-08-25.js --dry-run
 *   node scripts/ergaenze-aktuelle-modelle-2026-08-25.js
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const BESTAND_FILE = path.join(ROOT, "bestand.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");

const NEUE_GERAETE = [
  // Apple
  { kategorie: "smartphones", marke: "Apple", modell: "iPhone 17e", jahr: 2026, uvp: 699,
    varianten: [["256 GB", 0], ["512 GB", 250]] },
  { kategorie: "tablets", marke: "Apple", modell: "iPad Air 11\" (M4, 2026)", jahr: 2026, uvp: 649,
    varianten: [["128 GB", 0], ["256 GB", 130], ["512 GB", 380], ["1 TB", 760]] },
  { kategorie: "tablets", marke: "Apple", modell: "iPad Air 13\" (M4, 2026)", jahr: 2026, uvp: 849,
    varianten: [["128 GB", 0], ["256 GB", 130], ["512 GB", 380], ["1 TB", 760]] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Neo 13\"", jahr: 2026, uvp: 699,
    varianten: [["8 GB · 256 GB", 0], ["8 GB · 512 GB", 200]] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Air 13\" M5", jahr: 2026, uvp: 1199,
    varianten: [["16 GB · 512 GB", 0]] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Air 15\" M5", jahr: 2026, uvp: 1499,
    varianten: [["16 GB · 512 GB", 0]] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Pro 14\" M5 Pro", jahr: 2026, uvp: 2499,
    varianten: [["24 GB · 1 TB", 0]] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Pro 16\" M5 Pro", jahr: 2026, uvp: 2999,
    varianten: [["24 GB · 1 TB", 0]] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Pro 14\" M5 Max", jahr: 2026, uvp: 4199,
    varianten: [["36 GB · 2 TB", 0]] },
  { kategorie: "laptops", marke: "Apple", modell: "MacBook Pro 16\" M5 Max", jahr: 2026, uvp: 4499,
    varianten: [["36 GB · 2 TB", 0]] },
  { kategorie: "kopfhoerer", marke: "Apple", modell: "AirPods Max 2", jahr: 2026, uvp: 579,
    varianten: [["Standard", 0]] },

  // Google
  { kategorie: "smartphones", marke: "Google", modell: "Pixel 10a", jahr: 2026, uvp: 549,
    varianten: [["128 GB", 0], ["256 GB", 100]] },
  { kategorie: "smartphones", marke: "Google", modell: "Pixel 11", jahr: 2026, uvp: 999,
    varianten: [["256 GB", 0], ["512 GB", 130]] },
  { kategorie: "smartphones", marke: "Google", modell: "Pixel 11 Pro", jahr: 2026, uvp: 1199,
    varianten: [["256 GB", 0], ["512 GB", 130], ["1 TB", 390]] },
  { kategorie: "smartphones", marke: "Google", modell: "Pixel 11 Pro XL", jahr: 2026, uvp: 1399,
    varianten: [["256 GB", 0], ["512 GB", 130], ["1 TB", 390]] },
  { kategorie: "smartphones", marke: "Google", modell: "Pixel 11 Pro Fold", jahr: 2026, uvp: 1999,
    varianten: [["256 GB", 0], ["512 GB", 130], ["1 TB", 390]] },
  { kategorie: "smartwatches", marke: "Google", modell: "Pixel Watch 5", jahr: 2026, uvp: 419,
    varianten: [["41mm", 0], ["45mm", 30], ["41mm LTE", 100], ["45mm LTE", 130]] },

  // Samsung
  { kategorie: "smartphones", marke: "Samsung", modell: "Galaxy Z Fold 8", jahr: 2026, uvp: 1999,
    varianten: [["256 GB", 0], ["512 GB", 200], ["1 TB", 450]] },
  { kategorie: "smartphones", marke: "Samsung", modell: "Galaxy Z Fold 8 Ultra", jahr: 2026, uvp: 2199,
    varianten: [["256 GB", 0], ["512 GB", 200], ["1 TB", 450]] },
  { kategorie: "kopfhoerer", marke: "Samsung", modell: "Galaxy Buds 4", jahr: 2026, uvp: 179,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Samsung", modell: "Galaxy Buds 4 Pro", jahr: 2026, uvp: 249,
    varianten: [["Standard", 0]] },

  // Xiaomi / Redmi / POCO
  { kategorie: "smartphones", marke: "Xiaomi", modell: "15T", jahr: 2025, uvp: 649.9,
    varianten: [["256 GB", 0], ["512 GB", 50]] },
  { kategorie: "smartphones", marke: "Xiaomi", modell: "17T", jahr: 2026, uvp: 749.9,
    varianten: [["256 GB", 0], ["512 GB", 50]] },
  { kategorie: "smartphones", marke: "Xiaomi", modell: "17T Pro", jahr: 2026, uvp: 899.9,
    varianten: [["256 GB", 0], ["512 GB", 100], ["1 TB", 200]] },
  { kategorie: "smartphones", marke: "Redmi", modell: "Note 15", jahr: 2026, uvp: 199.9,
    varianten: [["128 GB", 0], ["256 GB", 50]] },
  { kategorie: "smartphones", marke: "Redmi", modell: "Note 15 5G", jahr: 2026, uvp: 279.9,
    varianten: [["128 GB", 0], ["256 GB", 20]] },
  { kategorie: "smartphones", marke: "Redmi", modell: "Note 15 Pro 5G", jahr: 2026, uvp: 399.9,
    varianten: [["256 GB", 0], ["512 GB", 30]] },
  { kategorie: "smartphones", marke: "Redmi", modell: "A7 Pro", jahr: 2026, uvp: 129.9,
    varianten: [["128 GB", 0], ["256 GB", 20]] },
  { kategorie: "smartphones", marke: "POCO", modell: "F8 Ultra", jahr: 2025, uvp: 829.9,
    varianten: [["256 GB", 0], ["512 GB", 70]] },
  { kategorie: "smartphones", marke: "POCO", modell: "F8 Pro", jahr: 2025, uvp: 649.9,
    varianten: [["256 GB", 0], ["512 GB", 50]] },
  { kategorie: "smartphones", marke: "POCO", modell: "X8 Pro Max", jahr: 2026, uvp: 529.9,
    varianten: [["256 GB", 0], ["512 GB", 50]] },
  { kategorie: "smartphones", marke: "POCO", modell: "X8 Pro", jahr: 2026, uvp: 399.9,
    varianten: [["256 GB", 0], ["512 GB", 50]] },
  { kategorie: "smartphones", marke: "POCO", modell: "M8 Pro 5G", jahr: 2026, uvp: 349.9,
    varianten: [["256 GB", 0], ["512 GB", 50]] },
  { kategorie: "smartphones", marke: "POCO", modell: "M8 5G", jahr: 2026, uvp: 269.9,
    varianten: [["256 GB", 0], ["512 GB", 30]] },
  { kategorie: "tablets", marke: "Xiaomi", modell: "Pad 8", jahr: 2025, uvp: 449.9,
    varianten: [["128 GB", 0], ["256 GB", 50]] },
  { kategorie: "tablets", marke: "Xiaomi", modell: "Pad 8 Pro", jahr: 2025, uvp: 599.9,
    varianten: [["256 GB", 0], ["512 GB", 150]] },

  // Nothing / CMF
  { kategorie: "smartphones", marke: "Nothing", modell: "Phone (4a)", jahr: 2026, uvp: 349,
    varianten: [["128 GB", 0], ["256 GB", 80]] },
  { kategorie: "smartphones", marke: "Nothing", modell: "Phone (4a) Pro", jahr: 2026, uvp: 529,
    varianten: [["128 GB", 0], ["256 GB", 100]] },
  { kategorie: "smartphones", marke: "Nothing", modell: "Phone (4b)", jahr: 2026, uvp: 329,
    varianten: [["128 GB", 0]] },
  { kategorie: "smartphones", marke: "Nothing", modell: "Phone (3a) Lite", jahr: 2025, uvp: 249,
    varianten: [["128 GB", 0], ["256 GB", 30]] },
  { kategorie: "smartphones", marke: "CMF", modell: "Phone 2 Pro", jahr: 2025, uvp: 249,
    varianten: [["128 GB", 0], ["256 GB", 30]] },

  // Sony / OnePlus / HONOR
  { kategorie: "smartphones", marke: "Sony", modell: "Xperia 1 VIII", jahr: 2026, uvp: 1499,
    varianten: [["256 GB", 0], ["1 TB", 500]] },
  { kategorie: "smartphones", marke: "OnePlus", modell: "15R", jahr: 2025, uvp: 699,
    varianten: [["256 GB", 0], ["512 GB", 100]] },
  { kategorie: "smartphones", marke: "Honor", modell: "Magic V6", jahr: 2026, uvp: 2299.99,
    varianten: [["512 GB", 0]] },
  { kategorie: "smartphones", marke: "Honor", modell: "Magic 8 Pro", jahr: 2026, uvp: 1299.9,
    varianten: [["512 GB", 0]] },
  { kategorie: "smartphones", marke: "Honor", modell: "600", jahr: 2026, uvp: 599.9,
    varianten: [["512 GB", 0]] },
  { kategorie: "smartphones", marke: "Honor", modell: "600 Pro", jahr: 2026, uvp: 999.9,
    varianten: [["512 GB", 0]] },

  // Zweiter Vollscan: weitere aktuelle Herstellerreihen mit bestaetigten DE-/EU-Preisen
  { kategorie: "smartphones", marke: "Fairphone", modell: "Fairphone (Gen. 6)", jahr: 2025, uvp: 599,
    varianten: [["8 GB · 256 GB", 0]] },
  { kategorie: "smartphones", marke: "Fairphone", modell: "Fairphone (Gen. 6+)", jahr: 2026, uvp: 649,
    varianten: [["12 GB · 256 GB", 0]] },
  { kategorie: "smartphones", marke: "Asus", modell: "Asus Zenfone 12 Ultra", jahr: 2025, uvp: 1099,
    varianten: [["16 GB · 512 GB", 0]] },
  { kategorie: "smartphones", marke: "Asus", modell: "Asus ROG Phone 9", jahr: 2025, uvp: 1149.99,
    varianten: [["12 GB · 512 GB", 0]] },
  { kategorie: "smartphones", marke: "Asus", modell: "Asus ROG Phone 9 Pro", jahr: 2025, uvp: 1299.99,
    varianten: [["16 GB · 512 GB", 0]] },
  { kategorie: "smartphones", marke: "Oppo", modell: "Oppo Find X9 Pro", jahr: 2025, uvp: 1299,
    varianten: [["16 GB · 512 GB", 0]] },
  { kategorie: "smartphones", marke: "Huawei", modell: "Mate X6", jahr: 2025, uvp: 1999,
    varianten: [["512 GB", 0]] },
  { kategorie: "smartphones", marke: "Huawei", modell: "Mate X7", jahr: 2026, uvp: 2099,
    varianten: [["512 GB", 0]] },
  { kategorie: "smartphones", marke: "Huawei", modell: "Pura 80 Pro", jahr: 2025, uvp: 1099,
    varianten: [["512 GB", 0]] },
  { kategorie: "smartphones", marke: "Huawei", modell: "Pura 80 Ultra", jahr: 2025, uvp: 1499,
    varianten: [["512 GB", 0]] },
  { kategorie: "smartphones", marke: "Huawei", modell: "nova 14 Pro", jahr: 2025, uvp: 699,
    varianten: [["512 GB", 0]] },

  { kategorie: "tablets", marke: "Lenovo", modell: "Legion Tab Gen 3", jahr: 2025, uvp: 649,
    varianten: [["12 GB · 256 GB", 0]] },
  { kategorie: "tablets", marke: "Huawei", modell: "MatePad Pro Max", jahr: 2026, uvp: 1299,
    varianten: [["512 GB", 0]] },
  { kategorie: "tablets", marke: "Huawei", modell: "MatePad Pro 12.2\"", jahr: 2025, uvp: 999,
    varianten: [["512 GB", 0]] },
  { kategorie: "tablets", marke: "Huawei", modell: "MatePad 12 X", jahr: 2025, uvp: 649,
    varianten: [["256 GB", 0]] },
  { kategorie: "tablets", marke: "Huawei", modell: "MatePad 11.5 S", jahr: 2025, uvp: 499,
    varianten: [["256 GB", 0]] },
  { kategorie: "tablets", marke: "Huawei", modell: "MatePad 11.5", jahr: 2025, uvp: 349,
    varianten: [["256 GB", 0]] },

  { kategorie: "smartwatches", marke: "Huawei", modell: "Watch 5", jahr: 2025, uvp: 449,
    varianten: [["42mm", 0], ["46mm", 100], ["46mm Titanarmband", 200]] },
  { kategorie: "smartwatches", marke: "Huawei", modell: "Watch GT 6", jahr: 2025, uvp: 249,
    varianten: [["41mm", 0], ["46mm", 20]] },
  { kategorie: "smartwatches", marke: "Huawei", modell: "Watch GT 6 Pro", jahr: 2025, uvp: 379,
    varianten: [["46mm", 0], ["46mm Titanarmband", 120]] },
  { kategorie: "smartwatches", marke: "Huawei", modell: "Watch Buds 2", jahr: 2026, uvp: 499,
    varianten: [["Standard", 0]] },
  { kategorie: "smartwatches", marke: "Huawei", modell: "Watch Fit 5", jahr: 2025, uvp: 199,
    varianten: [["Standard", 0]] },
  { kategorie: "smartwatches", marke: "Huawei", modell: "Watch Fit 5 Pro", jahr: 2025, uvp: 299,
    varianten: [["Standard", 0]] },
  { kategorie: "smartwatches", marke: "Garmin", modell: "Forerunner 570", jahr: 2025, uvp: 549.99,
    varianten: [["42mm", 0], ["47mm", 0]] },
  { kategorie: "smartwatches", marke: "Garmin", modell: "Forerunner 970", jahr: 2025, uvp: 749.99,
    varianten: [["47mm", 0]] },
  { kategorie: "smartwatches", marke: "Garmin", modell: "Venu 4", jahr: 2025, uvp: 549.99,
    varianten: [["41mm", 0], ["45mm", 0]] },
  { kategorie: "smartwatches", marke: "Garmin", modell: "Venu X1", jahr: 2025, uvp: 799.99,
    varianten: [["Standard", 0]] },

  { kategorie: "kopfhoerer", marke: "Sony", modell: "WF-1000XM6", jahr: 2026, uvp: 299,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Bose", modell: "QuietComfort Ultra (2. Gen.)", jahr: 2025, uvp: 449,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Bose", modell: "QuietComfort Ultra Earbuds (2. Gen.)", jahr: 2025, uvp: 299,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "JBL", modell: "Tour One M3", jahr: 2025, uvp: 349.99,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "JBL", modell: "Tour One M3 Smart Tx", jahr: 2025, uvp: 399.99,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Huawei", modell: "FreeClip 2", jahr: 2025, uvp: 199,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Huawei", modell: "FreeClip 2 S", jahr: 2026, uvp: 229,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Huawei", modell: "FreeBuds Pro 5", jahr: 2025, uvp: 199,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Huawei", modell: "FreeBuds 7i", jahr: 2025, uvp: 99.99,
    varianten: [["Standard", 0]] },
  { kategorie: "kopfhoerer", marke: "Huawei", modell: "FreeBuds SE 4", jahr: 2025, uvp: 59.99,
    varianten: [["Standard", 0]] },
];

const KORREKTUREN = [
  {
    id: "kat-0034",
    modellVon: "iPhone 17 Air",
    modell: "iPhone Air",
    jahr: 2025,
    uvp: 1199,
    varianten: [["256 GB", 0], ["512 GB", 250], ["1 TB", 500]],
  },
  {
    id: "kat-0131",
    modellVon: "Note 15 Pro",
    modell: "Note 15 Pro",
    jahr: 2026,
    uvp: 349.9,
    varianten: [["256 GB", 0], ["512 GB", 50]],
  },
  {
    id: "kat-0132",
    modellVon: "Note 15 Pro+",
    modell: "Note 15 Pro+ 5G",
    jahr: 2026,
    uvp: 499.9,
    varianten: [["256 GB", 0], ["512 GB", 30]],
  },
];

function ladeJson(datei, fallback = []) {
  if (!fs.existsSync(datei)) return fallback;
  const inhalt = fs.readFileSync(datei, "utf8");
  return inhalt.trim() ? JSON.parse(inhalt) : fallback;
}

function klone(wert) {
  return JSON.parse(JSON.stringify(wert));
}

function normalisiere(wert) {
  return String(wert || "").trim().toLocaleLowerCase("de-DE");
}

function variantenObjekte(varianten) {
  return varianten.map(([bezeichnung, uvpDelta]) => ({ bezeichnung, uvpDelta }));
}

function dateiAusgabe(datei, daten, original) {
  const istSplit = path.dirname(datei) === SPLIT_DIR;
  if (istSplit && !original.includes("\n  {")) return JSON.stringify(daten);
  return JSON.stringify(daten, null, 2) + "\n";
}

function findeAnkauf(ankaufRoh, id) {
  return ankaufRoh.find((eintrag) => eintrag && eintrag.id === id);
}

function berechneAnkaufVarianten(geraet, alteAnkaufVarianten, bestandListe) {
  const altNachName = new Map((alteAnkaufVarianten || []).map((v) => [v.bezeichnung, v]));
  const ergebnis = geraet.varianten.map((katalogVariante) => {
    const alt = altNachName.get(katalogVariante.bezeichnung);
    if (alt && alt.preisQuelle === "manuell") {
      return { ...klone(alt), uvpDelta: katalogVariante.uvpDelta };
    }
    const berechnung = pricing.berechnePreise(geraet, katalogVariante, bestandListe);
    return {
      bezeichnung: katalogVariante.bezeichnung,
      uvpDelta: katalogVariante.uvpDelta,
      preise: berechnung.preise,
      preisQuelle: "auto",
    };
  });
  pricing.wendeSpeicherKonsistenzAn(ergebnis);
  return ergebnis;
}

function synchronisiereSplit(splitListen, kategorie, ankaufEintrag) {
  const split = splitListen.get(kategorie);
  const index = split.findIndex((g) => g && g.id === ankaufEintrag.id);
  if (index >= 0) split[index] = klone(ankaufEintrag);
  else split.push(klone(ankaufEintrag));
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dateien = [
    KATALOG_FILE,
    ANKAUF_FILE,
    ...["smartphones", "tablets", "smartwatches", "laptops", "kopfhoerer"]
      .map((k) => path.join(SPLIT_DIR, k + ".json")),
  ];
  const originale = new Map(dateien.map((datei) => [datei, fs.readFileSync(datei, "utf8")]));

  const katalog = ladeJson(KATALOG_FILE);
  const ankaufRoh = ladeJson(ANKAUF_FILE);
  const bestandListe = ladeJson(BESTAND_FILE);
  const splitListen = new Map(
    ["smartphones", "tablets", "smartwatches", "laptops", "kopfhoerer"]
      .map((k) => [k, ladeJson(path.join(SPLIT_DIR, k + ".json"))])
  );

  const protokoll = [];
  let naechsteId = Math.max(...katalog.map((g) => Number(String(g.id).split("-")[1]) || 0)) + 1;

  for (const korrektur of KORREKTUREN) {
    const geraet = katalog.find((g) => g.id === korrektur.id);
    const ankauf = findeAnkauf(ankaufRoh, korrektur.id);
    if (!geraet || !ankauf) throw new Error("Korrekturziel " + korrektur.id + " fehlt in Katalog oder Ankaufspreisen.");

    const istSchonKorrigiert = geraet.modell === korrektur.modell &&
      (korrektur.jahr == null || geraet.jahr === korrektur.jahr) &&
      (korrektur.uvp == null || geraet.uvp === korrektur.uvp) &&
      (korrektur.nurMetadaten || korrektur.varianten.every(([name, delta]) => {
        const v = geraet.varianten.find((x) => x.bezeichnung === name);
        return v && v.uvpDelta === delta;
      }));
    if (istSchonKorrigiert) {
      protokoll.push("UNVERAENDERT " + korrektur.id + " " + geraet.marke + " " + geraet.modell);
      continue;
    }

    if (geraet.modell !== korrektur.modellVon && geraet.modell !== korrektur.modell) {
      throw new Error("Unerwartetes Modell bei " + korrektur.id + ": " + geraet.modell);
    }

    const altName = geraet.modell;
    geraet.modell = korrektur.modell;
    ankauf.modell = korrektur.modell;

    if (!korrektur.nurMetadaten) {
      geraet.jahr = korrektur.jahr;
      geraet.uvp = korrektur.uvp;
      ankauf.jahr = korrektur.jahr;
      ankauf.neupreisUvp = korrektur.uvp;

      const altKatalogVarianten = new Map(geraet.varianten.map((v) => [v.bezeichnung, v]));
      geraet.varianten = variantenObjekte(korrektur.varianten).map((v) => ({
        ...(altKatalogVarianten.has(v.bezeichnung) ? klone(altKatalogVarianten.get(v.bezeichnung)) : {}),
        bezeichnung: v.bezeichnung,
        uvpDelta: v.uvpDelta,
      }));
      ankauf.varianten = berechneAnkaufVarianten(geraet, ankauf.varianten, bestandListe);
    }

    synchronisiereSplit(splitListen, geraet.kategorie, ankauf);
    protokoll.push("KORRIGIERT " + korrektur.id + " " + geraet.marke + " " + altName + " -> " + geraet.modell);
  }

  for (const neu of NEUE_GERAETE) {
    const vorhanden = katalog.find((g) =>
      g.kategorie === neu.kategorie && normalisiere(g.marke) === normalisiere(neu.marke) &&
      normalisiere(g.modell) === normalisiere(neu.modell)
    );
    if (vorhanden) {
      protokoll.push("UNVERAENDERT " + vorhanden.id + " " + vorhanden.marke + " " + vorhanden.modell);
      continue;
    }

    const id = "kat-" + String(naechsteId).padStart(4, "0");
    naechsteId += 1;
    const geraet = {
      id,
      kategorie: neu.kategorie,
      marke: neu.marke,
      modell: neu.modell,
      jahr: neu.jahr,
      uvp: neu.uvp,
      varianten: variantenObjekte(neu.varianten),
    };
    geraet.marktwertGebraucht = pricing.rundeAuf5(
      pricing.marktwert(geraet.uvp, geraet.jahr, geraet.marke, geraet.modell)
    );
    geraet.marktwertQuelle = "geschaetzt";

    const ankauf = {
      id,
      kategorie: neu.kategorie,
      marke: neu.marke,
      modell: neu.modell,
      jahr: neu.jahr,
      neupreisUvp: neu.uvp,
      beliebt: false,
      varianten: berechneAnkaufVarianten(geraet, [], bestandListe),
    };

    katalog.push(geraet);
    ankaufRoh.push(ankauf);
    synchronisiereSplit(splitListen, neu.kategorie, ankauf);
    protokoll.push(
      "NEU " + id + " " + neu.marke + " " + neu.modell + ": " +
      ankauf.varianten.map((v) => v.bezeichnung + "=" + v.preise.neuVersiegelt + " EUR").join(", ")
    );
  }

  const neueSchluessel = new Set();
  for (const geraet of katalog) {
    const schluessel = [geraet.kategorie, normalisiere(geraet.marke), normalisiere(geraet.modell)].join("|");
    if (neueSchluessel.has(schluessel)) {
      throw new Error("Doppeltes Modell nach Migration: " + geraet.marke + " " + geraet.modell);
    }
    neueSchluessel.add(schluessel);
  }

  const ausgaben = new Map();
  ausgaben.set(KATALOG_FILE, dateiAusgabe(KATALOG_FILE, katalog, originale.get(KATALOG_FILE)));
  ausgaben.set(ANKAUF_FILE, dateiAusgabe(ANKAUF_FILE, ankaufRoh, originale.get(ANKAUF_FILE)));
  for (const [kategorie, liste] of splitListen) {
    const datei = path.join(SPLIT_DIR, kategorie + ".json");
    ausgaben.set(datei, dateiAusgabe(datei, liste, originale.get(datei)));
  }

  const geaenderteDateien = Array.from(ausgaben).filter(([datei, inhalt]) => originale.get(datei) !== inhalt);
  console.log("Aktuelle Modelle 25.08.2026" + (dryRun ? " (DRY-RUN)" : ""));
  protokoll.forEach((zeile) => console.log("  " + zeile));
  console.log("\nNeue Modelle: " + protokoll.filter((z) => z.startsWith("NEU ")).length);
  console.log("Korrekturen: " + protokoll.filter((z) => z.startsWith("KORRIGIERT ")).length);
  console.log("Betroffene Dateien: " + geaenderteDateien.map(([d]) => path.relative(ROOT, d)).join(", "));

  if (dryRun || geaenderteDateien.length === 0) {
    console.log(dryRun ? "Dry-Run beendet: keine Datei geschrieben." : "Keine Aenderung erforderlich.");
    return;
  }

  geaenderteDateien.forEach(([datei]) => backupIfChanged(datei));
  try {
    geaenderteDateien.forEach(([datei, inhalt]) => fs.writeFileSync(datei, inhalt, "utf8"));
    const validierung = spawnSync(process.execPath, [path.join(ROOT, "validate-data.js")], {
      cwd: ROOT,
      encoding: "utf8",
    });
    process.stdout.write(validierung.stdout || "");
    process.stderr.write(validierung.stderr || "");
    if (validierung.status !== 0) throw new Error("validate-data.js meldet Fehler.");
  } catch (fehler) {
    geaenderteDateien.forEach(([datei]) => fs.writeFileSync(datei, originale.get(datei), "utf8"));
    throw new Error("Migration zurueckgerollt: " + fehler.message);
  }

  console.log("Migration abgeschlossen und validiert.");
}

main();

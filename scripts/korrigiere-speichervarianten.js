/**
 * Einmalige Korrektur: Speichervarianten-Audit (28.07.2026, siehe OFFENE-PUNKTE.md) gegen
 * geraete-katalog.json anwenden - falsche Varianten entfernen, fehlende (websuche-bestätigte)
 * Varianten ergänzen. ankauf-preise.json + Split-Dateien werden im GLEICHEN Lauf
 * nachgezogen: neue Varianten bekommen einen Preis über pricing.berechnePreise() (Bootstrap-
 * Formel, wie bei jedem neuen Katalogeintrag), entfernte Varianten werden aus ankauf-preise.json
 * entfernt. Bestehende, bereits kalibrierte Varianten werden NICHT angefasst (kein Aufruf von
 * scripts/build-ankauf-preise.js, das würde die real-marktdaten-kalibrierten Preise anderer
 * Varianten überschreiben).
 *
 * uvpDelta-Werte für neue Varianten sind mangels offizieller Preislisten-Recherche PLAUSIBLE
 * SCHÄTZUNGEN (grob am UVP-Niveau des Geräts orientiert, nicht einzeln verifiziert) - beeinflusst
 * nur den geschätzten Neuware-Wiederverkaufswert dieser einen neuen Variante, nicht bestehende
 * Varianten oder andere Geräte.
 *
 * Ausführen:
 *   node scripts/korrigiere-speichervarianten.js --dry-run
 *   node scripts/korrigiere-speichervarianten.js
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

// --- Korrekturen (id -> { entfernen: [bezeichnung], hinzufuegen: [{bezeichnung, uvpDelta}] }) ---
const KORREKTUREN = {
  // FALSCH (Websuche-bestätigt, siehe OFFENE-PUNKTE.md)
  "kat-0001": { entfernen: ["128 GB"], hinzufuegen: [] }, // iPhone 8: nur 64/256GB offiziell
  "kat-0002": { entfernen: ["128 GB"], hinzufuegen: [] }, // iPhone 8 Plus: nur 64/256GB offiziell
  "kat-0227": { entfernen: ["512 GB"], hinzufuegen: [{ bezeichnung: "128 GB", uvpDelta: -100 }] }, // Xiaomi Pad 7 (Standard): 128/256GB, nicht 512GB (nur Pro)

  // FEHLEND (Websuche-bestätigt)
  "kat-0087": { entfernen: [], hinzufuegen: [{ bezeichnung: "256 GB", uvpDelta: 30 }] },   // Galaxy A15
  "kat-0401": { entfernen: [], hinzufuegen: [{ bezeichnung: "256 GB", uvpDelta: 50 }] },   // Galaxy A33
  "kat-0118": { entfernen: [], hinzufuegen: [{ bezeichnung: "1 TB", uvpDelta: 400 }] },    // Xiaomi 13T Pro
  "kat-0122": { entfernen: [], hinzufuegen: [{ bezeichnung: "1 TB", uvpDelta: 400 }] },    // Xiaomi 15T Pro
  "kat-0128": { entfernen: [], hinzufuegen: [{ bezeichnung: "128 GB", uvpDelta: -50 }] },  // Redmi Note 13 Pro
  "kat-0410": { entfernen: [], hinzufuegen: [{ bezeichnung: "128 GB", uvpDelta: -30 }] },  // Xiaomi Redmi Note 13 Pro
  "kat-0166": { entfernen: [], hinzufuegen: [{ bezeichnung: "128 GB", uvpDelta: -60 }] },  // Nothing Phone (2)
  "kat-0175": { entfernen: [], hinzufuegen: [{ bezeichnung: "256 GB", uvpDelta: -150 }] }, // Oppo Reno 12 Pro
  "kat-0422": { entfernen: [], hinzufuegen: [{ bezeichnung: "128 GB", uvpDelta: -50 }] },  // OnePlus Nord CE4
  "kat-0432": { entfernen: [], hinzufuegen: [{ bezeichnung: "128 GB", uvpDelta: -30 }] },  // Motorola Moto G54
  "kat-0442": { entfernen: [], hinzufuegen: [
    { bezeichnung: "256 GB", uvpDelta: -200 }, { bezeichnung: "1 TB", uvpDelta: 300 },
  ] }, // Huawei Mate X3
  "kat-0456": { entfernen: [], hinzufuegen: [{ bezeichnung: "1 TB", uvpDelta: 250 }] },    // Asus ROG Phone 8 Pro
  "kat-0457": { entfernen: [], hinzufuegen: [{ bezeichnung: "512 GB", uvpDelta: 150 }] },  // Asus Zenfone 11 Ultra
  "kat-0156": { entfernen: [], hinzufuegen: [{ bezeichnung: "512 GB", uvpDelta: 200 }] },  // Sony Xperia 1 IV
  "kat-0194": { entfernen: [], hinzufuegen: [{ bezeichnung: "1 TB", uvpDelta: 600 }] },    // iPad Air 7 (2025)
  "kat-0208": { entfernen: [], hinzufuegen: [
    { bezeichnung: "256 GB", uvpDelta: 80 }, { bezeichnung: "512 GB", uvpDelta: 200 },
  ] }, // Galaxy Tab S7
  "kat-0377": { entfernen: [], hinzufuegen: [{ bezeichnung: "2TB", uvpDelta: 180 }] },     // Xbox Series X (Naming ohne Leerzeichen wie bestehende "1TB"-Variante)
  "kat-0383": { entfernen: [], hinzufuegen: [{ bezeichnung: "64GB GB", uvpDelta: -150 }] }, // Steam Deck LCD (Naming wie bestehende Varianten)
  "kat-0384": { entfernen: [], hinzufuegen: [{ bezeichnung: "256GB GB", uvpDelta: -150 }] }, // Steam Deck OLED (Naming wie bestehende Varianten)
};

// Apple TV 4K: Sonderfall, "Standard" wird durch 2 echte Herstellervarianten ersetzt.
const APPLE_TV_ID = "kat-0396";
const APPLE_TV_NEUE_VARIANTEN = [
  { bezeichnung: "64 GB (Wi-Fi)", uvpDelta: 0 },
  { bezeichnung: "128 GB (Wi-Fi + Ethernet)", uvpDelta: 40 },
];

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
  const ankaufById = new Map(ankaufListe.map((g) => [g.id, g]));
  const bestandListe = ladeJson(BESTAND_FILE, []);

  const log = [];

  function entferneVariante(id, bezeichnung) {
    const gk = katalogById.get(id);
    const ga = ankaufById.get(id);
    if (!gk || !ga) { log.push("FEHLER: " + id + " nicht gefunden"); return; }
    const vorherK = gk.varianten.length;
    gk.varianten = gk.varianten.filter((v) => v.bezeichnung !== bezeichnung);
    const vorherA = ga.varianten.length;
    ga.varianten = ga.varianten.filter((v) => v.bezeichnung !== bezeichnung);
    log.push(
      "ENTFERNT " + gk.marke + " " + gk.modell + " (" + bezeichnung + "): " +
      "Katalog " + vorherK + "->" + gk.varianten.length + " Varianten, " +
      "Ankauf " + vorherA + "->" + ga.varianten.length + " Varianten"
    );
  }

  function fuegeVarianteHinzu(id, bezeichnung, uvpDelta) {
    const gk = katalogById.get(id);
    const ga = ankaufById.get(id);
    if (!gk || !ga) { log.push("FEHLER: " + id + " nicht gefunden"); return; }
    if (gk.varianten.some((v) => v.bezeichnung === bezeichnung)) {
      log.push("ÜBERSPRUNGEN (existiert bereits): " + gk.marke + " " + gk.modell + " (" + bezeichnung + ")");
      return;
    }
    const neueKatalogVariante = { bezeichnung, uvpDelta };
    gk.varianten.push(neueKatalogVariante);

    const berechnung = pricing.berechnePreise(gk, neueKatalogVariante, bestandListe);
    const neueAnkaufVariante = { bezeichnung, uvpDelta, preise: berechnung.preise, preisQuelle: "auto" };
    ga.varianten.push(neueAnkaufVariante);

    log.push(
      "HINZUGEFÜGT " + gk.marke + " " + gk.modell + " (" + bezeichnung + ", uvpDelta " + uvpDelta + "): " +
      "neuVersiegelt=" + berechnung.preise.neuVersiegelt + "€, wieNeu=" + berechnung.preise.wieNeu +
      "€, sehrGut=" + berechnung.preise.sehrGut + "€, gut=" + berechnung.preise.gut + "€, defekt=" + berechnung.preise.defekt + "€"
    );
  }

  Object.entries(KORREKTUREN).forEach(([id, { entfernen, hinzufuegen }]) => {
    entfernen.forEach((bezeichnung) => entferneVariante(id, bezeichnung));
    hinzufuegen.forEach(({ bezeichnung, uvpDelta }) => fuegeVarianteHinzu(id, bezeichnung, uvpDelta));
  });

  // Apple TV 4K: "Standard" komplett durch 2 echte Varianten ersetzen.
  const tvKatalog = katalogById.get(APPLE_TV_ID);
  const tvAnkauf = ankaufById.get(APPLE_TV_ID);
  if (tvKatalog && tvAnkauf) {
    tvKatalog.varianten = APPLE_TV_NEUE_VARIANTEN.map((v) => ({ ...v }));
    tvAnkauf.varianten = APPLE_TV_NEUE_VARIANTEN.map((v) => {
      const berechnung = pricing.berechnePreise(tvKatalog, v, bestandListe);
      return { bezeichnung: v.bezeichnung, uvpDelta: v.uvpDelta, preise: berechnung.preise, preisQuelle: "auto" };
    });
    log.push(
      "ERSETZT " + tvKatalog.marke + " " + tvKatalog.modell + ": \"Standard\" -> " +
      APPLE_TV_NEUE_VARIANTEN.map((v) => v.bezeichnung).join(", ")
    );
  } else {
    log.push("FEHLER: " + APPLE_TV_ID + " (Apple TV 4K) nicht gefunden");
  }

  console.log("Speichervarianten-Korrektur" + (dryRun ? " (DRY-RUN - keine Datei geändert)" : ""));
  console.log("");
  log.forEach((zeile) => console.log("  " + zeile));

  if (dryRun) {
    console.log("\nDry-Run beendet: keine Datei geschrieben.");
    return;
  }

  const originale = new Map();
  function merkeOriginal(datei) {
    if (fs.existsSync(datei)) originale.set(datei, fs.readFileSync(datei, "utf8"));
  }
  [KATALOG_FILE, ANKAUF_FILE, ...KATEGORIEN.map((k) => path.join(SPLIT_DIR, k + ".json"))].forEach(merkeOriginal);

  backupIfChanged(KATALOG_FILE);
  fs.writeFileSync(KATALOG_FILE, JSON.stringify(katalog, null, 2) + "\n", "utf8");

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

  console.log("\nFertig. validate-data.js grün, " + Object.keys(KORREKTUREN).length + "+1 Geräte korrigiert.");
}

main();

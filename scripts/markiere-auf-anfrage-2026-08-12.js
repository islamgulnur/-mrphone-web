/**
 * Einmalige Umstellung: Geräte, für die auch Avatel keinen Festpreis nennt (Zustand
 * "Preisanfrage" auf verkaufen.avatel.de statt eines Betrags, oder gar nicht im Avatel-
 * Sortiment gefunden - siehe Avatel-Vollabgleich 11./12.08.2026, OFFENE-PUNKTE.md), laufen
 * im eigenen Ankaufsrechner künftig ebenfalls "Preis auf Anfrage" statt eines automatisch
 * berechneten (und nie gegen einen echten Vergleichswert geprüften) Betrags.
 *
 * Betrifft 96 Geräte: alle Kameras, alle Garmin-Uhren, iMac/generische Gaming-/Office-PCs,
 * generische Laptop-Klassen (Acer/Asus/Dell/HP/Lenovo) + MacBook M1/M2/M3 Pro/Max, Bose/Sony-
 * Kopfhörer + Galaxy Buds 2/2 Pro + JBL-Sammelposten, Huawei Watch GT4/5 + Apple Watch Ultra
 * (Original 2022), 3 ältere/seltene iPads, sowie Kleinzubehör (Pencils, HomePod, Ladegeräte,
 * Kabel/Hüllen).
 *
 * Setzt alle 5 Preisstufen auf null (Ankaufsrechner-UI zeigt dann "Preis auf Anfrage" statt
 * Zustandsauswahl, siehe ankauf-rechner.js hatKeinenPreis()/zeigeErgebnisAufAnfrage()) und
 * preisQuelle auf "manuell" (Notventil - wird von künftigen automatischen Preisläufen nicht
 * mehr angefasst, bis jemand händisch einen echten Preis einträgt).
 *
 * Ausführen:
 *   node scripts/markiere-auf-anfrage-2026-08-12.js --dry-run
 *   node scripts/markiere-auf-anfrage-2026-08-12.js
 */
const fs = require("fs");
const path = require("path");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");

const AUF_ANFRAGE_IDS = [
  // Kameras (18) - Avatel zeigt für Systemkameras/Action-Cams durchweg "Preisanfrage".
  "kat-0334", "kat-0336", "kat-0363", "kat-0352", "kat-0353", "kat-0354", "kat-0355",
  "kat-0356", "kat-0357", "kat-0358", "kat-0359", "kat-0360", "kat-0346", "kat-0347",
  "kat-0349", "kat-0364", "kat-0343", "kat-0345",
  // Konsolen (8) - Switch-Varianten + alle Controller ohne Festpreis (PS5 Pro kat-0372 bleibt).
  "kat-0378", "kat-0379", "kat-0380", "kat-0381", "kat-0386", "kat-0387", "kat-0388", "kat-0389",
  // Kopfhoerer (13) - Bose/Sony komplett "Preisanfrage", Buds 2/2 Pro + JBL nicht bei Avatel gefunden.
  "kat-0326", "kat-0327", "kat-0328", "kat-0329", "kat-0320", "kat-0321", "kat-0322",
  "kat-0323", "kat-0324", "kat-0325", "kat-0316", "kat-0317", "kat-0330",
  // Laptops (17) - MacBook M1/M2/M3 Pro/Max "Preisanfrage", generische Klassen nicht auffindbar
  // (keine echten Produktnamen). M4/M5-MacBooks (kat-0282/0286/0497) haben echte Avatel-Preise, bleiben.
  "kat-0278", "kat-0279", "kat-0280", "kat-0281", "kat-0283", "kat-0284", "kat-0285",
  "kat-0295", "kat-0296", "kat-0293", "kat-0294", "kat-0291", "kat-0292", "kat-0289",
  "kat-0290", "kat-0287", "kat-0288",
  // Monitore (5) - alle generisch, kein Avatel-Treffer.
  "kat-0304", "kat-0305", "kat-0306", "kat-0307", "kat-0308",
  // PCs (7) - iMac "Preisanfrage", Gaming-/Office-PC generisch ohne Avatel-Treffer.
  "kat-0301", "kat-0302", "kat-0303", "kat-0297", "kat-0298", "kat-0299", "kat-0300",
  // Smartwatches (10) - alle Garmin "Preisanfrage", Huawei GT4/5 + Apple Watch Ultra (2022) nicht gefunden.
  "kat-0261", "kat-0262", "kat-0263", "kat-0264", "kat-0265", "kat-0266", "kat-0267",
  "kat-0269", "kat-0270", "kat-0245",
  // Zubehoer (15) - Pencils/HomePod "Preisanfrage", Kleinteile (Ladegeräte/Kabel/Hüllen) bei
  // Avatel gar nicht im Ankaufssortiment.
  "kat-0487", "kat-0488", "kat-0489", "kat-0390", "kat-0391", "kat-0392", "kat-0393",
  "kat-0397", "kat-0398", "kat-0484", "kat-0485", "kat-0490", "kat-0491", "kat-0492", "kat-0486",
  // Tablets (3) - iPad mini 7 + iPad Pro 12.9" Gen 3/4 nicht bei Avatel gefunden.
  "kat-0197", "kat-0203", "kat-0204",
];

function ladeJson(datei) {
  return JSON.parse(fs.readFileSync(datei, "utf8"));
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ankauf = ladeJson(ANKAUF_FILE);
  const log = [];
  const betroffeneKategorien = new Set();
  let gefundeneVarianten = 0;

  AUF_ANFRAGE_IDS.forEach((id) => {
    const geraet = ankauf.find((g) => g.id === id);
    if (!geraet) { log.push("FEHLER: " + id + " nicht gefunden"); return; }
    betroffeneKategorien.add(geraet.kategorie);

    geraet.varianten.forEach((v) => {
      v.preise = { neuVersiegelt: null, wieNeu: null, sehrGut: null, gut: null, defekt: null };
      v.preisQuelle = "manuell";
      gefundeneVarianten++;
    });
    log.push("AUF ANFRAGE " + id + " " + geraet.marke + " " + geraet.modell + " (" + geraet.varianten.length + " Variante(n))");
  });

  console.log("Auf-Anfrage-Umstellung 12.08.2026" + (dryRun ? " (DRY-RUN)" : ""));
  console.log("");
  log.forEach((zeile) => console.log("  " + zeile));
  console.log("\nGeräte: " + AUF_ANFRAGE_IDS.length + ", Varianten: " + gefundeneVarianten);

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

  console.log("\nGeschrieben: " + ANKAUF_FILE + " + " + splitDateien.length + " Split-Dateien");
}

main();

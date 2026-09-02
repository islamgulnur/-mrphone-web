/**
 * Senkt bestehende AUTO-Ankaufspreise gezielt auf die zentrale Mindestmarge ab.
 * Manuelle Preise und alle nicht betroffenen Werte bleiben unveraendert.
 *
 *   node scripts/wende-vk-sicherheitsdeckel.js --dry-run
 *   node scripts/wende-vk-sicherheitsdeckel.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");
const { pruefeDeckelPayload, schluessel: deckelSchluessel, stufenDeckel } = require("./pos-ankaufdeckel");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const BESTAND_FILE = path.join(ROOT, "bestand.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const VALIDATE_SCRIPT = path.join(ROOT, "validate-data.js");
const POS_DECKEL_FILE = path.join(ROOT, ".pos-buyback-caps.json");
const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

const dryRun = process.argv.includes("--dry-run");

function ladeJson(datei) {
  return JSON.parse(fs.readFileSync(datei, "utf8"));
}

const katalog = ladeJson(KATALOG_FILE);
const katalogById = new Map(katalog.map((geraet) => [geraet.id, geraet]));
const ankaufRoh = ladeJson(ANKAUF_FILE);
const ankaufListe = ankaufRoh.filter((geraet) => geraet && geraet.id);
const bestand = ladeJson(BESTAND_FILE);
const posDeckelPayload = fs.existsSync(POS_DECKEL_FILE) ? pruefeDeckelPayload(ladeJson(POS_DECKEL_FILE)) : { daten: [] };
const posDeckelByKey = new Map(posDeckelPayload.daten.map((item) => [deckelSchluessel(item.marke, item.modell, item.speicher, item.zustand), item]));
const aenderungen = [];
const lernAenderungen = [];
let manuellUebersprungen = 0;
let katalogVarianteFehlt = 0;

ankaufListe.forEach((ankaufGeraet) => {
  const katalogGeraet = katalogById.get(ankaufGeraet.id);
  if (!katalogGeraet) return;

  (ankaufGeraet.varianten || []).forEach((ankaufVariante) => {
    if (ankaufVariante.preisQuelle === "manuell") {
      manuellUebersprungen++;
      return;
    }

    const katalogVariante = (katalogGeraet.varianten || []).find(
      (variante) => variante.bezeichnung === ankaufVariante.bezeichnung
    );
    if (!katalogVariante) {
      katalogVarianteFehlt++;
      return;
    }

    // Bestehende Online-Preise nur dann sofort senken, wenn ein exakt passender
    // eigener POS-Verkaufspreis vorliegt. Alte externe Marktanker werden bewusst
    // nicht pauschal ueber alle 873 Varianten neu angewendet.
    const eigenerNeu = pricing.findeEigenenVerkaufspreis(
      bestand, katalogGeraet, katalogVariante, "neu"
    );
    const eigenerGebraucht = pricing.findeEigenenVerkaufspreis(
      bestand, katalogGeraet, katalogVariante, "gebraucht"
    );
    const variantenAenderungen = pricing.wendeVkSicherheitsdeckelAn(
      ankaufVariante.preise,
      { neu: eigenerNeu, gebraucht: eigenerGebraucht },
      katalogGeraet.marke
    );
    variantenAenderungen.forEach((aenderung) => aenderungen.push({
      id: ankaufGeraet.id,
      kategorie: ankaufGeraet.kategorie,
      geraet: ankaufGeraet.marke + " " + ankaufGeraet.modell,
      variante: ankaufVariante.bezeichnung,
      ...aenderung,
    }));

    for (const zustand of ["neu", "gebraucht"]) {
      const signal = posDeckelByKey.get(deckelSchluessel(katalogGeraet.marke, katalogGeraet.modell, ankaufVariante.bezeichnung, zustand));
      if (!signal) continue;
      const deckelJeStufe = stufenDeckel(signal.maximaler_ankaufspreis, zustand);
      Object.entries(deckelJeStufe).forEach(([stufe, deckel]) => {
        const alt = Number(ankaufVariante.preise[stufe]);
        if (!Number.isFinite(alt) || alt <= deckel) return;
        ankaufVariante.preise[stufe] = deckel;
        lernAenderungen.push({
          id: ankaufGeraet.id,
          geraet: `${ankaufGeraet.marke} ${ankaufGeraet.modell}`,
          variante: ankaufVariante.bezeichnung,
          stufe,
          alt,
          neu: deckel,
        });
      });
    }
  });
});

console.log("VK-Sicherheitsdeckel" + (dryRun ? " (DRY-RUN)" : ""));
console.log("Preisfelder gesenkt:", aenderungen.length);
console.log("Durch anonymisierte POS-Lerngrenze gesenkt:", lernAenderungen.length);
console.log("Manuelle Varianten unveraendert:", manuellUebersprungen);
console.log("Fehlende Katalogvarianten:", katalogVarianteFehlt);
aenderungen.forEach((aenderung) => {
  console.log(
    "- " + aenderung.geraet + " / " + aenderung.variante + " / " + aenderung.stufe +
    ": " + aenderung.alt + " EUR -> " + aenderung.neu + " EUR" +
    " (eigener POS-VK " + aenderung.verkaufspreis + " EUR)"
  );
});

if (dryRun || (!aenderungen.length && !lernAenderungen.length)) {
  console.log(dryRun ? "Dry-Run beendet: keine Datei geschrieben." : "Keine Aenderung erforderlich.");
  process.exit(0);
}

const originale = new Map();
function merkeOriginal(datei) {
  if (fs.existsSync(datei)) originale.set(datei, fs.readFileSync(datei, "utf8"));
}

const splitDateien = KATEGORIEN.map((kategorie) => path.join(SPLIT_DIR, kategorie + ".json"));
[ANKAUF_FILE, ...splitDateien].forEach(merkeOriginal);

try {
  backupIfChanged(ANKAUF_FILE);
  fs.writeFileSync(ANKAUF_FILE, JSON.stringify(ankaufRoh, null, 2) + "\n", "utf8");

  KATEGORIEN.forEach((kategorie) => {
    const datei = path.join(SPLIT_DIR, kategorie + ".json");
    backupIfChanged(datei);
    const teilliste = ankaufListe.filter((geraet) => geraet.kategorie === kategorie);
    fs.writeFileSync(datei, JSON.stringify(teilliste), "utf8");
  });

  execFileSync(process.execPath, [VALIDATE_SCRIPT], { cwd: ROOT, stdio: "inherit" });
  console.log("Sicherheitsdeckel gespeichert und validiert.");
} catch (fehler) {
  originale.forEach((inhalt, datei) => fs.writeFileSync(datei, inhalt, "utf8"));
  console.error("Fehler: Aenderungen wurden zurueckgerollt.", fehler.message);
  process.exit(1);
}

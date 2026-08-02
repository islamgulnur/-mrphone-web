/**
 * Einmaliges Repair-Skript: behebt bestehende Speichergrößen-Inversionen in
 * ankauf-preise.json (kleinere Variante kaufte mehr als eine größere, siehe OFFENE-PUNKTE.md,
 * "NOCH OFFEN: 43 Modell/Varianten-Paare mit Speichergrößen-Inversion in den Gebraucht-Stufen").
 *
 * Nutzt dieselbe Regel wie der Live-Hook in scripts/update-ankaufspreise.js
 * (pricing.wendeSpeicherKonsistenzAn(), einzige Quelle dieser Logik - siehe pricing-config.js):
 * größere Variante (höheres uvpDelta) muss in jeder Zustandsstufe >= kleinerer sein, sonst wird
 * NUR die kleinere sofort in voller Höhe auf das Niveau der größeren gekappt (nie umgekehrt
 * angehoben). preisQuelle "manuell" wird komplett übersprungen (Notventil).
 *
 * Ausführen (zeigt nur, ändert nichts): node scripts/korrigiere-speicher-inversion.js
 * Anwenden (schreibt + Backup + validate-data.js):
 *   node scripts/korrigiere-speicher-inversion.js --apply
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

const apply = process.argv.includes("--apply");

const roh = JSON.parse(fs.readFileSync(ANKAUF_FILE, "utf8"));
const kommentar = roh.find((e) => e && e._kommentar);
const geraete = roh.filter((e) => e && e.id);

const aenderungenGesamt = [];
geraete.forEach((geraet) => {
  const aenderungen = pricing.wendeSpeicherKonsistenzAn(geraet.varianten);
  aenderungen.forEach((a) => aenderungenGesamt.push({ marke: geraet.marke, modell: geraet.modell, ...a }));
});

console.log(
  (apply ? "ANWENDEN" : "DRY-RUN (kein --apply, keine Datei geändert)") +
  ": " + aenderungenGesamt.length + " Kappung(en) über " +
  new Set(aenderungenGesamt.map((a) => a.marke + " " + a.modell)).size + " Gerät(e)\n"
);

aenderungenGesamt.forEach((a) => {
  console.log(
    "- " + a.marke + " " + a.modell + " (" + a.bezeichnung + "), " + a.stufe + ": " +
    a.alt + " € → " + a.neu + " €"
  );
});

if (!apply) {
  console.log("\nKein --apply gesetzt: nichts geschrieben. Erneut mit --apply aufrufen, um zu übernehmen.");
  process.exit(0);
}

if (!aenderungenGesamt.length) {
  console.log("\nNichts zu tun, keine Datei geändert.");
  process.exit(0);
}

backupIfChanged(ANKAUF_FILE);
fs.writeFileSync(
  ANKAUF_FILE,
  JSON.stringify([kommentar, ...geraete], null, 2) + "\n",
  "utf8"
);

fs.mkdirSync(SPLIT_DIR, { recursive: true });
KATEGORIEN.forEach((k) => {
  const teilliste = geraete.filter((g) => g.kategorie === k);
  const zielpfad = path.join(SPLIT_DIR, k + ".json");
  backupIfChanged(zielpfad);
  fs.writeFileSync(zielpfad, JSON.stringify(teilliste), "utf8");
});

console.log("\nankauf-preise.json + ankauf/*.json geschrieben.");

console.log("\nvalidate-data.js:");
try {
  execFileSync("node", [path.join(ROOT, "validate-data.js")], { stdio: "inherit", cwd: ROOT });
  console.log("validate-data.js: OK");
} catch (e) {
  console.error("validate-data.js ist fehlgeschlagen (Exit-Code " + e.status + ") - bitte prüfen, nicht committen.");
  process.exit(1);
}

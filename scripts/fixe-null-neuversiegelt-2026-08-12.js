/**
 * Einmalige Korrektur: 50 "auto"-Varianten hatten preise.neuVersiegelt: null, obwohl die
 * anderen 4 Zustandsstufen normal befüllt waren (gefunden beim Avatel-Vollabgleich, siehe
 * OFFENE-PUNKTE.md, 12.08.2026). Root Cause verifiziert: berechneNeuVersiegelt() in
 * pricing-config.js gibt nur dann null zurück, wenn WEDER ein eigener Verkaufspreis (aus
 * bestand.json) NOCH ein Marktanker vorliegt - der Marktanker (marktAnkerNeuSchaetzung in
 * ermittleWiederverkaufswerte()) fällt aber inzwischen IMMER auf marktwertGebraucht ×
 * NEUWARE_AUFSCHLAG zurück, sobald kein echter marktwertNeu vorhanden ist, und ist damit fast
 * nie mehr null. Die gespeicherten null-Werte sind also stehengebliebene Altdaten von VOR
 * Einführung dieses Fallbacks (Preisänderungen wirken laut CLAUDE.md/pricing-config.js
 * grundsätzlich nicht rückwirkend, siehe Kommentar dort) - kein aktueller Code-Bug, sondern nie
 * nachgezogene alte Berechnungen. Test: pricing.berechnePreise() frisch auf kat-0200 256GB
 * (eine der 50 Varianten) liefert bereits regulär neuVersiegelt=430€ statt null.
 *
 * Betrifft NICHT die 96 Geräte aus scripts/markiere-auf-anfrage-2026-08-12.js (dort sind
 * bewusst ALLE 5 Stufen null - anderer, gewollter Zustand "Preis auf Anfrage").
 *
 * Rechnet für jede betroffene Variante alle 5 Stufen einheitlich über pricing.berechnePreise()
 * neu (nicht nur neuVersiegelt einzeln, für volle interne Konsistenz), preisQuelle bleibt "auto"
 * (kein manueller Eingriff, reine Neuberechnung mit der bereits produktiv laufenden Formel).
 * Wendet anschließend pro Gerät die Speicherstufen-Konsistenzprüfung an, damit die frisch
 * berechnete Variante nicht mit unveränderten Geschwister-Varianten kollidiert.
 *
 * Ausführen:
 *   node scripts/fixe-null-neuversiegelt-2026-08-12.js --dry-run
 *   node scripts/fixe-null-neuversiegelt-2026-08-12.js
 */
const fs = require("fs");
const path = require("path");

const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_FILE = path.join(ROOT, "ankauf-preise.json");
const BESTAND_FILE = path.join(ROOT, "bestand.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const ZUSTANDS_FELDER = ["neuVersiegelt", "wieNeu", "sehrGut", "gut", "defekt"];

function ladeJson(datei, fallback) {
  if (!fs.existsSync(datei)) return fallback;
  const inhalt = fs.readFileSync(datei, "utf8");
  return inhalt.trim() ? JSON.parse(inhalt) : fallback;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const katalog = ladeJson(KATALOG_FILE, []);
  const katalogById = new Map(katalog.map((g) => [g.id, g]));
  const ankauf = ladeJson(ANKAUF_FILE, []).filter((d) => d && d.id);
  const bestandListe = ladeJson(BESTAND_FILE, []);

  const log = [];
  const betroffeneKategorien = new Set();
  const betroffeneGeraete = new Set();

  ankauf.forEach((geraet) => {
    const gk = katalogById.get(geraet.id);
    if (!gk) return;

    geraet.varianten.forEach((v) => {
      if (v.preisQuelle !== "auto") return; // manuell gesetzte Preise nie anfassen
      const alleNull = ZUSTANDS_FELDER.every((f) => v.preise[f] === null);
      if (alleNull) return; // bewusst "Preis auf Anfrage" (siehe markiere-auf-anfrage-Skript), nicht anfassen
      if (v.preise.neuVersiegelt !== null) return; // schon in Ordnung

      const gkVariante = gk.varianten.find((x) => x.bezeichnung === v.bezeichnung);
      if (!gkVariante) { log.push("FEHLER: " + geraet.id + " Variante " + v.bezeichnung + " nicht im Katalog gefunden"); return; }

      const berechnung = pricing.berechnePreise(gk, gkVariante, bestandListe);
      const alt = v.preise.neuVersiegelt;
      v.preise = berechnung.preise;

      betroffeneKategorien.add(geraet.kategorie);
      betroffeneGeraete.add(geraet.id);
      log.push(
        "FIX " + geraet.id + " " + geraet.marke + " " + geraet.modell + " (" + v.bezeichnung + "): " +
        "neuVersiegelt " + alt + "->" + berechnung.preise.neuVersiegelt + "€"
      );
    });
  });

  // Speicherstufen-Konsistenz je betroffenem Gerät neu prüfen (frisch berechnete Variante
  // gegen unveränderte Geschwister-Varianten desselben Geräts).
  betroffeneGeraete.forEach((id) => {
    const geraet = ankauf.find((g) => g.id === id);
    const aenderungen = pricing.wendeSpeicherKonsistenzAn(geraet.varianten);
    aenderungen.forEach((a) => {
      log.push("  KONSISTENZ-KORREKTUR " + id + " (" + a.bezeichnung + ", " + a.stufe + "): " + a.alt + "->" + a.neu);
    });
  });

  console.log("Null-neuVersiegelt-Fix 12.08.2026" + (dryRun ? " (DRY-RUN)" : ""));
  console.log("");
  log.forEach((zeile) => console.log("  " + zeile));
  console.log("\nBetroffene Varianten: " + log.filter((l) => l.startsWith("FIX")).length);

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

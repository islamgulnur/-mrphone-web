/**
 * Einmaliges Befüll-Skript: ergänzt geraete-katalog.json um die Felder
 * marktwertGebraucht (geschätzter aktueller Gebraucht-Verkaufspreis im Zustand "Sehr gut")
 * und marktwertQuelle ("geschaetzt" | "recherchiert" | "manuell").
 *
 * Ausführen: node scripts/befuelle-marktwert.js
 *
 * Sicherheit: überschreibt NIE ein bereits vorhandenes marktwertGebraucht (idempotent,
 * beliebig oft wiederholbar). Fasst keine anderen Felder an. /preise-update setzt
 * marktwertQuelle:"recherchiert" für die Top-30, der Admin kann marktwertQuelle:"manuell"
 * setzen (beides bleibt von diesem Skript danach unberührt).
 *
 * Startwert je Gerät = uvp × altersfaktor(jahr) × markenfaktor(marke, modell) – dieselben
 * Kurven, mit denen pricing-config.js bisher den "Marktwert" intern berechnet hat. Das ist
 * eine begründete Ausgangsschätzung (Marktwert-Erhalt über Zeit je Marke), keine Zufallszahl,
 * ersetzt aber keine echte Recherche. MANUELLE_KORREKTUREN unten überschreibt einzelne
 * Modelle, bei denen die reine Alterskurve erkennbar daneben liegt (z. B. aktuelle
 * Flaggschiffe, die den Wert besser halten als die Kurve unterstellt).
 */
const fs = require("fs");
const path = require("path");
const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATALOG_FILE = path.join(ROOT, "geraete-katalog.json");

// id -> manueller Korrekturwert (EUR), wo die Alterskurve allein erkennbar daneben liegt.
const MANUELLE_KORREKTUREN = {};

const katalog = JSON.parse(fs.readFileSync(KATALOG_FILE, "utf8"));

let neuBefuellt = 0;
const ergebnis = katalog.map((geraet) => {
  if (geraet.marktwertGebraucht != null) return geraet; // bereits befüllt (recherchiert/manuell/geschaetzt) -> nicht anfassen

  const basiswert = pricing.marktwert(geraet.uvp, geraet.jahr, geraet.marke, geraet.modell);
  const wert = MANUELLE_KORREKTUREN[geraet.id] != null
    ? MANUELLE_KORREKTUREN[geraet.id]
    : pricing.rundeAuf5(basiswert);

  neuBefuellt++;
  return { ...geraet, marktwertGebraucht: wert, marktwertQuelle: "geschaetzt" };
});

if (neuBefuellt > 0) {
  backupIfChanged(KATALOG_FILE);
  fs.writeFileSync(KATALOG_FILE, JSON.stringify(ergebnis, null, 2) + "\n", "utf8");
}

console.log("marktwertGebraucht neu befüllt:", neuBefuellt, "von", katalog.length, "Geräten.");
console.log("(bereits vorhanden/unverändert:", katalog.length - neuBefuellt, ")");

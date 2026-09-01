/**
 * Einmalige, verlustfreie Datenmigration für die interne Zustandsstufe "schlecht".
 * Bestehende Geräte, Varianten, Preise und preisQuelle-Werte bleiben unverändert.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const pricing = require("../pricing-config");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const MASTER = path.join(ROOT, "ankauf-preise.json");
const SPLIT_DIR = path.join(ROOT, "ankauf");
const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

function migrierePreise(preise) {
  if (!preise || typeof preise !== "object") return preise;
  const alleNull = ["neuVersiegelt", "wieNeu", "sehrGut", "gut", "defekt"]
    .every((feld) => preise[feld] === null);
  return {
    neuVersiegelt: preise.neuVersiegelt,
    wieNeu: preise.wieNeu,
    sehrGut: preise.sehrGut,
    gut: preise.gut,
    schlecht: alleNull ? null : pricing.berechneSchlechtAusGut(preise.gut, preise.defekt),
    defekt: preise.defekt,
  };
}

function migriereGeraete(liste) {
  return liste.map((geraet) => {
    if (!geraet || !geraet.id || !Array.isArray(geraet.varianten)) return geraet;
    return {
      ...geraet,
      varianten: geraet.varianten.map((variante) => ({
        ...variante,
        preise: migrierePreise(variante.preise),
      })),
    };
  });
}

const bisher = JSON.parse(fs.readFileSync(MASTER, "utf8"));
const vorherGeraete = bisher.filter((eintrag) => eintrag && eintrag.id);
const vorherVarianten = vorherGeraete.reduce((summe, geraet) => summe + geraet.varianten.length, 0);
const migriert = migriereGeraete(bisher);
const nachherGeraete = migriert.filter((eintrag) => eintrag && eintrag.id);
const nachherVarianten = nachherGeraete.reduce((summe, geraet) => summe + geraet.varianten.length, 0);

if (vorherGeraete.length !== nachherGeraete.length || vorherVarianten !== nachherVarianten) {
  throw new Error("Sicherheitsabbruch: Anzahl Geräte oder Varianten hat sich verändert.");
}

backupIfChanged(MASTER);
fs.writeFileSync(MASTER, JSON.stringify(migriert, null, 2) + "\n", "utf8");

for (const kategorie of KATEGORIEN) {
  const datei = path.join(SPLIT_DIR, kategorie + ".json");
  backupIfChanged(datei);
  fs.writeFileSync(
    datei,
    JSON.stringify(nachherGeraete.filter((geraet) => geraet.kategorie === kategorie)),
    "utf8"
  );
}

console.log(
  "Zustand schlecht ergänzt:",
  nachherGeraete.length,
  "Geräte,",
  nachherVarianten,
  "Varianten; keine bestehende Preisstufe verändert."
);

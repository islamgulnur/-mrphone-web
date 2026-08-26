#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BESTAND = path.join(ROOT, "bestand.json");
const SNAPSHOT = path.join(ROOT, ".pos-stock-snapshot.json");
const APPLY = process.argv.includes("--apply");

function sauber(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function speicherFormat(value) {
  return sauber(value).replace(/(\d+)\s*(TB|GB)/gi, "$1 $2");
}

function normalisiert(value) {
  return sauber(value).toLocaleLowerCase("de-DE");
}

function mappePosGeraet(pos) {
  let marke = sauber(pos.marke);
  let modell = sauber(pos.modell);

  if (/^samsung galaxy$/i.test(marke)) marke = "Samsung";
  if (/^xiaomi redmi$/i.test(marke)) {
    marke = "Xiaomi";
    if (!/^redmi\b/i.test(modell)) modell = `Redmi ${modell}`;
  }
  if (/^samsung$/i.test(marke) && !/^(galaxy|watch)/i.test(modell)) {
    modell = /^flip\b/i.test(modell) ? `Galaxy Z ${modell}` : `Galaxy ${modell}`;
  }

  const erlaubteKategorien = new Set(["smartphones", "tablets", "smartwatches", "laptops", "konsolen", "kopfhoerer"]);
  let kategorie = erlaubteKategorien.has(pos.kategorie) ? pos.kategorie : "smartphones";
  if (!erlaubteKategorien.has(pos.kategorie)) {
    if (/\b(iPad|Tab)\b/i.test(modell)) kategorie = "tablets";
    else if (/MacBook|ThinkPad|Pro 14 Plus/i.test(modell)) kategorie = "laptops";
    else if (/Watch/i.test(modell)) kategorie = "smartwatches";
  }

  return {
    marke,
    modell,
    speicher: speicherFormat(pos.speicher),
    farbe: "",
    kategorie,
    zustand: normalisiert(pos.zustand),
    preis: Number(pos.preis),
    menge: Number(pos.menge) || 1,
  };
}

function schluessel(geraet) {
  return [
    normalisiert(geraet.marke),
    normalisiert(geraet.modell),
    normalisiert(speicherFormat(geraet.speicher)),
    normalisiert(geraet.zustand),
    Number(geraet.preis),
  ].join("|");
}

function stabileId(key) {
  return `pos-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

const alt = JSON.parse(fs.readFileSync(BESTAND, "utf8"));
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
if (!Array.isArray(snapshot.daten) || snapshot.daten.length === 0) {
  throw new Error("POS-Snapshot ist leer oder ungueltig; Bestand bleibt unveraendert.");
}

const ohnePreis = snapshot.daten.filter((item) => !(Number(item.preis) > 0));
const gruppen = new Map();
for (const pos of snapshot.daten.filter((item) => Number(item.preis) > 0).map(mappePosGeraet)) {
  const key = schluessel(pos);
  const vorhanden = gruppen.get(key);
  if (vorhanden) vorhanden.menge += pos.menge;
  else gruppen.set(key, { ...pos });
}

const alteNachKey = new Map(alt.map((item) => [schluessel(item), item]));
const datum = new Date().toISOString().slice(0, 10);
const neu = [...gruppen.entries()].map(([key, item]) => {
  const vorher = alteNachKey.get(key);
  return {
    id: vorher?.id || stabileId(key),
    ...item,
    bild: vorher?.bild || "",
    aktiv: true,
    datum,
  };
});

const kategorieReihenfolge = ["smartphones", "tablets", "smartwatches", "laptops"];
neu.sort((a, b) =>
  kategorieReihenfolge.indexOf(a.kategorie) - kategorieReihenfolge.indexOf(b.kategorie) ||
  a.marke.localeCompare(b.marke, "de") ||
  a.modell.localeCompare(b.modell, "de", { numeric: true }) ||
  a.speicher.localeCompare(b.speicher, "de", { numeric: true }) ||
  a.zustand.localeCompare(b.zustand, "de") ||
  a.preis - b.preis
);

const alteKeys = new Set(alt.map(schluessel));
const neueKeys = new Set(neu.map(schluessel));
const hinzugefuegt = neu.filter((item) => !alteKeys.has(schluessel(item))).length;
const entfernt = alt.filter((item) => !neueKeys.has(schluessel(item))).length;
const physisch = neu.reduce((summe, item) => summe + item.menge, 0);

console.log(`POS-Einzelgeraete: ${snapshot.einzelgeraete}`);
console.log(`Website-Eintraege vorher/nachher: ${alt.length}/${neu.length}`);
console.log(`Oeffentlich beruecksichtigte Geraete: ${physisch}`);
console.log(`Ohne positiven VK ausgelassen: ${ohnePreis.reduce((summe, item) => summe + item.menge, 0)}`);
console.log(`Hinzugefuegt: ${hinzugefuegt}; entfernt: ${entfernt}`);

if (!APPLY) {
  console.log("Dry-Run: bestand.json wurde nicht geaendert.");
  process.exit(0);
}

const backup = spawnSync(process.execPath, [path.join(__dirname, "backup-data.js"), "bestand.json"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (backup.status !== 0) throw new Error("Backup von bestand.json fehlgeschlagen.");

fs.writeFileSync(BESTAND, `${JSON.stringify(neu, null, 2)}\n`, "utf8");

function fuehreSkriptAus(datei, args = []) {
  const ergebnis = spawnSync(process.execPath, [path.join(ROOT, datei), ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (ergebnis.status !== 0) throw new Error(`${datei} ist fehlgeschlagen.`);
}

try {
  fuehreSkriptAus("validate-data.js");
  fuehreSkriptAus(path.join("scripts", "build-produktseiten.js"));
  fuehreSkriptAus(path.join("scripts", "test-produktseiten.js"));
  console.log("bestand.json und die zugehörigen Google-Produktseiten wurden aktualisiert.");
} catch (error) {
  fs.writeFileSync(BESTAND, `${JSON.stringify(alt, null, 2)}\n`, "utf8");
  try { fuehreSkriptAus(path.join("scripts", "build-produktseiten.js")); } catch (_) { /* ursprünglichen Fehler bewahren */ }
  throw new Error(`POS-Synchronisierung zurückgerollt: ${error.message}`);
}

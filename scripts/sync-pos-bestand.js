#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BESTAND = path.join(ROOT, "bestand.json");
const SNAPSHOT = path.join(ROOT, ".pos-stock-snapshot.json");
const ANKAUF = path.join(ROOT, "ankauf-preise.json");
const ANKAUF_SPLIT = ["smartphones", "tablets", "smartwatches", "laptops", "pcs", "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer"]
  .map((kategorie) => path.join(ROOT, "ankauf", `${kategorie}.json`));
const APPLY = process.argv.includes("--apply");

function sauber(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function speicherFormat(value) {
  return sauber(value).replace(/(\d+)\s*(TB|GB)/gi, (_, zahl, einheit) => `${zahl} ${einheit.toUpperCase()}`);
}

function normalisiereMarke(value) {
  const marke = sauber(value);
  if (/^ray[ -]?ban$/i.test(marke)) return "Ray-Ban";
  return marke;
}

function normalisiereModell(value) {
  return sauber(value)
    .replace(/\bPro\s+max\b/gi, "Pro Max")
    .replace(/\bPro\s+mini\b/gi, "Pro Mini");
}

function normalisiert(value) {
  return sauber(value).toLocaleLowerCase("de-DE");
}

function sichereProduktbildUrl(value) {
  const eingabe = sauber(value);
  if (!eingabe) return "";
  try {
    const url = new URL(eingabe);
    const freigegeben =
      url.protocol === "https:" &&
      /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) &&
      url.pathname.startsWith("/storage/v1/object/public/produktbilder/");
    return freigegeben ? url.toString() : "";
  } catch {
    return "";
  }
}

function mappePosGeraet(pos) {
  let marke = normalisiereMarke(pos.marke);
  let modell = normalisiereModell(pos.modell);

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
    farbe: sauber(pos.farbe),
    kategorie,
    zustand: normalisiert(pos.zustand),
    preis: Number(pos.preis),
    menge: Number(pos.menge) || 1,
    bild: sichereProduktbildUrl(pos.bild),
  };
}

function schluessel(geraet) {
  return [
    normalisiert(geraet.marke),
    normalisiert(geraet.modell),
    normalisiert(speicherFormat(geraet.speicher)),
    normalisiert(geraet.farbe),
    normalisiert(geraet.zustand),
    Number(geraet.preis),
  ].join("|");
}

function stabileId(key) {
  return `pos-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

const originalDateien = new Map([BESTAND, ANKAUF, ...ANKAUF_SPLIT].map((datei) => [datei, fs.readFileSync(datei, "utf8")]));
const alt = JSON.parse(originalDateien.get(BESTAND));
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
    bild: item.bild || vorher?.bild || "",
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
  fuehreSkriptAus(path.join("scripts", "wende-vk-sicherheitsdeckel.js"));
  fuehreSkriptAus("validate-data.js");
  fuehreSkriptAus(path.join("scripts", "build-produktseiten.js"));
  fuehreSkriptAus(path.join("scripts", "test-produktseiten.js"));
  console.log("bestand.json und die zugehörigen Google-Produktseiten wurden aktualisiert.");
} catch (error) {
  originalDateien.forEach((inhalt, datei) => fs.writeFileSync(datei, inhalt, "utf8"));
  try { fuehreSkriptAus(path.join("scripts", "build-produktseiten.js")); } catch (_) { /* ursprünglichen Fehler bewahren */ }
  throw new Error(`POS-Synchronisierung zurückgerollt: ${error.message}`);
}

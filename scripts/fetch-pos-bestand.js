#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT = path.join(ROOT, ".pos-stock-snapshot.json");
const POS_URL = process.env.POS_BESTAND_URL || "https://pos.mrphone-frankfurt.de/api/public/bestand";
const TIMEOUT_MS = 15000;

function pruefeSnapshot(payload) {
  if (!payload || payload.ok !== true || !Array.isArray(payload.daten)) {
    throw new Error("POS-Antwort hat nicht das erwartete Format.");
  }
  if (payload.daten.length === 0 || !(Number(payload.einzelgeraete) > 0)) {
    throw new Error("POS meldet einen leeren Bestand; bestehende Website-Daten bleiben zum Schutz unverändert.");
  }
  for (const item of payload.daten) {
    if (!item.marke || !item.modell || !(Number(item.preis) > 0) || !(Number(item.menge) > 0)) {
      throw new Error("POS-Antwort enthält einen unvollständigen Bestandseintrag.");
    }
  }
  return payload;
}

async function holeSnapshot(fetchFn = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const antwort = await fetchFn(POS_URL, {
      headers: { Accept: "application/json", "User-Agent": "MrPhone-Website-Sync/1.0" },
      signal: controller.signal,
    });
    if (!antwort.ok) throw new Error(`POS-Bestand nicht erreichbar: HTTP ${antwort.status}`);
    return pruefeSnapshot(await antwort.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const snapshot = await holeSnapshot();
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`${snapshot.einzelgeraete} POS-Geräte sicher für den Website-Abgleich geladen.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.name === "AbortError" ? "POS-Abfrage hat das Zeitlimit überschritten." : error.message);
    process.exit(1);
  });
}

module.exports = { holeSnapshot, pruefeSnapshot };

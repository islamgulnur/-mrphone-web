#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { pruefeSnapshot } = require("./fetch-pos-bestand");
const { pruefeDeckelPayload, schluessel, stufenDeckel } = require("./pos-ankaufdeckel");

const gueltig = {
  ok: true,
  einzelgeraete: 2,
  daten: [{ marke: "Apple", modell: "iPhone 15", preis: 599.99, menge: 2 }],
};
assert.strictEqual(pruefeSnapshot(gueltig), gueltig);
assert.throws(() => pruefeSnapshot({ ok: true, einzelgeraete: 0, daten: [] }), /leeren Bestand/);
assert.throws(() => pruefeSnapshot({ ok: true, einzelgeraete: 1, daten: [{ marke: "Apple", modell: "", preis: 1, menge: 1 }] }), /unvollständigen/);
assert.throws(() => pruefeSnapshot({ ok: false, daten: [] }), /erwartete Format/);

const deckel = { ok: true, daten: [{ marke: "Apple", modell: "iPhone 15", speicher: "128GB", zustand: "gebraucht", maximaler_ankaufspreis: 500 }] };
assert.strictEqual(pruefeDeckelPayload(deckel), deckel);
assert.strictEqual(schluessel("Apple", "iPhone 15", "128GB", "gebraucht"), schluessel("apple", "iPhone 15", "128 GB", "gebraucht"));
assert.deepStrictEqual(stufenDeckel(503, "gebraucht"), { wieNeu: 500, sehrGut: 475, gut: 425, schlecht: 350, defekt: 175 });
assert.throws(() => pruefeDeckelPayload({ ok: true, daten: [{ marke: "Apple", modell: "", zustand: "neu", maximaler_ankaufspreis: 1 }] }), /unvollständigen/);

console.log("POS-Bestandsschnittstelle: Format- und Leerdatenschutz erfolgreich geprüft.");

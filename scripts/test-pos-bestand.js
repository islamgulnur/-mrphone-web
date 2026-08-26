#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { pruefeSnapshot } = require("./fetch-pos-bestand");

const gueltig = {
  ok: true,
  einzelgeraete: 2,
  daten: [{ marke: "Apple", modell: "iPhone 15", preis: 599.99, menge: 2 }],
};
assert.strictEqual(pruefeSnapshot(gueltig), gueltig);
assert.throws(() => pruefeSnapshot({ ok: true, einzelgeraete: 0, daten: [] }), /leeren Bestand/);
assert.throws(() => pruefeSnapshot({ ok: true, einzelgeraete: 1, daten: [{ marke: "Apple", modell: "", preis: 1, menge: 1 }] }), /unvollständigen/);
assert.throws(() => pruefeSnapshot({ ok: false, daten: [] }), /erwartete Format/);

console.log("POS-Bestandsschnittstelle: Format- und Leerdatenschutz erfolgreich geprüft.");

"use strict";

const assert = require("assert");
const {
  angebotSpeichern,
  angebotAktivSetzen,
  angebotLoeschen,
  bewertungenNormalisieren,
  reparaturenNormalisieren,
  ankaufGeraetAktualisieren,
  preisniveauNormalisieren,
} = require("./cloud-admin-command");

const angebot = angebotSpeichern([], {
  angebot: {
    modell: "iPhone 17",
    preis: "999",
    aktiv: true,
    zustand: "neu",
    bild: "https://abc123.supabase.co/storage/v1/object/public/produktbilder/angebote/test.jpg",
  },
});
assert.equal(angebot.daten.length, 1);
assert.equal(angebot.ergebnis.preis, 999);
assert.equal(angebot.ergebnis.zustand, "neu");
assert.match(angebot.ergebnis.bild, /supabase\.co/);
assert.equal(angebotSpeichern([], { angebot: { modell: "Test", bild: "https://example.com/falsch.jpg" } }).ergebnis.bild, "");

const deaktiviert = angebotAktivSetzen(angebot.daten, { id: angebot.ergebnis.id, aktiv: false });
assert.equal(deaktiviert.ergebnis.aktiv, false);
assert.equal(angebotLoeschen(deaktiviert.daten, { id: angebot.ergebnis.id }).daten.length, 0);

const bewertungen = bewertungenNormalisieren({
  bewertungen: { gesamtnote: 7, anzahlBewertungen: "12", zitate: [{ text: " Echt ", name: " Kundin ", sterne: 9 }] },
});
assert.equal(bewertungen.gesamtnote, 5);
assert.deepEqual(bewertungen.zitate[0], { text: "Echt", name: "Kundin", sterne: 5 });

const reparaturen = reparaturenNormalisieren(
  { reparaturen: [{ name: "Display", abPreis: "79" }] },
  { reparaturen: [{ name: "Display", nameEn: "Display", abPreis: 69 }] }
);
assert.equal(reparaturen.reparaturen[0].nameEn, "Display");
assert.equal(reparaturen.reparaturen[0].abPreis, 79);

const kommentar = { _kommentar: "behalten" };
const geraet = {
  id: "kat-1",
  kategorie: "smartphones",
  beliebt: false,
  varianten: [
    { bezeichnung: "128 GB", uvpDelta: 0, preisQuelle: "auto", preise: { neuVersiegelt: 1, wieNeu: 1, sehrGut: 1, gut: 1, schlecht: 1, defekt: 1 } },
  ],
};
const ankauf = ankaufGeraetAktualisieren([kommentar, geraet], {
  id: "kat-1",
  beliebt: true,
  varianten: [{ bezeichnung: "128 GB", preise: { neuVersiegelt: 500, wieNeu: 400, sehrGut: 300, gut: 200, defekt: 100 } }],
});
assert.equal(ankauf.daten[0]._kommentar, "behalten");
assert.equal(ankauf.ergebnis.varianten[0].preisQuelle, "manuell");
assert.equal(ankauf.ergebnis.varianten[0].preise.gut, 200);
assert.equal(ankauf.ergebnis.varianten[0].preise.schlecht, 150);
assert.throws(() => ankaufGeraetAktualisieren([geraet], { id: "kat-1", varianten: [] }), /weder ergänzt noch entfernt/);

assert.deepEqual(preisniveauNormalisieren({ prozent: 99 }), { prozent: 15 });
assert.deepEqual(preisniveauNormalisieren({ prozent: -99 }), { prozent: -15 });

console.log("Cloud-Admin-Tests: OK");

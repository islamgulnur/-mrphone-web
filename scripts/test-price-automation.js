const assert = require("assert");
const config = require("./ankaufspreis-config");
const pricing = require("../pricing-config");
const competitor = require("./lib/competitor-client");

async function test() {
  assert.strictEqual(config.wettbewerbsZiel(200), 185);
  assert.strictEqual(config.wettbewerbsZiel(430), 405);
  assert.strictEqual(config.wettbewerbsZiel(710), 670);
  assert.strictEqual(config.wettbewerbsZiel(1000), 950);
  assert.strictEqual(config.wettbewerbsZiel(1500), 1440);

  const geraet = { marke: "Apple", modell: "iPhone 17 Pro" };
  const variante = { bezeichnung: "256 GB" };
  assert(competitor.passtExakt("Apple iPhone 17 Pro 256GB", geraet, variante));
  assert(!competitor.passtExakt("Apple iPhone 17 Pro 512GB", geraet, variante));
  assert(!competitor.passtExakt("Apple iPhone 17 256GB", geraet, variante));
  assert(!competitor.passtExakt("Apple iPhone 17e 256GB", { marke: "Apple", modell: "iPhone 17" }, variante));

  const searchHtml = '<a href="/apple-iphone-17-pro-256gb" title="Apple iPhone 17 Pro 256GB">Produkt</a>';
  const produktHtml = '<h1>Apple iPhone 17 Pro 256GB</h1><p>ARTIKELZUSTAND NEU:</p><h4>UNSER PREISANGEBOT:</h4><span>1.000,00€</span>';
  const antworten = new Map([
    ["search", searchHtml],
    ["produkt", produktHtml],
  ]);
  const fetchFn = async (url) => ({
    ok: true,
    text: async () => url.includes("route=product/search") ? antworten.get("search") : antworten.get("produkt"),
  });
  const avatel = await competitor.holeAvatelNeu({ geraet, variante, fetchFn });
  assert.strictEqual(avatel.status, "ok");
  assert.strictEqual(avatel.preis, 1000);

  const ohneWettbewerb = pricing.berechneNeuVersiegeltUvpBasiert({
    eigenerVK: null,
    marktAnkerNeuEcht: 1300,
    marktAnkerNeu: 1300,
    marktAnkerNeuUrsprung: "echt",
    uvpVariante: 1500,
    marke: "Apple",
    niveauFaktor: 1,
  });
  const mitWettbewerb = pricing.berechneNeuVersiegeltUvpBasiert({
    eigenerVK: null,
    marktAnkerNeuEcht: 1300,
    marktAnkerNeu: 1300,
    marktAnkerNeuUrsprung: "echt",
    uvpVariante: 1500,
    marke: "Apple",
    niveauFaktor: 1,
    wettbewerbsZiel: 950,
  });
  assert.strictEqual(ohneWettbewerb, 1065);
  assert.strictEqual(mitWettbewerb, 950);

  console.log("Preisautomatik-Tests erfolgreich.");
}

test().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});

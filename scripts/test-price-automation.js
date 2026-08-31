const assert = require("assert");
const config = require("./ankaufspreis-config");
const pricing = require("../pricing-config");
const competitor = require("./lib/competitor-client");
const ebay = require("./lib/ebay-client");
const rebuy = require("./lib/rebuy-client");

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

  assert.strictEqual(pricing.prozentsaetzeFuerGeraet({ marke: "Apple", modell: "AirPods Max 2", kategorie: "kopfhoerer" }).wieNeu, 0.50);
  assert.strictEqual(pricing.prozentsaetzeFuerGeraet({ marke: "Apple", modell: "iPhone 17 Pro Max", kategorie: "smartphones" }).wieNeu, 0.84);
  assert.strictEqual(pricing.berechneGebrauchtAusNeu(930, "Apple", 1012).wieNeu, 850);

  const rebuyGeraet = { marke: "Apple", modell: "iPhone 17 Pro Max" };
  const rebuyHtml = [1124.99, 1152.99].map((preis, index) => `
    <ry-product>
      <span data-cy="product-price">${preis.toFixed(2).replace(".", ",")}&nbsp;€</span>
      <a data-cy="product-link" href="/i,${index}" title="Apple iPhone 17 Pro Max 256GB ${index ? "silber" : "orange"}">Produkt</a>
    </ry-product>`).join("");
  const rebuyErgebnis = rebuy.leseRebuySuchergebnis(rebuyHtml, rebuyGeraet, { bezeichnung: "256 GB" });
  assert.strictEqual(rebuyErgebnis.treffer.length, 2);
  assert.strictEqual(rebuyErgebnis.preis, 1138.99);
  assert(!rebuy.passtRebuyTitel("Apple AirPods Max 2 mitternacht", { marke: "Apple", modell: "AirPods Max" }, { bezeichnung: "Standard" }));

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

  assert.strictEqual(pricing.berechneVkSicherheitsdeckel(1000, "neuVersiegelt", "Apple"), 880);
  assert.strictEqual(pricing.berechneVkSicherheitsdeckel(100, "neuVersiegelt", "Apple"), 85);
  assert.strictEqual(pricing.berechneVkSicherheitsdeckel(230, "wieNeu", "Samsung"), 170);
  assert.strictEqual(pricing.berechneVkSicherheitsdeckel(230, "sehrGut", "Samsung"), 155);
  assert.strictEqual(pricing.berechneVkSicherheitsdeckel(230, "sehrGut", "Apple"), 170);
  assert.strictEqual(pricing.berechneVkSicherheitsdeckel(1000, "wieNeu", { marke: "Apple", modell: "iPhone 17 Pro Max", kategorie: "smartphones" }), 840);

  const unsicherePreise = { neuVersiegelt: 950, wieNeu: 220, sehrGut: 210, gut: 200, defekt: 100 };
  const deckelAenderungen = pricing.wendeVkSicherheitsdeckelAn(
    unsicherePreise,
    { neu: 1000, gebraucht: 230 },
    "Samsung"
  );
  assert.deepStrictEqual(unsicherePreise, {
    neuVersiegelt: 880,
    wieNeu: 170,
    sehrGut: 155,
    gut: 125,
    defekt: 45,
  });
  assert.strictEqual(deckelAenderungen.length, 5);

  assert(ebay.titelPasstExakt("Apple iPhone 17 Pro 256 GB Schwarz", {
    marke: "Apple", modell: "iPhone 17 Pro", variante: "256 GB", kategorie: "smartphones",
  }));
  assert(!ebay.titelPasstExakt("Apple iPhone 17 Pro Max 256 GB Schwarz", {
    marke: "Apple", modell: "iPhone 17 Pro", variante: "256 GB", kategorie: "smartphones",
  }));
  assert(!ebay.titelPasstExakt("Hülle für Apple iPhone 17 Pro 256 GB", {
    marke: "Apple", modell: "iPhone 17 Pro", variante: "256 GB", kategorie: "smartphones",
  }));
  assert(ebay.titelPasstExakt("Samsung Galaxy Watch9 GPS 44mm Bluetooth", {
    marke: "Samsung", modell: "Galaxy Watch9", variante: "44mm", kategorie: "smartwatches",
  }));
  assert(!ebay.titelPasstExakt("Samsung Galaxy Watch9 GPS 40mm Bluetooth", {
    marke: "Samsung", modell: "Galaxy Watch9", variante: "44mm", kategorie: "smartwatches",
  }));
  assert(ebay.titelPasstExakt("Apple MacBook Air 13 M4 16GB 256GB", {
    marke: "Apple", modell: "MacBook Air 13\" M4", variante: "16 GB · 256 GB", kategorie: "laptops",
  }));
  assert(!ebay.titelPasstExakt("Apple MacBook Air 13 M4 16GB 512GB", {
    marke: "Apple", modell: "MacBook Air 13\" M4", variante: "16 GB · 256 GB", kategorie: "laptops",
  }));

  const stabilePreise = ebay.quartilMedian([95, 98, 100, 102, 105, 107, 110, 112], 0.25);
  const gestreutePreise = ebay.quartilMedian([20, 35, 60, 90, 140, 220, 400, 700], 0.25);
  assert(stabilePreise.streuungProzent < config.MAX_STREUUNG_PROZENT);
  assert(gestreutePreise.streuungProzent > config.MAX_STREUUNG_PROZENT);

  console.log("Preisautomatik-Tests erfolgreich.");
}

test().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});

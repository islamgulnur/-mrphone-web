/**
 * Erzeugt deterministische, realistisch verteilte Mock-Marktpreise, wenn keine
 * eBay-Secrets hinterlegt sind (oder --mock erzwungen wird). So ist die komplette
 * Berechnungslogik (Quartilfilter, Median, Abschläge, Sicherheitsregeln) bereits vor
 * Live-Schaltung im Dry-Run sichtbar, ohne echte API-Zugangsdaten zu brauchen.
 *
 * Seed pro Gerät+Variante+Zustand ist deterministisch (Hash aus id+bezeichnung+
 * zustand), damit wiederholte Dry-Runs vergleichbare Ergebnisse liefern.
 */

// Aufschlag, um aus einem Gebraucht-Preisniveau ein plausibles Neu/versiegelt-
// Preisniveau abzuleiten - nur für Mock-Daten, keine Live-Kalkulation.
const MOCK_NEUWARE_AUFSCHLAG = 1.4;

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32: kleiner, deterministischer PRNG aus einem 32-Bit-Seed.
function erstellePrng(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function geraeteSeedpreis(geraet, variante) {
  const uvpBasis = Number(geraet.uvp) || 0;
  const uvpVariante = uvpBasis + (Number(variante.uvpDelta) || 0);
  const verhaeltnis = uvpBasis > 0 ? uvpVariante / uvpBasis : 1;
  const basis = (Number(geraet.marktwertGebraucht) || uvpVariante * 0.5) * verhaeltnis;
  return Math.max(20, basis);
}

/**
 * Simuliert eine eBay-Marktabfrage. zustand: "USED" oder "NEW".
 * Für "NEW" sinkt die Trefferzahl mit dem Gerätealter (ältere Geräte werden
 * seltener noch versiegelt/neu gehandelt) - kann realistisch unter MIN_TREFFER
 * fallen und so den marktwertNeu=null-Pfad im Dry-Run zeigen.
 */
function sucheMarktMock({ geraet, variante, zustand, referenzjahr }) {
  const seedText = geraet.id + "|" + variante.bezeichnung + "|" + zustand;
  const rng = erstellePrng(hashSeed(seedText));

  const seedGebraucht = geraeteSeedpreis(geraet, variante);
  const seedZiel = zustand === "NEW" ? seedGebraucht * MOCK_NEUWARE_AUFSCHLAG : seedGebraucht;

  const heute = referenzjahr || new Date().getFullYear();
  const alter = Math.max(0, heute - (Number(geraet.jahr) || heute));

  let basisTreffer = zustand === "NEW"
    ? Math.round(18 - alter * 5 + rng() * 6)
    : Math.round(14 + rng() * 14);
  const anzahlTreffer = Math.max(0, basisTreffer);

  const preise = [];
  for (let i = 0; i < anzahlTreffer; i++) {
    const rauschen = 1 + (rng() - 0.5) * 0.4; // ±20% Streuung
    let preis = seedZiel * rauschen;
    // Gelegentliche Ausreißer (ca. jeder 8. Treffer), damit der Quartilfilter
    // im Dry-Run sichtbar etwas herausfiltert.
    if (rng() < 0.12) {
      preis *= rng() < 0.5 ? 0.35 : 2.2;
    }
    preise.push(Math.max(5, Math.round(preis)));
  }

  return { preise, gesamtTreffer: preise.length };
}

module.exports = { sucheMarktMock };

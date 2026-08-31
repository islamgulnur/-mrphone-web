/**
 * Kostenlose zweite Gebrauchtmarkt-Quelle. Rebuy zeigt seine Verkaufspreise öffentlich in den
 * serverseitig gerenderten Suchergebnissen. Wir verwenden ausschließlich exakt passende
 * Marke+Modell+Variante-Treffer und nie die dynamischen Ankaufspreise aus dem Fragebogen.
 */
const competitorClient = require("./competitor-client");

const REBUY_SEARCH = "https://www.rebuy.de/kaufen/suchen?q=";
const TIMEOUT_MS = 12000;
let anfragen = 0;
const cache = new Map();

function normalisiere(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&(?:nbsp|amp);/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function passtRebuyTitel(titel, geraet, variante) {
  if (!competitorClient.passtExakt(titel, geraet, variante)) return false;
  const produkt = normalisiere(titel);
  const modell = normalisiere(geraet.modell);

  // Im Katalog existieren diese Generationen getrennt. Der allgemeine Name darf deshalb weder
  // USB-C noch Generation 2 unbemerkt übernehmen.
  if (modell === "airpods max" && (/\bairpods max 2\b/.test(produkt) || /\busb c\b/.test(produkt))) return false;
  if (/\busb c\b/.test(modell) !== /\busb c\b/.test(produkt)) return false;
  return true;
}

function euroZuZahl(text) {
  const wert = Number(String(text || "").replace(/&nbsp;|\s/g, "").replace(".", "").replace(",", "."));
  return Number.isFinite(wert) && wert > 0 ? wert : null;
}

function median(werte) {
  const sortiert = [...werte].sort((a, b) => a - b);
  if (!sortiert.length) return null;
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 ? sortiert[mitte] : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
}

function leseRebuySuchergebnis(html, geraet, variante) {
  const treffer = [];
  const karten = String(html || "").match(/<ry-product\b[\s\S]*?<\/ry-product>/gi) || [];
  for (const karte of karten) {
    const titelMatch = karte.match(/data-cy=["']product-link["'][^>]*title=["']([^"']+)["']/i)
      || karte.match(/title=["']([^"']+)["'][^>]*data-cy=["']product-link["']/i);
    const preisMatch = karte.match(/data-cy=["']product-price["'][^>]*>\s*([0-9.\s]+,[0-9]{2})(?:&nbsp;|\s)*€/i);
    const titel = titelMatch && titelMatch[1];
    const preis = preisMatch && euroZuZahl(preisMatch[1]);
    if (!titel || preis == null || !passtRebuyTitel(titel, geraet, variante)) continue;
    treffer.push({ titel, preis });
  }
  const preise = treffer.map((eintrag) => eintrag.preis);
  return { treffer, preis: median(preise) };
}

async function holeRebuyGebraucht({ geraet, variante, fetchFn = fetch, maxAnfragen = 80 }) {
  const schluessel = [geraet.marke, geraet.modell, variante.bezeichnung].join("|");
  if (cache.has(schluessel)) return cache.get(schluessel);
  if (anfragen >= maxAnfragen) return { quelle: "rebuy-vk", status: "budget", preis: null, treffer: 0 };
  anfragen += 1;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const variantenText = normalisiere(variante.bezeichnung) === "standard" ? "" : variante.bezeichnung;
    const query = [geraet.marke, geraet.modell, variantenText].filter(Boolean).join(" ");
    const url = REBUY_SEARCH + encodeURIComponent(query);
    const antwort = await fetchFn(url, {
      headers: { "User-Agent": "MrPhone-Preisvergleich/1.0 (+https://mrphone-frankfurt.de)" },
      signal: controller.signal,
    });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const ergebnis = leseRebuySuchergebnis(await antwort.text(), geraet, variante);
    const ausgabe = ergebnis.treffer.length >= 2
      ? { quelle: "rebuy-vk", status: "ok", preis: ergebnis.preis, treffer: ergebnis.treffer.length, url }
      : { quelle: "rebuy-vk", status: "zu-wenig-treffer", preis: null, treffer: ergebnis.treffer.length, url };
    cache.set(schluessel, ausgabe);
    return ausgabe;
  } catch (fehler) {
    return { quelle: "rebuy-vk", status: "fehler", preis: null, treffer: 0, fehler: fehler.message };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { holeRebuyGebraucht, leseRebuySuchergebnis, passtRebuyTitel };

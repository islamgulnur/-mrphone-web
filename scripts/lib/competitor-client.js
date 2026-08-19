/**
 * Liest öffentlich sichtbare Ankaufspreise, ohne unklare Treffer zu übernehmen.
 *
 * Avatel zeigt den Preis für "NEU" direkt auf der Produktseite und ist deshalb
 * automatisierbar. Rebuy und Wirkaufens berechnen Elektronikpreise erst nach einem
 * mehrstufigen Zustandsfragebogen; dafür werden hier bewusst keine Werte geraten.
 */

const AVATEL_BASE = "https://verkaufen.avatel.de";
const TIMEOUT_MS = 12000;

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

function dekodiereHtml(text) {
  return String(text || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&euro;|&#8364;/gi, "€");
}

function ohneTags(text) {
  return dekodiereHtml(String(text || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function produktTokens(geraet, variante) {
  return normalisiere([geraet.marke, geraet.modell, variante.bezeichnung].join(" "))
    .split(" ")
    .filter((token) => token.length > 1 && !["gb", "tb", "ram", "wifi", "5g", "4g"].includes(token));
}

function passtExakt(titel, geraet, variante) {
  const normalisiert = normalisiere(titel);
  const modellNormalisiert = normalisiere(geraet.modell);
  const tokens = produktTokens(geraet, variante);
  if (!tokens.length || !tokens.every((token) => normalisiert.split(" ").includes(token))) return false;

  // Modellfamilien dürfen nicht ineinanderlaufen (z. B. iPhone 17 vs. 17 Pro Max).
  const merkmale = ["pro max", "pro", "plus", "ultra", "mini", "fe"];
  for (const merkmal of merkmale) {
    if (normalisiert.includes(merkmal) !== modellNormalisiert.includes(merkmal)) return false;
  }
  const hatESuffix = (text) => /\b\d+\s+e\b/.test(text);
  if (hatESuffix(normalisiert) !== hatESuffix(modellNormalisiert)) return false;

  // Speicher ist besonders wichtig: 128 GB darf nie mit 512 GB gematcht werden.
  const speicher = normalisiere(variante.bezeichnung).match(/\b(\d+)\s*(gb|tb)\b/);
  if (speicher) {
    const einheit = normalisiert.match(new RegExp("\\b" + speicher[1] + "\\s*" + speicher[2] + "\\b"));
    if (!einheit) return false;
  }
  return true;
}

function findeProduktLinks(html, geraet, variante) {
  const links = [];
  const regex = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    let href = dekodiereHtml(match[2]);
    const attrs = match[1] + " " + match[3];
    const titleMatch = attrs.match(/title=["']([^"']+)["']/i);
    const titel = ohneTags((titleMatch && titleMatch[1]) || match[4]);
    if (!passtExakt(titel, geraet, variante)) continue;
    try {
      href = new URL(href, AVATEL_BASE).href;
      if (new URL(href).hostname !== "verkaufen.avatel.de") continue;
    } catch (_) {
      continue;
    }
    if (!links.some((eintrag) => eintrag.href === href)) links.push({ href, titel });
  }
  return links;
}

function leseAvatelProduktseite(html, geraet, variante) {
  const h1 = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titel = ohneTags(h1 && h1[1]);
  if (!passtExakt(titel, geraet, variante)) return null;
  if (!/ARTIKELZUSTAND\s+NEU/i.test(ohneTags(html))) return null;

  const angebot = ohneTags(html).match(/UNSER PREISANGEBOT:\s*([0-9.\s]+,[0-9]{2})\s*€/i);
  if (!angebot) return null;
  const preis = Number(angebot[1].replace(/[.\s]/g, "").replace(",", "."));
  if (!Number.isFinite(preis) || preis <= 0) return null;
  return { preis, titel };
}

async function holeText(url, fetchFn) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const antwort = await fetchFn(url, {
      headers: { "User-Agent": "MrPhone-Preisvergleich/1.0 (+https://mrphone-frankfurt.de)" },
      signal: controller.signal,
    });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    return await antwort.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function holeAvatelNeu({ geraet, variante, fetchFn = fetch }) {
  const query = [geraet.marke, geraet.modell, variante.bezeichnung].filter(Boolean).join(" ");
  const suchUrl = AVATEL_BASE + "/index.php?route=product/search&search=" + encodeURIComponent(query);
  try {
    const suchHtml = await holeText(suchUrl, fetchFn);
    const links = findeProduktLinks(suchHtml, geraet, variante);
    if (links.length !== 1) {
      return { quelle: "avatel", status: links.length ? "mehrdeutig" : "nicht-gefunden", preis: null };
    }
    const produktHtml = await holeText(links[0].href, fetchFn);
    const produkt = leseAvatelProduktseite(produktHtml, geraet, variante);
    if (!produkt) return { quelle: "avatel", status: "nicht-eindeutig", preis: null };
    return { quelle: "avatel", status: "ok", preis: produkt.preis, titel: produkt.titel, url: links[0].href };
  } catch (fehler) {
    return { quelle: "avatel", status: "fehler", preis: null, fehler: fehler.message };
  }
}

module.exports = {
  holeAvatelNeu,
  findeProduktLinks,
  leseAvatelProduktseite,
  passtExakt,
};

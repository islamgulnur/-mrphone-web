#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BESTAND = path.join(ROOT, "bestand.json");
const PRODUKTE_DIR = path.join(ROOT, "produkte");
const BILDQUELLEN = path.join(ROOT, "images", "produkte", "quellen.json");
const MANIFEST = path.join(__dirname, "produktseiten-manifest.json");
const SITEMAP = path.join(ROOT, "sitemap.xml");
const BASE_URL = "https://mrphone-frankfurt.de";
const START_MARKER = "  <!-- AUTO-PRODUKTE START -->";
const END_MARKER = "  <!-- AUTO-PRODUKTE ENDE -->";
const PAGE_MARKER = "<!-- AUTO-GENERATED: POS-PRODUKTSEITE -->";
const MODELL_ZUSAETZE = new Set(["pro", "max", "plus", "ultra", "mini", "air", "fe", "edge", "fold", "flip", "note", "lite"]);

const KATEGORIEN = {
  smartphones: { label: "Smartphones", singular: "Smartphone", landing: "/gebrauchte-smartphones-frankfurt.html", ratgeber: "/ratgeber/gebrauchtes-smartphone-kaufen.html" },
  tablets: { label: "Tablets & iPads", singular: "Tablet", landing: "/tablets-ipads-frankfurt.html" },
  smartwatches: { label: "Smartwatches", singular: "Smartwatch", landing: "/smartwatches-frankfurt.html" },
  laptops: { label: "Laptops & Notebooks", singular: "Laptop", landing: "/laptops-notebooks-frankfurt.html" },
  pcs: { label: "Computer", singular: "Computer", landing: "/sortiment.html" },
  kopfhoerer: { label: "Kopfhörer", singular: "Kopfhörer", landing: "/sortiment.html" },
  konsolen: { label: "Konsolen", singular: "Konsole", landing: "/sortiment.html" },
  zubehoer: { label: "Zubehör", singular: "Zubehör", landing: "/sortiment.html" },
  monitore: { label: "Monitore", singular: "Monitor", landing: "/sortiment.html" },
  kameras: { label: "Kameras", singular: "Kamera", landing: "/kameras-frankfurt.html" },
};

function sauber(value) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
}

function slugify(value) {
  return sauber(value)
    .replace(/ß/g, "ss")
    .replace(/&/g, " und ")
    .replace(/\+/g, " plus ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function html(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function xml(value) {
  return html(value);
}

function schemaJson(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

function preis(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value));
}

function zustandLabel(value) {
  const z = sauber(value).toLowerCase();
  if (z === "neu") return "Neu";
  if (z === "wie neu") return "Wie neu";
  if (z === "sehr gut") return "Sehr gut";
  if (z === "gut") return "Gut";
  if (z === "akzeptabel") return "Akzeptabel";
  return sauber(value) || "Gebraucht";
}

function datum(value, fallback = "2026-01-01") {
  const text = sauber(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function aktiveGruppen(bestand) {
  const gruppen = new Map();
  for (const item of bestand) {
    if (item.aktiv !== true || !(Number(item.menge) > 0) || !(Number(item.preis) > 0)) continue;
    const marke = sauber(item.marke);
    const modell = sauber(item.modell);
    if (!marke || !modell) continue;
    const slug = slugify(`${marke} ${modell}`);
    if (!slug) continue;
    if (!gruppen.has(slug)) gruppen.set(slug, { slug, marke, modell, kategorie: item.kategorie || "smartphones", items: [] });
    const gruppe = gruppen.get(slug);
    if (slugify(gruppe.marke) !== slugify(marke)) {
      throw new Error(`Uneindeutiger Produkt-Slug ${slug}: ${gruppe.marke} / ${marke}`);
    }
    gruppe.items.push({ ...item, marke, modell });
  }

  return [...gruppen.values()]
    .map((gruppe) => {
      gruppe.items.sort((a, b) =>
        Number(a.preis) - Number(b.preis) ||
        sauber(a.speicher).localeCompare(sauber(b.speicher), "de", { numeric: true }) ||
        sauber(a.zustand).localeCompare(sauber(b.zustand), "de")
      );
      gruppe.lastmod = gruppe.items.map((item) => datum(item.datum)).sort().at(-1);
      return gruppe;
    })
    .sort((a, b) => `${a.marke} ${a.modell}`.localeCompare(`${b.marke} ${b.modell}`, "de", { numeric: true }));
}

function sichereLokaleBildUrl(bild) {
  const relativ = sauber(bild).replace(/^\/+/, "").replace(/\\/g, "/");
  if (!relativ || /^https?:/i.test(relativ) || relativ.includes("..")) return "";
  const vollpfad = path.resolve(ROOT, relativ);
  if (!vollpfad.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(vollpfad)) return "";
  return `/${relativ.split("/").map(encodeURIComponent).join("/")}`;
}

function bildDateien() {
  const ordner = path.join(ROOT, "images", "produkte");
  if (!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner)
    .filter((name) => /\.(?:jpe?g|png|webp)$/i.test(name))
    .map((name) => ({ name, slug: slugify(path.parse(name).name), url: `/images/produkte/${encodeURIComponent(name)}` }));
}

function findeBild(gruppe, bilder) {
  for (const item of gruppe.items) {
    const direkt = sichereLokaleBildUrl(item.bild);
    if (direkt) return direkt;
  }
  const exakt = bilder.find((bild) => bild.slug === gruppe.slug);
  if (exakt) return exakt.url;
  const ignorieren = new Set(["5g", "4g", "lte", "wifi", "cellular", "gb", "tb", "gen"]);
  const tokens = slugify(gruppe.modell).split("-").filter((token) => token.length > 1 && !ignorieren.has(token));
  const zielTokens = new Set(slugify(`${gruppe.marke} ${gruppe.modell}`).split("-"));
  const markenToken = slugify(gruppe.marke);
  const kandidaten = bilder
    .map((bild) => {
      const dateiTokens = bild.slug.split("-");
      const treffer = tokens.filter((token) => dateiTokens.includes(token)).length;
      const falscherZusatz = [...MODELL_ZUSAETZE].some((zusatz) => dateiTokens.includes(zusatz) && !zielTokens.has(zusatz));
      return { bild, treffer, falscherZusatz, score: treffer + (dateiTokens.includes(markenToken) ? 1 : 0) };
    })
    .filter(({ treffer, falscherZusatz }) => !falscherZusatz && treffer === tokens.length && treffer >= 2)
    .sort((a, b) => b.score - a.score || a.bild.name.localeCompare(b.bild.name, "de"));
  return kandidaten[0]?.bild.url || "";
}

function bildQuellen() {
  if (!fs.existsSync(BILDQUELLEN)) return {};
  try {
    const daten = JSON.parse(fs.readFileSync(BILDQUELLEN, "utf8"));
    return daten && typeof daten.bilder === "object" ? daten.bilder : {};
  } catch (_) {
    return {};
  }
}

function sichereQuellseite(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "commons.wikimedia.org" ? url.href : "";
  } catch (_) {
    return "";
  }
}

function seitenTitel(name) {
  const lang = `${name} in Frankfurt kaufen | Mr. Phone`;
  return lang.length <= 65 ? lang : `${name} kaufen | Mr. Phone Frankfurt`;
}

function beschreibung(name, abPreis, anzahl) {
  const varianten = anzahl === 1 ? "eine verfügbare Variante" : `${anzahl} verfügbare Varianten`;
  const ausfuehrlich = `${name} in Frankfurt kaufen: ${varianten} ab ${abPreis}. Aktueller Ladenbestand bei Mr. Phone auf der Zeil, geprüft und direkt abholbar.`;
  if (ausfuehrlich.length <= 160) return ausfuehrlich;
  return `${name} in Frankfurt: ${varianten} ab ${abPreis}. Aktuell bei Mr. Phone auf der Zeil verfügbar und direkt im Laden abholbar.`;
}

function header() {
  return `<header class="site-header">
  <div class="header-inner">
    <a href="/" class="logo-link" aria-label="Mr. Phone – Startseite">
      <img src="/images/logo.png" alt="Mr. Phone – Handy Verkauf, Ankauf &amp; Reparatur Frankfurt Zeil" width="800" height="219" class="logo">
    </a>
    <span class="status-badge status-badge--mobile" data-status-badge aria-live="polite"><span class="status-dot"></span><span class="status-text">Öffnungszeiten werden geladen…</span></span>
    <input type="checkbox" id="nav-toggle" class="nav-toggle">
    <label for="nav-toggle" class="burger-label" aria-label="Menü öffnen"><span></span><span></span><span></span></label>
    <nav class="main-nav" aria-label="Hauptnavigation">
      <ul>
        <li><a href="/">Startseite</a></li>
        <li><a href="/handy-reparatur-frankfurt.html">Handy Reparatur</a></li>
        <li><a href="/handy-ankauf-frankfurt.html">Handy Ankauf</a></li>
        <li><a href="/sortiment.html" aria-current="page">Unser Sortiment</a></li>
        <li><a href="/ratgeber/">Ratgeber</a></li>
        <li><a href="/kontakt.html">Kontakt</a></li>
      </ul>
      <div class="nav-mobile-actions">
        <a href="/en/sortiment.html" class="lang-switch" hreflang="en" lang="en">English version</a>
        <a href="tel:+496995632281" class="btn btn-outline-dark">069 95632281 anrufen</a>
        <a href="https://wa.me/496995632281" class="btn btn-primary" target="_blank" rel="noopener">Per WhatsApp anfragen</a>
      </div>
    </nav>
    <div class="header-cta">
      <a href="/en/sortiment.html" class="lang-switch" hreflang="en" lang="en">EN</a>
      <span class="status-badge status-badge--desktop" data-status-badge aria-live="polite"><span class="status-dot"></span><span class="status-text">Öffnungszeiten werden geladen…</span></span>
      <a href="tel:+496995632281" class="header-phone">069 95632281</a>
      <a href="https://wa.me/496995632281" class="btn btn-primary" target="_blank" rel="noopener">WhatsApp</a>
    </div>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <img src="/images/logo.png" alt="Mr. Phone – Handy Verkauf, Ankauf &amp; Reparatur Frankfurt Zeil" width="800" height="219" class="footer-logo" loading="lazy">
        <p>Ihr Handy-Fachgeschäft mitten auf der Zeil in Frankfurt am Main: Verkauf, Ankauf und Reparatur aus einer Hand.</p>
      </div>
      <div class="footer-col"><h3>Kontakt</h3><ul><li>Zeil 115–117, 60313 Frankfurt am Main</li><li><a href="tel:+496995632281">069 95632281</a></li><li><a href="https://wa.me/496995632281" target="_blank" rel="noopener">WhatsApp schreiben</a></li><li><a href="mailto:mr.phone.zeil@gmail.com">mr.phone.zeil@gmail.com</a></li></ul></div>
      <div class="footer-col"><h3>Navigation</h3><ul><li><a href="/handy-reparatur-frankfurt.html">Handy Reparatur Frankfurt</a></li><li><a href="/handy-ankauf-frankfurt.html">Handy Ankauf Frankfurt</a></li><li><a href="/sortiment.html">Unser Sortiment</a></li><li><a href="/ratgeber/">Ratgeber</a></li><li><a href="/kontakt.html">Kontakt &amp; Öffnungszeiten</a></li><li><a href="https://g.page/r/CS-7cA2W6fQUEBM/review" target="_blank" rel="noopener">Google Bewertung abgeben</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span class="bewertungen-kompakt" data-bewertungen-kompakt hidden></span><span>© 2026 Mr. Phone GbR, Zeil 115–117, 60313 Frankfurt am Main</span><span><a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a></span></div>
  </div>
</footer>`;
}

function produktSeite(gruppe, alleGruppen, bilder, quellen) {
  const name = `${gruppe.marke} ${gruppe.modell}`;
  const canonical = `${BASE_URL}/produkte/${gruppe.slug}.html`;
  const kategorie = KATEGORIEN[gruppe.kategorie] || KATEGORIEN.smartphones;
  const abPreis = preis(gruppe.items[0].preis);
  const meta = beschreibung(name, abPreis, gruppe.items.length);
  const bild = findeBild(gruppe, bilder);
  const bildSlug = bild ? slugify(path.parse(decodeURIComponent(bild)).name) : "";
  const bildQuelle = bildSlug ? quellen[bildSlug] : null;
  const whatsapp = `https://wa.me/496995632281?text=${encodeURIComponent(`Hallo, ich interessiere mich für das ${name} aus Ihrem Sortiment. Ist es noch verfügbar?`)}`;
  const angebote = gruppe.items.map((item, index) => ({
    "@type": "Offer",
    sku: sauber(item.id) || `${gruppe.slug}-${index + 1}`,
    url: `${canonical}#angebot-${index + 1}`,
    priceCurrency: "EUR",
    price: Number(item.preis).toFixed(2),
    availability: "https://schema.org/InStock",
    itemCondition: sauber(item.zustand).toLowerCase() === "neu" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    inventoryLevel: { "@type": "QuantitativeValue", value: Number(item.menge) },
    seller: { "@type": "Organization", name: "Mr. Phone" },
  }));
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonical}#product`,
    name,
    brand: { "@type": "Brand", name: gruppe.marke },
    description: meta,
    ...(bild ? { image: [`${BASE_URL}${bild}`] } : {}),
    offers: angebote,
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Startseite", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Verfügbare Geräte", item: `${BASE_URL}/produkte/` },
      { "@type": "ListItem", position: 3, name, item: canonical },
    ],
  };
  const angeboteHtml = gruppe.items.map((item, index) => {
    const details = [sauber(item.speicher), sauber(item.farbe)].filter(Boolean).join(" · ") || "Standardausführung";
    const menge = Number(item.menge);
    const badgeKlasse = sauber(item.zustand).toLowerCase() === "neu" ? "produkt-badge--neu" : "produkt-badge--gebraucht";
    return `<article class="produkt-angebot" id="angebot-${index + 1}"><div><h2>${html(details)}</h2><p><span class="produkt-badge ${badgeKlasse}">${html(zustandLabel(item.zustand))}</span> ${menge === 1 ? "1 Stück verfügbar" : `${menge} Stück verfügbar`}</p></div><strong>${html(preis(item.preis))}</strong><a class="produkt-btn produkt-btn--klein" href="${html(whatsapp)}" target="_blank" rel="noopener">Verfügbarkeit anfragen</a></article>`;
  }).join("\n");
  const verwandte = alleGruppen
    .filter((item) => item.slug !== gruppe.slug && (item.marke === gruppe.marke || item.kategorie === gruppe.kategorie))
    .slice(0, 6)
    .map((item) => `<li><a href="/produkte/${item.slug}.html">${html(`${item.marke} ${item.modell}`)}</a> <span>ab ${html(preis(item.items[0].preis))}</span></li>`)
    .join("");
  const quellseite = sichereQuellseite(bildQuelle?.quellseite);
  const bildnachweis = quellseite
    ? ` <a href="${html(quellseite)}" target="_blank" rel="noopener">Bild: ${html(bildQuelle.urheber || "Wikimedia Commons")} · ${html(bildQuelle.lizenz || "Lizenzhinweis")}</a>`
    : "";
  const media = bild
    ? `<img src="${html(bild)}" alt="${html(`${name} bei Mr. Phone Frankfurt`)}" width="720" height="720"><p class="produkt-bild-hinweis">Vorschaubild – Farbe und Ausführung können vom tatsächlich verfügbaren Gerät abweichen.${bildnachweis}</p>`
    : `<div class="produkt-placeholder" role="img" aria-label="Für ${html(name)} ist noch kein Produktfoto hinterlegt"><span>${html(gruppe.marke)}</span><strong>${html(gruppe.modell)}</strong><small>Produktfoto folgt</small></div>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${html(seitenTitel(name))}</title>
<meta name="description" content="${html(meta)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/png" href="/images/logo.png">
<meta property="og:type" content="product"><meta property="og:site_name" content="Mr. Phone"><meta property="og:title" content="${html(seitenTitel(name))}"><meta property="og:description" content="${html(meta)}"><meta property="og:url" content="${canonical}">${bild ? `<meta property="og:image" content="${BASE_URL}${html(bild)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/dark-theme.css">
<link rel="stylesheet" href="/produktseiten.css">
<script src="/pos-bestand-client.js" defer></script>
<script type="application/ld+json">${schemaJson(productSchema)}</script>
<script type="application/ld+json">${schemaJson(breadcrumbSchema)}</script>
</head>
<body class="produkt-page">
${PAGE_MARKER}
<a class="skip-link" href="#inhalt">Zum Inhalt springen</a>
${header()}
<main id="inhalt">
  <div class="produkt-container"><nav class="produkt-breadcrumb" aria-label="Breadcrumb"><a href="/">Startseite</a><span>›</span><a href="/produkte/">Verfügbare Geräte</a><span>›</span><span>${html(name)}</span></nav></div>
  <section class="produkt-hero"><div class="produkt-container produkt-hero-grid"><div class="produkt-media">${media}</div><div><p class="produkt-eyebrow">Aktuell im Laden verfügbar</p><h1>${html(name)} in Frankfurt kaufen</h1><p class="produkt-lead" data-live-beschreibung>${html(gruppe.items.length === 1 ? `Dieses ${kategorie.singular} ist aktuell bei uns auf der Zeil verfügbar.` : `Wählen Sie aus ${gruppe.items.length} aktuell verfügbaren Varianten bei uns auf der Zeil.`)} Die Preise stammen direkt aus unserem POS-Bestand.</p><p class="produkt-ab">Ab <strong data-live-abpreis>${html(abPreis)}</strong></p><div class="produkt-actions"><a class="produkt-btn" href="${html(whatsapp)}" target="_blank" rel="noopener">Per WhatsApp anfragen</a><a class="produkt-btn produkt-btn--sekundaer" href="tel:+496995632281">069 95632281 anrufen</a></div><p class="produkt-hinweis">Nur Verkauf und Abholung im Ladengeschäft. Bitte Verfügbarkeit vor der Anfahrt kurz bestätigen.</p></div></div></section>
  <section class="produkt-section"><div class="produkt-container"><p class="produkt-eyebrow">Aktuelle Auswahl</p><h2>Verfügbare ${html(name)} Angebote</h2><div class="produkt-angebote" data-produkt-slug="${gruppe.slug}">${angeboteHtml}</div></div></section>
  <section class="produkt-section produkt-section--hell"><div class="produkt-container produkt-info-grid"><div><p class="produkt-eyebrow">Direkt auf der Zeil</p><h2>Persönlich ansehen und mitnehmen</h2><p>Besuchen Sie Mr. Phone in der Zeil 115–117 in Frankfurt. Wir zeigen Ihnen das Gerät vor Ort und beantworten Ihre Fragen zu Zustand, Speicher und Lieferumfang.</p><a href="/kontakt.html">Adresse und Öffnungszeiten ansehen →</a></div><div><h2>Wichtiger Preis-Hinweis</h2><p>Diese Seite wird automatisch aus unserem aktuellen Kassenbestand erstellt. Zwischenverkauf und kurzfristige Preisänderungen sind möglich. Maßgeblich ist der ausgezeichnete Preis im Laden.</p>${kategorie.ratgeber ? `<p><a href="${kategorie.ratgeber}">Ratgeber: Worauf Sie beim Kauf eines gebrauchten Smartphones achten sollten →</a></p>` : ""}</div></div></section>
  ${verwandte ? `<section class="produkt-section"><div class="produkt-container"><p class="produkt-eyebrow">Weitere Auswahl</p><h2>Ähnliche verfügbare Geräte</h2><ul class="produkt-links">${verwandte}</ul><p><a href="${kategorie.landing}">Mehr ${html(kategorie.label)} in Frankfurt ansehen →</a></p></div></section>` : ""}
</main>
${footer()}
<a href="https://wa.me/496995632281" class="whatsapp-float" target="_blank" rel="noopener" aria-label="Per WhatsApp anfragen">💬</a>
<script defer src="/main.js"></script>
</body>
</html>
`;
}

function indexSeite(gruppen) {
  const nachKategorie = new Map();
  for (const gruppe of gruppen) {
    if (!nachKategorie.has(gruppe.kategorie)) nachKategorie.set(gruppe.kategorie, []);
    nachKategorie.get(gruppe.kategorie).push(gruppe);
  }
  const bereiche = [...nachKategorie.entries()].map(([key, items]) => {
    const kat = KATEGORIEN[key] || { label: key };
    const links = items.map((gruppe) => `<li><a href="/produkte/${gruppe.slug}.html"><strong>${html(`${gruppe.marke} ${gruppe.modell}`)}</strong><span>${gruppe.items.length === 1 ? "1 Variante" : `${gruppe.items.length} Varianten`} · ab ${html(preis(gruppe.items[0].preis))}</span></a></li>`).join("");
    return `<section class="produkt-index-gruppe"><h2>${html(kat.label)}</h2><ul class="produkt-index-links">${links}</ul></section>`;
  }).join("\n");
  const canonical = `${BASE_URL}/produkte/`;
  const meta = `${gruppen.length} aktuell verfügbare Gerätemodelle bei Mr. Phone Frankfurt entdecken. Preise direkt aus dem Ladenbestand – auf der Zeil ansehen und abholen.`;
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Startseite", item: `${BASE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Verfügbare Geräte", item: canonical },
  ] };
  const itemList = { "@context": "https://schema.org", "@type": "ItemList", numberOfItems: gruppen.length, itemListElement: gruppen.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: `${g.marke} ${g.modell}`, url: `${BASE_URL}/produkte/${g.slug}.html` })) };
  const ogImage = `${BASE_URL}/images/mr-phone-zeil-frankfurt-aussenansicht.jpg`;
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verfügbare Handys & Geräte | Mr. Phone Frankfurt</title><meta name="description" content="${html(meta)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${canonical}"><link rel="icon" type="image/png" href="/images/logo.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Mr. Phone"><meta property="og:title" content="Verfügbare Handys & Geräte | Mr. Phone Frankfurt"><meta property="og:description" content="${html(meta)}"><meta property="og:image" content="${ogImage}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="de_DE"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Verfügbare Handys & Geräte | Mr. Phone Frankfurt"><meta name="twitter:description" content="${html(meta)}"><meta name="twitter:image" content="${ogImage}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/dark-theme.css"><link rel="stylesheet" href="/produktseiten.css"><script type="application/ld+json">${schemaJson(breadcrumb)}</script><script type="application/ld+json">${schemaJson(itemList)}</script></head>
<body class="produkt-page">${PAGE_MARKER}<a class="skip-link" href="#inhalt">Zum Inhalt springen</a>${header()}<main id="inhalt"><div class="produkt-container"><nav class="produkt-breadcrumb" aria-label="Breadcrumb"><a href="/">Startseite</a><span>›</span><span>Verfügbare Geräte</span></nav></div><section class="produkt-index-hero"><div class="produkt-container"><p class="produkt-eyebrow">Direkt aus unserem Ladenbestand</p><h1>Aktuell verfügbare Geräte bei Mr. Phone Frankfurt</h1><p class="produkt-lead">Hier finden Sie ${gruppen.length} Gerätemodelle, die derzeit bei uns auf der Zeil geführt werden. Öffnen Sie ein Modell für Varianten, Zustand und aktuelle Preise.</p><a class="produkt-btn" href="/sortiment.html">Kompletten Bestand mit Filtern öffnen</a></div></section><div class="produkt-container produkt-index">${bereiche}</div></main>${footer()}<a href="https://wa.me/496995632281" class="whatsapp-float" target="_blank" rel="noopener" aria-label="Per WhatsApp anfragen">💬</a><script defer src="/main.js"></script></body></html>\n`;
}

function sitemapMitProdukten(ursprung, gruppen) {
  const urls = [
    { loc: `${BASE_URL}/produkte/`, lastmod: gruppen.map((g) => g.lastmod).sort().at(-1) || "2026-01-01", priority: "0.8" },
    ...gruppen.map((g) => ({ loc: `${BASE_URL}/produkte/${g.slug}.html`, lastmod: g.lastmod, priority: "0.7" })),
  ];
  const block = [START_MARKER, ...urls.flatMap((item) => [
    "  <url>",
    `    <loc>${xml(item.loc)}</loc>`,
    `    <lastmod>${item.lastmod}</lastmod>`,
    "    <changefreq>daily</changefreq>",
    `    <priority>${item.priority}</priority>`,
    "  </url>",
  ]), END_MARKER].join("\n");
  const markerRegex = new RegExp(`${START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  if (markerRegex.test(ursprung)) return `${ursprung.replace(markerRegex, block).trimEnd()}\n`;
  if (!ursprung.includes("</urlset>")) throw new Error("sitemap.xml enthält kein schließendes urlset-Element.");
  return `${ursprung.replace("</urlset>", `${block}\n</urlset>`).trimEnd()}\n`;
}

function artefakteErstellen() {
  const bestand = JSON.parse(fs.readFileSync(BESTAND, "utf8"));
  if (!Array.isArray(bestand)) throw new Error("bestand.json muss ein Array enthalten.");
  const gruppen = aktiveGruppen(bestand);
  if (!gruppen.length) throw new Error("Keine aktiven POS-Geräte gefunden; vorhandene Produktseiten bleiben unverändert.");
  const bilder = bildDateien();
  const quellen = bildQuellen();
  const pages = new Map(gruppen.map((gruppe) => [`${gruppe.slug}.html`, produktSeite(gruppe, gruppen, bilder, quellen)]));
  pages.set("index.html", indexSeite(gruppen));
  const sitemap = sitemapMitProdukten(fs.readFileSync(SITEMAP, "utf8"), gruppen);
  const manifest = `${JSON.stringify({ version: 1, index: "index.html", pages: gruppen.map((g) => `${g.slug}.html`) }, null, 2)}\n`;
  return { gruppen, pages, sitemap, manifest };
}

function sichererProduktpfad(datei) {
  if (!/^[a-z0-9-]+\.html$/.test(datei)) throw new Error(`Unsicherer Produktseiten-Dateiname: ${datei}`);
  const ziel = path.resolve(PRODUKTE_DIR, datei);
  if (!ziel.startsWith(`${PRODUKTE_DIR}${path.sep}`)) throw new Error(`Produktseite liegt außerhalb des Zielordners: ${datei}`);
  return ziel;
}

function schreiben(artefakte) {
  fs.mkdirSync(PRODUKTE_DIR, { recursive: true });
  let altManifest = { pages: [] };
  if (fs.existsSync(MANIFEST)) altManifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const neu = new Set([...artefakte.pages.keys()]);
  for (const datei of ["index.html", ...(altManifest.pages || [])]) {
    if (neu.has(datei)) continue;
    const ziel = sichererProduktpfad(datei);
    if (!fs.existsSync(ziel)) continue;
    const inhalt = fs.readFileSync(ziel, "utf8");
    if (!inhalt.includes(PAGE_MARKER)) throw new Error(`Alte Datei ${datei} ist nicht als automatisch generiert markiert und wird nicht gelöscht.`);
    fs.unlinkSync(ziel);
  }
  for (const [datei, inhalt] of artefakte.pages) fs.writeFileSync(sichererProduktpfad(datei), inhalt, "utf8");
  fs.writeFileSync(SITEMAP, artefakte.sitemap, "utf8");
  fs.writeFileSync(MANIFEST, artefakte.manifest, "utf8");
  console.log(`${artefakte.gruppen.length} Produktseiten aus dem aktuellen POS-Bestand erstellt.`);
}

function pruefen(artefakte) {
  const fehler = [];
  for (const [datei, erwartet] of artefakte.pages) {
    const ziel = sichererProduktpfad(datei);
    if (!fs.existsSync(ziel)) fehler.push(`fehlt: produkte/${datei}`);
    else if (fs.readFileSync(ziel, "utf8") !== erwartet) fehler.push(`veraltet: produkte/${datei}`);
  }
  if (!fs.existsSync(MANIFEST) || fs.readFileSync(MANIFEST, "utf8") !== artefakte.manifest) fehler.push("veraltet: scripts/produktseiten-manifest.json");
  if (fs.readFileSync(SITEMAP, "utf8") !== artefakte.sitemap) fehler.push("veraltet: sitemap.xml");
  if (fehler.length) throw new Error(`Produktseiten-Prüfung fehlgeschlagen:\n- ${fehler.join("\n- ")}`);
  console.log(`${artefakte.gruppen.length} Produktseiten sind aktuell und vollständig.`);
}

function main() {
  const artefakte = artefakteErstellen();
  if (process.argv.includes("--check")) pruefen(artefakte);
  else schreiben(artefakte);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { aktiveGruppen, artefakteErstellen, bildDateien, findeBild, slugify };

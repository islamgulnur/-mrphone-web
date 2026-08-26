#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { artefakteErstellen } = require("./build-produktseiten");

const ROOT = path.resolve(__dirname, "..");
const artefakte = artefakteErstellen();
const fehler = [];

for (const gruppe of artefakte.gruppen) {
  const datei = path.join(ROOT, "produkte", `${gruppe.slug}.html`);
  if (!fs.existsSync(datei)) {
    fehler.push(`Fehlende Seite: ${gruppe.slug}.html`);
    continue;
  }
  const inhalt = fs.readFileSync(datei, "utf8");
  const h1 = (inhalt.match(/<h1\b/g) || []).length;
  const title = inhalt.match(/<title>([^<]+)<\/title>/)?.[1] || "";
  const description = inhalt.match(/<meta name="description" content="([^"]+)">/)?.[1] || "";
  const offers = (inhalt.match(/"@type": "Offer"/g) || []).length;
  if (h1 !== 1) fehler.push(`${gruppe.slug}: erwartet genau eine H1, gefunden ${h1}`);
  if (title.length < 30 || title.length > 65) fehler.push(`${gruppe.slug}: Title-Länge ${title.length}`);
  if (description.length < 110 || description.length > 165) fehler.push(`${gruppe.slug}: Meta-Description-Länge ${description.length}`);
  if (!inhalt.includes(`rel="canonical" href="https://mrphone-frankfurt.de/produkte/${gruppe.slug}.html"`)) fehler.push(`${gruppe.slug}: Canonical fehlt`);
  if (!inhalt.includes('"@type": "Product"')) fehler.push(`${gruppe.slug}: Product-Schema fehlt`);
  if (!inhalt.includes('"@type": "BreadcrumbList"')) fehler.push(`${gruppe.slug}: Breadcrumb-Schema fehlt`);
  if (offers !== gruppe.items.length) fehler.push(`${gruppe.slug}: ${offers} Schema-Angebote statt ${gruppe.items.length}`);
  if (/noindex/i.test(inhalt)) fehler.push(`${gruppe.slug}: enthält noindex`);
}

const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const sitemapProdukte = (sitemap.match(/<loc>https:\/\/mrphone-frankfurt\.de\/produkte\//g) || []).length;
if (sitemapProdukte !== artefakte.gruppen.length + 1) fehler.push(`Sitemap enthält ${sitemapProdukte} Produkt-URLs statt ${artefakte.gruppen.length + 1}`);

if (fehler.length) {
  console.error(`Produktseiten-Test fehlgeschlagen:\n- ${fehler.join("\n- ")}`);
  process.exit(1);
}
console.log(`${artefakte.gruppen.length} Produktseiten geprüft: Titel, Beschreibungen, Canonicals, Schemas, Angebote und Sitemap sind korrekt.`);

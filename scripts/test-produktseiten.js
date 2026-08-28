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
  const neuBadges = (inhalt.match(/produkt-badge--neu/g) || []).length;
  const gebrauchtBadges = (inhalt.match(/produkt-badge--gebraucht/g) || []).length;
  const erwartetNeu = gruppe.items.filter((item) => String(item.zustand || "").trim().toLowerCase() === "neu").length;
  if (h1 !== 1) fehler.push(`${gruppe.slug}: erwartet genau eine H1, gefunden ${h1}`);
  if (title.length < 30 || title.length > 65) fehler.push(`${gruppe.slug}: Title-Länge ${title.length}`);
  if (description.length < 110 || description.length > 165) fehler.push(`${gruppe.slug}: Meta-Description-Länge ${description.length}`);
  if (!inhalt.includes(`rel="canonical" href="https://mrphone-frankfurt.de/produkte/${gruppe.slug}.html"`)) fehler.push(`${gruppe.slug}: Canonical fehlt`);
  if (!inhalt.includes('"@type": "Product"')) fehler.push(`${gruppe.slug}: Product-Schema fehlt`);
  if (!inhalt.includes('"@type": "BreadcrumbList"')) fehler.push(`${gruppe.slug}: Breadcrumb-Schema fehlt`);
  if (!inhalt.includes('class="site-header"')) fehler.push(`${gruppe.slug}: gemeinsamer Website-Header fehlt`);
  if (!inhalt.includes('class="site-footer"')) fehler.push(`${gruppe.slug}: gemeinsamer Website-Footer fehlt`);
  if (!inhalt.includes('href="/dark-theme.css"')) fehler.push(`${gruppe.slug}: gemeinsames Dark-Theme fehlt`);
  if (!inhalt.includes('src="/main.js"')) fehler.push(`${gruppe.slug}: gemeinsame Website-Funktionen fehlen`);
  if (offers !== gruppe.items.length) fehler.push(`${gruppe.slug}: ${offers} Schema-Angebote statt ${gruppe.items.length}`);
  if (inhalt.includes('class="produkt-media"><img') && !inhalt.includes('class="produkt-bild-hinweis">Vorschaubild – Farbe und Ausführung können')) {
    fehler.push(`${gruppe.slug}: Abweichungshinweis beim Produktbild fehlt`);
  }
  if (neuBadges !== erwartetNeu) fehler.push(`${gruppe.slug}: ${neuBadges} Neu-Badges statt ${erwartetNeu}`);
  if (gebrauchtBadges !== gruppe.items.length - erwartetNeu) fehler.push(`${gruppe.slug}: ${gebrauchtBadges} Gebraucht-Badges statt ${gruppe.items.length - erwartetNeu}`);
  if (/noindex/i.test(inhalt)) fehler.push(`${gruppe.slug}: enthält noindex`);
}

const liveClient = fs.readFileSync(path.join(ROOT, "pos-bestand-client.js"), "utf8");
if (!liveClient.includes('produkt-badge--neu') || !liveClient.includes('produkt-badge--gebraucht')) {
  fehler.push("POS-Live-Anzeige unterscheidet Neu- und Gebraucht-Badges nicht");
}

const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const sitemapProdukte = (sitemap.match(/<loc>https:\/\/mrphone-frankfurt\.de\/produkte\//g) || []).length;
if (sitemapProdukte !== artefakte.gruppen.length + 1) fehler.push(`Sitemap enthält ${sitemapProdukte} Produkt-URLs statt ${artefakte.gruppen.length + 1}`);

if (fehler.length) {
  console.error(`Produktseiten-Test fehlgeschlagen:\n- ${fehler.join("\n- ")}`);
  process.exit(1);
}
console.log(`${artefakte.gruppen.length} Produktseiten geprüft: Titel, Beschreibungen, Canonicals, Schemas, Angebote und Sitemap sind korrekt.`);

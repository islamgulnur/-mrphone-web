#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "https://mrphone-frankfurt.de";
const SITEMAP = path.join(ROOT, "sitemap.xml");

function matchOne(source, regex) {
  const match = source.match(regex);
  return match ? match[1]
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim() : "";
}

function localPath(urlValue) {
  const url = new URL(urlValue, `${BASE_URL}/`);
  if (url.origin !== BASE_URL) return null;
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  else if (pathname.endsWith("/")) pathname += "index.html";
  return path.join(ROOT, ...pathname.split("/").filter(Boolean));
}

function normalCanonical(urlValue) {
  const url = new URL(urlValue);
  url.hash = "";
  url.search = "";
  if (url.pathname.endsWith("/index.html")) url.pathname = url.pathname.slice(0, -"index.html".length);
  return url.href;
}

function main() {
  const sitemap = fs.readFileSync(SITEMAP, "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  const errors = [];
  const titles = new Map();
  const descriptions = new Map();

  if (!urls.length) errors.push("Sitemap enthält keine URLs.");
  if (new Set(urls).size !== urls.length) errors.push("Sitemap enthält doppelte URLs.");

  for (const pageUrl of urls) {
    const file = localPath(pageUrl);
    const rel = file ? path.relative(ROOT, file).replace(/\\/g, "/") : pageUrl;
    if (!file || !fs.existsSync(file)) {
      errors.push(`${rel}: Sitemap-Ziel fehlt.`);
      continue;
    }

    const source = fs.readFileSync(file, "utf8");
    const title = matchOne(source, /<title>([\s\S]*?)<\/title>/i);
    const description = matchOne(source, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    const canonical = matchOne(source, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const lang = matchOne(source, /<html\s+[^>]*lang=["']([^"']+)["']/i);
    const h1Count = (source.match(/<h1(?:\s|>)/gi) || []).length;

    if (!title) errors.push(`${rel}: Title fehlt.`);
    else {
      if (title.length < 20 || title.length > 65) errors.push(`${rel}: Title hat ${title.length} Zeichen (Ziel 20–65).`);
      if (titles.has(title)) errors.push(`${rel}: doppelter Title wie ${titles.get(title)}.`);
      else titles.set(title, rel);
    }
    if (!description) errors.push(`${rel}: Meta-Description fehlt.`);
    else {
      if (description.length < 70 || description.length > 165) errors.push(`${rel}: Meta-Description hat ${description.length} Zeichen (Ziel 70–165).`);
      if (descriptions.has(description)) errors.push(`${rel}: doppelte Meta-Description wie ${descriptions.get(description)}.`);
      else descriptions.set(description, rel);
    }
    if (!canonical) errors.push(`${rel}: Canonical fehlt.`);
    else if (normalCanonical(canonical) !== normalCanonical(pageUrl)) errors.push(`${rel}: Canonical stimmt nicht mit der Sitemap überein (${canonical}).`);
    if (!lang) errors.push(`${rel}: Seitensprache fehlt.`);
    if (h1Count !== 1) errors.push(`${rel}: erwartet genau eine H1, gefunden ${h1Count}.`);
    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(source)) errors.push(`${rel}: Sitemap-Seite ist auf noindex gesetzt.`);

    for (const match of source.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { JSON.parse(match[1]); }
      catch (error) { errors.push(`${rel}: ungültiges JSON-LD (${error.message}).`); }
    }

    for (const match of source.matchAll(/<img\s+([^>]+)>/gi)) {
      const attrs = match[1];
      if (!/\balt=["'][^"']*["']/i.test(attrs)) errors.push(`${rel}: Bild ohne alt-Attribut.`);
      if (!/\bwidth=["']\d+["']/i.test(attrs) || !/\bheight=["']\d+["']/i.test(attrs)) errors.push(`${rel}: Bild ohne feste Breite/Höhe (Layout-Verschiebung).`);
    }

    for (const match of source.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)) {
      const href = match[1].trim();
      if (!href || href.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(href)) continue;
      let target;
      try { target = localPath(new URL(href, pageUrl).href); }
      catch { errors.push(`${rel}: ungültiger Link ${href}.`); continue; }
      if (!target) continue;
      const ext = path.extname(target).toLowerCase();
      if ((!ext || ext === ".html") && !fs.existsSync(target)) errors.push(`${rel}: interner Link führt ins Leere (${href}).`);
    }

    if (rel.startsWith("produkte/") && rel !== "produkte/index.html") {
      const schemas = [...source.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
        .map((match) => { try { return JSON.parse(match[1]); } catch { return null; } })
        .filter(Boolean);
      const product = schemas.find((schema) => schema["@type"] === "Product");
      if (!product) errors.push(`${rel}: Product-Schema fehlt.`);
      else if (!product.name || !product.brand || !product.offers || ![].concat(product.offers).length) errors.push(`${rel}: Product-Schema ist unvollständig.`);
    }
  }

  if (errors.length) {
    console.error(`SEO-Prüfung fehlgeschlagen (${errors.length}):\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`SEO-Prüfung erfolgreich: ${urls.length} indexierbare Seiten, eindeutige Metadaten, gültige Canonicals, Schemas und interne Links.`);
}

main();

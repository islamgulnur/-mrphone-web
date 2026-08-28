#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { aktiveGruppen, bildDateien, findeBild, slugify } = require("./build-produktseiten");

const ROOT = path.resolve(__dirname, "..");
const BESTAND = path.join(ROOT, "bestand.json");
const BILDER_DIR = path.join(ROOT, "images", "produkte");
const QUELLEN_DATEI = path.join(BILDER_DIR, "quellen.json");
const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const ERLAUBTE_LIZENZEN = new Set(["by", "by-sa", "cc0", "pdm"]);
const ERLAUBTE_BILD_HOSTS = new Set(["upload.wikimedia.org"]);
const MODELL_ZUSAETZE = new Set(["pro", "max", "plus", "ultra", "mini", "air", "fe", "edge", "fold", "flip", "note", "lite", "5g", "4g", "lte"]);
const ZUBEHOER_WOERTER = new Set(["case", "cover", "hulle", "huelle", "charger", "ladegerat", "ladegeraet", "box", "dummy", "mockup", "wallpaper", "repair", "screen", "protector"]);
const MAX_BILD_BYTES = 12 * 1024 * 1024;
const MIN_KANTE = 450;
const ERNEUT_PRUEFEN_MS = 7 * 24 * 60 * 60 * 1000;

function normalisiere(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/\+/g, " plus ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function token(value) {
  return normalisiere(value).split(" ").filter(Boolean);
}

function sichereBildUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ERLAUBTE_BILD_HOSTS.has(url.hostname);
  } catch (_) {
    return false;
  }
}

function trefferScore(gruppe, treffer) {
  const lizenz = String(treffer?.license || "").toLowerCase();
  if (!ERLAUBTE_LIZENZEN.has(lizenz) || treffer?.source !== "wikimedia" || treffer?.mature === true || treffer?.removed_from_source === true || !sichereBildUrl(treffer?.url)) return 0;

  const roherTitel = String(treffer.title || "").trim();
  const ersterAsciiIndex = roherTitel.search(/[A-Za-z0-9]/);
  if (ersterAsciiIndex < 0 || roherTitel.slice(0, ersterAsciiIndex).trim()) return 0;
  const titel = normalisiere(treffer.title);
  const vollerName = normalisiere(`${gruppe.marke} ${gruppe.modell}`);
  const modell = normalisiere(gruppe.modell);
  if (!titel || !modell) return 0;

  const zielTokens = new Set(token(`${gruppe.marke} ${gruppe.modell}`));
  const titelTokens = new Set(token(treffer.title));
  for (const wort of ZUBEHOER_WOERTER) if (titelTokens.has(wort)) return 0;
  for (const zusatz of MODELL_ZUSAETZE) {
    if (titelTokens.has(zusatz) && !zielTokens.has(zusatz)) return 0;
  }

  if (titel === vollerName) return 100;
  if (titel === modell) return 96;
  if (titel.startsWith(`${vollerName} `)) return 88;
  if (titel.startsWith(`${modell} `)) return 84;
  return 0;
}

function sortiereTreffer(gruppe, ergebnisse) {
  return (Array.isArray(ergebnisse) ? ergebnisse : [])
    .map((treffer) => ({ treffer, score: trefferScore(gruppe, treffer) }))
    .filter((item) => item.score >= 84)
    .sort((a, b) => b.score - a.score || String(a.treffer.title).localeCompare(String(b.treffer.title), "de"))
    .map((item) => item.treffer);
}

function waehleTreffer(gruppe, ergebnisse) {
  return sortiereTreffer(gruppe, ergebnisse)[0] || null;
}

function optionZahl(name, fallback) {
  const prefix = `--${name}=`;
  const wert = process.argv.find((arg) => arg.startsWith(prefix));
  if (!wert) return fallback;
  const zahl = Number(wert.slice(prefix.length));
  return Number.isInteger(zahl) && zahl > 0 ? zahl : fallback;
}

function ladeQuellen() {
  if (!fs.existsSync(QUELLEN_DATEI)) return { version: 1, bilder: {}, pruefungen: {} };
  const daten = JSON.parse(fs.readFileSync(QUELLEN_DATEI, "utf8"));
  if (!daten || daten.version !== 1 || typeof daten.bilder !== "object" || typeof daten.pruefungen !== "object") {
    throw new Error("images/produkte/quellen.json hat ein ungültiges Format.");
  }
  return daten;
}

function speichereQuellen(daten) {
  fs.mkdirSync(BILDER_DIR, { recursive: true });
  const temp = `${QUELLEN_DATEI}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(daten, null, 2)}\n`, "utf8");
  fs.renameSync(temp, QUELLEN_DATEI);
}

function istKuerzlichGeprueft(pruefung) {
  const zeit = Date.parse(pruefung?.geprueftAm || "");
  const pause = pruefung?.status === "fehler" ? 24 * 60 * 60 * 1000 : ERNEUT_PRUEFEN_MS;
  return Number.isFinite(zeit) && Date.now() - zeit < pause;
}

async function suche(gruppe, fetchFn = fetch) {
  const url = new URL(OPENVERSE_API);
  url.searchParams.set("q", `${gruppe.marke} ${gruppe.modell}`);
  url.searchParams.set("page_size", "20");
  url.searchParams.set("license_type", "commercial");
  url.searchParams.set("source", "wikimedia");
  const antwort = await fetchFn(url, { headers: { Accept: "application/json", "User-Agent": "MrPhone-Produktbilder/1.0" }, signal: AbortSignal.timeout(15000) });
  if (!antwort.ok) throw new Error(`Openverse HTTP ${antwort.status}`);
  return sortiereTreffer(gruppe, (await antwort.json()).results);
}

async function ladeBild(treffer, ziel, fetchFn = fetch) {
  const sharp = require("sharp");
  if (!sichereBildUrl(treffer.url)) throw new Error("Nicht erlaubte Bildquelle");
  let antwort;
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    antwort = await fetchFn(treffer.url, { headers: { "User-Agent": "MrPhone-Produktbilder/1.0" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    if (antwort.status !== 429 && antwort.status < 500) break;
    if (versuch < 3) await new Promise((resolve) => setTimeout(resolve, versuch * 1500));
  }
  if (!antwort.ok) throw new Error(`Bilddownload HTTP ${antwort.status}`);
  const contentType = String(antwort.headers.get("content-type") || "").toLowerCase();
  if (!/^image\/(?:jpeg|png|webp)$/.test(contentType)) throw new Error(`Ungeeigneter Bildtyp: ${contentType || "unbekannt"}`);
  const laenge = Number(antwort.headers.get("content-length"));
  if (laenge > MAX_BILD_BYTES) throw new Error("Bild ist größer als 12 MB");
  const buffer = Buffer.from(await antwort.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BILD_BYTES) throw new Error("Bildgröße ist ungültig");
  const metadaten = await sharp(buffer).metadata();
  if (!(metadaten.width >= MIN_KANTE && metadaten.height >= MIN_KANTE)) throw new Error(`Bild ist zu klein (${metadaten.width || 0}×${metadaten.height || 0})`);

  const temp = `${ziel}.tmp`;
  await sharp(buffer)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, effort: 5 })
    .toFile(temp);
  fs.renameSync(temp, ziel);
}

function quellEintrag(gruppe, treffer, dateiname) {
  return {
    modell: `${gruppe.marke} ${gruppe.modell}`,
    datei: `images/produkte/${dateiname}`,
    quelle: "Openverse / Wikimedia Commons",
    titel: String(treffer.title || ""),
    urheber: String(treffer.creator || "Wikimedia Commons"),
    urheberUrl: String(treffer.creator_url || ""),
    lizenz: String(treffer.license || "").toUpperCase(),
    lizenzUrl: String(treffer.license_url || ""),
    quellseite: String(treffer.foreign_landing_url || ""),
    gespeichertAm: new Date().toISOString(),
  };
}

async function main() {
  const trocken = process.argv.includes("--dry-run");
  const erzwingen = process.argv.includes("--force");
  const nurArg = process.argv.find((arg) => arg.startsWith("--only="));
  const nur = nurArg ? slugify(nurArg.slice(7)) : "";
  const maxDownloads = optionZahl("limit", 12);
  const maxAnfragen = optionZahl("max-queries", 25);
  const bestand = JSON.parse(fs.readFileSync(BESTAND, "utf8"));
  const gruppen = aktiveGruppen(bestand).filter((gruppe) => !nur || gruppe.slug === nur);
  const quellen = ladeQuellen();
  let bilder = bildDateien();
  let anfragen = 0;
  let gespeichert = 0;
  let ohneTreffer = 0;
  let fehler = 0;

  for (const gruppe of gruppen) {
    if (findeBild(gruppe, bilder)) continue;
    if (!erzwingen && istKuerzlichGeprueft(quellen.pruefungen[gruppe.slug])) continue;
    if (anfragen >= maxAnfragen || gespeichert >= maxDownloads) break;
    anfragen += 1;
    const zeit = new Date().toISOString();
    try {
      const trefferListe = await suche(gruppe);
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (!trefferListe.length) {
        ohneTreffer += 1;
        console.log(`Kein sicherer Bildtreffer: ${gruppe.marke} ${gruppe.modell}`);
        if (!trocken) {
          quellen.pruefungen[gruppe.slug] = { status: "kein-sicherer-treffer", geprueftAm: zeit };
          speichereQuellen(quellen);
        }
        continue;
      }
      if (trocken) {
        console.log(`Sicherer Treffer: ${gruppe.marke} ${gruppe.modell} <- ${trefferListe[0].title}`);
        continue;
      }
      const dateiname = `${gruppe.slug}.webp`;
      fs.mkdirSync(BILDER_DIR, { recursive: true });
      let treffer = null;
      let letzterFehler = null;
      for (const kandidat of trefferListe) {
        try {
          console.log(`Sicherer Treffer: ${gruppe.marke} ${gruppe.modell} <- ${kandidat.title}`);
          await ladeBild(kandidat, path.join(BILDER_DIR, dateiname));
          treffer = kandidat;
          break;
        } catch (error) {
          letzterFehler = error;
          console.warn(`Bildquelle übersprungen: ${kandidat.title} (${error.message})`);
        }
      }
      if (!treffer) throw letzterFehler || new Error("Kein Bild konnte geladen werden");
      quellen.bilder[gruppe.slug] = quellEintrag(gruppe, treffer, dateiname);
      quellen.pruefungen[gruppe.slug] = { status: "bild-gespeichert", geprueftAm: zeit };
      speichereQuellen(quellen);
      bilder = bildDateien();
      gespeichert += 1;
    } catch (error) {
      fehler += 1;
      console.error(`Bildsuche fehlgeschlagen für ${gruppe.marke} ${gruppe.modell}: ${error.message}`);
      if (!trocken) {
        quellen.pruefungen[gruppe.slug] = { status: "fehler", geprueftAm: zeit };
        speichereQuellen(quellen);
      }
    }
  }

  console.log(`Produktbilder: ${anfragen} geprüft, ${gespeichert} gespeichert, ${ohneTreffer} ohne sicheren Treffer, ${fehler} Fehler.`);
  if (anfragen > 0 && fehler === anfragen) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { normalisiere, sichereBildUrl, sortiereTreffer, trefferScore, waehleTreffer };

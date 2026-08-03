/**
 * Baut Header/Footer aller Seiten aus templates/partials/*.html - kein separates
 * Body-Layout, es wird nur der bestehende <header>...</header>- bzw.
 * <footer>...</footer>-Block INNERHALB jeder Seite ersetzt (In-Place-Regeneration).
 * Der restliche Seiteninhalt bleibt unangetastet.
 *
 * Varianten (durch Verzeichnis + Vorhandensein einer en/-Übersetzung erkannt):
 *   root-main     - Root-Seiten mit englischer Übersetzung (Sprachumschalter im Header,
 *                   "Google Bewertung"-Link im Footer)
 *   root-category - Root-Seiten ohne englische Übersetzung (Kategorie-Seiten)
 *   en            - Seiten unter en/
 *   ratgeber      - Seiten unter ratgeber/ (statisch, "Ratgeber" immer aktiv markiert)
 *
 * aria-current="page" auf dem aktiven Nav-Link wird automatisch anhand des Datei-
 * namens gesetzt - die Partials selbst enthalten dafür keine Seiten-spezifischen Marker.
 *
 * Aufruf:
 *   node scripts/build-templates.js              baut alle Seiten, schreibt Änderungen
 *   node scripts/build-templates.js --check       zeigt nur, was sich ändern würde (Exit 1 bei Drift)
 *   node scripts/build-templates.js --only=index.html[,kontakt.html]   nur bestimmte Dateien
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PARTIALS_DIR = path.join(ROOT, "templates", "partials");

function ladePartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), "utf8");
}

const PARTIALS = {
  "root-main": { header: ladePartial("header.root-main.html"), footer: ladePartial("footer.root-main.html") },
  "root-category": { header: ladePartial("header.root-category.html"), footer: ladePartial("footer.root-category.html") },
  en: { header: ladePartial("header.en.html"), footer: ladePartial("footer.en.html") },
  ratgeber: { header: ladePartial("header.ratgeber.html"), footer: ladePartial("footer.ratgeber.html") },
};

function findeSeiten() {
  const seiten = [];
  for (const datei of fs.readdirSync(ROOT)) {
    if (datei.endsWith(".html")) seiten.push({ dir: ".", basename: datei, relPath: datei });
  }
  for (const unterordner of ["en", "ratgeber"]) {
    const voll = path.join(ROOT, unterordner);
    if (!fs.existsSync(voll)) continue;
    for (const datei of fs.readdirSync(voll)) {
      if (datei.endsWith(".html")) {
        seiten.push({ dir: unterordner, basename: datei, relPath: path.join(unterordner, datei) });
      }
    }
  }
  return seiten;
}

function ermittleVariante(seite) {
  if (seite.dir === "en") return "en";
  if (seite.dir === "ratgeber") return "ratgeber";
  const hatUebersetzung = fs.existsSync(path.join(ROOT, "en", seite.basename));
  return hatUebersetzung ? "root-main" : "root-category";
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Setzt aria-current="page" nur auf den Nav-Link, dessen href exakt dem Dateinamen
// der aktuellen Seite entspricht - beschränkt auf den <nav class="main-nav">-Block,
// damit der Logo-Link (ebenfalls href="index.html") nicht mitgetroffen wird.
function setzeAktivenNavLink(headerHtml, basename) {
  const navStart = headerHtml.indexOf('<nav class="main-nav"');
  const navEnde = headerHtml.indexOf("</nav>", navStart) + "</nav>".length;
  if (navStart === -1 || navEnde === -1) return headerHtml;

  const vorNav = headerHtml.slice(0, navStart);
  let navBlock = headerHtml.slice(navStart, navEnde);
  const nachNav = headerHtml.slice(navEnde);

  const hrefMuster = new RegExp(`href="${escapeRegExp(basename)}"`);
  navBlock = navBlock.replace(hrefMuster, `href="${basename}" aria-current="page"`);

  return vorNav + navBlock + nachNav;
}

function baueHeader(variante, seite) {
  let html = PARTIALS[variante].header;
  if (variante === "root-main") {
    html = html.replace(/\{\{EN_PATH\}\}/g, `/en/${seite.basename}`);
  } else if (variante === "en") {
    html = html.replace(/\{\{DE_PATH\}\}/g, `/${seite.basename}`);
  }
  if (variante !== "ratgeber") {
    html = setzeAktivenNavLink(html, seite.basename);
  }
  return html.trim();
}

function baueFooter(variante) {
  return PARTIALS[variante].footer.trim();
}

function ersetzeBlock(volltext, tagName, neuerBlock) {
  const startMarker = `<${tagName}`;
  const endMarker = `</${tagName}>`;
  const start = volltext.indexOf(startMarker);
  if (start === -1) return null;
  const endeTagStart = volltext.indexOf(endMarker, start);
  if (endeTagStart === -1) return null;
  const ende = endeTagStart + endMarker.length;

  // Partials sind LF-only (Write-Tool). Zeilenende der Zieldatei übernehmen, sonst
  // entsteht eine Datei mit gemischten Zeilenenden und jede Zeile im Block zeigt sich
  // im Diff als "geändert", obwohl nur \r\n vs. \n abweicht.
  const zielNutztCRLF = volltext.includes("\r\n");
  const block = zielNutztCRLF ? neuerBlock.replace(/\n/g, "\r\n") : neuerBlock;

  return volltext.slice(0, start) + block + volltext.slice(ende);
}

function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes("--check");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const onlyListe = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

  let seiten = findeSeiten();
  if (onlyListe) {
    // Nur relPath vergleichen (z.B. "index.html" vs. "en/index.html") - der reine
    // Dateiname ist nicht eindeutig, da index.html in drei Verzeichnissen existiert.
    const normalisiert = onlyListe.map((s) => s.split(/[\\/]/).join(path.sep));
    seiten = seiten.filter((s) => normalisiert.includes(s.relPath));
  }

  const geaendert = [];
  const fehlend = [];

  for (const seite of seiten) {
    const variante = ermittleVariante(seite);
    const vollpfad = path.join(ROOT, seite.relPath);
    const original = fs.readFileSync(vollpfad, "utf8");

    let neu = ersetzeBlock(original, "header", baueHeader(variante, seite));
    if (neu === null) {
      fehlend.push(seite.relPath);
      continue;
    }
    neu = ersetzeBlock(neu, "footer", baueFooter(variante));
    if (neu === null) {
      fehlend.push(seite.relPath);
      continue;
    }

    if (neu !== original) {
      geaendert.push(seite.relPath);
      if (!checkMode) fs.writeFileSync(vollpfad, neu, "utf8");
    }
  }

  if (fehlend.length) {
    console.error(`Kein <header>/<footer>-Block gefunden (übersprungen): ${fehlend.join(", ")}`);
  }

  if (checkMode) {
    if (geaendert.length) {
      console.log(`Abweichend von den Partials (${geaendert.length}): ${geaendert.join(", ")}`);
      process.exit(1);
    }
    console.log(`Alle ${seiten.length} geprüften Seiten stimmen mit den Partials überein.`);
    return;
  }

  console.log(`${geaendert.length} von ${seiten.length} Seiten aktualisiert.`);
  if (geaendert.length) console.log(geaendert.join("\n"));
}

main();

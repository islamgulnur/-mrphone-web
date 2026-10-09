/* SEO-Baseline-Extraktor für das Scroll-Story-Redesign (redesign/scroll-story).
   Liest die angegebenen statischen HTML-Seiten, extrahiert alles SEO-relevante
   und schreibt es nach seo-baseline.json (oder --out <datei>). Ohne --compare:
   reine Baseline-Erfassung. Mit --compare <baseline.json>: vergleicht die aktuell
   extrahierten Seiten gegen die Baseline und meldet fehlende/geänderte Inhalte
   (Exit-Code 1 bei Abweichung), für den SEO-Abgleich nach dem Redesign. */
"use strict";

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const ROOT = path.join(__dirname, "..");
const DEFAULT_TARGETS = ["index.html", "en/index.html"];

function parseArgs(argv) {
  const args = { targets: [], out: "seo-baseline.json", compare: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--compare") args.compare = argv[++i];
    else if (!a.startsWith("--")) args.targets.push(a);
  }
  if (!args.targets.length) args.targets = DEFAULT_TARGETS;
  return args;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function extractPage(relPath) {
  const absPath = path.join(ROOT, relPath);
  const html = fs.readFileSync(absPath, "utf8");
  const $ = cheerio.load(html);

  // ---------- Meta ----------
  const title = $("title").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") || null;
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robots = $('meta[name="robots"]').attr("content") || null;

  const hreflang = [];
  $('link[rel="alternate"][hreflang]').each((i, el) => {
    hreflang.push({ hreflang: $(el).attr("hreflang"), href: $(el).attr("href") });
  });

  const openGraph = {};
  $('meta[property^="og:"]').each((i, el) => {
    openGraph[$(el).attr("property")] = $(el).attr("content");
  });

  const twitter = {};
  $('meta[name^="twitter:"]').each((i, el) => {
    twitter[$(el).attr("name")] = $(el).attr("content");
  });

  // ---------- Überschriften (Dokumentreihenfolge) ----------
  const headings = [];
  $("body")
    .find("h1, h2, h3, h4, h5, h6")
    .each((i, el) => {
      headings.push({ tag: el.tagName.toLowerCase(), text: normalizeWhitespace($(el).text()) });
    });

  // ---------- Sichtbarer Text (ohne Script/Style/Noscript) + Wortanzahl ----------
  const $bodyClone = $("body").clone();
  $bodyClone.find("script, style, noscript").remove();
  const visibleText = normalizeWhitespace($bodyClone.text());
  const wordCount = visibleText.length ? visibleText.split(" ").length : 0;

  // ---------- Links ----------
  const links = [];
  $("a[href]").each((i, el) => {
    const href = $(el).attr("href");
    const text = normalizeWhitespace($(el).text());
    let type = "internal";
    if (/^tel:/i.test(href)) type = "tel";
    else if (/^https:\/\/wa\.me\//i.test(href)) type = "whatsapp";
    else if (/google\.[^/]+\/maps|maps\.app\.goo\.gl/i.test(href)) type = "maps";
    else if (/^https:\/\/g\.page\//i.test(href)) type = "google-review";
    else if (/^https?:\/\//i.test(href) && !href.includes("mrphone-frankfurt.de")) type = "external";
    else if (/^#/.test(href)) type = "anchor";
    links.push({ href, text, type, rel: $(el).attr("rel") || null, target: $(el).attr("target") || null });
  });

  // ---------- Bilder ----------
  const images = [];
  $("img").each((i, el) => {
    images.push({
      src: $(el).attr("src"),
      alt: $(el).attr("alt") ?? null,
      altMissing: !$(el).attr("alt") && $(el).attr("alt") !== "",
      width: $(el).attr("width") || null,
      height: $(el).attr("height") || null,
      loading: $(el).attr("loading") || null,
    });
  });

  // ---------- JSON-LD ----------
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    const raw = $(el).contents().text();
    const entry = { id: $(el).attr("id") || null, raw };
    try {
      entry.parsed = JSON.parse(raw);
      entry.valid = true;
    } catch (err) {
      entry.parsed = null;
      entry.valid = false;
      entry.error = err.message;
    }
    jsonLd.push(entry);
  });

  // ---------- FAQ (details.faq-item > summary + .faq-body) ----------
  const faq = [];
  $(".faq-item").each((i, el) => {
    const question = normalizeWhitespace($(el).find("summary").first().text());
    const answer = normalizeWhitespace($(el).find(".faq-body").first().text());
    faq.push({ question, answer });
  });

  // ---------- Textabsätze (für 1:1-Texterhalt, reihenfolge-unabhängig) ----------
  const paragraphs = [];
  $("p").each((i, el) => {
    const text = normalizeWhitespace($(el).text());
    if (text) paragraphs.push(text);
  });

  return {
    path: relPath,
    title,
    metaDescription,
    canonical,
    robots,
    hreflang,
    openGraph,
    twitter,
    headings,
    wordCount,
    visibleText,
    paragraphs,
    links,
    images,
    jsonLd,
    faq,
  };
}

function compareHeadings(base, cur) {
  const diffs = [];
  const max = Math.max(base.length, cur.length);
  for (let i = 0; i < max; i++) {
    const b = base[i];
    const c = cur[i];
    if (!b) diffs.push({ index: i, type: "added", current: c });
    else if (!c) diffs.push({ index: i, type: "missing", baseline: b });
    else if (b.tag !== c.tag || b.text !== c.text) diffs.push({ index: i, type: "changed", baseline: b, current: c });
  }
  return diffs;
}

function keyForLink(l) {
  return l.href + "|" + l.text;
}

function compareLinks(base, cur) {
  const curKeys = new Set(cur.map(keyForLink));
  const baseKeys = new Set(base.map(keyForLink));
  const missing = base.filter((l) => !curKeys.has(keyForLink(l)));
  const added = cur.filter((l) => !baseKeys.has(keyForLink(l)));
  return { missing, added };
}

function keyForImg(img) {
  return img.src + "|" + (img.alt || "");
}

function compareImages(base, cur) {
  const curKeys = new Set(cur.map(keyForImg));
  const baseKeys = new Set(base.map(keyForImg));
  const missing = base.filter((img) => !curKeys.has(keyForImg(img)));
  const added = cur.filter((img) => !baseKeys.has(keyForImg(img)));
  return { missing, added };
}

function compareParagraphs(base, cur) {
  const curSet = new Set(cur);
  const baseSet = new Set(base);
  const missing = base.filter((p) => !curSet.has(p));
  const added = cur.filter((p) => !baseSet.has(p));
  return { missing, added };
}

function comparePage(base, cur) {
  const issues = [];
  if (base.title !== cur.title) issues.push({ field: "title", baseline: base.title, current: cur.title });
  if (base.metaDescription !== cur.metaDescription)
    issues.push({ field: "metaDescription", baseline: base.metaDescription, current: cur.metaDescription });
  if (base.canonical !== cur.canonical) issues.push({ field: "canonical", baseline: base.canonical, current: cur.canonical });
  if (base.robots !== cur.robots) issues.push({ field: "robots", baseline: base.robots, current: cur.robots });
  if (JSON.stringify(base.hreflang) !== JSON.stringify(cur.hreflang))
    issues.push({ field: "hreflang", baseline: base.hreflang, current: cur.hreflang });
  if (JSON.stringify(base.openGraph) !== JSON.stringify(cur.openGraph))
    issues.push({ field: "openGraph", baseline: base.openGraph, current: cur.openGraph });

  const headingDiffs = compareHeadings(base.headings, cur.headings);
  const linkDiff = compareLinks(base.links, cur.links);
  const imageDiff = compareImages(base.images, cur.images);
  const paragraphDiff = compareParagraphs(base.paragraphs, cur.paragraphs);

  const faqMissing = base.faq.filter(
    (f) => !cur.faq.some((c) => c.question === f.question && c.answer === f.answer)
  );
  const faqAdded = cur.faq.filter(
    (c) => !base.faq.some((f) => f.question === c.question && f.answer === c.answer)
  );

  const jsonLdMissing = base.jsonLd.filter(
    (b) => !cur.jsonLd.some((c) => JSON.stringify(c.parsed) === JSON.stringify(b.parsed))
  );
  const jsonLdAdded = cur.jsonLd.filter(
    (c) => !base.jsonLd.some((b) => JSON.stringify(b.parsed) === JSON.stringify(c.parsed))
  );

  return {
    path: base.path,
    metaIssues: issues, // Titel/Description/Canonical/robots/hreflang/OG: jede Abweichung ist Fehler, kein "hinzugefügt"-Fall
    headingDiffs, // jede Abweichung (auch neu/geändert) ist Fehler: Heading-Liste muss am Ende identisch sein
    linkDiff, // missing = Fehler, added = nur auflisten
    imageDiff, // missing = Fehler, added = nur auflisten
    paragraphDiff, // missing = Fehler, added = nur auflisten
    faqMissing,
    faqAdded,
    jsonLdMissing,
    jsonLdAdded,
    wordCountBaseline: base.wordCount,
    wordCountCurrent: cur.wordCount,
    ok:
      !issues.length &&
      !headingDiffs.length &&
      !linkDiff.missing.length &&
      !imageDiff.missing.length &&
      !paragraphDiff.missing.length &&
      !faqMissing.length &&
      !jsonLdMissing.length,
  };
}

function mdEscape(text) {
  return String(text == null ? "" : text).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderMarkdownReport(results, allOk) {
  const lines = [];
  lines.push("# SEO-Vergleich: redesign/scroll-story gegen seo-baseline.json");
  lines.push("");
  lines.push("Generiert: " + new Date().toISOString());
  lines.push("");
  lines.push("**Gesamtergebnis: " + (allOk ? "OK – nichts verloren" : "ABWEICHUNG – etwas fehlt oder wurde verändert") + "**");
  lines.push("");

  results.forEach((r) => {
    lines.push("## " + r.path + " — " + (r.ok ? "✅ OK" : "❌ ABWEICHUNG"));
    lines.push("");

    if (r.error) {
      lines.push("Fehler: " + r.error);
      lines.push("");
      return;
    }

    lines.push("### ENTFERNT / GEÄNDERT (muss behoben werden)");
    lines.push("");
    let hadRemoved = false;

    if (r.metaIssues.length) {
      hadRemoved = true;
      lines.push("**Meta-Tags geändert:**");
      r.metaIssues.forEach((i) => lines.push("- `" + i.field + "`: war `" + mdEscape(JSON.stringify(i.baseline)) + "` → jetzt `" + mdEscape(JSON.stringify(i.current)) + "`"));
      lines.push("");
    }
    if (r.headingDiffs.length) {
      hadRemoved = true;
      lines.push("**Überschriften-Liste weicht ab (muss identisch sein):**");
      r.headingDiffs.forEach((d) => {
        if (d.type === "missing") lines.push("- Fehlt: `" + d.baseline.tag.toUpperCase() + "` \"" + mdEscape(d.baseline.text) + "\"");
        else if (d.type === "added") lines.push("- Neu/unerwartet: `" + d.current.tag.toUpperCase() + "` \"" + mdEscape(d.current.text) + "\"");
        else lines.push("- Geändert an Position " + d.index + ": `" + d.baseline.tag.toUpperCase() + "` \"" + mdEscape(d.baseline.text) + "\" → `" + d.current.tag.toUpperCase() + "` \"" + mdEscape(d.current.text) + "\"");
      });
      lines.push("");
    }
    if (r.linkDiff.missing.length) {
      hadRemoved = true;
      lines.push("**Fehlende Links:**");
      r.linkDiff.missing.forEach((l) => lines.push("- `" + l.href + "` (\"" + mdEscape(l.text) + "\", " + l.type + ")"));
      lines.push("");
    }
    if (r.imageDiff.missing.length) {
      hadRemoved = true;
      lines.push("**Fehlende Bilder:**");
      r.imageDiff.missing.forEach((img) => lines.push("- `" + img.src + "` (Alt: \"" + mdEscape(img.alt) + "\")"));
      lines.push("");
    }
    if (r.paragraphDiff.missing.length) {
      hadRemoved = true;
      lines.push("**Fehlende Textabsätze:**");
      r.paragraphDiff.missing.forEach((p) => lines.push("- \"" + mdEscape(p) + "\""));
      lines.push("");
    }
    if (r.faqMissing.length) {
      hadRemoved = true;
      lines.push("**Fehlende FAQ-Einträge:**");
      r.faqMissing.forEach((f) => lines.push("- F: \"" + mdEscape(f.question) + "\" / A: \"" + mdEscape(f.answer) + "\""));
      lines.push("");
    }
    if (r.jsonLdMissing.length) {
      hadRemoved = true;
      lines.push("**Fehlende JSON-LD-Blöcke:** " + r.jsonLdMissing.length);
      lines.push("");
    }
    if (!hadRemoved) lines.push("Nichts entfernt oder geändert.\n");

    lines.push("### HINZUGEFÜGT (nur zur Info, kein Fehler)");
    lines.push("");
    let hadAdded = false;
    if (r.linkDiff.added.length) {
      hadAdded = true;
      lines.push("**Neue Links:**");
      r.linkDiff.added.forEach((l) => lines.push("- `" + l.href + "` (\"" + mdEscape(l.text) + "\")"));
      lines.push("");
    }
    if (r.imageDiff.added.length) {
      hadAdded = true;
      lines.push("**Neue Bilder:**");
      r.imageDiff.added.forEach((img) => lines.push("- `" + img.src + "`"));
      lines.push("");
    }
    if (r.paragraphDiff.added.length) {
      hadAdded = true;
      lines.push("**Neue Textabsätze (z. B. Slogans, Badges):**");
      r.paragraphDiff.added.forEach((p) => lines.push("- \"" + mdEscape(p) + "\""));
      lines.push("");
    }
    if (r.faqAdded.length) {
      hadAdded = true;
      lines.push("**Neue FAQ-Einträge:** " + r.faqAdded.length);
      lines.push("");
    }
    if (!hadAdded) lines.push("Nichts Neues hinzugefügt.\n");

    lines.push("Wortanzahl: " + r.wordCountBaseline + " → " + r.wordCountCurrent);
    lines.push("");
  });

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pages = args.targets.map(extractPage);

  if (args.compare) {
    const baselineRaw = fs.readFileSync(path.join(ROOT, args.compare), "utf8");
    const baseline = JSON.parse(baselineRaw);
    const results = baseline.pages.map((basePage) => {
      const curPage = pages.find((p) => p.path === basePage.path);
      if (!curPage) return { path: basePage.path, ok: false, error: "Seite nicht gefunden in aktuellem Lauf" };
      return comparePage(basePage, curPage);
    });

    const allOk = results.every((r) => r.ok);
    const outPath = path.join(ROOT, "seo-vergleich.json");
    fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), allOk, results }, null, 2));

    const mdPath = path.join(ROOT, "seo-vergleich.md");
    fs.writeFileSync(mdPath, renderMarkdownReport(results, allOk));

    results.forEach((r) => {
      console.log("\n=== " + r.path + " === " + (r.ok ? "OK" : "ABWEICHUNG"));
      if (r.metaIssues && r.metaIssues.length) console.log("  Meta-Abweichungen:", r.metaIssues.length);
      if (r.headingDiffs && r.headingDiffs.length) console.log("  Heading-Abweichungen:", r.headingDiffs.length);
      if (r.linkDiff && r.linkDiff.missing.length) console.log("  Fehlende Links:", r.linkDiff.missing.length);
      if (r.imageDiff && r.imageDiff.missing.length) console.log("  Fehlende Bilder:", r.imageDiff.missing.length);
      if (r.paragraphDiff && r.paragraphDiff.missing.length) console.log("  Fehlende Textabsätze:", r.paragraphDiff.missing.length);
      if (r.faqMissing && r.faqMissing.length) console.log("  Fehlende FAQ-Einträge:", r.faqMissing.length);
      if (r.jsonLdMissing && r.jsonLdMissing.length) console.log("  Fehlende JSON-LD-Blöcke:", r.jsonLdMissing.length);
    });

    console.log("\nDetails: " + path.relative(ROOT, outPath) + " / " + path.relative(ROOT, mdPath));
    if (!allOk) {
      console.error("\nSEO-Vergleich fehlgeschlagen: Inhalte fehlen oder wurden verändert.");
      process.exit(1);
    }
    console.log("\nSEO-Vergleich erfolgreich: alles aus der Baseline ist noch vorhanden.");
    return;
  }

  const outPath = path.join(ROOT, args.out);
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), pages }, null, 2));
  console.log("Baseline geschrieben: " + path.relative(ROOT, outPath));
  pages.forEach((p) => {
    console.log(
      "  " +
        p.path +
        ": " +
        p.headings.length +
        " Überschriften, " +
        p.links.length +
        " Links, " +
        p.images.length +
        " Bilder, " +
        p.faq.length +
        " FAQ, " +
        p.jsonLd.length +
        " JSON-LD, " +
        p.wordCount +
        " Wörter"
    );
  });
}

main();

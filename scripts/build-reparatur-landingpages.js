#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PREISE = path.join(ROOT, "reparatur-preise.json");
const BASE_URL = "https://mrphone-frankfurt.de";
const MARKER = "<!-- Automatisch aus reparatur-preise.json erstellt: scripts/build-reparatur-landingpages.js -->";

function html(wert) {
  return String(wert ?? "").replace(/[&<>\"]/g, (zeichen) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[zeichen]);
}

function findePreis(preise, name) {
  const treffer = preise.reparaturen.find((eintrag) => eintrag.name === name);
  if (!treffer || !(Number(treffer.abPreis) > 0)) throw new Error(`Reparaturpreis fehlt: ${name}`);
  return Number(treffer.abPreis);
}

function schemaJson(wert) {
  return JSON.stringify(wert).replace(/</g, "\\u003c");
}

function kopf({ titel, beschreibung, slug, serviceName, serviceBeschreibung, faq }) {
  const canonical = `${BASE_URL}/${slug}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: serviceName,
        description: serviceBeschreibung,
        url: canonical,
        areaServed: { "@type": "City", name: "Frankfurt am Main" },
        provider: {
          "@type": "MobilePhoneStore",
          name: "Mr. Phone",
          telephone: "+496995632281",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Zeil 115-117",
            postalCode: "60313",
            addressLocality: "Frankfurt am Main",
            addressCountry: "DE",
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Startseite", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Handy-Reparatur", item: `${BASE_URL}/handy-reparatur-frankfurt.html` },
          { "@type": "ListItem", position: 3, name: serviceName, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((eintrag) => ({
          "@type": "Question",
          name: eintrag.frage,
          acceptedAnswer: { "@type": "Answer", text: eintrag.antwort },
        })),
      },
    ],
  };
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="/images/logo.png"><title>${html(titel)}</title>
<meta name="description" content="${html(beschreibung)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Mr. Phone">
<meta property="og:title" content="${html(titel)}"><meta property="og:description" content="${html(beschreibung)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE_URL}/images/mr-phone-zeil-frankfurt-aussenansicht.jpg"><meta property="og:locale" content="de_DE">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${html(titel)}"><meta name="twitter:description" content="${html(beschreibung)}"><meta name="twitter:image" content="${BASE_URL}/images/mr-phone-zeil-frankfurt-aussenansicht.jpg">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/dark-theme.css">
<script type="application/ld+json">${schemaJson(schema)}</script></head>`;
}

function header() {
  return `<body>${MARKER}<a href="#main" class="skip-link">Zum Inhalt springen</a>
<header class="site-header"><div class="header-inner"><a href="/" class="logo-link" aria-label="Mr. Phone – Startseite"><img src="/images/logo.png" alt="Mr. Phone – Handy Verkauf, Ankauf & Reparatur Frankfurt Zeil" width="800" height="219" class="logo"></a><span class="status-badge status-badge--mobile" data-status-badge aria-live="polite"><span class="status-dot"></span><span class="status-text">Öffnungszeiten werden geladen…</span></span><input type="checkbox" id="nav-toggle" class="nav-toggle"><label for="nav-toggle" class="burger-label" aria-label="Menü öffnen"><span></span><span></span><span></span></label><nav class="main-nav" aria-label="Hauptnavigation"><ul><li><a href="/">Startseite</a></li><li><a href="/handy-reparatur-frankfurt.html" aria-current="page">Handy Reparatur</a></li><li><a href="/handy-ankauf-frankfurt.html">Handy Ankauf</a></li><li><a href="/sortiment.html">Unser Sortiment</a></li><li><a href="/ratgeber/">Ratgeber</a></li><li><a href="/kontakt.html">Kontakt</a></li></ul><div class="nav-mobile-actions"><a href="tel:+496995632281" class="btn btn-outline-dark">069 95632281 anrufen</a><a href="https://wa.me/496995632281" class="btn btn-primary" target="_blank" rel="noopener">Per WhatsApp anfragen</a></div></nav><div class="header-cta"><span class="status-badge status-badge--desktop" data-status-badge aria-live="polite"><span class="status-dot"></span><span class="status-text">Öffnungszeiten werden geladen…</span></span><a href="tel:+496995632281" class="header-phone">069 95632281</a><a href="https://wa.me/496995632281" class="btn btn-primary" target="_blank" rel="noopener">WhatsApp</a></div></div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-col"><img src="/images/logo.png" alt="Mr. Phone Frankfurt" width="800" height="219" class="footer-logo" loading="lazy"><p>Ihr Handy-Fachgeschäft mitten auf der Zeil: Verkauf, Ankauf und Reparatur aus einer Hand.</p></div><div class="footer-col"><h3>Kontakt</h3><ul><li>Zeil 115–117, 60313 Frankfurt am Main</li><li><a href="tel:+496995632281">069 95632281</a></li><li><a href="https://wa.me/496995632281" target="_blank" rel="noopener">WhatsApp schreiben</a></li></ul></div><div class="footer-col"><h3>Navigation</h3><ul><li><a href="/handy-reparatur-frankfurt.html">Handy Reparatur Frankfurt</a></li><li><a href="/handy-ankauf-frankfurt.html">Handy Ankauf Frankfurt</a></li><li><a href="/sortiment.html">Unser Sortiment</a></li><li><a href="/kontakt.html">Kontakt & Öffnungszeiten</a></li></ul></div></div><div class="footer-bottom"><span>© 2026 Mr. Phone GbR, Zeil 115–117, 60313 Frankfurt am Main</span><span><a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a></span></div></div></footer><a href="https://wa.me/496995632281" class="whatsapp-float" target="_blank" rel="noopener" aria-label="Per WhatsApp anfragen">💬</a><script defer src="/main.js"></script><script data-goatcounter="https://mr-phone-frankfurt.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script></body></html>\n`;
}

function faqHtml(faq) {
  return faq.map((eintrag) => `<details class="faq-item"><summary>${html(eintrag.frage)}</summary><div class="faq-body"><p>${html(eintrag.antwort)}</p></div></details>`).join("\n");
}

function seite({ titel, beschreibung, slug, serviceName, serviceBeschreibung, eyebrow, h1, lead, inhalt, faq }) {
  const nachricht = encodeURIComponent(`Hallo, ich interessiere mich für ${serviceName}. Mein Modell ist: `);
  const serviceLinks = [
    ["iphone-display-reparatur-frankfurt.html", "iPhone Display reparieren"],
    ["iphone-akku-wechsel-frankfurt.html", "iPhone Akku wechseln"],
    ["samsung-reparatur-frankfurt.html", "Samsung Handy reparieren"],
    ["handy-ladebuchse-reparatur-frankfurt.html", "Ladebuchse reparieren"],
    ["handy-wasserschaden-reparatur-frankfurt.html", "Handy-Wasserschaden prüfen"],
  ].filter(([ziel]) => ziel !== slug);
  return `${kopf({ titel, beschreibung, slug, serviceName, serviceBeschreibung, faq })}${header()}<main id="main">
<nav class="breadcrumb container" aria-label="Breadcrumb"><a href="/">Startseite</a> / <a href="/handy-reparatur-frankfurt.html">Handy-Reparatur</a> / ${html(serviceName)}</nav>
<section class="bg-dark"><div class="container"><span class="eyebrow" style="color: var(--green);">${html(eyebrow)}</span><h1>${html(h1)}</h1><p class="hero-lead">${html(lead)}</p><div class="cta-row"><a href="https://wa.me/496995632281?text=${nachricht}" class="btn btn-primary" target="_blank" rel="noopener">Preis per WhatsApp anfragen</a><a href="tel:+496995632281" class="btn btn-outline">069 95632281 anrufen</a></div></div></section>
${inhalt}
<section class="bg-light"><div class="container"><div class="section-intro"><span class="eyebrow">Weitere Reparaturen</span><h2>Direkt zur passenden Hilfe</h2></div><div class="service-list">${serviceLinks.map(([ziel, label]) => `<a class="service-card" href="/${ziel}"><h3>${html(label)}</h3><p>Preise, Ablauf und Hinweise ansehen →</p></a>`).join("")}</div></div></section>
<section><div class="container"><div class="section-intro"><span class="eyebrow">Häufige Fragen</span><h2>Gut zu wissen</h2></div>${faqHtml(faq)}</div></section>
<section class="review-cta"><div class="container"><h2>Gerät kurz prüfen lassen</h2><p>Bringen Sie Ihr Gerät auf die Zeil oder nennen Sie uns Modell und Schaden per WhatsApp. Nach der Diagnose erhalten Sie den verbindlichen Preis.</p><div class="cta-row" style="justify-content:center"><a href="https://wa.me/496995632281?text=${nachricht}" class="btn btn-outline-dark" target="_blank" rel="noopener">Reparatur anfragen</a><a href="/kontakt.html" class="btn btn-outline-dark">Anfahrt & Öffnungszeiten</a></div></div></section></main>${footer()}`;
}

function artefakte(preise) {
  const display11 = findePreis(preise, "iPhone-Display (iPhone 11–12)");
  const display13 = findePreis(preise, "iPhone-Display (iPhone 13–14)");
  const display15 = findePreis(preise, "iPhone-Display (iPhone 15–17)");
  const akku = findePreis(preise, "iPhone-Akku");
  const samsungA = findePreis(preise, "Samsung-Display (A-Serie)");
  const samsungS = findePreis(preise, "Samsung-Display (S-Serie)");
  const samsungAkku = findePreis(preise, "Samsung-Akku");
  const ladebuchse = findePreis(preise, "Ladebuchse");
  const wasserschaden = findePreis(preise, "Wasserschaden-Diagnose");
  const displayFaq = [
    { frage: "Wie lange dauert eine iPhone-Display-Reparatur?", antwort: "Viele Displayreparaturen erledigen wir in der Regel in rund einer Stunde. Ersatzteilverfügbarkeit und weitere Schäden können die Dauer beeinflussen." },
    { frage: "Ist der angezeigte Preis verbindlich?", antwort: "Die genannten Beträge sind Ab-Preise für Standardreparaturen. Den verbindlichen Preis nennen wir nach einer kurzen Prüfung von Modell und Schaden." },
    { frage: "Muss ich einen Termin vereinbaren?", antwort: "Nein. Sie können während der Öffnungszeiten direkt in unserem Laden auf der Zeil vorbeikommen. Eine kurze WhatsApp-Anfrage hilft bei der Prüfung der Ersatzteilverfügbarkeit." },
  ];
  const akkuFaq = [
    { frage: "Was kostet ein iPhone-Akkuwechsel?", antwort: `Der iPhone-Akkuwechsel beginnt aktuell bei ${akku} €. Der verbindliche Preis hängt vom genauen Modell und dem Zustand des Geräts ab.` },
    { frage: "Wie lange dauert der Akkuwechsel?", antwort: "Viele Akkuwechsel erledigen wir in der Regel in rund einer Stunde. Nach der Annahme nennen wir Ihnen die voraussichtliche Dauer." },
    { frage: "Was soll ich bei einem aufgeblähten Akku tun?", antwort: "Schalten Sie das Gerät möglichst aus, laden Sie es nicht weiter und bringen Sie es zeitnah zur fachgerechten Prüfung. Drücken Sie das Gehäuse nicht zusammen." },
  ];
  const display = seite({
    titel: "iPhone Display Reparatur Frankfurt | Mr. Phone",
    beschreibung: `iPhone-Display-Reparatur in Frankfurt auf der Zeil: iPhone 11–12 ab ${display11} €, 13–14 ab ${display13} €, 15–17 ab ${display15} €. Jetzt anfragen.`,
    slug: "iphone-display-reparatur-frankfurt.html",
    serviceName: "iPhone Display Reparatur Frankfurt",
    serviceBeschreibung: "Displaytausch für iPhone-Modelle bei Mr. Phone auf der Zeil in Frankfurt am Main.",
    eyebrow: "Displaytausch auf der Zeil",
    h1: "iPhone Display Reparatur in Frankfurt",
    lead: "Gesprungenes Glas, Bildfehler oder keine Touch-Eingabe? Wir prüfen Ihr iPhone direkt in unserem Laden auf der Zeil und nennen Ihnen vor der Reparatur den verbindlichen Preis.",
    faq: displayFaq,
    inhalt: `<section><div class="container"><div class="section-intro"><span class="eyebrow">Aktuelle Ab-Preise</span><h2>Display-Reparatur nach iPhone-Generation</h2><p>Die Preise gelten für Standardreparaturen mit Qualitätsersatzteilen. Sondermodelle, zusätzliche Schäden oder eine abweichende Teileauswahl können den Endpreis verändern.</p></div><div class="service-list"><div class="service-card"><h3>iPhone 11–12</h3><p>Display-Reparatur ab <strong>${display11} €</strong></p></div><div class="service-card"><h3>iPhone 13–14</h3><p>Display-Reparatur ab <strong>${display13} €</strong></p></div><div class="service-card"><h3>iPhone 15–17</h3><p>Display-Reparatur ab <strong>${display15} €</strong></p></div></div></div></section><section class="bg-light"><div class="container"><div class="two-col"><div><h2>So läuft die Reparatur ab</h2><p>Wir prüfen zunächst Modell, Displayfunktion, Rahmen und weitere sichtbare Schäden. Danach erhalten Sie Preis und voraussichtliche Dauer. Erst nach Ihrer Freigabe beginnen wir mit der Reparatur und testen anschließend Anzeige und Touch-Funktion.</p></div><div><h2>Direkt in Frankfurt</h2><p>Sie finden Mr. Phone in der Zeil 115–117. Viele Displayreparaturen sind in der Regel in rund einer Stunde möglich, sofern das passende Ersatzteil verfügbar ist.</p><p><a href="/ratgeber/iphone-display-kaputt.html">Ratgeber: Lohnt sich die Display-Reparatur? →</a></p></div></div></div></section>`,
  });
  const akkuSeite = seite({
    titel: "iPhone Akku wechseln Frankfurt | Mr. Phone Zeil",
    beschreibung: `iPhone-Akkuwechsel in Frankfurt auf der Zeil ab ${akku} €. Kurze Diagnose, transparenter Preis und bei vielen Modellen Reparatur in rund einer Stunde.`,
    slug: "iphone-akku-wechsel-frankfurt.html",
    serviceName: "iPhone Akkuwechsel Frankfurt",
    serviceBeschreibung: "iPhone-Akku prüfen und wechseln bei Mr. Phone auf der Zeil in Frankfurt am Main.",
    eyebrow: "Akkutausch auf der Zeil",
    h1: "iPhone Akku wechseln in Frankfurt",
    lead: `Wenn die Laufzeit stark nachlässt, das iPhone unerwartet ausgeht oder der Akku sich wölbt, prüfen wir das Gerät vor Ort. Der iPhone-Akkuwechsel beginnt aktuell bei ${akku} €.`,
    faq: akkuFaq,
    inhalt: `<section><div class="container"><div class="two-col"><div><span class="eyebrow">Preis & Ablauf</span><h2>iPhone-Akkuwechsel ab ${akku} €</h2><p>Der genaue Preis richtet sich nach dem Modell und dem Zustand des Geräts. Wir nennen ihn nach der kurzen Prüfung, bevor Kosten entstehen. Viele Akkuwechsel erledigen wir in der Regel in rund einer Stunde.</p></div><div><h2>Wann ein Wechsel sinnvoll ist</h2><p>Typische Hinweise sind eine deutlich kürzere Laufzeit, unerwartetes Abschalten, starke Wärmeentwicklung oder ein aufgeblähtes Gehäuse. Bei einer Wölbung sollte das Gerät nicht weiter geladen werden.</p></div></div></div></section><section class="bg-light"><div class="container"><div class="section-intro"><h2>Prüfung, Austausch und Funktionstest</h2><p>Wir prüfen das Gerät, tauschen den Akku nach Ihrer Freigabe und kontrollieren danach Laden, Startverhalten und grundlegende Funktionen. Ihre Daten werden bei einem normalen Akkuwechsel nicht absichtlich gelöscht; ein aktuelles Backup ist trotzdem immer empfehlenswert.</p><p><a href="/ratgeber/akku-wechseln-oder-neu.html">Ratgeber: Akku wechseln oder Gerät ersetzen? →</a></p></div></div></section>`,
  });
  const samsungFaq = [
    { frage: "Welche Samsung-Modelle reparieren Sie?", antwort: "Wir reparieren viele Modelle der Samsung Galaxy A-, S- und weiterer Serien. Nennen Sie uns am besten die genaue Modellbezeichnung, damit wir Preis und Ersatzteilverfügbarkeit prüfen können." },
    { frage: "Was kostet eine Samsung-Display-Reparatur?", antwort: `Display-Reparaturen beginnen bei Modellen der Galaxy A-Serie aktuell bei ${samsungA} € und bei Modellen der Galaxy S-Serie bei ${samsungS} €. Der verbindliche Preis hängt vom genauen Modell und Schaden ab.` },
    { frage: "Wie lange dauert die Samsung-Reparatur?", antwort: "Viele Display- und Akku-Reparaturen sind in der Regel in rund einer Stunde möglich, sofern das passende Ersatzteil verfügbar ist. Die genaue Dauer nennen wir nach der Prüfung." },
  ];
  const samsung = seite({
    titel: "Samsung Reparatur Frankfurt | Mr. Phone Zeil",
    beschreibung: `Samsung-Reparatur in Frankfurt: Galaxy A Display ab ${samsungA} €, Galaxy S ab ${samsungS} €, Akku ab ${samsungAkku} €. Direkt bei Mr. Phone auf der Zeil.`,
    slug: "samsung-reparatur-frankfurt.html",
    serviceName: "Samsung Reparatur Frankfurt",
    serviceBeschreibung: "Display- und Akku-Reparatur für Samsung Galaxy Smartphones bei Mr. Phone auf der Zeil in Frankfurt am Main.",
    eyebrow: "Samsung-Service auf der Zeil",
    h1: "Samsung Handy Reparatur in Frankfurt",
    lead: "Display gebrochen, Akku schwach oder das Galaxy lädt nicht mehr? Wir prüfen Ihr Samsung-Smartphone direkt im Laden und nennen Preis und Dauer vor der Reparatur.",
    faq: samsungFaq,
    inhalt: `<section><div class="container"><div class="section-intro"><span class="eyebrow">Aktuelle Ab-Preise</span><h2>Samsung Display und Akku reparieren</h2><p>Die Beträge gelten für Standardreparaturen mit Qualitätsersatzteilen. Das genaue Modell, weitere Schäden und die Teileverfügbarkeit bestimmen den verbindlichen Endpreis.</p></div><div class="service-list"><div class="service-card"><h3>Galaxy A-Serie Display</h3><p>Display-Reparatur ab <strong>${samsungA} €</strong></p></div><div class="service-card"><h3>Galaxy S-Serie Display</h3><p>Display-Reparatur ab <strong>${samsungS} €</strong></p></div><div class="service-card"><h3>Samsung Akku</h3><p>Akkuwechsel ab <strong>${samsungAkku} €</strong></p></div></div></div></section><section class="bg-light"><div class="container"><div class="two-col"><div><h2>So läuft die Reparatur ab</h2><p>Wir erfassen die genaue Modellnummer, prüfen Display, Rahmen, Akku und die betroffene Funktion. Danach erhalten Sie den verbindlichen Preis. Erst nach Ihrer Freigabe wird repariert und anschließend getestet.</p></div><div><h2>Ohne Termin auf die Zeil</h2><p>Sie können Ihr Samsung-Gerät während der Öffnungszeiten direkt vorbeibringen. Per WhatsApp können wir die Ersatzteilverfügbarkeit vor Ihrer Anfahrt prüfen.</p></div></div></div></section>`,
  });
  const ladebuchseFaq = [
    { frage: "Muss die Ladebuchse immer ausgetauscht werden?", antwort: "Nein. Ladeprobleme können auch durch Schmutz, Kabel, Netzteil oder Software entstehen. Wir prüfen zuerst die Ursache und besprechen dann die passende Lösung." },
    { frage: "Was kostet die Reparatur der Ladebuchse?", antwort: `Eine Standardreparatur der Ladebuchse beginnt aktuell bei ${ladebuchse} €. Den verbindlichen Preis nennen wir nach Prüfung von Modell und Schaden.` },
    { frage: "Welche Geräte können geprüft werden?", antwort: "Wir prüfen Smartphones und viele Tablets mit USB-C-, Lightning- oder älteren Anschlüssen. Schicken Sie uns die Modellbezeichnung vorab per WhatsApp." },
  ];
  const ladebuchseSeite = seite({
    titel: "Handy Ladebuchse Reparatur Frankfurt | Mr. Phone",
    beschreibung: `Handy lädt nicht? Ladebuchsen-Reparatur in Frankfurt ab ${ladebuchse} €. Ursache prüfen lassen, transparenter Preis, direkt bei Mr. Phone auf der Zeil.`,
    slug: "handy-ladebuchse-reparatur-frankfurt.html",
    serviceName: "Handy Ladebuchse Reparatur Frankfurt",
    serviceBeschreibung: "Prüfung und Reparatur defekter Smartphone-Ladebuchsen bei Mr. Phone auf der Zeil in Frankfurt am Main.",
    eyebrow: "Ladeprobleme prüfen lassen",
    h1: "Handy-Ladebuchse reparieren in Frankfurt",
    lead: `Ihr Smartphone lädt nicht, nur langsam oder nur in einem bestimmten Winkel? Wir prüfen Kabel, Anschluss und Gerät. Ladebuchsen-Reparaturen beginnen aktuell bei ${ladebuchse} €.` ,
    faq: ladebuchseFaq,
    inhalt: `<section><div class="container"><div class="two-col"><div><span class="eyebrow">Preis & Diagnose</span><h2>Ladebuchsen-Reparatur ab ${ladebuchse} €</h2><p>Bevor Teile getauscht werden, prüfen wir Anschluss, Ladekabel, Netzteil und sichtbare Verschmutzungen. So bezahlen Sie nicht für einen Austausch, wenn eine einfachere Lösung genügt.</p></div><div><h2>Typische Anzeichen</h2><p>Der Stecker hält nicht, das Gerät lädt nur in einem Winkel, die Verbindung bricht ab oder der Computer erkennt das Smartphone nicht mehr. Auch Feuchtigkeit oder beschädigte Kontakte können die Ursache sein.</p></div></div></div></section><section class="bg-light"><div class="container"><div class="section-intro"><h2>Prüfung vor der Reparatur</h2><p>Nach der Diagnose nennen wir Ihnen den verbindlichen Preis und die voraussichtliche Dauer. Repariert wird erst nach Ihrer Zustimmung. Danach testen wir Ladefunktion und Kabelverbindung.</p></div></div></section>`,
  });
  const wasserFaq = [
    { frage: "Was soll ich direkt nach Wasserkontakt tun?", antwort: "Schalten Sie das Gerät aus, laden Sie es nicht und trocknen Sie nur die Außenseite vorsichtig ab. Bringen Sie es möglichst schnell zur Prüfung." },
    { frage: "Hilft Reis bei einem nassen Handy?", antwort: "Reis entfernt Feuchtigkeit im Geräteinneren nicht zuverlässig und kann Staub in Anschlüsse bringen. Eine schnelle fachgerechte Prüfung ist sinnvoller." },
    { frage: "Ist eine Reparatur nach Wasserschaden garantiert?", antwort: "Nein. Ob das Gerät oder Daten gerettet werden können, hängt von Flüssigkeit, Dauer und bereits entstandener Korrosion ab. Wir nennen die Möglichkeiten nach der Diagnose ehrlich." },
  ];
  const wasserSeite = seite({
    titel: "Handy Wasserschaden Reparatur Frankfurt | Mr. Phone",
    beschreibung: `Handy nass geworden? Wasserschaden-Diagnose in Frankfurt ab ${wasserschaden} €. Gerät ausschalten, nicht laden und schnell zu Mr. Phone auf die Zeil bringen.`,
    slug: "handy-wasserschaden-reparatur-frankfurt.html",
    serviceName: "Handy Wasserschaden Reparatur Frankfurt",
    serviceBeschreibung: "Diagnose und Reparaturprüfung für Smartphones mit Flüssigkeitsschaden bei Mr. Phone auf der Zeil in Frankfurt am Main.",
    eyebrow: "Schnelle Hilfe nach Flüssigkeitsschaden",
    h1: "Handy-Wasserschaden prüfen lassen in Frankfurt",
    lead: `Schalten Sie das Gerät aus und laden Sie es nicht mehr. Wir öffnen und prüfen das Smartphone fachgerecht. Die Wasserschaden-Diagnose beginnt aktuell bei ${wasserschaden} €.` ,
    faq: wasserFaq,
    inhalt: `<section><div class="container"><div class="two-col"><div><span class="eyebrow">Jetzt richtig handeln</span><h2>Ausschalten, nicht laden, schnell prüfen lassen</h2><p>Strom und Feuchtigkeit können weitere Schäden verursachen. Entfernen Sie nur Hülle und SIM-Karte, wenn das gefahrlos möglich ist. Nicht föhnen, nicht erhitzen und nicht in Reis legen.</p></div><div><h2>Diagnose ab ${wasserschaden} €</h2><p>Wir prüfen, welche Bereiche betroffen sind und ob Reparatur oder Datenrettung sinnvoll erscheint. Eine Erfolgsgarantie wäre bei Flüssigkeitsschäden unseriös; Sie erhalten eine ehrliche Einschätzung vor weiteren Arbeiten.</p></div></div></div></section><section class="bg-light"><div class="container"><div class="section-intro"><h2>Je früher, desto besser</h2><p>Korrosion kann auch nach dem Trocknen fortschreiten. Bringen Sie das Gerät deshalb möglichst am selben Tag zu uns auf die Zeil. Weitere Sofortmaßnahmen finden Sie in unserem <a href="/ratgeber/wasserschaden-erste-hilfe.html">Ratgeber zum Handy-Wasserschaden</a>.</p></div></div></section>`,
  });
  return new Map([
    ["iphone-display-reparatur-frankfurt.html", display],
    ["iphone-akku-wechsel-frankfurt.html", akkuSeite],
    ["samsung-reparatur-frankfurt.html", samsung],
    ["handy-ladebuchse-reparatur-frankfurt.html", ladebuchseSeite],
    ["handy-wasserschaden-reparatur-frankfurt.html", wasserSeite],
  ]);
}

function main() {
  const preise = JSON.parse(fs.readFileSync(PREISE, "utf8"));
  const dateien = artefakte(preise);
  const pruefen = process.argv.includes("--check");
  const fehler = [];
  for (const [name, inhalt] of dateien) {
    const ziel = path.join(ROOT, name);
    if (pruefen) {
      if (!fs.existsSync(ziel) || fs.readFileSync(ziel, "utf8") !== inhalt) fehler.push(name);
    } else {
      fs.writeFileSync(ziel, inhalt, "utf8");
    }
  }
  if (fehler.length) throw new Error(`Reparatur-Landingpages veraltet: ${fehler.join(", ")}`);
  console.log(`${dateien.size} Reparatur-Landingpages ${pruefen ? "geprüft" : "aktualisiert"}.`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { artefakte, findePreis };

/**
 * Zentrale Ankaufspreis-Heuristik – EINZIGE Quelle für Zustands-Prozentsätze im ganzen Projekt.
 *
 * Verwendet von:
 *   - admin/server.js                  ("Neu berechnen", Massenanpassung, Ankaufsniveau-Regler)
 *   - scripts/build-ankauf-preise.js   (Erstbefüllung aus geraete-katalog.json)
 *   - scripts/befuelle-marktwert.js    (Startwert-Schätzung für marktwertGebraucht)
 *   - scripts/update-ankaufspreise.js  (echter täglicher eBay-Marktlauf)
 *
 * Erweitert am 06.08.2026: kategorie "smartphones" läuft seitdem über eine EIGENE, UVP-basierte
 * Formel statt der reinen eBay-Marktanker-Formel (siehe berechneNeuVersiegeltUvpBasiert() +
 * berechneGebrauchtAusNeu() weiter unten, Grund + Kalibrierung dort dokumentiert). Alle anderen
 * Kategorien bleiben unverändert auf der hier unten beschriebenen alten Formel, bis eigene
 * Referenzwerte vorliegen (siehe OFFENE-PUNKTE.md).
 *
 * Bereinigt am 28.07.2026: Apple-Korrektur (1,40/1,15), Samsung-Faktor (0,78), Wettbewerbs-Abstand
 * und der eigenständige Markt-Deckel (Konsistenzregel 3) sind vollständig entfernt – sie
 * überlagerten sich und kollidierten bei hochpreisigen Geräten (mehrere Zustandsstufen kollabierten
 * auf denselben gekappten Preis, siehe OFFENE-PUNKTE.md). Es gibt jetzt nur noch:
 *   1. Zwei feste Zustands-Tabellen (ANKAUF_PROZENTSAETZE_APPLE / _REST), je als Prozentsatz des
 *      rohen eBay-Marktwerts – siehe prozentsaetzeFuerMarke(). Da beide Tabellen ausschließlich
 *      Werte < 1,0 enthalten, kann eine Stufe rechnerisch nie über ihrem eigenen Marktanker landen;
 *      ein zusätzlicher Markt-Deckel ist damit strukturell überflüssig.
 *   2. Die separate, gehärtete neuVersiegelt-Formel (berechneNeuVersiegelt(), seit 28.07.2026)
 *      mit hartem 90%-Deckel gegen marktwertNeu, seit 28.07.2026 zusätzlich mit drei
 *      markenunabhängigen Leitplanken gegen kontaminierte/überzogene Marktanker: (1) Anker nie
 *      über 100% UVP, (2) roher marktwertNeu > 115% UVP gilt als Scraper-Kontamination und wird
 *      verworfen (pruefeMarktwertNeuPlausibilitaet()), (3) reine Schätz-Anker ohne echten
 *      Marktlauf zusätzlich auf 85% UVP gedeckelt. Siehe OFFENE-PUNKTE.md, Fall "Nicht-Apple-
 *      Neupreise zu hoch" (u.a. DualSense-Controller kaufte für 405€ bei 69€ UVP ein).
 *   3. Genau EINE verbleibende Sicherheitsregel: Ankaufspreis nie über dem eigenen Verkaufspreis
 *      aus bestand.json (siehe pruefeKonsistenz() bzw. Konsistenzregel 1 in update-ankaufspreise.js).
 *
 * ANKER-PRIORITÄT (pro Zustand "neu"/"gebraucht" unabhängig ermittelt):
 *   1. Primäranker: exakter Treffer (Marke+Modell+Variante+Zustand) in bestand.json
 *      -> Wiederverkaufswert = unser eigener Verkaufspreis.
 *   2. Sekundäranker: geraete-katalog.json Feld "marktwertGebraucht" (geschätzter/recherchierter
 *      Gebraucht-Verkaufspreis im Zustand "Sehr gut", proportional auf die Variante skaliert).
 *      "Neu"-Wiederverkaufswert wird daraus über NEUWARE_AUFSCHLAG abgeleitet, wenn kein
 *      eigener Verkaufspreis für "neu" vorliegt.
 *
 * Die 4 Gebraucht-Ankaufsstufen sind feste Prozentsätze dieses Wiederverkaufswerts (siehe
 * prozentsaetzeFuerMarke()), zusätzlich global verschiebbar über den Ankaufsniveau-Regler
 * (pricing-niveau.json, -15..+15 %).
 *
 * Änderungen hier wirken sich NICHT rückwirkend auf bereits gespeicherte Preise aus, sondern erst
 * beim nächsten "Neu berechnen" bzw. beim nächsten Lauf des Build-/Update-Skripts. preisQuelle:
 * "manuell" gesetzte Varianten werden von keiner Funktion hier automatisch überschrieben – das
 * bleibt Aufgabe der aufrufenden Stelle (dort prüfen!).
 */
const fs = require("fs");
const path = require("path");

const NIVEAU_DATEI = path.join(__dirname, "pricing-niveau.json");
const NIVEAU_MIN = -15;
const NIVEAU_MAX = 15;

// Marktwert-Erhalt nach Gerätealter in vollen Jahren (0 = aktuelles Modelljahr).
// Jahre 0-5 fest, danach linear -0,04 pro weiterem Jahr, nie unter dem Minimum.
// Wird NICHT mehr direkt für Ankaufspreise verwendet, sondern nur noch als begründete
// Startwert-Schätzung für scripts/befuelle-marktwert.js (Feld marktwertGebraucht).
const ALTERSFAKTOR_STUFEN = [0.80, 0.62, 0.48, 0.38, 0.30, 0.24];
const ALTERSFAKTOR_JAHRESABSCHLAG = 0.04;
const ALTERSFAKTOR_MINIMUM = 0.08;

function altersfaktor(jahr, referenzjahr) {
  const heute = referenzjahr || new Date().getFullYear();
  const alter = Math.max(0, heute - jahr);
  if (alter < ALTERSFAKTOR_STUFEN.length) return ALTERSFAKTOR_STUFEN[alter];
  const letzterStufenwert = ALTERSFAKTOR_STUFEN[ALTERSFAKTOR_STUFEN.length - 1];
  const zusatzJahre = alter - (ALTERSFAKTOR_STUFEN.length - 1);
  const wert = letzterStufenwert - zusatzJahre * ALTERSFAKTOR_JAHRESABSCHLAG;
  return Math.max(ALTERSFAKTOR_MINIMUM, wert);
}

// Markenfaktor: Apple hält den Wert am besten, Samsung-A-Serie/Einsteiger am wenigsten.
// Wie altersfaktor() nur noch für die Startwert-Schätzung relevant, nicht für Live-Preise.
function markenfaktor(marke, modell) {
  const m = String(marke || "").trim().toLowerCase();
  if (m === "apple") return 1.15;
  if (m === "samsung") {
    const istASerie = /^galaxy a\d/i.test(String(modell || "").trim());
    return istASerie ? 0.85 : 1.0;
  }
  if (m === "google") return 0.9;
  return 0.8;
}

function marktwert(uvp, jahr, marke, modell, referenzjahr) {
  const basis = Number(uvp) || 0;
  return basis * altersfaktor(jahr, referenzjahr) * markenfaktor(marke, modell);
}

// Aufschlag, um aus dem Gebraucht-Wiederverkaufswert (marktwertGebraucht) einen impliziten
// Neuware-Wiederverkaufswert abzuleiten, WENN kein eigener Verkaufspreis für "neu" vorliegt.
// Konfigurierbar, dokumentiert – kein Wert aus der Nutzervorgabe, sondern eine begründete
// Annahme (versiegelte/neuwertige Ware erzielt spürbar mehr als gebrauchte "Sehr gut"-Ware).
const NEUWARE_AUFSCHLAG = 1.15;

// Ankaufspreis je Zustandsstufe als Prozentsatz des Gebraucht-Wiederverkaufswerts (= roher
// eBay-Marktwert). "neuVersiegelt" hat seit 28.07.2026 eine EIGENE Formel (siehe
// berechneNeuVersiegelt() weiter unten) und wird hier bewusst nicht mehr gelistet.
//
// Zwei Tabellen statt einer gemeinsamen: Apple hält den Wiederverkaufswert spürbar besser als
// der Rest des Sortiments, deshalb ein durchgehend höherer Prozentsatz je Zustandsstufe. Das
// ersetzt den früheren, sich mit dem Wettbewerbs-Abstand überlagernden "Markenkorrektur"-Faktor
// (siehe Kommentar oben) durch EINEN einzigen, transparenten Satz Zahlen pro Marke.
const ANKAUF_PROZENTSAETZE_APPLE = {
  wieNeu: 0.88,
  sehrGut: 0.80,
  gut: 0.72,
  defekt: 0.25,
};
const ANKAUF_PROZENTSAETZE_REST = {
  wieNeu: 0.75,
  sehrGut: 0.68,
  gut: 0.55,
  defekt: 0.20,
};

function prozentsaetzeFuerMarke(marke) {
  return String(marke || "").trim().toLowerCase() === "apple"
    ? ANKAUF_PROZENTSAETZE_APPLE
    : ANKAUF_PROZENTSAETZE_REST;
}

// ---------------------------------------------------------------------------
// Ankaufspreis "neu versiegelt" (seit 28.07.2026)
// ---------------------------------------------------------------------------
// Vorfall 27.07.2026: die alte Herleitung (Prozentsatz vom eBay-Neupreis-Median) kaufte beim
// iPhone 17 Pro Max 512GB über dem eigenen Verkaufspreis UND über dem eBay-Neupreis ein -
// Verlustgeschäft. Neue Logik, siehe OFFENE-PUNKTE.md: IMMER der NIEDRIGERE von zwei
// unabhängigen Ankern, damit wir strukturell nie zu teuer einkaufen können:
//   Regel 1 (eigener Verkaufspreis in bestand.json vorhanden): eigenerVK × 0,88 (-12% Marge).
//   Regel 2 (marktAnkerNeu vorhanden - echter eBay-Neupreis-Median ODER, falls kein echter
//     Marktlauf existiert, dessen Schätzung aus marktwertGebraucht × NEUWARE_AUFSCHLAG):
//     marktAnkerNeu × 0,82, zusätzlich hart gedeckelt auf marktAnkerNeu × 0,90 (nie über 90%
//     des Neupreis-Ankers, auch nicht durch den globalen Ankaufsniveau-Regler).
// Sind beide Anker unbekannt, gibt es keinen Ankaufspreis für diese Stufe (null - Stufe wird
// in UI/Ankaufsrechner ausgeblendet, wie bei fehlendem marktwertNeu schon bisher üblich).
const NEU_VERSIEGELT_EIGENER_VK_ABSCHLAG = 0.88; // -12 % vom eigenen Verkaufspreis
const NEU_VERSIEGELT_MARKTANKER_PROZENT = 0.82;  // Basis-Prozentsatz vom Marktanker
const NEU_VERSIEGELT_MARKTANKER_DECKEL = 0.90;   // harte Obergrenze: nie über 90 % des Ankers

// Leitplanken 1-3 (28.07.2026, Fall Nicht-Apple-Neupreise zu hoch, siehe OFFENE-PUNKTE.md):
// marktAnkerNeu (echter eBay-Marktwert ODER Schätzung) hatte bislang KEINEN Bezug zur eigenen
// UVP - ein kontaminierter Scraper-Treffer (Bundle, falsche Variante, Sammlerpreis) lief
// deshalb ungebremst in den Ankaufspreis. Beispiel: Sony DualSense Controller, UVP 69 €,
// marktwertNeu 496 € (Scraper-Fehltreffer) -> alter Ankaufspreis 405 €, das 5,9-fache der UVP.
// Gilt einheitlich für ALLE Marken (auch Apple) - eine Markenausnahme wäre exakt die
// Sonderlogik (Apple-Korrektur/Samsung-Faktor), die am 28.07.2026 bewusst entfernt wurde.
const NEU_VERSIEGELT_UVP_DECKEL = 1.0;            // Leitplanke 1: Anker nie über 100 % UVP
const NEU_VERSIEGELT_GESCHAETZT_UVP_DECKEL = 0.85; // Leitplanke 3: OHNE echten Marktlauf (marktAnkerNeuUrsprung "geschaetzt") zusätzlich enger, da hier weder eBay-Neupreis noch eigener VK vorliegt
const NEU_VERSIEGELT_MARKTWERT_VERWERFEN_SCHWELLE = 1.15; // Leitplanke 2: roher marktwertNeu > 115 % UVP gilt als kontaminiert -> verworfen (siehe pruefeMarktwertNeuPlausibilitaet)

// Leitplanke 2: verwirft einen roh gescrapten marktwertNeu, wenn er weit über der UVP liegt.
// Greift VOR jeder Weiterverarbeitung (in ermittleWiederverkaufswerte() für bereits im Katalog
// gespeicherte Werte, sowie live in scripts/update-ankaufspreise.js für frisch gescrapte Werte),
// damit ein kontaminierter Treffer weder in neuVersiegelt einfließt noch zurück in den Katalog
// geschrieben wird. Gibt den Wert unverändert zurück, wenn er plausibel ist, sonst null.
function pruefeMarktwertNeuPlausibilitaet(marktwertNeu, uvp) {
  if (marktwertNeu == null || !Number.isFinite(Number(marktwertNeu))) return null;
  if (!Number.isFinite(Number(uvp)) || Number(uvp) <= 0) return Number(marktwertNeu); // keine UVP -> keine Prüfung möglich (z.B. Objektive "auf Anfrage")
  return Number(marktwertNeu) <= Number(uvp) * NEU_VERSIEGELT_MARKTWERT_VERWERFEN_SCHWELLE
    ? Number(marktwertNeu)
    : null;
}

function berechneNeuVersiegelt({ eigenerVK, marktAnkerNeu, marktAnkerNeuUrsprung, uvpVariante, niveauFaktor }) {
  const faktor = Number.isFinite(niveauFaktor) ? niveauFaktor : 1;
  const kandidaten = [];
  if (eigenerVK != null && Number.isFinite(Number(eigenerVK))) {
    kandidaten.push(Number(eigenerVK) * NEU_VERSIEGELT_EIGENER_VK_ABSCHLAG * faktor);
  }
  if (marktAnkerNeu != null && Number.isFinite(Number(marktAnkerNeu))) {
    let anker = Number(marktAnkerNeu);
    if (Number.isFinite(Number(uvpVariante)) && Number(uvpVariante) > 0) {
      // Leitplanke 1: Anker nie über 100 % der UVP der Variante.
      anker = Math.min(anker, Number(uvpVariante) * NEU_VERSIEGELT_UVP_DECKEL);
      // Leitplanke 3: ohne echten Marktlauf (reine Schätzung aus marktwertGebraucht ×
      // NEUWARE_AUFSCHLAG) zusätzlich enger gedeckelt.
      if (marktAnkerNeuUrsprung === "geschaetzt") {
        anker = Math.min(anker, Number(uvpVariante) * NEU_VERSIEGELT_GESCHAETZT_UVP_DECKEL);
      }
    }
    const basis = anker * NEU_VERSIEGELT_MARKTANKER_PROZENT * faktor;
    const deckel = anker * NEU_VERSIEGELT_MARKTANKER_DECKEL * faktor;
    kandidaten.push(Math.min(basis, deckel));
  }
  if (!kandidaten.length) return null;
  return rundeAbAuf5(Math.min(...kandidaten));
}

// ---------------------------------------------------------------------------
// UVP-basierte Formel für Kategorie "smartphones" (seit 06.08.2026)
// ---------------------------------------------------------------------------
// Grund (siehe OFFENE-PUNKTE.md, "Ankaufspreise vs. Wettbewerb"): die alte neuVersiegelt-Formel
// hing ausschließlich am eBay-Marktanker. Bei Geräten ohne echten Marktlauf (marktwertQuelle
// "geschaetzt") führte das zu inkonsistenten, unkalibrierten Ankaufspreisen (mal deutlich über,
// mal deutlich unter dem gewünschten Wettbewerbsabstand zu Avatel). Neue Logik NUR für
// kategorie "smartphones" (einzige Kategorie mit belastbaren Referenzwerten - 5 echte
// Avatel-Vergleichspreise, siehe unten): der Ankaufspreis hängt an EINEM Anker (UVP-Prozentsatz,
// markengetrennt, kalibriert auf die 5 Referenzwerte), nicht mehr an der Tagesform des
// eBay-Marktes. Damit Preise bei starkem Marktverfall (altes Gerät, eBay-Wert weit unter
// UVP-Prozentsatz) nicht bei diesem Prozentsatz "kleben bleiben", bleibt der echte eBay-Marktwert
// als Korrektiv erhalten: IMMER der niedrigere von UVP-Anker ODER eBay-Anker gewinnt (gleiches
// Min-Prinzip wie beim eigenen Verkaufspreis, siehe berechneNeuVersiegelt oben). Andere
// Kategorien (tablets, laptops, ...) haben keine eigene Kalibrierung und bleiben bewusst auf der
// alten, rein eBay-basierten Formel (berechneNeuVersiegelt), bis eigene Referenzwerte vorliegen.
//
// Kalibrierung anhand 5 Referenzgeräte (Ziel: konstant 50-60€ unter Avatel-Ankaufspreis, NEU/
// versiegelt): iPhone 17 Pro Max 256GB (Avatel 1100 -> Ziel 1040), iPhone 17 Pro 256GB
// (1000 -> 950), iPhone 17 256GB (710 -> 650), Galaxy S26+ 256GB (620 -> 570), Galaxy S26 256GB
// (500 -> 450, korrigiert am 06.08.2026). Daraus: Apple ~71% UVP, Samsung/Rest ~50% UVP (Ziel-
// Prozentsatz trifft je Gerät nicht exakt, siehe OFFENE-PUNKTE.md - inhärenter Trade-off, weil
// kein einzelner Prozentsatz alle 5 Punkte exakt treffen kann, aber Automatik ohne manuelle
// Preispflege war explizit die Vorgabe).
const ANKAUF_UVP_PROZENT_NEU = {
  apple: 0.71,
  rest: 0.50,
};

// Korrektiv-Prozentsatz auf den ECHTEN eBay-Marktwert (marktAnkerNeuUrsprung "echt", NIE bei
// "geschaetzt" - eine unverifizierte Schätzung taugt nicht als Korrektiv nach unten, siehe
// OFFENE-PUNKTE.md). 90% statt der alten 82%, bewusst so gewählt, dass der UVP-Anker bei frischen
// Geräten (eBay-Wert noch nah an UVP) gewinnt und die Kalibrierung nicht unterläuft, aber bei
// gealterten Geräten (eBay-Wert weit unter UVP-Prozentsatz gefallen) das Korrektiv greift.
const NEU_VERSIEGELT_EBAY_KORREKTIV_PROZENT = 0.90;

// Gebraucht-Stufen (wieNeu/sehrGut/gut) als Prozentsatz des NEUEN Ankaufspreises (nicht mehr vom
// eBay-Gebraucht-Marktwert, siehe OFFENE-PUNKTE.md - EIN Anker pro Gerät statt zwei
// unabhängiger Quellen, die sich früher widersprechen konnten, siehe Fall iPhone 17 256GB:
// wieNeu lag vor dieser Änderung über neuVersiegelt). Nicht unabhängig kalibriert (keine
// Referenzwerte für Gebraucht-Stufen vorhanden) - Spreizung so gewählt, dass Stufen bei Rundung
// auf 5€ nicht kollabieren (erster Entwurf 78/76/75 für Apple kollabierte bei mehreren Geräten
// auf sehrGut=gut, siehe OFFENE-PUNKTE.md). Defekt bleibt bewusst UNVERÄNDERT auf der alten
// Formel (Prozentsatz vom eBay-Gebraucht-Marktwert, ANKAUF_PROZENTSAETZE_APPLE/_REST.defekt).
const ANKAUF_GEBRAUCHT_PROZENT_VON_NEU_APPLE = { wieNeu: 0.80, sehrGut: 0.74, gut: 0.64 };
const ANKAUF_GEBRAUCHT_PROZENT_VON_NEU_REST = { wieNeu: 0.82, sehrGut: 0.75, gut: 0.60 };

function istUvpBasierteKategorie(kategorie) {
  return String(kategorie || "").trim().toLowerCase() === "smartphones";
}

// Neuversiegelt-Preis für die UVP-basierte Formel: niedrigerer von bis zu 4 Kandidaten (gleiches
// "immer der niedrigere Anker gewinnt"-Prinzip wie berechneNeuVersiegelt oben).
//   1. eigener VK × 0,88 (unverändert)
//   2. UVP-Variante × Marken-Prozent (siehe ANKAUF_UVP_PROZENT_NEU) - immer verfügbar
//   3. echter eBay-Marktwert (NUR marktAnkerNeuUrsprung "echt") × 0,90, vorher auf UVP gedeckelt
//      (Leitplanke 1, wie bei der alten Formel)
//   4. Sicherheitsnetz NUR ohne echten eBay-Lauf (ergänzt 06.08.2026, siehe OFFENE-PUNKTE.md):
//      Ergebnis der alten, unveränderten berechneNeuVersiegelt() mit denselben Eingaben - aber
//      NUR wenn marktAnkerNeuUrsprung NICHT "echt" ist. Erster Versuch band dieses Sicherheitsnetz
//      IMMER ein (auch bei "echt") und riss dadurch die kalibrierten Apple-Preise zurück auf den
//      alten, alten 0,82-Faktor (iPhone 17 Pro Max 256GB fiel von 1040€ Ziel auf 950€ - exakt der
//      alte, zu niedrige Wert, den die Kalibrierung beheben sollte). Bei "echt" übernimmt bereits
//      Kandidat 3 die Korrektiv-Rolle (siehe oben) - das Sicherheitsnetz wird dort nicht gebraucht
//      und würde die Kalibrierung nur wieder aushebeln. Nur bei "geschätzt" (kein echter Marktlauf
//      für diese Variante) fehlte bislang jeder Deckel - dort greift jetzt der alte 85%-UVP-Deckel
//      (Leitplanke 3 in berechneNeuVersiegelt) als Sicherheitsnetz (gefunden beim Testlauf: 51 von
//      844 Varianten mit Konsistenzregel-1-Verstoß, u.a. iPhone 13 mini 512GB).
function berechneNeuVersiegeltUvpBasiert({ eigenerVK, marktAnkerNeuEcht, marktAnkerNeu, marktAnkerNeuUrsprung, uvpVariante, marke, niveauFaktor }) {
  const faktor = Number.isFinite(niveauFaktor) ? niveauFaktor : 1;
  const kandidaten = [];
  if (eigenerVK != null && Number.isFinite(Number(eigenerVK))) {
    kandidaten.push(Number(eigenerVK) * NEU_VERSIEGELT_EIGENER_VK_ABSCHLAG * faktor);
  }
  if (Number.isFinite(uvpVariante) && uvpVariante > 0) {
    const prozent = String(marke || "").trim().toLowerCase() === "apple"
      ? ANKAUF_UVP_PROZENT_NEU.apple
      : ANKAUF_UVP_PROZENT_NEU.rest;
    kandidaten.push(uvpVariante * prozent * faktor);
  }
  if (marktAnkerNeuEcht != null && Number.isFinite(Number(marktAnkerNeuEcht))) {
    let anker = Number(marktAnkerNeuEcht);
    if (Number.isFinite(uvpVariante) && uvpVariante > 0) {
      anker = Math.min(anker, Number(uvpVariante)); // Leitplanke 1: nie über 100% UVP
    }
    kandidaten.push(anker * NEU_VERSIEGELT_EBAY_KORREKTIV_PROZENT * faktor);
  }
  if (marktAnkerNeuUrsprung !== "echt") {
    const altesSicherheitsnetz = berechneNeuVersiegelt({
      eigenerVK, marktAnkerNeu, marktAnkerNeuUrsprung, uvpVariante, niveauFaktor,
    });
    if (altesSicherheitsnetz != null) kandidaten.push(altesSicherheitsnetz);
  }
  if (!kandidaten.length) return null;
  return rundeAbAuf5(Math.min(...kandidaten));
}

// Gebraucht-Stufen abgeleitet vom bereits berechneten neuVersiegelt-Preis. niveauFaktor bewusst
// NICHT hier nochmal angewendet - steckt schon im übergebenen neuWert (sonst würde der globale
// Regler doppelt wirken).
//
// KORREKTIV gegen echten Gebraucht-Marktwert (ergänzt 06.08.2026, siehe OFFENE-PUNKTE.md,
// "Konsistenzregel-1-Verstöße nach UVP-Umstellung"): reiner Prozentsatz vom neuVersiegelt-Wert
// reicht NICHT - bei alten/stark abgewerteten Geräten (z.B. iPhone 8: neuVersiegelt bleibt über
// den echten eBay-Neupreis für versiegelte/Sammler-Ware bei ~190€, aber der tatsächliche
// Gebraucht-Marktwert ist auf 47€ gefallen) hätte 80% von 190€ = 152€ Ankaufspreis für eine Stufe
// ergeben, die wir nur für 47€ weiterverkaufen könnten - Verstoß gegen Konsistenzregel 1 (Ankauf
// nie über eigenem Wiederverkaufswert). Gleiches Min-Prinzip wie überall sonst in dieser Datei:
// IMMER der niedrigere von (a) Prozentsatz vom neuen neuVersiegelt-Ankaufspreis oder (b) alter,
// bereits gehärteter Prozentsatz vom echten Gebraucht-Marktwert (prozentsaetzeFuerMarke() -
// dieselbe Tabelle, die defekt unverändert weiter benutzt) gewinnt.
function berechneGebrauchtAusNeu(neuWert, marke, marktwertGebraucht) {
  if (neuWert == null) return { wieNeu: null, sehrGut: null, gut: null };
  const tabelleAusNeu = String(marke || "").trim().toLowerCase() === "apple"
    ? ANKAUF_GEBRAUCHT_PROZENT_VON_NEU_APPLE
    : ANKAUF_GEBRAUCHT_PROZENT_VON_NEU_REST;
  const tabelleAusMarkt = prozentsaetzeFuerMarke(marke);
  const ergebnis = {};
  ["wieNeu", "sehrGut", "gut"].forEach((stufe) => {
    const kandidaten = [neuWert * tabelleAusNeu[stufe]];
    if (marktwertGebraucht != null && Number.isFinite(Number(marktwertGebraucht))) {
      kandidaten.push(Number(marktwertGebraucht) * tabelleAusMarkt[stufe]);
    }
    ergebnis[stufe] = rundeAuf5(Math.min(...kandidaten));
  });
  return ergebnis;
}

// Reihenfolge, in der die 5 Stufen überall (UI, Validierung, Export) angezeigt werden.
const ZUSTANDS_REIHENFOLGE = ["neuVersiegelt", "wieNeu", "sehrGut", "gut", "defekt"];

function rundeAuf5(zahl) {
  return Math.max(5, Math.round(zahl / 5) * 5);
}

// Wie rundeAuf5(), aber rundet immer AB (floor statt round) - für harte Obergrenzen, bei
// denen ein Aufrunden den gedeckelten Wert wieder über die Grenze heben könnte (siehe
// scripts/update-ankaufspreise.js Konsistenzregel 3).
function rundeAbAuf5(zahl) {
  return Math.max(5, Math.floor(zahl / 5) * 5);
}

function normalisiere(text) {
  return String(text || "").trim().toLowerCase();
}

// Sucht in bestand.json den zutreffendsten eigenen Verkaufspreis für genau diese
// Marke+Modell+Variante+Zustand-Kombination (bevorzugt aktive, dann neueste Einträge).
function findeEigenenVerkaufspreis(bestandListe, geraet, variante, zustand) {
  if (!Array.isArray(bestandListe) || !bestandListe.length) return null;
  const treffer = bestandListe.filter((eintrag) => (
    eintrag
    && eintrag.zustand === zustand
    && normalisiere(eintrag.marke) === normalisiere(geraet.marke)
    && normalisiere(eintrag.modell) === normalisiere(geraet.modell)
    && normalisiere(eintrag.speicher) === normalisiere(variante.bezeichnung)
    && Number.isFinite(Number(eintrag.preis))
  ));
  if (!treffer.length) return null;
  const aktive = treffer.filter((e) => e.aktiv !== false);
  const kandidaten = aktive.length ? aktive : treffer;
  kandidaten.sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  return Number(kandidaten[0].preis);
}

// Ermittelt Wiederverkaufswert "neu" und "gebraucht" für eine Gerät+Variante-Kombination,
// jeweils unabhängig über die Anker-Priorität (Primäranker: eigener Verkauf, sonst Sekundäranker:
// marktwertGebraucht aus dem Katalog, proportional auf die Variante skaliert).
function ermittleWiederverkaufswerte(geraet, variante, bestandListe) {
  const uvpBasis = Number(geraet.uvp) || 0;
  const uvpVariante = uvpBasis + (Number(variante.uvpDelta) || 0);
  const verhaeltnis = uvpBasis > 0 ? uvpVariante / uvpBasis : 1;

  // Anker-Priorität 2 (nach dem Primäranker bestand.json, siehe unten): ECHTER Marktanker
  // DIESER Variante (von scripts/update-ankaufspreise.js direkt auf die Variante geschrieben,
  // siehe dort - jede Speichergröße wird einzeln abgefragt). Erst wenn die Variante selbst noch
  // keinen eigenen echten Lauf hatte, auf den alten Fallback zurückfallen: Geräte-Level-Wert
  // proportional über uvpDelta skaliert (Näherung, siehe OFFENE-PUNKTE.md).
  const hatEigenenVariantenAnker = variante.marktwertGebraucht != null;
  const marktwertGebrauchtVariante = hatEigenenVariantenAnker
    ? Number(variante.marktwertGebraucht) || 0
    : (Number(geraet.marktwertGebraucht) || 0) * verhaeltnis;

  // Leitplanke 2: den rohen Katalog-Wert erst auf Plausibilität gegen die (variantenscharfe)
  // UVP prüfen (kontaminierte Scraper-Treffer wie Bundles/falsche Varianten verwerfen), BEVOR
  // er als "echter" Marktanker verwendet wird - siehe pruefeMarktwertNeuPlausibilitaet().
  const marktwertNeuRoh = hatEigenenVariantenAnker ? variante.marktwertNeu : geraet.marktwertNeu;
  const marktwertNeuUvpBasis = hatEigenenVariantenAnker ? uvpVariante : uvpBasis;
  const marktwertNeuGeprueft = pruefeMarktwertNeuPlausibilitaet(marktwertNeuRoh, marktwertNeuUvpBasis);
  const marktAnkerNeuUrsprung = marktwertNeuGeprueft != null ? "echt" : "geschaetzt";
  // Bevorzugt den ECHTEN marktwertNeu (variantenscharf, falls vorhanden, siehe oben - sonst vom
  // Katalog geräteweit befüllt, siehe scripts/update-ankaufspreise.js), sonst die Schätzung aus
  // marktwertGebraucht × NEUWARE_AUFSCHLAG. Nur wenn kein eigener Varianten-Anker vorliegt, wird
  // wie bisher proportional über uvpDelta auf die konkrete Variante skaliert (Näherung für
  // Nicht-Basis-Varianten ohne eigenen echten Marktlauf, siehe OFFENE-PUNKTE.md).
  const marktAnkerNeuSchaetzung = marktwertNeuGeprueft != null
    ? (hatEigenenVariantenAnker ? marktwertNeuGeprueft : marktwertNeuGeprueft * verhaeltnis)
    : marktwertGebrauchtVariante * NEUWARE_AUFSCHLAG;

  const eigenerNeu = findeEigenenVerkaufspreis(bestandListe, geraet, variante, "neu");
  const eigenerGebraucht = findeEigenenVerkaufspreis(bestandListe, geraet, variante, "gebraucht");

  return {
    neu: eigenerNeu != null ? eigenerNeu : marktAnkerNeuSchaetzung,
    gebraucht: eigenerGebraucht != null ? eigenerGebraucht : marktwertGebrauchtVariante,
    // Unkollabiert für berechneNeuVersiegelt() (siehe dort): eigenerNeu und
    // marktAnkerNeuSchaetzung werden dort UNABHÄNGIG voneinander verglichen (niedrigerer
    // Wert gewinnt), statt wie oben "eigener Verkauf hat immer Vorrang".
    eigenerNeu,
    marktAnkerNeuSchaetzung,
    marktAnkerNeuUrsprung, // "echt" oder "geschaetzt" - steuert Leitplanke 3 in berechneNeuVersiegelt()
    uvpVariante, // für Leitplanke 1/3 in berechneNeuVersiegelt()
    quelleNeu: eigenerNeu != null ? "eigenerVerkauf" : "marktwert",
    quelleGebraucht: eigenerGebraucht != null ? "eigenerVerkauf" : "marktwert",
  };
}

function liesAnkaufsniveau() {
  try {
    const daten = JSON.parse(fs.readFileSync(NIVEAU_DATEI, "utf8"));
    const prozent = Number(daten.prozent);
    if (!Number.isFinite(prozent)) return 0;
    return Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, prozent));
  } catch (e) {
    return 0; // Datei fehlt/ungültig -> neutral (0 %), kein harter Fehler
  }
}

function schreibeAnkaufsniveau(prozentWert, backupIfChanged) {
  const geklemmt = Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, Number(prozentWert) || 0));
  if (typeof backupIfChanged === "function") backupIfChanged(NIVEAU_DATEI);
  fs.writeFileSync(NIVEAU_DATEI, JSON.stringify({ prozent: geklemmt }, null, 2) + "\n", "utf8");
  return geklemmt;
}

// Berechnet die 5 Ankaufspreis-Stufen für ein Gerät+Variante. bestandListe = Inhalt von
// bestand.json (für den Primäranker). niveauProzent optional, sonst wird pricing-niveau.json
// gelesen. Gibt zusätzlich die verwendete Anker-Quelle zurück (für UI/Reporting).
function berechnePreise(geraet, variante, bestandListe, niveauProzent) {
  const niveau = Number.isFinite(niveauProzent) ? niveauProzent : liesAnkaufsniveau();
  const niveauFaktor = 1 + niveau / 100;
  const wiederverkauf = ermittleWiederverkaufswerte(geraet, variante, bestandListe);
  const prozentsaetze = prozentsaetzeFuerMarke(geraet.marke);

  const ergebnis = {};
  if (istUvpBasierteKategorie(geraet.kategorie)) {
    // UVP-basierte Formel (siehe Kommentarblock oben) - NUR kategorie "smartphones".
    ergebnis.neuVersiegelt = berechneNeuVersiegeltUvpBasiert({
      eigenerVK: wiederverkauf.eigenerNeu,
      marktAnkerNeuEcht: wiederverkauf.marktAnkerNeuUrsprung === "echt" ? wiederverkauf.marktAnkerNeuSchaetzung : null,
      marktAnkerNeu: wiederverkauf.marktAnkerNeuSchaetzung,
      marktAnkerNeuUrsprung: wiederverkauf.marktAnkerNeuUrsprung,
      uvpVariante: wiederverkauf.uvpVariante,
      marke: geraet.marke,
      niveauFaktor,
    });
    const gebraucht = berechneGebrauchtAusNeu(ergebnis.neuVersiegelt, geraet.marke, wiederverkauf.gebraucht);
    ergebnis.wieNeu = gebraucht.wieNeu;
    ergebnis.sehrGut = gebraucht.sehrGut;
    ergebnis.gut = gebraucht.gut;
    // Defekt bewusst unverändert: alte Formel (Prozentsatz vom eBay-Gebraucht-Marktwert).
    ergebnis.defekt = wiederverkauf.gebraucht == null
      ? null
      : rundeAuf5(wiederverkauf.gebraucht * prozentsaetze.defekt * niveauFaktor);
  } else {
    ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
      if (stufe === "neuVersiegelt") {
        ergebnis[stufe] = berechneNeuVersiegelt({
          eigenerVK: wiederverkauf.eigenerNeu,
          marktAnkerNeu: wiederverkauf.marktAnkerNeuSchaetzung,
          marktAnkerNeuUrsprung: wiederverkauf.marktAnkerNeuUrsprung,
          uvpVariante: wiederverkauf.uvpVariante,
          niveauFaktor,
        });
        return;
      }
      ergebnis[stufe] = rundeAuf5(wiederverkauf.gebraucht * prozentsaetze[stufe] * niveauFaktor);
    });
  }

  return {
    preise: ergebnis,
    wiederverkaufswertNeu: wiederverkauf.neu,
    wiederverkaufswertGebraucht: wiederverkauf.gebraucht,
    quelleNeu: wiederverkauf.quelleNeu,
    quelleGebraucht: wiederverkauf.quelleGebraucht,
  };
}

// Konsistenzregel: Ankaufspreis darf nie über dem eigenen Verkaufspreis desselben Modells liegen.
// Gibt eine Liste von Verstößen zurück (leer = alles konsistent).
// Konsistenzregel "Speichergröße": größere Variante (höheres uvpDelta) muss in JEDER
// Zustandsstufe >= der kleineren sein - sonst würde der Ankauf einer kleineren Speichergröße
// mehr zahlen als für eine größere desselben Geräts. Läuft NACH allen anderen Leitplanken
// (Tagesbremse, Konsistenzregel 1/eigener VK, neuVersiegelt-Formel) und nach deren Rundung -
// prüft also das jeweils fertige Endergebnis pro Variante, nicht ein Zwischenergebnis.
//
// Richtung ausschließlich abwärts: bei einem Verstoß wird NUR die kleinere Variante auf das
// Niveau der größeren gekappt, die größere wird nie angehoben (kein zusätzliches Verlustrisiko
// durch diese Regel). preisQuelle "manuell" ist ein Notventil - solche Varianten werden von der
// Regel komplett übersprungen: nie selbst verändert, und ihr Wert wird auch nicht als Referenz
// für Nachbar-Varianten herangezogen (weder als Ober- noch als Untergrenze).
//
// Verfahren pro Zustandsstufe: Varianten nach uvpDelta aufsteigend sortieren, von der GRÖSSTEN
// zur kleinsten durchgehen und eine laufende Obergrenze (ceiling) mitführen. Das garantiert eine
// durchgehend nicht-fallende Kette auch bei 3+ Speicherstufen in einem Durchlauf.
function wendeSpeicherKonsistenzAn(varianten) {
  const aenderungen = [];
  const sortiert = varianten
    .filter((v) => v && v.preise)
    .sort((a, b) => (Number(a.uvpDelta) || 0) - (Number(b.uvpDelta) || 0));

  ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    let ceiling = null;
    for (let i = sortiert.length - 1; i >= 0; i--) {
      const variante = sortiert[i];
      if (variante.preisQuelle === "manuell") continue; // Notventil: weder kappen noch als Referenz nutzen
      let wert = variante.preise[stufe];
      if (wert == null) continue; // keine Zahl in dieser Stufe -> kein Constraint, ceiling bleibt

      if (ceiling != null && wert > ceiling) {
        aenderungen.push({
          bezeichnung: variante.bezeichnung, stufe, alt: wert, neu: ceiling,
        });
        variante.preise[stufe] = ceiling;
        wert = ceiling;
      }
      ceiling = wert;
    }
  });

  return aenderungen;
}

function pruefeKonsistenz(preise, wiederverkaufswerte) {
  const verstoesse = [];
  ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    const referenz = stufe === "neuVersiegelt" ? wiederverkaufswerte.neu : wiederverkaufswerte.gebraucht;
    if (Number.isFinite(referenz) && preise[stufe] > referenz) {
      verstoesse.push({ stufe, ankaufPreis: preise[stufe], eigenerVerkaufspreis: referenz });
    }
  });
  return verstoesse;
}

module.exports = {
  ALTERSFAKTOR_STUFEN,
  ALTERSFAKTOR_JAHRESABSCHLAG,
  ALTERSFAKTOR_MINIMUM,
  ANKAUF_PROZENTSAETZE_APPLE,
  ANKAUF_PROZENTSAETZE_REST,
  prozentsaetzeFuerMarke,
  NEUWARE_AUFSCHLAG,
  NIVEAU_MIN,
  NIVEAU_MAX,
  ZUSTANDS_REIHENFOLGE,
  altersfaktor,
  markenfaktor,
  marktwert,
  ermittleWiederverkaufswerte,
  berechnePreise,
  berechneNeuVersiegelt,
  NEU_VERSIEGELT_EIGENER_VK_ABSCHLAG,
  NEU_VERSIEGELT_MARKTANKER_PROZENT,
  NEU_VERSIEGELT_MARKTANKER_DECKEL,
  NEU_VERSIEGELT_UVP_DECKEL,
  NEU_VERSIEGELT_GESCHAETZT_UVP_DECKEL,
  NEU_VERSIEGELT_MARKTWERT_VERWERFEN_SCHWELLE,
  pruefeMarktwertNeuPlausibilitaet,
  ANKAUF_UVP_PROZENT_NEU,
  NEU_VERSIEGELT_EBAY_KORREKTIV_PROZENT,
  ANKAUF_GEBRAUCHT_PROZENT_VON_NEU_APPLE,
  ANKAUF_GEBRAUCHT_PROZENT_VON_NEU_REST,
  istUvpBasierteKategorie,
  berechneNeuVersiegeltUvpBasiert,
  berechneGebrauchtAusNeu,
  pruefeKonsistenz,
  wendeSpeicherKonsistenzAn,
  liesAnkaufsniveau,
  schreibeAnkaufsniveau,
  rundeAuf5,
  rundeAbAuf5,
  findeEigenenVerkaufspreis,
};

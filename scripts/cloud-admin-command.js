"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { backupIfChanged } = require("./backup-data");

const ROOT = path.join(__dirname, "..");
const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];
const ZUSTAENDE = ["neuVersiegelt", "wieNeu", "sehrGut", "gut", "defekt"];

const DATEIEN = {
  angebote: path.join(ROOT, "angebote.json"),
  ankauf: path.join(ROOT, "ankauf-preise.json"),
  bewertungen: path.join(ROOT, "bewertungen.json"),
  reparaturen: path.join(ROOT, "reparatur-preise.json"),
  preisniveau: path.join(ROOT, "pricing-niveau.json"),
};

function liesJson(datei, fallback) {
  if (!fs.existsSync(datei)) return fallback;
  const text = fs.readFileSync(datei, "utf8").trim();
  return text ? JSON.parse(text) : fallback;
}

function schreibeJson(datei, daten) {
  backupIfChanged(datei);
  fs.writeFileSync(datei, JSON.stringify(daten, null, 2) + "\n", "utf8");
}

function text(wert, max = 500) {
  return String(wert ?? "").trim().slice(0, max);
}

function zahl(wert, min = 0, max = 1_000_000) {
  const n = Number(wert);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function bool(wert) {
  return wert === true || wert === "true";
}

function bildPfad(wert) {
  const eingabe = text(wert, 500);
  if (!eingabe) return "";
  if (/^images\/angebote\/[a-zA-Z0-9._-]+$/.test(eingabe)) return eingabe;
  try {
    const url = new URL(eingabe);
    if (
      url.protocol === "https:" &&
      /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) &&
      url.pathname.startsWith("/storage/v1/object/public/produktbilder/angebote/")
    ) {
      return url.toString();
    }
  } catch {
    // Ungültige oder nicht freigegebene URL wird verworfen.
  }
  return "";
}

function normalesAngebot(input, bestehend) {
  const id = text(bestehend?.id || input?.id || crypto.randomUUID(), 80);
  return {
    id,
    modell: text(input?.modell, 160),
    speicher: text(input?.speicher, 80),
    farbe: text(input?.farbe, 100),
    zustand: input?.zustand === "neu" ? "neu" : "gebraucht",
    preis: zahl(input?.preis),
    altpreis: input?.altpreis === "" || input?.altpreis == null ? null : zahl(input.altpreis),
    bild: bildPfad(input?.bild || bestehend?.bild),
    aktiv: bool(input?.aktiv),
    datum: /^\d{4}-\d{2}-\d{2}$/.test(String(input?.datum || ""))
      ? String(input.datum)
      : bestehend?.datum || new Date().toISOString().slice(0, 10),
  };
}

function angebotSpeichern(liste, payload) {
  if (!Array.isArray(liste)) throw new Error("angebote.json ist keine Liste.");
  const input = payload?.angebot || {};
  const index = input.id ? liste.findIndex((a) => a?.id === input.id) : -1;
  const angebot = normalesAngebot(input, index >= 0 ? liste[index] : null);
  if (!angebot.modell) throw new Error("Modell ist ein Pflichtfeld.");
  const neu = [...liste];
  if (index >= 0) neu[index] = angebot;
  else neu.push(angebot);
  return { daten: neu, ergebnis: angebot };
}

function angebotAktivSetzen(liste, payload) {
  const id = text(payload?.id, 80);
  const index = liste.findIndex((a) => a?.id === id);
  if (index < 0) throw new Error("Angebot nicht gefunden.");
  const neu = [...liste];
  neu[index] = { ...neu[index], aktiv: bool(payload?.aktiv) };
  return { daten: neu, ergebnis: neu[index] };
}

function angebotLoeschen(liste, payload) {
  const id = text(payload?.id, 80);
  const index = liste.findIndex((a) => a?.id === id);
  if (index < 0) throw new Error("Angebot nicht gefunden.");
  const neu = [...liste];
  const [entfernt] = neu.splice(index, 1);
  return { daten: neu, ergebnis: entfernt };
}

function bewertungenNormalisieren(payload) {
  const b = payload?.bewertungen || {};
  return {
    _hinweis: "Nur echte, wörtliche Zitate aus dem Google-Profil eintragen.",
    gesamtnote: zahl(b.gesamtnote, 0, 5),
    anzahlBewertungen: Math.round(zahl(b.anzahlBewertungen, 0, 10_000_000)),
    stand: /^\d{4}-\d{2}-\d{2}$/.test(String(b.stand || "")) ? String(b.stand) : "",
    googleProfilUrl: text(b.googleProfilUrl, 500),
    zitate: Array.isArray(b.zitate)
      ? b.zitate
          .map((z) => ({
            text: text(z?.text, 1200),
            name: text(z?.name, 160),
            sterne: Math.round(zahl(z?.sterne, 1, 5)),
          }))
          .filter((z) => z.text && z.name)
      : [],
  };
}

function reparaturenNormalisieren(payload, bisher) {
  const eintraege = Array.isArray(payload?.reparaturen) ? payload.reparaturen : [];
  const nameEnByName = new Map(
    (Array.isArray(bisher?.reparaturen) ? bisher.reparaturen : []).map((r) => [r.name, r.nameEn || ""])
  );
  return {
    _hinweis:
      "AB-Preise für Standardreparaturen mit Qualitätsersatzteilen - VOM BETREIBER PRÜFEN und ggf. anpassen. " +
      "Endpreis wird immer erst nach kostenloser Diagnose im Laden genannt.",
    reparaturen: eintraege
      .map((r) => {
        const name = text(r?.name, 200);
        return {
          name,
          ...(text(r?.nameEn || nameEnByName.get(name), 200)
            ? { nameEn: text(r?.nameEn || nameEnByName.get(name), 200) }
            : {}),
          abPreis: zahl(r?.abPreis, 0, 100_000),
        };
      })
      .filter((r) => r.name),
  };
}

function ankaufGeraetAktualisieren(listeMitKommentar, payload) {
  if (!Array.isArray(listeMitKommentar)) throw new Error("ankauf-preise.json ist keine Liste.");
  const id = text(payload?.id, 100);
  const geraete = listeMitKommentar.filter((g) => g?.id && g?.kategorie);
  const index = geraete.findIndex((g) => g.id === id);
  if (index < 0) throw new Error("Ankaufsgerät nicht gefunden.");
  const bisher = geraete[index];
  const neueVarianten = Array.isArray(payload?.varianten) ? payload.varianten : [];
  if (neueVarianten.length !== bisher.varianten.length) {
    throw new Error("Varianten dürfen im Preis-Editor weder ergänzt noch entfernt werden.");
  }
  const nachBezeichnung = new Map(neueVarianten.map((v) => [text(v?.bezeichnung, 160), v]));
  const varianten = bisher.varianten.map((alt) => {
    const eingabe = nachBezeichnung.get(alt.bezeichnung);
    if (!eingabe) throw new Error(`Variante fehlt: ${alt.bezeichnung}`);
    const preise = {};
    for (const zustand of ZUSTAENDE) preise[zustand] = zahl(eingabe?.preise?.[zustand]);
    return { ...alt, preise, preisQuelle: "manuell" };
  });
  geraete[index] = { ...bisher, beliebt: bool(payload?.beliebt), varianten };
  const kommentar = listeMitKommentar.find((g) => g?._kommentar);
  return { daten: [...(kommentar ? [kommentar] : []), ...geraete], ergebnis: geraete[index] };
}

function preisniveauNormalisieren(payload) {
  return { prozent: Math.round(zahl(payload?.prozent, -15, 15) * 10) / 10 };
}

function schreibeAnkaufUndSplits(daten) {
  schreibeJson(DATEIEN.ankauf, daten);
  const geraete = daten.filter((g) => g?.id && g?.kategorie);
  for (const kategorie of KATEGORIEN) {
    const datei = path.join(ROOT, "ankauf", `${kategorie}.json`);
    backupIfChanged(datei);
    fs.writeFileSync(datei, JSON.stringify(geraete.filter((g) => g.kategorie === kategorie)), "utf8");
  }
}

function pruefeBasisCommit(erwartet) {
  const erwartetText = text(erwartet, 80);
  const checkoutSha = text(process.env.WEBSITE_ADMIN_CHECKOUT_SHA, 80);
  if (!erwartetText || !checkoutSha) {
    throw new Error("Sicherheitsprüfung fehlgeschlagen: Basis-Commit fehlt.");
  }
  if (erwartetText !== checkoutSha) {
    throw new Error("Die Website wurde zwischenzeitlich geändert. Bitte Admin-Seite neu laden und erneut speichern.");
  }
}

async function fuehreAus(command, payload = {}) {
  pruefeBasisCommit(payload.baseCommit);
  if (command === "angebote.save") {
    const bisher = liesJson(DATEIEN.angebote, []);
    const angewendet = angebotSpeichern(bisher, payload);
    schreibeJson(DATEIEN.angebote, angewendet.daten);
    return angewendet.ergebnis;
  }
  if (command === "angebote.toggle") {
    const angewendet = angebotAktivSetzen(liesJson(DATEIEN.angebote, []), payload);
    schreibeJson(DATEIEN.angebote, angewendet.daten);
    return angewendet.ergebnis;
  }
  if (command === "angebote.delete") {
    const angewendet = angebotLoeschen(liesJson(DATEIEN.angebote, []), payload);
    schreibeJson(DATEIEN.angebote, angewendet.daten);
    if (angewendet.ergebnis?.bild?.startsWith("images/angebote/")) {
      const bildDatei = path.join(ROOT, angewendet.ergebnis.bild);
      if (fs.existsSync(bildDatei)) fs.unlinkSync(bildDatei);
    }
    return { ok: true };
  }
  if (command === "bewertungen.save") {
    const daten = bewertungenNormalisieren(payload);
    schreibeJson(DATEIEN.bewertungen, daten);
    return daten;
  }
  if (command === "reparaturen.save") {
    const bisher = liesJson(DATEIEN.reparaturen, { reparaturen: [] });
    const daten = reparaturenNormalisieren(payload, bisher);
    schreibeJson(DATEIEN.reparaturen, daten);
    return daten;
  }
  if (command === "ankauf.save") {
    const angewendet = ankaufGeraetAktualisieren(liesJson(DATEIEN.ankauf, []), payload);
    schreibeAnkaufUndSplits(angewendet.daten);
    return angewendet.ergebnis;
  }
  if (command === "preisniveau.save") {
    const daten = preisniveauNormalisieren(payload);
    schreibeJson(DATEIEN.preisniveau, daten);
    return daten;
  }
  throw new Error(`Unbekannter Cloud-Admin-Befehl: ${command}`);
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) throw new Error("GITHUB_EVENT_PATH fehlt.");
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const command = text(event?.client_payload?.command, 100);
  const payload = event?.client_payload?.payload || {};
  await fuehreAus(command, payload);
  process.stdout.write(`Cloud-Admin-Befehl erfolgreich: ${command}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  angebotSpeichern,
  angebotAktivSetzen,
  angebotLoeschen,
  bewertungenNormalisieren,
  reparaturenNormalisieren,
  ankaufGeraetAktualisieren,
  preisniveauNormalisieren,
};

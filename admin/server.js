const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const pricing = require("../pricing-config");
const { backupIfChanged } = require("../scripts/backup-data");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "angebote.json");
const IMAGES_DIR = path.join(ROOT, "images", "angebote");
const BESTAND_DATA_FILE = path.join(ROOT, "bestand.json");
const BESTAND_IMAGES_DIR = path.join(ROOT, "images", "bestand");
const ANKAUF_DATA_FILE = path.join(ROOT, "ankauf-preise.json");
const ANKAUF_SPLIT_DIR = path.join(ROOT, "ankauf");
const KATALOG_DATA_FILE = path.join(ROOT, "geraete-katalog.json");
const ANKAUF_KOMMENTAR =
  "AUTO-PLATZHALTER-PREISE – berechnet aus neupreisUvp/jahr/marke über die zentrale Heuristik " +
  "(siehe pricing-config.js im Projekt-Root, 5 Zustandsstufen: neuVersiegelt/wieNeu/sehrGut/gut/defekt). " +
  "preisQuelle \"auto\" wird bei manueller Preisänderung " +
  "im Admin automatisch auf \"manuell\" gesetzt und danach nie mehr automatisch überschrieben. " +
  "Vor Livegang: mindestens die Top-50-Modelle manuell prüfen (siehe PREISE-ANLEITUNG.md).";
const PORT = process.env.PORT || 3000;

const KATEGORIEN = [
  "smartphones", "tablets", "smartwatches", "laptops", "pcs",
  "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
];

const ZUSTANDS_FELDER = pricing.ZUSTANDS_REIHENFOLGE; // ["neuVersiegelt","wieNeu","sehrGut","gut","defekt"]
const rundeAuf5 = pricing.rundeAuf5;

function berechnePreise(uvp, jahr, marke, modell) {
  return pricing.berechnePreise(uvp, jahr, marke, modell);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(ROOT, "images")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function readJsonListe(datei) {
  if (!fs.existsSync(datei)) return [];
  const raw = fs.readFileSync(datei, "utf8");
  return raw.trim() ? JSON.parse(raw) : [];
}

function writeJsonListe(datei, list) {
  backupIfChanged(datei);
  fs.writeFileSync(datei, JSON.stringify(list, null, 2) + "\n", "utf8");
}

function readAngebote() { return readJsonListe(DATA_FILE); }
function writeAngebote(list) { writeJsonListe(DATA_FILE, list); }
function readBestand() { return readJsonListe(BESTAND_DATA_FILE); }
function writeBestand(list) { writeJsonListe(BESTAND_DATA_FILE, list); }

function readAnkauf() {
  return readJsonListe(ANKAUF_DATA_FILE).filter((d) => d && d.id && d.kategorie);
}

function schreibeAnkaufSplits(list) {
  if (!fs.existsSync(ANKAUF_SPLIT_DIR)) fs.mkdirSync(ANKAUF_SPLIT_DIR, { recursive: true });
  KATEGORIEN.forEach((kat) => {
    const teilliste = list.filter((g) => g.kategorie === kat);
    const zielpfad = path.join(ANKAUF_SPLIT_DIR, kat + ".json");
    backupIfChanged(zielpfad);
    fs.writeFileSync(zielpfad, JSON.stringify(teilliste), "utf8");
  });
}

function writeAnkauf(list) {
  writeJsonListe(ANKAUF_DATA_FILE, [{ _kommentar: ANKAUF_KOMMENTAR }, ...list]);
  schreibeAnkaufSplits(list);
}

function preisZahl(wert) {
  const n = Number(wert);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalisiereVarianten(varianten) {
  if (!Array.isArray(varianten)) return [];
  return varianten
    .filter((v) => v && v.bezeichnung)
    .map((v) => {
      const preise = {};
      ZUSTANDS_FELDER.forEach((feld) => {
        preise[feld] = preisZahl(v.preise && v.preise[feld]);
      });
      return {
        bezeichnung: String(v.bezeichnung),
        uvpDelta: Number.isFinite(Number(v.uvpDelta)) ? Number(v.uvpDelta) : 0,
        preise,
        preisQuelle: v.preisQuelle === "auto" ? "auto" : "manuell",
      };
    });
}

async function verkleinereUndSpeichereBild(buffer, id, verzeichnis, relativerPfad) {
  if (!fs.existsSync(verzeichnis)) fs.mkdirSync(verzeichnis, { recursive: true });
  const dateiname = id + ".jpg";
  const zielpfad = path.join(verzeichnis, dateiname);
  await sharp(buffer)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(zielpfad);
  return relativerPfad + "/" + dateiname;
}

app.get("/api/angebote", (req, res) => {
  res.json(readAngebote());
});

app.post("/api/angebote", upload.single("bild"), async (req, res) => {
  try {
    const list = readAngebote();
    const id = crypto.randomUUID();
    const body = req.body;

    let bildPfad = "";
    if (req.file) {
      bildPfad = await verkleinereUndSpeichereBild(req.file.buffer, id, IMAGES_DIR, "images/angebote");
    }

    const angebot = {
      id,
      modell: body.modell || "",
      speicher: body.speicher || "",
      farbe: body.farbe || "",
      zustand: body.zustand === "neu" ? "neu" : "gebraucht",
      preis: Number(body.preis) || 0,
      altpreis: body.altpreis ? Number(body.altpreis) : null,
      bild: bildPfad,
      aktiv: body.aktiv === "true",
      datum: body.datum || new Date().toISOString().slice(0, 10),
    };

    list.push(angebot);
    writeAngebote(list);
    res.status(201).json(angebot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/angebote/:id", upload.single("bild"), async (req, res) => {
  try {
    const list = readAngebote();
    const idx = list.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Angebot nicht gefunden" });

    const body = req.body;
    const bestehend = list[idx];

    let bildPfad = bestehend.bild;
    if (req.file) {
      bildPfad = await verkleinereUndSpeichereBild(req.file.buffer, bestehend.id, IMAGES_DIR, "images/angebote");
    }

    list[idx] = {
      id: bestehend.id,
      modell: body.modell || "",
      speicher: body.speicher || "",
      farbe: body.farbe || "",
      zustand: body.zustand === "neu" ? "neu" : "gebraucht",
      preis: Number(body.preis) || 0,
      altpreis: body.altpreis ? Number(body.altpreis) : null,
      bild: bildPfad,
      aktiv: body.aktiv === "true",
      datum: body.datum || bestehend.datum,
    };

    writeAngebote(list);
    res.json(list[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/angebote/:id/aktiv", (req, res) => {
  const list = readAngebote();
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Angebot nicht gefunden" });
  list[idx].aktiv = !!req.body.aktiv;
  writeAngebote(list);
  res.json(list[idx]);
});

app.delete("/api/angebote/:id", (req, res) => {
  const list = readAngebote();
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Angebot nicht gefunden" });
  const [entfernt] = list.splice(idx, 1);
  writeAngebote(list);

  if (entfernt.bild && entfernt.bild.indexOf("images/angebote/") === 0) {
    fs.unlink(path.join(ROOT, entfernt.bild), () => {});
  }

  res.json({ ok: true });
});

app.get("/api/bestand", (req, res) => {
  res.json(readBestand());
});

app.post("/api/bestand", upload.single("bild"), async (req, res) => {
  try {
    const list = readBestand();
    const id = crypto.randomUUID();
    const body = req.body;

    let bildPfad = "";
    if (req.file) {
      bildPfad = await verkleinereUndSpeichereBild(req.file.buffer, id, BESTAND_IMAGES_DIR, "images/bestand");
    }

    const eintrag = {
      id,
      modell: body.modell || "",
      marke: body.marke || "",
      speicher: body.speicher || "",
      farbe: body.farbe || "",
      kategorie: KATEGORIEN.includes(body.kategorie) ? body.kategorie : "smartphones",
      zustand: body.zustand === "neu" ? "neu" : "gebraucht",
      preis: body.preis ? Number(body.preis) : null,
      bild: bildPfad,
      aktiv: body.aktiv === "true",
      datum: body.datum || new Date().toISOString().slice(0, 10),
    };

    list.push(eintrag);
    writeBestand(list);
    res.status(201).json(eintrag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/bestand/:id", upload.single("bild"), async (req, res) => {
  try {
    const list = readBestand();
    const idx = list.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Eintrag nicht gefunden" });

    const body = req.body;
    const bestehend = list[idx];

    let bildPfad = bestehend.bild;
    if (req.file) {
      bildPfad = await verkleinereUndSpeichereBild(req.file.buffer, bestehend.id, BESTAND_IMAGES_DIR, "images/bestand");
    }

    list[idx] = {
      id: bestehend.id,
      modell: body.modell || "",
      marke: body.marke || "",
      speicher: body.speicher || "",
      farbe: body.farbe || "",
      kategorie: KATEGORIEN.includes(body.kategorie) ? body.kategorie : "smartphones",
      zustand: body.zustand === "neu" ? "neu" : "gebraucht",
      preis: body.preis ? Number(body.preis) : null,
      bild: bildPfad,
      aktiv: body.aktiv === "true",
      datum: body.datum || bestehend.datum,
    };

    writeBestand(list);
    res.json(list[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/bestand/:id/aktiv", (req, res) => {
  const list = readBestand();
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  list[idx].aktiv = !!req.body.aktiv;
  writeBestand(list);
  res.json(list[idx]);
});

app.delete("/api/bestand/:id", (req, res) => {
  const list = readBestand();
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  const [entfernt] = list.splice(idx, 1);
  writeBestand(list);

  if (entfernt.bild && entfernt.bild.indexOf("images/bestand/") === 0) {
    fs.unlink(path.join(ROOT, entfernt.bild), () => {});
  }

  res.json({ ok: true });
});

app.get("/api/katalog", (req, res) => {
  res.json(readJsonListe(KATALOG_DATA_FILE));
});

app.get("/api/ankauf", (req, res) => {
  res.json(readAnkauf());
});

app.post("/api/ankauf", (req, res) => {
  const list = readAnkauf();
  const body = req.body || {};

  const geraet = {
    id: crypto.randomUUID(),
    kategorie: KATEGORIEN.includes(body.kategorie) ? body.kategorie : "smartphones",
    marke: body.marke || "",
    modell: body.modell || "",
    jahr: Number.isFinite(Number(body.jahr)) ? Number(body.jahr) : new Date().getFullYear(),
    neupreisUvp: Number.isFinite(Number(body.neupreisUvp)) ? Number(body.neupreisUvp) : 0,
    beliebt: body.beliebt === true || body.beliebt === "true",
    varianten: normalisiereVarianten(body.varianten),
  };

  list.push(geraet);
  writeAnkauf(list);
  res.status(201).json(geraet);
});

app.put("/api/ankauf/:id", (req, res) => {
  const list = readAnkauf();
  const idx = list.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Gerät nicht gefunden" });

  const body = req.body || {};
  const bestehend = list[idx];

  list[idx] = {
    id: bestehend.id,
    kategorie: KATEGORIEN.includes(body.kategorie) ? body.kategorie : bestehend.kategorie,
    marke: body.marke != null ? body.marke : bestehend.marke,
    modell: body.modell != null ? body.modell : bestehend.modell,
    jahr: Number.isFinite(Number(body.jahr)) ? Number(body.jahr) : bestehend.jahr,
    neupreisUvp: Number.isFinite(Number(body.neupreisUvp)) ? Number(body.neupreisUvp) : bestehend.neupreisUvp,
    beliebt: body.beliebt != null ? (body.beliebt === true || body.beliebt === "true") : !!bestehend.beliebt,
    varianten: body.varianten != null ? normalisiereVarianten(body.varianten) : bestehend.varianten,
  };

  writeAnkauf(list);
  res.json(list[idx]);
});

app.post("/api/ankauf/:id/duplizieren", (req, res) => {
  const list = readAnkauf();
  const original = list.find((g) => g.id === req.params.id);
  if (!original) return res.status(404).json({ error: "Gerät nicht gefunden" });

  const kopie = {
    id: crypto.randomUUID(),
    kategorie: original.kategorie,
    marke: original.marke,
    modell: original.modell + " (Kopie)",
    jahr: original.jahr,
    neupreisUvp: original.neupreisUvp,
    beliebt: false,
    varianten: original.varianten.map((v) => ({
      bezeichnung: v.bezeichnung,
      uvpDelta: v.uvpDelta || 0,
      preise: { ...v.preise },
      preisQuelle: v.preisQuelle,
    })),
  };

  list.push(kopie);
  writeAnkauf(list);
  res.status(201).json(kopie);
});

app.post("/api/ankauf/:id/neu-berechnen", (req, res) => {
  const list = readAnkauf();
  const idx = list.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Gerät nicht gefunden" });

  const geraet = list[idx];
  geraet.varianten = geraet.varianten.map((v) => {
    if (v.preisQuelle === "manuell") return v; // manuelle Preise werden nie automatisch überschrieben
    return {
      ...v,
      preise: berechnePreise(geraet.neupreisUvp + (v.uvpDelta || 0), geraet.jahr, geraet.marke, geraet.modell),
    };
  });

  writeAnkauf(list);
  res.json(geraet);
});

app.delete("/api/ankauf/:id", (req, res) => {
  const list = readAnkauf();
  const idx = list.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Gerät nicht gefunden" });
  list.splice(idx, 1);
  writeAnkauf(list);
  res.json({ ok: true });
});

function passtAufFilter(geraet, filter) {
  if (!filter) return true;
  if (filter.kategorie && filter.kategorie !== "alle" && geraet.kategorie !== filter.kategorie) return false;
  if (filter.marke && filter.marke !== "alle" && geraet.marke !== filter.marke) return false;
  if (filter.preisQuelle && filter.preisQuelle !== "alle") {
    const hatQuelle = geraet.varianten.some((v) => v.preisQuelle === filter.preisQuelle);
    if (!hatQuelle) return false;
  }
  if (filter.suchbegriff) {
    const text = (geraet.marke + " " + geraet.modell).toLowerCase();
    if (text.indexOf(String(filter.suchbegriff).toLowerCase()) === -1) return false;
  }
  return true;
}

function angepassterPreis(alterPreis, einheit, richtung, wert) {
  const vorzeichen = richtung === "senken" ? -1 : 1;
  if (einheit === "prozent") {
    return rundeAuf5(alterPreis * (1 + (vorzeichen * wert) / 100));
  }
  return rundeAuf5(alterPreis + vorzeichen * wert);
}

function berechneMassenanpassung(list, body) {
  const { filter, einheit, richtung, wert } = body;
  const betroffeneGeraete = list.filter((g) => passtAufFilter(g, filter));
  let betroffeneVarianten = 0;
  const beispiele = [];

  betroffeneGeraete.forEach((geraet) => {
    geraet.varianten.forEach((v) => {
      betroffeneVarianten++;
      const alt = { ...v.preise };
      const neu = {};
      ZUSTANDS_FELDER.forEach((feld) => {
        neu[feld] = angepassterPreis(v.preise[feld], einheit, richtung, wert);
      });
      if (beispiele.length < 10) {
        beispiele.push({ geraet: geraet.marke + " " + geraet.modell, variante: v.bezeichnung, alt, neu });
      }
    });
  });

  return { betroffeneGeraeteAnzahl: betroffeneGeraete.length, betroffeneVarianten, beispiele, geraeteIds: betroffeneGeraete.map((g) => g.id) };
}

app.post("/api/ankauf/massenanpassung/vorschau", (req, res) => {
  const list = readAnkauf();
  res.json(berechneMassenanpassung(list, req.body || {}));
});

app.post("/api/ankauf/massenanpassung/anwenden", (req, res) => {
  const list = readAnkauf();
  const body = req.body || {};
  const { einheit, richtung, wert, filter } = body;

  let betroffeneVarianten = 0;
  list.forEach((geraet) => {
    if (!passtAufFilter(geraet, filter)) return;
    geraet.varianten = geraet.varianten.map((v) => {
      betroffeneVarianten++;
      const preise = {};
      ZUSTANDS_FELDER.forEach((feld) => {
        preise[feld] = angepassterPreis(v.preise[feld], einheit, richtung, wert);
      });
      return { ...v, preise, preisQuelle: "manuell" };
    });
  });

  writeAnkauf(list);
  res.json({ ok: true, betroffeneVarianten });
});

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve((stdout || "") + (stderr || ""));
    });
  });
}

// Dateien, deren Eintragsanzahl vor dem Veröffentlichen mit der letzten committeten
// Version verglichen wird (Schutz gegen versehentlichen Datenverlust beim Publish).
const GESCHUETZTE_DATEIEN = [
  "ankauf-preise.json",
  "bestand.json",
  "geraete-katalog.json",
  ...KATEGORIEN.map((k) => "ankauf/" + k + ".json"),
];

function zaehleEintraege(text) {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((d) => d && typeof d === "object" && Object.keys(d).length).length;
  } catch (e) {
    return null;
  }
}

async function pruefeDatenverlust(dateien) {
  const zuPruefen = (dateien || GESCHUETZTE_DATEIEN).filter((d) => GESCHUETZTE_DATEIEN.includes(d));
  const warnungen = [];
  for (const datei of zuPruefen) {
    const vollpfad = path.join(ROOT, datei);
    if (!fs.existsSync(vollpfad)) continue;
    let alterInhalt;
    try {
      alterInhalt = await runGit(["show", "HEAD:" + datei]);
    } catch (e) {
      continue; // Datei war im letzten Commit noch nicht vorhanden -> kein Vergleich möglich
    }
    const alteAnzahl = zaehleEintraege(alterInhalt);
    if (alteAnzahl == null || alteAnzahl === 0) continue;
    const neueAnzahl = zaehleEintraege(fs.readFileSync(vollpfad, "utf8"));
    if (neueAnzahl == null) continue;
    if (neueAnzahl < alteAnzahl * 0.8) {
      warnungen.push({ datei, alt: alteAnzahl, neu: neueAnzahl });
    }
  }
  return warnungen;
}

app.post("/api/publish", async (req, res) => {
  const nachricht = (req.body && req.body.nachricht) || "Angebote aktualisiert";
  const dateien = Array.isArray(req.body && req.body.dateien) && req.body.dateien.length
    ? req.body.dateien
    : null;
  const bestaetigt = !!(req.body && req.body.bestaetigt);
  let log = "";
  try {
    if (!bestaetigt) {
      const warnungen = await pruefeDatenverlust(dateien);
      if (warnungen.length) {
        return res.json({ ok: false, warnung: true, warnungen });
      }
    }
    log += await runGit(dateien ? ["add", ...dateien] : ["add", "-A"]);
    try {
      log += await runGit(["commit", "-m", nachricht]);
    } catch (commitErr) {
      const output = (commitErr.stdout || "") + (commitErr.stderr || "");
      if (/nothing to commit/i.test(output)) {
        log += "Keine Änderungen zum Veröffentlichen.\n";
        return res.json({ ok: true, log });
      }
      throw commitErr;
    }
    log += await runGit(["push"]);
    res.json({ ok: true, log });
  } catch (err) {
    res.status(500).json({ ok: false, log, error: err.stderr || err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log("Mr. Phone Admin läuft auf http://localhost:" + PORT);
});

const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "angebote.json");
const IMAGES_DIR = path.join(ROOT, "images", "angebote");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(ROOT, "images")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function readAngebote() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return raw.trim() ? JSON.parse(raw) : [];
}

function writeAngebote(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2) + "\n", "utf8");
}

async function verkleinereUndSpeichereBild(buffer, id) {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const dateiname = id + ".jpg";
  const zielpfad = path.join(IMAGES_DIR, dateiname);
  await sharp(buffer)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(zielpfad);
  return "images/angebote/" + dateiname;
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
      bildPfad = await verkleinereUndSpeichereBild(req.file.buffer, id);
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
      bildPfad = await verkleinereUndSpeichereBild(req.file.buffer, bestehend.id);
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

app.post("/api/publish", async (req, res) => {
  const nachricht = (req.body && req.body.nachricht) || "Angebote aktualisiert";
  let log = "";
  try {
    log += await runGit(["add", "-A"]);
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

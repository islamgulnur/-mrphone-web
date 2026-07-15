/**
 * Sichert eine Datendatei nach backups/<dateiname>/<ISO-Timestamp>.json - aber nur, wenn
 * sich der Inhalt seit dem letzten Backup tatsächlich geändert hat. Das verhindert eine
 * Backup-Flut durch häufige Speichervorgänge (z. B. Auto-Save-on-blur im Admin), ohne die
 * Sicherheit zu verringern: jede tatsächliche inhaltliche Änderung bekommt ein Backup.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BACKUPS_DIR = path.join(ROOT, "backups");

function letztesBackup(zielOrdner) {
  if (!fs.existsSync(zielOrdner)) return null;
  const dateien = fs.readdirSync(zielOrdner).filter((f) => f.endsWith(".json")).sort();
  if (!dateien.length) return null;
  return path.join(zielOrdner, dateien[dateien.length - 1]);
}

function backupIfChanged(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const inhalt = fs.readFileSync(filePath, "utf8");
  const basename = path.basename(filePath);
  const zielOrdner = path.join(BACKUPS_DIR, basename);

  const letztes = letztesBackup(zielOrdner);
  if (letztes && fs.readFileSync(letztes, "utf8") === inhalt) {
    return null; // unverändert seit letztem Backup, kein neues nötig
  }

  fs.mkdirSync(zielOrdner, { recursive: true });
  const zeitstempel = new Date().toISOString().replace(/[:.]/g, "-");
  const zielDatei = path.join(zielOrdner, zeitstempel + ".json");
  fs.writeFileSync(zielDatei, inhalt, "utf8");
  return zielDatei;
}

module.exports = { backupIfChanged };

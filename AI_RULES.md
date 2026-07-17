# AI_RULES.md – Mr. Phone Website

## Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, and JavaScript (no framework, no build tools). Inter font loaded from Google Fonts.
- **Backend / Admin Panel:** Node.js with Express (`admin/server.js`), local-only (never deployed).
- **File Uploads & Images:** Multer for multipart handling, Sharp for resizing/cropping (max 1000×1000px, JPEG quality 82).
- **Data Storage:** Flat JSON files (no database): `bestand.json`, `angebote.json`, `geraete-katalog.json`, `ankauf-preise.json`, and `ankauf/*.json` per category.
- **Deployment:** GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). Admin commits and pushes, Actions builds.
- **Pricing Engine:** Centralized heuristic in `pricing-config.js` (value depreciation by age, brand factor, condition multipliers, rounding to nearest 5 €).
- **Validation & Backup:** `validate-data.js` for data integrity (exit code 1 on error), `scripts/backup-data.js` with `backupIfChanged()` before every write.
- **Dependencies (admin/):** `express`, `multer` (v2), `sharp` (v0.33). No frontend package manager or npm dependencies.

## Rules

### 1. Use vanilla HTML, CSS, and JavaScript – never add a framework.
No React, Vue, Svelte, or jQuery. Do not introduce npm packages, bundlers, or transpilers to the frontend. The frontend is intentionally zero-build.

### 2. Data files are never regenerated or truncated.
`bestand.json`, `angebote.json`, `geraete-katalog.json`, `ankauf-preise.json`, and `ankauf/*.json` must be edited only at the individual entry level. Never overwrite the entire file unless using the official build scripts (`scripts/build-*`). Always load, modify, and write back – never replace with a new array that drops entries.

### 3. Back up every data file before writing.
Use `scripts/backup-data.js` (`backupIfChanged(filePath)`) immediately before `fs.writeFileSync` for any data file. The admin server already does this; scripts and manual edits must as well.

### 4. Never modify `preisQuelle: "manuell"` variants.
Variants with `preisQuelle: "manuell"` have been manually set by the shop owner and must **never** be overwritten by scripts, automation, or bulk operations. Only `"auto"` variants may be recalculated.

### 5. All pricing logic lives in `pricing-config.js`.
The formula (age depreciation, brand factor, condition multipliers, rounding to nearest 5 €) is defined once in `pricing-config.js` and imported by `admin/server.js` and `scripts/build-ankauf-preise.js`. Never duplicate the pricing formula elsewhere.

### 6. Run `node validate-data.js` after every data change.
Exit code 0 must pass before committing. Validation checks: valid JSON, correct structure, minimum device counts per category, consistency between `ankauf-preise.json` and `ankauf/*.json`, and preisQuelle values.

### 7. Category split files must stay in sync with the master file.
`ankauf/*.json` files are generated from `ankauf-preise.json` by `schreibeAnkaufSplits()`. The admin server does this automatically on every save. If manually editing, update both or ensure consistency.

### 8. Admin is local-only, never deployed.
The `admin/` directory is excluded from GitHub Pages deployment (`deploy.yml` uses `rsync --exclude='admin'`). Start locally with `cd admin && npm start`.

### 9. Images go through Sharp resizing.
Use `sharp` to resize to max 1000×1000px, JPEG quality 82, from the buffer. Admin server's `verkleinereUndSpeichereBild()` is the canonical implementation – reuse or reference it.

### 10. Git is the save/publish mechanism.
Saving in the admin writes JSON files locally. Publishing (`/api/publish`) runs `git add`, `git commit`, `git push`. Data loss detection prevents pushes if entry count drops >20% vs parent commit.
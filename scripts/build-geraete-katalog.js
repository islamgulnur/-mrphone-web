/**
 * Erzeugt geraete-katalog.json aus dem Vollkatalog (Marke -> Modell -> Varianten -> Jahr/UVP).
 * Reine Katalog-Metadaten, KEINE Preise (Preise kommen aus build-ankauf-preise.js).
 *
 * Ausführen: node scripts/build-geraete-katalog.js
 *
 * Der Datenblock in DIESEM Skript ist die eigentliche "single source of truth" für
 * neue/geänderte Modelle - Änderungen gehören hierher, nicht direkt in die JSON-Ausgabe
 * (sonst gehen sie beim nächsten Lauf verloren). Ausnahme: Admin-UI-Ergänzungen einzelner
 * Exoten ("Sonstiges Modell") landen direkt in der JSON und werden von diesem Skript nicht
 * angefasst, solange es nicht erneut ausgeführt wird.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(ROOT, "geraete-katalog.json");

let idCounter = 1;
function nextId() {
  return "kat-" + String(idCounter++).padStart(4, "0");
}

// ---------------------------------------------------------------------------
// Speicher-Varianten: absolute UVP-Aufschlagstabelle relativ zu einer virtuellen
// 0-Basis. uvpDelta einer Variante = ABS(variante) - ABS(kleinste Variante der Liste).
// Näherungswerte, analog zu den bisherigen Auto-Preisen - editierbar im Admin.
const ABS_TABLE = { 16: 0, 32: 35, 64: 80, 128: 130, 256: 230, 512: 430, 1024: 680, 2048: 980 };

function parseToken(tok) {
  const t = tok.trim();
  if (/TB$/i.test(t)) {
    const num = parseFloat(t) * 1024;
    return { gb: num, bezeichnung: t.replace(/TB$/i, " TB") };
  }
  const num = parseInt(t, 10);
  return { gb: num, bezeichnung: t + " GB" };
}

function makeVarianten(variantenStr) {
  const tokens = variantenStr.split("/").map(parseToken);
  const minAbs = Math.min(...tokens.map((t) => (ABS_TABLE[t.gb] != null ? ABS_TABLE[t.gb] : t.gb)));
  return tokens.map((t) => {
    const abs = ABS_TABLE[t.gb] != null ? ABS_TABLE[t.gb] : t.gb;
    return { bezeichnung: t.bezeichnung, uvpDelta: Math.round(abs - minAbs) };
  });
}

function dev(kategorie, marke, modell, jahr, uvp, variantenStrOrArray) {
  const varianten = Array.isArray(variantenStrOrArray)
    ? variantenStrOrArray
    : makeVarianten(variantenStrOrArray);
  return { id: nextId(), kategorie, marke, modell, jahr, uvp, varianten };
}

// ---------------------------------------------------------------------------
// Parser für die regelmäßig strukturierten Blöcke "Modell: Speicher | UVP€ | Jahr"
// (Apple / Samsung / Google / Xiaomi-Redmi-Poco Smartphones).
const ZEILE_REGEX = /^(.+?):\s*([0-9]+(?:TB)?(?:\/[0-9]+(?:TB)?)*)\s*\|\s*([0-9]+)€?\s*\|\s*([0-9]{4})$/;

function parseBlock(kategorie, marke, text) {
  return text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((zeile) => {
      const m = ZEILE_REGEX.exec(zeile);
      if (!m) throw new Error("Konnte Zeile nicht parsen (" + marke + "): " + zeile);
      const [, modell, variantenStr, uvp, jahr] = m;
      return dev(kategorie, marke, modell.trim(), parseInt(jahr, 10), parseInt(uvp, 10), variantenStr);
    });
}

// ===========================================================================
// SMARTPHONES
// ===========================================================================

const APPLE_TEXT = `
iPhone 8: 64/128/256 | 799€ | 2017; iPhone 8 Plus: 64/128/256 | 909€ | 2017; iPhone X: 64/256 | 1149€ | 2017; iPhone XR: 64/128/256 | 849€ | 2018; iPhone XS: 64/256/512 | 1149€ | 2018; iPhone XS Max: 64/256/512 | 1249€ | 2018; iPhone 11: 64/128/256 | 799€ | 2019; iPhone 11 Pro: 64/256/512 | 1149€ | 2019; iPhone 11 Pro Max: 64/256/512 | 1249€ | 2019; iPhone SE 2020: 64/128/256 | 479€ | 2020; iPhone 12 mini: 64/128/256 | 779€ | 2020; iPhone 12: 64/128/256 | 899€ | 2020; iPhone 12 Pro: 128/256/512 | 1149€ | 2020; iPhone 12 Pro Max: 128/256/512 | 1249€ | 2020; iPhone 13 mini: 128/256/512 | 799€ | 2021; iPhone 13: 128/256/512 | 899€ | 2021; iPhone 13 Pro: 128/256/512/1TB | 1149€ | 2021; iPhone 13 Pro Max: 128/256/512/1TB | 1249€ | 2021; iPhone SE 2022: 64/128/256 | 519€ | 2022; iPhone 14: 128/256/512 | 999€ | 2022; iPhone 14 Plus: 128/256/512 | 1149€ | 2022; iPhone 14 Pro: 128/256/512/1TB | 1299€ | 2022; iPhone 14 Pro Max: 128/256/512/1TB | 1449€ | 2022; iPhone 15: 128/256/512 | 949€ | 2023; iPhone 15 Plus: 128/256/512 | 1099€ | 2023; iPhone 15 Pro: 128/256/512/1TB | 1199€ | 2023; iPhone 15 Pro Max: 256/512/1TB | 1449€ | 2023; iPhone 16: 128/256/512 | 949€ | 2024; iPhone 16 Plus: 128/256/512 | 1099€ | 2024; iPhone 16 Pro: 128/256/512/1TB | 1199€ | 2024; iPhone 16 Pro Max: 256/512/1TB | 1449€ | 2024; iPhone 16e: 128/256/512 | 699€ | 2025; iPhone 17: 256/512 | 949€ | 2025; iPhone 17 Air: 256/512/1TB | 1249€ | 2025; iPhone 17 Pro: 256/512/1TB | 1299€ | 2025; iPhone 17 Pro Max: 256/512/1TB/2TB | 1449€ | 2025
`;

const SAMSUNG_TEXT = `
Galaxy S8: 64 | 799€ | 2017; Galaxy S8+: 64 | 899€ | 2017; Galaxy S9: 64/256 | 849€ | 2018; Galaxy S9+: 64/256 | 949€ | 2018; Galaxy S10e: 128 | 749€ | 2019; Galaxy S10: 128/512 | 899€ | 2019; Galaxy S10+: 128/512/1TB | 999€ | 2019; Galaxy S20: 128 | 899€ | 2020; Galaxy S20+: 128/512 | 999€ | 2020; Galaxy S20 Ultra: 128/512 | 1349€ | 2020; Galaxy S20 FE: 128/256 | 649€ | 2020; Galaxy S21: 128/256 | 849€ | 2021; Galaxy S21+: 128/256 | 1049€ | 2021; Galaxy S21 Ultra: 128/256/512 | 1249€ | 2021; Galaxy S21 FE: 128/256 | 749€ | 2022; Galaxy S22: 128/256 | 849€ | 2022; Galaxy S22+: 128/256 | 1049€ | 2022; Galaxy S22 Ultra: 128/256/512/1TB | 1249€ | 2022; Galaxy S23: 128/256 | 949€ | 2023; Galaxy S23+: 256/512 | 1199€ | 2023; Galaxy S23 Ultra: 256/512/1TB | 1399€ | 2023; Galaxy S23 FE: 128/256 | 699€ | 2023; Galaxy S24: 128/256 | 899€ | 2024; Galaxy S24+: 256/512 | 1149€ | 2024; Galaxy S24 Ultra: 256/512/1TB | 1449€ | 2024; Galaxy S24 FE: 128/256 | 749€ | 2024; Galaxy S25: 128/256 | 899€ | 2025; Galaxy S25+: 256/512 | 1149€ | 2025; Galaxy S25 Ultra: 256/512/1TB | 1449€ | 2025; Galaxy S25 Edge: 256/512 | 1249€ | 2025; Galaxy S25 FE: 128/256 | 749€ | 2025; Galaxy S26: 256/512 | 899€ | 2026; Galaxy S26+: 256/512 | 1149€ | 2026; Galaxy S26 Ultra: 256/512/1TB | 1449€ | 2026; Galaxy Note 9: 128/512 | 999€ | 2018; Galaxy Note 10: 256 | 949€ | 2019; Galaxy Note 10+: 256/512 | 1099€ | 2019; Galaxy Note 20: 256 | 949€ | 2020; Galaxy Note 20 Ultra: 256/512 | 1299€ | 2020; Galaxy Z Flip 3: 128/256 | 1049€ | 2021; Galaxy Z Flip 4: 128/256/512 | 1099€ | 2022; Galaxy Z Flip 5: 256/512 | 1199€ | 2023; Galaxy Z Flip 6: 256/512 | 1199€ | 2024; Galaxy Z Flip 7: 256/512 | 1199€ | 2025; Galaxy Z Fold 3: 256/512 | 1799€ | 2021; Galaxy Z Fold 4: 256/512/1TB | 1799€ | 2022; Galaxy Z Fold 5: 256/512/1TB | 1899€ | 2023; Galaxy Z Fold 6: 256/512/1TB | 1999€ | 2024; Galaxy Z Fold 7: 256/512/1TB | 2099€ | 2025; Galaxy A14: 64/128 | 199€ | 2023; Galaxy A15: 128 | 199€ | 2024; Galaxy A16: 128/256 | 229€ | 2024; Galaxy A17: 128/256 | 249€ | 2025; Galaxy A25: 128/256 | 299€ | 2024; Galaxy A26: 128/256 | 299€ | 2025; Galaxy A34: 128/256 | 389€ | 2023; Galaxy A35: 128/256 | 379€ | 2024; Galaxy A36: 128/256 | 379€ | 2025; Galaxy A54: 128/256 | 489€ | 2023; Galaxy A55: 128/256 | 479€ | 2024; Galaxy A56: 128/256 | 479€ | 2025
`;

const GOOGLE_TEXT = `
Pixel 6: 128/256 | 649€ | 2021; Pixel 6 Pro: 128/256/512 | 899€ | 2021; Pixel 6a: 128 | 459€ | 2022; Pixel 7: 128/256 | 649€ | 2022; Pixel 7 Pro: 128/256/512 | 899€ | 2022; Pixel 7a: 128 | 509€ | 2023; Pixel 8: 128/256 | 799€ | 2023; Pixel 8 Pro: 128/256/512 | 1099€ | 2023; Pixel 8a: 128/256 | 549€ | 2024; Pixel 9: 128/256 | 899€ | 2024; Pixel 9 Pro: 128/256/512 | 1099€ | 2024; Pixel 9 Pro XL: 128/256/512/1TB | 1199€ | 2024; Pixel 9 Pro Fold: 256/512 | 1899€ | 2024; Pixel 9a: 128/256 | 549€ | 2025; Pixel 10: 128/256 | 899€ | 2025; Pixel 10 Pro: 128/256/512 | 1099€ | 2025; Pixel 10 Pro XL: 256/512/1TB | 1299€ | 2025; Pixel 10 Pro Fold: 256/512 | 1899€ | 2025
`;

const XIAOMI_TEXT = `
Xiaomi 12: 128/256 | 749€ | 2022; Xiaomi 13: 256 | 999€ | 2023; Xiaomi 13T Pro: 256/512 | 799€ | 2023; Xiaomi 14: 256/512 | 999€ | 2024; Xiaomi 14T Pro: 256/512 | 799€ | 2024; Xiaomi 15: 256/512 | 999€ | 2025; Xiaomi 15T Pro: 256/512 | 799€ | 2025; Xiaomi 17: 256/512 | 999€ | 2025; Xiaomi 17 Ultra: 512/1TB | 1499€ | 2026; Redmi Note 11: 64/128 | 199€ | 2022; Redmi Note 12: 64/128 | 229€ | 2023; Redmi Note 13: 128/256 | 229€ | 2024; Redmi Note 13 Pro: 256/512 | 399€ | 2024; Redmi Note 14: 128/256 | 229€ | 2025; Redmi Note 14 Pro: 256/512 | 399€ | 2025; Redmi Note 15 Pro: 256 | 399€ | 2025; Redmi Note 15 Pro+: 256/512 | 499€ | 2025; Redmi 14C: 128/256 | 129€ | 2024; Redmi 15C: 128/256 | 129€ | 2025; Poco X6 Pro: 256/512 | 369€ | 2024; Poco X7 Pro: 256/512 | 369€ | 2025; Poco F6 Pro: 256/512 | 599€ | 2024; Poco F7 Pro: 256/512 | 599€ | 2025
`;

function parseMultiMarke(kategorie, text) {
  return text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((zeile) => {
      const m = ZEILE_REGEX.exec(zeile);
      if (!m) throw new Error("Konnte Zeile nicht parsen: " + zeile);
      const [, modellRoh, variantenStr, uvp, jahr] = m;
      const modellRohTrim = modellRoh.trim();
      let marke = "Xiaomi";
      let modell = modellRohTrim;
      if (/^Redmi\s+/i.test(modellRohTrim)) {
        marke = "Redmi";
        modell = modellRohTrim.replace(/^Redmi\s+/i, "");
      } else if (/^Poco\s+/i.test(modellRohTrim)) {
        marke = "Poco";
        modell = modellRohTrim.replace(/^Poco\s+/i, "");
      } else if (/^Xiaomi\s+/i.test(modellRohTrim)) {
        modell = modellRohTrim.replace(/^Xiaomi\s+/i, "");
      }
      return dev(kategorie, marke, modell, parseInt(jahr, 10), parseInt(uvp, 10), variantenStr);
    });
}

const smartphonesApple = parseBlock("smartphones", "Apple", APPLE_TEXT);
const smartphonesSamsung = parseBlock("smartphones", "Samsung", SAMSUNG_TEXT);
const smartphonesGoogle = parseBlock("smartphones", "Google", GOOGLE_TEXT);
const smartphonesXiaomiGroup = parseMultiMarke("smartphones", XIAOMI_TEXT);

// Weitere Marken: unregelmäßiges Format im Ausgangstext -> von Hand erfasst.
const smartphonesWeitere = [
  dev("smartphones", "OnePlus", "8 Pro", 2020, 899, "128/256"),
  dev("smartphones", "OnePlus", "9", 2021, 699, "128/256"),
  dev("smartphones", "OnePlus", "9 Pro", 2021, 899, "128/256"),
  dev("smartphones", "OnePlus", "10 Pro", 2022, 899, "128/256"),
  dev("smartphones", "OnePlus", "11", 2023, 849, "128/256"),
  dev("smartphones", "OnePlus", "12", 2024, 949, "256/512"),
  dev("smartphones", "OnePlus", "13", 2025, 1049, "256/512"),
  dev("smartphones", "OnePlus", "Nord 3", 2023, 449, "128/256"),
  dev("smartphones", "OnePlus", "Nord 4", 2024, 499, "256/512"),
  dev("smartphones", "Huawei", "P30", 2019, 749, "128"),
  dev("smartphones", "Huawei", "P30 Pro", 2019, 999, "128/256"),
  dev("smartphones", "Huawei", "P40 Pro", 2020, 999, "256"),
  dev("smartphones", "Huawei", "P50 Pro", 2021, 1199, "256"),
  dev("smartphones", "Huawei", "P60 Pro", 2023, 1199, "256/512"),
  dev("smartphones", "Huawei", "Mate 20 Pro", 2018, 999, "128"),
  dev("smartphones", "Huawei", "Mate 40 Pro", 2020, 1199, "256"),
  dev("smartphones", "Huawei", "Nova-Serie (Sammelmodell)", 2022, 399, "128/256"),
  dev("smartphones", "Sony", "Xperia 1 IV", 2022, 1399, "256"),
  dev("smartphones", "Sony", "Xperia 1 V", 2023, 1399, "256"),
  dev("smartphones", "Sony", "Xperia 1 VI", 2024, 1399, "256/512"),
  dev("smartphones", "Sony", "Xperia 1 VII", 2025, 1499, "256/512"),
  dev("smartphones", "Sony", "Xperia 5 IV", 2022, 1049, "128"),
  dev("smartphones", "Sony", "Xperia 5 V", 2023, 999, "128"),
  dev("smartphones", "Sony", "Xperia 10 V", 2023, 449, "128"),
  dev("smartphones", "Sony", "Xperia 10 VI", 2024, 449, "128"),
  dev("smartphones", "Sony", "Xperia 10 VII", 2025, 449, "128"),
  dev("smartphones", "Nothing", "Phone (1)", 2022, 469, "128/256"),
  dev("smartphones", "Nothing", "Phone (2)", 2023, 649, "256/512"),
  dev("smartphones", "Nothing", "Phone (2a)", 2024, 329, "128/256"),
  dev("smartphones", "Nothing", "Phone (3)", 2025, 799, "256/512"),
  dev("smartphones", "Motorola", "Edge 40", 2023, 599, "256"),
  dev("smartphones", "Motorola", "Edge 50 Pro", 2024, 699, "512"),
  dev("smartphones", "Motorola", "Razr 50 Ultra", 2024, 1199, "512"),
  dev("smartphones", "Motorola", "Razr 60 Ultra", 2025, 1299, "512"),
  dev("smartphones", "Oppo", "Find X5 Pro", 2022, 1299, "256"),
  dev("smartphones", "Oppo", "Reno 10 Pro", 2023, 799, "256"),
  dev("smartphones", "Oppo", "Reno 12 Pro", 2024, 799, "512"),
  dev("smartphones", "Honor", "Magic 5 Pro", 2023, 1199, "512"),
  dev("smartphones", "Honor", "Magic 6 Pro", 2024, 1299, "512"),
  dev("smartphones", "Honor", "Magic 7 Pro", 2025, 1299, "512"),
  dev("smartphones", "Honor", "90", 2023, 549, "256/512"),
  dev("smartphones", "Honor", "200 Pro", 2024, 699, "512"),
  dev("smartphones", "Nokia", "G22", 2023, 189, "64/128"),
  dev("smartphones", "Nokia", "X30", 2022, 519, "128/256"),
  dev("smartphones", "Nokia", "105/110/150 (Neuware-Sammelposten)", 2023, 39, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
];

// ===========================================================================
// TABLETS
// ===========================================================================
const tabletsApple = [
  dev("tablets", "Apple", "iPad 7 (2019)", 2019, 379, "32/128"),
  dev("tablets", "Apple", "iPad 8 (2020)", 2020, 379, "32/128"),
  dev("tablets", "Apple", "iPad 9 (2021)", 2021, 379, "64/256"),
  dev("tablets", "Apple", "iPad 10 (2022)", 2022, 579, "64/256"),
  dev("tablets", "Apple", "iPad 11 (2025)", 2025, 399, "128/256/512"),
  dev("tablets", "Apple", "iPad Air 3 (2019)", 2019, 549, "64/256"),
  dev("tablets", "Apple", "iPad Air 4 (2020)", 2020, 649, "64/256"),
  dev("tablets", "Apple", "iPad Air 5 (2022)", 2022, 769, "64/256"),
  dev("tablets", "Apple", "iPad Air 6 11\" (2024)", 2024, 699, "128/256/512/1TB"),
  dev("tablets", "Apple", "iPad Air 6 13\" (2024)", 2024, 949, "128/256/512/1TB"),
  dev("tablets", "Apple", "iPad Air 7 (2025)", 2025, 699, "128/256/512"),
  dev("tablets", "Apple", "iPad Mini 5 (2019)", 2019, 449, "64/256"),
  dev("tablets", "Apple", "iPad Mini 6 (2021)", 2021, 549, "64/256"),
  dev("tablets", "Apple", "iPad Mini 7 (2024)", 2024, 599, "128/256/512"),
  dev("tablets", "Apple", "iPad Pro 11\" Gen 1 (2018)", 2018, 879, "128/256/512/1TB"),
  dev("tablets", "Apple", "iPad Pro 11\" Gen 2 (2020)", 2020, 929, "128/256/512/1TB"),
  dev("tablets", "Apple", "iPad Pro 11\" Gen 3 (2021)", 2021, 979, "128/256/512/1TB/2TB"),
  dev("tablets", "Apple", "iPad Pro 11\" Gen 4 (2022)", 2022, 1079, "128/256/512/1TB/2TB"),
  dev("tablets", "Apple", "iPad Pro 11\" Gen 5 (2024)", 2024, 1199, "256/512/1TB/2TB"),
  dev("tablets", "Apple", "iPad Pro 12.9\" Gen 3 (2018)", 2018, 1099, "128/256/512/1TB"),
  dev("tablets", "Apple", "iPad Pro 12.9\" Gen 4 (2020)", 2020, 1149, "128/256/512/1TB"),
  dev("tablets", "Apple", "iPad Pro 12.9\" Gen 5 (2021)", 2021, 1199, "128/256/512/1TB/2TB"),
  dev("tablets", "Apple", "iPad Pro 12.9\" Gen 6 (2022)", 2022, 1449, "128/256/512/1TB/2TB"),
  dev("tablets", "Apple", "iPad Pro 13\" Gen 7 (2024, M4)", 2024, 1549, "256/512/1TB/2TB"),
];

const tabletsAndere = [
  dev("tablets", "Samsung", "Galaxy Tab S7", 2020, 699, "128"),
  dev("tablets", "Samsung", "Galaxy Tab S7+", 2020, 899, "128/256"),
  dev("tablets", "Samsung", "Galaxy Tab S8", 2022, 749, "128/256"),
  dev("tablets", "Samsung", "Galaxy Tab S8+", 2022, 949, "128/256"),
  dev("tablets", "Samsung", "Galaxy Tab S8 Ultra", 2022, 1149, "128/256/512"),
  dev("tablets", "Samsung", "Galaxy Tab S9", 2023, 799, "128/256"),
  dev("tablets", "Samsung", "Galaxy Tab S9+", 2023, 999, "256/512"),
  dev("tablets", "Samsung", "Galaxy Tab S9 Ultra", 2023, 1199, "256/512/1TB"),
  dev("tablets", "Samsung", "Galaxy Tab S9 FE", 2023, 499, "128/256"),
  dev("tablets", "Samsung", "Galaxy Tab S10", 2024, 849, "128/256"),
  dev("tablets", "Samsung", "Galaxy Tab S10+", 2024, 1049, "256/512"),
  dev("tablets", "Samsung", "Galaxy Tab S10 Ultra", 2024, 1249, "256/512/1TB"),
  dev("tablets", "Samsung", "Galaxy Tab S11", 2025, 899, "128/256"),
  dev("tablets", "Samsung", "Galaxy Tab S11+", 2025, 1149, "256/512"),
  dev("tablets", "Samsung", "Galaxy Tab S11 Ultra", 2025, 1339, "256/512/1TB"),
  dev("tablets", "Samsung", "Galaxy Tab A8", 2022, 229, "32/64"),
  dev("tablets", "Samsung", "Galaxy Tab A9", 2023, 219, "64/128"),
  dev("tablets", "Samsung", "Galaxy Tab A11", 2025, 279, "64/128"),
  dev("tablets", "Xiaomi", "Pad 6", 2023, 399, "128/256"),
  dev("tablets", "Xiaomi", "Pad 7", 2024, 499, "256/512"),
  dev("tablets", "Lenovo", "Tab P12", 2023, 399, "128/256"),
];

// ===========================================================================
// SMARTWATCHES
// ===========================================================================
function appleWatchGen(modell, jahr, uvp) {
  return [
    dev("smartwatches", "Apple", modell + " (GPS)", jahr, uvp, [{ bezeichnung: "GPS", uvpDelta: 0 }]),
    dev("smartwatches", "Apple", modell + " (GPS + Cellular)", jahr, uvp + 90, [{ bezeichnung: "GPS + Cellular", uvpDelta: 0 }]),
  ];
}
const smartwatches = [
  ...appleWatchGen("Watch Series 4", 2018, 429),
  ...appleWatchGen("Watch Series 5", 2019, 449),
  ...appleWatchGen("Watch Series 6", 2020, 439),
  ...appleWatchGen("Watch Series 7", 2021, 429),
  ...appleWatchGen("Watch Series 8", 2022, 449),
  ...appleWatchGen("Watch Series 9", 2023, 449),
  ...appleWatchGen("Watch Series 10", 2024, 449),
  ...appleWatchGen("Watch Series 11", 2025, 549),
  dev("smartwatches", "Apple", "Watch Ultra", 2022, 999, [{ bezeichnung: "49mm", uvpDelta: 0 }]),
  dev("smartwatches", "Apple", "Watch Ultra 2", 2023, 899, [{ bezeichnung: "49mm", uvpDelta: 0 }]),
  dev("smartwatches", "Apple", "Watch Ultra 3", 2025, 899, [{ bezeichnung: "49mm", uvpDelta: 0 }]),
  dev("smartwatches", "Apple", "Watch SE (1. Gen)", 2020, 279, [{ bezeichnung: "GPS", uvpDelta: 0 }]),
  dev("smartwatches", "Apple", "Watch SE (2. Gen)", 2022, 299, [{ bezeichnung: "GPS", uvpDelta: 0 }]),
  dev("smartwatches", "Apple", "Watch SE 3", 2025, 299, [{ bezeichnung: "GPS", uvpDelta: 0 }]),
  dev("smartwatches", "Samsung", "Galaxy Watch 4", 2021, 269, "40mm/44mm"),
  dev("smartwatches", "Samsung", "Galaxy Watch 5", 2022, 299, "40mm/44mm"),
  dev("smartwatches", "Samsung", "Galaxy Watch 5 Pro", 2022, 449, [{ bezeichnung: "45mm", uvpDelta: 0 }]),
  dev("smartwatches", "Samsung", "Galaxy Watch 6", 2023, 319, "40mm/44mm"),
  dev("smartwatches", "Samsung", "Galaxy Watch 6 Classic", 2023, 419, "43mm/47mm"),
  dev("smartwatches", "Samsung", "Galaxy Watch 7", 2024, 319, "40mm/44mm"),
  dev("smartwatches", "Samsung", "Galaxy Watch Ultra", 2024, 649, [{ bezeichnung: "47mm", uvpDelta: 0 }]),
  dev("smartwatches", "Samsung", "Galaxy Watch 8", 2025, 349, "40mm/44mm"),
  dev("smartwatches", "Samsung", "Galaxy Watch 8 Classic", 2025, 499, [{ bezeichnung: "46mm", uvpDelta: 0 }]),
  dev("smartwatches", "Samsung", "Galaxy Watch Ultra 2", 2025, 699, [{ bezeichnung: "47mm", uvpDelta: 0 }]),
  dev("smartwatches", "Garmin", "Fenix 7", 2022, 699, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Garmin", "Fenix 8", 2024, 999, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Garmin", "Epix 2", 2022, 899, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Garmin", "Forerunner 255", 2022, 349, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Garmin", "Forerunner 265", 2023, 449, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Garmin", "Forerunner 955", 2022, 599, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Garmin", "Forerunner 965", 2023, 649, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Huawei", "Watch GT 3", 2021, 229, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Huawei", "Watch GT 4", 2023, 249, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("smartwatches", "Huawei", "Watch GT 5", 2024, 299, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
];

// ===========================================================================
// LAPTOPS
// ===========================================================================
const laptops = [
  dev("laptops", "Apple", "MacBook Air 13\" M1 (2020)", 2020, 1129, "256/512"),
  dev("laptops", "Apple", "MacBook Air 13\" M2 (2022)", 2022, 1199, "256/512/1TB"),
  dev("laptops", "Apple", "MacBook Air 15\" M2 (2023)", 2023, 1599, "256/512/1TB"),
  dev("laptops", "Apple", "MacBook Air 13\" M3 (2024)", 2024, 1199, "256/512/1TB"),
  dev("laptops", "Apple", "MacBook Air 15\" M3 (2024)", 2024, 1599, "256/512/1TB"),
  dev("laptops", "Apple", "MacBook Air 13\" M4 (2025)", 2025, 1199, "256/512/1TB"),
  dev("laptops", "Apple", "MacBook Air 15\" M4 (2025)", 2025, 1599, "256/512/1TB"),
  dev("laptops", "Apple", "MacBook Pro 13\" M1/M2 (2020-2022)", 2021, 1449, "256/512/1TB"),
  dev("laptops", "Apple", "MacBook Pro 14\" M1 Pro/Max (2021)", 2021, 2499, "512/1TB/2TB"),
  dev("laptops", "Apple", "MacBook Pro 14\" M2 Pro/Max (2023)", 2023, 2199, "512/1TB/2TB"),
  dev("laptops", "Apple", "MacBook Pro 14\" M3 Pro/Max (2023)", 2023, 2199, "512/1TB/2TB"),
  dev("laptops", "Apple", "MacBook Pro 14\" M4 Pro/Max (2024)", 2024, 1999, "512/1TB/2TB"),
  dev("laptops", "Apple", "MacBook Pro 16\" M1 Pro/Max (2021)", 2021, 2899, "512/1TB/2TB"),
  dev("laptops", "Apple", "MacBook Pro 16\" M2 Pro/Max (2023)", 2023, 2899, "512/1TB/2TB"),
  dev("laptops", "Apple", "MacBook Pro 16\" M3 Pro/Max (2023)", 2023, 2899, "512/1TB/2TB"),
  dev("laptops", "Apple", "MacBook Pro 16\" M4 Pro/Max (2024)", 2024, 2499, "512/1TB/2TB"),
  dev("laptops", "Lenovo", "ThinkPad (Business-Klasse)", 2023, 1299, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 350 }, { bezeichnung: "32GB/1TB", uvpDelta: 800 },
  ]),
  dev("laptops", "Lenovo", "IdeaPad (Consumer-Klasse)", 2023, 699, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 250 }, { bezeichnung: "32GB/1TB", uvpDelta: 600 },
  ]),
  dev("laptops", "HP", "EliteBook (Business-Klasse)", 2023, 1399, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 350 }, { bezeichnung: "32GB/1TB", uvpDelta: 800 },
  ]),
  dev("laptops", "HP", "Pavilion (Consumer-Klasse)", 2023, 699, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 250 }, { bezeichnung: "32GB/1TB", uvpDelta: 600 },
  ]),
  dev("laptops", "Dell", "XPS (Premium-Klasse)", 2023, 1499, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 350 }, { bezeichnung: "32GB/1TB", uvpDelta: 800 },
  ]),
  dev("laptops", "Dell", "Latitude (Business-Klasse)", 2023, 1199, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 350 }, { bezeichnung: "32GB/1TB", uvpDelta: 800 },
  ]),
  dev("laptops", "Asus", "ZenBook (Premium-Klasse)", 2023, 1099, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 300 }, { bezeichnung: "32GB/1TB", uvpDelta: 700 },
  ]),
  dev("laptops", "Asus", "VivoBook (Consumer-Klasse)", 2023, 649, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 250 }, { bezeichnung: "32GB/1TB", uvpDelta: 600 },
  ]),
  dev("laptops", "Acer", "Swift (Premium-Klasse)", 2023, 999, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 300 }, { bezeichnung: "32GB/1TB", uvpDelta: 700 },
  ]),
  dev("laptops", "Acer", "Aspire (Consumer-Klasse)", 2023, 599, [
    { bezeichnung: "8GB/256GB", uvpDelta: 0 }, { bezeichnung: "16GB/512GB", uvpDelta: 250 }, { bezeichnung: "32GB/1TB", uvpDelta: 600 },
  ]),
];

// ===========================================================================
// PCS & MONITORE (Klassen, Vor-Ort-Prüfungs-Hinweis via Kategorie-Hinweis im Rechner)
// ===========================================================================
const pcs = [
  dev("pcs", "Sonstige", "Gaming-PC (RTX 3060/3070/3080)", 2021, 1199, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("pcs", "Sonstige", "Gaming-PC (RTX 4060-4090)", 2023, 1699, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("pcs", "Sonstige", "Gaming-PC (RTX 5070-5090)", 2025, 2199, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("pcs", "Sonstige", "Office-PC", 2022, 599, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("pcs", "Apple", "iMac 24\" M1", 2021, 1449, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("pcs", "Apple", "iMac 24\" M3", 2023, 1599, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("pcs", "Apple", "iMac 24\" M4", 2024, 1699, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
];
const monitore = [
  dev("monitore", "Sonstige", "Monitor 24\" (60-75Hz)", 2022, 199, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("monitore", "Sonstige", "Monitor 27\" (144Hz)", 2022, 349, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("monitore", "Sonstige", "Monitor 27\" (240Hz)", 2023, 549, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("monitore", "Sonstige", "Monitor 32\" (144Hz)", 2023, 499, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("monitore", "Sonstige", "Monitor OLED (27\"-34\")", 2024, 899, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
];

// ===========================================================================
// KOPFHÖRER & AUDIO
// ===========================================================================
const kopfhoerer = [
  dev("kopfhoerer", "Apple", "AirPods 2", 2019, 159, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Apple", "AirPods 3", 2021, 179, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Apple", "AirPods 4", 2024, 149, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Apple", "AirPods Pro", 2019, 249, [{ bezeichnung: "1. Gen", uvpDelta: 0 }]),
  dev("kopfhoerer", "Apple", "AirPods Pro 2", 2022, 279, [{ bezeichnung: "2. Gen", uvpDelta: 0 }]),
  dev("kopfhoerer", "Apple", "AirPods Pro 3", 2025, 249, [{ bezeichnung: "3. Gen", uvpDelta: 0 }]),
  dev("kopfhoerer", "Apple", "AirPods Max", 2020, 579, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Samsung", "Galaxy Buds 2", 2021, 149, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Samsung", "Galaxy Buds 2 Pro", 2022, 229, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Samsung", "Galaxy Buds 3", 2024, 179, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Samsung", "Galaxy Buds 3 Pro", 2024, 249, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Sony", "WH-1000XM3", 2018, 349, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Sony", "WH-1000XM4", 2020, 379, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Sony", "WH-1000XM5", 2022, 399, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Sony", "WH-1000XM6", 2024, 449, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Sony", "WF-1000XM4", 2021, 279, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Sony", "WF-1000XM5", 2023, 279, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Bose", "QuietComfort 45", 2021, 279, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Bose", "QuietComfort Ultra", 2023, 449, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Bose", "QuietComfort Earbuds II", 2022, 299, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "Bose", "QuietComfort Ultra Earbuds", 2023, 329, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kopfhoerer", "JBL", "Topmodelle (Sammelposten)", 2023, 199, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
];

// ===========================================================================
// KAMERAS
// ===========================================================================
const kameras = [
  dev("kameras", "Canon", "EOS R5", 2020, 4499, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Canon", "EOS R6", 2020, 2499, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Canon", "EOS R6 II", 2022, 2699, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Canon", "EOS R7", 2022, 1549, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Canon", "EOS R8", 2023, 1879, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Canon", "EOS R10", 2022, 1099, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Canon", "EOS R50", 2023, 879, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "Alpha 6400", 2019, 999, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "Alpha 6700", 2023, 1499, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "Alpha A7 III", 2018, 1999, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "Alpha A7 IV", 2021, 2799, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "Alpha A7C", 2020, 1999, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "Alpha A7C II", 2023, 2199, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "ZV-E10", 2021, 799, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Sony", "ZV-1", 2020, 749, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Nikon", "Z5", 2020, 1699, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Nikon", "Z6 II", 2020, 2199, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Nikon", "Z6 III", 2024, 2999, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Nikon", "Z8", 2023, 4599, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Nikon", "Zf", 2023, 2299, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Fujifilm", "X-T4", 2020, 1749, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Fujifilm", "X-T5", 2022, 1799, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Fujifilm", "X-S20", 2023, 1299, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Fujifilm", "X100V", 2020, 1399, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "Fujifilm", "X100VI", 2024, 1699, [{ bezeichnung: "Gehäuse", uvpDelta: 0 }]),
  dev("kameras", "GoPro", "Hero 9", 2020, 349, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "GoPro", "Hero 10", 2021, 379, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "GoPro", "Hero 11", 2022, 399, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "GoPro", "Hero 12", 2023, 429, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "GoPro", "Hero 13", 2024, 449, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "DJI", "Osmo Pocket 3", 2023, 519, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "DJI", "Osmo Action 4", 2023, 399, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "DJI", "Osmo Action 5", 2024, 379, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("kameras", "Sonstige", "Objektive (individuelle Preisanfrage)", 2023, 0, [{ bezeichnung: "Preis auf Anfrage", uvpDelta: 0 }]),
];

// ===========================================================================
// SPIELEKONSOLEN
// ===========================================================================
const konsolen = [
  dev("konsolen", "Sony", "PlayStation 4 500GB", 2013, 299, [{ bezeichnung: "500GB", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "PlayStation 4 1TB", 2013, 299, [{ bezeichnung: "1TB", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "PlayStation 4 Pro 1TB", 2016, 399, [{ bezeichnung: "1TB", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "PlayStation 5 (Disc)", 2020, 549, [{ bezeichnung: "Disc-Version", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "PlayStation 5 (Digital)", 2020, 449, [{ bezeichnung: "Digital-Version", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "PlayStation 5 Slim (Disc)", 2023, 549, [{ bezeichnung: "Disc-Version", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "PlayStation 5 Slim (Digital)", 2023, 449, [{ bezeichnung: "Digital-Version", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "PlayStation 5 Pro", 2024, 799, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Microsoft", "Xbox One", 2013, 299, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Microsoft", "Xbox One S", 2016, 299, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Microsoft", "Xbox One X", 2017, 499, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Microsoft", "Xbox Series S", 2020, 299, "512GB/1TB"),
  dev("konsolen", "Microsoft", "Xbox Series X", 2020, 549, [{ bezeichnung: "1TB", uvpDelta: 0 }]),
  dev("konsolen", "Nintendo", "Switch (V1)", 2017, 329, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Nintendo", "Switch (V2)", 2019, 329, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Nintendo", "Switch Lite", 2019, 219, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Nintendo", "Switch OLED", 2021, 349, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Nintendo", "Switch 2", 2025, 469, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Valve", "Steam Deck LCD", 2022, 419, "256GB/512GB"),
  dev("konsolen", "Valve", "Steam Deck OLED", 2023, 569, "512GB/1TB"),
  dev("konsolen", "Sony", "DualSense Controller", 2020, 69, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Sony", "DualSense Edge Controller", 2023, 239, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Microsoft", "Xbox Wireless Controller", 2020, 59, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Microsoft", "Xbox Elite Controller 2", 2019, 179, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("konsolen", "Nintendo", "Pro Controller", 2017, 69, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
];

// ===========================================================================
// ZUBEHÖR
// ===========================================================================
const zubehoer = [
  dev("zubehoer", "Apple", "Apple Pencil (1. Gen)", 2015, 99, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("zubehoer", "Apple", "Apple Pencil 2", 2018, 135, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("zubehoer", "Apple", "Apple Pencil Pro", 2024, 149, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("zubehoer", "Apple", "Apple Pencil (USB-C)", 2023, 89, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("zubehoer", "Apple", "Magic Keyboard für iPad", 2020, 349, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("zubehoer", "Apple", "AirTag", 2021, 35, [{ bezeichnung: "1er", uvpDelta: 0 }, { bezeichnung: "4er-Pack", uvpDelta: 84 }]),
  dev("zubehoer", "Apple", "Apple TV 4K", 2022, 169, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("zubehoer", "Apple", "HomePod", 2023, 349, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
  dev("zubehoer", "Apple", "HomePod mini", 2020, 99, [{ bezeichnung: "Standard", uvpDelta: 0 }]),
];

// ===========================================================================
// Zusammenführen & schreiben
// ===========================================================================
const alle = [
  ...smartphonesApple,
  ...smartphonesSamsung,
  ...smartphonesGoogle,
  ...smartphonesXiaomiGroup,
  ...smartphonesWeitere,
  ...tabletsApple,
  ...tabletsAndere,
  ...smartwatches,
  ...laptops,
  ...pcs,
  ...monitore,
  ...kopfhoerer,
  ...kameras,
  ...konsolen,
  ...zubehoer,
];

fs.writeFileSync(OUT_FILE, JSON.stringify(alle, null, 2) + "\n", "utf8");

const byKat = {};
alle.forEach((d) => { byKat[d.kategorie] = (byKat[d.kategorie] || 0) + 1; });
console.log("geraete-katalog.json geschrieben:", alle.length, "Geräte");
console.log(byKat);

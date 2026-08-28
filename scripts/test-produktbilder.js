#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { sichereBildUrl, trefferScore, waehleTreffer } = require("./update-produktbilder");
const { findeBild } = require("./build-produktseiten");

const gruppe = { marke: "Samsung", modell: "Galaxy S25" };
function bild(title, extra = {}) {
  return {
    title,
    source: "wikimedia",
    mature: false,
    license: "by-sa",
    url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/test.jpg",
    ...extra,
  };
}

assert.strictEqual(trefferScore(gruppe, bild("Samsung Galaxy S25")), 100);
assert.ok(trefferScore(gruppe, bild("Samsung Galaxy S25 Silver")) >= 84);
assert.strictEqual(trefferScore(gruppe, bild("Samsung Galaxy S25 Ultra")), 0);
assert.strictEqual(trefferScore(gruppe, bild("Samsung Galaxy S25+")), 0);
assert.strictEqual(trefferScore(gruppe, bild("第一手 Samsung Galaxy S25 series")), 0);
assert.strictEqual(trefferScore(gruppe, bild("Samsung Galaxy S25 Case")), 0);
assert.strictEqual(trefferScore(gruppe, bild("Samsung Galaxy S25", { license: "by-nc" })), 0);
assert.strictEqual(trefferScore(gruppe, bild("Samsung Galaxy S25", { removed_from_source: true })), 0);
assert.strictEqual(trefferScore(gruppe, bild("Samsung Galaxy S25", { url: "https://example.com/test.jpg" })), 0);
assert.strictEqual(waehleTreffer(gruppe, [bild("Samsung Galaxy S25 Ultra"), bild("Samsung Galaxy S25")]).title, "Samsung Galaxy S25");
assert.strictEqual(sichereBildUrl("https://upload.wikimedia.org/wikipedia/commons/a/a1/test.png"), true);
assert.strictEqual(sichereBildUrl("http://upload.wikimedia.org/test.jpg"), false);
assert.strictEqual(findeBild({ slug: "xiaomi-17t", items: [], marke: "Xiaomi", modell: "17T" }, [{ slug: "xiaomi-17t", url: "/images/produkte/xiaomi-17t.webp", name: "xiaomi-17t.webp" }]), "/images/produkte/xiaomi-17t.webp");
assert.strictEqual(findeBild({ slug: "apple-iphone-11", items: [], marke: "Apple", modell: "iPhone 11" }, [{ slug: "apple-iphone-11-pro-max", url: "/images/produkte/apple-iphone-11-pro-max.webp", name: "apple-iphone-11-pro-max.webp" }]), "");

const mainJs = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
assert.ok(mainJs.includes('"/images/produkte/" + produktSlug(a) + ".webp"'), "Sortiment nutzt keine automatischen Modellbilder");
assert.ok(mainJs.includes("Vorschaubild · Farbe kann abweichen"), "Farbhinweis im Sortiment fehlt");

console.log("Produktbild-Automatik: Modell-, Lizenz- und Quellenschutz erfolgreich geprüft.");

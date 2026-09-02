#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const HOST = "mrphone-frankfurt.de";
const BASE_URL = `https://${HOST}`;
const KEY = "aeeaa9d94af2647196535cff2480b6b2";
const KEY_FILE = `${KEY}.txt`;

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : "";
}

function urlForFile(file) {
  const clean = file.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!clean.endsWith(".html") || /^(?:admin|templates|\.design-preview|\.worktrees)\//.test(clean)) return null;
  if (clean === "index.html") return `${BASE_URL}/`;
  if (clean.endsWith("/index.html")) return `${BASE_URL}/${clean.slice(0, -"index.html".length)}`;
  return `${BASE_URL}/${clean}`;
}

function sitemapUrls() {
  const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

function changedUrls(before, after) {
  if (process.argv.includes("--all")) return sitemapUrls();
  if (!/^[0-9a-f]{40}$/i.test(before) || !/^[0-9a-f]{40}$/i.test(after) || /^0+$/.test(before)) return sitemapUrls();
  const output = execFileSync("git", ["diff", "--name-only", before, after, "--", "*.html", "en", "ratgeber", "produkte"], { cwd: ROOT, encoding: "utf8" });
  return output.split(/\r?\n/).map(urlForFile).filter(Boolean);
}

function post(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request({
      hostname: "api.indexnow.org",
      path: "/IndexNow",
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) },
      timeout: 20000,
    }, (response) => {
      response.resume();
      response.on("end", () => response.statusCode >= 200 && response.statusCode < 300
        ? resolve(response.statusCode)
        : reject(new Error(`IndexNow antwortete mit HTTP ${response.statusCode}.`)));
    });
    request.on("timeout", () => request.destroy(new Error("IndexNow-Zeitüberschreitung.")));
    request.on("error", reject);
    request.end(body);
  });
}

async function main() {
  if (fs.readFileSync(path.join(ROOT, KEY_FILE), "utf8").trim() !== KEY) throw new Error("IndexNow-Schlüsseldatei ist ungültig.");
  const urls = [...new Set(changedUrls(argument("before"), argument("after")))];
  if (!urls.length) {
    console.log("Keine geänderten öffentlichen HTML-Seiten für IndexNow.");
    return;
  }
  if (process.argv.includes("--dry-run")) {
    console.log(`IndexNow Dry-Run: ${urls.length} URL(s)\n${urls.join("\n")}`);
    return;
  }
  const status = await post({ host: HOST, key: KEY, keyLocation: `${BASE_URL}/${KEY_FILE}`, urlList: urls });
  console.log(`IndexNow: ${urls.length} geänderte URL(s) gemeldet (HTTP ${status}).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

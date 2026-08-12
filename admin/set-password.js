// Einmalig ausführen, um E-Mail + Passwort für den Admin-Login festzulegen (oder später zu
// ändern): `node set-password.js`. Schreibt admin/auth-config.json (per .gitignore vom Repo
// ausgeschlossen) - Passwort wird NIE im Klartext gespeichert, nur als scrypt-Hash + Salt.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const AUTH_CONFIG_FILE = path.join(__dirname, "auth-config.json");

function fragePasswortVerdecktTTY(text) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(text);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    let passwort = "";
    function onData(zeichen) {
      if (zeichen === "\r" || zeichen === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(passwort);
        return;
      }
      if (zeichen === "") process.exit(1); // Strg+C
      if (zeichen === "") { passwort = passwort.slice(0, -1); return; } // Backspace
      passwort += zeichen;
    }
    stdin.on("data", onData);
  });
}

async function main() {
  // Async-Iterator statt rl.question(): rl.question() verliert bei Pipe-Input (kein
  // TTY) manchmal die zweite Frage, weil der Input-Stream direkt nach der letzten
  // Zeile endet und das close-Event mit der zweiten question()-Registrierung
  // racet. Der Async-Iterator liest bereits gepufferte Zeilen zuverlässig nach.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const zeilen = rl[Symbol.asyncIterator]();

  process.stdout.write("Admin-E-Mail: ");
  const emailZeile = await zeilen.next();
  const email = (emailZeile.value || "").trim();
  if (!email || email.indexOf("@") === -1) {
    rl.close();
    console.error("Ungültige E-Mail-Adresse.");
    process.exit(1);
  }

  let passwort;
  if (process.stdin.isTTY) {
    rl.close();
    passwort = await fragePasswortVerdecktTTY("Admin-Passwort (mind. 8 Zeichen): ");
  } else {
    // Kein echtes Terminal (z. B. Pipe/CI) - Eingabe sichtbar statt versteckt, aber
    // wenigstens funktionsfähig statt Absturz durch fehlendes setRawMode.
    process.stdout.write("Admin-Passwort (mind. 8 Zeichen): ");
    const passwortZeile = await zeilen.next();
    passwort = passwortZeile.value || "";
    rl.close();
  }
  if (!passwort || passwort.length < 8) {
    console.error("Passwort zu kurz (mind. 8 Zeichen).");
    process.exit(1);
  }

  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.scryptSync(passwort, salt, 64);
  const sessionSecret = crypto.randomBytes(32);

  const config = {
    email: email.toLowerCase(),
    salt: salt.toString("hex"),
    passwordHash: passwordHash.toString("hex"),
    sessionSecret: sessionSecret.toString("hex"),
  };

  fs.writeFileSync(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log("Admin-Zugangsdaten gespeichert in " + AUTH_CONFIG_FILE);
  console.log("Admin-Server neu starten, damit die Änderung wirkt.");
}

main();

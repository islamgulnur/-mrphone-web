/**
 * Zentrale Ankaufspreis-Heuristik.
 *
 * Verwendet von:
 *   - admin/server.js       ("Neu berechnen", Massenanpassungs-Basiswerte)
 *   - scripts/build-ankauf-preise.js (Erstbefüllung aus geraete-katalog.json)
 *
 * Änderungen hier wirken sich NICHT rückwirkend auf bereits gespeicherte Preise aus,
 * sondern erst beim nächsten "Neu berechnen" bzw. beim nächsten Lauf des Build-Skripts.
 * preisQuelle:"manuell" gesetzte Varianten werden von keiner Funktion hier automatisch
 * überschrieben – das bleibt Aufgabe der aufrufenden Stelle (dort prüfen!).
 */

// Marktwert-Erhalt nach Gerätealter in vollen Jahren (0 = aktuelles Modelljahr).
// Jahre 0-5 fest, danach linear -0,04 pro weiterem Jahr, nie unter dem Minimum.
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

// Zustandsfaktoren wirken direkt auf den Marktwert (nicht mehr verkettet über "neu" wie in
// der alten 4-Stufen-Formel).
const ZUSTANDSFAKTOREN = {
  neuVersiegelt: 0.88,
  wieNeu: 0.78,
  sehrGut: 0.70,
  gut: 0.58,
  defekt: 0.22,
};

// Reihenfolge, in der die 5 Stufen überall (UI, Validierung, Export) angezeigt werden.
const ZUSTANDS_REIHENFOLGE = ["neuVersiegelt", "wieNeu", "sehrGut", "gut", "defekt"];

function rundeAuf5(zahl) {
  return Math.max(5, Math.round(zahl / 5) * 5);
}

function berechnePreise(uvp, jahr, marke, modell, referenzjahr) {
  const markt = marktwert(uvp, jahr, marke, modell, referenzjahr);
  const ergebnis = {};
  ZUSTANDS_REIHENFOLGE.forEach((stufe) => {
    ergebnis[stufe] = rundeAuf5(markt * ZUSTANDSFAKTOREN[stufe]);
  });
  return ergebnis;
}

module.exports = {
  ALTERSFAKTOR_STUFEN,
  ALTERSFAKTOR_JAHRESABSCHLAG,
  ALTERSFAKTOR_MINIMUM,
  ZUSTANDSFAKTOREN,
  ZUSTANDS_REIHENFOLGE,
  altersfaktor,
  markenfaktor,
  marktwert,
  berechnePreise,
  rundeAuf5,
};

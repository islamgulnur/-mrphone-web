"use strict";

function sauber(wert) {
  return String(wert || "").trim().replace(/\s+/g, " ");
}

function normalisiert(wert) {
  return sauber(wert).toLocaleLowerCase("de-DE");
}

function speicherFormat(wert) {
  return sauber(wert).replace(/(\d+)\s*(TB|GB)/gi, (_, zahl, einheit) => `${zahl} ${einheit.toUpperCase()}`);
}

function schluessel(marke, modell, speicher, zustand) {
  return [marke, modell, speicherFormat(speicher), zustand].map(normalisiert).join("|");
}

function pruefeDeckelPayload(payload) {
  if (!payload || payload.ok !== true || !Array.isArray(payload.daten)) throw new Error("POS-Ankaufdeckel haben nicht das erwartete Format.");
  for (const item of payload.daten) {
    if (!item.marke || !item.modell || !["neu", "gebraucht"].includes(item.zustand) || !(Number(item.maximaler_ankaufspreis) > 0)) {
      throw new Error("POS-Ankaufdeckel enthalten einen unvollständigen Eintrag.");
    }
  }
  return payload;
}

function stufenDeckel(basisDeckel, zustand) {
  const basis = Math.floor(Number(basisDeckel) / 5) * 5;
  if (!(basis > 0)) return {};
  if (zustand === "neu") return { neuVersiegelt: basis };
  return {
    wieNeu: basis,
    sehrGut: Math.floor((basis * 0.95) / 5) * 5,
    gut: Math.floor((basis * 0.85) / 5) * 5,
    schlecht: Math.floor((basis * 0.70) / 5) * 5,
    defekt: Math.floor((basis * 0.35) / 5) * 5,
  };
}

module.exports = { pruefeDeckelPayload, schluessel, stufenDeckel };

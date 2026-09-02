(function () {
  "use strict";

  var POS_URL = "https://mrphone-pos.vercel.app/api/public/bestand";

  function sauber(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  }

  function slugify(value) {
    return sauber(value)
      .replace(/ß/g, "ss").replace(/&/g, " und ").replace(/\+/g, " plus ")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  }

  function euro(value) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value));
  }

  function gruppiereSichtbareAngebote(items) {
    var gruppen = new Map();
    items.forEach(function (item) {
      var key = [sauber(item.speicher), sauber(item.farbe), sauber(item.zustand)]
        .map(function (wert) { return wert.toLocaleLowerCase("de-DE"); })
        .join("|");
      var preis = Number(item.preis);
      var vorhanden = gruppen.get(key);
      if (vorhanden) {
        vorhanden.menge += Number(item.menge) || 0;
        vorhanden.preisMin = Math.min(vorhanden.preisMin, preis);
        vorhanden.preisMax = Math.max(vorhanden.preisMax, preis);
      } else {
        gruppen.set(key, {
          speicher: sauber(item.speicher), farbe: sauber(item.farbe), zustand: sauber(item.zustand),
          menge: Number(item.menge) || 0, preisMin: preis, preisMax: preis
        });
      }
    });
    return Array.from(gruppen.values()).sort(function (a, b) { return a.preisMin - b.preisMin; });
  }

  function preisSpanne(item) {
    return item.preisMin === item.preisMax ? euro(item.preisMin) : euro(item.preisMin) + "–" + euro(item.preisMax);
  }

  function zustand(value) {
    var text = sauber(value).toLowerCase();
    if (text === "neu") return "Neu";
    if (text === "wie neu") return "Wie neu";
    if (text === "sehr gut") return "Sehr gut";
    if (text === "gut") return "Gut";
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Gebraucht";
  }

  function ladeLiveBestand() {
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 5000);
    return fetch(POS_URL, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then(function (antwort) {
        if (!antwort.ok) throw new Error("POS nicht erreichbar");
        return antwort.json();
      })
      .then(function (payload) {
        if (!payload || payload.ok !== true || !Array.isArray(payload.daten)) throw new Error("POS-Antwort ungültig");
        return payload.daten;
      })
      .finally(function () { window.clearTimeout(timeout); });
  }

  function angebotElement(item, index, produktname) {
    var artikel = document.createElement("article");
    artikel.className = "produkt-angebot";
    artikel.id = "angebot-live-" + (index + 1);

    var info = document.createElement("div");
    var titel = document.createElement("h2");
    titel.textContent = [sauber(item.speicher), sauber(item.farbe)].filter(Boolean).join(" · ") || "Standardausführung";
    var meta = document.createElement("p");
    var badge = document.createElement("span");
    var istNeu = sauber(item.zustand).toLowerCase() === "neu";
    badge.className = "produkt-badge " + (istNeu ? "produkt-badge--neu" : "produkt-badge--gebraucht");
    badge.textContent = zustand(item.zustand);
    meta.appendChild(badge);
    meta.appendChild(document.createTextNode(" " + (Number(item.menge) === 1 ? "1 Stück verfügbar" : Number(item.menge) + " Stück verfügbar")));
    info.appendChild(titel);
    info.appendChild(meta);

    var preis = document.createElement("strong");
    preis.textContent = preisSpanne(item);
    var link = document.createElement("a");
    link.className = "produkt-btn produkt-btn--klein";
    link.target = "_blank";
    link.rel = "noopener";
    link.href = "https://wa.me/496995632281?text=" + encodeURIComponent("Hallo, ich interessiere mich für das " + produktname + " aus Ihrem Sortiment. Ist es noch verfügbar?");
    link.textContent = "Verfügbarkeit anfragen";
    artikel.appendChild(info);
    artikel.appendChild(preis);
    artikel.appendChild(link);
    return artikel;
  }

  function aktualisieren() {
    var container = document.querySelector(".produkt-angebote[data-produkt-slug]");
    if (!container) return;
    var slug = container.getAttribute("data-produkt-slug");
    var produktname = (document.querySelector("h1")?.textContent || "Gerät").replace(/\s+in Frankfurt kaufen\s*$/, "");

    ladeLiveBestand().then(function (daten) {
      var treffer = daten.filter(function (item) { return slugify([item.marke, item.modell].filter(Boolean).join(" ")) === slug; });
      if (!treffer.length) {
        container.innerHTML = '<p class="produkt-ausverkauft">Dieses Modell ist im POS aktuell nicht mehr als verfügbar eingetragen. Fragen Sie uns gerne nach einer Alternative.</p>';
        var beschreibung = document.querySelector("[data-live-beschreibung]");
        if (beschreibung) beschreibung.textContent = "Dieses Modell ist aktuell ausverkauft. Unser Team hilft Ihnen gerne bei einer passenden Alternative.";
        return;
      }
      treffer = gruppiereSichtbareAngebote(treffer);
      container.replaceChildren.apply(container, treffer.map(function (item, index) { return angebotElement(item, index, produktname); }));
      var abPreis = document.querySelector("[data-live-abpreis]");
      if (abPreis) abPreis.textContent = euro(treffer[0].preisMin);
      var beschreibung = document.querySelector("[data-live-beschreibung]");
      if (beschreibung) beschreibung.textContent = treffer.length === 1
        ? "Dieses Gerät ist aktuell bei uns auf der Zeil verfügbar. Der Preis wurde gerade live aus unserem POS geladen."
        : "Wählen Sie aus " + treffer.length + " aktuell verfügbaren Varianten. Preise und Bestand wurden gerade live aus unserem POS geladen.";
    }).catch(function () {
      // Bei einem kurzen POS-Ausfall bleibt der letzte veröffentlichte Stand sichtbar.
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aktualisieren);
  else aktualisieren();
})();

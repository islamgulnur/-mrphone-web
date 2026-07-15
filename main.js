/* Mr. Phone – Frankfurt Zeil: Scroll-Reveal, Zähler, Produktbereich */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll-Reveal ---------- */
  function revealElements(items) {
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  function initReveal() {
    revealElements(document.querySelectorAll(".reveal"));
  }

  /* ---------- Animierte Zähler ---------- */
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-counter-target"));
    if (isNaN(target)) return;
    var suffix = el.getAttribute("data-counter-suffix") || "";
    var duration = 1600;

    if (reduceMotion) {
      el.textContent = target + suffix;
      return;
    }

    var start = null;
    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.round(eased * target);
      el.textContent = value + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target + suffix;
      }
    }
    window.requestAnimationFrame(step);
  }

  function initCounters() {
    var items = document.querySelectorAll("[data-counter-target]");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(animateCounter);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Aktuelle Angebote ---------- */
  var WHATSAPP_NUMBER = "496995632281";

  function formatPreis(preis) {
    var num = Number(preis);
    return num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function buildAngebotWhatsappUrl(a) {
    var bezeichnung = [a.modell, a.speicher, a.farbe].filter(Boolean).join(" ");
    var text = "Hallo, ich interessiere mich für das Angebot " + bezeichnung + " für " + formatPreis(a.preis) + "€";
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function garantieHinweis(zustand) {
    return zustand === "neu" ? "1–2 Jahre Herstellergarantie" : "6 Monate Garantie";
  }

  function angebotCardHtml(a) {
    var istNeu = a.zustand === "neu";
    var badgeClass = istNeu ? "badge-neu" : "badge-gebraucht";
    var badgeText = istNeu ? "Neu" : "Gebraucht";
    var titel = [a.modell, a.speicher, a.farbe].filter(Boolean).join(" · ");
    var hatAltpreis = a.altpreis != null && Number(a.altpreis) > Number(a.preis);
    var altpreisHtml = hatAltpreis
      ? ' <span class="angebot-oldprice">' + formatPreis(a.altpreis) + " €</span>"
      : "";

    return (
      '<article class="angebot-card reveal">' +
      '<div class="angebot-media"><img src="' + escapeHtml(a.bild) + '" alt="' +
      escapeHtml(titel) +
      '" width="800" height="800" loading="lazy"></div>' +
      '<div class="angebot-body">' +
      '<span class="angebot-badge ' + badgeClass + '">' + badgeText + "</span>" +
      "<h3>" + escapeHtml(titel) + "</h3>" +
      '<p class="angebot-price">' + formatPreis(a.preis) + " €" + altpreisHtml + "</p>" +
      '<p class="angebot-warranty">' + garantieHinweis(a.zustand) + "</p>" +
      '<a href="' + buildAngebotWhatsappUrl(a) + '" class="btn btn-primary" target="_blank" rel="noopener">Per WhatsApp anfragen</a>' +
      "</div>" +
      "</article>"
    );
  }

  function initAktuelleAngebote() {
    var section = document.getElementById("aktuelle-angebote");
    var grid = document.getElementById("angebote-grid");
    if (!section || !grid) return;

    fetch("angebote.json")
      .then(function (res) {
        if (!res.ok) throw new Error("angebote.json nicht erreichbar");
        return res.json();
      })
      .then(function (data) {
        var alle = Array.isArray(data) ? data : [];
        var aktive = alle.filter(function (a) { return a.aktiv === true; });
        if (!aktive.length) return;

        aktive.sort(function (a, b) { return (b.datum || "").localeCompare(a.datum || ""); });

        grid.innerHTML = aktive.map(angebotCardHtml).join("");
        section.hidden = false;
        revealElements(grid.querySelectorAll(".reveal"));
      })
      .catch(function () {
        /* Sektion bleibt ausgeblendet (Standardzustand via hidden-Attribut) */
      });
  }

  /* ---------- Unser Sortiment (Live-Bestand) ---------- */
  function buildBestandWhatsappUrl(a) {
    var bezeichnung = [a.modell, a.speicher, a.farbe].filter(Boolean).join(" ");
    var text = "Hallo, ich interessiere mich für " + bezeichnung + " aus Ihrem Sortiment. Ist es noch verfügbar?";
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function bestandCardHtml(a) {
    var istNeu = a.zustand === "neu";
    var badgeClass = istNeu ? "badge-neu" : "badge-gebraucht";
    var badgeText = istNeu ? "Neu" : "Gebraucht";
    var titel = [a.marke, a.modell, a.speicher, a.farbe].filter(Boolean).join(" · ");
    var preisText = a.preis != null ? formatPreis(a.preis) + " €" : "Preis auf Anfrage";

    return (
      '<article class="angebot-card reveal">' +
      '<div class="angebot-media"><img src="' + escapeHtml(a.bild) + '" alt="' +
      escapeHtml(titel) +
      '" width="800" height="800" loading="lazy"></div>' +
      '<div class="angebot-body">' +
      '<span class="angebot-badge ' + badgeClass + '">' + badgeText + "</span>" +
      "<h3>" + escapeHtml(titel) + "</h3>" +
      '<p class="angebot-price">' + preisText + "</p>" +
      '<p class="angebot-warranty">' + garantieHinweis(a.zustand) + "</p>" +
      '<a href="' + buildBestandWhatsappUrl(a) + '" class="btn btn-primary" target="_blank" rel="noopener">Verfügbarkeit per WhatsApp anfragen</a>' +
      "</div>" +
      "</article>"
    );
  }

  function initSortiment() {
    var grid = document.getElementById("sortiment-grid");
    var emptyHint = document.getElementById("sortiment-empty");
    var filterBtns = document.querySelectorAll(".filter-btn");
    var markeSelect = document.getElementById("filter-marke");
    var zustandSelect = document.getElementById("filter-zustand");
    var sortSelect = document.getElementById("filter-sortierung");
    if (!grid) return;

    var aktiveDaten = [];
    var aktuelleKategorie = "alle";

    function render() {
      var marke = markeSelect ? markeSelect.value : "alle";
      var zustand = zustandSelect ? zustandSelect.value : "alle";
      var sortierung = sortSelect ? sortSelect.value : "neu";

      var gefiltert = aktiveDaten.filter(function (a) {
        if (aktuelleKategorie !== "alle" && a.kategorie !== aktuelleKategorie) return false;
        if (marke !== "alle" && a.marke !== marke) return false;
        if (zustand !== "alle" && a.zustand !== zustand) return false;
        return true;
      });

      gefiltert.sort(function (a, b) {
        if (sortierung === "preis-auf") return (a.preis == null ? Infinity : a.preis) - (b.preis == null ? Infinity : b.preis);
        if (sortierung === "preis-ab") return (b.preis == null ? -Infinity : b.preis) - (a.preis == null ? -Infinity : a.preis);
        return (b.datum || "").localeCompare(a.datum || "");
      });

      if (!gefiltert.length) {
        grid.innerHTML = "";
        if (emptyHint) {
          if (aktuelleKategorie !== "alle") {
            var aktiverBtn = Array.from(filterBtns).find(function (b) { return b.getAttribute("data-filter") === aktuelleKategorie; });
            var kategorieLabel = aktiverBtn ? aktiverBtn.textContent.trim() : "dieser Kategorie";
            var nachricht = "Hallo, ich suche ein Gerät aus der Kategorie \"" + kategorieLabel + "\" – haben Sie aktuell etwas Passendes?";
            var waUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(nachricht);
            emptyHint.innerHTML =
              "Aktuell keine Artikel in \"" + kategorieLabel + "\" – " +
              '<a href="' + waUrl + '" target="_blank" rel="noopener">fragen Sie uns per WhatsApp</a>.';
          } else {
            emptyHint.textContent = "Der Bestand wird gerade aktualisiert – schauen Sie gerne im Laden auf der Zeil vorbei oder rufen Sie uns an, wir sagen Ihnen direkt, was verfügbar ist.";
          }
          emptyHint.hidden = false;
        }
        return;
      }
      if (emptyHint) emptyHint.hidden = true;

      grid.innerHTML = gefiltert.map(bestandCardHtml).join("");
      revealElements(grid.querySelectorAll(".reveal"));
    }

    function setKategorie(kategorie) {
      aktuelleKategorie = kategorie;
      filterBtns.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-filter") === kategorie); });
      render();
    }

    function befuelleMarkenFilter() {
      if (!markeSelect) return;
      var marken = Array.from(new Set(aktiveDaten.map(function (a) { return a.marke; }).filter(Boolean))).sort();
      marken.forEach(function (m) {
        var opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        markeSelect.appendChild(opt);
      });
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () { setKategorie(btn.getAttribute("data-filter")); });
    });
    if (markeSelect) markeSelect.addEventListener("change", render);
    if (zustandSelect) zustandSelect.addEventListener("change", render);
    if (sortSelect) sortSelect.addEventListener("change", render);

    fetch("bestand.json")
      .then(function (res) {
        if (!res.ok) throw new Error("bestand.json nicht erreichbar");
        return res.json();
      })
      .then(function (data) {
        var alle = Array.isArray(data) ? data : [];
        aktiveDaten = alle.filter(function (a) { return a.aktiv === true; });
        befuelleMarkenFilter();

        var urlKategorie = new URLSearchParams(window.location.search).get("kategorie");
        var gueltigeKategorie = urlKategorie && Array.from(filterBtns).some(function (b) { return b.getAttribute("data-filter") === urlKategorie; });
        setKategorie(gueltigeKategorie ? urlKategorie : "alle");
      })
      .catch(function () {
        if (emptyHint) emptyHint.hidden = false;
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initReveal();
    initCounters();
    initAktuelleAngebote();
    initSortiment();
  });
})();

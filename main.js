/* Mr. Phone – Frankfurt Zeil: Scroll-Reveal, Zähler, Produktbereich */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll-Reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
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

        var reveals = grid.querySelectorAll(".reveal");
        if (reduceMotion || !("IntersectionObserver" in window)) {
          reveals.forEach(function (el) { el.classList.add("is-visible"); });
        } else {
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
          reveals.forEach(function (el) { observer.observe(el); });
        }
      })
      .catch(function () {
        /* Sektion bleibt ausgeblendet (Standardzustand via hidden-Attribut) */
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initReveal();
    initCounters();
    initAktuelleAngebote();
  });
})();

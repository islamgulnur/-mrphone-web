/* Mr. Phone – Frankfurt Zeil: Scroll-Reveal, Zähler, Produktbereich */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Sprache & Asset-Pfade ---------- */
  /* <html lang="en"> auf allen /en/-Seiten setzt die Sprache um. assetUrl() macht
     Fetch- und Bild-Pfade unabhängig von der Verzeichnistiefe der aktuellen Seite
     (z. B. /en/index.html), da sie sonst relativ zum falschen Ordner aufgelöst würden. */
  var LANG = (document.documentElement.getAttribute("lang") || "de").toLowerCase().indexOf("en") === 0 ? "en" : "de";

  function assetUrl(p) {
    if (/^https?:\/\//i.test(p) || p.charAt(0) === "/") return p;
    return "/" + p;
  }

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

  /* ---------- Live-Öffnungsstatus ---------- */
  /* Muss synchron zu den Öffnungszeiten im JSON-LD jeder Seite gehalten werden:
     Mo–Fr 9:30–21:00, Sa 9:30–21:30, So geschlossen. */
  var OEFFNUNGSZEITEN = {
    0: null, // Sonntag
    1: { open: [9, 30], close: [21, 0] },
    2: { open: [9, 30], close: [21, 0] },
    3: { open: [9, 30], close: [21, 0] },
    4: { open: [9, 30], close: [21, 0] },
    5: { open: [9, 30], close: [21, 0] },
    6: { open: [9, 30], close: [21, 30] },
  };
  var TAG_KUERZEL = LANG === "en"
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function uhrzeit(h, m) { return h + ":" + pad2(m); }

  function oeffnungsStatus(now) {
    var tag = now.getDay();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var heute = OEFFNUNGSZEITEN[tag];

    if (heute) {
      var openMin = heute.open[0] * 60 + heute.open[1];
      var closeMin = heute.close[0] * 60 + heute.close[1];
      if (nowMin >= openMin && nowMin < closeMin) {
        var restMin = closeMin - nowMin;
        if (restMin <= 30) {
          return { state: "closing-soon", text: LANG === "en" ? "Closes in " + restMin + " min" : "Schließt in " + restMin + " Min" };
        }
        return {
          state: "open",
          text: LANG === "en"
            ? "Open now · closes at " + uhrzeit(heute.close[0], heute.close[1])
            : "Jetzt geöffnet · schließt um " + uhrzeit(heute.close[0], heute.close[1]),
        };
      }
    }

    for (var i = 0; i <= 7; i++) {
      var checkTag = (tag + i) % 7;
      var sched = OEFFNUNGSZEITEN[checkTag];
      if (!sched) continue;
      if (i === 0) {
        var openMinHeute = sched.open[0] * 60 + sched.open[1];
        if (nowMin < openMinHeute) {
          return {
            state: "closed",
            text: LANG === "en"
              ? "Closed · opens " + TAG_KUERZEL[checkTag] + " " + uhrzeit(sched.open[0], sched.open[1])
              : "Geschlossen · öffnet " + TAG_KUERZEL[checkTag] + " " + uhrzeit(sched.open[0], sched.open[1]),
          };
        }
        continue;
      }
      return {
        state: "closed",
        text: LANG === "en"
          ? "Closed · opens " + TAG_KUERZEL[checkTag] + " " + uhrzeit(sched.open[0], sched.open[1])
          : "Geschlossen · öffnet " + TAG_KUERZEL[checkTag] + " " + uhrzeit(sched.open[0], sched.open[1]),
      };
    }
    return { state: "closed", text: LANG === "en" ? "Closed" : "Geschlossen" };
  }

  function initOeffnungsstatus() {
    var badges = document.querySelectorAll("[data-status-badge]");
    if (!badges.length) return;

    function aktualisieren() {
      var status = oeffnungsStatus(new Date());
      badges.forEach(function (badge) {
        badge.classList.remove("is-open", "is-closing-soon", "is-closed");
        badge.classList.add("is-" + status.state);
        var textEl = badge.querySelector(".status-text");
        if (textEl) textEl.textContent = status.text;
      });
    }

    aktualisieren();
    window.setInterval(aktualisieren, 30000);
  }

  /* ---------- Gerät für 3 Std. reservieren ---------- */
  function ladenschlussHeute(now) {
    var heute = OEFFNUNGSZEITEN[now.getDay()];
    if (!heute) return null;
    var d = new Date(now);
    d.setHours(heute.close[0], heute.close[1], 0, 0);
    return d;
  }

  function naechsteOeffnung(now) {
    for (var i = 1; i <= 7; i++) {
      var checkTag = (now.getDay() + i) % 7;
      var sched = OEFFNUNGSZEITEN[checkTag];
      if (!sched) continue;
      var d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(sched.open[0], sched.open[1], 0, 0);
      return d;
    }
    return null;
  }

  function reservierungsNummer(datum) {
    var stamp = datum.getFullYear() + pad2(datum.getMonth() + 1) + pad2(datum.getDate());
    var zufall = Math.floor(1000 + Math.random() * 9000);
    return "MP-R-" + stamp + "-" + zufall;
  }

  function buildReservierungWhatsappUrl(bezeichnung, preisPhrase) {
    var now = new Date();
    var heute = OEFFNUNGSZEITEN[now.getDay()];
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var istOffen = heute && nowMin >= heute.open[0] * 60 + heute.open[1] && nowMin < heute.close[0] * 60 + heute.close[1];

    var nr = reservierungsNummer(now);
    var bisZeit, text;

    if (istOffen) {
      var ladenschluss = ladenschlussHeute(now);
      var in3Std = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      var bis = in3Std < ladenschluss ? in3Std : ladenschluss;
      if (LANG === "en") {
        bisZeit = "today until " + uhrzeit(bis.getHours(), bis.getMinutes());
        text =
          "Hello, I would like to reserve the following device for 3 hours: " + bezeichnung + " for " + preisPhrase + " – reservation no. " + nr +
          ". I will come by " + bisZeit + ". Name: ___";
      } else {
        bisZeit = "heute bis " + uhrzeit(bis.getHours(), bis.getMinutes());
        text =
          "Hallo, ich möchte folgendes Gerät für 3 Stunden reservieren: " + bezeichnung + " für " + preisPhrase + " – Reservierungs-Nr. " + nr +
          ". Ich komme " + bisZeit + " vorbei. Name: ___";
      }
    } else {
      var oeffnung = naechsteOeffnung(now);
      var abOeffnung = new Date(oeffnung.getTime() + 3 * 60 * 60 * 1000);
      var ladenschlussTag = OEFFNUNGSZEITEN[oeffnung.getDay()];
      var gedeckelt = new Date(oeffnung);
      gedeckelt.setHours(ladenschlussTag.close[0], ladenschlussTag.close[1], 0, 0);
      var bisMorgen = abOeffnung < gedeckelt ? abOeffnung : gedeckelt;
      if (LANG === "en") {
        bisZeit = TAG_KUERZEL[oeffnung.getDay()] + " until " + uhrzeit(bisMorgen.getHours(), bisMorgen.getMinutes());
        text =
          "Hello, I would like to reserve the following device for 3 hours: " + bezeichnung + " for " + preisPhrase + " – reservation no. " + nr +
          ". I will come by " + bisZeit + " (shop currently closed). Name: ___";
      } else {
        bisZeit = TAG_KUERZEL[oeffnung.getDay()] + " bis " + uhrzeit(bisMorgen.getHours(), bisMorgen.getMinutes());
        text =
          "Hallo, ich möchte folgendes Gerät für 3 Stunden reservieren: " + bezeichnung + " für " + preisPhrase + " – Reservierungs-Nr. " + nr +
          ". Ich komme " + bisZeit + " vorbei (Laden aktuell geschlossen). Name: ___";
      }
    }

    return {
      url: "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text),
      istOffen: istOffen,
    };
  }

  function reservierenButtonHtml(bezeichnung, preisText) {
    var res = buildReservierungWhatsappUrl(bezeichnung, preisText);
    var label = LANG === "en"
      ? (res.istOffen ? "Reserve free for 3 hrs" : "Ask for tomorrow")
      : (res.istOffen ? "3 Std. kostenlos reservieren" : "Für morgen anfragen");
    var hinweis = LANG === "en"
      ? "No obligation – the device is held for you for 3 hours, purchase &amp; payment in store."
      : "Unverbindlich – Gerät wird 3 Stunden für Sie zurückgelegt, Kauf &amp; Bezahlung im Laden.";
    return (
      '<a href="' + res.url + '" class="btn btn-outline-dark btn-reservieren" target="_blank" rel="noopener">' + label + "</a>" +
      '<p class="reservieren-hinweis">' + hinweis + "</p>"
    );
  }

  /* ---------- Google-Bewertungen ---------- */
  function sterneHtml(sterne) {
    var voll = Math.round(sterne);
    var s = "";
    for (var i = 1; i <= 5; i++) s += i <= voll ? "★" : "☆";
    return '<span class="sterne" aria-hidden="true">' + s + "</span>";
  }

  function formatNote(note) {
    var s = Number(note).toFixed(1);
    return LANG === "en" ? s : s.replace(".", ",");
  }

  function zitatKarteHtml(z) {
    return (
      '<figure class="zitat-karte">' +
      sterneHtml(z.sterne) +
      "<blockquote>„" + escapeHtml(z.text) + "“</blockquote>" +
      "<figcaption>" + escapeHtml(z.name) + "</figcaption>" +
      "</figure>"
    );
  }

  function initGoogleBewertungen() {
    var kompaktEls = document.querySelectorAll("[data-bewertungen-kompakt]");
    var section = document.getElementById("bewertungen");
    if (!kompaktEls.length && !section) return;

    fetch(assetUrl("bewertungen.json"))
      .then(function (res) {
        if (!res.ok) throw new Error("bewertungen.json nicht erreichbar");
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.gesamtnote) return;

        var bewertungenLabel = LANG === "en" ? " Google reviews" : " Google-Bewertungen";

        kompaktEls.forEach(function (el) {
          el.innerHTML =
            sterneHtml(data.gesamtnote) +
            '<span class="bewertungen-kompakt-text">' + formatNote(data.gesamtnote) +
            " · " + data.anzahlBewertungen + bewertungenLabel + "</span>";
          el.hidden = false;
        });

        if (section && Array.isArray(data.zitate) && data.zitate.length) {
          var noteEl = section.querySelector("[data-bewertungen-note]");
          var anzahlEl = section.querySelector("[data-bewertungen-anzahl]");
          var sterneEl = section.querySelector("[data-bewertungen-sterne]");
          var slider = section.querySelector("[data-bewertungen-slider]");
          var link = section.querySelector("[data-bewertungen-link]");
          if (noteEl) noteEl.textContent = formatNote(data.gesamtnote);
          if (anzahlEl) {
            anzahlEl.textContent = LANG === "en"
              ? data.anzahlBewertungen + " Google reviews · as of " + (data.stand || "")
              : data.anzahlBewertungen + " Google-Bewertungen · Stand " + (data.stand || "");
          }
          if (sterneEl) sterneEl.innerHTML = sterneHtml(data.gesamtnote);
          if (slider) slider.innerHTML = data.zitate.slice(0, 4).map(zitatKarteHtml).join("");
          if (link && data.googleProfilUrl) link.href = data.googleProfilUrl;
          section.hidden = false;
          revealElements(section.querySelectorAll(".reveal"));
        }
      })
      .catch(function () {
        /* Kompakt-Badges/Sektion bleiben ausgeblendet (Standardzustand via hidden) */
      });
  }

  /* ---------- Vorher/Nachher-Vergleich ---------- */
  function initVorherNachher() {
    var compares = document.querySelectorAll(".vn-compare");
    if (!compares.length) return;
    compares.forEach(function (el) {
      var slider = el.querySelector(".vn-slider");
      if (!slider) return;
      slider.addEventListener("input", function () {
        el.style.setProperty("--vn-pos", slider.value + "%");
      });
    });
  }

  /* ---------- Reparatur-Ab-Preise ---------- */
  function reparaturZeileHtml(r) {
    var name = LANG === "en" && r.nameEn ? r.nameEn : r.name;
    var text = LANG === "en"
      ? "Hello, I'm interested in a repair: " + name + " (from " + r.abPreis + " €). Can you tell me if my model is covered?"
      : "Hallo, ich interessiere mich für eine Reparatur: " + r.name + " (ab " + r.abPreis + " €). Können Sie mir sagen, ob mein Modell dabei ist?";
    var waUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
    var abLabel = LANG === "en" ? "from " : "ab ";
    var hinweis = LANG === "en"
      ? "Final price after free diagnosis when repair is commissioned"
      : "Endpreis nach kostenloser Diagnose bei Reparaturauftrag";
    var anrufenLabel = LANG === "en" ? "Call" : "Anrufen";
    return (
      '<div class="service-row reveal">' +
      "<div>" +
      '<p class="service-name">' + escapeHtml(name) + "</p>" +
      '<p class="service-price"><span class="service-price-ab">' + abLabel + r.abPreis + " €</span></p>" +
      '<p class="service-price-hinweis">' + hinweis + "</p>" +
      "</div>" +
      '<div class="service-actions">' +
      '<a href="' + waUrl + '" class="btn btn-primary" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a href="tel:+496995632281" class="btn btn-outline-dark">' + anrufenLabel + "</a>" +
      "</div>" +
      "</div>"
    );
  }

  function initReparaturPreise() {
    var liste = document.getElementById("reparatur-preise-liste");
    if (!liste) return;

    fetch(assetUrl("reparatur-preise.json"))
      .then(function (res) {
        if (!res.ok) throw new Error("reparatur-preise.json nicht erreichbar");
        return res.json();
      })
      .then(function (data) {
        var reparaturen = Array.isArray(data && data.reparaturen) ? data.reparaturen : [];
        if (!reparaturen.length) return;
        liste.innerHTML = reparaturen.map(reparaturZeileHtml).join("");
        revealElements(liste.querySelectorAll(".reveal"));
      })
      .catch(function () {
        liste.innerHTML = '<p class="empty-hint">' +
          (LANG === "en"
            ? "Prices are currently being updated – please ask via WhatsApp or phone."
            : "Preise werden gerade aktualisiert – bitte per WhatsApp oder Telefon anfragen.") +
          "</p>";
      });
  }

  /* ---------- Aktuelle Angebote ---------- */
  var WHATSAPP_NUMBER = "496995632281";

  function formatPreis(preis) {
    var num = Number(preis);
    return num.toLocaleString(LANG === "en" ? "en-GB" : "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function buildAngebotWhatsappUrl(a) {
    var bezeichnung = [a.modell, a.speicher, a.farbe].filter(Boolean).join(" ");
    var text = LANG === "en"
      ? "Hello, I'm interested in the offer " + bezeichnung + " for " + formatPreis(a.preis) + "€"
      : "Hallo, ich interessiere mich für das Angebot " + bezeichnung + " für " + formatPreis(a.preis) + "€";
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function garantieHinweis(zustand) {
    if (LANG === "en") return zustand === "neu" ? "1–2 years manufacturer warranty" : "6 months warranty";
    return zustand === "neu" ? "1–2 Jahre Herstellergarantie" : "6 Monate Garantie";
  }

  function angebotCardHtml(a) {
    var istNeu = a.zustand === "neu";
    var badgeClass = istNeu ? "badge-neu" : "badge-gebraucht";
    var badgeText = LANG === "en" ? (istNeu ? "New" : "Used") : (istNeu ? "Neu" : "Gebraucht");
    var titel = [a.modell, a.speicher, a.farbe].filter(Boolean).join(" · ");
    var hatAltpreis = a.altpreis != null && Number(a.altpreis) > Number(a.preis);
    var altpreisHtml = hatAltpreis
      ? ' <span class="angebot-oldprice">' + formatPreis(a.altpreis) + " €</span>"
      : "";
    var whatsappLabel = LANG === "en" ? "Ask via WhatsApp" : "Per WhatsApp anfragen";

    return (
      '<article class="angebot-card reveal">' +
      '<div class="angebot-media"><img src="' + assetUrl(escapeHtml(a.bild)) + '" alt="' +
      escapeHtml(titel) +
      '" width="800" height="800" loading="lazy"></div>' +
      '<div class="angebot-body">' +
      '<span class="angebot-badge ' + badgeClass + '">' + badgeText + "</span>" +
      "<h3>" + escapeHtml(titel) + "</h3>" +
      '<p class="angebot-price">' + formatPreis(a.preis) + " €" + altpreisHtml + "</p>" +
      '<p class="angebot-warranty">' + garantieHinweis(a.zustand) + "</p>" +
      '<div class="angebot-actions">' +
      '<a href="' + buildAngebotWhatsappUrl(a) + '" class="btn btn-primary" target="_blank" rel="noopener">' + whatsappLabel + "</a>" +
      reservierenButtonHtml(titel, formatPreis(a.preis) + " €") +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function initAktuelleAngebote() {
    var section = document.getElementById("aktuelle-angebote");
    var grid = document.getElementById("angebote-grid");
    if (!section || !grid) return;

    fetch(assetUrl("angebote.json"))
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
    var text = LANG === "en"
      ? "Hello, I'm interested in " + bezeichnung + " from your range. Is it still available?"
      : "Hallo, ich interessiere mich für " + bezeichnung + " aus Ihrem Sortiment. Ist es noch verfügbar?";
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function bestandCardHtml(a) {
    var istNeu = a.zustand === "neu";
    var badgeClass = istNeu ? "badge-neu" : "badge-gebraucht";
    var badgeText = LANG === "en" ? (istNeu ? "New" : "Used") : (istNeu ? "Neu" : "Gebraucht");
    var titel = [a.marke, a.modell, a.speicher, a.farbe].filter(Boolean).join(" · ");
    var preisText = a.preis != null ? formatPreis(a.preis) + " €" : (LANG === "en" ? "Price on request" : "Preis auf Anfrage");
    var whatsappLabel = LANG === "en" ? "Ask about availability via WhatsApp" : "Verfügbarkeit per WhatsApp anfragen";
    var ladenpreisPhrase = LANG === "en" ? "the in-store price (please confirm in store)" : "dem Ladenpreis (bitte im Laden bestätigen)";

    return (
      '<article class="angebot-card reveal">' +
      '<div class="angebot-media"><img src="' + assetUrl(escapeHtml(a.bild)) + '" alt="' +
      escapeHtml(titel) +
      '" width="800" height="800" loading="lazy"></div>' +
      '<div class="angebot-body">' +
      '<span class="angebot-badge ' + badgeClass + '">' + badgeText + "</span>" +
      "<h3>" + escapeHtml(titel) + "</h3>" +
      '<p class="angebot-price">' + preisText + "</p>" +
      '<p class="angebot-warranty">' + garantieHinweis(a.zustand) + "</p>" +
      '<div class="angebot-actions">' +
      '<a href="' + buildBestandWhatsappUrl(a) + '" class="btn btn-primary" target="_blank" rel="noopener">' + whatsappLabel + "</a>" +
      reservierenButtonHtml(titel, a.preis != null ? formatPreis(a.preis) + " €" : ladenpreisPhrase) +
      "</div>" +
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
            var kategorieLabel = aktiverBtn ? aktiverBtn.textContent.trim() : (LANG === "en" ? "this category" : "dieser Kategorie");
            var nachricht = LANG === "en"
              ? "Hello, I'm looking for a device in the category \"" + kategorieLabel + "\" – do you currently have anything suitable?"
              : "Hallo, ich suche ein Gerät aus der Kategorie \"" + kategorieLabel + "\" – haben Sie aktuell etwas Passendes?";
            var waUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(nachricht);
            emptyHint.innerHTML = LANG === "en"
              ? "Currently no items in \"" + kategorieLabel + "\" – " + '<a href="' + waUrl + '" target="_blank" rel="noopener">ask us via WhatsApp</a>.'
              : "Aktuell keine Artikel in \"" + kategorieLabel + "\" – " + '<a href="' + waUrl + '" target="_blank" rel="noopener">fragen Sie uns per WhatsApp</a>.';
          } else {
            emptyHint.textContent = LANG === "en"
              ? "Stock is currently being updated – feel free to visit our shop on the Zeil or call us, we'll tell you directly what's available."
              : "Der Bestand wird gerade aktualisiert – schauen Sie gerne im Laden auf der Zeil vorbei oder rufen Sie uns an, wir sagen Ihnen direkt, was verfügbar ist.";
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

    fetch(assetUrl("bestand.json"))
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
        var defaultKategorie = grid.getAttribute("data-default-kategorie");
        setKategorie(gueltigeKategorie ? urlKategorie : (defaultKategorie || "alle"));
      })
      .catch(function () {
        if (emptyHint) emptyHint.hidden = false;
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initReveal();
    initCounters();
    initOeffnungsstatus();
    initGoogleBewertungen();
    initAktuelleAngebote();
    initSortiment();
    initReparaturPreise();
    initVorherNachher();
  });
})();

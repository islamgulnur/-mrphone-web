/* Mr. Phone – Frankfurt Zeil: Interaktiver Ankaufsrechner (handy-ankauf-frankfurt.html) */
(function () {
  "use strict";

  var root = document.getElementById("ankaufsrechner");
  if (!root) return;

  var WHATSAPP_NUMMER = "496995632281";
  var LANG = (document.documentElement.getAttribute("lang") || "de").toLowerCase().indexOf("en") === 0 ? "en" : "de";

  function assetUrl(p) {
    if (/^https?:\/\//i.test(p) || p.charAt(0) === "/") return p;
    return "/" + p;
  }

  var KATEGORIEN = LANG === "en" ? [
    { id: "smartphones", label: "Smartphones", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"></rect><line x1="11" y1="18" x2="13" y2="18"></line></svg>' },
    { id: "tablets", label: "Tablets & iPads", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="11" y1="18" x2="13" y2="18"></line></svg>' },
    { id: "smartwatches", label: "Smartwatches", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="3"></rect><line x1="9" y1="2" x2="9" y2="7"></line><line x1="15" y1="2" x2="15" y2="7"></line><line x1="9" y1="17" x2="9" y2="22"></line><line x1="15" y1="17" x2="15" y2="22"></line></svg>' },
    { id: "laptops", label: "Laptops & Notebooks", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1"></rect><line x1="1" y1="20" x2="23" y2="20"></line></svg>' },
    { id: "pcs", label: "PCs", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="8" height="18" rx="1"></rect><circle cx="10" cy="7" r="1"></circle><line x1="8" y1="11" x2="12" y2="11"></line><line x1="8" y1="14" x2="12" y2="14"></line></svg>', hinweis: "Final price after a brief inspection of the specs in store." },
    { id: "monitore", label: "Monitors", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="13" rx="1"></rect><line x1="8" y1="20" x2="16" y2="20"></line><line x1="12" y1="16" x2="12" y2="20"></line></svg>', hinweis: "Final price after a brief inspection of the specs in store." },
    { id: "kopfhoerer", label: "Headphones & Audio", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><rect x="2" y="14" width="4" height="6" rx="1.5"></rect><rect x="18" y="14" width="4" height="6" rx="1.5"></rect></svg>' },
    { id: "kameras", label: "Cameras", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l1.5-3h5L16 7"></path><rect x="2" y="7" width="20" height="13" rx="2"></rect><circle cx="12" cy="13.5" r="4"></circle></svg>' },
    { id: "konsolen", label: "Game Consoles", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.5 1.7L15 16H9l-1.5 1.7A3 3 0 0 1 2 16v-3a4 4 0 0 1 4-4z"></path><line x1="6.5" y1="12" x2="6.5" y2="14.5"></line><line x1="5.25" y1="13.25" x2="7.75" y2="13.25"></line><circle cx="16.5" cy="12.5" r="0.9"></circle><circle cx="18.5" cy="14.25" r="0.9"></circle></svg>' },
    { id: "zubehoer", label: "Accessories", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3v4M15 3v4M6 7h12l-1 5a5 5 0 0 1-10 0z"></path><line x1="12" y1="16" x2="12" y2="21"></line></svg>' },
  ] : [
    { id: "smartphones", label: "Smartphones", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"></rect><line x1="11" y1="18" x2="13" y2="18"></line></svg>' },
    { id: "tablets", label: "Tablets & iPads", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="11" y1="18" x2="13" y2="18"></line></svg>' },
    { id: "smartwatches", label: "Smartwatches", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="3"></rect><line x1="9" y1="2" x2="9" y2="7"></line><line x1="15" y1="2" x2="15" y2="7"></line><line x1="9" y1="17" x2="9" y2="22"></line><line x1="15" y1="17" x2="15" y2="22"></line></svg>' },
    { id: "laptops", label: "Laptops & Notebooks", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1"></rect><line x1="1" y1="20" x2="23" y2="20"></line></svg>' },
    { id: "pcs", label: "PCs", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="8" height="18" rx="1"></rect><circle cx="10" cy="7" r="1"></circle><line x1="8" y1="11" x2="12" y2="11"></line><line x1="8" y1="14" x2="12" y2="14"></line></svg>', hinweis: "Endpreis nach kurzer Prüfung der Ausstattung vor Ort." },
    { id: "monitore", label: "Monitore", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="13" rx="1"></rect><line x1="8" y1="20" x2="16" y2="20"></line><line x1="12" y1="16" x2="12" y2="20"></line></svg>', hinweis: "Endpreis nach kurzer Prüfung der Ausstattung vor Ort." },
    { id: "kopfhoerer", label: "Kopfhörer & Audio", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><rect x="2" y="14" width="4" height="6" rx="1.5"></rect><rect x="18" y="14" width="4" height="6" rx="1.5"></rect></svg>' },
    { id: "kameras", label: "Kameras", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l1.5-3h5L16 7"></path><rect x="2" y="7" width="20" height="13" rx="2"></rect><circle cx="12" cy="13.5" r="4"></circle></svg>' },
    { id: "konsolen", label: "Spielekonsolen", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.5 1.7L15 16H9l-1.5 1.7A3 3 0 0 1 2 16v-3a4 4 0 0 1 4-4z"></path><line x1="6.5" y1="12" x2="6.5" y2="14.5"></line><line x1="5.25" y1="13.25" x2="7.75" y2="13.25"></line><circle cx="16.5" cy="12.5" r="0.9"></circle><circle cx="18.5" cy="14.25" r="0.9"></circle></svg>' },
    { id: "zubehoer", label: "Zubehör", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3v4M15 3v4M6 7h12l-1 5a5 5 0 0 1-10 0z"></path><line x1="12" y1="16" x2="12" y2="21"></line></svg>' },
  ];

  var ZUSTAENDE = LANG === "en" ? [
    {
      id: "neuVersiegelt", titel: "New & sealed", beschreibung: "Original packaging, sealed.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a4 4 0 0 1 8 0v2"></path></svg>',
    },
    {
      id: "wieNeu", titel: "Like new", beschreibung: "No signs of use, technically flawless.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.6 6.6L21 10l-5.4 3.9L17 21l-5-3.9L7 21l1.4-7.1L3 10l6.4-1.4z"></path></svg>',
    },
    {
      id: "sehrGut", titel: "Very good", beschreibung: "Minimal signs of use, technically flawless.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>',
    },
    {
      id: "gut", titel: "Good", beschreibung: "Visible signs of use, fully functional.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9 12l2 2 4-4"></path></svg>',
    },
    {
      id: "defekt", titel: "Defective", beschreibung: "Damaged or of limited functionality.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"></path><path d="M10.3 3.9L2.5 18a1.5 1.5 0 0 0 1.3 2.2h16.4a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0z"></path></svg>',
    },
  ] : [
    {
      id: "neuVersiegelt", titel: "Neu & versiegelt", beschreibung: "Originalverpackt, versiegelt (OVP).",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a4 4 0 0 1 8 0v2"></path></svg>',
    },
    {
      id: "wieNeu", titel: "Wie neu", beschreibung: "Keine Gebrauchsspuren, technisch einwandfrei.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.6 6.6L21 10l-5.4 3.9L17 21l-5-3.9L7 21l1.4-7.1L3 10l6.4-1.4z"></path></svg>',
    },
    {
      id: "sehrGut", titel: "Sehr gut", beschreibung: "Minimale Spuren, technisch einwandfrei.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>',
    },
    {
      id: "gut", titel: "Gut", beschreibung: "Sichtbare Gebrauchsspuren, voll funktionsfähig.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9 12l2 2 4-4"></path></svg>',
    },
    {
      id: "defekt", titel: "Defekt", beschreibung: "Beschädigt oder eingeschränkt funktionsfähig.",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"></path><path d="M10.3 3.9L2.5 18a1.5 1.5 0 0 0 1.3 2.2h16.4a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0z"></path></svg>',
    },
  ];

  var progressEl = root.querySelector("#rechner-progress");
  var kategorieGrid = root.querySelector("#rechner-kategorien");
  var markenChips = root.querySelector("#rechner-marken");
  var modellSuche = root.querySelector("#rechner-modell-suche");
  var modellListe = root.querySelector("#rechner-modelle");
  var modelleLade = root.querySelector("#rechner-modelle-lade");
  var modelleFehler = root.querySelector("#rechner-modelle-fehler");
  var variantenGrid = root.querySelector("#rechner-varianten");
  var zustandGrid = root.querySelector("#rechner-zustand");
  var ergebnisPreis = root.querySelector("#rechner-preis");
  var whatsappBtn = root.querySelector("#rechner-whatsapp-btn");
  var fallbackLink = root.querySelector("#rechner-fallback-link");
  var hinweisKategorie = root.querySelector("#rechner-hinweis-kategorie");
  var rechnerCard = root.querySelector(".rechner-card");
  var step2Empty = root.querySelector("#rechner-modelle-leer");
  var step2Lokal = root.querySelector("#rechner-modelle-lokal");
  var modelleRetryBtn = root.querySelector("#rechner-modelle-retry");

  var kategorieCache = {};
  var aktuelleGeraeteListe = [];
  var aktuellerLadeStatus = null; // "ok" | "fehler" | "lokal"
  var state = { kategorie: null, marke: null, geraet: null, variante: null, zustand: null };
  var aktuellerSchritt = 1;
  var erreichteSchritte = 1;

  function formatPreis(zahl) {
    return Number(zahl).toLocaleString(LANG === "en" ? "en-GB" : "de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function anfrageNummer() {
    var d = new Date();
    var jjjjmmtt = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    var zufall = String(Math.floor(1000 + Math.random() * 9000));
    return "MP-A-" + jjjjmmtt + "-" + zufall;
  }

  function formatDatumUhrzeit() {
    var d = new Date();
    var datum = String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
    var uhrzeit = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return LANG === "en" ? datum + ", " + uhrzeit : datum + ", " + uhrzeit + " Uhr";
  }

  function waLink(text) {
    return "https://wa.me/" + WHATSAPP_NUMMER + "?text=" + encodeURIComponent(text);
  }

  function fallbackNachricht() {
    return LANG === "en"
      ? "Hello, I'd like to sell a device that isn't on your list: …"
      : "Hallo, ich möchte ein Gerät verkaufen, das nicht in Ihrer Liste steht: …";
  }

  function setFallbackLinks() {
    var url = waLink(fallbackNachricht());
    if (fallbackLink) fallbackLink.href = url;
  }

  /* ---------- Fortschrittsanzeige ---------- */
  function updateProgress() {
    if (!progressEl) return;
    var anzeigeSchritt = aktuellerSchritt;
    var items = progressEl.querySelectorAll(".rechner-progress-step");
    items.forEach(function (el) {
      var n = Number(el.getAttribute("data-step-indicator"));
      var istAktiv = n === anzeigeSchritt;
      // "abgeschlossen" richtet sich nach tatsächlich vorhandener Auswahl, nicht nach der
      // reinen Position zum aktuell angezeigten Schritt – so bleiben z.B. Schritt 3+4 als
      // grün/Häkchen erkennbar, auch wenn man testweise zu Schritt 1 zurückgeht.
      var hatAuswahl = [state.kategorie, state.geraet, state.variante, state.zustand][n - 1] != null;
      var istDone = hatAuswahl && !istAktiv;
      var istErreichbar = n <= erreichteSchritte;
      el.classList.toggle("done", istDone);
      el.classList.toggle("active", istAktiv);
      el.classList.toggle("erreichbar", istErreichbar);
      el.disabled = !istErreichbar;
      if (istAktiv) {
        el.setAttribute("aria-current", "step");
      } else {
        el.removeAttribute("aria-current");
      }
    });
  }

  function zeigeSchritt(schritt) {
    if (schritt !== "ergebnis") aktuellerSchritt = schritt;
    var alleSchritte = root.querySelectorAll("[data-step]");
    alleSchritte.forEach(function (el) {
      el.hidden = el.getAttribute("data-step") !== String(schritt);
    });
    updateProgress();
    rechnerCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function gehZuSchritt(n) {
    if (n > erreichteSchritte) return;
    if (n === 2) { renderMarken(); renderModelle(); }
    if (n === 3) { renderVarianten(); }
    if (n === 4) { renderZustaende(); }
    zeigeSchritt(n);
  }

  if (progressEl) {
    progressEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".rechner-progress-step");
      if (!btn || btn.disabled) return;
      gehZuSchritt(Number(btn.getAttribute("data-step-indicator")));
    });
  }

  /* ---------- Schritt 1: Kategorie ---------- */
  function renderKategorien() {
    kategorieGrid.innerHTML = KATEGORIEN.map(function (k) {
      var aktivKlasse = state.kategorie === k.id ? " active" : "";
      return (
        '<button type="button" class="kategorie-tile rechner-kategorie-btn' + aktivKlasse + '" data-kategorie="' + k.id + '">' +
        k.icon +
        "<span>" + k.label + "</span>" +
        "</button>"
      );
    }).join("");
  }

  function ladeKategorieDaten(kategorie) {
    if (location.protocol === "file:") {
      aktuellerLadeStatus = "lokal";
      if (modelleLade) modelleLade.hidden = true;
      if (modelleFehler) modelleFehler.hidden = true;
      if (step2Lokal) step2Lokal.hidden = false;
      modellListe.innerHTML = "";
      markenChips.innerHTML = "";
      return Promise.resolve([]);
    }

    if (kategorieCache[kategorie]) {
      aktuellerLadeStatus = "ok";
      return Promise.resolve(kategorieCache[kategorie]);
    }

    aktuellerLadeStatus = null;
    if (modelleLade) modelleLade.hidden = false;
    if (modelleFehler) modelleFehler.hidden = true;
    if (step2Lokal) step2Lokal.hidden = true;
    modellListe.innerHTML = "";
    markenChips.innerHTML = "";

    return fetch(assetUrl("ankauf/" + kategorie + ".json"))
      .then(function (res) {
        if (!res.ok) throw new Error("Kategorie nicht erreichbar");
        return res.json();
      })
      .then(function (daten) {
        var liste = Array.isArray(daten) ? daten : [];
        kategorieCache[kategorie] = liste;
        aktuellerLadeStatus = "ok";
        if (modelleLade) modelleLade.hidden = true;
        return liste;
      })
      .catch(function () {
        aktuellerLadeStatus = "fehler";
        if (modelleLade) modelleLade.hidden = true;
        if (modelleFehler) modelleFehler.hidden = false;
        return [];
      });
  }

  if (modelleRetryBtn) {
    modelleRetryBtn.addEventListener("click", function () {
      if (!state.kategorie) return;
      ladeKategorieDaten(state.kategorie).then(function (liste) {
        aktuelleGeraeteListe = liste;
        renderMarken();
        renderModelle();
      });
    });
  }

  kategorieGrid.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-kategorie]");
    if (!btn) return;
    var neu = btn.getAttribute("data-kategorie");

    if (neu !== state.kategorie) {
      state.kategorie = neu;
      state.marke = null;
      state.geraet = null;
      state.variante = null;
      state.zustand = null;
      erreichteSchritte = 2;
    }

    renderKategorien();
    zeigeSchritt(2);

    ladeKategorieDaten(neu).then(function (liste) {
      aktuelleGeraeteListe = liste;
      renderMarken();
      renderModelle();
    });
  });

  /* ---------- Schritt 2: Marke & Modell ---------- */
  function renderMarken() {
    var marken = Array.from(new Set(aktuelleGeraeteListe.map(function (g) { return g.marke; }).filter(Boolean))).sort();

    if (!marken.length) {
      markenChips.innerHTML = "";
      return;
    }

    var alleMarkenLabel = LANG === "en" ? "All Brands" : "Alle Marken";
    var chips = ['<button type="button" class="rechner-chip' + (state.marke === null ? " active" : "") + '" data-marke="">' + alleMarkenLabel + "</button>"];
    marken.forEach(function (m) {
      chips.push('<button type="button" class="rechner-chip' + (state.marke === m ? " active" : "") + '" data-marke="' + m + '">' + m + "</button>");
    });
    markenChips.innerHTML = chips.join("");
  }

  markenChips.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-marke]");
    if (!btn) return;
    state.marke = btn.getAttribute("data-marke") || null;
    renderMarken();
    renderModelle();
  });

  function renderModelle() {
    var suchbegriff = (modellSuche.value || "").trim().toLowerCase();
    var sucheAktiv = suchbegriff.length >= 2;

    var geraete = aktuelleGeraeteListe.filter(function (g) {
      if (state.marke && g.marke !== state.marke) return false;
      if (sucheAktiv) {
        var text = (g.marke + " " + g.modell).toLowerCase();
        if (text.indexOf(suchbegriff) === -1) return false;
      }
      return true;
    });

    geraete.sort(function (a, b) {
      if (!!b.beliebt !== !!a.beliebt) return (b.beliebt ? 1 : 0) - (a.beliebt ? 1 : 0);
      if ((b.jahr || 0) !== (a.jahr || 0)) return (b.jahr || 0) - (a.jahr || 0);
      return (a.marke + a.modell).localeCompare(b.marke + b.modell);
    });

    if (!geraete.length) {
      modellListe.innerHTML = "";
      // Leer-Meldung nur bei erfolgreich geladener, aber leerer Kategorie – bei Ladefehler
      // oder file://-Aufruf übernehmen die jeweils eigenen Hinweise (siehe ladeKategorieDaten).
      if (step2Empty) step2Empty.hidden = aktuellerLadeStatus !== "ok";
      return;
    }
    if (step2Empty) step2Empty.hidden = true;

    modellListe.innerHTML = geraete.map(function (g) {
      var aktivKlasse = state.geraet && state.geraet.id === g.id ? " active" : "";
      var beliebtBadge = g.beliebt ? " ★" : "";
      return (
        '<button type="button" class="rechner-modell-btn' + aktivKlasse + '" data-geraet-id="' + g.id + '">' +
        "<span>" + g.modell + beliebtBadge + '<span class="modell-marke"> · ' + g.marke + (g.jahr ? " · " + g.jahr : "") + "</span></span>" +
        "<span aria-hidden=\"true\">›</span>" +
        "</button>"
      );
    }).join("");
  }

  modellSuche.addEventListener("input", renderModelle);

  modellListe.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-geraet-id]");
    if (!btn) return;
    var id = btn.getAttribute("data-geraet-id");
    var geraet = aktuelleGeraeteListe.find(function (g) { return g.id === id; });
    if (!geraet) return;

    if (!state.geraet || state.geraet.id !== geraet.id) {
      state.geraet = geraet;
      state.variante = null;
      state.zustand = null;
      erreichteSchritte = 3;
      renderModelle();
      renderVarianten();
      zeigeSchritt(3);
      return;
    }

    renderModelle();
    gehZuSchritt(3);
  });

  /* ---------- Schritt 3: Variante ---------- */
  function renderVarianten() {
    if (!state.geraet) return;
    variantenGrid.innerHTML = state.geraet.varianten.map(function (v, index) {
      var aktivKlasse = state.variante === v ? " active" : "";
      return (
        '<button type="button" class="rechner-variante-btn' + aktivKlasse + '" data-variante-index="' + index + '">' +
        v.bezeichnung +
        "</button>"
      );
    }).join("");
  }

  variantenGrid.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-variante-index]");
    if (!btn || !state.geraet) return;
    var index = Number(btn.getAttribute("data-variante-index"));
    var variante = state.geraet.varianten[index];

    if (state.variante !== variante) {
      state.variante = variante;
      state.zustand = null;
      erreichteSchritte = 4;
      renderVarianten();
      renderZustaende();
      zeigeSchritt(4);
      return;
    }

    renderVarianten();
    gehZuSchritt(4);
  });

  /* ---------- Schritt 4: Zustand ---------- */
  function renderZustaende() {
    zustandGrid.innerHTML = ZUSTAENDE.map(function (z) {
      var aktivKlasse = state.zustand === z.id ? " active" : "";
      return (
        '<button type="button" class="rechner-zustand-btn' + aktivKlasse + '" data-zustand="' + z.id + '">' +
        '<span class="rechner-zustand-icon">' + z.icon + "</span>" +
        "<strong>" + z.titel + "</strong>" +
        "<span>" + z.beschreibung + "</span>" +
        "</button>"
      );
    }).join("");
  }

  zustandGrid.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-zustand]");
    if (!btn || !state.variante) return;
    state.zustand = btn.getAttribute("data-zustand");
    renderZustaende();
    zeigeErgebnis();
  });

  /* ---------- Ergebnis ---------- */
  function zeigeErgebnis() {
    var preis = state.variante.preise[state.zustand];
    ergebnisPreis.textContent = formatPreis(preis) + " €";

    var zustandLabel = ZUSTAENDE.find(function (z) { return z.id === state.zustand; }).titel;
    var geraeteBezeichnung = [state.geraet.marke, state.geraet.modell, state.variante.bezeichnung].filter(Boolean).join(" ");
    var nummer = anfrageNummer();

    var nachricht = LANG === "en"
      ? "Hello, I would like to sell my device:\n" +
        "Device: " + geraeteBezeichnung + "\n" +
        "Condition: " + zustandLabel + "\n" +
        "Offered price: " + formatPreis(preis) + " €\n" +
        "Request no.: " + nummer + "\n" +
        "Date: " + formatDatumUhrzeit()
      : "Hallo, ich möchte mein Gerät verkaufen:\n" +
        "Gerät: " + geraeteBezeichnung + "\n" +
        "Zustand: " + zustandLabel + "\n" +
        "Angebotener Preis: " + formatPreis(preis) + " €\n" +
        "Anfrage-Nummer: " + nummer + "\n" +
        "Datum: " + formatDatumUhrzeit();

    whatsappBtn.href = waLink(nachricht);

    if (hinweisKategorie) {
      var kategorieConfig = KATEGORIEN.find(function (k) { return k.id === state.kategorie; });
      var hinweisText = kategorieConfig && kategorieConfig.hinweis;
      hinweisKategorie.textContent = hinweisText || "";
      hinweisKategorie.hidden = !hinweisText;
    }

    zeigeSchritt("ergebnis");
  }

  /* ---------- Zurück-Navigation ---------- */
  root.addEventListener("click", function (e) {
    var back = e.target.closest("[data-back]");
    if (!back) return;
    var aktuellerSchrittEl = back.closest("[data-step]");
    var aktuellerSchrittWert = aktuellerSchrittEl.getAttribute("data-step");
    if (aktuellerSchrittWert === "ergebnis") {
      gehZuSchritt(4);
    } else {
      var vorheriger = Number(aktuellerSchrittWert) - 1;
      gehZuSchritt(vorheriger < 1 ? 1 : vorheriger);
    }
  });

  /* ---------- Laden ---------- */
  renderKategorien();
  setFallbackLinks();
  updateProgress();
  root.hidden = false;
})();

(function () {
  "use strict";

  var form = document.getElementById("angebot-form");
  var listEl = document.getElementById("angebote-list");
  var formTitle = document.getElementById("form-title");
  var idField = document.getElementById("angebot-id");
  var cancelBtn = document.getElementById("form-cancel");
  var bildInput = document.getElementById("f-bild");
  var bildPreview = document.getElementById("f-bild-preview");
  var publishBtn = document.getElementById("publish-btn");
  var publishLog = document.getElementById("publish-log");

  var aktuelleListe = [];

  function heute() {
    return new Date().toISOString().slice(0, 10);
  }

  function resetForm() {
    form.reset();
    idField.value = "";
    document.getElementById("f-datum").value = heute();
    document.getElementById("f-aktiv").checked = true;
    formTitle.textContent = "Neues Angebot anlegen";
    cancelBtn.hidden = true;
    bildPreview.hidden = true;
    bildPreview.src = "";
  }

  function ladeAngebote() {
    fetch("/api/angebote")
      .then(function (r) { return r.json(); })
      .then(renderListe)
      .catch(function () {
        listEl.innerHTML = '<p class="empty-hint">Angebote konnten nicht geladen werden.</p>';
      });
  }

  function renderListe(liste) {
    aktuelleListe = liste.slice().sort(function (a, b) {
      return (b.datum || "").localeCompare(a.datum || "");
    });

    if (!aktuelleListe.length) {
      listEl.innerHTML = '<p class="empty-hint">Noch keine Angebote angelegt.</p>';
      return;
    }

    listEl.innerHTML = aktuelleListe.map(function (a) {
      var bezeichnung = [a.modell, a.speicher, a.farbe].filter(Boolean).join(" · ");
      return (
        '<div class="angebot-row">' +
        '<img src="/' + a.bild + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
        '<div class="row-info">' +
        "<strong>" + bezeichnung + "</strong>" +
        "<span>" + a.zustand + " · " + Number(a.preis).toFixed(2) + " € · " + (a.datum || "") + "</span>" +
        "</div>" +
        '<div class="row-actions">' +
        '<button type="button" class="status-pill ' + (a.aktiv ? "on" : "off") + '" data-toggle="' + a.id + '">' +
        (a.aktiv ? "Aktiv" : "Inaktiv") +
        "</button>" +
        '<button type="button" class="btn-small btn-secondary" data-edit="' + a.id + '">Bearbeiten</button>' +
        '<button type="button" class="btn-small btn-danger" data-delete="' + a.id + '">Löschen</button>' +
        "</div>" +
        "</div>"
      );
    }).join("");
  }

  listEl.addEventListener("click", function (e) {
    var toggleId = e.target.getAttribute("data-toggle");
    var editId = e.target.getAttribute("data-edit");
    var deleteId = e.target.getAttribute("data-delete");

    if (toggleId) {
      var a = aktuelleListe.find(function (x) { return x.id === toggleId; });
      if (!a) return;
      fetch("/api/angebote/" + toggleId + "/aktiv", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktiv: !a.aktiv }),
      }).then(ladeAngebote);
    }

    if (editId) {
      var a2 = aktuelleListe.find(function (x) { return x.id === editId; });
      if (!a2) return;
      idField.value = a2.id;
      document.getElementById("f-modell").value = a2.modell || "";
      document.getElementById("f-speicher").value = a2.speicher || "";
      document.getElementById("f-farbe").value = a2.farbe || "";
      document.getElementById("f-zustand").value = a2.zustand || "gebraucht";
      document.getElementById("f-preis").value = a2.preis || "";
      document.getElementById("f-altpreis").value = a2.altpreis || "";
      document.getElementById("f-datum").value = a2.datum || heute();
      document.getElementById("f-aktiv").checked = !!a2.aktiv;
      formTitle.textContent = "Angebot bearbeiten";
      cancelBtn.hidden = false;
      if (a2.bild) {
        bildPreview.src = "/" + a2.bild;
        bildPreview.hidden = false;
      } else {
        bildPreview.hidden = true;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (deleteId) {
      if (!confirm("Dieses Angebot wirklich löschen?")) return;
      fetch("/api/angebote/" + deleteId, { method: "DELETE" }).then(ladeAngebote);
    }
  });

  bildInput.addEventListener("change", function () {
    var file = bildInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      bildPreview.src = e.target.result;
      bildPreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  cancelBtn.addEventListener("click", resetForm);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = idField.value;
    var fd = new FormData();
    fd.append("modell", document.getElementById("f-modell").value);
    fd.append("speicher", document.getElementById("f-speicher").value);
    fd.append("farbe", document.getElementById("f-farbe").value);
    fd.append("zustand", document.getElementById("f-zustand").value);
    fd.append("preis", document.getElementById("f-preis").value);
    fd.append("altpreis", document.getElementById("f-altpreis").value);
    fd.append("datum", document.getElementById("f-datum").value || heute());
    fd.append("aktiv", document.getElementById("f-aktiv").checked ? "true" : "false");
    if (bildInput.files[0]) fd.append("bild", bildInput.files[0]);

    var url = id ? "/api/angebote/" + id : "/api/angebote";
    var method = id ? "PUT" : "POST";

    fetch(url, { method: method, body: fd })
      .then(function (r) {
        if (!r.ok) throw new Error("Speichern fehlgeschlagen");
        return r.json();
      })
      .then(function () {
        resetForm();
        ladeAngebote();
      })
      .catch(function (err) {
        alert(err.message);
      });
  });

  publishBtn.addEventListener("click", function () {
    publishBtn.disabled = true;
    publishBtn.textContent = "Veröffentliche …";
    publishLog.hidden = false;
    publishLog.textContent = "Starte Veröffentlichung …";

    fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nachricht: "Website-Inhalte aktualisiert" }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        publishLog.textContent = (data.log || "") + (data.error ? "\n\nFehler: " + data.error : "\n\nFertig.");
      })
      .catch(function (err) {
        publishLog.textContent = "Fehler: " + err.message;
      })
      .then(function () {
        publishBtn.disabled = false;
        publishBtn.textContent = "Veröffentlichen (GitHub Pages)";
      });
  });

  /* ---------- Tabs ---------- */
  var tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ziel = btn.getAttribute("data-tab");
      tabBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
      document.querySelectorAll(".tab-panel").forEach(function (panel) {
        panel.classList.toggle("active", panel.id === "tab-" + ziel);
      });
    });
  });

  /* ---------- Bestand ---------- */
  var bForm = document.getElementById("bestand-form");
  var bListEl = document.getElementById("bestand-list");
  var bFormTitle = document.getElementById("bestand-form-title");
  var bIdField = document.getElementById("b-id");
  var bCancelBtn = document.getElementById("bestand-form-cancel");
  var bBildInput = document.getElementById("b-bild");
  var bBildPreview = document.getElementById("b-bild-preview");
  var bFilterKategorie = document.getElementById("bestand-filter-kategorie");

  var aktuelleBestandListe = [];

  /* ---------- Gerätekatalog (single source of truth für Marke/Modell/Variante) ---------- */
  var geraeteKatalog = [];
  var SONSTIGES_WERT = "__sonstiges__";
  var bMarkeSelect = document.getElementById("b-marke");
  var bModellKatalogSelect = document.getElementById("b-modell-katalog");
  var bVarianteWrap = document.getElementById("b-variante-wrap");
  var bVarianteSelect = document.getElementById("b-variante-katalog");
  var akMarkeDatalist = document.getElementById("katalog-marken-liste");

  function katalogMarken() {
    var marken = {};
    geraeteKatalog.forEach(function (g) { marken[g.marke] = true; });
    return Object.keys(marken).sort();
  }

  function befuelleMarkeSelect() {
    if (!bMarkeSelect) return;
    var marken = katalogMarken();
    var html = '<option value="">– Marke wählen –</option>';
    marken.forEach(function (m) { html += '<option value="' + m + '">' + m + "</option>"; });
    html += '<option value="' + SONSTIGES_WERT + '">Sonstige (Freitext)</option>';
    bMarkeSelect.innerHTML = html;
  }

  function befuelleModellKatalogSelect(marke) {
    if (!bModellKatalogSelect) return;
    var modelle = geraeteKatalog.filter(function (g) { return g.marke === marke; });
    var html = '<option value="">– Modell wählen –</option>';
    modelle.forEach(function (g) {
      html += '<option value="' + g.id + '">' + g.modell + " (" + g.jahr + ")</option>";
    });
    html += '<option value="' + SONSTIGES_WERT + '">Sonstiges Modell (Freitext)</option>';
    bModellKatalogSelect.innerHTML = html;
  }

  function befuelleVarianteSelect(katalogId) {
    var geraet = geraeteKatalog.find(function (g) { return g.id === katalogId; });
    if (!geraet || !geraet.varianten || !geraet.varianten.length) {
      bVarianteWrap.hidden = true;
      return;
    }
    var html = '<option value="">– keine Angabe –</option>';
    geraet.varianten.forEach(function (v) {
      html += '<option value="' + v.bezeichnung + '">' + v.bezeichnung + "</option>";
    });
    bVarianteSelect.innerHTML = html;
    bVarianteWrap.hidden = false;
  }

  function befuelleAkMarkenDatalist() {
    if (!akMarkeDatalist) return;
    akMarkeDatalist.innerHTML = katalogMarken().map(function (m) {
      return '<option value="' + m + '"></option>';
    }).join("");
  }

  function ladeGeraeteKatalog() {
    return fetch("/api/katalog")
      .then(function (r) { return r.json(); })
      .then(function (liste) {
        geraeteKatalog = Array.isArray(liste) ? liste : [];
        befuelleMarkeSelect();
        befuelleAkMarkenDatalist();
      })
      .catch(function () { geraeteKatalog = []; });
  }

  if (bMarkeSelect) {
    bMarkeSelect.addEventListener("change", function () {
      bVarianteWrap.hidden = true;
      if (bMarkeSelect.value === SONSTIGES_WERT) {
        bModellKatalogSelect.innerHTML = '<option value="' + SONSTIGES_WERT + '">Sonstiges Modell (Freitext)</option>';
        return;
      }
      befuelleModellKatalogSelect(bMarkeSelect.value);
    });
  }

  if (bModellKatalogSelect) {
    bModellKatalogSelect.addEventListener("change", function () {
      var gewaehlteId = bModellKatalogSelect.value;
      if (gewaehlteId === SONSTIGES_WERT || !gewaehlteId) {
        bVarianteWrap.hidden = true;
        return;
      }
      var geraet = geraeteKatalog.find(function (g) { return g.id === gewaehlteId; });
      if (!geraet) return;
      document.getElementById("b-modell").value = geraet.modell;
      document.getElementById("b-kategorie").value = geraet.kategorie;
      befuelleVarianteSelect(gewaehlteId);
    });
  }

  if (bVarianteSelect) {
    bVarianteSelect.addEventListener("change", function () {
      if (bVarianteSelect.value) document.getElementById("b-speicher").value = bVarianteSelect.value;
    });
  }

  var KATEGORIE_LABEL = {
    smartphones: "Smartphones",
    tablets: "Tablets & iPads",
    smartwatches: "Smartwatches",
    laptops: "Laptops & Notebooks",
    pcs: "PCs",
    monitore: "Monitore",
    kopfhoerer: "Kopfhörer & Audio",
    kameras: "Kameras",
    konsolen: "Spielekonsolen",
    zubehoer: "Zubehör",
  };

  function resetBestandForm() {
    bForm.reset();
    bIdField.value = "";
    document.getElementById("b-datum").value = heute();
    document.getElementById("b-aktiv").checked = true;
    bFormTitle.textContent = "Neues Gerät anlegen";
    bCancelBtn.hidden = true;
    bBildPreview.hidden = true;
    bBildPreview.src = "";
    if (bModellKatalogSelect) bModellKatalogSelect.innerHTML = '<option value="">– zuerst Marke wählen –</option>';
    if (bVarianteWrap) bVarianteWrap.hidden = true;
  }

  function ladeBestand() {
    fetch("/api/bestand")
      .then(function (r) { return r.json(); })
      .then(renderBestandListe)
      .catch(function () {
        bListEl.innerHTML = '<p class="empty-hint">Bestand konnte nicht geladen werden.</p>';
      });
  }

  function renderBestandListe(liste) {
    aktuelleBestandListe = liste.slice().sort(function (a, b) {
      return (b.datum || "").localeCompare(a.datum || "");
    });

    var filterWert = bFilterKategorie ? bFilterKategorie.value : "alle";
    var sichtbar = filterWert === "alle"
      ? aktuelleBestandListe
      : aktuelleBestandListe.filter(function (a) { return a.kategorie === filterWert; });

    if (!sichtbar.length) {
      bListEl.innerHTML = '<p class="empty-hint">' + (aktuelleBestandListe.length ? "Keine Geräte in dieser Kategorie." : "Noch keine Geräte im Bestand angelegt.") + "</p>";
      return;
    }

    bListEl.innerHTML = sichtbar.map(function (a) {
      var bezeichnung = [a.marke, a.modell, a.speicher, a.farbe].filter(Boolean).join(" · ");
      var preisText = a.preis != null ? Number(a.preis).toFixed(2) + " €" : "Preis auf Anfrage";
      return (
        '<div class="angebot-row">' +
        '<img src="/' + a.bild + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
        '<div class="row-info">' +
        "<strong>" + bezeichnung + "</strong>" +
        '<span><span class="kategorie-badge">' + (KATEGORIE_LABEL[a.kategorie] || a.kategorie) + "</span>" + a.zustand + " · " + preisText + " · " + (a.datum || "") + "</span>" +
        "</div>" +
        '<div class="row-actions">' +
        '<button type="button" class="status-pill ' + (a.aktiv ? "on" : "off") + '" data-b-toggle="' + a.id + '">' +
        (a.aktiv ? "Aktiv" : "Inaktiv") +
        "</button>" +
        '<button type="button" class="btn-small btn-secondary" data-b-edit="' + a.id + '">Bearbeiten</button>' +
        '<button type="button" class="btn-small btn-danger" data-b-delete="' + a.id + '">Löschen</button>' +
        "</div>" +
        "</div>"
      );
    }).join("");
  }

  if (bFilterKategorie) {
    bFilterKategorie.addEventListener("change", function () { renderBestandListe(aktuelleBestandListe); });
  }

  bListEl.addEventListener("click", function (e) {
    var toggleId = e.target.getAttribute("data-b-toggle");
    var editId = e.target.getAttribute("data-b-edit");
    var deleteId = e.target.getAttribute("data-b-delete");

    if (toggleId) {
      var a = aktuelleBestandListe.find(function (x) { return x.id === toggleId; });
      if (!a) return;
      fetch("/api/bestand/" + toggleId + "/aktiv", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktiv: !a.aktiv }),
      }).then(ladeBestand);
    }

    if (editId) {
      var a2 = aktuelleBestandListe.find(function (x) { return x.id === editId; });
      if (!a2) return;
      bIdField.value = a2.id;
      document.getElementById("b-modell").value = a2.modell || "";
      if (bMarkeSelect) {
        var markeGefunden = katalogMarken().indexOf(a2.marke) !== -1;
        bMarkeSelect.value = markeGefunden ? a2.marke : SONSTIGES_WERT;
        bVarianteWrap.hidden = true;
        if (markeGefunden) {
          befuelleModellKatalogSelect(a2.marke);
        } else {
          bModellKatalogSelect.innerHTML = '<option value="' + SONSTIGES_WERT + '">Sonstiges Modell (Freitext)</option>';
        }
      }
      document.getElementById("b-speicher").value = a2.speicher || "";
      document.getElementById("b-farbe").value = a2.farbe || "";
      document.getElementById("b-kategorie").value = a2.kategorie || "smartphones";
      document.getElementById("b-zustand").value = a2.zustand || "gebraucht";
      document.getElementById("b-preis").value = a2.preis != null ? a2.preis : "";
      document.getElementById("b-datum").value = a2.datum || heute();
      document.getElementById("b-aktiv").checked = !!a2.aktiv;
      bFormTitle.textContent = "Gerät bearbeiten";
      bCancelBtn.hidden = false;
      if (a2.bild) {
        bBildPreview.src = "/" + a2.bild;
        bBildPreview.hidden = false;
      } else {
        bBildPreview.hidden = true;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (deleteId) {
      if (!confirm("Dieses Gerät wirklich aus dem Bestand löschen?")) return;
      fetch("/api/bestand/" + deleteId, { method: "DELETE" }).then(ladeBestand);
    }
  });

  bBildInput.addEventListener("change", function () {
    var file = bBildInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      bBildPreview.src = e.target.result;
      bBildPreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  bCancelBtn.addEventListener("click", resetBestandForm);

  bForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = bIdField.value;
    var fd = new FormData();
    fd.append("modell", document.getElementById("b-modell").value);
    fd.append("marke", document.getElementById("b-marke").value);
    fd.append("speicher", document.getElementById("b-speicher").value);
    fd.append("farbe", document.getElementById("b-farbe").value);
    fd.append("kategorie", document.getElementById("b-kategorie").value);
    fd.append("zustand", document.getElementById("b-zustand").value);
    fd.append("preis", document.getElementById("b-preis").value);
    fd.append("datum", document.getElementById("b-datum").value || heute());
    fd.append("aktiv", document.getElementById("b-aktiv").checked ? "true" : "false");
    if (bBildInput.files[0]) fd.append("bild", bBildInput.files[0]);

    var url = id ? "/api/bestand/" + id : "/api/bestand";
    var method = id ? "PUT" : "POST";

    fetch(url, { method: method, body: fd })
      .then(function (r) {
        if (!r.ok) throw new Error("Speichern fehlgeschlagen");
        return r.json();
      })
      .then(function () {
        resetBestandForm();
        ladeBestand();
      })
      .catch(function (err) {
        alert(err.message);
      });
  });

  resetForm();
  ladeAngebote();
  ladeGeraeteKatalog();
  resetBestandForm();
  ladeBestand();

  /* ---------- Verkauf/Ankauf Umschalter ---------- */
  var scopeBtns = document.querySelectorAll(".scope-btn");
  var publishAnkaufBtn = document.getElementById("publish-ankauf-btn");

  scopeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var scope = btn.getAttribute("data-scope");
      scopeBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
      document.querySelectorAll("[data-scope-group]").forEach(function (el) {
        el.hidden = el.getAttribute("data-scope-group") !== scope;
      });
      if (scope === "ankauf") {
        var ersterAnkaufTab = document.querySelector('[data-scope-group="ankauf"] .tab-btn');
        if (ersterAnkaufTab) ersterAnkaufTab.click();
      } else {
        var ersterVerkaufTab = document.querySelector('[data-scope-group="verkauf"] .tab-btn');
        if (ersterVerkaufTab) ersterVerkaufTab.click();
      }
    });
  });

  /* ---------- Ankauf: Geräte- & Preisverwaltung ---------- */
  var AK_KATEGORIEN = [
    "smartphones", "tablets", "smartwatches", "laptops", "pcs",
    "monitore", "kopfhoerer", "kameras", "konsolen", "zubehoer",
  ];
  var AK_SEITENGROESSE = 30;

  var akForm = document.getElementById("ankauf-form");
  var akListe = document.getElementById("ankauf-liste");
  var akFormTitle = document.getElementById("ankauf-form-title");
  var akIdField = document.getElementById("ak-id");
  var akKategorie = document.getElementById("ak-kategorie");
  var akMarke = document.getElementById("ak-marke");
  var akModell = document.getElementById("ak-modell");
  var akJahr = document.getElementById("ak-jahr");
  var akUvp = document.getElementById("ak-uvp");
  var akBeliebt = document.getElementById("ak-beliebt");
  var akVariantenBody = document.getElementById("ak-varianten-body");
  var akVarianteHinzufuegenBtn = document.getElementById("ak-variante-hinzufuegen");
  var akNeuBtn = document.getElementById("ankauf-neu-btn");
  var akCancelBtn = document.getElementById("ankauf-form-cancel");
  var akDuplizierenBtn = document.getElementById("ankauf-form-duplizieren");
  var akNeuBerechnenBtn = document.getElementById("ankauf-form-neu-berechnen");
  var akSuche = document.getElementById("ankauf-suche");
  var akFilterKategorie = document.getElementById("ankauf-filter-kategorie");
  var akFilterMarke = document.getElementById("ankauf-filter-marke");
  var akFilterPreisquelle = document.getElementById("ankauf-filter-preisquelle");
  var akAnzahl = document.getElementById("ankauf-anzahl");
  var akLadeHinweis = document.getElementById("ankauf-lade-hinweis");
  var akPagination = document.getElementById("ankauf-pagination");
  var akMassenanpassungBtn = document.getElementById("ankauf-massenanpassung-btn");
  var akMassenanpassungPanel = document.getElementById("ankauf-massenanpassung-panel");
  var maRichtung = document.getElementById("ma-richtung");
  var maWert = document.getElementById("ma-wert");
  var maEinheit = document.getElementById("ma-einheit");
  var maVorschauBtn = document.getElementById("ma-vorschau-btn");
  var maVorschauErgebnis = document.getElementById("ma-vorschau-ergebnis");
  var maVorschauText = document.getElementById("ma-vorschau-text");
  var maVorschauBody = document.getElementById("ma-vorschau-body");
  var maAnwendenBtn = document.getElementById("ma-anwenden-btn");
  var maAbbrechenBtn = document.getElementById("ma-abbrechen-btn");
  var akNiveauBtn = document.getElementById("ankauf-niveau-btn");
  var akNiveauPanel = document.getElementById("ankauf-niveau-panel");
  var niveauSlider = document.getElementById("niveau-slider");
  var niveauWertAnzeige = document.getElementById("niveau-wert-anzeige");
  var niveauVorschauBtn = document.getElementById("niveau-vorschau-btn");
  var niveauVorschauErgebnis = document.getElementById("niveau-vorschau-ergebnis");
  var niveauVorschauBody = document.getElementById("niveau-vorschau-body");
  var niveauAnwendenBtn = document.getElementById("niveau-anwenden-btn");
  var niveauAbbrechenBtn = document.getElementById("niveau-abbrechen-btn");

  var aktuelleAnkaufListe = [];
  var akSeite = 1;

  function leereVariantenZeile(bezeichnung, uvpDelta, preisQuelle) {
    var tr = document.createElement("tr");
    tr.dataset.uvpDelta = uvpDelta || 0;
    tr.dataset.quelle = preisQuelle === "auto" ? "auto" : "manuell";
    tr.innerHTML =
      '<td><input type="text" class="ak-v-bezeichnung" placeholder="z. B. 128 GB" value="' + (bezeichnung || "") + '"></td>' +
      '<td><input type="number" class="ak-v-neuversiegelt" min="0" step="1" value="0"></td>' +
      '<td><input type="number" class="ak-v-wieneu" min="0" step="1" value="0"></td>' +
      '<td><input type="number" class="ak-v-sehrgut" min="0" step="1" value="0"></td>' +
      '<td><input type="number" class="ak-v-gut" min="0" step="1" value="0"></td>' +
      '<td><input type="number" class="ak-v-defekt" min="0" step="1" value="0"></td>' +
      '<td class="ak-v-quelle-zelle"><span class="quelle-badge ' + tr.dataset.quelle + '">' + tr.dataset.quelle + "</span></td>" +
      '<td><button type="button" class="variante-entfernen-btn" title="Variante entfernen">×</button></td>';
    tr.querySelector(".variante-entfernen-btn").addEventListener("click", function () { tr.remove(); });
    tr.querySelectorAll('input[type="number"]').forEach(function (input) {
      input.addEventListener("input", function () {
        tr.dataset.quelle = "manuell";
        var badge = tr.querySelector(".quelle-badge");
        badge.className = "quelle-badge manuell";
        badge.textContent = "manuell";
      });
    });
    return tr;
  }

  function fuelleVariantenTabelle(varianten) {
    akVariantenBody.innerHTML = "";
    (varianten && varianten.length ? varianten : [{ bezeichnung: "", preise: {} }]).forEach(function (v) {
      var tr = leereVariantenZeile(v.bezeichnung, v.uvpDelta, v.preisQuelle);
      if (v.preise) {
        tr.querySelector(".ak-v-neuversiegelt").value = v.preise.neuVersiegelt || 0;
        tr.querySelector(".ak-v-wieneu").value = v.preise.wieNeu || 0;
        tr.querySelector(".ak-v-sehrgut").value = v.preise.sehrGut || 0;
        tr.querySelector(".ak-v-gut").value = v.preise.gut || 0;
        tr.querySelector(".ak-v-defekt").value = v.preise.defekt || 0;
      }
      akVariantenBody.appendChild(tr);
    });
  }

  function sammleVariantenAusTabelle() {
    return Array.from(akVariantenBody.querySelectorAll("tr"))
      .map(function (tr) {
        var bezeichnung = tr.querySelector(".ak-v-bezeichnung").value.trim();
        if (!bezeichnung) return null;
        return {
          bezeichnung: bezeichnung,
          uvpDelta: Number(tr.dataset.uvpDelta) || 0,
          preisQuelle: tr.dataset.quelle === "auto" ? "auto" : "manuell",
          preise: {
            neuVersiegelt: Number(tr.querySelector(".ak-v-neuversiegelt").value) || 0,
            wieNeu: Number(tr.querySelector(".ak-v-wieneu").value) || 0,
            sehrGut: Number(tr.querySelector(".ak-v-sehrgut").value) || 0,
            gut: Number(tr.querySelector(".ak-v-gut").value) || 0,
            defekt: Number(tr.querySelector(".ak-v-defekt").value) || 0,
          },
        };
      })
      .filter(Boolean);
  }

  akVarianteHinzufuegenBtn.addEventListener("click", function () {
    akVariantenBody.appendChild(leereVariantenZeile("", 0, "manuell"));
  });

  function resetAnkaufForm() {
    akForm.reset();
    akIdField.value = "";
    akFormTitle.textContent = "Neues Gerät anlegen";
    akDuplizierenBtn.hidden = true;
    akNeuBerechnenBtn.hidden = true;
    fuelleVariantenTabelle([]);
    akForm.hidden = true;
  }

  function ladeAnkauf() {
    akLadeHinweis.hidden = false;
    akListe.innerHTML = "";
    fetch("/api/ankauf")
      .then(function (r) { return r.json(); })
      .then(function (liste) {
        akLadeHinweis.hidden = true;
        akSeite = 1;
        renderAnkaufListe(liste);
      })
      .catch(function () {
        akLadeHinweis.hidden = true;
        akListe.innerHTML = '<p class="empty-hint">Ankaufspreise konnten nicht geladen werden.</p>';
      });
  }

  function befuelleMarkenFilter() {
    var aktuellerWert = akFilterMarke.value;
    var marken = Array.from(new Set(aktuelleAnkaufListe.map(function (g) { return g.marke; }).filter(Boolean))).sort();
    akFilterMarke.innerHTML = '<option value="alle">Alle Marken</option>' +
      marken.map(function (m) { return '<option value="' + m + '">' + m + "</option>"; }).join("");
    if (marken.indexOf(aktuellerWert) !== -1) akFilterMarke.value = aktuellerWert;
  }

  function gefilterteAnkaufListe() {
    var suchbegriff = (akSuche.value || "").trim().toLowerCase();
    var kategorieFilter = akFilterKategorie.value;
    var markeFilter = akFilterMarke.value;
    var quelleFilter = akFilterPreisquelle.value;

    return aktuelleAnkaufListe.filter(function (g) {
      if (kategorieFilter !== "alle" && g.kategorie !== kategorieFilter) return false;
      if (markeFilter !== "alle" && g.marke !== markeFilter) return false;
      if (quelleFilter !== "alle" && !g.varianten.some(function (v) { return v.preisQuelle === quelleFilter; })) return false;
      if (suchbegriff && (g.marke + " " + g.modell).toLowerCase().indexOf(suchbegriff) === -1) return false;
      return true;
    });
  }

  function variantenInlineHtml(geraet) {
    return (
      '<div class="geraet-varianten-inline">' +
      geraet.varianten.map(function (v, idx) {
        return (
          '<div class="variante-inline-row" data-geraet-id="' + geraet.id + '" data-variante-index="' + idx + '">' +
          '<span class="v-bez">' + v.bezeichnung + '<span class="quelle-badge ' + v.preisQuelle + '">' + v.preisQuelle + "</span></span>" +
          '<label>Neu &amp; versiegelt<input type="number" class="v-inline-preis" data-tier="neuVersiegelt" min="0" step="1" value="' + v.preise.neuVersiegelt + '"></label>' +
          '<label>Wie neu<input type="number" class="v-inline-preis" data-tier="wieNeu" min="0" step="1" value="' + v.preise.wieNeu + '"></label>' +
          '<label>Sehr gut<input type="number" class="v-inline-preis" data-tier="sehrGut" min="0" step="1" value="' + v.preise.sehrGut + '"></label>' +
          '<label>Gut<input type="number" class="v-inline-preis" data-tier="gut" min="0" step="1" value="' + v.preise.gut + '"></label>' +
          '<label>Defekt<input type="number" class="v-inline-preis" data-tier="defekt" min="0" step="1" value="' + v.preise.defekt + '"></label>' +
          "</div>"
        );
      }).join("") +
      "</div>"
    );
  }

  function renderPagination(gesamtAnzahl) {
    var seitenAnzahl = Math.max(1, Math.ceil(gesamtAnzahl / AK_SEITENGROESSE));
    if (akSeite > seitenAnzahl) akSeite = seitenAnzahl;
    akPagination.innerHTML =
      '<button type="button" id="ak-seite-zurueck"' + (akSeite <= 1 ? " disabled" : "") + '>← Zurück</button>' +
      "<span>Seite " + akSeite + " von " + seitenAnzahl + "</span>" +
      '<button type="button" id="ak-seite-vor"' + (akSeite >= seitenAnzahl ? " disabled" : "") + '>Weiter →</button>';

    var zurueckBtn = document.getElementById("ak-seite-zurueck");
    var vorBtn = document.getElementById("ak-seite-vor");
    if (zurueckBtn) zurueckBtn.addEventListener("click", function () { akSeite--; renderAnkaufListe(aktuelleAnkaufListe); });
    if (vorBtn) vorBtn.addEventListener("click", function () { akSeite++; renderAnkaufListe(aktuelleAnkaufListe); });
  }

  function renderAnkaufListe(liste) {
    if (liste) {
      aktuelleAnkaufListe = liste.slice().sort(function (a, b) {
        return (a.marke + a.modell).localeCompare(b.marke + b.modell);
      });
      befuelleMarkenFilter();
    }

    var gefiltert = gefilterteAnkaufListe();
    akAnzahl.textContent = gefiltert.length + " von " + aktuelleAnkaufListe.length + " Geräten";

    if (!gefiltert.length) {
      akListe.innerHTML = '<p class="empty-hint">' + (aktuelleAnkaufListe.length ? "Keine Geräte für diese Suche/Filter." : "Noch keine Ankaufsgeräte angelegt.") + "</p>";
      akPagination.innerHTML = "";
      return;
    }

    var start = (akSeite - 1) * AK_SEITENGROESSE;
    var seite = gefiltert.slice(start, start + AK_SEITENGROESSE);

    akListe.innerHTML = seite.map(function (g) {
      var bezeichnung = [g.marke, g.modell].filter(Boolean).join(" ");
      var metaText = (g.jahr ? g.jahr + " · " : "") + (g.neupreisUvp ? "UVP " + g.neupreisUvp + " €" : "") + (g.beliebt ? " · ★ beliebt" : "");
      return (
        '<div class="angebot-row ankauf-row">' +
        '<div class="row-info">' +
        "<strong>" + bezeichnung + "</strong>" +
        '<span><span class="kategorie-badge">' + (KATEGORIE_LABEL[g.kategorie] || g.kategorie) + "</span>" + metaText + "</span>" +
        variantenInlineHtml(g) +
        "</div>" +
        '<div class="row-actions">' +
        '<button type="button" class="btn-small btn-secondary" data-ak-edit="' + g.id + '">Bearbeiten</button>' +
        '<button type="button" class="btn-small btn-secondary" data-ak-duplizieren="' + g.id + '">Duplizieren</button>' +
        '<button type="button" class="btn-small btn-danger" data-ak-delete="' + g.id + '">Löschen</button>' +
        "</div>" +
        "</div>"
      );
    }).join("");

    renderPagination(gefiltert.length);
  }

  [akSuche, akFilterKategorie, akFilterMarke, akFilterPreisquelle].forEach(function (el) {
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () {
      akSeite = 1;
      renderAnkaufListe();
    });
  });

  akNeuBtn.addEventListener("click", function () {
    resetAnkaufForm();
    akForm.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  akCancelBtn.addEventListener("click", resetAnkaufForm);

  function ladeGeraetInFormular(g) {
    akIdField.value = g.id;
    akKategorie.value = g.kategorie;
    akMarke.value = g.marke || "";
    akModell.value = g.modell || "";
    akJahr.value = g.jahr || "";
    akUvp.value = g.neupreisUvp || "";
    akBeliebt.checked = !!g.beliebt;
    fuelleVariantenTabelle(g.varianten);
    akFormTitle.textContent = "Gerät bearbeiten";
    akDuplizierenBtn.hidden = false;
    akNeuBerechnenBtn.hidden = false;
    akForm.hidden = false;
  }

  akListe.addEventListener("click", function (e) {
    var editId = e.target.getAttribute("data-ak-edit");
    var duplizierenId = e.target.getAttribute("data-ak-duplizieren");
    var deleteId = e.target.getAttribute("data-ak-delete");

    if (editId) {
      var g = aktuelleAnkaufListe.find(function (x) { return x.id === editId; });
      if (!g) return;
      ladeGeraetInFormular(g);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (duplizierenId) {
      fetch("/api/ankauf/" + duplizierenId + "/duplizieren", { method: "POST" })
        .then(function (r) { return r.json(); })
        .then(ladeAnkauf)
        .catch(function (err) { alert(err.message); });
    }

    if (deleteId) {
      if (!confirm("Dieses Gerät wirklich aus dem Ankaufsrechner löschen?")) return;
      fetch("/api/ankauf/" + deleteId, { method: "DELETE" }).then(ladeAnkauf);
    }
  });

  /* Inline-Edit: Preisfelder direkt in der Geräteliste, Speichern bei blur */
  akListe.addEventListener("blur", function (e) {
    if (!e.target.classList || !e.target.classList.contains("v-inline-preis")) return;
    var zeile = e.target.closest(".variante-inline-row");
    var geraetId = zeile.getAttribute("data-geraet-id");
    var variantenIndex = Number(zeile.getAttribute("data-variante-index"));
    var geraet = aktuelleAnkaufListe.find(function (g) { return g.id === geraetId; });
    if (!geraet) return;

    var variante = geraet.varianten[variantenIndex];
    var neuerWert = Number(e.target.value) || 0;
    var tier = e.target.getAttribute("data-tier");
    if (variante.preise[tier] === neuerWert) return; // keine Änderung, kein Request nötig

    variante.preise[tier] = neuerWert;
    variante.preisQuelle = "manuell";

    fetch("/api/ankauf/" + geraet.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kategorie: geraet.kategorie,
        marke: geraet.marke,
        modell: geraet.modell,
        jahr: geraet.jahr,
        neupreisUvp: geraet.neupreisUvp,
        beliebt: geraet.beliebt,
        varianten: geraet.varianten,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        var badge = zeile.querySelector(".quelle-badge");
        badge.className = "quelle-badge manuell";
        badge.textContent = "manuell";
      })
      .catch(function (err) { alert("Speichern fehlgeschlagen: " + err.message); });
  }, true);

  akForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = akIdField.value;
    var payload = {
      kategorie: akKategorie.value,
      marke: akMarke.value,
      modell: akModell.value,
      jahr: Number(akJahr.value) || new Date().getFullYear(),
      neupreisUvp: Number(akUvp.value) || 0,
      beliebt: akBeliebt.checked,
      varianten: sammleVariantenAusTabelle(),
    };

    if (!payload.varianten.length) {
      alert("Bitte mindestens eine Variante mit Bezeichnung anlegen.");
      return;
    }

    var url = id ? "/api/ankauf/" + id : "/api/ankauf";
    var method = id ? "PUT" : "POST";

    fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("Speichern fehlgeschlagen");
        return r.json();
      })
      .then(function () {
        resetAnkaufForm();
        ladeAnkauf();
      })
      .catch(function (err) {
        alert(err.message);
      });
  });

  akNeuBerechnenBtn.addEventListener("click", function () {
    var id = akIdField.value;
    if (!id) return;
    if (!confirm("Preise für alle \"auto\"-Varianten dieses Geräts anhand von UVP/Erscheinungsjahr neu berechnen? Manuell gesetzte Preise bleiben unverändert.")) return;
    fetch("/api/ankauf/" + id + "/neu-berechnen", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (g) {
        fuelleVariantenTabelle(g.varianten);
      })
      .catch(function (err) { alert(err.message); });
  });

  /* ---------- Massen-Anpassung ---------- */
  akMassenanpassungBtn.addEventListener("click", function () {
    akMassenanpassungPanel.hidden = !akMassenanpassungPanel.hidden;
    maVorschauErgebnis.hidden = true;
  });

  akNiveauBtn.addEventListener("click", function () {
    akNiveauPanel.hidden = !akNiveauPanel.hidden;
    niveauVorschauErgebnis.hidden = true;
    if (!akNiveauPanel.hidden) {
      fetch("/api/preisniveau")
        .then(function (r) { return r.json(); })
        .then(function (daten) {
          niveauSlider.value = daten.prozent;
          niveauWertAnzeige.textContent = daten.prozent + " %";
        })
        .catch(function () {});
    }
  });

  niveauSlider.addEventListener("input", function () {
    niveauWertAnzeige.textContent = niveauSlider.value + " %";
  });

  function aktuellerMassenanpassungFilter() {
    return {
      kategorie: akFilterKategorie.value,
      marke: akFilterMarke.value,
      preisQuelle: akFilterPreisquelle.value,
      suchbegriff: akSuche.value,
    };
  }

  function massenanpassungPayload() {
    return {
      filter: aktuellerMassenanpassungFilter(),
      einheit: maEinheit.value,
      richtung: maRichtung.value,
      wert: Number(maWert.value) || 0,
    };
  }

  function renderMassenanpassungVorschau(daten) {
    maVorschauText.textContent =
      daten.betroffeneGeraeteAnzahl + " Geräte / " + daten.betroffeneVarianten + " Varianten betroffen. Beispiele (max. 10):";
    maVorschauBody.innerHTML = daten.beispiele.map(function (b) {
      return (
        "<tr><td>" + b.geraet + "</td><td>" + b.variante + "</td>" +
        "<td>Neu&amp;versiegelt " + b.alt.neuVersiegelt + " € / Gut " + b.alt.gut + " €</td>" +
        "<td>Neu&amp;versiegelt " + b.neu.neuVersiegelt + " € / Gut " + b.neu.gut + " €</td></tr>"
      );
    }).join("");
    maVorschauErgebnis.hidden = false;
  }

  maVorschauBtn.addEventListener("click", function () {
    fetch("/api/ankauf/massenanpassung/vorschau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(massenanpassungPayload()),
    })
      .then(function (r) { return r.json(); })
      .then(renderMassenanpassungVorschau)
      .catch(function (err) { alert(err.message); });
  });

  maAnwendenBtn.addEventListener("click", function () {
    if (!confirm("Preisänderung jetzt für alle gefilterten Geräte übernehmen? Betroffene Preise werden als \"manuell\" markiert.")) return;
    fetch("/api/ankauf/massenanpassung/anwenden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(massenanpassungPayload()),
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        akMassenanpassungPanel.hidden = true;
        maVorschauErgebnis.hidden = true;
        ladeAnkauf();
      })
      .catch(function (err) { alert(err.message); });
  });

  maAbbrechenBtn.addEventListener("click", function () {
    maVorschauErgebnis.hidden = true;
  });

  function renderNiveauVorschau(daten) {
    niveauVorschauBody.innerHTML = daten.beispiele.map(function (b) {
      return (
        "<tr><td>" + b.geraet + "</td><td>" + b.variante + "</td>" +
        "<td>Sehr gut " + b.aktuell.sehrGut + " € / Gut " + b.aktuell.gut + " €</td>" +
        "<td>Sehr gut " + b.neu.sehrGut + " € / Gut " + b.neu.gut + " €</td></tr>"
      );
    }).join("");
    niveauVorschauErgebnis.hidden = false;
  }

  niveauVorschauBtn.addEventListener("click", function () {
    fetch("/api/preisniveau/vorschau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prozent: Number(niveauSlider.value) }),
    })
      .then(function (r) { return r.json(); })
      .then(renderNiveauVorschau)
      .catch(function (err) { alert(err.message); });
  });

  niveauAnwendenBtn.addEventListener("click", function () {
    var prozent = Number(niveauSlider.value);
    if (!confirm("Ankaufsniveau auf " + prozent + " % setzen? Wirkt ab sofort auf alle automatisch berechneten Preise (bei \"Neu berechnen\"/Build).")) return;
    fetch("/api/preisniveau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prozent: prozent }),
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        akNiveauPanel.hidden = true;
        niveauVorschauErgebnis.hidden = true;
      })
      .catch(function (err) { alert(err.message); });
  });

  niveauAbbrechenBtn.addEventListener("click", function () {
    niveauVorschauErgebnis.hidden = true;
  });

  if (publishAnkaufBtn) {
    publishAnkaufBtn.addEventListener("click", function () {
      publishAnkaufBtn.disabled = true;
      publishAnkaufBtn.textContent = "Veröffentliche …";
      publishLog.hidden = false;
      publishLog.textContent = "Starte Veröffentlichung der Ankaufspreise (Master + " + AK_KATEGORIEN.length + " Kategorie-Dateien) …";

      var dateien = ["ankauf-preise.json"].concat(AK_KATEGORIEN.map(function (k) { return "ankauf/" + k + ".json"; }));

      fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nachricht: "Ankaufspreise aktualisiert", dateien: dateien }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          publishLog.textContent = (data.log || "") + (data.error ? "\n\nFehler: " + data.error : "\n\nFertig.");
        })
        .catch(function (err) {
          publishLog.textContent = "Fehler: " + err.message;
        })
        .then(function () {
          publishAnkaufBtn.disabled = false;
          publishAnkaufBtn.textContent = "Ankaufspreise veröffentlichen (GitHub Pages)";
        });
    });
  }

  resetAnkaufForm();
  ladeAnkauf();
})();

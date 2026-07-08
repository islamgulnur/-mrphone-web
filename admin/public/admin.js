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
      body: JSON.stringify({ nachricht: "Angebote aktualisiert" }),
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

  resetForm();
  ladeAngebote();
})();

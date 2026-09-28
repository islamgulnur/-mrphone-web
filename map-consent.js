/* Mr. Phone – Google-Maps-Einbettung erst nach Klick (kein Google-Request vorher,
   keine Einwilligung gespeichert, gilt pro Seitenaufruf). */
(function () {
  "use strict";
  document.querySelectorAll("[data-map-consent]").forEach(function (wrap) {
    var btn = wrap.querySelector("[data-map-load-btn]");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = wrap.getAttribute("data-map-src");
      iframe.title = wrap.getAttribute("data-map-title") || "";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      wrap.replaceWith(iframe);
    });
  });
})();

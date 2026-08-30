/* Mr. Phone – 5x schnelles Antippen der E-Mail-Adresse öffnet den Admin-Bereich.
 * Reine Navigations-Abkürzung, KEINE Sicherheitsfunktion. Der eigentliche Schutz
 * erfolgt über das POS-Login und die serverseitig geprüfte Betreiberrolle. */
(function () {
  "use strict";

  var link = document.querySelector('a[href^="mailto:mr.phone.zeil@gmail.com"]');
  if (!link) return;

  var ADMIN_URL = "https://mrphone-pos.vercel.app/website-admin";
  var NOETIGE_TAPS = 5;
  var TAP_FENSTER_MS = 2500;
  var NORMALES_VERHALTEN_VERZOEGERUNG_MS = 350;

  var taps = [];
  var normalNavigationTimer = null;

  link.addEventListener("click", function (e) {
    e.preventDefault();
    var jetzt = Date.now();
    taps.push(jetzt);
    taps = taps.filter(function (t) { return jetzt - t < TAP_FENSTER_MS; });

    if (taps.length >= NOETIGE_TAPS) {
      taps = [];
      if (normalNavigationTimer) { clearTimeout(normalNavigationTimer); normalNavigationTimer = null; }
      window.location.href = ADMIN_URL;
      return;
    }

    // Normales Verhalten (E-Mail-Client öffnen) nach kurzer Wartezeit, falls keine weiteren
    // schnellen Klicks folgen - damit die Geste normale Besucher praktisch nicht stört.
    if (normalNavigationTimer) clearTimeout(normalNavigationTimer);
    normalNavigationTimer = setTimeout(function () {
      window.location.href = link.href;
    }, NORMALES_VERHALTEN_VERZOEGERUNG_MS);
  });
})();

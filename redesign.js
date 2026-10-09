/* Mr. Phone - Scroll-Story-Redesign (Branch redesign/scroll-story).
   NUR auf index.html eingebunden, lädt NACH main.js/hero-video.js.
   Folgt der bestehenden Konvention (IIFE, reduceMotion-Check, siehe main.js). */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Preloader ----------
     Nur beim ersten Besuch pro Session, nie bei reduced-motion, nie ohne JS/für
     Bots (Basis-CSS ist display:none). Reiner Overlay über bereits gerendertem
     HTML - verzögert nichts, der eigentliche Inhalt ist unabhängig davon sofort
     im DOM. Max. 1,5s Vorgabe: 1,2s Ladebalken + 0,4s Fade-out, großzügig darunter. */
  function initPreloader() {
    if (reduceMotion) return;

    var SESSION_KEY = "mrphone-preloader-seen";
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (e) {
      return; // z.B. Privacy-Mode ohne sessionStorage: lieber kein Preloader als Fehler
    }

    document.body.classList.add("rs-preloader-active");

    window.setTimeout(function () {
      document.body.classList.add("rs-preloader-hide");
      window.setTimeout(function () {
        document.body.classList.remove("rs-preloader-active", "rs-preloader-hide");
        var el = document.querySelector("[data-rs-preloader]");
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 450);
    }, 1200);
  }

  /* ---------- Hero-Parallax ---------- */
  /* siehe Commit "Section 2: Hero" */

  initPreloader();
})();

/* Mr. Phone - Scroll-Story-Redesign (Branch redesign/scroll-story).
   NUR auf index.html eingebunden, lädt NACH main.js/hero-video.js.
   Folgt der bestehenden Konvention (IIFE, reduceMotion-Check, siehe main.js). */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Preloader ----------
     Die Sichtbarkeits-Entscheidung (erster Besuch/Session, reduced-motion) ist
     bereits synchron im <head>-Inline-Script VOR dem ersten Paint gefallen (setzt
     .rs-preloader-pending auf <html>, kein FOUC). Hier nur noch: Balken animieren,
     nach Ablauf (oder sofort bei Klick/Tap/Scroll) ausblenden, aus dem DOM entfernen.
     Timing muss zu redesign.css passen: Desktop 0,8s Balken + 0,3s Fade (1,1s),
     Mobile ≤768px 0,4s + 0,2s (0,6s). */
  function initPreloader() {
    var html = document.documentElement;
    if (!html.classList.contains("rs-preloader-pending")) return;

    var isMobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    var BAR_MS = isMobile ? 400 : 800;
    var FADE_MS = isMobile ? 200 : 300;
    var dismissed = false;
    var timer = null;

    function cleanup() {
      var el = document.querySelector("[data-rs-preloader]");
      if (el && el.parentNode) el.parentNode.removeChild(el);
      html.classList.remove("rs-preloader-pending", "rs-preloader-hide");
      document.removeEventListener("click", dismiss);
      document.removeEventListener("touchstart", dismiss, { passive: true });
      window.removeEventListener("scroll", dismiss, { passive: true });
      window.removeEventListener("wheel", dismiss, { passive: true });
    }

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (timer) window.clearTimeout(timer);
      html.classList.add("rs-preloader-hide");
      window.setTimeout(cleanup, FADE_MS);
    }

    document.addEventListener("click", dismiss);
    document.addEventListener("touchstart", dismiss, { passive: true });
    window.addEventListener("scroll", dismiss, { passive: true });
    window.addEventListener("wheel", dismiss, { passive: true });

    timer = window.setTimeout(dismiss, BAR_MS);
  }

  /* ---------- Hero-Parallax ---------- */
  /* siehe Commit "Section 2: Hero" */

  initPreloader();
})();

/* Mr. Phone - Scroll-Story-Redesign (Branch redesign/scroll-story).
   NUR auf index.html eingebunden, lädt NACH main.js/hero-video.js.
   Folgt der bestehenden Konvention (IIFE, reduceMotion-Check, siehe main.js). */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Preloader ---------- */
  /* siehe Commit "Section 1: Preloader" */

  /* ---------- Hero-Parallax ---------- */
  /* siehe Commit "Section 2: Hero" */

  document.addEventListener("DOMContentLoaded", function () {
    // init-Aufrufe kommen mit den jeweiligen Sektions-Commits dazu
  });
})();

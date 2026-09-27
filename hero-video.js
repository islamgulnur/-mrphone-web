/* Mr. Phone – Hero-Video: dekorativer Hintergrund, Standbild ohne JS/bei
   reduced-motion/Sparmodus, IntersectionObserver pausiert außerhalb des Screens. */
(function () {
  "use strict";

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function saveData() {
    return !!(navigator.connection && navigator.connection.saveData);
  }

  function initHeroVideo(wrap) {
    var video = wrap.querySelector("[data-hero-video-el]");
    if (!video) return;
    if (reduceMotion() || saveData()) return; // Standbild (poster) reicht als Fallback

    var istMobil = window.innerWidth < 768;
    var mp4 = istMobil && video.getAttribute("data-mp4-mobile")
      ? video.getAttribute("data-mp4-mobile")
      : video.getAttribute("data-mp4");
    var webm = video.getAttribute("data-webm");

    if (!istMobil && webm) {
      var sourceWebm = document.createElement("source");
      sourceWebm.src = webm;
      sourceWebm.type = "video/webm";
      video.appendChild(sourceWebm);
    }
    if (mp4) {
      var sourceMp4 = document.createElement("source");
      sourceMp4.src = mp4;
      sourceMp4.type = "video/mp4";
      video.appendChild(sourceMp4);
    }

    video.addEventListener("error", function () {
      video.style.display = "none"; // Poster (Hintergrundbild des <video>) bleibt sichtbar
    });

    video.muted = true;
    video.load();
    video.play().catch(function () {
      /* Autoplay vom Browser blockiert - Standbild bleibt sichtbar, kein Fehler */
    });

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            video.play().catch(function () {});
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.1 });
      observer.observe(wrap);
    }
  }

  document.querySelectorAll("[data-hero-video]").forEach(initHeroVideo);
})();

/* Mr. Phone – Scroll-3D: pinnt einen 3D-Render in einem hohen Abschnitt und
   scrubbt ihn per Scrollposition (wie ein Apple-Produktfilm). Ohne JS/bei
   reduced-motion/Sparmodus bleibt das Poster stehen - kein gebrochenes Layout,
   da position:sticky rein per CSS funktioniert. Folgt dem Muster aus
   hero-video.js (Quellen erst per JS anhängen, reduceMotion/saveData prüfen). */
(function () {
  "use strict";

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function saveData() {
    return !!(navigator.connection && navigator.connection.saveData);
  }

  function initScroll3d(section) {
    var video = section.querySelector("[data-scroll3d-video]");
    if (!video) return;
    if (reduceMotion() || saveData()) return; // Standbild (poster) reicht als Fallback

    var webm = video.getAttribute("data-webm");
    var mp4 = video.getAttribute("data-mp4");
    if (webm) {
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
      video.style.display = "none"; // Poster bleibt sichtbar
    });

    video.muted = true;
    video.load();

    video.addEventListener("loadedmetadata", function () {
      var duration = video.duration || 0;
      if (!duration) return;

      var ticking = false;

      function onScroll() {
        ticking = false;
        var rect = section.getBoundingClientRect();
        var total = rect.height - window.innerHeight;
        if (total <= 0) return;
        var progress = Math.min(1, Math.max(0, -rect.top / total));
        var target = progress * duration;
        if (Math.abs(video.currentTime - target) > 0.03) {
          video.currentTime = target;
        }
      }

      function onScrollThrottled() {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(onScroll);
        }
      }

      window.addEventListener("scroll", onScrollThrottled, { passive: true });
      window.addEventListener("resize", onScrollThrottled, { passive: true });
      onScroll();
    }, { once: true });
  }

  document.querySelectorAll("[data-scroll3d]").forEach(initScroll3d);
})();

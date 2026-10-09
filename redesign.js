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

  /* ---------- Statement-Reveal (Wort-für-Wort + "Handy fliegt durch") ----------
     Bewusst ohne GSAP: läuft sofort (nicht erst nach Idle/Vendor-Laden gegated), reiner
     Scroll-Listener analog initParallax3D oben. Basis-Deckkraft 0.25 ist per CSS gesetzt
     (ohne JS/bei reduced-motion voll lesbar), hier nur die Progressive-Enhancement-Animation. */
  function initStatementReveal() {
    if (reduceMotion) return;
    var section = document.querySelector("[data-statement-reveal]");
    if (!section) return;
    var words = section.querySelectorAll(".statement-word");
    var photo = section.querySelector("[data-statement-photo]");
    if (!words.length) return;

    var ticking = false;

    function update() {
      ticking = false;
      var rect = section.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height + vh;
      var progress = Math.min(1, Math.max(0, (vh - rect.top) / total));
      var n = words.length;
      words.forEach(function (w, i) {
        var wordProgress = Math.min(1, Math.max(0, progress * n - i));
        w.style.opacity = (0.6 + wordProgress * 0.4).toFixed(2);
      });
      if (photo) {
        var x = (progress - 0.5) * 220;
        var tilt = (progress - 0.5) * 18; // bleibt unter dem ±15°-Limit (max ±9° hier)
        photo.style.transform =
          "translate(-50%,-50%) translateX(" + x.toFixed(1) + "%) rotateY(" + tilt.toFixed(1) + "deg) scale(" + (0.85 + progress * 0.3).toFixed(2) + ")";
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ---------- Lenis Smooth Scroll (nur Desktop, nie bei reduced-motion) ---------- */
  function initLenis() {
    if (reduceMotion) return;
    if (!window.Lenis || !window.gsap) return;
    var isDesktop = window.matchMedia && window.matchMedia("(min-width: 900px)").matches;
    if (!isDesktop) return;

    var lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    if (window.ScrollTrigger) lenis.on("scroll", window.ScrollTrigger.update);
    window.gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    window.gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Hero-Parallax (echte Gerätefotos, 2.5D) ----------
     Nur translate/scale/Tilt, max ±15° rotateX/rotateY - laut Vorgabe KEINE volle 3D-Drehung
     (ein flaches Foto sieht dabei falsch aus). "Handy fliegt durch" entsteht durch die 3
     verschiedenen Foto-Slots (vorne/schräg/hinten), nicht durch Rotation eines einzelnen Fotos. */
  function initHeroParallax() {
    if (reduceMotion) return;
    if (!window.gsap || !window.ScrollTrigger) return;

    var hero = document.querySelector("[data-hero-scroll]");
    if (!hero) return;
    var floaters = hero.querySelectorAll("[data-hero-floater]");
    if (!floaters.length) return;

    window.gsap.registerPlugin(window.ScrollTrigger);

    var KEYFRAMES = [
      { x: 6, y: -16, rx: 7, ry: -9, scale: 1.04 },
      { x: -14, y: 14, rx: -5, ry: 7, scale: 0.97 },
      { x: 10, y: -8, rx: 9, ry: -11, scale: 1.02 },
    ];

    floaters.forEach(function (el, i) {
      var kf = KEYFRAMES[i % KEYFRAMES.length];
      window.gsap.set(el, { y: 36, rotateX: 0, rotateY: 0, scale: 0.92, opacity: 0 });
      window.gsap.to(el, {
        x: kf.x,
        y: kf.y,
        rotateX: kf.rx,
        rotateY: kf.ry,
        scale: kf.scale,
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: hero,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    });
  }

  /* ---------- Vendor-Libs dynamisch nachladen (GSAP/ScrollTrigger/Lenis) ----------
     Nicht als <script defer> im HTML - deren reines Parsen/Ausführen (~137KB unminifiziert)
     kostet Hauptthread-Zeit synchron vor DOMContentLoaded und verzögerte dadurch LCP messbar
     (2.0s-Budget gerissen). Keins der 3 Skripte wird für den ersten Paint gebraucht (nur für
     späteres Scroll-Verhalten) - also komplett aus dem kritischen Pfad, erst nach Window-Load/
     Idle nachladen. */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function loadVendorAndInit() {
    Promise.all([
      loadScript("vendor/gsap/gsap.min.js"),
      loadScript("vendor/gsap/ScrollTrigger.min.js"),
      loadScript("vendor/lenis/lenis.min.js"),
    ])
      .then(function () {
        initLenis();
        initHeroParallax();
      })
      .catch(function () {
        /* Vendor-Skripte nicht erreichbar: Seite bleibt vollständig nutzbar, nur ohne
           Scroll-Parallax/Smooth-Scroll - Progressive Enhancement, kein Fehlerzustand. */
      });
  }

  initPreloader();
  initStatementReveal();

  if (!reduceMotion) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadVendorAndInit, { timeout: 1500 });
    } else {
      window.addEventListener("load", function () {
        window.setTimeout(loadVendorAndInit, 0);
      });
    }
  }
})();

/* Scroll-gesteuerte 3D-Smartphone-Hintergrundanimation (nur index.html) */
(function () {
  "use strict";
  var scene = document.querySelector(".phone-scene");
  if (!scene) return;
  var track = scene.querySelector(".phone-track");

  /* Keyframes: scrollProgress (0-1) -> x/y (vw/vh), rotateX/Y/Z (deg), scale, opacity.
     Dazwischen wird linear interpoliert. Zum Anpassen der Choreografie Werte ändern. */
  var KEYFRAMES = [
    { p: 0.00, x: 76, y: 10, rx: -10, ry: -16, rz: -6, s: 1.0, o: 0.68 },
    { p: 0.08, x: 72, y: 13, rx: -6, ry: -4, rz: -4, s: 1.03, o: 0.6 },
    { p: 0.2, x: 40, y: 20, rx: 2, ry: 90, rz: 0, s: 1.0, o: 0.3 },
    { p: 0.26, x: 12, y: 28, rx: 6, ry: 180, rz: 2, s: 1.0, o: 0.26 },
    { p: 0.4, x: 88, y: 24, rx: -6, ry: 195, rz: -6, s: 0.92, o: 0.22 },
    { p: 0.48, x: 84, y: 20, rx: -7, ry: 208, rz: -16, s: 0.9, o: 0.26 },
    { p: 0.58, x: 88, y: 16, rx: -8, ry: 200, rz: -18, s: 0.85, o: 0.15 },
    { p: 0.6, x: 55, y: 36, rx: -4, ry: 150, rz: 0, s: 1.05, o: 0.6 },
    { p: 0.665, x: 85, y: 18, rx: -6, ry: 170, rz: -10, s: 0.9, o: 0.18 },
    { p: 0.725, x: 42, y: 22, rx: 4, ry: -15, rz: 6, s: 1.0, o: 0.58 },
    { p: 0.82, x: 85, y: 16, rx: -8, ry: 0, rz: 0, s: 0.8, o: 0.14 },
    { p: 0.9, x: 88, y: 14, rx: -8, ry: 0, rz: 0, s: 0.75, o: 0 }
  ];

  var mqMobile = window.matchMedia("(max-width: 767px)");
  var mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var LERP = 0.08;
  var current = { x: 76, y: 10, rx: -10, ry: -16, rz: -6, s: 1.0, o: 0 };
  var target = current, ticking = false, scrollBound = false;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function sampleKeyframes(p) {
    var last = KEYFRAMES.length - 1;
    if (p <= KEYFRAMES[0].p) return KEYFRAMES[0];
    if (p >= KEYFRAMES[last].p) return KEYFRAMES[last];
    for (var i = 1; i <= last; i++) {
      if (p > KEYFRAMES[i].p) continue;
      var a = KEYFRAMES[i - 1], b = KEYFRAMES[i], t = (p - a.p) / (b.p - a.p);
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), rx: lerp(a.rx, b.rx, t),
        ry: lerp(a.ry, b.ry, t), rz: lerp(a.rz, b.rz, t), s: lerp(a.s, b.s, t), o: lerp(a.o, b.o, t) };
    }
    return KEYFRAMES[last];
  }

  function applyTransform() {
    track.style.transform = "translate3d(" + current.x.toFixed(2) + "vw," + current.y.toFixed(2) + "vh,0) " +
      "rotateX(" + current.rx.toFixed(2) + "deg) rotateY(" + current.ry.toFixed(2) + "deg) rotateZ(" + current.rz.toFixed(2) + "deg) " +
      "scale(" + current.s.toFixed(3) + ")";
    track.style.opacity = current.o.toFixed(3);
  }

  function frame() {
    var stillMoving = false;
    for (var k in target) {
      var diff = target[k] - current[k];
      if (Math.abs(diff) > 0.001) { current[k] += diff * LERP; stillMoving = true; }
      else current[k] = target[k];
    }
    applyTransform();
    if (stillMoving) requestAnimationFrame(frame); else ticking = false;
  }

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    target = sampleKeyframes(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  function enableScrollMode() {
    scene.classList.remove("phone-scene--static");
    if (!scrollBound) { window.addEventListener("scroll", onScroll, { passive: true }); scrollBound = true; }
    onScroll();
  }

  function disableScrollMode() {
    if (scrollBound) { window.removeEventListener("scroll", onScroll); scrollBound = false; }
    track.style.transform = "";
    track.style.opacity = "";
    scene.classList.add("phone-scene--static");
  }

  function evaluateMode() {
    if (mqMobile.matches || mqReduced.matches) disableScrollMode(); else enableScrollMode();
  }

  evaluateMode();
  window.addEventListener("resize", evaluateMode);
  if (mqMobile.addEventListener) {
    mqMobile.addEventListener("change", evaluateMode);
    mqReduced.addEventListener("change", evaluateMode);
  }
})();

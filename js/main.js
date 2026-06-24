/* ===== STRJesse — interactions ===== */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var fmt0 = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var last = { score: 0, net: 0, margin: 0, payback: NaN, coc: 0, scoreColor: "#DE5722" };

  /* =========================================================
   * 1. Deal Analyzer
   * --- Property presets (best estimates; to be tuned later) ---
   *     furnish = one-time setup; fixed = monthly utilities/insurance/
   *     software; clean = net cleaning cost per turnover.
   * =======================================================*/
  var PROPS = {
    apt1:   { label: "1-bed apartment",        furnish: 9000,  fixed: 300, clean: 22 },
    apt2:   { label: "2-bed apartment",        furnish: 13000, fixed: 380, clean: 28 },
    house2: { label: "2-bed house",            furnish: 17000, fixed: 460, clean: 38 },
    house3: { label: "3-bed / 2-bath house",   furnish: 23000, fixed: 560, clean: 48 },
    house4: { label: "4-bed / 3-bath house",   furnish: 31000, fixed: 700, clean: 60 }
  };
  var PLATFORM_RATE = 0.03; // host platform fee, share of gross

  var azState = { prop: "apt2", nights: 2 };

  var azInputs = ["rent", "rate", "occ"].map($);
  var hasAnalyzer = !!azInputs[0];

  // Red → green spectrum: red at/below 50, full green at/above 95.
  var SCORE_STOPS = [
    { s: 50, c: [224, 69, 58] },   // red
    { s: 68, c: [229, 142, 46] },  // orange
    { s: 82, c: [227, 197, 58] },  // yellow-green
    { s: 95, c: [74, 222, 128] }   // green
  ];
  function scoreColor(score) {
    var stops = SCORE_STOPS;
    if (score <= stops[0].s) return rgb(stops[0].c);
    if (score >= stops[stops.length - 1].s) return rgb(stops[stops.length - 1].c);
    for (var i = 0; i < stops.length - 1; i++) {
      var a = stops[i], b = stops[i + 1];
      if (score >= a.s && score <= b.s) {
        var t = (score - a.s) / (b.s - a.s);
        return rgb([
          Math.round(a.c[0] + (b.c[0] - a.c[0]) * t),
          Math.round(a.c[1] + (b.c[1] - a.c[1]) * t),
          Math.round(a.c[2] + (b.c[2] - a.c[2]) * t)
        ]);
      }
    }
    return rgb(stops[0].c);
  }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  function band(score, net) {
    if (net <= 0 || score < 50) return {
      t: "Below breakeven",
      d: "Costs outrun revenue at these numbers. Raise the nightly rate or occupancy, lower the rent, or walk away."
    };
    if (score < 65) return {
      t: "Viable, but low margin",
      d: "It cash-flows, but the cushion is thin. One slow month could erase the profit — tighten the numbers first."
    };
    if (score < 80) return {
      t: "A decent deal",
      d: "The spread covers your costs with a workable margin. Worth a closer underwrite with Jesse."
    };
    if (score < 95) return {
      t: "A very good deal",
      d: "Strong margin and a quick payback. This is the kind of unit the model is built to find."
    };
    return {
      t: "An incredible opportunity",
      d: "Exceptional margin and cash-on-cash. Move fast — deals like this don't sit around."
    };
  }

  function computeScore(margin, coc, net) {
    if (net <= 0) {
      // below breakeven → 0–49, scaled by how close to breakeven
      return Math.max(0, Math.min(49, Math.round(49 + margin)));
    }
    var marginPts = Math.max(0, Math.min(34, (margin / 45) * 30));
    var cocPts    = Math.max(0, Math.min(24, (coc / 160) * 20));
    return Math.max(50, Math.min(100, Math.round(50 + marginPts + cocPts)));
  }

  function calc() {
    var p     = PROPS[azState.prop];
    var rent  = +$("rent").value;
    var rate  = +$("rate").value;
    var occ   = +$("occ").value / 100;
    var nights = azState.nights;

    // live input labels
    $("rent-out").textContent = fmt0(rent);
    $("rate-out").textContent = fmt0(rate);
    $("occ-out").textContent  = $("occ").value + "%";
    $("nights-out").textContent = nights + (nights === 1 ? " night" : " nights");
    $("prop-out").textContent = p.label;
    $("prop-note").textContent = "Furnishing ≈ " + fmt0(p.furnish) + " one-time · fixed ops ≈ " + fmt0(p.fixed) + "/mo";

    var gross      = rate * 30.4 * occ;          // monthly revenue
    var occNights  = 30.4 * occ;
    var turnovers  = nights > 0 ? occNights / nights : 0;
    var cleaning   = turnovers * p.clean;        // more turnovers → more cleaning
    var platform   = gross * PLATFORM_RATE;
    var fixed      = p.fixed;
    var costs      = rent + cleaning + platform + fixed;
    var net        = gross - costs;
    var margin     = gross > 0 ? (net / gross) * 100 : 0;
    var payback    = net > 0 ? p.furnish / net : Infinity;
    var coc        = p.furnish > 0 ? (net * 12 / p.furnish) * 100 : 0;
    var score      = computeScore(margin, coc, net);
    var color      = scoreColor(score);
    var info       = band(score, net);

    // metrics
    $("net").textContent     = fmt0(net);
    $("margin").textContent  = Math.round(margin) + "%";
    $("payback").textContent = net > 0 ? Math.ceil(payback) + " mo" : "—";
    $("coc").textContent     = net > 0 ? Math.round(coc) + "%" : "—";

    // cost summary
    $("gross").textContent = fmt0(gross);
    $("costs").textContent = fmt0(costs);
    $("furn").textContent  = fmt0(p.furnish);

    // score block
    $("score").textContent      = score;
    $("score-band").textContent = info.t;
    $("score-desc").textContent = info.d;
    $("score-bar").style.width  = score + "%";
    var wrap = $("score-wrap");
    wrap.style.setProperty("--score-color", color);

    last = { score: score, net: net, margin: margin, payback: net > 0 ? payback : NaN, coc: coc, scoreColor: color };
  }

  function setActive(container, btn) {
    Array.prototype.forEach.call(container.children, function (c) { c.classList.remove("is-active"); });
    btn.classList.add("is-active");
  }

  if (hasAnalyzer) {
    azInputs.forEach(function (el) { el.addEventListener("input", calc); });

    var propSeg = $("propSeg");
    propSeg.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-prop]");
      if (!btn) return;
      azState.prop = btn.dataset.prop;
      setActive(propSeg, btn);
      calc();
    });

    var nightsSeg = $("nightsSeg");
    nightsSeg.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-n]");
      if (!btn) return;
      azState.nights = +btn.dataset.n;
      setActive(nightsSeg, btn);
      calc();
    });

    calc();
  }

  /* The multi-step booking widget now lives in js/booking-widget.js. */

  /* =========================================================
   * 3. FAQ accordion — smooth height animation (Web Animations API)
   * =======================================================*/
  Array.prototype.forEach.call(document.querySelectorAll(".faq details"), function (d) {
    var summary = d.querySelector("summary");
    var p = d.querySelector("p");
    if (!summary || !p) return;

    // Wrap the answer so we can animate its height without touching padding math.
    var body = document.createElement("div");
    body.className = "faq-body";
    p.parentNode.insertBefore(body, p);
    body.appendChild(p);

    var animating = false;

    summary.addEventListener("click", function (e) {
      e.preventDefault();
      if (animating) return;

      if (reduceMotion) { d.open = !d.open; return; }

      if (d.open) {
        // close: animate current height -> 0, then collapse
        animating = true;
        var start = body.offsetHeight;
        var anim = body.animate(
          [{ height: start + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
          { duration: 240, easing: "cubic-bezier(.4,0,.2,1)" }
        );
        anim.onfinish = function () { d.open = false; animating = false; };
      } else {
        // open: reveal, measure, animate 0 -> full height
        d.open = true;
        animating = true;
        var end = body.offsetHeight;
        var anim2 = body.animate(
          [{ height: "0px", opacity: 0 }, { height: end + "px", opacity: 1 }],
          { duration: 280, easing: "cubic-bezier(.22,.61,.36,1)" }
        );
        anim2.onfinish = function () { animating = false; };
      }
    });
  });

  /* =========================================================
   * 4. Reveal on scroll — quiet, staggered within each group
   * =======================================================*/
  var els = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    els.forEach(function (e) { e.classList.add("in"); });
  } else {
    // stagger: delay by position among reveal siblings (capped)
    els.forEach(function (e) {
      var sibs = Array.prototype.filter.call(e.parentNode.children, function (c) {
        return c.classList && c.classList.contains("reveal");
      });
      var i = sibs.indexOf(e);
      e.style.transitionDelay = Math.min(i * 70, 210) + "ms";
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* =========================================================
   * 5. Analyzer count-up (first time it scrolls into view)
   * =======================================================*/
  function countUp(el, target, fmt) {
    if (!el) return;
    if (reduceMotion || !isFinite(target)) {
      el.textContent = isFinite(target) ? fmt(target) : "—";
      return;
    }
    var startT = performance.now(), dur = 900;
    (function frame(now) {
      var p = Math.min((now - startT) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(frame);
    })(startT);
  }

  function animateAnalyzer() {
    countUp($("score"), last.score, function (v) { return Math.round(v); });
    countUp($("net"), last.net, function (v) { return fmt0(v); });
    countUp($("margin"), last.margin, function (v) { return Math.round(v) + "%"; });
    countUp($("payback"), last.payback, function (v) { return Math.ceil(v) + " mo"; });
    countUp($("coc"), last.coc, function (v) { return Math.round(v) + "%"; });
    var w = Math.max(0, Math.min(100, last.score));
    var bar = $("score-bar");
    if (bar && !reduceMotion) {
      bar.style.width = "0%";
      requestAnimationFrame(function () { bar.style.width = w + "%"; });
    }
  }

  var azSection = $("analyzer");
  if (azSection && !reduceMotion && "IntersectionObserver" in window) {
    var azIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateAnalyzer(); azIo.unobserve(en.target); }
      });
    }, { threshold: 0.3 });
    azIo.observe(azSection);
  }

  /* =========================================================
   * 6. Header condense on scroll + scrollspy active nav
   * =======================================================*/
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 10) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  var linkFor = {};
  navLinks.forEach(function (a) {
    var id = a.getAttribute("href").replace("#", "");
    if (document.getElementById(id)) linkFor[id] = a;
  });
  var spySecs = Object.keys(linkFor).map(function (id) { return document.getElementById(id); });
  if (spySecs.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.remove("is-current"); });
          if (linkFor[en.target.id]) linkFor[en.target.id].classList.add("is-current");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    spySecs.forEach(function (s) { spy.observe(s); });
  }

  /* Footer year */
  var y = $("year");
  if (y) { y.textContent = new Date().getFullYear(); }
})();

/* ===== Elevation pass (coaching website 3): scroll progress + magnetic buttons ===== */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // scroll progress bar
  var bar = document.getElementById("scrollProgress");
  if (bar && !reduce) {
    var tick = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? h.scrollTop / max : 0;
      bar.style.transform = "scaleX(" + p + ")";
    };
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    tick();
  }

  // magnetic primary buttons (desktop pointers only)
  var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  if (fine && !reduce) {
    var mags = document.querySelectorAll(".btn--accent.btn--lg, .nav-cta");
    Array.prototype.forEach.call(mags, function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        var dy = (e.clientY - (r.top + r.height / 2)) * 0.30;
        b.style.transform = "translate(" + dx + "px," + dy + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }
})();

/* ===== Grid-break + micro-detail pass: cursor-reactive hero glow
 *       + ghost section-numeral scroll drift ===== */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  // cursor-reactive hero glow (desktop pointers only)
  var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var hero = document.querySelector(".hero");
  if (hero && fine) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 100;
      var y = ((e.clientY - r.top) / r.height) * 100;
      hero.style.setProperty("--mx", x.toFixed(1) + "%");
      hero.style.setProperty("--my", y.toFixed(1) + "%");
    });
    hero.addEventListener("pointerleave", function () {
      hero.style.setProperty("--mx", "50%");
      hero.style.setProperty("--my", "30%");
    });
  }

  // ghost section numerals drift gently as they pass through the viewport
  var nums = Array.prototype.slice.call(document.querySelectorAll(".sec-no"));
  if (nums.length && "IntersectionObserver" in window) {
    var active = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { if (active.indexOf(en.target) < 0) active.push(en.target); }
        else {
          var i = active.indexOf(en.target);
          if (i > -1) active.splice(i, 1);
          en.target.style.transform = "";
        }
      });
    }, { threshold: 0 });
    nums.forEach(function (n) { io.observe(n); });

    var ticking = false;
    var update = function () {
      var vh = window.innerHeight;
      active.forEach(function (n) {
        var r = n.getBoundingClientRect();
        // -1 (entering bottom) .. 1 (leaving top)
        var p = 1 - (r.top + r.height / 2) / (vh / 2);
        n.style.transform = "translateY(" + (p * -14).toFixed(1) + "px)";
      });
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
})();

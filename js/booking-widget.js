/* =====================================================================
   Book-a-session widget — static front-end, no backend.
   State lives in JS; calendar + slots render from it. The real
   Stripe + Google Calendar flow plugs into the BACKEND HOOK in the
   step-3 submit handler.
   ===================================================================== */
(function () {
  "use strict";

  var widgetRoot = document.getElementById("widget");
  if (!widgetRoot) return; // page has no booking widget

  var $ = function (id) { return document.getElementById(id); };

  // ---- Config (one place to retune) ----
  var PRICE_LABEL = "$250";
  var TIME_SLOTS = ["9:00 AM", "11:00 AM", "1:30 PM", "4:00 PM", "6:30 PM"];
  var DOW = ["S", "M", "T", "W", "T", "F", "S"];

  // ---- State ----
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var state = {
    date: null,                                   // Date of chosen day
    time: null,                                   // string slot
    view: new Date(today.getFullYear(), today.getMonth(), 1) // month being viewed
  };

  // ---------------------------------------------------------------
  // Step navigation + progress
  // ---------------------------------------------------------------
  function goToStep(n) {
    for (var s = 1; s <= 4; s++) {
      $("step-" + s).classList.toggle("is-active", s === n);
    }
    var segs = $("progress").children;
    for (var i = 0; i < segs.length; i++) {
      segs[i].classList.toggle("on", i < n); // light segments 1..n
    }
  }

  // ---------------------------------------------------------------
  // STEP 1 — Calendar
  // ---------------------------------------------------------------
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isCurrentMonthView() {
    return state.view.getFullYear() === today.getFullYear() &&
      state.view.getMonth() === today.getMonth();
  }

  function renderCalendar() {
    var y = state.view.getFullYear();
    var m = state.view.getMonth();
    $("calTitle").textContent = MONTHS[m] + " " + y;
    $("prevMonth").disabled = isCurrentMonthView(); // can't go before this month

    var grid = $("calGrid");
    grid.innerHTML = "";

    DOW.forEach(function (d) {
      var el = document.createElement("div");
      el.className = "cal__dow";
      el.textContent = d;
      grid.appendChild(el);
    });

    var firstDow = new Date(y, m, 1).getDay();        // 0 = Sunday
    var daysInMonth = new Date(y, m + 1, 0).getDate();

    for (var b = 0; b < firstDow; b++) {
      var blank = document.createElement("div");
      blank.className = "cal__day is-blank";
      grid.appendChild(blank);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var date = new Date(y, m, day);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal__day";
      btn.textContent = day;
      btn.setAttribute("role", "gridcell");

      var isPast = date < today;
      var isSunday = date.getDay() === 0;

      if (isPast || isSunday) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      } else {
        if (sameDay(date, state.date)) btn.classList.add("is-selected");
        btn.setAttribute("aria-label", MONTHS[m] + " " + day + ", " + y);
        (function (d) {
          btn.addEventListener("click", function () { selectDate(d); });
        })(date);
      }
      grid.appendChild(btn);
    }
  }

  function selectDate(date) {
    state.date = date;
    state.time = null;
    renderTimeStep();
    goToStep(2);            // lights progress segment 2
  }

  $("prevMonth").addEventListener("click", function () {
    if (isCurrentMonthView()) return;
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1);
    renderCalendar();
  });
  $("nextMonth").addEventListener("click", function () {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1);
    renderCalendar();
  });

  // ---------------------------------------------------------------
  // STEP 2 — Times
  // ---------------------------------------------------------------
  function fmtLong(date) {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  function renderTimeStep() {
    $("timeSub").textContent = fmtLong(state.date);
    var wrap = $("slots");
    wrap.innerHTML = "";
    TIME_SLOTS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slot" + (t === state.time ? " is-selected" : "");
      b.textContent = t;
      b.addEventListener("click", function () { selectTime(t); });
      wrap.appendChild(b);
    });
  }

  function selectTime(t) {
    state.time = t;
    renderTimeStep();
    renderSummary();
    goToStep(3);
  }

  $("backToDates").addEventListener("click", function () { goToStep(1); });

  // ---------------------------------------------------------------
  // STEP 3 — Details
  // ---------------------------------------------------------------
  function renderSummary() {
    $("sumDate").textContent = fmtLong(state.date);
    $("sumTime").textContent = state.time || "—";
  }

  $("backToTimes").addEventListener("click", function () { goToStep(2); });

  $("detailsForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!this.checkValidity()) { this.reportValidity(); return; }

    var data = {
      name:  $("name").value.trim(),
      email: $("email").value.trim(),
      goal:  $("goal").value.trim(),
      date:  state.date,                            // Date object
      time:  state.time,                            // string
      price: PRICE_LABEL
    };

    /* =================================================================
       BACKEND HOOK — real Stripe + Google Calendar flow goes here.
       This static demo just simulates success (step 4). To go live:

         1. POST `data` to your server endpoint.
              fetch("/api/book", { method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data) })

         2. Server creates a Stripe Checkout Session (amount configurable)
            AND places a tentative Google Calendar hold for date + time.

         3. Server responds with the Stripe-hosted checkout URL; redirect:
              window.location.href = session.url;

         4. On the Stripe `checkout.session.completed` webhook, the server
            confirms the Google Calendar event and emails the invite.

       Until then, we just advance to the confirmation step.
       ================================================================= */

    showConfirmation(data);
  });

  // ---------------------------------------------------------------
  // STEP 4 — Confirmation
  // ---------------------------------------------------------------
  function showConfirmation(data) {
    var when = fmtLong(data.date);
    $("confirmText").innerHTML =
      "Your session is reserved for <span class=\"hl\">" + when +
      "</span> at <span class=\"hl\">" + data.time +
      "</span>. A confirmation and calendar invite are on the way to <span class=\"hl\">" +
      escapeHtml(data.email) + "</span>.";
    goToStep(4);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- Init ----
  renderCalendar();
  goToStep(1);
})();

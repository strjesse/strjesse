/* =====================================================================
   Book-a-session widget — now backed by serverless functions.
     • Step 2 slot times come from GET /api/availability (real calendar).
     • Step 3 submit creates a Stripe Checkout session via
       POST /api/create-checkout, then redirects to Stripe.
     • On return, ?booking=success shows the confirmation step.

   Falls back to a self-contained DEMO (no network) when the API is
   unreachable — so the page still works opened as a static file.
   ===================================================================== */
(function () {
  "use strict";

  var widgetRoot = document.getElementById("widget");
  if (!widgetRoot) return; // page has no booking widget

  var $ = function (id) { return document.getElementById(id); };

  // ---- Config ----
  var PRICE_LABEL = "$597 AUD";
  // Fallback slots used only if the availability API can't be reached.
  var FALLBACK_SLOTS = ["10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM"];
  var OPEN_DOW = [2, 3, 4, 6]; // bookable days: Tue, Wed, Thu, Sat
  var DOW = ["S", "M", "T", "W", "T", "F", "S"];

  // ---- State ----
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var state = {
    date: null,
    time: null,
    view: new Date(today.getFullYear(), today.getMonth(), 1)
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
      segs[i].classList.toggle("on", i < n);
    }
  }

  // ---------------------------------------------------------------
  // STEP 1 — Calendar
  // ---------------------------------------------------------------
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function isoDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

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
    $("prevMonth").disabled = isCurrentMonthView();

    var grid = $("calGrid");
    grid.innerHTML = "";

    DOW.forEach(function (d) {
      var el = document.createElement("div");
      el.className = "cal__dow";
      el.textContent = d;
      grid.appendChild(el);
    });

    var firstDow = new Date(y, m, 1).getDay();
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
      var isClosed = OPEN_DOW.indexOf(date.getDay()) === -1;

      if (isPast || isClosed) {
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
    goToStep(2);
    renderTimeStep();
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
  // STEP 2 — Times (loaded from the availability API)
  // ---------------------------------------------------------------
  function fmtLong(date) {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  function renderSlots(slots) {
    var wrap = $("slots");
    wrap.innerHTML = "";

    if (!slots || !slots.length) {
      var none = document.createElement("p");
      none.className = "slots-empty";
      none.textContent = "No times left on this day — try another date.";
      wrap.appendChild(none);
      return;
    }

    slots.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slot" + (t === state.time ? " is-selected" : "");
      b.textContent = t;
      b.addEventListener("click", function () { selectTime(t); });
      wrap.appendChild(b);
    });
  }

  function renderTimeStep() {
    $("timeSub").textContent = fmtLong(state.date);
    var wrap = $("slots");
    wrap.innerHTML = '<p class="slots-empty">Checking availability…</p>';

    fetch("/api/availability?date=" + isoDate(state.date), { headers: { "Accept": "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function (data) { renderSlots(data.slots); })
      .catch(function () { renderSlots(FALLBACK_SLOTS); }); // offline/static fallback
  }

  function selectTime(t) {
    state.time = t;
    renderSummary();
    goToStep(3);
  }

  $("backToDates").addEventListener("click", function () { goToStep(1); });

  // ---------------------------------------------------------------
  // STEP 3 — Details → Stripe Checkout
  // ---------------------------------------------------------------
  function renderSummary() {
    $("sumDate").textContent = fmtLong(state.date);
    $("sumTime").textContent = state.time || "—";
  }

  $("backToTimes").addEventListener("click", function () { goToStep(2); });

  var submitBtn = null;
  function setSubmitting(form, on) {
    if (!submitBtn) submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    submitBtn.disabled = on;
    if (on) {
      submitBtn.dataset.label = submitBtn.textContent;
      submitBtn.textContent = "Redirecting to secure checkout…";
    } else if (submitBtn.dataset.label) {
      submitBtn.textContent = submitBtn.dataset.label;
    }
  }

  function showError(form, msg) {
    var box = form.querySelector(".form-error");
    if (!box) {
      box = document.createElement("p");
      box.className = "form-error";
      form.insertBefore(box, form.firstChild);
    }
    box.textContent = msg;
  }

  $("detailsForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!this.checkValidity()) { this.reportValidity(); return; }
    var form = this;

    var data = {
      name:  $("name").value.trim(),
      email: $("email").value.trim(),
      goal:  $("goal").value.trim(),
      date:  isoDate(state.date),   // YYYY-MM-DD
      time:  state.time             // "9:00 AM"
    };

    setSubmitting(form, true);
    showError(form, "");

    fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (r) {
        // No backend deployed (static host) → demo confirmation.
        if (r.status === 404) { showConfirmation(data, true); return null; }
        return r.text().then(function (text) {
          var body = null;
          try { body = JSON.parse(text); } catch (e) { /* non-JSON */ }
          return { ok: r.ok, body: body };
        });
      })
      .then(function (res) {
        if (!res) return; // handled above
        if (res.ok && res.body && res.body.url) {
          window.location.href = res.body.url; // → Stripe Checkout
          return;
        }
        throw new Error((res.body && res.body.error) || "Could not start checkout. Please try again.");
      })
      .catch(function (err) {
        // Network failure (e.g. opened as a static file) → demo confirmation.
        if (err && err.message === "Failed to fetch") {
          showConfirmation(data, true);
        } else {
          setSubmitting(form, false);
          showError(form, err.message || "Something went wrong. Please try again.");
        }
      });
  });

  // ---------------------------------------------------------------
  // STEP 4 — Confirmation
  // ---------------------------------------------------------------
  function showConfirmation(data, demo) {
    var when = data && data.date ? fmtLong(parseISO(data.date)) : "your selected day";
    var time = (data && data.time) || "your selected time";
    var email = (data && data.email) || "your email";
    $("confirmText").innerHTML =
      "Your session is booked for <span class=\"hl\">" + when +
      "</span> at <span class=\"hl\">" + time +
      "</span>. A calendar invite and confirmation are on the way to <span class=\"hl\">" +
      escapeHtml(email) + "</span>.";
    var demoNote = document.querySelector(".confirm__demo");
    if (demoNote) demoNote.style.display = demo ? "" : "none";
    goToStep(4);
  }

  function showSuccessFromRedirect() {
    // Returned from Stripe after a successful payment.
    $("confirmText").innerHTML =
      "Payment received — your session is booked. A calendar invite and " +
      "confirmation are on the way to your email.";
    var demoNote = document.querySelector(".confirm__demo");
    if (demoNote) demoNote.style.display = "none";
    goToStep(4);
  }

  function parseISO(s) {
    var p = String(s).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- Init ----
  renderCalendar();

  var params = new URLSearchParams(window.location.search);
  if (params.get("booking") === "success") {
    showSuccessFromRedirect();
    history.replaceState(null, "", window.location.pathname + "#book");
  } else {
    goToStep(1);
    if (params.get("booking") === "cancelled") {
      history.replaceState(null, "", window.location.pathname + "#book");
    }
  }
})();

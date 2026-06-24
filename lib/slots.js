/* =====================================================================
   Slot configuration + timezone-correct interval math.
   One place to define the bookable times. The labels here MUST match
   the labels the front-end shows (js/booking-widget.js renders whatever
   /api/availability returns, so this is the single source of truth).
   ===================================================================== */
const { DateTime } = require("luxon");

// Bookable start times each day, as human labels. Edit freely.
const SLOTS = ["9:00 AM", "11:00 AM", "1:30 PM", "4:00 PM", "6:30 PM"];

// Session length in minutes (used to compute the calendar event end).
const SESSION_MINUTES = parseInt(process.env.SESSION_MINUTES || "90", 10);

// The timezone the above labels are expressed in (Jesse's working tz).
// e.g. "America/New_York", "Australia/Sydney", "Europe/London".
const TZ = process.env.BUSINESS_TIMEZONE || "America/New_York";

// Days of week that are NOT bookable (0 = Sunday ... 6 = Saturday).
// Sundays off by default, matching the calendar UI.
const CLOSED_DOW = (process.env.CLOSED_DOW || "0")
  .split(",")
  .map(function (s) { return parseInt(s.trim(), 10); })
  .filter(function (n) { return !isNaN(n); });

function parseLabel(label) {
  var m = String(label).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error("Bad slot label: " + label);
  var hour = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) hour += 12;
  return { hour: hour, minute: parseInt(m[2], 10) };
}

// Given a calendar date "YYYY-MM-DD" and a slot label, return the
// UTC start/end ISO strings for that session (DST-correct via Luxon).
function slotToInterval(dateStr, label) {
  var t = parseLabel(label);
  var start = DateTime.fromISO(dateStr, { zone: TZ }).set({
    hour: t.hour, minute: t.minute, second: 0, millisecond: 0
  });
  var end = start.plus({ minutes: SESSION_MINUTES });
  return {
    label: label,
    startUTC: start.toUTC().toISO(),
    endUTC: end.toUTC().toISO(),
    weekday: start.weekday % 7 // Luxon: 1=Mon..7=Sun -> 0=Sun..6=Sat
  };
}

module.exports = { SLOTS, SESSION_MINUTES, TZ, CLOSED_DOW, parseLabel, slotToInterval };

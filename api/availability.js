/* =====================================================================
   GET /api/availability?date=YYYY-MM-DD
   Returns the open slots for that day: the configured SLOTS minus any
   that collide with a busy block on Jesse's calendar, minus past times.

   Response: { date, slots: ["9:00 AM", ...] }
   ===================================================================== */
const { SLOTS, CLOSED_DOW, slotToInterval } = require("../lib/slots");
const { calendarConfigured, getBusy } = require("../lib/google");

module.exports = async function (req, res) {
  try {
    var date = (req.query && req.query.date) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Provide ?date=YYYY-MM-DD" });
    }

    // Build each slot's UTC interval.
    var intervals = SLOTS.map(function (label) { return slotToInterval(date, label); });

    // Closed weekday? No slots.
    if (intervals.length && CLOSED_DOW.indexOf(intervals[0].weekday) !== -1) {
      return res.json({ date: date, slots: [] });
    }

    var now = Date.now();
    var windowStart = intervals[0].startUTC;
    var windowEnd = intervals[intervals.length - 1].endUTC;

    var busy = [];
    if (calendarConfigured()) {
      busy = await getBusy(windowStart, windowEnd);
    }

    var open = intervals.filter(function (iv) {
      var s = new Date(iv.startUTC).getTime();
      var e = new Date(iv.endUTC).getTime();
      if (s < now) return false; // past
      return !busy.some(function (b) {
        var bs = new Date(b.start).getTime();
        var be = new Date(b.end).getTime();
        return s < be && e > bs; // overlap
      });
    }).map(function (iv) { return iv.label; });

    res.json({ date: date, slots: open });
  } catch (err) {
    console.error("availability error:", err);
    res.status(500).json({ error: "Could not load availability" });
  }
};

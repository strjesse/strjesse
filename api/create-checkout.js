/* =====================================================================
   POST /api/create-checkout
   Body: { name, email, goal, date: "YYYY-MM-DD", time: "9:00 AM" }

   Re-checks the slot is still free, then creates a Stripe Checkout
   Session carrying the booking details in metadata. Returns { url } —
   the front-end redirects the browser there. The calendar event is NOT
   created here; it's created by the webhook once payment succeeds.
   ===================================================================== */
const Stripe = require("stripe");
const { SLOTS, slotToInterval } = require("../lib/slots");
const { calendarConfigured, getBusy } = require("../lib/google");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

module.exports = async function (req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    var body = req.body || {};
    var name = (body.name || "").toString().slice(0, 120);
    var email = (body.email || "").toString().trim().slice(0, 200);
    var goal = (body.goal || "").toString().slice(0, 1000);
    var date = (body.date || "").toString();
    var time = (body.time || "").toString();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || SLOTS.indexOf(time) === -1) {
      return res.status(400).json({ error: "Invalid date or time" });
    }

    var iv = slotToInterval(date, time);
    if (new Date(iv.startUTC).getTime() < Date.now()) {
      return res.status(400).json({ error: "That time has passed" });
    }

    // Last-moment double-booking guard.
    if (calendarConfigured()) {
      var busy = await getBusy(iv.startUTC, iv.endUTC);
      var s = new Date(iv.startUTC).getTime();
      var e = new Date(iv.endUTC).getTime();
      var conflict = busy.some(function (b) {
        return s < new Date(b.end).getTime() && e > new Date(b.start).getTime();
      });
      if (conflict) return res.status(409).json({ error: "That time was just booked — please pick another." });
    }

    var origin = req.headers.origin || ("https://" + req.headers.host);

    var session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: process.env.CURRENCY || "usd",
          unit_amount: parseInt(process.env.PRICE_CENTS || "25000", 10),
          product_data: {
            name: "90-minute 1-on-1 session with Jesse",
            description: "Rental arbitrage mentoring — " + date + " at " + time
          }
        }
      }],
      metadata: {
        name: name, email: email, goal: goal,
        date: date, time: time,
        startUTC: iv.startUTC, endUTC: iv.endUTC
      },
      success_url: origin + "/?booking=success&session_id={CHECKOUT_SESSION_ID}#book",
      cancel_url: origin + "/?booking=cancelled#book"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("create-checkout error:", err);
    res.status(500).json({ error: "Could not start checkout" });
  }
};

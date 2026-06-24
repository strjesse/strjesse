/* =====================================================================
   POST /api/webhook  — Stripe webhook receiver.
   On `checkout.session.completed` (payment succeeded), creates the
   confirmed Google Calendar event and invites the client.

   IMPORTANT: Stripe signature verification needs the RAW request body,
   so the default body parser is disabled (see config export below).

   Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
   Optional env: MEETING_URL (your permanent Zoom/Meet room link)
   ===================================================================== */
const Stripe = require("stripe");
const { createEvent, calendarConfigured } = require("../lib/google");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) { chunks.push(c); });
    req.on("end", function () { resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

module.exports = async function (req, res) {
  if (req.method !== "POST") return res.status(405).end();

  var event;
  try {
    var raw = await readRawBody(req);
    var sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send("Webhook Error: " + err.message);
  }

  if (event.type === "checkout.session.completed") {
    var md = (event.data.object && event.data.object.metadata) || {};
    var meet = process.env.MEETING_URL || "";
    try {
      if (calendarConfigured() && md.startUTC && md.endUTC) {
        await createEvent({
          summary: "STR session — " + (md.name || md.email || "Client"),
          description:
            "90-minute 1-on-1 rental arbitrage session.\n\n" +
            "Client: " + (md.name || "") + "\n" +
            "Email: " + (md.email || "") + "\n" +
            "Goals: " + (md.goal || "(none provided)") + "\n\n" +
            (meet ? "Join: " + meet : "Add the meeting link to this event."),
          location: meet,
          start: { dateTime: md.startUTC, timeZone: "UTC" },
          end: { dateTime: md.endUTC, timeZone: "UTC" },
          attendees: md.email ? [{ email: md.email, displayName: md.name || undefined }] : [],
          reminders: { useDefault: true }
        });
      } else {
        console.warn("Calendar not configured or missing times; skipped event creation.");
      }
    } catch (err) {
      // Don't fail the webhook (Stripe would retry). Log so you can recover.
      console.error("Calendar event creation failed:", err);
    }
  }

  res.json({ received: true });
};

// Vercel: hand us the raw body so Stripe signature checks pass.
module.exports.config = { api: { bodyParser: false } };

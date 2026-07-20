/* =====================================================================
   POST /api/waitlist
   Body: { email }
   Emails the business that someone joined the waitlist. Returns { ok: true }.
   Requires the Gmail sender to be configured (Workspace + gmail.send);
   otherwise responds 503 and the front-end falls back to a mailto link.
   ===================================================================== */
const { emailConfigured, sendWaitlist } = require("../lib/email");

module.exports = async function (req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    var body = req.body || {};
    var email = (body.email || "").toString().trim().slice(0, 200);

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    if (!emailConfigured()) {
      return res.status(503).json({ error: "Waitlist temporarily unavailable" });
    }

    await sendWaitlist(email);
    res.json({ ok: true });
  } catch (err) {
    console.error("waitlist error:", err);
    res.status(500).json({ error: "Could not join the waitlist" });
  }
};

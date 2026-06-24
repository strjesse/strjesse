/* =====================================================================
   Branded confirmation email, sent via the Gmail API as the Workspace
   user (same service-account impersonation as the calendar). Requires
   the gmail.send scope to be authorised in domain-wide delegation.

   Uses its own auth client (gmail.send scope only) so that if the Gmail
   scope isn't authorised, calendar booking still works.
   ===================================================================== */
const { google } = require("googleapis");
const { DateTime } = require("luxon");

function gmailClient() {
  var auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: process.env.GOOGLE_IMPERSONATE_SUBJECT || undefined
  });
  return google.gmail({ version: "v1", auth: auth });
}

// Email can only be sent as a Workspace user (needs impersonation).
function emailConfigured() {
  return !!(process.env.GOOGLE_CLIENT_EMAIL &&
            process.env.GOOGLE_PRIVATE_KEY &&
            process.env.GOOGLE_IMPERSONATE_SUBJECT);
}

function fmtWhen(startUTC) {
  var tz = process.env.BUSINESS_TIMEZONE || "UTC";
  return DateTime.fromISO(startUTC, { zone: "utc" }).setZone(tz)
    .toFormat("cccc, LLLL d, yyyy 'at' h:mm a") + " (" + tz + ")";
}

function esc(s) {
  return String(s || "").replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function buildConfirmation(opts) {
  var first = esc((opts.name || "there").split(" ")[0]);
  var dur = opts.durationMin || 90;
  var when = fmtWhen(opts.startUTC);
  var meet = opts.meetLink || "";
  var subject = "STRJesse Mentoring Session Confirmation";

  var steps = [
    ["Add the invite", "The Google Calendar invite is already in your inbox — accept it so you get a reminder."],
    ["Come prepared", "Jot down your market, rough budget, and what you want out of the session."],
    ["Bring questions", "The more specific your questions, the more you'll get out of the 90 minutes."]
  ];

  var text =
    "Hi " + first + ",\n\n" +
    "You're booked — your " + dur + "-minute 1-on-1 with Jesse is confirmed.\n\n" +
    "When: " + when + "\n" +
    "Join: " + (meet || "(link is on your calendar invite)") + "\n\n" +
    "Before the call:\n" +
    "1. Add the calendar invite (already in your inbox) so you get a reminder.\n" +
    "2. Jot down your market, rough budget, and what you want out of the session.\n" +
    "3. Bring specific questions — the more specific, the more you'll get out of it.\n\n" +
    "Join at the time using the Google Meet link above (also on the calendar event).\n\n" +
    "Need to reschedule? Just reply to this email.\n\n" +
    "See you soon,\nJesse · STRJesse";

  var stepRows = steps.map(function (s, i) {
    return '' +
      '<tr><td style="padding:0 0 14px;" valign="top">' +
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
          '<td valign="top" style="width:28px;">' +
            '<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:#FBEDE6;color:#B5400F;border-radius:50%;font-weight:bold;font-size:13px;">' + (i + 1) + '</span>' +
          '</td>' +
          '<td style="padding-left:12px;">' +
            '<p style="margin:0 0 2px;font-size:15px;font-weight:bold;color:#18181B;">' + esc(s[0]) + '</p>' +
            '<p style="margin:0;font-size:14px;line-height:1.5;color:#6B6B70;">' + esc(s[1]) + '</p>' +
          '</td>' +
        '</tr></table>' +
      '</td></tr>';
  }).join("");

  var joinBtn = meet
    ? '<a href="' + esc(meet) + '" style="display:inline-block;background:#B5400F;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 26px;border-radius:10px;">Join the Google Meet</a>' +
      '<p style="margin:10px 0 0;font-size:13px;color:#6B6B70;">The same link is on your calendar invite.</p>'
    : '<p style="margin:0;font-size:14px;color:#6B6B70;">Your Google Meet link is on the calendar invite in your inbox.</p>';

  var html =
'<!doctype html><html><body style="margin:0;padding:0;background:#FBFAF8;">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBFAF8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">' +
'<tr><td align="center">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E7E5E0;border-radius:16px;overflow:hidden;">' +
    '<tr><td style="background:#18181B;padding:18px 28px;">' +
      '<span style="color:#FBFAF8;font-size:18px;font-weight:bold;letter-spacing:-.5px;">STRJesse<span style="color:#DE5722;">.</span></span>' +
    '</td></tr>' +
    '<tr><td style="padding:30px 28px 6px;">' +
      '<p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#B5400F;font-weight:bold;">Booking confirmed</p>' +
      '<h1 style="margin:0 0 12px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.2;color:#18181B;">You\'re booked, ' + first + '.</h1>' +
      '<p style="margin:0;font-size:15px;line-height:1.6;color:#6B6B70;">Your ' + dur + '-minute 1-on-1 with Jesse is locked in. Here\'s everything you need.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:20px 28px 0;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBEDE6;border-radius:12px;"><tr><td style="padding:16px 18px;">' +
        '<p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6B6B70;">When</p>' +
        '<p style="margin:0;font-size:16px;font-weight:bold;color:#18181B;">' + esc(when) + '</p>' +
      '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:22px 28px 4px;">' + joinBtn + '</td></tr>' +
    '<tr><td style="padding:26px 28px 6px;"><p style="margin:0 0 14px;font-weight:bold;font-size:15px;color:#18181B;">Before the call</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + stepRows + '</table>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 28px 32px;"><p style="margin:0;font-size:14px;line-height:1.6;color:#6B6B70;">Need to reschedule? Just reply to this email. See you soon — <strong style="color:#18181B;">Jesse</strong>.</p></td></tr>' +
  '</table>' +
  '<p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#9a9a9e;font-family:Arial,Helvetica,sans-serif;">STRJesse · 1-on-1 rental arbitrage mentoring</p>' +
'</td></tr></table></body></html>';

  return { subject: subject, text: text, html: html };
}

function b64url(str) {
  return Buffer.from(str, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendConfirmation(opts) {
  var from = process.env.GOOGLE_IMPERSONATE_SUBJECT;
  var built = buildConfirmation(opts);
  var boundary = "b_" + Date.now().toString(36);

  var lines = [
    "From: STRJesse <" + from + ">",
    "To: " + opts.email,
    process.env.BOOKING_BCC ? "Bcc: " + process.env.BOOKING_BCC : null,
    "Subject: " + built.subject,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    "",
    "--" + boundary,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    built.text,
    "--" + boundary,
    "Content-Type: text/html; charset=UTF-8",
    "",
    built.html,
    "--" + boundary + "--",
    ""
  ].filter(function (l) { return l !== null; });

  var gmail = gmailClient();
  return gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: b64url(lines.join("\r\n")) }
  });
}

module.exports = { emailConfigured, buildConfirmation, sendConfirmation };

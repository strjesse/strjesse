/* =====================================================================
   Google Calendar client (service-account auth).

   Auth model: a Google Cloud *service account* with the Calendar API
   enabled. You then SHARE Jesse's calendar with the service account's
   email ("Make changes to events"). The backend acts as that account.

   Required env:
     GOOGLE_CLIENT_EMAIL   service-account email (…@….iam.gserviceaccount.com)
     GOOGLE_PRIVATE_KEY    the private key from the JSON key file
                           (paste it with literal \n for newlines)
     GOOGLE_CALENDAR_ID    usually Jesse's gmail address, or a calendar id
   ===================================================================== */
const { google } = require("googleapis");

function getCalendar() {
  var auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"]
  });
  return google.calendar({ version: "v3", auth: auth });
}

function calendarConfigured() {
  return !!(process.env.GOOGLE_CLIENT_EMAIL &&
            process.env.GOOGLE_PRIVATE_KEY &&
            process.env.GOOGLE_CALENDAR_ID);
}

// Busy intervals on the calendar between two ISO timestamps.
async function getBusy(timeMinISO, timeMaxISO) {
  var cal = getCalendar();
  var calId = process.env.GOOGLE_CALENDAR_ID;
  var r = await cal.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: [{ id: calId }]
    }
  });
  return (r.data.calendars && r.data.calendars[calId] && r.data.calendars[calId].busy) || [];
}

// Create the confirmed session event (and invite the client).
async function createEvent(eventBody) {
  var cal = getCalendar();
  return cal.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    sendUpdates: "all",
    requestBody: eventBody
  });
}

module.exports = { getCalendar, calendarConfigured, getBusy, createEvent };

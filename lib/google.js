/* =====================================================================
   Google Calendar client (service account).

   Two supported modes:

   A) Google Workspace + domain-wide delegation (RECOMMENDED — auto Meet):
      The service account impersonates a Workspace user
      (GOOGLE_IMPERSONATE_SUBJECT), so it can create events AND attach a
      fresh Google Meet link to each one. No manual calendar sharing.

   B) Plain Gmail (no Workspace): share your calendar with the service
      account email ("Make changes to events"). Events are created, but a
      Meet link can't be auto-generated — set MEETING_URL to a fixed room.

   Required env:
     GOOGLE_CLIENT_EMAIL        service-account email
     GOOGLE_PRIVATE_KEY         private key from the JSON key file (\n ok)
     GOOGLE_CALENDAR_ID         calendar to book into (the Workspace user's
                                email, or a calendar id)
   Mode-A only:
     GOOGLE_IMPERSONATE_SUBJECT the Workspace user to act as (e.g. you@firm.com)
   ===================================================================== */
const { google } = require("googleapis");

function workspaceMode() {
  return !!process.env.GOOGLE_IMPERSONATE_SUBJECT;
}

function getCalendar() {
  var auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
    // Domain-wide delegation: act as this Workspace user (enables Meet).
    subject: process.env.GOOGLE_IMPERSONATE_SUBJECT || undefined
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

// Create the confirmed session event, invite the client, and (in
// Workspace mode) attach a fresh Google Meet link. Returns the event.
async function createEvent(eventBody) {
  var cal = getCalendar();
  var wantMeet = workspaceMode();

  if (wantMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: "strj-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        conferenceSolutionKey: { type: "hangoutsMeet" }
      }
    };
  }

  var r = await cal.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    sendUpdates: "all",
    conferenceDataVersion: wantMeet ? 1 : 0,
    requestBody: eventBody
  });
  return r.data;
}

module.exports = { getCalendar, calendarConfigured, workspaceMode, getBusy, createEvent };

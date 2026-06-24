# STRJesse — booking backend setup

The site is static **plus** three serverless functions (in `/api`) that power
real booking:

| Endpoint | Does |
|---|---|
| `GET /api/availability?date=YYYY-MM-DD` | Returns open slots (calendar free/busy minus past times). |
| `POST /api/create-checkout` | Creates a Stripe Checkout session for the chosen slot, returns its URL. |
| `POST /api/webhook` | After Stripe confirms payment, creates the calendar event + invites the client. |

Everything runs on **Vercel** (free tier). Follow the steps in order. You can do
1–2 first to get the site live, then 3–4 to make payments + calendar real.

---

## 1. Put the site on Vercel

1. Go to **https://vercel.com** → sign up with your **GitHub** account.
2. **Add New… → Project** → import the `strjesse/strjesse` repo.
3. Framework preset: **Other**. Root directory: `./`. Leave build settings empty
   (it's a static site; Vercel auto-detects the `/api` functions).
4. Click **Deploy**. In ~30s you get a live URL like `strjesse.vercel.app`.

> From now on, every `git push` to `main` auto-deploys. (I can push for you.)

---

## 2. Add environment variables

In Vercel: **Project → Settings → Environment Variables**. Add each variable from
`.env.example`. Use **Stripe TEST keys** for now. Set them for **Production,
Preview, and Development**. Re-deploy after adding them (Deployments → ⋯ → Redeploy).

---

## 3. Stripe (test mode first)

1. In the **Stripe Dashboard**, toggle **Test mode** (top-right).
2. **Developers → API keys** → copy the **Secret key** (`sk_test_…`) into
   `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-SITE.vercel.app/api/webhook`
   - Events: **`checkout.session.completed`**
   - Create it, then copy the **Signing secret** (`whsec_…`) into
     `STRIPE_WEBHOOK_SECRET`.
4. Leave `PRICE_CENTS=25000` for $250 (change anytime).

**Test a booking:** open your site, pick a slot, and on Stripe's page use card
`4242 4242 4242 4242`, any future expiry, any CVC. You should land back on the
site's confirmation step, and the webhook should create the calendar event.

When you're ready for real money: redo step 3 with **live** keys (`sk_live_…`,
new `whsec_…`) and update the two Vercel variables.

---

## 4. Google Calendar + Meet (Workspace, domain-wide delegation)

This lets the backend read your free/busy, create confirmed events, and attach a
**fresh Google Meet link to every booking** by acting as your Workspace user.

**a. Project + APIs**
1. **https://console.cloud.google.com** → create a project (e.g. `strjesse`).
2. **APIs & Services → Library** → enable **Google Calendar API** AND **Gmail API**
   (the Gmail API is what sends the branded confirmation email).

**b. Service account + key**
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it (e.g. `booking-bot`), create, no roles needed, done.
4. Open the service account → note its **Unique ID / Client ID** (a long number —
   you'll need it in step d).
5. **Keys → Add key → Create new key → JSON**. From the downloaded file copy:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key`  → `GOOGLE_PRIVATE_KEY` (paste the whole value, `\n` and all)

**c. Turn on domain-wide delegation**
6. Still on the service account → **Details → Advanced settings** (or the
   "Enable Google Workspace Domain-wide Delegation" checkbox) → enable it.

**d. Authorize it in the Workspace Admin console** (you must be a Workspace admin)
7. **https://admin.google.com → Security → Access and data control → API controls
   → Manage Domain-Wide Delegation → Add new**.
8. **Client ID** = the service account's Client ID from step 4.
   **OAuth scopes** (comma-separated — paste both):
   `https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/gmail.send`
9. **Authorize**.

   > The `gmail.send` scope lets the backend send the branded confirmation
   > email **as you** (`GOOGLE_IMPERSONATE_SUBJECT`). Optionally set `BOOKING_BCC`
   > to blind-copy yourself on every confirmation.

**e. Env vars**
10. `GOOGLE_CALENDAR_ID` = your Workspace email (e.g. `jesse@yourdomain.com`).
11. `GOOGLE_IMPERSONATE_SUBJECT` = the **same** Workspace email. (This is the
    switch that turns on auto-Meet — the backend acts as this user.)
12. `BUSINESS_TIMEZONE` = your working timezone (e.g. `Australia/Sydney`).
13. Leave `MEETING_URL` **empty** — Meet links are now automatic.

> No manual calendar sharing is needed: delegation lets the backend act as you.

---

## 5. Meeting link (only if you ever drop Workspace)

If `GOOGLE_IMPERSONATE_SUBJECT` is blank (plain Gmail), the backend can't mint
Meet links — set `MEETING_URL` to a permanent Zoom/Meet room instead. With your
Workspace setup above, ignore this.

---

## Local testing (optional)

```bash
npm install
npm i -g vercel
vercel link          # link to the Vercel project
vercel env pull .env # download your env vars into a gitignored .env
vercel dev           # run site + /api locally at http://localhost:3000
```

---

## Going live checklist

- [ ] Swap Stripe test keys → live keys (and re-create the live webhook).
- [ ] Confirm a real $250 booking, then refund it in Stripe.
- [ ] Point your custom domain at Vercel (Project → Settings → Domains).
- [ ] Update the URLs in `index.html` (canonical / og:url) to the final domain.

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

## 4. Google Calendar (service account)

This lets the backend read your free/busy and create confirmed events.

1. **https://console.cloud.google.com** → create a project (e.g. `strjesse`).
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it (e.g. `booking-bot`), create, no roles needed, done.
4. Open the service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. From it copy:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key`  → `GOOGLE_PRIVATE_KEY` (paste the whole value, including the
     `\n` sequences — the code converts them to real newlines)
5. **Share your calendar with the bot:** Google Calendar → your calendar →
   **Settings and sharing → Share with specific people → Add people** → paste the
   service account's `client_email` → permission **“Make changes to events”** → Send.
6. Set `GOOGLE_CALENDAR_ID` to your calendar id — for your main calendar this is
   just your Gmail address (`jesseheight1@gmail.com`).
7. Set `BUSINESS_TIMEZONE` to your working timezone (e.g. `Australia/Sydney`).

---

## 5. Meeting link

Set `MEETING_URL` to your permanent **Zoom** or **Google Meet** room link. It's
added to every confirmed event and the invite. (Auto-generating a fresh Meet link
per booking needs a Google Workspace account; a fixed room link is simpler and
works on a normal Gmail account.)

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

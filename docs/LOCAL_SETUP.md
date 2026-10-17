# Running KasaBaako locally (backend + dashboard + WhatsApp + USSD)

This lets each team member run the full system on their own computer —
no Render deployment needed for day-to-day dev/testing.

## 1. Clone and install

```bash
git clone <repo-url>
cd KASA-BAAKO/backend && npm install
cd ../dashboard && npm install
```

## 2. Backend environment variables

```bash
cd backend
cp .env.example .env
```

Fill in `.env`:
- `DASHBOARD_PASSWORD`, `SERVICE_API_KEY`, `USSD_WEBHOOK_TOKEN` — make up any
  value for local dev (e.g. `local-dev-123`), just keep them consistent.
- `ANTHROPIC_API_KEY` — ask Euriel.
- `KHAYA_API_KEY` — ask Euriel (shared Khaya Basic subscription key).
- `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_APP_SECRET` — ask Mawuli (Meta app owner).

**Never commit `.env` or paste real keys in chat** — `.env` is already
gitignored.

## 3. Run the backend

```bash
cd backend
npm run dev
```

Should print `KasaBaako backend running on port 3000`. Check it's alive:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## 4. Run the dashboard

```bash
cd dashboard
npm run dev
```

Opens at `http://localhost:5173` by default, already pointed at
`http://localhost:3000` (no dashboard `.env` needed locally).

## 5. Testing USSD locally (no Africa's Talking needed)

Open `docs/ussd-simulator.html` directly in your browser (double-click it,
or drag it into a browser tab). It talks to your local backend exactly
like Africa's Talking would.

1. Backend URL: leave as `http://localhost:3000`.
2. Paste the `USSD_WEBHOOK_TOKEN` value from your `.env`.
3. Click **"Dial *920#"** to start a session, then type replies like a
   real USSD menu.

## 6. Testing WhatsApp locally (needs a public URL via ngrok)

Meta can't reach `localhost`, so you need a tunnel:

```bash
# install once: https://ngrok.com/download
ngrok http 3000
```

This prints a public URL like `https://abcd1234.ngrok-free.app`. Then:

1. Go to Meta's WhatsApp app dashboard → your app → **WhatsApp → Configuration**.
2. Set **Callback URL** to `https://<your-ngrok-url>/webhooks/whatsapp`.
3. Set **Verify token** to the same value as `WHATSAPP_VERIFY_TOKEN` in your `.env`.
4. Click **Verify and Save**.
5. Make sure your WhatsApp test number is added under **recipient numbers**.
6. Message that WhatsApp number from your phone — it should hit your local backend.

**Important:** the ngrok URL changes every time you restart ngrok (free
plan), so you'll need to re-paste it into Meta's dashboard each session.
Only one person's tunnel can be registered as the callback URL at a time
— coordinate who's actively testing WhatsApp.

## 7. Running tests

```bash
cd backend
npm test
```

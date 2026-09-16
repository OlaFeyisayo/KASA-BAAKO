# KasaBaako 🎙️

**"Tap. Talk. Track."**

MTN Ghana Tɛkyerɛma Pa Hackathon 2026 — Accessibility & Assistive Tools

---

## What is this project?

In Ghana, a lot of people get scammed on Mobile Money, but reporting fraud today is hard — especially if you can't hear, speak, see well, don't read easily, or don't even have a smartphone. The current ways to report (calling, SMS, USSD menus) just weren't built for that.

**KasaBaako fixes this.** A customer reports fraud however is easiest for them — by talking, by typing, or by picking simple options — in **Twi**, through **WhatsApp** or a basic-phone **USSD** menu. An AI listens/reads the report and turns it into a clean, organized case file for MTN's fraud team. The customer gets a **case number** to track it, like a delivery tracking number. If the same scammer/number hits several people, the system can warn other customers too.

---

## Team

| Name | Year | University | Currently driving |
|---|---|---|---|
| Olayemi Olumuyi ("Ola") | 2nd Year | Lancaster University Ghana | MTN staff dashboard (live-connected, with login) |
| Euriel Toviezon | 3rd Year | Lancaster University Ghana | Backend/AI pipeline, case tracking, USSD, security & testing |
| Adlai Mawuli Amenyo ("Mawuli") | 2nd Year | Lancaster University Ghana | WhatsApp bot |

**Prototype deadline: September 20, 2026** · **Team sync: every 2–3 days**

---

## What the project must be able to do (Requirements)

1. Let a customer report fraud in **Twi**, by **voice**, **text**, or **simple button choices**, through **WhatsApp**.
2. Offer the same reporting flow through a **USSD menu**, for people without a smartphone/internet.
3. Automatically turn the report into a **structured case file** (what happened, when, how much, who's the suspect) using AI, and ask a follow-up question if something important is missing.
4. Give the customer a **case number** and a spoken/written confirmation of what was submitted.
5. **Never** ask for or store the customer's Mobile Money PIN.
6. Detect when several reports point to the same scam/number and **send a warning** to other affected customers.
7. Give MTN staff a simple **dashboard** to view, listen to, and process submitted cases.
8. Be usable by people who are blind/low-vision, deaf/hard-of-hearing, speech-impaired, or have low digital literacy (clear labels, one question at a time, spoken summaries).

---

## Tools & APIs We're Using

| Tool | What it's for |
|---|---|
| **Khaya AI (GhanaNLP)** | Converts Twi voice to text (ASR) and text to Twi voice (TTS). Basic plan ($14.95/mo, 3,000 calls) — professors are covering the cost. |
| **Anthropic (Claude)** | The AI that reads/hears the report and turns it into a structured case file. |
| **Meta WhatsApp Cloud API** | Connects our bot to WhatsApp, so customers can report fraud by chatting with us there. |
| **Africa's Talking** | Simulates a USSD menu, so customers on basic phones (no internet) can report fraud too. |
| **Node.js + Express** | The backend server that ties everything together (receives messages, calls the AI, saves cases). |
| **SQLite** | The database that stores each case (case number, status, details) and dashboard login sessions. |
| **Render** | Hosts the backend so it's reachable 24/7 for WhatsApp/USSD webhooks and the dashboard — $7/mo, fixed price, no spin-down, persistent storage. |

---

## Status: 11 of 12 steps done

1. ✅ Stack & setup — Khaya, Anthropic, and the shared repo all working.
2. ✅ Speech-to-text (ASR)
3. ✅ AI case builder (LLM)
4. ✅ Text-to-speech (TTS)
5. ✅ Case tracking (SQLite-backed, phone-verified lookup)
6. ✅ WhatsApp bot (voice + text; now maintained by Mawuli going forward)
7. ✅ USSD flow (bilingual Twi/English, plain-language categories)
8. ✅ Fraud alerts (repeat-scammer detection + MTN mass-alert escalation)
9. ✅ MTN dashboard (live data, login, filters, status updates)
10. ✅ Accessibility pass
11. ✅ Full testing — automated test suite (36 tests), a full security audit, a load test at simulated scale (up to 200,000 cases), and a 100-point manual QA pass. See the [Progress Log](#progress-log-summary) for what each one found and fixed.
12. 🔄 **Demo prep** — deploying to Render, final rehearsal. The only step left before Prototype 1.

---

## Could MTN plug this into their own app?

Yes, without rebuilding anything. The AI pipeline (voice/text in → structured case out) isn't tied to WhatsApp or USSD — it lives behind one generic, API-key-protected endpoint: `POST /report`. WhatsApp and USSD are just two callers of that same endpoint today.

If MTN's own app wanted to offer fraud reporting, their team would call that exact same `/report` endpoint as a third channel — same request shape, same AI pipeline, same case tracking and fraud alerts, no architecture change needed. The database already accepts a `mtn_app` channel value for this (see `db/schema.sql`), even though none of our own code uses it yet.

What a real integration would still need, beyond the hackathon prototype: written API docs (currently only in code comments), per-partner API keys instead of one shared `SERVICE_API_KEY`, and MTN provisioning their own Khaya/Anthropic quota at production volume.

---

## Progress Log (summary)

- **Sept 11–14**: Built the full AI pipeline (ASR → LLM case builder → TTS), switched WhatsApp from Twilio to Meta's free Cloud API after a cost review, built SQLite-backed case tracking, and shipped the WhatsApp bot (voice + text, one question at a time, case-number tracking).
- **Sept 12**: First security/reliability pass — revalidated all LLM output instead of trusting it, added request timeouts, stopped leaking internal errors, added a non-guessable case ID, shipped the first automated tests.
- **Sept 15**: Built the USSD flow (bilingual, plain-language categories) and fraud alerts. Then ran three deeper passes that each found and fixed real bugs: a full audit (fraud-category mismatch, customers self-alerting, a duplicate-case race condition), a load test at simulated scale up to 200,000 cases (a memory leak, a full-table-scan bottleneck, a real case-ID collision), and a 100-point manual QA pass (a bad-amount parsing bug, a stack-trace leak on malformed requests). Verified directly — not assumed — that SQL-injection/XSS attempts are neutralized and the database survives a hard crash.
- **Sept 15**: Added full authentication (dashboard login with session tokens, an API key on `/report`) and connected the dashboard to live backend data instead of static samples.
- **Sept 16**: Closed out the remaining security items — signed/tokenized the USSD webhook, moved dashboard sessions into SQLite so a backend restart doesn't log everyone out, verified real Khaya pricing, and picked Render for hosting.
- **Sept 16**: Mawuli signed the WhatsApp webhook (`X-Hub-Signature-256`, closing the last open security item) and added a language-choice step (English/Twi) and a restart command/button to the WhatsApp conversation, so a customer isn't stuck defaulting to Twi or stuck in a broken state with no way out.
- **Test suite**: 47 tests, all passing (`npm test` in `backend/`).

---

## Known Issues — Still Open

- [ ] **No leaked-secret check before demo/screen-sharing** — make sure `.env` or API keys never appear on screen during rehearsals or the presentation.
- [ ] **Single Node process + synchronous SQLite is a ceiling for true horizontal scale** — fine at hackathon/early-product volume (tested to 200,000+ cases and thousands of concurrent requests with no issue); real "millions of users" growth would eventually need a server-based database and more than one process. Not worth solving before the demo.

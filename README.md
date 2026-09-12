# KasaBaako 🎙️

**"Tap. Talk. Track."**

MTN Ghana Tɛkyerɛma Pa Hackathon 2026 — Accessibility & Assistive Tools

---

## What is this project?

In Ghana, a lot of people get scammed on Mobile Money, but reporting fraud today is hard — especially if you can't hear, speak, see well, don't read easily, or don't even have a smartphone. The current ways to report (calling, SMS, USSD menus) just weren't built for that.

**KasaBaako fixes this.** A customer reports fraud however is easiest for them — by talking, by typing, or by picking simple options — in **Twi**, through **WhatsApp** or a basic-phone **USSD** menu. An AI listens/reads the report and turns it into a clean, organized case file for MTN's fraud team. The customer gets a **case number** to track it, like a delivery tracking number. If the same scammer/number hits several people, the system can warn other customers too.

---

## Team

| Name | Year | University |
|---|---|---|
| Olayemi Olumuyi | 2nd Year | Lancaster University Ghana |
| Euriel Toviezon | 3rd Year | Lancaster University Ghana |
| Adlai Mawuli Amenyo | 2nd Year | Lancaster University Ghana |

**Prototype deadline: September 20, 2026**
**Team sync: every 2–3 days**

---

## What the project must be able to do (Requirements)

1. Let a customer report fraud in **Twi**, by **voice**, **text**, or **simple button choices**, through **WhatsApp**.
2. Offer the same reporting flow through a **USSD menu** (simulated), for people without a smartphone/internet.
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
| **Khaya AI (GhanaNLP)** | Converts Twi voice to text (ASR) and text to Twi voice (TTS). |
| **Anthropic (Claude)** | The AI that reads/hears the report and turns it into a structured case file. |
| **Twilio** | Connects our bot to WhatsApp, so customers can report fraud by chatting with us there. |
| **Africa's Talking** | Simulates a USSD menu, so customers on basic phones (no internet) can report fraud too. |
| **Node.js + Express** | The backend server that ties everything together (receives messages, calls the AI, saves cases). |
| **SQLite** | The database that stores each case (case number, status, details). |

---

## Task Assignment

| Who | Owns |
|---|---|
| **Euriel** | AI pipeline — ASR, LLM case builder, TTS (Steps 2, 3, 4) |
| **Adlai** | Case tracking + WhatsApp bot (Steps 5, 6) |
| **Ola** | Agent dashboard (Step 9) |

USSD (Step 7), fraud alerts (Step 8), accessibility (10), testing (11), and demo prep (12) will be picked up once the above are done.

---

## The 12 Steps to Prototype 1

The work is split into **12 steps**, grouped into 3 natural tracks so each teammate can own one track (4 steps each). Steps are in order — most depend on the one(s) before them.

1. ✅ **Stack & setup.** Decide which speech-to-text (ASR), AI (LLM), and text-to-speech (TTS) services we'll use for Twi, get the API access/keys needed, and set up the shared project (repo, database, environments) so all 3 of us can run it locally. *(Done: Khaya ASR+TTS and Anthropic LLM keys confirmed working, repo scaffolded with a running backend.)*
2. **Speech-to-text (ASR).** Get a Twi voice recording converted into text.
3. **AI case builder (LLM).** Take that text (from voice or typed) and turn it into a clean case file (date, amount, fraud type, suspect number...), flagging anything missing and generating a follow-up question in Twi when needed.
4. **Text-to-speech (TTS).** Turn the final confirmation summary into spoken Twi audio for the customer, with a pre-recorded fallback.
5. **Case tracking.** Every report gets saved with a unique case number and a status the customer can check later.
6. **WhatsApp bot.** Connect to WhatsApp and build the full conversation: choose voice/text/buttons → report → confirmation with case number → status check.
7. **USSD flow.** Build the same reporting steps as a basic-phone USSD menu (simulated, no internet needed), feeding into the same case system.
8. **Fraud alerts.** If a suspect number/pattern shows up in more than one report, automatically notify the other affected customers.
9. **MTN dashboard.** Build a simple webpage where MTN staff can see all cases, listen to the original audio, and update case status.
10. **Accessibility pass.** Make sure everything works well for blind, deaf, speech-impaired, and low-literacy users (clear labels, one step at a time, spoken summaries, no PIN ever asked).
11. **Full testing.** Try the entire flow together end-to-end (WhatsApp + USSD + dashboard) and fix the bugs found.
12. **Demo prep.** Write the demo script, record a backup video, and rehearse presenting it together.

> 🏁 **Prototype 1 is reached at the end of Step 12 — due September 20.** At that point we'll have a working demo: fraud reporting in Twi by voice/text/buttons on WhatsApp, a basic-phone USSD version, AI-structured cases with tracking numbers, fraud alerts, and an MTN staff dashboard.

---

## Progress Log

- **Sept 11** — Step 1 done: Khaya ASR + TTS API confirmed working (Twi supported), Anthropic LLM key confirmed working, repo scaffolded with a running Node.js backend.
- **Sept 11** — Twilio (WhatsApp) turned out to cost $20 for Ghana numbers — looking for a free/cheaper alternative for the WhatsApp channel.
- **Sept 11** — Africa's Talking (USSD) setup blocked for now: creating a USSD channel needs a public callback URL, which we don't have yet (backend isn't deployed/exposed online). Will come back to this once the backend has a reachable URL.
- **Sept 11** — Step 2 done: `asr.js` written — sends audio to Khaya ASR and returns the Twi transcript.
- **Sept 11** — Step 3 done: `llm.js` written — sends the transcript to Claude, which returns a structured case, flags missing fields, and writes Twi follow-up questions.
- **Sept 11** — Tasks assigned: Euriel → AI pipeline, Adlai → case tracking + WhatsApp bot, Ola → dashboard.
- **Sept 11** — Step 4 done: `tts.js` written — sends Twi text to Khaya TTS and returns the spoken audio. **Euriel's AI pipeline track (Steps 2-4) is now complete.**
- **Sept 12** — Step 9 (dashboard) first version done by Ola: React + Vite + Tailwind app with case list, filters, status changes, and audio playback, using sample data. Fixed a broken import and a duplicate line before merging.
- **Sept 12** — Ola asked to add a login screen to the dashboard — no authentication exists yet, which is a real security gap before connecting it to the real backend.
- **Sept 12** — Step 8 done: `alerts.js` written — matches a new case's suspected number against existing cases (30-day window) and builds a Twi alert message. ⚠️ The Twi message text is not yet verified by a native speaker — needs review before the demo.
- **Sept 12** — Added mass-alert escalation to `alerts.js`: if a suspected number is reported 5+ times, instead of just notifying past reporters, an English notice is generated for the MTN dashboard suggesting a mass customer alert.
- **Sept 12** — Added `POST /report` route in `server.js`: chains ASR → LLM → TTS into one call (voice or text in, structured case + confirmation audio out). Adlai's WhatsApp/USSD code will call this, then save the result and check it against `alerts.js`.
- **Sept 12** — Full security/reliability pass across the codebase. Fixed: LLM output is now revalidated and type-checked ourselves instead of trusted as-is (blocks prompt-injection-style tampering and bad `amount` values), added a fallback to strip markdown fences from LLM JSON responses, added request timeouts to all 3 external API calls (ASR/LLM/TTS), normalized phone number comparison in `alerts.js` (also fixes a silent bug with malformed dates), stopped leaking raw internal error messages to API callers, added CORS, added DB indexes on `suspected_number`/`status`, added a non-guessable case ID generator (`utils/caseId.js`) with a note that case lookup must also verify the requester's phone number, added a React Error Boundary and a safe amount formatter to the dashboard so one bad value can't blank-screen it.
- **Sept 12** — Added a first automated test suite (`alerts.test.js`, 8 tests, `npm test` in `backend/`) covering phone number matching, the 30-day window, malformed dates, and the MTN escalation threshold. Ola is handling the dashboard accessibility pass separately.
- **Sept 12** — Drafted `docs/DEMO_SCRIPT.md`: section-by-section demo plan, contingency plan if something fails live, and a placeholder for who presents what. Sections needing WhatsApp/USSD/dashboard-login are marked ⏳ until those are done.

---

## Known Issues — To Check Later

Found during the security pass but not fixed yet (either low priority for the prototype, or blocked on other work). Check these off once addressed:

- [ ] **`POST /report` has no authentication** — anyone with the URL can call it and use up our API quotas. Needs at least a shared-secret header once we know how WhatsApp/USSD will call it.
- [ ] **Khaya "Developer" plan is capped at 100 calls/month** (shared across ASR+TTS, across all 3 of us testing) — could run out before the demo. Watch usage; consider the paid Basic tier ($14.95/mo) if we get close.
- [ ] **Twilio/Africa's Talking webhooks aren't signature-verified yet** — once Adlai wires them up, must confirm requests really come from Twilio/Africa's Talking, not just anyone posting to the URL.
- [ ] **No leaked-secret check before demo/screen-sharing** — make sure `.env` or API keys never appear on screen during rehearsals or the presentation.
- [x] **No automated tests** — `alerts.js` now has a test suite (`npm test`). Still worth adding tests for `llm.js`/`asr.js`/`tts.js` and the WhatsApp/USSD flows once they're done.
- [ ] **Sample audio in `dashboard/src/data/sampleCases.js` is hosted on Google's servers** — could break if unreachable during the demo; consider hosting our own sample file instead.


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
2. ✅ **Speech-to-text (ASR).** Get a Twi voice recording converted into text.
3. ✅ **AI case builder (LLM).** Take that text (from voice or typed) and turn it into a clean case file (date, amount, fraud type, suspect number...), flagging anything missing and generating a follow-up question in Twi when needed.
4. ✅ **Text-to-speech (TTS).** Turn the final confirmation summary into spoken Twi audio for the customer, with a pre-recorded fallback.
5. ✅ **Case tracking.** Every report gets saved with a unique case number and a status the customer can check later.
6. ✅ **WhatsApp bot** *(voice + text done; button/guided mode not built yet — voice+text already cover the accessibility goal)*. Connect to WhatsApp and build the full conversation: choose voice/text/buttons → report → confirmation with case number → status check.
7. ✅ **USSD flow.** Build the same reporting steps as a basic-phone USSD menu (simulated, no internet needed), feeding into the same case system.
8. ✅ **Fraud alerts.** If a suspect number/pattern shows up in more than one report, automatically notify the other affected customers.
9. ✅ **MTN dashboard.** Build a simple webpage where MTN staff can see all cases, listen to the original audio, and update case status.
10. ✅ **Accessibility pass** *(dashboard side — done; WhatsApp/USSD conversation flows still need this once built).* Make sure everything works well for blind, deaf, speech-impaired, and low-literacy users (clear labels, one step at a time, spoken summaries, no PIN ever asked).
11. **Full testing.** Try the entire flow together end-to-end (WhatsApp + USSD + dashboard) and fix the bugs found.
12. **Demo prep.** Write the demo script, record a backup video, and rehearse presenting it together.

> 🏁 **Prototype 1 is reached at the end of Step 12 — due September 20.** At that point we'll have a working demo: fraud reporting in Twi by voice/text/buttons on WhatsApp, a basic-phone USSD version, AI-structured cases with tracking numbers, fraud alerts, and an MTN staff dashboard.

---

## Progress Log

- **Sept 11** — Step 1 done: Khaya ASR + TTS API confirmed working (Twi supported), Anthropic LLM key confirmed working, repo scaffolded with a running Node.js backend.
- **Sept 11** — Twilio (WhatsApp) turned out to cost $20 for Ghana numbers — looking for a free/cheaper alternative for the WhatsApp channel. **Resolved Sept 14**: switched to Meta's own WhatsApp Cloud API — free test number, up to 5 approved recipients (plenty for rehearsals + the demo), no card required at this tier.
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
- **Sept 12** — Removed `dashboard/` from `main` so Ola can upload her updated code (with login) directly to GitHub without conflicting with what was already there. The previous version (bug fixes + security/accessibility hardening) is preserved on the `backup/dashboard-with-euriel-fixes` branch — once Ola's new upload is in, merge those fixes back in rather than redoing them.
- **Sept 13** — Ola uploaded the updated dashboard: login screen, dark mode, case search, sortable columns, an empty-state message, and — on her own — most of the accessibility fixes we'd flagged (Esc-to-close, focus trap, `aria-label`/`aria-modal` on the modal, labels properly linked to their inputs, mobile-friendly table scroll). **Step 9 and most of Step 10 are now done.** Reapplied the one thing her version didn't have yet: the safe amount formatter + React Error Boundary, so a bad `amount` value still can't crash the page.
- **Sept 14** — Adlai hadn't started Step 5, so we built it ourselves: real SQLite storage is now wired in (`db/connection.js` loads `schema.sql` on startup). Decided cases are created as soon as the first message comes in, even incomplete (nothing is lost if the customer stops responding) — later answers get merged in via `mergeCaseFields`. `POST /report` now actually saves/updates cases and triggers `alerts.js` once a case is complete; added `GET /cases/:caseId?phone=...` (phone-verified lookup) and `PATCH /cases/:caseId/status` for the dashboard. Also factored phone-number normalization into a shared `utils/phone.js`. 14/14 tests pass (`npm test`, now covering the DB layer too). **Step 5 is done.**
- **Sept 14** — Also took over Step 6 since Adlai hadn't started it. Set up Meta's WhatsApp Cloud API (test number, 5 approved recipients). Factored the ASR→LLM→DB→TTS→alerts logic out of the HTTP route into a shared `services/reportPipeline.js`, used by both `POST /report` and the new `channels/whatsapp.js`. The bot handles voice notes and text, asks one missing-field question at a time (not all at once — more accessible), replies with the case number + spoken confirmation once complete, and recognizes a case number typed back for a status check. Added `db/cases.js#getOpenCaseForCustomer` so a reply is correctly treated as continuing an existing case rather than starting a new one. Tested the webhook verification handshake and message handling manually (this sandbox can't reach graph.facebook.com, so full send/receive needs testing from a real machine). **Step 6 is done (voice + text; button mode deferred).**
- **Sept 15** — Live WhatsApp test with a real device via ngrok hit a snag: the webhook verified fine and Meta's "messages" field showed Subscribed, but no messages arrived at all. Root cause was a known Meta platform change — the app wasn't linked to the WABA's `subscribed_apps` list, which the dashboard UI doesn't set automatically anymore. Fixed via one POST to `{WABA_ID}/subscribed_apps` in Graph API Explorer. End-to-end delivery still needs a final confirmation once Adlai's parallel WhatsApp work is reconciled with what's already built here (see below) — paused for now to avoid two people racing on the same channel.
- **Sept 15** — Adlai still hadn't started on WhatsApp/case tracking (both already done above), so to avoid duplicate work he's being redirected to review what exists and pick up from there instead of building a second implementation.
- **Sept 15** — Built Step 7 (USSD): `channels/ussd.js`, a guided one-question-per-screen flow (fraud category → amount → date → suspected number → description) since USSD has no comfortable free-typing or voice. Reuses the same `reportPipeline.js` as WhatsApp — the 5 answers are combined into one text and run through the same ASR-less path. Also fixed a real bug found while building this: `suspected_number` was marked as a required field, which would have permanently stuck any case where the customer legitimately doesn't know the scammer's number (very possible on USSD's explicit "enter 0 if unknown" option) — it's now optional everywhere, matching what the database schema always allowed. Added a `synthesizeConfirmation` flag to `reportPipeline.js` so USSD (text-only) doesn't waste a Khaya TTS call generating audio nobody can play.
- **Sept 15** — Accessibility fix on the USSD flow: the fraud-category menu originally used English jargon ("Impersonation", "SIM Swap Fraud") that low-literacy or non-English-reading customers couldn't parse. Added a language choice as the first screen (Twi or simple English), rewrote every category as a plain everyday description instead of a technical term (e.g. "Someone called and pretended to work for MTN" instead of "Impersonation"), and kept a "none of these — let me explain" option so nobody gets stuck. ⚠️ Honest limit: USSD is still text, so this helps low literacy / non-English readers, not customers who can't read at all in any language — that's what WhatsApp's voice mode is for. The Twi text is a best-effort draft, not yet checked by a native speaker. Tested all screens and error paths (both languages) manually via curl — all handled without crashing; the final case-creation step needs a real Anthropic key to fully verify (same sandbox limitation as Step 6). **Step 7 is done.** All 12 steps are now done or in a testable state — what's left is Step 11 (real end-to-end testing with live keys) and Step 12 (demo rehearsal).
- **Sept 15** — Ran a full end-to-end audit and fixed 3 bugs it surfaced:
  1. **Fraud category mismatch** — the LLM (WhatsApp/text reports) could return any free-form `fraud_category` string, which wouldn't match the fixed 7-value list USSD's menu and the dashboard filter use, so a WhatsApp-reported case could silently fail to show up under any dashboard filter. Fixed with a single shared `FRAUD_CATEGORIES` list in `llm.js` (also imported by `ussd.js` instead of it keeping its own copy), a prompt constraint telling the LLM to pick from that exact list, and a `coerceFraudCategory()` safety net that snaps anything else to `"Other"` instead of trusting the model's output.
  2. **Customers alerted about their own case** — `alerts.js`'s fraud-matching only compared suspected numbers, so if the same customer reported the same suspicious number twice (e.g. following up on their own case), they could get an "someone else reported this number" alert about themselves. Fixed by also comparing (normalized) `customer_contact` and excluding same-customer matches.
  3. **Duplicate cases from near-simultaneous WhatsApp messages** — `whatsapp.js` checks for an open case, then calls the (slow) LLM step, then saves; two messages arriving close together could both see "no open case" before either finished saving, creating two separate cases for one conversation. Fixed with a per-customer lock (`withCustomerLock` in `reportPipeline.js`) so the second message's check waits for the first message to finish being saved.
  - Also revisited a 4th flagged item — USSD can't be used by a customer who can't read at all, in any language — and confirmed this is not a bug to fix: USSD is a text-only protocol by design, and full illiteracy accessibility is already covered by WhatsApp's voice mode (that's specifically why the voice channel exists). No change made there.
  - All 15 tests pass (`npm test`, up from 8 — added a test for the self-alert exclusion). Re-verified the USSD flow manually via curl after the `FRAUD_CATEGORIES` refactor: category indexing, bounds-checking, and all screens still work correctly end-to-end.
- **Sept 15** — Load-tested the system for "what happens with millions of simultaneous users" (as close as this sandbox allows — no real API keys/quota for a true end-to-end blast, so this stress-tested the parts that don't need external APIs, at tens of thousands of concurrent operations). Found and fixed 3 more real bugs this surfaced, plus confirmed one thing that's fine as-is:
  1. **Memory leak in yesterday's new customer lock** — `withCustomerLock`'s cleanup compared promise objects that could never actually match (a promise-identity bug), so its map never emptied. Proven with a stress test: 50,000 distinct customers → 50,000 leaked entries, forever. Over a real deployment's lifetime this map would grow without bound and eventually crash the process from memory exhaustion. Rewrote it with a generation counter instead of promise-identity comparison; re-ran the same stress test (including customers whose message throws an error, so a failure can't jam the next customer in line) — 0 leaked entries every time.
  2. **Fraud-matching reloaded the entire cases table on every single completed report** — `findMatchingCases` needed all cases in memory to compare, so every report loaded the whole table (measured: 565ms and ~19MB at 50,000 stored cases; loading is synchronous, so that's the whole server frozen for everyone for that long, on every report, and it only gets worse as more cases accumulate). Added an indexed `suspected_number_normalized` column and a `getCasesBySuspectedNumber()` DB query so this now costs the same whether there are 1,000 or 200,000+ total cases (re-measured: 0-5ms flat across that whole range, instead of scaling with total case count).
  3. **Case IDs could actually collide at scale** — found for real, not just in theory: the previous 4-byte random case ID (32 bits) collided partway through seeding a 50,000-case test database. That matches the math (birthday paradox: ~29% collision odds by 50,000 cases, near-certain by a million) and would have failed a customer's report with a generic error. Widened the ID to 6 random bytes (48 bits) and added a retry-with-a-new-ID loop in `createCase()` as a backstop (tested by forcing a fake collision) — re-ran the same 200,000-case seed with no collisions.
  - **Confirmed fine as-is**: 3,000 concurrent HTTP requests to `/health` and `/webhooks/ussd` — no crash, no errors, server fully responsive immediately after. Express/Node itself isn't the bottleneck here.
  - 17/17 tests pass (`npm test`, up from 15 — added tests for the ID-collision retry and the new indexed lookup).
- **Sept 15** — Ran a manual pass through a 100-point generic QA checklist, adapted to what actually exists in this system (many items were N/A — no user-account system, no mobile app, no import/export feature). Found and fixed 2 more bugs: USSD's `parseAmount()` stripped every non-digit character before parsing, so a leading "-" was silently removed and "-500" became the valid amount 500 instead of being rejected (now rejects it outright); and malformed/oversized request bodies fell through to Express's default HTML error page, which leaked internal file paths and dependency stack traces (added a JSON error handler for both cases). Also verified directly (not just by reading the code): SQL injection and XSS payloads are neutralized (parameterized queries, no `dangerouslySetInnerHTML`), a `kill -9` mid-write leaves the database intact (`PRAGMA integrity_check` → `ok`, thanks to WAL mode), and the DB's own `CHECK` constraints reject invalid `channel`/`status` values even if application code is bypassed. Confirmed (not new fixes, just now demonstrated concretely) 2 pre-existing gaps: `/report` and `/cases/:id/status` had zero authentication, and the dashboard was still showing static sample data instead of real cases — both tracked below and fixed the same day (see next entry). 23/23 tests pass.
- **Sept 15** — Fixed the two gaps above, plus 2 more found while doing it:
  1. **No authentication on write/staff endpoints** — added `services/auth.js`: `POST /auth/login` checks a shared `DASHBOARD_PASSWORD` (constant-time comparison) and issues a random session token (kept in memory, 12h expiry); `POST /cases/:caseId/status` and the new `GET /cases` (staff-only, lists everything) now require it as `Authorization: Bearer <token>`. `POST /report` now requires a separate `x-api-key` matching `SERVICE_API_KEY`, since it's a machine-to-machine endpoint, not a staff one.
  2. **Dashboard wasn't connected to the real backend** — replaced `dashboard/src/data/sampleCases.js` (deleted, no longer used) with real `fetch` calls (`dashboard/src/api.js`) to `GET /cases` and `PATCH /cases/:id/status`, using the new session token. This incidentally fixes the dashboard password being visible in the shipped JS: `Login.jsx` now posts the password to the server instead of comparing it to a hardcoded string client-side. Added a working Log Out button (there wasn't one before) and session-expiry handling (a 401 from the backend bounces back to the login screen instead of silently failing).
  3. **2 moderate npm audit findings** (`qs`, a transitive dependency of Express, DoS via array-limit bypass) — Express 4.x's own dependency range can't reach the patched `qs` version through normal updates, so pinned it via package.json's `overrides` field instead of bumping to Express 5 (a breaking change not worth it for a moderate DoS fix). `npm audit` now reports 0 vulnerabilities.
  - Verified end-to-end in a real browser (not just curl): logged in with a wrong password (rejected), then the right one (session token issued), viewed real seeded cases, changed a case's status through the UI, reloaded the page and confirmed the new status came from the server (not local React state), logged out, and confirmed reloading after logout still requires logging in again (session actually cleared, not just hidden).
  - 33/33 tests pass (`npm test`, up from 23 — added `services/auth.test.js`).

---

## Known Issues — To Check Later

Found during the security pass but not fixed yet (either low priority for the prototype, or blocked on other work). Check these off once addressed:

- [x] **`POST /report` has no authentication** — fixed Sept 15: requires an `x-api-key` header matching `SERVICE_API_KEY`.
- [ ] **Khaya "Developer" plan is capped at 100 calls/month** (shared across ASR+TTS, across all 3 of us testing) — could run out before the demo. Watch usage; consider the paid Basic tier ($14.95/mo) if we get close.
- [x] **USSD webhook wasn't signature-verified** — Africa's Talking doesn't sign its USSD callbacks the way Meta signs WhatsApp webhooks (no header to check), so fixed Sept 15 with a secret `token` query param instead: the callback URL registered with Africa's Talking is `.../webhooks/ussd?token=<USSD_WEBHOOK_TOKEN>`, and `requireUssdWebhookToken` rejects any request without the matching token.
- [ ] **WhatsApp webhook isn't signature-verified yet** — Mawuli (now driving the WhatsApp bot) still needs to verify Meta's `X-Hub-Signature-256` header on incoming webhook calls, not just anyone posting to the URL.
- [ ] **No leaked-secret check before demo/screen-sharing** — make sure `.env` or API keys never appear on screen during rehearsals or the presentation.
- [ ] **Single Node process + synchronous SQLite is a real ceiling for true horizontal scale** — better-sqlite3 runs on the main thread, so every DB read/write briefly blocks all other in-flight requests; fine at hackathon/early-product volume (confirmed: no crash at thousands of concurrent requests, and the fraud-matching query now stays fast even at 200,000+ cases), but real "millions of concurrent users" growth would eventually need a proper server-based database (Postgres, etc.) and more than one process. Not worth solving before the demo — flagging so it isn't mistaken for "already scales infinitely."
- [x] **No automated tests** — `alerts.js` now has a test suite (`npm test`). Still worth adding tests for `llm.js`/`asr.js`/`tts.js` and the WhatsApp/USSD flows once they're done.
- [x] **Sample audio in `dashboard/src/data/sampleCases.js` is hosted on Google's servers** — moot as of Sept 15: the dashboard now loads real cases from the backend, and `sampleCases.js` was deleted.
- [x] **Dashboard has no real authentication / password visible in shipped JS** — fixed Sept 15, see Progress Log (server-side session tokens).
- [ ] **Dashboard sessions are in-memory only** — everyone's logged out if the backend process restarts (fine for a hackathon single-process deployment; would need a real session store — Redis, DB-backed, etc. — for production).


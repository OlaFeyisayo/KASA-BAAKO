# KasaBaako — Demo Script (Draft)

Draft for the Sept 20 internal deadline / Sept 23–24 hackathon screening.
Update once WhatsApp, USSD, and dashboard login are finished — sections
marked ⏳ depend on work still in progress.

**Total target time: ~5 minutes live + backup video.**

---

## 1. Problem (30s)

- 65% of Ghanaian mobile money users have faced fraud, but current reporting
  channels (calls, SMS, USSD) exclude people who can't hear, speak, see, read
  easily, or don't have a smartphone.
- Result: cases go unreported, MTN loses investigation data, scams repeat.

## 2. Solution one-liner (15s)

"KasaBaako — Tap. Talk. Track. Report fraud in Twi, however is easiest for
you, and get a case number to track it."

## 3. Live demo — WhatsApp voice report ⏳

*(Needs Adlai's WhatsApp bot)*

1. Open WhatsApp, send a voice note in Twi describing a fraud incident.
2. Show the bot transcribing (ASR) and structuring the report (LLM) in real time.
3. If a field is missing, show the bot asking a follow-up question in Twi.
4. Show the final confirmation message + case number.

## 4. Live demo — WhatsApp text report, missing field ⏳

*(Needs Adlai's WhatsApp bot)*

1. Type a short, incomplete report (e.g. no amount mentioned).
2. Show the bot catching the missing field and asking for it.
3. Complete it, get the case number.

## 5. Live demo — USSD flow ⏳

*(Needs Adlai's USSD bot + Africa's Talking public URL — currently blocked)*

1. Open the Africa's Talking USSD simulator.
2. Walk through the same reporting flow via text menu, no internet needed.
3. Get the case number on the final screen.

## 6. Fraud alert demo (ready — can demo with test data now)

1. Submit two fraud reports naming the same suspected number.
2. Show `findMatchingCases()` catching the match (can show this via a quick
   script or the dashboard, not necessarily production-wired yet).
3. Explain the escalation: 5+ reports on the same number → MTN dashboard
   flags it for a mass customer alert instead of individual pings.

## 7. MTN Dashboard ⏳ (login pending)

1. Log in as an MTN agent.
2. Show the case list with filters (status, fraud category).
3. Open a case: structured summary, original audio playback, status dropdown.
4. Point out the accessibility work (labels, keyboard navigation, high
   contrast) once Ola's pass is done.

## 8. Accessibility & impact close (30s)

- No PIN ever requested — can't be mistaken for phishing.
- Multi-modal (voice/text/buttons) means it works for blind, deaf, speech
  impaired, and low-literacy users.
- Reachable via WhatsApp (works on modest phones) and USSD (works with zero
  internet).
- Twi first, architecture built to add more Ghanaian languages later.

---

## Contingency plan

- **If live WhatsApp/USSD fails**: fall back to the backup demo video
  (Step 12 task — record once flows are stable).
- **If the Khaya API is slow/down**: fall back to pre-recorded audio clips
  (Step 4's fallback set — not yet recorded).
- **If the dashboard login isn't ready in time**: demo it without login,
  explicitly flag it as "auth to be added" rather than skip it.

## Who presents what

_(fill in once the team decides — e.g. Euriel: AI pipeline + alerts,
Adlai: WhatsApp/USSD live demo, Ola: dashboard)_

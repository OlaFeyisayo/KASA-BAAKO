# KasaBaako 🎙️

**"Tap. Talk. Track."**

MTN Ghana Tɛkyerɛma Pa Hackathon 2026 — Accessibility & Assistive Tools

KasaBaako is a mobile-first fraud reporting platform for MTN Mobile Money customers in Ghana. It lets people report fraud by voice, text, or guided multiple-choice — in Twi — through WhatsApp or USSD, and turns each report into a structured case file for MTN's fraud team, with proactive alerts to warn other at-risk customers.

---

## Team

| Name | Year | University | Role (TBD at kickoff meeting) |
|---|---|---|---|
| Olayemi Olumuyi | 2nd Year | Lancaster University Ghana | |
| Euriel Toviezon | 3rd Year | Lancaster University Ghana | |
| Adlai Mawuli Amenyo | 2nd Year | Lancaster University Ghana | |

**Prototype deadline: September 20, 2026**
**Team sync: every 2–3 days** (schedule confirmed each meeting, tracked in [Meeting Log](#meeting-log))

---

## Problem

An estimated 65% of Ghanaian mobile money users have faced or been targeted by fraud, but reported cases stay far lower — victims don't know how to report, or abandon the process. Existing channels (USSD, SMS, email, phone calls) weren't built with accessibility in mind:

- **SMS/email** are unstructured — customers don't know what details are needed, and get no guidance when something's missing.
- **USSD menus** are hard to use without screen-reader support.
- **No channel** gives a trackable case number or accessible status updates.

Ghana's 2021 census counted **2.1 million people living with a disability** (hearing, speech, visual). For them — and for customers with low digital literacy or no smartphone/internet — reporting fraud is effectively out of reach. Cases go unrecorded, MTN loses investigation data, and the same scams keep hitting new victims.

## Solution

KasaBaako lets a customer report an incident however suits them — **voice, typed text, or guided multiple-choice, in Twi** — via **WhatsApp** (voice/text/quick-reply buttons) or a **USSD flow** for basic phones without internet.

An AI pipeline turns the raw report into a structured case file (incident summary, date, amount, fraud category, suspected number, transaction ID if available, flagged missing fields) before it reaches a human investigator. The AI **never** judges guilt or approves compensation — it only prepares a complete, consistent report.

The customer gets a **case number** to track status. If a reported number/pattern matches other recent reports, the system proactively alerts at-risk customers — turning reporting from purely reactive into partly preventive.

An **MTN agent dashboard** gives authorized reviewers the original audio, the structured summary, and the customer's preferred language for follow-up.

---

## Objectives (for the hackathon prototype)

1. Let a user submit a fraud report in **Twi**, by **voice or text**, through **WhatsApp**.
2. Automatically transcribe (ASR) and structure the report into a **case file** via an LLM, flagging missing fields.
3. Return a **case number** and a spoken/text **confirmation summary** in Twi.
4. Demonstrate a **simulated USSD flow** for basic-phone accessibility (sandbox, e.g. Africa's Talking).
5. Provide a minimal **agent dashboard** to view/manage submitted cases.
6. Implement **basic proactive alerting**: flag matching numbers/patterns across reports.
7. Never request or store a customer's Mobile Money PIN.

### Out of scope for the prototype (future/scaling)
- Live MTN shortcode integration (USSD is simulated only).
- Additional Ghanaian languages beyond Twi (architecture must allow adding them later).
- Production-grade auth, compliance, or live investigation workflow with MTN systems.
- Full accessibility audit (screen-reader certification, WCAG conformance testing).

---

## Requirements

### Functional requirements
- **Multi-modal intake**: voice message, free text, and guided multiple-choice (buttons) on WhatsApp.
- **ASR (Twi → text)** using the hackathon-provided Twi dataset.
- **Case structuring (LLM)**: extract/organize date, amount, fraud category, suspected number, transaction ID, free-text summary; explicitly flag missing required fields and prompt the user for them.
- **TTS (text → Twi speech)** for spoken instructions/confirmations, with a pre-recorded audio fallback if live synthesis fails.
- **Case tracking**: generate a unique case number per report; let the customer query status.
- **USSD simulation**: text-menu flow (sandboxed) covering the same core reporting steps, no internet required.
- **Agent dashboard**: list cases, view structured summary + original audio, mark status, see customer's preferred language.
- **Proactive alert logic**: simple matching (e.g. same suspected number/transaction pattern) across stored reports, triggering a notification to other customers.
- **Accessibility behaviors**: screen-reader-friendly labels, high-contrast option, one-question-at-a-time flow, spoken final summary before submission.

### Non-functional requirements
- **Privacy/security**: no PIN collection ever; secure storage of case data and audio; access to the dashboard restricted to authorized agents.
- **Reliability**: graceful fallback when ASR/TTS/LLM calls fail (e.g., cached prompts, retry, manual text fallback).
- **Language**: all customer-facing copy in Twi for v1; strings/content pipeline structured so other languages can be added without redesign (middleware/i18n layer).
- **Performance**: report submission and confirmation should feel responsive in a live demo (seconds, not minutes).
- **Low-bandwidth friendliness**: USSD path must not depend on data connectivity; WhatsApp path should tolerate poor connections (retry on send).

### Technical stack (proposed — confirm at kickoff)
- **ASR**: Twi speech-to-text model/API using the hackathon dataset.
- **LLM**: structures free-form input into the case-file schema; flags missing fields.
- **TTS**: Twi text-to-speech for spoken prompts/confirmations (+ pre-recorded fallback set).
- **Channel — primary**: WhatsApp Business API (voice notes, text, quick-reply buttons).
- **Channel — accessibility demo**: simulated USSD via a sandbox (e.g., Africa's Talking).
- **Backend**: API + case database (schema below) + matching logic for alerts.
- **Frontend**: lightweight agent dashboard (web).

### Draft case data model
```
Case {
  case_id
  customer_contact (WhatsApp/USSD identifier)
  channel (whatsapp | ussd)
  input_mode (voice | text | guided)
  language (default: "tw")
  incident_summary
  incident_date
  amount
  fraud_category
  suspected_number
  transaction_id (nullable)
  missing_fields[]
  status (received | under_review | resolved)
  audio_ref (nullable)
  created_at / updated_at
}
```

---

## Full Project Roadmap — Numbered Task List (Setup → Final Product)

This is the master task list for the whole project, from day one setup through to a production-ready product — not just the hackathon prototype. Every task below is a **single, assignable unit of work**, numbered for quick reference in meetings (e.g. *"Ola takes 1, 4, 9, 15 — Euriel takes 12, 13, 14 — Adlai takes 22 through 26"*). Tasks are grouped into phases that build on each other in order; within a phase, most tasks can be split across the team and worked in parallel once the phase's earlier tasks are done.

The 🏁 marker shows exactly where we reach **Prototype 1** — the first version we can demo live to judges/users. That has to happen by **September 20**.

### Phase 0 — Foundations & Setup
1. Finalize tech stack choices (ASR provider, LLM provider, TTS provider, backend framework, database) and confirm them as a team.
2. Get access/API keys for: the Twi ASR/dataset, the chosen LLM API, the TTS service, the WhatsApp Business API sandbox, and a USSD sandbox (e.g. Africa's Talking).
3. Create the repo folder structure: `/backend`, `/whatsapp-bot`, `/ussd-sim`, `/dashboard`, `/docs`.
4. Set up a shared `.env.example` convention so no one hardcodes secrets.
5. Set up the database and create the `cases` table using the schema already drafted in this README.
6. Create a GitHub Issue for each numbered task in this list, so progress is tracked outside the README too.
7. Confirm the git workflow (branch per task, PR + 1 review before merge — see Working Agreements) and add a `.gitignore`.
8. Build a basic "hello world" backend endpoint and confirm all 3 members can run the project locally.

### Phase 1 — Core AI Pipeline (voice/text → structured case)
9. Build the ASR integration: send a Twi audio file in, get a text transcript out.
10. Test ASR against 5–10 sample Twi audio clips from the hackathon dataset; log accuracy issues.
11. Finalize the exact case-file JSON schema (which fields are required vs optional) — already drafted above, lock it in.
12. Write the LLM prompt that turns free text (from ASR or typed input) into the structured case JSON.
13. Add logic to detect and list `missing_fields` whenever the LLM can't extract something required.
14. Build a "follow-up question" generator: for each missing field, produce one clear Twi-language question to ask the user.
15. Wire ASR → LLM into a single pipeline function: `audio_or_text → structured_case`.
16. Write and run 5 test cases (sample fraud reports in Twi, voice and text) and confirm the pipeline produces sane output for each.

### Phase 2 — Case Storage & Tracking
17. Implement "create case": pipeline output is saved to the database with a generated unique case number.
18. Implement "get case by case number" lookup for status checks.
19. Implement case status updates (`received` → `under_review` → `resolved`) with timestamps.
20. Build the TTS integration: text confirmation summary → spoken Twi audio.
21. Record a small set of pre-recorded fallback Twi audio clips (confirmation, error, "please repeat") in case live TTS fails during the demo.

### Phase 3 — WhatsApp Channel (primary reporting channel)
22. Set up the WhatsApp Business API sandbox and connect its webhook to the backend.
23. Build the "start a report" flow: greeting + mode choice (voice / text / guided multiple-choice) in Twi.
24. Build the voice-note path: user sends a voice note → ASR → LLM structuring → confirmation.
25. Build the typed-text path: user types their report → LLM structuring → confirmation.
26. Build the guided multiple-choice path: sequential quick-reply buttons collecting one required field at a time.
27. Wire in the missing-field follow-up: bot asks the specific missing question and waits for the reply before finalizing the case.
28. Send the final spoken + text confirmation (with case number) back to the user on WhatsApp.
29. Build a "check my case status" flow (user sends case number, gets current status back).
30. Manually test the full WhatsApp flow end-to-end for all 3 input modes.

### Phase 4 — USSD Channel Simulation (accessibility for basic phones)
31. Set up the USSD sandbox and connect it to the backend.
32. Design the USSD menu tree (text-based), mirroring the guided multiple-choice flow.
33. Implement USSD session logic: one question per screen, no internet dependency.
34. Connect USSD submissions into the same case pipeline/database used by WhatsApp.
35. Return the case number as a final USSD screen at the end of the flow.
36. Manually test the full USSD flow end-to-end in the sandbox simulator.

### Phase 5 — Proactive Fraud Alerts
37. Define the matching rule (e.g. same suspected number or transaction pattern appearing in 2+ reports within X days).
38. Implement the matching check that runs automatically whenever a new case is created.
39. Implement the alert-sending function (WhatsApp message) to previously affected/at-risk customers when a match is found.
40. Test the alert logic using 2–3 synthetic overlapping fraud reports.

### Phase 6 — Agent Dashboard
41. Build the dashboard skeleton (web page) with a login for authorized agents.
42. Build the case-list view: table of all cases with status, date, category.
43. Build the case-detail view: structured summary, original audio playback, customer's preferred language, missing fields.
44. Let an agent change a case's status directly from the dashboard.
45. Add basic filtering/search (by status, date range, or fraud category).

### Phase 7 — Accessibility Pass
46. Add screen-reader-friendly labels/alt-text across the dashboard and customer-facing text.
47. Add a high-contrast display mode option.
48. Review the WhatsApp/USSD flows to confirm they're strictly one-question-at-a-time, ending in a spoken/text summary before submission.
49. Confirm nothing in any flow ever asks for the Mobile Money PIN; add an explicit on-screen/spoken reassurance of this.

### Phase 8 — Demo Prep & Submission
50. Write the demo script (which flows to show, in what order, on which device).
51. Record a backup demo video in case the live demo or network fails during presentation.
52. Prepare the pitch deck/slides (problem, solution, architecture, impact — reuse this README's content).
53. Run a full end-to-end rehearsal — voice report on WhatsApp, text report on WhatsApp, guided report on USSD, dashboard review, an alert trigger — with all 3 members watching for bugs.
54. Fix any bugs found during rehearsal.
55. Final submission: push code, README, demo video, and slides before the deadline.

> 🏁 **PROTOTYPE 1 — reached at Task 55, due September 20.**
> This is the version presented to judges/users: multi-modal Twi reporting via WhatsApp, simulated USSD accessibility, AI case structuring, case tracking, basic proactive alerts, and a working agent dashboard.

---

### Beyond the Hackathon — Path to the Final Product

56. Collect judge/user feedback from the hackathon demo and log it as new tracked issues.
57. Replace the simulated USSD sandbox with a real MTN shortcode integration (requires MTN partnership/API access).
58. Move from the simple case-matching heuristic to a more robust fraud-pattern detection system (e.g. clustering or model-based matching).
59. Add real authentication/authorization for the agent dashboard (roles, audit logs).
60. Add data-protection/compliance measures (encryption at rest, retention policy, consent flows) for audio and personal data.
61. Load-test the WhatsApp/USSD pipelines for concurrent users.
62. Add the next Ghanaian language(s) from the hackathon datasets, using the middleware/i18n layer built in Phase 1.
63. Extend the platform beyond fraud reporting to other MTN services (general complaints/service requests), reusing the same multi-modal architecture.
64. Run a formal accessibility audit (screen-reader certification, WCAG conformance testing) with real users with disabilities.
65. Production deployment, monitoring, and handover documentation for MTN's fraud team.

---

## Meeting Log

Team syncs every 2–3 days. Log decisions and blockers here after each meeting.

| Date | Attendees | Decisions | Action items | Next sync |
|---|---|---|---|---|
| _(kickoff meeting — TBD)_ | | | | |

---

## Working agreements (proposed)

- **Branching**: feature branches off `main`, PR + at least one review before merge.
- **Task tracking**: use GitHub Issues/Projects for the task breakdown decided at kickoff.
- **Definition of done** for a feature: works in the WhatsApp (or USSD) demo path, has no PIN/sensitive-data leakage, handles the "missing field" and "service failure" cases without crashing.

---

## References

- Bank of Ghana (2025). *2025 Fraud Report: Banks, Specialised Deposit-Taking Institutions and Payment Service Providers.*
- E-Crime Bureau (2024). *Digital Fraud Analysis Report.*
- Ghana Statistical Service (2021). *Ghana 2021 Population and Housing Census: Disability Report.*
- INTERPOL (2026). *African Cyberthreat Assessment Report 2026.*

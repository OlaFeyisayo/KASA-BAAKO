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

## Roadmap to prototype (Sept 10 → Sept 20)

| Phase | Dates | Focus | Deliverable |
|---|---|---|---|
| **1. Kickoff & setup** | Sep 10–11 | Confirm roles, finalize stack choices, set up repo structure, get access to Twi dataset + WhatsApp/USSD sandbox | Repo scaffolded, roles assigned, environments working |
| **2. Core pipeline** | Sep 12–14 | ASR (Twi voice → text), LLM case-structuring, draft case schema + storage | Voice/text input → structured case JSON, end-to-end locally |
| **3. Channels** | Sep 14–16 | WhatsApp flow (text/voice/buttons), simulated USSD flow | User can submit a report from WhatsApp and from the USSD sandbox |
| **4. Feedback loop & alerts** | Sep 16–17 | Case number generation + status tracking, TTS confirmation, basic proactive-alert matching | User gets case number + spoken confirmation; matching alert demo works |
| **5. Agent dashboard** | Sep 17–18 | Minimal dashboard: list cases, view audio/summary, update status | Agent can review a submitted case end-to-end |
| **6. Polish & rehearsal** | Sep 18–19 | Accessibility pass (labels, contrast, one-step-at-a-time), bug fixes, demo script | Stable demo flow, known issues logged |
| **7. Submission** | Sep 20 | Final testing, README/demo video/slides, submit | **Prototype delivered** |

*(Adjust dates once the team confirms availability at kickoff — this is a starting proposal.)*

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

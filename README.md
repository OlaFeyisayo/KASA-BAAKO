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

## The 15 Steps to Prototype 1

The work is split into **15 steps**. Each teammate can take about **5 steps**. Steps are in order — most steps depend on the one(s) before them.

1. **Pick the tools.** Decide which speech-to-text (ASR), AI (LLM), and text-to-speech (TTS) services we'll use for Twi, and get the API access/keys needed.
2. **Set up the project.** Create the shared code folders, the database, and make sure all 3 of us can run the project on our own laptops.
3. **Speech-to-text.** Get a Twi voice recording converted into text.
4. **AI case builder.** Take that text (from voice or typed) and have the AI turn it into a clean case file (date, amount, fraud type, suspect number...), flagging anything missing.
5. **Follow-up questions.** When something is missing, have the AI ask the customer one clear question in Twi to fill the gap.
6. **Case numbers & tracking.** Every report gets saved with a unique case number the customer can check later.
7. **Text-to-speech.** Turn the final confirmation summary into spoken Twi audio for the customer.
8. **WhatsApp connection.** Connect the project to WhatsApp so people can actually send messages to it.
9. **WhatsApp reporting flow.** Build the full conversation on WhatsApp: choose voice/text/buttons → report → confirmation with case number.
10. **USSD reporting flow.** Build the same reporting steps as a basic-phone USSD menu (simulated, no internet needed).
11. **Fraud alerts.** If a suspect number/pattern shows up in more than one report, automatically notify the other affected customers.
12. **MTN dashboard.** Build a simple webpage where MTN staff can see all cases, listen to the original audio, and update case status.
13. **Accessibility check.** Make sure everything works well for blind, deaf, speech-impaired, and low-literacy users (clear labels, one step at a time, spoken summaries, no PIN ever asked).
14. **Full testing.** Try the entire flow ourselves end-to-end (WhatsApp + USSD + dashboard) and fix the bugs we find.
15. **Prepare and rehearse the demo.** Write the demo script, record a backup video, and rehearse presenting it together.

> 🏁 **Prototype 1 is reached at the end of Step 15 — due September 20.** At that point we'll have a working demo: fraud reporting in Twi by voice/text/buttons on WhatsApp, a basic-phone USSD version, AI-structured cases with tracking numbers, fraud alerts, and an MTN staff dashboard.

---

## Working agreements

- **Branching**: feature branches off `main`, PR + at least one review before merge.
- **Task tracking**: one GitHub Issue per step, assigned to whoever takes it.
- **Definition of done**: works in the WhatsApp/USSD demo, never touches the PIN, doesn't crash on a missing field.

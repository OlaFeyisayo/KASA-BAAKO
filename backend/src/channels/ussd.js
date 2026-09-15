// Step 7: Africa's Talking USSD webhook — same guided reporting flow as
// whatsapp.js, one question per screen, feeding into the same case pipeline
//
// USSD has no free-typing comfort and no voice, so instead of letting the AI
// extract fields from natural text, we ask one structured question per
// screen (language, fraud category, amount, date, suspected number,
// description), then combine the answers into one text and hand it to the
// same reportPipeline used by WhatsApp.
//
// Accessibility: the customer picks Twi or simple English first. Category
// options are plain everyday descriptions, not jargon ("someone called and
// pretended to work for MTN" instead of "impersonation"), and there's
// always a "none of these — let me explain" option. ⚠️ The Twi text below
// is a best-effort draft, not yet checked by a native speaker.
//
// Note: even in Twi, USSD is still text — a customer who cannot read at all
// (in any language) can't use this. Voice on WhatsApp is what actually
// reaches that group; this only lowers the bar from "must read English
// jargon" to "must read simple text in a language they know".
//
// Africa's Talking re-sends the FULL session history on every request (the
// `text` field, entries separated by "*"), so we don't need to store our
// own session state — we just read how many answers have come in so far.
//
// Safety rule: on ANY invalid input, we end the session with a clear
// message instead of trying to "retry" the same screen — trying to retry
// would desync our step-counting from Africa's Talking's history and risk
// silently misreading a later answer as an earlier one.

import { processReport } from "../services/reportPipeline.js";
import { sendWhatsAppText } from "./whatsapp.js";
import { FRAUD_CATEGORIES } from "../services/llm.js";

const MAX_DESCRIPTION_LENGTH = 180; // keep USSD screens short

// Reuses llm.js's FRAUD_CATEGORIES as the single source of truth (same
// values as the dashboard filter and the LLM's own category extraction),
// so a case's fraud_category always matches regardless of which channel
// it came in through. CATEGORY_LABELS below must stay in this same order.
const CATEGORY_VALUES = FRAUD_CATEGORIES;

const CATEGORY_LABELS = {
  en: [
    "Someone called and pretended to work for MTN",
    "Someone lied to me to get my details",
    "My phone line suddenly stopped working",
    "Someone asked me for a code sent to my phone",
    "Money left my account that I didn't send",
    "I sent money to someone and it was a scam",
    "None of these — let me explain",
  ],
  tw: [
    "Obi frɛɛ me kaa sɛ ɔyɛ MTN adwumayɛni",
    "Obi twaa me nkontompo de nyaa me nsɛm",
    "Me line gyaee di dwuma prɛko pɛ",
    "Obi bisaa me nɔma a wɔde brɛɛ me wɔ telefon so",
    "Sika fii me akontaabu mu a mennim",
    "Mede me sika kɔmaa obi a na ɛyɛ nsisi",
    "Ɛnyɛ eyinom mu biara — Menkyerɛ ka",
  ],
};

const TEXT = {
  en: {
    amount: "How much money was involved? (Enter 0 if unknown):",
    date: "When did this happen? (e.g. 2026-09-10 or 'today'):",
    number: "What is the suspect's phone number? (Enter 0 if unknown):",
    description: "Tell us more in your own words:",
    final: (id) => `Thank you. Your case number is ${id}. Keep it to check your case status later.`,
    incomplete: (id) => `Your report was saved as ${id}. An MTN agent may follow up for a few more details.`,
    errInvalidCategory: (max) => `Invalid choice: enter a number from 1 to ${max}.`,
    errInvalidAmount: "Invalid amount.",
    errInvalidDate: "Invalid date.",
    errInvalidNumber: "Invalid entry.",
    errInvalidDescription: "Please describe what happened.",
    errTooMany: "Too many inputs.",
    errGeneric: "Something went wrong processing your report. Please try again later.",
    restartSuffix: "Please dial the USSD code again to restart your report.",
  },
  tw: {
    amount: "Sika dodow sɛn na ɛkɔɔ mu? (Sɛ wunnim a, kyerɛw 0):",
    date: "Da bɛn na eyi sii? (Sɛnkyerɛnne: 2026-09-10 anaa 'ɛnnɛ'):",
    number: "Nsisifoɔ no telefon nɔma ne sɛn? (Sɛ wunnim a, kyerɛw 0):",
    description: "Ka nea esii no kyerɛ yɛn wɔ w'ankasa asɛm mu:",
    final: (id) => `Meda wo ase. Wo asɛm nɔma ne ${id}. Fa sie na wode bɛhwehwɛ wo asɛm tebea.`,
    incomplete: (id) => `Yɛasie wo amaneɛ sɛ ${id}. MTN adwumayɛni bɛtumi abisa wo nsɛm bi bio.`,
    errInvalidCategory: (max) => `Nea woyii no nyɛ deɛ ɛfata: kyerɛw nɔma 1 kɔsi ${max}.`,
    errInvalidAmount: "Sika dodow a wokyerɛɛ no nyɛ deɛ ɛfata.",
    errInvalidDate: "Da a wokyerɛɛ no nyɛ deɛ ɛfata.",
    errInvalidNumber: "Deɛ wode hyɛɛ mu no nyɛ deɛ ɛfata.",
    errInvalidDescription: "Yɛsrɛ wo, ka deɛ esii no.",
    errTooMany: "Wode nsɛm dodoɔ bi hyɛɛ mu dodo.",
    errGeneric: "Biribi ankɔ yie. Yɛsrɛ wo, sɔ hwɛ bio akyire yi.",
    restartSuffix: "Yɛsrɛ wo, fa USSD nɔma no fa foforɔ hyɛ mu bio.",
  },
};

function parseAmount(input) {
  const cleaned = String(input).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Africa's Talking POSTs form-encoded fields: sessionId, phoneNumber,
 * networkCode, serviceCode, text. Response must be plain text starting
 * with "CON " (show another screen) or "END " (close the session).
 */
export async function handleUssdRequest(req, res) {
  res.set("Content-Type", "text/plain");

  const phoneNumber = req.body?.phoneNumber;
  const rawText = req.body?.text;

  if (!phoneNumber) {
    return res.send("END Missing phone number. Please dial the USSD code again to restart your report.");
  }

  // Ignore empty segments defensively (e.g. a stray trailing "*") so a
  // formatting quirk from the gateway can't shift our step count.
  const steps = typeof rawText === "string" ? rawText.split("*").filter((s) => s !== "") : [];

  try {
    if (steps.length === 0) {
      return res.send("CON Welcome / Akwaaba to KasaBaako\n1. Twi\n2. English");
    }

    const lang = steps[0] === "1" ? "tw" : steps[0] === "2" ? "en" : null;
    if (!lang) {
      return res.send("END Invalid choice. Please dial the USSD code again to restart your report.");
    }
    const t = TEXT[lang];

    if (steps.length === 1) {
      return res.send(`CON ${CATEGORY_LABELS[lang].map((label, i) => `${i + 1}. ${label}`).join("\n")}`);
    }

    const categoryIndex = parseInt(steps[1], 10);
    if (!Number.isInteger(categoryIndex) || categoryIndex < 1 || categoryIndex > CATEGORY_VALUES.length) {
      return res.send(`END ${t.errInvalidCategory(CATEGORY_VALUES.length)} ${t.restartSuffix}`);
    }
    if (steps.length === 2) {
      return res.send(`CON ${t.amount}`);
    }

    const amount = parseAmount(steps[2]);
    if (amount === null) {
      return res.send(`END ${t.errInvalidAmount} ${t.restartSuffix}`);
    }
    if (steps.length === 3) {
      return res.send(`CON ${t.date}`);
    }

    const incidentDate = steps[3].trim();
    if (!incidentDate) {
      return res.send(`END ${t.errInvalidDate} ${t.restartSuffix}`);
    }
    if (steps.length === 4) {
      return res.send(`CON ${t.number}`);
    }

    const suspectedNumberRaw = steps[4].trim();
    if (!suspectedNumberRaw) {
      return res.send(`END ${t.errInvalidNumber} ${t.restartSuffix}`);
    }
    if (steps.length === 5) {
      return res.send(`CON ${t.description}`);
    }

    const description = steps[5].trim().slice(0, MAX_DESCRIPTION_LENGTH);
    if (!description) {
      return res.send(`END ${t.errInvalidDescription} ${t.restartSuffix}`);
    }
    if (steps.length > 6) {
      return res.send(`END ${t.errTooMany} ${t.restartSuffix}`);
    }

    const category = CATEGORY_VALUES[categoryIndex - 1];
    const suspectedNumber = suspectedNumberRaw === "0" ? null : suspectedNumberRaw;

    const reportText = [
      `Fraud type: ${category}.`,
      `Amount: GHS ${amount}.`,
      `Date: ${incidentDate}.`,
      suspectedNumber ? `Suspected number: ${suspectedNumber}.` : null,
      `Details: ${description}`,
    ]
      .filter(Boolean)
      .join(" ");

    const result = await processReport({
      text: reportText,
      customer_contact: phoneNumber,
      channel: "ussd",
      input_mode: "guided",
      language: lang === "tw" ? "twi" : "english",
      synthesizeConfirmation: false,
    });

    if (result.missing_fields.length > 0) {
      // Shouldn't normally happen since every required field was asked for
      // directly, but stay safe instead of pretending the case is complete.
      return res.send(`END ${t.incomplete(result.case_id)}`);
    }

    if (result.alert?.type === "individual") {
      for (const alertMessage of result.alert.messages) {
        // Best-effort: the affected customer may not be reachable this way
        // if they never used WhatsApp with us. No live channel back to a
        // USSD-only customer exists yet.
        await sendWhatsAppText(alertMessage.to, alertMessage.text).catch((err) => {
          console.error("[ussd] failed to relay alert:", err);
        });
      }
    } else if (result.alert?.type === "mtn_escalation") {
      console.warn("[ussd] MTN escalation:", result.alert.notice);
    }

    return res.send(`END ${t.final(result.case_id)}`);
  } catch (err) {
    console.error("[ussd] handleUssdRequest error:", err);
    return res.send("END Something went wrong processing your report. Please try again later.");
  }
}

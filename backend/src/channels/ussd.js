// Step 7: Africa's Talking USSD webhook — same guided reporting flow as
// whatsapp.js, one question per screen, feeding into the same case pipeline
//
// USSD has no free-typing comfort and no voice, so instead of letting the AI
// extract fields from natural text, we ask one structured question per
// screen (fraud category, amount, date, suspected number, description),
// then combine the answers into one text and hand it to the same
// reportPipeline used by WhatsApp.
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

const FRAUD_CATEGORIES = [
  "Mobile Money Fraud",
  "Impersonation",
  "Phishing",
  "SIM Swap Fraud",
  "OTP Scam",
  "Unauthorized Transaction",
  "Other",
];

const MAX_DESCRIPTION_LENGTH = 180; // keep USSD screens short

function categoryMenuText() {
  return FRAUD_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join("\n");
}

/** Parses "GHS 200", "200.50", "0" etc. Returns null if not a valid non-negative number. */
function parseAmount(input) {
  const cleaned = String(input).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function restartMessage(reason) {
  return `END ${reason} Please dial the USSD code again to restart your report.`;
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
    return res.send(restartMessage("Missing phone number."));
  }

  // Ignore empty segments defensively (e.g. a stray trailing "*") so a
  // formatting quirk from the gateway can't shift our step count.
  const steps = typeof rawText === "string" ? rawText.split("*").filter((s) => s !== "") : [];

  try {
    if (steps.length === 0) {
      return res.send(`CON Welcome to KasaBaako\nReport a Mobile Money fraud.\nWhat type of fraud happened?\n${categoryMenuText()}`);
    }

    const categoryIndex = parseInt(steps[0], 10);
    if (!Number.isInteger(categoryIndex) || categoryIndex < 1 || categoryIndex > FRAUD_CATEGORIES.length) {
      return res.send(restartMessage(`Invalid choice: enter a number from 1 to ${FRAUD_CATEGORIES.length}.`));
    }
    if (steps.length === 1) {
      return res.send("CON Enter the amount involved, in GHS (enter 0 if unknown):");
    }

    const amount = parseAmount(steps[1]);
    if (amount === null) {
      return res.send(restartMessage("Invalid amount."));
    }
    if (steps.length === 2) {
      return res.send("CON When did this happen? (e.g. 2026-09-10 or 'today'):");
    }

    const incidentDate = steps[2].trim();
    if (!incidentDate) {
      return res.send(restartMessage("Invalid date."));
    }
    if (steps.length === 3) {
      return res.send("CON Enter the suspected phone number (enter 0 if unknown):");
    }

    const suspectedNumberRaw = steps[3].trim();
    if (!suspectedNumberRaw) {
      return res.send(restartMessage("Invalid entry."));
    }
    if (steps.length === 4) {
      return res.send("CON Briefly describe what happened:");
    }

    const description = steps[4].trim().slice(0, MAX_DESCRIPTION_LENGTH);
    if (!description) {
      return res.send(restartMessage("Please describe what happened."));
    }
    if (steps.length > 5) {
      return res.send(restartMessage("Too many inputs."));
    }

    const category = FRAUD_CATEGORIES[categoryIndex - 1];
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
      language: "twi",
      synthesizeConfirmation: false,
    });

    if (result.missing_fields.length > 0) {
      // Shouldn't normally happen since every required field was asked for
      // directly, but stay safe instead of pretending the case is complete.
      return res.send(`END Your report was saved as ${result.case_id}. An MTN agent may follow up for a few more details.`);
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

    return res.send(`END Thank you. Your case number is ${result.case_id}. Keep it to check your case status later.`);
  } catch (err) {
    console.error("[ussd] handleUssdRequest error:", err);
    return res.send("END Something went wrong processing your report. Please try again later.");
  }
}

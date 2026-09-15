// Step 6: Twilio WhatsApp webhook — greeting, mode choice (voice/text/guided),
// runs the report through asr.js + llm.js, sends back confirmation + case number
//
// (Ended up using Meta's own WhatsApp Cloud API directly instead of Twilio —
// see the Progress Log for why. "Guided" (quick-reply buttons) mode is not
// built yet; voice and text are.)

import { processReport, withCustomerLock } from "../services/reportPipeline.js";
import { getCaseForCustomer, getOpenCaseForCustomer } from "../db/cases.js";
import { REQUIRED_FIELDS } from "../services/llm.js";

const GRAPH_API_VERSION = "v21.0";
const CASE_ID_PATTERN = /^KB-[0-9A-F]{8}$/i;

function graphUrl(path) {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`;
}

function authHeaders() {
  return { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
}

/**
 * Handles Meta's webhook verification handshake (a GET request with
 * hub.mode/hub.verify_token/hub.challenge query params).
 */
export function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
}

/** Sends a plain text WhatsApp message. */
export async function sendWhatsAppText(to, body) {
  const response = await fetch(graphUrl(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!response.ok) {
    console.error("[whatsapp] sendWhatsAppText failed:", await response.text());
  }
}

/** Uploads an audio buffer as WhatsApp media, then sends it to `to`. */
export async function sendWhatsAppAudio(to, audioBuffer) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "confirmation.wav");

  const uploadResponse = await fetch(graphUrl(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`), {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const uploadData = await uploadResponse.json();
  if (!uploadResponse.ok) {
    console.error("[whatsapp] media upload failed:", uploadData);
    return;
  }

  const sendResponse = await fetch(graphUrl(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "audio",
      audio: { id: uploadData.id },
    }),
  });
  if (!sendResponse.ok) {
    console.error("[whatsapp] sendWhatsAppAudio failed:", await sendResponse.text());
  }
}

/** Downloads an incoming WhatsApp voice note by its media id. */
async function downloadWhatsAppMedia(mediaId) {
  const metaResponse = await fetch(graphUrl(mediaId), { headers: authHeaders() });
  const meta = await metaResponse.json();
  if (!metaResponse.ok) {
    throw new Error(`Failed to look up media ${mediaId}: ${JSON.stringify(meta)}`);
  }

  const fileResponse = await fetch(meta.url, { headers: authHeaders() });
  const arrayBuffer = await fileResponse.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type };
}

/** Picks the single most important missing field to ask about next (one question at a time). */
function nextFollowUpQuestion(missingFields, followUpQuestions) {
  const nextField = REQUIRED_FIELDS.find((field) => missingFields.includes(field));
  return nextField ? followUpQuestions[nextField] : null;
}

/**
 * Main WhatsApp webhook handler. Meta POSTs here for every incoming message
 * (and other events, like delivery statuses, which we ignore).
 */
export async function handleIncomingMessage(req, res) {
  res.sendStatus(200); // ack immediately; Meta expects a fast response

  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return; // not an incoming message (e.g. a status update)

  const from = message.from;

  try {
    if (message.type === "text") {
      const body = message.text.body.trim();

      if (CASE_ID_PATTERN.test(body)) {
        const found = getCaseForCustomer(body.toUpperCase(), from);
        await sendWhatsAppText(
          from,
          found
            ? `Case ${found.case_id}: status is "${found.status}".`
            : "We couldn't find that case number for your phone number."
        );
        return;
      }

      await runReportTurn({ from, text: body, input_mode: "text" });
      return;
    }

    if (message.type === "audio") {
      const { buffer, mimeType } = await downloadWhatsAppMedia(message.audio.id);
      await runReportTurn({ from, audioBuffer: buffer, contentType: mimeType, input_mode: "voice" });
      return;
    }

    await sendWhatsAppText(from, "Sorry, I can only understand voice notes or text messages right now.");
  } catch (err) {
    console.error("[whatsapp] handleIncomingMessage error:", err);
    await sendWhatsAppText(from, "Something went wrong processing your report. Please try again.");
  }
}

async function runReportTurn({ from, text, audioBuffer, contentType, input_mode }) {
  // Locked so that two near-simultaneous messages from the same customer
  // can't both see "no open case yet" and each create a separate case —
  // see withCustomerLock's comment in reportPipeline.js.
  const result = await withCustomerLock(from, async () => {
    const openCase = getOpenCaseForCustomer(from);

    return processReport({
      text,
      audioBuffer,
      contentType,
      customer_contact: from,
      channel: "whatsapp",
      input_mode,
      case_id: openCase?.case_id,
      language: "twi",
    });
  });

  if (result.missing_fields.length > 0) {
    const question = nextFollowUpQuestion(result.missing_fields, result.follow_up_questions);
    await sendWhatsAppText(from, question || "Could you give me a bit more detail about what happened?");
    return;
  }

  await sendWhatsAppText(from, `Thank you. Your case number is ${result.case_id}. We've recorded your report.`);
  if (result.confirmationAudio) {
    await sendWhatsAppAudio(from, result.confirmationAudio);
  }

  if (result.alert?.type === "individual") {
    for (const alertMessage of result.alert.messages) {
      await sendWhatsAppText(alertMessage.to, alertMessage.text);
    }
  } else if (result.alert?.type === "mtn_escalation") {
    // No live channel to MTN staff yet (dashboard has no notification feed) —
    // logged for now so it's at least visible in the server console.
    console.warn("[whatsapp] MTN escalation:", result.alert.notice);
  }
}

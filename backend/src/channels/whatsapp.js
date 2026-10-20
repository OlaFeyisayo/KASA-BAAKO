// Step 6: WhatsApp bot via Meta's WhatsApp Cloud API — greeting, language
// choice, mode choice (voice/text/guided), and the actual report turn,
// through the shared reportPipeline (same one channels/ussd.js uses) so
// ASR/LLM/DB/TTS/alerts only live in one place.
//
// Guided mode collects answers via buttons and free-text prompts, then
// combines them into one natural-language block submitted through the
// SAME processReport() path text/voice use — buildCase() still does the
// real extraction/categorization, so there's no separate field-assignment
// logic to keep in sync with it. A customer can also just send a voice
// note or type directly at any point without tapping through the mode
// menu first — it's an offered shortcut, not a gate.
//
// Conversation UX (language choice, mode-agnostic message handling,
// restart) added on top of the original voice/text implementation, closing
// the "webhook isn't signature-verified yet" item from the README's Known
// Issues along the way (see middleware/verifySignature.js + server.js).

import { processReport, withCustomerLock } from "../services/reportPipeline.js";
import { getCaseForCustomer, getOpenCaseForCustomer, getCasesForCustomer } from "../db/cases.js";
import { createCallbackRequest } from "../db/callbacks.js";
import { REQUIRED_FIELDS } from "../services/llm.js";
import { synthesizeSpeech } from "../services/tts.js";

const GRAPH_API_VERSION = "v21.0";
const CASE_ID_PATTERN = /^KB-[0-9A-F]{12}$/i;

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

/**
 * Sends a plain text WhatsApp message.
 *
 * Never throws — a network-level failure reaching Meta (DNS, a dead
 * connection, a timeout — anything below the HTTP layer, as opposed to
 * Meta responding with a non-ok status) used to propagate as a rejected
 * promise. That's fatal by default in Node: an unhandled rejection
 * crashes the whole process. This function is frequently called from
 * error-handling code itself (e.g. handleIncomingMessage's catch block,
 * reporting an earlier failure back to the customer) — so a transient
 * network blip while trying to report a DIFFERENT transient network blip
 * took down the entire backend, not just that one message. Every send
 * function below has the same fix, for the same reason.
 */
export async function sendWhatsAppText(to, body) {
  try {
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
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppText network error (message not delivered):", err.message);
  }
}

/** Sends up to 3 tappable buttons (WhatsApp's limit for this message type). Never throws — see sendWhatsAppText. */
export async function sendWhatsAppButtons(to, bodyText, buttons) {
  try {
    const response = await fetch(graphUrl(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
        },
      }),
    });
    if (!response.ok) {
      console.error("[whatsapp] sendWhatsAppButtons failed:", await response.text());
    }
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppButtons network error (message not delivered):", err.message);
  }
}

/** Uploads an audio buffer as WhatsApp media, then sends it to `to`. Never throws — see sendWhatsAppText. */
export async function sendWhatsAppAudio(to, audioBuffer) {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    // Must match the format reportPipeline.js actually requests from Khaya
    // (mp3) — WhatsApp's media upload rejects audio/wav outright.
    form.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "confirmation.mp3");

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
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppAudio network error (audio not delivered):", err.message);
  }
}

/**
 * Downloads an incoming WhatsApp voice note by its media id. Exported so
 * server.js's dashboard audio-playback route can re-fetch the same media
 * later using an id stored in the case's audio_refs — a WhatsApp media id
 * is a durable reference, but the one-time download URL it resolves to
 * expires quickly, so it can't be stored directly and played back as-is.
 */
export async function downloadWhatsAppMedia(mediaId) {
  const metaResponse = await fetch(graphUrl(mediaId), { headers: authHeaders() });
  const meta = await metaResponse.json();
  if (!metaResponse.ok) {
    throw new Error(`Failed to look up media ${mediaId}: ${JSON.stringify(meta)}`);
  }

  const fileResponse = await fetch(meta.url, { headers: authHeaders() });
  const arrayBuffer = await fileResponse.arrayBuffer();
  // Pass WhatsApp's exact mime type through unchanged — including the
  // "; codecs=opus" parameter. This used to be stripped, on the theory
  // that Khaya's ASR API had rejected the full string with "invalid
  // parameters" — but a live side-by-side test (same bytes, only the
  // Content-Type header changed) showed the STRIPPED bare "audio/ogg"
  // takes ~35s to process, while the FULL "audio/ogg; codecs=opus" takes
  // well under a second: Khaya's backend appears to need that parameter
  // to pick a fast decode path, and falls back to something far slower
  // without it. The original "invalid parameters" error (which prompted
  // the stripping in the first place) was almost certainly actually
  // caused by a bad language code sent alongside it in that same fix,
  // never isolated at the time — see toKhayaLanguageCode-equivalent
  // handling in this file/reportPipeline.js.
  const mimeType = meta.mime_type || "audio/ogg";
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

// Per-customer conversation UX state: which language they picked. This is
// NOT the report data itself (that's the case row in SQLite, via
// db/cases.js) — it's short-lived chat state, so an in-memory Map is fine
// and avoids a schema change to the shared database. It resets on a server
// restart; getLanguage() below falls back to an in-progress case's own
// stored language first, so a customer mid-conversation isn't re-asked.
const languageByCustomer = new Map();

// Tracks a customer we've asked "what's the suspect's number?" as one last
// question after their report was otherwise already complete. Keyed by
// phone, value is the case_id being completed. Same in-memory/reset-on-
// restart tradeoff as languageByCustomer above.
const pendingNumberFollowUp = new Map();

// Same as pendingNumberFollowUp, but for "what's the suspect's email?" —
// asked instead of the phone-number question for a Phishing-category case,
// since a phishing scam is normally identified by the sender's email/link,
// not a phone number.
const pendingEmailFollowUp = new Map();

// Tracks a customer mid-guided-flow: { step, answers }. Same in-memory/
// reset-on-restart tradeoff as the maps above — a restart mid-guided-flow
// just starts over, which is fine.
const guidedFlowByCustomer = new Map();

// Customers who get the bot's questions read aloud as voice notes (in
// addition to the normal text — never instead of it, so a deaf or
// hard-of-hearing customer isn't shut out). Turned on by choosing Voice or
// sending a voice note; off again for Text/Guided, restart, or a finished
// case. WhatsApp never auto-plays a bot's audio: the first voice note needs
// one tap, after which WhatsApp plays consecutive ones back to back.
const voiceReplyByCustomer = new Set();

// Where a customer is in the read-back-and-confirm step, once their report is
// complete: { caseId, alert, at, stage }. stage "confirm" = shown a summary,
// waiting for Yes/Change; "correct" = asked to change something, waiting for
// the fix. The fraud `alert` (warnings to other customers) is held back until
// they confirm. Same in-memory tradeoff as the maps above; the case itself is
// already saved in SQLite, so losing this on a restart loses nothing.
const reviewByCustomer = new Map();
const REVIEW_TTL_MS = 30 * 60 * 1000;
const AFFIRMATIVE = /^(yes|yeah|yep|ok|okay|correct|right|aane|yiw|yoo|ɛyɛ|eyɛ)[.!\s]*$/i;

// Khaya's voices can't read numerals or Latin letters: a round trip through
// Khaya's own speech recognition heard a Twi "9 F F D" as "ba-da-da-da-da…",
// and English "4 8 1" as gibberish too. Digits written out as words came
// back word-for-word in both languages, so everything spoken uses words.
const DIGIT_WORDS = {
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
  // "zero" for 0, not a Twi word: recognition heard "hwee" as "hwɛ".
  tw: ["zero", "baako", "mmienu", "mmiɛnsa", "ɛnan", "enum", "nsia", "nson", "nwɔtwe", "nkron"],
};
// Only matter for older hex-style case ids (new ones are digits only).
const LETTER_WORDS = {
  en: { A: "ay", B: "bee", C: "see", D: "dee", E: "ee", F: "eff", K: "kay" },
  tw: { A: "ee", B: "bi", C: "si", D: "di", E: "i", F: "ɛf", K: "kei" },
};

/**
 * A case number as speakable words, in groups of three so the customer can
 * follow and note it down: "KB-481902773506" ->
 * en: "kay bee. four, eight, one. nine, zero, two. seven, seven, three. five, zero, six"
 * tw: "ɛnan, nwɔtwe, baako. nkron, zero, mmienu. nson, nson, mmiɛnsa. enum, zero, nsia"
 * The "KB" prefix is only spoken in English — English letters weren't
 * intelligible in the Twi voice (the full number is always in the text too).
 */
export function spellOutCaseId(caseId, lang = "en") {
  const [prefix, rest = ""] = String(caseId).toUpperCase().split("-");
  const say = (ch) => (/\d/.test(ch) ? DIGIT_WORDS[lang][Number(ch)] : (LETTER_WORDS[lang][ch] ?? ch.toLowerCase()));
  const groups = (rest.match(/.{1,3}/g) ?? []).map((g) => [...g].map(say).join(", "));
  const head = lang === "en" ? [[...prefix].map(say).join(" ")] : [];
  return [...head, ...groups].join(". ");
}

export function sanitizeForSpeech(text, lang) {
  let out = text
    .replace(/\p{Extended_Pictographic}/gu, "")
    // "(e.g. 500)" style examples: not worth speaking, and numerals garble
    .replace(/\([^)]*\)/g, "")
    .replace(/["“”]/g, "");
  // Any numeral left in Twi speech would come out as gibberish — read it digit by digit.
  if (lang === "tw") out = out.replace(/\d/g, (d) => ` ${DIGIT_WORDS.tw[Number(d)]} `);
  return out.replace(/\s+/g, " ").replace(/\s+([.,?!])/g, "$1").trim();
}

// Never rejects: a slow or failing TTS call (Khaya's latency varies a lot)
// must not stop the customer getting their message.
function startSpeech(lang, text) {
  return synthesizeSpeech(sanitizeForSpeech(text, lang), {
    format: "mp3", // WhatsApp's media upload rejects Khaya's default wav
    language: lang === "tw" ? "twi" : "eng",
  }).catch((err) => {
    console.error("[whatsapp] voice reply failed, continuing with text only:", err.message);
    return null;
  });
}

// Text first, audio right behind it: synthesis runs WHILE the text goes
// out, so a slow Khaya only delays the audio, never the message itself.
// speechText null/undefined = text only.
async function sendTextThenSpeech(to, lang, speechText, sendText) {
  const speech = speechText ? startSpeech(lang, speechText) : null;
  await sendText();
  const audio = speech ? await speech : null;
  if (audio) await sendWhatsAppAudio(to, audio);
}

// Meta retries a webhook delivery if it never gets a 200 response back in
// time — every retry resends the EXACT same message. This normally isn't
// visible, but if the server was ever briefly unreachable (a crash, a
// deploy, the network issue fixed earlier), a retry can land minutes
// later on a now-working server and get reprocessed as if it just
// arrived — a stray "restart" firing with no message from the customer
// is exactly this: an old retried command replaying after they'd already
// moved on. Tracks message ids we've already handled (id -> first-seen
// timestamp) so a replay is silently ignored instead of reprocessed;
// cleaned up after MESSAGE_ID_TTL_MS so this doesn't grow forever.
const processedMessageIds = new Map();
const MESSAGE_ID_TTL_MS = 24 * 60 * 60 * 1000; // 24h — generous vs. Meta's own retry window

export function isDuplicateMessage(messageId) {
  const now = Date.now();
  for (const [id, seenAt] of processedMessageIds) {
    if (now - seenAt > MESSAGE_ID_TTL_MS) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
}

function getLanguage(from, openCase) {
  if (languageByCustomer.has(from)) return languageByCustomer.get(from);
  if (openCase?.language === "twi") return "tw";
  if (openCase?.language === "english") return "en";
  return null;
}

export const TEXT = {
  en: {
    modeChoicePrompt:
      "Okay — we'll continue in English.\n\nHow would you like to report the incident? (Or just send a voice note or type your report directly, anytime.)",
    modeButtons: [
      { id: "mode_voice", title: "🎤 Voice" },
      { id: "mode_text", title: "✍️ Text" },
      { id: "mode_guided", title: "📋 Guided" },
    ],
    askVoice: "Please send a voice note describing what happened.",
    askText: "Please describe what happened.",
    processingVoice: "Got your voice note — transcribing it now. This can take a minute or two for longer recordings, please hold on.",
    voiceTimedOut: "Sorry, that recording is taking too long to process (it may be quite long, or our connection is slow right now). Please try sending it again, or type your report instead.",
    statusFound: (found) => `Case ${found.case_id}: status is "${found.status}".`,
    statusNotFound: "We couldn't find that case number for your phone number.",
    unsupportedMessage: "Sorry, I can only understand voice notes or text messages right now.",
    guidedNeedsAnswer: "Please tap one of the options above, or type your answer.",
    genericError: "Something went wrong processing your report. Please try again.",
    fallbackFollowUp: "Could you give me a bit more detail about what happened?",
    askSuspectedNumber: "Do you have the phone number the fraudster used? If you don't know it, just reply \"unknown\".",
    askSuspectedEmail: "Do you have the email address that sent it? If you don't know it, just reply \"unknown\".",
    confirmation: (id) => `Thank you. Your case number is ${id}. We've recorded your report.`,
    askSuspectedNumberSpeech: "Do you have the phone number the fraudster used? If you don't know it, just say you don't know.",
    askSuspectedEmailSpeech: "Do you have the email address that sent it? If you don't know it, just say you don't know.",
    confirmationSpeech: (id) => `Thank you. Your case number is ${spellOutCaseId(id, "en")}. I will repeat it. ${spellOutCaseId(id, "en")}. We have recorded your report.`,
    restarted: "Okay, let's start over.",
    restartButton: [{ id: "restart", title: "🔄 Restart" }],

    helpPrompt: "Already reported something? Check on your cases, or ask our team to call you back.",
    helpButtons: [
      { id: "menu_cases", title: "📂 My cases" },
      { id: "menu_callback", title: "📞 Call me back" },
    ],
    callbackButton: [{ id: "menu_callback", title: "📞 Call me back" }],
    callbackRequested: "Done. We've passed your number to our team, and someone will call you back.",
    callbackAlready: "You've already asked for a call back. Our team has your number and will call you.",
    voiceUnclear: "Sorry, I couldn't understand that recording. You can try again, type your report instead, or ask our team to call you back.",
    noCases: "You haven't reported anything with this number yet.",
    casesHeader: "Your most recent cases:",
    statusLabels: { received: "Received", under_review: "Under review", resolved: "Resolved" },
    statusSpoken: { received: "we have received it", under_review: "our team is reviewing it", resolved: "it has been resolved" },
    unfinished: "report not finished",
    casesSpeech: (spelledId, status) => `Your most recent case number is ${spelledId}. ${status}.`,

    readBackIntro: "Here's what I understood:",
    readBackLabels: { type: "Type", amount: "Amount", when: "When", suspect: "Suspect", what: "What happened" },
    readBackQuestion: "Is this correct?",
    readBackSpeech: (c) => `Here is what I understood. ${c.fraud_category}. About ${c.amount} cedis. ${c.incident_date}. Is this correct? Tap yes, or tap change it.`,
    confirmButtons: [
      { id: "confirm_yes", title: "✅ Yes, correct" },
      { id: "confirm_no", title: "✏️ Change it" },
    ],
    askCorrection: "Okay. Tell me what to fix, by voice note or text. For example: \"the amount was 500\".",
  },
  tw: {
    modeChoicePrompt:
      "Ɛyɛ — yɛbɛkɔ so wɔ Twi mu.\n\nƐkwan bɛn na wopɛ sɛ wobɔ wo amanneɛ? (Anaasɛ fa wo nne kyerɛ anaasɛ kyerɛw wo amanneɛbɔ tee, bere biara a wobɛpɛ.)",
    modeButtons: [
      { id: "mode_voice", title: "🎤 Kasa" },
      { id: "mode_text", title: "✍️ Kyerɛw" },
      { id: "mode_guided", title: "📋 Nsɛmmisa" },
    ],
    askVoice: "Mesrɛ wo, fa wo nne kyerɛ deɛ ɛsii.",
    askText: "Mesrɛ wo, kyerɛw deɛ ɛsii.",
    processingVoice: "Yɛanya wo nne — yɛretwerɛ mu seesei. Ebia ɛbɛgye simma kakraa sɛ ɛyɛ tenten a, mesrɛ wo twɛn.",
    voiceTimedOut: "Yɛpa wo kyɛw, saa nne yi gye bere tenten dodo sɛ yɛretwerɛ mu (ebia ɛware, anaasɛ yɛn connection no yɛ brɛoo seesei). Mesrɛ wo, sɔ hwɛ bio, anaasɛ kyerɛw wo amanneɛbɔ mmom.",
    statusFound: (found) => `Case ${found.case_id}: gyinabea ne "${found.status}".`,
    statusNotFound: "Yɛanhu case a saa number no wɔ wo telefon number no ho.",
    unsupportedMessage: "Yɛpa wo kyɛw, mate wo nne anaa wo nkrasɛm nko ara.",
    guidedNeedsAnswer: "Mesrɛ wo, paw nea ɛwɔ soro ha, anaasɛ kyerɛw wo mmuae.",
    genericError: "Biribi ankɔ yie wɔ wo amanneɛbɔ no ho adwuma mu. Yɛsrɛ wo, sɔ hwɛ bio.",
    fallbackFollowUp: "Wobɛtumi aka deɛ ɛsii no mu nsɛm bi akyerɛ me?",
    askSuspectedNumber: "Wowɔ telefon nɔma a nsisifoɔ no de yɛɛ eyi? Sɛ wonnim a, kyerɛw \"unknown\".",
    // Best-effort Twi phrasing — worth a native-speaker review, like the
    // rest of this file's Twi text.
    askSuspectedEmail: "Wowɔ email address a nsisifoɔ no de somaa wo saa nkra no? Sɛ wonnim a, kyerɛw \"unknown\".",
    confirmation: (id) => `Meda wo ase. Wo case number ne ${id}. Yɛasie wo amanneɛbɔ no.`,
    // Spoken versions avoid English words and the quoted "unknown": the Twi
    // voice mangled them ("unknown" was heard as "nkron"; "case number" as
    // "kasanum ba"), while plain Twi words came back intact.
    askSuspectedNumberSpeech: "Wowɔ telefon nɔma a nsisifoɔ no de yɛɛ eyi? Sɛ wonnim a, ka sɛ wonnim.",
    askSuspectedEmailSpeech: "Wowɔ email address a nsisifoɔ no de somaa wo saa nkra no? Sɛ wonnim a, ka sɛ wonnim.",
    confirmationSpeech: (id) => `Meda wo ase. Wo amanneɛbɔ nɔma ne ${spellOutCaseId(id, "tw")}. Mɛka bio. ${spellOutCaseId(id, "tw")}. Yɛasie wo amanneɛbɔ no.`,
    restarted: "Ɛyɛ, momma yɛnhyɛ aseɛ bio.",
    restartButton: [{ id: "restart", title: "🔄 Hyɛ Aseɛ Bio" }],

    // All of the Twi below is best-effort — worth a native-speaker review.
    helpPrompt: "Wobɔɔ biribi dedaw? Hwɛ wo amanneɛbɔ no, anaasɛ srɛ sɛ yɛn adwumayɛfoɔ mfrɛ wo.",
    helpButtons: [
      { id: "menu_cases", title: "📂 Me nsɛm" },
      { id: "menu_callback", title: "📞 Frɛ me" },
    ],
    callbackButton: [{ id: "menu_callback", title: "📞 Frɛ me" }],
    callbackRequested: "Ɛyɛ. Yɛde wo nɔma ama yɛn adwumayɛfoɔ, na obi bɛfrɛ wo.",
    callbackAlready: "Woasrɛ dedaw sɛ yɛmfrɛ wo. Yɛn adwumayɛfoɔ wɔ wo nɔma, na wɔbɛfrɛ wo.",
    voiceUnclear: "Yɛpa wo kyɛw, yɛante saa nne yi ase. Sɔ hwɛ bio, anaasɛ kyerɛw wo amanneɛbɔ, anaasɛ srɛ sɛ yɛmfrɛ wo.",
    noCases: "Wonnyaa amanneɛbɔ biara wɔ saa nɔma yi so.",
    casesHeader: "Wo amanneɛbɔ a ɛfiri nnansa yi:",
    statusLabels: { received: "Yɛanya", under_review: "Yɛrehwɛ mu", resolved: "Ɛyɛ awie" },
    statusSpoken: { received: "Yɛanya no", under_review: "Yɛrehwɛ mu", resolved: "Yɛayɛ awie" },
    unfinished: "amanneɛbɔ no nnwie",
    casesSpeech: (spelledId, status) => `Wo amanneɛbɔ nɔma a ɛtwa toɔ ne ${spelledId}. ${status}.`,

    readBackIntro: "Deɛ mate ne yei:",
    readBackLabels: { type: "Nsisi no", amount: "Sika dodoɔ", when: "Da", suspect: "Nea ɔyɛɛ", what: "Deɛ ɛsii" },
    readBackQuestion: "Ɛyɛ nokorɛ?",
    readBackSpeech: () => "Yɛatwerɛ deɛ woaka no. Sɛ ɛyɛ nokorɛ a, mia Aane. Sɛ ɛnyɛ a, mia Sesa bi.",
    confirmButtons: [
      { id: "confirm_yes", title: "✅ Aane, ɛyɛ" },
      { id: "confirm_no", title: "✏️ Sesa bi" },
    ],
    askCorrection: "Ɛyɛ. Kyerɛ me deɛ ɛsɛ sɛ yɛsesa, fa wo nne anaasɛ kyerɛw.",
  },
};

// Guided mode's own questions (buttons for coarse choices, free text for
// the rest). Answers get combined into one natural-language block and
// submitted through the exact same runReportTurn() text/voice already
// use — buildCase() extracts fraud_category etc. from that combined text,
// same as it would from anything a customer typed directly.
const GUIDED_QUESTIONS = {
  en: [
    {
      key: "what",
      prompt: "What happened?",
      buttons: [
        { id: "g_called", title: "Someone called me" },
        { id: "g_message", title: "Someone messaged me" },
        { id: "g_money_taken", title: "Money was taken" },
      ],
    },
    {
      key: "when",
      prompt: "When did this happen?",
      buttons: [
        { id: "g_today", title: "Today" },
        { id: "g_yesterday", title: "Yesterday" },
        { id: "g_this_week", title: "This week" },
      ],
    },
    { key: "amount", prompt: "How much money was involved? (e.g. 500)", buttons: null },
  ],
  tw: [
    {
      key: "what",
      prompt: "Ɛdeɛn na ɛsii?",
      buttons: [
        { id: "g_called", title: "Obi frɛɛ me" },
        { id: "g_message", title: "Obi soma me nkra" },
        { id: "g_money_taken", title: "Wɔfaa sika" },
      ],
    },
    {
      key: "when",
      prompt: "Da bɛn na ɛsii yi?",
      buttons: [
        { id: "g_today", title: "Ɛnnɛ" },
        { id: "g_yesterday", title: "Ɛnnɛra" },
        { id: "g_this_week", title: "Saa dapɛn yi" },
      ],
    },
    { key: "amount", prompt: "Sika dodoɔ sɛn na ɛkɔɔ mu? (sɛ nhwɛso, 500)", buttons: null },
  ],
};

// Turns a guided-flow button tap into the phrase combined into the report
// text handed to buildCase() — always in English, matching llm.js's own
// English-language extraction (see its system prompt), regardless of
// which language the guided-mode buttons were shown in.
//
// These are deliberately more specific than the button labels themselves
// ("Someone called me" alone, not "pretending to be my bank") — confirmed
// via direct testing against the real extraction API: the short/vague
// version left fraud_category null or "Other" inconsistently (Claude has
// too little to go on), while this phrasing reliably resolves to a real
// category (Impersonation / Phishing / Mobile Money Fraud) every time.
// Without this, guided mode would ask a redundant "what type of fraud
// was this?" follow-up almost every time, despite the customer having
// already told us via the button they tapped.
const GUIDED_ANSWER_PHRASES = {
  g_called: "Someone called me pretending to be from my bank or MTN, impersonating them",
  g_message: "Someone sent me a suspicious message or link trying to steal my information",
  g_money_taken: "Money was taken from my mobile money account without my authorization",
  g_today: "today",
  g_yesterday: "yesterday",
  g_this_week: "this week",
};

// The LLM's own follow_up_questions are always written in Twi (see
// llm.js's SYSTEM_PROMPT) — buildCase() isn't language-aware. Rather than
// touch the shared prompt (which ussd.js also depends on), an English
// customer gets these instead; a Twi customer still gets the LLM's own
// (better, context-aware) question.
const FOLLOW_UP_QUESTIONS_EN = {
  incident_summary: "Please briefly describe what happened.",
  incident_date: "What date did this happen? (e.g. 10 September)",
  amount: "What amount of money was involved? (e.g. 500)",
  fraud_category: "What type of fraud was this? (e.g. impersonation, phishing, mobile money fraud)",
};

/** Picks the single most important missing field to ask about next (one question at a time). */
export function nextFollowUpQuestion(missingFields, followUpQuestions, lang) {
  const nextField = REQUIRED_FIELDS.find((field) => missingFields.includes(field));
  if (!nextField) return null;
  if (lang === "en") return FOLLOW_UP_QUESTIONS_EN[nextField] || followUpQuestions[nextField];
  return followUpQuestions[nextField];
}

// Every message that expects the customer to answer something (a
// follow-up question, "describe what happened", an error they might feel
// stuck on) carries a Restart button — otherwise handleIncomingMessage's
// restart handling exists but is never actually reachable, since nothing
// ever shows the customer that it's an option.
//
// Voice-mode customers are the one exception: plain text only, no buttons.
// Testing with blind students at Akropong School for the Blind found the
// on-screen keyboard kept popping up while they tried to record a voice
// note, on both TalkBack (Android) and VoiceOver (iPhone) — right after a
// button message like this one. Typing "restart" still works with no
// button shown (see handleIncomingMessage), and a voice-mode customer
// wasn't going to reliably tap a small button anyway.
async function sendWithRestart(to, lang, bodyText, { spoken = true, speech, extraButtons = [] } = {}) {
  const inVoiceMode = voiceReplyByCustomer.has(to);
  const speechText = spoken && inVoiceMode ? (speech ?? bodyText) : null;
  await sendTextThenSpeech(to, lang, speechText, () =>
    inVoiceMode
      ? sendWhatsAppText(to, bodyText)
      : sendWhatsAppButtons(to, bodyText, [...TEXT[lang].restartButton, ...extraButtons])
  );
}

async function sendLanguageChoice(to) {
  await sendWhatsAppButtons(to, "Welcome 👋 / Akwaaba 👋\n\nPlease choose your language:\nMesrɛ wo paw wo kasa:", [
    { id: "lang_en", title: "English" },
    { id: "lang_tw", title: "Twi" },
  ]);
}

async function sendModeChoice(to, lang) {
  await sendWhatsAppButtons(to, TEXT[lang].modeChoicePrompt, TEXT[lang].modeButtons);
}

async function startGuidedFlow(to, lang) {
  guidedFlowByCustomer.set(to, { step: 0, answers: {} });
  const question = GUIDED_QUESTIONS[lang][0];
  await sendWhatsAppButtons(to, question.prompt, question.buttons);
}

async function sendHelpChoice(to, lang) {
  await sendWhatsAppButtons(to, TEXT[lang].helpPrompt, TEXT[lang].helpButtons);
}

function casesMessage(lang, cases) {
  const t = TEXT[lang];
  const lines = cases.map((c, i) => {
    const what = c.missing_fields.length > 0 ? t.unfinished : c.fraud_category;
    return `${i + 1}. ${c.case_id} — ${what} — ${t.statusLabels[c.status] ?? c.status}`;
  });
  return [t.casesHeader, ...lines].join("\n");
}

// "My cases": the customer's phone number already identifies them, so they
// never have to type, dictate or remember a case number to check on one.
async function sendMyCases(from, lang) {
  const t = TEXT[lang];
  const cases = getCasesForCustomer(from, 3);
  const voice = voiceReplyByCustomer.has(from);
  if (cases.length === 0) {
    await sendTextThenSpeech(from, lang, voice ? t.noCases : null, () => sendWhatsAppText(from, t.noCases));
    return;
  }
  const latest = cases[0];
  const speech = voice ? t.casesSpeech(spellOutCaseId(latest.case_id, lang), t.statusSpoken[latest.status]) : null;
  await sendTextThenSpeech(from, lang, speech, () => sendWhatsAppText(from, casesMessage(lang, cases)));
}

// The human fallback: for anyone the voice pipeline can't serve.
async function handleCallbackRequest(from, lang) {
  const t = TEXT[lang];
  const { alreadyPending } = createCallbackRequest({ customer_contact: from, language: lang === "tw" ? "twi" : "english" });
  const message = alreadyPending ? t.callbackAlready : t.callbackRequested;
  await sendTextThenSpeech(from, lang, voiceReplyByCustomer.has(from) ? message : null, () => sendWhatsAppText(from, message));
}

function readBackMessage(lang, c) {
  const t = TEXT[lang];
  const l = t.readBackLabels;
  const summary = c.incident_summary.length > 400 ? `${c.incident_summary.slice(0, 400)}…` : c.incident_summary;
  const lines = [t.readBackIntro, "", `• ${l.type}: ${c.fraud_category}`, `• ${l.amount}: GHS ${c.amount}`, `• ${l.when}: ${c.incident_date}`];
  const suspect = c.suspected_number || c.suspected_email;
  if (suspect) lines.push(`• ${l.suspect}: ${suspect}`);
  lines.push(`• ${l.what}: ${summary}`, "", t.readBackQuestion);
  return lines.join("\n");
}

// Reads the report back before it's final, so a wrong transcription or a
// misheard amount gets caught by the customer instead of reaching MTN staff.
async function sendReadBack(from, lang, result) {
  const t = TEXT[lang];
  reviewByCustomer.set(from, { caseId: result.case_id, alert: result.alert, at: Date.now(), stage: "confirm" });
  const speech = voiceReplyByCustomer.has(from) ? t.readBackSpeech(result.case) : null;
  await sendTextThenSpeech(from, lang, speech, () =>
    sendWhatsAppButtons(from, readBackMessage(lang, result.case), [...t.confirmButtons, ...t.restartButton])
  );
}

// The customer confirmed: the conversation is genuinely over, so clear the
// cached language (their next message, e.g. a casual "hi", starts fresh with
// the language prompt instead of being treated as more report text) and voice
// mode, then send the case number and any fraud warnings.
async function completeReport(from, lang, caseId, alert) {
  const t = TEXT[lang];
  languageByCustomer.delete(from);
  const wantsVoice = voiceReplyByCustomer.delete(from);

  await sendTextThenSpeech(from, lang, wantsVoice ? t.confirmationSpeech(caseId) : null, () =>
    sendWhatsAppText(from, t.confirmation(caseId))
  );

  if (alert?.type === "individual") {
    for (const alertMessage of alert.messages) {
      await sendWhatsAppText(alertMessage.to, alertMessage.text);
    }
  } else if (alert?.type === "mtn_escalation") {
    // No live channel to MTN staff yet (dashboard has no notification feed) —
    // logged for now so it's at least visible in the server console.
    console.warn("[whatsapp] MTN escalation:", alert.notice);
  }
}

// Falls back to their latest case if the server restarted between the
// read-back and their tap (the review state is in memory only).
function reviewedCaseId(from) {
  return reviewByCustomer.get(from)?.caseId ?? getCasesForCustomer(from, 1)[0]?.case_id ?? null;
}

async function finalizeReport(from, lang) {
  const review = reviewByCustomer.get(from);
  const caseId = reviewedCaseId(from);
  reviewByCustomer.delete(from);
  if (!caseId) {
    await sendWithRestart(from, lang, TEXT[lang].statusNotFound);
    return;
  }
  await completeReport(from, lang, caseId, review?.alert ?? null);
}

async function startCorrection(from, lang) {
  const caseId = reviewedCaseId(from);
  if (!caseId) {
    await sendWithRestart(from, lang, TEXT[lang].statusNotFound);
    return;
  }
  reviewByCustomer.set(from, { caseId, alert: reviewByCustomer.get(from)?.alert ?? null, at: Date.now(), stage: "correct" });
  await sendWithRestart(from, lang, TEXT[lang].askCorrection);
}

async function handleCorrection(from, lang, message, typedText) {
  const common = {
    from, lang, caseId: reviewedCaseId(from), correction: true,
    // Already asked once; a fix shouldn't trigger the optional questions again.
    skipNumberFollowUp: true, skipEmailFollowUp: true,
  };
  if (message.type === "audio") {
    const { buffer, mimeType } = await downloadWhatsAppMedia(message.audio.id);
    await runReportTurn({ ...common, audioBuffer: buffer, contentType: mimeType, input_mode: "voice", audioRef: message.audio.id });
  } else {
    await runReportTurn({ ...common, text: typedText, input_mode: "text" });
  }
}

// A read-back the customer walked away from shouldn't swallow a message sent
// hours later: after a while, forget it so their next message starts fresh.
function expireStaleReview(from) {
  const review = reviewByCustomer.get(from);
  if (review && Date.now() - review.at > REVIEW_TTL_MS) {
    reviewByCustomer.delete(from);
    languageByCustomer.delete(from);
    voiceReplyByCustomer.delete(from);
  }
}

/** Handles one answer within an in-progress guided flow, for `from`. */
async function handleGuidedAnswer(from, lang, message, typedText, buttonId) {
  const t = TEXT[lang];
  const state = guidedFlowByCustomer.get(from);
  const questions = GUIDED_QUESTIONS[lang];
  const question = questions[state.step];

  // A button tap is preferred when it matches this question's own
  // options, but typing an answer instead (bypassing the buttons) works
  // too — same leniency as the rest of this file.
  let answerPhrase;
  if (buttonId && question.buttons?.some((b) => b.id === buttonId)) {
    answerPhrase = GUIDED_ANSWER_PHRASES[buttonId] ?? buttonId;
  } else if (message.type === "text" && typedText) {
    answerPhrase = typedText;
  } else {
    await sendWithRestart(from, lang, t.guidedNeedsAnswer);
    return;
  }

  const answers = { ...state.answers, [question.key]: answerPhrase };
  const nextStep = state.step + 1;

  if (nextStep >= questions.length) {
    guidedFlowByCustomer.delete(from);
    // One natural-language block, same shape buildCase() already handles
    // for a typed report — no separate extraction logic needed here.
    const combinedText = `${answers.what}. This happened ${answers.when}. The amount involved was ${answers.amount}.`;
    await runReportTurn({ from, text: combinedText, input_mode: "guided", lang });
    return;
  }

  guidedFlowByCustomer.set(from, { step: nextStep, answers });
  const nextQuestion = questions[nextStep];
  if (nextQuestion.buttons) {
    await sendWhatsAppButtons(from, nextQuestion.prompt, nextQuestion.buttons);
  } else {
    await sendWithRestart(from, lang, nextQuestion.prompt);
  }
}

/**
 * Main WhatsApp webhook handler. Meta POSTs here for every incoming message
 * (and other events, like delivery statuses, which we ignore).
 */
export async function handleIncomingMessage(req, res) {
  res.sendStatus(200); // ack immediately; Meta expects a fast response

  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return; // not an incoming message (e.g. a status update)

  if (message.id && isDuplicateMessage(message.id)) {
    console.log("[whatsapp] Ignoring a retried/duplicate webhook for message", message.id);
    return;
  }

  const from = message.from;
  const buttonId = message.type === "interactive" ? message.interactive?.button_reply?.id : null;

  try {
    expireStaleReview(from);

    // Language choice, and "restart" (typed or tapped), work at any point —
    // they don't require or interrupt an in-progress report.
    if (buttonId === "lang_en" || buttonId === "lang_tw") {
      const lang = buttonId === "lang_tw" ? "tw" : "en";
      languageByCustomer.set(from, lang);
      await sendModeChoice(from, lang);
      await sendHelpChoice(from, lang);
      return;
    }

    const typedText = message.type === "text" ? message.text.body.trim() : "";
    if (buttonId === "restart" || typedText.toLowerCase() === "restart") {
      languageByCustomer.delete(from);
      guidedFlowByCustomer.delete(from);
      pendingNumberFollowUp.delete(from);
      pendingEmailFollowUp.delete(from);
      reviewByCustomer.delete(from);
      voiceReplyByCustomer.delete(from);
      const lang = getLanguage(from, null) || "en";
      await sendWhatsAppText(from, TEXT[lang].restarted);
      await sendLanguageChoice(from);
      return;
    }

    const openCase = getOpenCaseForCustomer(from);
    let lang = getLanguage(from, openCase);
    if (!lang) {
      await sendLanguageChoice(from);
      return;
    }
    const t = TEXT[lang];

    if (message.type === "audio") voiceReplyByCustomer.add(from);

    if (buttonId === "menu_cases") {
      await sendMyCases(from, lang);
      return;
    }
    if (buttonId === "menu_callback") {
      await handleCallbackRequest(from, lang);
      return;
    }
    if (buttonId === "confirm_yes") {
      await finalizeReport(from, lang);
      return;
    }
    if (buttonId === "confirm_no") {
      await startCorrection(from, lang);
      return;
    }

    if (buttonId === "mode_voice" || buttonId === "mode_text") {
      if (buttonId === "mode_voice") voiceReplyByCustomer.add(from);
      else voiceReplyByCustomer.delete(from);
      await sendWithRestart(from, lang, buttonId === "mode_voice" ? t.askVoice : t.askText);
      return;
    }

    if (buttonId === "mode_guided") {
      voiceReplyByCustomer.delete(from);
      await startGuidedFlow(from, lang);
      return;
    }

    if (guidedFlowByCustomer.has(from)) {
      await handleGuidedAnswer(from, lang, message, typedText, buttonId);
      return;
    }

    // Shown a read-back (or told to change something): a typed "yes" confirms,
    // and any other text or voice note is the correction — so nobody is forced
    // to find and tap a button.
    if (reviewByCustomer.has(from) && !CASE_ID_PATTERN.test(typedText)) {
      if (message.type === "text" && reviewByCustomer.get(from).stage === "confirm" && AFFIRMATIVE.test(typedText)) {
        await finalizeReport(from, lang);
        return;
      }
      if (message.type === "text" || message.type === "audio") {
        await handleCorrection(from, lang, message, typedText);
        return;
      }
      await sendWithRestart(from, lang, t.unsupportedMessage);
      return;
    }

    // Answering the "what's the suspect's number?" follow-up — this case is
    // otherwise already complete (missing_fields was already empty when we
    // asked), so it's addressed by case_id directly rather than via
    // getOpenCaseForCustomer, which only finds cases still missing a
    // REQUIRED field.
    if (pendingNumberFollowUp.has(from)) {
      if (message.type === "text" || message.type === "audio") {
        const caseId = pendingNumberFollowUp.get(from);
        pendingNumberFollowUp.delete(from);

        if (message.type === "audio") {
          const { buffer, mimeType } = await downloadWhatsAppMedia(message.audio.id);
          await runReportTurn({
            from, audioBuffer: buffer, contentType: mimeType, input_mode: "voice", lang,
            caseId, skipNumberFollowUp: true, audioRef: message.audio.id,
          });
        } else {
          await runReportTurn({ from, text: typedText, input_mode: "text", lang, caseId, skipNumberFollowUp: true });
        }
        return;
      }
      await sendWithRestart(from, lang, t.unsupportedMessage);
      return;
    }

    // Same as the pendingNumberFollowUp block above, but for the "what's the
    // suspect's email?" follow-up asked on a Phishing-category case.
    if (pendingEmailFollowUp.has(from)) {
      if (message.type === "text" || message.type === "audio") {
        const caseId = pendingEmailFollowUp.get(from);
        pendingEmailFollowUp.delete(from);

        if (message.type === "audio") {
          const { buffer, mimeType } = await downloadWhatsAppMedia(message.audio.id);
          await runReportTurn({
            from, audioBuffer: buffer, contentType: mimeType, input_mode: "voice", lang,
            caseId, skipEmailFollowUp: true, audioRef: message.audio.id,
          });
        } else {
          await runReportTurn({ from, text: typedText, input_mode: "text", lang, caseId, skipEmailFollowUp: true });
        }
        return;
      }
      await sendWithRestart(from, lang, t.unsupportedMessage);
      return;
    }

    if (message.type === "text") {
      const body = typedText;

      if (CASE_ID_PATTERN.test(body)) {
        const found = getCaseForCustomer(body.toUpperCase(), from);
        await sendWhatsAppText(from, found ? t.statusFound(found) : t.statusNotFound);
        return;
      }

      await runReportTurn({ from, text: body, input_mode: "text", lang });
      return;
    }

    if (message.type === "audio") {
      const { buffer, mimeType } = await downloadWhatsAppMedia(message.audio.id);
      await runReportTurn({ from, audioBuffer: buffer, contentType: mimeType, input_mode: "voice", lang, audioRef: message.audio.id });
      return;
    }

    await sendWithRestart(from, lang, t.unsupportedMessage);
  } catch (err) {
    console.error("[whatsapp] handleIncomingMessage error:", err);
    const lang = getLanguage(from, null) || "en";
    await sendWithRestart(from, lang, TEXT[lang].genericError);
  }
}

async function runReportTurn({ from, text, audioBuffer, contentType, input_mode, lang, caseId, skipNumberFollowUp = false, skipEmailFollowUp = false, audioRef, correction = false }) {
  const t = TEXT[lang];

  // ASR's own timeout now scales up to several minutes for a long
  // recording (see asr.js) — without this, a customer watching a silent
  // chat for that long would reasonably assume the bot is broken. Carries
  // a Restart button too, since a long wait is exactly when someone might
  // want an escape hatch.
  if (input_mode === "voice") {
    // Text only: speaking this would add a whole TTS round trip before the
    // transcription it's announcing even starts.
    await sendWithRestart(from, lang, t.processingVoice, { spoken: false });
  }

  // Locked so that two near-simultaneous messages from the same customer
  // can't both see "no open case yet" and each create a separate case —
  // see withCustomerLock's comment in reportPipeline.js.
  let result;
  try {
    result = await withCustomerLock(from, async () => {
      const targetCaseId = caseId ?? getOpenCaseForCustomer(from)?.case_id;

      return processReport({
        text,
        audioBuffer,
        contentType,
        customer_contact: from,
        channel: "whatsapp",
        input_mode,
        case_id: targetCaseId,
        language: lang === "tw" ? "twi" : "english",
        audio_ref: audioRef,
        correction,
        // Customer explicitly asked not to receive a spoken readback of
        // their report after getting a case number — this also saves a
        // Khaya TTS call that would otherwise just be discarded unsent.
        synthesizeConfirmation: false,
      });
    });
  } catch (err) {
    // asr.js already retries a timeout internally — this is the *final*
    // failure after all of those, so retrying again here wouldn't help.
    // Give the customer an actual way forward (their case, if one
    // exists, is untouched — they can try again or switch to typing)
    // instead of the generic error every other failure gets.
    if (input_mode === "voice" && /Khaya ASR request timed out/i.test(err.message)) {
      await sendWithRestart(from, lang, t.voiceTimedOut, { extraButtons: t.callbackButton });
      return;
    }
    // Transcription failed or came back empty — the recording was silent, too
    // noisy, speech the recognizer can't handle, or Khaya itself is down or
    // out of quota. Whatever the cause, the customer's way forward is the
    // same: try again, type it instead, or ask for a person to call them.
    if (input_mode === "voice" && /Khaya ASR|No text or audio provided/i.test(err.message)) {
      await sendWithRestart(from, lang, t.voiceUnclear, { extraButtons: t.callbackButton });
      return;
    }
    throw err;
  }

  if (result.missing_fields.length > 0) {
    const question = nextFollowUpQuestion(result.missing_fields, result.follow_up_questions, lang);
    await sendWithRestart(from, lang, question || t.fallbackFollowUp);
    return;
  }

  // Everything required is in, but suspected_number/suspected_email are
  // deliberately optional (see llm.js) — worth one explicit ask since
  // they're the fields alerts.js actually cross-matches repeat scammers on,
  // but only once: skipNumberFollowUp/skipEmailFollowUp is true on the turn
  // answering this very question, so we don't loop asking it forever.
  //
  // A Phishing case is normally identified by the sender's email (or a
  // link), not a phone number, so ask for the email instead of the number
  // for that category — asking for a phone number on a phishing report was
  // confusing customers who had no scammer number to give.
  const isPhishing = result.case.fraud_category === "Phishing";
  if (isPhishing && !skipEmailFollowUp && !result.case.suspected_email) {
    pendingEmailFollowUp.set(from, result.case_id);
    await sendWithRestart(from, lang, t.askSuspectedEmail, { speech: t.askSuspectedEmailSpeech });
    return;
  }
  if (!isPhishing && !skipNumberFollowUp && !result.case.suspected_number) {
    pendingNumberFollowUp.set(from, result.case_id);
    await sendWithRestart(from, lang, t.askSuspectedNumber, { speech: t.askSuspectedNumberSpeech });
    return;
  }
  pendingNumberFollowUp.delete(from);
  pendingEmailFollowUp.delete(from);

  // Everything's in — read it back and let the customer confirm or fix it
  // before it's final. The case number, language reset and fraud warnings
  // all happen in completeReport(), once they say yes.
  await sendReadBack(from, lang, result);
}

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
import { getCaseForCustomer, getOpenCaseForCustomer } from "../db/cases.js";
import { REQUIRED_FIELDS } from "../services/llm.js";

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

const TEXT = {
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
    restarted: "Okay, let's start over.",
    restartButton: [{ id: "restart", title: "🔄 Restart" }],
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
    restarted: "Ɛyɛ, momma yɛnhyɛ aseɛ bio.",
    restartButton: [{ id: "restart", title: "🔄 Hyɛ Aseɛ Bio" }],
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
async function sendWithRestart(to, lang, bodyText) {
  await sendWhatsAppButtons(to, bodyText, TEXT[lang].restartButton);
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
    // Language choice, and "restart" (typed or tapped), work at any point —
    // they don't require or interrupt an in-progress report.
    if (buttonId === "lang_en" || buttonId === "lang_tw") {
      const lang = buttonId === "lang_tw" ? "tw" : "en";
      languageByCustomer.set(from, lang);
      await sendModeChoice(from, lang);
      return;
    }

    const typedText = message.type === "text" ? message.text.body.trim() : "";
    if (buttonId === "restart" || typedText.toLowerCase() === "restart") {
      languageByCustomer.delete(from);
      guidedFlowByCustomer.delete(from);
      pendingNumberFollowUp.delete(from);
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

    if (buttonId === "mode_voice" || buttonId === "mode_text") {
      await sendWithRestart(from, lang, buttonId === "mode_voice" ? t.askVoice : t.askText);
      return;
    }

    if (buttonId === "mode_guided") {
      await startGuidedFlow(from, lang);
      return;
    }

    if (guidedFlowByCustomer.has(from)) {
      await handleGuidedAnswer(from, lang, message, typedText, buttonId);
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

async function runReportTurn({ from, text, audioBuffer, contentType, input_mode, lang, caseId, skipNumberFollowUp = false, skipEmailFollowUp = false, audioRef }) {
  const t = TEXT[lang];

  // ASR's own timeout now scales up to several minutes for a long
  // recording (see asr.js) — without this, a customer watching a silent
  // chat for that long would reasonably assume the bot is broken. Carries
  // a Restart button too, since a long wait is exactly when someone might
  // want an escape hatch.
  if (input_mode === "voice") {
    await sendWithRestart(from, lang, t.processingVoice);
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
      await sendWithRestart(from, lang, t.voiceTimedOut);
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
    await sendWithRestart(from, lang, t.askSuspectedEmail);
    return;
  }
  if (!isPhishing && !skipNumberFollowUp && !result.case.suspected_number) {
    pendingNumberFollowUp.set(from, result.case_id);
    await sendWithRestart(from, lang, t.askSuspectedNumber);
    return;
  }
  pendingNumberFollowUp.delete(from);
  pendingEmailFollowUp.delete(from);

  // The conversation is genuinely over at this point (case complete, no
  // pending follow-up) — clear the cached language so the customer's next
  // message (e.g. a casual "hi" before starting a new report) starts fresh
  // with the language prompt, instead of being silently treated as more
  // report text in whatever language they used last time.
  languageByCustomer.delete(from);

  await sendWhatsAppText(from, t.confirmation(result.case_id));

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

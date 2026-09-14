import "dotenv/config";
import express from "express";
import cors from "cors";
import { transcribeAudio } from "./services/asr.js";
import { buildCase } from "./services/llm.js";
import { synthesizeSpeech } from "./services/tts.js";
import {
  createCase,
  mergeCaseFields,
  updateCaseFields,
  getCaseForCustomer,
  updateCaseStatus,
  getAllCases,
} from "./db/cases.js";
import {
  findMatchingCases,
  buildAlertMessage,
  shouldEscalateToMTN,
  buildMTNEscalationNotice,
} from "./services/alerts.js";

const app = express();
app.use(cors({ origin: process.env.DASHBOARD_ORIGIN || "*" }));
app.use(express.json());

const EMPTY_CASE_FIELDS = {
  incident_summary: null,
  incident_date: null,
  amount: null,
  fraud_category: null,
  suspected_number: null,
  transaction_id: null,
};

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Runs a fraud report (voice or text) through ASR -> LLM, saves/updates the
// case in the DB (creating it on the first message, even if incomplete —
// see the comment in db/cases.js), and TTS's a confirmation once complete.
//
// Metadata comes from the query string (so it works whether the body is
// raw audio or JSON text): customer_contact, channel, input_mode are
// required; case_id is only passed when continuing an existing case
// (e.g. answering a follow-up question).
app.post(
  "/report",
  express.raw({ type: "audio/*", limit: "20mb" }),
  async (req, res) => {
    try {
      const { customer_contact, channel, input_mode, case_id, language } = req.query;

      if (!customer_contact || !channel || !input_mode) {
        return res.status(400).json({ error: "customer_contact, channel, and input_mode are required" });
      }

      let text;
      let audio_ref = null;

      if (req.is("audio/*")) {
        const transcription = await transcribeAudio(req.body, {
          contentType: req.headers["content-type"],
        });
        text = transcription.text;
      } else {
        text = req.body?.text;
      }

      if (!text) {
        return res.status(400).json({ error: "No text or audio provided" });
      }

      const result = await buildCase(text);

      let existingCase = EMPTY_CASE_FIELDS;
      if (case_id) {
        const found = getCaseForCustomer(case_id, customer_contact);
        if (!found) {
          return res.status(404).json({ error: "Case not found" });
        }
        existingCase = found;
      }

      const merged = mergeCaseFields(existingCase, result.case);

      const finalCase = case_id
        ? updateCaseFields(case_id, merged.fields, merged.missing_fields)
        : createCase({
            customer_contact,
            channel,
            input_mode,
            language: language || "twi",
            caseFields: merged.fields,
            missing_fields: merged.missing_fields,
            audio_ref,
          });

      const followUpQuestions = Object.fromEntries(
        Object.entries(result.follow_up_questions).filter(([field]) => merged.missing_fields.includes(field))
      );

      let confirmationAudioBase64 = null;
      let alertInfo = null;

      if (merged.missing_fields.length === 0) {
        const audioBuffer = await synthesizeSpeech(finalCase.incident_summary);
        confirmationAudioBase64 = audioBuffer.toString("base64");

        const otherCases = getAllCases().filter((c) => c.case_id !== finalCase.case_id);
        const matches = findMatchingCases(finalCase, otherCases);
        if (matches.length > 0) {
          alertInfo = shouldEscalateToMTN(matches)
            ? { type: "mtn_escalation", notice: buildMTNEscalationNotice(finalCase, matches) }
            : { type: "individual", messages: matches.map((m) => ({ to: m.customer_contact, text: buildAlertMessage(m) })) };
        }
      }

      res.json({
        case_id: finalCase.case_id,
        case: finalCase,
        missing_fields: merged.missing_fields,
        follow_up_questions: followUpQuestions,
        confirmation_audio_base64: confirmationAudioBase64,
        alert: alertInfo,
      });
    } catch (err) {
      console.error("[/report]", err);
      res.status(500).json({ error: "Something went wrong processing this report. Please try again." });
    }
  }
);

// Secure case status lookup — requires the requester's phone to match the
// case's customer_contact, so a case number alone isn't enough to read it.
app.get("/cases/:caseId", (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ error: "phone query parameter is required" });
  }

  const found = getCaseForCustomer(req.params.caseId, phone);
  if (!found) {
    return res.status(404).json({ error: "Case not found" });
  }

  res.json(found);
});

// For the MTN dashboard: change a case's status.
app.patch("/cases/:caseId/status", (req, res) => {
  try {
    const updated = updateCaseStatus(req.params.caseId, req.body?.status);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KasaBaako backend running on port ${PORT}`);
});

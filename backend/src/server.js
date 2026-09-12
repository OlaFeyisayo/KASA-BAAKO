import "dotenv/config";
import express from "express";
import cors from "cors";
import { transcribeAudio } from "./services/asr.js";
import { buildCase } from "./services/llm.js";
import { synthesizeSpeech } from "./services/tts.js";

const app = express();
app.use(cors({ origin: process.env.DASHBOARD_ORIGIN || "*" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Runs a fraud report (voice or text) through ASR -> LLM -> TTS in one call.
// Adlai's whatsapp.js/ussd.js will call this, then save the result via
// cases.js and check it against alerts.js.
app.post(
  "/report",
  express.raw({ type: "audio/*", limit: "20mb" }),
  async (req, res) => {
    try {
      let text;

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

      let confirmationAudioBase64 = null;
      if (result.missing_fields.length === 0) {
        const audioBuffer = await synthesizeSpeech(result.case.incident_summary);
        confirmationAudioBase64 = audioBuffer.toString("base64");
      }

      res.json({ ...result, confirmation_audio_base64: confirmationAudioBase64 });
    } catch (err) {
      console.error("[/report]", err);
      res.status(500).json({ error: "Something went wrong processing this report. Please try again." });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KasaBaako backend running on port ${PORT}`);
});

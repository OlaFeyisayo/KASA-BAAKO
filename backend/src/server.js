import "dotenv/config";
import express from "express";
import cors from "cors";
import { processReport } from "./services/reportPipeline.js";
import { getCaseForCustomer, updateCaseStatus, getAllCases } from "./db/cases.js";
import { verifyWebhook, handleIncomingMessage } from "./channels/whatsapp.js";
import { handleUssdRequest } from "./channels/ussd.js";
import { login, logout, requireDashboardAuth, requireServiceApiKey } from "./services/auth.js";

const app = express();
app.use(cors({ origin: process.env.DASHBOARD_ORIGIN || "*" }));
app.use(express.json());

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
  requireServiceApiKey,
  express.raw({ type: "audio/*", limit: "20mb" }),
  async (req, res) => {
    try {
      const { customer_contact, channel, input_mode, case_id, language } = req.query;

      const isAudio = req.is("audio/*");
      const result = await processReport({
        text: isAudio ? undefined : req.body?.text,
        audioBuffer: isAudio ? req.body : undefined,
        contentType: isAudio ? req.headers["content-type"] : undefined,
        customer_contact,
        channel,
        input_mode,
        case_id,
        language,
      });

      res.json({
        ...result,
        confirmation_audio_base64: result.confirmationAudio ? result.confirmationAudio.toString("base64") : null,
      });
    } catch (err) {
      if (err.code === "CASE_NOT_FOUND") {
        return res.status(404).json({ error: "Case not found" });
      }
      if (err.message.includes("required") || err.message.includes("No text or audio")) {
        return res.status(400).json({ error: err.message });
      }
      console.error("[/report]", err);
      res.status(500).json({ error: "Something went wrong processing this report. Please try again." });
    }
  }
);

// Dashboard login — a single shared MTN-staff password, checked here
// (not in the shipped frontend JS, unlike the old client-side check) and
// exchanged for a session token used as a Bearer token on every
// dashboard-only route below.
app.post("/auth/login", (req, res) => {
  const token = login(req.body?.password);
  if (!token) {
    return res.status(401).json({ error: "Invalid password" });
  }
  res.json({ token });
});

app.post("/auth/logout", requireDashboardAuth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  logout(token);
  res.json({ ok: true });
});

// For the MTN dashboard: every stored case. Dashboard-only — this is the
// most sensitive endpoint in the system (every customer's fraud report in
// one response), so it requires a valid dashboard session.
app.get("/cases", requireDashboardAuth, (req, res) => {
  res.json(getAllCases());
});

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
app.patch("/cases/:caseId/status", requireDashboardAuth, (req, res) => {
  try {
    const updated = updateCaseStatus(req.params.caseId, req.body?.status);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// WhatsApp webhook (Meta verifies this URL with a GET, then POSTs incoming messages).
app.get("/webhooks/whatsapp", verifyWebhook);
app.post("/webhooks/whatsapp", express.json(), handleIncomingMessage);

// USSD webhook (Africa's Talking POSTs form-encoded fields per screen).
app.post("/webhooks/ussd", express.urlencoded({ extended: false }), handleUssdRequest);

// Catches malformed JSON and oversized bodies from express.json()/express.raw()
// (thrown before any route handler runs) so callers get a clean JSON error
// instead of Express's default HTML page, which included internal file
// paths and dependency stack traces.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed request body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KasaBaako backend running on port ${PORT}`);
});

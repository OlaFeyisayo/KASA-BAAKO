import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import express from "express";
import cors from "cors";
import { processReport } from "./services/reportPipeline.js";
import { getCaseForCustomer, getCaseById, updateCaseStatus, getAllCases } from "./db/cases.js";
import { verifyWebhook, handleIncomingMessage, downloadWhatsAppMedia } from "./channels/whatsapp.js";
import { handleUssdRequest } from "./channels/ussd.js";
import { login, logout, requireDashboardAuth, requireServiceApiKey, requireUssdWebhookToken } from "./services/auth.js";
import { verifyWhatsAppSignature } from "./middleware/verifySignature.js";

// Defense in depth: Node's default behavior for an unhandled promise
// rejection is to crash the whole process. That's exactly what just
// happened in production — a transient network failure reaching Meta's
// API inside an async webhook handler went uncaught, and took down
// WhatsApp, USSD, and the dashboard API together until someone manually
// restarted the server. channels/whatsapp.js's send functions are now
// fixed at the source (they catch their own network errors instead of
// throwing), but this is a deliberate last-resort net for the same class
// of bug anywhere else in the codebase, present or future: log it and
// keep serving requests, rather than one bad promise silently ending the
// whole service. (The usual advice — let an uncaught exception crash the
// process, restart it under a supervisor — assumes something like that IS
// in place; a stateless HTTP server with no shared mutable state between
// requests has little to actually be "corrupted" by one request's error,
// and for a customer-facing fraud-reporting bot, staying up outweighs
// that risk here.)
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection (server stays up):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception (server stays up):", err);
});

// Diagnosed directly: DNS returns both an IPv6 and an IPv4 address for
// graph.facebook.com, IPv4 connects instantly, and IPv6 doesn't connect
// at all on this network (a working IPv6 address in DNS with no actual
// IPv6 route is a common real-world ISP/router misconfiguration). Node's
// fetch (via undici) tries IPv6 first by default and — unlike curl, which
// falls back fast — waits out the full connect timeout on the dead path
// before giving up, so every outbound call to Meta's API (and Khaya's,
// Anthropic's — anywhere DNS returns an IPv6 record) was paying that
// ~10s tax or failing outright, with no relation to actual bandwidth.
// This forces Node to resolve IPv4 first for the whole process, which
// sidesteps the broken path entirely rather than just tolerating it.
setDefaultResultOrder("ipv4first");

const app = express();
app.use(cors({ origin: process.env.DASHBOARD_ORIGIN || "*" }));
// The `verify` callback stashes the exact raw, unparsed body on req.rawBody
// — verifyWhatsAppSignature needs those untouched bytes (not the
// re-serialized JSON) to recompute Meta's signature correctly. Has to live
// on this global parser, not a route-specific one, since this runs first
// for every request and would otherwise already consume the body stream.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

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

// Streams one of a case's voice notes (a case can have several — the
// initial report, an answered follow-up, etc. — see db/cases.js's
// audio_refs) for dashboard playback, by its position in that array.
// audio_refs holds WhatsApp media ids, not fetchable URLs — WhatsApp
// requires our Bearer token on every media request, and the one-time
// download URL it hands out expires quickly, so this proxies through our
// own server rather than the dashboard hitting Meta directly.
// Dashboard-only, same sensitivity reasoning as GET /cases.
app.get("/cases/:caseId/audio/:index", requireDashboardAuth, async (req, res) => {
  const found = getCaseById(req.params.caseId);
  const index = Number(req.params.index);
  const mediaId = found?.audio_refs?.[index];
  if (!found || !Number.isInteger(index) || !mediaId) {
    return res.status(404).json({ error: "No audio recording at that index for this case" });
  }

  try {
    const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);
    res.set("Content-Type", mimeType || "audio/ogg");
    res.send(buffer);
  } catch (err) {
    console.error("[cases/:caseId/audio]", err);
    res.status(502).json({ error: "Could not retrieve the audio recording (it may have expired)" });
  }
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
// The body is already parsed by the global express.json() above (with
// req.rawBody stashed for the signature check) — no need for a second,
// route-specific express.json() here.
app.get("/webhooks/whatsapp", verifyWebhook);
app.post("/webhooks/whatsapp", verifyWhatsAppSignature, handleIncomingMessage);

// USSD webhook (Africa's Talking POSTs form-encoded fields per screen).
// Register the callback URL with Africa's Talking as
// https://.../webhooks/ussd?token=<USSD_WEBHOOK_TOKEN> — see requireUssdWebhookToken.
app.post("/webhooks/ussd", requireUssdWebhookToken, express.urlencoded({ extended: false }), handleUssdRequest);

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

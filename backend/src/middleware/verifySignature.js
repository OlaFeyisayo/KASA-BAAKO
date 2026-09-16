// Verifies Meta's X-Hub-Signature-256 header on incoming WhatsApp webhook
// POSTs, so a request is only trusted if it's actually signed by Meta using
// our WHATSAPP_APP_SECRET — closes the "WhatsApp webhook isn't
// signature-verified yet" item from the README's Known Issues.
//
// Needs the raw, unparsed request body (not the re-serialized JSON) to
// recompute the same signature Meta did — see server.js, where
// express.json()'s `verify` callback stashes it on req.rawBody before this
// middleware runs.

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWhatsAppSignature(req, res, next) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Fails OPEN only when the secret genuinely isn't configured yet (e.g.
  // early local dev before Meta app setup) — matches how the rest of this
  // codebase treats an unset webhook secret (see requireUssdWebhookToken's
  // comment in services/auth.js for the contrast: that one fails closed,
  // because a USSD token is meant to always be set once deployed). Once
  // WHATSAPP_APP_SECRET is set, every request must carry a valid signature.
  if (!appSecret) {
    console.warn("[verifyWhatsAppSignature] WHATSAPP_APP_SECRET not set — skipping verification");
    return next();
  }

  const signatureHeader = req.get("X-Hub-Signature-256");
  if (!signatureHeader) return res.sendStatus(401);

  const expectedSignature = "sha256=" + createHmac("sha256", appSecret).update(req.rawBody).digest("hex");

  const provided = Buffer.from(signatureHeader);
  const expected = Buffer.from(expectedSignature);
  const isValid = provided.length === expected.length && timingSafeEqual(provided, expected);

  if (!isValid) return res.sendStatus(401);
  next();
}

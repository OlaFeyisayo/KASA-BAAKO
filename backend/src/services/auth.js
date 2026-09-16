// Dashboard authentication: a single shared MTN-staff password (no
// per-user accounts, matching the current login UX), but checked here on
// the server instead of in the shipped frontend JS — the previous version
// compared the password to a hardcoded string inside Login.jsx, which
// meant the real password was readable by anyone who opened the browser's
// dev tools. A correct password now exchanges for a random session token,
// which the dashboard sends back as "Authorization: Bearer <token>" on
// every request that reads or changes case data.
//
// Sessions live in the same SQLite database as everything else (a
// "sessions" table), not an in-memory Map — a Map would forget every
// logged-in session the moment the backend process restarts.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "../db/connection.js";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Constant-time string comparison, so checking the password can't leak how many leading characters matched via response timing. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Checks a submitted password against DASHBOARD_PASSWORD and, if it
 * matches, issues a new session token.
 *
 * @param {string} password
 * @returns {string|null} A session token, or null if the password was wrong.
 */
export function login(password) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || typeof password !== "string" || !safeEqual(password, expected)) {
    return null;
  }
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, expires_at) VALUES (?, ?)").run(token, Date.now() + SESSION_DURATION_MS);
  return token;
}

/** Ends a session (logout), if it exists. */
export function logout(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** @returns {boolean} Whether `token` is a currently-valid, unexpired session. */
export function isValidSession(token) {
  if (!token) return false;
  const row = db.prepare("SELECT expires_at FROM sessions WHERE token = ?").get(token);
  if (!row) return false;
  if (Date.now() > row.expires_at) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return false;
  }
  return true;
}

/** Express middleware: requires a valid "Authorization: Bearer <token>" header. */
export function requireDashboardAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!isValidSession(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/** Express middleware: requires a matching "x-api-key" header (for machine-to-machine callers of POST /report). */
export function requireServiceApiKey(req, res, next) {
  const expected = process.env.SERVICE_API_KEY;
  const provided = req.headers["x-api-key"];
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/**
 * Express middleware: requires a matching "token" query parameter.
 *
 * Africa's Talking doesn't sign its USSD callbacks the way Meta signs
 * WhatsApp webhooks (no header we can verify), so instead the secret lives
 * in the callback URL itself — e.g. https://.../webhooks/ussd?token=XYZ —
 * configured once in the Africa's Talking dashboard. Anyone who doesn't
 * know that exact URL (including the token) gets rejected here.
 */
export function requireUssdWebhookToken(req, res, next) {
  const expected = process.env.USSD_WEBHOOK_TOKEN;
  const provided = req.query.token;
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

/** Test-only: clears all sessions and lets a test force a specific expiry. */
export function _resetSessionsForTests() {
  db.prepare("DELETE FROM sessions").run();
}

/** Test-only: creates a session token with an arbitrary expiry, to test expiry handling without waiting 12 hours. */
export function _createSessionForTests(expiresAt) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, expires_at) VALUES (?, ?)").run(token, expiresAt);
  return token;
}

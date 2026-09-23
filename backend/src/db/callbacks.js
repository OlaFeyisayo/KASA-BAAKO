// "Call me back" requests (see schema.sql) — the human fallback when the
// bot can't serve someone.

import { db } from "./connection.js";
import { normalizePhoneNumber } from "../utils/phone.js";

/**
 * Records a request, unless this customer already has one waiting — asking
 * twice shouldn't put them in the staff queue twice.
 *
 * @param {object} params
 * @param {string} params.customer_contact
 * @param {"twi"|"english"} [params.language="twi"]
 * @returns {{ request: object, alreadyPending: boolean }}
 */
export function createCallbackRequest({ customer_contact, language = "twi" }) {
  const normalized = normalizePhoneNumber(customer_contact);
  const pending = db.prepare("SELECT * FROM callback_requests WHERE status = 'pending'").all();
  const existing = pending.find((r) => normalizePhoneNumber(r.customer_contact) === normalized);
  if (existing) return { request: existing, alreadyPending: true };

  const { lastInsertRowid } = db
    .prepare("INSERT INTO callback_requests (customer_contact, language) VALUES (?, ?)")
    .run(customer_contact, language);
  const request = db.prepare("SELECT * FROM callback_requests WHERE id = ?").get(lastInsertRowid);
  return { request, alreadyPending: false };
}

/** Requests still waiting for a call, oldest first (first come, first called). */
export function getPendingCallbackRequests() {
  return db.prepare("SELECT * FROM callback_requests WHERE status = 'pending' ORDER BY created_at ASC, id ASC").all();
}

/** @returns {object|null} The updated request, or null if there's no such id. */
export function markCallbackDone(id) {
  db.prepare("UPDATE callback_requests SET status = 'done', resolved_at = datetime('now') WHERE id = ?").run(id);
  return db.prepare("SELECT * FROM callback_requests WHERE id = ?").get(id) ?? null;
}

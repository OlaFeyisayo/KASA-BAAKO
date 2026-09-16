CREATE TABLE IF NOT EXISTS cases (
  case_id TEXT PRIMARY KEY,
  customer_contact TEXT NOT NULL,
  -- 'mtn_app' isn't wired up by any of our own code yet — it exists so that
  -- if MTN's own app calls POST /report directly (the same generic,
  -- API-key-protected endpoint our WhatsApp/USSD channels already use),
  -- it's treated as a first-class channel from day one, not a special case.
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'ussd', 'mtn_app')),
  input_mode TEXT NOT NULL CHECK (input_mode IN ('voice', 'text', 'guided')),
  language TEXT NOT NULL DEFAULT 'twi',
  incident_summary TEXT,
  incident_date TEXT,
  amount REAL,
  fraud_category TEXT,
  suspected_number TEXT,
  suspected_number_normalized TEXT,
  transaction_id TEXT,
  missing_fields TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'resolved')),
  -- A JSON array of WhatsApp media ids — every voice note across the whole
  -- conversation (the initial report, an answered follow-up, etc.), not
  -- just the most recent one. See db/connection.js for the migration from
  -- the older single-value `audio_ref` column this replaced.
  audio_refs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- suspected_number is stored exactly as the customer typed it (any format);
-- suspected_number_normalized holds normalizePhoneNumber()'s output so fraud
-- matching can filter in SQL (WHERE suspected_number_normalized = ?) instead
-- of loading every case into Node just to compare formats in JavaScript.
CREATE INDEX IF NOT EXISTS idx_cases_suspected_number ON cases (suspected_number);
CREATE INDEX IF NOT EXISTS idx_cases_suspected_number_normalized ON cases (suspected_number_normalized);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status);

-- Dashboard login sessions. Stored here (not an in-memory Map) so staff
-- stay logged in across a backend restart — the whole point of this table.
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  case_id TEXT PRIMARY KEY,
  customer_contact TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'ussd')),
  input_mode TEXT NOT NULL CHECK (input_mode IN ('voice', 'text', 'guided')),
  language TEXT NOT NULL DEFAULT 'twi',
  incident_summary TEXT,
  incident_date TEXT,
  amount REAL,
  fraud_category TEXT,
  suspected_number TEXT,
  transaction_id TEXT,
  missing_fields TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'resolved')),
  audio_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

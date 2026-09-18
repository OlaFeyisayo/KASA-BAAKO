import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
// Overridable so tests can point at their own isolated file instead of this
// one — see db/cases.test.js and services/reportPipeline.test.js, which
// used to delete-and-recreate this exact path before every run (their
// comments called it "a throwaway DB file", but it was actually this same
// one the real app uses).
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, "kasabaako.db");

mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");

// Must run BEFORE db.exec(schema) below — schema.sql's CREATE TABLE IF NOT
// EXISTS is a no-op on an already-existing `cases` table, so on a database
// created before suspected_email existed, schema.sql's own CREATE INDEX on
// suspected_email_normalized would fail with "no such column" if the ALTER
// ran after it instead.
const casesTableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cases'").get();
if (casesTableExists) {
  const cols = db.prepare("PRAGMA table_info(cases)").all().map((c) => c.name);
  if (!cols.includes("suspected_email")) db.exec("ALTER TABLE cases ADD COLUMN suspected_email TEXT");
  if (!cols.includes("suspected_email_normalized")) db.exec("ALTER TABLE cases ADD COLUMN suspected_email_normalized TEXT");
}

db.exec(schema);

// Migrates an existing database's old single-value `audio_ref` column into
// the new `audio_refs` JSON array (schema.sql's CREATE TABLE only applies
// to a brand new database — IF NOT EXISTS does nothing to one that already
// has a `cases` table). SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT
// EXISTS`, so this checks first rather than erroring on every restart once
// the column already exists.
const existingColumns = db.prepare("PRAGMA table_info(cases)").all().map((c) => c.name);
if (!existingColumns.includes("audio_refs")) {
  db.exec("ALTER TABLE cases ADD COLUMN audio_refs TEXT NOT NULL DEFAULT '[]'");
  if (existingColumns.includes("audio_ref")) {
    const rowsWithAudio = db.prepare("SELECT case_id, audio_ref FROM cases WHERE audio_ref IS NOT NULL").all();
    const migrate = db.prepare("UPDATE cases SET audio_refs = ? WHERE case_id = ?");
    for (const row of rowsWithAudio) {
      migrate.run(JSON.stringify([row.audio_ref]), row.case_id);
    }
  }
}

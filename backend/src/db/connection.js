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
db.exec(schema);

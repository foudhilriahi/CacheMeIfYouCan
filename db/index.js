import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "jobs.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL UNIQUE,
    dedupe_key TEXT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT DEFAULT '',
    description TEXT DEFAULT '',
    salary TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    platform TEXT NOT NULL,
    posted_date TEXT DEFAULT '',
    scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_new INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_url_hash ON jobs(url_hash);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe_key_unique ON jobs(dedupe_key);
  CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
  CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
  CREATE INDEX IF NOT EXISTS idx_jobs_is_new ON jobs(is_new);

  CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    status TEXT NOT NULL,
    jobs_found INTEGER DEFAULT 0,
    jobs_new INTEGER DEFAULT 0,
    started_at TEXT NOT NULL,
    finished_at TEXT DEFAULT '',
    error TEXT DEFAULT ''
  );
`);

// Lightweight migration for existing DBs created before dedupe_key support
const columns = db.prepare("PRAGMA table_info(jobs)").all();
const hasDedupeKey = columns.some((c) => c.name === "dedupe_key");
if (!hasDedupeKey) {
  db.exec("ALTER TABLE jobs ADD COLUMN dedupe_key TEXT");
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe_key_unique ON jobs(dedupe_key)",
);

export default db;

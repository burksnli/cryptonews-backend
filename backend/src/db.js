/**
 * SQLite database initialisation.
 * All tables are created in a single migration block here.
 * The DB file lands in ./data/cryptonews.db next to the old store.json.
 */
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_FILE || path.resolve(process.cwd(), "data", "cryptonews.db");

// Ensure data/ directory exists before opening DB
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const Database = require("better-sqlite3");
const db = new Database(DB_PATH);

// WAL mode: much faster for concurrent reads
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen   TEXT
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    watchlist   TEXT NOT NULL DEFAULT '[]',
    alerts      TEXT NOT NULL DEFAULT '[]',
    settings    TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS news (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL DEFAULT 'admin',
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    priority    TEXT NOT NULL DEFAULT 'normal',
    tags        TEXT NOT NULL DEFAULT '[]',
    coins       TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at DESC);

  CREATE TABLE IF NOT EXISTS push_tokens (
    token       TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS online_sessions (
    session_id  TEXT PRIMARY KEY,
    user_id     TEXT,
    ip          TEXT,
    user_agent  TEXT,
    last_ping   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_online_ping ON online_sessions(last_ping DESC);
`);

module.exports = db;

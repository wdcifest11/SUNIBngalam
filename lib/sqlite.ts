import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./auth/password";

let db: DatabaseSync | null = null;

const DEFAULT_AVATAR_URL = "/blockyPng/profilePicture.png";

function ensureUsersColumns(db: DatabaseSync) {
  const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const has = (name: string) => cols.some((c) => c.name === name);

  if (!has("email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT;");
  if (!has("password_hash")) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
  if (!has("created_at")) db.exec("ALTER TABLE users ADD COLUMN created_at TEXT;");
  if (!has("elo")) db.exec("ALTER TABLE users ADD COLUMN elo INTEGER NOT NULL DEFAULT 1000;");
  if (!has("university")) db.exec("ALTER TABLE users ADD COLUMN university TEXT;");
  if (!has("major")) db.exec("ALTER TABLE users ADD COLUMN major TEXT;");
  if (!has("cohort")) db.exec("ALTER TABLE users ADD COLUMN cohort TEXT;");
  if (!has("onboarding_completed_at")) db.exec("ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT;");
  if (!has("focus_goal")) db.exec("ALTER TABLE users ADD COLUMN focus_goal TEXT;");
  if (!has("focus_session_mins")) db.exec("ALTER TABLE users ADD COLUMN focus_session_mins INTEGER;");
  if (!has("prefers_battles")) db.exec("ALTER TABLE users ADD COLUMN prefers_battles INTEGER NOT NULL DEFAULT 1;");
  if (!has("prefers_guild")) db.exec("ALTER TABLE users ADD COLUMN prefers_guild INTEGER NOT NULL DEFAULT 1;");

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users(email);");
  db.exec("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL;");
  db.exec("UPDATE users SET elo = 1000 WHERE elo IS NULL;");
  db.exec("UPDATE users SET prefers_battles = 1 WHERE prefers_battles IS NULL;");
  db.exec("UPDATE users SET prefers_guild = 1 WHERE prefers_guild IS NULL;");
}

function init(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      elo INTEGER NOT NULL DEFAULT 1000,
      university TEXT,
      major TEXT,
      cohort TEXT,
      onboarding_completed_at TEXT,
      focus_goal TEXT,
      focus_session_mins INTEGER,
      prefers_battles INTEGER NOT NULL DEFAULT 1,
      prefers_guild INTEGER NOT NULL DEFAULT 1,
      avatar_url TEXT NOT NULL DEFAULT '${DEFAULT_AVATAR_URL}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Keep older local DBs working after schema changes.
  ensureUsersColumns(db);

  // Migrate older defaults / missing values.
  db.prepare(
    `UPDATE users
     SET avatar_url = ?
     WHERE avatar_url IS NULL OR avatar_url = '' OR avatar_url = '/pfp.png'`
  ).run(DEFAULT_AVATAR_URL);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS planner_state (
      user_id INTEGER PRIMARY KEY,
      quests_json TEXT NOT NULL DEFAULT '[]',
      events_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  // Seed a demo account for quick testing.
  const hasDemo = db.prepare("SELECT 1 FROM users WHERE email = ?").get("demo@studium.local");
  if (!hasDemo) {
    db.prepare(
      "INSERT INTO users (email, display_name, password_hash, xp, level, elo, university, major, cohort, onboarding_completed_at, focus_goal, focus_session_mins, prefers_battles, prefers_guild, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)"
    ).run(
      "demo@studium.local",
      "Demo User",
      hashPassword("demo1234"),
      1350,
      12,
      1350,
      "Bina Nusantara University Malang",
      "Computer Science",
      "B29",
      "Exam prep",
      25,
      1,
      1,
      DEFAULT_AVATAR_URL
    );
  } else {
    db.prepare(
      `UPDATE users
       SET elo = COALESCE(elo, 1000),
           university = COALESCE(NULLIF(university,''), ?),
           major = COALESCE(NULLIF(major,''), ?),
           cohort = COALESCE(NULLIF(cohort,''), ?),
           onboarding_completed_at = COALESCE(onboarding_completed_at, datetime('now')),
           focus_goal = COALESCE(NULLIF(focus_goal,''), 'Exam prep'),
           focus_session_mins = COALESCE(focus_session_mins, 25),
           prefers_battles = COALESCE(prefers_battles, 1),
           prefers_guild = COALESCE(prefers_guild, 1)
       WHERE email = ?`
    ).run("Bina Nusantara University Malang", "Computer Science", "B29", "demo@studium.local");
  }
}

export function getDb(): DatabaseSync {
  if (db) return db;

  const desiredDir = path.join(process.cwd(), "data");
  let dataDir = desiredDir;

  try {
    fs.mkdirSync(desiredDir, { recursive: true });
    fs.accessSync(desiredDir, fs.constants.W_OK);
  } catch {
    // Serverless/readonly filesystems (e.g. Vercel) typically only allow writes in /tmp.
    dataDir = path.join(os.tmpdir(), "studium");
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "studium.db");

  db = new DatabaseSync(dbPath);
  init(db);
  return db;
}

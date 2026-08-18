import { env } from "cloudflare:workers";

let schemaPromise: Promise<void> | null = null;

export function getDatabase(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensureDatabase() {
  if (!schemaPromise) {
    schemaPromise = initializeDatabase().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

async function initializeDatabase() {
  const db = getDatabase();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      auth_user_id TEXT UNIQUE,
      username TEXT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited')),
      password_hash TEXT,
      password_salt TEXT,
      password_iterations INTEGER NOT NULL DEFAULT 210000,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      building TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'done')),
      due_date TEXT,
      creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
  ]);

  const info = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const columns = new Set((info.results ?? []).map((column) => column.name));
  const additions: Array<[string, string]> = [
    ["username", "ALTER TABLE users ADD COLUMN username TEXT"],
    ["password_hash", "ALTER TABLE users ADD COLUMN password_hash TEXT"],
    ["password_salt", "ALTER TABLE users ADD COLUMN password_salt TEXT"],
    ["password_iterations", "ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 210000"],
  ];
  for (const [column, sql] of additions) {
    if (!columns.has(column)) await db.prepare(sql).run();
  }

  await db.batch([
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions (user_id, expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_creator_status ON tasks (creator_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks (assignee_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_task_created ON comments (task_id, created_at)"),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()),
    db.prepare("PRAGMA optimize"),
  ]);
}

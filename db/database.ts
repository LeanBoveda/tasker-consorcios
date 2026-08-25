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
      password_iterations INTEGER NOT NULL DEFAULT 100000,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS consorcios (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      building TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'done')),
      due_date TEXT,
      consortium_id TEXT REFERENCES consorcios(id) ON DELETE SET NULL,
      creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'whatsapp', 'system')),
      external_author TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS automatic_intake (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('email', 'whatsapp')),
      source_account TEXT NOT NULL DEFAULT '',
      external_id TEXT NOT NULL,
      conversation_id TEXT,
      sender_name TEXT NOT NULL DEFAULT '',
      sender_address TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('claim', 'request', 'order', 'notice', 'other')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'discarded', 'error')),
      consortium_id TEXT REFERENCES consorcios(id) ON DELETE SET NULL,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      attachments TEXT NOT NULL DEFAULT '[]',
      is_test INTEGER NOT NULL DEFAULT 0,
      error_detail TEXT NOT NULL DEFAULT '',
      received_at INTEGER NOT NULL,
      reviewed_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS daemon_instances (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      host_name TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'degraded', 'error')),
      started_at INTEGER NOT NULL,
      last_heartbeat_at INTEGER NOT NULL,
      last_error TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS daemon_sources (
      id TEXT PRIMARY KEY NOT NULL,
      instance_id TEXT NOT NULL REFERENCES daemon_instances(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('email', 'whatsapp')),
      account TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'degraded', 'disconnected', 'disabled')),
      last_checked_at INTEGER NOT NULL,
      last_message_at INTEGER,
      last_error TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
  ]);

  const info = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const columns = new Set((info.results ?? []).map((column) => column.name));
  const additions: Array<[string, string]> = [
    ["username", "ALTER TABLE users ADD COLUMN username TEXT"],
    ["password_hash", "ALTER TABLE users ADD COLUMN password_hash TEXT"],
    ["password_salt", "ALTER TABLE users ADD COLUMN password_salt TEXT"],
    ["password_iterations", "ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000"],
  ];
  for (const [column, sql] of additions) {
    if (!columns.has(column)) await db.prepare(sql).run();
  }

  const taskInfo = await db.prepare("PRAGMA table_info(tasks)").all<{ name: string }>();
  const taskColumns = new Set((taskInfo.results ?? []).map((column) => column.name));
  if (!taskColumns.has("consortium_id")) {
    await db.prepare("ALTER TABLE tasks ADD COLUMN consortium_id TEXT REFERENCES consorcios(id) ON DELETE SET NULL").run();
  }

  const commentInfo = await db.prepare("PRAGMA table_info(comments)").all<{ name: string }>();
  const commentColumns = new Set((commentInfo.results ?? []).map((column) => column.name));
  if (!commentColumns.has("source")) {
    await db.prepare("ALTER TABLE comments ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'").run();
  }
  if (!commentColumns.has("external_author")) {
    await db.prepare("ALTER TABLE comments ADD COLUMN external_author TEXT NOT NULL DEFAULT ''").run();
  }

  const legacyBuildings = await db.prepare(`SELECT DISTINCT building
    FROM tasks WHERE consortium_id IS NULL AND trim(building) <> ''`).all<{ building: string }>();
  for (const row of legacyBuildings.results ?? []) {
    let consortium = await db.prepare("SELECT id FROM consorcios WHERE name = ? COLLATE NOCASE")
      .bind(row.building).first<{ id: string }>();
    if (!consortium) {
      const id = crypto.randomUUID();
      const now = Date.now();
      await db.prepare(`INSERT INTO consorcios (id, name, address, notes, created_at, updated_at)
        VALUES (?, ?, '', '', ?, ?)`).bind(id, row.building, now, now).run();
      consortium = { id };
    }
    await db.prepare("UPDATE tasks SET consortium_id = ? WHERE consortium_id IS NULL AND building = ?")
      .bind(consortium.id, row.building).run();
  }

  await db.batch([
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions (user_id, expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_creator_status ON tasks (creator_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks (assignee_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_consortium_id ON tasks (consortium_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_task_created ON comments (task_id, created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS automatic_intake_source_external_unique ON automatic_intake (source, source_account, external_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automatic_intake_status_created ON automatic_intake (status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automatic_intake_source_account ON automatic_intake (source, source_account, received_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automatic_intake_task_id ON automatic_intake (task_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automatic_intake_conversation ON automatic_intake (source, source_account, conversation_id, received_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_daemon_instances_heartbeat ON daemon_instances (last_heartbeat_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS daemon_sources_instance_kind_account_unique ON daemon_sources (instance_id, kind, account)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_daemon_sources_instance ON daemon_sources (instance_id)"),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()),
    db.prepare("PRAGMA optimize"),
  ]);
}

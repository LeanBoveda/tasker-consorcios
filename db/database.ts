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
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL DEFAULT 'email' CHECK (source IN ('email')),
      is_test INTEGER NOT NULL DEFAULT 1,
      external_id TEXT NOT NULL UNIQUE,
      gmail_thread_id TEXT,
      sender_name TEXT NOT NULL DEFAULT '',
      sender_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'otro' CHECK (category IN ('ascensor', 'agua', 'gas', 'electricidad', 'seguridad', 'limpieza', 'convivencia', 'administracion', 'mantenimiento', 'otro')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'waiting', 'resolved', 'closed')),
      consortium_id TEXT REFERENCES consorcios(id) ON DELETE SET NULL,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      assigned_to_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
    db.prepare(`CREATE TABLE IF NOT EXISTS mail_settings (
      id TEXT PRIMARY KEY NOT NULL,
      intake_enabled INTEGER NOT NULL DEFAULT 1,
      inbox_address TEXT NOT NULL DEFAULT 'leandroboveda@gmail.com',
      subject_prefix TEXT NOT NULL DEFAULT '[RECLAMO]',
      accepted_patterns TEXT NOT NULL DEFAULT '["RECLAMO","SOLICITUD","PEDIDO"]',
      ignored_subject_patterns TEXT NOT NULL DEFAULT '["[TASKER]","RESPUESTA AUTOMÁTICA","FUERA DE LA OFICINA"]',
      blocked_senders TEXT NOT NULL DEFAULT '["no-reply","noreply"]',
      minimum_body_length INTEGER NOT NULL DEFAULT 5,
      lookback_days INTEGER NOT NULL DEFAULT 7,
      reminders_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_recipients TEXT NOT NULL DEFAULT '[]',
      notify_urgent INTEGER NOT NULL DEFAULT 1,
      notify_due_today INTEGER NOT NULL DEFAULT 1,
      notify_overdue INTEGER NOT NULL DEFAULT 1,
      daily_summary INTEGER NOT NULL DEFAULT 0,
      reminder_hour INTEGER NOT NULL DEFAULT 9,
      timezone TEXT NOT NULL DEFAULT 'America/Buenos_Aires',
      last_sync_at INTEGER,
      last_sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (last_sync_status IN ('idle', 'ok', 'error')),
      last_sync_detail TEXT NOT NULL DEFAULT '',
      last_sync_processed INTEGER NOT NULL DEFAULT 0,
      updated_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS email_intake_events (
      id TEXT PRIMARY KEY NOT NULL,
      external_id TEXT NOT NULL UNIQUE,
      sender_email TEXT NOT NULL DEFAULT '',
      recipient_emails TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
      reason TEXT NOT NULL DEFAULT '',
      claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS email_notifications (
      id TEXT PRIMARY KEY NOT NULL,
      notification_key TEXT NOT NULL UNIQUE,
      recipient_email TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('urgent', 'due_today', 'overdue', 'daily_summary')),
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reserved', 'sent')),
      reserved_at INTEGER,
      sent_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
  ]);

  await db.prepare(`INSERT OR IGNORE INTO mail_settings
    (id, intake_enabled, inbox_address, subject_prefix, lookback_days, reminders_enabled,
     reminder_recipients, notify_urgent, notify_due_today, notify_overdue, daily_summary,
     reminder_hour, timezone, updated_by_id, updated_at)
    VALUES ('default', 1, 'leandroboveda@gmail.com', '[RECLAMO]', 7, 0,
      '["leandroboveda@gmail.com"]', 1, 1, 1, 0, 9, 'America/Buenos_Aires', NULL, ?)`)
    .bind(Date.now()).run();

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

  const mailInfo = await db.prepare("PRAGMA table_info(mail_settings)").all<{ name: string }>();
  const mailColumns = new Set((mailInfo.results ?? []).map((column) => column.name));
  const mailAdditions: Array<[string, string]> = [
    ["accepted_patterns", `ALTER TABLE mail_settings ADD COLUMN accepted_patterns TEXT NOT NULL DEFAULT '["RECLAMO","SOLICITUD","PEDIDO"]'`],
    ["ignored_subject_patterns", `ALTER TABLE mail_settings ADD COLUMN ignored_subject_patterns TEXT NOT NULL DEFAULT '["[TASKER]","RESPUESTA AUTOMÁTICA","FUERA DE LA OFICINA"]'`],
    ["blocked_senders", `ALTER TABLE mail_settings ADD COLUMN blocked_senders TEXT NOT NULL DEFAULT '["no-reply","noreply"]'`],
    ["minimum_body_length", "ALTER TABLE mail_settings ADD COLUMN minimum_body_length INTEGER NOT NULL DEFAULT 5"],
    ["last_sync_at", "ALTER TABLE mail_settings ADD COLUMN last_sync_at INTEGER"],
    ["last_sync_status", "ALTER TABLE mail_settings ADD COLUMN last_sync_status TEXT NOT NULL DEFAULT 'idle'"],
    ["last_sync_detail", "ALTER TABLE mail_settings ADD COLUMN last_sync_detail TEXT NOT NULL DEFAULT ''"],
    ["last_sync_processed", "ALTER TABLE mail_settings ADD COLUMN last_sync_processed INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [column, sql] of mailAdditions) {
    if (!mailColumns.has(column)) await db.prepare(sql).run();
  }

  const taskInfo = await db.prepare("PRAGMA table_info(tasks)").all<{ name: string }>();
  const taskColumns = new Set((taskInfo.results ?? []).map((column) => column.name));
  if (!taskColumns.has("consortium_id")) {
    await db.prepare("ALTER TABLE tasks ADD COLUMN consortium_id TEXT REFERENCES consorcios(id) ON DELETE SET NULL").run();
  }

  const claimInfo = await db.prepare("PRAGMA table_info(claims)").all<{ name: string }>();
  const claimColumns = new Set((claimInfo.results ?? []).map((column) => column.name));
  if (!claimColumns.has("gmail_thread_id")) {
    await db.prepare("ALTER TABLE claims ADD COLUMN gmail_thread_id TEXT").run();
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
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS claims_external_id_unique ON claims (external_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS claims_gmail_thread_id_unique ON claims (gmail_thread_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_claims_status_created ON claims (status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_claims_consortium_id ON claims (consortium_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_claims_assigned_to_id ON claims (assigned_to_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS automatic_intake_source_external_unique ON automatic_intake (source, source_account, external_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automatic_intake_status_created ON automatic_intake (status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automatic_intake_source_account ON automatic_intake (source, source_account, received_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automatic_intake_task_id ON automatic_intake (task_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS email_intake_events_external_id_unique ON email_intake_events (external_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_email_intake_events_status_created ON email_intake_events (status, created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS email_notifications_key_unique ON email_notifications (notification_key)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_email_notifications_status_created ON email_notifications (status, created_at)"),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()),
    db.prepare("PRAGMA optimize"),
  ]);
}

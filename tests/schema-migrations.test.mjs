import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const migrations = (await readdir(new URL("drizzle/", root)))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const migration of migrations) {
    database.exec(await readFile(new URL(`drizzle/${migration}`, root), "utf8"));
  }
  return database;
}

function columns(database, table) {
  return database.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

test("all migrations create the complete current schema from an empty database", async () => {
  const database = await migratedDatabase();
  try {
    const tables = database.prepare(`SELECT name FROM sqlite_schema
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all().map((row) => row.name);
    assert.deepEqual(tables, [
      "activity_log", "automatic_intake", "comments", "consorcios", "daemon_instances",
      "daemon_sources", "notifications", "sessions", "tasks", "users",
    ]);

    assert.deepEqual(columns(database, "users"), [
      "id", "auth_user_id", "username", "email", "name", "role", "status",
      "password_hash", "password_salt", "password_iterations", "created_at", "last_seen_at", "workspace_id",
    ]);
    assert.deepEqual(columns(database, "tasks"), [
      "id", "title", "description", "building", "priority", "status", "due_date",
      "creator_id", "assignee_id", "created_at", "updated_at", "consortium_id", "workspace_id",
    ]);
    assert.deepEqual(columns(database, "notifications"), [
      "id", "workspace_id", "user_id", "kind", "task_id", "title", "message",
      "dedupe_key", "read_at", "created_at",
    ]);
    assert.deepEqual(columns(database, "automatic_intake"), [
      "id", "source", "source_account", "external_id", "conversation_id", "sender_name",
      "sender_address", "title", "body", "kind", "priority", "status", "consortium_id",
      "task_id", "attachments", "is_test", "error_detail", "received_at", "reviewed_by_id",
      "reviewed_at", "created_at", "updated_at", "workspace_id",
    ]);

    const indexes = new Set(database.prepare(`SELECT name FROM sqlite_schema
      WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%'`).all().map((row) => row.name));
    for (const name of [
      "users_username_unique", "users_email_unique", "consorcios_workspace_name_unique",
      "automatic_intake_workspace_external_unique", "notifications_user_dedupe_unique",
      "idx_tasks_workspace", "idx_notifications_user_read_created", "idx_activity_workspace_created_id",
    ]) assert.ok(indexes.has(name), `missing index ${name}`);

    for (const removed of ["claims", "mail_settings", "email_notifications", "email_intake_events"]) {
      assert.equal(database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?").get(removed), undefined);
    }
  } finally {
    database.close();
  }
});

test("the migrated schema enforces the relationships used by Tasker", async () => {
  const database = await migratedDatabase();
  try {
    database.exec(`
      INSERT INTO users (id, workspace_id, username, email, name, role, status, created_at, last_seen_at)
        VALUES ('u1', 'main', 'owner', 'owner@example.com', 'Owner', 'admin', 'active', 1, 1);
      INSERT INTO consorcios (id, workspace_id, name, address, notes, created_at, updated_at)
        VALUES ('c1', 'main', 'Florida 249', 'Florida 249', '', 1, 1);
      INSERT INTO tasks (id, workspace_id, title, consortium_id, creator_id, created_at, updated_at)
        VALUES ('t1', 'main', 'Revisar bomba', 'c1', 'u1', 1, 1);
      INSERT INTO comments (id, task_id, author_id, body, created_at)
        VALUES ('comment-1', 't1', 'u1', 'En revisión', 1);
      INSERT INTO notifications (id, workspace_id, user_id, kind, task_id, title, created_at)
        VALUES ('notification-1', 'main', 'u1', 'status', 't1', 'Cambio de estado', 1);
      INSERT INTO automatic_intake (id, workspace_id, source, external_id, title, task_id, received_at, created_at, updated_at)
        VALUES ('intake-1', 'main', 'email', 'mail-1', 'Reclamo', 't1', 1, 1, 1);
      DELETE FROM tasks WHERE id = 't1';
    `);
    assert.equal(database.prepare("SELECT count(*) AS count FROM comments").get().count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM notifications").get().count, 0);
    assert.equal(database.prepare("SELECT task_id FROM automatic_intake WHERE id = 'intake-1'").get().task_id, null);
    assert.equal(database.prepare("SELECT count(*) AS count FROM consorcios").get().count, 1);
  } finally {
    database.close();
  }
});

test("request handling never creates or alters migration-owned schema", async () => {
  const source = await readFile(new URL("db/database.ts", root), "utf8");
  assert.doesNotMatch(source, /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX)\b/i);
  assert.doesNotMatch(source, /PRAGMA\s+table_info/i);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("exposes a protected and idempotent automatic intake endpoint", async () => {
  const [route, auth, schema] = await Promise.all([
    source("app/api/intake/events/route.ts"),
    source("lib/intake-auth.ts"),
    source("db/schema.ts"),
  ]);

  assert.match(route, /isAuthorizedIntakeRequest/);
  assert.match(route, /ingestAutomaticItem/);
  assert.match(route, /status:\s*401/);
  assert.match(auth, /x-tasker-intake-key/i);
  assert.match(auth, /TASKER_INTAKE_KEY/);
  assert.match(schema, /automatic_intake_workspace_external_unique/);
  assert.match(schema, /table\.source, table\.sourceAccount, table\.externalId/);
});

test("includes the administrator review workflow in Tasker", async () => {
  const [app, store] = await Promise.all([
    source("app/TaskApp.tsx"),
    source("db/task-store.ts"),
  ]);

  assert.match(app, /Ingresos automáticos/);
  assert.match(app, /Simular ingreso/);
  assert.match(app, /Confirmar/);
  assert.match(app, /Descartar/);
  assert.match(app, /Abrir tarea/);
  assert.match(store, /status = 'accepted'/);
  assert.match(store, /status = 'discarded'/);
  assert.match(store, /VALUES \(\?, \?, \?, \?, \?, 'review'/);
  assert.match(store, /UPDATE tasks SET status = 'pending'/);
});

test("ships the D1 migration for the new intake records", async () => {
  const migration = await source("drizzle/0008_tearful_sprite.sql");

  assert.match(migration, /CREATE TABLE `automatic_intake`/);
  assert.match(migration, /FOREIGN KEY \(`task_id`\)/);
  assert.match(migration, /CREATE UNIQUE INDEX `automatic_intake_source_external_unique`/);
  assert.match(migration, /CREATE INDEX `idx_automatic_intake_status_created`/);
});

test("removes the legacy Gmail workflow and clears operational data", async () => {
  const [app, store, schema, migration, envExample] = await Promise.all([
    source("app/TaskApp.tsx"),
    source("db/task-store.ts"),
    source("db/schema.ts"),
    source("drizzle/0009_tense_prowler.sql"),
    source(".env.example"),
  ]);

  assert.doesNotMatch(app, /Configuración correo|Apps Script|gmail-script/);
  assert.doesNotMatch(store, /mail_settings|email_intake_events|email_notifications/);
  assert.doesNotMatch(schema, /export const (claims|mailSettings|emailIntakeEvents|emailNotifications)/);
  assert.match(migration, /DELETE FROM `automatic_intake`/);
  assert.match(migration, /DELETE FROM `tasks`/);
  assert.match(migration, /DROP TABLE `mail_settings`/);
  assert.doesNotMatch(envExample, /EMAIL_INTAKE_KEY/);
});

test("tracks daemon health and its connected sources", async () => {
  const [route, schema, app, store] = await Promise.all([
    source("app/api/daemon/heartbeat/route.ts"),
    source("db/schema.ts"),
    source("app/TaskApp.tsx"),
    source("db/task-store.ts"),
  ]);

  assert.match(route, /isAuthorizedIntakeRequest/);
  assert.match(route, /recordDaemonHeartbeat/);
  assert.match(schema, /daemon_instances/);
  assert.match(schema, /daemon_sources/);
  assert.match(app, /Estado del demonio/);
  assert.match(app, /Correo central/);
  assert.match(store, /last_heartbeat_at/);
});

test("links incoming replies and reopens a completed recurring task", async () => {
  const store = await source("db/task-store.ts");

  assert.match(store, /classifyFollowUpSignal/);
  assert.match(store, /action = "reopened"/);
  assert.match(store, /Tarea reabierta automáticamente/);
  assert.match(store, /action = "ignored_resolved"/);
  assert.match(store, /created_after_closed_task/);
  assert.match(store, /INSERT INTO comments/);
});

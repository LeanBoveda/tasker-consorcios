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

test("offers complete task editing to creators and administrators", async () => {
  const [app, store] = await Promise.all([source("app/TaskApp.tsx"), source("db/task-store.ts")]);

  assert.match(app, /Editar tarea/);
  assert.match(app, /Actualizar todos los datos/);
  for (const field of ["Título", "Descripción", "Estado", "Prioridad", "Consorcio", "Asignada a", "Fecha límite"]) {
    assert.match(app, new RegExp(`>${field}<`));
  }
  assert.match(app, /creatorId === data\.currentUser\.id \|\| isAdmin/);
  assert.match(app, /Guardar cambios/);
  assert.match(store, /validatedDueDate/);
  assert.match(store, /El título es demasiado largo/);
  assert.match(store, /La descripción es demasiado larga/);
});

test("provides persistent personal notifications with direct task access", async () => {
  const [app, store, schema, route] = await Promise.all([
    source("app/TaskApp.tsx"),
    source("db/task-store.ts"),
    source("db/schema.ts"),
    source("app/api/notifications/[id]/route.ts"),
  ]);

  assert.match(app, /Marcar todas como leídas/);
  assert.match(app, /Tasker revisa nuevos avisos automáticamente/);
  assert.match(app, /setSelectedTaskId\(item\.taskId\)/);
  assert.match(store, /ensureDueNotifications/);
  assert.match(store, /kind: "assignment"/);
  assert.match(store, /kind: "comment"/);
  assert.match(store, /kind: "status"/);
  assert.match(store, /kind: "intake"/);
  assert.match(schema, /export const notifications/);
  assert.match(schema, /notifications_user_dedupe_unique/);
  assert.match(route, /markNotificationRead/);
});

test("prevents repeated login submissions and duplicate access records", async () => {
  const [form, auth] = await Promise.all([
    source("app/login/LoginForm.tsx"),
    source("db/auth-store.ts"),
  ]);

  assert.match(form, /const submitting = useRef\(false\)/);
  assert.match(form, /if \(submitting\.current\) return/);
  assert.match(form, /disabled=\{loading\}/);
  assert.doesNotMatch(form, /router\.refresh\(\)/);
  assert.match(auth, /LOGIN_AUDIT_DEDUPE_MS/);
  assert.match(auth, /INSERT OR IGNORE INTO activity_log/);
  assert.match(auth, /loginAuditId/);
});

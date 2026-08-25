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
  assert.match(schema, /automatic_intake_source_external_unique/);
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

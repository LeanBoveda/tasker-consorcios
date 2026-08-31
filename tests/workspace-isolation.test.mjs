import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test, { beforeEach, afterEach } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const main = { userId: "main-admin" };
const sandbox = { userId: "d79be8bc-b585-4d99-9a58-1d4e17593c92" };
let sqlite, store, auth, database, serial = 0;

// Run the real stores and initializer against SQLite, using only a D1 API adapter.
function statement(sql, args = []) {
  return {
    bind(...values) { return statement(sql, values); },
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return sqlite.prepare(sql).run(...args); },
  };
}

async function moduleFrom(path, replacement) {
  const input = (await readFile(new URL(path, root), "utf8")).replace(...replacement);
  const { outputText } = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText + `\n// fixture ${serial++}`).toString("base64")}`);
}

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = (await readdir(new URL("drizzle/", root))).filter((name) => name.endsWith(".sql")).sort();
  for (const migration of migrations.filter((name) => !name.startsWith("0012_"))) {
    sqlite.exec(await readFile(new URL(`drizzle/${migration}`, root), "utf8"));
  }
  sqlite.exec(`INSERT INTO users (id, username, email, name, role, status, password_hash, password_salt, password_iterations, created_at, last_seen_at)
    VALUES ('main-admin', 'admin', 'admin@tasker.local', 'Admin real', 'admin', 'active', 'unchanged', '00', 100000, 1, 1),
      ('main-member', 'member', 'member@tasker.local', 'Miembro real', 'member', 'active', 'unchanged', '00', 100000, 2, 2);
    INSERT INTO consorcios (id, name, address, notes, created_at, updated_at) VALUES ('main-building', 'Florida 249', 'Florida 249', 'REAL', 1, 1);
    INSERT INTO tasks (id, title, creator_id, consortium_id, building, created_at, updated_at)
      VALUES ('main-task', 'Tarea real', 'main-member', 'main-building', 'Florida 249', 1, 1);
    INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES ('main-comment', 'main-task', 'main-member', 'Comentario real', 1);`);
  for (const migration of migrations.filter((name) => name.startsWith("0012_"))) {
    sqlite.exec(await readFile(new URL(`drizzle/${migration}`, root), "utf8"));
  }
  globalThis.__workspaceTestDb = {
    prepare: statement,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const item of statements) result.push(await item.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  database = await moduleFrom("db/database.ts", [
    'import { env } from "cloudflare:workers";', 'const env = { DB: globalThis.__workspaceTestDb };',
  ]);
  globalThis.__workspaceTestServices = database;
  const replacement = ['import { ensureDatabase, getDatabase } from "./database";',
    'const { ensureDatabase, getDatabase } = globalThis.__workspaceTestServices;'];
  store = await moduleFrom("db/task-store.ts", replacement);
  auth = await moduleFrom("db/auth-store.ts", replacement);
  await database.ensureDatabase();
});

afterEach(() => { sqlite.close(); });

test("migration preserves existing data and seeds a working isolated login", async () => {
  const before = sqlite.prepare("SELECT password_hash, workspace_id FROM users WHERE id = ?").get(main.userId);
  assert.equal(before.password_hash, "unchanged");
  assert.equal(before.workspace_id, "main");
  assert.equal(sqlite.prepare("SELECT workspace_id FROM tasks WHERE id = 'main-task'").get().workspace_id, "main");
  const session = await auth.login("test", "test123");
  assert.equal((await auth.validateSession(session.token)).userId, sandbox.userId);
  await assert.rejects(auth.login("test", "incorrecta"));
  await auth.logout(session.token);
  assert.equal(await auth.validateSession(session.token), null);
});

test("both admins see only their own workspace; normal task visibility stays intact", async () => {
  await store.createTask(sandbox, { title: "Tarea de prueba" });
  await store.createTask(main, { title: "Privada del admin" });
  const real = await store.loadWorkspace(main);
  const trial = await store.loadWorkspace(sandbox);
  assert.equal(real.tasks.length, 2);
  assert.equal(trial.tasks.length, 1);
  assert.deepEqual(trial.users.map((user) => user.username), ["test"]);
  assert.equal(trial.consorcios.length, 0);
  assert.equal(real.users.some((user) => user.username === "test"), false);
  const member = await store.loadWorkspace({ userId: "main-member" });
  assert.deepEqual(member.tasks.map((task) => task.id), ["main-task"]);
});

test("task assignment, buildings, editing, comments and deletion reject cross-workspace IDs", async () => {
  const trial = await store.createTask(sandbox, { title: "Prueba" });
  const trialTask = trial.tasks[0].id;
  const consortia = await store.createConsortium(sandbox, { name: "Florida 249" });
  const trialBuilding = consortia.consorcios[0].id;
  for (const [actor, ownTask, otherTask, otherUser, otherBuilding] of [
    [sandbox, trialTask, "main-task", main.userId, "main-building"],
    [main, "main-task", trialTask, sandbox.userId, trialBuilding],
  ]) {
    await assert.rejects(store.createTask(actor, { title: "Invasión", assigneeId: otherUser }));
    await assert.rejects(store.createTask(actor, { title: "Invasión", consortiumId: otherBuilding }));
    await assert.rejects(store.updateTask(actor, ownTask, { assigneeId: otherUser }));
    await assert.rejects(store.updateTask(actor, ownTask, { consortiumId: otherBuilding }));
    await assert.rejects(store.updateTask(actor, otherTask, { status: "done" }));
    await assert.rejects(store.addComment(actor, otherTask, "No permitido"));
    await assert.rejects(store.deleteTask(actor, otherTask));
    await assert.rejects(store.updateConsortium(actor, otherBuilding, { name: "Invadido" }));
    await assert.rejects(store.deleteConsortium(actor, otherBuilding));
  }
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM tasks").get().n, 2);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM comments").get().n, 1);
});

test("sandbox CRUD and same-workspace collaboration still work", async () => {
  await auth.importUsers(sandbox.userId, [{ username: "test-helper", name: "Ayudante de prueba", password: "123" }]);
  const helper = (await store.loadWorkspace(sandbox)).users.find((user) => user.username === "test-helper");
  assert.equal(helper.workspaceId, "test");
  const building = (await store.createConsortium(sandbox, { name: "Florida 249" })).consorcios[0];
  const task = (await store.createTask(sandbox, { title: "Colaborar", consortiumId: building.id, assigneeId: helper.id })).tasks[0];
  await store.addComment({ userId: helper.id }, task.id, "Recibido");
  await store.updateTask({ userId: helper.id }, task.id, { status: "in_progress" });
  await store.updateConsortium(sandbox, building.id, { name: "Consorcio de prueba" });
  const current = (await store.loadWorkspace(sandbox)).tasks[0];
  assert.equal(current.comments[0].body, "Recibido");
  assert.equal(current.status, "in_progress");
  assert.equal(current.building, "Consorcio de prueba");
  await store.deleteTask(sandbox, task.id);
  await store.deleteConsortium(sandbox, building.id);
  await auth.deleteUserProfile(sandbox.userId, helper.id);
  assert.equal((await store.loadWorkspace(main)).tasks[0].id, "main-task");
});

test("user imports and profile changes cannot modify accounts in another workspace", async () => {
  for (const [actor, target, targetUsername] of [[sandbox, main, "admin"], [main, sandbox, "test"]]) {
    await assert.rejects(auth.importUsers(actor.userId, [
      { username: "new-before-collision", name: "No guardar", password: "123" },
      { username: targetUsername, name: "Invadido", password: "123" },
    ]));
    await assert.rejects(auth.updateUserProfile(actor.userId, target.userId, { username: "invadido", name: "Invadido", role: "member" }));
    await assert.rejects(auth.deleteUserProfile(actor.userId, target.userId));
    await assert.rejects(auth.updateUserProfile(actor.userId, actor.userId, { username: actor === main ? "admin" : "test", name: "Admin", role: "member" }));
  }
  await assert.rejects(auth.importUsers(sandbox.userId, [{ username: "test", name: "Test", password: "123", role: "member" }]));
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM users").get().n, 3);
  assert.equal((await auth.validateSession((await auth.login("test", "test123")).token)).userId, sandbox.userId);
});

test("daemon intake stays in main, simulation stays in test, and deduplication is scoped", async () => {
  const event = { source: "email", sourceAccount: "central@example.com", externalId: "mail-1", conversationId: "thread-1", title: "Solicitud Florida 249", body: "Necesito una reparación" };
  // An extra browser/payload field cannot override the trusted default argument.
  const real = await store.ingestAutomaticItem({ ...event, workspaceId: "test" });
  const trial = await store.ingestAutomaticItem(event, "test");
  assert.notEqual(real.taskId, trial.taskId);
  assert.equal((await store.ingestAutomaticItem(event)).duplicate, true);
  assert.equal((await store.ingestAutomaticItem(event, "test")).duplicate, true);
  assert.equal((await store.loadWorkspace(main)).intakeItems[0].consortiumId, "main-building");
  assert.equal((await store.loadWorkspace(sandbox)).intakeItems[0].consortiumId, null);
  await assert.rejects(store.reviewAutomaticIntake(sandbox, real.intakeId, "discard"));
  await assert.rejects(store.reviewAutomaticIntake(main, trial.intakeId, "accept"));
  await store.reviewAutomaticIntake(sandbox, trial.intakeId, "accept");
  await store.updateTask(sandbox, trial.taskId, { status: "done" });
  const reply = await store.ingestAutomaticItem({ ...event, externalId: "mail-2", body: "Sigue el problema" }, "test");
  assert.equal(reply.action, "reopened");
  assert.equal(reply.taskId, trial.taskId);
  assert.equal((await store.loadWorkspace(main)).tasks.find((task) => task.id === real.taskId).comments.length, 0);
  const before = (await store.loadWorkspace(main)).intakeItems.length;
  await store.createAutomaticIntakeTest(sandbox, { source: "whatsapp", title: "Prueba del formulario" });
  assert.equal((await store.loadWorkspace(main)).intakeItems.length, before);
  await store.recordDaemonHeartbeat({ instanceId: "real-pc", name: "PC real" });
  assert.equal((await store.loadWorkspace(sandbox)).daemons.length, 0);
  assert.equal((await store.loadWorkspace(main)).daemons.length, 1);
});

test("reset deletes only the current workspace's operations", async () => {
  await store.createAutomaticIntakeTest(sandbox, { source: "email", title: "Prueba" });
  const task = (await store.loadWorkspace(sandbox)).tasks[0];
  await store.addComment(sandbox, task.id, "Prueba");
  const reset = await store.resetOperationalData(sandbox);
  assert.deepEqual(reset.deleted, { tasks: 1, comments: 1, intakeItems: 1 });
  assert.equal((await store.loadWorkspace(main)).tasks[0].comments[0].body, "Comentario real");
  await store.createAutomaticIntakeTest(sandbox, { source: "email", title: "Conservar" });
  await store.resetOperationalData(main);
  assert.equal((await store.loadWorkspace(sandbox)).tasks.length, 1);
  assert.equal((await store.loadWorkspace(main)).consorcios.length, 1);
});

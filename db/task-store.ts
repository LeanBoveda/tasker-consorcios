import { env } from "cloudflare:workers";
import type { AuthIdentity } from "@/lib/current-user";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  status: "active" | "invited";
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: number;
  authorId: string;
  authorName: string;
};

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  building: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "review" | "done";
  dueDate: string | null;
  creatorId: string;
  creatorName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: number;
  updatedAt: number;
  comments: TaskComment[];
};

export type WorkspaceData = {
  currentUser: AppUser;
  users: AppUser[];
  tasks: TaskItem[];
};

type UserRow = AppUser;
type TaskRow = {
  id: string; title: string; description: string; building: string;
  priority: TaskItem["priority"]; status: TaskItem["status"]; due_date: string | null;
  creator_id: string; creator_name: string; assignee_id: string | null;
  assignee_name: string | null; created_at: number; updated_at: number;
};
type CommentRow = {
  id: string; task_id: string; body: string; created_at: number;
  author_id: string; author_name: string;
};

let schemaPromise: Promise<void> | null = null;

function database(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

async function ensureSchema() {
  if (!schemaPromise) {
    const db = database();
    schemaPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        auth_user_id TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited')),
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
      db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_creator_status ON tasks (creator_id, status)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks (assignee_id, status)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_task_created ON comments (task_id, created_at)"),
      db.prepare("PRAGMA optimize"),
    ]).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

async function ensureUser(identity: AuthIdentity): Promise<AppUser> {
  await ensureSchema();
  const db = database();
  const now = Date.now();
  let row = await db.prepare(
    "SELECT id, email, name, role, status FROM users WHERE auth_user_id = ?"
  ).bind(identity.userId).first<UserRow>();

  if (!row) {
    row = await db.prepare(
      "SELECT id, email, name, role, status FROM users WHERE lower(email) = lower(?)"
    ).bind(identity.email).first<UserRow>();
    if (row) {
      await db.prepare(
        "UPDATE users SET auth_user_id = ?, name = ?, email = ?, status = 'active', last_seen_at = ? WHERE id = ?"
      ).bind(identity.userId, identity.displayName, identity.email, now, row.id).run();
    } else {
      const count = await db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
      const id = crypto.randomUUID();
      const role = Number(count?.total ?? 0) === 0 ? "admin" : "member";
      await db.prepare(
        "INSERT INTO users (id, auth_user_id, email, name, role, status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)"
      ).bind(id, identity.userId, identity.email, identity.displayName, role, now, now).run();
      row = { id, email: identity.email, name: identity.displayName, role, status: "active" };
    }
  } else {
    await db.prepare("UPDATE users SET name = ?, email = ?, last_seen_at = ? WHERE id = ?")
      .bind(identity.displayName, identity.email, now, row.id).run();
  }

  const user = { ...row, email: identity.email, name: identity.displayName, status: "active" as const };
  if (identity.userId === "local-admin") await seedLocalDemo(user.id);
  return user;
}

async function seedLocalDemo(adminId: string) {
  const db = database();
  const marker = await db.prepare("SELECT id FROM users WHERE email = 'laura@tasker.local'").first();
  if (marker) return;
  const now = Date.now();
  const lauraId = crypto.randomUUID();
  const juanId = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO users (id, auth_user_id, email, name, role, status, created_at, last_seen_at) VALUES (?, NULL, ?, ?, 'member', 'invited', ?, ?)")
      .bind(lauraId, "laura@tasker.local", "Laura Martín", now, now),
    db.prepare("INSERT INTO users (id, auth_user_id, email, name, role, status, created_at, last_seen_at) VALUES (?, NULL, ?, ?, 'member', 'invited', ?, ?)")
      .bind(juanId, "juan@tasker.local", "Juan Pérez", now, now),
  ]);

  const taskCount = await db.prepare("SELECT COUNT(*) AS total FROM tasks").first<{ total: number }>();
  if (Number(taskCount?.total ?? 0) > 0) return;
  const demoTasks = [
    ["Revisar presupuesto del ascensor", "Comparar las dos propuestas y confirmar cobertura.", "Av. Cabildo 1842", "high", "pending", adminId],
    ["Enviar liquidación de expensas", "Validar saldos antes del envío mensual.", "Amenábar 936", "medium", "pending", lauraId],
    ["Coordinar reparación de bomba", "El proveedor confirmó disponibilidad por la tarde.", "Aráoz 1240", "high", "in_progress", juanId],
    ["Actualizar seguro integral", "Revisar suma asegurada y vigencia.", "Av. Santa Fe 3221", "medium", "in_progress", adminId],
    ["Control de matafuegos", "Esperando certificado final del proveedor.", "Amenábar 936", "low", "review", lauraId],
    ["Pago de servicio de limpieza", "Comprobante cargado en la carpeta del consorcio.", "Av. Cabildo 1842", "medium", "done", juanId],
  ] as const;
  await db.batch(demoTasks.map((task, index) => {
    const due = new Date(Date.now() + (index < 3 ? index : index + 1) * 86400000).toISOString().slice(0, 10);
    return db.prepare(`INSERT INTO tasks
      (id, title, description, building, priority, status, due_date, creator_id, assignee_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), task[0], task[1], task[2], task[3], task[4], due, adminId, task[5], now - index * 3600000, now);
  }));
}

export async function loadWorkspace(identity: AuthIdentity): Promise<WorkspaceData> {
  const currentUser = await ensureUser(identity);
  const db = database();
  const usersResult = await db.prepare(
    "SELECT id, email, name, role, status FROM users ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, name"
  ).all<UserRow>();
  const tasksResult = await db.prepare(`SELECT
      t.id, t.title, t.description, t.building, t.priority, t.status, t.due_date,
      t.creator_id, creator.name AS creator_name, t.assignee_id,
      assignee.name AS assignee_name, t.created_at, t.updated_at
    FROM tasks t
    JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    WHERE t.creator_id = ? OR t.assignee_id = ?
    ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.updated_at DESC`)
    .bind(currentUser.id, currentUser.id).all<TaskRow>();

  const taskRows = tasksResult.results ?? [];
  let comments: CommentRow[] = [];
  if (taskRows.length) {
    const placeholders = taskRows.map(() => "?").join(",");
    const result = await db.prepare(`SELECT c.id, c.task_id, c.body, c.created_at,
        c.author_id, u.name AS author_name
      FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.task_id IN (${placeholders}) ORDER BY c.created_at`)
      .bind(...taskRows.map((task) => task.id)).all<CommentRow>();
    comments = result.results ?? [];
  }

  return {
    currentUser,
    users: usersResult.results ?? [],
    tasks: taskRows.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      building: task.building,
      priority: task.priority,
      status: task.status,
      dueDate: task.due_date,
      creatorId: task.creator_id,
      creatorName: task.creator_name,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      comments: comments.filter((comment) => comment.task_id === task.id).map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at,
        authorId: comment.author_id,
        authorName: comment.author_name,
      })),
    })),
  };
}

export async function createTask(identity: AuthIdentity, input: {
  title: string; description?: string; building?: string; priority?: string;
  status?: string; dueDate?: string | null; assigneeId?: string | null;
}) {
  const user = await ensureUser(identity);
  const title = input.title?.trim();
  if (!title) throw new Error("El título es obligatorio");
  const priority = ["low", "medium", "high"].includes(input.priority ?? "") ? input.priority : "medium";
  const status = ["pending", "in_progress", "review", "done"].includes(input.status ?? "") ? input.status : "pending";
  const db = database();
  if (input.assigneeId) {
    const assignee = await db.prepare("SELECT id FROM users WHERE id = ?").bind(input.assigneeId).first();
    if (!assignee) throw new Error("La persona asignada no existe");
  }
  const now = Date.now();
  await db.prepare(`INSERT INTO tasks
    (id, title, description, building, priority, status, due_date, creator_id, assignee_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), title, input.description?.trim() ?? "", input.building?.trim() ?? "",
      priority, status, input.dueDate || null, user.id, input.assigneeId || null, now, now).run();
  return loadWorkspace(identity);
}

export async function updateTask(identity: AuthIdentity, taskId: string, input: {
  title?: string; description?: string; building?: string; priority?: string;
  status?: string; dueDate?: string | null; assigneeId?: string | null;
}) {
  const user = await ensureUser(identity);
  const db = database();
  const task = await db.prepare("SELECT creator_id, assignee_id FROM tasks WHERE id = ?")
    .bind(taskId).first<{ creator_id: string; assignee_id: string | null }>();
  if (!task || (task.creator_id !== user.id && task.assignee_id !== user.id)) throw new Error("Tarea no encontrada");

  const creatorCanEdit = task.creator_id === user.id;
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (input.status && ["pending", "in_progress", "review", "done"].includes(input.status)) {
    fields.push("status = ?"); values.push(input.status);
  }
  if (creatorCanEdit) {
    if (input.title?.trim()) { fields.push("title = ?"); values.push(input.title.trim()); }
    if (typeof input.description === "string") { fields.push("description = ?"); values.push(input.description.trim()); }
    if (typeof input.building === "string") { fields.push("building = ?"); values.push(input.building.trim()); }
    if (input.priority && ["low", "medium", "high"].includes(input.priority)) { fields.push("priority = ?"); values.push(input.priority); }
    if ("dueDate" in input) { fields.push("due_date = ?"); values.push(input.dueDate || null); }
    if ("assigneeId" in input) {
      if (input.assigneeId) {
        const assignee = await db.prepare("SELECT id FROM users WHERE id = ?").bind(input.assigneeId).first();
        if (!assignee) throw new Error("La persona asignada no existe");
      }
      fields.push("assignee_id = ?"); values.push(input.assigneeId || null);
    }
  }
  if (!fields.length) return loadWorkspace(identity);
  fields.push("updated_at = ?"); values.push(Date.now(), taskId);
  await db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  return loadWorkspace(identity);
}

export async function addComment(identity: AuthIdentity, taskId: string, bodyValue: string) {
  const user = await ensureUser(identity);
  const body = bodyValue.trim();
  if (!body) throw new Error("Escribí un comentario");
  const db = database();
  const task = await db.prepare(
    "SELECT id FROM tasks WHERE id = ? AND (creator_id = ? OR assignee_id = ?)"
  ).bind(taskId, user.id, user.id).first();
  if (!task) throw new Error("Tarea no encontrada");
  const now = Date.now();
  await db.batch([
    db.prepare("INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), taskId, user.id, body, now),
    db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(now, taskId),
  ]);
  return loadWorkspace(identity);
}

export async function inviteUser(identity: AuthIdentity, input: { name: string; email: string }) {
  const user = await ensureUser(identity);
  if (user.role !== "admin") throw new Error("Solo el administrador puede agregar integrantes");
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Completá un nombre y correo válidos");
  const db = database();
  const existing = await db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").bind(email).first();
  if (existing) throw new Error("Ese usuario ya pertenece al equipo");
  const now = Date.now();
  await db.prepare(
    "INSERT INTO users (id, auth_user_id, email, name, role, status, created_at, last_seen_at) VALUES (?, NULL, ?, ?, 'member', 'invited', ?, ?)"
  ).bind(crypto.randomUUID(), email, name, now, now).run();
  return loadWorkspace(identity);
}

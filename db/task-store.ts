import type { AuthIdentity } from "@/lib/current-user";
import { ensureDatabase, getDatabase } from "./database";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: "admin" | "member";
  status: "active" | "invited";
};
export type TaskComment = {
  id: string; body: string; createdAt: number; authorId: string; authorName: string;
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
export type WorkspaceData = { currentUser: AppUser; users: AppUser[]; tasks: TaskItem[] };

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

async function currentUser(identity: AuthIdentity): Promise<AppUser> {
  await ensureDatabase();
  const db = getDatabase();
  const user = await db.prepare(`SELECT id, username, email, name, role, status
    FROM users WHERE id = ? AND status = 'active'`).bind(identity.userId).first<AppUser>();
  if (!user) throw new Error("Usuario no autorizado");
  await db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(Date.now(), user.id).run();
  return user;
}

export async function loadWorkspace(identity: AuthIdentity): Promise<WorkspaceData> {
  const user = await currentUser(identity);
  const db = getDatabase();
  const usersResult = await db.prepare(`SELECT id, username, email, name, role, status
    FROM users WHERE status = 'active'
    ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, name`).all<AppUser>();
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
    .bind(user.id, user.id).all<TaskRow>();

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
    currentUser: user,
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
  const user = await currentUser(identity);
  const title = input.title?.trim();
  if (!title) throw new Error("El título es obligatorio");
  const priority = ["low", "medium", "high"].includes(input.priority ?? "") ? input.priority : "medium";
  const status = ["pending", "in_progress", "review", "done"].includes(input.status ?? "") ? input.status : "pending";
  const db = getDatabase();
  if (input.assigneeId) {
    const assignee = await db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").bind(input.assigneeId).first();
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
  const user = await currentUser(identity);
  const db = getDatabase();
  const task = await db.prepare("SELECT creator_id, assignee_id FROM tasks WHERE id = ?")
    .bind(taskId).first<{ creator_id: string; assignee_id: string | null }>();
  if (!task || (task.creator_id !== user.id && task.assignee_id !== user.id)) throw new Error("Tarea no encontrada");

  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (input.status && ["pending", "in_progress", "review", "done"].includes(input.status)) {
    fields.push("status = ?"); values.push(input.status);
  }
  if (task.creator_id === user.id) {
    if (input.title?.trim()) { fields.push("title = ?"); values.push(input.title.trim()); }
    if (typeof input.description === "string") { fields.push("description = ?"); values.push(input.description.trim()); }
    if (typeof input.building === "string") { fields.push("building = ?"); values.push(input.building.trim()); }
    if (input.priority && ["low", "medium", "high"].includes(input.priority)) { fields.push("priority = ?"); values.push(input.priority); }
    if ("dueDate" in input) { fields.push("due_date = ?"); values.push(input.dueDate || null); }
    if ("assigneeId" in input) {
      if (input.assigneeId) {
        const assignee = await db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").bind(input.assigneeId).first();
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
  const user = await currentUser(identity);
  const body = bodyValue.trim();
  if (!body) throw new Error("Escribí un comentario");
  const db = getDatabase();
  const task = await db.prepare("SELECT id FROM tasks WHERE id = ? AND (creator_id = ? OR assignee_id = ?)")
    .bind(taskId, user.id, user.id).first();
  if (!task) throw new Error("Tarea no encontrada");
  const now = Date.now();
  await db.batch([
    db.prepare("INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), taskId, user.id, body, now),
    db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(now, taskId),
  ]);
  return loadWorkspace(identity);
}

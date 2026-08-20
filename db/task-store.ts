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
export type ConsortiumItem = {
  id: string;
  name: string;
  address: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
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
  consortiumId: string | null;
  creatorId: string;
  creatorName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: number;
  updatedAt: number;
  comments: TaskComment[];
};
export type ClaimItem = {
  id: string;
  source: "email";
  isTest: boolean;
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  category: "ascensor" | "agua" | "gas" | "electricidad" | "seguridad" | "limpieza" | "convivencia" | "administracion" | "mantenimiento" | "otro";
  priority: "low" | "medium" | "high";
  status: "new" | "assigned" | "in_progress" | "waiting" | "resolved" | "closed";
  consortiumId: string | null;
  consortiumName: string | null;
  taskId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: number;
  updatedAt: number;
};
export type WorkspaceData = { currentUser: AppUser; users: AppUser[]; consorcios: ConsortiumItem[]; tasks: TaskItem[]; claims: ClaimItem[] };

type TaskRow = {
  id: string; title: string; description: string; building: string;
  priority: TaskItem["priority"]; status: TaskItem["status"]; due_date: string | null;
  consortium_id: string | null;
  creator_id: string; creator_name: string; assignee_id: string | null;
  assignee_name: string | null; created_at: number; updated_at: number;
};
type CommentRow = {
  id: string; task_id: string; body: string; created_at: number;
  author_id: string; author_name: string;
};
type ClaimRow = {
  id: string; source: ClaimItem["source"]; is_test: number; sender_name: string;
  sender_email: string; subject: string; body: string; category: ClaimItem["category"];
  priority: ClaimItem["priority"]; status: ClaimItem["status"];
  consortium_id: string | null; consortium_name: string | null; task_id: string | null;
  assigned_to_id: string | null; assigned_to_name: string | null;
  created_at: number; updated_at: number;
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
  const consorciosResult = await db.prepare(`SELECT id, name, address, notes,
      created_at AS createdAt, updated_at AS updatedAt
    FROM consorcios ORDER BY name COLLATE NOCASE`).all<ConsortiumItem>();
  const tasksResult = await db.prepare(`SELECT
      t.id, t.title, t.description, t.building, t.priority, t.status, t.due_date,
      t.consortium_id, t.creator_id, creator.name AS creator_name, t.assignee_id,
      assignee.name AS assignee_name, t.created_at, t.updated_at
    FROM tasks t
    JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    WHERE t.creator_id = ? OR t.assignee_id = ?
    ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.updated_at DESC`)
    .bind(user.id, user.id).all<TaskRow>();

  const taskRows = tasksResult.results ?? [];
  const claimsResult = user.role === "admin"
    ? await db.prepare(`SELECT r.id, r.source, r.is_test, r.sender_name, r.sender_email,
        r.subject, r.body, r.category, r.priority, r.status, r.consortium_id,
        c.name AS consortium_name, r.task_id, r.assigned_to_id,
        assignee.name AS assigned_to_name, r.created_at, r.updated_at
      FROM claims r
      LEFT JOIN consorcios c ON c.id = r.consortium_id
      LEFT JOIN users assignee ON assignee.id = r.assigned_to_id
      ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'assigned' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'waiting' THEN 3 ELSE 4 END,
        r.created_at DESC`).all<ClaimRow>()
    : await db.prepare(`SELECT r.id, r.source, r.is_test, r.sender_name, r.sender_email,
        r.subject, r.body, r.category, r.priority, r.status, r.consortium_id,
        c.name AS consortium_name, r.task_id, r.assigned_to_id,
        assignee.name AS assigned_to_name, r.created_at, r.updated_at
      FROM claims r
      LEFT JOIN consorcios c ON c.id = r.consortium_id
      LEFT JOIN users assignee ON assignee.id = r.assigned_to_id
      WHERE r.assigned_to_id = ?
      ORDER BY r.created_at DESC`).bind(user.id).all<ClaimRow>();
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
    consorcios: consorciosResult.results ?? [],
    tasks: taskRows.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      building: task.building,
      priority: task.priority,
      status: task.status,
      dueDate: task.due_date,
      consortiumId: task.consortium_id,
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
    claims: (claimsResult.results ?? []).map((claim) => ({
      id: claim.id,
      source: claim.source,
      isTest: Boolean(claim.is_test),
      senderName: claim.sender_name,
      senderEmail: claim.sender_email,
      subject: claim.subject,
      body: claim.body,
      category: claim.category,
      priority: claim.priority,
      status: claim.status,
      consortiumId: claim.consortium_id,
      consortiumName: claim.consortium_name,
      taskId: claim.task_id,
      assignedToId: claim.assigned_to_id,
      assignedToName: claim.assigned_to_name,
      createdAt: claim.created_at,
      updatedAt: claim.updated_at,
    })),
  };
}

function classifyEmail(subject: string, body: string): Pick<ClaimItem, "category" | "priority"> {
  const text = `${subject} ${body}`.toLocaleLowerCase("es");
  const categories: Array<{ category: ClaimItem["category"]; words: string[] }> = [
    { category: "ascensor", words: ["ascensor", "elevador", "atrapad"] },
    { category: "gas", words: ["gas", "olor extraño", "olor extrano"] },
    { category: "agua", words: ["agua", "caño", "cano", "pérdida", "perdida", "inund"] },
    { category: "electricidad", words: ["luz", "eléctric", "electric", "cortocircuito", "disyuntor"] },
    { category: "seguridad", words: ["robo", "puerta", "portón", "porton", "cámara", "camara", "matafuego"] },
    { category: "limpieza", words: ["limpieza", "sucio", "basura"] },
    { category: "convivencia", words: ["ruido", "vecino", "molest", "reglamento"] },
    { category: "administracion", words: ["expensa", "pago", "liquidación", "liquidacion", "recibo"] },
    { category: "mantenimiento", words: ["repar", "mantenimiento", "humedad", "pared", "techo"] },
  ];
  const category = categories.find((rule) => rule.words.some((word) => text.includes(word)))?.category ?? "otro";
  const urgentWords = ["urgente", "persona atrapada", "olor a gas", "incendio", "humo", "inundación", "inundacion", "sin agua", "sin luz", "cortocircuito"];
  const lowWords = ["consulta", "información", "informacion", "cuando puedan", "sin apuro"];
  const priority = urgentWords.some((word) => text.includes(word))
    ? "high"
    : lowWords.some((word) => text.includes(word)) ? "low" : "medium";
  return { category, priority };
}

export async function createEmailClaimTest(identity: AuthIdentity, input: {
  senderName?: string; senderEmail?: string; subject?: string; body?: string; consortiumId?: string | null;
}) {
  const user = await currentUser(identity);
  if (user.role !== "admin") throw new Error("Solo el administrador puede ejecutar la prueba de correo");
  const senderEmail = input.senderEmail?.trim().toLocaleLowerCase("es") ?? "";
  const subject = input.subject?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!senderEmail || !senderEmail.includes("@")) throw new Error("Ingresá un correo del remitente válido");
  if (!subject) throw new Error("El asunto es obligatorio");
  if (!body) throw new Error("El mensaje es obligatorio");

  const db = getDatabase();
  let building = "";
  if (input.consortiumId) {
    const consortium = await db.prepare("SELECT name FROM consorcios WHERE id = ?")
      .bind(input.consortiumId).first<{ name: string }>();
    if (!consortium) throw new Error("El consorcio seleccionado no existe");
    building = consortium.name;
  }

  const classification = classifyEmail(subject, body);
  const claimId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const now = Date.now();
  const senderName = input.senderName?.trim() || "Remitente sin nombre";
  const taskDescription = `Correo de prueba recibido de ${senderName} <${senderEmail}>\n\n${body}\n\nReclamo ${claimId.slice(0, 8)} · clasificación automática de prueba.`;

  await db.batch([
    db.prepare(`INSERT INTO tasks
      (id, title, description, building, priority, status, due_date, consortium_id, creator_id, assignee_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?, ?, ?)`)
      .bind(taskId, subject, taskDescription, building, classification.priority,
        input.consortiumId || null, user.id, user.id, now, now),
    db.prepare(`INSERT INTO claims
      (id, source, is_test, external_id, sender_name, sender_email, subject, body, category, priority, status,
       consortium_id, task_id, created_by_id, assigned_to_id, created_at, updated_at)
      VALUES (?, 'email', 1, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?, ?, ?, ?, ?)`)
      .bind(claimId, `test-email:${claimId}`, senderName, senderEmail, subject, body,
        classification.category, classification.priority, input.consortiumId || null,
        taskId, user.id, user.id, now, now),
  ]);
  return loadWorkspace(identity);
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function ingestEmailClaim(input: {
  externalId?: string; senderName?: string; senderEmail?: string; subject?: string; body?: string; receivedAt?: number;
}) {
  await ensureDatabase();
  const externalIdValue = input.externalId?.trim().slice(0, 200) ?? "";
  const senderEmail = input.senderEmail?.trim().toLocaleLowerCase("es").slice(0, 320) ?? "";
  const rawSubject = input.subject?.trim().slice(0, 500) ?? "";
  const body = input.body?.trim().slice(0, 20000) ?? "";
  if (!externalIdValue) throw new Error("El mensaje no tiene identificador");
  if (!senderEmail || !senderEmail.includes("@")) throw new Error("El remitente no es válido");
  if (!/^\[reclamo\]/i.test(rawSubject)) throw new Error("El asunto debe comenzar con [RECLAMO]");
  if (!body) throw new Error("El mensaje está vacío");

  const db = getDatabase();
  const externalId = `gmail:${externalIdValue}`;
  const existing = await db.prepare("SELECT id, task_id FROM claims WHERE external_id = ?")
    .bind(externalId).first<{ id: string; task_id: string | null }>();
  if (existing) return { ok: true, duplicate: true, claimId: existing.id, taskId: existing.task_id };

  const admin = await db.prepare(`SELECT id FROM users
    WHERE role = 'admin' AND status = 'active' ORDER BY created_at LIMIT 1`).first<{ id: string }>();
  if (!admin) throw new Error("No hay un administrador activo para asignar el reclamo");

  const cleanSubject = rawSubject.replace(/^\[reclamo\]\s*/i, "").trim() || "Reclamo recibido por correo";
  const searchable = normalizedText(`${cleanSubject} ${body}`);
  const consortia = await db.prepare("SELECT id, name, address FROM consorcios ORDER BY length(name) DESC")
    .all<{ id: string; name: string; address: string }>();
  const consortium = (consortia.results ?? []).find((item) => {
    const name = normalizedText(item.name);
    const address = normalizedText(item.address);
    return (name.length >= 4 && searchable.includes(name)) || (address.length >= 5 && searchable.includes(address));
  }) ?? null;

  const classification = classifyEmail(cleanSubject, body);
  const claimId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const now = Number.isFinite(input.receivedAt) && Number(input.receivedAt) > 0
    ? Math.min(Number(input.receivedAt), Date.now()) : Date.now();
  const senderName = input.senderName?.trim().slice(0, 300) || "Remitente sin nombre";
  const taskDescription = `Correo recibido de ${senderName} <${senderEmail}>\n\n${body}\n\nReclamo ${claimId.slice(0, 8)} · ingresado automáticamente desde Gmail.`;

  await db.batch([
    db.prepare(`INSERT INTO tasks
      (id, title, description, building, priority, status, due_date, consortium_id, creator_id, assignee_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?, ?, ?)`)
      .bind(taskId, cleanSubject, taskDescription, consortium?.name ?? "", classification.priority,
        consortium?.id ?? null, admin.id, admin.id, now, now),
    db.prepare(`INSERT INTO claims
      (id, source, is_test, external_id, sender_name, sender_email, subject, body, category, priority, status,
       consortium_id, task_id, created_by_id, assigned_to_id, created_at, updated_at)
      VALUES (?, 'email', 0, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?, NULL, ?, ?, ?)`)
      .bind(claimId, externalId, senderName, senderEmail, cleanSubject, body,
        classification.category, classification.priority, consortium?.id ?? null,
        taskId, admin.id, now, now),
  ]);

  return { ok: true, duplicate: false, claimId, taskId, category: classification.category, priority: classification.priority, consortium: consortium?.name ?? null };
}

export async function createTask(identity: AuthIdentity, input: {
  title: string; description?: string; consortiumId?: string | null; priority?: string;
  status?: string; dueDate?: string | null; assigneeId?: string | null;
}) {
  const user = await currentUser(identity);
  const title = input.title?.trim();
  if (!title) throw new Error("El título es obligatorio");
  const priority = ["low", "medium", "high"].includes(input.priority ?? "") ? input.priority : "medium";
  const status = ["pending", "in_progress", "review", "done"].includes(input.status ?? "") ? input.status : "pending";
  const db = getDatabase();
  let building = "";
  if (input.consortiumId) {
    const consortium = await db.prepare("SELECT name FROM consorcios WHERE id = ?")
      .bind(input.consortiumId).first<{ name: string }>();
    if (!consortium) throw new Error("El consorcio seleccionado no existe");
    building = consortium.name;
  }
  if (input.assigneeId) {
    const assignee = await db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").bind(input.assigneeId).first();
    if (!assignee) throw new Error("La persona asignada no existe");
  }
  const now = Date.now();
  await db.prepare(`INSERT INTO tasks
    (id, title, description, building, priority, status, due_date, consortium_id, creator_id, assignee_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), title, input.description?.trim() ?? "", building,
      priority, status, input.dueDate || null, input.consortiumId || null, user.id, input.assigneeId || null, now, now).run();
  return loadWorkspace(identity);
}

export async function updateTask(identity: AuthIdentity, taskId: string, input: {
  title?: string; description?: string; consortiumId?: string | null; priority?: string;
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
    if ("consortiumId" in input) {
      let building = "";
      if (input.consortiumId) {
        const consortium = await db.prepare("SELECT name FROM consorcios WHERE id = ?")
          .bind(input.consortiumId).first<{ name: string }>();
        if (!consortium) throw new Error("El consorcio seleccionado no existe");
        building = consortium.name;
      }
      fields.push("consortium_id = ?", "building = ?");
      values.push(input.consortiumId || null, building);
    }
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

async function requireAdmin(identity: AuthIdentity) {
  const user = await currentUser(identity);
  if (user.role !== "admin") throw new Error("Solo el administrador puede gestionar consorcios");
  return user;
}

export async function createConsortium(identity: AuthIdentity, input: {
  name?: string; address?: string; notes?: string;
}) {
  await requireAdmin(identity);
  const name = input.name?.trim();
  if (!name) throw new Error("El nombre del consorcio es obligatorio");
  const db = getDatabase();
  const duplicate = await db.prepare("SELECT id FROM consorcios WHERE name = ? COLLATE NOCASE")
    .bind(name).first();
  if (duplicate) throw new Error("Ya existe un consorcio con ese nombre");
  const now = Date.now();
  await db.prepare(`INSERT INTO consorcios (id, name, address, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), name, input.address?.trim() ?? "", input.notes?.trim() ?? "", now, now).run();
  return loadWorkspace(identity);
}

export async function updateConsortium(identity: AuthIdentity, consortiumId: string, input: {
  name?: string; address?: string; notes?: string;
}) {
  await requireAdmin(identity);
  const name = input.name?.trim();
  if (!name) throw new Error("El nombre del consorcio es obligatorio");
  const db = getDatabase();
  const current = await db.prepare("SELECT id FROM consorcios WHERE id = ?").bind(consortiumId).first();
  if (!current) throw new Error("Consorcio no encontrado");
  const duplicate = await db.prepare("SELECT id FROM consorcios WHERE name = ? COLLATE NOCASE AND id <> ?")
    .bind(name, consortiumId).first();
  if (duplicate) throw new Error("Ya existe un consorcio con ese nombre");
  const now = Date.now();
  await db.batch([
    db.prepare(`UPDATE consorcios SET name = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?`)
      .bind(name, input.address?.trim() ?? "", input.notes?.trim() ?? "", now, consortiumId),
    db.prepare("UPDATE tasks SET building = ?, updated_at = ? WHERE consortium_id = ?")
      .bind(name, now, consortiumId),
  ]);
  return loadWorkspace(identity);
}

export async function deleteConsortium(identity: AuthIdentity, consortiumId: string) {
  await requireAdmin(identity);
  const db = getDatabase();
  const consortium = await db.prepare("SELECT id FROM consorcios WHERE id = ?").bind(consortiumId).first();
  if (!consortium) throw new Error("Consorcio no encontrado");
  await db.batch([
    db.prepare("UPDATE tasks SET consortium_id = NULL WHERE consortium_id = ?").bind(consortiumId),
    db.prepare("DELETE FROM consorcios WHERE id = ?").bind(consortiumId),
  ]);
  return loadWorkspace(identity);
}

export async function deleteTask(identity: AuthIdentity, taskId: string) {
  const user = await currentUser(identity);
  const db = getDatabase();
  const task = await db.prepare("SELECT creator_id FROM tasks WHERE id = ?")
    .bind(taskId).first<{ creator_id: string }>();
  if (!task || (task.creator_id !== user.id && user.role !== "admin")) {
    throw new Error("No tenés permiso para eliminar esta tarea");
  }

  await db.prepare("DELETE FROM tasks WHERE id = ?").bind(taskId).run();
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

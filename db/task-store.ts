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
  source: "manual" | "email" | "whatsapp" | "system";
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
export type IntakeAttachment = {
  name: string;
  contentType: string;
  size: number | null;
  url: string | null;
};
export type AutomaticIntakeItem = {
  id: string;
  source: "email" | "whatsapp";
  sourceAccount: string;
  externalId: string;
  conversationId: string | null;
  senderName: string;
  senderAddress: string;
  title: string;
  body: string;
  kind: "claim" | "request" | "order" | "notice" | "other";
  priority: "low" | "medium" | "high";
  status: "pending" | "accepted" | "discarded" | "error";
  consortiumId: string | null;
  consortiumName: string | null;
  taskId: string | null;
  attachments: IntakeAttachment[];
  isTest: boolean;
  errorDetail: string;
  receivedAt: number;
  reviewedByName: string | null;
  reviewedAt: number | null;
  createdAt: number;
  updatedAt: number;
};
export type DaemonSourceItem = {
  id: string;
  kind: "email" | "whatsapp";
  account: string;
  displayName: string;
  status: "connected" | "degraded" | "disconnected" | "disabled";
  lastCheckedAt: number;
  lastMessageAt: number | null;
  lastError: string;
};
export type DaemonInstanceItem = {
  id: string;
  name: string;
  hostName: string;
  version: string;
  status: "online" | "degraded" | "error" | "offline";
  startedAt: number;
  lastHeartbeatAt: number;
  lastError: string;
  sources: DaemonSourceItem[];
};
export type WorkspaceData = {
  currentUser: AppUser;
  users: AppUser[];
  consorcios: ConsortiumItem[];
  tasks: TaskItem[];
  intakeItems: AutomaticIntakeItem[];
  daemons: DaemonInstanceItem[];
};

type TaskRow = {
  id: string; title: string; description: string; building: string;
  priority: TaskItem["priority"]; status: TaskItem["status"]; due_date: string | null;
  consortium_id: string | null;
  creator_id: string; creator_name: string; assignee_id: string | null;
  assignee_name: string | null; created_at: number; updated_at: number;
};
type CommentRow = {
  id: string; task_id: string; body: string; created_at: number;
  author_id: string; author_name: string; source: TaskComment["source"];
};
type AutomaticIntakeRow = {
  id: string; source: AutomaticIntakeItem["source"]; source_account: string; external_id: string;
  conversation_id: string | null; sender_name: string; sender_address: string; title: string; body: string;
  kind: AutomaticIntakeItem["kind"]; priority: AutomaticIntakeItem["priority"]; status: AutomaticIntakeItem["status"];
  consortium_id: string | null; consortium_name: string | null; task_id: string | null; attachments: string;
  is_test: number; error_detail: string; received_at: number; reviewed_by_name: string | null;
  reviewed_at: number | null; created_at: number; updated_at: number;
};
type DaemonInstanceRow = {
  id: string; name: string; host_name: string; version: string;
  status: "online" | "degraded" | "error"; started_at: number;
  last_heartbeat_at: number; last_error: string;
};
type DaemonSourceRow = {
  id: string; instance_id: string; kind: DaemonSourceItem["kind"]; account: string;
  display_name: string; status: DaemonSourceItem["status"]; last_checked_at: number;
  last_message_at: number | null; last_error: string;
};

function parseIntakeAttachments(value: string): IntakeAttachment[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 20).map((item) => ({
      name: String(item?.name ?? "Archivo").trim().slice(0, 300) || "Archivo",
      contentType: String(item?.contentType ?? item?.type ?? "application/octet-stream").trim().slice(0, 150),
      size: Number.isFinite(Number(item?.size)) && Number(item.size) >= 0 ? Number(item.size) : null,
      url: typeof item?.url === "string" && /^https:\/\//i.test(item.url) ? item.url.slice(0, 2000) : null,
    }));
  } catch {
    return [];
  }
}

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
  const taskVisibilityClause = user.role === "admin"
    ? ""
    : "WHERE t.creator_id = ? OR t.assignee_id = ?";
  const tasksQuery = db.prepare(`SELECT
      t.id, t.title, t.description, t.building, t.priority, t.status, t.due_date,
      t.consortium_id, t.creator_id, creator.name AS creator_name, t.assignee_id,
      assignee.name AS assignee_name, t.created_at, t.updated_at
    FROM tasks t
    JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    ${taskVisibilityClause}
    ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.updated_at DESC`);
  const tasksResult = user.role === "admin"
    ? await tasksQuery.all<TaskRow>()
    : await tasksQuery.bind(user.id, user.id).all<TaskRow>();

  const taskRows = tasksResult.results ?? [];
  const intakeResult = user.role === "admin"
    ? await db.prepare(`SELECT i.id, i.source, i.source_account, i.external_id, i.conversation_id,
        i.sender_name, i.sender_address, i.title, i.body, i.kind, i.priority, i.status,
        i.consortium_id, c.name AS consortium_name, i.task_id, i.attachments, i.is_test,
        i.error_detail, i.received_at, reviewer.name AS reviewed_by_name, i.reviewed_at,
        i.created_at, i.updated_at
      FROM automatic_intake i
      LEFT JOIN consorcios c ON c.id = i.consortium_id
      LEFT JOIN users reviewer ON reviewer.id = i.reviewed_by_id
      ORDER BY CASE i.status WHEN 'pending' THEN 0 WHEN 'error' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,
        i.received_at DESC LIMIT 100`).all<AutomaticIntakeRow>()
    : { results: [] as AutomaticIntakeRow[] };
  let comments: CommentRow[] = [];
  if (taskRows.length) {
    const placeholders = taskRows.map(() => "?").join(",");
    const result = await db.prepare(`SELECT c.id, c.task_id, c.body, c.created_at, c.source,
        c.author_id, CASE WHEN c.source <> 'manual' AND trim(c.external_author) <> ''
          THEN c.external_author ELSE u.name END AS author_name
      FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.task_id IN (${placeholders}) ORDER BY c.created_at`)
      .bind(...taskRows.map((task) => task.id)).all<CommentRow>();
    comments = result.results ?? [];
  }

  const daemonResult = user.role === "admin"
    ? await db.prepare(`SELECT id, name, host_name, version, status, started_at,
        last_heartbeat_at, last_error FROM daemon_instances ORDER BY last_heartbeat_at DESC`)
      .all<DaemonInstanceRow>()
    : { results: [] as DaemonInstanceRow[] };
  const daemonRows = daemonResult.results ?? [];
  let daemonSourceRows: DaemonSourceRow[] = [];
  if (daemonRows.length) {
    const placeholders = daemonRows.map(() => "?").join(",");
    const result = await db.prepare(`SELECT id, instance_id, kind, account, display_name,
        status, last_checked_at, last_message_at, last_error FROM daemon_sources
      WHERE instance_id IN (${placeholders}) ORDER BY kind, display_name, account`)
      .bind(...daemonRows.map((item) => item.id)).all<DaemonSourceRow>();
    daemonSourceRows = result.results ?? [];
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
        source: comment.source,
      })),
    })),
    intakeItems: (intakeResult.results ?? []).map((item) => ({
      id: item.id,
      source: item.source,
      sourceAccount: item.source_account,
      externalId: item.external_id,
      conversationId: item.conversation_id,
      senderName: item.sender_name,
      senderAddress: item.sender_address,
      title: item.title,
      body: item.body,
      kind: item.kind,
      priority: item.priority,
      status: item.status,
      consortiumId: item.consortium_id,
      consortiumName: item.consortium_name,
      taskId: item.task_id,
      attachments: parseIntakeAttachments(item.attachments),
      isTest: Boolean(item.is_test),
      errorDetail: item.error_detail,
      receivedAt: item.received_at,
      reviewedByName: item.reviewed_by_name,
      reviewedAt: item.reviewed_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    daemons: daemonRows.map((daemon) => ({
      id: daemon.id,
      name: daemon.name,
      hostName: daemon.host_name,
      version: daemon.version,
      status: Date.now() - daemon.last_heartbeat_at > 180000 ? "offline" : daemon.status,
      startedAt: daemon.started_at,
      lastHeartbeatAt: daemon.last_heartbeat_at,
      lastError: daemon.last_error,
      sources: daemonSourceRows.filter((source) => source.instance_id === daemon.id).map((source) => ({
        id: source.id,
        kind: source.kind,
        account: source.account,
        displayName: source.display_name,
        status: source.status,
        lastCheckedAt: source.last_checked_at,
        lastMessageAt: source.last_message_at,
        lastError: source.last_error,
      })),
    })),
  };
}

function classifyPriority(subject: string, body: string): AutomaticIntakeItem["priority"] {
  const text = `${subject} ${body}`.toLocaleLowerCase("es");
  const urgentWords = ["urgente", "persona atrapada", "olor a gas", "incendio", "humo", "inundación", "inundacion", "sin agua", "sin luz", "cortocircuito"];
  const lowWords = ["consulta", "información", "informacion", "cuando puedan", "sin apuro"];
  return urgentWords.some((word) => text.includes(word))
    ? "high"
    : lowWords.some((word) => text.includes(word)) ? "low" : "medium";
}

function classifyIntakeKind(title: string, body: string): AutomaticIntakeItem["kind"] {
  const text = normalizedText(`${title} ${body}`);
  if (/\b(reclamo|queja|problema|falla|rotura|perdida|urgente)\b/.test(text)) return "claim";
  if (/\b(solicitud|solicito|necesito|consulta|informacion)\b/.test(text)) return "request";
  if (/\b(pedido|presupuesto|comprar|compra|enviar|envio)\b/.test(text)) return "order";
  if (/\b(aviso|informa|notifica|comunica)\b/.test(text)) return "notice";
  return "other";
}

function classifyFollowUpSignal(title: string, body: string) {
  const text = normalizedText(`${title} ${body}`);
  if (/\b(sigue|continua|persiste|volvio|nuevamente|otra vez|no se resolvio|no se soluciono|todavia|aun)\b/.test(text)) {
    return "recurrence" as const;
  }
  if (/\b(ya esta solucionado|ya quedo solucionado|ya esta resuelto|ya quedo resuelto|se soluciono|problema resuelto)\b/.test(text)
      || /\b(muchas gracias|gracias)\b[.! ]*$/.test(text)) {
    return "resolved" as const;
  }
  return "unknown" as const;
}

export async function ingestAutomaticItem(input: {
  source?: string;
  sourceAccount?: string;
  externalId?: string;
  conversationId?: string | null;
  senderName?: string;
  senderAddress?: string;
  title?: string;
  body?: string;
  kind?: string;
  priority?: string;
  consortiumId?: string | null;
  attachments?: unknown;
  receivedAt?: number;
  isTest?: boolean;
  followUpSignal?: string;
}) {
  await ensureDatabase();
  const source = input.source === "whatsapp" ? "whatsapp" : input.source === "email" ? "email" : null;
  if (!source) throw new Error("El origen debe ser email o whatsapp");
  const sourceAccount = String(input.sourceAccount ?? "").trim().slice(0, 200)
    || (source === "email" ? "Correo sin identificar" : "WhatsApp sin identificar");
  const externalId = String(input.externalId ?? "").trim().slice(0, 300);
  if (!externalId) throw new Error("El ingreso no tiene identificador externo");
  const body = String(input.body ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 20000);
  const suppliedTitle = String(input.title ?? "").trim().slice(0, 500);
  if (!suppliedTitle && !body) throw new Error("El ingreso no contiene título ni mensaje");
  const title = suppliedTitle || body.split("\n").find((line) => line.trim())?.trim().slice(0, 120) || "Ingreso automático";
  const senderName = String(input.senderName ?? "").trim().slice(0, 300) || "Remitente sin nombre";
  const senderAddress = String(input.senderAddress ?? "").trim().slice(0, 320);
  const conversationId = String(input.conversationId ?? "").trim().slice(0, 300) || null;
  const attachments = parseIntakeAttachments(JSON.stringify(input.attachments ?? []));
  const db = getDatabase();

  const existing = await db.prepare(`SELECT id, status, task_id FROM automatic_intake
    WHERE source = ? AND source_account = ? AND external_id = ?`)
    .bind(source, sourceAccount, externalId)
    .first<{ id: string; status: AutomaticIntakeItem["status"]; task_id: string | null }>();
  if (existing) {
    return { ok: true, accepted: true, duplicate: true, intakeId: existing.id, taskId: existing.task_id, status: existing.status };
  }

  const admin = await db.prepare(`SELECT id FROM users
    WHERE role = 'admin' AND status = 'active' ORDER BY created_at LIMIT 1`).first<{ id: string }>();
  if (!admin) throw new Error("No hay un administrador activo para recibir el ingreso");

  let consortium: { id: string; name: string } | null = null;
  if (input.consortiumId) {
    consortium = await db.prepare("SELECT id, name FROM consorcios WHERE id = ?")
      .bind(String(input.consortiumId)).first<{ id: string; name: string }>();
    if (!consortium) throw new Error("El consorcio indicado no existe");
  } else {
    const searchable = normalizedText(`${title} ${body}`);
    const consortia = await db.prepare("SELECT id, name, address FROM consorcios ORDER BY length(name) DESC")
      .all<{ id: string; name: string; address: string }>();
    const match = (consortia.results ?? []).find((item) => {
      const name = normalizedText(item.name);
      const address = normalizedText(item.address);
      return (name.length >= 4 && searchable.includes(name)) || (address.length >= 5 && searchable.includes(address));
    });
    if (match) consortium = { id: match.id, name: match.name };
  }

  const priority = ["low", "medium", "high"].includes(String(input.priority))
    ? input.priority as AutomaticIntakeItem["priority"] : classifyPriority(title, body);
  const kind = ["claim", "request", "order", "notice", "other"].includes(String(input.kind))
    ? input.kind as AutomaticIntakeItem["kind"] : classifyIntakeKind(title, body);
  const receivedAt = Number.isFinite(Number(input.receivedAt)) && Number(input.receivedAt) > 0
    ? Math.min(Number(input.receivedAt), Date.now()) : Date.now();
  const now = Date.now();
  const intakeId = crypto.randomUUID();
  let taskId = crypto.randomUUID();
  const sourceLabel = source === "email" ? "Correo" : "WhatsApp";
  const senderLabel = senderAddress ? `${senderName} <${senderAddress}>` : senderName;
  const attachmentNote = attachments.length
    ? `\n\nArchivos informados (${attachments.length}): ${attachments.map((item) => item.name).join(", ")}`
    : "";
  const taskDescription = `${sourceLabel} recibido desde ${sourceAccount}\nRemitente: ${senderLabel}\n\n${body || "Sin descripción adicional."}${attachmentNote}\n\nIngreso ${intakeId.slice(0, 8)} · pendiente de revisión.`;

  const linked = conversationId
    ? await db.prepare(`SELECT i.task_id, t.status AS task_status, t.consortium_id
        FROM automatic_intake i JOIN tasks t ON t.id = i.task_id
        WHERE i.source = ? AND i.source_account = ? AND i.conversation_id = ?
          AND i.task_id IS NOT NULL
        ORDER BY i.received_at DESC, i.created_at DESC LIMIT 1`)
      .bind(source, sourceAccount, conversationId)
      .first<{ task_id: string; task_status: TaskItem["status"]; consortium_id: string | null }>()
    : null;
  const followUpSignal = ["resolved", "recurrence", "unknown"].includes(String(input.followUpSignal))
    ? input.followUpSignal as "resolved" | "recurrence" | "unknown"
    : classifyFollowUpSignal(title, body);

  if (linked && !(linked.task_status === "done" && followUpSignal === "unknown")) {
    taskId = linked.task_id;
    const commentBody = `${body || title}${attachmentNote}`.trim();
    const statements = [
      db.prepare(`INSERT INTO automatic_intake
        (id, source, source_account, external_id, conversation_id, sender_name, sender_address,
         title, body, kind, priority, status, consortium_id, task_id, attachments, is_test,
         error_detail, received_at, reviewed_by_id, reviewed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', ?, ?, ?, ?, '', ?, ?, ?, ?, ?)`).bind(
          intakeId, source, sourceAccount, externalId, conversationId, senderName, senderAddress,
          title, body, kind, priority, consortium?.id ?? linked.consortium_id, taskId,
          JSON.stringify(attachments), input.isTest ? 1 : 0, receivedAt, admin.id, now, now, now,
        ),
    ];
    let action: "commented" | "reopened" | "ignored_resolved" = "commented";
    if (linked.task_status === "done" && followUpSignal === "resolved") {
      action = "ignored_resolved";
    } else {
      statements.push(db.prepare(`INSERT INTO comments
        (id, task_id, author_id, source, external_author, body, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
          crypto.randomUUID(), taskId, admin.id, source, senderLabel, commentBody, receivedAt,
        ));
      if (linked.task_status === "done" && followUpSignal === "recurrence") {
        action = "reopened";
        statements.push(db.prepare("UPDATE tasks SET status = 'pending', updated_at = ? WHERE id = ?")
          .bind(now, taskId));
        statements.push(db.prepare(`INSERT INTO comments
          (id, task_id, author_id, source, external_author, body, created_at)
          VALUES (?, ?, ?, 'system', 'Tasker', ?, ?)`).bind(
            crypto.randomUUID(), taskId, admin.id,
            "Tarea reabierta automáticamente porque el nuevo mensaje indica que el problema continúa o volvió a presentarse.", now,
          ));
      } else {
        statements.push(db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(now, taskId));
      }
    }
    try {
      await db.batch(statements);
    } catch (error) {
      const raced = await db.prepare(`SELECT id, status, task_id FROM automatic_intake
        WHERE source = ? AND source_account = ? AND external_id = ?`)
        .bind(source, sourceAccount, externalId)
        .first<{ id: string; status: AutomaticIntakeItem["status"]; task_id: string | null }>();
      if (raced) return { ok: true, accepted: true, duplicate: true, intakeId: raced.id, taskId: raced.task_id, status: raced.status };
      throw error;
    }
    return { ok: true, accepted: true, duplicate: false, intakeId, taskId, status: "accepted", action };
  }

  try {
    await db.batch([
      db.prepare(`INSERT INTO tasks
        (id, title, description, building, priority, status, due_date, consortium_id, creator_id, assignee_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'review', NULL, ?, ?, ?, ?, ?)`).bind(
          taskId, title, taskDescription, consortium?.name ?? "", priority,
          consortium?.id ?? null, admin.id, admin.id, receivedAt, now,
        ),
      db.prepare(`INSERT INTO automatic_intake
        (id, source, source_account, external_id, conversation_id, sender_name, sender_address,
         title, body, kind, priority, status, consortium_id, task_id, attachments, is_test,
         error_detail, received_at, reviewed_by_id, reviewed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, '', ?, NULL, NULL, ?, ?)`).bind(
          intakeId, source, sourceAccount, externalId, conversationId, senderName, senderAddress,
          title, body, kind, priority, consortium?.id ?? null, taskId, JSON.stringify(attachments),
          input.isTest ? 1 : 0, receivedAt, now, now,
        ),
    ]);
  } catch (error) {
    const raced = await db.prepare(`SELECT id, status, task_id FROM automatic_intake
      WHERE source = ? AND source_account = ? AND external_id = ?`)
      .bind(source, sourceAccount, externalId)
      .first<{ id: string; status: AutomaticIntakeItem["status"]; task_id: string | null }>();
    if (raced) return { ok: true, accepted: true, duplicate: true, intakeId: raced.id, taskId: raced.task_id, status: raced.status };
    throw error;
  }

  return {
    ok: true, accepted: true, duplicate: false, intakeId, taskId, status: "pending",
    action: linked ? "created_after_closed_task" : "created", consortium: consortium?.name ?? null, kind, priority,
  };
}

export async function createAutomaticIntakeTest(identity: AuthIdentity, input: {
  source?: string; sourceAccount?: string; senderName?: string; senderAddress?: string;
  title?: string; body?: string; consortiumId?: string | null;
}) {
  await requireAdmin(identity);
  await ingestAutomaticItem({
    ...input,
    externalId: `test:${crypto.randomUUID()}`,
    source: input.source === "email" ? "email" : "whatsapp",
    sourceAccount: input.sourceAccount || (input.source === "email" ? "Correo de prueba" : "WhatsApp Línea 1"),
    isTest: true,
    receivedAt: Date.now(),
  });
  return loadWorkspace(identity);
}

export async function recordDaemonHeartbeat(input: {
  instanceId?: string;
  name?: string;
  hostName?: string;
  version?: string;
  status?: string;
  startedAt?: number;
  lastError?: string;
  sources?: Array<{
    kind?: string;
    account?: string;
    displayName?: string;
    status?: string;
    lastCheckedAt?: number;
    lastMessageAt?: number | null;
    lastError?: string;
  }>;
}) {
  await ensureDatabase();
  const instanceId = String(input.instanceId ?? "").trim().slice(0, 200);
  if (!instanceId) throw new Error("El demonio no informó su identificador");
  const name = String(input.name ?? "Demonio Tasker").trim().slice(0, 200) || "Demonio Tasker";
  const hostName = String(input.hostName ?? "").trim().slice(0, 200);
  const version = String(input.version ?? "").trim().slice(0, 50);
  const status = ["online", "degraded", "error"].includes(String(input.status))
    ? String(input.status) : "online";
  const now = Date.now();
  const startedAt = Number.isFinite(Number(input.startedAt)) && Number(input.startedAt) > 0
    ? Math.min(Number(input.startedAt), now) : now;
  const lastError = String(input.lastError ?? "").trim().slice(0, 2000);
  const db = getDatabase();
  const statements = [
    db.prepare(`INSERT INTO daemon_instances
      (id, name, host_name, version, status, started_at, last_heartbeat_at, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, host_name = excluded.host_name,
        version = excluded.version, status = excluded.status, started_at = excluded.started_at,
        last_heartbeat_at = excluded.last_heartbeat_at, last_error = excluded.last_error,
        updated_at = excluded.updated_at`).bind(
          instanceId, name, hostName, version, status, startedAt, now, lastError, now, now,
        ),
  ];
  for (const source of Array.isArray(input.sources) ? input.sources.slice(0, 20) : []) {
    const kind = source.kind === "whatsapp" ? "whatsapp" : source.kind === "email" ? "email" : null;
    const account = String(source.account ?? "").trim().slice(0, 320);
    if (!kind || !account) continue;
    const sourceStatus = ["connected", "degraded", "disconnected", "disabled"].includes(String(source.status))
      ? String(source.status) : "connected";
    const lastCheckedAt = Number.isFinite(Number(source.lastCheckedAt)) && Number(source.lastCheckedAt) > 0
      ? Math.min(Number(source.lastCheckedAt), now) : now;
    const lastMessageAt = Number.isFinite(Number(source.lastMessageAt)) && Number(source.lastMessageAt) > 0
      ? Math.min(Number(source.lastMessageAt), now) : null;
    const sourceId = `${instanceId}:${kind}:${account}`.slice(0, 500);
    statements.push(db.prepare(`INSERT INTO daemon_sources
      (id, instance_id, kind, account, display_name, status, last_checked_at, last_message_at,
       last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(instance_id, kind, account) DO UPDATE SET display_name = excluded.display_name,
        status = excluded.status, last_checked_at = excluded.last_checked_at,
        last_message_at = excluded.last_message_at, last_error = excluded.last_error,
        updated_at = excluded.updated_at`).bind(
          sourceId, instanceId, kind, account,
          String(source.displayName ?? "").trim().slice(0, 200), sourceStatus,
          lastCheckedAt, lastMessageAt, String(source.lastError ?? "").trim().slice(0, 2000), now, now,
        ));
  }
  await db.batch(statements);
  return { ok: true, serverTime: now, pollAfterSeconds: 30 };
}

export async function reviewAutomaticIntake(identity: AuthIdentity, intakeId: string, actionValue: unknown) {
  const user = await requireAdmin(identity);
  const action = String(actionValue ?? "");
  if (!['accept', 'discard'].includes(action)) throw new Error("Acción de revisión desconocida");
  const db = getDatabase();
  const item = await db.prepare("SELECT id, status, task_id FROM automatic_intake WHERE id = ?")
    .bind(intakeId).first<{ id: string; status: AutomaticIntakeItem["status"]; task_id: string | null }>();
  if (!item) throw new Error("El ingreso no existe");
  if (item.status !== "pending" && item.status !== "error") return loadWorkspace(identity);
  const now = Date.now();

  if (action === "accept") {
    if (!item.task_id) throw new Error("La tarea asociada fue eliminada. Descartá este ingreso y pedí al demonio que lo envíe nuevamente");
    const statements = [
      db.prepare(`UPDATE automatic_intake SET status = 'accepted', error_detail = '', reviewed_by_id = ?,
        reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(user.id, now, now, intakeId),
    ];
    statements.push(db.prepare("UPDATE tasks SET status = 'pending', updated_at = ? WHERE id = ?")
      .bind(now, item.task_id));
    await db.batch(statements);
  } else {
    const statements = [
      db.prepare(`UPDATE automatic_intake SET status = 'discarded', task_id = NULL, reviewed_by_id = ?,
        reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(user.id, now, now, intakeId),
    ];
    if (item.task_id) statements.push(db.prepare("DELETE FROM tasks WHERE id = ?").bind(item.task_id));
    await db.batch(statements);
  }
  return loadWorkspace(identity);
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
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
  if (!task || (user.role !== "admin" && task.creator_id !== user.id && task.assignee_id !== user.id)) {
    throw new Error("Tarea no encontrada");
  }

  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (input.status && ["pending", "in_progress", "review", "done"].includes(input.status)) {
    fields.push("status = ?"); values.push(input.status);
  }
  if (task.creator_id === user.id || user.role === "admin") {
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
  if (user.role !== "admin") throw new Error("Solo el administrador puede realizar este cambio");
  return user;
}

export async function resetOperationalData(identity: AuthIdentity) {
  await requireAdmin(identity);
  const db = getDatabase();
  const [taskCount, commentCount, intakeCount] = await Promise.all([
    db.prepare("SELECT count(*) AS total FROM tasks").first<{ total: number }>(),
    db.prepare("SELECT count(*) AS total FROM comments").first<{ total: number }>(),
    db.prepare("SELECT count(*) AS total FROM automatic_intake").first<{ total: number }>(),
  ]);

  await db.batch([
    db.prepare("DELETE FROM automatic_intake"),
    db.prepare("DELETE FROM comments"),
    db.prepare("DELETE FROM tasks"),
    db.prepare("PRAGMA optimize"),
  ]);

  return {
    ok: true,
    deleted: {
      tasks: Number(taskCount?.total ?? 0),
      comments: Number(commentCount?.total ?? 0),
      intakeItems: Number(intakeCount?.total ?? 0),
    },
  };
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
  const task = await db.prepare("SELECT creator_id, assignee_id FROM tasks WHERE id = ?")
    .bind(taskId).first<{ creator_id: string; assignee_id: string | null }>();
  if (!task || (user.role !== "admin" && task.creator_id !== user.id && task.assignee_id !== user.id)) {
    throw new Error("Tarea no encontrada");
  }
  const now = Date.now();
  await db.batch([
    db.prepare("INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), taskId, user.id, body, now),
    db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(now, taskId),
  ]);
  return loadWorkspace(identity);
}

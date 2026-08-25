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
export type MailSettings = {
  intakeEnabled: boolean;
  inboxAddress: string;
  subjectPrefix: string;
  acceptedPatterns: string[];
  ignoredSubjectPatterns: string[];
  blockedSenders: string[];
  minimumBodyLength: number;
  lookbackDays: number;
  remindersEnabled: boolean;
  reminderRecipients: string[];
  notifyUrgent: boolean;
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  dailySummary: boolean;
  reminderHour: number;
  timezone: string;
  lastSyncAt: number | null;
  lastSyncStatus: "idle" | "ok" | "error";
  lastSyncDetail: string;
  lastSyncProcessed: number;
  updatedAt: number;
};
export type MailIntakeEvent = {
  id: string;
  senderEmail: string;
  recipientEmails: string;
  subject: string;
  status: "accepted" | "rejected";
  reason: string;
  claimId: string | null;
  createdAt: number;
};
export type WorkspaceData = {
  currentUser: AppUser;
  users: AppUser[];
  consorcios: ConsortiumItem[];
  tasks: TaskItem[];
  claims: ClaimItem[];
  intakeItems: AutomaticIntakeItem[];
  mailSettings: MailSettings | null;
  mailEvents: MailIntakeEvent[];
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
type AutomaticIntakeRow = {
  id: string; source: AutomaticIntakeItem["source"]; source_account: string; external_id: string;
  conversation_id: string | null; sender_name: string; sender_address: string; title: string; body: string;
  kind: AutomaticIntakeItem["kind"]; priority: AutomaticIntakeItem["priority"]; status: AutomaticIntakeItem["status"];
  consortium_id: string | null; consortium_name: string | null; task_id: string | null; attachments: string;
  is_test: number; error_detail: string; received_at: number; reviewed_by_name: string | null;
  reviewed_at: number | null; created_at: number; updated_at: number;
};
type MailSettingsRow = {
  intake_enabled: number;
  inbox_address: string;
  subject_prefix: string;
  accepted_patterns: string;
  ignored_subject_patterns: string;
  blocked_senders: string;
  minimum_body_length: number;
  lookback_days: number;
  reminders_enabled: number;
  reminder_recipients: string;
  notify_urgent: number;
  notify_due_today: number;
  notify_overdue: number;
  daily_summary: number;
  reminder_hour: number;
  timezone: string;
  last_sync_at: number | null;
  last_sync_status: MailSettings["lastSyncStatus"];
  last_sync_detail: string;
  last_sync_processed: number;
  updated_at: number;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipientList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => String(item).trim().toLocaleLowerCase("es")).filter((item) => emailPattern.test(item))));
  } catch {
    return [];
  }
}

function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => String(item).trim()).filter(Boolean)));
  } catch {
    return [];
  }
}

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

function mapMailSettings(row: MailSettingsRow): MailSettings {
  return {
    intakeEnabled: Boolean(row.intake_enabled),
    inboxAddress: row.inbox_address,
    subjectPrefix: row.subject_prefix,
    acceptedPatterns: parseStringList(row.accepted_patterns),
    ignoredSubjectPatterns: parseStringList(row.ignored_subject_patterns),
    blockedSenders: parseStringList(row.blocked_senders),
    minimumBodyLength: row.minimum_body_length,
    lookbackDays: row.lookback_days,
    remindersEnabled: Boolean(row.reminders_enabled),
    reminderRecipients: parseRecipientList(row.reminder_recipients),
    notifyUrgent: Boolean(row.notify_urgent),
    notifyDueToday: Boolean(row.notify_due_today),
    notifyOverdue: Boolean(row.notify_overdue),
    dailySummary: Boolean(row.daily_summary),
    reminderHour: row.reminder_hour,
    timezone: row.timezone,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncDetail: row.last_sync_detail,
    lastSyncProcessed: row.last_sync_processed,
    updatedAt: row.updated_at,
  };
}

async function readMailSettings(): Promise<MailSettings> {
  const row = await getDatabase().prepare(`SELECT intake_enabled, inbox_address, subject_prefix,
      accepted_patterns, ignored_subject_patterns, blocked_senders, minimum_body_length,
      lookback_days, reminders_enabled, reminder_recipients, notify_urgent, notify_due_today,
      notify_overdue, daily_summary, reminder_hour, timezone, last_sync_at, last_sync_status,
      last_sync_detail, last_sync_processed, updated_at
    FROM mail_settings WHERE id = 'default'`).first<MailSettingsRow>();
  if (!row) throw new Error("No se encontró la configuración de correo");
  return mapMailSettings(row);
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
  const mailEvents = user.role === "admin"
    ? (await db.prepare(`SELECT id, sender_email, recipient_emails, subject, status, reason,
        claim_id, created_at FROM email_intake_events ORDER BY created_at DESC LIMIT 25`)
      .all<{
        id: string; sender_email: string; recipient_emails: string; subject: string;
        status: MailIntakeEvent["status"]; reason: string; claim_id: string | null; created_at: number;
      }>()).results ?? []
    : [];
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
    mailSettings: user.role === "admin" ? await readMailSettings() : null,
    mailEvents: mailEvents.map((event) => ({
      id: event.id,
      senderEmail: event.sender_email,
      recipientEmails: event.recipient_emails,
      subject: event.subject,
      status: event.status,
      reason: event.reason,
      claimId: event.claim_id,
      createdAt: event.created_at,
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

function classifyIntakeKind(title: string, body: string): AutomaticIntakeItem["kind"] {
  const text = normalizedText(`${title} ${body}`);
  if (/\b(reclamo|queja|problema|falla|rotura|perdida|urgente)\b/.test(text)) return "claim";
  if (/\b(solicitud|solicito|necesito|consulta|informacion)\b/.test(text)) return "request";
  if (/\b(pedido|presupuesto|comprar|compra|enviar|envio)\b/.test(text)) return "order";
  if (/\b(aviso|informa|notifica|comunica)\b/.test(text)) return "notice";
  return "other";
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

  const classification = classifyEmail(title, body);
  const priority = ["low", "medium", "high"].includes(String(input.priority))
    ? input.priority as AutomaticIntakeItem["priority"] : classification.priority;
  const kind = ["claim", "request", "order", "notice", "other"].includes(String(input.kind))
    ? input.kind as AutomaticIntakeItem["kind"] : classifyIntakeKind(title, body);
  const receivedAt = Number.isFinite(Number(input.receivedAt)) && Number(input.receivedAt) > 0
    ? Math.min(Number(input.receivedAt), Date.now()) : Date.now();
  const now = Date.now();
  const intakeId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const sourceLabel = source === "email" ? "Correo" : "WhatsApp";
  const senderLabel = senderAddress ? `${senderName} <${senderAddress}>` : senderName;
  const attachmentNote = attachments.length
    ? `\n\nArchivos informados (${attachments.length}): ${attachments.map((item) => item.name).join(", ")}`
    : "";
  const taskDescription = `${sourceLabel} recibido desde ${sourceAccount}\nRemitente: ${senderLabel}\n\n${body || "Sin descripción adicional."}${attachmentNote}\n\nIngreso ${intakeId.slice(0, 8)} · pendiente de revisión.`;

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

  return { ok: true, accepted: true, duplicate: false, intakeId, taskId, status: "pending", consortium: consortium?.name ?? null, kind, priority };
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

function subjectPattern(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

type CleanEmailContent = {
  body: string;
  senderName: string | null;
  senderEmail: string | null;
};

function addressFromHeader(value: string) {
  const angleAddress = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  const plainAddress = value.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/);
  const email = (angleAddress?.[1] ?? plainAddress?.[0] ?? "").trim().toLocaleLowerCase("es");
  const name = value
    .replace(/<[^<>]+>/g, "")
    .replace(email, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  return { name: name || null, email: emailPattern.test(email) ? email : null };
}

function cleanEmailContent(value: string): CleanEmailContent {
  const normalized = value.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
  let content = normalized;
  let senderName: string | null = null;
  let senderEmail: string | null = null;

  const forwardedMarker = /-{5,}\s*(?:Forwarded message|Mensaje reenviado|Mensaje remitido)\s*-{5,}/i.exec(content);
  if (forwardedMarker) {
    const forwarded = content.slice(forwardedMarker.index + forwardedMarker[0].length).trim();
    const separator = /\n\s*\n/.exec(forwarded);
    if (separator) {
      const headers = forwarded.slice(0, separator.index);
      if (/^(?:De|From):/im.test(headers) && /^(?:Asunto|Subject):/im.test(headers)) {
        const from = /^(?:De|From):\s*(.+)$/im.exec(headers);
        if (from) {
          const originalSender = addressFromHeader(from[1]);
          senderName = originalSender.name;
          senderEmail = originalSender.email;
        }
        content = forwarded.slice(separator.index + separator[0].length).trim();
      }
    }
  }

  const quotedMarkers = [
    /^\s*(?:El|On)\s+.+(?:escribi[oó]|wrote):\s*$/gim,
    /^\s*-{2,}\s*(?:Mensaje original|Original Message)\s*-{2,}\s*$/gim,
    /^\s*De:\s*.+\n\s*(?:Enviado|Sent):\s*.+\n\s*(?:Para|To):\s*/gim,
  ];
  let cutAt = content.length;
  for (const marker of quotedMarkers) {
    const match = marker.exec(content);
    if (match && match.index < cutAt) cutAt = match.index;
  }
  content = content.slice(0, cutAt)
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .trim();

  const footerMarkers = [
    /^\s*--\s*$/gm,
    /^\s*_{5,}\s*$/gm,
    /^\s*(?:Este (?:mensaje|correo(?: electrónico)?) es confidencial|This (?:message|e-?mail) is confidential|Aviso de confidencialidad|Confidentiality notice)\b/gim,
    /^\s*Enviado desde (?:mi|Mail para)\b/gim,
  ];
  let footerAt = content.length;
  for (const marker of footerMarkers) {
    const match = marker.exec(content);
    if (match && match.index < footerAt) footerAt = match.index;
  }
  content = content.slice(0, footerAt)
    .replace(/\[image:[^\]]+\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { body: content, senderName, senderEmail };
}

export async function ingestEmailClaim(input: {
  externalId?: string; senderName?: string; senderEmail?: string; recipientEmails?: string;
  mailboxAddress?: string; threadId?: string; subject?: string; body?: string; receivedAt?: number; isAutomatic?: boolean;
}) {
  await ensureDatabase();
  const mailSettings = await readMailSettings();
  const externalIdValue = input.externalId?.trim().slice(0, 200) ?? "";
  const senderEmail = input.senderEmail?.trim().toLocaleLowerCase("es").slice(0, 320) ?? "";
  const rawSubject = input.subject?.trim().slice(0, 500) ?? "";
  const body = input.body?.trim().slice(0, 20000) ?? "";
  if (!externalIdValue) throw new Error("El mensaje no tiene identificador");

  const db = getDatabase();
  const externalId = `gmail:${externalIdValue}`;
  const mailboxScope = (input.mailboxAddress?.trim() || mailSettings.inboxAddress).toLocaleLowerCase("es");
  const threadIdValue = input.threadId?.trim().slice(0, 200) ?? "";
  const gmailThreadId = threadIdValue ? `gmail-thread:${mailboxScope}:${threadIdValue}` : "";
  const existingEvent = await db.prepare(`SELECT status, reason, claim_id FROM email_intake_events WHERE external_id = ?`)
    .bind(externalId).first<{ status: MailIntakeEvent["status"]; reason: string; claim_id: string | null }>();
  if (existingEvent?.status === "accepted") {
    let canonical = gmailThreadId
      ? await db.prepare("SELECT id, task_id FROM claims WHERE gmail_thread_id = ?")
        .bind(gmailThreadId).first<{ id: string; task_id: string | null }>()
      : null;
    if (!canonical && gmailThreadId && existingEvent.claim_id) {
      await db.prepare("UPDATE claims SET gmail_thread_id = ? WHERE id = ? AND gmail_thread_id IS NULL")
        .bind(gmailThreadId, existingEvent.claim_id).run();
      canonical = await db.prepare("SELECT id, task_id FROM claims WHERE gmail_thread_id = ?")
        .bind(gmailThreadId).first<{ id: string; task_id: string | null }>();
    }
    if (canonical && canonical.id !== existingEvent.claim_id) {
      await db.prepare("UPDATE email_intake_events SET claim_id = ? WHERE external_id = ?")
        .bind(canonical.id, externalId).run();
    }
    return {
      ok: true,
      accepted: true,
      duplicate: true,
      reason: existingEvent.reason,
      claimId: canonical?.id ?? existingEvent.claim_id,
      taskId: canonical?.task_id ?? null,
    };
  }

  const existing = await db.prepare("SELECT id, task_id FROM claims WHERE external_id = ?")
    .bind(externalId).first<{ id: string; task_id: string | null }>();
  if (existing) {
    let canonical = gmailThreadId
      ? await db.prepare("SELECT id, task_id FROM claims WHERE gmail_thread_id = ?")
        .bind(gmailThreadId).first<{ id: string; task_id: string | null }>()
      : null;
    if (!canonical && gmailThreadId) {
      await db.prepare("UPDATE claims SET gmail_thread_id = ? WHERE id = ? AND gmail_thread_id IS NULL")
        .bind(gmailThreadId, existing.id).run();
      canonical = await db.prepare("SELECT id, task_id FROM claims WHERE gmail_thread_id = ?")
        .bind(gmailThreadId).first<{ id: string; task_id: string | null }>();
    }
    const acceptedClaim = canonical ?? existing;
    if (existingEvent) {
      await db.prepare(`UPDATE email_intake_events SET sender_email = ?, recipient_emails = ?, subject = ?,
        status = 'accepted', reason = 'Procesado anteriormente', claim_id = ? WHERE external_id = ?`)
        .bind(senderEmail, input.recipientEmails?.slice(0, 1000) ?? "", rawSubject, acceptedClaim.id, externalId).run();
    } else {
      await db.prepare(`INSERT INTO email_intake_events
        (id, external_id, sender_email, recipient_emails, subject, status, reason, claim_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'accepted', 'Procesado anteriormente', ?, ?)`)
        .bind(crypto.randomUUID(), externalId, senderEmail, input.recipientEmails?.slice(0, 1000) ?? "",
          rawSubject, acceptedClaim.id, Date.now()).run();
    }
    return { ok: true, accepted: true, duplicate: true, claimId: acceptedClaim.id, taskId: acceptedClaim.task_id };
  }

  const normalizedSubject = rawSubject.toLocaleLowerCase("es");
  const matchingPattern = [...mailSettings.acceptedPatterns]
    .sort((left, right) => right.length - left.length)
    .find((pattern) => normalizedSubject.includes(pattern.toLocaleLowerCase("es")));
  const ignoredPattern = mailSettings.ignoredSubjectPatterns.find((pattern) =>
    normalizedSubject.startsWith(pattern.toLocaleLowerCase("es"))
  );
  const blockedSender = mailSettings.blockedSenders.find((pattern) =>
    senderEmail.includes(pattern.toLocaleLowerCase("es"))
  );
  const isAutomaticResponse = Boolean(input.isAutomatic) && /^(?:(?:re|rv|fwd|fw)\s*:\s*)*(?:respuesta\s+autom[aá]tica|fuera\s+de\s+la\s+oficina|automatic\s+reply|out\s+of\s+office|undeliver(?:able|ed)|delivery\s+status)/i.test(rawSubject);
  let rejectionReason = "";
  if (!mailSettings.intakeEnabled) rejectionReason = "La recepción automática está pausada";
  else if (!senderEmail || !emailPattern.test(senderEmail)) rejectionReason = "El remitente no tiene un email válido";
  else if (isAutomaticResponse) rejectionReason = "Respuesta automática del correo";
  else if (ignoredPattern) rejectionReason = `Asunto ignorado por la regla “${ignoredPattern}”`;
  else if (blockedSender) rejectionReason = `Remitente bloqueado por la regla “${blockedSender}”`;
  else if (!matchingPattern) rejectionReason = "El asunto no contiene un patrón aceptado";
  else if (input.mailboxAddress && input.mailboxAddress.trim().toLocaleLowerCase("es") !== mailSettings.inboxAddress.toLocaleLowerCase("es")) {
    rejectionReason = "El script no corresponde a la casilla configurada";
  } else if (!input.mailboxAddress && input.recipientEmails && !input.recipientEmails.toLocaleLowerCase("es").includes(mailSettings.inboxAddress.toLocaleLowerCase("es"))) {
    rejectionReason = "El correo no fue enviado a la casilla configurada";
  } else if (body.length < mailSettings.minimumBodyLength) {
    rejectionReason = `El mensaje tiene menos de ${mailSettings.minimumBodyLength} caracteres`;
  }

  if (rejectionReason) {
    if (existingEvent) {
      await db.prepare(`UPDATE email_intake_events SET sender_email = ?, recipient_emails = ?, subject = ?,
        status = 'rejected', reason = ?, claim_id = NULL WHERE external_id = ?`)
        .bind(senderEmail, input.recipientEmails?.slice(0, 1000) ?? "", rawSubject, rejectionReason, externalId).run();
    } else {
      await db.prepare(`INSERT INTO email_intake_events
        (id, external_id, sender_email, recipient_emails, subject, status, reason, claim_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'rejected', ?, NULL, ?)`)
        .bind(crypto.randomUUID(), externalId, senderEmail, input.recipientEmails?.slice(0, 1000) ?? "",
          rawSubject, rejectionReason, Date.now()).run();
    }
    return { ok: true, accepted: false, duplicate: Boolean(existingEvent), reason: rejectionReason };
  }

  const admin = await db.prepare(`SELECT id FROM users
    WHERE role = 'admin' AND status = 'active' ORDER BY created_at LIMIT 1`).first<{ id: string }>();
  if (!admin) throw new Error("No hay un administrador activo para asignar el reclamo");

  const acceptedSubjectPattern = subjectPattern(matchingPattern!);
  const cleanSubject = rawSubject.replace(acceptedSubjectPattern, " ")
    .replace(/^(?:(?:re|rv|fwd|fw)\s*:\s*)+/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:\-–—]+|[\s:\-–—]+$/g, "")
    .trim() || `${matchingPattern} recibido por correo`;
  const cleanedEmail = cleanEmailContent(body);
  const messageBody = cleanedEmail.body || "Respuesta recibida sin texto nuevo; Gmail solo incluyó contenido citado.";
  const senderName = cleanedEmail.senderName?.slice(0, 300)
    || input.senderName?.trim().slice(0, 300)
    || "Remitente sin nombre";
  const claimSenderEmail = cleanedEmail.senderEmail || senderEmail;
  const now = Number.isFinite(input.receivedAt) && Number(input.receivedAt) > 0
    ? Math.min(Number(input.receivedAt), Date.now()) : Date.now();

  const threadClaim = gmailThreadId
    ? await db.prepare("SELECT id, task_id FROM claims WHERE gmail_thread_id = ?")
      .bind(gmailThreadId).first<{ id: string; task_id: string | null }>()
    : null;
  if (threadClaim) {
    const reason = threadClaim.task_id
      ? "Respuesta agregada como comentario en la conversación existente"
      : "Conversación ya registrada; su tarea fue eliminada";
    const eventStatement = existingEvent
      ? db.prepare(`UPDATE email_intake_events SET sender_email = ?, recipient_emails = ?, subject = ?,
          status = 'accepted', reason = ?, claim_id = ? WHERE external_id = ?`)
        .bind(senderEmail, input.recipientEmails?.slice(0, 1000) ?? "", rawSubject, reason, threadClaim.id, externalId)
      : db.prepare(`INSERT INTO email_intake_events
          (id, external_id, sender_email, recipient_emails, subject, status, reason, claim_id, created_at)
          VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, ?)`)
        .bind(crypto.randomUUID(), externalId, senderEmail, input.recipientEmails?.slice(0, 1000) ?? "",
          rawSubject, reason, threadClaim.id, Date.now());
    const statements = [
      eventStatement,
      db.prepare("UPDATE claims SET updated_at = ? WHERE id = ?").bind(now, threadClaim.id),
    ];
    if (threadClaim.task_id) {
      statements.push(
        db.prepare("INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), threadClaim.task_id, admin.id,
            `Respuesta por correo de ${senderName} <${claimSenderEmail}>\n\n${messageBody}`, now),
        db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(now, threadClaim.task_id),
      );
    }
    await db.batch(statements);
    return {
      ok: true,
      accepted: true,
      duplicate: false,
      chained: true,
      commentAdded: Boolean(threadClaim.task_id),
      claimId: threadClaim.id,
      taskId: threadClaim.task_id,
    };
  }

  const searchable = normalizedText(`${cleanSubject} ${messageBody}`);
  const consortia = await db.prepare("SELECT id, name, address FROM consorcios ORDER BY length(name) DESC")
    .all<{ id: string; name: string; address: string }>();
  const consortium = (consortia.results ?? []).find((item) => {
    const name = normalizedText(item.name);
    const address = normalizedText(item.address);
    return (name.length >= 4 && searchable.includes(name)) || (address.length >= 5 && searchable.includes(address));
  }) ?? null;

  const classification = classifyEmail(cleanSubject, messageBody);
  const claimId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const taskDescription = `Correo recibido de ${senderName} <${claimSenderEmail}>\n\n${messageBody}\n\nReclamo ${claimId.slice(0, 8)} · ingresado automáticamente desde Gmail.`;

  const eventStatement = existingEvent
    ? db.prepare(`UPDATE email_intake_events SET sender_email = ?, recipient_emails = ?, subject = ?,
        status = 'accepted', reason = ?, claim_id = ? WHERE external_id = ?`)
      .bind(senderEmail, input.recipientEmails?.slice(0, 1000) ?? "", rawSubject,
        `Aceptado por el patrón “${matchingPattern}”`, claimId, externalId)
    : db.prepare(`INSERT INTO email_intake_events
        (id, external_id, sender_email, recipient_emails, subject, status, reason, claim_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, ?)`)
      .bind(crypto.randomUUID(), externalId, senderEmail, input.recipientEmails?.slice(0, 1000) ?? "",
        rawSubject, `Aceptado por el patrón “${matchingPattern}”`, claimId, Date.now());

  await db.batch([
    db.prepare(`INSERT INTO tasks
      (id, title, description, building, priority, status, due_date, consortium_id, creator_id, assignee_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?, ?, ?)`)
      .bind(taskId, cleanSubject, taskDescription, consortium?.name ?? "", classification.priority,
        consortium?.id ?? null, admin.id, admin.id, now, now),
    db.prepare(`INSERT INTO claims
      (id, source, is_test, external_id, gmail_thread_id, sender_name, sender_email, subject, body, category, priority, status,
       consortium_id, task_id, created_by_id, assigned_to_id, created_at, updated_at)
      VALUES (?, 'email', 0, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?, NULL, ?, ?, ?)`)
      .bind(claimId, externalId, gmailThreadId || null, senderName, claimSenderEmail, cleanSubject, messageBody,
        classification.category, classification.priority, consortium?.id ?? null,
        taskId, admin.id, now, now),
    eventStatement,
  ]);

  return { ok: true, accepted: true, duplicate: false, claimId, taskId, category: classification.category, priority: classification.priority, consortium: consortium?.name ?? null };
}

export async function getEmailAutomationConfiguration() {
  await ensureDatabase();
  const settings = await readMailSettings();
  return {
    intakeEnabled: settings.intakeEnabled,
    inboxAddress: settings.inboxAddress,
    acceptedPatterns: settings.acceptedPatterns,
    lookbackDays: settings.lookbackDays,
    remindersEnabled: settings.remindersEnabled && settings.reminderRecipients.length > 0,
  };
}

export async function recordEmailSync(input: {
  status?: string; detail?: string; processedCount?: number;
}) {
  await ensureDatabase();
  const status = input.status === "error" ? "error" : "ok";
  const detail = String(input.detail ?? "").trim().slice(0, 500);
  const processedCount = Math.min(500, Math.max(0, Number(input.processedCount) || 0));
  await getDatabase().prepare(`UPDATE mail_settings SET last_sync_at = ?, last_sync_status = ?,
    last_sync_detail = ?, last_sync_processed = ? WHERE id = 'default'`)
    .bind(Date.now(), status, detail, processedCount).run();
  return { ok: true };
}

type EmailNotificationRow = {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
};

function clockInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

async function queueEmailNotification(input: {
  key: string;
  recipient: string;
  type: "urgent" | "due_today" | "overdue" | "daily_summary";
  subject: string;
  body: string;
}, now: number) {
  await getDatabase().prepare(`INSERT OR IGNORE INTO email_notifications
    (id, notification_key, recipient_email, type, subject, body, status, reserved_at, sent_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`)
    .bind(crypto.randomUUID(), input.key, input.recipient, input.type, input.subject, input.body, now, now).run();
}

export async function reserveEmailNotifications() {
  await ensureDatabase();
  const settings = await readMailSettings();
  if (!settings.remindersEnabled || !settings.reminderRecipients.length) return { messages: [] };

  const db = getDatabase();
  const now = Date.now();
  const clock = clockInTimezone(settings.timezone);
  const taskerUrl = "https://tasker-consorcios.cuentagpt050.chatgpt.site";

  if (settings.notifyUrgent) {
    const urgentClaims = await db.prepare(`SELECT r.id, r.subject, r.sender_name, r.sender_email,
        COALESCE(c.name, 'Sin consorcio identificado') AS consortium_name
      FROM claims r LEFT JOIN consorcios c ON c.id = r.consortium_id
      WHERE r.priority = 'high' AND r.status NOT IN ('resolved', 'closed')
      ORDER BY r.created_at DESC LIMIT 50`).all<{
        id: string; subject: string; sender_name: string; sender_email: string; consortium_name: string;
      }>();
    for (const claim of urgentClaims.results ?? []) {
      for (const recipient of settings.reminderRecipients) {
        await queueEmailNotification({
          key: `urgent:${claim.id}:${recipient}`,
          recipient,
          type: "urgent",
          subject: `[TASKER] Reclamo urgente: ${claim.subject}`,
          body: `Hay un reclamo de prioridad alta.\n\nAsunto: ${claim.subject}\nConsorcio: ${claim.consortium_name}\nRemitente: ${claim.sender_name} <${claim.sender_email}>\n\nAbrir Tasker: ${taskerUrl}`,
        }, now);
      }
    }
  }

  if (clock.hour >= settings.reminderHour && (settings.notifyDueToday || settings.notifyOverdue)) {
    const dueTasks = await db.prepare(`SELECT t.id, t.title, t.due_date,
        COALESCE(NULLIF(t.building, ''), 'Sin consorcio') AS building,
        COALESCE(assignee.name, creator.name) AS responsible_name
      FROM tasks t JOIN users creator ON creator.id = t.creator_id
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      WHERE t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date <= ?
      ORDER BY t.due_date, t.priority DESC LIMIT 100`).bind(clock.date).all<{
        id: string; title: string; due_date: string; building: string; responsible_name: string;
      }>();
    for (const task of dueTasks.results ?? []) {
      const overdue = task.due_date < clock.date;
      if ((overdue && !settings.notifyOverdue) || (!overdue && !settings.notifyDueToday)) continue;
      const type = overdue ? "overdue" : "due_today";
      const state = overdue ? `Vencida desde ${task.due_date}` : "Vence hoy";
      for (const recipient of settings.reminderRecipients) {
        await queueEmailNotification({
          key: `${type}:${task.id}:${clock.date}:${recipient}`,
          recipient,
          type,
          subject: `[TASKER] ${overdue ? "Tarea vencida" : "Tarea para hoy"}: ${task.title}`,
          body: `${state}.\n\nTarea: ${task.title}\nConsorcio: ${task.building}\nResponsable: ${task.responsible_name}\n\nAbrir Tasker: ${taskerUrl}`,
        }, now);
      }
    }
  }

  if (settings.dailySummary && clock.hour >= settings.reminderHour) {
    const taskSummary = await db.prepare(`SELECT
        SUM(CASE WHEN status <> 'done' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status <> 'done' AND due_date = ? THEN 1 ELSE 0 END) AS due_today,
        SUM(CASE WHEN status <> 'done' AND due_date < ? THEN 1 ELSE 0 END) AS overdue
      FROM tasks`).bind(clock.date, clock.date).first<{ active: number | null; due_today: number | null; overdue: number | null }>();
    const claimSummary = await db.prepare(`SELECT COUNT(*) AS urgent FROM claims
      WHERE priority = 'high' AND status NOT IN ('resolved', 'closed')`).first<{ urgent: number }>();
    for (const recipient of settings.reminderRecipients) {
      await queueEmailNotification({
        key: `daily_summary:${clock.date}:${recipient}`,
        recipient,
        type: "daily_summary",
        subject: `[TASKER] Resumen diario del ${clock.date}`,
        body: `Resumen de la administración:\n\nTareas activas: ${taskSummary?.active ?? 0}\nVencen hoy: ${taskSummary?.due_today ?? 0}\nVencidas: ${taskSummary?.overdue ?? 0}\nReclamos urgentes: ${claimSummary?.urgent ?? 0}\n\nAbrir Tasker: ${taskerUrl}`,
      }, now);
    }
  }

  await db.prepare(`UPDATE email_notifications SET status = 'pending', reserved_at = NULL, updated_at = ?
    WHERE status = 'reserved' AND reserved_at < ?`).bind(now, now - 10 * 60 * 1000).run();
  const pending = await db.prepare(`SELECT id, recipient_email, subject, body
    FROM email_notifications WHERE status = 'pending' ORDER BY created_at LIMIT 25`).all<EmailNotificationRow>();
  const rows = pending.results ?? [];
  if (rows.length) {
    await db.batch(rows.map((row) => db.prepare(`UPDATE email_notifications
      SET status = 'reserved', reserved_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(now, now, row.id)));
  }
  return { messages: rows.map((row) => ({ id: row.id, to: row.recipient_email, subject: row.subject, body: row.body })) };
}

export async function completeEmailNotifications(input: { sentIds?: unknown; failedIds?: unknown }) {
  await ensureDatabase();
  const db = getDatabase();
  const sentIds = Array.isArray(input.sentIds) ? input.sentIds.map(String).slice(0, 50) : [];
  const failedIds = Array.isArray(input.failedIds) ? input.failedIds.map(String).slice(0, 50) : [];
  const now = Date.now();
  const statements = [
    ...sentIds.map((id) => db.prepare(`UPDATE email_notifications SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?`)
      .bind(now, now, id)),
    ...failedIds.map((id) => db.prepare(`UPDATE email_notifications SET status = 'pending', reserved_at = NULL, updated_at = ? WHERE id = ?`)
      .bind(now, id)),
  ];
  if (statements.length) await db.batch(statements);
  return { ok: true, sent: sentIds.length, retried: failedIds.length };
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

export async function sanitizeImportedEmails(identity: AuthIdentity) {
  await requireAdmin(identity);
  const db = getDatabase();
  const claimsResult = await db.prepare(`SELECT id, task_id, sender_name, sender_email, body
    FROM claims WHERE source = 'email' AND is_test = 0`).all<{
      id: string;
      task_id: string | null;
      sender_name: string;
      sender_email: string;
      body: string;
    }>();
  const commentsResult = await db.prepare(`SELECT id, body FROM comments
    WHERE body LIKE 'Respuesta por correo de %'`).all<{ id: string; body: string }>();
  const statements: D1PreparedStatement[] = [];
  let updatedClaims = 0;
  let updatedComments = 0;

  for (const claim of claimsResult.results ?? []) {
    const cleaned = cleanEmailContent(claim.body);
    const cleanBody = cleaned.body || claim.body.trim();
    const senderName = cleaned.senderName || claim.sender_name;
    const senderEmail = cleaned.senderEmail || claim.sender_email;
    if (cleanBody === claim.body && senderName === claim.sender_name && senderEmail === claim.sender_email) continue;
    statements.push(db.prepare(`UPDATE claims SET sender_name = ?, sender_email = ?, body = ? WHERE id = ?`)
      .bind(senderName, senderEmail, cleanBody, claim.id));
    if (claim.task_id) {
      statements.push(db.prepare("UPDATE tasks SET description = ? WHERE id = ?")
        .bind(`Correo recibido de ${senderName} <${senderEmail}>\n\n${cleanBody}\n\nReclamo ${claim.id.slice(0, 8)} · ingresado automáticamente desde Gmail.`, claim.task_id));
    }
    updatedClaims += 1;
  }

  for (const comment of commentsResult.results ?? []) {
    const parts = /^Respuesta por correo de ([^\n]+)\n\n([\s\S]*)$/.exec(comment.body);
    if (!parts) continue;
    const cleaned = cleanEmailContent(parts[2]);
    if (!cleaned.body || cleaned.body === parts[2]) continue;
    const sender = cleaned.senderEmail
      ? `${cleaned.senderName || cleaned.senderEmail} <${cleaned.senderEmail}>`
      : parts[1];
    statements.push(db.prepare("UPDATE comments SET body = ? WHERE id = ?")
      .bind(`Respuesta por correo de ${sender}\n\n${cleaned.body}`, comment.id));
    updatedComments += 1;
  }

  for (let index = 0; index < statements.length; index += 50) {
    await db.batch(statements.slice(index, index + 50));
  }
  return {
    ok: true,
    reviewedClaims: claimsResult.results?.length ?? 0,
    updatedClaims,
    updatedComments,
  };
}

export async function resetOperationalData(identity: AuthIdentity) {
  await requireAdmin(identity);
  const db = getDatabase();
  const [taskCount, claimCount, commentCount, eventCount] = await Promise.all([
    db.prepare("SELECT count(*) AS total FROM tasks").first<{ total: number }>(),
    db.prepare("SELECT count(*) AS total FROM claims").first<{ total: number }>(),
    db.prepare("SELECT count(*) AS total FROM comments").first<{ total: number }>(),
    db.prepare("SELECT count(*) AS total FROM email_intake_events").first<{ total: number }>(),
  ]);

  await db.batch([
    db.prepare("DELETE FROM email_notifications"),
    db.prepare("DELETE FROM email_intake_events"),
    db.prepare("DELETE FROM claims"),
    db.prepare("DELETE FROM comments"),
    db.prepare("DELETE FROM tasks"),
    db.prepare(`UPDATE mail_settings SET last_sync_at = NULL, last_sync_status = 'idle',
      last_sync_detail = '', last_sync_processed = 0 WHERE id = 'default'`),
    db.prepare("PRAGMA optimize"),
  ]);

  return {
    ok: true,
    deleted: {
      tasks: Number(taskCount?.total ?? 0),
      claims: Number(claimCount?.total ?? 0),
      comments: Number(commentCount?.total ?? 0),
      intakeEvents: Number(eventCount?.total ?? 0),
    },
  };
}

export async function updateMailSettings(identity: AuthIdentity, input: Partial<MailSettings>) {
  const user = await requireAdmin(identity);
  const current = await readMailSettings();
  const inboxAddress = String(input.inboxAddress ?? current.inboxAddress).trim().toLocaleLowerCase("es");
  const normalizeList = (value: unknown, fallback: string[], mode: "upper" | "lower") => Array.from(new Set(
    (Array.isArray(value) ? value : fallback)
      .map((item) => String(item).trim().slice(0, 80))
      .filter(Boolean)
      .map((item) => mode === "upper" ? item.toLocaleUpperCase("es") : item.toLocaleLowerCase("es")),
  )).slice(0, 20);
  const acceptedPatterns = normalizeList(input.acceptedPatterns, current.acceptedPatterns, "upper");
  const ignoredSubjectPatterns = normalizeList(input.ignoredSubjectPatterns, current.ignoredSubjectPatterns, "upper");
  const blockedSenders = normalizeList(input.blockedSenders, current.blockedSenders, "lower");
  const minimumBodyLength = Math.min(500, Math.max(0, Number(input.minimumBodyLength ?? current.minimumBodyLength) || 0));
  const lookbackDays = Math.min(30, Math.max(1, Number(input.lookbackDays ?? current.lookbackDays) || 7));
  const reminderHour = Math.min(23, Math.max(0, Number(input.reminderHour ?? current.reminderHour) || 0));
  const reminderRecipients = Array.from(new Set(
    (Array.isArray(input.reminderRecipients) ? input.reminderRecipients : current.reminderRecipients)
      .map((email) => String(email).trim().toLocaleLowerCase("es"))
      .filter(Boolean),
  ));
  if (!emailPattern.test(inboxAddress)) throw new Error("Ingresá una casilla de correo válida");
  if (!acceptedPatterns.length) throw new Error("Agregá al menos un patrón de asunto aceptado");
  if (reminderRecipients.some((email) => !emailPattern.test(email))) throw new Error("Revisá las direcciones de los recordatorios");
  if (input.remindersEnabled && reminderRecipients.length === 0) throw new Error("Agregá al menos un destinatario para activar los recordatorios");

  const now = Date.now();
  await getDatabase().prepare(`UPDATE mail_settings SET
      intake_enabled = ?, inbox_address = ?, subject_prefix = ?, accepted_patterns = ?,
      ignored_subject_patterns = ?, blocked_senders = ?, minimum_body_length = ?, lookback_days = ?,
      reminders_enabled = ?, reminder_recipients = ?, notify_urgent = ?, notify_due_today = ?,
      notify_overdue = ?, daily_summary = ?, reminder_hour = ?, timezone = ?,
      updated_by_id = ?, updated_at = ? WHERE id = 'default'`)
    .bind(
      input.intakeEnabled ?? current.intakeEnabled ? 1 : 0,
      inboxAddress,
      acceptedPatterns[0],
      JSON.stringify(acceptedPatterns),
      JSON.stringify(ignoredSubjectPatterns),
      JSON.stringify(blockedSenders),
      minimumBodyLength,
      lookbackDays,
      input.remindersEnabled ?? current.remindersEnabled ? 1 : 0,
      JSON.stringify(reminderRecipients),
      input.notifyUrgent ?? current.notifyUrgent ? 1 : 0,
      input.notifyDueToday ?? current.notifyDueToday ? 1 : 0,
      input.notifyOverdue ?? current.notifyOverdue ? 1 : 0,
      input.dailySummary ?? current.dailySummary ? 1 : 0,
      reminderHour,
      "America/Buenos_Aires",
      user.id,
      now,
    ).run();
  return loadWorkspace(identity);
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

export async function deleteClaim(identity: AuthIdentity, claimId: string) {
  await requireAdmin(identity);
  const db = getDatabase();
  const claim = await db.prepare("SELECT task_id FROM claims WHERE id = ?")
    .bind(claimId).first<{ task_id: string | null }>();
  if (!claim) throw new Error("Reclamo no encontrado");

  if (claim.task_id) {
    await db.batch([
      db.prepare("DELETE FROM claims WHERE id = ?").bind(claimId),
      db.prepare(`DELETE FROM tasks WHERE id = ?
        AND NOT EXISTS (SELECT 1 FROM claims WHERE task_id = ?)`)
        .bind(claim.task_id, claim.task_id),
    ]);
  } else {
    await db.prepare("DELETE FROM claims WHERE id = ?").bind(claimId).run();
  }
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

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  authUserId: text("auth_user_id"),
  username: text("username"),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  status: text("status", { enum: ["active", "invited"] }).notNull().default("active"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordIterations: integer("password_iterations").notNull().default(100000),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
}, (table) => [
  uniqueIndex("users_auth_user_id_unique").on(table.authUserId),
  uniqueIndex("users_username_unique").on(table.username),
  uniqueIndex("users_email_unique").on(table.email),
]);

export const consorcios = sqliteTable("consorcios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("consorcios_name_unique").on(table.name),
]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  building: text("building").notNull().default(""),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  status: text("status", { enum: ["pending", "in_progress", "review", "done"] }).notNull().default("pending"),
  dueDate: text("due_date"),
  consortiumId: text("consortium_id").references(() => consorcios.id, { onDelete: "set null" }),
  creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_tasks_creator_status").on(table.creatorId, table.status),
  index("idx_tasks_assignee_status").on(table.assigneeId, table.status),
  index("idx_tasks_consortium_id").on(table.consortiumId),
]);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_comments_task_created").on(table.taskId, table.createdAt),
]);

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  source: text("source", { enum: ["email"] }).notNull().default("email"),
  isTest: integer("is_test", { mode: "boolean" }).notNull().default(true),
  externalId: text("external_id").notNull(),
  gmailThreadId: text("gmail_thread_id"),
  senderName: text("sender_name").notNull().default(""),
  senderEmail: text("sender_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category", { enum: ["ascensor", "agua", "gas", "electricidad", "seguridad", "limpieza", "convivencia", "administracion", "mantenimiento", "otro"] }).notNull().default("otro"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  status: text("status", { enum: ["new", "assigned", "in_progress", "waiting", "resolved", "closed"] }).notNull().default("new"),
  consortiumId: text("consortium_id").references(() => consorcios.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  assignedToId: text("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("claims_external_id_unique").on(table.externalId),
  uniqueIndex("claims_gmail_thread_id_unique").on(table.gmailThreadId),
  index("idx_claims_status_created").on(table.status, table.createdAt),
  index("idx_claims_consortium_id").on(table.consortiumId),
  index("idx_claims_assigned_to_id").on(table.assignedToId),
]);

export const mailSettings = sqliteTable("mail_settings", {
  id: text("id").primaryKey(),
  intakeEnabled: integer("intake_enabled", { mode: "boolean" }).notNull().default(true),
  inboxAddress: text("inbox_address").notNull().default("leandroboveda@gmail.com"),
  subjectPrefix: text("subject_prefix").notNull().default("[RECLAMO]"),
  acceptedPatterns: text("accepted_patterns").notNull().default('["RECLAMO","SOLICITUD","PEDIDO"]'),
  ignoredSubjectPatterns: text("ignored_subject_patterns").notNull().default('["[TASKER]","RESPUESTA AUTOMÁTICA","FUERA DE LA OFICINA"]'),
  blockedSenders: text("blocked_senders").notNull().default('["no-reply","noreply"]'),
  minimumBodyLength: integer("minimum_body_length").notNull().default(5),
  lookbackDays: integer("lookback_days").notNull().default(7),
  remindersEnabled: integer("reminders_enabled", { mode: "boolean" }).notNull().default(false),
  reminderRecipients: text("reminder_recipients").notNull().default("[]"),
  notifyUrgent: integer("notify_urgent", { mode: "boolean" }).notNull().default(true),
  notifyDueToday: integer("notify_due_today", { mode: "boolean" }).notNull().default(true),
  notifyOverdue: integer("notify_overdue", { mode: "boolean" }).notNull().default(true),
  dailySummary: integer("daily_summary", { mode: "boolean" }).notNull().default(false),
  reminderHour: integer("reminder_hour").notNull().default(9),
  timezone: text("timezone").notNull().default("America/Buenos_Aires"),
  lastSyncAt: integer("last_sync_at"),
  lastSyncStatus: text("last_sync_status", { enum: ["idle", "ok", "error"] }).notNull().default("idle"),
  lastSyncDetail: text("last_sync_detail").notNull().default(""),
  lastSyncProcessed: integer("last_sync_processed").notNull().default(0),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at").notNull(),
});

export const emailIntakeEvents = sqliteTable("email_intake_events", {
  id: text("id").primaryKey(),
  externalId: text("external_id").notNull(),
  senderEmail: text("sender_email").notNull().default(""),
  recipientEmails: text("recipient_emails").notNull().default(""),
  subject: text("subject").notNull().default(""),
  status: text("status", { enum: ["accepted", "rejected"] }).notNull(),
  reason: text("reason").notNull().default(""),
  claimId: text("claim_id").references(() => claims.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("email_intake_events_external_id_unique").on(table.externalId),
  index("idx_email_intake_events_status_created").on(table.status, table.createdAt),
]);

export const emailNotifications = sqliteTable("email_notifications", {
  id: text("id").primaryKey(),
  notificationKey: text("notification_key").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  type: text("type", { enum: ["urgent", "due_today", "overdue", "daily_summary"] }).notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["pending", "reserved", "sent"] }).notNull().default("pending"),
  reservedAt: integer("reserved_at"),
  sentAt: integer("sent_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("email_notifications_key_unique").on(table.notificationKey),
  index("idx_email_notifications_status_created").on(table.status, table.createdAt),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("idx_sessions_user_expires").on(table.userId, table.expiresAt),
]);

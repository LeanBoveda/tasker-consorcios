import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Snapshots intentionally have no foreign keys: deleting a task or a person
// must not erase or rewrite the history of their actions.
export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorUsername: text("actor_username").notNull().default(""),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  entityLabel: text("entity_label").notNull(),
  details: text("details").notNull().default("[]"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_activity_workspace_created_id").on(table.workspaceId, table.createdAt, table.id),
  index("idx_activity_workspace_actor_created").on(table.workspaceId, table.actorId, table.createdAt),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().default("main"),
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
  workspaceId: text("workspace_id").notNull().default("main"),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("consorcios_workspace_name_unique").on(table.workspaceId, table.name),
]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().default("main"),
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
  index("idx_tasks_workspace").on(table.workspaceId),
  index("idx_tasks_creator_status").on(table.creatorId, table.status),
  index("idx_tasks_assignee_status").on(table.assigneeId, table.status),
  index("idx_tasks_consortium_id").on(table.consortiumId),
]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["assignment", "comment", "status", "due", "intake"] }).notNull(),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull().default(""),
  dedupeKey: text("dedupe_key"),
  readAt: integer("read_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_notifications_user_read_created").on(table.workspaceId, table.userId, table.readAt, table.createdAt),
  uniqueIndex("notifications_user_dedupe_unique").on(table.workspaceId, table.userId, table.dedupeKey),
]);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["manual", "email", "whatsapp", "system"] }).notNull().default("manual"),
  externalAuthor: text("external_author").notNull().default(""),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_comments_task_created").on(table.taskId, table.createdAt),
]);

export const automaticIntake = sqliteTable("automatic_intake", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().default("main"),
  source: text("source", { enum: ["email", "whatsapp"] }).notNull(),
  sourceAccount: text("source_account").notNull().default(""),
  externalId: text("external_id").notNull(),
  conversationId: text("conversation_id"),
  senderName: text("sender_name").notNull().default(""),
  senderAddress: text("sender_address").notNull().default(""),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  kind: text("kind", { enum: ["claim", "request", "order", "notice", "other"] }).notNull().default("other"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  status: text("status", { enum: ["pending", "accepted", "discarded", "error"] }).notNull().default("pending"),
  consortiumId: text("consortium_id").references(() => consorcios.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  attachments: text("attachments").notNull().default("[]"),
  isTest: integer("is_test", { mode: "boolean" }).notNull().default(false),
  errorDetail: text("error_detail").notNull().default(""),
  receivedAt: integer("received_at").notNull(),
  reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: integer("reviewed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("automatic_intake_workspace_external_unique").on(table.workspaceId, table.source, table.sourceAccount, table.externalId),
  index("idx_automatic_intake_status_created").on(table.status, table.createdAt),
  index("idx_automatic_intake_source_account").on(table.source, table.sourceAccount, table.receivedAt),
  index("idx_automatic_intake_task_id").on(table.taskId),
  index("idx_automatic_intake_conversation").on(table.source, table.sourceAccount, table.conversationId, table.receivedAt),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("idx_sessions_user_expires").on(table.userId, table.expiresAt),
]);

export const daemonInstances = sqliteTable("daemon_instances", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  hostName: text("host_name").notNull().default(""),
  version: text("version").notNull().default(""),
  status: text("status", { enum: ["online", "degraded", "error"] }).notNull().default("online"),
  startedAt: integer("started_at").notNull(),
  lastHeartbeatAt: integer("last_heartbeat_at").notNull(),
  lastError: text("last_error").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_daemon_instances_heartbeat").on(table.lastHeartbeatAt),
]);

export const daemonSources = sqliteTable("daemon_sources", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id").notNull().references(() => daemonInstances.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["email", "whatsapp"] }).notNull(),
  account: text("account").notNull(),
  displayName: text("display_name").notNull().default(""),
  status: text("status", { enum: ["connected", "degraded", "disconnected", "disabled"] }).notNull().default("connected"),
  lastCheckedAt: integer("last_checked_at").notNull(),
  lastMessageAt: integer("last_message_at"),
  lastError: text("last_error").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("daemon_sources_instance_kind_account_unique").on(table.instanceId, table.kind, table.account),
  index("idx_daemon_sources_instance").on(table.instanceId),
]);

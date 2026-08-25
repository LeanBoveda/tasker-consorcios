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

export const automaticIntake = sqliteTable("automatic_intake", {
  id: text("id").primaryKey(),
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
  uniqueIndex("automatic_intake_source_external_unique").on(table.source, table.sourceAccount, table.externalId),
  index("idx_automatic_intake_status_created").on(table.status, table.createdAt),
  index("idx_automatic_intake_source_account").on(table.source, table.sourceAccount, table.receivedAt),
  index("idx_automatic_intake_task_id").on(table.taskId),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("idx_sessions_user_expires").on(table.userId, table.expiresAt),
]);
